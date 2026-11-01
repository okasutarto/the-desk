import * as THREE from "three";
import gsap from "gsap";
import { hoverSound, sfx } from "@/shared/composables/useSfx";

export function createMouse(runtime) {
  // ---------- mouse (decor) ----------
  const mouse = new THREE.Group();
  mouse.position.set(1.85, runtime.keyboard.MAT_TOP, 0.5);
  mouse.rotation.y = -0.12;
  runtime.core.scene.add(mouse);
  // A wireless gaming mouse at its real size (a scene unit is 10 cm): 120 mm long, 64 mm across
  // the back and 38 mm high, symmetrical, after the reference photo. Seen from above its sides
  // run nearly straight, nipped in a touch at the waist, with a blunt nose and a rounder back;
  // side on, it rises from a low front under the buttons to a hump behind the middle.
  // t runs along it, -1 at the nose to 1 at the back.
  const HALF_L = 0.6;
  const BASE = 0.025;
  // Each end rounds off as a superellipse: squarer (higher power) at the nose than the back
  const endRound = (t, front, back) => {
    const n = t < 0 ? front : back;
    return Math.max(0, 1 - Math.abs(t) ** n) ** (1 / n);
  };
  const halfW = (t) => 0.32
    * (0.96 + 0.04 * THREE.MathUtils.smoothstep(t, -0.7, 0.5))
    * (1 - 0.035 * Math.exp(-(((t - 0.1) / 0.3) ** 2)))
    * endRound(t, 7, 4.5);
  const crown = (t) => (0.355 - 0.08 * (t - 0.3) ** 2) * endRound(t, 4, 3);
  // How full the sides are across: lower stands them up before they turn over into the top
  const FULL = 0.6;
  // The top of the shell over (x, z), for laying the seams, the wheel and the face on it
  const topY = (x, z) => {
    const t = z / HALF_L;
    const u = Math.min(1, Math.abs(x) / Math.max(1e-6, halfW(t)));
    return BASE + (1 - u * u) ** (FULL / 2) * crown(t);
  };
  // A sphere pulled into that shape: each point keeps its place round its ring (u across, v up)
  // and the ring takes the shell's width and height at that t. The underside is a thin
  // rounded base.
  const shellGeo = runtime.core.track(new THREE.SphereGeometry(1, 72, 48));
  const shellPos = shellGeo.attributes.position;
  for (let i = 0; i < shellPos.count; i++) {
    const t = THREE.MathUtils.clamp(shellPos.getZ(i), -1, 1);
    const ring = Math.sqrt(Math.max(1e-9, 1 - t * t));
    const u = shellPos.getX(i) / ring;
    const v = THREE.MathUtils.clamp(shellPos.getY(i) / ring, -1, 1);
    const y = v >= 0 ? BASE + v ** FULL * crown(t) : BASE * (1 + v);
    shellPos.setXYZ(i, u * halfW(t), y, t * HALF_L);
  }
  shellGeo.computeVertexNormals();
  // Plain white plastic, its toon bands left clean: a grain texture on the sphere's uv bunches
  // up over the crown and reads as grit. The shell casts onto the desk but doesn't take its own
  // shadow, which on a curve this smooth only frays the edge between the bands.
  const shell = runtime.core.mesh(shellGeo, runtime.core.toon("#ffffff"), { outline: 0.035 });
  shell.receiveShadow = false;
  // Everything that moves with a press: the shell and what's set in it
  const mouseBody = new THREE.Group();
  mouseBody.add(shell);
  // A seam laid along the shell's top through (x, z) points, standing just proud of it
  const seamMat = runtime.core.toon("#9aa0a8");
  const seamLine = (points, r = 0.008) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, topY(x, z) + 0.002, z)));
    return runtime.core.mesh(runtime.core.track(new THREE.TubeGeometry(curve, points.length * 4, r, 5)), seamMat, { outline: 0, cast: false });
  };
  // The two buttons, as in the photo: split down the middle from the nose to where they end,
  // a little short of halfway back, and cut across there, bowing forward toward the sides
  const BUTTONS_END = -0.06;
  const buttonW = halfW(BUTTONS_END / HALF_L) * 0.93;
  mouseBody.add(seamLine(Array.from({ length: 15 }, (_, i) => {
    const x = (i / 14 - 0.5) * 2 * buttonW;
    return [x, BUTTONS_END - 0.035 * (x / buttonW) ** 2];
  })));
  mouseBody.add(seamLine(Array.from({ length: 8 }, (_, i) => [0, -0.585 + (i / 7) * (BUTTONS_END + 0.585)])));
  // The bottom shell's lip, a dark line all the way round its widest, just above the desk
  const lip = new THREE.CatmullRomCurve3(Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    const t = Math.sin(a);
    return new THREE.Vector3(Math.cos(a) * halfW(t) * 1.006 + Math.sign(Math.cos(a)) * 0.002, BASE + 0.004, t * HALF_L * 1.006);
  }), true);
  mouseBody.add(runtime.core.mesh(runtime.core.track(new THREE.TubeGeometry(lip, 128, 0.006, 5, true)), runtime.core.toon("#3a3d42"), { outline: 0, cast: false }));
  // The wheel, 22 mm across and red, a quarter of the way back, turning in a dark slot cut
  // between the buttons. A group, so it spins on its axle (x) with the rubber's ridges.
  const WHEEL_Z = -0.354;
  const slotTop = topY(0, WHEEL_Z);
  // laid along the slope of the shell there, so it sits in it rather than standing out of it
  const slope = Math.atan2(topY(0, WHEEL_Z + 0.02) - topY(0, WHEEL_Z - 0.02), 0.04);
  const slot = runtime.core.mesh(runtime.core.rbox(0.125, 0.04, 0.2, 0.018), runtime.core.toon("#1f2125"), { outline: 0, cast: false });
  slot.position.set(0, slotTop - 0.016, WHEEL_Z);
  slot.rotation.x = -slope;
  mouseBody.add(slot);
  const wheel = new THREE.Group();
  wheel.position.set(0, slotTop - 0.045, WHEEL_Z);
  const tyre = runtime.core.mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 36), runtime.core.toon("#e11d48"), { outline: 0.012, cast: false });
  tyre.rotation.z = Math.PI / 2;
  wheel.add(tyre);
  // The rubber's ridges across the tread, a shade darker
  const ridgeMat = runtime.core.toon("#a3122f");
  const ridgeGeo = runtime.core.track(new THREE.BoxGeometry(0.072, 0.008, 0.014));
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
    ridge.position.set(0, Math.cos(a) * 0.111, Math.sin(a) * 0.111);
    ridge.rotation.x = -a;
    ridge.raycast = runtime.core.noRaycast;
    wheel.add(ridge);
  }
  mouseBody.add(wheel);
  mouse.add(mouseBody);
  // It follows your real cursor over the desk, and clicks when you click.
  const MOUSE_ORIGIN = { x: 1.8, z: 0.45 };
  const mouseAim = { x: 1.85, z: 0.5 };
  const pressMouse = () => gsap.fromTo(mouseBody.position, { y: -0.05 }, { y: 0, duration: 0.2, ease: "back.out(3)" });
  // Click it and it turns into a real mouse for a moment: ears, eyes and a tail pop out, and it
  // scampers two laps round the clear patch of desk beside the keyboard, then goes back to work
  const earMat = runtime.core.toon("#d4d4d8");
  const critter = [];
  [-1, 1].forEach((side) => {
    const ear = runtime.core.mesh(new THREE.SphereGeometry(0.11, 14, 10), earMat, { outline: 0.015 });
    ear.scale.set(1.27, 1.4, 0.54);
    ear.position.set(side * 0.19, topY(side * 0.19, -0.19) + 0.11, -0.19);
    const inner = runtime.core.mesh(new THREE.SphereGeometry(0.065, 12, 8), runtime.core.toon("#ff90e8"), { outline: 0 });
    inner.position.z = 0.04;
    ear.add(inner);
    const eye = runtime.core.mesh(new THREE.SphereGeometry(0.047, 10, 8), runtime.core.toon("#000000"), { outline: 0 });
    // on the slope of the nose, either side of the button split
    eye.position.set(side * 0.12, topY(side * 0.12, -0.5) + 0.015, -0.5);
    critter.push(ear, eye);
  });
  const tailCurve = new THREE.CatmullRomCurve3([[0, 0.1, 0.5], [0, 0.084, 0.82], [0.165, 0.084, 1.0], [0.05, 0.17, 1.16], [-0.1, 0.28, 1.16]].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const tail = runtime.core.mesh(new THREE.TubeGeometry(tailCurve, 24, 0.03, 6), runtime.core.toon("#ff90e8"), { outline: 0.012 });
  critter.push(tail);
  // Hidden, not just shrunk: the outlines are drawn a set number of pixels thick, so a shrunk
  // ear or tail would still leave a black dot on the mouse, like a pair of eyes
  critter.forEach((part) => {
    part.userData.scale = part.scale.clone();
    part.scale.setScalar(0.001);
    part.visible = false;
    mouse.add(part);
  });
  let mouseRunning = false;
  // Two laps of an ellipse in the clear patch right of the keyboard (x < 1.5), short of the
  // coaster, the phone stand (z < -1.36) and the envelope (z > 2.18), with room for its body
  const RUN = { x: 1.73, z: 0.4, rx: 0.62, rz: 1.05 };
  const onLap = (a) => ({ x: RUN.x + Math.cos(a) * RUN.rx, z: RUN.z + Math.sin(a) * RUN.rz });
  const leg = () => ({ u: 0 });
  function scamper() {
    if (mouseRunning) return;
    mouseRunning = true;
    gsap.killTweensOf(mouse.rotation);
    runtime.secrets.discover("rat");
    critter.forEach((part, i) => {
      gsap.killTweensOf(part.scale);
      part.visible = true;
      gsap.to(part.scale, { ...part.userData.scale, duration: 0.3, delay: i * 0.04, ease: "back.out(3)" });
    });
    sfx.squeak();
    runtime.cat.catSpotsMouse();
    const start = { x: mouse.position.x, z: mouse.position.z };
    // Join the loop where it's nearest, run it twice round, and leave from the same point
    const A0 = Math.atan2((start.z - RUN.z) / RUN.rz, (start.x - RUN.x) / RUN.rx);
    const lap = onLap(A0);
    let last = { ...start };
    // Turns ease round instead of snapping, the short way round
    const place = (p) => {
      const dx = p.x - last.x;
      const dz = p.z - last.z;
      if (Math.hypot(dx, dz) > 1e-4) {
        const target = Math.atan2(-dx, -dz);
        const turn = Math.atan2(Math.sin(target - mouse.rotation.y), Math.cos(target - mouse.rotation.y));
        mouse.rotation.y += turn * 0.35;
      }
      mouse.position.x = p.x;
      mouse.position.z = p.z;
      last = p;
      wheel.rotation.x -= 0.4;
      mouseBody.position.y = Math.abs(Math.sin(performance.now() / 55)) * 0.04;
    };
    const [out, laps, home] = [leg(), leg(), leg()];
    gsap.timeline({
      onComplete: () => {
        mouseRunning = false;
        mouseBody.position.y = 0;
        mouse.rotation.y = Math.atan2(Math.sin(mouse.rotation.y), Math.cos(mouse.rotation.y));
        critter.forEach((part) => gsap.to(part.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.25, ease: "back.in(2)", onComplete: () => (part.visible = false) }));
        gsap.to(mouse.rotation, { y: -0.12, duration: 0.4, ease: "back.out(2)" });
      },
    })
      .delay(0.35)
      .to(out, { u: 1, duration: 0.25, ease: "power1.in", onUpdate: () => place({ x: start.x + (lap.x - start.x) * out.u, z: start.z + (lap.z - start.z) * out.u }) })
      .to(laps, { u: 1, duration: 3.2, ease: "sine.inOut", onUpdate: () => place(onLap(A0 - laps.u * Math.PI * 4)) })
      .to(home, { u: 1, duration: 0.35, ease: "power2.out", onUpdate: () => place({ x: lap.x + (mouseAim.x - lap.x) * home.u, z: lap.z + (mouseAim.z - lap.z) * home.u }) });
    // its feet up over the squeaks, so the run is heard all the way round
    [0.4, 1.3, 2.2, 3.0].forEach((delay) => sfx.patter({ duration: 0.7, delay, volume: 2.6 }));
    runtime.core.timers.push(setTimeout(() => sfx.squeak(), 4100));
  }
  runtime.core.register(mouse, {
    onHover: (on) => {
      if (mouseRunning) return;
      gsap.to(mouse.rotation, { y: on ? -0.28 : -0.12, duration: 0.25, ease: "power2.out", overwrite: true });
      gsap.to(wheel.rotation, { x: on ? -0.65 : 0, duration: 0.3, overwrite: true });
      // the wheel's notches
      if (on) hoverSound(mouse, (s) => [0, 0.035, 0.07].forEach((delay) => s.tick({ pitch: 0.9, delay })));
    },
    onClick: () => {
      sfx.click();
      scamper();
    },
  });

  // Public state used by the other scene parts.
  return {
    mouse,
    mouseAim,
    MOUSE_ORIGIN,
    pressMouse,
    get mouseRunning() { return mouseRunning; },
  };
}
