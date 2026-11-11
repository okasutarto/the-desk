// Run: node scripts/check-desk-strike-board.cjs
// Straw Hat Strike's bounty board in the game: who makes the board, the name asked for on the
// poster, its buttons, what the board answers, and the link that fetches and posts it.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = path.join(__dirname, '../src/features/desk3d');
const strip = (file) => fs.readFileSync(path.join(dir, file), 'utf8').replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
const canvas = () => new Proxy(function () {}, {
  get: (target, key) => (key === 'measureText' ? () => ({ width: 10 }) : canvas()),
  set: () => true,
  apply: () => canvas(),
});
const stored = {};
const ctx = vm.createContext({
  DISPLAY: 'display', BODY: 'body',
  localStorage: { getItem: (k) => stored[k] ?? null, setItem: (k, v) => (stored[k] = v) },
  navigator: { getGamepads: () => [] },
  Math, Number, String, Infinity, performance: { now: () => clock },
});
let clock = 0;
vm.runInContext(`${strip('strawHatStrike.js')}\n${strip('strikeBoard.js')}\n; this.api = { createStrike, drawStrike, strikeKey, qualifies, BOARD_SIZE, NAME_MAX, createStrikeBoard };`, ctx);
const { createStrike, drawStrike, strikeKey, qualifies, BOARD_SIZE, NAME_MAX, createStrikeBoard } = ctx.api;

// ---------- who makes the board ----------
const row = (score, rank = 1) => ({ id: `p${rank}`, rank, name: `P${rank}`, score, stage: 1 });
const full = Array.from({ length: BOARD_SIZE }, (_, i) => row(10000 - i * 500, i + 1));
assert.equal(BOARD_SIZE, 10);
assert.equal(NAME_MAX, 12);
assert.equal(qualifies([], 0), false, 'no bounty, no board');
assert.equal(qualifies([], 10), true, 'an empty board takes anyone');
assert.equal(qualifies(full, full[9].score), false, 'a tie with the tenth stays off');
assert.equal(qualifies(full, full[9].score + 1), true, 'beating the tenth makes it');

// ---------- a game, with the link stubbed ----------
const calls = [];
const typer = { typing: null, caretOn: true, startTyping(field) { this.typing = field; calls.push('type'); }, stopTyping() { this.typing = null; calls.push('stop'); } };
let posted = null;
const api = {
  getBoard: async () => ({ ok: true, top: full.slice(0, 3) }),
  startRun: async () => ({ ok: true, token: 'ticket-1' }),
  postScore: async (body) => (posted = body, { ok: true, improved: true, rank: 2, top: [row(9000, 1), row(body.score, 2)] }),
};
const link = createStrikeBoard({ textInput: typer, api });
const g = createStrike(() => {}, link);
link.attach(g);
const c = canvas();
let t = 100;
const frame = () => {
  t += 1 / 60;
  g.step(t);
  const hotspots = [];
  drawStrike(c, 640, 384, g, t, 0, hotspots);
  return hotspots;
};
const settle = () => new Promise((r) => setImmediate(r));

(async () => {
  await link.refresh();
  assert.equal(g.boardState, 'ready');
  assert.equal(g.board.length, 3);
  frame();

  // sail, then sink with a bounty that makes the board
  strikeKey(g, { key: ' ' }, true);
  assert.equal(g.state, 'play');
  await settle();
  g.score = 4321;
  g.lives = 1;
  g.inv = 0;
  g.bullets.push({ x: g.ship.x + 2, y: g.ship.y - 12, vx: 0, vy: 0, r: 5, kind: 'ball' });
  for (let i = 0; i < 5 && g.state === 'play'; i++) frame();
  assert.equal(g.state, 'over');
  assert.equal(g.entry.state, 'typing', 'a bounty on the board asks for a name');
  assert.ok(!calls.includes('type'), 'not before the poster lands');
  for (let i = 0; i < 60; i++) frame();
  assert.ok(calls.includes('type'), 'then the keyboard is up');
  assert.equal(typer.typing.id, 'strikeName');
  assert.equal(typer.typing.maxLength, NAME_MAX);

  // the poster's buttons sit above the tap that would restart
  const spots = frame();
  const at = (id) => spots.findIndex((hs) => hs.id === id);
  for (const id of ['strikeName', 'strikePost', 'strikeSkip']) assert.ok(at(id) > at('strikeStart'), `${id} sits above the restart`);

  // a tap or Space while naming doesn't restart
  t += 2;
  g.start();
  strikeKey(g, { key: ' ' }, true);
  assert.equal(g.state, 'over', 'no restart while a name is asked for');

  // a refused name can be fixed
  api.postScore = async () => ({ ok: false, reason: 'words' });
  typer.typing.set('B4dName');
  await link.post();
  assert.equal(g.entry.state, 'refused');
  assert.ok(typer.typing, 'the keyboard stays up to fix it');
  frame();
  typer.typing.set('Luffy\n');
  assert.equal(g.entry.state, 'typing', 'typing again clears the refusal');
  assert.equal(g.entry.name, 'Luffy', 'one line only');
  typer.typing.set('x'.repeat(30));
  assert.equal(g.entry.name.length, NAME_MAX, 'twelve at most');
  typer.typing.set('Luffy');

  // posted
  api.postScore = async (body) => (posted = body, { ok: true, improved: true, rank: 2, top: [row(9000, 1), { ...row(body.score, 2), name: body.name }] });
  await typer.typing.onEnter();
  assert.deepEqual({ ...posted }, { token: 'ticket-1', score: 4321, stage: 1, name: 'Luffy' });
  assert.equal(g.entry.state, 'posted');
  assert.equal(g.entry.rank, 2);
  assert.equal(g.board[1].name, 'Luffy', 'the board takes the answer');
  assert.equal(stored['strike-name'], 'Luffy', 'the name is offered next time');
  assert.equal(typer.typing, null, 'the keyboard goes');
  frame();
  t += 1;
  g.start();
  assert.equal(g.state, 'play', 'and a tap sails again');
  assert.equal(g.entry, null);
  assert.equal(g.name, 'Luffy');

  // a run without a ticket (the API was down as it started) stays off the board
  api.startRun = async () => ({ ok: false, reason: 'offline' });
  g.reset();
  await settle();
  g.score = 9999;
  g.state = 'over';
  g.entry = { state: 'typing', name: 'Zoro' };
  await link.post();
  assert.equal(g.entry.state, 'offline');
  assert.equal(g.entry.reason, 'token');
  frame();

  // skipping lets go of the keyboard
  g.entry = { state: 'typing', name: '' };
  link.focusName();
  g.skipEntry();
  assert.equal(g.entry, null);
  assert.equal(typer.typing, null);

  // a bounty under the tenth asks for nothing
  g.board = full;
  g.reset();
  g.score = 10;
  g.lives = 1;
  g.inv = 0;
  g.bullets.push({ x: g.ship.x + 2, y: g.ship.y - 12, vx: 0, vy: 0, r: 5, kind: 'ball' });
  for (let i = 0; i < 5 && g.state === 'play'; i++) frame();
  assert.equal(g.state, 'over');
  assert.equal(g.entry, null);

  // the board out at sea: the game plays on without it
  const offline = createStrikeBoard({ textInput: typer, api: { getBoard: async () => ({ ok: false }), startRun: async () => ({ ok: false }), postScore: async () => ({ ok: false }) } });
  const lone = createStrike(() => {}, offline);
  offline.attach(lone);
  await offline.refresh();
  assert.equal(lone.boardState, 'offline');
  drawStrike(c, 640, 384, lone, 200, 0, []);
  lone.state = 'over';
  lone.score = 5;
  drawStrike(c, 640, 384, lone, 200, 0, []);

  // every state of the poster's panel draws
  for (const state of ['typing', 'refused', 'sending', 'posted', 'offline']) {
    g.state = 'over';
    g.overAt = g.t - 5;
    g.entry = { state, name: state === 'typing' ? '' : 'Nami', reason: 'words', rank: 3, improved: state !== 'posted' };
    frame();
  }

  // the wiring
  const desktop = fs.readFileSync(path.join(dir, 'desktop.js'), 'utf8');
  assert.match(desktop, /createStrike\(\(name\) => actions\.sound\?\.\(name\), actions\.strike\)/);
  for (const id of ['strikeName', 'strikePost', 'strikeSkip']) assert.ok(desktop.includes(`"${id}"`), `${id} is clickable`);
  assert.match(desktop, /actions\.strike\?\.stopName\(\)/, 'switching the console off lets go of the keyboard');
  assert.match(fs.readFileSync(path.join(dir, 'scene/workstation.js'), 'utf8'), /strike: createStrikeBoard\(\{ textInput: runtime\.textInput \}\)/);
  console.log('Bounty board: who makes it, the name on the poster, refusals, posting, skipping and the offline game passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
