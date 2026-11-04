import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

function shadowGeometry(source, simplify) {
  if (simplify && source instanceof RoundedBoxGeometry) {
    source.computeBoundingBox();
    const size = source.boundingBox.getSize(new THREE.Vector3());
    const center = source.boundingBox.getCenter(new THREE.Vector3());
    const box = new THREE.BoxGeometry(size.x, size.y, size.z);
    box.translate(center.x, center.y, center.z);
    box.deleteAttribute("normal");
    box.deleteAttribute("uv");
    return box;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", source.attributes.position);
  if (source.index) geometry.setIndex(source.index);
  else geometry.setIndex(Array.from({ length: source.attributes.position.count }, (_, i) => i));
  return geometry;
}

// One native draw per kind of opaque toon part, in both colour and shadow passes: the plain
// ones, and those printed with a texture many of them share (the shelf's grain, say). A kind is
// its texture, toon ramp and whether it receives shadows; its casters also share one shadow
// draw. A texture worn by only a few parts isn't worth a batch of its own. Colours travel as
// vertex colours over the same texture, so every part looks exactly as it does on its own.
// Original meshes remain in the hierarchy for animation, outlines and ray picking (layer 2).
// Outlines are batched the same way, one draw per line weight (see createOutlineBatch).
const MIN_SHARED = 4;

// Parts with a face lying on another part's face, facing the same way (a plank flush with the
// shelf's side, a panel laid over the wall), show whichever of the two is drawn last. Batched,
// that order would change, so those parts are drawn on their own. (Plain parts have always been
// batched together, flush or not, and look no different for it: only pairs with a printed part
// count.) Each pair is compared in one part's own frame, where both line up exactly when they're
// square to each other; parts at any other angle can't share such a face.
const EPS = 1e-4;
function sharesFace(a, b) {
  const span = ["x", "y", "z"].map((k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]));
  if (span.some((size) => size < -EPS)) return false;
  return ["x", "y", "z"].some((k, n) => span.every((size, m) => m === n || size > EPS) &&
    (Math.abs(a.min[k] - b.min[k]) < EPS || Math.abs(a.max[k] - b.max[k]) < EPS));
}
function findFlush(scene) {
  scene.updateMatrixWorld(true);
  const parts = [];
  scene.traverse((object) => {
    const materials = [].concat(object.material);
    if (!object.isMesh || object.isBatchedMesh || materials.some((m) => m.isShaderMaterial || m.transparent)) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    parts.push({ object, printed: materials.some((m) => m.map), world: new THREE.Box3().setFromObject(object), inverse: object.matrixWorld.clone().invert() });
  });
  const flush = new Set();
  const relative = new THREE.Matrix4();
  const local = new THREE.Box3();
  const square = (e) => [0, 4, 8].every((c) => {
    const len = Math.hypot(e[c], e[c + 1], e[c + 2]);
    return Math.max(Math.abs(e[c]), Math.abs(e[c + 1]), Math.abs(e[c + 2])) > len * (1 - EPS);
  });
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      if (!parts[i].printed && !parts[j].printed) continue;
      // (most pairs are nowhere near each other)
      if (!parts[i].world.intersectsBox(parts[j].world)) continue;
      relative.multiplyMatrices(parts[i].inverse, parts[j].object.matrixWorld);
      if (!square(relative.elements)) continue;
      local.copy(parts[j].object.geometry.boundingBox).applyMatrix4(relative);
      if (sharesFace(parts[i].object.geometry.boundingBox, local)) flush.add(parts[i].object).add(parts[j].object);
    }
  }
  return flush;
}

export function createToonBatch(scene, renderer, track, moving = new Set()) {
  if (!renderer.capabilities.isWebGL2 || !renderer.extensions.has("WEBGL_multi_draw")) return () => {};
  const kinds = new Map();
  const flush = findFlush(scene);
  scene.traverse((object) => {
    const m = object.material;
    if (!object.isMesh || flush.has(object) || object.isSkinnedMesh || object.isInstancedMesh || object.renderOrder !== 0 ||
      !m?.isMeshToonMaterial || m.side !== THREE.FrontSide || m.shadowSide !== null || m.transparent ||
      m.opacity !== 1 || !m.depthWrite || !m.depthTest || m.vertexColors || m.emissiveMap || m.normalMap || m.bumpMap ||
      m.alphaTest || m.alphaMap || m.displacementMap || m.lightMap || m.aoMap || m.wireframe || m.flatShading || m.polygonOffset ||
      (m.map && !object.geometry.attributes.uv) ||
      object.customDepthMaterial || object.customDistanceMaterial || !object.geometry.attributes.normal || object.geometry.morphAttributes.position?.length) return;
    const key = `${m.map?.uuid}|${m.gradientMap?.uuid}|${object.receiveShadow}`;
    if (!kinds.has(key)) kinds.set(key, { map: m.map, gradient: m.gradientMap, receive: object.receiveShadow, objects: [] });
    kinds.get(key).objects.push(object);
  });
  const updates = [...kinds.values()]
    .filter((kind) => !kind.map || kind.objects.length >= MIN_SHARED)
    .map((kind) => createBatch(scene, track, kind, moving));
  const inks = new Map();
  scene.traverse((object) => {
    const m = object.material;
    if (!object.isMesh || object.isInstancedMesh || object.renderOrder !== 0 || !m?.isShaderMaterial || !m.uniforms?.thickness || !m.uniforms?.resolution || !object.geometry.attributes.normal) return;
    // (cards and bubbles drawn over everything take their outlines along; see renderFrame)
    for (let parent = object.parent; parent; parent = parent.parent) if (parent.material?.depthTest === false) return;
    if (!inks.has(m)) inks.set(m, []);
    inks.get(m).push(object);
  });
  inks.forEach((hulls, ink) => updates.push(createOutlineBatch(scene, track, ink, hulls)));
  return () => {
    if (!updates.length) return;
    scene.updateMatrixWorld();
    updates.forEach((update) => update());
  };
}

function createBatch(scene, track, { map, gradient, receive, objects }, moving) {
  const entries = objects.map((object) => {
    const source = object.geometry;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", source.attributes.position);
    geometry.setAttribute("normal", source.attributes.normal);
    if (map) geometry.setAttribute("uv", source.attributes.uv);
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(source.attributes.position.count * 3), 3));
    if (source.index) geometry.setIndex(source.index);
    else geometry.setIndex(Array.from({ length: source.attributes.position.count }, (_, i) => i));
    // (printed parts keep their exact shadow; plain rounded boxes cast a plain box's)
    const cast = object.castShadow;
    const shadow = cast ? shadowGeometry(source, !map) : null;
    return { object, geometry, cast, shadow, positionVersion: -1, normalVersion: -1, color: new THREE.Color(-1, -1, -1), matrix: new THREE.Matrix4(), visible: null };
  });
  const material = track(new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradient, map, vertexColors: true }));
  const vertices = entries.reduce((n, entry) => n + entry.geometry.attributes.position.count, 0);
  const indices = entries.reduce((n, entry) => n + entry.geometry.index.count, 0);
  const batch = track(new THREE.BatchedMesh(entries.length, vertices, indices, material));
  batch.receiveShadow = receive;
  batch.frustumCulled = batch.perObjectFrustumCulled = false;
  batch.raycast = () => {};
  // Where two parts of one material lie exactly on top of each other, whichever is drawn last
  // shows. The batch draws its parts in the renderer's own order (material, then depth from the
  // front, then creation) so the same one shows as when each part was drawn on its own.
  const byStart = new Map();
  const projection = new THREE.Matrix4();
  const origin = new THREE.Vector3();
  batch.sortObjects = true;
  batch.customSort = (list, camera) => {
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    list.forEach((item) => (item.z = origin.setFromMatrixPosition(byStart.get(item.start).matrixWorld).applyMatrix4(projection).z));
    list.sort((a, b) => {
      const p = byStart.get(a.start), q = byStart.get(b.start);
      return p.material.id - q.material.id || a.z - b.z || p.id - q.id;
    });
  };
  // Casters inside one of `moving`'s props (those that move on their own) cast through a shadow
  // batch of their own, which then joins them: a cached shadow map (see shadowCache) keeps the
  // still batch from one update to the next and draws the moving one every time
  const stirs = (object) => {
    for (let o = object; o; o = o.parent) if (moving.has(o)) return true;
    return false;
  };
  const casters = entries.filter((entry) => entry.cast);
  const shadowMaterial = casters.length ? track(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })) : null;
  const shadowBatch = (list) => {
    const shadowVertices = list.reduce((n, entry) => n + entry.shadow.attributes.position.count, 0);
    const shadowIndices = list.reduce((n, entry) => n + entry.shadow.index.count, 0);
    const shadows = track(new THREE.BatchedMesh(list.length, shadowVertices, shadowIndices, shadowMaterial));
    shadows.castShadow = true;
    shadows.frustumCulled = shadows.sortObjects = false;
    shadows.raycast = () => {};
    const prepareShadow = shadows.onBeforeRender;
    shadows.onBeforeShadow = (renderer, object, camera, shadowCamera, geometry, material) => {
      shadows.geometry.setDrawRange(0, Infinity);
      prepareShadow.call(shadows, renderer, null, shadowCamera, geometry, material);
    };
    shadows.onBeforeRender = () => shadows.geometry.setDrawRange(0, 0);
    list.forEach((entry) => (entry.shadows = shadows));
    return shadows;
  };
  const stirring = casters.filter((entry) => stirs(entry.object));
  const shadowBatches = [casters.filter((entry) => !stirs(entry.object)), stirring].filter((list) => list.length).map(shadowBatch);
  if (stirring.length) moving.add(stirring[0].shadows);
  entries.forEach((entry) => {
    entry.id = batch.addGeometry(entry.geometry);
    // (three keeps each part's place in the batch's buffers private; it never moves)
    byStart.set(batch._drawRanges[entry.id].start, entry.object);
    if (entry.cast) entry.shadowId = entry.shadows.addGeometry(entry.shadow);
  });
  scene.add(batch);
  shadowBatches.forEach((shadows) => scene.add(shadows));
  return () => {
    entries.forEach((entry) => {
      const { object, geometry, id } = entry;
      const m = object.material;
      // Animated emissive surfaces use their original material for as long as they glow.
      const supported = m.isMeshToonMaterial && m.map === map && m.gradientMap === gradient && !m.emissiveMap && !m.transparent && m.opacity === 1 &&
        m.emissive.r === 0 && m.emissive.g === 0 && m.emissive.b === 0 && object.castShadow === entry.cast && object.receiveShadow === receive;
      object.layers.enable(2);
      if (supported) object.layers.disable(0);
      else object.layers.enable(0);
      let visible = m.visible && supported;
      for (let parent = object; parent && visible; parent = parent.parent) visible = parent.visible;
      if (visible !== entry.visible) {
        batch.setVisibleAt(id, visible);
        if (entry.cast) entry.shadows.setVisibleAt(entry.shadowId, visible);
        entry.visible = visible;
      }
      if (!supported) return;
      if (!entry.matrix.equals(object.matrixWorld)) {
        entry.matrix.copy(object.matrixWorld);
        batch.setMatrixAt(id, entry.matrix);
        if (entry.cast) entry.shadows.setMatrixAt(entry.shadowId, entry.matrix);
      }
      let changed = false;
      if (!entry.color.equals(m.color)) {
        entry.color.copy(m.color);
        const colors = geometry.attributes.color;
        for (let i = 0; i < colors.count; i++) colors.setXYZ(i, m.color.r, m.color.g, m.color.b);
        changed = true;
      }
      const source = object.geometry.attributes;
      if (changed || source.position.version !== entry.positionVersion || source.normal.version !== entry.normalVersion) {
        batch.setGeometryAt(id, geometry);
        if (entry.cast && source.position.version !== entry.positionVersion) {
          const next = shadowGeometry(object.geometry, !map);
          entry.shadows.setGeometryAt(entry.shadowId, next);
          entry.shadow.dispose();
          entry.shadow = next;
        }
        entry.positionVersion = source.position.version;
        entry.normalVersion = source.normal.version;
      }
    });
  };
}

// Every prop's ink hull of one line weight in one draw. The batch shares the weight's uniforms
// (its width, the screen size, its colour), so it draws exactly what each hull would. Hulls are
// all the same black, so the order they're drawn in can't change a pixel.
function createOutlineBatch(scene, track, ink, hulls) {
  const entries = hulls.map((hull) => {
    const source = hull.geometry;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", source.attributes.position);
    geometry.setAttribute("normal", source.attributes.normal);
    if (source.index) geometry.setIndex(source.index);
    else geometry.setIndex(Array.from({ length: source.attributes.position.count }, (_, i) => i));
    return { hull, source, geometry, positionVersion: source.attributes.position.version, normalVersion: source.attributes.normal.version, matrix: new THREE.Matrix4(), visible: null };
  });
  const material = track(new THREE.ShaderMaterial({ uniforms: ink.uniforms, vertexShader: ink.vertexShader, fragmentShader: ink.fragmentShader, side: ink.side }));
  const vertices = entries.reduce((n, entry) => n + entry.geometry.attributes.position.count, 0);
  const indices = entries.reduce((n, entry) => n + entry.geometry.index.count, 0);
  const batch = track(new THREE.BatchedMesh(entries.length, vertices, indices, material));
  batch.frustumCulled = batch.perObjectFrustumCulled = batch.sortObjects = false;
  batch.raycast = () => {};
  entries.forEach((entry) => (entry.id = batch.addGeometry(entry.geometry)));
  scene.add(batch);
  return () => {
    entries.forEach((entry) => {
      const { hull, id } = entry;
      const supported = hull.material === ink && hull.geometry === entry.source;
      if (supported) hull.layers.disable(0);
      else hull.layers.enable(0);
      let visible = supported;
      for (let parent = hull; parent && visible; parent = parent.parent) visible = parent.visible;
      if (visible !== entry.visible) {
        batch.setVisibleAt(id, visible);
        entry.visible = visible;
      }
      if (!visible) return;
      if (!entry.matrix.equals(hull.matrixWorld)) {
        entry.matrix.copy(hull.matrixWorld);
        batch.setMatrixAt(id, entry.matrix);
      }
      const source = hull.geometry.attributes;
      if (source.position.version !== entry.positionVersion || source.normal.version !== entry.normalVersion) {
        batch.setGeometryAt(id, entry.geometry);
        entry.positionVersion = source.position.version;
        entry.normalVersion = source.normal.version;
      }
    });
  };
}
