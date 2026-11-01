// Run: node scripts/check-desk-shelf-proportions.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('three');
const root = 'src/features/desk3d/scene/';
const noop = () => {};
const canvasTexture = () => ({ texture: new THREE.Texture(), ctx: new Proxy({}, {
  get: (_, key) => key.startsWith('create') ? () => ({ addColorStop() {} }) : key === 'measureText' ? () => ({ width: 20 }) : noop,
}) });
const registrations = new Map();
const scene = new THREE.Scene();
const runtime = { options: { dark: false }, core: {
  scene, camera: new THREE.PerspectiveCamera(), timers: [], UP: new THREE.Vector3(0, 1, 0),
  track: value => value, toon: color => new THREE.MeshToonMaterial({ color }), printMaterial: () => new THREE.MeshToonMaterial(),
  mesh: (geo, mat) => new THREE.Mesh(geo, mat), rbox: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  at: (obj, x, y, z = 0, rz = 0) => { obj.position.set(x, y, z); obj.rotation.z = rz; return obj; },
  rod: (a, b, radius, mat) => {
    const part = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b)), mat);
    part.position.copy(a).add(b).multiplyScalar(0.5);
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return part;
  },
  printed: (w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial()),
  register: (obj, handler) => registrations.set(obj, handler), noRaycast() {},
  roomLight: { night: 0 },
}, room: { FLOOR_Y: -7.4, WALL_Z: -4.9, neonLight: () => new THREE.PointLight() },
  lamp: { radial: () => new THREE.Texture() }, secrets: { discovered: new Set(), discover() {} },
};
const context = vm.createContext({ THREE, runtime, canvasTexture, DEFAULT_WOODS: {},
  gsap: { killTweensOf() {}, to() {}, isTweening: () => false }, sfx: {},
  performance: { now: () => 0 }, setTimeout: () => 0, clearTimeout() {},
});
const meshSource = fs.readFileSync('src/features/desk3d/sceneMeshes.js', 'utf8');
vm.runInContext(meshSource.slice(meshSource.indexOf('  const roundedRectShape ='), meshSource.indexOf('  // Places an object')) + '; runtime.core.roundedRectShape = roundedRectShape; runtime.core.phoneSlab = phoneSlab;', context);
function factory(name) {
  let source = fs.readFileSync(root + name + '.js', 'utf8');
  for (const match of source.matchAll(/\b(draw\w+)\b/g)) context[match[1]] = noop;
  source = source.replace(/^import .*;\n/gm, '').replace('export function', 'function');
  const factoryName = source.match(/function (\w+)\(runtime\)/)[1];
  // Armour is measured before the hover/audio coordinator wraps other shelf items.
  if (name === 'gauntlet') source = source.slice(0, source.indexOf('  const SHELF_SOUNDS =')) + '\nreturn { gauntlet, glovePart }; }';
  vm.runInContext(source + `\nruntime.${name} = ${factoryName}(runtime);`, context);
}
for (const name of ['shelf', 'shelfConsole', 'shelfBooks', 'robot', 'shelfCollectibles', 'handheld', 'gauntlet']) factory(name);
scene.updateMatrixWorld(true);
const shelf = runtime.shelf.shelf;
const all = runtime.shelf.shelfItems.map(({ obj, sound }, i) => ({ obj, label: `${sound} ${i + 1}` }));
all.push({ obj: runtime.gauntlet.gauntlet, label: 'gauntlet' });
all.push({ obj: runtime.shelfConsole.holder, label: 'controller holder' });
assert.equal(runtime.shelf.LEVELS.length, 4, 'three bays without a dedicated hardback section');
assert.equal(runtime.shelf.shelfItems.filter(item => item.sound === 'book').length, 9, 'five Maruto and four Dragon Bell volumes');
assert.equal(runtime.shelf.shelfItems.filter(item => item.sound === 'case').length, 10, 'nine spines and one display case');
assert.equal(runtime.shelf.shelfItems.filter(item => item.sound === 'console').length, 1, 'green gamebot is removed; PS5 remains');
const levels = runtime.shelf.LEVELS;
const localBounds = obj => {
  const box = new THREE.Box3();
  const point = new THREE.Vector3();
  obj.traverse(part => {
    if (!part.isMesh || part.isSprite || !part.visible) return;
    const attr = part.geometry?.attributes.position;
    if (!attr) return;
    for (let i = 0; i < attr.count; i++) box.expandByPoint(shelf.worldToLocal(part.localToWorld(point.fromBufferAttribute(attr, i))));
  });
  return box;
};
const measured = all.map(({ obj, label }) => {
  const box = localBounds(obj);
  const size = box.getSize(new THREE.Vector3()).multiplyScalar(20);
  const level = levels.findLastIndex(y => box.min.y >= y + 0.11 - 0.035);
  const ceiling = level < levels.length - 1 ? levels[level + 1] - 0.11 : Infinity;
  console.log(`${label}: ${size.toArray().map(n => n.toFixed(1)).join(' × ')} cm`);
  // The side panels' inner faces leave a 0.22 board on each side.
  assert.ok(box.min.x >= -1.305 && box.max.x <= 1.305, `${label} clears shelf side panels`);
  assert.ok(box.min.z >= -0.69 && box.max.z <= 0.75, `${label} rests within shelf depth`);
  assert.ok(level >= 0 && box.max.y < ceiling, `${label} clears the shelf above`);
  return { obj, label, box };
});
for (let i = 0; i < measured.length; i++) for (let j = i + 1; j < measured.length; j++) {
  const a = measured[i], b = measured[j];
  // The tower's aggregate bounds enclose both cradles and their supported controllers.
  if ((a.label === 'controller holder' && b.obj.userData.moves) ||
      (b.label === 'controller holder' && a.obj.userData.moves)) continue;
  const intersection = a.box.clone().intersect(b.box);
  if (intersection.isEmpty()) continue;
  const overlap = intersection.getSize(new THREE.Vector3());
  // Bounding boxes of tilted books may meet at their corners; flag substantial overlaps.
  assert.ok(Math.min(overlap.x, overlap.y, overlap.z) < 0.055, `${a.label} intersects ${b.label}`);
}
runtime.room.room = scene;
factory('swordRack');
const effectsSource = fs.readFileSync(root + 'swordEffects.js', 'utf8');
const curveStart = effectsSource.indexOf('  const sayaCurve =');
vm.runInContext(effectsSource.slice(curveStart, effectsSource.indexOf('  //', curveStart)) +
  '; runtime.swordEffects = { sayaCurve, hitAreaMat: new THREE.MeshBasicMaterial({ visible: false }) };', context);
factory('swords');
scene.updateMatrixWorld(true);
const swords = runtime.swordRack.katanaRack.children.filter(obj => obj.isGroup && obj.children.length === 2);
assert.equal(swords.length, 3, 'all three swords are audited');
// The rack now hangs beside the painting, clear to the left of the shelf display.
const gauntletBox = new THREE.Box3().setFromObject(runtime.gauntlet.gauntlet, true);
const SNAP_RISE = 0.88 * runtime.gauntlet.gauntlet.scale.y * shelf.scale.y;
gauntletBox.max.y += SNAP_RISE;
gauntletBox.expandByScalar(0.3);
for (const [index, sword] of swords.entries()) {
  const box = new THREE.Box3().setFromObject(sword, true);
  const size = box.getSize(new THREE.Vector3()).multiplyScalar(10);
  console.log(`sword ${index + 1}: ${size.toArray().map(n => n.toFixed(1)).join(' × ')} cm`);
  assert.ok(Math.abs(size.x - 90.4) < 1, 'sword is about 90 cm long');
  assert.ok(box.min.z > runtime.room.WALL_Z + 0.12, 'sword clears the back wall');
  assert.ok(!box.intersectsBox(gauntletBox), 'sword clears the gauntlet, even mid-snap');
}
assert.equal(runtime.swordRack.katanaRack.position.y, 9.6, 'rack hangs level with the painting');
console.log(`Shelf audit passed: ${all.length + swords.length} objects measured with final transforms and shelf clearances.`);
