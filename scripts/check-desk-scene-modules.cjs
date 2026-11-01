// Run: node scripts/check-desk-scene-modules.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('three');
const gsap = require('gsap').gsap;
const dir = path.join(__dirname, '../src/features/desk3d');
function load(file, name, context) {
  const source = fs.readFileSync(path.join(dir, file), 'utf8')
    .replace(/^import .*;\n/gm, '').replace(/export function /g, 'function ');
  return vm.runInNewContext(source + `\n; ${name}`, { THREE, gsap, ...context });
}
(async () => {
  const { RoundedBoxGeometry } = await import('three/examples/jsm/geometries/RoundedBoxGeometry.js');
  const { mergeVertices } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
  const createMeshes = load('sceneMeshes.js', 'createSceneMeshes', {
    RoundedBoxGeometry, mergeVertices,
    canvasTexture: (width, height) => ({ canvas: { width, height }, ctx: {}, texture: new THREE.Texture() }),
    drawQuoteBubble() {}, clearTimeout, setTimeout,
  });
  const first = createMeshes(new THREE.Scene());
  const second = createMeshes(new THREE.Scene());
  assert.notEqual(first.disposables, second.disposables, 'resource ownership is per scene');
  assert.notEqual(first.gradient, second.gradient, 'disposing one scene cannot break another');
  const material = first.toon('#aabbcc');
  assert.equal(material.gradientMap, first.gradient);
  const geometry = first.rbox(1, 1, 1);
  const mesh = first.mesh(geometry, material);
  assert.ok(mesh.castShadow && mesh.receiveShadow);
  assert.equal(mesh.children.length, 1);
  assert.equal(first.hullGeometry(geometry), mesh.children[0].geometry, 'outline geometry is cached');
  assert.equal(first.mesh(geometry, material).children[0].material, mesh.children[0].material, 'outline materials are cached');
  assert.equal(mesh.children[0].material.uniforms.resolution, first.outlineResolution);
  assert.equal(first.mesh(geometry, material, { outline: 0, cast: false }).children.length, 0);
  let draws = 0;
  const print = first.printed(2, 1, 100, () => { draws++; return [{ id: 'test' }]; });
  assert.equal(draws, 0, 'prints are drawn after font loading');
  first.redrawers.forEach(redraw => redraw());
  assert.equal(draws, 1);
  assert.equal(print.userData.tex.canvas.width, 200);
  assert.equal(print.userData.tex.hotspots[0].id, 'test');
  assert.ok(print.receiveShadow);
  assert.ok(first.printed(1, 1, 20, () => [], { unlit: true }).material.isMeshBasicMaterial);

  const createFlex = load('paperFlex.js', 'createPaperFlex');
  const paper = createFlex(first.track);
  const otherPaper = createFlex(second.track);
  const root = new THREE.Group();
  root.position.set(2, 3, 4);
  root.rotation.z = 0.2;
  const sheet = first.mesh(paper.bendable(2, 1, 0.01), material);
  root.add(sheet);
  const flex = paper.paperFlex(root, [sheet], { from: -1, length: 2 });
  const rest = sheet.geometry.attributes.position.array.slice();
  assert.equal(flex.parts.length, 2, 'paper and its outline bend together');
  flex.bend = 0.8;
  otherPaper.updatePaperFlex();
  assert.deepEqual(sheet.geometry.attributes.position.array, rest, 'flex updates stay within their scene');
  paper.updatePaperFlex();
  assert.notDeepEqual(sheet.geometry.attributes.position.array, rest);
  assert.ok([...sheet.geometry.attributes.normal.array].every(Number.isFinite));
  flex.bend = 0;
  paper.updatePaperFlex();
  sheet.geometry.attributes.position.array.forEach((value, i) => assert.ok(Math.abs(value - rest[i]) < 1e-6));
  for (const resource of [...first.disposables, ...second.disposables]) resource.dispose?.();

  const originalShadow = THREE.ShaderChunk.shadowmap_pars_fragment;
  const originalGradient = THREE.ShaderChunk.gradientmap_pars_fragment;
  try {
    const install = load('sceneShaders.js', 'installSceneShaders');
    install('no-pcss');
    assert.equal(THREE.ShaderChunk.shadowmap_pars_fragment, originalShadow);
    assert.ok(THREE.ShaderChunk.gradientmap_pars_fragment.includes('toonBand'));
    THREE.ShaderChunk.gradientmap_pars_fragment = originalGradient;
    install('no-ramp');
    assert.equal(THREE.ShaderChunk.gradientmap_pars_fragment, originalGradient);
    assert.ok(THREE.ShaderChunk.shadowmap_pars_fragment.includes('pcssShadow'));
    install(null);
    const patchedShadow = THREE.ShaderChunk.shadowmap_pars_fragment;
    const patchedGradient = THREE.ShaderChunk.gradientmap_pars_fragment;
    function checkDisk(shader, search, samples) {
      const constants = shader.match(/const vec2 PCSS_DISK\[ \d+ \] = vec2\[\]\( (.*?) \);/)[1];
      const points = [...constants.matchAll(/vec2\(([-\d.]+), ([-\d.]+)\)/g)].map(m => [Number(m[1]), Number(m[2])]);
      assert.equal(points.length, search + samples);
      let offset = 0;
      for (const count of [search, samples]) {
        for (let i = 0; i < count; i++) {
          const [x, y] = points[offset++];
          // Preserve the old kernel, including the per-fragment rotation, to rounding precision.
          for (const spin of [0, 0.73, 3.1]) {
            const angle = spin + i * 2.39996;
            const radius = Math.sqrt((i + 0.5) / count);
            assert.ok(Math.abs(x * Math.cos(spin) - y * Math.sin(spin) - Math.cos(angle) * radius) < 1e-8);
            assert.ok(Math.abs(x * Math.sin(spin) + y * Math.cos(spin) - Math.sin(angle) * radius) < 1e-8);
          }
        }
      }
    }
    checkDisk(patchedShadow, 8, 24);
    install(null);
    assert.equal(THREE.ShaderChunk.shadowmap_pars_fragment, patchedShadow, 'shader patches are idempotent');
    assert.equal(THREE.ShaderChunk.gradientmap_pars_fragment, patchedGradient);
    THREE.ShaderChunk.shadowmap_pars_fragment = originalShadow;
    install(null, true);
    checkDisk(THREE.ShaderChunk.shadowmap_pars_fragment, 4, 6);
  } finally {
    THREE.ShaderChunk.shadowmap_pars_fragment = originalShadow;
    THREE.ShaderChunk.gradientmap_pars_fragment = originalGradient;
  }
  console.log('Scene modules: resource isolation, cached outlines, prints, paper bending and shader patches passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
