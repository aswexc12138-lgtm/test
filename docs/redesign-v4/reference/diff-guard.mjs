#!/usr/bin/env node
/**
 * 改版防跑偏检查 · 参考实现（v4；2026-10-13 加 G9，修 Windows 上不运行的问题）
 *
 * 只检查“本次改动新增的行”（git diff <base> -U0），不追究历史代码。
 * 接入方式：由 Codex 挂到现有入口（xuyu 的 lint / `project-handoff.mjs check` 或 `ui-audit`）里调用，
 * 不要另起一个平行的检查体系（协调仓 AGENTS 第 20 条）。
 *
 * 用法：node diff-guard.mjs --base <git-ref> [--repo <path>] [--phase P1 --scope phase-scope.json] [--json]
 *   --phase/--scope：开启 G8，检查本阶段是否改了范围外的文件。
 * 退出码：0 = 通过；1 = 有违规；2 = 参数或 git 出错。
 *
 * 单行豁免：在同一行写  `v4-allow: <规则号> <理由>`（理由必填）。所有豁免会列在输出里，必须写进自测报告。
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RULES = [
  {
    id: 'G1',
    title: '测试不许跳过 / 只跑一部分',
    files: /^tests\/|\.test\.[cm]?[jt]sx?$|\.spec\.[cm]?[jt]sx?$/,
    pattern: /\b(?:it|test|describe)\.(?:skip|only|fixme|todo)\s*\(|\bx(?:it|describe|test)\s*\(/,
  },
  {
    id: 'G2',
    title: '测试不许用固定时长等待，改为等可观测的状态',
    files: /^tests\/|\.test\.[cm]?[jt]sx?$|\.spec\.[cm]?[jt]sx?$/,
    pattern: /\bwaitForTimeout\s*\(|\bsleep\s*\(\s*\d/,
  },
  {
    id: 'G3',
    title: '不许放宽截图比对阈值',
    files: /^tests\/|playwright\.config\.[cm]?[jt]s$/,
    pattern: /\b(?:maxDiffPixels|maxDiffPixelRatio)\b|\bthreshold\s*:/,
  },
  {
    id: 'G4',
    title: '界面代码不许写死颜色，用主题变量 var(--…)',
    files: /^src\/renderer\/.*\.(?:css|tsx?)$/,
    // 图纸内容（纸面、点位、导出预览）的颜色属于文档本身，不跟主题走，允许写死：
    exclude: /^src\/renderer\/(?:themes\/|components\/(?:FloorPlanCanvas|ContinuousFloorPlanCanvas|PageThumbnail|PdfOutputPreview)\.tsx$)/,
    pattern: /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\s*\(/,
  },
  {
    id: 'G5',
    title: '动效：不许 transition: all，不许动布局属性，时长按三档（交互 ≤ 320ms；fx- 余晖 ≤ 1200ms；无限循环只用于持续状态）',
    files: /^src\/renderer\/.*\.(?:css|tsx?)$/,
    check(line) {
      if (/transition\s*:\s*all\b/.test(line)) return 'transition: all';
      if (/transition(?:-property)?\s*:[^;]*\b(?:width|height|top|left|right|bottom|inset|margin[\w-]*|padding[\w-]*|font-size)\b/.test(line))
        return '对布局属性做过渡';
      const declaration = /(transition|animation)(?:-duration)?\s*:([^;}]*)/.exec(line);
      if (!declaration) return undefined;
      const [, kind, value] = declaration;
      // 持续状态指示（无限循环、Toast 倒计时条）：时长跟着状态走，运行时由 G5 旅程断言检查是否按时停止
      if (kind === 'animation' && /\binfinite\b|\bui-countdown\b/.test(value)) return undefined;
      const limit = kind === 'animation' && /\bfx-[\w-]+/.test(value) ? 1200 : 320;
      for (const match of value.matchAll(/(\d*\.?\d+)(ms|s)\b/g)) {
        const ms = match[2] === 's' ? Number(match[1]) * 1000 : Number(match[1]);
        if (ms > limit) return `时长 ${ms}ms > ${limit}ms（${limit === 1200 ? '余晖' : '交互'}档）`;
      }
      return undefined;
    },
  },
  {
    id: 'G6',
    title: '快捷键必须注册到 src/core/keyboard-shortcuts.ts，不许另挂全局键盘监听',
    files: /^src\//,
    exclude: /^src\/core\/keyboard-shortcuts\.ts$/,
    pattern: /addEventListener\s*\(\s*['"]key(?:down|up|press)['"]/,
  },
  {
    id: 'G7',
    title: '已撤销的设计不许回来（返工 / 设备布设工作台 / 任务模块）',
    files: /^(?:src|electron)\//,
    pattern: /返工|设备布设工作台|Site Planning Workbench|reworkUnlocked\s*:\s*true|['"]tasks['"]\s+as\s+const/,
  },
  {
    id: 'G9',
    title: '测试不许把源代码当文本读来查字符串（证明不了软件真的这么做）：要调用真函数、渲染真组件，或用 e2e 在软件里操作',
    files: /^tests\/|\.test\.[cm]?[jt]sx?$|\.spec\.[cm]?[jt]sx?$/,
    // 读 src/、electron/ 下的代码文件；样式只允许读主题目录（对比度测试要解析主题变量）
    pattern: /\breadFile(?:Sync)?\s*\([^;]*['"`](?:\.{1,2}\/)*(?:src|electron)\/(?:(?!renderer\/themes\/)[^'"`]*\.css|[^'"`]*\.[cm]?[jt]sx?)['"`]|from\s+['"][^'"]*(?:src|electron)\/[^'"]*\?raw['"]/,
  },
];

function parseArgs(argv) {
  const args = { repo: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--base') args.base = argv[++i];
    else if (argv[i] === '--repo') args.repo = argv[++i];
    else if (argv[i] === '--phase') args.phase = argv[++i];
    else if (argv[i] === '--scope') args.scope = argv[++i];
    else if (argv[i] === '--json') args.json = true;
  }
  if (!args.base) throw new Error('缺少 --base <git-ref>');
  if (Boolean(args.phase) !== Boolean(args.scope)) throw new Error('--phase 和 --scope 要一起给');
  return args;
}

/** 简单 glob：** 匹配任意层目录，* 匹配一层内任意字符。 */
export function globToRegExp(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      out += '.*';
      i += 1;
      if (glob[i + 1] === '/') i += 1;
    } else if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`);
}

/** G8：本阶段改动了范围外的文件。 */
export function scopeViolations(changedFiles, scope, phase) {
  const entry = scope.phases?.[phase];
  if (!entry) return [{ rule: 'G8', title: '阶段不存在', detail: `phase-scope.json 里没有 ${phase}`, file: '-', line: 0, text: '' }];
  const allow = [...(scope.always ?? []), ...(entry.allow ?? [])].map(globToRegExp);
  const deny = (entry.deny ?? []).map(globToRegExp);
  return [...new Set(changedFiles)]
    .filter((file) => deny.some((re) => re.test(file)) || !allow.some((re) => re.test(file)))
    .map((file) => ({
      rule: 'G8',
      title: '改了本阶段范围外的文件',
      detail: `${phase} 不允许改动这个文件；确实需要改，先停下来在报告里说明，等用户同意`,
      file,
      line: 0,
      text: '',
    }));
}

function git(repo, ...args) {
  // core.quotepath=false：中文文件名按原样输出（默认会被转成 "\350\207…" 这种转义，导致匹配失败）
  return execFileSync('git', ['-c', 'core.quotepath=false', '-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** 解析 `git diff -U0` 的新增行：[{ file, line, text }] */
export function addedLines(diff) {
  const result = [];
  let file;
  let lineNo = 0;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ ')) {
      file = raw.startsWith('+++ b/') ? raw.slice(6) : undefined;
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      lineNo = Number(hunk[1]);
      continue;
    }
    if (!file) continue;
    if (raw.startsWith('+')) {
      result.push({ file, line: lineNo, text: raw.slice(1) });
      lineNo += 1;
    }
  }
  return result;
}

export function evaluate(lines, changedFiles) {
  const violations = [];
  const allowances = [];
  for (const entry of lines) {
    for (const rule of RULES) {
      if (!rule.files.test(entry.file) || rule.exclude?.test(entry.file)) continue;
      const reason = rule.check ? rule.check(entry.text) : rule.pattern.test(entry.text) ? rule.title : undefined;
      if (!reason) continue;
      const allow = /v4-allow:\s*(G\d)\s+(\S.*)$/.exec(entry.text);
      if (allow && allow[1] === rule.id) allowances.push({ rule: rule.id, file: entry.file, line: entry.line, reason: allow[2].trim() });
      else violations.push({ rule: rule.id, title: rule.title, detail: reason, file: entry.file, line: entry.line, text: entry.text.trim().slice(0, 160) });
    }
  }
  const baselines = changedFiles.filter((file) => /-snapshots\/|__screenshots__\/|\.png$/.test(file) && /^tests\//.test(file));
  return { violations, allowances, baselinesNeedingExplanation: baselines };
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(String(error.message ?? error));
    process.exit(2);
  }
  let diff;
  let changedFiles;
  try {
    // 包含已暂存和未暂存的改动，以及相对 base 的已提交改动
    diff = git(args.repo, 'diff', '-U0', '--no-color', '--no-ext-diff', args.base);
    changedFiles = git(args.repo, 'diff', '--name-only', args.base).split('\n').filter(Boolean);
  } catch (error) {
    console.error(`git diff 失败：${error.message}`);
    process.exit(2);
  }
  // 新建且尚未 git add 的文件不在 diff 里：直接读出来，整份算新增（不改动暂存区）。
  const untracked = git(args.repo, 'ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean);
  const lines = addedLines(diff);
  for (const file of untracked) {
    changedFiles.push(file);
    if (!/\.(?:[cm]?[jt]sx?|css|scss|html|json|md)$/.test(file)) continue;
    readFileSync(path.join(args.repo, file), 'utf8')
      .split('\n')
      .forEach((text, index) => lines.push({ file, line: index + 1, text }));
  }
  const result = evaluate(lines, changedFiles);
  if (args.phase) {
    const scope = JSON.parse(readFileSync(path.resolve(args.scope), 'utf8'));
    result.violations.push(...scopeViolations(changedFiles, scope, args.phase));
  }
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    for (const item of result.violations) console.log(`✗ ${item.rule} ${item.file}:${item.line}  ${item.detail}\n    ${item.text}`);
    for (const item of result.allowances) console.log(`! 豁免 ${item.rule} ${item.file}:${item.line}  理由：${item.reason}`);
    for (const file of result.baselinesNeedingExplanation) console.log(`! 截图基线改动，必须在自测报告里逐个说明：${file}`);
    console.log(result.violations.length ? `\n未通过：${result.violations.length} 处违规` : '\n通过');
  }
  process.exit(result.violations.length ? 1 : 0);
}

// 是否被直接运行：比较真实路径。不要写 import.meta.url === `file://${process.argv[1]}` ——
// 在 Windows（D:\…）或路径里有中文、空格时永远不相等，脚本会什么都不做、静默退出 0（第一轮就是这样）。
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const selfPath = fileURLToPath(import.meta.url);
if (process.platform === 'win32' ? invokedPath.toLowerCase() === selfPath.toLowerCase() : invokedPath === selfPath) main();
