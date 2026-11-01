// Run: node scripts/check-desk-window-landscape.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/features/desk3d/textures/windowView.js'), 'utf8');
let depth = 0;
let curves = 0;
const ctx = new Proxy({
  canvas: {},
  save() { depth++; },
  restore() { assert.ok(depth > 0); depth--; },
}, { get(target, key) {
  if (key in target) return target[key];
  return (...args) => {
    args.filter(value => typeof value === 'number').forEach(value => assert.ok(Number.isFinite(value), `finite ${key} coordinate`));
    if (key === 'bezierCurveTo') curves++;
    if (key.startsWith('create')) return { addColorStop() {} };
  };
} });
const { drawWindowView, windowSky } = vm.runInNewContext(source.replace(/export /g, '') + '; ({ drawWindowView, windowSky })', {
  document: { createElement: () => ({ getContext: () => ctx }) },
});
for (const [w, h] of [[512, 512], [768, 384], [384, 768]]) {
  for (const time of ['morning', 'day', 'evening', 'night']) {
    for (const rain of [0, 0.8]) {
      for (const t of [0, 2.5, 7, 14]) {
        drawWindowView(ctx, w, h, { time, rain, t });
        assert.equal(depth, 0, 'canvas state remains balanced across animated redraws');
      }
    }
  }
}
drawWindowView(ctx, 512, 512, { time: 'night', skyFrom: windowSky('morning'), skyBlend: 0.4, rain: 0.5 });
assert.ok(curves > 0, 'organic silhouettes use curved paths');
console.log('Window landscape: finite animated paths, rain, all moods, transitions and pane proportions passed.');
