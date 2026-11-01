import * as THREE from "three";
import gsap from "gsap";
import { loadPortrait, windowSky, drawWoodTop, drawWoodFloor, drawWallPaint, WALL_MATERIALS } from "../textures";
import { WOODS, PART_PATTERNS, DEFAULT_WOODS, SPEAKER_FINISHES, FLOOR_LAYOUTS, DEFAULT_FLOOR, DEFAULT_FRAME_PAINT } from "../woods";
import { TIME_MODES, partFor } from "../daylight";
import { PALETTES } from "../sceneConfig";

export function createTheme(runtime) {
  // ---------- textures (redrawn once the web fonts are in, and every minute for the clocks) ----------
  function drawAll() {
    runtime.core.redrawers.forEach((redraw) => redraw());
    runtime.workstation.redrawTerminal();
  }
  drawAll();
  Promise.all([
    document.fonts.load("800 40px 'Lexend Mega'"),
    document.fonts.load("700 20px 'Space Grotesk'"),
    document.fonts.load("500 20px 'Space Grotesk'"),
    document.fonts.load("600 30px 'Caveat'"),
  ])
    .then(() => !runtime.core.destroyed && drawAll())
    .catch(() => {});
  // The real photo for the badge (initials stand in until it arrives).
  loadPortrait(`${process.env.BASE_URL}images/oka-portrait.png`)
    .then(() => !runtime.core.destroyed && drawAll())
    .catch(() => {});
  const clockTimer = setInterval(() => {
    runtime.badge.badgeFront.userData.tex.redraw();
    runtime.wallDecor.updateRoomClock();
  }, 60000);

  // ---------- theme ----------
  let darkNow = runtime.options.dark;
  // The walls' paint is the visitor's pick (graphite by default); by night it is tinted by the
  // moonlight the white walls used to be given directly
  // A brick or slatted wall shows its own colours, so the paint is left off it
  const wallPaintColor = new THREE.Color(runtime.options.wallColor);
  const WHITE = new THREE.Color("#ffffff");
  let wallChoice = { pattern: "plain", ...runtime.options.wallPattern };
  const MOONLIT_WALLS = [[runtime.room.backWallMat, new THREE.Color("#d6d3e6")], [runtime.room.sideWallMat, new THREE.Color("#c9c5dc")]];
  function paintWalls(isDark) {
    MOONLIT_WALLS.forEach(([mat, moon]) => {
      mat.color.copy(WALL_MATERIALS.includes(wallChoice.pattern) ? WHITE : wallPaintColor);
      if (isDark) mat.color.multiply(moon);
    });
  }
  // The desk, its riser, the window frame and the game shelf can each be any of the woods, in
  // any cut. Each material keeps its tone relative to oak's tint (the shelf's back still reads
  // deeper than its sides), and only the desk and its riser are dimmed for the night shift, as
  // they always were.
  const lightDesk = new THREE.Color(PALETTES.light.desk);
  const darkDesk = new THREE.Color(PALETTES.dark.desk);
  const NIGHT_WOOD = new THREE.Color(darkDesk.r / lightDesk.r, darkDesk.g / lightDesk.g, darkDesk.b / lightDesk.b);
  const oakTint = new THREE.Color(WOODS.oak.tint);
  const woodMat = (mat, base, shade = 1) => {
    const rel = new THREE.Color(base);
    rel.setRGB((rel.r / oakTint.r) * shade, (rel.g / oakTint.g) * shade, (rel.b / oakTint.b) * shade);
    return { mat, rel };
  };
  const woodParts = {
    desk: { grain: runtime.room.deskWood, mats: [woodMat(runtime.room.deskMat, PALETTES.light.desk)], nightly: true },
    riser: {
      grain: runtime.workstation.riserGrain,
      mats: [woodMat(runtime.workstation.riserMat, PALETTES.light.desk), woodMat(runtime.workstation.riserLegMat, PALETTES.light.desk, runtime.workstation.RISER_LEG_SHADE)],
      nightly: true,
    },
    speakers: { grain: runtime.workstation.speakerGrain, mats: [woodMat(runtime.workstation.speakerWoodMat, "#f3d3b0")] },
    window: { grain: runtime.room.frameGrainTex, mats: [woodMat(runtime.room.frameWood, "#f0c7a0")] },
    shelf: {
      grain: runtime.shelf.shelfWood,
      mats: [woodMat(runtime.shelf.shelfMat, "#f3d3b0"), woodMat(runtime.shelf.shelfBackMat, "#d9a878"), woodMat(runtime.shelf.lipMat, "#f3d3b0")],
    },
  };
  const pickWood = (part, choice = {}) => ({
    wood: WOODS[choice.wood] ? choice.wood : DEFAULT_WOODS[part].wood,
    pattern: PART_PATTERNS[part].includes(choice.pattern) ? choice.pattern : DEFAULT_WOODS[part].pattern,
    ...(part === "speakers" ? { finish: SPEAKER_FINISHES[choice.finish] ? choice.finish : "wood" } : {}),
    ...(part === "window" ? { paint: /^#[0-9a-f]{6}$/i.test(choice.paint || "") ? choice.paint : DEFAULT_FRAME_PAINT } : {}),
  });
  const woodChoice = Object.fromEntries(Object.keys(woodParts).map((part) => [part, pickWood(part, runtime.options.woods[part])]));
  function toneWood(part, isDark) {
    const { mats, nightly } = woodParts[part];
    const tint = new THREE.Color(WOODS[woodChoice[part].wood].tint);
    // Paint shows as it was picked, not toned like the wood under it
    if (woodChoice[part].pattern === "painted") return mats.forEach(({ mat }) => mat.color.set("#ffffff"));
    mats.forEach(({ mat, rel }) => {
      mat.color.copy(rel).multiply(tint);
      if (nightly && isDark) mat.color.multiply(NIGHT_WOOD);
    });
  }
  function setTheme(isDark) {
    darkNow = isDark;
    runtime.core.roomLight.night = isDark ? 1 : 0;
    runtime.room.deskNeons.forEach(({ strip, washMat }) => {
      strip.visible = isDark;
      washMat.opacity = isDark ? runtime.room.DESK_WASH : 0;
    });
    runtime.workstation.monitorGlowMat.opacity = isDark ? 0.7 : 0;
    runtime.core.ambient.intensity = isDark ? 0.16 : 0.38;
    runtime.core.ambient.color.set(isDark ? "#aab9df" : "#ffffff");
    runtime.core.skyFill.color.set(isDark ? "#94acdb" : "#f2f5ff");
    runtime.core.skyFill.intensity = isDark ? 0.12 : 0.9;
    runtime.core.readabilityFill.intensity = isDark ? 0.12 : 0.18;
    runtime.lamp.jointMat.color.set(isDark ? "#3d3749" : "#1a1714");
    runtime.core.sun.color.set(isDark ? "#aabfff" : "#fff1cc");
    // The sky through the window spreads faint soft shadows across the whole room, wall-mounted
    // objects included, outside the direct window patch. The key remains the direct beam.
    runtime.core.sun.intensity = (isDark ? 0.24 : 0.55) * runtime.core.SKY_REACH;
    runtime.core.sun.castShadow = true;
    runtime.windowLighting.windowLight.color.set(isDark ? "#94b5ff" : "#ffe5ad");
    // Sun or moon, it comes in through the glass, shadowed by the wall, the bars and the blind
    runtime.windowLighting.windowLight.intensity = isDark ? 0.18 : 2.2;
    runtime.windowLighting.windowLight.castShadow = true;
    if (isDark) runtime.windowLighting.aimWindowLight(windowSky("night").sun);
    // The neons' cube shadows only by night: by day the strips are off and the screen's glow
    // is faint, yet every pixel would still sample their six-sided maps
    runtime.room.shadowedNeons.forEach((light) => (light.castShadow = isDark));
    runtime.windowBlind.blindFabric.emissiveIntensity = isDark ? 0.03 : 0.2;
    runtime.room.floorMat.color.set(isDark ? "#8a82a6" : "#ffffff");
    // Night keeps the visitor's paint, just moonlit, so the room still reads as the same room
    paintWalls(isDark);
    runtime.core.scene.background = new THREE.Color(runtime.room.roomBackground(isDark));
    runtime.room.trimMat.color.set(isDark ? "#b8b1da" : "#ffffff");
    if (runtime.room.diorama) runtime.room.drawBackdrop();
    runtime.room.windowView.userData.tex.redraw();
    runtime.lamp.familyPhoto.userData.tex.redraw();
    runtime.workstation.setLightbar(isDark);
    runtime.lamp.setLamp(isDark);
    runtime.workstation.updateLightbar();
    const p = isDark ? PALETTES.dark : PALETTES.light;
    toneWood("desk", isDark);
    toneWood("riser", isDark);
    runtime.core.shadowFill.color.set(p.shadow);
    if (!isDark) applyDaylight();
    // Prints (the folders, the clock's dial, the painting, the About board, the backboard...)
    // glow to stay readable by day; by dusk and night that glow would make them the brightest
    // things in the room, so they settle into the room's own light
    const part = isDark ? "night" : runtime.room.daylightPart;
    runtime.core.printGlow.level = PRINT_GLOW[part];
    runtime.wastebasket.net.material.color.setScalar(HOOP_NET[part]);
  }
  const PRINT_GLOW = { morning: 0.6, day: 0.6, evening: 0.22, night: 0.08 };
  const HOOP_NET = { morning: 1, day: 1, evening: 0.62, night: 0.4 };
  // Match the randomly selected sky: warm morning, bright midday or amber evening.
  const DAYLIGHT = {
    // Warm key, cool fill: the sky's blue lifts what the sun can't reach, so shadows read as
    // cool shade rather than a grey film, at no extra cost (only colours and a little more key)
    // The wall keeps the sun's direct light to the window's patch (`pane`), so the room's sun
    // is the softer daylight about the room, without adding a second set of direct shadows
    morning: { sun: "#ffe2b6", sunPower: 1.1, sky: "#fff5e7", skyPower: 1.55, ambient: 0.62, fill: "#fff4e8", pane: "#ffdfa8", panePower: 3.0 },
    day: { sun: "#fff1cc", sunPower: 1.3, sky: "#f2f5ff", skyPower: 1.85, ambient: 0.78, fill: "#eef1ff", pane: "#ffe5ad", panePower: 4.1 },
    // the view's sun rises on the front side of the window and sets on the back side, so the
    // room's evening sun comes in from behind. Its low beam meets the desk at a slant (under
    // half the strength a square-on one gives), so the pane runs stronger to keep the golden
    // streak across the desk showing
    evening: { sun: "#ff9e66", sunPower: 1.0, sky: "#b7aed7", skyPower: 0.38, ambient: 0.16, fill: "#c3b9de", pane: "#ffab72", panePower: 3.6 },
  };
  function applyDaylight() {
    const light = DAYLIGHT[runtime.room.daylightPart];
    runtime.core.sun.color.set(light.sun);
    runtime.core.sun.intensity = light.sunPower * (runtime.room.daylightPart === "evening" ? 0.3 : 0.5) * runtime.core.SKY_REACH;
    runtime.core.skyFill.color.set(light.sky);
    runtime.core.skyFill.intensity = light.skyPower;
    runtime.core.ambient.intensity = light.ambient;
    runtime.core.ambient.color.set(light.fill);
    runtime.core.readabilityFill.intensity = runtime.room.daylightPart === "evening" ? 0.18 : 0.32;
    runtime.windowLighting.windowLight.color.set(light.pane);
    runtime.windowLighting.windowLight.intensity = light.panePower;
    runtime.windowLighting.aimWindowLight(windowSky(runtime.room.daylightPart).sun);
  }
  // Capture existing theme targets, then blend them in the frame loop. No extra tween owns
  // these values, so a second theme change can start from exactly what is currently visible.
  const lightingValues = [
    [runtime.core.ambient, "intensity"], [runtime.core.skyFill, "intensity"], [runtime.core.readabilityFill, "intensity"],
    [runtime.core.sun, "intensity"], [runtime.windowLighting.windowLight, "intensity"], [runtime.lamp.lampLight, "intensity"],
    [runtime.core.roomLight, "night"], [runtime.workstation.monitorGlowMat, "opacity"], [runtime.windowBlind.blindFabric, "emissiveIntensity"],
    [runtime.core.printGlow, "level"],
    ...runtime.room.deskNeons.map(({ washMat }) => [washMat, "opacity"]),
  ];
  const lightingColors = [runtime.core.ambient.color, runtime.core.skyFill.color, runtime.core.sun.color, runtime.windowLighting.windowLight.color,
    runtime.lamp.jointMat.color, runtime.room.floorMat.color, runtime.room.backWallMat.color, runtime.room.sideWallMat.color, runtime.room.trimMat.color,
    runtime.room.deskMat.color, runtime.workstation.riserMat.color, runtime.workstation.riserLegMat.color, runtime.core.shadowFill.color,
    runtime.wastebasket.net.material.color];
  // Keep a stable background Color so it can be interpolated like the wall paint.
  setTheme(runtime.options.dark);
  lightingColors.push(runtime.core.scene.background);
  const captureLighting = () => ({
    values: lightingValues.map(([object, key]) => object[key]),
    colors: lightingColors.map((color) => color.clone()),
  });
  let lightingTarget = captureLighting();
  let lightingFrom = lightingTarget;
  let lightingStarted = -Infinity;
  // the window beam's aim when the change began, which it turns from
  let lightingAimFrom = null;
  const LIGHTING_TRANSITION = 2000;
  const rainLightColor = new THREE.Color("#aab8cf");
  const dryWindowColor = runtime.windowLighting.windowLight.color.clone();
  const glareDay = new THREE.Color("#8a94a6");
  const glareNight = new THREE.Color("#7a5530");
  let lightingBlending = false;
  function updateLighting(now) {
    const progress = Math.min(1, Math.max(0, (now - lightingStarted) / LIGHTING_TRANSITION));
    const blend = progress * progress * (3 - 2 * progress);
    runtime.room.outside.skyBlend = blend;
    lightingValues.forEach(([object, key], i) => {
      // Once settled, preserve the lamp's own click/flicker animation.
      if (object === runtime.lamp.lampLight && !lightingBlending) return;
      object[key] = THREE.MathUtils.lerp(lightingFrom.values[i], lightingTarget.values[i], blend);
    });
    lightingColors.forEach((color, i) => color.copy(lightingFrom.colors[i]).lerp(lightingTarget.colors[i], blend));
    // Clouds remove the direct beam much more than diffuse sky/bounce light.
    runtime.windowLighting.windowLight.intensity *= 1 - 0.88 * runtime.room.outside.rain;
    runtime.core.sun.intensity *= 1 - 0.6 * runtime.room.outside.rain;
    // The blind drawn down shuts out most of the sky's light, as it does the sun's
    runtime.core.sun.intensity *= THREE.MathUtils.lerp(0.25, 1, runtime.windowBlind.blind.lift);
    runtime.core.skyFill.intensity *= 1 - 0.38 * runtime.room.outside.rain;
    runtime.core.ambient.intensity *= 1 - 0.25 * runtime.room.outside.rain;
    // The sun (or moon) is half a degree across, so its shadows soften by about 1 cm for each
    // metre they fall: the widest spread, about the window bars' reach across the desk, still
    // stays crisp where a prop meets it (PCSS sizes the blur by distance). Overcast light loses
    // the outline altogether; indoor lamp/neon shadows stay intact.
    // (in texels of a 2048 map; a smaller map scales it down to the same blur)
    runtime.windowLighting.windowLight.shadow.radius = (THREE.MathUtils.lerp(12, 14, runtime.core.roomLight.night) + runtime.room.outside.rain * 16) * runtime.windowLighting.windowLight.shadow.mapSize.x / 2048;
    if (Math.abs(runtime.windowLighting.cookieRain - runtime.room.outside.rain) > 0.02) runtime.windowLighting.drawGlassCookie();
    dryWindowColor.copy(runtime.windowLighting.windowLight.color);
    runtime.windowLighting.windowLight.color.lerp(rainLightColor, runtime.room.outside.rain * 0.65);
    // The glass's reflection: a cool sheen by day (dulled under cloud), the lamp-lit room's
    // warmer, dimmer one by night
    const night = runtime.core.roomLight.night;
    runtime.room.windowGlare.material.color.copy(glareDay).lerp(glareNight, night).multiplyScalar(1 - 0.4 * runtime.room.outside.rain * (1 - night));
    runtime.room.outside.sky = windowSky(runtime.room.dayPart(), runtime.room.outside.skyFrom, blend);
    if (lightingBlending) {
      runtime.windowLighting.aimWindowLight(windowSky(runtime.room.dayPart()).sun, { aimFrom: lightingAimFrom, blend });
      runtime.lamp.lampLight.castShadow = true;
      if (progress === 1) {
        lightingBlending = false;
        runtime.lamp.lampLight.castShadow = darkNow;
      }
    }
    if (!lightingBlending) {
      runtime.room.deskNeons.forEach(({ strip }) => (strip.visible = darkNow));
      runtime.room.shadowedNeons.forEach((light) => (light.castShadow = darkNow));
    }
    runtime.lamp.updateLampGlow();
    runtime.workstation.updateLightbar();
  }
  // The room keeps to the visitor's own clock, or to the part of the day they picked. It looks
  // every half minute and moves on only when that part changes, so the lamp or the coffee can
  // still switch it by hand until then; the visitor's weather is checked on the same beat (it
  // fetches at most every quarter hour). A local phase preview stays put.
  let timeMode = TIME_MODES[runtime.options.time] ? runtime.options.time : "auto";
  let shownPart = partFor(timeMode);
  let nextDaylightAt = 0;
  function updateDaylight(now) {
    if (runtime.room.daylightParts.includes(runtime.core.previewTime) || now < nextDaylightAt) return;
    nextDaylightAt = now + 30000;
    runtime.weather.refreshWeather();
    const part = partFor(timeMode);
    if (part !== shownPart) showPart(part);
  }
  function showPart(part) {
    shownPart = part;
    if (part !== "night") runtime.room.daylightPart = part;
    const wasDark = darkNow;
    setRoomTheme(part === "night");
    if (wasDark !== darkNow) runtime.options.onEvent("nightShift", { dark: darkNow });
  }
  function setTime(mode) {
    timeMode = TIME_MODES[mode] ? mode : "auto";
    showPart(partFor(timeMode));
  }
  // A new paint goes straight on: both ends of any running blend take it, so the frame loop
  // doesn't lerp it back
  // A new pattern (or brick, or slats' wood) is drawn over the same tile; both walls' textures
  // share its canvas. Like a new paint it goes straight on: both ends of any running blend take it,
  // so the frame loop doesn't lerp it back
  function setWallPattern(choice) {
    wallChoice = { ...wallChoice, ...choice };
    const { canvas, ctx, texture } = runtime.room.wallPaint;
    drawWallPaint(ctx, canvas.width, canvas.height, wallChoice.pattern, wallChoice);
    texture.needsUpdate = runtime.room.sideWallPaint.needsUpdate = true;
    repaintWalls();
  }
  function setWallColor(hex) {
    wallPaintColor.set(hex);
    repaintWalls();
  }
  function repaintWalls() {
    paintWalls(darkNow);
    MOONLIT_WALLS.forEach(([mat]) => {
      const at = lightingColors.indexOf(mat.color);
      [lightingFrom, lightingTarget].forEach((state) => state.colors[at].copy(mat.color));
    });
  }
  // A new wood is drawn into the part's grain and toned at once; like the paint, both ends of a
  // running blend take it
  function setWood(part, choice) {
    if (!woodParts[part]) return;
    woodChoice[part] = pickWood(part, { ...woodChoice[part], ...choice });
    if (part === "speakers" && !choice.finish && (choice.wood || choice.pattern)) woodChoice[part].finish = "wood";
    paintWood(part, true);
  }
  function paintWood(part, redraw) {
    const target = woodParts[part];
    if (redraw) {
      const { canvas, ctx } = target.grain;
      drawWoodTop(ctx, canvas.width, canvas.height, { ...woodChoice[part], ...(part === "window" ? { knots: 14 } : {}) });
      target.grain.texture.needsUpdate = true;
      // the shelf's lips hold their own copy of its grain
      if (part === "shelf") runtime.shelf.lipMat.map.needsUpdate = true;
    }
    const mats = target.mats.map(({ mat }) => mat);
    if (part === "speakers") {
      // The side panels keep their grain either way: toned to the wood, or stained for the
      // black model, whose grey shell and baffle darken with it
      const finish = SPEAKER_FINISHES[woodChoice.speakers.finish];
      if (finish.color) runtime.workstation.speakerWoodMat.color.set(finish.color);
      else toneWood(part, darkNow);
      runtime.workstation.speakerShellMat.color.set(finish.shell);
      runtime.workstation.speakerBaffleMat.color.set(finish.baffle);
      mats.push(runtime.workstation.speakerShellMat, runtime.workstation.speakerBaffleMat);
    } else toneWood(part, darkNow);
    mats.forEach((mat) => {
      const at = lightingColors.indexOf(mat.color);
      if (at >= 0) [lightingFrom, lightingTarget].forEach((state) => state.colors[at].copy(mat.color));
    });
  }
  // Each grain was first drawn in its part's default wood, so only a visitor's own pick is drawn
  // again; every part is toned to its wood either way
  Object.keys(woodParts).forEach((part) => {
    const { wood, pattern } = woodChoice[part];
    paintWood(part, wood !== DEFAULT_WOODS[part].wood || pattern !== DEFAULT_WOODS[part].pattern);
  });
  // The floor is painted in its wood's own colours, so a new pick is only drawn again; it was
  // first drawn in the default floor
  const pickFloor = (choice = {}) => ({
    wood: WOODS[choice.wood] ? choice.wood : DEFAULT_FLOOR.wood,
    layout: FLOOR_LAYOUTS[choice.layout] ? choice.layout : DEFAULT_FLOOR.layout,
  });
  let floorChoice = pickFloor(runtime.options.floor);
  function paintFloor() {
    const { canvas, ctx } = runtime.room.floorWood;
    drawWoodFloor(ctx, canvas.width, canvas.height, floorChoice);
    runtime.room.floorWood.texture.needsUpdate = true;
  }
  function setFloor(choice) {
    floorChoice = pickFloor({ ...floorChoice, ...choice });
    paintFloor();
  }
  if (floorChoice.wood !== DEFAULT_FLOOR.wood || floorChoice.layout !== DEFAULT_FLOOR.layout) paintFloor();
  // The monitor's desktop follows the room
  const setRoomTheme = (isDark) => {
    // Back from the night shift, the window shows the part of the day it's set to (by the clock
    // in auto), or the morning when that part is the night itself
    if (isDark) runtime.room.daylightPart = "night";
    else if (runtime.room.daylightPart === "night") runtime.room.daylightPart = partFor(timeMode) === "night" ? "morning" : partFor(timeMode);
    // Remove rain (and the blind's hold on the sky) from the captured intensities;
    // updateLighting applies them once.
    const blindSky = THREE.MathUtils.lerp(0.25, 1, runtime.windowBlind.blind.lift);
    const rainScales = [1 - 0.25 * runtime.room.outside.rain, 1 - 0.38 * runtime.room.outside.rain, 1, (1 - 0.6 * runtime.room.outside.rain) * blindSky, 1 - 0.88 * runtime.room.outside.rain];
    const from = captureLighting();
    from.colors[lightingColors.indexOf(runtime.windowLighting.windowLight.color)].copy(dryWindowColor);
    rainScales.forEach((scale, i) => (from.values[i] /= scale));
    runtime.room.outside.skyFrom = runtime.room.outside.sky;
    lightingAimFrom = { ...runtime.windowLighting.aimNow };
    const background = runtime.core.scene.background;
    const neonShadows = isDark || runtime.room.shadowedNeons.some((light) => light.castShadow);
    const lightbarPower = runtime.workstation.lightbarState.power;
    setTheme(isDark);
    // the monitor's bar fades with the room, from wherever it was
    runtime.workstation.lightbarState.power = lightbarPower;
    runtime.workstation.setLightbar(isDark, LIGHTING_TRANSITION / 1000);
    runtime.room.shadowedNeons.forEach((light) => (light.castShadow = neonShadows));
    background.copy(runtime.core.scene.background);
    runtime.core.scene.background = background;
    lightingTarget = captureLighting();
    lightingFrom = from;
    lightingStarted = performance.now();
    lightingBlending = true;
    gsap.killTweensOf(runtime.lamp.lampLight);
    runtime.room.deskNeons.forEach(({ strip }) => (strip.visible = true));
    lightingValues.forEach(([object, key], i) => (object[key] = from.values[i]));
    lightingColors.forEach((color, i) => color.copy(from.colors[i]));
    runtime.room.outside.skyBlend = 0;
    runtime.room.outside.night = isDark;
    runtime.room.windowView.userData.tex.redraw();
    runtime.shelf.setNeon(isDark);
    runtime.cat.catSettle();
    runtime.workstation.desktop.setTheme(isDark);
    runtime.workstation.redrawScreen();
  };
  runtime.workstation.desktop.setTheme(runtime.options.dark);

  // Public state used by the other scene parts.
  return {
    get darkNow() { return darkNow; },
    lightingColors,
    get lightingFrom() { return lightingFrom; },
    get lightingTarget() { return lightingTarget; },
    DAYLIGHT,
    get lightingBlending() { return lightingBlending; },
    updateDaylight,
    setTime,
    updateLighting,
    setRoomTheme,
    setWallColor,
    setWallPattern,
    setWood,
    setFloor,
    clockTimer,
  };
}
