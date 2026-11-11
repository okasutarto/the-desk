// Run: node scripts/check-window-audio.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/shared/composables/useSfx.js'), 'utf8');
let peaks = [];
const record = (_time, options) => peaks.push(options.peak);
const sounds = vm.runInNewContext(source.slice(source.indexOf('const SOUNDS ='), source.indexOf('// Minimum gap')) + '; SOUNDS', {
  tone: record, noise: record, vary: (value) => value, Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
});
for (const name of ['chirp', 'sparkle', 'patter']) {
  peaks = [];
  sounds[name](0);
  const original = peaks;
  peaks = [];
  sounds[name](0, { volume: 0.3 });
  assert.equal(peaks.length, original.length);
  peaks.forEach((peak, i) => assert.ok(Math.abs(peak - original[i] * 0.3) < 1e-10, name + ' should play at 30% gain'));
}
const targets = [];
const node = () => ({ connect() { return this; }, start() {}, frequency: {}, gain: { setTargetAtTime: (value) => targets.push(value) } });
const ctx = { currentTime: 0, createBufferSource: node, createBiquadFilter: node, createGain: node };
const sandbox = vm.createContext({ ctx, out: {}, noiseBuffer: {}, muted: { value: false }, document: { hidden: false } });
const start = source.indexOf('let rainLoop =');
vm.runInContext(source.slice(start, source.indexOf('// The live context', start)).replace('export ', ''), sandbox);
vm.runInContext('setRainLevel(1)', sandbox);
assert.equal(targets.at(-1), 0.01, 'full rain gain reduced from 0.035 to 0.01');
vm.runInContext('muted.value = true; setRainLevel(1)', sandbox);
assert.equal(targets.at(-1), 0, 'mute still silences rain');
vm.runInContext('muted.value = false; document.hidden = true; setRainLevel(1)', sandbox);
assert.equal(targets.at(-1), 0, 'hidden page still silences rain');
vm.runInContext('document.hidden = false; rainWanted = 0; setRainLevel(0.8)', sandbox);
assert.equal(vm.runInContext('rainWanted', sandbox), 0.8, 'the wanted level is kept for when audio opens');
console.log('Quieter window effects, rain gain, mute and visibility checks passed.');
