import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { N8AOPass } from "n8ao";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { createSceneMeshes } from "../sceneMeshes";
import { createPaperFlex } from "../paperFlex";
import { PALETTES, perfParams, benchmark, lowPower, uniformCache } from "../sceneConfig";

export function createCore(runtime) {
  // Local preview links hold a part of the day, or a level of rain, whatever the visitor's clock
  // and weather say. `previewRain` is null when the link doesn't set one.
  const previewTime = process.env.NODE_ENV === "development" ? perfParams.get("time") : null;
  if (["morning", "day", "evening", "night"].includes(previewTime)) runtime.options.dark = previewTime === "night";
  const rainParam = process.env.NODE_ENV === "development" ? perfParams.get("rain") : null;
  const previewRain = rainParam === null ? null : THREE.MathUtils.clamp(Number(rainParam) || 0, 0, 1);
  let responsiveUntil = 0;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = benchmark !== "no-shadows";
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = "absolute inset-0 w-full h-full block";
  renderer.domElement.style.touchAction = "none";
  runtime.options.container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

  // Ambient occlusion: props darken where they meet the desk, the wall and each other. The
  // composer renders into its own multisampled target, since the canvas's antialias no longer
  // applies once a post pass sits in between. It keeps the frame's depth, which the occlusion
  // reads (normals rebuilt from it) instead of drawing the whole room a second time.
  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4, depthTexture: new THREE.DepthTexture(1, 1) }),
  );
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  // N8AO, worked out from the frame's own depth (normals rebuilt from it), so sprites and glows
  // that don't write depth never reach it. Its samples build up while the room holds still,
  // averaging out the grain a single frame's occlusion leaves (the blotchy halo behind the
  // plant's leaves); when the view or anything in it moves it starts over from a spatially
  // denoised frame. Once settled it stops working out anything new and lays the result over
  // each frame, the costliest pass reduced to a composite.
  const aoPass = new N8AOPass(scene, camera, 1, 1);
  aoPass.beautyRenderTarget.dispose();
  aoPass.autoDetectTransparency = false;
  Object.assign(aoPass.configuration, {
    autoRenderBeauty: false,
    // (the output pass applies the sRGB curve)
    gammaCorrection: false,
    transparencyAware: false,
    accumulate: true,
    // A 16 cm reach, as the room had from the start: it keeps shallow wall gaps (sword racks,
    // boards and shelf backs) readable even in diffuse light, shades the wall's corners and
    // the wall under the window's sill and apron (which cast no shadow of their own), and
    // leaves a soft shade round whatever hangs just off the wall
    aoRadius: 1.6,
    distanceFalloff: 1.0,
    intensity: 3,
    aoSamples: 16,
    denoiseSamples: 8,
    denoiseRadius: 8,
    // Occlusion is soft: on a Retina frame it's worked out at half size (about per CSS pixel,
    // as before) and blended up with depth-aware upsampling, a quarter of the work. At full
    // size there it was slow enough for the loader's frame-time probe to turn it off, losing
    // the shade in the corners; at this 16 cm reach half size shades as deeply.
    halfRes: renderer.getPixelRatio() > 1.5,
  });
  // The frame loop asks for fresh occlusion when anything moves (refreshAO), and now and
  // then while all is still, to follow slow idle motion (the cat's breathing): those top up
  // the settled average with a few more frames rather than starting it over
  const AO_SETTLED = 1024 / aoPass.configuration.aoSamples;
  function refreshAO(restart) {
    if (restart) aoPass.needsFrame = true;
    else aoPass.frame = Math.min(aoPass.frame, AO_SETTLED - 4);
  }
  const useFrameDepth = () => (aoPass.beautyRenderTarget = composer.readBuffer);
  useFrameDepth();
  composer.addPass(aoPass);
  // Lights off, for the room waiting behind the loader: everything darkens but the screen
  // (`rect`: its centre and half size in the frame's 0–1 coordinates) and the cool spill from
  // it. `dark` 0 is the room as lit; off unless the room is in standby (see animation), which
  // sets `room` (what's left of the room's light) and `spill` (the screen's) for the time of day.
  const standbyPass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      dark: { value: 0 },
      rect: { value: new THREE.Vector4(0.5, 0.5, 0.1, 0.1) },
      aspect: { value: 1 },
      room: { value: new THREE.Vector3(0.0015, 0.002, 0.004) },
      spill: { value: new THREE.Vector3(0.35, 0.42, 0.75) },
    },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float dark;
      uniform vec4 rect;
      uniform float aspect;
      uniform vec3 room;
      uniform vec3 spill;
      varying vec2 vUv;
      void main() {
        vec4 color = texture2D(tDiffuse, vUv);
        vec2 p = (vUv - rect.xy) * vec2(aspect, 1.0);
        vec2 hs = rect.zw * vec2(aspect, 1.0);
        // how far outside the screen, in screen heights
        float d = length(max(abs(p) - hs, 0.0)) / (2.0 * hs.y);
        // (linear light: what reads as a dark room after the output's sRGB curve is near zero)
        float near = exp(-d * 4.0);
        vec3 lit = mix(room, spill, near * near);
        color.rgb *= mix(vec3(1.0), mix(lit, vec3(1.0), step(d, 0.0)), dark);
        gl_FragColor = color;
      }`,
  });
  standbyPass.enabled = false;
  composer.addPass(standbyPass);
  const outputPass = new OutputPass();
  composer.addPass(outputPass);
  if (benchmark === "no-ao" || lowPower) aoPass.enabled = false;
  // Count the complete frame, including shadow, postprocessing and overlay draws.
  if (perfParams.has("perf")) renderer.info.autoReset = false;
  let renderMs = 0;
  let drawCalls = 0;
  let triangles = 0;
  let gpuMs = null;
  const gl = renderer.getContext();
  // three (r161) re-sends matrix-array uniforms (spotLightMatrix[], pointShadowMatrix[]: one
  // matrix per shadowed light) on every material switch, as it keeps no copy of arrays to
  // compare against. A program keeps its uniform values, so an array identical to the last one
  // sent to the same location is skipped. Locations belong to one program, so this is exact.
  // Single matrices (mostly per object) go straight through. `?perf&ucache=0` turns it off.
  const uniformUploads = { sent: 0, skipped: 0, enabled: uniformCache };
  if (uniformCache) {
    const lastSent = new WeakMap();
    ["uniformMatrix4fv", "uniformMatrix3fv"].forEach((name) => {
      const send = gl[name].bind(gl);
      gl[name] = function (location, transpose, data, ...rest) {
        if (location && data && !rest.length && data.length > 16) {
          const prev = lastSent.get(location);
          if (prev && prev.length === data.length) {
            let same = true;
            for (let i = 0; i < data.length; i++) if (prev[i] !== data[i]) { same = false; break; }
            if (same) {
              uniformUploads.skipped++;
              return;
            }
            prev.set(data);
          } else lastSent.set(location, Float32Array.from(data));
          uniformUploads.sent++;
        }
        return send(location, transpose, data, ...rest);
      };
    });
  }
  // Timed for everyone, not only `?perf`: the quality controller reads it to tell whether the
  // occlusion fits back in (see aoFits). Browsers without the extension leave it null.
  const gpuTimer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  let gpuQuery = null;
  // `?perf` splits that GPU time by pass (shadow maps, the room, occlusion, output, overlays),
  // so a slow frame says where it goes. WebGL can't nest timer queries, so under `?perf` the
  // pass timer's query replaces the frame's single one; its whole-frame reading stands in for it.
  const passTimer = gpuTimer && perfParams.has("perf") ? createPassTimer(gl, gpuTimer) : null;
  if (passTimer) {
    const passNames = new Map([[renderPass, "scene"], [aoPass, "ao"], [standbyPass, "standby"], [outputPass, "output"]]);
    composer.passes.forEach((pass) => {
      const draw = pass.render;
      pass.render = function (...args) {
        passTimer.begin(passNames.get(pass) || "post");
        return draw.apply(this, args);
      };
    });
    // Shadow maps are drawn inside the room's render; time them apart and pick its timing back
    // up after. The split comes once a frame, whether or not a map is due, so every frame runs
    // the same passes. Full-screen passes have no lights, and the overlay pass redraws no maps.
    const shadowMap = renderer.shadowMap;
    const drawShadows = shadowMap.render;
    shadowMap.render = function (lights, ...rest) {
      if (passTimer.label !== "scene" || passTimer.seen("shadows")) return drawShadows.call(this, lights, ...rest);
      passTimer.begin("shadows");
      drawShadows.call(this, lights, ...rest);
      passTimer.begin("scene");
    };
  }
  // Cards, labels and bubbles drawn over everything (no depth test) skip the composer and are
  // laid on top afterwards, so the occlusion never shades them
  const overlays = [];
  const overlaySet = new Set();
  function renderFrame() {
    const started = performance.now();
    if (perfParams.has("perf")) renderer.info.reset();
    if (gpuQuery && gl.getQueryParameter(gpuQuery, gl.QUERY_RESULT_AVAILABLE)) {
      if (!gl.getParameter(gpuTimer.GPU_DISJOINT_EXT)) {
        const elapsed = gl.getQueryParameter(gpuQuery, gl.QUERY_RESULT) / 1e6;
        gpuMs = gpuMs === null ? elapsed : gpuMs + (elapsed - gpuMs) * 0.1;
      }
      gl.deleteQuery(gpuQuery);
      gpuQuery = null;
    }
    const measuring = gpuTimer && !gpuQuery && !passTimer;
    passTimer?.frame();
    if (measuring) {
      gpuQuery = gl.createQuery();
      gl.beginQuery(gpuTimer.TIME_ELAPSED_EXT, gpuQuery);
    }
    overlays.length = 0;
    overlaySet.clear();
    scene.traverseVisible((o) => {
      // Lights are filtered by the camera's layers, so the overlay pass (layer 1) would set up
      // an empty light state and the next frame's full one: two changes a frame, and every lit
      // material re-checked for its program. Lit on layer 1 too, both passes share one state.
      if (o.isLight) o.layers.enable(1);
      if (o.material?.depthTest !== false) return;
      for (let p = o.parent; p; p = p.parent) if (overlaySet.has(p)) return;
      overlaySet.add(o);
      o.traverse((part) => part.layers.enable(1));
      overlays.push(o);
    });
    overlays.forEach((o) => (o.visible = false));
    // the composer's targets swap during a frame; the scene always lands in its read buffer
    useFrameDepth();
    composer.render();
    overlays.forEach((o) => (o.visible = true));
    if (overlays.length) {
      renderer.autoClear = false;
      const layers = camera.layers.mask;
      const background = scene.background;
      camera.layers.set(1);
      scene.background = null;
      passTimer?.begin("overlays");
      // the lights now in this pass mustn't redraw shadow maps the scene already has
      renderer.shadowMap.autoUpdate = false;
      renderer.render(scene, camera);
      renderer.shadowMap.autoUpdate = true;
      scene.background = background;
      camera.layers.mask = layers;
      renderer.autoClear = true;
    }
    if (measuring) gl.endQuery(gpuTimer.TIME_ELAPSED_EXT);
    if (passTimer) {
      passTimer.finish();
      if (passTimer.total !== null) gpuMs = passTimer.total;
    }
    renderMs += (performance.now() - started - renderMs) * 0.1;
    drawCalls += (renderer.info.render.calls - drawCalls) * 0.1;
    triangles += (renderer.info.render.triangles - triangles) * 0.1;
  }

  // Daylight enters from the upper panes of the left window, across the desk.
  const roomLight = { night: runtime.options.dark ? 1 : 0 };
  const ambient = new THREE.AmbientLight(0xffffff, 1.15);
  scene.add(ambient);
  // Broad sky/floor bounce keeps the whole daytime room bright, beyond the window patch.
  const skyFill = new THREE.HemisphereLight(0xfffaf0, 0xd9c7aa, 1.45);
  scene.add(skyFill);
  // Soft front fill reveals bevels without adding another directional shadow.
  const readabilityFill = new THREE.DirectionalLight(0xdde4ff, 0);
  readabilityFill.position.set(-4, 6, 8);
  scene.add(readabilityFill);
  // The room's diffuse daylight: the sky seen through the window, spread across the room. It
  // shines from just inside the glass (placed there by windowLighting) through a wide, soft
  // cone, fading with distance from the window, so every prop's soft shadow falls away from
  // it. The sky doesn't move through the day as the sun does, so neither does this; the
  // direct sunbeam beside it carries the time of day. Its strength is given as the light it
  // casts at the middle of the desk, SKY_REACH from the glass (see theme).
  const SKY_REACH = 12;
  const sun = new THREE.SpotLight(0xfff1cc, 0.55 * SKY_REACH, 0, 1.1, 0.35, 1);
  sun.castShadow = true;
  const SUN_MAP = lowPower ? 1024 : 2048;
  sun.shadow.mapSize.set(SUN_MAP, SUN_MAP);
  Object.assign(sun.shadow.camera, { near: 0.5, far: 45 });
  sun.shadow.bias = -0.0004;
  // (raking across the back wall beside the window, it needs a wider offset to keep its own
  // surface from speckling itself with shadow)
  sun.shadow.normalBias = 0.05;
  // A broad source: its shadows spread wide away from what casts them
  // (in texels, so a smaller map keeps the same penumbra with a smaller radius)
  sun.shadow.radius = 20 * SUN_MAP / 2048;
  scene.add(sun, sun.target);

  const timers = [];
  let destroyed = false;

  const {
    disposables, track, gradient, toon, outlineResolution, outlineBase, outlineMat, hullGeometry, noRaycast, mesh, UP, rbox, rod,
    roundedRectShape, phoneSlab, at, printMaterial, printGlow, redrawers, printed, bubbleTimers, speechBubble,
  } = createSceneMeshes(scene);
  const { bendable, paperFlex, updatePaperFlex, flexTo, flexSettle } = createPaperFlex(track);
  const shadowFill = track(new THREE.MeshBasicMaterial({ color: PALETTES.light.shadow }));

  // ---------- interaction registry ----------
  const interactive = new Map(); // object -> { focus, onEnter, onClick, onArrive, onLeave, onHover }
  const byFocus = new Map(); // focus name -> handlers
  const pickables = [];
  function register(object, handlers) {
    interactive.set(object, handlers);
    pickables.push(object);
    // Items (one ticket, one folder) share their group's focus but not its arrive/leave/keys
    if (handlers.focus && !handlers.item) byFocus.set(handlers.focus, handlers);
  }
  const entryFor = (obj) => {
    for (let o = obj; o; o = o.parent) if (interactive.has(o)) return { object: o, ...interactive.get(o) };
    return null;
  };

  // Public state used by the other scene parts.
  return {
    toon,
    track,
    mesh,
    rod,
    rbox,
    scene,
    printed,
    noRaycast,
    previewRain,
    previewTime,
    at,
    hullGeometry,
    outlineMat,
    get destroyed() { return destroyed; },
    set destroyed(value) { destroyed = value; },
    timers,
    register,
    UP,
    roomLight,
    printMaterial,
    printGlow,
    camera,
    aoPass,
    ambient,
    skyFill,
    phoneSlab,
    speechBubble,
    interactive,
    gradient,
    roundedRectShape,
    renderer,
    get responsiveUntil() { return responsiveUntil; },
    set responsiveUntil(value) { responsiveUntil = value; },
    byFocus,
    shadowFill,
    bendable,
    paperFlex,
    flexSettle,
    flexTo,
    redrawers,
    readabilityFill,
    sun,
    SKY_REACH,
    pickables,
    entryFor,
    outlineResolution,
    outlineBase,
    composer,
    get drawCalls() { return drawCalls; },
    get triangles() { return triangles; },
    get renderMs() { return renderMs; },
    get gpuMs() { return gpuMs; },
    uniformUploads,
    get gpuPasses() { return passTimer?.ms ?? null; },
    refreshAO,
    updatePaperFlex,
    renderFrame,
    standbyPass,
    bubbleTimers,
    disposables,
    get gpuQuery() { return gpuQuery; },
    gl,
  };
}

// GPU time per pass for the `?perf` readout. Apple's GPUs (and other tilers) overlap a pass with
// the one before it, so a query around each pass also counts the wait for the last: summed, they
// came to more than the frame's own time, and a pass as light as the output read ~5 ms. Instead a
// frame runs a single query, from its start to the end of one pass, taking the passes in turn.
// A pass costs the difference between where it ends and where the pass before it ended, each an
// average over the frames that timed it, so a pass that only runs now and then (shadow maps
// redrawn at 12 Hz) shows its cost per frame. `ms` maps pass name to milliseconds; `total` is the
// whole frame. Passes are told apart by the run of passes up to them, so a frame that adds or
// drops one (the overlays) averages apart from the others.
function createPassTimer(gl, ext) {
  const pending = [];
  const reach = new Map();
  const ms = new Map();
  let order = null;
  let lastOrder = [];
  let aim = 0;
  let query = null;
  let label = null;
  let total = null;
  const settle = () => {
    // a GPU far behind: let the oldest go rather than pile queries up
    while (pending.length > 12) gl.deleteQuery(pending.shift()[1]);
    // a disjoint event (power state, context switch) spoils every result in flight
    if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
      pending.splice(0).forEach(([, done]) => gl.deleteQuery(done));
      return;
    }
    while (pending.length && gl.getQueryParameter(pending[0][1], gl.QUERY_RESULT_AVAILABLE)) {
      const [key, done] = pending.shift();
      const value = gl.getQueryParameter(done, gl.QUERY_RESULT) / 1e6;
      gl.deleteQuery(done);
      reach.set(key, reach.has(key) ? reach.get(key) + (value - reach.get(key)) * 0.2 : value);
    }
    if (!lastOrder.length || !lastOrder.every(([key]) => reach.has(key))) return;
    ms.clear();
    let before = 0;
    lastOrder.forEach(([key, name]) => {
      const end = reach.get(key);
      ms.set(name, (ms.get(name) || 0) + Math.max(0, end - before));
      before = Math.max(before, end);
    });
    total = before;
  };
  // the pass now running ends here; if it's the one this frame times, so does the query
  const boundary = () => {
    if (label === null) return;
    const key = order.length ? `${order[order.length - 1][0]}>${label}` : label;
    order.push([key, label]);
    if (query && order.length - 1 === aim) {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      pending.push([key, query]);
      query = null;
    }
  };
  return {
    ms,
    get label() { return label; },
    get total() { return total; },
    seen(name) { return !!order?.some(([, passed]) => passed === name); },
    frame() {
      order = [];
      label = null;
      aim = lastOrder.length ? (aim + 1) % lastOrder.length : 0;
      query = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    },
    begin(name) {
      if (!order) return;
      boundary();
      label = name;
    },
    finish() {
      if (!order) return;
      boundary();
      // fewer passes than the last frame: the one it was to time didn't run
      if (query) {
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        gl.deleteQuery(query);
        query = null;
      }
      lastOrder = order;
      order = null;
      label = null;
      settle();
    },
  };
}
