"""Screen capture: DXcam first, mss fallback. Read-only by construction."""

from __future__ import annotations

import base64
import re

import numpy as np


class CaptureError(RuntimeError):
    def __init__(self, message: str, code: str = "CAPTURE_FAILED"):
        super().__init__(message)
        self.code = code


def _dxcam():
    import dxcam  # lazy

    return dxcam


def list_outputs() -> list[dict]:
    try:
        text = str(_dxcam().output_info() or "")
    except Exception:
        return []
    pattern = re.compile(r"Output\[(\d+)\]:\s*Res:\((\d+),\s*(\d+)\)(.*)$", re.MULTILINE)
    outputs = []
    for match in pattern.finditer(text):
        index, width, height, rest = match.groups()
        outputs.append({
            "index": int(index),
            "width": int(width),
            "height": int(height),
            "primary": "Primary:True" in rest,
        })
    return outputs


def match_output(monitor: dict | None, outputs: list[dict], override=None) -> int:
    if override is not None:
        try:
            return int(override)
        except (TypeError, ValueError):
            pass
    if not outputs:
        return 0
    if monitor:
        width = int(monitor.get("width") or 0)
        height = int(monitor.get("height") or 0)
        same = [entry for entry in outputs if entry.get("width") == width and entry.get("height") == height]
        if len(same) == 1:
            return int(same[0]["index"])
        if same:
            primary = [entry for entry in same if entry.get("primary") == bool(monitor.get("primary"))]
            if primary:
                return int(primary[0]["index"])
            return int(same[0]["index"])
    primary = [entry for entry in outputs if entry.get("primary")]
    return int((primary or outputs)[0]["index"])


class DxcamCapturer:
    def __init__(self, output_index: int):
        self.output_index = int(output_index)
        self.camera = None

    def _ensure(self):
        if self.camera is None:
            camera = _dxcam().create(output_idx=self.output_index, output_color="BGR")
            if camera is None:
                raise CaptureError("DXcam could not create output " + str(self.output_index), "CAPTURE_UNAVAILABLE")
            self.camera = camera

    def grab(self) -> np.ndarray:
        self._ensure()
        frame = self.camera.grab(new_frame_only=False)
        if frame is None:
            frame = self.camera.grab()
        if frame is None:
            raise CaptureError("DXcam returned no frame", "CAPTURE_UNAVAILABLE")
        return frame

    def close(self):
        try:
            if self.camera is not None:
                self.camera.release()
        except Exception:
            pass
        self.camera = None


class MssCapturer:
    def __init__(self):
        self.sct = None

    def _ensure(self):
        if self.sct is None:
            import mss

            self.sct = mss.mss()

    def grab(self, monitor: dict) -> np.ndarray:
        self._ensure()
        shot = self.sct.grab({
            "left": int(monitor["left"]),
            "top": int(monitor["top"]),
            "width": int(monitor["width"]),
            "height": int(monitor["height"]),
        })
        frame = np.array(shot, dtype=np.uint8)
        if frame.ndim != 3 or frame.shape[2] < 3:
            raise CaptureError("mss returned an unexpected frame", "CAPTURE_UNAVAILABLE")
        return frame[:, :, :3]

    def close(self):
        try:
            if self.sct is not None:
                self.sct.close()
        except Exception:
            pass
        self.sct = None


class CapturePool:
    """Keep DXcam/mss handles warm; the engine serves one request at a time."""

    def __init__(self):
        self.dxcam = {}
        self.mss = None

    def grab(self, monitor: dict, output_index: int, backend: str = "auto") -> tuple[np.ndarray, str]:
        errors = []
        if backend in ("auto", "dxcam"):
            try:
                capturer = self.dxcam.get(output_index)
                if capturer is None:
                    capturer = DxcamCapturer(output_index)
                    self.dxcam[output_index] = capturer
                return capturer.grab(), "dxcam"
            except Exception as error:
                errors.append("dxcam: " + str(error))
                if backend == "dxcam":
                    raise CaptureError("; ".join(errors), getattr(error, "code", "CAPTURE_FAILED"))
        try:
            if self.mss is None:
                self.mss = MssCapturer()
            return self.mss.grab(monitor), "mss"
        except Exception as error:
            errors.append("mss: " + str(error))
            raise CaptureError("; ".join(errors), getattr(error, "code", "CAPTURE_FAILED"))

    def close(self):
        for capturer in self.dxcam.values():
            capturer.close()
        self.dxcam.clear()
        if self.mss is not None:
            self.mss.close()
            self.mss = None


def black_frame_stats(frame: np.ndarray) -> dict:
    try:
        mean = float(frame.mean())
        std = float(frame.std())
        return {"mean": round(mean, 2), "std": round(std, 2), "black": bool(mean < 6.0 and std < 2.0)}
    except Exception:
        return {"mean": None, "std": None, "black": False}


def crop_window(frame: np.ndarray, window: dict, monitor: dict) -> tuple[np.ndarray, dict]:
    left = max(int(window["left"]), int(monitor["left"]))
    top = max(int(window["top"]), int(monitor["top"]))
    right = min(int(window["left"]) + int(window["width"]), int(monitor["left"]) + int(monitor["width"]))
    bottom = min(int(window["top"]) + int(window["height"]), int(monitor["top"]) + int(monitor["height"]))
    if right <= left or bottom <= top:
        raise CaptureError("window does not intersect its monitor", "CAPTURE_GEOMETRY")
    x0 = left - int(monitor["left"])
    y0 = top - int(monitor["top"])
    x1 = x0 + (right - left)
    y1 = y0 + (bottom - top)
    height, width = frame.shape[:2]
    if x1 > width or y1 > height:
        raise CaptureError("monitor frame is smaller than the requested window crop", "CAPTURE_GEOMETRY")
    crop = frame[y0:y1, x0:x1].copy()
    return crop, {"left": left, "top": top, "width": right - left, "height": bottom - top, "x": x0, "y": y0}


def encode_png_b64(image: np.ndarray) -> str:
    import cv2

    ok, buffer = cv2.imencode(".png", image)
    if not ok:
        raise CaptureError("PNG encoding failed", "ENCODE_FAILED")
    return base64.b64encode(buffer.tobytes()).decode("ascii")
