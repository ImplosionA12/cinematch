"""Crop the right-hand empty area of each screenshot to the widest text line (min 820 px)."""
import glob, os
from PIL import Image
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
for f in sorted(glob.glob(os.path.join(HERE, "shots", "q*_*.png"))):
    im = Image.open(f).convert("RGB"); a = np.asarray(im)
    body = a[40:-4, : a.shape[1] - 24]
    cols = np.where((body.max(axis=2) > 70).any(axis=0))[0]
    if len(cols) == 0: continue
    right = max(820, min(a.shape[1], cols[-1] + 60))
    if right < a.shape[1]:
        im.crop((0, 0, right, a.shape[0])).save(f)
    print(os.path.basename(f), right)
