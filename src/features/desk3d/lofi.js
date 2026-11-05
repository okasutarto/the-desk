// Spotifree's music: lo-fi hip hop synthesized live with WebAudio, so there are no audio
// files to host or license. Each track is a four-chord loop played by a wobbly electric piano,
// a round bass, a swung beat and a sparse lead, all through a dull low-pass so it sounds like
// an old tape. Every track has its own `style`, so they don't all sound alike: its beat
// (kick and snare steps, hats), how the piano plays the chords (held, stabbed or broken into
// an arpeggio), the bass line, the lead's instrument, the swing and the tape's tone.
import { audioBus } from "@/shared/composables/useSfx";

// Chords are [bass root, ...voicing] as MIDI notes; the melody picks from `scale`
export const TRACKS = [
  {
    title: "Late Night Commit",
    artist: "null & the bugs",
    bpm: 76,
    chords: [[41, 53, 57, 60, 64], [40, 52, 55, 59, 62], [38, 50, 53, 57, 60], [36, 48, 52, 55, 59]],
    scale: [72, 74, 76, 79, 81, 84],
    colors: ["#7fb2ff", "#1a1714", "#ffdd00"],
    seed: 3,
    // the classic: held chords, a lazy boom-bap and a bell
    style: { kicks: [0, 7, 10], snares: [4, 12], hats: 2, keys: "held", bass: "root", lead: "bell", density: 0.22, swing: 0.2, tape: 3400 },
  },
  {
    title: "Coffee Over Code",
    artist: "lofi.dev",
    bpm: 84,
    chords: [[38, 50, 53, 57, 60], [43, 53, 55, 59, 64], [36, 52, 55, 59, 62], [45, 52, 55, 57, 60]],
    scale: [74, 76, 79, 81, 84, 86],
    colors: ["#ffb35c", "#1a1714", "#ff90e8"],
    seed: 11,
    // brighter and bouncier: off-beat piano stabs, busy hats, a walking bass and a plucked lead
    style: { kicks: [0, 3, 8, 11], snares: [4, 12], hats: 1, keys: "stabs", bass: "walk", lead: "pluck", density: 0.3, swing: 0.12, tape: 4600 },
  },
  {
    title: "Rainy Deploy",
    artist: "staging & chill",
    bpm: 66,
    chords: [[45, 55, 60, 64, 67], [41, 57, 60, 64, 65], [36, 55, 59, 64, 67], [43, 55, 59, 62, 64]],
    scale: [69, 72, 74, 76, 79, 81],
    colors: ["#00e0c6", "#1a1714", "#fffdf5"],
    seed: 23,
    // slow and hazy: broken-chord piano, a sparse beat with a rim click, a soft flute and rain
    style: { kicks: [0, 10], snares: [12], rim: true, hats: 4, keys: "arp", bass: "long", lead: "flute", density: 0.16, swing: 0.25, tape: 2400, rain: true },
  },
  {
    title: "Merge Conflict",
    artist: "git push --force",
    bpm: 88,
    chords: [[39, 51, 55, 58, 62], [36, 51, 55, 58, 60], [41, 51, 53, 56, 60], [46, 50, 53, 56, 58]],
    scale: [70, 72, 75, 77, 79, 82],
    colors: ["#ff90e8", "#1a1714", "#8fd694"],
    seed: 41,
    // heavier half-time: a double kick, one big snare, chopped piano, pulsing bass, a chip lead
    style: { kicks: [0, 2, 7, 8, 11], snares: [12], ghost: [4], hats: 1, openHat: 14, keys: "chops", bass: "pulse", lead: "chip", density: 0.26, swing: 0.08, tape: 3000 },
  },
];
const BARS = 40;
const STEPS = BARS * 16;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
// Seconds per sixteenth note
const stepLength = (track) => 60 / track.bpm / 4;
export const trackLength = (track) => STEPS * stepLength(track);

// onHit(kind) fires as a kick or snare is heard, so the speakers can move with the music
export function createLofi({ onHit = () => {}, onTrack = () => {} } = {}) {
  let graph = null;
  let index = 0;
  let step = 0;
  let playing = false;
  let nextTime = 0;
  let timer = null;
  let destroyed = false;
  // Music level, turned by the headset's volume dial (0 silent, 0.55 as it ships, 0.9 loudest)
  let volume = 0.55;
  const pending = new Set();

  // Built once per audio context: the music bus, its tape filter, an analyser for the visualizer
  // and a slow pitch wobble shared by the piano voices
  function build() {
    const bus = audioBus();
    if (!bus || destroyed) return null;
    if (graph?.ctx === bus.ctx) return graph;
    const { ctx, out, noiseBuffer } = bus;
    const input = ctx.createGain();
    const tape = ctx.createBiquadFilter();
    tape.type = "lowpass";
    tape.frequency.value = 3400;
    const level = ctx.createGain();
    level.gain.value = volume;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.75;
    input.connect(tape).connect(level).connect(out);
    level.connect(analyser);
    const wobble = ctx.createOscillator();
    wobble.frequency.value = 0.45;
    const wobbleDepth = ctx.createGain();
    wobbleDepth.gain.value = 9; // cents
    wobble.connect(wobbleDepth);
    wobble.start();
    graph = { ctx, input, tape, level, analyser, wobble, wobbleDepth, noiseBuffer, bins: new Uint8Array(analyser.frequencyBinCount) };
    return graph;
  }

  const pendingHits = new Set();

  const voice = (src, gainNode, until, cleanup) => {
    src.start(gainNode.startAt);
    src.stop(until);
    pending.add(src);
    src.onended = () => {
      pending.delete(src);
      src.disconnect();
      cleanup?.();
    };
  };
  function env(g, t, peak, attack, decay) {
    const gain = g.ctx.createGain();
    gain.startAt = t;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return gain;
  }

  // Electric piano: a sine with a soft octave on top, wobbling with the tape
  function keys(g, t, midi, length, peak = 0.045) {
    const gain = env(g, t, peak, 0.012, length);
    const tone = g.ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 1900;
    gain.connect(tone).connect(g.input);
    [[1, 1], [2, 0.22], [3, 0.06]].forEach(([mult, amount]) => {
      const osc = g.ctx.createOscillator();
      osc.frequency.value = hz(midi) * mult;
      g.wobbleDepth.connect(osc.detune);
      const partial = g.ctx.createGain();
      partial.gain.value = amount;
      osc.connect(partial).connect(gain);
      voice(osc, gain, t + length + 0.1, () => g.wobbleDepth.disconnect(osc.detune));
    });
  }
  function bass(g, t, midi, length) {
    while (midi < 36) midi += 12;
    const gain = env(g, t, 0.32, 0.01, length);
    const tone = g.ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 420;
    const osc = g.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = hz(midi);
    osc.connect(tone).connect(gain).connect(g.input);
    voice(osc, gain, t + length + 0.1);
  }
  function bell(g, t, midi) {
    const gain = env(g, t, 0.035, 0.005, 1.1);
    gain.connect(g.input);
    [[1, 1], [4, 0.12]].forEach(([mult, amount]) => {
      const osc = g.ctx.createOscillator();
      osc.frequency.value = hz(midi) * mult;
      const partial = g.ctx.createGain();
      partial.gain.value = amount;
      osc.connect(partial).connect(gain);
      voice(osc, gain, t + 1.2);
    });
  }
  // A plucked string: a filtered sawtooth that dies away fast
  function pluck(g, t, midi) {
    const gain = env(g, t, 0.05, 0.004, 0.35);
    const tone = g.ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.setValueAtTime(2600, t);
    tone.frequency.exponentialRampToValueAtTime(500, t + 0.3);
    const osc = g.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = hz(midi);
    osc.connect(tone).connect(gain).connect(g.input);
    voice(osc, gain, t + 0.45);
  }
  // A breathy flute: a sine that swells in, with a little vibrato and a breath of noise
  function flute(g, t, midi) {
    const gain = env(g, t, 0.04, 0.12, 0.9);
    gain.connect(g.input);
    const osc = g.ctx.createOscillator();
    osc.frequency.value = hz(midi - 12);
    const vib = g.ctx.createOscillator();
    vib.frequency.value = 5;
    const vibDepth = g.ctx.createGain();
    vibDepth.gain.value = 14;
    vib.connect(vibDepth).connect(osc.detune);
    osc.connect(gain);
    voice(osc, gain, t + 1.1);
    voice(vib, gain, t + 1.1);
    hiss(g, t, { type: "bandpass", freq: hz(midi - 12) * 2, q: 4, peak: 0.012, decay: 0.5 });
  }
  // An 8-bit lead: a soft square
  function chip(g, t, midi) {
    const gain = env(g, t, 0.022, 0.004, 0.22);
    const tone = g.ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2400;
    const osc = g.ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = hz(midi);
    osc.connect(tone).connect(gain).connect(g.input);
    voice(osc, gain, t + 0.3);
  }
  const LEADS = { bell, pluck, flute, chip };
  function kick(g, t) {
    const gain = env(g, t, 0.85, 0.004, 0.32);
    const osc = g.ctx.createOscillator();
    osc.frequency.setValueAtTime(115, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.2);
    osc.connect(gain).connect(g.input);
    voice(osc, gain, t + 0.4);
  }
  function hiss(g, t, { type, freq, q = 0.8, peak, decay }) {
    const gain = env(g, t, peak, 0.003, decay);
    const filter = g.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const src = g.ctx.createBufferSource();
    src.buffer = g.noiseBuffer;
    src.connect(filter).connect(gain).connect(g.input);
    gain.startAt = t;
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay + 0.05);
    pending.add(src);
    src.onended = () => {
      pending.delete(src);
      src.disconnect();
    };
  }
  function snare(g, t) {
    hiss(g, t, { type: "bandpass", freq: 1700, q: 0.7, peak: 0.32, decay: 0.2 });
    const gain = env(g, t, 0.18, 0.002, 0.08);
    const osc = g.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 185;
    osc.connect(gain).connect(g.input);
    voice(osc, gain, t + 0.15);
  }

  // The same melody comes back every eight bars: its notes are drawn from a seeded random
  function melodyRand(track, bar, at) {
    let s = (track.seed * 7919 + (bar % 8) * 131 + at * 17) % 2147483647;
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  }
  function scheduleStep(g, track, n, t) {
    const len = stepLength(track);
    const style = track.style;
    const bar = Math.floor(n / 16);
    const s = n % 16;
    const chord = track.chords[bar % track.chords.length];
    // An intro bar of just keys before the beat drops
    const drums = bar > 0 && bar < BARS - 1;
    // Piano
    if (style.keys === "held") {
      if (s === 0) chord.slice(1).forEach((m, i) => keys(g, t + i * 0.012, m, len * 15));
      if (s === 10 && bar % 2 === 1) chord.slice(2).forEach((m) => keys(g, t, m, len * 5, 0.03));
    } else if (style.keys === "stabs") {
      if (s === 0) chord.slice(1).forEach((m, i) => keys(g, t + i * 0.01, m, len * 6, 0.035));
      if (s === 6 || s === 10 || s === 14) chord.slice(2).forEach((m) => keys(g, t, m, len * 1.5, 0.032));
    } else if (style.keys === "arp") {
      if (s % 2 === 0) keys(g, t, chord[1 + ((s / 2) % (chord.length - 1))], len * 6, 0.04);
    } else if (style.keys === "chops") {
      if (s === 0 || s === 3 || s === 6 || s === 11) chord.slice(1).forEach((m) => keys(g, t, m, len * 2, s ? 0.03 : 0.04));
    }
    // Bass
    if (style.bass === "root" && (s === 0 || s === 6 || (s === 10 && bar % 2 === 0))) bass(g, t, chord[0], len * (s === 0 ? 5 : 3));
    if (style.bass === "walk" && s % 4 === 0) bass(g, t, [chord[0], chord[0] + 7, chord[0] + 12, chord[0] + 10][s / 4], len * 3);
    if (style.bass === "long" && (s === 0 || s === 12)) bass(g, t, chord[0], len * (s === 0 ? 11 : 3));
    if (style.bass === "pulse" && s % 2 === 0) bass(g, t, chord[0], len * 1.4);
    // Drums
    if (drums) {
      if (style.kicks.includes(s)) {
        kick(g, t);
        hitAt(g, "kick", t);
      }
      if (style.snares.includes(s)) {
        snare(g, t);
        hitAt(g, "snare", t);
      }
      if (style.ghost?.includes(s)) hiss(g, t, { type: "bandpass", freq: 1900, q: 0.8, peak: 0.08, decay: 0.08 });
      if (style.rim && s === 4) hiss(g, t, { type: "bandpass", freq: 3200, q: 6, peak: 0.2, decay: 0.04 });
      if (s % style.hats === 0) hiss(g, t, { type: "highpass", freq: 7200, peak: s % 4 === 0 ? 0.09 : 0.05, decay: 0.045 });
      if (style.openHat === s) hiss(g, t, { type: "highpass", freq: 6400, peak: 0.07, decay: 0.22 });
    }
    // Rain on the window: a steady wash with a few drops in it
    if (style.rain) {
      if (s === 0) hiss(g, t, { type: "highpass", freq: 2500, peak: 0.02, decay: len * 16 });
      if (melodyRand(track, bar, s + 300) < 0.3) hiss(g, t, { type: "bandpass", freq: 4000 + melodyRand(track, bar, s + 400) * 3000, q: 5, peak: 0.03, decay: 0.02 });
    }
    // Lead
    if (bar >= 2 && s % 2 === 0 && melodyRand(track, bar, s) < style.density) {
      const pick = Math.floor(melodyRand(track, bar, s + 99) * track.scale.length);
      LEADS[style.lead](g, t, track.scale[pick]);
    }
  }
  function hitAt(g, kind, t) {
    const id = setTimeout(() => {
      pendingHits.delete(id);
      if (playing) onHit(kind);
    }, Math.max(0, (t - g.ctx.currentTime) * 1000));
    pendingHits.add(id);
  }

  function pump() {
    const g = graph;
    if (!g || !playing) return;
    const track = TRACKS[index];
    const len = stepLength(track);
    // Fallen far behind (a background tab): skip ahead instead of firing a burst of notes
    if (nextTime < g.ctx.currentTime - 0.2) {
      const missed = Math.ceil((g.ctx.currentTime - nextTime) / len);
      step += missed;
      nextTime += missed * len;
    }
    g.tape.frequency.value = track.style.tape;
    while (nextTime < g.ctx.currentTime + 0.15) {
      if (step >= STEPS) {
        index = (index + 1) % TRACKS.length;
        step = 0;
        onTrack(index);
        return pump();
      }
      // A lazy swing: every other sixteenth lands late
      const swing = step % 2 === 1 ? len * track.style.swing : 0;
      scheduleStep(g, track, step, nextTime + swing);
      step++;
      nextTime += len;
    }
  }

  function stopVoices() {
    pending.forEach((src) => {
      try {
        src.stop();
      } catch {
        // already stopped
      }
    });
    pending.clear();
    pendingHits.forEach(clearTimeout);
    pendingHits.clear();
  }

  function play(at = index) {
    const g = build();
    if (!g) return false;
    if (at !== index) {
      index = at;
      step = 0;
      onTrack(index);
    }
    if (playing) return true;
    playing = true;
    nextTime = g.ctx.currentTime + 0.06;
    pump();
    timer = setInterval(pump, 25);
    return true;
  }
  function pause() {
    if (!playing) return;
    playing = false;
    clearInterval(timer);
    stopVoices();
  }
  // Leaving the desk: the shared audio context outlives the page, so everything is stopped
  // whether or not it's playing, the music is cut from the speakers and nothing restarts it
  function destroy() {
    destroyed = true;
    playing = false;
    clearInterval(timer);
    stopVoices();
    if (graph) {
      graph.level.disconnect();
      try {
        graph.wobble.stop();
      } catch {
        // never started
      }
      graph = null;
    }
  }
  function skip(by) {
    const wasPlaying = playing;
    pause();
    index = (index + by + TRACKS.length) % TRACKS.length;
    step = 0;
    onTrack(index);
    if (wasPlaying) play();
  }

  return {
    play,
    pause,
    toggle: () => (playing ? (pause(), true) : play()),
    next: () => skip(1),
    prev: () => skip(-1),
    // Back to the start of a track, or to the one before when it has only just begun
    restartOrPrev: () => (step > 16 ? skip(0) : skip(-1)),
    get playing() {
      return playing;
    },
    get volume() {
      return volume;
    },
    setVolume(value) {
      volume = Math.min(0.9, Math.max(0, value));
      if (graph) graph.level.gain.setTargetAtTime(volume, graph.ctx.currentTime, 0.05);
      return volume;
    },
    get index() {
      return index;
    },
    // Seconds into the current track
    get elapsed() {
      if (!graph) return 0;
      const len = stepLength(TRACKS[index]);
      return Math.max(0, playing ? step * len - (nextTime - graph.ctx.currentTime) : step * len);
    },
    // 0–1 loudness per frequency band, for the visualizer
    levels(count) {
      if (!graph || !playing) return new Array(count).fill(0);
      graph.analyser.getByteFrequencyData(graph.bins);
      const usable = Math.floor(graph.bins.length * 0.6);
      return Array.from({ length: count }, (_, i) => graph.bins[Math.floor((i / count) * usable)] / 255);
    },
    destroy,
  };
}
