# 演示页代码（v3 原样提取）

从「设备绘图 · 改版参考演示.html」里原样提取的样式和反馈函数，用户在演示页里点过、看过的效果就是这些代码。Codex 按里面的**类名、变量名、关键帧名、函数名**实现，接入 xuyu 的 React 组件；颜色一律走主题变量（规格 T-03）。

| 文件 | 内容 | 对应规格 |
|---|---|---|
| `tokens.base.css` | 字体、字号、间距（4px 网格）、尺寸、动效时长与缓动、焦点环、全局基线（不含颜色） | M-02、T-03 |
| `components.css` | 按钮（按压手感）、图标按钮、分段控件、开关、复选框、输入 / 步进器、标签、角色徽记、状态点、浮窗 `.ui-float`、面板、卡片、列表行、菜单、提示、对话框、Toast、横幅、进度、骨架屏、表格、按键 | M-04、M-05、D-13 |
| `motion.css` | 关键帧与反馈工具类：页面切换、数据变化、错误、成功、定位、拖拽、画布叠加层 | M-01 – M-04 |
| `feedback.js` | `animateNumber` `countUp` `flashRow` `bump` `shake` `flip` `locate` `kbdEcho` `ripple` `staggerDropIn` `confirmButton` `toast` `holdRepeat` `explainDisabled` 等 | M-04 |

颜色在 `../themes/themes.generated.css`。

## 与 v4 规格的已知出入（按规格做）

1. `.ui-role--list`、`.ui-devico--list`、`--role-list*`：属于已撤销的“仅清单设备”角色，删除（X3）。
2. `.ui-float[data-yield="true"]`：浮窗“自动让路”，**待定，不做**（X10）。
3. `--page-shift`：早期模块切换横移的遗留变量，不用（M-03）。`vt-out` / `vt-in` 已是纯淡入淡出，可以用。
4. `diff-guard` 在这几处会报，接入时这样处理：
   - `components.css:33` `.ui-titlebar__mark` 的 `rgb(255 255 255 / 0.18)` 内高光 → 换成主题变量（例如新增 `--mark-highlight`）。
   - `components.css:83` `.ui-seg__thumb`、`:90` `.ui-switch::after` 对 `width` 做过渡（滑块跟随选项宽度、开关按住时“压扁拉长”）→ 优先改成 `transform: scaleX()`；如果改了效果变差，保留 `width` 并在该行写 `v4-allow: G5 绝对定位的装饰元素，不影响布局`。
5. 演示页里 `.count-badge`（设备汇总按钮上的数字徽标）的样式写在演示页专用部分，没有提取；按 `components.css` 的 `.ui-tag` 风格用主题变量实现。
6. `feedback.js` 里用到的 `$` / `$$` 是 `querySelector` / `querySelectorAll` 的简写，`#toastHost`、`#tipHost` 是演示页的容器；在 React 里改成 hook / 组件即可，时长和“减少动效”时的分支保持一致。
