import * as THREE from "three";
import gsap from "gsap";
import { hoverSound, sfx } from "@/shared/composables/useSfx";
import {
  canvasTexture, drawBrushedMetal, GATE_PX, drawGateWeather, drawGateGithub, drawGateVisitors, drawGatePerformance, drawGatePet,
} from "../textures";

// Where the widgets read their numbers from. The contributions are GitHub's own calendar, as
// served (no key) by github-contributions-api.jogruber.de; the visit count is a free Abacus
// counter, bumped once a browser session on the live site and only read on a local one.
const GITHUB_USER = "okasutarto";
const GITHUB_URL = `https://github-contributions-api.jogruber.de/v4/${GITHUB_USER}?y=last`;
const COUNTER_URL = "https://abacus.jasoncameron.dev";
const COUNTER_KEY = "okasputra-desk/visits";
const COUNTED_FLAG = "desk-visit-counted";

export function createTimesGate(runtime) {
  // ---------- Divoom Times Gate 2: five pixel screens on an open frame ----------
  // Stood on the desk in front of the riser, under the monitor, at its real 283 × 47 × 97 mm:
  // four chrome rails frame five domed 1.44" LCDs on a black spine, left open (no glass in
  // front, so the pixels show clean), clamped top and bottom by a silver block, between two brushed-silver arcs
  // that bow out at either end. Inside each arc a white panel carries a chrome grab handle and
  // an RGB strip glowing round the arc's inner edge; the arcs stand on chrome hinges over
  // orange rubber feet that splay out past them.
  const gate = new THREE.Group();
  gate.name = "times-gate-2";
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
  const panelMat = runtime.core.toon("#eef0f3");
  const insetMat = runtime.core.toon("#2a2e36");
  const spineMat = runtime.core.toon("#262a31");
  const bezelMat = runtime.core.toon("#0b0c0f");
  const chromeMat = runtime.core.toon("#f2f5f8");
  chromeMat.emissive.set("#ffffff");
  chromeMat.emissiveIntensity = 0.12;
  const orangeMat = runtime.core.toon("#ff6b2c");
  const buttonMat = runtime.core.toon("#9aa2ac");
  const flat = (part) => ((part.raycast = runtime.core.noRaycast), part);

  // ---------- the capsule ----------
  // The black spine the screens are mounted on
  const spine = runtime.core.mesh(runtime.core.rbox(CAP_HALF * 2 + 0.02, TUBE_H - 0.06, 0.24, 0.05), spineMat, { outline: 0.008 });
  spine.position.set(0, CY, -0.06);
  gate.add(spine);
  // Five rounded modules, each a glossy black bezel round its 26 mm square 128 × 128 panel.
  // The panels show their pixels square and sharp (no smoothing when the camera's close).
  const MODULE = { w: 0.33, h: 0.42, d: 0.08, pitch: 0.37 };
  const PANEL = 0.26;
  const MODULE_FRONT = 0.1 + MODULE.d / 2;
  const screens = [];
  function addScreen(i, draw, every) {
    const x = (i - 2) * MODULE.pitch;
    const module = runtime.core.mesh(runtime.core.phoneSlab(MODULE.w, MODULE.h, MODULE.d, 0.08), bezelMat, { outline: 0.006 });
    module.position.set(x, CY, 0.1);
    gate.add(module);
    const tex = canvasTexture(GATE_PX, GATE_PX);
    runtime.core.track(tex.texture);
    tex.texture.magFilter = THREE.NearestFilter;
    const panel = flat(new THREE.Mesh(runtime.core.track(new THREE.PlaneGeometry(PANEL, PANEL)), runtime.core.track(new THREE.MeshBasicMaterial({ map: tex.texture }))));
    panel.position.set(x, CY, MODULE_FRONT + 0.002);
    gate.add(panel);
    const screen = {
      panel, every, at: -Infinity,
      redraw(t) {
        draw(tex.ctx, t);
        tex.texture.needsUpdate = true;
      },
    };
    screens.push(screen);
    return screen;
  }
  // A chrome rail along each of the frame's four long edges
  [-1, 1].forEach((sy) => [-1, 1].forEach((sz) => {
    gate.add(runtime.core.rod(new THREE.Vector3(-CAP_HALF - 0.02, CY + sy * (TUBE_H / 2 + 0.005), sz * 0.17), new THREE.Vector3(CAP_HALF + 0.02, CY + sy * (TUBE_H / 2 + 0.005), sz * 0.17), 0.018, chromeMat, 0.007));
  }));
  // The clamps across the middle: a silver block over the top (up to 9.7 cm) with its two
  // buttons in a recessed tray, a lower block under the bottom with a ribbed grip
  const clampTop = runtime.core.mesh(runtime.core.rbox(0.84, 0.16, DEPTH, 0.035), silverMat, { outline: 0.012 });
  clampTop.position.y = 0.97 - 0.08 - 0.02;
  const tray = runtime.core.mesh(runtime.core.rbox(0.6, 0.01, 0.28, 0.004), buttonMat, { outline: 0, cast: false });
  tray.position.y = 0.951;
  gate.add(clampTop, tray);
  [-0.13, 0.13].forEach((x) => {
    const button = runtime.core.mesh(runtime.core.rbox(0.17, 0.02, 0.11, 0.008), panelMat, { outline: 0.005 });
    button.position.set(x, 0.96, 0);
    gate.add(button);
  });
  const clampBottom = runtime.core.mesh(runtime.core.rbox(0.8, 0.16, DEPTH, 0.035), silverMat, { outline: 0.012 });
  clampBottom.position.y = CY - TUBE_H / 2 - 0.07;
  gate.add(clampBottom);
  for (let i = -3; i <= 3; i++) {
    const rib = flat(runtime.core.mesh(runtime.core.rbox(0.035, 0.08, 0.006, 0.002), spineMat, { outline: 0, cast: false }));
    rib.position.set(i * 0.08, clampBottom.position.y, DEPTH / 2 + 0.002);
    gate.add(rib);
  }

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
    // The bowed band: an arc of brushed silver, its ends cut square to the curve
    const band = new THREE.Shape();
    band.absarc(ARC.cx, ARC.cy, ARC.out, -ARC.half, ARC.half, false);
    band.absarc(ARC.cx, ARC.cy, ARC.in, ARC.half, -ARC.half, true);
    const bandGeo = new THREE.ExtrudeGeometry(band, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.018, bevelSegments: 3, curveSegments: 28 });
    bandGeo.translate(0, 0, -0.2);
    end.add(runtime.core.mesh(bandGeo, silverMat, { outline: 0.012 }));
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
    const insetHalf = 0.22;
    const insetAngle = Math.asin(insetHalf / INSET_R);
    const inset = new THREE.Shape();
    inset.moveTo(0.015, -insetHalf);
    inset.lineTo(0.015, insetHalf);
    inset.lineTo(ARC.cx + INSET_R * Math.cos(insetAngle), insetHalf);
    inset.absarc(ARC.cx, 0, INSET_R, insetAngle, -insetAngle, true);
    inset.lineTo(0.015, -insetHalf);
    const insetGeo = new THREE.ShapeGeometry(inset, 20);
    const stripGeo = new THREE.RingGeometry(INSET_R + 0.006, ARC.in - 0.008, 40, 1, -ARC.half * 0.9, ARC.half * 1.8);
    stripGeo.translate(ARC.cx, 0, 0);
    stripGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(stripGeo.attributes.position.count * 3), 3));
    runtime.core.track(stripGeo);
    const stripMat = runtime.core.track(new THREE.MeshBasicMaterial({ vertexColors: true }));
    const handlePath = new THREE.CatmullRomCurve3([
      [-0.01, 0.14, 0], [0.055, 0.14, 0.05], [0.095, 0.09, 0.06], [0.095, -0.09, 0.06], [0.055, -0.14, 0.05], [-0.01, -0.14, 0],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, "centripetal");
    const handleGeo = new THREE.TubeGeometry(handlePath, 40, 0.014, 8, false);
    const clipGeo = runtime.core.rbox(0.042, 0.06, 0.034, 0.01);
    [1, -1].forEach((face) => {
      const decor = new THREE.Group();
      decor.position.set(0, CY, face * (PLATE_Z + 0.002));
      decor.rotation.x = face > 0 ? 0 : Math.PI;
      end.add(decor);
      decor.add(flat(runtime.core.mesh(insetGeo, insetMat, { outline: 0, cast: false })));
      const strip = flat(new THREE.Mesh(stripGeo, stripMat));
      strip.position.z = 0.002;
      decor.add(strip);
      decor.add(runtime.core.mesh(handleGeo, chromeMat, { outline: 0.005 }));
      const clip = runtime.core.mesh(clipGeo, orangeMat, { outline: 0.004 });
      clip.position.set(0.095, 0, 0.06);
      decor.add(clip);
    });
    rgbStrips.push(stripGeo);
    // An orange tab on the band's outer face, at its middle
    const tab = runtime.core.mesh(runtime.core.rbox(0.045, 0.11, 0.26, 0.014), orangeMat, { outline: 0.007 });
    tab.position.set(ARC.cx + ARC.out + 0.005, CY, 0);
    end.add(tab);
    // A chrome hinge at the band's foot, on an orange rubber foot that splays out to 14.15 cm
    // from the middle, as deep as the gate
    const HINGE = { x: 0.12, y: 0.085, r: 0.048 };
    const hinge = runtime.core.mesh(new THREE.CylinderGeometry(HINGE.r, HINGE.r, DEPTH, 20), chromeMat, { outline: 0.007 });
    hinge.rotation.x = Math.PI / 2;
    hinge.position.set(HINGE.x, HINGE.y, 0);
    end.add(hinge);
    [-1, 1].forEach((sz) => {
      const cap = flat(runtime.core.mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.01, 16), buttonMat, { outline: 0, cast: false }));
      cap.rotation.x = Math.PI / 2;
      cap.position.set(HINGE.x, HINGE.y, sz * (DEPTH / 2 + 0.004));
      end.add(cap);
    });
    const FOOT_OUT = 1.415 - CAP_HALF - 0.01;
    const foot = new THREE.Shape([[-0.08, 0], [FOOT_OUT, 0], [FOOT_OUT, 0.022], [0.2, 0.075], [-0.04, 0.075], [-0.08, 0.045]].map(([x, y]) => new THREE.Vector2(x, y)));
    const footGeo = new THREE.ExtrudeGeometry(foot, { depth: DEPTH - 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 });
    footGeo.translate(0, 0.01, -(DEPTH - 0.02) / 2);
    end.add(runtime.core.mesh(footGeo, orangeMat, { outline: 0.009 }));
    return end;
  }
  bracket(1);
  bracket(-1);

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
    let counted = false;
    try { counted = sessionStorage.getItem(COUNTED_FLAG) === "1"; } catch { /* Storage is optional. */ }
    const bump = process.env.NODE_ENV === "production" && !counted;
    try {
      const res = await fetch(`${COUNTER_URL}/${bump ? "hit" : "get"}/${COUNTER_KEY}`);
      // (a counter nobody has bumped yet isn't there to read)
      if (res.status === 404) visitors.count = 0;
      else if (!res.ok) throw new Error(`HTTP ${res.status}`);
      else visitors.count = (await res.json()).value ?? 0;
      if (bump) try { sessionStorage.setItem(COUNTED_FLAG, "1"); } catch { /* Storage is optional. */ }
    } catch {
      visitors.error = true;
    }
  }
  addScreen(2, (c, t) => drawGateVisitors(c, { ...visitors, t }), 70);
  loadVisitors();
  // 4. The room's own frame rate, measured over each half second, with its recent history
  const perf = { fps: 60, ms: 16.7, history: [], frames: 0, since: 0 };
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
  let stripBoost = 1;
  let stripsAt = 0;
  function updateStrips(t) {
    rgbStrips.forEach((geometry, k) => {
      const position = geometry.attributes.position;
      const color = geometry.attributes.color;
      for (let i = 0; i < position.count; i++) {
        const along = Math.atan2(position.getY(i), position.getX(i) - ARC.cx) / (ARC.half * 2) + 0.5;
        stripColor.setHSL((along * 0.35 + t * 0.12 + k * 0.25) % 1, 1, 0.55 * stripBoost);
        color.setXYZ(i, stripColor.r, stripColor.g, stripColor.b);
      }
      color.needsUpdate = true;
    });
  }
  function updateTimesGate(now) {
    if (!perf.since) perf.since = now;
    perf.frames++;
    if (now - perf.since >= 500) {
      perf.fps = perf.frames * 1000 / (now - perf.since);
      perf.ms = 1000 / perf.fps;
      perf.history.push(perf.fps);
      if (perf.history.length > 58) perf.history.shift();
      perf.frames = 0;
      perf.since = now;
    }
    if (visitors.count !== null && visitors.shown !== visitors.count) {
      visitors.shown += (visitors.count - visitors.shown) * 0.08 + Math.sign(visitors.count - visitors.shown) * 0.2;
      if (Math.abs(visitors.count - visitors.shown) < 0.5) visitors.shown = visitors.count;
    }
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
      gsap.to(gate.position, { y: on ? 0.04 : 0, duration: 0.25, ease: "power2.out", overwrite: true });
      stripBoost = on ? 1.35 : 1;
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
  };
}
