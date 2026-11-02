# AGENTS.md

The Desk: a Vue 3 + Three.js portfolio where the site is a 3D room (`/`), with a classic
2D page at `/2d`. Read these before touching the code; don't duplicate them here:

- [docs/development.md](docs/development.md): scripts, checks, dev preview URLs, `?perf` profiling
- [docs/architecture.md](docs/architecture.md): folder layout and what owns what
- [src/features/desk3d/scene/README.md](src/features/desk3d/scene/README.md): scene factories, `runtime`, units, teardown

## Commands

Node 22. The dev server runs on port 8080 (`npm run dev`).

Before calling a change done, run what CI runs:

```bash
npm run lint
npm run check:app
npm run check:desk
npm run check:bundles
```

- A single desk check runs on its own: `node scripts/check-desk-<name>.cjs`.
- When you add or reshape a prop, add or update its `scripts/check-desk-*.cjs`; `check:desk`
  picks up every file matching that name automatically.
- `npm run check:browser` (Playwright, WebGL) is not in CI. Run it for changes to routing,
  startup, settings persistence or the 2D ↔ 3D round trip.
- Node checks can't see shader output, canvas drawing or camera moves. For visual changes,
  open the room in a browser (`?time=night`, `?time=day&rain=1` etc. hold a look) and look.

## Rules that are easy to break

- **Scene scale:** 1 unit = 10 cm. Some models use a local scale; go through `localToWorld`.
- **Teardown:** every listener, timer, tween and GPU resource added in the scene must be
  tracked via `runtime.core.track` or removed in `scene/lifecycle.js`.
- **Bundle split:** the desk must not eagerly import anything from `features/portfolio2d/`,
  `posthog-js` or `gsap/ScrollTrigger`. `check:bundles` enforces this.
- **Feature boundaries:** `src/shared/` and `src/data/` never import from `src/features/`.
- **Textures are painted in code** (canvas at runtime). Don't add image files for wood
  grain, prints or labels.
- **Pinned deps:** `three` (r161), `postprocessing` and `n8ao` versions are coupled. Don't
  bump one alone.
- `my-portfolio-api/` is a separate Node package with its own `package.json` and deploy.
- `src/data/` is personal content (CV, bio, projects). Don't rewrite it unless asked.

## Git

- Branch from `master` as `feat/…`, `fix/…`, `perf/…`; open a PR into `master`.
- Conventional commits with a scope, written as a plain sentence in British spelling:
  `feat(desk): stand a Divoom Times Gate 2 in front of the riser`,
  `fix(desk): round off the Joy-Con face buttons`. Common scopes: `desk`, `sfx`, `chat`,
  `readme`.
- User-visible features go in `README.md` too (the prop table, settings table and so on).
