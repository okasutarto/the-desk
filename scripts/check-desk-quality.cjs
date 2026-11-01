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
  aoPass: { configuration: {} },
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
  assert.equal(resolution.aoPass.configuration.halfRes, dpr > 1.5, 'AO density follows monitor/zoom changes');
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

// Run the actual quality controller: recovery works while idle as well as moving.
const qualitySource = source.slice(source.indexOf('  let judgeAfter ='), source.indexOf('  // The same judgement'));
function qualityController({ lowPower = false, benchmark = null, decorShed = false, gpuMs = null } = {}) {
  const context = vm.createContext({ lowPower, benchmark, decorShed, probe: null, gpuMs, renderMs: 0,
    aoPass: { enabled: false }, resets: 0, refreshAO(restart) { assert.equal(restart, true); context.resets++; } });
  vm.runInContext(qualitySource + '\njudgeAfter = 0;', context);
  let now = 0;
  return { context, run(fps, seconds, moving = false) {
    for (let i = 0; i < fps * seconds; i++) {
      now += 1000 / fps;
      context.now = now;
      context.interval = 1000 / fps;
      context.moving = moving;
      vm.runInContext('judgeQuality(now, interval, moving)', context);
    }
  } };
}
const recovery = qualityController();
recovery.run(39, 6);
assert.equal(recovery.context.aoPass.enabled, false, 'below 40 fps must not restore AO');
recovery.run(40, 11);
assert.equal(recovery.context.aoPass.enabled, true, 'stable 40 fps restores AO even while idle');
assert.equal(recovery.context.resets, 1, 'restored AO starts with a fresh frame');
recovery.run(20, 8, true);
assert.equal(recovery.context.aoPass.enabled, false, 'sustained slow motion can shed restored AO');
recovery.run(60, 16);
assert.equal(recovery.context.aoPass.enabled, true, 'quality can recover again after shedding');
const reverse = qualityController({ decorShed: true });
reverse.run(60, 5.1);
assert.equal(reverse.context.decorShed, false, 'decorative shadows return first');
assert.equal(reverse.context.aoPass.enabled, false, 'restore only one effect at a time');
reverse.run(60, 8);
assert.equal(reverse.context.aoPass.enabled, true);
for (const options of [{ lowPower: true }, { benchmark: 'no-ao' }]) {
  const fixed = qualityController(options);
  fixed.run(60, 20);
  assert.equal(fixed.context.aoPass.enabled, false, 'explicit low-power/benchmark modes retain their settings');
}
const unstable = qualityController();
unstable.run(60, 4);
unstable.run(10, 2);
assert.equal(unstable.context.aoPass.enabled, false, 'a short fast burst must not restore effects');
const minimum = qualityController();
minimum.context.aoPass.enabled = true;
minimum.run(30, 12, true);
assert.equal(minimum.context.aoPass.enabled, true, 'AO stays enabled at sustained 30 fps');
minimum.run(28, 4, true);
assert.equal(minimum.context.aoPass.enabled, false, 'sustained frames below 30 fps can shed AO');
const jittery = qualityController();
for (let i = 0; i < 420; i++) jittery.run(i % 14 ? 60 : 30, 1 / (i % 14 ? 60 : 30));
assert.equal(jittery.context.aoPass.enabled, true, 'a 58 fps room that drops the odd frame restores AO');
const busyGpu = qualityController({ gpuMs: 20 });
busyGpu.run(60, 12);
assert.equal(busyGpu.context.aoPass.enabled, false, 'AO stays off while the GPU has no room for it');
busyGpu.context.gpuMs = 15.5;
busyGpu.run(60, 6);
assert.equal(busyGpu.context.aoPass.enabled, true, 'AO returns once the GPU has room for its cost');

const probeSource = source.slice(source.indexOf('  const PROBE_WARMUP ='), source.indexOf('  let frame = null;'));
// Each round's cost, in order: [AO on cold, AO off, AO on warm]
function runProbe(costs) {
  let round = 0;
  const probeContext = vm.createContext({ benchmark: null, lowPower: false, Uint8Array, decorShed: false, aoCostMs: 4,
    aoPass: { enabled: true }, refreshAO() {}, performance: { now: () => costs[Math.min(round, costs.length - 1)] },
    renderer: { getContext: () => ({ readPixels() {} }) }, onEvent() {}, rounds: 0,
    canShed: () => probeContext.aoPass.enabled || !probeContext.decorShed,
    shedStep() { if (probeContext.aoPass.enabled) probeContext.aoPass.enabled = false; else probeContext.decorShed = true; } });
  vm.runInContext(probeSource, probeContext);
  while (vm.runInContext('probe', probeContext)) {
    vm.runInContext('stepProbe(0)', probeContext);
    round = vm.runInContext('probe ? probe.round : -1', probeContext);
    if (round >= 0) probeContext.rounds = round + 1;
  }
  return { ao: probeContext.aoPass.enabled, decorShed: probeContext.decorShed, rounds: probeContext.rounds, aoCost: vm.runInContext('aoCostMs', probeContext) };
}
for (const cost of [25, 1000 / 30]) {
  const fast = runProbe([cost]);
  assert.deepEqual([fast.ao, fast.decorShed, fast.rounds], [true, false, 1], 'startup preserves AO through 30 fps');
}
const cold = runProbe([36, 20.5, 23]);
assert.deepEqual([cold.ao, cold.decorShed, cold.rounds], [true, false, 3], 'a slow cold first round is retimed warm before AO is blamed');
assert.equal(cold.aoCost, 23 - 20.5, 'the probe times what AO adds');
const aoHeavy = runProbe([40, 22, 38]);
assert.deepEqual([aoHeavy.ao, aoHeavy.decorShed], [false, false], 'AO goes when the room keeps up only without it');
const allHeavy = runProbe([45, 36, 42]);
assert.deepEqual([allHeavy.ao, allHeavy.decorShed], [false, true], 'decorative shadows go too when the room is slow without AO');

// Shadow cameras are fixed in the room: a moving view alone keeps the still room's 12 Hz
// shadow pace, while anything else that moves (flags, fidgets, tweened props) redraws them every frame.
{
  const gsap = require('gsap').gsap;
  const cam = { zoom: 1 };
  const userView = { zoom: 1, x: 0, y: 0 };
  const tweenSource = source.slice(source.indexOf('  const isViewTarget ='), source.indexOf('  let aoFreshAt ='));
  const shadowStart = source.indexOf('    // Moving props need primary shadows');
  const shadowSource = source.slice(shadowStart, source.indexOf('    updateNeonLights(now, moving);', shadowStart));
  const light = () => ({ castShadow: true, intensity: 1, shadow: { needsUpdate: false } });
  const context = vm.createContext({ gsap, cam, userView, sun: light(), windowLight: light(), lampLight: light(), lightbarLight: light(), mainShadowAt: 0 });
  vm.runInContext(tweenSource, context);
  const shadowFrame = new vm.Script(`{${shadowSource}}`);
  function frames(state, count = 60) {
    let updates = 0;
    for (let i = 0; i < count; i++) {
      context.now = (context.now || 0) + 1000 / 60;
      Object.assign(context, { moving: true, viewMoved: false, propsActing: false, fidgeting: false }, state);
      context.sun.shadow.needsUpdate = false;
      shadowFrame.runInContext(context);
      if (context.sun.shadow.needsUpdate) updates++;
    }
    return updates;
  }
  const viewTween = gsap.to(userView, { zoom: 2, duration: 10 });
  const camTween = gsap.to(cam, { zoom: 2, duration: 10 });
  gsap.ticker.tick();
  const panned = frames({ viewMoved: true });
  assert.ok(panned >= 11 && panned <= 13, 'a pan or zoom alone keeps the 12 Hz shadow pace');
  assert.equal(frames({ viewMoved: false }), 60, 'input without a view change still redraws shadows each frame');
  assert.equal(frames({ viewMoved: true, propsActing: true }), 60, 'a dragged or busy prop redraws shadows while the view moves');
  assert.equal(frames({ viewMoved: true, fidgeting: true }), 60, 'the cat fidgeting redraws shadows while the view moves');
  const prop = { y: 0 };
  const propTween = gsap.to(prop, { y: 1, duration: 10 });
  gsap.delayedCall(10, () => {});
  gsap.ticker.tick();
  assert.equal(frames({ viewMoved: true }), 60, 'a tweened prop redraws shadows while the view moves');
  propTween.kill();
  gsap.ticker.tick();
  const delayed = frames({ viewMoved: true });
  assert.ok(delayed >= 11 && delayed <= 13, 'delayed calls and camera tweens are not prop motion');
  const still = frames({ moving: false });
  assert.ok(still >= 11 && still <= 13, 'a still room keeps its 12 Hz pace');
  viewTween.kill();
  camTween.kill();
  gsap.globalTimeline.clear();
}

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
console.log('Locked resolution: Retina/zoom, sustained overload, jitter-aware pacing, visibility, view-only shadow pace and shadow budgets passed.');
