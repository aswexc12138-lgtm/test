"""Generate five ink-wash direction artboards (.dc.html) from one shared screen template."""
import math, random, pathlib, sys

OUT = pathlib.Path(sys.argv[1])

# ---------- small SVG helpers (explicit closing tags: the DC parser wants them) ----------
def ridge(w, base, amp, seed, step=8, top=0):
    rnd = random.Random(seed)
    ph = [rnd.uniform(0, 6.28) for _ in range(4)]
    pts = []
    for x in range(0, w + step, step):
        y = base - amp * (0.55 * math.sin(x / 97 + ph[0]) + 0.3 * math.sin(x / 41 + ph[1]) + 0.15 * math.sin(x / 17 + ph[2]))
        pts.append(f"{x},{y:.1f}")
    return f"M0,{base + 400} L" + " L".join(pts) + f" L{w},{base + 400} Z"

def droplets(cx, cy, n, spread, seed, rmax=6):
    rnd = random.Random(seed)
    out = []
    for _ in range(n):
        a = rnd.uniform(0, 6.28); d = rnd.uniform(spread * 0.55, spread)
        r = rnd.uniform(0.8, rmax) * (1 - d / spread * 0.6)
        out.append(f'<circle cx="{cx + math.cos(a) * d:.1f}" cy="{cy + math.sin(a) * d:.1f}" r="{r:.1f}"></circle>')
    return "".join(out)

def blossom(cx, cy, r, fill, center="#F3D27A"):
    petals = "".join(f'<circle cx="{cx + math.cos(i * 1.2566 - 1.57) * r:.1f}" cy="{cy + math.sin(i * 1.2566 - 1.57) * r:.1f}" r="{r * 0.78:.1f}" fill="{fill}"></circle>' for i in range(5))
    return petals + f'<circle cx="{cx}" cy="{cy}" r="{r * 0.42:.1f}" fill="{center}"></circle>'

def leaf(x, y, length, angle, color, width=None):
    w = width or length * 0.16
    return (f'<path transform="translate({x} {y}) rotate({angle})" d="M0 0 C {length*0.25:.1f} {-w:.1f}, {length*0.7:.1f} {-w:.1f}, {length} 0 '
            f'C {length*0.7:.1f} {w*0.6:.1f}, {length*0.25:.1f} {w*0.6:.1f}, 0 0 Z" fill="{color}"></path>')

def filters(p):
    return f'''<svg width="0" height="0" style="position: absolute" aria-hidden="true"><defs>
<filter id="{p}-rough" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7"></feTurbulence><feDisplacementMap in="SourceGraphic" scale="16"></feDisplacementMap></filter>
<filter id="{p}-fine" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="3"></feTurbulence><feDisplacementMap in="SourceGraphic" scale="5"></feDisplacementMap></filter>
<filter id="{p}-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"></feGaussianBlur></filter>
<filter id="{p}-wash" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="4" seed="11"></feTurbulence><feDisplacementMap in="SourceGraphic" scale="30"></feDisplacementMap><feGaussianBlur stdDeviation="2.2"></feGaussianBlur></filter>
<filter id="{p}-fiber"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="5"></feTurbulence><feColorMatrix type="saturate" values="0"></feColorMatrix></filter>
</defs></svg>'''

# ---------- the shared drawing screen ----------
FLOOR = '''<svg viewBox="0 0 520 390" width="500" height="375" aria-hidden="true"><g fill="none" stroke="#3a3a3a" stroke-width="2.4"><rect x="28" y="26" width="464" height="336"></rect><path d="M28 170h170M198 26v120M198 200v162M330 26v110M330 196v166M330 290h162"></path></g><g fill="#6b6b6b" font-size="11" font-family="Noto Sans SC, sans-serif"><text x="90" y="104">收银</text><text x="252" y="104">卖场</text><text x="392" y="104">仓库</text><text x="94" y="276">试衣间</text><text x="392" y="334">办公</text></g><g fill="none" stroke="#24456b" stroke-width="2.2"><circle cx="120" cy="140" r="9"></circle><path d="M129 140h16m-6-6l6 6-6 6"></path><circle cx="268" cy="250" r="9"></circle><path d="M277 250h16m-6-6l6 6-6 6"></path><circle cx="430" cy="210" r="9"></circle><path d="M439 210h16m-6-6l6 6-6 6"></path></g><g font-size="12" font-weight="700" fill="#24456b" font-family="Noto Sans SC, sans-serif"><text x="104" y="166">Cam1</text><text x="252" y="276">Cam2</text><text x="414" y="236">Cam3</text></g><g font-family="Noto Sans SC, sans-serif"><rect x="350" y="298" width="128" height="50" fill="#fff" stroke="#9a9a9a"></rect><text x="362" y="319" font-size="11" fill="#333">录像机 × 1 台</text><text x="362" y="337" font-size="11" fill="#333">交换机 × 1 台</text></g></svg>'''

RAIL = ''.join(f'<span class="ri{" on" if i == 0 else ""}"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="{d}"></path></svg></span>' for i, d in enumerate([
    "M5 3l14 8-6 2-2 6z", "M5 5h14M12 5v14", "M5 19L19 5m0 0h-7m7 0v7", "M3 17l14-14 4 4-14 14z", "M4 4h16v16H4z M4 12h16", "M6 6h.01M12 6h.01M18 6h.01M6 12h.01M12 12h.01M18 12h.01"]))

TEMPLATE = '''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>%%TITLE%%</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?%%FONTS%%&amp;display=swap" rel="stylesheet">
<style>
body{margin:0}
a{color:inherit}a:hover{color:inherit}
.scr{%%DAY%%;width:1280px;height:1100px;background:var(--bg);color:var(--ink);font-family:var(--body-font);font-size:13px;line-height:1.45;position:relative;overflow:hidden}
.scr.night{%%NIGHT%%}
.app{position:relative;height:800px;display:flex;flex-direction:column;overflow:hidden}
.bgdeco{position:absolute;inset:0;pointer-events:none;z-index:0;color:var(--deco)}
.tb{position:relative;z-index:2;height:48px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 16px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700}
.mods{display:flex;gap:2px}
.mod{position:relative;z-index:0;height:48px;padding:0 15px;display:flex;align-items:center;color:var(--ink2);text-decoration:none;font-family:var(--tab-font);font-size:var(--tab-size)}
.mod.on{color:var(--tab-on)}
.tabdeco{position:absolute;pointer-events:none;z-index:-1}
.tbr{justify-self:end;display:flex;align-items:center;gap:18px;color:var(--ink2);font-size:12px}
.wc{display:inline-flex;gap:20px}
.etb{position:relative;z-index:2;height:52px;display:flex;align-items:center;gap:8px;padding:0 16px}
.fname{display:flex;flex-direction:column;line-height:1.25;margin-right:6px}
.fname strong{font-size:14px}
.fname small{color:var(--ink2);font-size:11px}
.btn{height:30px;padding:0 11px;border:1px solid var(--line);border-radius:var(--r);background:var(--paper);color:var(--ink);font:inherit;font-size:12px;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;cursor:pointer}
.btn.flat{border-color:transparent;background:transparent}
.pri{position:relative;z-index:0;border:0;background:transparent;cursor:pointer;white-space:nowrap}
.spacer{flex:1}
.body{position:relative;z-index:1;flex:1;min-height:0;display:flex;gap:10px;padding:8px 12px 10px}
.rail{width:40px;flex:none;align-self:flex-start;padding:6px 0;background:var(--paper);border:1px solid var(--line);border-radius:var(--r);display:flex;flex-direction:column;align-items:center;gap:4px}
.ri{width:30px;height:30px;border-radius:var(--r);display:flex;align-items:center;justify-content:center;color:var(--ink2)}
.ri.on{background:var(--sel);color:var(--ink)}
.col,.rc{width:258px;flex:none;display:flex;flex-direction:column;gap:10px;min-height:0}
.pn{position:relative;background:var(--paper);border:1px solid var(--line);border-radius:var(--r);display:flex;flex-direction:column;overflow:hidden;min-height:0}
.pn.big{flex:0 0 62%}
.pn.small{flex:1;opacity:.62}
.ph{position:relative;height:40px;flex:none;display:flex;align-items:center;gap:8px;padding:0 12px;border-bottom:1px solid var(--line)}
.ph .t{position:relative;z-index:1;font-family:var(--title-font);font-size:var(--title-size);color:var(--ink)}
.ph .sub{position:relative;z-index:1;color:var(--ink2);font-size:11px}
.ph .ic{margin-left:auto;display:flex;gap:10px;color:var(--ink2);font-size:12px}
.pb{padding:8px 10px;display:flex;flex-direction:column;gap:4px;min-height:0}
.tabs{display:flex;gap:2px;padding:2px;border-radius:var(--r);background:var(--sel);margin-bottom:6px}
.tabs span{flex:1;height:26px;display:flex;align-items:center;justify-content:center;border-radius:var(--r);color:var(--ink2);font-size:12px}
.tabs span.on{background:var(--paper);color:var(--ink);font-weight:600}
.row{position:relative;z-index:0;display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:var(--r)}
.row .nm{flex:1;min-width:0}
.row .nm b{display:block;font-weight:600;font-size:12.5px}
.row .nm small{display:block;color:var(--ink2);font-size:11px}
.row .n{font-family:var(--num-font);font-size:var(--num-size);color:var(--ink)}
.row.sel{background:var(--sel)}
.done{position:relative;width:22px;height:22px;flex:none;display:inline-flex;align-items:center;justify-content:center}
.thumb{width:28px;height:28px;flex:none;border-radius:var(--r);background:var(--sel);display:flex;align-items:center;justify-content:center;color:var(--ink2)}
.cv{position:relative;flex:1;min-width:0;border-radius:var(--r);background:var(--canvas);display:flex;align-items:center;justify-content:center;overflow:hidden}
.cvdeco{position:absolute;inset:0;pointer-events:none;color:var(--deco)}
.sheet{position:relative;z-index:1;background:#fff;padding:6px;box-shadow:0 8px 26px rgba(20,18,14,.16)}
.zoom{position:absolute;right:10px;bottom:10px;z-index:2;display:flex;gap:14px;align-items:center;padding:4px 12px;background:var(--paper);border:1px solid var(--line);border-radius:var(--r);font-size:12px;color:var(--ink2)}
.sel-combo{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink2);margin-bottom:4px}
.sel-combo span{flex:1;height:28px;display:flex;align-items:center;justify-content:space-between;padding:0 8px;border:1px solid var(--line);border-radius:var(--r);color:var(--ink);background:var(--paper)}
.qty{display:flex;align-items:center;gap:6px}
.qty i{font-style:normal;width:22px;height:22px;border:1px solid var(--line);border-radius:var(--r);display:flex;align-items:center;justify-content:center;color:var(--ink2)}
.sb{position:relative;z-index:2;height:30px;flex:none;display:flex;align-items:center;gap:16px;padding:0 16px;font-size:12px;color:var(--ink2)}
.sb b{color:var(--ink)}
.strip{position:relative;height:300px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;padding:14px 16px 16px;box-sizing:border-box;background:var(--bg2);border-top:1px solid var(--line)}
.cell{position:relative;z-index:0;background:var(--paper);border:1px solid var(--line);border-radius:var(--r);padding:12px;display:flex;flex-direction:column;gap:12px;overflow:hidden}
.cap{position:relative;z-index:1;font-size:11px;color:var(--ink2);letter-spacing:.12em}
.stage{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px}
%%CSS%%
</style>
</helmet>
<div class="{{ rootCls }}">
%%FILTERS%%
<div class="app">
<div class="bgdeco">%%BGDECO%%</div>
<header class="tb">
<div class="brand">%%BRAND%%</div>
<nav class="mods" aria-label="模块"><a class="mod" href="#">工作台</a><a class="mod" href="#">资料整理</a><a class="mod on" href="#">%%TABDECO%%绘图</a><a class="mod" href="#">绩效</a><a class="mod" href="#">配置</a></nav>
<div class="tbr"><span>{{ modeLabel }}</span><span class="wc" aria-hidden="true"><span>─</span><span>☐</span><span>✕</span></span></div>
</header>
<div class="etb">
<div class="fname"><strong>2F 平面图.pdf</strong><small>成果目录：BIG 老店 / 2026 Q4</small></div>
<button type="button" class="btn">方案 BIG（老店） ▾</button>
<button type="button" class="btn">‹ 第 2 / 4 页 ›</button>
<span class="spacer"></span>
<button type="button" class="btn flat">点位说明</button>
<button type="button" class="btn">设备汇总 2 ▾</button>
<button type="button" class="btn flat">文件样式</button>
<button type="button" class="btn flat">图片大小</button>
<button type="button" class="btn">导出 PDF ▾</button>
%%PRIMARY%%
</div>
<div class="body">
<div class="rail">%%RAIL%%</div>
<div class="col">
<section class="pn big">
<div class="ph">%%PANELDECO%%<span class="t">%%T_RES%%</span><span class="ic" aria-hidden="true"><span>⌖</span><span>︿</span><span>✕</span></span></div>
<div class="pb">
<div class="tabs"><span>文件</span><span class="on">页面</span><span>点位</span></div>
<div class="row sel">%%SELDECO%%<span class="thumb">2</span><span class="nm"><b>第 2 页 · 当前</b><small>2 个点位</small></span></div>
<div class="row"><span class="thumb">1</span><span class="nm"><b>第 1 页</b><small>3 个点位 · 已导出</small></span>%%DONE%%</div>
<div class="row"><span class="thumb">3</span><span class="nm"><b>第 3 页</b><small>还没放点</small></span></div>
<div class="row"><span class="thumb">4</span><span class="nm"><b>第 4 页</b><small>还没放点</small></span></div>
</div>
</section>
<section class="pn small">
<div class="ph"><span class="t">%%T_DEV%%</span><span class="sub">BIG（老店）</span></div>
<div class="pb">
<div class="row"><span class="thumb">◎</span><span class="nm"><b>点位摄像机</b><small>客流</small></span><span class="n">2</span></div>
<div class="row"><span class="thumb">◎</span><span class="nm"><b>D6PS-1 半球</b><small>卖场监控</small></span><span class="n">1</span></div>
</div>
</section>
</div>
<main class="cv">
<div class="cvdeco">%%CVDECO%%</div>
%%SHEET_BEFORE%%<div class="sheet">%%FLOOR%%</div>%%SHEET_AFTER%%
<div class="zoom"><span>−</span><span>100%</span><span>+</span><span>适配</span></div>
</main>
<aside class="rc">
<section class="pn" style="flex: 1">
<div class="ph"><span class="t">%%T_SUM%%</span><span class="sub">BIG（老店）</span></div>
<div class="pb">
<div class="sel-combo">汇总组合<span>默认 ▾</span></div>
<div class="row"><span class="nm"><b>点位摄像机</b><small>客流 · 点位</small></span><span class="qty"><i>−</i><span class="n">2</span><i>+</i></span></div>
<div class="row"><span class="nm"><b>录像机</b><small>汇总设备 · 组合</small></span><span class="qty"><i>−</i><span class="n">1</span><i>+</i></span></div>
<div class="row"><span class="nm"><b>交换机</b><small>汇总设备 · 组合</small></span><span class="qty"><i>−</i><span class="n">1</span><i>+</i></span></div>
</div>
</section>
</aside>
</div>
<footer class="sb"><b>已保存</b><span>上次保存 10:21</span><span>比例 · 未校准</span><span class="spacer"></span><span>整体 100%</span><span>2 / 4 页</span></footer>
</div>
<div class="strip">
%%STRIP%%
</div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"night":{"editor":"boolean","default":false,"section":"模式"},"$preview":{"width":1280,"height":1100}}'>
class Component extends DCLogic {
  renderVals() {
    const night = this.props.night ?? false;
    return { rootCls: night ? 'scr night' : 'scr', modeLabel: night ? '水墨 · 夜间' : '水墨 · 白天' };
  }
}
</script>
</body>
</html>
'''

def cell(cap, inner):
    return f'<div class="cell"><div class="cap">{cap}</div><div class="stage">{inner}</div></div>'

def build(name, title, fonts, day, night, css, parts, strip):
    html = TEMPLATE
    rep = {"TITLE": title, "FONTS": fonts, "DAY": day, "NIGHT": night, "CSS": css, "RAIL": RAIL, "FLOOR": FLOOR, "STRIP": strip}
    rep.update(parts)
    for k in ["FILTERS", "BGDECO", "BRAND", "TABDECO", "PRIMARY", "PANELDECO", "SELDECO", "DONE", "CVDECO", "SHEET_BEFORE", "SHEET_AFTER"]:
        rep.setdefault(k, "")
    rep.setdefault("T_RES", "资料"); rep.setdefault("T_DEV", "设备"); rep.setdefault("T_SUM", "汇总清单")
    for k, v in rep.items():
        html = html.replace(f"%%{k}%%", v)
    assert "%%" not in html, name
    markup = html[html.index("<x-dc>"):html.index("</x-dc>")].replace("{{ rootCls }}", "").replace("{{ modeLabel }}", "")
    assert "{{" not in markup and "}}" not in markup, name
    (OUT / name).write_text(html, encoding="utf-8")
    print(name, len(html))

exec(open(pathlib.Path(__file__).with_name("directions.py"), encoding="utf-8").read())
