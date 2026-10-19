# 给 Codex 的 v4.1.1 开工指令

下面代码块原样发给 Codex（在 `WIN-MOMCDB7BJMT`，仓库在 `E:\my_project\tuzhi`）。

```text
胥宇 v4.1.1 修复版开工。修改单在 Claude 的仓库 aswexc12138-lgtm/test，分支 claude/solution-design-uiyw7r。

1. 取任务包：在 xuyu 仓库（dev 最新，应为 b6ee2f5）里运行
   git fetch https://github.com/aswexc12138-lgtm/test.git claude/solution-design-uiyw7r
   git checkout FETCH_HEAD -- docs/redesign-v4.1.1
   单独提交一次：docs: import redesign v4.1.1 fix package。这个提交是“导入提交”：F1 的起始提交，也是 --wiring-base。
2. 先读 docs/redesign-v4.1.1/01-修改单.md，再读同目录的 验收问题.md（A1、A2、A3、A5 是本轮要修的，A4 不做）。规则沿用 docs/redesign-v4.1/00-规则.md；修改单开头写了本轮不同的三条。
3. 按 F1 → F2 → F3 → 最终 一口气做完，阶段之间不用等我。每个阶段：开工先用不超过 10 行复述计划写进报告；只改 docs/redesign-v4.1.1/phase-scope.json 里本阶段允许的文件；收工跑
   node docs/redesign-v4/reference/run-gates.mjs --phase FX --base <本阶段起始提交> --scope docs/redesign-v4.1.1/phase-scope.json --trace docs/redesign-v4.1.1/traceability.json --out docs/redesign-v4.1.1/reports/gates --wiring-base <导入提交> --e2e <本阶段新增或改动的 e2e 文件…>
   没过不许进下一阶段；报告原样贴 summary.md；单独提交并同步。
4. 不新增任何保存字段；本轮要记的东西只放内存。用户的真实数据只读，测试一律用隔离目录和夹具。
5. 只有 v4.1 00-规则第六节那四种情况才停下来问我；其他问题选改动最小的做法，写进报告，接着做。同一个问题失败两次就停下汇报。
6. 进度：每个阶段开工、做完各报一行（阶段、提交号、门禁结果）。
7. 全部做完：最终门禁（改动的 e2e 连跑 3 遍，另外全部 tests/e2e 完整跑 1 遍），走正常流程打 Preview 34，写 docs/redesign-v4.1.1/reports/v4.1.1最终报告.md，提交同步，local --prepare 确认 PASS，checkpoint 保护，然后停下，用 10 行以内告诉我：报告路径、安装包路径、最后的提交号。不发布、不上传、不碰 main / Tag / Release。
```

## 你要做的

1. 发上面这段。
2. Codex 干活时别双击桌面上的源码版“胥宇 Preview”。
3. 它做完后，按报告里的验收清单在 Preview 34 上走一遍。没问题再决定要不要在线发布给同事，发布要你明确跟 Codex 说。
