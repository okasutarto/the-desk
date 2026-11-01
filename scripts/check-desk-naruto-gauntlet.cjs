// Run: node scripts/check-desk-naruto-gauntlet.cjs
const assert = require('node:assert/strict');
const vm = require('node:vm');
const THREE = require('three');
const source = require('./helpers/desk-source.cjs').readDeskSource();
// Build the reference-inspired armour with real Three.js geometry, without a renderer.
const armour = vm.runInNewContext(
  source.slice(source.indexOf('  const glove = toon('), source.indexOf('  const stoneTint =')) + '; ({ glove, glovePart, forearm, fingers, thumb, stones, wristWings, wristLames, handPlate, fan, curvedPlate })', {
    THREE, gauntlet: new THREE.Group(), track: (value) => value,
    toon: (color) => new THREE.MeshToonMaterial({ color }),
    mesh: (geometry, material) => new THREE.Mesh(geometry, material),
    rbox: (w, h, d) => new THREE.BoxGeometry(w, h, d),
    at: (object, x, y, z = 0, angle = 0) => { object.position.set(x, y, z); object.rotation.z = angle; return object; },
    canvasTexture: () => ({ texture: new THREE.Texture(), ctx: { fillRect() {}, createRadialGradient: () => ({ addColorStop() {} }) } }),
    drawBrushedMetal() {}, drawSatinFinish() {}, noRaycast() {},
  });
assert.equal(armour.forearm.geometry.type, 'LatheGeometry', 'cuff has a flared circular profile');
assert.equal(armour.stones.length, 6, 'all six articulated stones remain present');
assert.ok(armour.glove.isMeshToonMaterial && armour.stones.every(gem => gem.material.isMeshToonMaterial), 'armour and gems use the desk’s stepped toon shading');
assert.ok([armour.glove.map.wrapS, armour.glove.map.wrapT].every(wrap => wrap === THREE.MirroredRepeatWrapping), 'non-tileable gold texture stays continuous across the hand’s integer UV boundaries');
const ramp = armour.glove.gradientMap;
assert.equal(ramp.magFilter, THREE.LinearFilter, 'broad gold plates blend across band boundaries');
assert.deepEqual([ramp.image.data[0], ramp.image.data[64], ramp.image.data[127]], [70, 160, 255], 'three toon tones remain distinct');
assert.ok(ramp.image.data.every((value, i, data) => !i || value >= data[i - 1] && value - data[i - 1] < 15), 'shadow transitions stay smooth and monotonic');
assert.deepEqual(Array.from(armour.stones, gem => gem.material.color.getHexString()),
  ['d58405', '00638d', 'a51217', '272239', 'dca40c', '007740'], 'reference order: amber, blue, red, dark violet; yellow centre and green thumb');
assert.ok(armour.stones.every(gem => gem.userData.halo.material.opacity < 0.1), 'idle halos preserve the stones’ darker facets');
assert.equal(armour.wristLames.length, 3, 'wrist armour consists of separate overlapping plates');
assert.ok(armour.stones[5].parent === armour.thumb, 'thumb stone follows its articulated thumb');
for (const finger of armour.fingers) {
  assert.equal(finger.userData.pieces.length, 3);
  finger.userData.pieces.forEach((piece) => { piece.rotation.x = -0.8; });
}
armour.glovePart.updateMatrixWorld(true);
const armourBounds = new THREE.Box3().setFromObject(armour.glovePart, true);
assert.ok(armourBounds.min.toArray().every(Number.isFinite) && armourBounds.max.toArray().every(Number.isFinite),
  'curved armour and engraved geometry stay finite while the fingers bend');
// Side wrist lames are symmetric and remain below the hand; the hand shell supplies the flare.
assert.equal(armour.wristWings.length, 2);
const wingBounds = armour.wristWings.map((wing) => new THREE.Box3().setFromObject(wing));
assert.ok(wingBounds[0].min.x < -0.26 && wingBounds[1].max.x > 0.26);
assert.ok(Math.abs(wingBounds[0].min.x + wingBounds[1].max.x) < 1e-6);
assert.ok(wingBounds.every(box => box.max.y < 0.88), 'wrist lames do not form floating wings beside the central stone');
const skirt = armour.handPlate.getPoints(24).filter(point => point.y < 0.96);
assert.ok(skirt.some(point => point.x > 0.28) && skirt.some(point => point.x < -0.28), 'continuous hand skirt flares below the palm');
assert.ok(skirt.every(point => Math.abs(point.x) < 0.3), 'hand skirt keeps a modest flare instead of broad wings');
assert.ok(armour.fan.getPoints().some(point => point.x === 0 && point.y > 0.93));
for (const wing of armour.wristWings) {
  assert.ok(Array.from(wing.geometry.attributes.normal.array).every(Number.isFinite));
}
// A wrapped plate must keep the analytic smooth normal across subdivided triangles.
const sample = new THREE.Shape();
sample.moveTo(-0.1, 0.1); sample.lineTo(0.1, 0.1); sample.lineTo(0.1, 0.3); sample.lineTo(-0.1, 0.3); sample.closePath();
const wrapped = armour.curvedPlate(sample, armour.glove, (x, y) => x * x + y * y);
const { position, normal } = wrapped.geometry.attributes;
let checked = 0;
for (let i = 0; i < position.count; i++) {
  const x = position.getX(i), y = position.getY(i);
  if (Math.abs(x) > 0.095 || y < 0.105 || y > 0.295) continue;
  if (Math.abs(position.getZ(i) - x * x - y * y - 0.014) > 1e-6) continue;
  const expected = new THREE.Vector3(-2 * x, -2 * y, 1).normalize();
  assert.ok(new THREE.Vector3().fromBufferAttribute(normal, i).distanceTo(expected) < 1e-5, 'front normals follow curvature, not individual triangles');
  checked++;
}
assert.ok(checked > 20, 'smooth normals checked on subdivided front faces');
let handler;
const glovePart = new THREE.Group();
const targets = [];
const sandbox = vm.createContext({
  snapping: false, glovePart, gauntlet: new THREE.Group(), stones: [], flare() {}, snapFingers() {},
  gsap: { to(target, values) { targets.push(target); target.y = values.y; } },
  register: (_, value) => { handler = value; }, sfx: { tick() {} },
});
vm.runInContext(source.slice(source.indexOf('  register(gauntlet, {'), source.indexOf('  const SHELF_SOUNDS =')), sandbox);
handler.onHover(true);
assert.ok(glovePart.position.y > 0.2 && glovePart.position.y < 0.4, 'glove rises a little above the fixed plinth');
handler.onHover(false);
assert.equal(glovePart.position.y, 0, 'leave settles on the stand');
sandbox.snapping = true;
glovePart.position.y = 0.8;
handler.onHover(false);
assert.equal(glovePart.position.y, 0.8, 'hover cannot interrupt the snap');
assert.ok(targets.every((target) => target === glovePart.position), 'plinth never floats with the glove');
const order = [];
const snapStart = source.slice(source.indexOf('  function snapFingers()'), source.indexOf('    // Hand poses:')) + '}';
vm.runInNewContext(snapStart + '; snapFingers()', {
  snapping: false, glovePart, discover() {}, setFocus() {},
  gsap: { killTweensOf(target) { assert.equal(target, glovePart.position); order.push('cancel hover'); }, timeline() { order.push('snap'); } },
});
assert.deepEqual(order, ['cancel hover', 'snap']);

const textures = require('./helpers/texture-source.cjs').readTexturesSource();
const manga = textures.slice(textures.indexOf('// ---------- Maruto manga collection'), textures.indexOf('// ---------- the handheld')).replace(/export /g, '');
const text = [];
const ctx = new Proxy({
  measureText: (value) => ({ width: value.length * 20 }),
  fillText: (value) => text.push(String(value)),
}, { get(target, key) { return key in target ? target[key] : (...values) => { values.forEach((v) => { if (typeof v === 'number') assert.ok(Number.isFinite(v), `finite ${key} coordinates`); }); }; } });
vm.runInNewContext(manga + `
  for (let vol = 1; vol <= 5; vol++) {
    drawMangaSpine(ctx, 150, 1020, { vol, color: '#f68026' });
    drawMangaCover(ctx, 700, 1000, { vol });
  }
`, { ctx });
assert.equal(text.filter((value) => value === 'MARUTO').length, 10, 'all spines and covers carry the new series');
assert.ok(!text.some((value) => value.includes('ONE PIECE')));
for (const volume of ['01', '02', '03', '04', '05']) assert.ok(text.includes(volume));
console.log('Gauntlet lift, leave, snap handoff and Maruto spine/cover rendering passed.');

// The Maruto run is a five-volume pile, in order, with no standing display book.
const mangaCode = source.slice(source.indexOf('  const MANGA ='), source.indexOf('  // A 3×3 puzzle cube'));
assert.ok(!mangaCode.includes('mangaDisplay'));
const volumes = vm.runInNewContext(mangaCode.slice(0, mangaCode.indexOf('  const stackTop')) + '; MANGA');
assert.deepEqual(Array.from(volumes, entry => entry[0]), [1, 2, 3, 4, 5, 1, 2, 3, 4]);
assert.equal(volumes.filter(entry => entry[2] === 'MARUTO').length, 5);
assert.equal(volumes.filter(entry => entry[2] === 'DRAGON BELL').length, 4);
text.length = 0;
vm.runInNewContext(manga + `
  drawMangaSpine(ctx, 150, 1020, { vol: 4, color: '#e98779', title: 'DRAGON BELL' });
  drawMangaCover(ctx, 700, 1000, { vol: 4, title: 'DRAGON BELL' });
`, { ctx });
assert.equal(text.filter(value => value === 'DRAGON BELL').length, 2);
assert.ok(!text.some(value => value.includes('NARUTO')));
console.log('Five Maruto and four Dragon Bell volumes stack in order.');
