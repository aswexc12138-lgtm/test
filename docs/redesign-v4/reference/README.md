# 参考实现

这些文件是**行为样板**，不是要原样复制进 xuyu 的代码。Codex 按项目结构实现，但必须让这里每个测试用例（输入和期望值不变）在 xuyu 里通过。移植时把 `node:test` 换成 `vitest` 即可。

## 运行

需要 Node 22.6 以上（直接运行 TypeScript）：

```bash
cd docs/redesign-v4/reference
TZ=Asia/Shanghai node --experimental-strip-types --test summary-quantity.test.ts legend-layout.test.ts sun-times.test.ts
node --test diff-guard.test.mjs
```

结果：36 个测试，全部通过。

## 文件

| 文件 | 规格 | 要点 |
|---|---|---|
| `summary-quantity.ts` | S-02、S-03、S-08 – S-10、S-14 | 托盘行是唯一来源，`manualTotal` 存手改；手改值等于基准值时自动清掉；手改立即写到图例；点“设备汇总”只原位更新；导出前检查；旧工程迁移不改变图上内容 |
| `legend-layout.ts` | S-05、S-06 | 占位框 = 图片 ∪ 标签；“× 2台”不拆开；型号优先在连字符后断开；为 3 位数量预留占位；横排 / 竖排；避开已有对象；断行结果供屏幕和 PDF 共用 |
| `sun-times.ts` | T-04 | 离线计算日出日落；返回当前白天 / 夜间及下一次切换时刻 |
| `diff-guard.mjs` | 自测规范 §4 | 只看新增行；规则 G1–G7（G5 按动效三档）；单行豁免必须写理由 |
| `demo/` | M-01 – M-05、D-13 | 演示页原样提取的组件、动效、反馈函数，见 `demo/README.md` |
| `themes/themes.generated.css` | T-03 | 9 风格 × 3 模式 + 强调色，演示页原样提取，变量名需按 T-03 映射 |
| `themes/theme-meta.json` | T-01 | 风格名称与描述、强调色列表 |

## 注意

- `sun-times.test.ts` 的期望日出日落时间是常见数值，接入时要再对照一份公开日出日落表核对，并把核对来源写进测试注释。
- `legend-layout.ts` 的文字宽度估算公式与 xuyu `src/core/text-layout.ts` 相同（中文 1em、空白 0.35em、其他 0.56em），保证 core 断行结果和现有高度估算口径一致。
- `themes.generated.css` 里现有 5 个强调色的色值作废，沿用软件现有值（规格 T-03）。`--role-list*` 变量删除（撤销清单 X3）。
