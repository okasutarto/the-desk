// Exercise the actual keyboard factory: full palettes, legend redraws, LED placement and reuse.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('three');
const root = `${__dirname}/../src/features/desk3d/`;
const read = file => fs.readFileSync(root + file, 'utf8').replace(/^import .*;\n/gm, '').replace(/\bexport /g, '');
const palettes = read('deviceFinishes.js');
const DEVICE_FINISHES = vm.runInNewContext(palettes + '; DEVICE_FINISHES');
const resources = new Set();
const ctx = new Proxy({}, { get: (_, key) => key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {} });
const track = value => { resources.add(value); return value; };
const scene = new THREE.Scene();
const runtime = { options: { deviceFinishes: { keyboard: 'sakura' } }, core: {
  scene, track, gradient: null, roomLight: { night: 0 }, noRaycast() {}, register() {},
  toon: color => track(new THREE.MeshToonMaterial({ color })),
  rbox: (w, h, d) => track(new THREE.BoxGeometry(w, h, d)),
  roundedRectShape: (w, d) => new THREE.Shape().moveTo(-w / 2, -d / 2).lineTo(w / 2, -d / 2).lineTo(w / 2, d / 2).lineTo(-w / 2, d / 2).closePath(),
  mesh: (geometry, material) => {
    const mesh = new THREE.Mesh(track(geometry), material);
    mesh.add(new THREE.Mesh(geometry, track(new THREE.ShaderMaterial({ uniforms: {} }))));
    return mesh;
  },
  printed: (w, h, px, draw) => {
    const mesh = new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), track(new THREE.MeshBasicMaterial()));
    const texture = track(new THREE.Texture());
    const context = {};
    mesh.userData.tex = { texture, redraw: () => draw(context, 100, 100) };
    mesh.userData.ink = context;
    return mesh;
  },
} };
const model = vm.runInNewContext(palettes + read('scene/keyboard.js') + '; createKeyboard(runtime)', {
  runtime, THREE, window: { addEventListener() {} },
  canvasTexture: () => ({ ctx, texture: track(new THREE.Texture()) }),
  drawDeskMat() {}, drawKeyLabel: (c, w, h, label, bg, options) => { c.ink = options.ink; },
});
const keys = new Map(model.keyboard.children.filter(p => p.userData.code).map(p => [p.userData.code, p]));
const colour = mesh => '#' + mesh.material.color.getHexString();
assert.equal(keys.size, 84);
assert.equal(colour(keys.get('KeyA').children[0]), DEVICE_FINISHES.keyboard.finishes.sakura.alpha, 'saved palette applied at construction');
const resourceCount = resources.size;
for (const [name, coat] of Object.entries(DEVICE_FINISHES.keyboard.finishes)) {
  model.setKeyboardFinish(name);
  for (const [code, key] of keys) {
    const role = code === 'Escape' ? 'escape' : code === 'Enter' ? 'enter' : code === 'Space' ? 'space'
      : /^F[5-8]$/.test(code) ? 'alternate'
        : /^(Key|Digit)|^(Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|Backquote|F[1-4]|F9|F1[0-2])$/.test(code) ? 'alpha' : 'modifier';
    assert.equal(colour(key.children[0]), coat[role], `${name}: ${code} follows its colour group`);
    const shortcut = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'KeyT', 'KeyC'].includes(code);
    const ink = key.userData.legend.userData.ink.ink;
    if (shortcut && coat.shortcutInk) assert.ok(![coat.ink, coat.accentInk].includes(ink), `${name}: ${code} keeps its shortcut colour`);
    else assert.equal(ink, ['modifier', 'alternate', 'escape', 'enter'].includes(role) ? coat.accentInk : coat.ink, `${name}: ${code} legend redrawn`);
  }
  assert.equal(colour(keys.get('KeyF').children[2]), coat.homing, 'homing marks follow the colourway');
  assert.ok(model.keyboard.children.some(mesh => mesh.isMesh && colour(mesh) === coat.shell), 'aluminium case follows the colourway');
  model.updateRgb(1000);
  model.updateRgb(2000);
  assert.equal(colour(keys.get('KeyA').children[0]), coat.alpha, 'RGB animation preserves keycap finish');
  assert.equal(resources.size, resourceCount, 'switching reuses all GPU resources');
}
const led = model.keyboard.getObjectByName('keyboard-status-led');
assert.ok(led.position.z < keys.get('Escape').position.z, 'status LED is above Esc');
assert.equal(led.position.x, keys.get('Escape').position.x, 'status LED lines up with Esc');
assert.ok(led.geometry.parameters.width > led.geometry.parameters.depth * 5, 'horizontal short strip, not a bar down the left side');
model.setKeyboardFinish('constructor');
assert.equal(colour(keys.get('KeyA').children[0]), DEVICE_FINISHES.keyboard.finishes.sakura.alpha);
// Build the mouse itself: a fine centre split and a flush rear button crease.
const mouse = vm.runInNewContext(palettes + read('scene/mouse.js') + '; createMouse(runtime)', {
  THREE, runtime: { ...runtime, keyboard: { MAT_TOP: 0 } },
});
const splits = [];
mouse.mouse.traverse(mesh => { if (mesh.name === 'mouse-button-split') splits.push(mesh); });
assert.equal(splits.length, 2, 'the wheel interrupts the centre split');
for (const split of splits) {
  assert.ok(!split.geometry.parameters?.radius, 'button split is a flush surface');
  split.geometry.computeBoundingBox();
  const box = split.geometry.boundingBox;
  assert.ok(box.max.x - box.min.x < 0.008, 'no transverse seam across the body');
  assert.ok(box.max.z < -0.45 || box.min.z > -0.26, 'seams stay clear of the wheel');
}
const rearSeam = mouse.mouse.getObjectByName('mouse-button-rear-seam');
assert.ok(rearSeam, 'rear button boundary stays present');
assert.ok(!rearSeam.geometry.parameters?.radius, 'rear crease is a surface, not a raised tube');
rearSeam.geometry.computeBoundingBox();
assert.ok(rearSeam.geometry.boundingBox.getSize(new THREE.Vector3()).x > 0.5, 'rear crease spans both buttons');
assert.ok([...rearSeam.geometry.attributes.position.array].every(Number.isFinite));
for (let i = 0; i < rearSeam.geometry.attributes.normal.count; i++) {
  assert.ok(rearSeam.geometry.attributes.normal.getY(i) > 0, 'crease faces outwards');
}
const thumbButtons = [];
mouse.mouse.traverse(mesh => { if (mesh.name === 'mouse-thumb-button') thumbButtons.push(mesh); });
assert.equal(thumbButtons.length, 2, 'two separate thumb buttons');
assert.ok(thumbButtons.every(button => button.position.x < 0), 'thumb buttons stay on the left');
assert.ok(mouse.mouse.getObjectByName('mouse-base'), 'black underside is modelled');
assert.ok(mouse.mouse.getObjectByName('mouse-status-led').material.isMeshBasicMaterial, 'small green status light is unlit');
const shellBounds = new THREE.Box3().setFromObject(mouse.mouse.getObjectByName('mouse-shell'));
assert.ok(Math.abs(shellBounds.getSize(new THREE.Vector3()).z - 1.25) < 0.01, '125 mm long body');
const shellProbe = new THREE.Mesh(mouse.mouse.getObjectByName('mouse-shell').geometry, new THREE.MeshBasicMaterial());
shellProbe.updateMatrixWorld();
for (const [x, z] of [[0.04, -0.615], [0.03, 0.615]]) {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0));
  assert.ok(ray.intersectObject(shellProbe).length, 'nose and heel remain rounded rather than pinching into points');
}
const physicalBounds = new THREE.Box3().setFromObject(mouse.mouse.children[0].clone());
const physicalSize = physicalBounds.getSize(new THREE.Vector3());
for (const [axis, expected] of [['x', 0.635], ['y', 0.334], ['z', 1.250]]) {
  assert.ok(Math.abs(physicalSize[axis] - expected) < 0.003, `model ${axis} dimension stays within 0.3 mm`);
}
const buttonBounds = thumbButtons.map(button => {
  button.geometry.computeBoundingBox();
  return button.geometry.boundingBox.clone().translate(button.position);
});
assert.ok(!buttonBounds[0].intersectsBox(buttonBounds[1]), 'thumb buttons have a clear gap');
for (const [index, button] of thumbButtons.entries()) {
  const vertices = button.geometry.attributes.position;
  const normals = button.geometry.attributes.normal;
  for (let i = 0; i < vertices.count; i++) {
    if (normals.getX(i) > -0.5) continue;
    const point = new THREE.Vector3().fromBufferAttribute(vertices, i).add(button.position);
    const ray = new THREE.Raycaster(new THREE.Vector3(-1, point.y, point.z), new THREE.Vector3(1, 0, 0));
    const hit = ray.intersectObject(shellProbe)[0];
    assert.ok(hit && point.x < hit.point.x - 0.002, 'entire button face stays outside the shell');
  }
  const bounds = buttonBounds[index];
  const seam = rearSeam.geometry.attributes.position;
  for (let i = 0; i < seam.count; i++) {
    if (seam.getX(i) >= 0 || seam.getZ(i) < bounds.min.z || seam.getZ(i) > bounds.max.z) continue;
    assert.ok(seam.getY(i) > bounds.max.y + 0.003, 'button stays below the shell seam');
  }
}
assert.ok([...rearSeam.geometry.attributes.position.array].filter((_, i) => i % 3 === 2).every(z => z <= -0.055), 'button boundary stays in front of the body');
// The phone and mouse setters update only the intended body materials, in place.
for (const [part, file, method] of [['phone', 'chat', 'setPhoneFinish'], ['mouse', 'mouse', 'setMouseFinish']]) {
  const source = read(`scene/${file}.js`);
  const start = source.indexOf(`  function ${method}(`);
  const end = source.indexOf(`  ${method}(runtime.options`, start);
  const phoneFinish = new THREE.MeshToonMaterial();
  const phoneTrim = new THREE.MeshToonMaterial();
  const seamMat = new THREE.MeshToonMaterial();
  const sideButtonMat = new THREE.MeshToonMaterial();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshToonMaterial());
  const set = vm.runInNewContext(palettes + source.slice(start, end) + `; ${method}`, { phoneFinish, phoneTrim, shell, seamMat, sideButtonMat });
  for (const [name, coat] of Object.entries(DEVICE_FINISHES[part].finishes)) {
    set(name);
    assert.equal('#' + (part === 'phone' ? phoneFinish : shell.material).color.getHexString(), coat.shell);
    if (part === 'phone') assert.equal('#' + phoneTrim.color.getHexString(), coat.trim);
  }
  assert.doesNotThrow(() => set('constructor'));
}
// The chair's leatherette: dark keeps its grain in the colour, white uses it only as a bump,
// and the shader is rebuilt only when the colour map comes or goes.
{
  const source = read('scene/chair.js');
  const start = source.indexOf('  function setChairFinish(');
  const end = source.indexOf('  setChairFinish(runtime.options', start);
  const grain = new THREE.Texture();
  const mats = [0, 1, 2].map(() => Object.assign(new THREE.MeshToonMaterial(), { map: grain, bumpMap: grain, bumpScale: 2.2 }));
  const [leather, leatherPanel, leatherBox] = mats;
  const set = vm.runInNewContext(palettes + source.slice(start, end) + '; setChairFinish', { leather, leatherPanel, leatherBox });
  const versions = mats.map(mat => mat.version);
  set('black');
  assert.deepEqual(mats.map(mat => mat.version), versions, 'no shader rebuild when the map stays');
  for (const [name, coat] of Object.entries(DEVICE_FINISHES.chair.finishes)) {
    set(name);
    for (const mat of mats) {
      assert.equal('#' + mat.color.getHexString(), coat.shell, name + ' leather colour');
      assert.equal(mat.map, coat.grain ? grain : null, name + ' grain as colour');
      assert.equal(mat.bumpMap, grain, name + ' grain still bumps');
      assert.equal(mat.bumpScale, coat.bump);
    }
  }
  assert.equal(DEVICE_FINISHES.chair.default, 'black', 'the chair stays black unless picked');
  assert.doesNotThrow(() => set('constructor'));
}
console.log('Device finishes: all 84 keycaps, legends, saved startup, GPU resource reuse, RGB, status LED, phone, mouse and chair passed.');
