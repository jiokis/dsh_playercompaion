from pathlib import Path

import numpy as np
import pytest

from lore_engine.region import clamp_rect, detect_region, rect_from_norm


def _synthetic_text_frame():
    PIL = pytest.importorskip("PIL")
    from PIL import Image, ImageDraw, ImageFont

    image = Image.new("RGB", (1600, 600), (20, 20, 25))
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 48)
    draw.text((100, 250), "派蒙：旅行者，我们走吧！", font=font, fill=(255, 255, 255))
    return np.array(image)[:, :, ::-1].copy()


def test_rect_from_norm_and_clamp():
    assert rect_from_norm({"x": 0.1, "y": 0.2, "w": 0.5, "h": 0.4}, 1000, 500) == (100, 100, 600, 300)
    assert clamp_rect((10, 10, 2000, 2000), 1000, 500) == (10, 10, 1000, 500)


def test_detect_region_finds_lower_center_text():
    frame = _synthetic_text_frame()
    rect, method, _score = detect_region(frame, {"x": 0.05, "y": 0.25, "w": 0.9, "h": 0.65})
    assert method == "cluster"
    left, top, right, bottom = rect
    assert left <= 100 < right
    assert top <= 250 < bottom
    assert right - left > 100
    assert bottom - top > 30


def test_detect_region_falls_back_on_blank_frame():
    frame = np.zeros((600, 1600, 3), dtype=np.uint8)
    rect, method, _score = detect_region(frame, {"x": 0.05, "y": 0.25, "w": 0.9, "h": 0.65})
    assert method == "fallback"
    assert rect == (80, 150, 1520, 540)
