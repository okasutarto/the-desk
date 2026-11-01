import * as THREE from "three";
import gsap from "gsap";
import { sfx } from "@/shared/composables/useSfx";
import { canvasTexture, drawKeyLabel, drawDeskMat } from "../textures";

export function createKeyboard(runtime) {
  // ---------- keyboard: NuPhy Halo75 V2, Obsidian Black ----------
  // Every key is its own cap with its legend printed on top, keyed by KeyboardEvent.code, so the
  // key you press on your own keyboard presses the very same key on the desk.
  // A felt desk mat under the keyboard and the mouse, wide enough for the mouse's run
  const MAT_TOP = 0.03;
  const matMat = runtime.core.toon("#ffffff");
  const matPrint = canvasTexture(1360, 460);
  runtime.core.track(matPrint.texture);
  drawDeskMat(matPrint.ctx, 1360, 460);
  matMat.map = matPrint.texture;
  // The print goes on the top alone. Box uv squeeze the whole print onto each 3 mm edge, and
  // where an edge rolls over toward the top its blur showed as a pale line along the mat's side
  // (box faces: +x, −x, top, bottom, +z, −z)
  const matEdge = runtime.core.toon("#2b3a5c");
  const deskMatPad = runtime.core.mesh(runtime.core.rbox(6.8, MAT_TOP, 3.0, 0.014), [matEdge, matEdge, matMat, matEdge, matEdge, matEdge], { outline: 0.03, cast: false });
  // centred on the desk, with the keyboard left of its middle and the mouse to its right
  // Centred on the desk (x −1), in line with the riser and monitor
  deskMatPad.position.set(-1, MAT_TOP / 2, 0.75);
  // The mat is so thin its whole rim is the rounded edge, and only the rim's lower half (facing
  // away from the camera) draws the outline, pushed along normals that lean down: along its left
  // end, from the opening view, down on screen is back into the mat, and the outline there
  // thinned to a hairline beside the full line round the rest. Its outline pushes straight out
  // in plan instead (the normals laid flat), and is drawn a little nearer so the desk it lies
  // on doesn't bury it. (Its own copy of the material shares the screen-size uniforms.)
  const matHull = deskMatPad.children[0];
  const matHullGeo = matHull.geometry.clone();
  const matHullNormal = matHullGeo.attributes.normal;
  for (let i = 0; i < matHullNormal.count; i++) {
    const x = matHullNormal.getX(i);
    const z = matHullNormal.getZ(i);
    const flat = Math.hypot(x, z);
    if (flat > 1e-3) matHullNormal.setXYZ(i, x / flat, 0, z / flat);
  }
  matHull.geometry = runtime.core.track(matHullGeo);
  const matOutline = runtime.core.track(matHull.material.clone());
  matOutline.uniforms = matHull.material.uniforms;
  matOutline.polygonOffset = true;
  matOutline.polygonOffsetFactor = -4;
  matOutline.polygonOffsetUnits = -4;
  matHull.material = matOutline;
  runtime.core.scene.add(deskMatPad);

  const KEYBOARD_SCALE = 0.68;
  const keyboard = new THREE.Group();
  keyboard.scale.setScalar(KEYBOARD_SCALE);
  keyboard.position.set(-1.7, MAT_TOP, 0.75);
  runtime.core.scene.add(keyboard);
  // A black aluminium case on a smoky see-through bottom, with the Halo's light bar glowing along
  // its left end
  const KEY_UNIT = 0.28;
  const KEY_GAP = 0.018;
  const KEYS_W = 16 * KEY_UNIT;
  const KEYS_D = 6 * KEY_UNIT;
  const CASE_W = KEYS_W + 0.22;
  // 320 × 135 mm at KEYBOARD_SCALE, the Halo75 V2's real footprint
  const CASE_D = KEYS_D + 0.305;
  // Just enough tilt that the back row's caps stand 39.2 mm off the mat, its real height
  const KEYBOARD_TILT = THREE.MathUtils.degToRad(4.27);
  keyboard.rotation.x = KEYBOARD_TILT;
  const keyboardLift = CASE_D / 2 * Math.sin(KEYBOARD_TILT) + 0.012;
  keyboard.position.y = MAT_TOP + keyboardLift * KEYBOARD_SCALE;
  // Feet reach the mat beneath the tilted chassis; key travel stays in keyboard space.
  const keyboardFootMat = runtime.core.toon("#15171a");
  [-1, 1].forEach((side) => {
    [-1, 1].forEach((end) => {
      const z = end * (CASE_D / 2 - 0.13);
      const height = (keyboardLift - z * Math.sin(KEYBOARD_TILT)) / Math.cos(KEYBOARD_TILT);
      const foot = runtime.core.mesh(runtime.core.rbox(0.42, height + 0.025, 0.18, 0.012), keyboardFootMat, { outline: 0.006, cast: false });
      foot.position.set(side * (CASE_W / 2 - 0.36), -height / 2, z);
      keyboard.add(foot);
    });
  });
  const keyCaseMat = runtime.core.toon("#24262b");
  // The V2's halo: the bottom case is smoky, fluted acrylic with the RGB inside it, so the light
  // comes through diffused, brightest at the foot and dimming up toward the aluminium. Two
  // prints: the rainbow behind (its map scrolls) and the flutes in front (as its occlusion, which
  // keeps a transform of its own, so the ribs stay put while the colour runs past them)
  const shellPrint = canvasTexture(256, 4);
  runtime.core.track(shellPrint.texture);
  for (let x = 0; x < 256; x++) {
    shellPrint.ctx.fillStyle = `hsl(${(x / 256) * 360}, 85%, 60%)`;
    shellPrint.ctx.fillRect(x, 0, 1, 4);
  }
  shellPrint.texture.wrapS = THREE.RepeatWrapping;
  // (the shell's walls are uv'd in room units round its outline: about 1.5 rainbows round it)
  shellPrint.texture.repeat.x = 0.12;
  const flutes = canvasTexture(512, 64);
  runtime.core.track(flutes.texture);
  {
    const c = flutes.ctx;
    // canvas top is the shell's top: smoky there, the light gathering toward the foot
    const depth = c.createLinearGradient(0, 0, 0, 64);
    depth.addColorStop(0, "#3a3a3a");
    depth.addColorStop(0.45, "#8a8a8a");
    depth.addColorStop(0.85, "#e6e6e6");
    depth.addColorStop(1, "#ffffff");
    c.fillStyle = depth;
    c.fillRect(0, 0, 512, 64);
    // each flute bright down its crest and dark in its groove, the light bending through it
    for (let x = 0; x < 512; x += 4) {
      c.fillStyle = "rgba(0,0,0,.28)";
      c.fillRect(x, 0, 1, 64);
      c.fillStyle = "rgba(255,255,255,.14)";
      c.fillRect(x + 2, 0, 1, 64);
    }
  }
  flutes.texture.colorSpace = THREE.NoColorSpace;
  flutes.texture.wrapS = THREE.RepeatWrapping;
  const lowerShellMat = runtime.core.track(new THREE.MeshBasicMaterial({ map: shellPrint.texture, aoMap: flutes.texture, aoMapIntensity: 1 }));
  // Acrylic and aluminium share one outline in plan, its corners well rounded, so the case reads
  // as one body: the acrylic's walls run straight up into the aluminium, which is bevelled only
  // where it turns onto its top. (A rounded box rounds every edge alike: the two met in a groove
  // and their corners stayed sharp.)
  const CASE_R = 0.16;
  const CASE_BEVEL = 0.03;
  const CASE_FOOT = 0.115; // where the aluminium starts
  const SHELL_H = CASE_FOOT + CASE_BEVEL;
  const shellGeo = new THREE.ExtrudeGeometry(runtime.core.roundedRectShape(CASE_W - 0.008, CASE_D - 0.008, CASE_R), { depth: SHELL_H, bevelEnabled: false, curveSegments: 10 });
  shellGeo.rotateX(-Math.PI / 2);
  // walls are uv'd with their height as v: the fade and the flutes span it
  flutes.texture.repeat.set(0.22, 1 / SHELL_H);
  const keyBottom = runtime.core.mesh(shellGeo, lowerShellMat, { outline: 0.012 });
  const baseGeo = new THREE.ExtrudeGeometry(runtime.core.roundedRectShape(CASE_W - 2 * CASE_BEVEL, CASE_D - 2 * CASE_BEVEL, CASE_R - CASE_BEVEL), {
    depth: 0.15 - 2 * CASE_BEVEL, bevelEnabled: true, bevelThickness: CASE_BEVEL, bevelSize: CASE_BEVEL, bevelSegments: 3, curveSegments: 10,
  });
  baseGeo.rotateX(-Math.PI / 2);
  baseGeo.translate(0, CASE_FOOT + CASE_BEVEL, 0);
  const keyBase = runtime.core.mesh(baseGeo, keyCaseMat, { outline: 0.02 });
  keyboard.add(keyBottom, keyBase);
  const haloMat = runtime.core.track(new THREE.MeshBasicMaterial({ color: "#38bdf8" }));
  const haloBar = new THREE.Mesh(runtime.core.track(new THREE.BoxGeometry(0.03, 0.012, KEY_UNIT * 1.6)), haloMat);
  haloBar.position.set(-CASE_W / 2 + 0.05, 0.27, -KEYS_D / 2 + KEY_UNIT * 0.9);
  haloBar.raycast = runtime.core.noRaycast;
  keyboard.add(haloBar);
  // A recessed switch plate gives the gaps depth without a separate mesh under every cap.
  const switchPlate = runtime.core.mesh(runtime.core.rbox(KEYS_W + 0.025, 0.025, KEYS_D + 0.025, 0.035), runtime.core.toon("#111317"), { outline: 0, cast: false });
  switchPlate.position.y = 0.27;
  keyboard.add(switchPlate);
  // The Halo's per-key RGB: a rainbow wave across the plate, seen in the gaps between the caps.
  // One plane under all of them, its print scrolled sideways, rather than a light per key.
  const rgbPrint = canvasTexture(256, 4);
  runtime.core.track(rgbPrint.texture);
  for (let x = 0; x < 256; x++) {
    rgbPrint.ctx.fillStyle = `hsl(${(x / 256) * 360}, 100%, 55%)`;
    rgbPrint.ctx.fillRect(x, 0, 1, 4);
  }
  rgbPrint.texture.wrapS = THREE.RepeatWrapping;
  rgbPrint.texture.repeat.x = 0.6;
  const backlightMat = runtime.core.track(new THREE.MeshBasicMaterial({ map: rgbPrint.texture }));
  const backlight = new THREE.Mesh(runtime.core.track(new THREE.PlaneGeometry(KEYS_W, KEYS_D)), backlightMat);
  backlight.rotation.x = -Math.PI / 2;
  backlight.position.y = 0.27 + 0.0125 + 0.002;
  backlight.raycast = runtime.core.noRaycast;
  keyboard.add(backlight);
  // The halo spills onto the mat round the keyboard once the room is dark
  const spillTex = canvasTexture(256, 128);
  runtime.core.track(spillTex.texture);
  {
    const c = spillTex.ctx;
    c.filter = "blur(14px)";
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.roundRect(40, 40, 176, 48, 20);
    c.fill();
  }
  const spillMat = runtime.core.track(new THREE.MeshBasicMaterial({ map: spillTex.texture, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  const spill = new THREE.Mesh(runtime.core.track(new THREE.PlaneGeometry((CASE_W + 0.9) * KEYBOARD_SCALE, (CASE_D + 0.9) * KEYBOARD_SCALE)), spillMat);
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(keyboard.position.x, MAT_TOP + 0.004, keyboard.position.z);
  spill.raycast = runtime.core.noRaycast;
  runtime.core.scene.add(spill);
  // A key flashes white under its cap as it's pressed, fading back into the wave
  const flashMat = runtime.core.track(new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  const flashGeo = runtime.core.track(new THREE.PlaneGeometry(1, 1));
  // Faint by day, where the room's light washes it out, and bright once the lights go down
  const backlightDim = new THREE.Color("#3a3d44");
  const rgbColor = new THREE.Color();
  function updateRgb(now) {
    const night = runtime.core.roomLight.night;
    rgbPrint.texture.offset.x = (now / 6000) % 1;
    shellPrint.texture.offset.x = (now / 6000) % 1;
    backlightMat.color.copy(backlightDim).lerp(rgbColor.set("#ffffff"), 0.35 + 0.65 * night);
    // by day the smoke shows more than the light behind it
    lowerShellMat.color.copy(backlightDim).lerp(rgbColor.set("#ffffff"), 0.45 + 0.55 * night);
    haloMat.color.setHSL((now / 6000) % 1, 1, 0.55 + 0.1 * night);
    spillMat.color.copy(haloMat.color);
    spillMat.opacity = 0.55 * night;
  }
  const portRim = runtime.core.mesh(runtime.core.rbox(0.24, 0.075, 0.022, 0.025), runtime.core.toon("#737982"), { outline: 0.006, cast: false });
  portRim.position.set(-1.55, 0.19, -CASE_D / 2 - 0.006);
  const usbPort = runtime.core.mesh(runtime.core.rbox(0.19, 0.045, 0.025, 0.018), runtime.core.toon("#0c0e12"), { outline: 0, cast: false });
  usbPort.position.copy(portRim.position).z -= 0.014;
  keyboard.add(portRim, usbPort);
  const KEY_Y = 0.34;
  const letters = (row) => row.split("").map((ch) => [`Key${ch}`, ch]);
  const fKeys = Array.from({ length: 12 }, (_, i) => [`F${i + 1}`, `F${i + 1}`]);
  const KEY_ROWS = [
    [["Escape", "ESC"], ...fKeys, ["PrintScreen", "PRT"], ["Insert", "INS"], ["Delete", "DEL"]],
    [["Backquote", "`"], ...Array.from({ length: 10 }, (_, i) => [`Digit${(i + 1) % 10}`, String((i + 1) % 10)]), ["Minus", "-"], ["Equal", "="], ["Backspace", "BACKSPACE", 2], ["Home", "HOME"]],
    [["Tab", "TAB", 1.5], ...letters("QWERTYUIOP"), ["BracketLeft", "["], ["BracketRight", "]"], ["Backslash", "\\", 1.5], ["End", "END"]],
    [["CapsLock", "CAPS", 1.75], ...letters("ASDFGHJKL"), ["Semicolon", ";"], ["Quote", "'"], ["Enter", "ENTER", 2.25], ["PageUp", "PGUP"]],
    [["ShiftLeft", "SHIFT", 2.25], ...letters("ZXCVBNM"), ["Comma", ","], ["Period", "."], ["Slash", "/"], ["ShiftRight", "SHIFT", 1.75], ["ArrowUp", "↑"], ["PageDown", "PGDN"]],
    // Apple's bottom row: fn, control, option, command, the space bar, command, option
    [["Fn", "fn"], ["ControlLeft", "control"], ["AltLeft", "option"], ["MetaLeft", "command", 1.25], ["Space", "", 6.25], ["MetaRight", "command", 1.25], ["AltRight", "option", 1.25], ["ArrowLeft", "←"], ["ArrowDown", "↓"], ["ArrowRight", "→"]],
  ];
  // Apple prints each modifier's symbol over its name
  const MOD_SYMBOLS = { ControlLeft: "⌃", AltLeft: "⌥", AltRight: "⌥", MetaLeft: "⌘", MetaRight: "⌘" };
  // Pressed on their own, so they show even though they never type anything
  const MODIFIER_CODES = new Set(["ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "MetaLeft", "MetaRight"]);
  // Shortcut keys, their legends printed in colour: digits fly to the sections, T to the
  // terminal, C to the chat. They work from your own keyboard too.
  const SHORTCUTS = {
    1: { shot: "hero", code: "Digit1", color: "#ffdd00" },
    2: { shot: "about", code: "Digit2", color: "#ff90e8" },
    3: { shot: "experience", code: "Digit3", color: "#00e0c6" },
    4: { shot: "projects", code: "Digit4", color: "#f5c76b" },
    5: { shot: "contact", code: "Digit5", color: "#e9c48a" },
    t: { shot: "monitor", code: "KeyT", color: "#8fd694" },
    c: { shot: "chat", code: "KeyC", color: "#7fb2ff" },
  };
  const shortcutByCode = new Map(Object.values(SHORTCUTS).map((sc) => [sc.code, sc]));
  // The Halo75 V2's colourway: near-black alphas, grey modifiers, a mint Esc, a coral Enter and a
  // yellow space bar
  const ACCENTS = { Escape: "#5ec4a2", Enter: "#f2603c", Space: "#f5c22b" };
  const ALPHA = /^(Key|Digit)|^(Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|Backquote)$/;
  const keyColor = (code) => ACCENTS[code] || (ALPHA.test(code) ? "#2a2c31" : "#43464d");
  const keyInk = (code) => shortcutByCode.get(code)?.color || (ACCENTS[code] ? "#f1eee5" : "#c3c6cc");
  // The shifted symbols printed above the digits and punctuation
  const SHIFTED = {
    Backquote: "~", Digit1: "!", Digit2: "@", Digit3: "#", Digit4: "$", Digit5: "%", Digit6: "^", Digit7: "&", Digit8: "*", Digit9: "(", Digit0: ")",
    Minus: "_", Equal: "+", BracketLeft: "{", BracketRight: "}", Backslash: "|", Semicolon: ":", Quote: "\"", Comma: "<", Period: ">", Slash: "?",
  };
  const keyMats = new Map();
  const keyMat = (color) => keyMats.get(color) || keyMats.set(color, runtime.core.toon(color)).get(color);
  // Sculpt the cap rather than stacking a second lid over it. The clear ink decal follows
  // the same shallow dish, so legends stay on the surface while each key moves.
  const keycapTop = (x, z, w, d) => 0.09 - 0.012 * Math.max(0, 1 - (x / (w / 2)) ** 2) * Math.max(0, 1 - (z / (d / 2)) ** 2);
  function sculptKeycap(w, d) {
    // Keep a grid across the top: a rounded box's flat centre has only two triangles,
    // which cannot follow a dish or the ink printed on it.
    const geo = new THREE.BoxGeometry(w, 0.18, d, Math.max(8, Math.ceil(w / 0.08)), 4, 8);
    const pos = geo.attributes.position;
    const inner = new THREE.Vector3(w / 2 - 0.035, 0.055, d / 2 - 0.035);
    const lower = inner.clone().negate();
    const point = new THREE.Vector3();
    const nearest = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      point.fromBufferAttribute(pos, i);
      nearest.copy(point).clamp(lower, inner);
      point.sub(nearest).normalize().multiplyScalar(0.035).add(nearest);
      const y = point.y;
      const taper = 1 - 0.05 * THREE.MathUtils.clamp((y + 0.09) / 0.18, 0, 1);
      const x = point.x * taper;
      const z = point.z * taper;
      const dish = y > 0.055 ? (0.09 - keycapTop(x, z, w, d)) * ((y - 0.055) / 0.035) : 0;
      pos.setXYZ(i, x, y - dish, z);
    }
    geo.computeVertexNormals();
    return geo;
  }
  const keyGeometries = new Map();
  const keyByCode = new Map();
  const legendMat = (map) => runtime.core.track(new THREE.MeshToonMaterial({
    map, gradientMap: runtime.core.gradient, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
  }));
  KEY_ROWS.forEach((row, r) => {
    let cursor = -8; // the rows are 16 units wide
    row.forEach(([code, label, width = 1]) => {
      const w = width * KEY_UNIT - KEY_GAP;
      const d = KEY_UNIT - KEY_GAP;
      const color = keyColor(code);
      const key = new THREE.Group();
      key.position.set((cursor + width / 2) * KEY_UNIT, KEY_Y, (r - 2.5) * KEY_UNIT);
      key.userData.code = code;
      // AO supplies the gaps between caps; the case supplies the keyboard's cast shadow.
      if (!keyGeometries.has(w)) keyGeometries.set(w, sculptKeycap(w, d));
      key.add(runtime.core.mesh(keyGeometries.get(w), keyMat(color), { outline: 0.014, cast: false }));
      {
        const legend = runtime.core.printed(w - 0.085, d - 0.085, 340, (c, cw, ch) => drawKeyLabel(c, cw, ch, label, null, { ink: keyInk(code), small: label.length > 1, shift: SHIFTED[code] || MOD_SYMBOLS[code] }));
        const inkSurface = runtime.core.track(new THREE.PlaneGeometry(w - 0.085, d - 0.085, 8, 8));
        const inkPos = inkSurface.attributes.position;
        for (let i = 0; i < inkPos.count; i++) inkPos.setZ(i, keycapTop(inkPos.getX(i), -inkPos.getY(i), w, d));
        inkSurface.computeVertexNormals();
        legend.geometry = inkSurface;
        // Ink on the cap, not a sticker over it: a clear decal under the cap's own toon light
        legend.material = legendMat(legend.userData.tex.texture);
        legend.rotation.x = -Math.PI / 2;
        legend.position.y = 0.001;
        key.add(legend);
      }
      if (code === "KeyF" || code === "KeyJ") {
        const homing = runtime.core.mesh(runtime.core.rbox(0.075, 0.012, 0.018, 0.005), keyMat("#81bfc7"), { outline: 0, cast: false });
        homing.position.set(0, keycapTop(0, 0.058, w, d) + 0.006, 0.058);
        key.add(homing);
      }
      keyboard.add(key);
      // (on the keyboard, not the cap, so it stays on the plate while the cap travels)
      const flash = new THREE.Mesh(flashGeo, flashMat.clone());
      runtime.core.track(flash.material);
      flash.scale.set(w + KEY_GAP, d + KEY_GAP, 1);
      flash.rotation.x = -Math.PI / 2;
      flash.position.set(key.position.x, backlight.position.y + 0.001, key.position.z);
      flash.raycast = runtime.core.noRaycast;
      keyboard.add(flash);
      key.userData.flash = flash;
      keyByCode.set(code, key);
      cursor += width;
    });
  });

  let keysPressed = 0;
  function pressKey(code, { sound = true } = {}) {
    const key = keyByCode.get(code);
    if (!key) return;
    gsap.fromTo(key.position, { y: KEY_Y - 0.11 }, { y: KEY_Y, duration: 0.28, ease: "back.out(3)", overwrite: true });
    gsap.fromTo(key.userData.flash.material, { opacity: 0.9 }, { opacity: 0, duration: 0.5, ease: "power2.out", overwrite: true });
    if (sound) code === "Space" ? sfx.thud({ strength: 0.25 }) : sfx.key();
    runtime.options.onEvent("keys", { count: ++keysPressed });
  }
  const hitKey = (hit) => {
    let code = null;
    for (let o = hit.object; o && !code; o = o.parent) code = o.userData.code;
    if (!code) return;
    pressKey(code);
    if (code === "Escape") return runtime.core.timers.push(setTimeout(runtime.camera.back, 200));
    const sc = shortcutByCode.get(code);
    if (sc) runtime.core.timers.push(setTimeout(() => runtime.camera.setFocus(sc.shot), 200));
  };
  let hoveredKey = null;
  function hoverKey(hit) {
    let key = hit?.object;
    while (key && !key.userData.code) key = key.parent;
    if (key === hoveredKey) return;
    if (hoveredKey) gsap.to(hoveredKey.position, { y: KEY_Y, duration: 0.18, overwrite: true });
    hoveredKey = key || null;
    if (hoveredKey) gsap.to(hoveredKey.position, { y: KEY_Y + 0.09, duration: 0.18, ease: "power2.out", overwrite: true });
  }
  runtime.core.register(keyboard, {
    focus: "keyboard", onClick: hitKey,
    onHover: (on) => { if (!on) hoverKey(null); },
    onPointer: hoverKey,
  });
  // A focused HUD control (a button, a link) keeps Enter and Space for itself, and Esc stays
  // with the settings panel or an open menu; on a plain button Esc still steps back
  const HUD_CONTROLS = "button, a[href], select, summary, [role='button'], [role='switch'], [role='menuitem'], [role='menuitemradio'], [role='tab'], [role='radio']";
  const HUD_ESC_OWNERS = "[role='dialog'], [role='menu'], [role='listbox'], [aria-expanded='true']";
  const hudOwnsKey = (e) => {
    if (e.key === "Escape") return !!e.target.closest?.(HUD_ESC_OWNERS);
    return (e.key === "Enter" || e.key === " ") && !!e.target.closest?.(HUD_CONTROLS);
  };
  const onKeyDown = (e) => {
    runtime.core.responsiveUntil = performance.now() + 2000;
    // A modifier's own keydown already carries its flag (Cmd sets metaKey), so it's pressed
    // here, before combinations are ignored below
    if (MODIFIER_CODES.has(e.code)) {
      if (!e.repeat) pressKey(e.code);
      return;
    }
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("input, textarea, [contenteditable]")) return;
    if (hudOwnsKey(e)) return;
    if (e.key === "Escape") {
      pressKey("Escape");
      return runtime.camera.back();
    }
    if (runtime.core.byFocus.get(runtime.camera.focus.name)?.onKey?.(e)) return e.preventDefault();
    // Shortcuts (not while the terminal has the keyboard: there they're just typing)
    const sc = runtime.camera.focus.name !== "monitor" && !e.repeat && SHORTCUTS[e.key.toLowerCase()];
    if (sc) {
      pressKey(sc.code);
      return runtime.camera.setFocus(sc.shot);
    }
    if (runtime.camera.focus.name === "monitor" && (e.key.length === 1 || e.key === "Enter" || e.key === "Backspace")) {
      e.preventDefault();
      if (e.repeat && e.key === "Enter") return;
      runtime.workstation.typeKey(e.key);
      pressKey(e.code, { sound: !runtime.workstation.termBusy });
    } else if (!e.repeat) pressKey(e.code);
  };
  window.addEventListener("keydown", onKeyDown);
  // The console's game sails while an arrow is held, so it needs to hear the key let go
  const onKeyUp = (e) => {
    if (runtime.camera.focus.name === "monitor") runtime.workstation.desktop.keyUp(e);
  };
  window.addEventListener("keyup", onKeyUp);
  // The Konami code, typed anywhere: the shelf throws a party
  const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let konamiAt = 0;
  const onKonami = (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    konamiAt = key === KONAMI[konamiAt] ? konamiAt + 1 : key === KONAMI[0] ? 1 : 0;
    if (konamiAt < KONAMI.length) return;
    konamiAt = 0;
    runtime.secrets.discover("konami");
    runtime.shelf.ledPartyUntil = performance.now() + 5000;
    runtime.shelf.shelf.getWorldPosition(runtime.gauntlet.shelfBubbleAt);
    runtime.gym.burst(runtime.gauntlet.shelfBubbleAt.x, runtime.room.FLOOR_Y + 6, runtime.gauntlet.shelfBubbleAt.z + 0.8);
    runtime.gym.burst(0, 1.2, 0.5);
    sfx.groove();
    sfx.meow({ delay: 0.4 });
    gsap.fromTo(runtime.shelf.neonOn.material, { opacity: 0 }, { opacity: 1, duration: 0.12, repeat: 9, yoyo: true, onComplete: () => (runtime.shelf.neonOn.material.opacity = runtime.theme.darkNow ? 1 : 0) });
  };
  window.addEventListener("keydown", onKonami);

  // Public state used by the other scene parts.
  return {
    pressKey,
    updateRgb,
    keyboard,
    MAT_TOP,
    KEY_Y,
    KEYBOARD_SCALE,
    onKeyDown,
    onKeyUp,
    onKonami,
  };
}
