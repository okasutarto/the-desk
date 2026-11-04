// ---------- roller blind cloth ----------
// One square repeat of the blind's cloth, `size` px across, tiling seamlessly on every side.
// The print is flat and hard-edged in a shade of the cloth's own colour (lighter on a dark cloth,
// darker on a light one). Only the plain cloth carries a weave (faint weft lines and lighter
// slubs); the prints stay clean, flat colour.
function mixHex(hex, target, t) {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(target.slice(1), 16);
  const channel = (shift) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
}

export function blindInk(colour) {
  const n = parseInt(colour.slice(1), 16);
  const light = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150;
  return light ? mixHex(colour, "#262a33", 0.3) : mixHex(colour, "#ffffff", 0.32);
}

// The roll is the same cloth wound tight, so it shows a shade darker
export function blindRollColour(colour) {
  return mixHex(colour, "#20232a", 0.25);
}

export function drawBlindCloth(c, size, { pattern = "plain", colour = "#a4aab3" } = {}) {
  const s = size / 256; // everything is laid out on a 256 px repeat
  let seed = 913;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ink = blindInk(colour);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.fillStyle = colour;
  c.fillRect(0, 0, size, size);
  c.scale(s, s);
  c.fillStyle = ink;
  c.strokeStyle = ink;
  if (pattern === "plain") {
    // only the plain cloth shows its weave: faint weft lines and a few lighter slubs
    c.fillStyle = "rgba(40,44,54,.05)";
    for (let y = 0; y < 256; y += 8) c.fillRect(0, y, 256, 1);
    for (let k = 0; k < 12; k++) {
      c.fillStyle = `rgba(232,236,242,${0.25 + rand() * 0.15})`;
      const x = rand() * 256;
      const y = Math.floor(rand() * 32) * 8 + 3;
      const w = 14 + rand() * 30;
      c.fillRect(x, y, w, 2);
      if (x + w > 256) c.fillRect(x - 256, y, w, 2); // carried round onto the next repeat
    }
  } else if (pattern === "stripes") {
    // one broad band to the repeat, with a thin twin beside it
    c.fillRect(48, 0, 96, 256);
    c.fillRect(176, 0, 14, 256);
  } else if (pattern === "pinstripe") {
    for (let x = 28; x < 256; x += 64) c.fillRect(x, 0, 5, 256);
  } else if (pattern === "gingham") {
    // see-through bands both ways, so where they cross the check comes out a shade deeper
    c.globalAlpha = 0.5;
    for (let p = 0; p < 256; p += 128) {
      c.fillRect(p, 0, 64, 256);
      c.fillRect(0, p, 256, 64);
    }
    c.globalAlpha = 1;
  } else if (pattern === "dots") {
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        [[32, 32], [96, 96]].forEach(([dx, dy]) => {
          c.beginPath();
          c.arc(x * 128 + dx, y * 128 + dy, 18, 0, Math.PI * 2);
          c.fill();
        });
      }
    }
  } else if (pattern === "zigzag") {
    c.lineWidth = 18;
    c.lineJoin = "miter";
    for (let y = 64; y < 256; y += 128) {
      c.beginPath();
      for (let x = -64; x <= 320; x += 64) c.lineTo(x, y + ((x / 64) % 2 === 0 ? -26 : 26));
      c.stroke();
    }
  } else if (pattern === "leaves") {
    // a leaf to each cell, turned every which way and kept inside it so the repeat stays seamless
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        c.save();
        c.translate(x * 128 + 64 + (rand() - 0.5) * 24, y * 128 + 64 + (rand() - 0.5) * 24);
        c.rotate(rand() * Math.PI * 2);
        c.beginPath();
        c.moveTo(-40, 0);
        c.quadraticCurveTo(0, -26, 40, 0);
        c.quadraticCurveTo(0, 26, -40, 0);
        c.fill();
        c.strokeStyle = colour;
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(-32, 0);
        c.lineTo(32, 0);
        c.stroke();
        c.restore();
      }
    }
  }
  c.restore();
}
