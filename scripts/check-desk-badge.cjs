// Run: node scripts/check-desk-badge.cjs
const assert = require('node:assert/strict');
const vm = require('node:vm');
const THREE = require('three');
const source = require('./helpers/desk-source.cjs').readDeskSource();
const material = () => new THREE.MeshBasicMaterial();
const mesh = (geo, mat) => new THREE.Mesh(geo, mat);
const at = (obj, x, y, z) => { obj.position.set(x, y, z); return obj; };
const context = vm.createContext({
  drawGlassSheen() {},
  THREE, mesh, at, noRaycast() {}, toon: material, outlineMat: material, track: (x) => x,
  scene: new THREE.Scene(), WALL_Z: -4.58, WALL_LIFT: 0,
  rbox: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  phoneSlab: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  printed: (w, h) => mesh(new THREE.PlaneGeometry(w, h), material()),
  canvasTexture: () => ({ texture: new THREE.Texture(), ctx: { fillRect() {}, fillText() {} } }),
  gsap: { to() {}, fromTo() {} }, sfx: { badgeClick() {}, tick() {}, pop() {}, whoosh() {} }, discover() {},
});
const start = source.indexOf('  const BADGE_PIN =');
vm.runInContext(source.slice(start, source.indexOf('  register(badge, {', start)), context);
const update = vm.runInContext('() => updateLanyard(1 / 60)', context);
const state = vm.runInContext('() => ({ strands, rope, badge, badgePin, badgeCard, clip, strapPin, badgeFront, badgeBack, badgeFlipped })', context);
update();
const original = state().strands.map(({ tube }) => tube.geometry);
vm.runInContext('swing(1)', context);
for (let i = 0; i < 300; i++) update();
for (const [i, { tube }] of state().strands.entries()) {
  assert.equal(tube.geometry, original[i], 'reuse ribbon geometry while swinging');
  const { position, normal } = tube.geometry.attributes;
  assert.ok([...position.array, ...normal.array].every(Number.isFinite));
  const z = Array.from({ length: 9 }, (_, j) => position.getZ(j));
  assert.ok(Math.max(...z) - Math.min(...z) < 0.03, 'strap is a thin ribbon');
  const indices = tube.geometry.index.array;
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = Array.from(indices.slice(t, t + 3), (index) => new THREE.Vector3().fromBufferAttribute(position, index));
    const face = b.sub(a).cross(c.sub(a));
    const n = new THREE.Vector3().fromBufferAttribute(normal, indices[t]);
    assert.ok(face.dot(n) > 0, 'ribbon faces point outward');
  }
}
vm.runInContext('moveLanyard({ index: 0 }, { x: 100, y: 100 });', context);
update();
assert.equal(state().strapPin.position.x, state().badgePin.x);
assert.equal(state().rope[0].x, state().badgePin.x);
assert.ok(state().badgePin.x <= 23.4 && state().badgePin.x >= 14.1, 'pin stays within relocated board bounds');
vm.runInContext('flipBadge(true)', context);
assert.equal(state().badgeFlipped, true);
assert.ok(state().badgeFront.position.z > 0.0325 && state().badgeBack.position.z < -0.0325, 'print clears both holder faces');

// Badge links retain their exact hit regions at different texture resolutions.
const textures = require('./helpers/texture-source.cjs').readTexturesSource();
const badgeCode = textures.slice(textures.indexOf('export function drawBadge('), textures.indexOf('// ---------- boarding pass'));
const canvas = new Proxy({}, { get: () => () => {} });
const RESUME = 'https://example.test/cv.pdf';
const printContext = vm.createContext({ guilloche() {}, stockGrain() {}, DISPLAY: 'sans-serif', BODY: 'sans-serif', brutalBox() {}, drawPortrait() {}, ABOUT_NOTES: [{ id: 'resume', href: RESUME }] });
const draw = vm.runInContext(badgeCode.replace('export ', '') + '; drawBadge', printContext);
for (const [w, h] of [[480, 780], [532, 854], [960, 1560]]) {
  const links = draw(canvas, w, h, { back: true });
  assert.equal(links.length, 4, 'GitHub, LinkedIn, email and the resume');
  assert.equal(links[3].href, RESUME, 'the resume came from the About board');
  for (const link of links) {
    assert.ok(link.x >= 0 && link.y >= 0 && link.x + link.w <= w && link.y + link.h <= h);
  }
  assert.equal(links[0].x, 38 * w / 480);
  assert.equal(links[0].y, 306 * h / 780);
  draw(canvas, w, h);
}
console.log('Badge ribbon buffers, winding, drag, flip, holder and scaled link checks passed.');
