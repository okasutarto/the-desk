// Run: node scripts/check-desk-toon-batch.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('three');
const source = fs.readFileSync(path.join(__dirname, '../src/features/desk3d/toonBatch.js'), 'utf8');
class RoundedBoxGeometry extends THREE.BoxGeometry {}
const create = vm.runInNewContext(source.replace(/^import .*;$/gm, '').replace('export function', 'function') + '; createToonBatch', { THREE, RoundedBoxGeometry });
const renderer = { capabilities: { isWebGL2: true }, extensions: { has: () => true } };
const scene = new THREE.Scene();
const parent = new THREE.Group();
const part = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshToonMaterial({ color: 0xff0000 }));
part.castShadow = true;
part.receiveShadow = true;
parent.add(part);
// Its ink hull, as sceneMeshes draws them: one shader per line weight
const ink = new THREE.ShaderMaterial({
  uniforms: { thickness: { value: 3 }, resolution: { value: new THREE.Vector2(800, 600) }, color: { value: new THREE.Color() } },
  side: THREE.BackSide,
});
const hull = new THREE.Mesh(new THREE.BoxGeometry(), ink);
part.add(hull);
scene.add(parent);
const printed = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshToonMaterial({ map: new THREE.Texture() }));
printed.castShadow = true;
printed.position.x = 10;
scene.add(printed);
const rounded = new THREE.Mesh(new RoundedBoxGeometry(2, 3, 4, 5, 5, 5), new THREE.MeshToonMaterial());
rounded.castShadow = rounded.receiveShadow = true;
rounded.position.x = -10;
scene.add(rounded);
// Parts sharing one printed texture batch together; a part that casts no shadow joins its kind's
// batch without a place in the shadow pass
const grain = new THREE.Texture();
const shelfParts = Array.from({ length: 4 }, (_, i) => {
  const shelfPart = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshToonMaterial({ map: grain, color: i * 0x111111 }));
  shelfPart.castShadow = shelfPart.receiveShadow = true;
  shelfPart.position.z = 10 + i * 3;
  scene.add(shelfPart);
  return shelfPart;
});
const keycap = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshToonMaterial());
keycap.receiveShadow = true;
keycap.position.y = 10;
scene.add(keycap);
// A printed board flush with a panel (their faces on one plane) keeps its own draw, so the one
// that shows where they overlap stays the same
const panel = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshToonMaterial({ map: grain }));
const board = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 0.5), new THREE.MeshToonMaterial({ map: grain }));
panel.position.x = board.position.x = 20;
panel.receiveShadow = board.receiveShadow = true;
scene.add(panel, board);
const resources = [];
const update = create(scene, renderer, (item) => { resources.push(item); return item; });
const batch = scene.children.find((item) => item.isBatchedMesh);
const shadows = scene.children.find((item) => item.isBatchedMesh && item.castShadow);
assert.ok(batch);
update();
assert.equal(part.layers.isEnabled(0), false);
assert.equal(part.layers.isEnabled(2), true, 'retain original geometry for ray picking');
assert.equal(printed.layers.isEnabled(0), true, 'a texture worn by one part keeps its exact material');
assert.ok(shelfParts.every((shelfPart) => !shelfPart.layers.isEnabled(0)), 'parts sharing a texture are batched');
const printedBatch = scene.children.find((item) => item.isBatchedMesh && item.material.map === grain);
assert.ok(printedBatch && printedBatch.geometry.attributes.uv, 'printed batches keep their texture coordinates');
assert.equal(keycap.layers.isEnabled(0), false, 'parts that cast no shadow are batched too');
assert.equal(shadows.maxGeometryCount, 2, 'and leave the shadow pass to the casters');
assert.equal(scene.children.filter((item) => item.isBatchedMesh && item.castShadow).length, 2, 'one shadow batch per kind');
assert.ok(panel.layers.isEnabled(0) && board.layers.isEnabled(0), 'flush printed parts keep their own draw');
const outlines = scene.children.find((item) => item.isBatchedMesh && item.material.isShaderMaterial);
assert.ok(outlines, 'outlines of one weight share a draw');
assert.equal(hull.layers.isEnabled(0), false);
assert.equal(outlines.material.uniforms, ink.uniforms, 'and its width, screen size and colour');
assert.equal(part.castShadow, true);
assert.equal(batch.castShadow, false);
assert.equal(shadows.castShadow, true);
assert.ok(shadows.geometry.index.count < batch.geometry.index.count, 'bevel detail belongs in the colour pass, not every shadow projection');
assert.equal(batch.receiveShadow, true);
// Every batch leaves out the parts the camera can't see (each by its own bounds), never the whole
const batches = scene.children.filter((item) => item.isBatchedMesh);
assert.ok(batches.every((item) => item.perObjectFrustumCulled && !item.frustumCulled), 'each batched part is culled on its own');
const away = new THREE.PerspectiveCamera(30, 1, 0.1, 5);
away.position.set(0, 0, 1000);
away.updateMatrixWorld();
batch.onBeforeRender({ coordinateSystem: THREE.WebGLCoordinateSystem }, scene, away, batch.geometry, batch.material);
assert.equal(batch._multiDrawCount, 0, 'parts out of view draw nothing');
parent.position.set(3, 4, 5);
parent.scale.setScalar(0.5);
update();
const matrix = new THREE.Matrix4();
batch.getMatrixAt(0, matrix);
assert.ok(matrix.equals(part.matrixWorld), 'follow animated parents exactly');
outlines.getMatrixAt(0, matrix);
assert.ok(matrix.equals(hull.matrixWorld), 'outlines follow their props');
const ray = new THREE.Raycaster(new THREE.Vector3(3, 4, 10), new THREE.Vector3(0, 0, -1));
ray.layers.enable(2);
assert.ok(ray.intersectObject(part).length > 0, 'batched props remain pickable');
parent.visible = false;
update();
assert.equal(batch.getVisibleAt(0), false);
assert.equal(shadows.getVisibleAt(0), false);
assert.equal(outlines.getVisibleAt(0), false, 'a hidden prop hides its outline');
parent.visible = true;
part.material.color.set(0x00ff00);
update();
assert.equal(batch.getVisibleAt(0), true);
assert.equal(batch.geometry.attributes.color.getX(0), 0);
assert.equal(batch.geometry.attributes.color.getY(0), 1, 'theme/animated colour changes must reach the batch');
part.material.emissive.set(0xff0000);
update();
assert.equal(batch.getVisibleAt(0), false);
assert.equal(part.layers.isEnabled(0), true, 'glowing materials use their original shader without duplicate geometry');
part.material.emissive.set(0);
const position = part.geometry.attributes.position;
position.setX(0, position.getX(0) + 0.1);
position.needsUpdate = true;
update();
assert.equal(batch.getVisibleAt(0), true);
assert.equal(batch.geometry.attributes.position.getX(0), position.getX(0));
assert.equal(shadows.geometry.attributes.position.getX(0), position.getX(0));
resources.forEach((resource) => resource.dispose());
const fallbackScene = new THREE.Scene();
fallbackScene.add(part);
part.layers.enable(0);
create(fallbackScene, { capabilities: { isWebGL2: false } }, () => {})();
assert.equal(part.layers.isEnabled(0), true);
assert.equal(fallbackScene.children.length, 1);
console.log('Toon batching: exact transforms, visibility, picking, colours, emissive fallback and vertex updates passed.');
