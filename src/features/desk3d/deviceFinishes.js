// Painted approximations of product colourways, shared by the settings panel and the painted scene props.
// A keyboard with `shortcutInk` prints its shortcut legends in colour; the light caps keep plain ink.
export const DEVICE_FINISHES = {
  phone: {
    label: "Phone", default: "burgundy",
    finishes: {
      black: { name: "Black", shell: "#303136", trim: "#24252a" },
      silver: { name: "Silver", shell: "#e4e5e7", trim: "#c6c8cc" },
      glacier: { name: "Glacier", shell: "#b8d6e5", trim: "#8eb6cd" },
      burgundy: { name: "Burgundy", shell: "#922d40", trim: "#70202f" },
    },
  },
  keyboard: {
    label: "Keyboard", default: "obsidian",
    finishes: {
      ionic: { name: "Ionic White", homing: "#81bfc7", shell: "#e4e6e8", alpha: "#eeeeeb", modifier: "#a7afb4", alternate: "#a7afb4", escape: "#3eb493", enter: "#ef542e", space: "#f5cc24", ink: "#707a80", accentInk: "#ffffff" },
      obsidian: { name: "Obsidian Black", homing: "#81bfc7", shell: "#24262b", alpha: "#2a2c31", modifier: "#43464d", alternate: "#43464d", escape: "#5ec4a2", enter: "#f2603c", space: "#f5c22b", ink: "#c3c6cc", accentInk: "#f1eee5", shortcutInk: true },
      mojito: { name: "Mojito", homing: "#77a846", shell: "#c4d5ab", alpha: "#eeeede", modifier: "#b4d38f", alternate: "#b4d38f", escape: "#b4d38f", enter: "#eeeede", space: "#eeeede", ink: "#648e40", accentInk: "#648e40" },
      lagoon: { name: "Blue Lagoon", homing: "#86c7dc", shell: "#24518c", alpha: "#254a8c", modifier: "#64a9c5", alternate: "#64a9c5", escape: "#64a9c5", enter: "#64a9c5", space: "#254a8c", ink: "#b5d3e8", accentInk: "#e0edf3", shortcutInk: true },
      sakura: { name: "Sakura Fizz", homing: "#dc9258", shell: "#e4b0b5", alpha: "#f3eee4", modifier: "#d3949e", alternate: "#d3949e", escape: "#d3949e", enter: "#d3949e", space: "#f3eee4", ink: "#bc7a86", accentInk: "#fff1e9" },
    },
  },
  mouse: {
    label: "Mouse", default: "white",
    finishes: {
      black: { name: "Black", shell: "#27292d" },
      white: { name: "White", shell: "#ffffff" },
      magenta: { name: "Magenta", shell: "#dc287d" },
      red: { name: "Red", shell: "#e23c42" },
    },
  },
  // The chair's leatherette: `grain` paints the pebbled tile into the colour (dark leather), or
  // leaves it to bump the shading only, so a light leather stays clean rather than speckled.
  chair: {
    label: "Chair", default: "black",
    finishes: {
      black: { name: "Black", shell: "#35312e", grain: true, bump: 2.2 },
      white: { name: "White", shell: "#e9e9e5", grain: false, bump: 1.2 },
    },
  },
  // Shell for the white mouldings, seam for stitching and knurls, cap for the dial ends, ink for
  // the unlit earcup emblem and glow for the emblem and status LED once music plays.
  headset: {
    label: "Headset", default: "white",
    finishes: {
      white: { name: "White", shell: "#e9e9e5", seam: "#c4c7c7", cap: "#f0f0ec", ink: "#a7acb0", glow: "#5cf07a" },
      black: { name: "Black", shell: "#26282c", seam: "#3d4045", cap: "#55585d", ink: "#3fbf58", glow: "#5cf07a" },
      pink: { name: "Pink", shell: "#f3c6d5", seam: "#d9a0b5", cap: "#f8dbe5", ink: "#fbf3f6", glow: "#ff7fb8" },
      mint: { name: "Mint", shell: "#bfe2cf", seam: "#93c6ab", cap: "#daf0e4", ink: "#f3faf6", glow: "#6dffc4" },
    },
  },
};
