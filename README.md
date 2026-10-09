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

Arrow left/right: steer. Up or X: rotate clockwise 60°. Z: rotate counterclockwise. Down: descend faster. Space: hard drop. P/Escape: pause. Leaving the browser pauses automatically. The white dot marks the pivot; outlined cells show the landing position. On-screen buttons also work.

Build eight consecutive solid floors from the sawtooth foundation in five minutes. The setup offers 12- and 16-floor targets too. The clock is a deadline: reaching the target wins; running out of time loses. Complete floors stay in place.

A newly completed row triggers inspection of every row below it. If there is a gap, retain the lowest incomplete row and everything below it; remove all placed cells above it. No collapse, shifting, or grinding. Fixed blockers, if enabled, remain. Simply placing above a gap never triggers deletion. The brief cutback animation locks input while the clock continues.

“Try the cutback demo” sets up a complete first floor, a second floor with one gap, and a nearly complete third floor. Press Space to finish floor three and see exactly what gets removed.

## Scope and geometry

Eight columns, 20 staggered horizontal rows of pointy-top hexagons. Shapes use axial coordinates; rotation is a real 60° transform around a member cell. Gravity alternates the two downward neighbor directions to keep descent centered. If that step crosses a side wall, it uses the other downward neighbor; occupied cells and the floor still stop it. Gravity, the landing outline, and hard drop share this path. The three free trihexes and seven free tetrahexes are enumerated by rotations/reflections. Each draw bag contains two of every tetrahex and one of every trihex (14:3 weighting). Pieces are not reflected during play.

Clear terrain is the default. Optional fixed blockers count as filled and survive cutbacks. Incoming rocks and the HTTP agent interface are deferred until the core loop has been playtested. No rigid-body physics, octagonal layers, survival scoring, or moving rubble remain in this version.

A blocked entry checks the built tower for gaps, excluding empty headroom. If there is a gap, the normal cutback removes placed cells above the lowest incomplete row, then retries the same delivery without consuming another preview piece. A solid blocked tower wins if time remains, even below the selected target. The deadline continues during cutbacks. If the retained unfinished row itself blocks entry and nothing remains above it to remove, Restart remains available; the rule does not delete that retained row. The target and difficulty are provisional. Filling isolated single-cell sockets may be difficult or impossible with a given stack; solvability is not guaranteed.

## Project files

- `engine.js` — hex geometry, piece generation, construction rules, timer, and cutbacks.
- `app.js` — canvas rendering, keyboard/button controls, and optional synthesized audio.
- `engine.test.js` — rule and regression tests, including side-wall descent and blocked-entry recovery.
- `index.html` and `style.css` — arcade interface.
- `server.mjs` — dependency-free local preview server.

This is an early playable prototype. Target height, draw weighting, and difficulty are still being tuned.

## Deploy on Netlify

Import this GitHub repository into Netlify. The included `netlify.toml` supplies the build command and publish directory automatically. No environment variables are needed.

The build command (`npm run build`, or `node scripts/build.mjs`) copies only the four public game files into `dist/`, keeping tests, repository files, and the local server out of the deployed site. You can also upload the generated `dist/` directory manually.
