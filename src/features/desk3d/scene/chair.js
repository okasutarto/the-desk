import * as THREE from "three";
import gsap from "gsap";
import { hoverSound, sfx } from "@/shared/composables/useSfx";
import { canvasTexture, drawLeatherGrain, drawChairCrest } from "../textures";
import { DEVICE_FINISHES } from "../deviceFinishes";

export function createChair(runtime) {
  // Secretlab TITAN Evo Regular: 85 cm backrest, 56 × 49 cm seat, set to 52 cm high.
  const CHAIR_FLOOR = runtime.room.FLOOR_Y + 0.08; // top of the rug
  const chair = new THREE.Group();
  // Parked close in at the desk. It rolls back out to SPIN_Z, where its back clears the
  // tabletop at any angle, before it turns, and back in, facing the desk, once it stops.
  const REST_Z = 7.3;
  const SPIN_Z = 8.6;
  chair.position.set(-3.1, 0, REST_Z);
  // Left swung out to the right, side on to the room, as if just got up from: the seat faces
  // the room's right wall, its far armrest tucked under the tabletop's front edge
  chair.rotation.y = -1.13;
  runtime.room.room.add(chair);
  const chairFrameMat = runtime.core.toon("#1a1714");
  // A 56 × 49 cm cushion, 70 cm across the armrests. A premium gaming chair in black
  // leatherette all over: a tall back with the headrest built in, a raised centre panel
  // between padded wings, fine dark red stitching along every seam, gold badges, a thick padded
  // seat, recline hubs, 4D armrests and a flat-legged base.
  // The leatherette: a pebbled grain tile, tinted dark, that also bumps the toon shading so
  // the grain catches the light; the centre panel's is perforated. The pads' uv run in world
  // units (a tile to a unit), the boxes' 0 to 1 a face, so theirs repeat more.
  const leatherTile = (perforated, repeat) => {
    const tex = canvasTexture(256, 256);
    runtime.core.track(tex.texture);
    drawLeatherGrain(tex.ctx, 256, 256, { perforated });
    tex.texture.wrapS = tex.texture.wrapT = THREE.RepeatWrapping;
    tex.texture.repeat.set(repeat, repeat);
    const mat = runtime.core.toon("#35312e");
    mat.map = mat.bumpMap = tex.texture;
    mat.bumpScale = 2.2;
    return mat;
  };
  const leather = leatherTile(false, 1);
  const leatherPanel = leatherTile(true, 1.6);
  const leatherBox = leatherTile(false, 3.5);
  // Black or white leatherette (see DEVICE_FINISHES.chair); the frame and base stay black.
  function setChairFinish(finish) {
    if (!Object.hasOwn(DEVICE_FINISHES.chair.finishes, finish)) return;
    const coat = DEVICE_FINISHES.chair.finishes[finish];
    for (const mat of [leather, leatherPanel, leatherBox]) {
      mat.color.set(coat.shell);
      // Adding or dropping the colour map changes the shader, so it is rebuilt then.
      if (!!mat.map !== coat.grain) mat.needsUpdate = true;
      mat.map = coat.grain ? mat.bumpMap : null;
      mat.bumpScale = coat.bump;
    }
  }
  setChairFinish(runtime.options.deviceFinishes?.chair || DEVICE_FINISHES.chair.default);
  const CHAIR_STITCH = "#7a1a24";
  // Stitching is a fine dashed thread: a dash, a gap, along every seam
  const dashTex = canvasTexture(16, 4);
  runtime.core.track(dashTex.texture);
  dashTex.ctx.fillStyle = "#000";
  dashTex.ctx.fillRect(0, 0, 16, 4);
  dashTex.ctx.fillStyle = "#fff";
  dashTex.ctx.fillRect(0, 0, 10, 4);
  dashTex.texture.wrapS = THREE.RepeatWrapping;
  dashTex.texture.magFilter = THREE.NearestFilter;
  // A stitched seam: a thin red tube through a closed loop of points
  const STITCH_LENGTH = 0.09;
  const chairSeam = (points) => {
    const curve = new THREE.CatmullRomCurve3(points, true);
    // each seam gets its own thread, its dashes repeating along its length
    const thread = runtime.core.toon(CHAIR_STITCH);
    thread.alphaMap = dashTex.texture.clone();
    thread.alphaMap.repeat.set(Math.round(curve.getLength() / STITCH_LENGTH), 1);
    runtime.core.track(thread.alphaMap);
    thread.alphaTest = 0.5;
    return runtime.core.mesh(new THREE.TubeGeometry(curve, 480, 0.012, 4, true), thread, { outline: 0, cast: false });
  };

  // Under the cushion a black plastic pan, so the seat reads thick, and the tilt mechanism
  // under that
  const seatBase = runtime.core.mesh(runtime.core.rbox(4.1, 0.3, 3.9, 0.12), chairFrameMat, { outline: 0.04 });
  seatBase.position.y = -2.82;
  const mechanism = runtime.core.mesh(runtime.core.rbox(1.9, 0.34, 2.2, 0.08), chairFrameMat, { outline: 0.03 });
  mechanism.position.set(0, -3.1, 0.2);
  // its tilt knob and recline lever out to one side
  mechanism.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.5, 0.22, 0.5, 0.08), chairFrameMat, { outline: 0.02 }), 1.0, 0, 0.3));
  mechanism.add(runtime.core.at(runtime.core.rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.9, 0.05, 0), 0.05, chairFrameMat, 0.015), -1.6, 0, -0.4));
  // The back's proportions are traced from photos of the chair, front, side and rear: a
  // shield-shaped back about 1.6 times as tall as it is wide, its headrest the narrow top of
  // the shield. Side on, its rear is one straight line while its front swells: the headrest is
  // barely half as thick as the lower back, and the wings sweep forward round the sitter, with
  // the lumbar pushing out between them. Its front is leather, with a raised panel stitched
  // round in red; its rear is one smooth leather shell, and a single seam runs round the edge.
  const BACK_H = 85 / 12;
  const BACK_DEPTH = 0.95;
  const BACK_FOOT = -2.02;
  // Half-width up a silhouette through these [half-width, height] points, its top corners
  // rounded off
  const halfWidthAlong = (points, height, corner) => {
    const samples = new THREE.SplineCurve(points.map(([hw, y]) => new THREE.Vector2(y, hw))).getPoints(160);
    return (y) => {
      let i = 1;
      while (i < samples.length - 1 && samples[i].x < y) i++;
      const a = samples[i - 1];
      const b = samples[i];
      const raw = a.y + (b.y - a.y) * THREE.MathUtils.clamp((y - a.x) / (b.x - a.x || 1), 0, 1);
      const over = y - (height - corner);
      return over > 0 ? raw - corner + Math.sqrt(Math.max(0, corner * corner - over * over)) : raw;
    };
  };
  // A padded slab: a silhouette `halfWidth(y)` either side of `centre(y)`, `depth` thick
  // through the middle (a number, or one for each height) and rounding off to nothing at its
  // edges, as one smooth grid in front and one behind, denser toward the edges, so it bends
  // cleanly with no cracks. `bulge(x, y, side)` swells either face (front -1, rear 1) out
  // further in places, and `material(x, y, side)` picks each patch's material. uv in world
  // units.
  const pillow = (halfWidth, height, depth, { cols = 28, rows = 44, centre = () => 0, bulge = () => 0, material = () => 0 } = {}) => {
    const depthOf = typeof depth === "function" ? depth : () => depth;
    const thickness = (x, y) => {
      const edge = depthOf(y) / 2;
      const d = Math.max(0, Math.min(halfWidth(y) - Math.abs(x - centre(y)), y, height - y));
      return edge * Math.sqrt(1 - (1 - Math.min(1, d / edge)) ** 2);
    };
    // how far its surface stands out on that side
    const depthAt = (x, y, side) => thickness(x, y) + bulge(x, y, side);
    const position = [];
    const uv = [];
    const grids = [];
    for (const side of [-1, 1]) {
      const start = position.length / 3;
      for (let j = 0; j <= rows; j++) {
        const y = (height * (1 - Math.cos((Math.PI * j) / rows))) / 2;
        const hw = halfWidth(y);
        for (let i = 0; i <= cols; i++) {
          const x = centre(y) + hw * Math.sin(Math.PI * (i / cols - 0.5));
          position.push(x, y, side * depthAt(x, y, side));
          // across the rolled edge the surface runs mostly in depth, so the weave is laid by
          // distance along the surface rather than by x alone
          uv.push(x + Math.sign(x - centre(y)) * (depthOf(y) / 2 - thickness(x, y)), y);
        }
      }
      grids.push({ side, start });
    }
    // each material's patches in one run, so each is one draw
    const runs = [];
    for (const { side, start } of grids) {
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const a = start + j * (cols + 1) + i;
          const c = a + cols + 1;
          const m = material((position[a * 3] + position[(c + 1) * 3]) / 2, (position[a * 3 + 1] + position[(c + 1) * 3 + 1]) / 2, side);
          const run = runs[m] || (runs[m] = []);
          // the front grid faces -z, the rear +z
          if (side < 0) run.push(a, c, a + 1, a + 1, c, c + 1);
          else run.push(a, a + 1, c, a + 1, c + 1, c);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    const index = [];
    runs.forEach((run, m) => {
      geo.addGroup(index.length, run.length, m);
      for (const v of run) index.push(v);
    });
    geo.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(index);
    return { geo, depthAt, halfWidth, height, centre };
  };

  // The back shell. `y` here is up the back from its middle, `h` up from its foot. Its outline
  // is traced from straight-on and rear photos: a shield, its narrow rounded top under half the
  // shoulders' width, the sides curving out ever faster to the shoulders, then narrowing
  // steadily to the seat, where it's under nine tenths as wide.
  const BACK_Y = -BACK_H / 2;
  const backWidth = halfWidthAlong(
    [[1.86, 0], [1.91, 0.8], [1.97, 1.8], [2.05, 2.8], [2.11, 3.7], [2.14, 4.3], [2.08, 4.5], [1.88, 4.87], [1.65, 5.25], [1.4, 5.62], [1.2, 6.0], [1.05, 6.38], [0.89, 6.76], [0.84, BACK_H]],
    BACK_H,
    0.25,
  );
  // Full depth up to the lumbar, thinning over the shoulders to a slim headrest
  const backDepth = (h) => BACK_DEPTH - 0.45 * THREE.MathUtils.smoothstep(h, 4.2, 7.2);
  // Each height sits forward of the flat rear by however much thinner it is
  const recess = (y) => (BACK_DEPTH - backDepth(y + BACK_H / 2)) / 2;
  // The wings: the centre panel fills the headrest edge to edge, then below WING_TOP its edges
  // run down converging a little while the outline flares out to the shoulders, so each wing
  // starts as a point high on the side and widens down to the seat. Outward of the panel's
  // edge the shell sweeps forward (-z) round the sitter into a deep U, its rim reaching
  // `wingReach(h)` ahead of the shell's middle, and swells into a padded cushion, one with the
  // shell. The reach is traced from the side photo: the wing tips kick out sharply below the
  // headrest, hold steady down a waist, push out again round the lumbar, and ease back toward
  // the seat. From behind the back only narrows. The headrest, all panel, stays flat.
  const WING_TOP = 5.85;
  const PANEL_FOOT = 1.0;
  const panelEdge = (h) => (h >= WING_TOP ? backWidth(h) : PANEL_FOOT + ((backWidth(WING_TOP) - PANEL_FOOT) * h) / WING_TOP);
  const reachAlong = halfWidthAlong(
    [[0.3, 0], [0.37, 0.3], [0.62, 0.6], [1.0, 0.9], [1.16, 1.3], [1.22, 1.8], [1.09, 2.1], [0.78, 2.6], [0.62, 3.0], [0.56, 3.4], [0.64, 4.0], [0.65, 4.6], [0.45, 4.9], [0.32, 5.2], [0.22, 5.5], [0, WING_TOP], [0, BACK_H]],
    BACK_H,
    0,
  );
  const wingReach = (h) => Math.max(0, reachAlong(h));
  // how far out across its wing a point lies, 0 at the panel's edge to 1 at the rim
  const acrossWing = (x, h) => {
    const inner = panelEdge(h);
    // over the headrest the panel runs to the rim, leaving no wing
    if (backWidth(h) - inner <= 0) return 0;
    return THREE.MathUtils.clamp((Math.abs(x) - inner) / (backWidth(h) - inner), 0, 1);
  };
  const WING_SWELL = 0.22;
  const wingSwell = (x, h) => {
    const fade = THREE.MathUtils.smoothstep(backWidth(h) - panelEdge(h), 0, 0.7) * THREE.MathUtils.smoothstep(h, 0, 0.6);
    return WING_SWELL * Math.sin(Math.PI * acrossWing(x, h)) ** 0.7 * fade;
  };
  // Low down the front also swells forward at the lumbar, easing off toward the rim so the
  // smooth rear shell stays put. `z` tells front (below 0) from rear.
  const LUMBAR = 0.22;
  const lumbar = (x, y) => LUMBAR * Math.exp(-(((y + BACK_H / 2 - 1.8) / 1.1) ** 2)) * THREE.MathUtils.smoothstep(backWidth(y + BACK_H / 2) - Math.abs(x), 0, 0.9);
  const backZ = (x, y, z) => recess(y) - wingReach(y + BACK_H / 2) * acrossWing(x, y + BACK_H / 2) ** 2 - (z < 0 ? lumbar(x, y) : 0);
  // Lay a pad built round z = 0 onto the back: up by y0, forward by z0(y), then shaped
  const bent = (geo, y0, z0 = () => 0) => {
    geo.translate(0, y0, 0);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const z = pos.getZ(i) + z0(y);
      pos.setZ(i, z + backZ(pos.getX(i), y, z));
    }
    geo.computeVertexNormals();
    return geo;
  };
  // Stitching round a pillow's face, `inset` in from its edge, on its front (-1) or rear (1)
  const stitched = (pad, inset, side, y0, z0 = () => 0, bend = backZ) => {
    const run = Array.from({ length: 121 }, (_, k) => inset + ((pad.height - 2 * inset) * k) / 120);
    const edge = (y, sign) => [pad.centre(y) + sign * Math.max(0, pad.halfWidth(y) - inset), y];
    const loop = [...run.map((y) => edge(y, 1)), ...run.slice().reverse().map((y) => edge(y, -1))];
    return chairSeam(loop.map(([x, y]) => new THREE.Vector3(x, y + y0, z0(y + y0) + side * (pad.depthAt(x, y, side) + 0.015) + bend(x, y + y0, side))));
  };
  const backPad = pillow(backWidth, BACK_H, backDepth, {
    cols: 56,
    rows: 160,
    bulge: (x, h, side) => (side < 0 ? wingSwell(x, h) : 0),
  });
  const chairBack = runtime.core.mesh(bent(backPad.geo, BACK_Y), leather, { outline: 0.06 });
  chairBack.position.set(0, BACK_FOOT + BACK_H / 2, 2.6);
  // reclined back (+z) about 4 degrees, as the chair stands upright, its front still meeting
  // the seat's rear edge
  chairBack.rotation.x = 0.07;
  chairBack.add(stitched(backPad, 0.12, -1, BACK_Y), stitched(backPad, 0.12, 1, BACK_Y));
  // The raised centre panel: between the wings, then filling the headrest, sunk a little into
  // the back's front face
  const CENTRE_H = BACK_H - 0.35;
  const centrePad = pillow((h) => Math.min(panelEdge(h + 0.12) - 0.02, backWidth(h + 0.12) - 0.2), CENTRE_H, 0.24, { cols: 28, rows: 110 });
  const centreZ = (y) => -backDepth(y + BACK_H / 2) / 2 + 0.04;
  chairBack.add(runtime.core.mesh(bent(centrePad.geo, BACK_Y + 0.12, centreZ), leatherPanel, { outline: 0.03 }), stitched(centrePad, 0.1, -1, BACK_Y + 0.12, centreZ));
  // the lumbar knob on the left side, a little above the seat
  const KNOB_H = 2.6;
  const knob = runtime.core.mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.18, 20), chairFrameMat, { outline: 0.02 });
  knob.rotation.z = Math.PI / 2;
  knob.position.set(-backWidth(KNOB_H) - 0.06, KNOB_H + BACK_Y, backZ(-backWidth(KNOB_H), KNOB_H + BACK_Y, 1));
  chairBack.add(knob);

  // The seat: one thick padded cushion a touch wider than the back, its top stitched round in
  // red, with raised side bolsters running from the back to just short of the front's roll.
  // Built standing up like the back's pads, then laid flat (its rear, y = 0, toward the back),
  // the top of its padding where the cat curls up.
  const SEAT_L = 4.3;
  const SEAT_DEPTH = 1.1;
  const seatWidth = halfWidthAlong([[2.09, 0], [2.23, 2.2], [2.19, SEAT_L]], SEAT_L, 0.7);
  const SEAT_BOLSTER = 0.14;
  const seatBolster = (x, y) =>
    SEAT_BOLSTER *
    THREE.MathUtils.smoothstep(Math.abs(x), 1.87, 2.08) *
    THREE.MathUtils.smoothstep(seatWidth(y) - Math.abs(x), 0, 0.5) *
    (1 - THREE.MathUtils.smoothstep(y, SEAT_L - 1.2, SEAT_L - 0.4));
  const seatPad = pillow(seatWidth, SEAT_L, SEAT_DEPTH, {
    cols: 40,
    rows: 48,
    bulge: (x, y, side) => (side > 0 ? seatBolster(x, y) : 0),
  });
  seatPad.geo.translate(0, -SEAT_L / 2, 0);
  seatPad.geo.computeVertexNormals();
  const chairSeat = new THREE.Group();
  chairSeat.rotation.x = -Math.PI / 2;
  chairSeat.position.y = -1.77 - SEAT_DEPTH / 2;
  chairSeat.add(runtime.core.mesh(seatPad.geo, leather, { outline: 0.06 }), stitched(seatPad, 0.2, 1, -SEAT_L / 2, () => 0, () => 0));
  // Gold: a small badge high on the headrest, front and back
  const crestTex = canvasTexture(128, 128);
  runtime.core.track(crestTex.texture);
  drawChairCrest(crestTex.ctx, 128, 128);
  const crestMat = runtime.core.printMaterial(crestTex.texture, { transparent: true });
  const CREST_Y = BACK_H / 2 - 0.85;
  const crestFront = centreZ(CREST_Y) - 0.12 - 0.04 + backZ(0, CREST_Y, -1);
  [[0.55, CREST_Y, crestFront, Math.PI], [0.6, BACK_H / 2 - 0.95, BACK_DEPTH / 2 + 0.03, 0]].forEach(([size, y, z, turn]) => {
    const crest = new THREE.Mesh(runtime.core.track(new THREE.PlaneGeometry(size, size)), crestMat);
    crest.position.set(0, y, z);
    crest.rotation.y = turn;
    crest.raycast = runtime.core.noRaycast;
    chairBack.add(crest);
  });

  const CHAIR_SCALE = 1.2;
  const SEAT_TOP = runtime.room.FLOOR_Y + 5.2;
  const UPHOLSTERY_Y = SEAT_TOP + 1.77 * CHAIR_SCALE;
  // Calibrate the upholstered parts independently to the official Regular dimensions.
  chairSeat.children[0].geometry.computeBoundingBox();
  const seatSize = chairSeat.children[0].geometry.boundingBox.getSize(new THREE.Vector3());
  chairSeat.scale.set(5.6 / (seatSize.x * CHAIR_SCALE), 4.9 / (seatSize.y * CHAIR_SCALE), 1);
  const backSize = new THREE.Box3().setFromObject(chairBack, true).getSize(new THREE.Vector3());
  chairBack.scale.x = 5.3 / (backSize.x * CHAIR_SCALE);
  // Join the floor-mounted base to the underside of the resized tilt mechanism.
  const postBottom = CHAIR_FLOOR + 0.62;
  const postTop = UPHOLSTERY_Y - 2.3 * CHAIR_SCALE;
  const chairPost = runtime.core.mesh(new THREE.CylinderGeometry(0.32, 0.36, postTop - postBottom, 20), chairFrameMat, { outline: 0.03 });
  chairPost.position.y = (postBottom + postTop) / 2;
  // The gas lift overlaps the post and the tilt mechanism.
  const gasLift = runtime.core.mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.7, 16), runtime.core.toon("#3a3735"), { outline: 0.015 });
  gasLift.position.y = postTop;
  // The back's bracket: an L under the seat that rises up inside the seat's rear edge, under the
  // back, so none of it pokes through the cushion or shows on the back's rear face
  const backPost = new THREE.Group();
  backPost.add(
    runtime.core.rod(new THREE.Vector3(0, -2.38, 1.1), new THREE.Vector3(0, -2.38, 2.12), 0.14, chairFrameMat, 0.03),
    runtime.core.rod(new THREE.Vector3(0, -2.38, 2.12), new THREE.Vector3(0, -1.88, 2.12), 0.14, chairFrameMat, 0.03),
  );
  // Seat, back and armrests share one uniform scale; offset the upholstery so the
  // cushion stays 52 cm above the floor without changing the spin/sink animation origin.
  const chairTop = new THREE.Group();
  const upholstery = new THREE.Group();
  upholstery.scale.setScalar(CHAIR_SCALE);
  upholstery.position.y = UPHOLSTERY_Y;
  upholstery.add(chairSeat, seatBase, mechanism, chairBack, backPost);
  chairTop.add(upholstery);
  chair.add(chairTop, chairPost, gasLift);
  // A five-star base of flat legs sloping down to the casters, each caster a twin wheel under
  // a hood
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const leg = new THREE.Group();
    leg.rotation.y = -angle;
    const bar = runtime.core.mesh(runtime.core.rbox(3.35, 0.2, 0.36, 0.07), chairFrameMat, { outline: 0.025 });
    bar.position.set(1.675, CHAIR_FLOOR + 0.58, 0);
    bar.rotation.z = -0.08;
    const hood = runtime.core.mesh(runtime.core.rbox(0.36, 0.2, 0.42, 0.08), chairFrameMat, { outline: 0.02 });
    hood.position.set(3.3, CHAIR_FLOOR + 0.4, 0);
    leg.add(bar, hood);
    [-0.1, 0.1].forEach((z) => {
      const wheel = runtime.core.mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 16), runtime.core.toon("#2b2827"), { outline: 0.015 });
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(3.3, CHAIR_FLOOR + 0.2, z * 1.8);
      leg.add(wheel);
    });
    chair.add(leg);
  }
  chair.add(runtime.core.at(runtime.core.mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.3, 20), chairFrameMat, { outline: 0.02 }), 0, CHAIR_FLOOR + 0.62, 0));
  // 4D armrests: a bracket out from under the seat, a tall slim stem and a flat padded top
  // As the side view has them: a long flat pad well above the seat, on a thick stem that runs
  // down past the seat's underside before turning in beneath it
  for (const x of [-2.6, 2.6]) {
    const bracket = runtime.core.mesh(runtime.core.rbox(1.7, 0.2, 0.5, 0.06), chairFrameMat, { outline: 0.02 });
    bracket.position.set(x * 0.72, -3.05, 0.6);
    const stem = runtime.core.mesh(runtime.core.rbox(0.3, 2.75, 0.46, 0.1), chairFrameMat, { outline: 0.03 });
    stem.position.set(x, -1.85, 0.6);
    const pad = runtime.core.mesh(runtime.core.rbox(0.6, 0.24, 2.7, 0.1), leatherBox, { outline: 0.03 });
    pad.position.set(x, -0.42, 0.4);
    upholstery.add(bracket, stem, pad);
  }
  // The recline hub either side where the back meets the seat: a round cap, a bracket rising
  // from it up the back's side and another running forward under the seat. The cap stands just
  // outside the cushion's side (5.6 wide once scaled), so the seat never swallows it.
  const HUB_X = 5.6 / CHAIR_SCALE / 2 + 0.16;
  for (const side of [-1, 1]) {
    const hub = runtime.core.mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.26, 28), chairFrameMat, { outline: 0.025 });
    hub.rotation.z = Math.PI / 2;
    hub.position.set(side * HUB_X, -2.45, 1.9);
    const upright = runtime.core.mesh(runtime.core.rbox(0.16, 2.1, 0.75, 0.06), chairFrameMat, { outline: 0.02 });
    upright.position.set(side * (HUB_X - 0.2), -1.35, 2.3);
    upright.rotation.x = 0.07;
    const runner = runtime.core.mesh(runtime.core.rbox(0.16, 0.45, 1.8, 0.06), chairFrameMat, { outline: 0.02 });
    runner.position.set(side * (HUB_X - 0.05), -2.75, 1.0);
    runner.rotation.x = 0.12;
    upholstery.add(hub, upright, runner);
  }
  // Click it for a spin: the gas lift sinks with a hiss and springs back, the seat whirls round
  // on its post and the whole chair rolls back a little on its casters and back again
  let chairBusy = false;
  // Dragged sideways, the seat turns on its post with the hand, and let go it carries on
  // spinning with the hand's speed, slowing to a stop. It keeps whatever way it ends up facing.
  const CHAIR_TURN_PER_PX = 0.012;
  function rollOut(duration = 0.35) {
    gsap.to(chair.position, { z: SPIN_Z, duration, ease: "power2.out", overwrite: true });
  }
  function rollIn(delay = 0) {
    // Back to its resting angle the short way round, so the back never swings into the top
    const facing = Math.round(chairTop.rotation.y / (Math.PI * 2)) * Math.PI * 2;
    gsap.to(chairTop.rotation, { y: facing, duration: 0.5, delay, ease: "power2.inOut", overwrite: true });
    gsap.to(chair.position, { z: REST_Z, duration: 0.8, delay: delay + 0.3, ease: "power2.inOut", overwrite: true });
  }
  function grabChair(drag) {
    gsap.killTweensOf(chairTop.rotation);
    rollOut();
    Object.assign(drag, { turned: 0, speed: 0, lastX: drag.startX, lastTime: performance.now(), lastSound: 0 });
  }
  function turnChair(drag, x, time) {
    const turn = (x - drag.lastX) * CHAIR_TURN_PER_PX;
    const dt = Math.max(1, time - drag.lastTime);
    // radians a millisecond, smoothed so one jittery event doesn't fling it
    drag.speed = drag.speed * 0.6 + (turn / dt) * 0.4;
    drag.lastX = x;
    drag.lastTime = time;
    drag.turned += turn;
    chairTop.rotation.y += turn;
    if (Math.abs(turn) > 0.02 && time - drag.lastSound > 260) {
      sfx.creak();
      drag.lastSound = time;
    }
  }
  function releaseChair(drag) {
    // a hand that stopped before letting go leaves it still
    const speed = performance.now() - drag.lastTime > 90 ? 0 : THREE.MathUtils.clamp(drag.speed, -0.03, 0.03);
    const coast = speed * 500;
    if (Math.abs(drag.turned + coast) > Math.PI) runtime.secrets.discover("chair");
    if (Math.abs(coast) < 0.02) return rollIn(0.2);
    const duration = 0.6 + Math.abs(speed) * 60;
    gsap.to(chairTop.rotation, { y: chairTop.rotation.y + coast, duration, ease: "power3.out", onComplete: () => rollIn(0.15) });
    if (Math.abs(coast) > 1.5) sfx.patter({ duration: 0.4 });
  }
  runtime.core.register(chair, {
    grabTurn: true,
    onHover: (on) => {
      if (!on || chairBusy || gsap.isTweening(chairTop.rotation)) return;
      const y = chairTop.rotation.y;
      gsap.fromTo(chairTop.rotation, { y: y + 0.08 }, { y, duration: 0.9, ease: "elastic.out(1, 0.3)" });
      hoverSound(chair, (s) => s.creak());
    },
    onClick: () => {
      if (chairBusy) return;
      chairBusy = true;
      runtime.secrets.discover("chair");
      gsap.killTweensOf([chairTop.rotation, chair.position]);
      const y = Math.round(chairTop.rotation.y / (Math.PI * 2)) * Math.PI * 2;
      // Out from under the desk first, then the sink and the spin, then back in
      gsap.timeline({ onComplete: () => (chairBusy = false) })
        .to(chair.position, { z: SPIN_Z + 0.5, duration: 0.4, ease: "power2.out" })
        .to(chairTop.position, { y: -0.35, duration: 0.18, ease: "power2.in" }, 0.3)
        .to(chairTop.position, { y: 0, duration: 0.7, ease: "elastic.out(1.1, 0.35)" }, 0.48)
        .fromTo(chairTop.rotation, { y }, { y: y + Math.PI * 2, duration: 1.5, ease: "power3.out" }, 0.42)
        .to(chair.position, { z: REST_Z, duration: 0.9, ease: "power2.inOut" }, 1.75);
      sfx.hiss();
      sfx.creak({ delay: 0.15 });
      sfx.patter({ duration: 0.5, delay: 0.1 });
    },
  });

  // Public state used by the other scene parts.
  return {
    chair,
    chairTop,
    setChairFinish,
    SEAT_TOP,
    REST_Z,
    SPIN_Z,
    grabChair,
    turnChair,
    releaseChair,
    get chairBusy() { return chairBusy; },
  };
}
