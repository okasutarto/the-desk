import { DISPLAY } from "./base";
import { WOODS, BRICKS, DEFAULT_BRICK, DEFAULT_SLATS } from "../woods";

// ---------- room details: the clock face, the guitar's top, straw, the chair's quilting ----------
// The wall clock's dial: bold hour bars and four numerals
export function drawClockFace(c, w, h) {
  const cx = w / 2;
  const r = w / 2;
  c.fillStyle = "#fffdf5";
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i += 5) {
    const a = (i / 60) * Math.PI * 2;
    const inner = r * 0.78;
    c.strokeStyle = "#1a1714";
    c.lineWidth = r * 0.035;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(cx + Math.sin(a) * inner, cx - Math.cos(a) * inner);
    c.lineTo(cx + Math.sin(a) * r * 0.92, cx - Math.cos(a) * r * 0.92);
    c.stroke();
  }
  c.fillStyle = "#1a1714";
  c.font = `900 ${Math.round(r * 0.2)}px ${DISPLAY}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  [["12", 0], ["3", 90], ["6", 180], ["9", 270]].forEach(([n, deg]) => {
    const a = (deg * Math.PI) / 180;
    c.fillText(n, cx + Math.sin(a) * r * 0.6, cx - Math.cos(a) * r * 0.6 + r * 0.01);
  });
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
}

// The guitar's top, laid out in the body outline's own units (x -1..1 across, y -0.95..1.92),
// in the room's neo-brutalist style: one flat colour, a faint halftone, a teal pickguard,
// thick black and white rings round the soundhole, and a few stickers with hard shadows
export function drawGuitarTop(c, w, h, { halfWidth = null } = {}) {
  const toX = (x) => ((x + 1) / 2) * w;
  const toY = (y) => (1 - (y + 0.95) / 2.87) * h;
  const ux = w / 2;
  const line = w * 0.018;
  let seed = 3907;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // A natural spruce top, warm but quiet next to the room's brights
  c.fillStyle = "#e6c38f";
  c.fillRect(0, 0, w, h);
  // its grain: fine straight lines running the length of the top, a little uneven in weight
  // and spacing, each wavering faintly
  for (let x = 0; x < w; x += 3 + rand() * 5) {
    c.strokeStyle = `rgba(150,95,40,${0.08 + rand() * 0.14})`;
    c.lineWidth = 0.6 + rand() * 1.2;
    const sway = rand() * 2;
    c.beginPath();
    c.moveTo(x, 0);
    c.bezierCurveTo(x + sway, h * 0.33, x - sway, h * 0.66, x + sway * 0.5, h);
    c.stroke();
  }
  // a soft sunburst: the lower bout's middle stays pale, its edges warming to amber
  const burst = c.createRadialGradient(toX(0), toY(0.1), ux * 0.35, toX(0), toY(0.4), ux * 1.25);
  burst.addColorStop(0, "rgba(160,80,20,0)");
  burst.addColorStop(0.7, "rgba(160,80,20,.12)");
  burst.addColorStop(1, "rgba(110,50,10,.42)");
  c.fillStyle = burst;
  c.fillRect(0, 0, w, h);
  // halftone dots, heavier toward the lower edge
  for (let y = 0; y < h; y += w * 0.035) {
    for (let x = (Math.round(y / (w * 0.035)) % 2) * w * 0.0175; x < w; x += w * 0.035) {
      const k = Math.max(0, (y / h - 0.55) / 0.45);
      if (!k) continue;
      c.fillStyle = "rgba(150,95,40,.3)";
      c.beginPath();
      c.arc(x, y, w * 0.007 * k, 0, Math.PI * 2);
      c.fill();
    }
  }
  // the pickguard: a dark tortoise crescent tucked against the rosette's lower right, its inner edge
  // following the ring and its outer edge sweeping round toward the waist
  const cx = toX(0);
  const cy = toY(1.15);
  const ringR = 0.5 * ux;
  c.beginPath();
  c.arc(cx, cy, ringR, 1.9, -0.25, true);
  c.bezierCurveTo(toX(0.78), toY(1.12), toX(0.86), toY(0.78), toX(0.6), toY(0.6));
  c.bezierCurveTo(toX(0.4), toY(0.48), toX(0.02), toY(0.52), cx + Math.cos(1.9) * ringR, cy + Math.sin(1.9) * ringR);
  c.closePath();
  c.fillStyle = "#4a2f1f";
  c.fill();
  c.lineWidth = line * 0.8;
  c.strokeStyle = "#000";
  c.stroke();
  // tortoiseshell: warm amber flecks through the dark, kept inside the guard
  c.save();
  c.clip();
  for (let i = 0; i < 40; i++) {
    c.fillStyle = rand() < 0.5 ? "rgba(180,95,30,.35)" : "rgba(20,10,5,.35)";
    c.beginPath();
    c.ellipse(toX(0.1 + rand() * 0.8), toY(0.5 + rand() * 0.7), ux * (0.02 + rand() * 0.05), ux * (0.01 + rand() * 0.03), rand() * Math.PI, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
  // binding round the edge: a cream band just inside the outline with a fine dark purfling
  // line inside it
  if (halfWidth) {
    const trace = (inset) => {
      c.beginPath();
      const ys = Array.from({ length: 121 }, (_, k) => -0.95 + (k / 120) * 2.87);
      ys.forEach((y, k) => (k ? c.lineTo(toX(halfWidth(y) - inset), toY(y)) : c.moveTo(toX(halfWidth(y) - inset), toY(y))));
      [...ys].reverse().forEach((y) => c.lineTo(toX(-halfWidth(y) + inset), toY(y)));
      c.closePath();
    };
    trace(0.03);
    c.strokeStyle = "#fffdf5";
    c.lineWidth = ux * 0.05;
    c.stroke();
    trace(0.065);
    c.strokeStyle = "rgba(40,20,10,.7)";
    c.lineWidth = ux * 0.012;
    c.stroke();
  }
  // rosette: black, white, black
  [[0.5, "#1a1714", 0.09], [0.43, "#fffdf5", 0.05], [0.38, "#1a1714", 0.03]].forEach(([r, color, t]) => {
    c.strokeStyle = color;
    c.lineWidth = t * ux;
    c.beginPath();
    c.ellipse(toX(0), toY(1.15), r * ux, (r / 2.87) * 2 * h / 2, 0, 0, Math.PI * 2);
    c.stroke();
  });
  // stickers
  const sticker = (x, y, turn, path, fill, label) => {
    c.save();
    c.translate(toX(x), toY(y));
    c.rotate(turn);
    c.translate(line * 0.8, line * 0.8);
    path();
    c.fillStyle = "#000";
    c.fill();
    c.translate(-line * 0.8, -line * 0.8);
    path();
    c.fillStyle = fill;
    c.fill();
    c.lineWidth = line * 0.6;
    c.strokeStyle = "#000";
    c.stroke();
    if (label) {
      c.fillStyle = "#000";
      c.font = `900 ${Math.round(ux * 0.13)}px 'Lexend Mega', sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(label, 0, ux * 0.01);
    }
    c.restore();
  };
  const r = ux * 0.15;
  sticker(-0.5, 0.1, -0.25, () => {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      if (i) c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
  }, "#ff90e8");
  sticker(0.15, -0.45, 0.12, () => {
    c.beginPath();
    c.roundRect(-r * 1.5, -r * 0.75, r * 3, r * 1.5, r * 0.5);
  }, "#00e0c6", "</>");
  sticker(-0.42, 1.55, 0.3, () => {
    c.beginPath();
    c.moveTo(r * 0.25, -r);
    c.lineTo(-r * 0.6, r * 0.15);
    c.lineTo(-r * 0.05, r * 0.15);
    c.lineTo(-r * 0.3, r);
    c.lineTo(r * 0.65, -r * 0.2);
    c.lineTo(r * 0.05, -r * 0.2);
    c.closePath();
  }, "#ff6b6b");
}

// The room's walls, one 40 cm tile (a 4-unit square of wall). The painted patterns are drawn in
// white and greys so the visitor's paint multiplies over it; brick and wood slats are drawn in
// their own clay or wood (`brick`, `wood`). Every pattern tiles seamlessly; an unknown one is plain.
export const WALL_MATERIALS = ["brick", "slats"];
export function drawWallPaint(c, w, h, pattern = "plain", { brick, wood } = {}) {
  // (on white: the walls are opaque, so a see-through grout would show at its full darkness)
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, w, h);
  (WALL_DRAWS[pattern] || WALL_DRAWS.plain)(c, w, h, { brick: BRICKS[brick] || BRICKS[DEFAULT_BRICK], wood: WOODS[wood] || WOODS[DEFAULT_SLATS] });
}

// A shade per tile, the same each time it's drawn (k counts tiles across the 40 cm repeat)
const shadeFor = (k) => (Math.sin(k * 127.1 + 311.7) * 43758.5453) % 1;
// Draws a shape at its place and again a whole tile over each way, so anything crossing an edge
// comes back in on the other side
function wrapped(c, w, h, draw) {
  [-w, 0, w].forEach((dx) => [-h, 0, h].forEach((dy) => {
    c.save();
    c.translate(dx, dy);
    draw();
    c.restore();
  }));
}
// Rows of blocks in running bond (brick, subway tile): each block a shade either way of the
// paint (or one of the clay's tones), a lit top edge and a shadowed bottom one, in grout
function runningBond(c, w, h, across, rows, grout, bevel, clay = null) {
  c.fillStyle = clay ? clay.mortar : "rgba(26,23,20,.38)";
  c.fillRect(0, 0, w, h);
  const bw = w / across;
  const bh = h / rows;
  for (let row = 0; row < rows; row++) {
    const shift = row % 2 ? bw / 2 : 0;
    for (let col = -1; col <= across; col++) {
      const x = col * bw + shift + grout / 2;
      const y = row * bh + grout / 2;
      const shade = shadeFor(row * across + ((col + across) % across));
      c.fillStyle = clay ? clay.tones[Math.floor(Math.abs(shade) * 50) % clay.tones.length] : "#ffffff";
      c.fillRect(x, y, bw - grout, bh - grout);
      // (clay already varies brick to brick, so it takes only a touch more, or the wall goes patchy)
      const light = clay ? 0.06 : 0.5;
      c.fillStyle = shade < 0 ? `rgba(26,23,20,${(-shade * (clay ? 0.08 : 0.12)).toFixed(3)})` : `rgba(255,255,255,${(shade * light).toFixed(3)})`;
      c.fillRect(x, y, bw - grout, bh - grout);
      c.fillStyle = clay ? "rgba(255,255,255,.18)" : "rgba(255,255,255,.7)";
      c.fillRect(x, y, bw - grout, bevel);
      c.fillStyle = "rgba(26,23,20,.12)";
      c.fillRect(x, y + bh - grout - bevel, bw - grout, bevel);
    }
  }
}
const WALL_DRAWS = {
  // Flat paint: a faint dot grid (the same grid as the site's loading screen) over a soft
  // paint-roller grain, both low enough to stay a texture, not a pattern. Drawn as the 20 cm
  // tile it always was, four times over.
  plain(c, w, h) {
    const tw = w / 2;
    const th = h / 2;
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, tw, th);
    let r = 7331;
    const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    // roller grain: short soft streaks running up and down, a shade either way of the paint
    for (let i = 0; i < (tw * th) / 40; i++) {
      c.fillStyle = rand() < 0.5 ? "rgba(26,23,20,.04)" : "rgba(255,255,255,.6)";
      const x = rand() * tw;
      const y = rand() * th;
      c.fillRect(x, y, 1 + rand() * 1.5, 3 + rand() * 9);
    }
    // roller laps: two broad, barely-there bands where the paint went on a touch thicker
    [0.18, 0.66].forEach((k) => {
      const lap = c.createLinearGradient(tw * k, 0, tw * (k + 0.22), 0);
      lap.addColorStop(0, "rgba(26,23,20,0)");
      lap.addColorStop(0.5, "rgba(26,23,20,.018)");
      lap.addColorStop(1, "rgba(26,23,20,0)");
      c.fillStyle = lap;
      c.fillRect(0, 0, tw, th);
    });
    // the dot grid
    const step = tw / 6;
    c.fillStyle = "rgba(26,23,20,.16)";
    for (let y = step / 2; y < th; y += step) {
      for (let x = step / 2; x < tw; x += step) {
        c.beginPath();
        c.arc(x, y, tw * 0.011, 0, Math.PI * 2);
        c.fill();
      }
    }
    [[tw, 0], [0, th], [tw, th]].forEach(([x, y]) => c.drawImage(c.canvas, 0, 0, tw, th, x, y, tw, th));
  },
  // Painted brick: 20 × 6.7 cm courses in running bond, a centimetre of mortar
  brick(c, w, h, { brick }) {
    runningBond(c, w, h, 2, 6, w * 0.026, w * 0.008, brick);
  },
  // Subway tile: 10 × 5 cm, glazed, in thin grout
  subway(c, w, h) {
    runningBond(c, w, h, 4, 8, w * 0.009, w * 0.012);
  },
  // Acoustic wood slats: eight 4 cm slats a tile over a dark felt backing, each with its own
  // tone and a few grain lines running up it
  slats(c, w, h, { wood }) {
    c.fillStyle = "#2a2622";
    c.fillRect(0, 0, w, h);
    const sw = w / 8;
    const gap = sw * 0.2;
    let r = 4421;
    const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 8; i++) {
      const x = i * sw + gap / 2;
      const shade = shadeFor(i + 40);
      c.fillStyle = wood.tones[i % wood.tones.length];
      c.fillRect(x, 0, sw - gap, h);
      c.fillStyle = shade < 0 ? `rgba(26,23,20,${(-shade * 0.1).toFixed(3)})` : `rgba(255,255,255,${(shade * 0.4).toFixed(3)})`;
      c.fillRect(x, 0, sw - gap, h);
      // grain: long thin streaks, wrapped top to bottom
      for (let g = 0; g < 7; g++) {
        const gx = x + 3 + rand() * (sw - gap - 6);
        const gy = rand() * h;
        const len = h * (0.2 + rand() * 0.5);
        c.fillStyle = `rgba(${wood.grain.join(",")},.18)`;
        [gy, gy - h].forEach((y) => c.fillRect(gx, y, 1.5, len));
      }
      // a rounded edge each side
      c.fillStyle = "rgba(255,255,255,.55)";
      c.fillRect(x, 0, sw * 0.06, h);
      c.fillStyle = "rgba(26,23,20,.14)";
      c.fillRect(x + sw - gap - sw * 0.06, 0, sw * 0.06, h);
    }
  },
  // Wallpaper stripes: 5 cm bands, the paler ones with a fine pinstripe down the middle
  stripes(c, w, h) {
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, w, h);
    const band = w / 8;
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? "rgba(26,23,20,.13)" : "rgba(26,23,20,.09)";
      if (i % 2) c.fillRect(i * band, 0, band, h);
      else c.fillRect(i * band + band / 2 - w * 0.002, 0, w * 0.004, h);
    }
  },
  // Hexagon tile: about 9 cm across, each a shade of its own, in grout. Three columns' pair and
  // five rows a tile: the rows sit 4% further apart than a true honeycomb so it repeats.
  hexagon(c, w, h) {
    c.fillStyle = "rgba(26,23,20,.38)";
    c.fillRect(0, 0, w, h);
    const cols = 6;
    const rows = 5;
    const s = w / (cols * 1.5);
    const vp = h / rows;
    const ky = vp / (Math.sqrt(3) * s);
    const inset = s - w * 0.008;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const cx = i * 1.5 * s;
        const cy = j * vp + (i % 2 ? vp / 2 : 0);
        const shade = shadeFor(i * rows + j + 80);
        wrapped(c, w, h, () => {
          c.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI) / 3;
            c.lineTo(cx + inset * Math.cos(a), cy + inset * Math.sin(a) * ky);
          }
          c.closePath();
          c.fillStyle = "#ffffff";
          c.fill();
          c.fillStyle = shade < 0 ? `rgba(26,23,20,${(-shade * 0.12).toFixed(3)})` : `rgba(255,255,255,${(shade * 0.5).toFixed(3)})`;
          c.fill();
        });
      }
    }
  },
  // Checkerboard: 10 cm squares, every other one a shade down
  checker(c, w, h) {
    const sw = w / 4;
    const sh = h / 4;
    c.fillStyle = "rgba(26,23,20,.14)";
    for (let y = 0; y < 4; y++) {
      for (let x = (y % 2); x < 4; x += 2) c.fillRect(x * sw, y * sh, sw, sh);
    }
  },
  // Chevron: 5 cm bands zigzagging every 10 cm, alternate bands a shade down
  chevron(c, w, h) {
    const band = h / 8;
    const period = w / 4;
    c.fillStyle = "rgba(26,23,20,.12)";
    // each band's top edge and its bottom one a band lower, edge to edge across the tile (the
    // zigzag meets itself there) and again a tile up for the band that runs off the bottom
    const zig = (x) => (Math.round(x / (period / 2)) % 2 ? band : 0);
    for (let b = 1; b < 9; b += 2) {
      [0, -h].forEach((dy) => {
        c.beginPath();
        for (let x = 0; x <= w; x += period / 2) c.lineTo(x, dy + b * band + zig(x));
        for (let x = w; x >= 0; x -= period / 2) c.lineTo(x, dy + (b + 1) * band + zig(x));
        c.closePath();
        c.fill();
      });
    }
  },
  // Graph paper: a faint line every 2.5 cm and a firmer one every 10 cm
  graph(c, w, h) {
    const minor = w / 16;
    for (let i = 0; i < 16; i++) {
      c.fillStyle = i % 4 ? "rgba(26,23,20,.09)" : "rgba(26,23,20,.22)";
      const t = i % 4 ? w * 0.003 : w * 0.006;
      c.fillRect(i * minor - t / 2, 0, t, h);
      c.fillRect(0, i * minor - t / 2, w, t);
      if (i === 0) {
        c.fillRect(w - t / 2, 0, t, h);
        c.fillRect(0, h - t / 2, w, t);
      }
    }
  },
  // Terrazzo: chips of marble, a few millimetres to a centimetre and a half, in muted colours
  // the paint deepens, scattered over a soft speckle
  terrazzo(c, w, h) {
    let r = 9157;
    const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const CHIPS = ["#c98a6b", "#9fb39a", "#8e9bb0", "#d8b56a", "#a9a39b", "#6f6a64", "#e9e4dc"];
    for (let i = 0; i < 1400; i++) {
      c.fillStyle = rand() < 0.5 ? "rgba(26,23,20,.08)" : "rgba(26,23,20,.04)";
      c.fillRect(rand() * w, rand() * h, 1.5, 1.5);
    }
    for (let i = 0; i < 230; i++) {
      const cx = rand() * w;
      const cy = rand() * h;
      const size = 4 + Math.pow(rand(), 2) * 16;
      const sides = 4 + Math.floor(rand() * 3);
      const turn = rand() * Math.PI;
      const points = Array.from({ length: sides }, (_, k) => {
        const a = turn + (k / sides) * Math.PI * 2;
        const d = size * (0.55 + rand() * 0.45);
        return [cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8];
      });
      c.fillStyle = CHIPS[Math.floor(rand() * CHIPS.length)];
      wrapped(c, w, h, () => {
        c.beginPath();
        points.forEach(([x, y]) => c.lineTo(x, y));
        c.closePath();
        c.fill();
      });
    }
  },
  // Limewash: soft clouds where the wash went on thicker or thinner, and criss-crossed brush marks
  limewash(c, w, h) {
    let r = 2671;
    const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) {
      const cx = rand() * w;
      const cy = rand() * h;
      const rad = w * (0.12 + rand() * 0.22);
      const dark = rand() < 0.6;
      wrapped(c, w, h, () => {
        const cloud = c.createRadialGradient(cx, cy, 0, cx, cy, rad);
        cloud.addColorStop(0, dark ? "rgba(26,23,20,.09)" : "rgba(255,255,255,.7)");
        cloud.addColorStop(1, dark ? "rgba(26,23,20,0)" : "rgba(255,255,255,0)");
        c.fillStyle = cloud;
        c.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      });
    }
    c.lineCap = "round";
    for (let i = 0; i < 60; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const len = w * (0.06 + rand() * 0.1);
      const a = (rand() < 0.5 ? 1 : -1) * (Math.PI / 4 + (rand() - 0.5) * 0.5);
      c.strokeStyle = rand() < 0.5 ? "rgba(26,23,20,.03)" : "rgba(255,255,255,.22)";
      c.lineWidth = 4 + rand() * 8;
      wrapped(c, w, h, () => {
        c.beginPath();
        c.moveTo(x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2);
        c.lineTo(x + Math.cos(a) * len / 2, y + Math.sin(a) * len / 2);
        c.stroke();
      });
    }
  },
};

// Soft fur, as a light grey map the fur colours multiply with: short strokes a touch lighter
// and darker, all leaning the same way like brushed fur. Tiles seamlessly.
export function drawFur(c, w, h) {
  c.fillStyle = "#eeeeee";
  c.fillRect(0, 0, w, h);
  let r = 5167;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  c.lineCap = "round";
  for (let i = 0; i < (w * h) / 18; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 3 + rand() * 6;
    c.strokeStyle = rand() < 0.5 ? "rgba(255,255,255,.7)" : "rgba(150,150,150,.35)";
    c.lineWidth = 1 + rand();
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + len * 0.35, y + len);
    c.stroke();
  }
}

// Sisal rope wound round a scratching post: tight coils a little lighter along their crowns,
// a dark groove between each, and a few frayed fibres. Tiles seamlessly up and round.
export function drawSisal(c, w, h) {
  c.fillStyle = "#cfa86a";
  c.fillRect(0, 0, w, h);
  const coils = 16;
  const pitch = h / coils;
  for (let i = 0; i < coils; i++) {
    const y = i * pitch;
    const crown = c.createLinearGradient(0, y, 0, y + pitch);
    crown.addColorStop(0, "rgba(120,80,30,.55)");
    crown.addColorStop(0.45, "rgba(255,240,200,.35)");
    crown.addColorStop(1, "rgba(120,80,30,.55)");
    c.fillStyle = crown;
    c.fillRect(0, y, w, pitch);
    c.fillStyle = "rgba(70,45,15,.6)";
    c.fillRect(0, y, w, Math.max(1, pitch * 0.12));
  }
  let r = 9241;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  c.lineCap = "round";
  for (let i = 0; i < (w * h) / 40; i++) {
    const x = rand() * w;
    const y = rand() * h;
    c.strokeStyle = rand() < 0.5 ? "rgba(255,245,215,.45)" : "rgba(90,60,20,.35)";
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + 2 + rand() * 4, y + (rand() - 0.5) * 1.5);
    c.stroke();
  }
}

// Woven straw: rows of plaited strands, each a little lighter in the middle
export function drawStraw(c, w, h) {
  c.fillStyle = "#e9b543";
  c.fillRect(0, 0, w, h);
  const row = h / 16;
  for (let r = 0; r < 16; r++) {
    for (let x = (r % 2) * 12; x < w; x += 24) {
      const g = c.createLinearGradient(x, r * row, x + 22, r * row + row);
      g.addColorStop(0, "#d79f2e");
      g.addColorStop(0.5, "#f8d06b");
      g.addColorStop(1, "#c98e24");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x, r * row + row * 0.15);
      c.lineTo(x + 22, r * row + row * 0.5);
      c.lineTo(x, r * row + row * 0.85);
      c.closePath();
      c.fill();
    }
    c.fillStyle = "rgba(120,70,10,.35)";
    c.fillRect(0, r * row, w, 1.5);
  }
}

// Brushed metal, as a light tile its material tints: fine streaks drawn across in slightly
// different greys, with a broad soft sheen through the middle. Tiles across.
export function drawBrushedMetal(c, w, h) {
  let r = 6151;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  c.fillStyle = "#c8c8c8";
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < h * 3; i++) {
    const tone = 170 + Math.floor(rand() * 85);
    c.fillStyle = `rgba(${tone},${tone},${tone},.5)`;
    c.fillRect(rand() * w - w * 0.5, rand() * h, w * (0.3 + rand() * 0.9), 0.6 + rand() * 0.8);
  }
  const sheen = c.createLinearGradient(0, 0, 0, h);
  sheen.addColorStop(0, "rgba(255,255,255,0)");
  sheen.addColorStop(0.5, "rgba(255,255,255,.18)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = sheen;
  c.fillRect(0, 0, w, h);
}

// A small computer's square top, its brushed silver softened like the display's, a soft sheen
// across it and a dark whole-apple badge in the middle: a round fruit with two lobes either
// side of its dimple, a short stem and a leaf. The badge spans `logo` of the tile's width.
export function drawStudioTop(c, w, h, { logo = 0.3 } = {}) {
  drawBrushedMetal(c, w, h);
  c.fillStyle = "rgba(255,255,255,0.78)";
  c.fillRect(0, 0, w, h);
  const sheen = c.createRadialGradient(w * 0.35, h * 0.3, 0, w * 0.35, h * 0.3, w * 0.8);
  sheen.addColorStop(0, "rgba(255,255,255,.35)");
  sheen.addColorStop(1, "rgba(120,124,130,.12)");
  c.fillStyle = sheen;
  c.fillRect(0, 0, w, h);
  // the badge in unit coordinates (about 0.9 across), y down, its stem toward the canvas top
  const s = (w * logo) / 0.9;
  c.save();
  c.translate(w / 2, h / 2 + s * 0.06);
  c.scale(s, s);
  const badge = c.createLinearGradient(0, -0.5, 0, 0.5);
  badge.addColorStop(0, "#55595f");
  badge.addColorStop(1, "#303236");
  c.fillStyle = badge;
  wholeApple(c, "#45484d");
  c.restore();
}

// A whole apple (no bite) in unit coordinates, about 0.9 across, y down: a round fruit with two
// lobes either side of its dimple, a short stem and a leaf off to its right. Filled in the
// current fill style, the stem stroked in `stem`.
function wholeApple(c, stem) {
  c.beginPath();
  c.moveTo(0, -0.27);
  c.bezierCurveTo(0.12, -0.37, 0.45, -0.37, 0.45, -0.03);
  c.bezierCurveTo(0.45, 0.24, 0.31, 0.46, 0.19, 0.47);
  c.bezierCurveTo(0.11, 0.48, 0.07, 0.43, 0, 0.43);
  c.bezierCurveTo(-0.07, 0.43, -0.11, 0.48, -0.19, 0.47);
  c.bezierCurveTo(-0.31, 0.46, -0.45, 0.24, -0.45, -0.03);
  c.bezierCurveTo(-0.45, -0.37, -0.12, -0.37, 0, -0.27);
  c.fill();
  c.lineCap = "round";
  c.strokeStyle = stem;
  c.lineWidth = 0.045;
  c.beginPath();
  c.moveTo(0, -0.26);
  c.quadraticCurveTo(-0.01, -0.38, 0.04, -0.46);
  c.stroke();
  c.beginPath();
  c.ellipse(0.15, -0.44, 0.06, 0.13, 1.05, 0, Math.PI * 2);
  c.fill();
}

// The display while the computer is off or starting: plain black when off; while it boots, the
// white apple with a thin progress bar under it that fills with `progress` (0 to 1)
export function drawPowerScreen(c, w, h, { booting = false, progress = 0 } = {}) {
  c.fillStyle = "#000000";
  c.fillRect(0, 0, w, h);
  if (!booting) return;
  const s = h * 0.2;
  c.save();
  c.translate(w / 2, h * 0.42);
  c.scale(s, s);
  c.fillStyle = "#f4f4f5";
  wholeApple(c, "#f4f4f5");
  c.restore();
  const barW = w * 0.2;
  const barH = Math.max(3, h * 0.012);
  const x = (w - barW) / 2;
  const y = h * 0.66;
  c.fillStyle = "#3a3a3c";
  c.beginPath();
  c.roundRect(x, y, barW, barH, barH / 2);
  c.fill();
  if (progress > 0) {
    c.fillStyle = "#f4f4f5";
    c.beginPath();
    c.roundRect(x, y, Math.max(barH, barW * Math.min(1, progress)), barH, barH / 2);
    c.fill();
  }
}

// The dark base ring's cooling vents: narrow upright slots in a row along a tile that repeats
export function drawVentSlots(c, w, h) {
  c.fillStyle = "#2c2e33";
  c.fillRect(0, 0, w, h);
  for (let x = 2; x < w; x += 8) {
    c.fillStyle = "#08090b";
    c.fillRect(x, h * 0.22, 4, h * 0.56);
    c.fillStyle = "rgba(255,255,255,.12)";
    c.fillRect(x, h * 0.78, 4, 1);
  }
}

// A desktop computer's back grille: a dense grid of small round holes on a clear tile, each a
// dark well with a faint highlight under it, the rows offset like a honeycomb
export function drawPerforatedGrille(c, w, h, { pitch = 10 } = {}) {
  c.clearRect(0, 0, w, h);
  const r = pitch * 0.3;
  for (let row = 0, y = pitch / 2; y < h - r; row++, y += pitch * 0.87) {
    for (let x = pitch / 2 + (row % 2) * (pitch / 2); x < w - r; x += pitch) {
      c.fillStyle = "rgba(255,255,255,.35)";
      c.beginPath();
      c.arc(x, y + 1, r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#16171a";
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  }
}

// A satin-painted cabinet, as a light tile its material tints: a fine even stipple with a
// faint grain running along it, so a flat panel reads as a finished surface. Tiles both ways.
export function drawSatinFinish(c, w, h, { grain = 0.06 } = {}) {
  let r = 2713;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  c.fillStyle = "#d4d4d4";
  c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2) {
    c.fillStyle = `rgba(${rand() < 0.5 ? "255,255,255" : "0,0,0"},${rand() * grain})`;
    c.fillRect(0, y, w, 1 + rand());
  }
  for (let i = 0; i < (w * h) / 6; i++) {
    c.fillStyle = rand() < 0.5 ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)";
    c.fillRect(rand() * w, rand() * h, 1, 1);
  }
}

// Satin-matte moulded polymer, as on a clothless speaker shell: an even, very fine and
// low-contrast stipple, smooth to the eye, with no brushed streaks
// `speck` scales the dots up (and thins them out to match) for a coarse, textured coat
export function drawMatteFinish(c, w, h, { grain = 0.03, speck = 1 } = {}) {
  let r = 4271;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  c.fillStyle = "#d8d8d8";
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < (w * h * 0.6) / (speck * speck); i++) {
    c.fillStyle = `rgba(${rand() < 0.5 ? "255,255,255" : "0,0,0"},${rand() * grain})`;
    c.fillRect(rand() * w, rand() * h, speck * (1 + rand()), speck * (1 + rand()));
  }
}

// A speaker cone's surface on its lathe's uv (up the canvas is from the rim in to the centre):
// pressed concentric ribs, and fine fibres radiating out through the paper
export function drawConeRibs(c, w, h) {
  let r = 811;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  c.fillStyle = "#e4e4e4";
  c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 1.5) {
    c.fillStyle = `rgba(${rand() < 0.5 ? "255,255,255" : "0,0,0"},${rand() * 0.12})`;
    c.fillRect(x, 0, 1, h);
  }
  for (let k = 1; k < 6; k++) {
    const y = h * (0.22 + k * 0.11);
    c.fillStyle = "rgba(0,0,0,.22)";
    c.fillRect(0, y, w, h * 0.025);
    c.fillStyle = "rgba(255,255,255,.3)";
    c.fillRect(0, y + h * 0.025, w, h * 0.02);
  }
}

// The chair's leatherette, as a light tile the leather's colour tints dark: soft mottling, then
// a pebbled grain of small rounded cells, each lit a little on top and creased dark round its
// edge, tiling seamlessly. `perforated` adds the staggered rows of tiny breathing holes the
// centre panel has.
export function drawLeatherGrain(c, w, h, { perforated = false } = {}) {
  let r = 9241;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  // every mark is drawn again across each edge it crosses, so the tile repeats without seams
  const wrapped = (x, y, reach, draw) => {
    for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) if (Math.abs(x + dx - w / 2) < w / 2 + reach && Math.abs(y + dy - h / 2) < h / 2 + reach) draw(x + dx, y + dy);
  };
  c.fillStyle = "#969696";
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const size = w * (0.1 + rand() * 0.18);
    const tone = rand() < 0.5 ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)";
    wrapped(x, y, size, (px, py) => {
      const g = c.createRadialGradient(px, py, 0, px, py, size);
      g.addColorStop(0, tone);
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.fillRect(px - size, py - size, size * 2, size * 2);
    });
  }
  const cells = Math.round((w * h) / 70);
  for (let i = 0; i < cells; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const rx = w * (0.012 + rand() * 0.014);
    const ry = rx * (0.7 + rand() * 0.5);
    const turn = rand() * Math.PI;
    const light = 215 + Math.floor(rand() * 40);
    wrapped(x, y, rx * 1.5, (px, py) => {
      const g = c.createRadialGradient(px - rx * 0.25, py - ry * 0.3, 0, px, py, Math.max(rx, ry));
      g.addColorStop(0, `rgb(${light},${light},${light})`);
      g.addColorStop(0.75, `rgb(${light - 40},${light - 40},${light - 40})`);
      g.addColorStop(1, "rgba(150,150,150,0)");
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(px, py, rx, ry, turn, 0, Math.PI * 2);
      c.fill();
    });
  }
  // a few longer fine creases, as the leather has where it flexes
  c.lineCap = "round";
  for (let i = 0; i < 14; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = w * (0.05 + rand() * 0.1);
    const a = rand() * Math.PI;
    c.strokeStyle = "rgba(70,70,70,.55)";
    c.lineWidth = 0.8 + rand() * 0.6;
    wrapped(x, y, len, (px, py) => {
      c.beginPath();
      c.moveTo(px, py);
      c.quadraticCurveTo(px + Math.cos(a + 0.4) * len * 0.5, py + Math.sin(a + 0.4) * len * 0.5, px + Math.cos(a) * len, py + Math.sin(a) * len);
      c.stroke();
    });
  }
  if (!perforated) return;
  const pitch = w / 12;
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 12; col++) {
      const x = (col + (row % 2) * 0.5 + 0.25) * pitch;
      const y = (row + 0.5) * pitch;
      c.fillStyle = "rgba(255,255,255,.5)";
      c.beginPath();
      c.arc(x + 0.6, y + 0.8, pitch * 0.17, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#3a3a3a";
      c.beginPath();
      c.arc(x, y, pitch * 0.15, 0, Math.PI * 2);
      c.fill();
    }
  }
}

// A plant leaf, laid out on its own uv: across the canvas is across the blade, edge to edge at
// every height, and up the canvas is from its base to its tip. Darker at the base and lighter
// toward the tip and the margins, with a pale midrib and a few faint side veins arching out
// toward the edge.
export function drawPlantLeaf(c, w, h, { base = "#15803d", tip = "#4ade80", vein = "#bbf7d0" } = {}) {
  const along = c.createLinearGradient(0, h, 0, 0);
  along.addColorStop(0, base);
  along.addColorStop(1, tip);
  c.fillStyle = along;
  c.fillRect(0, 0, w, h);
  const across = c.createLinearGradient(0, 0, w, 0);
  across.addColorStop(0, "rgba(255,255,255,.16)");
  across.addColorStop(0.2, "rgba(255,255,255,0)");
  across.addColorStop(0.45, "rgba(0,0,0,.1)");
  across.addColorStop(0.55, "rgba(0,0,0,.1)");
  across.addColorStop(0.8, "rgba(255,255,255,0)");
  across.addColorStop(1, "rgba(255,255,255,.16)");
  c.fillStyle = across;
  c.fillRect(0, 0, w, h);
  c.strokeStyle = vein;
  c.lineCap = "round";
  // side veins, from the midrib up and out, thinning toward the edge
  for (let k = 0; k < 4; k++) {
    const y = h * (0.8 - k * 0.17);
    const rise = h * (0.1 + k * 0.006);
    for (const side of [-1, 1]) {
      c.globalAlpha = 0.3;
      c.lineWidth = 2 - k * 0.2;
      c.beginPath();
      c.moveTo(w / 2, y);
      c.quadraticCurveTo(w / 2 + side * w * 0.22, y - rise * 0.35, w / 2 + side * w * 0.43, y - rise);
      c.stroke();
    }
  }
  c.globalAlpha = 1;
  // the midrib, broad at the base and tapering to the tip
  c.fillStyle = vein;
  c.beginPath();
  c.moveTo(w / 2 - 4, h);
  c.lineTo(w / 2 + 4, h);
  c.lineTo(w / 2 + 0.8, 0);
  c.lineTo(w / 2 - 0.8, 0);
  c.closePath();
  c.fill();
}

// A glazed terracotta pot on a lathe's uv: speckled clay all over; up its outer wall (between
// `wall`'s two heights, 0 at the foot) the faint rings left by the wheel and a darker
// water-stain band near the foot; its rim's face (`rim`) a touch lighter.
export function drawTerracotta(c, w, h, { base = "#ff7a1a", wall = [0, 1], rim = null } = {}) {
  let r = 7331;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const y = (v) => h * (1 - v);
  c.fillStyle = base;
  c.fillRect(0, 0, w, h);
  const [w0, w1] = wall;
  const stain = c.createLinearGradient(0, y(w0), 0, y(w0 + (w1 - w0) * 0.35));
  stain.addColorStop(0, "rgba(90,30,0,.28)");
  stain.addColorStop(1, "rgba(90,30,0,0)");
  c.fillStyle = stain;
  c.fillRect(0, y(w1), w, y(w0) - y(w1));
  // a soft glaze sheen down the upper wall
  const sheen = c.createLinearGradient(0, y(w0), 0, y(w1));
  sheen.addColorStop(0.55, "rgba(255,255,255,0)");
  sheen.addColorStop(0.85, "rgba(255,230,200,.14)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = sheen;
  c.fillRect(0, y(w1), w, y(w0) - y(w1));
  for (let k = 1; k < 9; k++) {
    const ring = y(w0 + ((w1 - w0) * k) / 9 + (rand() - 0.5) * 0.004);
    c.fillStyle = k % 2 ? "rgba(120,40,0,.07)" : "rgba(255,220,180,.06)";
    c.fillRect(0, ring, w, 1.5);
  }
  if (rim) {
    c.fillStyle = "rgba(255,235,210,.14)";
    c.fillRect(0, y(rim[1]), w, y(rim[0]) - y(rim[1]));
    c.fillStyle = "rgba(90,30,0,.25)";
    c.fillRect(0, y(rim[0]) - 2, w, 2);
  }
  for (let i = 0; i < (w * h) / 180; i++) {
    const dark = rand() < 0.6;
    c.fillStyle = dark ? `rgba(110,40,0,${0.15 + rand() * 0.25})` : `rgba(255,236,210,${0.2 + rand() * 0.3})`;
    c.fillRect(rand() * w, rand() * h, 1 + rand() * 1.4, 1 + rand() * 1.4);
  }
}

// The chair's small embroidered badge: a gold-rimmed hexagon with a four-pointed star in it,
// edged in dark so it reads on black leather
export function drawChairCrest(c, w, h, { gold = "#d4a72c" } = {}) {
  c.clearRect(0, 0, w, h);
  const hex = (r) => {
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      c.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
    }
    c.closePath();
  };
  hex(w * 0.46);
  c.fillStyle = "#1a1714";
  c.fill();
  hex(w * 0.4);
  c.fillStyle = gold;
  c.fill();
  hex(w * 0.32);
  c.fillStyle = "#1f1d1c";
  c.fill();
  const r = w * 0.22;
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    const k = i % 2 ? 0.3 : 1;
    c.lineTo(w / 2 + Math.cos(a) * r * k, h / 2 + Math.sin(a) * r * k);
  }
  c.closePath();
  c.fillStyle = gold;
  c.fill();
}


// The console core's micro-texture: rows of tiny △ ○ × □ moulded into the gloss black, a
// shade lighter than the plastic, so up close it reads as texture and from afar as a sheen
export function drawPsSymbols(c, w, h, { base = "#1a1714", ink = "#2b2a33" } = {}) {
  c.fillStyle = base;
  c.fillRect(0, 0, w, h);
  c.strokeStyle = ink;
  c.lineWidth = Math.max(1, w * 0.012);
  const step = w / 7;
  const r = step * 0.22;
  for (let row = 0; row * step < h + step; row++) for (let col = 0; col < 8; col++) {
    const x = (col + (row % 2) * 0.5) * step;
    const y = row * step * 0.9;
    c.beginPath();
    switch ((row + col * 3) % 4) {
      case 0: c.moveTo(x, y - r); c.lineTo(x + r, y + r * 0.8); c.lineTo(x - r, y + r * 0.8); c.closePath(); break;
      case 1: c.arc(x, y, r * 0.9, 0, Math.PI * 2); break;
      case 2: c.moveTo(x - r, y - r); c.lineTo(x + r, y + r); c.moveTo(x + r, y - r); c.lineTo(x - r, y + r); break;
      default: c.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
    }
    c.stroke();
  }
}
