// Run: node scripts/check-desk-furniture-proportions.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('three');
const read = name => fs.readFileSync(`src/features/desk3d/scene/${name}.js`, 'utf8')
  .replace(/^import .*;\n/gm, '').replace('export function', 'function');
const material = new THREE.MeshToonMaterial();
const scene = new THREE.Scene();
const runtime = { options: {}, core: {
  scene, toon: () => material, track: value => value,
  mesh: (geometry, mat) => new THREE.Mesh(geometry, mat),
  rbox: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  printed: (w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), material),
  printMaterial: () => material, register() {}, noRaycast() {},
  at: (object, x, y, z = 0) => { object.position.set(x, y, z); return object; },
  rod: (a, b, radius, mat) => {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b)), mat);
    rod.position.copy(a).add(b).multiplyScalar(0.5);
    return rod;
  },
} };
const context = vm.createContext({ THREE, runtime, gsap: {}, sfx: {},
  canvasTexture: () => ({ texture: new THREE.Texture(), ctx: { fillRect() {} } }),
  drawWoodTop() {}, drawLeatherGrain() {}, drawChairCrest() {},
  DEFAULT_WOODS: { desk: {} }, PALETTES: { light: { desk: '#fff' } },
  DEVICE_FINISHES: vm.runInNewContext(fs.readFileSync('src/features/desk3d/deviceFinishes.js', 'utf8').replace(/export /g, '') + '; DEVICE_FINISHES'),
});
const roomSource = read('room');
vm.runInContext(roomSource.slice(0, roomSource.indexOf('  // ---------- full-viewport room:')) +
  '\nreturn { FLOOR_Y, WALL_Z, SIDE_X, desk }; }\nvar room = createRoom(runtime);', context);
const { FLOOR_Y, WALL_Z, SIDE_X, desk } = context.room;
runtime.room = { FLOOR_Y, room: new THREE.Group() };
scene.add(runtime.room.room);
vm.runInContext(read('chair') + '\nvar result = createChair(runtime);', context);
const { chair, chairTop, SEAT_TOP } = context.result;
scene.updateMatrixWorld(true);
const deskBox = new THREE.Box3().setFromObject(desk);
const close = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-5, `${label}: ${a} vs ${b}`);
close(deskBox.max.y - FLOOR_Y, 7.4, '74 cm desk height');
close(deskBox.max.x - deskBox.min.x, 16, '160 cm desk width');
close(deskBox.max.y - deskBox.min.y, 0.35, '3.5 cm top thickness');
close(SEAT_TOP - FLOOR_Y, 5.2, '52 cm seat height shared with cat perch');
close(deskBox.max.y - SEAT_TOP, 2.2, '22 cm desk-to-seat clearance');
const chairBox = new THREE.Box3().setFromObject(chair, true);
close(chairBox.min.y, FLOOR_Y + 0.08, 'casters touch the rug');
assert.ok(chairBox.max.y - FLOOR_Y > 13.2 && chairBox.max.y - FLOOR_Y < 13.6, 'approximately 134 cm overall Titan Evo height');
const upholstery = chairTop.children[0];
const cushion = new THREE.Box3().setFromObject(upholstery.children[0], true);
assert.ok(cushion.max.x - cushion.min.x > 5, 'full-size cushion width');
// Official TITAN Evo Regular shell dimensions, before the display yaw/recline.
const seatCopy = upholstery.children[0].clone();
seatCopy.scale.multiplyScalar(upholstery.scale.x);
const seatSize = new THREE.Box3().setFromObject(seatCopy, true).getSize(new THREE.Vector3());
close(seatSize.x, 5.6, '56 cm seat including side bolsters');
close(seatSize.z, 4.9, '49 cm seat depth');
const backCopy = upholstery.children[3].clone();
backCopy.rotation.set(0, 0, 0);
backCopy.scale.multiplyScalar(upholstery.scale.x);
const backSize = new THREE.Box3().setFromObject(backCopy, true).getSize(new THREE.Vector3());
close(backSize.x, 5.3, '53 cm backrest width');
close(backSize.y, 8.5, '85 cm backrest length');
assert.ok(deskBox.min.x > SIDE_X + 0.12 + 0.4, 'desktop clears the left wall');
assert.ok(deskBox.min.z > WALL_Z + 0.12 && deskBox.min.z < WALL_Z + 0.12 + 0.15, 'desktop stands flush against the back wall');
// Parked in at the desk, facing it (with the hover's wiggle), the chair clears the top.
const { REST_Z, SPIN_Z } = context.result;
assert.ok(chair.position.z === REST_Z && REST_Z < SPIN_Z, 'chair parks closer in than where it spins');
for (const angle of [-0.1, 0, 0.1]) {
  chairTop.rotation.y = angle;
  scene.updateMatrixWorld(true);
  // One box around the whole chair includes the empty space above its seat. Check
  // individual pieces so that empty space cannot count as a tabletop collision.
  chairTop.traverse(piece => {
    if (piece.isMesh) assert.ok(!new THREE.Box3().setFromObject(piece, true).intersectsBox(deskBox), `parked chair piece ${piece.name || piece.geometry.type} clears tabletop`);
  });
}
// Rolled out, every spin angle and the lowest point of the click animation clear the desk.
chair.position.z = SPIN_Z;
for (const sink of [0, -0.35]) for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 36) {
  chairTop.position.y = sink;
  chairTop.rotation.y = angle;
  scene.updateMatrixWorld(true);
  assert.ok(!new THREE.Box3().setFromObject(chairTop, true).intersectsBox(deskBox), 'spinning chair clears tabletop');
}
chair.position.z = REST_Z;
chairTop.position.y = 0;
chairTop.rotation.y = 0;
scene.updateMatrixWorld(true);
console.log('Furniture dimensions, floor contact, cat perch, parked chair and 144 rolled-out spin/sink poses passed.');

// Build the actual shelving and monitor factories to verify their world dimensions.
context.canvasTexture = () => ({ texture: new THREE.Texture(), ctx: new Proxy({}, {
  get: (_, key) => key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {},
}) });
context.gsap = { killTweensOf() {}, to() {} };
context.drawBrushedMetal = () => {};
runtime.options = { dark: false, container: { clientWidth: 1440, clientHeight: 900 } };
runtime.room.WALL_Z = WALL_Z;
runtime.room.neonLight = () => new THREE.PointLight();
vm.runInContext(read('shelf') + '\nruntime.shelf = createShelf(runtime);', context);
const shelfBox = new THREE.Box3().setFromObject(runtime.shelf.shelf, true);
close(shelfBox.max.x - shelfBox.min.x, 6.1, '61 cm shelf width');
close(runtime.shelf.SHELF_H * runtime.shelf.shelf.scale.y, 13.2, '132 cm shelf carcass height');
assert.ok(shelfBox.max.y - FLOOR_Y < 13.3, 'shelf lips stay within one cm of the top');
assert.ok(shelfBox.min.x > deskBox.max.x + 0.8, 'shelf stands clear of the desk, leaving the plant in its back corner in view');
const workstation = read('workstation');
const riserHeight = Number(workstation.match(/const RISER_TOP = ([\d.]+)/)[1]);
vm.runInContext(`const RISER_TOP = ${riserHeight};\n` +
  workstation.slice(workstation.indexOf('  const monitor ='), workstation.indexOf('  // ---------- Mac mini:')) +
  '\nruntime.workstation = { monitor, SCREEN_Y };', context);
const monitor = runtime.workstation.monitor;
const monitorBox = new THREE.Box3().setFromObject(monitor, true);
close(monitorBox.max.x - monitorBox.min.x, 6.23, '62.3 cm monitor width');
assert.ok(monitorBox.min.y >= riserHeight - 0.02, 'monitor foot rests on its riser');
assert.ok(monitorBox.min.z > WALL_Z + 0.12, 'monitor clears the wall');
// Check the Mac mini's complete case plus foot against Apple's 12.7 × 12.7 × 5.0 cm (M4).
const meshSource = fs.readFileSync('src/features/desk3d/sceneMeshes.js', 'utf8');
vm.runInContext(meshSource.slice(meshSource.indexOf('  const roundedRectShape ='), meshSource.indexOf('  // A thin slab')) + '; runtime.core.roundedRectShape = roundedRectShape;', context);
const miniSection = workstation.slice(workstation.indexOf('  // ---------- Mac mini:'), workstation.indexOf('  // Clamped task light:'));
for (const match of miniSection.matchAll(/\b(draw\w+)\b/g)) context[match[1]] = () => {};
const miniHandlers = new Map();
runtime.core.register = (object, handler) => miniHandlers.set(object, handler);
context.toggleComputer = () => {};
context.gsap = {
  fromTo: (target, from, to) => { for (const axis of ['x', 'y', 'z']) if (axis in to) target[axis] = to[axis]; },
};
vm.runInContext(miniSection + '\nvar miniModel = { macMini, miniBody, miniFoot, frontJack, miniLed };', context);
const { macMini, miniBody, miniFoot } = context.miniModel;
const miniCopy = new THREE.Group();
for (const part of [miniBody, miniFoot]) miniCopy.add(part.clone());
miniCopy.scale.copy(macMini.scale);
const miniSize = new THREE.Box3().setFromObject(miniCopy, true).getSize(new THREE.Vector3());
close(miniSize.x, 1.27, '12.7 cm Mac mini width');
close(miniSize.z, 1.27, '12.7 cm Mac mini depth');
close(miniSize.y, 0.5, '5.0 cm Mac mini height including the foot');
assert.ok(Math.abs(macMini.scale.x - macMini.scale.y) < 1e-9 && Math.abs(macMini.scale.x - macMini.scale.z) < 1e-9, 'scaled uniformly, so round ports stay round');
const miniRestScale = macMini.scale.clone();
miniHandlers.get(macMini).onClick();
assert.ok(macMini.scale.distanceTo(miniRestScale) < 1e-9, 'power animation preserves the calibrated Mac mini dimensions');
const frontPorts = macMini.children.filter(part => part.isGroup && part.position.z > 0);
assert.equal(frontPorts.length, 2, 'two USB-C ports on the front');
for (const port of frontPorts) assert.ok(port.position.x < context.miniModel.frontJack.position.x, 'USB-C ports sit left of the headphone jack');
assert.ok(context.miniModel.miniLed.position.x > 0, 'front status LED is on the right');
close(context.miniModel.miniLed.position.y, context.miniModel.frontJack.position.y, 'LED and front ports align horizontally');
assert.ok(miniFoot.geometry.parameters.radiusTop > miniFoot.geometry.parameters.radiusBottom, 'foot tapers inward toward the tabletop');
console.log('Mac mini full case/foot dimensions and power animation scale recovery passed.');
const cameraSource = read('camera');
vm.runInContext(cameraSource.slice(0, cameraSource.indexOf('  const cam =')) +
  '\nreturn { SHOTS }; }\nvar shots = createCamera(runtime).SHOTS;', context);
const shot = context.shots.overview();
const dir = new THREE.Vector3(...shot.dir).normalize();
const right = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
const up = dir.clone().cross(right);
const target = new THREE.Vector3(...shot.target);
// The close overview keeps the desktop, the chair's back, the shelf's upper half (the gauntlet
// and the Switch on top), the monitor and the sword rack whole; the chair's base and the
// shelf's lower bays run off the frame's bottom edge.
chair.updateMatrixWorld(true);
const chairUpper = new THREE.Box3().setFromObject(upholstery.children[3], true);
const shelfUpper = shelfBox.clone();
shelfUpper.min.y = (shelfBox.min.y + shelfBox.max.y) / 2;
// Measure the current rack and swords; their old hard-coded bounds described a
// previous wall position and reported a framing failure after the rack moved.
runtime.room.WALL_Z = WALL_Z;
context.canvasTexture = () => ({ texture: new THREE.Texture(), ctx: new Proxy({}, { get: () => () => {} }) });
for (const name of ['swordRack', 'swords']) {
  const code = read(name);
  for (const match of code.matchAll(/\b(draw\w+)\b/g)) context[match[1]] = () => {};
}
vm.runInContext(read('swordRack') + '\nruntime.swordRack = createSwordRack(runtime);', context);
const effects = read('swordEffects');
const curveAt = effects.indexOf('  const sayaCurve =');
vm.runInContext(effects.slice(curveAt, effects.indexOf('  //', curveAt)) +
  '; runtime.swordEffects = { sayaCurve, hitAreaMat: new THREE.MeshBasicMaterial({ visible: false }) };', context);
vm.runInContext(read('swords') + '\nruntime.swords = createSwords(runtime);', context);
scene.updateMatrixWorld(true);
const swordBox = new THREE.Box3().setFromObject(runtime.swordRack.katanaRack, true);
for (const [w, h] of [[1440, 900], [1024, 768], [1920, 1080]]) {
  const viewH = Math.max(shot.fit[1], shot.fit[0] * h / w);
  for (const box of [deskBox, chairUpper, shelfUpper, monitorBox, swordBox]) {
    const points = [];
    if (box === swordBox) {
      // Project real vertices of the tilted swords, rather than empty corners of
      // their combined axis-aligned box. Invisible picking meshes are not artwork.
      runtime.swordRack.katanaRack.traverse(piece => {
        if (!piece.isMesh || !piece.visible || piece.material.visible === false) return;
        const positions = piece.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) points.push(piece.localToWorld(new THREE.Vector3().fromBufferAttribute(positions, i)));
      });
      assert.ok(points.length > 0, 'rack geometry was measured');
    } else {
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) points.push(new THREE.Vector3(x, y, z));
    }
    for (const point of points) {
      point.sub(target);
      assert.ok(Math.abs(point.dot(right)) < viewH * w / h / 2, 'overview fits furniture horizontally');
      assert.ok(Math.abs(point.dot(up)) < viewH / 2, `overview fits object ${[deskBox, chairUpper, shelfUpper, monitorBox, swordBox].indexOf(box)} at ${w}x${h}: ${point.dot(up)} vs ${viewH / 2}`);
    }
  }
}
console.log('Full-size shelving/display, wall clearance and overview framing at three desktop sizes passed.');
