from pathlib import Path

from PIL import Image

from _paths import ROOT

source = ROOT / "scripts" / "vision-e2e.png"
target = ROOT / "docs" / "preview-vision.png"
image = Image.open(source)
width = 1200
height = int(image.height * width / image.width)
image.resize((width, height), Image.Resampling.LANCZOS).save(target)
print(target, target.stat().st_size, image.size, "->", (width, height))
