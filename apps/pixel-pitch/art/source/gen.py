"""Pixel Pitch V1 asset generator. Produces original pixel-art sprites, sheets, UI, app art and chiptune SFX."""
import json, os, math, random, wave, struct, shutil
from PIL import Image
import numpy as np

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), 'out', 'pixel-pitch-assets'))
if os.path.exists(OUT):
    shutil.rmtree(OUT)
random.seed(7)
MANIFEST = []

def hexc(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)

PAL = {
    'ink': '#10122a', 'navy': '#1b1f3b', 'navy2': '#262b52', 'navy3': '#141733', 'slate': '#3a3f72', 'grey': '#9aa3d6',
    'white': '#f4f4f4', 'yellow': '#ffd23f', 'ydark': '#c78a00', 'pink': '#ff4f79', 'pdark': '#b8264f', 'blue': '#5ec8ff',
    'bdark': '#2f7fb0', 'lime': '#b6ff3b', 'ldark': '#6fae1d', 'orange': '#ff9f43', 'grass': '#3fa34d', 'grass2': '#379445',
    'r0': '#9aa3b5', 'r1': '#3fa34d', 'r2': '#3f7fd6', 'r3': '#f2a33a', 'r4': '#e2483d',
}
C = {k: hexc(v) for k, v in PAL.items()}
T = (0, 0, 0, 0)

def save(img, rel, use, scale_preview=True):
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    MANIFEST.append({'file': rel, 'w': img.width, 'h': img.height, 'use': use})
    return img

def grid(rows, cmap):
    h = len(rows); w = max(len(r) for r in rows)
    im = Image.new('RGBA', (w, h), T)
    px = im.load()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in cmap and cmap[ch] is not None:
                px[x, y] = cmap[ch]
    return im

def rect(im, x, y, w, h, col):
    px = im.load()
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if 0 <= xx < im.width and 0 <= yy < im.height:
                px[xx, yy] = col

def scale(im, s):
    return im.resize((im.width * s, im.height * s), Image.NEAREST)

def outline(im, col):
    out = Image.new('RGBA', (im.width + 2, im.height + 2), T)
    src = im.load(); o = out.load()
    for y in range(im.height):
        for x in range(im.width):
            if src[x, y][3]:
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        o[x + 1 + dx, y + 1 + dy] = col
    out.alpha_composite(im, (1, 1))
    return out

# ---------------- pixel font 3x5 ----------------
F = {
 'A':["010","101","111","101","101"],'B':["110","101","110","101","110"],'C':["011","100","100","100","011"],
 'D':["110","101","101","101","110"],'E':["111","100","110","100","111"],'F':["111","100","110","100","100"],
 'G':["011","100","101","101","011"],'H':["101","101","111","101","101"],'I':["111","010","010","010","111"],
 'J':["001","001","001","101","010"],'K':["101","101","110","101","101"],'L':["100","100","100","100","111"],
 'M':["101","111","111","101","101"],'N':["110","101","101","101","101"],'O':["010","101","101","101","010"],
 'P':["110","101","110","100","100"],'Q':["010","101","101","110","011"],'R':["110","101","110","101","101"],
 'S':["011","100","010","001","110"],'T':["111","010","010","010","010"],'U':["101","101","101","101","111"],
 'V':["101","101","101","101","010"],'W':["101","101","111","111","101"],'X':["101","101","010","101","101"],
 'Y':["101","101","010","010","010"],'Z':["111","001","010","100","111"],
 '0':["111","101","101","101","111"],'1':["010","110","010","010","111"],'2':["110","001","010","100","111"],
 '3':["110","001","010","001","110"],'4':["101","101","111","001","001"],'5':["111","100","110","001","110"],
 '6':["011","100","111","101","111"],'7':["111","001","010","010","010"],'8':["111","101","111","101","111"],
 '9':["111","101","111","001","110"],'!':["010","010","010","000","010"],'-':["000","000","111","000","000"],
 '+':["000","010","111","010","000"],'%':["101","001","010","100","101"],'?':["110","001","010","000","010"],
 '.':["000","000","000","000","010"],' ':["000","000","000","000","000"],'/':["001","001","010","100","100"],
 "'":["010","010","000","000","000"],':':["000","010","000","010","000"],
}

F['W'] = ["10001", "10001", "10101", "10101", "01010"]
F['M'] = ["10001", "11011", "10101", "10001", "10001"]

def text(s, col, sc=1):
    gl = [F.get(ch, F['?']) for ch in s.upper()]
    w = max(1, sum(len(g[0]) + 1 for g in gl) - 1)
    im = Image.new('RGBA', (w, 5), T)
    px = im.load()
    x0 = 0
    for g in gl:
        for y in range(5):
            for x in range(len(g[0])):
                if g[y][x] == '1':
                    px[x0 + x, y] = col
        x0 += len(g[0]) + 1
    return scale(im, sc) if sc > 1 else im

def banner(s, col, sc=2, shadow=True):
    t = text(s, col, sc)
    o = outline(t, C['ink'])
    if not shadow:
        return o
    out = Image.new('RGBA', (o.width + 2, o.height + 2), T)
    sh = Image.new('RGBA', o.size, T)
    sh.paste(C['ink'], (0, 0), o)
    out.alpha_composite(sh, (2, 2))
    out.alpha_composite(o, (0, 0))
    return out

# ---------------- sheets ----------------
def pack_sheet(frames, rel, use, cols=None, pad=1):
    """frames: list of (name, img). Writes PNG + JSON (TexturePacker hash format)."""
    n = len(frames)
    cols = cols or min(n, 8)
    cw = max(f.width for _, f in frames) + pad
    ch = max(f.height for _, f in frames) + pad
    rows = math.ceil(n / cols)
    sheet = Image.new('RGBA', (cols * cw, rows * ch), T)
    meta = {'frames': {}, 'meta': {'image': os.path.basename(rel), 'size': {'w': sheet.width, 'h': sheet.height}, 'scale': '1', 'app': 'pixel-pitch-gen'}}
    for i, (name, f) in enumerate(frames):
        x = (i % cols) * cw; y = (i // cols) * ch
        sheet.alpha_composite(f, (x, y))
        meta['frames'][name] = {'frame': {'x': x, 'y': y, 'w': f.width, 'h': f.height}, 'sourceSize': {'w': f.width, 'h': f.height}}
    save(sheet, rel, use)
    jp = os.path.join(OUT, rel.replace('.png', '.json'))
    with open(jp, 'w') as fh:
        json.dump(meta, fh, indent=1)
    MANIFEST.append({'file': rel.replace('.png', '.json'), 'use': 'Frame atlas for ' + os.path.basename(rel)})
    return sheet

PREVIEW = []  # (title, list of images)

# ================= 1. PLAYERS =================
BASE = [
 "....OOOO....",
 "...OSSSSO...",
 "..OSSSSSSO..",
 "..OSSSSSSO..",
 "..OSESSESO..",
 "..OSSSSSSO..",
 "...OOSSOO...",
 ".OOKKKKKKOO.",
 "OKKKKKKKKKKO",
 "OKOKKKKKKOKO",
 "OSOKKKKKKOSO",
 "..OPPPPPPO..",
 "..OPPOOPPO..",
 "..OSSOOSSO..",
 "..OWWOOWWO..",
 ".OBBBOOBBBO.",
]
SKINS = {'skin1': '#f7d9bf', 'skin2': '#f2c39b', 'skin3': '#c98a5d', 'skin4': '#8d5a3b', 'skin5': '#5e3a24'}
HAIRC = {'black': '#151515', 'dark': '#2b1a10', 'brown': '#7a3b1e', 'ginger': '#c96f2b', 'blonde': '#f2b631', 'silver': '#d8d8d8'}
HAIR = {
 'short':  ["....OOOO....", "...OHHHHO...", "..OHHHHHHO..", "..OH....HO.."],
 'buzz':   ["....OOOO....", "...OHHHHO..."],
 'fringe': ["....OOOO....", "...OHHHHO...", "..OHHHHHHO..", "..OHHHH..O.."],
 'afro':   ["..OOOOOOOO..", ".OHHHHHHHHO.", ".OHHHHHHHHO.", ".OHH....HHO.", ".OH......HO."],
 'mohawk': ["....OHHO....", "....OHHO...."],
 'long':   ["....OOOO....", "...OHHHHO...", "..OHHHHHHO..", "..OH....HO..", "..OH....HO..", "..OH....HO..", "..OHO..OHO.."],
 'bald':   [],
 'topknot':[ ".....HH.....", "...OHHHHO...", "..OHHHHHHO.."],
}
KITS = {
 'pixel-rovers': ('#ff4f79', '#ffd23f'), 'rust-rovers': ('#c0562f', '#1b1f3b'), 'pebble-utd': ('#9aa3b5', '#3f7fd6'),
 'gasworks-fc': ('#ffd23f', '#151515'), 'millbrook': ('#3fa34d', '#f4f4f4'), 'sandbank': ('#f2d29b', '#e2483d'),
 'northvale': ('#5ec8ff', '#f4f4f4'), 'emberland': ('#e2483d', '#151515'),
}
PATTERNS = ['plain', 'stripes', 'hoops', 'halves', 'sash']
SHORTS = '#f4f4f4'

def kit_pixel(pattern, x, y):
    if pattern == 'stripes':
        return x % 2 == 1
    if pattern == 'hoops':
        return y in (8, 10)
    if pattern == 'halves':
        return x >= 6
    if pattern == 'sash':
        return (x - (y - 7)) in (7, 8)
    return False

def layer(chars, cmap, pattern=None, prim=None, sec=None):
    im = Image.new('RGBA', (12, 16), T); px = im.load()
    for y, r in enumerate(BASE):
        for x, ch in enumerate(r):
            if ch not in chars:
                continue
            if ch == 'K' and prim is not None:
                px[x, y] = sec if kit_pixel(pattern, x, y) else prim
            else:
                px[x, y] = cmap[ch]
    return im

def hair_img(style, col):
    rows = HAIR[style]
    im = Image.new('RGBA', (12, 16), T); px = im.load()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == 'H': px[x, y] = col
            elif ch == 'O': px[x, y] = C['ink']
    return im

def player(skin, hstyle, hcol, kit, pattern, shorts=SHORTS, gk=False):
    prim, sec = hexc(KITS[kit][0]), hexc(KITS[kit][1])
    if gk:
        prim, sec = hexc('#b6ff3b'), hexc('#6fae1d')
    im = layer('OSE', {'O': C['ink'], 'S': hexc(SKINS[skin]), 'E': C['ink']})
    im.alpha_composite(layer('K', {}, pattern, prim, sec))
    im.alpha_composite(layer('P', {'P': hexc(shorts)}))
    im.alpha_composite(layer('W', {'W': prim}))
    im.alpha_composite(layer('B', {'B': C['navy3']}))
    im.alpha_composite(hair_img(hstyle, hexc(HAIRC[hcol])))
    if gk:
        px = im.load(); px[1, 10] = C['white']; px[10, 10] = C['white']
    return im

# layers for runtime composition
for s, col in SKINS.items():
    save(layer('OSE', {'O': C['ink'], 'S': hexc(col), 'E': C['ink']}), f'sprites/players/body/body_{s}.png', 'Player body layer (head, hands, legs, outline)')
for st in HAIR:
    if st == 'bald':
        continue
    for hc, col in HAIRC.items():
        save(hair_img(st, hexc(col)), f'sprites/players/hair/hair_{st}_{hc}.png', 'Player hair layer, 12x16, draw over body')
KEY_P, KEY_S = hexc('#ff0000'), hexc('#00ff00')
for p in PATTERNS:
    save(layer('K', {}, p, KEY_P, KEY_S), f'sprites/players/kit/kit_{p}_template.png', 'Shirt template: palette-swap #ff0000 = primary, #00ff00 = secondary')
save(layer('P', {'P': KEY_P}), 'sprites/players/kit/shorts_template.png', 'Shorts template: swap #ff0000')
save(layer('W', {'W': KEY_P}), 'sprites/players/kit/socks_template.png', 'Socks template: swap #ff0000 (use shirt primary)')
save(layer('B', {'B': C['navy3']}), 'sprites/players/kit/boots.png', 'Boots layer')
gl = Image.new('RGBA', (12, 16), T); gl.load()[1, 10] = C['white']; gl.load()[10, 10] = C['white']
save(gl, 'sprites/players/kit/gk_gloves.png', 'Goalkeeper gloves overlay')

# idle bob + celebrate frames for the default player
def shifted(im, dy):
    out = Image.new('RGBA', (12, 17), T); out.alpha_composite(im, (0, 1 + dy)); return out
def celebrate(im):
    out = Image.new('RGBA', (12, 17), T); body = im.crop((0, 0, 12, 16)); out.alpha_composite(body, (0, 0))
    px = out.load()
    for (x, y) in [(1, 10), (10, 10), (0, 9), (11, 9), (0, 10), (11, 10)]:
        px[x, y] = T
    for (x, y) in [(1, 5), (10, 5), (1, 6), (10, 6)]:
        px[x, y] = C['ink']
    px[1, 4] = hexc(SKINS['skin3']); px[10, 4] = hexc(SKINS['skin3'])
    return out
hero = player('skin3', 'short', 'dark', 'pixel-rovers', 'plain')
anim = [('idle_0', shifted(hero, 0)), ('idle_1', shifted(hero, -1)), ('celebrate_0', celebrate(hero)), ('celebrate_1', shifted(celebrate(hero).crop((0, 0, 12, 16)), -1))]
pack_sheet(anim, 'sheets/player_anim.png', 'Player idle (2 frames) and celebrate (2 frames), 12x17', cols=4)

# example squad sheet
examples = []
skins = list(SKINS); hs = [h for h in HAIR]; hcs = list(HAIRC); kits = list(KITS)
for i in range(32):
    k = kits[i % len(kits)]
    examples.append((f'example_{i:02d}', player(skins[i % 5], hs[(i * 3) % len(hs)], hcs[(i * 5) % len(hcs)], k, PATTERNS[(i // 8) % 5], gk=(i % 11 == 0))))
pack_sheet(examples, 'sheets/players_examples.png', 'Example composed players (32) for reference and placeholder use', cols=8)
PREVIEW.append(('PLAYERS', [f for _, f in examples[:16]] + [f for _, f in anim]))

# ================= 2. CARDS =================
RAR = [('grassroots', 'r0'), ('semipro', 'r1'), ('pro', 'r2'), ('star', 'r3'), ('legend', 'r4')]
CW, CH = 48, 64
def card_frame(rkey, idx):
    im = Image.new('RGBA', (CW, CH), T)
    col = C[rkey]
    rect(im, 1, 0, CW - 2, CH, C['ink']); rect(im, 0, 1, CW, CH - 2, C['ink'])
    rect(im, 1, 1, CW - 2, CH - 2, col)
    rect(im, 3, 3, CW - 6, CH - 6, C['navy2'])
    rect(im, 3, 3, CW - 6, 8, col)                 # header band (rarity label area)
    rect(im, 4, 12, CW - 8, 28, C['navy3'])        # portrait window
    rect(im, 4, 42, CW - 8, 1, C['slate'])
    # shine / tier pips
    for i in range(idx + 1):
        rect(im, 5 + i * 4, CH - 7, 2, 2, C['yellow'] if idx >= 3 else C['grey'])
    if idx >= 3:  # corners
        for (x, y) in [(1, 1), (CW - 3, 1), (1, CH - 3), (CW - 3, CH - 3)]:
            rect(im, x, y, 2, 2, C['yellow'] if idx == 3 else C['white'])
    if idx == 4:
        px = im.load()
        for y in range(1, CH - 1):
            for x in range(1, CW - 1):
                if px[x, y] == col and (x + y) % 6 == 0:
                    px[x, y] = hexc('#ff9b8f')
    lbl = text({0: 'GRASS', 1: 'SEMI-PRO', 2: 'PRO', 3: 'STAR', 4: 'LEGEND'}[idx], C['navy'])
    im.alpha_composite(lbl, ((CW - lbl.width) // 2, 5))
    return im
cards = [(f'card_{n}', card_frame(k, i)) for i, (n, k) in enumerate(RAR)]
back = Image.new('RGBA', (CW, CH), T)
rect(back, 1, 0, CW - 2, CH, C['ink']); rect(back, 0, 1, CW, CH - 2, C['ink'])
px = back.load()
for y in range(1, CH - 1):
    for x in range(1, CW - 1):
        px[x, y] = C['slate'] if ((x // 3) + (y // 3)) % 2 else C['navy2']
q = banner('?', C['yellow'], 3, shadow=False); back.alpha_composite(q, ((CW - q.width) // 2, (CH - q.height) // 2))
cards.append(('card_back', back))
for n, im in cards:
    save(im, f'sprites/cards/{n}.png', 'Player card frame 48x64: portrait window at (4,12) 40x28, name/rating below line y=43')
glow = Image.new('RGBA', (CW + 8, CH + 8), T)
for r in range(4):
    a = 60 + r * 40
    for y in range(r, CH + 8 - r):
        for x in range(r, CW + 8 - r):
            if x in (r, CW + 7 - r) or y in (r, CH + 7 - r):
                glow.load()[x, y] = hexc('#ffd23f', a)
save(glow, 'sprites/cards/card_glow_star.png', 'Glow ring behind Star/Legend cards on reveal (tint for Legend)')
pack_sheet(cards, 'sheets/cards.png', 'All card frames + back', cols=6)
PREVIEW.append(('CARDS', [f for _, f in cards]))

# ================= 3. PACKS =================
PACKS = [('bronze', '#c97a3a', '#8a4f22', 5), ('silver', '#b8c2d6', '#7a849c', 4), ('gold', '#ffd23f', '#c78a00', 3), ('holo', '#5ec8ff', '#b07cff', 2), ('legend', '#e2483d', '#7a1b2d', 1)]
PW, PH = 40, 52
STAR = ["...O...", "..OYO..", "OOOYOOO", "OYYYYYO", ".OYYYO.", ".OYOYO.", ".O...O."]
def pack(name, c1, c2, lg, part='full'):
    im = Image.new('RGBA', (PW, PH), T)
    a, b = hexc(c1), hexc(c2)
    rect(im, 0, 3, PW, PH - 6, C['ink'])
    rect(im, 1, 3, PW - 2, PH - 6, a)
    px = im.load()
    for x in range(PW):   # zigzag crimp edges
        h = 3 if x % 4 < 2 else 1
        for y in range(3 - h, 3):
            px[x, y] = C['ink'] if x in (0, PW - 1) or y == 3 - h else a
        for y in range(PH - 3, PH - 3 + h):
            px[x, y] = C['ink'] if x in (0, PW - 1) or y == PH - 4 + h else a
    for y in range(3, PH - 3):  # side shading / holo stripes
        for x in range(PW - 6, PW - 1):
            px[x, y] = b
        if name == 'holo':
            for x in range(1, PW - 6):
                if (x + y) % 10 < 3:
                    px[x, y] = hexc(['#ff9ad5', '#ffe17a', '#8ff0c8'][(x + y) // 10 % 3])
    for x in range(1, PW - 1, 3):  # perforation
        px[x, 9] = C['ink']; px[x + 1, 9] = C['ink'] if x + 1 < PW - 1 else px[x + 1, 9]
    s = grid(STAR, {'O': C['ink'], 'Y': C['white']}); s = scale(s, 2)
    im.alpha_composite(s, ((PW - s.width) // 2 - 2, 16))
    lab = outline(text('L' + str(lg), C['white']), C['ink'])
    im.alpha_composite(lab, (5, 38))
    if part == 'top':
        return im.crop((0, 0, PW, 10))
    if part == 'bottom':
        return im.crop((0, 10, PW, PH))
    return im
packs = []
for n, c1, c2, lg in PACKS:
    full = pack(n, c1, c2, lg)
    save(full, f'sprites/packs/pack_{n}.png', f'League {lg} pack (40x52)')
    save(pack(n, c1, c2, lg, 'top'), f'sprites/packs/pack_{n}_top.png', 'Tear-off strip above the perforation, for the rip animation')
    save(pack(n, c1, c2, lg, 'bottom'), f'sprites/packs/pack_{n}_bottom.png', 'Pack body below the perforation')
    packs.append((f'pack_{n}', full))
# rip animation frames (gold)
rip = []
top, bot = pack('gold', '#ffd23f', '#c78a00', 3, 'top'), pack('gold', '#ffd23f', '#c78a00', 3, 'bottom')
for i, (dx, dy, rot) in enumerate([(0, 0, 0), (3, -3, -10), (8, -8, -25), (14, -16, -45)]):
    f = Image.new('RGBA', (PW + 20, PH + 20), T)
    f.alpha_composite(bot, (10, 30))
    t = top.rotate(rot, expand=True, resample=Image.NEAREST)
    f.alpha_composite(t, (10 + dx, 20 + dy))
    rip.append((f'rip_{i}', f))
pack_sheet(rip, 'sheets/pack_rip.png', 'Pack rip animation, 4 frames (60x72), ~80ms each', cols=4)
pack_sheet(packs, 'sheets/packs.png', 'All league packs', cols=5)
PREVIEW.append(('PACKS', [f for _, f in packs] + [f for _, f in rip]))

# ================= 4. CURRENCY + ICONS =================
ICM = {'O': C['ink'], 'W': C['white'], 'Y': C['yellow'], 'D': C['ydark'], 'P': C['pink'], 'p': C['pdark'], 'B': C['blue'], 'b': C['bdark'], 'L': C['lime'], 'l': C['ldark'], 'G': C['grey'], 'N': C['navy2'], 'R': C['r4'], 'g': C['grass']}
CURRENCY = {
 'coin':   ["...OOOOOO...", "..OYYYYYYO..", ".OYYWYYYYDO.", "OYYWYYOYYYDO", "OYWYYOYOYYDO", "OYYYOYYYOYDO", "OYYYYOYOYYDO", "OYYYYYOYYYDO", "OYYYYYYYYDDO", ".ODYYYYYDDO.", "..ODDDDDDO..", "...OOOOOO..."],
 'gem':    ["............", "...OOOOOO...", "..OWPPPPpO..", ".OWPPPPPPpO.", "OOOOOOOOOOOO", "OWPPPPPPPPpO", ".OWPPPPPPpO.", "..OWPPPPpO..", "...OPPPPpO..", "....OPPpO...", ".....OpO....", "......O....."],
 'token':  ["...OOOOOO...", "..OBBBBBBO..", ".OBWBBBBBbO.", "OBWBOOOOBBbO", "OBBBOWWOBBbO", "OBBBOWWOBBbO", "OBBBOWWOBBbO", "OBBBOOOOBBbO", "OBBBBBBBBbbO", ".ObBBBBBbbO.", "..ObbbbbbO..", "...OOOOOO..."],
 'pack':   ["..O.O.O.O...", ".OPOPOPOPO..", ".OPPPPPPPpO.", ".OOOOOOOOOO.", ".OPPPWPPPpO.", ".OPPWWWPPpO.", ".OPWWWWWPpO.", ".OPPWWWPPpO.", ".OPPWPWPPpO.", ".OPPPPPPPpO.", ".OPOPOPOPO..", "..O.O.O.O..."],
 'trophy': ["............", ".OOOOOOOOOO.", "OYOYYYYYYOYO", "OYOYWYYYYOYO", ".OOYWYYYYOO.", "..OYYYYYDO..", "...OYYYDO...", "....OYDO....", ".....OO.....", "....OYDO....", "...OYYYDO...", "...OOOOOO..."],
 'star':   [".....OO.....", ".....OYO....", "....OYYO....", "OOOOOYYOOOOO", "OYYYYWYYYYDO", ".OYYWYYYYDO.", "..OYYYYYDO..", "..OYYYYYDO..", ".OYYYOOYYDO.", ".OYDO..ODDO.", "OYDO....ODDO", "OOO......OOO"],
 'points': ["............", "...OOOOOO...", "..OLLLLLLO..", ".OLLLLLLLlO.", ".OLLLOOLLlO.", ".OLLOWWOLlO.", ".OLLOWWOLlO.", ".OLLLOOLLlO.", ".OLLLLLLLlO.", "..OlllllllO.", "...OOOOOO...", "............"],
}
cur = []
for n, rows in CURRENCY.items():
    im = grid(rows, ICM); save(im, f'sprites/icons/currency_{n}.png', 'Currency/reward icon 12x12'); cur.append((n, im))
pack_sheet(cur, 'sheets/currency.png', 'Currency icons', cols=7)

UI = {
 'club':     ["............", ".WWWWWWWWWW.", ".W........W.", ".W..WWWW..W.", ".W.W....W.W.", ".W.W.WW.W.W.", ".W.W....W.W.", "..W.WWWW.W..", "..W......W..", "...W....W...", "....W..W....", ".....WW....."],
 'packs':    ["....WWWWWWW.", "....W.....W.", "..WWWWWWW.W.", "..W.....W.W.", "WWWWWWW.W.W.", "W.....W.W.W.", "W..W..W.W.W.", "W.WWW.W.WWW.", "W..W..W.W...", "W.....WWW...", "W.....W.....", "WWWWWWW....."],
 'squad':    ["............", "..WWW..WWW..", ".WW.WWWW.WW.", "WW........WW", "WWWW....WWWW", "...W....W...", "...W....W...", "...W....W...", "...W....W...", "...W....W...", "...WWWWWW...", "............"],
 'league':   ["............", ".WWWWWWWWWW.", "WW.W....W.WW", "W..W....W..W", "WW.W....W.WW", "..WW....WW..", "...W....W...", "....WWWW....", ".....WW.....", "....WWWW....", "...WWWWWW...", "............"],
 'shop':     ["............", "....WWWW....", "...W....W...", "...W....W...", ".WWWWWWWWWW.", ".W........W.", ".W..W..W..W.", ".W........W.", ".W........W.", ".W........W.", ".WWWWWWWWWW.", "............"],
 'settings': ["....W..W....", "..W.WWWW.W..", "...WW..WW...", ".WW......WW.", "..W..WW..W..", "WWW.W..W.WWW", "WWW.W..W.WWW", "..W..WW..W..", ".WW......WW.", "...WW..WW...", "..W.WWWW.W..", "....W..W...."],
 'lock':     ["....WWWW....", "...W....W...", "..W......W..", "..W......W..", "..W......W..", ".WWWWWWWWWW.", ".WWWWWWWWWW.", ".WWWW..WWWW.", ".WWWW..WWWW.", ".WWWWW.WWWW.", ".WWWWWWWWWW.", ".WWWWWWWWWW."],
 'sound_on': ["............", ".....W...W..", "....WW....W.", "...WWW..W..W", "WWWWWW...W.W", "WWWWWW...W.W", "WWWWWW...W.W", "WWWWWW...W.W", "...WWW..W..W", "....WW....W.", ".....W...W..", "............"],
 'sound_off':["............", ".....W......", "....WW......", "...WWW......", "WWWWWW.W...W", "WWWWWW..W.W.", "WWWWWW...W..", "WWWWWW..W.W.", "...WWW.W...W", "....WW......", ".....W......", "............"],
 'music':    ["....WWWWWWWW", "....WWWWWWWW", "....W......W", "....W......W", "....W......W", "....W......W", "....W......W", "..WWW....WWW", ".WWWW...WWWW", ".WWWW...WWWW", "..WW.....WW.", "............"],
 'haptics':  ["............", "...WWWWWW...", "...W....W...", "W..W....W..W", "W..W....W..W", ".W.W....W.W.", ".W.W....W.W.", "W..W....W..W", "W..W....W..W", "...W.WW.W...", "...WWWWWW...", "............"],
 'bell':     [".....WW.....", "....WWWW....", "...WWWWWW...", "...WWWWWW...", "...WWWWWW...", "..WWWWWWWW..", "..WWWWWWWW..", ".WWWWWWWWWW.", "WWWWWWWWWWWW", "............", ".....WW.....", "............"],
 'close':    ["............", ".WW......WW.", ".WWW....WWW.", "..WWW..WWW..", "...WWWWWW...", "....WWWW....", "....WWWW....", "...WWWWWW...", "..WWW..WWW..", ".WWW....WWW.", ".WW......WW.", "............"],
 'back':     ["............", "......WW....", ".....WWW....", "....WWW.....", "...WWW......", "..WWW.......", "..WWW.......", "...WWW......", "....WWW.....", ".....WWW....", "......WW....", "............"],
 'info':     ["....WWWW....", "..WW....WW..", ".W...WW...W.", ".W........W.", "W....WW....W", "W....WW....W", "W....WW....W", "W....WW....W", ".W...WW...W.", ".W........W.", "..WW....WW..", "....WWWW...."],
 'check':    ["............", "..........WW", ".........WWW", "........WWW.", ".......WWW..", "WW....WWW...", "WWW..WWW....", ".WWWWWW.....", "..WWWW......", "...WW.......", "............", "............"],
 'plus':     ["............", ".....WW.....", ".....WW.....", ".....WW.....", ".....WW.....", ".WWWWWWWWWW.", ".WWWWWWWWWW.", ".....WW.....", ".....WW.....", ".....WW.....", ".....WW.....", "............"],
 'arrow_up': [".....WW.....", "....WWWW....", "...WWWWWW...", "..WWWWWWWW..", ".WWW.WW.WWW.", "WWW..WW..WWW", ".....WW.....", ".....WW.....", ".....WW.....", ".....WW.....", ".....WW.....", ".....WW....."],
 'arrow_down':[".....WW.....", ".....WW.....", ".....WW.....", ".....WW.....", ".....WW.....", ".....WW.....", "WWW..WW..WWW", ".WWW.WW.WWW.", "..WWWWWWWW..", "...WWWWWW...", "....WWWW....", ".....WW....."],
 'clock':    ["....WWWW....", "..WW....WW..", ".W...WW...W.", ".W...WW...W.", "W....WW....W", "W....WWWW..W", "W..........W", "W..........W", ".W........W.", ".W........W.", "..WW....WW..", "....WWWW...."],
 'refresh':  ["....WWWW.W..", "..WW....WW..", ".W.....WWW..", ".W..........", "W...........", "W...........", "...........W", "...........W", "..........W.", "..WWW.....W.", "..WW....WW..", "..W.WWWW...."],
 'share':    ["........WW..", ".......WWWW.", "......W.WW.W", "........WW..", "........WW..", "WWW.....WW..", "W........W..", "W...........", "W..........W", "W..........W", "W..........W", "WWWWWWWWWWWW"],
 'swap':     ["............", "...W........", "..WW........", ".WWWWWWWWWW.", "..WW........", "...W........", "........W...", "........WW..", ".WWWWWWWWWW.", "........WW..", "........W...", "............"],
 'whistle':  ["............", "......WWWWWW", ".WWWW.W....W", "W....WWWWWWW", "W.WW.W......", "W.WW.W......", "W....W......", ".WWWW.......", "............", "............", "............", "............"],
}
ui = []
for n, rows in UI.items():
    im = grid(rows, {'W': C['white']}); save(im, f'sprites/icons/ui_{n}.png', 'UI icon 12x12, white: tint in CSS (mask-image) or canvas'); ui.append((n, im))
pack_sheet(ui, 'sheets/ui_icons.png', 'UI icons (white, tintable)', cols=8)
PREVIEW.append(('ICONS', [f for _, f in cur] + [f for _, f in ui]))

# position + fit badges, tags
badges = []
for pos, key in [('GK', 'yellow'), ('DEF', 'blue'), ('MID', 'lime'), ('FWD', 'pink')]:
    t = text(pos, C['navy']); im = Image.new('RGBA', (t.width + 6, 9), T)
    rect(im, 1, 0, im.width - 2, 9, C['ink']); rect(im, 0, 1, im.width, 7, C['ink']); rect(im, 1, 1, im.width - 2, 7, C[key])
    im.alpha_composite(t, (3, 2)); save(im, f'sprites/badges/pos_{pos.lower()}.png', 'Position badge'); badges.append((f'pos_{pos.lower()}', im))
for lab, key in [('100%', 'lime'), ('90%', 'lime'), ('75%', 'yellow'), ('55%', 'orange'), ('30%', 'pink'), ('NEW', 'lime'), ('UPGRADE', 'lime'), ('DUPE', 'grey'), ('SOLD', 'yellow'), ('LOCKED', 'grey')]:
    t = text(lab, C['navy']); im = Image.new('RGBA', (t.width + 6, 9), T)
    rect(im, 1, 0, im.width - 2, 9, C['ink']); rect(im, 0, 1, im.width, 7, C['ink']); rect(im, 1, 1, im.width - 2, 7, C[key])
    im.alpha_composite(t, (3, 2)); nm = lab.replace('%', 'pct').lower(); save(im, f'sprites/badges/tag_{nm}.png', 'Status / fit tag'); badges.append((f'tag_{nm}', im))
pack_sheet(badges, 'sheets/badges.png', 'Position badges and status tags', cols=7)

# ================= 5. CRESTS + FLAGS =================
SHIELDS = {
 'shield':  ["OOOOOOOOOOOOOOOO", "OAAAAAAAAAAAAAAO", "OAAAAAAAAAAAAAAO", "OAAAAAAAAAAAAAAO", "OAAAAAAAAAAAAAAO", "OAAAAAAAAAAAAAAO", "OAAAAAAAAAAAAAAO", "OAAAAAAAAAAAAAAO", "OAAAAAAAAAAAAAAO", "OBBBBBBBBBBBBBBO", ".OBBBBBBBBBBBBO.", ".OBBBBBBBBBBBBO.", "..OBBBBBBBBBBO..", "...OBBBBBBBBO...", "....OBBBBBBO....", ".....OBBBBO.....", "......OBBO......", ".......OO......."],
 'round':   [".....OOOOOO.....", "...OOBBBBBBOO...", "..OBBAAAAAABBO..", ".OBAAAAAAAAAABO.", ".OBAAAAAAAAAABO.", "OBAAAAAAAAAAAABO", "OBAAAAAAAAAAAABO", "OBAAAAAAAAAAAABO", "OBAAAAAAAAAAAABO", "OBAAAAAAAAAAAABO", "OBAAAAAAAAAAAABO", ".OBAAAAAAAAAABO.", ".OBAAAAAAAAAABO.", "..OBBAAAAAABBO..", "...OOBBBBBBOO...", ".....OOOOOO.....", "................", "................"],
 'square':  ["OOOOOOOOOOOOOOOO", "OBBBBBBBBBBBBBBO", "OBAAAAAAAAAAAABO", "OBAAAAAAAAAAAABO", "OBAAAAAAAAAAAABO", "OBAAAAAAAAAAAABO", "OBAAAAAAAAAAAABO", "OBAAAAAAAAAAAABO", "OBAAAAAAAAAAAABO", "OBAAAAAAAAAAAABO", "OBAAAAAAAAAAAABO", "OBAAAAAAAAAAAABO", "OBAAAAAAAAAAAABO", "OBAAAAAAAAAAAABO", "OBBBBBBBBBBBBBBO", "OOOOOOOOOOOOOOOO", "................", "................"],
 'pennant': ["OOOOOOOOOOOOOOOO", "OAAAAAAAAAAAAAAO", "OAAAAAAAAAAAAAAO", "OAAAAAAAAAAAAAAO", "OAAAAAAAAAAAAAAO", "OAAAAAAAAAAAAAAO", "OAAAAAAAAAAAAAAO", "OBBBBBBBBBBBBBBO", "OAAAAAAAAAAAAAAO", "OAAAAAAAAAAAAAAO", "OAAAAAAAAAAAAAAO", "OAAAAAAAAAAAAAAO", "OAAAAOOOOOOAAAAO", "OAAAO......OAAAO", "OAAO........OAAO", "OAO..........OAO", "OO............OO", "................"],
}
EMBLEMS = {
 'ball':  ["..OOOO..", ".OWWWWO.", "OWWOOWWO", "OWOOOOWO", "OWWOOWWO", "OWWWWWWO", ".OWWWWO.", "..OOOO.."],
 'star':  ["...OO...", "...WW...", "OOOWWOOO", ".OWWWWO.", "..OWWO..", ".OWOOWO.", ".OO..OO.", "........"],
 'bolt':  ["....OOO.", "...OWWO.", "..OWWO..", ".OWWWWO.", "..OOWWO.", "...OWO..", "..OWO...", "..OO...."],
 'crown': ["O..OO..O", "OO.OO.OO", "OWOWWOWO", "OWWWWWWO", "OWWWWWWO", "OOOOOOOO", "........", "........"],
 'flame': ["...O....", "..OWO...", "..OWWO..", ".OWWWO.O", ".OWWWWOW", "OWWOWWWO", "OWWOOWWO", ".OWWWWO."],
 'wave':  ["........", ".OO..OO.", "OWWOOWWO", "WWWWWWWW", "OOWWOOWW", "..OO..OO", "........", "........"],
 'tree':  ["...OO...", "..OWWO..", ".OWWWWO.", "OWWWWWWO", ".OOWWOO.", "...WW...", "...WW...", "..OOOO.."],
 'wings': ["O......O", "OW....WO", "OWW..WWO", ".OWWWWO.", "..OWWO..", "...OO...", "........", "........"],
}
CREST_COLS = [('#ff4f79', '#ffd23f'), ('#3f7fd6', '#f4f4f4'), ('#3fa34d', '#1b1f3b'), ('#ffd23f', '#151515'), ('#e2483d', '#f4f4f4'), ('#8b5cf6', '#ffd23f')]
crests = []
for n, rows in SHIELDS.items():
    save(grid(rows, {'O': C['ink'], 'A': KEY_P, 'B': KEY_S}), f'sprites/crests/base_{n}_template.png', 'Crest base 16x18: swap #ff0000 = primary, #00ff00 = secondary')
for n, rows in EMBLEMS.items():
    save(grid(rows, {'O': C['ink'], 'W': C['white']}), f'sprites/crests/emblem_{n}.png', 'Crest emblem 8x8, centre on the base at (4,4)')
i = 0
for sn, srows in SHIELDS.items():
    for en, erows in list(EMBLEMS.items())[:6]:
        a, b = CREST_COLS[i % len(CREST_COLS)]; i += 1
        base = grid(srows, {'O': C['ink'], 'A': hexc(a), 'B': hexc(b)})
        base.alpha_composite(grid(erows, {'O': C['ink'], 'W': C['white']}), (4, 3 if sn != 'round' else 4))
        crests.append((f'crest_{sn}_{en}', base))
pack_sheet(crests, 'sheets/crests_examples.png', 'Example composed crests (bases x emblems x colours)', cols=8)
FLAGS = {
 'northvale': lambda im: (rect(im, 0, 0, 12, 8, C['blue']), rect(im, 3, 0, 2, 8, C['white']), rect(im, 0, 3, 12, 2, C['white'])),
 'solaria':   lambda im: (rect(im, 0, 0, 12, 8, C['yellow']), rect(im, 4, 2, 4, 4, C['orange']), rect(im, 5, 1, 2, 6, C['orange']), rect(im, 3, 3, 6, 2, C['orange'])),
 'emberland': lambda im: (rect(im, 0, 0, 12, 4, C['r4']), rect(im, 0, 4, 12, 4, hexc('#151515')), rect(im, 5, 2, 2, 4, C['yellow'])),
 'greenmoor': lambda im: (rect(im, 0, 0, 12, 8, C['grass']), rect(im, 0, 3, 12, 2, C['white']), rect(im, 0, 0, 3, 8, hexc('#2a6e35'))),
}
flags = []
for n, fn in FLAGS.items():
    im = Image.new('RGBA', (12, 8), T); fn(im); im = outline(im, C['ink']); save(im, f'sprites/flags/flag_{n}.png', 'Nation flag 14x10 (with outline)'); flags.append((n, im))
PREVIEW.append(('CRESTS + FLAGS', [f for _, f in crests[:16]] + [f for _, f in flags] + [f for _, f in badges]))

# ================= 6. PITCH, BALL, CROWD, STADIUM =================
tile = Image.new('RGBA', (32, 32), T)
rect(tile, 0, 0, 32, 16, C['grass']); rect(tile, 0, 16, 32, 16, C['grass2'])
p = tile.load()
for _ in range(18):
    x, y = random.randrange(32), random.randrange(32); p[x, y] = hexc('#4bb359') if y < 16 else hexc('#41a04f')
save(tile, 'sprites/pitch/grass_tile.png', 'Repeating grass tile 32x32 (two stripes)')
LINE = hexc('#ffffff', 170)
def pitch_squad(w=176, h=130):
    im = Image.new('RGBA', (w, h), T)
    for y in range(0, h, 13):
        rect(im, 0, y, w, 13, C['grass'] if (y // 13) % 2 == 0 else C['grass2'])
    rect(im, 0, 0, w, 1, LINE)
    for x in range(w // 2 - 18, w // 2 + 19):   # centre arc at top
        for y in range(0, 20):
            d = math.hypot(x - w // 2, y)
            if 17.5 <= d <= 18.5: im.load()[x, y] = LINE
    bx, bw, bh = w // 2 - 34, 68, 26
    rect(im, bx, h - bh, bw, 1, LINE); rect(im, bx, h - bh, 1, bh, LINE); rect(im, bx + bw - 1, h - bh, 1, bh, LINE)
    rect(im, w // 2 - 14, h - 10, 28, 1, LINE); rect(im, w // 2 - 14, h - 10, 1, 10, LINE); rect(im, w // 2 + 13, h - 10, 1, 10, LINE)
    rect(im, w // 2 - 1, h - 18, 2, 2, LINE)
    return im
save(pitch_squad(), 'sprites/pitch/pitch_squad_176x130.png', 'Squad screen half-pitch (own half, attacking up). Draw at 2x = 352x260')
def pitch_match(w=176, h=76):
    im = Image.new('RGBA', (w, h), T)
    for x in range(0, w, 14):
        rect(im, x, 0, 14, h, C['grass'] if (x // 14) % 2 == 0 else C['grass2'])
    rect(im, 2, 2, w - 4, 1, LINE); rect(im, 2, h - 3, w - 4, 1, LINE); rect(im, 2, 2, 1, h - 4, LINE); rect(im, w - 3, 2, 1, h - 4, LINE)
    rect(im, w // 2, 2, 1, h - 4, LINE)
    for x in range(w // 2 - 12, w // 2 + 13):
        for y in range(h // 2 - 12, h // 2 + 13):
            d = math.hypot(x - w // 2, y - h // 2)
            if 10.5 <= d <= 11.5: im.load()[x, y] = LINE
    for side in (0, 1):
        x0 = 2 if side == 0 else w - 3 - 20
        rect(im, x0, h // 2 - 16, 21, 1, LINE); rect(im, x0, h // 2 + 16, 21, 1, LINE)
        rect(im, x0 + (20 if side == 0 else 0), h // 2 - 16, 1, 33, LINE)
        gx = 0 if side == 0 else w - 2
        rect(im, gx, h // 2 - 7, 2, 15, C['white'])
    return im
save(pitch_match(), 'sprites/pitch/pitch_match_176x76.png', 'Match replay full pitch, side view. Draw at 2x')
BALL = ["..OOOO..", ".OWWOWO.", "OWOOWWWO", "OWOWWOWO", "OWWWOOWO", "OOWWOWWO", ".OWOWWO.", "..OOOO.."]
ballg = grid(BALL, {'O': C['ink'], 'W': C['white']})
balls = [(f'ball_{i}', ballg.rotate(-90 * i, resample=Image.NEAREST)) for i in range(4)]
sh = Image.new('RGBA', (8, 3), T); rect(sh, 1, 0, 6, 3, hexc('#000000', 70)); rect(sh, 0, 1, 8, 1, hexc('#000000', 70))
balls.append(('ball_shadow', sh))
pack_sheet(balls, 'sheets/ball.png', 'Ball spin (4 frames, 8x8) + shadow', cols=5)
for n, im in balls: save(im, f'sprites/pitch/{n}.png', 'Ball')
FAN0 = [".HH.", ".SS.", "KKKK", "SKKS", ".PP."]
FAN1 = ["SHHS", "KSSK", ".KK.", ".KK.", ".PP."]
fans = []
for cn, col in [('pink', 'pink'), ('yellow', 'yellow'), ('blue', 'blue'), ('white', 'white')]:
    for fi, fr in enumerate([FAN0, FAN1]):
        fans.append((f'fan_{cn}_{fi}', grid(fr, {'H': hexc('#2b1a10'), 'S': hexc('#c98a5d'), 'K': C[col], 'P': C['navy3']})))
pack_sheet(fans, 'sheets/crowd_fans.png', 'Crowd fans 4x5: 4 shirt colours x 2 frames (sit / cheer)', cols=8)
strip = Image.new('RGBA', (64, 16), C['slate'])
for row in range(2):
    rect(strip, 0, row * 8 + 6, 64, 2, C['navy2'])
    for k in range(10):
        f = fans[(k * 3 + row) % 4 * 2][1]; strip.alpha_composite(f, (k * 6 + 2 + row * 3 % 6, row * 8 + 1))
save(strip, 'sprites/pitch/crowd_strip_tile.png', 'Repeating crowd stand tile 64x16 (static frame; swap fan frames to animate)')
def stadium(level):
    im = Image.new('RGBA', (48, 28), T)
    rect(im, 4, 18, 40, 8, C['grass']); rect(im, 4, 18, 40, 1, LINE)
    rect(im, 2, 26, 44, 2, C['ink'])
    stands = {1: [(6, 12, 14, 6)], 2: [(4, 10, 18, 8), (26, 12, 18, 6)], 3: [(2, 6, 44, 6), (2, 12, 6, 6), (40, 12, 6, 6)]}[level]
    for (x, y, w, h) in stands:
        rect(im, x, y, w, h, C['ink']); rect(im, x + 1, y + 1, w - 2, h - 2, C['pink'])
        for yy in range(y + 2, y + h - 1, 2): rect(im, x + 1, yy, w - 2, 1, C['pdark'])
    if level >= 2:
        for lx in ([3, 44] if level == 3 else [44]):
            rect(im, lx, 0, 1, 18, C['ink']); rect(im, lx - 1, 0, 3, 2, C['yellow'])
    return im
stad = [(f'stadium_lv{l}', stadium(l)) for l in (1, 2, 3)]
for n, im in stad: save(im, f'sprites/club/{n}.png', 'Stadium illustration 48x28 (levels 1-3, 4-7, 8-10)')
PREVIEW.append(('PITCH + CROWD + STADIUM', [tile, pitch_squad(), pitch_match()] + [f for _, f in balls] + [f for _, f in fans] + [strip] + [f for _, f in stad]))

# ================= 7. FX + TEXT BANNERS =================
fx = []
CONF = ['pink', 'yellow', 'blue', 'lime', 'white']
for c in CONF:
    im = Image.new('RGBA', (2, 3), C[c]); fx.append((f'confetti_{c}', im))
SPARK = [["...", ".W.", "..."], [".W.", "WYW", ".W."], ["..W..", "..Y..", "WYYYW", "..Y..", "..W.."], ["W...W", ".....", "..Y..", ".....", "W...W"]]
for i, s in enumerate(SPARK):
    im = Image.new('RGBA', (5, 5), T); im.alpha_composite(grid(s, {'W': C['white'], 'Y': C['yellow']}), ((5 - len(s[0])) // 2, (5 - len(s)) // 2)); fx.append((f'sparkle_{i}', im))
for i in range(3):
    im = Image.new('RGBA', (17, 17), T); r = 3 + i * 3
    for a in range(0, 360, 45):
        x = 8 + round(math.cos(math.radians(a)) * r); y = 8 + round(math.sin(math.radians(a)) * r)
        rect(im, x, y, 1 + (i < 2), 1 + (i < 2), C['yellow'] if i < 2 else C['white'])
    fx.append((f'burst_{i}', im))
pack_sheet(fx, 'sheets/fx.png', 'Confetti pieces, sparkle (4 frames), star burst (3 frames)', cols=12)
banners = []
for s, col in [('GOAL!', 'yellow'), ('PERFECT!', 'yellow'), ('GOOD!', 'lime'), ('CLOSE!', 'blue'), ('WIN!', 'lime'), ('DRAW', 'yellow'), ('LOSS', 'pink'), ('FULL TIME', 'white'), ('KICK OFF!', 'white'), ('PROMOTED!', 'lime'), ('NEW!', 'lime'), ('LEGEND!', 'r4'), ('STAR!', 'r3'), ('WELCOME BACK!', 'yellow'), ('SAVED!', 'blue')]:
    im = banner(s, C[col], 3); nm = s.lower().replace('!', '').replace(' ', '_')
    save(im, f'sprites/text/banner_{nm}.png', 'Pixel text banner, outlined + drop shadow'); banners.append((f'banner_{nm}', im))
pack_sheet(banners, 'sheets/text_banners.png', 'Pixel text banners', cols=3)
PREVIEW.append(('FX + BANNERS', [f for _, f in fx] + [f for _, f in banners]))

# ================= 8. UI 9-SLICE =================
def button(fill, light, dark, w=12, h=12):
    im = Image.new('RGBA', (w, h), T)
    rect(im, 1, 0, w - 2, h, C['ink']); rect(im, 0, 1, w, h - 2, C['ink'])
    rect(im, 1, 1, w - 2, h - 2, fill)
    rect(im, 1, 1, w - 2, 1, light); rect(im, 1, 1, 1, h - 3, light)
    rect(im, 1, h - 3, w - 2, 2, dark); rect(im, w - 2, 1, 1, h - 3, dark)
    return im
nine = []
for n, f, l, d in [('yellow', '#ffd23f', '#ffe98c', '#c78a00'), ('lime', '#b6ff3b', '#dcff9a', '#6fae1d'), ('pink', '#ff4f79', '#ff9db4', '#b8264f'), ('blue', '#5ec8ff', '#a9e3ff', '#2f7fb0'), ('grey', '#3a3f72', '#5a609a', '#262b52'), ('disabled', '#2a2e55', '#2a2e55', '#20244a')]:
    im = button(hexc(f), hexc(l), hexc(d)); save(im, f'sprites/ui/button_{n}_9slice.png', 'Button 12x12, 9-slice insets 4px (border-image: url() 4 fill)'); nine.append((f'button_{n}', im))
for n, f in [('panel', 'navy2'), ('panel_dark', 'navy3'), ('panel_black', 'ink')]:
    im = Image.new('RGBA', (12, 12), T); rect(im, 1, 0, 10, 12, hexc('#000000')); rect(im, 0, 1, 12, 10, hexc('#000000')); rect(im, 1, 1, 10, 10, C[f])
    save(im, f'sprites/ui/{n}_9slice.png', 'Panel 12x12, 9-slice insets 3px'); nine.append((n, im))
for n, col in [('slot', 'navy'), ('slot_selected', 'yellow'), ('slot_warning', 'pink')]:
    im = Image.new('RGBA', (12, 12), T); rect(im, 1, 0, 10, 12, C[col] if col != 'navy' else hexc('#000000')); rect(im, 0, 1, 12, 10, C[col] if col != 'navy' else hexc('#000000')); rect(im, 2, 2, 8, 8, C['navy'])
    save(im, f'sprites/ui/{n}_9slice.png', 'Pitch slot frame, 9-slice insets 3px'); nine.append((n, im))
bar = Image.new('RGBA', (12, 8), T); rect(bar, 1, 0, 10, 8, hexc('#000000')); rect(bar, 0, 1, 12, 6, hexc('#000000')); rect(bar, 2, 2, 8, 4, C['navy3'])
save(bar, 'sprites/ui/progress_track_9slice.png', 'Progress bar track, 9-slice insets 3px'); nine.append(('progress_track', bar))
for n in ['yellow', 'lime', 'blue', 'pink']:
    im = Image.new('RGBA', (4, 4), C[n]); rect(im, 0, 0, 4, 1, hexc('#ffffff', 90)); save(im, f'sprites/ui/progress_fill_{n}.png', 'Progress fill, stretch horizontally'); nine.append((f'fill_{n}', im))
tb = Image.new('RGBA', (100, 10), T); rect(tb, 0, 0, 100, 10, hexc('#000000')); rect(tb, 1, 1, 98, 8, C['navy3']); rect(tb, 25, 1, 43, 8, hexc('#2f7d3a')); rect(tb, 68, 1, 20, 8, C['yellow'])
save(tb, 'sprites/ui/timing_bar_100x10.png', 'Warm-up kick timing bar: green 25-68%, gold 68-88%')
mk = Image.new('RGBA', (4, 16), T); rect(mk, 0, 0, 4, 16, hexc('#000000')); rect(mk, 1, 1, 2, 14, C['white'])
save(mk, 'sprites/ui/timing_marker.png', 'Warm-up kick marker')
shelf = [('shelf_empty', None), ('shelf_full', None)]
se = Image.new('RGBA', (8, 10), C['navy3']); rect(se, 0, 0, 8, 1, C['slate']); rect(se, 0, 9, 8, 1, C['slate']); rect(se, 0, 0, 1, 10, C['slate']); rect(se, 7, 0, 1, 10, C['slate'])
sf = Image.new('RGBA', (8, 10), C['blue']); rect(sf, 0, 8, 8, 2, C['bdark']); rect(sf, 6, 0, 2, 10, C['bdark']); rect(sf, 1, 1, 1, 3, C['white'])
save(se, 'sprites/ui/shelf_slot_empty.png', 'Pack shelf slot, empty'); save(sf, 'sprites/ui/shelf_slot_full.png', 'Pack shelf slot, filled')
nine += [('shelf_empty', se), ('shelf_full', sf), ('timing_bar', tb), ('timing_marker', mk)]
NAVI = {'club': 'club', 'packs': 'packs', 'squad': 'squad', 'league': 'league', 'shop': 'shop'}
PREVIEW.append(('UI PIECES', [f for _, f in nine]))

# ================= 9. APP ICON + SPLASH =================
ic = Image.new('RGBA', (64, 64), C['navy'])
for y in range(36, 64, 6): rect(ic, 0, y, 64, 6, C['grass'] if (y // 6) % 2 == 0 else C['grass2'])
rect(ic, 0, 36, 64, 1, LINE)
crest = grid(SHIELDS['shield'], {'O': C['ink'], 'A': C['pink'], 'B': C['yellow']}); crest.alpha_composite(grid(EMBLEMS['ball'], {'O': C['ink'], 'W': C['white']}), (4, 3))
crest2 = scale(crest, 2); ic.alpha_composite(crest2, (16, 6))
b2 = scale(ballg, 1); ic.alpha_composite(b2, (46, 44)); ic.alpha_composite(sh, (46, 53))
for (x, y) in [(6, 8), (54, 12), (10, 26), (52, 28)]:
    ic.alpha_composite(grid(SPARK[2], {'W': C['white'], 'Y': C['yellow']}), (x, y))
icon = ic.resize((1024, 1024), Image.NEAREST).convert('RGB')
save(icon, 'app/icon_1024.png', 'App Store / Play icon 1024x1024 (no alpha). Generate smaller sizes with @capacitor/assets')
fg = Image.new('RGBA', (108, 108), T); fg.alpha_composite(scale(crest, 3), (30, 27))
save(fg.resize((432, 432), Image.NEAREST), 'app/icon_android_foreground_432.png', 'Android adaptive icon foreground (safe zone centred), background = #1b1f3b')
sp = Image.new('RGBA', (195, 422), C['navy'])
for y in range(300, 422, 12): rect(sp, 0, y, 195, 12, C['grass'] if (y // 12) % 2 == 0 else C['grass2'])
rect(sp, 0, 300, 195, 1, LINE)
logo1 = banner('PIXEL', C['yellow'], 5); logo2 = banner('PITCH', C['pink'], 5)
sp.alpha_composite(scale(crest, 3), ((195 - 48) // 2, 90))
sp.alpha_composite(logo1, ((195 - logo1.width) // 2, 160)); sp.alpha_composite(logo2, ((195 - logo2.width) // 2, 192))
sp.alpha_composite(scale(ballg, 2), (90, 284))
tag = text('IDLE 5-A-SIDE FOOTBALL', C['grey']); sp.alpha_composite(tag, ((195 - tag.width) // 2, 232))
save(sp.resize((1170, 2532), Image.NEAREST).convert('RGB'), 'app/splash_1170x2532.png', 'Splash / launch screen (iPhone). Centre-crop for other sizes; background #1b1f3b')
save(sp, 'app/splash_logical_195x422.png', 'Splash at 1x for web/dev')
logo = Image.new('RGBA', (logo1.width + 4, logo1.height + logo2.height + 6), T); logo.alpha_composite(logo1, (2, 0)); logo.alpha_composite(logo2, ((logo.width - logo2.width) // 2, logo1.height + 4))
save(logo, 'app/logo_pixel_pitch.png', 'Wordmark (working title) at 1x, scale by integers')
PREVIEW.append(('APP', [ic, scale(sp, 1), logo]))

# ================= 10. PALETTE =================
os.makedirs(os.path.join(OUT, 'palette'), exist_ok=True)
with open(os.path.join(OUT, 'palette', 'pixel-pitch.gpl'), 'w') as fh:
    fh.write('GIMP Palette\nName: Pixel Pitch\nColumns: 8\n#\n')
    for k, v in PAL.items():
        r, g, b, _ = hexc(v); fh.write(f'{r:3d} {g:3d} {b:3d}\t{k}\n')
with open(os.path.join(OUT, 'palette', 'palette.json'), 'w') as fh:
    json.dump(PAL, fh, indent=1)
MANIFEST.append({'file': 'palette/pixel-pitch.gpl', 'use': 'Palette for Aseprite / GIMP'}); MANIFEST.append({'file': 'palette/palette.json', 'use': 'Palette tokens for CSS/TS'})

# ================= 11. AUDIO =================
SR = 22050
def tone(freq, dur, wave_='square', vol=0.35, duty=0.5, slide=0.0, decay=6.0):
    n = int(SR * dur); t = np.arange(n) / SR
    f = freq + slide * t / max(dur, 1e-6)
    ph = np.cumsum(f) / SR
    if wave_ == 'square':
        y = np.where((ph % 1) < duty, 1.0, -1.0)
    elif wave_ == 'tri':
        y = 2 * np.abs(2 * (ph % 1) - 1) - 1
    elif wave_ == 'noise':
        y = np.random.uniform(-1, 1, n)
    else:
        y = np.sin(2 * np.pi * ph)
    env = np.exp(-decay * t) * np.minimum(1, t * 400)
    return y * env * vol
def seq(parts):
    return np.concatenate(parts)
def mix(*tracks):
    L = max(len(t) for t in tracks); out = np.zeros(L)
    for t in tracks: out[:len(t)] += t
    return out
def note(n):
    return 440.0 * 2 ** ((n - 69) / 12)
def wav(name, y, use):
    y = np.clip(y, -1, 1); data = (y * 32767).astype('<i2').tobytes()
    rel = f'audio/{name}.wav'; path = os.path.join(OUT, rel); os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data)
    MANIFEST.append({'file': rel, 'use': use, 'seconds': round(len(y) / SR, 2)})
np.random.seed(3)
wav('sfx/tap', tone(880, 0.05, duty=0.25, decay=40), 'Button tap')
wav('sfx/back', tone(520, 0.07, duty=0.25, slide=-200, decay=30), 'Back / close')
wav('sfx/error', seq([tone(220, 0.08, decay=10), tone(180, 0.12, decay=10)]), 'Not allowed / not enough coins')
wav('sfx/coin', seq([tone(note(84), 0.05, duty=0.25, decay=10), tone(note(91), 0.18, duty=0.25, decay=12)]), 'Single coin')
wav('sfx/collect', seq([tone(note(76 + i * 2), 0.04, duty=0.25, decay=15) for i in range(8)]), 'Collect stadium coins (rising run)')
wav('sfx/pack_rip', mix(tone(0, 0.35, 'noise', 0.5, decay=9), tone(300, 0.35, duty=0.3, slide=900, vol=0.15, decay=8)), 'Pack rip')
wav('sfx/card_flip', mix(tone(0, 0.08, 'noise', 0.35, decay=40), tone(660, 0.08, duty=0.25, slide=400, vol=0.2, decay=30)), 'Card flip')
wav('sfx/reveal_common', tone(note(72), 0.2, duty=0.25, decay=10), 'Reveal: Grassroots / Semi-Pro')
wav('sfx/reveal_pro', seq([tone(note(72), 0.08, decay=12), tone(note(79), 0.25, decay=8)]), 'Reveal: Pro')
wav('sfx/reveal_star', seq([tone(note(n), 0.08, decay=8) for n in (72, 76, 79)] + [tone(note(84), 0.45, decay=4)]), 'Reveal: Star')
wav('sfx/reveal_legend', mix(seq([tone(note(n), 0.09, decay=6) for n in (67, 72, 76, 79, 84)] + [tone(note(88), 0.8, decay=2.5)]), seq([tone(note(n) / 2, 0.09, 'tri', 0.3, decay=4) for n in (67, 72, 76, 79, 84)] + [tone(note(76) / 2, 0.8, 'tri', 0.3, decay=2)])), 'Reveal: Legend')
wav('sfx/sign', seq([tone(note(79), 0.06, duty=0.25, decay=10), tone(note(86), 0.15, duty=0.25, decay=10)]), 'Player signed')
wav('sfx/sell', seq([tone(note(86), 0.05, duty=0.25, decay=12), tone(note(84), 0.05, duty=0.25, decay=12), tone(note(91), 0.15, duty=0.25, decay=10)]), 'Player sold (coins)')
wav('sfx/swap', seq([tone(500, 0.05, duty=0.25, slide=300, decay=20), tone(800, 0.05, duty=0.25, slide=-300, decay=20)]), 'Lineup swap / formation change')
wav('sfx/score_up', seq([tone(note(72 + i), 0.03, duty=0.25, decay=20) for i in range(0, 12, 2)]), 'Lineup score goes up')
def whistle(d):
    n = int(SR * d); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * (2400 + 120 * np.sin(2 * np.pi * 38 * t)) * t) * 0.3 * np.minimum(1, t * 60) * np.minimum(1, (d - t) * 30)
    return y
wav('sfx/whistle_kickoff', whistle(0.45), 'Kick-off whistle')
wav('sfx/whistle_fulltime', seq([whistle(0.3), np.zeros(int(SR * 0.08)), whistle(0.3), np.zeros(int(SR * 0.08)), whistle(0.6)]), 'Full-time whistle (three blasts)')
wav('sfx/kick', mix(tone(0, 0.07, 'noise', 0.5, decay=50), tone(140, 0.08, 'sine', 0.6, slide=-80, decay=30)), 'Ball kick (warm-up, replay)')
def crowd(d, swell=True):
    n = int(SR * d); y = np.random.uniform(-1, 1, n)
    k = 60; y = np.convolve(y, np.ones(k) / k, mode='same') * 6
    t = np.arange(n) / SR; env = np.sin(np.pi * t / d) if swell else np.ones(n) * 0.6
    return y * env * 0.35
wav('sfx/goal', mix(crowd(1.6), seq([tone(note(n), 0.1, decay=5) for n in (72, 76, 79, 84, 79, 84)] + [tone(note(88), 0.5, decay=3)])), 'Goal! (crowd + jingle)')
wav('sfx/perfect', seq([tone(note(n), 0.06, duty=0.25, decay=8) for n in (84, 88, 91, 96)]), 'Warm-up perfect hit')
wav('sfx/upgrade', seq([tone(note(n), 0.07, decay=8) for n in (60, 64, 67, 72)] + [tone(note(76), 0.3, decay=5)]), 'Stadium upgrade / level up')
wav('sfx/promoted', mix(seq([tone(note(n), d, decay=3) for n, d in ((67, .15), (67, .15), (72, .15), (76, .3), (72, .15), (76, .3), (79, .7))]), seq([tone(note(n) / 2, d, 'tri', 0.35, decay=2) for n, d in ((60, .3), (64, .3), (67, .45), (72, .9))]), crowd(2.0)), 'Promotion fanfare')
wav('sfx/win', seq([tone(note(n), 0.1, decay=6) for n in (72, 76, 79)] + [tone(note(84), 0.4, decay=4)]), 'Match won')
wav('sfx/draw', seq([tone(note(72), 0.12, decay=6), tone(note(72), 0.3, decay=5)]), 'Match drawn')
wav('sfx/loss', seq([tone(note(72), 0.12, decay=6), tone(note(67), 0.12, decay=6), tone(note(64), 0.35, decay=4)]), 'Match lost (gentle)')
wav('sfx/notification', seq([tone(note(84), 0.07, duty=0.25, decay=10), tone(note(79), 0.07, duty=0.25, decay=10), tone(note(88), 0.2, duty=0.25, decay=8)]), 'Custom push / local notification sound (convert to .caf/.ogg)')
wav('sfx/crowd_loop', crowd(4.0, swell=False), 'Crowd ambience loop for match replay (loops)')
# music loop: 8 bars, 120bpm
bpm = 120; beat = 60 / bpm; bars = 8
chords = [(60, 64, 67), (57, 60, 64), (53, 57, 60), (55, 59, 62)] * 2
lead_pat = [0, 2, 1, 2, 0, 2, 1, 3]
total = int(SR * beat * 4 * bars); music = np.zeros(total)
for b, ch in enumerate(chords):
    for k in range(8):
        st = int(SR * (b * 4 + k * 0.5) * beat)
        n_ = ch[lead_pat[k] % 3] + (12 if lead_pat[k] == 3 else 0) + 12
        s = tone(note(n_), beat * 0.45, duty=0.25, vol=0.16, decay=5); music[st:st + len(s)] += s[:max(0, total - st)]
    for k in range(4):
        st = int(SR * (b * 4 + k) * beat)
        s = tone(note(ch[0] - 12), beat * 0.9, 'tri', 0.28, decay=1.5); music[st:st + len(s)] += s[:max(0, total - st)]
        if k % 2 == 1:
            s = tone(0, 0.05, 'noise', 0.12, decay=60); music[st:st + len(s)] += s[:max(0, total - st)]
wav('music/menu_loop_120bpm', music, 'Chiptune menu loop, 8 bars @120bpm, seamless loop (placeholder until final music)')

# ================= PREVIEW CONTACT SHEET =================
S = 4; Wp = 1400
rows_out = []
for title, imgs in PREVIEW:
    t = text(title, C['yellow'], 4)
    x, y, rowh = 0, t.height + 12, 0
    placed = []
    for im in imgs:
        s = S if im.width * S <= Wp - 40 else max(1, (Wp - 40) // im.width)
        w, h = im.width * s, im.height * s
        if x + w > Wp - 40:
            x = 0; y += rowh + 16; rowh = 0
        placed.append((im, s, x, y)); x += w + 16; rowh = max(rowh, h)
    hgt = y + rowh + 24
    sec = Image.new('RGBA', (Wp, hgt), C['navy'])
    sec.alpha_composite(t, (20, 6))
    for im, s, xx, yy in placed:
        sec.alpha_composite(scale(im, s), (20 + xx, yy))
    rows_out.append(sec)
H = sum(r.height for r in rows_out)
prev = Image.new('RGBA', (Wp, H), C['navy'])
yy = 0
for r in rows_out:
    prev.alpha_composite(r, (0, yy)); yy += r.height
    rect(prev, 0, yy - 3, Wp, 3, C['ink'])
prev = prev.convert('RGB')
prev.save(os.path.join(os.path.dirname(OUT), 'pixel-pitch-assets-preview.png'))
save(prev, 'preview/contact_sheet.png', 'Overview of the pack at 4x')

with open(os.path.join(OUT, 'manifest.json'), 'w') as fh:
    json.dump({'name': 'Pixel Pitch V1 assets', 'pixelScale': 'Draw at integer scale (2x-4x), image-rendering: pixelated', 'assets': MANIFEST}, fh, indent=1)
print('assets:', len(MANIFEST), 'preview', prev.size)
