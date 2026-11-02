"""Read-only Win32 window/monitor probes.

Only enumeration and geometry APIs live here: no focus changes, no input
injection, no memory access. All failures degrade to empty/None instead of
throwing so the caller can report a useful error.
"""

from __future__ import annotations

import ctypes
from ctypes import wintypes

IS_WINDOWS = hasattr(ctypes, "windll")

DWMWA_EXTENDED_FRAME_BOUNDS = 9
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
MONITOR_DEFAULTTONEAREST = 2
MONITORINFOF_PRIMARY = 1

OCCLUSION_TOP_N = 3


class _MONITORINFO(ctypes.Structure):
    _fields_ = [
        ("cbSize", wintypes.DWORD),
        ("rcMonitor", wintypes.RECT),
        ("rcWork", wintypes.RECT),
        ("dwFlags", wintypes.DWORD),
    ]


def _configure_win32() -> None:
    """Declare arg/return types so 64-bit HWND/HANDLE values are not truncated."""
    if not IS_WINDOWS:
        return
    try:
        user32 = ctypes.windll.user32
        kernel32 = ctypes.windll.kernel32
        user32.GetForegroundWindow.restype = wintypes.HWND
        user32.MonitorFromWindow.restype = wintypes.HANDLE
        user32.MonitorFromWindow.argtypes = [wintypes.HWND, wintypes.DWORD]
        user32.GetMonitorInfoW.argtypes = [wintypes.HANDLE, ctypes.POINTER(_MONITORINFO)]
        user32.GetWindowTextLengthW.argtypes = [wintypes.HWND]
        user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
        user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.LPOINTER(wintypes.DWORD)]
        user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.LPOINTER(wintypes.RECT)]
        user32.IsWindowVisible.argtypes = [wintypes.HWND]
        user32.IsIconic.argtypes = [wintypes.HWND]
        ctypes.windll.dwmapi.DwmGetWindowAttribute.argtypes = [wintypes.HWND, wintypes.DWORD, ctypes.c_void_p, wintypes.DWORD]
        kernel32.OpenProcess.restype = wintypes.HANDLE
        kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel32.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
        kernel32.QueryFullProcessImageNameW.restype = wintypes.BOOL
        kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    except Exception:
        pass


_configure_win32()


def set_dpi_awareness() -> str:
    """Make Win32 rectangles match physical pixels (and DXcam frames)."""
    if not IS_WINDOWS:
        return "unsupported"
    try:
        user32 = ctypes.windll.user32
        if hasattr(user32, "SetProcessDpiAwarenessContext"):
            if user32.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4)):
                return "per-monitor-v2"
    except Exception:
        pass
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
        return "per-monitor"
    except Exception:
        pass
    try:
        ctypes.windll.user32.SetProcessDPIAware()
        return "system"
    except Exception:
        return "none"


def _user32():
    return ctypes.windll.user32


def _window_title(hwnd: int) -> str:
    try:
        user32 = _user32()
        length = user32.GetWindowTextLengthW(wintypes.HWND(hwnd))
        if length <= 0:
            return ""
        buffer = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(wintypes.HWND(hwnd), buffer, length + 1)
        return buffer.value.strip()
    except Exception:
        return ""


def _process_name(hwnd: int) -> str | None:
    try:
        pid = wintypes.DWORD()
        _user32().GetWindowThreadProcessId(wintypes.HWND(hwnd), ctypes.byref(pid))
        if not pid.value:
            return None
        kernel32 = ctypes.windll.kernel32
        handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid.value)
        if not handle:
            return None
        try:
            size = wintypes.DWORD(32768)
            buffer = ctypes.create_unicode_buffer(size.value)
            if kernel32.QueryFullProcessImageNameW(handle, 0, buffer, ctypes.byref(size)):
                return buffer.value.split("\\")[-1]
            return None
        finally:
            kernel32.CloseHandle(handle)
    except Exception:
        return None


def window_rect(hwnd: int):
    """Return (left, top, right, bottom) in physical pixels, or None."""
    if not IS_WINDOWS or not hwnd:
        return None
    rect = wintypes.RECT()
    try:
        hresult = ctypes.windll.dwmapi.DwmGetWindowAttribute(
            wintypes.HWND(hwnd), DWMWA_EXTENDED_FRAME_BOUNDS, ctypes.byref(rect), ctypes.sizeof(rect)
        )
        if hresult != 0:
            if not _user32().GetWindowRect(wintypes.HWND(hwnd), ctypes.byref(rect)):
                return None
        if rect.right <= rect.left or rect.bottom <= rect.top:
            return None
        return (int(rect.left), int(rect.top), int(rect.right), int(rect.bottom))
    except Exception:
        return None


def _window_record(hwnd: int) -> dict | None:
    rect = window_rect(hwnd)
    if rect is None:
        return None
    return {
        "hwnd": int(hwnd),
        "title": _window_title(hwnd),
        "process": _process_name(hwnd),
        "left": rect[0],
        "top": rect[1],
        "width": rect[2] - rect[0],
        "height": rect[3] - rect[1],
        "minimized": bool(_user32().IsIconic(wintypes.HWND(hwnd))),
    }


def list_windows(min_width: int = 80, min_height: int = 60, limit: int = 200) -> list[dict]:
    """List visible top-level windows with geometry. Read-only."""
    if not IS_WINDOWS:
        return []
    results: list[dict] = []
    user32 = _user32()

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def callback(hwnd, _lparam):
        try:
            if not user32.IsWindowVisible(wintypes.HWND(int(hwnd))):
                return True
            record = _window_record(int(hwnd))
            if record is None:
                return True
            if record["width"] < min_width or record["height"] < min_height:
                return True
            results.append(record)
        except Exception:
            pass
        return True

    try:
        user32.EnumWindows(callback, 0)
    except Exception:
        return []
    results.sort(key=lambda item: (item["minimized"], -(item["width"] * item["height"])))
    return results[:limit]


def foreground_window() -> dict | None:
    """Current foreground window; read-only, never focuses anything."""
    if not IS_WINDOWS:
        return None
    try:
        user32 = _user32()
        user32.GetForegroundWindow.restype = wintypes.HWND
        hwnd = user32.GetForegroundWindow()
        if not hwnd:
            return None
        record = _window_record(int(hwnd))
        if record is None:
            return {"hwnd": int(hwnd), "title": _window_title(int(hwnd)), "process": _process_name(int(hwnd))}
        return record
    except Exception:
        return None


def list_monitors() -> list[dict]:
    """Physical monitors in virtual-desktop coordinates."""
    if not IS_WINDOWS:
        return []
    user32 = _user32()
    monitors: list[dict] = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HMONITOR, wintypes.HDC, ctypes.POINTER(wintypes.RECT), wintypes.LPARAM)
    def callback(hmonitor, _hdc, _rect, _lparam):
        info = _MONITORINFO()
        info.cbSize = ctypes.sizeof(_MONITORINFO)
        try:
            if user32.GetMonitorInfoW(hmonitor, ctypes.byref(info)):
                rect = info.rcMonitor
                monitors.append({
                    "index": len(monitors),
                    "left": int(rect.left),
                    "top": int(rect.top),
                    "width": int(rect.right - rect.left),
                    "height": int(rect.bottom - rect.top),
                    "primary": bool(info.dwFlags & MONITORINFOF_PRIMARY),
                })
        except Exception:
            pass
        return True

    try:
        user32.EnumDisplayMonitors(None, None, callback, 0)
    except Exception:
        return []
    return monitors


def monitor_for_window(hwnd: int) -> dict | None:
    if not IS_WINDOWS or not hwnd:
        return None
    try:
        user32 = _user32()
        hmonitor = user32.MonitorFromWindow(wintypes.HWND(hwnd), MONITOR_DEFAULTTONEAREST)
        if not hmonitor:
            return None
        info = _MONITORINFO()
        info.cbSize = ctypes.sizeof(_MONITORINFO)
        if not user32.GetMonitorInfoW(hmonitor, ctypes.byref(info)):
            return None
        rect = info.rcMonitor
        return {
            "left": int(rect.left),
            "top": int(rect.top),
            "width": int(rect.right - rect.left),
            "height": int(rect.bottom - rect.top),
            "primary": bool(info.dwFlags & MONITORINFOF_PRIMARY),
        }
    except Exception:
        return None


def _zorder_above(hwnd: int) -> list[dict] | None:
    """Visible windows above the target in z-order (top -> down)."""
    if not IS_WINDOWS or not hwnd:
        return None
    user32 = _user32()
    results: list[dict] = []
    found = False

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def callback(current, _lparam):
        nonlocal found
        try:
            if int(current) == int(hwnd):
                found = True
                return False
            if not user32.IsWindowVisible(wintypes.HWND(int(current))) or user32.IsIconic(wintypes.HWND(int(current))):
                return True
            record = _window_record(int(current))
            if record is not None:
                results.append(record)
        except Exception:
            pass
        return True

    try:
        user32.EnumWindows(callback, 0)
    except Exception:
        return None
    return results if found else None


def _normalize_rect(value):
    try:
        if isinstance(value, dict):
            left = int(value["left"])
            top = int(value["top"])
            return (left, top, left + int(value["width"]), top + int(value["height"]))
        left, top, right, bottom = (int(part) for part in value)
        return (left, top, right, bottom)
    except (KeyError, TypeError, ValueError):
        return None


def rect_intersection_area(left, right) -> int:
    a = _normalize_rect(left)
    b = _normalize_rect(right)
    if a is None or b is None:
        return 0
    width = min(a[2], b[2]) - max(a[0], b[0])
    height = min(a[3], b[3]) - max(a[1], b[1])
    return width * height if width > 0 and height > 0 else 0


def covered_ratio(target, window) -> float:
    a = _normalize_rect(target)
    if a is None:
        return 0.0
    area = (a[2] - a[0]) * (a[3] - a[1])
    if area <= 0:
        return 0.0
    return min(1.0, rect_intersection_area(a, window) / area)


def occlusion_from_windows(target, windows) -> dict:
    a = _normalize_rect(target)
    if a is None:
        return {"available": False, "occluded_ratio": 0.0, "occluded": False, "covered_by": []}
    area = (a[2] - a[0]) * (a[3] - a[1])
    total = 0.0
    covering: list[dict] = []
    for window in windows or []:
        ratio = round(min(1.0, rect_intersection_area(a, window) / area), 4) if area > 0 else 0.0
        if ratio <= 0:
            continue
        total += ratio
        covering.append({"hwnd": int(window.get("hwnd") or 0), "title": str(window.get("title") or ""), "ratio": ratio})
    covering.sort(key=lambda item: (-item["ratio"], item["hwnd"]))
    ratio = round(min(1.0, total), 4)
    return {
        "available": True,
        "occluded_ratio": ratio,
        "occluded": ratio >= 0.5,
        "covered_by": covering[:OCCLUSION_TOP_N],
    }


def window_occlusion(hwnd: int) -> dict:
    if not IS_WINDOWS or not hwnd:
        return {"available": False, "occluded_ratio": 0.0, "occluded": False, "covered_by": []}
    target = window_rect(hwnd)
    if target is None:
        return {"available": False, "occluded_ratio": 0.0, "occluded": False, "covered_by": []}
    above = _zorder_above(hwnd)
    if above is None:
        return {"available": False, "occluded_ratio": 0.0, "occluded": False, "covered_by": []}
    return occlusion_from_windows(target, above)


def find_window(windows: list[dict], hint: str) -> dict | None:
    needle = str(hint or "").strip().lower()
    if not needle:
        return None
    candidates = [
        window for window in windows
        if needle in str(window.get("title", "")).lower() or needle in str(window.get("process", "")).lower()
    ]
    if not candidates:
        return None

    def rank(window: dict):
        title = str(window.get("title", "")).lower()
        process = str(window.get("process", "")).lower()
        if title == needle or process == needle:
            tier = 0
        elif title.startswith(needle) or process.startswith(needle):
            tier = 1
        else:
            tier = 2
        return (tier, -(int(window.get("width", 0)) * int(window.get("height", 0))))

    return sorted(candidates, key=rank)[0]
