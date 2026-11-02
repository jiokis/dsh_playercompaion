from lore_engine import protocol


def test_ping_shape():
    response = protocol.handle({"id": 1, "method": "ping"})
    assert response["ok"] is True
    assert response["result"]["version"] == protocol.VERSION


def test_unknown_method_is_reported():
    response = protocol.handle({"id": 2, "method": "nope"})
    assert response["ok"] is False
    assert response["error"]["code"] == "UNKNOWN_METHOD"


def test_capture_rejects_invalid_mode_before_touching_windows():
    result = protocol.capture({"mode": "bad"})
    assert result["ok"] is False
    assert result["error"]["code"] == "INVALID_PARAMS"


def test_capture_without_game_window_reports_actionable_error():
    result = protocol.capture({"game": "genshin", "window": "__no_such_window__", "mode": "dialogue", "require_foreground": True})
    assert result["ok"] is False
    assert result["error"]["code"] in ("WINDOW_NOT_FOUND", "GAME_NOT_DETECTED")
    assert "windows" in result["error"].get("detail", {})
