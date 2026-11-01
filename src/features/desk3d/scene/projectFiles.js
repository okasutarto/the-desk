import * as THREE from "three";
import gsap from "gsap";
import { hoverSound, sfx } from "@/shared/composables/useSfx";
import { FOLDER_COLORS } from "@/data/projectFiles";
import { drawFolderCover, drawCaseSheet, drawCaseBack, CASE_SHEETS, drawDrawerFront } from "../textures";

export function createProjectFiles(runtime) {
  // ---------- case files (projects) ----------
  // The folders stand in a file drawer, like the 2D Projects section: a dark box with a yellow
  // front panel, the folders upright inside with the back ones a little higher so every tab
  // shows. Zoomed in, you browse them right there: the front folder is pulled up to be read,
  // a tab (or ← →) flips through, and a folder flipped past is refiled at the back. Click the
  // front one to pull it out onto the desk and open it; its sheets then turn like pages (right
  // side forward, left side back, or ← →). The last sheet carries the links as stamps.
  const FOLDER_W = 3.1;
  const FOLDER_D = 2.2;
  const SHEET_W = FOLDER_W - 0.08;
  const SHEET_D = FOLDER_D - 0.08;
  const folders = new THREE.Group();
  // At the left end of the desk, under the window, its front turned to face the room (+x)
  const FOLDERS_AT = { x: -8.1, z: 0.2 }; // world
  folders.position.set(FOLDERS_AT.x, 0, FOLDERS_AT.z);
  folders.rotation.y = Math.PI / 2;
  runtime.core.scene.add(folders);
  // The drawer, in the folders group's own space
  const DRAWER_W = FOLDER_W + 0.32;
  // deep enough for the folders standing tilted, their covers a touch ajar, to stay inside it
  const DRAWER_D = runtime.options.projects.length * 0.17 + 0.75;
  // 13 cm high: the 22 cm folders stand well up out of it, their tabs on show, but it holds them
  const DRAWER_H = 1.3;
  const WALL = 0.08;
  const drawerMat = runtime.core.toon("#2b2b2b");
  const drawerPart = (w, h, d, x, y, z, material = drawerMat) => {
    const part = runtime.core.mesh(runtime.core.rbox(w, h, d, 0.02), material, { outline: 0.03 });
    part.position.set(x, y, z);
    folders.add(part);
    return part;
  };
  drawerPart(DRAWER_W, WALL, DRAWER_D, 0, WALL / 2, 0);
  drawerPart(DRAWER_W, DRAWER_H, WALL, 0, DRAWER_H / 2, -DRAWER_D / 2 + WALL / 2);
  drawerPart(WALL, DRAWER_H, DRAWER_D, -DRAWER_W / 2 + WALL / 2, DRAWER_H / 2, 0);
  drawerPart(WALL, DRAWER_H, DRAWER_D, DRAWER_W / 2 - WALL / 2, DRAWER_H / 2, 0);
  const FRONT_H = DRAWER_H * 0.78;
  // Pulled out, a folder is turned square to the room and laid open across the clear strip at
  // the front of the desk, its spine at the desk's centre and in front of the keyboard, the
  // cover opening back toward the drawer: clear of the riser, the photo, the tickets and the
  // mail. (In the drawer's own space: +z is out of its front, -x toward the front of the desk.)
  // Set down a little askew, not squared up to the desk.
  const OPEN_SPINE = { x: 0, z: 3.0 }; // world
  const OUT = { x: FOLDERS_AT.z - OPEN_SPINE.z, y: 0.04, z: OPEN_SPINE.x - FOLDERS_AT.x + FOLDER_W / 2, r: -Math.PI / 2 + 0.07 };
  // Opened, the cover's board springs back a touch instead of lying dead flat
  const OPEN_TILT = 0.05;
  drawerPart(DRAWER_W + 0.16, FRONT_H, 0.12, 0, FRONT_H / 2, DRAWER_D / 2 + 0.03, runtime.core.toon("#ffdd00"));
  const drawerFace = runtime.core.printed(DRAWER_W + 0.1, FRONT_H - 0.08, 300, (c, w, h) => drawDrawerFront(c, w, h, runtime.options.projects.length));
  drawerFace.position.set(0, FRONT_H / 2, DRAWER_D / 2 + 0.092);
  folders.add(drawerFace);
  const drawerHandle = drawerPart(0.7, 0.14, 0.1, 0, 0.12, DRAWER_D / 2 + 0.13, runtime.core.toon("#111111"));
  drawerHandle.castShadow = false;

  const folderGeo = runtime.core.track(runtime.core.rbox(FOLDER_W, 0.03, FOLDER_D, 0.012));
  const sheetMat = runtime.core.toon("#ffffff");
  const sheetY = (k) => 0.02 + (CASE_SHEETS.length - 1 - k) * 0.006;
  const HINGE_Y = 0.02 + CASE_SHEETS.length * 0.006 + 0.02;
  // Paged through as in 2D: the sheets stay a loose stack on the right, a turn slides the top
  // one out and tucks it under the pile (back: the bottom one comes out on top). Each depth in
  // the stack sits a little further down and across, at its own slight angle.
  const SHEET_SKEW = [0, -0.9, 0.7, -0.5, 1].map((deg) => (deg * Math.PI) / 180);
  const sheetRest = (pivot, depth) => {
    const base = pivot.userData.base;
    return { x: base.x + depth * 0.012, y: sheetY(depth), z: base.z + depth * 0.012, ry: base.ry + (SHEET_SKEW[depth] || 0) };
  };
  // A steady wobble per folder, so the drawer looks handled: each one leans its own way, its
  // cover left a little ajar, a stray sheet poking out of the top, page flags out the side
  const wobble = (i, k) => {
    const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return (v - Math.floor(v)) * 2 - 1;
  };
  const strayMat = runtime.core.toon("#fffdf5");
  const FLAG_COLORS = ["#ff6b6b", "#00e0c6", "#ffdd00"];
  const folderList = runtime.options.projects.map((project, i) => {
    const folderMat = runtime.core.toon(FOLDER_COLORS[i % FOLDER_COLORS.length]);
    const f = new THREE.Group();
    // Everything visible sits in body, so hover can lift it without touching f's own moves
    const body = new THREE.Group();
    f.add(body);
    const back = runtime.core.mesh(folderGeo, folderMat, { outline: 0.02 });
    body.add(back);
    const tabShape = new THREE.Shape();
    tabShape.moveTo(-0.48, 0); tabShape.lineTo(-0.38, 0.23);
    tabShape.lineTo(0.38, 0.23); tabShape.lineTo(0.48, 0); tabShape.closePath();
    const tab = runtime.core.mesh(new THREE.ExtrudeGeometry(tabShape, { depth: 0.025, bevelEnabled: false }), folderMat, { outline: 0.018 });
    tab.rotation.x = -Math.PI / 2;
    tab.position.set(-0.55 + i * 0.22, 0, -FOLDER_D / 2 + 0.01);
    const tabLabel = runtime.core.printed(0.8, 0.15, 400, (c, w, h) => {
      c.fillStyle = "#fffdf5"; c.fillRect(0, 0, w, h);
      c.strokeStyle = "#000"; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4);
      c.fillStyle = "#111"; c.font = `800 ${Math.round(h * 0.36)}px sans-serif`;
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(`${String(i + 1).padStart(2, "0")} ${project.title.split(" ")[0].toUpperCase()}`, w / 2, h / 2, w - 16);
    });
    tabLabel.rotation.x = -Math.PI / 2;
    tabLabel.position.set(tab.position.x, 0.03, tab.position.z - 0.11);
    body.add(tab, tabLabel);
    // Sheets, hinged on the folder's left edge like pages
    const sheets = CASE_SHEETS.map((kind, k) => {
      const pivot = new THREE.Group();
      // not squared into a neat stack: each sheet sits a hair off the one under it
      pivot.userData.base = { x: -FOLDER_W / 2 + 0.04 + wobble(i * 7 + k, 30) * 0.015, z: wobble(i * 7 + k, 31) * 0.025, ry: wobble(i * 7 + k, 32) * 0.02 };
      const restAt = sheetRest(pivot, k);
      pivot.position.set(restAt.x, restAt.y, restAt.z);
      pivot.rotation.y = restAt.ry;
      const paper = runtime.core.mesh(runtime.core.bendable(SHEET_W, SHEET_D, 0.004), sheetMat, { outline: 0.008, cast: false });
      paper.position.x = SHEET_W / 2;
      const front = runtime.core.printed(SHEET_W, SHEET_D, 600, (c, w, h) => drawCaseSheet(c, w, h, project, kind, { index: i }));
      front.geometry = runtime.core.track(runtime.core.bendable(SHEET_W, SHEET_D));
      front.rotation.x = -Math.PI / 2;
      front.position.set(SHEET_W / 2, 0.0025, 0);
      const backSide = runtime.core.printed(SHEET_W, SHEET_D, 600, (c, w, h) => drawCaseBack(c, w, h, project, { index: i, kind }));
      backSide.geometry = runtime.core.track(runtime.core.bendable(SHEET_W, SHEET_D));
      backSide.rotation.x = Math.PI / 2;
      backSide.position.set(SHEET_W / 2, -0.0025, 0);
      pivot.add(paper, front, backSide);
      body.add(pivot);
      pivot.userData.flex = runtime.core.paperFlex(pivot, [paper, front, backSide], { length: SHEET_W });
      return pivot;
    });
    const hinge = new THREE.Group();
    hinge.position.set(-FOLDER_W / 2, HINGE_Y, 0);
    const cover = runtime.core.mesh(runtime.core.bendable(FOLDER_W, FOLDER_D, 0.03), folderMat, { outline: 0.02 });
    cover.position.x = FOLDER_W / 2;
    const face = runtime.core.printed(FOLDER_W, FOLDER_D, 600, (c, w, h) => drawFolderCover(c, w, h, project, i));
    face.geometry = runtime.core.track(runtime.core.bendable(FOLDER_W, FOLDER_D));
    face.rotation.x = -Math.PI / 2;
    face.position.set(FOLDER_W / 2, 0.016, 0);
    const inside = runtime.core.printed(FOLDER_W, FOLDER_D, 300, (c, w, h) => drawCaseBack(c, w, h, project, { inside: true, index: i }));
    inside.rotation.x = Math.PI / 2;
    inside.position.set(FOLDER_W / 2, -0.016, 0);
    inside.geometry = runtime.core.track(runtime.core.bendable(FOLDER_W, FOLDER_D));
    hinge.add(cover, face, inside);
    body.add(hinge);
    const coverFlex = runtime.core.paperFlex(hinge, [cover, face, inside], { length: FOLDER_W });
    // A loose sheet or two poking out past the top edge, askew
    [0, 1].slice(0, 1 + (i % 2)).forEach((k) => {
      const stray = runtime.core.mesh(runtime.core.rbox(SHEET_W * (0.7 - k * 0.15), 0.004, 0.5, 0.0015), strayMat, { outline: 0.008, cast: false });
      stray.position.set(wobble(i, 7 + k) * 0.35, 0.0172 + k * 0.0003, -FOLDER_D / 2 + 0.2 - 0.06 - k * 0.04 - Math.abs(wobble(i, 9 + k)) * 0.05);
      stray.rotation.y = wobble(i, 11 + k) * 0.12;
      body.add(stray);
    });
    // Page flags: little neon tabs stuck to a sheet, poking out past the right-hand edge
    FLAG_COLORS.slice(0, 2 + (i % 2)).forEach((color, k) => {
      const flag = runtime.core.mesh(runtime.core.rbox(0.16, 0.004, 0.09, 0.0015), runtime.core.toon(color), { outline: 0.006, cast: false });
      flag.position.set(FOLDER_W / 2 + 0.03, 0.0175, -FOLDER_D * (0.25 - k * 0.22) + wobble(i, 20 + k) * 0.05);
      flag.rotation.y = wobble(i, 23 + k) * 0.08;
      body.add(flag);
    });
    // ajar by the same few millimetres whatever the folder's width, so its cover's free edge
    // stays behind the drawer's front
    const rest = (0.03 + Math.abs(wobble(i, 1)) * 0.06) * 2.2 / FOLDER_W;
    hinge.rotation.z = rest;
    folders.add(f);
    const lean = { x: wobble(i, 2) * 0.07, y: wobble(i, 3) * 0.05, z: wobble(i, 4) * 0.05, dx: wobble(i, 5) * 0.07 };
    return { project, index: i, f, body, hinge, coverFlex, sheets, order: sheets.map((_, k) => k), flipping: false, out: 0, homing: false, rest, lean };
  });
  let openFolder = null;
  // Standing in the drawer, the folder's -z edge (with its tab) points up and its cover faces
  // the room. Depth 0 is the front slot; each one further back stands a little higher.
  const STAND_RX = Math.PI / 2 - 0.1;
  const n = folderList.length;
  // Slots run back from the front one by a fixed pitch; both are set once the folders are posed
  // (below), from how far a standing folder really reaches forward and back of its centre
  const slots = { front: DRAWER_D / 2 - 0.28, pitch: 0.17 };
  const slotZ = (d) => slots.front - d * slots.pitch;
  const slotY = (d) => WALL + FOLDER_D / 2 + d * 0.05;
  const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const between = (from, to, t, lo, hi) => from + (to - from) * smooth((t - lo) / (hi - lo));
  // Where the browse stands: which folder is at the front (fractional while flipping)
  const browse = { p: 0, target: 0 };
  const depthOf = (entry) => (((entry.index - browse.p) % n) + n) % n;
  const frontIndex = () => ((Math.round(browse.target) % n) + n) % n;
  const drawerPose = (entry, out) => {
    const d = depthOf(entry);
    if (d > n - 1) {
      // Being refiled (as in 2D): straight up out of the others, carried back above them,
      // dropped in behind, briskly, the moment it's over its slot. f runs 0 (front) → 1 (back slot).
      const f = n - d;
      const up = smooth(Math.min(f / 0.3, (1 - f) / 0.18)) * (FOLDER_D + 0.55);
      out.z = between(slotZ(0), slotZ(n - 1), f, 0.25, 0.7);
      out.y = slotY(0) + (slotY(n - 1) - slotY(0)) * f + up + (1 - f) * 0.3;
    } else {
      out.z = slotZ(d);
      // The front folder is pulled up to be read
      out.y = slotY(d) + Math.max(0, 1 - d) * 0.3;
    }
    out.x = 0;
    return out;
  };
  // Out of the drawer, a folder rises straight up, standing, till its foot clears the drawer's
  // front, and only then sets off over it in a low arc, laying down and turning as it goes, onto
  // the desk. The phases overlap, so it never stops between them. t runs 0 (slot) → 1 (desk).
  const FLY_Y = DRAWER_H + FOLDER_D / 2 + 0.45;
  const slot = { x: 0, y: 0, z: 0 };
  const smoother = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (6 * x - 15) + 10));
  // Filed back, it doesn't retrace that path: the drawer's close-up clips everything well in
  // front of the drawer, so a folder coming straight back from the desk would blink into sight
  // mid-frame, and dropping in from above it would cut through the files standing behind. So it
  // swings out wide to the side (crossing that clip off-screen), standing up on the way, slides in
  // sideways just over the drawer's side wall, in the very slant of the front slot (the files
  // behind lean the same way, so it passes clear of them), and lowers into it. s runs 0 (desk) → 1 (slot).
  const HOME = { side: -6.2, y: DRAWER_H + FOLDER_D / 2 + 0.05 };
  function homingPose(entry, s) {
    const { f, lean } = entry;
    // the front slot, where the file being read stands pulled up a little
    const frontZ = slotZ(0);
    const frontY = slotY(0) + 0.3;
    // higher up the slant, a standing folder's plane sits further back
    const slant = (HOME.y - frontY) / Math.tan(STAND_RX);
    const rise = smooth(s / 0.25);
    const wide = smoother(s / 0.4);
    const back = smoother((s - 0.1) / 0.4);
    const across = smoother((s - 0.45) / 0.33);
    const drop = smooth((s - 0.74) / 0.26);
    f.position.set(
      OUT.x + (HOME.side - OUT.x) * wide - HOME.side * across,
      OUT.y + (HOME.y - OUT.y) * rise + (frontY - HOME.y) * drop,
      OUT.z + (frontZ - slant - OUT.z) * back + slant * drop,
    );
    // leans into the swing out; square while it slides in and lowers, and only takes up its own
    // little lean as it settles
    const firm = smooth((s - 0.9) / 0.1);
    const bank = Math.sin(Math.PI * wide) * 0.1;
    f.position.x += lean.dx * firm;
    f.rotation.set(between(0, STAND_RX, s, 0.08, 0.5) + lean.x * firm, between(OUT.r, 0, s, 0.05, 0.5) + lean.y * firm, lean.z * firm + bank);
  }
  function poseFolders() {
    folderList.forEach((entry) => {
      const { f, out: t } = entry;
      drawerPose(entry, slot);
      const { lean } = entry;
      if (t <= 0) {
        f.position.set(slot.x + lean.dx, slot.y, slot.z);
        f.rotation.set(STAND_RX + lean.x, lean.y, lean.z);
        return;
      }
      if (entry.homing) return homingPose(entry, 1 - t);
      const lift = smooth(t / 0.32);
      const travel = smoother((t - 0.2) / 0.8);
      const land = smooth((t - 0.62) / 0.38);
      f.position.set(
        slot.x + (OUT.x - slot.x) * travel,
        slot.y + (FLY_Y - slot.y) * lift + (OUT.y - FLY_Y) * land + Math.sin(Math.PI * travel) * 0.35,
        slot.z + (OUT.z - slot.z) * travel,
      );
      // it straightens up as it comes out, and leans into the carry a little, level again as
      // it lands
      const loose = 1 - smooth(t / 0.3);
      const bank = Math.sin(Math.PI * travel) * 0.09;
      f.position.x += lean.dx * loose;
      f.rotation.set(between(STAND_RX, 0, t, 0.28, 0.9) + lean.x * loose, between(0, OUT.r, t, 0.24, 0.92) + lean.y * loose, lean.z * loose + bank);
    });
  }
  poseFolders();
  // Standing, a folder's tilt, lean and slightly open cover carry its corners ahead of and behind
  // its centre; measured once, they set the slots so none reaches the drawer's front panel (its
  // inner face 0.03 in from the drawer's depth) or its back wall
  {
    folders.updateMatrixWorld(true);
    const box = new THREE.Box3();
    let ahead = 0;
    let behind = 0;
    folderList.forEach(({ f }) => {
      // the folders group faces +x, so its own z runs along the world's x
      box.setFromObject(f);
      const centre = folders.position.x + f.position.z;
      ahead = Math.max(ahead, box.max.x - centre);
      behind = Math.max(behind, centre - box.min.x);
    });
    const CLEAR = 0.03;
    slots.front = DRAWER_D / 2 - 0.03 - CLEAR - ahead;
    const back = -DRAWER_D / 2 + WALL + CLEAR + behind;
    slots.pitch = Math.min(0.17, (slots.front - back) / Math.max(1, n - 1));
    poseFolders();
  }
  // Flip through to a folder (always forward, so the ones in front are refiled at the back),
  // or one step either way with ↑ ↓ or the scroll wheel: the files move up and down
  function browseTo(target) {
    if (openFolder || target === browse.target) return;
    const steps = Math.abs(target - browse.target);
    browse.target = target;
    // The hover lift doesn't ride along: every folder settles into its slot, and once they've
    // landed, whichever is under the pointer then is lifted
    folderList.forEach((entry) => liftFolder(entry, false));
    let last = Math.round(browse.p);
    gsap.to(browse, {
      p: target,
      duration: 0.2 + 0.3 * Math.min(steps, 3),
      ease: "sine.inOut",
      overwrite: true,
      onComplete: () => runtime.pointer.refreshHover(),
      onUpdate: () => {
        const now = Math.round(browse.p);
        if (now === last) return;
        last = now;
        sfx.slide();
        sfx.knock({ strength: 0.7, delay: 0.22 });
      },
    });
  }
  const browseToFolder = (entry) => browseTo(browse.target + ((entry.index - frontIndex() + n) % n));
  const folderFor = (obj) => folderList.find(({ f }) => {
    for (let o = obj; o; o = o.parent) if (o === f) return true;
    return false;
  });
  function closeFolder(entry) {
    // the stack squared back into its first order
    entry.order = entry.sheets.map((_, k) => k);
    entry.sheets.forEach((pivot, k) => {
      const restAt = sheetRest(pivot, k);
      gsap.to(pivot.rotation, { y: restAt.ry, duration: 0.3, overwrite: true });
      gsap.to(pivot.position, { x: restAt.x, y: restAt.y, z: restAt.z, duration: 0.3, overwrite: true });
    });
    entry.flipping = false;
    // Shut the cover (cutting short its swing open, if it was still under way), then back into its slot at the front of the drawer
    // the board lags its swing shut, curling up at the free edge, and slaps flat with a quiver
    gsap.to(entry.coverFlex, { bend: 0.3, duration: 0.3, delay: 0.1, ease: "power1.out", overwrite: true });
    gsap.to(entry.hinge.rotation, { z: entry.rest, duration: 0.4, delay: 0.1, ease: "power2.in", overwrite: true, onComplete: () => {
      sfx.slap();
      // it lands on the pile and the free edge bounces up off it, never down into it
      runtime.core.flexSettle(entry.coverFlex, 0.1);
    } });
    // it lifts off while the cover is still settling, and once home the cover gives a little quiver
    entry.homing = true;
    gsap.to(entry, { out: 0, duration: 1.9, delay: 0.35, ease: "power1.inOut", overwrite: true, onComplete: () => {
      entry.homing = false;
      sfx.knock({ strength: 0.8 });
      runtime.core.flexSettle(entry.coverFlex, 0.06);
    } });
  }
  // Pull the front folder out onto the desk, open its cover out flat, and move the camera in close
  function openProject(entry) {
    if (openFolder) return;
    openFolder = entry;
    runtime.options.onEvent("projectOpen", { open: true });
    gsap.to(entry.body.position, { y: 0, z: 0, duration: 0.2, overwrite: true });
    entry.homing = false;
    runtime.camera.applyShot(false, 1.2);
    // The cat gets off the desk first, whatever she's up to; the file waits for her to go
    runtime.cat.catShoo(() => {
      if (openFolder !== entry) return;
      sfx.folderSlide({ duration: 0.6 });
      // each phase of the flight eases itself, so time runs near even
      gsap.to(entry, { out: 1, duration: 1.4, ease: "power1.inOut", overwrite: true, onComplete: () => sfx.flop({ strength: 0.5, recorded: false }) });
      // swung open by its edge, the board trails the hinge (its free edge held back) and
      // springs through flat as it lands
      gsap.to(entry.coverFlex, { bend: -0.32, duration: 0.35, delay: 1.3, ease: "power1.out", overwrite: true });
      gsap.to(entry.hinge.rotation, { z: Math.PI - OPEN_TILT, duration: 0.6, delay: 1.3, ease: "power2.inOut", overwrite: true, onStart: () => sfx.coverOpen({ duration: 0.6 }), onComplete: () => {
        sfx.flop({ strength: 0.3, recorded: false });
        // laid open on the desk, the edge bounces up off it
        runtime.core.flexSettle(entry.coverFlex, -0.12);
      } });
    });
  }
  function closeProject() {
    if (!openFolder) return;
    closeFolder(openFolder);
    openFolder = null;
    runtime.cat.catSettle();
    runtime.options.onEvent("projectOpen", { open: false });
    runtime.camera.applyShot();
  }
  function turnSheet(dir) {
    const entry = openFolder;
    if (!entry || entry.flipping) return;
    entry.flipping = true;
    const { order, sheets } = entry;
    const page = dir > 0 ? order[0] : order[order.length - 1];
    const moving = sheets[page];
    // Paged as a hand would: the sheet is drawn right until it's clear of the pile, changes
    // level only once it's clear (so it never passes through the others), and slides back in at
    // its new depth. It curls up only while it's above everything else (drawn off the top, or
    // laid back on top), and stays flat while it travels under the pile.
    const toBottom = dir > 0;
    const newOrder = toBottom ? [...order.slice(1), page] : [page, ...order.slice(0, -1)];
    const restAt = sheetRest(moving, newOrder.indexOf(page));
    const above = sheetY(0) + 0.03;
    const clear = { x: moving.position.x + SHEET_W * 1.04, z: moving.position.z - SHEET_D * 0.04 };
    const flex = moving.userData.flex;
    gsap.killTweensOf([moving.position, moving.rotation, flex]);
    sfx.slide({ duration: 0.3 });
    const tl = gsap.timeline({ onComplete: () => (entry.flipping = false) });
    // out
    tl.to(moving.position, { ...clear, y: toBottom ? above : moving.position.y, duration: 0.34, ease: "power2.inOut" }, 0)
      .to(moving.rotation, { y: moving.rotation.y - 0.1, duration: 0.34, ease: "power2.inOut" }, 0)
      .to(flex, { bend: toBottom ? 0.3 : 0, duration: 0.2, ease: "power2.out" }, 0);
    // clear of the pile: the others close up into their new depths, and the sheet changes level
    tl.add(() => {
      entry.order = newOrder;
      newOrder.forEach((p, depth) => {
        if (p === page) return;
        const at = sheetRest(sheets[p], depth);
        gsap.to(sheets[p].position, { x: at.x, y: at.y, z: at.z, duration: 0.24, ease: "power2.out" });
        gsap.to(sheets[p].rotation, { y: at.ry, duration: 0.24, ease: "power2.out" });
      });
    }, 0.3)
      .to(flex, { bend: toBottom ? 0 : 0.18, duration: 0.16, ease: "sine.inOut" }, 0.3)
      .to(moving.position, { y: toBottom ? restAt.y : above, duration: 0.16, ease: "sine.inOut" }, 0.3);
    // and in again, settling flat as it comes to rest
    tl.add(() => sfx.slide({ duration: 0.3, up: false }), 0.46)
      .to(moving.position, { x: restAt.x, z: restAt.z, duration: 0.4, ease: "power3.out" }, 0.46)
      .to(moving.rotation, { y: restAt.ry, duration: 0.4, ease: "power3.out" }, 0.46)
      .to(moving.position, { y: restAt.y, duration: 0.3, ease: "power2.out" }, toBottom ? 0.46 : 0.62)
      .to(flex, { bend: 0, duration: 0.45, ease: "sine.out" }, 0.5);
  }
  const folderPoint = new THREE.Vector3();
  const clickFolder = (hit) => {
    const entry = folderFor(hit.object);
    if (!entry) return;
    if (openFolder) {
      if (entry !== openFolder) return closeProject();
    } else {
      // The front folder comes out; any other one is flipped to the front first
      if (entry.index === frontIndex() && Math.abs(browse.p - browse.target) < 0.05) return openProject(entry);
      return browseToFolder(entry);
    }
    if (entry.out < 1) return;
    entry.f.worldToLocal(folderPoint.copy(hit.point));
    turnSheet(folderPoint.x > -FOLDER_W / 2 ? 1 : -1);
  };
  // Hover lifts just the folder under the pointer
  function liftFolder(entry, on) {
    const lift = on && !openFolder;
    gsap.to(entry.body.position, { y: 0, z: lift ? -0.42 : 0, duration: lift ? 0.28 : 0.4, ease: "power2.out", overwrite: true });
    if (lift) hoverSound(entry, (s) => s.folderSlide({ duration: 0.2 }));
  }
  folderList.forEach((entry) =>
    runtime.core.register(entry.f, {
      focus: "projects",
      item: true,
      // In the drawer a folder is pulled up a little (its local -z points up while it stands)
      onHover: (on) => liftFolder(entry, on),
      onClick: clickFolder,
      onHotspot: (hs) => openFolder && turnSheet(hs.action === "prev" ? -1 : 1),
    }),
  );
  runtime.core.register(folders, {
    focus: "projects",
    onLeave: () => {
      if (openFolder) closeProject();
    },
    onHover: (on) => {
      gsap.to(drawerHandle.position, { z: DRAWER_D / 2 + (on && !openFolder ? 0.23 : 0.13), duration: 0.25, overwrite: true });
      folderList[frontIndex()] && runtime.core.interactive.get(folderList[frontIndex()].f).onHover(on);
    },
    onClick: clickFolder,
    onKey: (e) => {
      // An open folder's pages turn sideways (← →); in the drawer the files go up and down (↑ ↓)
      if (openFolder && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        turnSheet(e.key === "ArrowRight" ? 1 : -1);
        return true;
      }
      if (!openFolder && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        browseTo(browse.target + (e.key === "ArrowDown" ? 1 : -1));
        return true;
      }
      if (e.key !== "Enter" || openFolder) return false;
      openProject(folderList[frontIndex()]);
      return true;
    },
  });
  // Scrolling in the drawer's close-up flips the files too: down to the next, up to the one
  // before. One scroll gesture is one file: a trackpad swipe and its momentum, or a quick spin
  // of the wheel, flip a single file once they add up to a whole step. A pause in the stream
  // starts a new gesture. So does a fresh swipe while the last one's momentum is still dying
  // away, but only once the flip has all but landed and the stream has clearly picked up again:
  // a few events running well above the quietest the momentum got, so its jitter never counts.
  const WHEEL_STEP = 70;
  const WHEEL_REST = 140;
  const WHEEL_SURGE = 24;
  let wheelSum = 0;
  let wheelAt = 0;
  let wheelSpent = false;
  let wheelLow = Infinity;
  let wheelRecent = [];
  const onWheel = (e) => {
    if (runtime.camera.focus.name !== "projects" || openFolder || e.ctrlKey) return;
    e.preventDefault();
    const now = performance.now();
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? runtime.options.container.clientHeight : 1);
    const size = Math.abs(delta);
    wheelRecent = [...wheelRecent.slice(-2), size];
    const pickedUp = wheelRecent.length === 3 && wheelRecent.every((s) => s > Math.max(WHEEL_SURGE, wheelLow * 2.5));
    const landed = Math.abs(browse.p - browse.target) < 0.25;
    if (now - wheelAt > WHEEL_REST || (wheelSpent && landed && pickedUp)) {
      wheelSum = 0;
      wheelSpent = false;
      wheelLow = Infinity;
    }
    wheelAt = now;
    if (wheelSpent) {
      wheelLow = Math.min(wheelLow, size);
      return;
    }
    wheelSum += delta;
    if (Math.abs(wheelSum) < WHEEL_STEP) return;
    browseTo(browse.target + Math.sign(wheelSum));
    wheelSpent = true;
  };
  runtime.core.renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

  // Public state used by the other scene parts.
  return {
    folders,
    get openFolder() { return openFolder; },
    FOLDER_W,
    FOLDER_D,
    OUT,
    closeProject,
    poseFolders,
    onWheel,
  };
}
