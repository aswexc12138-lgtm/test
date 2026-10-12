# 给 Codex 的开工指令

用户把压缩包 `xuyu-redesign-v4.zip` 作为附件发给 Codex 时，把对应方框里的整段话一起发过去（直接复制）。

## 第一段：P0（已完成）

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

## 第二段：P0 之后（连续做完 P1–P6 和安装器）

P0 报告过完以后，把**新的** `xuyu-redesign-v4.zip` 和下面这段话一起发给 Codex：

```text
P0 报告我和 Claude 已经过完了，结论和后面的做法写在新压缩包的 docs/redesign-v4/06-P0结论与连续执行.md 里。这次请一口气做完，中间不用等我验收，全部做完我一次性验收。按顺序：

1. 把附件 xuyu-redesign-v4.zip 在 xuyu 仓库根目录解压，覆盖 docs/redesign-v4/（你写的 P0-对照报告.md 保留不动）。只把 docs/redesign-v4/ 单独提交一次，提交信息“docs: update redesign v4 package after P0”。
2. 先读 06-P0结论与连续执行.md，再按 00-硬约束.md 开头说明的顺序重新读一遍。06 和其他文件冲突时以 06 为准；和协调仓 AGENTS.md 冲突时以 AGENTS 为准并写进报告。
3. 我同意 05-规则修订建议.md 的三处修订（第 16 条去掉副标题、第 12 条圆角按主题变量、新增第 23 条），第 23 条按 06 第一节的写法。请按协调仓正常流程改进 AGENTS.md。
4. 工作区里导入改版包之前就有的那些未提交改动：先在 docs/redesign-v4/reports/进度.md 里按目录列出大概是什么，然后原样单独提交一次（“WIP checkpoint before redesign v4”），不改、不删、不整理。这个提交就是 P1 的起始提交。
5. 然后按 06 第四节连续执行 P1 → P2 → P3 → P4 → P5 → P6 → PI：每个阶段只改 phase-scope 允许的文件，收工前跑完全部检查（全量测试，不只本阶段），写阶段自测报告、登记 traceability，单独提交并同步，更新 reports/进度.md，然后直接进入下一阶段，不用等我。
6. 只有 06 第四节列的三种情况（要改数据格式而规格没写、要删或移动我的文件、会丢数据或坏工程的问题修两次没好）才停下来问我；其他问题选改动最小的做法或跳过那一条，写进报告，接着做。不许删断言、放宽阈值、关掉检查来过关。
7. 我同意：全部做完后跑一次会弹窗口的安装器协议测试（protocol-test.mjs）；全部做完后打一次包（源码 Preview + 安装包）给我验收。不发布、不上传、不碰 main、Tag、Release。
8. 最后写 docs/redesign-v4/reports/最终报告.md（06 第五节），里面要有给我的一次性验收清单。写完告诉我报告路径、安装包路径和最后的提交号。
```

## 用户自己要做的

1. 第一次：把 `xuyu-redesign-v4.zip` 和第一段话发给 Codex（P0，已做完）。第二次：把新的压缩包和第二段话发给 Codex。
2. 想先看看要做成什么样：解压后打开 `docs/redesign-v4/README.md`；安装器看 `reference/installer/screenshots/ink-flow.mp4`，水墨主题看 `reference/themes/previews/inkwash-overview.jpg`。
3. Codex 全部做完后，打开 `reports/最终报告.md`，按里面的一次性验收清单用“胥宇 Preview.lnk”和安装包走一遍；有问题把报告和问题拿回来找 Claude。
4. 每个阶段都是单独提交的：哪个阶段不满意，可以只回退那个阶段。
