import * as THREE from "three";
import gsap from "gsap";
import { hoverSound, sfx, GROOVE_BEAT, setRainLevel, initializeAudio } from "@/shared/composables/useSfx";
import { canvasTexture, drawTerminal, drawWoodTop, drawBrushedMetal, drawSayaLacquer, drawStudioTop, drawVentSlots, drawPowerScreen } from "../textures";
import { createDesktop, SCREEN_W, SCREEN_H } from "../desktop";
import { createLofi, TRACKS } from "../lofi";
import { PALETTES } from "../sceneConfig";
import { DEFAULT_WOODS, SPEAKER_FINISHES } from "../woods";

export function createWorkstation(runtime) {
  // ---------- monitor riser: a wooden shelf the monitor and speakers stand on ----------
  // One board of the desk's own grain on two slab legs, the same wood as the top so it reads as
  // part of the desk, deep enough for the speakers and the monitor's foot
  const RISER_TOP = 0.8;
  const RISER_BOARD = 0.14;
  const RISER_LEG_SHADE = 0.62;
  // Its own print of the grain (not a clone of the desk's), so it can take a different wood
  const riserGrain = canvasTexture(1400, 840);
  drawWoodTop(riserGrain.ctx, 1400, 840, DEFAULT_WOODS.riser);
  const riserWood = riserGrain.texture;
  riserWood.wrapS = riserWood.wrapT = THREE.RepeatWrapping;
  // the grain at the desk's scale: its share of the desk's length, and one of its five boards
  // Just long enough for the monitor and the speakers either side of it, ending a centimetre past them
  const RISER_W = 9.9;
  riserWood.repeat.set(RISER_W / 16, 0.2);
  riserWood.offset.set(0.2, 0.4);
  riserWood.needsUpdate = true;
  runtime.core.track(riserWood);
  const riserMat = runtime.core.toon(PALETTES.light.desk);
  riserMat.map = riserWood;
  const riser = new THREE.Group();
  // Centred on the 160 cm desk (x −9 to 7), with everything on it
  riser.position.set(-1, 0, -3.1);
  runtime.core.scene.add(riser);
  const riserTop = runtime.core.mesh(runtime.core.rbox(RISER_W, RISER_BOARD, 2.4, 0.05), riserMat, { outline: 0.025 });
  riserTop.position.y = RISER_TOP - RISER_BOARD / 2;
  riser.add(riserTop);
  // The legs in a deeper shade of the same grain, set in from the ends under an overhang, so
  // they stand apart from the desk top they rest on
  const riserLegMat = runtime.core.toon(PALETTES.light.desk);
  riserLegMat.color.multiplyScalar(RISER_LEG_SHADE);
  riserLegMat.map = riserWood;
  [-(RISER_W / 2 - 0.5), RISER_W / 2 - 0.5].forEach((x) => {
    // A thinner outline keeps the short wooden legs readable at their original height.
    const leg = runtime.core.mesh(runtime.core.rbox(0.36, RISER_TOP - RISER_BOARD, 2.1, 0.04), riserLegMat, { outline: 0.018 });
    leg.position.set(x, (RISER_TOP - RISER_BOARD) / 2, 0);
    riser.add(leg);
  });

  // ---------- monitor + terminal ----------
  const monitor = new THREE.Group();
  const MONITOR_SCALE = 62.3 / 42.4;
  monitor.scale.setScalar(MONITOR_SCALE);
  monitor.position.set(-1, RISER_TOP, -2.9);
  runtime.core.scene.add(monitor);
  // Studio Display XDR: a thin silver aluminium slab with an even black glass border all round
  // (no chin), on a stand folded from one aluminium sheet, the foot running forward under it
  const brushed = canvasTexture(128, 128);
  runtime.core.track(brushed.texture);
  drawBrushedMetal(brushed.ctx, 128, 128);
  // Soften the existing grain so it reads as a finish rather than broad painted stripes.
  brushed.ctx.fillStyle = "rgba(255,255,255,0.82)";
  brushed.ctx.fillRect(0, 0, 128, 128);
  brushed.texture.wrapS = brushed.texture.wrapT = THREE.RepeatWrapping;
  brushed.texture.repeat.set(2, 3);
  brushed.texture.needsUpdate = true;
  // One silver for the display, its stand and the Mac mini, so the three read as one set
  const SILVER = "#dcdee0";
  const aluminium = runtime.core.toon("#c8cbce");
  aluminium.map = brushed.texture;
  // Modelled at 4.24 units wide, then uniformly scaled to a real 62.3 cm display.
  // All scene dimensions use 10 cm/unit. The screen itself keeps the desktop's
  // 5:3, so the body stands a little taller than the real 16:9 one.
  const SCREEN_Y = 2.13;
  // The stand's side profile (z forward, y up) as a centre line: the foot plate back from its
  // front lip, a rounded fold at its rear, and the arm rising forward to the hinge behind the
  // panel. The sheet is that line thickened, extruded across the stand's width.
  // Stand proportions are modelled locally, then scaled together with the 62.3 cm panel:
  // a foot about 1.1 deep and under a third of the panel's width
  const STAND_W = 1.2;
  const STAND_T = 0.045;
  const FOLD_R = 0.14;
  const armTop = new THREE.Vector2(-0.28, SCREEN_Y - 0.33);
  const standLine = [new THREE.Vector2(0.26, STAND_T / 2), new THREE.Vector2(-0.62, STAND_T / 2)];
  const foldCentre = new THREE.Vector2(-0.62, STAND_T / 2 + FOLD_R);
  const armAngle = Math.atan2(armTop.y - foldCentre.y, armTop.x - foldCentre.x);
  for (let i = 1; i <= 12; i++) {
    const a = Math.PI + (armAngle - Math.PI) * (i / 12);
    standLine.push(new THREE.Vector2(foldCentre.x - FOLD_R * Math.sin(a), foldCentre.y + FOLD_R * Math.cos(a)));
  }
  standLine.push(armTop);
  const sideA = [];
  const sideB = [];
  standLine.forEach((p, i) => {
    const prev = standLine[Math.max(0, i - 1)];
    const next = standLine[Math.min(standLine.length - 1, i + 1)];
    const t = next.clone().sub(prev).normalize();
    const n = new THREE.Vector2(-t.y, t.x).multiplyScalar(STAND_T / 2);
    sideA.push(p.clone().add(n));
    sideB.push(p.clone().sub(n));
  });
  const standShape = new THREE.Shape([...sideA, ...sideB.reverse()]);
  const standGeo = new THREE.ExtrudeGeometry(standShape, {
    depth: STAND_W - 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 2,
  });
  // shape x runs along z, its extrusion across x
  standGeo.rotateY(-Math.PI / 2);
  standGeo.translate((STAND_W - 0.02) / 2, 0, 0);
  // The stand sits in the panel's shadow and its sheet is a few units long, where the shared
  // grain would read as broad stripes: a finer grain and a little glow of its own keep it the
  // same silver as the display and the Mac mini
  const footMat = runtime.core.toon(SILVER);
  const standGrain = runtime.core.track(brushed.texture.clone());
  standGrain.repeat.set(8, 12);
  standGrain.needsUpdate = true;
  footMat.map = standGrain;
  footMat.emissive.set(SILVER);
  footMat.emissiveIntensity = 0.12;
  const stand = runtime.core.mesh(standGeo, footMat, { outline: 0.015 });
  // A thin dark rubber pad under the foot, and the hinge block the arm meets on the back
  const hingeMat = runtime.core.toon("#1c1d21");
  const footPad = runtime.core.mesh(runtime.core.rbox(STAND_W - 0.12, 0.01, 0.78, 0.004), hingeMat, { outline: 0, cast: false });
  footPad.position.set(0, -0.003, -0.18);
  const mount = runtime.core.mesh(runtime.core.rbox(0.86, 0.5, 0.16, 0.05), aluminium, { outline: 0.012 });
  mount.position.set(0, armTop.y + 0.08, -0.2);
  monitor.add(stand, footPad, mount);
  // The screen runs from x -2.0 to 2.0 and 1.2 either side of SCREEN_Y; the black glass border
  // is 0.08 round it and the aluminium shows only as a hairline rim. Seen from above, the
  // body's top face thickens the top edge and its bottom rim hides, so the bottom border is a
  // little deeper and the aluminium below it deeper still
  const CHIN = 0.035;
  const RIM = 0.03;
  const silverMat = runtime.core.toon(SILVER);
  silverMat.map = brushed.texture;
  const body = runtime.core.mesh(runtime.core.rbox(4.24, 2.62 + CHIN + RIM, 0.2, 0.06), silverMat, { outline: 0.03 });
  body.position.set(0, SCREEN_Y - (CHIN + RIM) / 2, -0.03);
  const bezel = runtime.core.mesh(runtime.core.rbox(4.18, 2.56 + CHIN, 0.02, 0.045), runtime.core.toon("#0d0e10"), { outline: 0, cast: false });
  bezel.position.set(0, SCREEN_Y - CHIN / 2, 0.075);
  monitor.add(body, bezel);
  // The details: a thin black border round the panel and the camera in the top border
  // between the bezel's face (z 0.085) and the screen (z 0.09)
  const panelEdge = runtime.core.mesh(runtime.core.rbox(4.08, 2.44, 0.006, 0.002), runtime.core.toon("#1a1714"), { outline: 0, cast: false });
  panelEdge.position.set(0, SCREEN_Y, 0.084);
  // in the strip of border above the panel
  const webcam = new THREE.Mesh(runtime.core.track(new THREE.CircleGeometry(0.018, 16)), runtime.core.track(new THREE.MeshBasicMaterial({ color: "#23262c" })));
  webcam.position.set(0, SCREEN_Y + 1.242, 0.087);
  const webcamLens = new THREE.Mesh(runtime.core.track(new THREE.CircleGeometry(0.008, 12)), runtime.core.track(new THREE.MeshBasicMaterial({ color: "#3d5a8c" })));
  webcamLens.position.set(0, SCREEN_Y + 1.242, 0.088);
  [panelEdge, webcam, webcamLens].forEach((part) => (part.raycast = runtime.core.noRaycast));
  monitor.add(panelEdge, webcam, webcamLens);

  // ---------- Mac mini: on the riser, right of the display's foot ----------
  // The M4 Mac mini, 12.7 × 12.7 × 5.0 cm in the same brushed silver as the display: a low square
  // block with rounded corners and softly eased edges, a dark apple on its top, on a dark round
  // foot with vents round it. Two USB-C ports and the headphone jack on its front, left of
  // centre, the status light at its right; power, ethernet, HDMI and three USB-C on the back.
  // Modelled 1.2 units across and scaled uniformly to its real size.
  const MINI_W = 1.2;
  const MINI_LIFT = 0.03;
  const MINI_H = MINI_W * 5.0 / 12.7 - MINI_LIFT;
  const MINI_SCALE = 1.27 / MINI_W;
  const macMini = new THREE.Group();
  macMini.scale.setScalar(MINI_SCALE);
  // under the screen's right half, midway between the stand's foot and the right speaker
  macMini.position.set(1.15, RISER_TOP, -3.1);
  macMini.rotation.y = -0.1;
  runtime.core.scene.add(macMini);
  const miniBevel = 0.03;
  const MINI_LID = MINI_W - 2 * miniBevel;
  const miniGeo = new THREE.ExtrudeGeometry(runtime.core.roundedRectShape(MINI_LID, MINI_LID, 0.15 - miniBevel), {
    depth: MINI_H - 2 * miniBevel, bevelEnabled: true, bevelThickness: miniBevel, bevelSize: miniBevel, bevelSegments: 4, curveSegments: 12,
  });
  // stood up: its extrusion runs up y, from the foot's top (the shape's +y to the back)
  miniGeo.rotateX(-Math.PI / 2);
  miniGeo.translate(0, MINI_LIFT + miniBevel, 0);
  const miniMat = runtime.core.toon(SILVER);
  miniMat.map = brushed.texture;
  // the lids take the shape's own coordinates as uv, so the top print is stretched over the lid
  const miniTop = canvasTexture(512, 512);
  runtime.core.track(miniTop.texture);
  drawStudioTop(miniTop.ctx, 512, 512, { logo: 0.24 });
  miniTop.texture.repeat.set(1 / MINI_LID, 1 / MINI_LID);
  miniTop.texture.offset.set(0.5, 0.5);
  miniTop.texture.needsUpdate = true;
  const miniTopMat = runtime.core.toon("#ffffff");
  miniTopMat.map = miniTop.texture;
  const miniBody = runtime.core.mesh(miniGeo, [miniTopMat, miniMat], { outline: 0.018 });
  // the round foot's wall takes its way round along u and the height up v: one slot row round it
  const vents = canvasTexture(64, 16);
  runtime.core.track(vents.texture);
  drawVentSlots(vents.ctx, 64, 16);
  vents.texture.wrapS = vents.texture.wrapT = THREE.RepeatWrapping;
  vents.texture.repeat.set(20, 1);
  vents.texture.needsUpdate = true;
  const ventMat = runtime.core.toon("#ffffff");
  ventMat.map = vents.texture;
  const footMatDark = runtime.core.toon("#1e2024");
  const miniFoot = runtime.core.mesh(new THREE.CylinderGeometry(0.45, 0.42, MINI_LIFT, 40, 1, true), ventMat, { outline: 0.005 });
  miniFoot.position.y = MINI_LIFT / 2;
  const miniFootPad = runtime.core.mesh(new THREE.CircleGeometry(0.42, 40).rotateX(-Math.PI / 2), footMatDark, { outline: 0, cast: false });
  miniFootPad.position.y = 0.001;
  macMini.add(miniBody, miniFoot, miniFootPad);
  // the front face is at z MINI_W / 2; the ports sit midway up it
  const MINI_FRONT = MINI_W / 2 + 0.002;
  const PORT_Y = MINI_LIFT + MINI_H / 2;
  const portMat = runtime.core.toon("#121316");
  const portTongue = runtime.core.toon("#3b3f46");
  const portChamfer = runtime.core.toon("#a7abb1");
  // a USB-C port on either face: a bright chamfered rim round a dark slot with its tongue
  const usbC = (x, y, z, facing) => {
    const port = new THREE.Group();
    port.position.set(x, y, z);
    port.rotation.y = facing;
    const rim = runtime.core.mesh(runtime.core.rbox(0.024, 0.06, 0.006, 0.01), portChamfer, { outline: 0, cast: false });
    const slot = runtime.core.mesh(runtime.core.rbox(0.016, 0.052, 0.01, 0.006), portMat, { outline: 0, cast: false });
    slot.position.z = 0.001;
    const tongue = runtime.core.mesh(new THREE.BoxGeometry(0.006, 0.04, 0.004), portTongue, { outline: 0, cast: false });
    tongue.position.z = 0.005;
    port.add(rim, slot, tongue);
    port.traverse((o) => (o.raycast = runtime.core.noRaycast));
    macMini.add(port);
  };
  [-0.3, -0.2].forEach((x) => usbC(x, PORT_Y, MINI_FRONT, 0));
  // the headphone jack beside them: a round dark hole in a bright ring
  const jackRim = new THREE.Mesh(runtime.core.track(new THREE.RingGeometry(0.018, 0.026, 24)), portChamfer);
  jackRim.position.set(-0.1, PORT_Y, MINI_FRONT + 0.001);
  const frontJack = new THREE.Mesh(runtime.core.track(new THREE.CircleGeometry(0.018, 24)), portMat);
  frontJack.position.set(-0.1, PORT_Y, MINI_FRONT + 0.001);
  // the status light, a small dot near the front's right corner
  const LED_X = 0.42;
  const LED_Y = PORT_Y;
  const miniLedMat = runtime.core.track(new THREE.MeshBasicMaterial({ color: "#22c55e" }));
  const miniLed = new THREE.Mesh(runtime.core.track(new THREE.CircleGeometry(0.006, 16)), miniLedMat);
  miniLed.position.set(LED_X, LED_Y, MINI_FRONT + 0.002);
  const miniLedRim = new THREE.Mesh(runtime.core.track(new THREE.RingGeometry(0.006, 0.008, 20)), portChamfer);
  miniLedRim.position.set(LED_X, LED_Y, MINI_FRONT + 0.001);
  const miniLedHaloMat = runtime.core.track(new THREE.MeshBasicMaterial({ color: "#22c55e", transparent: true, opacity: 0.65, depthWrite: false }));
  const miniLedHalo = new THREE.Mesh(runtime.core.track(new THREE.CircleGeometry(0.02, 16)), miniLedHaloMat);
  miniLedHalo.position.set(LED_X, LED_Y, MINI_FRONT + 0.0015);
  [jackRim, frontJack, miniLed, miniLedRim, miniLedHalo].forEach((part) => (part.raycast = runtime.core.noRaycast));
  macMini.add(jackRim, frontJack, miniLed, miniLedRim, miniLedHalo);
  // the back, seen from behind (so its x runs the other way): power, ethernet, HDMI and three
  // USB-C in a row midway up
  const MINI_BACK = -MINI_W / 2 - 0.002;
  const BACK_Y = PORT_Y;
  const power = runtime.core.mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.008, 28), portMat, { outline: 0, cast: false });
  power.rotation.x = Math.PI / 2;
  power.position.set(0.42, BACK_Y, MINI_BACK);
  const ethernet = runtime.core.mesh(runtime.core.rbox(0.11, 0.08, 0.008, 0.008), portMat, { outline: 0, cast: false });
  ethernet.position.set(0.26, BACK_Y, MINI_BACK);
  const hdmi = runtime.core.mesh(runtime.core.rbox(0.1, 0.035, 0.008, 0.006), portMat, { outline: 0, cast: false });
  hdmi.position.set(0.11, BACK_Y, MINI_BACK);
  [power, ethernet, hdmi].forEach((part) => (part.raycast = runtime.core.noRaycast));
  macMini.add(power, ethernet, hdmi);
  [-0.06, -0.15, -0.24].forEach((x) => usbC(x, BACK_Y, MINI_BACK, Math.PI));
  runtime.core.register(macMini, {
    onHover: (on) => {
      gsap.to(macMini.position, { y: RISER_TOP + (on ? 0.06 : 0), duration: 0.25, ease: "power2.out", overwrite: true });
      gsap.to(miniLed.scale, { x: on ? 1.4 : 1, y: on ? 1.4 : 1, duration: 0.25, overwrite: true });
      gsap.to(miniLedHalo.scale, { x: on ? 1.4 : 1, y: on ? 1.4 : 1, duration: 0.25, overwrite: true });
      if (on) hoverSound(macMini, (s) => s.tick());
    },
    onClick: () => {
      gsap.fromTo(macMini.scale, { x: MINI_SCALE * 1.04, y: MINI_SCALE * 0.94, z: MINI_SCALE * 1.04 }, { x: MINI_SCALE, y: MINI_SCALE, z: MINI_SCALE, duration: 0.4, ease: "elastic.out(1.2, 0.4)" });
      toggleComputer();
    },
  });
  // Clamped task light: brushed graphite, rubber end caps and an inset opal lens,
  // all with the same stepped toon shading as the monitor.
  const lightbar = new THREE.Group();
  lightbar.name = "monitor-lightbar";
  lightbar.position.set(0, SCREEN_Y + 1.41, 0.2);
  monitor.add(lightbar);
  // 50 cm end cap to end cap, like a real screen bar, in the monitor's local units (it rides
  // the scaled monitor)
  const LIGHTBAR_W = 5.0 / MONITOR_SCALE;
  const lightbarMetal = runtime.core.toon("#454b55");
  lightbarMetal.map = brushed.texture;
  const lightbarRubber = runtime.core.toon("#20232a");
  const lightbarTrim = runtime.core.toon("#88919b");
  const lightbarBody = runtime.core.mesh(runtime.core.rbox(LIGHTBAR_W - 0.095, 0.105, 0.22, 0.014), lightbarMetal, { outline: 0.012 });
  lightbar.add(lightbarBody);
  [-1, 1].forEach((side) => {
    const cap = runtime.core.mesh(runtime.core.rbox(0.055, 0.108, 0.224, 0.012), lightbarRubber, { outline: 0.008 });
    cap.position.x = side * (LIGHTBAR_W / 2 - 0.0275);
    const collar = runtime.core.mesh(runtime.core.rbox(0.018, 0.106, 0.222, 0.008), lightbarTrim, { outline: 0 });
    collar.position.x = side * (LIGHTBAR_W / 2 - 0.0825);
    lightbar.add(cap, collar);
  });
  const lightbarClamp = runtime.core.mesh(runtime.core.rbox(0.34, 0.11, 0.4, 0.025), lightbarRubber, { outline: 0.015 });
  lightbarClamp.position.set(0, -0.065, -0.18);
  const lightbarCounterweight = runtime.core.mesh(runtime.core.rbox(0.32, 0.34, 0.14, 0.035), lightbarMetal, { outline: 0.015 });
  lightbarCounterweight.position.set(0, -0.2, -0.37);
  const lightbarPad = runtime.core.mesh(runtime.core.rbox(0.28, 0.045, 0.16, 0.01), lightbarRubber, { outline: 0 });
  lightbarPad.position.set(0, -0.13, -0.185);
  const lightbarButton = runtime.core.mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 16), lightbarRubber, { outline: 0.006 });
  lightbarButton.position.set(LIGHTBAR_W / 2 - 0.3575, 0.053, 0);
  const lightbarPowerMark = runtime.core.mesh(runtime.core.rbox(0.012, 0.003, 0.035, 0.002), lightbarTrim, { outline: 0, cast: false });
  lightbarPowerMark.position.set(LIGHTBAR_W / 2 - 0.3575, 0.065, 0);
  lightbar.add(lightbarClamp, lightbarCounterweight, lightbarPad, lightbarButton, lightbarPowerMark);
  // The lens sits inside a dark lip and throws light forward, away from the screen.
  const lightbarLip = runtime.core.mesh(runtime.core.rbox(LIGHTBAR_W - 0.325, 0.025, 0.13, 0.008), lightbarRubber, { outline: 0.005 });
  lightbarLip.position.set(0, -0.045, 0.055);
  lightbarLip.rotation.x = -0.35;
  const lightbarDiffuserMat = runtime.core.toon("#e4dac5");
  lightbarDiffuserMat.emissive.copy(runtime.lamp.lampLight.color);
  const lightbarDiffuser = runtime.core.mesh(runtime.core.rbox(LIGHTBAR_W - 0.465, 0.015, 0.095, 0.005), lightbarDiffuserMat, { outline: 0, cast: false });
  lightbarDiffuser.position.set(0, -0.062, 0.065);
  lightbarDiffuser.rotation.x = -0.35;
  lightbar.add(lightbarLip, lightbarDiffuser);
  for (let i = -6; i <= 6; i++) {
    const seam = runtime.core.mesh(runtime.core.rbox(0.012, 0.006, 0.087, 0.002), lightbarTrim, { outline: 0, cast: false });
    seam.position.set(i * 0.215, -0.071, 0.07);
    seam.rotation.x = -0.35;
    lightbar.add(seam);
  }
  // A screen bar's asymmetric optics light the desk in front of the display, from the
  // monitor's foot to about 60 cm out, and keep off the screen itself. Its emitter hangs some
  // 59 cm over the desk (the bar rides the full-size monitor, scaled with it), so the beam tips
  // 24° forward with a 28° half-cone, some 75 cm wide on the desk: the back of the cone just
  // reaches the foot, the front the desk's front edge. No decay, so it holds its strength down the
  // whole drop; the range (world units, 1.4 m) only has to outreach the desk's front corners.
  // three.js has no line light, so the diffuser's length is sampled at its centre and the middle
  // of either outer third; the wide cones overlap into one band. Only the centre one casts
  // shadows, so each prop keeps a single shadow and no shadow map is added.
  const LIGHTBAR_TILT = THREE.MathUtils.degToRad(24);
  const LIGHTBAR_SPREAD = (LIGHTBAR_W - 0.465) / 3;
  const lightbarLights = [-1, 0, 1].map((side) => {
    const light = new THREE.SpotLight(runtime.lamp.lampLight.color, 0, 14, THREE.MathUtils.degToRad(28), 0.5, 0);
    light.position.set(side * LIGHTBAR_SPREAD, -0.09, 0.14);
    light.target.position.set(side * LIGHTBAR_SPREAD, -0.09 - 4 * Math.cos(LIGHTBAR_TILT), 0.14 + 4 * Math.sin(LIGHTBAR_TILT));
    lightbar.add(light, light.target);
    return light;
  });
  const lightbarLight = lightbarLights[1];
  lightbarLight.shadow.mapSize.set(512, 512);
  lightbarLight.shadow.camera.near = 0.1;
  lightbarLight.shadow.bias = -0.0002;
  lightbarLight.shadow.normalBias = 0.02;
  lightbarLight.shadow.radius = 4;
  lightbar.traverse((part) => (part.raycast = runtime.core.noRaycast));
  lightbarBody.raycast = THREE.Mesh.prototype.raycast;
  lightbarButton.raycast = THREE.Mesh.prototype.raycast;
  // Like the lamp, the bar comes on for the night and goes off for the day (see setTheme), and
  // its button switches it at any hour
  let lightbarOn = false;
  const lightbarState = { power: 0 };
  function updateLightbar() {
    const power = lightbarState.power;
    lightbarLights.forEach((light) => {
      light.color.copy(runtime.lamp.lampLight.color);
      light.intensity = 3 * power;
    });
    lightbarLight.castShadow = power > 0.05;
    lightbarDiffuserMat.emissive.copy(runtime.lamp.lampLight.color);
    lightbarDiffuserMat.emissiveIntensity = 1.4 * power;
  }
  function setLightbar(on, duration = 0) {
    lightbarOn = on;
    if (typeof gsap === "undefined" || !duration) {
      lightbarState.power = on ? 1 : 0;
      updateLightbar();
      return;
    }
    gsap.killTweensOf(lightbarState);
    gsap.to(lightbarState, { power: on ? 1 : 0, duration, ease: "power2.out", onUpdate: updateLightbar });
  }
  function toggleLightbar() {
    if (typeof gsap !== "undefined") {
      gsap.fromTo(lightbarButton.position, { y: 0.043 }, { y: 0.053, duration: 0.14, ease: "power2.out" });
    }
    if (typeof sfx !== "undefined") sfx.click();
    setLightbar(!lightbarOn, 0.25);
  }
  // The monitor has the same cyan/pink bias strip. Broad rear-facing sources follow its
  // transform and overlap on the wall; they never paint over shadows with a glow plane.
  const monitorGlowMat = { opacity: 0 };
  [["#00e0c6", -1], ["#ff90e8", 1]].forEach(([color, x]) => {
    runtime.room.stripLight(color, () => 2 * monitorGlowMat.opacity / 0.7,
      [x, SCREEN_Y, -0.18], [x, SCREEN_Y, -2], monitor);
  });
  // Speakers either side of the monitor: click one to switch the sound on or off. The LED
  // shows the state (green: on, red: muted). Switching on drops a little groove: the cones pump
  // in time and notes float up out of them. Switching off, they slump with a tape-stop.
  const speakerLeds = [];
  const speakers = [];
  let soundMuted = runtime.options.muted;
  // Music notes: a small pool of sprites, printed once per glyph and colour
  const noteSprites = [["♪", "#ffdd00"], ["♫", "#ff90e8"], ["♪", "#00e0c6"], ["♫", "#7fb2ff"]].map(([glyph, color]) => {
    const tex = canvasTexture(128, 128);
    runtime.core.track(tex.texture);
    tex.ctx.font = "900 96px 'Segoe UI Symbol', 'Apple Symbols', sans-serif";
    tex.ctx.textAlign = "center";
    tex.ctx.textBaseline = "middle";
    tex.ctx.lineWidth = 12;
    tex.ctx.lineJoin = "round";
    tex.ctx.strokeStyle = "#000";
    tex.ctx.strokeText(glyph, 64, 68);
    tex.ctx.fillStyle = color;
    tex.ctx.fillText(glyph, 64, 68);
    return tex.texture;
  });
  const notePool = Array.from({ length: 14 }, (_, i) => {
    const sprite = new THREE.Sprite(runtime.core.track(new THREE.SpriteMaterial({ map: noteSprites[i % noteSprites.length], transparent: true, depthWrite: false })));
    sprite.visible = false;
    sprite.raycast = runtime.core.noRaycast;
    runtime.core.scene.add(sprite);
    return sprite;
  });
  let nextNote = 0;
  const notePoint = new THREE.Vector3();
  function floatNote(speaker) {
    const sprite = notePool[nextNote++ % notePool.length];
    speaker.woofer.getWorldPosition(notePoint);
    const side = Math.sign(speaker.group.position.x - monitor.position.x) || 1;
    gsap.killTweensOf([sprite.position, sprite.scale, sprite.material]);
    sprite.visible = true;
    sprite.position.copy(notePoint).add(new THREE.Vector3(0, 0.4, 0.35));
    sprite.material.opacity = 1;
    sprite.material.rotation = (Math.random() - 0.5) * 0.6;
    gsap.fromTo(sprite.scale, { x: 0.1, y: 0.1 }, { x: 0.6, y: 0.6, duration: 0.3, ease: "back.out(3)" });
    gsap.to(sprite.position, {
      y: notePoint.y + 2.2 + Math.random() * 0.8,
      x: notePoint.x + side * (0.4 + Math.random() * 0.6),
      duration: 1.6, ease: "power1.out",
    });
    gsap.to(sprite.material, { opacity: 0, delay: 1.0, duration: 0.6, onComplete: () => (sprite.visible = false) });
  }
  function pump(speaker, strength = 1) {
    gsap.fromTo(speaker.woofer.scale, { x: 1 + 0.04 * strength, z: 1 + 0.04 * strength }, { x: 1, z: 1, duration: 0.18, ease: "power2.out", overwrite: true });
    gsap.fromTo(speaker.dustCap.position, { z: speaker.dustCap.userData.restZ + 0.018 * strength }, { z: speaker.dustCap.userData.restZ, duration: 0.18, ease: "power2.out", overwrite: true });
    gsap.fromTo(speaker.group.scale, { x: 1.02, y: 0.98, z: 1.02 }, { x: 1, y: 1, z: 1, duration: 0.22, ease: "power2.out", overwrite: true });
  }
  // Edifier R1280DBs: 146 W × 234 H × 196 D mm. Wood-grain sides on a grey MDF box, a
  // dark front baffle (shown with its grille off, as in Edifier's photo): the 13 mm silk-dome
  // tweeter top left beside the flared bass port, the 4-inch woofer filling the lower half,
  // and four screws. The right one is the active speaker, with its
  // volume, treble and bass knobs on its outer side. No branding is printed. The side panels
  // follow the furniture wood; the black model stains them dark (set by the theme).
  const speakerGrain = canvasTexture(768, 512);
  runtime.core.track(speakerGrain.texture);
  drawWoodTop(speakerGrain.ctx, 768, 512, DEFAULT_WOODS.speakers);
  speakerGrain.texture.center.set(0.5, 0.5);
  speakerGrain.texture.rotation = Math.PI / 2;
  const speakerWoodMat = runtime.core.toon("#ffffff");
  speakerWoodMat.map = speakerGrain.texture;
  const speakerShellMat = runtime.core.toon(SPEAKER_FINISHES.wood.shell);
  const speakerBaffleMat = runtime.core.toon(SPEAKER_FINISHES.wood.baffle);
  const trimMat = runtime.core.toon("#8e9196");
  const wooferConeMat = runtime.core.toon("#6b6e72");
  const speakerRubberMat = runtime.core.toon("#141415");
  const speakerDomeMat = runtime.core.toon("#24252a");
  // The woofer cone's pressed concentric ripples over a faint weave, on the lathe's uv
  // (around × along)
  const coneWeave = canvasTexture(256, 256);
  runtime.core.track(coneWeave.texture);
  coneWeave.ctx.fillStyle = "#d8d8d8";
  coneWeave.ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 4) {
    coneWeave.ctx.fillStyle = "rgba(0,0,0,.07)";
    coneWeave.ctx.fillRect(i, 0, 1.5, 256);
  }
  for (let i = 0; i < 256; i += 16) {
    coneWeave.ctx.fillStyle = "rgba(0,0,0,.22)";
    coneWeave.ctx.fillRect(0, i, 256, 4);
    coneWeave.ctx.fillStyle = "rgba(255,255,255,.2)";
    coneWeave.ctx.fillRect(0, i + 5, 256, 3);
  }
  coneWeave.texture.wrapS = coneWeave.texture.wrapT = THREE.RepeatWrapping;
  coneWeave.texture.repeat.set(6, 1);
  wooferConeMat.map = coneWeave.texture;
  // The baffle's glossy lacquer, the katana saya's finish as a light tile its material tints.
  // The baffle and body map their uv in scene units (across × up the face and on over the top),
  // so one tile is stretched across the face with the sheen's bright band through the middle.
  const baffleFinish = canvasTexture(1024, 128);
  runtime.core.track(baffleFinish.texture);
  drawSayaLacquer(baffleFinish.ctx, 1024, 128, { color: "#c8c8c8" });
  baffleFinish.texture.wrapS = baffleFinish.texture.wrapT = THREE.RepeatWrapping;
  baffleFinish.texture.repeat.set(0.75, 0.43);
  baffleFinish.texture.offset.y = 0.5;
  speakerBaffleMat.map = baffleFinish.texture;
  const portTubeMat = runtime.core.toon("#141415");
  portTubeMat.side = THREE.DoubleSide;
  const R1280 = { w: 1.46, h: 2.34, d: 1.96 };
  // A rounded rectangle, centred on (cx, cy)
  const roundedPlate = (w, h, r, cx = 0, cy = 0) => {
    const shape = new THREE.Shape();
    const [l, b, rt, t] = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
    shape.moveTo(l + r, b);
    shape.lineTo(rt - r, b);
    shape.quadraticCurveTo(rt, b, rt, b + r);
    shape.lineTo(rt, t - r);
    shape.quadraticCurveTo(rt, t, rt - r, t);
    shape.lineTo(l + r, t);
    shape.quadraticCurveTo(l, t, l, t - r);
    shape.lineTo(l, b + r);
    shape.quadraticCurveTo(l, b, l + r, b);
    return shape;
  };
  // A turned part (a profile of [radius, height] pairs) facing the room along +z
  const turnedMat = runtime.core.toon("#141415");
  turnedMat.side = THREE.DoubleSide;
  const turned = (profile, material = turnedMat, segments = 72) => {
    const part = runtime.core.mesh(new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(r, z)), segments), material, { outline: 0 });
    part.rotation.x = Math.PI / 2;
    return part;
  };
  // A tapered well sunk into a side face: open at the surface (x0), its floor at x1
  const sideWell = (x0, x1, z, y, [ow, oh], [iw, ih]) => {
    const outer = [[z - ow / 2, y - oh / 2], [z + ow / 2, y - oh / 2], [z + ow / 2, y + oh / 2], [z - ow / 2, y + oh / 2]].map(([cz, cy]) => new THREE.Vector3(x0, cy, cz));
    const inner = [[z - iw / 2, y - ih / 2], [z + iw / 2, y - ih / 2], [z + iw / 2, y + ih / 2], [z - iw / 2, y + ih / 2]].map(([cz, cy]) => new THREE.Vector3(x1, cy, cz));
    const points = [];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      points.push(outer[i], outer[j], inner[j], outer[i], inner[j], inner[i]);
    }
    points.push(inner[0], inner[1], inner[2], inner[0], inner[2], inner[3]);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometry.computeVertexNormals();
    return geometry;
  };
  const RECESS = 0.125;
  const SIDE_PANEL = 0.08;
  const BAFFLE_Z = R1280.d / 2;
  const WOOFER_AT = 0.74;
  // Close in either side of the monitor, a hand's width from its edges
  [-5.1, 3.1].forEach((x, index) => {
    const active = index === 1;
    // Mirrored pair: the tweeter towards the outer side, the port towards the middle; the
    // active one's port sits a little lower, under its remote's round receiver window
    const outer = active ? 1 : -1;
    const TWEETER_AT = { x: outer * 0.22, y: 1.74 };
    const BASS_PORT_AT = { x: -outer * 0.36, y: active ? 1.58 : 1.74 };
    const speaker = new THREE.Group();
    speaker.name = "r1280dbs-speaker";
    speaker.position.set(x, RISER_TOP, -3.1);
    runtime.core.scene.add(speaker);
    // The grey core between two wood side panels whose corners sweep round in a curve and
    // whose edges are rounded over, with the front baffle set between them. The baffle is
    // thick and really pierced, so the drivers and port sit down inside their openings.
    const cabinet = new THREE.Group();
    cabinet.name = "r1280dbs-cabinet";
    const ROUND = 0.03;
    const face = BAFFLE_Z - 0.005;
    // The active speaker's controls sit in a tall well cut into its outer side panel
    const CONTROL = { z: BAFFLE_Z - 0.4, y: 1.6, w: 0.46, h: 1.0 };
    [-1, 1].forEach((side) => {
      const sideShape = roundedPlate(R1280.d - 2 * ROUND, R1280.h - 2 * ROUND, 0.14);
      if (active && side === 1) sideShape.holes.push(roundedPlate(CONTROL.w + 2 * ROUND, CONTROL.h + 2 * ROUND, 0.07, CONTROL.z, CONTROL.y - R1280.h / 2));
      const sideGeometry = new THREE.ExtrudeGeometry(sideShape, { depth: SIDE_PANEL - 2 * ROUND, bevelEnabled: true, bevelSize: ROUND, bevelThickness: ROUND, bevelSegments: 4, curveSegments: 12 });
      // laid on its side: the plate's width runs front to back, its extrusion across the speaker
      sideGeometry.translate(0, 0, -(SIDE_PANEL - 2 * ROUND) / 2);
      sideGeometry.rotateY(-Math.PI / 2);
      // One even veneer across the panel: its faces map front-to-back × bottom-to-top, its
      // rounded edges carry the grain on round them
      const sidePosition = sideGeometry.attributes.position;
      const sideNormal = sideGeometry.attributes.normal;
      const sideUv = sideGeometry.attributes.uv;
      for (let i = 0; i < sidePosition.count; i++) {
        const u = sidePosition.getZ(i) / R1280.d + 0.5;
        const v = Math.abs(sideNormal.getY(i)) > 0.7 ? 0.5 + sidePosition.getX(i) / R1280.d : sidePosition.getY(i) / R1280.h + 0.5;
        sideUv.setXY(i, u, v);
      }
      // The cabinet is inked as one box: the left panel's outline is drawn round the panels'
      // profile carried right across the speaker, and the right panel has none. An inside face
      // of either would show as a broken line wherever the panels' rounded edges meet the grey.
      let outline = 0;
      let hull;
      if (side === -1) {
        outline = 0.012;
        hull = new THREE.ExtrudeGeometry(roundedPlate(R1280.d - 2 * ROUND, R1280.h - 2 * ROUND, 0.14), { depth: R1280.w - 2 * ROUND, bevelEnabled: true, bevelSize: ROUND, bevelThickness: ROUND, bevelSegments: 4, curveSegments: 12 });
        hull.translate(0, 0, -(R1280.w - 2 * ROUND) / 2);
        hull.rotateY(-Math.PI / 2);
        hull.translate((R1280.w - SIDE_PANEL) / 2, 0, 0);
      }
      const panel = runtime.core.mesh(sideGeometry, speakerWoodMat, { outline, hull });
      panel.name = "wood-side-panel";
      panel.position.set(side * (R1280.w / 2 - SIDE_PANEL / 2), R1280.h / 2, 0);
      cabinet.add(panel);
    });
    // The grey body between the side panels: its profile sweeps round the same curves as the
    // panels' corners, front and back, just inside them, so nothing of it shows past their edges.
    // The baffle fills the notch in its front between the two front curves, flush with them, and
    // is really pierced, so the drivers and port sit down inside their openings. Its top, back
    // and face are the baffle's lacquer, its hidden ends the shell's grey.
    const BODY_R = 0.17;
    // (its ends sit past the panels' rounded inner edges, so none of it shows over them)
    const BODY_W = R1280.w - 2 * SIDE_PANEL + 2 * ROUND;
    const [bodyBack, bodyBottom, top] = [-R1280.d / 2 + 0.01, 0.01, R1280.h];
    const [notchLow, notchHigh, notchBack] = [bodyBottom + BODY_R, top - BODY_R, face - RECESS];
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(face - BODY_R, bodyBottom);
    bodyShape.quadraticCurveTo(face, bodyBottom, face, notchLow);
    bodyShape.lineTo(notchBack, notchLow);
    bodyShape.lineTo(notchBack, notchHigh);
    bodyShape.lineTo(face, notchHigh);
    bodyShape.quadraticCurveTo(face, top, face - BODY_R, top);
    bodyShape.lineTo(bodyBack + BODY_R, top);
    bodyShape.quadraticCurveTo(bodyBack, top, bodyBack, top - BODY_R);
    bodyShape.lineTo(bodyBack, bodyBottom + BODY_R);
    bodyShape.quadraticCurveTo(bodyBack, bodyBottom, bodyBack + BODY_R, bodyBottom);
    bodyShape.lineTo(face - BODY_R, bodyBottom);
    const bodyGeometry = new THREE.ExtrudeGeometry(bodyShape, { depth: BODY_W, bevelEnabled: false, curveSegments: 16 });
    bodyGeometry.translate(0, 0, -BODY_W / 2);
    bodyGeometry.rotateY(-Math.PI / 2);
    // One lacquer over body and baffle: v runs up the face and on round the curves, over the top
    // and under the bottom (further back, further from the middle), so the sheen and grain carry
    // across every join
    const lacquerUv = (geometry, yAt, zAt) => {
      const position = geometry.attributes.position;
      const uv = geometry.attributes.uv;
      for (let i = 0; i < position.count; i++) {
        const y = position.getY(i) + yAt;
        uv.setXY(i, position.getX(i), y - R1280.h / 2 + (face - position.getZ(i) - zAt) * (2 * y / R1280.h - 1));
      }
    };
    lacquerUv(bodyGeometry, 0, 0);
    // (no outline of its own: the left panel's hull rings the whole cabinet)
    const body = runtime.core.mesh(bodyGeometry, [speakerShellMat, speakerBaffleMat], { outline: 0 });
    body.name = "cabinet-body";
    cabinet.add(body);
    // Square-edged, so its face runs straight on into the body's curves
    const baffleShape = roundedPlate(BODY_W, notchHigh - notchLow, 0.001, 0, (notchHigh + notchLow) / 2 - R1280.h / 2);
    [[TWEETER_AT.x, TWEETER_AT.y, 0.17], [BASS_PORT_AT.x, BASS_PORT_AT.y, 0.15], [0, WOOFER_AT, 0.5]].forEach(([hx, hy, r]) => {
      const hole = new THREE.Path();
      hole.absarc(hx, hy - R1280.h / 2, r, 0, Math.PI * 2, true);
      baffleShape.holes.push(hole);
    });
    const baffleGeometry = new THREE.ExtrudeGeometry(baffleShape, { depth: RECESS, bevelEnabled: false, curveSegments: 32 });
    lacquerUv(baffleGeometry, R1280.h / 2, notchBack);
    const baffle = runtime.core.mesh(baffleGeometry, speakerBaffleMat, { outline: 0 });
    baffle.name = "front-baffle";
    baffle.position.set(0, R1280.h / 2, notchBack);
    cabinet.add(baffle);
    speaker.add(cabinet);
    // The tweeter on its own thick round black plate, chamfered round its rim and held by four
    // screws, dished into a cup round the dark silk dome; a single guard bar spans the cup
    const tweeterPlate = turned([[0.27, -0.004], [0.27, 0.018], [0.245, 0.045], [0.19, 0.045], [0.172, 0.03], [0.16, 0], [0.155, -0.06]]);
    tweeterPlate.position.set(TWEETER_AT.x, TWEETER_AT.y, face);
    const tweeterCup = runtime.core.mesh(new THREE.CircleGeometry(0.16, 40), speakerRubberMat, { outline: 0 });
    tweeterCup.position.set(TWEETER_AT.x, TWEETER_AT.y, face - 0.06);
    const tweeterRing = runtime.core.mesh(new THREE.TorusGeometry(0.105, 0.02, 10, 40), trimMat, { outline: 0 });
    tweeterRing.position.set(TWEETER_AT.x, TWEETER_AT.y, face - 0.05);
    const tweeter = runtime.core.mesh(new THREE.SphereGeometry(0.085, 24, 14), speakerDomeMat, { outline: 0 });
    tweeter.name = "silk-dome-tweeter";
    tweeter.scale.z = 0.5;
    tweeter.position.set(TWEETER_AT.x, TWEETER_AT.y, face - 0.055);
    const bar = runtime.core.mesh(runtime.core.rbox(0.33, 0.022, 0.016, 0.006), trimMat, { outline: 0 });
    bar.position.set(TWEETER_AT.x, TWEETER_AT.y, face - 0.008);
    speaker.add(bar);
    // The bass port beside it: a plain round opening, black inside
    const port = runtime.core.mesh(new THREE.CircleGeometry(0.15, 32), speakerRubberMat, { outline: 0 });
    port.name = "front-bass-port";
    port.position.set(BASS_PORT_AT.x, BASS_PORT_AT.y, face - 0.1);
    const portTube = runtime.core.mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 32, 1, true), portTubeMat, { outline: 0 });
    portTube.rotation.x = Math.PI / 2;
    portTube.position.set(BASS_PORT_AT.x, BASS_PORT_AT.y, face - 0.05);
    if (active) {
      const receiver = runtime.core.mesh(new THREE.SphereGeometry(0.11, 20, 12), speakerDomeMat, { outline: 0 });
      receiver.name = "remote-receiver";
      receiver.scale.z = 0.35;
      receiver.position.set(BASS_PORT_AT.x + 0.04, 2.0, face - 0.015);
      // The status light shines through the receiver's window: red when muted, green when playing
      const ledMat = runtime.core.track(new THREE.MeshBasicMaterial({ color: soundMuted ? "#e11d48" : "#57ff8d" }));
      const led = new THREE.Mesh(runtime.core.track(new THREE.CircleGeometry(0.055, 24)), ledMat);
      led.name = "speaker-power-indicator";
      led.position.set(receiver.position.x, receiver.position.y, face + 0.024);
      speakerLeds.push(ledMat);
      speaker.add(receiver, led);
    }
    // The 4-inch woofer: a raised black frame with a chamfered edge, a thick rubber roll
    // surround, a grey rippled cone and a bulging black dust cap
    const wooferFrame = turned([[0.62, -0.004], [0.62, 0.016], [0.6, 0.035], [0.525, 0.035], [0.505, 0.02], [0.49, -0.01]]);
    wooferFrame.name = "woofer-frame";
    wooferFrame.position.set(0, WOOFER_AT, face);
    speaker.add(wooferFrame);
    const surround = runtime.core.mesh(new THREE.TorusGeometry(0.445, 0.05, 14, 72), speakerRubberMat, { outline: 0 });
    surround.name = "driver-surround";
    surround.scale.z = 0.75;
    surround.position.set(0, WOOFER_AT, face - 0.005);
    const coneProfile = [[0.41, 0.005], [0.3, -0.045], [0.17, -0.085], [0.13, -0.09]].map(([r, depth]) => new THREE.Vector2(r, depth));
    const woofer = runtime.core.mesh(new THREE.LatheGeometry(coneProfile, 64), wooferConeMat, { outline: 0 });
    woofer.rotation.x = Math.PI / 2;
    woofer.position.set(0, WOOFER_AT, face - 0.005);
    const dustCap = runtime.core.mesh(new THREE.SphereGeometry(0.16, 24, 14), speakerDomeMat, { outline: 0.004 });
    dustCap.scale.z = 0.6;
    dustCap.position.set(0, WOOFER_AT, face - 0.08);
    dustCap.userData.restZ = dustCap.position.z;
    // Black screws: four on the tweeter plate and four on the woofer frame, on their
    // diagonals, and one in each corner of the baffle
    const diagonals = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    [
      ...diagonals.map(([sx, sy]) => [TWEETER_AT.x + sx * 0.152, TWEETER_AT.y + sy * 0.152, 0.045]),
      ...diagonals.map(([sx, sy]) => [sx * 0.396, WOOFER_AT + sy * 0.396, 0.035]),
      ...diagonals.map(([sx, sy]) => [sx * 0.52, R1280.h / 2 + sy * (R1280.h / 2 - 0.14), 0]),
    ].forEach(([sx, sy, lift]) => {
      const screw = runtime.core.mesh(new THREE.SphereGeometry(0.028, 12, 8), speakerDomeMat, { outline: 0 });
      screw.scale.z = 0.35;
      screw.position.set(sx, sy, face + lift + 0.002);
      speaker.add(screw);
    });
    speaker.add(tweeterPlate, tweeterCup, tweeterRing, tweeter, port, portTube, surround, woofer, dustCap);
    // Round the back: the active speaker's input panel, the passive one's speaker terminals
    const rear = runtime.core.mesh(runtime.core.rbox(active ? 0.8 : 0.4, active ? 0.9 : 0.3, 0.012, 0.02), speakerRubberMat, { outline: 0 });
    rear.position.set(0, active ? 1.0 : 0.6, -BAFFLE_Z + 0.022);
    speaker.add(rear);
    if (active) {
      // The controls, down in the well cut into the outer side panel: its black walls taper in
      // to a floor where three knobs stand (volume, treble, bass)
      const WELL_FLOOR = R1280.w / 2 - 0.065;
      const well = runtime.core.mesh(sideWell(R1280.w / 2 + 0.002, WELL_FLOOR, CONTROL.z, CONTROL.y, [CONTROL.w, CONTROL.h], [CONTROL.w - 0.16, CONTROL.h - 0.16]), turnedMat, { outline: 0 });
      well.name = "side-control-panel";
      speaker.add(well);
      [CONTROL.y + 0.25, CONTROL.y, CONTROL.y - 0.25].forEach((y) => {
        const knob = runtime.core.mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.05, 28), speakerRubberMat, { outline: 0.005 });
        knob.name = "side-knob";
        knob.rotation.z = Math.PI / 2;
        knob.position.set(WELL_FLOOR + 0.025, y, CONTROL.z);
        const rim = runtime.core.mesh(new THREE.TorusGeometry(0.06, 0.006, 6, 28), trimMat, { outline: 0 });
        rim.rotation.y = Math.PI / 2;
        rim.position.set(WELL_FLOOR + 0.051, y, CONTROL.z);
        speaker.add(knob, rim);
      });
    }
    const entry = { group: speaker, woofer, dustCap, tweeter };
    speakers.push(entry);
    runtime.core.register(speaker, {
      onHover: (on) => {
        gsap.to(speaker.rotation, { x: on ? -0.045 : 0, duration: 0.3, ease: "power2.out", overwrite: true });
        if (on) {
          pump(entry, 1.2);
          floatNote(entry);
          hoverSound(speaker, (s) => s.woofer());
        }
      },
      onClick: () => {
        // Played before the switch: once muted, nothing would be heard
        if (!soundMuted) sfx.powerDown();
        else pump(entry);
        runtime.options.onEvent("toggleSound");
      },
    });
  });
  // Spotifree on the monitor plays through these: the cones kick with the drums and notes
  // float up on some of the snares
  let noteSide = 0;
  const lofi = createLofi({
    onHit: (kind) => {
      speakers.forEach((speaker) => pump(speaker, kind === "kick" ? 0.7 : 0.35));
      runtime.robot.robotBeat(kind);
      if (kind === "snare" && Math.random() < 0.5) floatNote(speakers[noteSide++ % speakers.length]);
    },
    onTrack: (i) => {
      desktop.notify("spotifree", "Now playing", TRACKS[i].title);
      redrawScreen();
    },
  });
  // The Mac mini's power: off, the screen goes black and its light out; on, it boots first.
  // `level` fades the screen's spill.
  const computer = { on: false, booting: true, bar: 0 };
  const screenPower = { level: 0.35 };
  // The room waits behind the loader with its screen asking the visitor in: the terminal holds
  // the lines the loader's own terminal ends on (see index.html). The terminal's window stays
  // off the desktop until the loader's window lands on it.
  let standby = false;
  const STANDBY_LOG = ["> boot the desk", ...["loading the scene", "building the room", "drawing it", "setting the light"].map((line) => `${line}... ok`)];
  const standbyLines = () => [...STANDBY_LOG, window.matchMedia("(hover: none)").matches ? "# TAP TO COME IN" : "# PRESS ENTER TO COME IN", ">"];
  function setStandby(on) {
    standby = on;
    desktop.setHidden("terminal", on);
    screenPower.level = on ? 1 : screenPower.level;
    redrawScreen();
  }
  function landStandby() {
    desktop.setHidden("terminal", false);
    redrawScreen();
  }
  // In from standby the computer is already on: no boot, the terminal goes on from the loader's
  // log to the greeting. (Switching the Mac mini off and on still boots it.)
  function wakeFromStandby() {
    standby = false;
    desktop.setHidden("terminal", false);
    gsap.killTweensOf(computer);
    Object.assign(computer, { on: true, booting: false, bar: 1 });
    termLines = [...STANDBY_LOG];
    gsap.to(screenPower, { level: 1, duration: 0.4, overwrite: true });
    redrawTerminal();
    runtime.core.timers.push(setTimeout(welcome, 1400));
  }
  // A track asked for while the sound is off: it starts once the speakers are switched on
  let pendingTrack = null;
  function startMusic(index = lofi.index) {
    if (!computer.on) return;
    if (soundMuted) {
      pendingTrack = index;
      runtime.options.onEvent("toggleSound");
      return;
    }
    const fresh = !lofi.playing;
    runtime.secrets.discover("lofi");
    if (lofi.play(index) && fresh) desktop.notify("spotifree", "Now playing", TRACKS[lofi.index].title);
    redrawScreen();
  }
  function setMuted(isMuted) {
    setRainLevel(isMuted ? 0 : runtime.room.outside.rain);
    speakerLeds.forEach((mat) => mat.color.set(isMuted ? "#e11d48" : "#57ff8d"));
    const changed = isMuted !== soundMuted;
    soundMuted = isMuted;
    if (!changed) return;
    if (isMuted && lofi.playing) {
      lofi.pause();
      redrawScreen();
    }
    if (!isMuted && pendingTrack !== null) {
      const index = pendingTrack;
      pendingTrack = null;
      startMusic(index);
    } else if (!isMuted) {
      // Sound on: the groove, with the cones pumping on every beat and notes on the off-beats
      sfx.groove({ delay: 0.05 });
      for (let i = 0; i < 9; i++) {
        runtime.core.timers.push(setTimeout(() => {
          speakers.forEach((speaker, k) => {
            pump(speaker, i % 2 === 0 ? 1 : 0.5);
            if ((i + k) % 2 === 0) floatNote(speaker);
          });
        }, (0.05 + i * GROOVE_BEAT) * 1000));
      }
      speakers.forEach(({ tweeter }) => gsap.fromTo(tweeter.rotation, { y: 0 }, { y: Math.PI * 4, duration: 1.8, ease: "power2.out" }));
    } else {
      // Muted: the cabinets slump and the cones sink, then they straighten up, sulking
      speakers.forEach(({ group, woofer }) => {
        gsap.timeline()
          .to(group.scale, { x: 1.08, y: 0.8, z: 1.08, duration: 0.4, ease: "power2.in" })
          .to(group.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: "elastic.out(1, 0.4)" });
        gsap.fromTo(woofer.scale, { x: 0.75, z: 0.75 }, { x: 1, z: 1, delay: 0.4, duration: 0.6, ease: "elastic.out(1, 0.4)" });
      });
    }
  }
  setMuted(runtime.options.muted);

  // Printed at twice its layout size (drawTerminal still works in 640 × 384) so the text stays
  // crisp when the camera zooms right in on the screen
  // The terminal is drawn off screen, then shown in its window on the desktop
  const term = canvasTexture(1280, 768);
  term.ctx.scale(2, 2);
  runtime.core.track(term.texture);
  const screenTex = canvasTexture(SCREEN_W * 2, SCREEN_H * 2);
  screenTex.ctx.scale(2, 2);
  runtime.core.track(screenTex.texture);
  const screen = new THREE.Mesh(runtime.core.track(new THREE.PlaneGeometry(4.0, 2.4)), runtime.core.track(new THREE.MeshBasicMaterial({ map: screenTex.texture })));
  screen.position.set(0, SCREEN_Y, 0.09);
  screen.userData.tex = screenTex;
  monitor.add(screen);
  // The screen's own spill: a cool light over the keyboard and desk, faint by day, and the
  // props in front of it throw shadows towards the visitor at night
  const screenLight = runtime.room.neonLight("#c4d4ff", 2.2, () => screenPower.level * (0.25 + 0.75 * runtime.core.roomLight.night), { distance: 7, shadow: true });
  screenLight.position.set(0, SCREEN_Y - 0.13, 0.9);
  monitor.add(screenLight);
  const desktop = createDesktop({
    terminal: term,
    player: lofi,
    actions: {
      toggle: () => (lofi.playing ? lofi.pause() : startMusic()),
      next: () => lofi.next(),
      prev: () => lofi.restartOrPrev(),
      playTrack: (i) => startMusic(i),
      focus: (name) => runtime.camera.setFocus(name),
      terminalClick: () => autotype(AUTORUN[autorunIndex++ % AUTORUN.length]),
      sound: (name) => sfx[name]?.(),
    },
  });
  let screenDrawnAt = 0;
  let consoleOn = false;
  function redrawScreen() {
    screenDrawnAt = performance.now();
    // The page swaps the terminal's chips and hint for the game's while the TV is on
    if ((desktop.active() === "console") !== consoleOn) {
      consoleOn = !consoleOn;
      runtime.options.onEvent("console", { on: consoleOn });
      // the console is the display's own input, so it lights the screen with the Mac mini off
      if (!computer.on && !computer.booting) gsap.to(screenPower, { level: consoleOn ? 1 : 0, duration: 0.35, overwrite: true });
    }
    // Waiting behind the loader, the desktop is up with the loader's boot log in the terminal,
    // every line done, asking the visitor in (the loader's own window hands over to this one)
    if (standby) drawTerminal(term.ctx, 640, 384, standbyLines(), cursorOn);
    // Off or still starting, the Mac mini shows black or its boot screen and nothing is clickable
    if (!computer.on && !consoleOn && !standby) {
      screenTex.ctx.save();
      screenTex.ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawPowerScreen(screenTex.ctx, SCREEN_W * 2, SCREEN_H * 2, { booting: computer.booting, progress: computer.bar });
      screenTex.ctx.restore();
      screenTex.hotspots = [];
      screenTex.texture.needsUpdate = true;
      return;
    }
    // Hotspots come back in layout units; the canvas is printed at twice that
    screenTex.hotspots = desktop.draw(screenTex.ctx, { alert: termAlert, alertOn: cursorOn })
      .map((hs) => ({ ...hs, x: hs.x * 2, y: hs.y * 2, w: hs.w * 2, h: hs.h * 2 }));
    screenTex.texture.needsUpdate = true;
  }

  const wrapWords = (words, width = 30) =>
    words.reduce((lines, word) => {
      const last = lines[lines.length - 1];
      if (last !== undefined && (last + " " + word).length <= width) lines[lines.length - 1] = last ? `${last}  ${word}` : word;
      else lines.push(word);
      return lines;
    }, []);
  const COMMANDS = {
    help: ["whoami  projects  hobbies", "contact  clear  sudo hire oka"],
    whoami: ["oka sutarto putra", "full stack developer"],
    projects: wrapWords(runtime.options.projects.map((p) => p.id)),
    hobbies: ["games. games. more games."],
    contact: ["→ /#contact", "or try: sudo hire oka"],
    "sudo hire oka": ["[sudo] access granted ✔", "→ see /#contact"],
    welcome: ["# WELCOME TO MY DESK!", "hi, i'm oka, a full stack dev.", "click around: almost everything", "here does something.", "zoom in here and type: help"],
  };
  COMMANDS.ls = COMMANDS.projects;
  const AUTORUN = ["help", "whoami", "projects", "hobbies", "sudo hire oka"];
  const MAX_INPUT = 26;
  let termLines = ["the@desk ready."];
  let welcomed = false;
  let input = "";
  let termBusy = false;
  let autorunIndex = 0;
  let cursorOn = true;
  // From the welcome until someone opens the monitor, its title bar flashes for attention
  let termAlert = false;
  const redrawTerminal = () => {
    if (!computer.on) return;
    drawTerminal(term.ctx, 640, 384, [...termLines, "> " + input], cursorOn, { alert: termAlert, alertOn: cursorOn });
    redrawScreen();
  };

  function execute(raw) {
    const cmd = raw.trim().toLowerCase().replace(/\s+/g, " ");
    termLines.push("> " + raw);
    input = "";
    if (cmd === "clear") termLines = [];
    else if (COMMANDS[cmd]) {
      termLines.push(...COMMANDS[cmd]);
      sfx.blip();
      runtime.options.onEvent("terminal", { command: cmd });
      if (cmd === "welcome") runtime.core.timers.push(setTimeout(onWelcomed, 150));
    } else if (cmd) {
      termLines.push(`command not found: ${cmd.slice(0, 14)}`, "try: help");
      sfx.buzz();
    }
    termLines = termLines.slice(-12);
    gsap.fromTo(body.scale, { x: 1.03, y: 0.97 }, { x: 1, y: 1, duration: 0.4, ease: "elastic.out(1.2, 0.4)" });
    redrawTerminal();
  }

  // Types a command out by itself (clicking the screen, the HUD's command chips)
  function autotype(cmd) {
    if (termBusy || !computer.on) return;
    termBusy = true;
    let i = 0;
    const typeNext = () => {
      if (!computer.on) {
        termBusy = false;
        return;
      }
      if (i < cmd.length) {
        input = cmd.slice(0, ++i);
        sfx.key();
        redrawTerminal();
        runtime.core.timers.push(setTimeout(typeNext, 45 + Math.random() * 50));
      } else {
        runtime.core.timers.push(
          setTimeout(() => {
            termBusy = false;
            execute(cmd);
          }, 160),
        );
      }
    };
    typeNext();
  }

  // Real typing while zoomed in on the monitor
  function typeKey(key) {
    if (termBusy || !computer.on) return;
    if (key === "Enter") return execute(input);
    if (key === "Backspace") input = input.slice(0, -1);
    else if (input.length < MAX_INPUT) input += key;
    redrawTerminal();
  }

  // Once the room is in view, the terminal greets whoever just arrived. The greeting stays on
  // screen when they zoom in, so it can be read there; zooming in first types it then.
  const welcome = () => {
    if (welcomed || !computer.on) return;
    welcomed = true;
    autotype("welcome");
  };
  // The greeting lands with a hop of the monitor and the title bar starts flashing
  const onWelcomed = () => {
    if (runtime.camera.focus.name === "monitor") return;
    termAlert = true;
    redrawTerminal();
    gsap.fromTo(monitor.position, { y: RISER_TOP }, { keyframes: [{ y: RISER_TOP + 0.3, duration: 0.15, ease: "power2.out" }, { y: RISER_TOP, duration: 0.4, ease: "bounce.out" }] });
    sfx.ping();
  };

  const showTerminal = () => {
    if (!computer.on) return;
    desktop.exitConsole();
    if (desktop.active() === "terminal") return;
    desktop.launch("terminal");
    redrawScreen();
  };
  // Clicking the Mac mini shuts the computer down (the music and any game stop, the screen
  // goes black and its light fades) or starts it: the boot screen fills its bar, then the
  // desktop comes back as it was. Clicks while it boots are ignored.
  function bootComputer({ playSound = true, delay = 0.5 } = {}) {
    computer.booting = true;
    computer.bar = 0;
    let playedBootSound = false;
    const cleanGesture = () => {
      ["pointerdown", "keydown"].forEach((evt) => window.removeEventListener(evt, onFirstGesture, true));
    };
    const onFirstGesture = () => {
      cleanGesture();
      if (computer.booting && !playedBootSound) {
        playedBootSound = true;
        sfx.power();
      }
    };
    if (playSound) {
      initializeAudio().then((ready) => {
        if (ready && computer.booting && !playedBootSound) {
          playedBootSound = true;
          sfx.power();
          cleanGesture();
        }
      });
      ["pointerdown", "keydown"].forEach((evt) => window.addEventListener(evt, onFirstGesture, { capture: true, once: true }));
    }
    miniLedMat.color.set("#22c55e");
    miniLedHalo.visible = true;
    gsap.to(miniLedHaloMat, { opacity: 0.65, duration: 0.3, overwrite: true });
    redrawScreen();
    gsap.to(screenPower, { level: 0.35, duration: 0.4, overwrite: true });
    gsap.to(computer, {
      bar: 1,
      duration: 2.2,
      delay,
      ease: "power1.inOut",
      onUpdate: redrawScreen,
      onComplete: () => {
        cleanGesture();
        computer.booting = false;
        computer.on = true;
        sfx.ding();
        gsap.to(screenPower, { level: 1, duration: 0.4, overwrite: true });
        redrawTerminal();
        if (!welcomed) runtime.core.timers.push(setTimeout(welcome, 2000));
      },
    });
  }

  function toggleComputer() {
    if (computer.booting) return;
    gsap.killTweensOf(computer);
    if (computer.on) {
      if (lofi.playing) lofi.pause();
      if (desktop.exitConsole()) redrawScreen();
      computer.on = false;
      sfx.powerDown();
      miniLedMat.color.set("#1f2125");
      gsap.to(miniLedHaloMat, { opacity: 0, duration: 0.25, overwrite: true, onComplete: () => { miniLedHalo.visible = false; } });
      gsap.to(screenPower, { level: 0, duration: 0.35, ease: "power2.in", overwrite: true });
      redrawScreen();
      return;
    }
    bootComputer({ playSound: true, delay: 0.4 });
  }
  const monitorEdgeRest = panelEdge.material.color.clone();
  runtime.core.register(monitor, {
    focus: "monitor",
    // Leaving the screen switches the console off
    onLeave: () => desktop.exitConsole() && redrawScreen(),
    onEnter: () => {
      termAlert = false;
      welcome();
      redrawTerminal();
    },
    // Zoomed in, clicks land on the desktop's hotspots (dock, windows, player)
    onHotspot: (hs) => {
      desktop.click(hs);
      redrawScreen();
    },
    onHover: (on) => {
      if (!on && desktop.hover(null)) redrawScreen();
      // The screen acknowledges attention without moving the stand or its clickable UI.
      gsap.to(panelEdge.material.color, { r: on ? 0.12 : monitorEdgeRest.r, g: on ? 0.25 : monitorEdgeRest.g, b: on ? 0.23 : monitorEdgeRest.b, duration: 0.25, overwrite: true });
    },
    onPointer: (hit) => {
      if (!computer.on && !consoleOn) return;
      const moved = hit?.object === screen && hit.uv ? desktop.hover(hit.uv.x * SCREEN_W, (1 - hit.uv.y) * SCREEN_H) : desktop.hover(null);
      if (moved) redrawScreen();
    },
    // The console, Snake or Spotifree up front take their keys; anything else goes to the terminal
    onKey: (e) => {
      if (runtime.camera.focus.name !== "monitor") return false;
      if (!computer.on && !consoleOn) return false;
      // The console takes every key; Snake up front takes the arrows and WASD
      if (desktop.key(e)) {
        redrawScreen();
        return true;
      }
      if (desktop.active() === "spotifree" && !e.repeat) {
        if (e.key === " ") return lofi.playing ? (lofi.pause(), redrawScreen(), true) : (startMusic(), true);
        if (e.key === "ArrowRight") return lofi.next(), true;
        if (e.key === "ArrowLeft") return lofi.restartOrPrev(), true;
      }
      if (e.key.length === 1 || e.key === "Enter" || e.key === "Backspace") showTerminal();
      return false;
    },
  });
  runtime.core.register(lightbar, {
    onClick: () => toggleLightbar(),
    onHover: (on) => {
      if (on) hoverSound(lightbar, (s) => s.click());
      gsap.to(lightbarButton.scale, {
        x: on ? 1.25 : 1,
        y: on ? 1.25 : 1,
        z: on ? 1.25 : 1,
        duration: 0.2,
        overwrite: true,
      });
      gsap.to(lightbarPowerMark.scale, {
        x: on ? 1.25 : 1,
        z: on ? 1.25 : 1,
        duration: 0.2,
        overwrite: true,
      });
    },
  });

  // Public state used by the other scene parts.
  return {
    monitor,
    speakers,
    desktop,
    redrawScreen,
    typeKey,
    get termBusy() { return termBusy; },
    showTerminal,
    RISER_TOP,
    macMini,
    riser,
    redrawTerminal,
    riserGrain,
    speakerGrain,
    speakerWoodMat,
    speakerShellMat,
    speakerBaffleMat,
    riserMat,
    riserLegMat,
    RISER_LEG_SHADE,
    monitorGlowMat,
    lightbarState,
    get lightbarOn() { return lightbarOn; },
    setLightbar,
    updateLightbar,
    screen,
    SCREEN_Y,
    lightbarLight,
    screenLight,
    screenPower,
    get soundMuted() { return soundMuted; },
    get cursorOn() { return cursorOn; },
    set cursorOn(value) { cursorOn = value; },
    lofi,
    get screenDrawnAt() { return screenDrawnAt; },
    bootComputer,
    get standby() { return standby; },
    setStandby,
    landStandby,
    wakeFromStandby,
    setMuted,
    computer,
    autotype,
    panelEdge,
  };
}
