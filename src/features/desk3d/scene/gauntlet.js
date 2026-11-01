import * as THREE from "three";
import gsap from "gsap";
import { hoverSound, sfx } from "@/shared/composables/useSfx";
import { canvasTexture, BUBBLE_TAILS, drawBrushedMetal } from "../textures";

export function createGauntlet(runtime) {
  // ---------- the Infinity Gauntlet, on the left of the shelf's top ----------
  // Enlarged by 35%, under the sword rack, with the Switch on its stand to its right.
  const GAUNTLET_X = -0.65;
  const gauntlet = new THREE.Group();
  gauntlet.position.set(GAUNTLET_X, runtime.shelf.standOn(3), 0.05);
  gauntlet.scale.setScalar(1.35);
  gauntlet.rotation.y = 0.15;
  runtime.shelf.shelf.add(gauntlet);
  // Warm antique gold with three toon bands and short, soft transitions between them.
  const glove = runtime.core.toon("#c0923e");
  const gloveDark = runtime.core.toon("#68451e");
  const gloveLight = runtime.core.toon("#edc56e");
  const armourGradient = runtime.core.track(new THREE.DataTexture(Uint8Array.from({ length: 128 }, (_, i) => {
    const t = i / 127;
    return Math.round(70 + 90 * THREE.MathUtils.smoothstep(t, 0.29, 0.38) + 95 * THREE.MathUtils.smoothstep(t, 0.62, 0.71));
  }), 128, 1, THREE.RedFormat));
  armourGradient.minFilter = armourGradient.magFilter = THREE.LinearFilter;
  armourGradient.needsUpdate = true;
  const gauntletMetal = canvasTexture(256, 256);
  runtime.core.track(gauntletMetal.texture);
  drawBrushedMetal(gauntletMetal.ctx, 256, 256);
  // Fine tooling marks and aged speckles, rather than a perfectly uniform gold coating.
  let metalSeed = 7129;
  const metalRand = () => ((metalSeed = metalSeed * 16807 % 2147483647) / 2147483647);
  for (let i = 0; i < 180; i++) {
    gauntletMetal.ctx.fillStyle = i % 3 ? "rgba(55,35,12,.12)" : "rgba(255,244,205,.2)";
    gauntletMetal.ctx.fillRect(metalRand() * 256, metalRand() * 256, 1 + metalRand() * 8, 0.7);
  }
  // A near-white grain map preserves the gold albedo instead of multiplying it by grey.
  gauntletMetal.ctx.fillStyle = "rgba(245,245,245,.85)";
  gauntletMetal.ctx.fillRect(0, 0, 256, 256);
  // Soft brown tarnish pooled here and there, like the worn bronze in its recesses
  for (let i = 0; i < 16; i++) {
    const x = metalRand() * 256;
    const y = metalRand() * 256;
    const r = 18 + metalRand() * 40;
    const tarnish = gauntletMetal.ctx.createRadialGradient(x, y, 0, x, y, r);
    tarnish.addColorStop(0, "rgba(62,45,29,.22)");
    tarnish.addColorStop(1, "rgba(92,52,14,0)");
    gauntletMetal.ctx.fillStyle = tarnish;
    gauntletMetal.ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Extruded plates use shape-unit UVs, crossing x=0 and y=1 on the hand.
  // Mirror the non-periodic tarnish at tile edges to avoid straight colour seams there.
  gauntletMetal.texture.wrapS = gauntletMetal.texture.wrapT = THREE.MirroredRepeatWrapping;
  gauntletMetal.texture.repeat.set(1, 1);
  [glove, gloveDark, gloveLight].forEach((material) => {
    material.map = gauntletMetal.texture;
    material.gradientMap = armourGradient;
  });
  // Two square charcoal steps, with a clean front and no plaque.
  const plinthMat = runtime.core.toon("#202124");
  gauntlet.add(
    runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.85, 0.09, 0.65, 0.008), plinthMat, { outline: 0.008 }), 0, 0.045, 0),
    runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.7, 0.11, 0.54, 0.005), plinthMat, { outline: 0.004 }), 0, 0.145, 0),
  );
  // Everything above the plinth: it floats up off the stand for the snap
  const glovePart = new THREE.Group();
  glovePart.scale.x = 0.94;
  gauntlet.add(glovePart);
  // The reference's flared cuff narrows into an articulated wrist.
  const cuffProfile = [[0, 0.2], [0.31, 0.2], [0.335, 0.24], [0.31, 0.31],
    [0.275, 0.53], [0.235, 0.75], [0.245, 0.8], [0, 0.8]].map(([r, y]) => new THREE.Vector2(r, y));
  const forearm = runtime.core.mesh(new THREE.LatheGeometry(cuffProfile, 40), glove, { outline: 0.012 });
  forearm.scale.z = 0.8;
  glovePart.add(forearm);
  [[0.235, 0.335]].forEach(([y, r]) => {
    const band = runtime.core.mesh(new THREE.CylinderGeometry(r + 0.008, r + 0.008, 0.022, 40), gloveDark, { outline: 0.006 });
    band.position.y = y;
    band.scale.z = 0.8;
    glovePart.add(band);
  });
  const engrave = (points, material = gloveDark, radius = 0.004, parent = glovePart) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const line = runtime.core.mesh(new THREE.TubeGeometry(curve, points.length * 4, radius, 5, false), material, { outline: 0, cast: false });
    parent.add(line);
    return line;
  };
  // Curve thin armour over its supporting shell; the front is never a flat applique.
  const curvedPlate = (shape, material, surface, depth = 0.012, outline = 0) => {
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.002, bevelSegments: 2, curveSegments: 20, steps: 1 });
    // Extrusion triangulates large faces with no interior vertices. Split long triangles before
    // wrapping them, otherwise a diagonal spans the bend and buries the stone and relief.
    const positions = [];
    const uvs = [];
    const normals = [];
    const input = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const normal = geometry.attributes.normal;
    const split = (a, b, c) => {
      const edges = [[a, b, c], [b, c, a], [c, a, b]];
      edges.sort((e, f) => Math.hypot(f[0][0] - f[1][0], f[0][1] - f[1][1]) - Math.hypot(e[0][0] - e[1][0], e[0][1] - e[1][1]));
      const [v0, v1, opposite] = edges[0];
      if (Math.hypot(v0[0] - v1[0], v0[1] - v1[1]) > 0.045) {
        const mid = v0.map((n, i) => (n + v1[i]) / 2);
        split(v0, mid, opposite);
        split(mid, v1, opposite);
      } else {
        [a, b, c].forEach((v) => {
          positions.push(...v.slice(0, 3));
          uvs.push(...v.slice(3, 5));
          normals.push(...v.slice(5));
        });
      }
    };
    for (let i = 0; i < input.count; i += 3) {
      const point = (j) => [input.getX(j), input.getY(j), input.getZ(j), uv.getX(j), uv.getY(j), normal.getX(j), normal.getY(j), normal.getZ(j)];
      split(point(i), point(i + 1), point(i + 2));
    }
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.clearGroups();
    const vertices = geometry.attributes.position;
    const wrappedNormals = geometry.attributes.normal;
    const n = new THREE.Vector3();
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), y = vertices.getY(i);
      vertices.setZ(i, vertices.getZ(i) + surface(x, y));
      // Transform the original extrusion normals by the wrap's inverse transpose.
      // Recomputing per triangle would turn the polished front into a faceted mosaic.
      const dx = (surface(x + 0.0001, y) - surface(x - 0.0001, y)) / 0.0002;
      const dy = (surface(x, y + 0.0001) - surface(x, y - 0.0001)) / 0.0002;
      n.fromBufferAttribute(wrappedNormals, i);
      n.set(n.x - dx * n.z, n.y - dy * n.z, n.z).normalize();
      wrappedNormals.setXYZ(i, n.x, n.y, n.z);
    }
    const piece = runtime.core.mesh(geometry, material, { outline });
    glovePart.add(piece);
    return piece;
  };
  const cuffFront = (x, y) => 0.285 - (y - 0.2) * 0.14 - x * x;
  // Long inset escutcheon: narrow at the wrist, broad stepped corners at the cuff's hem.
  const shield = new THREE.Shape();
  shield.moveTo(0, 0.79);
  shield.lineTo(0.105, 0.68);
  shield.lineTo(0.18, 0.31);
  shield.lineTo(0.15, 0.265);
  shield.lineTo(0.07, 0.265);
  shield.lineTo(0.035, 0.245);
  shield.lineTo(0, 0.258);
  shield.lineTo(-0.035, 0.245);
  shield.lineTo(-0.07, 0.265);
  shield.lineTo(-0.15, 0.265);
  shield.lineTo(-0.18, 0.31);
  shield.lineTo(-0.105, 0.68);
  shield.closePath();
  curvedPlate(shield, gloveDark, cuffFront);
  const shieldTrim = [[0, 0.77], [0.09, 0.675], [0.16, 0.313], [0.143, 0.287], [0.065, 0.287], [0.033, 0.267], [0, 0.279], [-0.033, 0.267], [-0.065, 0.287], [-0.143, 0.287], [-0.16, 0.313], [-0.09, 0.675], [0, 0.77]];
  engrave(shieldTrim.map(([x, y]) => [x, y, cuffFront(x, y) + 0.019]), gloveLight, 0.0028);
  const inlay = new THREE.Shape();
  inlay.moveTo(0, 0.735);
  inlay.lineTo(0.064, 0.66);
  inlay.lineTo(0.095, 0.33);
  inlay.quadraticCurveTo(0, 0.3, -0.095, 0.33);
  inlay.lineTo(-0.064, 0.66);
  inlay.closePath();
  curvedPlate(inlay, glove, (x, y) => cuffFront(x, y) + 0.016, 0.008, 0);
  const innerTrim = [[0, 0.716], [0.05, 0.655], [0.092, 0.343], [0, 0.326], [-0.092, 0.343], [-0.05, 0.655], [0, 0.716]];
  engrave(innerTrim.map(([x, y]) => [x, y, cuffFront(x, y) + 0.03]), gloveLight, 0.003);
  const reliefLine = (points, surface = cuffFront, material = gloveLight, radius = 0.0038) => {
    const vertices = points.map(([x, y]) => new THREE.Vector3(x, y, surface(x, y) + 0.034));
    const path = new THREE.CurvePath();
    for (let i = 1; i < vertices.length; i++) path.add(new THREE.LineCurve3(vertices[i - 1], vertices[i]));
    glovePart.add(runtime.core.mesh(new THREE.TubeGeometry(path, points.length * 6, radius * 1.6, 4, false), gloveDark, { outline: 0, cast: false }));
    const highlight = new THREE.CurvePath();
    vertices.forEach((v) => { v.z += 0.004; });
    for (let i = 1; i < vertices.length; i++) highlight.add(new THREE.LineCurve3(vertices[i - 1], vertices[i]));
    glovePart.add(runtime.core.mesh(new THREE.TubeGeometry(highlight, points.length * 6, radius, 4, false), material, { outline: 0, cast: false }));
  };
  // Paired angular glyphs with a dark central split, rather than a continuous fern.
  for (let i = 0; i < 8; i++) {
    const y = 0.35 + i * 0.037;
    const width = 0.061 - i * 0.003;
    [-1, 1].forEach((side) => {
      reliefLine([[side * 0.007, y - 0.014], [side * 0.007, y + 0.005],
        [side * width, y + 0.029], [side * width, y + 0.045]], cuffFront, gloveLight, 0.003);
    });
  }
  reliefLine([[-0.028, 0.685], [0, 0.654], [0.028, 0.685]], cuffFront, gloveLight, 0.003);
  // A long inverted spear descends from the wrist arch into the top of the inscription.
  const spear = new THREE.Shape();
  spear.moveTo(-0.035, 0.8);
  spear.lineTo(0.035, 0.8);
  spear.lineTo(0, 0.678);
  spear.closePath();
  curvedPlate(spear, glove, (x, y) => cuffFront(x, y) + 0.026, 0.008, 0);
  reliefLine([[-0.035, 0.79], [0, 0.678], [0.035, 0.79]], cuffFront, gloveLight, 0.003);
  // Broad raised flank panels bend into the cuff; their chased edges run to stepped corners.
  [-1, 1].forEach((side) => {
    const rib = new THREE.Shape();
    const points = [[0.104, 0.735], [0.145, 0.745], [0.17, 0.66], [0.204, 0.42],
      [0.237, 0.31], [0.193, 0.278], [0.155, 0.32], [0.13, 0.53]];
    points.forEach(([x, y], i) => i ? rib.lineTo(side * x, y) : rib.moveTo(side * x, y));
    rib.closePath();
    curvedPlate(rib, glove, (x, y) => cuffFront(x, y) + 0.012, 0.01, 0);
    engrave(points.concat([points[0]]).map(([x, y]) => [side * x, y, cuffFront(side * x, y) + 0.026]), gloveLight, 0.0025);
  });
  const rivetGeo = runtime.core.track(new THREE.SphereGeometry(0.012, 10, 8));
  [-1, 1].forEach((side) => {
    // Corner fasteners, not a row of large studs down the face of the cuff.
    [[0.083, 0.34], [0.17, 0.296], [0.068, 0.697]].forEach(([x, y]) => {
      const bead = new THREE.Mesh(rivetGeo, gloveLight);
      bead.scale.set(0.48, 0.48, 0.3);
      bead.position.set(side * x, y, cuffFront(side * x, y) + 0.038);
      glovePart.add(bead);
    });
    // A narrow embossed side seam remains visible in the three-quarter view.
    for (let i = 0; i < 30; i++) {
      const y = 0.29 + i * 0.015;
      const r = THREE.MathUtils.lerp(0.312, 0.24, (y - 0.29) / 0.46) + 0.003;
      const bead = new THREE.Mesh(rivetGeo, gloveLight);
      bead.scale.setScalar(0.2);
      bead.position.set(side * Math.sin(1.18) * r, y, Math.cos(1.18) * r * 0.8);
      glovePart.add(bead);
    }
  });
  // Narrow embossed side panels wrap round the elliptical cuff, as in the side reference.
  [-1, 1].forEach((side) => {
    const wrap = new THREE.Group();
    wrap.scale.z = 0.8;
    const panel = new THREE.Group();
    panel.rotation.y = side * 1.22;
    wrap.add(panel);
    glovePart.add(wrap);
    const sideFront = (x, y) => 0.326 - (y - 0.29) * 0.17 - x * x;
    const shape = new THREE.Shape();
    const border = [[-0.036, 0.31], [0.036, 0.31], [0.031, 0.7], [0, 0.727], [-0.031, 0.7], [-0.036, 0.31]];
    border.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
    shape.closePath();
    panel.add(curvedPlate(shape, gloveDark, sideFront, 0.006, 0));
    engrave(border.map(([x, y]) => [x, y, sideFront(x, y) + 0.01]), gloveLight, 0.002, panel);
    for (let i = 0; i < 9; i++) {
      const y = 0.33 + i * 0.039;
      const points = [[-0.023, y + 0.029], [0, y + 0.015], [0.023, y + 0.029], [0, y], [-0.023, y + 0.029]];
      engrave(points.map(([x, yy]) => [x, yy, sideFront(x, yy) + 0.011]), gloveLight, 0.002, panel);
    }
  });
  // A second, finer hem ring above the cuff's base band
  const hem = runtime.core.mesh(new THREE.CylinderGeometry(0.334, 0.334, 0.012, 40), gloveLight, { outline: 0.004 });
  hem.position.y = 0.262;
  hem.scale.z = 0.8;
  glovePart.add(hem);
  // A twisted rope trim round the cuff's bottom edge
  const ropeTrim = runtime.core.mesh(new THREE.TorusGeometry(0.318, 0.011, 6, 64), gloveLight, { outline: 0.004 });
  ropeTrim.rotation.x = Math.PI / 2;
  ropeTrim.position.y = 0.207;
  ropeTrim.scale.y = 0.8;
  glovePart.add(ropeTrim);
  for (let i = 0; i < 48; i++) {
    const angle = i * Math.PI / 24;
    glovePart.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.006, 0.026, 0.006, 0.002), gloveDark, { outline: 0, cast: false }),
      Math.sin(angle) * 0.33, 0.207, Math.cos(angle) * 0.33 * 0.8, 0.6));
  }
  // Three separate overlapping lames leave real dark gaps, arching over the cuff.
  const wristFront = (x) => 0.18 - x * x * 1.2;
  const wristLames = [];
  const fan = new THREE.Shape();
  for (let i = 0; i < 3; i++) {
    const top = 0.936 - i * 0.047;
    const arch = i ? new THREE.Shape() : fan;
    arch.moveTo(-0.25, top - 0.105);
    arch.quadraticCurveTo(-0.14, top - 0.01, 0, top);
    arch.quadraticCurveTo(0.14, top - 0.01, 0.25, top - 0.105);
    arch.lineTo(0.236, top - 0.161);
    arch.quadraticCurveTo(0.12, top - 0.065, 0, top - 0.055);
    arch.quadraticCurveTo(-0.12, top - 0.065, -0.236, top - 0.161);
    arch.closePath();
    const surface = (x) => wristFront(x) + (2 - i) * 0.008;
    wristLames.push(curvedPlate(arch, glove, surface, 0.012, 0));
    const edge = [-1, -0.75, -0.4, 0, 0.4, 0.75, 1].map((t) => {
      const x = t * 0.236;
      return [x, top - 0.055 - Math.pow(Math.abs(t), 1.6) * 0.106, surface(x) + 0.016];
    });
    engrave(edge, gloveLight, 0.0028);
  }
  // Pointed side guards attach below the hand skirt and overlap the lower cuff panels.
  const wristWings = [];
  [-1, 1].forEach((side) => {
    const shape = new THREE.Shape();
    const points = [[0.224, 0.852], [0.271, 0.842], [0.268, 0.754], [0.287, 0.738],
      [0.242, 0.618], [0.181, 0.704], [0.203, 0.719], [0.215, 0.796]];
    points.forEach(([x, y], i) => i ? shape.lineTo(side * x, y) : shape.moveTo(side * x, y));
    shape.closePath();
    const surface = (x) => wristFront(x) + 0.035;
    wristWings.push(curvedPlate(shape, glove, surface, 0.016, 0.003));
    engrave(points.concat([points[0]]).map(([x, y]) => [side * x, y, surface(side * x) + 0.022]), gloveLight, 0.003);
    const screw = new THREE.Mesh(rivetGeo, gloveLight);
    screw.scale.setScalar(0.55);
    screw.position.set(side * 0.246, 0.819, surface(0.246) + 0.026);
    glovePart.add(screw);
  });
  // The tapered centre strip carries seven nested teardrops, each with a small boss.
  const strip = new THREE.Shape();
  strip.moveTo(-0.025, 0.955);
  strip.lineTo(0.025, 0.955);
  strip.lineTo(0.015, 0.779);
  strip.lineTo(-0.015, 0.779);
  strip.closePath();
  curvedPlate(strip, gloveDark, () => 0.253, 0.007, 0);
  engrave([[-0.025, 0.95, 0.267], [-0.015, 0.779, 0.267], [0.015, 0.779, 0.267], [0.025, 0.95, 0.267]], gloveLight, 0.0025);
  for (let i = 0; i < 7; i++) {
    const y = 0.8 + i * 0.021;
    const size = 0.006 + i * 0.0008;
    engrave([[-size, y - 0.006, 0.267], [-size, y + 0.003, 0.267], [0, y + 0.013, 0.267],
      [size, y + 0.003, 0.267], [size, y - 0.006, 0.267]], gloveLight, 0.0018);
    const stud = new THREE.Mesh(rivetGeo, gloveLight);
    stud.scale.setScalar(0.17);
    stud.position.set(0, y + 0.002, 0.269);
    glovePart.add(stud);
  }
  // Wrist, the back of the hand, and the knuckle bar
  const wrist = runtime.core.mesh(new THREE.CylinderGeometry(0.225, 0.25, 0.18, 32), glove, { outline: 0.004 });
  wrist.position.y = 0.84;
  wrist.scale.z = 0.8;
  const palm = runtime.core.mesh(runtime.core.rbox(0.49, 0.46, 0.28, 0.07), glove, { outline: 0.007 });
  palm.position.y = 1.105;
  glovePart.add(wrist, palm);
  // One continuous hand shell: scalloped knuckles, curved sides and a flared skirt with
  // a rectangular centre notch. The skirt belongs to the hand, above the separate wrist fan.
  const handFront = (x, y) => 0.163 + 0.075 * Math.pow(Math.max(0, (1.16 - y) / 0.28), 2) - x * x * 0.9;
  const handPlate = new THREE.Shape();
  handPlate.moveTo(-0.253, 1.315);
  for (let i = 0; i < 4; i++) {
    const x = -0.18 + i * 0.12;
    handPlate.quadraticCurveTo(x - 0.04, 1.39, x, 1.385);
    handPlate.quadraticCurveTo(x + 0.04, 1.39, x + 0.06, 1.325);
  }
  handPlate.quadraticCurveTo(0.25, 1.31, 0.255, 1.22);
  handPlate.quadraticCurveTo(0.246, 1.04, 0.29, 0.902);
  handPlate.quadraticCurveTo(0.205, 0.87, 0.061, 0.879);
  handPlate.lineTo(0.046, 0.957);
  handPlate.lineTo(-0.046, 0.957);
  handPlate.lineTo(-0.061, 0.879);
  handPlate.quadraticCurveTo(-0.205, 0.87, -0.29, 0.902);
  handPlate.quadraticCurveTo(-0.246, 1.04, -0.255, 1.22);
  handPlate.closePath();
  curvedPlate(handPlate, glove, handFront, 0.016, 0.004);
  const handRim = [[-0.25, 1.3], [-0.246, 1.15], [-0.254, 1.0], [-0.276, 0.909], [-0.2, 0.892], [-0.073, 0.893], [-0.058, 0.97], [0.058, 0.97], [0.073, 0.893], [0.2, 0.892], [0.276, 0.909], [0.254, 1.0], [0.246, 1.15], [0.25, 1.3]];
  engrave(handRim.map(([x, y]) => [x, y, handFront(x, y) + 0.022]), gloveLight, 0.0035);
  const band = (points, material = gloveLight, radius = 0.0035) => reliefLine(points.map(([x, y]) => [x, y + 0.04]), handFront, material, radius);
  // Narrow raised polygonal brackets frame the oval, including the upper spear-shaped pair.
  [-1, 1].forEach((side) => {
    band([[side * 0.088, 1.174], [side * 0.108, 1.217], [side * 0.128, 1.19], [side * 0.136, 1.153], [side * 0.1, 1.158]], gloveLight, 0.0025);
    band([[side * 0.108, 1.085], [side * 0.171, 1.078], [side * 0.185, 1.057], [side * 0.112, 1.05]], gloveLight, 0.003);
    band([[side * 0.114, 1.041], [side * 0.174, 1.031], [side * 0.149, 1.002], [side * 0.191, 0.984], [side * 0.164, 0.96], [side * 0.11, 0.988], [side * 0.09, 0.964], [side * 0.068, 0.985]], gloveLight, 0.003);
    band([[side * 0.128, 1.021], [side * 0.148, 1.015], [side * 0.127, 0.998]], gloveDark, 0.0025);
  });
  const mindSurround = runtime.core.mesh(new THREE.TorusGeometry(0.111, 0.008, 6, 48), gloveDark, { outline: 0 });
  mindSurround.scale.y = 1.12;
  mindSurround.position.set(0, 1.14, 0.19);
  glovePart.add(mindSurround);
  // A ring of beads round the centre setting
  for (let i = 0; i < 24; i++) {
    const angle = i * Math.PI / 12;
    const bead = new THREE.Mesh(rivetGeo, gloveLight);
    bead.scale.set(0.3, 0.4, 0.2);
    bead.position.set(Math.sin(angle) * 0.111, 1.14 + Math.cos(angle) * 0.124, 0.2);
    glovePart.add(bead);
  }
  // An outer chased ring of short radial bars surrounds the fine beaded bezel.
  for (let i = 0; i < 28; i++) {
    const angle = i * Math.PI / 14;
    const x = Math.sin(angle) * 0.12;
    const y = 1.14 + Math.cos(angle) * 0.137;
    glovePart.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.003, 0.008, 0.003, 0.001), gloveLight, { outline: 0, cast: false }), x * 0.95, 1.14 + (y - 1.14) * 0.95, handFront(x, y) + 0.024, -angle));
  }
  // A short ribbed upright joins the centre setting to the knuckle bar
  const stoneNeck = runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.027, 0.045, 0.02, 0.006), glove, { outline: 0 }), 0, 1.285, 0.19);
  glovePart.add(stoneNeck);
  for (let i = 0; i < 4; i++) stoneNeck.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.021, 0.003, 0.005, 0.001), gloveDark, { outline: 0, cast: false }), 0, -0.015 + i * 0.01, 0.011));
  // A single domed rivet under the centre setting
  const mindRivet = new THREE.Mesh(rivetGeo, gloveLight);
  mindRivet.scale.setScalar(1.6);
  mindRivet.position.set(0, 1.01, 0.205);
  glovePart.add(mindRivet);
  // An armoured finger segment: a gold capsule whose round ends overlap its neighbours', so a
  // bent finger stays in one piece, with a dark plate ring around the joint at its base
  const fingerSegment = (radius, length, ring = true) => {
    const part = new THREE.Group();
    const body = runtime.core.mesh(new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius), 6, 20), glove, { outline: 0.004 });
    body.scale.z = 0.88;
    body.position.y = length / 2;
    part.add(body);
    // A long open slot down the segment, crossed by slanted rungs
    const slot = Math.max(0.005, length * 0.72 - radius * 0.3);
    const channel = runtime.core.mesh(new THREE.CapsuleGeometry(radius * 0.29, slot, 4, 12), gloveDark, { outline: 0 });
    channel.scale.z = 0.2;
    channel.position.set(0, length * 0.55, radius * 0.89);
    part.add(channel);
    const rungs = Math.max(3, Math.round(slot / 0.014));
    for (let i = 0; i < rungs; i++) {
      const y = length * 0.55 + (i - (rungs - 1) / 2) * (slot / rungs);
      part.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(radius * 0.46, 0.003, 0.003, 0.001), gloveLight, { outline: 0, cast: false }), 0, y, radius * 0.95, 0.45));
    }
    [-1, 1].forEach((side) => engrave([[side * radius * 0.36, length * 0.18, radius * 0.86],
      [side * radius * 0.39, length * 0.55, radius * 0.9], [side * radius * 0.32, length * 0.91, radius * 0.86]], gloveLight, 0.0018, part));
    // A flared lip round the top of the segment, like a stack of cups up the finger
    const rib = runtime.core.mesh(new THREE.CylinderGeometry(radius * 1.08, radius * 1.0, 0.009, 20), gloveLight, { outline: 0 });
    rib.scale.z = 0.9;
    rib.position.y = length * 0.88;
    part.add(rib);
    if (ring) {
      const band = runtime.core.mesh(new THREE.CylinderGeometry(radius * 1.12, radius * 1.12, 0.014, 20), gloveDark, { outline: 0 });
      band.scale.z = 0.9;
      part.add(band);
      const lip = runtime.core.mesh(new THREE.CylinderGeometry(radius * 1.13, radius * 1.13, 0.004, 20), gloveLight, { outline: 0 });
      lip.scale.z = 0.9;
      lip.position.y = 0.009;
      part.add(lip);
    }
    return part;
  };
  // Fingers on hinges at the knuckles: three segments each, tapering to the tip
  const fingers = [[-0.18, 0.3], [-0.06, 0.36], [0.06, 0.38], [0.18, 0.32]].map(([x, length]) => {
    const hinge = new THREE.Group();
    hinge.position.set(x, 1.38, 0);
    // Its three segments, knuckle first: a pose bends each of them
    const pieces = [];
    hinge.userData.pieces = pieces;
    let joint = hinge;
    [0.42, 0.33, 0.25].forEach((share, k) => {
      const piece = new THREE.Group();
      piece.position.y = k ? length * [0.42, 0.33][k - 1] : 0;
      piece.rotation.x = k ? -0.08 : 0;
      piece.add(fingerSegment(0.043 - k * 0.004, length * share));
      joint.add(piece);
      joint = piece;
      pieces.push(piece);
    });
    glovePart.add(hinge);
    return hinge;
  });
  const thumb = new THREE.Group();
  thumb.position.set(0.27, 1.02, 0.02);
  thumb.rotation.z = -0.42;
  const thumbTip = new THREE.Group();
  thumbTip.position.y = 0.17;
  thumbTip.rotation.z = 0.13;
  thumbTip.add(fingerSegment(0.05, 0.15));
  // A broad plate over the thumb's base carries the time stone
  const thumbGuard = new THREE.Shape();
  thumbGuard.moveTo(-0.073, -0.015);
  thumbGuard.quadraticCurveTo(-0.125, 0.065, -0.07, 0.184);
  thumbGuard.quadraticCurveTo(-0.025, 0.2, 0.061, 0.145);
  thumbGuard.quadraticCurveTo(0.095, 0.068, 0.06, 0.005);
  thumbGuard.quadraticCurveTo(0, -0.035, -0.073, -0.015);
  const thumbPlate = runtime.core.mesh(new THREE.ExtrudeGeometry(thumbGuard, { depth: 0.018, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 16 }), glove, { outline: 0.005 });
  thumbPlate.position.z = 0.062;
  thumb.add(fingerSegment(0.06, 0.18, false), thumbTip, thumbPlate);
  engrave([[-0.059, -0.001, 0.086], [-0.096, 0.066, 0.086], [-0.058, 0.169, 0.086], [0.038, 0.142, 0.086]], gloveLight, 0.003, thumb);
  glovePart.add(thumb);
  // A soft round glow, shared by the stones' halos and the snap's flash
  const flashTex = canvasTexture(128, 128);
  runtime.core.track(flashTex.texture);
  const glow = flashTex.ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(0.35, "rgba(255,255,255,0.55)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  flashTex.ctx.fillStyle = glow;
  flashTex.ctx.fillRect(0, 0, 128, 128);
  // Stones in raised gold settings, each with a coloured halo that brightens on hover and at
  // the snap (the halo adds light, keeping the pulse visible in the room's shade)
  const stoneGeo = runtime.core.track(new THREE.IcosahedronGeometry(1, 1));
  const stone = (color, parent, x, y, z, r, tall = 1) => {
    const setting = runtime.core.mesh(new THREE.CylinderGeometry(r * 1.35, r * 1.35, 0.03, 32), gloveDark, { outline: 0 });
    setting.rotation.x = Math.PI / 2;
    setting.scale.z = tall;
    setting.position.set(x, y, z - 0.01);
    const gemMat = runtime.core.toon(color);
    gemMat.emissive.set(color);
    gemMat.emissiveIntensity = 0.08;
    gemMat.flatShading = true;
    const gem = new THREE.Mesh(stoneGeo, gemMat);
    gem.scale.set(r, r * tall, r * 0.6);
    gem.position.set(x, y, z + 0.008);
    gem.userData.size = gem.scale.clone();
    const bezel = runtime.core.mesh(new THREE.TorusGeometry(r * 1.15, r * 0.075, 8, 40), gloveLight, { outline: 0 });
    bezel.scale.y = tall;
    bezel.position.set(x, y, z + 0.003);
    const glint = new THREE.Mesh(runtime.core.track(new THREE.OctahedronGeometry(0.055)), runtime.core.track(new THREE.MeshBasicMaterial({ color: "#fff8d8" })));
    glint.position.set(-0.25, 0.3, 0.95);
    gem.add(glint);
    const halo = new THREE.Sprite(runtime.core.track(new THREE.SpriteMaterial({ map: flashTex.texture, color, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false })));
    halo.position.set(x, y, z + 0.03);
    halo.scale.setScalar(r * 5);
    halo.raycast = runtime.core.noRaycast;
    gem.userData.halo = halo;
    gem.userData.r = r;
    parent.add(setting, bezel, gem, halo);
    return gem;
  };
  // Soul, space, reality and power across the knuckles, each on its own raised boss; mind at
  // the centre; time on the thumb
  const boss = new THREE.Shape();
  boss.moveTo(0, -0.068);
  boss.lineTo(-0.05, -0.03);
  boss.lineTo(-0.052, 0.035);
  boss.lineTo(-0.025, 0.058);
  boss.lineTo(0.025, 0.058);
  boss.lineTo(0.052, 0.035);
  boss.lineTo(0.05, -0.03);
  boss.closePath();
  const bossGeo = new THREE.ExtrudeGeometry(boss, { depth: 0.016, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.004, bevelSegments: 2, steps: 1 });
  [-0.18, -0.06, 0.06, 0.18].forEach((x) => {
    const plate = runtime.core.mesh(bossGeo, glove, { outline: 0 });
    plate.position.set(x, 1.335, handFront(x, 1.335) + 0.017);
    glovePart.add(plate);
  });
  [-0.12, 0, 0.12].forEach((x) => {
    for (let i = 0; i < 3; i++) {
      const y = 1.315 - i * 0.012;
      engrave([[x - 0.009, y, handFront(x, y) + 0.027], [x, y - 0.006, handFront(x, y) + 0.029],
        [x + 0.009, y, handFront(x, y) + 0.027]], gloveLight, 0.0017);
    }
  });
  const stones = [
    stone("#d58405", glovePart, -0.18, 1.34, handFront(-0.18, 1.34) + 0.04, 0.034, 1.1),
    stone("#00638d", glovePart, -0.06, 1.34, handFront(-0.06, 1.34) + 0.04, 0.034, 1.1),
    stone("#a51217", glovePart, 0.06, 1.34, handFront(0.06, 1.34) + 0.04, 0.034, 1.1),
    stone("#272239", glovePart, 0.18, 1.34, handFront(0.18, 1.34) + 0.04, 0.034, 1.1),
    stone("#dca40c", glovePart, 0, 1.14, 0.2, 0.072, 1.16),
    stone("#007740", thumb, 0, 0.09, 0.095, 0.03, 1.05),
  ];
  // One glow on the glove for all six: the colour of whichever stone burns brightest, faint at
  // rest (the mind stone) and flaring with it. Dark while the swords' close-up puts the glove
  // away (the light itself stays, see hideRackProps)
  const stoneTint = { color: new THREE.Color() };
  const stoneLight = runtime.room.neonLight("#ffdd00", 0.9, () => {
    if (runtime.swordEffects.rackPropsHidden) return 0;
    let brightest = stones[4];
    stones.forEach((gem) => {
      if (gem.userData.halo.material.opacity > brightest.userData.halo.material.opacity) brightest = gem;
    });
    stoneTint.color.copy(brightest.material.color);
    return brightest.userData.halo.material.opacity;
  }, { distance: 1.6, tint: stoneTint });
  stoneLight.position.set(0, 1.22, 0.35);
  glovePart.add(stoneLight);
  // Light a stone up: the gem swells and its halo flares, then both settle
  const flare = (gem, delay = 0, strength = 1) => {
    const { size, halo, r } = gem.userData;
    gsap.fromTo(gem.scale, { x: size.x * (1 + 0.6 * strength), y: size.y * (1 + 0.6 * strength) }, { x: size.x, y: size.y, duration: 0.6, delay, ease: "power2.out" });
    gsap.fromTo(halo.scale, { x: r * (5 + 9 * strength), y: r * (5 + 9 * strength) }, { x: r * 5, y: r * 5, duration: 0.9, delay, ease: "power2.out" });
    gsap.fromTo(halo.material, { opacity: 1 }, { opacity: 0.06, duration: 0.9, delay, ease: "power2.out" });
  };
  // A white flash for the snap
  const flash = new THREE.Sprite(runtime.core.track(new THREE.SpriteMaterial({ map: flashTex.texture, color: "#fff4c2", transparent: true, depthTest: false, depthWrite: false })));
  flash.renderOrder = 12;
  flash.raycast = runtime.core.noRaycast;
  flash.visible = false;
  runtime.core.scene.add(flash);
  // Dust: a pool of little squares, coloured after whatever is crumbling
  const dust = Array.from({ length: 240 }, () => {
    const grain = new THREE.Sprite(runtime.core.track(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })));
    grain.visible = false;
    grain.raycast = runtime.core.noRaycast;
    runtime.core.scene.add(grain);
    return grain;
  });
  const dustBox = new THREE.Box3();
  // Screen-right as seen from the desk view, the way the dust drifts off
  const driftRight = new THREE.Vector3(0.9, 0, -0.43);
  let snapping = false;
  function crumble(object, colors, delay, grains) {
    object.updateWorldMatrix(true, true);
    dustBox.setFromObject(object);
    const shadow = runtime.coffee.contactShadows.find((entry) => entry.object === object);
    grains.forEach((grain, i) => {
      gsap.killTweensOf([grain.position, grain.material, grain.scale]);
      grain.position.set(
        THREE.MathUtils.lerp(dustBox.min.x, dustBox.max.x, Math.random()),
        THREE.MathUtils.lerp(dustBox.min.y, dustBox.max.y, Math.random()),
        THREE.MathUtils.lerp(dustBox.min.z, dustBox.max.z, Math.random()),
      );
      grain.material.color.set(colors[i % colors.length]);
      grain.material.opacity = 0;
      grain.scale.setScalar(0.07 + Math.random() * 0.07);
      grain.visible = true;
      const start = delay + Math.random() * 1.0;
      const far = 1.5 + Math.random() * 2.2;
      gsap.to(grain.material, { opacity: 1, delay: start, duration: 0.1 });
      gsap.to(grain.position, {
        x: grain.position.x + driftRight.x * far, z: grain.position.z + driftRight.z * far, y: grain.position.y + 0.5 + Math.random() * 1.4,
        delay: start, duration: 1.6 + Math.random() * 0.8, ease: "power1.out",
      });
      gsap.to(grain.material, { opacity: 0, delay: start + 0.9, duration: 0.9, onComplete: () => (grain.visible = false) });
    });
    // Its resting size and place, kept from the first time it crumbled (so a snap that catches
    // it still crumbled can't make "gone" its normal state), and the middle of its shape in its
    // parent's space: it shrinks into that point, where it stands, not toward its group's origin
    if (!object.userData.rest) {
      const centre = dustBox.getCenter(new THREE.Vector3());
      object.userData.rest = {
        scale: object.scale.clone(),
        position: object.position.clone(),
        centre: object.parent.worldToLocal(centre),
      };
    }
    const { scale, position, centre } = object.userData.rest;
    // (anything it leaves lying about loose in the room goes with it)
    object.userData.onCrumble?.(delay);
    const shrink = { k: 1 };
    const apply = () => {
      object.scale.copy(scale).multiplyScalar(Math.max(shrink.k, 0.001));
      object.position.copy(centre).addScaledVector(position.clone().sub(centre), shrink.k);
    };
    gsap.to(shrink, { k: 0, delay: delay + 0.3, duration: 1.1, ease: "power2.in", onUpdate: apply });
    if (shadow) gsap.to(shadow, { size: 0.001, delay: delay + 0.6, duration: 0.8 });
    // ...and back again, exactly where it was
    runtime.core.timers.push(setTimeout(() => {
      gsap.to(shrink, {
        k: 1, duration: 0.6, ease: "back.out(2)", onUpdate: apply,
        onComplete: () => {
          object.scale.copy(scale);
          object.position.copy(position);
        },
      });
      if (shadow) gsap.to(shadow, { size: 1, duration: 0.6 });
    }, (delay + 4.2) * 1000));
  }
  const snapPoint = new THREE.Vector3();
  function snapFingers() {
    if (snapping) return;
    snapping = true;
    gsap.killTweensOf(glovePart.position);
    runtime.secrets.discover("snap");
    runtime.camera.setFocus("gauntlet");
    const tl = gsap.timeline({ onComplete: () => (snapping = false) });
    // Hand poses: each finger's knuckle, middle and tip joints (pinky to index), and the thumb
    const pose = (at, duration, ease, angles, thumbTo) => {
      fingers.forEach((finger, i) => finger.userData.pieces.forEach((piece, k) => {
        tl.to(k ? piece.rotation : finger.rotation, { x: angles[i][k], duration, ease }, at);
      }));
      tl.to(thumb.rotation, { ...thumbTo, duration, ease }, at);
    };
    const REST = [[0, -0.08, -0.08], [0, -0.08, -0.08], [0, -0.08, -0.08], [0, -0.08, -0.08]];
    // Ready to snap: pinky and ring folded into the palm, the middle finger pressed to the thumb,
    // the index loosely bent
    const READY = [[-1.3, -1.3, -1.0], [-1.3, -1.3, -1.0], [-0.75, -0.7, -0.5], [-0.25, -0.25, -0.2]];
    // The snap: the middle finger slams into the palm as the thumb springs out
    const SNAP = [[-1.3, -1.3, -1.0], [-1.3, -1.3, -1.0], [-1.55, -1.2, -0.9], [-0.3, -0.3, -0.2]];
    // Once the camera has closed in (0.9 s): a slow, heavy rise off the plinth while the stones
    // hum and light up one by one
    tl.call(() => sfx.power({ duration: 1.8 }), null, 0.9)
      .to(glovePart.position, { y: 0.8, duration: 1.6, ease: "power2.inOut" }, 0.95)
      // Then hovering (an even number of swings, so it's back at 0.8 before it sinks at 4.15)
      .to(glovePart.position, { y: 0.88, duration: 0.4, ease: "sine.inOut", yoyo: true, repeat: 3 }, 2.55);
    stones.forEach((gem, i) => {
      tl.call(() => {
        flare(gem, 0, 1.4);
        sfx.tick({ pitch: 1.6 + i * 0.15 });
      }, null, 1.1 + i * 0.24);
    });
    // Turn the thumb side toward the camera and take up the snap
    tl.to(glovePart.rotation, { y: -0.5, duration: 0.45, ease: "power2.inOut" }, 2.6);
    pose(2.6, 0.45, "power2.inOut", READY, { z: -0.15, x: -0.6 });
    tl.call(() => sfx.riser({ duration: 0.5 }), null, 2.92);
    pose(3.35, 0.07, "power4.in", SNAP, { z: -0.95, x: -0.2 });
    tl.call(() => {
      sfx.snap();
      glovePart.localToWorld(snapPoint.set(0.15, 1.35, 0));
      stones.forEach((gem) => flare(gem, 0, 2));
      flash.position.copy(snapPoint);
      flash.visible = true;
      gsap.fromTo(flash.scale, { x: 0.3, y: 0.3 }, { x: 4.5, y: 4.5, duration: 0.35, ease: "power3.out" });
      gsap.fromTo(flash.material, { opacity: 1 }, { opacity: 0, duration: 0.6, delay: 0.1, onComplete: () => (flash.visible = false) });
      // The recoil
      gsap.fromTo(glovePart.rotation, { z: 0.12 }, { z: 0, duration: 0.5, ease: "elastic.out(1.4, 0.25)" });
    }, null, 3.42);
    // Open the hand again and face front
    pose(3.8, 0.45, "power2.inOut", REST, { z: -0.42, x: 0 });
    tl.to(glovePart.rotation, { y: 0, duration: 0.45, ease: "power2.inOut" }, 3.8)
      // Back out to the desk to watch half of it go; the glove sinks back onto its plinth on the
      // way out, as the room starts to crumble
      .call(() => runtime.camera.setFocus("overview"), null, 4.15)
      .to(glovePart.position, { y: 0, duration: 1.2, ease: "power2.inOut" }, 4.15)
      .call(() => sfx.knock({ strength: 0.6 }), null, 5.35)
      .call(() => {
        sfx.dust();
        // Perfectly balanced: a random half of everything in the room (bar the gauntlet, the
        // shelf it stands on and the window, a hole in the wall), each with the colours its
        // dust takes
        const everything = [
          [[runtime.coffee.mug, runtime.coffee.coaster], ["#fffdf5", "#6f4e37", "#a8743f"]],
          [[runtime.postcard.mail], ["#e2cb9c", "#fffdf5", "#3b82f6"]],
          [[runtime.chat.phoneStand], ["#7a2635", "#1a1714", "#ffdd00"]],
          [[runtime.plant.plant], ["#16a34a", "#8fd694", "#ff7a1a"]],
          [[runtime.mouse.mouse], ["#ffffff", "#e11d48"]],
          [[runtime.keyboard.keyboard], ["#1b1c1f", "#43464d", "#f5c22b", "#f2603c"]],
          [[runtime.workstation.monitor], ["#c2c6cc", "#1a1714", "#8fd694"]],
          [[runtime.workstation.speakers[0].group], ["#1a1714", "#7fb2ff", "#ffdd00"]],
          [[runtime.workstation.speakers[1].group], ["#1a1714", "#7fb2ff", "#ffdd00"]],
          [[runtime.lamp.lamp], ["#8b5a34", "#1a1714", "#efd9ae"]],
          [[runtime.chair.chair], ["#45474d", "#1a1714"]],
          [[runtime.guitar.guitar], ["#e6c38f", "#6b4428", "#1a1714"]],
          [[runtime.wallDecor.paintingHang], ["#ff90e8", "#ffdd00", "#00e0c6", "#1a1714"]],
          [[runtime.wallDecor.clock], ["#7fb2ff", "#fffdf5", "#1a1714"]],
          [[runtime.tickets.tickets], ["#fffdf5", "#00e0c6", "#ffdd00"]],
          [[runtime.projectFiles.folders], ["#ff90e8", "#ffdd00", "#8fd694", "#7fb2ff"]],
          [[runtime.gym.gym], ["#8b9099", "#6b7079", "#9ca3af"]],
          [[runtime.strawHat.hatPeg], ["#f2c14e", "#d62828"]],
          [[runtime.swordRack.katanaRack], ["#6b2fa8", "#b91c1c", "#fffdf5", "#d4a72c", "#181513"]],
          [[runtime.cat.catModel], ["#ff9f45", "#d9741f", "#fffdf5"]],
          [[runtime.wastebasket.bin], ["#00e0c6", "#008f80", "#ff7a1a", "#ffdd00", "#fffdf5"]],
        ];
        const doomed = everything
          .map((entry) => [Math.random(), entry])
          .sort((a, b) => a[0] - b[0])
          .slice(0, Math.floor(everything.length / 2))
          .map(([, entry]) => entry);
        const share = Math.floor(dust.length / doomed.reduce((n, [objects]) => n + objects.length, 0));
        let next = 0;
        doomed.forEach(([objects, colors], i) => objects.forEach((object) => crumble(object, colors, i * 0.12, dust.slice(next, (next += share)))));
      }, null, 4.25)
      .call(() => sfx.sparkle(), null, 8.85)
      // Not again until everything is back
      .call(() => {}, null, 10.5);
  }
  runtime.core.register(gauntlet, {
    // A ripple of light across the stones, with a little shimmer
    onHover: (on) => {
      if (snapping) return;
      gsap.to(glovePart.position, { y: on ? 0.28 : 0, duration: on ? 0.4 : 0.5, ease: on ? "back.out(1.5)" : "power2.out", overwrite: true });
      if (!on) return;
      stones.forEach((gem, i) => flare(gem, i * 0.06));
      sfx.tick({ pitch: 2.2 });
      sfx.tick({ pitch: 2.6, delay: 0.12 });
    },
    onClick: snapFingers,
  });

  const SHELF_SOUNDS = {
    console: () => sfx.blip(),
    controller: () => {
      sfx.click();
      runtime.core.timers.push(setTimeout(() => sfx.click(), 90));
    },
    book: () => sfx.bookDown({ strength: 0.4 }),
    case: () => sfx.tick({ pitch: 0.9 }),
    figure: () => sfx.pop({ pitch: 1.3 }),
    trophy: () => sfx.ping(),
    robot: () => {},
    rubik: () => sfx.click(),
    switch: () => sfx.blip(),
  };
  // Hovered, each kind of prop answers softly in its own voice (the trophy has its own)
  const SHELF_HOVER_SOUNDS = {
    // a short beep and its fan spinning up as its light blinks
    console: (s) => s.consoleWake(),
    // a slightly different pitch per pass, so a sweep along the row sounds like a finger running over the spines
    case: (s) => s.slide({ duration: 0.15, pitch: 0.85 + Math.random() * 0.3 }),
    book: (s) => s.riffle({ count: 2, duration: 0.1 }),
    controller: (s) => s.tick({ pitch: 1.4 }),
    rubik: (s) => {
      s.tick({ pitch: 1.2 });
      s.tick({ pitch: 1.2, delay: 0.06 });
    },
    switch: (s) => s.pop({ pitch: 1.8 }),
    figure: (s) => s.boing(),
    robot: (s) => s.blip(),
  };
  const itemFor = (obj) => runtime.shelf.shelfItems.find(({ obj: item }) => {
    for (let o = obj; o; o = o.parent) if (o === item) return true;
    return false;
  });
  // Zoomed in on the shelf: the console switches on and boots its game on the monitor, a
  // controller buzzes and hints at a cheat code, the trophy reads out the secrets found
  // One bubble, up and to the right of what was clicked, its tail leaving the bubble's lower
  // left and pointing down at the speaker's top-right corner (`at`, in the local space of
  // `part`, the piece that moves: the pad buzzing on its stand, not the stand)
  const SHELF_BUBBLE_W = 2.7;
  const SHELF_BUBBLE_H = 1.42;
  const shelfBubbleAt = new THREE.Vector3();
  const shelfBubblePrint = { size: 40, tail: "down-left", style: "manga" };
  const shelfBubble = runtime.core.speechBubble(SHELF_BUBBLE_W, SHELF_BUBBLE_H, shelfBubblePrint);
  let shelfBubbleTarget = null;
  const shelfBubbleAnchors = new Map([
    [runtime.shelfCollectibles.trophy, { part: runtime.shelfCollectibles.trophy, at: new THREE.Vector3(0.25, 1.12, 0.3) }],
    ...[runtime.shelfConsole.pad1, runtime.shelfConsole.pad2].map((pad) => [pad, { part: pad.userData.moves, at: new THREE.Vector3(0.15, 0.1, -0.26) }]),
    [runtime.robot.robot, { part: runtime.robot.robot, at: new THREE.Vector3(0.3, 1.02, 0.29) }],
    [runtime.handheld.nintendoSwitch, { part: runtime.handheld.nintendoSwitch, at: new THREE.Vector3(0.72, 0.78, 0.1) }],
  ]);
  const shelfBubbleRight = new THREE.Vector3();
  const shelfBubbleUp = new THREE.Vector3();
  // The tip stops a little short of the corner, up and to the right, so it points without
  // touching. Sprites face the camera, so both placement axes must face it too (including
  // during zoom); it runs every frame the bubble shows, following the speaker as it moves.
  function placeShelfBubble() {
    const { part, at } = shelfBubbleAnchors.get(shelfBubbleTarget);
    part.localToWorld(shelfBubbleAt.copy(at));
    shelfBubbleRight.set(1, 0, 0).applyQuaternion(runtime.core.camera.quaternion);
    shelfBubbleUp.set(0, 1, 0).applyQuaternion(runtime.core.camera.quaternion);
    shelfBubbleAt.addScaledVector(shelfBubbleRight, 0.06).addScaledVector(shelfBubbleUp, 0.14);
    const [tipX, tipY] = BUBBLE_TAILS[shelfBubblePrint.tail].tip;
    const sprite = shelfBubble.sprite;
    sprite.position.copy(shelfBubbleAt)
      .addScaledVector(shelfBubbleRight, (0.5 - tipX) * sprite.scale.x)
      .addScaledVector(shelfBubbleUp, (tipY - 0.5) * sprite.scale.y);
  }
  // On a narrow view a full-size bubble up and to the right runs off the screen: it moves to
  // the speaker's upper left instead (tail leaving its lower right) when there's more room
  // there, and shrinks to whatever room is left
  const shelfBubbleView = new THREE.Vector3();
  function shelfBubbleRoom(point) {
    const view = runtime.core.camera;
    view.updateMatrixWorld();
    shelfBubbleView.copy(point).applyMatrix4(view.matrixWorldInverse);
    let halfW, halfH;
    if (view.isPerspectiveCamera) {
      halfH = (-shelfBubbleView.z * Math.tan(THREE.MathUtils.degToRad(view.fov / 2))) / view.zoom;
      halfW = halfH * view.aspect;
    } else {
      halfW = (view.right - view.left) / 2 / view.zoom;
      halfH = (view.top - view.bottom) / 2 / view.zoom;
    }
    return { left: halfW + shelfBubbleView.x, right: halfW - shelfBubbleView.x, top: halfH - shelfBubbleView.y };
  }
  function shelfBubbleFit(tail, room) {
    // The bubble reaches tipX of its width left of the tail's tip and the rest to the right;
    // it stops a little short of each edge
    const [tipX, tipY] = BUBBLE_TAILS[tail].tip;
    return Math.min(
      1,
      (room.left * 0.92) / (tipX * SHELF_BUBBLE_W),
      (room.right * 0.92) / ((1 - tipX) * SHELF_BUBBLE_W),
      (room.top * 0.92) / (tipY * SHELF_BUBBLE_H),
    );
  }
  function shelfSay(obj, text, by = "the shelf", hold = 3200) {
    shelfBubbleTarget = obj;
    placeShelfBubble(); // leaves the tail's tip in shelfBubbleAt
    const room = shelfBubbleRoom(shelfBubbleAt);
    const rightFit = shelfBubbleFit("down-left", room);
    const leftFit = shelfBubbleFit("right", room);
    shelfBubblePrint.tail = rightFit >= 1 || rightFit >= leftFit ? "down-left" : "right";
    // never smaller than half size, even where that can't quite fit
    shelfBubble.say({ text, by }, hold, Math.max(0.5, Math.max(rightFit, leftFit)));
    placeShelfBubble();
  }
  function powerConsole() {
    runtime.secrets.discover("console");
    sfx.power({ duration: 0.8 });
    // Light runs up the seams and settles in its working colour, all within the console's ends
    runtime.shelfConsole.bootLed();
    [runtime.shelfConsole.pad1, runtime.shelfConsole.pad2].forEach((pad, i) => gsap.fromTo(pad.userData.moves.rotation, { z: 0.08 }, { z: 0, duration: 0.5, delay: i * 0.08, ease: "elastic.out(1.5, 0.15)" }));
    runtime.shelf.setNeon(true);
    shelfBubble.hide();
    // Off to the monitor, which turns into its TV: the console boots into Straw Hat Dash
    runtime.core.timers.push(setTimeout(() => {
      runtime.camera.setFocus("monitor");
      runtime.core.timers.push(setTimeout(() => {
        runtime.workstation.desktop.playConsole();
        runtime.workstation.redrawScreen();
      }, 900));
    }, 900));
  }
  function buzzController(item) {
    const pad = item.userData.moves;
    const x = pad.position.x;
    gsap.fromTo(pad.position, { x: x - 0.04 }, { x, duration: 0.05, repeat: 7, yoyo: true, ease: "none", onComplete: () => (pad.position.x = x) });
    sfx.patter({ duration: 0.35 });
    shelfSay(item, "↑ ↑ ↓ ↓ ← → ← → B A", "try it on the keyboard", 3200);
  }
  runtime.core.register(runtime.shelf.shelf, {
    focus: "shelf",
    onLeave: () => {
      runtime.pointer.finishShelfDrag();
      shelfBubble.hide();
      shelfHoverCarriers.forEach((carrier) => gsap.to(carrier.position, { y: 0, z: 0, duration: 0.25, overwrite: true }));
    },
    onKey: (e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return false;
      runtime.pointer.browseShelf(runtime.shelf.shelfLook + (e.key === "ArrowUp" ? 1.4 : -1.4));
      return true;
    },
    onClick: (hit) => {
      const item = itemFor(hit.object);
      if (!item) return sfx.knock({ strength: 0.6 });
      if (item.obj === runtime.shelfConsole.ps5) powerConsole();
      else if (item.obj === runtime.shelfConsole.pad1 || item.obj === runtime.shelfConsole.pad2) buzzController(item.obj);
      else if (item.obj === runtime.shelfCollectibles.rubikItem) runtime.shelfCollectibles.playRubik();
      else if (item.obj === runtime.robot.robot) runtime.robot.pokeRobot();
      else if (item.obj === runtime.handheld.nintendoSwitch) runtime.handheld.playSwitch();
      else if (item.obj === runtime.shelfCollectibles.trophy) {
        // The score, and a hint toward one of the secrets still to find
        const left = runtime.secrets.SECRETS.filter((id) => !runtime.secrets.secretsFound.has(id));
        if (!left.length) return runtime.secrets.cheerTrophy();
        const text = left.length ? `${runtime.secrets.secretsFound.size}/${runtime.secrets.SECRETS.length} found. Hint: ${runtime.secrets.SECRET_HINTS[left[Math.floor(Math.random() * left.length)]]}` : "ALL SECRETS FOUND! 🏆";
        shelfSay(runtime.shelfCollectibles.trophy, text, "the trophy", 4500);
      }
      // A volume lying in the manga pile slides out and back instead of hopping
      if (item.sound === "book" && runtime.shelfCollectibles.nudgeManga(item.obj)) return;
      // The console is too big to hop: pressed on, it gives a little squash on its foot and
      // springs back, as its light runs up the seams
      if (item.obj === runtime.shelfConsole.ps5) {
        gsap.fromTo(item.obj.scale, { x: 1.035, y: 0.965, z: 1.035 }, { x: 1, y: 1, z: 1, duration: 0.7, ease: "elastic.out(1.2, 0.35)", overwrite: true });
        return SHELF_SOUNDS.console();
      }
      // Always from where it rests: a click mid-hop must not start the next hop higher up
      // (an item on a stand hops off its stand, not with it)
      const hopper = item.obj.userData.moves || item.obj;
      const y = hopper.userData.restY;
      gsap.fromTo(hopper.position, { y }, { keyframes: [{ y: y + 0.28, duration: 0.16, ease: "power2.out" }, { y, duration: 0.3, ease: "bounce.out" }], overwrite: true });
      SHELF_SOUNDS[item.sound]();
    },
  });

  // Every shelf prop has its own hover target; the fixed shelf never moves.
  // Translation-only carriers preserve local coordinates used by the existing click routines.
  const shelfHoverCarriers = [];
  runtime.shelf.shelfItems.forEach((item) => {
    const movable = item.obj === runtime.shelfConsole.pad1 || item.obj === runtime.shelfConsole.pad2 ? item.obj.userData.moves
      : item.obj === runtime.handheld.nintendoSwitch ? runtime.handheld.switchConsole : item.obj;
    const carrier = new THREE.Group();
    movable.parent.add(carrier);
    carrier.add(movable);
    shelfHoverCarriers.push(carrier);
    const lift = item.sound === "book" || item.sound === "case" || item.obj === runtime.shelfConsole.ps5 ? 0
      : item.obj === runtime.shelfCollectibles.trophy ? 0.06 : item.sound === "rubik" ? 0.12 : 0.09;
    const forward = item.sound === "book" ? 0.22 : item.sound === "case" ? 0.18 : 0.09;
    runtime.core.register(item.obj, {
      focus: "shelf", item: true,
      onHover: (on) => {
        const busy = (item.obj === runtime.shelfCollectibles.trophy && runtime.shelfCollectibles.trophyCelebrating) || (item.obj === runtime.robot.robot && runtime.robot.botBusy)
          || (item.obj === runtime.shelfCollectibles.rubikItem && runtime.shelfCollectibles.rubikBusy) || (item.obj === runtime.handheld.nintendoSwitch && runtime.handheld.switchBusy);
        if (on && busy) return;
        if (on && item.obj === runtime.shelfConsole.ps5) runtime.shelfConsole.blinkLed();
        if (on && item.obj === runtime.shelfCollectibles.trophy) sfx.trophyHover();
        if (on && SHELF_HOVER_SOUNDS[item.sound]) hoverSound(item.obj, SHELF_HOVER_SOUNDS[item.sound]);
        gsap.to(carrier.position, { y: on ? lift : 0, z: on ? forward : 0, duration: on ? 0.25 : 0.35, ease: "power2.out", overwrite: true });
      },
      onClick: (hit) => runtime.core.interactive.get(runtime.shelf.shelf).onClick(hit),
    });
  });

  // Public state used by the other scene parts.
  return {
    shelfBubbleAt,
    shelfBubble,
    shelfSay,
    gauntlet,
    placeShelfBubble,
  };
}
