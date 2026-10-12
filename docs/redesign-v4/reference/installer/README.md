# 安装器（规格 §12B）

先看 `screenshots/compare.png`：左边是现在的安装器，右边是改后的四页。

## 文件

| 文件 | 用途 |
|---|---|
| `installer.nsh` | 替换 xuyu 的 `build/installer.nsh`。保留全部现有逻辑，修复 I-03，改为欢迎页骨架，中文字体改微软雅黑，文案统一 |
| `art/installer-sidebar.bmp`、`art/installer-header.bmp` | 替换 `build/` 里同名文件（1 倍）。`@2x` 是 2 倍图，真机 150% 缩放下对比用 |
| `make-installer-art.py` | 生成上面的位图：`python3 make-installer-art.py <icon-master.png> <LXGWWenKai-Medium.ttf> <输出目录>`。需要 Pillow 和霞鹜文楷字体（只用来画字，不随安装包分发） |
| `screenshots/` | `before-welcome.png` 现在；`after-1…5` 改后欢迎页、进度页、完成页、卸载页、升级时的欢迎页；`compare.png` 对比 |
| `tools/wine-preview.sh` | 在 Linux 上用 Wine 运行安装包并截图（见下） |

## 已验证（Linux + Wine，不是 Windows 真机）

- electron-builder 26.15.3 + 本脚本编译：0 个 NSIS 警告。
- 全新安装、默认路径：点“开始安装”能继续，文件装到位。
- 升级：欢迎页提示“检测到已安装的胥宇，沿用原来的位置升级。”
- 静默安装 `XUYU-Setup.exe /S /D=C:\SilentTest\XUYU`：退出码 0，文件齐全。
- 卸载欢迎页显示正常。

Wine 下的差别：字体用思源黑体代替微软雅黑，窗口外框是 Linux 的；“胥宇正在运行”的进程检查在 Wine 下会误报，截图时在**测试副本**里临时关掉，交付的 `installer.nsh` 没有关。

## 怎么在 Linux 上复现截图（可选）

```bash
# Ubuntu 24.04：makensis 不需要，electron-builder 自带；需要 32 位 Wine 跑 NSIS 安装包
dpkg --add-architecture i386 && apt-get update
apt-get install -y wine wine32:i386 xvfb xdotool imagemagick openbox fonts-noto-cjk locales
# 把微软雅黑等字体映射到思源黑体
for f in "Microsoft YaHei UI" "Microsoft YaHei" "MS Shell Dlg" "MS Shell Dlg 2" "SimSun"; do
  wine reg add "HKCU\\Software\\Wine\\Fonts\\Replacements" /v "$f" /d "Noto Sans CJK SC" /f; done
# 用空壳程序目录打包：electron-builder --win nsis --x64 --prepackaged <含 XUYU.exe 和 resources/ 的目录> --config <从 package.json 抄的 build 配置，加 electronVersion>
bash tools/wine-preview.sh out/XUYU-Setup.exe screenshots/run
```

真机验收以 Windows 为准（规格 I-09）。
