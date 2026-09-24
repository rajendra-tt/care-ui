"""Turn the screencast frames captured by record-walkthrough.mjs into a constant-fps MP4.

    python tools/encode-video.py recordings/_capture recordings/CARE2.0-UI-Walkthrough.mp4
"""
import json
import sys
from pathlib import Path

import cv2

src = Path(sys.argv[1] if len(sys.argv) > 1 else "recordings/_capture")
out = Path(sys.argv[2] if len(sys.argv) > 2 else "recordings/CARE2.0-UI-Walkthrough.mp4")
FPS = 25

frames = json.loads((src / "frames.json").read_text())
frames.sort(key=lambda f: f["t"])
t0, t_end = frames[0]["t"], frames[-1]["t"] + 1.0

first = cv2.imread(str(src / "frames" / frames[0]["file"]))
h, w = first.shape[:2]
out.parent.mkdir(parents=True, exist_ok=True)
writer = cv2.VideoWriter(str(out), cv2.VideoWriter_fourcc(*"avc1"), FPS, (w, h))
if not writer.isOpened():  # no H.264 encoder: fall back to MPEG-4 part 2
    writer = cv2.VideoWriter(str(out), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (w, h))

# Chrome only sends a frame when something repaints; hold the latest frame to fill each tick.
i, cur, cur_file, written = 0, first, frames[0]["file"], 0
t = t0
while t <= t_end:
    while i + 1 < len(frames) and frames[i + 1]["t"] <= t:
        i += 1
    if frames[i]["file"] != cur_file:
        img = cv2.imread(str(src / "frames" / frames[i]["file"]))
        if img is not None:
            cur = img if img.shape[:2] == (h, w) else cv2.resize(img, (w, h))
        cur_file = frames[i]["file"]
    writer.write(cur)
    written += 1
    t = t0 + written / FPS
writer.release()
print(f"{out}: {written} frames, {written / FPS:.1f} s at {FPS} fps, {w}x{h}, {out.stat().st_size / 1e6:.1f} MB")
