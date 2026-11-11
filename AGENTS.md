# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

**Updraft**: a one-button arcade game played in the browser as a static single-page app, published to GitHub Pages. You fly a magpie through gaps between dusk-lit stone pillars. Space / ↑ / W / click / tap flaps, gravity pulls down, and P / Esc pauses. The game also pauses itself when the tab loses focus or is hidden. The best score is kept in `localStorage` (`updraft:best`).

It has original art and an original name. Keep it that way, and don't copy the look, name or assets of any existing game.

There is no build step and there are no runtime dependencies. `web/` is served as-is, as native ES modules.

## Layout

| File | Role |
|---|---|
| `web/index.html` | Page shell: the full-window canvas, page styles, and the icon and manifest links. |
| `web/*.png`, `web/manifest.webmanifest` | Home-screen icons (iOS uses `apple-touch-icon.png`, and ignores SVG) and the web app manifest. The PNGs are generated: see Notes. |
| `tools/icons.html` | Icon generator: draws each icon with `drawIcon()` from `web/render.js`. |
| `web/main.js` | Entry point: fits the 2:3 playfield to the window, runs the rAF loop, handles input, saves the best score. |
| `web/render.js` | Canvas renderer: sky, parallax hills, pillars, the ground, the magpie's flight pose (wing beat, tilt), the overlays, and `drawIcon()`. Colours are at the top. |
| `web/magpie.js` | The magpie sprite (`paintMagpie`), drawn with canvas paths. Used by the renderer and the icons. |
| `web/game.js` | Pure game model (physics, pillars, gap placement, scoring, collisions) on a fixed 400×600 logical field. No DOM. Tuning lives in `CFG`. |
| `test/game.test.js` | `node --test` for the game model. |
| `.github/workflows/pages.yml` | On every push to `main`: run the tests, then deploy `web/` to GitHub Pages. |

## Commands

```sh
npm test     # node --test, no install needed
npm start    # serve web/ at http://localhost:8080
```

## Notes

- Files must be served over HTTP, because ES modules don't load from `file://`.
- The renderer draws in logical units: `main.js` sets the transform to scale 400×600 to the canvas's device pixels.
- Visual sizes, like the magpie's `MAGPIE_SCALE` in `render.js`, are independent of the collision radius `CFG.birdR`. Only the body collides, not the tail.
- **Gap placement:** each gap can move at most `shiftFor()` from the previous one, an amount that grows with the score. After every 10th pillar comes a calm stretch of 3 pillars whose gaps barely move.
- **Icons:** after changing `drawIcon()` or `web/magpie.js`, regenerate the PNGs. Run `python3 -m http.server` in the repo root, open `/tools/icons.html`, and save each PNG into `web/`. Keep the icons full-bleed with no transparency, because iOS rounds the corners itself.
- GitHub Pages must be set to **Source: GitHub Actions** in the repo settings, under Pages.
