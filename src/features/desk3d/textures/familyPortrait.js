import { paperFinish } from "./aboutBoard";
import { crescent } from "./decor";
import { mixHex } from "./windowView";

// ---------- family portrait ----------
// The family on the desk frame, drawn as an anime-style illustration: dad with his arm round
// mum (in a hijab), who holds their waving two-year-old daughter, and their seven-year-old son
// in front in a little straw hat, throwing a peace sign. Heads lean in toward each other; flat
// colours, thick ink lines and big shiny eyes, like the rest of the room. By `night` the sky
// behind them turns dark with a crescent moon and stars.
// It's laid out 360 wide by 675 tall and scaled to the print's height: a wider print centres
// it and carries the sky and the lawn out to the sides.
export function drawFamilyPortrait(c, w, h, { night = false } = {}) {
  const u = h / 675;
  const INK = "#1a1714";
  const SKIN = "#f6d2b4";
  const SKIN_SHADE = "#e9b894";
  c.save();
  c.scale(u, u);
  const H = 675;
  const PAD = (w / u - 360) / 2;
  c.translate(PAD, 0);
  const line = (width = 4) => {
    c.lineWidth = width;
    c.strokeStyle = INK;
    c.lineJoin = "round";
    c.lineCap = "round";
  };
  const shape = (fill, draw, width = 4) => {
    c.beginPath();
    draw();
    c.fillStyle = fill;
    c.fill();
    if (width) {
      line(width);
      c.stroke();
    }
  };
  const ellipse = (x, y, rx, ry, fill, width = 4) => shape(fill, () => c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2), width);
  const stroke = (width, draw) => {
    line(width);
    c.beginPath();
    draw();
    c.stroke();
  };
  // Draws `fn` turned by `angle` about (x, y): for heads leaning in
  const tilted = (x, y, angle, fn) => {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.translate(-x, -y);
    fn();
    c.restore();
  };
  const sparkle = (x, y, r, color = "#fff") => {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x, y - r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.quadraticCurveTo(x, y, x, y + r);
    c.quadraticCurveTo(x, y, x - r, y);
    c.quadraticCurveTo(x, y, x, y - r);
    c.fill();
  };
  const heart = (x, y, r, color) => {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x, y + r * 0.9);
    c.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.1, x, y - r * 0.35);
    c.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
    c.fill();
    line(2);
    c.stroke();
  };
  // Repeating cloth and print textures, drawn at twice the scene's units so they stay crisp
  const pattern = (size, paint) => {
    const tile = document.createElement("canvas");
    tile.width = tile.height = size * 2;
    const t = tile.getContext("2d");
    t.scale(2, 2);
    paint(t, size);
    const p = c.createPattern(tile, "repeat");
    p.setTransform(new DOMMatrix().scale(0.5));
    return p;
  };
  // manga screentone for the shadows
  const DOTS = pattern(6, (t) => {
    t.fillStyle = "rgba(26,23,20,.2)";
    [[1.5, 1.5], [4.5, 4.5]].forEach(([x, y]) => {
      t.beginPath();
      t.arc(x, y, 1, 0, Math.PI * 2);
      t.fill();
    });
  });
  // a diagonal twill, for denim and khaki
  const TWILL = pattern(6, (t) => {
    t.lineWidth = 0.8;
    [[0, "rgba(0,0,0,.1)"], [3, "rgba(255,255,255,.08)"]].forEach(([o, color]) => {
      t.strokeStyle = color;
      t.beginPath();
      for (let k = -6; k <= 6; k += 6) {
        t.moveTo(k + o, 6);
        t.lineTo(k + o + 6, 0);
      }
      t.stroke();
    });
  });
  // a soft linen crosshatch, for the hijab and dresses
  const LINEN = pattern(5, (t) => {
    t.fillStyle = "rgba(255,255,255,.1)";
    t.fillRect(0, 0, 5, 0.7);
    t.fillStyle = "rgba(0,0,0,.06)";
    t.fillRect(0, 0, 0.7, 5);
    t.fillRect(2.5, 2.5, 0.6, 0.6);
  });
  // a knitted rib, for the boy's shirt and the girl's dress
  const RIB = pattern(4, (t) => {
    t.fillStyle = "rgba(0,0,0,.08)";
    t.fillRect(0, 0, 1, 4);
    t.fillStyle = "rgba(255,255,255,.08)";
    t.fillRect(2, 0, 0.8, 4);
  });
  // a basket weave, for the straw hat
  const WEAVE = pattern(8, (t) => {
    t.strokeStyle = "rgba(150,100,20,.45)";
    t.lineWidth = 0.9;
    t.beginPath();
    t.moveTo(0.5, 1); t.lineTo(3.5, 1);
    t.moveTo(0.5, 3); t.lineTo(3.5, 3);
    t.moveTo(5, 0.5); t.lineTo(5, 3.5);
    t.moveTo(7, 0.5); t.lineTo(7, 3.5);
    t.moveTo(4.5, 5); t.lineTo(7.5, 5);
    t.moveTo(4.5, 7); t.lineTo(7.5, 7);
    t.moveTo(1, 4.5); t.lineTo(1, 7.5);
    t.moveTo(3, 4.5); t.lineTo(3, 7.5);
    t.stroke();
  });
  // Cel shading: the shape in a flat darker tone dusted with screentone, the lit colour laid
  // over it nudged up and left toward the sun, so a hard-edged shadow is left down its far side;
  // `texture` (the cloth) runs over the whole piece, under the ink outline.
  const cel = (fill, draw, { width = 4, off = [-7, -4], shade = mixHex(fill, "#3a2440", 0.3), dots = true, texture } = {}) => {
    c.save();
    c.beginPath();
    draw();
    c.clip();
    c.fillStyle = shade;
    c.fill();
    if (dots) {
      c.fillStyle = DOTS;
      c.fill();
    }
    c.translate(off[0], off[1]);
    c.beginPath();
    draw();
    c.fillStyle = fill;
    c.fill();
    c.translate(-off[0], -off[1]);
    if (texture) {
      c.fillStyle = texture;
      c.fillRect(0, 0, 360, H);
    }
    c.restore();
    if (width) {
      c.beginPath();
      draw();
      line(width);
      c.stroke();
    }
  };
  // Loose strands in a lighter tone over a hairdo
  const strands = (color, width, paths) => {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = "round";
    paths.forEach(([x1, y1, cx, cy, x2, y2]) => {
      c.beginPath();
      c.moveTo(x1, y1);
      c.quadraticCurveTo(cx, cy, x2, y2);
      c.stroke();
    });
  };

  // ---- Backdrop: by day a clear blue sky, sun rays, soft bokeh and petals; by night a deep
  // blue sky with a glowing crescent moon and twinkling stars. A flowery lawn either way ----
  const sky = c.createLinearGradient(0, 0, 0, H);
  (night ? [[0, "#141a3d"], [0.6, "#2b3a78"], [1, "#4b5f9e"]] : [[0, "#7cc4f2"], [0.6, "#b8e2fb"], [1, "#e2f4fd"]]).forEach(([at, color]) => sky.addColorStop(at, color));
  c.fillStyle = sky;
  c.fillRect(-PAD, 0, 360 + 2 * PAD, H);
  if (night) {
    // the moon's halo, a few soft rings, then the crescent with its craters
    c.save();
    [[96, 0.08], [72, 0.12], [54, 0.18]].forEach(([r, alpha]) => {
      c.globalAlpha = alpha;
      ellipse(284, 78, r, r, "#cfd9ff", 0);
    });
    c.restore();
    const moon = crescent(284, 78, 38, 304, 62, 33);
    c.fillStyle = "#fff4c4";
    c.fill(moon);
    c.save();
    c.clip(moon);
    c.fillStyle = "#f0d98c";
    [[264, 86, 6], [274, 104, 4], [258, 66, 3.5]].forEach(([x, y, r]) => {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    });
    c.restore();
    line(4);
    c.stroke(moon);
    // a field of tiny stars, then bigger twinkling ones
    let starSeed = 5;
    const starRand = () => ((starSeed = (starSeed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 90; i++) {
      const x = starRand() * 360;
      const y = starRand() * 520;
      c.globalAlpha = 0.4 + starRand() * 0.6;
      c.fillStyle = i % 4 ? "#ffffff" : "#ffe9a8";
      c.beginPath();
      c.arc(x, y, 0.6 + starRand() * 1.1, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    [[50, 60, 9], [130, 34, 6], [330, 190, 8], [36, 230, 7], [312, 300, 6], [80, 140, 5], [176, 70, 5], [340, 440, 7], [24, 420, 6]].forEach(([x, y, r], i) =>
      sparkle(x, y, r, i % 3 ? "#fffdf5" : "#ffe58a"));
  } else {
    c.save();
    c.globalAlpha = 0.35;
    c.fillStyle = "#fff7e6";
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.22;
      c.beginPath();
      c.moveTo(180, 120);
      c.lineTo(180 + Math.cos(a - 0.06) * 700, 120 + Math.sin(a - 0.06) * 700);
      c.lineTo(180 + Math.cos(a + 0.06) * 700, 120 + Math.sin(a + 0.06) * 700);
      c.closePath();
      c.fill();
    }
    [[50, 150, 26], [320, 200, 20], [300, 60, 14], [40, 380, 18], [330, 420, 24], [90, 40, 12]].forEach(([x, y, r]) => {
      c.globalAlpha = 0.28;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fillStyle = "#ffffff";
      c.fill();
    });
    c.restore();
    ellipse(180, 120, 70, 70, "#fff3d6", 0);
    [[40, 70, 0.4], [310, 110, -0.6], [70, 300, 1.1], [300, 330, 0.2], [30, 470, -0.3], [330, 520, 0.8], [250, 50, 1.4], [120, 90, 2.1]].forEach(([x, y, r]) => {
      c.save();
      c.translate(x, y);
      c.rotate(r);
      c.beginPath();
      c.ellipse(0, 0, 9, 5.5, 0, 0, Math.PI * 2);
      c.fillStyle = "#ff9ec2";
      c.fill();
      line(2.5);
      c.stroke();
      c.restore();
    });
    [[64, 120, 7], [292, 160, 9], [320, 470, 6], [44, 250, 6]].forEach(([x, y, r]) => sparkle(x, y, r));
  }
  shape(night ? "#5d8a7a" : "#a7d7a5", () => {
    c.moveTo(-PAD, 560);
    c.quadraticCurveTo(180, 530, 360 + PAD, 560);
    c.lineTo(360 + PAD, H);
    c.lineTo(-PAD, H);
    c.closePath();
  });
  // short blades of grass across the lawn, darker toward the front
  c.save();
  c.clip();
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 140; i++) {
    const x = -PAD + rand() * (360 + 2 * PAD);
    const y = 552 + rand() * (H - 552);
    c.strokeStyle = i % 3 ? "rgba(30,70,60,.4)" : `rgba(255,255,255,${night ? 0.18 : 0.35})`;
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + ((i % 5) - 2) * 0.8, y - 5 - (i % 4));
    c.stroke();
  }
  c.restore();
  // little flowers and grass tufts on the lawn
  [[30, 572, "#fffdf5"], [70, 585, "#ffdd00"], [300, 575, "#ff90b3"], [334, 590, "#fffdf5"], [110, 592, "#ff90b3"]].forEach(([x, y, color]) => {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ellipse(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3.4, 3.4, color, 1.5);
    }
    ellipse(x, y, 2.6, 2.6, "#ffb000", 1.2);
  });
  [[150, 580], [240, 586], [20, 600], [350, 610]].forEach(([x, y]) => stroke(2.5, () => {
    c.moveTo(x - 6, y + 4);
    c.lineTo(x - 3, y - 4);
    c.moveTo(x, y + 4);
    c.lineTo(x + 1, y - 7);
    c.moveTo(x + 6, y + 4);
    c.lineTo(x + 5, y - 3);
  }));

  // An anime face: brows, big glossy eyes (or happy closed ones), rosy cheeks and a smile that
  // can open into a grin
  const face = (x, y, r, { eye = "#5a3825", lashes = false, closed = false, grin = false, brow = INK } = {}) => {
    cel(SKIN, () => c.ellipse(x, y, r, r * 1.04, 0, 0, Math.PI * 2), { off: [-r * 0.16, -r * 0.08], shade: SKIN_SHADE, dots: false });
    // a soft shade under the hairline
    c.save();
    c.globalAlpha = 0.25;
    c.beginPath();
    c.ellipse(x, y - r * 0.55, r * 0.85, r * 0.3, 0, 0, Math.PI * 2);
    c.fillStyle = SKIN_SHADE;
    c.fill();
    c.restore();
    [-1, 1].forEach((side) => {
      const ex = x + side * r * 0.38;
      const ey = y + r * 0.12;
      c.fillStyle = "#ff9fb1";
      c.globalAlpha = 0.7;
      c.beginPath();
      c.ellipse(ex + side * r * 0.12, ey + r * 0.32, r * 0.17, r * 0.09, 0, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
      // blush hatching
      stroke(1.5, () => {
        [-0.08, 0, 0.08].forEach((dx) => {
          c.moveTo(ex + side * r * (0.08 + dx), ey + r * 0.36);
          c.lineTo(ex + side * r * (0.13 + dx), ey + r * 0.28);
        });
      });
      // brows, raised and soft
      c.strokeStyle = brow;
      line(r * 0.07);
      c.strokeStyle = brow;
      c.beginPath();
      c.moveTo(ex - side * r * 0.14, ey - r * 0.36);
      c.quadraticCurveTo(ex + side * r * 0.02, ey - r * 0.46, ex + side * r * 0.18, ey - r * 0.38);
      c.stroke();
      if (closed) {
        stroke(3, () => c.arc(ex, ey + r * 0.04, r * 0.14, Math.PI * 1.1, Math.PI * 1.9));
        return;
      }
      c.beginPath();
      c.ellipse(ex, ey, r * 0.15, r * 0.22, 0, 0, Math.PI * 2);
      c.fillStyle = INK;
      c.fill();
      c.beginPath();
      c.ellipse(ex, ey + r * 0.05, r * 0.11, r * 0.14, 0, 0, Math.PI * 2);
      c.fillStyle = eye;
      c.fill();
      // the iris lighter toward the bottom, with a dark pupil
      c.beginPath();
      c.ellipse(ex, ey + r * 0.12, r * 0.08, r * 0.06, 0, 0, Math.PI * 2);
      c.fillStyle = mixHex(eye, "#ffd9a0", 0.45);
      c.fill();
      c.beginPath();
      c.ellipse(ex, ey + r * 0.03, r * 0.05, r * 0.07, 0, 0, Math.PI * 2);
      c.fillStyle = INK;
      c.fill();
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(ex - r * 0.05, ey - r * 0.08, r * 0.065, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(ex + r * 0.05, ey + r * 0.08, r * 0.03, 0, Math.PI * 2);
      c.fill();
      if (lashes) {
        stroke(3, () => {
          c.moveTo(ex + side * r * 0.12, ey - r * 0.16);
          c.lineTo(ex + side * r * 0.24, ey - r * 0.26);
        });
      }
    });
    if (grin) {
      shape("#7a2b2b", () => {
        c.moveTo(x - r * 0.22, y + r * 0.42);
        c.quadraticCurveTo(x, y + r * 0.44, x + r * 0.22, y + r * 0.42);
        c.quadraticCurveTo(x + r * 0.2, y + r * 0.72, x, y + r * 0.72);
        c.quadraticCurveTo(x - r * 0.2, y + r * 0.72, x - r * 0.22, y + r * 0.42);
        c.closePath();
      }, 2.5);
      ellipse(x, y + r * 0.63, r * 0.1, r * 0.06, "#ff8a8a", 0);
    } else stroke(3, () => c.arc(x, y + r * 0.42, r * 0.15, Math.PI * 0.12, Math.PI * 0.88));
  };
  const neck = (x, y, wd, hd) => shape(SKIN_SHADE, () => c.rect(x - wd / 2, y, wd, hd), 3);
  const hand = (x, y, r = 9) => cel(SKIN, () => c.ellipse(x, y, r, r * 0.9, 0, 0, Math.PI * 2), { width: 3, off: [-r * 0.25, -r * 0.2], shade: SKIN_SHADE, dots: false });
  // A sleeve as a thick rounded stroke from a to b, with a hand at the end
  const arm = (color, x1, y1, cx, cy, x2, y2, width = 22, handR = 9) => {
    c.lineCap = "round";
    c.lineWidth = width + 8;
    c.strokeStyle = INK;
    c.beginPath();
    c.moveTo(x1, y1);
    c.quadraticCurveTo(cx, cy, x2, y2);
    c.stroke();
    c.lineWidth = width;
    c.strokeStyle = mixHex(color, "#3a2440", 0.3);
    c.stroke();
    // the lit side, toward the sun
    c.save();
    c.translate(-width * 0.14, -width * 0.1);
    c.lineWidth = width * 0.62;
    c.strokeStyle = color;
    c.stroke();
    c.restore();
    hand(x2, y2, handR);
  };

  // ---- Dad (right): short black hair, navy overshirt over a white tee, khaki trousers ----
  const DX = 248;
  cel("#c8a97e", () => {
    c.moveTo(DX - 48, 380);
    c.lineTo(DX - 52, 560);
    c.lineTo(DX - 6, 560);
    c.lineTo(DX, 420);
    c.lineTo(DX + 6, 560);
    c.lineTo(DX + 52, 560);
    c.lineTo(DX + 48, 380);
    c.closePath();
  }, { texture: TWILL });
  stroke(2, () => {
    c.moveTo(DX - 28, 430);
    c.lineTo(DX - 30, 550);
    c.moveTo(DX + 28, 430);
    c.lineTo(DX + 30, 550);
  });
  [-1, 1].forEach((s) => {
    cel("#5a3a2a", () => c.roundRect(DX + s * 28 - 26, 552, 52, 16, 7), { width: 3, off: [-4, -3], dots: false });
    stroke(2, () => {
      c.moveTo(DX + s * 28 - 10, 556);
      c.lineTo(DX + s * 28 + 10, 556);
    });
  });
  neck(DX, 222, 26, 24);
  cel("#2f4a7a", () => {
    c.moveTo(DX - 62, 262);
    c.quadraticCurveTo(DX, 236, DX + 62, 262);
    c.lineTo(DX + 54, 392);
    c.lineTo(DX - 54, 392);
    c.closePath();
  }, { off: [-9, -4], texture: TWILL });
  // open front showing the tee, collar points, buttons and a chest pocket
  cel("#fffdf5", () => {
    c.moveTo(DX - 18, 244);
    c.lineTo(DX + 18, 244);
    c.lineTo(DX + 12, 392);
    c.lineTo(DX - 12, 392);
    c.closePath();
  }, { width: 3, off: [-5, 0], shade: "#e4dccb", dots: false, texture: RIB });
  shape("#3d5f99", () => {
    c.moveTo(DX - 18, 244);
    c.lineTo(DX - 4, 262);
    c.lineTo(DX - 26, 270);
    c.closePath();
  }, 2.5);
  shape("#3d5f99", () => {
    c.moveTo(DX + 18, 244);
    c.lineTo(DX + 4, 262);
    c.lineTo(DX + 26, 270);
    c.closePath();
  }, 2.5);
  shape("#3d5f99", () => c.rect(DX + 24, 290, 20, 18), 2.5);
  [300, 330, 360].forEach((y) => ellipse(DX - 22, y, 2.5, 2.5, "#fffdf5", 1.5));
  shape("#7a5a2a", () => c.rect(DX - 54, 384, 108, 10), 2.5);
  ellipse(DX, 389, 6, 5, "#d4a72c", 2);
  // right arm down, thumbs up
  arm("#2f4a7a", DX + 52, 272, DX + 74, 330, DX + 62, 384, 22, 10);
  shape(SKIN, () => c.roundRect(DX + 58, 366, 8, 14, 4), 2.5);
  shape("#fffdf5", () => c.rect(DX + 50, 372, 22, 5), 2);
  // head, leaning toward mum
  tilted(DX, 222, -0.1, () => {
    face(DX, 188, 40, { grin: true });
    shape(INK, () => {
      c.moveTo(DX - 42, 186);
      c.quadraticCurveTo(DX - 46, 136, DX - 6, 140);
      c.lineTo(DX + 2, 130);
      c.lineTo(DX + 10, 142);
      c.quadraticCurveTo(DX + 46, 140, DX + 42, 186);
      c.quadraticCurveTo(DX + 34, 168, DX + 20, 166);
      c.lineTo(DX + 10, 174);
      c.lineTo(DX + 4, 162);
      c.quadraticCurveTo(DX - 20, 170, DX - 30, 160);
      c.quadraticCurveTo(DX - 36, 176, DX - 42, 186);
      c.closePath();
    }, 3);
    // a shine on the hair, and ears
    c.strokeStyle = "#4b5e86";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(DX - 6, 158, 20, Math.PI * 1.15, Math.PI * 1.55);
    c.stroke();
    strands("#4a443e", 1.8, [[DX - 34, 172, DX - 34, 150, DX - 16, 146], [DX + 14, 146, DX + 34, 150, DX + 36, 172], [DX + 4, 150, DX + 18, 152, DX + 22, 164]]);
    [-1, 1].forEach((s) => ellipse(DX + s * 41, 194, 6, 9, SKIN, 3));
  });

  // ---- Mum (left): a dusty-rose hijab with a brooch, and a long sage dress with a belt ----
  const MX = 118;
  cel("#8fb8a0", () => {
    c.moveTo(MX - 44, 290);
    c.quadraticCurveTo(MX - 60, 440, MX - 70, 562);
    c.lineTo(MX + 70, 562);
    c.quadraticCurveTo(MX + 60, 440, MX + 44, 290);
    c.closePath();
  }, { off: [-10, -2], texture: LINEN });
  // a little floral print and the dress's folds
  [[MX - 30, 430], [MX + 20, 470], [MX - 12, 510], [MX + 36, 530], [MX - 44, 520], [MX + 6, 420]].forEach(([x, y]) => {
    for (let i = 0; i < 4; i++) ellipse(x + Math.cos((i * Math.PI) / 2) * 3, y + Math.sin((i * Math.PI) / 2) * 3, 2.4, 2.4, "#fffdf5", 0);
    ellipse(x, y, 1.6, 1.6, "#ffb000", 0);
  });
  stroke(2, () => {
    c.moveTo(MX - 20, 420);
    c.quadraticCurveTo(MX - 26, 500, MX - 30, 556);
    c.moveTo(MX + 24, 430);
    c.quadraticCurveTo(MX + 30, 500, MX + 34, 556);
  });
  shape("#6f9a82", () => c.rect(MX - 50, 384, 100, 10), 2.5);
  [-1, 1].forEach((s) => cel("#6b4a3a", () => c.roundRect(MX + s * 26 - 20, 556, 40, 12, 6), { width: 3, off: [-4, -3], dots: false }));
  // left arm hanging down
  arm("#7aa38b", MX - 52, 304, MX - 70, 380, MX - 58, 450, 22, 9);
  // The hijab: a rounded hood framing the face and a drape over the shoulders, head leaning in
  tilted(MX, 240, 0.09, () => {
    cel("#d98fa0", () => {
      c.moveTo(MX - 50, 200);
      c.quadraticCurveTo(MX - 54, 152, MX, 150);
      c.quadraticCurveTo(MX + 54, 152, MX + 50, 200);
      c.quadraticCurveTo(MX + 66, 280, MX + 52, 322);
      c.quadraticCurveTo(MX, 340, MX - 52, 322);
      c.quadraticCurveTo(MX - 66, 280, MX - 50, 200);
      c.closePath();
    }, { off: [-9, -5], texture: LINEN });
    // a soft shine on the fabric
    c.strokeStyle = "#f2b9c6";
    c.lineWidth = 4;
    c.beginPath();
    c.arc(MX - 4, 196, 44, Math.PI * 1.2, Math.PI * 1.45);
    c.stroke();
    face(MX, 212, 34, { lashes: true, closed: true, grin: false });
    // the inner band hugging the face
    c.beginPath();
    c.ellipse(MX, 210, 36, 40, 0, Math.PI * 1.08, Math.PI * 1.92);
    line(7);
    c.strokeStyle = "#f2c6cf";
    c.stroke();
    stroke(3, () => c.ellipse(MX, 210, 40, 44, 0, Math.PI * 1.05, Math.PI * 1.95));
    // the drape's folds and a pearl brooch under the chin
    [[MX - 30, 268, MX - 38, 314], [MX + 30, 268, MX + 38, 314], [MX - 12, 290, MX - 16, 330]].forEach(([x1, y1, x2, y2]) => stroke(2.5, () => {
      c.moveTo(x1, y1);
      c.quadraticCurveTo((x1 + x2) / 2 + (x1 < MX ? -6 : 6), (y1 + y2) / 2, x2, y2);
    }));
    ellipse(MX + 22, 262, 7, 7, "#fffdf5", 2.5);
    ellipse(MX + 22, 262, 3, 3, "#ffd34d", 0);
  });

  // Dad's arm round mum's shoulders, his hand on her far shoulder
  arm("#2f4a7a", DX - 50, 270, MX + 80, 248, MX + 44, 284, 20, 9);

  // ---- The little girl (2), on Mum's hip: pigtails with bows, a yellow dress, waving ----
  c.save();
  c.translate(4, -22);
  const GX = 168;
  // Mum's arm, under her: up from Mum's side and round beneath her
  arm("#7aa38b", MX + 40, 304, MX + 30, 378, GX - 20, 352, 18, 0.1);
  cel("#ffd34d", () => {
    c.moveTo(GX - 22, 316);
    c.quadraticCurveTo(GX, 306, GX + 22, 316);
    c.lineTo(GX + 30, 372);
    c.lineTo(GX - 30, 372);
    c.closePath();
  }, { off: [-6, -3], texture: RIB });
  // a white collar and a little flower on the dress
  shape("#fffdf5", () => {
    c.moveTo(GX - 14, 312);
    c.quadraticCurveTo(GX - 8, 324, GX, 316);
    c.quadraticCurveTo(GX + 8, 324, GX + 14, 312);
    c.closePath();
  }, 2);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ellipse(GX + 12 + Math.cos(a) * 3.5, 350 + Math.sin(a) * 3.5, 2.6, 2.6, "#ff90b3", 0);
  }
  ellipse(GX + 12, 350, 1.8, 1.8, "#fff", 0);
  [-1, 1].forEach((s) => cel(SKIN, () => c.roundRect(GX + s * 12 - 6, 368, 12, 24, 6), { width: 3, off: [-3, 0], shade: SKIN_SHADE, dots: false }));
  [-1, 1].forEach((s) => ellipse(GX + s * 12, 394, 9, 6, "#ff90b3", 3));
  // her waving arm, up by her head
  arm("#ffd34d", GX + 20, 322, GX + 42, 312, GX + 40, 280, 10, 7);
  stroke(2, () => {
    c.arc(GX + 40, 280, 14, Math.PI * 1.2, Math.PI * 1.5);
    c.moveTo(GX + 56, 272);
    c.arc(GX + 40, 280, 18, Math.PI * 1.75, Math.PI * 1.95);
  });
  tilted(GX, 300, -0.12, () => {
    [-1, 1].forEach((s) => ellipse(GX + s * 34, 268, 10, 13, "#4a2c1d", 3));
    face(GX, 282, 26, { eye: "#3d2a1e", grin: true });
    cel("#4a2c1d", () => {
      c.moveTo(GX - 27, 280);
      c.quadraticCurveTo(GX - 28, 250, GX, 252);
      c.quadraticCurveTo(GX + 28, 250, GX + 27, 280);
      c.quadraticCurveTo(GX + 14, 266, GX + 2, 270);
      c.quadraticCurveTo(GX - 12, 264, GX - 27, 280);
      c.closePath();
    }, { width: 3, off: [-4, -3], shade: "#2e1a10", dots: false });
    strands("#7a5038", 1.6, [[GX - 18, 270, GX - 16, 256, GX - 4, 254], [GX + 6, 256, GX + 18, 258, GX + 22, 270], [GX - 8, 262, GX - 2, 256, GX + 4, 262]]);
    // bows on the pigtails
    [-1, 1].forEach((s) => {
      [-1, 1].forEach((k) => shape("#ff6b8b", () => {
        c.moveTo(GX + s * 30, 258);
        c.lineTo(GX + s * 30 + k * 9, 252);
        c.lineTo(GX + s * 30 + k * 9, 264);
        c.closePath();
      }, 2));
      ellipse(GX + s * 30, 258, 3, 3, "#ff6b8b", 2);
    });
  });
  // Mum's hand on her side (the arm runs under her, drawn before her)
  hand(GX - 20, 352, 8);
  c.restore();

  // ---- The boy (7), in front: a straw hat, a red shirt, blue shorts and a peace sign ----
  const BX = 182;
  [-1, 1].forEach((s) => cel(SKIN, () => c.roundRect(BX + s * 14 - 8, 510, 16, 44, 7), { width: 3, off: [-4, 0], shade: SKIN_SHADE, dots: false }));
  [-1, 1].forEach((s) => {
    cel("#fffdf5", () => c.roundRect(BX + s * 16 - 15, 550, 30, 14, 6), { width: 3, off: [-3, -3], shade: "#d9d2c3", dots: false });
    shape("#e5484d", () => c.rect(BX + s * 16 - 15, 559, 30, 4), 0);
    stroke(1.5, () => {
      c.moveTo(BX + s * 16 - 4, 552);
      c.lineTo(BX + s * 16 + 4, 556);
      c.moveTo(BX + s * 16 + 4, 552);
      c.lineTo(BX + s * 16 - 4, 556);
    });
  });
  cel("#3b6fd6", () => c.roundRect(BX - 32, 478, 64, 42, 8), { off: [-6, -4], texture: TWILL });
  stroke(2, () => {
    c.moveTo(BX, 486);
    c.lineTo(BX, 518);
  });
  cel("#e5484d", () => {
    c.moveTo(BX - 40, 420);
    c.quadraticCurveTo(BX, 404, BX + 40, 420);
    c.lineTo(BX + 36, 486);
    c.lineTo(BX - 36, 486);
    c.closePath();
  }, { off: [-8, -4], texture: RIB });
  stroke(3, () => {
    c.moveTo(BX - 8, 412);
    c.lineTo(BX - 4, 482);
    c.moveTo(BX + 8, 412);
    c.lineTo(BX + 4, 482);
  });
  [440, 460].forEach((y) => ellipse(BX - 13, y, 2.6, 2.6, "#ffdd00", 1.5));
  // left arm down, right arm up making a peace sign
  arm("#e5484d", BX - 38, 428, BX - 50, 460, BX - 46, 486, 18, 8);
  arm("#e5484d", BX + 38, 428, BX + 66, 420, BX + 62, 382, 18, 9);
  [-1, 1].forEach((s) => shape(SKIN, () => {
    c.save();
    c.translate(BX + 62 + s * 4, 372);
    c.rotate(s * 0.25);
    c.roundRect(-3.5, -16, 7, 18, 3.5);
    c.restore();
  }, 2.5));
  hand(BX + 62, 382, 9);
  tilted(BX, 410, 0.07, () => {
    face(BX, 380, 31, { grin: true });
    cel("#2a1a12", () => {
      c.moveTo(BX - 32, 378);
      c.quadraticCurveTo(BX - 34, 350, BX, 350);
      c.quadraticCurveTo(BX + 34, 350, BX + 32, 378);
      c.lineTo(BX + 22, 366);
      c.lineTo(BX + 12, 374);
      c.lineTo(BX + 2, 362);
      c.lineTo(BX - 10, 374);
      c.lineTo(BX - 20, 364);
      c.closePath();
    }, { width: 3, off: [-4, -3], shade: "#140c08", dots: false });
    strands("#5a3c2a", 1.4, [[BX - 24, 366, BX - 20, 356, BX - 8, 356], [BX + 8, 356, BX + 22, 358, BX + 24, 368]]);
    // a sticking plaster on his cheek, for a boy who plays hard
    c.save();
    c.translate(BX - 18, 396);
    c.rotate(-0.4);
    shape("#ffd9a8", () => c.roundRect(-7, -3, 14, 6, 3), 1.5);
    c.restore();
    // the straw hat: a wide brim, a round crown, a red band and woven lines
    cel("#f2c14e", () => c.ellipse(BX, 356, 54, 12, 0, 0, Math.PI * 2), { off: [-6, -4], texture: WEAVE });
    cel("#f2c14e", () => {
      c.moveTo(BX - 30, 356);
      c.quadraticCurveTo(BX - 32, 318, BX, 318);
      c.quadraticCurveTo(BX + 32, 318, BX + 30, 356);
      c.closePath();
    }, { off: [-8, -3], texture: WEAVE });
    cel("#d62828", () => c.rect(BX - 31, 340, 62, 12), { width: 3, off: [-6, -3], dots: false });
    c.strokeStyle = "#c99a32";
    c.lineWidth = 1.5;
    [-36, -22, 22, 36].forEach((dx) => {
      c.beginPath();
      c.moveTo(BX + dx, 352);
      c.lineTo(BX + dx * 1.25, 362);
      c.stroke();
    });
  });

  // a few hearts floating up between them
  heart(206, 150, 7, "#ff6b8b");
  heart(222, 128, 5, "#ff90b3");
  heart(70, 210, 6, "#ff90b3");

  // Caption
  c.fillStyle = INK;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = "800 30px 'Space Grotesk', sans-serif";
  c.fillText("Our Little Family", 180, 616);
  heart(180, 648, 9, "#e5484d");
  c.restore();
  // Printed on photo paper: a fine grain and a soft gloss across the top corner
  paperFinish(c, w, h, 7);
  const gloss = c.createLinearGradient(0, 0, w * 0.6, h * 0.35);
  gloss.addColorStop(0, `rgba(255,255,255,${night ? 0.1 : 0.22})`);
  gloss.addColorStop(0.5, `rgba(255,255,255,${night ? 0.03 : 0.06})`);
  gloss.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = gloss;
  c.fillRect(0, 0, w, h);
}

