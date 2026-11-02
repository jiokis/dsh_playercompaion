import json
import os
from pathlib import Path

import cv2

from lore_engine import ocr, region
from _paths import SCRIPTS

DIRS = {
    "genshin": Path(os.environ.get("GENSHIN_SCREENSHOT_DIR", "D:/Games/Genshin Impact/Genshin Impact Game/ScreenShot")),
    "hsr": Path(os.environ.get("HSR_SCREENSHOT_DIR", "D:/Games/Star Rail/Game/StarRail_Data/ScreenShots")),
}
OUT = SCRIPTS / "screenshot-ocr.json"


def main():
    engine = ocr.OcrEngine()
    engine.warmup()
    results = []
    for game, directory in DIRS.items():
        files = sorted(directory.glob("*.png"), key=lambda p: p.stat().st_mtime, reverse=True)[:20]
        for path in files:
            frame = cv2.imread(str(path))
            if frame is None:
                continue
            height, width = frame.shape[:2]
            fallback = {"x": 0.05, "y": 0.52, "w": 0.9, "h": 0.46}
            rect, method, _ = region.detect_region(frame, fallback)
            left, top, right, bottom = rect
            crop = frame[top:bottom, left:right]
            parsed = ocr.read_dialogue(engine, crop, min_score=0.45)
            text = parsed["text"].strip()
            results.append({
                "game": game,
                "file": path.name,
                "size": [int(width), int(height)],
                "region": {"rect": [int(v) for v in rect], "method": method},
                "speaker": parsed["speaker"],
                "text": text[:600],
                "score": parsed["score"],
                "lineCount": len(parsed["lines"]),
                "lines": [{"text": line["text"], "score": line["score"]} for line in parsed["lines"][:12]],
            })
    OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print("WROTE", OUT, "images", len(results), "withText", sum(1 for item in results if item["text"]))


if __name__ == "__main__":
    main()
