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
// the rustle is a soft swell, not a crackle: over 2 ms stretches at a browser's 48 kHz, its
// loud ones are well under 2.5× its quiet ones (the old one ticked in sharp flutters at about 4×)
{
  const stub = { sampleRate: 48000, createBuffer: (_c, length) => { const data = new Float32Array(length); return { data, getChannelData: () => data }; } };
  const src = fs.readFileSync(path.join(dir, 'ambience.js'), 'utf8');
  const body = src.slice(src.indexOf('  function rustleBuffer(ctx) {'), src.indexOf('  function loop('));
  const { data } = vm.runInNewContext(`${body}; rustleBuffer(ctx)`, { ctx: stub, Math });
  const windows = Array.from({ length: Math.floor((data.length - 2048) / 96) }, (_, k) => {
    let sum = 0;
    for (let i = k * 96; i < k * 96 + 96; i++) sum += data[i] * data[i];
    return Math.sqrt(sum / 96);
  }).sort((a, b) => a - b);
  const [quiet, loud] = [windows[Math.floor(windows.length * 0.05)], windows[Math.floor(windows.length * 0.95)]];
  assert.ok(loud / quiet < 2.5, `the leaves swell softly rather than crackle (${(loud / quiet).toFixed(2)}×)`);
}

const engine = vm.runInNewContext(`${strip('ambience.js')}\n; ({ ambienceMix, nextGap, createAmbience, lightningFlash, gustInTrees, BED_PEAK, STORM_RAIN, UNDER_MUSIC, LEAVES_STILL, WIND_STILL, LAP_PACE })`, {
  audioBus: () => bus, Math, setTimeout,
});
const { ambienceMix, nextGap, createAmbience, lightningFlash, gustInTrees, BED_PEAK, STORM_RAIN, UNDER_MUSIC, LEAVES_STILL, WIND_STILL, LAP_PACE } = engine;

const morning = ambienceMix({ part: 'morning' });
const night = ambienceMix({ part: 'night' });
assert.equal(morning.level, 1);
assert.ok(morning.rates.birds > 0 && morning.rates.crickets === 0, 'birds sing in the morning, crickets wait for dark');
assert.ok(night.rates.crickets > 0 && night.rates.birds === 0, 'crickets at night, no birds');
// only what the window shows: a lake and trees, no town or road
assert.equal(morning.town, undefined, 'no town outside');
assert.ok(Object.values({ morning, night }).every((mix) => !('cars' in mix.rates)), 'no cars go by');
// the wind only blows in through the open window, softly, rising with the gusts
assert.equal(ambienceMix({ part: 'day', gust: 1 }).wind, 0, 'no wind with the window shut');
const breath = ambienceMix({ part: 'day', windowOpen: true, gust: 0 }).wind;
const blast = ambienceMix({ part: 'day', windowOpen: true, gust: 1 }).wind;
assert.ok(breath > 0 && Math.abs(breath / blast - WIND_STILL) < 1e-9, 'a breath between gusts, more as one blows in');
const OPEN_BOOST = 2.2;
for (const part of ['morning', 'day', 'evening', 'night']) {
  const storm = ambienceMix({ part, windowOpen: true, gust: 1, rain: 1 });
  assert.ok(storm.wind * OPEN_BOOST < 0.01, `${part}: even a storm's gust stays under the rain's hiss`);
  assert.ok(ambienceMix({ part, windowOpen: true, gust: 1 }).wind < ambienceMix({ part, windowOpen: true }).lake, `${part}: and softer than the lake`);
  assert.ok(storm.leaves * OPEN_BOOST < 0.01, `${part}: the leaves in a storm's gust, window open, stay under the rain's hiss`);
  assert.ok(ambienceMix({ part, windowOpen: true, gust: 1 }).leaves < ambienceMix({ part, windowOpen: true }).lake, `${part}: and under the lake`);
}
assert.match(fs.readFileSync(path.join(dir, 'ambience.js'), 'utf8'), /g\.outside\.gain\.setTargetAtTime\(mix\.open \? 2\.2 : 1/, 'the open window boost the wind is kept under');
assert.ok(morning.lake > 0 && night.lake > 0, 'the lake laps day and night');
assert.ok(ambienceMix({ part: 'day', rain: 1 }).lake < ambienceMix({ part: 'day' }).lake, 'the rain drowns the lapping');
const still = ambienceMix({ part: 'day', gust: 0 }).leaves;
const swept = ambienceMix({ part: 'day', gust: 1 }).leaves;
assert.ok(still > 0 && Math.abs(still / swept - LEAVES_STILL) < 1e-9, 'the leaves rustle softly between gusts, fully as one sweeps through');
assert.ok(ambienceMix({ part: 'day', gust: 1 }).leaves > ambienceMix({ part: 'night', gust: 1 }).leaves, 'the trees are stiller at night');
for (const part of ['morning', 'day', 'evening', 'night']) {
  const mix = ambienceMix({ part, rain: 1, gust: 1 });
  assert.ok(mix.lake <= BED_PEAK.lake && mix.leaves <= BED_PEAK.leaves * 1.3, `${part}: beds stay under their peaks`);
  assert.ok(mix.lake < 0.03 && mix.leaves < 0.03, `${part}: beds stay a background, like the rain (0.01)`);
}

// ---------- the gust in the trees, on the view's clock ----------
const gusts = Array.from({ length: 700 }, (_, i) => gustInTrees(i / 100, 7));
assert.ok(gusts.every((g) => g >= 0 && g <= 1), 'the gust stays 0–1');
assert.ok(Math.max(...gusts) > 0.99, 'it peaks as the front crosses the trees');
assert.equal(gustInTrees(0, 7), 0, 'nothing while the front is still off the view');
assert.ok(gustInTrees(3.5, 7) > 0.9, 'strongest halfway across');
assert.equal(gustInTrees(3.5, 7), gustInTrees(10.5, 7), 'one every seven seconds');
assert.match(fs.readFileSync(path.join(dir, 'textures/windowView.js'), 'utf8'), /export const GUST_EVERY = 7;/, 'on the same clock as the painted gust');

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
assert.equal(ambienceMix({ part: 'nonsense' }).lake, ambienceMix({ part: 'day' }).lake, 'an unknown part falls back to midday');

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
const oscillators = [];
let started = 0;
let stopped = 0;
const sources = new Set();
const node = (extra = {}) => ({ connect(next) { return next; }, disconnect() {}, ...extra });
const ctx = {
  state: 'running', currentTime: 0, sampleRate: 100,
  createGain: () => node({ gain: param() }),
  createBiquadFilter: () => node({ frequency: param(), Q: param(), gain: param() }),
  createStereoPanner: () => node({ pan: param() }),
  createOscillator: () => { const osc = source({ frequency: param() }); oscillators.push(osc); return osc; },
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
assert.equal(started, 4, 'the lake (and its waves), the leaves and the wind start once there is something to hear');
for (let t = 0; t < 600; t += 0.25) {
  ctx.currentTime = t;
  amb.update({ part: 'night', rain: 1, gust: gustInTrees(t, 7), windowOpen: t > 300 });
}
assert.ok(flashes > 0, 'ten minutes of storm bring lightning');
// the lake's waves are the first oscillator built: slow laps, one every five to eight seconds
const waves = oscillators[0].frequency;
assert.ok(LAP_PACE[0] >= 1 / 8 && LAP_PACE[1] <= 1 / 5, 'a calm lake laps every five to eight seconds');
assert.ok(waves.targets.length > 50, 'its pace drifts through the ten minutes');
assert.ok([waves.value, ...waves.targets].every((hz) => hz >= LAP_PACE[0] && hz <= LAP_PACE[1]), 'and never quickens past a lap every five seconds');
assert.ok(started > 50, 'and drips and thunder along the way');
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
assert.match(read('scene/ambience.js'), /gust: gustInTrees\(runtime\.room\.outside\.t, GUST_EVERY\)/, 'the leaves follow the view\'s own gusts');
assert.match(read('composables/useDeskSettings.js'), /ambience: saved\.ambience !== false/, 'on unless switched off');
// the window stays as it's left, and blows in on the blind while it's open
assert.doesNotMatch(read('scene/weather.js'), /onLeave[\s\S]{0,120}toggleWindow/, 'leaving the window\'s close-up no longer shuts it');
assert.match(read('scene/animation.js'), /runtime\.windowBlind\.blowIn\(dt\)/, 'the breeze is stepped each frame');
assert.match(read('scene/windowBlind.js'), /const open = 1 - \(outside\.glass \?\? 1\)/, 'only through the open window');
assert.match(read('scene/windowBlind.js'), /gustInTrees\(outside\.t - BREEZE_LAG, GUST_EVERY\)/, 'on the view\'s own gusts');

console.log('Ambience mix, storm, silence, lightning and teardown checks passed.');
