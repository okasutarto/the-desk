import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { canvasTexture } from "../textures";

export function createHeadset(runtime) {
  // BlackShark V3 Pro White. World units, 1 = 10 cm. Outer dimensions are a
  // reference-based approximation (~16.5 × 20.3 × 9.5 cm without boom), not CAD.
  // References: razer.com/gaming-headsets/razer-blackshark-v3-pro and the
  // RZ04-0540x guide: 66 × 44 mm inner cushion opening, 12 mm mic capsule.
  const { mesh, rbox, toon, track } = runtime.core;
  const white = toon("#e9e9e5");
  const seam = toon("#c4c7c7");
  const black = toon("#17191c");
  const rubber = toon("#292b2e");
  const steel = toon("#9da6ad");
  const fabric = toon("#35373b");
  const weave = canvasTexture(128, 128);
  track(weave.texture);
  weave.ctx.fillStyle = "#787b80";
  weave.ctx.fillRect(0, 0, 128, 128);
  // Low-contrast knit, fine enough to read as cloth rather than a checkerboard.
  weave.ctx.fillStyle = "#898c90";
  for (let y = 0; y < 128; y += 3) {
    for (let x = (y % 2); x < 128; x += 3) weave.ctx.fillRect(x, y, 1, 1);
  }
  fabric.map = weave.texture;

  const knobTexture = canvasTexture(128, 128);
  track(knobTexture.texture);
  knobTexture.ctx.fillStyle = "#dddeda";
  knobTexture.ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 180; i++) {
    const a = i * Math.PI / 90;
    knobTexture.ctx.strokeStyle = i % 3 ? "#d1d3d1" : "#ecece9";
    knobTexture.ctx.lineWidth = 0.6;
    knobTexture.ctx.beginPath();
    knobTexture.ctx.moveTo(64, 64);
    knobTexture.ctx.lineTo(64 + 64 * Math.cos(a), 64 + 64 * Math.sin(a));
    knobTexture.ctx.stroke();
  }
  const knobFinish = toon("#f0f0ec");
  knobFinish.map = knobTexture.texture;

  function part(parent, name, geometry, material, x = 0, y = 0, z = 0, outline = 0) {
    const object = mesh(geometry, material, { outline });
    object.name = name;
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  }
  function tube(parent, name, points, radius, material) {
    return part(parent, name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 32, radius, 8, false), material);
  }
  // Extruded elliptical rings leave a real hole through the cushions.
  function ovalRing(w, h, innerW, innerH, depth) {
    const shape = new THREE.Shape();
    shape.absellipse(0, 0, w / 2, h / 2, 0, Math.PI * 2, false, 0);
    const hole = new THREE.Path();
    hole.absellipse(0, 0, innerW / 2, innerH / 2, 0, Math.PI * 2, true, 0);
    shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 3, curveSegments: 32 });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  }
  function smoothShell(geometry) {
    // Extrusion duplicates vertices at every bevel strip. Weld them before
    // recalculating normals so the white moulding reads as one curved surface.
    geometry.deleteAttribute("normal");
    geometry.deleteAttribute("uv");
    const smooth = mergeVertices(geometry, 1e-5);
    geometry.dispose();
    smooth.computeVertexNormals();
    return smooth;
  }
  // Rounded oval housings with flat faceplates, not stacked spherical shells.
  function ovalShell(w, h, depth, bevel) {
    const shape = new THREE.Shape();
    shape.absellipse(0, 0, w / 2 - bevel, h / 2 - bevel, 0, Math.PI * 2, false, 0);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * bevel, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 5, curveSegments: 40 });
    geometry.translate(0, 0, -(depth - 2 * bevel) / 2);
    return smoothShell(geometry);
  }
  // Broad, flat arched band, rather than a round torus. Ends stop at the sliders.
  function band(radiusX, radiusY, thickness, depth) {
    const shape = new THREE.Shape();
    const min = 0.50, max = Math.PI - min;
    for (let i = 0; i <= 64; i++) {
      const angle = min + (max - min) * i / 64;
      const x = radiusX * Math.cos(angle), y = radiusY * Math.sin(angle);
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    for (let i = 64; i >= 0; i--) {
      const angle = min + (max - min) * i / 64;
      shape.lineTo((radiusX - thickness) * Math.cos(angle), (radiusY - thickness) * Math.sin(angle));
    }
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 32 });
    geometry.translate(0, 0, -depth / 2);
    return smoothShell(geometry);
  }
  const assembly = new THREE.Group();
  assembly.name = "wireless-headset-hook";
  const desk = runtime.room.desk;
  desk.geometry.computeBoundingBox();
  const rightEdge = desk.position.x + desk.geometry.boundingBox.max.x;
  const frontEdge = desk.position.z + desk.geometry.boundingBox.max.z;
  // Front edge, 8 cm in from the right corner and clear of the memory keypad.
  assembly.position.set(rightEdge - 0.8, 0, frontEdge);
  assembly.rotation.y = -Math.PI / 2;
  runtime.core.scene.add(assembly);
  // Screwed underside bracket: 7 cm mounting plate, downstand, padded saddle
  // and an upturned lip. No clamp or wire running across the desk surface.
  part(assembly, "hook-mount", rbox(0.7, 0.07, 0.55, 0.03), black, -0.36, -0.39);
  part(assembly, "hook-downstand", rbox(0.09, 0.33, 0.44, 0.025), black, 0.02, -0.54);
  part(assembly, "hook-saddle", rbox(0.85, 0.09, 0.48, 0.04), black, 0.4, -0.69);
  part(assembly, "hook-pad", rbox(0.69, 0.05, 0.43, 0.02), rubber, 0.4, -0.62);
  part(assembly, "hook-lip", rbox(0.08, 0.17, 0.48, 0.03), black, 0.81, -0.65);
  for (const z of [-0.17, 0.17]) {
    const screw = part(assembly, "hook-screw", new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12), steel, -0.36, -0.435, z);
    part(screw, "screw-slot", new THREE.BoxGeometry(0.055, 0.004, 0.009), black, 0, -0.012);
  }
  const headset = new THREE.Group();
  headset.name = "blackshark-v3-pro-white";
  headset.position.set(0.43, -1.455, 0);
  // Keep the headband across the front edge; only the bracket turns outward.
  headset.rotation.y = Math.PI / 2 - 0.28;
  assembly.add(headset);
  part(headset, "headband-leatherette", band(0.81, 1.03, 0.095, 0.32), white, 0, 0, 0, 0.008);
  part(headset, "headband-inner-padding", band(0.715, 0.935, 0.075, 0.285), fabric);
  // Piping and individual wrap stitches along both edges of the leather band.
  const threadGeometry = new THREE.CylinderGeometry(0.0035, 0.0035, 1, 5);
  for (const z of [-0.155, 0.155]) {
    const points = Array.from({ length: 65 }, (_, i) => {
      const a = 0.52 + (Math.PI - 1.04) * i / 64;
      return [0.802 * Math.cos(a), 1.022 * Math.sin(a), z];
    });
    tube(headset, "headband-edge-seam", points, 0.004, seam);
    for (let i = 0; i < 64; i++) {
      const a = 0.53 + (Math.PI - 1.06) * i / 63;
      const from = new THREE.Vector3(0.806 * Math.cos(a), 1.026 * Math.sin(a), z * 0.9);
      const to = new THREE.Vector3(0.78 * Math.cos(a + 0.009), 1.0 * Math.sin(a + 0.009), z * 1.04);
      const direction = to.clone().sub(from);
      const stitch = part(headset, "headband-stitch", threadGeometry, seam);
      stitch.position.copy(from).add(to).multiplyScalar(0.5);
      stitch.scale.y = direction.length();
      stitch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    }
  }
  const cups = [];
  for (const side of [-1, 1]) {
    part(headset, "adjuster-housing", rbox(0.14, 0.24, 0.35, 0.035), white, side * 0.72, 0.45);
    const cup = new THREE.Group();
    cup.name = side === 1 ? "right-earcup" : "left-earcup";
    cup.position.set(side * 0.575, -0.4, 0);
    // All cup geometry is modelled face-on in xy, then turned to face outward.
    cup.rotation.y = side * Math.PI / 2;
    cup.rotation.x = side * 0.07;
    headset.add(cup);
    cups.push(cup);
    part(cup, "earcup-shell", ovalShell(0.94, 1.14, 0.3, 0.055), white);
    part(cup, "faceplate-seam", ovalShell(0.79, 0.995, 0.018, 0.008), seam, 0, -0.065, 0.149);
    part(cup, "magnetic-faceplate", ovalShell(0.782, 0.987, 0.045, 0.02), white, 0, -0.065, 0.161);
    part(cup, "cushion-leatherette", ovalRing(0.93, 1.1, 0.44, 0.66, 0.19), black, 0, 0, -0.22);
    part(cup, "cushion-flowknit", ovalRing(0.9, 1.07, 0.44, 0.66, 0.055), fabric, 0, 0, -0.35);
    const inner = part(cup, "driver-fabric", new THREE.CircleGeometry(1, 32), fabric, 0, 0, -0.205);
    inner.scale.set(0.23, 0.34, 1);
    inner.rotation.y = Math.PI;
    // The supplied side view shows a black V-shaped fork feeding long white
    // slider sleeves on either side of the cup, with a short exposed cable loop.
    for (const x of [-0.445, 0.445]) {
      // Keep the entire fork outside the shell and faceplate, including the
      // curved span between the headband and the white slider sleeves.
      tube(cup, "metal-slider-rail", [[Math.sign(x) * 0.065, 0.74, 0.205], [x * 0.60, 0.40, 0.205], [x, 0.20, 0.205]], 0.014, black);
      part(cup, "swivel-holder", new THREE.CylinderGeometry(0.037, 0.037, 0.49, 20), white, x, -0.045, 0.205);
      const pivot = part(cup, "swivel-pivot", new THREE.CylinderGeometry(0.045, 0.045, 0.018, 24), white, x * 0.96, -0.04, 0.245);
      pivot.rotation.x = Math.PI / 2;
    }
    tube(cup, "earcup-link-cable", [[0.02, 0.75, 0.07], [0.19, 0.69, 0.18], [0.25, 0.59, 0.18], [0.12, 0.57, 0.13]], 0.018, black);
    part(cup, "anc-microphone-port", rbox(0.085, 0.018, 0.009, 0.004), black, 0, 0.435, 0.154);
    const vent = part(cup, "upper-vent", rbox(0.09, 0.012, 0.008, 0.003), seam, 0.19, 0.465, 0.12);
    vent.rotation.z = -0.4;
    // White knurled dial on the lower face, with a pale metallic end cap.
    const dialRing = part(cup, "dial-seat", new THREE.CylinderGeometry(0.112, 0.112, 0.018, 48), seam, 0, -0.375, 0.19);
    dialRing.rotation.x = Math.PI / 2;
    const dial = part(cup, side < 0 ? "volume-dial" : "configurable-roller", new THREE.CylinderGeometry(0.101, 0.101, 0.10, 48), white, 0, -0.375, 0.241);
    dial.rotation.x = Math.PI / 2;
    for (let i = 0; i < 40; i++) {
      const a = i * Math.PI / 20;
      const ridge = part(dial, "dial-knurl", new THREE.BoxGeometry(0.004, 0.085, 0.004), seam, Math.cos(a) * 0.101, 0, Math.sin(a) * 0.101);
      ridge.rotation.y = -a;
    }
    part(cup, "dial-brushed-cap", new THREE.CircleGeometry(0.092, 48), knobFinish, 0, -0.375, 0.292);
    const power = part(cup, side < 0 ? "power-button" : "anc-button", rbox(0.065, 0.10, 0.035, 0.012), rubber, -0.26, -0.465, 0.015);
    const mute = part(cup, side < 0 ? "mute-button" : "smartswitch-button", rbox(0.06, 0.09, 0.035, 0.012), rubber, -0.15, -0.53, 0.015);
    for (const button of [power, mute]) {
      button.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(button.position.x, button.position.y, 0).normalize());
    }
  }
  const left = cups[0];
  part(left, "usb-c-recess", rbox(0.1, 0.035, 0.03, 0.012), black, 0.06, -0.57, 0.015).rotation.x = Math.PI / 2;
  part(left, "usb-c-tongue", rbox(0.065, 0.009, 0.012, 0.003), steel, 0.06, -0.585, 0.015).rotation.x = Math.PI / 2;
  const ledMat = toon("#4b5750"); // Stored on its hook: powered off, no invented RGB.
  part(left, "status-led", new THREE.SphereGeometry(0.012, 8, 6), ledMat, -0.04, -0.57, 0.015);
  const micDirection = new THREE.Vector3(-0.78, -0.62, 0).normalize();
  const micBase = part(left, "mic-socket", new THREE.CylinderGeometry(0.044, 0.047, 0.19, 24), white, -0.32, -0.35, 0.12);
  micBase.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), micDirection);
  const relief = part(left, "mic-strain-relief", new THREE.CylinderGeometry(0.032, 0.04, 0.065, 20), white, -0.40, -0.41, 0.12);
  relief.quaternion.copy(micBase.quaternion);
  // The wearer's mouth is towards -Z; keep the plug, boom and capsule on
  // that same side instead of sending the microphone behind the earcup.
  const micStart = new THREE.Vector3(-0.425, -0.43, 0.12);
  left.updateMatrix();
  micStart.applyMatrix4(left.matrix);
  tube(headset, "detachable-boom-mic", [[micStart.x, micStart.y, micStart.z], [-0.69, -0.89, -0.65], [-0.48, -0.90, -0.96], [-0.21, -0.84, -1.12], [-0.06, -0.77, -1.14]], 0.024, black);
  const foam = part(headset, "mic-foam-windscreen", new THREE.SphereGeometry(1, 24, 16), fabric, 0.015, -0.74, -1.14, 0.005);
  foam.scale.set(0.16, 0.105, 0.105);
  foam.rotation.z = 0.45;
  return { assembly, headset };
}
