import * as THREE from "three";
import gsap from "gsap";
import { setRainLevel, sfx } from "@/shared/composables/useSfx";
import { createToonBatch } from "../toonBatch";
import { benchmark, lowPower, VIEW_W, VIEW_H } from "../sceneConfig";
import { SCREEN_W, SCREEN_H } from "../desktop";

export function createAnimation(runtime) {
  // ---------- sizing & loop ----------
  let viewH = VIEW_H;
  // Render at the screen's real pixel density, including browser zoom (which changes
  // devicePixelRatio) and pinch zoom (visualViewport.scale), so edges stay sharp when zoomed in.
  // Capped, so a deep pinch doesn't ask for an enormous canvas. Phones stop at 1.5×: their 3×
  // screens would otherwise shade four times the pixels for a difference the small screen hides.
  const pixelRatio = () => Math.min(window.devicePixelRatio * (window.visualViewport?.scale || 1), lowPower ? 1.5 : 3);
  // Outlines keep a steady width in CSS pixels (see outlineMat), which on a phone's small screen
  // makes them heavy against the props: there they are thinned twice over. Once for the screen
  // (cubed, so a 375 px phone draws them at ~0.24 while anything 600 px and up keeps full
  // weight), and again for how far out the room is drawn (screen pixels per world unit, pinch
  // and close-ups included), so the whole room at ~9 px a unit doesn't drown a shelf board two
  // pixels thick, while a desktop's overview (~24 px a unit) and anything nearer keep it all.
  // On a phone the base every line shares shrinks too (2.2 px to ~0.4 on a 375 px screen), so
  // a small prop's line (a controller, a Rubik's cube) thins with the prop instead of inking it
  // as heavily as a bookcase; the weight is evened back up so a furniture-weight line (0.025)
  // stays as it was.
  const OUTLINE_FULL_AT = 24;
  const FURNITURE_LINE = 0.025 * 30;
  function fitOutlines() {
    const w = runtime.options.container.clientWidth || 1;
    const h = runtime.options.container.clientHeight || 1;
    const screenFit = Math.min(Math.min(w, h) / 600, 1);
    const zoomFit = Math.min((h * runtime.core.camera.zoom) / viewH / OUTLINE_FULL_AT, 1);
    const base = 0.3 + 1.9 * screenFit ** 6;
    const even = (2.2 + FURNITURE_LINE) / (base + FURNITURE_LINE);
    const outlineScale = Math.max(screenFit ** 3 * zoomFit ** 0.75, 0.18) * even;
    runtime.core.outlineBase.value = base;
    runtime.core.outlineResolution.value.set(w / outlineScale, h / outlineScale);
  }
  function resize() {
    const w = runtime.options.container.clientWidth || 1;
    const h = runtime.options.container.clientHeight || 1;
    const density = pixelRatio();
    runtime.core.renderer.setPixelRatio(density);
    const aspect = w / h;
    // Portrait screens see the room as a diorama (see DIORAMA)
    if ((aspect < 1) !== runtime.room.diorama) runtime.room.setDiorama(aspect < 1);
    else if (runtime.room.diorama) runtime.room.drawBackdrop();
    // Keep desk props large enough to tap while the room fills the rest of the screen.
    viewH = Math.max(VIEW_H, (aspect < 1 ? 18 : VIEW_W) / aspect);
    runtime.core.camera.left = (-viewH * aspect) / 2;
    runtime.core.camera.right = (viewH * aspect) / 2;
    runtime.core.camera.top = viewH / 2;
    runtime.core.camera.bottom = -viewH / 2;
    runtime.core.camera.updateProjectionMatrix();
    runtime.core.renderer.setSize(w, h, false);
    sizeComposer();
    fitOutlines();
    if (!intro?.isActive()) runtime.camera.applyShot(true);
    runtime.camera.clampUserView();
  }

  // Match the canvas at every zoom/density. Slow frames must never lower image sharpness.
  const refreshMs = 1000 / 60;
  let frameMs = 16;
  const postDensity = () => runtime.core.renderer.getPixelRatio();
  function sizeComposer() {
    // At 2× and up the pixels are small enough to hide stair-steps, and multisampling a Retina
    // frame costs more memory traffic than an integrated GPU can spare
    const samples = postDensity() >= 2 ? 0 : 4;
    [runtime.core.composer.renderTarget1, runtime.core.composer.renderTarget2].forEach((target) => {
      if (target.samples === samples) return;
      target.samples = samples;
      target.dispose();
    });
    runtime.core.composer.setPixelRatio(postDensity());
    runtime.core.composer.setSize(runtime.options.container.clientWidth || 1, runtime.options.container.clientHeight || 1);
  }
  // `?perf` in the address shows the frame rate and what the quality has settled on
  const perfReadout = new URLSearchParams(window.location.search).has("perf") ? document.createElement("div") : null;
  if (perfReadout) {
    perfReadout.style.cssText = "position:absolute;right:8px;bottom:8px;z-index:50;padding:4px 8px;font:12px/1.4 ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.7);border-radius:4px;pointer-events:none;white-space:pre";
    runtime.options.container.appendChild(perfReadout);
    runtime.core.timers.push(setInterval(() => {
      const neonShadows = runtime.room.shadowedNeons.some((light) => light.castShadow);
      const intervals = [...frameIntervals].sort((a, b) => a - b);
      const p95 = intervals[Math.min(intervals.length - 1, Math.floor(intervals.length * 0.95))] || 0;
      perfReadout.textContent = `${(1000 / frameMs).toFixed(0)} fps (budget ${(1000 / refreshMs).toFixed(0)}) · resolution locked\npost ${postDensity().toFixed(2)}× · AO ${runtime.core.aoPass.enabled ? "on" : "off"} · neon shadows ${neonShadows ? "on" : "off"}${lowPower ? " · low power" : ""}${probeMs === null ? "" : ` · probe ${probeMs.toFixed(1)}ms`}\n${runtime.core.drawCalls.toFixed(0)} draws · ${(runtime.core.triangles / 1000).toFixed(0)}k triangles\nCPU submit ${runtime.core.renderMs.toFixed(1)}ms · GPU ${runtime.core.gpuMs === null ? "n/a" : runtime.core.gpuMs.toFixed(1) + "ms"} · frame p95 ${p95.toFixed(1)}ms${benchmark ? " · " + benchmark : ""}`;
    }, 500));
  }


  // Shadow samplers share the fragment-stage limit with printed textures, toon ramps and
  // bump maps. Reserve those slots before enabling shadows, including close-up-only lights.
  const materialMapKeys = ["map", "emissiveMap", "gradientMap", "bumpMap", "normalMap", "alphaMap", "aoMap", "lightMap", "roughnessMap", "metalnessMap", "envMap"];
  let materialTextureSlots = 0;
  runtime.core.scene.traverse((object) => {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (!material?.isMeshToonMaterial && !material?.isMeshStandardMaterial) return;
      materialTextureSlots = Math.max(materialTextureSlots, materialMapKeys.filter((key) => material[key]?.isTexture).length);
    });
  });
  const shadowLights = [...new Set([runtime.swordEffects.swordSpotlight, runtime.windowLighting.windowLight, runtime.core.sun, runtime.lamp.lampLight, runtime.workstation.lightbarLight, runtime.shelf.signLight, runtime.workstation.screenLight, ...runtime.room.shadowedNeons])];
  const lightTextureSlots = shadowLights.filter((light) => light.map).length;
  const shadowTextureLimit = Math.max(0, runtime.core.renderer.capabilities.maxTextures - materialTextureSlots - lightTextureSlots);
  const decorativeShadows = new Set(runtime.room.shadowedNeons);
  // Phones go without the neon and strip shadows from the start; others may shed them later
  // (see judgeQuality)
  let decorShed = lowPower;
  // Every lit shader is built for the number of shadowed lights, so a light gaining or losing
  // its shadow recompiles them all: a freeze of seconds where ANGLE translates them to HLSL
  // (Chrome on Windows). So the set follows only the night's decorative shadows, never a light's
  // own brightness: a dark lamp or sword key keeps its map and sampler, and the shader skips it
  // (its colour is black), drawing its map again only once it's lit (see tick).
  const decorWanted = () => !decorShed && (runtime.theme.darkNow || runtime.theme.lightingBlending);
  function updateShadowBudget(decor = decorWanted()) {
    let available = shadowTextureLimit;
    shadowLights.forEach((light) => {
      const enabled = (!decorativeShadows.has(light) || decor) && available > 0;
      if (enabled) available--;
      if (enabled && !light.castShadow && light.intensity > 0) light.shadow.needsUpdate = true;
      light.castShadow = enabled;
    });
  }

  // When the room can't keep up while it moves (when smoothness shows), the costliest optional
  // work goes, one step at a time and never back: first the ambient occlusion, then the
  // decorative shadows. Sharpness is never part of it (see resize).
  let judgeAfter = Infinity;
  let judged = 0;
  let slowFrames = 0;
  const canShed = () => runtime.core.aoPass.enabled || !decorShed;
  function shedStep() {
    if (runtime.core.aoPass.enabled) runtime.core.aoPass.enabled = false;
    else decorShed = true;
  }
  function judgeQuality(now, interval, moving) {
    if (benchmark || probe || !moving || !interval || now < judgeAfter || !canShed()) return;
    judged++;
    // under 30 fps
    if (interval > 34) slowFrames++;
    if (judged < 90) return;
    const slow = slowFrames > judged / 4;
    judged = slowFrames = 0;
    if (!slow) return;
    shedStep();
    // give the lighter frame a moment to settle before judging it
    judgeAfter = now + 2000;
  }

  // The same judgement, made before anyone sees the room: behind the loader a few frames are
  // drawn back to back and each is waited out on the GPU. Too slow, and a step is shed and the
  // room timed again, so the visitor walks into a room that already runs smoothly. The first
  // frames of each round only warm up (shaders compile after a step changes the lighting).
  const PROBE_WARMUP = 3;
  const PROBE_FRAMES = 12;
  const PROBE_ROUNDS = 3;
  const PROBE_SLOW_MS = 22;
  const probePixel = new Uint8Array(4);
  let probe = benchmark ? null : { frame: 0, round: 0, costs: [] };
  let probeMs = null;
  function stepProbe(started) {
    const gl = runtime.core.renderer.getContext();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, probePixel);
    if (++probe.frame > PROBE_WARMUP) probe.costs.push(performance.now() - started);
    const length = PROBE_WARMUP + PROBE_FRAMES;
    runtime.options.onEvent("loading", { progress: (probe.round * length + probe.frame) / (PROBE_ROUNDS * length) });
    if (probe.costs.length < PROBE_FRAMES) return;
    probeMs = probe.costs.sort((a, b) => a - b)[PROBE_FRAMES >> 1];
    if (probeMs > PROBE_SLOW_MS && canShed() && probe.round < PROBE_ROUNDS - 1) {
      shedStep();
      probe = { frame: 0, round: probe.round + 1, costs: [] };
      return;
    }
    probe = null;
    runtime.options.onEvent("loading", { progress: 1 });
    runtime.options.onEvent("ready");
  }

  let frame = null;
  let lastBlink = 0;
  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const target = new THREE.Vector3();
  const viewRight = new THREE.Vector3();
  const viewUp = new THREE.Vector3();
  // A still room redraws at the display's pace, or about 30 fps on phones
  const idleMs = refreshMs * (lowPower ? 1.7 : 0.7);
  let lastTick = 0;
  let mainShadowAt = 0;
  let aoFreshAt = 0;
  const aoCamPos = new THREE.Vector3();
  const aoCamTurn = new THREE.Quaternion();
  let aoCamZoom = 0;
  const frameIntervals = [];
  const updateToonBatch = benchmark === "no-batch" ? () => {} : createToonBatch(runtime.core.scene, runtime.core.renderer, runtime.core.track);
  [runtime.core.sun, runtime.windowLighting.windowLight, runtime.lamp.lampLight, runtime.workstation.lightbarLight].forEach((light) => {
    light.shadow.autoUpdate = false;
    light.shadow.needsUpdate = true;
  });
  function tick(now) {
    frame = requestAnimationFrame(tick);
    if (document.hidden) {
      lastTick = 0;
      frameIntervals.length = 0;
      return;
    }
    const fidgeting = runtime.cat.catIdleTl?.isActive();
    const acting = runtime.theme.lightingBlending || now < runtime.core.responsiveUntil || gsap.isTweening(runtime.camera.cam) || runtime.cat.catBusy || gsap.isTweening(runtime.windowBlind.blind) || runtime.mouse.mouseRunning || runtime.lamp.lampHopping || runtime.shelfCollectibles.trophyCelebrating || runtime.pointer.lanyardDrag || runtime.pointer.hatDrag || runtime.aboutBoard.noteDrag || runtime.pointer.shelfDrag || runtime.pointer.stickyDrag || runtime.pointer.chairDrag || gsap.isTweening(runtime.workstation.screenPower);
    const moving = acting || fidgeting;
    // Do not skip presentation frames during interaction. Idle uses a tolerant interval rather
    // than an accumulated deadline, which otherwise creates short/long frame pairs under jitter.
    // Phones stop at about 60 fps on 120 Hz screens, and the cat's idle fidgets go at the idle pace.
    const paceMs = probe ? 0 : lowPower ? (acting ? refreshMs * 0.7 : idleMs) : moving ? 0 : idleMs;
    if (lastTick && now - lastTick < paceMs) return;
    if (lastTick && perfReadout) {
      frameIntervals.push(now - lastTick);
      if (frameIntervals.length > 180) frameIntervals.shift();
    }
    // Step size for the springs, capped so a background tab doesn't fling them on return
    const dt = Math.min(0.05, lastTick ? (now - lastTick) / 1000 : 0.016);
    const interval = lastTick ? now - lastTick : 0;
    if (lastTick) frameMs += (now - lastTick - frameMs) * 0.05;
    lastTick = now;
    runtime.tickets.updateTicketHover(dt);
    runtime.swordRack.updateTassels(dt);
    runtime.swordEffects.updateFx(dt);
    runtime.swordEffects.updateTrail(dt);
    runtime.swordEffects.updateSpotlight(dt);
    // the chair stands between the camera and the tickets' close-up, so it's put away for it
    runtime.chair.chair.visible = runtime.camera.focus.name !== "experience";
    runtime.projectFiles.poseFolders();
    const pointerBlend = 1 - Math.pow(0.94, dt * 60);
    runtime.pointer.parallax.x += (runtime.pointer.parallax.tx - runtime.pointer.parallax.x) * pointerBlend;
    runtime.pointer.parallax.y += (runtime.pointer.parallax.ty - runtime.pointer.parallax.y) * pointerBlend;
    if (runtime.camera.focus.name === "shelf" && !runtime.pointer.shelfDrag && !gsap.isTweening(runtime.camera.cam)) {
      const shot = runtime.camera.SHOTS.shelf();
      const blend = 1 - Math.exp(-14 * dt);
      runtime.camera.cam.ty += (shot.target[1] - runtime.camera.cam.ty) * blend;
    }
    // Parallax shrinks as we zoom in so close-ups stay readable
    const sway = runtime.camera.focus.name === "about" ? 0 : 1 / Math.sqrt(runtime.camera.cam.zoom);
    dir.set(runtime.camera.cam.dx + runtime.pointer.parallax.x * 0.08 * sway, runtime.camera.cam.dy - runtime.pointer.parallax.y * 0.05 * sway, runtime.camera.cam.dz).normalize();
    target.set(runtime.camera.cam.tx, runtime.camera.cam.ty, runtime.camera.cam.tz);
    if (runtime.camera.userView.x || runtime.camera.userView.y) {
      // The pinch's pan, across the view: right is forward × up, and up is right × forward
      viewRight.crossVectors(WORLD_UP, dir).normalize();
      viewUp.crossVectors(dir, viewRight);
      target.addScaledVector(viewRight, runtime.camera.userView.x).addScaledVector(viewUp, runtime.camera.userView.y);
    }
    runtime.core.camera.position.copy(target).addScaledVector(dir, runtime.camera.CAM_DISTANCE);
    runtime.core.camera.up.copy(WORLD_UP);
    runtime.core.camera.lookAt(target);
    if (runtime.core.camera.zoom !== runtime.camera.cam.zoom * runtime.camera.userView.zoom || runtime.core.camera.near !== runtime.camera.cam.near) {
      runtime.core.camera.zoom = runtime.camera.cam.zoom * runtime.camera.userView.zoom;
      runtime.core.camera.near = runtime.camera.cam.near;
      runtime.core.camera.updateProjectionMatrix();
      fitOutlines();
    }
    if (runtime.room.diorama) {
      // The backdrop fills the view from just inside the far plane; the shadow sits a few
      // pixels down and to the right of the block it's cast by
      const halfW = (runtime.core.camera.right - runtime.core.camera.left) / 2 / runtime.core.camera.zoom;
      const halfH = (runtime.core.camera.top - runtime.core.camera.bottom) / 2 / runtime.core.camera.zoom;
      runtime.room.backdrop.position.copy(runtime.core.camera.position).addScaledVector(dir, -(runtime.core.camera.far - 2));
      runtime.room.backdrop.quaternion.copy(runtime.core.camera.quaternion);
      runtime.room.backdrop.scale.set(halfW * 2.02, halfH * 2.02, 1);
      // (the outline is taken square to the view, so the camera's sway leaves it as it is)
      viewRight.crossVectors(WORLD_UP, dir).normalize();
      viewUp.crossVectors(dir, viewRight);
      if (runtime.room.dioramaShadowFor !== runtime.camera.dioramaYaw) {
        runtime.room.dioramaShadowFor = runtime.camera.dioramaYaw;
        runtime.room.shapeDioramaShadow(viewRight, viewUp);
      }
      const nudge = (halfH * 2 / (runtime.options.container.clientHeight || 1)) * 10;
      runtime.room.dioramaShadow.quaternion.copy(runtime.core.camera.quaternion);
      runtime.room.dioramaShadow.position.copy(viewRight).multiplyScalar(nudge).addScaledVector(viewUp, -nudge)
        .addScaledVector(dir, (runtime.core.camera.position.dot(dir) - runtime.core.camera.far + 3));
    }
    // the occlusion starts over when the view has shifted at all, or anything's moving, and is
    // topped up a few times a second otherwise (see refreshAO)
    const viewMoved = runtime.core.camera.zoom !== aoCamZoom || runtime.core.camera.position.distanceToSquared(aoCamPos) > 1e-10 || 1 - Math.abs(runtime.core.camera.quaternion.dot(aoCamTurn)) > 1e-10;
    if (moving || viewMoved || now >= aoFreshAt) {
      runtime.core.refreshAO(moving || viewMoved);
      aoFreshAt = now + 1000 / 4;
      aoCamPos.copy(runtime.core.camera.position);
      aoCamTurn.copy(runtime.core.camera.quaternion);
      aoCamZoom = runtime.core.camera.zoom;
    }
    runtime.badge.updateLanyard(dt);
    runtime.shelf.updateShelfLeds(now);
    runtime.cat.updateCatWatch(now);
    runtime.cat.updateCatLife(now);
    runtime.cat.updateCatNeck();
    runtime.wallDecor.updateSecondHand();
    runtime.theme.updateDaylight(now);
    runtime.room.outside.t += dt;
    runtime.room.outside.rain += (runtime.room.outside.rainTarget - runtime.room.outside.rain) * Math.min(1, dt * 0.35);
    runtime.theme.updateLighting(now);
    if (Math.abs(runtime.room.outside.rain - (runtime.room.outside.heard ?? -1)) > 0.02) {
      runtime.room.outside.heard = runtime.room.outside.rain;
      setRainLevel(runtime.workstation.soundMuted ? 0 : runtime.room.outside.rain);
    }
    if (now - runtime.room.outside.drawnAt >= 1000 / 30) {
      runtime.room.outside.drawnAt = now;
      runtime.room.windowView.userData.tex.redraw();
    }
    runtime.plant.plant.rotation.z = Math.sin(now / 1400) * 0.015;
    runtime.coffee.updateSteam(now);
    runtime.lamp.updateLampGlow();
    runtime.robot.updateRobot(now);
    if (runtime.handheld.switchGame.live && now - runtime.handheld.switchDrawnAt > 40) {
      runtime.handheld.switchDrawnAt = now;
      runtime.handheld.switchGame.live = now / 1000 - runtime.handheld.switchGame.start <= runtime.handheld.SWITCH_GAME;
      runtime.handheld.switchScreen.userData.tex.redraw(runtime.handheld.switchGame.live ? now / 1000 : undefined);
    }
    runtime.plant.updateButterfly(dt, now);
    runtime.wastebasket.updatePapers(dt);
    if (!runtime.mouse.mouseRunning) {
      const blend = 1 - Math.pow(0.82, dt * 60);
      runtime.mouse.mouse.position.x += (runtime.mouse.mouseAim.x - runtime.mouse.mouse.position.x) * blend;
      runtime.mouse.mouse.position.z += (runtime.mouse.mouseAim.z - runtime.mouse.mouse.position.z) * blend;
    }
    runtime.coffee.updateContactShadows();
    if (now - lastBlink > 530) {
      lastBlink = now;
      runtime.workstation.cursorOn = !runtime.workstation.cursorOn;
      if (runtime.workstation.standby) runtime.workstation.redrawScreen();
      runtime.textInput.caretOn = !runtime.textInput.caretOn;
      if (!runtime.workstation.termBusy) runtime.workstation.redrawTerminal();
      runtime.textInput.typing?.redraw();
    }
    if (runtime.gauntlet.shelfBubble.sprite.scale.x > 0.01) {
      runtime.gauntlet.placeShelfBubble();
    }
    if (runtime.shelfCollectibles.trophyCelebrating) runtime.shelfCollectibles.trophy.localToWorld(runtime.shelfCollectibles.trophyHalo.position.set(0, 0.9, -0.2));
    if (runtime.cat.catBubble.sprite.scale.x > 0.01) runtime.cat.placeCatBubble(1 - Math.exp(-10 * dt));
    // The desktop animates (windows, dock, the player's visualizer) at about 30 fps
    if ((runtime.workstation.desktop.busy() || runtime.workstation.lofi.playing) && now - runtime.workstation.screenDrawnAt > 33) runtime.workstation.redrawScreen();
    // The typing dots bounce while a reply hasn't started arriving
    const lastMessage = runtime.chat.chat.messages[runtime.chat.chat.messages.length - 1];
    if (lastMessage?.pending && !lastMessage.text && now - runtime.chat.chatTypingAt > 50) {
      runtime.chat.chatTypingAt = now;
      runtime.chat.chatDirty = true;
    }
    if (runtime.chat.chatDirty) {
      runtime.chat.chatDirty = false;
      runtime.chat.redrawChat();
    }
    // Moving props need primary shadows in the same frame; a still room only has slow idle
    // motion (the lanyard's breeze, the clock's hand) to keep up with
    if (moving || now >= mainShadowAt) {
      mainShadowAt = now + 1000 / 12 - 0.5;
      [runtime.core.sun, runtime.windowLighting.windowLight, runtime.lamp.lampLight, runtime.workstation.lightbarLight].forEach((light) => {
        if (light.castShadow && light.intensity > 0) light.shadow.needsUpdate = true;
      });
    }
    runtime.room.updateNeonLights(now, moving);
    runtime.windowLighting.updateShaft(now);
    runtime.core.updatePaperFlex();
    runtime.strawHat.constrainHat();
    updateToonBatch();
    judgeQuality(now, interval, moving);
    // the first frame casts the night's shadows too, so their own depth passes are built
    // before anyone switches the lamp on (see warmShaders)
    updateShadowBudget(firstFrame ? !decorShed : decorWanted());
    if (runtime.core.standbyPass.enabled) aimStandbyGlow();
    const drawStarted = probe ? performance.now() : 0;
    runtime.core.renderFrame();
    if (firstFrame) {
      firstFrame = false;
      runtime.options.onEvent("drawn");
    }
    if (probe) stepProbe(drawStarted);
    else if (!readied) runtime.options.onEvent("ready");
    readied = true;
  }

  // Intro: the room fades in on the overview and settles back from slightly closer
  let intro = null;
  const ro = new ResizeObserver(resize);
  // Zooming changes the pixel density without always resizing the container
  // Moving the window to a screen of another density doesn't always fire a resize
  let densityQuery = null;
  const watchDensity = () => {
    densityQuery?.removeEventListener("change", onDensityChange);
    densityQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    densityQuery.addEventListener("change", onDensityChange);
  };
  function onDensityChange() {
    resize();
    watchDensity();
  }
  let firstFrame = true;
  // (with nothing left to shed, or under ?perf&bench, the room is ready on its first frame)
  let readied = false;
  // Every program the room can ask for is compiled before its first frame: by day and by night
  // (see updateShadowBudget), and for what only shows later (the close-ups' cards, the swords'
  // spotlight). Where the driver compiles in parallel, it does so off the page's and the
  // compositor's thread, so the loader keeps moving and nothing compiles mid-visit. (Not
  // compileAsync: it waits on each material's latest program, and never settles if a material
  // is disposed meanwhile; the programs themselves are watched here, for a few seconds at most.)
  async function warmShaders() {
    const { renderer, scene, camera, composer } = runtime.core;
    const programs = new Set();
    const compile = (root) => renderer.compile(root, camera, scene).forEach((material) => {
      const program = renderer.properties.get(material).currentProgram;
      if (program) programs.add(program);
    });
    // the room lands in the composer's buffer (linear, untoned), the overlays on the canvas
    // (see renderFrame), and each gets its own program
    renderer.setRenderTarget(composer.readBuffer);
    const variants = decorShed ? [false] : [!decorWanted(), decorWanted()];
    for (const [index, decor] of variants.entries()) {
      // Paint the status before a driver without parallel compilation blocks the page.
      runtime.options.onEvent("shaders", { progress: index / variants.length });
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
      if (runtime.core.destroyed) return;
      updateShadowBudget(decor);
      compile(scene);
    }
    renderer.setRenderTarget(null);
    scene.traverse((o) => o.material?.depthTest === false && compile(o));
    // (without parallel compiling a program reports ready at once, and the first frame waits)
    runtime.options.onEvent("shaders", { progress: 1 });
    const giveUpAt = performance.now() + 8000;
    return new Promise((resolve) => {
      const check = () => {
        programs.forEach((program) => (!program.program || program.isReady()) && programs.delete(program));
        if (!programs.size || runtime.core.destroyed || performance.now() > giveUpAt) resolve();
        else setTimeout(check, 16);
      };
      check();
    });
  }
  function start() {
    if (probe && !canShed()) probe = null;
    ro.observe(runtime.options.container);
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    watchDensity();
    resize();
    Promise.resolve()
      .then(warmShaders)
      .catch((err) => console.warn(err))
      .then(() => {
        if (runtime.core.destroyed) return;
        frame = requestAnimationFrame(tick);
        // (the first textures' upload would read as a slow device)
        judgeAfter = performance.now() + 4000;
      });
  }

  // Where the screen is in the frame, as the corners of its glass project
  const screenCorner = new THREE.Vector3();
  function screenRect() {
    const { monitor, SCREEN_Y } = runtime.workstation;
    runtime.core.camera.updateMatrixWorld();
    monitor.updateWorldMatrix(true, false);
    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
    [[-2, 1.2], [2, 1.2], [-2, -1.2], [2, -1.2]].forEach(([x, y]) => {
      monitor.localToWorld(screenCorner.set(x, SCREEN_Y + y, 0.09)).project(runtime.core.camera);
      minX = Math.min(minX, screenCorner.x);
      maxX = Math.max(maxX, screenCorner.x);
      minY = Math.min(minY, screenCorner.y);
      maxY = Math.max(maxY, screenCorner.y);
    });
    // 0–1 from the frame's bottom left
    return { x: (minX + 1) / 2, y: (minY + 1) / 2, w: (maxX - minX) / 2, h: (maxY - minY) / 2 };
  }
  function aimStandbyGlow() {
    const { x, y, w, h } = screenRect();
    const { uniforms } = runtime.core.standbyPass;
    uniforms.rect.value.set(x + w / 2, y + h / 2, w / 2, h / 2);
    const canvas = runtime.core.renderer.domElement;
    uniforms.aspect.value = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  }

  // Standby: once timed, the room waits behind the loader with the lights off, close on the
  // screen, its terminal asking the visitor in. The lamp is off (by night it is the one that comes on),
  // and by day the blind is down. Resolves to where the terminal's window sits on the page, so
  // the loader can hand its own window over to it.
  let standing = false;
  // The dark by the time of day, in linear light: at night the room is all but black, while by
  // day some light gets round the blind (grey at midday, warm in the morning, amber by dusk) and
  // the screen's cool spill counts for less
  const STANDBY_GLOW = {
    // (the evening room is lit far lower to begin with, so it keeps more of that light)
    morning: { room: [0.048, 0.03, 0.014], spill: [0.34, 0.34, 0.5] },
    day: { room: [0.045, 0.045, 0.05], spill: [0.34, 0.38, 0.52] },
    evening: { room: [0.15, 0.07, 0.045], spill: [0.36, 0.3, 0.58] },
    night: { room: [0.0015, 0.002, 0.004], spill: [0.35, 0.42, 0.75] },
  };
  // what's drawn over the frame after the dark (no depth test: the lamp's filament, the badges)
  // sits out the standby
  const overlaysOut = [];
  function standby() {
    standing = true;
    runtime.core.scene.traverse((o) => {
      if (o.visible && o.material?.depthTest === false) {
        overlaysOut.push(o);
        o.visible = false;
      }
    });
    runtime.camera.standby();
    runtime.workstation.setStandby(true);
    if (runtime.theme.darkNow) runtime.lamp.setLamp(false);
    else {
      runtime.windowBlind.blind.lift = 0;
      runtime.windowBlind.updateBlind();
      runtime.windowLighting.windowLight.shadow.needsUpdate = true;
    }
    const pass = runtime.core.standbyPass;
    const glow = STANDBY_GLOW[runtime.theme.darkNow ? "night" : runtime.room.daylightPart];
    pass.uniforms.room.value.fromArray(glow.room);
    pass.uniforms.spill.value.fromArray(glow.spill);
    pass.uniforms.dark.value = 1;
    pass.enabled = true;
    // drawn at full pace for a moment, so the shot is taken within the next frames
    runtime.core.responsiveUntil = performance.now() + 600;
    const frames = (n, then) => requestAnimationFrame(() => (n > 1 ? frames(n - 1, then) : then()));
    return new Promise((resolve) => frames(3, () => {
      if (runtime.core.destroyed) return resolve(null);
      const { x, y, w, h } = screenRect();
      const box = runtime.core.renderer.domElement.getBoundingClientRect();
      // the terminal's window on it, which the loader's own window moves onto
      const win = runtime.workstation.desktop.windowRect("terminal");
      const left = box.left + x * box.width;
      const top = box.top + (1 - y - h) * box.height;
      const sx = (w * box.width) / SCREEN_W;
      const sy = (h * box.height) / SCREEN_H;
      resolve({ left: left + win.x * sx, top: top + win.y * sy, width: win.w * sx, height: win.h * sy });
    }));
  }
  // Coming in from standby: the lamp clicks on (by day the blind goes up), the lights come up
  // and the camera draws back from the screen to the room
  function wake() {
    standing = false;
    overlaysOut.splice(0).forEach((o) => (o.visible = true));
    const pass = runtime.core.standbyPass;
    if (runtime.theme.darkNow) {
      sfx.click();
      runtime.lamp.switchLamp(true);
    } else {
      sfx.slide({ duration: 0.6, up: true });
      gsap.to(runtime.windowBlind.blind, { lift: 1, duration: 1.1, ease: "power2.inOut", onUpdate: runtime.windowBlind.updateBlind });
    }
    gsap.to(pass.uniforms.dark, { value: 0, duration: 1.2, ease: "power2.out", onComplete: () => (pass.enabled = false) });
    runtime.camera.leaveStandby(1.7);
    intro = gsap.delayedCall(0.4, () => runtime.badge.swing(0.3));
  }

  // The room renders behind the loader from the start; the intro (the settle, the badge's swing
  // and the computer booting) waits until the visitor comes in
  let entered = false;
  function enter() {
    if (entered) return;
    entered = true;
    const fromStandby = standing;
    if (fromStandby) wake();
    else {
      const settledZoom = runtime.camera.cam.zoom;
      // Out of the loader's screen: the room starts close and springs back past its spot, toon-like
      runtime.camera.cam.zoom = settledZoom * 1.35;
      runtime.badge.swing(0.3);
      intro = gsap.to(runtime.camera.cam, { zoom: settledZoom, duration: 1.3, ease: "back.out(1.6)" });
    }
    // (the intro would read as a slow device)
    judgeAfter = performance.now() + 4000;
    if (runtime.secrets.previewTrophy) runtime.core.timers.push(setTimeout(runtime.secrets.celebrateSecrets, 2000));
    // From standby the computer is on already; otherwise it boots once the overlay has faded
    if (fromStandby) runtime.workstation.wakeFromStandby();
    else runtime.core.timers.push(setTimeout(() => runtime.workstation.bootComputer({ playSound: true, delay: 0.2 }), 650));
  }

  // Public state used by the other scene parts.
  return {
    start,
    standby,
    enter,
    get viewH() { return viewH; },
    get frame() { return frame; },
    get intro() { return intro; },
    ro,
    perfReadout,
    resize,
    get densityQuery() { return densityQuery; },
    onDensityChange,
  };
}
