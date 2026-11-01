import * as THREE from "three";
import gsap from "gsap";
import { hoverSound, sfx } from "@/shared/composables/useSfx";
import { Pass, FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { canvasTexture } from "../textures";
import { lowPower } from "../sceneConfig";

export function createWindowLighting(runtime) {
  // Sun (or moon) through the window: a narrow spot far outside it, its rays all but parallel,
  // aimed through the glass from wherever the sky's light stands. The wall round the glass, the
  // glazing bars and the blind's slats shadow it for real, and its map spans only the beam, so
  // slats a few centimetres apart still print as crisp stripes.
  // Far enough out that its rays through the full-size glass stay all but parallel, as the sun's
  // do: from nearer they fan out, and at noon the edge of the beam strays onto the back wall
  const WINDOW_SUN_FAR = 150;
  // the cone just takes in the glass (from its centre to a corner, in world units), at any slant
  const { GLASS } = runtime.room;
  const glassReach = Math.hypot(GLASS.x, GLASS.y) * runtime.room.windowGroup.scale.x;
  const windowLight = new THREE.SpotLight(0xffe5ad, 2.2, 0, Math.atan(glassReach * 1.84 / WINDOW_SUN_FAR), 0.12, 0);
  windowLight.castShadow = true;
  windowLight.shadow.mapSize.setScalar(lowPower ? 1024 : 2048);
  windowLight.shadow.camera.near = WINDOW_SUN_FAR - 8;
  windowLight.shadow.camera.far = WINDOW_SUN_FAR + 40;
  windowLight.shadow.bias = -0.0002;
  windowLight.shadow.normalBias = 0.02;
  windowLight.shadow.radius = 5.5;
  runtime.core.scene.add(windowLight, windowLight.target);
  runtime.room.windowGroup.updateWorldMatrix(true, false);
  const windowGlass = runtime.room.windowGroup.localToWorld(new THREE.Vector3(0, 0, 0.06));
  // The sky's diffuse light (core.sun) comes in through the same glass, just in front of the
  // blind, out across the room. The blind's drop dims it (see theme) rather than casting its
  // outline, which so broad a source wouldn't show. Where in the opening it comes from follows
  // the sun (see aimWindowLight); it starts from the middle.
  const skyAt = new THREE.Vector3(0, 0, 0.6);
  runtime.core.sun.position.copy(runtime.room.windowGroup.localToWorld(skyAt.clone()));
  runtime.core.sun.target.position.set(6, -5, 1);
  const windowRay = new THREE.Vector3();
  // The light's cookie: the glass, as the light sees it, white in black (edges a touch soft, as
  // the sun isn't a point), so it shines only through the window. Redrawn whenever it's aimed.
  const glassCookie = canvasTexture(512, 512);
  runtime.core.track(glassCookie.texture);
  windowLight.map = glassCookie.texture;
  const glassCorner = new THREE.Vector3();
  let cookieRain = -1;
  function drawGlassCookie() {
    runtime.room.windowGroup.updateWorldMatrix(true, false);
    windowLight.updateMatrixWorld();
    windowLight.shadow.updateMatrices(windowLight);
    const c = glassCookie.ctx;
    c.fillStyle = "#000";
    c.fillRect(0, 0, 512, 512);
    c.filter = `blur(${2 + runtime.room.outside.rain * 6}px)`;
    c.beginPath();
    [[-GLASS.x, -GLASS.y], [-GLASS.x, GLASS.y], [GLASS.x, GLASS.y], [GLASS.x, -GLASS.y]].forEach(([x, y], k) => {
      // the shadow matrix takes a world point to the light map's 0–1 square
      runtime.room.windowGroup.localToWorld(glassCorner.set(x, y, 0.06)).applyMatrix4(windowLight.shadow.matrix);
      const px = glassCorner.x * 512;
      const py = (1 - glassCorner.y) * 512;
      if (k) c.lineTo(px, py);
      else c.moveTo(px, py);
    });
    c.closePath();
    c.fillStyle = "#fff";
    c.fill();
    c.filter = "none";
    glassCookie.texture.needsUpdate = true;
    cookieRain = runtime.room.outside.rain;
  }
  // `from`: normalized coordinates of the sun or moon in the painted window view. Between two
  // parts of the day, `aimFrom` (the aim it had when the change began, see aimNow) and `blend`
  // carry the beam straight across to where `from` will put it. Following the painted sun's
  // place there instead, it overshot: the sun moves out toward the front before it's low enough
  // for the sunset's shorter turn, so on the way to evening the beam swung out past the desk's
  // front edge and back.
  function aimWindowLight(from, { aimFrom = null, blend = 1 } = {}) {
    // The view's horizontal axis is window-local X (world -Z): the sun's place across the sky
    // turns the beam toward the back of the room in the morning and the front in the evening.
    // Its height in the painted sky sets a real elevation: low and slanting at sunrise (25°),
    // high at noon (45°: the patch reaches across the middle of the desk instead of only the
    // crowded strip by the window, its bars' shadows on the mat), as low again at
    // sunset (25°, any lower and the beam sails over the desk to the floor); the moon (30°)
    // sits between. Heights in between blend.
    const SUN_ELEVATION = [[0.10, 45], [0.19, 30], [0.30, 25], [0.44, 25]];
    const v = THREE.MathUtils.clamp(from[1], SUN_ELEVATION[0][0], SUN_ELEVATION[SUN_ELEVATION.length - 1][0]);
    const k = SUN_ELEVATION.findIndex((_, i) => i === SUN_ELEVATION.length - 2 || v <= SUN_ELEVATION[i + 1][0]);
    const [[v0, e0], [v1, e1]] = [SUN_ELEVATION[k], SUN_ELEVATION[k + 1]];
    const elevation = THREE.MathUtils.degToRad(e0 + (e1 - e0) * (v - v0) / (v1 - v0));
    // A low sun toward the front of the room (sunset) turns the beam only a little that way,
    // so the long evening streak lies across the desk instead of past its front edge
    const setting = from[0] > 0.5 ? THREE.MathUtils.smoothstep(v, SUN_ELEVATION[2][0], SUN_ELEVATION[3][0]) : 0;
    const across = (from[0] - 0.5) * 1.4 * THREE.MathUtils.lerp(1, 0.35, setting);
    aimNow.elevation = aimFrom ? THREE.MathUtils.lerp(aimFrom.elevation, elevation, blend) : elevation;
    aimNow.across = aimFrom ? THREE.MathUtils.lerp(aimFrom.across, across, blend) : across;
    runtime.room.windowGroup.updateWorldMatrix(true, false);
    windowRay.set(aimNow.across, Math.tan(aimNow.elevation) * Math.hypot(1, aimNow.across), -1)
      .transformDirection(runtime.room.windowGroup.matrixWorld);
    windowLight.position.copy(windowGlass).addScaledVector(windowRay, WINDOW_SUN_FAR);
    windowLight.target.position.copy(windowGlass).addScaledVector(windowRay, -1);
    windowLight.target.updateMatrixWorld();
    windowLight.shadow.needsUpdate = true;
    // The sky is brightest round the sun (the circumsolar region of the CIE standard skies), so
    // most of its light through the glass comes from the sun's side of the opening: the sky light
    // slides that way across the window, toward the room's front in the morning and its back by
    // evening (the moon's side by night), and every soft shadow in the room swings with it
    // (by the sun's own place across the sky, which the low evening beam's shorter turn doesn't
    // hold back)
    const slide = THREE.MathUtils.clamp((from[0] - 0.5) * 4, -1, 1);
    aimNow.slide = aimFrom ? THREE.MathUtils.lerp(aimFrom.slide ?? slide, slide, blend) : slide;
    const up = Math.tan(aimNow.elevation) * Math.hypot(1, aimNow.across);
    skyAt.set(0.8 * GLASS.x * aimNow.slide, 0.8 * GLASS.y * up / Math.hypot(aimNow.across, up, 1), 0.6);
    runtime.core.sun.position.copy(runtime.room.windowGroup.localToWorld(skyAt));
    runtime.core.sun.shadow.needsUpdate = true;
    drawGlassCookie();
  }
  // The beam's aim as last set: its elevation, and how far it turns across the window
  const aimNow = { elevation: 0, across: 0, slide: 0 };

  // The beam through the window: a soft shaft of light in the air, from the glass into the room
  // along the light's own path, bright at the glass and fading out along the beam and toward its
  // edges, with dust drifting in it. It takes the window light's colour and strength, keeps to
  // the part of the glass the blind leaves open, and thins out in the rain.
  // Whatever stands in the room in the beam (the chair, the cat) shades the glow and the dust
  // behind it, as it does the sunlight on the surfaces: each point of the beam looks itself up
  // in the window light's shadow map. A few taps soften the edge, as the air in a real beam's
  // shadow isn't cut quite clean.
  // Only what's in the room counts. The window's frame, the wall round it and the blind already
  // shape the beam, and the beam's edges run right along their shadow's edge: there the map's
  // texels stretched into a sawtooth. So anything within BEAM_SKIP of the glass, along
  // each point's own ray, is passed over. And a surface the beam lies on (the wall, the sill) is
  // at the beam's own depth to within a texel's slant, which striped it: BEAM_BIAS keeps a point
  // from shading itself (about 3 cm: the map's depth runs some 0.025 to a unit, 140-odd units out)
  const BEAM_SKIP = 1.5;
  const BEAM_BIAS = 0.0075;
  const beamShadow = {
    beamShadowMap: { value: null },
    beamShadowMatrix: { value: new THREE.Matrix4() },
    beamShadowTexel: { value: new THREE.Vector2() },
    beamShadowOn: { value: 0 },
    beamGlassPoint: { value: new THREE.Vector3() },
    beamGlassNormal: { value: new THREE.Vector3() },
    beamDir: { value: new THREE.Vector3() },
  };
  const BEAM_LIT = `
    #include <packing>
    #ifndef BEAM_TAPS
    #define BEAM_TAPS 5
    #endif
    uniform sampler2D beamShadowMap;
    uniform mat4 beamShadowMatrix;
    uniform vec2 beamShadowTexel;
    uniform float beamShadowOn;
    uniform vec3 beamGlassPoint;
    uniform vec3 beamGlassNormal;
    uniform vec3 beamDir;
    float beamLit(vec3 world) {
      if (beamShadowOn < 0.5) return 1.0;
      vec4 s = beamShadowMatrix * vec4(world, 1.0);
      vec3 c = s.xyz / s.w;
      // outside the light's map (beyond the glass): nothing there to shade it
      if (s.w <= 0.0 || c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
      // back along this point's ray to the glass, then ${BEAM_SKIP.toFixed(1)} into the room: the depth
      // anything nearer the light than that (the window and its blind) is passed over at
      float t = dot(world - beamGlassPoint, beamGlassNormal) / dot(beamDir, beamGlassNormal);
      vec4 g = beamShadowMatrix * vec4(world - beamDir * (t - ${BEAM_SKIP.toFixed(1)}), 1.0);
      float skip = g.z / g.w;
      float lit = 0.0;
      for (int i = 0; i < BEAM_TAPS; i++) {
        vec2 o = i == 0 ? vec2(0.0) : vec2(i < 3 ? -1.5 : 1.5, i % 2 == 0 ? -1.5 : 1.5);
        float d = unpackRGBAToDepth(texture2D(beamShadowMap, c.xy + o * beamShadowTexel));
        lit += d < skip || c.z - ${BEAM_BIAS.toFixed(4)} <= d ? 1.0 : 0.0;
      }
      return lit / float(BEAM_TAPS);
    }`;
  // Long enough to reach the desk or the floor from the top of the full-size window
  const SHAFT_LEN = 20;
  // How bright a unit of lit air glows (to the beam's strength): about what the old sides gave
  // looking straight through the beam's middle
  const BEAM_GLOW = 0.3;
  // The glow is worked out per pixel, at half the frame's size: along each line of sight, from
  // where it enters the beam (the box the open glass sweeps along the light) to where it leaves
  // it or meets the first solid surface in the frame's depth, adding up the light at points the
  // sun reaches. So the air in front of the chair glows only as deep as it is, and nothing of the
  // beam behind the chair shows through it. (Drawn as the beam's sides instead, each painted with
  // the whole beam's depth, the glow lay over anything standing in the light.) One shadow tap a
  // step: the steps' per-pixel offset softens the shadow's edge as the taps did.
  const beamGlowMat = new THREE.ShaderMaterial({
    defines: { STEPS: lowPower ? 8 : 16, BEAM_TAPS: 1 },
    uniforms: {
      tDepth: { value: null },
      cameraWorld: { value: new THREE.Matrix4() },
      projectionInverse: { value: new THREE.Matrix4() },
      toBeam: { value: new THREE.Matrix4() },
      // the open glass in the window's units: half its width, its bottom, its top
      glass: { value: new THREE.Vector3() },
      color: { value: new THREE.Color() },
      strength: { value: 0 },
      ...beamShadow,
    },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      uniform sampler2D tDepth;
      uniform mat4 cameraWorld;
      uniform mat4 projectionInverse;
      uniform mat4 toBeam;
      uniform vec3 glass;
      uniform vec3 color;
      uniform float strength;
      varying vec2 vUv;
      ${BEAM_LIT}
      vec3 unproject(float depth) {
        vec4 p = cameraWorld * projectionInverse * vec4(vec3(vUv, depth) * 2.0 - 1.0, 1.0);
        return p.xyz / p.w;
      }
      void main() {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        // the line of sight, from the near plane to the first surface, in the world and in the
        // beam's own space (x across the glass, y up it, z along the light from it)
        vec3 a = unproject(0.0);
        vec3 b = unproject(texture2D(tDepth, vUv).x);
        vec3 ba = (toBeam * vec4(a, 1.0)).xyz;
        vec3 bb = (toBeam * vec4(b, 1.0)).xyz;
        vec3 lo = vec3(-glass.x, glass.y, 0.0);
        vec3 hi = vec3(glass.x, glass.z, ${SHAFT_LEN.toFixed(1)});
        vec3 d = bb - ba;
        // (never exactly 0: a line of sight square to an axis divides by it)
        d = mix(d, vec3(1e-6), step(abs(d), vec3(1e-6)));
        vec3 t0 = (lo - ba) / d;
        vec3 t1 = (hi - ba) / d;
        vec3 enter = min(t0, t1);
        vec3 leave = max(t0, t1);
        float s0 = max(max(enter.x, enter.y), max(enter.z, 0.0));
        float s1 = min(min(leave.x, leave.y), min(leave.z, 1.0));
        if (s1 <= s0) return;
        // each pixel's steps offset a little (interleaved gradient noise), so they don't band
        float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        float sum = 0.0;
        for (int i = 0; i < STEPS; i++) {
          float s = mix(s0, s1, (float(i) + jitter) / float(STEPS));
          vec3 p = mix(ba, bb, s);
          // clamped: pow() of a negative is NaN
          float across = sin(3.14159265 * clamp((p.x - lo.x) / (hi.x - lo.x), 0.0, 1.0)) * sin(3.14159265 * clamp((p.y - lo.y) / (hi.y - lo.y), 0.0, 1.0));
          float along = pow(clamp(1.0 - p.z / hi.z, 0.0, 1.0), 1.8);
          sum += across * along * beamLit(mix(a, b, s));
        }
        // light per unit of air, times the depth of lit air passed through
        gl_FragColor.rgb = color * strength * ${BEAM_GLOW.toFixed(2)} * sum / float(STEPS) * distance(a, b) * (s1 - s0);
      }`,
  });
  // Two passes. The glow goes into a buffer of its own straight after the room is drawn, while
  // the room's depth is still whole: the composer's two buffers share one depth texture, so
  // drawing into either while reading it is a feedback loop, and each one written lays its own
  // (empty) depth over it, the occlusion's included. It's added onto the frame after the
  // occlusion, which so leaves the light in the air undarkened.
  const beamTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  const beamGlowQuad = new FullScreenQuad(beamGlowMat);
  const beamGlowPass = new Pass();
  beamGlowPass.needsSwap = false;
  beamGlowPass.setSize = (width, height) => beamTarget.setSize(Math.max(1, Math.ceil(width / 2)), Math.max(1, Math.ceil(height / 2)));
  beamGlowPass.render = (renderer, writeBuffer, readBuffer) => {
    beamGlowMat.uniforms.tDepth.value = readBuffer.depthTexture;
    beamGlowMat.uniforms.cameraWorld.value.copy(runtime.core.camera.matrixWorld);
    beamGlowMat.uniforms.projectionInverse.value.copy(runtime.core.camera.projectionMatrixInverse);
    renderer.setRenderTarget(beamTarget);
    beamGlowQuad.render(renderer);
  };
  const beamAddMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, tGlow: { value: beamTarget.texture } },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform sampler2D tGlow;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(tDiffuse, vUv) + vec4(texture2D(tGlow, vUv).rgb, 0.0);
      }`,
  });
  const beamAddQuad = new FullScreenQuad(beamAddMat);
  const beamAddPass = new Pass();
  beamAddPass.render = (renderer, writeBuffer, readBuffer) => {
    beamAddMat.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(beamAddPass.renderToScreen ? null : writeBuffer);
    beamAddQuad.render(renderer);
  };
  [beamGlowPass, beamAddPass].forEach((pass) => (pass.dispose = () => {
    beamTarget.dispose();
    [beamGlowQuad, beamAddQuad, beamGlowMat, beamAddMat].forEach((part) => part.dispose());
  }));
  // after the room, and after its occlusion (the room, then the occlusion, are the first two)
  runtime.core.composer.insertPass(beamGlowPass, 1);
  runtime.core.composer.insertPass(beamAddPass, 3);
  const beamBasis = new THREE.Matrix4();
  const beamAcross = new THREE.Vector3();
  const beamUp = new THREE.Vector3();
  const beamOrigin = new THREE.Vector3();
  // dust: points scattered through the beam (across, up, along), drifting slowly down it
  const MOTES = 60;
  // Faint and small: specks you catch in the light, not sparks across it
  const MOTE_PX = 3.5;
  const MOTE_GLOW = 2.4;
  const moteAt = Array.from({ length: MOTES }, () => [Math.random(), Math.random(), Math.random(), Math.random() * Math.PI * 2]);
  const moteGeo = runtime.core.track(new THREE.BufferGeometry());
  const motePos = new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3);
  const moteCol = new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3);
  moteGeo.setAttribute("position", motePos);
  moteGeo.setAttribute("color", moteCol);
  const moteDot = canvasTexture(32, 32);
  runtime.core.track(moteDot.texture);
  const moteGlow = moteDot.ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  moteGlow.addColorStop(0, "rgba(255,255,255,1)");
  moteGlow.addColorStop(1, "rgba(255,255,255,0)");
  moteDot.ctx.fillStyle = moteGlow;
  moteDot.ctx.fillRect(0, 0, 32, 32);
  // (as a PointsMaterial would draw them, MOTE_PX across whatever the screen's density, but each
  // mote dark while it drifts through a shadow)
  const moteMat = runtime.core.track(new THREE.ShaderMaterial({
    uniforms: { size: { value: MOTE_PX }, map: { value: moteDot.texture }, ...beamShadow },
    vertexShader: `
      uniform float size;
      varying vec3 vGlow;
      ${BEAM_LIT}
      void main() {
        vGlow = color * beamLit(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size;
      }`,
    fragmentShader: `
      uniform sampler2D map;
      varying vec3 vGlow;
      void main() {
        gl_FragColor = vec4(vGlow, texture2D(map, gl_PointCoord).a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  const motes = new THREE.Points(moteGeo, moteMat);
  motes.onBeforeRender = (renderer) => (moteMat.uniforms.size.value = MOTE_PX * renderer.getPixelRatio());
  motes.frustumCulled = false;
  motes.raycast = runtime.core.noRaycast;
  runtime.core.scene.add(motes);
  const shaftCorner = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const shaftInto = new THREE.Vector3();
  const shaftTint = new THREE.Color();
  const shaftPoint = new THREE.Vector3();
  const shaftReach = [SHAFT_LEN, SHAFT_LEN, SHAFT_LEN, SHAFT_LEN];
  const BACK_WALL = runtime.room.WALL_Z + 0.12;
  // The desktop: 180 × 84 cm, centred on the origin
  const DESK_HALF = { x: 9, z: 4.2 };
  // How far a ray from `from` along the beam (shaftInto) goes before it meets the back wall, the
  // desk's top (within its edges) or else the floor; never further than SHAFT_LEN
  function beamReach(from) {
    let reach = SHAFT_LEN;
    if (shaftInto.z < -1e-4) reach = Math.min(reach, (BACK_WALL - from.z) / shaftInto.z);
    if (shaftInto.y < -1e-4) {
      const toDesk = -from.y / shaftInto.y;
      const x = from.x + shaftInto.x * toDesk;
      const z = from.z + shaftInto.z * toDesk;
      const onDesk = Math.abs(x) < DESK_HALF.x && Math.abs(z) < DESK_HALF.z;
      reach = Math.min(reach, onDesk ? toDesk : (runtime.room.FLOOR_Y - from.y) / shaftInto.y);
    }
    return Math.max(0, reach);
  }
  // Up close at the window the camera stands in the beam itself, its sides rising off the
  // frame's edges straight at it, and they'd lay bright bands over the wood. A real beam
  // seen from inside it, by the glass, shows nothing, so its glow fades out for the close-up
  // (the motes stay, drifting in the light).
  let shaftCloseUp = 0;
  let shaftAt = 0;
  function updateShaft(now) {
    const dt = Math.min(0.1, (now - shaftAt) / 1000);
    shaftAt = now;
    shaftCloseUp += ((runtime.camera.focus.name === "window" ? 1 : 0) - shaftCloseUp) * Math.min(1, dt * 4);
    // the open part of the glass, below the blind's bottom bar
    const top = Math.min(GLASS.y, runtime.windowBlind.bottomBar.position.y - runtime.windowBlind.BAR_H / 2);
    const strength = windowLight.intensity * 0.028 * (1 - 0.7 * runtime.room.outside.rain) * (1 - 0.75 * runtime.core.roomLight.night);
    motes.visible = top > -GLASS.y + 0.1 && strength > 0.002;
    beamGlowPass.enabled = beamAddPass.enabled = motes.visible && shaftCloseUp < 0.99;
    if (!motes.visible) return;
    // glass corners, clockwise from the bottom left as seen from the room, then the beam's way in
    [[-GLASS.x, -GLASS.y], [-GLASS.x, top], [GLASS.x, top], [GLASS.x, -GLASS.y]].forEach(([x, y], k) => runtime.room.windowGroup.localToWorld(shaftCorner[k].set(x, y, 0.12)));
    shaftInto.copy(windowRay).negate();
    // How far the dust drifts: each edge of the beam stops where it meets the room, the back
    // wall, the desk's top or the floor, whichever comes first
    shaftCorner.forEach((corner, k) => (shaftReach[k] = beamReach(corner)));
    // the beam's space for the glow: across and up the glass in the window's units, along the light
    const frame = runtime.room.windowGroup.matrixWorld;
    beamBasis.makeBasis(beamAcross.setFromMatrixColumn(frame, 0), beamUp.setFromMatrixColumn(frame, 1), shaftInto)
      .setPosition(runtime.room.windowGroup.localToWorld(beamOrigin.set(0, 0, 0.12)));
    beamGlowMat.uniforms.toBeam.value.copy(beamBasis).invert();
    beamGlowMat.uniforms.glass.value.set(GLASS.x, -GLASS.y, top);
    shaftTint.copy(windowLight.color);
    beamGlowMat.uniforms.color.value.copy(shaftTint);
    beamGlowMat.uniforms.strength.value = strength * (1 - shaftCloseUp);
    // the light's map appears once its shadow is first drawn (never, with shadows off)
    const map = windowLight.shadow.map?.texture ?? null;
    beamShadow.beamShadowMap.value = map;
    beamShadow.beamShadowOn.value = map ? 1 : 0;
    beamShadow.beamShadowMatrix.value.copy(windowLight.shadow.matrix);
    beamShadow.beamShadowTexel.value.set(1 / windowLight.shadow.mapSize.x, 1 / windowLight.shadow.mapSize.y);
    beamShadow.beamGlassPoint.value.copy(shaftCorner[0]);
    beamShadow.beamGlassNormal.value.setFromMatrixColumn(runtime.room.windowGroup.matrixWorld, 2).normalize();
    beamShadow.beamDir.value.copy(shaftInto);
    // motes: across the glass (u from left to right, w from bottom to top), drifting along the
    // beam and bobbing a little, brightest in its middle
    const t = now / 1000;
    moteAt.forEach(([u, w, along, phase], k) => {
      const s = (along + t * 0.012) % 1;
      const bob = Math.sin(t * 0.6 + phase) * 0.06;
      shaftPoint.copy(shaftCorner[0]).lerp(shaftCorner[3], u);
      shaftPoint.y += (top + GLASS.y) * w + bob;
      // as far in as the beam reaches at that height, short of where it lands
      const reach = THREE.MathUtils.lerp((shaftReach[0] + shaftReach[3]) / 2, (shaftReach[1] + shaftReach[2]) / 2, w);
      shaftPoint.addScaledVector(shaftInto, s * reach * 0.85);
      motePos.setXYZ(k, shaftPoint.x, shaftPoint.y, shaftPoint.z);
      const glow = Math.sin(Math.PI * s) * Math.sin(Math.PI * u) * strength * MOTE_GLOW * (0.6 + 0.4 * Math.sin(t * 1.3 + phase * 3));
      moteCol.setXYZ(k, shaftTint.r * glow, shaftTint.g * glow, shaftTint.b * glow);
    });
    motePos.needsUpdate = true;
    moteCol.needsUpdate = true;
  }
  // The chain (or the pull on the bottom bar) works the blind: halfway down, all the way down,
  // then back up
  const BLIND_STOPS = [1, 0.45, 0];
  let blindStop = 0;
  const workBlind = () => {
    blindStop = (blindStop + 1) % BLIND_STOPS.length;
    const lift = BLIND_STOPS[blindStop];
    const duration = 0.5 + Math.abs(lift - runtime.windowBlind.blind.lift) * 1.1;
    sfx.slide({ duration: Math.min(0.8, duration * 0.5), up: lift > runtime.windowBlind.blind.lift });
    // it travels, then the hem swings on and settles, a touch of give rather than a stop dead
    // (out into the room either way: the window stands behind it; see updateBlind)
    const swing = lift > runtime.windowBlind.blind.lift ? -0.05 : -0.07;
    gsap.killTweensOf(runtime.windowBlind.blind);
    gsap.timeline({ onUpdate: runtime.windowBlind.updateBlind })
      .to(runtime.windowBlind.blind, { lift, duration, ease: "power1.inOut" })
      .to(runtime.windowBlind.blind, { sway: swing, duration: 0.18, ease: "power1.out" }, ">-0.1")
      .to(runtime.windowBlind.blind, { sway: 0, duration: 1.3, ease: "elastic.out(1, 0.3)" });
  };

  // The window opens by its handles: click one and both turn up level, then the two leaves
  // swing right out on their hinges together, all but flat to the wall outside, clear of the
  // view; click again and they swing shut and the handles drop.
  // Leaving the window's close-up shuts it. The leaves' shadows swing with them, so the sunlit
  // patch on the desk opens up as they go.
  const LEAF_SWING = 3.05; // about 175°, back against the outside wall
  const HANDLE_OPEN = Math.PI / 2;
  const sash = { open: 0 };
  let windowOpen = false;
  const swingLeaves = () => {
    runtime.room.leaves.forEach((leaf, i) => (leaf.rotation.y = (i ? -1 : 1) * LEAF_SWING * sash.open));
    // the raindrops on the glass swing away with it
    runtime.room.outside.glass = 1 - sash.open;
    windowLight.shadow.needsUpdate = true;
  };
  function toggleWindow() {
    windowOpen = !windowOpen;
    const turn = (to) => runtime.room.windowCatches.forEach((handle, i) =>
      gsap.to(handle.rotation, { z: (i ? 1 : -1) * to, duration: 0.25, ease: "power2.out", overwrite: true }));
    gsap.killTweensOf(sash);
    sfx.click();
    if (windowOpen) {
      turn(HANDLE_OPEN);
      gsap.delayedCall(0.25, () => sfx.creak());
      gsap.to(sash, { open: 1, duration: 1.6, delay: 0.25, ease: "power2.out", onUpdate: swingLeaves });
      return;
    }
    gsap.to(sash, { open: 0, duration: 1.2, ease: "power2.in", onUpdate: swingLeaves, onComplete: () => {
      sfx.knock();
      turn(0);
    } });
  }
  runtime.room.windowHandles.forEach((grip, i) => runtime.core.register(grip, {
    focus: "window",
    item: true,
    // brushed past while shut, the handle gives a little turn
    onHover: (on) => {
      if (windowOpen) return;
      gsap.to(runtime.room.windowCatches[i].rotation, { z: on ? (i ? 0.55 : -0.55) : 0, duration: on ? 0.25 : 0.4, ease: "power2.out", overwrite: true });
      if (on) hoverSound(grip, (s) => s.tick({ pitch: 0.75 }));
    },
    onClick: toggleWindow,
  }));
  runtime.core.register(runtime.windowBlind.blindChain, {
    // brushed past, it swings a little; let go of, a smaller sway the other way
    onHover: (on) => {
      if (!on) return runtime.windowBlind.swingChain(-0.03, -0.08);
      runtime.windowBlind.swingChain(0.05, 0.16);
      // the beads rattle against each other
      hoverSound(runtime.windowBlind.blindChain, (s) => [2.4, 2.6, 2.8].forEach((pitch, k) => s.tick({ pitch, delay: k * 0.04 })));
    },
    // pulled, it swings out harder as the blind starts to move
    onClick: () => {
      runtime.windowBlind.swingChain(0.08, 0.26);
      workBlind();
    },
  });
  runtime.core.register(runtime.windowBlind.bottomBar, {
    onHover: (on) => {
      gsap.to(runtime.windowBlind.pull.rotation, { x: on ? 0.35 : 0, duration: on ? 0.25 : 0.8, ease: on ? "power2.out" : "elastic.out(1, 0.3)", overwrite: true });
      if (on) hoverSound(runtime.windowBlind.bottomBar, (s) => s.rustle({ duration: 0.2 }));
    },
    onClick: workBlind,
  });

  // Public state used by the other scene parts.
  return {
    windowLight,
    toggleWindow,
    isWindowOpen: () => windowOpen,
    aimWindowLight,
    aimNow,
    get cookieRain() { return cookieRain; },
    drawGlassCookie,
    updateShaft,
  };
}
