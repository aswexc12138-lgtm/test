# 安装器（规格 §12B）

双击安装时看到的是**水墨安装界面**（I-20 – I-29）；它用不了的时候（静默安装、没有 WebView2、选“给所有用户安装”等）是**经典向导**（I-01 – I-09）。两者是同一个安装包、同一个 NSIS 安装引擎、同一套默认位置逻辑（优先剩余空间最大的非系统盘 + `XUYU`）。

先看效果：

- `screenshots/ink-flow.mp4`：水墨界面走一遍（墙一笔笔画出来 → 一笔横画是进度、墨点随进度落下 → 装好画一个圆）
- `screenshots/ink-overview.jpg`：水墨界面白天 / 夜间各三页
- `screenshots/compare.png`：经典向导改前改后

## 文件

| 文件 | 用途 | 放到 xuyu |
|---|---|---|
| `installer.nsh` | 完整的安装器扩展脚本：默认位置、经典向导（I-01 – I-08）、水墨界面的接入点 | `build/installer.nsh` |
| `installer-inkui.nsh` | 水墨界面的 NSIS 一侧：要不要用、解出宿主、写 `init.ini`、等决定、切静默、装好后等宿主退出 | `build/` |
| `xuyu-extract-progress.nsh` | 编译期把模板的 `extractUsing7za` 换成会报真实字节数的版本（只多了 `;XUYU` 行） | `build/` |
| `ui/` | 水墨界面（HTML / CSS / JS + 素材 + 字体子集 + 字体许可 `OFL-LXGW-WenKai.txt`）。浏览器直接打开 `index.html` 就有模拟宿主 | `scripts/installer-ui/ui/` |
| `host/XuyuSetupUI.cs`、`host/app.manifest` | 宿主：无边框窗口 + WebView2，C# 5 | `scripts/installer-ui/host/` |
| `host/build-host.cmd`、`host/fetch-webview2.ps1` | 用 Windows 自带的 csc 编译宿主，下载并校验 WebView2 SDK，输出到 `build/installer-ui/`（生成目录） | `scripts/installer-ui/host/` |
| `make-ui-assets.py` | 生成 `ui/` 里的笔触、纸纹、圆相和霞鹜文楷子集；`--check` 检查子集是否覆盖页面用到的字 | `scripts/installer-ui/` |
| `tools/check-extract-template.mjs` | 检查 `xuyu-extract-progress.nsh` 和 electron-builder 模板一致 | `scripts/installer-ui/tools/` |
| `tools/protocol-test.mjs`、`tools/protocol-progress.mjs`（+ `.test.mjs`）、`tools/StubHost.cs`、`tools/FakeApp.cs` | 协议测试：假宿主 + 假胥宇 + 测试专用 appId，跑完自动清理 | `scripts/installer-ui/tools/` |
| `art/`、`make-installer-art.py` | 经典向导的两张位图（1 倍 / 2 倍）和生成脚本 | `build/`（位图） |
| `tools/wine-preview.sh` | 在 Linux + Wine 下运行安装包并截图（经典向导） | 不放 |

## 页面预览（不需要 Windows）

```bash
cd ui && python3 -m http.server 8765      # 遮罩图要同源加载，不能直接用 file:// 打开
# 浏览器打开 http://127.0.0.1:8765/index.html，参数：
#   ?theme=light|dark  &state=welcome|preparing|installing|done|failed  &p=0.42
#   &mode=upgrade  &running=1  &launch=0  &motion=reduced
```

## 已验证（Linux + Wine 9 + wine-mono 8.1，不是 Windows 真机）

**协议测试** `node tools/protocol-test.mjs`（参考仓库里用法见脚本文件头）：用 xuyu 的 `package.json` 配置、electron-builder 26.15.3、本目录的脚本打出测试安装包，结果：

- 全新安装：假宿主选位置 → 全程没有任何 NSIS 窗口；`init.ini` 的 `dir=Z:\XUYU`、`dirSource=auto`（Wine 的 Z: 盘就是剩余空间最大的非系统盘）；进度 `prepare → extract（真实字节数，只增不减）→ copy → finish → done`；文件和注册表都在选的位置；点“打开胥宇”后以普通用户身份启动了（假）胥宇。
- 升级：`mode=upgrade`、`dirSource=previous`、沿用原位置、`installedVersion` 有值；上一次残留的会话目录被清掉。
- 取消：退出码 1，什么都没装。
- 经典 + 所有用户、宿主崩溃、宿主卡住（约 20 秒后接手）、`/classic`、找不到 WebView2：都是经典向导接手。
- `/S /D=…` 静默安装：不启动宿主、退出码 0、装到指定位置。
- **真宿主**（`XuyuSetupUI.exe`，mcs 按 .NET Framework 4.8 引用程序集、C# 5 编译）在 Wine 里：读懂 UTF-16 的 `init.ini`，发现取不到 WebView2 运行时，写 `decision=classic`，日志写明原因，经典向导接手；退出几秒后它自己删掉了会话目录（I-26）。

**编译**：宿主 0 警告；makensis 0 警告（electron-builder 把警告当错误）；`check-extract-template.mjs` 通过；`make-ui-assets.py --check` 通过。

**2026-10-13 修了协议测试的两项判断**（第一轮 Codex 在 Windows 上跑出 28 过 / 2 败，两项都是测试本身的问题）：
- 假胥宇的启动标记改写到安装目录（原来写 `%TEMP%`：经 Explorer 以普通用户身份启动的进程用的是用户自己的 TEMP，和跑测试的进程可能不是同一个目录），并最多等 10 秒；
- “解压至少 3 次回调”改为按实际解压用时算（每 150 ms 一次，至少 1 次、至多要求 3 次），逻辑在 `tools/protocol-progress.mjs`，有单测；真机解压测试包不到 0.5 秒，原来的写法会误判。
- 证据文件改为 `.txt`（`1.stub.txt`、`build.txt` 等），不会被 xuyu 的 `.gitignore`（`*.log`）挡住。

改后在 Linux + Wine 下重跑：**32 项全过**（没带真宿主场景），解压用时 762 ms、记到 4 次真实字节数，假胥宇确实被启动。

**没验证、必须真机看的**（规格 I-29 的人工清单）：WebView2 里水墨页面的真实渲染和动效、DPI 缩放、窗口拖动和圆角阴影、任务栏进度、选择文件夹对话框、路径检查的每种提示、“胥宇正在运行”的检查和关闭（Wine 下这项检查会误报，测试副本里只保留了取进程信息那一行，交付脚本里是完整的）。

## Wine 下的已知差别

- 字体用思源黑体代替微软雅黑，窗口外框是 Linux 的；
- “胥宇正在运行”的进程检查误报（tasklist 过滤不可靠），测试副本里绕开；
- Wine 的 `reg.exe` 默认走 32 位视图，写 `HKLM\SOFTWARE\WOW6432Node\…` 要加 `/reg:64`，否则会套两层 `Wow6432Node`；
- 用 `StdUtils::ExecShellWaitEx` 启动宿主时，拿到的句柄会提前“结束”——所以 `installer-inkui.nsh` 改用 `CreateProcessW` 直接拿宿主的进程句柄（在 Windows 上同样更可靠）。

## 在 Linux 上复现（可选）

```bash
dpkg --add-architecture i386 && apt-get update
apt-get install -y wine wine32:i386 xvfb xdotool imagemagick openbox fonts-noto-cjk locales mono-devel
# wine-mono：从 github.com/madewokherd/wine-mono/releases 下载 wine-mono-8.1.0-x86.msi，wine msiexec /i 安装
Xvfb :97 -screen 0 1100x760x24 & export DISPLAY=:97; openbox &
node tools/protocol-test.mjs --repo <xuyu 目录> --build-dir <放 installer*.nsh、位图、icon.ico 的目录> \
  --ui-dir ui --electron-builder <node_modules/electron-builder/cli.js> --out <报告目录> [--real-host <真宿主目录>]
```

真机验收以 Windows 为准（规格 I-09、I-29）。
