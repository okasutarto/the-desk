import { DISPLAY, fitFont } from "./base";

// ---------- katana ----------
// A little four-pointed glint, for light catching a blade's tip
export function drawGlint(c, w, h) {
  c.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  c.fillStyle = "#ffffff";
  c.beginPath();
  c.moveTo(cx, 0);
  c.quadraticCurveTo(cx, cy, w, cy);
  c.quadraticCurveTo(cx, cy, cx, h);
  c.quadraticCurveTo(cx, cy, 0, cy);
  c.quadraticCurveTo(cx, cy, cx, 0);
  c.fill();
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, w * 0.3);
  g.addColorStop(0, "rgba(200,240,255,.9)");
  g.addColorStop(1, "rgba(200,240,255,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}

// Enma's aura: a soft purple haze, darker at its heart
export function drawHakiAura(c, w, h) {
  c.clearRect(0, 0, w, h);
  // an ellipse of haze feathered all the way out, so its edges never show
  c.save();
  c.scale(1, h / w);
  const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, "rgba(62,18,108,.85)");
  g.addColorStop(0.35, "rgba(128,45,210,.66)");
  g.addColorStop(0.7, "rgba(180,95,250,.3)");
  g.addColorStop(1, "rgba(180,95,250,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, w, w);
  c.restore();
}

// The technique's name, called out in the site's own badge style: a slanted plate in the
// sword's colour (flat, ink outline, hard offset shadow), sized to the name (split over two
// lines when it's long), with a small ink 斬 ("cut") chip pinned to its corner
const SHOUT_COLORS = { wado: ["#ffdd00", "#1a1714"], kitetsu: ["#c81e1e", "#fffdf5"], enma: ["#6b2fa8", "#fffdf5"] };
export function drawShout(c, w, h, text, { style = "wado" } = {}) {
  c.clearRect(0, 0, w, h);
  const [fill, ink] = SHOUT_COLORS[style] || SHOUT_COLORS.wado;
  // the name: two lines at a colon or the middle space when it's long
  let lines = [text];
  if (text.length > 14) {
    const colon = text.indexOf(":");
    const cut = colon > 0 ? colon + 1 : text.lastIndexOf(" ", Math.ceil(text.length / 2) + 2);
    if (cut > 0) lines = [text.slice(0, cut).trim(), text.slice(cut).trim()];
  }
  const longest = lines.reduce((a, b) => (a.length > b.length ? a : b));
  fitFont(c, longest, 900, DISPLAY, Math.round(h * (lines.length > 1 ? 0.13 : 0.16)), w * 0.7);
  const size = parseInt(c.font.match(/(\d+)px/)[1], 10);
  const lead = size * 1.2;
  const textW = Math.max(...lines.map((line) => c.measureText(line).width));
  const plateW = textW + size * 1.6;
  const plateH = lead * lines.length + size * 0.9;
  const skew = plateH * 0.22;
  const shadow = h * 0.04;
  c.save();
  c.translate(w / 2, h / 2);
  c.rotate(-0.06);
  const plate = (dx, dy) => {
    c.beginPath();
    c.moveTo(-plateW / 2 + skew + dx, -plateH / 2 + dy);
    c.lineTo(plateW / 2 + skew + dx, -plateH / 2 + dy);
    c.lineTo(plateW / 2 - skew + dx, plateH / 2 + dy);
    c.lineTo(-plateW / 2 - skew + dx, plateH / 2 + dy);
    c.closePath();
  };
  plate(shadow, shadow);
  c.fillStyle = "#1a1714";
  c.fill();
  plate(0, 0);
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = h * 0.022;
  c.lineJoin = "miter";
  c.strokeStyle = "#1a1714";
  c.stroke();
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = ink;
  lines.forEach((line, i) => c.fillText(line, 0, (i - (lines.length - 1) / 2) * lead + size * 0.05));
  // the chip, half off the plate's top-left corner
  const chip = h * 0.15;
  c.translate(-plateW / 2 + skew - chip * 0.15, -plateH / 2 - chip * 0.1);
  c.rotate(-0.12);
  c.fillStyle = "#1a1714";
  c.fillRect(-chip / 2, -chip / 2, chip, chip);
  c.fillStyle = "#ffdd00";
  c.font = `900 ${Math.round(chip * 0.7)}px serif`;
  c.fillText("斬", 0, chip * 0.04);
  c.restore();
}

// Enma's blade, printed in the blade's own coordinates (x along it, y across, in world units):
// a black back, a cyan band and purple flames licking up from a lilac edge.
// `bow(x)` is the blade's curve; `length` its straight length; `width` the canvas's span in x.
export function drawEnmaBlade(c, w, h, { bow, length, width, yMin, yMax }) {
  c.clearRect(0, 0, w, h);
  const toRow = (y) => (1 - (y - yMin) / (yMax - yMin)) * h;
  for (let px = 0; px < w; px++) {
    const x = (px / w) * width;
    const t = Math.min(1, x / length);
    const edge = bow(Math.min(x, length)) - 0.055 * (1 - 0.3 * t);
    const spine = bow(Math.min(x, length)) + 0.05;
    const at = (f) => toRow(edge + (spine - edge) * f);
    const flame = 0.36 + 0.09 * Math.sin(x * 38) + 0.05 * Math.sin(x * 91 + 2);
    const band = 0.66 + 0.06 * Math.sin(x * 29 + 1);
    [[0, 0.12, "#e9d5ff"], [0.12, flame, "#9333ea"], [flame, band, "#22d3ee"], [band, 1.05, "#1a1714"]].forEach(([from, to, color]) => {
      c.fillStyle = color;
      c.fillRect(px, at(to), 1.5, at(from) - at(to) + 1);
    });
  }
  drawBladePolish(c, w, h, { bow, length, width, yMin, yMax });
}

// A little five-petalled yellow flower, the crest on Enma's scabbard and handle
export function drawEnmaFlower(c, w, h) {
  c.clearRect(0, 0, w, h);
  const r = w * 0.17;
  c.lineWidth = w * 0.05;
  c.strokeStyle = "#1a1714";
  c.fillStyle = "#ffdd00";
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    c.beginPath();
    c.arc(w / 2 + Math.cos(a) * r * 1.15, h / 2 + Math.sin(a) * r * 1.15, r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
  c.beginPath();
  c.arc(w / 2, h / 2, r * 0.75, 0, Math.PI * 2);
  c.fillStyle = "#ff7a1a";
  c.fill();
  c.stroke();
}

// Wado Ichimonji: a black back over a clean white edge, split by a soft straight hamon
export function drawWadoBlade(c, w, h, { bow, length, width, yMin, yMax }) {
  c.clearRect(0, 0, w, h);
  const toRow = (y) => (1 - (y - yMin) / (yMax - yMin)) * h;
  for (let px = 0; px < w; px++) {
    const x = (px / w) * width;
    const t = Math.min(1, x / length);
    const edge = bow(Math.min(x, length)) - 0.055 * (1 - 0.3 * t);
    const spine = bow(Math.min(x, length)) + 0.05;
    const at = (f) => toRow(edge + (spine - edge) * f);
    const wave = 0.32 + 0.04 * Math.sin(x * 42) + 0.02 * Math.sin(x * 110);
    [[0, 0.15, "#ffffff"], [0.15, wave + 0.12, "#eef2f7"], [wave + 0.12, wave + 0.2, "#94a3b8"], [wave + 0.2, 1.05, "#1a1714"]].forEach(([from, to, color]) => {
      c.fillStyle = color;
      c.fillRect(px, at(to), 1.5, at(from) - at(to) + 1);
    });
  }
  drawBladePolish(c, w, h, { bow, length, width, yMin, yMax });
}

// Sandai Kitetsu: a black back, a white body and a jagged violet hamon along the edge
export function drawKitetsuBlade(c, w, h, { bow, length, width, yMin, yMax }) {
  c.clearRect(0, 0, w, h);
  const toRow = (y) => (1 - (y - yMin) / (yMax - yMin)) * h;
  for (let px = 0; px < w; px++) {
    const x = (px / w) * width;
    const t = Math.min(1, x / length);
    const edge = bow(Math.min(x, length)) - 0.055 * (1 - 0.3 * t);
    const spine = bow(Math.min(x, length)) + 0.05;
    const at = (f) => toRow(edge + (spine - edge) * f);
    const flame = 0.26 + 0.08 * Math.sin(x * 48) + 0.05 * Math.sin(x * 124 + 1);
    const back = 0.62 + 0.03 * Math.sin(x * 32);
    [[0, 0.08, "#c4b5fd"], [0.08, flame, "#6d28d9"], [flame, back, "#f8fafc"], [back, 1.05, "#1a1714"]].forEach(([from, to, color]) => {
      c.fillStyle = color;
      c.fillRect(px, at(to), 1.5, at(from) - at(to) + 1);
    });
  }
  drawBladePolish(c, w, h, { bow, length, width, yMin, yMax });
}

// TubeGeometry uses u along the saya, v around it. Highlights wrap seamlessly.
// `sheen` lays the round saya's gloss band across it; a flat shell can leave it off
export function drawSayaLacquer(c, w, h, { color, sheen: glossy = true }) {
  c.fillStyle = color;
  c.fillRect(0, 0, w, h);
  if (glossy) {
    const sheen = c.createLinearGradient(0, 0, 0, h);
    [[0, "rgba(0,0,0,.08)"], [0.2, "rgba(0,0,0,.22)"],
      [0.43, "rgba(255,255,255,.04)"], [0.5, "rgba(255,255,255,.3)"],
      [0.57, "rgba(255,255,255,.04)"], [0.8, "rgba(0,0,0,.22)"],
      [1, "rgba(0,0,0,.08)"]].forEach(([at, tone]) => sheen.addColorStop(at, tone));
    c.fillStyle = sheen;
    c.fillRect(0, 0, w, h);
  }
  // Restrained lengthwise lacquer grain and small handling marks.
  let seed = 9413;
  const rand = () => ((seed = seed * 16807 % 2147483647) / 2147483647);
  for (let i = 0; i < 240; i++) {
    c.fillStyle = i % 3 ? "rgba(0,0,0,.045)" : "rgba(255,255,255,.12)";
    c.fillRect(rand() * w, rand() * h, 2 + rand() * w * 0.14, 0.5);
  }
}

// Fine longitudinal polishing lines follow the blade's curve and remain inside its edge. Over
// them, the steel in toon terms: the shinogi (the ridge line) inked along the blade, a bright
// band of polished steel just under it and a burnished, darker one above, a hard white line
// down the cutting edge, the yokote where the point begins, slanted bars of reflected light,
// and the fine sparkle of nie scattered along the temper line.
function drawBladePolish(c, w, h, { bow, length, width, yMin, yMax }) {
  const row = (x, f) => {
    const edge = bow(x) - 0.055 * (1 - 0.3 * x / length);
    return (1 - (edge + (bow(x) + 0.05 - edge) * f - yMin) / (yMax - yMin)) * h;
  };
  const strip = (f0, f1, color) => {
    c.beginPath();
    for (let px = 0; px <= w; px += 4) {
      const x = Math.min(px / w * width, length);
      (px ? c.lineTo : c.moveTo).call(c, px, row(x, f0));
    }
    for (let px = w; px >= 0; px -= 4) c.lineTo(px, row(Math.min(px / w * width, length), f1));
    c.closePath();
    c.fillStyle = color;
    c.fill();
  };
  strip(0.5, 0.6, "rgba(255,255,255,.42)");
  strip(0.64, 0.86, "rgba(0,0,0,.16)");
  strip(0.6, 0.64, "rgba(26,23,20,.55)");
  strip(0.02, 0.07, "rgba(255,255,255,.75)");
  const yx = (length / width) * w;
  c.fillStyle = "rgba(26,23,20,.5)";
  c.fillRect(yx - 1, row(length, 1), 2.5, row(length, 0) - row(length, 1));
  // slanted bars of light: a broad one and a thin one, twice along the blade
  c.fillStyle = "rgba(255,255,255,.28)";
  [[0.28, 0.03], [0.32, 0.008], [0.66, 0.025], [0.695, 0.007]].forEach(([at, wd]) => {
    c.beginPath();
    c.moveTo(w * at, h);
    c.lineTo(w * (at + wd), h);
    c.lineTo(w * (at + wd + 0.03), 0);
    c.lineTo(w * (at + 0.03), 0);
    c.closePath();
    c.fill();
  });
  let r = 4447;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  c.fillStyle = "rgba(255,255,255,.85)";
  for (let i = 0; i < 260; i++) {
    const px = rand() * w;
    const x = px / w * width;
    if (x > length) continue;
    c.fillRect(px, row(x, 0.12 + rand() * 0.3), 1.5, 1.5);
  }
  c.save();
  c.lineWidth = 0.6;
  for (let i = 1; i < 14; i++) {
    c.strokeStyle = i % 3 ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)";
    c.beginPath();
    for (let px = 0; px <= w; px += 3) {
      const x = px / w * width;
      if (x > length) break;
      const edge = bow(x) - 0.055 * (1 - 0.3 * x / length);
      const y = edge + (bow(x) + 0.05 - edge) * i / 15;
      const row = (1 - (y - yMin) / (yMax - yMin)) * h;
      if (px === 0) c.moveTo(px, row);
      else c.lineTo(px, row);
    }
    c.stroke();
  }
  c.restore();
}

// A katana's handle wrap (tsuka-ito), for a cylinder laid along the handle: v runs along it,
// u around it. The cord crosses over itself and leaves a row of diamonds of the ray skin
// underneath showing on the front (u = 0) and the back (u = 0.5).
export function drawTsukaWrap(c, w, h, { cord, skin, diamonds = 7 }) {
  c.fillStyle = cord;
  c.fillRect(0, 0, w, h);
  // Diagonal silk fibres across the wrap, with alternating light and dark threads.
  c.save();
  c.lineWidth = 0.8;
  for (let y = -w; y < h + w; y += 3) {
    c.strokeStyle = y % 2 ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.2)";
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(w, y + w * 0.6);
    c.stroke();
  }
  c.restore();
  const step = h / diamonds;
  c.lineWidth = Math.max(2, w * 0.012);
  c.strokeStyle = "rgba(0,0,0,0.35)";
  [0, w / 2, w].forEach((cx) => {
    for (let i = 0; i < diamonds; i++) {
      const cy = (i + 0.5) * step;
      c.beginPath();
      c.moveTo(cx, cy - step * 0.42);
      c.lineTo(cx + w * 0.11, cy);
      c.lineTo(cx, cy + step * 0.42);
      c.lineTo(cx - w * 0.11, cy);
      c.closePath();
      c.fillStyle = skin;
      c.fill();
      // Pebbled ray skin stays clipped to each diamond opening.
      c.save();
      c.clip();
      for (let py = cy - step * 0.42; py < cy + step * 0.42; py += 5) {
        for (let px = cx - w * 0.11; px < cx + w * 0.11; px += 5) {
          c.fillStyle = "rgba(255,255,255,.28)";
          c.beginPath();
          c.arc(px + (Math.round(py / 5) % 2) * 2.5, py, 1.2, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.restore();
      // Restore the diamond path after drawing the skin's individual nodules.
      c.beginPath();
      c.moveTo(cx, cy - step * 0.42);
      c.lineTo(cx + w * 0.11, cy);
      c.lineTo(cx, cy + step * 0.42);
      c.lineTo(cx - w * 0.11, cy);
      c.closePath();
      c.stroke();
      // the cord's crossing line between diamonds
      c.beginPath();
      c.moveTo(cx - w * 0.16, cy + step * 0.5);
      c.lineTo(cx + w * 0.16, cy + step * 0.5);
      c.stroke();
    }
  });
}

