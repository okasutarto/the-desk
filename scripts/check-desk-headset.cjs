// Run: node scripts/check-desk-headset.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('three');
(async () => {
  const { RoundedBoxGeometry } = await import('three/examples/jsm/geometries/RoundedBoxGeometry.js');
  const { mergeVertices } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
  const source = fs.readFileSync('src/features/desk3d/scene/headset.js', 'utf8');
  const resources = new Set();
  const track = item => (resources.add(item), item);
  const scene = new THREE.Scene();
  const desk = new THREE.Mesh(new THREE.BoxGeometry(16, 0.35, 8.4));
  desk.position.set(-1, -0.175, 0);
  const paint = new Proxy({}, { get: () => () => {}, set: () => true });
  const factory = vm.runInNewContext(source.replace(/^import .*;\n/gm, '').replace('export function', 'function') + ';createHeadset', {
    THREE, mergeVertices, canvasTexture: () => ({ texture: new THREE.Texture(), ctx: paint }),
  });
  const { assembly, headset } = factory({ room: { desk }, core: {
    scene, track, toon: color => track(new THREE.MeshToonMaterial({ color })),
    mesh: (geometry, material) => new THREE.Mesh(track(geometry), material),
    rbox: (w, h, d, radius) => new RoundedBoxGeometry(w, h, d, 2, radius),
  } });
  scene.updateMatrixWorld(true);
  const bounds = object => new THREE.Box3().setFromObject(object, true);
  const find = name => { const object = assembly.getObjectByName(name); assert.ok(object, name); return object; };
  assert.equal(assembly.position.x, 6.2, 'hook sits 8 cm inside the right corner');
  assert.ok(Math.abs(assembly.position.z - 4.2) < 1e-6, 'hook follows the desktop front edge');
  assert.equal(assembly.rotation.y, -Math.PI / 2, 'saddle projects forward from the front edge');
  assert.ok(bounds(find('hook-mount')).min.x > 4.925, 'mount clears the right end of the memory keypad');
  assert.ok(Math.abs(headset.getWorldQuaternion(new THREE.Quaternion()).angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.28))) < 1e-6,
    'headset retains its original facing while the front bracket turns');
  const body = bounds(headset), size = body.getSize(new THREE.Vector3());
  assert.ok(size.y > 1.95 && size.y < 2.1, 'headset stays life-size, about 16.5 × 20.3 cm');
  const physicalBody = headset.clone(true);
  physicalBody.rotation.set(0, 0, 0);
  for (const name of ['detachable-boom-mic', 'mic-foam-windscreen', 'mic-socket', 'mic-strain-relief']) {
    const object = physicalBody.getObjectByName(name);
    object.parent.remove(object);
  }
  const dimensions = bounds(physicalBody).getSize(new THREE.Vector3());
  assert.ok(Math.abs(dimensions.x - 1.65) < 0.1 && Math.abs(dimensions.y - 2.03) < 0.05 && Math.abs(dimensions.z - 0.95) < 0.06,
    'unrotated body follows the supplied ~165 × 203 × 95 mm dimensions, excluding boom');
  assert.ok(body.max.y < -0.35, 'headband clears the underside of the desk');
  assert.ok(body.min.y > -3, 'headset clears the floor');
  for (const name of ['left-earcup', 'right-earcup']) {
    assert.ok(bounds(find(name)).min.z > 3.5, 'earcups hang beyond the desk front');
  }
  assert.ok(body.min.z > 0.55, 'headset and forward-facing boom clear the right desk column (front at Z=0.51)');
  assert.ok(body.min.z > 1.8, 'headset hangs in front of the shelving');
  const pad = bounds(find('hook-pad'));
  const innerBand = bounds(find('headband-inner-padding'));
  // Inner crown (0.86 high, before the 1.5 mm bevel) rests on the saddle.
  assert.ok(Math.abs(headset.position.y + 0.86 - (pad.max.y)) < 0.02, 'headband underside rests on padded saddle');
  assert.ok(innerBand.max.y > pad.max.y, 'crown wraps over the supporting saddle');
  for (const name of ['left-earcup', 'right-earcup', 'metal-slider-rail', 'swivel-holder', 'volume-dial', 'configurable-roller', 'usb-c-recess', 'usb-c-tongue', 'anc-button', 'smartswitch-button', 'mute-button', 'detachable-boom-mic', 'mic-foam-windscreen']) find(name);
  assert.ok(!source.includes('razer-snake-emblem'), 'no Razer logo on either earcup');
  const mic = find('detachable-boom-mic');
  const micPoints = mic.geometry.parameters.path.points;
  assert.ok(micPoints.every(point => point.z < 0) && micPoints.at(-1).z < -1 && Math.abs(micPoints.at(-1).x) < 0.1, 'plug and boom project towards the mouth on the front (-Z) side');
  const plugEnd = find('mic-strain-relief').localToWorld(new THREE.Vector3(0, 0.0325, 0));
  assert.ok(plugEnd.distanceTo(mic.localToWorld(micPoints[0].clone())) < 0.02, 'reversed boom remains connected to its plug');
  assert.ok(micPoints.at(-1).y > Math.min(...micPoints.map(point => point.y)), 'boom curves up towards the foam tip like the reference');
  assert.equal(find('volume-dial').material.color.getHexString(), 'e9e9e5', 'lower face dial is white');
  assert.ok(find('volume-dial').position.y < -0.3 && Math.abs(find('volume-dial').position.x) < 0.01, 'dial centred on the lower earcup face');
  assert.equal(find('metal-slider-rail').material.color.getHexString(), '17191c', 'fork rails are black');
  assert.equal(find('swivel-holder').material.color.getHexString(), 'e9e9e5', 'long sleeves are white');
  assert.ok(find('swivel-holder').geometry.parameters.height > 0.45, 'slider sleeves span the side of the cup');
  for (const name of ['left-earcup', 'right-earcup']) {
    const cup = find(name);
    const front = Math.max(...['earcup-shell', 'magnetic-faceplate'].map(name => {
      const part = cup.getObjectByName(name);
      part.geometry.computeBoundingBox();
      return part.position.z + part.geometry.boundingBox.max.z;
    }));
    for (const rail of cup.children.filter(part => part.name === 'metal-slider-rail')) {
      const vertices = rail.geometry.attributes.position;
      for (let i = 0; i < vertices.count; i++) {
        assert.ok(vertices.getZ(i) > front + 0.005, 'entire slider rail clears the earcup face, including its curved middle');
      }
    }
  }
  find('headband-stitch'); find('earcup-link-cable'); find('mic-strain-relief');
  const cushion = find('cushion-flowknit').geometry;
  const hole = cushion.parameters.shapes.holes[0].getPoints(64);
  const opening = new THREE.Box2().setFromPoints(hole);
  const openingSize = opening.getSize(new THREE.Vector2());
  assert.ok(Math.abs(openingSize.x - 0.44) < 0.001 && Math.abs(openingSize.y - 0.66) < 0.001, 'real 44 × 66 mm open cushion aperture');
  assert.equal(find('earcup-shell').material.color.getHexString(), 'e9e9e5');
  assert.ok(find('cushion-flowknit').material.map.isTexture);
  assembly.traverse(object => {
    if (!object.isMesh) return;
    assert.ok(resources.has(object.geometry), object.name + ' geometry tracked for teardown');
    assert.ok(resources.has(object.material), object.name + ' material tracked for teardown');
    if (object.material.map) assert.ok(resources.has(object.material.map), 'texture tracked');
    for (const value of object.geometry.attributes.position.array) assert.ok(Number.isFinite(value), 'finite vertices');
  });
  assert.ok(fs.readFileSync('src/features/desk3d/deskScene.js', 'utf8').includes('runtime.headset = createHeadset(runtime)'), 'factory assembled');
  for (const item of resources) item.dispose();
  console.log('Headset scale, hollow cushions, hook contact, clearances, detail and resource tracking checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
