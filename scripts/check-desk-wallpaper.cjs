const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const root = `${__dirname}/../`;
const strip = (path) => fs.readFileSync(root + path, 'utf8').replace(/^import .*;\n/gm, '').replace(/export /g, '');
const saved = new Map([['dock-order', JSON.stringify(['messages', 'mail', 'notes', 'snake', 'code', 'spotifree', 'terminal', 'files', 'launchpad'])]]);
let time = 0;
const imageDraws = [];
let nextContext = 0;
// Each mock canvas keeps one context, and each context knows its canvas
const context2d = (canvas) => new Proxy({
  canvas,
  contextId: nextContext++,
  drawImage(image) { imageDraws.push({ image, contextId: this.contextId, alpha: this.globalAlpha ?? 1 }); },
  measureText: (text) => ({ width: text.length * 5 }),
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} }),
}, { get: (target, key) => target[key] ?? (() => {}) });
const makeCanvas = () => {
  const canvas = { width: 0, height: 0 };
  let ctx;
  canvas.getContext = () => (ctx ??= context2d(canvas));
  return canvas;
};
const c = makeCanvas().getContext();
const context = vm.createContext({
  console, Date, Math, Set, Map, WeakMap,
  localStorage: { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) },
  document: { createElement: makeCanvas },
  performance: { now: () => time }, TRACKS: [], DISPLAY: 'display', BODY: 'body',
  createStrike: () => ({ keys: new Set() }), drawStrike() {}, strikeKey() {}, STRIKE_BOOT: 1,
});
vm.runInContext(strip('src/features/desk3d/wallpapers.js') + require('./helpers/desktop-source.cjs').readDesktopSource() + `
  globalThis.desktop = createDesktop({ terminal: { canvas: { width: 1280, height: 768 } }, player: {}, actions: {} });
`, context);
const desktop = context.desktop;
let spots = desktop.draw(c);
assert.equal(spots.filter((s) => s.id === 'dock').length, 10);
assert.equal(spots.filter((s) => s.id === 'dock')[0].app, 'wallpaper', 'new app appended after saved order');
// The screen's first picture each frame is the wallpaper frame; its context receives the sheets
const frameContext = () => {
  const mark = imageDraws.length;
  desktop.draw(c);
  return imageDraws.slice(mark).find((draw) => draw.contextId === c.contextId).image.getContext().contextId;
};
const frameId = frameContext();
const lastPicture = () => imageDraws.filter((draw) => draw.contextId === frameId).at(-1);
desktop.launch('wallpaper');
time = 2000;
spots = desktop.draw(c);
assert.equal(spots.filter((s) => s.id === 'wallpaperSelect').length, 6, 'six toon wallpapers');
for (const spot of spots) assert.ok(spot.x >= 0 && spot.y >= 0 && spot.x + spot.w <= 640 && spot.y + spot.h <= 384);
desktop.click(spots.find((s) => s.id === 'wallpaperSelect' && s.wallpaper === 'dusk'));
assert.deepEqual(JSON.parse(saved.get('desk-wallpaper')), { id: 'dusk' });
desktop.setTheme(true);
desktop.draw(c);
time += 1600;
desktop.draw(c);
assert.equal(desktop.busy(), false, 'a static wallpaper does not redraw continuously');
const darkSheet = lastPicture().image;
// A new appearance blends over the last visible frame for 1.6 seconds
desktop.setTheme(false);
desktop.draw(c);
assert.equal(desktop.busy(), true, 'crossfade keeps screen redraws active');
assert.equal(lastPicture().alpha, 0, 'incoming sheet starts transparent');
const lightSheet = lastPicture().image;
assert.notEqual(lightSheet, darkSheet, 'light and dark are separate sheets');
time += 800;
desktop.draw(c);
assert.ok(Math.abs(lastPicture().alpha - 0.5) < 1e-6, 'halfway through the fade both appearances mix');
desktop.setTheme(true);
desktop.draw(c);
assert.equal(lastPicture().alpha, 0, 'a reversal begins from a snapshot of the current mix');
assert.equal(lastPicture().image, darkSheet, 'sheets are painted once and reused');
time += 1600;
desktop.draw(c);
assert.equal(lastPicture().alpha, 1);
assert.equal(desktop.busy(), false, 'completed crossfade returns to idle');
assert.equal(desktop.key({ key: 'ArrowRight' }), true);
assert.equal(JSON.parse(saved.get('desk-wallpaper')).id, 'space-black');
assert.equal(desktop.busy(), true, 'a new choice asks for a redraw');
desktop.draw(c);
assert.notEqual(lastPicture().image, darkSheet, 'the chosen wallpaper fades in');
time += 1600;
desktop.draw(c);

// Drag the wallpaper window by its title bar, keeping controls and content clickable.
spots = desktop.draw(c);
const before = spots.find((spot) => spot.id === 'wallpaperSelect');
assert.equal(desktop.press(52, 48), false, 'traffic lights are excluded from dragging');
assert.equal(desktop.press(120, 48), true);
assert.equal(desktop.dragTo(122, 49), false, 'a plain click is not a drag');
assert.equal(desktop.release(), false);
assert.equal(desktop.press(120, 48), true);
assert.equal(desktop.dragTo(150, 88), true);
assert.equal(desktop.release(), true, 'a drag must not also trigger a click');
spots = desktop.draw(c);
const moved = spots.find((spot) => spot.id === 'wallpaperSelect');
assert.equal(moved.x, before.x + 30);
assert.equal(moved.y, before.y + 40);
assert.equal(desktop.press(moved.x + 8, moved.y + 8), false, 'content does not start a title drag');
assert.equal(desktop.press(190, 88), true);
desktop.dragTo(2000, -2000);
desktop.release();
spots = desktop.draw(c);
const title = spots.find((spot) => spot.id === 'window' && spot.focusWin === 'wallpaper');
assert.equal(title.x, 640 - 548);
assert.equal(title.y, 24, 'title bar cannot leave the top of the desktop');
desktop.click(spots.find((spot) => spot.id === 'max' && spot.win === 'wallpaper'));
time += 300;
desktop.draw(c);
assert.equal(desktop.press(300, 38), true);
desktop.dragTo(330, 60);
assert.equal(desktop.release(), true);
spots = desktop.draw(c);
assert.equal(spots.find((spot) => spot.id === 'window' && spot.focusWin === 'wallpaper').w, 548,
  'dragging a maximized window restores its normal size');
desktop.key({ key: 'Enter' });
assert.equal(desktop.active(), null, 'preview minimizes all windows');
saved.set('desk-wallpaper', '{broken');
vm.runInContext('globalThis.invalid = createWallpapers()', context);
assert.equal(context.invalid.selection.id, 'big-sur', 'a broken save falls back to Big Sur');
context.invalid.select('unknown');
assert.equal(context.invalid.selection.id, 'big-sur');
// Every wallpaper paints in both appearances without throwing
for (const { id } of context.WALLPAPERS ?? vm.runInContext('WALLPAPERS', context)) {
  for (const mode of ['light', 'dark']) vm.runInContext(`paintScenery(document.createElement('canvas').getContext('2d'), ${JSON.stringify(id)}, ${JSON.stringify(mode)}, { halftone, grainOver, seeded })`, context);
}
console.log('Wallpaper picker, painted sheets, crossfade/reversal, window dragging/bounds/restore and persistence passed.');
