import base64
import json
import time
from pathlib import Path

from lore_engine import games, protocol, windows
from _paths import SCRIPTS

OUT = SCRIPTS / "genshin-capture.json"
IMAGE = SCRIPTS / "genshin-crop.png"


def save(result: dict) -> None:
    if result.get("image"):
        IMAGE.write_bytes(base64.b64decode(result["image"]))
        result["image"] = None
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    windows.set_dpi_awareness()
    started = time.time()
    deadline = started + 600
    attempts = 0
    last = None
    while time.time() < deadline:
        all_windows = windows.list_windows()
        match = games.detect_game(all_windows, "genshin")
        target = match.get("window")
        if not target:
            time.sleep(0.5)
            continue
        foreground = windows.foreground_window()
        if not foreground or int(foreground.get("hwnd", 0)) != int(target.get("hwnd", 0)):
            time.sleep(0.5)
            continue
        occlusion = windows.window_occlusion(int(target["hwnd"]))
        if occlusion.get("available") and float(occlusion.get("occluded_ratio") or 0) > 0.2:
            time.sleep(0.5)
            continue
        attempts += 1
        try:
            result = protocol.capture({
                "game": "genshin",
                "mode": "dialogue",
                "require_foreground": True,
                "include_image": True,
                "settle_ms": 250,
                "max_settle_ms": 900,
            })
        except Exception as error:
            last = {"ok": False, "error": {"code": "EXCEPTION", "message": str(error)}}
            time.sleep(1.5)
            continue
        last = result
        if result.get("ok") and result.get("dialogueLike") and not result.get("empty"):
            save(result)
            print(json.dumps({
                "ok": True,
                "attempts": attempts,
                "elapsedSeconds": round(time.time() - started, 1),
                "region": result.get("region"),
                "settled": result.get("settled"),
                "speaker": result.get("speaker"),
                "text": (result.get("text") or "")[:800],
                "lineCount": len(result.get("lines") or []),
                "image": str(IMAGE),
            }, ensure_ascii=False, indent=2))
            return 0
        time.sleep(1.5)
    if last is not None:
        save(last)
    print(json.dumps({
        "ok": False,
        "error": "timed out waiting for a dialogue-like capture",
        "attempts": attempts,
        "last": last,
    }, ensure_ascii=False, indent=2)[:3000])
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
