// The wallpaper collection: six well-known abstract wallpapers redrawn as toon prints. Every
// gradient becomes flat cel-shaded steps with a lit rim, and every shape gets the desktop's
// print treatment — a hard shadow, light halftone, an ink outline — then grain and a vignette.
// Drawn, never loaded.
export const WALLPAPERS = [
  { id: "big-sur", name: "Big Sur" },
  { id: "capsules", name: "Capsules" },
  { id: "dusk", name: "Dusk waves" },
  { id: "space-black", name: "Space Black" },
  { id: "retro", name: "Retro" },
  { id: "air", name: "Air loops" },
];

export function createWallpapers() {
  let selection = { id: "big-sur" };
  try {
    const saved = JSON.parse(localStorage.getItem("desk-wallpaper"));
    if (WALLPAPERS.some((item) => item.id === saved?.id)) selection = { id: saved.id };
  } catch { /* Storage is optional. */ }
  let dirty = false;
  return {
    get selection() { return selection; },
    get dirty() { return dirty; },
    clean() { dirty = false; },
    select(id) {
      if (!WALLPAPERS.some((item) => item.id === id)) return;
      selection = { id };
      dirty = true;
      try { localStorage.setItem("desk-wallpaper", JSON.stringify(selection)); } catch { /* Storage is optional. */ }
    },
  };
}

const W = 640;
const H = 384;
const FULL = [0, 0, W, H];

// Night is the same print under a dim indigo light
function mix(hex, toward, k) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(toward.slice(1), 16);
  const ch = (s) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// Paints wallpaper `id` for the light or dark room onto `w` (a W × H context).
// `kit` lends the desktop's own print tools so the two never drift apart.
export function paintScenery(w, id, mode, { halftone, grainOver }) {
  const night = mode === "dark";
  const tone = (hex) => (night ? mix(hex, "#231e45", 0.38) : hex);
  const ink = night ? "#0b0a10" : "#1a1714";
  const shadow = night ? "rgba(0,0,0,.35)" : "rgba(26,23,20,.22)";

  w.lineJoin = "round";
  w.lineCap = "round";
  const flood = (hex) => {
    w.fillStyle = tone(hex);
    w.fillRect(-20, -20, W + 40, H + 40);
  };
  // Hard vertical colour steps standing in for a sideways gradient: [[fromX, colour], ...]
  const steps = (list) => () => list.forEach(([x, hex], i) => {
    w.fillStyle = tone(hex);
    w.fillRect(x, -20, (list[i + 1]?.[0] ?? W + 20) - x, H + 40);
  });
  // A cel-shaded cut-out: hard shadow, a lit rim along its top, its colour, halftone, ink
  const cel = (path, fill, { rim = null, rimW = 7, dots = 0.1, lift = 4, box = FULL, line = 3 } = {}) => {
    w.save();
    w.translate(lift, lift);
    w.beginPath();
    path();
    w.fillStyle = shadow;
    w.fill();
    w.restore();
    w.save();
    w.beginPath();
    path();
    w.clip();
    if (rim) {
      flood(rim);
      w.translate(0, rimW);
      w.beginPath();
      path();
      w.clip();
      w.translate(0, -rimW);
    }
    if (typeof fill === "function") fill();
    else flood(fill);
    w.restore();
    if (dots) {
      w.beginPath();
      path();
      halftone(w, box, `rgba(0,0,0,${dots})`);
    }
    w.beginPath();
    path();
    w.lineWidth = line;
    w.strokeStyle = ink;
    w.stroke();
  };
  // A smooth open curve through the points
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const curve = (pts) => {
    w.moveTo(...pts[0]);
    for (let i = 1; i < pts.length - 1; i++) w.quadraticCurveTo(...pts[i], ...mid(pts[i], pts[i + 1]));
    w.lineTo(...pts.at(-1));
  };
  // Everything under an edge running left to right
  const below = (pts) => () => {
    curve(pts);
    w.lineTo(W + 20, H + 20);
    w.lineTo(-20, H + 20);
    w.closePath();
  };
  // Everything left of an edge running top to bottom
  const leftOf = (pts) => () => {
    curve(pts);
    w.lineTo(-20, H + 20);
    w.lineTo(-20, -20);
    w.closePath();
  };
  // A rounded closed outline through the points, like a scissor-cut blob
  const blob = (pts) => () => {
    w.moveTo(...mid(pts.at(-1), pts[0]));
    pts.forEach((p, i) => w.quadraticCurveTo(...p, ...mid(p, pts[(i + 1) % pts.length])));
    w.closePath();
  };
  // A toon ribbon along a path: ink casing, a lit rim towards the top left, its body
  const tube = (path, body, light, width) => {
    w.save();
    w.translate(5, 5);
    w.beginPath();
    path();
    w.lineWidth = width + 6;
    w.strokeStyle = shadow;
    w.stroke();
    w.restore();
    w.beginPath();
    path();
    w.lineWidth = width + 6;
    w.strokeStyle = ink;
    w.stroke();
    w.lineWidth = width;
    w.strokeStyle = tone(light);
    w.stroke();
    w.save();
    w.translate(width * 0.12, width * 0.12);
    w.beginPath();
    path();
    w.lineWidth = width * 0.55;
    w.strokeStyle = tone(body);
    w.stroke();
    w.restore();
  };

  if (id === "big-sur") {
    // Coloured ridges sweeping down to the right: blue sky behind, red and magenta in front
    flood("#1d63c4");
    cel(below([[-20, -20], [150, -20], [260, 4], [380, 16], [500, 30], [660, 46]]), "#2a86e2", { rim: "#4aa3f0", dots: 0 });
    cel(below([[-20, -20], [180, -20], [270, 34], [380, 52], [500, 74], [660, 98]]), "#38a3ee", { rim: "#6cc0f6", dots: 0.06 });
    cel(below([[-20, -20], [210, -20], [270, 56], [350, 66], [430, 86], [540, 110], [660, 138]]), "#d6e6ff", { rim: "#ffffff", rimW: 9, dots: 0.06 });
    cel(below([[-20, -20], [230, -20], [330, 104], [420, 122], [500, 140], [570, 176], [660, 196]]), "#ff9f1c", { rim: "#ffc04a", dots: 0.1 });
    cel(below([[-20, -20], [160, -20], [250, 56], [310, 118], [400, 156], [480, 198], [560, 240], [660, 276]]), "#ff3d3d", { rim: "#ff6f5e", dots: 0.1 });
    cel(below([[-20, 60], [120, 112], [260, 172], [400, 232], [520, 296], [660, 336]]), "#f2195a", { rim: "#ff4a7a", dots: 0.12 });
    cel(below([[-20, 180], [150, 240], [300, 300], [450, 352], [660, 410]]), "#c2187a", { rim: "#e0359a", dots: 0.12 });
    cel(below([[-20, 290], [100, 326], [220, 378], [320, 410]]), "#5b3a8c", { rim: "#7a52b0", dots: 0.14 });
  } else if (id === "capsules") {
    // Tall glass capsules in a row, each banded from cyan through blue and violet to peach
    flood("#a9e3fa");
    w.fillStyle = tone("#c9efff");
    for (let x = 0; x < W; x += 92) w.fillRect(x + 84, 0, 8, H);
    const C = "#25d4f7", B = "#1f6dff", D = "#1a22d8", V = "#7b57e6", L = "#c8a6ee", P = "#f6cdb4", S = "#bfeaff";
    const banded = (x, y, pw, ph, stops) => () => {
      stops.forEach(([t, hex], i) => {
        const y0 = y + t * ph, y1 = i + 1 < stops.length ? y + stops[i + 1][0] * ph : y + ph + 20;
        w.fillStyle = tone(hex);
        w.fillRect(x - 5, y0, pw + 10, y1 - y0 + 1);
      });
      // a toon glint down the left of the glass
      w.fillStyle = "rgba(255,255,255,.4)";
      w.beginPath();
      w.roundRect(x + pw * 0.16, y + Math.min(pw * 0.35, ph * 0.2), pw * 0.13, Math.max(ph - pw * 0.7, ph * 0.5), pw * 0.07);
      w.fill();
    };
    const pill = (col, y, ph, stops) => {
      const x = 4 + col * 92, pw = 84;
      cel(() => w.roundRect(x, y, pw, ph, pw / 2), banded(x, y, pw, ph, stops), { dots: 0.08, box: [x, y, pw, ph] });
    };
    pill(0, -40, 450, [[0, C], [0.12, B], [0.3, D], [0.45, V], [0.62, L], [0.8, P]]);
    pill(1, -40, 250, [[0, C], [0.25, B], [0.5, D], [0.8, B]]);
    pill(2, -40, 450, [[0, B], [0.15, D], [0.35, V], [0.5, L], [0.68, S], [0.85, "#e9f6ff"]]);
    pill(3, -40, 172, [[0, B], [0.35, D], [0.6, V], [0.85, P]]);
    const cx = 4 + 3 * 92 + 42;
    cel(() => w.arc(cx, 184, 42, 0, Math.PI * 2), banded(cx - 42, 142, 84, 84, [[0, V], [0.35, L], [0.7, P]]), { dots: 0.08, box: [cx - 42, 142, 84, 84] });
    pill(4, -40, 450, [[0, C], [0.15, B], [0.4, D], [0.6, V], [0.75, L], [0.9, P]]);
    pill(5, -40, 450, [[0, C], [0.2, B], [0.45, D], [0.62, V], [0.78, P], [0.92, S]]);
    pill(6, -40, 172, [[0, C], [0.6, "#7fe3fb"]]);
    pill(6, 232, 210, [[0, B], [0.25, D], [0.5, V], [0.75, L]]);
  } else if (id === "dusk") {
    // Layered paper waves at dusk: orange sky, pink and purple folds, a deep blue foot
    steps([[-20, "#ff5d55"], [220, "#ff7a45"], [430, "#ffa43e"]])();
    cel(below([[-20, -20], [130, -20], [170, 30], [230, 70], [300, 82], [380, 85], [460, 100], [560, 140], [660, 160]]),
      steps([[-20, "#7b2ea6"], [260, "#b02a7a"], [400, "#e02a6e"], [520, "#f42a72"]]), { rim: "#ff6b8a", rimW: 6 });
    cel(below([[-20, 60], [150, 90], [250, 110], [320, 140], [400, 160], [470, 195], [540, 215], [620, 215], [660, 210]]),
      steps([[-20, "#7c33a8"], [300, "#8b33b0"], [500, "#a63bbd"]]), { rim: "#c25bd6", rimW: 6 });
    cel(below([[-20, 240], [400, 240], [470, 222], [540, 220], [600, 238], [660, 252]]), "#cdeaf5", { rim: "#ffffff", rimW: 5, dots: 0 });
    cel(below([[-20, 70], [80, 105], [190, 150], [280, 190], [360, 232], [440, 240], [500, 234], [560, 250], [660, 268]]),
      steps([[-20, "#2a3fa8"], [250, "#3f4bc4"], [450, "#4f58de"]]), { rim: "#6b74f0", rimW: 6, dots: 0.12 });
    cel(below([[-20, 232], [100, 250], [200, 246], [300, 262], [380, 296], [460, 322], [560, 342], [660, 356]]), "#1f3a8c", { rim: "#2f4fae", rimW: 6, dots: 0.14 });
  } else if (id === "space-black") {
    // Black ribbons folding across a black screen, lit along their edges in silver
    flood("#0b0b0f");
    const body = "#1c1d23", light = "#a3a9bd";
    tube(() => {
      w.moveTo(40, 420);
      w.lineTo(40, 175);
      w.arcTo(40, 115, 100, 115, 60);
      w.lineTo(392, 115);
      w.arc(392, 76, 39, Math.PI / 2, -Math.PI / 2, true);
      w.lineTo(-30, 37);
    }, body, light, 34);
    tube(() => {
      w.moveTo(124, 420);
      w.lineTo(124, 247);
      w.arcTo(124, 192, 179, 192, 55);
      w.lineTo(392, 192);
      w.arc(392, 231, 39, -Math.PI / 2, Math.PI / 2, false);
      w.lineTo(250, 270);
      w.arc(250, 309, 39, -Math.PI / 2, Math.PI / 2, true);
      w.lineTo(670, 348);
    }, body, light, 34);
    tube(() => {
      w.moveTo(600, 215);
      w.lineTo(600, 85);
      w.arc(560, 85, 40, 0, Math.PI, true);
      w.lineTo(520, 230);
      w.arcTo(520, 270, 560, 270, 40);
      w.lineTo(670, 270);
    }, body, light, 34);
  } else if (id === "retro") {
    // Wavy flat-colour bands: greens from the left, blues from the top right, oranges to red below
    flood("#d8f9dc");
    cel(leftOf([[250, -20], [215, 30], [150, 80], [175, 140], [240, 180], [220, 240], [180, 300], [150, 360], [120, 410]]), "#65977a");
    cel(leftOf([[170, -20], [130, 40], [85, 90], [110, 150], [165, 190], [140, 250], [100, 300], [80, 410]]), "#235f58");
    cel(leftOf([[90, -20], [60, 60], [30, 120], [60, 180], [90, 230], [60, 300], [30, 410]]), "#13464d");
    cel(blob([[-20, 80], [30, 130], [44, 200], [20, 260], [-20, 300]]), "#0b161c", { dots: 0 });
    cel(blob([[230, -30], [250, 30], [320, 50], [380, 40], [430, 60], [460, 110], [560, 140], [680, 130], [680, -30]]), "#8eb2c6");
    cel(blob([[380, -30], [370, 20], [420, 30], [470, 50], [500, 90], [560, 110], [680, 100], [680, -30]]), "#74a1bb");
    cel(blob([[500, -30], [490, 20], [530, 40], [560, 60], [600, 50], [680, 60], [680, -30]]), "#2a7090");
    cel(blob([[580, -30], [600, 10], [680, 20], [680, -30]]), "#1f5d7b", { dots: 0 });
    cel(blob([[270, 420], [320, 330], [380, 300], [370, 240], [330, 200], [360, 160], [420, 170], [470, 210], [560, 230], [680, 220], [680, 420]]), "#eeab53");
    cel(blob([[400, 420], [420, 350], [470, 320], [460, 270], [500, 250], [560, 290], [680, 300], [680, 420]]), "#e68a3b");
    cel(blob([[470, 420], [470, 360], [520, 330], [600, 320], [680, 330], [680, 420]]), "#dc6c3e");
    cel(blob([[530, 420], [540, 380], [580, 355], [680, 350], [680, 420]]), "#d34236");
    cel(blob([[590, 420], [600, 395], [680, 380], [680, 420]]), "#a71c25", { dots: 0 });
  } else if (id === "air") {
    // Blue ribbons looping over a deep navy night, one violet loop tucked behind
    flood("#071230");
    const ring = (x, y, r) => () => w.arc(x, y, r, 0, Math.PI * 2);
    tube(ring(600, 330, 120), "#1d3f8f", "#2f5cb8", 46);
    tube(ring(30, 380, 96), "#19357d", "#2b52a6", 46);
    tube(ring(520, 70, 118), "#2b63c8", "#5a90ea", 52);
    tube(ring(380, 92, 46), "#6a4ad6", "#9a7cf2", 40);
    tube(ring(130, 160, 110), "#3f7fe0", "#7fb4f6", 52);
    tube(() => {
      w.moveTo(170, 420);
      w.bezierCurveTo(150, 300, 300, 220, 250, 120);
      w.bezierCurveTo(220, 60, 240, 10, 280, -30);
    }, "#4fa6ee", "#9fd6fb", 50);
    tube(() => {
      w.moveTo(300, -30);
      w.lineTo(300, 250);
      w.arc(380, 250, 80, Math.PI, Math.PI * 3, false);
    }, "#8edcfb", "#e2f7ff", 52);
  }

  // The whole sheet gets the print grain, then a soft vignette
  w.beginPath();
  w.rect(0, 0, W, H);
  grainOver(w, 1);
  const vignette = w.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, night ? "rgba(0,0,0,.35)" : "rgba(26,23,20,.12)");
  w.fillStyle = vignette;
  w.fillRect(0, 0, W, H);
}
