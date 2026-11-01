import { paintScenery } from "../wallpapers";
import { SCREEN_W, SCREEN_H, GREEN } from "./config";
import { surface, roundRect, seeded, grainOver, halftone, gloss } from "./canvas";

// ---------- theme: the desktop follows the room's day and night ----------
const THEMES = {
  light: {
    // a cool sky and bold, plain colours: navy where the pink blob was, cobalt, teal, the
    // yellow sun with orange stripes
    sky: ["#a8dcff", "#eef8ff"], dots: "rgba(26,23,20,.09)", line: "#1a1714",
    shapes: ["#1e3a8a", "#00e0c6", "#ffdd00", "#3b82f6", "#ff7a1a"],
    bar: "rgba(255,253,245,.92)", ink: "#1a1714", edge: "#000",
    dock: "rgba(255,253,245,.75)", shelf: "rgba(26,23,20,.08)", tip: "#1a1714", tipInk: "#fffdf5", card: "#fffdf5",
  },
  dark: {
    sky: ["#2a2540", "#17151f"], dots: "rgba(196,185,220,.08)", line: "#0b0a10",
    shapes: ["#b05fa3", "#1f9c8e", "#c9a93a", "#5f7bc4", "#c97f45"],
    bar: "rgba(23,21,31,.92)", ink: "#ece8f7", edge: "#4b4466",
    dock: "rgba(42,37,64,.8)", shelf: "rgba(0,0,0,.25)", tip: "#ece8f7", tipInk: "#17151f", card: "#2a2540",
  },
};

// ---------- wallpaper: each toon sheet is painted once per theme and reused ----------
const wallpapers = {};
function sheetOf(id, name) {
  const key = `${id}-${name}`;
  if (!wallpapers[key]) {
    wallpapers[key] = surface(SCREEN_W, SCREEN_H);
    paintScenery(wallpapers[key].c, id, name, { halftone, grainOver, seeded });
  }
  return wallpapers[key];
}

function coverImage(c, image, x, y, w, h) {
  const scale = Math.max(w / image.width, h / image.height);
  const sw = w / scale, sh = h / scale;
  c.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, x, y, w, h);
}

// ---------- dock icons ----------
// Each is a little printed tile: a hard shadow, its colour, a gloss on top, grain, an outline
function drawIcon(c, id, x, y, s, { shadow = true } = {}) {
  const u = s / 32;
  if (shadow) {
    roundRect(c, x + 2 * u, y + 2.5 * u, s, s, 8 * u);
    c.fillStyle = "rgba(0,0,0,.8)";
    c.fill();
  }
  roundRect(c, x, y, s, s, 8 * u);
  c.fillStyle = { launchpad: "#3a3550", files: "#ffdd00", terminal: "#1a1714", spotifree: GREEN, code: "#4f7cff", wallpaper: "#b7c8ff", snake: "#8fd694", notes: "#fffdf5", mail: "#7fb2ff", messages: "#ff90e8" }[id];
  c.fill();
  gloss(c, x, y, s, s, { top: 0.32, foot: 0.16 });
  grainOver(c, 0.9);
  c.lineWidth = 2;
  c.strokeStyle = "#000";
  c.stroke();
  // a bright sliver along the top edge
  c.save();
  roundRect(c, x, y, s, s, 8 * u);
  c.clip();
  c.strokeStyle = "rgba(255,255,255,.45)";
  c.lineWidth = 1.2 * u;
  c.beginPath();
  c.moveTo(x + 7 * u, y + 2.6 * u);
  c.lineTo(x + s - 7 * u, y + 2.6 * u);
  c.stroke();
  c.restore();
  c.save();
  c.translate(x, y);
  c.scale(u, u);
  c.lineWidth = 2;
  c.strokeStyle = "#000";
  c.fillStyle = "#000";
  if (id === "launchpad") {
    // A grid of little app squares
    ["#ff90e8", "#ffdd00", "#00e0c6", "#7fb2ff", "#ffb35c", "#8fd694", "#fffdf5", "#ff6b6b", "#c4b5fd"].forEach((color, i) => {
      c.fillStyle = color;
      c.fillRect(7 + (i % 3) * 6.5, 7 + Math.floor(i / 3) * 6.5, 4.5, 4.5);
    });
  } else if (id === "wallpaper") {
    c.fillStyle = "#fff6bd";
    c.beginPath(); c.arc(22, 10, 4, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = "#589f84";
    c.beginPath(); c.moveTo(4, 26); c.lineTo(13, 12); c.lineTo(19, 20);
    c.lineTo(24, 16); c.lineTo(29, 26); c.closePath(); c.fill(); c.stroke();
  } else if (id === "code") {
    // Angle brackets and a slash
    c.strokeStyle = "#fff";
    c.lineWidth = 2.6;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(11, 11);
    c.lineTo(6.5, 16);
    c.lineTo(11, 21);
    c.moveTo(21, 11);
    c.lineTo(25.5, 16);
    c.lineTo(21, 21);
    c.moveTo(17.5, 9.5);
    c.lineTo(14.5, 22.5);
    c.stroke();
  } else if (id === "snake") {
    c.strokeStyle = "#1a1714";
    c.lineWidth = 4;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(7, 23);
    c.lineTo(7, 17);
    c.lineTo(16, 17);
    c.lineTo(16, 10);
    c.lineTo(24, 10);
    c.stroke();
    c.fillStyle = "#ff6b6b";
    c.beginPath();
    c.arc(24, 22, 2.6, 0, Math.PI * 2);
    c.fill();
  } else if (id === "files") {
    c.fillStyle = "#ffb35c";
    c.beginPath();
    c.moveTo(6, 11);
    c.lineTo(13, 11);
    c.lineTo(15, 13);
    c.lineTo(26, 13);
    c.lineTo(26, 24);
    c.lineTo(6, 24);
    c.closePath();
    c.fill();
    c.stroke();
  } else if (id === "terminal") {
    c.strokeStyle = "#8fd694";
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(8, 11);
    c.lineTo(13, 16);
    c.lineTo(8, 21);
    c.stroke();
    c.fillStyle = "#8fd694";
    c.fillRect(15, 20, 9, 2.5);
  } else if (id === "spotifree") {
    // A record with a green label
    c.beginPath();
    c.arc(16, 16, 10.5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,.35)";
    c.lineWidth = 1;
    c.beginPath();
    c.arc(16, 16, 7.5, 0.4, 2.2);
    c.stroke();
    c.fillStyle = GREEN;
    c.beginPath();
    c.arc(16, 16, 3.6, 0, Math.PI * 2);
    c.fill();
  } else if (id === "notes") {
    c.fillStyle = "#ffdd00";
    c.fillRect(2, 2, 28, 7);
    c.strokeStyle = "rgba(0,0,0,.35)";
    c.lineWidth = 1.5;
    [14, 19, 24].forEach((ly) => {
      c.beginPath();
      c.moveTo(7, ly);
      c.lineTo(25, ly);
      c.stroke();
    });
  } else if (id === "mail") {
    c.fillStyle = "#fff";
    c.fillRect(6, 10, 20, 13);
    c.strokeRect(6, 10, 20, 13);
    c.beginPath();
    c.moveTo(6, 10);
    c.lineTo(16, 18);
    c.lineTo(26, 10);
    c.stroke();
  } else if (id === "messages") {
    c.fillStyle = "#fff";
    // One closed outline keeps the tail joined to the balloon without a seam.
    c.lineJoin = "round";
    c.beginPath();
    c.ellipse(16, 15, 10, 7.5, 0, 2.35, 1.85 + Math.PI * 2);
    c.lineTo(8, 25);
    c.lineTo(16 + Math.cos(2.35) * 10, 15 + Math.sin(2.35) * 7.5);
    c.closePath();
    c.fill();
    c.stroke();
  }
  c.restore();
}

// ---------- Spotifree ----------

export { THEMES, sheetOf, coverImage, drawIcon };
