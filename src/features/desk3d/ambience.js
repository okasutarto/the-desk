// The world outside the window, heard quietly under everything else: wind and the far-off town
// as steady beds, and birds, crickets, passing cars, drips on the glass and thunder as events
// scattered at random. All synthesized on the sfx chain (no audio files). The rain's own hiss
// lives in useSfx (setRainLevel); this adds what goes with it.
//
// Kept free of three.js and the scene, so the mix can be checked on its own.
import { audioBus } from "@/shared/composables/useSfx";

// How much of each bed, by the part of the day (0–1, scaled by BED_PEAK)
const BEDS = {
  morning: { wind: 0.45, town: 0.2 },
  day: { wind: 0.75, town: 0.35 },
  evening: { wind: 0.5, town: 0.6 },
  night: { wind: 0.25, town: 0.45 },
};
// How often each event comes, per minute, by the part of the day (on a dry day)
const RATES = {
  morning: { birds: 9, crickets: 0, cars: 1.5 },
  day: { birds: 3, crickets: 0, cars: 2 },
  evening: { birds: 1, crickets: 10, cars: 2.5 },
  night: { birds: 0, crickets: 30, cars: 1 },
};
// The loudest each bed gets on the sfx bus. For scale: full rain is 0.01.
export const BED_PEAK = { wind: 0.016, town: 0.012 };
// Rain at or above this brings thunder: a real storm (1) or the rain knocked up at the window
// (0.9), but not the settings' plain "Rain" (0.8) or a real shower (0.7)
export const STORM_RAIN = 0.85;
// While the lofi plays, the world outside steps back this far
export const UNDER_MUSIC = 0.35;

/**
 * What the outside should sound like right now.
 * @param {{ part: string, rain?: number, windowOpen?: boolean, music?: boolean, on?: boolean, muted?: boolean, hidden?: boolean }} state
 * @returns {{ level: number, open: number, wind: number, town: number, rates: Record<string, number> }}
 *   level is the whole ambience (0 silent), open 1 with the window open; wind and town are
 *   bed gains; rates are events per minute
 */
export function ambienceMix({ part, rain = 0, windowOpen = false, music = false, on = true, muted = false, hidden = false }) {
  const bed = BEDS[part] ?? BEDS.day;
  const rate = RATES[part] ?? RATES.day;
  // Birds and crickets go quiet as the rain sets in, and are gone in a downpour
  const dry = Math.max(0, 1 - rain * 1.6);
  return {
    level: !on || muted || hidden ? 0 : music ? UNDER_MUSIC : 1,
    open: windowOpen ? 1 : 0,
    wind: BED_PEAK.wind * bed.wind * (1 + rain * 0.4),
    town: BED_PEAK.town * bed.town * (1 - rain * 0.6),
    rates: {
      birds: rate.birds * dry,
      crickets: rate.crickets * dry,
      // fewer cars in the rain, but each one hisses on the wet road
      cars: rate.cars * (1 - rain * 0.3),
      drips: rain > 0.2 ? rain * 70 : 0,
      thunder: rain >= STORM_RAIN ? 1.5 : 0,
    },
  };
}

// The wait until the next event at `perMinute`, in seconds: random (exponential), so the
// events don't fall into a pattern, but never bunched closer than a second
export const nextGap = (perMinute, random = Math.random()) => Math.max(1, (-Math.log(1 - random) * 60) / perMinute);

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
  let gust = 0.5;

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

  // Built once per audio context: a master level, the glass the outside is heard through, and
  // the two beds running silently until they're wanted
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
    graph = { ctx, master, glass, outside, noiseBuffer, brown: brownBuffer(ctx) };
    graph.wind = loop(graph, graph.brown, "lowpass", 520);
    graph.town = loop(graph, graph.brown, "lowpass", 170);
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

  // A car going by down the road, left to right or back: a rumble that swells and fades, its
  // tyres hissing on a wet road
  function car(g, t, wet) {
    const length = 4 + Math.random() * 3;
    const src = g.ctx.createBufferSource();
    src.buffer = g.brown;
    const filter = g.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(220, t);
    filter.frequency.linearRampToValueAtTime(700 + wet * 900, t + length * 0.5);
    filter.frequency.linearRampToValueAtTime(220, t + length);
    const gain = g.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.014, t + length * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    src.connect(filter).connect(gain);
    let end = gain;
    if (g.ctx.createStereoPanner) {
      const way = Math.random() < 0.5 ? -1 : 1;
      end = g.ctx.createStereoPanner();
      end.pan.setValueAtTime(-0.8 * way, t);
      end.pan.linearRampToValueAtTime(0.8 * way, t + length);
      gain.connect(end);
    }
    end.connect(g.glass);
    src.start(t, Math.random() * 3);
    voice(g, src, t + length + 0.05, [src, filter, gain, end]);
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

  const EVENTS = { birds: bird, crickets: cricket, cars: car, drips: drip, thunder };

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
    const key = [mix.level, mix.open, mix.wind.toFixed(4), mix.town.toFixed(4)].join();
    if (key !== heard) {
      heard = key;
      g.master.gain.setTargetAtTime(mix.level, now, mix.level ? GLIDE : 0.3);
      g.glass.gain.setTargetAtTime(mix.open ? 0 : GLASS_DB, now, 0.4);
      g.outside.gain.setTargetAtTime(mix.open ? 2.2 : 1, now, 0.4);
      g.town.gain.gain.setTargetAtTime(mix.town, now, GLIDE);
    }
    // The wind wanders: a gust builds and dies every few seconds
    if (now >= (due.gust ?? 0)) {
      due.gust = now + 1.5 + Math.random() * 2.5;
      gust = Math.min(1, Math.max(0.2, gust + (Math.random() - 0.5) * 0.6));
      g.wind.gain.gain.setTargetAtTime(mix.wind * gust, now, 1.2);
      g.wind.filter.frequency.setTargetAtTime(380 + gust * 420, now, 1.2);
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
      const { master, wind, town } = graph;
      master.gain.setTargetAtTime(0, graph.ctx.currentTime, 0.1);
      // once the beds have faded out, the whole graph comes off the bus
      wind.src.onended = () => master.disconnect();
      [wind, town].forEach((bed) => bed.src.stop(graph.ctx.currentTime + 0.5));
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
