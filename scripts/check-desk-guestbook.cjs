// Run: node scripts/check-desk-guestbook.cjs
// The guestbook on the cork board (it was the About board): which papers are up, a page of
// notes and the tab to older ones, writing and pinning a note, refusals and an unreachable
// board, and every paper drawing.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('three');

const source = require('./helpers/desk-source.cjs').readDeskSource();
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
// Tweens land at once, their end values applied and their onComplete run, so a flight plays out
const land = (target, values) => {
  for (const [key, value] of Object.entries(values)) if (typeof value === 'number' && key in target && !['duration', 'delay'].includes(key)) target[key] = value;
  values.onComplete?.();
};
const gsap = { to: land, fromTo: (target, from, to) => land(target, to), killTweensOf() {}, isTweening: () => false };
const stored = {};
const calls = { typing: [], stopped: 0, get: [], post: [] };
let notesReply = { ok: false };
let postReply = { ok: false, reason: 'offline' };
const redraws = new Map();
const ctx = {
  THREE, gsap, focus: { name: 'about' }, hoverSound() {}, WALL_Z: -4.9, badgeClearance: null, scene: new THREE.Group(), renderer: { domElement: { style: {} } },
  track: (value) => value, noRaycast() {}, windowWood: { texture: new THREE.Texture() },
  printed: (w, h) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial());
    mesh.userData.tex = { redraw: () => redraws.set(mesh, (redraws.get(mesh) || 0) + 1), ctx: {}, canvas: { width: 896, height: 608 } };
    return mesh;
  },
  mesh: (geometry, material) => new THREE.Mesh(geometry, material), rbox: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  toon: (color) => new THREE.MeshToonMaterial({ color }), printMaterial: () => new THREE.MeshToonMaterial(), drawAboutBoard() {}, drawGuestPaper() {},
  // the letter under a point: the name above the middle, the note below, one letter a tenth
  composerIndexAt: (c, w, h, compose, uv, only) => ({ field: only || (uv.y > 0.5 ? 'name' : 'message'), index: Math.round(uv.x * 10) }),
  register() {}, sfx: { pop() {}, tick() {}, riffle() {}, buzz() {}, tear() {}, paper() {} },
  GUEST_NAME_MAX: 20, GUEST_MESSAGE_MAX: 120, GUEST_PAPERS: ['a', 'b', 'c', 'd', 'e', 'f'],
  getNotes: async (before) => (calls.get.push(before), notesReply),
  postNote: async (body) => (calls.post.push(body), postReply),
  localStorage: { getItem: (k) => stored[k] ?? null, setItem: (k, v) => (stored[k] = v) },
  timers: [], setTimeout: (fn) => (ctx.later = fn, 0), destroyed: false, caretOn: true, typing: null, selection: { start: 0, end: 0 },
  startTyping(field) { ctx.typing = field; calls.typing.push(field.id); },
  select(start, end = start) { calls.selected = [Math.min(start, end), Math.max(start, end)]; },
  stopTyping() { const field = ctx.typing; ctx.typing = null; calls.stopped++; field?.onStop?.(); },
};
const board = vm.runInNewContext(
  section('  const aboutBoard =', '  // ---------- keyboard:') + '; ({ aboutBoard, boardNotes, book, compose, write, post, turnPage, loadPage })', ctx);
const settle = () => new Promise((r) => setImmediate(r));
const up = () => Array.from(board.boardNotes.filter((note) => note.paper.parent === board.aboutBoard), (note) => note.slot);
const kinds = () => Array.from(board.boardNotes.filter((note) => note.shown), (note) => note.kind);
const note = (i, at = 1000 - i) => ({ id: `n${i}`, name: `Crew ${i}`, message: `note ${i}`, at, paper: i % 6 });

(async () => {
  // ---------- the papers before anything's heard ----------
  assert.equal(board.boardNotes.length, 12);
  assert.deepEqual(up(), [0, 1], 'the pad, top left, and a "fetching" note');
  assert.deepEqual(kinds(), ['compose', 'placeholder']);
  assert.ok(board.aboutBoard.children.some((child) => child.isGroup && child.children.length === 4 && child.position.x === board.boardNotes[0].home.x), 'loose sheets and a shadow make the pad');
  assert.equal(board.boardNotes[0].pin.visible, false, 'the pad is stuck down, not pinned');
  assert.ok(ctx.timers.length > 0 && typeof ctx.later === 'function', 'the notes are fetched a moment after the room opens');

  // ---------- unreachable ----------
  await board.loadPage(1);
  assert.equal(board.book.state, 'offline');
  assert.deepEqual(kinds(), ['compose', 'placeholder'], 'the board says it can\'t reach the notes');

  // ---------- empty ----------
  notesReply = { ok: true, notes: [], more: false };
  await board.loadPage(1);
  assert.equal(board.book.state, 'ready');
  assert.deepEqual(kinds(), ['compose', 'placeholder'], '"be the first" when nobody has signed');

  // ---------- a page, and older ones ----------
  notesReply = { ok: true, notes: Array.from({ length: 10 }, (_, i) => note(i)), more: true, next: 990.5 };
  await board.loadPage(1);
  assert.deepEqual(up(), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 'ten notes and the tab');
  // a paper dragged to an empty part of the board stays there; only papers that are up get in
  // the way (the empty slots are off the board)
  const overlapStart = source.indexOf('  function notesOverlap(');
  const notesOverlap = vm.runInNewContext(source.slice(overlapStart, source.indexOf('  function liftNote(', overlapStart)) + '; notesOverlap');
  const lone = board.boardNotes[1];
  const hidden = { ...board.boardNotes[5], shown: false, paper: { position: { ...lone.paper.position } } };
  assert.equal(notesOverlap(lone, hidden), false, 'an empty slot under the drop doesn\'t send it back');
  assert.equal(notesOverlap(lone, { ...board.boardNotes[2], paper: { position: { ...lone.paper.position } } }), true, 'a paper that is up still does');
  // moved, then given another note by a new page, a paper goes back to its place
  lone.paper.position.x += 1;
  assert.equal(board.boardNotes[11].kind, 'pager');
  const notesUp = board.boardNotes.filter((paper) => paper.kind === 'note');
  assert.equal(notesUp.length, 10);
  assert.equal(board.boardNotes[0].kind, 'compose');
  assert.ok(notesUp.every((paper) => Math.abs(paper.angle) <= 3 * Math.PI / 180 + 1e-9), 'tilted 3° at most');
  assert.equal(board.boardNotes[1].kind, 'note', 'the newest starts at the top, beside the pad');
  assert.equal(board.boardNotes[8].kind, 'note', 'and the left column, down by the badge, fills last');
  notesReply = { ok: true, notes: [note(10, 5), note(11, 4)], more: false };
  board.boardNotes[11].onTap();
  await settle();
  assert.equal(lone.paper.position.x, lone.home.x, 'a moved paper with a new note goes home');
  assert.equal(calls.get.at(-1), 990.5, 'page two starts where page one ended (its next)');
  assert.equal(board.book.page, 2);
  assert.deepEqual(up(), [0, 1, 2, 11], 'two older notes, and the tab back');
  notesReply = { ok: true, notes: [note(0)], more: false };
  board.boardNotes[11].onTap();
  await settle();
  assert.equal(calls.get.at(-1), null, 'the last page goes back to the newest');
  assert.equal(board.book.page, 1);
  assert.deepEqual(up(), [0, 1], 'one note, no tab');

  // ---------- writing a note ----------
  const card = board.boardNotes[0];
  const paperBefore = board.compose.paper;
  assert.ok(paperBefore >= 0 && paperBefore < 6, 'the card is on a paper of its own');
  card.onTap();
  assert.equal(board.compose.state, 'typing');
  assert.equal(card.raised, true, 'tapped, the top sheet is peeled off and comes up to be written on');
  assert.ok(card.paper.scale.x > 2, 'held up large');
  assert.equal(ctx.typing.id, 'guestMessage', 'the note first, signed after');
  ctx.typing.set('x'.repeat(200));
  assert.equal(board.compose.message.length, 120, 'a hundred and twenty at most');
  ctx.typing.onEnter();
  assert.equal(ctx.typing.id, 'guestName', 'Enter moves on to the signature while it\'s unsigned');
  ctx.typing.set('Luffy\n');
  assert.equal(board.compose.name, 'Luffy');
  ctx.typing.onTab();
  assert.equal(ctx.typing.id, 'guestMessage', 'Tab goes back to the note');
  assert.equal(card.raised, true, 'moving between its lines keeps the card up');

  // refused: the line that needs fixing gets the keyboard
  postReply = { ok: false, field: 'name', reason: 'words' };
  ctx.typing.set('Keren banget!');
  await board.post();
  assert.deepEqual([board.compose.state, board.compose.field, ctx.typing.id], ['refused', 'name', 'guestName']);
  ctx.typing.set('Lufy');
  assert.equal(board.compose.state, 'typing', 'typing again clears the refusal');
  postReply = { ok: false, reason: 'limit', scope: 'visitor' };
  await board.post();
  assert.equal(board.compose.reason, 'limit');

  // nothing written: nothing sent
  const sent = calls.post.length;
  board.compose.message = '   ';
  await board.post();
  assert.equal(calls.post.length, sent, 'an empty note isn\'t sent');
  assert.deepEqual([board.compose.state, board.compose.field], ['refused', 'message']);

  // pinned
  board.compose.message = 'Keren banget!';
  board.compose.name = 'Luffy';
  postReply = { ok: true, note: { id: 'mine', name: 'Luffy', message: 'Keren banget!', at: 2000, paper: 2 } };
  notesReply = { ok: true, notes: [postReply.note, note(0)], more: false };
  const pinning = board.post();
  assert.equal(board.compose.state, 'sending');
  ctx.typing.set('typed while it was on its way');
  assert.equal(board.compose.message, 'Keren banget!', 'keys typed while it\'s sent don\'t change the card');
  await pinning;
  assert.deepEqual({ ...calls.post.at(-1) }, { name: 'Luffy', message: 'Keren banget!', paper: paperBefore }, 'it goes up on the paper it was written on');
  assert.equal(board.compose.state, 'posted');
  assert.equal(board.compose.message, '', 'the card is clean for another');
  assert.equal(ctx.typing, null, 'the keyboard goes');
  ctx.later();
  assert.equal(card.raised, false, 'the sheet has flown to the board');
  assert.equal(board.book.notes[0].id, 'mine', 'it is the newest note');
  // the note already up stays where it was; the new one takes the next free place
  const slotOf = (id) => board.boardNotes.findIndex((paper) => paper.content === id);
  assert.equal(slotOf('n0'), 1, 'the older note stays put');
  assert.equal(slotOf('mine'), 2, 'the new one goes in the next free place');
  assert.equal(board.boardNotes[2].pin.visible, true, 'a pin dropped into it');
  assert.equal(board.boardNotes[2].pin.position.z, 0.09, 'and bit into the cork');
  assert.deepEqual([card.paper.position.x, card.paper.position.y, card.paper.scale.x], [card.home.x, card.home.y, 1], 'the pad has a fresh sheet on top');
  assert.equal(card.kind, 'compose');
  assert.equal(stored['guestbook-name'], 'Luffy', 'the name is offered next time');
  assert.equal(board.book.notes[0].id, 'mine', 'straight to the top of the first page');
  await settle();
  assert.deepEqual([slotOf('n0'), slotOf('mine')], [1, 2], 'and the board as the server has it keeps them there');
  board.boardNotes[0].onTap();
  assert.equal(ctx.typing.id, 'guestMessage', 'a new sheet starts at the note');
  assert.equal(card.raised, true);
  // held up, it's written on like a text box: a tap puts the caret by a letter, in the line
  // it lands on
  card.onTap({ x: 0.3, y: 0.7 });
  assert.equal(ctx.typing.id, 'guestName', 'a tap on the name changes it');
  assert.deepEqual(calls.selected, [3, 3], 'with the caret by the letter tapped');
  card.onTap({ x: 0.5, y: 0.3 });
  assert.equal(ctx.typing.id, 'guestMessage', 'a tap lower down goes back to the note');
  assert.deepEqual(calls.selected, [5, 5]);
  // a press puts the caret down at once, a drag picks out what it passes, kept in its line
  card.onPress({ x: 0.2, y: 0.3 });
  assert.deepEqual(calls.selected, [2, 2]);
  card.onSelect({ x: 0.2, y: 0.3 }, { x: 0.8, y: 0.3 });
  assert.deepEqual(calls.selected, [2, 8], 'a drag picks out the letters it passes');
  card.onSelect({ x: 0.8, y: 0.3 }, { x: 0.1, y: 0.9 });
  assert.equal(ctx.typing.id, 'guestMessage', 'a drag that strays up into the name stays in the note');
  assert.deepEqual(calls.selected, [1, 8], 'and picks out backwards too');
  // put aside (Esc, a click elsewhere): back on the board, the words kept for later
  ctx.typing.set('half a thought');
  ctx.stopTyping();
  ctx.later();
  assert.equal(card.raised, false, 'put aside, the sheet goes back on the pad');
  assert.deepEqual([card.paper.position.x, card.paper.scale.x], [card.home.x, 1]);
  assert.equal(board.compose.message, 'half a thought');

  // ---------- a full page: the new note takes the place of the one that goes over ----------
  ctx.stopTyping();
  ctx.later();
  notesReply = { ok: true, notes: Array.from({ length: 10 }, (_, i) => note(i + 20, 900 - i)), more: true, next: 1 };
  await board.loadPage(2);
  await board.loadPage(1);
  const before = new Map(Array.from(board.boardNotes, (paper) => [paper.content, paper.slot]));
  const leaving = 'n29';
  board.boardNotes[0].onTap();
  board.compose.name = 'Zoro';
  board.compose.message = 'Full house';
  postReply = { ok: true, note: { id: 'last', name: 'Zoro', message: 'Full house', at: 5000, paper: 1 } };
  notesReply = { ok: true, notes: [postReply.note, ...Array.from({ length: 9 }, (_, i) => note(i + 20, 900 - i))], more: true, next: 1 };
  await board.post();
  assert.equal(slotOf('last'), before.get(leaving), 'it is pinned where the oldest one was');
  for (let i = 20; i < 29; i++) assert.equal(slotOf(`n${i}`), before.get(`n${i}`), `n${i} stays put`);
  await settle();
  assert.equal(slotOf('last'), before.get(leaving), 'and stays there once the board is fetched again');

  // ---------- a selection on the card ----------
  board.boardNotes[0].onTap();
  ctx.typing.set('pick these words out');
  ctx.selection = { start: 5, end: 10 };
  ctx.typing.redraw();
  assert.deepEqual({ ...board.compose.sel }, { start: 5, end: 10 }, 'the card knows what\'s picked out');
  assert.equal(ctx.typing.showsSelection, true, 'and redraws as the caret moves');

  // ---------- the papers draw ----------
  const paint = fs.readFileSync(path.join(__dirname, '../src/features/desk3d/textures/guestbook.js'), 'utf8')
    .replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
  const canvas = () => new Proxy(function () {}, {
    get: (target, key) => (key === 'measureText' ? (text) => ({ width: String(text).length * 9 }) : canvas()),
    set: () => true,
    apply: () => canvas(),
  });
  const wrap = (c, text, width, max) => {
    const lines = [];
    let line = '';
    for (const word of String(text).split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (c.measureText(test).width > width && line) { lines.push(line); line = word; } else line = test;
    }
    if (line) lines.push(line);
    return lines.slice(0, max);
  };
  const tex = vm.runInNewContext(`${paint}; ({ drawGuestPaper, refusalText, noteDate, composerIndexAt, composerLayout })`, { BODY: 'b', DISPLAY: 'd', wrap, Date, Math, String, Number });
  const c = canvas();
  const long = 'a'.repeat(120);
  for (const slot of [
    { kind: 'note', note: note(1) },
    { kind: 'note', note: { ...note(2), message: long, name: 'x'.repeat(20) } },
    { kind: 'placeholder', text: 'No notes yet.' },
    { kind: 'pager', pager: { more: true, page: 1 } },
    { kind: 'pager', pager: { more: false, page: 3 } },
    ...['idle', 'typing', 'sending', 'refused', 'posted'].map((state) => ({ kind: 'compose', compose: { state, field: 'message', name: 'Luffy', message: long, reason: 'link', caret: true } })),
    ...[{ start: 0, end: 0 }, { start: 3, end: 60 }, { start: 120, end: 120 }].map((sel) => ({ kind: 'compose', compose: { state: 'typing', field: 'message', name: 'Luffy', message: `${'kata '.repeat(24)}`, caret: true, sel } })),
    { kind: 'compose', compose: { state: 'typing', field: 'name', name: 'Luffy', message: '', caret: true, sel: { start: 1, end: 4 } } },
    undefined,
  ]) tex.drawGuestPaper(c, 420, 285, slot);
  // a point on the card to the letter by it, as the drawing lays them out (9 px a letter here)
  {
    const card = { name: 'Luffy', message: 'one two three', field: 'message', sel: { start: 0, end: 0 } };
    const W = 420;
    const H = 285;
    const layout = tex.composerLayout(c, W, H, card);
    const at = (x, y, only) => ({ ...tex.composerIndexAt(c, W, H, card, { x: x / W, y: 1 - y / H }, only) });
    assert.deepEqual(at(layout.name.x + 9 * 2 + 1, layout.name.top), { field: 'name', index: 2 }, 'two letters into the signature');
    assert.equal(layout.name.x + 9 * card.name.length, W - layout.pad, 'the signature ends flush with the right edge');
    assert.deepEqual(at(layout.pad - 30, layout.message.top), { field: 'message', index: 0 }, 'left of the note: its start');
    assert.deepEqual(at(layout.pad + 9 * 8 - 2, layout.message.top), { field: 'message', index: 8 }, 'eight letters into the note');
    assert.deepEqual(at(W, layout.message.top), { field: 'message', index: 13 }, 'past the end: the end');
    assert.deepEqual(at(layout.pad + 9, layout.name.top, 'message'), { field: 'message', index: 1 }, 'kept to the note when asked');
    const long = { ...card, message: 'aa bb cc dd ee ff gg hh ii jj kk ll mm nn oo pp qq rr ss tt uu vv ww xx yy zz '.repeat(2).trim(), sel: { start: 3, end: 3 } };
    const lines = tex.composerLayout(c, W, H, long).message;
    assert.ok(lines.lines.length > 3 && lines.shown.length === 3, 'a long note shows three lines at a time');
    const second = tex.composerIndexAt(c, W, H, long, { x: (layout.pad + 1) / W, y: 1 - (lines.top + lines.step) / H });
    assert.equal(second.index, lines.starts[lines.first + 1], 'the second line shown starts where it does in the text');
  }
  assert.equal(tex.refusalText({ field: 'message', reason: 'link' }), 'No links, please.');
  assert.equal(tex.refusalText({ reason: 'limit', scope: 'visitor' }), 'That\'s your notes for today.');
  assert.equal(tex.refusalText({ reason: 'limit', scope: 'everyone' }), 'The board\'s full for today.');
  assert.equal(tex.noteDate(1000, 1000 + 3600e3), 'today');
  assert.equal(tex.noteDate(0, 3 * 86400e3 + 5), '3 days ago');

  // ---------- the wiring ----------
  const read = (file) => fs.readFileSync(path.join(__dirname, '../src/features/desk3d', file), 'utf8');
  assert.match(read('scene/pointer.js'), /drag\.note\.onTap\?\.\(\)/, 'a tapped paper does its thing');
  assert.ok(!read('scene/aboutBoard.js').includes('ABOUT_NOTES'), 'the room\'s board no longer shows the About notes');
  assert.match(read('textures/aboutBoard.js'), /const HEADING = "GUESTBOOK"/);
  assert.match(read('textures/aboutBoard.js'), /measureText\(HEADING\)/, 'the tape is cut to the word, so no letter hangs off it');
  console.log('Guestbook: papers up, pages and the tab, writing, refusals, pinning, an unreachable board and every paper drawing passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
