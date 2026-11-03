// Bake spike: the same corner of the room drawn two ways, for a like-for-like GPU comparison.
//   ?mode=runtime  shadow maps redrawn every frame and N8AO, as the room does while things move
//   ?mode=baked    the lightmap and AO baked by bake_room.py; no shadow maps, no AO pass
//   &time=day|night
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { N8AOPass } from "n8ao";

const params = new URLSearchParams(location.search);
const mode = params.get("mode") === "baked" ? "baked" : "runtime";
const night = params.get("time") === "night";
// (bake_room.py stores light at a quarter; Blender's diffuse light pass is radiance, three's
// lightmap irradiance, hence π)
const RANGE = 4;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = mode === "runtime";
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(night ? 0x0b0d16 : 0x1a1d24);
const aspect = innerWidth / innerHeight;
const viewH = 24;
const camera = new THREE.OrthographicCamera((-viewH * aspect) / 2, (viewH * aspect) / 2, viewH / 2, -viewH / 2, 0.1, 200);
camera.position.set(30, 26, 30);
camera.lookAt(0, 6, -4);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 2, depthTexture: new THREE.DepthTexture(1, 1) }));
composer.addPass(new RenderPass(scene, camera));
let aoPass = null;
if (mode === "runtime" && params.get("ao") !== "0") {
  // as core.js has it, but never settling: every frame works the occlusion out afresh
  aoPass = new N8AOPass(scene, camera, innerWidth, innerHeight);
  aoPass.beautyRenderTarget.dispose();
  aoPass.autoDetectTransparency = false;
  Object.assign(aoPass.configuration, { autoRenderBeauty: false, gammaCorrection: false, transparencyAware: false, accumulate: false, aoRadius: 1.6, distanceFalloff: 1.0, intensity: 3, aoSamples: 16, denoiseSamples: 8, denoiseRadius: 8, halfRes: renderer.getPixelRatio() > 1.5 });
  composer.addPass(aoPass);
}
composer.addPass(new OutputPass());
// (sized once every pass is in, so the occlusion works at the frame's own size)
composer.setPixelRatio(renderer.getPixelRatio());
composer.setSize(innerWidth, innerHeight);

const gradient = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
gradient.needsUpdate = true;

const textures = new THREE.TextureLoader();
const lightTexture = (file, srgb) => {
  const texture = textures.load(`./out/${file}`);
  texture.flipY = false;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

if (mode === "runtime") {
  scene.add(new THREE.HemisphereLight(night ? 0x202840 : 0x8fb3ff, 0x2a2018, night ? 0.08 : 0.6));
  if (night) {
    const lamp = new THREE.PointLight(0xffb873, 25, 0, 2);
    lamp.position.set(-6.2, 11.5, -7.8);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(512, 512);
    scene.add(lamp);
  } else {
    const sun = new THREE.DirectionalLight(0xfff2d9, 3);
    sun.position.set(-30, 22, 5);
    sun.target.position.set(0, 4, -4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 80 });
    scene.add(sun, sun.target);
  }
}

const stats = document.getElementById("stats");
new GLTFLoader().load("./out/room.glb", (gltf) => {
  const room = gltf.scene;
  room.scale.setScalar(10);
  const lightMap = mode === "baked" ? lightTexture(night ? "lm_night.png" : "lm_day.png", true) : null;
  const aoMap = mode === "baked" ? lightTexture("ao.png", false) : null;
  room.traverse((object) => {
    if (!object.isMesh) return;
    const color = object.material.color.clone();
    object.material = new THREE.MeshToonMaterial({ color, gradientMap: gradient });
    if (mode === "baked") Object.assign(object.material, { lightMap, lightMapIntensity: RANGE * Math.PI, aoMap, aoMapIntensity: 1 });
    object.castShadow = object.receiveShadow = mode === "runtime";
  });
  scene.add(room);
  start();
});

// GPU time per frame from the timer query, averaged like the room's ?perf readout
const gl = renderer.getContext();
const timer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
let query = null;
let gpuMs = null;
let frames = 0;
let since = performance.now();
let fps = 0;
function start() {
  renderer.setAnimationLoop(() => {
    if (query && gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
      if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) {
        const ms = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
        gpuMs = gpuMs === null ? ms : gpuMs + (ms - gpuMs) * 0.1;
      }
      gl.deleteQuery(query);
      query = null;
    }
    const measuring = timer && !query;
    if (measuring) {
      query = gl.createQuery();
      gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
    }
    renderer.info.reset();
    renderer.info.autoReset = false;
    if (aoPass) aoPass.beautyRenderTarget = composer.readBuffer;
    composer.render();
    if (measuring) gl.endQuery(timer.TIME_ELAPSED_EXT);
    frames++;
    const now = performance.now();
    if (now - since >= 500) {
      fps = (frames * 1000) / (now - since);
      frames = 0;
      since = now;
      stats.textContent = `${mode} · ${night ? "night" : "day"}\n${fps.toFixed(0)} fps · GPU ${gpuMs === null ? "n/a" : gpuMs.toFixed(2) + "ms"}\n${renderer.info.render.calls} draws · ${(renderer.info.render.triangles / 1000).toFixed(0)}k triangles`;
      stats.dataset.gpu = gpuMs;
    }
  });
}
