"""Find the dialogue text cluster inside a generous lower-center band.

The idea is borrowed from Genshin-Subtitles (bright/gold text masks, connected
components, row grouping, bottom-center scoring), reimplemented for our crop.
The detector only proposes a box; OCR still decides whether there is text.
"""

from __future__ import annotations

import numpy as np


def rect_from_norm(region: dict, width: int, height: int) -> tuple[int, int, int, int]:
    x = int(round(float(region.get("x", 0.08)) * width))
    y = int(round(float(region.get("y", 0.62)) * height))
    w = int(round(float(region.get("w", 0.84)) * width))
    h = int(round(float(region.get("h", 0.34)) * height))
    return clamp_rect((x, y, x + w, y + h), width, height)


def clamp_rect(rect, width: int, height: int):
    left, top, right, bottom = (int(part) for part in rect)
    left = max(0, min(left, width - 1))
    top = max(0, min(top, height - 1))
    right = max(left + 1, min(right, width))
    bottom = max(top + 1, min(bottom, height))
    return (left, top, right, bottom)


def expand_rect(rect, pad_x: int, pad_top: int, pad_bottom: int, width: int, height: int):
    left, top, right, bottom = rect
    return clamp_rect((left - pad_x, top - pad_top, right + pad_x, bottom + pad_bottom), width, height)


def _intersection_over_min(a_top, a_bottom, b_top, b_bottom) -> float:
    overlap = min(a_bottom, b_bottom) - max(a_top, b_top)
    shortest = max(1, min(a_bottom - a_top, b_bottom - b_top))
    return overlap / shortest


def _find_cluster(crop: np.ndarray):
    try:
        import cv2
    except Exception:
        return None
    if crop is None or crop.size == 0 or crop.shape[0] < 24 or crop.shape[1] < 40:
        return None
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    rows_count, cols_count = gray.shape[:2]

    gray_mask = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)[1]
    white_mask = cv2.inRange(hsv, (0, 0, 185), (180, 90, 255))
    gold_mask = cv2.inRange(hsv, (8, 45, 130), (38, 255, 255))
    mask = cv2.bitwise_or(gray_mask, white_mask)
    mask = cv2.bitwise_or(mask, gold_mask)

    basis = max(1, rows_count)
    block = int(round(31.0 * basis / 1600.0))
    block = max(15, min(51, block))
    if block % 2 == 0:
        block += 1
    adaptive_c = max(3.0, 7.0 * basis / 1600.0)
    adaptive = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, block, adaptive_c)
    mask = cv2.bitwise_or(mask, adaptive)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))

    count, _labels, stats, _centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)
    min_height = max(2, int(round(rows_count * 0.005)))
    max_height = max(16, int(round(rows_count * 0.22)))
    max_width = max(48, int(round(cols_count * 0.6)))
    max_area = max(600, int(round(rows_count * cols_count * 0.02)))
    components = []
    for index in range(1, count):
        x = int(stats[index, cv2.CC_STAT_LEFT])
        y = int(stats[index, cv2.CC_STAT_TOP])
        w = int(stats[index, cv2.CC_STAT_WIDTH])
        h = int(stats[index, cv2.CC_STAT_HEIGHT])
        area = int(stats[index, cv2.CC_STAT_AREA])
        if area < 2 or area > max_area or h < min_height or h > max_height:
            continue
        if w < 1 or w > max_width or (h > 0 and w / h > 12.0):
            continue
        components.append({"left": x, "top": y, "right": x + w, "bottom": y + h, "width": w, "height": h})
    if not components:
        return None

    rows = []
    for component in sorted(components, key=lambda item: (item["top"], item["left"])):
        placed = False
        for row in rows:
            if _intersection_over_min(component["top"], component["bottom"], row["top"], row["bottom"]) >= 0.5:
                row["left"] = min(row["left"], component["left"])
                row["top"] = min(row["top"], component["top"])
                row["right"] = max(row["right"], component["right"])
                row["bottom"] = max(row["bottom"], component["bottom"])
                row["components"] += 1
                row["heights"].append(component["height"])
                placed = True
                break
        if not placed:
            rows.append({
                "left": component["left"],
                "top": component["top"],
                "right": component["right"],
                "bottom": component["bottom"],
                "components": 1,
                "heights": [component["height"]],
            })
    if not rows:
        return None
    for row in rows:
        heights = sorted(row["heights"])
        row["median_height"] = heights[len(heights) // 2]
        row["center_x"] = (row["left"] + row["right"]) / 2.0
    rows.sort(key=lambda item: item["top"])

    best = None
    best_score = float("-inf")
    for start in range(len(rows)):
        group = []
        for end in range(start, min(len(rows), start + 4)):
            row = rows[end]
            if group:
                previous = group[-1]
                gap = row["top"] - previous["bottom"]
                max_gap = max(4, int(round(max(previous["median_height"], row["median_height"]) * 2.5)))
                if gap > max_gap:
                    break
                if abs(row["center_x"] - previous["center_x"]) > cols_count * 0.24:
                    break
            group.append(row)
            left = min(item["left"] for item in group)
            top = min(item["top"] for item in group)
            right = max(item["right"] for item in group)
            bottom = max(item["bottom"] for item in group)
            width = right - left
            center_offset = abs((left + right) / 2.0 - cols_count / 2.0) / max(1, cols_count)
            max_height_in_group = max(item["median_height"] for item in group)
            component_count = sum(item["components"] for item in group)
            if center_offset > 0.35 or width < max(18, max_height_in_group * 1.4):
                continue
            if component_count < 2 and not (component_count == 1 and width >= cols_count * 0.25 and (bottom - top) <= max_height):
                continue
            row_pref = min(1.0, len(group) / 3.0)
            component_pref = min(1.0, component_count / 14.0)
            width_pref = min(1.0, width / max(1.0, cols_count * 0.50))
            bottom_pref = bottom / max(1, rows_count)
            score = 0.34 * row_pref + 0.30 * component_pref + 0.20 * width_pref + 0.16 * bottom_pref - center_offset * 0.8
            if score > best_score:
                best_score = score
                best = (left, top, right, bottom)
    return best


def detect_region(frame: np.ndarray, fallback: dict):
    """Return (rect, method, score) in full-frame absolute coordinates."""
    height, width = frame.shape[:2]
    fallback_rect = rect_from_norm(fallback, width, height)
    left, top, right, bottom = fallback_rect
    crop = frame[top:bottom, left:right]
    found = _find_cluster(crop)
    if found is None:
        return fallback_rect, "fallback", None
    local_left, local_top, local_right, local_bottom = found
    cluster_height = max(1, local_bottom - local_top)
    pad_x = max(6, int(round(cluster_height * 0.6)))
    pad_top = max(8, int(round(cluster_height * 0.8)))
    pad_bottom = max(6, int(round(cluster_height * 0.4)))
    rect = expand_rect(
        (left + local_left, top + local_top, left + local_right, top + local_bottom),
        pad_x,
        pad_top,
        pad_bottom,
        width,
        height,
    )
    return rect, "cluster", None
