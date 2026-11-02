const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { reactive, computed, ref } = require('vue');
const root = `${__dirname}/../src/features/desk3d/`;
const source = file => fs.readFileSync(root + file, 'utf8').replace(/^import .*;\n/gm, '').replace(/\bexport /g, '');
const dependencies = vm.runInNewContext(source('woods.js') + source('daylight.js') + source('timesGateFinishes.js') + '; ({ WOODS, WOOD_PATTERNS, PART_PATTERNS, WOOD_TARGETS, DEFAULT_WOODS, FLOOR_LAYOUTS, DEFAULT_FLOOR, FRAME_PAINTS, DEFAULT_FRAME_PAINT, BRICKS, DEFAULT_BRICK, DEFAULT_SLATS, TIME_MODES, RAIN_MODES, DEFAULT_TIME, DEFAULT_RAIN, TIMES_GATE_FINISHES, DEFAULT_TIMES_GATE_FINISH })');
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
scene.value = Object.fromEntries(['setWallColor', 'setWallPattern', 'setWood', 'setFloor', 'setTime', 'setRain', 'setTimesGateFinish'].map(name => [name, (...args) => calls.push([name, ...args])]));
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
  assert.ok(ui.groupSummary.value.timesgate.length > 0);
}
ui.setTimesGateFinish('constructor');
assert.equal(readSettings().timesGateFinish, 'bumblebee', 'invalid live finishes are ignored');
stored = JSON.stringify({ timesGateFinish: 'toString' });
assert.equal(readSettings().timesGateFinish, 'silver', 'invalid saved finishes fall back to silver');
stored = JSON.stringify({ wallPattern: 'toString', wallBrick: 'gold', wallSlats: 'constructor' });
assert.equal(readSettings().wallPattern, 'plain', 'unknown wall patterns fall back to plain');
assert.equal(readSettings().wallBrick, 'red');
assert.equal(readSettings().wallSlats, 'walnut');
console.log('Room settings: corrupt/blocked storage, reactive labels, scene updates and persistence passed.');
