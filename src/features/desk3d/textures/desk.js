import { WOODS } from "../woods";
import { BODY, DISPLAY, brutalBox } from "./base";

// ---------- the file drawer's front panel, same as the 2D drawer ----------
export function drawDrawerFront(c, w, h, count) {
  c.fillStyle = "#ffdd00";
  c.fillRect(0, 0, w, h);
  // Label boxes sized to their text; the type shrinks until both fit side by side
  const left = `PROJECTS 01–${String(count).padStart(2, "0")}`;
  let size = h * 0.2;
  c.font = `800 ${size}px ${DISPLAY}`;
  const boxW = (big) => c.measureText(big).width + w * 0.05;
  const need = boxW(left) + boxW("SHIPPED");
  if (need > w * 0.86) size *= (w * 0.86) / need;
  const label = (x, small, big, fromRight = false) => {
    c.font = `800 ${size}px ${DISPLAY}`;
    const bw = boxW(big);
    if (fromRight) x = w - x - bw;
    brutalBox(c, x, h * 0.22, bw, h * 0.56, "#fffdf5", { shadow: 0, line: Math.max(4, h * 0.035) });
    c.fillStyle = "rgba(0,0,0,.6)";
    c.font = `700 ${Math.round(h * 0.11)}px ${BODY}`;
    c.textBaseline = "top";
    c.fillText(small, x + w * 0.025, h * 0.28);
    c.fillStyle = "#111";
    c.font = `800 ${size}px ${DISPLAY}`;
    c.fillText(big, x + w * 0.025, h * 0.44);
  };
  label(w * 0.04, "DRAWER A", left);
  label(w * 0.04, "STATUS", "SHIPPED", true);
  c.textBaseline = "alphabetic";
  c.lineWidth = Math.max(6, h * 0.05);
  c.strokeStyle = "#000";
  c.strokeRect(0, 0, w, h);
}

// ---------- desk top: light oak planks running the desk's length, flat grain, bold seams ----------
// Recycled messmate / Victorian ash, like a solid-timber standing desk: full-length boards in a
// warm honey tone, dense straight grain with darker streaks, and little black gum veins
// `knots` overrides how many knots a knotty cut gets (the window frame's grain is stretched over
// the whole window, glass and all, so it needs more of them to show any), and `paint` is a
// painted cut's colour
export function drawWoodTop(c, w, h, { wood = "oak", pattern = "planks", knots: knotCount, paint = "#f4f1ea" } = {}) {
  const look = WOODS[wood] || WOODS.oak;
  // Butcher block and bamboo are many narrow strips, plywood one whole sheet; every other cut
  // keeps the five wide boards
  const boards = { butcher: 12, bamboo: 16, plywood: 1 }[pattern] ?? 5;
  const bh = h / boards;
  const { tones, grain } = look;
  // A fixed seed, so the grain is the same every load
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const grainStroke = (alpha) => `rgba(${grain[0] + rand() * 30}, ${grain[1] + rand() * 20}, ${grain[2]}, ${alpha})`;
  // Paint: one flat coat that hides the grain; only the joints between boards still show
  if (pattern === "painted") {
    c.fillStyle = paint;
    c.fillRect(0, 0, w, h);
    c.fillStyle = "rgba(0, 0, 0, 0.05)";
    for (let y = h / 5; y < h; y += h / 5) c.fillRect(0, y, w, 1.5);
    return;
  }
  for (let i = 0; i < boards; i++) {
    const y = i * bh;
    c.fillStyle = tones[i % tones.length];
    c.fillRect(0, y, w, bh);
    // Rotary-cut plywood: a face veneer of broad, soft waves
    if (pattern === "plywood") {
      for (let g = 0; g < 14; g++) {
        const gy = rand() * h;
        const amp = 10 + rand() * 30;
        const len = 120 + rand() * 160;
        const phase = rand() * 10;
        c.strokeStyle = grainStroke(0.08 + rand() * 0.12);
        c.lineWidth = 2 + rand() * 5;
        c.beginPath();
        for (let x = 0; x <= w; x += 12) c.lineTo(x, gy + Math.sin(x / len + phase) * amp);
        c.stroke();
      }
      continue;
    }
    // Broad bands of lighter and darker growth
    for (let b = 0; b < 4; b++) {
      const by = y + rand() * bh;
      const band = 8 + rand() * 26;
      c.fillStyle = rand() < 0.5 ? `rgba(${look.dark}, 0.16)` : `rgba(${look.light}, 0.14)`;
      c.beginPath();
      for (let x = 0; x <= w; x += 40) c.lineTo(x, by + Math.sin(x / 300 + b) * 4);
      for (let x = w; x >= 0; x -= 40) c.lineTo(x, by + band + Math.sin(x / 300 + b) * 4);
      c.fill();
    }
    // Flat-sawn cathedral grain: nested arches that open along the board into straight runs
    if (pattern === "cathedral") {
      const cy = y + bh / 2;
      for (let a = 0; a < 2; a++) {
        const x0 = rand() * w * 0.8 - w * 0.1;
        for (let r = 0; r < 9; r++) {
          const hr = Math.min(bh * 0.47, 5 + r * (bh / 18));
          const reach = 90 + r * 28 + rand() * 30;
          c.strokeStyle = grainStroke(0.18 + rand() * 0.22);
          c.lineWidth = 1 + rand() * 2;
          c.beginPath();
          c.moveTo(w + 20, cy - hr);
          for (let t = -1; t <= 1.001; t += 0.1) c.lineTo(x0 + r * 10 + reach * t * t, cy + hr * t);
          c.lineTo(w + 20, cy + hr);
          c.stroke();
        }
      }
    }
    // Dense, nearly straight grain lines that drift a little along the board (dead straight and
    // tighter in quartersawn and bamboo)
    const straight = pattern === "quartersawn" || pattern === "bamboo";
    for (let g = 0; g < (pattern === "cathedral" ? 8 : pattern === "quartersawn" ? 34 : pattern === "bamboo" ? 6 : 22); g++) {
      const gy = y + rand() * bh;
      const amp = straight ? 0.5 + rand() : 1 + rand() * 4;
      const len = 200 + rand() * 300;
      const phase = rand() * 10;
      c.strokeStyle = grainStroke(0.12 + rand() * 0.28);
      c.lineWidth = 1 + rand() * 2.5;
      c.beginPath();
      for (let x = 0; x <= w; x += 20) c.lineTo(x, gy + Math.sin(x / len + phase) * amp);
      c.stroke();
    }
    // Quartersawn's ray fleck: pale ribbons slanting across the straight grain
    if (pattern === "quartersawn") {
      for (let f = 0; f < 9; f++) {
        c.fillStyle = `rgba(${look.light}, ${0.18 + rand() * 0.16})`;
        c.beginPath();
        c.ellipse(rand() * w, y + bh * (0.15 + rand() * 0.7), 18 + rand() * 46, 2 + rand() * 4, (rand() - 0.5) * 0.25, 0, Math.PI * 2);
        c.fill();
      }
    }
    // Bamboo's nodes: a dark ring with a pale lip, staggered from strip to strip
    if (pattern === "bamboo") {
      for (let x = rand() * w * 0.3; x < w; x += w * (0.2 + rand() * 0.12)) {
        c.fillStyle = `rgba(${look.dark}, 0.45)`;
        c.fillRect(x, y, 4, bh);
        c.fillStyle = `rgba(${look.light}, 0.3)`;
        c.fillRect(x + 4, y, 3, bh);
      }
    }
    // Gum veins: short, sharp black streaks along the grain
    for (let v = 0; v < (straight ? 0 : 3); v++) {
      const vx = rand() * w;
      const vy = y + bh * (0.15 + rand() * 0.7);
      const len = 14 + rand() * (v === 0 ? 120 : 40);
      c.fillStyle = `rgba(${look.vein}, 0.85)`;
      c.beginPath();
      c.ellipse(vx, vy, len, 1.5 + rand() * 2.5, 0, 0, Math.PI * 2);
      c.fill();
    }
    // The glue line between boards, and a butcher block's staggered end joints
    c.fillStyle = `rgba(${look.glue}, 0.45)`;
    c.fillRect(0, y, w, 2);
    if (pattern === "butcher") {
      for (let x = rand() * w * 0.5; x < w; x += w * (0.35 + rand() * 0.4)) c.fillRect(x, y, 2, bh);
    }
  }
  // Knots: a dark heart ringed by the grain swirling round it
  if (pattern === "knotty") {
    const knots = knotCount ?? Math.max(3, Math.round((w * h) / 90000));
    for (let k = 0; k < knots; k++) {
      const kx = rand() * w;
      const ky = rand() * h;
      const rx = 7 + rand() * 13;
      for (let ring = 4; ring >= 1; ring--) {
        c.strokeStyle = grainStroke(0.12 + 0.1 * (4 - ring));
        c.lineWidth = 1.5 + rand() * 1.5;
        c.beginPath();
        c.ellipse(kx, ky, rx * (1 + ring * 0.55), rx * 0.55 * (1 + ring * 0.3), 0, 0, Math.PI * 2);
        c.stroke();
      }
      c.fillStyle = `rgba(${look.vein}, 0.75)`;
      c.beginPath();
      c.ellipse(kx, ky, rx, rx * 0.55, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = `rgba(${look.dark}, 0.5)`;
      c.beginPath();
      c.ellipse(kx, ky, rx * 0.45, rx * 0.25, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
}

// ---------- desk mat under the keyboard and mouse ----------
// Plain charcoal felt with a faint dot grid
// The desk mat: deep navy felt (clear of the black keyboard on it) with a faint dot grid,
// a stitched edge, and a few rolling waves printed across its right-hand corner
export function drawDeskMat(c, w, h) {
  c.fillStyle = "#2b3a5c";
  c.fillRect(0, 0, w, h);
  c.fillStyle = "rgba(255,255,255,.07)";
  for (let y = 24; y < h; y += 32) for (let x = 24; x < w; x += 32) c.fillRect(x, y, 3, 3);
  // waves, curling in from the bottom-right corner
  c.lineWidth = 6;
  c.lineCap = "round";
  [["#3f5583", 0], ["#4f6aa0", 1], ["#7fb2ff", 2]].forEach(([color, k]) => {
    c.strokeStyle = color;
    c.beginPath();
    const y0 = h * (0.62 + k * 0.12);
    c.moveTo(w * 0.62, y0 + 30);
    for (let x = w * 0.62; x <= w; x += 60) {
      c.quadraticCurveTo(x + 15, y0 - 26, x + 30, y0);
      c.quadraticCurveTo(x + 45, y0 + 26, x + 60, y0);
    }
    c.stroke();
  });
  // the stitched edge, set in the same distance all round (the print is 2 % of the mat's width
  // to 4.5 % of its depth). Hugging the edge, the stitches along the mat's foreshortened ends ran
  // together into a pale line between the felt and its outline.
  const ix = w * 0.02;
  const iy = h * 0.045;
  c.strokeStyle = "rgba(255,253,245,.35)";
  c.lineWidth = 3;
  c.setLineDash([14, 9]);
  c.strokeRect(ix, iy, w - ix * 2, h - iy * 2);
  c.setLineDash([]);
}

