# 参考实现

这些文件是**行为样板**，不是要原样复制进 xuyu 的代码。Codex 按项目结构实现，但必须让这里每个测试用例（输入和期望值不变）在 xuyu 里通过。移植时把 `node:test` 换成 `vitest` 即可。

## 运行

需要 Node 22.6 以上（直接运行 TypeScript）：

```bash
cd docs/redesign-v4/reference
TZ=Asia/Shanghai node --experimental-strip-types --test summary-quantity.test.ts legend-layout.test.ts sun-times.test.ts
node --test diff-guard.test.mjs trace-check.test.mjs wiring-check.test.mjs
node --test installer/tools/protocol-progress.test.mjs
```

结果：58 个测试，全部通过。

`diff-guard.mjs`、`trace-check.mjs`、`wiring-check.mjs`、`run-gates.mjs` 不用移植，在 xuyu 根目录直接运行 `node docs/redesign-v4/reference/<脚本>`（Windows 上也能跑：2026-10-13 修了入口判断，之前在 Windows 路径下会静默退出 0）。

## 文件

| 文件 | 规格 | 要点 |
|---|---|---|
| `summary-quantity.ts` | S-02、S-03、S-08 – S-10、S-14 | 托盘行是唯一来源，`manualTotal` 存手改；手改值等于基准值时自动清掉；手改立即写到图例；点“设备汇总”只原位更新；导出前检查；旧工程迁移不改变图上内容 |
| `legend-layout.ts` | S-05、S-06 | 标签在下方（现状）或右侧（演示页）两种都支持；占位框 = 图片 ∪ 标签；“× 2台”不拆开；型号优先在连字符后断开；为 3 位数量预留占位；横排 / 竖排；避开已有对象；断行结果供屏幕和 PDF 共用 |
| `sun-times.ts` | T-04 | 离线计算日出日落；返回当前白天 / 夜间及下一次切换时刻 |
| `diff-guard.mjs` | 自测规范 §4 | 只看新增行；规则 G1–G9（G5 按动效三档，G8 阶段范围，G9 不许读源码查字符串的测试）；单行豁免必须写理由 |
| `trace-check.mjs` | 硬约束 R19、07 第二节 | 读 xuyu 的 `docs/redesign-v4/traceability.json`，核对本阶段每个编号的改动文件、测试名（要带编号）、截图是否真实存在；界面类要有 e2e；一条测试最多证明 2 个编号；`--phase all` 查全部 |
| `wiring-check.mjs` | 07 第二节 | 从软件入口沿 import 找出会加载的文件，查新增的东西有没有被用到：W1 文件、W2 组件、W3 导出、W4 样式类、W5 动画、W6 preload 接口 |
| `run-gates.mjs` | 07 第二节 | 一个阶段的全部门禁：typecheck、lint、metadata、单元、集成、参考脚本自测、diff-guard、wiring-check、trace-check、本阶段 e2e × 3；输出存 `reports/gates/<阶段>/`，生成 `summary.md` |
| `phase-scope.json` | 硬约束 R4 | 每个阶段允许改的文件和包含的编号；G8 和 trace-check 都读它 |
| `installer/` | 规格 §12B | 水墨安装界面（页面、宿主、NSIS 接入、真实进度、协议测试）和经典向导（脚本、位图），见 `installer/README.md` |
| `demo/` | M-01 – M-05、D-13 | 演示页原样提取的组件、动效、反馈函数，见 `demo/README.md` |
| `themes/themes.generated.css` | T-03 | 9 风格 × 3 模式 + 强调色，演示页原样提取，变量名需按 T-03 映射 |
| `themes/theme-meta.json` | T-01 | 风格名称与描述（10 套）、强调色列表 |
| `themes/make-inkwash.py` → `themes/inkwash.css` | T-10 | 第 10 套风格“水墨”：调色板、生成、对比度与色差校验（不达标不生成）；`inkwash/` 是它用的纸纹和墨块图；`previews/` 是注入演示页的效果图 |

## 注意

- `sun-times.test.ts` 的期望日出日落时间是常见数值，接入时要再对照一份公开日出日落表核对，并把核对来源写进测试注释。
- `legend-layout.ts` 的文字宽度估算公式与 xuyu `src/core/text-layout.ts` 相同（中文 1em、空白 0.35em、其他 0.56em），保证 core 断行结果和现有高度估算口径一致。
- `themes.generated.css` 里现有 5 个强调色的色值作废，沿用软件现有值（规格 T-03）。`--role-list*` 变量删除（撤销清单 X3）。
