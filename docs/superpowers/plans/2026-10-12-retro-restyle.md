# Retro Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Scaffold's prototype DOM/canvas UI with a 480×270, 16-color, pixel-art presentation: a sunset world, a title menu, settings, a bevelled cabinet board and a readout panel, all under animated scanlines. The game rules stay exactly as they are.

**Architecture:** A dev-only Python tool converts the user's art in `art/` into palette-locked PNGs and a manifest in `assets/`. The browser game draws everything on one low-res canvas, scaled up by a whole number with square pixels. Pure logic (palette, font, settings, menu layout, board geometry) lives in small ES modules with Node tests. `render.js` does the canvas drawing, and `app.js` is a small screen state machine (menu → settings → play, with a pause/over box on the play screen) that drives the unchanged `engine.js`.

**Tech Stack:** Vanilla ES modules, Canvas 2D, Node ≥ 20 (`node --test`, no runtime dependencies), Python 3 + Pillow (dev-only asset tool).

**Spec:** `docs/superpowers/specs/2026-10-12-retro-restyle-design.md`

## Global Constraints

- Logical screen is exactly **480×270**. Every drawn pixel uses one of the 16 palette colors: `030203 121871 14199a 32209d 714ec0 9316bc a359e5 e525ac fa5094 fc71b2 fd9e4b fee69c f3e6ac ffffff 3fbf6a 3ec8f0`. No alpha blending on the canvas (no `globalAlpha` and no translucent fills).
- `engine.js` and `engine.test.js` are **not modified**. All 32 existing tests must keep passing.
- No runtime dependencies. `package.json` gets no `dependencies`. Pillow is used only by `scripts/assets.py`.
- Display text is written **in capitals** using only the font's characters: `A–Z 0–9 space / : . , - ' ! ? ▶ ◀`.
- Settings are stored in `localStorage` under the key `scaffold.settings`. Defaults: target 8, lanes on, sound off, scanlines 0.6. Scanlines can be 0 (off) or 0.1 to 1.0 in steps of 0.1.
- Input is keyboard everywhere, plus mouse on menus and boxes. No touch controls.
- Difficulty table (unchanged from the current game): EASY gaps 2 / reach 6 / 10 min · MEDIUM 1 / 5 / 9 min · HARD 0 / 4 / 8 min.
- Do the work on a branch named `retro-restyle`, not on `main`.

## Review Focus

1. **Storage unavailable** (private browsing, blocked cookies, `localStorage` throws on access or write): the game must start with the defaults and never crash. Covered in Task 4.
2. **Tiny or odd window sizes** (smaller than 480×270, or very wide): the scale is a whole number of at least 1, never 0 or a fraction. Covered in Task 5 (`fitScale`).
3. **Art fails to load** (404, offline, missing manifest): the game is still playable, with code-drawn sky bands and a text logo. Covered in Task 7 (`loadAssets` tests).
4. **Long game messages** (cutback text, offcut counts): they must wrap into the readout panel and never run past it. Covered in Task 3 (`wrap`).
5. **Held or mashed keys across screen changes** (Space held while the game ends, Enter held on the menu): a held key must not select a menu item, and the game-over box ignores selects for 600 ms. Covered in Task 5 (`menuKey` ignores repeats) and Task 8 (the lockout).

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `art/comp-menu.png`, `art/backdrop.png`, `art/sprites.png`, `art/logo.png` | new | the user's source art, committed as-is |
| `scripts/assets.py` | new | converts `art/` into `assets/` (dev-only, Pillow) |
| `assets/*.png`, `assets/manifest.json` | new, generated, committed | finished assets |
| `assets.test.js` | new | manifest shape, plus the `loadAssets` failure behavior |
| `palette.js` / `palette.test.js` | new | the 16 colors, piece colors, bevel pairs |
| `font.js` / `font.test.js` | new | 5×7 bitmap font, `drawText`, `measure`, `wrap` |
| `settings.js` / `settings.test.js` | new | validated load and save of settings |
| `ui.js` / `ui.test.js` | new | pure UI logic: difficulty table, scale, box layout, hit testing, menu keys, settings rows, clock format |
| `render.js` / `render.test.js` | new | layout and hex geometry (pure, tested) plus all canvas drawing |
| `assets.js` | new | loads the manifest and images; failures leave gaps |
| `scripts/files.mjs` | new | the list of game files, shared by the server and the build |
| `server.mjs`, `scripts/build.mjs` | modify | serve and copy the new modules and `assets/` |
| `index.html`, `style.css` | rewrite | just the canvas, the scanline layer and scaling |
| `app.js` | rewrite | screen state machine, input, frame loop, sound |
| `strings.test.js` | new | every capitalized string in the UI code is drawable by the font |
| `README.md` | modify | controls and look |

---

### Task 1: Source art and asset pipeline

**Files:**
- Create: `art/comp-menu.png`, `art/backdrop.png`, `art/sprites.png`, `art/logo.png`
- Create: `scripts/assets.py`
- Create (generated): `assets/backdrop.png`, `assets/logo.png`, 13 sprite PNGs, `assets/manifest.json`
- Test: `assets.test.js`

**Interfaces:**
- Produces: `assets/manifest.json` with this shape, which later tasks rely on:
  ```json
  {"size":[480,270],"horizon":193,"bands":[{"y":0,"h":31,"color":"#14199a"}],
   "sun":{"x":313,"y":187,"r":19},"sprites":{"clock-island":[121,107]},"logo":[240,54]}
  ```
  Sprite names, exactly: `clock-island clock-winged clock-small island-castle island-sunset island-ruins island-tree cube-orange cube-blue cube-pink cube-orange-s cube-blue-s gem`. Each sprite is at `assets/<name>.png`, plus `assets/backdrop.png` (480×270, transparent where the sky is) and `assets/logo.png`.

- [ ] **Step 1: Create the branch and copy the art**

```bash
git switch -c retro-restyle
mkdir -p art
A=/home/frosty/.t3/userdata/attachments
cp "$A/3b7f1aaf-d285-423e-a44e-7bdfe3560fb7-bb1f42e8-21ef-455d-a0d1-269890704ac1.png" art/comp-menu.png
cp "$A/3b7f1aaf-d285-423e-a44e-7bdfe3560fb7-b7c3e79f-dc3d-4b7e-a3f2-a1f963f477ab.png" art/backdrop.png
cp "$A/3b7f1aaf-d285-423e-a44e-7bdfe3560fb7-a930730a-e639-44d9-af47-7fd76c65b841.png" art/sprites.png
cp "$A/3b7f1aaf-d285-423e-a44e-7bdfe3560fb7-c94192d9-aa17-460a-8340-f6b6cc4225a1.png" art/logo.png
python3 -c "from PIL import Image;[print(f,Image.open('art/'+f).size) for f in ['comp-menu.png','backdrop.png','sprites.png','logo.png']]"
```
Expected: four lines, each `(1672, 941)`.

- [ ] **Step 2: Write the failing manifest test**

Create `assets.test.js`:

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const PALETTE=['#030203','#121871','#14199a','#32209d','#714ec0','#9316bc','#a359e5','#e525ac','#fa5094','#fc71b2','#fd9e4b','#fee69c','#f3e6ac','#ffffff','#3fbf6a','#3ec8f0'];
const NAMES=['clock-island','clock-winged','clock-small','island-castle','island-sunset','island-ruins','island-tree','cube-orange','cube-blue','cube-pink','cube-orange-s','cube-blue-s','gem'];
const manifest=()=>JSON.parse(readFileSync(new URL('./assets/manifest.json',import.meta.url)));

test('manifest lists all 13 sprites with on-screen sizes and their files exist',()=>{
 const m=manifest();
 assert.deepEqual(Object.keys(m.sprites),NAMES);
 for(const [name,[w,h]] of Object.entries(m.sprites)){
  assert.ok(w>0&&w<=480&&h>0&&h<=270,`${name} ${w}x${h}`);
  assert.ok(existsSync(new URL(`./assets/${name}.png`,import.meta.url)),name);
 }
 for(const f of ['backdrop','logo'])assert.ok(existsSync(new URL(`./assets/${f}.png`,import.meta.url)),f);
 assert.deepEqual(m.size,[480,270]);
 assert.ok(m.logo[0]>=230&&m.logo[0]<=240,`logo width ${m.logo[0]}`);// cropping transparent edges may trim a pixel or two
});
test('sky bands are palette colors that tile the sky down to the horizon',()=>{
 const m=manifest();
 assert.ok(m.horizon>=100&&m.horizon<=250,`horizon ${m.horizon}`);
 assert.ok(m.bands.length>=5);
 let y=0;
 for(const b of m.bands){assert.equal(b.y,y);assert.ok(b.h>=3);assert.ok(PALETTE.includes(b.color),b.color);y+=b.h;}
 assert.equal(y,m.horizon);
 assert.ok(m.sun&&m.sun.r>0&&m.sun.y-m.sun.r<m.horizon,'sun must rise above the horizon');
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node --test assets.test.js`
Expected: FAIL with `ENOENT` (no `assets/manifest.json`).

- [ ] **Step 4: Write the asset tool**

Create `scripts/assets.py`:

```python

#!/usr/bin/env python3
"""Convert the source art in art/ into palette-locked game assets in assets/.

Dev-only (needs Pillow). Run from anywhere: python3 scripts/assets.py
Spec: docs/superpowers/specs/2026-10-12-retro-restyle-design.md
"""
import json
import math
from collections import Counter, deque
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
ART, OUT = ROOT / 'art', ROOT / 'assets'
W, H = 480, 270
PALETTE = ['030203', '121871', '14199a', '32209d', '714ec0', '9316bc', 'a359e5', 'e525ac',
           'fa5094', 'fc71b2', 'fd9e4b', 'fee69c', 'f3e6ac', 'ffffff', '3fbf6a', '3ec8f0']
RGB = [tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for h in PALETTE]
# Reading order on art/sprites.png: top row, middle row, bottom row; left to right.
SPRITE_ROWS = [
    ['clock-island', 'clock-winged', 'clock-small'],
    ['island-castle', 'island-sunset', 'island-ruins', 'island-tree'],
    ['cube-orange', 'cube-blue', 'cube-pink', 'cube-orange-s', 'cube-blue-s', 'gem'],
]
KEY_TOLERANCE = 110   # RGB distance from the magenta key that still counts as background
SKY_TOLERANCE = 48    # distance from a row's median colour that counts as sky band
LOGO_WIDTH = 240
# The sun is drawn by the game (in the palette it would vanish into the yellow band):
# centre x, centre y, radius at 480x270, measured from art/backdrop.png.
SUN = {'x': 313, 'y': 187, 'r': 19}
# Sky colours from dark zenith to bright horizon; sunset bands use them in this order.
SKY_LADDER = ['121871', '14199a', '32209d', '714ec0', '9316bc', 'e525ac', 'fa5094', 'fc71b2',
              'fd9e4b', 'fee69c', 'f3e6ac', 'ffffff']


def nearest(c, allowed=range(len(RGB))):
    return min(allowed, key=lambda i: sum((a - b) ** 2 for a, b in zip(c, RGB[i])))


def snap(img, exclude=()):
    """Return RGBA where every pixel is fully transparent or an exact palette colour.
    `exclude` lists palette hex codes this image must never use."""
    img = img.convert('RGBA')
    px, cache = img.load(), {}
    allowed = [i for i, h in enumerate(PALETTE) if h not in exclude]
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a < 128:
                px[x, y] = (0, 0, 0, 0)
                continue
            if (r, g, b) not in cache:
                cache[(r, g, b)] = RGB[nearest((r, g, b), allowed)]
            px[x, y] = (*cache[(r, g, b)], 255)
    return img


def despeckle(img):
    """Recolour single opaque pixels whose four neighbours are one other opaque colour."""
    src = img.copy().load()
    px = img.load()
    for y in range(1, img.height - 1):
        for x in range(1, img.width - 1):
            if src[x, y][3] == 0:
                continue
            around = {src[x + 1, y], src[x - 1, y], src[x, y + 1], src[x, y - 1]}
            if len(around) == 1:
                (c,) = around
                if c[3] == 255 and c != src[x, y]:
                    px[x, y] = c
    return img


def border_key(img):
    w, h = img.size
    px = img.load()
    edge = [px[x, 0] for x in range(w)] + [px[x, h - 1] for x in range(w)]
    return Counter(edge).most_common(1)[0][0]


def key_mask(img, key, flood):
    """Alpha mask (L): 0 = background. With flood=True only key pixels connected to the
    border are background, so key-like colours enclosed by an outline survive (the logo)."""
    w, h = img.size
    px = img.load()
    is_key = lambda x, y: math.dist(px[x, y], key) < KEY_TOLERANCE
    bg = bytearray(w * h)
    if not flood:
        for y in range(h):
            for x in range(w):
                bg[y * w + x] = is_key(x, y)
    else:
        q = deque()
        for x, y in [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + \
                    [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]:
            if not bg[y * w + x] and is_key(x, y):
                bg[y * w + x] = 1
                q.append((x, y))
        while q:
            x, y = q.popleft()
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and not bg[ny * w + nx] and is_key(nx, ny):
                    bg[ny * w + nx] = 1
                    q.append((nx, ny))
    return Image.frombytes('L', (w, h), bytes(0 if v else 255 for v in bg))


def shrink(rgb, mask, size, exclude=()):
    """Box-downscale colour and mask together; returns snapped, despeckled RGBA.
    Background is painted outline-black first so the key colour cannot bleed into edges."""
    rgb = Image.composite(rgb, Image.new('RGB', rgb.size, RGB[0]), mask)
    small = rgb.resize(size, Image.BOX).convert('RGBA')
    small.putalpha(mask.resize(size, Image.BOX).point(lambda v: 255 if v >= 128 else 0))
    out = despeckle(snap(small, exclude))
    return out.crop(out.getbbox())


def regions(mask, grid=4, min_cells=30):
    """Connected opaque regions on a coarse grid: list of (label_id, cells), and the label grid."""
    gw, gh = mask.width // grid, mask.height // grid
    small = mask.resize((gw, gh), Image.BOX).load()
    label = [[0] * gw for _ in range(gh)]
    found = []
    for y in range(gh):
        for x in range(gw):
            if small[x, y] > 40 and not label[y][x]:
                n = len(found) + 1
                label[y][x] = n
                stack, cells = [(x, y)], []
                while stack:
                    cx, cy = stack.pop()
                    cells.append((cx, cy))
                    for dx in (-2, -1, 0, 1, 2):
                        for dy in (-2, -1, 0, 1, 2):
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < gw and 0 <= ny < gh and small[nx, ny] > 40 and not label[ny][nx]:
                                label[ny][nx] = n
                                stack.append((nx, ny))
                found.append((n, cells))
    return [r for r in found if len(r[1]) >= min_cells], label


def sprites(scale):
    sheet = Image.open(ART / 'sprites.png').convert('RGB')
    mask = key_mask(sheet, border_key(sheet), flood=False)
    found, label = regions(mask)
    grid = 4
    rows = [[], [], []]
    for n, cells in found:
        xs, ys = [c[0] for c in cells], [c[1] for c in cells]
        box = (min(xs) * grid, min(ys) * grid, (max(xs) + 1) * grid, (max(ys) + 1) * grid)
        cy = (box[1] + box[3]) / 2
        rows[0 if cy < 300 else 1 if cy < 750 else 2].append((box[0], n, box))
    assert [len(r) for r in rows] == [len(r) for r in SPRITE_ROWS], \
        f'expected sprite rows {[len(r) for r in SPRITE_ROWS]}, found {[len(r) for r in rows]}'
    gw, gh = len(label[0]), len(label)
    out = {}
    for names, row in zip(SPRITE_ROWS, rows):
        for name, (_, n, box) in zip(names, sorted(row)):
            own = Image.frombytes('L', (gw, gh), bytes(255 if v == n else 0 for line in label for v in line))
            own = own.resize(sheet.size, Image.NEAREST)
            m = ImageChops.multiply(mask, own).crop(box)
            w, h = box[2] - box[0], box[3] - box[1]
            out[name] = shrink(sheet.crop(box), m, (max(1, round(w * scale)), max(1, round(h * scale))))
    return out


def logo():
    img = Image.open(ART / 'logo.png').convert('RGB')
    mask = key_mask(img, border_key(img), flood=True)
    box = mask.getbbox()
    w, h = box[2] - box[0], box[3] - box[1]
    # The logo is warm colours only; without this, blended edge pixels snap to green.
    return shrink(img.crop(box), mask.crop(box), (LOGO_WIDTH, round(h * LOGO_WIDTH / w)),
                  exclude=('3fbf6a', '3ec8f0', '14199a', '121871', '32209d'))


def backdrop():
    """480x270 RGBA: sea, sun and clouds opaque; sky bands and stars transparent.
    Returns (image, horizon, bands) where bands are palette-snapped medians per band."""
    low = Image.open(ART / 'backdrop.png').convert('RGB').resize((W, H), Image.BOX)
    px = low.load()
    strip = range(int(W * 0.36), int(W * 0.6))   # clear of side clouds and of the sun

    def median(y):
        cols = sorted(px[x, y] for x in strip)
        return cols[len(cols) // 2]

    def uniformity(y):
        m = median(y)
        return sum(math.dist(px[x, y], m) < 40 for x in strip) / len(strip)

    horizon = next(y for y in range(H // 4, H) if uniformity(y) < 0.9)
    # Split the sky where the art's own colour changes; blended boundary rows form slivers,
    # which fold into the band above.
    raw = []
    for y in range(horizon):
        m = median(y)
        if raw and math.dist(m, raw[-1]['ref']) <= 30:
            raw[-1]['h'] += 1
        else:
            raw.append({'y': y, 'h': 1, 'ref': m})
    merged = []
    for b in raw:
        if merged and b['h'] < 3:
            merged[-1]['h'] += b['h']
        else:
            merged.append(b)
    # Colour the sunset in ladder order (each band strictly brighter than the one above), taking
    # the closest such sequence overall. A thin band at the horizon (the glow line) is exempt.
    glow = merged.pop() if len(merged) > 1 and merged[-1]['h'] <= 12 else None
    ladder = [tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for h in SKY_LADDER]
    cost = lambda b, k: sum((a - c) ** 2 for a, c in zip(b['ref'], ladder[k]))
    n, size = len(merged), len(ladder)
    assert n <= size, f'{n} sky bands but only {size} ladder colours'
    best = [[math.inf] * size for _ in range(n)]
    prev = [[-1] * size for _ in range(n)]
    for k in range(size):
        best[0][k] = cost(merged[0], k)
    for i in range(1, n):
        run, arg = math.inf, -1
        for k in range(1, size):
            if best[i - 1][k - 1] < run:
                run, arg = best[i - 1][k - 1], k - 1
            if run < math.inf:
                best[i][k], prev[i][k] = run + cost(merged[i], k), arg
    k = min(range(size), key=lambda k: best[n - 1][k])
    for i in range(n - 1, -1, -1):
        merged[i]['color'] = '#' + SKY_LADDER[k]
        k = prev[i][k]
    if glow:
        glow['color'] = '#' + PALETTE[nearest(glow['ref'])]
        merged.append(glow)
    for b in merged:
        del b['ref']

    img = low.convert('RGBA')
    ipx = img.load()
    for y in range(horizon):
        m = median(y)
        for x in range(W):
            if math.dist(px[x, y], m) < SKY_TOLERANCE:
                ipx[x, y] = (0, 0, 0, 0)
    img = snap(img)
    ipx = img.load()
    # Stars are drawn by the game: drop small white/cream specks above the horizon.
    seen = set()
    light = {RGB[PALETTE.index('ffffff')], RGB[PALETTE.index('f3e6ac')], RGB[PALETTE.index('fee69c')]}
    for y in range(horizon):
        for x in range(W):
            if (x, y) in seen or ipx[x, y][3] == 0:
                continue
            comp, q = [], deque([(x, y)])
            seen.add((x, y))
            while q:
                cx, cy = q.popleft()
                comp.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < W and 0 <= ny < horizon and (nx, ny) not in seen and ipx[nx, ny][3]:
                        seen.add((nx, ny))
                        q.append((nx, ny))
            if len(comp) <= 12 and all(ipx[p][:3] in light for p in comp):
                for p in comp:
                    ipx[p] = (0, 0, 0, 0)
    return despeckle(img), horizon, merged


def check(name, img):
    allowed = set(RGB)
    data = img.tobytes()
    bad = {tuple(data[i:i + 3]) for i in range(0, len(data), 4) if data[i + 3] and tuple(data[i:i + 3]) not in allowed}
    assert not bad, f'{name}: off-palette colours {sorted(bad)[:5]}'


def main():
    OUT.mkdir(exist_ok=True)
    scale = W / Image.open(ART / 'sprites.png').width
    manifest = {'size': [W, H], 'sprites': {}}
    for name, img in sprites(scale).items():
        check(name, img)
        img.save(OUT / f'{name}.png')
        manifest['sprites'][name] = list(img.size)
    lg = logo()
    check('logo', lg)
    lg.save(OUT / 'logo.png')
    manifest['logo'] = list(lg.size)
    bd, horizon, bands = backdrop()
    check('backdrop', bd)
    bd.save(OUT / 'backdrop.png')
    manifest['horizon'], manifest['bands'], manifest['sun'] = horizon, bands, SUN
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=1) + '\n')
    print(f"wrote {len(manifest['sprites'])} sprites, logo {manifest['logo']}, "
          f"horizon {horizon}, {len(bands)} bands")


if __name__ == '__main__':
    main()
```

Note: `logo()` crops by the mask's bounding box. `mask.getbbox()` returns the bounding box of the non-zero (letter) pixels, which is what we want.

- [ ] **Step 5: Run the tool**

Run: `python3 scripts/assets.py`
Expected: `wrote 13 sprites, logo [240, …], horizon …, … bands` (takes up to a minute). If the assertion about sprite rows fails, print the region centers and fix the `cy < 300` / `cy < 750` thresholds to match the sheet's three rows.

- [ ] **Step 6: Look at the output**

Run:
```bash
python3 -c "
from PIL import Image; import json
m=json.load(open('assets/manifest.json'))
bg=Image.new('RGBA',(480,270))
from PIL import ImageDraw; d=ImageDraw.Draw(bg)
for b in m['bands']: d.rectangle([0,b['y'],479,b['y']+b['h']-1],fill=b['color'])
bd=Image.open('assets/backdrop.png'); bg.alpha_composite(bd)
lg=Image.open('assets/logo.png'); bg.alpha_composite(lg,(120,10))
bg.resize((1440,810),Image.NEAREST).save('/tmp/scaffold-preview.png')"
```
Open `/tmp/scaffold-preview.png`. Check:
- **Bands:** 8 sunset bands run dark to light (royal, indigo, violet, purple, magenta, hot pink, orange, yellow), plus a magenta glow line at the horizon. No speckle and no repeated colors.
- **Backdrop:** the sea, with the sun's reflection, and the side clouds rise above the horizon. There are no leftover stars.
- **Sun:** there is no sun disc in this preview. That's expected; the game draws it, in Task 7.
- **Logo:** the letters are intact, with pink and magenta lower bands, no holes, and no green or blue pixels.

When the tool reported these results during planning, the run gave 9 bands and horizon 193, with sun `{x:313,y:187,r:19}`.

- [ ] **Step 7: Run the test to verify it passes**

Run: `node --test assets.test.js`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add art scripts/assets.py assets assets.test.js
git commit -m "Add source art and palette-locked asset pipeline"
```

---

### Task 2: Palette

**Files:**
- Create: `palette.js`
- Test: `palette.test.js`

**Interfaces:**
- Produces: `C` (named colors as `'#rrggbb'`), `PALETTE` (array of 16), `PIECES` (10 colors, indexed by `SHAPES` id), `BEVEL` (map from fill color to `[light, dark]`), `LIGHT_PIECES` (a Set of fills that need dark marks on top of them).

- [ ] **Step 1: Write the failing test**

Create `palette.test.js`:

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {C,PALETTE,PIECES,BEVEL,LIGHT_PIECES} from './palette.js';
import {SHAPES} from './engine.js';

test('the palette is exactly the 16 locked colors',()=>{
 assert.deepEqual(PALETTE,['#030203','#121871','#14199a','#32209d','#714ec0','#9316bc','#a359e5','#e525ac','#fa5094','#fc71b2','#fd9e4b','#fee69c','#f3e6ac','#ffffff','#3fbf6a','#3ec8f0']);
 assert.equal(new Set(PALETTE).size,16);
});
test('every piece has its own color that never matches the board or frame colors',()=>{
 assert.equal(PIECES.length,SHAPES.length);
 assert.equal(new Set(PIECES).size,PIECES.length);
 for(const p of PIECES){assert.ok(PALETTE.includes(p));assert.ok(![C.black,C.navy,C.royal].includes(p),p);}
});
test('every piece color has a palette bevel pair',()=>{
 for(const p of PIECES){const pair=BEVEL[p];assert.ok(pair,p);for(const c of pair)assert.ok(PALETTE.includes(c));}
 for(const p of LIGHT_PIECES)assert.ok(PIECES.includes(p));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test palette.test.js`
Expected: FAIL with `Cannot find module './palette.js'`.

- [ ] **Step 3: Implement**

Create `palette.js`:

```js
// The locked 16-colour palette (docs/superpowers/specs/2026-10-12-retro-restyle-design.md).
export const C={black:'#030203',navy:'#121871',royal:'#14199a',indigo:'#32209d',violet:'#714ec0',purple:'#9316bc',lavender:'#a359e5',magenta:'#e525ac',hotpink:'#fa5094',pink:'#fc71b2',orange:'#fd9e4b',yellow:'#fee69c',cream:'#f3e6ac',white:'#ffffff',green:'#3fbf6a',cyan:'#3ec8f0'};
export const PALETTE=Object.values(C);
// One colour per SHAPES id: tetrahexes 0-6, then trihexes 7-9. First pick; tune by eye.
export const PIECES=[C.green,C.cyan,C.orange,C.yellow,C.hotpink,C.lavender,C.cream,C.magenta,C.white,C.pink];
// Chamfer: [upper-left facet, lower-right facet] for each fill.
export const BEVEL={
 [C.green]:[C.white,C.indigo],[C.cyan]:[C.white,C.indigo],[C.orange]:[C.yellow,C.magenta],
 [C.yellow]:[C.white,C.orange],[C.hotpink]:[C.pink,C.purple],[C.lavender]:[C.white,C.violet],
 [C.cream]:[C.white,C.lavender],[C.magenta]:[C.pink,C.purple],[C.white]:[C.white,C.lavender],
 [C.pink]:[C.white,C.magenta],
};
// Fills too light for the white pivot dot and step arrow; those marks are drawn black instead.
export const LIGHT_PIECES=new Set([C.yellow,C.cream,C.white,C.cyan]);
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test palette.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add palette.js palette.test.js
git commit -m "Add locked 16-color palette with piece and bevel colors"
```

---

### Task 3: Bitmap font

**Files:**
- Create: `font.js`
- Test: `font.test.js`

**Interfaces:**
- Produces:
  - `GLYPHS`: object mapping a character to an array of 7 strings of 5 chars (`'#'` is on).
  - `ADVANCE = 6`
  - `glyph(ch)`: returns the glyph rows. Lowercase maps to uppercase, and unknown characters fall back to `'?'`.
  - `measure(str, scale=1)`: width in pixels, `(len*6-1)*scale`, or 0 for an empty string.
  - `drawText(ctx, str, x, y, color, scale=1, align='left')`: draws with `ctx.fillRect` and returns the width. `align` is `'left'`, `'center'` or `'right'`, relative to `x`.
  - `wrap(str, maxChars, maxLines=2)`: returns an array of lines.

- [ ] **Step 1: Write the failing test**

Create `font.test.js`:

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GLYPHS,glyph,measure,drawText,wrap} from './font.js';

const CHARSET="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 /:.,-'!?▶◀";

test('every glyph is 7 rows of 5 pixels and the full charset exists',()=>{
 for(const ch of CHARSET)assert.ok(GLYPHS[ch],`missing ${ch}`);
 for(const [ch,rows] of Object.entries(GLYPHS)){
  assert.equal(rows.length,7,ch);
  for(const r of rows)assert.match(r,/^[#.]{5}$/,ch);
 }
});
test('lowercase draws as capitals and unknown characters draw as ?',()=>{
 assert.deepEqual(glyph('a'),GLYPHS.A);
 assert.deepEqual(glyph('—'),GLYPHS['?']);
});
test('measure and drawText agree and draw one rect per lit pixel',()=>{
 assert.equal(measure(''),0);
 assert.equal(measure('AB'),11);
 assert.equal(measure('AB',2),22);
 const rects=[];const ctx={set fillStyle(v){this.c=v;},fillRect:(x,y,w,h)=>rects.push([x,y,w,h])};
 const w=drawText(ctx,'I',10,20,'#fff',2,'center');
 assert.equal(w,measure('I',2));
 assert.equal(rects.length,GLYPHS.I.join('').split('#').length-1);
 assert.ok(rects.every(([x,y,rw,rh])=>rw===2&&rh===2&&x>=10-w/2-1&&y>=20));
});
test('wrap keeps lines within the width and line count, marking truncation',()=>{
 const msg='CUTBACK: 12 HEXES REMOVED. FLOOR 3 STAYS UNFINISHED.';
 const lines=wrap(msg,22,3);
 assert.ok(lines.length<=3);
 for(const l of lines)assert.ok(l.length<=22,l);
 assert.equal(lines.join(' '),msg);
 const cut=wrap('ONE TWO THREE FOUR FIVE SIX SEVEN',9,2);
 assert.equal(cut.length,2);
 assert.ok(cut[1].endsWith('..'));
 for(const l of cut)assert.ok(l.length<=9,l);
 assert.deepEqual(wrap('ABCDEFGHIJKL',5,3),['ABCDE','FGHIJ','KL']);
 assert.deepEqual(wrap('',5),[]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test font.test.js`
Expected: FAIL with `Cannot find module './font.js'`.

- [ ] **Step 3: Implement**

Create `font.js`:

```js
// 5x7 bitmap font, capitals only. Each glyph: 7 rows of 5 pixels, '#' lit.
const SRC={
 A:'.###.|#...#|#...#|#####|#...#|#...#|#...#',B:'####.|#...#|#...#|####.|#...#|#...#|####.',
 C:'.###.|#...#|#....|#....|#....|#...#|.###.',D:'####.|#...#|#...#|#...#|#...#|#...#|####.',
 E:'#####|#....|#....|####.|#....|#....|#####',F:'#####|#....|#....|####.|#....|#....|#....',
 G:'.###.|#...#|#....|#.###|#...#|#...#|.####',H:'#...#|#...#|#...#|#####|#...#|#...#|#...#',
 I:'.###.|..#..|..#..|..#..|..#..|..#..|.###.',J:'..###|...#.|...#.|...#.|...#.|#..#.|.##..',
 K:'#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',L:'#....|#....|#....|#....|#....|#....|#####',
 M:'#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#',N:'#...#|#...#|##..#|#.#.#|#..##|#...#|#...#',
 O:'.###.|#...#|#...#|#...#|#...#|#...#|.###.',P:'####.|#...#|#...#|####.|#....|#....|#....',
 Q:'.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',R:'####.|#...#|#...#|####.|#.#..|#..#.|#...#',
 S:'.####|#....|#....|.###.|....#|....#|####.',T:'#####|..#..|..#..|..#..|..#..|..#..|..#..',
 U:'#...#|#...#|#...#|#...#|#...#|#...#|.###.',V:'#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
 W:'#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.',X:'#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
 Y:'#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',Z:'#####|....#|...#.|..#..|.#...|#....|#####',
 0:'.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',1:'..#..|.##..|..#..|..#..|..#..|..#..|.###.',
 2:'.###.|#...#|....#|...#.|..#..|.#...|#####',3:'####.|....#|....#|.###.|....#|....#|####.',
 4:'...#.|..##.|.#.#.|#..#.|#####|...#.|...#.',5:'#####|#....|####.|....#|....#|#...#|.###.',
 6:'.###.|#....|#....|####.|#...#|#...#|.###.',7:'#####|....#|...#.|..#..|.#...|.#...|.#...',
 8:'.###.|#...#|#...#|.###.|#...#|#...#|.###.',9:'.###.|#...#|#...#|.####|....#|....#|.###.',
 ' ':'.....|.....|.....|.....|.....|.....|.....','/':'....#|....#|...#.|..#..|.#...|#....|#....',
 ':':'.....|..#..|..#..|.....|..#..|..#..|.....','.':'.....|.....|.....|.....|.....|.##..|.##..',
 ',':'.....|.....|.....|.....|.##..|..#..|.#...','-':'.....|.....|.....|#####|.....|.....|.....',
 "'":'..#..|..#..|.#...|.....|.....|.....|.....','!':'..#..|..#..|..#..|..#..|..#..|.....|..#..',
 '?':'.###.|#...#|....#|...#.|..#..|.....|..#..',
 '▶':'#....|##...|###..|####.|###..|##...|#....','◀':'....#|...##|..###|.####|..###|...##|....#',
};
export const GLYPHS=Object.fromEntries(Object.entries(SRC).map(([k,v])=>[k,v.split('|')]));
export const ADVANCE=6;
export const glyph=ch=>GLYPHS[ch.toUpperCase()]??GLYPHS['?'];
export const measure=(str,scale=1)=>str.length?([...str].length*ADVANCE-1)*scale:0;
export function drawText(ctx,str,x,y,color,scale=1,align='left'){
 const w=measure(str,scale);
 let cx=Math.round(align==='center'?x-w/2:align==='right'?x-w:x);
 ctx.fillStyle=color;
 for(const ch of str){
  const g=glyph(ch);
  for(let r=0;r<7;r++)for(let c=0;c<5;c++)if(g[r][c]==='#')ctx.fillRect(cx+c*scale,y+r*scale,scale,scale);
  cx+=ADVANCE*scale;
 }
 return w;
}
// Word-wrap to maxChars per line; overflow beyond maxLines is cut and marked with '..'.
export function wrap(str,maxChars,maxLines=2){
 const lines=[];let line='';
 for(let word of str.split(' ').filter(Boolean)){
  while(word.length>maxChars){if(line){lines.push(line);line='';}lines.push(word.slice(0,maxChars));word=word.slice(maxChars);}
  if(!word)continue;
  if(!line)line=word;else if(line.length+1+word.length<=maxChars)line+=' '+word;else{lines.push(line);line=word;}
 }
 if(line)lines.push(line);
 if(lines.length>maxLines){lines.length=maxLines;const last=lines[maxLines-1];lines[maxLines-1]=last.slice(0,maxChars-2)+'..';}
 return lines;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test font.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add font.js font.test.js
git commit -m "Add 5x7 bitmap font with measure and wrap"
```

---

### Task 4: Settings

**Files:**
- Create: `settings.js`
- Test: `settings.test.js`

**Interfaces:**
- Produces:
  - `KEY = 'scaffold.settings'`
  - `DEFAULTS = {target:8, lanes:true, sound:false, scanlines:0.6}` (frozen)
  - `TARGETS = [8,12,16]`
  - `clean(raw)`: returns a valid settings object.
  - `loadSettings(storage)`: never throws.
  - `saveSettings(storage, s)`: returns a boolean and never throws.

- [ ] **Step 1: Write the failing test**

Create `settings.test.js`:

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KEY,DEFAULTS,clean,loadSettings,saveSettings} from './settings.js';

const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),m};};

test('empty or missing storage gives the defaults',()=>{
 assert.deepEqual(loadSettings(memory()),DEFAULTS);
 assert.deepEqual(loadSettings(null),DEFAULTS);
 assert.deepEqual(loadSettings(undefined),DEFAULTS);
});
test('corrupt JSON and storage that throws give the defaults without crashing',()=>{
 const s=memory();s.setItem(KEY,'{not json');
 assert.deepEqual(loadSettings(s),DEFAULTS);
 const hostile={getItem(){throw new Error('SecurityError');},setItem(){throw new Error('QuotaExceeded');}};
 assert.deepEqual(loadSettings(hostile),DEFAULTS);
 assert.equal(saveSettings(hostile,DEFAULTS),false);
});
test('invalid fields fall back one by one; valid ones survive',()=>{
 assert.deepEqual(clean({target:12,lanes:'yes',sound:true,scanlines:NaN}),{...DEFAULTS,target:12,sound:true});
 assert.deepEqual(clean({target:9,scanlines:1.5}),DEFAULTS);
 assert.equal(clean({scanlines:0.30000000000000004}).scanlines,0.3);
 assert.equal(clean({scanlines:0}).scanlines,0);
 assert.deepEqual(clean([]),DEFAULTS);
});
test('settings round-trip through storage',()=>{
 const s=memory(),v={target:16,lanes:false,sound:true,scanlines:0.2};
 assert.equal(saveSettings(s,v),true);
 assert.deepEqual(loadSettings(s),v);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test settings.test.js`
Expected: FAIL with `Cannot find module './settings.js'`.

- [ ] **Step 3: Implement**

Create `settings.js`:

```js
// Player settings, kept in localStorage. Anything unreadable falls back to the defaults.
export const KEY='scaffold.settings';
export const DEFAULTS=Object.freeze({target:8,lanes:true,sound:false,scanlines:0.6});
export const TARGETS=[8,12,16];
export function clean(raw){
 const s={...DEFAULTS};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return s;
 if(TARGETS.includes(raw.target))s.target=raw.target;
 if(typeof raw.lanes==='boolean')s.lanes=raw.lanes;
 if(typeof raw.sound==='boolean')s.sound=raw.sound;
 if(typeof raw.scanlines==='number'&&raw.scanlines>=0&&raw.scanlines<=1)s.scanlines=Math.round(raw.scanlines*10)/10;
 return s;
}
export function loadSettings(storage){try{return clean(JSON.parse(storage.getItem(KEY)));}catch{return {...DEFAULTS};}}
export function saveSettings(storage,s){try{storage.setItem(KEY,JSON.stringify(clean(s)));return true;}catch{return false;}}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test settings.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add settings.js settings.test.js
git commit -m "Add validated settings storage"
```

---

### Task 5: Pure UI logic

**Files:**
- Create: `ui.js`
- Test: `ui.test.js`

**Interfaces:**
- Consumes: `measure` from `font.js`; `TARGETS` from `settings.js`.
- Produces:
  - `DIFFICULTIES`: `[{label:'EASY',gaps:2},{label:'MEDIUM',gaps:1},{label:'HARD',gaps:0}]`
  - `difficulty(gaps)`: returns `{gaps, reach, duration}`, ready to spread into `new Game({...})`.
  - `fitScale(w, h)`: returns a whole number ≥ 1.
  - `layoutBox(labels, {cx=240, y, scale=2, pad=8, gap=6, minWidth=0})`: returns `{x, y, w, h, rows:[{label, x, y, w, h}]}`.
  - `hit(rows, px, py)`: returns the row index, or -1.
  - `menuKey(count, cursor, key, repeat)`: returns `{cursor, select?}`.
  - `SETTING_ROWS = ['target','lanes','sound','scanlines','back']`
  - `settingLabel(row, s)` and `changeSetting(s, row, dir)` (the latter returns new settings).
  - `clock(ms)`: returns `'MM:SS'`.

- [ ] **Step 1: Write the failing test**

Create `ui.test.js`:

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DIFFICULTIES,difficulty,fitScale,layoutBox,hit,menuKey,SETTING_ROWS,settingLabel,changeSetting,clock} from './ui.js';
import {DEFAULTS} from './settings.js';

test('difficulty table matches the game rules',()=>{
 assert.deepEqual(DIFFICULTIES.map(d=>d.label),['EASY','MEDIUM','HARD']);
 assert.deepEqual(difficulty(2),{gaps:2,reach:6,duration:600000});
 assert.deepEqual(difficulty(1),{gaps:1,reach:5,duration:540000});
 assert.deepEqual(difficulty(0),{gaps:0,reach:4,duration:480000});
});
test('scale is a whole number of at least 1 for any window',()=>{
 assert.equal(fitScale(1920,1080),4);
 assert.equal(fitScale(1919,1080),3);
 assert.equal(fitScale(100,50),1);
 assert.equal(fitScale(0,0),1);
 assert.equal(fitScale(5000,300),1);
});
test('box rows stack inside the box without overlapping, and hit finds them',()=>{
 const b=layoutBox(['EASY','MEDIUM','HARD','SETTINGS'],{y:96,minWidth:120});
 assert.equal(b.rows.length,4);
 assert.ok(b.x>=0&&b.x+b.w<=480&&b.y+b.h<=270);
 for(let i=0;i<4;i++){const r=b.rows[i];
  assert.ok(r.x>=b.x&&r.x+r.w<=b.x+b.w&&r.y>=b.y&&r.y+r.h<=b.y+b.h);
  if(i)assert.ok(r.y>=b.rows[i-1].y+b.rows[i-1].h);
  assert.equal(hit(b.rows,r.x+1,r.y+1),i);
 }
 assert.equal(hit(b.rows,b.x-5,b.y-5),-1);
 assert.equal(Math.round(b.x+b.w/2),240);
});
test('menu keys wrap around and a held key never selects',()=>{
 assert.deepEqual(menuKey(4,0,'ArrowUp',false),{cursor:3});
 assert.deepEqual(menuKey(4,3,'ArrowDown',false),{cursor:0});
 assert.deepEqual(menuKey(4,2,'Enter',false),{cursor:2,select:2});
 assert.deepEqual(menuKey(4,2,' ',false),{cursor:2,select:2});
 assert.deepEqual(menuKey(4,2,'Enter',true),{cursor:2});
 assert.deepEqual(menuKey(4,2,'q',false),{cursor:2});
});
test('settings rows cycle targets, toggle switches, and clamp scanlines',()=>{
 let s={...DEFAULTS};
 assert.deepEqual(SETTING_ROWS,['target','lanes','sound','scanlines','back']);
 s=changeSetting(s,'target',1);assert.equal(s.target,12);
 s=changeSetting(s,'target',1);s=changeSetting(s,'target',1);assert.equal(s.target,8);
 s=changeSetting(s,'target',-1);assert.equal(s.target,16);
 assert.equal(changeSetting(s,'lanes',1).lanes,false);
 assert.equal(changeSetting(s,'sound',-1).sound,true);
 let t={...DEFAULTS,scanlines:0.9};
 t=changeSetting(t,'scanlines',1);t=changeSetting(t,'scanlines',1);assert.equal(t.scanlines,1);
 let u={...DEFAULTS,scanlines:0.1};
 u=changeSetting(u,'scanlines',-1);u=changeSetting(u,'scanlines',-1);assert.equal(u.scanlines,0);
 assert.equal(settingLabel('scanlines',u),'SCANLINES OFF');
 assert.equal(settingLabel('scanlines',{...DEFAULTS,scanlines:0.3}),'SCANLINES 0.3');
 assert.equal(settingLabel('target',s),'TARGET 16');
 assert.equal(settingLabel('lanes',{...DEFAULTS,lanes:false}),'EDGE LANES OFF');
 assert.equal(settingLabel('back',s),'BACK');
 assert.deepEqual(changeSetting(s,'back',1),s);
});
test('clock formats remaining time and never goes negative',()=>{
 assert.equal(clock(540000),'09:00');
 assert.equal(clock(59001),'01:00');
 assert.equal(clock(0),'00:00');
 assert.equal(clock(-5000),'00:00');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test ui.test.js`
Expected: FAIL with `Cannot find module './ui.js'`.

- [ ] **Step 3: Implement**

Create `ui.js`:

```js
// Pure UI logic: no canvas, no DOM. Screen units are logical pixels of the 480x270 canvas.
import {measure} from './font.js';
import {TARGETS} from './settings.js';

export const DIFFICULTIES=[{label:'EASY',gaps:2},{label:'MEDIUM',gaps:1},{label:'HARD',gaps:0}];
// Difficulty sets the gaps a row may keep, the reach above the top solid floor, and the clock.
export const difficulty=gaps=>({gaps,reach:[4,5,6][gaps],duration:[8,9,10][gaps]*60000});
export const fitScale=(w,h)=>Math.max(1,Math.floor(Math.min(w/480,h/270)));

export function layoutBox(labels,{cx=240,y,scale=2,pad=8,gap=6,minWidth=0}){
 const rowH=7*scale+6,inner=Math.max(minWidth,...labels.map(l=>measure(l,scale)+24));
 const w=inner+pad*2,h=labels.length*rowH+(labels.length-1)*gap+pad*2,x=Math.round(cx-w/2);
 return {x,y,w,h,rows:labels.map((label,i)=>({label,x:x+pad,y:y+pad+i*(rowH+gap),w:inner,h:rowH}))};
}
export const hit=(rows,px,py)=>rows.findIndex(r=>px>=r.x&&px<r.x+r.w&&py>=r.y&&py<r.y+r.h);
// Arrow keys move (wrapping); Enter/Space select, but never on key repeat.
export function menuKey(count,cursor,key,repeat){
 if(key==='ArrowUp')return {cursor:(cursor+count-1)%count};
 if(key==='ArrowDown')return {cursor:(cursor+1)%count};
 if((key==='Enter'||key===' ')&&!repeat)return {cursor,select:cursor};
 return {cursor};
}

export const SETTING_ROWS=['target','lanes','sound','scanlines','back'];
const onOff=v=>v?'ON':'OFF';
export function settingLabel(row,s){
 if(row==='target')return `TARGET ${s.target}`;
 if(row==='lanes')return `EDGE LANES ${onOff(s.lanes)}`;
 if(row==='sound')return `SOUND ${onOff(s.sound)}`;
 if(row==='scanlines')return `SCANLINES ${s.scanlines===0?'OFF':s.scanlines.toFixed(1)}`;
 return 'BACK';
}
export function changeSetting(s,row,dir){
 if(row==='target'){const i=TARGETS.indexOf(s.target);return {...s,target:TARGETS[(i+dir+TARGETS.length)%TARGETS.length]};}
 if(row==='lanes')return {...s,lanes:!s.lanes};
 if(row==='sound')return {...s,sound:!s.sound};
 if(row==='scanlines')return {...s,scanlines:Math.min(10,Math.max(0,Math.round(s.scanlines*10)+dir))/10};
 return s;
}
export function clock(ms){const s=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test ui.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add ui.js ui.test.js
git commit -m "Add pure UI logic: layout, menu keys, settings rows, clock"
```

---

### Task 6: Board geometry

**Files:**
- Create: `render.js` (geometry part only, drawing is added in Tasks 7 and 8)
- Test: `render.test.js`

**Interfaces:**
- Consumes: `WIDTH`, `HEIGHT`, `LANE` from `engine.js`.
- Produces:
  - `LAYOUT = {W:480, H:270, BX:156, BY:14, cabinet:{x:150,y:8,w:159,h:255}, panel:{x:318,y:8,w:154,h:255}}`
  - `HEX_ROWS`, `HEX_W = 14`, `HEX_H = 15`, `HEX_PIXELS` (an `[x,y][]`), `HEX_BOTTOM` (the lowest `y` in each column x)
  - `edgeOf(x, y)`: returns `'light'`, `'dark'` or `null`.
  - `cellXY(c, r)`: returns `{x, y}`, the top-left corner of the tile for board column `c` (−1 and `WIDTH` are the lanes) and row `r`.
  - `rowTop(r)`: returns the y of the line between rows `r−1` and `r`.

- [ ] **Step 1: Write the failing test**

Create `render.test.js`:

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LAYOUT,HEX_W,HEX_H,HEX_PIXELS,HEX_BOTTOM,edgeOf,cellXY} from './render.js';
import {Game,WIDTH,HEIGHT} from './engine.js';

test('hex tiles interlock: no pixel is drawn twice and the interior has no holes',()=>{
 const count=new Map();
 for(let r=0;r<6;r++)for(let c=0;c<6;c++){const {x,y}=cellXY(c,r);
  for(const [px,py] of HEX_PIXELS){const k=`${x+px},${y+py}`;count.set(k,(count.get(k)??0)+1);}}
 for(const [k,n] of count)assert.equal(n,1,`pixel ${k} drawn ${n} times`);
 const a=cellXY(1,1),b=cellXY(4,4);
 for(let y=a.y+HEX_H;y<b.y;y++)for(let x=a.x+HEX_W;x<b.x;x++)assert.ok(count.has(`${x},${y}`),`hole at ${x},${y}`);
});
test('the board with both lanes fits inside the cabinet, and nothing leaves the screen',()=>{
 const {cabinet:k,panel:p,W,H}=LAYOUT;
 const left=cellXY(-1,0).x,right=cellXY(WIDTH,1).x+HEX_W,top=cellXY(0,0).y,bottom=cellXY(0,HEIGHT-1).y+HEX_H;
 assert.ok(left>=k.x+3&&right<=k.x+k.w-3,`board x ${left}..${right}`);
 assert.ok(top>=k.y+3&&bottom+2<=k.y+k.h-3,`board y ${top}..${bottom}`);
 for(const r of [k,p])assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=W&&r.y+r.h<=H);
 assert.ok(k.x+k.w<=p.x,'panel overlaps cabinet');
});
test('tile positions follow the engine: odd rows sit half a hex right',()=>{
 const g=new Game({lanes:false});g.piece={id:8,cells:[[0,0]],q:3,r:2};
 const at=()=>{const {c,r}=g.cells()[0];return cellXY(c,r);};
 const a=at();g.down();const b=at();
 assert.deepEqual([b.x-a.x,b.y-a.y],[7,12]);// default beat steps SE from an even row
 g.flipBeat();g.down();const c=at();
 assert.deepEqual([c.x-b.x,c.y-b.y],[7,12]);// flipped beat from an odd row also goes SE
 g.down();const d=at();
 assert.deepEqual([d.x-c.x,d.y-c.y],[-7,12]);
});
test('bevel edges: top-left facets are light, bottom-right dark, the middle plain',()=>{
 assert.equal(edgeOf(6,0),'light');
 assert.equal(edgeOf(0,6),'light');
 assert.equal(edgeOf(13,6),'dark');
 assert.equal(edgeOf(7,14),'dark');
 assert.equal(edgeOf(7,7),null);
 assert.equal(HEX_BOTTOM.length,HEX_W);
 assert.equal(Math.max(...HEX_BOTTOM),HEX_H-1);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test render.test.js`
Expected: FAIL with `Cannot find module './render.js'`.

- [ ] **Step 3: Implement**

Create `render.js`:

```js
// Board geometry and all canvas drawing for the 480x270 screen.
import {WIDTH,HEIGHT,LANE} from './engine.js';

export const LAYOUT={W:480,H:270,BX:156,BY:14,cabinet:{x:150,y:8,w:159,h:255},panel:{x:318,y:8,w:154,h:255}};
// Pointy-top hex, 14 wide and 15 tall; rows sit 12 apart and odd rows shift 7, so tiles interlock exactly.
export const HEX_ROWS=[[6,7],[4,9],[2,11],...Array(9).fill([0,13]),[1,12],[3,10],[5,8]];
export const HEX_W=14,HEX_H=HEX_ROWS.length;
const inHex=(x,y)=>y>=0&&y<HEX_H&&x>=HEX_ROWS[y][0]&&x<=HEX_ROWS[y][1];
export const HEX_PIXELS=HEX_ROWS.flatMap(([a,b],y)=>Array.from({length:b-a+1},(_,i)=>[a+i,y]));
export const HEX_BOTTOM=Array.from({length:HEX_W},(_,x)=>Math.max(...HEX_PIXELS.filter(p=>p[0]===x).map(p=>p[1])));
export function edgeOf(x,y){
 if(!inHex(x-1,y)||!inHex(x,y-1))return 'light';
 if(!inHex(x+1,y)||!inHex(x,y+1))return 'dark';
 return null;
}
// Lane columns (-1 and WIDTH) always keep their space so the board never shifts.
export const cellXY=(c,r)=>({x:LAYOUT.BX+14*(c+LANE)+7*(r%2),y:LAYOUT.BY+12*r});
export const rowTop=r=>LAYOUT.BY+12*r+1;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test render.test.js`
Expected: PASS (4 tests). If the interlock test reports a doubled or missing pixel, the `HEX_ROWS` taper rows are wrong. Check them against the spec's 14×16 note: the final tile is 15 tall because the complementary taper needs only 3 rows.

- [ ] **Step 5: Commit**

```bash
git add render.js render.test.js
git commit -m "Add interlocking hex tile and board layout geometry"
```

---

### Task 7: Shell, world, menu and settings screens

This task replaces the page, server, build and app shell. After it, the title menu and settings screens work fully. Selecting a difficulty switches to the play screen, which Task 8 draws, so until then it shows only the world behind an empty cabinet.

**Files:**
- Create: `scripts/files.mjs`, `assets.js`
- Modify: `server.mjs` (whole file), `scripts/build.mjs` (whole file), `assets.test.js` (append)
- Rewrite: `index.html`, `style.css`, `app.js`
- Modify: `render.js` (append drawing functions)

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces (in `render.js`, used by Task 8):
  - `tile(kind, color)`, where `kind` is `'solid'`, `'outline'` or `'dashed'`; returns a cached canvas.
  - `drawBox(ctx, x, y, w, h, fill=C.navy)`
  - `drawItems(ctx, box, cursor, now, {title='', lines=[]}={})`
  - `drawSky(ctx, manifest, now)`, `drawBackdrop(ctx, assets)`, `drawSprites(ctx, assets, list, now)`, `drawDim(ctx)`, `drawLogo(ctx, assets)`, `drawControls(ctx)`
  - `MENU_SCENERY`, `PLAY_SCENERY`
- Produces (in `assets.js`): `loadAssets(base='assets/', {fetchJson, loadImage}={})`, which resolves to `{manifest, images}` and never rejects.

- [ ] **Step 1: Write the failing loader test**

Append to `assets.test.js`:

```js
import {loadAssets} from './assets.js';

test('loadAssets survives a missing manifest and missing images',async()=>{
 const none=await loadAssets('x/',{fetchJson:()=>Promise.reject(new Error('404')),loadImage:()=>Promise.resolve({})});
 assert.deepEqual(none,{manifest:null,images:{}});
 const m={sprites:{gem:[10,10],'cube-blue':[5,5]}};
 const some=await loadAssets('x/',{fetchJson:async()=>m,loadImage:async src=>{if(src.includes('gem'))throw new Error('404');return {src};}});
 assert.equal(some.manifest,m);
 assert.deepEqual(Object.keys(some.images).sort(),['backdrop','cube-blue','logo']);
 assert.equal(some.images['cube-blue'].src,'x/cube-blue.png');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test assets.test.js`
Expected: FAIL with `Cannot find module './assets.js'`.

- [ ] **Step 3: Implement the loader**

Create `assets.js`:

```js
// Loads the converted art (scripts/assets.py). Anything missing is skipped; the game still runs.
const json=url=>fetch(url).then(r=>{if(!r.ok)throw new Error(`${r.status} ${url}`);return r.json();});
const image=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});
export async function loadAssets(base='assets/',{fetchJson=json,loadImage=image}={}){
 const out={manifest:null,images:{}};
 try{out.manifest=await fetchJson(`${base}manifest.json`);}catch{return out;}
 const names=['backdrop','logo',...Object.keys(out.manifest.sprites??{})];
 await Promise.all(names.map(async n=>{try{out.images[n]=await loadImage(`${base}${n}.png`);}catch{}}));
 return out;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test assets.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Shared file list, server and build**

Create `scripts/files.mjs`:

```js
// Files that make up the game: served by server.mjs and copied to dist/ by build.mjs.
export const GAME_FILES=['index.html','style.css','app.js','engine.js','palette.js','font.js','ui.js','render.js','assets.js','settings.js'];
export const ASSET_PATH=/^assets\/[a-z0-9-]+\.(png|json)$/;
```

Replace `server.mjs` with:

```js
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname} from 'node:path';
import {GAME_FILES,ASSET_PATH} from './scripts/files.mjs';

const port=Number(process.env.PORT||4173);
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png'};
function resolve(url){
 let path;try{path=decodeURIComponent((url||'/').split('?')[0]);}catch{return null;}
 if(path==='/')return 'index.html';
 const rel=path.slice(1);
 return GAME_FILES.includes(rel)||ASSET_PATH.test(rel)?rel:null;
}
const server=createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
 const file=resolve(req.url);
 if(!file){res.writeHead(404);res.end('Not found');return;}
 try{
  const bytes=await readFile(new URL(file,import.meta.url));
  res.writeHead(200,{'Content-Type':TYPES[extname(file)],'Cache-Control':'no-store'});
  res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.on('error',err=>{console.error(`Cannot start Scaffold: ${err.message}`);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Scaffold: http://127.0.0.1:${port}`));
```

Replace `scripts/build.mjs` with:

```js
import {mkdir,copyFile,readdir,rm} from 'node:fs/promises';
import {GAME_FILES,ASSET_PATH} from './files.mjs';
const root=new URL('../',import.meta.url),dist=new URL('dist/',root);
await rm(dist,{recursive:true,force:true});
await mkdir(new URL('assets/',dist),{recursive:true});
for(const file of GAME_FILES)await copyFile(new URL(file,root),new URL(file,dist));
for(const name of await readdir(new URL('assets/',root)))if(ASSET_PATH.test(`assets/${name}`))await copyFile(new URL(`assets/${name}`,root),new URL(`assets/${name}`,dist));
console.log('Scaffold static files ready in dist/');
```

- [ ] **Step 6: Page and stylesheet**

Replace `index.html` with:

```html
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#030203"><title>Scaffold</title><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath fill='%23fd9e4b' d='M16 1 30 9v14l-14 8L2 23V9z'/%3E%3C/svg%3E"><link rel="stylesheet" href="style.css"></head>
<body><div id="screen"><canvas id="game" width="480" height="270" aria-label="Scaffold, a hex construction game"></canvas><div id="scan"></div></div><script type="module" src="app.js"></script></body></html>
```

Replace `style.css` with:

```css
html,body{margin:0;height:100%;background:#030203;overflow:hidden}
body{display:grid;place-items:center}
#screen{position:relative;width:480px;height:270px}
#game{display:block;width:100%;height:100%;image-rendering:crisp-edges;image-rendering:pixelated;cursor:default}
/* Thin CRT scanlines at display resolution, drifting slowly downward. Opacity comes from Settings. */
#scan{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(to bottom,#000 0 1px,transparent 1px 3px);opacity:.6;animation:scan 1.5s linear infinite}
@keyframes scan{to{background-position:0 3px}}
@media (prefers-reduced-motion:reduce){#scan{animation:none}}
```

- [ ] **Step 7: World and menu drawing**

Append to `render.js`. Merge the two new import lines into the top of the file, under the existing `engine.js` import.

```js
import {C,PIECES,BEVEL} from './palette.js';
import {drawText} from './font.js';

const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
const TILES=new Map();
// Cached hex tile: 'solid' = filled with chamfer, 'outline' = edge only, 'dashed' = every other edge pixel.
export function tile(kind,color){
 const key=kind+color;let t=TILES.get(key);if(t)return t;
 t=canvas(HEX_W,HEX_H);const g=t.getContext('2d'),[light,dark]=BEVEL[color]??[color,color];
 for(const [x,y] of HEX_PIXELS){
  const e=edgeOf(x,y);let fill=null;
  if(kind==='solid')fill=e==='light'?light:e==='dark'?dark:color;
  else if(e&&(kind==='outline'||(x+y)%2===0))fill=color;
  if(fill){g.fillStyle=fill;g.fillRect(x,y,1,1);}
 }
 TILES.set(key,t);return t;
}
export function drawBox(ctx,x,y,w,h,fill=C.navy){
 ctx.fillStyle=C.black;ctx.fillRect(x,y,w,h);
 ctx.fillStyle=C.lavender;ctx.fillRect(x+1,y+1,w-2,2);ctx.fillRect(x+1,y+1,2,h-2);
 ctx.fillStyle=C.indigo;ctx.fillRect(x+1,y+h-3,w-2,2);ctx.fillRect(x+w-3,y+1,2,h-2);
 ctx.fillStyle=fill;ctx.fillRect(x+3,y+3,w-6,h-6);
}
// A layoutBox (ui.js) drawn as a bevelled menu; optional title and info lines sit above the rows.
export function drawItems(ctx,box,cursor,now,{title='',lines=[]}={}){
 const top=title?box.y-(lines.length?40:24):box.y;
 drawBox(ctx,box.x,top,box.w,box.y+box.h-top);
 if(title)drawText(ctx,title,box.x+box.w/2,top+8,C.yellow,2,'center');
 lines.forEach((l,i)=>drawText(ctx,l,box.x+box.w/2,top+26+i*9,C.white,1,'center'));
 box.rows.forEach((r,i)=>{
  const sel=i===cursor;
  ctx.fillStyle=sel?C.yellow:C.indigo;ctx.fillRect(r.x,r.y,r.w,r.h);
  ctx.fillStyle=sel?C.indigo:C.navy;ctx.fillRect(r.x+1,r.y+1,r.w-2,r.h-2);
  drawText(ctx,r.label,r.x+r.w/2,r.y+3,C.white,2,'center');
  if(sel&&Math.floor(now/400)%2===0)drawText(ctx,'▶',r.x+4,r.y+3,C.yellow,2);
 });
}

// Sky: palette bands and the sun from the manifest (or a fallback), then twinkling stars in the upper half.
const FALLBACK_SKY={horizon:184,sun:{x:313,y:178,r:19},bands:[C.royal,C.indigo,C.violet,C.purple,C.magenta,C.hotpink,C.orange,C.yellow].map((color,i)=>({y:i*23,h:23,color}))};
// Synthwave sun: a white disc whose lower part is cut by horizontal stripes showing the bands behind.
function drawSun(ctx,{x,y,r},horizon){
 ctx.fillStyle=C.white;
 for(let row=y-r;row<horizon;row++){
  const d=row-y;if(d>=-7&&(d+99)%3===0)continue;
  const half=Math.floor(Math.sqrt(Math.max(0,r*r-d*d)));ctx.fillRect(x-half,row,half*2+1,1);
 }
}
export const STARS=Array.from({length:24},(_,i)=>({x:(i*7919+13)%480,y:4+(i*104729+7)%88,big:i%3===0,phase:i*1.3}));
export function drawSky(ctx,manifest,now){
 const {horizon,bands,sun}=manifest?.bands?.length?manifest:FALLBACK_SKY;
 for(const b of bands){ctx.fillStyle=b.color;ctx.fillRect(0,b.y,480,b.h);}
 if(sun)drawSun(ctx,sun,horizon);
 ctx.fillStyle=C.violet;ctx.fillRect(0,horizon,480,270-horizon);
 for(const s of STARS){
  if(s.y>=horizon/2)continue;
  const twinkle=Math.sin(now/700+s.phase)>0.85;
  ctx.fillStyle=twinkle?C.cream:C.white;
  if(s.big&&!twinkle){ctx.fillRect(s.x-2,s.y,5,1);ctx.fillRect(s.x,s.y-2,1,5);}else ctx.fillRect(s.x,s.y,1,1);
 }
}
export function drawBackdrop(ctx,assets){const i=assets.images.backdrop;if(i)ctx.drawImage(i,0,0);}

// Scenery: [sprite name, x, y]. Sprites bob by 1 px; clocks drip now and then.
export const MENU_SCENERY=[['clock-island',2,18],['island-castle',10,150],['clock-winged',378,16],['island-ruins',362,124],['gem',96,96],['cube-orange-s',440,226]];
export const PLAY_SCENERY=[['clock-island',8,8],['island-sunset',14,140],['cube-blue-s',112,236]];
const DRIPS={'clock-island':[.42,.96],'clock-winged':[.47,.96],'clock-small':[.5,.96]};
export function drawSprites(ctx,assets,list,now){
 list.forEach(([name,x,y],i)=>{
  const img=assets.images[name];if(!img)return;
  const by=y+(Math.sin(now/900+i*1.7)>0?1:0);
  ctx.drawImage(img,x,by);
  const d=DRIPS[name],t=(now+i*1300)%4000;
  if(d&&t<700){ctx.fillStyle=C.cream;ctx.fillRect(Math.round(x+d[0]*img.width),Math.round(by+d[1]*img.height)+Math.floor(t/700*8),1,1);}
 });
}
// Play-screen dimming: a 1-in-4 black dither keeps every pixel on the palette.
let dimPattern=null;
export function drawDim(ctx){
 if(!dimPattern){const p=canvas(2,2),g=p.getContext('2d');g.fillStyle=C.black;g.fillRect(0,0,1,1);dimPattern=ctx.createPattern(p,'repeat');}
 ctx.fillStyle=dimPattern;ctx.fillRect(0,0,480,270);
}
export function drawLogo(ctx,assets){
 const i=assets.images.logo;
 if(i)ctx.drawImage(i,Math.round(240-i.width/2),10);
 else drawText(ctx,'SCAFFOLD',240,20,C.orange,5,'center');
}
export function drawControls(ctx){
 drawBox(ctx,92,220,296,32);
 drawText(ctx,'ARROWS STEER   UP X Z ROTATE   DOWN FASTER',240,227,C.cream,1,'center');
 drawText(ctx,'SHIFT CHANGE BEAT   SPACE DROP   P PAUSE',240,238,C.cream,1,'center');
}
```

- [ ] **Step 8: App shell with menu and settings**

Replace `app.js` with the following. The `play` branch is completed in Task 8. For now it draws the world and an empty cabinet.

```js
import {Game,HEIGHT} from './engine.js';
import {C} from './palette.js';
import {loadAssets} from './assets.js';
import {loadSettings,saveSettings} from './settings.js';
import {DIFFICULTIES,difficulty,fitScale,layoutBox,hit,menuKey,SETTING_ROWS,settingLabel,changeSetting} from './ui.js';
import {LAYOUT,drawSky,drawBackdrop,drawSprites,drawDim,drawBox,drawItems,drawLogo,drawControls,MENU_SCENERY,PLAY_SCENERY} from './render.js';

const canvas=document.getElementById('game'),ctx=canvas.getContext('2d'),screenEl=document.getElementById('screen'),scanEl=document.getElementById('scan');
ctx.imageSmoothingEnabled=false;
const store=(()=>{try{return window.localStorage;}catch{return null;}})();
let settings=loadSettings(store),assets={manifest:null,images:{}};
let screen='menu',cursor=1,settingsCursor=0,boxCursor=0,game=null,diff=DIFFICULTIES[1],soft=false,last=0;
let flash=null,offcut=null,message='',messageUntil=0,overSince=0,audio;
loadAssets().then(a=>{assets=a;});

function resize(){const s=fitScale(innerWidth,innerHeight);screenEl.style.width=`${480*s}px`;screenEl.style.height=`${270*s}px`;}
addEventListener('resize',resize);resize();
const applyScan=()=>{scanEl.style.opacity=String(settings.scanlines);};
applyScan();

function tone(freq=260,dur=.08){if(!settings.sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type='triangle';osc.frequency.value=freq;gain.gain.setValueAtTime(.05,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+dur);osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+dur);}catch{}}
function note(s){message=s;messageUntil=performance.now()+5000;}

const menuLayout=()=>layoutBox([...DIFFICULTIES.map(d=>d.label),'SETTINGS'],{y:96,minWidth:120});
const settingsLayout=()=>layoutBox(SETTING_ROWS.map(r=>settingLabel(r,settings)),{y:80,minWidth:200});

function start(d){
 diff=d;game=new Game({target:settings.target,lanes:settings.lanes,...difficulty(d.gaps)});
 screen='play';flash=offcut=null;soft=false;boxCursor=0;last=performance.now();
 note('BUILD FLOOR 1 FIRST.');tone(440);
}
function toMenu(){screen='menu';game=null;soft=false;}
function updateSettings(next){const soundOn=!settings.sound&&next.sound;settings=next;saveSettings(store,settings);applyScan();if(soundOn)tone(660);}

function menuInput(k,repeat){
 const r=menuKey(DIFFICULTIES.length+1,cursor,k,repeat);cursor=r.cursor;
 if(r.select===undefined)return;
 if(r.select<DIFFICULTIES.length)start(DIFFICULTIES[r.select]);else{screen='settings';settingsCursor=0;}
}
function settingsInput(k,repeat){
 const row=SETTING_ROWS[settingsCursor];
 if(k==='Escape'){screen='menu';return;}
 if(k==='ArrowLeft'||k==='ArrowRight'){updateSettings(changeSetting(settings,row,k==='ArrowLeft'?-1:1));return;}
 const r=menuKey(SETTING_ROWS.length,settingsCursor,k,repeat);settingsCursor=r.cursor;
 if(r.select===undefined)return;
 if(row==='back')screen='menu';else updateSettings(changeSetting(settings,row,1));
}
function playInput(k,repeat){}

addEventListener('keydown',e=>{
 if(e.ctrlKey||e.metaKey||e.altKey)return;
 const k=e.key.length===1?e.key.toLowerCase():e.key;
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Enter','Escape','Shift','p','x','z'].includes(k))e.preventDefault();
 if(screen==='menu')menuInput(k,e.repeat);
 else if(screen==='settings')settingsInput(k,e.repeat);
 else playInput(k,e.repeat);
});
addEventListener('keyup',e=>{if(e.key==='ArrowDown')soft=false;});

const toCanvas=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*480/r.width,(e.clientY-r.top)*270/r.height];};
function activeRows(){
 if(screen==='menu')return menuLayout().rows;
 if(screen==='settings')return settingsLayout().rows;
 return null;
}
function setCursor(i){if(screen==='menu')cursor=i;else if(screen==='settings')settingsCursor=i;else boxCursor=i;}
canvas.addEventListener('mousemove',e=>{const rows=activeRows();if(!rows)return;const i=hit(rows,...toCanvas(e));if(i>=0)setCursor(i);});
canvas.addEventListener('click',e=>{
 const rows=activeRows();if(!rows)return;const i=hit(rows,...toCanvas(e));if(i<0)return;setCursor(i);
 if(screen==='menu')menuInput('Enter',false);else if(screen==='settings')settingsInput('Enter',false);else playInput('Enter',false);
});

function draw(now){
 drawSky(ctx,assets.manifest,now);drawBackdrop(ctx,assets);
 if(screen==='play'){
  drawSprites(ctx,assets,PLAY_SCENERY,now);drawDim(ctx);
  const k=LAYOUT.cabinet;drawBox(ctx,k.x,k.y,k.w,k.h,C.royal);
  return;
 }
 drawSprites(ctx,assets,MENU_SCENERY,now);drawLogo(ctx,assets);
 if(screen==='menu'){drawItems(ctx,menuLayout(),cursor,now);drawControls(ctx);}
 else drawItems(ctx,settingsLayout(),settingsCursor,now);
}
function frame(now){last=now;draw(now);requestAnimationFrame(frame);}
requestAnimationFrame(frame);
```

- [ ] **Step 9: Run all tests and the build**

Run: `npm test && npm run build && ls dist dist/assets | head -30`
Expected: all tests pass (the 32 engine tests plus every new file's tests), and `dist/` contains the 10 game files and `assets/` with 15 PNGs and `manifest.json`.

- [ ] **Step 10: Check it in the browser**

Run `PORT=4173 npm start` in the background, then open `http://127.0.0.1:4173` (in a browser or with Playwright) and take screenshots. Check each of these:
- **Menu:** the sunset bands are crisp, the striped white sun sits on the horizon above its reflection, stars twinkle, the clocks and islands bob, the logo is intact and centered, and the menu shows EASY / MEDIUM / HARD / SETTINGS with a blinking ▶ on MEDIUM. The controls box sits at the bottom, and no sprite overlaps the logo, the menu box or the controls box. If one does, adjust its coordinates in `MENU_SCENERY` and check again.
- **Scaling and scanlines:** resizing the window keeps square pixels at a whole-number scale, and the scanlines drift.
- **Keyboard on the menu:** ↑/↓ moves the cursor and wraps. Enter on SETTINGS opens settings.
- **Settings:** ←/→ change values. SCANLINES visibly changes the line strength. Esc returns to the menu, and the settings are still there after a page reload.
- **Mouse:** hovering moves the cursor and clicking selects.
- **No art:** in the dev tools network panel, block `assets/manifest.json` and reload. The fallback bands and the text logo appear and nothing crashes.
- **Console:** no errors.

Stop the server when done.

- [ ] **Step 11: Commit**

```bash
git add scripts/files.mjs server.mjs scripts/build.mjs index.html style.css assets.js assets.test.js render.js app.js
git commit -m "Replace UI shell with pixel canvas, sunset world, menu and settings"
```

---

### Task 8: Play screen

**Files:**
- Modify: `render.js` (append board and panel drawing)
- Modify: `app.js` (fill in play input, events and drawing)

**Interfaces:**
- Consumes: `Game` API from `engine.js`: `board`, `height`, `target`, `cuts`, `lanes`, `gaps`, `reach`, `next`, `piece`, `status`, `paused`, `pending`, `jammed`, `events`, `elapsed`, `duration`, `cells(p)`, `landing()`, `overReach(p)`, `lower()`, `fits(p)`, `stepDir()`, `limitRow()`, `active()`, `move(dx, enterLane)`, `rotate(dir)`, `flipBeat()`, `drop()`, `update(ms, soft)`. Also `SHAPES`, `WIDTH`, `HEIGHT`, `onBoard` from `engine.js`; `clock` from `ui.js`; `wrap` from `font.js`; `LIGHT_PIECES` from `palette.js`.
- Produces: `drawBoard(ctx, game, {now, flash, offcut})`, `drawPanel(ctx, game, {remaining, label, message})`, `drawMini(ctx, id, cx, cy)`.

- [ ] **Step 1: Board, piece and panel drawing**

Append to `render.js`. Merge the imports into the top of the file: extend the `engine.js` import to `{WIDTH,HEIGHT,LANE,SHAPES,onBoard}`, extend the `palette.js` import with `LIGHT_PIECES`, extend the `font.js` import with `wrap`, and add `import {clock} from './ui.js';`.

The spec puts the TOP and REACH labels "in the cabinet margin", but that margin is only 6 px. They go just outside the cabinet's left edge instead, on a black backing so they read over the scenery.

```js
const ARROWS={se:['#....','.#...','..#.#','...##','..###'],sw:['....#','...#.','#.#..','##...','###..']};
function bitmap(ctx,rows,x,y,color){ctx.fillStyle=color;rows.forEach((row,j)=>[...row].forEach((ch,i)=>{if(ch==='#')ctx.fillRect(x+i,y+j,1,1);}));}
function cross(ctx,x,y,color){ctx.fillStyle=color;for(let i=0;i<6;i++){ctx.fillRect(x+4+i,y+4+i,1,1);ctx.fillRect(x+9-i,y+4+i,1,1);}}
// Dashed guide line across the board at the top of row r, labelled outside the cabinet.
function guide(ctx,r,color,label,dy=0){
 const y=rowTop(r),{BX}=LAYOUT;ctx.fillStyle=color;
 for(let x=BX-3;x<BX+150;x+=4)ctx.fillRect(x,y,2,1);
 const w=label.length*6-1,lx=LAYOUT.cabinet.x-3-w;
 ctx.fillStyle=C.black;ctx.fillRect(lx-2,y-4+dy,w+4,11);
 drawText(ctx,label,lx,y-2+dy,color);
}
export function drawBoard(ctx,game,{now=0,flash=null,offcut=null}={}){
 const solidFrom=HEIGHT-game.height;
 for(let r=0;r<HEIGHT;r++){
  for(let c=0;c<WIDTH;c++){const {x,y}=cellXY(c,r),v=game.board[r][c];ctx.drawImage(v?tile('solid',PIECES[v-1]):tile('outline',r>=solidFrom?C.indigo:C.navy),x,y);}
  if(game.lanes)for(const c of [-1,WIDTH]){const {x,y}=cellXY(c,r);ctx.drawImage(tile('dashed',C.navy),x,y);}
 }
 ctx.fillStyle=C.orange;// sawtooth foundation under the bottom row
 for(let c=0;c<WIDTH;c++){const {x,y}=cellXY(c,HEIGHT-1);HEX_BOTTOM.forEach((by,i)=>ctx.fillRect(x+i,y+by+1,1,2));}
 const targetR=HEIGHT-game.target,limitR=game.limitRow();
 guide(ctx,targetR,C.yellow,'TOP');
 if(limitR>0)guide(ctx,limitR,C.hotpink,'REACH',limitR===targetR?11:0);
 if(game.status==='playing'&&!game.pending&&!game.jammed&&game.piece){
  const land=game.landing(),over=game.overReach(land),col=PIECES[game.piece.id];
  for(const {c,r} of game.cells(land)){const {x,y}=cellXY(c,r);
   if(onBoard(c))ctx.drawImage(tile('outline',over?C.hotpink:col),x,y);
   else{ctx.drawImage(tile('dashed',C.hotpink),x,y);cross(ctx,x,y,C.hotpink);}}
  for(const {c,r} of game.cells()){const {x,y}=cellXY(c,r);ctx.drawImage(tile(onBoard(c)?'solid':'dashed',col),x,y);}
  const p=game.piece,{x,y}=cellXY(p.q+Math.floor(p.r/2),p.r),mark=LIGHT_PIECES.has(col)?C.black:C.white;
  ctx.fillStyle=mark;ctx.fillRect(x+6,y+6,2,2);
  if(game.fits(game.lower())){const dir=game.stepDir();bitmap(ctx,ARROWS[dir],dir==='se'?x+8:x+1,y+8,mark);}
 }
 if(flash&&now-flash.time<850){
  const on=Math.floor((now-flash.time)/100)%2===0;
  for(const p of flash.removed){const {x,y}=cellXY(p.c,p.r);ctx.drawImage(tile('solid',on?C.white:C.hotpink),x,y);}
  const y=rowTop(flash.gap);ctx.fillStyle=C.hotpink;for(let x=LAYOUT.BX-3;x<LAYOUT.BX+150;x+=4)ctx.fillRect(x,y,2,1);
 }
 if(offcut&&now-offcut.time<400)for(const p of offcut.cells){const {x,y}=cellXY(p.c,p.r);ctx.drawImage(tile('dashed',C.orange),x,y);cross(ctx,x,y,C.orange);}
}
export function drawMini(ctx,id,cx,cy){
 const pts=SHAPES[id].cells.map(([q,r])=>[14*q+7*r,12*r]),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
 const ox=Math.round(cx-(Math.min(...xs)+Math.max(...xs)+HEX_W)/2),oy=Math.round(cy-(Math.min(...ys)+Math.max(...ys)+HEX_H)/2);
 for(const [x,y] of pts)ctx.drawImage(tile('solid',PIECES[id]),ox+x,oy+y);
}
export function drawPanel(ctx,game,{remaining,label,message}){
 const {x,y,w,h}=LAYOUT.panel,L=x+10;
 drawBox(ctx,x,y,w,h);
 drawText(ctx,'TIME',L,y+10,C.cream);
 drawText(ctx,clock(remaining),L,y+20,remaining<60000?C.hotpink:C.white,3);
 drawText(ctx,'FLOORS',L,y+50,C.cream);
 drawText(ctx,`${game.height}/${game.target}`,L,y+60,C.white,3);
 drawText(ctx,'CUTBACKS',L,y+90,C.cream);
 drawText(ctx,String(game.cuts),L,y+100,C.white,2);
 drawText(ctx,'NEXT',L,y+122,C.cream);
 drawMini(ctx,game.next,x+w/2,y+156);
 if(game.piece&&game.active()&&game.fits(game.lower()))drawText(ctx,game.stepDir()==='se'?'TICK ▶ SE':'TOCK ◀ SW',L,y+190,C.yellow);
 drawText(ctx,label,L,y+202,C.lavender);
 drawText(ctx,`GAPS ${game.gaps} REACH ${game.reach}`,L,y+212,C.lavender);
 wrap(message,22,3).forEach((line,i)=>drawText(ctx,line,L,y+226+i*9,C.white));
}
```

- [ ] **Step 2: Play input, events, frame loop and drawing in the app**

In `app.js`, make these changes:

1. Extend the `render.js` import with `drawBoard,drawPanel`.
2. Replace the empty `function playInput(k,repeat){}` with:

```js
const PLAYKEYS={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'cw',x:'cw',z:'ccw',' ':'drop',Shift:'beat'};
const boxOpen=()=>game&&(game.paused||game.status!=='playing');
const boxLayout=()=>layoutBox(game.paused?['RESUME','MENU']:['AGAIN','MENU'],{cx:LAYOUT.cabinet.x+LAYOUT.cabinet.w/2,y:136,minWidth:120});
function pauseToggle(){if(screen!=='play'||game.status!=='playing')return;game.paused=!game.paused;soft=false;boxCursor=0;}
function boxSelect(i){if(i===1){toMenu();return;}if(game.paused)game.paused=false;else start(diff);}
function playInput(k,repeat){
 if(boxOpen()){
  if((k==='p'||k==='Escape')&&game.paused){if(!repeat)pauseToggle();return;}
  const r=menuKey(2,boxCursor,k,repeat);boxCursor=r.cursor;
  // A drop or a mashed key at the final second must not instantly restart: ignore selects briefly.
  if(r.select!==undefined&&(game.paused||performance.now()-overSince>600))boxSelect(r.select);
  return;
 }
 if(k==='p'||k==='Escape'){if(!repeat)pauseToggle();return;}
 if(k==='ArrowDown'){soft=true;return;}
 const a=PLAYKEYS[k];if(!a||!game.active())return;
 if(repeat&&['cw','ccw','drop','beat'].includes(a))return;
 // A held arrow stops at the visible wall; only a fresh press steers into a lane.
 if(a==='left')game.move(-1,!repeat);if(a==='right')game.move(1,!repeat);
 if(a==='cw')game.rotate(1);if(a==='ccw')game.rotate(-1);if(a==='beat')game.flipBeat();if(a==='drop')game.drop();
}
function blur(){soft=false;if(screen==='play'&&game.status==='playing'&&!game.paused){game.paused=true;boxCursor=0;}}
addEventListener('blur',blur);
document.addEventListener('visibilitychange',()=>{if(document.hidden)blur();});
function handleEvents(now){
 for(const e of game.events){
  if(e.type==='cut'){flash={...e,time:now};note(`${e.reason==='blocked'?'ENTRY BLOCKED':e.reason==='reach'?'TOO HIGH':'CUTBACK'}: ${e.removed.length} HEXES REMOVED. FLOOR ${HEIGHT-e.gap} STAYS UNFINISHED.`);tone(80,.3);}
  if(e.type==='step')tone(e.dir==='se'?1250:830,.035);
  if(e.type==='lock'){tone(170);if(e.offcuts.length){offcut={cells:e.offcuts,time:now};if(!game.events.some(x=>x.type==='cut'))note(`OFFCUT: ${e.offcuts.length} ${e.offcuts.length===1?'HEX':'HEXES'} PAST THE WALL CUT OFF.`);tone(120,.06);}}
  if(e.type==='jam')note('ENTRY BLOCKED AND NOTHING LEFT TO CUT. PAUSE FOR THE MENU.');
 }
 game.events=[];
}
```

3. In `activeRows()`, add `if(screen==='play'&&boxOpen())return boxLayout().rows;` before `return null;`.
4. Replace the `screen==='play'` branch of `draw(now)` with:

```js
 if(screen==='play'){
  drawSprites(ctx,assets,PLAY_SCENERY,now);drawDim(ctx);
  const k=LAYOUT.cabinet;drawBox(ctx,k.x,k.y,k.w,k.h,C.royal);
  drawBoard(ctx,game,{now,flash,offcut});
  drawPanel(ctx,game,{remaining:game.duration-game.elapsed,label:diff.label,message:now<messageUntil||!game.active()?message:`FINISH FLOOR ${game.height+1}.`});
  if(boxOpen()){
   const won=game.status==='won',title=game.paused?'PAUSED':won?'TOPPED OUT':"TIME'S UP";
   const lines=game.paused?['P TO RESUME']:[`${game.height}/${game.target} FLOORS`,`${game.cuts} CUTBACKS`];
   drawItems(ctx,boxLayout(),boxCursor,now,{title,lines});
  }
  return;
 }
```

5. Replace `function frame(now){last=now;draw(now);requestAnimationFrame(frame);}` with:

```js
function frame(now){
 const dt=Math.min(100,Math.max(0,now-last));last=now;
 if(screen==='play'){
  const wasPlaying=game.status==='playing';
  game.update(dt,soft);handleEvents(now);
  if(wasPlaying&&game.status!=='playing'){overSince=now;boxCursor=0;soft=false;tone(game.status==='won'?780:90,.3);}
 }
 draw(now);requestAnimationFrame(frame);
}
```

- [ ] **Step 3: Run all tests and the build**

Run: `npm test && npm run build`
Expected: all tests pass and the build succeeds.

- [ ] **Step 4: Check it in the browser**

Run `PORT=4173 npm start` in the background, open `http://127.0.0.1:4173`, choose MEDIUM, and take screenshots. Check each of these:
- **Layout:** the cabinet is royal blue with a navy hex grid, chamfered pieces and an orange sawtooth floor. Lane columns are dashed. The TOP (yellow) and REACH (hot pink) lines have their labels to the left of the cabinet.
- **The falling piece:** it has a pivot dot and a step arrow, and the arrow flips when Shift is pressed. The landing ghost is an outline that turns hot pink when the drop would go above REACH.
- **Readout panel:** shows TIME 09:00 counting down, FLOORS 0/8, CUTBACKS, a NEXT piece centered in its slot, `TICK ▶ SE` / `TOCK ◀ SW`, `MEDIUM` and `GAPS 1 REACH 5`, and the message, wrapped inside the panel.
- **Controls:** steering, rotating, ↓ for faster descent and Space to drop all work. Hard-dropping three pieces in the same column on HARD shows the TOO HIGH cutback: cells flash white and pink and the message wraps.
- **Pause:** P opens the PAUSED box. RESUME and MENU both work, and switching to another window pauses the game.
- **Game over:** temporarily change `[8,9,10][gaps]*60000` to `[8,9,10][gaps]*1000` in `ui.js`, reload, start HARD, and hold Space through the end of the 8-second clock. Confirm that the TIME'S UP box appears with the stats, that the held Space does not restart, that a fresh Enter on AGAIN restarts on HARD, and that MENU returns to the title. **Revert the `ui.js` change** and run `node --test ui.test.js` to confirm it's back.
- **Console:** no errors.

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add render.js app.js
git commit -m "Add pixel play screen: cabinet board, readout panel, pause and results"
```

---

### Task 9: Font coverage, docs and final pass

**Files:**
- Create: `strings.test.js`
- Modify: `README.md`

- [ ] **Step 1: Write the coverage test**

Create `strings.test.js`:

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLYPHS} from './font.js';

// Display text is written in capitals; every all-caps string literal in the UI code must be drawable.
test('every capitalised string in the UI code uses only font characters',()=>{
 const missing=new Set();
 for(const file of ['app.js','ui.js','render.js']){
  const src=readFileSync(new URL(`./${file}`,import.meta.url),'utf8');
  for(const m of src.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)){
   const text=m[2].replace(/\$\{[^}]*\}/g,'');
   if(!/[A-Z]{2}/.test(text)||/[a-z]/.test(text))continue;
   for(const ch of text)if(!GLYPHS[ch])missing.add(`${file}: ${JSON.stringify(ch)} in ${JSON.stringify(text)}`);
  }
 }
 assert.deepEqual([...missing],[]);
});
```

- [ ] **Step 2: Run it**

Run: `node --test strings.test.js`
Expected: PASS. If it fails, change the reported string to use only font characters. Don't add glyphs just to make it pass.

- [ ] **Step 3: Update the README**

In `README.md`, replace the controls paragraph (the one that starts `Arrow left/right: steer.`) with:

```markdown
Arrow left/right: steer. Up or X: rotate clockwise 60°. Z: rotate counterclockwise. Down: descend faster. Shift (left or right): change beat, so the next step down goes the other diagonal (SW instead of SE, or the reverse). Space: hard drop. P/Escape: pause. Leaving the browser pauses automatically. The white dot marks the pivot and its arrow points the way the next step will go; the readout panel shows TICK (SE) or TOCK (SW). The outline marks the landing position. Menus work with the arrow keys and Enter, or the mouse.

**Look:** everything is drawn at 480×270 in a fixed 16-colour palette, scaled up with square pixels, under drifting CRT scanlines (strength in Settings). Source art lives in `art/`; `python3 scripts/assets.py` (needs Pillow) converts it into `assets/`. Run it again only when the art changes.
```

Then search the README for `dropdown`, `setup offers` and `Difficulty** (Medium by default)`, and update any sentence that refers to the old setup screen so it describes the title menu (EASY / MEDIUM / HARD) and Settings (target, edge lanes, sound, scanlines). Keep the rule descriptions as they are.

- [ ] **Step 4: Final full check**

Run: `npm test && npm run build`
Expected: every test passes and the build succeeds.

Then run the browser checks from Task 7 Step 10 and Task 8 Step 4 once more, on a fresh profile with empty `localStorage`, and confirm the defaults (MEDIUM selected, target 8, lanes on, sound off, scanlines 0.6).

- [ ] **Step 5: Commit**

```bash
git add strings.test.js README.md
git commit -m "Check UI strings against the font; document the new look and controls"
```
