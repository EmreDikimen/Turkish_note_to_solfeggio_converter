"""The Python half of `tools/tests/frame-test.ts`: `whiten_frame` on six synthetic pages.

Run it after ANY change to `whiten_frame` or the FRAME_* constants and paste the six sha256 values
into the `CASES` table of the TypeScript test. That test builds the same six pages byte for byte
and must land on the same bytes, which is what holds the browser's `whitenFrame` to this one.
Synthetic on purpose: the screenshot the rule was built for is someone else's engraving and this
repo is public.

Run: .venv-ml/bin/python ml/prep/frame_whiten_ref.py
"""
import hashlib
import sys
from pathlib import Path

import numpy as np

from ml.omr import page_to_strips as P  # noqa: E402
W,H=600,800
def page(x0=40,x1=560):
    g=np.full((H,W),255,np.uint8)
    for k in range(5):
        for i in range(5): g[100+k*130+10*i, x0:x1]=0
    return g
def clean(): return page()
def gray_frame():
    g=page(); g[:, :20]=53; g[:, W-20:]=53; g[380:410,:]=53; return g
def black_bars():
    g=page(0,W); g[:60,:]=0; g[H-60:,:]=0; return g
def slanted():
    g=page()
    for y in range(H): g[y,:20+y//10]=40
    return g
def edge_line():
    g=page(); g[:,W-1]=14; return g
def cut_content():
    g=page(); g[:30,200:230]=0; return g
for f in (clean,gray_frame,black_bars,slanted,edge_line,cut_content):
    g=f(); a=P.whiten_frame(g)
    print(f"{f.__name__:12s} same={a is g!s:5s} changed={int((a!=g).sum()):6d} sha={hashlib.sha256(a.tobytes()).hexdigest()}  probes: corner={a[5,5]} gap={a[395,300]} staff_left_edge={a[100,0]} staff_mid={a[100,300]}")
