"""RapidOCR wrapper plus line/utterance merging and a tiny dHash."""

from __future__ import annotations

import re
import time

import numpy as np

UI_LINE = re.compile(
    r"^(?:UID[:：]?\s*\d{4,}|召回|取消|确认|返回|跳过|退出|设置|领取|追踪|打开地图|关闭|继续|开始|结束)$",
    re.IGNORECASE,
)
UID_RE = re.compile(r"^UID[:：]?\s*\d{4,}$", re.IGNORECASE)
UID_LIKE_RE = re.compile(r"^[A-Z][:：]?\s*\d{5,}$", re.IGNORECASE)
UI_STAT = re.compile(r"^(?:Lv\.?\s*\d+|\d+\s*/\s*\d+|\d{1,3}%|Enter|E|Esc|F|Q|Tab|Shift|Ctrl|Alt|Space|鼠标左键|鼠标右键)$", re.IGNORECASE)
UI_HINT = re.compile(r"鼠标|键盘|WASD|IJKL|空格|左键|右键|单击|双击|拖动|按住|松开", re.IGNORECASE)
SENTENCE_ENDS = ("。", "！", "？", ".", "!", "?", "…")
LOW_CONF_SHORT_SCORE = 0.7


class OcrError(RuntimeError):
    def __init__(self, message: str, code: str = "OCR_FAILED"):
        super().__init__(message)
        self.code = code


def _join_text(left: str, right: str) -> str:
    if not left:
        return right
    if not right:
        return left
    if left[-1].isascii() and left[-1].isalnum() and right[0].isascii() and right[0].isalnum():
        return left + " " + right
    return left + right


def dhash(image: np.ndarray, size: int = 8) -> str:
    try:
        import cv2
    except Exception:
        return ""
    if image is None or image.size == 0:
        return ""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    resized = cv2.resize(gray, (size + 1, size), interpolation=cv2.INTER_AREA)
    bits = []
    for y in range(size):
        for x in range(size):
            bits.append("1" if int(resized[y, x]) > int(resized[y, x + 1]) else "0")
    value = 0
    for bit in bits:
        value = (value << 1) | (1 if bit == "1" else 0)
    return format(value, "0" + str(size * size) + "x")


class OcrEngine:
    def __init__(self, min_score: float = 0.5, max_side: int = 960, upscale_height: int = 220):
        self.min_score = float(min_score)
        self.max_side = int(max_side)
        self.upscale_height = int(upscale_height)
        self.engine = None
        self.warmup_ms = None

    def _ensure(self):
        if self.engine is not None:
            return
        try:
            from rapidocr_onnxruntime import RapidOCR
        except Exception as error:
            raise OcrError("RapidOCR is not installed: " + str(error), "OCR_UNAVAILABLE")
        kwargs = {
            "det_limit_type": "max",
            "det_limit_side_len": self.max_side,
            "use_angle_cls": False,
        }
        try:
            engine = RapidOCR(**kwargs, intra_op_num_threads=1, inter_op_num_threads=1)
        except TypeError:
            engine = RapidOCR(**kwargs)
        self.engine = engine

    def warmup(self) -> float:
        started = time.perf_counter()
        self._ensure()
        try:
            self.engine(np.zeros((32, 128, 3), dtype=np.uint8))
        except Exception as error:
            raise OcrError("RapidOCR warmup failed: " + str(error), "OCR_WARMUP_FAILED")
        self.warmup_ms = round((time.perf_counter() - started) * 1000.0, 1)
        return self.warmup_ms

    def read(self, image: np.ndarray, min_score: float | None = None) -> list[dict]:
        self._ensure()
        if image is None or image.size == 0:
            return []
        threshold = float(self.min_score if min_score is None else min_score)
        prepared = image
        try:
            import cv2
        except Exception:
            cv2 = None
        if cv2 is not None and image.shape[0] < self.upscale_height:
            scale = 2.0
            prepared = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        try:
            output = self.engine(prepared)
        except Exception as error:
            raise OcrError("RapidOCR failed: " + str(error), "OCR_FAILED")
        if isinstance(output, tuple):
            result = output[0]
        else:
            result = output
        if not result:
            return []
        lines = []
        for item in result:
            if not item or len(item) < 3:
                continue
            box, text, score = item[0], item[1], item[2]
            try:
                value = float(score)
            except (TypeError, ValueError):
                value = 0.0
            text = str(text).strip()
            if not text or value < threshold:
                continue
            try:
                xs = [float(point[0]) for point in box]
                ys = [float(point[1]) for point in box]
            except Exception:
                continue
            lines.append({
                "text": text,
                "score": round(value, 4),
                "left": int(min(xs)),
                "top": int(min(ys)),
                "right": int(max(xs)),
                "bottom": int(max(ys)),
                "height": int(max(ys) - min(ys)),
            })
        lines.sort(key=lambda line: (line["top"], line["left"]))
        return lines


def _overlap_ratio(a_top, a_bottom, b_top, b_bottom) -> float:
    overlap = min(a_bottom, b_bottom) - max(a_top, b_top)
    shortest = max(1, min(a_bottom - a_top, b_bottom - b_top))
    return overlap / shortest


def merge_lines(lines: list[dict]) -> list[dict]:
    if not lines:
        return []
    rows = []
    for line in sorted(lines, key=lambda item: (item["top"], item["left"])):
        placed = False
        for row in rows:
            if _overlap_ratio(line["top"], line["bottom"], row["top"], row["bottom"]) >= 0.5:
                row["text"] = _join_text(row["text"], line["text"])
                row["left"] = min(row["left"], line["left"])
                row["top"] = min(row["top"], line["top"])
                row["right"] = max(row["right"], line["right"])
                row["bottom"] = max(row["bottom"], line["bottom"])
                row["scores"].append(line["score"])
                placed = True
                break
        if not placed:
            rows.append({
                "text": line["text"],
                "left": line["left"],
                "top": line["top"],
                "right": line["right"],
                "bottom": line["bottom"],
                "scores": [line["score"]],
            })
    for row in rows:
        row["height"] = row["bottom"] - row["top"]
        row["score"] = round(sum(row["scores"]) / max(1, len(row["scores"])), 4)
    rows.sort(key=lambda item: item["top"])
    utterances = []
    for row in rows:
        if utterances:
            previous = utterances[-1]
            gap = row["top"] - previous["bottom"]
            taller = max(previous["height"], row["height"])
            shorter = max(1, min(previous["height"], row["height"]))
            height_ratio = taller / shorter
            short_first = len(previous["text"].strip()) <= 12
            split_for_speaker = gap > max(2.0, 0.6 * taller) and (
                height_ratio > 1.25 or (short_first and gap > 0.9 * taller)
            )
            if not split_for_speaker and gap <= max(2.0, 1.2 * taller):
                previous["text"] = previous["text"] + "\n" + row["text"]
                previous["bottom"] = row["bottom"]
                previous["right"] = max(previous["right"], row["right"])
                previous["height"] = previous["bottom"] - previous["top"]
                previous["scores"].extend(row["scores"])
                previous["score"] = round(sum(previous["scores"]) / max(1, len(previous["scores"])), 4)
                continue
        utterances.append({
            "text": row["text"],
            "left": row["left"],
            "top": row["top"],
            "right": row["right"],
            "bottom": row["bottom"],
            "height": row["height"],
            "score": row["score"],
            "scores": list(row["scores"]),
        })
    return utterances


def split_speaker(utterances: list[dict]):
    if len(utterances) < 2:
        return None, utterances
    first = utterances[0]
    second = utterances[1]
    gap = second["top"] - first["bottom"]
    first_text = first["text"].strip()
    if len(first_text) > 14:
        return None, utterances
    if first_text.endswith(("。", "！", "？", ".", "!", "?", "…")):
        return None, utterances
    if gap >= max(4.0, 0.8 * max(first["height"], second["height"])):
        return first_text, utterances[1:]
    if first["height"] <= second["height"] * 0.9 and gap >= max(3.0, 0.4 * max(first["height"], second["height"])):
        return first_text, utterances[1:]
    return None, utterances


def dialogue_like(utterances: list[dict], region, frame_width: int, frame_height: int) -> bool:
    if not utterances:
        return False
    left, top, right, bottom = region
    if frame_height > 0 and top < frame_height * 0.45:
        return False
    pieces = []
    for item in utterances:
        pieces.extend(part.strip() for part in str(item.get("text") or "").split("\n"))
    if len(pieces) > 8:
        return False
    cleaned = [piece for piece in pieces if piece and not UI_LINE.match(piece) and not UI_STAT.match(piece) and not UI_HINT.search(piece)]
    text = "\n".join(cleaned).strip()
    if len(text) < 4 or len(text) > 300:
        return False
    if not any(piece.endswith(SENTENCE_ENDS) or len(piece) >= 6 for piece in cleaned):
        return False
    if all(piece.isascii() for piece in cleaned) and max((len(piece) for piece in cleaned), default=0) <= 20:
        return False
    if frame_width > 0 and (right - left) < frame_width * 0.18:
        return False
    if frame_width > 0 and (right - left) > frame_width * 0.98:
        return False
    if frame_height > 0 and (bottom - top) > frame_height * 0.38:
        return False
    return True


def extract_dialogue(lines: list[dict], image_width: int) -> dict:
    """Split raw OCR lines into speaker / title / body / right-side choices."""
    filtered = []
    for line in lines:
        text = str(line.get("text") or "").strip()
        score = float(line.get("score") or 0)
        if not text or UID_RE.match(text) or UID_LIKE_RE.match(text) or UI_HINT.search(text):
            continue
        # Short, low-confidence OCR is mostly UI noise such as "网网网" or
        # a misread UID; keep high-confidence short names and real lines.
        if len(text) <= 6 and score < LOW_CONF_SHORT_SCORE:
            continue
        filtered.append(line)
    right_edge = image_width * 0.68
    choice_lines = [line for line in filtered if int(line.get("left") or 0) >= right_edge]
    main = [line for line in filtered if int(line.get("left") or 0) < right_edge]
    main.sort(key=lambda line: (int(line.get("top") or 0), int(line.get("left") or 0)))
    speaker = None
    title = None
    body = []
    index = 0
    if len(main) >= 2:
        first = main[0]
        second = main[1]
        first_text = str(first["text"]).strip()
        first_height = max(1, int(first.get("height") or 1))
        body_reference = max((int(item.get("height") or 0) for item in main[1:3]), default=first_height)
        # A speaker/title must sit above the next line. If the next OCR box is
        # vertically on the same band, the first box is a wrapped body fragment,
        # not a speaker ("快走快走" was the real failure).
        first_bottom = int(first.get("bottom") or 0)
        second_top = int(second.get("top") or 0)
        if first_bottom <= second_top + 4 and len(first_text) <= 14 and not first_text.endswith(SENTENCE_ENDS):
            if first_height >= body_reference * 0.9:
                second_text = str(second["text"]).strip()
                second_height = int(second.get("height") or 1)
                if len(second_text) <= 20 and second_height <= first_height * 0.78 and not second_text.endswith(SENTENCE_ENDS):
                    speaker = first_text
                    title = second_text
                    index = 2
                else:
                    speaker = first_text
                    index = 1
            else:
                title = first_text
                index = 1
    body = main[index:]
    text = "\n".join(str(line["text"]).strip() for line in body if str(line["text"]).strip())
    choices = []
    for line in choice_lines:
        value = str(line["text"]).strip()
        if value and not UI_STAT.match(value) and not UID_RE.match(value) and not UID_LIKE_RE.match(value) and value not in choices:
            choices.append(value)
    return {
        "speaker": speaker,
        "speakerTitle": title,
        "body": body,
        "text": text,
        "choices": choices,
        "main": main,
        "choiceLines": choice_lines,
    }


def read_dialogue(engine: OcrEngine, image: np.ndarray, min_score: float | None = None) -> dict:
    lines = engine.read(image, min_score=min_score)
    extracted = extract_dialogue(lines, int(image.shape[1]) if image.ndim >= 2 else 0)
    body = extracted["body"]
    utterances = merge_lines(body) if body else []
    text = extracted["text"]
    return {
        "lines": lines,
        "utterances": utterances,
        "allUtterances": merge_lines(lines) if lines else [],
        "body": body,
        "speaker": extracted["speaker"],
        "speakerTitle": extracted["speakerTitle"],
        "choices": extracted["choices"],
        "text": text,
        "empty": not bool(text),
        "score": round(sum(float(item.get("score") or 0) for item in body) / max(1, len(body)), 4) if body else 0.0,
    }
