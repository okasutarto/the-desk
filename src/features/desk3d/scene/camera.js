import * as THREE from "three";
import gsap from "gsap";
import { sfx } from "@/shared/composables/useSfx";

export function createCamera(runtime) {
  // ---------- camera shots ----------
  // Each prop has a shot: where the camera looks from, and the box (world units) it must
  // fit. Clicking a prop flies the camera there; clicking it again while in its shot does
  // its thing. Empty space or Esc goes back out to the overview.
  const focus = { name: "overview" };
  const screenNormal = new THREE.Vector3();
  const screenPos = new THREE.Vector3();
  // How far above the shelf's top board its close-up can look: the middle of the gauntlet and
  // the Switch standing on it
  const SHELF_TOP_LOOK = 2.4;
  // The shelf's close-up clips what's in front of it, but the dumbbells on the floor at its
  // front corner stand in frame: sliced through, a head showed the black inside of its outline.
  // So the clip reaches past their front, lifted mid-rep (1.5 up) included.
  const SHELF_DIR = [0.24, 0.1, 1];
  const shelfNormal = new THREE.Vector3(...SHELF_DIR).normalize();
  let gymBox = null;
  const gymCorner = new THREE.Vector3();
  function gymReach(target) {
    if (!gymBox) {
      gymBox = new THREE.Box3().setFromObject(runtime.gym.gym, true);
      gymBox.max.y += 1.5;
    }
    let reach = 0;
    for (const x of [gymBox.min.x, gymBox.max.x]) for (const y of [gymBox.min.y, gymBox.max.y]) for (const z of [gymBox.min.z, gymBox.max.z]) {
      reach = Math.max(reach, gymCorner.set(x - target[0], y - target[1], z - target[2]).dot(shelfNormal));
    }
    return reach + 0.15;
  }
  const SHOTS = {
    // The camera sits inside the room, with no cutaway edges or outside backdrop; on a portrait
    // screen it stands back to take in the whole diorama instead.
    overview: () => (runtime.room.diorama ? dioramaShot() : { target: [4.0, 5.3, 4.04], dir: [0.62, 0.72, 1], fit: [39, 21.4], depth: CAM_DISTANCE - 0.1 }),
    // Browse the tall collection in close-up, starting at the console and GAME ON sign.
    shelf: () => {
      const fit = [runtime.options.container.clientWidth < 900 ? 8.8 : 10.5, 7.2];
      const visibleH = Math.max(fit[1], fit[0] * runtime.options.container.clientHeight / runtime.options.container.clientWidth);
      const bottom = visibleH / 2 - (runtime.options.container.clientWidth < 600 ? 1.2 : 0.5);
      const shelfTop = (runtime.room.FLOOR_Y + (runtime.shelf.SHELF_H + runtime.swordRack.SHELF_TOP_EXTRA) * runtime.shelf.shelf.scale.y);
      const top = Math.max(bottom, runtime.shelf.SHELF_H * runtime.shelf.shelf.scale.y + SHELF_TOP_LOOK, shelfTop - runtime.room.FLOOR_Y + 1.5 - visibleH / 2);
      const y = bottom + (runtime.shelf.shelfLook - 1.7) / 7.3 * (top - bottom);
      const xOffset = runtime.room.FLOOR_Y + y >= runtime.shelf.shelf.position.y + runtime.shelf.SHELF_H * runtime.shelf.shelf.scale.y + 0.4 ? 0.1 : 0.35;
      const target = [runtime.shelf.shelf.position.x + xOffset, runtime.room.FLOOR_Y + y, runtime.shelf.shelf.position.z];
      return { target, dir: SHELF_DIR, fit, depth: Math.max(3.2, gymReach(target)) };
    },
    // Clip only what's well in front of the wall (the monitor), not the board behind the badge
    hero: () => ({ target: [runtime.badge.badgePin.x, runtime.badge.badgePin.y - (runtime.badge.BADGE_PIN.y - runtime.badge.BADGE_CLIP.y) - 0.74, runtime.badge.BADGE_CLIP.z], dir: [0.06, 0.14, 1], fit: [1.5, 2.1], depth: 0.9 }),
    about: () => ({ target: runtime.aboutBoard.aboutBoard.position.toArray(), dir: [0, 0.8, 1], fit: [8.75, 5.75] }),
    // The fan, or square on the pass being held up
    experience: () => {
      if (!runtime.tickets.heldTicket) {
        runtime.tickets.tickets.localToWorld(screenPos.set(0.15, 0, 0.65));
        return { target: screenPos.toArray(), dir: [0.06, 1, 0.5], fit: [3.4, 3.0] };
      }
      runtime.tickets.tickets.localToWorld(screenPos.set(runtime.tickets.HOLD.x, runtime.tickets.HOLD.y, runtime.tickets.HOLD.z));
      return { target: screenPos.toArray(), dir: [0, 1, 0.5], fit: [5.6, 2.9] };
    },
    // The folders standing in the drawer, or close on the one pulled out onto the desk (its
    // cover lies open to the left)
    projects: () => {
      if (!runtime.projectFiles.openFolder) {
        // Square on the drawer's front, wherever it faces. A shallow clip keeps what's in front of
        // the drawer out of the shot (the lamp and the family photo step aside; see setFocus), yet
        // reaches far enough to keep whole a file sliding back in over the drawer's side wall.
        runtime.projectFiles.folders.localToWorld(screenPos.set(0, 1.25, 0.2));
        screenNormal.set(0.05, 0.62, 1).applyQuaternion(runtime.projectFiles.folders.quaternion);
        return { target: screenPos.toArray(), dir: screenNormal.toArray(), fit: [4.6, 3.9], depth: 1.7 };
      }
      // Centre on the spine: the open cover lies to its left, the sheets to its right. Laid
      // down, the folder's left is the drawer's -z.
      const narrow = runtime.options.container.clientWidth < 768;
      runtime.projectFiles.folders.localToWorld(screenPos.set(runtime.projectFiles.OUT.x, runtime.projectFiles.OUT.y, runtime.projectFiles.OUT.z - (narrow ? 0 : runtime.projectFiles.FOLDER_W / 2)));
      return { target: [screenPos.x, screenPos.y + 0.17, screenPos.z], dir: [0.03, 1, 0.35], fit: narrow ? [runtime.projectFiles.FOLDER_W + 0.2, runtime.projectFiles.FOLDER_D + 0.4] : [runtime.projectFiles.FOLDER_W * 2 + 0.35, runtime.projectFiles.FOLDER_D + 0.55] };
    },
    family: () => {
      runtime.lamp.familyFrame.updateWorldMatrix(true, false);
      runtime.lamp.familyFrame.localToWorld(screenPos.set(0, 1.06, 0.1));
      runtime.lamp.familyFrame.getWorldDirection(screenNormal);
      return { target: screenPos.toArray(), dir: screenNormal.toArray(), fit: [1.6, 2.15], depth: 0.9 };
    },
    // Face-on to the phone's screen, whatever angle the stand holds it at
    chat: () => {
      runtime.chat.phoneScreen.updateWorldMatrix(true, false);
      runtime.chat.phoneScreen.getWorldDirection(screenNormal);
      runtime.chat.phoneScreen.getWorldPosition(screenPos);
      // Room above the phone for the back button and below it for the hint, so neither
      // covers the screen (the phone itself is 1.95 tall)
      return { target: screenPos.toArray(), dir: screenNormal.toArray(), fit: [1.3, 2.6] };
    },
    // Square over the postcard where it lands once it slides out of the envelope
    contact: () => {
      // Between the card and the envelope under it, so both stay in frame
      runtime.postcard.mail.localToWorld(screenPos.set(runtime.postcard.POSTCARD_OUT.x, runtime.postcard.POSTCARD_OUT.y, (runtime.postcard.POSTCARD_OUT.z + runtime.postcard.ENVELOPE_SETTLE.z) / 2));
      return { target: screenPos.toArray(), dir: [0.02, 1, 0.25], fit: runtime.postcard.cardReady ? [2.2, 1.95] : [2.45, 3.5] };
    },
    // The sword rack, with room on its left for a sword's card and above it for a slash
    swords: () => {
      runtime.swordRack.katanaRack.getWorldPosition(screenPos);
      return { target: [screenPos.x - 1.85, screenPos.y + 0.95, screenPos.z], dir: [0.12, 0.08, 1], fit: [17, 11], depth: 7 };
    },
    // Close on the gauntlet for the snap, from a little to its right and above
    gauntlet: () => {
      // Framed for the glove at the top of its snap: 1.8 of its own units tall at rest (48 cm),
      // it rises another 0.88 (about 23 cm), so the frame centres on that whole reach and keeps
      // the fingers clear of the Back button above and the hint below
      runtime.gauntlet.gauntlet.localToWorld(screenPos.set(0, 1.34, 0));
      return { target: screenPos.toArray(), dir: [0.3, 0.3, 1], fit: [7.2, 9.2], depth: 7.6 };
    },
    // Square on the window in the left wall, its weather display on the glass, roller to sill.
    // The clip cuts away the lamp in front, but reaches far enough out that the roller blind and
    // its chain (sliced, they'd show the black inside of their outlines), the wall's tilted face
    // and the guitar on it all stay whole to the frame's corners.
    window: () => ({ target: [runtime.room.windowGroup.position.x + 0.1, runtime.room.windowGroup.position.y + 0.2, runtime.room.windowGroup.position.z], dir: [1, 0.08, 0.04], fit: [14.6, 13.1], depth: 2.0 }),
    // Framed a little high, with room under the monitor's chin for the command chips and the
    // hint (they'd sit over the chin otherwise)
    monitor: () => {
      runtime.workstation.monitor.localToWorld(screenPos.set(0, runtime.workstation.SCREEN_Y - 0.38, 0.09));
      return { target: screenPos.toArray(), dir: [0.1, 0.32, 1], fit: [7.7, 6.8] };
    },
    // Behind the loader: square on the screen, the room dark around it (see animation's standby)
    standby: () => {
      const { monitor, SCREEN_Y } = runtime.workstation;
      monitor.updateWorldMatrix(true, false);
      monitor.localToWorld(screenPos.set(0, SCREEN_Y - 0.6, 0.09));
      monitor.getWorldDirection(screenNormal);
      screenNormal.y += 0.12;
      // on a portrait screen the width is what's short, so the frame closes in on the monitor
      const portrait = runtime.options.container.clientWidth < runtime.options.container.clientHeight;
      return { target: screenPos.toArray(), dir: screenNormal.toArray(), fit: portrait ? [6.6, 8.6] : [13, 8.6] };
    },
    keyboard: () => ({ target: [runtime.keyboard.keyboard.position.x, 0.3 * runtime.keyboard.KEYBOARD_SCALE, runtime.keyboard.keyboard.position.z], dir: [0.1, 1, 0.75], fit: [5.4 * runtime.keyboard.KEYBOARD_SCALE, 2.6 * runtime.keyboard.KEYBOARD_SCALE] }),
    // A higher angle pushes the plant above the frame and leaves room for the sip quote.
    mug: () => ({ target: [runtime.coffee.mug.position.x - 0.3, 0.95 + runtime.coffee.MUG_Y, runtime.coffee.mug.position.z - 0.45], dir: [-0.2, 1, 0.45], fit: [3.1, 4.1] }),
  };
  // Keep the wider overview's orthographic rays inside the room at desktop widths.
  const CAM_DISTANCE = 60;
  // The whole diorama, slab to wall tops, fitted between the page's title and its hint
  // Seen from above and to the right; a sideways swipe turns it between nearly face-on to
  // either wall (any further and a wall would stand between the camera and the room)
  const DIORAMA_YAW = [0.12, 1.35];
  let dioramaYaw = Math.atan2(0.74, 1);
  const DIORAMA_DIR = new THREE.Vector3();
  const DIORAMA_PAD = { top: 118, bottom: 92, side: 10 };
  function dioramaShot() {
    DIORAMA_DIR.set(Math.sin(dioramaYaw) * 1.244, 1.02, Math.cos(dioramaYaw) * 1.244).normalize();
    const right = new THREE.Vector3().crossVectors(runtime.core.UP, DIORAMA_DIR).normalize();
    const up = new THREE.Vector3().crossVectors(DIORAMA_DIR, right);
    const r = [Infinity, -Infinity];
    const u = [Infinity, -Infinity];
    const corner = new THREE.Vector3();
    [runtime.room.DIORAMA.x0, runtime.room.DIORAMA.x1].forEach((x) => [runtime.room.FLOOR_Y - 0.045 - runtime.room.DIORAMA.slab, runtime.room.DIORAMA.top].forEach((y) => [runtime.room.DIORAMA.z0, runtime.room.DIORAMA.z1].forEach((z) => {
      corner.set(x, y, z);
      const cr = corner.dot(right);
      const cu = corner.dot(up);
      r[0] = Math.min(r[0], cr), r[1] = Math.max(r[1], cr);
      u[0] = Math.min(u[0], cu), u[1] = Math.max(u[1], cu);
    })));
    const w = runtime.options.container.clientWidth || 1;
    const h = runtime.options.container.clientHeight || 1;
    const fit = [(r[1] - r[0]) * w / Math.max(1, w - DIORAMA_PAD.side * 2), (u[1] - u[0]) * h / Math.max(1, h - DIORAMA_PAD.top - DIORAMA_PAD.bottom)];
    const zoom = Math.min(runtime.animation.viewH * (w / h) / fit[0], runtime.animation.viewH / fit[1]);
    // The free band's middle sits a little below the screen's, past the taller title
    const lift = ((DIORAMA_PAD.top - DIORAMA_PAD.bottom) / 2) * runtime.animation.viewH / zoom / h;
    const target = right.multiplyScalar((r[0] + r[1]) / 2).addScaledVector(up, (u[0] + u[1]) / 2 + lift);
    return { target: target.toArray(), dir: DIORAMA_DIR.toArray(), fit, depth: CAM_DISTANCE - 0.1 };
  }
  // Close-ups clip everything more than this far in front of the prop (chair, lamp, other
  // props), so nothing in the room can block the view or catch the click
  const CLOSE_UP_DEPTH = 3.5;
  const cam = { tx: 0, ty: 0, tz: 0, dx: 0, dy: 1, dz: 1, zoom: 1, near: 0.1 };
  // A pinch on top of the shot: how much closer, and how far it's panned (world units along
  // the view's right and up). Every new shot starts from none
  const userView = { zoom: 1, x: 0, y: 0 };
  const USER_ZOOM_MAX = 4;
  // Keeps the pinched view inside the shot's own frame
  function clampUserView() {
    userView.zoom = THREE.MathUtils.clamp(userView.zoom, 1, USER_ZOOM_MAX);
    const halfW = (runtime.core.camera.right - runtime.core.camera.left) / 2 / cam.zoom;
    const halfH = (runtime.core.camera.top - runtime.core.camera.bottom) / 2 / cam.zoom;
    const roomW = halfW * (1 - 1 / userView.zoom);
    const roomH = halfH * (1 - 1 / userView.zoom);
    userView.x = THREE.MathUtils.clamp(userView.x, -roomW, roomW);
    userView.y = THREE.MathUtils.clamp(userView.y, -roomH, roomH);
  }
  function resetUserView() {
    gsap.killTweensOf(userView);
    if (userView.zoom !== 1 || userView.x || userView.y) gsap.to(userView, { zoom: 1, x: 0, y: 0, duration: 0.6, ease: "power3.inOut" });
  }

  function applyShot(instant = false, duration = 0.9) {
    const shot = SHOTS[focus.name]();
    const d = new THREE.Vector3(...shot.dir).normalize();
    const w = runtime.options.container.clientWidth || 1;
    const h = runtime.options.container.clientHeight || 1;
    const viewW = runtime.animation.viewH * (w / h);
    const zoom = shot.fit ? Math.min(viewW / shot.fit[0], runtime.animation.viewH / shot.fit[1]) : 1;
    const near = shot.fit ? CAM_DISTANCE - (shot.depth ?? CLOSE_UP_DEPTH) : 0.1;
    const to = { tx: shot.target[0], ty: shot.target[1], tz: shot.target[2], dx: d.x, dy: d.y, dz: d.z, zoom, near };
    if (instant) {
      gsap.killTweensOf(cam);
      Object.assign(cam, to);
    } else if (focus.name === "shelf" && duration <= 0.25) {
      Object.assign(cam, { tx: to.tx, tz: to.tz, dx: to.dx, dy: to.dy, dz: to.dz, zoom: to.zoom, near: to.near });
    } else {
      gsap.killTweensOf(cam);
      gsap.to(cam, { ...to, duration, ease: "power3.inOut" });
    }
  }

  // Where the shelf's close-up looks (its scroll, 1.7–9) to centre a height in the world
  function shelfLookAt(worldY) {
    const fit = [runtime.options.container.clientWidth < 900 ? 8.8 : 10.5, 7.2];
    const visibleH = Math.max(fit[1], fit[0] * runtime.options.container.clientHeight / runtime.options.container.clientWidth);
    const bottom = visibleH / 2 - (runtime.options.container.clientWidth < 600 ? 1.2 : 0.5);
    const shelfTop = (runtime.room.FLOOR_Y + (runtime.shelf.SHELF_H + runtime.swordRack.SHELF_TOP_EXTRA) * runtime.shelf.shelf.scale.y);
    const top = Math.max(bottom, runtime.shelf.SHELF_H * runtime.shelf.shelf.scale.y + SHELF_TOP_LOOK, shelfTop - runtime.room.FLOOR_Y + 1.5 - visibleH / 2);
    const norm = top > bottom ? (worldY - runtime.room.FLOOR_Y - bottom) / (top - bottom) : 0;
    return THREE.MathUtils.clamp(1.7 + norm * 7.3, 1.7, 9);
  }

  let arriveTimer = null;
  function setFocus(name, hit = null) {
    if (focus.name === name) return;
    // Keys 1 and 2, and the desktop's About app, have nothing to fly to while the badge or
    // the board is hidden
    if ((name === "hero" && !runtime.badge.shown) || (name === "about" && !runtime.aboutBoard.shown)) return;
    runtime.pointer.setHover(null);
    runtime.textInput.stopTyping();
    runtime.core.byFocus.get(focus.name)?.onLeave?.();
    clearTimeout(arriveTimer);
    focus.name = name;
    // the lamp only steps aside once the camera is well on its way, so it doesn't vanish in
    // plain sight of the overview; leaving, it's back at once
    runtime.lamp.hideLamp(false);
    if (name === "window" || name === "projects") runtime.core.timers.push(setTimeout(() => focus.name === name && runtime.lamp.hideLamp(true), 450));
    // the family photo stands just in front of the folders, so it steps out of their close-up the same way
    runtime.lamp.familyFrame.visible = true;
    if (name === "projects") runtime.core.timers.push(setTimeout(() => focus.name === "projects" && (runtime.lamp.familyFrame.visible = false), 450));
    // and the chair, pulled up in front of the window, steps out of the window's
    runtime.chair.chair.visible = true;
    if (name === "window") runtime.core.timers.push(setTimeout(() => focus.name === "window" && (runtime.chair.chair.visible = false), 450));
    if (name === "shelf") {
      // Frame the whole bay that was clicked (whatever part of it was hit), or on the top board
      // its two display props; with no click, the console's bay at the top
      const boards = runtime.shelf.LEVELS.map((y) => runtime.shelf.shelf.position.y + y * runtime.shelf.shelf.scale.y);
      const topBoardY = runtime.shelf.shelf.position.y + runtime.shelf.SHELF_H * runtime.shelf.shelf.scale.y;
      const y = hit?.point ? hit.point.y : (boards[2] + boards[3]) / 2;
      const bay = Math.max(0, boards.findLastIndex((board) => board <= y));
      const lookY = y >= topBoardY - 0.2 || bay >= boards.length - 1 ? topBoardY + SHELF_TOP_LOOK : (boards[bay] + boards[bay + 1]) / 2;
      runtime.shelf.shelfLook = shelfLookAt(lookY);
    }
    runtime.cat.catSettle();
    resetUserView();
    applyShot();
    sfx.whoosh({ duration: 0.45, up: name !== "overview" });
    runtime.options.onEvent("focus", { name });
    const entry = runtime.core.byFocus.get(name);
    if (!entry) return;
    // Once the camera lands: the prop's arrival move
    arriveTimer = setTimeout(() => focus.name === name && entry.onArrive?.(), 850);
  }

  // The standby shot is taken at once and left without a sound or a focus event: it isn't a
  // close-up the visitor chose, and the page's hints don't follow it
  function standby() {
    focus.name = "standby";
    applyShot(true);
  }
  function leaveStandby(duration) {
    focus.name = "overview";
    applyShot(false, duration);
  }

  function back() {
    if (runtime.tickets.heldTicket) runtime.tickets.dropTicket();
    else if (runtime.projectFiles.openFolder) runtime.projectFiles.closeProject();
    else if (focus.name !== "overview") setFocus("overview");
  }

  // A clickable rectangle printed on a texture, under the pointer
  function hotspotAt(hit) {
    const t = hit?.object.userData.tex;
    if (!t?.hotspots?.length || !hit.uv) return null;
    const px = hit.uv.x * t.canvas.width;
    const py = (1 - hit.uv.y) * t.canvas.height;
    return t.hotspots.find((hs) => px >= hs.x && px <= hs.x + hs.w && py >= hs.y && py <= hs.y + hs.h) || null;
  }
  function runHotspot(hs, entry) {
    sfx.click();
    if (!hs.href) return entry.onHotspot?.(hs);
    if (hs.href.startsWith("mailto:")) window.location.href = hs.href;
    else window.open(hs.href, "_blank", "noopener");
  }

  function handleClick(entry, hit) {
    runtime.pointer.setHover(null);
    if (!entry.focus || focus.name === entry.focus) {
      const hs = entry.focus && hotspotAt(hit);
      if (runtime.textInput.typing && hs?.id !== runtime.textInput.typing.id) runtime.textInput.stopTyping();
      return hs ? runHotspot(hs, entry) : entry.onClick?.(hit);
    }
    entry.onEnter?.(hit);
    setFocus(entry.focus, hit);
  }

  // Public state used by the other scene parts.
  return {
    back,
    standby,
    leaveStandby,
    focus,
    shelfLookAt,
    setFocus,
    cam,
    applyShot,
    userView,
    handleClick,
    runHotspot,
    USER_ZOOM_MAX,
    clampUserView,
    get dioramaYaw() { return dioramaYaw; },
    set dioramaYaw(value) { dioramaYaw = value; },
    DIORAMA_YAW,
    SHOTS,
    CAM_DISTANCE,
    get arriveTimer() { return arriveTimer; },
  };
}
