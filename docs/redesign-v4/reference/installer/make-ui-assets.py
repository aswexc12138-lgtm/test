#!/usr/bin/env python3
"""生成安装器界面（ui/）用到的水墨素材。素材全部由程序生成，可重复，不用任何外部图片。

用法：
  python3 make-ui-assets.py <LXGWWenKai-Medium.ttf> <ui 目录>

生成：
  paper.png    宣纸纹理（只有透明度，颜色由 CSS 决定；可平铺）
  stroke.png   一笔横画：进度条，左边起笔、右边收笔带飞白（只有透明度，CSS 当遮罩用）
  enso.png     一笔圆（圆相）：完成页，起笔在正上方偏左，顺时针一圈，收笔处留口（同上）
  swipe.png    主按钮底下的一块墨：很宽的一笔横扫（同上）
  wenkai.woff2 霞鹜文楷子集：只含 ui/ 里 index.html 和 app.js 用到的字，字体内部名改为 XuyuWenKaiSubset
               （SIL OFL 1.1 允许子集化和随软件分发；改过的版本不用原名，免得和保留字体名冲突）

改了界面文字以后必须重新运行，否则新字会显示成系统字体（自测见规格 I-29）。
依赖：numpy、Pillow、fontTools、brotli。
"""
import math
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

SEED = 20261012


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def smooth_noise_1d(rng, n, scale, octaves=3):
    """一维平滑噪声，取值约 [0,1]。scale = 一个起伏大概多少个采样点。"""
    out = np.zeros(n)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        step = max(2, int(scale / (2 ** o)))
        knots = rng.random(n // step + 3)
        xs = np.arange(n) / step
        i = xs.astype(int)
        f = xs - i
        f = f * f * (3 - 2 * f)
        out += amp * (knots[i] * (1 - f) + knots[i + 1] * f)
        total += amp
        amp *= 0.5
    return out / total


def save_alpha(alpha, path, blur=0.0, trim_x=False):
    a = np.clip(alpha, 0, 1)
    img = Image.fromarray((a * 255).astype(np.uint8), 'L')
    if blur:
        img = img.filter(ImageFilter.GaussianBlur(blur))
    if trim_x:                                       # 横画：左右裁到有墨的地方，进度 100% 正好写到收笔
        cols = np.nonzero(np.asarray(img).max(axis=0) > 10)[0]
        img = img.crop((max(0, cols[0] - 2), 0, min(img.width, cols[-1] + 3), img.height))
    rgba = Image.new('RGBA', img.size, (0, 0, 0, 0))
    rgba.putalpha(img)
    rgba.save(path, optimize=True)


def brush(along, across, halfwidth, rng, *, bristles=64, dry_from=0.4, dry_power=1.4, drift=0.9,
          slant=0.0, end_from=0.9, wet=0.9, streak_px=(14, 90), n_samples=2048, fill=1.7):
    """一笔 = 很多根笔毛。along：每个像素在笔画上的位置（0 起笔 … 1 收笔）；across：离中线的像素距离（正 = 中线下方/外侧）。
    halfwidth(t) 给半宽。越往后墨越少：dry_from 之后笔毛开始断（飞白），边上的笔毛先干。返回透明度 0..1。"""
    pos = np.linspace(-1, 1, bristles) + rng.uniform(-0.6, 0.6, bristles) / bristles
    load = rng.uniform(0.75, 1.0, bristles) * (1 - 0.22 * np.abs(pos) ** 2)
    grid = np.linspace(0, 1, n_samples)
    dry = smoothstep(dry_from, 1.0, grid) ** dry_power
    tt = np.clip(along, 0, 1)
    hw = halfwidth(along)
    keep = np.ones_like(along)
    inside = (along >= 0) & (along <= 1)
    for k, p in enumerate(pos):
        lo, hi = streak_px
        n = 0.65 * smooth_noise_1d(rng, n_samples, rng.uniform(lo, hi) * n_samples / 1400, 3) \
            + 0.35 * smooth_noise_1d(rng, n_samples, lo * 0.5 * n_samples / 1400, 2)
        n = (n - n.min()) / (n.max() - n.min() + 1e-9)
        level = n * load[k]
        alive = smoothstep(dry - 0.07, dry + 0.07, level)
        begin = 0.004 + slant * (p + 1) / 2
        finish = rng.uniform(end_from, 1.0)
        alive = alive * smoothstep(begin, begin + 0.012, grid) * (1 - smoothstep(finish - 0.015, finish, grid))
        dr = (smooth_noise_1d(rng, n_samples, 160 * n_samples / 1400, 2) - 0.5) * drift
        a = np.interp(tt, grid, alive)
        off = np.interp(tt, grid, dr)
        center = (p * 0.93 + off * 0.12) * hw
        thick = np.maximum(hw * 2.0 / bristles * fill, 0.6)
        d = (across - center) / thick
        c = np.exp(-d * d) * a
        keep *= (1 - np.clip(c, 0, 1))
    alpha = (1 - keep) * inside
    alpha *= wet + (1 - wet) * (1 - smoothstep(0.0, 1.0, tt))                     # 起笔墨最浓
    return alpha


def make_stroke(path, rng):
    W, H = 1400, 96
    ys, xs = np.mgrid[0:H, 0:W].astype(float)
    ml, mr = 18.0, 14.0
    t = (xs - ml) / (W - ml - mr)
    rise = 7.0 * np.clip(t, 0, 1)                                                   # 横画微微右上
    wob = (smooth_noise_1d(rng, W, 500, 2) - 0.5) * 3.0
    cy = H / 2 + 3 - rise + wob[None, :]
    across = ys - cy
    hmax = 19.0

    def halfwidth(tt):
        tt = np.clip(tt, 0, 1)
        entry = np.sqrt(np.clip(1 - ((0.03 - np.minimum(tt, 0.03)) / 0.03) ** 2, 0, 1))   # 起笔圆头
        press = 1 + 0.16 * np.exp(-((tt - 0.035) / 0.03) ** 2)                      # 按笔
        body = 1 - 0.14 * smoothstep(0.08, 0.65, tt)                                # 行笔略细
        splay = 1 + 0.10 * smoothstep(0.7, 0.95, tt)                                # 收笔前笔毛散开
        tip = 1 - 0.35 * smoothstep(0.93, 1.0, tt)
        return hmax * entry * press * body * splay * tip

    alpha = brush(t, across, halfwidth, rng, bristles=70, dry_from=0.5, dry_power=2.2, slant=0.012, end_from=0.95, wet=0.86)
    grain = rng.random((H, W))
    alpha *= 1 - 0.08 * grain
    save_alpha(alpha, path, blur=0.45, trim_x=True)


def make_enso(path, rng):
    S = 360
    ys, xs = np.mgrid[0:S, 0:S].astype(float)
    cx = cy = S / 2
    R = S * 0.355
    dx, dy = xs - cx, ys - cy
    r = np.hypot(dx, dy)
    # 角度：0 在正上方，顺时针增大（和 CSS conic-gradient 一致）
    ang = (np.degrees(np.arctan2(dx, -dy)) + 360) % 360
    start, span = 335.0, 340.0                                                      # 正上方偏左起笔，顺时针 340°
    t = ((ang - start) % 360) / span
    t = np.where(t > 1.02, -1, t)                                                   # 缺口
    wob = (smooth_noise_1d(rng, 2048, 300, 2) - 0.5)
    rr = R * (1 + 0.045 * np.interp(np.clip(t, 0, 1), np.linspace(0, 1, 2048), wob) + 0.035 * np.clip(t, 0, 1))
    across = r - rr
    hmax = S * 0.05

    def halfwidth(tt):
        tt = np.clip(tt, 0, 1)
        entry = np.sqrt(np.clip(tt / 0.03, 0, 1))
        press = 1 + 0.22 * np.exp(-((tt - 0.05) / 0.05) ** 2)
        body = 1 - 0.25 * smoothstep(0.1, 0.8, tt)
        tip = 1 - 0.4 * smoothstep(0.9, 1.0, tt)
        return hmax * entry * press * body * tip

    alpha = brush(t, across, halfwidth, rng, bristles=56, dry_from=0.6, dry_power=2.0, slant=0.0, end_from=0.95, wet=0.88,
                  streak_px=(30, 160))
    save_alpha(alpha, path, blur=0.55)


def make_swipe(path, rng):
    """主按钮底下的一块墨：一笔很宽的横扫，几乎是实心的，只在两头和上下边起毛。"""
    W, H = 900, 150
    ys, xs = np.mgrid[0:H, 0:W].astype(float)
    ml, mr = 10.0, 10.0
    t = (xs - ml) / (W - ml - mr)
    wob = (smooth_noise_1d(rng, W, 600, 2) - 0.5) * 3.0
    across = ys - (H / 2 + wob[None, :])
    hmax = H / 2 - 9

    def halfwidth(tt):
        tt = np.clip(tt, 0, 1)
        entry = np.sqrt(np.clip(1 - ((0.035 - np.minimum(tt, 0.035)) / 0.035) ** 2, 0, 1))
        body = 1 - 0.06 * smoothstep(0.1, 0.9, tt)
        tip = 1 - 0.12 * smoothstep(0.93, 1.0, tt)
        return hmax * (0.78 + 0.22 * entry) * body * tip

    alpha = brush(t, across, halfwidth, rng, bristles=90, dry_from=0.8, dry_power=1.5, drift=1.6,
                  slant=0.02, end_from=0.975, wet=0.97, streak_px=(30, 120), fill=2.6)
    save_alpha(alpha, path, blur=0.5, trim_x=True)


def make_paper(path, rng):
    N = 384
    img = Image.new('L', (N, N), 0)
    from PIL import ImageDraw
    d = ImageDraw.Draw(img)
    # 纤维：短而弯的细线，平铺时在边上续画，保证无缝
    for _ in range(520):
        x, y = rng.uniform(0, N, 2)
        ang = rng.uniform(0, math.pi)
        length = rng.uniform(14, 60)
        bend = rng.uniform(-0.25, 0.25)
        pts = []
        for i in range(8):
            s = i / 7
            a = ang + bend * s
            pts.append((x + math.cos(a) * length * s, y + math.sin(a) * length * s))
        v = int(rng.uniform(18, 48))
        for ox in (-N, 0, N):
            for oy in (-N, 0, N):
                d.line([(px + ox, py + oy) for px, py in pts], fill=v, width=1)
    fib = np.asarray(img.filter(ImageFilter.GaussianBlur(0.45)), dtype=float) / 255
    # 细颗粒 + 很淡的云状起伏（整数周期的正弦叠加，能平铺）
    grain = rng.random((N, N))
    yy, xx = np.mgrid[0:N, 0:N] / N * 2 * math.pi
    cloud = np.zeros((N, N))
    for _ in range(10):
        kx, ky = rng.integers(1, 5, 2)
        cloud += np.sin(kx * xx + ky * yy + rng.uniform(0, 6.28))
    cloud = (cloud - cloud.min()) / (cloud.max() - cloud.min())
    alpha = 0.6 * fib + 0.08 * grain + 0.07 * cloud
    save_alpha(np.clip(alpha, 0, 1) * 0.5, path)


def make_font(ttf, ui_dir, out):
    from fontTools import subset
    from fontTools.ttLib import TTFont
    text = ''
    for name in ('index.html', 'app.js'):
        text += (ui_dir / name).read_text(encoding='utf-8')
    chars = set(ch for ch in text if ord(ch) > 0x2E7F)                     # 所有中日韩字和全角标点
    chars |= set('0123456789%×·→…—.:-+ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    font = TTFont(str(ttf))
    sub = subset.Subsetter(opts)
    sub.populate(text=''.join(sorted(chars)))
    sub.subset(font)
    for rec in font['name'].names:
        if rec.nameID in (1, 3, 4, 6, 16, 17):
            rec.string = {1: 'XuyuWenKaiSubset', 3: 'XuyuWenKaiSubset-1', 4: 'XuyuWenKaiSubset', 6: 'XuyuWenKaiSubset',
                          16: 'XuyuWenKaiSubset', 17: 'Medium'}[rec.nameID]
    font.flavor = 'woff2'
    font.save(str(out))
    return len(chars)


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    ttf, ui_dir = Path(sys.argv[1]), Path(sys.argv[2])
    rng = np.random.default_rng(SEED)
    make_paper(ui_dir / 'paper.png', rng)
    make_stroke(ui_dir / 'stroke.png', rng)
    make_enso(ui_dir / 'enso.png', rng)
    make_swipe(ui_dir / 'swipe.png', rng)
    n = make_font(ttf, ui_dir, ui_dir / 'wenkai.woff2')
    for name in ('paper.png', 'stroke.png', 'enso.png', 'swipe.png', 'wenkai.woff2'):
        print(f'{name:14s} {(ui_dir / name).stat().st_size / 1024:7.1f} KB')
    print(f'字体子集：{n} 个字')


if __name__ == '__main__':
    main()
