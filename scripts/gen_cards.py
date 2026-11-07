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
    est = t.get("estimate_min")
    field(c, x + pad + tw * 0.6, body, tw * 0.35, "用时", f"{est} 分" if est else "____ 分", 8)

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


# ---------- 空白表：CSGO 印花集 / 工业蓝图风 ----------
# 方法论：短期 = 优先级 + 完成标准（DoD）+ 时间盒（开始/截止）+ 任务状态
#         长期 = 目标 + 周期 + 周投入 + 短期里程碑 + 任务状态

PINK = Color(1.0, 0.36, 0.72)
PURPLE = Color(0.58, 0.42, 1.0)
CYAN = Color(0.35, 0.86, 1.0)
HAIR = HexColor("#111111")


def rule(c, x1, x2, y, w=0.4, color=HAIR):
    c.setStrokeColor(color)
    c.setLineWidth(w)
    c.line(x1, y, x2, y)


def label(c, s, x, y, size=5.4, color=SOFT):
    text(c, s, x, y, size, color=color)


def tiny(c, s, x, y, size=3.6, color=SOFT, align="l"):
    c.setFont("Courier", size)
    c.setFillColor(color)
    if align == "r":
        c.drawRightString(x, y, s)
    elif align == "c":
        c.drawCentredString(x, y, s)
    else:
        c.drawString(x, y, s)


def small_box(c, x, y, size=2.2, color=HAIR):
    c.setStrokeColor(color)
    c.setLineWidth(0.5)
    c.rect(x, y - 0.55 * mm, size * mm, size * mm, stroke=1, fill=0)
    return x + (size + 1.2) * mm


def chips(c, x, y, labels, size=5.0, gap=3.0 * mm):
    cx = x
    for lab in labels:
        cx = small_box(c, cx, y)
        text(c, lab, cx, y, size, color=SOFT)
        cx += pdfmetrics.stringWidth(lab, FONT, size) + gap
    return cx


def crosshair(c, x, y, s=1.6 * mm):
    c.setStrokeColor(HAIR)
    c.setLineWidth(0.35)
    c.line(x - s, y, x + s, y)
    c.line(x, y - s, x, y + s)


def corners(c, x, y, inset=1.6 * mm):
    crosshair(c, x + inset, y + inset, 1.1 * mm)
    crosshair(c, x + CARD_W - inset, y + inset, 1.1 * mm)
    crosshair(c, x + inset, y + CARD_H - inset, 1.1 * mm)
    crosshair(c, x + CARD_W - inset, y + CARD_H - inset, 1.1 * mm)


def barcode(c, x, y, w, h, seed_text, gap=0.9 * mm):
    """确定性伪随机条码 + 三条低饱和镭射渐变。"""
    seed = sum(ord(ch) * (i + 7) for i, ch in enumerate(seed_text)) or 7
    bars = []
    used = 0.0
    i = 0
    while used < w - gap:
        seed = (seed * 1103515245 + 12345) % 2147483648
        bw = [0.22, 0.34, 0.5][seed % 3] * mm
        if used + bw > w - gap:
            break
        bars.append((x + used, bw, (seed >> 5) % 4 != 0))
        used += bw + (0.26 + 0.14 * (i % 3)) * mm
        i += 1
    for bx, bw, on in bars:
        if on:
            c.setFillColor(HAIR)
            c.rect(bx, y, bw, h, stroke=0, fill=1)
    # 镭射条纹：低饱和、半透明，压在条码上
    for j, col in enumerate((PINK, PURPLE, CYAN)):
        c.saveState()
        c.setFillAlpha(0.32)
        c.setFillColor(col)
        c.rect(x + 2 * mm, y + h * (0.2 + j * 0.26), w * 0.62, 0.32 * mm, stroke=0, fill=1)
        c.restoreState()


def pixels(c, x, y, cols=8, rows=3, step=1.15 * mm, size=0.62 * mm):
    c.setFillColor(HAIR)
    for ix in range(cols):
        for iy in range(rows):
            if (ix * 5 + iy * 3 + ix * iy) % 4 == 0:
                c.rect(x + ix * step, y + iy * step, size, size, stroke=0, fill=1)


def heart(c, x, y, size=2.4 * mm):
    c.setFillColor(HAIR)
    p = c.beginPath()
    s = size
    p.moveTo(x, y)
    p.curveTo(x - s, y + s * 0.9, x - s, y + s * 1.9, x, y + s * 1.45)
    p.curveTo(x + s, y + s * 1.9, x + s, y + s * 0.9, x, y)
    c.drawPath(p, stroke=0, fill=1)


def serial(code: str) -> str:
    h = sum(ord(ch) for ch in code) * 97 % 10000
    return f"TC/{code.upper()}/{h:04d}"


def xxy(c, x, y, size=12, color=HAIR, track=0.06):
    """几何字标：手动加字距。"""
    cx = x
    for ch in "XXY":
        c.setFont(FONT_B, size)
        c.setFillColor(color)
        c.drawString(cx, y, ch)
        cx += pdfmetrics.stringWidth(ch, FONT_B, size) + size * track


def draw_qr_compact(c, x, y, url, code, size_mm=16.5):
    size = size_mm * mm
    tmp = Path(tempfile.gettempdir()) / f"qr_{code}.png"
    qr_image(url, str(tmp))
    c.drawImage(str(tmp), x, y, size, size, preserveAspectRatio=True, mask="auto")
    text(c, code, x, y - 3.2 * mm, 5.6, color=SOFT)


def blank_head(c, x, y, title, kind_label, code):
    pad = 3.0 * mm
    top = y + CARD_H - pad
    xxy(c, x + pad, top - 4.4 * mm, 11)
    tiny(c, "TASK CARD / XXY-01", x + pad + 20 * mm, top - 1.6 * mm, 3.2, SOFT)
    text(c, title, x + pad + 20 * mm, top - 4.6 * mm, 5.4, color=SOFT)
    tiny(c, "SHORT 1:8 A4" if kind_label == "短期" else "LONG 1:8 A4",
         x + CARD_W - pad, top - 1.6 * mm, 3.2, SOFT, "r")


def blank_footer(c, x, y, code):
    pad = 3.0 * mm
    barcode(c, x + pad, y + 2.2 * mm, 34 * mm, 3.4 * mm, code)
    tiny(c, "// XXY.PRINT  " + serial(code), x + pad + 36 * mm, y + 3.2 * mm, 3.0, SOFT)
    heart(c, x + CARD_W - pad - 3 * mm, y + 2.6 * mm, 2.2 * mm)
    pixels(c, x + pad + 36 * mm, y + 5.6 * mm, 5, 1, 1.2 * mm, 0.5 * mm)


def draw_blank_short(c, x, y, code, url):
    pad = 3.0 * mm
    qsize = 16.5 * mm
    right_w = CARD_W - 2 * pad - qsize - 2.5 * mm
    qx = x + CARD_W - pad - qsize
    qy = y + CARD_H - 7 * mm - qsize
    corners(c, x, y)

    blank_head(c, x, y, "任务卡", "短期", code)
    draw_qr_compact(c, qx, qy, url, code, 16.5)

    # 任务名称
    label(c, "任务名称", x + pad, y + CARD_H - 12.6 * mm)
    rule(c, x + pad, x + pad + right_w, y + CARD_H - 17.4 * mm, 0.5)
    rule(c, x + pad, x + pad + right_w, y + CARD_H - 22.0 * mm, 0.5)

    # 优先级
    py = y + CARD_H - 27.6 * mm
    label(c, "优先级", x + pad, py)
    chips(c, x + pad + 11 * mm, py, ("重要且紧急", "重要不紧急", "紧急不重要", "其他"), 4.8, 2.4 * mm)

    # 开始 / 截止
    ry = y + CARD_H - 33.4 * mm
    label(c, "开始", x + pad, ry)
    rule(c, x + pad + 8.5 * mm, x + pad + 32 * mm, ry - 0.7 * mm)
    label(c, "截止", x + pad + 38 * mm, ry)
    rule(c, x + pad + 46.5 * mm, x + pad + 70 * mm, ry - 0.7 * mm)

    # 完成标准（两行）
    dy = y + CARD_H - 39.0 * mm
    label(c, "完成标准", x + pad, dy)
    rule(c, x + pad + 14 * mm, x + CARD_W - pad, dy - 0.7 * mm, 0.4)
    rule(c, x + pad, x + CARD_W - pad, dy - 6.2 * mm, 0.35)

    # 材料 / 备注
    label(c, "材料", x + pad, y + CARD_H - 52.6 * mm)
    rule(c, x + pad + 8.5 * mm, x + CARD_W - pad, y + CARD_H - 53.2 * mm)
    label(c, "备注", x + pad, y + CARD_H - 57.8 * mm)
    rule(c, x + pad + 8.5 * mm, x + CARD_W - pad, y + CARD_H - 58.4 * mm)

    # 任务状态
    sy = y + CARD_H - 63.6 * mm
    label(c, "任务状态", x + pad, sy)
    chips(c, x + pad + 14 * mm, sy, ("待办", "进行中", "完成", "搁置"), 5.0, 3.4 * mm)

    blank_footer(c, x, y, code)


def draw_blank_long(c, x, y, code, url):
    pad = 3.0 * mm
    qsize = 16.5 * mm
    right_w = CARD_W - 2 * pad - qsize - 2.5 * mm
    qx = x + CARD_W - pad - qsize
    qy = y + CARD_H - 7 * mm - qsize
    corners(c, x, y)

    blank_head(c, x, y, "目标卡", "长期", code)
    draw_qr_compact(c, qx, qy, url, code, 16.5)

    # 任务名称
    label(c, "任务名称", x + pad, y + CARD_H - 12.6 * mm)
    rule(c, x + pad, x + pad + right_w, y + CARD_H - 17.4 * mm, 0.5)
    rule(c, x + pad, x + pad + right_w, y + CARD_H - 21.6 * mm, 0.5)

    # 目标
    label(c, "目标", x + pad, y + CARD_H - 27.0 * mm)
    rule(c, x + pad, x + CARD_W - pad, y + CARD_H - 31.6 * mm, 0.5)
    rule(c, x + pad, x + CARD_W - pad, y + CARD_H - 35.6 * mm, 0.4)

    # 周期
    cy = y + CARD_H - 40.8 * mm
    label(c, "周期", x + pad, cy)
    label(c, "起", x + pad + 8 * mm, cy, 4.8)
    rule(c, x + pad + 11 * mm, x + pad + 26 * mm, cy - 0.7 * mm)
    label(c, "止", x + pad + 29 * mm, cy, 4.8)
    rule(c, x + pad + 32 * mm, x + pad + 47 * mm, cy - 0.7 * mm)

    # 周投入
    wy = y + CARD_H - 46.2 * mm
    label(c, "周投入", x + pad, wy)
    rule(c, x + pad + 12 * mm, x + pad + 24 * mm, wy - 0.7 * mm)
    label(c, "小时 / 周", x + pad + 25 * mm, wy, 4.8)

    # 状态
    sy = y + CARD_H - 51.4 * mm
    label(c, "任务状态", x + pad, sy)
    chips(c, x + pad + 14 * mm, sy, ("待办", "进行中", "完成", "搁置"), 5.0, 3.4 * mm)

    # 短期里程碑（3 条）
    label(c, "短期里程碑", x + pad, y + CARD_H - 56.6 * mm)
    for i in range(3):
        my = y + CARD_H - (60.6 + i * 3.2) * mm
        bx = small_box(c, x + pad, my)
        rule(c, bx + 0.6 * mm, x + CARD_W - pad, my - 0.7 * mm, 0.35)

    blank_footer(c, x, y, code)


def draw_blank_back(c, x, y, code):
    pad = 3.0 * mm
    corners(c, x, y)
    top = y + CARD_H - pad

    # 大 XXY 水印（浅灰，当印刷纹理用）+ 复盘标题
    xxy(c, x + 8 * mm, y + 9.5 * mm, 30, color=HexColor("#e6e6e6"))
    xxy(c, x + pad, top - 4.6 * mm, 11)
    text(c, "复盘卡", x + pad + 20 * mm, top - 4.8 * mm, 5.4, color=SOFT)
    tiny(c, "REVIEW / " + serial(code), x + CARD_W - pad, top - 1.8 * mm, 3.2, SOFT, "r")

    # 实际用时 / 完成日期
    ry = y + CARD_H - 12.4 * mm
    label(c, "实际用时", x + pad, ry)
    rule(c, x + pad + 15 * mm, x + pad + 32 * mm, ry - 0.7 * mm)
    label(c, "完成日期", x + pad + 38 * mm, ry)
    rule(c, x + pad + 53 * mm, x + pad + 72 * mm, ry - 0.7 * mm)

    # 三行复盘
    body = y + CARD_H - 20.2 * mm
    for lab in ("做成了什么", "卡在哪 / 为什么", "下次怎么改"):
        label(c, lab, x + pad, body)
        rule(c, x + pad + 22 * mm, x + CARD_W - pad, body - 0.7 * mm, 0.35)
        rule(c, x + pad, x + CARD_W - pad, body - 6.4 * mm, 0.3)
        body -= 11.4 * mm

    # 装饰
    barcode(c, x + pad, y + 2.4 * mm, 40 * mm, 3.4 * mm, code)
    tiny(c, "// XXY.REVIEW  0x%04X" % (abs(hash(code)) % 0xFFFF), x + pad + 42 * mm, y + 3.4 * mm, 3.0, SOFT)
    heart(c, x + CARD_W - pad - 3 * mm, y + 2.8 * mm, 2.2 * mm)
    pixels(c, x + pad + 42 * mm, y + 6.0 * mm, 4, 1, 1.2 * mm, 0.5 * mm)


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

    if args.input == "-":
        # 服务端打印流程：JSON 从 stdin 进来，不用落输入文件
        # 必须按 UTF-8 从 buffer 读：Windows 上 sys.stdin 默认走 cp936，中文会变成乱码
        data = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    else:
        data = json.loads(Path(args.input).read_text(encoding="utf-8"))
    blank = bool(data.get("blank"))
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
            if blank:
                (draw_blank_long if t["kind"] == "long" else draw_blank_short)(c, x, y, t["code"], url)
            else:
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
                if blank:
                    draw_blank_back(c, x, y, t["code"])
                else:
                    draw_back(c, x, y, t, f"{base_url}/t/{t['code']}")
            c.showPage()

    c.save()

    if args.codes_out:
        Path(args.codes_out).write_text(
            json.dumps({"base_url": base_url, "codes": codes}, ensure_ascii=False, indent=2),
            encoding="utf-8")
    print(f"[ok] 生成 {out}，共 {len(codes)} 张卡")
    if args.codes_out:
        print(f"[ok] 短码映射写入 {args.codes_out}")
    print(f"[ok] 二维码指向 {base_url}/t/{{code}}")


if __name__ == "__main__":
    main()
