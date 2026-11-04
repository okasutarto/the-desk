import * as THREE from "three";

// A shadow map is the room drawn from its light, yet nearly all of the room holds still: only a
// few props move on their own (`moving`: the plant's sway, the cat, the lanyard...). So each light
// keeps a copy of its map with just the still casters in it, drawn once; an update lays the copy
// back into the map, colour and depth, and draws only the moving props over it, which leaves the
// map a full render draws for a fraction of the walk through the room and of its draws. The copy
// is drawn again once anything in it changes: the light or its shadow camera, a still caster
// moving, showing, hiding or changing shape, the map's size, or a lost context. While that keeps
// changing (a chair being dragged, the light swinging round with the time of day) the map is
// drawn whole, as it always was, and the copy waits for the room to settle.
export function createShadowCache(renderer, scene, lights, moving) {
  const cached = new Set(lights);
  // light → its copy: the target, where the light stood and which still room the copy shows
  const copies = new Map();
  // bumped whenever a still caster changes: every copy drawn before then is out of date
  let stillVersion = 0;
  // (maps laid from a copy, copies drawn and maps drawn whole, for the `?perf` readout)
  const counts = { copied: 0, built: 0, whole: 0 };

  // Every caster outside the moving props (looked for again now and then, for parts added or
  // removed), with what of it reached the shadow maps when last looked at
  const SCAN_MS = 1000;
  const KEY = 23;
  const key = new Float64Array(KEY);
  let still = [];
  let scannedAt = -Infinity;
  function scan() {
    const found = [];
    const visit = (object) => {
      if (moving.has(object)) return;
      if ((object.isMesh || object.isLine || object.isPoints) && object.castShadow) found.push(object);
      for (const child of object.children) visit(child);
    };
    visit(scene);
    if (found.length === still.length && found.every((object, i) => object === still[i].object)) return false;
    still = found.map((object) => ({ object, casts: false, key: new Float64Array(KEY), shown: null }));
    return true;
  }
  // Whether three's shadow pass draws it: casting, on the view's layers, shown all the way up
  const casts = (object, layers) => {
    if (!object.castShadow || !object.layers.test(layers)) return false;
    let o = object;
    for (; o.parent; o = o.parent) if (!o.visible) return false;
    return o === scene && scene.visible;
  };
  // ...and if so, where, its shape and material, and an instanced or batched mesh's instances
  function describe(object, out) {
    const { geometry, material } = object;
    out.set(object.matrixWorld.elements);
    out[16] = geometry.id;
    out[17] = geometry.attributes.position?.version ?? -1;
    out[18] = geometry.index?.version ?? -1;
    // (of a list of materials, which of them show)
    out[19] = Array.isArray(material) ? -material.reduce((shown, m, i) => shown + (m.visible ? 2 ** i : 0), 1) : material.visible ? material.id : 0;
    out[20] = material.side ?? -1;
    out[21] = object.isInstancedMesh ? object.instanceMatrix.version : object.isBatchedMesh ? object._matricesTexture.version : 0;
    out[22] = object.isInstancedMesh ? object.count : 0;
  }
  function changed(record, layers) {
    const { object } = record;
    const now = casts(object, layers);
    if (!now && !record.casts) return false;
    let differs = now !== record.casts;
    record.casts = now;
    if (!now) return true;
    describe(object, key);
    for (let i = 0; i < KEY && !differs; i++) differs = key[i] !== record.key[i];
    if (differs) record.key.set(key);
    if (!object.isBatchedMesh) return differs;
    // (a batch hides and shows its parts itself)
    const shown = object._visibility;
    if (record.shown?.length !== shown.length || shown.some((value, i) => value !== record.shown[i])) {
      record.shown = shown.slice();
      differs = true;
    }
    return differs;
  }
  function stillChanged(layers) {
    const now = performance.now();
    let found = false;
    if (now - scannedAt > SCAN_MS) {
      scannedAt = now;
      found = scan();
      // (a light that has stopped casting hands back its copy)
      copies.forEach((copy, light) => {
        if (light.castShadow || !copy.target) return;
        copy.target.dispose();
        copy.target = null;
        copy.version = -1;
      });
    }
    for (const record of still) if (changed(record, layers)) found = true;
    if (found) stillVersion++;
    return found;
  }

  // Where the light's shadow camera stands, what it takes in, and the map it draws into
  const LIGHT_KEY = 36;
  const lightKey = new Float64Array(LIGHT_KEY);
  function describeLight(light, out) {
    const { shadow } = light;
    shadow.updateMatrices(light, 0);
    out.set(shadow.camera.projectionMatrix.elements);
    out.set(shadow.camera.matrixWorld.elements, 16);
    out[32] = shadow.mapSize.x;
    out[33] = shadow.mapSize.y;
    out[34] = shadow.map.width;
    out[35] = shadow.map.height;
  }

  let shadowMap = null;
  let renderShadows = null;
  let wrapped = null;
  const one = [null];
  // three's own shadow pass, for one light, from `root` down
  function draw(light, root, camera) {
    one[0] = light;
    light.shadow.needsUpdate = true;
    renderShadows.call(shadowMap, one, root, camera);
  }
  // The still room into the light's copy: the moving props sit out the one draw
  function drawStill(light, copy, camera) {
    const { shadow } = light;
    const map = shadow.map;
    if (copy.target?.width !== map.width || copy.target?.height !== map.height) {
      copy.target?.dispose();
      // (made as three makes the map itself, so the two copy into each other)
      copy.target = new THREE.WebGLRenderTarget(map.width, map.height, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    }
    const roots = [...moving];
    const shown = roots.map((object) => object.visible);
    roots.forEach((object) => (object.visible = false));
    shadow.map = copy.target;
    try {
      draw(light, scene, camera);
    } finally {
      shadow.map = map;
      roots.forEach((object, i) => (object.visible = shown[i]));
    }
    copy.version = stillVersion;
  }
  // The copy laid back into the map, colour and depth both, so the moving props are drawn into it
  // just as they would be among the still ones
  function lay(from, to) {
    const gl = renderer.getContext();
    const { state, properties } = renderer;
    renderer.setRenderTarget(to);
    state.bindFramebuffer(gl.READ_FRAMEBUFFER, properties.get(from).__webglFramebuffer);
    state.setScissorTest(false);
    state.buffers.color.setMask(true);
    state.buffers.depth.setMask(true);
    gl.blitFramebuffer(0, 0, from.width, from.height, 0, 0, to.width, to.height, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    state.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  }
  // A moving prop the scene's pass would reach: shown all the way up, and not inside another
  // moving prop (which draws it)
  const reached = (object) => {
    let o = object;
    for (; o.parent; o = o.parent) if (!o.visible || (o !== object && moving.has(o))) return false;
    return o === scene && scene.visible;
  };
  // The moving props, as the root of a pass of their own (it never joins the scene)
  const stirring = { visible: true, layers: new THREE.Layers(), children: [] };
  const keep = () => {};
  function drawMoving(light, camera) {
    stirring.children.length = 0;
    moving.forEach((object) => reached(object) && stirring.children.push(object));
    if (!stirring.children.length) return (light.shadow.needsUpdate = false);
    // (three clears a map before drawing into it; this one holds the still room already)
    const clear = renderer.clear;
    renderer.clear = keep;
    try {
      draw(light, stirring, camera);
    } finally {
      renderer.clear = clear;
    }
  }
  function update(light, camera, stirred) {
    let copy = copies.get(light);
    if (!copy) copies.set(light, (copy = { target: null, key: new Float64Array(LIGHT_KEY).fill(NaN), version: -1 }));
    const { shadow } = light;
    if (shadow.map) describeLight(light, lightKey);
    if (!shadow.map || stirred || lightKey.some((value, i) => value !== copy.key[i])) {
      copy.version = -1;
      draw(light, scene, camera);
      describeLight(light, copy.key);
      counts.whole++;
      return;
    }
    if (copy.version !== stillVersion) {
      drawStill(light, copy, camera);
      counts.built++;
    }
    lay(copy.target, shadow.map);
    drawMoving(light, camera);
    counts.copied++;
  }

  const due = [];
  const others = [];
  // In the renderer's own shadow pass, so the room's matrices are fresh and the overlay pass (no
  // shadow updates) passes by
  function install() {
    if (renderer.shadowMap === shadowMap) return;
    shadowMap = renderer.shadowMap;
    renderShadows = shadowMap.render;
    wrapped = (list, root, camera) => {
      if (!cache.enabled || !shadowMap.enabled || (!shadowMap.autoUpdate && !shadowMap.needsUpdate) || root !== scene) return renderShadows.call(shadowMap, list, root, camera);
      due.length = others.length = 0;
      for (const light of list) (cached.has(light) && (light.shadow.autoUpdate || light.shadow.needsUpdate) ? due : others).push(light);
      if (due.length) {
        const target = renderer.getRenderTarget();
        const face = renderer.getActiveCubeFace();
        const level = renderer.getActiveMipmapLevel();
        const stirred = stillChanged(camera.layers);
        for (const light of due) update(light, camera, stirred);
        renderer.setRenderTarget(target, face, level);
      }
      renderShadows.call(shadowMap, others, root, camera);
    };
    shadowMap.render = wrapped;
  }
  // A restored context comes with a new shadow pass, and without the copies
  const restored = () => {
    install();
    stillVersion++;
  };
  const cache = {
    enabled: true,
    counts,
    dispose() {
      renderer.domElement.removeEventListener("webglcontextrestored", restored);
      if (shadowMap.render === wrapped) shadowMap.render = renderShadows;
      copies.forEach((copy) => copy.target?.dispose());
      copies.clear();
    },
  };
  install();
  renderer.domElement.addEventListener("webglcontextrestored", restored);
  return cache;
}
