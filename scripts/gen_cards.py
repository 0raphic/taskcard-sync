#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 1/8 A4 任务卡片 PDF（A4 每页 2 列 × 4 行 = 8 张，105 × 74.25 mm）。

用法:
  python scripts/gen_cards.py --input cards/tasks.json --output cards/cards.pdf
  python scripts/gen_cards.py --double-sided --base-url http://192.168.1.5:8088
"""
from __future__ import annotations

import argparse
import json
import os
import tempfile
from pathlib import Path

from reportlab.lib.colors import Color, HexColor
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

import qrcode

CARD_W = 105 * mm
CARD_H = 74.25 * mm
PAGE_W = 210 * mm
PAGE_H = 297 * mm
COLS, ROWS = 2, 4

INK = HexColor("#1a1a1a")
SOFT = HexColor("#6b6b6b")
LINE = HexColor("#c9c9c9")
ACCENT = HexColor("#c2410c")

FONT_CANDIDATES = [
    ("CJK", ["C:/Windows/Fonts/msyh.ttc", "/System/Library/Fonts/PingFang.ttc",
             "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc"]),
    ("CJK-Bold", ["C:/Windows/Fonts/msyhbd.ttc", "C:/Windows/Fonts/simhei.ttf",
                  "/System/Library/Fonts/PingFang.ttc",
                  "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc"]),
]


def register_fonts() -> tuple[str, str]:
    regular = bold = None
    for name, paths in FONT_CANDIDATES:
        for p in paths:
            if os.path.exists(p):
                try:
                    pdfmetrics.registerFont(TTFont(name, p, subfontIndex=0))
                    if name == "CJK":
                        regular = name
                    else:
                        bold = name
                    break
                except Exception as exc:  # noqa: BLE001
                    print(f"  ! 字体注册失败 {p}: {exc}")
    if not regular:
        raise SystemExit("找不到中文字体，请安装微软雅黑/黑体/文泉驿后重试")
    return regular, bold or regular


FONT, FONT_B = "CJK", "CJK-Bold"


def wrap(text: str, size: float, max_w: float) -> list[str]:
    """按字符贪心折行（中文没有空格）。"""
    lines, cur = [], ""
    for ch in text:
        if ch == "\n":
            lines.append(cur)
            cur = ""
            continue
        if pdfmetrics.stringWidth(cur + ch, FONT, size) > max_w and cur:
            lines.append(cur)
            cur = ch
        else:
            cur += ch
    if cur:
        lines.append(cur)
    return lines


def text(c, s, x, y, size=8, font=None, color=INK):
    c.setFont(font or FONT, size)
    c.setFillColor(color)
    c.drawString(x, y, s)


def field(c, x, y, w, label, value="", size=7.5):
    text(c, label, x, y, 6.3, color=SOFT)
    lx = x + pdfmetrics.stringWidth(label, FONT, 6.3) + 1.2 * mm
    if value:
        text(c, value, lx, y, size)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.3)
    c.line(lx, y - 1.1 * mm, x + w, y - 1.1 * mm)


def checkbox_row(c, x, y, labels, size=7):
    cx = x
    for lab in labels:
        c.setStrokeColor(SOFT)
        c.setLineWidth(0.5)
        c.rect(cx, y - 0.6 * mm, 2.6 * mm, 2.6 * mm, stroke=1, fill=0)
        text(c, lab, cx + 3.4 * mm, y, size)
        cx += 3.4 * mm + pdfmetrics.stringWidth(lab, FONT, size) + 3 * mm
    return cx


def qr_image(url: str, path: str) -> None:
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M,
                       box_size=10, border=1)
    qr.add_data(url)
    qr.make(fit=True)
    qr.make_image(fill_color="black", back_color="white").save(path)


def card_frame(c, x, y):
    c.setStrokeColor(LINE)
    c.setLineWidth(0.4)
    c.setDash(2, 2)
    c.rect(x, y, CARD_W, CARD_H, stroke=1, fill=0)
    c.setDash()


def draw_qr(c, x, y, url, code):
    size = 19 * mm
    tmp = Path(tempfile.gettempdir()) / f"qr_{code}.png"
    qr_image(url, str(tmp))
    c.drawImage(str(tmp), x, y, size, size, preserveAspectRatio=True, mask="auto")
    text(c, code, x, y - 3.4 * mm, 6.2, color=SOFT)
    c.setFont(FONT, 6.2)
    c.setFillColor(SOFT)
    c.drawCentredString(x + size / 2, y - 7.0 * mm, "扫码更新")


def draw_short(c, x, y, t, url):
    pad = 3.5 * mm
    qr_x = x + CARD_W - pad - 19 * mm
    qr_y = y + CARD_H - pad - 19 * mm
    draw_qr(c, qr_x, qr_y, url, t["code"])

    tw = CARD_W - 2 * pad - 21 * mm
    text(c, "短期任务", x + pad, y + CARD_H - pad - 3.2 * mm, 6.2, color=ACCENT)
    ty = y + CARD_H - pad - 9.5 * mm
    for i, ln in enumerate(wrap(t["title"], 11, tw)[:2]):
        text(c, ln, x + pad, ty - i * 5.2 * mm, 11, font=FONT_B)

    body = y + CARD_H - pad - 22 * mm
    field(c, x + pad, body, tw * 0.55, "截止", t.get("due", "—"), 8)
    field(c, x + pad + tw * 0.6, body, tw * 0.35, "用时", f'{t.get("estimate_min", "?")} 分', 8)

    body -= 7 * mm
    text(c, "描述", x + pad, body, 6.3, color=SOFT)
    for i, ln in enumerate(wrap(t.get("description", ""), 7.5, tw)[:2]):
        text(c, ln, x + pad, body - 4 * mm - i * 3.9 * mm, 7.5)

    body -= 13.5 * mm
    field(c, x + pad, body, tw, "材料", t.get("materials", ""))
    body -= 7 * mm
    field(c, x + pad, body, tw, "备注", t.get("notes", ""))

    body -= 8.5 * mm
    text(c, "状态", x + pad, body, 6.3, color=SOFT)
    checkbox_row(c, x + pad + 8 * mm, body, ["待办", "进行中", "完成", "搁置"], 7)


def draw_long(c, x, y, t, url):
    pad = 3.5 * mm
    qr_x = x + CARD_W - pad - 17 * mm
    qr_y = y + CARD_H - pad - 17 * mm
    draw_qr(c, qr_x, qr_y, url, t["code"])

    tw = CARD_W - 2 * pad - 19 * mm
    text(c, "长期任务", x + pad, y + CARD_H - pad - 3.2 * mm, 6.2, color=ACCENT)
    ty = y + CARD_H - pad - 9.5 * mm
    for i, ln in enumerate(wrap(t["title"], 10.5, tw)[:2]):
        text(c, ln, x + pad, ty - i * 5 * mm, 10.5, font=FONT_B)

    body = y + CARD_H - pad - 21 * mm
    field(c, x + pad, body, tw * 0.45, "开始", t.get("start", "—"), 7.5)
    field(c, x + pad + tw * 0.5, body, tw * 0.45, "截止", t.get("due", "—"), 7.5)

    body -= 7 * mm
    text(c, "目标", x + pad, body, 6.3, color=SOFT)
    for i, ln in enumerate(wrap(t.get("goal", ""), 7.5, tw)[:2]):
        text(c, ln, x + pad, body - 4 * mm - i * 3.9 * mm, 7.5)

    body -= 13 * mm
    text(c, "里程碑", x + pad, body, 6.3, color=SOFT)
    mx = x + pad + 11 * mm
    ms = t.get("milestones", [])[:3]
    for i, m in enumerate(ms):
        c.setStrokeColor(SOFT)
        c.setLineWidth(0.4)
        c.rect(mx, body - 0.7 * mm, 2.4 * mm, 2.4 * mm, stroke=1, fill=0)
        text(c, m, mx + 3.2 * mm, body, 7)
        mx += 3.2 * mm + pdfmetrics.stringWidth(m, FONT, 7) + 3.5 * mm

    body -= 8 * mm
    progress = int(t.get("progress", 0))
    text(c, "进度", x + pad, body, 6.3, color=SOFT)
    bx, bw, bh = x + pad + 11 * mm, tw - 11 * mm - 12 * mm, 3.2 * mm
    c.setStrokeColor(SOFT)
    c.setLineWidth(0.5)
    c.rect(bx, body - 0.6 * mm, bw, bh, stroke=1, fill=0)
    c.setFillColor(ACCENT)
    c.rect(bx, body - 0.6 * mm, bw * progress / 100, bh, stroke=0, fill=1)
    text(c, f"{progress}%", bx + bw + 2 * mm, body, 7.5)

    body -= 7 * mm
    field(c, x + pad, body, tw, "资源", t.get("resources", ""))


def draw_back(c, x, y, t, url):
    pad = 3.5 * mm
    text(c, "复盘 · " + t["title"], x + pad, y + CARD_H - pad - 3.2 * mm, 7.5, font=FONT_B)
    text(c, t["code"], x + CARD_W - pad - 14 * mm, y + CARD_H - pad - 3.2 * mm, 6.2, color=SOFT)

    body = y + CARD_H - pad - 10 * mm
    field(c, x + pad, body, CARD_W * 0.45, "实际用时", "", 7.5)
    field(c, x + pad + CARD_W * 0.5, body, CARD_W * 0.4, "完成日期", "", 7.5)

    body -= 9 * mm
    for label, n in (("今天推进了什么", 3), ("卡在哪", 2), ("下一步", 2)):
        text(c, label, x + pad, body, 6.5, color=SOFT)
        body -= 3.5 * mm
        for _ in range(n):
            c.setStrokeColor(LINE)
            c.setLineWidth(0.3)
            c.line(x + pad, body - 1 * mm, x + CARD_W - pad, body - 1 * mm)
            body -= 5.2 * mm
        body -= 1.5 * mm


def main() -> None:
    import sys
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="cards/tasks.json")
    ap.add_argument("--output", default="cards/cards.pdf")
    ap.add_argument("--base-url", default=None)
    ap.add_argument("--double-sided", action="store_true", help="每页正面后跟一页复盘背面")
    ap.add_argument("--flip", choices=["long", "short"], default="long",
                    help="双面打印翻转方向：long=沿长边（默认），short=沿短边")
    ap.add_argument("--sample", type=int, default=0, help="只生成前 N 张，用于试印")
    ap.add_argument("--codes-out", default="cards/codes.json")
    args = ap.parse_args()

    global FONT, FONT_B
    FONT, FONT_B = register_fonts()

    data = json.loads(Path(args.input).read_text(encoding="utf-8"))
    tasks = data["tasks"]
    if args.sample:
        tasks = tasks[: args.sample]
    base_url = (args.base_url or data.get("base_url", "http://127.0.0.1:8088")).rstrip("/")

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(out), pagesize=(PAGE_W, PAGE_H))
    c.setTitle("任务卡片 1/8 A4")

    per_page = COLS * ROWS
    pages = [tasks[i:i + per_page] for i in range(0, len(tasks), per_page)]
    codes = []

    def cell(col, row):
        return col * CARD_W, PAGE_H - (row + 1) * CARD_H

    for page in pages:
        for idx, t in enumerate(page):
            x, y = cell(idx % COLS, idx // COLS)
            card_frame(c, x, y)
            url = f"{base_url}/t/{t['code']}"
            (draw_long if t["kind"] == "long" else draw_short)(c, x, y, t, url)
            codes.append({"code": t["code"], "task_id": t["id"], "title": t["title"],
                          "url": url})
        c.showPage()

        if args.double_sided:
            for idx, t in enumerate(page):
                col, row = idx % COLS, idx // COLS
                if args.flip == "long":
                    col = COLS - 1 - col
                else:
                    row = ROWS - 1 - row
                x, y = cell(col, row)
                card_frame(c, x, y)
                draw_back(c, x, y, t, f"{base_url}/t/{t['code']}")
            c.showPage()

    c.save()

    Path(args.codes_out).write_text(
        json.dumps({"base_url": base_url, "codes": codes}, ensure_ascii=False, indent=2),
        encoding="utf-8")
    print(f"[ok] 生成 {out}，共 {len(codes)} 张卡")
    print(f"[ok] 短码映射写入 {args.codes_out}")
    print(f"[ok] 二维码指向 {base_url}/t/{{code}}")


if __name__ == "__main__":
    main()
