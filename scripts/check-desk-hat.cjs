// Run: node scripts/check-desk-hat.cjs
const assert = require('node:assert/strict');
const vm = require('node:vm');
const THREE = require('three');
const source = require('./helpers/desk-source.cjs').readDeskSource();
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const material = new THREE.MeshBasicMaterial();
const context = vm.createContext({
  THREE, UP: new THREE.Vector3(0, 1, 0), SIDE_X: -12, room: new THREE.Group(), straw: material,
  toon: () => material, track: (value) => value, register() {},
  canvasTexture: () => ({ texture: new THREE.Texture(), ctx: { fillRect() {} } }),
  drawGuitarTop() {},
  mesh: (geometry, mat) => new THREE.Mesh(geometry, mat),
  rbox: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  printed: (w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), material),
  rod: (a, b, radius, mat) => new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b)), mat),
  group: (...children) => new THREE.Group().add(...children),
  at: (object, x, y, z = 0, rz = 0) => {
    object.position.set(x, y, z);
    object.rotation.z = rz;
    return object;
  },
});
vm.runInContext(section('  const guitar =', '  // Sun (or moon) through the window') +
  section('  const strawHat =', '  const stopHat ='), context);
const hat = vm.runInContext('({ hung, hatPeg, guitarSwing, stretch, setStretch, constrainHat, HAT_SCALE })', context);
const guitarBounds = new THREE.Box3();
const hatBounds = new THREE.Box3();
let checked = 0;
for (const swing of [-0.16, 0, 0.16]) {
  hat.guitarSwing.rotation.z = swing;
  for (const stretch of [0.3, 0.75, 1, 2.6, 3.2]) {
    for (const angle of [-1.3, -0.6, -0.25, 0, 0.6, 1.3]) {
      for (const spin of [-0.8, 0, 0.8]) {
        for (const squash of [false, true]) {
          hat.stretch.s = stretch;
          hat.setStretch();
          hat.hatPeg.rotation.z = angle;
          hat.hung.rotation.y = spin;
          const strain = Math.max(0, stretch - 1);
          hat.hung.scale.set(hat.HAT_SCALE * (squash ? 1.4 : 1 - 0.1 * strain),
            hat.HAT_SCALE, hat.HAT_SCALE * (squash ? 0.6 : 1 + 0.18 * strain));
          hat.constrainHat();
          context.room.updateMatrixWorld(true);
          guitarBounds.setFromObject(hat.guitarSwing);
          hatBounds.setFromObject(hat.hung, true);
          assert.ok(hatBounds.min.z > guitarBounds.max.z + 0.08,
            `hat clears guitar: swing=${swing}, stretch=${stretch}, angle=${angle}, spin=${spin}, squash=${squash}`);
          if (angle <= -0.6 && !squash && stretch >= 0.75) {
            assert.equal(hat.hatPeg.rotation.z, angle, 'pulling away from the guitar stays free');
          }
          checked++;
        }
      }
    }
  }
}
assert.ok(source.indexOf('    constrainHat();') < source.indexOf('    updateToonBatch();'),
  'collision is resolved before copying animated transforms into the batch');
// At rest the brim hangs clear below the nail, and the cord passes the nail in front of the
// brim, so neither runs through it
{
  const rest = vm.runInContext('({ HAT_DROP, BRIM_R, CORD_OUT, HAT_OFF_WALL })', context);
  hat.stretch.s = 1;
  hat.setStretch();
  hat.hatPeg.rotation.z = 0;
  hat.hung.rotation.y = 0;
  assert.ok(rest.HAT_DROP - rest.BRIM_R * hat.HAT_SCALE >= 0.2, 'brim top clears the nail by at least 2 cm');
  assert.ok(rest.CORD_OUT > rest.HAT_OFF_WALL + 0.04 * hat.HAT_SCALE + 0.03 * hat.HAT_SCALE, 'cord crosses the nail in front of the brim');
}
console.log(`Hat/guitar clearance passed (${checked} drag and rebound poses).`);
