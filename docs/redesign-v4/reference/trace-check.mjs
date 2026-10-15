#!/usr/bin/env node
/**
 * “做完”检查 · 参考实现（v4，硬约束 R18）
 *
 * 每个阶段结束时，Codex 在 xuyu 里维护 docs/redesign-v4/traceability.json，逐个规格编号登记：
 *   改了哪些文件、哪些测试证明它、界面类的截图、状态。本脚本检查登记是否真实、完整。
 * 接入方式同 diff-guard：挂到现有检查入口，不另起体系。
 *
 * 用法：node trace-check.mjs --repo <xuyu 根目录> --phase P1|all --scope phase-scope.json [--trace docs/redesign-v4/traceability.json] [--json]
 *   --phase all：一次查所有带编号的阶段（最终报告前跑这个）。
 * 退出码：0 = 本阶段每个编号都有真实证据且都已完成；1 = 有缺失、造假或未完成（partial / not-done 一律算没完成）；2 = 参数错误。
 *
 * 返工（07 文件）新增的规则：
 *   - tests/ 下的测试，测试名里要带它证明的编号（例如 'S-02 属性浮窗改数量写的是托盘行'）；
 *   - 同一条测试最多证明 2 个编号（第一轮 16 个编号挂在同一条测试上）；
 *   - 证明用的测试文件不能是“把源代码当文本读来查字符串”的写法（diff-guard G9）；
 *   - 界面类编号（I- 安装器除外）标 done 时，至少有一条 tests/e2e/ 的测试在软件里真的操作过。
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
import { fileURLToPath } from 'node:url';

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

/** 界面类编号里，安装器（I-）用协议测试和脚本证明，不要求 e2e。 */
export const needsE2E = (id) => needsScreenshot(id) && !id.startsWith('I-');
/** 和 diff-guard G9 同一个判断：测试文件把 src/、electron/ 的代码当文本读。 */
const SOURCE_TEXT_TEST = /\breadFile(?:Sync)?\s*\([^;]*['"`](?:\.{1,2}\/)*(?:src|electron)\/(?:(?!renderer\/themes\/)[^'"`]*\.css|[^'"`]*\.[cm]?[jt]sx?)['"`]|from\s+['"][^'"]*(?:src|electron)\/[^'"]*\?raw['"]/;

const splitRef = (ref) => {
  const at = ref.indexOf(' > ');
  return at < 0 ? undefined : { file: ref.slice(0, at).trim(), name: ref.slice(at + 3).trim() };
};

/** 测试引用写成 “文件 > 测试名”；测试名必须以字符串字面量出现在该文件里。 */
function testExists(repo, ref, id) {
  const parts = splitRef(ref);
  if (!parts) return `测试引用格式应为“文件 > 测试名”：${ref}`;
  const { file, name } = parts;
  const full = path.join(repo, file);
  if (!existsSync(full)) return `测试文件不存在：${file}`;
  const text = readFileSync(full, 'utf8');
  const quoted = [`'${name}'`, `"${name}"`, `\`${name}\``];
  if (!quoted.some((q) => text.includes(q))) return `测试文件里找不到这个测试名：${file} > ${name}`;
  if (SOURCE_TEXT_TEST.test(text)) return `测试文件把源代码当文本读来查字符串（G9），证明不了软件的行为：${file}`;
  if (file.startsWith('tests/') && !name.includes(id)) return `测试名里要带编号（例如“${id} …”）：${file} > ${name}`;
  return undefined;
}

export function check(repo, scope, phase, trace) {
  const problems = [];
  const unfinished = [];
  const entry = scope.phases?.[phase];
  if (!entry) return { problems: [`phase-scope.json 里没有阶段 ${phase}`], unfinished };
  const records = trace?.[phase] ?? {};
  // 范围文件里阶段的 ui 列表：别的轮次（例如 CAD 轮）用它标出界面类编号，不靠编号前缀
  const ui = new Set(entry.ui ?? []);
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
        const error = testExists(repo, ref, id);
        if (error) problems.push(`${id}：${error}`);
      }
      if ((needsE2E(id) || ui.has(id)) && !(r.tests ?? []).some((ref) => ref.startsWith('tests/e2e/'))) {
        problems.push(`${id}：界面类编号要有 tests/e2e/ 的测试在软件里真的操作过（后台模式 CCTV_E2E_HEADLESS=1，不抢前台）`);
      }
    }
    if ((r.status === 'done' || r.status === 'already') && (needsScreenshot(id) || ui.has(id))) {
      if (!r.screenshots?.length) problems.push(`${id}：界面类编号必须附截图`);
      for (const shot of r.screenshots ?? []) if (!existsSync(path.join(repo, shot))) problems.push(`${id}：截图不存在：${shot}`);
    }
  }
  for (const id of Object.keys(records)) if (!(entry.ids ?? []).includes(id)) problems.push(`${id}：不属于 ${phase}，不要登记在这个阶段（防止跨阶段偷做）`);
  const users = new Map();
  for (const [id, r] of Object.entries(records)) for (const ref of r.tests ?? []) users.set(ref, [...(users.get(ref) ?? []), id]);
  for (const [ref, ids] of users) if (ids.length > 2) problems.push(`${ids.join('、')}：${ids.length} 个编号用同一条测试证明（最多 2 个）：${ref}`);
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
  const phases = args.phase === 'all' ? Object.keys(scope.phases ?? {}).filter((p) => scope.phases[p].ids?.length) : [args.phase];
  let failed = false;
  const all = {};
  for (const phase of phases) {
    const result = check(args.repo, scope, phase, trace);
    all[phase] = result;
    failed ||= Boolean(result.problems.length || result.unfinished.length);
    if (args.json) continue;
    for (const p of result.problems) console.log(`✗ ${phase} ${p}`);
    for (const u of result.unfinished) console.log(`… ${phase} 未完成 ${u}`);
    console.log(result.problems.length || result.unfinished.length ? `${phase} 不能算完成\n` : `${phase} 登记完整\n`);
  }
  if (args.json) console.log(JSON.stringify(args.phase === 'all' ? all : all[args.phase], null, 2));
  process.exit(failed ? 1 : 0);
}

// 是否被直接运行：比较真实路径。不要写 import.meta.url === `file://${process.argv[1]}` ——
// 在 Windows（D:\…）或路径里有中文、空格时永远不相等，脚本会什么都不做、静默退出 0（第一轮就是这样）。
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const selfPath = fileURLToPath(import.meta.url);
if (process.platform === 'win32' ? invokedPath.toLowerCase() === selfPath.toLowerCase() : invokedPath === selfPath) main();
