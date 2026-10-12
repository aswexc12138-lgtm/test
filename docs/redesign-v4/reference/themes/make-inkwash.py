#!/usr/bin/env python3
"""第 10 套风格“水墨”的源数据和生成器。生成 inkwash.css，并按规格 T-07 自动校验对比度，不达标就报错、不生成。

用法：python3 make-inkwash.py            （在本目录运行）

为什么单独一个文件：其余 9 套是从演示页原样提取的（themes.generated.css，不许手改）；水墨是 2026-10-12 用户新要的，
演示页里没有。改水墨的颜色就改本文件里的 PALETTE，再运行一次。

水墨的意思：
  白天 = 宣纸上的墨；夜间 = 墨底上的白（像拓片）；护眼 = 放旧了的纸。
  主按钮是一笔横扫的墨块（inkwash/swipe-*.png），永远是墨色（夜间是纸色），不跟强调色；
  强调色（跟随风格时是“花青”）只管选中、焦点、链接、当前项。
  三种国画颜料各管一件事：赭石 = 提醒，胭脂 = 出错，石绿 = 成功。
  直角为主（2–5px 圆角），没有高光，阴影像纸叠在纸上。
  大标题和统计数字用 Windows 自带的楷体（KaiTi），不另带字体文件；正文仍是微软雅黑。
"""
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# 新令牌：所有风格都要有默认值（接入时放进基础令牌），水墨覆盖它们。规格 T-10。
NEW_TOKEN_DEFAULTS = {
    '--btn-primary-border': 'var(--accent)',
    '--font-display': 'var(--font-sans)',
    '--fw-display': 'var(--fw-semibold)',
    '--ls-display': '0',
    '--on-primary': 'var(--on-accent)',
}

SHARED = {
    '--btn-radius': 'var(--r-md)',
    '--btn-border-color': 'var(--border)',
    '--float-border': '1px solid var(--border)',
    '--float-highlight': 'none',
    '--accent-line': 'var(--accent)',
    '--backdrop-size': 'auto',
    '--btn-press-x': '0px',
    '--r-sm': '2px',
    '--r-md': '3px',
    '--r-lg': '5px',
    '--btn-border-w': '1px',
    '--btn-shadow': 'none',
    '--btn-shadow-hover': 'none',
    '--btn-press-scale': '0.98',
    '--btn-press-y': '1px',
    '--btn-primary-shadow': 'none',
    '--btn-primary-border': 'transparent',
    '--float-blur': '0px',
    '--focus-w': '2px',
    '--ease-spring': 'cubic-bezier(0.3, 1.25, 0.6, 1)',       # 比其他风格少弹一点：墨是静的
    # 纸面颜色不跟主题（规格 T-06），与其他风格相同
    '--paper-ink': '#1C1D1B',
    '--paper-point': '#15727A',
    '--paper-canvas': '#7657A9',
    '--paper-select': '#15727A',
    '--font-display': '"KaiTi", "STKaiti", "AR PL UKai CN", var(--font-sans)',
    '--fw-display': '400',                                   # 楷体只有常规字重，不许加粗
    '--ls-display': '0.04em',
}

LIGHT_SHADOW = '60 45 20'
PALETTE = {
    'day': {
        'color-scheme': 'light',
        '--bg': '#ECE6D8', '--surface': '#F6F2E8', '--surface-2': '#EFEADD', '--surface-3': '#E6DFCF',
        '--border': '#DCD3C1', '--border-strong': '#857D6E', '--border-strong-soft': '#DCD3C1',
        '--text': '#1E1C18', '--text-2': '#4E493F', '--text-3': '#655F53', '--text-disabled': '#ADA594',
        '--canvas-bg': '#E4DCCB', '--paper': '#FFFFFF',
        '--accent': '#2B5573', '--accent-top': '#34607F', '--accent-hover': '#234962', '--accent-press': '#1B3A4F',
        '--on-accent': '#F7F4EC', '--accent-soft': '#E1E7E8', '--accent-text': '#2B5573', '--accent-2': '#2B5573',
        '--warn': '#A0612B', '--warn-text': '#7F4A1E', '--warn-soft': '#F3E6D4',
        '--danger': '#A3363D', '--danger-hover': '#8C2C33', '--on-danger': '#FFFFFF', '--danger-text': '#972F36', '--danger-soft': '#F5E3E1',
        '--success': '#3B7A57', '--success-text': '#2F6649', '--success-soft': '#E2EEE5',
        '--info': '#2F5F8A', '--info-text': '#2F5F8A', '--info-soft': '#E1E9F0',
        '--role-point': '#2B5573', '--role-point-soft': '#E1E7E8',
        '--role-canvas': '#6B4868', '--role-canvas-text': '#5E3F5C', '--role-canvas-soft': '#EEE5EC',
        '--mod-desk-fg': '#2B5573', '--mod-desk-bg': '#E1E7E8', '--mod-files-fg': '#2F5F8A', '--mod-files-bg': '#E1E9F0',
        '--mod-draw-fg': '#5E3F5C', '--mod-draw-bg': '#EEE5EC', '--mod-task-fg': '#7F4A1E', '--mod-task-bg': '#F3E6D4',
        '--mod-perf-fg': '#2F6649', '--mod-perf-bg': '#E2EEE5', '--mod-conf-fg': '#4E493F', '--mod-conf-bg': '#E9E4D8',
        '--paper-line': '#C9CAC4', '--switch-thumb': '#FBF9F3', '--scrim': 'rgb(30 26 20 / 0.30)',
        '--float-bg': '#F6F2E8', '--float-bg-solid': '#F6F2E8', '--btn-bg': '#FAF7F0', '--btn-bg-hover': '#F0EADD',
        '--role-list': '#655F53', '--role-list-soft': '#EFEADD',
        '--btn-shadow-press': f'inset 0 1px 2px rgb({LIGHT_SHADOW} / 0.16)',
        '--btn-primary-bg': 'url("inkwash/swipe-ink.png") center / 100% 100% no-repeat',
        '--btn-primary-bg-hover': 'url("inkwash/swipe-ink.png") center / 104% 112% no-repeat',
        '--shadow-lift': f'0 1px 2px rgb({LIGHT_SHADOW} / 0.07), 0 2px 6px rgb({LIGHT_SHADOW} / 0.06)',
        '--shadow-float': f'0 8px 22px rgb({LIGHT_SHADOW} / 0.10), 0 1px 3px rgb({LIGHT_SHADOW} / 0.08)',
        '--shadow-pop': f'0 6px 18px rgb({LIGHT_SHADOW} / 0.12), 0 1px 3px rgb({LIGHT_SHADOW} / 0.08)',
        '--shadow-modal': f'0 18px 50px rgb({LIGHT_SHADOW} / 0.18), 0 3px 8px rgb({LIGHT_SHADOW} / 0.10)',
        '--shadow-drag': f'0 10px 26px rgb({LIGHT_SHADOW} / 0.18), 0 2px 6px rgb({LIGHT_SHADOW} / 0.10)',
        '--shadow-thumb': f'0 1px 2px rgb({LIGHT_SHADOW} / 0.22)',
        '--float-shadow': f'0 8px 22px rgb({LIGHT_SHADOW} / 0.10), 0 1px 3px rgb({LIGHT_SHADOW} / 0.08)',
        # 工作区两角各一团极淡的墨气；纸纹铺在应用底色、浮窗、面板上（不进图纸纸面）
        '--backdrop': 'radial-gradient(ellipse 60% 45% at 100% 100%, rgb(30 28 24 / 0.07), transparent 70%), '
                      'radial-gradient(ellipse 40% 30% at 0% 0%, rgb(30 28 24 / 0.04), transparent 70%)',
        '--texture': 'url("inkwash/paper-ink.png")',
    },
    'night': {
        'color-scheme': 'dark',
        '--bg': '#12110E', '--surface': '#1B1915', '--surface-2': '#221F1A', '--surface-3': '#2B2822',
        '--border': '#34302A', '--border-strong': '#7A7366', '--border-strong-soft': '#34302A',
        '--text': '#ECE6D8', '--text-2': '#BEB7A7', '--text-3': '#9C9585', '--text-disabled': '#5D584E',
        '--canvas-bg': '#0E0D0B', '--paper': '#E9E6DE',
        '--accent': '#8FB4CF', '--accent-top': '#9CBED6', '--accent-hover': '#A6C6DC', '--accent-press': '#7AA2BF',
        '--on-accent': '#10171D', '--accent-soft': '#1B262E', '--accent-text': '#9CC0D9', '--accent-2': '#8FB4CF',
        '--warn': '#D9A26F', '--warn-text': '#D9A26F', '--warn-soft': '#2A2017',
        '--danger': '#E08A8F', '--danger-hover': '#EA9DA1', '--on-danger': '#1A0C0D', '--danger-text': '#EE9BA0', '--danger-soft': '#2D1A1B',
        '--success': '#7DC29C', '--success-text': '#7DC29C', '--success-soft': '#16261D',
        '--info': '#93B3D6', '--info-text': '#93B3D6', '--info-soft': '#18222B',
        '--role-point': '#8FB4CF', '--role-point-soft': '#1B262E',
        '--role-canvas': '#C9A3C4', '--role-canvas-text': '#D4B0CF', '--role-canvas-soft': '#2A1F29',
        '--mod-desk-fg': '#8FB4CF', '--mod-desk-bg': '#1B262E', '--mod-files-fg': '#93B3D6', '--mod-files-bg': '#18222B',
        '--mod-draw-fg': '#D4B0CF', '--mod-draw-bg': '#2A1F29', '--mod-task-fg': '#D9A26F', '--mod-task-bg': '#2A2017',
        '--mod-perf-fg': '#7DC29C', '--mod-perf-bg': '#16261D', '--mod-conf-fg': '#BEB7A7', '--mod-conf-bg': '#24211C',
        '--paper-line': '#B9BAB4', '--switch-thumb': '#ECE6D8', '--scrim': 'rgb(0 0 0 / 0.55)',
        '--float-bg': '#1B1915', '--float-bg-solid': '#1B1915', '--btn-bg': '#211E19', '--btn-bg-hover': '#2A2620',
        '--role-list': '#9C9585', '--role-list-soft': '#221F1A',
        '--btn-shadow-press': 'inset 0 1px 2px rgb(0 0 0 / 0.45)',
        '--btn-primary-bg': 'url("inkwash/swipe-paper.png") center / 100% 100% no-repeat',
        '--btn-primary-bg-hover': 'url("inkwash/swipe-paper.png") center / 104% 112% no-repeat',
        '--shadow-lift': '0 1px 2px rgb(0 0 0 / 0.40), 0 2px 6px rgb(0 0 0 / 0.30)',
        '--shadow-float': '0 10px 28px rgb(0 0 0 / 0.45), 0 1px 3px rgb(0 0 0 / 0.40)',
        '--shadow-pop': '0 8px 22px rgb(0 0 0 / 0.50), 0 1px 3px rgb(0 0 0 / 0.40)',
        '--shadow-modal': '0 20px 56px rgb(0 0 0 / 0.60), 0 3px 8px rgb(0 0 0 / 0.45)',
        '--shadow-drag': '0 12px 30px rgb(0 0 0 / 0.55), 0 2px 6px rgb(0 0 0 / 0.45)',
        '--shadow-thumb': '0 1px 2px rgb(0 0 0 / 0.50)',
        '--float-shadow': '0 10px 28px rgb(0 0 0 / 0.45), 0 1px 3px rgb(0 0 0 / 0.40)',
        '--backdrop': 'radial-gradient(ellipse 60% 45% at 100% 100%, rgb(236 230 216 / 0.035), transparent 70%), '
                      'radial-gradient(ellipse 40% 30% at 0% 0%, rgb(236 230 216 / 0.025), transparent 70%)',
        '--texture': 'url("inkwash/paper-light.png")',
    },
    'eye': {
        'color-scheme': 'light',
        '--bg': '#E6DCC6', '--surface': '#F1E9D7', '--surface-2': '#E9E0CB', '--surface-3': '#DFD4BC',
        '--border': '#D5C9AF', '--border-strong': '#7F745E', '--border-strong-soft': '#D5C9AF',
        '--text': '#29241B', '--text-2': '#554C3E', '--text-3': '#62594A', '--text-disabled': '#A99E87',
        '--canvas-bg': '#DED3BA', '--paper': '#FBF8F0',
        '--accent': '#2D5670', '--accent-top': '#365F7A', '--accent-hover': '#244A61', '--accent-press': '#1C3B4E',
        '--on-accent': '#F6F0E2', '--accent-soft': '#DCE0DA', '--accent-text': '#2D5670', '--accent-2': '#2D5670',
        '--warn': '#9A5B26', '--warn-text': '#7A4719', '--warn-soft': '#EEDDC2',
        '--danger': '#9E3239', '--danger-hover': '#872A30', '--on-danger': '#FFFFFF', '--danger-text': '#922E34', '--danger-soft': '#F0DCD5',
        '--success': '#3A7553', '--success-text': '#2E6146', '--success-soft': '#DCE6D6',
        '--info': '#2F5A80', '--info-text': '#2F5A80', '--info-soft': '#DCE2E4',
        '--role-point': '#2D5670', '--role-point-soft': '#DCE0DA',
        '--role-canvas': '#694665', '--role-canvas-text': '#5B3D58', '--role-canvas-soft': '#E8DDDF',
        '--mod-desk-fg': '#2D5670', '--mod-desk-bg': '#DCE0DA', '--mod-files-fg': '#2F5A80', '--mod-files-bg': '#DCE2E4',
        '--mod-draw-fg': '#5B3D58', '--mod-draw-bg': '#E8DDDF', '--mod-task-fg': '#7A4719', '--mod-task-bg': '#EEDDC2',
        '--mod-perf-fg': '#2E6146', '--mod-perf-bg': '#DCE6D6', '--mod-conf-fg': '#554C3E', '--mod-conf-bg': '#E4DAC6',
        '--paper-line': '#C9CAC4', '--switch-thumb': '#F8F3E7', '--scrim': 'rgb(40 32 18 / 0.30)',
        '--float-bg': '#F1E9D7', '--float-bg-solid': '#F1E9D7', '--btn-bg': '#F5EEDF', '--btn-bg-hover': '#EBE2CF',
        '--role-list': '#62594A', '--role-list-soft': '#E9E0CB',
        '--btn-shadow-press': f'inset 0 1px 2px rgb({LIGHT_SHADOW} / 0.18)',
        '--btn-primary-bg': 'url("inkwash/swipe-ink.png") center / 100% 100% no-repeat',
        '--btn-primary-bg-hover': 'url("inkwash/swipe-ink.png") center / 104% 112% no-repeat',
        '--shadow-lift': f'0 1px 2px rgb({LIGHT_SHADOW} / 0.08), 0 2px 6px rgb({LIGHT_SHADOW} / 0.07)',
        '--shadow-float': f'0 8px 22px rgb({LIGHT_SHADOW} / 0.12), 0 1px 3px rgb({LIGHT_SHADOW} / 0.09)',
        '--shadow-pop': f'0 6px 18px rgb({LIGHT_SHADOW} / 0.14), 0 1px 3px rgb({LIGHT_SHADOW} / 0.09)',
        '--shadow-modal': f'0 18px 50px rgb({LIGHT_SHADOW} / 0.20), 0 3px 8px rgb({LIGHT_SHADOW} / 0.11)',
        '--shadow-drag': f'0 10px 26px rgb({LIGHT_SHADOW} / 0.20), 0 2px 6px rgb({LIGHT_SHADOW} / 0.11)',
        '--shadow-thumb': f'0 1px 2px rgb({LIGHT_SHADOW} / 0.24)',
        '--float-shadow': f'0 8px 22px rgb({LIGHT_SHADOW} / 0.12), 0 1px 3px rgb({LIGHT_SHADOW} / 0.09)',
        '--backdrop': 'radial-gradient(ellipse 60% 45% at 100% 100%, rgb(41 36 27 / 0.07), transparent 70%), '
                      'radial-gradient(ellipse 40% 30% at 0% 0%, rgb(41 36 27 / 0.04), transparent 70%)',
        '--texture': 'url("inkwash/paper-ink.png")',
    },
}

# 跟强调色有关的令牌：只在“跟随风格”（没有 data-accent）时由水墨提供；用户选了强调色就交给强调色规则，
# 这样 inkwash.css 放在 themes.generated.css 前面或后面都不会盖掉用户选的强调色。
ACCENT_KEYS = ['--accent', '--accent-top', '--accent-hover', '--accent-press', '--on-accent', '--accent-soft', '--accent-text', '--accent-2']

# 主按钮文字放在墨块上，颜色固定（不跟强调色）：白天 / 护眼是纸色字，夜间是墨色字
PRIMARY_TEXT = {'day': '#F7F4EC', 'night': '#191814', 'eye': '#F6F0E2'}
PRIMARY_INK = {'day': '#1E1C18', 'night': '#E6DFCF', 'eye': '#1E1C18'}

META = {
    'label': '水墨',
    'desc': '宣纸底色和纸纹，主按钮是一笔横扫的墨块，强调色用花青；直角、没有高光，大标题用楷体。夜间是墨底白字，像拓片。',
}

# ---------------- 对比度（规格 T-07）----------------

def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def lum(rgb):
    def ch(c):
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    la, lb = lum(hex_rgb(a)), lum(hex_rgb(b))
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def lab(h):
    r, g, b = hex_rgb(h)
    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = lin(r), lin(g), lin(b)
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
    y = (r * 0.2126 + g * 0.7152 + b * 0.0722)
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
    def f(t):
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def ciede2000(c1, c2):
    L1, a1, b1 = lab(c1)
    L2, a2, b2 = lab(c2)
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cm = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360
    h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    dh = h2p - h1p
    if C1p * C2p == 0:
        dh = 0
    elif dh > 180:
        dh -= 360
    elif dh < -180:
        dh += 360
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dh / 2))
    Lpm, Cpm = (L1 + L2) / 2, (C1p + C2p) / 2
    if C1p * C2p == 0:
        hpm = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hpm = (h1p + h2p) / 2
    else:
        hpm = (h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2
    T = 1 - 0.17 * math.cos(math.radians(hpm - 30)) + 0.24 * math.cos(math.radians(2 * hpm)) \
        + 0.32 * math.cos(math.radians(3 * hpm + 6)) - 0.20 * math.cos(math.radians(4 * hpm - 63))
    dTheta = 30 * math.exp(-(((hpm - 275) / 25) ** 2))
    Rc = 2 * math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7))
    Sl = 1 + 0.015 * (Lpm - 50) ** 2 / math.sqrt(20 + (Lpm - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cpm, 1 + 0.015 * Cpm * T
    Rt = -math.sin(math.radians(2 * dTheta)) * Rc
    return math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))


def check(mode, p):
    """返回不达标的项。背景都按实际会出现的几种算。"""
    bad = []
    grounds = ['--surface', '--surface-2', '--bg', '--float-bg']
    def need(fg, bgs, minimum, label):
        for bg in bgs:
            r = ratio(p[fg], p[bg])
            if r < minimum:
                bad.append(f'{mode}: {label} {fg} {p[fg]} 对 {bg} {p[bg]} = {r:.2f} < {minimum}')
    need('--text', grounds + ['--surface-3'], 4.5, '正文')
    need('--text-2', grounds, 4.5, '次要文字')
    need('--text-3', grounds, 4.5, '说明文字')
    need('--accent-text', grounds + ['--accent-soft'], 4.5, '强调文字')
    for k in ('--danger-text', '--warn-text', '--success-text', '--info-text'):
        need(k, ['--surface', k.replace('-text', '-soft')], 4.5, '语义文字')
    for k in ('--mod-desk', '--mod-files', '--mod-draw', '--mod-task', '--mod-perf', '--mod-conf'):
        r = ratio(p[k + '-fg'], p[k + '-bg'])
        if r < 4.5:
            bad.append(f'{mode}: 模块识别色 {k} = {r:.2f} < 4.5')
    need('--border-strong', ['--surface', '--bg'], 3.0, '输入框边框')
    need('--accent', ['--surface', '--bg', '--canvas-bg'], 3.0, '焦点框 / 图标')
    if ratio(p['--on-accent'], p['--accent']) < 4.5:
        bad.append(f'{mode}: 强调色按钮文字 {ratio(p["--on-accent"], p["--accent"]):.2f} < 4.5')
    if ratio(PRIMARY_TEXT[mode], PRIMARY_INK[mode]) < 4.5:
        bad.append(f'{mode}: 主按钮文字对墨块 < 4.5')
    if ratio(PRIMARY_INK[mode], p['--surface']) < 3.0:
        bad.append(f'{mode}: 主按钮墨块对面板 < 3')
    for k in ('--danger', '--warn'):
        d = ciede2000(p['--accent'], p[k])
        if d < 20:
            bad.append(f'{mode}: 强调色和 {k} 太像（CIEDE2000 = {d:.1f} < 20）')
    return bad


def block(selector_mode, body):
    sel = (f':root[data-style="inkwash"][data-mode="{selector_mode}"],\n'
           f'[data-theme-scope][data-style="inkwash"][data-mode="{selector_mode}"]')
    return sel + ' {\n' + ''.join(f'  {k}: {v};\n' for k, v in body.items()) + '}\n'


def accent_block(mode, body):
    sel = (f':root[data-style="inkwash"][data-mode="{mode}"]:not([data-accent]),\n'
           f'[data-theme-scope][data-style="inkwash"][data-mode="{mode}"]:not([data-accent])')
    return sel + ' {\n' + ''.join(f'  {k}: {v};\n' for k, v in body.items()) + '}\n'


def main():
    problems = [msg for mode, p in PALETTE.items() for msg in check(mode, p)]
    if problems:
        print('对比度不达标，不生成：\n  ' + '\n  '.join(problems))
        sys.exit(1)
    out = ['/* 风格“水墨”（第 10 套）。由 make-inkwash.py 生成，不要手改；改颜色就改 make-inkwash.py 的 PALETTE 再运行。\n'
           ' * 接入：放在 themes.generated.css 之后；inkwash/ 里的 4 张图跟着本文件走（url 相对本文件）。\n'
           ' * 新令牌（规格 T-10）：下面 :root 里是所有风格的默认值，接入时放进基础令牌；组件按规格 T-10 使用。 */\n',
           ':root {\n' + ''.join(f'  {k}: {v};\n' for k, v in NEW_TOKEN_DEFAULTS.items()) + '}\n']
    for mode, p in PALETTE.items():
        body = dict(SHARED)
        body.update({k: v for k, v in p.items() if k not in ACCENT_KEYS})
        body['--on-primary'] = PRIMARY_TEXT[mode]          # 主按钮文字：墨块不跟强调色，文字也不跟
        out.append(block(mode, body))
    for mode, p in PALETTE.items():
        out.append(accent_block(mode, {k: p[k] for k in ACCENT_KEYS}))
    (HERE / 'inkwash.css').write_text('\n'.join(out), encoding='utf-8')
    for mode, p in PALETTE.items():
        print(f'{mode:5s} 正文 {ratio(p["--text"], p["--surface"]):5.2f}  说明 {ratio(p["--text-3"], p["--surface-2"]):5.2f}  '
              f'花青对面板 {ratio(p["--accent"], p["--surface"]):5.2f}  主按钮字 {ratio(PRIMARY_TEXT[mode], PRIMARY_INK[mode]):5.2f}  '
              f'花青/胭脂 ΔE {ciede2000(p["--accent"], p["--danger"]):4.1f}')
    print('inkwash.css 已生成')


if __name__ == '__main__':
    main()
