import * as THREE from "three";
import gsap from "gsap";
import { canvasTexture, drawSatinFinish, drawMatteFinish, drawPsSymbols, drawSayaLacquer } from "../textures";

export function createShelfConsole(runtime) {
  const PALETTE = ["#ff6b6b", "#ffdd00", "#00e0c6", "#ff90e8", "#8fd694", "#3b82f6", "#ffb35c", "#c4b5fd", "#fffdf5"];
  const black = runtime.core.toon("#1a1714");

  // Top bay: a PS5 Pro standing on its end, after the reference photo. A gloss-black core
  // between two white side panels, each a tall sweep that flares out at its top front and is
  // cut across the middle by three black fins; a blue light runs up the front edges of the
  // core, and the whole thing stands on a round silver foot.
  const PS_H = 1.94;
  const PS_D = 1.08;
  const CORE_T = 0.26;
  const PANEL_T = 0.055;
  const psWhite = runtime.core.toon("#ffffff");
  // The panels' fine matte texture, a soft stipple that keeps the flat toon white from reading as paper
  const panelGrain = canvasTexture(128, 128);
  runtime.core.track(panelGrain.texture);
  drawMatteFinish(panelGrain.ctx, 128, 128, { grain: 0.05 });
  panelGrain.texture.wrapS = panelGrain.texture.wrapT = THREE.RepeatWrapping;
  panelGrain.texture.repeat.set(3, 3);
  psWhite.map = panelGrain.texture;
  // A soft-edged alpha map (read from its green channel) falling off across (u) and fading out
  // at both ends (v), so a strip of light grows out of the body rather than stopping square
  const lightFalloff = (w, h, across, along) => {
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(255 * across((x + 0.5) / w) * along((y + 0.5) / h));
      data[i + 3] = 255;
    }
    const tex = runtime.core.track(new THREE.DataTexture(data, w, h));
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  };
  const ends = (k) => (t) => THREE.MathUtils.smoothstep(Math.min(t, 1 - t), 0, k);
  // A side panel's outline, in (z, y): back edge straight, front edge leaning in a little up
  // to the fins, then flaring out past the core toward the top. It never dips behind the
  // core's face, so the light in the seam is screened evenly down its length.
  const z0 = -PS_D / 2;
  const z1 = PS_D / 2;
  const v2 = (z, y) => new THREE.Vector2(z, y);
  const frontLow = new THREE.QuadraticBezierCurve(v2(z1 - 0.035, 0.05), v2(z1 - 0.07, PS_H * 0.45), v2(z1 - 0.02, PS_H * 0.8));
  const frontFlare = new THREE.QuadraticBezierCurve(v2(z1 - 0.02, PS_H * 0.8), v2(z1 + 0.1, PS_H * 0.97), v2(z1 + 0.01, PS_H));
  // The vents: three slots cut right through each panel, slanting up toward the front as on
  // the PS5 Pro, from just inside its back edge to just short of its front edge. Each is a
  // parallelogram with rounded ends; through it the black core shows, crossed by a dark fin.
  const frontEdgePts = frontLow.getPoints(40);
  const frontZAt = (y) => {
    const i = Math.max(1, frontEdgePts.findIndex((p) => p.y >= y));
    const a = frontEdgePts[i - 1];
    const b = frontEdgePts[i];
    return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y || 1);
  };
  const VENT_SLOPE = 0.2;
  const VENT_H = 0.066;
  const VENTS = [0, 1, 2].map((i) => {
    const backZ = z0 + 0.06;
    const backY = PS_H * 0.46 + i * (VENT_H + 0.026);
    const lineY = (z) => backY + VENT_SLOPE * (z - backZ);
    // where the slot's top edge meets the inset from the front edge
    let frontZ = z1;
    for (let k = 0; k < 4; k++) frontZ = frontZAt(lineY(frontZ) + VENT_H / 2) - 0.065;
    return { backZ, frontZ, lineY };
  });
  const ventPath = ({ backZ, frontZ, lineY }, inset = 0, path = new THREE.Path()) => {
    const h = VENT_H / 2 - inset;
    const r = h * 0.9;
    path.moveTo(backZ + r, lineY(backZ + r) - h);
    path.lineTo(frontZ - r, lineY(frontZ - r) - h);
    path.quadraticCurveTo(frontZ, lineY(frontZ) - h, frontZ, lineY(frontZ));
    path.quadraticCurveTo(frontZ, lineY(frontZ) + h, frontZ - r, lineY(frontZ - r) + h);
    path.lineTo(backZ + r, lineY(backZ + r) + h);
    path.quadraticCurveTo(backZ, lineY(backZ) + h, backZ, lineY(backZ));
    path.quadraticCurveTo(backZ, lineY(backZ) - h, backZ + r, lineY(backZ + r) - h);
    return path;
  };
  const panelGeo = (() => {
    const shape = new THREE.Shape();
    shape.holes = VENTS.map((vent) => ventPath(vent));
    shape.moveTo(z0 + 0.04, 0);
    shape.lineTo(z1 - 0.06, 0);
    shape.quadraticCurveTo(z1 - 0.03, 0, z1 - 0.035, 0.05);
    [frontLow, frontFlare].forEach(({ v1, v2: end }) => shape.quadraticCurveTo(v1.x, v1.y, end.x, end.y));
    shape.quadraticCurveTo(0, PS_H * 1.035, z0 + 0.03, PS_H * 0.985);
    shape.quadraticCurveTo(z0, PS_H * 0.98, z0, PS_H * 0.95);
    shape.lineTo(z0, 0.04);
    shape.quadraticCurveTo(z0, 0, z0 + 0.04, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: PANEL_T, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 14 });
    // The shape is drawn in x/y: turn it so its width runs along z and it's extruded along x
    geo.rotateY(-Math.PI / 2);
    geo.translate(PANEL_T / 2, 0, 0);
    return geo;
  })();
  const consoleBody = new THREE.Group();
  const core = runtime.core.at(runtime.core.mesh(runtime.core.rbox(CORE_T, PS_H * 0.95, PS_D * 0.9, 0.04), black, { outline: 0.016 }), 0, PS_H * 0.475 + 0.01, -0.01);
  consoleBody.add(core);
  // A dark fin set into each vent slot, below the panel's face
  const finMat = runtime.core.toon("#2a2d35");
  const finGeo = runtime.core.track(new THREE.ExtrudeGeometry(VENTS.map((vent) => new THREE.Shape(ventPath(vent, VENT_H * 0.32).getPoints(8))), { depth: 0.012, bevelEnabled: false, curveSegments: 8 }));
  finGeo.rotateY(-Math.PI / 2);
  finGeo.translate(0.006, 0, 0);
  [-1, 1].forEach((side) => {
    const x = side * (CORE_T / 2 + PANEL_T / 2 + 0.004);
    const panel = runtime.core.at(runtime.core.mesh(panelGeo, psWhite, { outline: 0.016 }), x, 0, 0);
    consoleBody.add(panel);
    consoleBody.add(runtime.core.at(runtime.core.mesh(finGeo, finMat, { outline: 0.004, cast: false }), x + side * PANEL_T * 0.15, 0, 0));
  });
  // The front of the gloss core: a cool sheen down one side, and at its foot the power button
  // and the two USB-C ports
  const CORE_FRONT = PS_D * 0.45 - 0.01;
  const sheen = runtime.core.mesh(new THREE.PlaneGeometry(0.05, PS_H * 0.8), runtime.core.track(new THREE.MeshBasicMaterial({
    color: "#c9d6ff", transparent: true, opacity: 0.14, depthWrite: false,
    alphaMap: lightFalloff(8, 64, (t) => Math.sin(t * Math.PI), ends(0.25)),
  })), { outline: 0, cast: false });
  sheen.position.set(-CORE_T * 0.18, PS_H * 0.5, CORE_FRONT + 0.003);
  consoleBody.add(sheen);
  const coreFace = runtime.core.printed(CORE_T - 0.07, PS_H * 0.93, 700, (c, w, h) => drawPsSymbols(c, w, h));
  coreFace.position.set(0, PS_H * 0.475 + 0.01, CORE_FRONT + 0.0015);
  consoleBody.add(coreFace);
  const portMat = runtime.core.toon("#05070b");
  [0.2, 0.27].forEach((y) => consoleBody.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.07, 0.024, 0.01, 0.011), portMat, { outline: 0, cast: false }), 0, y, CORE_FRONT + 0.001)));
  const powerButton = runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.05, 0.05, 0.012, 0.02), runtime.core.toon("#2a2e36"), { outline: 0.004, cast: false }), 0, 0.37, CORE_FRONT + 0.003);
  consoleBody.add(powerButton);
  // The light: a pipe half sunk into each rounded front corner of the core, where it meets a
  // panel, so it seems to shine out of the seam itself. It fades in and out at its ends, and
  // a soft glow spreads from it over the flat of the core's face. `ledPulse` is a brighter band that runs up the pipes as the console boots.
  const led = new THREE.Group();
  const ledMat = runtime.core.track(new THREE.MeshBasicMaterial({ color: "#4f6bff", transparent: true, depthWrite: false,
    alphaMap: lightFalloff(64, 1, ends(0.22), () => 1) }));
  const ledGlowMat = runtime.core.track(new THREE.MeshBasicMaterial({ color: "#4f6bff", transparent: true, opacity: 0.55, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending, alphaMap: lightFalloff(32, 64, (t) => Math.exp(-((1 - t) ** 2) * 9), ends(0.3)) }));
  const pulseBand = (t) => Math.exp(-((t - 0.5) ** 2) * 90);
  const ledPulseTex = lightFalloff(64, 1, pulseBand, () => 1);
  const ledPulseMat = runtime.core.track(new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, alphaMap: ledPulseTex }));
  const ledPulseGlowTex = lightFalloff(16, 64, (t) => Math.exp(-((1 - t) ** 2) * 7), pulseBand);
  const ledPulseGlowMat = runtime.core.track(new THREE.MeshBasicMaterial({ color: "#b8c8ff", transparent: true, opacity: 0, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending, alphaMap: ledPulseGlowTex }));
  const LED_Y0 = PS_H * 0.06;
  const LED_Y1 = PS_H * 0.93;
  // The core's corners are rounded to CORE_R: the pipe runs on that curve, halfway round it
  const CORE_R = 0.04;
  const FLAT = CORE_T / 2 - CORE_R;
  [-1, 1].forEach((side) => {
    const x = side * (FLAT + CORE_R * Math.SQRT1_2);
    const z = CORE_FRONT - CORE_R * (1 - Math.SQRT1_2);
    const path = new THREE.LineCurve3(new THREE.Vector3(x, LED_Y0, z), new THREE.Vector3(x, LED_Y1, z));
    const pipe = new THREE.Mesh(runtime.core.track(new THREE.TubeGeometry(path, 1, 0.009, 12, false)), ledMat);
    const pulse = new THREE.Mesh(runtime.core.track(new THREE.TubeGeometry(path, 1, 0.012, 12, false)), ledPulseMat);
    // the glow lies flat on the face, brightest where the face turns into the lit corner
    // (turned round on the left so its bright edge is outermost there too)
    const glowGeo = runtime.core.track(new THREE.PlaneGeometry(0.06, LED_Y1 - LED_Y0));
    const glow = new THREE.Mesh(glowGeo, ledGlowMat);
    glow.position.set(side * (FLAT - 0.03), (LED_Y0 + LED_Y1) / 2, CORE_FRONT + 0.0025);
    if (side < 0) glow.rotation.y = Math.PI;
    const pulseGlow = new THREE.Mesh(glowGeo, ledPulseGlowMat);
    pulseGlow.position.copy(glow.position).setZ(CORE_FRONT + 0.003);
    pulseGlow.rotation.y = glow.rotation.y;
    [pipe, pulse, glow, pulseGlow].forEach((part) => (part.raycast = runtime.core.noRaycast));
    led.add(pipe, pulse, glow, pulseGlow);
  });
  // The LED's glow on the shelf round the console, blue in standby and brighter once it boots
  const consoleLight = runtime.room.neonLight("#4f6bff", 0.6, () => (0.4 + 0.6 * runtime.core.roomLight.night) * (1 + ledPulseMat.opacity), { distance: 1.8, tint: ledMat });
  consoleLight.position.set(0, PS_H * 0.5, PS_D * 0.45 + 0.2);
  led.add(consoleLight);
  consoleBody.add(led);
  // Click: a quick bright run up the light. Boot: two blue pulses run up it, then it comes on
  // in the console's working colour and the glow swells
  const LED_ON = "#8fdcff";
  const ledColors = [ledMat.color, ledGlowMat.color];
  // `at` slides the band along the light (0.6 below its foot, -0.6 past its top)
  const ledSweep = { at: 0.6, power: 0 };
  const applySweep = () => {
    ledPulseTex.offset.x = ledPulseGlowTex.offset.y = ledSweep.at;
    ledPulseMat.opacity = ledSweep.power;
    ledPulseGlowMat.opacity = ledSweep.power * 0.8;
  };
  function runLedPulse(times, duration) {
    gsap.killTweensOf(ledSweep);
    gsap.fromTo(ledSweep, { at: 0.6 }, { at: -0.6, duration, ease: "power1.inOut", repeat: times - 1, onUpdate: applySweep });
    gsap.fromTo(ledSweep, { power: 0 }, { keyframes: [{ power: 1, duration: duration * 0.25 }, { power: 1, duration: duration * (times - 0.5) }, { power: 0, duration: duration * 0.25 }], onUpdate: applySweep });
  }
  function blinkLed() {
    if (!gsap.isTweening(ledSweep)) runLedPulse(1, 0.45);
  }
  function bootLed() {
    runLedPulse(2, 0.55);
    gsap.killTweensOf([...ledColors, ledGlowMat]);
    const on = new THREE.Color(LED_ON);
    ledColors.forEach((color) => gsap.to(color, { r: on.r, g: on.g, b: on.b, duration: 0.5, delay: 0.9, ease: "power1.out" }));
    gsap.fromTo(ledGlowMat, { opacity: 0.55 }, { keyframes: [{ opacity: 1, duration: 0.3, delay: 0.9, ease: "power2.out" }, { opacity: 0.75, duration: 0.6, ease: "sine.inOut" }] });
  }
  // PlayStation logo, small, near the top front of the left panel
  const psLogo = runtime.core.printed(0.06, 0.06, 1200, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = "#3a3f48";
    c.lineWidth = w * 0.09;
    c.lineCap = "round";
    c.lineJoin = "round";
    const px = w * 0.38;
    c.beginPath();
    c.moveTo(px, h * 0.7);
    c.lineTo(px, h * 0.18);
    c.bezierCurveTo(w * 0.75, h * 0.16, w * 0.75, h * 0.44, px, h * 0.45);
    c.stroke();
    c.beginPath();
    c.moveTo(px, h * 0.64);
    c.bezierCurveTo(w * 0.68, h * 0.6, w * 0.76, h * 0.72, w * 0.58, h * 0.8);
    c.bezierCurveTo(w * 0.36, h * 0.88, w * 0.46, h * 0.94, w * 0.7, h * 0.9);
    c.stroke();
  });
  psLogo.material.transparent = true;
  psLogo.material.alphaTest = 0.05;
  psLogo.rotation.y = -Math.PI / 2;
  psLogo.position.set(-(CORE_T / 2 + PANEL_T + 0.022), PS_H * 0.86, PS_D * 0.3);
  consoleBody.add(psLogo);
  // Calibrate the finished shell (including bevels/fins) to 89 × 388 × 216 mm.
  // The shelf's 2× scale makes one local unit 20 cm.
  const consoleSize = new THREE.Box3().setFromObject(consoleBody, true).getSize(new THREE.Vector3());
  consoleBody.scale.set(0.445 / consoleSize.x, 1.94 / consoleSize.y, 1.08 / consoleSize.z);
  consoleBody.position.y = 0.067;
  // Its round foot: a brushed silver disc with a dark rim
  const psFoot = runtime.shelf.group(
    runtime.core.at(runtime.core.mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.035, 36), runtime.core.toon("#2a2d33"), { outline: 0.012 }), 0, 0.0175, 0),
    runtime.core.at(runtime.core.mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.02, 36), runtime.core.toon("#c9ced6"), { outline: 0 }), 0, 0.045, 0),
  );
  psFoot.scale.z = 1.6;
  const ps5 = runtime.shelf.addItem(runtime.core.at(runtime.shelf.group(psFoot, consoleBody), -0.7, runtime.shelf.standOn(2), 0.05), "console");
  // Turned three-quarters on to the room, so its white side shows as well as its front
  ps5.rotation.y = -0.5;
  const padFinish = canvasTexture(128, 128);
  runtime.core.track(padFinish.texture);
  drawSatinFinish(padFinish.ctx, 128, 128, { grain: 0.06 });
  padFinish.texture.wrapS = padFinish.texture.wrapT = THREE.RepeatWrapping;
  padFinish.texture.repeat.set(4, 4);
  const darkPadFinish = canvasTexture(128, 128);
  runtime.core.track(darkPadFinish.texture);
  drawSatinFinish(darkPadFinish.ctx, 128, 128, { grain: 0.018 });
  // Keep the charcoal shell readable without changing the controller geometry.
  darkPadFinish.ctx.fillStyle = "rgba(255,255,255,0.78)";
  darkPadFinish.ctx.fillRect(0, 0, 128, 128);
  darkPadFinish.texture.wrapS = darkPadFinish.texture.wrapT = THREE.RepeatWrapping;
  darkPadFinish.texture.repeat.set(4, 4);
  const controller = (color) => {
    // One continuous silhouette, with tapered grips instead of overlapping blocks.
    const outline = new THREE.Shape();
    outline.moveTo(-0.4, 0.23);
    outline.quadraticCurveTo(-0.5, 0.26, -0.54, 0.08);
    outline.bezierCurveTo(-0.58, -0.05, -0.64, -0.34, -0.51, -0.37);
    outline.quadraticCurveTo(-0.43, -0.4, -0.29, -0.18);
    outline.quadraticCurveTo(-0.23, -0.11, -0.16, -0.13);
    outline.lineTo(0.16, -0.13);
    outline.quadraticCurveTo(0.23, -0.11, 0.29, -0.18);
    outline.quadraticCurveTo(0.43, -0.4, 0.51, -0.37);
    outline.bezierCurveTo(0.64, -0.34, 0.58, -0.05, 0.54, 0.08);
    outline.quadraticCurveTo(0.5, 0.26, 0.4, 0.23);
    outline.closePath();
    const bodyGeo = new THREE.ExtrudeGeometry(outline, { depth: 0.12, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 3, curveSegments: 16, steps: 1 });
    bodyGeo.translate(0, 0, -0.06);
    bodyGeo.rotateX(-Math.PI / 2);
    const light = color === "#fffdf5";
    // The shell is lacquered like the katana sayas: the same colour and fine grain, without
    // the saya's gloss band (a round scabbard's reflection, out of place on a flat pad)
    const lacquer = canvasTexture(1024, 128);
    runtime.core.track(lacquer.texture);
    drawSayaLacquer(lacquer.ctx, 1024, 128, { color: light ? color : "#141414", sheen: false });
    lacquer.texture.wrapS = lacquer.texture.wrapT = THREE.RepeatWrapping;
    const body = runtime.core.toon("#ffffff");
    body.map = lacquer.texture;
    if (!light) {
      body.emissive.set("#303030");
      body.emissiveIntensity = 0.04;
    }
    const pad = runtime.shelf.group(runtime.core.mesh(bodyGeo, body, { outline: 0.016 }));
    const seamMat = runtime.core.toon(light ? "#a6adb5" : "#2a2a2a");
    const seamGeo = bodyGeo.clone();
    seamGeo.scale(1.012, 0.055, 1.012);
    pad.add(runtime.core.mesh(seamGeo, seamMat, { outline: 0, cast: false }));
    // Modern-gamepad layout (as in the reference): offset sticks, the left one up top beside a
    // d-pad below; colour-coded face buttons; a round home button and three small ones between
    const TOP = 0.087;
    const controlPlastic = runtime.core.toon(light ? "#43474e" : "#202020");
    controlPlastic.map = light ? padFinish.texture : darkPadFinish.texture;
    const screwSlot = runtime.core.toon(light ? "#535860" : "#8b929c");
    // Small casing screws sit in the continuous moulded-plastic shell.
    [-1, 1].forEach((side) => {
      const screw = runtime.core.mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.005, 12), seamMat, { outline: 0, cast: false });
      screw.position.set(side * 0.27, TOP, 0.16);
      const slot = runtime.core.mesh(new THREE.BoxGeometry(0.018, 0.002, 0.003), screwSlot, { outline: 0, cast: false });
      slot.position.set(side * 0.27, TOP + 0.0035, 0.16);
      pad.add(screw, slot);
    });
    // Sticks and d-pad in a contrasting grey on each pad, so they read at shelf distance
    const knob = runtime.core.toon(light ? "#43474e" : "#303030");
    if (light) knob.map = padFinish.texture;
    else {
      knob.emissive.set("#383838");
      knob.emissiveIntensity = 0.06;
    }
    const well = runtime.core.toon(light ? "#9aa1ab" : "#0c0c0c");
    const stick = (x, z) => {
      pad.add(runtime.core.at(runtime.core.mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.01, 28), well, { outline: 0 }), x, TOP + 0.004, z));
      pad.add(runtime.core.at(runtime.core.mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.05, 16), knob, { outline: light ? 0.006 : 0 }), x, TOP + 0.03, z));
      pad.add(runtime.core.at(runtime.core.mesh(new THREE.CylinderGeometry(0.068, 0.066, 0.026, 28), knob, { outline: light ? 0.012 : 0 }), x, TOP + 0.062, z));
      const rim = runtime.core.mesh(new THREE.TorusGeometry(0.056, 0.012, 8, 28), runtime.core.toon(light ? "#2a2d32" : "#484848"), { outline: 0 });
      rim.rotation.x = Math.PI / 2;
      pad.add(runtime.core.at(rim, x, TOP + 0.076, z));
      const thumb = runtime.core.mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.003, 24), controlPlastic, { outline: 0, cast: false });
      pad.add(runtime.core.at(thumb, x, TOP + 0.076, z));
      const ribGeo = new THREE.BoxGeometry(0.008, 0.004, 0.013);
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6;
        const rib = runtime.core.mesh(ribGeo, knob, { outline: 0, cast: false });
        rib.position.set(x + Math.sin(angle) * 0.059, TOP + 0.087, z + Math.cos(angle) * 0.059);
        rib.rotation.y = angle;
        pad.add(rib);
      }
    };
    stick(-0.3, -0.04);
    stick(0.14, 0.11);
    // d-pad in its dish
    pad.add(runtime.core.at(runtime.core.mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.01, 28), well, { outline: 0 }), -0.14, TOP + 0.004, 0.11));
    pad.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.14, 0.03, 0.046, 0.01), knob, { outline: light ? 0.01 : 0 }), -0.14, TOP + 0.02, 0.11));
    pad.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.046, 0.03, 0.14, 0.01), knob, { outline: light ? 0.01 : 0 }), -0.14, TOP + 0.02, 0.11));
    // face buttons: caps in their colours with the letter in dark ink, big enough to read
    [[0, -0.075, "Y", "#ffd400"], [0.075, 0, "B", "#ef3b3b"], [0, 0.075, "A", "#3fbf4f"], [-0.075, 0, "X", "#2f7cf6"]].forEach(([dx, dz, letter, cap]) => {
      pad.add(runtime.core.at(runtime.core.mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.03, 20), runtime.core.toon(light ? cap : "#101010"), { outline: light ? 0.01 : 0 }), 0.3 + dx, TOP + 0.015, -0.04 + dz));
      const label = runtime.core.printed(0.06, 0.06, 1200, (c, w, h) => {
        c.clearRect(0, 0, w, h);
        c.fillStyle = light ? "#1a1714" : cap;
        c.font = `800 ${w * (light ? 0.62 : 0.82)}px 'Space Grotesk', sans-serif`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(letter, w / 2, h * 0.55);
      });
      if (!light) label.material = runtime.core.track(new THREE.MeshBasicMaterial({ map: label.material.map, transparent: true }));
      label.material.transparent = true;
      label.material.alphaTest = 0.1;
      label.rotation.x = -Math.PI / 2;
      label.position.set(0.3 + dx, TOP + 0.031, -0.04 + dz);
      pad.add(label);
    });
    // home button: a round cap with a plain glowing ring (no brand mark)
    pad.add(runtime.core.at(runtime.core.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 24), runtime.core.toon(light ? "#2b2e33" : "#3a3e45"), { outline: light ? 0.01 : 0 }), 0, TOP + 0.01, -0.15));
    const glow = runtime.core.mesh(new THREE.TorusGeometry(0.028, 0.008, 6, 24), runtime.core.track(new THREE.MeshBasicMaterial({ color: "#f4f6f8" })), { outline: 0 });
    glow.rotation.x = Math.PI / 2;
    pad.add(runtime.core.at(glow, 0, TOP + 0.022, -0.15));
    // view, menu and share
    const small = runtime.core.toon(light ? "#2b2e33" : "#5a5f68");
    [-0.075, 0.075].forEach((x) => pad.add(runtime.core.at(runtime.core.mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.016, 16), small, { outline: light ? 0.008 : 0 }), x, TOP + 0.008, -0.05)));
    pad.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.054, 0.016, 0.028, 0.008), small, { outline: light ? 0.008 : 0 }), 0, TOP + 0.008, 0.0));
    // bumpers along the top edge, the body's colour
    [-0.34, 0.34].forEach((x) => {
      const bumper = runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.26, 0.07, 0.08, 0.03), controlPlastic, { outline: light ? 0.008 : 0 }), x, 0.02, -0.235);
      bumper.rotation.y = -Math.sign(x) * 0.18;
      pad.add(bumper);
    });
    return pad;
  };
  // A compact white pedestal: oval foot, a narrow rear spine and flared front saddles.
  // Each saddle fits into the controller's central arch, leaving the grips unobstructed.
  const PAD_TILT = 1.05;
  const holderMat = runtime.core.toon("#fffdf5");
  const baseShape = new THREE.Shape();
  baseShape.absellipse(0, 0, 0.43, 0.32, 0, Math.PI * 2, false, 0);
  const baseGeo = new THREE.ExtrudeGeometry(baseShape, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 32 });
  baseGeo.rotateX(-Math.PI / 2);
  baseGeo.translate(0, 0.008, 0);
  const holder = runtime.shelf.group(
    runtime.core.mesh(baseGeo, holderMat, { outline: 0.008 }),
    runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.14, 0.88, 0.075, 0.03), holderMat, { outline: 0 }), 0, 0.49, -0.32),
  );
  const TIER_Y = [0.37, 1.05];
  TIER_Y.forEach((y, i) => {
    const footY = i === 0 ? 0.055 : TIER_Y[0] + 0.28;
    const top = y + 0.035; // Meets the raised controller's central underside.
    const profile = new THREE.Shape();
    const footHalf = i === 0 ? 0.22 : 0.09;
    profile.moveTo(-footHalf, footY);
    profile.bezierCurveTo(-0.09, footY + 0.02, -0.065, top - 0.19, -0.105, top - 0.12);
    profile.lineTo(-0.17, top - 0.035);
    profile.quadraticCurveTo(-0.19, top, -0.14, top);
    profile.lineTo(0.14, top);
    profile.quadraticCurveTo(0.19, top, 0.17, top - 0.035);
    profile.lineTo(0.105, top - 0.12);
    profile.bezierCurveTo(0.065, top - 0.19, 0.09, footY + 0.02, footHalf, footY);
    profile.closePath();
    const saddleGeo = new THREE.ExtrudeGeometry(profile, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018, bevelSegments: 3, curveSegments: 18 });
    saddleGeo.translate(0, 0, 0.16);
    if (i === 1) {
      // A continuous stem stays behind the lower shell before curving forward above it.
      const points = saddleGeo.attributes.position;
      const normals = saddleGeo.attributes.normal;
      const normal = new THREE.Vector3();
      for (let vertex = 0; vertex < points.count; vertex++) {
        const bendY = TIER_Y[0] + 0.43;
        const t = THREE.MathUtils.clamp((points.getY(vertex) - bendY) / (top - bendY), 0, 1);
        const bend = t * t * (3 - 2 * t);
        points.setZ(vertex, points.getZ(vertex) - (1 - bend) * 0.48);
        // Transform the original smooth normals with the bend, avoiding diagonal cap seams.
        const slope = 0.48 * 6 * t * (1 - t) / (top - bendY);
        normal.fromBufferAttribute(normals, vertex);
        normal.y -= slope * normal.z;
        normal.normalize();
        normals.setXYZ(vertex, normal.x, normal.y, normal.z);
      }
    }
    holder.add(runtime.core.mesh(saddleGeo, holderMat, { outline: i === 0 ? 0.006 : 0 }));
    // A shallow cradle joins the sculpted front to the rear spine, under the pad body.
    holder.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.22, 0.055, 0.36, 0.024), holderMat, { outline: 0 }), 0, top - 0.065, 0.035));
  });
  holder.position.set(0.65, runtime.shelf.standOn(2), 0.12);
  runtime.shelf.shelf.add(holder);
  const padOnStand = (color, y) => {
    const pad = controller(color);
    const padSize = new THREE.Box3().setFromObject(pad, true).getSize(new THREE.Vector3());
    pad.scale.set(0.8 / padSize.x, 0.3 / padSize.y, 0.53 / padSize.z);
    pad.rotation.x = PAD_TILT;
    pad.position.set(0, y + 0.12, 0.04);
    const item = runtime.shelf.addItem(runtime.core.at(runtime.shelf.group(pad), holder.position.x, runtime.shelf.standOn(2), holder.position.z), "controller");
    pad.userData.restY = pad.position.y;
    item.userData.moves = pad;
    return item;
  };
  const pad1 = padOnStand("#1a1714", TIER_Y[1]);
  const pad2 = padOnStand("#fffdf5", TIER_Y[0]);

  // Public state used by the other scene parts.
  return {
    holder,
    PALETTE,
    black,
    led,
    pad1,
    pad2,
    ledMat,
    ledGlowMat,
    ledSweep,
    blinkLed,
    bootLed,
    ps5,
  };
}
