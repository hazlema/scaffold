# Scaffold

A falling-block construction game on a hex grid from **Carbon & Silicon**. Build a solid tower before the deadline. Completing a row above a gap cuts your construction back to its lowest unfinished floor.

## Run locally

Requires Node.js 20 or newer. There are no dependencies to install.

```sh
git clone https://github.com/hazlema/scaffold.git
cd scaffold
npm start
```

Open http://127.0.0.1:4173. Set `PORT` to choose another port, for example `PORT=4174 npm start`.

```sh
npm test
```

The included server binds to your own computer only and serves the game's public files. The game can also be served from any static web host. No account, backend, external assets, or compilation is required.

## Play

Arrow left/right: steer. Up or X: rotate clockwise 60°. Z: rotate counterclockwise. Down: descend faster. Shift (left or right): change beat, so the next step down goes the other diagonal (SW instead of SE, or the reverse). Space: hard drop. P/Escape: pause. Leaving the browser pauses automatically. The white dot marks the pivot and its arrow points the way the next step will go; the readout panel shows TICK (SE) or TOCK (SW). The outline marks the landing position. Menus work with the arrow keys and Enter, or the mouse.

**Look:** everything is drawn at 480×270 in a fixed 16-colour palette, scaled up with square pixels, under drifting CRT scanlines (strength in Settings). Source art lives in `art/`; `python3 scripts/assets.py` (needs Pillow) converts it into `assets/`. Run it again only when the art changes.

**Difficulty** is chosen on the title menu (EASY, MEDIUM or HARD; the cursor starts on MEDIUM). It sets how many open hexes a row may have and still count as solid: Easy 2, Medium 1, Hard 0. A solid row counts as a floor, sets off the cutback check when it is sealed, and is never treated as a gap below a sealed row. Its open hexes stay open and can still be filled later. Difficulty also sets the **reach limit**: hexes may sit at most Easy 6, Medium 5, Hard 4 rows above the top solid floor, counting the unfinished floor as row 1. A red dashed line marks the limit and climbs as floors are finished; the landing outline turns red when a drop would cross it, counting any floors that drop would itself finish. Locking a piece above the line sets off a cutback ("TOO HIGH") that removes everything above the lowest unfinished floor.

**Edge lanes** (on by default, toggle in Settings): a dashed lane runs beside each wall. A piece may steer partly into a lane to reach awkward wall pockets, but it must keep at least one hex on the board. Lane hexes are drawn faint, never collide, and are cut off when the piece locks; the landing outline marks them with a red ×. Holding an arrow stops at the visible wall; press again to enter a lane. New deliveries always appear fully on the board, and rotation prefers on-board positions before using a lane.

Build eight consecutive solid floors from the sawtooth foundation before the clock runs out: 10 minutes on Easy, 9 on Medium, 8 on Hard. Settings offers 12- and 16-floor targets too, along with sound and scanline strength; settings are remembered in the browser. The clock is a deadline: reaching the target wins; running out of time loses. Complete floors stay in place.

A newly completed row triggers inspection of every row below it. If there is a gap, retain the lowest incomplete row and everything below it; remove all placed cells above it. No collapse, shifting, or grinding. Simply placing above a gap never triggers deletion. The brief cutback animation locks input while the clock continues.

## Scope and geometry

Eight columns, 20 staggered horizontal rows of pointy-top hexagons. Shapes use axial coordinates; rotation is a real 60° transform around a member cell. Gravity alternates the two downward neighbor directions to keep descent centered. If that step crosses a side wall, it uses the other downward neighbor; occupied cells and the floor still stop it. Gravity, the landing outline, and hard drop share this path. With edge lanes on, "side wall" means the outer lane edge, so a piece near a wall can swing into a lane as it falls; lane hexes still stop at the floor. The three free trihexes and seven free tetrahexes are enumerated by rotations/reflections. Each draw bag contains two of every tetrahex and one of every trihex (14:3 weighting). Pieces are not reflected during play.

Incoming rocks and the HTTP agent interface are deferred until the core loop has been playtested. No rigid-body physics, octagonal layers, survival scoring, or moving rubble remain in this version.

A blocked entry checks the built tower for gaps, excluding empty headroom. If there is a gap, the normal cutback removes placed cells above the lowest incomplete row, then retries the same delivery without consuming another preview piece. A solid blocked tower wins if time remains, even below the selected target. The deadline continues during cutbacks. If the retained unfinished row itself blocks entry and nothing remains above it to remove, Restart remains available; the rule does not delete that retained row. The target and difficulty are provisional. Filling isolated single-cell sockets may be difficult or impossible with a given stack; solvability is not guaranteed.

## Project files

- `engine.js` — hex geometry, piece generation, construction rules, timer, and cutbacks.
- `app.js` — screens (menu, settings, play), keyboard and mouse input, frame loop, and optional synthesized audio.
- `render.js` — board geometry and all drawing on the 480×270 canvas; `ui.js` — menu layout and keys; `font.js` — 5×7 bitmap font; `palette.js` — the 16 colours; `settings.js` — saved settings; `assets.js` — art loader.
- `art/` — source art; `scripts/assets.py` converts it into `assets/`.
- `*.test.js` — rule and regression tests (`engine.test.js`, including side-wall descent and blocked-entry recovery) plus tests for the font, settings, UI logic, board geometry and assets.
- `index.html` and `style.css` — the canvas, integer scaling, and the scanline layer.
- `server.mjs` — dependency-free local preview server.

This is an early playable prototype. Target height, draw weighting, and difficulty are still being tuned.

## Deploy on Netlify

Import this GitHub repository into Netlify. The included `netlify.toml` supplies the build command and publish directory automatically. No environment variables are needed.

The build command (`npm run build`, or `node scripts/build.mjs`) copies only the public game files and `assets/` into `dist/`, keeping tests, repository files, and the local server out of the deployed site. You can also upload the generated `dist/` directory manually.
