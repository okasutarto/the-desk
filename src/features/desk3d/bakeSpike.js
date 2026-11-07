// Bake spike (spike/bake/README.md), development only: `?bake=export` hands the room's static
// meshes and its key lights to spike/bake/export_room.cjs; `?bake=apply` lays the shadow mask
// bake_existing.py made from them over the room, in place of its shadow maps and N8AO.
//
// The mask holds, per texel, how much of each key light reaches it (R the sun, G the window's
// light, B the desk lamp) and the ambient occlusion (A). The lights themselves still shine at
// runtime through the toon ramp, at whatever colour and strength the hour gives them; only
// their shadows come from the bake. Use with `?perf&bench=no-batch`: the toon batches copy
// their parts' geometry before the mask arrives.
import * as THREE from "three";

const OUT = "/spike/bake/existing-out";
const MAX_LIGHTS = 16;

// Props that move, are dragged or are put back somewhere else. They stay out of the bake (a
// shadow baked where they stood would stay behind) and keep casting through the shadow maps,
// which then hold nothing else.
function movingProps(runtime) {
  const roots = new Set();
  const add = (value) => {
    if (!value) return;
    if (value.isObject3D) roots.add(value);
    else if (Array.isArray(value)) value.forEach(add);
    else if (typeof value === "object") Object.values(value).forEach((v) => v?.isObject3D && roots.add(v));
  };
  [runtime.chair.chair, runtime.cat.catModel, runtime.mouse.mouse, runtime.strawHat.hatPeg, runtime.badge.badge,
    runtime.lamp.lamp, runtime.wastebasket.papers, runtime.aboutBoard.boardNotes, runtime.projectFiles.folders,
    runtime.tickets.tickets, runtime.postcard.mail, runtime.robot.robot].forEach(add);
  return roots;
}
const under = (object, roots) => {
  for (let o = object; o; o = o.parent) if (roots.has(o)) return true;
  return false;
};

// The meshes the bake covers, in a fixed order both modes share. Receivers are lit (they get a
// place in the mask's atlas); the rest only cast. Outlines, glows, see-through parts and moving
// props don't take part.
function bakedMeshes(scene, movers) {
  const list = [];
  const visible = (object) => {
    for (let o = object; o; o = o.parent) if (!o.visible) return false;
    return true;
  };
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!object.isMesh || object.isBatchedMesh || object.isInstancedMesh || object.isSkinnedMesh || !visible(object) || under(object, movers)) return;
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    if (!material || material.isShaderMaterial || material.transparent || material.depthTest === false || material.colorWrite === false) return;
    list.push({ object, material, receiver: !material.isMeshBasicMaterial && object.receiveShadow !== false });
  });
  return list;
}

function exportRoom(runtime) {
  const movers = movingProps(runtime);
  const meshes = bakedMeshes(runtime.core.scene, movers);
  let floats = 0;
  meshes.forEach(({ object }) => (floats += (object.geometry.index ? object.geometry.index.count : object.geometry.attributes.position.count) * 3));
  const positions = new Float32Array(floats);
  const v = new THREE.Vector3();
  let at = 0;
  const header = meshes.map(({ object, receiver }) => {
    const position = object.geometry.attributes.position;
    const index = object.geometry.index;
    const count = index ? index.count : position.count;
    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(object.matrixWorld);
      positions[at++] = v.x;
      positions[at++] = v.y;
      positions[at++] = v.z;
    }
    return { name: object.name || object.parent?.name || "", receiver, count };
  });
  const light = (key, l, soft) => {
    l.updateMatrixWorld();
    return { key, type: l.type, position: l.getWorldPosition(new THREE.Vector3()).toArray(), soft };
  };
  const lights = [
    light("sun", runtime.core.sun, 2.5),
    light("window", runtime.windowLighting.windowLight, 1.2),
    light("lamp", runtime.lamp.lampLight, 0.15),
  ];
  const bytes = new Uint8Array(positions.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { header: { meshes: header, lights }, positions: btoa(binary) };
}

// Each spot and point light's share of the mask, in the order three lays the lights out for
// the shader (shadow casters first, then lights with a projected map, otherwise scene order)
function maskSelectors(runtime, camera, spotSel, pointSel) {
  const lights = [];
  const visit = (object) => {
    if (!object.visible) return;
    if (object.isLight && object.layers.test(camera.layers)) lights.push(object);
    object.children.forEach(visit);
  };
  visit(runtime.core.scene);
  lights.sort((a, b) => (b.castShadow ? 2 : 0) - (a.castShadow ? 2 : 0) + (b.map ? 1 : 0) - (a.map ? 1 : 0));
  const channel = new Map([[runtime.core.sun, 0], [runtime.windowLighting.windowLight, 1], [runtime.lamp.lampLight, 2]]);
  let spots = 0;
  let points = 0;
  lights.forEach((l) => {
    const target = l.isSpotLight ? spotSel[spots++] : l.isPointLight ? pointSel[points++] : null;
    if (!target) return;
    const c = channel.get(l);
    target.set(c === 0 ? 1 : 0, c === 1 ? 1 : 0, c === 2 ? 1 : 0, c === undefined ? 1 : 0);
  });
}

function patchMaterial(material, uniforms) {
  if (material.userData.bakeMask) return;
  material.userData.bakeMask = true;
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    before?.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 bakeUv;\nvarying vec2 vBakeUv;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvBakeUv = bakeUv;");
    const sel = (kind) => `directLight.color *= mix( 1.0, dot( vec4( bakeTexel.rgb, 1.0 ), ${kind}[ i ] ), bakeUse );\n\t\tRE_Direct(`;
    const parts = THREE.ShaderChunk.lights_fragment_begin.split("RE_Direct(");
    // (the point lights' loop comes first, then the spot lights'; the directional loop is left alone)
    const lights = parts[0] + sel("bakePointSel") + parts[1] + sel("bakeSpotSel") + parts.slice(2).join("RE_Direct(");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nuniform sampler2D bakeMask;\nuniform sampler2D bakeAo;\nuniform vec4 bakeSpotSel[ ${MAX_LIGHTS} ];\nuniform vec4 bakePointSel[ ${MAX_LIGHTS} ];\nuniform float bakeAoPower;\nuniform float bakeOn;\nvarying vec2 vBakeUv;`)
      // (a mesh with no place in the atlas, a moving prop sharing the material, reads -1: unbaked)
      .replace("#include <lights_fragment_begin>", `vec4 bakeTexel = texture2D( bakeMask, vBakeUv );\nfloat bakeUse = bakeOn * step( 0.0, vBakeUv.x );\n${lights}`)
      .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\nfloat bakeAo = mix( 1.0, pow( texture2D( bakeAo, vBakeUv ).r, bakeAoPower ), bakeUse );\nreflectedLight.directDiffuse *= bakeAo;\nreflectedLight.indirectDiffuse *= bakeAo;");
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => (key ? key() : "") + "|bakeMask";
  material.needsUpdate = true;
}

async function applyBake(runtime) {
  const [header, uvs, mask, ao] = await Promise.all([
    fetch(`${OUT}/uvs.json`).then((r) => r.json()),
    fetch(`${OUT}/uvs.bin`).then((r) => r.arrayBuffer()).then((b) => new Float32Array(b)),
    new THREE.TextureLoader().loadAsync(`${OUT}/shadow.png`),
    new THREE.TextureLoader().loadAsync(`${OUT}/ao.png`),
  ]);
  [mask, ao].forEach((texture) => {
    texture.colorSpace = THREE.NoColorSpace;
    texture.anisotropy = 4;
  });
  const spotSel = Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4(0, 0, 0, 1));
  const pointSel = Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4(0, 0, 0, 1));
  const uniforms = { bakeMask: { value: mask }, bakeAo: { value: ao }, bakeSpotSel: { value: spotSel }, bakePointSel: { value: pointSel }, bakeAoPower: { value: Number(new URLSearchParams(location.search).get("aoPower") || 1) }, bakeOn: { value: 1 } };
  const movers = movingProps(runtime);
  const meshes = bakedMeshes(runtime.core.scene, movers);
  if (meshes.length !== header.meshes.length) console.warn(`[bake] ${meshes.length} meshes now, ${header.meshes.length} when exported`);
  const claimed = new Set();
  let at = 0;
  let applied = 0;
  meshes.forEach(({ object, material, receiver }, n) => {
    const entry = header.meshes[n];
    if (!entry) return;
    const count = entry.count;
    if (!entry.receiver || !receiver) {
      if (entry.receiver) at += count * 2;
      return;
    }
    // one unwrapped vertex per corner of each triangle, so the geometry is drawn unindexed;
    // one that another receiver already took is copied, as each needs its own place in the mask
    let geometry = object.geometry;
    if (claimed.has(geometry)) geometry = object.geometry = geometry.clone();
    claimed.add(geometry);
    if (geometry.index) {
      const flat = geometry.toNonIndexed();
      Object.keys(geometry.attributes).forEach((name) => geometry.setAttribute(name, flat.attributes[name]));
      geometry.setIndex(null);
    }
    if (geometry.attributes.position.count !== count) {
      console.warn(`[bake] mesh ${n} has ${geometry.attributes.position.count} corners, ${count} baked`);
      at += count * 2;
      return;
    }
    geometry.setAttribute("bakeUv", new THREE.BufferAttribute(uvs.subarray(at, at + count * 2), 2));
    at += count * 2;
    patchMaterial(material, uniforms);
    applied++;
  });
  const scene = runtime.core.scene;
  // Everything else wearing a patched material (the moving props among them) is marked unbaked
  const baked = new Set(meshes.filter(({ object }) => object.geometry.attributes.bakeUv).map(({ object }) => object));
  let unbaked = 0;
  scene.traverse((object) => {
    if (!object.isMesh || baked.has(object) || ![].concat(object.material).some((m) => m?.userData.bakeMask)) return;
    if (object.geometry.attributes.bakeUv) object.geometry = object.geometry.clone();
    const corners = object.geometry.attributes.position.count;
    object.geometry.setAttribute("bakeUv", new THREE.BufferAttribute(new Float32Array(corners * 2).fill(-1), 2));
    unbaked++;
  });
  const blobs = createBlobShadows(runtime, meshes.map(({ object }) => object));
  window.__bake.blobs = blobs;
  const previous = scene.onBeforeRender;
  scene.onBeforeRender = (renderer, s, camera, ...rest) => {
    maskSelectors(runtime, camera, spotSel, pointSel);
    if (uniforms.bakeOn.value) blobs.update();
    previous.call(scene, renderer, s, camera, ...rest);
  };
  console.info(`[bake] mask applied to ${applied} meshes; ${unbaked} others marked unbaked; ${movers.size} moving props; ${blobs.count} blob shadows`);
  // Baked, the mask stands in for N8AO and every shadow map; the moving props that stand on
  // something get a blob shadow instead. Switched off, the room is as it was.
  return (on) => {
    uniforms.bakeOn.value = on ? 1 : 0;
    runtime.core.renderer.shadowMap.enabled = !on;
    runtime.core.aoPass.enabled = !on;
    blobs.show(on);
    if (!on) runtime.core.refreshAO(true);
    scene.traverse((o) => o.material && (o.material.needsUpdate = true));
  };
}

// Fake shadows for the moving props, as Bruno Simon's 2019 folio has them: a soft dark patch on
// whatever a prop stands on, turned with the prop, pushed away from the key light the higher the
// prop is, and fading as it's lifted. One per prop that rests on a level surface; what hangs on
// the wall (the hat, the badge, the notes) gets none.
function createBlobShadows(runtime, statics) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(0,0,0,1)");
  gradient.addColorStop(0.55, "rgba(0,0,0,0.75)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = runtime.core.track(new THREE.CanvasTexture(canvas));
  const plane = runtime.core.track(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const roots = [runtime.chair.chair, runtime.cat.catModel, runtime.mouse.mouse, runtime.lamp.lamp, runtime.robot.robot, runtime.postcard.mail]
    .concat(runtime.projectFiles.folders, runtime.tickets.tickets, runtime.wastebasket.papers)
    .map((item) => (item?.isObject3D ? item : Object.values(item || {}).find((v) => v?.isObject3D)))
    .filter(Boolean);
  const raycaster = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const box = new THREE.Box3();
  const centre = new THREE.Vector3();
  const size = new THREE.Vector3();
  const lightAt = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const hits = [];
  const ground = (from, below) => {
    raycaster.set(from, down);
    hits.length = 0;
    statics.forEach((mesh) => THREE.Mesh.prototype.raycast.call(mesh, raycaster, hits));
    hits.sort((a, b) => a.distance - b.distance);
    return hits.find((hit) => hit.point.y <= below + 0.05 && hit.face && Math.abs(hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y) > 0.7);
  };
  const blobs = roots.map((root) => {
    box.setFromObject(root);
    box.getSize(size);
    const material = runtime.core.track(new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    const mesh = new THREE.Mesh(plane, material);
    mesh.renderOrder = 1;
    mesh.visible = false;
    mesh.raycast = () => {};
    runtime.core.scene.add(mesh);
    // the footprint at rest, in the prop's own turn
    const yaw = new THREE.Euler().setFromQuaternion(root.getWorldQuaternion(new THREE.Quaternion()), "YXZ").y;
    return { root, mesh, width: Math.max(size.x, 0.4) * 1.15, depth: Math.max(size.z, 0.4) * 1.15, yaw, last: "" };
  });
  let on = false;
  return {
    count: blobs.length,
    list: blobs,
    show(value) {
      on = value;
      blobs.forEach((blob) => (blob.last = ""));
    },
    update() {
      const night = runtime.core.roomLight.night > 0.5 && runtime.lamp.lampLight.intensity > 0;
      (night ? runtime.lamp.lampLight : runtime.windowLighting.windowLight).getWorldPosition(lightAt);
      blobs.forEach((blob) => {
        const { root, mesh } = blob;
        root.updateWorldMatrix(true, true);
        const key = root.matrixWorld.elements.map((v) => v.toFixed(3)).join() + night;
        if (key === blob.last) return;
        blob.last = key;
        box.setFromObject(root);
        box.getCenter(centre);
        // (the first level surface under the prop's middle: a box's foot can reach just below it)
        const hit = on && root.visible && ground(centre.clone().setY(box.max.y + 0.1), centre.y);
        mesh.visible = Boolean(hit);
        if (!hit) return;
        const lift = Math.max(0, box.min.y - hit.point.y);
        // pushed away from the light by how high the prop's middle stands
        axis.subVectors(centre, lightAt).setY(0).normalize().multiplyScalar(Math.min((centre.y - hit.point.y) * 0.35, 1.5));
        mesh.position.copy(hit.point).add(axis);
        mesh.position.y += 0.01;
        const yaw = new THREE.Euler().setFromQuaternion(root.getWorldQuaternion(new THREE.Quaternion()), "YXZ").y;
        mesh.rotation.y = yaw - blob.yaw;
        const spread = 1 + lift * 0.15;
        mesh.scale.set(blob.width * spread, 1, blob.depth * spread);
        mesh.material.opacity = (night ? 0.55 : 0.4) * Math.max(0, 1 - lift / 6);
      });
    },
  };
}

// A button in the corner switches between the baked mask and the room's own shadows and AO
function bakeButton(runtime) {
  const button = document.createElement("button");
  button.style.cssText = "position:fixed;top:12px;right:12px;z-index:100;padding:8px 14px;font:600 14px ui-monospace,monospace;border:2px solid #000;background:#ffe14d;color:#000;cursor:pointer";
  let toggle = null;
  let on = false;
  const label = () => (button.textContent = toggle ? (on ? "BAKED · click for normal" : "NORMAL · click for baked") : "Apply bake");
  label();
  button.addEventListener("click", async () => {
    if (!toggle) {
      button.textContent = "Loading bake…";
      toggle = await applyBake(runtime);
    }
    on = !on;
    toggle(on);
    label();
  });
  document.body.appendChild(button);
}

export function startBakeSpike(runtime) {
  const mode = new URLSearchParams(location.search).get("bake");
  // (the runtime too, so a check can move a prop by hand)
  window.__bake = { ready: false, runtime };
  if (mode === "export") {
    window.__bake.export = () => exportRoom(runtime);
    window.__bake.ready = true;
  } else if (mode === "apply") {
    // (called once in the room, as the export was: which meshes are showing changes on entering)
    window.__bake.apply = () => applyBake(runtime).then((toggle) => (toggle(true), (window.__bake.applied = true)), (error) => (window.__bake.error = String(error)));
    window.__bake.ready = true;
    bakeButton(runtime);
  }
}
