// The monitor's screen: a cartoon macOS desktop in the site's neo-brutal style. A menu bar, a
// dock that magnifies under the pointer and bounces an app as it launches, and windows (the
// terminal, Spotifree) that genie out of the dock and back into it. Drawn on a 2D canvas in a
// 640 × 384 layout; clickable areas come back as hotspots in the same units.
import { WALLPAPERS, createWallpapers } from "./wallpapers";
import { TRACKS } from "./lofi";
import { createStrike, drawStrike, strikeKey, STRIKE_BOOT } from "./strawHatStrike";
import { DISPLAY, BODY } from "./textures/base";
import { SCREEN_W, SCREEN_H, MENU_H, TITLE_H, ICON, ICON_GAP, DOCK_H, DOCK_Y, APPS, LAUNCHPAD_APPS, readDockOrder, dockLayout, clamp01, lerp, easeInOut, easeOut } from "./desktop/config";
import { surface, roundRect, grainOver, gloss } from "./desktop/canvas";
import { THEMES, sheetOf, coverImage, drawIcon } from "./desktop/appearance";
import { drawSpotifree } from "./desktop/spotifree";
import { createTypist, drawCode } from "./desktop/code";
import { KEY_DIRS, createSnake, drawSnake } from "./desktop/snake";

export { SCREEN_W, SCREEN_H } from "./desktop/config";

export function createDesktop({ terminal, player, actions }) {
  // Positions are the windows' homes; maximized they fill the space between bar and dock
  const windows = {
    terminal: { id: "terminal", title: "the@desk: ~", home: { x: 18, y: 32, w: 368, h: 212 }, bar: "#ff7a1a", ink: "#000", open: true },
    spotifree: { id: "spotifree", title: "Spotifree", home: { x: 376, y: 40, w: 250, h: 272 }, bar: "#000", ink: "#fff", open: false },
    code: { id: "code", title: "portfolio — VS Kode", home: { x: 44, y: 38, w: 420, h: 268 }, bar: "#13141c", ink: "#fff", open: false },
    wallpaper: { id: "wallpaper", title: "Wallpaper — toon prints", home: { x: 46, y: 38, w: 548, h: 192 }, bar: "#b7c8ff", ink: "#000", open: false },
    snake: { id: "snake", title: "Snake", home: { x: 404, y: 52, w: 212, h: 238 }, bar: "#8fd694", ink: "#000", open: false },
  };
  const wallpaper = createWallpapers();
  const wallpaperFrame = surface(SCREEN_W, SCREEN_H);
  const wallpaperFrom = surface(SCREEN_W, SCREEN_H);
  let wallpaperShown = null;
  let wallpaperFade = null;
  const typist = createTypist();
  const snake = createSnake((name) => actions.sound?.(name));
  const strike = createStrike((name) => actions.sound?.(name));
  // The console takes over the whole screen while it's on
  const tv = { on: false, t0: 0 };
  // Launchpad: a grid of every app over the dimmed desktop
  const pad = { open: false, t0: -9 };
  Object.values(windows).forEach((win) => Object.assign(win, { min: false, max: false, anim: null, surface: null }));
  let order = ["terminal"];
  // Windows left off the screen for now, where they are and as they are (the terminal, while
  // the loader's own window is on its way to it)
  const hiddenWindows = new Set();
  let hoverX = null;
  let bounce = null;
  let notice = null;
  let themeName = "light";
  const now = () => performance.now() / 1000;
  // The dock's icons can be dragged along it; each one's drawn x eases to its place
  const dockOrder = readDockOrder();
  const slots = {};
  let dockDrag = null;
  let windowDrag = null;
  let lastDraw = 0;

  const rectOf = (win) => (win.max ? { x: 10, y: MENU_H + 8, w: SCREEN_W - 20, h: DOCK_Y - MENU_H - 16 } : win.home);
  const front = () => {
    for (let i = order.length - 1; i >= 0; i--) {
      const win = windows[order[i]];
      if (win.open && !win.min) return win;
    }
    return null;
  };
  const raise = (id) => {
    order = order.filter((o) => o !== id).concat(id);
  };

  const dockIds = () => dockOrder;
  const dockSettling = () => {
    const layout = dockLayout(dockOrder);
    return dockOrder.some((id, i) => slots[id] !== undefined && Math.abs(slots[id] - layout.center(i)) > 0.3);
  };
  const iconX = (id) => {
    const ids = dockIds();
    return dockLayout(ids).center(Math.max(0, ids.indexOf(id)));
  };

  function launch(id) {
    const app = APPS[id];
    if (id === "launchpad") return Object.assign(pad, { open: !pad.open, t0: now() });
    if (app?.focus) return actions.focus(app.focus);
    const win = windows[id];
    raise(id);
    if (win.open && !win.min) return;
    if (!win.open) {
      bounce = { id, t0: now() };
      // A first launch bounces in the dock a moment before the window comes out
      win.anim = { kind: "open", t0: now() + 0.35, dur: 0.45 };
      win.open = true;
      actions.launched?.(id);
    } else {
      win.anim = { kind: "restore", t0: now(), dur: 0.45 };
      win.min = false;
    }
  }
  function close(id) {
    const win = windows[id];
    if (!win.open || win.anim) return;
    win.anim = { kind: "close", t0: now(), dur: 0.18 };
  }
  function minimize(id) {
    const win = windows[id];
    if (!win.open || win.min || win.anim) return;
    win.anim = { kind: "min", t0: now(), dur: 0.5 };
  }
  function toggleMax(id) {
    const win = windows[id];
    win.max = !win.max;
    win.anim = { kind: "zoom", t0: now(), dur: 0.25, from: { ...rectOf({ ...win, max: !win.max }) } };
    raise(id);
  }

  function drawWallpaperPicker(c, w, h, spots) {
    const theme = THEMES[themeName];
    const chosen = wallpaper.selection;
    c.fillStyle = theme.card;
    c.fillRect(0, 0, w, h);
    c.textBaseline = "middle";
    c.textAlign = "left";
    c.fillStyle = theme.ink;
    c.font = `700 11px ${BODY}`;
    c.fillText("Classic wallpapers, redrawn as toon prints.", 14, 18);
    c.font = `500 9px ${BODY}`;
    c.fillText("Light and dark follow the room automatically.", 14, 36);
    const gap = 10, left = 14, cw = (w - left * 2 - gap * (WALLPAPERS.length - 1)) / WALLPAPERS.length;
    const ph = Math.min(110, h - 104);
    WALLPAPERS.forEach((item, i) => {
      const x = left + i * (cw + gap), y = 52;
      const selected = item.id === chosen.id;
      c.save();
      roundRect(c, x, y, cw, ph, 5);
      c.clip();
      coverImage(c, sheetOf(item.id, themeName).canvas, x, y, cw, ph);
      c.restore();
      roundRect(c, x, y, cw, ph, 5);
      c.lineWidth = selected ? 3 : 1;
      c.strokeStyle = selected ? "#ffdd00" : theme.edge;
      c.stroke();
      c.fillStyle = theme.ink;
      c.font = `700 10px ${BODY}`;
      c.fillText(`${selected ? "✓ " : ""}${item.name}`, x, y + ph + 16);
      spots.push({ id: "wallpaperSelect", wallpaper: item.id, x, y, w: cw, h: ph + 25 });
    });
    c.fillStyle = theme.ink;
    c.font = `700 9px ${BODY}`;
    c.fillText("← → choose · Enter to preview", 14, h - 14);
    c.fillText("Show desktop ↗", w - 112, h - 14);
    spots.push({ id: "wallpaperPreview", x: w - 122, y: h - 28, w: 118, h: 26 });
  }

  // Each window paints into its own canvas, then lands on the screen: straight, or bent by
  // the genie (slices that pour toward the dock icon, the bottom ones first)
  function paintWindow(win, t, hotspots) {
    const r = rectOf(win);
    if (!win.surface || win.surface.w !== r.w || win.surface.h !== r.h) win.surface = surface(r.w, r.h);
    const { c } = win.surface;
    c.clearRect(0, 0, r.w, r.h);
    const local = [{ id: "window", x: 0, y: 0, w: r.w, h: r.h }];
    c.save();
    roundRect(c, 1, 1, r.w - 2, r.h - 2, 8);
    c.clip();
    // body
    c.save();
    c.translate(0, TITLE_H);
    if (win.id === "terminal") {
      c.fillStyle = "#1a1714";
      c.fillRect(0, 0, r.w, r.h - TITLE_H);
      const src = terminal.canvas;
      // The terminal's own title bar is cropped off; the window has one
      const crop = (49 / 384) * src.height;
      const bodyH = r.h - TITLE_H;
      const scale = Math.min(r.w / src.width, bodyH / (src.height - crop));
      c.drawImage(src, 0, crop, src.width, src.height - crop, 0, 0, src.width * scale, (src.height - crop) * scale);
      local.push({ id: "term", x: 0, y: TITLE_H, w: r.w, h: bodyH });
    } else {
      const inner = [];
      if (win.id === "spotifree") drawSpotifree(c, r.w, r.h - TITLE_H, player, inner);
      else if (win.id === "wallpaper") drawWallpaperPicker(c, r.w, r.h - TITLE_H, inner);
      else if (win.id === "snake") drawSnake(c, r.w, r.h - TITLE_H, snake, inner);
      else {
        drawCode(c, r.w, r.h - TITLE_H, typist, t);
        inner.push({ id: "code", x: 0, y: 0, w: r.w, h: r.h - TITLE_H });
      }
      inner.forEach((hs) => local.push({ ...hs, y: hs.y + TITLE_H }));
    }
    c.restore();
    // title bar
    c.fillStyle = win.bar;
    c.fillRect(0, 0, r.w, TITLE_H);
    c.beginPath();
    c.rect(0, 0, r.w, TITLE_H);
    gloss(c, 0, 0, r.w, TITLE_H, { top: 0.28, foot: 0.12 });
    grainOver(c, 0.9);
    c.fillStyle = "#000";
    c.fillRect(0, TITLE_H - 2, r.w, 2);
    ["#ff5f57", "#febc2e", "#28c840"].forEach((color, i) => {
      c.fillStyle = color;
      c.beginPath();
      c.arc(12 + i * 14, TITLE_H / 2 - 1, 4.5, 0, Math.PI * 2);
      c.fill();
      c.lineWidth = 1.2;
      c.strokeStyle = "#000";
      c.stroke();
    });
    local.push(
      { id: "close", win: win.id, x: 5, y: 2, w: 14, h: 16 },
      { id: "min", win: win.id, x: 19, y: 2, w: 14, h: 16 },
      { id: "max", win: win.id, x: 33, y: 2, w: 14, h: 16 },
    );
    c.fillStyle = win.ink;
    c.font = `700 10px ${BODY}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(win.title, r.w / 2, TITLE_H / 2);
    c.textAlign = "left";
    if (win.id === "terminal" && terminal.alert) {
      c.font = `800 8px ${BODY}`;
      const label = "● NEW MESSAGE";
      const lw = c.measureText(label).width + 10;
      c.fillStyle = terminal.alertOn ? "#000" : "#e11d48";
      c.fillRect(r.w - lw - 6, 4, lw, 12);
      c.fillStyle = terminal.alertOn ? "#ffdd00" : "#fff";
      c.fillText(label, r.w - lw - 1, TITLE_H / 2);
    }
    c.restore();
    roundRect(c, 1, 1, r.w - 2, r.h - 2, 8);
    c.lineWidth = 2;
    c.strokeStyle = "#000";
    c.stroke();

    // onto the screen
    const S = win.surface.canvas;
    const anim = win.anim;
    const p = anim ? clamp01((t - anim.t0) / anim.dur) : 1;
    const icon = { x: iconX(win.id), y: DOCK_Y + DOCK_H / 2 };
    if (anim && (anim.kind === "min" || anim.kind === "open" || anim.kind === "restore")) {
      if (t < anim.t0) return;
      // q: 0 the full window, 1 tucked into the icon
      const q = anim.kind === "min" ? p : 1 - p;
      const slices = 28;
      main.globalAlpha = 1 - clamp01((q - 0.85) / 0.15);
      // Where a point f (0 top, 1 bottom) of the window has got to: each slice spans from its
      // own top to the next one's, so the bent window stays in one piece
      const bend = (f) => easeInOut(clamp01(q * 1.6 - (1 - f) * 0.6));
      const yAt = (f) => lerp(r.y + f * r.h, icon.y, bend(f));
      for (let i = 0; i < slices; i++) {
        const f0 = i / slices;
        const f1 = (i + 1) / slices;
        const e = bend((f0 + f1) / 2);
        const width = lerp(r.w, ICON * 0.6, e);
        const cx = lerp(r.x + r.w / 2, icon.x, e);
        const y = yAt(f0);
        main.drawImage(S, 0, f0 * S.height, S.width, S.height / slices, cx - width / 2, y, width, Math.max(0.5, yAt(f1) - y) + 0.6);
      }
      main.globalAlpha = 1;
    } else if (anim && anim.kind === "close") {
      const s = lerp(1, 0.86, easeOut(p));
      main.globalAlpha = 1 - p;
      main.drawImage(S, r.x + (r.w * (1 - s)) / 2, r.y + (r.h * (1 - s)) / 2, r.w * s, r.h * s);
      main.globalAlpha = 1;
    } else {
      let d = r;
      if (anim?.kind === "zoom") {
        const k = easeOut(p);
        d = { x: lerp(anim.from.x, r.x, k), y: lerp(anim.from.y, r.y, k), w: lerp(anim.from.w, r.w, k), h: lerp(anim.from.h, r.h, k) };
      }
      // a hard offset shadow, like everything else on the site
      main.fillStyle = "rgba(0,0,0,.85)";
      roundRect(main, d.x + 5, d.y + 5, d.w, d.h, 8);
      main.fill();
      main.drawImage(S, d.x, d.y, d.w, d.h);
      if (!anim) local.forEach((hs) => hotspots.push({ ...hs, x: hs.x + r.x, y: hs.y + r.y, focusWin: win.id }));
    }
  }

  let main = null;
  function draw(c, { alert = false, alertOn = false } = {}) {
    main = c;
    terminal.alert = alert;
    terminal.alertOn = alertOn;
    const t = now();
    const hotspots = [];
    const theme = THEMES[themeName];
    wallpaper.clean();
    // A new sheet fades in over a snapshot of the last frame, so interrupted fades stay continuous
    const picture = sheetOf(wallpaper.selection.id, themeName);
    if (picture !== wallpaperShown) {
      if (wallpaperShown) {
        wallpaperFrom.c.drawImage(wallpaperFrame.canvas, 0, 0, SCREEN_W, SCREEN_H);
        wallpaperFade = { t0: t };
      }
      wallpaperShown = picture;
    }
    const blend = wallpaperFade ? easeInOut(clamp01((t - wallpaperFade.t0) / 1.6)) : 1;
    if (wallpaperFade) wallpaperFrame.c.drawImage(wallpaperFrom.canvas, 0, 0, SCREEN_W, SCREEN_H);
    wallpaperFrame.c.globalAlpha = blend;
    wallpaperFrame.c.drawImage(wallpaperShown.canvas, 0, 0, SCREEN_W, SCREEN_H);
    wallpaperFrame.c.globalAlpha = 1;
    c.drawImage(wallpaperFrame.canvas, 0, 0, SCREEN_W, SCREEN_H);
    if (blend === 1) wallpaperFade = null;
    // The editor types on while it's showing; the snake only moves while it's the front window
    if (windows.code.open && !windows.code.min) typist.step(t);
    if (front()?.id === "snake") snake.step(t);
    if (tv.on) {
      if (t - tv.t0 > STRIKE_BOOT) strike.step(t);
      drawStrike(c, SCREEN_W, SCREEN_H, strike, t, tv.t0, hotspots);
      return hotspots.reverse();
    }

    // windows, back to front; finished animations settle their state
    order.forEach((id) => {
      const win = windows[id];
      if (hiddenWindows.has(id)) return;
      if (win.anim && t >= win.anim.t0 + win.anim.dur) {
        if (win.anim.kind === "close") {
          win.open = false;
          win.max = false;
        }
        if (win.anim.kind === "min") win.min = true;
        win.anim = null;
      }
      if (!win.open || (win.min && !win.anim)) return;
      paintWindow(win, t, hotspots);
    });

    // menu bar
    c.fillStyle = theme.bar;
    c.fillRect(0, 0, SCREEN_W, MENU_H);
    c.beginPath();
    c.rect(0, 0, SCREEN_W, MENU_H);
    gloss(c, 0, 0, SCREEN_W, MENU_H, { top: 0.35, foot: 0.06 });
    grainOver(c, 0.8);
    c.fillStyle = theme.edge;
    c.fillRect(0, MENU_H - 2, SCREEN_W, 2);
    c.fillStyle = theme.ink;
    c.textBaseline = "middle";
    c.font = `800 11px ${DISPLAY}`;
    c.fillText("✦", 10, MENU_H / 2);
    c.font = `700 10px ${BODY}`;
    const active = front();
    const appName = active ? APPS[active.id].label : "Finder";
    c.fillText(appName, 28, MENU_H / 2);
    c.font = `500 10px ${BODY}`;
    let mx = 28 + c.measureText(appName).width + 14;
    ["File", "Edit", "View", "Window", "Help"].forEach((item) => {
      c.fillText(item, mx, MENU_H / 2);
      mx += c.measureText(item).width + 12;
    });
    const date = new Date();
    const clock = `${date.toLocaleDateString("en-US", { weekday: "short" })} ${date.toLocaleDateString("en-US", { day: "numeric", month: "short" })}  ${date.toTimeString().slice(0, 5)}`;
    c.textAlign = "right";
    c.fillText(clock, SCREEN_W - 10, MENU_H / 2);
    let rx = SCREEN_W - 10 - c.measureText(clock).width - 12;
    // battery and wi-fi
    c.lineWidth = 1.2;
    c.strokeStyle = theme.ink;
    c.strokeRect(rx - 18, 6, 16, 8);
    c.fillRect(rx - 16, 8, 10, 4);
    c.fillRect(rx - 2, 8.5, 1.5, 3);
    rx -= 28;
    [7, 4.5, 2].forEach((r) => {
      c.beginPath();
      c.arc(rx - 6, 14, r, Math.PI * 1.25, Math.PI * 1.75);
      c.stroke();
    });
    rx -= 18;
    // control centre: two little toggles, then the search glass
    c.lineWidth = 1.2;
    [[6.5, 0], [12.5, 1]].forEach(([ty, on]) => {
      roundRect(c, rx - 14, ty - 2.5, 12, 5, 2.5);
      c.stroke();
      c.beginPath();
      c.arc(on ? rx - 4.5 : rx - 11.5, ty, 1.6, 0, Math.PI * 2);
      c.fill();
    });
    rx -= 22;
    c.lineWidth = 1.4;
    c.beginPath();
    c.arc(rx - 7, 9, 3.6, 0, Math.PI * 2);
    c.moveTo(rx - 4.4, 11.6);
    c.lineTo(rx - 1.5, 14.5);
    c.stroke();
    rx -= 18;
    if (player.playing) {
      const label = `♫ ${TRACKS[player.index].title}`;
      c.font = `700 10px ${BODY}`;
      c.fillText(label, rx, MENU_H / 2);
      hotspots.push({ id: "dock", app: "spotifree", x: rx - c.measureText(label).width, y: 0, w: c.measureText(label).width, h: MENU_H });
    }
    c.textAlign = "left";

    // dock: a printed shelf with a hard shadow, gloss, grain and a lip along the bottom
    const ids = dockIds();
    const dock = dockLayout(ids);
    const dt = Math.min(0.05, lastDraw ? t - lastDraw : 0);
    lastDraw = t;
    roundRect(c, dock.x + 4, DOCK_Y + 4, dock.w, DOCK_H, 12);
    c.fillStyle = "rgba(0,0,0,.85)";
    c.fill();
    roundRect(c, dock.x, DOCK_Y, dock.w, DOCK_H, 12);
    c.fillStyle = theme.dock;
    c.fill();
    gloss(c, dock.x, DOCK_Y, dock.w, DOCK_H, { top: 0.4, foot: 0.1 });
    grainOver(c, 1);
    c.save();
    c.clip();
    c.fillStyle = theme.shelf;
    c.fillRect(dock.x, DOCK_Y + DOCK_H - 9, dock.w, 9);
    c.fillStyle = "rgba(255,255,255,.55)";
    c.fillRect(dock.x + 12, DOCK_Y + 2.5, dock.w - 24, 1.2);
    c.restore();
    c.lineWidth = 1.2;
    c.strokeStyle = theme.edge;
    c.beginPath();
    c.moveTo(dock.x + 3, DOCK_Y + DOCK_H - 9);
    c.lineTo(dock.x + dock.w - 3, DOCK_Y + DOCK_H - 9);
    c.stroke();
    roundRect(c, dock.x, DOCK_Y, dock.w, DOCK_H, 12);
    c.lineWidth = 2;
    c.stroke();
    let tip = null;
    const dragging = dockDrag?.moved ? dockDrag.id : null;
    ids.forEach((id, i) => {
      const app = APPS[id];
      const home = dock.center(i);
      slots[id] = slots[id] === undefined || id === dragging ? home : lerp(slots[id], home, 1 - Math.exp(-dt * 16));
      if (id === dragging) slots[id] = dockDrag.x;
      const cx = slots[id];
      hotspots.push({ id: "dock", app: app.id, x: home - ICON / 2 - ICON_GAP / 2, y: DOCK_Y, w: ICON + ICON_GAP, h: DOCK_H });
      const win = windows[app.id];
      if (win?.open || (app.id === "launchpad" && pad.open)) {
        c.fillStyle = theme.ink;
        c.beginPath();
        c.arc(home, DOCK_Y + DOCK_H - 3.5, 1.8, 0, Math.PI * 2);
        c.fill();
      }
      // The one being dragged is drawn last, over the others
      if (id === dragging) return;
      const near = hoverX === null || dragging ? 0 : clamp01(1 - Math.abs(cx - hoverX) / 54);
      const s = ICON * (1 + 0.45 * easeInOut(near));
      let lift = 0;
      if (bounce?.id === app.id) {
        const bt = t - bounce.t0;
        if (bt > 1.1) bounce = null;
        else lift = Math.abs(Math.sin(bt * Math.PI * 2.7)) * 12 * (1 - bt / 1.1);
      }
      const y = DOCK_Y + DOCK_H - 7 - s - lift;
      drawIcon(c, app.id, cx - s / 2, y, s);
      if (app.id === "terminal" && alert) {
        c.fillStyle = "#e11d48";
        c.beginPath();
        c.arc(cx + s / 2 - 3, y + 3, 6, 0, Math.PI * 2);
        c.fill();
        c.lineWidth = 1.5;
        c.strokeStyle = "#000";
        c.stroke();
        c.fillStyle = "#fff";
        c.font = `800 8px ${BODY}`;
        c.textAlign = "center";
        c.fillText("1", cx + s / 2 - 3, y + 3.5);
        c.textAlign = "left";
      }
      if (near > 0.7) tip = { label: app.label, x: cx, y: y - 6 };
    });
    if (dragging) {
      // Picked up: bigger, lifted with the pointer, wobbling a little, its slot left open
      const s = ICON * 1.2;
      const cx = Math.min(dock.x + dock.w - s / 2, Math.max(dock.x + s / 2, dockDrag.x));
      const cy = Math.min(DOCK_Y + DOCK_H / 2 - 6, Math.max(DOCK_Y - 26, dockDrag.y));
      const home = dock.center(ids.indexOf(dragging));
      c.setLineDash([3, 3]);
      c.lineWidth = 1.5;
      c.strokeStyle = theme.ink;
      roundRect(c, home - ICON / 2, DOCK_Y + DOCK_H - 7 - ICON, ICON, ICON, 8);
      c.stroke();
      c.setLineDash([]);
      c.save();
      c.translate(cx, cy);
      c.rotate(Math.sin(t * 14) * 0.07);
      roundRect(c, -s / 2 + 5, -s / 2 + 7, s, s, 9);
      c.fillStyle = "rgba(0,0,0,.35)";
      c.fill();
      drawIcon(c, dragging, -s / 2, -s / 2, s);
      c.restore();
      tip = { label: APPS[dragging].label, x: cx, y: cy - s / 2 - 4 };
    }
    if (tip) {
      c.font = `700 9px ${BODY}`;
      const tw = c.measureText(tip.label).width + 12;
      roundRect(c, tip.x - tw / 2, tip.y - 16, tw, 14, 4);
      c.fillStyle = theme.tip;
      c.fill();
      c.fillStyle = theme.tipInk;
      c.textAlign = "center";
      c.fillText(tip.label, tip.x, tip.y - 8.5);
      c.textAlign = "left";
    }

    // Launchpad over everything but the notifications: the desktop dims, the icons zoom in
    const pt = t - pad.t0;
    const shown = pad.open ? clamp01(pt / 0.25) : 1 - clamp01(pt / 0.2);
    if (shown > 0) {
      c.fillStyle = `rgba(20,18,30,${0.6 * shown})`;
      c.fillRect(0, 0, SCREEN_W, SCREEN_H);
      c.save();
      c.globalAlpha = shown;
      const k = lerp(1.15, 1, easeOut(shown));
      c.translate(SCREEN_W / 2, SCREEN_H / 2);
      c.scale(k, k);
      c.translate(-SCREEN_W / 2, -SCREEN_H / 2);
      if (pad.open) hotspots.push({ id: "padClose", x: 0, y: 0, w: SCREEN_W, h: SCREEN_H });
      LAUNCHPAD_APPS.forEach((id, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const size = 52;
        const x = SCREEN_W / 2 - 2 * 96 + col * 96 + (96 - size) / 2;
        const y = 90 + row * 104;
        drawIcon(c, id, x, y, size);
        c.fillStyle = "#fff";
        c.font = `700 10px ${BODY}`;
        c.textAlign = "center";
        c.textBaseline = "top";
        c.fillText(APPS[id].label, x + size / 2, y + size + 8);
        c.textAlign = "left";
        if (pad.open) hotspots.push({ id: "pad", app: id, x: x - 12, y: y - 6, w: size + 24, h: size + 30 });
      });
      c.restore();
    }

    // notification banner, sliding in from the right under the menu bar
    if (notice) {
      const nt = t - notice.t0;
      if (nt > 3.6) notice = null;
      else {
        const slide = nt < 0.35 ? easeOut(nt / 0.35) : nt > 3.2 ? 1 - easeInOut((nt - 3.2) / 0.4) : 1;
        const nw = 200;
        const nx = lerp(SCREEN_W + 8, SCREEN_W - nw - 10, slide);
        const ny = MENU_H + 8;
        c.fillStyle = "#000";
        roundRect(c, nx + 4, ny + 4, nw, 42, 8);
        c.fill();
        roundRect(c, nx, ny, nw, 42, 8);
        c.fillStyle = theme.card;
        c.fill();
        gloss(c, nx, ny, nw, 42, { top: 0.25, foot: 0.06 });
        grainOver(c, 0.9);
        c.lineWidth = 2;
        c.strokeStyle = "#000";
        c.stroke();
        drawIcon(c, notice.app, nx + 8, ny + 8, 26);
        c.fillStyle = theme.ink;
        c.textBaseline = "top";
        c.font = `700 9px ${BODY}`;
        c.fillText(notice.title, nx + 42, ny + 9);
        c.font = `500 9px ${BODY}`;
        c.fillText(notice.body, nx + 42, ny + 23);
      }
    }
    // Topmost first, for the hit test
    return hotspots.reverse();
  }

  function click(hs) {
    if (hs.id === "consoleExit") return Object.assign(tv, { on: false });
    if (hs.id === "strikeStart") return now() - tv.t0 > STRIKE_BOOT && strike.start();
    if (hs.id === "strikeBomb") return strike.bomb();
    if (hs.id === "strikePause") return strike.pause();
    if (hs.id === "padClose") return Object.assign(pad, { open: false, t0: now() });
    if (hs.id === "pad") {
      Object.assign(pad, { open: false, t0: now() });
      return launch(hs.app);
    }
    if (hs.id === "dock") {
      if (pad.open && hs.app !== "launchpad") Object.assign(pad, { open: false, t0: now() });
      return launch(hs.app);
    }
    if (hs.focusWin) raise(hs.focusWin);
    if (hs.id === "wallpaperSelect") return wallpaper.select(hs.wallpaper);
    if (hs.id === "wallpaperPreview") {
      Object.values(windows).forEach((win) => { if (win.open) { win.min = true; win.anim = null; } });
      return;
    }
    if (hs.id === "close") return close(hs.win);
    if (hs.id === "min") return minimize(hs.win);
    if (hs.id === "max") return toggleMax(hs.win);
    if (hs.id === "play") return actions.toggle();
    if (hs.id === "next") return actions.next();
    if (hs.id === "prev") return actions.prev();
    if (hs.id === "track") return actions.playTrack(hs.index);
    if (hs.id === "term") return actions.terminalClick();
    // A click in the editor makes it type faster for a few seconds
    if (hs.id === "code") typist.fastUntil = now() + 4;
    if (hs.id === "snakeDir") return snake.steer(hs.dir);
    if (hs.id === "snakeStart" && snake.state !== "play") return snake.reset();
  }

  return {
    draw,
    click,
    launch,
    // where a window sits on the screen, in its layout units
    windowRect: (id) => rectOf(windows[id]),
    setHidden: (id, hidden) => (hidden ? hiddenWindows.add(id) : hiddenWindows.delete(id)),
    // The console on the shelf switched on: boot, then Straw Hat Strike full screen
    playConsole() {
      Object.assign(tv, { on: true, t0: now() });
      strike.state = "ready";
      strike.keys.clear();
    },
    exitConsole() {
      if (!tv.on) return false;
      tv.on = false;
      return true;
    },
    // Window title bars and dock icons share the scene's captured screen pointer.
    press(x, y) {
      if (tv.on || pad.open) return false;
      if (y >= DOCK_Y && y <= DOCK_Y + DOCK_H) {
        const layout = dockLayout(dockOrder);
        const i = Math.floor((x - layout.x - ICON_GAP / 2) / (ICON + ICON_GAP));
        if (i < 0 || i >= dockOrder.length) return false;
        dockDrag = { id: dockOrder[i], x0: x, y0: y, x, y, moved: false };
        return true;
      }
      for (const id of [...order].reverse()) {
        const win = windows[id];
        if (!win.open || win.min || win.anim) continue;
        const r = rectOf(win);
        if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) continue;
        if (y > r.y + TITLE_H || x < r.x + 52) return false;
        raise(id);
        windowDrag = { id, x0: x, y0: y, dx: x - r.x, dy: y - r.y, width: r.w, moved: false };
        return true;
      }
      return false;
    },
    // The pointer moved while pressed; true once it's really a drag (and needs a redraw)
    dragTo(x, y) {
      if (windowDrag) {
        const drag = windowDrag;
        if (!drag.moved && Math.hypot(x - drag.x0, y - drag.y0) < 5) return false;
        const win = windows[drag.id];
        if (win.max) {
          drag.dx *= win.home.w / drag.width;
          win.max = false;
        }
        drag.moved = true;
        win.home.x = Math.min(SCREEN_W - win.home.w, Math.max(0, x - drag.dx));
        win.home.y = Math.min(DOCK_Y - TITLE_H - 4, Math.max(MENU_H + 4, y - drag.dy));
        return true;
      }
      if (!dockDrag) return false;
      if (!dockDrag.moved && Math.hypot(x - dockDrag.x0, y - dockDrag.y0) < 5) return false;
      if (!dockDrag.moved) actions.sound?.("tick");
      Object.assign(dockDrag, { moved: true, x, y });
      hoverX = null;
      const layout = dockLayout(dockOrder);
      const to = Math.min(dockOrder.length - 1, Math.max(0, Math.round((x - layout.center(0)) / (ICON + ICON_GAP))));
      const from = dockOrder.indexOf(dockDrag.id);
      if (to !== from) {
        dockOrder.splice(from, 1);
        dockOrder.splice(to, 0, dockDrag.id);
        actions.sound?.("tick");
      }
      return true;
    },
    // Let go: true when an icon was dragged (so it isn't also a click), and the order is kept
    release() {
      if (windowDrag) {
        const moved = windowDrag.moved;
        windowDrag = null;
        return moved;
      }
      const drag = dockDrag;
      dockDrag = null;
      if (!drag?.moved) return false;
      try {
        localStorage.setItem("dock-order", JSON.stringify(dockOrder));
      } catch {
        // The order just isn't kept between visits
      }
      actions.sound?.("pop");
      return true;
    },
    // Something is moving on the screen: keep redrawing every frame
    busy: () => {
      const t = now();
      return !!(
        wallpaper.dirty ||
        wallpaperFade ||
        windowDrag?.moved ||
        tv.on ||
        dockDrag?.moved ||
        dockSettling() ||
        bounce ||
        notice ||
        t - pad.t0 < 0.3 ||
        (windows.code.open && !windows.code.min) ||
        (front()?.id === "snake" && snake.state === "play") ||
        Object.values(windows).some((w) => w.anim && t < w.anim.t0 + w.anim.dur + 0.05)
      );
    },
    // A key while zoomed in on the screen; true when the desktop used it (Snake's arrows/WASD)
    key(e) {
      if (tv.on) {
        if (now() - tv.t0 < STRIKE_BOOT) return true;
        if (e.key === "Backspace" || e.key === "q" || e.key === "Q") tv.on = false;
        else strikeKey(strike, e, true);
        // Everything else is swallowed: no typing into the terminal behind the game
        return true;
      }
      if (front()?.id === "wallpaper") {
        const current = wallpaper.selection;
        const index = WALLPAPERS.findIndex((item) => item.id === current.id);
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          const step = e.key === "ArrowLeft" ? -1 : 1;
          wallpaper.select(WALLPAPERS[(index + step + WALLPAPERS.length) % WALLPAPERS.length].id);
        }
        if (e.key === "Enter") click({ id: "wallpaperPreview" });
        return true;
      }
      if (front()?.id !== "snake") return false;
      const dir = KEY_DIRS[e.key];
      if (dir) {
        snake.steer(dir);
        return true;
      }
      if ((e.key === " " || e.key === "Enter") && snake.state !== "play") {
        snake.reset();
        return true;
      }
      return false;
    },
    // The window lost focus: no key stays held down
    releaseKeys() {
      strike.keys.clear();
    },
    // A key let go: the ship stops sailing that way
    keyUp(e) {
      if (tv.on) strikeKey(strike, e, false);
    },
    // A finger dragged over the console's picture (layout units moved)
    drag(dx, dy) {
      if (tv.on) strike.nudge(dx, dy);
    },
    // The pointer over the screen (layout units), or null: the dock magnifies under it
    hover(x, y) {
      if (tv.on && x !== null) strike.aimAt(x, y);
      const next = tv.on || x === null || y < DOCK_Y - 24 ? null : x;
      if (next === hoverX) return false;
      hoverX = next;
      return true;
    },
    setTheme(dark) {
      themeName = dark ? "dark" : "light";
    },
    notify(app, title, body) {
      notice = { app, title, body, t0: now() };
    },
    active: () => (tv.on ? "console" : front()?.id || null),
    isOpen: (id) => windows[id].open && !windows[id].min,
  };
}
