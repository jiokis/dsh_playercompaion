"""JSON-lines request dispatch for the local lore engine."""

from __future__ import annotations

import base64
import json
import os
import platform
import sys
import time
import traceback

import cv2
import numpy as np

from . import capture as capture_mod
from . import games as games_mod
from . import ocr as ocr_mod
from . import region as region_mod
from . import vision as vision_mod
from . import windows as windows_mod

VERSION = "0.1.0"
_POOL = capture_mod.CapturePool()
_OCR = ocr_mod.OcrEngine()


def log(message: str) -> None:
    try:
        sys.stderr.write("[lore-engine] " + str(message) + "\n")
        sys.stderr.flush()
    except Exception:
        pass


def error(code: str, message: str, detail=None) -> dict:
    payload = {"code": code, "message": message}
    if detail is not None:
        payload["detail"] = detail
    return {"ok": False, "error": payload}


def _version(package: str):
    try:
        from importlib.metadata import version

        return version(package)
    except Exception:
        try:
            module = __import__(package)
            return getattr(module, "__version__", None)
        except Exception:
            return None


def selftest(params: dict | None = None) -> dict:
    windows_mod.set_dpi_awareness()
    params = params or {}
    deps = {name: _version(name) for name in ("numpy", "opencv-python", "onnxruntime", "rapidocr-onnxruntime", "dxcam", "mss")}
    monitors = windows_mod.list_monitors()
    outputs = capture_mod.list_outputs()
    windows = windows_mod.list_windows()
    foreground = windows_mod.foreground_window()
    detected = {game_id: games_mod.match_window(windows, game_id) for game_id in games_mod.game_ids()}
    ocr_state = {"ready": False, "warmupMs": None, "error": None}
    if params.get("warmup", True):
        try:
            ocr_state["warmupMs"] = _OCR.warmup()
            ocr_state["ready"] = True
        except Exception as exc:
            ocr_state["error"] = str(exc)
    return {
        "version": VERSION,
        "python": sys.version.split()[0],
        "platform": platform.platform(),
        "pid": os.getpid(),
        "deps": deps,
        "monitors": monitors,
        "outputs": outputs,
        "windows": windows_mod.list_windows(limit=30),
        "foreground": foreground,
        "games": detected,
        "ocr": ocr_state,
    }


def windows_list(params: dict | None = None) -> dict:
    windows_mod.set_dpi_awareness()
    params = params or {}
    return {"windows": windows_mod.list_windows(limit=int(params.get("limit", 40)))}


def _check_window(params: dict):
    game_request = str(params.get("game") or "auto").strip().lower()
    hint = params.get("window") or None
    all_windows = windows_mod.list_windows()
    match = games_mod.detect_game(all_windows, game_request, hint)
    if not match.get("window"):
        return None, error(
            "WINDOW_NOT_FOUND",
            "no matching game window found",
            {"requestedGame": game_request, "windows": games_mod.windows_summary(all_windows)},
        )
    game_id = match.get("game")
    target = match["window"]
    if target.get("minimized"):
        return None, error(
            "MINIMIZED",
            "the game window is minimized; restore it before capturing",
            {"window": games_mod.windows_summary([target], 1)[0]},
        )
    return (game_id, target, all_windows), None


def capture(params: dict | None = None) -> dict:
    windows_mod.set_dpi_awareness()
    params = params or {}
    mode = str(params.get("mode") or "dialogue").strip().lower()
    if mode not in ("dialogue", "read"):
        return error("INVALID_PARAMS", "mode must be dialogue or read")
    force = bool(params.get("force", False))
    require_foreground = bool(params.get("require_foreground", False)) and not force
    include_image = bool(params.get("include_image", False))
    include_window_image = bool(params.get("include_window_image", False))
    include_text = bool(params.get("include_text", False))
    settle_ms = max(0, int(params.get("settle_ms", 350)))
    max_settle_ms = max(settle_ms, int(params.get("max_settle_ms", 1200)))
    min_score = float(params.get("min_score", 0.5))
    ocr_max_side = int(params.get("ocr_max_side", 960))
    occlusion_threshold = float(params.get("occlusion_threshold", 0.2))
    backend = str(params.get("backend") or "auto").strip().lower()
    if backend not in ("auto", "dxcam", "mss"):
        backend = "auto"

    checked, failure = _check_window(params)
    if failure is not None:
        return failure
    game_id, target, all_windows = checked
    if not game_id:
        return error("GAME_NOT_DETECTED", "could not identify the game for this window", {"window": target})

    foreground = windows_mod.foreground_window()
    is_foreground = bool(foreground and int(foreground.get("hwnd", 0)) == int(target.get("hwnd", 0)))
    if require_foreground and not is_foreground:
        return error(
            "NOT_FOREGROUND",
            "the game window is not in the foreground; bring it to the front and keep it visible",
            {"foreground": foreground, "window": games_mod.windows_summary([target], 1)[0]},
        )
    occlusion = windows_mod.window_occlusion(int(target["hwnd"]))
    occluded_ratio = float(occlusion.get("occluded_ratio") or 0.0)
    if occlusion.get("available") and occluded_ratio > occlusion_threshold and not force:
        return error(
            "OCCLUDED",
            "the game window is covered by other windows",
            {"occluded": occlusion, "threshold": occlusion_threshold, "forceHint": "pass force=true only if you accept the occluder pixels"},
        )

    monitor = windows_mod.monitor_for_window(int(target["hwnd"]))
    if monitor is None:
        monitors = windows_mod.list_monitors()
        monitor = monitors[0] if monitors else None
    if monitor is None:
        return error("NO_MONITOR", "no display could be resolved for the game window")

    outputs = capture_mod.list_outputs()
    output_index = capture_mod.match_output(monitor, outputs, params.get("output_index"))
    started = time.perf_counter()
    first_frame, backend_used = _POOL.grab(monitor, output_index, backend)
    window_crop, actual = capture_mod.crop_window(first_frame, target, monitor)
    if require_foreground:
        after = windows_mod.foreground_window()
        if not after or int(after.get("hwnd", 0)) != int(target["hwnd"]):
            return error(
                "NOT_FOREGROUND",
                "the game window lost the foreground during capture",
                {"foreground": after, "window": games_mod.windows_summary([target], 1)[0]},
            )
    black = capture_mod.black_frame_stats(window_crop)
    if black.get("black"):
        return error(
            "CAPTURE_BLACK",
            "captured frame is black; use borderless windowed mode (not exclusive fullscreen), disable HDR/overlays, and keep the game restored",
            {"backend": backend_used, "stats": black, "window": games_mod.windows_summary([target], 1)[0]},
        )

    override = params.get("region")
    fallback = override or games_mod.default_region(game_id)
    if not isinstance(fallback, dict):
        return error("INVALID_PARAMS", "region must be an object with x/y/w/h normalized to 0..1")
    try:
        height, width = window_crop.shape[:2]
        if override:
            region_rel = region_mod.rect_from_norm(fallback, width, height)
            method = "override"
        elif mode == "read":
            region_rel = (0, 0, width, height)
            method = "window"
        else:
            region_rel, method, _score = region_mod.detect_region(window_crop, fallback)
    except Exception as exc:
        log("region detection failed: " + str(exc))
        region_rel, method = region_mod.rect_from_norm(fallback, window_crop.shape[1], window_crop.shape[0]), "fallback"

    def crop_region(frame):
        left, top, right, bottom = region_rel
        return frame[top:bottom, left:right].copy()

    region_crop = crop_region(window_crop)
    hash_value = ocr_mod.dhash(region_crop)
    settled = settle_ms <= 0
    waited_ms = 0
    frames = 1
    deadline = time.perf_counter() + max_settle_ms / 1000.0
    while settle_ms > 0 and time.perf_counter() < deadline:
        time.sleep(settle_ms / 1000.0)
        waited_ms += settle_ms
        try:
            next_frame, backend_used = _POOL.grab(monitor, output_index, backend)
            next_crop, _actual = capture_mod.crop_window(next_frame, target, monitor)
            next_region_crop = crop_region(next_crop)
            next_hash = ocr_mod.dhash(next_region_crop)
            frames += 1
            if next_hash == hash_value:
                settled = True
                region_crop = next_region_crop
                break
            hash_value = next_hash
            region_crop = next_region_crop
        except Exception as exc:
            log("settle capture failed: " + str(exc))
            break

    analyze_mode = str(params.get("analyze") or "").strip().lower()
    if analyze_mode:
        if analyze_mode not in ("composition", "ui", "map", "all"):
            return error("INVALID_PARAMS", "analyze must be composition, ui, map or all")
        try:
            height, width = window_crop.shape[:2]
            analysis_crop = window_crop
            analysis_region = (0, 0, width, height)
            override_region = params.get("region")
            if override_region:
                analysis_region = region_mod.rect_from_norm(override_region, width, height)
                left, top, right, bottom = analysis_region
                analysis_crop = window_crop[top:bottom, left:right].copy()
            max_findings = max(1, min(30, int(params.get("max_findings", 12))))
            analysis_text = []
            if include_text:
                try:
                    text_engine = _OCR
                    if getattr(text_engine, "max_side", None) != ocr_max_side:
                        text_engine = ocr_mod.OcrEngine(min_score=min_score, max_side=ocr_max_side)
                    analysis_text = text_engine.read(analysis_crop, min_score=min_score)
                except Exception as exc:
                    # Text is optional: keep geometry-only analysis instead of failing vision.
                    analysis_text = []
                    log("vision OCR failed: " + str(exc))
            analysis = vision_mod.analyze(analysis_crop, analyze_mode, max_findings, text_lines=analysis_text)
            annotated = vision_mod.annotate(analysis_crop, analysis) if include_image else None
            left, top, right, bottom = analysis_region
            region_info = {
                "x": round(left / max(1, width), 4),
                "y": round(top / max(1, height), 4),
                "w": round((right - left) / max(1, width), 4),
                "h": round((bottom - top) / max(1, height), 4),
                "left": left,
                "top": top,
                "width": right - left,
                "height": bottom - top,
                "method": "region" if params.get("region") else "window",
            }
            vision_result = {
                "ok": True,
                "game": game_id,
                "gameLabel": games_mod.get_game(game_id)["label"],
                "mode": "vision",
                "visionMode": analyze_mode,
                "source": "screen",
                "window": {
                    "hwnd": int(target["hwnd"]),
                    "title": target.get("title") or "",
                    "process": target.get("process") or "",
                    "width": target.get("width"),
                    "height": target.get("height"),
                    "left": target.get("left"),
                    "top": target.get("top"),
                },
                "foreground": foreground,
                "isForeground": is_foreground,
                "occluded": occlusion,
                "monitor": monitor,
                "outputIndex": output_index,
                "backend": backend_used,
                "region": region_info,
                "settled": settled,
                "waitedMs": waited_ms,
                "frames": frames,
                "analysis": analysis,
                "timings": {
                    "totalMs": round((time.perf_counter() - started) * 1000.0, 1),
                    "settleMs": waited_ms,
                },
                "warnings": [] if is_foreground else ["the game window is not in the foreground; analysis may reflect a paused frame"],
                "image": None,
                "windowImage": None,
            }
            if annotated is not None:
                try:
                    vision_result["image"] = capture_mod.encode_png_b64(annotated)
                except Exception as exc:
                    vision_result["warnings"].append("annotated image encoding failed: " + str(exc))
            if include_window_image:
                try:
                    vision_result["windowImage"] = capture_mod.encode_png_b64(window_crop)
                except Exception as exc:
                    vision_result["warnings"].append("window image encoding failed: " + str(exc))
            return vision_result
        except Exception as exc:
            return error("VISION_FAILED", str(exc), {"backend": backend_used})

    ocr_engine = _OCR
    if getattr(ocr_engine, "max_side", None) != ocr_max_side:
        ocr_engine = ocr_mod.OcrEngine(min_score=min_score, max_side=ocr_max_side)
    try:
        if mode == "dialogue":
            parsed = ocr_mod.read_dialogue(ocr_engine, region_crop, min_score=min_score)
            # A low-confidence short line is often caused by a small glyph
            # (ellipsis, punctuation, a one-character reply). One upscaled
            # retry is cheaper than a second full-frame capture and usually
            # recovers the character shape.
            if parsed.get("text") and float(parsed.get("score") or 0) < 0.62:
                try:
                    enlarged = cv2.resize(region_crop, None, fx=1.5, fy=1.5, interpolation=cv2.INTER_CUBIC)
                    retry = ocr_mod.read_dialogue(ocr_engine, enlarged, min_score=min_score)
                    if retry.get("text") and (
                        float(retry.get("score") or 0) > float(parsed.get("score") or 0) + 0.02
                        or len(retry.get("text") or "") > len(parsed.get("text") or "") + 2
                    ):
                        parsed = retry
                        frames += 1
                except Exception as exc:
                    log("upscaled OCR retry failed: " + str(exc))
        else:
            lines = ocr_engine.read(region_crop, min_score=min_score)
            utterances = ocr_mod.merge_lines(lines)
            text = "\n".join(item["text"] for item in utterances).strip()
            parsed = {
                "lines": lines,
                "utterances": utterances,
                "allUtterances": utterances,
                "body": utterances,
                "speaker": None,
                "speakerTitle": None,
                "choices": [],
                "text": text,
                "empty": not bool(text),
                "score": round(sum(item["score"] for item in utterances) / max(1, len(utterances)), 4) if utterances else 0.0,
            }
    except Exception as exc:
        return error("OCR_FAILED", str(exc), {"backend": backend_used})

    frame_height, frame_width = window_crop.shape[:2]
    left, top, right, bottom = region_rel
    region_info = {
        "x": round(left / max(1, frame_width), 4),
        "y": round(top / max(1, frame_height), 4),
        "w": round((right - left) / max(1, frame_width), 4),
        "h": round((bottom - top) / max(1, frame_height), 4),
        "left": left,
        "top": top,
        "width": right - left,
        "height": bottom - top,
        "method": method,
    }
    dialogue_like = mode == "read" or ocr_mod.dialogue_like(parsed["body"], region_rel, frame_width, frame_height)
    result = {
        "ok": True,
        "game": game_id,
        "gameLabel": games_mod.get_game(game_id)["label"],
        "mode": mode,
        "window": {
            "hwnd": int(target["hwnd"]),
            "title": target.get("title") or "",
            "process": target.get("process") or "",
            "width": target.get("width"),
            "height": target.get("height"),
            "left": target.get("left"),
            "top": target.get("top"),
        },
        "foreground": foreground,
        "isForeground": is_foreground,
        "occluded": occlusion,
        "monitor": monitor,
        "outputIndex": output_index,
        "backend": backend_used,
        "region": region_info,
        "settled": settled,
        "waitedMs": waited_ms,
        "frames": frames,
        "lines": parsed["lines"],
        "utterances": parsed["body"],
        "allUtterances": parsed.get("allUtterances", parsed["utterances"]),
        "text": parsed["text"],
        "speaker": parsed["speaker"],
        "speakerTitle": parsed.get("speakerTitle"),
        "choices": parsed.get("choices", []),
        "score": parsed["score"],
        "empty": bool(parsed["empty"]),
        "dialogueLike": dialogue_like,
        "timings": {
            "totalMs": round((time.perf_counter() - started) * 1000.0, 1),
            "settleMs": waited_ms,
        },
        "warnings": [] if is_foreground else ["the game window is not in the foreground; capture may reflect a paused frame"],
        "image": None,
        "windowImage": None,
    }
    if include_window_image:
        try:
            result["windowImage"] = capture_mod.encode_png_b64(window_crop)
        except Exception as exc:
            result["warnings"].append("window image encoding failed: " + str(exc))
    if include_image:
        try:
            result["image"] = capture_mod.encode_png_b64(region_crop)
        except Exception as exc:
            result["warnings"].append("image encoding failed: " + str(exc))
    return result


def analyze_image(params: dict | None = None) -> dict:
    params = params or {}
    raw = str(params.get("image_b64") or "")
    if not raw:
        return error("INVALID_PARAMS", "image_b64 is required")
    try:
        data = base64.b64decode(raw, validate=False)
    except Exception as exc:
        return error("INVALID_PARAMS", "image_b64 is not valid base64: " + str(exc))
    if len(data) > 20 * 1024 * 1024:
        return error("INVALID_PARAMS", "image is larger than 20 MB")
    try:
        import cv2

        image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    except Exception as exc:
        return error("IMAGE_DECODE_FAILED", str(exc))
    if image is None or image.size == 0:
        return error("IMAGE_DECODE_FAILED", "could not decode image")
    mode = str(params.get("vision_mode") or params.get("mode") or "all").strip().lower()
    if mode not in ("composition", "ui", "map", "semantic", "all"):
        return error("INVALID_PARAMS", "vision_mode must be composition, ui, map, semantic or all")
    max_findings = max(1, min(30, int(params.get("max_findings", 12))))
    try:
        text_lines = []
        if params.get("include_text"):
            try:
                text_lines = _OCR.read(image)
            except Exception as exc:
                log("analyze_image OCR failed: " + str(exc))
                text_lines = []
        analysis = vision_mod.analyze(image, mode, max_findings, text_lines=text_lines)
        annotated = vision_mod.annotate(image, analysis) if params.get("include_image") else None
    except Exception as exc:
        return error("VISION_FAILED", str(exc))
    result = {
        "ok": True,
        "mode": "vision",
        "visionMode": mode,
        "source": "image",
        "width": int(image.shape[1]),
        "height": int(image.shape[0]),
        "analysis": analysis,
        "image": None,
        "warnings": [],
    }
    if annotated is not None:
        try:
            result["image"] = capture_mod.encode_png_b64(annotated)
        except Exception as exc:
            result["warnings"].append("annotated image encoding failed: " + str(exc))
    return result


def _dispatch(method: str, params: dict):
    if method == "ping":
        return {"version": VERSION, "pid": os.getpid(), "platform": platform.platform()}
    if method == "warmup":
        return {"warmupMs": _OCR.warmup()}
    if method == "selftest":
        return selftest(params)
    if method == "windows":
        return windows_list(params)
    if method in ("capture", "preview"):
        payload = dict(params or {})
        if method == "preview":
            payload["include_image"] = True
        return capture(payload)
    if method == "vision":
        payload = dict(params or {})
        vision_mode = payload.pop("vision_mode", None) or payload.pop("mode", "all")
        payload["mode"] = "read"
        payload["analyze"] = vision_mode
        return capture(payload)
    if method == "analyze_image":
        return analyze_image(params)
    return error("UNKNOWN_METHOD", "unknown method: " + str(method))


def handle(request: dict) -> dict:
    request_id = request.get("id")
    try:
        result = _dispatch(str(request.get("method") or ""), request.get("params") or {})
        if "ok" in result and result.get("ok") is False:
            response = {"id": request_id, **result}
        else:
            response = {"id": request_id, "ok": True, "result": result}
        return response
    except Exception as exc:
        detail = traceback.format_exc() if os.environ.get("DSH_LORE_DEBUG") == "1" else None
        log("request failed: " + str(exc))
        return {"id": request_id, "ok": False, "error": {"code": "INTERNAL", "message": str(exc), "detail": detail}}


def serve() -> int:
    try:
        sys.stdin.reconfigure(encoding="utf-8")
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            request = json.loads(line)
        except Exception as exc:
            sys.stdout.write(json.dumps({"id": None, "ok": False, "error": {"code": "BAD_JSON", "message": str(exc)}}, ensure_ascii=False) + "\n")
            sys.stdout.flush()
            continue
        response = handle(request)
        sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
        sys.stdout.flush()
    return 0
