#!/usr/bin/env node
/**
 * 跑一个阶段的全部门禁，原样存档输出和退出码（v4 返工，07 文件第二节第 4 条）。
 *
 * 第一轮的问题：最终报告写“trace-check 退出 0”，实际 7 个阶段都是 1。以后报告里的门禁结果一律来自本脚本生成的
 * summary.md（原样贴进阶段报告），不许手写。
 *
 * 用法（xuyu 仓库根目录）：
 *   node docs/redesign-v4/reference/run-gates.mjs --phase P3 --base <本阶段起始提交> [--e2e <e2e 文件> ...] [--repeat 3] [--no-unit] [--no-integration]
 *   --phase final：最终验收前跑，trace-check 查全部阶段、wiring-check 查全部文件、e2e 全量。
 * 输出：docs/redesign-v4/reports/gates/<阶段>/<序号>-<名字>.txt（命令、退出码、完整输出）和 summary.md。
 * 退出码：0 = 全部通过；1 = 有没过的。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const many = (name) => argv.flatMap((a, i) => (a === name && argv[i + 1] ? [argv[i + 1]] : []));
const phase = opt('--phase');
const base = opt('--base');
const repeat = Number(opt('--repeat') ?? 3);
if (!phase || !base) {
  console.error('用法：run-gates.mjs --phase <P1…PI|R0|final> --base <起始提交> [--e2e <文件> ...] [--repeat 3]');
  process.exit(2);
}

const REF = 'docs/redesign-v4/reference';
const SCOPE = `${REF}/phase-scope.json`;
const FIRST = '300cde1';   // 改版开工前的提交（P1 起始），wiring-check 从这里算“新增”
const isFinal = phase === 'final';
const gates = [
  ['typecheck', 'npm run typecheck'],
  ['lint', 'npm run lint'],
  ['metadata', 'npm run metadata:check'],
  ...(argv.includes('--no-unit') ? [] : [['unit', 'npm run test:unit']]),
  ...(argv.includes('--no-integration') ? [] : [['integration', 'npm run test:integration']]),
  ['reference-tests', `node --test ${REF}/diff-guard.test.mjs ${REF}/trace-check.test.mjs ${REF}/wiring-check.test.mjs`],
  ['diff-guard', `node ${REF}/diff-guard.mjs --base ${base}${isFinal ? '' : ` --phase ${phase} --scope ${SCOPE}`}`],
  ['wiring-check', `node ${REF}/wiring-check.mjs --base ${FIRST}${isFinal ? '' : ` --phase ${phase} --scope ${SCOPE}`}`],
  ['trace-check', `node ${REF}/trace-check.mjs --repo . --phase ${isFinal ? 'all' : phase} --scope ${SCOPE}`],
];
const e2eFiles = many('--e2e');
if (isFinal) gates.push(['e2e-all', 'npm run test:e2e']);
if (e2eFiles.length && !isFinal) gates.push(['build', 'npm run build']);
// 本阶段的 e2e 连续跑 3 次（03 G3：任何一次失败都算失败）
for (let n = 1; e2eFiles.length && n <= repeat; n += 1) {
  gates.push([`e2e-run${n}`, `npx playwright test ${e2eFiles.join(' ')} --workers=1`]);
}

const out = path.join('docs/redesign-v4/reports/gates', phase);
mkdirSync(out, { recursive: true });
const rows = [];
gates.forEach(([name, command], index) => {
  const started = Date.now();
  process.stdout.write(`… ${name}: ${command}\n`);
  const r = spawnSync(command, { shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: { ...process.env, FORCE_COLOR: '0' } });
  // 没有任何输出也算没过：第一轮的检查脚本在 Windows 上没真正运行、静默退出 0，就是这样混过去的
  const silent = !`${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
  const code = silent && r.status === 0 ? '0 但没有任何输出（脚本没真正运行？）' : (r.status ?? (r.signal ? `signal ${r.signal}` : 'error'));
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const file = `${String(index + 1).padStart(2, '0')}-${name}.txt`;
  writeFileSync(path.join(out, file), `$ ${command}\n退出码：${code}\n用时：${seconds} 秒\n\n${r.stdout ?? ''}\n${r.stderr ?? ''}${r.error ? `\n${r.error.stack}` : ''}`);
  const tail = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.trim().split('\n').filter(Boolean).slice(-1)[0] ?? '';
  rows.push(`| ${name} | \`${command.replace(/\|/g, '\\|')}\` | ${code === 0 ? '✅ 0' : `❌ ${code}`} | ${seconds} 秒 | [${file}](./${file}) ${tail.replace(/\|/g, '\\|').slice(0, 120)} |`);
  process.stdout.write(`  ${code === 0 ? '通过' : `没过（退出码 ${code}）`}\n`);
});
const failed = rows.filter((row) => row.includes('❌')).length;
const head = spawnSync('git rev-parse HEAD', { shell: true, encoding: 'utf8' }).stdout.trim();
const summary = [
  `# ${phase} 门禁结果（本文件由 run-gates.mjs 生成，原样贴进阶段报告，不许手改）`,
  '',
  `- 提交：\`${head}\`；起始提交：\`${base}\`；时间：${new Date().toISOString()}`,
  `- 结论：${failed ? `**没过：${failed} 项**` : '全部通过'}`,
  '',
  '| 门禁 | 命令 | 退出码 | 用时 | 输出（最后一行） |',
  '|---|---|---|---|---|',
  ...rows,
  '',
].join('\n');
writeFileSync(path.join(out, 'summary.md'), summary);
console.log(`\n${summary}`);
process.exit(failed ? 1 : 0);
