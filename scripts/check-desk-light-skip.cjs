// Run: node scripts/check-desk-light-skip.cjs
// The lit shaders skip point and spot lights whose colour is zero, and don't shade with a light
// that doesn't reach the fragment (see sceneShaders.js). Node can't compile GLSL, so this checks
// the patched chunk the way three will read it: every light loop still unrolls, each iteration is
// guarded by its own light's colour, shading waits on `visible`, and the rest is three's own.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('three');

const source = fs.readFileSync(path.join(__dirname, '../src/features/desk3d/sceneShaders.js'), 'utf8');
const original = THREE.ShaderChunk.lights_fragment_begin;
const chunks = { ...THREE.ShaderChunk };
const fakeThree = { ...THREE, ShaderChunk: chunks };
const install = vm.runInNewContext(source.replace(/^import .*;$/gm, '').replace('export function', 'function') + '; installSceneShaders', { THREE: fakeThree });

// three r161's loop unrolling (WebGLProgram.js), with light counts filled in as it does
const unroll = (glsl, counts) => {
  const filled = glsl.replace(/NUM_(POINT|SPOT|DIR|HEMI|RECT_AREA)_LIGHTS\b/g, (_, kind) => String(counts[kind] ?? 1));
  return filled.replace(/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g, (_, start, end, body) => {
    let out = '';
    for (let i = Number(start); i < Number(end); i++) out += body.replace(/\[\s*i\s*\]/g, `[ ${i} ]`).replace(/UNROLLED_LOOP_INDEX/g, i);
    return out;
  });
};

// The benchmark leaves three's chunk as it is, for comparison
install('no-light-skip');
assert.equal(chunks.lights_fragment_begin, original, 'bench=no-light-skip keeps three\'s light loops');

chunks.lights_fragment_begin = original;
install(null);
const patched = chunks.lights_fragment_begin;
assert.notEqual(patched, original, 'the light loops are patched');
assert.equal((patched.match(/skipDarkLight/g) || []).length, 2, 'point and spot loops are both guarded');
assert.ok(!/directionalLights\[ i \]\.color != vec3/.test(patched), 'directional lights are left alone');

// Installing twice (a hot reload) doesn't guard the loops twice
install(null);
assert.equal(chunks.lights_fragment_begin, patched, 'the patch is applied once');

const counts = { POINT: 3, SPOT: 4, DIR: 1 };
const unrolled = unroll(patched, counts);
assert.ok(!unrolled.includes('#pragma unroll_loop'), 'every light loop still unrolls');
for (let i = 0; i < counts.POINT; i++) assert.ok(unrolled.includes(`if ( pointLights[ ${i} ].color != vec3( 0.0 ) ) {`), `point light ${i} is guarded`);
for (let i = 0; i < counts.SPOT; i++) assert.ok(unrolled.includes(`if ( spotLights[ ${i} ].color != vec3( 0.0 ) ) {`), `spot light ${i} is guarded`);
// A light out of reach (past its distance, outside its cone) has no colour and no `visible`; it
// isn't shaded with. Directional lights are always visible and keep three's loop.
const shaded = unrolled.match(/(if \( directLight\.visible \) )?RE_Direct\( directLight,/g);
assert.equal(shaded.length, counts.POINT + counts.SPOT + counts.DIR, 'every light still shades');
assert.equal(shaded.filter((s) => s.startsWith('if')).length, counts.POINT + counts.SPOT, 'point and spot lights shade only where they reach');

// Take the guards out again and the shader is three's own, light for light
const unguarded = unrolled.replace(/\/\/ skipDarkLight\s*if \( (point|spot)Lights\[ \d+ \]\.color != vec3\( 0\.0 \) \) \{([\s\S]*?)\}\s*(?=\n)/g, '$2').replace(/if \( directLight\.visible \) /g, '');
const squash = (s) => s.replace(/\s+/g, '');
assert.equal(squash(unguarded), squash(unroll(original, counts)), 'inside each guard is exactly the light\'s original work');

// Braces balance, so the guard closes before the loop does
const depth = [...patched].reduce((n, c) => n + (c === '{') - (c === '}'), 0);
assert.equal(depth, 0, 'braces balance');

console.log('desk light skip checks passed');
