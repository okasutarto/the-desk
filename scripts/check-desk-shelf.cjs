// Run: node scripts/check-desk-shelf.cjs
const assert = require('node:assert/strict');
const vm = require('node:vm');
const THREE = require('three');
const source = require('./helpers/desk-source.cjs').readDeskSource();
const section = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
const captured = new Set();
let clicks = 0;
let moves = 0;
let hidden = 0;
const ctx = vm.createContext({
  performance, responsiveUntil: 0,
  THREE, shelfLook: 1.7, focus: { name: 'shelf' }, viewH: 12, userView: { zoom: 1 }, cam: { zoom: 2 }, container: { clientHeight: 600 },
  shelfBubble: { hide() { hidden++; } }, applyShot() { moves++; },
  finishScreenDrag: () => null, screenDrag: null, chairDrag: null, downAt: null, stickyDrag: null, noteDrag: null, lanyardDrag: null, raisedTap: null, hatDrag: null,
  pick: () => ({ entry: {} }), handleClick: () => clicks++, back() { throw new Error('drag navigated away'); },
  renderer: { domElement: { style: {}, setPointerCapture: (id) => captured.add(id), hasPointerCapture: (id) => captured.has(id), releasePointerCapture: (id) => captured.delete(id) } },
});
vm.runInContext(section('  let shelfDrag =', '  let stickyDrag =') +
  section('  const onPointerMove =', '    if (stickyDrag) {') + '  };' +
  section('  const onPointerDown =', '  const dragPlane =') +
  section('  const onPointerUp =', '  const onPointerLeave =') +
  section('  const onWheel =', '  renderer.domElement.addEventListener("wheel"'), ctx);
const run = (code) => vm.runInContext(code, ctx);
const event = (y, id = 1) => ({ pointerId: id, button: 0, clientX: 10, clientY: y, preventDefault() {} });
const call = (name, e) => { ctx.e = e; run(`${name}(e)`); };
call('onPointerDown', event(10));
call('onPointerUp', event(10));
assert.equal(clicks, 1, 'click still interacts with shelf items');
call('onPointerDown', event(10));
call('onPointerMove', event(210, 2));
assert.equal(ctx.shelfLook, 1.7, 'ignore another pointer');
call('onPointerMove', event(210));
assert.equal(ctx.shelfLook, 3.7, 'drag down raises camera with correct world-to-pixel scale');
call('onPointerUp', event(210));
assert.equal(clicks, 1, 'drag does not trigger console or trophy');
assert.equal(captured.size, 0);
call('onWheel', { deltaY: -100, deltaMode: 0, preventDefault() {} });
assert.ok(Math.abs(ctx.shelfLook - 4.05) < 1e-8, 'scroll up explores higher shelves');
call('onWheel', { deltaY: -10000, deltaMode: 1, preventDefault() {} });
assert.equal(ctx.shelfLook, 9, 'top collection remains bounded');
call('onWheel', { deltaY: 100, deltaMode: 2, preventDefault() {} });
assert.equal(ctx.shelfLook, 1.7, 'bottom collection remains bounded');
call('onPointerDown', event(10));
run('finishShelfDrag()');
assert.equal(captured.size, 0, 'blur, cancel and leaving release capture');
assert.ok(moves > 0 && hidden > 0, 'camera follows browsing and dismisses old bubbles');
console.log('Shelf scrolling, drag, click, bounds and cleanup checks passed.');
