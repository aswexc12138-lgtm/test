# 给 Codex 的 CAD 开工指令

**什么时候发**：v4 返工最终验收通过之后。下面代码块里的内容原样发给 Codex。

```
CAD 一期开工。

1. 取任务包：在 xuyu 仓库里运行
   git fetch https://github.com/aswexc12138-lgtm/test.git claude/solution-design-uiyw7r
   git checkout FETCH_HEAD -- docs/cad-v1 docs/redesign-v4/reference/run-gates.mjs docs/redesign-v4/reference/trace-check.mjs docs/redesign-v4/reference/trace-check.test.mjs
   （run-gates 加了 --scope/--trace/--out/--wiring-base 参数，trace-check 支持范围文件里的 ui 列表；v4 的用法不变。）
   单独提交一次：docs: import CAD round 1 package。这个提交就是 C1 的起点，也是 --wiring-base。拿不到就停下告诉我，我发压缩包。
2. 先读 docs/cad-v1/README.md，再按 C1 到 C6 的顺序做。v4 的《00-硬约束》《07-审计结论与返工》仍然有效。
3. 这一轮用你自己的模型，不切 DeepSeek，因为要碰真实图纸。
4. 真实图纸只读 D:\my-projects\cad-samples\样本\，不改、不移、不进仓库、不上传。带文件名的东西只放在 D:\my-projects\cad-samples\；仓库里用 S01 这样的代号。
5. 卡和卡之间不用停。每张卡做完：报告不超过 15 行，附 summary.md，推到 dev，接着做下一张。只有 README 第三节第 6 条列出的情况才停下来问我。
6. C1 装 ODA 时会弹管理员确认：先告诉我，等我回复再点安装。
7. 进度：每张卡开工、做完各报一行。需要我手动核验的，攒到卡结束一次给，每次不超过 3 步。
8. 全部做完：写 docs/cad-v1/reports/CAD一期最终报告.md，打一次 Preview 包，然后停下，给我 10 行以内的总结和所有手动核验步骤的汇总。
```
