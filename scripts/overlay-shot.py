import time
from pathlib import Path

import cv2

from lore_engine import capture, windows
from _paths import SCRIPTS

windows.set_dpi_awareness()
time.sleep(1.5)
monitors = windows.list_monitors()
monitor = monitors[0] if monitors else {"left": 0, "top": 0, "width": 2560, "height": 1440}
pool = capture.CapturePool()
frame, backend = pool.grab(monitor, 0, "auto")
out = SCRIPTS / "overlay-shot.png"
cv2.imwrite(str(out), frame)
height, width = frame.shape[:2]
crop = frame[0:min(650, height), max(0, width - 1600):width]
cv2.imwrite(str(SCRIPTS / "overlay-shot-crop.png"), crop)
print("WROTE", out, frame.shape, backend)
