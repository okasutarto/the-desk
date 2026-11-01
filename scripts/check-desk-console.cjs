// Run: node scripts/check-desk-console.cjs
const assert = require('node:assert/strict');
const vm = require('node:vm');
const THREE = require('three');
(async () => {
  const { RoundedBoxGeometry } = await import('three/examples/jsm/geometries/RoundedBoxGeometry.js');
  const source = require('./helpers/desk-source.cjs').readDeskSource();
  const items = [];
  const shelf = new THREE.Group();
  const toon = (color) => new THREE.MeshToonMaterial({ color });
  const at = (obj, x, y, z = 0, rz = 0) => { obj.position.set(x, y, z); obj.rotation.z = rz; return obj; };
  const group = (...objects) => { const g = new THREE.Group(); g.add(...objects); return g; };
  const model = vm.runInNewContext(source.slice(source.indexOf('  // Top bay: a PS5 Pro'), source.indexOf('  // A hardback,')) + '; ({ ps5, consoleBody, pad1, pad2, led, holder })', {
    THREE, toon, at, group, shelf, printed: (w,h) => new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial()), black: toon('#1a1714'), white: toon('#fffdf5'), shelfMat: toon('#f3d3b0'),
    track: (value) => value, mesh: (geometry, material) => new THREE.Mesh(geometry, material),
    neonLight: (color, intensity) => new THREE.PointLight(color, intensity),
    canvasTexture: () => { const texture = new THREE.Texture(); return { ctx: { fillRect() {}, texture }, texture }; }, drawSatinFinish() {}, drawLeatherGrain() {}, drawMatteFinish() {}, drawPsSymbols() {}, noRaycast() {},
    drawSayaLacquer: (ctx, w, h, { color }) => { ctx.texture.userData.lacquer = color; },
    rbox: (w, h, d, r = 0.08) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w,h,d)/2 - 1e-3)),
    phoneSlab: (w, h, d) => new THREE.BoxGeometry(w, h, d),
    rod: (a, b, radius, mat) => {
      const part = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b)), mat);
      part.position.copy(a).add(b).multiplyScalar(0.5);
      part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      return part;
    },
    standOn: () => 0,
    addItem: (obj, sound) => { shelf.add(obj); items.push({obj, sound}); return obj; },
  });
  // Measure intrinsic device dimensions, excluding the stands and display rotations.
  for (const [object, expected] of [[model.consoleBody, [8.9, 38.8, 21.6]], [model.pad1.userData.moves, [16, 6, 10.6]], [model.pad2.userData.moves, [16, 6, 10.6]]]) {
    const copy = object.clone();
    copy.position.set(0, 0, 0);
    copy.rotation.set(0, 0, 0);
    copy.scale.multiplyScalar(2);
    const sizeCm = new THREE.Box3().setFromObject(copy, true).getSize(new THREE.Vector3()).multiplyScalar(10).toArray();
    sizeCm.forEach((value, axis) => assert.ok(Math.abs(value - expected[axis]) < 1e-4, 'device matches real-world size including the shelf scale'));
  }
  shelf.updateMatrixWorld(true);
  const bounds = (obj) => new THREE.Box3().setFromObject(obj);
  const consoleBox = bounds(model.ps5);
  assert.ok(Math.abs(consoleBox.min.y) < 0.005, 'console foot must rest on the shelf');
  const body = bounds(model.consoleBody);
  assert.ok(body.min.y > 0.05 && body.min.y < 0.075, 'standing console sits on its foot');
  assert.ok(body.max.y - body.min.y > body.max.x - body.min.x, 'console stands on its end');
  assert.ok(consoleBox.max.x < bounds(model.pad1).min.x, 'PS5 clears the first controller stand');
  assert.equal(model.pad1.position.x, model.pad2.position.x, 'both controllers share one tower footprint');
  assert.ok(bounds(model.pad2).max.y + 0.1 < bounds(model.pad1).min.y, 'stacked controllers have room for click movement');
  const upperStem = model.holder.children[4];
  const stemPositions = upperStem.geometry.attributes.position;
  const lowerPadBox = bounds(model.pad2);
  const stemVertex = new THREE.Vector3();
  for (let i = 0; i < stemPositions.count; i++) {
    upperStem.localToWorld(stemVertex.fromBufferAttribute(stemPositions, i));
    if (stemVertex.y <= lowerPadBox.max.y + 0.01) {
      assert.ok(stemVertex.z < lowerPadBox.min.z - 0.01,
        'continuous stem remains behind the lower controller wherever their heights overlap');
    }
  }
  assert.ok(bounds(upperStem).min.y < lowerPadBox.max.y && bounds(upperStem).max.y > lowerPadBox.max.y,
    'sculpted upper stem extends continuously behind the lower shell without a separated foot');
  assert.ok(bounds(model.holder.children[1]).max.z < bounds(model.pad2).min.z - 0.01,
    'rear spine stays behind the lower controller instead of penetrating it');
  assert.equal(model.holder.parent, shelf, 'shared holder stays fixed on the shelf');
  assert.ok(Math.abs(bounds(model.holder).min.y) < 0.005, 'holder foot rests on shelf');
  assert.ok(consoleBox.max.x < bounds(model.holder).min.x, 'holder clears PS5');
  for (const obj of [...items.map(item => item.obj), model.holder]) {
    const box = bounds(obj);
    assert.ok(box.min.x > -1.305 && box.max.x < 1.305, 'props fit between shelf sides');
    assert.ok(box.min.y >= -0.005 && box.max.y < 2.18, 'props clear the shelf above');
    assert.ok(box.min.z > -0.75 && box.max.z < 0.75, 'props remain on the shelf');
  }
  const padBody = model.pad2.userData.moves.children[0];
  assert.equal(padBody.material.map.userData.lacquer, '#fffdf5', 'second controller is white lacquer');
  const darkPadBody = model.pad1.userData.moves.children[0];
  assert.equal(darkPadBody.material.map.userData.lacquer, '#141414', 'first controller uses neutral black lacquer');
  assert.equal(padBody.material.color.getHexString(), 'ffffff', 'the lacquer texture carries the shell colour, as on the sayas');
  assert.ok(bounds(model.holder).max.y < bounds(model.pad1).max.y, 'holder never sticks above the upper pad');
  assert.equal(model.holder.children[0].material.color.getHexString(), 'fffdf5', 'reference holder is white');
  assert.ok(darkPadBody.material.map && padBody.material.map, 'both controllers have a textured shell');
  for (const modelPad of [model.pad1, model.pad2]) {
    assert.ok(modelPad.userData.moves.children.every((part) => part.geometry?.type !== 'ShapeGeometry'),
      'controller handles remain continuous plastic without applied grip patches');
  }
  assert.ok(darkPadBody.material.emissiveIntensity > 0 && darkPadBody.material.emissiveIntensity <= 0.04,
    'a small material fill keeps the black shell visible in shelf shadows');
  for (const [item, saddle] of [[model.pad2, model.holder.children[2]], [model.pad1, model.holder.children[4]]]) {
    const contact = new THREE.Raycaster(new THREE.Vector3(item.position.x, 0, item.position.z + 0.16), new THREE.Vector3(0, 1, 0))
      .intersectObject(item.userData.moves.children[0], false)[0];
    assert.ok(contact && Math.abs(contact.point.y - bounds(saddle).max.y) < 0.003, 'holder meets the controller underside without a visible gap');
    const dpad = item.userData.moves.children.find(part => Math.abs(part.position.x + 0.14) < 1e-6 && Math.abs(part.position.y - 0.107) < 1e-6);
    assert.ok(bounds(dpad).min.y > bounds(saddle).max.y + 0.01, 'D-pad sits fully above the front holder lip');
  }
  const face = new THREE.Vector3(0, 1, 0).applyQuaternion(model.pad2.userData.moves.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(face.z > 0.75, 'controls face the visitor on their stand');
  assert.equal(model.pad1.userData.moves.parent, model.pad1, 'a click moves only its controller');
  assert.deepEqual(items.slice(0, 3).map(({sound}) => sound), ['console','controller','controller'], 'console and controllers keep their interactions');
  const trophyModel = vm.runInNewContext(source.slice(source.indexOf('  const trophyGold ='), source.indexOf('  // End shelf collectibles.')) + '; ({ trophy, cup })', {
    THREE, toon, at, group, black: toon('#171717'),
    track: value => value, canvasTexture: () => ({ texture: new THREE.Texture(), ctx: {} }),
    drawTrophyMetal() {}, drawTrophyStone() {}, drawSatinFinish() {},
    neonLight: (color, intensity) => new THREE.PointLight(color, intensity),
    mesh: (geometry, material) => new THREE.Mesh(geometry, material),
    rbox: (w,h,d) => new THREE.BoxGeometry(w,h,d),
    printed: (w,h) => new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial()),
    standOn: () => 0, addItem: (obj) => obj,
  });
  const trophyBox = bounds(trophyModel.trophy);
  assert.ok(trophyBox.max.y < 1.8 && trophyBox.min.y >= -0.001, 'trophy fits its shelf bay');
  const rim = trophyModel.cup.geometry.parameters.points.filter((point) => point.y === 1.12);
  assert.equal(rim.length, 2, 'cup has distinct inner and outer rim walls');
  assert.ok(rim[0].x > rim[1].x, 'cup wall has positive thickness');
  assert.equal(trophyModel.trophy.children.filter((obj) => obj.geometry?.type === 'TubeGeometry').length, 2, 'two continuous handle curves');
  console.log('Standing PS5, controller stands, shelf clearance and interaction checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });

// Console activation dismisses old speech, then opens the game without creating a new bubble.
{
  const source = require('./helpers/desk-source.cjs').readDeskSource();
  const callbacks = [];
  let hidden = 0;
  let destination;
  let app;
  const ctx = vm.createContext({
    discover() {}, sfx: { power() {} }, bootLed() {}, pad1: { userData: { moves: { rotation: {} } } }, pad2: { userData: { moves: { rotation: {} } } }, setNeon() {},
    gsap: { fromTo() {} }, shelfBubble: { hide() { hidden++; } }, shelfSay() { throw new Error('console must not show a bubble'); },
    timers: [], setTimeout(fn) { callbacks.push(fn); return callbacks.length; },
    setFocus: (name) => { destination = name; }, desktop: { playConsole: () => { app = 'console'; } }, redrawScreen() {},
  });
  vm.runInContext(source.slice(source.indexOf('  function powerConsole()'), source.indexOf('  function buzzController(')) + '; powerConsole();', ctx);
  while (callbacks.length) callbacks.shift()();
  assert.equal(hidden, 1);
  assert.equal(destination, 'monitor');
  assert.equal(app, 'console');
}
