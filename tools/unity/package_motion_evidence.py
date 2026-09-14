"""Package actual Unity capture frames, without generating or altering scene content."""

import argparse
from pathlib import Path

from PIL import Image, ImageChops


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("frames", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    sources = sorted(args.frames.glob("生命樹動態_*.png"))
    if len(sources) != 90:
        raise RuntimeError(f"Expected 90 Unity frames, found {len(sources)}")
    frames = []
    for path in sources[::2]:
        with Image.open(path) as original:
            frames.append(original.convert("RGB").resize((384, 512), Image.Resampling.LANCZOS))
    if all(ImageChops.difference(frames[0], frame).getbbox() is None for frame in frames[1:]):
        raise RuntimeError("Capture contains no visible movement")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(args.output, save_all=True, append_images=frames[1:],
                   duration=[70, 60, 70] * 15, loop=0, optimize=False)
    print(f"Verified 90 rendered frames; packaged {len(frames)} frames: {args.output}")


if __name__ == "__main__":
    main()
