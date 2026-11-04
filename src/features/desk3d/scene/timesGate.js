import * as THREE from "three";
import gsap from "gsap";
import { TIMES_GATE_FINISHES, DEFAULT_TIMES_GATE_FINISH } from "../timesGateFinishes";
import { hoverSound, sfx } from "@/shared/composables/useSfx";
import { getVisits } from "@/shared/services/visitsApi";
import {
  canvasTexture, drawBrushedMetal, GATE_PX, drawGateWeather, drawGateGithub, drawGateVisitors, drawGatePerformance, drawGatePet,
} from "../textures";

// Where the widgets read their numbers from. The contributions are GitHub's own calendar, as
// served (no key) by github-contributions-api.jogruber.de; the visit count is the portfolio
// API's, which counts each person once (see visitsApi).
const GITHUB_USER = "okasutarto";
const GITHUB_URL = `https://github-contributions-api.jogruber.de/v4/${GITHUB_USER}?y=last`;

export function createTimesGate(runtime) {
  // ---------- Divoom Times Gate: five pixel screens on an open frame ----------
  // Shape reference: https://divoom.com/products/time-gate and supplied front/three-quarter photos.
  // Stood on the desk in front of the riser, under the monitor, at its real 283 × 47 × 97 mm:
  // two thin clear acrylic sheets frame five 1.44" LCDs on a black spine, each with a domed
  // clear cover that leaves its central pixels unchanged, between two brushed-silver arcs
  // that bow out at either end. Inside each arc a white panel carries a chrome grab handle and
  // an RGB strip glowing round the arc's inner edge; the arcs stand on chrome hinges over
  // orange rubber feet that splay out past them.
  const gate = new THREE.Group();
  gate.name = "times-gate";
  // its back a centimetre off the riser's front edge
  gate.position.set(-1, 0, -1.55);
  runtime.core.scene.add(gate);
  // the screens' centre line, which the end arcs are drawn round too; the tube runs 2.5–8.1 cm
  // off the desk, the top clamp up to the full 9.7 cm
  const CY = 0.53;
  const TUBE_H = 0.56;
  const CAP_HALF = 0.975;
  const DEPTH = 0.47;

  const brushed = canvasTexture(128, 128);
  runtime.core.track(brushed.texture);
  drawBrushedMetal(brushed.ctx, 128, 128);
  brushed.ctx.fillStyle = "rgba(255,255,255,0.78)";
  brushed.ctx.fillRect(0, 0, 128, 128);
  brushed.texture.wrapS = brushed.texture.wrapT = THREE.RepeatWrapping;
  brushed.texture.repeat.set(3, 3);
  brushed.texture.needsUpdate = true;
  const silverMat = runtime.core.toon("#d6dade");
  silverMat.map = brushed.texture;
  const clampMat = runtime.core.toon("#d6dade");
  clampMat.map = brushed.texture;
  const lowerDeckMat = runtime.core.toon("#d6dade");
  lowerDeckMat.map = brushed.texture;
  const panelMat = runtime.core.toon("#eef0f3");
  const insetMat = runtime.core.toon("#2a2e36");
  const spineMat = runtime.core.toon("#262a31");
  const bezelMat = runtime.core.toon("#0b0c0f");
  const chromeMat = runtime.core.toon("#f2f5f8");
  chromeMat.emissive.set("#ffffff");
  chromeMat.emissiveIntensity = 0.12;
  const orangeMat = runtime.core.toon("#ff6b2c");
  const buttonMat = runtime.core.toon("#9aa2ac");
  const rubberMat = runtime.core.toon("#25282d");
  const glintMat = runtime.core.track(new THREE.MeshBasicMaterial({ color: "#e3edf7" }));
  function setTimesGateFinish(finish) {
    const coat = TIMES_GATE_FINISHES[Object.hasOwn(TIMES_GATE_FINISHES, finish) ? finish : DEFAULT_TIMES_GATE_FINISH];
    silverMat.color.set(coat.shell);
    clampMat.color.set(coat.clamp);
    lowerDeckMat.color.set(finish === "bumblebee" ? coat.shell : coat.clamp);
    panelMat.color.set(coat.panel);
    insetMat.color.set(coat.inset);
    orangeMat.color.set(coat.accent);
  }
  setTimesGateFinish(runtime.options.timesGateFinish);
  const flat = (part) => ((part.raycast = runtime.core.noRaycast), part);
  // Repeated small parts share geometry and one draw call per set, without outline hulls.
  function details(parent, geometry, material, positions) {
    const parts = flat(runtime.core.track(new THREE.InstancedMesh(runtime.core.track(geometry), material, positions.length)));
    const transform = new THREE.Object3D();
    positions.forEach(([x, y, z, rz = 0], i) => {
      transform.position.set(x, y, z);
      transform.rotation.z = rz;
      transform.updateMatrix();
      parts.setMatrixAt(i, transform.matrix);
    });
    parent.add(parts);
    return parts;
  }
  const boltGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.008, 6);
  boltGeo.rotateX(Math.PI / 2);
  const boltSocketGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.009, 6);
  boltSocketGeo.rotateX(Math.PI / 2);

  // ---------- the capsule ----------
  // The black spine the screens are mounted on
  const spine = runtime.core.mesh(runtime.core.rbox(CAP_HALF * 2 + 0.02, TUBE_H - 0.12, 0.16, 0.05), spineMat, { outline: 0.006 });
  spine.position.set(0, CY, -0.06);
  gate.add(spine);
  // Five rounded modules, each a glossy black bezel round its 26 mm square 64 × 64 panel.
  // The panels show their pixels square, even and sharp (see sharpPixels below).
  const MODULE = { w: 0.357, h: 0.46, d: 0.1, pitch: 0.37 };
  const PANEL = 0.26;
  const MODULE_FRONT = 0.1 + MODULE.d / 2;
  const coverW = MODULE.w - 0.006;
  const coverH = MODULE.h - 0.006;
  const coverZ = (x, y) => MODULE_FRONT + 0.006 + 0.026 * (1 - (x / (coverW / 2)) ** 4) * (1 - (y / (coverH / 2)) ** 4);
  const coverGeo = runtime.core.track(new THREE.PlaneGeometry(coverW, coverH, 24, 32));
  const coverPosition = coverGeo.attributes.position;
  const coverColors = [];
  for (let i = 0; i < coverPosition.count; i++) {
    let x = coverPosition.getX(i), y = coverPosition.getY(i);
    // Round the grid's corners, then bow the front outward with a smooth clear centre.
    const cx = THREE.MathUtils.clamp(x, -coverW / 2 + 0.075, coverW / 2 - 0.075);
    const cy = THREE.MathUtils.clamp(y, -coverH / 2 + 0.075, coverH / 2 - 0.075);
    const distance = Math.hypot(x - cx, y - cy);
    if (distance > 0.075) {
      x = cx + (x - cx) * 0.075 / distance;
      y = cy + (y - cy) * 0.075 / distance;
    }
    coverPosition.setXYZ(i, x, y, coverZ(x, y));
    const edge = THREE.MathUtils.smoothstep(Math.abs(x), PANEL / 2 + 0.008, coverW / 2)
      + THREE.MathUtils.smoothstep(Math.abs(y), PANEL / 2 + 0.012, coverH / 2);
    coverColors.push(1, 1, 1, Math.min(0.4, edge * 0.3));
  }
  coverGeo.setAttribute("color", new THREE.Float32BufferAttribute(coverColors, 4));
  coverGeo.computeVertexNormals();
  // A smooth dielectric coat reflects broad light sources instead of painted-on
  // strokes. These lighting maps are sampled by view direction, not printed on the
  // plastic; they add no texture, refraction pass or haze over the pixels. Each one is
  // painted where the room's lights sit as seen from the gate (u = azimuth from +x
  // towards the viewer, v = elevation): by day the window up on the left, warm; by night
  // a moonlit window and the monitor light bar overhead. Both are made once, so a theme
  // change only swaps the map and nothing is re-filtered per frame.
  function coverEnvironment(night) {
    const { ctx: c, texture } = canvasTexture(512, 256);
    runtime.core.track(texture);
    const at = (azimuth, elevation) => [(azimuth / 360 + 0.5) * 512, (0.5 - elevation / 180) * 256];
    // the room itself: a lit ceiling and walls above a darker desk
    const room = c.createLinearGradient(0, 0, 0, 256);
    room.addColorStop(0, night ? "#0b0d14" : "#3b3d41");
    room.addColorStop(0.5, night ? "#06070b" : "#26282b");
    room.addColorStop(1, night ? "#030304" : "#121110");
    c.fillStyle = room;
    c.fillRect(0, 0, 512, 256);
    // the window, four panes in a frame. The real one sits at 128–187° and 15–59° up, past
    // anything the bowed edges can reflect from the room's camera angles, so it's brought
    // round towards the front until it lands on the covers' upper-left edges.
    const [wx, wy] = at(94, 38);
    const [wx2, wy2] = at(128, 2);
    const glass = c.createLinearGradient(wx, wy, wx2, wy2);
    glass.addColorStop(0, night ? "#25314d" : "#fff1cc");
    glass.addColorStop(0.6, night ? "#3a4a70" : "#ffffff");
    glass.addColorStop(1, night ? "#1c2438" : "#e9d9b4");
    c.fillStyle = glass;
    c.fillRect(wx, wy, wx2 - wx, wy2 - wy);
    c.fillStyle = night ? "#06070b" : "#5a4a38";
    c.fillRect((wx + wx2) / 2 - 1.5, wy, 3, wy2 - wy);
    c.fillRect(wx, (wy + wy2) / 2 - 1.5, wx2 - wx, 3);
    if (night) {
      // the warm light bar over the monitors, long and thin behind the gate
      const [bx, by] = at(-165, 80);
      const [bx2, by2] = at(5, 66);
      const bar = c.createLinearGradient(0, by, 0, by2);
      bar.addColorStop(0, "#3a2a14");
      bar.addColorStop(0.5, "#ffd394");
      bar.addColorStop(1, "#3a2a14");
      c.fillStyle = bar;
      c.fillRect(bx, by, bx2 - bx, by2 - by);
    }
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.needsUpdate = true;
    return texture;
  }
  const coverEnvironments = { day: coverEnvironment(false), night: coverEnvironment(true) };
  const coverMat = runtime.core.track(new THREE.MeshPhysicalMaterial({
    color: "#050608", metalness: 0, roughness: 0.09,
    clearcoat: 1, clearcoatRoughness: 0.07, ior: 1.49,
    envMap: coverEnvironments.day, envMapIntensity: 2.4,
    vertexColors: true, transparent: true, depthWrite: false,
  }));
  // Rain dims the window by day; at night the light bar carries the reflection on its own.
  function updateCoverLight() {
    const night = runtime.core.roomLight.night > 0.5;
    coverMat.envMap = night ? coverEnvironments.night : coverEnvironments.day;
    coverMat.envMapIntensity = night ? 1.1 : 2.4 * (1 - 0.6 * (runtime.room.outside?.rain ?? 0));
  }
  // The screens' glow on the desk and riser: each picture is boiled down to its mean colour as
  // it redraws, and one light in front of the row carries their blend. It's faint by day,
  // comes up as the room goes dark, and brightens on hover.
  const glowSample = document.createElement("canvas");
  glowSample.width = glowSample.height = 8;
  const glowCtx = glowSample.getContext("2d", { willReadFrequently: true });
  const screenColors = [];
  const screenTint = { color: new THREE.Color("#9fc4ff") };
  let screenLevel = 0.5;
  let glowBoost = 1;
  const glowLevel = () => (0.15 + 0.85 * runtime.core.roomLight.night) * glowBoost;
  function sampleScreen(i, canvas) {
    if (!canvas || !glowCtx) return;
    glowCtx.drawImage(canvas, 0, 0, 8, 8);
    const { data } = glowCtx.getImageData(0, 0, 8, 8);
    const rgb = [0, 0, 0];
    for (let p = 0; p < data.length; p += 4) {
      rgb[0] += data[p];
      rgb[1] += data[p + 1];
      rgb[2] += data[p + 2];
    }
    screenColors[i] = rgb.map((v) => v / 64 / 255);
    const drawn = screenColors.filter(Boolean);
    const mean = [0, 1, 2].map((c) => drawn.reduce((sum, colour) => sum + colour[c], 0) / drawn.length);
    const peak = Math.max(...mean);
    // mostly dark pictures still glow a little; the hue comes from whatever is lit
    screenLevel = Math.min(1, 0.35 + peak * 2);
    if (peak > 0.02) screenTint.color.setRGB(mean[0] / peak, mean[1] / peak, mean[2] / peak, THREE.SRGBColorSpace);
  }
  const screenGlow = runtime.room.neonLight("#9fc4ff", 0.7, () => glowLevel() * screenLevel, { distance: 2.4, tint: screenTint });
  screenGlow.position.set(0, CY, MODULE_FRONT + 0.45);
  gate.add(screenGlow);
  // Sharp pixel art at any size: plain nearest sampling at 2.3 screen pixels per art pixel draws
  // some 2 px wide and some 3, so strokes and glyphs come out uneven. Sample each texel's centre
  // instead and blend only across its edge, one screen pixel wide, so every pixel is the same
  // size and its edges stay crisp; seen from afar it falls back to the mipmaps. The chunk is
  // still an #include when this runs, so it's spelled out first or the patch finds nothing.
  function sharpPixels(shader) {
    const mapFragment = THREE.ShaderChunk.map_fragment.replace("vec4 sampledDiffuseColor = texture2D( map, vMapUv );", `
      vec2 texels = vec2( textureSize( map, 0 ) );
      vec2 texel = vMapUv * texels;
      vec2 seam = floor( texel + 0.5 );
      vec2 across = clamp( ( texel - seam ) / max( fwidth( texel ), 1e-4 ), -0.5, 0.5 );
      vec4 sampledDiffuseColor = textureGrad( map, ( seam + across ) / texels, dFdx( vMapUv ), dFdy( vMapUv ) );`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", mapFragment);
  }
  const screens = [];
  function addScreen(i, draw, every) {
    const x = (i - 2) * MODULE.pitch;
    const module = runtime.core.mesh(runtime.core.phoneSlab(MODULE.w, MODULE.h, MODULE.d, 0.08), bezelMat, { outline: 0.006 });
    module.position.set(x, CY, 0.1);
    module.name = `times-gate-module-${i}`;
    gate.add(module);
    // Thin frame behind the clear cover.
    const rim = flat(runtime.core.mesh(runtime.core.phoneSlab(MODULE.w + 0.008, MODULE.h + 0.008, 0.028, 0.075), buttonMat, { outline: 0, cast: false }));
    rim.position.set(x, CY, 0.067);
    gate.add(rim);
    const tex = canvasTexture(GATE_PX, GATE_PX);
    runtime.core.track(tex.texture);
    const panelMat = runtime.core.track(new THREE.MeshBasicMaterial({ map: tex.texture }));
    panelMat.onBeforeCompile = sharpPixels;
    const panel = flat(new THREE.Mesh(runtime.core.track(new THREE.PlaneGeometry(PANEL, PANEL)), panelMat));
    panel.position.set(x, CY, MODULE_FRONT + 0.002);
    panel.name = `times-gate-pixels-${i}`;
    gate.add(panel);
    const cover = flat(new THREE.Mesh(coverGeo, coverMat));
    cover.name = "times-gate-screen-cover";
    cover.position.set(x, CY, 0);
    gate.add(cover);
    const screen = {
      panel, every, at: -Infinity,
      redraw(t) {
        draw(tex.ctx, t);
        tex.texture.needsUpdate = true;
        sampleScreen(i, tex.canvas);
      },
    };
    screens.push(screen);
    return screen;
  }
  // The top/bottom are flat clear acrylic, not round metal rails. Their polished
  // rectangular edges catch light; the sheet ends stop before the shield bevels.
  const ACRYLIC_HALF = CAP_HALF - 0.05;
  const LOWER_ACRYLIC_Y = CY - TUBE_H / 2 - 0.005;
  const acrylicMat = runtime.core.track(new THREE.MeshPhongMaterial({
    color: "#dce8ee", specular: "#ffffff", shininess: 110,
    transparent: true, opacity: 0.24, depthWrite: false,
  }));
  const acrylicEdgeMat = runtime.core.track(new THREE.LineBasicMaterial({ color: "#e4edf2", transparent: true, opacity: 0.65 }));
  const acrylicGeo = runtime.core.track(new THREE.BoxGeometry(ACRYLIC_HALF * 2, 0.016, 0.36));
  const acrylicEdges = runtime.core.track(new THREE.EdgesGeometry(acrylicGeo));
  [-1, 1].forEach(sy => {
    const sheet = flat(new THREE.Mesh(acrylicGeo, acrylicMat));
    sheet.name = "times-gate-acrylic-sheet";
    // The lower sheet is seated in the saddle's middle channel, below its upper deck.
    sheet.position.set(0, sy < 0 ? LOWER_ACRYLIC_Y : CY + TUBE_H / 2 + 0.005, 0);
    const edges = flat(new THREE.LineSegments(acrylicEdges, acrylicEdgeMat));
    sheet.add(edges);
    gate.add(sheet);
  });
  // The top control housing has two textured paddles, a central power key and a
  // stepped front ledge. Printed hatching stays on the paddles, not across the rim.
  const clampTop = runtime.core.mesh(runtime.core.rbox(0.84, 0.12, DEPTH, 0.025), clampMat, { outline: 0.006 });
  clampTop.position.y = 0.866;
  const topRim = runtime.core.mesh(runtime.core.rbox(0.85, 0.015, 0.475, 0.006), panelMat, { outline: 0 });
  topRim.position.y = 0.925;
  const tray = runtime.core.mesh(runtime.core.rbox(0.79, 0.009, 0.405, 0.004), insetMat, { outline: 0, cast: false });
  tray.position.y = 0.935;
  gate.add(clampTop, topRim, tray);
  const controlPrint = canvasTexture(1024, 256);
  runtime.core.track(controlPrint.texture);
  const ink = controlPrint.ctx;
  ink.clearRect(0, 0, 1024, 256);
  ink.save();
  ink.strokeStyle = "rgba(255,255,255,0.22)";
  ink.lineWidth = 2;
  for (let x = -256; x < 1280; x += 12) {
    ink.beginPath(); ink.moveTo(x, 0); ink.lineTo(x + 256, 256); ink.stroke();
  }
  ink.fillStyle = "#f1f4f6";
  ink.font = "bold 42px sans-serif";
  ink.textAlign = "center";
  ink.textBaseline = "middle";
  ink.fillText("LIGHT", 256, 135);
  ink.fillText("MODE", 768, 135);
  ink.restore();
  controlPrint.texture.needsUpdate = true;
  const controlPrintMat = runtime.core.track(new THREE.MeshBasicMaterial({ map: controlPrint.texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  [-1, 1].forEach(side => {
    const padShape = new THREE.Shape([[-0.15, -0.16], [0.15, -0.16], [0.15, 0.035], [0.075, 0.135], [-0.15, 0.135]].map(([x, z]) => new THREE.Vector2(side * x, -z)));
    const padGeo = new THREE.ExtrudeGeometry(padShape, { depth: 0.021, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.004, bevelSegments: 2 });
    padGeo.rotateX(-Math.PI / 2);
    const pad = runtime.core.mesh(padGeo, clampMat, { outline: 0 });
    pad.name = side < 0 ? "times-gate-light-control" : "times-gate-mode-control";
    pad.position.set(side * 0.22, 0.941, 0);
    gate.add(pad);
    const labelGeo = runtime.core.track(new THREE.PlaneGeometry(0.27, 0.215));
    const uv = labelGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 0.5 + (side > 0 ? 0.5 : 0));
    const label = flat(new THREE.Mesh(labelGeo, controlPrintMat));
    label.rotation.x = -Math.PI / 2;
    label.position.set(0, 0.0255, -0.035);
    pad.add(label);
  });
  const power = runtime.core.mesh(runtime.core.rbox(0.105, 0.025, 0.15, 0.006), buttonMat, { outline: 0.002 });
  power.name = "times-gate-power-control";
  power.position.set(0, 0.952, -0.065);
  gate.add(power);
  const powerArc = new THREE.TorusGeometry(0.025, 0.0025, 5, 20, Math.PI * 1.5);
  powerArc.rotateZ(Math.PI * 0.75);
  powerArc.rotateX(-Math.PI / 2);
  const powerIcon = flat(runtime.core.mesh(powerArc, glintMat, { outline: 0, cast: false }));
  powerIcon.position.set(0, 0.966, -0.065);
  gate.add(powerIcon);
  const powerStem = flat(runtime.core.mesh(new THREE.BoxGeometry(0.004, 0.002, 0.023), glintMat, { outline: 0, cast: false }));
  powerStem.position.set(0, 0.966, -0.085);
  gate.add(powerStem);
  const frontLedge = runtime.core.mesh(runtime.core.rbox(0.56, 0.034, 0.075, 0.012), panelMat, { outline: 0 });
  frontLedge.position.set(0, 0.947, 0.15);
  gate.add(frontLedge);
  details(gate, new THREE.BoxGeometry(0.075, 0.002, 0.005), glintMat, [-0.16, 0.16].map(x => [x, 0.965, 0.15]));
  const microphone = flat(runtime.core.mesh(new THREE.CircleGeometry(0.0035, 10), spineMat, { outline: 0, cast: false }));
  microphone.position.set(0, 0.875, DEPTH / 2 + 0.001);
  gate.add(microphone);
  // The lower saddle is a single swept profile: a sloping grip deck, rounded
  // upper/lower lips and an inset horizontal channel across the front and back.
  const lowerProfile = [
    [-0.225, 0.12], [0.225, 0.12], [0.235, 0.13], [0.235, 0.145],
    [0.2, 0.155], [0.2, 0.175], [0.232, 0.181], [0.232, 0.186],
    [0.21, 0.189], [-0.21, 0.189], [-0.232, 0.186], [-0.232, 0.181],
    [-0.2, 0.175], [-0.2, 0.155], [-0.235, 0.145], [-0.235, 0.13],
  ];
  const lowerShape = new THREE.Shape(lowerProfile.map(([z, y]) => new THREE.Vector2(-z, y)));
  const lowerGeo = new THREE.ExtrudeGeometry(lowerShape, {
    depth: 0.84, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 3,
  });
  lowerGeo.translate(0, 0, -0.42);
  lowerGeo.rotateY(Math.PI / 2);
  const clampBottom = runtime.core.mesh(lowerGeo, clampMat, { outline: 0.003 });
  clampBottom.name = "times-gate-lower-saddle";
  clampBottom.position.y = LOWER_ACRYLIC_Y - 0.165;
  gate.add(clampBottom);
  // The deck is a low seat chamfered down to front and back. The upper lip stops short of
  // the modules so their rounded bottoms stand clear of it, 2 to 3 mm up, rather than
  // looking sunk into the white; anything taller pokes up through them and between them.
  const deckShape = new THREE.Shape([
    [-0.21, 0.185], [0.21, 0.185], [0.21, 0.187], [0.165, 0.193],
    [-0.165, 0.193], [-0.21, 0.187],
  ].map(([z, y]) => new THREE.Vector2(-z, y)));
  const deckGeo = new THREE.ExtrudeGeometry(deckShape, {
    depth: 0.848, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 3,
  });
  deckGeo.translate(0, 0, -0.424);
  deckGeo.rotateY(Math.PI / 2);
  const lowerDeck = runtime.core.mesh(deckGeo, lowerDeckMat, { outline: 0 });
  lowerDeck.name = "times-gate-lower-deck";
  clampBottom.add(lowerDeck);
  const gripMat = runtime.core.track(new THREE.MeshBasicMaterial({ color: "#171b20", transparent: true, opacity: 0.22, depthWrite: false }));
  const lowerGlintMat = runtime.core.track(new THREE.MeshBasicMaterial({ color: "#eef2f5", transparent: true, opacity: 0.28, depthWrite: false }));
  [-1, 1].forEach(face => {
    const ribs = new THREE.BoxGeometry(0.005, 0.0015, Math.hypot(0.035, 0.0047));
    ribs.rotateX(face * Math.atan2(0.006, 0.045));
    const grip = details(clampBottom, ribs, gripMat,
      Array.from({ length: 33 }, (_, i) => [(i - 16) * 0.023, 0.1938, face * 0.1875]));
    grip.name = "times-gate-lower-grip";
    const glints = details(clampBottom, new THREE.BoxGeometry(0.78, 0.002, 0.0015), lowerGlintMat,
      [[0, 0.1835, face * 0.239], [0, 0.133, face * 0.242]]);
    glints.name = "times-gate-lower-lip-reflections";
  });

  // ---------- the end arcs ----------
  // Built for the right end, x out from the capsule; the left one is the same turned half round,
  // so each carries its handle, panel and light on both faces. Each arc bows 1.6 cm out from
  // its ends (at 1 and 9.5 cm up) to 27 mm past the tube.
  const ARC = { cx: -0.374, cy: CY, out: 0.644, in: 0.544, half: Math.asin(0.425 / 0.644) };
  const PLATE_Z = 0.17;
  // the white panel's curved edge, the dark inset's, and the RGB strip between them
  const PLATE_R = ARC.in + 0.03;
  const INSET_R = 0.5;
  const rgbStrips = [];
  function bracket(side) {
    const end = new THREE.Group();
    end.position.x = side * CAP_HALF;
    end.rotation.y = side > 0 ? 0 : Math.PI;
    gate.add(end);
    // A shallow channel between rolled outer/inner lips, not one flat solid arc.
    function bandSector(inner, outer, start = -ARC.half, finish = ARC.half, face = 1) {
      const points = [];
      const steps = Math.max(2, Math.ceil((finish - start) * 32));
      for (let i = 0; i <= steps; i++) {
        const angle = start + (finish - start) * i / steps;
        points.push(new THREE.Vector2(ARC.cx + outer * Math.cos(angle), face * outer * Math.sin(angle)));
      }
      for (let i = steps; i >= 0; i--) {
        const angle = start + (finish - start) * i / steps;
        points.push(new THREE.Vector2(ARC.cx + inner * Math.cos(angle), face * inner * Math.sin(angle)));
      }
      return new THREE.Shape(points);
    }
    const band = new THREE.Shape();
    band.absarc(ARC.cx, ARC.cy, ARC.out, -ARC.half, ARC.half, false);
    band.absarc(ARC.cx, ARC.cy, ARC.in, ARC.half, -ARC.half, true);
    const bandGeo = new THREE.ExtrudeGeometry(band, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 32 });
    bandGeo.translate(0, 0, -0.2);
    end.add(runtime.core.mesh(bandGeo, silverMat, { outline: 0 }));
    [[ARC.out - 0.012, ARC.out + 0.004], [ARC.in - 0.004, ARC.in + 0.01]].forEach(([inner, outer]) => {
      const lipGeo = new THREE.ExtrudeGeometry(bandSector(inner, outer), {
        depth: 0.422, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2,
      });
      lipGeo.translate(0, CY, -0.211);
      const lip = runtime.core.mesh(lipGeo, silverMat, { outline: 0.002 });
      lip.name = "times-gate-band-lip";
      end.add(lip);
    });
    [-1, 1].forEach(sy => {
      const capGeo = new THREE.ExtrudeGeometry(bandSector(ARC.in - 0.003, ARC.out + 0.009,
        sy > 0 ? ARC.half - 0.055 : -ARC.half - 0.02,
        sy > 0 ? ARC.half + 0.02 : -ARC.half + 0.055), {
        depth: 0.432, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.004, bevelSegments: 3,
      });
      capGeo.translate(0, CY, -0.216);
      end.add(runtime.core.mesh(capGeo, silverMat, { outline: 0 }));
    });
    // The white panel filling it, between the capsule's end and the band
    const plateHalf = 0.3;
    const plateAngle = Math.asin(plateHalf / PLATE_R);
    const plate = new THREE.Shape();
    plate.moveTo(-0.02, CY - plateHalf);
    plate.lineTo(-0.02, CY + plateHalf);
    plate.lineTo(ARC.cx + PLATE_R * Math.cos(plateAngle), CY + plateHalf);
    plate.absarc(ARC.cx, ARC.cy, PLATE_R, plateAngle, -plateAngle, true);
    plate.lineTo(-0.02, CY - plateHalf);
    const plateGeo = new THREE.ExtrudeGeometry(plate, { depth: PLATE_Z * 2 - 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 24 });
    plateGeo.translate(0, 0, -(PLATE_Z * 2 - 0.02) / 2);
    end.add(runtime.core.mesh(plateGeo, panelMat, { outline: 0.009 }));
    // On each face: a dark inset in the panel, the RGB strip round the band's inner edge, and
    // the chrome handle with its orange clip. Drawn about the arc's centre line, so the back
    // face's set is the front's turned over (about x, keeping it on this side of the capsule).
    // Two separate chamfered shields behind the handle, with a recessed face inside
    // a raised metal lip. The open waist exposes the three hinge knuckles between them.
    const shieldPoints = [
      [-0.042, 0.296], [-0.012, 0.296], [0.046, 0.255], [0.072, 0.223],
      [0.105, 0.082], [0.098, 0.058], [0.032, 0.058], [-0.012, 0.08], [-0.042, 0.105],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const pocketPoints = shieldPoints.map(p => new THREE.Vector2((p.x - 0.028) * 0.78 + 0.028, (p.y - 0.177) * 0.88 + 0.177));
    const shields = [-1, 1].map(sy => {
      const outer = shieldPoints.map(p => new THREE.Vector2(p.x, sy * p.y));
      const inner = pocketPoints.map(p => new THREE.Vector2(p.x, sy * p.y));
      const shape = new THREE.Shape(outer);
      shape.holes.push(new THREE.Path(inner.slice().reverse()));
      return {
        rim: new THREE.ExtrudeGeometry(shape, {
          depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2,
        }),
        pocket: new THREE.ShapeGeometry(new THREE.Shape(inner)),
      };
    });
    const anchorGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.012, 20);
    anchorGeo.rotateX(Math.PI / 2);
    const washerGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.014, 16);
    washerGeo.rotateX(Math.PI / 2);
    const knuckleGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.12, 12);
    knuckleGeo.rotateZ(Math.PI / 2);
    // A rounded light pipe sits inside a dark channel. Both ends stop on the side
    // plate, short of its edge, instead of hanging past the body as a cut-off ring.
    const lightRadius = INSET_R + 0.021;
    const lightHalf = Math.asin((plateHalf - 0.025) / (lightRadius + 0.016));
    function lightChannel(width) {
      const halfWidth = width / 2;
      const shape = new THREE.Shape();
      shape.absarc(ARC.cx, 0, lightRadius + halfWidth, -lightHalf, lightHalf, false);
      shape.absarc(ARC.cx + lightRadius * Math.cos(lightHalf), lightRadius * Math.sin(lightHalf), halfWidth, lightHalf, lightHalf + Math.PI, false);
      shape.absarc(ARC.cx, 0, lightRadius - halfWidth, lightHalf, -lightHalf, true);
      shape.absarc(ARC.cx + lightRadius * Math.cos(lightHalf), -lightRadius * Math.sin(lightHalf), halfWidth, Math.PI - lightHalf, Math.PI * 2 - lightHalf, false);
      return new THREE.ShapeGeometry(shape, 48);
    }
    const channelGeo = lightChannel(0.032);
    const stripGeo = lightChannel(0.023);
    stripGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(stripGeo.attributes.position.count * 3), 3));
    runtime.core.track(stripGeo);
    const stripMat = runtime.core.track(new THREE.MeshBasicMaterial({ vertexColors: true }));
    const handlePath = new THREE.CatmullRomCurve3([
      [0.005, 0.17, 0.025], [0.055, 0.15, 0.055], [0.095, 0.1, 0.065],
      [0.095, -0.1, 0.065], [0.055, -0.15, 0.055], [0.005, -0.17, 0.025],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, "centripetal");
    const handleGeo = new THREE.TubeGeometry(handlePath, 40, 0.014, 8, false);
    const clipGeo = runtime.core.rbox(0.042, 0.06, 0.034, 0.01);
    [1, -1].forEach((face) => {
      const decor = new THREE.Group();
      decor.position.set(0, CY, face * (PLATE_Z + 0.002));
      decor.rotation.x = face > 0 ? 0 : Math.PI;
      end.add(decor);
      const bandFace = new THREE.Group();
      bandFace.position.set(0, 0, 0.035);
      decor.add(bandFace);
      const recess = flat(runtime.core.mesh(new THREE.ShapeGeometry(bandSector(0.557, 0.63, -ARC.half + 0.035, ARC.half - 0.035, face)), panelMat, { outline: 0, cast: false }));
      recess.name = "times-gate-band-recess";
      bandFace.add(recess);
      // Curved, slightly tapering vent slots and three angular recessed bays.
      const ventShapes = Array.from({ length: 12 }, (_, i) => {
        const angle = 0.13 + i * 0.038;
        return bandSector(0.586 - i * 0.0003, 0.61 + i * 0.0003, angle, angle + 0.026, face);
      });
      const vents = flat(runtime.core.mesh(new THREE.ShapeGeometry(ventShapes), spineMat, { outline: 0, cast: false }));
      vents.name = "times-gate-band-vents";
      vents.position.z = 0.002;
      bandFace.add(vents);
      const bays = [[-0.10, -0.10, -0.29, -0.21], [-0.25, -0.33, -0.49, -0.42], [-0.46, -0.53, -0.67, -0.60]].map(angles => {
        const radii = [0.561, 0.626, 0.626, 0.561];
        return angles.map((angle, i) => new THREE.Vector2(ARC.cx + radii[i] * Math.cos(angle), face * radii[i] * Math.sin(angle)));
      });
      const bayGrooves = flat(runtime.core.mesh(new THREE.ShapeGeometry(bays.map(points => new THREE.Shape(points))), insetMat, { outline: 0, cast: false }));
      bayGrooves.name = "times-gate-band-panel-grooves";
      bayGrooves.position.z = 0.002;
      bandFace.add(bayGrooves);
      const bayFaces = bays.map(points => {
        const center = points.reduce((sum, p) => sum.add(p), new THREE.Vector2()).multiplyScalar(1 / points.length);
        return new THREE.Shape(points.map(p => p.clone().sub(center).multiplyScalar(0.82).add(center)));
      });
      const bayPanels = flat(runtime.core.mesh(new THREE.ShapeGeometry(bayFaces), panelMat, { outline: 0, cast: false }));
      bayPanels.position.z = 0.003;
      bandFace.add(bayPanels);
      const seamBed = flat(runtime.core.mesh(new THREE.ShapeGeometry(bandSector(0.553, 0.633, -0.065, 0.065, face)), spineMat, { outline: 0, cast: false }));
      seamBed.position.z = 0.002;
      bandFace.add(seamBed);
      const seamInsert = flat(runtime.core.mesh(new THREE.ShapeGeometry(bandSector(0.56, 0.626, -0.041, 0.041, face)), orangeMat, { outline: 0, cast: false }));
      seamInsert.position.z = 0.003;
      bandFace.add(seamInsert);
      shields.forEach(({ rim: rimGeo, pocket: pocketGeo }) => {
        const shield = new THREE.Group();
        shield.name = "times-gate-handle-shield";
        const rim = flat(runtime.core.mesh(rimGeo, panelMat, { outline: 0.002, cast: false }));
        const pocket = flat(runtime.core.mesh(pocketGeo, insetMat, { outline: 0, cast: false }));
        rim.position.z = 0.003;
        pocket.position.z = 0.006;
        pocket.name = "times-gate-shield-recess";
        shield.add(rim, pocket);
        decor.add(shield);
      });
      const channel = flat(runtime.core.mesh(channelGeo, spineMat, { outline: 0, cast: false }));
      channel.name = "times-gate-rgb-channel";
      channel.position.z = 0.001;
      decor.add(channel);
      const strip = flat(new THREE.Mesh(stripGeo, stripMat));
      strip.name = "times-gate-rgb-diffuser";
      strip.position.z = 0.0025;
      decor.add(strip);
      const handle = runtime.core.mesh(handleGeo, chromeMat, { outline: 0.004 });
      handle.name = "times-gate-handle";
      decor.add(handle);
      const anchors = [[0.005, 0.17, 0.015], [0.005, -0.17, 0.015]];
      details(decor, anchorGeo, panelMat, anchors);
      details(decor, washerGeo, chromeMat, anchors.map(([x, y, z]) => [x, y, z + 0.006]));
      const knuckles = details(decor, knuckleGeo, chromeMat, [-0.025, 0, 0.025].map(y => [0.04, y, 0.028]));
      knuckles.name = "times-gate-handle-hinge";
      // Handle anchors with inset hex sockets, above and below the centre seam.
      const bolts = [[0.005, 0.17, 0.031], [0.005, -0.17, 0.031], [-0.018, 0.267, 0.021], [-0.018, -0.267, 0.021]];
      details(decor, boltGeo.clone(), chromeMat, bolts);
      details(decor, boltSocketGeo.clone(), spineMat, bolts.map(([x, y, z]) => [x, y, z + 0.005]));
      const clip = runtime.core.mesh(clipGeo, chromeMat, { outline: 0.003 });
      clip.position.set(0.095, 0, 0.06);
      decor.add(clip);
      const seam = flat(runtime.core.mesh(new THREE.BoxGeometry(0.095, 0.012, 0.008), spineMat, { outline: 0, cast: false }));
      seam.position.set(0.19, 0, 0.028);
      decor.add(seam);
    });
    rgbStrips.push(stripGeo);
    // A chrome hinge at the band's foot, on an orange rubber foot that splays out to 14.15 cm
    // from the middle, as deep as the gate
    // Keep the hinge clear of the foot's bevel: coincident front faces used to
    // alternate orange/metal pixels as the hover animation moved the model.
    const HINGE = { x: 0.12, y: 0.146, r: 0.048 };
    const hinge = runtime.core.mesh(new THREE.CylinderGeometry(HINGE.r, HINGE.r, DEPTH, 20), chromeMat, { outline: 0.007 });
    hinge.name = "times-gate-foot-hinge";
    hinge.rotation.x = Math.PI / 2;
    hinge.position.set(HINGE.x, HINGE.y, 0);
    end.add(hinge);
    [-1, 1].forEach((sz) => {
      const cap = flat(runtime.core.mesh(new THREE.CylinderGeometry(0.041, 0.041, 0.01, 24), silverMat, { outline: 0.002, cast: false }));
      cap.name = "times-gate-foot-pivot-cap";
      cap.rotation.x = Math.PI / 2;
      cap.position.set(HINGE.x, HINGE.y, sz * (DEPTH / 2 + 0.004));
      end.add(cap);
      const capNotches = Array.from({ length: 3 }, (_, i) => {
        const angle = i * Math.PI * 2 / 3 + Math.PI / 6;
        return [HINGE.x + 0.033 * Math.cos(angle), HINGE.y + 0.033 * Math.sin(angle), sz * (DEPTH / 2 + 0.01), angle];
      });
      details(end, new THREE.BoxGeometry(0.007, 0.003, 0.002), spineMat, capNotches);
    });
    const FOOT_OUT = 1.415 - CAP_HALF - 0.01;
    // Flared low-profile foot: a narrow toe, rounded pivot lobe and a raised heel.
    // Its plan outline follows the product's rubber moulding rather than a rectangular block.
    const footPlan = new THREE.Shape();
    footPlan.moveTo(-0.07, -0.135);
    footPlan.lineTo(0.045, -0.16);
    footPlan.quadraticCurveTo(0.09, -0.235, 0.155, -0.225);
    footPlan.lineTo(FOOT_OUT - 0.02, -0.18);
    footPlan.quadraticCurveTo(FOOT_OUT, -0.18, FOOT_OUT, -0.155);
    footPlan.lineTo(FOOT_OUT, 0.155);
    footPlan.quadraticCurveTo(FOOT_OUT, 0.18, FOOT_OUT - 0.02, 0.18);
    footPlan.lineTo(0.155, 0.225);
    footPlan.quadraticCurveTo(0.09, 0.235, 0.045, 0.16);
    footPlan.lineTo(-0.07, 0.135);
    footPlan.closePath();
    const footGeo = new THREE.ExtrudeGeometry(footPlan, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 12 });
    footGeo.rotateX(-Math.PI / 2);
    footGeo.translate(0, 0.018, 0);
    const footBody = runtime.core.mesh(footGeo, orangeMat, { outline: 0.009 });
    footBody.name = "times-gate-foot";
    end.add(footBody);
    const soleGeo = new THREE.ExtrudeGeometry(footPlan, { depth: 0.01, bevelEnabled: false, curveSegments: 12 });
    soleGeo.rotateX(-Math.PI / 2);
    const sole = flat(runtime.core.mesh(soleGeo, rubberMat, { outline: 0, cast: false }));
    sole.position.y = 0.006;
    end.add(sole);
    const heelShape = new THREE.Shape([[-0.06, 0.055], [0.22, 0.055], [0.16, 0.086], [0.02, 0.086]].map(([x, y]) => new THREE.Vector2(x, y)));
    const heelGeo = new THREE.ExtrudeGeometry(heelShape, { depth: 0.27, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2 });
    heelGeo.translate(0, 0, -0.135);
    end.add(runtime.core.mesh(heelGeo, orangeMat, { outline: 0.003 }));
    const cradleGeo = new THREE.RingGeometry(0.05, 0.068, 24, 1, Math.PI, Math.PI);
    [-1, 1].forEach(sz => {
      const cradle = flat(runtime.core.mesh(cradleGeo, orangeMat, { outline: 0, cast: false }));
      cradle.position.set(HINGE.x, HINGE.y, sz * 0.228);
      cradle.rotation.y = sz > 0 ? 0 : Math.PI;
      end.add(cradle);
    });
    // Two exposed bent metal stays connect the bowed side panel to its hinge.
    [-1, 1].forEach(sz => {
      const stayPath = new THREE.CatmullRomCurve3([
        [0.265, CY - 0.02, sz * 0.16], [0.31, 0.42, sz * 0.22],
        [0.24, 0.2, sz * 0.22], [HINGE.x, HINGE.y + 0.025, sz * 0.16],
      ].map(p => new THREE.Vector3(...p)));
      end.add(runtime.core.mesh(new THREE.TubeGeometry(stayPath, 20, 0.012, 6, false), chromeMat, { outline: 0.003 }));
    });
    return end;
  }
  bracket(1);
  bracket(-1);
  boltGeo.dispose();
  boltSocketGeo.dispose();

  // Retain the resting foot silhouettes while the visible gate lifts. These two
  // invisible meshes share the real foot geometry, so open space stays unclickable.
  const footHits = new THREE.Group();
  footHits.name = "times-gate-resting-foot-hits";
  const footHitMat = runtime.core.track(new THREE.MeshBasicMaterial({ visible: false }));
  gate.updateWorldMatrix(true, true);
  const gateInverse = gate.matrixWorld.clone().invert();
  gate.traverse(part => {
    if (part.name !== "times-gate-foot") return;
    const hit = new THREE.Mesh(part.geometry, footHitMat);
    hit.name = "times-gate-foot-hit";
    hit.applyMatrix4(new THREE.Matrix4().multiplyMatrices(gateInverse, part.matrixWorld));
    footHits.add(hit);
  });
  gate.add(footHits);

  // ---------- the five widgets ----------
  // 1. Today's weather where the visitor is (the window's forecast; see weather)
  const weatherScreen = addScreen(0, (c, t) => drawGateWeather(c, { weather: runtime.weather.weather, place: runtime.weather.placeName, t }), 250);
  runtime.weather.refreshWeather();
  // 2. GitHub contributions over the past year, the last thirteen weeks as a grid
  let github = null;
  async function loadGithub() {
    try {
      const res = await fetch(GITHUB_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { total, contributions } = await res.json();
      const today = new Date().toLocaleDateString("en-CA");
      const past = contributions.filter((d) => d.date <= today).sort((a, b) => (a.date < b.date ? -1 : 1));
      // a column a week, ending on this week's column at today's weekday
      const weekday = new Date(`${past[past.length - 1].date}T12:00:00Z`).getUTCDay();
      const days = [...past.slice(-(12 * 7 + weekday + 1)), ...Array(6 - weekday).fill(null)];
      // the run of days with something on them, up to today (or yesterday, if today's still empty)
      let streak = 0;
      for (let i = past.length - 1 - (past[past.length - 1].count ? 0 : 1); i >= 0 && past[i].count > 0; i--) streak++;
      github = { total: total.lastYear ?? Object.values(total).pop(), days, streak };
    } catch {
      github = { error: true };
    }
    if (!runtime.core.destroyed) runtime.core.timers.push(setTimeout(loadGithub, 30 * 60000));
  }
  addScreen(1, (c, t) => drawGateGithub(c, { github, t }), 200);
  loadGithub();
  // 3. How many have come by, counted up on the flaps when it arrives
  const visitors = { count: null, shown: 0, error: false };
  async function loadVisitors() {
    try {
      visitors.count = await getVisits();
    } catch {
      visitors.error = true;
    }
  }
  addScreen(2, (c, t) => drawGateVisitors(c, { ...visitors, t }), 70);
  loadVisitors();
  // 4. The room's own frame rate, measured over each half second, with its recent history; a
  // half second drawn wholly at the still room's pace counts as idle
  const perf = { fps: 60, ms: 16.7, idle: false, history: [], frames: 0, busy: false, since: 0 };
  addScreen(3, (c) => drawGatePerformance(c, { ...perf, gpu: runtime.core.gpuMs }), 500);
  // 5. Byte, a pocket monster of the desk's own: it wanders its patch of grass, sleeps when the
  // room's lights go down, and crackles happily (hearts up) when the gate is clicked in its
  // close-up. Its hearts fade a little each minute nobody pets it.
  const pet = { x: 16, target: 16, facing: 1, mood: "idle", since: 0, hearts: 3, fed: 0, bursts: [], pettedAt: -Infinity, decayAt: 0, nextMove: 2 };
  function updatePet(t) {
    const night = runtime.core.roomLight.night > 0.5;
    if (!pet.decayAt) pet.decayAt = t + 60;
    if (t > pet.decayAt) {
      pet.hearts = Math.max(1, pet.hearts - 1);
      pet.decayAt = t + 60;
    }
    if (pet.mood === "happy" && t - pet.since > 1.6) pet.mood = "idle";
    if (pet.mood !== "happy") {
      if (night && t - pet.pettedAt > 8) pet.mood = "sleep";
      else if (pet.mood === "sleep") pet.mood = "idle";
    }
    if (pet.mood === "idle" && t > pet.nextMove) {
      pet.target = 10 + Math.random() * 14;
      pet.mood = "walk";
    }
    if (pet.mood === "walk") {
      const dx = pet.target - pet.x;
      pet.facing = Math.sign(dx) || pet.facing;
      pet.x += Math.sign(dx) * Math.min(Math.abs(dx), 1.2);
      if (Math.abs(dx) < 0.5) {
        pet.mood = "idle";
        pet.nextMove = t + 2 + Math.random() * 4;
      }
    }
  }
  addScreen(4, (c, t) => {
    updatePet(t);
    drawGatePet(c, { pet, night: runtime.core.roomLight.night > 0.5, t });
  }, 150);
  function petByte() {
    const t = performance.now() / 1000;
    pet.hearts = Math.min(5, pet.hearts + 1);
    pet.decayAt = t + 60;
    pet.mood = "happy";
    pet.since = pet.pettedAt = t;
    pet.fed = t + 4;
    pet.bursts = [0, 0.25, 0.5].map((delay, i) => ({ at: t + delay, x: Math.round(pet.x) + [2, 20, 11][i] }));
    screens[4].at = -Infinity;
    sfx.chirp();
  }

  // ---------- light and motion ----------
  const stripColor = new THREE.Color();
  let stripsAt = 0;
  function updateStrips(t) {
    rgbStrips.forEach((geometry, k) => {
      const position = geometry.attributes.position;
      const color = geometry.attributes.color;
      for (let i = 0; i < position.count; i++) {
        const along = Math.atan2(position.getY(i), position.getX(i) - ARC.cx) / (ARC.half * 2) + 0.5;
        stripColor.setHSL((along * 0.35 + t * 0.12 + k * 0.25) % 1, 1, 0.55);
        color.setXYZ(i, stripColor.r, stripColor.g, stripColor.b);
      }
      color.needsUpdate = true;
    });
  }
  function updateTimesGate(now, still = false) {
    if (!perf.since) perf.since = now;
    perf.frames++;
    if (!still) perf.busy = true;
    if (now - perf.since >= 500) {
      perf.fps = perf.frames * 1000 / (now - perf.since);
      perf.ms = 1000 / perf.fps;
      perf.idle = !perf.busy;
      perf.history.push({ fps: perf.fps, idle: perf.idle });
      if (perf.history.length > 58) perf.history.shift();
      perf.frames = 0;
      perf.busy = false;
      perf.since = now;
    }
    if (visitors.count !== null && visitors.shown !== visitors.count) {
      visitors.shown += (visitors.count - visitors.shown) * 0.08 + Math.sign(visitors.count - visitors.shown) * 0.2;
      if (Math.abs(visitors.count - visitors.shown) < 0.5) visitors.shown = visitors.count;
    }
    updateCoverLight();
    const t = now / 1000;
    screens.forEach((screen) => {
      if (now - screen.at < screen.every) return;
      screen.at = now;
      screen.redraw(t);
    });
    // (both faces of an arc share its strip, so it's coloured once)
    if (now - stripsAt > 60) {
      stripsAt = now;
      updateStrips(t);
    }
  }
  // the first frame drawn before the loop starts, so nothing shows blank behind the loader
  screens.forEach((screen) => screen.redraw(0));
  weatherScreen.at = -Infinity;
  updateStrips(0);

  runtime.core.register(gate, {
    focus: "timesgate",
    onHover: (on) => {
      gsap.to(gate.position, {
        y: on ? 0.04 : 0, duration: 0.25, ease: "power2.out", overwrite: true,
        onUpdate: () => { footHits.position.y = -gate.position.y; },
      });
      glowBoost = on ? 1.3 : 1;
      if (on) hoverSound(gate, (s) => s.blip());
    },
    onArrive: () => {
      if (pet.mood === "sleep") return;
      pet.mood = "happy";
      pet.since = performance.now() / 1000;
    },
    onClick: () => {
      gsap.fromTo(gate.scale, { x: 1.03, y: 0.95, z: 1.03 }, { x: 1, y: 1, z: 1, duration: 0.45, ease: "elastic.out(1.2, 0.4)" });
      petByte();
    },
  });

  // Public state used by the other scene parts.
  return {
    gate,
    GATE_CY: CY,
    updateTimesGate,
    setTimesGateFinish,
  };
}
