# Bug Blaster

A lightweight neon arcade game for Hacktoberfest. Squash pixel bugs for 30 seconds, chain combos, and chase a local high score. No backend, APIs, or keys.

## Play

Open `index.html` in a browser, or serve the folder:

```bash
npx --yes serve .
```

Then tap **START GAME**.

## Controls

- Click or tap a bug to blast it
- Common bugs: +10
- Fast magenta bugs: +20
- Golden bugs: +50
- Consecutive hits raise a combo multiplier (up to x8)
- Missing the playfield resets combo
- **SOUND ON / SOUND OFF** mutes Web Audio beeps (saved in `localStorage`)

## Files

- `index.html` — layout, HUD, overlays
- `style.css` — dark developer theme, pixel UI, animations
- `script.js` — round timer, spawning, scoring, audio, mobile pointer events
