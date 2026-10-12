#!/usr/bin/env python3
"""水墨风格用的两张图，从安装器的水墨素材换色得到（同一套笔触，安装器和软件看起来是一家）。

用法：python3 make-assets.py            （在本目录运行；读 ../../installer/ui/ 里的 paper.png、swipe.png）
生成：
  paper-ink.png    纸纹：深色纤维，给白天 / 护眼（透明度比安装器淡，软件里要长时间看）
  paper-light.png  纸纹：浅色纤维，给夜间
  swipe-ink.png    主按钮的墨块：墨色，给白天 / 护眼
  swipe-paper.png  主按钮的墨块：纸色，给夜间
颜色和主题令牌一致：墨 #1E1C18，夜间的“纸色” #E6DFCF。
"""
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
SRC = HERE.parent.parent / 'installer' / 'ui'


def recolor(src, dst, rgb, alpha_scale=1.0):
    a = np.asarray(Image.open(src).convert('RGBA'))[..., 3].astype(float) * alpha_scale
    out = np.zeros(a.shape + (4,), dtype=np.uint8)
    out[..., 0], out[..., 1], out[..., 2] = rgb
    out[..., 3] = np.clip(a, 0, 255).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(dst, optimize=True)


def main():
    recolor(SRC / 'paper.png', HERE / 'paper-ink.png', (60, 48, 30), 0.30)
    recolor(SRC / 'paper.png', HERE / 'paper-light.png', (236, 230, 216), 0.12)
    recolor(SRC / 'swipe.png', HERE / 'swipe-ink.png', (30, 28, 24))
    recolor(SRC / 'swipe.png', HERE / 'swipe-paper.png', (230, 223, 207))
    for name in ('paper-ink.png', 'paper-light.png', 'swipe-ink.png', 'swipe-paper.png'):
        print(f'{name:16s} {(HERE / name).stat().st_size / 1024:6.1f} KB')


if __name__ == '__main__':
    main()
