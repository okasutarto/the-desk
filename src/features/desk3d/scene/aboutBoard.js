import * as THREE from "three";
import gsap from "gsap";
import { hoverSound, sfx } from "@/shared/composables/useSfx";
import { getNotes, postNote } from "@/shared/services/guestbookApi";
import { drawAboutBoard, drawGuestPaper, composerIndexAt, GUEST_NAME_MAX, GUEST_MESSAGE_MAX, GUEST_PAPERS } from "../textures";

export function createAboutBoard(runtime) {
  // ---------- the guestbook: the cork board where visitors pin a note for everyone ----------
  // (It was the About board, and keeps its name and its "about" shot in the code: the 2D page
  // still has the About section, and key 2 and the section links still lead here.)
  const aboutBoard = new THREE.Group();
  // Well to the right of the shelf, its bottom edge level with the painting's, with the badge still hanging from its corner
  aboutBoard.position.set(19.3, 10.24, runtime.room.WALL_Z + 0.3); // on the wall: WALL_Z + 0.3
  // 20% larger than its 6.8 × 4.2 build, so the papers read from the overview
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
  // The guestbook's papers: twelve slots in a grid under the heading. The top left one is a pad
  // of blank sheets to write on, the bottom right the tab for older notes, and the other ten
  // hold a page of visitors' notes, newest first. The badge hangs down the board's left edge,
  // so the notes fill the left column last. A slot with nothing to show is taken off.
  const COLS = [-2.4, -0.8, 0.8, 2.4];
  const ROWS = [0.9, -0.2, -1.3];
  const SLOT_W = 1.4;
  const SLOT_H = 0.95;
  const COMPOSE = 0;
  const PAGER = COLS.length * ROWS.length - 1;
  const NOTE_SLOTS = [1, 2, 3, 5, 6, 7, 9, 10, 4, 8];
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
  // what each slot shows (see drawGuestPaper)
  const slots = [];
  const PIN_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#d946ef", "#14b8a6"];
  // The pad sits a little in from the board's left edge, clear of the badge's lanyard
  const PAD_NUDGE = 0.12;
  const boardNotes = ROWS.flatMap((y) => COLS.map((x) => [x, y])).map(([gx, y], n) => {
    const x = n === COMPOSE ? gx + PAD_NUDGE : gx;
    const w = SLOT_W;
    const h = SLOT_H;
    const paper = new THREE.Group();
    paper.position.set(x, y, 0.15);
    // the pad's top sheet curls a little more: held up large, it reads as paper, not a board
    const curl = n === COMPOSE ? 0.07 : 0.05 + (n % 3) * 0.02;
    const side = n % 2 ? -1 : 1;
    const pinY = h / 2 - Math.min(0.1, h * 0.15);
    const sheet = new THREE.Group();
    sheet.position.y = pinY;
    paper.add(sheet);
    const backing = runtime.core.mesh(curlPaper(new THREE.BoxGeometry(w, h, 0.025, 10, 10, 1), w, h, curl, side), runtime.core.toon("#fffdf5"), { outline: 0.01 });
    // the card to write on is held up large, so it's printed sharper
    const face = runtime.core.printed(w, h, n === COMPOSE ? 640 : 300, (c, pw, ph) => drawGuestPaper(c, pw, ph, slots[n]));
    face.geometry.dispose();
    face.geometry = runtime.core.track(curlPaper(new THREE.PlaneGeometry(w, h, 10, 10), w, h, curl, side));
    backing.position.y = -pinY;
    face.position.set(0, -pinY, 0.014);
    sheet.add(backing, face);
    const pin = new THREE.Group();
    pin.position.set(0, pinY, 0.09);
    const headMat = runtime.core.toon(n === COMPOSE ? "#ef4444" : PIN_COLORS[n % PIN_COLORS.length]);
    const head = runtime.core.mesh(pinGeo, headMat, { outline: 0.012 });
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
    paper.add(pinShadow, pin, ring);
    // the pad's top sheet is stuck down, not pinned, and the pad casts its shadow
    let liftShadow = null;
    if (n === COMPOSE) {
      pin.visible = false;
      pinShadow.visible = false;
      shadow.visible = false;
      // held up, it casts a soft shadow of its own back onto the board behind it
      liftShadow = new THREE.Mesh(runtime.core.track(new THREE.PlaneGeometry(w * 1.02, h * 1.02)), runtime.core.track(new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0, depthWrite: false })));
      liftShadow.position.set(0.05, -pinY - 0.07, -0.12);
      liftShadow.raycast = runtime.core.noRaycast;
      sheet.add(liftShadow);
    }
    return { slot: n, home: { x, y }, paper, sheet, backing, shadow, liftShadow, face, pin, pinShadow, head, highlight, ring, w, h, pinY, angle: 0, shown: false };
  });
  // The pad itself: a few loose sheets of the other papers under the top one, each a touch
  // askew, on a shadow of its own
  const PAD_ANGLE = -0.03;
  const pad = new THREE.Group();
  pad.position.set(COLS[0] + PAD_NUDGE, ROWS[0], 0);
  pad.rotation.z = PAD_ANGLE;
  [[0.04, -0.045, 0.07, 0.05, 2], [-0.035, -0.02, 0.095, -0.04, 4], [0.02, 0.03, 0.12, 0.025, 1]].forEach(([dx, dy, z, turn, paperIndex]) => {
    const loose = runtime.core.mesh(new THREE.BoxGeometry(SLOT_W, SLOT_H, 0.02), runtime.core.toon(GUEST_PAPERS[paperIndex]), { outline: 0.01 });
    loose.position.set(dx, dy, z);
    loose.rotation.z = turn;
    pad.add(loose);
  });
  const padShadow = new THREE.Mesh(runtime.core.track(new THREE.PlaneGeometry(SLOT_W + 0.08, SLOT_H + 0.08)), runtime.core.track(new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.3, depthWrite: false })));
  padShadow.position.set(0.05, -0.06, 0.03);
  pad.add(padShadow);
  aboutBoard.add(pad);
  // A paper on the board, or off it; laid back at its own place in the grid when it comes back
  function showPaper(note, on) {
    if (on === note.shown) return;
    note.shown = on;
    if (on) {
      gsap.killTweensOf([note.paper.position, note.paper.rotation, note.paper.scale, note.shadow.position, note.shadow.rotation]);
      note.paper.position.set(note.home.x, note.home.y, note.restZ ?? 0.15);
      note.paper.rotation.z = note.angle;
      note.paper.scale.setScalar(1);
      note.shadow.position.set(note.home.x + 0.04, note.home.y - 0.04, 0.115);
      note.shadow.rotation.z = note.angle;
      note.shadow.scale.setScalar(1);
      aboutBoard.add(note.shadow, note.paper);
    } else aboutBoard.remove(note.shadow, note.paper);
  }
  // A visitor's note sits at its own small tilt, the same for everyone who looks
  const tiltOf = (id) => ((([...String(id)].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 997, 7) % 7) - 3) * Math.PI) / 180;

  // ---------- the notes, from the guestbook API ----------
  const NAME_KEY = "guestbook-name";
  const savedName = (() => {
    try {
      return (localStorage.getItem(NAME_KEY) || "").slice(0, GUEST_NAME_MAX);
    } catch {
      return "";
    }
  })();
  // the card being written: "idle", "typing", "sending", "refused" or "posted". It's on the
  // paper the note will be pinned up on, picked afresh for each note.
  const freshPaper = () => Math.floor(Math.random() * GUEST_PAPERS.length);
  const compose = { state: "idle", field: "name", name: savedName, message: "", reason: null, scope: null, caret: false, paper: freshPaper() };
  // the page shown: its notes, whether older ones follow, and where each page starts
  const book = { state: "idle", notes: [], more: false, page: 1, starts: [null] };
  let loading = 0;

  // the pad's top sheet on its way to the board as a note: { note }
  let flight = null;
  // Where each note on this page is pinned (id → slot). A note stays where it was pinned: a new
  // one takes the next free place, or, with the page full, the place of the note that's gone
  // over to the next page. A fresh page is laid out newest first.
  let placed = new Map();
  function assignSlots(notes) {
    const next = new Map();
    const taken = new Set();
    notes.forEach((note) => {
      const slot = placed.get(note.id);
      if (slot !== undefined) {
        next.set(note.id, slot);
        taken.add(slot);
      }
    });
    const free = NOTE_SLOTS.filter((slot) => !taken.has(slot));
    notes.forEach((note) => {
      if (!next.has(note.id) && free.length) next.set(note.id, free.shift());
    });
    return next;
  }
  function lay() {
    slots.length = 0;
    slots[COMPOSE] = flight ? { kind: "note", note: flight.note } : { kind: "compose", compose };
    const placeholder = {
      idle: "Fetching the notes...",
      loading: "Fetching the notes...",
      offline: "The guestbook is out of reach right now. Try again in a bit.",
      ready: book.notes.length ? null : "No notes yet. Be the first to sign the book!",
    }[book.state];
    const notes = book.notes.slice(0, NOTE_SLOTS.length);
    placed = assignSlots(notes);
    notes.forEach((note) => { slots[placed.get(note.id)] = { kind: "note", note }; });
    if (placeholder) slots[NOTE_SLOTS[0]] = { kind: "placeholder", text: placeholder };
    if (book.state === "ready" && (book.more || book.page > 1)) slots[PAGER] = { kind: "pager", pager: { more: book.more, page: book.page } };
    boardNotes.forEach((note) => {
      const slot = slots[note.slot];
      note.angle = note.slot === COMPOSE ? PAD_ANGLE : slot?.kind === "note" ? tiltOf(slot.note.id) : 0.02;
      if (note.shown && slot && !noteDrag && !note.raised && !(note.slot === COMPOSE && flight)) gsap.to(note.paper.rotation, { z: note.angle, duration: 0.3 });
      showPaper(note, Boolean(slot));
      // a paper moved about, given something else to show, goes back to its place in the grid
      const content = slot?.note?.id ?? slot?.kind ?? null;
      if (note.shown && note.content !== undefined && note.content !== content && !note.raised && !(note.slot === COMPOSE && flight) && noteDrag?.note !== note) {
        gsap.to(note.paper.position, { x: note.home.x, y: note.home.y, duration: 0.3, ease: "power2.out" });
        gsap.to(note.shadow.position, { x: note.home.x + 0.04, y: note.home.y - 0.04, duration: 0.3, ease: "power2.out" });
      }
      note.content = content;
      note.kind = slot?.kind;
      if (slot) note.face.userData.tex.redraw();
    });
  }
  const redrawComposer = () => {
    const here = [nameField.id, messageField.id].includes(runtime.textInput.typing?.id);
    compose.caret = runtime.textInput.caretOn && here;
    // the caret and any stretch picked out, so a selection shows on the card
    compose.sel = here ? runtime.textInput.selection : null;
    boardNotes[COMPOSE].face.userData.tex.redraw();
  };

  async function loadPage(page) {
    const ticket = ++loading;
    if (book.state !== "ready") book.state = "loading";
    lay();
    const result = await getNotes(book.starts[page - 1]);
    if (ticket !== loading || runtime.core.destroyed) return;
    if (!result.ok) {
      // a page that won't come keeps what's shown, unless there's nothing at all
      if (!book.notes.length) book.state = "offline";
      return lay();
    }
    // another page: its notes laid out afresh
    if (page !== book.page) placed = new Map();
    Object.assign(book, { state: "ready", notes: result.notes || [], more: Boolean(result.more), page });
    if (book.more && result.next) book.starts[page] = result.next;
    lay();
  }
  const turnPage = () => {
    sfx.riffle({ count: 4, duration: 0.3 });
    loadPage(book.more ? book.page + 1 : 1);
  };

  // ---------- writing a note ----------
  const typingHere = () => [nameField.id, messageField.id].includes(runtime.textInput.typing?.id);
  const edited = () => {
    if (compose.state === "refused" || compose.state === "posted") Object.assign(compose, { state: "typing", reason: null });
  };
  const nameField = {
    id: "guestName",
    showsSelection: true,
    maxLength: GUEST_NAME_MAX,
    get: () => compose.name,
    set: (value) => {
      // what's on its way can't change under it
      if (compose.state === "sending") return;
      compose.name = value.replace(/\n/g, "").slice(0, GUEST_NAME_MAX);
      edited();
    },
    redraw: redrawComposer,
    // signed: pinned, unless there's no note yet
    onEnter: () => (compose.message.trim() ? post() : write("message")),
    onTab: () => write("message"),
    onStop: () => runtime.core.timers.push(setTimeout(settleComposer, 0)),
  };
  const messageField = {
    id: "guestMessage",
    showsSelection: true,
    maxLength: GUEST_MESSAGE_MAX,
    get: () => compose.message,
    set: (value) => {
      if (compose.state === "sending") return;
      compose.message = value.replace(/\n/g, " ").slice(0, GUEST_MESSAGE_MAX);
      edited();
    },
    redraw: redrawComposer,
    // the note written: on to the signature, or pinned if it's signed already
    onEnter: () => (compose.name.trim() ? post() : write("name")),
    onTab: () => write("name"),
    onStop: () => runtime.core.timers.push(setTimeout(settleComposer, 0)),
  };
  // Typing has stopped (Esc, a click elsewhere): unless it moved on to the card's other line,
  // the sheet goes back on the pad, the words kept on it for later
  function settleComposer() {
    redrawComposer();
    if (!typingHere() && boardNotes[COMPOSE].raised) backToPad();
  }

  // ---------- the sheet held up to write on ----------
  // Tapped, the pad's top sheet is peeled off and brought up to the middle of the view, large,
  // so what's typed is easy to read. Put aside, it goes back on the pad; pinned, it flies to
  // its place on the board, a pin drops into it, and the pad has a fresh sheet on top.
  // (held a little above the board's middle: the shot looks down at it, and a phone's
  // keyboard comes up from below)
  // (held a touch askew, as a hand holds a sheet)
  const RAISED = { x: 0, y: 0.3, z: 1.3, scale: 2.6, angle: -0.025 };
  const PAD_TOP = 0.15;
  const card = boardNotes[COMPOSE];
  card.tapOnly = true;
  const stopCard = () => {
    gsap.killTweensOf([card.paper.position, card.paper.rotation, card.paper.scale, card.sheet.rotation]);
  };
  // Held up, the sheet isn't stiff: its heavy outline (thickened 2.6 times by the lift) gives way
  // to a soft shadow, and it drifts a little, as paper in a hand does
  const outline = card.backing.children[0];
  function holdLoose(on) {
    gsap.killTweensOf([card.liftShadow.material, card.sheet.position]);
    if (outline) outline.visible = !on;
    gsap.to(card.liftShadow.material, { opacity: on ? 0.22 : 0, duration: on ? 0.4 : 0.15, delay: on ? 0.3 : 0 });
    if (!on) {
      card.sheet.position.y = card.pinY;
      return;
    }
    // a slow float, and a lean that comes and goes
    gsap.to(card.sheet.position, { y: card.pinY + 0.012, duration: 1.8, delay: 0.65, ease: "sine.inOut", yoyo: true, repeat: -1 });
    gsap.to(card.sheet.rotation, { x: -0.06, y: 0.05, duration: 2.6, delay: 0.65, ease: "sine.inOut", yoyo: true, repeat: -1 });
  }
  function peel() {
    stopCard();
    card.raised = true;
    // the loose corner lifts, the sheet comes away, then up it comes
    gsap.fromTo(card.sheet.rotation, { x: 0 }, { x: -0.55, duration: 0.14, ease: "power2.out" });
    gsap.to(card.sheet.rotation, { x: 0, delay: 0.16, duration: 0.35, ease: "power2.out" });
    gsap.to(card.paper.position, { x: card.home.x + 0.05, y: card.home.y + 0.08, z: 0.45, duration: 0.16, ease: "power2.out" });
    gsap.to(card.paper.position, { x: RAISED.x, y: RAISED.y, z: RAISED.z, delay: 0.14, duration: 0.5, ease: "power3.out" });
    gsap.to(card.paper.scale, { x: RAISED.scale, y: RAISED.scale, delay: 0.14, duration: 0.5, ease: "power3.out" });
    gsap.to(card.paper.rotation, { z: RAISED.angle, delay: 0.14, duration: 0.5, ease: "power2.out" });
    holdLoose(true);
    sfx.tear({ duration: 0.22 });
  }
  // Down onto a spot on the board, a little above it, then laid flat
  function settleOnto(x, y, angle, done) {
    holdLoose(false);
    gsap.to(card.sheet.rotation, { x: 0, y: 0, duration: 0.3, ease: "power2.out" });
    gsap.to(card.paper.scale, { x: 1, y: 1, duration: 0.5, ease: "power2.inOut" });
    gsap.to(card.paper.rotation, { z: angle, duration: 0.5, ease: "power2.inOut" });
    gsap.to(card.paper.position, {
      x, y, z: PAD_TOP + 0.25, duration: 0.5, ease: "power2.inOut",
      onComplete: () => gsap.to(card.paper.position, { z: PAD_TOP, duration: 0.12, ease: "power2.in", onComplete: done }),
    });
  }
  function backToPad() {
    stopCard();
    card.raised = false;
    settleOnto(card.home.x, card.home.y, PAD_ANGLE, () => {
      sfx.paper();
      gsap.fromTo(card.paper.scale, { x: 1.03, y: 1.03 }, { x: 1, y: 1, duration: 0.25, ease: "power2.out" });
    });
  }
  // A pin dropped into a paper from above: it falls, bites, the head squashes and the cork
  // ripples round it
  function dropPin(note, delay = 0) {
    gsap.killTweensOf([note.pin.position, note.pin.rotation, note.head.scale, note.ring.scale, note.ring.material, note.pinShadow.material]);
    note.pin.visible = true;
    note.pinShadow.visible = true;
    note.pin.position.set(0.06, note.pinY + 0.05, 0.8);
    note.pin.rotation.z = -0.35;
    note.pinShadow.material.opacity = 0;
    gsap.to(note.pin.position, { x: 0, y: note.pinY, z: 0.09, delay, duration: 0.28, ease: "power3.in" });
    gsap.to(note.pin.rotation, { z: 0, delay, duration: 0.28, ease: "power2.in" });
    gsap.to(note.pinShadow.material, { opacity: 0.3, delay, duration: 0.28 });
    const bite = delay + 0.28;
    gsap.fromTo(note.head.scale, { x: 1, y: 1 }, { x: 1.35, y: 0.7, delay: bite, duration: 0.06, ease: "power2.out" });
    gsap.to(note.head.scale, { x: 1, y: 1, delay: bite + 0.06, duration: 0.45, ease: "elastic.out(1.2, 0.4)" });
    gsap.fromTo(note.ring.scale, { x: 0.4, y: 0.4 }, { x: 1.9, y: 1.9, delay: bite, duration: 0.45, ease: "power2.out" });
    gsap.fromTo(note.ring.material, { opacity: 0.6 }, { opacity: 0, delay: bite, duration: 0.45 });
    sfx.tick({ pitch: 0.55, delay: bite });
  }
  // The written sheet, now a note, flown to its place at the top of the board and pinned
  function flyToBoard(note) {
    stopCard();
    card.raised = false;
    flight = { note };
    slots[COMPOSE] = { kind: "note", note };
    card.face.userData.tex.redraw();
    // the first page with this note at the top: where it'll be pinned, the others staying put
    if (book.page !== 1) placed = new Map();
    const notes = [note, ...(book.page === 1 ? book.notes.filter((one) => one.id !== note.id) : [])].slice(0, NOTE_SLOTS.length);
    const target = boardNotes[assignSlots(notes).get(note.id) ?? NOTE_SLOTS[0]];
    settleOnto(target.home.x, target.home.y, tiltOf(note.id), () => {
      sfx.paper();
      // the note takes its place, and the pad gets a fresh sheet on top
      flight = null;
      Object.assign(book, { state: "ready", page: 1, notes });
      lay();
      card.paper.position.set(card.home.x, card.home.y, PAD_TOP);
      card.paper.rotation.z = PAD_ANGLE;
      gsap.fromTo(card.paper.scale, { x: 0.94, y: 0.94 }, { x: 1, y: 1, duration: 0.3, ease: "back.out(2)" });
      dropPin(target);
      loadPage(1);
    });
  }
  // Start (or go on) writing, in one of the card's two lines
  function write(field = "message") {
    if (compose.state === "sending" || flight) return;
    if (compose.state === "idle" || compose.state === "posted") Object.assign(compose, { state: "typing", reason: null });
    if (!card.raised && !flight) peel();
    compose.field = field;
    runtime.textInput.startTyping(field === "name" ? nameField : messageField);
    redrawComposer();
  }
  async function post() {
    if (compose.state === "sending") return;
    const name = compose.name.trim();
    const message = compose.message.trim();
    if (!name || !message) {
      Object.assign(compose, { state: "refused", field: name ? "message" : "name", reason: "empty" });
      return write(compose.field);
    }
    compose.state = "sending";
    redrawComposer();
    const result = await postNote({ name, message, paper: compose.paper });
    if (runtime.core.destroyed) return;
    if (!result.ok) {
      Object.assign(compose, { state: "refused", reason: result.reason, scope: result.scope, field: result.field || compose.field });
      sfx.buzz();
      return write(compose.field);
    }
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      // the name is just asked for again next time
    }
    // the next sheet on the pad is on a paper of its own
    Object.assign(compose, { state: "posted", message: "", reason: null, paper: freshPaper() });
    // the sheet goes up as the note, then the board as the server has it
    flyToBoard(result.note);
    if (typingHere()) runtime.textInput.stopTyping();
  }
  // Tapped on the pad, the sheet comes up ready for the note (the name is signed at its foot).
  // Held up, it's written on like a text box: a press puts the caret by the letter under it (in
  // the note, or the name on the signature line), a drag picks out the letters it passes, and a
  // tap lifted without dragging brings the keyboard back to that line.
  const letterAt = (uv, only) => {
    const { ctx, canvas } = card.face.userData.tex;
    return composerIndexAt(ctx, canvas.width, canvas.height, compose, uv, only);
  };
  const lineHere = (field) => runtime.textInput.typing?.id === (field === "name" ? nameField.id : messageField.id);
  card.onTap = (uv) => {
    if (!card.raised || !uv) return write();
    const { field, index } = letterAt(uv);
    if (!lineHere(field)) write(field);
    else runtime.textInput.startTyping(field === "name" ? nameField : messageField);
    runtime.textInput.select(index);
  };
  card.onPress = (uv) => {
    if (!card.raised || !uv) return;
    const { field, index } = letterAt(uv);
    if (lineHere(field)) runtime.textInput.select(index);
  };
  card.onSelect = (from, to) => {
    if (!card.raised || !from || !to) return;
    const start = letterAt(from);
    const end = letterAt(to, start.field);
    if (!lineHere(start.field)) write(start.field);
    runtime.textInput.select(start.index, end.index);
  };
  boardNotes[PAGER].onTap = turnPage;
  lay();
  // fetched a moment after the room opens, so the board isn't bare from across the room
  runtime.core.timers.push(setTimeout(() => loadPage(1), 2500));
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
    boardNotes.forEach(({ paper, sheet, w, h, shown }) => {
      if (!shown) return;
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
  [[-3.12, -1.86, "#00e0c6"], [0.6, 1.5, "#ffdd00"], [3.13, 0.35, "#ff6b6b"], [-0.6, 1.55, "#7fb2ff"]].forEach(([x, y, color], i) => {
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
    // only papers on the board get in the way: the guestbook's empty slots are off it
    if (a.shown === false || b.shown === false) return false;
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
      if (noteDrag || note.raised || (note.slot === COMPOSE && flight) || (on && gsap.isTweening(note.pin.position))) return;
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
      if (book.state === "offline") loadPage(1);
      boardNotes.filter((note) => note.shown && !note.raised).forEach((note, i) => {
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
    // the guestbook, for the checks and the HUD
    book,
    compose,
    write,
    post,
    turnPage,
    loadPage,
    peel,
    backToPad,
    dropPin,
  };
}
