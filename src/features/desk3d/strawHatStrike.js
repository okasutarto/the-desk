// ---------- the console: Straw Hat Strike ----------
// Switched on from the PlayStation on the shelf, the monitor turns into a TV: a boot screen,
// then a side-scrolling shoot-'em-up. The Going Merry against the Marines: Gomu Gomu no
// Pistol for a gun, meat for power, a Gatling to clear the sky, and a Sea King at the end of
// every stage. Drawn in the desktop's 640 × 384 layout, in the room's toon style: flat fills,
// thick ink outlines and hard offset shadows.
import { DISPLAY, BODY } from "./textures/base";

const W = 640;
const H = 384;
const INK = "#1a1714";
const CREAM = "#fffdf5";
const YELLOW = "#ffdd00";
const RED = "#e5484d";
const BLUE = "#3b6fd6";
export const STRIKE_BOOT = 2.2;
// The sea starts at the horizon; the ship sails anywhere below it
const HORIZON = 96;
const TOP = HORIZON + 34;
const BOTTOM = H - 16;
const LEFT = 34;
const RIGHT = W - 60;
// How long a stage sails before its Sea King surfaces
const STAGE_LEN = 42;
const MOVE_KEYS = {
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right",
  ArrowUp: "up", w: "up", W: "up",
  ArrowDown: "down", s: "down", S: "down",
};
// Day, sunset, night: the stages go round them
const SKIES = [
  { sky: ["#7cc8ff", "#ffe6b8"], sea: ["#3a9be8", "#1d5fb4"], sun: "#fff3c4", ray: "rgba(255,243,196,.35)", wave: "rgba(255,255,255,.75)", isle: "#3f9a6b", cloud: CREAM },
  { sky: ["#ff8a6b", "#ffd59a"], sea: ["#4a78c8", "#2a3f80"], sun: "#ffe08a", ray: "rgba(255,224,138,.35)", wave: "rgba(255,226,196,.7)", isle: "#7a4a6b", cloud: "#ffd2c0" },
  { sky: ["#18163a", "#463c7c"], sea: ["#1f3470", "#0d1636"], sun: "#f4f1ff", ray: "rgba(0,0,0,0)", wave: "rgba(190,200,255,.5)", isle: "#2b2550", cloud: "#5a5290", night: true },
];

// A touch screen has no Space bar to point at
const TOUCH = typeof matchMedia === "function" && matchMedia("(hover: none)").matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clamp01 = (v) => clamp(v, 0, 1);
const easeOut = (t) => 1 - (1 - t) ** 3;
const backOut = (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;
const rand = (a, b) => a + Math.random() * (b - a);
const berries = (n) => `฿ ${Math.floor(n).toLocaleString("en-US")}`;
// The name last put on a bounty, offered again next time
const NAME_KEY = "strike-name";
export const NAME_MAX = 12;
const readName = () => {
  try {
    return (localStorage.getItem(NAME_KEY) || "").slice(0, NAME_MAX);
  } catch {
    return "";
  }
};
// The bounty board holds the top ten; a run that would beat the tenth can post its name
export const BOARD_SIZE = 10;
export const qualifies = (board, score) => score > 0 && (board.length < BOARD_SIZE || score > board[BOARD_SIZE - 1].score);
const readBest = () => {
  try {
    return Number(localStorage.getItem("strike-best")) || 0;
  } catch {
    return 0;
  }
};

// Everything a run keeps; a fresh copy on every new game
const fresh = () => ({
  score: 0, stage: 1, stageT: 0, nextWave: 1.2, waveN: 0,
  lives: 3, bombs: 2, power: 1, inv: 0,
  ship: { x: 120, y: 250, tilt: 0 }, fireAt: 0, volley: 0,
  shots: [], enemies: [], bullets: [], pickups: [], fx: [], pops: [], later: [],
  boss: null, bossCalled: false, warn: 0, clear: 0, gatling: 0, gatlingAt: 0,
  shake: 0, flash: 0, chain: 0, chainUntil: 0, overAt: 0, newBest: false, paused: false,
});

// `hooks` connect the game to the bounty board, all optional: onStart() as a run begins,
// onEntry() once a poster that made the board asks for a name, focusName() when its name box
// is tapped, post() to send it, and caret() whether the name's caret shows
export function createStrike(sound, hooks = {}) {
  const g = {
    state: "ready", t: 0, last: 0, scroll: 0, best: readBest(), keys: new Set(), aim: null, padWas: {}, ...fresh(),
    // the bounty board as last heard: "loading", "ready" or "offline"
    board: [], boardState: "loading",
    // a name being put to a bounty that made the board: { name, state, reason, rank, improved }
    // with state "typing", "sending", "posted", "refused" or "offline"
    entry: null, name: readName(), hooks,
  };

  g.reset = () => {
    Object.assign(g, fresh(), { state: "play", inv: 1.5, aim: null, entry: null });
    g.keys.clear();
    sound("power");
    hooks.onStart?.();
  };
  // Waiting on a name: a tap or a key goes to the name box instead of starting over
  const naming = () => g.entry && (g.entry.state === "typing" || g.entry.state === "refused" || g.entry.state === "sending");
  g.start = () => {
    // Over: a moment for the poster to land before a stray key restarts
    if (g.state === "over" && g.t - g.overAt < 0.8) return;
    if (g.state === "over" && naming()) return void (g.entry.state !== "sending" && hooks.focusName?.());
    if (g.state !== "play") g.reset();
  };
  // Leave the board be and sail again
  g.skipEntry = () => {
    if (!g.entry || g.entry.state === "sending") return;
    g.entry = null;
    hooks.stopName?.();
  };
  // The name's been sent: what the board said
  g.posted = (result) => {
    if (!g.entry) return;
    if (result.ok) {
      Object.assign(g.entry, { state: "posted", rank: result.rank, improved: result.improved });
      g.board = result.top || g.board;
      g.name = g.entry.name.trim();
      try {
        localStorage.setItem(NAME_KEY, g.name);
      } catch {
        // the name is just asked for again next time
      }
    } else {
      const fixable = ["empty", "long", "characters", "words"].includes(result.reason);
      Object.assign(g.entry, { state: fixable ? "refused" : "offline", reason: result.reason });
    }
  };
  g.pause = () => {
    if (g.state === "play") g.paused = !g.paused;
  };
  g.hold = (dir, on) => {
    if (on) g.keys.add(dir);
    else g.keys.delete(dir);
    if (on) g.aim = null;
  };
  // The mouse over the screen: the ship sails after it
  g.aimAt = (x, y) => {
    if (g.state === "play") g.aim = { x, y };
  };
  // A finger dragged across the screen: the ship moves with it, from wherever it is
  g.nudge = (dx, dy) => {
    if (g.state !== "play" || g.paused) return;
    g.aim = null;
    g.ship.x = clamp(g.ship.x + dx * 1.3, LEFT, RIGHT);
    g.ship.y = clamp(g.ship.y + dy * 1.3, TOP, BOTTOM);
  };

  // ---------- effects ----------
  const fx = (p) => {
    if (g.fx.length > 260) g.fx.shift();
    g.fx.push({ life: 0, ...p });
  };
  const pop = (x, y, text, { size = 11, color = YELLOW, max = 0.9 } = {}) =>
    g.pops.push({ x, y, text, size, color, life: 0, max, rot: rand(-0.12, 0.12) });
  const explode = (x, y, big = 1, word = null) => {
    fx({ kind: "burst", x, y, r: 16 * big, max: 0.32, word });
    fx({ kind: "ring", x, y, r: 10 * big, max: 0.4 });
    for (let i = 0; i < 5 * big; i++) fx({ kind: "smoke", x: x + rand(-10, 10) * big, y: y + rand(-6, 6) * big, vx: rand(-30, 30), vy: rand(-50, -10), r: rand(6, 11) * big, max: rand(0.5, 0.8) });
    for (let i = 0; i < 6 * big; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(80, 220) * Math.sqrt(big);
      fx({ kind: "debris", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, spin: rand(-12, 12), r: rand(3, 6), max: rand(0.6, 1) });
    }
    for (let i = 0; i < 4 * big; i++) fx({ kind: "splash", x: x + rand(-14, 14) * big, y: y + 8, vx: rand(-40, 40), vy: rand(-160, -90), r: rand(2, 3.5), max: 0.7 });
    g.shake = Math.max(g.shake, 0.12 * big);
  };
  const sparks = (x, y, n = 4, color = YELLOW) => {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      fx({ kind: "spark", x, y, vx: Math.cos(a) * rand(80, 200), vy: Math.sin(a) * rand(80, 200), color, max: rand(0.18, 0.3) });
    }
  };

  // ---------- the enemy's side ----------
  const shipCore = () => ({ x: g.ship.x + 2, y: g.ship.y - 12 });
  const fire = (x, y, angle, speed, kind = "ball") =>
    g.bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: kind === "orb" ? 6 : 5, kind });
  const aimFrom = (x, y) => {
    const me = shipCore();
    return Math.atan2(me.y - y, me.x - x);
  };
  const enemy = (kind, props) => g.enemies.push({ kind, born: g.t, flash: 0, fired: 0, ...props });

  function spawnWave() {
    g.waveN++;
    const roll = Math.random();
    const kind = g.waveN % 4 === 0 ? "frigate" : roll < 0.48 ? "gunboats" : roll < 0.8 ? "gulls" : "frigate";
    const s = g.stage;
    if (kind === "gunboats") {
      const y0 = rand(TOP + 40, BOTTOM - 40);
      const n = 4 + Math.min(3, s);
      for (let i = 0; i < n; i++) {
        enemy("gunboat", { x: W + 30 + i * 46, y: y0, y0, phase: i * 0.8, hp: 2 + Math.floor(s / 2), r: 15, score: 100, fireAt: g.t + rand(0.9, 2.6) });
      }
    } else if (kind === "gulls") {
      const y0 = rand(TOP, BOTTOM - 60);
      [0, 1, -1, 2, -2, 3, -3].forEach((k, i) => {
        enemy("gull", { x: W + 30 + Math.abs(k) * 26, y: y0 + k * 18, hp: 1, r: 11, score: 50, dive: (g.ship.y - y0) * 0.35, delay: i * 0.02 });
      });
    } else {
      const hp = 16 + s * 6;
      enemy("frigate", { x: W + 70, y: rand(TOP + 50, BOTTOM - 30), hp, maxHp: hp, r: 26, score: 800, fireAt: g.t + 1.4, stay: rand(7, 9) });
    }
    g.nextWave = Math.max(1.4, 3.1 - s * 0.3) + rand(0, 1);
  }

  function spawnBoss() {
    const hp = 220 + (g.stage - 1) * 110;
    g.boss = { kind: "seaking", born: g.t, flash: 0, x: W - 130, y: BOTTOM + 110, hp, maxHp: hp, shown: hp, r: 32, score: 5000, pattern: 0, patternAt: g.t + 2.5, fireAt: g.t + 2.6, spin: 0 };
    g.enemies.push(g.boss);
    sound("thud");
    g.shake = 0.6;
  }

  function stepEnemy(e, dt) {
    const age = g.t - e.born;
    if (e.kind === "gunboat") {
      e.x -= (110 + g.stage * 12) * dt;
      e.y = clamp(e.y0 + Math.sin(age * 2.2 + e.phase) * 34, TOP, BOTTOM);
      if (g.t >= e.fireAt && e.x < W - 20 && e.x > 80) {
        fire(e.x - 16, e.y - 8, aimFrom(e.x, e.y), 140 + g.stage * 18);
        e.fireAt = g.stage >= 2 ? g.t + rand(1.6, 2.8) : Infinity;
        sound("knock");
      }
    } else if (e.kind === "gull") {
      e.x -= 230 * dt;
      e.y += e.dive * dt;
    } else if (e.kind === "frigate") {
      const target = W - 115;
      if (age < e.stay) e.x += (target - e.x) * (1 - Math.exp(-dt * 1.6));
      else e.x -= 80 * dt;
      e.y += Math.sin(age * 0.9) * 10 * dt;
      if (g.t >= e.fireAt && age < e.stay) {
        const n = g.stage >= 2 ? 5 : 3;
        const base = aimFrom(e.x, e.y);
        for (let i = 0; i < n; i++) fire(e.x - 30, e.y - 10, base + (i - (n - 1) / 2) * 0.2, 150 + g.stage * 12);
        e.fireAt = g.t + Math.max(0.9, 1.6 - g.stage * 0.15);
        fx({ kind: "smoke", x: e.x - 34, y: e.y - 10, vx: -20, vy: -20, r: 7, max: 0.5 });
        sound("thud");
      }
      if (e.hp < e.maxHp / 2 && Math.random() < dt * 6) fx({ kind: "smoke", x: e.x + rand(-20, 20), y: e.y - 30, vx: 10, vy: -40, r: rand(4, 7), max: 0.7 });
    } else if (e.kind === "seaking") {
      // Rises out of the sea, then bobs and sways while it spits
      const rise = clamp01(age / 2.2);
      const baseY = 236;
      e.y = rise < 1 ? BOTTOM + 110 + (baseY - BOTTOM - 110) * easeOut(rise) : baseY + Math.sin(age * 1.3) * 46;
      e.x = W - 130 + Math.sin(age * 0.7) * 22;
      e.shown += (e.hp - e.shown) * (1 - Math.exp(-dt * 3));
      if (rise < 1) return;
      const angry = e.hp < e.maxHp / 2;
      const rate = angry ? 0.72 : 1;
      const mouth = { x: e.x - 38, y: e.y + 8 };
      if (g.t >= e.patternAt) {
        e.pattern = (e.pattern + 1) % 3;
        e.patternAt = g.t + 4.2;
        e.fireAt = g.t + 0.4;
      }
      if (g.t >= e.fireAt) {
        if (e.pattern === 0) {
          const n = 12 + g.stage * 2;
          e.spin += 0.3;
          for (let i = 0; i < n; i++) fire(mouth.x, mouth.y, e.spin + (i / n) * Math.PI * 2, 110 + g.stage * 8, "orb");
          e.fireAt = g.t + 0.95 * rate;
          sound("pop");
        } else if (e.pattern === 1) {
          const base = aimFrom(mouth.x, mouth.y);
          for (let i = -2; i <= 2; i++) fire(mouth.x, mouth.y, base + i * 0.17, 190 + g.stage * 10);
          e.fireAt = g.t + 0.24 * rate;
        } else {
          e.spin += 0.24;
          [0, Math.PI].forEach((o) => fire(mouth.x, mouth.y, e.spin + o, 130 + g.stage * 8, "orb"));
          if (angry) [Math.PI / 2, -Math.PI / 2].forEach((o) => fire(mouth.x, mouth.y, -e.spin + o, 120, "orb"));
          e.fireAt = g.t + 0.07;
        }
      }
    }
  }

  function kill(e) {
    g.enemies = g.enemies.filter((o) => o !== e);
    g.chain = g.t < g.chainUntil ? g.chain + 1 : 1;
    g.chainUntil = g.t + 1.4;
    const mult = Math.min(8, g.chain);
    const gain = e.score * mult;
    g.score += gain;
    pop(e.x, e.y - 26, `+${gain}`, { size: e.kind === "seaking" ? 16 : 10 });
    if (e.kind === "seaking") {
      g.boss = null;
      g.bullets.forEach((b) => sparks(b.x, b.y, 1, CREAM));
      g.bullets = [];
      for (let i = 0; i < 6; i++) g.later.push({ at: g.t + i * 0.16, run: () => explode(e.x + rand(-40, 40), e.y + rand(-30, 50), 1.4, i === 5 ? "KABOOM!" : null) });
      g.later.push({ at: g.t + 1, run: () => {
        const bonus = 10000 * g.stage;
        g.score += bonus;
        g.clear = 3.2;
        pop(W / 2, H / 2 + 40, `STAGE BONUS +${bonus.toLocaleString("en-US")}`, { size: 12, max: 2.2 });
        sound("ping");
      } });
      g.flash = 0.4;
      g.shake = 1;
      sound("stamp");
      return;
    }
    const big = e.kind === "frigate";
    explode(e.x, e.y - (big ? 16 : 6), big ? 1.6 : 0.8, big ? "BOOM!" : Math.random() < 0.3 ? "POW!" : null);
    sound(big ? "stamp" : "thud");
    // What it was carrying
    const roll = Math.random();
    const drop = big ? (g.waveN % 3 === 0 ? "fist" : "meat") : roll < 0.07 ? "meat" : roll < 0.085 && g.lives < 5 ? "hat" : null;
    if (drop) g.pickups.push({ kind: drop, x: e.x, y: e.y - 10, born: g.t });
  }

  function hurt() {
    if (g.inv > 0 || g.gatling > 0) return;
    g.lives--;
    g.inv = 2.2;
    g.shake = 0.5;
    g.flash = 0.3;
    g.power = Math.max(1, g.power - 1);
    g.chain = 0;
    const me = shipCore();
    // Bullets right around the ship melt away: a moment to breathe
    g.bullets = g.bullets.filter((b) => {
      const near = Math.hypot(b.x - me.x, b.y - me.y) < 90;
      if (near) sparks(b.x, b.y, 1, CREAM);
      return !near;
    });
    explode(me.x, me.y, 0.7);
    pop(me.x, me.y - 30, "OUCH!", { size: 14, color: RED });
    sound("buzz");
    if (g.lives <= 0) {
      g.state = "over";
      g.overAt = g.t;
      g.newBest = g.score > g.best;
      if (g.newBest) {
        g.best = g.score;
        try {
          localStorage.setItem("strike-best", String(g.best));
        } catch {
          // The best bounty just isn't kept between visits
        }
      }
      sound("stamp");
      // A bounty that makes the board gets its name on it, once the poster has landed
      if (g.boardState === "ready" && qualifies(g.board, g.score)) {
        g.entry = { state: "typing", name: g.name };
        g.later.push({ at: g.t + 0.7, run: () => g.entry?.state === "typing" && hooks.onEntry?.() });
      }
    }
  }

  // Gomu Gomu no Gatling: a storm of fists, and every bullet in the sky popped
  g.bomb = () => {
    if (g.state !== "play" || g.paused) return g.start();
    if (g.bombs <= 0 || g.gatling > 0) return;
    g.bombs--;
    g.gatling = 1.5;
    g.inv = Math.max(g.inv, 1.8);
    g.flash = 0.25;
    g.shake = 0.4;
    g.bullets.forEach((b) => {
      sparks(b.x, b.y, 1, CREAM);
      g.score += 10;
    });
    g.bullets = [];
    pop(W / 2, 150, "GOMU GOMU NO GATLING!", { size: 15, max: 1.4 });
    sound("whoosh");
  };

  function collect(p) {
    const me = shipCore();
    if (p.kind === "meat") {
      if (g.power < 3) {
        g.power++;
        pop(me.x, me.y - 34, g.power === 3 ? "MAX POWER!" : "POWER UP!", { size: 12 });
      } else {
        g.score += 1000;
        pop(me.x, me.y - 34, "+1000 YUM!", { size: 11 });
      }
      sound("shishishi");
    } else if (p.kind === "fist") {
      g.bombs = Math.min(5, g.bombs + 1);
      pop(me.x, me.y - 34, "+1 GATLING", { size: 11, color: "#ff90e8" });
      sound("pop");
    } else {
      g.lives = Math.min(5, g.lives + 1);
      pop(me.x, me.y - 34, "+1 STRAW HAT", { size: 11, color: "#8fd694" });
      sound("ping");
    }
    fx({ kind: "ring", x: p.x, y: p.y, r: 8, max: 0.35 });
  }

  // A real controller works too: stick or d-pad to sail, any face button for the Gatling
  function pollPad() {
    const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...(pads || [])].find(Boolean);
    if (!pad) return null;
    const b = (i) => !!pad.buttons[i]?.pressed;
    const dead = (v) => (Math.abs(v || 0) > 0.25 ? v : 0);
    const move = {
      x: dead(pad.axes[0]) + (b(15) ? 1 : 0) - (b(14) ? 1 : 0),
      y: dead(pad.axes[1]) + (b(13) ? 1 : 0) - (b(12) ? 1 : 0),
    };
    const now = { face: b(0) || b(1) || b(2) || b(3), start: b(9) };
    if (now.face && !g.padWas.face) g.state === "play" ? g.bomb() : g.start();
    if (now.start && !g.padWas.start) g.state === "play" ? g.pause() : g.start();
    g.padWas = now;
    return move;
  }

  // The game keeps its own clock, so a slow frame slows everything alike
  g.step = (now) => {
    const dt = Math.min(0.05, g.last ? now - g.last : 0);
    g.last = now;
    const pad = pollPad();
    if (g.paused) return;
    g.t += dt;
    const t = g.t;
    // Effects keep playing behind the title and the poster
    g.scroll += dt * (g.state === "play" ? 1 : 0.4);
    g.later = g.later.filter((l) => (t >= l.at ? (l.run(), false) : true));
    g.fx.forEach((p) => {
      p.life += dt;
      if (p.vx !== undefined) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === "debris" || p.kind === "splash") p.vy += 520 * dt;
        if (p.kind === "smoke") p.r += 8 * dt;
      }
    });
    g.fx = g.fx.filter((p) => p.life < p.max);
    g.pops.forEach((p) => (p.life += dt));
    g.pops = g.pops.filter((p) => p.life < p.max);
    g.shake = Math.max(0, g.shake - dt);
    g.flash = Math.max(0, g.flash - dt);
    if (g.state !== "play") return;

    // ---- the ship ----
    const ship = g.ship;
    let mx = (g.keys.has("right") ? 1 : 0) - (g.keys.has("left") ? 1 : 0) + (pad?.x || 0);
    let my = (g.keys.has("down") ? 1 : 0) - (g.keys.has("up") ? 1 : 0) + (pad?.y || 0);
    if (mx || my) {
      g.aim = null;
      const len = Math.max(1, Math.hypot(mx, my));
      ship.x += (mx / len) * 240 * dt;
      ship.y += (my / len) * 240 * dt;
    } else if (g.aim) {
      const dx = g.aim.x - ship.x;
      const dy = g.aim.y - ship.y;
      const d = Math.hypot(dx, dy);
      const step = Math.min(d, 430 * dt);
      if (d > 0.5) {
        ship.x += (dx / d) * step;
        ship.y += (dy / d) * step;
      }
      my = clamp(dy / 40, -1, 1);
    }
    ship.x = clamp(ship.x, LEFT, RIGHT);
    ship.y = clamp(ship.y, TOP, BOTTOM);
    ship.tilt += (my * 0.12 - ship.tilt) * (1 - Math.exp(-dt * 10));
    g.inv = Math.max(0, g.inv - dt);
    if (Math.random() < dt * 30) fx({ kind: "foam", x: ship.x - 30, y: ship.y + rand(-2, 3), vx: -120, vy: 0, r: rand(2, 4), max: 0.45 });

    // ---- Gomu Gomu no Pistol, on its own ----
    const fist = (y, angle, speed, dmg = 1) =>
      g.shots.push({ x: ship.x + 34, y: ship.y - 20 + y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, dmg, born: t });
    if (t >= g.fireAt) {
      g.fireAt = t + (g.power >= 2 ? 0.13 : 0.17);
      if (g.power === 1) fist(0, 0, 580);
      else if (g.power === 2) [-7, 7].forEach((y) => fist(y, 0, 600));
      else [-0.13, 0, 0.13].forEach((a) => fist(a * 40, a, 620));
      if (g.volley++ % 3 === 0) sound("tick");
    }
    if (g.gatling > 0) {
      g.gatling -= dt;
      g.shake = Math.max(g.shake, 0.1);
      while (g.gatlingAt <= t) {
        g.gatlingAt = t + 0.025;
        fist(rand(-44, 44), rand(-0.08, 0.08), 760, 2);
      }
      g.bullets = [];
    }
    g.shots.forEach((s) => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    });
    g.shots = g.shots.filter((s) => s.x < W + 20 && s.y > HORIZON - 20 && s.y < H + 20);

    // ---- the Marines ----
    g.stageT += dt;
    if (g.clear > 0) {
      g.clear -= dt;
      if (g.clear <= 0) Object.assign(g, { stage: g.stage + 1, stageT: 0, bossCalled: false, nextWave: 1.5, waveN: 0 });
    } else if (!g.bossCalled && g.stageT >= STAGE_LEN && !g.enemies.length) {
      g.bossCalled = true;
      g.warn = 2.8;
      sound("ping");
    } else if (g.warn > 0) {
      g.warn -= dt;
      if (g.warn <= 0) spawnBoss();
    } else if (!g.bossCalled && g.stageT < STAGE_LEN) {
      g.nextWave -= dt;
      if (g.nextWave <= 0) spawnWave();
    }
    g.enemies.forEach((e) => {
      e.flash = Math.max(0, e.flash - dt);
      stepEnemy(e, dt);
    });
    g.enemies = g.enemies.filter((e) => e.x > -90 && e.y < H + 160);
    g.bullets.forEach((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    });
    g.bullets = g.bullets.filter((b) => b.x > -20 && b.x < W + 20 && b.y > HORIZON - 30 && b.y < H + 20);

    // ---- fists on Marines ----
    for (const s of g.shots) {
      const e = g.enemies.find((o) => Math.hypot(o.x - s.x, o.y - 10 - s.y) < o.r + 6 && !(o.kind === "seaking" && t - o.born < 2));
      if (!e) continue;
      s.dead = true;
      e.hp -= s.dmg;
      e.flash = 0.06;
      sparks(s.x + 4, s.y, 2);
      if (e.hp <= 0) kill(e);
    }
    g.shots = g.shots.filter((s) => !s.dead);

    // ---- the ship is hit ----
    const me = shipCore();
    if (g.bullets.some((b) => Math.hypot(b.x - me.x, b.y - me.y) < b.r + 4)) hurt();
    else if (g.enemies.some((e) => Math.hypot(e.x - me.x, e.y - 10 - me.y) < e.r + 8)) hurt();

    // ---- loot drifts, and comes to the ship when it's close ----
    g.pickups.forEach((p) => {
      const dx = me.x - p.x;
      const dy = me.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 80) {
        p.x += (dx / d) * 260 * dt;
        p.y += (dy / d) * 260 * dt;
      } else p.x -= 55 * dt;
      if (d < 22) {
        p.taken = true;
        collect(p);
      }
    });
    g.pickups = g.pickups.filter((p) => !p.taken && p.x > -30);
  };
  return g;
}

// ---------- drawing helpers ----------
function card(c, x, y, w, h, fill, r = 7, drop = 3) {
  c.fillStyle = INK;
  c.beginPath();
  c.roundRect(x + drop, y + drop, w, h, r);
  c.fill();
  c.fillStyle = fill;
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = INK;
  c.stroke();
}
// Big comic lettering: a thick ink outline, a hard shadow, then the colour
function inked(c, text, x, y, size, fill, { font = DISPLAY, weight = 800, drop = 3, line = 5 } = {}) {
  c.font = `${weight} ${size}px ${font}`;
  c.lineJoin = "round";
  c.lineWidth = line;
  c.strokeStyle = INK;
  c.fillStyle = INK;
  c.strokeText(text, x + drop, y + drop);
  c.fillText(text, x + drop, y + drop);
  c.strokeText(text, x, y);
  c.fillStyle = fill;
  c.fillText(text, x, y);
}
function star(c, x, y, r, inner, points, spin = 0) {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = spin + (i / (points * 2)) * Math.PI * 2;
    const rr = i % 2 ? inner : r;
    c[i ? "lineTo" : "moveTo"](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
}
function drawHat(c, x, y, s = 1, faded = false) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.globalAlpha = faded ? 0.25 : 1;
  c.lineWidth = 1.6;
  c.strokeStyle = INK;
  c.fillStyle = "#f2c14e";
  c.beginPath();
  c.ellipse(0, 2, 9, 2.6, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(-5, 2);
  c.quadraticCurveTo(-5, -6, 0, -6);
  c.quadraticCurveTo(5, -6, 5, 2);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = "#d62828";
  c.fillRect(-5, -1, 10, 2.2);
  c.restore();
}
function drawFist(c, x, y, s = 1, angle = 0) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(s, s);
  c.lineWidth = 1.8;
  c.strokeStyle = INK;
  c.fillStyle = "#f6d2b4";
  c.beginPath();
  c.roundRect(-6, -5.5, 12, 11, 4);
  c.fill();
  c.stroke();
  c.beginPath();
  [-2.5, 0.5, 3.5].forEach((ky) => {
    c.moveTo(2, ky - 1);
    c.lineTo(5, ky - 1);
  });
  c.stroke();
  c.restore();
}
function drawMeat(c, x, y, s = 1) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.rotate(-0.4);
  c.lineWidth = 1.8;
  c.strokeStyle = INK;
  c.fillStyle = CREAM;
  c.beginPath();
  c.roundRect(-12, -2, 24, 4, 2);
  c.fill();
  c.stroke();
  [[-12, 0], [12, 0]].forEach(([bx, by]) => {
    c.beginPath();
    c.arc(bx, by - 2, 2.6, 0, Math.PI * 2);
    c.arc(bx, by + 2, 2.6, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  });
  c.fillStyle = "#c2502b";
  c.beginPath();
  c.ellipse(0, 0, 8.5, 6.5, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = "rgba(255,255,255,.55)";
  c.beginPath();
  c.ellipse(-3, -2.5, 3, 1.5, -0.4, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

// ---------- the sea ----------
function drawSea(c, g, t) {
  const sky = SKIES[(g.stage - 1) % SKIES.length];
  const s = g.scroll;
  const grad = c.createLinearGradient(0, 0, 0, HORIZON);
  grad.addColorStop(0, sky.sky[0]);
  grad.addColorStop(1, sky.sky[1]);
  c.fillStyle = grad;
  c.fillRect(0, 0, W, HORIZON);
  // the sun (or moon) with its slow-turning rays, or stars at night
  const sx = W * 0.74;
  const sy = 58;
  if (sky.night) {
    c.fillStyle = CREAM;
    for (let i = 0; i < 28; i++) {
      const x = (i * 97) % W;
      const y = (i * 53) % (HORIZON - 10);
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i));
      c.globalAlpha = tw;
      c.fillRect(x, y, 1.6, 1.6);
    }
    c.globalAlpha = 1;
  } else {
    c.fillStyle = sky.ray;
    star(c, sx, sy, 70, 30, 10, t * 0.15);
    c.fill();
  }
  c.fillStyle = sky.sun;
  c.strokeStyle = INK;
  c.lineWidth = 2;
  c.beginPath();
  c.arc(sx, sy, 20, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  if (sky.night) {
    c.fillStyle = sky.sky[0];
    c.beginPath();
    c.arc(sx + 8, sy - 5, 16, 0, Math.PI * 2);
    c.fill();
  }
  // toon clouds, inked
  [[80, 34, 1], [300, 22, 0.8], [520, 44, 1.1], [700, 30, 0.9]].forEach(([cx, cy, k]) => {
    const span = W + 160;
    const x = (((cx - s * 14 * k) % span) + span) % span - 80;
    c.fillStyle = sky.cloud;
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(x, cy, 26 * k, 9 * k, 0, 0, Math.PI * 2);
    c.ellipse(x + 14 * k, cy - 7 * k, 15 * k, 10 * k, 0, 0, Math.PI * 2);
    c.ellipse(x - 12 * k, cy - 4 * k, 11 * k, 7 * k, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.beginPath();
    c.ellipse(x, cy, 26 * k - 1, 9 * k - 1, 0, 0, Math.PI * 2);
    c.ellipse(x + 14 * k, cy - 7 * k, 15 * k - 1, 10 * k - 1, 0, 0, Math.PI * 2);
    c.fill();
  });
  // islands on the horizon, a palm on each
  [[120, 1], [460, 0.7], [760, 1.2]].forEach(([ix, k]) => {
    const span = W + 240;
    const x = (((ix - s * 22) % span) + span) % span - 120;
    c.fillStyle = sky.isle;
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x - 50 * k, HORIZON);
    c.quadraticCurveTo(x - 10 * k, HORIZON - 26 * k, x + 50 * k, HORIZON);
    c.closePath();
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(x, HORIZON - 14 * k);
    c.quadraticCurveTo(x + 4 * k, HORIZON - 30 * k, x + 2 * k, HORIZON - 38 * k);
    c.stroke();
    c.fillStyle = sky.night ? "#3a6b5a" : "#2f8a4f";
    [-0.6, 0.3, 1.2, 2.4].forEach((a) => {
      c.beginPath();
      c.ellipse(x + 2 * k + Math.cos(a) * 7 * k, HORIZON - 38 * k + Math.sin(a) * 3 * k, 8 * k, 2.6 * k, a, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    });
  });
  // the sea, darker towards the viewer, with rows of toon waves that run faster up close
  const sea = c.createLinearGradient(0, HORIZON, 0, H);
  sea.addColorStop(0, sky.sea[0]);
  sea.addColorStop(1, sky.sea[1]);
  c.fillStyle = sea;
  c.fillRect(0, HORIZON, W, H - HORIZON);
  c.fillStyle = INK;
  c.fillRect(0, HORIZON - 1, W, 2.5);
  c.strokeStyle = sky.wave;
  c.lineCap = "round";
  for (let row = 0; row < 9; row++) {
    const depth = (row + 1) / 9;
    const y = HORIZON + 8 + depth * depth * (H - HORIZON - 4);
    const gap = 40 + depth * 90;
    const size = 4 + depth * 12;
    c.lineWidth = 1 + depth * 2;
    const off = (s * (60 + depth * 260) + row * 37) % gap;
    for (let x = -off - gap; x < W + gap; x += gap) {
      const bob = Math.sin(t * 2 + x * 0.05 + row) * 1.5;
      c.beginPath();
      c.moveTo(x, y + bob);
      c.quadraticCurveTo(x + size / 2, y - size * 0.45 + bob, x + size, y + bob);
      c.quadraticCurveTo(x + size * 1.5, y - size * 0.45 + bob, x + size * 2, y + bob);
      c.stroke();
    }
  }
  c.lineCap = "butt";
}

// ---------- ships, birds and beasts ----------
// The Going Merry, facing right, its waterline at (0, 0)
function drawMerry(c, x, y, t, tilt, power) {
  c.save();
  c.translate(x, y);
  // shadow and wake on the water
  c.fillStyle = "rgba(10,20,50,.28)";
  c.beginPath();
  c.ellipse(-2, 3, 36, 5, 0, 0, Math.PI * 2);
  c.fill();
  c.rotate(tilt + Math.sin(t * 3) * 0.035);
  c.lineWidth = 2.2;
  c.lineJoin = "round";
  c.strokeStyle = INK;
  // mast and sail, behind the rail
  c.fillStyle = "#8a5426";
  c.fillRect(-4, -66, 5, 52);
  c.strokeRect(-4, -66, 5, 52);
  const billow = Math.sin(t * 2.4) * 2;
  c.fillStyle = CREAM;
  c.beginPath();
  c.moveTo(-24, -60);
  c.lineTo(18, -60);
  c.quadraticCurveTo(24 + billow, -42, 18, -24);
  c.lineTo(-24, -24);
  c.quadraticCurveTo(-18 + billow, -42, -24, -60);
  c.closePath();
  c.fill();
  c.stroke();
  // the Jolly Roger in its straw hat
  c.fillStyle = INK;
  c.beginPath();
  c.arc(-2, -40, 6.5, 0, Math.PI * 2);
  c.fill();
  c.lineWidth = 2.4;
  c.beginPath();
  c.moveTo(-11, -33);
  c.lineTo(7, -29);
  c.moveTo(-11, -29);
  c.lineTo(7, -33);
  c.stroke();
  c.fillStyle = CREAM;
  c.fillRect(-5, -41, 2.2, 2.2);
  c.fillRect(-0.5, -41, 2.2, 2.2);
  drawHat(c, -2, -46, 0.8);
  // the flag on top
  const flap = Math.sin(t * 9) * 2;
  c.lineWidth = 2;
  c.fillStyle = INK;
  c.beginPath();
  c.moveTo(1, -66);
  c.lineTo(-14, -70 + flap);
  c.lineTo(1, -74);
  c.closePath();
  c.fill();
  c.stroke();
  // hull: wooden planks, the cream rail, and a bow that sweeps up
  c.lineWidth = 2.2;
  c.fillStyle = "#d9a35b";
  c.beginPath();
  c.moveTo(-34, -20);
  c.lineTo(22, -18);
  c.quadraticCurveTo(30, -18, 34, -26);
  c.lineTo(36, -22);
  c.quadraticCurveTo(30, 2, 14, 4);
  c.lineTo(-24, 4);
  c.quadraticCurveTo(-34, 0, -36, -16);
  c.closePath();
  c.fill();
  c.stroke();
  c.strokeStyle = "#a0622d";
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(-33, -11);
  c.lineTo(28, -11);
  c.moveTo(-28, -3);
  c.lineTo(22, -3);
  c.stroke();
  c.strokeStyle = INK;
  c.lineWidth = 2;
  c.fillStyle = CREAM;
  c.beginPath();
  c.roundRect(-36, -24, 60, 5, 2);
  c.fill();
  c.stroke();
  // portholes
  c.fillStyle = "#fff3c4";
  [-20, -6, 8].forEach((px) => {
    c.beginPath();
    c.arc(px, -7, 2.4, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  });
  // the sheep's head on the bow, curly horns and all
  c.fillStyle = CREAM;
  [[36, -30, 6], [41, -33, 5], [40, -26, 5]].forEach(([fx, fy, r]) => {
    c.beginPath();
    c.arc(fx, fy, r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  });
  c.fillStyle = "#f3e2b8";
  c.beginPath();
  c.ellipse(45, -28, 5, 4, 0.2, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = INK;
  c.fillRect(45, -30, 1.8, 1.8);
  c.strokeStyle = "#8a5426";
  c.lineWidth = 2;
  c.beginPath();
  c.arc(37, -34, 3.5, 0, Math.PI * 1.6);
  c.stroke();
  // power: a glow round the bow, stronger with each meat eaten
  if (power > 1) {
    c.globalAlpha = 0.35 + 0.2 * Math.sin(t * 10);
    c.strokeStyle = power === 3 ? "#ff90e8" : YELLOW;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(42, -30, 11, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = 1;
  }
  c.restore();
}

// Each Marine is drawn facing left (towards the Merry); `F` turns its colours white on a hit
function drawGunboat(c, e, t, F) {
  c.save();
  c.translate(e.x, e.y);
  c.fillStyle = "rgba(10,20,50,.25)";
  c.beginPath();
  c.ellipse(0, 3, 20, 3.5, 0, 0, Math.PI * 2);
  c.fill();
  c.rotate(Math.sin(t * 4 + e.phase) * 0.06);
  c.lineWidth = 2;
  c.strokeStyle = INK;
  c.lineJoin = "round";
  // cannon, cabin and funnel
  c.fillStyle = F(INK);
  c.fillRect(-22, -14, 10, 4);
  c.fillStyle = F(CREAM);
  c.beginPath();
  c.roundRect(-8, -20, 16, 10, 2);
  c.fill();
  c.stroke();
  c.fillStyle = F(BLUE);
  c.beginPath();
  c.roundRect(2, -28, 6, 10, 1);
  c.fill();
  c.stroke();
  c.fillStyle = F("#9ec5ff");
  c.fillRect(-5, -17, 4, 4);
  // hull with its Marine stripe
  c.fillStyle = F("#e8eef5");
  c.beginPath();
  c.moveTo(-20, -10);
  c.lineTo(18, -10);
  c.lineTo(15, 3);
  c.lineTo(-14, 3);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = F(BLUE);
  c.fillRect(-18, -6, 34, 3);
  c.restore();
}

function drawFrigate(c, e, t, F) {
  c.save();
  c.translate(e.x, e.y);
  c.fillStyle = "rgba(10,20,50,.28)";
  c.beginPath();
  c.ellipse(0, 4, 46, 6, 0, 0, Math.PI * 2);
  c.fill();
  c.rotate(Math.sin(t * 2) * 0.03);
  c.lineWidth = 2.2;
  c.strokeStyle = INK;
  c.lineJoin = "round";
  // two masts with square sails, the Marines' gull on them
  [[-12, 0], [18, 1]].forEach(([mx, k]) => {
    c.fillStyle = F("#8a5426");
    c.fillRect(mx - 2, -78 + k * 6, 4, 58);
    c.strokeRect(mx - 2, -78 + k * 6, 4, 58);
    const bil = Math.sin(t * 2 + k) * 2;
    c.fillStyle = F(CREAM);
    c.beginPath();
    c.moveTo(mx - 15, -70 + k * 6);
    c.lineTo(mx + 15, -70 + k * 6);
    c.quadraticCurveTo(mx + 13 - bil, -54 + k * 6, mx + 15, -38 + k * 6);
    c.lineTo(mx - 15, -38 + k * 6);
    c.quadraticCurveTo(mx - 17 - bil, -54 + k * 6, mx - 15, -70 + k * 6);
    c.closePath();
    c.fill();
    c.stroke();
    c.strokeStyle = F(BLUE);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(mx - 8, -58 + k * 6);
    c.quadraticCurveTo(mx - 4, -62 + k * 6, mx, -57 + k * 6);
    c.quadraticCurveTo(mx + 4, -62 + k * 6, mx + 8, -58 + k * 6);
    c.stroke();
    c.fillStyle = F(BLUE);
    c.font = `800 5px ${BODY}`;
    c.textAlign = "center";
    c.fillText("MARINE", mx, -46 + k * 6);
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
  });
  // flag
  c.fillStyle = F(BLUE);
  c.beginPath();
  c.moveTo(-12, -78);
  c.lineTo(2, -75 + Math.sin(t * 8) * 2);
  c.lineTo(-12, -71);
  c.closePath();
  c.fill();
  c.stroke();
  // hull
  c.fillStyle = F("#eef2f8");
  c.beginPath();
  c.moveTo(-48, -26);
  c.quadraticCurveTo(-40, -20, -30, -20);
  c.lineTo(42, -20);
  c.lineTo(44, -28);
  c.lineTo(48, -18);
  c.quadraticCurveTo(44, 2, 30, 4);
  c.lineTo(-28, 4);
  c.quadraticCurveTo(-42, 0, -48, -26);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = F(BLUE);
  c.fillRect(-40, -12, 82, 5);
  c.strokeRect(-40, -12, 82, 5);
  c.fillStyle = F(INK);
  [-26, -10, 6, 22].forEach((px) => {
    c.beginPath();
    c.arc(px, -3, 2.8, 0, Math.PI * 2);
    c.fill();
  });
  c.restore();
  // health, under the hull, once it's been hurt
  if (e.hp < e.maxHp) {
    c.fillStyle = INK;
    c.fillRect(e.x - 22, e.y + 10, 44, 6);
    c.fillStyle = "#8fd694";
    c.fillRect(e.x - 21, e.y + 11, 42 * (e.hp / e.maxHp), 4);
  }
}

function drawGull(c, e, t, F) {
  const flap = Math.sin(t * 16 + e.born) * 6;
  const x = e.x;
  const y = e.y - 10;
  c.lineWidth = 2;
  c.strokeStyle = INK;
  c.fillStyle = F(CREAM);
  c.beginPath();
  c.ellipse(x, y, 10, 6, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(x - 11, y - 4 - flap);
  c.quadraticCurveTo(x - 5, y, x, y - 2);
  c.quadraticCurveTo(x + 5, y, x + 11, y - 4 - flap);
  c.stroke();
  c.fillStyle = F("#ffb000");
  c.beginPath();
  c.moveTo(x - 9, y - 1);
  c.lineTo(x - 15, y + 1);
  c.lineTo(x - 9, y + 2);
  c.fill();
  c.fillStyle = INK;
  c.fillRect(x - 6, y - 3, 2, 2);
  // a little Marine cap
  c.fillStyle = F(BLUE);
  c.fillRect(x - 5, y - 9, 7, 3);
}

function drawSeaKing(c, e, t, F) {
  const angry = e.hp < e.maxHp / 2;
  const { x, y } = e;
  c.save();
  c.lineJoin = "round";
  c.lineCap = "round";
  // the neck coils up out of the sea: ink, then scales, then belly bands
  const neck = () => {
    c.beginPath();
    c.moveTo(x + 70, H + 40);
    c.bezierCurveTo(x + 80, y + 110, x + 40, y + 40, x + 6, y + 6);
  };
  c.strokeStyle = INK;
  c.lineWidth = 42;
  neck();
  c.stroke();
  c.strokeStyle = F(angry ? "#2a9d8f" : "#2bb39a");
  c.lineWidth = 36;
  neck();
  c.stroke();
  c.strokeStyle = F("#f3e2b8");
  c.lineWidth = 12;
  c.setLineDash([7, 6]);
  neck();
  c.stroke();
  c.setLineDash([]);
  // foam where it breaks the surface
  c.fillStyle = CREAM;
  c.strokeStyle = INK;
  c.lineWidth = 2;
  const foamY = Math.min(H - 10, y + 120);
  c.beginPath();
  c.ellipse(x + 72, foamY, 34, 7, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // spines along the head
  c.fillStyle = F("#7c4dff");
  [[-6, -26], [10, -28], [26, -22]].forEach(([sx, sy], i) => {
    c.beginPath();
    c.moveTo(x + sx - 8, y + sy + 10);
    c.lineTo(x + sx + 2, y + sy - 10 - Math.sin(t * 6 + i) * 2);
    c.lineTo(x + sx + 8, y + sy + 10);
    c.closePath();
    c.fill();
    c.stroke();
  });
  // the head: an open jaw full of teeth
  const jaw = 0.25 + 0.15 * Math.sin(t * 5);
  c.fillStyle = F(angry ? "#2a9d8f" : "#2bb39a");
  c.beginPath();
  c.ellipse(x, y - 4, 40, 22, -jaw * 0.4, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = "#7a1f2b";
  c.beginPath();
  c.moveTo(x - 4, y + 4);
  c.lineTo(x - 44, y - 2 + jaw * 10);
  c.lineTo(x - 40, y + 14 + jaw * 26);
  c.lineTo(x - 2, y + 14);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = CREAM;
  for (let i = 0; i < 4; i++) {
    const tx = x - 40 + i * 9;
    c.beginPath();
    c.moveTo(tx, y + jaw * 6);
    c.lineTo(tx + 4, y + 7 + jaw * 4);
    c.lineTo(tx + 8, y + jaw * 6 - 1);
    c.fill();
  }
  c.fillStyle = F(angry ? "#2a9d8f" : "#2bb39a");
  c.beginPath();
  c.ellipse(x - 18, y + 16 + jaw * 20, 24, 8, -0.15, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // eye: yellow, turning red when it's hurt
  c.fillStyle = angry ? "#ff4d4d" : YELLOW;
  c.beginPath();
  c.ellipse(x - 6, y - 12, 8, 6, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(x - 8, y - 12, 1.8, 5, 0, 0, Math.PI * 2);
  c.fill();
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x - 16, y - 22);
  c.lineTo(x + 2, y - 18 + (angry ? -4 : 2));
  c.stroke();
  // whiskers
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(x - 30, y - 6);
  c.quadraticCurveTo(x - 50, y - 22, x - 58, y - 12 + Math.sin(t * 4) * 4);
  c.stroke();
  c.restore();
}

function drawShot(c, s, t) {
  // the stretched arm behind the fist, with speed lines
  const len = Math.min(30, (t - s.born) * 700);
  const a = Math.atan2(s.vy, s.vx);
  c.strokeStyle = INK;
  c.lineWidth = 5;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(s.x - Math.cos(a) * len, s.y - Math.sin(a) * len);
  c.lineTo(s.x, s.y);
  c.stroke();
  c.strokeStyle = s.dmg > 1 ? "#ffc9a8" : "#f6d2b4";
  c.lineWidth = 3;
  c.stroke();
  c.lineCap = "butt";
  drawFist(c, s.x, s.y, s.dmg > 1 ? 1.1 : 0.9, a);
}

function drawBullet(c, b, t) {
  c.lineWidth = 1.8;
  c.strokeStyle = INK;
  if (b.kind === "orb") {
    const pulse = 1 + Math.sin(t * 14 + b.x * 0.1) * 0.12;
    c.fillStyle = "#ff4fa8";
    c.beginPath();
    c.arc(b.x, b.y, b.r * pulse, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = CREAM;
    c.beginPath();
    c.arc(b.x, b.y, b.r * 0.45, 0, Math.PI * 2);
    c.fill();
  } else {
    c.fillStyle = "#2a2622";
    c.beginPath();
    c.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = "rgba(255,255,255,.75)";
    c.beginPath();
    c.arc(b.x - 1.5, b.y - 1.5, 1.6, 0, Math.PI * 2);
    c.fill();
  }
}

function drawPickup(c, p, t) {
  const bob = Math.sin(t * 5 + p.born) * 3;
  const y = p.y + bob;
  // a turning star behind, so it reads as loot
  c.fillStyle = p.kind === "meat" ? "rgba(255,221,0,.85)" : p.kind === "fist" ? "rgba(255,144,232,.85)" : "rgba(143,214,148,.85)";
  c.strokeStyle = INK;
  c.lineWidth = 1.6;
  star(c, p.x, y, 15, 9, 8, t * 2);
  c.fill();
  c.stroke();
  if (p.kind === "meat") drawMeat(c, p.x, y, 0.85);
  else if (p.kind === "fist") drawFist(c, p.x, y, 1.1);
  else drawHat(c, p.x, y + 1, 1.1);
}

function drawFx(c, p) {
  const k = p.life / p.max;
  c.lineWidth = 2;
  c.strokeStyle = INK;
  if (p.kind === "burst") {
    // a comic starburst: in fast, out fast, maybe with a word on it
    const s = k < 0.3 ? backOut(k / 0.3) : 1 - (k - 0.3) / 0.7 * 0.3;
    c.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    c.fillStyle = "#ff7a1a";
    star(c, p.x, p.y, p.r * 1.6 * s, p.r * 0.9 * s, 11, p.x);
    c.fill();
    c.stroke();
    c.fillStyle = YELLOW;
    star(c, p.x, p.y, p.r * 1.05 * s, p.r * 0.6 * s, 11, p.x + 0.3);
    c.fill();
    if (p.word) {
      c.textAlign = "center";
      c.textBaseline = "middle";
      inked(c, p.word, p.x, p.y, Math.round(10 + p.r * 0.25), RED, { line: 3, drop: 2 });
    }
    c.globalAlpha = 1;
  } else if (p.kind === "ring") {
    c.globalAlpha = 1 - k;
    c.strokeStyle = CREAM;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(p.x, p.y, p.r + k * 30, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = 1;
  } else if (p.kind === "smoke") {
    c.globalAlpha = 1 - k;
    c.fillStyle = "#cfc8d8";
    c.beginPath();
    c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.globalAlpha = 1;
  } else if (p.kind === "debris") {
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.spin * p.life);
    c.fillStyle = "#a0622d";
    c.fillRect(-p.r, -1.5, p.r * 2, 3);
    c.strokeRect(-p.r, -1.5, p.r * 2, 3);
    c.restore();
  } else if (p.kind === "spark") {
    c.strokeStyle = p.color;
    c.lineWidth = 2.4;
    c.globalAlpha = 1 - k;
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
    c.stroke();
    c.globalAlpha = 1;
  } else {
    // splash and foam: white drops
    c.globalAlpha = 1 - k;
    c.fillStyle = CREAM;
    c.beginPath();
    c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
  }
}

// ---------- the HUD ----------
function drawHud(c, g, t, hotspots) {
  c.textBaseline = "middle";
  c.textAlign = "left";
  // bounty
  card(c, 18, 8, 150, 38, CREAM);
  c.fillStyle = RED;
  c.beginPath();
  c.roundRect(24, 12, 52, 11, 3);
  c.fill();
  c.fillStyle = CREAM;
  c.font = `800 7px ${BODY}`;
  c.fillText("BOUNTY", 30, 18);
  c.fillStyle = INK;
  c.font = `800 14px ${DISPLAY}`;
  c.fillText(berries(g.score), 24, 35);
  // lives and Gatlings
  card(c, 176, 8, 112, 38, CREAM);
  for (let i = 0; i < 5; i++) drawHat(c, 190 + i * 20, 20, 0.95, i >= g.lives);
  for (let i = 0; i < 5; i++) {
    c.globalAlpha = i < g.bombs ? 1 : 0.22;
    drawFist(c, 190 + i * 20, 35, 0.85);
  }
  c.globalAlpha = 1;
  // power
  card(c, 296, 8, 100, 38, CREAM);
  c.fillStyle = INK;
  c.font = `800 7px ${BODY}`;
  c.fillText("GOMU GOMU", 304, 17);
  for (let i = 0; i < 3; i++) {
    c.fillStyle = i < g.power ? (g.power === 3 ? "#ff90e8" : YELLOW) : "#e7dfcf";
    c.beginPath();
    c.roundRect(304 + i * 22, 25, 18, 7, 2);
    c.fill();
    c.lineWidth = 1.6;
    c.stroke();
  }
  c.fillStyle = INK;
  c.font = `700 6.5px ${BODY}`;
  c.fillText(["PISTOL", "TWIN PISTOL", "BAZOOKA SPREAD"][g.power - 1], 304, 39);
  // stage, and the best bounty under it
  card(c, W - 170, 8, 92, 38, YELLOW);
  c.fillStyle = INK;
  c.textAlign = "center";
  c.font = `800 11px ${DISPLAY}`;
  c.fillText(`STAGE ${g.stage}`, W - 124, 21);
  c.font = `700 7px ${BODY}`;
  c.fillText(`BEST ${berries(Math.max(g.best, g.score))}`, W - 124, 36);
  // exit
  card(c, W - 66, 8, 56, 20, INK, 5, 2);
  c.fillStyle = CREAM;
  c.font = `800 8px ${BODY}`;
  c.fillText("✕ EXIT", W - 38, 18.5);
  c.textAlign = "left";

  // chain multiplier, shrinking with the time left to keep it going
  if (g.chain > 1 && t < g.chainUntil) {
    const left = (g.chainUntil - t) / 1.4;
    const s = 1 + Math.max(0, 0.3 - (1.4 - (g.chainUntil - t)) * 2);
    c.save();
    c.translate(W - 70, 66);
    c.scale(s, s);
    c.textAlign = "center";
    inked(c, `x${Math.min(8, g.chain)}`, 0, 0, 16, YELLOW, { line: 4, drop: 2 });
    c.font = `800 7px ${BODY}`;
    c.fillStyle = CREAM;
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.strokeText("CHAIN", 0, 14);
    c.fillText("CHAIN", 0, 14);
    c.restore();
    c.fillStyle = INK;
    c.fillRect(W - 96, 86, 52, 5);
    c.fillStyle = YELLOW;
    c.fillRect(W - 95, 87, 50 * left, 3);
    c.textAlign = "left";
  }

  // the Sea King's health, with a white trail that catches up
  const boss = g.boss;
  if (boss) {
    const bw = 260;
    const bx = (W - bw) / 2;
    const by = 56;
    card(c, bx, by, bw, 20, INK, 5, 2);
    c.fillStyle = "#5a1a24";
    c.fillRect(bx + 70, by + 5, bw - 76, 10);
    c.fillStyle = CREAM;
    c.fillRect(bx + 70, by + 5, (bw - 76) * clamp01(boss.shown / boss.maxHp), 10);
    c.fillStyle = boss.hp < boss.maxHp / 2 ? "#ff4d4d" : "#ff7a1a";
    c.fillRect(bx + 70, by + 5, (bw - 76) * clamp01(boss.hp / boss.maxHp), 10);
    c.fillStyle = YELLOW;
    c.font = `800 8px ${DISPLAY}`;
    c.fillText("SEA KING", bx + 8, by + 10.5);
  }

  // the Gatling button, for touch (and anyone who likes clicking)
  const bx = W - 44;
  const by = H - 44;
  const ready = g.bombs > 0 && g.gatling <= 0;
  c.fillStyle = INK;
  c.beginPath();
  c.arc(bx + 3, by + 3, 25, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = ready ? RED : "#8a7f86";
  c.beginPath();
  c.arc(bx, by, 25, 0, Math.PI * 2);
  c.fill();
  c.lineWidth = 2.4;
  c.strokeStyle = INK;
  c.stroke();
  drawFist(c, bx, by - 4, 1.4);
  c.fillStyle = CREAM;
  c.textAlign = "center";
  c.font = `800 6px ${BODY}`;
  c.fillText("GATLING", bx, by + 12);
  c.fillStyle = YELLOW;
  c.beginPath();
  c.arc(bx + 18, by - 18, 8, 0, Math.PI * 2);
  c.fill();
  c.lineWidth = 2;
  c.stroke();
  c.fillStyle = INK;
  c.font = `800 8px ${DISPLAY}`;
  c.fillText(String(g.bombs), bx + 18, by - 17.5);
  // its key, on a little keycap beside it (faded while there's no Gatling to fire)
  if (!TOUCH) {
    c.globalAlpha = ready ? 1 : 0.55;
    card(c, bx - 84, by - 9, 50, 18, CREAM, 4, 2);
    c.fillStyle = INK;
    c.font = `800 8px ${DISPLAY}`;
    c.fillText("SPACE", bx - 59, by + 0.5);
    c.globalAlpha = 1;
  }
  c.textAlign = "left";
  hotspots.push({ id: "strikeBomb", x: bx - 26, y: by - 26, w: 52, h: 52 });
  hotspots.push({ id: "strikePause", x: 18, y: 8, w: 380, h: 38 });
  hotspots.push({ id: "consoleExit", x: W - 66, y: 8, w: 56, h: 20 });
}

// Hazard tape across the screen while a Sea King is on its way
function drawWarning(c, g, t) {
  const k = clamp01((2.8 - g.warn) / 0.3) * clamp01(g.warn / 0.3);
  const y = H / 2 - 34;
  c.save();
  c.globalAlpha = k;
  c.fillStyle = "rgba(120,0,20,.35)";
  c.fillRect(0, y - 14, W, 96);
  [y - 14, y + 70].forEach((ty, i) => {
    c.save();
    c.beginPath();
    c.rect(0, ty, W, 12);
    c.clip();
    c.fillStyle = YELLOW;
    c.fillRect(0, ty, W, 12);
    c.fillStyle = INK;
    const off = (t * 80 * (i ? -1 : 1)) % 24;
    for (let x = -24 + off; x < W + 24; x += 24) {
      c.beginPath();
      c.moveTo(x, ty + 12);
      c.lineTo(x + 10, ty);
      c.lineTo(x + 20, ty);
      c.lineTo(x + 10, ty + 12);
      c.fill();
    }
    c.restore();
  });
  c.textAlign = "center";
  c.textBaseline = "middle";
  if (Math.floor(t * 4) % 2 === 0) inked(c, "⚠ WARNING ⚠", W / 2, y + 22, 26, RED);
  c.fillStyle = CREAM;
  c.font = `800 10px ${BODY}`;
  c.fillText("A SEA KING IS SURFACING", W / 2, y + 52);
  c.restore();
  c.textAlign = "left";
}

function drawTitle(c, g, t) {
  c.fillStyle = "rgba(10,14,40,.45)";
  c.fillRect(0, 0, W, H);
  // the Merry sails across behind the logo
  drawMerry(c, ((t * 50) % (W + 140)) - 70, 344, t, 0, 1);
  c.textAlign = "center";
  c.textBaseline = "middle";
  // a red ribbon, then the big word
  const bob = Math.sin(t * 2) * 3;
  c.save();
  c.translate(W / 2, 78 + bob);
  c.rotate(-0.04);
  card(c, -90, -14, 180, 26, RED, 4);
  c.fillStyle = CREAM;
  c.font = `800 13px ${DISPLAY}`;
  c.fillText("STRAW HAT", 0, 0);
  c.restore();
  c.save();
  c.translate(W / 2, 128 + bob);
  c.rotate(-0.04);
  inked(c, "STRIKE!", 0, 0, 46, YELLOW, { line: 8, drop: 5 });
  c.restore();
  c.fillStyle = CREAM;
  c.font = `700 10px ${BODY}`;
  c.fillText("the Going Merry vs the Marines", W / 2, 166);
  // how to play, on little cards
  const tips = [["MOVE", "←↑↓→ / WASD / mouse"], ["FIRE", "automatic!"], ["GATLING", "SPACE · clears bullets"], ["TOUCH", "drag to sail"]];
  tips.forEach(([head, body], i) => {
    const x = W / 2 - 250 + i * 128;
    card(c, x, 186, 116, 36, CREAM, 6);
    c.fillStyle = RED;
    c.font = `800 8px ${DISPLAY}`;
    c.fillText(head, x + 58, 198);
    c.fillStyle = INK;
    c.font = `600 8px ${BODY}`;
    c.fillText(body, x + 58, 212);
  });
  if (Math.floor(t * 2) % 2 === 0) inked(c, "PRESS SPACE OR TAP TO SET SAIL", W / 2, 246, 11, CREAM, { line: 4, drop: 2 });
  if (g.best) {
    c.fillStyle = YELLOW;
    c.font = `800 9px ${BODY}`;
    c.fillText(`BEST BOUNTY ${berries(g.best)}`, W / 2, 266);
  }
  c.textAlign = "left";
  // everyone's best, under the logo
  drawBoard(c, g, W / 2 - 110, 276, 220, { rows: 5, line: 13 });
}

// The bounty board: the best runs of everyone who's played, `rows` of them, with this run's
// place picked out
function drawBoard(c, g, x, y, w, { rows = BOARD_SIZE, mine = null, line = 16 } = {}) {
  const list = g.board.slice(0, rows);
  // as tall as what's on it: a line for a note when there's nothing yet
  const h = 30 + Math.max(1, g.boardState === "ready" ? list.length : 1) * line + 6;
  card(c, x, y, w, h, CREAM, 6);
  c.textBaseline = "middle";
  c.textAlign = "center";
  c.fillStyle = RED;
  c.beginPath();
  c.roundRect(x + w / 2 - 56, y + 8, 112, 14, 3);
  c.fill();
  c.fillStyle = CREAM;
  c.font = `800 8px ${DISPLAY}`;
  c.fillText("TOP BOUNTIES", x + w / 2, y + 15.5);
  if (g.boardState !== "ready" || !list.length) {
    c.fillStyle = INK;
    c.font = `600 8px ${BODY}`;
    const note = g.boardState === "loading" ? "Fetching the board..." : g.boardState === "offline" ? "The board is out at sea" : "No bounties yet. Be the first!";
    c.fillText(note, x + w / 2, y + 30 + line / 2);
    c.textAlign = "left";
    return;
  }
  list.forEach((row, i) => {
    const ry = y + 30 + i * line + line / 2;
    const own = mine && row.rank === mine;
    if (own) {
      c.fillStyle = YELLOW;
      c.fillRect(x + 6, ry - line / 2 + 1, w - 12, line - 2);
    }
    c.fillStyle = i < 3 ? RED : INK;
    c.textAlign = "left";
    c.font = `800 8px ${DISPLAY}`;
    c.fillText(`${row.rank}.`, x + 10, ry);
    c.fillStyle = INK;
    c.font = `700 8px ${BODY}`;
    c.fillText(String(row.name).slice(0, NAME_MAX), x + 28, ry);
    c.textAlign = "right";
    c.font = `800 8px ${BODY}`;
    c.fillText(berries(row.score), x + w - 10, ry);
  });
  c.textAlign = "left";
}

// What's happening to the name: asked for, refused, on its way or on the board
const REFUSED = {
  empty: "Type a name first.",
  long: `${NAME_MAX} characters at most.`,
  characters: "Letters, numbers and . _ - ' ! only.",
  words: "That one can't go on a poster.",
};
function drawEntry(c, g, t, hotspots) {
  const e = g.entry;
  const x = 434;
  const y = 70;
  const w = 182;
  const asking = e.state === "typing" || e.state === "refused";
  const head = {
    typing: "ON THE BOARD!",
    refused: "PICK ANOTHER NAME",
    sending: "POSTING...",
    posted: e.improved === false ? "YOUR BEST STANDS" : `#${e.rank} ON THE BOARD!`,
    offline: "BOARD OUT AT SEA",
  }[e.state];
  const body = {
    typing: ["This bounty makes the top ten.", `Type a name (${NAME_MAX} at most)`, "and press ENTER to post it."],
    refused: [REFUSED[e.reason] || "Try another name.", "Fix it and press ENTER."],
    sending: ["Nailing your poster up..."],
    posted: e.improved === false ? [`An older run of yours holds #${e.rank}.`, "It stays on the board."] : ["Every visitor can see it now."],
    offline: e.reason === "token" || e.reason === "score" ? ["This run couldn't be checked,", "so it stays off the board."] : ["Couldn't reach the board.", "Your best is kept on this desk."],
  }[e.state];
  const h = 50 + body.length * 13 + (asking ? 34 : 0);
  card(c, x, y, w, h, CREAM, 6);
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = e.state === "refused" || e.state === "offline" ? RED : INK;
  c.font = `800 12px ${DISPLAY}`;
  c.fillText(head, x + w / 2, y + 20);
  c.fillStyle = INK;
  c.font = `600 8px ${BODY}`;
  body.forEach((text, i) => c.fillText(text, x + w / 2, y + 42 + i * 13));
  if (asking) {
    const by = y + h - 30;
    [["POST", "strikePost", YELLOW, x + 14], ["SKIP", "strikeSkip", CREAM, x + w / 2 + 6]].forEach(([word, id, fill, bx]) => {
      const bw = w / 2 - 20;
      card(c, bx, by, bw, 20, fill, 4, 2);
      c.fillStyle = INK;
      c.font = `800 9px ${DISPLAY}`;
      c.fillText(word, bx + bw / 2, by + 10.5);
      hotspots.push({ id, x: bx, y: by, w: bw, h: 20 });
    });
  }
  c.textAlign = "left";
}

// Game over: a wanted poster with the bounty on it
function drawWanted(c, g, t, hotspots = []) {
  const k = clamp01((t - g.overAt) / 0.6);
  c.fillStyle = `rgba(10,14,40,${0.55 * k})`;
  c.fillRect(0, 0, W, H);
  c.save();
  c.translate(W / 2, 180 - (1 - easeOut(k)) * 260);
  c.rotate(-0.05 + (1 - k) * 0.3);
  const pw = 196;
  const ph = 252;
  card(c, -pw / 2, -ph / 2, pw, ph, "#f3e2b8", 3, 5);
  c.strokeStyle = "#8a5426";
  c.lineWidth = 1.5;
  c.strokeRect(-pw / 2 + 7, -ph / 2 + 7, pw - 14, ph - 14);
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = INK;
  c.font = `800 30px ${DISPLAY}`;
  c.fillText("WANTED", 0, -ph / 2 + 30);
  // the portrait: the Merry on a little sea
  c.save();
  c.beginPath();
  c.rect(-74, -ph / 2 + 50, 148, 92);
  c.clip();
  const sky = c.createLinearGradient(0, -ph / 2 + 50, 0, -ph / 2 + 142);
  sky.addColorStop(0, "#9fd3ff");
  sky.addColorStop(1, "#ffe6b8");
  c.fillStyle = sky;
  c.fillRect(-74, -ph / 2 + 50, 148, 92);
  c.fillStyle = "#3a9be8";
  c.fillRect(-74, -ph / 2 + 118, 148, 24);
  drawMerry(c, -6, -ph / 2 + 128, t, 0, 1);
  c.restore();
  c.lineWidth = 2;
  c.strokeStyle = INK;
  c.strokeRect(-74, -ph / 2 + 50, 148, 92);
  c.font = `800 10px ${BODY}`;
  c.fillText("DEAD OR ALIVE", 0, -ph / 2 + 156);
  // the name on the poster: the one being typed (with its caret), the last one posted, or the
  // crew's own
  const typing = g.entry && g.entry.state !== "posted" && g.entry.state !== "offline";
  const shown = g.entry ? g.entry.name : g.name;
  const label = (shown || (typing ? "YOUR NAME" : "STRAW HAT")).toUpperCase();
  c.font = `800 13px ${DISPLAY}`;
  const fit = Math.min(1, 150 / Math.max(1, c.measureText(label).width));
  c.font = `800 ${(13 * fit).toFixed(1)}px ${DISPLAY}`;
  c.globalAlpha = typing && !shown ? 0.45 : 1;
  c.fillText(label, 0, -ph / 2 + 176);
  c.globalAlpha = 1;
  if (typing) {
    const half = shown ? c.measureText(label).width / 2 : 0;
    // the box being typed into
    c.strokeStyle = RED;
    c.lineWidth = 1.5;
    c.setLineDash([4, 3]);
    c.strokeRect(-80, -ph / 2 + 166, 160, 20);
    c.setLineDash([]);
    if (g.hooks.caret?.() && shown) c.fillRect(half + 2, -ph / 2 + 169, 1.5, 14);
    hotspots.push({ id: "strikeName", x: W / 2 - 80, y: 180 - ph / 2 + 166 - 4, w: 160, h: 28 });
  }
  c.font = `800 17px ${DISPLAY}`;
  c.fillText(`${berries(g.score)}-`, 0, -ph / 2 + 202);
  c.font = `600 7px ${BODY}`;
  c.fillText(`reached stage ${g.stage}  ·  best ${berries(g.best)}`, 0, -ph / 2 + 222);
  c.font = `800 8px ${BODY}`;
  c.fillStyle = "#8a5426";
  c.fillText("MARINE", 0, ph / 2 - 16);
  // a red stamp for a new record
  if (g.newBest && k >= 1) {
    const s = 1 + Math.max(0, 0.6 - (t - g.overAt - 0.6) * 3);
    c.save();
    c.translate(56, -10);
    c.rotate(0.3);
    c.scale(s, s);
    c.strokeStyle = RED;
    c.lineWidth = 2.5;
    c.strokeRect(-40, -12, 80, 24);
    c.fillStyle = RED;
    c.font = `800 10px ${DISPLAY}`;
    c.fillText("NEW RECORD", 0, 1);
    c.restore();
  }
  c.restore();
  if (k >= 1) {
    drawBoard(c, g, 24, 70, 182, { mine: g.entry?.state === "posted" ? g.entry.rank : null });
    if (g.entry) drawEntry(c, g, t, hotspots);
  }
  if (k >= 1 && !typing && Math.floor(t * 2) % 2 === 0) {
    c.textAlign = "center";
    inked(c, "SPACE OR TAP TO SAIL AGAIN", W / 2, H - 28, 11, CREAM, { line: 4, drop: 2 });
  }
  c.textAlign = "left";
}

// The TV picture: boot, then the game
export function drawStrike(c, w, h, g, now, t0, hotspots) {
  const since = now - t0;
  c.fillStyle = "#05060a";
  c.fillRect(0, 0, w, h);
  if (since < STRIKE_BOOT) {
    // A wash of light rises, then the logo fades in with a soft glow
    const k = clamp01(since / 0.9);
    const glow = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
    glow.addColorStop(0, `rgba(70,110,255,${0.55 * k})`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = glow;
    c.fillRect(0, 0, w, h);
    c.globalAlpha = clamp01((since - 0.5) / 0.6) * (1 - clamp01((since - STRIKE_BOOT + 0.3) / 0.3));
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "#fff";
    c.font = `800 30px ${DISPLAY}`;
    c.fillText("▶ PLAY", w / 2, h / 2);
    c.globalAlpha = 1;
    c.textAlign = "left";
    return;
  }
  const t = g.t;
  c.save();
  if (g.shake > 0) c.translate(rand(-1, 1) * g.shake * 10, rand(-1, 1) * g.shake * 10);
  drawSea(c, g, t);
  // A hit flickers white, so a target under steady fire still shows its colours
  const flashOf = (e) => (e.flash > 0 && Math.floor(t * 24) % 2 === 0 ? () => CREAM : (col) => col);
  // back to front: the Sea King, then ships by how far down the sea they are
  g.enemies.filter((e) => e.kind === "seaking").forEach((e) => drawSeaKing(c, e, t, flashOf(e)));
  g.pickups.forEach((p) => drawPickup(c, p, t));
  const playing = g.state === "play";
  const boats = g.enemies.filter((e) => e.kind !== "seaking").sort((a, b) => a.y - b.y);
  let merryDrawn = !playing;
  boats.forEach((e) => {
    if (!merryDrawn && e.y > g.ship.y) {
      drawPlayer(c, g, t);
      merryDrawn = true;
    }
    const F = flashOf(e);
    if (e.kind === "gunboat") drawGunboat(c, e, t, F);
    else if (e.kind === "frigate") drawFrigate(c, e, t, F);
    else drawGull(c, e, t, F);
  });
  if (!merryDrawn) drawPlayer(c, g, t);
  g.shots.forEach((s) => drawShot(c, s, t));
  g.fx.forEach((p) => drawFx(c, p));
  g.bullets.forEach((b) => drawBullet(c, b, t));
  // floating words: scores, power ups, ouch
  c.textAlign = "center";
  c.textBaseline = "middle";
  g.pops.forEach((p) => {
    const k = p.life / p.max;
    c.save();
    c.translate(p.x, p.y - easeOut(Math.min(1, k * 2)) * 18);
    c.rotate(p.rot);
    c.scale(k < 0.15 ? backOut(k / 0.15) : 1, k < 0.15 ? backOut(k / 0.15) : 1);
    c.globalAlpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    inked(c, p.text, 0, 0, p.size, p.color, { line: 4, drop: 2 });
    c.restore();
  });
  c.textAlign = "left";
  // speed lines while the Gatling's going
  if (g.gatling > 0) {
    c.strokeStyle = "rgba(255,253,245,.7)";
    c.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const y = HORIZON + ((i * 61 + t * 900) % (H - HORIZON));
      const x = (i * 137 + t * 2400) % (W + 200) - 100;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 70, y);
      c.stroke();
    }
  }
  c.restore();
  if (g.flash > 0) {
    c.fillStyle = `rgba(255,253,245,${Math.min(0.8, g.flash * 2.5)})`;
    c.fillRect(0, 0, w, h);
  }

  if (g.state === "ready") {
    drawTitle(c, g, t);
    hotspots.push({ id: "strikeStart", x: 0, y: 0, w, h });
    card(c, W - 66, 8, 56, 20, INK, 5, 2);
    c.fillStyle = CREAM;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `800 8px ${BODY}`;
    c.fillText("✕ EXIT", W - 38, 18.5);
    c.textAlign = "left";
    hotspots.push({ id: "consoleExit", x: W - 66, y: 8, w: 56, h: 20 });
    return;
  }
  drawHud(c, g, t, hotspots);
  if (g.warn > 0) drawWarning(c, g, t);
  if (g.clear > 0) {
    const k = clamp01((3.2 - g.clear) / 0.4);
    c.save();
    c.translate(W / 2, H / 2 - 10);
    c.scale(backOut(k), backOut(k));
    c.rotate(-0.05);
    c.textAlign = "center";
    c.textBaseline = "middle";
    inked(c, "STAGE CLEAR!", 0, 0, 34, YELLOW, { line: 7, drop: 4 });
    c.restore();
    c.textAlign = "left";
  }
  if (g.paused) {
    c.fillStyle = "rgba(10,14,40,.5)";
    c.fillRect(0, 0, w, h);
    c.textAlign = "center";
    c.textBaseline = "middle";
    inked(c, "PAUSED", W / 2, H / 2 - 8, 30, CREAM, { line: 6, drop: 4 });
    c.fillStyle = CREAM;
    c.font = `700 10px ${BODY}`;
    c.fillText("P or tap the HUD to carry on", W / 2, H / 2 + 24);
    c.textAlign = "left";
  }
  if (g.state === "over") {
    // the whole screen first, so the poster's own buttons sit on top of it
    hotspots.push({ id: "strikeStart", x: 0, y: 0, w, h });
    hotspots.push({ id: "consoleExit", x: W - 66, y: 8, w: 56, h: 20 });
    drawWanted(c, g, t, hotspots);
  }
}

function drawPlayer(c, g, t) {
  // blinking while it can't be hurt; the hitbox shows as a small target on deck
  if (g.inv > 0 && Math.floor(t * 16) % 2 === 0) return;
  drawMerry(c, g.ship.x, g.ship.y, t, g.ship.tilt, g.power);
  const me = { x: g.ship.x + 2, y: g.ship.y - 12 };
  c.fillStyle = CREAM;
  c.strokeStyle = RED;
  c.lineWidth = 2;
  c.beginPath();
  c.arc(me.x, me.y, 3.2, 0, Math.PI * 2);
  c.fill();
  c.stroke();
}

// Keys while the console's on; true when used
export function strikeKey(g, e, down) {
  const dir = MOVE_KEYS[e.key];
  if (dir) {
    g.hold(dir, down);
    if (down && g.state !== "play" && !e.repeat && g.state === "ready") g.start();
    return true;
  }
  if (!down || e.repeat) return true;
  if (e.key === " " || e.key === "Enter" || e.key === "x" || e.key === "X" || e.key === "j" || e.key === "J") {
    if (g.state === "play") g.bomb();
    else g.start();
  } else if (e.key === "p" || e.key === "P") g.pause();
  return true;
}
