# Scaffold touch controls and portrait screen: design

Date: 2026-10-13 · Status: awaiting review · Mockup: `/tmp/padmock/pad-sides.png` (agreed version; the final layout below moves NEXT and BEAT into the side strips)

## Goal

Make Scaffold playable on a phone held upright. On touch devices in portrait, a dedicated tall pixel screen shows the board at a readable size, with five small hex buttons floating in the side strips beside it. Desktop and keyboard play don't change.

**Success looks like:**
- On a typical phone (390 CSS px wide at 3×) the game draws at 4×, with board hexes about 19 CSS px wide and text about 9 CSS px tall.
- Every action can be done with two thumbs.
- No button covers the board.
- Everything stays inside the 16-colour, square-pixel rules.

## Decisions (agreed in chat)

- **Portrait only on touch.** Landscape on a touch device shows a `TURN TO PORTRAIT` screen and pauses play. Desktop always uses the existing wide screen.
- **Five floating hex buttons** at the bottom of the side strips: left strip `‹` `›` (with `v` under them), right strip `R` (rotate clockwise) and `B` (beat). They are solid and bevelled like the pieces, drawn over the sunset and never over the board.
- **v:** held = soft drop; **double-tap v** (second press within 250 ms of the first) = hard drop. No swipe gestures; touching the board does nothing.
- **Pause:** tap the readout strip.

## Screen modes

`layoutFor({coarse, width, height})` returns:
- `'tall'` when `coarse && height > width`, where coarse is `matchMedia('(pointer: coarse)')`;
- `'rotate'` when `coarse && width >= height`;
- `'wide'` otherwise.

It is re-evaluated on `resize` and `orientationchange`. The canvas element's `width`/`height` attributes follow the mode: wide 480×270, tall 270×330. After a resize, `imageSmoothingEnabled` is set to false again. The integer scale uses the active size: `fitScale(w, h, dpr, LW, LH)`.

Switching into `rotate` during play pauses the game, as a blur does. Coming back shows the PAUSED box.

## Tall layout (270×330 logical)

| Area | Rect / position | Contents |
|---|---|---|
| Readout strip | box 4,4 262×40 | `TIME` label at x+8,y+6 and clock at scale 2 at x+8,y+16 (hot pink under 1:00). Then `LEVEL n`, `SCORE n` and `FLOORS h/t` at x+80, y+6/16/26. Then difficulty label, `CUTS n` and `GAPS g REACH r` at x+170, y+6/16/26. |
| Cabinet | box 56,52 159×255; board origin BX 62, BY 58 | The same board renderer as wide: cells, lanes, GOAL and REACH lines. The GOAL and REACH labels move inside the cabinet's top-left corner, because the side strips are now taken. |
| Left strip, top | x 0–55, y 56–130 | `NEXT` label at 4,60, with the mini piece centred at 28,98. |
| Right strip, top | x 215–270, y 56–130 | `BEAT` label at 219,60, then `TICK`/`TOCK` at 219,72 and a scale-3 `▶`/`◀` at 230,84. |
| Buttons | hex radius 13; centres ‹ 15,268 · › 40,268 · v 27,290 · R 230,268 · B 255,268 | The sunset shows behind and between them. |
| Message | 2 lines at y 311 and 320, x 6 | The current game message, `wrap(msg, 42, 2)`. |
| Sky | bands and sun from the manifest | The backdrop image is drawn cropped to its centre (source x 105–375). Below row 270 the sea colour is filled. No scenery sprites. |

**Boxes:**
- The pause box, LEVEL CLEAR and RUN OVER banners centre on the tall cabinet. `BANNER.cx` and the pause box x come from the active layout.
- The high-score table uses a tall variant: box 10,40 250×200, rows at scale 1, 12 px apart. Actions sit below it at y 250.

**Menus:**
- The title logo (240 px) and the menu box fit as they are.
- The keyboard controls box is replaced by a one-line `TAP TO CHOOSE` box.
- Settings fit as they are.

**Rotate screen:** the sky plus a slowly rotating bevelled hex and `TURN TO PORTRAIT`, drawn on the wide canvas.

## Touch input

`touch.js` is pure. It is a controller that turns pointer events into the same actions the keyboard produces:

```
createTouch({das=170, arr=50, doubleTap=250})
  .down(pointerId, button, t) → actions
  .up(pointerId, t)           → actions
  .tick(t)                    → actions (held repeats)
  .isPressed(button)          → bool (for drawing)
```

**Actions:**

| Action | Effect in the game |
|---|---|
| `left` / `right` | Fresh press: `game.move(±1, true)`. |
| `left-repeat` / `right-repeat` | `game.move(±1, false)`, so a held slide stops at the visible wall, the same as a held key. |
| `cw` | Rotate clockwise. |
| `beat` | Change the beat. |
| `soft-on` / `soft-off` | Start and stop the soft drop. |
| `drop` | Hard drop. |

**Timing:**
- `‹ ›` repeat after 170 ms, then every 50 ms.
- `v` emits `soft-on` on press and `soft-off` when no pointer still holds it. A press within 250 ms of the previous `v` press also emits `drop`.
- `R` and `B` act once per press.

**Several fingers.** Each pointer id maps to the button it went down on. Lifting one finger releases only that button. A finger that slides off its button keeps it held until it lifts, so the button doesn't flicker.

**Hit testing** (`hitButton(x, y)` in logical pixels, from the active layout):
- A touch with `y ≥ 236` in the left strip (`x < 56`) goes to the nearest of ‹ › v.
- In the right strip (`x ≥ 215`) it goes to the nearest of R and B.
- A touch on the readout strip (`y < 48`) is `pause`.
- Any other touch on the board is ignored.

**Menus and boxes** keep the existing click handling: taps arrive as clicks, and the existing row hit-testing works in both layouts.

**Initials on touch.** While entry is open, the buttons stand in for keys: ‹ → ←, › → →, R → ↑, v → ↓, B → Enter. The RUN OVER hint reads `R V LETTER, B SAVE` in the tall layout, and keeps `TYPE INITIALS, ENTER` in wide.

**Feel:**
- A pressed button is drawn with its bevel flipped.
- Each press calls `navigator.vibrate?.(8)`. iPhones ignore it.
- The canvas gets `touch-action: none`, and page scrolling and zoom are blocked: viewport `user-scalable=no` and `overscroll-behavior: none`.

## Code structure

| File | Change |
|---|---|
| `render.js` | `LAYOUTS = {wide, tall}`, plus `useLayout(name)`, which assigns into the existing `LAYOUT` object so `cellXY` and friends follow the mode. Adds `drawStrip` (the tall readout), `drawTallSides` (NEXT and BEAT), `drawButtons(ctx, pressed)` (bevelled hex buttons with a flipped bevel when pressed), `drawRotate`, and tall variants of the table and controls. |
| `touch.js` (new, pure) | `createTouch`, `hitButton`, `BUTTONS` (positions and names) |
| `ui.js` | `fitScale(w, h, dpr, LW=480, LH=270)`; `layoutFor` |
| `app.js` | mode switching; pointer events (`pointerdown`/`up`/`cancel` on the canvas, with `setPointerCapture`); the touch tick in `frame()`; actions routed to the same handlers as keys; draw dispatch by mode |
| `index.html`, `style.css` | viewport meta; `touch-action:none`; `overscroll-behavior:none` |

## Edge cases

- **Pointer cancelled** (a system gesture or a call coming in): treated as lifting that finger, so the soft drop is released.
- **Page blur or hide:** every touch is cleared and the game pauses (the existing behaviour).
- **Orientation flips mid-level:** the board state is untouched and the layout swaps. A flip to landscape pauses.
- **Mouse on desktop:** pointer events from a mouse don't drive the touch buttons, because they aren't drawn in wide mode and `hitButton` returns null there.

## Testing

- **`touch.test.js`:**
  - a tap emits one `left`
  - holding emits `left-repeat` after 170 ms and every 50 ms after that
  - `v` soft-on/off across two fingers, released only when the last finger lifts
  - a double tap within 250 ms emits `drop`, and taps 300 ms apart don't
  - R and B fire once per press
  - a finger sliding off keeps the button held
  - cancel releases
  - `hitButton` nearest-centre mapping, the pause strip, and the ignored board
- **`ui.test.js`:** `layoutFor` for all three modes; `fitScale` with a tall logical size (390×844 at dpr 3 → 4).
- **`render.test.js`:**
  - tall layout: the board fits the cabinet, the buttons sit in the side strips without overlapping the cabinet and stay inside 270×330, and the strip text fits
  - the tall table, its actions and the message lines fit
  - `useLayout` switches `cellXY`
- **`app.test.js`:** in tall mode, pointer down/up on `‹` moves the piece, and a double-tap on `v` hard-drops.
- **Browser:** emulate a phone (390×844 at dpr 3, touch) and check the menu, play with each button, the double-tap drop, pause by tapping the strip, initials via the buttons, the rotate screen in landscape, and that desktop is unchanged.

## Out of scope

Landscape touch play, swipe gestures, tablet-specific layouts (tablets get tall in portrait and the rotate screen in landscape), and remapping buttons.
