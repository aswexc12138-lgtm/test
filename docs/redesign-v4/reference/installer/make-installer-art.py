#!/usr/bin/env python3
"""
生成安装器位图（规格 I-02）：左侧大图 sidebar、顶部横幅 header，1 倍和 2 倍各一份。

用法：python3 make-installer-art.py <icon-master.png> <LXGWWenKai-Medium.ttf> <输出目录>
  - icon-master.png：xuyu/build/icon-master.png（1024×1024 应用图标；品牌新图标到位后换成新图标再跑一次）
  - 字体：霞鹜文楷 LXGW WenKai（SIL OFL 1.1），只用来把“胥宇”两个字画进位图，不随安装包分发字体文件
配色取自主题“素 · 白天”（themes.generated.css）。位图里不放小字，避免高 DPI 下被拉伸发糊。
"""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ICON, FONT, OUT = sys.argv[1], sys.argv[2], sys.argv[3].rstrip('/')

INK = (28, 29, 27)          # --text
MUTED = (107, 108, 102)     # --text-3
BG_TOP = (247, 247, 245)    # --bg
BG_BOTTOM = (239, 239, 235)
BORDER = (228, 228, 223)    # --border
ACCENT = (21, 114, 122)     # --accent 品牌青
WHITE = (255, 255, 255)

S = 4  # 先按 4 倍画，再高质量缩小，边缘干净


def vertical_gradient(w, h, top, bottom):
    img = Image.new('RGB', (w, h), top)
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        draw.line([(0, y), (w, y)], fill=tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img


def paste_icon(canvas, size, xy):
    icon = Image.open(ICON).convert('RGBA').resize((size, size), Image.LANCZOS)
    canvas.paste(icon, xy, icon)


def floor_plan(draw, ox, oy, scale, color, width):
    """一张极简平面图：外墙、隔墙、门弧、货架；只做氛围，不表达具体内容。"""
    def r(x0, y0, x1, y1):
        draw.rectangle([int(ox + x0 * scale), int(oy + y0 * scale), int(ox + x1 * scale), int(oy + y1 * scale)], outline=color, width=width)
    def l(x0, y0, x1, y1):
        draw.line([int(ox + x0 * scale), int(oy + y0 * scale), int(ox + x1 * scale), int(oy + y1 * scale)], fill=color, width=width)
    r(0, 0, 150, 120)            # 外墙
    l(0, 70, 58, 70)             # 隔墙
    l(78, 70, 150, 70)
    l(96, 0, 96, 46)
    r(14, 14, 44, 34)            # 收银台
    r(108, 84, 140, 92)          # 货架
    r(108, 100, 140, 108)
    r(14, 84, 30, 110)
    draw.arc([int(ox + 58 * scale), int(oy + 58 * scale), int(ox + 82 * scale), int(oy + 82 * scale)], 180, 270, fill=color, width=width)  # 门


def camera(draw, x, y, radius, fov_color, dot_color):
    draw.pieslice([x - radius * 4, y - radius * 4, x + radius * 4, y + radius * 4], 300, 360, fill=fov_color)
    draw.ellipse([x - radius, y - radius, x + radius, y + radius], fill=WHITE, outline=dot_color, width=max(1, radius // 2))
    draw.ellipse([x - radius // 2, y - radius // 2, x + radius // 2, y + radius // 2], fill=dot_color)


def sidebar():
    w, h = 164 * S, 314 * S
    img = vertical_gradient(w, h, BG_TOP, BG_BOTTOM)
    # 底部平面图氛围层：画在单独一层上，压低透明度
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    k = 0.88  # 平面图整体缩小，左右各留 ~14px，不贴边
    ox, oy = 16, 184
    floor_plan(d, ox * S, oy * S, k * S, ACCENT + (54,), S)
    for (cx, cy) in [(30, 50), (110, 22), (88, 104)]:
        camera(d, int((ox + cx * k) * S), int((oy + cy * k) * S), 3 * S, ACCENT + (26,), ACCENT + (190,))
    img.paste(layer, (0, 0), layer)
    draw = ImageDraw.Draw(img)
    paste_icon(img, 52 * S, (24 * S, 34 * S))
    word = ImageFont.truetype(FONT, 36 * S)
    draw.text((23 * S, 96 * S), '胥宇', font=word, fill=INK)
    latin = ImageFont.truetype(FONT, 10 * S)
    x = 25 * S
    for ch in 'XUYU':  # 字距拉开
        draw.text((x, 146 * S), ch, font=latin, fill=MUTED)
        x += 11 * S
    draw.line([(w - S, 0), (w - S, h)], fill=BORDER, width=S)  # 右侧一道细线，和白色内容区分开
    return img


def header():
    w, h = 150 * S, 57 * S
    img = Image.new('RGB', (w, h), WHITE)  # MUI 头部底色是白色，必须一致，否则出现色块
    draw = ImageDraw.Draw(img)
    word = ImageFont.truetype(FONT, 22 * S)
    text_w = draw.textlength('胥宇', font=word)
    icon_size = 30 * S
    right = w - 12 * S
    tx = right - text_w
    ix = int(tx - 8 * S - icon_size)
    paste_icon(img, icon_size, (ix, (h - icon_size) // 2))
    draw.text((tx, (h - 22 * S) // 2 - 3 * S), '胥宇', font=word, fill=INK)
    return img


def save(img, base, size):
    for scale, suffix in [(1, ''), (2, '@2x')]:
        out = img.resize((size[0] * scale, size[1] * scale), Image.LANCZOS)
        out = out.filter(ImageFilter.UnsharpMask(radius=0.6, percent=60, threshold=2)) if scale == 1 else out
        out.convert('RGB').save(f'{OUT}/{base}{suffix}.bmp')
        out.convert('RGB').save(f'{OUT}/{base}{suffix}.png')


save(sidebar(), 'installer-sidebar', (164, 314))
save(header(), 'installer-header', (150, 57))
print('ok')
