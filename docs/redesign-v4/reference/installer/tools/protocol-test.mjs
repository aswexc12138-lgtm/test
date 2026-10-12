#!/usr/bin/env node
// 协议测试：水墨安装界面（宿主）和 NSIS 之间的约定（规格 I-23，I-29 第 3 条）。
//
// 做的事：
//   1. 编出假宿主 StubHost.exe 和假的胥宇 FakeApp.exe（Windows：系统自带 csc；Linux：mcs）；
//   2. 在临时目录搭一个测试工程：app/ = 假胥宇 + 64 MB 填充文件；build/ = 安装器脚本、位图、图标 + installer-ui/（假宿主 + 页面）；
//      appId、产品名、快捷方式名都用测试专用值 —— 注册表里是另一条安装记录，不碰这台电脑上真实的胥宇（协调仓第 5 条）；
//   3. 用仓库里的 electron-builder 打出测试安装包；
//   4. 跑下面的场景并核对；5. 卸载测试安装、删掉测试注册表项和临时目录（--keep 保留现场）。
//
// 用法（xuyu 仓库根目录）：
//   node scripts/installer-ui/protocol-test.mjs [--out <报告目录>] [--keep]
//        [--build-dir build] [--ui-dir scripts/installer-ui/ui] [--electron-builder <cli.js>]
//        [--real-host <目录>]     只在 Linux：目录里放真宿主和 3 个 WebView2 文件，验证“没有 WebView2 运行时 → 经典向导”
//
// Windows：直接运行。场景 4、5、6、8 会弹出经典向导窗口（几秒后自动关掉）—— 需要用户允许前台运行（00-硬约束 R7 第 8 条）。
//          本机必须装有 WebView2 运行时（Windows 11 自带）；“找不到 WebView2”场景只在 Linux 上测。
// Linux：经 wine 运行，需要 64 位 Wine 前缀 + wine-mono、mcs、Xvfb、openbox、xdotool，并先启动 Xvfb + openbox、设好 DISPLAY。
//        Wine 下“胥宇正在运行”的检查会误报（tasklist 过滤不可靠），测试副本里只保留取进程信息那一行；Windows 上用原样脚本。
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WIN = process.platform === 'win32';
const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : def; };
const REPO = path.resolve(opt('--repo', process.cwd()));
const BUILD_DIR = path.resolve(REPO, opt('--build-dir', 'build'));
const UI_DIR = path.resolve(REPO, opt('--ui-dir', 'scripts/installer-ui/ui'));
const OUT = path.resolve(REPO, opt('--out', 'docs/redesign-v4/reports/installer-protocol'));
const EB_CLI = path.resolve(REPO, opt('--electron-builder', 'node_modules/electron-builder/cli.js'));   // pnpm 下这是指向 .pnpm 的链接，同样可用
const REAL_HOST = opt('--real-host', null);
const KEEP = argv.includes('--keep');

const TEST_APP_ID = 'com.caring.xuyu.installer-protocol-test';
const TEST_NAME = '胥宇协议测试';
const WEBVIEW2_KEY = 'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';

// ------------------------------------------------------------------ 平台适配

const wineEnv = (extra = {}) => ({ ...process.env, WINEDEBUG: '-all', ...extra });
function sh(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...options });
  if (options.check && r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} 失败：\n${r.stdout}\n${r.stderr}`);
  return r;
}
const win = (cmd, args, options = {}) => (WIN ? sh(cmd, args, options) : sh('wine', [cmd, ...args], { ...options, env: wineEnv(options.env) }));
const reg = (...args) => win('reg', args);
const toHostPath = (p) => (WIN ? p : sh('winepath', ['-u', p], { env: wineEnv() }).stdout.trim());
const toWinPath = (p) => (WIN ? p : sh('winepath', ['-w', p], { env: wineEnv() }).stdout.trim());
const WIN_TEMP = WIN ? process.env.TEMP : win('cmd', ['/c', 'echo %TEMP%']).stdout.trim();
const TEMP = toHostPath(WIN_TEMP);

function uuidV5(name, namespace) {
  const h = createHash('sha1').update(Buffer.concat([Buffer.from(namespace.replace(/-/g, ''), 'hex'), Buffer.from(name, 'utf8')])).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
const GUID = uuidV5(TEST_APP_ID, '50e065bc-3134-11e6-9bab-38c9862bdaf3');   // 与 electron-builder 的 APP_GUID 算法一致

function windowTitles(setupName) {
  if (WIN) {
    const ps = `(Get-Process -Name '${setupName}' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | ForEach-Object { $_.MainWindowTitle }) -join '|'`;
    return sh('powershell', ['-NoProfile', '-Command', ps]).stdout.trim().split('|').filter(Boolean);
  }
  const ids = sh('xdotool', ['search', '--onlyvisible', '--name', '.+']).stdout.trim().split('\n').filter(Boolean);
  return ids.map((id) => sh('xdotool', ['getwindowname', id]).stdout.trim()).filter(Boolean);
}
function killAll(child) {
  if (WIN) sh('taskkill', ['/F', '/T', '/PID', String(child.pid)]);
  else sh('wineserver', ['-k']);
}
function compileCs(src, out) {
  if (WIN) {
    const csc = path.join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
    sh(csc, ['/nologo', '/langversion:5', '/target:winexe', '/optimize+', '/warnaserror+', `/out:${out}`, src], { check: true });
  } else {
    sh('mcs', ['-langversion:5', '-target:winexe', '-optimize+', `-out:${out}`, src], { check: true });
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ 报告

mkdirSync(OUT, { recursive: true });
const lines = [];
let pass = 0;
let fail = 0;
const say = (s) => { lines.push(s); console.log(s); };
const check = (ok, text) => { if (ok) { pass += 1; say(`  ✓ ${text}`); } else { fail += 1; say(`  ✗ ${text}`); } };
const note = (text) => say(`  · ${text}`);

// ------------------------------------------------------------------ 搭测试工程、打包

function buildTestInstaller(work, hostDir) {
  const app = path.join(work, 'app');
  const build = path.join(work, 'build');
  mkdirSync(path.join(app, 'resources'), { recursive: true });
  mkdirSync(path.join(build, 'installer-ui', 'ui'), { recursive: true });

  compileCs(path.join(HERE, 'FakeApp.cs'), path.join(app, 'XUYU.exe'));
  writeFileSync(path.join(app, 'resources', 'app.asar'), 'asar');
  // 96 MB 伪随机单词（能压缩、但不是重复块），让解压持续一两秒、进度能被观察到
  let seed = 7;
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed >>> 8; };
  const words = Array.from({ length: 5000 }, () => Array.from({ length: 3 + (rnd() % 7) }, () => String.fromCharCode(97 + (rnd() % 26))).join(''));
  const parts = [];
  for (let size = 0; size < 96 * 1024 * 1024;) {
    const block = Buffer.from(Array.from({ length: 20000 }, () => Array.from({ length: 12 }, () => words[rnd() % words.length]).join(' ')).join('\n') + '\n');
    parts.push(block);
    size += block.length;
  }
  writeFileSync(path.join(app, 'resources', 'payload.bin'), Buffer.concat(parts));

  for (const f of ['icon.ico', 'installer-header.bmp', 'installer-sidebar.bmp', 'installer.nsh', 'installer-inkui.nsh', 'xuyu-extract-progress.nsh']) {
    copyFileSync(path.join(BUILD_DIR, f), path.join(build, f));
  }
  if (!WIN) {
    const p = path.join(build, 'installer.nsh');
    const s = readFileSync(p, 'utf8');
    const from = '  !insertmacro IS_POWERSHELL_AVAILABLE\n  !insertmacro _CHECK_APP_RUNNING\n';
    if (!s.includes(from)) throw new Error('installer.nsh 里找不到 _CHECK_APP_RUNNING 两行，测试副本无法改');
    writeFileSync(p, s.replace(from, '  ; [Wine 测试副本] 进程检查在 Wine 下误报，只保留取进程信息这一步\n  ${GetProcessInfo} 0 $pid $1 $2 $3 $4\n'));
  }
  const hostTarget = path.join(build, 'installer-ui');
  if (hostDir) {
    for (const f of ['XuyuSetupUI.exe', 'Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll', 'WebView2Loader.dll']) {
      copyFileSync(path.join(hostDir, f), path.join(hostTarget, f));
    }
  } else {
    compileCs(path.join(HERE, 'StubHost.cs'), path.join(hostTarget, 'XuyuSetupUI.exe'));
    for (const f of ['Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll', 'WebView2Loader.dll']) {
      writeFileSync(path.join(hostTarget, f), 'placeholder');
    }
  }
  cpSync(UI_DIR, path.join(hostTarget, 'ui'), { recursive: true });

  const pkg = existsSync(path.join(REPO, 'package.json')) ? JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8')) : {};
  const electron = String(pkg.devDependencies?.electron ?? pkg.dependencies?.electron ?? '43.1.0').replace(/^[^\d]*/, '');
  writeFileSync(path.join(work, 'package.json'), JSON.stringify({
    name: 'xuyu-installer-protocol-test', version: pkg.version ?? '1.0.0', description: TEST_NAME, author: pkg.author ?? 'Simeon Wu',
  }));
  const nsis = {
    ...(pkg.build?.nsis ?? { oneClick: false, perMachine: false, allowElevation: false, allowToChangeInstallationDirectory: true }),
    shortcutName: TEST_NAME, uninstallDisplayName: TEST_NAME, artifactName: 'ProtocolTest-Setup.${ext}',
    runAfterFinish: true, installerIcon: 'build/icon.ico', uninstallerIcon: 'build/icon.ico',
    installerHeader: 'build/installer-header.bmp', installerSidebar: 'build/installer-sidebar.bmp',
  };
  delete nsis.include;
  writeFileSync(path.join(work, 'eb.json'), JSON.stringify({
    appId: TEST_APP_ID, productName: TEST_NAME, directories: { output: 'out', buildResources: 'build' },
    win: { icon: 'build/icon.ico', executableName: 'XUYU', target: [{ target: 'nsis', arch: ['x64'] }] },
    nsis, compression: 'normal', electronVersion: electron,
  }, null, 1));
  const r = sh(process.execPath, [EB_CLI, '--win', 'nsis', '--x64', '--prepackaged', 'app', '--config', 'eb.json', '--publish', 'never'], { cwd: work, maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(path.join(OUT, hostDir ? 'build-real-host.log' : 'build.log'), `${r.stdout}\n${r.stderr}`);
  const setup = path.join(work, 'out', 'ProtocolTest-Setup.exe');
  if (!existsSync(setup)) throw new Error(`没有打出测试安装包，见 ${path.join(OUT, 'build.log')}`);
  if (/warning \d+:/.test(r.stdout + r.stderr)) throw new Error('makensis 有警告（electron-builder 会当错误处理），见 build.log');
  return setup;
}

// ------------------------------------------------------------------ 运行安装包

// 一直等到安装程序退出（最多 timeoutSec 秒），期间每 250ms 记下可见窗口的标题
async function runToExit(setup, args, env, timeoutSec = 180) {
  const child = WIN ? spawn(setup, args, { env: { ...process.env, ...env } }) : spawn('wine', [setup, ...args], { env: wineEnv(env) });
  let code = null;
  child.on('exit', (c) => { code = c; });
  const titles = new Set();
  const start = Date.now();
  while (code === null) {
    for (const t of windowTitles(path.parse(setup).name)) titles.add(t);
    if (Date.now() - start > timeoutSec * 1000) { killAll(child); return { code: 'timeout', titles }; }
    await sleep(250);
  }
  return { code, titles };
}

// 运行到出现窗口（经典向导）为止，记下等了多久，然后结束
async function runUntilWindow(setup, args, env, maxSec) {
  const child = WIN ? spawn(setup, args, { env: { ...process.env, ...env } }) : spawn('wine', [setup, ...args], { env: wineEnv(env) });
  const start = Date.now();
  let title = '';
  while (Date.now() - start < maxSec * 1000) {
    const t = windowTitles(path.parse(setup).name);
    if (t.length) { title = t[0]; break; }
    await sleep(250);
  }
  const waited = (Date.now() - start) / 1000;
  await sleep(1000);
  killAll(child);
  await sleep(1000);
  return { title, waited };
}

const stubLogPath = path.join(TEMP, 'xuyu-stub.log');
const readStub = () => (existsSync(stubLogPath) ? readFileSync(stubLogPath, 'utf8') : '');
const resetStub = () => rmSync(stubLogPath, { force: true });
const testRoot = path.join(TEMP, 'XuyuProtocolTest');
const testDir = (name) => ({ win: `${WIN_TEMP}\\XuyuProtocolTest\\${name}\\XUYU`, host: path.join(testRoot, name, 'XUYU') });
function forgetInstall() {
  reg('delete', `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${GUID}`, '/f');
  reg('delete', `HKCU\\Software\\${GUID}`, '/f');
}
const installLocation = () => reg('query', `HKCU\\Software\\${GUID}`, '/v', 'InstallLocation').stdout ?? '';
const sessionDirs = () => (existsSync(TEMP) ? readdirSync(TEMP).filter((n) => n.startsWith('XuyuSetupUI-')) : []);
function readStatus(dirName) {
  const p = path.join(TEMP, dirName, 'status.ini');
  if (!existsSync(p)) return '';
  const b = readFileSync(p);
  return (b[0] === 0xff && b[1] === 0xfe ? b.subarray(2).toString('utf16le') : b.toString('utf8')).replace(/\r/g, '');
}

// ------------------------------------------------------------------ 场景

async function main() {
  if (!existsSync(EB_CLI)) throw new Error(`找不到 electron-builder：${EB_CLI}（先 npm ci，或用 --electron-builder 指定）`);
  let addedFakeWebView2 = false;
  if (WIN) {
    const has = reg('query', WEBVIEW2_KEY, '/v', 'pv').status === 0 || reg('query', 'HKCU\\Software\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', '/v', 'pv').status === 0;
    if (!has) throw new Error('这台电脑没有 WebView2 运行时，水墨界面不会启动；请在装有 WebView2 的电脑上跑');
  } else {
    reg('add', WEBVIEW2_KEY, '/v', 'pv', '/d', '130.0.2849.80', '/f', '/reg:64');   // Wine 的 reg 默认走 32 位视图，必须 /reg:64
    addedFakeWebView2 = true;
  }

  const work = mkdtempSync(path.join(tmpdir(), 'xuyu-protocol-'));
  const workDirs = [work];
  const hostLogs = [];
  say(`# 水墨安装界面协议测试（${WIN ? 'Windows' : 'Linux + Wine'}，${new Date().toISOString()}）`);
  say(`测试 appId ${TEST_APP_ID}，APP_GUID ${GUID}，临时目录 ${work}`);
  const setup = buildTestInstaller(work, null);
  say(`测试安装包：${setup}\n`);
  rmSync(testRoot, { recursive: true, force: true });
  rmSync(path.join(TEMP, 'xuyu-launched.txt'), { force: true });
  for (const d of sessionDirs()) rmSync(path.join(TEMP, d), { recursive: true, force: true });

  try {
    say('## 1 全新安装（假宿主选安装位置，完成后点“打开胥宇”）');
    forgetInstall(); resetStub();
    const fresh = testDir('fresh');
    let r = await runToExit(setup, [], { XUYU_STUB: 'install', XUYU_STUB_DIR: fresh.win, XUYU_STUB_AFTER: 'launch' });
    let log = readStub();
    writeFileSync(path.join(OUT, '1.stub.log'), log);
    check(r.code === 0, `安装程序退出码 0（实际 ${r.code}）`);
    check(existsSync(path.join(fresh.host, 'XUYU.exe')) && existsSync(path.join(fresh.host, 'resources', 'payload.bin')), '文件装到了界面选的位置');
    check(/init\.mode=fresh/.test(log), 'init.ini：mode=fresh');
    check(/init\.protocol=1/.test(log) && /init\.needKB=\d+/.test(log), 'init.ini：protocol=1，needKB 有值');
    const src = (log.match(/init\.dirSource=([a-z-]*)/) ?? [])[1];
    check(['auto', 'auto-system', 'default'].includes(src), `init.ini：dirSource 是自动选盘的结果（${src}）；init.dir=${(log.match(/init\.dir=(.*)/) ?? [])[1]}`);
    const extract = [...log.matchAll(/phase=extract extractDone=(\d+)/g)].map((m) => Number(m[1]));
    check(/phase=prepare/.test(log), '进度：先有 prepare');
    check(extract.length >= 3, `进度：extract 阶段至少 3 次真实字节数（${extract.length} 次）`);
    check(extract.every((v, i) => i === 0 || v >= extract[i - 1]), '进度：解压字节数只增不减');
    check(/phase=copy/.test(log) && /phase=finish/.test(log) && /phase=done/.test(log), '进度：copy → finish → done 都出现');
    check(r.titles.size === 0, `全程没有出现 NSIS 窗口（${[...r.titles].join('、') || '无'}）`);
    const lastSession = sessionDirs().pop();
    const status = lastSession ? readStatus(lastSession) : '';
    check(/launchResult=/.test(status), `点“打开胥宇”后 NSIS 执行了启动（launchResult=${(status.match(/launchResult=(.*)/) ?? [])[1] ?? '无'}）`);
    if (existsSync(path.join(TEMP, 'xuyu-launched.txt'))) check(true, '胥宇确实被启动了');
    else if (WIN) check(false, '胥宇确实被启动了');
    else note('胥宇没有真的启动：Wine 不支持 StdUtils 以普通用户身份启动（依赖 Explorer 的 Shell 接口），这项由 Windows 上的运行覆盖');
    check(/XuyuProtocolTest.fresh.XUYU/i.test(installLocation()), '注册表 InstallLocation 指向选的位置');

    say('## 2 升级（再装一次：应显示升级、位置不变）');
    resetStub();
    r = await runToExit(setup, [], { XUYU_STUB: 'install' });
    log = readStub();
    writeFileSync(path.join(OUT, '2.stub.log'), log);
    check(r.code === 0, `退出码 0（实际 ${r.code}）`);
    check(/init\.mode=upgrade/.test(log), 'init.ini：mode=upgrade');
    check(/init\.dirSource=previous/.test(log) && /init\.dir=.*XuyuProtocolTest.fresh.XUYU/i.test(log), 'init.ini：沿用原位置');
    check(/init\.installedVersion=.+/.test(log), 'init.ini：installedVersion 有值');
    check(existsSync(path.join(fresh.host, 'XUYU.exe')), '升级后文件还在');
    check(sessionDirs().length <= 1, `上一次残留的会话目录被清掉（剩 ${sessionDirs().length} 个）`);

    say('## 3 取消');
    forgetInstall(); resetStub();
    const cancelDir = testDir('cancel');
    r = await runToExit(setup, [], { XUYU_STUB: 'cancel', XUYU_STUB_DIR: cancelDir.win });
    check(r.code === 1, `退出码 1（实际 ${r.code}）`);
    check(!existsSync(path.dirname(cancelDir.host)), '什么都没装');
    check(r.titles.size === 0, '没有出现 NSIS 窗口');

    say('## 4 宿主选“经典界面 + 所有用户”');
    resetStub();
    let w = await runUntilWindow(setup, [], { XUYU_STUB: 'classic-all' }, 30);
    check(Boolean(w.title), `经典向导出现了（${w.title || '没有窗口'}，${w.waited.toFixed(1)} 秒）`);

    say('## 5 宿主没给决定就退出（模拟崩溃）');
    resetStub();
    w = await runUntilWindow(setup, [], { XUYU_STUB: 'crash' }, 30);
    check(Boolean(w.title), `经典向导接手（${w.title || '没有窗口'}，${w.waited.toFixed(1)} 秒）`);

    say('## 6 宿主一直不出界面（卡住）');
    resetStub();
    w = await runUntilWindow(setup, [], { XUYU_STUB: 'hang' }, 60);
    check(Boolean(w.title) && w.waited >= 18 && w.waited <= 40, `约 20 秒后经典向导接手（${w.waited.toFixed(1)} 秒）`);

    say('## 7 静默安装 /S（应用内更新走这条）：不启动宿主');
    forgetInstall(); resetStub();
    const silent = testDir('silent');
    r = await runToExit(setup, ['/S', `/D=${silent.win}`], {});
    check(r.code === 0, `退出码 0（实际 ${r.code}）`);
    check(existsSync(path.join(silent.host, 'XUYU.exe')), '装到 /D 指定的位置');
    check(!existsSync(stubLogPath), '没有启动宿主');
    check(r.titles.size === 0, '没有出现任何窗口');

    say('## 8 命令行 /classic：不启动宿主，直接经典向导');
    forgetInstall(); resetStub();
    w = await runUntilWindow(setup, ['/classic'], {}, 30);
    check(Boolean(w.title) && !existsSync(stubLogPath), `经典向导，宿主没启动（${w.title || '没有窗口'}）`);

    if (!WIN) {
      say('## 9 没有 WebView2 运行时：不启动宿主，直接经典向导');
      reg('delete', WEBVIEW2_KEY, '/f', '/reg:64');
      resetStub();
      w = await runUntilWindow(setup, [], {}, 30);
      check(Boolean(w.title) && !existsSync(stubLogPath), `经典向导，宿主没启动（${w.title || '没有窗口'}）`);
      reg('add', WEBVIEW2_KEY, '/v', 'pv', '/d', '130.0.2849.80', '/f', '/reg:64');

      if (REAL_HOST) {
        say('## 10 真宿主：注册表说有 WebView2，实际取不到运行时 → 宿主自己交给经典向导');
        const realWork = mkdtempSync(path.join(tmpdir(), 'xuyu-protocol-real-'));
        workDirs.push(realWork);
        const realSetup = buildTestInstaller(realWork, path.resolve(REAL_HOST));
        const before = new Set(readdirSync(TEMP).filter((n) => n.startsWith('XuyuSetup-') && n.endsWith('.log')));
        w = await runUntilWindow(realSetup, [], {}, 40);
        const hostLog = readdirSync(TEMP).filter((n) => n.startsWith('XuyuSetup-') && n.endsWith('.log') && !before.has(n));
        hostLogs.push(...hostLog);
        const text = hostLog.length ? readFileSync(path.join(TEMP, hostLog[0]), 'utf8') : '';
        writeFileSync(path.join(OUT, '10.host.log'), text);
        check(Boolean(w.title), `经典向导出现了（${w.title || '没有窗口'}，${w.waited.toFixed(1)} 秒）`);
        check(/webview2 runtime check/.test(text), '真宿主日志写明了原因（webview2 runtime check …）');
      }
    }
  } finally {
    // 收尾：卸载测试安装、删测试注册表项、删临时文件
    for (const name of ['fresh', 'silent']) {
      const dir = testDir(name).host;
      const un = existsSync(dir) ? readdirSync(dir).find((n) => /^Uninstall .*\.exe$/i.test(n)) : null;
      if (un) await runToExit(path.join(dir, un), ['/S', `_?=${toWinPath(dir)}`], {}, 120);
    }
    forgetInstall();
    if (addedFakeWebView2) reg('delete', WEBVIEW2_KEY, '/f', '/reg:64');
    if (!KEEP) {
      rmSync(testRoot, { recursive: true, force: true });
      for (const d of workDirs) rmSync(d, { recursive: true, force: true });
      for (const f of hostLogs) rmSync(path.join(TEMP, f), { force: true });
      for (const d of sessionDirs()) rmSync(path.join(TEMP, d), { recursive: true, force: true });
    }
    resetStub();
    rmSync(path.join(TEMP, 'xuyu-launched.txt'), { force: true });
  }

  say(`\n通过 ${pass} 项，失败 ${fail} 项`);
  writeFileSync(path.join(OUT, 'report.md'), lines.join('\n') + '\n');
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e.stack || String(e));
  writeFileSync(path.join(OUT, 'report.md'), lines.join('\n') + `\n\n运行失败：${e.message}\n`);
  process.exit(2);
});
