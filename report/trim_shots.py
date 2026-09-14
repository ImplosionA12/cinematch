"""Trim the empty console area below the last line of text in each captured screenshot."""
import glob, os
from PIL import Image
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
import re
files = sorted(glob.glob(os.path.join(HERE, "shots", "q*_*.png")))
last = {}
for f in files:
    q, pg = re.match(r".*q(\d+)_(\d+)\.png$", f).groups()
    if int(pg) >= last.get(q, (0, ""))[0]: last[q] = (int(pg), f)
for f in sorted(v[1] for v in last.values()):
    im = Image.open(f).convert("RGB")
    a = np.asarray(im)
    # rows that contain something brighter than the console background (ignore title bar + scrollbar column)
    body = a[40:-4, : a.shape[1] - 24]
    bright = (body.max(axis=2) > 70).any(axis=1)
    rows = np.where(bright)[0]
    if len(rows) == 0:
        continue
    bottom = 40 + rows[-1] + 24
    if bottom < a.shape[0]:
        im = im.crop((0, 0, a.shape[1], bottom))
        im.save(f)
    print(os.path.basename(f), im.size)
