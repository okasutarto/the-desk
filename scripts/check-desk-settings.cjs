const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { reactive, computed, ref } = require('vue');
const root = `${__dirname}/../src/features/desk3d/`;
const source = file => fs.readFileSync(root + file, 'utf8').replace(/^import .*;\n/gm, '').replace(/\bexport /g, '');
const dependencies = vm.runInNewContext(source('woods.js') + source('daylight.js') + source('timesGateFinishes.js') + source('deviceFinishes.js') + source('blindFinishes.js') + '; ({ WOODS, WOOD_PATTERNS, PART_PATTERNS, WOOD_TARGETS, DEFAULT_WOODS, FLOOR_LAYOUTS, DEFAULT_FLOOR, FRAME_PAINTS, DEFAULT_FRAME_PAINT, BRICKS, DEFAULT_BRICK, DEFAULT_SLATS, TIME_MODES, RAIN_MODES, DEFAULT_TIME, DEFAULT_RAIN, TIMES_GATE_FINISHES, DEFAULT_TIMES_GATE_FINISH, DEVICE_FINISHES, BLIND_PATTERNS, BLIND_COLOURS, DEFAULT_BLIND })');
let stored = null;
let blocked = false;
const context = vm.createContext({ ...dependencies, reactive, computed, localStorage: {
  getItem() { if (blocked) throw Error('blocked'); return stored; },
  setItem(key, value) { if (blocked) throw Error('blocked'); assert.equal(key, 'desk-settings'); stored = value; },
} });
const { readSettings, useDeskSettings, WALL_PATTERNS } = vm.runInContext(source('composables/useDeskSettings.js') + '; ({ readSettings, useDeskSettings, WALL_PATTERNS })', context);
const wallDraws = fs.readFileSync(root + 'textures/roomDetails.js', 'utf8');
for (const key of Object.keys(WALL_PATTERNS)) assert.match(wallDraws, new RegExp(`\\n  ${key}\\(c, w, h`), `the ${key} wall pattern is drawn`);
const baseline = JSON.stringify(readSettings());
for (const invalid of ['{', 'null', 'false', '{"woods":{"desk":null,"window":false},"floor":null}']) {
  stored = invalid;
  assert.equal(JSON.stringify(readSettings()), baseline, 'corrupt preferences fall back to defaults');
}
blocked = true;
assert.equal(JSON.stringify(readSettings()), baseline);
const calls = [];
const scene = ref(null);
const ui = useDeskSettings(scene);
ui.setWall('#ffffff'); // Safe before scene initialization, even without storage.
assert.equal(ui.wallName.value, 'White');
assert.equal(ui.wallIsPreset.value, true);
blocked = false;
scene.value = Object.fromEntries(['setWallColor', 'setWallPattern', 'setWood', 'setFloor', 'setTime', 'setRain', 'setTimesGateFinish', 'setDeviceFinish', 'setBlind'].map(name => [name, (...args) => calls.push([name, ...args])]));
ui.setWall('#123456');
ui.setWallPattern('brick');
ui.setWallBrick('charcoal');
ui.setWallSlats('oak');
ui.setWood('desk', { wood: 'walnut' });
ui.setFloor({ wood: 'walnut' });
ui.setTime('night');
ui.setRain('auto');
assert.equal(calls.length, 8, 'each change reaches the live scene');
assert.equal(ui.wallName.value, 'Custom');
assert.ok(ui.groupSummary.value.sky.includes('Night'));
assert.equal(readSettings().woods.desk.wood, 'walnut');
assert.equal(readSettings().wall, '#123456');
assert.equal(readSettings().wallPattern, 'brick');
assert.equal(ui.groupSummary.value.wall, 'Charcoal', 'a brick wall is named by its clay');
assert.equal(JSON.stringify(calls.filter(([name]) => name === 'setWallPattern').map(([, choice]) => choice)), JSON.stringify([{ pattern: 'brick' }, { brick: 'charcoal' }, { wood: 'oak' }]));
assert.equal(readSettings().wallBrick, 'charcoal');
assert.equal(readSettings().wallSlats, 'oak');
ui.setWallPattern('slats');
assert.equal(ui.groupSummary.value.wall, 'Oak slats');
ui.setWallPattern('stripes');
assert.equal(ui.groupSummary.value.wall, 'Custom, stripes', 'painted patterns keep the paint');
assert.equal(readSettings().time, 'night');
assert.ok(ui.woodLabel('desk').length > 0);
assert.equal(ui.isDarkColour('#000000'), true);
assert.equal(ui.isDarkColour('#ffffff'), false);
for (const finish of ['silver', 'pink', 'white', 'bumblebee']) {
  ui.setTimesGateFinish(finish);
  assert.equal(readSettings().timesGateFinish, finish);
  assert.equal(calls.at(-1)[0], 'setTimesGateFinish');
  assert.equal(calls.at(-1)[1], finish);
  assert.ok(ui.groupSummary.value.devices.endsWith(dependencies.TIMES_GATE_FINISHES[finish].name), 'the Times Gate is summed up with the desk devices');
}
ui.setTimesGateFinish('constructor');
assert.equal(readSettings().timesGateFinish, 'bumblebee', 'invalid live finishes are ignored');
stored = JSON.stringify({ timesGateFinish: 'toString' });
assert.equal(readSettings().timesGateFinish, 'silver', 'invalid saved finishes fall back to silver');
for (const [part, device] of Object.entries(dependencies.DEVICE_FINISHES)) {
  for (const finish of Object.keys(device.finishes)) {
    ui.setDeviceFinish(part, finish);
    assert.equal(readSettings().deviceFinishes[part], finish);
    assert.deepEqual(calls.at(-1), ['setDeviceFinish', part, finish]);
  }
  const before = JSON.stringify(ui.settings.deviceFinishes);
  ui.setDeviceFinish(part, 'constructor');
  ui.setDeviceFinish('constructor', 'white');
  assert.equal(JSON.stringify(ui.settings.deviceFinishes), before);
  stored = JSON.stringify({ deviceFinishes: { [part]: 'toString' } });
  assert.equal(readSettings().deviceFinishes[part], device.default);
}
// The blind's print and colour are picked apart, saved together and handed to the scene whole
assert.equal(JSON.stringify(readSettings().blind), JSON.stringify(dependencies.DEFAULT_BLIND));
assert.equal(ui.groupSummary.value.blind, 'Cool grey');
for (const pattern of Object.keys(dependencies.BLIND_PATTERNS)) {
  ui.setBlind({ pattern });
  assert.equal(readSettings().blind.pattern, pattern);
  assert.equal(JSON.stringify(calls.at(-1)), JSON.stringify(['setBlind', { pattern, colour: readSettings().blind.colour }]));
}
for (const coat of dependencies.BLIND_COLOURS) {
  ui.setBlind({ colour: coat.hex });
  assert.equal(ui.blindColourName.value, coat.name);
  assert.equal(ui.blindIsPreset.value, true);
}
assert.equal(readSettings().blind.pattern, 'leaves', 'a new colour keeps the print');
assert.equal(ui.groupSummary.value.blind, 'Charcoal, leaves');
ui.setBlind({ colour: '#123abc' });
assert.equal(ui.blindIsPreset.value, false);
assert.equal(ui.groupSummary.value.blind, 'Custom, leaves');
const blindBefore = JSON.stringify(ui.settings.blind);
const callCount = calls.length;
ui.setBlind({ pattern: 'constructor' });
ui.setBlind({ colour: 'red' });
ui.setBlind({ pattern: 'stripes', colour: '#zzzzzz' });
assert.equal(JSON.stringify(ui.settings.blind), blindBefore, 'invalid blind picks are ignored');
assert.equal(calls.length, callCount);
stored = JSON.stringify({ blind: { pattern: 'toString', colour: 'url(x)' } });
assert.equal(JSON.stringify(readSettings().blind), JSON.stringify(dependencies.DEFAULT_BLIND), 'invalid saved blinds fall back to the grey');
stored = JSON.stringify({ wallPattern: 'toString', wallBrick: 'gold', wallSlats: 'constructor' });
assert.equal(readSettings().wallPattern, 'plain', 'unknown wall patterns fall back to plain');
assert.equal(readSettings().wallBrick, 'red');
assert.equal(readSettings().wallSlats, 'walnut');
console.log('Room settings: corrupt/blocked storage, reactive labels, scene updates and persistence passed.');
