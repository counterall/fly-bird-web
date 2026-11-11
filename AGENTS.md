# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

**Updraft**: a one-button arcade game played in the browser as a static single-page app, published to GitHub Pages. You fly a magpie through gaps between dusk-lit stone pillars. Space / ↑ / W / click / tap flaps, gravity pulls down, and P / Esc pauses. The game also pauses itself when the tab loses focus or is hidden. The best score is kept in `localStorage` (`updraft:best`).

It has original art and an original name. Keep it that way, and don't copy the look, name or assets of any existing game.

There is no build step and there are no runtime dependencies. `web/` is served as-is, as native ES modules.

## Layout

| File | Role |
|---|---|
| `web/index.html` | Page shell: the full-window canvas, page styles and the favicon. |
| `web/main.js` | Entry point: fits the 2:3 playfield to the window, runs the rAF loop, handles input, saves the best score. |
| `web/render.js` | Canvas renderer: sky, parallax hills, pillars, the magpie (with wing-beat animation), and the overlays. Colours are at the top. |
| `web/game.js` | Pure game model (physics, pillars, scoring, collisions) on a fixed 400×600 logical field. No DOM. Tuning lives in `CFG`. |
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
- Visual sizes, like the magpie's `c.scale(1.3)`, are independent of the collision radius `CFG.birdR`. Only the body collides, not the tail.
- GitHub Pages must be set to **Source: GitHub Actions** in the repo settings, under Pages.
