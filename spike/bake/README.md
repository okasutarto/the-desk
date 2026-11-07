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

## The existing room: a baked shadow mask

The second spike bakes the room as it is, without rebuilding anything. It bakes only where each
key light's shadow falls, not the light itself: the room's lights still shine at runtime through
the toon ramp, at whatever colour and strength the hour gives them, and the bake stands in for
their shadow maps and for N8AO. Unity's toon pipelines recommend the same split ("shadowmask").

1. `?bake=export` (development only, `src/features/desk3d/bakeSpike.js`) lists the room's static
   meshes once you're in the room, and `export_room.cjs` saves their triangles in world space and
   where the sun, the window light and the desk lamp stand:

   ```bash
   npx vite --port 8100
   ```

   ```bash
   node spike/bake/export_room.cjs http://localhost:8100 day
   ```

2. `bake_existing.py` builds the lit meshes as one object and the rest as another, welds them,
   unwraps one atlas, and bakes `shadow.png` (R sun, G window, B lamp) and `ao.png` (16 cm reach):

   ```bash
   blender --background --factory-startup --python spike/bake/bake_existing.py -- spike/bake/existing-out
   ```

3. `?bake=apply&perf&bench=no-batch&time=day`, then `window.__bake.apply()` once in the room,
   gives each lit mesh its atlas coordinates, patches its material to multiply each key light by
   its mask channel and the diffuse light by the AO, and turns the shadow maps and N8AO off.

### Results

3 November 2026, the dev server, Chromium via Playwright, Apple M5 Pro, 1440×900 @2x, midday,
the mouse sweeping so every frame is drawn, both without the toon batches:

| Round | Normal (shadow maps + N8AO) | Baked mask |
| --- | --- | --- |
| 1 | 54.6 ms GPU · 27 fps | 28.0 ms · 35 fps |
| 2 | 26.0 ms · 45 fps | 16.9 ms · 55 fps |
| 3 | 24.9 ms · 44 fps | 16.6 ms · 55 fps |
| Draw calls, triangles | ~4,700 · ~1.7M | 3,127 · 1.0M |

About a third less GPU time per frame. The room reads the same at a glance: the desk, shelf,
chair and window shadows are where they were.

| | |
| --- | --- |
| Exported | 1,989 meshes (1,754 lit), 614k triangles |
| Bake | 136 s at 4096² (shadows 32 samples, AO 256), on the GPU |
| Files | `shadow.png` 11.4 MB, `ao.png` 7.0 MB (WebP q90: 2.4 MB and 1.5 MB); `uvs.bin` 14 MB |

What it took to get there:

- **Bake one object, not 1,754.** Cycles bakes object by object, each pass over the whole atlas:
  separately, one light ran over 20 minutes without finishing. Joined, it takes 30–45 s.
- **Turn the denoiser off.** It ran on the CPU over the whole 4096² atlas after every bake, for
  most of an hour. A mask needs no denoising; AO gets more samples instead.
- **Weld before unwrapping.** Every exported triangle has its own corners, so unwelded each was an
  island, and half a million islands' margins left 3% of the atlas for the room.
- **Shrink the floor and walls.** They're planes 10–20 m across, 97% of the lit area; their atlas
  share is cut to a fifth across.
- **Save without alpha.** An RGBA save divided the shadows by the AO in alpha and blew them to white.

### Still wrong or missing

- **The sword rack** stays darker and grainier than the runtime room, and so does the wall behind
  it; soft shadows at 32 samples are noisy there.
- **Moving props, hybrid.** The chair, cat, mouse, hat, badge, lamp, papers, notes, folders,
  tickets, postcard and robot (82 props, 381 meshes) are now left out of the bake and still cast
  through the shadow maps, which hold nothing else. Moved 60 cm by hand, the chair takes its
  shadow along and leaves none behind. But the saving is nearly gone: 21.7–22.8 ms against the
  normal room's 22.4–26.0 ms. Every lit surface still filters the shadow maps (PCSS) per pixel,
  and that filtering, not drawing the maps, was most of what the full bake saved.
- **Moving props, blob shadows.** So the shadow maps go off entirely again, and the props that
  stand on something (16: the chair, cat, mouse, lamp, robot, postcard, folders, tickets, papers)
  get a fake shadow as Bruno Simon's 2019 folio has them: a soft dark patch found by a ray down
  to the level surface under the prop, turned with it, pushed away from the window light (the
  lamp at night) by its height, and faded as it's lifted. The saving is back: 14.9–16.4 ms
  against the normal room's 21.6–22.7 ms over three rounds, CPU 11 → 9 ms. The hat, badge and
  notes on the wall get no shadow at all, and a blob is the prop's footprint, not its outline.
- **One hour only.** The sun and the window light move with the part of the day; each needs a mask.
- **The toon batches** copy their parts' geometry before the mask arrives, so the spike runs
  without them; they would need to carry the atlas coordinates.
- **Download size.** The atlas coordinates (14 MB as floats) and two 4096² masks are far over a
  budget; 16-bit coordinates, a smaller atlas for the walls and KTX2 would all be needed.
- **Production.** `?bake` exists only on the dev server; nothing here ships.

## Not covered yet by the first spike

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
