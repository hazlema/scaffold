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

**On a phone:** hold it upright. The game switches to a tall screen with five hex buttons beside the board: ◀ ▶ steer (hold to slide), V soft-drops while held and hard-drops on a double tap, R rotates, B changes the beat. Tap the bar at the top to pause. While entering initials the same buttons pick letters (R/V change the letter, ◀ ▶ move, B saves). Turning the phone sideways pauses the game until you turn it back.

**Look:** everything is drawn at 480×270 in a fixed 16-colour palette, scaled up with square pixels, under drifting CRT scanlines (strength in Settings). Source art lives in `art/`; `python3 scripts/assets.py` (needs Pillow) converts it into `assets/`. Run it again only when the art changes.

**Difficulty** is chosen on the title menu and sets every rule of a run:

| | Open hexes a solid row may keep | Reach above the top solid floor | Target floors | Starting clock | Score weight |
|---|---|---|---|---|---|
| EASY | 2 | 6 rows | 8 | 3:00 | ×1 |
| MEDIUM | 1 | 5 rows | 12 | 5:00 | ×2 |
| HARD | 0 | 4 rows | 12 | 6:00 | ×3 |

A solid row counts as a floor, sets off the cutback check when it is sealed, and is never treated as a gap below a sealed row; its open hexes stay open and can still be filled later. A red dashed line marks the reach limit and climbs as floors are finished; the landing outline turns red when a drop would cross it. Locking a piece above the line sets off a "TOO HIGH" cutback.

**Runs and levels:** reach the target (the solid yellow GOAL line) before the clock runs out to clear the level. The next level starts on an empty board with a clock one minute shorter than the last (never under 1:00), and pieces drop 10% faster for every level cleared. The run ends when a level's clock runs out, or when a piece cannot enter and nothing is left to cut. Your score is every solid floor you built in the run times the difficulty weight. A top-10 score asks for three initials (type them, or spin each with ↑/↓; Enter on the last one saves); the table is kept in your browser and is also under HIGH SCORES on the title menu.

**Edge lanes** (on by default, toggle in Settings): a dashed lane runs beside each wall. A piece may steer partly into a lane to reach awkward wall pockets, but it must keep at least one hex on the board. Lane hexes are drawn faint, never collide, and are cut off when the piece locks; the landing outline marks them with a red ×. Holding an arrow stops at the visible wall; press again to enter a lane. New deliveries always appear fully on the board, and rotation prefers on-board positions before using a lane.

Build from the sawtooth foundation up to the GOAL line. Settings holds edge lanes, sound and scanline strength; settings and high scores are remembered in the browser. Complete floors stay in place.

A newly completed row triggers inspection of every row below it. If there is a gap, retain the lowest incomplete row and everything below it; remove all placed cells above it. No collapse, shifting, or grinding. Simply placing above a gap never triggers deletion. The brief cutback animation locks input while the clock continues.

## Scope and geometry

Eight columns, 20 staggered horizontal rows of pointy-top hexagons. Shapes use axial coordinates; rotation is a real 60° transform around a member cell. Gravity alternates the two downward neighbor directions to keep descent centered. If that step crosses a side wall, it uses the other downward neighbor; occupied cells and the floor still stop it. Gravity, the landing outline, and hard drop share this path. With edge lanes on, "side wall" means the outer lane edge, so a piece near a wall can swing into a lane as it falls; lane hexes still stop at the floor. The three free trihexes and seven free tetrahexes are enumerated by rotations/reflections. Each draw bag contains two of every tetrahex and one of every trihex (14:3 weighting). Pieces are not reflected during play.

Incoming rocks and the HTTP agent interface are deferred until the core loop has been playtested. No rigid-body physics, octagonal layers, survival scoring, or moving rubble remain in this version.

A blocked entry checks the built tower for gaps, excluding empty headroom. If there is a gap, the normal cutback removes placed cells above the lowest incomplete row, then retries the same delivery without consuming another preview piece. A solid blocked tower wins if time remains, even below the selected target. The deadline continues during cutbacks. If the retained unfinished row itself blocks entry and nothing remains above it to remove, Restart remains available; the rule does not delete that retained row. The target and difficulty are provisional. Filling isolated single-cell sockets may be difficult or impossible with a given stack; solvability is not guaranteed.

## Project files

- `engine.js` — hex geometry, piece generation, construction rules, timer, and cutbacks.
- `app.js` — screens (menu, settings, play), keyboard and mouse input, frame loop, and optional synthesized audio.
- `render.js` — board geometry and all drawing on the 480×270 canvas; `ui.js` — menu layout and keys; `font.js` — 5×7 bitmap font; `palette.js` — the 16 colours; `run.js` — levels, speed and score; `scores.js` — the local top-10 table; `settings.js` — saved settings; `assets.js` — art loader.
- `art/` — source art; `scripts/assets.py` converts it into `assets/`.
- `*.test.js` — rule and regression tests (`engine.test.js`, including side-wall descent and blocked-entry recovery) plus tests for the font, settings, UI logic, board geometry and assets.
- `index.html` and `style.css` — the canvas, integer scaling, and the scanline layer.
- `server.mjs` — dependency-free local preview server.

This is an early playable prototype. Target height, draw weighting, and difficulty are still being tuned.

## Deploy on Netlify

Import this GitHub repository into Netlify. The included `netlify.toml` supplies the build command and publish directory automatically. No environment variables are needed.

The build command (`npm run build`, or `node scripts/build.mjs`) copies only the public game files and `assets/` into `dist/`, keeping tests, repository files, and the local server out of the deployed site. You can also upload the generated `dist/` directory manually.
