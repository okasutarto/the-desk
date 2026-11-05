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
  // Canvas calls (and the gradients they return) are recorded and otherwise ignored.
  const painted = [];
  const paint = new Proxy({}, { get: (_, key) => (...args) => (painted.push(key), key === 'createLinearGradient' ? { addColorStop() {} } : undefined), set: () => true });
  const DEVICE_FINISHES = vm.runInNewContext(fs.readFileSync('src/features/desk3d/deviceFinishes.js', 'utf8').replace(/export /g, '') + '; DEVICE_FINISHES');
  const sounds = [];
  const sfx = new Proxy({}, { get: (_, name) => options => sounds.push([name, options]) });
  const factory = vm.runInNewContext(source.replace(/^import .*;\n/gm, '').replace('export function', 'function') + ';createHeadset', {
    THREE, mergeVertices, canvasTexture: () => ({ texture: new THREE.Texture(), ctx: paint }),
    DEVICE_FINISHES, sfx, hoverSound: (key, cue) => cue(sfx), performance, Math,
  });
  const registered = new Map();
  const listeners = new Map();
  const domElement = { addEventListener: (type, fn, options) => listeners.set(type, { fn, options }) };
  const lofi = { playing: false, volume: 0.55, setVolume(v) { return (this.volume = Math.round(Math.min(0.9, Math.max(0, v)) * 100) / 100); } };
  const notes = [];
  const workstation = { lofi, soundMuted: false, floatNoteAt: (...args) => notes.push(args) };
  const model = factory({ room: { desk }, workstation, camera: { focus: { name: null } }, options: { deviceFinishes: {} }, core: {
    scene, track, toon: color => track(new THREE.MeshToonMaterial({ color })),
    mesh: (geometry, material) => new THREE.Mesh(track(geometry), material),
    rbox: (w, h, d, radius) => new RoundedBoxGeometry(w, h, d, 2, radius),
    register: (object, handlers) => registered.set(object, handlers),
    renderer: { domElement },
  } });
  const { assembly, headset, swing } = model;
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
  assert.ok(Math.abs(headset.getWorldPosition(new THREE.Vector3()).y + 0.86 - (pad.max.y)) < 0.02, 'headband underside rests on padded saddle');
  assert.ok(Math.abs(swing.position.y - pad.max.y) < 1e-6, 'swing pivots where the crown rests on the pad');
  assert.ok(innerBand.max.y > pad.max.y, 'crown wraps over the supporting saddle');
  for (const name of ['left-earcup', 'right-earcup', 'metal-slider-rail', 'swivel-holder', 'volume-dial', 'configurable-roller', 'usb-c-recess', 'usb-c-tongue', 'anc-button', 'smartswitch-button', 'mute-button', 'detachable-boom-mic', 'mic-foam-windscreen']) find(name);
  const emblems = [];
  assembly.traverse(object => object.name === 'tri-talon-emblem' && emblems.push(object));
  assert.equal(emblems.length, 2, 'an original tri-talon emblem on each earcup');
  assert.ok(emblems.every(mark => mark.material.alphaTest > 0 && mark.material.map && mark.material.emissiveMap === mark.material.map), 'emblem is cut out of its canvas and lit by it');
  assert.ok(painted.filter(call => call === 'bezierCurveTo').length >= 15, 'emblem is painted in detail (blades, grooves, catch-lights)');
  for (const mark of emblems) {
    const face = mark.parent.getObjectByName('magnetic-faceplate');
    face.geometry.computeBoundingBox();
    assert.ok(mark.position.z > face.position.z + face.geometry.boundingBox.max.z, 'emblem sits on the faceplate front');
    assert.ok(mark.position.y - 0.2 > mark.parent.getObjectByName('dial-seat').position.y + 0.112, 'emblem clears the dial');
  }
  assert.ok(!/razer|blackshark/i.test(JSON.stringify(DEVICE_FINISHES.headset)), 'headset finishes carry no brand names');
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
  // Finishes recolour the mouldings, stitching, dial caps and emblem ink in place.
  for (const [name, coat] of Object.entries(DEVICE_FINISHES.headset.finishes)) {
    model.setHeadsetFinish(name);
    assert.equal('#' + find('earcup-shell').material.color.getHexString(), coat.shell, name + ' shell');
    assert.equal('#' + find('faceplate-seam').material.color.getHexString(), coat.seam, name + ' seam');
    assert.equal('#' + find('dial-brushed-cap').material.color.getHexString(), coat.cap, name + ' cap');
    assert.equal('#' + emblems[0].material.color.getHexString(), coat.ink, name + ' emblem ink');
  }
  assert.doesNotThrow(() => model.setHeadsetFinish('constructor'));
  model.setHeadsetFinish('white');
  // A click sets it swinging round the saddle; the spring brings it back to rest.
  const handlers = registered.get(swing);
  assert.ok(handlers?.onClick && handlers.onHover, 'headset is registered for hover and click');
  handlers.onClick();
  let peak = 0;
  for (let i = 0; i < 30; i++) model.updateHeadset(1 / 60, i * 16), peak = Math.max(peak, Math.abs(swing.rotation.x));
  assert.ok(peak > 0.08 && peak <= 0.26, 'click swings it visibly but within its limit');
  assert.ok(model.swinging, 'a swing counts as motion');
  for (let i = 0; i < 60 * 8; i++) model.updateHeadset(1 / 60, i * 16);
  assert.ok(Math.abs(swing.rotation.x) < 0.01 && !model.swinging, 'swing settles');
  assert.ok(sounds.some(([name]) => name === 'rubber'), 'click is heard');
  // The wheel turns the volume dial (and the music) only while the headset is hovered.
  const wheel = listeners.get('wheel');
  assert.equal(wheel.options.passive, false);
  const event = deltaY => ({ deltaY, prevented: false, preventDefault() { this.prevented = true; } });
  let e = event(-100);
  wheel.fn(e);
  assert.ok(!e.prevented && lofi.volume === 0.55, 'wheel ignored away from the headset');
  handlers.onHover(true);
  wheel.fn(e = event(-100));
  assert.ok(e.prevented && lofi.volume === 0.6, 'wheel up turns the music up a detent');
  for (let i = 0; i < 60; i++) model.updateHeadset(1 / 60, i * 16);
  assert.ok(find('volume-dial').rotation.y > 0.3, 'volume dial turns with it');
  for (let i = 0; i < 20; i++) wheel.fn(event(100));
  assert.equal(lofi.volume, 0, 'volume stops at silent');
  handlers.onHover(false);
  // With music playing the LED and emblem light up, and each kick flares the emblem.
  const ledMaterial = find('status-led').material;
  model.updateHeadset(1 / 60, 0);
  assert.equal(ledMaterial.emissive.getHex(), 0, 'LED dark at rest');
  lofi.playing = true;
  for (let i = 0; i < 120; i++) model.updateHeadset(1 / 60, i * 16);
  assert.ok(ledMaterial.emissive.g > 0.1, 'LED lights while music plays');
  const steady = emblems[0].material.emissive.g;
  model.beat('kick');
  model.updateHeadset(1 / 60, 2000);
  assert.ok(emblems[0].material.emissive.g > steady * 1.5, 'kick flares the emblem');
  assert.ok(find('left-earcup').scale.x > 1, 'earcups thump on the beat');
  assert.ok(!model.swinging, 'the beat only trembles it: no shadow redraws');
  for (let i = 0; i < 40; i++) model.beat('snare');
  assert.ok(notes.length > 0 && notes.every(([point]) => point.isVector3), 'notes leak out of the earcups');
  assert.ok(fs.readFileSync('src/features/desk3d/scene/lifecycle.js', 'utf8').includes('runtime.headset.onWheel'), 'wheel listener removed on teardown');
  assembly.traverse(object => {
    if (!object.isMesh) return;
    assert.ok(resources.has(object.geometry), object.name + ' geometry tracked for teardown');
    assert.ok(resources.has(object.material), object.name + ' material tracked for teardown');
    if (object.material.map) assert.ok(resources.has(object.material.map), 'texture tracked');
    for (const value of object.geometry.attributes.position.array) assert.ok(Number.isFinite(value), 'finite vertices');
  });
  assert.ok(fs.readFileSync('src/features/desk3d/deskScene.js', 'utf8').includes('runtime.headset = createHeadset(runtime)'), 'factory assembled');
  for (const item of resources) item.dispose();
  console.log('Headset scale, hollow cushions, hook contact, clearances, detail, emblem, finishes, swing, volume dial, beat and resource tracking checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
