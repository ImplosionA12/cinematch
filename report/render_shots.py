"""Render each query + its real mongosh output (report/results.json) as a terminal-style PNG."""
import json, os, re, textwrap
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "shots")
os.makedirs(OUT, exist_ok=True)

FONT = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 22)
FONT_B = ImageFont.truetype(r"C:\Windows\Fonts\consolab.ttf", 22)
UI = ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", 20)
W = 1500
PAD = 26
LH = 30
MAX_OUT_LINES = 64
MAX_COLS = 118

BG = (12, 12, 12)
FG = (204, 204, 204)
DIM = (140, 140, 140)
PROMPT = (204, 204, 204)
KEY = (204, 204, 204)
STR = (19, 161, 14)
NUM = (193, 156, 0)
OP = (204, 204, 204)
TITLEBAR = (255, 255, 255)

results = json.load(open(os.path.join(HERE, "results.json"), encoding="utf8"))


def wrap(line, cols=MAX_COLS):
    if len(line) <= cols:
        return [line]
    ind = len(line) - len(line.lstrip(" "))
    body = textwrap.wrap(line.strip(), cols - ind - 2, break_long_words=True, break_on_hyphens=False) or [""]
    return [" " * ind + body[0]] + [" " * (ind + 2) + b for b in body[1:]]


TOKEN = re.compile(r"""("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\$[A-Za-z]+)|(\b\d+(?:\.\d+)?\b)|(ISODate|ObjectId|Long|db)""")


def draw_colored(d, x, y, text, base):
    """Simple syntax colouring for both the command and the output."""
    pos = 0
    for m in TOKEN.finditer(text):
        if m.start() > pos:
            d.text((x, y), text[pos:m.start()], font=FONT, fill=base)
            x += FONT.getlength(text[pos:m.start()])
        tok = m.group(0)
        col = STR if m.group(1) else KEY if m.group(2) else NUM if m.group(3) else OP
        d.text((x, y), tok, font=FONT, fill=col)
        x += FONT.getlength(tok)
        pos = m.end()
    if pos < len(text):
        d.text((x, y), text[pos:], font=FONT, fill=base)


for r in results:
    cmd_lines = []
    for i, l in enumerate(r["shell"].split("\n")):
        cmd_lines += wrap(l)
    out_raw = r["output"].split("\n")
    truncated = len(out_raw) > MAX_OUT_LINES
    out_lines = []
    for l in out_raw[:MAX_OUT_LINES]:
        out_lines += wrap(l)
    if truncated:
        out_lines.append(f"... ({len(out_raw) - MAX_OUT_LINES} more lines)")

    H = PAD * 2 + 44 + LH * (len(cmd_lines) + len(out_lines) + 2)
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # title bar
    d.rectangle([0, 0, W, 44], fill=TITLEBAR)
    d.rectangle([12, 12, 32, 32], fill=(12, 12, 12))
    d.text((16, 10), ">_", font=FONT_B, fill=(204, 204, 204))
    d.text((44, 10), "mongosh - cinematch", font=UI, fill=(30, 30, 30))
    for i, g in enumerate(["—", "☐", "✕"]):
        d.text((W - 150 + i * 48, 8), g, font=UI, fill=(60, 60, 60))

    y = 44 + PAD
    for i, l in enumerate(cmd_lines):
        prompt = "cinematch> " if i == 0 else "...        "
        d.text((PAD, y), prompt, font=FONT, fill=PROMPT)
        draw_colored(d, PAD + FONT_B.getlength(prompt), y, l, FG)
        y += LH
    y += LH // 2
    for l in out_lines:
        draw_colored(d, PAD, y, l, FG if not l.startswith("...") else DIM)
        y += LH
    y += LH // 2
    d.text((PAD, y), "cinematch> ", font=FONT, fill=PROMPT)
    d.rectangle([PAD + FONT_B.getlength("cinematch> "), y + 4, PAD + FONT_B.getlength("cinematch> ") + 12, y + 26], fill=FG)

    img.save(os.path.join(OUT, f"q{r['id']:02d}.png"), optimize=True)
    print(f"q{r['id']:02d}.png  {W}x{H}")
