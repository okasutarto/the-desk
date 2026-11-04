import * as THREE from "three";
import gsap from "gsap";
import { hoverSound, sfx } from "@/shared/composables/useSfx";
import { DEVICE_FINISHES } from "../deviceFinishes";

export function createMouse(runtime) {
  // ---------- mouse (decor) ----------
  const mouse = new THREE.Group();
  mouse.position.set(1.85, runtime.keyboard.MAT_TOP, 0.5);
  mouse.rotation.y = -0.12;
  runtime.core.scene.add(mouse);
  // A wireless gaming mouse at its real size (a scene unit is 10 cm): 125 mm long, 63.5 mm across
  // the back and 33 mm high, a little lower than most. Seen from above its sides
  // run nearly straight, nipped in a touch at the waist, with a blunt nose and a rounder back;
  // side on, it rises from a low front under the buttons to a hump behind the middle.
  // t runs along it, -1 at the nose to 1 at the back.
  const HALF_L = 0.625;
  const BASE = 0.035;
  // Top and side silhouettes sampled from the reference, nose to heel. Keeping the
  // profiles separate avoids an inflated oval and the upturned nose of the old sphere warp.
  const widths = [0, 0.23, 0.289, 0.303, 0.306, 0.303, 0.301, 0.300, 0.302, 0.307, 0.314, 0.3175, 0.314, 0.301, 0.267, 0.199, 0];
  const heights = [0.14, 0.175, 0.205, 0.235, 0.265, 0.29, 0.315, 0.335, 0.34, 0.337, 0.328, 0.31, 0.285, 0.255, 0.215, 0.16, 0.075];
  const profile = (values, t) => {
    const u = THREE.MathUtils.clamp((t + 1) * 8, 0, 16);
    const i = Math.min(15, Math.floor(u));
    const f = u - i;
    const a = values[Math.max(0, i - 1)], b = values[i], c = values[i + 1], d = values[Math.min(16, i + 2)];
    return b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
  };
  // Interpolate squared widths so both rounded tips have a vertical tangent.
  const widthSquares = widths.map((width) => width * width);
  const halfW = (t) => Math.sqrt(Math.max(0, profile(widthSquares, t)));
  const noseLift = (t) => 0.095 * THREE.MathUtils.smoothstep(-t, 0.7, 1);
  const bottomY = (t) => BASE + noseLift(t);
  const crown = (t) => Math.max(0.01, profile(heights, t) - bottomY(t));
  const FULL = 0.7;
  const topY = (x, z) => {
    const t = z / HALF_L;
    const u = Math.min(1, Math.abs(x) / Math.max(1e-6, halfW(t)));
    return bottomY(t) + (1 - u * u) ** (FULL / 2) * crown(t);
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
    const y = bottomY(t) + (v >= 0 ? v ** FULL * crown(t) : v * 0.018);
    shellPos.setXYZ(i, u * halfW(t), y, t * HALF_L);
  }
  shellGeo.computeVertexNormals();
  // Smooth plastic, its toon bands left clean: a grain texture on the sphere's uv bunches
  // up over the crown and reads as grit. The shell casts onto the desk but doesn't take its own
  // shadow, which on a curve this smooth only frays the edge between the bands.
  const shell = runtime.core.mesh(shellGeo, runtime.core.toon("#ffffff"), { outline: 0.018 });
  shell.name = "mouse-shell";
  const seamMat = runtime.core.toon("#424242");
  const sideButtonMat = runtime.core.toon("#eeeeee");
  function setMouseFinish(finish) {
    if (!Object.hasOwn(DEVICE_FINISHES.mouse.finishes, finish)) return;
    shell.material.color.set(DEVICE_FINISHES.mouse.finishes[finish].shell);
    seamMat.color.copy(shell.material.color).multiplyScalar(0.055);
    sideButtonMat.color.copy(shell.material.color).multiplyScalar(0.87);
  }
  setMouseFinish(runtime.options.deviceFinishes?.mouse || DEVICE_FINISHES.mouse.default);
  shell.receiveShadow = false;
  // Everything that moves with a press: the shell and what's set in it
  const mouseBody = new THREE.Group();
  mouseBody.add(shell);
  // All button gaps lie on the crown. The rear boundary is nearly straight in plan;
  // the short curved corners join it to the two long outer button edges.
  function surfaceSeam(points, name) {
    const path = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const vertices = [];
    const indices = [];
    for (let i = 0; i <= 160; i++) {
      const p = path.getPoint(i / 160);
      const tangent = path.getTangent(i / 160);
      for (const side of [-1, 1]) {
        const x = p.x - tangent.z * side * 0.0022;
        const z = p.z + tangent.x * side * 0.0022;
        vertices.push(x, topY(x, z) + 0.001, z);
      }
      if (i < 160) {
        const v = i * 2;
        indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      }
    }
    const geo = runtime.core.track(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const seam = runtime.core.mesh(geo, seamMat, { outline: 0, cast: false });
    seam.name = name;
    mouseBody.add(seam);
  }
  surfaceSeam([[0, -0.612], [0, -0.46]], "mouse-button-split");
  surfaceSeam([[0, -0.25], [0, -0.06]], "mouse-button-split");
  surfaceSeam([
    [-0.278, -0.48], [-0.24, -0.36], [-0.235, -0.18], [-0.247, -0.09],
    [-0.247, -0.065], [-0.225, -0.06], [0, -0.06], [0.225, -0.06],
    [0.247, -0.065], [0.247, -0.09], [0.235, -0.18], [0.24, -0.36], [0.278, -0.48],
  ], "mouse-button-rear-seam");
  // Recessed black underside, visible as the slim band beneath the white shell in profile.
  const baseGeo = runtime.core.track(new THREE.SphereGeometry(1, 72, 48));
  const basePos = baseGeo.attributes.position;
  for (let i = 0; i < basePos.count; i++) {
    const t = THREE.MathUtils.clamp(basePos.getZ(i), -1, 1);
    const ring = Math.sqrt(Math.max(1e-9, 1 - t * t));
    const u = basePos.getX(i) / ring;
    const v = THREE.MathUtils.clamp(basePos.getY(i) / ring, -1, 1);
    basePos.setXYZ(i, u * halfW(t) * 0.98, 0.006 + (1 + v) * 0.014 + noseLift(t) * 0.95, t * HALF_L * 0.985);
  }
  baseGeo.computeVertexNormals();
  const base = runtime.core.mesh(baseGeo, runtime.core.toon("#191b1e"), { outline: 0.006, cast: false });
  base.name = "mouse-base";
  mouseBody.add(base);
  // Two separate thumb buttons on the left flank, with dark gaps around their edges.
  const sideX = (y, z) => {
    const t = z / HALF_L;
    const v = THREE.MathUtils.clamp((y - bottomY(t)) / crown(t), 0, 1);
    return -halfW(t) * Math.sqrt(1 - v ** (2 / FULL));
  };
  const thumbGeometry = (width, height, depth, y, z) => {
    const w = width / 2, h = height / 2;
    const shape = new THREE.Shape();
    if (z < 0) {
      shape.moveTo(-w * 0.72, -h);
      shape.quadraticCurveTo(-w, -h, -w, 0);
      shape.quadraticCurveTo(-w, h, -w * 0.72, h);
      shape.lineTo(w * 0.76, h);
      shape.lineTo(w, -h);
    } else {
      shape.moveTo(-w, h);
      shape.lineTo(w * 0.7, h);
      shape.quadraticCurveTo(w, h, w, 0);
      shape.quadraticCurveTo(w, -h, w * 0.7, -h);
      shape.lineTo(-w * 0.76, -h);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 8 });
    geo.translate(0, 0, -depth / 2);
    geo.rotateY(-Math.PI / 2);
    geo.rotateX(z < 0 ? -0.18 : -0.02);
    const pos = geo.attributes.position;
    // Follow the whole flank, not just its centre: flat buttons were buried in the shell
    // along their lower edges, leaving broken outlines and a seam through the first button.
    for (let i = 0; i < pos.count; i++) {
      pos.setX(i, pos.getX(i) + sideX(y + pos.getY(i), z + pos.getZ(i)) - sideX(y, z));
    }
    geo.computeVertexNormals();
    return geo;
  };
  const thumbGapMat = runtime.core.toon("#24262a");
  for (const z of [-0.17, 0.04]) {
    const y = 0.18 + z * 0.08;
    const x = sideX(y, z);
    const gap = runtime.core.mesh(thumbGeometry(0.188, 0.059, 0.012, y, z), thumbGapMat, { outline: 0, cast: false });
    gap.position.set(x - 0.002, y, z);
    gap.name = "mouse-thumb-recess";
    const button = runtime.core.mesh(thumbGeometry(0.18, 0.052, 0.014, y, z), sideButtonMat, { outline: 0, cast: false });
    button.position.set(x - 0.01, y, z);
    button.name = "mouse-thumb-button";
    mouseBody.add(gap, button);
  }
  const status = runtime.core.mesh(new THREE.SphereGeometry(0.0045, 12, 8), runtime.core.track(new THREE.MeshBasicMaterial({ color: "#3cff43" })), { outline: 0, cast: false });
  status.name = "mouse-status-led";
  status.scale.y = 0.2;
  status.position.set(0, topY(0, 0.015) + 0.0015, 0.015);
  mouseBody.add(status);
  // A narrow rubber wheel, mostly recessed into its slot, a quarter of the way back, turning in a dark slot cut
  // between the buttons. A group, so it spins on its axle (x) with the rubber's ridges.
  const WHEEL_Z = -0.354;
  const slotTop = topY(0, WHEEL_Z);
  // laid along the slope of the shell there, so it sits in it rather than standing out of it
  const slope = Math.atan2(topY(0, WHEEL_Z + 0.02) - topY(0, WHEEL_Z - 0.02), 0.04);
  const slotGeo = new THREE.CapsuleGeometry(0.049, 0.116, 6, 16);
  slotGeo.rotateX(Math.PI / 2);
  slotGeo.scale(1, 0.14, 1);
  const slot = runtime.core.mesh(slotGeo, runtime.core.toon("#1f2125"), { outline: 0, cast: false });
  slot.position.set(0, slotTop - 0.006, WHEEL_Z);
  slot.rotation.x = -slope;
  mouseBody.add(slot);
  const wheel = new THREE.Group();
  wheel.position.set(0, slotTop - 0.065, WHEEL_Z);
  const tyre = runtime.core.mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.065, 48), runtime.core.toon("#34363a"), { outline: 0, cast: false });
  tyre.rotation.z = Math.PI / 2;
  wheel.add(tyre);
  // The rubber's ridges across the tread, a shade darker
  const ridgeMat = runtime.core.toon("#202226");
  const ridgeGeo = runtime.core.track(new THREE.BoxGeometry(0.061, 0.004, 0.009));
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
    ridge.position.set(0, Math.cos(a) * 0.096, Math.sin(a) * 0.096);
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
    setMouseFinish,
    mouse,
    mouseAim,
    MOUSE_ORIGIN,
    pressMouse,
    get mouseRunning() { return mouseRunning; },
  };
}
