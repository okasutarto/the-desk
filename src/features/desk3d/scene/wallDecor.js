import * as THREE from "three";
import gsap from "gsap";
import { hoverSound, sfx } from "@/shared/composables/useSfx";
import { canvasTexture, drawPainting, PAINTING_COUNT, drawClockFace, drawRug } from "../textures";

export function createWallDecor(runtime) {
  // Wall clock and a small print give the empty upper area a purpose.
  const clock = new THREE.Group();
  // Lined up over the monitor as seen from the desk view
  // Low enough that its top stays in frame on wide, short screens
  clock.position.set(11.05, 12.6, runtime.room.WALL_Z + 0.21); // centred over the shelf, well above the gauntlet
  const clockMount = new THREE.Group();
  clockMount.position.copy(clock.position).add(new THREE.Vector3(0, 0.78, 0));
  clock.position.set(0, -0.78, 0);
  clockMount.add(clock);
  // Kept out of the scene, not just invisible, while hidden, so it can't be hovered or clicked
  const SHOW_CLOCK = true;
  if (SHOW_CLOCK) runtime.room.room.add(clockMount);
  const CLOCK_SCALE = 30 / 18;
  clock.scale.setScalar(CLOCK_SCALE); // 30 cm diameter; centre 200 cm above the floor.
  // One slim turned white case, like the family photo's frame: a flat back, a shallow side,
  // then a narrow rolled lip that curls over and drops in a short step to the dial (radius,
  // depth; lathed round y, then stood up so its depth runs along z). It's outlined by a plain
  // drum of its size: its own lip, facing in, would push the ink in over the dial's edge.
  const DIAL_R = 0.84;
  const CASE_PROFILE = [[0, -0.05], [0.885, -0.05], [0.9, -0.035], [0.9, 0.045], [0.895, 0.063], [0.882, 0.074], [0.866, 0.077],
    [0.851, 0.072], [0.843, 0.058], [DIAL_R, 0.045], [0, 0.04]];
  const caseHull = new THREE.CylinderGeometry(0.9, 0.9, 0.127, 48).translate(0, (0.077 - 0.05) / 2, 0);
  const clockRim = runtime.core.mesh(new THREE.LatheGeometry(CASE_PROFILE.map(([r, z]) => new THREE.Vector2(r, z)), 48), runtime.core.toon("#f4f3ef"), { outline: 0.018, hull: caseHull });
  clockRim.rotation.x = Math.PI / 2;
  const dial = canvasTexture(512, 512);
  runtime.core.track(dial.texture);
  drawClockFace(dial.ctx, 512, 512);
  const clockFace = new THREE.Mesh(runtime.core.track(new THREE.CircleGeometry(DIAL_R, 48)), runtime.core.printMaterial(dial.texture));
  clockFace.position.z = 0.045;
  const clockHandMat = runtime.core.toon("#000000");
  const hourHand = new THREE.Group();
  const minuteHand = new THREE.Group();
  [[hourHand, 0.42], [minuteHand, 0.62]].forEach(([pivot, length]) => {
    const hand = runtime.core.mesh(new THREE.BoxGeometry(0.075, length, 0.025), clockHandMat, { cast: false, outline: 0 });
    hand.position.y = length / 2;
    pivot.position.z = 0.085;
    pivot.add(hand);
  });
  // A red seconds hand with a round counterweight that ticks round, and a gold cap over the pivot
  const secondHand = new THREE.Group();
  secondHand.position.z = 0.1;
  const secondMat = runtime.core.toon("#e11d48");
  secondHand.add(
    runtime.core.at(runtime.core.mesh(new THREE.BoxGeometry(0.022, 0.86, 0.012), secondMat, { cast: false, outline: 0 }), 0, 0.27, 0),
    runtime.core.at(runtime.core.mesh(new THREE.CircleGeometry(0.05, 16), secondMat, { cast: false, outline: 0 }), 0, -0.12, 0.008),
  );
  const clockCap = runtime.core.mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 16), runtime.core.toon("#ffd34d"), { outline: 0.008, cast: false });
  clockCap.rotation.x = Math.PI / 2;
  clockCap.position.z = 0.115;
  clock.add(clockRim, clockFace, hourHand, minuteHand, secondHand, clockCap);
  let lastSecond = -1;
  function updateSecondHand() {
    const sec = new Date().getSeconds();
    if (sec === lastSecond || clockBusy) return;
    lastSecond = sec;
    gsap.to(secondHand.rotation, { z: -(sec / 60) * Math.PI * 2, duration: 0.25, ease: "elastic.out(1.2, 0.5)", overwrite: true });
    if (sec === 0) secondHand.rotation.z = Math.PI * 2 / 60;
  }
  const updateRoomClock = () => {
    const now = new Date();
    minuteHand.rotation.z = -(now.getMinutes() / 60) * Math.PI * 2;
    hourHand.rotation.z = -((now.getHours() % 12 + now.getMinutes() / 60) / 12) * Math.PI * 2;
  };
  updateRoomClock();
  // Click the clock: its hands whirl round twice, it rocks on its nail, then strikes the hour
  let clockBusy = false;
  runtime.core.register(clock, {
    onHover: (on) => {
      if (clockBusy) return;
      gsap.to(clockMount.rotation, { z: on ? 0.13 : 0, duration: on ? 0.35 : 0.8, ease: on ? "back.out(1.8)" : "elastic.out(1, 0.5)", overwrite: true });
      // tick-tock
      if (on) hoverSound(clock, (s) => {
        s.tick({ pitch: 0.6 });
        s.tick({ pitch: 0.5, delay: 0.18 });
      });
    },
    onClick: () => {
      if (clockBusy) return;
      clockBusy = true;
      gsap.to(clockMount.rotation, { z: 0, duration: 0.2, overwrite: true });
      runtime.secrets.discover("clock");
      gsap.to(minuteHand.rotation, { z: minuteHand.rotation.z - Math.PI * 4, duration: 1.4, ease: "power2.inOut" });
      gsap.to(hourHand.rotation, {
        z: hourHand.rotation.z - Math.PI * 2, duration: 1.4, ease: "power2.inOut",
        onComplete: () => {
          updateRoomClock();
          gsap.fromTo(clockMount.rotation, { z: 0.14 }, { z: 0, duration: 1.4, ease: "elastic.out(1, 0.2)", overwrite: true, onComplete: () => (clockBusy = false) });
          gsap.fromTo(clock.scale, { x: CLOCK_SCALE * 1.1, y: CLOCK_SCALE * 1.1 }, { x: CLOCK_SCALE, y: CLOCK_SCALE, duration: 0.5, ease: "back.out(3)" });
          // It strikes the hour, as a wall clock does (a few strokes at most)
          sfx.clockStrike({ count: Math.min(3, new Date().getHours() % 12 || 12) });
        },
      });
      // the movement ratcheting as the hands whirl
      for (let i = 0; i < 12; i++) sfx.tick({ pitch: 1.1 + (i % 2) * 0.25, delay: i * 0.11 });
    },
  });
  // The rug runs from just in front of the back wall's skirting (its face is 0.31 out from the
  // wall slab's middle) to well past the chair, its border whole on every side: 160 cm across,
  // the desk's own width, so the shelf beside it stands on the bare floor
  const RUG = { x: -1, w: 16, back: runtime.room.WALL_Z + 0.33, front: 13 };
  const rugD = RUG.front - RUG.back;
  const rugZ = (RUG.front + RUG.back) / 2;
  const rugTex = canvasTexture(2000, Math.round(2000 * rugD / RUG.w));
  runtime.core.track(rugTex.texture);
  drawRug(rugTex.ctx, 2000, Math.round(2000 * rugD / RUG.w));
  const rugTop = new THREE.Mesh(runtime.core.track(new THREE.PlaneGeometry(RUG.w, rugD)), runtime.core.toon("#ffffff"));
  rugTop.material.map = rugTex.texture;
  rugTop.rotation.x = -Math.PI / 2;
  rugTop.position.set(RUG.x, runtime.room.FLOOR_Y + 0.07, rugZ);
  rugTop.receiveShadow = true;
  rugTop.raycast = runtime.core.noRaycast;
  const rugBase = runtime.core.mesh(runtime.core.rbox(RUG.w, 0.08, rugD, 0.03), runtime.core.toon("#1a1714"), { outline: 0.03, cast: false });
  rugBase.position.set(RUG.x, runtime.room.FLOOR_Y + 0.025, rugZ);
  rugBase.raycast = runtime.core.noRaycast;
  runtime.room.room.add(rugBase, rugTop);

  // A framed painting hung from a nail on a wire. It's a little gallery: click it and it swings,
  // turns over and shows the next picture (a sunset, a city at night, a great wave).
  const PAINTING_DROP = 1.75; // nail to the painting's centre
  const paintingHang = new THREE.Group();
  // Hung clear of the lamp, but low enough that the frame and its nail stay in frame on wide,
  // short screens
  // Centred level with the About board (y 8.4), scaled up as a whole with its nail and wire
  const PAINTING_SCALE = 1.3;
  paintingHang.position.set(-5.9, 9.6 + PAINTING_DROP * PAINTING_SCALE, runtime.room.WALL_Z + 0.24);
  paintingHang.scale.setScalar(PAINTING_SCALE);
  const SHOW_PAINTING = true;
  if (SHOW_PAINTING) runtime.room.room.add(paintingHang);
  const paintingTurn = new THREE.Group();
  paintingTurn.position.y = -PAINTING_DROP;
  paintingHang.add(paintingTurn);
  // The frame casts onto the wall's shadow catcher
  const paintingWood = runtime.core.toon("#9a704e");
  paintingWood.map = runtime.room.windowWood.texture;
  const paintingFrame = runtime.core.mesh(runtime.core.rbox(4.0, 2.9, 0.16, 0.035), paintingWood, { outline: 0.035, cast: true });
  // Raised walnut moulding, a recessed print and a fine brass inner lip.
  const frameGrain = runtime.core.track(runtime.room.windowWood.texture.clone());
  frameGrain.center.set(0.5, 0.5);
  frameGrain.rotation = Math.PI / 2;
  frameGrain.needsUpdate = true;
  const uprightWood = runtime.core.toon("#896142");
  uprightWood.map = frameGrain;
  const frameLip = runtime.core.toon("#bc995d");
  [-1, 1].forEach((side) => {
    paintingTurn.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(4, 0.14, 0.1, 0.025), paintingWood, { outline: 0.012 }), 0, side * 1.38, 0.085));
    paintingTurn.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.14, 2.64, 0.1, 0.025), uprightWood, { outline: 0.012 }), side * 1.93, 0, 0.085));
    paintingTurn.add(runtime.core.at(runtime.core.mesh(new THREE.BoxGeometry(3.74, 0.018, 0.015), frameLip, { outline: 0 }), 0, side * 1.315, 0.105));
    paintingTurn.add(runtime.core.at(runtime.core.mesh(new THREE.BoxGeometry(0.018, 2.62, 0.015), frameLip, { outline: 0 }), side * 1.865, 0, 0.105));
  });
  let paintingArt = 0;
  const painting = runtime.core.printed(3.75, 2.65, 300, (c, w, h) => drawPainting(c, w, h, { art: paintingArt }));
  painting.position.z = 0.09;
  paintingTurn.add(paintingFrame, painting);
  const nail = runtime.core.mesh(new THREE.SphereGeometry(0.07, 10, 8), runtime.core.toon("#9ca3af"), { outline: 0.015 });
  nail.position.z = 0.06;
  paintingHang.add(nail);
  [-1, 1].forEach((side) => paintingHang.add(runtime.core.rod(new THREE.Vector3(0, 0, 0.02), new THREE.Vector3(side * 1.3, -PAINTING_DROP + 1.45, 0.02), 0.015, runtime.core.toon("#1a1714"), 0)));
  let paintingBusy = false;
  runtime.core.register(paintingHang, {
    onHover: (on) => {
      if (paintingBusy) return;
      gsap.to(paintingHang.rotation, { z: on ? -0.085 : 0, duration: on ? 0.35 : 0.9, ease: on ? "back.out(1.8)" : "elastic.out(1, 0.5)", overwrite: true });
      // the frame knocks against the wall
      if (on) hoverSound(paintingHang, (s) => s.knock({ strength: 0.6 }));
    },
    onClick: () => {
      if (paintingBusy) return;
      paintingBusy = true;
      runtime.secrets.discover("painting");
      gsap.fromTo(paintingHang.rotation, { z: 0.09 }, { z: 0, duration: 1.6, ease: "elastic.out(1, 0.25)", overwrite: true, onComplete: () => (paintingBusy = false) });
      // Squashed edge-on and back (a turn round its vertical axis would go through the wall)
      gsap.timeline()
        .to(paintingTurn.scale, { x: 0.02, duration: 0.2, ease: "power2.in" })
        .call(() => {
          paintingArt = (paintingArt + 1) % PAINTING_COUNT;
          painting.userData.tex.redraw();
        })
        .to(paintingTurn.scale, { x: 1, duration: 0.35, ease: "back.out(2)" });
      sfx.slide({ up: true });
      sfx.knock({ strength: 0.6, delay: 0.5 });
    },
  });

  // Public state used by the other scene parts.
  return {
    rugTop,
    paintingHang,
    clock,
    updateRoomClock,
    updateSecondHand,
  };
}
