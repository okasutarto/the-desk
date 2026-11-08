// The night's moonlit lift on the chair and headset: none by day, added by night, following the
// day/night blend, taking a finish picked at night as its new base, and wired into the theme.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('three');
const root = `${__dirname}/../src/features/desk3d/`;
const read = file => fs.readFileSync(root + file, 'utf8').replace(/^import .*;\n/gm, '').replace(/\bexport /g, '');
const { createNightLift, toonMaterialsUnder } = vm.runInNewContext(read('nightLift.js') + '; ({ createNightLift, toonMaterialsUnder })', { THREE });

const hex = mat => '#' + mat.color.getHexString();
const black = new THREE.MeshToonMaterial({ color: '#35312e' });
const white = new THREE.MeshToonMaterial({ color: '#e9e9e5' });
const lift = createNightLift();
lift.add([black, white], '#2a2e3a');

lift.update(0);
assert.equal(hex(black), '#35312e', 'day leaves the black finish as picked');
assert.equal(hex(white), '#e9e9e5', 'day leaves the white finish as picked');

lift.update(1);
const blackNight = black.color.clone();
const whiteNight = white.color.clone();
assert.ok(blackNight.r > new THREE.Color('#35312e').r * 1.5, 'night lifts the near-black finish clearly');
assert.ok(whiteNight.r - new THREE.Color('#e9e9e5').r < 0.05, 'night barely changes a white finish');
assert.ok(blackNight.b - new THREE.Color('#35312e').b > blackNight.r - new THREE.Color('#35312e').r, 'the lift is cool, as the moonlight is');

lift.update(0.5);
assert.ok(black.color.r > new THREE.Color('#35312e').r && black.color.r < blackNight.r, 'the lift follows the day/night blend');

// A finish picked by night is the new base, lifted on the next update; back by day it shows as picked
lift.update(1);
black.color.set('#e9e9e5');
lift.update(1);
assert.ok(Math.abs(black.color.r - whiteNight.r) < 1e-6, 'a repaint at night is taken as the new base');
lift.update(0);
assert.equal(hex(black), '#e9e9e5', 'the repainted finish shows as picked by day');

// Repeated updates at the same level don't drift
lift.update(1);
const once = black.color.clone();
lift.update(1);
lift.update(1);
assert.ok(black.color.equals(once), 'no drift from repeated updates');

// Only toon materials, each once, from every root
const group = new THREE.Group();
const shared = new THREE.MeshToonMaterial();
group.add(new THREE.Mesh(new THREE.BoxGeometry(), shared), new THREE.Mesh(new THREE.BoxGeometry(), shared));
group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.ShaderMaterial()));
const other = new THREE.Mesh(new THREE.BoxGeometry(), [new THREE.MeshToonMaterial(), new THREE.MeshBasicMaterial()]);
assert.equal(toonMaterialsUnder(group, other, undefined).length, 2, 'toon materials only, shared ones once');

const theme = fs.readFileSync(root + 'scene/theme.js', 'utf8');
assert.ok(theme.includes('toonMaterialsUnder(runtime.chair.chair, runtime.headset.assembly)'), 'the chair and headset are lifted');
assert.ok(theme.includes('nightLift.update(runtime.core.roomLight.night)'), 'the lift follows the lighting blend');

console.log('Night lift: none by day, cool lift by night, follows the blend, repaints and wiring passed.');
