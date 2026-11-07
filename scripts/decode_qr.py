"""从图片里解二维码，给 /ds-api/scan 用。

调用方式（服务端 spawn）：
    echo '{"image":"data:image/jpeg;base64,..."}' | python scripts/decode_qr.py

输出（UTF-8）：
    {"ok":true,"codes":["a7K2m9"],"tries":2}
    {"ok":false,"error":"图片读不出来"}
"""
import base64
import json
import sys

import cv2
import numpy as np

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def decode(img):
    det = cv2.QRCodeDetector()
    try:
        ok, codes, _pts, _ = det.detectAndDecodeMulti(img)
        codes = [c for c in (codes or []) if c]
        if codes:
            return codes
    except cv2.error:
        pass
    try:
        text, _pts, _ = det.detectAndDecode(img)
        if text:
            return [text]
    except cv2.error:
        pass
    return []


def main():
    raw = sys.stdin.buffer.read().decode("utf-8", "replace")
    try:
        data = json.loads(raw)
        payload = str(data.get("image") or "")
        b64 = payload.split(",", 1)[-1] if payload.startswith("data:") else payload
        buf = base64.b64decode(b64)
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": f"请求读不出来：{e}"}, ensure_ascii=False))
        return

    img = cv2.imdecode(np.frombuffer(buf, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        print(json.dumps({"ok": False, "error": "图片读不出来（不是常见图片格式？）"}, ensure_ascii=False))
        return

    tries = 0
    rotations = [
        (None, img),
        (cv2.ROTATE_90_CLOCKWISE, cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)),
        (cv2.ROTATE_180, cv2.rotate(img, cv2.ROTATE_180)),
        (cv2.ROTATE_90_COUNTERCLOCKWISE, cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)),
    ]
    for _mode, candidate in rotations:
        tries += 1
        codes = decode(candidate)
        if codes:
            print(json.dumps({"ok": True, "codes": codes, "tries": tries}, ensure_ascii=False))
            return

    # 小图放大再试一次（手机照片一般不用，但截图/缩略图会）
    h, w = img.shape[:2]
    if max(h, w) < 1200:
        tries += 1
        big = cv2.resize(img, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
        codes = decode(big)
        if codes:
            print(json.dumps({"ok": True, "codes": codes, "tries": tries}, ensure_ascii=False))
            return

    print(json.dumps({"ok": True, "codes": [], "tries": tries}, ensure_ascii=False))


if __name__ == "__main__":
    main()
