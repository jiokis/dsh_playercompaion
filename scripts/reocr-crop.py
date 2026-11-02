import json
from pathlib import Path

import cv2

from lore_engine import ocr
from _paths import SCRIPTS

image = cv2.imread(str(SCRIPTS / "genshin-crop.png"))
engine = ocr.OcrEngine()
engine.warmup()
parsed = ocr.read_dialogue(engine, image, min_score=0.45)
result = {
    "speaker": parsed["speaker"],
    "speakerTitle": parsed["speakerTitle"],
    "text": parsed["text"],
    "choices": parsed["choices"],
    "empty": parsed["empty"],
    "score": parsed["score"],
    "lineCount": len(parsed["lines"]),
}
(SCRIPTS / "reocr-crop.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(result, ensure_ascii=False, indent=2))
