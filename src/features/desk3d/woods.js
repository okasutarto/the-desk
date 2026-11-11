// The woods the desk, its monitor riser, the window frame and the game shelf can be made of,
// and the grain each can be cut in. Kept free of three.js so the page's settings panel can
// list them without pulling the scene into its bundle.
//
// `tones` are the boards' base colours, `grain` the grain lines' darkest RGB, `dark`/`light`
// the growth bands, `vein` the gum streaks and `glue` the joints between boards. `tint` is
// the colour the wood's materials are toned by: oak keeps the warm tint the room was built
// with, the rest are painted as they read and left untinted.
export const WOODS = {
  oak: {
    name: "Oak",
    tones: ["#cf9459", "#c4864c", "#d69f65", "#c98d52", "#d29a5f"],
    grain: [90, 44, 14],
    dark: "120, 62, 22",
    light: "255, 220, 170",
    vein: "28, 16, 8",
    glue: "70, 36, 12",
    tint: "#f3d3b0",
    swatch: "#d9a878",
  },
  maple: {
    name: "Maple",
    tones: ["#ecd3ad", "#e6caa0", "#f0d9b6", "#e9cea6", "#eed5b0"],
    grain: [170, 120, 70],
    dark: "160, 110, 60",
    light: "255, 245, 225",
    vein: "120, 80, 40",
    glue: "150, 110, 70",
    tint: "#ffffff",
    swatch: "#ecd3ad",
  },
  ash: {
    name: "White ash",
    tones: ["#d8d2c8", "#cfc8bd", "#ddd7cd", "#d2cbc0", "#d9d3c9"],
    grain: [110, 100, 88],
    dark: "100, 90, 78",
    light: "255, 252, 245",
    vein: "70, 62, 54",
    glue: "120, 110, 98",
    tint: "#ffffff",
    swatch: "#d8d2c8",
  },
  cherry: {
    name: "Cherry",
    tones: ["#b9643f", "#ad5a37", "#c36e48", "#a8553a", "#b8623f"],
    grain: [80, 30, 14],
    dark: "90, 34, 14",
    light: "240, 170, 130",
    vein: "40, 14, 6",
    glue: "70, 26, 10",
    tint: "#ffffff",
    swatch: "#b9643f",
  },
  walnut: {
    name: "Walnut",
    tones: ["#6e4a32", "#634229", "#77513a", "#5d3d27", "#6a472f"],
    grain: [40, 24, 14],
    dark: "30, 18, 10",
    light: "170, 120, 80",
    vein: "20, 12, 6",
    glue: "25, 15, 8",
    tint: "#ffffff",
    swatch: "#6e4a32",
  },
  ebony: {
    name: "Ebony stain",
    tones: ["#3a2c26", "#33261f", "#41322b", "#2f231d", "#3c2e27"],
    grain: [15, 10, 8],
    dark: "10, 6, 4",
    light: "120, 95, 80",
    vein: "0, 0, 0",
    glue: "10, 6, 4",
    tint: "#ffffff",
    swatch: "#3a2c26",
  },
};

export const WOOD_PATTERNS = {
  planks: "Planks",
  cathedral: "Cathedral",
  knotty: "Knotty",
  butcher: "Butcher block",
  quartersawn: "Quartersawn",
  bamboo: "Bamboo",
  painted: "Painted",
  plywood: "Plywood",
};

// The cuts each part can be made in, as such a piece is made: a speaker's sides are a thin
// veneer, a window frame is never glued up from strips, and only a riser comes in bamboo
export const PART_PATTERNS = {
  desk: ["planks", "cathedral", "knotty", "butcher", "quartersawn"],
  riser: ["planks", "cathedral", "butcher", "bamboo"],
  speakers: ["planks", "cathedral"],
  window: ["planks", "knotty", "painted"],
  shelf: ["planks", "cathedral", "knotty", "plywood"],
};

export const SPEAKER_FINISHES = {
  // The Edifier S1000MKIII's wood sides on a black box, or all black (the sides' grain stained
  // dark). `baffle` is the leather wrapped over the front, top and back, `shell` the box's ends
  // hidden in the panels. Both a shade lighter than the real black, so the toon shading still
  // shows the shapes.
  wood: { name: "Wood sides", color: null, shell: "#3a3b3f", baffle: "#45464b" },
  black: { name: "Black", color: "#3a3532", shell: "#2a2b2e", baffle: "#36373b" },
};

// A painted window frame's coats, and the one it starts in
export const FRAME_PAINTS = [
  { name: "White", hex: "#f4f1ea" },
  { name: "Black", hex: "#2b2b2b" },
  { name: "Sage", hex: "#9bab8f" },
  { name: "Navy", hex: "#2f3e5c" },
  { name: "Terracotta", hex: "#c0694a" },
  { name: "Butter", hex: "#efd27a" },
];
export const DEFAULT_FRAME_PAINT = FRAME_PAINTS[0].hex;

// A brick wall comes in its own clay, not the wall's paint: `tones` are the bricks' faces (each
// brick takes one), `mortar` the joints between them
export const BRICKS = {
  red: { name: "Red brick", tones: ["#a4503a", "#9e4b36", "#aa553e", "#9a4934", "#a24e38"], mortar: "#cfc6b8" },
  old: { name: "Old brick", tones: ["#87583d", "#815339", "#8d5d41", "#7c5037", "#85563b"], mortar: "#b9ad9c" },
  whitewashed: { name: "Whitewashed", tones: ["#e3d9cd", "#ddd2c5", "#e7ded3", "#d9cdbf", "#e1d6ca"], mortar: "#f2ede6" },
  white: { name: "Painted white", tones: ["#f4f2ee", "#efece7", "#f7f5f1", "#ebe8e2", "#f2f0eb"], mortar: "#dedad3" },
  charcoal: { name: "Charcoal", tones: ["#4a4744", "#423f3c", "#524e4a", "#3c3936", "#4d4946"], mortar: "#2c2a28" },
};
export const DEFAULT_BRICK = "red";
export const DEFAULT_SLATS = "walnut";

export const WOOD_TARGETS = {
  desk: "Desk",
  riser: "Monitor riser",
  speakers: "Speakers",
  window: "Window frame",
  shelf: "Game shelf",
};

// Each part's wood until the visitor picks another, and the one its grain is first drawn in
export const DEFAULT_WOODS = {
  desk: { wood: "cherry", pattern: "butcher" },
  riser: { wood: "cherry", pattern: "cathedral" },
  speakers: { wood: "cherry", pattern: "planks", finish: "wood" },
  window: { wood: "cherry", pattern: "planks" },
  shelf: { wood: "cherry", pattern: "planks" },
};

// The floor is any of the same woods, laid in one of these
export const FLOOR_LAYOUTS = {
  planks: "Planks",
  herringbone: "Herringbone",
  parquet: "Parquet",
};

// The floor until the visitor picks another, and the one it is first drawn in
export const DEFAULT_FLOOR = { wood: "oak", layout: "planks" };
