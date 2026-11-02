"""Game-specific facts: process names, title keywords, default regions."""

from __future__ import annotations

GAMES = {
    "genshin": {
        "id": "genshin",
        "label": "原神",
        "processes": ["yuanshen.exe", "genshinimpact.exe"],
        "title_keywords": ["原神", "genshin impact"],
        "region": {"x": 0.08, "y": 0.62, "w": 0.84, "h": 0.34},
    },
    "hsr": {
        "id": "hsr",
        "label": "崩坏：星穹铁道",
        "processes": ["starrail.exe"],
        "title_keywords": ["星穹铁道", "崩坏：星穹铁道", "崩坏:星穹铁道", "honkai: star rail", "honkai star rail"],
        "region": {"x": 0.06, "y": 0.60, "w": 0.88, "h": 0.36},
    },
}


def game_ids() -> list[str]:
    return list(GAMES)


def get_game(game_id: str) -> dict | None:
    return GAMES.get(str(game_id or "").strip().lower())


def default_region(game_id: str) -> dict:
    game = get_game(game_id)
    if game is None:
        raise ValueError("unknown game: " + str(game_id))
    return dict(game["region"])


def _matches_process(window: dict, game: dict) -> bool:
    process = str(window.get("process") or "").lower()
    return any(process == name or process.endswith("\\" + name) for name in game["processes"])


def _matches_title(window: dict, game: dict) -> bool:
    title = str(window.get("title") or "").lower()
    return any(keyword.lower() in title for keyword in game["title_keywords"])


def window_score(window: dict, game: dict) -> int:
    score = 0
    if _matches_process(window, game):
        score += 10
    if _matches_title(window, game):
        score += 5
    if window.get("minimized"):
        score -= 2
    return score


def match_window(windows: list[dict], game_id: str, hint: str | None = None) -> dict | None:
    game = get_game(game_id)
    if game is None:
        return None
    needle = str(hint or "").strip().lower()
    candidates = []
    for window in windows or []:
        score = window_score(window, game)
        if needle:
            title = str(window.get("title") or "").lower()
            process = str(window.get("process") or "").lower()
            if needle not in title and needle not in process:
                continue
            score += 3
        if score <= 0:
            continue
        candidates.append((score, int(window.get("width") or 0) * int(window.get("height") or 0), window))
    if not candidates:
        return None
    candidates.sort(key=lambda item: (-item[0], -item[1]))
    return candidates[0][2]


def detect_game(windows: list[dict], requested: str = "auto", hint: str | None = None) -> dict:
    requested = str(requested or "auto").strip().lower()
    if requested in GAMES:
        window = match_window(windows, requested, hint)
        return {"game": requested, "window": window, "candidates": ([{"game": requested, "window": window}] if window else [])}
    scored = []
    for game_id in GAMES:
        window = match_window(windows, game_id, hint)
        if window is not None:
            scored.append((window_score(window, GAMES[game_id]), game_id, window))
    scored.sort(key=lambda item: -item[0])
    if not scored:
        return {"game": None, "window": None, "candidates": []}
    return {
        "game": scored[0][1],
        "window": scored[0][2],
        "candidates": [{"game": game_id, "window": window} for _score, game_id, window in scored],
    }


def windows_summary(windows: list[dict], limit: int = 12) -> list[dict]:
    out = []
    for window in (windows or [])[:limit]:
        out.append({
            "title": window.get("title") or "",
            "process": window.get("process") or "",
            "width": window.get("width"),
            "height": window.get("height"),
            "minimized": bool(window.get("minimized")),
        })
    return out
