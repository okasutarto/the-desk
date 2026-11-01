// Run: node scripts/check-desk-lighting.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = require('./helpers/desk-source.cjs').readDeskSource();
const THREE = require('three');
const textures = require('./helpers/texture-source.cjs').readTexturesSource();
const skySource = textures.slice(textures.indexOf('function mixHex('), textures.indexOf('// `time` is the part of the day outside')).replace('export function', 'function');
const windowSky = vm.runInNewContext(skySource + '; windowSky');
const moodCode = source.slice(source.indexOf('  const daylightParts ='), source.indexOf('  const windowView ='));
// The room opens on the part of the day its time mode gives (auto: the visitor's clock); a
// night start waits for the page's dark theme, so a light page opens on the morning
const daylightSource = fs.readFileSync(path.join(__dirname, '../src/features/desk3d/daylight.js'), 'utf8').replace(/export /g, '');
const daylight = vm.runInNewContext(daylightSource + '; ({ TIME_MODES, partFor, partOfDay })');
for (const [hour, expected] of [[6, 'morning'], [12, 'day'], [17, 'evening'], [21, 'night'], [2, 'night']]) {
  assert.equal(daylight.partOfDay(new Date(2026, 0, 1, hour)), expected, `${hour}:00 is ${expected}`);
}
for (const [time, dark, expected] of [['morning', false, 'morning'], ['day', false, 'day'], ['evening', false, 'evening'], ['night', false, 'morning'], ['day', true, 'night']]) {
  const mood = vm.runInNewContext(moodCode + '; ({ dayPart, outside })', {
    windowSky, previewTime: null, dark, time, partFor: daylight.partFor, outside: { night: dark },
  });
  assert.equal(mood.dayPart(), expected, `${time}${dark ? ' on a dark page' : ''} opens on ${expected}`);
}
let clockPart = 'day';
let weatherChecks = 0;
let now = 0;
const material = () => ({ color: new THREE.Color() });
const sun = new THREE.SpotLight();
const windowLight = new THREE.SpotLight();
const lampLight = new THREE.PointLight();
const ambient = new THREE.AmbientLight();
const readabilityFill = new THREE.DirectionalLight();
const skyFill = new THREE.HemisphereLight();
const events = [];
const speakerWoodPaints = [];
const context = vm.createContext({
  ...vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/features/desk3d/woods.js'), 'utf8').replace(/export /g, '') + '; ({ WOODS, WOOD_PATTERNS, PART_PATTERNS, DEFAULT_WOODS, DEFAULT_FLOOR, DEFAULT_FRAME_PAINT, FLOOR_LAYOUTS, SPEAKER_FINISHES })'),
  wallColor: '#3a3a3a', wallPattern: {}, WALL_MATERIALS: ['brick', 'slats'], woods: {}, floor: {}, diorama: false, roomBackground: isDark => isDark ? '#d6d3e6' : '#ffffff',
  deskWood: {}, speakerGrain: { canvas: { width: 768, height: 512 }, ctx: {}, texture: new THREE.Texture() },
  speakerWoodMat: material(), speakerShellMat: material(), speakerBaffleMat: material(), drawWoodTop: (ctx, w, h, choice) => speakerWoodPaints.push({ ...choice }), riserGrain: {}, frameGrainTex: {}, shelfWood: {},
  frameWood: material(), shelfMat: material(), shelfBackMat: material(), lipMat: material(),
  familyPhoto: { userData: { tex: { redraw() {} } } },
  windowGlare: { material: { color: new THREE.Color() } }, printGlow: { level: 1 }, THREE, windowSky, previewTime: null, roomLight: { night: 0 }, dark: false, outside: { night: false, rain: 0 },
  time: 'auto', TIME_MODES: daylight.TIME_MODES, partFor: (mode) => (daylight.TIME_MODES[mode] && mode !== 'auto' ? mode : clockPart),
  refreshWeather: () => weatherChecks++,
  performance: { now: () => now }, Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
  deskNeons: [{ strip: {}, washMat: {} }, { strip: {}, washMat: {} }], SKY_REACH: 12, blind: { lift: 1 },
  aimWindowLight: (at, { aimFrom = null, blend = 1 } = {}) => { windowLight.userData.sky = [...at]; windowLight.userData.aim = { aimFrom, blend }; }, aimNow: { elevation: 0.7, across: 0 },
  blindFabric: {}, shadowedNeons: [{}, {}, {}],
  cookieRain: 0, drawGlassCookie() {}, DESK_WASH: 0.45, monitorGlowMat: {}, updateLampGlow() {}, updateLightbar() {}, setLightbar() {}, lightbarState: { power: 0 },
  riserMat: material(), riserLegMat: material(), RISER_LEG_SHADE: 0.8,
  hoopBoardFace: { material: { emissiveIntensity: 0 } }, net: { material: material() },
  sun, windowLight, lampLight, ambient, readabilityFill, skyFill,
  jointMat: material(), floorMat: material(), backWallMat: material(),
  sideWallMat: material(), trimMat: material(), deskMat: material(), shadowFill: material(),
  scene: {}, gsap: { killTweensOf() {} }, setNeon() {}, catSettle() {}, desktop: { setTheme() {} }, redrawScreen() {},
  onEvent: (name, payload) => events.push([name, payload.dark]),
  windowView: { userData: { tex: { redraw() {} } } },
  PALETTES: { light: { desk: '#a388ee', shadow: '#000' }, dark: { desk: '#6b5bc4', shadow: '#000' } },
});
const lampCode = source.slice(source.indexOf('  const setLamp ='), source.indexOf('  // Like a desk lamp with a mind'));
const themeStart = source.indexOf('  // ---------- theme ----------');
vm.runInContext(moodCode + lampCode + source.slice(themeStart, source.indexOf('  // ---------- pointer', themeStart)), context);
const run = (code) => vm.runInContext(code, context);
const update = (at) => { now = at; run(`updateLighting(${at})`); };
update(0);
const clearDay = windowLight.intensity;
const clearAmbient = ambient.intensity;
const clearShadowRadius = windowLight.shadow.radius;
assert.equal(sun.castShadow, true, 'room bounce retains soft cast shadows on all props outside the direct window patch');
assert.equal(windowLight.castShadow, true);
assert.ok(clearDay > sun.intensity / context.SKY_REACH * 5, 'window is the dominant direct light');
const openSky = sun.intensity;
context.blind.lift = 0;
update(5);
assert.ok(sun.intensity < openSky * 0.3, 'the blind drawn down shuts out most of the sky light');
context.blind.lift = 1;
update(6);
assert.equal(sun.intensity, openSky, 'raising it lets the sky back in');
assert.equal(lampLight.intensity, 0);
context.outside.rain = 1;
update(10);
assert.ok(windowLight.intensity < clearDay * 0.15, 'rain obscures the sun');
assert.ok(windowLight.shadow.radius > clearShadowRadius * 2, 'rain softens the exterior light shadow');
assert.ok(ambient.intensity > clearAmbient * 0.7, 'cloudy sky still provides diffuse light');
update(20);
assert.ok(Math.abs(windowLight.intensity - clearDay * 0.12) < 1e-10, 'rain attenuation must not compound every frame');
context.outside.rain = 0;
update(30);
assert.equal(windowLight.intensity, clearDay, 'clear weather restores daylight');
assert.equal(windowLight.shadow.radius, clearShadowRadius, 'clear weather restores crisp daylight shadows');
const dayColor = context.scene.background.clone();
const daySky = context.outside.sky.sun.slice();
now = 90000;
run('updateDaylight(90000)');
assert.equal(run('dayPart()'), 'day', 'the room holds while the clock stays in the same part of the day');
clockPart = 'evening';
now = 100000;
run('updateDaylight(100000)');
assert.equal(run('dayPart()'), 'day', 'the clock is only read every half minute');
now = 120000;
run('updateDaylight(120000)');
assert.equal(run('dayPart()'), 'evening', 'the room moves on when the visitor\'s clock does');
assert.equal(windowLight.intensity, clearDay, 'theme request does not jump the light');
update(121000);
assert.ok(Math.abs(windowLight.intensity - (clearDay + 3.6) / 2) < 1e-10);
assert.ok(context.outside.sky.sun[1] > daySky[1], 'sun lowers smoothly toward the evening horizon');
// The beam turns straight from its aim when the change began toward the evening sun's, at the
// sky's own pace, rather than following the painted sun's place (which swung it out and back)
assert.deepEqual(windowLight.userData.sky, [...windowSky('evening').sun], 'the beam is aimed toward the new part of the day');
assert.deepEqual({ ...windowLight.userData.aim.aimFrom }, { elevation: 0.7, across: 0 }, 'from the aim it had when the change began');
assert.equal(windowLight.userData.aim.blend, context.outside.skyBlend, 'in step with the sky');
update(122000);
assert.equal(windowLight.intensity, 3.6);
now = 180000;
clockPart = 'night';
run('updateDaylight(180000)');
update(181000);
assert.ok(lampLight.intensity > 0 && lampLight.intensity < 8, 'desk lamp fades in with night');
assert.ok(!context.scene.background.equals(dayColor));
const halfwayNight = windowLight.intensity;
const halfwaySky = [...context.outside.sky.sun];
run('setRoomTheme(false)');
assert.equal(windowLight.intensity, halfwayNight, 'interrupted transition starts at its current light');
assert.deepEqual([...context.outside.skyFrom.sun], halfwaySky, 'interrupted sky starts at its current position');
update(183000);
assert.equal(lampLight.intensity, 0);
assert.equal(lampLight.castShadow, false);
assert.equal(run('dayPart()'), 'morning');
now = 200000;
run('setRoomTheme(true)');
update(202000);
assert.equal(lampLight.intensity, 8);
assert.ok(ambient.intensity < clearAmbient / 2, 'night ambient must leave the desk lamp and neons in charge');
assert.ok(windowLight.intensity < clearDay / 10, 'moonlight stays subtle compared with sunlight');
assert.ok(windowLight.intensity < clearDay / 2);
assert.ok(context.shadowedNeons.every((light) => light.castShadow));
assert.deepEqual(events, [['nightShift', true]]);
// The exposed bulb uses an omnidirectional light at the filament, not a displaced cone.
{
  const lampStart = source.indexOf('  const lampLight = new THREE.');
  const lampEnd = source.indexOf('  lampHead.add(', lampStart);
  const bulb = vm.runInNewContext(source.slice(lampStart, lampEnd) + '; lampLight', { THREE, BULB_Y: -0.86 });
  assert.ok(bulb.isPointLight, 'an exposed bulb must illuminate both wall and desk');
  assert.equal(bulb.position.y, -0.86, 'light originates inside the bulb');
  assert.ok(bulb.shadow.camera.near < 0.1, 'nearby socket can occlude the bulb');
}
// The desk light spans the entire rear edge, with overlapping samples and no monitor hotspots.
{
  const scene = new THREE.Scene();
  const ctx = vm.createContext({ THREE, scene, WALL_Z: -4.58, track: (value) => value, noRaycast() {}, DESK_WASH: 0.45, DESK_W: 16, DESK_X: -1 });
  const start = source.indexOf('  const neonLights =');
  const end = source.indexOf('  // A framed illustration on the left wall:', start);
  vm.runInContext(source.slice(start, end), ctx);
  const lights = vm.runInContext('deskNeons.flatMap(({ lights }) => lights)', ctx);
  assert.equal(lights.length, 4);
  assert.ok(lights.every((light) => light.isSpotLight && light.castShadow && light.penumbra > 0 && light.penumbra < 0.2), 'strip samples are feathered and shadowed');
  assert.ok(lights.every((light) => light.decay === 0 && light.angle > 1.3), 'line samples must overlap without near-wall inverse-square hotspots');
  assert.ok(lights[0].position.x < -6 && lights.at(-1).position.x > 4, 'illumination spans the full sixteen-unit desk');
  for (let i = 1; i < lights.length; i++) assert.ok(Math.abs(lights[i].position.x - lights[i - 1].position.x - 4) < 1e-10, 'uniform spacing avoids concentrated light centres');
  assert.ok(lights.every((light) => light.position.z === -4.23 && light.position.y === -0.3), 'every source belongs to the actual rear LED strip');
  vm.runInContext('updateNeonLights(0)', ctx);
  assert.ok(lights.every((light) => light.intensity === 0), 'strip is off in daylight');
  vm.runInContext('deskNeons.forEach(({ washMat }) => washMat.opacity = DESK_WASH); updateNeonLights(100)', ctx);
  assert.ok(lights.every((light) => Math.abs(light.intensity - 1.65) < 1e-10), 'even output across the strip at night');
  const monitor = new THREE.Group();
  ctx.monitor = monitor;
  ctx.SCREEN_Y = 2.13;
  const biasStart = source.indexOf('  // The monitor has the same cyan/pink bias strip.');
  vm.runInContext(source.slice(biasStart, source.indexOf('  // Speakers either side of the monitor', biasStart)), ctx);
  const bias = monitor.children.filter((child) => child.isSpotLight);
  assert.equal(bias.length, 2, 'monitor has matching rear-facing strip lighting');
  assert.ok(bias.every((light) => light.position.z < -0.07 && light.target.position.z < light.position.z && light.castShadow));
  assert.deepEqual(bias.map((light) => light.color.getHex()), [0x00e0c6, 0xff90e8]);
  assert.equal(vm.runInContext('shadowedNeons.length', ctx), 6, 'desk and monitor leave sampler headroom for the task light and textured materials');
  vm.runInContext('monitorGlowMat.opacity = 0.7; updateNeonLights(200)', ctx);
  assert.ok(bias.every((light) => light.intensity === 2.2));
}
assert.ok(source.includes('const LIGHTING_TRANSITION = 2000'), 'phase fades complete in two seconds');
now = 250000;
const checksBefore = weatherChecks;
run('updateDaylight(250000)');
assert.equal(run('nextDaylightAt') - now, 30000, 'the clock is read again in half a minute, with no timed cycle');
assert.equal(weatherChecks, checksBefore + 1, 'the visitor\'s weather is checked on the same beat');
run('setTime("evening")');
assert.equal(run('dayPart()'), 'evening', 'a picked part of the day holds');
clockPart = 'morning';
now = 400000;
run('updateDaylight(400000)');
assert.equal(run('dayPart()'), 'evening', 'a picked part of the day ignores the clock');

// Preserve texture/detail samplers when night and close-up lights compete for GPU slots.
{
  const scene = new THREE.Scene();
  const detailed = new THREE.MeshToonMaterial({ map: new THREE.Texture(), emissiveMap: new THREE.Texture(),
    gradientMap: new THREE.Texture(), bumpMap: new THREE.Texture() });
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), detailed));
  const light = () => new THREE.SpotLight(0xffffff, 1);
  const swordSpotlight = light();
  swordSpotlight.intensity = 0;
  const windowLight = light();
  windowLight.map = new THREE.Texture();
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  const lampLight = light(), lightbarLight = light(), signLight = light(), screenLight = light();
  const shadowedNeons = [signLight, screenLight, ...Array.from({ length: 6 }, light)];
  const ctx = vm.createContext({ scene, renderer: { capabilities: { maxTextures: 16 } }, swordSpotlight,
    windowLight, sun, lampLight, lightbarLight, signLight, screenLight, shadowedNeons,
    darkNow: true, lightingBlending: false, lowPower: false, benchmark: null });
  const start = source.indexOf('  const materialMapKeys =');
  vm.runInContext(source.slice(start, source.indexOf('  let frame = null;', start)), ctx);
  const checkBudget = () => {
    vm.runInContext('updateShadowBudget()', ctx);
    const shadows = vm.runInContext('shadowLights.filter((light) => light.castShadow).length', ctx);
    assert.ok(shadows + 4 + 1 <= 16, 'shadows plus material textures and window cookie must fit the fragment limit');
    assert.equal(sun.castShadow, true, 'retain the room-wide shadow before redundant strip samples');
  };
  checkBudget();
  const shadowed = () => vm.runInContext('shadowLights.map((light) => light.castShadow).join()', ctx);
  const dark = shadowed();
  swordSpotlight.intensity = 1.25;
  checkBudget();
  assert.equal(shadowed(), dark, 'a light coming on keeps the shadowed set, so no lit shader recompiles');
  assert.equal(swordSpotlight.castShadow, true, 'focused swords retain priority without dropping printed detail');
  assert.ok(detailed.map && detailed.emissiveMap && detailed.gradientMap && detailed.bumpMap, 'keep material detail intact');
  ctx.darkNow = false;
  checkBudget();
  assert.ok(shadowedNeons.every((light) => !light.castShadow), 'daylight releases decorative shadow slots');
  ctx.lightingBlending = true;
  checkBudget();
}

// Exercise the production aiming function, not a duplicate of its direction formula.
{
  const windowGroup = new THREE.Group();
  windowGroup.rotation.y = Math.PI / 2;
  // The full-size window's glass: in the left wall, 8.35 up and 1.45 along from the back
  const windowGlass = new THREE.Vector3(-9.56, 8.35, 1.45);
  const windowRay = new THREE.Vector3();
  const light = new THREE.SpotLight();
  const aimContext = vm.createContext({ THREE, windowGroup, windowGlass, windowRay, windowLight: light,
    sun: new THREE.SpotLight(), skyAt: new THREE.Vector3(), GLASS: { x: 2.8, y: 2.425 }, WINDOW_SUN_FAR: 150, drawGlassCookie() {} });
  const start = source.indexOf('  function aimWindowLight(');
  vm.runInContext(source.slice(start, source.indexOf('  // The beam through the window:', start)), aimContext);
  const direction = (time) => {
    aimContext.from = windowSky(time).sun;
    vm.runInContext('aimWindowLight(from)', aimContext);
    assert.ok(light.position.x < windowGlass.x, `${time}: source stays outside the window`);
    return windowRay.clone().negate();
  };
  const morning = direction('morning');
  const midday = direction('day');
  const evening = direction('evening');
  const night = direction('night');
  // Real elevations: a low, slanting sunrise, a high noon, and a sunset as low as the sunrise
  const elevation = (ray) => Math.atan2(-ray.y, Math.hypot(ray.x, ray.z)) * 180 / Math.PI;
  assert.ok(elevation(morning) > 22 && elevation(morning) < 30, 'morning sun is low, as a sunrise is, yet high enough for tabletop shadows');
  assert.ok(elevation(midday) > 40 && elevation(midday) < 50, 'noon sun stands highest of the day, its patch reaching across the desk');
  assert.ok(elevation(evening) > 22 && elevation(evening) < 30, 'evening sun is low, yet high enough for its streak to fall on the desk');
  assert.ok(Math.abs(evening.z) < Math.abs(morning.z), 'the sunset beam turns only a little toward the front, keeping its streak on the desk');
  // The 180 × 84 cm desktop is centred on the origin; the high noon patch falls by the window
  const hitDesk = new THREE.Ray(windowGlass, midday).intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  assert.ok(hitDesk && hitDesk.x > -9 && hitDesk.x < 0 && Math.abs(hitDesk.z) < 4.2, 'noon central ray lands on the window half of the desktop');
  // The full-size monitor's lower edge: centred at X=-1, 19 cm above the desk, its face at Z≈-2.75
  const lowerMonitor = new THREE.Vector3(-1, 1.9, -2.75);
  const monitorShadow = new THREE.Ray(lowerMonitor, morning).intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  assert.ok(monitorShadow && Math.abs(monitorShadow.x) < 9 && Math.abs(monitorShadow.z) < 4.2,
    'morning shadow of the lower monitor reaches the desk instead of passing beyond its edge');
  assert.ok(morning.z < 0 && evening.z > 0, 'sunrise faces the monitor, sunset reaches toward the front');
  assert.ok(Math.abs(midday.y) > Math.abs(morning.y) && Math.abs(midday.y) > Math.abs(evening.y), 'noon gives shorter shadows');
  assert.ok(night.x > 0 && night.y < 0 && night.z > 0, 'moonlight follows the upper-right moon in the window');
  // The sky's light slides across the opening toward the sun: the room's front by morning, its
  // back by evening, so the room's soft shadows swing through the day
  const skyZ = (time) => { aimContext.from = windowSky(time).sun; vm.runInContext('aimWindowLight(from)', aimContext); return aimContext.sun.position.z; };
  const [skyMorning, skyNoon, skyEvening] = ['morning', 'day', 'evening'].map(skyZ);
  assert.ok(skyMorning > skyNoon + 1 && skyNoon > skyEvening + 1, 'sky light moves from the front of the window to the back over the day');
  assert.ok(Math.abs(skyMorning - windowGlass.z) < 2.8 * 2 && Math.abs(skyEvening - windowGlass.z) < 2.8 * 2, 'and stays within the glass');
}
// Rain must attenuate and recover correctly in every phase.
const hoopGlow = {};
for (const part of ['morning', 'day', 'evening', 'night']) {
  now += 10000;
  run(`daylightPart = '${part}'; setRoomTheme(${part === 'night'})`);
  update(now + 5000);
  hoopGlow[part] = [context.printGlow.level, context.net.material.color.r];
  const clear = windowLight.intensity;
  const clearRadius = windowLight.shadow.radius;
  const localLamp = lampLight.intensity;
  context.outside.rain = 1;
  update(now + 1);
  assert.ok(Math.abs(windowLight.intensity - clear * 0.12) < 1e-10, `${part}: rain dims direct light`);
  assert.ok(windowLight.shadow.radius > clearRadius, `${part}: rain softens exterior shadows`);
  assert.equal(lampLight.intensity, localLamp, `${part}: rain does not dim the indoor lamp`);
  context.outside.rain = 0;
  update(now + 1);
  assert.equal(windowLight.intensity, clear, `${part}: clear weather restores direct light`);
  assert.equal(windowLight.shadow.radius, clearRadius, `${part}: shadow softness recovers`);
}
// The backboard's glowing print settles into the room's light from dusk on
assert.deepEqual(hoopGlow.morning, hoopGlow.day);
assert.ok(hoopGlow.day[0] > hoopGlow.evening[0] && hoopGlow.evening[0] > hoopGlow.night[0], 'backboard glow dims towards night');
assert.ok(hoopGlow.day[1] > hoopGlow.evening[1] && hoopGlow.evening[1] > hoopGlow.night[1], 'net darkens towards night');

// Exercise the same per-frame contact update used by the moving mouse and lifted mug.
{
  const scene = new THREE.Scene();
  const windowLight = new THREE.DirectionalLight();
  scene.add(windowLight.target);
  // the sky's light, by the window to the left of everything; off until the end
  const skyLight = new THREE.SpotLight(0xffffff, 0);
  skyLight.position.set(-8.5, 8.8, 3);
  // the desk lamp, off, by the window too
  const lampLight = new THREE.PointLight(0xffffff, 0);
  lampLight.position.set(-7.2, 2.5, -2.8);
  scene.add(lampLight);
  const contact = vm.createContext({
    THREE, scene, windowLight, track: (o) => o, noRaycast: () => {}, sun: skyLight, SKY_REACH: 12, lampLight,
    // what the shelf and roaming shades read: the bookcase, the rug and desk they can rest on,
    // the chair's seat and the cat tree's bed
    SHELF_W: 3.05, SHELF_D: 1.5, shelf: new THREE.Group(), standOn: (level) => level * 2,
    rugTop: new THREE.Mesh(new THREE.BoxGeometry(16, 0.01, 17)), desk: new THREE.Mesh(new THREE.BoxGeometry(16, 0.35, 8.4)),
    chairTop: new THREE.Group(), SEAT_TOP: -2.2, tree: new THREE.Group(), PERCH: new THREE.Vector3(0, 6.6, 0),
    roomLight: { night: 0 }, outside: { rain: 0 }, blind: { lift: 1 }, FLOOR_Y: -7.4, WALL_Z: -4.43, SIDE_X: -9.6,
  });
  vm.runInContext(source.slice(source.indexOf('  const CONTACT_MAX ='), source.indexOf('  contactShadow(mug, ')) +
    ';globalThis.api = { contactShadow, wallShadow, roamingShadow, shelfShadow, supportUnder, updateContactShadows, contactShadows, contactDecals, contactAlpha };', contact);
  const { api } = contact;
  const prop = new THREE.Group();
  prop.position.set(5.6, 0, -0.6);
  prop.rotation.y = 0.2;
  scene.add(prop);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 0.1));
  frame.position.set(3, 9, -4.2);
  scene.add(frame);
  api.contactShadow(prop, 1.5, 1.5);
  api.contactShadow(new THREE.Group(), 1, 1);
  api.wallShadow(frame, 'back', 0.6);
  assert.equal(api.contactDecals.count, 2, 'one instance each, none for a prop outside the scene');
  const decal = (i) => {
    const m = new THREE.Matrix4();
    api.contactDecals.getMatrixAt(i, m);
    const at = new THREE.Vector3(), turn = new THREE.Quaternion(), size = new THREE.Vector3();
    m.decompose(at, turn, size);
    return { at, size, alpha: api.contactAlpha.getX(i) };
  };
  const setSun = (elevation, intensity) => {
    windowLight.intensity = intensity;
    windowLight.target.position.set(0, 0, 0);
    windowLight.position.set(-Math.cos(elevation), Math.sin(elevation), 0).multiplyScalar(20);
  };
  // No direct sun: centred under the prop
  setSun(Math.PI / 4, 0);
  api.updateContactShadows();
  const grounded = decal(0);
  assert.ok(Math.abs(grounded.at.x - prop.position.x) < 1e-6 && Math.abs(grounded.at.z - prop.position.z) < 1e-6);
  // Noon sun from the window side: darker, nudged away from the window, barely drawn out
  setSun(Math.PI / 4, 4.1);
  api.updateContactShadows();
  const noon = decal(0);
  assert.ok(noon.alpha > grounded.alpha, 'bright sun deepens the contact');
  assert.ok(noon.at.x > prop.position.x && noon.at.x - prop.position.x < 0.15 * 1.5 * 1.4, 'falls a little away from the light');
  // A low sun draws it out further, and keeps it lighter than at noon
  setSun(Math.PI * 25 / 180, 3.0);
  api.updateContactShadows();
  const low = decal(0);
  assert.ok(low.at.x > noon.at.x && low.alpha < noon.alpha);
  assert.ok(Math.max(low.size.x, low.size.y) > Math.max(noon.size.x, noon.size.y), 'a low sun stretches it');
  // The blind down takes the sun away again
  contact.blind.lift = 0;
  api.updateContactShadows();
  assert.ok(Math.abs(decal(0).at.x - prop.position.x) < 1e-6);
  contact.blind.lift = 1;
  // Lifted: wider and fainter; hidden: gone
  prop.position.y = 0.7;
  setSun(Math.PI / 4, 0);
  api.updateContactShadows();
  const lifted = decal(0);
  assert.ok(lifted.alpha > 0 && lifted.alpha < grounded.alpha && lifted.size.x > grounded.size.x);
  prop.visible = false;
  api.updateContactShadows();
  assert.equal(decal(0).size.x, 0);
  // The wall decal sits on the wall's face, just under the frame
  const wall = decal(1);
  assert.ok(Math.abs(wall.at.z - (-4.43 + 0.13)) < 1e-6 && wall.at.y < frame.position.y && Math.abs(wall.at.x - 3) < 1e-6);
  assert.ok(wall.size.x > 2 && wall.size.y > 1);
  // The sky through the window leans each footprint away from it, and firms it up
  prop.visible = true;
  prop.position.y = 0;
  api.updateContactShadows();
  const still = decal(0);
  skyLight.intensity = 0.65 * 12;
  api.updateContactShadows();
  const leaning = decal(0);
  assert.ok(leaning.at.x > still.at.x && leaning.at.x - still.at.x < 0.25 * 1.5 * 1.4, 'leans away from the window, by a fraction of its size');
  assert.ok(Math.max(leaning.size.x, leaning.size.y) > Math.max(still.size.x, still.size.y), 'drawn out the way it leans');
  assert.ok(leaning.alpha > still.alpha);
  assert.ok(decal(1).at.x > 3, 'the wall footprint slides along the wall, away from the window');
  // By night the lit desk lamp takes over as the key: the footprint leans away from it instead
  skyLight.intensity = 0;
  contact.roomLight.night = 1;
  lampLight.intensity = 8;
  prop.position.set(-5, 0, -2.8);
  api.updateContactShadows();
  const byLamp = decal(0);
  assert.ok(byLamp.at.x > prop.position.x, 'leans away from the lamp at night');
  assert.ok(grounded.alpha > 0.4, 'bold enough to read: darkest at the contact by day');
  // A roaming prop's shade lies on the highest surface below it: the desk's top over the desk,
  // the rug beside it, and fades as the prop rises
  contact.FLOOR_Y = -7.4;
  assert.ok(Math.abs(api.supportUnder(0, 3, 0) - 0.175) < 1e-6, 'over the desk: its top');
  assert.ok(Math.abs(api.supportUnder(0, 0.1, 0) - 0.005) < 1e-6, 'under the desk: the rug');
  assert.equal(api.supportUnder(20, 3, 20), -7.4, 'off both: the floor');
  // A shelf prop's shade is trimmed to the board: never past its front edge
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 1.2));
  box.position.set(0, 0.3, 0.5);
  contact.shelf.add(box);
  scene.add(contact.shelf);
  api.shelfShadow([box], 0, 1);
  api.updateContactShadows();
  const shelfDecal = decal(api.contactDecals.count - 1);
  assert.ok(shelfDecal.at.z + shelfDecal.size.y / 2 <= 0.75 + 1e-6, 'stays on the board');
}
console.log('Day/night light-source and shadow switching checks passed.');

// Shelf lighting stays aligned in one hue; animation is reserved for the cheat-code party.
{
  const THREE = require('three');
  const shelfLeds = Array.from({ length: 4 }, () => ({ ledMat: { color: new THREE.Color() }, glowMat: { color: new THREE.Color(), opacity: 0 } }));
  const shelfContext = vm.createContext({ shelfLeds, shelfLights: [{ color: new THREE.Color() }], ledColor: new THREE.Color(), ledPartyUntil: 0, roomLight: { night: 0 }, darkNow: false });
  const start = source.indexOf('  function updateShelfLeds(');
  vm.runInContext(source.slice(start, source.indexOf('  // A neon sign', start)), shelfContext);
  vm.runInContext('updateShelfLeds(0)', shelfContext);
  assert.ok(shelfLeds.every(({ glowMat }) => glowMat.opacity === 0), 'shelf glow off by day');
  shelfContext.darkNow = true;
  shelfContext.roomLight.night = 1;
  vm.runInContext('updateShelfLeds(100)', shelfContext);
  const hue = shelfLeds[0].ledMat.color.getHex();
  vm.runInContext('updateShelfLeds(50000)', shelfContext);
  assert.ok(shelfLeds.every(({ ledMat, glowMat }) => ledMat.color.getHex() === hue && glowMat.opacity === 0.5), 'all shelf bays keep a stable colour at night');
}

// Speakers use the existing furniture choices, including every wood/pattern combination.
for (const wood of Object.keys(context.WOODS)) {
  for (const pattern of context.PART_PATTERNS.speakers) {
    run(`setWood("speakers", { wood: "${wood}", pattern: "${pattern}" })`);
    assert.equal(speakerWoodPaints.at(-1).wood, wood);
    assert.equal(speakerWoodPaints.at(-1).pattern, pattern);
    const expected = new THREE.Color('#f3d3b0');
    const oak = new THREE.Color(context.WOODS.oak.tint);
    expected.setRGB(expected.r / oak.r, expected.g / oak.g, expected.b / oak.b).multiply(new THREE.Color(context.WOODS[wood].tint));
    assert.ok(context.speakerWoodMat.color.equals(expected), 'speaker tint keeps its model tone relative to oak');
  }
}
console.log('All speaker wood colours and grain patterns update through furniture settings.');

for (const finish of ['black', 'wood']) {
  run(`setWood("speakers", { finish: "${finish}" })`);
  const { color, shell, baffle } = context.SPEAKER_FINISHES[finish];
  if (color) assert.ok(context.speakerWoodMat.color.equals(new THREE.Color(color)), 'black model stains its side panels');
  assert.ok(context.speakerShellMat.color.equals(new THREE.Color(shell)), 'top and back follow the model');
  assert.ok(context.speakerBaffleMat.color.equals(new THREE.Color(baffle)), 'baffle follows the model');
}
