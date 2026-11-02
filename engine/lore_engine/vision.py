"""Local, read-only image element analysis.

This is deliberately heuristic: composition metrics, coarse UI panels and
low-confidence map/POI candidates from pixels and geometry. It never claims
semantic certainty and never talks to a model or the network.
"""

from __future__ import annotations

import math

import cv2
import numpy as np


MAX_ANALYSIS_SIDE = 1024
MIN_ANALYSIS_SIDE = 160


def _clip(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, float(value)))


def _box(left: float, top: float, right: float, bottom: float, width: int, height: int, label: str = "", score: float = 0.0) -> dict:
    left = _clip(left / max(1, width))
    top = _clip(top / max(1, height))
    right = _clip(right / max(1, width))
    bottom = _clip(bottom / max(1, height))
    if right <= left or bottom <= top:
        return {}
    return {
        "x": round(left, 4),
        "y": round(top, 4),
        "w": round(right - left, 4),
        "h": round(bottom - top, 4),
        "label": label,
        "score": round(_clip(score), 4),
    }


def _prepare(image: np.ndarray) -> tuple[np.ndarray, float]:
    if image is None or image.size == 0:
        raise ValueError("empty image")
    height, width = image.shape[:2]
    if height < 2 or width < 2:
        raise ValueError("image is too small")
    scale = min(1.0, MAX_ANALYSIS_SIDE / max(width, height))
    if scale < 1.0:
        image = cv2.resize(image, (max(2, int(width * scale)), max(2, int(height * scale))), interpolation=cv2.INTER_AREA)
    return image, scale


def _gray(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        return image
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def _palette(image: np.ndarray, count: int = 5) -> list[dict]:
    try:
        small = cv2.resize(image, (96, 54), interpolation=cv2.INTER_AREA)
        pixels = small.reshape(-1, 3).astype(np.float32)
        if len(pixels) > 2200:
            indices = np.linspace(0, len(pixels) - 1, 2200).astype(np.int32)
            pixels = pixels[indices]
        k = max(1, min(int(count), len(pixels)))
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
        _compact, labels, centers = cv2.kmeans(pixels, k, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
        counts = np.bincount(labels.flatten(), minlength=k).astype(np.float32)
        total = float(counts.sum()) or 1.0
        palette = []
        for index in np.argsort(-counts)[:k]:
            blue, green, red = [int(round(value)) for value in centers[index]]
            palette.append({
                "hex": "#" + format((red << 16) | (green << 8) | blue, "06x"),
                "ratio": round(float(counts[index]) / total, 4),
            })
        return palette
    except Exception:
        return []


def _composition(image: np.ndarray, max_findings: int) -> dict:
    height, width = image.shape[:2]
    gray = _gray(image)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    grad_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    magnitude = cv2.magnitude(grad_x, grad_y)
    weight = cv2.GaussianBlur(magnitude, (0, 0), sigmaX=max(3.0, min(width, height) / 24.0))
    center_prior = np.exp(-(((np.arange(width) / max(1, width) - 0.5) / 0.34) ** 2)[None, :] - (((np.arange(height) / max(1, height) - 0.5) / 0.34) ** 2)[:, None])
    weight = weight * center_prior.astype(np.float32)
    total_weight = float(weight.sum()) or 1.0
    ys, xs = np.indices(weight.shape)
    centroid_x = float((xs * weight).sum() / total_weight)
    centroid_y = float((ys * weight).sum() / total_weight)
    center_distance = math.hypot(centroid_x / max(1, width) - 0.5, centroid_y / max(1, height) - 0.5)
    balance = _clip(1.0 - center_distance * 1.8)

    threshold = float(np.percentile(magnitude, 82))
    mask = (magnitude >= max(8.0, threshold)).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    contours, _hierarchy = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    subject = None
    best_score = 0.0
    for contour in contours:
        area = float(cv2.contourArea(contour))
        ratio = area / float(width * height)
        if ratio < 0.008 or ratio > 0.82:
            continue
        left, top, right, bottom = cv2.boundingRect(contour)
        if left <= 1 and top <= 1 and right >= width - 2 and bottom >= height - 2:
            continue
        if right - left > width * 0.72 or bottom - top > height * 0.8:
            continue
        box = _box(left, top, left + right, top + bottom, width, height, "subject", min(1.0, ratio * 4.0))
        if not box:
            continue
        score = _clip(0.35 + min(0.45, ratio * 3.0) + min(0.2, balance * 0.2))
        if score > best_score:
            best_score = score
            subject = box
    if subject is None:
        subject = _box(width * 0.25, height * 0.25, width * 0.75, height * 0.75, width, height, "subject", 0.35)

    cell_scores = []
    for row in range(3):
        for column in range(3):
            left = int(width * column / 3)
            right = int(width * (column + 1) / 3)
            top = int(height * row / 3)
            bottom = int(height * (row + 1) / 3)
            cell_scores.append(round(float(weight[top:bottom, left:right].sum() / total_weight), 4))
    best_cell = int(np.argmax(cell_scores))
    cell_row, cell_column = divmod(best_cell, 3)
    cell_center_x = (cell_column + 0.5) / 3
    cell_center_y = (cell_row + 0.5) / 3
    thirds_distance = math.hypot(subject["x"] + subject["w"] / 2 - cell_center_x, subject["y"] + subject["h"] / 2 - cell_center_y)
    thirds_score = _clip(1.0 - thirds_distance * 2.5)

    try:
        flipped = cv2.flip(gray, 1)
        sample = cv2.resize(gray, (96, 54), interpolation=cv2.INTER_AREA).astype(np.float32).flatten()
        mirror = cv2.resize(flipped, (96, 54), interpolation=cv2.INTER_AREA).astype(np.float32).flatten()
        if sample.std() > 1 and mirror.std() > 1:
            symmetry = _clip((float(np.corrcoef(sample, mirror)[0, 1]) + 1.0) / 2.0)
        else:
            symmetry = 0.5
    except Exception:
        symmetry = 0.5

    contrast = _clip(float(gray.std()) / 72.0)
    edge_density = _clip(float(np.mean(magnitude > 24.0)))
    palette = _palette(image)
    findings = []
    findings.append({"kind": "composition", "label": "主体区域", "short": "subject", "score": round(best_score, 4), "box": subject})
    findings.append({"kind": "composition", "label": "视觉重心", "short": "centroid", "score": round(balance, 4), "detail": "重心偏离画面中心 " + str(round(center_distance * 100, 1)) + "%"})
    findings.append({"kind": "composition", "label": "三分法", "short": "thirds", "score": round(thirds_score, 4), "detail": "主体落在 " + str(cell_row + 1) + " 行 " + str(cell_column + 1) + " 列"})
    findings.append({"kind": "composition", "label": "水平平衡", "short": "balance", "score": round(balance, 4)})
    findings.append({"kind": "composition", "label": "左右对称", "short": "symmetry", "score": round(symmetry, 4)})
    findings.append({"kind": "composition", "label": "对比度", "short": "contrast", "score": round(contrast, 4)})
    if palette:
        findings.append({"kind": "composition", "label": "主色板", "short": "palette", "score": round(sum(item["ratio"] for item in palette[:3]), 4), "colors": palette})
    findings = findings[:max_findings]
    return {
        "findings": findings,
        "elements": [subject],
        "metrics": {
            "balance": round(balance, 4),
            "symmetry": round(symmetry, 4),
            "contrast": round(contrast, 4),
            "edgeDensity": round(edge_density, 4),
            "thirds": cell_scores,
            "palette": palette,
        },
    }


def _panel_label(box: dict) -> str:
    center_x = box["x"] + box["w"] / 2
    center_y = box["y"] + box["h"] / 2
    if center_y < 0.18:
        return "顶部栏"
    if center_y > 0.62 and center_x > 0.55:
        return "右下选项区"
    if center_y > 0.62:
        return "底部对话区"
    if center_x > 0.66:
        return "右侧面板"
    if center_x < 0.34:
        return "左侧面板"
    return "中央面板"


def _ui(image: np.ndarray, max_findings: int) -> dict:
    height, width = image.shape[:2]
    gray = _gray(image)
    edges = cv2.Canny(gray, 45, 135)
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, np.ones((13, 13), np.uint8))
    contours, _hierarchy = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    panels = []
    for contour in contours:
        area = float(cv2.contourArea(contour))
        ratio = area / float(width * height)
        if ratio < 0.012 or ratio > 0.94:
            continue
        left, top, right, bottom = cv2.boundingRect(contour)
        if right - left < width * 0.12 or bottom - top < height * 0.06:
            continue
        rectangularity = area / max(1.0, float((right - left) * (bottom - top)))
        if rectangularity < 0.48:
            continue
        panel = _box(left, top, left + right, top + bottom, width, height, "panel", min(1.0, ratio * 2.5))
        if not panel:
            continue
        panel["panelLabel"] = _panel_label(panel)
        panels.append(panel)
    panels.sort(key=lambda item: item["w"] * item["h"], reverse=True)
    panels = panels[:8]
    findings = []
    if panels:
        findings.append({"kind": "ui", "label": "检测到 " + str(len(panels)) + " 个面板", "short": "panels", "score": round(min(1.0, len(panels) / 5.0), 4)})
        for panel in panels[:4]:
            findings.append({
                "kind": "ui",
                "label": panel.get("panelLabel") or "面板",
                "short": "panel",
                "score": panel["score"],
                "box": {key: panel[key] for key in ("x", "y", "w", "h")},
            })
    else:
        findings.append({"kind": "ui", "label": "未找到稳定面板", "short": "no-panel", "score": 0.0, "detail": "边界过弱或画面过于简单"})
    return {
        "findings": findings[:max_findings],
        "elements": panels,
        "metrics": {"panelCount": len(panels), "uiConfidence": round(min(1.0, len(panels) / 5.0), 4)},
    }


def _map(image: np.ndarray, max_findings: int) -> dict:
    height, width = image.shape[:2]
    gray = _gray(image)
    edges = cv2.Canny(gray, 40, 120)
    contours, _hierarchy = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates = []
    for contour in contours:
        area = float(cv2.contourArea(contour))
        ratio = area / float(width * height)
        if ratio < 0.00002 or ratio > 0.004:
            continue
        left, top, right, bottom = cv2.boundingRect(contour)
        side = max(right - left, bottom - top)
        if side < 4 or side > max(12, min(width, height) * 0.08):
            continue
        perimeter = float(cv2.arcLength(contour, True)) or 1.0
        circularity = 4.0 * math.pi * area / (perimeter * perimeter)
        if circularity < 0.22:
            continue
        candidate = _box(left, top, left + right, top + bottom, width, height, "POI?", min(1.0, circularity))
        if candidate:
            candidates.append(candidate)
    candidates.sort(key=lambda item: item["score"], reverse=True)
    candidates = candidates[:12]
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180.0, threshold=60, minLineLength=max(20, min(width, height) // 12), maxLineGap=8)
    line_count = 0 if lines is None else min(40, len(lines))
    edge_density = _clip(float(np.mean(edges > 0)) * 3.0)
    map_likelihood = _clip(min(1.0, len(candidates) / 18.0) * 0.5 + edge_density * 0.35 + min(1.0, line_count / 20.0) * 0.15)
    findings = []
    if candidates:
        findings.append({
            "kind": "map",
            "label": "POI 候选 " + str(len(candidates)) + " 个",
            "short": "poi",
            "score": round(map_likelihood, 4),
            "detail": "低置信度几何启发式；不是游戏内地图坐标",
        })
        for candidate in candidates[:5]:
            findings.append({"kind": "map", "label": "POI 候选", "short": "poi", "score": candidate["score"], "box": {key: candidate[key] for key in ("x", "y", "w", "h")}})
    else:
        findings.append({"kind": "map", "label": "未找到明显地图元素", "short": "no-poi", "score": 0.0})
    return {
        "findings": findings[:max_findings],
        "elements": candidates,
        "metrics": {"poiCandidates": len(candidates), "lineSegments": line_count, "mapLikelihood": round(map_likelihood, 4)},
    }


SCENE_MAP_TERMS = ("地图", "传送", "锚点", "神像", "秘境", "副本", "任务", "标记", "区域", "地区", "七天神像")
SCENE_DIALOGUE_TERMS = ("旅行者", "派蒙", "对话", "冒险家协会", "任务", "你好", "再见", "我们")
SCENE_MENU_TERMS = ("设置", "背包", "任务", "地图", "角色", "武器", "圣遗物", "活动", "商城")


def _text_blocks(lines, width: int, height: int, scale: float = 1.0) -> list[dict]:
    blocks = []
    for line in lines or []:
        try:
            text = str(line.get("text") or "").strip()
            if not text:
                continue
            left = float(line.get("left", 0)) * scale
            top = float(line.get("top", 0)) * scale
            right = float(line.get("right", 0)) * scale
            bottom = float(line.get("bottom", 0)) * scale
        except (TypeError, ValueError):
            continue
        box = _box(left, top, right, bottom, width, height, "text", float(line.get("score", 0.0) or 0.0))
        if not box:
            continue
        box["text"] = text[:120]
        box["textLength"] = len(text)
        blocks.append(box)
    blocks.sort(key=lambda item: (item["y"], item["x"]))
    return blocks[:30]


def _semantic(sections: dict, text_blocks: list[dict], max_findings: int) -> dict:
    composition = sections.get("composition", {})
    ui = sections.get("ui", {})
    map_section = sections.get("map", {})
    metrics = composition.get("metrics", {})
    ui_metrics = ui.get("metrics", {})
    map_metrics = map_section.get("metrics", {})
    text = " ".join(block["text"] for block in text_blocks)
    bottom_text = [block for block in text_blocks if block["y"] + block["h"] / 2 > 0.58]
    map_terms = sum(1 for term in SCENE_MAP_TERMS if term in text)
    dialogue_terms = sum(1 for term in SCENE_DIALOGUE_TERMS if term in text)
    menu_terms = sum(1 for term in SCENE_MENU_TERMS if term in text)
    map_score = min(1.0, float(map_metrics.get("mapLikelihood", 0.0)) + map_terms * 0.12)
    dialogue_score = min(1.0, (len(bottom_text) / 6.0) + dialogue_terms * 0.12)
    menu_score = min(1.0, float(ui_metrics.get("panelCount", 0)) / 6.0 + menu_terms * 0.06)
    if map_score >= 0.55 and map_score >= dialogue_score:
        scene = "map"
        scene_score = map_score
        scene_label = "地图"
    elif dialogue_score >= 0.38 and dialogue_score >= menu_score:
        scene = "dialogue"
        scene_score = dialogue_score
        scene_label = "对话"
    elif menu_score >= 0.35:
        scene = "menu"
        scene_score = menu_score
        scene_label = "菜单"
    else:
        scene = "scene"
        scene_score = max(0.2, 1.0 - max(map_score, dialogue_score, menu_score))
        scene_label = "场景"
    findings = [{
        "kind": "semantic",
        "label": "场景：" + scene_label,
        "short": "scene",
        "score": round(_clip(scene_score), 4),
        "detail": "本地 OCR + 几何启发式；不是模型语义判断",
    }]
    if text_blocks:
        findings.append({
            "kind": "semantic",
            "label": "识别到 " + str(len(text_blocks)) + " 个文字块",
            "short": "text-blocks",
            "score": round(min(1.0, len(text_blocks) / 12.0), 4),
        })
    else:
        findings.append({"kind": "semantic", "label": "没有 OCR 文字块", "short": "no-text", "score": 0.0})

    labeled_pois = []
    for poi in map_section.get("elements", [])[:20]:
        best = None
        best_distance = 1.0
        poi_center_x = poi["x"] + poi["w"] / 2
        poi_center_y = poi["y"] + poi["h"] / 2
        for block in text_blocks:
            center_x = block["x"] + block["w"] / 2
            center_y = block["y"] + block["h"] / 2
            distance = math.hypot(center_x - poi_center_x, center_y - poi_center_y)
            if distance < best_distance:
                best_distance = distance
                best = block
        if best is not None and best_distance <= max(0.08, poi["w"] * 1.6):
            poi["labelText"] = best["text"][:60]
            poi["labelDistance"] = round(best_distance, 4)
            labeled_pois.append({"poi": poi, "text": best["text"][:60]})
            if len(labeled_pois) <= 5:
                findings.append({
                    "kind": "semantic",
                    "label": "POI 标签：" + best["text"][:30],
                    "short": "poi-label",
                    "score": round(best["score"], 4),
                    "box": {key: poi[key] for key in ("x", "y", "w", "h")},
                })

    subject = next((item for item in composition.get("elements", []) if item.get("label") == "subject"), None)
    advice = []
    if subject:
        if subject["x"] < 0.04 or subject["x"] + subject["w"] > 0.96:
            advice.append(("subject-edge", "主体贴近画面边缘，可尝试留出更多空间"))
        if metrics.get("balance", 1.0) < 0.5:
            advice.append(("balance", "视觉重心偏移，可调整主体/高光位置"))
    if metrics.get("contrast", 1.0) < 0.32:
        advice.append(("contrast", "对比度偏低，主体可能不够突出"))
    if ui_metrics.get("panelCount", 0) >= 4:
        advice.append(("ui-density", "面板较多，悬浮窗建议避开右上/右下密集区"))
    if text_blocks:
        average_height = sum(block["h"] for block in text_blocks) / len(text_blocks)
        if average_height < 0.022:
            advice.append(("text-small", "文字块偏小，UI 可读性可能不足"))
    for key, detail in advice[:5]:
        findings.append({"kind": "advice", "label": detail, "short": key, "score": 0.5, "detail": "本地启发式建议"})
    return {
        "findings": findings[:max_findings],
        "elements": text_blocks,
        "metrics": {
            "scene": scene,
            "sceneScore": round(scene_score, 4),
            "textBlocks": len(text_blocks),
            "labelPois": len(labeled_pois),
            "averageTextHeight": round(sum(block["h"] for block in text_blocks) / max(1, len(text_blocks)), 4),
            "mapTerms": map_terms,
            "dialogueTerms": dialogue_terms,
            "menuTerms": menu_terms,
        },
        "labeledPois": labeled_pois,
    }


def analyze(image: np.ndarray, mode: str = "all", max_findings: int = 12, text_lines=None) -> dict:
    normalized_mode = str(mode or "all").strip().lower()
    if normalized_mode not in ("composition", "ui", "map", "semantic", "all"):
        raise ValueError("mode must be composition, ui, map, semantic or all")
    prepared, _scale = _prepare(image)
    height, width = prepared.shape[:2]
    warnings = []
    if width < MIN_ANALYSIS_SIDE or height < MIN_ANALYSIS_SIDE:
        warnings.append("image is small; layout analysis may be unreliable")
    sections = {}
    findings = []
    elements = []
    metrics = {}
    text_blocks = _text_blocks(text_lines, width, height, _scale)
    if normalized_mode in ("composition", "semantic", "all"):
        sections["composition"] = _composition(prepared, max_findings)
        findings.extend(sections["composition"]["findings"])
        elements.extend(sections["composition"]["elements"])
        metrics.update(sections["composition"]["metrics"])
    if normalized_mode in ("ui", "semantic", "all"):
        sections["ui"] = _ui(prepared, max_findings)
        findings.extend(sections["ui"]["findings"])
        elements.extend(sections["ui"]["elements"])
        metrics.update(sections["ui"]["metrics"])
    if normalized_mode in ("map", "semantic", "all"):
        sections["map"] = _map(prepared, max_findings)
        findings.extend(sections["map"]["findings"])
        elements.extend(sections["map"]["elements"])
        metrics.update(sections["map"]["metrics"])
        if sections["map"]["metrics"].get("mapLikelihood", 0) < 0.35:
            warnings.append("map likelihood is low; treat POI candidates as speculative")
    if normalized_mode in ("semantic", "all"):
        sections["semantic"] = _semantic(sections, text_blocks, max_findings)
        findings.extend(sections["semantic"]["findings"])
        elements.extend(sections["semantic"]["elements"])
        metrics.update(sections["semantic"]["metrics"])
        if not text_blocks:
            warnings.append("semantic mode has no OCR text; scene classification is low confidence")
    unique = []
    seen = set()
    for finding in findings:
        key = (finding.get("kind"), finding.get("label"), finding.get("short"))
        if key in seen:
            continue
        seen.add(key)
        unique.append(finding)
    return {
        "mode": normalized_mode,
        "width": int(width),
        "height": int(height),
        "findings": unique[: max(1, int(max_findings)) * 3],
        "elements": elements[:60],
        "metrics": metrics,
        "sections": sections,
        "warnings": warnings,
    }


def annotate(image: np.ndarray, analysis: dict) -> np.ndarray:
    canvas = image.copy()
    height, width = canvas.shape[:2]
    color_subject = (255, 180, 80)
    color_panel = (255, 120, 220)
    color_poi = (80, 220, 160)
    color_text = (255, 220, 120)
    color_grid = (90, 90, 90)
    for index in range(1, 3):
        x = int(width * index / 3)
        y = int(height * index / 3)
        cv2.line(canvas, (x, 0), (x, height), color_grid, 1)
        cv2.line(canvas, (0, y), (width, y), color_grid, 1)
    for element in analysis.get("elements", []):
        try:
            left = int(float(element["x"]) * width)
            top = int(float(element["y"]) * height)
            right = int((float(element["x"]) + float(element["w"])) * width)
            bottom = int((float(element["y"]) + float(element["h"])) * height)
        except Exception:
            continue
        if element.get("panelLabel") or element.get("label") == "panel":
            color = color_panel
            label = "panel"
        elif element.get("label") == "POI?":
            color = color_poi
            label = "poi+" if element.get("labelText") else "poi?"
        elif element.get("label") == "text":
            color = color_text
            label = "text"
        else:
            color = color_subject
            label = "subject"
        cv2.rectangle(canvas, (left, top), (right, bottom), color, 2)
        cv2.putText(canvas, label, (left + 4, max(16, top + 16)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA)
    label = "lore_vision " + str(analysis.get("mode", "all"))
    cv2.rectangle(canvas, (0, 0), (min(width, 260), 28), (18, 20, 26), -1)
    cv2.putText(canvas, label, (8, 19), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (235, 240, 250), 1, cv2.LINE_AA)
    return canvas
