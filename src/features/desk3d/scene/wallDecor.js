import * as THREE from "three";
import gsap from "gsap";
import { hoverSound, sfx } from "@/shared/composables/useSfx";
import { canvasTexture, drawPainting, PAINTING_COUNT, drawClockFace, drawRug } from "../textures";
import { DEVICE_FINISHES } from "../deviceFinishes";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export function createWallDecor(runtime) {
  // A flag clock, the kind hung in a station corridor: one plain case fixed square to the wall
  // and standing straight out from it, rounded at its far end, a face on either side: a
  // rounded bezel round each cream dial, and chunky hands in the case's own colour.
  const clock = new THREE.Group();
  // Low enough that its top stays in frame on wide, short screens
  // Over the Switch, towards the shelf's right end (its centre is at x 11.05), so the case
  // standing out from the wall stays clear of the gauntlet
  clock.position.set(13.3, 12.6, runtime.room.WALL_Z + 0.21);
  const clockMount = new THREE.Group();
  clockMount.position.copy(clock.position).add(new THREE.Vector3(0, 0.78, 0));
  clock.position.set(0, -0.78, 0);
  clockMount.add(clock);
  // Kept out of the scene, not just invisible, while hidden, so it can't be hovered or clicked
  const SHOW_CLOCK = true;
  if (SHOW_CLOCK) runtime.room.room.add(clockMount);
  const CLOCK_SCALE = 30 / 18;
  // Each face is 40 × 26 cm; its centre 200 cm above the floor. In the clock's own units the
  // round ends have a radius of 0.78 and the straight run between their centres is 2 × 0.42.
  clock.scale.setScalar(CLOCK_SCALE);
  const CLOCK_RUN = 0.42;
  const DIAL_R = 0.64;
  // Each arc draws its own straight run in from the point before it. (Drawn to the arc's
  // start by hand, the line would end a rounding error short of it, and the near-duplicate
  // point makes a sliver of a side wall whose stray normal inks a line across the case.)
  // For the same reason the outlines start mid-way along a straight, not at an arc's end.
  const capsuleShape = (r) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, -r);
    shape.absarc(CLOCK_RUN, 0, r, -Math.PI / 2, Math.PI / 2, false);
    shape.absarc(-CLOCK_RUN, 0, r, Math.PI / 2, Math.PI * 1.5, false);
    return shape;
  };
  // The case's own outline: the capsule's far end, then a straight run on past the dial to a
  // square end (softly rounded at the corners) that is fixed flat to the wall. The case and
  // its bracket are one piece, so no seam is inked between them. `r` is the half-height; a
  // smaller r insets the whole outline evenly (for the bevel).
  const CASE_R = 0.78;
  const CLOCK_NECK = 0.45;
  const caseShape = (r) => {
    const inset = CASE_R - r;
    const end = CLOCK_RUN + CASE_R + CLOCK_NECK - inset;
    const corner = Math.max(0.02, 0.12 - inset);
    const shape = new THREE.Shape();
    shape.moveTo(0, -r);
    shape.lineTo(end - corner, -r);
    shape.quadraticCurveTo(end, -r, end, -r + corner);
    shape.lineTo(end, r - corner);
    shape.quadraticCurveTo(end, r, end - corner, r);
    shape.absarc(-CLOCK_RUN, 0, r, Math.PI / 2, Math.PI * 1.5, false);
    return shape;
  };
  // A rounded capsule plate from z0 to z1 (its bevel inside those bounds), with an optional
  // capsule hole (the bevel rounds the hole's lip too)
  const capsulePlate = (r, z0, z1, bevel, hole = 0, outline = capsuleShape) => {
    const shape = outline(r - bevel);
    if (hole) shape.holes.push(capsuleShape(hole + bevel));
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: z1 - z0 - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 24,
    });
    return geo.translate(0, 0, z0 + bevel);
  };
  // The same, shaded smooth: an extrusion comes with a flat normal per facet, and in the toon
  // ramp a narrow facet where a side turns into a curve drops into the dark band as a thin line
  const smoothPlate = (...args) => {
    const flat = capsulePlate(...args);
    flat.deleteAttribute("uv");
    flat.deleteAttribute("normal");
    const smooth = mergeVertices(flat, 1e-4);
    smooth.computeVertexNormals();
    flat.dispose();
    // Each face and its bezel lip keep the full colour; the sides (and the dial recess's inner
    // walls) take a shade darker, so the faces stand proud of the case without a drawn line
    const normals = smooth.attributes.normal;
    const shade = new Float32Array(normals.count * 3);
    for (let i = 0; i < normals.count; i++) {
      const v = THREE.MathUtils.lerp(0.78, 1, THREE.MathUtils.smoothstep(Math.abs(normals.getZ(i)), 0.3, 0.85));
      shade.fill(v, i * 3, i * 3 + 3);
    }
    smooth.setAttribute("color", new THREE.BufferAttribute(shade, 3));
    return smooth;
  };
  const clockCaseMat = runtime.core.toon("#2149c6");
  // The shell's own (its faces and sides shaded apart by vertex colour, see smoothPlate)
  const clockShellMat = runtime.core.toon("#2149c6");
  clockShellMat.vertexColors = true;
  const clockHandMat = runtime.core.toon("#2149c6");
  const clockCapMat = runtime.core.toon("#d4a72c");
  // One dial print serves both faces
  const DIAL_W = 2 * (CLOCK_RUN + DIAL_R);
  const DIAL_H = 2 * DIAL_R;
  const dial = canvasTexture(Math.round(DIAL_W * 400), Math.round(DIAL_H * 400));
  runtime.core.track(dial.texture);
  drawClockFace(dial.ctx, Math.round(DIAL_W * 400), Math.round(DIAL_H * 400));
  // A shape's UVs are its own coordinates: stretched here over the dial's canvas
  const dialGeo = runtime.core.track(new THREE.ShapeGeometry(capsuleShape(DIAL_R), 24));
  const dialUv = dialGeo.attributes.uv;
  for (let i = 0; i < dialUv.count; i++) dialUv.setXY(i, dialUv.getX(i) / DIAL_W + 0.5, dialUv.getY(i) / DIAL_H + 0.5);
  const dialMat = runtime.core.printMaterial(dial.texture);
  // One face and its hands, from the case's middle (z = 0) out: the dial sits 0.075 back
  // inside the bezel's lip. The back face is the same turned round.
  function clockHalf() {
    const half = new THREE.Group();
    const face = new THREE.Mesh(dialGeo, dialMat);
    face.position.z = 0.135;
    // (the room's light shades the dial, as it does the other prints)
    face.receiveShadow = true;
    // Chunky round-ended hands, flattened, the hour hand the broader. Each sits in its own
    // layer clear of the dial and of the other (they'd cut through each other and flicker
    // where they cross), and they take no shadow: the case's would speckle them at a slant.
    // Nor are they inked: from across the room a hand is a few pixels wide, and the outline's
    // least width would double it as a dark ghost to one side; blue on cream reads on its own.
    const hourHand = new THREE.Group();
    const minuteHand = new THREE.Group();
    [[hourHand, 0.3, 0.045, 0.152], [minuteHand, 0.48, 0.034, 0.178]].forEach(([pivot, length, radius, z]) => {
      const hand = runtime.core.mesh(new THREE.CapsuleGeometry(radius, length, 4, 10).scale(1, 1, 0.25), clockHandMat, { cast: false, outline: 0 });
      hand.receiveShadow = false;
      hand.position.y = length / 2;
      pivot.position.z = z;
      pivot.add(hand);
    });
    // A small brass cap over the pivot
    const cap = runtime.core.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 16), clockCapMat, { outline: 0, cast: false });
    cap.rotation.x = Math.PI / 2;
    cap.receiveShadow = false;
    cap.position.z = 0.198;
    half.add(face, hourHand, minuteHand, cap);
    return { half, hourHand, minuteHand };
  }
  const front = clockHalf();
  const back = clockHalf();
  back.half.rotation.y = Math.PI;
  // The case: one plain shell 2 × 0.21 thick, open at both faces, with a solid core behind
  // the dials. Its outline is drawn round a solid plate: the openings' own walls, facing in,
  // would push ink in over the dials.
  const clockRim = new THREE.Group();
  clockRim.add(
    runtime.core.mesh(smoothPlate(CASE_R, -0.21, 0.21, 0.05, DIAL_R, caseShape), clockShellMat, { outline: 0.018, hull: capsulePlate(CASE_R, -0.21, 0.21, 0.05, 0, caseShape) }),
    runtime.core.mesh(capsulePlate(0.7, -0.13, 0.13, 0.01), clockCaseMat, { outline: 0, cast: false }),
    front.half,
    back.half,
  );
  // The case stands out from the wall, its faces turned to either side (one towards the
  // room's right, the other the window's way): turned a quarter round y, its length runs out
  // from the wall
  clockRim.rotation.y = Math.PI / 2;
  // (its square end flat on the wall, at z = -0.05)
  clockRim.position.z = -0.05 + CLOCK_RUN + CASE_R + CLOCK_NECK;
  clock.add(clockRim);
  const hourHand = front.hourHand;
  const minuteHand = front.minuteHand;
  // The back face's hands follow the front's (each face turns its own hands clockwise)
  const syncBackHands = () => {
    back.hourHand.rotation.z = hourHand.rotation.z;
    back.minuteHand.rotation.z = minuteHand.rotation.z;
  };
  let clockCoat = DEVICE_FINISHES.clock.finishes[DEVICE_FINISHES.clock.default];
  function setClockFinish(finish) {
    if (!Object.hasOwn(DEVICE_FINISHES.clock.finishes, finish)) return;
    clockCoat = DEVICE_FINISHES.clock.finishes[finish];
    clockCaseMat.color.set(clockCoat.shell);
    clockShellMat.color.set(clockCoat.shell);
    clockHandMat.color.set(clockCoat.hands);
  }
  setClockFinish(runtime.options.deviceFinishes?.clock || DEVICE_FINISHES.clock.default);
  const updateRoomClock = () => {
    const now = new Date();
    minuteHand.rotation.z = -(now.getMinutes() / 60) * Math.PI * 2;
    hourHand.rotation.z = -((now.getHours() % 12 + now.getMinutes() / 60) / 12) * Math.PI * 2;
    syncBackHands();
  };
  updateRoomClock();
  // Click the clock: its hands whirl round twice, it rocks on its mount, then strikes the hour
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
      gsap.to(minuteHand.rotation, { z: minuteHand.rotation.z - Math.PI * 4, duration: 1.4, ease: "power2.inOut", onUpdate: syncBackHands });
      gsap.to(hourHand.rotation, {
        z: hourHand.rotation.z - Math.PI * 2, duration: 1.4, ease: "power2.inOut", onUpdate: syncBackHands,
        onComplete: () => {
          updateRoomClock();
          gsap.fromTo(clockMount.rotation, { z: 0.14 }, { z: 0, duration: 1.4, ease: "elastic.out(1, 0.2)", overwrite: true, onComplete: () => (clockBusy = false) });
          gsap.fromTo(clock.scale, { x: CLOCK_SCALE * 1.1, y: CLOCK_SCALE * 1.1, z: CLOCK_SCALE * 1.1 }, { x: CLOCK_SCALE, y: CLOCK_SCALE, z: CLOCK_SCALE, duration: 0.5, ease: "back.out(3)" });
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
    // the case's colour first, for the dust it leaves when it's snapped away
    clockColours: () => [clockCoat.shell, "#fffdf5", "#1a1714"],
    setClockFinish,
    updateRoomClock,
  };
}
