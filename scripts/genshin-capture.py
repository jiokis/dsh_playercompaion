import base64
import json
from pathlib import Path

from lore_engine import protocol
from _paths import SCRIPTS

result = protocol.capture({
    "game": "genshin",
    "mode": "dialogue",
    "include_image": True,
    "settle_ms": 350,
    "max_settle_ms": 1200,
})
out = SCRIPTS / "genshin-capture.json"
image_path = SCRIPTS / "genshin-crop.png"
if result.get("image"):
    image_path.write_bytes(base64.b64decode(result["image"]))
    result["image"] = None
out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({
    "ok": result.get("ok"),
    "error": result.get("error"),
    "game": result.get("game"),
    "window": result.get("window"),
    "foreground": result.get("foreground", {}).get("process") if isinstance(result.get("foreground"), dict) else None,
    "occluded": result.get("occluded"),
    "backend": result.get("backend"),
    "region": result.get("region"),
    "settled": result.get("settled"),
    "empty": result.get("empty"),
    "dialogueLike": result.get("dialogueLike"),
    "speaker": result.get("speaker"),
    "text": (result.get("text") or "")[:500],
    "lineCount": len(result.get("lines") or []),
    "imagePath": str(image_path) if image_path.exists() else None,
}, ensure_ascii=False, indent=2))
