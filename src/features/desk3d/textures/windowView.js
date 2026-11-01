// ---------- the view out of the window: an animated neo-brutalist landscape ----------
// Flat colours, thick black outlines and hard offset shadows. `t` is seconds; the scene loops
// on its own (clouds, birds, ripples, swaying trees, a bobbing boat). Night swaps the sun for a
// moon, adds twinkling stars and fireflies. `flockAt` / `starAt` (seconds, same clock) start a
// flock of birds or a shooting star.
const VIEW_STARS = Array.from({ length: 38 }, (_, i) => {
  const r = (n) => (Math.sin(i * 127.1 + n * 311.7) * 43758.5453) % 1;
  return { x: Math.abs(r(1)), y: Math.abs(r(2)) * 0.5, s: 0.6 + Math.abs(r(3)) * 0.8, p: Math.abs(r(4)) * 6 };
});
const VIEW_FLIES = Array.from({ length: 14 }, (_, i) => ({ x: (i * 0.137 + 0.05) % 1, y: 0.8 + ((i * 0.071) % 0.17), p: i * 1.7 }));

// A colour part-way to another (both "#rrggbb")
function mixHex(a, b, k) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift) => Math.round(((pa >> shift) & 255) * (1 - k) + ((pb >> shift) & 255) * k);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}
// Grass tufts on the near shore: where each stands (0–1 across, 0–1 down the bank) and how tall
const GRASS_TUFTS = Array.from({ length: 30 }, (_, i) => ({ x: (i * 0.6180339 + 0.03) % 1, y: (i * 0.3819 + 0.12) % 1, s: 0.7 + ((i * 0.7071) % 1) * 0.6 }));
// A snapshot of the view, for the raindrops on the glass to refract
let glassCopy = null;
// Raindrops stuck to the glass: where each sits, how big, and how fast it slides
const GLASS_DROPS = Array.from({ length: 22 }, (_, i) => ({ x: (i * 0.383 + 0.07) % 1, y: (i * 0.617) % 1, r: 1.1 + ((i * 0.29) % 1) * 1.5, v: 0.004 + ((i * 0.53) % 1) * 0.02 }));
// Fine beads of water stuck to the glass between the drops
const GLASS_BEADS = Array.from({ length: 70 }, (_, i) => ({ x: (i * 0.6180339 + 0.11) % 1, y: (i * 0.4142 + 0.37) % 1, r: 0.2 + ((i * 0.7071) % 1) * 0.3 }));
// Sample smooth, asymmetric ridgelines once; only the painted projection changes each frame.
const ridgeline = (points, rough) => Array.from({ length: 161 }, (_, i) => {
  const x = i / 160;
  let j = 0;
  while (j < points.length - 2 && x > points[j + 1][0]) j++;
  const p0 = points[Math.max(0, j - 1)];
  const p1 = points[j];
  const p2 = points[j + 1];
  const p3 = points[Math.min(points.length - 1, j + 2)];
  const t = (x - p1[0]) / (p2[0] - p1[0]);
  const span = p2[0] - p1[0];
  const m1 = (p2[1] - p0[1]) / (p2[0] - p0[0]) * span;
  const m2 = (p3[1] - p1[1]) / (p3[0] - p1[0]) * span;
  const y = (2 * t ** 3 - 3 * t ** 2 + 1) * p1[1] + (t ** 3 - 2 * t ** 2 + t) * m1
    + (-2 * t ** 3 + 3 * t ** 2) * p2[1] + (t ** 3 - t ** 2) * m2;
  return [x, y + rough * (Math.sin(x * 73) * 0.6 + Math.sin(x * 137 + 2) * 0.4)];
});
const FAR_RIDGE = ridgeline([
  [0, 0.42], [0.08, 0.37], [0.2, 0.41], [0.36, 0.3], [0.52, 0.4],
  [0.68, 0.31], [0.86, 0.39], [1, 0.34],
], 0.0015);
const RIDGE = ridgeline([
  [0, 0.46], [0.075, 0.395], [0.14, 0.34], [0.2, 0.395], [0.3, 0.5],
  [0.38, 0.445], [0.45, 0.38], [0.52, 0.435], [0.62, 0.52],
  [0.72, 0.415], [0.8, 0.36], [0.88, 0.405], [1, 0.48],
], 0.002);
// Where along the ridge the three peaks top out
const RIDGE_PEAKS = [0.14, 0.45, 0.8].map((px) => {
  let i = Math.round(px * (RIDGE.length - 1));
  while (i > 0 && RIDGE[i - 1][1] < RIDGE[i][1]) i--;
  while (i < RIDGE.length - 1 && RIDGE[i + 1][1] < RIDGE[i][1]) i++;
  return i;
});
// Leafy lumps making up a round tree's crown ([x, y, size] in crown radii), and a cloud's puffs
const CROWN = [[-0.78, 0.42, 0.48], [0.74, 0.46, 0.46], [-0.08, 0.56, 0.54], [-0.58, -0.18, 0.62], [0.52, -0.16, 0.66], [-0.12, -0.72, 0.68], [0.36, -1.02, 0.42]];
const PUFFS = [[-0.62, 0.06, 0.36], [-0.28, -0.16, 0.5], [0.16, -0.26, 0.6], [0.56, -0.04, 0.44], [0.86, 0.1, 0.28]];
// The sky through the day: top band, middle, horizon; the sun's height, colour and side
const SKIES = {
  morning: { sky: ["#ffb98a", "#ffd4a8", "#fff0d6"], sun: [0.32, 0.30, "#ffcf5c"], cloud: "#fff3e3" },
  day: { sky: ["#7fdfff", "#a8ecff", "#cdf6ff"], sun: [0.5, 0.10, "#ffdd00"], cloud: "#ffffff" },
  evening: { sky: ["#493e77", "#b36b83", "#e29b6a"], sun: [0.7, 0.44, "#ff7a1a"], cloud: "#bba8bc" },
  night: { sky: ["#1e2a5a", "#26356b", "#30437f"], sun: [0.66, 0.19, "#fffdf5"], cloud: "#55638f" },
};

// Shared by the painted sky and the room's window light, including interrupted transitions.
export function windowSky(time, from = SKIES[time], blend = 1) {
  const to = SKIES[time];
  return {
    sky: to.sky.map((color, i) => mixHex(from.sky[i], color, blend)),
    sun: [0, 1].map((i) => from.sun[i] + (to.sun[i] - from.sun[i]) * blend).concat(mixHex(from.sun[2], to.sun[2], blend)),
    cloud: mixHex(from.cloud, to.cloud, blend),
    night: (from.night ?? (from === SKIES.night ? 1 : 0)) * (1 - blend) + (time === "night" ? blend : 0),
  };
}

// `time` is the part of the day outside (morning, day, evening, night), `rain` 0–1, `glass` how
// much of the glass is still in front of the view (0 once the leaves have swung wide open)
export function drawWindowView(c, w, h, { t = 0, time = "day", rain = 0, glass = 1, flockAt = -99, starAt = -99, skyFrom, skyBlend = 1 } = {}) {
  const look = windowSky(time, skyFrom, skyBlend);
  const dark = look.night >= 0.5;
  // Rain greys everything over: a real shower (0.7) is already a dull, overcast sky
  const grey = (color) => mixHex(color, dark ? "#2a2f45" : "#8d97a8", Math.min(1, rain * 1.25) * 0.65);
  // detail sized by the shorter side, so a wider pane shows more landscape, not bigger trees
  const u = Math.min(w, h) / 100;
  const line = Math.max(3, u * 0.7);
  c.lineJoin = "round";
  c.lineCap = "round";
  const stroke = (width = line, color = "#000") => {
    c.lineWidth = width;
    c.strokeStyle = color;
    c.stroke();
  };
  // A closed curve run smoothly through points (Catmull-Rom as beziers)
  const closedCurve = (pts) => {
    const n = pts.length;
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < n; i++) {
      const [p0, p1, p2, p3] = [pts[(i + n - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]];
      c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
  };
  // One part of a blob: a circle `[x, y, r]`, a rect `[x, y, 0, rw, rh]`, or an organic lump
  // `{ x, y, r, sy, seed, wob }` whose edge swells and dips a little all the way round (`sy`
  // squashes it), so a cluster of them reads drawn by hand rather than with compasses
  const partPath = (p, dx, dy, grow, scale = 1) => {
    if (!Array.isArray(p)) {
      const { x, y, r, sy = 1, seed = 0, wob = 0.1 } = p;
      const pts = [];
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2 + seed;
        const m = r * scale * (1 + wob * (Math.sin(seed * 3.1 + k * 2.3) * 0.6 + Math.sin(seed * 1.7 + k * 4.1) * 0.4));
        pts.push([x + dx + Math.cos(a) * (m + grow), y + dy + Math.sin(a) * (m * sy + grow)]);
      }
      closedCurve(pts);
      return;
    }
    const [x, y, r, rw, rh] = p;
    if (rw) c.rect(x + dx - grow, y + dy - grow, rw + grow * 2, rh + grow * 2);
    else {
      c.moveTo(x + dx + r * scale + grow, y + dy);
      c.arc(x + dx, y + dy, r * scale + grow, 0, Math.PI * 2);
    }
  };
  // A union of parts with one clean outline and a hard shadow: drawn three times, shadow, then
  // grown by the line width in black, then the fill on top
  const blob = (parts, fill, shadow = line * 1.4) => {
    [[shadow, shadow, 0, "#000"], [0, 0, line, "#000"], [0, 0, 0, fill]].forEach(([dx, dy, grow, color]) => {
      if (color === "#000" && dx && !shadow) return;
      c.fillStyle = color;
      c.beginPath();
      parts.forEach((p) => partPath(p, dx, dy, grow));
      c.fill();
    });
  };
  const wrapX = (x, margin) => ((x % (w + margin * 2)) + w + margin * 2) % (w + margin * 2) - margin;
  // Painted like a background plate: the sun (or moon) picks a side, every form gets a lit face
  // toward it and a cool shade face away from it, and shadows fall the other way
  const lightSide = look.sun[0] < 0.5 ? -1 : 1;
  const SHADE = dark ? "#0b1030" : time === "evening" ? "#3a1f5c" : "#3b3a7a";
  const shade = (color, k = 0.3) => mixHex(color, SHADE, k);
  const glow = (color, k = 0.3) => mixHex(color, dark ? "#c9d4ff" : time === "evening" ? "#ffc58f" : "#fffdf5", k);
  // Wind instead of every stalk on its own metronome: a light breeze rolling across the view,
  // and every few seconds a gust sweeping in from the left. Each thing leans as the gust reaches
  // it, then springs back past upright and settles; `lag` lets a crown trail its trunk.
  const GUST_EVERY = 7;
  const gustFront = ((t / GUST_EVERY) % 1) * 1.8 - 0.4;
  const wind = (x, lag = 0) => {
    const tt = t - lag;
    const breeze = Math.sin(tt * 1.3 - x * 4) * 0.25 + Math.sin(tt * 2.9 - x * 9) * 0.08;
    const behind = ((tt / GUST_EVERY) % 1) * 1.8 - 0.4 - x;
    const gust = behind > 0 ? (1 - Math.exp(-behind * 40)) * Math.exp(-behind * 5) * Math.cos(behind * 14) : 0;
    return (breeze + gust * 1.1) * (1 + rain * 0.8);
  };
  const lumps = (parts, dx = 0, dy = 0, scale = 1) => {
    c.beginPath();
    parts.forEach((p) => partPath(p, dx, dy, 0, scale));
  };
  // A blob in two tones: its own colour where the light reaches, shade in the crescent beneath
  // and away from the sun, and a small sheen on the bigger lumps facing it
  const celBlob = (parts, color, size, shadow) => {
    blob(parts, color, shadow);
    c.save();
    lumps(parts);
    c.clip();
    c.fillStyle = shade(color, 0.28);
    c.fillRect(-w * 2, -h * 2, w * 4, h * 4);
    lumps(parts, lightSide * size * 0.12, -size * 0.16, 0.96);
    c.fillStyle = color;
    c.fill();
    c.beginPath();
    parts.forEach((p) => {
      const { x, y, r, rw, sy = 1 } = Array.isArray(p) ? { x: p[0], y: p[1], r: p[2], rw: p[3] } : p;
      if (rw || r < size * 0.45) return;
      const hx = x + lightSide * r * 0.38;
      const hy = y - r * sy * 0.45;
      c.moveTo(hx + Math.cos(0.25) * r * 0.22, hy + lightSide * Math.sin(0.25) * r * 0.22);
      c.ellipse(hx, hy, r * 0.22, r * 0.12 * sy, lightSide * 0.25, 0, Math.PI * 2);
    });
    c.fillStyle = glow(color, 0.4);
    c.fill();
    c.restore();
  };

  // Sky in one smooth sweep, from a deeper zenith down to the light at the horizon (the hills
  // cover it from halfway down)
  const SKY = look.sky.map(grey);
  const sweep = c.createLinearGradient(0, 0, 0, h * 0.5);
  sweep.addColorStop(0, shade(SKY[0], dark ? 0.25 : 0.08));
  sweep.addColorStop(0.3, SKY[0]);
  sweep.addColorStop(0.55, mixHex(SKY[0], SKY[1], 0.5));
  sweep.addColorStop(0.75, SKY[1]);
  sweep.addColorStop(1, SKY[2]);
  c.fillStyle = sweep;
  c.fillRect(0, 0, w, h);

  if (dark && rain < 0.6) {
    VIEW_STARS.forEach((star) => {
      const k = 0.55 + 0.45 * Math.sin(t * 2.2 + star.p);
      const s = u * star.s * k;
      c.fillStyle = "#fffdf5";
      c.save();
      c.translate(star.x * w, star.y * h);
      c.rotate(Math.PI / 4);
      c.fillRect(-s / 2, -s / 2, s, s);
      c.restore();
    });
    // Shooting star: a streak from the upper right down to the left, fading at its tail
    const sp = (t - starAt) / 1.1;
    if (sp >= 0 && sp <= 1) {
      const x = w * (0.95 - sp * 0.7);
      const y = h * (0.04 + sp * 0.26);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + w * 0.16, y - h * 0.06);
      stroke(line * 2.2, "#000");
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + w * 0.16, y - h * 0.06);
      stroke(line * 1.1, "#ffdd00");
      blob([[x, y, u * 1.4]], "#fffdf5", 0);
    }
  }

  // Sun (turning rays) or moon (with craters), all but gone behind a shower's clouds
  const sx = w * look.sun[0];
  const sy = h * look.sun[1];
  const sr = u * 8.5;
  const sunColor = look.sun[2];
  // The sun fades before the moon appears (and vice versa), avoiding a silhouette pop.
  const celestial = Math.abs(look.night * 2 - 1);
  // A soft halo round it, breathing a little
  const halo = c.createRadialGradient(sx, sy, sr, sx, sy, sr * (dark ? 2.6 : 3.2) * (1 + 0.04 * Math.sin(t * 1.3)));
  halo.addColorStop(0, dark ? "rgba(255,253,245,.28)" : "rgba(255,255,230,.5)");
  halo.addColorStop(1, "rgba(255,255,255,0)");
  c.globalAlpha = Math.max(0, 1 - rain * 1.4) * celestial;
  c.fillStyle = halo;
  c.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
  // A ring of light swelling out from it now and then, fading as it grows
  const ring = (t * 0.22) % 1;
  c.globalAlpha = (1 - ring) * 0.4 * (1 - rain) * celestial;
  c.beginPath();
  c.arc(sx, sy, sr * (1.25 + ring * 1.9), 0, Math.PI * 2);
  stroke(line * (1.4 - ring), dark ? "#fffdf5" : glow(sunColor, 0.5));
  c.globalAlpha = Math.max(0, 1 - rain * 1.3) * celestial;
  // it breathes: a slow swell, and the rays stretching in a wave that runs round the disc
  const breathe = 1 + 0.03 * Math.sin(t * 1.6);
  if (!dark) {
    c.save();
    c.translate(sx, sy);
    c.rotate(t * 0.25);
    for (let i = 0; i < 10; i++) {
      c.rotate((Math.PI * 2) / 10);
      const tip = sr * ((i % 2 ? 1.55 : 1.72) + 0.13 * Math.sin(t * 2.4 - i * 1.25));
      c.beginPath();
      c.moveTo(sr * 1.3, 0);
      c.lineTo(tip, 0);
      stroke(line * 3.2, "#000");
      c.beginPath();
      c.moveTo(sr * 1.3, 0);
      c.lineTo(tip, 0);
      stroke(line * 1.4, sunColor);
    }
    c.restore();
    celBlob([[sx, sy, sr * breathe]], sunColor, sr);
  } else {
    celBlob([[sx, sy, sr * breathe]], "#fffdf5", sr);
    [[-0.3, -0.2, 0.22], [0.3, 0.25, 0.16], [0.15, -0.38, 0.1]].forEach(([dx, dy, r]) => {
      c.beginPath();
      c.arc(sx + dx * sr, sy + dy * sr, r * sr, 0, Math.PI * 2);
      c.fillStyle = "#e7e0cc";
      c.fill();
      stroke(line * 0.6);
    });
  }
  c.globalAlpha = 1;

  // A cloud: a flattish, slightly lumpy base with puffs of uneven size heaped along it, each
  // cloud's set nudged its own way so no two match
  const cloudParts = (x, y, s, i, puff = () => s) => [{ x: x + s * 0.1, y: y + s * 0.2, r: s * 0.92, sy: 0.3, seed: i * 1.3, wob: 0.05 }].concat(
    PUFFS.map(([dx, dy, r], k) => {
      const v = Math.sin(i * 4.1 + k * 2.7);
      return { x: x + (dx + v * 0.05) * s, y: y + (dy + v * 0.04) * s, r: puff(k) * r * (1 + v * 0.16), seed: i * 3 + k, wob: 0.09 };
    }),
  );
  // Clouds drifting across (more, lower and heavier when it rains); where each is, so its
  // shadow can slide over the mountains below it
  const cloudSpots = [];
  [[0.1, 0.12, 1, 6], [0.55, 0.3, 0.75, 9], [0.85, 0.08, 0.6, 4.5]].forEach(([bx, by, size, speed], i) => {
    const x = wrapX(bx * w + t * speed * u, w * 0.2);
    const y = by * h + Math.sin(t * 0.4 + i) * u * 0.4;
    const s = size * u * 9;
    // each puff swells and settles on its own beat, so the cloud slowly changes shape as it drifts
    const puff = (k) => s * (1 + 0.05 * Math.sin(t * 0.6 + i * 2.3 + k * 1.9));
    cloudSpots.push([x, s]);
    celBlob(cloudParts(x, y, s, i, puff), grey(look.cloud), s);
  });
  if (rain > 0.05) {
    c.globalAlpha = Math.min(1, rain * 1.5);
    [[0.25, 0.05, 1.5, 3], [0.7, 0.16, 1.3, 2.2], [-0.05, 0.22, 1.1, 2.6]].forEach(([bx, by, size, speed], i) => {
      const x = wrapX(bx * w + t * speed * u, w * 0.25);
      const y = by * h;
      const s = size * u * 9;
      blob(cloudParts(x, y, s, i + 5), dark ? "#3a4060" : "#7d8798");
    });
    c.globalAlpha = 1;
  }

  // A hot-air balloon drifting slowly across, by day when it's dry
  if (!dark && rain < 0.3) {
    const hx = wrapX(w * 0.15 + t * u * 1.6, u * 12);
    const hy = h * 0.2 + Math.sin(t * 0.5) * u * 1.5;
    const r = u * 4.2;
    // swinging gently from the envelope, the basket trailing behind the drift
    c.save();
    c.translate(hx, hy);
    c.rotate(Math.sin(t * 0.9) * 0.07 - 0.03);
    c.translate(-hx, -hy);
    c.beginPath();
    c.moveTo(hx - r * 0.55, hy + r * 0.85);
    c.lineTo(hx - r * 0.3, hy + r * 1.75);
    c.moveTo(hx + r * 0.55, hy + r * 0.85);
    c.lineTo(hx + r * 0.3, hy + r * 1.75);
    stroke(line * 0.5);
    blob([[hx - r * 0.35, hy + r * 1.7, 0, r * 0.7, r * 0.5]], "#8b5a2b", 0);
    blob([[hx, hy, r], [hx - r * 0.55, hy + r * 0.45, 0, r * 1.1, r * 0.45]], "#ff6b6b", 0);
    c.save();
    c.beginPath();
    c.arc(hx, hy, r, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = "#ffdd00";
    c.fillRect(hx - r * 0.28, hy - r, r * 0.56, r * 2);
    c.fillStyle = "#fffdf5";
    c.fillRect(hx - r, hy - r * 0.12, r * 2, r * 0.24);
    c.restore();
    c.restore();
  }

  // A far range, paler and softer-edged, the haze between it and the near peaks
  c.beginPath();
  c.moveTo(-line, h * 0.6);
  FAR_RIDGE.forEach(([x, y]) => c.lineTo(w * x, h * y));
  c.lineTo(w + line, h * 0.6);
  c.closePath();
  c.fillStyle = grey(mixHex(dark ? "#3b3570" : time === "evening" ? "#9b7fd4" : "#c4b5fd", SKY[2], 0.55));
  c.fill();
  stroke(line * 0.6, "rgba(0,0,0,.45)");
  // Mountains behind the lake (drawn again, upside down, in the water)
  const ridge = (mapY = (y) => y) => {
    c.beginPath();
    c.moveTo(-line, mapY(h * 0.6));
    RIDGE.forEach(([x, y]) => c.lineTo(w * x, mapY(h * y)));
    c.lineTo(w + line, mapY(h * 0.6));
    c.closePath();
  };
  const mountainColor = grey(dark ? "#3b3570" : time === "evening" ? "#9b7fd4" : "#c4b5fd");
  ridge();
  c.fillStyle = mountainColor;
  c.fill();
  c.save();
  c.clip();
  // Each peak's far side from the light in shade, the edge kinked on the way down so it reads
  // as a rock face rather than a wedge; a few gullies scored down the lit side
  RIDGE_PEAKS.forEach((p) => {
    const [px, py] = RIDGE[p];
    const [vx, vy] = RIDGE[Math.max(0, Math.min(RIDGE.length - 1, p - lightSide * 24))];
    c.beginPath();
    c.moveTo(w * px, h * py);
    c.lineTo(w * vx, h * vy);
    c.lineTo(w * vx, h * 0.6);
    c.lineTo(w * (px - lightSide * 0.012), h * 0.6);
    c.lineTo(w * (px + lightSide * 0.014), h * (py + (0.6 - py) * 0.5));
    c.lineTo(w * (px - lightSide * 0.004), h * (py + (0.6 - py) * 0.22));
    c.closePath();
    c.fillStyle = shade(mountainColor, 0.3);
    c.fill();
    c.beginPath();
    [[0.024, 0.085, 0.036, 0.15], [0.058, 0.1, 0.07, 0.16], [0.012, 0.13, 0.016, 0.2]].forEach(([x0, y0, x1, y1]) => {
      c.moveTo(w * (px + lightSide * x0), h * (py + y0));
      c.lineTo(w * (px + lightSide * x1), h * (py + y1));
    });
    stroke(line * 0.55, shade(mountainColor, 0.18));
  });
  // the clouds' shadows sliding over the slopes, cast away from the light
  c.fillStyle = SHADE;
  c.globalAlpha = (dark ? 0.2 : 0.14) * (1 + rain * 0.5);
  cloudSpots.forEach(([x, s], i) => {
    c.beginPath();
    c.ellipse(x - lightSide * s * 0.7, h * (0.44 + (i % 2) * 0.06), s * 1.25, s * 0.42, -lightSide * 0.12, 0, Math.PI * 2);
    c.fill();
  });
  c.globalAlpha = 1;
  c.restore();
  ridge();
  stroke();
  // Snow caps, their shaded half a cool blue-grey
  RIDGE_PEAKS.forEach((p) => {
    const [x, y] = RIDGE[p];
    const cap = () => {
      c.beginPath();
      c.moveTo(w * RIDGE[p - 6][0], h * RIDGE[p - 6][1]);
      RIDGE.slice(p - 5, p + 7).forEach(([rx, ry]) => c.lineTo(w * rx, h * ry));
      c.lineTo(w * (x + 0.015), h * (y + 0.04));
      c.lineTo(w * (x - 0.02), h * (y + 0.055));
      c.lineTo(w * (x - 0.03), h * (y + 0.045));
      c.closePath();
    };
    const snow = dark ? "#c9c5dc" : "#fffdf5";
    cap();
    c.fillStyle = snow;
    c.fill();
    c.save();
    c.clip();
    c.beginPath();
    c.moveTo(w * x, h * y);
    c.lineTo(w * (x - lightSide * 0.06), h * (y + 0.06));
    c.lineTo(w * (x + lightSide * 0.004), h * (y + 0.06));
    c.closePath();
    c.fillStyle = shade(snow, 0.2);
    c.fill();
    c.restore();
    cap();
    stroke(line * 0.8);
  });

  // Mist hanging along the foot of the mountains, drifting and thinning as it goes
  c.fillStyle = mixHex(SKY[2], "#ffffff", dark ? 0.1 : 0.45);
  for (let i = 0; i < 4; i++) {
    const mw = w * (0.22 + (i % 2) * 0.1);
    const mx = wrapX(((i * 0.31) % 1) * w + t * u * (0.5 + i * 0.25), mw);
    const my = h * (0.535 + (i % 3) * 0.015) + Math.sin(t * 0.5 + i * 2) * u * 0.4;
    const mh = u * (1.4 + (i % 2) * 0.6) * (0.85 + 0.15 * Math.sin(t * 0.7 + i));
    c.globalAlpha = (dark ? 0.25 : 0.45) * (0.7 + 0.3 * Math.sin(t * 0.4 + i * 1.7));
    c.beginPath();
    c.roundRect(mx - mw / 2, my - mh / 2, mw, mh, mh / 2);
    c.fill();
  }
  c.globalAlpha = 1;

  // The far shore: a low green bank with round bushes, a few houses (lit up at night, smoke
  // curling from a chimney) and a lighthouse on the point, its beam sweeping after dark
  const bank = h * 0.58;
  c.beginPath();
  c.moveTo(-line, bank + line);
  for (let x = 0; x <= 1.001; x += 0.05) c.lineTo(w * x, bank - h * (0.012 + 0.01 * Math.sin(x * 17)));
  c.lineTo(w + line, bank + line);
  c.closePath();
  const bankColor = grey(dark ? "#245239" : "#5fbf6a");
  c.fillStyle = bankColor;
  c.fill();
  stroke(line * 0.8);
  [0.04, 0.11, 0.17, 0.42, 0.5, 0.84, 0.9].forEach((x, i) => blob([[w * x, bank - h * 0.018, u * (1.6 + (i % 3) * 0.5)]], grey(dark ? "#1f5c3a" : "#2f9e57"), 0));
  [[0.56, "#ff6b6b"], [0.615, "#3b82f6"], [0.67, "#ffb35c"]].forEach(([x, roof], i) => {
    const hx = w * x;
    const hw = u * (3.4 + (i % 2) * 0.6);
    const hh = u * 2.6;
    const base = bank - h * 0.008;
    // A short side wall and an off-centre ridge give the cottages a little depth.
    const peakX = hx - hw * (0.1 + i * 0.025);
    const peakY = base - hh - u * (2 + i * 0.12);
    const wall = () => {
      c.beginPath();
      c.moveTo(hx - hw * 0.5, base - hh);
      c.lineTo(hx + hw * 0.48, base - hh + u * 0.12);
      c.lineTo(hx + hw * 0.51, base - u * 0.1);
      c.lineTo(hx - hw * 0.48, base);
      c.closePath();
    };
    wall();
    c.fillStyle = grey("#fffdf5");
    c.fill();
    c.beginPath();
    c.moveTo(hx + lightSide * hw * 0.12, base - hh);
    c.lineTo(hx - lightSide * hw * 0.5, base - hh);
    c.lineTo(hx - lightSide * hw * 0.48, base);
    c.lineTo(hx + lightSide * hw * 0.12, base - u * 0.08);
    c.closePath();
    c.fillStyle = shade(grey("#fffdf5"), 0.25);
    c.fill();
    wall();
    stroke(line * 0.7);
    const gable = () => {
      c.beginPath();
      c.moveTo(hx - hw * 0.66, base - hh + u * 0.14);
      c.lineTo(peakX, peakY);
      c.quadraticCurveTo(hx + hw * 0.28, peakY + u * 0.6, hx + hw * 0.66, base - hh + u * 0.2);
      c.lineTo(hx + hw * 0.12, base - hh + u * 0.32);
      c.closePath();
    };
    gable();
    c.fillStyle = grey(roof);
    c.fill();
    c.beginPath();
    c.moveTo(peakX, peakY);
    c.lineTo(hx - lightSide * hw * 0.66, base - hh + u * 0.14);
    c.lineTo(hx + hw * 0.12, base - hh + u * 0.32);
    c.closePath();
    c.fillStyle = shade(grey(roof), 0.3);
    c.fill();
    gable();
    stroke(line * 0.7);
    c.fillStyle = dark ? "#ffdd00" : "#30437f";
    c.fillRect(hx - u * 0.6, base - hh * 0.7, u * 1.2, u * 1.1);
    if (i === 1) {
      c.fillStyle = "#000";
      c.fillRect(hx + hw * 0.18, base - hh - u * 2.1, u * 0.9, u * 1.4);
      for (let k = 0; k < 3; k++) {
        const life = (t * 0.35 + k / 3) % 1;
        c.globalAlpha = (1 - life) * (dark ? 0.35 : 0.7);
        c.beginPath();
        c.arc(hx + hw * 0.22 + Math.sin(t + k * 2) * u * 0.8 + life * u * 3, base - hh - u * 2.4 - life * u * 7, u * (0.6 + life * 1.1), 0, Math.PI * 2);
        c.fillStyle = "#fffdf5";
        c.fill();
      }
      c.globalAlpha = 1;
    }
  });
  const lx = w * 0.755;
  const lBase = bank - h * 0.012;
  const lTop = lBase - u * 8.5;
  if (dark) {
    const sweep = Math.sin(t * 0.9);
    c.save();
    c.globalAlpha = 0.28 * (1 - rain * 0.5);
    c.fillStyle = "#fff6b0";
    c.beginPath();
    c.moveTo(lx, lTop + u * 0.8);
    c.lineTo(lx + sweep * w * 0.32, lTop - u * 3);
    c.lineTo(lx + sweep * w * 0.32, lTop + u * 4.5);
    c.closePath();
    c.fill();
    c.restore();
  }
  c.beginPath();
  c.moveTo(lx - u * 1.5, lBase);
  c.lineTo(lx - u * 1, lTop + u * 1.6);
  c.lineTo(lx + u * 1, lTop + u * 1.6);
  c.lineTo(lx + u * 1.5, lBase);
  c.closePath();
  c.fillStyle = grey("#fffdf5");
  c.fill();
  c.save();
  c.clip();
  c.fillStyle = grey("#e5484d");
  [0.25, 0.6].forEach((k) => c.fillRect(lx - u * 2, lBase - (lBase - lTop) * k - u * 0.7, u * 4, u * 1.4));
  c.fillStyle = dark ? "rgba(11,16,48,.35)" : "rgba(59,58,122,.22)";
  c.fillRect(lightSide > 0 ? lx - u * 2 : lx + u * 0.35, lTop, u * 1.65, lBase - lTop);
  c.restore();
  stroke(line * 0.7);
  c.beginPath();
  c.rect(lx - u * 0.9, lTop + u * 0.2, u * 1.8, u * 1.4);
  c.fillStyle = dark ? "#fff6b0" : "#ffdd00";
  c.fill();
  stroke(line * 0.6);
  c.beginPath();
  c.moveTo(lx - u * 1.2, lTop + u * 0.2);
  c.lineTo(lx, lTop - u * 1);
  c.lineTo(lx + u * 1.2, lTop + u * 0.2);
  c.closePath();
  c.fillStyle = grey("#e5484d");
  c.fill();
  stroke(line * 0.6);

  // The lake: ripples sliding, the sun/moon's reflection wobbling, a little sailboat
  const lakeTop = h * 0.58;
  const lakeBottom = h * 0.78;
  const lakeColor = grey(dark ? "#172554" : "#3b82f6");
  c.fillStyle = lakeColor;
  c.fillRect(0, lakeTop, w, lakeBottom - lakeTop);
  c.save();
  c.beginPath();
  c.rect(0, lakeTop, w, lakeBottom - lakeTop);
  c.clip();
  // The far bank and the mountains mirrored in the water: squashed, sunk into its colour and
  // cut into thin bands that each sway on their own beat, more the further out from the bank
  // and fainter too, so the reflection wobbles like water instead of sitting there as a stamp
  const mirrored = (y) => lakeTop + (lakeTop - y) * 0.55;
  const reflectFill = mixHex(lakeColor, mountainColor, dark ? 0.3 : 0.38);
  const band = u * 1.1;
  for (let y = lakeTop, k = 0; y < lakeTop + h * 0.14; y += band, k++) {
    const depth = (y - lakeTop) / (h * 0.14);
    const dx = (Math.sin(t * 1.7 + k * 0.9) * 0.6 + Math.sin(t * 0.9 - k * 0.45) * 0.4) * u * (0.3 + depth * 1.6);
    c.save();
    c.beginPath();
    c.rect(0, y, w, band + 0.5);
    c.clip();
    c.translate(dx, 0);
    c.globalAlpha = 1 - depth * 0.55;
    ridge(mirrored);
    c.fillStyle = reflectFill;
    c.fill();
    c.restore();
  }
  // the far bank's green right under it, its lower edge rippling
  c.beginPath();
  c.moveTo(0, lakeTop);
  for (let x = 0; x <= w + u * 2; x += u * 2) c.lineTo(x, lakeTop + u * (1.6 + 0.35 * Math.sin(t * 2 + x / (u * 3))));
  c.lineTo(w + u * 2, lakeTop);
  c.closePath();
  c.fillStyle = mixHex(lakeColor, bankColor, 0.5);
  c.fill();
  // soft breaks of open water drifting through it, rounded at the ends, stretching and easing
  for (let i = 0; i < 7; i++) {
    const y = lakeTop + u * (2.6 + i * 1.9);
    const len = w * (0.12 + (i % 3) * 0.06) * (0.75 + 0.25 * Math.sin(t * 0.7 + i * 2.3));
    const x = wrapX(((i * 0.37) % 1) * w + t * u * (0.6 + (i % 3) * 0.35) + Math.sin(t * 0.8 + i * 1.7) * u * 3, w * 0.3);
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + len / 2, y + Math.sin(t * 1.3 + i) * u * 0.5, x + len, y);
    stroke(u * (0.5 + (i % 2) * 0.35), lakeColor);
  }
  // deeper water toward the near shore
  c.fillStyle = shade(lakeColor, 0.18);
  c.fillRect(0, lakeBottom - u * 3.2, w, u * 3.2);
  // the gust darkening the water as it crosses (a cat's paw), ruffled with short strokes
  if (gustFront > -0.1 && gustFront < 1.1) {
    const gx = gustFront * w;
    const gy = lakeTop + (lakeBottom - lakeTop) * 0.55;
    c.globalAlpha = 0.18;
    c.fillStyle = SHADE;
    c.beginPath();
    c.ellipse(gx - w * 0.06, gy, w * 0.14, (lakeBottom - lakeTop) * 0.32, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 0.6;
    c.beginPath();
    for (let k = 0; k < 6; k++) {
      const rx = gx - w * (0.02 + ((k * 0.37) % 1) * 0.16);
      const ry = gy + ((k * 0.61) % 1 - 0.5) * (lakeBottom - lakeTop) * 0.45;
      c.moveTo(rx, ry);
      c.lineTo(rx + u * 2, ry);
    }
    stroke(line * 0.5, glow(lakeColor, 0.5));
    c.globalAlpha = 1;
  }
  // glints twinkling on the water under the sun (or moon)
  c.fillStyle = dark ? "#fffdf5" : glow(sunColor, 0.6);
  for (let k = 0; k < 6; k++) {
    const g = Math.max(0, Math.sin(t * 2.6 + k * 2.1));
    const gs = u * 1.3 * g * g * g * (1 - rain);
    if (gs < u * 0.1) continue;
    const gx = sx + ((k * 0.618) % 1 - 0.5) * sr * 3.2;
    const gy = lakeTop + u * 2.5 + ((k * 0.382) % 1) * (lakeBottom - lakeTop) * 0.6;
    c.beginPath();
    c.moveTo(gx, gy - gs);
    c.quadraticCurveTo(gx, gy, gx + gs, gy);
    c.quadraticCurveTo(gx, gy, gx, gy + gs);
    c.quadraticCurveTo(gx, gy, gx - gs, gy);
    c.quadraticCurveTo(gx, gy, gx, gy - gs);
    c.fill();
  }
  c.restore();
  c.beginPath();
  c.moveTo(0, lakeTop);
  c.lineTo(w, lakeTop);
  stroke();
  // the sun's (or moon's) path on the water: broken dashes that slide, stretch and blink,
  // narrowing with distance from the bank
  c.fillStyle = sunColor;
  for (let i = 0; i < 5; i++) {
    const rowY = lakeTop + u * 2 + i * u * 2.3;
    const span = sr * (1.6 - i * 0.22);
    for (let k = 0; k < 3; k++) {
      const phase = t * (1.4 + k * 0.3) + i * 1.9 + k * 2.4;
      const len = span * (0.24 + 0.16 * Math.sin(phase));
      const cx = sx + Math.sin(phase * 0.7 + k) * span * 0.18 + (k - 1) * span * 0.32;
      c.globalAlpha = (1 - rain * 0.85) * (0.7 + 0.3 * Math.sin(phase * 1.3));
      c.beginPath();
      c.roundRect(cx - len / 2, rowY, len, u, u * 0.5);
      c.fill();
    }
  }
  c.globalAlpha = 1;
  // Rings spreading on the lake where the rain lands
  for (let i = 0; i < Math.round(rain * 10); i++) {
    const life = (t * 0.9 + i * 0.37) % 1;
    const rx = ((i * 0.419 + Math.floor(t * 0.9 + i * 0.37) * 0.31) % 1) * w;
    const ry = lakeTop + u * 2 + ((i * 0.23) % 1) * (lakeBottom - lakeTop - u * 4);
    c.globalAlpha = 1 - life;
    c.beginPath();
    c.ellipse(rx, ry, u * (0.5 + life * 3.5), u * (0.2 + life * 1.1), 0, 0, Math.PI * 2);
    stroke(line * 0.5, "#cdf6ff");
    c.globalAlpha = 1;
  }
  // Currents: little wavy strokes that fade in, drift along stretching out, and fade away
  // again somewhere new, each lane at its own pace (quicker nearer the shore)
  for (let i = 0; i < 10; i++) {
    const lane = i % 4;
    const dir = lane % 2 ? 1 : -1;
    const run = t * (0.12 + lane * 0.05) + i * 0.37;
    const life = run % 1;
    const fade = Math.sin(life * Math.PI);
    const x0 = ((i * 0.29 + Math.floor(run) * 0.53) % 1) * w * 0.9 + dir * life * u * 14;
    const y = lakeTop + u * 3.5 + lane * (lakeBottom - lakeTop - u * 6) / 3 + Math.sin(t + i) * u * 0.3;
    const len = u * (4 + (i % 3) * 2) * (0.6 + fade * 0.6);
    c.globalAlpha = fade * (dark ? 0.8 : 0.95);
    c.beginPath();
    c.moveTo(x0, y);
    for (let k = 1; k <= 4; k++) c.quadraticCurveTo(x0 + (len * (k - 0.5)) / 4, y + (k % 2 ? -1 : 1) * u * 0.55, x0 + (len * k) / 4, y);
    stroke(line * 0.7, dark ? "#7fb2ff" : "#cdf6ff");
  }
  c.globalAlpha = 1;
  const bx = w * 0.3 + Math.sin(t * 0.22) * w * 0.14;
  const by = lakeTop + (lakeBottom - lakeTop) * 0.45 + Math.sin(t * 2) * u * 0.6;
  c.save();
  c.translate(bx, by);
  c.rotate(Math.sin(t * 1.6) * 0.06);
  c.beginPath();
  c.moveTo(-u * 6, 0);
  c.lineTo(u * 6, 0);
  c.lineTo(u * 4, u * 2.6);
  c.lineTo(-u * 4, u * 2.6);
  c.closePath();
  c.fillStyle = "#ff6b6b";
  c.fill();
  stroke();
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, -u * 9);
  stroke();
  c.beginPath();
  c.moveTo(u * 0.6, -u * 8.5);
  c.lineTo(u * 6, -u * 1.2);
  c.lineTo(u * 0.6, -u * 1.2);
  c.closePath();
  c.fillStyle = "#fffdf5";
  c.fill();
  stroke();
  if (dark) blob([[-u * 3.2, -u * 1.4, u * 1]], "#ffdd00", 0);
  c.restore();

  // A mother duck and two ducklings paddling along, by day
  if (!dark) {
    const dx = wrapX(w * 0.62 - t * u * 1.8, u * 14);
    const dy = lakeTop + (lakeBottom - lakeTop) * 0.7;
    [[0, 1], [u * 4.2, 0.65], [u * 7.4, 0.65]].forEach(([off, k], i) => {
      const x = dx + off;
      const y = dy + Math.sin(t * 3 + i) * u * 0.3;
      blob([[x, y, u * 1.5 * k], [x - u * 1.3 * k, y - u * 1.4 * k, u * 0.95 * k]], k < 1 ? "#ffdd00" : "#fffdf5", 0);
      c.beginPath();
      c.moveTo(x - u * 2.1 * k, y - u * 1.5 * k);
      c.lineTo(x - u * 3 * k, y - u * 1.2 * k);
      c.lineTo(x - u * 2.1 * k, y - u * 1 * k);
      c.closePath();
      c.fillStyle = "#ff7a1a";
      c.fill();
      c.beginPath();
      c.moveTo(x - u * 2.3 * k, y + u * 1.1 * k);
      c.lineTo(x + u * 2.3 * k, y + u * 1.1 * k);
      stroke(line * 0.6, "#cdf6ff");
    });
  }

  // Grass, flowers, and trees swaying on the near shore
  const grassColor = grey(dark ? "#2f6b45" : "#8fd694");
  c.fillStyle = grassColor;
  c.fillRect(0, lakeBottom, w, h - lakeBottom);
  // the bank's lip in shade where it drops to the water, and tufts swaying in the breeze
  c.fillStyle = shade(grassColor, 0.2);
  c.fillRect(0, lakeBottom, w, u * 1.4);
  c.beginPath();
  GRASS_TUFTS.forEach(({ x, y, s: k }) => {
    const gx = w * x;
    const gy = lakeBottom + u * 3 + y * (h - lakeBottom - u * 3);
    const sway = wind(x, y * 0.1) * u * 0.9;
    const g = u * 1.5 * k;
    c.moveTo(gx - g * 0.5 + sway, gy - g * 1.1);
    c.quadraticCurveTo(gx - g * 0.2, gy - g * 0.3, gx, gy);
    c.quadraticCurveTo(gx + sway * 0.5, gy - g * 0.8, gx + sway * 1.3, gy - g * 1.5);
    c.moveTo(gx, gy);
    c.quadraticCurveTo(gx + g * 0.3, gy - g * 0.4, gx + g * 0.7 + sway, gy - g * 0.95);
  });
  stroke(line * 0.5, shade(grassColor, 0.32));
  c.beginPath();
  c.moveTo(0, lakeBottom);
  c.lineTo(w, lakeBottom);
  stroke();
  // A sandy path winding down to a little wooden pier
  const path = () => {
    c.beginPath();
    c.moveTo(w * 0.47, h + line);
    c.bezierCurveTo(w * 0.44, h * 0.9, w * 0.6, h * 0.86, w * 0.53, lakeBottom);
    c.lineTo(w * 0.58, lakeBottom);
    c.bezierCurveTo(w * 0.66, h * 0.86, w * 0.52, h * 0.92, w * 0.57, h + line);
    c.closePath();
  };
  const pathColor = grey(dark ? "#8a7a5a" : "#f3d9a4");
  path();
  c.fillStyle = pathColor;
  c.fill();
  // pebbles pressed into it, each with a shaded underside
  c.save();
  c.clip();
  [[0.505, 0.975, 1], [0.54, 0.94, 0.8], [0.52, 0.915, 0.6], [0.565, 0.885, 0.9], [0.585, 0.85, 0.7], [0.56, 0.815, 0.6], [0.55, 0.79, 0.5]].forEach(([x, y, k]) => {
    c.beginPath();
    c.ellipse(w * x, h * y, u * 1.1 * k, u * 0.6 * k, 0, 0, Math.PI * 2);
    c.fillStyle = shade(pathColor, 0.35);
    c.fill();
    c.beginPath();
    c.ellipse(w * x + lightSide * u * 0.15 * k, h * y - u * 0.18 * k, u * 0.8 * k, u * 0.38 * k, 0, 0, Math.PI * 2);
    c.fillStyle = glow(pathColor, 0.35);
    c.fill();
  });
  c.restore();
  path();
  stroke(line * 0.7);
  const pierTop = lakeBottom - (lakeBottom - lakeTop) * 0.34;
  [0.535, 0.575].forEach((x) => {
    c.beginPath();
    c.rect(w * x - u * 0.45, pierTop, u * 0.9, (lakeBottom - pierTop) + u);
    c.fillStyle = "#6b4a2a";
    c.fill();
    stroke(line * 0.6);
  });
  c.beginPath();
  c.moveTo(w * 0.525, lakeBottom + u * 0.4);
  c.lineTo(w * 0.532, pierTop);
  c.lineTo(w * 0.578, pierTop);
  c.lineTo(w * 0.585, lakeBottom + u * 0.4);
  c.closePath();
  c.fillStyle = grey("#b8743c");
  c.fill();
  stroke(line * 0.7);
  for (let k = 1; k < 4; k++) {
    const y = pierTop + (lakeBottom - pierTop) * (k / 4);
    c.beginPath();
    c.moveTo(w * 0.53, y);
    c.lineTo(w * 0.58, y);
    stroke(line * 0.4, "#6b4a2a");
  }
  // Reeds and cattails at the water's edge, swaying
  [0.24, 0.255, 0.27, 0.285, 0.72, 0.735, 0.75].forEach((x, i) => {
    const sway = (wind(x) + Math.sin(t * 2.2 + i) * 0.08) * u * 1.3;
    const top = lakeBottom - u * (4 + (i % 3) * 1.4);
    c.beginPath();
    c.moveTo(w * x, lakeBottom + u * 1.5);
    c.quadraticCurveTo(w * x, top + u * 2, w * x + sway, top);
    stroke(line * 0.6, dark ? "#14532d" : "#166534");
    if (i % 2 === 0) {
      c.save();
      c.translate(w * x + sway, top + u * 0.4);
      c.beginPath();
      c.roundRect(-u * 0.55, -u * 0.6, u * 1.1, u * 2.4, u * 0.5);
      c.fillStyle = "#8b5a2b";
      c.fill();
      stroke(line * 0.5);
      c.restore();
    }
  });
  // Flowers on the near shore, drawn the way the rest of the view is: one clean black
  // silhouette (stroked wide, then filled over), a shade side away from the light and a sheen
  // toward it. Daisies face us a little tilted, tulips are closed cups, lavender stands in
  // spikes. Stems are inked too, and each has a leaf or two reaching up and out.
  const stemColor = dark ? "#14532d" : "#166534";
  const leafColor = dark ? "#1f5c3a" : "#2f9e57";
  const ink = (width = line * 1.1) => stroke(width, "#000");
  const leaf = (x, y, side, size) => {
    const L = size * 1.3;
    c.save();
    c.translate(x, y);
    c.scale(side, 1);
    c.rotate(-0.55);
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(L * 0.45, -L * 0.4, L, 0);
    c.quadraticCurveTo(L * 0.5, L * 0.32, 0, 0);
    c.closePath();
    ink();
    c.fillStyle = leafColor;
    c.fill();
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(L, 0);
    c.quadraticCurveTo(L * 0.5, L * 0.32, 0, 0);
    c.fillStyle = shade(leafColor, 0.3);
    c.fill();
    c.beginPath();
    c.moveTo(L * 0.08, 0);
    c.quadraticCurveTo(L * 0.5, -L * 0.06, L * 0.86, 0);
    stroke(line * 0.35, shade(leafColor, 0.5));
    c.restore();
  };
  const FLOWERS = [
    [0.36, 0.86, "#ff90e8", "daisy"], [0.43, 0.93, "#ffdd00", "tulip"], [0.62, 0.885, "#fffdf5", "daisy"],
    [0.69, 0.95, "#ff6b6b", "tulip"], [0.3, 0.95, "#a78bfa", "lavender"], [0.75, 0.86, "#c4b5fd", "lavender"], [0.4, 0.99, "#fffdf5", "daisy"],
  ];
  FLOWERS.forEach(([x, y, color, kind], i) => {
    // big enough to read their petals in the window close-up
    const fu = u * 1.7;
    // the heads trail their stems a beat, and bob a touch on their own
    const sway = (wind(x, 0.12) + Math.sin(t * 2.4 + i * 1.7) * 0.06) * fu * 0.7;
    const bx = w * x;
    const by = h * y + fu * 3.4;
    const fx = bx + sway;
    const fy = h * y;
    const petal = dark ? mixHex(color, "#3b3570", 0.45) : color;
    const tilt = sway / (fu * 6);
    const stem = () => {
      c.beginPath();
      c.moveTo(bx, by);
      c.quadraticCurveTo(bx, (by + fy) / 2, fx, fy + fu * 0.3);
    };
    stem();
    ink(line * 1.25);
    stem();
    stroke(line * 0.6, stemColor);
    leaf(bx + sway * 0.25, by - fu * 1.1, i % 2 ? 1 : -1, fu * 1.4);
    if (kind === "lavender") leaf(bx + sway * 0.1, by - fu * 0.4, i % 2 ? -1 : 1, fu * 1.1);
    c.save();
    c.translate(fx, fy);
    c.rotate(tilt);
    if (kind === "daisy") {
      // seen a little from above: squashed, nine petals, each with a crease down its middle
      c.scale(1, 0.82);
      const N = 9;
      const petals = () => {
        c.beginPath();
        for (let k = 0; k < N; k++) {
          const a = (k / N) * Math.PI * 2 + i;
          const px = Math.cos(a) * fu * 1.05;
          const py = Math.sin(a) * fu * 1.05;
          c.moveTo(px + Math.cos(a) * fu * 0.68, py + Math.sin(a) * fu * 0.68);
          c.ellipse(px, py, fu * 0.68, fu * 0.3, a, 0, Math.PI * 2);
        }
      };
      petals();
      ink();
      c.fillStyle = petal;
      c.fill();
      c.save();
      c.clip();
      c.fillStyle = shade(petal, 0.22);
      c.fillRect(-fu * 3, fu * 0.2, fu * 6, fu * 3);
      c.restore();
      c.beginPath();
      for (let k = 0; k < N; k++) {
        const a = (k / N) * Math.PI * 2 + i;
        c.moveTo(Math.cos(a) * fu * 0.65, Math.sin(a) * fu * 0.65);
        c.lineTo(Math.cos(a) * fu * 1.4, Math.sin(a) * fu * 1.4);
      }
      stroke(line * 0.3, shade(petal, 0.35));
      // the eye: a domed yellow heart, freckled, lit on top
      const eye = dark ? "#c9a227" : "#ffb800";
      c.beginPath();
      c.arc(0, 0, fu * 0.55, 0, Math.PI * 2);
      ink();
      c.fillStyle = eye;
      c.fill();
      c.beginPath();
      c.arc(0, 0, fu * 0.55, 0.15, Math.PI - 0.15);
      c.fillStyle = shade(eye, 0.28);
      c.fill();
      c.fillStyle = shade(eye, 0.45);
      [[-0.2, -0.05], [0.18, 0.08], [0.02, 0.25], [-0.05, -0.28], [0.25, -0.2]].forEach(([dx, dy]) => c.fillRect(fu * dx - u * 0.18, fu * dy - u * 0.18, u * 0.36, u * 0.36));
      c.beginPath();
      c.ellipse(lightSide * fu * 0.18, -fu * 0.22, fu * 0.2, fu * 0.11, 0, 0, Math.PI * 2);
      c.fillStyle = glow(eye, 0.6);
      c.fill();
    } else if (kind === "tulip") {
      // a closed cup: two petals behind, one in front with its edges overlapping theirs
      const cup = () => {
        c.beginPath();
        c.moveTo(-fu * 0.95, -fu * 0.85);
        c.quadraticCurveTo(-fu * 1.2, fu * 0.75, 0, fu * 0.85);
        c.quadraticCurveTo(fu * 1.2, fu * 0.75, fu * 0.95, -fu * 0.85);
        c.quadraticCurveTo(fu * 0.8, -fu * 0.4, fu * 0.42, -fu * 0.55);
        c.quadraticCurveTo(fu * 0.28, -fu * 1.3, 0, -fu * 1.3);
        c.quadraticCurveTo(-fu * 0.28, -fu * 1.3, -fu * 0.42, -fu * 0.55);
        c.quadraticCurveTo(-fu * 0.8, -fu * 0.4, -fu * 0.95, -fu * 0.85);
        c.closePath();
      };
      cup();
      ink();
      c.fillStyle = petal;
      c.fill();
      c.save();
      c.clip();
      c.fillStyle = shade(petal, 0.25);
      c.fillRect(lightSide > 0 ? -fu * 2 : fu * 0.3, -fu * 2, fu * 1.7, fu * 4);
      c.restore();
      c.beginPath();
      c.moveTo(-fu * 0.42, -fu * 0.55);
      c.quadraticCurveTo(-fu * 0.5, fu * 0.2, -fu * 0.15, fu * 0.75);
      c.moveTo(fu * 0.42, -fu * 0.55);
      c.quadraticCurveTo(fu * 0.5, fu * 0.2, fu * 0.15, fu * 0.75);
      stroke(line * 0.4, shade(petal, 0.45));
      c.beginPath();
      c.moveTo(lightSide * fu * 0.68, -fu * 0.45);
      c.quadraticCurveTo(lightSide * fu * 0.78, 0, lightSide * fu * 0.6, fu * 0.35);
      stroke(line * 0.55, glow(petal, 0.55));
    } else {
      // lavender: a spike of florets, smaller toward the tip, alternating sides
      const florets = [];
      for (let k = 0; k < 7; k++) {
        const s = 1 - k * 0.09;
        florets.push([(k % 2 ? 1 : -1) * fu * 0.22 * s, fu * 0.6 - k * fu * 0.42, fu * 0.42 * s, fu * 0.3 * s]);
      }
      const spike = () => {
        c.beginPath();
        florets.forEach(([dx, dy, rx, ry]) => {
          c.moveTo(dx + rx, dy);
          c.ellipse(dx, dy, rx, ry, 0, 0, Math.PI * 2);
        });
      };
      spike();
      ink();
      c.fillStyle = petal;
      c.fill();
      c.beginPath();
      florets.forEach(([dx, dy, rx, ry]) => {
        c.moveTo(dx - lightSide * rx * 0.2 + rx * 0.75, dy + ry * 0.25);
        c.ellipse(dx - lightSide * rx * 0.2, dy + ry * 0.25, rx * 0.75, ry * 0.7, 0, 0, Math.PI * 2);
      });
      c.fillStyle = shade(petal, 0.3);
      c.fill();
      c.fillStyle = glow(petal, 0.55);
      florets.forEach(([dx, dy, rx, ry]) => c.fillRect(dx + lightSide * rx * 0.35 - u * 0.2, dy - ry * 0.45, u * 0.4, u * 0.3));
    }
    c.restore();
  });
  const tree = (x, scale, i, round) => {
    const base = h * 0.97;
    // its shadow stretched across the grass, away from the light
    c.globalAlpha = dark ? 0.32 : 0.24;
    c.fillStyle = SHADE;
    c.beginPath();
    c.ellipse(w * x - lightSide * u * 5 * scale, base, u * 9 * scale, u * 1.8 * scale, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
    c.save();
    c.translate(w * x, base);
    // the trunk bends a little with the wind, the crown a beat later and a little further
    const bend = wind(x);
    c.rotate(bend * 0.035);
    const bark = "#8b5a2b";
    const tw = u * 1.2 * scale;
    c.fillStyle = bark;
    c.fillRect(-tw, -u * 10 * scale, tw * 2, u * 10 * scale);
    // a shaded side down the trunk, and a few knots and grain marks in the bark
    c.fillStyle = shade(bark, 0.35);
    c.fillRect(lightSide > 0 ? -tw : tw * 0.2, -u * 10 * scale, tw * 0.8, u * 10 * scale);
    c.beginPath();
    [[-0.3, 2.5, 1.6], [0.35, 5, 1.2], [-0.1, 7.5, 1.4]].forEach(([bx, by, len]) => {
      c.moveTo(tw * bx, -u * by * scale);
      c.quadraticCurveTo(tw * (bx + 0.3), -u * (by + len * 0.5) * scale, tw * bx, -u * (by + len) * scale);
    });
    stroke(line * 0.45, shade(bark, 0.55));
    c.beginPath();
    c.rect(-tw, -u * 10 * scale, tw * 2, u * 10 * scale);
    stroke();
    c.translate(0, -u * 10 * scale);
    c.rotate((wind(x, 0.28) * 1.4 - bend) * 0.035 + Math.sin(t * 1.7 + i) * 0.006);
    c.translate(0, u * 10 * scale);
    if (round) {
      const r = u * 6 * scale;
      celBlob(CROWN.map(([dx, dy, size], k) => ({ x: dx * r, y: -u * 16 * scale + dy * r, r: size * r, sy: 1 + Math.sin(i + k) * 0.1, seed: i * 2.1 + k, wob: 0.12 })), grey(dark ? "#1f5c3a" : "#22a65c"), r);
    } else {
      const pine = grey(dark ? "#14532d" : "#166534");
      [[-u * 8, -u * 18, u * 7], [-u * 14, -u * 30, u * 5.5]].forEach(([bottom, top, half]) => {
        const tier = () => {
          c.beginPath();
          c.moveTo(0, top * scale);
          c.bezierCurveTo(half * 0.16 * scale, (top + u * 4) * scale, half * 0.7 * scale, (bottom - u * 2) * scale, half * scale, bottom * scale);
          c.quadraticCurveTo(half * 0.35 * scale, (bottom + u * 0.8) * scale, 0, (bottom - u * 0.3) * scale);
          c.quadraticCurveTo(-half * 0.6 * scale, (bottom + u * 0.5) * scale, -half * scale, (bottom - u * 0.3) * scale);
          c.bezierCurveTo(-half * 0.6 * scale, (bottom - u * 3) * scale, -half * 0.25 * scale, (top + u * 3) * scale, 0, top * scale);
          c.closePath();
        };
        tier();
        c.fillStyle = "#000";
        c.save();
        c.translate(line * 1.4, line * 1.4);
        c.fill();
        c.restore();
        c.fillStyle = pine;
        c.fill();
        // the half turned from the light in shade, a lit edge catching it on the other
        c.beginPath();
        c.moveTo(0, top * scale);
        c.lineTo(-lightSide * half * scale, bottom * scale);
        c.lineTo(lightSide * half * 0.12 * scale, bottom * scale);
        c.closePath();
        c.fillStyle = shade(pine, 0.35);
        c.fill();
        c.beginPath();
        c.moveTo(lightSide * half * 0.12 * scale, (top + (bottom - top) * 0.22) * scale);
        c.lineTo(lightSide * half * 0.72 * scale, (bottom - u * 0.9) * scale);
        stroke(line * 0.7, glow(pine, 0.35));
        tier();
        stroke();
      });
    }
    c.restore();
  };
  tree(0.09, 1.2, 0, false);
  tree(0.22, 0.9, 1, true);
  tree(0.85, 1.05, 2, false);
  tree(0.96, 0.8, 3, true);

  // Petals and leaves carried along in the gust, tumbling as they go
  if (!dark && rain < 0.3 && gustFront > 0 && gustFront < 1.3) {
    for (let k = 0; k < 6; k++) {
      const px = (gustFront - 0.04 - k * 0.05) * w;
      const py = h * (0.6 + ((k * 0.377) % 1) * 0.3) - gustFront * h * 0.08 + Math.sin(t * 3 + k * 2) * u * 2;
      c.save();
      c.translate(px, py);
      c.rotate(t * (4 + k) + k);
      c.scale(1, 0.35 + 0.65 * Math.abs(Math.sin(t * 5 + k)));
      c.beginPath();
      c.ellipse(0, 0, u * 1.1, u * 0.6, 0, 0, Math.PI * 2);
      c.fillStyle = k % 3 ? "#ff90e8" : "#8fd694";
      c.fill();
      stroke(line * 0.4);
      c.restore();
    }
  }

  // Birds by day (a few always about, a flock when called), fireflies by night
  const bird = (x, y, s, flap) => {
    c.beginPath();
    c.moveTo(x - s, y - s * 0.55 * flap);
    c.quadraticCurveTo(x - s * 0.45, y - s * 0.15, x, y);
    c.quadraticCurveTo(x + s * 0.45, y - s * 0.15, x + s, y - s * 0.55 * flap);
    stroke(line * 1.1);
  };
  if (!dark && rain < 0.3) {
    for (let i = 0; i < 3; i++) {
      const x = wrapX(w * (i * 0.37) + t * u * (5 + i * 1.5), u * 6);
      const y = h * (0.12 + i * 0.07) + Math.sin(t * 1.3 + i * 2) * u * 1.5;
      bird(x, y, u * (2.2 - i * 0.3), Math.sin(t * 9 + i * 1.7));
    }
    const fp = (t - flockAt) / 5;
    if (fp >= 0 && fp <= 1) {
      for (let i = 0; i < 7; i++) {
        const row = Math.ceil(i / 2) * (i % 2 ? 1 : -1);
        const x = -w * 0.15 + fp * w * 1.35 - Math.abs(row) * u * 4;
        const y = h * 0.3 + row * u * 3.5 - fp * h * 0.12 + Math.sin(t * 2 + i) * u * 0.6;
        bird(x, y, u * 2.4, Math.sin(t * 12 + i));
      }
    }
  } else if (dark && rain < 0.3) {
    // Fireflies wander on two loose loops at different beats, so no two paths fall in step,
    // and blink the way they do: a quick swell, a slower fade, then dark for a while. A lit one
    // leaves a short fading trail of where it just was.
    const flyAt = (fly, at) => [
      w * fly.x + (Math.sin(at * 0.43 + fly.p) * 3 + Math.sin(at * 1.13 + fly.p * 2.3) * 1.2) * u,
      h * fly.y + (Math.sin(at * 0.61 + fly.p * 1.7) * 1.8 + Math.cos(at * 1.37 + fly.p) * 0.8) * u - Math.max(0, Math.sin(at * 0.2 + fly.p)) * u * 4,
    ];
    VIEW_FLIES.forEach((fly) => {
      const cyc = (t * 0.32 + fly.p * 0.37) % 1;
      const rise = cyc < 0.1 ? cyc / 0.1 : cyc < 0.45 ? 1 - (cyc - 0.1) / 0.35 : 0;
      const g = rise * rise * (3 - 2 * rise);
      if (g < 0.03) return;
      const [x, y] = flyAt(fly, t);
      const halo = c.createRadialGradient(x, y, 0, x, y, u * 3.4 * (0.5 + g * 0.5));
      halo.addColorStop(0, `rgba(255,240,120,${0.6 * g})`);
      halo.addColorStop(1, "rgba(255,240,120,0)");
      c.fillStyle = halo;
      c.fillRect(x - u * 3.5, y - u * 3.5, u * 7, u * 7);
      c.fillStyle = "#fff6a0";
      [0.12, 0.24].forEach((ago, k) => {
        const [px, py] = flyAt(fly, t - ago);
        c.globalAlpha = g * (0.45 - k * 0.2);
        c.beginPath();
        c.arc(px, py, u * (0.4 - k * 0.1), 0, Math.PI * 2);
        c.fill();
      });
      c.globalAlpha = 1;
      c.beginPath();
      c.arc(x, y, u * (0.4 + g * 0.25), 0, Math.PI * 2);
      c.fillStyle = mixHex("#8a7a2a", "#fffbd0", g);
      c.fill();
      stroke(line * 0.35, "#1a1714");
    });
  }

  // Rain: slanted streaks falling past
  if (rain > 0.02) {
    c.strokeStyle = dark ? "rgba(190,205,255,.5)" : "rgba(235,245,255,.75)";
    c.lineWidth = Math.max(1.5, u * 0.45);
    c.beginPath();
    for (let i = 0; i < Math.round(rain * 140); i++) {
      const fall = (i * 0.291 + t * (1.4 + (i % 5) * 0.12)) % 1;
      const x = wrapX(((i * 0.137) % 1) * w - fall * u * 8, u * 4);
      const y = fall * h * 1.1 - h * 0.05;
      c.moveTo(x, y);
      c.lineTo(x - u * 1.6, y + u * 6);
    }
    c.stroke();
  }

  // Water on the glass. Each drop is a little lens: it shows the view behind it upside down
  // and shrunk, with a dark rim along its top, a bright caustic inside its lower edge and a
  // pinpoint of light. The bigger ones cling and swell, then let go and run in a quick
  // stick-slip zigzag, leaving a wet trail that dries again while they wait.
  // The water is on the glass, so it goes as the leaves swing out of the way
  if (rain > 0.05 && glass > 0.01) {
    const wet = Math.min(1, rain * 1.3) * glass;
    // the drops refract a snapshot of the finished view, not the canvas they're drawing into
    if (!glassCopy) glassCopy = document.createElement("canvas");
    if (glassCopy.width !== w || glassCopy.height !== h) Object.assign(glassCopy, { width: w, height: h });
    glassCopy.getContext("2d").drawImage(c.canvas, 0, 0);
    const lens = (x, y, rx, ry, stretch = 0) => {
      // a dome, its weight low; running, it draws up into a short tail
      const shape = () => {
        c.beginPath();
        c.moveTo(x - rx, y);
        c.bezierCurveTo(x - rx, y - ry * 1.33 * (1 + stretch * 1.4), x + rx, y - ry * 1.33 * (1 + stretch * 1.4), x + rx, y);
        c.bezierCurveTo(x + rx, y + ry * 1.38, x - rx, y + ry * 1.38, x - rx, y);
        c.closePath();
      };
      c.save();
      shape();
      c.clip();
      const R = Math.max(rx, ry) * 3.2;
      c.translate(x, y);
      c.scale(1, -1);
      c.drawImage(glassCopy, x - R, y - R, R * 2, R * 2, -rx * 1.15, -ry * 1.4, rx * 2.3, ry * 2.8);
      c.restore();
      c.save();
      shape();
      c.clip();
      c.fillStyle = dark ? "rgba(140,170,255,.18)" : "rgba(200,230,255,.22)";
      c.fill();
      // the dark rim along the top, the bright caustic low inside
      c.beginPath();
      c.ellipse(x, y - ry * 0.25, rx * 1.05, ry * 1.1, 0, Math.PI * 1.05, Math.PI * 1.95);
      c.lineWidth = Math.max(1.5, ry * 0.5);
      c.strokeStyle = "rgba(10,20,45,.55)";
      c.stroke();
      c.beginPath();
      c.ellipse(x, y + ry * 0.05, rx * 0.7, ry * 0.75, 0, Math.PI * 0.2, Math.PI * 0.8);
      c.lineWidth = Math.max(1.2, ry * 0.28);
      c.strokeStyle = "rgba(255,255,255,.8)";
      c.stroke();
      c.restore();
      shape();
      c.lineWidth = Math.max(1, u * 0.2);
      c.strokeStyle = "rgba(10,20,45,.6)";
      c.stroke();
      c.beginPath();
      c.ellipse(x - rx * 0.35, y - ry * 0.4, rx * 0.2, ry * 0.15, -0.5, 0, Math.PI * 2);
      c.fillStyle = "#fff";
      c.fill();
    };
    c.globalAlpha = wet;
    // fine beads: little domes, a darker top edge and a pinpoint of light
    GLASS_BEADS.forEach((b, i) => {
      if (i / GLASS_BEADS.length > rain + 0.15) return;
      const x = b.x * w;
      const y = b.y * h;
      const r = b.r * u;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fillStyle = dark ? "rgba(170,195,255,.22)" : "rgba(230,245,255,.35)";
      c.fill();
      c.beginPath();
      c.arc(x, y, r, Math.PI * 1.1, Math.PI * 1.9);
      c.lineWidth = Math.max(1, r * 0.35);
      c.strokeStyle = "rgba(10,20,45,.35)";
      c.stroke();
      c.beginPath();
      c.arc(x, y, r * 0.7, Math.PI * 0.25, Math.PI * 0.75);
      c.lineWidth = Math.max(0.8, r * 0.25);
      c.strokeStyle = "rgba(255,255,255,.7)";
      c.stroke();
    });
    GLASS_DROPS.forEach((d, i) => {
      // stick-slip: hold and swell for most of each beat, then run down a step and stop
      const beat = t * (0.18 + d.v * 6) + i * 0.61;
      const n = Math.floor(beat);
      const f = beat - n;
      const run = f < 0.72 ? 0 : 1 - (1 - (f - 0.72) / 0.28) ** 3;
      const step = 0.05 + d.v * 2;
      const y = (((d.y + (n + run) * step) % 1.1) - 0.05) * h;
      const sideAt = (k) => Math.sin(k * 1.9 + i * 2.7) * u * 1.6;
      const x = d.x * w + sideAt(n) + (sideAt(n + 1) - sideAt(n)) * run;
      const r = d.r * u * 0.8 * (0.85 + 0.25 * Math.min(1, f / 0.72));
      // fading in at the top so a drop that wraps round never pops
      const fadeIn = Math.min(1, (y + 0.05 * h) / (0.08 * h));
      c.globalAlpha = wet * fadeIn;
      // the wet trail: drawn out while it runs, drying back while it holds
      const trail = r * (1.5 + (f < 0.72 ? 9 * Math.exp(-f * 5) : 2 + run * 9));
      const streak = c.createLinearGradient(x, y - trail, x, y);
      streak.addColorStop(0, "rgba(220,240,255,0)");
      streak.addColorStop(1, dark ? "rgba(170,195,255,.35)" : "rgba(230,245,255,.45)");
      const tail = x - (sideAt(n + 1) - sideAt(n)) * run;
      c.beginPath();
      c.moveTo(tail - r * 0.15, y - trail);
      c.quadraticCurveTo(tail - r * 0.35, y - trail * 0.4, x - r * 0.4, y - r * 0.4);
      c.lineTo(x + r * 0.4, y - r * 0.4);
      c.quadraticCurveTo(tail + r * 0.35, y - trail * 0.4, tail + r * 0.15, y - trail);
      c.closePath();
      c.fillStyle = streak;
      c.fill();
      // a bead or two left behind in it
      if (trail > r * 3) {
        c.fillStyle = "rgba(255,255,255,.6)";
        c.beginPath();
        c.arc(tail + r * 0.1, y - trail * 0.6, r * 0.16, 0, Math.PI * 2);
        c.arc(tail - r * 0.12, y - trail * 0.85, r * 0.11, 0, Math.PI * 2);
        c.fill();
      }
      lens(x, y, r, r * 0.9, run * (1 - run) * 2);
    });
    c.globalAlpha = 1;
  }
}


// Shared with the other texture modules
export { mixHex };
