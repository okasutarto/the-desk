import gsap from "gsap";
import { setRainLevel } from "@/shared/composables/useSfx";

export function createLifecycle(runtime) {
  return {
    setTheme: runtime.theme.setRoomTheme,
    setWallColor: runtime.theme.setWallColor,
    setWallPattern: runtime.theme.setWallPattern,
    setWood: runtime.theme.setWood,
    setFloor: runtime.theme.setFloor,
    setDeviceFinish: (part, finish) => ({
      phone: runtime.chat.setPhoneFinish,
      keyboard: runtime.keyboard.setKeyboardFinish,
      mouse: runtime.mouse.setMouseFinish,
    })[part]?.(finish),
    setTimesGateFinish: runtime.timesGate.setTimesGateFinish,
    setTime: runtime.theme.setTime,
    setRain: runtime.weather.setRain,
    setMuted: runtime.workstation.setMuted,
    standby: runtime.animation.standby,
    landStandby: runtime.workstation.landStandby,
    enter: runtime.animation.enter,
    back: runtime.camera.back,
    focusOn: (name) => runtime.camera.SHOTS[name] && runtime.camera.setFocus(name),
    runCommand: (cmd) => {
      if (!runtime.workstation.computer.on) return;
      runtime.workstation.showTerminal();
      if (runtime.camera.focus.name === "monitor") runtime.workstation.autotype(cmd);
      else runtime.camera.setFocus("monitor"), runtime.core.timers.push(setTimeout(() => runtime.workstation.autotype(cmd), 700));
    },

    destroy() {
      runtime.pointer.finishShelfDrag();
      runtime.pointer.finishStickyDrag();
      runtime.pointer.finishNoteDrag(null, false);
      runtime.core.destroyed = true;
      runtime.workstation.lofi.destroy();
      setRainLevel(0);
      cancelAnimationFrame(runtime.animation.frame);
      runtime.core.timers.forEach(clearTimeout);
      clearTimeout(runtime.camera.arriveTimer);
      runtime.core.bubbleTimers.forEach(clearTimeout);
      clearInterval(runtime.theme.clockTimer);
      clearInterval(runtime.chat.buzzTimer);
      clearTimeout(runtime.gym.repTimer);
      clearTimeout(runtime.swordEffects.shoutTimer);
      runtime.animation.intro?.kill();
      runtime.postcard.mailIntro?.kill();
      runtime.shelfCollectibles.trophyCelebration?.kill();
      gsap.killTweensOf(runtime.shelfCollectibles.trophyHalo.material);
      gsap.killTweensOf([runtime.shelfConsole.ledSweep, runtime.shelfConsole.ledGlowMat,
        runtime.shelfConsole.ledMat.color, runtime.shelfConsole.ledGlowMat.color]);
      runtime.gym.confetti.forEach((bit) => gsap.killTweensOf(bit.material));
      runtime.wastebasket.papers.forEach(({ ball }) => gsap.killTweensOf(ball.scale));
      clearTimeout(runtime.wastebasket.binBadgeTimer);
      gsap.killTweensOf(runtime.catTree.toyPivot.rotation);
      gsap.killTweensOf([runtime.camera.cam, runtime.guitar.stringVibration, runtime.guitar.stringMat.color, runtime.room.windowGlare.material, runtime.room.glareTex.texture.offset, runtime.workstation.panelEdge.material.color]);
      runtime.aboutBoard.boardPinGlints.forEach((glint) => gsap.killTweensOf(glint.material));
      runtime.animation.ro.disconnect();
      runtime.animation.perfReadout?.remove();
      window.removeEventListener("resize", runtime.animation.resize);
      runtime.animation.densityQuery?.removeEventListener("change", runtime.animation.onDensityChange);
      window.visualViewport?.removeEventListener("resize", runtime.animation.resize);
      window.removeEventListener("keydown", runtime.keyboard.onKeyDown);
      window.removeEventListener("keyup", runtime.keyboard.onKeyUp);
      window.removeEventListener("keydown", runtime.keyboard.onKonami);
      runtime.textInput.typer.removeEventListener("input", runtime.textInput.onTyperInput);
      runtime.textInput.typer.removeEventListener("keydown", runtime.textInput.onTyperKey);
      runtime.textInput.typer.remove();
      runtime.swordEffects.impactFlash.remove();
      runtime.core.renderer.domElement.removeEventListener("wheel", runtime.chat.onWheel);
      runtime.core.renderer.domElement.removeEventListener("wheel", runtime.projectFiles.onWheel);
      runtime.core.renderer.domElement.removeEventListener("wheel", runtime.touch.onPinchWheel, { capture: true });
      ["pointerdown", runtime.touch.onTouchDown, "pointermove", runtime.touch.onTouchMove, "pointerup", runtime.touch.onTouchUp, "pointercancel", runtime.touch.onTouchUp].forEach((v, i, a) => {
        if (i % 2 === 0) runtime.core.renderer.domElement.removeEventListener(v, a[i + 1], { capture: true });
      });
      runtime.core.renderer.domElement.removeEventListener("pointermove", runtime.pointer.onPointerMove);
      runtime.core.renderer.domElement.removeEventListener("pointerdown", runtime.pointer.onPointerDown);
      runtime.core.renderer.domElement.removeEventListener("pointerup", runtime.pointer.onPointerUp);
      runtime.core.renderer.domElement.removeEventListener("pointerleave", runtime.pointer.onPointerLeave);
      runtime.core.renderer.domElement.removeEventListener("pointercancel", runtime.pointer.onPointerCancel);
      runtime.core.renderer.domElement.removeEventListener("lostpointercapture", runtime.pointer.onPointerCancel);
      window.removeEventListener("blur", runtime.pointer.onWindowBlur);
      runtime.core.scene.traverse((o) => gsap.killTweensOf([o.position, o.rotation, o.scale]));
      runtime.aboutBoard.boardNotes.forEach((note) => gsap.killTweensOf([note.ring.material, note.pinShadow.material, note.shadow.material]));
      runtime.core.disposables.forEach((d) => d.dispose?.());
      runtime.core.sun.shadow.dispose();
      runtime.windowLighting.windowLight.shadow.dispose();
      runtime.lamp.lampLight.shadow.dispose();
      runtime.swordEffects.swordSpotlight.shadow.dispose();
      runtime.room.neonLights.forEach(({ light }) => light.shadow?.dispose());
      runtime.core.composer.passes.forEach((pass) => pass.dispose?.());
      runtime.core.composer.dispose();
      if (runtime.core.gpuQuery) runtime.core.gl.deleteQuery(runtime.core.gpuQuery);
      runtime.core.renderer.dispose();
      runtime.core.renderer.domElement.remove();
    },
  };
}
