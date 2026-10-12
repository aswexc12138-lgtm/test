#!/usr/bin/env node
/**
 * “做完”检查 · 参考实现（v4，硬约束 R18）
 *
 * 每个阶段结束时，Codex 在 xuyu 里维护 docs/redesign-v4/traceability.json，逐个规格编号登记：
 *   改了哪些文件、哪些测试证明它、界面类的截图、状态。本脚本检查登记是否真实、完整。
 * 接入方式同 diff-guard：挂到现有检查入口，不另起体系。
 *
 * 用法：node trace-check.mjs --repo <xuyu 根目录> --phase P1 --scope phase-scope.json [--trace docs/redesign-v4/traceability.json] [--json]
 * 退出码：0 = 本阶段每个编号都有真实证据且都已完成；1 = 有缺失、造假或未完成；2 = 参数错误。
 *
 * traceability.json 格式：
 * {
 *   "P1": {
 *     "S-02": {
 *       "status": "done",                       // done | already | partial | not-done
 *       "files": ["src/core/equipment.ts"],     // 本编号改动的文件（必须存在）
 *       "tests": ["tests/unit/summary-quantity.test.ts > 手改值等于自动值 → 视为没手改（用户的“奇怪想法”）"],
 *       "screenshots": [],                      // 界面类编号必填，路径必须存在
 *       "note": ""                              // already / partial / not-done 必填说明
 *     }
 *   }
 * }
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const STATUSES = new Set(['done', 'already', 'partial', 'not-done']);
/** 需要截图证据的编号：界面、外壳、主题、动效、工作台、资料整理、安装器，以及汇总的界面部分。 */
export const needsScreenshot = (id) => /^(G|D|T|M|W|A|I|C)-/.test(id) || ['S-04', 'S-07', 'S-11'].includes(id);

function parseArgs(argv) {
  const args = { json: false, trace: 'docs/redesign-v4/traceability.json' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--repo') args.repo = argv[++i];
    else if (argv[i] === '--phase') args.phase = argv[++i];
    else if (argv[i] === '--scope') args.scope = argv[++i];
    else if (argv[i] === '--trace') args.trace = argv[++i];
    else if (argv[i] === '--json') args.json = true;
  }
  if (!args.repo || !args.phase || !args.scope) throw new Error('需要 --repo、--phase、--scope');
  return args;
}

/** 测试引用写成 “文件 > 测试名”；测试名必须以字符串字面量出现在该文件里。 */
function testExists(repo, ref) {
  const at = ref.indexOf(' > ');
  if (at < 0) return `测试引用格式应为“文件 > 测试名”：${ref}`;
  const file = ref.slice(0, at).trim();
  const name = ref.slice(at + 3).trim();
  const full = path.join(repo, file);
  if (!existsSync(full)) return `测试文件不存在：${file}`;
  const text = readFileSync(full, 'utf8');
  const quoted = [`'${name}'`, `"${name}"`, `\`${name}\``];
  if (!quoted.some((q) => text.includes(q))) return `测试文件里找不到这个测试名：${file} > ${name}`;
  return undefined;
}

export function check(repo, scope, phase, trace) {
  const problems = [];
  const unfinished = [];
  const entry = scope.phases?.[phase];
  if (!entry) return { problems: [`phase-scope.json 里没有阶段 ${phase}`], unfinished };
  const records = trace?.[phase] ?? {};
  for (const id of entry.ids ?? []) {
    const r = records[id];
    if (!r) {
      problems.push(`${id}：没有登记`);
      continue;
    }
    if (!STATUSES.has(r.status)) {
      problems.push(`${id}：status 只能是 done / already / partial / not-done`);
      continue;
    }
    if (r.status !== 'done' && !String(r.note ?? '').trim()) problems.push(`${id}：status 为 ${r.status} 时必须写 note 说明原因`);
    if (r.status === 'partial' || r.status === 'not-done') unfinished.push(`${id}（${r.status}）：${r.note ?? ''}`);
    if (r.status === 'already' && !/代码：\S+:\d+/.test(String(r.note ?? ''))) problems.push(`${id}：标为 already 时 note 里要写“代码：文件:行号”作为已实现的证据`);
    if (r.status === 'done') {
      if (!r.files?.length) problems.push(`${id}：done 但没列改动文件`);
      for (const file of r.files ?? []) if (!existsSync(path.join(repo, file))) problems.push(`${id}：改动文件不存在：${file}`);
      if (!r.tests?.length) problems.push(`${id}：done 但没有测试证明`);
      for (const ref of r.tests ?? []) {
        const error = testExists(repo, ref);
        if (error) problems.push(`${id}：${error}`);
      }
    }
    if ((r.status === 'done' || r.status === 'already') && needsScreenshot(id)) {
      if (!r.screenshots?.length) problems.push(`${id}：界面类编号必须附截图`);
      for (const shot of r.screenshots ?? []) if (!existsSync(path.join(repo, shot))) problems.push(`${id}：截图不存在：${shot}`);
    }
  }
  for (const id of Object.keys(records)) if (!(entry.ids ?? []).includes(id)) problems.push(`${id}：不属于 ${phase}，不要登记在这个阶段（防止跨阶段偷做）`);
  return { problems, unfinished };
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  const scope = JSON.parse(readFileSync(path.resolve(args.scope), 'utf8'));
  const tracePath = path.join(args.repo, args.trace);
  const trace = existsSync(tracePath) ? JSON.parse(readFileSync(tracePath, 'utf8')) : {};
  const result = check(args.repo, scope, args.phase, trace);
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    for (const p of result.problems) console.log(`✗ ${p}`);
    for (const u of result.unfinished) console.log(`… 未完成 ${u}`);
    console.log(result.problems.length || result.unfinished.length ? `\n${args.phase} 不能算完成` : `\n${args.phase} 登记完整`);
  }
  process.exit(result.problems.length || result.unfinished.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
