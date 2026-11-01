import * as THREE from "three";
import gsap from "gsap";
import { sfx } from "@/shared/composables/useSfx";

export function createHandheld(runtime) {
  // ---------- a hybrid handheld console on a display stand, right of the gauntlet ----------
  // (Switch-style, with an original logo and no product name on its screen)
  // Handheld mode: the black tablet between a neon-blue and a neon-red Joy-Con, leaning back
  // on a little black stand. Click it for a hop and a word from it.
  // Clean matte plastic; the bevels and scene lighting provide the surface detail.
  const switchRubber = runtime.core.toon("#303238");
  const switchShell = (color) => {
    const material = runtime.core.toon(color);
    material.emissive.set(color);
    material.emissiveIntensity = 0.06;
    return material;
  };
  const switchGraphite = switchShell("#303238");
  // A face button: a low round cap, its top edge rolled over into a shallow dome. Kept low
  // (as on the real pads) so, seen from above, its side doesn't stretch it out of round.
  const buttonGeo = runtime.core.track(new THREE.LatheGeometry([
    new THREE.Vector2(0, -0.006),
    new THREE.Vector2(0.023, -0.006),
    new THREE.Vector2(0.0228, 0),
    ...Array.from({ length: 6 }, (_, i) => {
      const a = ((i + 1) / 6) * (Math.PI / 2);
      return new THREE.Vector2(0.0188 + 0.004 * Math.cos(a), 0.004 * Math.sin(a));
    }),
    new THREE.Vector2(0, 0.0048),
  ], 48));
  const joyCon = (color, side) => {
    const con = new THREE.Group();
    // Flat attachment edge, broad rounded outer corners and a softly bevelled front.
    const shape = new THREE.Shape();
    shape.moveTo(side * -0.107, -0.342);
    shape.lineTo(side * -0.005, -0.342);
    shape.quadraticCurveTo(side * 0.107, -0.342, side * 0.107, -0.23);
    shape.lineTo(side * 0.107, 0.23);
    shape.quadraticCurveTo(side * 0.107, 0.342, side * -0.005, 0.342);
    shape.lineTo(side * -0.107, 0.342);
    shape.closePath();
    const shellGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.074, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008,
      bevelSegments: 3, curveSegments: 12,
    });
    shellGeo.translate(0, 0, -0.037);
    const shell = runtime.core.mesh(shellGeo, switchShell(color), { outline: 0.009 });
    con.add(shell);
    // Rear shell seam and the dark sliding rail remain visible when the controllers pop off.
    con.add(runtime.core.at(runtime.core.mesh(runtime.core.phoneSlab(0.215, 0.676, 0.012, 0.075), switchGraphite, { outline: 0.003 }), 0, 0, -0.042));
    con.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.012, 0.63, 0.077, 0.004), switchGraphite, { outline: 0 }), -side * 0.112, 0, -0.002));
    const stickY = side < 0 ? 0.17 : -0.065;
    const padY = side < 0 ? -0.055 : 0.17;
    const stickX = -side * 0.012;
    const socket = runtime.core.mesh(new THREE.CylinderGeometry(0.059, 0.061, 0.012, 24), switchGraphite, { outline: 0.003 });
    socket.rotation.x = Math.PI / 2;
    con.add(runtime.core.at(socket, stickX, stickY, 0.051));
    const stick = runtime.core.mesh(new THREE.CylinderGeometry(0.047, 0.051, 0.028, 24), switchRubber, { outline: 0.004 });
    stick.rotation.x = Math.PI / 2;
    con.add(runtime.core.at(stick, stickX, stickY, 0.075));
    const thumbRim = runtime.core.mesh(new THREE.TorusGeometry(0.04, 0.0035, 6, 24), switchGraphite, { outline: 0 });
    con.add(runtime.core.at(thumbRim, stickX, stickY, 0.091));
    // Separate direction buttons on the left; ABXY on the right, in their reference positions.
    [[0, 0.052], [0, -0.052], [0.052, 0], [-0.052, 0]].forEach(([dx, dy]) => {
      const button = runtime.core.mesh(buttonGeo, switchRubber, { outline: 0.003 });
      button.rotation.x = Math.PI / 2;
      con.add(runtime.core.at(button, stickX + dx, padY + dy, 0.05));
    });
    const legends = runtime.core.printed(0.16, 0.16, 1200, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.fillStyle = side < 0 ? "#121418" : "#d9dde1";
      c.font = `600 ${Math.round(h * 0.13)}px sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      const labels = side < 0 ? ["▴", "▾", "▸", "◂"] : ["X", "B", "A", "Y"];
      [[0, 0.052], [0, -0.052], [0.052, 0], [-0.052, 0]].forEach(([x, y], i) => {
        c.fillText(labels[i], w * (0.5 + x / 0.16), h * (0.5 - y / 0.16));
      });
    });
    legends.material.transparent = true;
    legends.material.depthWrite = false;
    con.add(runtime.core.at(legends, stickX, padY, 0.0556));
    // Minus/plus sit toward the tablet; capture and home sit below the main controls.
    con.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.036, 0.011, 0.012, 0.003), switchGraphite, { outline: 0 }), -side * 0.058, 0.278, 0.052));
    if (side > 0) con.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.011, 0.036, 0.012, 0.003), switchGraphite, { outline: 0 }), -side * 0.058, 0.278, 0.052));
    const utility = side < 0
      ? runtime.core.mesh(runtime.core.rbox(0.037, 0.037, 0.012, 0.004), switchGraphite, { outline: 0.002 })
      : runtime.core.mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.012, 20), switchGraphite, { outline: 0.002 });
    if (side > 0) utility.rotation.x = Math.PI / 2;
    con.add(runtime.core.at(utility, -side * 0.035, -0.235, 0.052));
    const utilityRing = runtime.core.mesh(new THREE.TorusGeometry(side < 0 ? 0.009 : 0.016, 0.002, 5, 16), switchRubber, { outline: 0 });
    con.add(runtime.core.at(utilityRing, -side * 0.035, -0.235, 0.06));
    // Shoulder buttons and rear release catch follow the shell, including during animations.
    con.add(runtime.core.at(runtime.core.mesh(runtime.core.phoneSlab(0.16, 0.024, 0.055, 0.01), switchGraphite, { outline: 0.003 }), side * 0.015, 0.337, -0.015));
    con.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.025, 0.045, 0.012, 0.004), switchGraphite, { outline: 0 }), -side * 0.07, 0.263, -0.055));
    return con;
  };
  // The screen: its boot logo at rest. Played (`at`, seconds since it was switched on), it
  // flashes up, shows the logo, then runs a little kart game for a few seconds and signs off.
  const SWITCH_GAME = 6.6;
  const switchGame = { start: -99, live: false };
  let switchDrawnAt = 0;
  const switchLogo = (c, w, h) => {
    const glow = c.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, w * 0.6);
    glow.addColorStop(0, "#2b3348");
    glow.addColorStop(1, "#0d1018");
    c.fillStyle = glow;
    c.fillRect(0, 0, w, h);
    // soft coloured swooshes behind the logo
    [["#00b4e6", 0.1], ["#ff4554", 0.9]].forEach(([color, x]) => {
      c.fillStyle = color;
      c.globalAlpha = 0.18;
      c.beginPath();
      c.ellipse(w * x, h * 0.8, w * 0.35, h * 0.35, 0, 0, Math.PI * 2);
      c.fill();
    });
    c.globalAlpha = 1;
    // Our own boot logo: a rounded game pad badge with a star, and the room's name for it
    const r = h * 0.17;
    const cx = w / 2;
    const cy = h * 0.4;
    c.lineWidth = h * 0.028;
    c.strokeStyle = "#ffffff";
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.roundRect(cx - r * 1.5, cy - r * 0.8, r * 3, r * 1.6, r * 0.8);
    c.stroke();
    // a d-pad on the left, two buttons on the right
    c.fillRect(cx - r * 0.95, cy - r * 0.1, r * 0.6, r * 0.2);
    c.fillRect(cx - r * 0.75, cy - r * 0.3, r * 0.2, r * 0.6);
    [[0.75, -0.18], [0.45, 0.18]].forEach(([dx, dy]) => {
      c.beginPath();
      c.arc(cx + r * dx, cy + r * dy, r * 0.14, 0, Math.PI * 2);
      c.fill();
    });
    c.fillStyle = "#ffdd00";
    c.font = `900 ${Math.round(r * 0.7)}px sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("★", cx, cy - r * 1.05);
    c.fillStyle = "#ffffff";
    c.font = `800 ${Math.round(h * 0.09)}px 'Lexend Mega', sans-serif`;
    c.fillText("POCKET PLAY", w / 2, h * 0.74);
  };
  // A side-on kart race: parallax hills, a scrolling road, cones the kart hops, a lap counter
  const switchKart = (c, w, h, t) => {
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#5ec8ff");
    sky.addColorStop(1, "#c9f0ff");
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#fffdf5";
    [[0.2, 0.2], [0.7, 0.14]].forEach(([x, y]) => {
      const cx = ((x * w - t * 12) % (w + 60) + w + 60) % (w + 60) - 30;
      c.beginPath();
      c.arc(cx, h * y, h * 0.06, 0, Math.PI * 2);
      c.arc(cx + h * 0.07, h * y - h * 0.02, h * 0.075, 0, Math.PI * 2);
      c.arc(cx + h * 0.15, h * y, h * 0.055, 0, Math.PI * 2);
      c.fill();
    });
    const ground = h * 0.74;
    [["#7ed957", 0.3, 30], ["#3fae49", 0.18, 70]].forEach(([color, hill, speed]) => {
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(0, ground);
      for (let x = 0; x <= w; x += 6) c.lineTo(x, ground - h * hill * (0.6 + 0.4 * Math.sin((x + t * speed) / (w * 0.18))));
      c.lineTo(w, ground);
      c.fill();
    });
    c.fillStyle = "#3a3e45";
    c.fillRect(0, ground, w, h - ground);
    c.fillStyle = "#ffdd00";
    for (let x = -((t * 160) % 40); x < w; x += 40) c.fillRect(x, ground + (h - ground) * 0.45, 20, 3);
    // cones come by every so often; the kart hops each one
    const gap = w * 0.75;
    const scroll = t * 160;
    const kartX = w * 0.26;
    let hop = 0;
    for (let i = Math.floor(scroll / gap); i <= Math.floor((scroll + w) / gap) + 1; i++) {
      const x = i * gap - scroll + w * 0.6;
      const near = (x - kartX) / (w * 0.22);
      if (Math.abs(near) < 1) hop = Math.max(hop, 1 - near * near);
      c.fillStyle = "#ff7a1a";
      c.beginPath();
      c.moveTo(x, ground - h * 0.13);
      c.lineTo(x + h * 0.05, ground);
      c.lineTo(x - h * 0.05, ground);
      c.fill();
      c.fillStyle = "#fffdf5";
      c.fillRect(x - h * 0.025, ground - h * 0.075, h * 0.05, h * 0.02);
    }
    const ky = ground - hop * h * 0.24;
    const bob = Math.sin(t * 30) * 1.2;
    c.fillStyle = "#1a1714";
    [-0.07, 0.07].forEach((dx) => {
      c.beginPath();
      c.arc(kartX + dx * h, ky - h * 0.035, h * 0.035, 0, Math.PI * 2);
      c.fill();
    });
    c.fillStyle = "#ff4554";
    c.beginPath();
    c.roundRect(kartX - h * 0.12, ky - h * 0.11 + bob, h * 0.24, h * 0.07, h * 0.02);
    c.fill();
    c.fillStyle = "#ffdd00";
    c.beginPath();
    c.arc(kartX - h * 0.02, ky - h * 0.13 + bob, h * 0.04, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#d62828";
    c.fillRect(kartX - h * 0.07, ky - h * 0.15 + bob, h * 0.1, h * 0.018);
    c.fillStyle = "#1a1714";
    c.font = `800 ${Math.round(h * 0.09)}px 'Space Grotesk', sans-serif`;
    c.textAlign = "left";
    c.textBaseline = "top";
    c.fillText(`LAP ${Math.min(3, 1 + Math.floor(t / 1.6))}/3`, w * 0.04, h * 0.05);
    c.textAlign = "right";
    c.fillText(`${String(Math.floor(t * 137)).padStart(5, "0")}`, w * 0.96, h * 0.05);
  };
  const switchScreen = runtime.core.printed(0.98, 0.55, 300, (c, w, h, now) => {
    const t = now === undefined ? -1 : now - switchGame.start;
    if (t < 0 || t > SWITCH_GAME) return switchLogo(c, w, h);
    c.textAlign = "center";
    c.textBaseline = "middle";
    // a white flash, then the logo, then the race, then a sign-off
    if (t < 0.25) {
      c.fillStyle = `rgba(255,255,255,${1 - t * 2})`;
      c.fillRect(0, 0, w, h);
      return;
    }
    if (t < 1.3) {
      switchLogo(c, w, h);
      c.fillStyle = `rgba(13,16,24,${Math.max(0, 1 - (t - 0.25) * 3)})`;
      c.fillRect(0, 0, w, h);
      return;
    }
    const race = t - 1.3;
    if (race < 4.4) return switchKart(c, w, h, race);
    switchKart(c, w, h, 4.4);
    c.fillStyle = "rgba(13,16,24,.6)";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#ffdd00";
    c.font = `900 ${Math.round(h * 0.2)}px 'Lexend Mega', sans-serif`;
    c.fillText("1ST! ★", w / 2, h * 0.45);
    c.fillStyle = "#fffdf5";
    c.font = `800 ${Math.round(h * 0.08)}px 'Space Grotesk', sans-serif`;
    c.fillText("save point reached ✓", w / 2, h * 0.68);
  }, { unlit: true });
  const leftCon = runtime.core.at(joyCon("#00b4e6", -1), -0.68, 0, 0);
  const rightCon = runtime.core.at(joyCon("#ff4554", 1), 0.68, 0, 0);
  const switchConsole = runtime.shelf.group(
    runtime.core.mesh(runtime.core.phoneSlab(1.12, 0.7, 0.08, 0.024), switchGraphite, { outline: 0.009 }),
    runtime.core.at(runtime.core.mesh(runtime.core.phoneSlab(1.085, 0.665, 0.006, 0.018), runtime.core.toon("#101216"), { outline: 0 }), 0, 0, 0.043),
    runtime.core.at(switchScreen, 0, 0, 0.048),
    leftCon,
    rightCon,
  );
  // Edge controls, cooling vents and front speaker slots stay outside the existing display.
  switchConsole.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.045, 0.009, 0.025, 0.003), switchRubber, { outline: 0 }), -0.45, 0.353, -0.005));
  switchConsole.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.085, 0.009, 0.025, 0.003), switchRubber, { outline: 0 }), -0.34, 0.353, -0.005));
  for (let i = 0; i < 7; i++) {
    switchConsole.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.022, 0.004, 0.033, 0.001), runtime.shelfConsole.black, { outline: 0, cast: false }), -0.04 + i * 0.035, 0.352, -0.002));
  }
  [-1, 1].forEach((side) => {
    switchConsole.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.065, 0.007, 0.003, 0.002), switchRubber, { outline: 0, cast: false }), side * 0.39, -0.309, 0.048));
    // Rail seams meet the controllers without a floating gap.
    switchConsole.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.008, 0.65, 0.065, 0.002), switchRubber, { outline: 0 }), side * 0.561, 0, -0.002));
  });
  // The dock it leans on: a base with a lip at the front for the console's foot and, behind,
  // the dock itself, hollow, so the console can drop in. A small LED on its front lights green
  // when it's docked.
  const dockLed = new THREE.Mesh(runtime.core.track(new THREE.BoxGeometry(0.06, 0.02, 0.01)), runtime.core.track(new THREE.MeshBasicMaterial({ color: "#3a3e45" })));
  const DOCK_FRONT = -0.18;
  const DOCK_BACK = -0.38;
  const switchStand = runtime.shelf.group(
    runtime.core.at(runtime.core.mesh(runtime.core.rbox(1.26, 0.06, 0.7, 0.02), switchGraphite, { outline: 0.014 }), 0, 0.03, -0.08),
    runtime.core.at(runtime.core.mesh(runtime.core.rbox(1.0, 0.08, 0.08, 0.02), switchGraphite, { outline: 0.012 }), 0, 0.1, 0.13),
    runtime.core.at(runtime.core.mesh(runtime.core.rbox(1.26, 0.38, 0.05, 0.03), switchGraphite, { outline: 0.014 }), 0, 0.23, DOCK_FRONT),
    runtime.core.at(runtime.core.mesh(runtime.core.rbox(1.26, 0.56, 0.05, 0.03), switchGraphite, { outline: 0.014 }), 0, 0.32, DOCK_BACK),
    runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.05, 0.38, 0.25, 0.02), switchGraphite, { outline: 0.012 }), -0.605, 0.23, (DOCK_FRONT + DOCK_BACK) / 2),
    runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.05, 0.38, 0.25, 0.02), switchGraphite, { outline: 0.012 }), 0.605, 0.23, (DOCK_FRONT + DOCK_BACK) / 2),
    runtime.core.at(dockLed, 0.5, 0.1, DOCK_FRONT + 0.027),
  );
  const SWITCH_REST = { y: 0.46, z: 0.04, tilt: -0.28 };
  switchConsole.position.set(0, SWITCH_REST.y, SWITCH_REST.z);
  switchConsole.rotation.x = SWITCH_REST.tilt;
  const nintendoSwitch = runtime.shelf.addItem(runtime.core.at(runtime.shelf.group(switchStand, switchConsole), 0.66, runtime.shelf.standOn(3), 0.05), "switch");
  nintendoSwitch.scale.setScalar(0.8); // Approximately 24 cm wide at the shelf's scale.
  nintendoSwitch.rotation.y = 0;
  const SWITCH_LINES = ["one more run, I promise", "battery: 12%. still playing.", "kart race tonight?", "the kids want a turn"];
  let switchLine = 0;
  // Each click plays the next trick: the Joy-Cons slide off and click back on; it boots up and
  // races a lap; it drops into its dock for TV mode, then lifts back out.
  let switchTrick = 0;
  let switchBusy = false;
  const switchSay = (text) => runtime.gauntlet.shelfSay(nintendoSwitch, text, "the handheld", 3000);
  function joyConsOff() {
    const tl = gsap.timeline({ onComplete: () => (switchBusy = false) });
    [[leftCon, -1], [rightCon, 1]].forEach(([con, side]) => {
      tl.to(con.position, { x: side * 0.9, y: 0.05, duration: 0.2, ease: "power2.out" }, 0)
        .to(con.rotation, { z: side * -0.18, duration: 0.2, ease: "power2.out" }, 0)
        .to(con.rotation, { z: side * -0.05, duration: 0.09, repeat: 3, yoyo: true, ease: "sine.inOut" }, 0.2)
        .to(con.position, { x: side * 0.68, y: 0, duration: 0.12, ease: "power3.in" }, 0.62)
        .to(con.rotation, { z: 0, duration: 0.12, ease: "power3.in" }, 0.62);
    });
    tl.fromTo(switchConsole.scale, { x: 1.06, y: 0.95 }, { x: 1, y: 1, duration: 0.4, ease: "elastic.out(1.4, 0.4)" }, 0.74);
    sfx.slide({ duration: 0.18 });
    sfx.click({ delay: 0.74 });
    switchSay("*click* Joy-Cons on ✓");
  }
  function bootSwitch() {
    switchGame.start = performance.now() / 1000;
    switchGame.live = true;
    sfx.power({ duration: 0.6 });
    sfx.groove({ delay: 1.3 });
    sfx.sparkle({ delay: 5.7 });
    setTimeout(() => (switchBusy = false), 1300);
    switchSay(SWITCH_LINES[switchLine++ % SWITCH_LINES.length]);
  }
  function dockSwitch() {
    const lift = SWITCH_REST.y + 0.55;
    const docked = { y: 0.37, z: (DOCK_FRONT + DOCK_BACK) / 2 };
    gsap.timeline({ onComplete: () => (switchBusy = false) })
      .to(switchConsole.position, { y: lift, z: docked.z, duration: 0.35, ease: "power2.out" })
      .to(switchConsole.rotation, { x: 0, duration: 0.35, ease: "power2.out" }, "<")
      .to(switchConsole.position, { y: docked.y, duration: 0.22, ease: "power2.in" })
      .call(() => {
        sfx.dock({ strength: 0.5 });
        sfx.blip({ delay: 0.15 });
        dockLed.material.color.set("#3fe36b");
        switchScreen.material.color.setScalar(0.22);
        switchSay("docked. TV mode ▶");
      })
      .to(switchConsole.position, { y: lift, duration: 0.3, ease: "power2.out", delay: 3 })
      .call(() => {
        sfx.slide({ duration: 0.2 });
        dockLed.material.color.set("#3a3e45");
        switchScreen.material.color.setScalar(1);
      }, null, "<")
      .to(switchConsole.position, { y: SWITCH_REST.y, z: SWITCH_REST.z, duration: 0.35, ease: "power2.inOut" })
      .to(switchConsole.rotation, { x: SWITCH_REST.tilt, duration: 0.35, ease: "power2.inOut" }, "<");
    sfx.whoosh({ duration: 0.3 });
  }
  function playSwitch() {
    if (switchBusy || switchGame.live) return;
    switchBusy = true;
    [joyConsOff, bootSwitch, dockSwitch][switchTrick++ % 3]();
  }

  // Public state used by the other scene parts.
  return {
    nintendoSwitch,
    playSwitch,
    switchConsole,
    get switchBusy() { return switchBusy; },
    switchGame,
    get switchDrawnAt() { return switchDrawnAt; },
    set switchDrawnAt(value) { switchDrawnAt = value; },
    SWITCH_GAME,
    switchScreen,
  };
}
