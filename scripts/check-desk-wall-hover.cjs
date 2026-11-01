// Run: node scripts/check-desk-wall-hover.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('three');
const source = require('./helpers/desk-source.cjs').readDeskSource();
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const apply = (target, values) => {
  for (const key of ['x', 'y', 'z', 'r', 'g', 'b', 'strength', 'phase', 'opacity']) if (key in values) target[key] = values[key];
  values.onUpdate?.();
};
let tweening = false;
const gsap = { to: apply, fromTo: (target, from, to) => { apply(target, from); apply(target, to); }, killTweensOf() {}, isTweening: () => tweening };
const handlers = new Map();
const focus = { name: 'about' };
let boardContext;
const board = vm.runInNewContext(
  fs.readFileSync(`${__dirname}/../src/data/about.js`, 'utf8').replace(/export /g, '') +
  section('  const aboutBoard =', '  // ---------- keyboard:') + '; ({ aboutBoard, boardNotes, liftNote, pinNote })', boardContext = {
    THREE, gsap, focus, hoverSound() {}, WALL_Z: -4.9, badgeClearance: null, scene: new THREE.Group(), renderer: { domElement: { style: {} } },
    track: (value) => value, noRaycast() {}, windowWood: { texture: new THREE.Texture() },
    printed: (w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial()),
    mesh: (geometry, material) => new THREE.Mesh(geometry, material), rbox: (w, h, d) => new THREE.BoxGeometry(w, h, d),
    toon: (color) => new THREE.MeshToonMaterial({ color }), printMaterial: () => new THREE.MeshToonMaterial(), drawAboutBoard() {}, drawAboutNote() {},
    register: (object, handler) => handlers.set(object, handler), sfx: { pop() {} },
  });
for (const note of board.boardNotes) {
  const pinBefore = note.pin.getWorldPosition(new THREE.Vector3());
  const print = note.sheet.children.find((child) => child.geometry.type === 'PlaneGeometry' && child.geometry.parameters.width === note.w);
  const restBounds = new THREE.Box3().setFromObject(note.sheet);
  handlers.get(note.paper).onHover(true);
  assert.ok(note.pin.getWorldPosition(new THREE.Vector3()).distanceTo(pinBefore) < 1e-9, 'hover never unpins paper');
  assert.ok(new THREE.Box3().setFromObject(note.sheet).max.z > restBounds.max.z, 'loose edge lifts toward viewer');
  assert.equal(print.position.y, -note.sheet.position.y, 'print stays aligned with backing');
  tweening = true;
  handlers.get(note.paper).onHover(false);
  assert.equal(note.sheet.rotation.x, 0, 'leave always resets, even during pin animation');
  tweening = false;
  handlers.get(note.paper).onHover(true);
  board.liftNote(note);
  assert.equal(note.sheet.rotation.x, 0, 'drag takes over with a flat sheet');
  assert.equal(note.shadow.material.opacity, 0.32);
}
const boardPosition = board.aboutBoard.position.clone();
for (const name of ['about', 'room']) {
  focus.name = name;
  handlers.get(board.aboutBoard).onHover(true);
  assert.ok(board.boardNotes.every((note) => note.sheet.rotation.x === 0), `${name}: the cork leaves the papers alone`);
  handlers.get(board.aboutBoard).onHover(false);
}
focus.name = 'about';
assert.ok(board.aboutBoard.position.equals(boardPosition), 'board stays mounted');

// The badge swinging over a paper hangs clear of it, and further out when the paper tips forward
const clearance = boardContext.badgeClearance;
const who = board.boardNotes[0];
const overWho = [board.aboutBoard.position.x + who.paper.position.x, board.aboutBoard.position.y + who.paper.position.y + 0.74];
const restClear = clearance(...overWho, 0);
assert.ok(restClear > board.aboutBoard.position.z + who.paper.position.z + 0.2, 'badge clears a resting paper and its pin');
who.sheet.rotation.x = -0.24;
assert.ok(clearance(...overWho, 0) > restClear + 0.2, 'badge clears a paper tipped out by hover');
who.sheet.rotation.x = 0;
assert.equal(clearance(-20, 0, 0), -Infinity, 'off the board the badge keeps its own depth');

const stringGeo = new THREE.BoxGeometry(0.008, 4.15, 0.008, 1, 16, 1);
const stringMat = new THREE.MeshBasicMaterial({ color: '#f4f2ee' });
let guitarHandler;
const guitar = vm.runInNewContext(section('  const stringRestColor', '  // Sun (or moon) through the window') + '; ({ stringVibration, updateGuitarStrings })', {
  stringGeo, stringMat, gsap, guitarSwing: new THREE.Group(), register: (_, handler) => { guitarHandler = handler; },
});
const original = stringGeo.attributes.position.array.slice();
guitar.stringVibration.strength = 0.025;
guitar.stringVibration.phase = Math.PI / 2;
guitar.updateGuitarStrings();
const pos = stringGeo.attributes.position;
let displaced = false;
for (let i = 0; i < pos.count; i++) {
  const movement = Math.abs(pos.getX(i) - original[i * 3]);
  if (Math.abs(original[i * 3 + 1]) > 2.074) assert.ok(movement < 1e-8, 'nut and bridge stay fixed');
  else if (movement > 0.001) displaced = true;
}
assert.ok(displaced, 'strings vibrate between their anchors');
guitarHandler.onHover(false);
assert.deepEqual(stringGeo.attributes.position.array, original, 'strings settle exactly after leave');

// Window hover must not call forecast loading or change weather state.
let windowHandler;
const windowCatches = [new THREE.Group(), new THREE.Group()];
const windowGlare = { material: { opacity: 0.55 } };
vm.runInNewContext(section('  register(windowGroup, {', '  // The rain outside the window'), {
  gsap, windowCatches, windowGlare, glareTex: { texture: new THREE.Texture() }, windowGroup: {}, register: (_, handler) => { windowHandler = handler; },
  hideWeather() {}, lookOut() { throw new Error('hover triggered lookOut'); },
});
windowHandler.onHover(true);
for (const handle of windowCatches) assert.equal(handle.rotation.z, 0, 'the handles turn only when hovered themselves');
windowHandler.onHover(false);
for (const handle of windowCatches) assert.equal(handle.rotation.z, 0);
assert.equal(windowGlare.material.opacity, 0.55);

// Clock and painting hover leave their hands/artwork untouched and yield during a click.
for (const [start, end, name, actor] of [
  ['  let clockBusy =', '  // The rug runs', 'clock', 'clockMount'],
  ['  let paintingBusy =', '  const CHAIR_FLOOR =', 'paintingHang', 'paintingHang'],
]) {
  let handler;
  const object = new THREE.Group();
  const ctx = vm.createContext({ hoverSound() {}, gsap, [actor]: object, [name]: object, register: (_, value) => { handler = value; } });
  vm.runInContext(section(start, end), ctx);
  handler.onHover(true);
  assert.notEqual(object.rotation.z, 0);
  handler.onHover(false);
  assert.equal(object.rotation.z, 0);
  vm.runInContext(`${name === 'clock' ? 'clockBusy' : 'paintingBusy'} = true`, ctx);
  handler.onHover(true);
  assert.equal(object.rotation.z, 0, 'click animation owns the rotation while busy');
}
console.log('Wall hover: pinned paper, drag handoff, mounted board, string anchors, window reset and click isolation passed.');

// Moving from a board into its paper must not retain the parent through the paper.
const parent = new THREE.Group();
const child = new THREE.Group();
parent.add(child);
let hovered = { object: parent };
let hits = [{ object: child }, { object: parent }];
const pickContext = vm.createContext({
  hovered, rayFromPointer() {}, visibleHits: () => hits, entryFor: (object) => ({ object }),
});
const pickHover = vm.runInContext(section('  const pickHover =', '  const setHover =') + '; pickHover', pickContext);
assert.equal(pickHover({}).object, child, 'foreground child gets hover ahead of its parent');
const peer = new THREE.Group();
hits = [{ object: peer }, { object: parent }];
assert.equal(pickHover({}).object, parent, 'overlapping peers retain hover to avoid flicker');
console.log('Board-to-paper hover handoff and peer retention passed.');
