import json

from lore_engine import games, windows

windows.set_dpi_awareness()
all_windows = windows.list_windows()
match = games.detect_game(all_windows, "genshin")
foreground = windows.foreground_window()
target = match.get("window")
occlusion = windows.window_occlusion(int(target["hwnd"])) if target else None
print(json.dumps({
    "match": {"game": match.get("game"), "window": target},
    "foreground": foreground,
    "occlusion": occlusion,
    "windowCount": len(all_windows),
    "candidates": [{"title": w.get("title"), "process": w.get("process"), "width": w.get("width"), "height": w.get("height")} for w in all_windows if "YuanShen" in str(w.get("process")) or "原神" in str(w.get("title"))]
}, ensure_ascii=False, indent=2))
