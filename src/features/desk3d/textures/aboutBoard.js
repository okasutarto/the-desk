import { ABOUT_STACK } from "@/data/about";
import { BODY, DISPLAY, fitFont, wrap } from "./base";

// ---------- pinned About board (same content as the 2D sticker board) ----------
export function drawAboutBoard(c, w, h) {
  // Cork: a warm base, then granules in a few shades, big and small, so it reads as pressed cork
  c.fillStyle = "#cb9b67";
  c.fillRect(0, 0, w, h);
  let r = 4111;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const GRAINS = ["rgba(70,40,15,.2)", "rgba(70,40,15,.12)", "rgba(255,230,190,.22)", "rgba(140,85,40,.25)"];
  for (let i = 0; i < (w * h) / 55; i++) {
    c.fillStyle = GRAINS[i % GRAINS.length];
    const s = 1 + rand() * (i % 7 === 0 ? 4 : 2);
    c.beginPath();
    c.ellipse(rand() * w, rand() * h, s, s * (0.5 + rand() * 0.6), rand() * Math.PI, 0, Math.PI * 2);
    c.fill();
  }
  // Old pin holes from notes long gone
  for (let i = 0; i < 26; i++) {
    const x = rand() * w;
    const y = h * 0.12 + rand() * h * 0.85;
    c.fillStyle = "rgba(40,20,5,.55)";
    c.beginPath();
    c.arc(x, y, w * 0.0022, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(255,235,200,.35)";
    c.beginPath();
    c.arc(x + 1, y + 1.5, w * 0.002, 0, Math.PI);
    c.fill();
  }

  // Stickers slapped on the cork: flat colour, a thick black edge and a hard shadow
  const sticker = (x, y, turn, draw) => {
    c.save();
    c.translate(w * x, h * y);
    c.rotate(turn);
    c.fillStyle = "#000";
    c.save();
    c.translate(w * 0.004, w * 0.004);
    draw(true);
    c.restore();
    draw(false);
    c.restore();
  };
  const u = w / 100;
  const shape = (path, fill) => (shadow) => {
    c.beginPath();
    path();
    c.fillStyle = shadow ? "#000" : fill;
    c.fill();
    if (!shadow) {
      c.lineWidth = u * 0.35;
      c.strokeStyle = "#000";
      c.stroke();
    }
  };
  // a code bracket badge
  sticker(0.7, 0.075, -0.2, (shadow) => {
    shape(() => c.roundRect(-u * 3.4, -u * 2, u * 6.8, u * 4, u * 1.2), "#00e0c6")(shadow);
    if (shadow) return;
    c.fillStyle = "#000";
    c.font = `900 ${Math.round(u * 2.6)}px ${DISPLAY}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("</>", 0, u * 0.2);
  });
  // a lightning bolt
  sticker(0.355, 0.13, 0.25, shape(() => {
    c.moveTo(u * 0.6, -u * 3);
    c.lineTo(-u * 1.8, u * 0.4);
    c.lineTo(-u * 0.1, u * 0.4);
    c.lineTo(-u * 0.8, u * 3);
    c.lineTo(u * 1.9, -u * 0.6);
    c.lineTo(u * 0.2, -u * 0.6);
    c.closePath();
  }, "#ffdd00"));
  // a star
  sticker(0.965, 0.93, 0.3, shape(() => {
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? u * 1.1 : u * 2.5;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      if (i) c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
  }, "#ff90e8"));
  // a round "hello" sticker
  sticker(0.62, 0.95, -0.15, (shadow) => {
    shape(() => c.arc(0, 0, u * 2.4, 0, Math.PI * 2), "#ff6b6b")(shadow);
    if (shadow) return;
    c.fillStyle = "#fffdf5";
    c.font = `900 ${Math.round(u * 1.2)}px ${DISPLAY}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("HELLO!", 0, u * 0.1);
  });

  // A marker smiley on the cork
  c.strokeStyle = "rgba(17,17,17,.75)";
  c.lineWidth = u * 0.3;
  c.lineCap = "round";
  c.beginPath();
  c.arc(w * 0.83, h * 0.12, u * 1.6, 0, Math.PI * 2);
  c.moveTo(w * 0.83 - u * 0.9, h * 0.12 + u * 0.3);
  c.quadraticCurveTo(w * 0.83, h * 0.12 + u * 1.2, w * 0.83 + u * 0.9, h * 0.12 + u * 0.3);
  c.stroke();
  c.fillStyle = "rgba(17,17,17,.75)";
  [-0.5, 0.5].forEach((dx) => c.fillRect(w * 0.83 + dx * u - u * 0.15, h * 0.12 - u * 0.6, u * 0.3, u * 0.6));

  // The heading on a strip of masking tape, torn at both ends, cut a little longer than the word
  const HEADING = "GUESTBOOK";
  c.font = `900 ${Math.round(h * 0.055)}px ${DISPLAY}`;
  const tw = Math.max(w * 0.24, c.measureText(HEADING).width + w * 0.05);
  const th = h * 0.085;
  c.save();
  c.translate(w / 2, h * 0.07);
  c.rotate(-0.025);
  c.fillStyle = "rgba(0,0,0,.25)";
  c.fillRect(-tw / 2 + 4, -th / 2 + 4, tw, th);
  c.beginPath();
  c.moveTo(-tw / 2, -th / 2);
  c.lineTo(tw / 2, -th / 2);
  for (let i = 0; i <= 6; i++) c.lineTo(tw / 2 + (i % 2 ? -1 : 1) * u * 0.5, -th / 2 + (th * i) / 6);
  c.lineTo(-tw / 2, th / 2);
  for (let i = 6; i >= 0; i--) c.lineTo(-tw / 2 + (i % 2 ? 1 : -1) * u * 0.5, -th / 2 + (th * i) / 6);
  c.closePath();
  c.fillStyle = "#f3e7c4";
  c.fill();
  c.fillStyle = "#111";
  c.font = `900 ${Math.round(h * 0.055)}px ${DISPLAY}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(HEADING, 0, th * 0.06);
  c.restore();
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
}

// Each paper on the board is its own kind of stationery: a page torn from a lined notebook, sticky
// notes with a doodle each, a sticker sheet of the stack, an index card for what's being built, a
// little map postcard, and a label-maker strip for the resume.
const PAPER_COLORS = { years: "#ffdd00", projects: "#00e0c6", companies: "#7fb2ff", stack: "#ff90e8", now: "#c4b5fd", resume: "#141414" };
// Fine grain and a faint shadow where the paper lifts off the board at its lower right corner
function paperFinish(c, w, h, seed = 1) {
  let r = seed * 9301;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < (w * h) / 900; i++) {
    c.fillStyle = rand() < 0.5 ? "rgba(0,0,0,.035)" : "rgba(255,255,255,.08)";
    c.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1);
  }
  const curl = c.createLinearGradient(w * 0.75, h * 0.75, w, h);
  curl.addColorStop(0, "rgba(0,0,0,0)");
  curl.addColorStop(1, "rgba(0,0,0,.14)");
  c.fillStyle = curl;
  c.fillRect(0, 0, w, h);
}
// Text with a hard offset shadow, like the site's headings
function shadowText(c, text, x, y, color, shadow, d) {
  c.fillStyle = shadow;
  c.fillText(text, x + d, y + d);
  c.fillStyle = color;
  c.fillText(text, x, y);
}
const HAND = "'Caveat', cursive";

function drawWhoNote(c, w, h, note) {
  // lined notebook paper torn from a spiral pad
  c.fillStyle = "#fffdf5";
  c.fillRect(0, 0, w, h);
  const rule = h * 0.085;
  const first = h * 0.3;
  c.strokeStyle = "rgba(59,130,246,.28)";
  c.lineWidth = Math.max(1, w * 0.003);
  for (let y = first; y < h - rule * 0.3; y += rule) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(w, y);
    c.stroke();
  }
  const margin = w * 0.12;
  c.strokeStyle = "rgba(225,29,72,.5)";
  c.beginPath();
  c.moveTo(margin, 0);
  c.lineTo(margin, h);
  c.stroke();
  // punched holes down the left, and the torn perforation along the top
  [0.3, 0.55, 0.8].forEach((k) => {
    c.fillStyle = "#cb9b67";
    c.beginPath();
    c.arc(w * 0.055, h * k, w * 0.018, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(0,0,0,.25)";
    c.lineWidth = 1.5;
    c.stroke();
  });
  c.fillStyle = "rgba(0,0,0,.12)";
  for (let x = 0; x < w; x += w * 0.025) c.fillRect(x, h * 0.03, w * 0.012, w * 0.006);
  // the heading in marker, then the note in handwriting sitting on the rules
  c.textBaseline = "alphabetic";
  fitFont(c, note.title.toUpperCase(), 800, DISPLAY, Math.round(h * 0.11), w - margin - w * 0.1);
  shadowText(c, note.title.toUpperCase(), margin + w * 0.035, first - rule * 0.35, "#1a1714", "#ffdd00", w * 0.006);
  const size = rule * 0.82;
  c.font = `700 ${Math.round(size)}px ${HAND}`;
  const plain = note.body.replace(/<[^>]*>/g, "");
  const marked = (note.body.match(/<mark[^>]*>(.*?)<\/mark>/) || [])[1] || "";
  const words = plain.split(" ");
  const markStart = marked ? plain.indexOf(marked) : -1;
  let x = margin + w * 0.035;
  let y = first + rule - rule * 0.18;
  let at = 0;
  words.forEach((word) => {
    const ww = c.measureText(word + " ").width;
    if (x + ww > w - w * 0.04) {
      x = margin + w * 0.035;
      y += rule;
    }
    if (y > h - rule * 0.2) return;
    // the name gets a highlighter stroke
    if (markStart >= 0 && at >= markStart && at < markStart + marked.length) {
      c.fillStyle = "rgba(255,221,0,.75)";
      c.fillRect(x - 2, y - size * 0.62, c.measureText(word).width + 6, size * 0.68);
    }
    c.fillStyle = "#1e2a5a";
    c.fillText(word, x, y);
    x += ww;
    at += word.length + 1;
  });
  // a doodled star in the corner
  c.strokeStyle = "#e11d48";
  c.lineWidth = w * 0.006;
  c.beginPath();
  const sx = w * 0.9;
  const sy = h * 0.88;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
    c[i ? "lineTo" : "moveTo"](sx + Math.cos(a) * w * 0.04, sy + Math.sin(a) * w * 0.04);
  }
  c.closePath();
  c.stroke();
  paperFinish(c, w, h, 3);
}

// A tiny doodle per statistic: a calendar page, a folder, a building
function statDoodle(c, id, x, y, s) {
  c.save();
  c.translate(x, y);
  c.lineWidth = s * 0.07;
  c.strokeStyle = "#1a1714";
  c.fillStyle = "rgba(255,255,255,.85)";
  c.lineJoin = "round";
  if (id === "years") {
    c.fillRect(0, s * 0.15, s, s * 0.85);
    c.strokeRect(0, s * 0.15, s, s * 0.85);
    c.fillStyle = "#e11d48";
    c.fillRect(0, s * 0.15, s, s * 0.22);
    c.strokeRect(0, s * 0.15, s, s * 0.22);
    [0.25, 0.75].forEach((k) => {
      c.beginPath();
      c.moveTo(s * k, 0);
      c.lineTo(s * k, s * 0.3);
      c.stroke();
    });
    c.fillStyle = "#1a1714";
    for (let i = 0; i < 6; i++) c.fillRect(s * (0.14 + (i % 3) * 0.28), s * (0.5 + Math.floor(i / 3) * 0.24), s * 0.14, s * 0.12);
  } else if (id === "projects") {
    c.beginPath();
    c.moveTo(0, s * 0.2);
    c.lineTo(s * 0.4, s * 0.2);
    c.lineTo(s * 0.5, s * 0.32);
    c.lineTo(s, s * 0.32);
    c.lineTo(s, s * 0.95);
    c.lineTo(0, s * 0.95);
    c.closePath();
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(s * 0.25, s * 0.66);
    c.lineTo(s * 0.45, s * 0.8);
    c.lineTo(s * 0.78, s * 0.5);
    c.strokeStyle = "#16a34a";
    c.lineWidth = s * 0.1;
    c.stroke();
  } else {
    c.fillRect(s * 0.1, s * 0.1, s * 0.5, s * 0.9);
    c.strokeRect(s * 0.1, s * 0.1, s * 0.5, s * 0.9);
    c.fillRect(s * 0.6, s * 0.4, s * 0.35, s * 0.6);
    c.strokeRect(s * 0.6, s * 0.4, s * 0.35, s * 0.6);
    c.fillStyle = "#1a1714";
    for (let i = 0; i < 6; i++) c.fillRect(s * (0.2 + (i % 2) * 0.2), s * (0.22 + Math.floor(i / 2) * 0.22), s * 0.1, s * 0.1);
  }
  c.restore();
}
function drawStatNote(c, w, h, note) {
  const base = PAPER_COLORS[note.id];
  c.fillStyle = base;
  c.fillRect(0, 0, w, h);
  // the sticky strip along the top, a shade deeper
  c.fillStyle = "rgba(0,0,0,.07)";
  c.fillRect(0, 0, w, h * 0.2);
  c.textBaseline = "alphabetic";
  c.font = `900 ${Math.round(h * 0.42)}px ${DISPLAY}`;
  shadowText(c, note.value, w * 0.08, h * 0.68, "#1a1714", "rgba(255,255,255,.7)", w * 0.02);
  fitFont(c, note.label.toUpperCase(), 800, BODY, Math.round(h * 0.1), w * 0.84);
  c.fillStyle = "#1a1714";
  c.fillText(note.label.toUpperCase(), w * 0.08, h * 0.86);
  // an underline scribble under the label
  c.strokeStyle = "rgba(26,23,20,.55)";
  c.lineWidth = h * 0.012;
  c.beginPath();
  for (let x = w * 0.08; x <= w * 0.62; x += w * 0.04) c.lineTo(x, h * 0.91 + Math.sin(x * 0.2) * h * 0.008);
  c.stroke();
  // In the top right corner, clear of the number and the pin in the middle
  statDoodle(c, note.id, w * 0.72, h * 0.05, w * 0.2);
  paperFinish(c, w, h, note.id.length);
}

function drawStackNote(c, w, h) {
  // a sticker sheet: each tool a little sticker with a hard shadow
  c.fillStyle = PAPER_COLORS.stack;
  c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(0,0,0,.12)";
  c.setLineDash([w * 0.012, w * 0.012]);
  c.lineWidth = 2;
  c.strokeRect(w * 0.03, h * 0.04, w * 0.94, h * 0.92);
  c.setLineDash([]);
  const pad = w * 0.075;
  c.textBaseline = "top";
  c.font = `900 ${Math.round(w * 0.065)}px ${DISPLAY}`;
  shadowText(c, "STACK", pad, h * 0.09, "#1a1714", "#fffdf5", w * 0.006);
  const STICKERS = ["#fffdf5", "#ffdd00", "#00e0c6", "#7fb2ff", "#c4b5fd"];
  // Each group on its own row: its name in the left column, its stickers wrapping to the right
  let y = h * 0.27;
  const chipH = w * 0.064;
  const left = pad + w * 0.17;
  ABOUT_STACK.forEach((group, g) => {
    c.font = `800 ${Math.round(w * 0.032)}px ${BODY}`;
    c.fillStyle = "rgba(26,23,20,.7)";
    c.fillText(group.label.toUpperCase(), pad, y + chipH * 0.25);
    let x = left;
    c.font = `700 ${Math.round(w * 0.038)}px ${BODY}`;
    group.items.forEach((item, i) => {
      const cw = c.measureText(item).width + w * 0.04;
      if (x + cw > w - pad) {
        x = left;
        y += chipH + w * 0.014;
      }
      c.fillStyle = "#1a1714";
      c.beginPath();
      c.roundRect(x + 3, y + 3, cw, chipH, chipH / 2);
      c.fill();
      c.fillStyle = STICKERS[(g + i) % STICKERS.length];
      c.beginPath();
      c.roundRect(x, y, cw, chipH, chipH / 2);
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = "#1a1714";
      c.stroke();
      c.fillStyle = "#1a1714";
      c.fillText(item, x + w * 0.02, y + chipH * 0.2);
      x += cw + w * 0.016;
    });
    y += chipH + w * 0.03;
  });
  paperFinish(c, w, h, 7);
}

function drawNowNote(c, w, h, note) {
  // an index card: a red heading rule, blue lines, a progress bar and a WIP stamp
  c.fillStyle = PAPER_COLORS.now;
  c.fillRect(0, 0, w, h);
  c.fillStyle = "rgba(255,255,255,.35)";
  c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(225,29,72,.45)";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, h * 0.42);
  c.lineTo(w, h * 0.42);
  c.stroke();
  c.strokeStyle = "rgba(59,130,246,.25)";
  [0.62, 0.78, 0.94].forEach((k) => {
    c.beginPath();
    c.moveTo(0, h * k);
    c.lineTo(w, h * k);
    c.stroke();
  });
  const pad = w * 0.06;
  c.textBaseline = "alphabetic";
  c.font = `900 ${Math.round(h * 0.17)}px ${DISPLAY}`;
  shadowText(c, note.title.toUpperCase(), pad, h * 0.37, "#1a1714", "#fffdf5", w * 0.004);
  c.font = `700 ${Math.round(h * 0.14)}px ${HAND}`;
  c.fillStyle = "#1e2a5a";
  wrap(c, note.body, w * 0.66, 3).forEach((line, i) => c.fillText(line, pad, h * (0.6 + i * 0.16)));
  // progress, and a rubber stamp
  const bx = w * 0.76;
  const bw = w * 0.19;
  c.fillStyle = "#fffdf5";
  c.fillRect(bx, h * 0.73, bw, h * 0.1);
  c.fillStyle = "#16a34a";
  c.fillRect(bx, h * 0.73, bw * 0.7, h * 0.1);
  c.strokeStyle = "#1a1714";
  c.lineWidth = 2;
  c.strokeRect(bx, h * 0.73, bw, h * 0.1);
  c.save();
  c.translate(w * 0.86, h * 0.5);
  c.rotate(-0.18);
  c.strokeStyle = "rgba(225,29,72,.8)";
  c.lineWidth = h * 0.025;
  c.strokeRect(-w * 0.08, -h * 0.1, w * 0.16, h * 0.2);
  c.fillStyle = "rgba(225,29,72,.85)";
  c.font = `900 ${Math.round(h * 0.13)}px ${DISPLAY}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("WIP", 0, h * 0.01);
  c.restore();
  c.textAlign = "left";
  paperFinish(c, w, h, 5);
}

function drawLocationNote(c, w, h, note) {
  // a little map card: the coast, the Kapuas river, and the equator running right through town
  c.fillStyle = "#fffdf5";
  c.fillRect(0, 0, w, h);
  const mx = w * 0.08;
  const my = h * 0.44;
  const mw = w * 0.84;
  const mh = h * 0.34;
  c.fillStyle = "#a8ecff";
  c.fillRect(mx, my, mw, mh);
  c.fillStyle = "#8fd694";
  c.beginPath();
  c.moveTo(mx + mw * 0.3, my);
  c.bezierCurveTo(mx + mw * 0.2, my + mh * 0.4, mx + mw * 0.35, my + mh * 0.7, mx + mw * 0.25, my + mh);
  c.lineTo(mx + mw, my + mh);
  c.lineTo(mx + mw, my);
  c.closePath();
  c.fill();
  c.strokeStyle = "#3b82f6";
  c.lineWidth = h * 0.02;
  c.beginPath();
  c.moveTo(mx + mw * 0.3, my + mh * 0.55);
  c.bezierCurveTo(mx + mw * 0.55, my + mh * 0.45, mx + mw * 0.7, my + mh * 0.75, mx + mw, my + mh * 0.6);
  c.stroke();
  c.setLineDash([w * 0.03, w * 0.025]);
  c.strokeStyle = "#e11d48";
  c.lineWidth = h * 0.012;
  c.beginPath();
  c.moveTo(mx, my + mh * 0.3);
  c.lineTo(mx + mw, my + mh * 0.3);
  c.stroke();
  c.setLineDash([]);
  c.strokeStyle = "#1a1714";
  c.lineWidth = 2;
  c.strokeRect(mx, my, mw, mh);
  // the pin on town
  const px = mx + mw * 0.36;
  const py = my + mh * 0.3;
  c.fillStyle = "#d946ef";
  c.beginPath();
  c.arc(px, py - h * 0.05, h * 0.035, Math.PI, 0);
  c.lineTo(px, py);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = "#1a1714";
  c.textBaseline = "alphabetic";
  c.font = `700 ${Math.round(h * 0.05)}px ${BODY}`;
  c.fillText("0° EQUATOR", mx + mw * 0.45, my + mh * 0.25);
  // Below the pin, which sits at the top middle
  fitFont(c, note.title.toUpperCase(), 900, BODY, Math.round(h * 0.11), w * 0.84);
  c.fillText(note.title.toUpperCase(), w * 0.08, h * 0.37);
  c.font = `600 ${Math.round(h * 0.075)}px ${BODY}`;
  c.fillStyle = "rgba(26,23,20,.7)";
  c.fillText(note.body, w * 0.08, h * 0.9);
  paperFinish(c, w, h, 11);
}

function drawResumeNote(c, w, h, note) {
  // embossed label-maker tape
  c.fillStyle = PAPER_COLORS.resume;
  c.fillRect(0, 0, w, h);
  c.fillStyle = "rgba(255,255,255,.06)";
  for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
  c.fillStyle = "rgba(255,255,255,.12)";
  [w * 0.015, w * 0.975].forEach((x) => c.fillRect(x, 0, w * 0.01, h));
  c.textBaseline = "middle";
  fitFont(c, note.title.toUpperCase(), 900, BODY, Math.round(h * 0.44), w * 0.8);
  c.fillStyle = "rgba(0,0,0,.6)";
  c.fillText(note.title.toUpperCase(), w * 0.07 + 2, h * 0.55 + 2);
  c.fillStyle = "#f4f1ea";
  c.fillText(note.title.toUpperCase(), w * 0.07, h * 0.55);
}

export function drawAboutNote(c, w, h, note) {
  c.textAlign = "left";
  if (note.type === "stat") drawStatNote(c, w, h, note);
  else if (note.type === "stack") drawStackNote(c, w, h);
  else if (note.id === "who") drawWhoNote(c, w, h, note);
  else if (note.id === "now") drawNowNote(c, w, h, note);
  else if (note.id === "location") drawLocationNote(c, w, h, note);
  else if (note.id === "resume") drawResumeNote(c, w, h, note);
  else {
    c.fillStyle = "#fffdf5";
    c.fillRect(0, 0, w, h);
  }
  c.textBaseline = "alphabetic";
  return note.href ? [{ x: 0, y: 0, w, h, href: note.href }] : [];
}


// Shared with the other texture modules
export { paperFinish };
