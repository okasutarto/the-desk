// The world outside the window, heard quietly under everything else: the lake lapping at its
// shore, the trees' leaves rustling as each gust in the view sweeps through them and, with the
// window open, a soft breath of wind blowing in with each gust, as steady beds, and birds, crickets, drips on the glass and thunder as events scattered at
// random. Only what the window shows: there's no town or road out there. All synthesized on
// the sfx chain (no audio files). The rain's own hiss lives in useSfx (setRainLevel); this
// adds what goes with it.
//
// Kept free of three.js and the scene, so the mix can be checked on its own.
import { audioBus } from "@/shared/composables/useSfx";

// How much of each bed, by the part of the day (0–1, scaled by BED_PEAK)
const BEDS = {
  morning: { lake: 0.6, leaves: 0.5, wind: 0.6 },
  day: { lake: 0.5, leaves: 0.8, wind: 1 },
  evening: { lake: 0.55, leaves: 0.6, wind: 0.7 },
  night: { lake: 0.5, leaves: 0.35, wind: 0.45 },
};
// How often each event comes, per minute, by the part of the day (on a dry day)
const RATES = {
  morning: { birds: 9, crickets: 0 },
  day: { birds: 3, crickets: 0 },
  evening: { birds: 1, crickets: 10 },
  night: { birds: 0, crickets: 30 },
};
// The loudest each bed gets on the sfx bus. For scale: full rain is 0.01.
// The leaves and the wind are kept soft: with the open window's boost, a full gust through the
// trees or blowing in still sits under the rain's hiss and the lake. The wind only blows in
// through the open window.
export const BED_PEAK = { lake: 0.01, leaves: 0.0035, wind: 0.003 };
// Rain at or above this brings thunder: a real thunderstorm (0.9, or 1 with hail) or the rain
// knocked up at the window (0.9), but not the settings' plain "Rain" (0.8) or real rain, however
// heavy (0.8 at most; see rainForCode)
export const STORM_RAIN = 0.85;
// While the lofi plays, the world outside steps back this far
export const UNDER_MUSIC = 0.35;
// How quiet the leaves are between gusts, against their full rustle as one sweeps through
export const LEAVES_STILL = 0.25;
// And the wind through the open window between gusts
export const WIND_STILL = 0.3;
// How often the lake laps at the shore (per second, slowest to quickest): one every five to
// eight seconds, a calm lake's slow swell rather than a chop
export const LAP_PACE = [0.125, 0.2];

/**
 * What the outside should sound like right now.
 * @param {{ part: string, rain?: number, gust?: number, windowOpen?: boolean, music?: boolean, on?: boolean, muted?: boolean, hidden?: boolean }} state
 *   gust is how far the view's gust is through the trees right now (0–1)
 * @returns {{ level: number, open: number, lake: number, leaves: number, wind: number, rates: Record<string, number> }}
 *   level is the whole ambience (0 silent), open 1 with the window open; lake, leaves and
 *   wind (none with the window shut) are bed gains (the leaves' already following the gust); rates are events per minute
 */
export function ambienceMix({ part, rain = 0, gust = 0, windowOpen = false, music = false, on = true, muted = false, hidden = false }) {
  const bed = BEDS[part] ?? BEDS.day;
  const rate = RATES[part] ?? RATES.day;
  // Birds and crickets go quiet as the rain sets in, and are gone in a downpour
  const dry = Math.max(0, 1 - rain * 1.6);
  return {
    level: !on || muted || hidden ? 0 : music ? UNDER_MUSIC : 1,
    open: windowOpen ? 1 : 0,
    // the rain's hiss drowns the lake's lapping; wet leaves rustle a little louder
    lake: BED_PEAK.lake * bed.lake * (1 - rain * 0.6),
    leaves: BED_PEAK.leaves * bed.leaves * (1 + rain * 0.3) * (LEAVES_STILL + (1 - LEAVES_STILL) * Math.min(1, Math.max(0, gust))),
    wind: windowOpen ? BED_PEAK.wind * bed.wind * (1 + rain * 0.3) * (WIND_STILL + (1 - WIND_STILL) * Math.min(1, Math.max(0, gust))) : 0,
    rates: {
      birds: rate.birds * dry,
      crickets: rate.crickets * dry,
      drips: rain > 0.2 ? rain * 70 : 0,
      // a storm with hail rolls in about three times as often as one just over the line
      thunder: rain >= STORM_RAIN ? 1 + (rain - STORM_RAIN) * 15 : 0,
    },
  };
}

// The wait until the next event at `perMinute`, in seconds: random (exponential), so the
// events don't fall into a pattern, but never bunched closer than a second
export const nextGap = (perMinute, random = Math.random()) => Math.max(1, (-Math.log(1 - random) * 60) / perMinute);

// How much of the view's gust is in the trees at time `t` (the view's own clock, seconds): the
// window paints a gust sweeping in from the left every `every` seconds (its front from −0.4 to
// 1.4 across the view), so the leaves rise as it reaches the trees, peak as it crosses them
// and fall away behind it (0–1)
export function gustInTrees(t, every) {
  const front = ((t / every) % 1) * 1.8 - 0.4;
  const across = (front + 0.1) / 1.4;
  return across > 0 && across < 1 ? Math.sin(Math.PI * across) ** 1.5 : 0;
}

// How bright a lightning flash is, `ms` after it struck: a flash, a dip, a second flash, then
// a quick fade (0–1)
export function lightningFlash(ms) {
  if (!(ms >= 0)) return 0;
  if (ms < 70) return 1;
  if (ms < 140) return 0.15;
  if (ms < 230) return 0.8;
  const fade = 0.8 * Math.exp(-(ms - 230) / 180);
  return fade < 0.01 ? 0 : fade;
}

// The glass muffles the world: its top end is turned down this far (dB) with the window shut
const GLASS_DB = -14;
// How quickly the beds follow a change (seconds to ~63%)
const GLIDE = 1.5;

/**
 * @param {{ onLightning?: () => void }} [hooks] onLightning fires on each flash, before its
 *   thunder rolls in
 */
export function createAmbience({ onLightning = () => {} } = {}) {
  let graph = null;
  let destroyed = false;
  let heard = "";
  let mix = null;
  const due = {};
  const voices = new Set();
  // Up to three crickets in the chorus, each singing at its own pitch and pace
  const crickets = [4300, 4650, 4950].map((freq) => ({ freq: freq * (0.98 + Math.random() * 0.04), pulses: 3 + Math.floor(Math.random() * 3) }));
  // The leaves' level last asked for, so it's only set again when it has moved
  let leavesAt = -1;
  let windAt = -1;

  // Brown noise, four seconds of it so the beds' loop can't be heard turning over
  function brownBuffer(ctx) {
    const length = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    // ease the seam so the loop doesn't click
    for (let i = 0; i < 2048; i++) data[length - 1 - i] *= i / 2048;
    return buffer;
  }

  // Leaves rustling: a soft "sssh", the noise's harsh top rounded off, swelling and easing
  // gently every few hundredths of a second as the crowns stir (never sharp enough to tick or
  // crackle), four seconds of it for the same reason
  function rustleBuffer(ctx) {
    const length = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const ease = Math.min(1, 1 / (ctx.sampleRate * 0.015));
    let [level, target, soft, next] = [0.75, 0.75, 0, 0];
    for (let i = 0; i < length; i++) {
      if (i >= next) {
        next = i + ctx.sampleRate * (0.04 + Math.random() * 0.05);
        target = 0.55 + Math.random() * 0.45;
      }
      level += (target - level) * ease;
      soft += ((Math.random() * 2 - 1) - soft) * 0.6;
      data[i] = soft * level;
    }
    for (let i = 0; i < 2048; i++) data[length - 1 - i] *= i / 2048;
    return buffer;
  }

  function loop(g, buffer, filterType, freq, q = 0.7) {
    const src = g.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = g.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = g.ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(g.glass);
    src.start(0, Math.random() * 3);
    return { src, filter, gain };
  }

  // The lake lapping at the shore: low, soft water noise, each little wave swelling in and
  // drawing back (a slow wave on its level, one lap every five to eight seconds, its pace
  // drifting so the laps never quite repeat)
  function lakeBed(g) {
    const bed = loop(g, g.brown, "bandpass", 460, 0.6);
    const lap = g.ctx.createGain();
    lap.gain.value = 0.55;
    bed.filter.disconnect();
    bed.filter.connect(lap).connect(bed.gain);
    const waves = g.ctx.createOscillator();
    waves.frequency.value = LAP_PACE[0];
    const depth = g.ctx.createGain();
    depth.gain.value = 0.45;
    waves.connect(depth).connect(lap.gain);
    waves.start(0);
    return { ...bed, lap, waves, depth };
  }

  // Built once per audio context: a master level, the glass the outside is heard through, and
  // the beds running silently until they're wanted
  function build() {
    const bus = audioBus();
    if (!bus || destroyed) return null;
    if (graph?.ctx === bus.ctx) return graph;
    const { ctx, out, noiseBuffer } = bus;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(out);
    const glass = ctx.createBiquadFilter();
    glass.type = "highshelf";
    glass.frequency.value = 1200;
    glass.gain.value = GLASS_DB;
    const outside = ctx.createGain();
    glass.connect(outside).connect(master);
    graph = { ctx, master, glass, outside, noiseBuffer, brown: brownBuffer(ctx), rustle: rustleBuffer(ctx) };
    graph.lake = lakeBed(graph);
    // (airy, so the shut glass takes most of it and the open window lets it in, but not so high
    // that it hisses)
    graph.leaves = loop(graph, graph.rustle, "bandpass", 2400, 0.4);
    // a low, soft whoosh, brightening as a gust blows in
    graph.wind = loop(graph, graph.brown, "lowpass", 380);
    [leavesAt, windAt] = [-1, -1];
    heard = "";
    Object.keys(due).forEach((kind) => delete due[kind]);
    return graph;
  }

  // ---------- one-off sounds ----------
  function voice(g, src, stopAt, nodes) {
    voices.add(src);
    src.onended = () => {
      voices.delete(src);
      nodes.forEach((node) => node.disconnect());
    };
    src.stop(stopAt);
  }
  // A gain node that rises to `peak` and dies away (exponential, so it never clicks)
  function swell(g, t, peak, attack, decay) {
    const gain = g.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return gain;
  }
  // Somewhere to the left or right; plain stereo where panning isn't supported
  function placed(g, node, pan) {
    if (!g.ctx.createStereoPanner) {
      node.connect(g.glass);
      return node;
    }
    const panner = g.ctx.createStereoPanner();
    panner.pan.value = pan;
    node.connect(panner).connect(g.glass);
    return panner;
  }

  // A bird's song: two to five quick whistles sliding up or down, now and then a trill
  function bird(g, t) {
    const base = 2200 + Math.random() * 2000;
    const trill = Math.random() < 0.25;
    const notes = trill ? 6 + Math.floor(Math.random() * 4) : 2 + Math.floor(Math.random() * 4);
    const pan = Math.random() * 1.4 - 0.7;
    const peak = 0.008 + Math.random() * 0.01;
    let at = t;
    for (let i = 0; i < notes; i++) {
      const length = trill ? 0.035 : 0.05 + Math.random() * 0.09;
      const osc = g.ctx.createOscillator();
      const from = base * (0.85 + Math.random() * 0.3);
      osc.frequency.setValueAtTime(from, at);
      osc.frequency.exponentialRampToValueAtTime(from * (Math.random() < 0.6 ? 1.35 : 0.75), at + length);
      const gain = swell(g, at, peak, 0.008, length);
      const end = placed(g, osc.connect(gain), pan);
      osc.start(at);
      voice(g, osc, at + length + 0.05, [osc, gain, end]);
      at += length + (trill ? 0.02 : 0.04 + Math.random() * 0.08);
    }
  }

  // A cricket's chirp: a few pulses of one high note
  function cricket(g, t) {
    const one = crickets[Math.floor(Math.random() * crickets.length)];
    const osc = g.ctx.createOscillator();
    osc.frequency.value = one.freq;
    const gain = g.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    const pulse = 0.028;
    for (let i = 0; i < one.pulses; i++) {
      const at = t + i * pulse * 1.8;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.004, at + pulse * 0.3);
      gain.gain.linearRampToValueAtTime(0, at + pulse);
    }
    const end = placed(g, osc.connect(gain), one.freq > 4600 ? 0.5 : -0.4);
    osc.start(t);
    voice(g, osc, t + one.pulses * pulse * 1.8 + 0.05, [osc, gain, end]);
  }

  // A drop landing on the pane: on the glass itself, so not muffled by it
  function drip(g, t) {
    const src = g.ctx.createBufferSource();
    src.buffer = g.noiseBuffer;
    const filter = g.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2500 + Math.random() * 2500;
    filter.Q.value = 4;
    const gain = swell(g, t, 0.006 + Math.random() * 0.008, 0.001, 0.012 + Math.random() * 0.01);
    src.connect(filter).connect(gain).connect(g.master);
    src.start(t, Math.random() * 0.5);
    voice(g, src, t + 0.06, [src, filter, gain]);
  }

  // Lightning, then (a second or two later, as the storm is a few kilometres off) a crackle and
  // a long low roll
  function thunder(g, t) {
    onLightning();
    const at = t + 0.6 + Math.random() * 1.9;
    const length = 3 + Math.random() * 2;
    const src = g.ctx.createBufferSource();
    src.buffer = g.brown;
    const filter = g.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(260, at);
    filter.frequency.exponentialRampToValueAtTime(60, at + length);
    const gain = swell(g, at, 0.07 + Math.random() * 0.03, 0.25, length);
    src.connect(filter).connect(gain).connect(g.glass);
    src.start(at, Math.random() * 1.5);
    voice(g, src, at + length + 0.3, [src, filter, gain]);
    for (let i = 0; i < 3; i++) {
      const crack = at + Math.random() * 0.5;
      const noise = g.ctx.createBufferSource();
      noise.buffer = g.noiseBuffer;
      const band = g.ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 500 + Math.random() * 500;
      const burst = swell(g, crack, 0.02, 0.01, 0.25);
      noise.connect(band).connect(burst).connect(g.glass);
      noise.start(crack, Math.random() * 0.5);
      voice(g, noise, crack + 0.35, [noise, band, burst]);
    }
  }

  const EVENTS = { birds: bird, crickets: cricket, drips: drip, thunder };

  /**
   * Called every frame (or so) with the room as it is. Cheap when nothing has changed.
   * @param {Parameters<typeof ambienceMix>[0]} state
   */
  function update(state) {
    if (destroyed) return;
    mix = ambienceMix(state);
    // Nothing is built until there's something to hear (and a gesture has unlocked audio)
    if (!graph && mix.level === 0) return;
    const g = build();
    if (!g || g.ctx.state !== "running") return;
    const now = g.ctx.currentTime;
    const key = [mix.level, mix.open, mix.lake.toFixed(4)].join();
    if (key !== heard) {
      heard = key;
      g.master.gain.setTargetAtTime(mix.level, now, mix.level ? GLIDE : 0.3);
      g.glass.gain.setTargetAtTime(mix.open ? 0 : GLASS_DB, now, 0.4);
      g.outside.gain.setTargetAtTime(mix.open ? 2.2 : 1, now, 0.4);
      g.lake.gain.gain.setTargetAtTime(mix.lake, now, GLIDE);
    }
    // The leaves follow the gust in the view closely, so the rustle sweeps by with it
    if (Math.abs(mix.leaves - leavesAt) > BED_PEAK.leaves * 0.02) {
      leavesAt = mix.leaves;
      g.leaves.gain.gain.setTargetAtTime(mix.leaves, now, 0.25);
    }
    // So does the wind through the open window, a little slower, so it breathes in and out
    if (Math.abs(mix.wind - windAt) > BED_PEAK.wind * 0.02) {
      windAt = mix.wind;
      g.wind.gain.gain.setTargetAtTime(mix.wind, now, 0.4);
      g.wind.filter.frequency.setTargetAtTime(320 + 480 * Math.min(1, Math.max(0, state.gust ?? 0)), now, 0.4);
    }
    // The lake's laps drift in pace from one to the next, so they never settle into a beat
    if (now >= (due.waves ?? 0)) {
      due.waves = now + 4 + Math.random() * 4;
      g.lake.waves.frequency.setTargetAtTime(LAP_PACE[0] + Math.random() * (LAP_PACE[1] - LAP_PACE[0]), now, 3);
    }
    if (mix.level === 0) return;
    Object.entries(mix.rates).forEach(([kind, perMinute]) => {
      if (!perMinute) return void delete due[kind];
      // the first of each comes after a natural pause, not the moment it's allowed
      if (due[kind] === undefined) due[kind] = now + nextGap(perMinute);
      if (now < due[kind]) return;
      due[kind] = now + nextGap(perMinute);
      EVENTS[kind](g, now + 0.05, state.rain ?? 0);
    });
  }

  // Straight to silence (the tab hidden, say): no frames come to fade it while it's away
  function hush() {
    if (graph && graph.ctx.state !== "closed") {
      graph.master.gain.setTargetAtTime(0, graph.ctx.currentTime, 0.15);
      heard = "";
    }
  }

  function destroy() {
    destroyed = true;
    voices.forEach((src) => {
      try {
        src.stop();
      } catch {
        // already stopped
      }
    });
    voices.clear();
    if (graph && graph.ctx.state !== "closed") {
      const { master, lake, leaves, wind } = graph;
      master.gain.setTargetAtTime(0, graph.ctx.currentTime, 0.1);
      // once the beds have faded out, the whole graph comes off the bus
      lake.src.onended = () => master.disconnect();
      [lake.src, lake.waves, leaves.src, wind.src].forEach((src) => src.stop(graph.ctx.currentTime + 0.5));
    }
    graph = null;
  }

  return {
    update,
    hush,
    destroy,
    get mix() { return mix; },
  };
}
