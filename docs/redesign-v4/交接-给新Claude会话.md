# 交接：给接手的 Claude 会话（2026-10-15）

上一个 Claude 会话的账号额度用完，用户换号继续。这份文件写给接手的 Claude：读完它就能接上，不需要旧对话。用户也能看懂。

---

## 一、项目和各方角色

- **产品**：胥宇 / XUYU，Windows 桌面软件（Electron + React + Konva），用来在图纸上布监控点位、汇总设备、导出 PDF，以及季度资料整理、绩效。用户是唯一的开发负责人，中文交流，懂一些技术但不写代码。
- **三个仓库**
  - `aswexc12138-lgtm/xuyu`，分支 `dev`：产品代码。**Claude 只读，不许推送**（用户没授权）。审计时 `git fetch origin dev` 后在本地检出看。
  - `aswexc12138-lgtm/xuyu-project-coordination`：协调仓，`AGENTS.md` 是执行者（Codex）必须遵守的总规则；`CURRENT_STATE.md` 是断点。
  - `aswexc12138-lgtm/test`，分支 `claude/solution-design-uiyw7r`：**Claude 自己的工作分支**，放改版方案包 `docs/redesign-v4/`（就是本文件所在的目录）。只推这个分支；不开 PR，除非用户要求。
- **分工**
  - Claude：写规格和参考实现、写门禁脚本、审计执行者推到 GitHub 的代码、帮用户拍板、给用户写好“发给 Codex 的话”（放在代码块里，用户直接复制）。Claude 在云端容器里，碰不到用户的 Windows，只能通过 GitHub 看代码。
  - Codex：在用户电脑 `D:\my-projects\xuyu` 里实际写代码、跑测试、打包。背后的模型可以切换：原装 GPT，或 DeepSeek-V4-Pro（见第五节）。
  - 用户：在 Claude 和 Codex 之间转话，最后用安装包在真机上验收。
- **用户本机路径**：产品 `D:\my-projects\xuyu`，协调仓 `D:\my-projects\project-coordination`，Preview 交付 `D:\my-projects\delivery\preview\`，Windows 用户名 `QwQ`。

## 二、改版 v4 的来龙去脉（只记要点）

1. Claude 写了方案包 `docs/redesign-v4/`：`00-硬约束`、`02-改版规格`（全部编号 S/D/G/T/M/W/A/C/P/I）、`03-自测规范`、`06-P0结论与连续执行`、`07-审计结论与返工`，以及 `reference/`（参考实现、门禁脚本、水墨安装器、主题令牌）。
2. **第一轮**（Codex，GPT）：大部分界面编号只写了底层没接进软件、测试是“读源码查字符串”、验收清单写了不存在的功能。Claude 审计后写了 07，返工。
3. Claude 自己也犯过错，已修：参考脚本在 Windows 上入口判断失效、静默退出 0；没让 eslint 忽略参考代码；安装器协议测试两项误判；字体许可漏带；D-10“拆分”是照演示页写的、软件里没有（已改规格）；建议过加 `model_auto_compact_token_limit` 后来撤回（DeepSeek 98% 是缓存命中，钱不贵，压缩反而破坏缓存）。
4. **返工**按 R0 → P1 … P6 → PI → 最终执行，每阶段 `run-gates.mjs` 生成门禁存档，`wiring-check`（新东西必须接进软件）、`trace-check`（编号要有带编号的行为测试，界面类要有后台 e2e）、`diff-guard`（G1–G9，G8 是阶段范围）。2026-10-14 起“提速”：阶段 e2e 只跑 1 遍、最终连跑 3 遍；小范围修订执行者自行登记；规格说不清选和现状一致的理解。

## 三、当前状态（2026-10-15 17:00 前后）

| 阶段 | 结束提交 | 审计结论 |
|---|---|---|
| R0 退化修复 | `e3cbaff` | Claude 复跑门禁通过 |
| P1 数据层 | `4e04761` | 通过 |
| 启动器修复 | `a3bd104`（协调仓 `5c41630`） | Preview 双击卡住的原因：构建前 pnpm 递归扫描整个仓库；P5 加了 `pnpm-workspace.yaml` 的 `packages: ['.']` |
| P2 外壳 | `d30929a`（docs `4d4dc95`） | 未单独深审 |
| P3 绘图 | `7d26b8d` | 未单独深审 |
| P4 主题 | `c9371b9`（docs `33b733b`） | 未单独深审 |
| P5 工作台 | `0d10b60`（docs `a367125`） | 未单独深审 |
| P6 资料整理 | `d9f9b7b` + 收尾 `1fae393` | **Claude 已审通过**（复跑门禁、逐条看删掉的断言、对照规格、目视 6 张截图） |
| PI 安装器 | `58581ca` | 未审。安装包 `D:\my-projects\delivery\preview\XUYU-1.0.0-preview.27-Build-261015.01\…-Setup.exe`（不含下面的修复） |
| 最终门禁 | 进行中，最新 `81d64e7` | 见下 |

**最终门禁卡在全量 e2e**：244 例里 19 个失败（都是各阶段没覆盖到的旧 e2e），`81d64e7` 第一轮机械修复后剩约 13 个。**用户已拍板**（已发给 Codex，原文见第七节）：

1. 素材调整对话框输入框里按 Escape 应取消输入、不关对话框——是 P2 加 `useModalInteraction` 抢走了 Escape 造成的退化（基线 `300cde1` 上 `ab-derived-states` 的 Escape 断言是通过的）。改软件，不改测试。
2. 处理外部修改后画布卡在 `rendering`（`p2-source-banners:211`，P2 门禁时通过）——后面阶段引入的退化，`git bisect 4d4dc95..81d64e7` 找根因，改软件。
3. `cad-native:10`：在基线 `300cde1` 上跑同一条，基线也失败才算既有环境问题。
4. `export-layout-and-conflict:99`：单独连跑 3 次，有失败就当真问题。
5. 其余旧测试可改选择器，但报告里每条写“旧断言 → 新断言、为什么测的还是同一件事”；**要核对 `ab-device-panel` 现在只在 CAD 下渲染**——规格 D-13 要求普通 PDF 图纸也有设备浮窗，确认只是改名而不是丢了功能。
6. 修完重新正常打 Preview 包（PI 那个包不含修复），跑 `run-gates --phase final --base e099134 --repeat 3`，写 `reports/返工最终报告.md`，提交同步，`local --prepare` PASS，停下汇报。

用户这时可能正在把 Codex 从 DeepSeek 切回 GPT（额度刚恢复），然后把上面这段发给新的 Codex 对话。

## 四、接手后要做的

1. 等 Codex 汇报最终完成后，**审最终**：
   - `git fetch origin dev`，检出最新；
   - 复跑：`node docs/redesign-v4/reference/trace-check.mjs --repo . --phase all --scope docs/redesign-v4/reference/phase-scope.json`；`wiring-check.mjs --base 300cde1`（全部，不加 --phase）；`diff-guard.mjs --base e099134`（不加 --phase）。忽略你自己工作区里 `.local/` 之类的本地残留。
   - 看 `reports/gates/final/summary.md`：每项退出码 0、e2e 3 遍。
   - 逐条看被删或被改的旧断言：`git diff <起点> HEAD -- tests | grep '^-.*expect('`，确认每条都有同等或更严的替代。
   - 专门核对第三节第 1、2、5 条的修复。
   - 抽看截图（执行者若是 DeepSeek 不能看图，截图标了 UNREVIEWED）。
   - P2–P5、PI 之前没深审过，至少抽查：G-03 标题栏可拖、夜间配色对比度（T-07 测试）、命令面板 Ctrl+K、工作台“已在队列”、安装器包里有 OFL 许可。
2. 审完给用户一份**真机验收步骤**（只放真机才看得出来的：DPI 100/150/200%、WebView2 水墨安装界面实际效果、任务栏进度、真实回收站、窗口贴靠、用自己真实数据的副本走一遍），每条写在哪点、应该看到什么。
3. 用户试用 preview.27 时被提醒过：图纸先用副本；资料整理别在真实目录上“开始整理 / 清理”；先别装 Setup.exe（会替换日常用的版本）。
4. **CAD 一期**（2026-10-15 写好，未发）：任务包在本分支 `docs/cad-v1/`（README + C1–C6 六张卡 + 范围文件 + 块库制作指南 + 开工消息）。v4 验收通过后，把《给Codex的CAD开工指令.md》代码块里的话给用户转发。用户这轮的回答：同事十几个、都能上网、有没有管理员不确定（按没有设计）、同事电脑有没有 CAD 不确定、同事也要交 DWG、代码签名证书暂不买。**ODA 许可**：给同事日常业务用之前要公司确认（旧方案 3.1/3.2 节），已告诉用户和证书一起谈；软件里用团队配置包开关 `cad.odaAllowed` 控制（CAD-22）。

## 五、工具和环境事实

- **Codex 换模型**：PowerShell 运行 `irm https://cdn.deepseek.com/api-docs/codex-deepseek-setup-en.ps1 | iex`，选 `1` deepseek-flash（能看图）、`2` deepseek-v4-pro（更强，不能看图）、`9` 恢复原配置。脚本读用户环境变量 `DEEPSEEK_API_KEY`。换模型后旧对话会按登录方式分组暂时看不到；要新开对话，开工指令必须自包含。
- **切回 GPT 后**建议在 `C:\Users\QwQ\.codex\config.toml` 把 `model_reasoning_effort` 改成 `"high"`、删掉 `service_tier = "priority"`（两者都很费额度）。
- **DeepSeek 费用**：实测 V4-Pro 一小时 1770 万 token，98% 缓存命中，约 1.7 元（按公开报道单价 0.025 / 3 / 6 元每百万：命中 / 未命中 / 输出）。钱不是问题，盯质量。
- Codex 曾自建 DeepSeek 辅助小工具：`D:\my-projects\ai-tools\deepseek\`（账本 `usage.jsonl`），不进仓库。
- **两种 Preview**：桌面“胥宇 Preview”是**源码版**（用正在改的代码现场构建，Codex 干活时别双击）；`delivery\preview\` 下的包是独立的，可以随时用。
- 门禁脚本在 `docs/redesign-v4/reference/`，直接 `node` 运行，不移植。`phase-scope.json` 已同步到 Codex 那边经用户批准的所有范围修订（含 P5 的 `pnpm-workspace.yaml`）。

## 六、和用户打交道（重要）

- 中文、大白话、先给结论。用户精力有限，一次性给能直接复制的“发给 Codex 的话”（代码块）。
- 用户在意额度：Claude 这边常撞 5 小时上限。小问题简短回答；大审计别一次开很多子代理；能让执行者自己跑的就让它跑。
- 用户觉得 Codex“容易飘”。上一个会话的判断：长时间自主运行 + 规则太多（方案包近两千行）+ 没有检查的要求会被忽略。建议过的做法：30 行以内的任务卡、开工前先复述、重要要求做成会报错的检查、AGENTS.md 加“防跑偏”一节（10 行计划、失败 3 次或 2 小时没进展就停、不为流程造工程、汇报 10 行以内大白话、一个阶段一个新对话、思考强度默认高）。是否已加进 AGENTS.md 未确认。
- 用户问过模型额度怎么配：Claude Max（20x 仍常撞墙）、Codex Pro 档、DeepSeek 按量。原则：包月额度花在关键判断上，量大的活给 DeepSeek，写代码和审代码最好不是同一个模型。
- 提交信息结尾加用户系统提示里给的 Co-Authored-By / Claude-Session 行；不在提交、PR 里写模型名以外的内部信息。

## 七、最后一条已发给 Codex 的话（原文）

```text
你接手胥宇改版 v4 返工的最后一段：最终门禁的全量 e2e 还没过（244 例，第一轮修完后剩约 13 个失败）。前面是另一个会话做的，进度以仓库为准。

先读：docs/redesign-v4/reports/进度.md 最上面两条、reports/RPI-返工报告.md、07-审计结论与返工.md 第五、六节、../project-coordination/AGENTS.md。当前最新提交是 81d64e7。用不超过 10 行复述你的理解和计划，然后直接开始。

用户已拍板：
1. 素材调整对话框：在“上边距 %”等输入框里按 Escape，取消这次输入、恢复原值，对话框不关闭；焦点不在输入框时按 Escape，才关闭对话框。这是 P2 加 useModalInteraction 后出现的退化（基线 300cde1 上 ab-derived-states 那条 Escape 断言是通过的）。改软件，不改测试。
2. 处理外部修改后，画布必须回到 ready。p2-source-banners:211 在 P2 门禁时通过、现在失败，是后面某个阶段引入的退化。用 git bisect（4d4dc95 到 81d64e7）找出是哪个提交引入的，修软件，不改测试。
3. cad-native:10：在基线 300cde1 上跑同一条测试。基线也失败，就记为既有的环境问题，附上两边的输出，在最终报告里注明；基线通过，就是本轮退化，要修（只改非 CAD 代码）。
4. export-layout-and-conflict:99：单独连跑 3 次。3 次都过就记为偶发，附上证据；只要有一次失败，就当真问题查。
5. 其余旧测试照常修，但每改一条都在报告里写一行：旧断言 → 新断言，以及为什么测的还是同一件事。不许删断言、不许放宽阈值。如果旧测试暴露的是软件少了东西，就修软件。特别核对：ab-device-panel 现在只在 CAD 图纸上渲染，而规格 D-13 要求普通 PDF 图纸也有设备浮窗。确认它只是换了名字，而不是普通图纸上没了设备浮窗。

修完后：
6. 走正常流程重新打一次 Preview 包，因为 PI 那次打的包不含这些修复。
7. 跑 run-gates --phase final --base e099134 --repeat 3 --e2e <本轮新增或改动的全部 e2e 文件>，全部通过。
8. 写 返工最终报告.md（07 第六节），提交并同步，local --prepare 确认 PASS，然后停下，用 10 行以内汇报：报告路径、新安装包路径、提交号。
同一个问题失败两次就停下汇报，不要硬磨。
```
