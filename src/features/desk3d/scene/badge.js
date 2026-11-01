import * as THREE from "three";
import gsap from "gsap";
import { hoverSound, sfx } from "@/shared/composables/useSfx";
import { canvasTexture, drawBadge, drawGlassSheen } from "../textures";

export function createBadge(runtime) {
  // ---------- ID badge on a lanyard, hung from a push pin on the About board's corner (hero) ----------
  // The board is 8.16 × 5.04 (scaled 1.2) centred at (19.3, 10.24) on the back wall: the pin sits in from its
  // top-left corner and the badge hangs down over the cork. Close up, the camera's near
  // plane cuts away the monitor in front of it (see the hero shot's depth).
  const BADGE_PIN = new THREE.Vector3(15.76, 12.22, runtime.room.WALL_Z + 0.48);
  const BADGE_CLIP = new THREE.Vector3(15.76, 10.18, runtime.room.WALL_Z + 0.58); // straight below the pin: the rope's resting shape
  // Shown with the About board it hangs from. While hidden, its parts stay out of the scene,
  // not just invisible, so the lanyard can't be hovered, grabbed or clicked.
  const SHOW_BADGE = true;
  const addBadgePart = (part) => SHOW_BADGE && runtime.core.scene.add(part);
  // Blue: it stands off the yellow badge, the red pin and the cork
  const strapWeave = canvasTexture(512, 128);
  runtime.core.track(strapWeave.texture);
  const weave = strapWeave.ctx;
  weave.fillStyle = "#245bd7";
  weave.fillRect(0, 0, 512, 128);
  for (let y = 0; y < 128; y += 3) {
    weave.fillStyle = y % 2 ? "#ffffff12" : "#0b256522";
    weave.fillRect(0, y, 512, 1);
  }
  weave.fillStyle = "#b9d3ff";
  for (const y of [5, 59, 69, 123]) {
    for (let x = 0; x < 512; x += 12) weave.fillRect(x, y, 7, 1);
  }
  weave.font = "700 11px 'Space Grotesk', sans-serif";
  weave.textAlign = "center";
  for (const y of [35, 99]) {
    for (const x of [128, 384]) weave.fillText("OKASP  /  MAKE THINGS WORK", x, y);
  }
  const strapMat = runtime.core.toon("#ffffff");
  strapMat.map = strapWeave.texture;
  // Where the pin is now: drag it to re-pin the badge anywhere on this stretch of wall
  const badgePin = BADGE_PIN.clone();
  const PIN_BOUNDS = { minX: 14.1, maxX: 23.4, minY: 6.04 + runtime.room.WALL_LIFT, maxY: 10.94 + runtime.room.WALL_LIFT };
  // A strap point (or the pin, index 0) held by the pointer: { index, x, y }
  let ropeHold = null;
  // The strap is a little verlet rope: a chain of points from the pin to the badge's clip,
  // pulled by gravity and held at fixed lengths, with the badge as a heavy weight at the end.
  // A nudge (hover, click) kicks the lower points, so the strap bends and the badge lags
  // behind it, then everything settles back.
  const ROPE_SEGMENTS = 8;
  const ROPE_LENGTH = BADGE_PIN.distanceTo(BADGE_CLIP) * 1.02;
  const ropeSegment = ROPE_LENGTH / ROPE_SEGMENTS;
  const rope = Array.from({ length: ROPE_SEGMENTS + 1 }, (_, i) => {
    const p = new THREE.Vector3().lerpVectors(BADGE_PIN, BADGE_CLIP, i / ROPE_SEGMENTS);
    return { x: p.x, y: p.y, px: p.x, py: p.y, z: p.z };
  });
  // Inverse mass: the pin never moves, the badge end is four times heavier than the strap
  const ropeWeight = (i) => (i === 0 || i === ropeHold?.index ? 0 : i === ROPE_SEGMENTS ? 0.25 : 1);
  let ropeClock = 0;
  let ropeTime = 0;
  function stepRope(dt) {
    const gravity = -22;
    const breeze = Math.sin(ropeTime * 0.8) * 0.5 + Math.sin(ropeTime * 2.1) * 0.25;
    rope[0].x = badgePin.x;
    rope[0].y = badgePin.y;
    for (let i = 1; i < rope.length; i++) {
      const p = rope[i];
      if (i === ropeHold?.index) {
        // Held: ease toward the pointer, keeping the motion as velocity for the throw on release
        p.px = p.x;
        p.py = p.y;
        p.x += (ropeHold.x - p.x) * 0.35;
        p.y += (ropeHold.y - p.y) * 0.35;
        continue;
      }
      const vx = (p.x - p.px) * 0.985;
      const vy = (p.y - p.py) * 0.985;
      p.px = p.x;
      p.py = p.y;
      p.x += vx + (i === ROPE_SEGMENTS ? breeze : 0) * dt * dt;
      p.y += vy + gravity * dt * dt;
    }
    for (let k = 0; k < 8; k++) {
      for (let i = 0; i < ROPE_SEGMENTS; i++) {
        const a = rope[i];
        const b = rope[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1e-6;
        const wa = ropeWeight(i);
        const wb = ropeWeight(i + 1);
        // both ends fixed (the strap held just under the pin): nothing to move
        if (!wa && !wb) continue;
        const diff = (dist - ropeSegment) / (dist * (wa + wb));
        a.x += dx * diff * wa;
        a.y += dy * diff * wa;
        b.x -= dx * diff * wb;
        b.y -= dy * diff * wb;
      }
    }
  }
  // Two strands meeting at the pin and the clip, spread into a V along the way
  const strandPoint = (i, side, out) => {
    const t = i / ROPE_SEGMENTS;
    return out.set(rope[i].x + side * 0.17 * Math.sin(Math.PI * t), rope[i].y, rope[i].z + 0.02);
  };
  // Flattened, rounded ribbons: reuse their buffers as the rope moves, including the outline.
  const STRAND_STEPS = 48;
  const STRAND_RADIUS = 0.075;
  const STRAND_DEPTH = 0.014;
  const strands = [-1, 1].map((side) => {
    const curve = new THREE.CatmullRomCurve3(rope.map((_, i) => strandPoint(i, side, new THREE.Vector3())));
    const geo = runtime.core.track(new THREE.TubeGeometry(curve, STRAND_STEPS, STRAND_RADIUS, 8));
    const tube = new THREE.Mesh(geo, strapMat);
    tube.castShadow = true;
    tube.receiveShadow = true;
    const hull = new THREE.Mesh(geo, runtime.core.outlineMat(0.018));
    hull.raycast = runtime.core.noRaycast;
    // the pin can be dragged anywhere on the wall, past the tube's first bounds
    tube.frustumCulled = hull.frustumCulled = false;
    tube.add(hull);
    addBadgePart(tube);
    return { side, curve, tube };
  });
  const strapPin = new THREE.Group();
  const pinMetal = runtime.core.toon("#b8c4d5");
  const pinSeat = runtime.core.mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.04, 20), runtime.core.toon("#9f1239"), { outline: 0.012 });
  pinSeat.rotation.x = Math.PI / 2;
  const pinStem = runtime.core.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.11, 12), pinMetal, { outline: 0.008 });
  pinStem.rotation.x = Math.PI / 2;
  pinStem.position.z = 0.04;
  const pinHead = runtime.core.mesh(new THREE.SphereGeometry(0.105, 18, 12), runtime.core.toon("#f43f5e"), { outline: 0.012 });
  pinHead.scale.set(1, 1, 0.65);
  pinHead.position.z = 0.12;
  const pinGlint = runtime.core.mesh(new THREE.SphereGeometry(0.025, 10, 8), runtime.core.toon("#ffbdcc"), { outline: 0, cast: false });
  pinGlint.position.set(-0.035, 0.04, 0.175);
  strapPin.add(pinSeat, pinStem, pinHead, pinGlint);
  strapPin.position.copy(BADGE_PIN).add(new THREE.Vector3(0, 0, 0.06));
  addBadgePart(strapPin);
  // Grabbing the lanyard: the pin, a point along the strap, or the badge (its clip end).
  // Works on the overview and the badge close-up, on the wall-parallel plane the strap hangs in.
  const lanyardPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(BADGE_PIN.z + 0.05));
  const lanyardPoint = new THREE.Vector3();
  const strapSegment = new THREE.Line3();
  const strapClosest = new THREE.Vector3();
  function lanyardAt(point, badgeHit) {
    if (Math.hypot(point.x - badgePin.x, point.y - badgePin.y) < 0.32) return { index: 0, strap: true, dx: 0, dy: 0 };
    let best = null;
    for (let i = 0; i < ROPE_SEGMENTS; i++) {
      strapSegment.start.set(rope[i].x, rope[i].y, point.z);
      strapSegment.end.set(rope[i + 1].x, rope[i + 1].y, point.z);
      const t = strapSegment.closestPointToPointParameter(point, true);
      const distance = strapSegment.at(t, strapClosest).distanceTo(point);
      if (distance < 0.28 && (!best || distance < best.distance)) best = { distance, index: Math.max(1, Math.round(i + t)) };
    }
    if (best) return { index: best.index, strap: true, dx: 0, dy: 0 };
    if (!badgeHit) return null;
    const end = rope[ROPE_SEGMENTS];
    return { index: ROPE_SEGMENTS, dx: point.x - end.x, dy: point.y - end.y };
  }
  function moveLanyard(hold, point) {
    if (hold.index === 0) {
      badgePin.x = THREE.MathUtils.clamp(point.x, PIN_BOUNDS.minX, PIN_BOUNDS.maxX);
      badgePin.y = THREE.MathUtils.clamp(point.y, PIN_BOUNDS.minY, PIN_BOUNDS.maxY);
      strapPin.position.x = badgePin.x;
      strapPin.position.y = badgePin.y;
      return;
    }
    // A strap point can't be pulled further from the pin than the strap reaches
    let x = point.x - hold.dx;
    let y = point.y - hold.dy;
    const reach = ropeSegment * hold.index;
    const away = Math.hypot(x - badgePin.x, y - badgePin.y);
    if (away > reach) {
      x = badgePin.x + ((x - badgePin.x) * reach) / away;
      y = badgePin.y + ((y - badgePin.y) * reach) / away;
    }
    ropeHold = { index: hold.index, x, y };
  }
  function grabLanyard(hold) {
    if (hold.index === 0) {
      gsap.to(strapPin.position, { z: BADGE_PIN.z + 0.4, duration: 0.18, ease: "back.out(2.5)", overwrite: true });
      sfx.pop({ pitch: 1.4 });
    } else {
      const p = rope[hold.index];
      ropeHold = { index: hold.index, x: p.x, y: p.y };
      sfx.strap({ speed: 0.3 });
    }
  }
  function releaseLanyard(hold) {
    ropeHold = null;
    if (hold.index !== 0) return;
    gsap.to(strapPin.position, { z: BADGE_PIN.z + 0.06, duration: 0.22, ease: "power4.in", overwrite: true });
    gsap.fromTo(strapPin.scale, { x: 1.3, y: 0.7 }, { x: 1, y: 1, delay: 0.22, duration: 0.4, ease: "elastic.out(1.2, 0.4)" });
    sfx.tick({ pitch: 0.55, delay: 0.2 });
  }
  const badge = new THREE.Group();
  badge.position.copy(BADGE_CLIP);
  addBadgePart(badge);
  // The badge swings on its clip a little behind the strap's own angle: a damped spring
  let badgeAngle = 0;
  let badgeSpin = 0;
  // How far out from the wall the badge must hang at (x, y, angle) to clear the papers under
  // it; the About board fills this in once its papers exist
  let badgeClearance = () => -Infinity;
  let badgeZ = BADGE_CLIP.z;
  const strapPoint = new THREE.Vector3();
  const strapTangent = new THREE.Vector3();
  function updateLanyard(dt) {
    ropeTime += dt;
    ropeClock += dt;
    const STEP = 1 / 120;
    while (ropeClock >= STEP) {
      stepRope(STEP);
      ropeClock -= STEP;
    }
    // Over a paper the badge stands off it, quick to pull out and slow to settle back, and
    // the strap leans out with it from the pin
    const clearance = Math.max(BADGE_CLIP.z, badgeClearance(rope[ROPE_SEGMENTS].x, rope[ROPE_SEGMENTS].y, badgeAngle));
    badgeZ += (clearance - badgeZ) * Math.min(1, dt * (clearance > badgeZ ? 30 : 4));
    rope.forEach((p, i) => (p.z = THREE.MathUtils.lerp(BADGE_PIN.z, badgeZ, i / ROPE_SEGMENTS)));
    strands.forEach(({ side, curve, tube }) => {
      curve.points.forEach((point, i) => strandPoint(i, side, point));
      const { position, normal } = tube.geometry.attributes;
      for (let i = 0; i <= STRAND_STEPS; i++) {
        curve.getPoint(i / STRAND_STEPS, strapPoint);
        curve.getTangent(i / STRAND_STEPS, strapTangent);
        const length = Math.hypot(strapTangent.x, strapTangent.y) || 1;
        const sx = strapTangent.y / length;
        const sy = -strapTangent.x / length;
        for (let j = 0; j <= 8; j++) {
          const angle = j / 8 * Math.PI * 2;
          const x = Math.cos(angle);
          const z = Math.sin(angle);
          const index = i * 9 + j;
          position.setXYZ(index, strapPoint.x + sx * x * STRAND_RADIUS, strapPoint.y + sy * x * STRAND_RADIUS, strapPoint.z + z * STRAND_DEPTH);
          const nx = x / STRAND_RADIUS;
          const nz = z / STRAND_DEPTH;
          const n = Math.hypot(nx, nz);
          normal.setXYZ(index, sx * nx / n, sy * nx / n, nz / n);
        }
      }
      position.needsUpdate = normal.needsUpdate = true;
    });
    const end = rope[ROPE_SEGMENTS];
    const before = rope[ROPE_SEGMENTS - 2];
    badge.position.set(end.x, end.y, badgeZ);
    const target = Math.atan2(end.x - before.x, before.y - end.y);
    const spinBefore = badgeSpin;
    badgeSpin += (90 * (target - badgeAngle) - 7 * badgeSpin) * dt;
    badgeAngle += badgeSpin * dt;
    badge.rotation.z = badgeAngle;
    // Each time a real swing turns back, the holder knocks its clip; the breeze's little drift
    // never builds enough to click
    swingPeak = Math.max(swingPeak, Math.abs(badgeSpin));
    if (Math.sign(badgeSpin) !== Math.sign(spinBefore) && spinBefore !== 0) {
      if (swingPeak > BADGE_CLICK_SPIN) sfx.badgeClick({ strength: Math.min(1, swingPeak / 8) });
      swingPeak = 0;
    }
  }
  let swingPeak = 0;
  const BADGE_CLICK_SPIN = 1.5;
  // A sideways push on the lower part of the strap, strongest at the badge
  const swing = (amount) => {
    rope.forEach((p, i) => {
      const reach = i / ROPE_SEGMENTS;
      p.px -= amount * 0.09 * reach * reach;
    });
  };
  // Deep enough to close round both strands' ends (they meet at its centre, 0.05 thick and
  // 0.02 proud of the badge), so neither pokes out through its face
  const clip = new THREE.Group();
  clip.position.z = 0.02;
  const clipBody = runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.23, 0.14, 0.09, 0.025), pinMetal, { outline: 0.012 }), 0, 0, 0.025);
  const clipInset = runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.15, 0.045, 0.015, 0.01), runtime.core.toon("#526075"), { outline: 0.006 }), 0, 0.01, 0.08);
  const clipRivet = runtime.core.at(runtime.core.mesh(new THREE.SphereGeometry(0.025, 12, 8), runtime.core.toon("#edf4ff"), { outline: 0.006 }), 0, -0.025, 0.085);
  const clipRing = runtime.core.mesh(new THREE.TorusGeometry(0.07, 0.018, 8, 20), pinMetal, { outline: 0.008 });
  clipRing.position.set(0, -0.115, 0.025);
  clip.add(clipBody, clipInset, clipRivet, clipRing);
  const badgeCard = new THREE.Group();
  // About the size of a real ID card on a lanyard (it was reading as a clipboard)
  badgeCard.position.y = -0.74;
  const badgeFront = runtime.core.printed(0.76, 1.22, 700, (c, w, h) => drawBadge(c, w, h));
  badgeFront.position.z = 0.038;
  const badgeBack = runtime.core.printed(0.76, 1.22, 700, (c, w, h) => drawBadge(c, w, h, { back: true }));
  badgeBack.position.z = -0.038;
  badgeBack.rotation.y = Math.PI;
  const badgeHolder = runtime.core.mesh(runtime.core.phoneSlab(0.86, 1.34, 0.065, 0.06), runtime.core.toon("#d6e2ee"), { outline: 0.015 });
  const badgeLip = runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.23, 0.1, 0.07, 0.025), pinMetal, { outline: 0.012 }), 0, 0.65, 0);
  const holderSlot = runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.115, 0.025, 0.075, 0.01), runtime.core.toon("#273449"), { outline: 0 }), 0, 0.66, 0);
  // the clear vinyl sleeve over each face: two hard streaks of gloss (unlit, so the theme
  // dims them by dusk and night; see SLEEVE_SHEEN in theme.js)
  const sleeveTex = canvasTexture(256, 400);
  runtime.core.track(sleeveTex.texture);
  drawGlassSheen(sleeveTex.ctx, 256, 400, { strength: 0.2 });
  const sleeveMat = runtime.core.track(new THREE.MeshBasicMaterial({ map: sleeveTex.texture, transparent: true, depthWrite: false }));
  // (just inside the card's printed edge, so the streaks never run out over the holder's rim)
  const sleeveGeo = runtime.core.track(new THREE.PlaneGeometry(0.74, 1.2));
  const sleeves = [0.041, -0.041].map((z) => {
    const sleeve = new THREE.Mesh(sleeveGeo, sleeveMat);
    sleeve.position.z = z;
    if (z < 0) sleeve.rotation.y = Math.PI;
    sleeve.raycast = runtime.core.noRaycast;
    return sleeve;
  });
  badgeCard.add(badgeHolder, badgeFront, badgeBack, badgeLip, holderSlot, ...sleeves);
  badge.add(clip, badgeCard);
  // Zoomed in, clicking the badge turns it over: the links are printed on the back
  let badgeFlipped = false;
  const flipBadge = (to = !badgeFlipped) => {
    badgeFlipped = to;
    runtime.secrets.discover("badge");
    gsap.to(badgeCard.rotation, { y: to ? Math.PI : 0, duration: 0.6, ease: "back.out(1.4)", overwrite: true });
    // Turning, the card is wider than its gap to the board: lift it clear, then let it settle back
    gsap.fromTo(badgeCard.position, { z: 0 }, { keyframes: [{ z: 0.45, duration: 0.25, ease: "power2.out" }, { z: 0, duration: 0.35, ease: "power2.in" }] });
    sfx.whoosh({ duration: 0.3 });
  };
  runtime.core.register(badge, {
    focus: "hero",
    onHover: (on) => {
      if (!on) return;
      swing(0.18);
      hoverSound(badge, (s) => s.badgeClick());
    },
    onClick: () => {
      swing(0.2);
      flipBadge();
    },
    onLeave: () => badgeFlipped && flipBadge(false),
    // Arrival: a full spin (flashing the back: "if found, please hire") then a settle
    onArrive: () => {
      if (badgeFlipped) return;
      gsap.fromTo(badgeCard.rotation, { y: 0 }, { y: Math.PI * 2, duration: 1.1, ease: "power3.out", onComplete: () => !badgeFlipped && (badgeCard.rotation.y = 0) });
      gsap.fromTo(badgeCard.position, { z: 0 }, { keyframes: [{ z: 0.6, duration: 0.3, ease: "power2.out" }, { z: 0, duration: 0.8, ease: "power2.inOut" }] });
      sfx.whoosh({ duration: 0.5 });
    },
  });

  // Public state used by the other scene parts.
  return {
    shown: SHOW_BADGE,
    get badgeClearance() { return badgeClearance; },
    set badgeClearance(value) { badgeClearance = value; },
    badgeFront,
    sleeveMat,
    grabLanyard,
    lanyardPlane,
    lanyardPoint,
    moveLanyard,
    badge,
    lanyardAt,
    releaseLanyard,
    swing,
    badgePin,
    BADGE_PIN,
    BADGE_CLIP,
    updateLanyard,
  };
}
