// The Divoom Times Gate 2's five little LCDs, drawn as real pixel art: each widget is laid out
// on a 64 × 64 grid of square pixels in a 3 × 5 bitmap font, then blown up onto its screen with
// a faint dark gap between the pixels, the look of a small LCD seen up close.
import { weatherKind } from "./weather";

export const GATE_PX = 64;

// 3 × 5 glyphs, row by row
const FONT = {
  "0": "111101101101111", "1": "010110010010111", "2": "111001111100111", "3": "111001111001111",
  "4": "101101111001001", "5": "111100111001111", "6": "111100111101111", "7": "111001001010010",
  "8": "111101111101111", "9": "111101111001111",
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
  E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100",
  Q: "010101101110011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111",
  " ": "000000000000000", ".": "000000000000010", ":": "000010000010000", "-": "000000111000000",
  "+": "000010111010000", "/": "001001010100100", "%": "101001010100101", "°": "010101010000000",
  "!": "010010010000010", "?": "111001010000010", "#": "101111101111101", "'": "010010000000000",
  ",": "000000000010100", "<": "001010100010001", ">": "100010001010100", "♥": "000101111111010",
};

function px(c, x, y, color, w = 1, h = 1) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), w, h);
}

export function pixelTextWidth(text, s = 1) {
  return text.length ? text.length * 4 * s - s : 0;
}

// Prints `text` with its top left at (x, y), each font pixel `s` screen pixels across
export function pixelText(c, text, x, y, color, s = 1) {
  c.fillStyle = color;
  let cx = Math.round(x);
  for (const ch of String(text).toUpperCase()) {
    const glyph = FONT[ch] ?? FONT["?"];
    for (let i = 0; i < 15; i++) {
      if (glyph[i] === "1") c.fillRect(cx + (i % 3) * s, Math.round(y) + Math.floor(i / 3) * s, s, s);
    }
    cx += 4 * s;
  }
  return cx - x - s;
}

const centredText = (c, text, y, color, s = 1) => pixelText(c, text, Math.round((GATE_PX - pixelTextWidth(text, s)) / 2), y, color, s);

// A sprite from rows of palette keys ("." is see-through), each key `s` pixels across
function sprite(c, rows, x, y, palette, s = 1) {
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const color = palette[row[rx]];
      if (color) px(c, x + rx * s, y + ry * s, color, s, s);
    }
  });
}

function disc(c, cx, cy, r, color) {
  c.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y + r * 0.6));
    c.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
}

// The widget's title bar across the top: a band of its colour, its name in black
function header(c, title, color, ink = "#000") {
  px(c, 0, 0, color, GATE_PX, 9);
  centredText(c, title, 2, ink);
}

// ---------- 1. weather ----------
function cloud(c, x, y, body, shade) {
  disc(c, x + 7, y + 7, 5, shade);
  disc(c, x + 14, y + 5, 6, shade);
  disc(c, x + 20, y + 8, 4, shade);
  px(c, x + 3, y + 9, shade, 21, 4);
  disc(c, x + 7, y + 6, 5, body);
  disc(c, x + 14, y + 4, 6, body);
  disc(c, x + 20, y + 7, 4, body);
  px(c, x + 3, y + 8, body, 21, 4);
}

function weatherIcon(c, kind, night, t) {
  const frame = Math.floor(t * 4);
  if (kind === "clear" || kind === "partly") {
    if (night) {
      disc(c, 14, 22, 7, "#ffe9a8");
      disc(c, 17, 20, 6, "#000");
      [[24, 14], [6, 13], [27, 26]].forEach(([sx, sy], i) => (frame + i) % 3 && px(c, sx, sy, "#fff"));
    } else {
      const rays = frame % 2 ? 9 : 10;
      [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]].forEach(([dx, dy]) => px(c, 14 + dx * rays, 22 + dy * rays, "#ffb000", 2, 2));
      disc(c, 15, 23, 6, "#ffb000");
      disc(c, 14, 22, 6, "#ffe14d");
      px(c, 11, 19, "#fff7b8", 2, 2);
    }
    if (kind === "partly") cloud(c, 8 + (frame % 4 < 2 ? 0 : 1), 22, "#f2f5fa", "#9aa6b8");
    return;
  }
  if (kind === "fog") {
    for (let i = 0; i < 5; i++) px(c, 3 + ((frame + i * 3) % 6), 15 + i * 4, i % 2 ? "#c7cdd6" : "#8d96a3", 22, 2);
    return;
  }
  const dark = kind === "storm";
  cloud(c, 2, 12, dark ? "#7c8494" : "#e8edf4", dark ? "#4a505c" : "#98a3b5");
  if (kind === "rain" || kind === "storm") {
    for (let i = 0; i < 5; i++) {
      const fall = (frame * 2 + i * 5) % 10;
      px(c, 6 + i * 4 - Math.floor(fall / 4), 27 + fall, "#4db8ff", 1, 2);
    }
  }
  if (kind === "storm" && frame % 6 < 2) sprite(c, ["..yy", ".yy.", "yyyy", "..y.", ".y.."], 13, 26, { y: "#ffe14d" });
  if (kind === "snow") {
    for (let i = 0; i < 5; i++) px(c, 5 + i * 4 + (frame + i) % 2, 27 + ((frame + i * 3) % 7), "#fff");
  }
}

export function drawGateWeather(c, { weather, place, t }) {
  const now = weather?.current;
  const night = now ? !now.isDay : false;
  px(c, 0, 0, night ? "#0b1030" : "#0d2a4a", GATE_PX, GATE_PX);
  header(c, (place || "WEATHER").slice(0, 15), night ? "#7d8bff" : "#5ec8ff");
  if (!now) {
    weatherIcon(c, "cloudy", false, t);
    centredText(c, weather?.error ? "OFFLINE" : "LOADING" + ".".repeat(Math.floor(t * 2) % 4), 44, "#9fb3c8");
    return;
  }
  const [label, kind] = weatherKind(now.code);
  weatherIcon(c, kind, night, t);
  const temp = String(Math.round(now.temp));
  const w = pixelText(c, temp, 34, 14, "#fff", 2);
  pixelText(c, "°", 34 + w + 2, 14, "#fff");
  pixelText(c, "C", 34 + w + 2, 20, "#9fb3c8");
  const today = weather.days?.[0];
  if (today) {
    pixelText(c, `H${Math.round(today.max)}`, 34, 27, "#ff9a5c");
    pixelText(c, `L${Math.round(today.min)}`, 50, 27, "#7fd3ff");
  }
  px(c, 3, 37, "#ffffff22", 58, 1);
  centredText(c, label.slice(0, 15), 41, "#ffe14d");
  pixelText(c, `RH${Math.round(now.humidity)}%`, 3, 49, "#7fd3ff");
  pixelText(c, `${Math.round(now.wind)}KM`, 61 - pixelTextWidth(`${Math.round(now.wind)}KM`), 49, "#c7cdd6");
  centredText(c, `AT ${weather.updated ?? "--:--"}`, 57, "#5d7189");
}

// ---------- 2. GitHub contributions ----------
const GREENS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];
const OCTOCAT = [
  ".k.....k.",
  ".kk...kk.",
  ".kkkkkkk.",
  "kkwkkkwkk",
  "kkkkkkkkk",
  ".kkkkkkk.",
  "..kk.kk..",
];

export function drawGateGithub(c, { github, t }) {
  px(c, 0, 0, "#0d1117", GATE_PX, GATE_PX);
  px(c, 0, 0, "#f0f6fc", GATE_PX, 9);
  sprite(c, OCTOCAT, 4, 1, { k: "#0d1117", w: "#f0f6fc" });
  pixelText(c, "GITHUB", 17, 2, "#0d1117");
  const days = github?.days;
  const total = github?.total;
  // the total and its span on one line, the word spelled out in full on the next
  const w = pixelText(c, total === undefined ? "--" : String(total).slice(-5), 4, 11, "#39d353", 2);
  const span = 4 + w + 4 + pixelTextWidth("1 YEAR") <= 60 ? "1 YEAR" : "1YR";
  pixelText(c, span, 60 - pixelTextWidth(span), 16, "#8b949e");
  centredText(c, "CONTRIBUTIONS", 23, "#8b949e");
  // the last thirteen weeks, a column a week, Sunday at the top
  const COLS = 13;
  const at = (col, row) => [6 + col * 4, 30 + row * 4];
  const sweep = (t * 6) % 26;
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < 7; row++) {
      const cell = days?.[col * 7 + row];
      if (cell === null) continue;
      let color = GREENS[cell?.level ?? 0];
      if (!days) color = Math.abs(col - sweep) < 1 ? "#21262d" : "#161b22";
      else if (Math.abs(col - sweep) < 0.6 && cell?.level) color = "#7ee787";
      const [x, y] = at(col, row);
      px(c, x, y, color, 3, 3);
    }
  }
  // today's square blinks
  if (days) {
    const last = days.findLastIndex((d) => d);
    if (last >= 0 && Math.floor(t * 2) % 2) {
      const [x, y] = at(Math.floor(last / 7), last % 7);
      px(c, x, y, "#ffffff", 3, 3);
    }
  }
  if (github?.error) centredText(c, "OFFLINE", 59, "#f85149");
  else centredText(c, github?.streak ? `${github.streak} DAY STREAK` : "", 59, "#8b949e");
}

// ---------- 3. visitors ----------
const VISITOR = [
  "..kkk..",
  ".kkkkk.",
  ".kkkkk.",
  "..kkk..",
  ".......",
  ".kkkkk.",
  "kkkkkkk",
];

export function drawGateVisitors(c, { count, shown, error, t }) {
  px(c, 0, 0, "#1a0b24", GATE_PX, GATE_PX);
  header(c, "VISITORS", "#ff5fd2");
  sprite(c, VISITOR, 5, 13, { k: "#ff9be8" });
  pixelText(c, "TOTAL", 15, 15, "#c79bd8");
  const digits = count === null ? (error ? "-----" : "") : String(Math.round(shown)).padStart(5, "0");
  // each digit in its own little flap, like an odometer
  const s = 2;
  const width = digits.length * 8;
  const x0 = Math.round((GATE_PX - width) / 2);
  for (let i = 0; i < digits.length; i++) {
    px(c, x0 + i * 8 - 1, 24, "#33163f", 7, 13);
    px(c, x0 + i * 8 - 1, 30, "#1a0b24", 7, 1);
    pixelText(c, digits[i], x0 + i * 8, 25, "#fff", s);
  }
  if (count === null && !error) centredText(c, "COUNTING" + ".".repeat(Math.floor(t * 2) % 4), 28, "#c79bd8");
  // a heart beats beside the thanks scrolling along the bottom
  const beat = Math.floor(t * 3) % 3 === 0;
  sprite(c, beat ? [".r.r.", "rrrrr", "rrrrr", ".rrr.", "..r.."] : ["....." , ".r.r.", ".rrr.", "..r..", "....."], 4, 43, { r: "#ff3d7f" });
  pixelText(c, "THANK", 12, 43, "#ff9be8");
  pixelText(c, "YOU!", 34, 43, "#ff9be8");
  const marquee = count === null ? "WELCOME TO THE DESK" : `YOU ARE VISITOR #${count} + WELCOME TO THE DESK`;
  const run = pixelTextWidth(marquee);
  px(c, 0, 52, "#33163f", GATE_PX, 9);
  pixelText(c, marquee, 64 - Math.floor(t * 14) % (run + 64), 54, "#ffe14d");
}

// ---------- 4. performance ----------
export function drawGatePerformance(c, { fps, ms, history, gpu }) {
  px(c, 0, 0, "#06140c", GATE_PX, GATE_PX);
  const tone = (f) => (f >= 50 ? "#39ff88" : f >= 30 ? "#ffd23f" : "#ff4d4d");
  header(c, "SCENE FPS", tone(fps));
  // (a 120 Hz screen's three digits drop a size to leave room for the frame time)
  const rate = String(Math.min(999, Math.round(fps)));
  pixelText(c, rate, 4, rate.length > 2 ? 15 : 13, tone(fps), rate.length > 2 ? 2 : 3);
  pixelText(c, `${ms < 100 ? ms.toFixed(1) : Math.min(999, Math.round(ms))}MS`, 33, 13, "#9fe8bc");
  pixelText(c, gpu === null ? "WEBGL" : `GPU${gpu.toFixed(1)}`, 33, 20, "#5c9a74");
  // the last fifty-eight samples, a column each, against the 30 and 60 lines
  const top = 31;
  const h = 30;
  px(c, 0, top - 1, "#0f2a19", GATE_PX, h + 2);
  for (let x = 3; x < 61; x += 2) {
    px(c, x, top + h - Math.round(60 / 70 * h), "#1f5133");
    px(c, x, top + h - Math.round(30 / 70 * h), "#4a3a12");
  }
  history.forEach((f, i) => {
    const bar = Math.max(1, Math.round(Math.min(f, 70) / 70 * h));
    px(c, 3 + i, top + h - bar, tone(f), 1, bar);
    px(c, 3 + i, top + h - bar, "#ffffff", 1, 1);
  });
}

// ---------- 5. Byte, the pixel pet ----------
// An original pocket monster in the handheld-RPG style: a round sky-blue critter with a glowing
// antenna bulb, pink cheeks and a lightning-bolt tail, sitting up and facing out
const BYTE = [
  "......kk......",
  ".....kyyk.....",
  "......kk......",
  ".......k......",
  "...kkkkkkkk...",
  "..kbbbbbbbbk..",
  ".kbbbbbbbbbbk.",
  ".kbhebbbbhebk.",
  ".kbeebbbbeebk.",
  "kbppbbkkbbppbk",
  "kbbbbwwwwbbbbk",
  ".kbbwwwwwwbbk.",
  ".kdbwwwwwwbdk.",
  "..kddk..kddk..",
  "..kkkk..kkkk..",
];
const HEART = [".r.r.", "rrrrr", "rrrrr", ".rrr.", "..r.."];
const SPARK = ["..y", ".y.", "yyy", ".y.", "y.."];
// the tail's zigzag, out from the side behind it, in two poses for its wag
const TAIL = [[[0, 11], [1, 10], [2, 11], [3, 10], [3, 9], [4, 8]], [[0, 11], [1, 11], [2, 10], [3, 11], [4, 10], [4, 9]]];

export function drawGatePet(c, { pet, night, t }) {
  // a patch of grass under an open sky, rolling hills behind, the clouds or the stars going by
  px(c, 0, 0, night ? "#141a3a" : "#8fd8ff", GATE_PX, GATE_PX);
  if (night) {
    [[8, 14], [22, 11], [37, 17], [51, 12], [58, 22], [30, 24]].forEach(([sx, sy], i) => (Math.floor(t * 2) + i) % 4 && px(c, sx, sy, "#fff6c8"));
    disc(c, 52, 16, 3, "#fff3b0");
  } else {
    const drift = Math.floor(t * 2) % 80;
    [[44 - drift, 15], [84 - drift, 22]].forEach(([cx, cy]) => {
      px(c, cx, cy, "#ffffff", 12, 3);
      px(c, cx + 3, cy - 2, "#ffffff", 6, 2);
    });
  }
  disc(c, 10, 46, 12, night ? "#1f3a2e" : "#5cbf5a");
  disc(c, 50, 48, 14, night ? "#1a3328" : "#4caf50");
  px(c, 0, 48, night ? "#24452f" : "#6fd16a", GATE_PX, 16);
  for (let x = 1; x < GATE_PX; x += 5) px(c, x, 49 + (x % 3), night ? "#2f5a3d" : "#8fe37f", 1, 2);
  // the round patch it stands on
  px(c, 4, 49, night ? "#1b3324" : "#4a9e46", 38, 3);
  px(c, 7, 52, night ? "#1b3324" : "#4a9e46", 32, 1);
  // a berry by its side once it's been fed
  if (pet.fed > t) sprite(c, [".g.", "rrr", "rrr", ".r."], 52, 45, { g: "#3c9a3c", r: "#ff4d6d" });
  // how happy it is, in hearts
  for (let i = 0; i < 5; i++) sprite(c, HEART, 3 + i * 7, 3, { r: i < pet.hearts ? "#ff3d7f" : night ? "#3a3155" : "#5aa9d6" });
  // Byte at twice the size of the type, its feet on the grass
  const S = 2;
  const asleep = pet.mood === "sleep";
  const happy = pet.mood === "happy";
  const hop = happy ? Math.max(0, Math.sin((t - pet.since) * 9)) * 6 : 0;
  const step = pet.mood === "walk" ? Math.floor(t * 6) % 2 : 0;
  const x = Math.round(pet.x);
  const y = 50 - BYTE.length * S + (asleep ? S : 0) - Math.round(hop) - step;
  // the tail wags on the side away from where it's heading
  const wag = TAIL[Math.floor(t * (asleep ? 1 : 4)) % 2];
  wag.forEach(([dx, dy]) => {
    const tx = pet.facing > 0 ? x - (dx + 1) * S : x + (BYTE[0].length + dx) * S;
    px(c, tx, y + dy * S, "#1a1714", S, S + 1);
    px(c, tx, y + dy * S, "#ffd23f", S, S);
  });
  const blink = asleep || (t % 3.4 < 0.15);
  const glow = asleep ? "#8a7a2a" : happy && Math.floor(t * 8) % 2 ? "#ffffff" : "#ffe14d";
  const rows = blink ? BYTE.map((row, i) => (i === 7 ? row.replace(/[eh]/g, "b") : i === 8 ? row.replace(/e/g, "k") : row)) : BYTE;
  sprite(c, rows, x, y, { k: "#1a1714", b: "#5ec8ff", d: "#2f8fd1", w: "#e8f8ff", y: glow, e: "#1a1714", h: "#ffffff", p: "#ff8fb1" }, S);
  if (asleep) {
    const rise = (t * 3) % 12;
    pixelText(c, "Z", x + 28, y + 4 - rise, "#c7c3ff");
    if (rise > 5) pixelText(c, "Z", x + 32, y - (rise - 5), "#8d86d9");
  }
  // sparks crackle off its cheeks when it's happy, and hearts float up
  if (happy && Math.floor(t * 8) % 2) {
    sprite(c, SPARK, x - 4, y + 14, { y: "#ffe14d" });
    sprite(c, SPARK, x + 29, y + 14, { y: "#ffe14d" });
  }
  pet.bursts.forEach((b) => {
    const age = t - b.at;
    if (age < 0 || age > 1.4) return;
    sprite(c, HEART, b.x, 18 - age * 12, { r: age < 1 ? "#ff3d7f" : "#ff9bbd" });
  });
  pixelText(c, asleep ? "ZZZ" : happy ? "BZZT!" : "BYTE", 3, 56, night ? "#c7f0d0" : "#ffffff");
}
