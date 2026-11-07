# Desk scene

`../deskScene.js` assembles one scene instance. Each factory in this folder owns
its prop's construction, animation state and interaction handlers. Renderer and
shared mesh helpers are initialized in `core.js`; `camera.js`, `pointer.js`,
`touch.js`, `theme.js` and `animation.js` coordinate the props.

World-space dimensions use **1 unit = 10 cm**. The desk is 180 × 84 × 74 cm;
the TITAN Evo Regular seat is 52 cm high. Some detailed models use local modelling dimensions
with a uniform group scale (monitor, shelving and its contents, guitar). Use
`localToWorld` or the group scale for camera targets, clearance and world heights.

Factories receive the same scene-local `runtime` object. Access another part
through its namespace, for example `runtime.keyboard.pressKey(code)`. Return only
state or functions needed by other parts. A getter exposes a changing local
binding; add a setter only if another part must assign it. Avoid destructuring
these live bindings into a stale local snapshot.

The assembly order in `deskScene.js` follows the original construction order.
Callbacks may use parts initialized later, but construction code must only read
parts already initialized. `animation.start()` runs after the animation API has
been published, so the first resize can read the camera and render state.

Lights are created once and kept: to switch one off, set its intensity to 0 rather than
removing it or hiding it. The light count is compiled into every lit shader, so adding or
removing one recompiles them all (a freeze of seconds on Windows), while a light at zero, or
out of a surface's reach, is skipped in the shader and costs nothing (see `sceneShaders.js`).
The same goes for `castShadow`, which follows the shadow budget in `animation.js`.

A canvas whose pixels are read back (`getImageData`) every redraw takes
`canvasTexture(w, h, { willReadFrequently: true })`, so it stays in memory: reading a GPU
canvas makes the frame wait for the GPU. Keep such canvases small.

Track disposable Three.js resources through `runtime.core.track`. Keep teardown
in `lifecycle.js` synchronized with added listeners, timers, tweens and resources.
Remove listeners with the original function reference.

Run `npm run check:desk` for the geometry, interaction, rendering and wiring
checks, then `npm run build`. Older VM checks read an assembled source view from
`scripts/helpers/desk-source.cjs`; it is generated from these factories at test
time. `check-desk-scene-wiring.cjs` checks the module APIs and exercises the actual
input factory separately from that source view. It also checks that direct reads
during factory construction only access parts already published by the entry point.
Deferred callbacks are checked for API names, but their invocation order still
needs interaction testing in the browser.

The monitor desktop is assembled by `../desktop.js`. Its canvas primitives,
appearance, Spotifree, code editor and Snake live in `../desktop/`; those modules
do not import the desktop coordinator. Room preference parsing, reactive labels
and scene updates belong to `../composables/useDeskSettings.js`.

After changing these modules, open the room, enter the monitor, open its apps,
and change a room setting before returning to `/2d`. VM checks cannot verify
shader output, real canvas drawing, camera transitions or route teardown.
