// Run: node scripts/check-desk-times-gate.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('three');
const root = `${__dirname}/../src/features/desk3d/`;
const finishes = fs.readFileSync(root + 'timesGateFinishes.js', 'utf8').replace(/export /g, '');
const source = fs.readFileSync(root + 'scene/timesGate.js', 'utf8').replace(/^import [\s\S]*?;\n/gm, '').replace('export function', 'function');
const textures = [];
const draws = [];
let handlers;
let chirps = 0;
const ctx = new Proxy({}, { get: (_, key) => key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {} });
const glows = [];
const runtime = {
  options: { timesGateFinish: 'silver' },
  room: { neonLight: (color, max, level, opts) => {
    const light = new THREE.PointLight(color, 0, opts.distance);
    glows.push({ light, max, level, tint: opts.tint });
    return light;
  } },
  weather: { refreshWeather() {} },
  core: {
    scene: new THREE.Scene(), roomLight: { night: 0 }, destroyed: true,
    track: x => x, toon: color => new THREE.MeshToonMaterial({ color }),
    mesh: (geometry, material) => new THREE.Mesh(geometry, material),
    rbox: (w, h, d) => new THREE.BoxGeometry(w, h, d),
    phoneSlab: (w, h, d) => new THREE.BoxGeometry(w, h, d),
    rod: (a, b, radius, material) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 8), material);
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      return mesh;
    },
    noRaycast() {}, register: (_, h) => { handlers = h; },
  },
};
const sandbox = {
  THREE, runtime, console, performance, process, GATE_PX: 128,
  document: { createElement: () => ({ getContext: () => null }) },
  fetch: () => new Promise(() => {}), sessionStorage: { getItem: () => null },
  canvasTexture: () => { const texture = new THREE.Texture(); textures.push(texture); return { ctx, texture }; },
  drawBrushedMetal() {}, hoverSound() {}, sfx: { chirp: () => chirps++ },
  gsap: { to(target, values) {
    for (const axis of ['x', 'y', 'z']) if (axis in values) target[axis] = values[axis];
    values.onUpdate?.();
  }, fromTo() {} },
};
let performance_ = null;
for (const widget of ['Weather', 'Github', 'Visitors', 'Performance', 'Pet']) {
  sandbox['drawGate' + widget] = (c, values) => {
    draws.push(widget);
    if (widget === 'Performance') performance_ = values;
  };
}
const model = vm.runInNewContext(finishes + source + '; createTimesGate(runtime)', sandbox);
assert.equal(handlers.focus, 'timesgate');
assert.equal(glows.length, 1, 'one glow for the screens; the arc strips cast none');
const dayGlow = glows.map(g => g.level());
runtime.core.roomLight.night = 1;
glows.forEach((g, i) => assert.ok(g.level() > dayGlow[i] * 2, 'the glow comes up at night'));
runtime.core.roomLight.night = 0;
assert.equal(draws.join(','), 'Weather,Github,Visitors,Performance,Pet');
const modules = [];
model.gate.traverse(part => { if (part.name.startsWith('times-gate-module-')) modules.push(part); });
assert.equal(modules.length, 5);
const materials = new Set();
const geometry = new Set();
model.gate.traverse(part => {
  if (!part.isMesh) return;
  materials.add(part.material);
  geometry.add(part.geometry);
  assert.ok([...part.geometry.attributes.position.array].every(Number.isFinite), 'all model vertices are finite');
});
const size = new THREE.Box3().setFromObject(model.gate).getSize(new THREE.Vector3());
assert.ok(Math.abs(size.x - 2.83) < 0.05 && Math.abs(size.y - 0.97) < 0.05 && Math.abs(size.z - 0.47) < 0.05, '283 × 97 × 47 mm envelope');
const parts = name => {
  const found = [];
  model.gate.traverse(part => { if (part.name === name) found.push(part); });
  return found;
};
assert.equal(parts('times-gate-handle-shield').length, 8, 'upper/lower relief plates on both faces of both brackets');
assert.equal(parts('times-gate-shield-recess').length, 8);
const covers = parts('times-gate-screen-cover');
assert.equal(covers.length, 5);
assert.equal(new Set(covers.map(cover => cover.geometry)).size, 1, 'all five covers share one curved geometry');
assert.ok(covers.every(cover => cover.children.length === 0), 'no painted reflection strips on the plastic');
assert.ok(covers.every(cover => cover.material.isMeshPhysicalMaterial && cover.material.envMap && !cover.material.map && !cover.material.normalMap && cover.material.transmission === 0), 'smooth view-dependent reflections without texture noise or refraction');
const coverGeometry = covers[0].geometry;
coverGeometry.computeBoundingBox();
assert.ok(coverGeometry.boundingBox.max.z - coverGeometry.boundingBox.min.z > 0.02, 'covers bow outward');
const coverPositions = coverGeometry.attributes.position;
const coverColors = coverGeometry.attributes.color;
for (let i = 0; i < coverPositions.count; i++) {
  if (Math.abs(coverPositions.getX(i)) <= 0.13 && Math.abs(coverPositions.getY(i)) <= 0.13) {
    assert.equal(coverColors.getW(i), 0, 'glass adds no haze over the widget pixels');
  }
  assert.ok(coverPositions.getZ(i) > 0.152, 'cover never intersects the screen plane');
}
assert.ok(covers.every(cover => !cover.material.depthWrite && !cover.castShadow), 'clear covers cannot occlude pixels or shadow widgets');
for (let i = 0; i < 5; i++) {
  const material = parts(`times-gate-pixels-${i}`)[0].material;
  // three hands onBeforeCompile the source with its #includes unexpanded
  const shader = { fragmentShader: THREE.ShaderLib.basic.fragmentShader };
  material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader, /textureGrad\( map, \( seam \+ across \)/, 'panels sample texel centres so every pixel is the same size');
}
for (const name of ['times-gate-light-control', 'times-gate-power-control', 'times-gate-mode-control']) assert.equal(parts(name).length, 1);
const saddle = parts('times-gate-lower-saddle')[0];
assert.ok(saddle);
const saddleSize = new THREE.Box3().setFromObject(saddle).getSize(new THREE.Vector3());
assert.ok(saddleSize.x > 0.82 && saddleSize.y < 0.15, 'lower saddle is wide and shallow');
const saddleHit = y => new THREE.Raycaster(new THREE.Vector3(model.gate.position.x, y + saddle.position.y, 1), new THREE.Vector3(0, 0, -1)).intersectObject(saddle)[0];
assert.ok(saddleHit(0.184).point.z - saddleHit(0.165).point.z > 0.02, 'horizontal front channel is physically recessed behind the lip');
assert.equal(parts('times-gate-lower-grip').length, 2, 'fine grip texture stays on the two sloped decks');
const moduleBottom = Math.min(...[0, 1, 2, 3, 4].map(i => new THREE.Box3().setFromObject(parts(`times-gate-module-${i}`)[0]).min.y));
for (const name of ['times-gate-lower-saddle', 'times-gate-lower-deck', 'times-gate-lower-grip']) {
  assert.ok(parts(name).every(part => new THREE.Box3().setFromObject(part).max.y < moduleBottom - 0.02), `${name} stands clear of the modules' rounded bottoms`);
}

assert.equal(parts('times-gate-band-lip').length, 4, 'each bowed band has inner/outer raised lips');
assert.equal(parts('times-gate-band-recess').length, 4, 'recessed channel on both faces of both bands');
assert.equal(parts('times-gate-band-vents').length, 4);
assert.equal(parts('times-gate-band-panel-grooves').length, 4);
for (const foot of parts('times-gate-foot')) {
  foot.geometry.computeBoundingBox();
  assert.ok(foot.geometry.boundingBox.getSize(new THREE.Vector3()).y < 0.07, 'low-profile rubber foot');
  const position = foot.geometry.attributes.position;
  const toe = Array.from({ length: position.count }, (_, i) => i).filter(i => position.getX(i) > 0.4);
  assert.ok(toe.length && toe.every(i => Math.abs(position.getZ(i)) < 0.2), 'toe narrows beyond the flared pivot lobe');
}
assert.equal(parts('times-gate-foot-pivot-cap').length, 4);
assert.equal(parts('times-gate-rail').length, 0);
assert.equal(parts('times-gate-acrylic-sheet').length, 2);
const lowerSheet = parts('times-gate-acrylic-sheet').find(sheet => sheet.position.y < 0.5);
const lowerSheetBounds = new THREE.Box3().setFromObject(lowerSheet);
const lowerSheetCenter = lowerSheetBounds.getCenter(new THREE.Vector3());
assert.ok(lowerSheetBounds.min.y > 0.23 && lowerSheetBounds.max.y < 0.26, 'lower acrylic stays aligned with the side panels');
assert.ok(Math.abs(lowerSheetCenter.y - (saddle.position.y + 0.165)) < 1e-6, 'saddle groove is raised to the connected acrylic, not the other way around');
for (const sheet of parts('times-gate-acrylic-sheet')) {
  const bounds = new THREE.Box3().setFromObject(sheet);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(bounds.min.x > model.gate.position.x - 0.93 && bounds.max.x < model.gate.position.x + 0.93, 'acrylic ends stop before the shield bevel');
  assert.ok(size.y < 0.02 && size.z > 0.35, 'wide, flat sheets instead of cylindrical rails');
  assert.ok(sheet.material.transparent && !sheet.material.depthWrite && sheet.material.opacity < 0.3, 'acrylic is translucent');
}
assert.ok(parts('times-gate-handle-hinge').every(part => part.count === 3), 'three separated knuckles behind each handle');
for (const hinge of parts('times-gate-foot-hinge')) {
  const foot = hinge.parent.getObjectByName('times-gate-foot');
  const hingeBounds = new THREE.Box3().setFromObject(hinge);
  const footBounds = new THREE.Box3().setFromObject(foot);
  assert.ok(hingeBounds.min.y > footBounds.max.y, 'hinge metal stays clear of the foot surface');
}
for (const diffuser of parts('times-gate-rgb-diffuser')) {
  diffuser.geometry.computeBoundingBox();
  const bounds = diffuser.geometry.boundingBox;
  assert.ok(bounds.min.y > -0.29 && bounds.max.y < 0.29, 'rounded RGB tips terminate inside the side plate');
}
const positionBeforeHover = model.gate.position.clone();
const footHit = parts('times-gate-foot-hit')[0];
assert.equal(parts('times-gate-foot-hit').length, 2);
const footHitBeforeHover = new THREE.Box3().setFromObject(footHit);
const edgeRay = new THREE.Raycaster(new THREE.Vector3(
  (footHitBeforeHover.min.x + footHitBeforeHover.max.x) / 2,
  footHitBeforeHover.min.y + 0.015, footHitBeforeHover.max.z + 1,
), new THREE.Vector3(0, 0, -1));
assert.ok(edgeRay.intersectObject(footHit).length, 'resting foot edge catches the pointer');
handlers.onHover(true);
model.gate.updateWorldMatrix(true, true);
assert.equal(model.gate.position.y, positionBeforeHover.y + 0.04, 'hover visibly lifts the whole gate');
glows.forEach((g, i) => assert.ok(g.level() > dayGlow[i], 'hover brightens the glow'));
assert.ok(new THREE.Box3().setFromObject(footHit).equals(footHitBeforeHover), 'foot hover silhouette stays stationary while the body lifts');
assert.ok(edgeRay.intersectObject(footHit).length, 'pointer at the resting edge retains hover while lifted');
assert.equal(edgeRay.intersectObjects(parts('times-gate-foot')).length, 0, 'regression ray is outside the lifted visible foot');
handlers.onHover(false);
model.gate.updateWorldMatrix(true, true);
assert.ok(model.gate.position.equals(positionBeforeHover), 'gate settles after leaving hover');
assert.ok(new THREE.Box3().setFromObject(footHit).equals(footHitBeforeHover), 'resting silhouette stays aligned after settling');
const finishesByName = vm.runInNewContext(finishes + '; TIMES_GATE_FINISHES');
assert.equal(finishesByName.bumblebee.name, 'Yellow');
assert.equal(finishesByName.white.name, 'White');
for (const [name, coat] of Object.entries(finishesByName)) {
  model.setTimesGateFinish(name);
  assert.equal(parts('times-gate-lower-deck')[0].material.color.getHexString(), (name === 'bumblebee' ? coat.shell : coat.clamp).slice(1), 'lower deck follows the product colour split');
  assert.ok([...materials].some(m => m.color?.getHexString() === coat.shell.slice(1)));
  assert.ok([...materials].some(m => m.color?.getHexString() === coat.panel.slice(1)));
  assert.equal(textures.length, 9, 'finish changes reuse widgets, metal, control labels and the day and night reflection environments');
}
const strips = [...new Set(parts('times-gate-rgb-diffuser').map(part => part.geometry))];
assert.equal(strips.length, 2, 'RGB is limited to the two side arcs; no LED on the top rail');
model.updateTimesGate(1000);
assert.ok(strips.every(g => [...g.attributes.color.array].every(Number.isFinite)));
const coverMat = covers[0].material;
const dayEnv = coverMat.envMap;
const dayReflection = coverMat.envMapIntensity;
runtime.core.roomLight.night = 1;
model.updateTimesGate(1016);
assert.ok(coverMat.envMap !== dayEnv && coverMat.envMapIntensity < dayReflection, 'the cover reflects the night room, dimmer than by day');
runtime.core.roomLight.night = 0;
model.updateTimesGate(1032);
assert.equal(coverMat.envMap, dayEnv, 'the day reflection comes back with the day');
// The FPS screen tells a still room's 30 fps (on purpose) from a busy one
const frames = (from, to, step, still) => { for (let t = from; t <= to; t += step) model.updateTimesGate(t, still); };
frames(2000, 3200, 1000 / 30, true);
assert.ok(performance_.idle && Math.abs(performance_.fps - 30) < 2, 'a still half second reads as idle, at about 30 fps');
frames(3300, 4400, 1000 / 60, false);
assert.ok(!performance_.idle && performance_.history.at(-1).idle === false, 'a busy half second does not');
const gateTextures = fs.readFileSync(root + 'textures/timesGate.js', 'utf8').replace(/^import [\s\S]*?;\n/gm, '').replace(/export /g, '');
const drawPerformance = vm.runInNewContext(gateTextures + '; drawGatePerformance', { weatherKind: () => 'clear', Math });
const headerColour = (values) => {
  const fills = [];
  const c = { set fillStyle(v) { fills.push(v); }, fillRect() {} };
  drawPerformance(c, { ms: 33, history: [], gpu: null, ...values });
  return fills[1];
};
assert.equal(headerColour({ fps: 30, idle: true }), headerColour({ fps: 60, idle: false }), 'an idle 30 fps shows as on target');
assert.notEqual(headerColour({ fps: 30, idle: false }), headerColour({ fps: 60, idle: false }), 'a busy 30 fps still warns');
handlers.onClick();
assert.equal(chirps, 1, 'pet Byte click interaction remains registered');
console.log('Times Gate: dimensions, finite geometry, five widgets, four finishes, side RGB and pet interaction passed.');
