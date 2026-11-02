import json
from pathlib import Path

import cv2

from lore_engine import vision
from _paths import SCRIPTS

for name in ("genshin-crop.png", "realtest-crop.png"):
    path = SCRIPTS / name
    image = cv2.imread(str(path))
    print(name, None if image is None else image.shape)
    if image is None:
        continue
    analysis = vision.analyze(image, "all", 12)
    annotated = vision.annotate(image, analysis)
    out = SCRIPTS / ("vision-" + name)
    cv2.imwrite(str(out), annotated)
    print(json.dumps({
        "mode": analysis["mode"],
        "findings": len(analysis["findings"]),
        "elements": len(analysis["elements"]),
        "metrics": analysis["metrics"],
        "warnings": analysis["warnings"],
        "first": analysis["findings"][:6],
    }, ensure_ascii=False, indent=2)[:5000])
    print("wrote", out)
