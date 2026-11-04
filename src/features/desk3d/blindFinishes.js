// The roller blind's cloth, shared by the settings panel and the painted blind (drawBlindCloth).
// Every print is painted in the cloth's own colour, a shade lighter or darker, so any colour,
// picked or custom, gives a matching print.
export const BLIND_PATTERNS = {
  plain: "Plain",
  stripes: "Stripes",
  pinstripe: "Pinstripe",
  gingham: "Gingham",
  dots: "Polka dots",
  zigzag: "Zigzag",
  leaves: "Leaves",
};
export const BLIND_COLOURS = [
  { name: "Cool grey", hex: "#a4aab3" },
  { name: "Linen", hex: "#e4d8c0" },
  { name: "Sage", hex: "#a7b996" },
  { name: "Dusty blue", hex: "#8fa6c2" },
  { name: "Blush", hex: "#e2adae" },
  { name: "Mustard", hex: "#d8ae45" },
  { name: "Terracotta", hex: "#c6714f" },
  { name: "Charcoal", hex: "#4a4e57" },
];
export const DEFAULT_BLIND = { pattern: "plain", colour: "#a4aab3" };
