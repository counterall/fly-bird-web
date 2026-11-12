# Updraft

A one-button browser game: flap a magpie through gaps between dusk-lit pillars.

- **Controls:** Space / ↑ / W / click / tap to flap, P / Esc or the pause button (top right, during a run) to pause, then ▶ (same spot), a tap or P to resume, and M to mute. Outside a run, that corner shows a gear that opens the settings: sound on or off, and the theme, Purple (dusk) or Classic (a blue day sky, mossy sandstone pillars, an all-green meadow and a yellow magpie). Pick Easy, Normal or Hard on the title screen. In Easy, grab the gold rings for extra lives (up to 3). Normal is the original game: one life, steady pillars. In Hard you get one life, the pillars drift, and updrafts carry you up.
- **Medals:** bronze at 50 points, silver at 150, gold at 500. The sky turns from dusk to night as a run goes on.
- **Run locally:** run `npm start`, then open http://localhost:8080.
- **Tests:** `npm test`.

Every push to `main` deploys `web/` to GitHub Pages through `.github/workflows/pages.yml`.
