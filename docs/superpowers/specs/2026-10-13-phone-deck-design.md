# Scaffold phone layout v2: pixel game screen plus a controller deck

Date: 2026-10-13 · Status: awaiting review · Supersedes the tall-screen layout and button sections of `2026-10-13-touch-portrait-design.md` (mode switching, touch timing and the sideways behaviour still stand).

**Mock (binding for the deck's look):** `docs/mock/Mobile Controls.dc.html`, drawn 648 px wide.

**Why:** On a real phone (1080×2400 at dpr 2.625, Brave) the v1 tall screen drew at 3× and filled about a third of the height. The user's mock separates the pixel game screen from a physical-looking controller deck that deliberately breaks the pixel theme, like a handheld's plastic shell.

## Decisions

### Game screen: tall canvas, 216×302 logical

| Area | Placement and contents |
|---|---|
| Readout strip | Box at 4,4, 208×34. `TIME` label at x+6,y+5 and the clock at scale 2 at x+6,y+15 (hot pink under 1:00). `LEVEL n`, `SCORE n` and `FLOORS h/t` at x+70, y+5/14/23. The difficulty label and `CUTS n` at x+148, y+5/14. (`GAPS/REACH` is dropped on phones; the REACH line is still on the board.) |
| Cabinet | Box at 28,42, 159×255; board origin BX 34, BY 48. GOAL and REACH labels sit inside the board's left edge, as in v1. |
| Banners | Centre x 107, top y 80 (LEVEL CLEAR, RUN OVER with initials). |
| Pause box | Centred on the cabinet. |
| Table | 6,6, 204×200, rows at scale 1, 12 px apart, x offset 36. Actions at y 214. The tall summary line is shortened to `<LABEL>  LEVEL n  SCORE n`. |
| Menus | Small logo (see Assets) at y 8; menu box at y 60; settings box at y 70 (minimum width 190); a `TAP TO CHOOSE` box at y 210. |
| Sky | Backdrop shifted by 132 (centre crop); no scenery sprites. |

**Pixel scale:**
- The canvas fills the width at an integer scale, leaving the deck at least 0.45 × width in height: `fitScale(innerWidth, innerHeight − 0.45·innerWidth, dpr, 216, 302)`.
- **Rounding fix (all modes):** `fitScale` adds a 0.02 tolerance before flooring, so a screen reporting 1078.9 device px gets 5×, not 4×.

On the user's phone this gives 5× (411×575 CSS px of game). The deck gets the rest.

### Controller deck (DOM, below the canvas, only in tall mode)

Built from page elements and styled to match the mock:
- **Size:** its width equals the game's CSS width, and it fills the remaining height (at least 0.45 × width). Every size is a multiple of `--u` = deck width / 648, so it matches the mock at any phone width.
- **Plastic:** dark dimpled plastic (`#0d0d0f` with the radial-dot texture), a recessed top edge and a 3 px black top border.
- **LCD strip:** `GOAL` in lavender plus the current game message in gold. When nothing else is showing, it reads `FINISH FLOOR n`; on menus it reads `TAP TO CHOOSE`. On the right is `BEAT` with **four chase lights**: one light is lit, and it moves to the next light on every drop step, wrapping around. It's eye candy.
- **Left pad:** ◀ ▶ ▼, purple flat-top hexes (gradient `#7f63d6`→`#5a3fb0`, inset shade `#3e2a86`, black rim) with gold triangle arrows, laid out as in the mock.
- **Centre:** `NEXT` label and a recessed window showing the next piece as pointy-top hexes in its palette colour, arranged by its real shape.
- **Right pad:**
  - **R:** magenta `#d6249a` with shade `#8e1468`, caption `ROTATE`, set 26 units low.
  - **B:** gold `#f6d98a` with shade `#e08a2e` and indigo ink, caption `BEAT`, set 26 units high.
- **Pressed look:** a held button moves down 3 px and darkens (`brightness(.85)`), driven by `touch.isPressed` so it shows exactly what the game registers.
- **Font:** *Press Start 2P*, self-hosted (see Assets).

### Input

- **Deck buttons** go through `touch.js`. Pointer down, up, cancel and `lostpointercapture` (a v1 deferred minor) map to the button's `data-btn`: `left`, `right`, `down`, `rotate` or `beat`. Timing is unchanged: ◀ ▶ repeat after 170 ms then every 50 ms; ▼ hold = soft drop; a second ▼ within 250 ms = hard drop. A press buzzes 8 ms where supported.
- **Pause:** tapping the canvas readout strip (logical y < 40) during play pauses or resumes.
- **Menus and boxes:** taps on the canvas, as before (clicks with row hit-testing). Deck buttons do nothing outside play and initials entry.
- **Initials:** ◀ ▶ move between slots, R and ▼ spin the letter, B saves.
- **Sideways and desktop:** unchanged (turn prompt, game frozen, deck hidden).

### Assets

- **Small logo:** `scripts/assets.py` also writes `assets/logo-small.png` at 200 px wide from the same source art, listed in the manifest as `logoSmall`. The tall menu draws it, falling back to the text logo.
- **Font:** `assets/fonts/PressStart2P-Regular.ttf` (SIL Open Font License, with `OFL.txt` beside it), loaded with `@font-face`. The server and build allow `assets/fonts/*.ttf|txt`.

## Removed from v1

The in-canvas side strips, hex buttons, `drawTallSides`, `drawButtons`, `drawMessage`, `hitButton`/`BUTTONS` and the 270×330 tall layout.

## Code structure

| File | Change |
|---|---|
| `ui.js` | `fitScale` gets the tolerance |
| `render.js` | `LAYOUTS.tall` becomes 216×302 as above; the tall strip is redrawn; `drawLogo` uses the small logo in tall mode; the v1 tall drawing is removed |
| `touch.js` | drops `BUTTONS`/`hitButton`; the controller is unchanged |
| `deck.js` (new) | `nextHexes(id)` (pure: positions and colour for the NEXT window) and `chaseLight(steps)` (pure: lit index 0–3); `createDeck(doc)` builds the DOM once and `deck.update({message, steps, next, isPressed})` refreshes it per frame, touching the DOM only when something changed |
| `app.js` | creates the deck; routes deck pointer events to `touch`; canvas strip taps pause; counts `step` events for the lights; shows or hides the deck by mode; fits the canvas with room for the deck |
| `index.html`, `style.css` | a `#deck` container after `#screen`; tall-mode page layout (column, screen at the top, deck filling the rest); deck styles from the mock; `@font-face` |
| `scripts/assets.py`, `scripts/files.mjs`, `scripts/build.mjs` | small logo; font files served and copied |

## Testing

- **`ui.test.js`:** `fitScale(411, 915, 2.625, 216, 302)` = 5 (the user's phone); existing expectations unchanged.
- **`render.test.js`:** the tall 216×302 layout fits (board in cabinet, strip columns, table and actions, banner with the initials hint, menu and settings boxes, `TAP TO CHOOSE`); the v1 tall-button tests are removed.
- **`deck.test.js`:** `nextHexes` for every shape stays inside the window and preserves the shape's pointy-top neighbour geometry; `chaseLight` wraps 0→3.
- **`touch.test.js`:** v1 controller tests kept; the `hitButton` test is removed.
- **`app.test.js`:** deck presses drive the game (◀ moves, double-tap ▼ hard-drops), a strip tap pauses, mouse and desktop are unaffected, and sideways still freezes.
- **Browser:** a phone context (412×915 at dpr 2.625 and 390×844 at dpr 3, touch) is compared side by side with the mock render. Check 5× scale and that the deck fills the bottom.

## Out of scope

Landscape touch play, haptics on iOS, remapping, deck themes (the mock's ribbed and smooth textures).
