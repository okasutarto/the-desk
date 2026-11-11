// Run: node scripts/check-desk-speakers.cjs
const assert = require('node:assert/strict');
const vm = require('node:vm');
const THREE = require('three');
const source = require('./helpers/desk-source.cjs').readDeskSource();
const start = source.indexOf('  function pump(speaker, strength = 1)');
const end = source.indexOf('  // Spotifree on the monitor', start);
const speakers = [];
const leds = [];
const handlers = [];
let toggles = 0;
const ctx = vm.createContext({
  canvasTexture: () => ({ texture: new THREE.Texture(), ctx: { fillRect() {}, beginPath() {}, moveTo() {}, bezierCurveTo() {}, stroke() {}, fillText() {}, createLinearGradient: () => ({ addColorStop() {} }) } }),
  drawWoodTop() {}, drawBrushedMetal() {}, drawLeather() {},
  DEFAULT_WOODS: { speakers: { wood: "oak", pattern: "planks" } },
  SPEAKER_FINISHES: { wood: { color: null, shell: '#4a4c50', baffle: '#64676b' } },
  hoverSound() {}, THREE, speakers, speakerLeds: leds, soundMuted: true, scene: new THREE.Group(), RISER_TOP: 0.5,
  toon: (color) => new THREE.MeshToonMaterial({ color }), track: (value) => value,
  rbox: (w,h,d) => new THREE.BoxGeometry(w,h,d), mesh: (geometry, material) => new THREE.Mesh(geometry, material),
  noRaycast() {}, register: (obj, handler) => handlers.push(handler),
  floatNote() {},
  gsap: { to: (obj, values) => { for (const axis of ['x', 'y', 'z']) if (axis in values) obj[axis] = values[axis]; }, fromTo: (obj, from, to) => { Object.keys(from).forEach((key) => { obj[key] = to[key]; }); } },
  onEvent: (name) => { assert.equal(name, 'toggleSound'); toggles++; }, sfx: { powerDown() {} },
});
vm.runInContext(source.slice(start, end), ctx);
assert.equal(speakers.length, 2);
const world = (part) => part.getWorldPosition(new THREE.Vector3());
speakers.forEach((speaker, index) => {
  speaker.group.updateMatrixWorld(true);
  const origin = speaker.group.position;
  const cabinet = speaker.group.getObjectByName('s1000mkiii-cabinet');
  const size = new THREE.Box3().setFromObject(cabinet).getSize(new THREE.Vector3());
  // the R1280DBs's footprint, kept so the pair still fits the riser
  for (const [axis, expected] of Object.entries({ x: 1.46, y: 2.29, z: 1.96 })) {
    assert.ok(Math.abs(size[axis] - expected) < 0.006, `cabinet ${axis} keeps the old speaker's size: ${size[axis]}`);
  }
  const whole = new THREE.Box3().setFromObject(speaker.group);
  const wholeSize = whole.getSize(new THREE.Vector3());
  assert.ok(Math.abs(wholeSize.y - 2.34) < 0.006 && wholeSize.x < 1.47, `feet and drivers stay inside the box: ${wholeSize.toArray()}`);
  assert.ok(whole.max.z - origin.z < 0.981 && whole.min.z - origin.z > -1.05, 'nothing on the baffle stands past the panels, only the knobs and terminals off the back');
  assert.ok(Math.abs(whole.min.y - origin.y) < 1e-6, 'stands on the riser');
  const sides = cabinet.children.filter(part => part.name === 'wood-side-panel');
  assert.equal(sides.length, 2);
  assert.ok(sides.every(part => part.material === vm.runInContext('speakerWoodMat', ctx)), 'side panels use the furniture wood');
  assert.ok(sides.every(part => Math.abs(Math.abs(part.position.x) - 0.67) < 0.001), 'panels sit on both sides');
  // the side profile: the front leans back, and the top back corner is clipped
  sides[0].geometry.computeBoundingBox();
  const panel = sides[0].geometry.boundingBox;
  const topFront = Math.max(...Array.from({ length: sides[0].geometry.attributes.position.count }, (_, i) => sides[0].geometry.attributes.position.getY(i) > 2.2 ? sides[0].geometry.attributes.position.getZ(i) : -9));
  assert.ok(panel.max.z - topFront > 0.2, 'the front leans back towards the top');
  const front = speaker.group.getObjectByName('leaning-front');
  assert.ok(front.rotation.x < -0.05, 'the baffle leans back with the panels');
  assert.equal(cabinet.getObjectByName('cabinet-body').material[1], vm.runInContext('speakerBaffleMat', ctx), 'the leather wraps the top and back as well as the front');
  assert.equal(front.getObjectByName('front-baffle').material, vm.runInContext('speakerBaffleMat', ctx), 'the baffle takes the leather finish');
  assert.ok(world(speaker.tweeter).y > world(speaker.woofer).y + 0.8, 'tweeter sits above the woofer');
  assert.equal(speaker.tweeter.position.x, 0, 'tweeter centred');
  assert.equal(speaker.woofer.position.x, 0, 'woofer centred');
  assert.ok(front.getObjectByName('tweeter-plate') && front.getObjectByName('tweeter-face'), 'tweeter on its round flange with its grey face');
  assert.ok(front.getObjectByName('driver-surround') && front.getObjectByName('woofer-frame'));
  assert.equal(front.children.filter(part => part.name === 'baffle-screw').length, 10, 'four tweeter screws and six on the woofer frame');
  assert.equal(front.children.filter(part => part.name === 'grille-pin').length, 4, 'four grille pins');
  assert.equal(speaker.group.children.filter(part => part.name === 'brass-foot').length, 4, 'four brass feet');
  assert.ok(speaker.group.getObjectByName('rear-bass-port'));
  assert.equal(speaker.woofer.geometry.type, 'LatheGeometry');
  const normals = speaker.woofer.geometry.attributes.normal;
  assert.ok(Array.from({ length: normals.count }, (_, i) => normals.getY(i)).some(y => y > 0.5), 'cone faces listener');
  const knobs = speaker.group.children.filter(part => part.name === 'rear-knob');
  const status = speaker.group.getObjectByName('speaker-power-indicator');
  if (index === 1) {
    assert.equal(knobs.length, 3, 'volume, treble and bass on the back of the active speaker');
    assert.ok(knobs.every(knob => knob.position.z < -0.98), 'knobs stand off the back');
    assert.ok(front.getObjectByName('status-window') && front.getObjectByName('hi-res-badge'));
    assert.ok(front.getObjectByName('hi-res-badge-print').material.map, 'the badge is printed Hi-Res over Audio');
    assert.ok(world(status).y < world(speaker.woofer).y - 0.5, 'status light glows in the slot under the woofer');
  } else {
    assert.equal(knobs.length, 0);
    assert.equal(status, undefined, 'the passive speaker has no status light');
    assert.equal(front.getObjectByName('hi-res-badge'), undefined);
    assert.equal(speaker.group.children.filter(part => part.name === 'binding-post').length, 2);
  }
  ctx.speaker = speaker;
  vm.runInContext('pump(speaker, 1)', ctx);
  assert.equal(speaker.dustCap.position.z, speaker.dustCap.userData.restZ);
  assert.equal(speaker.group.scale.y, 1);
});
assert.equal(leds.length, 1, 'one status light, on the active speaker');
assert.ok(leds.every((led) => led.color.getHexString() === 'e11d48'), 'initial LEDs respect mute');
handlers.forEach((handler, i) => {
  handler.onHover(true);
  assert.ok(speakers[i].group.rotation.x < 0);
  handler.onHover(false);
  assert.equal(speakers[i].group.rotation.x, 0, 'speaker settles back on its base');
  assert.equal(toggles, i, 'hover never toggles sound');
  handler.onClick();
});
assert.equal(toggles, 2, 'both speakers still toggle sound');
console.log('S1000MKIII size, leaning wood-sided cabinet, drivers, slot light, rear controls and interaction checks passed.');
