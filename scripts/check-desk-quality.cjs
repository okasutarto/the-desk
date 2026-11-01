// Run: node scripts/check-desk-quality.cjs
const assert = require('node:assert/strict');
const vm = require('node:vm');

const source = require('./helpers/desk-source.cjs').readDeskSource();
const sizing = source.slice(source.indexOf('  const refreshMs ='), source.indexOf('  // `?perf` in the address'));
let density = 2;
let postRatio = 0;
let postWidth = 0;
let postHeight = 0;
let disposed = 0;
const target = () => ({ samples: 4, dispose() { disposed++; } });
const composerTargets = [target(), target()];
const resolution = vm.createContext({
  renderer: { getPixelRatio: () => density },
  container: { clientWidth: 1200, clientHeight: 800 },
  composer: {
    renderTarget1: composerTargets[0], renderTarget2: composerTargets[1],
    setPixelRatio: (value) => { postRatio = value; }, setSize: (w, h) => { postWidth = w; postHeight = h; },
  },
});
vm.runInContext(sizing, resolution);
const resize = vm.runInContext('sizeComposer', resolution);
for (const dpr of [0.8, 1, 1.5, 2, 2.5, 3]) {
  density = dpr;
  resize();
  assert.equal(postRatio, dpr, 'postprocessing must match the canvas, including Retina and browser zoom');
  assert.equal(postWidth, 1200);
  assert.equal(postHeight, 800);
  // Retina frames skip multisampling; 1× screens keep it for clean edges
  composerTargets.forEach((t) => assert.equal(t.samples, dpr >= 2 ? 2 : 4, 'full MSAA below 2× density, the minimum the occlusion needs above'));
  // Exercise the actual frame-statistics update with sustained overload and hitches.
  const timingStart = source.indexOf('    if (lastTick) frameMs +=');
  const timingEnd = source.indexOf('    updateTicketHover(dt)', timingStart);
  const stats = vm.runInContext('(now) => { let lastTick = 1; ' + source.slice(timingStart, timingEnd) + ' }', resolution);
  for (let i = 0; i < 1200; i++) stats(1 + (i % 2 ? 50 : 250));
  assert.equal(vm.runInContext('postDensity()', resolution), dpr, 'slow frames must never reduce render density');
}
// 0.8–1.5 keep 4 samples; 2 drops both targets to 2 once; 2.5 and 3 change nothing
assert.equal(disposed, 2, 'targets are rebuilt only when their sample count changes');

// Execute the real scheduler, stopping immediately before scene updates.
const start = source.indexOf('  let lastTick = 0;');
const end = source.indexOf('    // Step size for the springs', start);
for (const hz of [60, 90, 120, 144, 165]) {
  for (const active of [false, "interaction", "lighting"]) {
    const light = () => ({ shadow: {} });
    const scheduler = vm.createContext({ document: { hidden: false },
      sun: light(), windowLight: light(), lampLight: light(), lightbarLight: light(), refreshMs: 1000 / 60,
      lightingBlending: active === "lighting", responsiveUntil: active === "interaction" ? Infinity : 0, gsap: { isTweening: () => false }, cam: {}, blind: {}, screenPower: {}, catIdleTl: null, catBusy: false, THREE: require('three'), updateShaft() {},
      benchmark: null, createToonBatch: () => () => {}, scene: {}, renderer: {}, track: (x) => x,
      mouseRunning: false, lampHopping: false, trophyCelebrating: false, lanyardDrag: null, hatDrag: null, noteDrag: null, shelfDrag: null, stickyDrag: null, chairDrag: null,
      perfReadout: null, requestAnimationFrame() {}, frame: null, accepted: [], idleMs: 1000 / 60 * 0.7, lowPower: false, probe: null });
    vm.runInContext(source.slice(start, end) + 'accepted.push(now); lastTick = now; }', scheduler);
    const tick = vm.runInContext('tick', scheduler);
    for (let i = 0; i < hz * 10; i++) tick(1 + i * 1000 / hz + Math.sin(i * 1.7) * 1.5);
    const frames = scheduler.accepted;
    const gaps = frames.slice(1).map((now, i) => now - frames[i]);
    if (active) {
      assert.equal(frames.length, hz * 10, 'interaction must not skip browser frames, including under jitter');
      assert.ok(Math.max(...gaps) <= 1000 / hz + 3.01, 'interaction must not introduce long/short frame pairs');
    } else {
      assert.ok(frames.length >= 480 && frames.length <= 730, 'idle retains a bounded render budget');
      if (hz === 60 || hz === 120) assert.ok(Math.max(...gaps) < 20, 'idle pacing stays even on 60/120Hz displays');
    }
    scheduler.document.hidden = true;
    const before = frames.length;
    tick(20000);
    assert.equal(frames.length, before, 'hidden tabs do not render');
    scheduler.document.hidden = false;
    tick(21000);
    assert.equal(frames.length, before + 1, 'visible tab renders immediately');
  }
}
const lights = Array.from({ length: 4 }, () => ({ castShadow: true, intensity: 1, shadow: { needsUpdate: false } }));
const shadows = vm.createContext({ shadowedNeons: lights, neonLights: lights.map((light) => ({ light, max: 1, level: () => 1 })) });
const shadowStart = source.indexOf('  let neonShadowTurn =');
vm.runInContext(source.slice(shadowStart, source.indexOf('  const deskNeons =', shadowStart)), shadows);
const refresh = vm.runInContext('updateNeonLights', shadows);
const updates = [0, 0, 0, 0];
for (let frame = 0; frame < 240; frame++) {
  refresh(frame * 1000 / 60);
  lights.forEach((light, i) => {
    if (light.shadow.needsUpdate) updates[i]++;
    light.shadow.needsUpdate = false;
    assert.equal(light.castShadow, true, 'budgeting must retain existing shadow maps');
  });
}
assert.ok(updates.every((count) => count >= 15 && count <= 21), 'each decorative shadow refreshes at most 5Hz');
updates.fill(0);
for (let frame = 0; frame < 240; frame++) {
  refresh(5000 + frame * 1000 / 120, true);
  lights.forEach((light, i) => {
    if (light.shadow.needsUpdate) updates[i]++;
    light.shadow.needsUpdate = false;
  });
}
assert.ok(updates.every((count) => count === 60), 'moving decorative shadows refresh every four frames, without the idle 200ms delay');

// Overlay meshes share one render while retaining their parent transforms and picking layer.
const THREE = require('three');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#fff');
const background = scene.background;
const camera = new THREE.OrthographicCamera();
const overlay = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ depthTest: false }));
scene.add(overlay, overlay.clone());
let overlayRenders = 0;
const renderContext = vm.createContext({ scene, camera, noRaycast() {},
  performance: { now: () => 10 }, perfParams: { has: () => true },
  renderer: { autoClear: true, info: { reset() {}, render: { calls: 2, triangles: 24 } }, render(root, cam) {
    assert.equal(root, scene);
    assert.equal(root.background, null, 'overlay pass must not clear the composed scene');
    assert.equal(cam.layers.mask, 2);
    overlayRenders++;
  } },
  composer: { render() { assert.ok(scene.children.every((o) => !o.visible)); } },
  useFrameDepth() {}, gpuQuery: null, gpuTimer: null, renderMs: 0, drawCalls: 0, triangles: 0,
});
const renderStart = source.indexOf('  const overlays =');
vm.runInContext(source.slice(renderStart, source.indexOf('  // Daylight enters', renderStart)), renderContext);
vm.runInContext('renderFrame()', renderContext);
assert.equal(overlayRenders, 1);
assert.equal(camera.layers.mask, 1);
assert.equal(scene.background, background);
assert.ok(scene.children.every((o) => o.visible && o.layers.isEnabled(0)));
console.log('Locked resolution: Retina/zoom, sustained overload, jitter-aware pacing, visibility and shadow budgets passed.');
