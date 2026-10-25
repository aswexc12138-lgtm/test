# v4.1.1 全量 e2e 复核（Claude，Linux，2026-10-26）

用户决定最终验证从简（Codex 只跑本轮改动的 e2e 各 1 遍就打 Preview 34）。Claude 在自己的 Linux 环境把全量 e2e 跑一遍补上。

- 代码：`checkpoint/win-momcdb7bjmt @ 4c5d6609` 加 R-11 补丁（与 dev `8f3c4127` 相同）。
- 对照：v4.1.1 导入提交 `a1d15b14`，即 Preview 33 的代码。
- 跑法：`npx vite build` 加 esbuild 构建；`xvfb-run`，`TZ=Asia/Shanghai`，`CCTV_E2E_HEADLESS=1`。先 3 个 worker 跑全量，失败的再 1 个 worker 单独重跑，并在对照代码上跑同一批。

## 结果

316 条：277 通过，31 失败，8 跳过。31 条失败分四类。

### 一、环境原因，Windows 上不受影响（24 条）

| 测试 | 原因 |
|---|---|
| `cad-native` ×4 | 缺 AutoCAD/ODA，已记为未验证 |
| `p2-export-log:50`、`p2-queue-integrity:83`、`p2-quick-batch-start:346`、`p2-recovery-file-lock:82` ×2、`p2-settings-persistence:187`/`:282`、`v411-f5-results:25` ×2 | 测试自己写明只能在 Windows 上跑 |
| `v411-f6-sources:92` ×2（B-21）、`p6-source-wizard:218` | 整理计划被拦下，原因是“精确文件时间保护仅支持 Windows”。B-21 的目标路径是对的：`季度/独立品牌/文件名.pdf`，跳过了企业层 |
| `completion:815`（OCR）、`p3-file-drop:38`、`p5-workbench-lifecycle:186`/`:292`、`p6-source-preview:176`、`r0-window-theme:39 dark`、`source-library:123`/`:254` | 在 Preview 33 的代码上也失败 |

### 二、并行偶发（1 条）

`p2-close-confirmation:152`：3 个 worker 一起跑时失败，单独重跑和对照代码上都通过。

### 三、旧测试没迁移到本轮新规则，不是软件问题（4 条）

对照代码上都通过，失败原因都是本轮有意改的行为：

1. `p3-merge-export:353`（direct、quarter-company-brand 两例）：
   - 测试先快速导出第 1 份，再批量导出，要求 4 个任务全部成功。
   - 按 B-03，当前版本已经导出过的会跳过，所以只排了 3 个，测试等满 120 秒超时。
   - 迁移：快速导出后对第 1 份改一笔再批量导出，保持原来要证明的“4 份都按原规则导出”；或者断言 3 个任务加“1 份已是最新，跳过”。
2. `p3-save-concurrency:362`：
   - 测试要求已完成图纸关闭后从清单消失。
   - 按 B-01/B-02，已完成的留在今天清单里。
   - 迁移：那一行还在、`data-today-completed="true"`、没有关闭按钮（同 `r0-quantity:305`）。
3. `p6-configuration:139`：
   - 测试按 `[data-command-id="workflow.sample"]` 点击，现在有两个按钮共用这个命令：“从历史目录导入”，以及 B-23 新加的“选择其他文件夹…”，触发严格模式报错。
   - 迁移：测试要的是走系统选择框的那条路，改点“选择其他文件夹…”。

### 四、本轮引入的小问题（2 条，同一个原因）

`p3-exception-durability:105`、`:246`：

- 现象：今天清单里，已打开的异常图纸那一行只显示“异常”，少了“1 页 · 2 点位”。Preview 33 是显示的。
- 原因：F1 改清单来源后，`today-queue.ts` 把异常图纸排除在今天/之前未完成两组之外。App 里补异常行时只带了 `opened`，没带 `candidate`，所以那一行算不出页数和点位。
- 影响：只是显示，打开、保存、解除异常都正常。
- 修法：`patches/next-exception-row-claude-verified.patch`。补异常行时 `candidate` 取已有的，没有就取已打开的那份，和 Preview 33 一致。
- 验证：加补丁后重新构建，`p3-exception-durability`（3 例）、`p3-today-queue`（5 例）、`v411-f1-queue`（6 例）共 14/14 通过。

## 结论

全量里没有发现会影响正常使用的问题。第三类的 4 条测试和第四类的显示问题，放到下一轮一起做，不需要重新打 Preview 34。
