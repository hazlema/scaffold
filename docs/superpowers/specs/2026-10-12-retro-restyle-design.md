# Scaffold retro restyle — design

Date: 2026-10-12 · Status: awaiting review

## Goal

Replace the prototype's dark/gold UI with a finished-game look: a dreamy, surreal pixel world (melting clocks, floating islands, synthwave sunset) drawn under authentic 80s hardware limits, so the game feels like it was "found in a pile of lost 80s games." The rules engine is not changing; this is presentation and flow only.

**Success looks like:** every screen (menu, settings, play, pause, game over) uses only the locked 16 colors at 480×270, scaled up with hard square pixels and covered by animated scanlines. The game plays exactly as it does today.

## Decisions already made

- **Scope:** the whole game in one pass. The old UI is removed, not kept alongside.
- **Palette (locked, 16 colors):**
  `030203` black · `121871` navy · `14199a` royal blue (playfield) · `32209d` indigo · `714ec0` violet · `9316bc` purple · `a359e5` lavender · `e525ac` magenta · `fa5094` hot pink · `fc71b2` pink · `fd9e4b` orange · `fee69c` sun yellow · `f3e6ac` cream · `ffffff` white · `3fbf6a` green · `3ec8f0` cyan
- **Art approach "A":** user-generated art becomes layered sprites over a backdrop. The code draws all text, the sky bands, stars, the board and the panels.
- **Scanlines:** thin, slowly drifting lines over the whole screen, starting at 0.6 opacity and adjustable in Settings.
- **Platform:** keyboard (and mouse on the menus) only. The on-screen buttons and phone/tablet play are dropped for now.

## Source art (in `art/`, committed as-is)

| File | Contents | Use |
|---|---|---|
| `art/backdrop.png` | sky bands, stars, sun, sea, clouds (1672×941) | **Only the sea, sun and clouds** are used. Rows above the horizon are replaced by code-drawn bands, because two of the art's bands fall between palette colors and come out speckled. |
| `art/sprites.png` | 3 clocks, 4 islands, 6 cubes on `#fa04f8` | animated scenery |
| `art/logo.png` | SCAFFOLD title on `#f603bd` | menu title |
| `art/comp-menu.png` | the user's second comp | reference only |

## Asset pipeline (`scripts/assets.py`, dev-only)

A Python + Pillow script, run by hand when the art changes. It writes finished files to `assets/`, and the game loads only those. The game keeps zero runtime dependencies.

1. **Background removal by flood fill from the image border.** It removes only key-colored pixels connected to the outside (tolerance about 110 RGB distance). The pink and magenta inside the logo's black outline are kept; the probe showed that plain color keying cuts holes in them.
2. **Splitting the sheet:** the sprite sheet is split into connected regions and saved under names from a fixed list in the script, in reading order: `clock-island`, `clock-winged`, `clock-small`, `island-castle`, `island-sunset`, `island-ruins`, `island-tree`, `cube-orange`, `cube-blue`, `cube-pink`, `cube-orange-s`, `cube-blue-s`, `gem`. Any piece that lands in a neighbor's box is cleared.
3. **Scale:** everything shrinks by the same factor (1672 → 480, ×0.287). The logo is shrunk further, to about 240 px wide.
4. **Palette snap:** each pixel snaps to its nearest palette color with no dithering. Then a 3×3 majority filter, applied only to isolated single pixels, removes speckle.
5. **Backdrop:** the rows below the horizon are snapped and written as `assets/backdrop-low.png`, a 480×N strip anchored to the bottom of the screen.
6. **Output:** PNG files plus `assets/manifest.json` listing each sprite's size. The build copies `assets/` into `dist/`.

## Screen and rendering

- **Canvas:** one 480×270 canvas with image smoothing off. CSS scales it to the largest whole-number multiple that fits the window and centers it on black, with `image-rendering: pixelated`.
- **Scanlines:** a separate element over the canvas, drawn at display resolution: 1 px dark lines with a 3 px period, drifting slowly downward. Opacity comes from Settings (default 0.6; Off, then 0.1 to 1.0 in steps of 0.1).
- **Sky:** `render.js` draws the bands as solid rectangles in palette colors (navy → indigo → violet → purple → magenta → hot pink → orange → sun yellow), from the top of the screen down to the horizon. Stars are drawn in code as single pixels and 5-pixel crosses in white or cream. A few twinkle by switching color now and then.
- **Scenery:** sprites are placed at fixed spots and bob vertically by 1 px over a few seconds, each slightly out of step with the others. Clocks get an occasional drip: a 1 px cream dot that falls a few pixels and disappears.
- **The first frame is only the backdrop and sky** if the assets are still loading. Assets are small, so this should never be visible.

## Screens

**Title menu.** The world with scenery sprites around the edges and the logo at the top center. Below it, a bevelled box (navy fill, light top and left edges, dark bottom and right edges) holds `EASY`, `MEDIUM`, `HARD`, `SETTINGS` in the small font at 2× size. A blinking `▶` marks the selected item. ↑/↓ move, Enter or Space selects, and the mouse can hover and click. Choosing a difficulty starts a game with the saved settings.

**Settings.** The same box style, with rows `TARGET 8/12/16`, `EDGE LANES ON/OFF`, `SOUND ON/OFF`, `SCANLINES OFF…1.0` and `BACK`. ←/→ change a value, Esc or `BACK` returns to the menu. Settings are saved to `localStorage` under the key `scaffold.settings`. If the saved value is unreadable, the defaults are used: target 8, lanes on, sound off, scanlines 0.6.

**Play.**
- **Cabinet, left of center:** a royal-blue (`14199a`) panel with a bevelled black and navy frame holds the board and the edge lanes.
- **Readout panel, right:** a navy bevelled panel, so the text stays readable over the sunset bands. It shows big white numbers for `TIME` (mm:ss), `FLOORS 3/8`, `CUTBACKS`, a `NEXT` box with a mini piece, a beat indicator (`TICK ▶ SE` / `TOCK ◀ SW`), and the difficulty's gaps and reach.
- **Message line:** the bottom of the readout panel shows the current game message (cutback, too high, offcut), shortened to fit.
- **Scenery:** sprites appear only at the far left and right edges and never behind the board.

**Pause / game over.** A bevelled box over the board: `PAUSED`, `TOPPED OUT`, or `TIME'S UP` with the final stats. Pause offers `RESUME` and `MENU`; game over offers `AGAIN` and `MENU`. P or Esc pauses. Losing window focus still pauses.

## The board

- **Hex tile:** a hand-defined 14×16 pixel pointy-top mask, with columns 14 px apart, rows 12 px apart, and odd rows shifted 7 px. The board is 20 rows, 19×12+16 = 244 px tall, and 8 columns plus a half-shift plus 2 lane columns, about 150 px wide.
- **Chamfer:** each placed hex is filled with its piece color, with a 1 px lighter edge on the upper-left facets and a 1 px darker edge on the lower-right facets, using fixed palette pairs per color.
- **Piece colors (first pick, tune by eye):** tetrahexes 0–6 → green, cyan, orange, sun yellow, hot pink, lavender, cream; trihexes 7–9 → magenta, white, pink. Royal blue, navy and black are never piece colors.
- **Empty cells:** a navy outline on the royal-blue background. Solid floors use a slightly different empty-cell tint (indigo outline).
- **Landing ghost:** the outline only, in the piece color. It turns hot pink when the drop would break the reach limit.
- **Lines:** the reach limit is a dashed hot-pink line labelled `REACH`, and the target is a dashed sun-yellow line labelled `TOP`. Labels sit in the cabinet margin.
- **Lanes, pivot, offcuts and cutbacks:** lane cells are dashed outlines, and offcut cells show a cross. The pivot is a white pixel dot with the step arrow. Cutback animation: removed cells flash white and hot pink, then vanish.
- **Floor:** a sawtooth line in orange along the bottom.

## Code layout

| File | Responsibility |
|---|---|
| `engine.js` | game rules (**unchanged**) |
| `palette.js` | the 16 colors and the piece-color and bevel pairs |
| `font.js` | the bitmap font: 5×7 glyphs for A–Z, 0–9 and `/ : . , - ' ! ? ▶ ◀`, plus `drawText(ctx, str, x, y, color, scale)` and `measure` |
| `render.js` | pure drawing: sky, stars, backdrop, sprites, bevel boxes, hex tiles, board, readouts |
| `assets.js` | loads `assets/manifest.json` and the images, and exposes them as named images |
| `settings.js` | loads and saves settings in `localStorage`, with defaults and validation |
| `app.js` | the screen state machine (menu, settings, play, paused, over), input, the frame loop, and sound |
| `index.html` / `style.css` | just the canvas and the scanline element, with scaling and centering |

## Testing

- **Unchanged:** all 32 engine tests.
- **New unit tests (Node test runner):**
  - the board layout fits inside 480×270 with its panels, and the hex positions match the engine's column and row conventions
  - `font.js` has a glyph for every character used by any string in `app.js`
  - `settings.js` returns the defaults when storage is empty or corrupt, and saves and loads its values
  - the palette has exactly 16 unique colors, and every piece color is distinct and not a background color
- **Visual checks:** a browser screenshot of each screen and state (menu, settings, play mid-game, cutback, pause, won, lost), compared against the comp for feel.
- **The asset script** is checked by its output: the sprite count is 13, and no output pixel falls outside the palette.

## Out of scope

Touch controls, the melting clock as the timer, music, and the tutorial are all for later.
