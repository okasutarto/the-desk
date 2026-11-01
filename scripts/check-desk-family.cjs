// Run: node scripts/check-desk-family.cjs
const assert = require('node:assert/strict');
const vm = require('node:vm');
const THREE = require('three');
const source = require('./helpers/desk-source.cjs').readDeskSource();
let entry;
const scene = new THREE.Group();
const family = vm.runInNewContext(source.slice(source.indexOf('  // Family keepsake:'), source.indexOf('  // ---------- potted plant')) + '; ({ familyFrame, familyPhoto })', {
  THREE, scene,
  at: (obj, x, y, z = 0, rz = 0) => { obj.position.set(x, y, z); obj.rotation.z = rz; return obj; },
  printed: (w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial()),
  drawFamilyPortrait() {}, windowWood: { texture: new THREE.Texture() },
  toon: (color) => new THREE.MeshToonMaterial({ color }), track: (value) => value,
  roundedRectShape: (w, h) => new THREE.Shape([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => new THREE.Vector2(x * w / 2, y * h / 2))),
  rbox: (w,h,d) => new THREE.BoxGeometry(w,h,d), mesh: (geometry, material) => new THREE.Mesh(geometry, material),
  gsap: { to(target, values) { for (const axis of ['x','y','z']) if (axis in values) target[axis] = values[axis]; } }, register: (object, handlers) => { entry = { object, ...handlers }; },
});
const { width, height } = family.familyPhoto.geometry.parameters;
assert.ok(Math.abs(width - 1.015) < 0.005 && Math.abs(height - 1.735) < 0.005, 'portrait fills the lip\'s window, a hair under its edge');
assert.equal(entry.focus, 'family', 'photo is registered for camera zoom');
scene.updateMatrixWorld(true);
const bounds = new THREE.Box3().setFromObject(family.familyFrame);
assert.ok(bounds.min.x > -6.4 && bounds.max.x < -5.1, 'frame fits its own space in front of the riser');
assert.ok(bounds.min.y >= 0 && bounds.min.y < 0.01 && bounds.max.y < 1.8,
  'free-standing frame rests on the tabletop without sinking or floating');
const shotStart = source.indexOf('    family: () => {');
const shot = vm.runInNewContext('({' + source.slice(shotStart, source.indexOf('    // Face-on to the phone', shotStart)) + '}).family()', {
  familyFrame: family.familyFrame, screenPos: new THREE.Vector3(), screenNormal: new THREE.Vector3(),
});
assert.ok(new THREE.Vector3(...shot.target).distanceTo(family.familyFrame.localToWorld(new THREE.Vector3(0,1.06,0.1))) < 1e-8);
assert.ok(shot.fit[0] >= 1.24 && shot.fit[1] >= 1.95, 'close-up fits entire frame');
// Rock on its bottom edge and return exactly, without inflating the portrait.
entry.onHover(true);
assert.ok(family.familyFrame.rotation.x > -0.03);
entry.onHover(false);
assert.equal(family.familyFrame.rotation.x, -0.03);
assert.equal(family.familyFrame.rotation.y, 0.08);
assert.deepEqual(family.familyFrame.scale.toArray(), [0.8, 0.8, 0.8]);
console.log('Family frame, aspect ratio, placement, click registration and camera checks passed.');
