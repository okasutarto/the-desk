// Run: node scripts/check-desk-shadow-cache.cjs
// The shadow cache's choices, against a stand-in renderer: a map drawn whole the first time and
// whenever its light or a still caster changes, the still room's copy drawn once and then only
// laid back, with just the moving props drawn over it.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('three');

const source = fs.readFileSync(path.join(__dirname, '../src/features/desk3d/shadowCache.js'), 'utf8');
const createShadowCache = vm.runInNewContext(source.replace(/^import .*;$/gm, '').replace('export function', 'function') + '; createShadowCache', { THREE, performance, Float64Array, Set, Map });

const passes = [];
let blits = 0;
let clearsDuringPass = 0;
const renderer = {
  shadowMap: {
    enabled: true, autoUpdate: true, needsUpdate: false,
    render(list, root) {
      // (as three's own pass, nothing to do without a light)
      if (!list.length) return;
      // what each pass draws: the still room hides the moving props for the one draw
      const drawn = [];
      const walk = (o) => {
        if (!o.visible) return;
        if (o.isMesh) drawn.push(o.name);
        o.children.forEach(walk);
      };
      walk(root);
      renderer.clear();
      passes.push({ lights: list.map((l) => l.name), root: root === scene ? 'scene' : 'moving', drawn });
      list.forEach((l) => (l.shadow.needsUpdate = false));
    },
  },
  clear() { clearsDuringPass++; },
  getContext: () => ({ READ_FRAMEBUFFER: 1, COLOR_BUFFER_BIT: 2, DEPTH_BUFFER_BIT: 4, NEAREST: 5, blitFramebuffer: () => blits++ }),
  state: { bindFramebuffer() {}, setScissorTest() {}, buffers: { color: { setMask() {} }, depth: { setMask() {} } } },
  properties: { get: () => ({ __webglFramebuffer: {} }) },
  setRenderTarget() {}, getRenderTarget: () => null, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
  domElement: { addEventListener() {}, removeEventListener() {} },
};

const scene = new THREE.Scene();
const mesh = (name) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  m.name = name;
  m.castShadow = true;
  scene.add(m);
  return m;
};
const desk = mesh('desk');
mesh('shelf');
const cat = mesh('cat');
const light = new THREE.SpotLight();
light.name = 'sun';
light.castShadow = true;
light.position.set(5, 10, 5);
light.shadow.map = new THREE.WebGLRenderTarget(512, 512);
scene.add(light);
scene.updateMatrixWorld(true);

const cache = createShadowCache(renderer, scene, [light], new Set([cat]));
const update = () => {
  passes.length = 0;
  blits = clearsDuringPass = 0;
  light.shadow.needsUpdate = true;
  scene.updateMatrixWorld(true);
  renderer.shadowMap.render([light], scene, new THREE.PerspectiveCamera());
  return passes;
};

let p = update();
assert.equal(cache.counts.whole, 1, 'a light seen for the first time draws its map whole');
assert.deepEqual(p.map((x) => x.root), ['scene']);

p = update();
assert.equal(cache.counts.built, 1, 'then its copy of the still room is drawn');
assert.equal(cache.counts.copied, 1);
assert.deepEqual(p[0].drawn.sort(), ['desk', 'shelf'], 'the copy leaves the moving props out');
assert.equal(p[1].root, 'moving');
assert.deepEqual(p[1].drawn, ['cat'], 'and only the moving props are drawn over it');
assert.equal(blits, 1, 'the copy is laid back into the map');
assert.equal(clearsDuringPass, 1, 'drawing the moving props keeps what the copy laid down');

p = update();
assert.equal(cache.counts.built, 1, 'a still room is not drawn again');
assert.equal(cache.counts.copied, 2);
assert.deepEqual(p.map((x) => x.root), ['moving'], 'an update draws the moving props alone');

cat.position.x += 3;
p = update();
assert.equal(cache.counts.built, 1, 'a moving prop moving costs no new copy');
assert.deepEqual(p.map((x) => x.root), ['moving']);

desk.position.x += 1;
p = update();
assert.equal(cache.counts.whole, 2, 'a still caster moving draws the map whole');
p = update();
assert.equal(cache.counts.built, 2, 'and once it settles, a new copy');

light.position.x += 1;
update();
assert.equal(cache.counts.whole, 3, 'a light that moves draws its map whole');

cache.enabled = false;
p = update();
assert.deepEqual(p.map((x) => x.root), ['scene'], 'switched off, every update is a whole draw again');
cache.dispose();
console.log('Shadow cache: whole draws, still copies, moving-only updates and invalidation passed.');
