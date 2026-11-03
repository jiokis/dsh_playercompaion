from pathlib import Path

import numpy as np
import pytest

from lore_engine import ocr


def _font():
    path = Path("C:/Windows/Fonts/msyh.ttc")
    if not path.exists():
        pytest.skip("Microsoft YaHei font is not available")
    return str(path)


def _synthetic_dialogue():
    pytest.importorskip("PIL")
    from PIL import Image, ImageDraw, ImageFont

    image = Image.new("RGB", (1600, 600), (18, 18, 24))
    draw = ImageDraw.Draw(image)
    name_font = ImageFont.truetype(_font(), 34)
    body_font = ImageFont.truetype(_font(), 48)
    draw.text((120, 200), "派蒙", font=name_font, fill=(255, 226, 150))
    draw.text((120, 290), "旅行者，我们走吧！", font=body_font, fill=(255, 255, 255))
    return np.array(image)[:, :, ::-1].copy()


def test_ocr_reads_chinese_and_splits_speaker():
    pytest.importorskip("rapidocr_onnxruntime")
    engine = ocr.OcrEngine()
    engine.warmup()
    parsed = ocr.read_dialogue(engine, _synthetic_dialogue())
    assert parsed["speaker"] == "派蒙"
    assert "旅行者" in parsed["text"]
    assert parsed["score"] > 0.8


def test_merge_lines_keeps_separate_speaker_row():
    lines = [
        {"text": "派蒙", "score": 0.99, "left": 120, "top": 200, "right": 190, "bottom": 234, "height": 34},
        {"text": "旅行者，我们走吧！", "score": 0.99, "left": 120, "top": 301, "right": 600, "bottom": 347, "height": 46},
    ]
    utterances = ocr.merge_lines(lines)
    assert len(utterances) == 2
    speaker, body = ocr.split_speaker(utterances)
    assert speaker == "派蒙"
    assert body[0]["text"] == "旅行者，我们走吧！"


def test_dialogue_like_rejects_ui_noise():
    utterances = [{"text": "召回"}, {"text": "UID:125578810"}]
    assert ocr.dialogue_like(utterances, (121, 987, 2487, 1440), 2560, 1440) is False


def test_dialogue_like_accepts_speaker_and_body():
    utterances = [{"text": "派蒙"}, {"text": "旅行者，我们走吧！"}]
    assert ocr.dialogue_like(utterances, (200, 1000, 2300, 1300), 2560, 1440) is True


def test_dialogue_like_rejects_character_screen_stats():
    utterances = [{"text": "Lv.90"}, {"text": "22988/22988"}, {"text": "73%"}]
    assert ocr.dialogue_like(utterances, (52, 924, 2508, 1440), 2560, 1440) is False


def test_dialogue_like_rejects_name_only_frame():
    utterances = [{"text": "奥黛塔"}]
    assert ocr.dialogue_like(utterances, (69, 976, 2491, 1440), 2560, 1440) is False


def test_extract_dialogue_splits_speaker_title_body_and_choices():
    lines = [
        {"text": "关于至冬", "score": 0.985, "left": 1702, "top": 0, "right": 1892, "bottom": 41, "height": 41},
        {"text": "再见。", "score": 0.9986, "left": 1702, "top": 92, "right": 1801, "bottom": 140, "height": 47},
        {"text": "凯瑟琳", "score": 0.997, "left": 1150, "top": 184, "right": 1287, "bottom": 233, "height": 49},
        {"text": "冒险家协会接待员", "score": 0.9931, "left": 1102, "top": 241, "right": 1337, "bottom": 274, "height": 32},
        {"text": "向着星辰与深渊！", "score": 0.9861, "left": 1057, "top": 286, "right": 1366, "bottom": 328, "height": 41},
        {"text": "欢迎来到冒险家协会总部。", "score": 0.9842, "left": 977, "top": 338, "right": 1439, "bottom": 376, "height": 37},
        {"text": "UID:125578810", "score": 0.9801, "left": 2187, "top": 445, "right": 2421, "bottom": 482, "height": 36},
    ]
    result = ocr.extract_dialogue(lines, 2436)
    assert result["speaker"] == "凯瑟琳"
    assert result["speakerTitle"] == "冒险家协会接待员"
    assert result["text"] == "向着星辰与深渊！\n欢迎来到冒险家协会总部。"
    assert result["choices"] == ["关于至冬", "再见。"]


def test_extract_dialogue_treats_small_top_line_as_title():
    lines = [
        {"text": "冒险家协会接待员", "score": 0.99, "left": 900, "top": 0, "right": 1400, "bottom": 32, "height": 32},
        {"text": "这里是冒险家协会总部。", "score": 0.99, "left": 500, "top": 40, "right": 1800, "bottom": 81, "height": 41},
        {"text": "可以来总部进行咨询。", "score": 0.99, "left": 600, "top": 90, "right": 1700, "bottom": 127, "height": 37},
    ]
    result = ocr.extract_dialogue(lines, 2284)
    assert result["speaker"] is None
    assert result["speakerTitle"] == "冒险家协会接待员"
    assert result["text"] == "这里是冒险家协会总部。\n可以来总部进行咨询。"


def test_extract_dialogue_drops_low_confidence_noise():
    lines = [
        {"text": "派家", "score": 0.5882, "left": 1101, "top": 0, "right": 1190, "bottom": 24, "height": 24},
        {"text": "零食不算啦，嘿嘿嘿。", "score": 0.9888, "left": 450, "top": 49, "right": 1823, "bottom": 93, "height": 44},
        {"text": "D:125578", "score": 0.9561, "left": 2156, "top": 242, "right": 2290, "bottom": 264, "height": 22},
    ]
    result = ocr.extract_dialogue(lines, 2560)
    assert result["speaker"] is None
    assert result["text"] == "零食不算啦，嘿嘿嘿。"
    assert result["choices"] == []


def test_extract_dialogue_does_not_treat_wrapped_body_as_speaker():
    lines = [
        {"text": "以家", "score": 0.5968, "left": 1588, "top": 0, "right": 1769, "bottom": 39, "height": 39},
        {"text": "快走快走", "score": 0.9888, "left": 206, "top": 99, "right": 527, "bottom": 179, "height": 80},
        {"text": "我想吃冰淇淋了！要大份的那种。", "score": 0.9908, "left": 593, "top": 103, "right": 2332, "bottom": 176, "height": 73},
    ]
    result = ocr.extract_dialogue(lines, 2560)
    assert result["speaker"] is None
    assert "快走快走" in result["text"]
    assert "我想吃冰淇淋" in result["text"]
