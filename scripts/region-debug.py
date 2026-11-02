import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

image = Image.new("RGB", (1600, 600), (20, 20, 25))
draw = ImageDraw.Draw(image)
font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 48)
draw.text((100, 250), "派蒙：旅行者，我们走吧！", font=font, fill=(255, 255, 255))
frame = np.array(image)[:, :, ::-1].copy()
crop = frame[150:540, 80:1520]
gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
gray_mask = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)[1]
white_mask = cv2.inRange(hsv, (0, 0, 185), (180, 90, 255))
gold_mask = cv2.inRange(hsv, (8, 45, 130), (38, 255, 255))
mask = cv2.bitwise_or(gray_mask, white_mask)
mask = cv2.bitwise_or(mask, gold_mask)
basis = max(1, crop.shape[0])
block = int(round(31.0 * basis / 1600.0))
block = max(15, min(51, block))
if block % 2 == 0:
    block += 1
adaptive_c = max(3.0, 7.0 * basis / 1600.0)
adaptive = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, block, adaptive_c)
mask = cv2.bitwise_or(mask, adaptive)
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
count, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)
print("shape", crop.shape, "components", count)
rows_count, cols_count = gray.shape[:2]
min_height = max(2, int(round(rows_count * 0.005)))
max_height = max(12, int(round(rows_count * 0.16)))
max_width = max(24, int(round(cols_count * 0.12)))
max_area = max(300, int(round(rows_count * cols_count * 0.0015)))
print("filters", {"min_height": min_height, "max_height": max_height, "max_width": max_width, "max_area": max_area})
kept = 0
for i in range(1, count):
    x, y, w, h, area = (int(stats[i, k]) for k in (cv2.CC_STAT_LEFT, cv2.CC_STAT_TOP, cv2.CC_STAT_WIDTH, cv2.CC_STAT_HEIGHT, cv2.CC_STAT_AREA))
    reason = []
    if area < 2 or area > max_area: reason.append("area")
    if h < min_height or h > max_height: reason.append("height")
    if w < 1 or w > max_width: reason.append("width")
    if h > 0 and w / h > 5.0: reason.append("aspect")
    if not reason:
        kept += 1
        print("KEEP", i, x, y, w, h, area)
    elif area > 100:
        print("DROP", i, x, y, w, h, area, ",".join(reason))
print("kept", kept)
