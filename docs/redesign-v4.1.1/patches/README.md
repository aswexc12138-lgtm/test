# F1 补丁（Claude 已验证，2026-10-23）

`f1-claude-verified.patch` 针对 Codex 的 F1 WIP（远端 `checkpoint/win-momcdb7bjmt @ e76762db`，F4 追加导入提交 `b267879d` 之上）。

Claude 在自己的 Linux 容器里验证过：
- WIP 加上这个补丁后重新构建，`tests/e2e/v411-f1-queue.e2e.test.ts --repeat-each=3 --workers=1` 共 15 次全部通过，没有改超时、没删断言；
- 改动文件的 ESLint 干净，`tsc -p tsconfig.json --noEmit` 退出 0。

| 文件 | 改了什么 | 为什么 |
|---|---|---|
| `tests/e2e/v411-fixtures.ts` | 夹具配置先过一遍 `syncLegacySummaryPreset`；每份夹具图纸把用到的摄像机素材字节写进 `assetDataById` | 软件读配置时会把 `equipmentSummaryPreset` 同步成默认汇总组合（×1 变 ×2），夹具图纸的方案快照还是 ×1，两边对不上。图纸一冻结（已完成或已导出），软件就靠“快照和配置完全一致”或“图纸自带的素材字节”找设备素材，两条都不满足，设备浮窗只剩类别按钮，于是找不到 `add-team-asset-camera-traffic`。软件自己保存的图纸两条都满足（`projectForPersistence` 会写入素材字节），所以是夹具不真实，不是软件问题。实测：只加素材字节，按钮就出现。 |
| `tests/e2e/v411-f1-queue.e2e.test.ts`（B-03） | 改为到项目库归档目录里数 `project.cctv.json`：只有 done 那份、导出记录 1 条 | 导出会把工作归档到项目库（`archive/未分类/<名字>/project.cctv.json`），导出记录写在那里，不写回测试打开的原夹具文件。实测原文件 0 条、归档文件 1 条。新断言要求“只归档了 done 一份”，同时覆盖了原来“另外两份没导出”的检查，强度不降。用到 `readdir` 的 `recursive`，需要 Node 20 及以上。 |
| `src/renderer/App.tsx`（`uncompleteCurrent`） | 解除完成时加上 `recoveryEligible: true` | 和“完成并下一份”（同文件约 3109 行）对称。原来没有这个标记的图纸，解除完成后自动保存不会写它，恢复记录一直停在“已完成”，B-05 等不到“editing”。 |

还没处理、要 Codex 按新规则迁移的旧测试（Claude 在 Linux 上跑过，只要 Windows 的那几条跑不了）：
- `p3-today-queue.e2e.test.ts` 第 11 行和第 272 行两条：旧的未完成记录现在在默认折叠的“之前未完成”里（B-01），要先展开；“完成并下一份”不再自动打开旧记录（B-04），原来“完成后切到旧记录”“完成时报告旧记录源文件缺失”的检查，要改成手动从“之前未完成”打开同一份记录再检查同样的结果。
- `p2-quick-batch-start.e2e.test.ts` 第 74 行：只开着一张时完成并下一份，提示改为“今天的都做完了”。第 193 行那条后半段原来要求同一张图连续两次批量导出都成功；按 B-03，没改过的已导出图纸会被跳过（“1 份已是最新，跳过”）。要保留“成功后还能再次真实导出”的意思，就在两次导出之间改一笔，再断言第二次导出成功。第 331 行那条只能在 Windows 上跑。
- `p2-export-log.e2e.test.ts` 第 48 行 J9 只能在 Windows 上跑，Claude 没跑到，请 Codex 跑后按同样原则迁移。
