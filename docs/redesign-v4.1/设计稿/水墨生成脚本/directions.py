# Five ink-wash directions. Executed by gen.py (helpers and build() come from there).

def blobpath(w, h, seed, pad=0.08):
    rnd = random.Random(seed)
    pts = []
    n = 14
    for i in range(n):
        a = i / n * 6.2832
        rx = w / 2 * (1 - pad) * rnd.uniform(0.86, 1.06)
        ry = h / 2 * (1 - pad) * rnd.uniform(0.78, 1.08)
        pts.append((w / 2 + math.cos(a) * rx, h / 2 + math.sin(a) * ry))
    d = f"M{pts[0][0]:.1f},{pts[0][1]:.1f} "
    for i in range(n):
        p0, p1 = pts[i], pts[(i + 1) % n]
        mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
        d += f"Q{p0[0]:.1f},{p0[1]:.1f} {mx:.1f},{my:.1f} "
    return d + "Z"

FONT_SANS = "family=Noto+Sans+SC:wght@400;600;700"

# =====================================================================================
# 1. 泼墨
# =====================================================================================
P = "p"
def p_blob(w, h, seed, drops=True, cls=""):
    dr = f'<g fill="currentColor">{droplets(w * 0.92, h * 0.45, 9, h * 0.9, seed + 1, rmax=3.2)}{droplets(w * 0.06, h * 0.6, 5, h * 0.7, seed + 2, rmax=2.4)}</g>' if drops else ""
    return (f'<svg class="{cls}" viewBox="0 0 {w} {h}" preserveAspectRatio="none" aria-hidden="true" style="overflow: visible">'
            f'<path d="{blobpath(w, h, seed)}" fill="currentColor" filter="url(#{P}-rough)"></path>{dr}</svg>')

p_bg = (f'<svg width="1280" height="800" viewBox="0 0 1280 800" aria-hidden="true">'
        f'<g fill="currentColor"><path d="{blobpath(420, 260, 21)}" transform="translate(-140 -120)" filter="url(#{P}-wash)"></path>'
        f'<path d="{blobpath(300, 120, 22)}" transform="translate(150 -30) rotate(8)" filter="url(#{P}-rough)" opacity=".7"></path>'
        f'{droplets(250, 70, 26, 150, 23, rmax=7)}'
        f'<path d="{blobpath(520, 320, 24)}" transform="translate(980 600)" filter="url(#{P}-wash)"></path>'
        f'{droplets(1040, 640, 22, 180, 25, rmax=8)}'
        f'<path d="M1010 760 C 1080 700, 1180 690, 1290 640" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" filter="url(#{P}-rough)"></path></g></svg>')
p_cv = (f'<svg width="100%" height="100%" viewBox="0 0 700 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="currentColor">'
        f'<path d="{blobpath(360, 240, 31)}" transform="translate(-90 520)" filter="url(#{P}-wash)"></path>{droplets(170, 600, 30, 170, 32, rmax=9)}'
        f'<path d="M-20 690 C 160 600, 380 640, 720 560" fill="none" stroke="currentColor" stroke-width="26" stroke-linecap="round" filter="url(#{P}-rough)"></path>'
        f'<path d="{blobpath(200, 140, 33)}" transform="translate(560 -40)" filter="url(#{P}-wash)"></path>{droplets(620, 40, 18, 110, 34, rmax=6)}</g></svg>')
p_tab = f'<span class="tabdeco" style="inset: 7px -8px 5px -8px; color: var(--accent)">{p_blob(80, 36, 41)}</span>'
p_pri = f'<button type="button" class="pri">{p_blob(150, 40, 42)}<span>完成并下一份</span></button>'
p_done = f'<span class="done" aria-label="已完成">{p_blob(22, 22, 43, drops=False)}<svg width="12" height="12" viewBox="0 0 12 12" style="position: relative" aria-hidden="true"><path d="M2 6.5l2.6 2.6L10 3" fill="none" stroke="var(--accent-ink)" stroke-width="2" stroke-linecap="round"></path></svg></span>'
p_smear = f'<span class="smear">{p_blob(140, 30, 44, drops=False)}</span>'
p_sel = f'<span class="seldeco">{p_blob(240, 44, 45, drops=False)}</span>'
p_css = '''
.bgdeco{opacity:.09}.night .bgdeco{opacity:.06}
.cvdeco{opacity:.1}.night .cvdeco{opacity:.06}
.brand .logo{position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;color:var(--accent-ink);font-family:'Zhi Mang Xing',cursive;font-size:24px}
.brand .logo svg{position:absolute;inset:0;width:100%;height:100%;color:var(--accent);z-index:-1}
.brand .logo{z-index:0}
.brand .word{font-family:'Zhi Mang Xing',cursive;font-size:28px;font-weight:400}
.tabdeco svg{width:100%;height:100%}
.pri{height:40px;padding:0 22px;margin-left:6px;color:var(--accent-ink);font-family:'Zhi Mang Xing',cursive;font-size:21px}
.pri svg{position:absolute;inset:-4px -10px;width:calc(100% + 20px);height:calc(100% + 8px);z-index:-1;color:var(--accent)}
.ph .smear{position:absolute;left:2px;top:5px;width:120px;height:30px;color:var(--ink);opacity:.13}
.ph .smear svg,.seldeco svg{width:100%;height:100%}
.row.sel{background:transparent}
.seldeco{position:absolute;inset:1px -4px;z-index:-1;color:var(--ink);opacity:.1}
.done svg:first-child{position:absolute;inset:0;width:100%;height:100%;color:var(--accent)}
.mtabs{display:flex;gap:4px}
.ring{position:relative;width:120px;height:120px}
.ring svg{width:100%;height:100%;color:var(--ink)}
.tog{position:relative;width:56px;height:28px;border:1.5px solid var(--ink);border-radius:14px}
.tog svg{position:absolute;right:2px;top:1px;width:24px;height:24px;color:var(--ink)}
.seg{display:flex;gap:2px;font-size:12px}
.seg span{position:relative;z-index:0;padding:4px 12px;color:var(--ink2)}
.seg span.on{color:var(--accent-ink)}
.seg span.on svg{position:absolute;inset:-2px -4px;width:calc(100% + 8px);height:calc(100% + 4px);z-index:-1;color:var(--accent)}
.empty{position:relative;width:170px;height:130px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--accent-ink)}
.empty svg{position:absolute;inset:0;width:100%;height:100%;color:var(--accent);z-index:-1}
.empty b{font-family:'Zhi Mang Xing',cursive;font-size:30px;font-weight:400}
.empty small{font-size:10px;opacity:.85}
.note{font-size:11px;color:var(--ink2);text-align:center}
'''
p_strip = "".join([
    cell("主按钮", f'{p_pri}<button type="button" class="btn">导出 PDF</button><span class="note">按钮是一团泼墨，边上溅几点</span>'),
    cell("模块标签", f'<div class="mtabs"><a class="mod" href="#">工作台</a><a class="mod on" href="#">{p_tab}绘图</a><a class="mod" href="#">配置</a></div><span class="note">当前模块压在墨团上</span>'),
    cell("选中 · 已完成", f'<div style="width: 100%"><div class="row sel">{p_sel}<span class="nm"><b>第 2 页 · 当前</b><small>2 个点位</small></span></div><div class="row"><span class="nm"><b>第 1 页</b><small>已导出</small></span>{p_done}</div></div>'),
    cell("加载中", f'<div class="ring"><svg viewBox="0 0 120 120" aria-hidden="true"><g fill="currentColor"><circle cx="60" cy="60" r="16" filter="url(#{P}-rough)"></circle><circle cx="60" cy="60" r="30" opacity=".22" filter="url(#{P}-wash)"></circle><circle cx="60" cy="60" r="46" opacity=".1" filter="url(#{P}-wash)"></circle>{droplets(60, 60, 10, 54, 51, rmax=2.6)}</g></svg></div><span class="note">墨滴落下、晕开，代替转圈</span>'),
    cell("开关 · 分段 · 分隔", f'<div class="tog">{p_blob(24, 24, 52, drops=False)}</div><div class="seg"><span class="on">{p_blob(60, 24, 53, drops=False)}横排</span><span>竖排</span></div><svg width="150" height="10" viewBox="0 0 150 10" aria-hidden="true" style="color: var(--ink)"><g fill="currentColor">' + "".join(f'<circle cx="{i * 7 + 3}" cy="{5 + math.sin(i) * 2:.1f}" r="{1.1 + abs(math.sin(i * 1.7)) * 1.4:.1f}"></circle>' for i in range(21)) + '</g></svg><span class="note">分隔线是一串溅墨</span>'),
    cell("空状态", f'<div class="empty">{p_blob(170, 130, 54)}<b>打开图纸</b><small>选择 DWG、PDF 或图片开始</small></div>'),
])
build("Ink1Pomo.dc.html", "水墨方向一 · 泼墨",
      FONT_SANS + "&amp;family=Zhi+Mang+Xing",
      "--bg:#F1ECE2;--bg2:#E9E2D5;--paper:#F8F4EC;--ink:#191815;--ink2:#5F5A51;--line:#DAD1C1;--sel:rgba(25,24,21,.07);--canvas:#E8E1D4;--deco:#191815;--tab-on:#F8F4EC;--accent:#191815;--accent-ink:#F8F4EC;--title-font:'Zhi Mang Xing',cursive;--tab-font:'Zhi Mang Xing',cursive;--tab-size:22px;--title-size:22px;--body-font:'Noto Sans SC',sans-serif;--num-font:'Zhi Mang Xing',cursive;--num-size:21px;--r:3px",
      "--bg:#121110;--bg2:#0D0C0B;--paper:#1C1A17;--ink:#EEE8DD;--ink2:#A69F92;--line:#35312B;--sel:rgba(238,232,221,.09);--canvas:#171513;--deco:#EEE8DD;--tab-on:#121110;--accent:#EEE8DD;--accent-ink:#121110",
      p_css,
      {"FILTERS": filters(P), "BGDECO": p_bg, "CVDECO": p_cv, "TABDECO": p_tab, "PRIMARY": p_pri, "DONE": p_done, "PANELDECO": p_smear, "SELDECO": p_sel,
       "BRAND": f'<span class="logo">{p_blob(34, 34, 46, drops=False)}胥</span><span class="word">胥宇</span>'},
      p_strip)

# =====================================================================================
# 2. 山水
# =====================================================================================
P = "s"
def s_ridges(w, h, seed, layers=((0.55, 0.30, .12), (0.68, 0.24, .2), (0.82, 0.18, .32)), blur_far=True):
    g = ""
    for i, (base, amp, op) in enumerate(layers):
        f = f' filter="url(#{P}-soft)"' if blur_far and i == 0 else ""
        g += f'<path d="{ridge(w, h * base, h * amp, seed + i, step=max(4, w // 90))}" fill="currentColor" opacity="{op}"{f}></path>'
    return g
s_bg = (f'<svg width="1280" height="800" viewBox="0 0 1280 800" aria-hidden="true"><defs><linearGradient id="s-mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color: var(--bg); stop-opacity: 0"></stop><stop offset="1" style="stop-color: var(--bg); stop-opacity: 1"></stop></linearGradient></defs>'
        f'<circle cx="1046" cy="30" r="15" style="fill: var(--sun)" opacity=".55"></circle>'
        f'<g transform="translate(0 -8)">{s_ridges(1280, 120, 61)}</g><rect x="0" y="70" width="1280" height="50" fill="url(#s-mist)"></rect>'
        f'<g transform="translate(0 690)">{s_ridges(1280, 120, 64, layers=((0.45, 0.35, .08), (0.6, 0.3, .13)))}</g></svg>')
s_cv = (f'<svg width="100%" height="100%" viewBox="0 0 700 700" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs><linearGradient id="s-mist2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color: var(--canvas); stop-opacity: 0"></stop><stop offset="1" style="stop-color: var(--canvas); stop-opacity: .9"></stop></linearGradient></defs>'
        f'<circle cx="590" cy="110" r="34" style="fill: var(--sun)" opacity=".35"></circle>'
        f'<ellipse cx="160" cy="180" rx="120" ry="14" fill="currentColor" opacity=".06" filter="url(#{P}-soft)"></ellipse><ellipse cx="520" cy="260" rx="150" ry="12" fill="currentColor" opacity=".05" filter="url(#{P}-soft)"></ellipse>'
        f'<g transform="translate(0 420)">{s_ridges(700, 280, 71, layers=((0.35, 0.32, .1), (0.55, 0.28, .16), (0.78, 0.2, .24)))}</g><rect x="0" y="560" width="700" height="140" fill="url(#s-mist2)"></rect></svg>')
s_tab = '<svg class="tabdeco" viewBox="0 0 30 9" aria-hidden="true" style="left: 50%; bottom: 7px; width: 30px; height: 9px; margin-left: -15px"><path d="M0 9 L9 2 L13 5 L19 0 L30 9 Z" style="fill: var(--accent)"></path></svg>'
s_pri = f'<button type="button" class="pri"><svg viewBox="0 0 160 20" preserveAspectRatio="none" aria-hidden="true">{s_ridges(160, 20, 81, layers=((0.45, 0.4, .22), (0.75, 0.3, .3)), blur_far=False)}</svg><span>完成并下一份</span></button>'
s_done = f'<span class="done" aria-label="已完成"><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="15.5" cy="6.5" r="3.4" style="fill: var(--sun)"></circle><path d="M1 20 L8.5 9 L12.5 14 L15.5 11 L21 20 Z" style="fill: var(--accent)"></path></svg></span>'
s_ph = f'<svg class="ridge" viewBox="0 0 260 10" preserveAspectRatio="none" aria-hidden="true"><path d="{ridge(260, 8, 5, 91, step=6)}" style="fill: var(--accent)" opacity=".16"></path></svg>'
s_css = '''
.brand .logo{width:32px;height:32px;border-radius:50%;background:var(--accent);color:var(--accent-ink);display:flex;align-items:center;justify-content:center;font-family:'LXGW WenKai TC',serif;font-size:18px;overflow:hidden;position:relative}
.brand .word{font-family:'LXGW WenKai TC',serif;font-size:20px}
.pri{height:34px;padding:0 18px;margin-left:6px;border-radius:17px;background:var(--accent);color:var(--accent-ink);font-family:var(--title-font);font-size:15px;overflow:hidden}
.pri svg{position:absolute;left:0;right:0;bottom:0;width:100%;height:65%;z-index:-1;color:var(--accent-ink)}
.pn.big .ph{border-bottom:0}
.ph .ridge{position:absolute;left:0;right:0;bottom:0;width:100%;height:10px}
.row.sel{background:linear-gradient(90deg,var(--sel),transparent 90%)}
.mtabs{display:flex;gap:2px}
.land{position:relative;width:150px;height:100px;border-radius:var(--r);overflow:hidden;background:var(--canvas)}
.land svg{position:absolute;inset:0;width:100%;height:100%;color:var(--deco)}
.tog{position:relative;width:58px;height:28px;border-radius:14px;background:var(--sel);overflow:hidden}
.tog i{position:absolute;right:4px;top:4px;width:20px;height:20px;border-radius:50%;background:var(--sun)}
.tog svg{position:absolute;left:0;right:0;bottom:0;width:100%;height:12px;color:var(--accent)}
.seg{display:flex;gap:2px;padding:2px;border-radius:14px;background:var(--sel);font-size:12px}
.seg span{padding:3px 12px;border-radius:12px;color:var(--ink2)}
.seg span.on{background:var(--paper);color:var(--ink)}
.empty{position:relative;width:170px;height:130px;border-radius:var(--r);overflow:hidden;background:var(--canvas);display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:18px;box-sizing:border-box}
.empty svg{position:absolute;inset:0;width:100%;height:100%;color:var(--deco)}
.empty b{position:relative;font-family:'LXGW WenKai TC',serif;font-size:22px;font-weight:400}
.empty small{position:relative;font-size:10px;color:var(--ink2)}
.note{font-size:11px;color:var(--ink2);text-align:center}
'''
s_land = (f'<svg viewBox="0 0 150 100" preserveAspectRatio="none" aria-hidden="true"><g transform="translate(0 30)">{s_ridges(150, 70, 101, layers=((0.4, 0.4, .14), (0.6, 0.3, .22), (0.82, 0.2, .34)), blur_far=False)}</g>'
          f'<rect x="-20" y="52" width="190" height="10" fill="white" opacity=".55" filter="url(#{P}-soft)"></rect></svg>')
s_strip = "".join([
    cell("主按钮", f'{s_pri}<button type="button" class="btn" style="border-radius: 17px">导出 PDF</button><span class="note">按钮底部藏着一层远山</span>'),
    cell("模块标签", f'<div class="mtabs"><a class="mod" href="#">工作台</a><a class="mod on" href="#">{s_tab}绘图</a><a class="mod" href="#">配置</a></div><span class="note">当前项下面一座小山</span>'),
    cell("选中 · 已完成", f'<div style="width: 100%"><div class="row sel"><span class="nm"><b>第 2 页 · 当前</b><small>2 个点位</small></span></div><div class="row"><span class="nm"><b>第 1 页</b><small>已导出</small></span>{s_done}</div></div>'),
    cell("加载中", f'<div class="land">{s_land}</div><span class="note">一道云雾从山间流过</span>'),
    cell("开关 · 分段 · 分隔", f'<div class="tog"><svg viewBox="0 0 58 12" preserveAspectRatio="none" aria-hidden="true"><path d="{ridge(58, 9, 5, 111, step=4)}" fill="currentColor" opacity=".35"></path></svg><i></i></div><div class="seg"><span class="on">横排</span><span>竖排</span></div><svg width="150" height="12" viewBox="0 0 150 12" aria-hidden="true"><path d="{ridge(150, 10, 6, 112, step=5)}" style="fill: var(--accent)" opacity=".3"></path></svg><span class="note">开关是日月，分隔是山脊线</span>'),
    cell("空状态", f'<div class="empty"><svg viewBox="0 0 170 130" preserveAspectRatio="none" aria-hidden="true"><circle cx="128" cy="34" r="12" style="fill: var(--sun)" opacity=".6"></circle><g transform="translate(0 50)">{s_ridges(170, 80, 121, layers=((0.4, 0.4, .12), (0.6, 0.3, .2), (0.82, 0.22, .32)), blur_far=False)}</g></svg><b>打开图纸</b><small>选择 DWG、PDF 或图片开始</small></div>'),
])
build("Ink2Shanshui.dc.html", "水墨方向二 · 山水",
      FONT_SANS + "&amp;family=LXGW+WenKai+TC",
      "--bg:#ECEFEA;--bg2:#E2E7E2;--paper:#F6F7F3;--ink:#22302C;--ink2:#5E6B66;--line:#CBD4CF;--sel:rgba(61,106,108,.11);--canvas:#E1E7E3;--deco:#3B5552;--tab-on:#22302C;--accent:#3D6A6C;--accent-ink:#F6F7F3;--sun:#C8553D;--title-font:'LXGW WenKai TC',serif;--tab-font:'LXGW WenKai TC',serif;--tab-size:16px;--title-size:16px;--body-font:'Noto Sans SC',sans-serif;--num-font:'LXGW WenKai TC',serif;--num-size:16px;--r:7px",
      "--bg:#121A1C;--bg2:#0E1416;--paper:#192326;--ink:#DCE5E2;--ink2:#93A29E;--line:#2B393C;--sel:rgba(134,179,176,.13);--canvas:#152024;--deco:#9FB9B5;--tab-on:#DCE5E2;--accent:#86B3B0;--accent-ink:#0E1416;--sun:#E8E3C8",
      s_css,
      {"FILTERS": filters(P), "BGDECO": s_bg, "CVDECO": s_cv, "TABDECO": s_tab, "PRIMARY": s_pri, "DONE": s_done, "PANELDECO": s_ph,
       "BRAND": f'<span class="logo">胥</span><span class="word">胥宇</span>'},
      s_strip)

# =====================================================================================
# 3. 书法
# =====================================================================================
P = "f"
f_seal = lambda ch, size=18: f'<i class="seal" style="width: {size}px; height: {size}px; font-size: {round(size * 0.66)}px">{ch}</i>'
f_dot = f'<svg class="tabdeco" viewBox="0 0 12 8" aria-hidden="true" style="left: 50%; bottom: 7px; width: 12px; height: 8px; margin-left: -6px"><ellipse cx="6" cy="4" rx="5" ry="3.2" style="fill: var(--tab-on)" filter="url(#{P}-fine)" transform="rotate(-18 6 4)"></ellipse></svg>'
f_pri = f'<button type="button" class="pri"><span>完成并下一份</span>{f_seal("成")}</button>'
f_done = f'<span class="done" aria-label="已完成">{f_seal("毕", 22)}</span>'
f_cv = ('<span class="couplet" style="left: 26px">经纬有度</span><span class="couplet" style="right: 26px">方圆成规</span>')
f_css = '''
.seal{position:relative;display:inline-flex;align-items:center;justify-content:center;font-style:normal;background:var(--seal);color:#FBF3E6;font-family:'Ma Shan Zheng',cursive;filter:url(#f-fine);flex:none}
.brand .word{font-family:'Long Cang',cursive;font-size:34px;font-weight:400;line-height:1}
.mod{opacity:.7}.mod.on{opacity:1}
.ph .t{border:1px solid var(--ink);padding:0 10px 0 13px;line-height:24px;letter-spacing:.32em;font-size:17px}
.pri{height:36px;padding:0 20px;margin-left:6px;background:var(--accent);color:var(--accent-ink);font-family:'Ma Shan Zheng',cursive;font-size:19px}
.pri .seal{position:absolute;right:-8px;top:-8px;width:18px;height:18px;font-size:12px}
.couplet{position:absolute;top:50%;transform:translateY(-50%);writing-mode:vertical-rl;font-family:'Liu Jian Mao Cao',cursive;font-size:66px;line-height:1;color:var(--ink);opacity:.08;letter-spacing:.1em}
.row .nm b{font-weight:600}
.mtabs{display:flex;gap:2px}
.underline{position:relative;border:0;background:transparent;font-family:'Ma Shan Zheng',cursive;font-size:18px;color:var(--ink);padding:0 4px 6px}
.underline svg{position:absolute;left:-4px;right:-4px;bottom:0;width:calc(100% + 8px);height:8px}
.tog{position:relative;width:54px;height:24px;border:1.5px solid var(--ink)}
.tog i{position:absolute;right:3px;top:3px;width:15px;height:15px;background:var(--ink)}
.seg{display:flex;align-items:center;gap:10px;font-family:'Ma Shan Zheng',cursive;font-size:17px;color:var(--ink2)}
.seg .on{color:var(--ink)}
.rule{width:150px;border-top:3px solid var(--ink);padding-top:2px}
.rule div{border-top:1px solid var(--ink)}
.big{font-family:'Liu Jian Mao Cao',cursive;font-size:64px;line-height:1;color:var(--ink)}
.note{font-size:11px;color:var(--ink2);text-align:center}
'''
f_strip = "".join([
    cell("主按钮", f'{f_pri}<button type="button" class="underline">导出 PDF<svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><path d="M2 5 C 30 2, 70 2, 98 4" fill="none" style="stroke: var(--ink)" stroke-width="3" stroke-linecap="round" filter="url(#{P}-fine)"></path></svg></button><span class="note">楷书按钮，角上一方小印</span>'),
    cell("模块标签", f'<div class="mtabs"><a class="mod" href="#">工作台</a><a class="mod on" href="#">{f_dot}绘图</a><a class="mod" href="#">配置</a></div><span class="note">字本身就是装饰；当前项下点一点</span>'),
    cell("选中 · 已完成", f'<div style="width: 100%"><div class="row sel"><span class="nm"><b>第 2 页 · 当前</b><small>2 个点位</small></span></div><div class="row"><span class="nm"><b>第 1 页</b><small>已导出</small></span>{f_done}</div></div>'),
    cell("加载中", f'<svg width="150" height="60" viewBox="0 0 150 60" aria-hidden="true"><path d="M8 34 C 30 26, 70 24, 104 28" fill="none" style="stroke: var(--ink)" stroke-width="11" stroke-linecap="round" filter="url(#{P}-rough)"></path><path d="M104 28 C 120 30, 132 33, 142 38" fill="none" style="stroke: var(--ink)" stroke-width="11" stroke-linecap="round" opacity=".15" filter="url(#{P}-rough)"></path></svg><span class="note">一笔“一”正在写成</span>'),
    cell("开关 · 分段 · 分隔", f'<div class="tog"><i></i></div><div class="seg"><span class="on">横排</span><span>｜</span><span>竖排</span></div><div class="rule"><div></div></div><span class="note">方正的开关；分隔用文武线</span>'),
    cell("空状态", f'<span class="big">开卷</span><span class="note">打开图纸 · 选择 DWG、PDF 或图片开始</span>{f_seal("胥宇", 30)}'),
])
build("Ink3Shufa.dc.html", "水墨方向三 · 书法",
      FONT_SANS + "&amp;family=Ma+Shan+Zheng&amp;family=Long+Cang&amp;family=Liu+Jian+Mao+Cao",
      "--bg:#F6F3EB;--bg2:#EEE9DE;--paper:#FCFAF5;--ink:#121110;--ink2:#6E685E;--line:#E2DBCD;--sel:rgba(18,17,16,.055);--canvas:#EEE9DF;--deco:#121110;--tab-on:#121110;--accent:#121110;--accent-ink:#FCFAF5;--seal:#B32D24;--title-font:'Ma Shan Zheng',cursive;--tab-font:'Ma Shan Zheng',cursive;--tab-size:21px;--title-size:20px;--body-font:'Noto Sans SC',sans-serif;--num-font:'Ma Shan Zheng',cursive;--num-size:21px;--r:0px",
      "--bg:#0F0E0D;--bg2:#0B0A09;--paper:#171614;--ink:#F0EADF;--ink2:#9F988B;--line:#2F2B26;--sel:rgba(201,168,106,.10);--canvas:#131210;--deco:#F0EADF;--tab-on:#C9A86A;--accent:#C9A86A;--accent-ink:#0F0E0D;--seal:#C43B2F",
      f_css,
      {"FILTERS": filters(P), "CVDECO": f_cv, "TABDECO": f_dot, "PRIMARY": f_pri, "DONE": f_done,
       "BRAND": f'<span class="word">胥宇</span>{f_seal("图", 20)}'},
      f_strip)

# =====================================================================================
# 4. 水墨画（竹 · 梅 · 兰）
# =====================================================================================
P = "h"
def h_branch(x, y, s, seed):
    rnd = random.Random(seed)
    segs = [(0, 0, 60, 18), (60, 18, 120, 10), (120, 10, 170, 30), (60, 18, 92, 44), (120, 10, 150, -12)]
    paths = "".join(f'<path d="M{x + a * s:.1f} {y + b * s:.1f} L{x + c * s:.1f} {y + d * s:.1f}" stroke="currentColor" stroke-width="{rnd.uniform(2.2, 4.2) * s:.1f}" stroke-linecap="round" fill="none" filter="url(#{P}-fine)"></path>' for a, b, c, d in segs)
    bl = "".join(blossom(x + bx * s, y + by * s, r * s, "var(--plum)").replace('fill="var(--plum)"', 'style="fill: var(--plum)"') for bx, by, r in [(64, 12, 5.5), (118, 4, 6.5), (166, 26, 5), (94, 46, 4.5), (150, -14, 5), (30, 6, 3.2)])
    return paths + bl
def h_bamboo(x, y, h, s, seed):
    rnd = random.Random(seed)
    out = ""
    seg = 0
    while seg < h:
        L = rnd.uniform(46, 70) * s
        out += f'<rect x="{x - 4 * s:.1f}" y="{y - seg - L:.1f}" width="{8 * s:.1f}" height="{L - 2 * s:.1f}" rx="{2 * s:.1f}" fill="currentColor" opacity=".55"></rect>'
        seg += L
    for i in range(5):
        out += leaf(x + 3 * s, y - h * rnd.uniform(0.35, 0.95), 46 * s, rnd.uniform(-40, 30), "currentColor")
    return out
h_bg = (f'<svg width="1280" height="800" viewBox="0 0 1280 800" aria-hidden="true">'
        f'<g opacity=".55" transform="translate(1290 4) scale(-1 1)">{h_branch(0, 6, 1.35, 131)}</g>'
        f'<g opacity=".18">{h_bamboo(1250, 800, 260, 1, 132)}{h_bamboo(1225, 800, 180, 0.8, 133)}</g></svg>')
h_cv = (f'<svg width="100%" height="100%" viewBox="0 0 700 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" opacity=".18">'
        + "".join(f'<path d="M{30 + i * 10} 700 C {60 + i * 30} {560 - i * 30}, {150 + i * 50} {470 - i * 20}, {240 + i * 60} {420 + i * 25}" stroke-width="{4 - i * 0.6:.1f}" filter="url(#{P}-fine)"></path>' for i in range(5))
        + f'</g><g opacity=".35" transform="translate(470 10)">{h_branch(0, 30, 1.1, 141)}</g></svg>')
h_leaf = f'<svg class="tabdeco" viewBox="0 0 34 10" aria-hidden="true" style="left: 50%; bottom: 6px; width: 34px; height: 10px; margin-left: -17px">{leaf(1, 5, 32, -4, "var(--accent)").replace(chr(102) + "ill=" + chr(34) + "var(--accent)" + chr(34), "style=" + chr(34) + "fill: var(--accent)" + chr(34))}</svg>'
h_bl = lambda size: f'<svg width="{size}" height="{size}" viewBox="0 0 22 22" aria-hidden="true">{blossom(11, 11, 4.6, "var(--plum)").replace(chr(102) + "ill=" + chr(34) + "var(--plum)" + chr(34), "style=" + chr(34) + "fill: var(--plum)" + chr(34))}</svg>'
h_pri = f'<button type="button" class="pri">{h_bl(18)}<span>完成并下一份</span></button>'
h_done = f'<span class="done" aria-label="已完成">{h_bl(22)}</span>'
h_ph = '<svg class="joint" viewBox="0 0 260 6" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="2" width="260" height="2" style="fill: var(--accent)" opacity=".35"></rect><rect x="64" y="0" width="3" height="6" style="fill: var(--accent)" opacity=".6"></rect><rect x="150" y="0" width="3" height="6" style="fill: var(--accent)" opacity=".6"></rect><rect x="226" y="0" width="3" height="6" style="fill: var(--accent)" opacity=".6"></rect></svg>'
h_sel = f'<svg class="selleaf" width="34" height="12" viewBox="0 0 34 12" aria-hidden="true">{leaf(2, 6, 30, -8, "currentColor")}</svg>'
h_css = '''
.bgdeco{color:var(--deco)}
.cvdeco{color:var(--deco)}
.brand .word{font-family:'LXGW WenKai TC',serif;font-size:21px}
.brand .logo{width:30px;height:30px;border-radius:50%;border:1.5px solid var(--accent);display:flex;align-items:center;justify-content:center}
.pri{height:34px;padding:0 16px 0 10px;margin-left:6px;border-radius:var(--r);background:var(--accent);color:var(--accent-ink);font-family:var(--title-font);font-size:15px;display:inline-flex;align-items:center;gap:6px}
.pn.big .ph{border-bottom:0}
.ph .joint{position:absolute;left:0;right:0;bottom:0;width:100%;height:6px}
.selleaf{position:absolute;right:8px;top:50%;margin-top:-6px;color:var(--accent);opacity:.7}
.mtabs{display:flex;gap:2px}
.tog{position:relative;width:56px;height:26px;border-radius:13px;background:var(--sel)}
.tog svg{position:absolute;right:2px;top:2px}
.seg{display:flex;gap:2px;padding:2px;border-radius:var(--r);background:var(--sel);font-size:12px}
.seg span{padding:3px 12px;border-radius:var(--r);color:var(--ink2)}
.seg span.on{background:var(--paper);color:var(--ink)}
.empty{position:relative;width:170px;height:130px;border-radius:var(--r);background:var(--canvas);overflow:hidden;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;padding-right:14px;box-sizing:border-box}
.empty svg{position:absolute;left:0;bottom:0;color:var(--deco)}
.empty b{position:relative;font-family:'LXGW WenKai TC',serif;font-size:21px;font-weight:400}
.empty small{position:relative;font-size:10px;color:var(--ink2);width:86px;text-align:right}
.note{font-size:11px;color:var(--ink2);text-align:center}
'''
bloom_states = "".join(f'<svg width="34" height="34" viewBox="0 0 22 22" aria-hidden="true">{blossom(11, 11, r, "var(--plum)").replace(chr(102) + "ill=" + chr(34) + "var(--plum)" + chr(34), "style=" + chr(34) + "fill: var(--plum)" + chr(34) + " opacity=" + chr(34) + op + chr(34))}</svg>' for r, op in [(2.2, ".45"), (3.4, ".7"), (4.8, "1")])
h_strip = "".join([
    cell("主按钮", f'{h_pri}<button type="button" class="btn">导出 PDF</button><span class="note">主按钮前一朵梅</span>'),
    cell("模块标签", f'<div class="mtabs"><a class="mod" href="#">工作台</a><a class="mod on" href="#">{h_leaf}绘图</a><a class="mod" href="#">配置</a></div><span class="note">当前项下一片竹叶</span>'),
    cell("选中 · 已完成", f'<div style="width: 100%"><div class="row sel">{h_sel}<span class="nm"><b>第 2 页 · 当前</b><small>2 个点位</small></span></div><div class="row"><span class="nm"><b>第 1 页</b><small>已导出</small></span>{h_done}</div></div>'),
    cell("加载中", f'<div style="display: flex; gap: 8px">{bloom_states}</div><span class="note">花苞一点点开，开满就好了</span>'),
    cell("开关 · 分段 · 分隔", f'<div class="tog">{h_bl(22)}</div><div class="seg"><span class="on">横排</span><span>竖排</span></div><svg width="150" height="6" viewBox="0 0 150 6" aria-hidden="true"><rect x="0" y="2" width="150" height="2" style="fill: var(--accent)" opacity=".35"></rect><rect x="48" y="0" width="3" height="6" style="fill: var(--accent)" opacity=".6"></rect><rect x="104" y="0" width="3" height="6" style="fill: var(--accent)" opacity=".6"></rect></svg><span class="note">开关拨到梅花；分隔是一节竹</span>'),
    cell("空状态", f'<div class="empty"><svg width="120" height="130" viewBox="0 0 120 130" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" opacity=".5">' + "".join(f'<path d="M{10 + i * 6} 130 C {20 + i * 16} {90 - i * 12}, {50 + i * 18} {60 - i * 6}, {80 + i * 12} {50 + i * 10}" stroke-width="{2.6 - i * 0.4:.1f}"></path>' for i in range(4)) + f'</g>{blossom(84, 44, 3.4, "x").replace(chr(102) + "ill=" + chr(34) + "x" + chr(34), "style=" + chr(34) + "fill: var(--plum)" + chr(34))}</svg><b>打开图纸</b><small>选择 DWG、PDF 或图片开始</small></div>'),
])
build("Ink4Huahui.dc.html", "水墨方向四 · 竹梅兰",
      FONT_SANS + "&amp;family=LXGW+WenKai+TC",
      "--bg:#EEF0E7;--bg2:#E5E8DC;--paper:#F8F8F2;--ink:#21281F;--ink2:#5E665A;--line:#D1D6C6;--sel:rgba(47,70,50,.09);--canvas:#E4E8DC;--deco:#2F4632;--tab-on:#21281F;--accent:#2F4632;--accent-ink:#F8F8F2;--plum:#B03A4E;--title-font:'LXGW WenKai TC',serif;--tab-font:'LXGW WenKai TC',serif;--tab-size:16px;--title-size:16px;--body-font:'Noto Sans SC',sans-serif;--num-font:'LXGW WenKai TC',serif;--num-size:16px;--r:6px",
      "--bg:#111411;--bg2:#0D100D;--paper:#191E19;--ink:#E2E7DC;--ink2:#98A193;--line:#2B332B;--sel:rgba(159,191,152,.11);--canvas:#141814;--deco:#A9C3A2;--tab-on:#E2E7DC;--accent:#9FBF98;--accent-ink:#0D100D;--plum:#D9637A",
      h_css,
      {"FILTERS": filters(P), "BGDECO": h_bg, "CVDECO": h_cv, "TABDECO": h_leaf, "PRIMARY": h_pri, "DONE": h_done, "PANELDECO": h_ph, "SELDECO": h_sel,
       "BRAND": f'<span class="logo">{h_bl(20)}</span><span class="word">胥宇</span>'},
      h_strip)

# =====================================================================================
# 5. 宣纸与印章
# =====================================================================================
P = "x"
def x_seal(text, w, h, cls="seal", rot=0, fill=True, size=None):
    fs = size or round(min(w, h) * 0.42)
    lines = text.split("|")
    th = "".join(f'<tspan x="{w / 2}" dy="{(0 if i == 0 else fs * 1.05):.1f}">{t}</tspan>' for i, t in enumerate(lines))
    y0 = h / 2 - (len(lines) - 1) * fs * 0.52 + fs * 0.36
    body = (f'<rect x="1.5" y="1.5" width="{w - 3}" height="{h - 3}" rx="2" style="fill: var(--accent)" filter="url(#{P}-fine)"></rect><text x="{w / 2}" y="{y0:.1f}" text-anchor="middle" font-size="{fs}" font-weight="700" font-family="Noto Serif SC, serif" style="fill: var(--accent-ink)">{th}</text>'
            if fill else
            f'<rect x="2" y="2" width="{w - 4}" height="{h - 4}" rx="2" fill="none" style="stroke: var(--accent)" stroke-width="2.2" filter="url(#{P}-fine)"></rect><text x="{w / 2}" y="{y0:.1f}" text-anchor="middle" font-size="{fs}" font-weight="700" font-family="Noto Serif SC, serif" style="fill: var(--accent)" filter="url(#{P}-fine)">{th}</text>')
    return f'<svg class="{cls}" width="{w}" height="{h}" viewBox="0 0 {w} {h}" aria-hidden="true" style="transform: rotate({rot}deg)">{body}</svg>'
x_bg = (f'<svg width="1280" height="800" viewBox="0 0 1280 800" aria-hidden="true"><rect width="1280" height="800" filter="url(#{P}-fiber)" opacity=".07" style="mix-blend-mode: multiply"></rect>'
        + "".join(f'<path d="M{random.Random(i).uniform(0, 1280):.0f} {random.Random(i + 50).uniform(0, 800):.0f} q 40 -8 90 4" fill="none" stroke="currentColor" stroke-width=".7" opacity=".18"></path>' for i in range(26))
        + '</svg>')
x_tab = '<span class="tabdeco slip"><i></i></span>'
x_pri = f'<button type="button" class="pri"><svg viewBox="0 0 140 34" preserveAspectRatio="none" aria-hidden="true"><rect x="1.5" y="1.5" width="137" height="31" rx="2" style="fill: var(--accent)" filter="url(#{P}-fine)"></rect></svg><span>完成并下一份</span></button>'
x_done = f'<span class="done" aria-label="已完成" style="width: 28px; height: 28px">{x_seal("已|成", 26, 26, fill=False, rot=-8, size=10)}</span>'
x_css = '''
.night .bgdeco rect{mix-blend-mode:screen}
.brand .word{font-family:'Noto Serif SC',serif;font-size:19px;font-weight:700}
.pn{border:0;box-shadow:0 1px 0 var(--line),0 6px 16px rgba(60,40,20,.10)}
.pn::before{content:"";position:absolute;inset:0;border:1px solid var(--line);filter:url(#x-fine);pointer-events:none}
.pn.big{padding-left:10px}
.pn.big::after{content:"";position:absolute;left:5px;top:18px;bottom:18px;width:2px;background:repeating-linear-gradient(to bottom,var(--ink2) 0 9px,transparent 9px 40px);opacity:.55}
.slip{inset:9px 4px;border:1px solid var(--ink);background:var(--paper)}
.slip i{position:absolute;right:-4px;top:-4px;width:7px;height:7px;background:var(--accent);border-radius:1px}
.mod.on{font-weight:700}
.pri{height:34px;padding:0 16px;margin-left:6px;color:var(--accent-ink);font-family:'Noto Serif SC',serif;font-size:14px;font-weight:700;letter-spacing:.06em}
.pri svg{position:absolute;inset:0;width:100%;height:100%;z-index:-1}
.row.sel{background:var(--paper);box-shadow:0 2px 6px rgba(60,40,20,.14)}
.scroll{position:relative;z-index:1;padding:18px 14px;background:#D9C8A3;box-shadow:0 10px 28px rgba(40,25,10,.22)}
.night .scroll{background:#5A4632}
.scroll::before,.scroll::after{content:"";position:absolute;left:-14px;right:-14px;height:12px;border-radius:6px;background:linear-gradient(#7a5434,#3d2816)}
.scroll::before{top:-5px}.scroll::after{bottom:-5px}
.scroll .sheet{box-shadow:none}
.mtabs{display:flex;gap:8px;align-items:flex-start;height:70px}
.bm{position:relative;width:30px;padding:8px 0 10px;writing-mode:vertical-rl;text-align:center;font-family:'Noto Serif SC',serif;font-size:13px;background:var(--paper);border:1px solid var(--line);color:var(--ink2)}
.bm.on{height:64px;color:var(--ink);border-color:var(--ink)}
.bm.on::after{content:"";position:absolute;left:50%;bottom:-14px;width:2px;height:14px;margin-left:-1px;background:var(--accent)}
.tag{border:1px solid var(--ink);background:var(--paper);padding:5px 14px;font-family:'Noto Serif SC',serif;letter-spacing:.3em;font-size:13px;color:var(--ink)}
.tog{position:relative;width:56px;height:26px;border:1px solid var(--line);background:var(--sel)}
.tog svg{position:absolute;right:3px;top:3px}
.seg{display:flex;font-size:12px;border:1px solid var(--line)}
.seg span{padding:3px 12px;color:var(--ink2)}
.seg span.on{background:var(--paper);color:var(--ink);box-shadow:inset 0 -2px 0 var(--accent)}
.letter{position:relative;width:150px;height:128px;background:var(--paper);box-shadow:0 2px 8px rgba(60,40,20,.12);background-image:repeating-linear-gradient(90deg,transparent 0 24px,rgba(178,44,36,.28) 24px 25px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
.note{font-size:11px;color:var(--ink2);text-align:center}
'''
x_strip = "".join([
    cell("主按钮", f'{x_pri}<button type="button" class="tag">导出 PDF</button><span class="note">主按钮是一方朱印；次按钮是题签</span>'),
    cell("页签", f'<div class="mtabs"><span class="bm">工作台</span><span class="bm on">绘图</span><span class="bm">配置</span></div><span class="note">像夹在书里的书签</span>'),
    cell("选中 · 已完成", f'<div style="width: 100%"><div class="row sel"><span class="nm"><b>第 2 页 · 当前</b><small>2 个点位</small></span></div><div class="row"><span class="nm"><b>第 1 页</b><small>已导出</small></span>{x_done}</div></div><span class="note">选中的像纸条浮起来</span>'),
    cell("加载中", f'<div style="position: relative; width: 120px; height: 90px">{x_seal("胥|宇", 46, 46, rot=-14, size=15).replace("<svg ", "<svg style=" + chr(34) + "position: absolute; left: 36px; top: 0" + chr(34) + " ", 1)}<div style="position: absolute; left: 30px; top: 52px; width: 60px; height: 26px; opacity: .35">{x_seal("", 60, 26)}</div></div><span class="note">印章落下、印出来</span>'),
    cell("开关 · 分段 · 分隔", f'<div class="tog">{x_seal("开", 20, 20, size=11)}</div><div class="seg"><span class="on">横排</span><span>竖排</span></div><div style="width: 150px; border-top: 1px dashed var(--ink2); opacity: .6"></div><span class="note">开关是一枚小印；分隔像信笺界行</span>'),
    cell("空状态", f'<div class="letter"><span class="tag">打开图纸</span><span class="note" style="font-size: 10px">选择 DWG、PDF 或图片开始</span>{x_seal("胥|宇", 26, 26, size=9)}</div>'),
])
build("Ink5Xuanzhi.dc.html", "水墨方向五 · 宣纸与印章",
      FONT_SANS + "&amp;family=Noto+Serif+SC:wght@500;700",
      "--bg:#EEE3CD;--bg2:#E6D9BF;--paper:#F8F0DF;--ink:#2B231B;--ink2:#6F6252;--line:#D9C9A9;--sel:rgba(178,44,36,.075);--canvas:#E5D8BD;--deco:#5A4632;--tab-on:#2B231B;--accent:#B22C24;--accent-ink:#FCF4E6;--title-font:'Noto Serif SC',serif;--tab-font:'Noto Serif SC',serif;--tab-size:15px;--title-size:15px;--body-font:'Noto Sans SC',sans-serif;--num-font:'Noto Serif SC',serif;--num-size:15px;--r:2px",
      "--bg:#1C1611;--bg2:#16110D;--paper:#271F18;--ink:#EFE3CC;--ink2:#B3A38A;--line:#463A2D;--sel:rgba(200,70,58,.13);--canvas:#201913;--deco:#C9B48F;--tab-on:#EFE3CC;--accent:#C8463A;--accent-ink:#1C1611",
      x_css,
      {"FILTERS": filters(P), "BGDECO": x_bg, "TABDECO": x_tab, "PRIMARY": x_pri, "DONE": x_done, "SHEET_BEFORE": '<div class="scroll">', "SHEET_AFTER": '</div>',
       "BRAND": f'{x_seal("胥|宇", 34, 34, size=12)}<span class="word">胥宇</span>'},
      x_strip)
