import { reactive, computed } from "vue";
import { DEVICE_FINISHES } from "../deviceFinishes";
import { TIMES_GATE_FINISHES, DEFAULT_TIMES_GATE_FINISH } from "../timesGateFinishes";
import { WOODS, WOOD_PATTERNS, PART_PATTERNS, WOOD_TARGETS, DEFAULT_WOODS, FLOOR_LAYOUTS, DEFAULT_FLOOR, FRAME_PAINTS, DEFAULT_FRAME_PAINT, BRICKS, DEFAULT_BRICK, DEFAULT_SLATS } from "../woods";
import { TIME_MODES, RAIN_MODES, DEFAULT_TIME, DEFAULT_RAIN } from "../daylight";

const SETTINGS_KEY = "desk-settings";
const DEFAULT_WALL = "#3a3a3a";
// The settings panel's groups, each tagged in one of the room's accent colours
export const SETTINGS_GROUPS = [
  { key: "sky", label: "Time & weather", icon: "☀️", accent: "#ffc900" },
  { key: "wall", label: "Wall", icon: "🧱", accent: "#ff90e8" },
  { key: "floor", label: "Floor", icon: "🟫", accent: "#ff7a45" },
  { key: "wood", label: "Furniture", icon: "🪵", accent: "#00e0c6" },
  { key: "devices", label: "Desk devices", icon: "⌨️", accent: "#7fb2ff" },
  { key: "timesgate", label: "Times Gate", icon: "▦", accent: "#b7a5ff" },
];
export const WALL_PAINTS = [
  { name: "White", hex: "#ffffff" },
  { name: "Greige", hex: "#e2ddd5" },
  { name: "Light grey", hex: "#d9d9d9" },
  { name: "Grey", hex: "#a6a6a6" },
  { name: "Dark grey", hex: "#8c8c8c" },
  { name: "Charcoal", hex: "#5c5c5c" },
  { name: "Graphite", hex: "#3a3a3a" },
];
// What's on the wall: the painted ones are drawn in greys that the paint colours; brick and
// wood slats come in their own clay or wood instead (see drawWallPaint)
export const WALL_PATTERNS = {
  plain: "Plain",
  brick: "Brick",
  subway: "Subway tile",
  slats: "Wood slats",
  stripes: "Stripes",
  hexagon: "Hexagon",
  checker: "Checkerboard",
  chevron: "Chevron",
  graph: "Graph paper",
  terrazzo: "Terrazzo",
  limewash: "Limewash",
};

// The picks are a per-visitor convenience: blocked or empty storage just means the default room
export function readSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    // no storage, or not ours: the default room it is
  }
  const pickWood = (part, choice) => {
    choice = choice && typeof choice === "object" ? choice : {};
    return {
      wood: WOODS[choice.wood] ? choice.wood : DEFAULT_WOODS[part].wood,
      // A cut the part is no longer offered in goes back to the part's own
      pattern: PART_PATTERNS[part].includes(choice.pattern) ? choice.pattern : DEFAULT_WOODS[part].pattern,
      // The finish is no longer offered in settings: a saved black model goes back to wood sides
      ...(part === "speakers" ? { finish: "wood" } : {}),
      ...(part === "window" ? { paint: /^#[0-9a-f]{6}$/i.test(choice.paint || "") ? choice.paint : DEFAULT_FRAME_PAINT } : {}),
    };
  };
  return {
    time: TIME_MODES[saved.time] ? saved.time : DEFAULT_TIME,
    rain: RAIN_MODES[saved.rain] ? saved.rain : DEFAULT_RAIN,
    deviceFinishes: Object.fromEntries(Object.entries(DEVICE_FINISHES).map(([part, device]) => [part,
      Object.hasOwn(device.finishes, saved.deviceFinishes?.[part]) ? saved.deviceFinishes[part] : device.default,
    ])),
    timesGateFinish: Object.hasOwn(TIMES_GATE_FINISHES, saved.timesGateFinish) ? saved.timesGateFinish : DEFAULT_TIMES_GATE_FINISH,
    wall: /^#[0-9a-f]{6}$/i.test(saved.wall || "") ? saved.wall : DEFAULT_WALL,
    wallPattern: Object.hasOwn(WALL_PATTERNS, saved.wallPattern) ? saved.wallPattern : "plain",
    wallBrick: Object.hasOwn(BRICKS, saved.wallBrick) ? saved.wallBrick : DEFAULT_BRICK,
    wallSlats: Object.hasOwn(WOODS, saved.wallSlats) ? saved.wallSlats : DEFAULT_SLATS,
    woods: Object.fromEntries(Object.keys(WOOD_TARGETS).map((part) => [part, pickWood(part, saved.woods?.[part])])),
    floor: {
      wood: WOODS[saved.floor?.wood] ? saved.floor.wood : DEFAULT_FLOOR.wood,
      layout: FLOOR_LAYOUTS[saved.floor?.layout] ? saved.floor.layout : DEFAULT_FLOOR.layout,
    },
  };
}

export function useDeskSettings(scene) {
  const settings = reactive(readSettings());
  const wallIsPreset = computed(() => WALL_PAINTS.some((paint) => paint.hex === settings.wall));
  const wallName = computed(() => WALL_PAINTS.find((paint) => paint.hex === settings.wall)?.name ?? "Custom");
  // The wall at a glance: its brick, its slats' wood, or its paint and pattern
  const wallLabel = computed(() => {
    if (settings.wallPattern === "brick") return BRICKS[settings.wallBrick].name;
    if (settings.wallPattern === "slats") return `${WOODS[settings.wallSlats].name} slats`;
    return settings.wallPattern === "plain" ? wallName.value : `${wallName.value}, ${WALL_PATTERNS[settings.wallPattern].toLowerCase()}`;
  });
  // What each closed group is set to, at a glance
  const groupSummary = computed(() => {
    const woods = new Set(Object.values(settings.woods).map((choice) => choice.wood));
    return {
      sky: `${settings.time === "auto" ? "Auto" : TIME_MODES[settings.time]}, ${settings.rain === "auto" ? "auto" : RAIN_MODES[settings.rain].toLowerCase()}`,
      wall: wallLabel.value,
      floor: `${WOODS[settings.floor.wood].name}, ${FLOOR_LAYOUTS[settings.floor.layout].toLowerCase()}`,
      wood: woods.size === 1 ? WOODS[[...woods][0]].name : "Mixed",
      devices: Object.entries(DEVICE_FINISHES).map(([part, device]) => device.finishes[settings.deviceFinishes[part]].name).join(" · "),
      timesgate: TIMES_GATE_FINISHES[settings.timesGateFinish].name,
    };
  });
  // A part's wood and cut at a glance (a painted one by its paint)
  function woodLabel(part) {
    const { wood, pattern, paint } = settings.woods[part];
    if (pattern === "painted") return `Painted, ${(FRAME_PAINTS.find((coat) => coat.hex === paint)?.name ?? "custom").toLowerCase()}`;
    return `${WOODS[wood].name}, ${WOOD_PATTERNS[pattern].toLowerCase()}`;
  }
  // Whether a swatch is dark enough that its tick should be drawn in white
  function isDarkColour(hex) {
    const n = parseInt(hex.slice(1), 16);
    return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 140;
  }
  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // no storage: the picks last this visit only
    }
  }
  function setWall(hex) {
    settings.wall = hex;
    scene.value?.setWallColor(hex);
    saveSettings();
  }
  // The pattern, a brick's clay and the slats' wood are kept apart, so going back to one finds
  // it as it was left
  function setWallPattern(pattern) {
    settings.wallPattern = pattern;
    scene.value?.setWallPattern({ pattern });
    saveSettings();
  }
  function setWallBrick(brick) {
    settings.wallBrick = brick;
    scene.value?.setWallPattern({ brick });
    saveSettings();
  }
  function setWallSlats(wood) {
    settings.wallSlats = wood;
    scene.value?.setWallPattern({ wood });
    saveSettings();
  }
  function setWood(part, choice) {
    Object.assign(settings.woods[part], choice);
    scene.value?.setWood(part, choice);
    saveSettings();
  }
  function setFloor(choice) {
    Object.assign(settings.floor, choice);
    scene.value?.setFloor(choice);
    saveSettings();
  }
  function setTime(mode) {
    settings.time = mode;
    scene.value?.setTime(mode);
    saveSettings();
  }
  function setRain(mode) {
    settings.rain = mode;
    scene.value?.setRain(mode);
    saveSettings();
  }

  function setDeviceFinish(part, finish) {
    if (!Object.hasOwn(DEVICE_FINISHES, part) || !Object.hasOwn(DEVICE_FINISHES[part].finishes, finish)) return;
    settings.deviceFinishes[part] = finish;
    scene.value?.setDeviceFinish(part, finish);
    saveSettings();
  }

  function setTimesGateFinish(finish) {
    if (!Object.hasOwn(TIMES_GATE_FINISHES, finish)) return;
    settings.timesGateFinish = finish;
    scene.value?.setTimesGateFinish(finish);
    saveSettings();
  }

  return { settings, wallIsPreset, wallName, groupSummary, woodLabel, isDarkColour, setWall, setWallPattern, setWallBrick, setWallSlats, setWood, setFloor, setTime, setRain, setTimesGateFinish, setDeviceFinish };
}
