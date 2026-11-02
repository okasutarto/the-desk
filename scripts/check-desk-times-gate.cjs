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
for (const widget of ['Weather', 'Github', 'Visitors', 'Performance', 'Pet']) {
  sandbox['drawGate' + widget] = () => draws.push(widget);
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
  const shader = { fragmentShader: THREE.ShaderLib.basic.fragmentShader.replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment) };
  material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader, /textureGrad\( map, \( seam \+ across \)/, 'panels sample texel centres so every pixel is the same size');
}
for (const name of ['times-gate-light-control', 'times-gate-power-control', 'times-gate-mode-control']) assert.equal(parts(name).length, 1);
const saddle = parts('times-gate-lower-saddle')[0];
assert.ok(saddle);
const saddleSize = new THREE.Box3().setFromObject(saddle).getSize(new THREE.Vector3());
assert.ok(saddleSize.x > 0.82 && saddleSize.y < 0.15, 'lower saddle is wide and shallow');
const saddleHit = y => new THREE.Raycaster(new THREE.Vector3(model.gate.position.x, y + saddle.position.y, 1), new THREE.Vector3(0, 0, -1)).intersectObject(saddle)[0];
assert.ok(saddleHit(0.195).point.z - saddleHit(0.165).point.z > 0.02, 'horizontal front channel is physically recessed behind the lip');
assert.equal(parts('times-gate-lower-grip').length, 2, 'fine grip texture stays on the two sloped decks');

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
  assert.equal(textures.length, 8, 'finish changes reuse widgets, metal, control labels and the reflection environment');
}
const strips = [...new Set(parts('times-gate-rgb-diffuser').map(part => part.geometry))];
assert.equal(strips.length, 2, 'RGB is limited to the two side arcs; no LED on the top rail');
model.updateTimesGate(1000);
assert.ok(strips.every(g => [...g.attributes.color.array].every(Number.isFinite)));
handlers.onClick();
assert.equal(chirps, 1, 'pet Byte click interaction remains registered');
console.log('Times Gate: dimensions, finite geometry, five widgets, four finishes, side RGB and pet interaction passed.');
