import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from lore_engine import games, ocr, protocol
from _paths import SCRIPTS


def dialogue_ocr():
    image = Image.new("RGB", (1600, 600), (18, 18, 24))
    draw = ImageDraw.Draw(image)
    name_font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 34)
    body_font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 48)
    draw.text((120, 200), "派蒙", font=name_font, fill=(255, 226, 150))
    draw.text((120, 290), "旅行者，我们走吧！", font=body_font, fill=(255, 255, 255))
    frame = np.array(image)[:, :, ::-1].copy()
    engine = ocr.OcrEngine()
    engine.warmup()
    parsed = ocr.read_dialogue(engine, frame, min_score=0.5)
    return {
        "text": parsed["text"],
        "speaker": parsed["speaker"],
        "lines": [{"text": line["text"], "score": line["score"]} for line in parsed["lines"]],
        "utterances": [{"text": item["text"], "top": item["top"], "bottom": item["bottom"]} for item in parsed["utterances"]],
    }


def capture_debug():
    games.GAMES["debugsettings"] = {
        "id": "debugsettings",
        "label": "设置（调试）",
        "processes": ["systemsettings.exe"],
        "title_keywords": ["设置"],
        "region": {"x": 0.05, "y": 0.2, "w": 0.9, "h": 0.6},
    }
    result = protocol.capture({
        "game": "debugsettings",
        "mode": "read",
        "include_image": False,
        "settle_ms": 200,
        "max_settle_ms": 600,
    })
    if "error" in result:
        return result
    return {
        "ok": result.get("ok"),
        "game": result.get("game"),
        "window": result.get("window"),
        "backend": result.get("backend"),
        "region": result.get("region"),
        "settled": result.get("settled"),
        "waitedMs": result.get("waitedMs"),
        "empty": result.get("empty"),
        "dialogueLike": result.get("dialogueLike"),
        "score": result.get("score"),
        "lineCount": len(result.get("lines") or []),
        "textPreview": (result.get("text") or "")[:500],
        "timings": result.get("timings"),
        "warnings": result.get("warnings"),
    }


payload = {"dialogue": dialogue_ocr(), "capture": capture_debug()}
(SCRIPTS / "capture-smoke.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print("WROTE", "speaker", payload["dialogue"]["speaker"], "captureOk", payload["capture"].get("ok"), "lines", payload["capture"].get("lineCount"))
