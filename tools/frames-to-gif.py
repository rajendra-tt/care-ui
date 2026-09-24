"""Assemble PNG frames into a looping GIF (used by tools/export-loader.mjs).

    python tools/frames-to-gif.py <frame_dir> <out.gif> <frame_ms>
"""
import sys
from pathlib import Path

from PIL import Image

frame_dir, out, frame_ms = Path(sys.argv[1]), Path(sys.argv[2]), float(sys.argv[3])
files = sorted(frame_dir.glob("*.png"))
frames = [Image.open(f).convert("RGB") for f in files]

# One shared palette built from a sample of all frames keeps colours stable between frames
# (per-frame palettes make the flat brand colours flicker).
w, h = frames[0].size
strip = Image.new("RGB", (w, h * min(len(frames), 8)))
for i, f in enumerate(frames[:: max(1, len(frames) // 8)][:8]):
    strip.paste(f, (0, h * i))
palette = strip.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
quantized = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in frames]

quantized[0].save(
    out,
    save_all=True,
    append_images=quantized[1:],
    duration=round(frame_ms),
    loop=0,
    optimize=True,
    disposal=1,
)
print(f"{out}: {len(frames)} frames, {w}x{h}, {round(frame_ms)} ms/frame, {out.stat().st_size / 1024:.0f} KB")
