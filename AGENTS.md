# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

**Updraft**: a one-button arcade game played in the browser as a static single-page app, published to GitHub Pages. You fly a magpie through gaps between dusk-lit stone pillars. Space / ↑ / W / click / tap flaps, gravity pulls down, P / Esc pauses, and M mutes. The top-right corner of the screen holds a pause button during a run, nothing while the run is paused (a tap anywhere resumes), and a gear otherwise. The gear opens a settings panel with sound On | Off and the theme, Purple (the original dusk look) or Classic (daytime: blue sky, white clouds, sandstone pillars with mossy green caps, an all-green grassy ground with flowers, and a yellow magpie). The settings open only outside a run (title or Grounded screen). The title screen has an Easy | Normal | Hard toggle (← / → to step, or 1 / 2 / 3), which is remembered. Easy starts with 1 life: gold rings (trinkets) near the pillar caps give +1 life each, up to 3. Normal is the original game: one life, steady pillars, nothing extra. Hard has one life and no pickups, from the 6th pillar the gaps drift up and down, and from the 13th, updrafts (columns of rising air) sit before every 3rd pillar. After a crash, a tap goes back to the title screen. The game also pauses itself when the tab loses focus or is hidden. Runs earn bronze, silver and gold medals at 50, 150 and 500 points, and the sky turns from dusk to night as a run goes on. The level, the best score per level, the mute setting and the theme are kept in `localStorage` (`updraft:level`, `updraft:best:easy`, `updraft:best:normal`, `updraft:best:hard`, `updraft:muted`, `updraft:theme`). The best score from before levels existed (`updraft:best`) is moved to normal, which plays the same.

It has original art and an original name. Keep it that way, and don't copy the look, name or assets of any existing game.

There is no build step and there are no runtime dependencies. `web/` is served as-is, as native ES modules.

## Layout

| File | Role |
|---|---|
| `web/index.html` | Page shell: the full-window canvas, page styles, and the icon and manifest links. |
| `web/*.png`, `web/manifest.webmanifest` | Home-screen icons (iOS uses `apple-touch-icon.png`, and ignores SVG) and the web app manifest. The PNGs are generated: see Notes. |
| `tools/serve.py` | Dev server for `npm start`: serves `web/` with `Cache-Control: no-store`, so the browser never mixes old and new modules after an edit. |
| `tools/icons.html` | Icon generator: draws each icon with `drawIcon()` from `web/render.js`. |
| `web/main.js` | Entry point: fits the 2:3 playfield to the window, runs the rAF loop, handles input, triggers sounds, saves the best score, mute setting and theme. Opens and closes the settings panel. |
| `web/render.js` | Canvas renderer: sky, parallax hills, pillars, the ground, the magpie's flight pose (wing beat, tilt), the overlays and settings panel, and `drawIcon()`. Colours are at the top, one set per theme in `THEMES`; the settings layout and its hit-testing (`SETTINGS`, `settingsAt()`) live here too. |
| `web/magpie.js` | The magpie sprite (`paintMagpie`), drawn with canvas paths, and its colours (`MAGPIE`; themes pass their own). Used by the renderer and the icons. |
| `web/sound.js` | Sound effects synthesised with WebAudio (no audio files). Audio only starts after a user gesture, so input handlers call `unlock()`. |
| `web/game.js` | Pure game model (physics, pillars, gap placement, scoring, medals, collisions) on a fixed 400×600 logical field. No DOM. Tuning lives in `CFG`. |
| `test/game.test.js` | `node --test` for the game model. |
| `test/render.test.js` | Renderer checks: draws a frame into a recording stand-in for the canvas context and looks at what was drawn. |
| `test/assets.test.js` | Checks that every local module import, and the entry script in `index.html`, carries `?v=dev`. |
| `.github/workflows/pages.yml` | On every push to `main`: run the tests, stamp module URLs with the commit, then deploy `web/` to GitHub Pages. |

## Commands

```sh
npm test     # node --test, no install needed
npm start    # serve web/ at http://localhost:8080, with caching off (tools/serve.py)
```

## Notes

- Files must be served over HTTP, because ES modules don't load from `file://`.
- **Cache busting:** GitHub Pages lets browsers cache each file for 10 minutes, so after a deploy a browser could mix old and new modules. Every local import, and the `<script>` in `index.html`, ends in `?v=dev`. The Pages workflow replaces `dev` with the commit's short SHA, so each deploy gets fresh URLs. When you add a module, import it with `?v=dev`; `test/assets.test.js` fails otherwise.
- The renderer draws in logical units: `main.js` sets the transform to scale 400×600 to the canvas's device pixels.
- **Themes:** a theme recolours the same scene; it never changes shapes or gameplay, and like the rest of the art it must not echo another game's look. Add one by adding an entry to `THEMES` in `render.js` with every key the others have. The icons always use the purple theme.
- **The corner button** (`cornerButton()` in render.js) is placed from the top of the *screen*, not the playfield: `y = -view.top + view.inset + 30`, where `view.inset` is the safe-area inset at the top (the notch), read from the padding of the hidden `#safe-top` element in `index.html` (`padding-top: env(safe-area-inset-top)`). Its `kind` (`pause` / `settings`) says what a tap does; it is `null` while a run is paused.
- Visual sizes, like the magpie's `MAGPIE_SCALE` in `render.js`, are independent of the collision radius `CFG.birdR`. Only the body collides, not the tail.
- **Phase vs level:** `g.phase` is the run's state (`ready` / `playing` / `over`), and `g.level` is the difficulty (`easy` / `normal` / `hard`, see `LEVEL` and `LEVELS`). The toggle, its hit-testing and the keys work for any number of levels. A run keeps its level, and the level can only change on the title screen.
- **Levels:** per-level settings are in `LEVEL` (game.js). A hit with a life to spare doesn't end the run: the bird becomes a `ghost`, passes through pillars and hops off the ground, and turns solid again once `CFG.ghostTime` is up and it's clear of every pillar. Trinkets only spawn while a life can still be gained. Drifting pillars (hard) swing ± `drift` around `baseY`; `gapY` is updated each step, so collisions and drawing just read it. A drifting gap is placed with room to swing inside the edges, its drift is taken off the allowed jump from the previous pillar, and calm stretches don't drift. Updrafts (`g.drafts`, hard) are moving air: inside one, the bird is carried up by `draftRise()` on top of its own flight, so `vy` and flaps are untouched. They sit midway between two pillars and skip calm stretches.
- **Gap placement:** each gap can move at most `shiftFor()` from the previous one, an amount that grows with the score. After every 10th pillar comes a calm stretch of 3 pillars whose gaps barely move.
- **Icons:** after changing `drawIcon()` or `web/magpie.js`, regenerate the PNGs. Run `python3 -m http.server` in the repo root, open `/tools/icons.html`, and save each PNG into `web/`. Keep the icons full-bleed with no transparency, because iOS rounds the corners itself.
- GitHub Pages must be set to **Source: GitHub Actions** in the repo settings, under Pages.
