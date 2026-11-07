// Run: node scripts/check-audio-entry.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const stored = new Map();
const gestureListeners = {};
let rejectResume = false;
let context;
let primed = 0;
let stopped = 0;
const parameter = () => ({
  value: 0,
  setValueAtTime(value, time) { assert.ok(Number.isFinite(value) && time >= 0); },
  exponentialRampToValueAtTime(value, time) { assert.ok(value > 0 && time >= 0); },
  linearRampToValueAtTime(value, time) { assert.ok(Number.isFinite(value) && time >= 0); },
});
const node = () => ({
  gain: parameter(), threshold: { value: 0 }, ratio: { value: 0 }, knee: { value: 0 }, attack: { value: 0 }, release: { value: 0 },
  connect() { return this; },
});
class AudioContext {
  constructor() { this.state = 'suspended'; this.sampleRate = 4; this.currentTime = 0; context = this; }
  createDynamicsCompressor() { return node(); }
  createGain() { return node(); }
  createBuffer() { return { getChannelData: () => new Float32Array(4) }; }
  createBufferSource() {
    return { connect() { return this; }, disconnect() {}, start() { primed++; }, stop() { stopped++; } };
  }
  createOscillator() { return { ...this.createBufferSource(), frequency: parameter() }; }
  createBiquadFilter() { return { ...node(), frequency: parameter(), Q: parameter() }; }
  async resume() {
    const previousPrimes = primed;
    await Promise.resolve();
    assert.ok(primed > previousPrimes, 'source must start in the gesture before awaiting resume');
    if (rejectResume) throw new Error('Audio blocked');
    this.state = 'running';
  }
}
const sandbox = vm.createContext({
  window: { AudioContext, matchMedia: () => ({ matches: false }), addEventListener(event, callback) { gestureListeners[event] = callback; } },
  document: { hidden: false },
  localStorage: { getItem: (key) => stored.get(key), setItem: (key, value) => stored.set(key, value) },
});
const source = fs.readFileSync(path.join(__dirname, '../src/shared/composables/useSfx.js'), 'utf8')
  .replace('import { ref } from "vue";', 'const ref = (value) => ({ value });')
  .replace(/export /g, '');
vm.runInContext(source, sandbox);
(async () => {
  const setSound = (enabled) => vm.runInContext(`setSoundEnabled(${enabled})`, sandbox);
  assert.equal(await setSound(false), true);
  assert.equal(stored.get('sfx-muted'), '1');
  assert.equal(context, undefined, 'silent entry must not create an audio context');
  assert.equal(await setSound(true), true);
  assert.equal(context.state, 'running', 'sound entry must await resume');
  assert.equal(stored.get('sfx-muted'), '0');
  context.state = 'interrupted';
  assert.equal(await setSound(true), true, 'Safari interrupted contexts must resume too');
  assert.equal(context.state, 'running');
  const previousStops = stopped;
  vm.runInContext('sfx.slurp({ delay: 0.25 })', sandbox);
  assert.ok(stopped - previousStops >= 6, 'slurp must schedule its airflow, flutter, bubbles and gulp');
  await setSound(false);
  context.state = 'suspended';
  rejectResume = true;
  assert.equal(await setSound(true), false);
  assert.equal(stored.get('sfx-muted'), '1', 'blocked audio must preserve the muted choice');
  rejectResume = false;
  vm.runInContext('ctx = null; muted.value = true;', sandbox);
  gestureListeners.click();
  assert.equal(vm.runInContext('ctx', sandbox), null, 'ordinary clicks must respect mute');
  vm.runInContext('muted.value = false;', sandbox);
  gestureListeners.click();
  await new Promise(setImmediate);
  assert.equal(vm.runInContext('ctx.state', sandbox), 'running', 'first click must unlock audio without an entry dialog');
  vm.runInContext('ctx = null;', sandbox);
  assert.equal(await vm.runInContext('initializeAudio()', sandbox), true, 'allowed autoplay should start without clicks');
  rejectResume = true;
  context.state = 'suspended';
  assert.equal(await vm.runInContext('initializeAudio()', sandbox), false, 'blocked autoplay must fail safely');
  rejectResume = false;
  gestureListeners.click();
  await new Promise(setImmediate);
  assert.equal(context.state, 'running', 'click fallback should recover blocked autoplay');
  await setSound(false);
  vm.runInContext('ctx = null;', sandbox);
  await vm.runInContext('initializeAudio()', sandbox);
  assert.equal(vm.runInContext('ctx', sandbox), null, 'autoplay must respect mute');
  // Opened ahead behind the loader: muted, nothing is made; otherwise the context exists but
  // isn't resumed, and the gesture coming in resumes that same context rather than making one
  vm.runInContext('prepareAudio()', sandbox);
  assert.equal(vm.runInContext('ctx', sandbox), null, 'preparing audio must respect mute');
  vm.runInContext('muted.value = false;', sandbox);
  const primesBefore = primed;
  vm.runInContext('prepareAudio()', sandbox);
  const prepared = vm.runInContext('ctx', sandbox);
  assert.equal(prepared.state, 'suspended', 'a prepared context waits for the gesture');
  assert.equal(primed, primesBefore, 'preparing starts nothing');
  vm.runInContext('prepareAudio()', sandbox);
  assert.equal(vm.runInContext('ctx', sandbox), prepared, 'preparing twice keeps one context');
  gestureListeners.keydown();
  await new Promise(setImmediate);
  assert.equal(vm.runInContext('ctx', sandbox), prepared, 'the gesture resumes the prepared context');
  assert.equal(prepared.state, 'running');
  console.log('Audio entry checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
