import * as THREE from "three";
import gsap from "gsap";
import { sfx, startScrape } from "@/shared/composables/useSfx";
import { SCREEN_W, SCREEN_H } from "../desktop";

export function createPointer(runtime) {
  // ---------- pointer ----------
  const raycaster = new THREE.Raycaster();
  raycaster.layers.enable(2);
  const ndc = new THREE.Vector2();
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  let hovered = null;
  let downAt = null;
  // where the mouse last stood, so hover can be checked again when the scene moves under it
  let mouseAt = null;

  const rayFromPointer = (e) => {
    const rect = runtime.core.renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, runtime.core.camera);
    return raycaster.ray;
  };
  // Close-ups clip whatever is in front of the prop (camera.near). Those props aren't drawn, so
  // they mustn't catch the pointer either: the monitor sits right in front of the badge.
  const viewPoint = new THREE.Vector3();
  // (nor the gauntlet while it's put away for the swords' close-up: hidden, it's still there
  // for the ray)
  // (nor the chair, put away for the tickets' close-up)
  const inside = (object, group) => {
    for (let o = object; o; o = o.parent) if (o === group) return true;
    return false;
  };
  // (nor what's registered but kept out of the scene, like the hidden board, badge, clock and
  // painting: never placed, their world matrices stay at the origin, under the keyboard)
  const inScene = (object) => inside(object, runtime.core.scene);
  const visibleHits = () => raycaster.intersectObjects(runtime.core.pickables.filter(inScene), true)
    .filter((h) => -viewPoint.copy(h.point).applyMatrix4(runtime.core.camera.matrixWorldInverse).z >= runtime.core.camera.near)
    .filter((h) => (!runtime.swordEffects.rackPropsHidden || (!inside(h.object, runtime.gauntlet.gauntlet) && !inside(h.object, runtime.handheld.nintendoSwitch) && !inside(h.object, runtime.workstation.monitor))) && (runtime.chair.chair.visible || !inside(h.object, runtime.chair.chair)) && (!runtime.lamp.lampHidden || !inside(h.object, runtime.lamp.lamp)) && (runtime.lamp.familyFrame.visible || !inside(h.object, runtime.lamp.familyFrame)));
  const pick = (e) => {
    rayFromPointer(e);
    const hit = visibleHits()[0];
    return hit ? { hit, entry: runtime.core.entryFor(hit.object) } : null;
  };
  // For hover: stay on the item already hovered while the pointer is still over any part of
  // it. A lifted ticket or folder shifts a little on screen; without this the hover would
  // flick back and forth between it and the one beneath.
  const pickHover = (e, hits = null) => {
    rayFromPointer(e);
    if (!hits) hits = visibleHits();
    const nearest = hits[0] ? runtime.core.entryFor(hits[0].object) : null;
    // A paper in front of its board must take hover from the parent behind it.
    // Keep the existing retention for overlapping peers such as tickets and folders.
    if (hovered && nearest?.object !== hovered.object) {
      for (let o = nearest?.object.parent; o; o = o.parent) if (o === hovered.object) return nearest;
    }
    if (hovered && hits.some((h) => runtime.core.entryFor(h.object)?.object === hovered.object)) return hovered;
    return nearest;
  };
  const setHover = (entry) => {
    if (hovered?.object === entry?.object) return;
    hovered?.onHover?.(false);
    hovered = entry;
    hovered?.onHover?.(true);
    runtime.core.renderer.domElement.style.cursor = entry?.sticky || entry?.grabTurn || (entry?.note && runtime.camera.focus.name === "about") ? "grab" : entry ? "pointer" : "default";
  };
  // Something moved under a still mouse (the folders flipped round in their drawer): hover
  // whatever is under it now, afresh, even if that's the item already hovered
  const refreshHover = () => {
    if (!mouseAt) return;
    rayFromPointer(mouseAt);
    const hit = visibleHits()[0];
    setHover(null);
    setHover(hit ? runtime.core.entryFor(hit.object) : null);
  };
  let shelfDrag = null;
  function browseShelf(y, instant = false) {
    runtime.shelf.shelfLook = THREE.MathUtils.clamp(y, 1.7, 9);
    runtime.gauntlet.shelfBubble.hide();
    runtime.camera.applyShot(instant, instant ? 0 : 0.22);
  }
  function finishShelfDrag(pointerId = null) {
    if (!shelfDrag || (pointerId !== null && shelfDrag.pointerId !== pointerId)) return null;
    const drag = shelfDrag;
    shelfDrag = null;
    if (runtime.core.renderer.domElement.hasPointerCapture(drag.pointerId)) runtime.core.renderer.domElement.releasePointerCapture(drag.pointerId);
    runtime.core.renderer.domElement.style.cursor = "grab";
    if (drag.moved) downAt = null;
    return drag;
  }
  let stickyDrag = null;
  const stickyPlane = new THREE.Plane();
  const stickyPoint = new THREE.Vector3();
  function stickyPointer(e) {
    runtime.workstation.monitor.updateWorldMatrix(true, false);
    stickyPlane.setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 0, 1).transformDirection(runtime.workstation.monitor.matrixWorld),
      runtime.workstation.monitor.localToWorld(stickyPoint.set(0, 0, 0.1)),
    );
    const hit = rayFromPointer(e).intersectPlane(stickyPlane, stickyPoint);
    return hit ? runtime.workstation.monitor.worldToLocal(hit) : null;
  }
  function finishStickyDrag(pointerId = null) {
    if (!stickyDrag || (pointerId !== null && stickyDrag.pointerId !== pointerId)) return null;
    const drag = stickyDrag;
    stickyDrag = null;
    downAt = null;
    if (runtime.core.renderer.domElement.hasPointerCapture(drag.pointerId)) runtime.core.renderer.domElement.releasePointerCapture(drag.pointerId);
    runtime.core.renderer.domElement.style.cursor = "grab";
    return drag;
  }
  // A press held on the screen: an icon dragged along the dock, or a finger dragged over the
  // console's picture to sail the ship
  let screenDrag = null;
  function screenPoint(e) {
    rayFromPointer(e);
    const hit = raycaster.intersectObject(runtime.workstation.screen, false)[0];
    return hit?.uv ? { x: hit.uv.x * SCREEN_W, y: (1 - hit.uv.y) * SCREEN_H } : null;
  }
  // Returns the drag, `dropped` when a desktop window or dock icon was really moved (so it isn't a click too)
  function finishScreenDrag(pointerId = null) {
    if (!screenDrag || (pointerId !== null && pointerId !== screenDrag.pointerId)) return null;
    const drag = screenDrag;
    screenDrag = null;
    if (runtime.core.renderer.domElement.hasPointerCapture(drag.pointerId)) runtime.core.renderer.domElement.releasePointerCapture(drag.pointerId);
    drag.dropped = drag.desktop && runtime.workstation.desktop.release();
    if (drag.dropped) runtime.workstation.redrawScreen();
    return drag;
  }
  const onPointerMove = (e) => {
    runtime.core.responsiveUntil = performance.now() + 2000;
    if (screenDrag?.pointerId === e.pointerId) {
      const at = screenPoint(e);
      if (screenDrag.desktop) {
        if (at && runtime.workstation.desktop.dragTo(at.x, at.y)) runtime.workstation.redrawScreen();
      } else if (screenDrag.unitsPerPixel) {
        // The console: the finger can be anywhere, even below the monitor, clear of the ship
        runtime.workstation.desktop.drag((e.clientX - screenDrag.px) * screenDrag.unitsPerPixel, (e.clientY - screenDrag.py) * screenDrag.unitsPerPixel);
        Object.assign(screenDrag, { px: e.clientX, py: e.clientY });
      }
      screenDrag.at = at;
      e.preventDefault();
      return;
    }
    if (shelfDrag) {
      if (e.pointerId !== shelfDrag.pointerId) return;
      const dy = e.clientY - shelfDrag.startY;
      if (!shelfDrag.moved && Math.hypot(e.clientX - shelfDrag.startX, dy) < 6) return;
      shelfDrag.moved = true;
      runtime.core.renderer.domElement.style.cursor = "grabbing";
      browseShelf(shelfDrag.startLook + dy * shelfDrag.unitsPerPixel, true);
      e.preventDefault();
      return;
    }
    if (stickyDrag) {
      if (e.pointerId !== stickyDrag.pointerId) return;
      if (!stickyDrag.moved && Math.hypot(e.clientX - stickyDrag.startX, e.clientY - stickyDrag.startY) < 4) return;
      const point = stickyPointer(e);
      if (!point) return;
      stickyDrag.moved = true;
      // Keep a little overhang around the bezel, as in the original placements.
      stickyDrag.sticky.position.x = THREE.MathUtils.clamp(point.x - stickyDrag.offsetX, -2.3, 2.3);
      stickyDrag.sticky.position.y = THREE.MathUtils.clamp(point.y - stickyDrag.offsetY, runtime.workstation.SCREEN_Y - 1.33, runtime.workstation.SCREEN_Y + 1.07);
      runtime.core.renderer.domElement.style.cursor = "grabbing";
      e.preventDefault();
      return;
    }
    if (chairDrag) {
      if (e.pointerId !== chairDrag.pointerId) return;
      if (!chairDrag.moved && Math.hypot(e.clientX - chairDrag.startX, e.clientY - chairDrag.startY) < 4) return;
      if (!chairDrag.moved) {
        chairDrag.moved = true;
        runtime.chair.grabChair(chairDrag);
        runtime.core.renderer.domElement.style.cursor = "grabbing";
      }
      runtime.chair.turnChair(chairDrag, e.clientX, performance.now());
      e.preventDefault();
      return;
    }
    if (hatDrag) {
      if (e.pointerId !== hatDrag.pointerId) return;
      if (!hatDrag.moved && Math.hypot(e.clientX - hatDrag.startX, e.clientY - hatDrag.startY) < 4) return;
      hatDrag.moved = true;
      runtime.core.renderer.domElement.style.cursor = "grabbing";
      runtime.strawHat.pullHat(hatDrag, rayFromPointer(e), e.timeStamp);
      e.preventDefault();
      return;
    }
    if (lanyardDrag) {
      if (e.pointerId !== lanyardDrag.pointerId) return;
      if (!lanyardDrag.moved && Math.hypot(e.clientX - lanyardDrag.startX, e.clientY - lanyardDrag.startY) < 4) return;
      if (!lanyardDrag.moved) {
        lanyardDrag.moved = true;
        runtime.badge.grabLanyard(lanyardDrag);
        runtime.core.renderer.domElement.style.cursor = "grabbing";
      }
      const point = rayFromPointer(e).intersectPlane(runtime.badge.lanyardPlane, runtime.badge.lanyardPoint);
      if (point) runtime.badge.moveLanyard(lanyardDrag, point);
      if (e.timeStamp - (lanyardDrag.lastSound || 0) > 130) {
        sfx.strap({ speed: Math.min(1, Math.hypot(e.movementX, e.movementY) / 14) });
        lanyardDrag.lastSound = e.timeStamp;
      }
      e.preventDefault();
      return;
    }
    if (runtime.aboutBoard.noteDrag) {
      if (e.pointerId !== runtime.aboutBoard.noteDrag.pointerId) return;
      if (Math.hypot(e.clientX - runtime.aboutBoard.noteDrag.startX, e.clientY - runtime.aboutBoard.noteDrag.startY) < 4 && !runtime.aboutBoard.noteDrag.moved) return;
      const point = boardPointer(e);
      if (!point) return;
      if (!runtime.aboutBoard.noteDrag.moved) gsap.killTweensOf(runtime.aboutBoard.noteDrag.note.shadow.position);
      runtime.aboutBoard.noteDrag.moved = true;
      const position = runtime.aboutBoard.clampNote(runtime.aboutBoard.noteDrag.note, point.x - runtime.aboutBoard.noteDrag.offsetX, point.y - runtime.aboutBoard.noteDrag.offsetY);
      runtime.aboutBoard.noteDrag.note.paper.position.x = position.x;
      runtime.aboutBoard.noteDrag.note.paper.position.y = position.y;
      runtime.aboutBoard.noteDrag.note.shadow.position.x = position.x + 0.1;
      runtime.aboutBoard.noteDrag.note.shadow.position.y = position.y - 0.1;
      // One held scrape for the whole drag, swelling with the hand and fading when it stops
      if (!runtime.aboutBoard.noteDrag.scrape) runtime.aboutBoard.noteDrag.scrape = startScrape();
      runtime.aboutBoard.noteDrag.scrape?.set(Math.min(1, Math.hypot(e.movementX, e.movementY) / 12));
      e.preventDefault();
      return;
    }
    const rect = runtime.core.renderer.domElement.getBoundingClientRect();
    parallax.tx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    parallax.ty = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    if (e.pointerType === "mouse") {
      mouseAt = { clientX: e.clientX, clientY: e.clientY };
      // Reuse one raycast for hover, prop hotspots and the lanyard hit area.
      rayFromPointer(e);
      const hits = visibleHits();
      setHover(pickHover(e, hits));
      if (hovered?.onPointer) {
        const hit = hits[0];
        hovered.onPointer(runtime.core.entryFor(hit?.object)?.object === hovered.object ? hit : null);
      }
      if (lanyardUnder(e, hits)?.strap || hovered?.object === runtime.strawHat.hatPeg) runtime.core.renderer.domElement.style.cursor = "grab";
      runtime.mouse.mouseAim.x = runtime.mouse.MOUSE_ORIGIN.x + parallax.tx * 0.6;
      runtime.mouse.mouseAim.z = runtime.mouse.MOUSE_ORIGIN.z + parallax.ty * 0.45;
    }
  };
  // The pin or strap under the pointer, or the badge itself, on the shots where it's in reach
  // (the overview, the badge close up, and the About board it hangs from)
  function lanyardUnder(e, hits = null) {
    if (runtime.camera.focus.name !== "overview" && runtime.camera.focus.name !== "hero" && runtime.camera.focus.name !== "about") return null;
    const badgeHit = hits ? runtime.core.entryFor(hits[0]?.object)?.object === runtime.badge.badge : pick(e)?.entry?.object === runtime.badge.badge;
    const point = rayFromPointer(e).intersectPlane(runtime.badge.lanyardPlane, runtime.badge.lanyardPoint);
    return point ? runtime.badge.lanyardAt(point, badgeHit) : null;
  }
  let lanyardDrag = null;
  // The gaming chair, turned on its post by a sideways drag
  let chairDrag = null;
  function finishChairDrag(pointerId = null) {
    if (!chairDrag || (pointerId !== null && pointerId !== chairDrag.pointerId)) return null;
    const drag = chairDrag;
    chairDrag = null;
    if (drag.moved) runtime.chair.releaseChair(drag);
    if (runtime.core.renderer.domElement.hasPointerCapture(drag.pointerId)) runtime.core.renderer.domElement.releasePointerCapture(drag.pointerId);
    runtime.core.renderer.domElement.style.cursor = "grab";
    return drag;
  }
  // The straw hat, held and pulled on its cord
  let hatDrag = null;
  function finishHatDrag(pointerId = null) {
    if (!hatDrag || (pointerId !== null && pointerId !== hatDrag.pointerId)) return null;
    const drag = hatDrag;
    hatDrag = null;
    if (drag.moved) runtime.strawHat.releaseHat(drag);
    if (runtime.core.renderer.domElement.hasPointerCapture(drag.pointerId)) runtime.core.renderer.domElement.releasePointerCapture(drag.pointerId);
    runtime.core.renderer.domElement.style.cursor = "default";
    return drag;
  }
  function finishLanyardDrag() {
    if (!lanyardDrag) return null;
    const drag = lanyardDrag;
    lanyardDrag = null;
    if (drag.moved) runtime.badge.releaseLanyard(drag);
    if (runtime.core.renderer.domElement.hasPointerCapture(drag.pointerId)) runtime.core.renderer.domElement.releasePointerCapture(drag.pointerId);
    runtime.core.renderer.domElement.style.cursor = "default";
    return drag;
  }
  const onPointerDown = (e) => {
    runtime.core.responsiveUntil = performance.now() + 2000;
    if (shelfDrag || stickyDrag || runtime.aboutBoard.noteDrag || lanyardDrag || hatDrag || chairDrag || e.button !== 0) return;
    downAt = { x: e.clientX, y: e.clientY };
    const onScreen = runtime.camera.focus.name === "monitor" && screenPoint(e);
    if (onScreen && runtime.workstation.desktop.press(onScreen.x, onScreen.y)) {
      // A title bar or dock icon: a drag moves it, a plain click still reaches its hotspot
      screenDrag = { pointerId: e.pointerId, at: onScreen, desktop: true };
      runtime.core.renderer.domElement.setPointerCapture(e.pointerId);
      if (e.pointerType === "mouse") runtime.mouse.pressMouse();
      e.preventDefault();
      return;
    }
    if (e.pointerType !== "mouse" && runtime.camera.focus.name === "monitor" && runtime.workstation.desktop.active() === "console") {
      // A tap still lands on the screen's buttons when the finger is lifted. A finger moves the
      // ship as far as it moves on the picture, wherever on the page it is
      const left = runtime.workstation.screen.localToWorld(new THREE.Vector3(-2, 0, 0)).project(runtime.core.camera);
      const right = runtime.workstation.screen.localToWorld(new THREE.Vector3(2, 0, 0)).project(runtime.core.camera);
      const pictureWidth = Math.hypot(right.x - left.x, (right.y - left.y) * (runtime.options.container.clientHeight / runtime.options.container.clientWidth)) * runtime.options.container.clientWidth / 2;
      const from = screenPoint(e);
      screenDrag = { pointerId: e.pointerId, at: from, from, px: e.clientX, py: e.clientY, unitsPerPixel: SCREEN_W / Math.max(1, pictureWidth) };
      runtime.core.renderer.domElement.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (runtime.camera.focus.name === "shelf") {
      shelfDrag = {
        pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
        startLook: runtime.shelf.shelfLook, unitsPerPixel: runtime.animation.viewH / (runtime.camera.cam.zoom * runtime.camera.userView.zoom) / runtime.options.container.clientHeight, moved: false,
      };
      runtime.core.renderer.domElement.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    const stickyEntry = pick(e)?.entry;
    if (stickyEntry?.sticky) {
      const point = stickyPointer(e);
      if (!point) return;
      stickyDrag = {
        sticky: stickyEntry.sticky, entry: stickyEntry, pointerId: e.pointerId,
        startX: e.clientX, startY: e.clientY, moved: false,
        offsetX: point.x - stickyEntry.sticky.position.x,
        offsetY: point.y - stickyEntry.sticky.position.y,
      };
      runtime.core.renderer.domElement.setPointerCapture(e.pointerId);
      runtime.core.renderer.domElement.style.cursor = "grabbing";
      e.preventDefault();
      return;
    }
    if (stickyEntry?.grabTurn && !runtime.chair.chairBusy) {
      chairDrag = { entry: stickyEntry, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false };
      runtime.core.renderer.domElement.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (stickyEntry?.object === runtime.strawHat.hatPeg) {
      const drag = { entry: stickyEntry, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false };
      if (runtime.strawHat.grabHat(drag, rayFromPointer(e))) {
        hatDrag = drag;
        runtime.core.renderer.domElement.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
    }
    // The lanyard hangs in front of the About board, so a press on it takes the lanyard alone,
    // never a note behind it too
    const hold = lanyardUnder(e);
    if (hold) {
      lanyardDrag = { ...hold, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false };
      runtime.core.renderer.domElement.setPointerCapture(e.pointerId);
      e.preventDefault();
      if (e.pointerType === "mouse") runtime.mouse.pressMouse();
      return;
    }
    const entry = runtime.camera.focus.name === "about" && pick(e)?.entry;
    const point = entry?.note && boardPointer(e);
    if (point) {
      runtime.aboutBoard.noteDrag = {
        note: entry.note, pointerId: e.pointerId,
        startX: e.clientX, startY: e.clientY,
        offsetX: point.x - entry.note.paper.position.x,
        offsetY: point.y - entry.note.paper.position.y,
        homeX: entry.note.paper.position.x, homeY: entry.note.paper.position.y,
        moved: false, lastSound: e.timeStamp,
      };
      runtime.core.renderer.domElement.setPointerCapture(e.pointerId);
      runtime.core.renderer.domElement.style.cursor = "grabbing";
      runtime.aboutBoard.liftNote(entry.note);
      e.preventDefault();
    }
    if (e.pointerType === "mouse") runtime.mouse.pressMouse();
  };
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -runtime.aboutBoard.aboutBoard.position.z);
  const dragPoint = new THREE.Vector3();
  function boardPointer(e) {
    const hit = rayFromPointer(e).intersectPlane(dragPlane, dragPoint);
    return hit ? runtime.aboutBoard.aboutBoard.worldToLocal(hit) : null;
  }
  function finishNoteDrag(pointerId = null, sound = true) {
    if (!runtime.aboutBoard.noteDrag || (pointerId !== null && pointerId !== runtime.aboutBoard.noteDrag.pointerId)) return;
    const drag = runtime.aboutBoard.noteDrag;
    runtime.aboutBoard.noteDrag = null;
    drag.scrape?.stop();
    downAt = null;
    const overlaps = drag.moved && runtime.aboutBoard.boardNotes.some((other) => other !== drag.note && runtime.aboutBoard.notesOverlap(drag.note, other));
    runtime.aboutBoard.pinNote(drag.note, sound, overlaps ? { x: drag.homeX, y: drag.homeY } : drag.note.paper.position);
    if (runtime.core.renderer.domElement.hasPointerCapture(drag.pointerId)) runtime.core.renderer.domElement.releasePointerCapture(drag.pointerId);
    runtime.core.renderer.domElement.style.cursor = "grab";
    return drag;
  }
  const onPointerCancel = (e) => {
    setHover(null);
    finishScreenDrag(e.pointerId);
    if (finishShelfDrag(e.pointerId)) downAt = null;
    finishStickyDrag(e.pointerId);
    finishNoteDrag(e.pointerId);
    if (lanyardDrag?.pointerId === e.pointerId) finishLanyardDrag();
    finishHatDrag(e.pointerId);
    finishChairDrag(e.pointerId);
  };
  const onWindowBlur = () => {
    setHover(null);
    finishScreenDrag();
    runtime.workstation.desktop.releaseKeys();
    if (finishShelfDrag()) downAt = null;
    finishStickyDrag();
    finishNoteDrag();
    finishLanyardDrag();
    finishHatDrag();
    finishChairDrag();
  };
  const onPointerUp = (e) => {
    const drag = finishScreenDrag(e.pointerId);
    // A dock icon really moved, or a console finger set down off the picture: no desk click
    if (drag?.dropped || (drag?.unitsPerPixel && !drag.from)) {
      downAt = null;
      return;
    }
    if (shelfDrag) {
      if (e.pointerId !== shelfDrag.pointerId) return;
      const drag = finishShelfDrag(e.pointerId);
      if (drag.moved) return;
    }
    if (stickyDrag) {
      if (e.pointerId !== stickyDrag.pointerId) return;
      const drag = finishStickyDrag(e.pointerId);
      if (!drag.moved) runtime.camera.handleClick(drag.entry);
      return;
    }
    if (chairDrag && e.pointerId === chairDrag.pointerId) {
      const drag = finishChairDrag(e.pointerId);
      downAt = null;
      if (!drag.moved) runtime.camera.handleClick(drag.entry);
      return;
    }
    if (hatDrag && e.pointerId === hatDrag.pointerId) {
      const drag = finishHatDrag(e.pointerId);
      downAt = null;
      if (!drag.moved) runtime.camera.handleClick(drag.entry);
      return;
    }
    if (lanyardDrag && e.pointerId === lanyardDrag.pointerId) {
      const drag = finishLanyardDrag();
      if (drag.moved) {
        downAt = null;
        // Re-pinned while close up: frame the badge where it hangs now
        if (drag.index === 0 && runtime.camera.focus.name === "hero") runtime.camera.applyShot(false, 0.6);
        return;
      }
      // A plain click on the strap or pin just sets it swinging; on the badge it's a click
      if (drag.strap) {
        downAt = null;
        runtime.badge.swing(0.25);
        sfx.tick({ pitch: 0.8 });
        return;
      }
    }
    if (runtime.aboutBoard.noteDrag) {
      if (e.pointerId !== runtime.aboutBoard.noteDrag.pointerId) return;
      runtime.aboutBoard.noteDrag.moved = runtime.aboutBoard.noteDrag.moved || Math.hypot(e.clientX - runtime.aboutBoard.noteDrag.startX, e.clientY - runtime.aboutBoard.noteDrag.startY) >= 4;
      const drag = finishNoteDrag(e.pointerId);
      if (drag?.note.href && !drag.moved) runtime.camera.runHotspot({ href: drag.note.href });
      return;
    }
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8;
    downAt = null;
    if (moved) return;
    const result = pick(e);
    if (result?.entry) runtime.camera.handleClick(result.entry, result.hit);
    else runtime.camera.back();
  };
  const onPointerLeave = () => {
    if (shelfDrag || runtime.aboutBoard.noteDrag || stickyDrag || chairDrag) return;
    mouseAt = null;
    setHover(null);
    parallax.tx = parallax.ty = 0;
  };

  // Public state used by the other scene parts.
  return {
    browseShelf,
    parallax,
    finishShelfDrag,
    finishNoteDrag,
    ndc,
    onPointerCancel,
    get downAt() { return downAt; },
    set downAt(value) { downAt = value; },
    get chairDrag() { return chairDrag; },
    get hatDrag() { return hatDrag; },
    get lanyardDrag() { return lanyardDrag; },
    get stickyDrag() { return stickyDrag; },
    onPointerMove,
    onPointerDown,
    onPointerUp,
    onPointerLeave,
    onWindowBlur,
    setHover,
    refreshHover,
    get shelfDrag() { return shelfDrag; },
    finishStickyDrag,
  };
}
