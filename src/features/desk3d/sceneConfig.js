export const PALETTES = {
  // The shelf's oak tone, so the desk, the riser, the shelf and the window frame read as one set
  light: { desk: "#f3d3b0", shadow: "#000000" },
  // Night: the same wood, dimmed, so it still reads against the dark page
  dark: { desk: "#bb9998", shadow: "#000000" },
};
// Props that stand for a section of the 2D site
export const SECTIONS = ["hero", "about", "experience", "projects", "contact"];
export const perfParams = new URLSearchParams(window.location.search);
export const benchmark = perfParams.has("perf") ? perfParams.get("bench") : null;
// `?perf&ucache=0` re-sends identical matrix-array uniforms, as three does by default (see core).
// Separate from `bench`, so it combines with one (`?perf&bench=no-ao&ucache=0`).
export const uniformCache = !(perfParams.has("perf") && perfParams.get("ucache") === "0");
// Phones and tablets get a lighter room: fewer pixels, no ambient occlusion, no decorative
// shadows, fewer soft-shadow samples and a slower idle refresh. `?quality=low|high` forces either.
const quality = perfParams.get("quality");
export const lowPower = quality === "low" || (quality !== "high" && window.matchMedia("(pointer: coarse)").matches);

// Smallest area of the scene that always stays in view (world units)
export const VIEW_W = 21.5;
export const VIEW_H = 14.5;
