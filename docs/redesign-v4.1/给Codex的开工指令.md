# 给 Codex 的 v4.1 开工指令

**什么时候发**：现在。v4 已经验收，这一轮从 `dev` 最新提交开始。下面代码块里的内容原样发给 Codex。

**模型**：这一轮要对照设计稿截图做界面，用能看图的模型（原装 GPT）。用 DeepSeek-V4-Pro 也能做，但它看不了图，截图会标 `UNREVIEWED`，最后要你自己多看一眼。

```text
胥宇界面改版 v4.1 开工。任务包在 Claude 的分支上，规格、范围文件、设计稿截图都在里面。

1. 取任务包：在 xuyu 仓库（dev 最新）里运行
   git fetch https://github.com/aswexc12138-lgtm/test.git claude/solution-design-uiyw7r
   git checkout FETCH_HEAD -- docs/redesign-v4.1 docs/redesign-v4/reference/run-gates.mjs docs/redesign-v4/reference/trace-check.mjs docs/redesign-v4/reference/trace-check.test.mjs
   （run-gates 加了 --scope/--trace/--out/--wiring-base 参数，trace-check 支持范围文件里的 ui 列表；v4 的用法不变。）
   单独提交一次：docs: import redesign v4.1 package。这个提交就是“导入提交”：Q1 的起始提交，也是 --wiring-base。拿不到就停下告诉我，我发压缩包。
2. 先读 docs/redesign-v4.1/00-规则.md，再读 01-规格.md，再看 设计稿/截图/ 的 15 张图，再看 界面问题清单.md 第六节的原有功能对照表。v4 的 00-硬约束.md、07-审计结论与返工.md 仍然有效，和 v4.1 的 00-规则冲突时以 00-规则为准。设计稿 .dc.html 不能直接打开，看截图，样式和动画参数从源码里抄。
3. 按 Q1 → Q2 → Q3 → Q4 → Q5 → Q6 → Q7 → 最终 一口气做完，阶段之间不用等我。每个阶段：开工先用不超过 10 行复述计划写进报告；只改 phase-scope.json 里本阶段允许的文件；收工跑 00-规则第二节那条 run-gates 命令，没过不许进下一阶段；报告原样贴 summary.md；单独提交并同步。
4. “做完”按 00-规则第三节：软件里看得到、有带编号的行为测试、界面类有后台 e2e（CCTV_E2E_HEADLESS=1，不抢前台）、有截图并和设计稿截图并排对照。不许用 partial 往下走，不许删断言、放宽阈值、关检查。
5. 原有功能对照表里的每一行都必须在新界面里找得到，表里没有的不许删。最终报告里逐行打勾，写新位置和证明它的测试名。
6. 只有 00-规则第六节列的四种情况才停下来问我；其他问题选改动最小的做法，写进报告，接着做。同一个问题失败两次就停下汇报，不要硬磨。
7. 进度：每个阶段开工、做完各报一行（阶段、提交号、门禁结果）。
8. 全部做完：跑 run-gates --phase final（--repeat 3），走正常流程打一次 Preview 包（源码 Preview + 安装包），写 docs/redesign-v4.1/reports/v4.1最终报告.md（01-规格最后一节），提交同步，local --prepare 确认 PASS，然后停下，用 10 行以内告诉我：报告路径、安装包路径、最后的提交号。不发布、不上传、不碰 main / Tag / Release。
```

## 你要做的

1. 把上面代码块发给 Codex。
2. Codex 干活的时候，别双击桌面上的“胥宇 Preview”（源码版会和它抢构建）。要用软件，用 `delivery\preview\` 下面打好的包。
3. 它做完后，按 `reports/v4.1最终报告.md` 的验收清单走一遍；有问题把报告和问题拿回来找 Claude，或者让 Codex 推到 GitHub，Claude 直接看代码审。
