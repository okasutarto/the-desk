// Run: node scripts/check-desk-lightbar.cjs
const assert = require('node:assert/strict');
const vm = require('node:vm');
const THREE = require('three');
const source = require('./helpers/desk-source.cjs').readDeskSource();
const start = source.indexOf('  const lightbar =');
const end = source.indexOf('  // The monitor has the same cyan/pink', start);
const monitor = new THREE.Group();
const lampLight = new THREE.PointLight(0xffd394, 5);
const roomLight = { night: 0 };
const SCREEN_Y = Number(source.match(/const SCREEN_Y = ([\d.]+)/)[1]);
const MONITOR_SCALE = 62.3 / 42.4;
const context = vm.createContext({ THREE, monitor, lampLight, roomLight, SCREEN_Y, MONITOR_SCALE,
  brushed: { texture: new THREE.Texture() }, noRaycast() {},
  toon: (color) => new THREE.MeshToonMaterial({ color }),
  rbox: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  mesh: (geo, material) => new THREE.Mesh(geo, material),
});
vm.runInContext(source.slice(start, end), context);
const run = (code) => vm.runInContext(code, context);
const light = run('lightbarLight');
const lights = run('lightbarLights');
const total = () => lights.reduce((sum, l) => sum + l.intensity, 0);
const diffuser = run('lightbarDiffuserMat');
for (const power of [0, 0.5, 1, 0.5, 0]) {
  run(`lightbarState.power = ${power}; updateLightbar()`);
  assert.ok(Math.abs(total() - 5.4 * power) < 1e-9, 'three emitters share the bar\'s total output of 5.4');
  lights.forEach((l) => assert.equal(l.intensity, 1.8 * power));
  assert.ok(lights.every((l) => l === light || !l.castShadow), 'only the centre emitter casts shadows');
  assert.equal(diffuser.emissiveIntensity, 1.4 * power);
  assert.equal(light.castShadow, power > 0.05);
  assert.ok(light.color.equals(lampLight.color));
}
assert.ok(light.target.position.y < light.position.y && light.target.position.z > light.position.z, 'beam aims down and forward onto the desk');
assert.equal(light.shadow.mapSize.x, 512);
assert.equal(light.decay, 0, 'task beam retains useful brightness at desktop distance');
assert.equal(lights.length, 3);
assert.equal(light.position.x, 0, 'the shadow-casting emitter is the centre one');
assert.ok(lights[0].position.x < -0.8 && lights[2].position.x > 0.8 && Math.abs(lights[2].position.x - 5.0 / (62.3 / 42.4) / 2) < 1e-9 && lights[0].position.x === -lights[2].position.x, 'the emitters are spaced evenly along the bar, end to end');
lights.forEach((l) => {
  assert.equal(l.angle, light.angle);
  assert.equal(l.target.position.x, l.position.x, 'every emitter aims straight forward, the beams parallel');
});
// In the world: the monitor (and the bar on it) is scaled 1.469 and stands on the 8 cm riser
monitor.scale.setScalar(62.3 / 42.4);
monitor.position.set(-1, 0.8, -2.9);
monitor.updateMatrixWorld(true);
const from = light.getWorldPosition(new THREE.Vector3());
const aim = light.target.getWorldPosition(new THREE.Vector3()).sub(from).normalize();
const forward = Math.atan2(aim.z, -aim.y) * 180 / Math.PI;
assert.ok(from.y > 5.5 && from.y < 6.2, 'the emitter hangs about 59 cm over the desk');
assert.ok(forward > 20 && forward < 32, 'the beam tips forward onto the desk in front of the screen');
const reach = (deg) => {
  const tilt = (forward + deg) * Math.PI / 180;
  return from.z + from.y * Math.tan(tilt);
};
assert.ok(reach(-light.angle * 180 / Math.PI) < -2 && reach(-light.angle * 180 / Math.PI) > -3.2, "the cone's back edge reaches the monitor's foot, not the screen behind it");
assert.ok(reach(light.angle * 180 / Math.PI * (1 - light.penumbra / 2)) > 2.5 && reach(light.angle * 180 / Math.PI) < 6, 'its front reaches toward the desk front edge');
assert.ok(light.distance > Math.hypot(from.y, 4.2 - from.z, 9 - Math.abs(from.x)), 'the range outreaches the desk front corners');
monitor.scale.setScalar(1);
monitor.position.set(0, 0, 0);
monitor.updateMatrixWorld(true);
const shell = run('lightbarBody');
shell.geometry.computeBoundingBox();
const shellSize = shell.geometry.boundingBox.getSize(new THREE.Vector3());
assert.ok(shellSize.y < 0.12 && shellSize.z < 0.25, 'rectangular housing stays slim');
assert.ok(light.position.z > shellSize.z / 2, 'emitter clears the front of its housing');
assert.ok(light.position.y < -shellSize.y / 2, 'emitter clears the underside of its housing');
assert.ok(run('lightbarMetal').isMeshToonMaterial);
assert.ok(run('lightbarMetal.map').isTexture, 'graphite shell retains brushed texture');
monitor.updateMatrixWorld(true);
const bar = monitor.getObjectByName('monitor-lightbar');
const bounds = new THREE.Box3().setFromObject(bar);
// the body's top edge is 1.31 over the screen's centre
assert.ok(bounds.min.y > SCREEN_Y + 1.31 - 0.5, 'clamp fits around top bezel');
assert.ok(bounds.max.x < 2 && bounds.min.x > -2, 'bar stays inside screen width');
assert.ok(Math.abs((bounds.max.x - bounds.min.x) * MONITOR_SCALE * 10 - 50) < 0.1, 'bar is 50 cm end cap to end cap');
assert.ok(source.includes('setLightbar(isDark);\n    setLamp(isDark);\n    updateLightbar();'), 'the theme sets the lightbar with the lamp');
assert.ok(source.includes('updateLampGlow();\n    updateLightbar();'), 'lightbar follows the smooth day/night transition');
assert.ok(source.includes('register(lightbar,'), 'lightbar is registered as interactive prop');

// The room sets it: off for the day, on for the night
run('setLightbar(false)');
assert.equal(total(), 0, 'lightbar is off by day');
run('setLightbar(true)');
assert.equal(total(), 5.4, 'lightbar is on at night');

// Its button switches it at any hour, by day too
roomLight.night = 0;
run('setLightbar(false); toggleLightbar()');
assert.equal(total(), 5.4, 'clicking by day turns the lightbar on');
assert.equal(light.castShadow, true);
run('toggleLightbar()');
assert.equal(total(), 0, 'clicking again turns it off');
assert.equal(light.castShadow, false);

console.log('Lightbar geometry, toon texture, beam direction, night fade and lamp colour/power checks passed.');
