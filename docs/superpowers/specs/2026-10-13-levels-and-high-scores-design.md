# Scaffold levels, runs and high scores: design

Date: 2026-10-13 · Status: awaiting review · Source: Matthew's playtest notes in the Project TODO (2026-10-13)

## Goal

Turn a single timed build into a **run**: clear a level by reaching its target in time, then the next level starts on a fresh board with a full clock and faster drops. The run ends when a clock runs out. The score goes onto a local, arcade-style top-10 table with initials. The playtest tuning (targets, clocks, a clearer goal line) comes along.

**Success looks like:**
- A player can chain levels.
- They always know their level, score and goal.
- At the end they enter initials and see where they placed.
- Nothing about moving or placing pieces changes.

## Decisions (agreed in chat)

**Difficulty table** (replaces the current one in `ui.js`):

| | gaps | reach | target | clock | score weight |
|---|---|---|---|---|---|
| EASY | 2 | 6 | 8 | 3:00 | 1 |
| MEDIUM | 1 | 5 | 12 | 5:00 | 2 |
| HARD | 0 | 4 | 12 | 6:00 | 3 |

- **Target is set by difficulty.** The TARGET row leaves Settings, and a saved `target` value is ignored on load. Settings keeps lanes, sound and scanlines.
- **Drop speed per level:** `dropMs = 950 / (1 + 0.1 × levelsCleared)`, which is Matthew's `base + base·0.1·level` expressed as the interval between steps. Level 1 (0 cleared) is 950 ms, level 2 is 864 ms, level 3 is 792 ms, and so on. Soft drop stays at 55 ms.
- **Clock per level** (added after playtest, 2026-10-13): the difficulty's clock minus 1:00 per level cleared, never below 1:00.
- **Initials can be typed** (added after playtest): a letter or digit fills the slot and moves on, Backspace goes back, arrows still work; the RUN OVER box says `TYPE INITIALS, ENTER`.
- **Score:** `(levelsCleared × target + floorsOnFinalLevel) × weight`. Worked example: MEDIUM, 4 levels cleared, 3 floors on level 5 gives `(48 + 3) × 2 = 102`.
- **High scores:** one combined top 10 for all difficulties. Entries show rank, initials, score, difficulty letter (E/M/H) and level reached.

## Run flow

1. **Start:** choosing EASY / MEDIUM / HARD starts a run at level 1: an empty board, the full clock, drops at 950 ms.
2. **Level clear:** when the engine reports `status === 'won'` (the target is reached), a **LEVEL CLEAR** box appears over the board for 1500 ms, showing `LEVEL n CLEAR` and the leftover time (e.g. `1:42 LEFT`). The clock is stopped during it. Then the next level starts: a new `Game` with an empty board, a full clock, `dropMs` for the new level count, and the same lanes setting.
3. **Run over:** the run ends when a level's clock runs out (`status === 'lost'`), or when the entry is blocked and nothing is left to cut. That blocked case is `game.jammed && !game.pending`, which today leaves the player stuck. Pausing works as now. MENU from the pause box abandons the run without recording a score.
4. **Results:** a **RUN OVER** box shows the difficulty, the level reached and the total floors (e.g. `MEDIUM · LEVEL 5 · 51 FLOORS`), plus the score in big digits.
   - If the score qualifies, the box goes to **initials entry**, then the **table**.
   - If it doesn't, it goes straight to the table.
5. **Table screen:** the top 10, with the new entry (if any) blinking in yellow. Below it are **AGAIN** (a new run on the same difficulty) and **MENU**.

**Qualifying:**
- The score must be > 0.
- It qualifies when the table has fewer than 10 entries, or when it is strictly greater than the 10th score.
- Ties keep the older entry above the newer one.

## Initials entry

- **Slots:** three slots, starting from the last-used initials (stored with the scores) or `AAA`.
- **Characters:** A–Z, then 0–9, then space, cycling.
- **Keys:** ↑/↓ change the current slot. → or Enter moves to the next slot, and Enter on the third slot saves. ← moves back.
- **Lockout:** the 600 ms results lockout applies before any key is accepted, so a mashed drop key can't change letters or save.
- **Display:** the current slot is underlined and blinks.
- **Mouse:** none for entry. A keyboard is already required to play.

## Screens and layout

- **Title menu:** `EASY`, `MEDIUM`, `HARD`, `HIGH SCORES`, `SETTINGS`. HIGH SCORES opens the table with a `BACK` row (Esc works too). This is the same table renderer as after a run, minus the blinking entry.
- **Readout panel** (480×270 logical; panel at x 318, w 154). Every line must fit inside the panel, and a test checks the bottom line:
  - `TIME` label at y+10, digits at y+20, scale 3
  - `LEVEL` label at y+48, digits at y+58, scale 2
  - `SCORE` label at y+76, digits at y+86, scale 2
  - `FLOORS` label at y+104, `3/12` at y+114, scale 2
  - `NEXT` label at y+134, mini piece centred at y+162
  - beat line (`TICK ▶ SE` / `TOCK ◀ SW`) at y+190
  - `MEDIUM  CUTS 2` at y+202
  - `GAPS 1 REACH 5` at y+212
  - message: 3 lines from y+226
- **Goal line:**
  - The dashed yellow TOP line becomes a **solid 2 px yellow line**, labelled **GOAL**.
  - Empty cells above the goal row are outlined in **black** instead of navy, so the zone above the goal reads as "done territory". (The palette has nothing between navy and black; black was settled in chat.)
  - The REACH line and its label are unchanged.
- **Boxes** reuse `drawItems` and `drawBox` from `render.js`:
  - **LEVEL CLEAR:** title `LEVEL n CLEAR`, line `m:ss LEFT`. No rows, so it is drawn with a box-only helper.
  - **RUN OVER and entry:** title `RUN OVER`, the summary line, the score at scale 3, and three letter slots at scale 3 when entering.
  - **Table:** fits inside 300×200, centred on the screen. A dim dither sits behind it during play. Ten rows at scale 2 (they fit, and read better than scale 1), with columns for rank, initials, score (right-aligned), difficulty letter and `L5`.

## Code structure

| File | Change |
|---|---|
| `engine.js` | constructor option `dropMs=950`, used by `update()` in place of the literal `950` (one-line change). Its existing tests stay green; a new test covers `dropMs`. |
| `run.js` (new, pure) | `DIFFICULTY` table (above); `createRun(diffKey)` → state `{diff, level, cleared, banked}`; `levelOptions(run, lanes)` → the `Game` options for the current level; `dropMsFor(cleared)`; `onLevelWon(run)`; `runScore(run, game)`; `isRunOver(game)` (lost, or jammed and not pending) |
| `scores.js` (new, pure) | key `scaffold.scores`; `loadScores(storage)` / `saveScores(storage, data)` never throw; `qualifies(entries, score)`; `insertScore(entries, entry)` → `{entries, rank}` (keeps 10, ties older first); validation like `settings.js` |
| `ui.js` | difficulty table moves to `run.js` (`ui.js` re-exports or drops it); the target row is removed from `SETTING_ROWS`; new pure `initialsKey(state, key, repeat)` → `{state, done}` |
| `settings.js` | `target` is dropped from `DEFAULTS` and from `clean()` |
| `render.js` | goal line and black above-goal outlines; new `drawPanel` layout; `drawBanner` (title and lines, no rows); `drawScoreTable(ctx, entries, highlightRank, now)` |
| `app.js` | screens gain `scores`; play gains run state, level-clear timing, run-over → entry → table flow; the 600 ms lockout now covers entry too |

## Edge cases

- **Storage blocked or corrupt:** the scores are an empty table, saving fails silently and the game still runs. The same rule as settings.
- **Corrupt entries** (wrong types, too many, unknown difficulty): dropped one by one on load, and the list is re-sorted and capped at 10.
- **Level clear by hard drop:** the end is noticed inside the key handler, the same way as the results-lockout fix. The `endWatcher` treats `won` as a level clear, not a run end.
- **Clock running out during the LEVEL CLEAR banner:** can't happen, because the next `Game` hasn't started and the banner holds the run.
- **Leaving the window during the banner or entry:** the banner keeps its timer. Entry simply waits.

## Testing

- **`run.test.js`:**
  - the difficulty table values
  - `dropMsFor(0..3)` = 950, ≈863.6, ≈791.7, ≈730.8
  - score worked example = 102
  - level advance resets the board, the clock and the level count
  - the jam rule: `isRunOver` is true for jammed and not pending, false while pending
- **`scores.test.js`:**
  - qualification at 9/10/11 entries
  - a tie with the 10th doesn't qualify
  - insert order and rank, with ties older first
  - capped at 10
  - zero scores never qualify
  - corrupt and throwing storage
  - last-used initials round-trip
- **`ui.test.js`:** initials cycling A→Z→0→9→space→A both ways, slot moves, done on the last Enter, repeats ignored for select but allowed for ↑/↓
- **`render.test.js`:** the panel's lowest line stays inside the panel
- **`engine.test.js`:** a new test that `dropMs` changes gravity timing
- **Existing:** `strings.test.js` covers the new display text.
- **Browser checks:**
  - clear an EASY level (a shortened clock is fine) and see the banner, the next level, LEVEL 2 and faster drops
  - run over → entry → table with a blinking row
  - HIGH SCORES from the menu
  - goal line clarity
  - a fresh profile has an empty table

## Out of scope

The intro tutorial (next), online scores, mouse input for initials, deferred minors from the restyle review.
