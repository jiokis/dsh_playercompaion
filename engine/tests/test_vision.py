import base64

import cv2
import numpy as np

from lore_engine import protocol, vision


def synthetic():
    image = np.zeros((360, 640, 3), dtype=np.uint8)
    image[:] = (32, 38, 52)
    # Bright central subject with structure.
    cv2.rectangle(image, (220, 60), (420, 300), (90, 120, 210), -1)
    cv2.circle(image, (320, 150), 46, (230, 210, 140), -1)
    cv2.rectangle(image, (0, 300), (640, 360), (20, 24, 34), -1)
    cv2.putText(image, "Test Quest", (24, 336), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (240, 240, 240), 2)
    # Panel-like border.
    cv2.rectangle(image, (20, 20), (620, 280), (120, 140, 200), 2)
    return image


def test_composition_reports_subject_metrics_and_palette():
    analysis = vision.analyze(synthetic(), "composition", 12)
    assert analysis["mode"] == "composition"
    assert analysis["width"] == 640
    assert analysis["height"] == 360
    assert analysis["findings"]
    subject = next(item for item in analysis["findings"] if item.get("short") == "subject")
    assert 0 <= subject["box"]["x"] <= 1
    assert 0 < subject["box"]["w"] <= 1
    assert analysis["metrics"]["palette"]
    assert isinstance(analysis["metrics"]["thirds"], list)


def test_ui_and_map_are_heuristic_but_shaped():
    image = synthetic()
    for x in range(120, 560, 60):
        cv2.circle(image, (x, 120), 7, (90, 220, 160), -1)
    analysis = vision.analyze(image, "all", 12)
    assert set(analysis["sections"]) == {"composition", "ui", "map", "semantic"}
    assert "panelCount" in analysis["metrics"]
    assert "poiCandidates" in analysis["metrics"]
    assert 0 <= analysis["metrics"]["mapLikelihood"] <= 1
    assert analysis["elements"]
    annotated = vision.annotate(image, analysis)
    assert annotated.shape == image.shape


def test_semantic_uses_ocr_text_blocks_and_scene_classification():
    lines = [
        {"text": "地图 传送锚点", "left": 240, "top": 80, "right": 430, "bottom": 108, "score": 0.93},
        {"text": "旅行者：你好", "left": 30, "top": 306, "right": 260, "bottom": 334, "score": 0.91},
    ]
    analysis = vision.analyze(synthetic(), "semantic", 12, text_lines=lines)
    assert analysis["mode"] == "semantic"
    assert "semantic" in analysis["sections"]
    assert analysis["metrics"]["textBlocks"] == 2
    assert analysis["metrics"]["scene"] in ("map", "dialogue", "menu", "scene")
    assert any(item.get("kind") == "semantic" for item in analysis["findings"])


def test_invalid_mode_is_rejected():
    try:
        vision.analyze(synthetic(), "nope", 12)
    except ValueError as exc:
        assert "mode" in str(exc)
    else:
        raise AssertionError("invalid mode should fail")


def test_analyze_image_protocol_accepts_local_base64():
    image = synthetic()
    ok, buffer = cv2.imencode(".png", image)
    assert ok
    response = protocol.handle({
        "id": 7,
        "method": "analyze_image",
        "params": {
            "image_b64": base64.b64encode(buffer.tobytes()).decode("ascii"),
            "vision_mode": "composition",
            "max_findings": 6,
        },
    })
    assert response["ok"] is True
    result = response["result"]
    assert result["source"] == "image"
    assert result["analysis"]["mode"] == "composition"
    assert result["analysis"]["findings"]
