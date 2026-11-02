from PIL import Image

from _paths import SCRIPTS

image = Image.open(SCRIPTS / "overlay-shot-crop.png")
image.crop((870, 20, 1560, 360)).save(SCRIPTS / "overlay-card.png")
print(image.size)
