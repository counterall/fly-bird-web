# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

**Updraft**: a one-button arcade game played in the browser as a static single-page app, published to GitHub Pages. You fly a magpie through gaps between dusk-lit stone pillars. Space / ↑ / W / click / tap flaps, gravity pulls down, P / Esc pauses, and M (or the speaker button, top right) mutes. The title screen has an Easy | Normal | Hard toggle (← / → to step, or 1 / 2 / 3), which is remembered. Easy starts with 1 life: gold rings (trinkets) near the pillar caps give +1 life each, up to 3. Normal is the classic game: one life, steady pillars, nothing extra. Hard has one life and no pickups, from the 6th pillar the gaps drift up and down, and from the 13th, updrafts (columns of rising air) sit before every 3rd pillar. After a crash, a tap goes back to the title screen. The game also pauses itself when the tab loses focus or is hidden. Runs earn bronze, silver and gold medals at 10, 25 and 50 points, and the sky turns from dusk to night as a run goes on. The level, the best score per level and the mute setting are kept in `localStorage` (`updraft:level`, `updraft:best:easy`, `updraft:best:normal`, `updraft:best:hard`, `updraft:muted`). The best score from before levels existed (`updraft:best`) is moved to normal, which plays the same.

It has original art and an original name. Keep it that way, and don't copy the look, name or assets of any existing game.

There is no build step and there are no runtime dependencies. `web/` is served as-is, as native ES modules.

## Layout

| File | Role |
|---|---|
| `web/index.html` | Page shell: the full-window canvas, page styles, and the icon and manifest links. |
| `web/*.png`, `web/manifest.webmanifest` | Home-screen icons (iOS uses `apple-touch-icon.png`, and ignores SVG) and the web app manifest. The PNGs are generated: see Notes. |
| `tools/icons.html` | Icon generator: draws each icon with `drawIcon()` from `web/render.js`. |
| `web/main.js` | Entry point: fits the 2:3 playfield to the window, runs the rAF loop, handles input, triggers sounds, saves the best score and mute setting. |
| `web/render.js` | Canvas renderer: sky, parallax hills, pillars, the ground, the magpie's flight pose (wing beat, tilt), the overlays, and `drawIcon()`. Colours are at the top. |
| `web/magpie.js` | The magpie sprite (`paintMagpie`), drawn with canvas paths. Used by the renderer and the icons. |
| `web/sound.js` | Sound effects synthesised with WebAudio (no audio files). Audio only starts after a user gesture, so input handlers call `unlock()`. |
| `web/game.js` | Pure game model (physics, pillars, gap placement, scoring, medals, collisions) on a fixed 400×600 logical field. No DOM. Tuning lives in `CFG`. |
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
- **Phase vs level:** `g.phase` is the run's state (`ready` / `playing` / `over`), and `g.level` is the difficulty (`easy` / `normal` / `hard`, see `LEVEL` and `LEVELS`). The toggle, its hit-testing and the keys work for any number of levels. A run keeps its level, and the level can only change on the title screen.
- **Levels:** per-level settings are in `LEVEL` (game.js). A hit with a life to spare doesn't end the run: the bird becomes a `ghost`, passes through pillars and hops off the ground, and turns solid again once `CFG.ghostTime` is up and it's clear of every pillar. Trinkets only spawn while a life can still be gained. Drifting pillars (hard) swing ± `drift` around `baseY`; `gapY` is updated each step, so collisions and drawing just read it. A drifting gap is placed with room to swing inside the edges, its drift is taken off the allowed jump from the previous pillar, and calm stretches don't drift. Updrafts (`g.drafts`, hard) are moving air: inside one, the bird is carried up by `draftRise()` on top of its own flight, so `vy` and flaps are untouched. They sit midway between two pillars and skip calm stretches.
- **Gap placement:** each gap can move at most `shiftFor()` from the previous one, an amount that grows with the score. After every 10th pillar comes a calm stretch of 3 pillars whose gaps barely move.
- **Icons:** after changing `drawIcon()` or `web/magpie.js`, regenerate the PNGs. Run `python3 -m http.server` in the repo root, open `/tools/icons.html`, and save each PNG into `web/`. Keep the icons full-bleed with no transparency, because iOS rounds the corners itself.
- GitHub Pages must be set to **Source: GitHub Actions** in the repo settings, under Pages.
