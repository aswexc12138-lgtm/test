# 给 Codex 的开工指令

用户把压缩包 `xuyu-redesign-v4.zip` 作为附件发给 Codex 时，把下面方框里的整段话一起发过去（直接复制）。

```text
附件 xuyu-redesign-v4.zip 是胥宇“界面与交互改版 v4”的全部材料（规格、硬约束、自测规范、参考实现、安装器和主题的参考文件）。这一次只做 P0，按顺序来：

1. 在 xuyu 仓库根目录解压。解压后应当得到 docs/redesign-v4/，里面有 00-硬约束.md、01-P0开工前对照.md、02-改版规格.md、03-自测规范.md、reference/ 等。不要改动解压出来的任何文件。
2. 只把 docs/redesign-v4/ 单独提交一次，提交信息写“docs: import redesign v4 package”。按协调仓 AGENTS.md 的规则提交和同步；不要碰 main、Tag、Release，不要改历史，不要 force push。记下这个提交号：它就是 P0 的“起始提交”，以后 diff-guard 的 --base 用它。
3. 先完整读 docs/redesign-v4/00-硬约束.md，那是底线；它和协调仓 AGENTS.md 冲突时以 AGENTS.md 为准，并在报告里指出冲突。
4. 然后按 docs/redesign-v4/01-P0开工前对照.md 执行 P0：只做开工前对照，只新建一份报告 docs/redesign-v4/P0-对照报告.md。不改任何代码、测试、样式、配置、构建脚本，不打包，不运行会弹窗口或改注册表的东西。
5. 规格是 docs/redesign-v4/02-改版规格.md。规格写的现状和代码对不上、看不懂、两条互相矛盾、要改的文件不在范围内——全部写进报告，写清“现象 / 依据（文件:行号）/ 你建议怎么办”，不要自己猜，也不要自己改规格。
6. 01 文件第 3 节的必答问题（共 29 条）每一条都要回答并给依据；查不到的写“不确定”和原因，不许编。需要在 Windows 真机前台操作的（比如第 22 问），先问我同意，或者写进报告让我自己点。
7. docs/redesign-v4/05-规则修订建议.md 是给我看的：我没明确说同意之前，不要改协调仓的 AGENTS.md。
8. 报告写完、提交并同步之后就停下，把报告路径和提交号告诉我。等我回复“P0 通过”之后才能开始 P1。
```

## 用户自己要做的

1. 把 `xuyu-redesign-v4.zip` 和上面那段话一起发给 Codex。
2. 想先看看要做成什么样：解压后打开 `docs/redesign-v4/README.md`；安装器看 `reference/installer/screenshots/ink-flow.mp4`，水墨主题看 `reference/themes/previews/inkwash-overview.jpg`。
3. Codex 交回 `P0-对照报告.md` 后，把报告拿回来和 Claude 逐条过一遍，再回复 Codex“P0 通过”。
4. 之后一个阶段一个阶段来：每个阶段看 Codex 的自测报告，按 `03-自测规范.md` §9 用“胥宇 Preview.lnk”自己验收，回复“PX 验收通过”才进入下一阶段。
5. 安装器（PI 阶段）要打包才能在真机上验收：你明确说“打包”之前，Codex 不会打包。
