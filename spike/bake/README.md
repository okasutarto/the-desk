# Bake spike

[← Back to README](../../README.md)

A first test of baking the room's light in Blender, from [the rebuild plan](../../docs/rebuild-plan.md).
A simplified corner of the room (floor, two walls with a window, the desk, riser, monitor,
bookcase with books, a mug and a laptop) is built by a script, its light is baked into
textures, and the same geometry is drawn in three.js two ways to compare the GPU cost.

Not part of the site: nothing under `src/` imports it, and `check:bundles` is unchanged.

## Run it

Needs Blender (`brew install --cask blender`; tested with 5.2.3 LTS).

```bash
npm run spike:bake
```

```bash
npm run spike:bake:view
```

Then open `http://localhost:8099/?mode=runtime` or `?mode=baked`, with `&time=night` for the
lamp. `&ao=0` turns N8AO off in runtime mode. The output in `out/` is not committed; the bake
rebuilds it in about 15 seconds.

## How it works

`bake_room.py` runs headless and:

1. Builds the corner from boxes and a cylinder, with bevels, in metres (Z up).
2. Joins everything into one mesh and unwraps one lightmap atlas with Smart UV Project.
3. Bakes with Cycles on the GPU (Metal), 512 samples, 1024 × 1024:
   - `lm_day`: the sun through the window plus a blue sky, light only (no surface colour)
   - `lm_night`: the desk lamp plus a dim sky, light only
   - `ao`: ambient occlusion, 35 cm reach
4. Saves the lightmaps as 8-bit PNG at a quarter of their value, sRGB-encoded, so sunlit
   patches above 1 aren't clipped and the dark end keeps its steps. three.js multiplies back by
   4 × π (`lightMapIntensity`).
5. Exports `room.glb`. three.js scales it by 10 to the room's units.

Colours stay in three.js, so a wood finish or a theme can still change without a new bake.

## Results

3 November 2026, Chromium via Playwright, Apple M5 Pro, 1440×900 @2x, three rounds each.
`runtime` redraws the shadow maps and works out N8AO every frame, as the room does while
something moves; `baked` has no shadow maps and no AO pass.

| | Runtime | Baked |
| --- | --- | --- |
| GPU per frame, day | 4.4–8.7 ms | 1.9–4.0 ms |
| GPU per frame, night | 4.4–7.2 ms | 2.0–4.0 ms |
| Draw calls | 27 (day), 49 (night) | 11 |
| Triangles drawn | 9k (day), 20k (night) | 4k |

Baked frames cost about half. Most of what's left is the composer's full-screen passes at 2×,
which don't depend on the scene; the scene here is 2,222 faces against the room's 1.1M
triangles, so in the room the shadow passes, which draw the geometry again for every light,
weigh far more.

| Criterion (rebuild plan) | Result |
| --- | --- |
| One command, no manual steps | Met: `npm run spike:bake` |
| GPU ≤ 10 ms for the same part | Met: 1.9–4.0 ms |
| One bake round under 5 minutes | Met: 15 s (the very first run took 2 min while Metal compiled its kernels) |
| Lightmaps ≤ 1 MB in all | Met with WebP q85: 117 KB (PNG: 2.0 MB; JPEG q85: 498 KB). WebP quality not yet checked by eye |

The baked light also bounces: the sun patch lights the wall and the underside of the desk,
which the runtime room fakes with fill lights.

## Not covered yet

- **The toon look.** Left for later on purpose; the lightmap feeds three's indirect light, so
  it isn't stepped by the toon ramp.
- **Two UV sets.** Here the lightmap atlas is the only UV map. Real props keep their texture UVs
  as UV0, so the export has to carry the atlas as UV1 (`texture.channel = 1` in three.js).
- **Moving props.** The cat, chair and papers still need a small runtime shadow map, cast onto
  baked surfaces.
- **Day ↔ night blending,** rain, and the lamp switching on and off: two lightmaps blended in the
  shader, by the lamp's level.
- **KTX2.** `toktx` isn't installed; WebP saves download size but not GPU memory.
- **Texel density.** Smart UV Project gives the walls and floor most of the atlas; small props
  get few texels.
- **Matching light.** The runtime sun and the baked sun don't point quite the same way, so the
  screenshots differ in light, not in framing.
