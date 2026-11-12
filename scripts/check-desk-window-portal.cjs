// Run: node scripts/check-desk-window-portal.cjs
// The window's view as a portal: painted in a far and a near layer with landscape to spare
// round the pane, and looked up by screen position so the slanted overview doesn't squash it.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const viewSource = fs.readFileSync(path.join(__dirname, '../src/features/desk3d/textures/windowView.js'), 'utf8');
const roomSource = fs.readFileSync(path.join(__dirname, '../src/features/desk3d/scene/room.js'), 'utf8');

// A canvas that counts what's drawn on it and checks every coordinate is finite
function recorder() {
  const calls = [];
  let depth = 0;
  const ctx = new Proxy({ canvas: {} }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'save') return () => { depth++; calls.push(['save']); };
      if (key === 'restore') return () => { assert.ok(depth > 0, 'restore without save'); depth--; calls.push(['restore']); };
      return (...args) => {
        args.filter((v) => typeof v === 'number').forEach((v) => assert.ok(Number.isFinite(v), `finite ${String(key)}`));
        calls.push([key, ...args]);
        if (String(key).startsWith('create')) return { addColorStop() {} };
      };
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  return { ctx, calls, depth: () => depth };
}
const scratch = recorder();
const { drawWindowView } = vm.runInNewContext(viewSource.replace(/export /g, '') + '; ({ drawWindowView })', {
  document: { createElement: () => ({ getContext: () => scratch.ctx }) },
});
const drawn = (calls) => calls.filter(([k]) => ['fill', 'stroke', 'fillRect', 'drawImage'].includes(k)).length;

for (const time of ['morning', 'day', 'evening', 'night']) {
  for (const rain of [0, 0.8]) {
    const opts = { t: 9, time, rain, margin: [0.25, 0.2] };
    const all = recorder();
    const far = recorder();
    const near = recorder();
    drawWindowView(all.ctx, 1500, 1120, opts);
    drawWindowView(far.ctx, 1500, 1120, { ...opts, layer: 'back' });
    drawWindowView(near.ctx, 1500, 1120, { ...opts, layer: 'front', under: {} });
    [all, far, near].forEach((r) => assert.equal(r.depth(), 0, `${time}: canvas state balanced`));
    // the pane sits inside the margin: everything is shifted in by the margin's width
    const shift = far.calls.find(([k]) => k === 'translate');
    assert.deepEqual(shift.slice(1).map((v) => Math.round(v)), [250, 160], `${time}: painted ${0.25} and ${0.2} of the pane in from the canvas edge`);
    // the two layers split the painting between them rather than each doing it all
    assert.ok(drawn(far.calls) > 0 && drawn(near.calls) > 0, `${time}: both layers paint something`);
    assert.ok(drawn(far.calls) < drawn(all.calls) && drawn(near.calls) < drawn(all.calls), `${time}: neither layer paints the whole view`);
    // the near layer starts from a clear canvas, so the far one shows through it
    assert.equal(near.calls[1]?.[0], 'clearRect', `${time}: the near layer clears its canvas first`);
    assert.ok(!far.calls.some(([k]) => k === 'clearRect'), `${time}: the far layer is opaque`);
  }
}

// The room paints both layers into the one view, and the shader reads it by screen position
assert.match(roomSource, /layer: "back"/, 'the far layer is painted');
assert.match(roomSource, /layer: "front", under: viewFar\.canvas/, 'the near layer refracts the far one in its raindrops');
assert.match(roomSource, /replace\("#include <project_vertex>"/, 'the vertex shader works out the portal coordinates');
assert.match(roomSource, /replace\("#include <map_fragment>"/, 'the fragment shader lays the near layer over the far one');
assert.match(roomSource, /mvPosition\.xy - portalCentre/, 'looked up by where each point sits on screen, not on the glass');
assert.match(roomSource, /uPortalDepth: \{ value: new THREE\.Vector2\(([\d.]+), ([\d.]+)\) \}/, 'each layer has its own depth');
const [, farDepth, nearDepth] = roomSource.match(/uPortalDepth: \{ value: new THREE\.Vector2\(([\d.]+), ([\d.]+)\) \}/).map(Number);
const [, reachX, reachY] = roomSource.match(/uPortalReach: \{ value: new THREE\.Vector2\(([\d.]+), ([\d.]+)\) \}/).map(Number);
const [, marginX, marginY] = roomSource.match(/const VIEW_MARGIN = \[([\d.]+), ([\d.]+)\]/).map(Number);
assert.ok(farDepth > nearDepth, 'the far layer slides further behind the frame than the near one');
assert.ok(farDepth * reachX < marginX && farDepth * reachY < marginY, 'the furthest slide stays inside the painted margin');
assert.match(roomSource, /const windowView = portalView;/, 'the room still hands the view on as windowView');

console.log('Window portal: two layers with a margin, split painting, screen-space lookup and slides inside the margin passed.');
