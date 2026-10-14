
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
LOGO_SMALL_WIDTH = 200   # the phone screen is 216 wide
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


def logo(width=LOGO_WIDTH):
    img = Image.open(ART / 'logo.png').convert('RGB')
    mask = key_mask(img, border_key(img), flood=True)
    box = mask.getbbox()
    w, h = box[2] - box[0], box[3] - box[1]
    # The logo is warm colours only; without this, blended edge pixels snap to green.
    return shrink(img.crop(box), mask.crop(box), (width, round(h * width / w)),
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
            # Shrinking gives each star a fringe, so match small patches that contain a light pixel.
            if len(comp) <= 60 and any(ipx[p][:3] in light for p in comp):
                for p in comp:
                    ipx[p] = (0, 0, 0, 0)
    # The game draws the sun; clear the art's sun disc above the horizon so it cannot cover it.
    for y in range(horizon):
        for x in range(W):
            if (x - SUN['x']) ** 2 + (y - SUN['y']) ** 2 <= (SUN['r'] + 2) ** 2:
                ipx[x, y] = (0, 0, 0, 0)
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
    small = logo(LOGO_SMALL_WIDTH)
    check('logo-small', small)
    small.save(OUT / 'logo-small.png')
    manifest['logoSmall'] = list(small.size)
    bd, horizon, bands = backdrop()
    check('backdrop', bd)
    bd.save(OUT / 'backdrop.png')
    manifest['horizon'], manifest['bands'], manifest['sun'] = horizon, bands, SUN
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=1) + '\n')
    print(f"wrote {len(manifest['sprites'])} sprites, logo {manifest['logo']}, "
          f"horizon {horizon}, {len(bands)} bands")


if __name__ == '__main__':
    main()
