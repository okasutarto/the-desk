// Synthesized sound effects (WebAudio, no audio files).
// Try autoplay when allowed; otherwise the first user gesture unlocks the context.
import { ref } from "vue";

const STORAGE_KEY = "sfx-muted";
const readMuted = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const muted = ref(readMuted());
let ctx = null;
let out = null;
// The master bus. `out` is briefly pointed at the hover bus while a hover cue is built.
let master = null;
let noiseBuffer = null;
let hushDepth = 0;
// True while a gesture's resume() is pending: sounds scheduled now play once it lands, so the
// very click that unlocks audio is heard too
let resuming = false;
const lastPlayed = {};

function createContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  ctx = new AudioCtx();
  // The sounds are synthesized quietly, so they go through a compressor that evens them out, a
  // makeup gain that brings them up to a normal listening level, and a limiter on the end so
  // overlapping hits can't clip
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  const makeup = ctx.createGain();
  makeup.gain.value = 2.6;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.1;
  master = out = ctx.createGain();
  out.gain.value = 1;
  out.connect(comp).connect(makeup).connect(limiter).connect(ctx.destination);
  // One second of white noise, reused by every noisy sound
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  void loadSamples();
  return ctx;
}

// A few recorded sounds (Kenney RPG Audio, CC0) layered under the synth, which can't fake the
// grain of real steel, paper or wood. Until they've loaded (or if they fail) the synth plays alone.
const SAMPLE_FILES = {
  draw: ["blade-draw-1", "blade-draw-2"],
  slice: ["blade-slice-1", "blade-slice-2"],
  pages: ["page-flip-1", "page-flip-2", "page-flip-3"],
  cover: ["cover-close-1"],
  creak: ["creak-1", "creak-2"],
  // Kenney Impact Sounds (CC0), one set per object so a recording never lands on the wrong thing
  paw: ["paw-land-1", "paw-land-2", "paw-land-3"],
  mug: ["mug-down-1", "mug-down-2"],
  dumbbell: ["dumbbell-1", "dumbbell-2", "dumbbell-3"],
  rack: ["wood-rack-1", "wood-rack-2"],
  plastic: ["plastic-click-1", "plastic-click-2", "plastic-click-3"],
  tin: ["tin-hit-1", "tin-hit-2", "tin-hit-3"],
  book: ["book-place-1", "book-place-2", "book-place-3"],
  bell: ["clock-bell-1"],
  // OpenGameArt (CC0): qubodup's drink set
  swallow: ["swallow-1"],
};
const samples = {};
let samplesLoading = null;

function loadSamples() {
  if (samplesLoading) return samplesLoading;
  const loadOne = async (file) => {
    const res = await fetch(`${process.env.BASE_URL}sfx/${file}.m4a`);
    if (!res.ok) throw new Error(file);
    return ctx.decodeAudioData(await res.arrayBuffer());
  };
  samplesLoading = Promise.all(
    Object.entries(SAMPLE_FILES).map(async ([group, files]) => {
      const buffers = await Promise.allSettled(files.map(loadOne));
      samples[group] = buffers.filter((r) => r.status === "fulfilled").map((r) => r.value);
    }),
  );
  return samplesLoading;
}

const unlock = async () => {
  try {
    const needsStart = !ctx || ctx.state !== "running";
    if (!ctx || ctx.state === "closed") {
      createContext();
      Object.keys(lastPlayed).forEach((name) => delete lastPlayed[name]);
    }
    if (!ctx) return false;
    if (needsStart) {
      // Start a source before yielding to resume(), including during a gesture retry.
      // This primes WebKit's audio output as well as resuming the context.
      const resumed = ctx.resume();
      const primer = ctx.createBufferSource();
      primer.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      primer.connect(out);
      primer.onended = () => primer.disconnect();
      primer.start(0);
      resuming = true;
      try {
        await resumed;
      } finally {
        resuming = false;
      }
    }
    // Rain asked for before there was any audio to play it in starts now
    if (ctx.state === "running" && rainWanted > 0.01) setRainLevel(rainWanted);
    return ctx.state === "running";
  } catch {
    return false;
  }
};
// Never await this during page rendering: browsers can leave resume() pending
// until a user gesture when autoplay isn't permitted.
export function initializeAudio() {
  return muted.value ? Promise.resolve(false) : unlock();
}

// Opening the audio output takes a beat (around a hundred milliseconds on a Mac), and done in the
// gesture that lets the visitor in it held up the first frames of the camera drawing back. Made
// ahead, while the room waits behind the loader, the context starts suspended (or running, where
// autoplay is allowed) and the gesture only has to resume it. Nothing plays until then.
export function prepareAudio() {
  if (muted.value || ctx) return;
  try {
    createContext();
  } catch {
    ctx = null;
  }
}

// First interaction enables audio if autoplay was blocked.
// Later gestures also recover Safari audio after an interruption.
// Browsers only allow audio after a real gesture (a press, a tap or a key); moving the pointer
// or scrolling doesn't count, so the earliest moment is the first press anywhere.
["pointerdown", "click", "touchend", "keydown"].forEach((event) =>
  window.addEventListener(event, () => {
    if (!muted.value && (!ctx || ctx.state !== "running")) void unlock();
  }, { capture: true, passive: true }),
);

// ---------- building blocks ----------
// One of a group's recordings, picked at random and nudged in pitch so repeats don't sound
// identical. False when none is loaded, so the caller can fall back to pure synth.
// `duration` fades it out early to fit a shorter motion; `send` feeds some of it to the hall.
// `steady` plays the first recording exactly as it is, for a sound repeated often enough that
// it should be the same every time.
function sample(t, group, { peak = 0.5, rate = 1, duration, send = 0, steady = false } = {}) {
  const list = samples[group];
  if (!list || !list.length) return false;
  const src = ctx.createBufferSource();
  src.buffer = steady ? list[0] : list[Math.floor(Math.random() * list.length)];
  src.playbackRate.value = steady ? rate : vary(rate, 0.06);
  const gain = ctx.createGain();
  const level = steady ? peak : vary(peak, 0.1);
  gain.gain.setValueAtTime(level, t);
  if (duration) {
    gain.gain.setValueAtTime(level, t + duration * 0.6);
    gain.gain.linearRampToValueAtTime(0.0001, t + duration);
  }
  src.connect(gain).connect(out);
  if (send) toHall(gain, send);
  src.onended = () => gain.disconnect();
  src.start(t);
  if (duration) src.stop(t + duration + 0.02);
  return true;
}

// A big hall, built once from decaying noise, for the few sounds that need space around them
let hall = null;
function toHall(node, amount) {
  if (!hall || hall.context !== ctx) {
    const len = Math.floor(ctx.sampleRate * 3.2);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.5);
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = ir;
    hall = ctx.createGain();
    hall.connect(convolver).connect(master);
  }
  const send = ctx.createGain();
  send.gain.value = amount;
  node.connect(send).connect(hall);
}

// Attack/decay envelope on a gain node
function envelope(gain, t, { attack = 0.005, peak = 0.5, decay = 0.15 }) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(t, { type = "sine", freq = 440, to, attack, peak, decay = 0.15, send = 0 }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + (attack || 0.005) + decay);
  envelope(gain, t, { attack, peak, decay });
  osc.connect(gain).connect(out);
  if (send) toHall(gain, send);
  osc.start(t);
  osc.stop(t + (attack || 0.005) + decay + 0.05);
}

function noise(t, { filter = "bandpass", freq = 1500, to, q = 1, attack, peak, decay = 0.15, send = 0 }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const biquad = ctx.createBiquadFilter();
  biquad.type = filter;
  biquad.frequency.setValueAtTime(freq, t);
  if (to) biquad.frequency.exponentialRampToValueAtTime(to, t + (attack || 0.005) + decay);
  biquad.Q.value = q;
  const gain = ctx.createGain();
  envelope(gain, t, { attack, peak, decay });
  src.connect(biquad).connect(gain).connect(out);
  if (send) toHall(gain, send);
  src.start(t, Math.random() * 0.5);
  src.stop(t + (attack || 0.005) + decay + 0.05);
}

const vary = (n, spread = 0.08) => n * (1 + (Math.random() * 2 - 1) * spread);

// A plucked string (Karplus–Strong): a burst of noise fed round a delay line the length of one
// period, softened a little on every pass. Rendered once per pitch and reused.
const pluckCache = new Map();
function pluckBuffer(freq) {
  const key = `${ctx.sampleRate}:${Math.round(freq * 10)}`;
  if (pluckCache.has(key)) return pluckCache.get(key);
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.floor(rate * 2.4), rate);
  const data = buffer.getChannelData(0);
  const period = Math.max(2, Math.round(rate / freq));
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
  for (let i = 0; i < data.length; i++) {
    const k = i % period;
    data[i] = ring[k];
    ring[k] = 0.996 * 0.5 * (ring[k] + ring[(k + 1) % period]);
  }
  pluckCache.set(key, buffer);
  return buffer;
}
function pluck(t, freq, peak) {
  const src = ctx.createBufferSource();
  src.buffer = pluckBuffer(freq);
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 3200;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peak, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
  src.connect(tone).connect(gain).connect(out);
  src.start(t);
  src.stop(t + 2.4);
}
// Open chords, low string to high (Hz)
const CHORDS = [
  [98, 123.47, 146.83, 196, 246.94, 392], // G
  [130.81, 164.81, 196, 261.63, 329.63], // C
  [146.83, 220, 293.66, 369.99], // D
  [82.41, 123.47, 164.81, 196, 246.94, 329.63], // Em
];
let chordIndex = 0;
// The groove's tempo (seconds per beat): exported so the speakers can pump in time
export const GROOVE_BEAT = 0.2;

// ---------- the sounds ----------
const SOUNDS = {
  // Something heavy landing on a desk
  thud(t, { strength = 1 } = {}) {
    tone(t, { freq: vary(130), to: 45, peak: 0.9 * strength, decay: 0.22 });
    noise(t, { filter: "lowpass", freq: 500, peak: 0.45 * strength, decay: 0.08 });
  },
  // A sheet of paper flicked: a few tiny bright crackles plus the soft air under the sheet
  paper(t) {
    const crackles = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < crackles; i++) {
      const at = t + i * 0.018 + Math.random() * 0.01;
      noise(at, { filter: "highpass", freq: vary(3000, 0.3), q: 0.7, attack: 0.002, peak: 0.28 * (1 - i * 0.18), decay: 0.02 + Math.random() * 0.015 });
    }
    noise(t, { freq: 1800, q: 0.6, attack: 0.01, peak: 0.12, decay: 0.09 });
  },
  // Thumbing through a stack of pages: soft swishes in quick succession over a breath of air
  riffle(t, { count = 6, duration = 0.4 } = {}) {
    // Real pages flipping up front, with the synth swishes thinned to fill out the length
    const layer = sample(t, "pages", { peak: 0.45 }) ? 0.5 : 1;
    noise(t, { filter: "lowpass", freq: 900, attack: 0.03, peak: 0.13 * layer, decay: duration });
    for (let i = 0; i < count; i++) {
      const at = t + (duration / count) * i + Math.random() * 0.015;
      noise(at, { freq: vary(2000, 0.3), q: 0.9, attack: 0.006, peak: (0.16 + Math.random() * 0.06) * layer, decay: 0.05 + Math.random() * 0.03 });
    }
  },
  // A cover or a big sheet moving: a crinkle of many short crackles that swells and fades
  rustle(t, { duration = 0.6 } = {}) {
    for (let at = t; at < t + duration; at += 0.012 + Math.random() * 0.03) {
      const swell = Math.sin(Math.PI * ((at - t) / duration));
      noise(at, { filter: "highpass", freq: vary(2400, 0.4), q: 0.8, attack: 0.002, peak: 0.05 + 0.2 * swell, decay: 0.012 + Math.random() * 0.02 });
    }
    noise(t, { freq: 1200, q: 0.5, attack: duration * 0.4, peak: 0.06, decay: duration * 0.6 });
  },
  // Paper torn along a perforation: fibres snapping faster and faster over the rip itself
  tear(t, { duration = 0.32 } = {}) {
    for (let at = t; at < t + duration; at += 0.006 + Math.random() * 0.012) {
      const p = (at - t) / duration;
      noise(at, { filter: "highpass", freq: vary(2600 - 1000 * p, 0.3), q: 0.9, attack: 0.001, peak: 0.12 + 0.18 * Math.sin(Math.PI * p), decay: 0.01 + Math.random() * 0.012 });
    }
    noise(t, { freq: 2200, to: 900, q: 0.7, attack: 0.02, peak: 0.22, decay: duration });
  },
  // Paper sliding over paper: a soft, breathy "shff" with a little grain in it
  slide(t, { duration = 0.26, up = true, pitch = 1 } = {}) {
    noise(t, { freq: (up ? 2200 : 3800) * pitch, to: (up ? 3800 : 2200) * pitch, q: 0.7, attack: duration * 0.4, peak: 0.13, decay: duration * 0.6 });
    for (let at = t + duration * 0.15; at < t + duration * 0.8; at += 0.03 + Math.random() * 0.04) {
      noise(at, { filter: "highpass", freq: vary(5000, 0.2), q: 0.6, attack: 0.002, peak: 0.025, decay: 0.012 });
    }
  },
  // A cardboard folder cover landing flat: a dull flop pushing a puff of air out
  flop(t, { strength = 1, recorded = true } = {}) {
    const real = recorded && sample(t, "cover", { peak: 0.4 * strength });
    noise(t, { filter: "lowpass", freq: 900, to: 180, attack: 0.004, peak: (real ? 0.15 : 0.3) * strength, decay: 0.13 });
    tone(t, { freq: vary(95), to: 60, peak: 0.22 * strength, decay: 0.11 });
  },
  // A filing drawer rolling on its runners, ending in a soft clunk against the stop
  drawer(t, { duration = 0.6 } = {}) {
    for (let at = t; at < t + duration; at += 0.022 + Math.random() * 0.018) {
      const swell = Math.sin(Math.PI * ((at - t) / duration));
      noise(at, { filter: "lowpass", freq: vary(260, 0.25), attack: 0.004, peak: 0.04 + 0.08 * swell, decay: 0.03 });
    }
    tone(t + duration, { freq: 150, to: 85, peak: 0.32, decay: 0.08 });
    noise(t + duration, { filter: "highpass", freq: 2400, attack: 0.001, peak: 0.08, decay: 0.02 });
  },
  // A folder knocking into place among the others: a short, hollow cardboard tap
  knock(t, { strength = 1 } = {}) {
    tone(t, { type: "triangle", freq: vary(210, 0.05), to: 150, peak: 0.18 * strength, decay: 0.06 });
    noise(t, { freq: 800, q: 1.2, attack: 0.002, peak: 0.12 * strength, decay: 0.04 });
  },
  // Air rushing past something thrown
  whoosh(t, { duration = 0.45, up = true, volume = 1 } = {}) {
    noise(t, { freq: up ? 350 : 2600, to: up ? 2600 : 350, q: 1.4, attack: duration * 0.5, peak: 0.35 * volume, decay: duration * 0.5 });
  },
  // Rubber stamp: thump plus a sharp click
  stamp(t) {
    tone(t, { freq: 170, to: 55, peak: 0.9, decay: 0.14 });
    noise(t, { filter: "highpass", freq: 3000, peak: 0.5, decay: 0.035 });
    noise(t, { filter: "lowpass", freq: 900, peak: 0.4, decay: 0.09 });
  },
  // Card slapped flat onto a surface
  slap(t) {
    noise(t, { freq: vary(1300), q: 0.7, peak: 0.7, decay: 0.08 });
    tone(t, { freq: 150, to: 70, peak: 0.45, decay: 0.1 });
  },
  // Small check-mark tick
  tick(t, { pitch = 1 } = {}) {
    tone(t, { type: "triangle", freq: vary(1700 * pitch, 0.03), peak: 0.22, decay: 0.045 });
  },
  // Bubbly pop for things appearing
  pop(t, { pitch = 1 } = {}) {
    tone(t, { freq: vary(320 * pitch), to: 950 * pitch, peak: 0.35, decay: 0.11 });
  },
  // Sipping a hot drink: air pulled in over the liquid (a rising hiss the liquid breaks into
  // a flutter, with little bubbles in it), a gulp, then a soft "ahh"
  slurp(t, { duration = 0.7 } = {}) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 1.4;
    band.frequency.setValueAtTime(800, t);
    band.frequency.exponentialRampToValueAtTime(2400, t + duration);
    // A second, higher band: the hiss of air squeezed between the lips
    const lips = ctx.createBiquadFilter();
    lips.type = "bandpass";
    lips.Q.value = 2.5;
    lips.frequency.setValueAtTime(3200, t);
    lips.frequency.linearRampToValueAtTime(4200, t + duration);
    const lipsLevel = ctx.createGain();
    lipsLevel.gain.value = 0.35;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.3, t + 0.08);
    env.gain.setValueAtTime(0.3, t + duration - 0.12);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    // Flutter: the liquid breaks the airflow up irregularly (a steady wobble sounds like a motor)
    const flutter = ctx.createGain();
    flutter.gain.setValueAtTime(0.6, t);
    for (let at = t + 0.02; at < t + duration; at += 0.012 + Math.random() * 0.035) {
      flutter.gain.linearRampToValueAtTime(0.2 + Math.random() * 0.8, at);
    }
    src.connect(band).connect(env);
    src.connect(lips).connect(lipsLevel).connect(env);
    env.connect(flutter).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + duration + 0.05);
    // Droplets: a few small, quick wet ticks rather than a stream of chirps
    for (let at = t + 0.06; at < t + duration - 0.05; at += 0.05 + Math.random() * 0.1) {
      tone(at, { freq: vary(1400, 0.35), to: vary(2600, 0.3), peak: 0.03 + Math.random() * 0.04, decay: 0.015 });
    }
    // Gulp (a real swallow when it's loaded), then the "ahh"
    const gulp = t + duration + 0.12;
    if (!sample(gulp, "swallow", { peak: 0.55 })) {
      tone(gulp, { freq: 230, to: 85, peak: 0.4, decay: 0.12 });
      noise(gulp, { filter: "lowpass", freq: 380, peak: 0.25, decay: 0.08 });
    }
    noise(gulp + 0.3, { freq: 1100, to: 650, q: 0.8, attack: 0.06, peak: 0.07, decay: 0.35 });
  },
  // Leaves brushing together: a soft airy swish with a few gentle flutters, no paper crackle
  leaves(t, { duration = 0.6 } = {}) {
    noise(t, { freq: 2200, to: 1400, q: 0.5, attack: 0.08, peak: 0.1, decay: duration });
    for (let i = 0; i < 6; i++) {
      const at = t + 0.04 + i * (duration / 7) + Math.random() * 0.03;
      noise(at, { freq: vary(3600, 0.25), q: 1.2, attack: 0.02, peak: 0.05 + Math.random() * 0.03, decay: 0.08 + Math.random() * 0.05 });
    }
  },
  // Notification chime
  ping(t) {
    tone(t, { freq: 1318, peak: 0.25, decay: 0.5 });
    tone(t + 0.09, { freq: 1976, peak: 0.22, decay: 0.6 });
  },
  // The trophy lifting off its shelf under the pointer: a soft swish rising under a brassy glint
  // that rings on
  trophyHover(t) {
    noise(t, { freq: 1600, to: 3400, q: 0.8, attack: 0.05, peak: 0.035, decay: 0.22 });
    tone(t + 0.04, { type: "triangle", freq: 1568, to: 1661, attack: 0.008, peak: 0.07, decay: 0.4, send: 0.2 });
    tone(t + 0.1, { type: "triangle", freq: 2349, attack: 0.006, peak: 0.045, decay: 0.55, send: 0.25 });
  },
  // The trophy flying up off its shelf before it bursts: a whoosh climbing the 0.6 s of its
  // rise under a run of glints stepping up to meet the burst
  trophyLift(t) {
    noise(t, { freq: 500, to: 3800, q: 0.9, attack: 0.35, peak: 0.07, decay: 0.3 });
    tone(t, { type: "triangle", freq: 330, to: 990, attack: 0.3, peak: 0.035, decay: 0.32 });
    [1047, 1319, 1568, 2093].forEach((freq, i) => tone(t + 0.12 + i * 0.12, { type: "triangle", freq, attack: 0.006, peak: 0.045 + i * 0.008, decay: 0.3, send: 0.25 }));
  },
  // A crisp, clean bell ding as booting completes or a task succeeds
  ding(t, { pitch = 1, volume = 0.28 } = {}) {
    const f = 1174.66 * pitch;
    tone(t, { freq: f, peak: volume, decay: 0.85, send: 0.25 });
    tone(t, { freq: f * 1.5, peak: volume * 0.35, decay: 0.55, send: 0.15 });
    tone(t, { freq: f * 2.76, peak: volume * 0.14, decay: 0.35 });
    noise(t, { filter: "bandpass", freq: 3800, q: 3, peak: volume * 0.3, decay: 0.02 });
  },
  // Receipt printer: a run of motor clicks
  printer(t, { duration = 1, steps = 18 } = {}) {
    for (let i = 0; i < steps; i++) {
      const at = t + (duration / steps) * i;
      noise(at, { filter: "highpass", freq: 2200, peak: 0.28, decay: 0.018 });
      tone(at, { type: "square", freq: 110, peak: 0.05, decay: 0.025 });
    }
  },
  // Pen scratching on paper
  scribble(t, { duration = 0.45 } = {}) {
    for (let at = t; at < t + duration; at += 0.035 + Math.random() * 0.05) {
      noise(at, { freq: vary(3800, 0.25), q: 2.5, attack: 0.01, peak: 0.12, decay: 0.03 + Math.random() * 0.03 });
    }
  },
  // Mechanical keyboard key: a sharp click, then the low "thock" of the keycap bottoming out
  key(t) {
    noise(t, { freq: vary(1800, 0.2), q: 1.2, attack: 0.001, peak: 0.55, decay: 0.012 });
    noise(t + 0.008, { filter: "lowpass", freq: 600, attack: 0.002, peak: 0.4, decay: 0.03 });
    tone(t, { freq: vary(140, 0.15), to: 90, peak: 0.18, decay: 0.035 });
  },
  // Cartoon "speech": a short voiced syllable at a random pitch, for talking speech bubbles
  talk(t) {
    const notes = [220, 247, 262, 294, 330];
    const base = notes[Math.floor(Math.random() * notes.length)];
    tone(t, { type: "triangle", freq: base * 1.15, to: base, attack: 0.008, peak: 0.16, decay: 0.07 });
    tone(t, { freq: base * 2.02, to: base * 1.9, attack: 0.008, peak: 0.06, decay: 0.06 });
  },
  // A console waking to a touch: one short, clean beep from its button, then its fan breathing in
  consoleWake(t) {
    tone(t, { freq: 1050, peak: 0.45, decay: 0.09 });
    noise(t + 0.06, { freq: 450, to: 1100, q: 0.8, attack: 0.12, peak: 0.32, decay: 0.25 });
  },
  // Robot chatter
  blip(t) {
    const notes = [523, 587, 659, 784, 880];
    tone(t, { type: "square", freq: notes[Math.floor(Math.random() * notes.length)], peak: 0.07, decay: 0.05 });
  },
  // Something went wrong
  buzz(t) {
    tone(t, { type: "sawtooth", freq: 110, peak: 0.16, decay: 0.2 });
    tone(t + 0.02, { type: "sawtooth", freq: 116, peak: 0.12, decay: 0.18 });
  },
  // A downstrum on the guitar, one chord after another round the progression
  strum(t) {
    const chord = CHORDS[chordIndex++ % CHORDS.length];
    chord.forEach((freq, i) => pluck(t + i * 0.022 + Math.random() * 0.006, freq, 0.32 - i * 0.025));
  },
  // A thumb brushed over the two low strings: a soft open E and A, barely plucked
  brush(t) {
    pluck(t, 82.41, 0.16);
    pluck(t + 0.035, 110, 0.12);
  },
  // Luffy's laugh, "shi-shi-shi": three hissed syllables climbing in pitch, each with a little
  // voiced bounce under it
  shishishi(t) {
    for (let i = 0; i < 3; i++) {
      const at = t + i * 0.13;
      noise(at, { filter: "highpass", freq: vary(4200 + i * 500, 0.05), q: 1.2, attack: 0.008, peak: 0.22, decay: 0.07 });
      tone(at + 0.01, { type: "triangle", freq: vary(330 + i * 40, 0.03), to: 290 + i * 40, attack: 0.01, peak: 0.12, decay: 0.07 });
    }
  },
  // A small bird: two quick rising whistles
  chirp(t, { volume = 1 } = {}) {
    tone(t, { freq: vary(2600, 0.06), to: 3700, attack: 0.004, peak: 0.12 * volume, decay: 0.05 });
    tone(t + 0.09, { freq: vary(2900, 0.06), to: 4000, attack: 0.004, peak: 0.1 * volume, decay: 0.06 });
  },
  // Sparkle for a shooting star: a bright falling glint over a soft shimmer
  sparkle(t, { volume = 1 } = {}) {
    tone(t, { freq: 2800, to: 1600, attack: 0.005, peak: 0.12 * volume, decay: 0.5 });
    [0, 0.07, 0.15, 0.24].forEach((d, i) => tone(t + d, { type: "triangle", freq: 2093 * (1 + i * 0.25), peak: 0.07 * volume, decay: 0.18 }));
  },
  // The speakers coming on: a two-bar groove (kick, hats, a bass line and a bright riff).
  // Beat i lands at t + i * GROOVE_BEAT, so visuals can pulse in time.
  groove(t) {
    const beat = GROOVE_BEAT;
    const bass = [65.41, 65.41, 98, 87.31, 65.41, 65.41, 116.54, 98];
    const riff = [523.25, 659.25, 783.99, 659.25, 880, 783.99, 659.25, 1046.5];
    for (let i = 0; i < 8; i++) {
      const at = t + i * beat;
      if (i % 2 === 0) tone(at, { freq: 150, to: 45, peak: 0.7, decay: 0.16 });
      noise(at + beat / 2, { filter: "highpass", freq: 7000, peak: 0.12, decay: 0.03 });
      if (i % 4 === 2) noise(at, { freq: 1800, q: 0.8, peak: 0.3, decay: 0.09 });
      tone(at, { type: "sawtooth", freq: bass[i], peak: 0.12, decay: beat * 0.8 });
      tone(at + beat / 2, { type: "square", freq: riff[i], peak: 0.06, decay: beat * 0.4 });
    }
    tone(t + 8 * beat, { type: "triangle", freq: 1046.5, peak: 0.12, decay: 0.5 });
    tone(t + 8 * beat, { type: "triangle", freq: 1318.5, peak: 0.08, decay: 0.5 });
  },
  // The speakers switching off: a tape-stop slide down and a soft thump
  powerDown(t) {
    tone(t, { type: "sawtooth", freq: 440, to: 55, attack: 0.01, peak: 0.16, decay: 0.45 });
    tone(t + 0.45, { freq: 90, to: 40, peak: 0.4, decay: 0.12 });
  },
  // A woofer nudged: one soft bass push of the cone, with the faint rattle of its grille
  woofer(t) {
    tone(t, { freq: vary(85, 0.05), to: 48, attack: 0.012, peak: 0.8, decay: 0.16 });
    // its octave, so a laptop's small speakers still hear the push
    tone(t, { type: "triangle", freq: vary(170, 0.05), to: 96, attack: 0.012, peak: 0.45, decay: 0.12 });
    noise(t + 0.01, { filter: "lowpass", freq: 500, q: 0.7, attack: 0.01, peak: 0.25, decay: 0.08 });
  },
  // Rubber pulled taut: a low reedy creak rising in pitch as it stretches
  rubber(t, { duration = 0.4 } = {}) {
    tone(t, { type: "sawtooth", freq: vary(85, 0.05), to: 230, attack: duration * 0.6, peak: 0.07, decay: duration * 0.5 });
    tone(t, { type: "triangle", freq: vary(170, 0.05), to: 460, attack: duration * 0.6, peak: 0.05, decay: duration * 0.5 });
  },
  // Rubber snapping back: a springy "boyoyoing", up, down and up again, dying away
  boing(t) {
    tone(t, { freq: vary(150, 0.04), to: 560, attack: 0.01, peak: 0.32, decay: 0.12 });
    tone(t + 0.1, { freq: 540, to: 210, peak: 0.26, decay: 0.14 });
    tone(t + 0.22, { freq: 230, to: 430, peak: 0.18, decay: 0.12 });
    tone(t + 0.33, { freq: 420, to: 260, peak: 0.1, decay: 0.14 });
  },
  // A cartoon mouse: two high squeaks
  squeak(t) {
    tone(t, { freq: vary(2400, 0.05), to: 3300, attack: 0.01, peak: 0.13, decay: 0.07 });
    tone(t + 0.1, { freq: vary(2700, 0.05), to: 3600, attack: 0.01, peak: 0.11, decay: 0.08 });
  },
  // Little feet scampering over the desk
  patter(t, { duration = 0.6, volume = 1 } = {}) {
    for (let at = t; at < t + duration; at += 0.05 + Math.random() * 0.03) {
      noise(at, { freq: vary(2500, 0.3), q: 2, attack: 0.002, peak: 0.06 * volume, decay: 0.012 });
    }
  },
  // A cat: a nasal rise and fall through a vowel-ish band (higher and shorter for a "mrrp"),
  // kept soft: it's a small cat in the corner, under everything else
  meow(t, { short = false } = {}) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    const f = vary(short ? 640 : 520, 0.08);
    const len = short ? 0.22 : 0.55;
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.linearRampToValueAtTime(f * 1.55, t + len * 0.35);
    osc.frequency.linearRampToValueAtTime(f * 1.05, t + len);
    const formant = ctx.createBiquadFilter();
    formant.type = "bandpass";
    formant.Q.value = 3;
    formant.frequency.setValueAtTime(900, t);
    formant.frequency.linearRampToValueAtTime(1600, t + len * 0.4);
    formant.frequency.linearRampToValueAtTime(1000, t + len);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.15, t + 0.05);
    gain.gain.setValueAtTime(0.15, t + len * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(formant).connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + len + 0.05);
  },
  // A flower popping open: a soft rising pluck
  bloom(t, { pitch = 1 } = {}) {
    tone(t, { type: "triangle", freq: 520 * pitch, to: 1040 * pitch, attack: 0.01, peak: 0.18, decay: 0.18 });
    tone(t + 0.05, { freq: 1560 * pitch, peak: 0.06, decay: 0.25 });
  },
  // A wall clock striking: a bell "ding-dong" with a soft metallic shimmer
  // A wall clock striking: a soft, low gong per stroke (the hour's count, up to `count`), each
  // with the little wooden clack of its hammer
  clockStrike(t, { count = 3 } = {}) {
    for (let i = 0; i < count; i++) {
      const at = t + i * 0.9;
      // A real struck bell when it's loaded, the synth gong otherwise
      if (sample(at, "bell", { peak: 0.4, send: 0.2 })) continue;
      noise(at, { filter: "bandpass", freq: 2600, q: 2, peak: 0.12, decay: 0.03 });
      tone(at, { freq: 174.6, peak: 0.2, decay: 1.5 });
      tone(at, { freq: 174.6 * 2.76, peak: 0.05, decay: 0.7 });
      tone(at, { freq: 174.6 * 5.4, peak: 0.02, decay: 0.25 });
    }
  },
  // An office chair's gas lift letting go: a short pneumatic "pssht"
  hiss(t) {
    noise(t, { filter: "highpass", freq: 4200, to: 1800, q: 0.7, attack: 0.01, peak: 0.25, decay: 0.32 });
    tone(t, { freq: 120, to: 70, peak: 0.12, decay: 0.12 });
  },
  // A chair swivelling: a few dry creaks of the base, dropping in pitch as it slows
  creak(t) {
    // A recorded wooden creak replaces the sawtooth stand-in outright
    if (sample(t, "creak", { peak: 0.35 })) return;
    for (let i = 0; i < 4; i++) {
      tone(t + i * 0.16 + i * i * 0.03, { type: "sawtooth", freq: vary(260 - i * 30, 0.08), to: 200 - i * 25, attack: 0.01, peak: 0.05, decay: 0.08 });
    }
  },
  // A dumbbell set down: a bright metallic clink over a heavy thump
  clank(t, { strength = 1 } = {}) {
    tone(t, { type: "triangle", freq: vary(1250, 0.04), peak: 0.16 * strength, decay: 0.22 });
    tone(t + 0.004, { type: "triangle", freq: vary(1870, 0.04), peak: 0.1 * strength, decay: 0.16 });
    tone(t, { freq: 95, to: 50, peak: 0.6 * strength, decay: 0.14 });
    noise(t, { filter: "lowpass", freq: 700, peak: 0.25 * strength, decay: 0.05 });
  },
  // ---------- per-object landings ----------
  // thud, clank and flop are shared by very different things, so each object that gets a
  // recording has its own sound here, falling back to the shared synth when it isn't loaded
  // The cat landing: soft padded paws, with only a little of the synth weight under them
  catLand(t, { strength = 0.3 } = {}) {
    if (!sample(t, "paw", { peak: 0.7 * strength })) return SOUNDS.thud(t, { strength: strength * 0.6 });
    tone(t, { freq: vary(110), to: 50, peak: 0.35 * strength, decay: 0.12 });
  },
  // A ceramic mug set back on the desk
  mugDown(t, { strength = 0.35 } = {}) {
    if (!sample(t, "mug", { peak: 0.9 * strength })) return SOUNDS.thud(t, { strength });
    tone(t, { freq: vary(130), to: 60, peak: 0.4 * strength, decay: 0.1 });
  },
  // Coffee rocking in a lifted mug: a low wash of liquid and a bubble or two
  slosh(t) {
    noise(t, { filter: "lowpass", freq: 500, to: 1300, q: 1.6, attack: 0.07, peak: 0.38, decay: 0.24 });
    noise(t + 0.09, { filter: "lowpass", freq: 1300, to: 550, q: 1.6, attack: 0.05, peak: 0.24, decay: 0.2 });
    [0.12, 0.2].forEach((d) => tone(t + d + Math.random() * 0.04, { freq: vary(520, 0.2), to: vary(820, 0.15), peak: 0.1, decay: 0.03 }));
  },
  // A dumbbell set down: heavy iron, the synth thump keeping the weight under it
  dumbbell(t, { strength = 1 } = {}) {
    if (!sample(t, "dumbbell", { peak: 0.4 * strength })) return SOUNDS.clank(t, { strength });
    tone(t, { freq: 95, to: 50, peak: 0.5 * strength, decay: 0.14 });
  },
  // A sheathed sword dropping back into its wooden rack
  rackLand(t, { strength = 0.8 } = {}) {
    if (!sample(t, "rack", { peak: 0.25 * strength })) SOUNDS.clank(t, { strength: strength * 0.5 });
  },
  // The Switch seating in its dock: a hard plastic click
  dock(t, { strength = 0.5 } = {}) {
    if (!sample(t, "plastic", { peak: 0.7 * strength })) SOUNDS.clank(t, { strength });
  },
  // A paper ball clipping the bin's thin metal rim
  rimHit(t, { strength = 0.5 } = {}) {
    if (!sample(t, "tin", { peak: 0.6 * strength })) SOUNDS.clank(t, { strength });
  },
  // A book put down
  bookDown(t, { strength = 0.4 } = {}) {
    if (!sample(t, "book", { peak: 0.9 * strength })) SOUNDS.flop(t, { strength });
  },
  // A paper ball bouncing on the floor, and a card settling on its envelope: light, so they keep
  // the synth flop rather than the book-cover recording folders use
  // A cardboard folder drawn out from between the others: a smooth, low "shhh" of card on card,
  // much darker than loose paper, with a little drag in it
  folderSlide(t, { duration = 0.5, up = true } = {}) {
    noise(t, { freq: up ? 700 : 1100, to: up ? 1100 : 700, q: 0.9, attack: duration * 0.35, peak: 0.12, decay: duration * 0.65 });
    noise(t, { filter: "lowpass", freq: 450, attack: duration * 0.3, peak: 0.07, decay: duration * 0.7 });
    for (let at = t + duration * 0.2; at < t + duration * 0.75; at += 0.05 + Math.random() * 0.06) {
      noise(at, { freq: vary(1800, 0.2), q: 1.2, attack: 0.004, peak: 0.02, decay: 0.03 });
    }
  },
  // A folder's cover swung open: the air it pushes, a soft rising-and-falling "fwoom", no crackle
  coverOpen(t, { duration = 0.6 } = {}) {
    noise(t, { filter: "lowpass", freq: 300, to: 900, attack: duration * 0.5, peak: 0.1, decay: duration * 0.5 });
    noise(t, { freq: 600, to: 1400, q: 0.6, attack: duration * 0.5, peak: 0.04, decay: duration * 0.5 });
  },
  // A butterfly's wing beat: the faintest soft puff of air on the downstroke
  wingFlap(t, { volume = 1 } = {}) {
    if (volume < 0.05) return;
    noise(t, { filter: "lowpass", freq: 900, to: 350, attack: 0.012, peak: 0.18 * volume, decay: 0.05 });
    noise(t, { freq: vary(1800, 0.15), q: 0.8, attack: 0.01, peak: 0.07 * volume, decay: 0.04 });
  },
  // The lanyard's woven strap dragged about: a soft fabric swish, louder the faster it moves
  strap(t, { speed = 1 } = {}) {
    const level = Math.min(1, 0.4 + speed * 0.6);
    noise(t, { freq: vary(1100, 0.2), q: 0.8, attack: 0.03, peak: 0.13 * level, decay: 0.12 });
  },
  // The badge swinging on its clip: the plastic holder knocking the metal clip ring as each
  // swing turns back
  badgeClick(t, { strength = 0.5 } = {}) {
    tone(t, { type: "triangle", freq: vary(2900, 0.08), peak: 0.08 * strength, decay: 0.04 });
    noise(t, { freq: vary(4200, 0.15), q: 2, attack: 0.001, peak: 0.14 * strength, decay: 0.015 });
  },
  // A paper ball caught by the hoop's net: the crisp "tsssh" of the cords flicking past it
  swish(t) {
    noise(t, { filter: "bandpass", freq: 2600, to: 6500, q: 1.1, attack: 0.012, peak: 0.26, decay: 0.13 });
    noise(t + 0.03, { filter: "highpass", freq: 6000, q: 0.7, attack: 0.01, peak: 0.08, decay: 0.12 });
    for (let i = 0; i < 4; i++) {
      noise(t + 0.015 + i * 0.03 + Math.random() * 0.01, { freq: vary(3500, 0.25), q: 3, attack: 0.002, peak: 0.06, decay: 0.02 });
    }
  },
  // The light ball settling on the paper already in the bin
  binLand(t) {
    noise(t, { filter: "lowpass", freq: 900, to: 300, attack: 0.004, peak: 0.12, decay: 0.07 });
    noise(t, { filter: "highpass", freq: vary(3000, 0.2), attack: 0.002, peak: 0.05, decay: 0.03 });
  },
  paperBounce(t, { strength = 0.4 } = {}) {
    SOUNDS.flop(t, { strength, recorded: false });
  },
  cardDown(t, { strength = 0.5 } = {}) {
    SOUNDS.flop(t, { strength, recorded: false });
  },
  // A katana drawn: steel sliding out along the saya's wooden mouth, a dry "shhk" that rises,
  // ending in a low, short hum of the freed blade (no bright bell ring)
  shing(t) {
    // With the recording carrying the scrape, the synth scrape drops to a thin layer of air
    const real = sample(t, "draw", { peak: 0.45 });
    const layer = real ? 0.35 : 1;
    noise(t, { filter: "bandpass", freq: 900, to: 3800, q: 2.2, attack: 0.05, peak: 0.22 * layer, decay: 0.32 });
    noise(t + 0.02, { filter: "highpass", freq: 2500, to: 5200, q: 0.7, attack: 0.04, peak: 0.07 * layer, decay: 0.3 });
    tone(t + 0.3, { type: "triangle", freq: 620, to: 590, attack: 0.01, peak: 0.05, decay: 0.35 });
  },
  // Koiguchi: the blade eased a hand's width out on hover. The same sound as the full draw
  // (shing: the recorded scrape over a thin layer of air), cut short to the shorter slide and
  // a little quieter, without the freed blade's hum; and the same every time (the first
  // recording, unvaried), since a hover is made over and over. Opening and shutting are
  // separate sounds, so moving from one sword to the next (shut, then open, at once) never
  // drops the open.
  koiguchi(t) {
    const real = sample(t, "draw", { peak: 0.17, duration: 0.42, steady: true });
    const layer = real ? 0.28 : 0.65;
    noise(t, { filter: "bandpass", freq: 900, to: 3800, q: 2.2, attack: 0.05, peak: 0.12 * layer, decay: 0.3 });
    noise(t + 0.02, { filter: "highpass", freq: 2500, to: 5200, q: 0.7, attack: 0.04, peak: 0.04 * layer, decay: 0.28 });
  },
  // Shut again: the hush shorter and falling, ending on the guard's soft "tak" against the mouth
  koiguchiShut(t) {
    noise(t, { filter: "bandpass", freq: 2600, to: 1300, q: 2.2, attack: 0.02, peak: 0.07, decay: 0.16 });
    noise(t + 0.2, { filter: "bandpass", freq: 900, q: 3, attack: 0.001, peak: 0.2, decay: 0.035 });
  },
  // The cut itself: a recorded blade slicing through, over a short falling rush of air (just the
  // old synth whoosh when the recording isn't there)
  slash(t) {
    const real = sample(t, "slice", { peak: 0.4 });
    noise(t, { filter: "bandpass", freq: 2200, to: 500, q: 1.2, attack: 0.02, peak: real ? 0.12 : 0.3, decay: 0.25 });
  },
  // Sheathed: the scrape going home, falling in pitch, then the dull wooden "tak" of the guard
  // seating against the saya's mouth
  sheathe(t) {
    noise(t, { filter: "bandpass", freq: 3200, to: 1000, q: 2, attack: 0.03, peak: 0.16, decay: 0.24 });
    noise(t + 0.27, { filter: "bandpass", freq: 900, q: 3, attack: 0.001, peak: 0.42, decay: 0.045 });
    tone(t + 0.27, { type: "triangle", freq: 320, to: 180, attack: 0.001, peak: 0.28, decay: 0.08 });
  },
  // A flying slash leaving: a whoosh that drops in pitch and fades as it goes
  whooshAway(t) {
    noise(t, { filter: "bandpass", freq: 2600, to: 280, q: 1.8, attack: 0.03, peak: 0.32, decay: 0.95 });
  },
  // A sent postcard's paper plane taking off like a jet: the engine spooling up, the roar of
  // the climb, then the sound dropping in pitch as it flies off into the distance
  planeTakeoff(t, { duration = 1.6 } = {}) {
    tone(t, { type: "sawtooth", freq: 55, to: 160, attack: duration * 0.55, peak: 0.06, decay: duration * 0.45 });
    tone(t, { type: "triangle", freq: 420, to: 1300, attack: duration * 0.5, peak: 0.03, decay: duration * 0.4 });
    noise(t, { filter: "lowpass", freq: 250, to: 1300, attack: duration * 0.5, peak: 0.32, decay: duration * 0.55 });
    noise(t + duration * 0.2, { freq: 500, to: 3600, q: 1.1, attack: duration * 0.35, peak: 0.26, decay: duration * 0.5, send: 0.3 });
    noise(t + duration * 0.55, { freq: 3000, to: 450, q: 1.6, attack: 0.05, peak: 0.16, decay: duration * 0.6, send: 0.45 });
  },
  // The Infinity Stones powering up: a low hum climbing in pitch with a shimmer over it
  power(t, { duration = 1.4 } = {}) {
    tone(t, { type: "sawtooth", freq: 70, to: 280, attack: duration * 0.8, peak: 0.12, decay: duration * 0.3 });
    tone(t, { freq: 140, to: 560, attack: duration * 0.8, peak: 0.1, decay: duration * 0.3 });
    for (let i = 0; i < 6; i++) tone(t + i * (duration / 6), { type: "triangle", freq: 880 * (1 + i * 0.18), peak: 0.05, decay: 0.25 });
  },
  // The breath before the snap: a hiss swelling up to the moment
  riser(t, { duration = 0.5 } = {}) {
    noise(t, { freq: 400, to: 3200, q: 0.9, attack: duration, peak: 0.22, decay: 0.04 });
    tone(t, { type: "sawtooth", freq: 110, to: 220, attack: duration, peak: 0.05, decay: 0.04 });
  },
  // THE snap: a hard crack, a deep shock-wave boom under it, the crack echoing off into the
  // distance, and a cosmic shimmer falling away
  snap(t) {
    // Everything goes partly into the hall, so the snap rings out like it's heard across a universe
    const crack = (at, peak, freq, send) => {
      noise(at, { filter: "highpass", freq, attack: 0.001, peak, decay: 0.035, send });
      noise(at, { freq: freq * 0.55, q: 1.4, attack: 0.001, peak: peak * 0.6, decay: 0.07, send });
    };
    crack(t, 1, 2800, 0.5);
    crack(t + 0.004, 0.6, 1500, 0.3);
    tone(t, { freq: 380, to: 150, peak: 0.45, decay: 0.07 });
    [[0.16, 0.36, 2000], [0.36, 0.2, 1600], [0.6, 0.11, 1300], [0.9, 0.06, 1100]].forEach(([d, peak, freq]) => crack(t + d, peak, freq, 0.6));
    // The shock wave: a sub drop that keeps falling and a pressure "whomp" under it
    tone(t + 0.01, { freq: 90, to: 22, attack: 0.006, peak: 1, decay: 2.4 });
    noise(t + 0.01, { filter: "lowpass", freq: 300, to: 40, attack: 0.01, peak: 0.6, decay: 1.4, send: 0.3 });
    // A low, dark chord swelling up behind it as the universe takes it in
    tone(t + 0.05, { type: "triangle", freq: 55, attack: 0.25, peak: 0.22, decay: 2.6, send: 0.6 });
    tone(t + 0.05, { type: "triangle", freq: 65.4, attack: 0.3, peak: 0.14, decay: 2.4, send: 0.6 });
    for (let i = 0; i < 9; i++) {
      tone(t + 0.06 + i * 0.07, { type: "triangle", freq: 2600 * (1 - i * 0.07), peak: 0.06, decay: 1.1, send: 0.7 });
    }
  },
  // Things turning to dust: a long, soft, sandy hiss drifting down
  dust(t, { duration = 1.6 } = {}) {
    noise(t, { filter: "bandpass", freq: 3200, to: 900, q: 0.6, attack: 0.15, peak: 0.16, decay: duration });
    for (let at = t; at < t + duration; at += 0.03 + Math.random() * 0.05) {
      noise(at, { filter: "highpass", freq: vary(6000, 0.3), attack: 0.002, peak: 0.02 + Math.random() * 0.03, decay: 0.02 });
    }
  },
  // Sandai Kitetsu stirring: a low, uneasy growl that wavers, as if the blade wants to cut
  growl(t, { duration = 0.7 } = {}) {
    for (let i = 0; i < 6; i++) {
      const at = t + (i / 6) * duration;
      tone(at, { type: "sawtooth", freq: vary(62 + (i % 2) * 9, 0.05), to: 55, attack: 0.03, peak: 0.09, decay: duration / 5 });
    }
    noise(t, { filter: "lowpass", freq: 320, to: 180, attack: duration * 0.4, peak: 0.12, decay: duration * 0.6 });
  },
  // Enma's hellfire: a low roar of flame billowing up and dying away
  roar(t, { duration = 0.9 } = {}) {
    noise(t, { filter: "lowpass", freq: 180, to: 900, attack: 0.12, peak: 0.32, decay: duration });
    noise(t + 0.05, { filter: "bandpass", freq: 600, to: 1500, q: 0.7, attack: 0.1, peak: 0.12, decay: duration * 0.8 });
  },
  // Black lightning: a sharp crack and a rumble rolling off under it
  thunder(t) {
    noise(t, { filter: "highpass", freq: 1800, attack: 0.001, peak: 0.5, decay: 0.05 });
    noise(t + 0.03, { freq: 900, q: 1.2, attack: 0.002, peak: 0.3, decay: 0.12 });
    noise(t + 0.06, { filter: "lowpass", freq: 220, to: 70, attack: 0.04, peak: 0.45, decay: 1.1 });
    tone(t + 0.02, { freq: 70, to: 32, attack: 0.01, peak: 0.4, decay: 0.8 });
  },
  // A whole crowd shouting "yeaaah!": a stack of voices sliding up from "ee" into a wide-open
  // "ah", each with its own wobble, over a breathy roar, with a couple of "woo!"s on top
  cheer(t) {
    const voices = [140, 175, 210, 240, 280, 320, 370, 430];
    voices.forEach((pitch, i) => {
      const at = t + Math.random() * 0.12;
      const len = vary(1.35, 0.12);
      const voice = ctx.createOscillator();
      voice.type = "sawtooth";
      const p = vary(pitch, 0.04);
      voice.frequency.setValueAtTime(p * 0.85, at);
      voice.frequency.exponentialRampToValueAtTime(p * 1.45, at + 0.18);
      voice.frequency.exponentialRampToValueAtTime(p * 1.25, at + len * 0.6);
      voice.frequency.exponentialRampToValueAtTime(p * 0.95, at + len);
      // Excited throats shake: a fast vibrato that deepens as the shout is held
      const wobble = ctx.createOscillator();
      wobble.frequency.value = vary(6.5, 0.15);
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, at);
      depth.gain.linearRampToValueAtTime(p * 0.05, at + 0.5);
      wobble.connect(depth).connect(voice.frequency);
      const level = 0.075 * (i % 2 ? 0.85 : 1);
      const mix = ctx.createGain();
      mix.gain.setValueAtTime(0.0001, at);
      mix.gain.exponentialRampToValueAtTime(level, at + 0.06);
      mix.gain.setValueAtTime(level, at + len * 0.55);
      mix.gain.exponentialRampToValueAtTime(0.0001, at + len);
      [[300, 850, 1], [2400, 1250, 0.55], [3000, 2700, 0.25]].forEach(([from, to, amount]) => {
        const vowel = ctx.createBiquadFilter();
        vowel.type = "bandpass";
        vowel.Q.value = 6;
        vowel.frequency.setValueAtTime(from, at);
        vowel.frequency.exponentialRampToValueAtTime(to, at + 0.2);
        const g = ctx.createGain();
        g.gain.value = amount;
        voice.connect(vowel).connect(g).connect(mix);
      });
      mix.connect(out);
      toHall(mix, 0.35);
      voice.start(at);
      wobble.start(at);
      voice.stop(at + len + 0.05);
      wobble.stop(at + len + 0.05);
    });
    // The breath of the crowd behind the voices, opening up with the vowel
    noise(t, { freq: 700, to: 1100, q: 0.9, attack: 0.08, peak: 0.12, decay: 1.2, send: 0.3 });
    noise(t, { filter: "highpass", freq: 2500, attack: 0.05, peak: 0.04, decay: 0.8 });
    // "Woo!": high falsetto yelps swooping up over the top
    [0.25, 0.6].forEach((d) => {
      const at = t + d + Math.random() * 0.08;
      tone(at, { type: "triangle", freq: vary(620, 0.08), to: vary(1250, 0.06), attack: 0.05, peak: 0.07, decay: 0.35, send: 0.4 });
    });
  },
  // A packed room going wild: hundreds of hands, a roar under them, and whistles on top. It
  // swells in, holds for a few seconds, then thins out to the last few clappers.
  applause(t, { duration = 3.8 } = {}) {
    const swell = (at) => {
      const x = (at - t) / duration;
      return Math.min(1, x / 0.12, (1 - x) / 0.35);
    };
    for (let at = t; at < t + duration; at += 0.006 + Math.random() * 0.014) {
      const level = 0.11 * swell(at) * (0.5 + Math.random() * 0.5);
      if (level <= 0.002) continue;
      const near = Math.random() < 0.25;
      noise(at, { freq: vary(near ? 1100 : 1600, 0.35), q: 0.8, attack: 0.001, peak: level * (near ? 1.4 : 1), decay: vary(0.05, 0.3), send: 0.15 });
      if (near) noise(at + 0.003, { filter: "highpass", freq: 2200, attack: 0.001, peak: level * 0.6, decay: 0.03 });
    }
    // The crowd's roar and cheering underneath
    noise(t, { freq: 650, q: 0.7, attack: 0.4, peak: 0.1, decay: duration * 0.9, send: 0.4 });
    noise(t + 0.1, { filter: "lowpass", freq: 500, attack: 0.5, peak: 0.08, decay: duration * 0.7 });
    // Two-finger whistles: a rising "fweet!" and a "fwee-fwoo"
    [[0.35, 1800, 2900], [0.9, 2600, 1900], [1.5, 1900, 3100], [2.3, 2200, 3000]].forEach(([d, from, to]) => {
      tone(t + d + Math.random() * 0.1, { freq: vary(from, 0.05), to: vary(to, 0.05), attack: 0.03, peak: 0.06, decay: 0.32, send: 0.35 });
    });
    // A few "woo!" and "yeah!" shouts popping out of the crowd
    [0.5, 1.2, 1.9].forEach((d) => {
      tone(t + d + Math.random() * 0.15, { type: "triangle", freq: vary(520, 0.12), to: vary(1050, 0.1), attack: 0.06, peak: 0.05, decay: 0.4, send: 0.4 });
    });
  },
  // Plain UI click
  click(t) {
    tone(t, { freq: 900, to: 550, peak: 0.2, decay: 0.03 });
  },
};

// Minimum gap between two plays of the same sound, so fast loops don't machine-gun
const MIN_GAP = { cheer: 2, applause: 4, meow: 0.3, slide: 0.08, drawer: 0.4, knock: 0.05, tear: 0.2, riffle: 0.3, key: 0.035, talk: 0.06, blip: 0.07, tick: 0.03, paper: 0.04, scribble: 0.3, printer: 0.5, rustle: 0.3, strum: 0.15, consoleWake: 0.3, brush: 0.3, woofer: 0.15, slosh: 0.3, shishishi: 0.4, chirp: 0.12, sparkle: 0.6, groove: 1.6, powerDown: 0.6, squeak: 0.2, rubber: 0.15, boing: 0.3, patter: 0.4, clockStrike: 1.2, hiss: 0.4, creak: 0.8, clank: 0.12, dumbbell: 0.12, rackLand: 0.12, dock: 0.12, rimHit: 0.12, paperBounce: 0.05, swish: 0.2, wingFlap: 0.08, strap: 0.08, badgeClick: 0.12, shing: 0.5, koiguchi: 0.12, koiguchiShut: 0.12, slash: 0.15, sheathe: 0.4, whooshAway: 0.4, planeTakeoff: 1.2, power: 1.4, ding: 0.3, trophyHover: 0.5, trophyLift: 0.5, snap: 0.2, dust: 1, riser: 0.5, growl: 0.8, roar: 0.6, thunder: 0.3 };

function play(name, options = {}) {
  if (muted.value || hushDepth > 0 || !ctx || (ctx.state !== "running" && !resuming) || document.hidden) return;
  const now = ctx.currentTime;
  const at = now + (options.delay || 0);
  const gap = MIN_GAP[name] ?? 0.02;
  if (lastPlayed[name] !== undefined && at - lastPlayed[name] < gap) return;
  lastPlayed[name] = at;
  SOUNDS[name](at, options);
}

// sfx.thud(), sfx.paper({ delay: 0.1 }), ...
export const sfx = Object.fromEntries(Object.keys(SOUNDS).map((name) => [name, (options) => play(name, options)]));

// Hover cues: the same sounds, played quieter through their own bus. A thing is heard only on
// the first touch (then not again for a second), and a pointer swept across a row of things
// plays one every so often instead of a clatter. None on touch screens, where a tap hovers first.
const HOVER_LEVEL = 0.35;
const HOVER_REPEAT = 1;
const HOVER_GAP = 0.12;
const noHover = window.matchMedia("(hover: none)");
const hoverHeard = new WeakMap();
let hoverBus = null;
let lastHover = -Infinity;

// hoverSound(bin, (s) => s.rimHit()): `key` is the hovered thing, `cue` plays through `s` (sfx)
export function hoverSound(key, cue) {
  if (noHover.matches || muted.value || !ctx || ctx.state !== "running" || document.hidden) return;
  const now = ctx.currentTime;
  if (now - lastHover < HOVER_GAP || now - (hoverHeard.get(key) ?? -Infinity) < HOVER_REPEAT) return;
  lastHover = now;
  hoverHeard.set(key, now);
  if (!hoverBus || hoverBus.context !== ctx) {
    hoverBus = ctx.createGain();
    hoverBus.gain.value = HOVER_LEVEL;
    hoverBus.connect(master);
  }
  out = hoverBus;
  try {
    cue(sfx);
  } finally {
    out = master;
  }
}

// True when sounds would actually be heard: not muted and unlocked by a user gesture.
// Lets an intro wait for a click instead of playing silently.
export const audioReady = () => muted.value || (!!ctx && ctx.state === "running");

// Paper dragged over cork: one held, soft scrape for a whole drag rather than repeated bursts
// (which read as wing beats). set(level) swells it with the hand's speed (0–1) and lets it fade
// on its own once the hand stops; stop() lets it die away. Null when sound is off.
export function startScrape() {
  if (muted.value || hushDepth > 0 || !ctx || ctx.state !== "running") return null;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 2200;
  band.Q.value = 0.6;
  const low = ctx.createBiquadFilter();
  low.type = "highpass";
  low.frequency.value = 700;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(band).connect(low).connect(gain).connect(out);
  src.start();
  return {
    set(level) {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0.16 * Math.min(1, 0.25 + level * 0.75) * vary(1, 0.15), now, 0.03);
      gain.gain.setTargetAtTime(0, now + 0.1, 0.06);
    },
    stop() {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0, now, 0.04);
      src.stop(now + 0.3);
      src.onended = () => gain.disconnect();
    },
  };
}

// Rain against the window: a looping hiss whose level follows the weather (0–1). It goes
// quiet while muted, and the loop is only built once there's rain to hear (and audio to hear it in).
let rainLoop = null;
// The last level asked for, so rain set while audio was still locked is heard once it opens
let rainWanted = 0;
export function setRainLevel(level) {
  rainWanted = level;
  const target = muted.value || !ctx || document.hidden ? 0 : level;
  if (!rainLoop && target <= 0.01) return;
  if (!rainLoop) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const high = ctx.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 700;
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 5200;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(high).connect(low).connect(gain).connect(out);
    src.start();
    rainLoop = { src, gain, ctx };
  }
  if (rainLoop.ctx !== ctx) {
    rainLoop = null;
    return setRainLevel(level);
  }
  rainLoop.gain.gain.setTargetAtTime(target * 0.01, ctx.currentTime, 0.6);
}

// The live context and the master bus, for music that should share the sfx chain (the
// compressor and limiter); null until a gesture has created the context
export const audioBus = () => (ctx && out && ctx.state !== "closed" ? { ctx, out, noiseBuffer } : null);

// Run something (e.g. fast-forwarding a timeline) without any of its sounds
export function hush(fn) {
  hushDepth++;
  try {
    return fn();
  } finally {
    hushDepth--;
  }
}

export async function setSoundEnabled(enabled) {
  if (enabled && !(await unlock())) return false;
  muted.value = !enabled;
  try {
    localStorage.setItem(STORAGE_KEY, muted.value ? "1" : "0");
  } catch {
    // The choice still applies for this visit when storage is unavailable.
  }
  return true;
}

export function useSfx() {
  const toggleMute = async () => {
    if (await setSoundEnabled(muted.value)) play("click");
  };
  return { muted, toggleMute };
}
