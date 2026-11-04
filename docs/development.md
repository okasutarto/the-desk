# Development reference

[← Back to README](../README.md#getting-started)

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite development server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm run check:desk` | Every desk check in turn, with a passed count at the end |
| `npm run check:app` | App checks outside the desk: safe chat formatting, theme storage fallback, the API's CORS allowlist and chat streaming, with no network calls |
| `npm run check:bundles` | Production build plus source/manifest checks that keep the 2D shell and PostHog out of the desk's eager imports |
| `npm run check:browser` | Build and run the Chromium/WebKit desktop and mobile smoke tests against the production preview |
| `node scripts/check-desk-lighting.cjs` | Time cycle, sky/light alignment, rain, transitions, strip lighting and shadow sampler limits |
| `node scripts/check-desk-quality.cjs` | Resolution, frame scheduling and decorative shadow budgets |
| `node scripts/check-desk-toon-batch.cjs` | Batching, transforms, visibility, picking and material fallbacks |
| `node scripts/check-desk-lightbar.cjs` | Task-light geometry, direction, output and night fade |
| `node scripts/check-desk-guitar-sword-lighting.cjs` | Lit guitar strings and independent sword focus lighting |
| `node scripts/check-desk-keyboard.cjs` | Keyboard layout, keycap geometry, picking, travel clearance and legend fitting |

Other `scripts/check-*.cjs` files exercise individual props, layout, scene wiring and audio.
Run one on its own with Node, or all of them with `npm run check:desk`, which keeps going past a
failure and exits non-zero if any failed.

These are focused Node checks, many of which execute extracted scene code with mocked
dependencies; they do not replace browser or device testing.

Install the browser test engines once with `npx playwright install chromium webkit`.
The suite in `tests/browser/` covers entry into the room, preference persistence across a
reload and a 3D → 2D → 3D round trip, terminal keyboard focus on desktop, classic deep links,
and 404 contrast in both themes. Tests use `?quality=low` to keep WebGL startup practical
on headless machines, without disabling shaders or the normal startup probe. The return
link from 2D follows the ordinary `/` route and uses the default quality selection.
Chromium uses its [new headless mode](https://playwright.dev/docs/browsers#chromium-new-headless-mode)
so WebGL is exercised in the full browser rather than headless shell. Third-party
requests are mocked or blocked, so tests do not send analytics, mail or chat requests.
Failure traces and screenshots are written to the ignored `test-results/` folder.

WebKit and device emulation are useful regression checks; full-quality rendering in actual
Safari and touch behavior on physical phones still need separate visual/device QA.

### Development previews and profiling

These phase/weather controls are **development-only**; open them on the dev server:

| URL | Preview |
| --- | --- |
| `/?time=morning` | Hold the morning phase |
| `/?time=day` | Hold midday |
| `/?time=evening` | Hold sunset |
| `/?time=night` | Hold the night phase |
| `/?time=day&rain=1` | Seed a fully rainy midday view; `rain` accepts 0–1 |
| `/?preview=trophy` | Preview the final secret discovery and trophy celebration without changing saved progress |
| `/?preview=secret` | Preview a discovery notification and its ding without changing saved progress; audio follows mute/autoplay settings |

Without a valid `time` preview, the room follows the visitor's clock (or the time picked in the
settings). A `rain` preview holds its level against the live weather; window knocks can still
change it.

Add `?perf` (or `&perf` to an existing query) for FPS, draw calls, triangles, CPU submission,
GPU timing when available, frame p95 and render density. For comparisons, reload with one
benchmark at a time: `?perf&bench=no-ao`, `no-shadows`, `no-pcss`, `no-batch`, `no-ao-cache` or `no-shadow-cache`.
Benchmark toggles isolate rendering costs; they do not change saved settings. Use a production
build for representative performance comparisons; development compilation and startup can skew
measurements. The `time`/`rain` previews themselves do not override production behaviour.
