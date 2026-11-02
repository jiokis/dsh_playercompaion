import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from lore_engine import capture, ocr, region, windows
from _paths import SCRIPTS


def synthetic():
    image = Image.new("RGB", (1600, 600), (20, 20, 25))
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 48)
    draw.text((100, 250), "派蒙：旅行者，我们走吧！", font=font, fill=(255, 255, 255))
    frame = np.array(image)[:, :, ::-1].copy()
    engine = ocr.OcrEngine()
    engine.warmup()
    parsed = ocr.read_dialogue(engine, frame, min_score=0.5)
    rect, method, _ = region.detect_region(frame, {"x": 0.05, "y": 0.25, "w": 0.9, "h": 0.65})
    return {
        "text": parsed["text"],
        "speaker": parsed["speaker"],
        "score": parsed["score"],
        "lines": [{"text": line["text"], "score": line["score"]} for line in parsed["lines"]],
        "region": {"rect": rect, "method": method},
    }


def capture_window():
    windows.set_dpi_awareness()
    all_windows = windows.list_windows()
    target = None
    for window in all_windows:
        if window.get("process") == "SystemSettings.exe" or window.get("title") == "设置":
            target = window
            break
    if target is None:
        return {"error": "no target", "windows": [{"title": w.get("title"), "process": w.get("process")} for w in all_windows]}
    occlusion = windows.window_occlusion(target["hwnd"])
    monitor = windows.monitor_for_window(target["hwnd"])
    outputs = capture.list_outputs()
    output_index = capture.match_output(monitor, outputs, None)
    pool = capture.CapturePool()
    frame, backend = pool.grab(monitor, output_index, "auto")
    crop, rect = capture.crop_window(frame, target, monitor)
    engine = ocr.OcrEngine()
    engine.warmup()
    lines = engine.read(crop, min_score=0.5)
    return {
        "target": {"title": target.get("title"), "process": target.get("process"), "hwnd": target.get("hwnd")},
        "backend": backend,
        "crop": [int(crop.shape[1]), int(crop.shape[0])],
        "occlusion": occlusion,
        "lineCount": len(lines),
        "lines": [{"text": line["text"], "score": line["score"]} for line in lines[:30]],
    }


payload = {"synthetic": synthetic(), "capture": capture_window()}
path = SCRIPTS / "ocr-smoke.json"
path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print("WROTE", path, "syntheticLines", len(payload["synthetic"]["lines"]), "captureLines", payload["capture"].get("lineCount"))
