// Run: node scripts/check-desk-sticky.cjs
const assert = require('node:assert/strict');
const vm = require('node:vm');
const THREE = require('three');
const source = require('./helpers/desk-source.cjs').readDeskSource();
const monitor = new THREE.Group();
monitor.position.set(-0.2, 0, -2.75);
const sticky = new THREE.Group();
sticky.position.set(2.36, 3.4, 0.1);
monitor.add(sticky);
const entry = { sticky, focus: 'monitor' };
const captured = new Set();
let clicks = 0;
let point = new THREE.Vector3(2.4, 3.5, 0.1);
const sandbox = vm.createContext({
  performance, responsiveUntil: 0,
  SCREEN_Y: 2.13, screen: {}, raycaster: { intersectObject: () => [] }, desktop: { active: () => null },
  THREE, monitor, screenDrag: null, chairDrag: null, shelfDrag: null, noteDrag: null, lanyardDrag: null, hatDrag: null, raisedTap: null, downAt: null, focus: { name: "monitor" },
  renderer: { domElement: { style: {}, setPointerCapture: (id) => captured.add(id), hasPointerCapture: (id) => captured.has(id), releasePointerCapture: (id) => captured.delete(id) } },
  pick: () => ({ entry }),
  rayFromPointer: () => ({ intersectPlane: (_plane, result) => result.copy(monitor.localToWorld(point.clone())) }),
  handleClick: () => clicks++,
});
const helpers = source.slice(source.indexOf('  let stickyDrag ='), source.indexOf('  const onPointerMove ='));
const move = source.slice(source.indexOf('  const onPointerMove ='), source.indexOf('    if (lanyardDrag) {', source.indexOf('  const onPointerMove ='))) + '  };';
const down = source.slice(source.indexOf('  const onPointerDown ='), source.indexOf('  const dragPlane ='));
const up = source.slice(source.indexOf('  const onPointerUp ='), source.indexOf('  const onPointerLeave'));
vm.runInContext(helpers + move + down + up, sandbox);
const event = (x, id = 1) => ({ pointerId: id, button: 0, clientX: x, clientY: 10, preventDefault() {} });
const call = (name, e) => { sandbox.e = e; return vm.runInContext(`${name}(e)`, sandbox); };
call('onPointerDown', event(10));
call('onPointerUp', event(10));
assert.equal(clicks, 1, 'a plain click still focuses the monitor');
call('onPointerDown', event(10));
point.set(0.5, 2, 0.1);
call('onPointerMove', event(30, 2));
assert.equal(sticky.position.x, 2.36, 'another pointer must not move the note');
call('onPointerMove', event(30));
assert.ok(Math.abs(sticky.position.x - 0.46) < 1e-8, 'preserve grab offset');
assert.ok(Math.abs(sticky.position.y - 1.9) < 1e-8);
point.set(100, -100, 0.1);
call('onPointerMove', event(40));
assert.equal(sticky.position.x, 2.3);
assert.ok(Math.abs(sticky.position.y - 0.8) < 1e-8);
call('onPointerUp', event(40));
assert.equal(clicks, 1, 'drag release must not navigate');
assert.equal(captured.size, 0, 'release pointer capture');
assert.equal(sticky.position.z, 0.1, 'note stays on monitor surface');
call('onPointerDown', event(10));
vm.runInContext('finishStickyDrag()', sandbox);
assert.equal(captured.size, 0, 'cancel and blur cleanup must release capture');
console.log('Post-it drag, offset, bounds, click and cleanup checks passed.');
