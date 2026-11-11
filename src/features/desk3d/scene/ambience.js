import { createAmbience, lightningFlash } from "../ambience";

export function createAmbienceScene(runtime) {
  // ---------- the world outside, heard through the window ----------
  // Follows the part of the day, the rain, the window (open, it's louder and brighter) and the
  // music (playing, it steps back). Lightning lights the window up before its thunder.
  let on = runtime.options.ambience !== false;
  let struckAt = -Infinity;
  const engine = createAmbience({ onLightning: () => { struckAt = performance.now(); } });
  runtime.room.outside.flash = 0;

  // No frames come while the tab is hidden, so the beds would carry on at their last level
  const onVisibility = () => {
    if (document.hidden) engine.hush();
  };
  document.addEventListener("visibilitychange", onVisibility);

  function update(now) {
    runtime.room.outside.flash = lightningFlash(now - struckAt);
    engine.update({
      part: runtime.room.dayPart(),
      rain: runtime.room.outside.rain,
      windowOpen: runtime.windowLighting.isWindowOpen(),
      music: runtime.workstation.lofi.playing,
      on,
      muted: runtime.workstation.soundMuted,
      hidden: document.hidden,
    });
  }

  function setAmbience(enabled) {
    on = enabled !== false;
  }

  function destroy() {
    document.removeEventListener("visibilitychange", onVisibility);
    engine.destroy();
  }

  return {
    update,
    setAmbience,
    destroy,
    get on() { return on; },
  };
}
