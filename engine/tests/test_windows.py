from lore_engine.windows import (
    covered_ratio,
    find_window,
    occlusion_from_windows,
    rect_intersection_area,
)


def test_rect_intersection_area():
    assert rect_intersection_area((0, 0, 100, 100), (50, 50, 150, 150)) == 2500
    assert rect_intersection_area((0, 0, 10, 10), (20, 20, 30, 30)) == 0


def test_covered_ratio_caps_at_one():
    assert covered_ratio((0, 0, 100, 100), (0, 0, 50, 100)) == 0.5
    assert covered_ratio((0, 0, 100, 100), (0, 0, 200, 200)) == 1.0


def test_occlusion_from_windows_reports_covered_by():
    result = occlusion_from_windows(
        (0, 0, 100, 100),
        [
            {"hwnd": 1, "title": "chat", "left": 0, "top": 0, "width": 60, "height": 100},
            {"hwnd": 2, "title": "browser", "left": 60, "top": 0, "width": 20, "height": 100},
        ],
    )
    assert result["available"] is True
    assert result["occluded_ratio"] == 0.8
    assert result["occluded"] is True
    assert result["covered_by"][0]["title"] == "chat"


def test_find_window_prefers_exact_title():
    windows = [
        {"title": "原神 - 启动器", "process": "launcher.exe", "width": 800, "height": 600},
        {"title": "原神", "process": "YuanShen.exe", "width": 2560, "height": 1440},
    ]
    assert find_window(windows, "原神")["process"] == "YuanShen.exe"
    assert find_window(windows, "YuanShen")["process"] == "YuanShen.exe"
    assert find_window(windows, "nothing") is None
