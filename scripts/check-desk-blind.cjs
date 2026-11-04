// Build the actual roller blind and paint its cloth in every print and colour: the repaint reuses
// the one texture, the roll follows the cloth, and every print tiles inside its repeat.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('three');
const root = `${__dirname}/../src/features/desk3d/`;
const read = file => fs.readFileSync(root + file, 'utf8').replace(/^import .*;\n/gm, '').replace(/\bexport /g, '');
const palette = read('blindFinishes.js');
const cloth = read('textures/blind.js');
const { BLIND_PATTERNS, BLIND_COLOURS, DEFAULT_BLIND, drawBlindCloth, blindInk, blindRollColour } = vm.runInNewContext(
  palette + cloth + '; ({ BLIND_PATTERNS, BLIND_COLOURS, DEFAULT_BLIND, drawBlindCloth, blindInk, blindRollColour })');

// A canvas that records what is painted on it, in repeat pixels (the cloth draws on a 256 repeat)
function recorder() {
  const ops = [];
  let path = [];
  const ctx = {
    ops,
    save() {}, restore() {}, setTransform() {}, scale() {}, translate() {}, rotate() {},
    beginPath() { path = []; }, moveTo(x, y) { path.push([x, y]); }, lineTo(x, y) { path.push([x, y]); },
    quadraticCurveTo(cx, cy, x, y) { path.push([x, y]); },
    arc(x, y, r) { path.push([x - r, y - r], [x + r, y + r]); },
    fill() { ops.push({ kind: 'fill', style: ctx.fillStyle, path }); },
    stroke() { ops.push({ kind: 'stroke', style: ctx.strokeStyle, path }); },
    fillRect(x, y, w, h) { ops.push({ kind: 'rect', style: ctx.fillStyle, x, y, w, h }); },
  };
  return ctx;
}
const painted = {};
for (const pattern of Object.keys(BLIND_PATTERNS)) {
  const c = recorder();
  drawBlindCloth(c, 256, { pattern, colour: '#a4aab3' });
  assert.deepEqual([c.ops[0].x, c.ops[0].y, c.ops[0].w, c.ops[0].h, c.ops[0].style], [0, 0, 256, 256, '#a4aab3'], `${pattern}: laid on the cloth colour`);
  painted[pattern] = c.ops.filter(op => op.style === blindInk('#a4aab3'));
  const weave = c.ops.filter(op => /^rgba\((40,44,54|232,236,242),/.test(op.style));
  if (pattern === 'plain') {
    assert.equal(painted[pattern].length, 0, 'plain cloth has no print');
    assert.ok(weave.length > 0, 'plain cloth shows its weave');
  } else {
    assert.ok(painted[pattern].length > 0, `${pattern}: the print is painted`);
    assert.equal(weave.length, 0, `${pattern}: no weave over the print`);
  }
  // Dots stay inside the repeat, so the cloth tiles without cut-off spots
  if (pattern === 'dots') for (const op of painted.dots) for (const [x, y] of op.path) assert.ok(x >= 0 && x <= 256 && y >= 0 && y <= 256, 'dots stay in the repeat');
  if (pattern === 'stripes' || pattern === 'pinstripe') for (const op of painted[pattern]) assert.ok(op.x >= 0 && op.x + op.w <= 256 && op.h === 256, `${pattern}: full-height bands inside the repeat`);
}
assert.notDeepEqual(JSON.stringify(painted.stripes), JSON.stringify(painted.pinstripe), 'each print differs');

// The print is a shade of the cloth: darker on a light one, lighter on a dark one
const lum = rgb => { const [r, g, b] = rgb.match(/\d+/g).map(Number); return 0.299 * r + 0.587 * g + 0.114 * b; };
const hexLum = hex => lum(`rgb(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5), 16)})`);
for (const { name, hex } of BLIND_COLOURS) {
  const ink = lum(blindInk(hex));
  assert.ok(Math.abs(ink - hexLum(hex)) > 18, `${name}: the print shows against the cloth`);
  assert.ok(lum(blindRollColour(hex)) < hexLum(hex), `${name}: the wound roll is a shade darker`);
}
assert.ok(lum(blindInk('#4a4e57')) > hexLum('#4a4e57'), 'charcoal gets a lighter print');
assert.ok(lum(blindInk('#e4d8c0')) < hexLum('#e4d8c0'), 'linen gets a darker print');

// The blind itself, built with the saved cloth, then repainted in place
const resources = new Set();
const track = value => { resources.add(value); return value; };
const draws = [];
const runtime = {
  options: { blind: { pattern: 'gingham', colour: '#c6714f' } },
  room: {
    GLASS: { x: 2.2, y: 2.6 }, WINDOW_DEPTH: 0.1, windowGroup: new THREE.Group(), brass: new THREE.MeshBasicMaterial(),
    shadowOnly: new THREE.MeshBasicMaterial(), windowShadow: () => new THREE.Object3D(),
  },
  core: {
    track, noRaycast() {}, hullGeometry: g => g, outlineMat: () => new THREE.MeshBasicMaterial(),
    toon: color => track(new THREE.MeshToonMaterial({ color })),
    rbox: (w, h, d) => track(new THREE.BoxGeometry(w, h, d)),
    mesh: (geometry, material) => new THREE.Mesh(track(geometry), material),
  },
};
const model = vm.runInNewContext(palette + read('scene/windowBlind.js') + '; createWindowBlind(runtime)', {
  runtime, THREE, gsap: {}, sfx: {}, performance,
  canvasTexture: () => ({ ctx: {}, texture: track(new THREE.Texture()) }),
  drawBlindCloth: (c, size, choice) => draws.push({ ...choice }),
  blindRollColour,
});
assert.deepEqual(draws.at(-1), runtime.options.blind, 'the saved cloth is painted at construction');
assert.equal(model.blindCloth.pattern, 'gingham');
const texture = model.blindFabric.map;
const rollMat = [...resources].find(r => r.isMeshToonMaterial && r.color.getHexString() === new THREE.Color(blindRollColour('#c6714f')).getHexString());
assert.ok(rollMat, 'the roll is wound in the saved cloth');
const count = resources.size;
let version = texture.version;
for (const pattern of Object.keys(BLIND_PATTERNS)) {
  for (const { hex } of BLIND_COLOURS) {
    model.setBlindCloth({ pattern, colour: hex });
    assert.deepEqual(draws.at(-1), { pattern, colour: hex });
    assert.ok(texture.version > version, 'the texture is re-uploaded');
    version = texture.version;
    assert.equal('#' + rollMat.color.getHexString(), '#' + new THREE.Color(blindRollColour(hex)).getHexString());
  }
}
assert.equal(model.blindFabric.map, texture, 'the same texture is repainted');
assert.equal(model.blindFabric.emissiveMap, texture, 'the daylight glow follows the print');
assert.equal(resources.size, count, 'repainting adds no GPU resources');
model.setBlindCloth({ colour: '#123456' });
assert.deepEqual(draws.at(-1), { pattern: 'leaves', colour: '#123456' }, 'a colour alone keeps the print');
model.setBlindCloth({ pattern: 'constructor', colour: 'red' });
assert.deepEqual(draws.at(-1), { pattern: 'leaves', colour: '#123456' }, 'invalid picks are ignored');
const fresh = vm.runInNewContext(palette + read('scene/windowBlind.js') + '; createWindowBlind(runtime)', {
  runtime: { ...runtime, options: {} }, THREE, gsap: {}, sfx: {}, performance,
  canvasTexture: () => ({ ctx: {}, texture: new THREE.Texture() }),
  drawBlindCloth: (c, size, choice) => draws.push({ ...choice }), blindRollColour,
});
assert.deepEqual({ ...fresh.blindCloth }, { ...DEFAULT_BLIND }, 'no saved cloth: the cool grey');
console.log(`Roller blind: ${Object.keys(BLIND_PATTERNS).length} prints × ${BLIND_COLOURS.length} colours repaint in place and tile.`);
