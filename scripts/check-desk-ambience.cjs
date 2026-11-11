// Run: node scripts/check-desk-ambience.cjs
// The sounds outside the window: what plays when, that it's silent when it should be, that
// lightning lights the window, and that teardown leaves nothing running.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = path.join(__dirname, '../src/features/desk3d');
const strip = (file) => fs.readFileSync(path.join(dir, file), 'utf8')
  .replace(/^import .*;\n/gm, '').replace(/export (function|const) /g, '$1 ');

// ---------- the mix ----------
let bus = null;
const engine = vm.runInNewContext(`${strip('ambience.js')}\n; ({ ambienceMix, nextGap, createAmbience, lightningFlash, BED_PEAK, STORM_RAIN, UNDER_MUSIC })`, {
  audioBus: () => bus, Math, setTimeout,
});
const { ambienceMix, nextGap, createAmbience, lightningFlash, BED_PEAK, STORM_RAIN, UNDER_MUSIC } = engine;

const morning = ambienceMix({ part: 'morning' });
const night = ambienceMix({ part: 'night' });
assert.equal(morning.level, 1);
assert.ok(morning.rates.birds > 0 && morning.rates.crickets === 0, 'birds sing in the morning, crickets wait for dark');
assert.ok(night.rates.crickets > 0 && night.rates.birds === 0, 'crickets at night, no birds');
assert.ok(night.town > morning.town, 'the town is louder after dark');
for (const part of ['morning', 'day', 'evening', 'night']) {
  const mix = ambienceMix({ part, rain: 1 });
  assert.ok(mix.wind <= BED_PEAK.wind * 1.4 && mix.town <= BED_PEAK.town, `${part}: beds stay under their peaks`);
  assert.ok(mix.wind < 0.03 && mix.town < 0.03, `${part}: beds stay a background, like the rain (0.01)`);
}

const downpour = ambienceMix({ part: 'morning', rain: 0.8 });
assert.equal(downpour.rates.birds, 0, 'no birds in a downpour');
assert.ok(downpour.rates.drips > 0, 'drops on the glass in the rain');
assert.equal(ambienceMix({ part: 'day' }).rates.drips, 0, 'no drips when dry');

assert.equal(ambienceMix({ part: 'day', rain: 0.8 }).rates.thunder, 0, 'the settings\' plain rain has no thunder');
assert.equal(ambienceMix({ part: 'day', rain: 0.7 }).rates.thunder, 0, 'a real shower has no thunder');

// ---------- the real weather's rain, by its WMO code ----------
const { rainForCode } = vm.runInNewContext(`${strip('textures/weather.js')}\n; ({ rainForCode })`, {});
assert.ok(rainForCode(51) < rainForCode(55) && rainForCode(55) < rainForCode(65), 'drizzle is lighter than heavy rain');
assert.ok(rainForCode(61) < rainForCode(63) && rainForCode(63) < rainForCode(65), 'slight, moderate, heavy');
assert.ok(rainForCode(80) < rainForCode(82), 'showers by their strength');
for (const code of [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]) {
  assert.ok(rainForCode(code) > 0 && rainForCode(code) < STORM_RAIN, `code ${code}: rain, but never thunder`);
}
for (const code of [95, 96, 99]) assert.ok(rainForCode(code) >= STORM_RAIN, `code ${code}: a storm thunders`);
assert.ok(rainForCode(99) > rainForCode(95), 'hail makes the storm heavier');
for (const code of [0, 1, 2, 3, 45, 71, 75, 85]) assert.equal(rainForCode(code), 0, `code ${code}: dry outside the window`);
assert.ok(ambienceMix({ part: 'day', rain: 0.9 }).rates.thunder > 0, 'rain knocked up at the window brings a storm');
assert.ok(ambienceMix({ part: 'day', rain: 1 }).rates.thunder > 0, 'a real storm thunders');
assert.ok(ambienceMix({ part: 'day', rain: 1 }).rates.thunder > ambienceMix({ part: 'day', rain: 0.9 }).rates.thunder * 1.5, 'a storm with hail thunders more often');
assert.ok(STORM_RAIN > 0.8 && STORM_RAIN <= 0.9);

for (const quiet of [{ on: false }, { muted: true }, { hidden: true }]) {
  assert.equal(ambienceMix({ part: 'day', ...quiet }).level, 0, `silent when ${Object.keys(quiet)[0]}`);
}
assert.equal(ambienceMix({ part: 'day', music: true }).level, UNDER_MUSIC, 'steps back under the music');
assert.equal(ambienceMix({ part: 'day', windowOpen: true }).open, 1);
assert.equal(ambienceMix({ part: 'nonsense' }).wind, ambienceMix({ part: 'day' }).wind, 'an unknown part falls back to midday');

assert.ok(nextGap(60, 0) >= 1, 'events never bunch under a second apart');
assert.ok(Math.abs(nextGap(6, 1 - Math.exp(-1)) - 10) < 1e-9, 'on average one gap per rate');

// ---------- lightning ----------
assert.equal(lightningFlash(-Infinity), 0, 'no flash before any lightning');
assert.equal(lightningFlash(-5), 0);
assert.equal(lightningFlash(10), 1);
assert.ok(lightningFlash(100) < 0.3 && lightningFlash(180) > 0.5, 'a flash, a dip and a second flash');
assert.equal(lightningFlash(2000), 0, 'gone within two seconds');

// ---------- the engine, on a stand-in audio context ----------
const param = () => ({ value: 0, targets: [], setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime(v) { assert.ok(v > 0, 'exponential ramps never reach zero'); }, setTargetAtTime(v) { this.targets.push(v); this.value = v; } });
let started = 0;
let stopped = 0;
const sources = new Set();
const node = (extra = {}) => ({ connect(next) { return next; }, disconnect() {}, ...extra });
const ctx = {
  state: 'running', currentTime: 0, sampleRate: 100,
  createGain: () => node({ gain: param() }),
  createBiquadFilter: () => node({ frequency: param(), Q: param(), gain: param() }),
  createStereoPanner: () => node({ pan: param() }),
  createOscillator: () => source({ frequency: param() }),
  createBufferSource: () => source(),
  createBuffer: (_channels, length) => ({ getChannelData: () => new Float32Array(length) }),
};
function source(extra = {}) {
  const src = node({ start() { started++; }, stop() { if (sources.delete(src)) stopped++; src.onended?.(); }, ...extra });
  sources.add(src);
  return src;
}
bus = { ctx, out: node(), noiseBuffer: {} };

let flashes = 0;
const amb = createAmbience({ onLightning: () => flashes++ });
amb.update({ part: 'night', muted: true });
assert.equal(started, 0, 'nothing is built while there is nothing to hear');
amb.update({ part: 'night', rain: 1 });
assert.equal(started, 2, 'the two beds start once there is something to hear');
for (let t = 0; t < 600; t += 0.25) {
  ctx.currentTime = t;
  amb.update({ part: 'night', rain: 1 });
}
assert.ok(flashes > 0, 'ten minutes of storm bring lightning');
assert.ok(started > 50, 'and drips, cars and thunder along the way');
amb.hush();
amb.destroy();
assert.equal(sources.size, 0, 'teardown stops every source, the beds included');
const before = started;
amb.update({ part: 'morning' });
assert.equal(started, before, 'a torn-down ambience stays silent');

// ---------- wiring ----------
const read = (file) => fs.readFileSync(path.join(dir, file), 'utf8');
assert.match(read('scene/animation.js'), /runtime\.ambience\.update\(now\)/, 'the frame loop drives it');
assert.match(read('scene/lifecycle.js'), /runtime\.ambience\.destroy\(\)/, 'teardown stops it');
assert.match(read('scene/lifecycle.js'), /setAmbience: runtime\.ambience\.setAmbience/, 'settings can switch it');
assert.match(read('scene/ambience.js'), /removeEventListener\("visibilitychange"/, 'its listener is removed');
assert.match(read('composables/useDeskSettings.js'), /ambience: saved\.ambience !== false/, 'on unless switched off');

console.log('Ambience mix, storm, silence, lightning and teardown checks passed.');
