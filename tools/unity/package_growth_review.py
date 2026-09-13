"""Arrange six actual Unity close-ups for review, without synthesizing imagery."""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser()
parser.add_argument("directory", type=Path)
args = parser.parse_args()
labels = ("種子", "發芽", "幼苗", "小樹", "成樹", "大樹")
sheet = Image.new("RGB", (1152, 1104), "#f5f7f5")
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype("/System/Library/Fonts/Hiragino Sans GB.ttc", 24)
for stage, label in enumerate(labels):
    path = args.directory / f"{stage:02d}-{label}-近景.png"
    with Image.open(path) as frame:
        frame = frame.convert("RGB").resize((384, 512), Image.Resampling.LANCZOS)
        x, y = stage % 3 * 384, stage // 3 * 552
        sheet.paste(frame, (x, y))
        draw.text((x + 16, y + 519), label, font=font, fill="#17201c")
sheet.save(args.directory / "六階段實景總覽.jpg", quality=90)
print("六階段實景總覽已排版；每格為不同距離的近景，不代表相同比例。")
