import * as THREE from "three";
import gsap from "gsap";
import { hoverSound, sfx } from "@/shared/composables/useSfx";
import { ABOUT_NOTES } from "@/data/about";
import { drawAboutBoard, drawAboutNote } from "../textures";

export function createAboutBoard(runtime) {
  // ---------- pinned About board, matching the 2D sticker board ----------
  const aboutBoard = new THREE.Group();
  // Well to the right of the shelf, its bottom edge level with the painting's, with the badge still hanging from its corner
  aboutBoard.position.set(19.3, 10.24, runtime.room.WALL_Z + 0.3); // on the wall: WALL_Z + 0.3
  // 20% larger than its 6.8 × 4.2 build, so the notes read from the overview
  const BOARD_SCALE = 1.2;
  aboutBoard.scale.set(BOARD_SCALE, BOARD_SCALE, 1);
  // Kept out of the scene, not just invisible, while hidden, so its notes can't be hovered or
  // clicked
  const SHOW_BOARD = true;
  if (SHOW_BOARD) runtime.core.scene.add(aboutBoard);
  const boardWood = runtime.core.toon("#b98550");
  boardWood.map = runtime.room.windowWood.texture;
  const boardFrame = runtime.core.mesh(runtime.core.rbox(6.8, 4.2, 0.16, 0.04), boardWood, { outline: 0.025 });
  const boardFace = runtime.core.printed(6.55, 3.95, 170, drawAboutBoard);
  boardFace.position.z = 0.09;
  aboutBoard.add(boardFrame, boardFace);
  // Raised oak rails with grain following their length, around a recessed cork face.
  const boardUprightGrain = runtime.core.track(runtime.room.windowWood.texture.clone());
  boardUprightGrain.center.set(0.5, 0.5);
  boardUprightGrain.rotation = Math.PI / 2;
  boardUprightGrain.needsUpdate = true;
  const boardUprightWood = runtime.core.toon("#aa7745");
  boardUprightWood.map = boardUprightGrain;
  const boardInnerWood = runtime.core.toon("#795333");
  boardInnerWood.map = runtime.room.windowWood.texture;
  [-1, 1].forEach((side) => {
    [[6.8, 0.14, 0, side * 2.03, boardWood], [0.14, 3.92, side * 3.33, 0, boardUprightWood],
      [6.52, 0.025, 0, side * 1.965, boardInnerWood], [0.025, 3.91, side * 3.265, 0, boardInnerWood]].forEach(([w, h, x, y, material]) => {
      const rail = runtime.core.mesh(runtime.core.rbox(w, h, 0.1, 0.012), material, { outline: 0 });
      rail.position.set(x, y, 0.085);
      aboutBoard.add(rail);
    });
  });
  // Fine mitre joints and inset corner pins break up the otherwise continuous frame.
  const boardJointMat = runtime.core.toon("#67452f");
  const boardPinGeo = runtime.core.track(new THREE.SphereGeometry(0.018, 8, 6));
  const boardPinMat = runtime.core.toon("#a6a39a");
  for (const x of [-1, 1]) for (const y of [-1, 1]) {
    const joint = runtime.core.mesh(new THREE.BoxGeometry(0.18, 0.008, 0.005), boardJointMat, { outline: 0, cast: false });
    joint.position.set(x * 3.33, y * 2.03, 0.138);
    joint.rotation.z = x * y * Math.PI / 4;
    const pin = new THREE.Mesh(boardPinGeo, boardPinMat);
    pin.position.set(x * 3.31, y * 2.01, 0.14);
    aboutBoard.add(joint, pin);
  }
  const noteLayout = {
    who: [-1.95, 0.5, 2.35, 1.85],
    years: [-0.1, 0.9, 0.9, 1.0],
    projects: [1.1, 0.9, 0.9, 1.0],
    companies: [2.35, 0.9, 1.0, 1.0],
    stack: [1.9, -0.85, 2.35, 1.9],
    now: [-1.95, -1.48, 2.35, 0.8],
    location: [-0.02, -0.75, 1.0, 1.1],
    resume: [-1.95, -0.8, 2.35, 0.3],
  };
  // Papers are printed smaller than their layout slot, leaving room on the board to move them
  const NOTE_SCALE = 0.78;
  const pinGeo = new THREE.SphereGeometry(0.06, 12, 8);
  let noteDrag = null;
  let noteLayer = 0;
  // Paper isn't rigid: pinned at the top, each sheet bows a touch and one bottom corner curls
  // up off the cork. Both the backing and the print are bent the same way.
  const curlPaper = (geo, w, h, curl, side) => {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / (w / 2);
      const y = pos.getY(i) / (h / 2);
      const k = Math.max(0, (side * x - y - 1.05) / 0.95);
      const bow = 0.012 * (1 - x * x) * (1 - y) * 0.5;
      pos.setZ(i, pos.getZ(i) + curl * k * k + bow);
    }
    geo.computeVertexNormals();
    return geo;
  };
  const TAPED = { resume: [-1, 1], location: [1, -1] };
  const boardNotes = ABOUT_NOTES.map((note, n) => {
    const [x, y, slotW, slotH] = noteLayout[note.id];
    const w = slotW * NOTE_SCALE;
    const h = slotH * NOTE_SCALE;
    const paper = new THREE.Group();
    paper.position.set(x, y, 0.15);
    paper.rotation.z = -THREE.MathUtils.clamp(note.rotate, -4, 4) * Math.PI / 180;
    const curl = note.id === "resume" ? 0 : 0.05 + (n % 3) * 0.02;
    const side = n % 2 ? -1 : 1;
    const pinY = h / 2 - Math.min(0.1, h * 0.15);
    const sheet = new THREE.Group();
    sheet.position.y = pinY;
    paper.add(sheet);
    const backing = runtime.core.mesh(curlPaper(new THREE.BoxGeometry(w, h, 0.025, 10, 10, 1), w, h, curl, side), runtime.core.toon("#fffdf5"), { outline: 0.01 });
    // Same canvas as a full-size paper, so the print keeps its layout and sharpness
    const face = runtime.core.printed(w, h, 230 / NOTE_SCALE, (c, pw, ph) => drawAboutNote(c, pw, ph, note));
    face.geometry.dispose();
    face.geometry = runtime.core.track(curlPaper(new THREE.PlaneGeometry(w, h, 10, 10), w, h, curl, side));
    backing.position.y = -pinY;
    face.position.set(0, -pinY, 0.014);
    sheet.add(backing, face);
    // A strip of washi tape over a corner on a couple of them, as well as the pin
    if (TAPED[note.id]) {
      const [tx, ty] = TAPED[note.id];
      // laid on the paper and bent with it, so a curled corner can't poke up through the tape
      const tapeGeo = new THREE.PlaneGeometry(0.36, 0.1, 12, 2)
        .rotateZ(tx * ty * 0.75)
        .translate(tx * (w / 2 - 0.04), ty * (h / 2 - 0.03), 0.03);
      // (paper itself, so it settles into the room's light with the note under it)
      const tape = new THREE.Mesh(runtime.core.track(curlPaper(tapeGeo, w, h, curl, side)), runtime.core.printMaterial(null, { transparent: true, opacity: 0.85 }, note.id === "resume" ? "#00e0c6" : "#ff90e8"));
      tape.position.y = -pinY;
      tape.receiveShadow = true;
      sheet.add(tape);
    }
    const pin = new THREE.Group();
    pin.position.set(0, pinY, 0.09);
    const head = runtime.core.mesh(pinGeo, runtime.core.toon(note.pin), { outline: 0.012 });
    const highlight = new THREE.Mesh(runtime.core.track(new THREE.SphereGeometry(0.018, 8, 6)), runtime.core.track(new THREE.MeshBasicMaterial({ color: "#fff" })));
    highlight.position.set(-0.022, 0.023, 0.044);
    const needle = runtime.core.mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.24, 8), runtime.core.toon("#9ca3af"), { outline: 0, cast: false });
    needle.rotation.x = Math.PI / 2;
    needle.position.z = -0.13;
    pin.add(head, needle, highlight);
    const ring = new THREE.Mesh(runtime.core.track(new THREE.RingGeometry(0.072, 0.084, 24)), runtime.core.track(new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0, depthWrite: false })));
    ring.position.set(0, pinY, 0.028);
    const pinShadow = new THREE.Mesh(runtime.core.track(new THREE.CircleGeometry(0.075, 20)), runtime.core.track(new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.3, depthWrite: false })));
    pinShadow.position.set(0.025, pinY - 0.035, 0.025);
    pinShadow.scale.y = 0.65;
    const shadow = new THREE.Mesh(runtime.core.track(new THREE.PlaneGeometry(w, h)), runtime.core.track(new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.32, depthWrite: false })));
    shadow.position.set(x + 0.04, y - 0.04, 0.115);
    shadow.rotation.z = paper.rotation.z;
    paper.add(pinShadow, pin, ring);
    aboutBoard.add(shadow, paper);
    return { paper, sheet, shadow, pin, pinShadow, head, highlight, ring, w, h, href: note.href, angle: paper.rotation.z };
  });
  // The badge swinging over the board clears each paper's face, its pin and however far a
  // hover has tipped the sheet out from the cork, with a margin for the swing's speed
  runtime.badge.badgeClearance = (x, y, angle) => {
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    const cardX = x + 0.74 * Math.sin(angle);
    const cardY = y - 0.74 * Math.cos(angle);
    const halfX = 0.43 * cos + 0.67 * sin + 0.2;
    const halfY = 0.43 * sin + 0.67 * cos + 0.2;
    let z = -Infinity;
    boardNotes.forEach(({ paper, sheet, w, h }) => {
      const noteX = (w * Math.cos(paper.rotation.z) + h * Math.abs(Math.sin(paper.rotation.z))) / 2 * paper.scale.x;
      const noteY = (h * Math.cos(paper.rotation.z) + w * Math.abs(Math.sin(paper.rotation.z))) / 2 * paper.scale.y;
      if (Math.abs(aboutBoard.position.x + paper.position.x - cardX) > halfX + noteX) return;
      if (Math.abs(aboutBoard.position.y + paper.position.y - cardY) > halfY + noteY) return;
      const tipped = Math.sin(Math.max(0, -sheet.rotation.x)) * h;
      z = Math.max(z, aboutBoard.position.z + paper.position.z + Math.max(0.17, 0.12 + tipped));
    });
    // The holder's half depth and a little air
    return z + 0.1;
  };
  const boardPinGlints = [];
  // Spare push pins left stuck in the cork
  [[-3.0, -1.55, "#00e0c6"], [0.6, 1.45, "#ffdd00"], [3.02, 0.25, "#ff6b6b"], [-0.6, 1.55, "#7fb2ff"]].forEach(([x, y, color], i) => {
    const spare = runtime.core.mesh(pinGeo, runtime.core.toon(color), { outline: 0.012 });
    spare.position.set(x, y, 0.13);
    spare.scale.setScalar(0.85);
    const glint = new THREE.Mesh(runtime.core.track(new THREE.SphereGeometry(0.018, 8, 6)), runtime.core.track(new THREE.MeshBasicMaterial({ color: "#fff", transparent: true, opacity: 0.35 })));
    glint.position.set(-0.022, 0.023, 0.044);
    glint.raycast = runtime.core.noRaycast;
    spare.add(glint);
    boardPinGlints.push(glint);
    const stem = runtime.core.mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.08, 8), runtime.core.toon("#9ca3af"), { outline: 0, cast: false });
    stem.rotation.set(Math.PI / 2 + (i % 2 ? 0.4 : -0.3), 0, 0.3);
    stem.position.set(x, y, 0.1);
    aboutBoard.add(stem, spare);
  });
  function clampNote(note, x, y) {
    // Leave room for the resting tilt and the lifted scale at every board edge.
    const angle = Math.max(Math.abs(note.angle), 0.035);
    const halfW = (note.w * Math.cos(angle) + note.h * Math.sin(angle)) * 0.53;
    const halfH = (note.h * Math.cos(angle) + note.w * Math.sin(angle)) * 0.53;
    return {
      x: THREE.MathUtils.clamp(x, -3.235 + halfW, 3.235 - halfW),
      y: THREE.MathUtils.clamp(y, -1.935 + halfH, 1.935 - halfH),
    };
  }
  function notesOverlap(a, b) {
    const extent = (note) => ({
      x: (note.w * Math.cos(note.angle) + note.h * Math.abs(Math.sin(note.angle))) / 2 + 0.02,
      y: (note.h * Math.cos(note.angle) + note.w * Math.abs(Math.sin(note.angle))) / 2 + 0.02,
    });
    const aa = extent(a);
    const bb = extent(b);
    return Math.abs(a.paper.position.x - b.paper.position.x) < aa.x + bb.x &&
      Math.abs(a.paper.position.y - b.paper.position.y) < aa.y + bb.y;
  }
  function liftNote(note) {
    // Drag takes over the sheet and shadow, while its pin is pulled out separately.
    gsap.killTweensOf([note.sheet.rotation, note.shadow.material, note.highlight.scale]);
    note.sheet.rotation.set(0, 0, 0);
    note.shadow.material.opacity = 0.32;
    note.highlight.scale.setScalar(1);
    gsap.killTweensOf([note.paper.position, note.paper.rotation, note.paper.scale, note.pin.position, note.pin.rotation, note.head.scale, note.shadow.position, note.shadow.rotation, note.shadow.scale, note.pinShadow.position, note.pinShadow.material, note.ring.scale, note.ring.material]);
    note.ring.material.opacity = 0;
    note.layer = ++noteLayer;
    [...boardNotes].sort((a, b) => (a.layer || 0) - (b.layer || 0)).forEach((entry, i) => {
      entry.restZ = 0.15 + i * 0.006;
      if (entry !== note) gsap.to(entry.paper.position, { z: entry.restZ, duration: 0.15 });
    });
    gsap.to(note.paper.position, { z: note.restZ + 0.12, duration: 0.2 });
    gsap.to(note.paper.scale, { x: 1.04, y: 1.04, duration: 0.2 });
    gsap.to(note.paper.rotation, { z: 0, duration: 0.2 });
    gsap.to(note.shadow.position, { x: note.paper.position.x + 0.1, y: note.paper.position.y - 0.1, duration: 0.2 });
    gsap.to(note.shadow.scale, { x: 1.04, y: 1.04, duration: 0.2 });
    gsap.to(note.shadow.rotation, { z: 0, duration: 0.2 });
    gsap.to(note.pin.position, { x: 0.07, y: note.h / 2 + 0.09, z: 0.4, duration: 0.25, ease: "back.out(2.5)" });
    gsap.to(note.pin.rotation, { z: -0.45, duration: 0.25 });
    gsap.to(note.pinShadow.position, { x: 0.13, y: note.h / 2 - 0.23, duration: 0.25 });
    gsap.to(note.pinShadow.material, { opacity: 0.12, duration: 0.25 });
    sfx.pop({ pitch: 1.4 });
  }
  function pinNote(note, sound = true, position = note.paper.position) {
    const { x, y } = position;
    gsap.to(note.paper.position, { x, y, z: note.restZ ?? 0.15, duration: 0.3, ease: "power2.out" });
    gsap.to(note.paper.scale, { x: 1, y: 1, duration: 0.3, ease: "back.out(3)" });
    gsap.to(note.paper.rotation, { z: note.angle, duration: 0.35, ease: "back.out(2)" });
    gsap.to(note.shadow.position, { x: x + 0.04, y: y - 0.04, duration: 0.3 });
    gsap.to(note.shadow.scale, { x: 1, y: 1, duration: 0.3 });
    gsap.to(note.shadow.rotation, { z: note.angle, duration: 0.35 });
    gsap.to(note.pin.position, { x: 0, y: note.h / 2 - Math.min(0.1, note.h * 0.15), z: 0.09, delay: 0.12, duration: 0.22, ease: "power4.in" });
    gsap.to(note.pin.rotation, { z: 0, delay: 0.12, duration: 0.22 });
    gsap.to(note.pinShadow.position, { x: 0.025, y: note.h / 2 - Math.min(0.1, note.h * 0.15) - 0.035, delay: 0.12, duration: 0.22 });
    gsap.to(note.pinShadow.material, { opacity: 0.3, delay: 0.12, duration: 0.22 });
    gsap.fromTo(note.head.scale, { x: 1.25, y: 0.75 }, { x: 1, y: 1, delay: 0.34, duration: 0.4, ease: "elastic.out(1.2, 0.4)" });
    gsap.fromTo(note.ring.scale, { x: 0.4, y: 0.4 }, { x: 1.8, y: 1.8, delay: 0.34, duration: 0.4 });
    gsap.fromTo(note.ring.material, { opacity: 0.65 }, { opacity: 0, delay: 0.34, duration: 0.4 });
    if (sound) sfx.tick({ pitch: 0.55, delay: 0.32 });
  }
  boardNotes.forEach((note) => runtime.core.register(note.paper, {
    focus: "about", item: true, note,
    onHover: (on) => {
      if (noteDrag || (on && gsap.isTweening(note.pin.position))) return;
      runtime.core.renderer.domElement.style.cursor = on ? "grab" : "default";
      gsap.to(note.sheet.rotation, { x: on ? -0.24 : 0, z: on ? 0.035 : 0, duration: on ? 0.3 : 0.5, ease: on ? "back.out(1.6)" : "power2.out", overwrite: true });
      gsap.to(note.shadow.scale, { x: on ? 1.08 : 1, y: on ? 1.08 : 1, duration: 0.3, overwrite: true });
      gsap.to(note.shadow.material, { opacity: on ? 0.22 : 0.32, duration: 0.3, overwrite: true });
      gsap.to(note.highlight.scale, { x: on ? 1.5 : 1, y: on ? 1.5 : 1, duration: 0.25, overwrite: true });
      if (on) hoverSound(note.paper, (s) => s.rustle({ duration: 0.12 }));
    },
  }));
  let boardIntroduced = false;
  runtime.core.register(aboutBoard, {
    focus: "about",
    // The pins glint; each paper answers only its own hover, so the cork leaves them alone
    onHover: (on) => boardPinGlints.forEach((glint) => gsap.to(glint.material, { opacity: on ? 1 : 0.35, duration: 0.3, overwrite: true })),
    onArrive: () => {
      if (boardIntroduced) return;
      boardIntroduced = true;
      boardNotes.forEach((note, i) => {
        if (noteDrag?.note === note) return;
        gsap.fromTo(note.paper.scale, { x: 0.88, y: 0.88 }, { x: 1, y: 1, duration: 0.4, delay: i * 0.06, ease: "back.out(2)" });
        gsap.fromTo(note.pin.position, { z: 0.5 }, { z: 0.09, duration: 0.3, delay: i * 0.06 + 0.15, ease: "bounce.out" });
        runtime.core.timers.push(setTimeout(() => sfx.tick({ pitch: 0.55 }), (i * 0.06 + 0.4) * 1000));
      });
    },
    onLeave: () => runtime.pointer.finishNoteDrag(),
  });

  // Public state used by the other scene parts.
  return {
    shown: SHOW_BOARD,
    get noteDrag() { return noteDrag; },
    set noteDrag(value) { noteDrag = value; },
    clampNote,
    liftNote,
    aboutBoard,
    boardNotes,
    notesOverlap,
    pinNote,
    boardPinGlints,
  };
}
