/* 胥宇安装器界面逻辑 · 水墨（规格 §12B · I-2x）
 *
 * 与宿主程序（XuyuSetupUI.exe，WebView2）之间只用这几条消息，字段见规格 I-23：
 *   界面 → 宿主：ready / pickFolder / install / launch / finish / cancel / minimize / drag / openLog / classic / retry
 *   宿主 → 界面：init / pathInfo / appRunning / progress / done / failed
 * 直接用浏览器打开本页时没有宿主，自动使用页面底部的模拟宿主（MockHost），URL 参数控制场景，方便看效果和截图：
 *   ?mode=fresh|upgrade  &running=1  &fail=1  &theme=light|dark  &state=welcome|preparing|installing|done|failed  &p=0.42  &motion=reduced
 */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const reduced = () => document.documentElement.dataset.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 平面图上的点位：进度走到哪，墨点落到哪 ---------- */
  // [x, y, 镜头朝向（度，0 = 向右，顺时针）]，坐标是 index.html 里 svg.plan 的 viewBox（240 × 300）
  const POINTS = [
    [36, 74, 330], [112, 26, 120], [62, 118, 300], [136, 112, 230], [172, 26, 60], [216, 66, 160],
    [176, 120, 300], [216, 160, 200], [26, 158, 20], [76, 156, 330], [120, 176, 250], [60, 212, 0],
    [116, 276, 290], [164, 182, 30], [218, 276, 220], [192, 194, 120], [84, 252, 330], [136, 226, 270],
  ];
  const svgNS = 'http://www.w3.org/2000/svg';
  const pointsLayer = $('points');
  let shownPoints = 0;

  function makePoint([x, y, angle], index, ghost) {
    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', `pt${ghost ? ' is-ghost' : ''}`);
    g.setAttribute('transform', `translate(${x} ${y})`);
    const r = 26;
    const a0 = ((angle - 30) * Math.PI) / 180;
    const a1 = ((angle + 30) * Math.PI) / 180;
    g.innerHTML =
      `<path class="fov" d="M0 0 L${(r * Math.cos(a0)).toFixed(1)} ${(r * Math.sin(a0)).toFixed(1)} A${r} ${r} 0 0 1 ${(r * Math.cos(a1)).toFixed(1)} ${(r * Math.sin(a1)).toFixed(1)} Z"/>` +
      `<circle class="halo" r="6.5"/><circle class="dot" r="${ghost ? 3.4 : 2.9}"/>`;
    g.dataset.index = String(index);
    return g;
  }

  function setPoints(count, { ghost = false, animate = true } = {}) {
    count = Math.max(0, Math.min(POINTS.length, count));
    if (ghost) {
      pointsLayer.replaceChildren(...POINTS.map((p, i) => makePoint(p, i, true)));
      shownPoints = 0;
      return;
    }
    if (count < shownPoints || pointsLayer.querySelector('.is-ghost')) {
      pointsLayer.replaceChildren();
      shownPoints = 0;
    }
    for (let i = shownPoints; i < count; i += 1) {
      const el = makePoint(POINTS[i], i, false);
      if (animate && !reduced()) {
        el.classList.add('is-new');
        el.addEventListener('animationend', (e) => { if (e.target.classList?.contains('halo')) el.classList.remove('is-new'); });
      }
      pointsLayer.appendChild(el);
    }
    shownPoints = count;
  }

  /* ---------- 格式化 ---------- */
  const GB = 1024 ** 3;
  const MB = 1024 ** 2;
  const fmtGB = (bytes) => (bytes >= 100 * GB ? Math.round(bytes / GB) : (bytes / GB).toFixed(1)) + ' GB';
  const fmtMB = (bytes) => Math.round(bytes / MB) + ' MB';
  const driveOf = (dir) => (/^[A-Za-z]:/.test(dir) ? dir.slice(0, 2).toUpperCase() : dir.split('\\').slice(0, 4).join('\\'));

  /* ---------- 状态 ---------- */
  const state = { mode: 'fresh', dir: '', dirSource: '', freeBytes: 0, needBytes: 0, pathOk: true, installing: false, version: '', installedVersion: '' };

  const PRIMARY = { welcome: 'btnInstall', done: 'btnLaunch', failed: 'btnRetry' };
  function setState(name) {
    body.dataset.state = name;
  }

  // 墙“一笔一笔画出来”只在窗口第一次出现时播一次（余晖），之后切换页面不再重播
  function drawPlanOnce() {
    if (reduced() || body.dataset.drawn) return;
    body.dataset.drawn = '1';
    body.classList.add('is-drawing');
    setTimeout(() => body.classList.remove('is-drawing'), 1300);
  }

  // 默认位置由安装器原有逻辑决定（规格 I-22：优先剩余空间最大的非系统盘，自动建 XUYU 文件夹），界面只负责说明“为什么是这里”
  const DIR_NOTE = {
    auto: '剩余空间最大的非系统盘',
    'auto-system': '没有其他本地盘',
  };
  function renderWhere() {
    $('wherePath').textContent = state.dir || '—';
    $('wherePath').title = state.dir;
    $('whereLabel').textContent = state.mode === 'upgrade' ? '位置不变' : '安装到';
    const free = state.pathOk && state.freeBytes ? `${driveOf(state.dir)} 盘剩余 ${fmtGB(state.freeBytes)}` : '';
    const note = state.mode === 'upgrade' ? '' : DIR_NOTE[state.dirSource] ?? '';
    $('whereMeta').textContent = [free, note].filter(Boolean).join(' · ');
    $('btnInstall').disabled = !state.pathOk;
  }

  function showPathError(reason) {
    const where = document.querySelector('.where');
    where.classList.remove('is-invalid');
    void where.offsetWidth;
    where.classList.add('is-invalid');
    $('whereError').textContent = reason;
    $('whereError').hidden = false;
  }

  function applyInit(msg) {
    Object.assign(state, {
      mode: msg.mode === 'upgrade' ? 'upgrade' : 'fresh',
      dir: msg.dir ?? '',
      dirSource: msg.dirSource ?? '',
      freeBytes: msg.freeBytes ?? 0,
      needBytes: msg.needBytes ?? 0,
      pathOk: msg.pathOk !== false,
      version: msg.version ?? '',
      installedVersion: msg.installedVersion ?? '',
    });
    if (msg.theme === 'light' || msg.theme === 'dark') document.documentElement.dataset.theme = msg.theme;
    if (msg.reducedMotion) document.documentElement.dataset.motion = 'reduced';
    body.dataset.mode = state.mode;
    $('version').textContent = state.version;
    const upgrade = state.mode === 'upgrade';
    document.title = upgrade ? '升级胥宇' : '安装胥宇';
    $('welcomeTitle').textContent = upgrade ? '升级胥宇' : '安装胥宇';
    for (const el of document.querySelectorAll('.primaryName')) el.textContent = upgrade ? '升级' : '安装';
    const lead = $('welcomeLead');
    if (upgrade) {
      const v = document.createElement('span');
      v.className = 'lead__version';
      v.textContent = `${state.installedVersion || '当前版本'} → ${state.version}`;
      lead.replaceChildren(v, document.createElement('br'), '图纸、方案和设置都会保留。');
    } else {
      lead.textContent = `需要约 ${fmtMB(state.needBytes)} 空间，通常不到一分钟。`;
    }
    $('runningBanner').hidden = !msg.appRunning;
    $('btnAllUsers').hidden = msg.allUsersAvailable === false;
    renderWhere();
    if (!state.pathOk) showPathError(msg.pathReason || '这个位置用不了，请点“更改”选一个文件夹。');
    if (upgrade) setPoints(0, { ghost: true });
    setState('welcome');
    drawPlanOnce();
  }

  // 进度只来自宿主转来的真实字节数（规格 I-25）：prepare 阶段没有数字，只“蘸墨”；extract 阶段笔画长度 = 已解压 / 总量；finish 阶段写满
  function applyProgress(msg) {
    const phase = msg.phase === 'finish' ? 'finish' : msg.phase === 'extract' ? 'extract' : 'prepare';
    const fraction = phase === 'finish' ? 1 : phase === 'extract' ? Math.max(0, Math.min(1, msg.fraction ?? 0)) : 0;
    const pct = Math.floor(fraction * 100);
    body.dataset.phase = phase;
    $('pctNum').textContent = String(pct);
    $('bar').setAttribute('aria-valuenow', String(pct));
    $('barInk').style.setProperty('--p', String(fraction));
    $('phase').textContent = phase === 'finish'
      ? '正在创建快捷方式…'
      : phase === 'extract'
        ? (msg.bytesTotal ? `正在解压文件 · ${fmtMB(msg.bytesDone ?? 0)} / ${fmtMB(msg.bytesTotal)}` : '正在解压文件…')
        : state.mode === 'upgrade' ? '正在替换旧版本…' : '正在准备…';
    setPoints(Math.floor(fraction * POINTS.length));
  }

  function applyDone() {
    setPoints(POINTS.length, { animate: shownPoints < POINTS.length });
    $('legendText').textContent = `摄像机 × ${POINTS.length}`;
    $('doneLead').textContent = state.mode === 'upgrade'
      ? `已升级到 ${state.version}。以前的图纸、方案和设置都在。`
      : '桌面和开始菜单里都有“胥宇”。';
    state.installing = false;
    setState('done');
  }

  /* ---------- 宿主通道 ---------- */
  const realHost = window.chrome?.webview;
  const host = realHost ? { post: (m) => realHost.postMessage(m) } : new MockHost(onHostMessage);
  if (realHost) realHost.addEventListener('message', (e) => onHostMessage(e.data));

  function onHostMessage(msg) {
    switch (msg?.type) {
      case 'init': applyInit(msg); break;
      case 'pathInfo':
        if (msg.ok) {
          state.dir = msg.dir; state.freeBytes = msg.freeBytes ?? 0; state.pathOk = true; state.dirSource = 'user';
          $('whereError').hidden = true; document.querySelector('.where').classList.remove('is-invalid');
        } else if (msg.reason) {
          state.pathOk = false; showPathError(msg.reason);
        }
        renderWhere();
        break;
      case 'appRunning': $('runningBanner').hidden = !msg.running; break;
      case 'progress': applyProgress(msg); break;
      case 'done': applyProgress({ phase: 'finish' }); applyDone(); break;
      case 'failed':
        state.installing = false;
        $('failReason').textContent = msg.reason || '安装程序意外退出。';
        $('btnLog').hidden = !msg.logPath;
        setState('failed');
        break;
      default: break;
    }
  }

  /* ---------- 交互 ---------- */
  $('btnInstall').addEventListener('click', () => {
    if (!state.pathOk) { showPathError($('whereError').textContent || '请先选一个可用的位置。'); return; }
    state.installing = true;
    applyProgress({ phase: 'prepare' });
    setState('installing');
    host.post({ type: 'install', dir: state.dir });
  });
  $('btnChange').addEventListener('click', () => host.post({ type: 'pickFolder', current: state.dir }));
  // 给所有用户安装需要管理员权限，交给经典安装界面（它有“给谁用”和提权流程，规格 I-21）
  $('btnAllUsers').addEventListener('click', () => host.post({ type: 'classic', allUsers: true }));
  $('btnLaunch').addEventListener('click', () => host.post({ type: 'launch' }));
  $('btnFinish').addEventListener('click', () => host.post({ type: 'finish' }));
  $('btnRetry').addEventListener('click', () => host.post({ type: 'retry' }));
  $('btnClassic').addEventListener('click', () => host.post({ type: 'classic' }));
  $('btnLog').addEventListener('click', () => host.post({ type: 'openLog' }));
  $('btnMin').addEventListener('click', () => host.post({ type: 'minimize' }));
  $('btnClose').addEventListener('click', closeWindow);
  for (const el of document.querySelectorAll('[data-drag]')) {
    el.addEventListener('mousedown', (e) => { if (e.button === 0 && e.target === el) host.post({ type: 'drag' }); });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeWindow();
    // 回车 = 当前页的主按钮（焦点在其他按钮上时让那个按钮自己响应）
    if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
      const id = PRIMARY[body.dataset.state];
      if (id && !$(id).disabled) { e.preventDefault(); $(id).click(); }
    }
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  function closeWindow() {
    const s = body.dataset.state;
    if (s === 'installing') return; // 安装中途不能取消（NSIS 无法安全回滚），只能最小化
    host.post({ type: s === 'welcome' || s === 'loading' ? 'cancel' : 'finish' });
  }

  host.post({ type: 'ready' });

  /* ---------- 模拟宿主：只在浏览器里直接打开时使用 ---------- */
  function MockHost(deliver) {
    const q = new URLSearchParams(location.search);
    const mode = q.get('mode') === 'upgrade' ? 'upgrade' : 'fresh';
    const need = 296 * MB;
    const send = (m) => setTimeout(() => deliver(m), 0);
    if (q.get('motion') === 'reduced') document.documentElement.dataset.motion = 'reduced';
    let timer = 0;
    const FAIL = { type: 'failed', reason: '写入 D:\\XUYU\\resources\\app.asar 时失败：磁盘空间不足（需要 296 MB，剩余 120 MB）。', logPath: 'C:\\Users\\me\\AppData\\Local\\Temp\\xuyu-setup.log' };
    const run = (to, fail) => {
      let f = 0;
      clearInterval(timer);
      setTimeout(() => {                           // 模拟：先准备 0.8 秒，再解压，最后收尾
        timer = setInterval(() => {
          f = Math.min(to, f + 0.035 + Math.random() * 0.03);
          send({ type: 'progress', fraction: f, bytesDone: Math.round(need * f), bytesTotal: need, phase: 'extract' });
          if (f >= to) {
            clearInterval(timer);
            if (fail) { setTimeout(() => send(FAIL), 300); return; }
            send({ type: 'progress', phase: 'finish' });
            setTimeout(() => send({ type: 'done' }), 500);
          }
        }, 220);
      }, 800);
    };
    this.post = (m) => {
      switch (m.type) {
        case 'ready': {
          send({ type: 'init', mode, version: '1.0.0-preview.26', installedVersion: mode === 'upgrade' ? '1.0.0-preview.25' : '', dir: 'D:\\XUYU', dirSource: mode === 'upgrade' ? 'previous' : 'auto', freeBytes: 128.4 * GB, needBytes: need, appRunning: q.get('running') === '1', allUsersAvailable: true, theme: q.get('theme') || undefined });
          const snap = q.get('state');
          const p = Number(q.get('p') ?? 0.42);
          if (snap === 'installing') setTimeout(() => { $('btnInstall').click(); clearInterval(timer); send({ type: 'progress', fraction: p, bytesDone: Math.round(need * p), bytesTotal: need, phase: 'extract' }); }, 30);
          if (snap === 'preparing') setTimeout(() => $('btnInstall').click(), 30);
          if (snap === 'done') setTimeout(() => { $('btnInstall').click(); clearInterval(timer); send({ type: 'done' }); }, 30);
          if (snap === 'failed') setTimeout(() => { $('btnInstall').click(); clearInterval(timer); send(FAIL); }, 30);
          break;
        }
        case 'install': {
          const fail = q.get('fail') === '1';
          if (q.get('state')) break;              // 截图用的定格场景：不跑模拟进度
          run(fail ? 0.63 : 1, fail);
          break;
        }
        case 'pickFolder': send({ type: 'pathInfo', ok: true, dir: 'E:\\Tools\\XUYU', freeBytes: 412 * GB }); break;
        default: console.log('[mock host]', m); break;
      }
    };
  }
})();
