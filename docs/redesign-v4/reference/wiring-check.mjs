#!/usr/bin/env node
/**
 * 接线检查 · 参考实现（v4 返工，07 文件第二节）
 *
 * 第一轮的主要问题：组件、函数、样式、接口都写了，测试也写了，但软件里根本没有用到——用户打开软件什么都看不见。
 * 本脚本从软件真正的入口出发，沿 import 找出所有“软件运行时会加载”的文件，然后检查相对 --base 新增的东西有没有被用到：
 *
 *   W1 新增的源文件，软件运行时不会加载（没有任何入口能 import 到它）
 *   W2 新增的 React 组件（.tsx 里导出的大写开头函数 / 常量），没有在任何会加载的文件里以 <组件名 渲染
 *   W3 新增的导出函数 / 常量，除了自己的文件和测试以外没人用（自己文件里也没用）
 *   W4 新增的 CSS 类名，没有在任何会加载的 .ts / .tsx 里出现
 *   W5 用到的动画名（animation / animation-name），在会加载的 CSS 里没有 @keyframes
 *   W6 preload 新增的 desktop 接口方法，渲染进程里没有调用
 *
 * 测试文件（tests/、*.test.*、*.spec.*）不算“用到”：只有测试在用 = 没接上。
 *
 * 用法：node wiring-check.mjs --base <git-ref> [--repo <path>] [--entry <file> ...] [--phase PX --scope phase-scope.json] [--json]
 *   --phase/--scope：只报本阶段允许改的文件里的问题（阶段收工时用）；不给就报全部（最终验收用）。
 *   默认入口：src/renderer/main.tsx、electron/main.ts、electron/preload.ts、electron/export-worker.ts
 *   --base 用改版开工前的提交（P1 的起始提交 300cde1），这样第一轮遗留的没接线的东西也会被查出来。
 * 退出码：0 = 通过；1 = 有没接上的；2 = 参数或 git 出错。
 *
 * 豁免：在那一行写 `v4-allow: W<n> <理由>`（CSS 里写在注释里）。理由必填，豁免会列在输出里，必须写进自测报告。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { globToRegExp } from './diff-guard.mjs';

export const DEFAULT_ENTRIES = ['src/renderer/main.tsx', 'electron/main.ts', 'electron/preload.ts', 'electron/export-worker.ts'];
const SOURCE = /^(?:src|electron)\/.*\.(?:[cm]?[jt]sx?|css)$/;
const TEST = /(?:^|\/)tests?\/|\.(?:test|spec)\.[cm]?[jt]sx?$/;
const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '/index.ts', '/index.tsx', '/index.js'];

function parseArgs(argv) {
  const args = { repo: process.cwd(), entries: [], json: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--base') args.base = argv[++i];
    else if (argv[i] === '--repo') args.repo = argv[++i];
    else if (argv[i] === '--entry') args.entries.push(argv[++i]);
    else if (argv[i] === '--phase') args.phase = argv[++i];
    else if (argv[i] === '--scope') args.scope = argv[++i];
    else if (argv[i] === '--json') args.json = true;
  }
  if (!args.base) throw new Error('缺少 --base <git-ref>');
  if (Boolean(args.phase) !== Boolean(args.scope)) throw new Error('--phase 和 --scope 要一起给');
  if (!args.entries.length) args.entries = DEFAULT_ENTRIES;
  return args;
}

/** 文件里引用到的其他文件（只认相对路径）：import / export from / import() / require() / new URL(…, import.meta.url) / CSS @import */
export function importSpecifiers(text, file) {
  const out = [];
  const patterns = file.endsWith('.css')
    ? [/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)/g]
    : [
        /\bimport\s+(?:type\s+)?(?:[\w*{}\s,$]+\s+from\s+)?['"]([^'"]+)['"]/g,
        /\bexport\s+(?:type\s+)?(?:\*|\{[^}]*\})(?:\s+as\s+\w+)?\s+from\s+['"]([^'"]+)['"]/g,
        /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        /new\s+URL\s*\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url/g,
      ];
  for (const re of patterns) for (const m of text.matchAll(re)) out.push(m[1]);
  return out.filter((s) => s.startsWith('.')).map((s) => s.replace(/[?#].*$/, ''));
}

export function resolveImport(fromFile, spec, exists) {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec));
  const candidates = [];
  for (const ext of EXTENSIONS) candidates.push(base + ext);
  // TypeScript ESM 写法：import './x.js' 实际文件是 x.ts / x.tsx
  if (/\.[cm]?js$/.test(base)) for (const ext of ['.ts', '.tsx', '.mts', '.cts']) candidates.push(base.replace(/\.[cm]?js$/, ext));
  return candidates.find(exists);
}

/** 从入口出发能加载到的文件 */
export function reachableFiles(entries, read, exists) {
  const seen = new Set();
  const queue = entries.filter(exists);
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of importSpecifiers(read(file), file)) {
      const target = resolveImport(file, spec, exists);
      if (target && !seen.has(target)) queue.push(target);
    }
  }
  return seen;
}

const allowance = (text, rule) => {
  const m = /v4-allow:\s*(W\d)\s+([^*]+?)\s*(?:\*\/)?\s*$/.exec(text);
  return m && m[1] === rule ? m[2].trim() : undefined;
};
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const countWord = (text, word) => (text.match(new RegExp(`(?<![\\w$])${escape(word)}(?![\\w$])`, 'g')) ?? []).length;

/**
 * 核心检查（不碰 git，方便测试）。
 * files: Map<路径, 内容>（仓库里当前全部源文件）；added: 新增文件列表；addedLines: [{ file, line, text }] 相对 base 新增的行。
 */
export function evaluate({ files, entries, added, addedLines }) {
  const exists = (f) => files.has(f);
  const read = (f) => files.get(f) ?? '';
  const live = reachableFiles(entries, read, exists);
  const liveCode = [...live].filter((f) => !f.endsWith('.css') && !TEST.test(f));
  const liveCss = [...live].filter((f) => f.endsWith('.css'));
  const problems = [];
  const allowances = [];
  const report = (rule, file, line, text, detail) => {
    const reason = allowance(text, rule);
    if (reason) allowances.push({ rule, file, line, reason });
    else problems.push({ rule, file, line, detail, text: text.trim().slice(0, 160) });
  };

  // W1 新增文件没被加载
  for (const file of added) {
    if (!SOURCE.test(file) || TEST.test(file) || file.endsWith('.d.ts') || live.has(file)) continue;
    const first = read(file).split('\n')[0] ?? '';
    report('W1', file, 1, first, '新增的源文件，软件运行时不会加载（没有任何入口 import 到它）');
  }

  for (const { file, line, text } of addedLines) {
    if (!SOURCE.test(file) || TEST.test(file)) continue;
    const others = liveCode.filter((f) => f !== file);

    // W2 / W3 新增导出
    if (/\.[cm]?[jt]sx?$/.test(file)) {
      const m = /^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/.exec(text);
      if (m) {
        const name = m[1];
        if (file.endsWith('.tsx') && /^[A-Z]/.test(name)) {
          const rendered = liveCode.some((f) => new RegExp(`<${escape(name)}[\\s/>.]`).test(read(f)));
          if (!rendered) report('W2', file, line, text, `组件 ${name} 没有在任何会加载的文件里渲染（<${name} …>）`);
        } else {
          const usedElsewhere = others.some((f) => countWord(read(f), name) > 0);
          const usedInside = live.has(file) && countWord(read(file), name) > 1;
          if (!usedElsewhere && !usedInside) report('W3', file, line, text, `导出的 ${name} 除了测试以外没人用`);
        }
      }
    }

    // W4 新增 CSS 类名
    if (file.endsWith('.css') && !/^\s*(?:\/\*|\*)/.test(text) && /[{,]\s*$|^[^:{]*\{/.test(text)) {
      const selector = text.split('{')[0];
      for (const cm of selector.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) {
        const cls = cm[1];
        const literal = new RegExp(`(?<![\\w-])${escape(cls)}(?![\\w-])`);
        // 拼接写法：`ui-role--${role}`、'ui-btn--' + kind
        const prefixes = [...cls.matchAll(/-+/g)].map((d) => cls.slice(0, d.index + d[0].length));
        const used = liveCode.some((f) => {
          const t = read(f);
          return literal.test(t) || prefixes.some((p) => new RegExp(`${escape(p)}(?:\\$\\{|['"\`]\\s*\\+)`).test(t));
        });
        if (!used) report('W4', file, line, text, `样式类 .${cls} 没有在任何会加载的 .ts/.tsx 里用到`);
      }
    }
  }

  // W5 动画名没有对应的 @keyframes（查全部会加载的 CSS，不只新增行：第一轮的 ui-shimmer 就是这样）
  const keyframes = new Set();
  for (const f of liveCss) for (const m of read(f).matchAll(/@keyframes\s+([\w-]+)/g)) keyframes.add(m[1]);
  const KEYWORDS = new Set(['none', 'infinite', 'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end', 'forwards',
    'backwards', 'both', 'normal', 'reverse', 'alternate', 'alternate-reverse', 'running', 'paused', 'initial', 'inherit', 'unset', 'revert']);
  for (const f of liveCss) {
    read(f).split('\n').forEach((text, i) => {
      const m = /(?:^|[;{\s])animation(-name)?\s*:\s*([^;}]+)/.exec(text);
      if (!m) return;
      const value = m[2].replace(/var\([^)]*\)|cubic-bezier\([^)]*\)|steps\([^)]*\)/g, ' ');
      for (const part of value.split(',')) {
        const names = part.trim().split(/\s+/).filter((w) => /^[A-Za-z_][\w-]*$/.test(w) && !KEYWORDS.has(w));
        for (const name of m[1] ? names : names.slice(0, 1)) if (!keyframes.has(name)) report('W5', f, i + 1, text, `动画 ${name} 没有定义 @keyframes`);
      }
    });
  }

  // W6 preload 新增的接口方法没人调用
  const preload = 'electron/preload.ts';
  const renderer = liveCode.filter((f) => f.startsWith('src/'));
  for (const { file, line, text } of addedLines) {
    if (file !== preload) continue;
    const m = /^\s*([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?\(/.exec(text);
    if (!m) continue;
    const used = renderer.some((f) => new RegExp(`\\.${escape(m[1])}\\s*\\(|\\b${escape(m[1])}\\s*\\??\\.?\\(`).test(read(f)));
    if (!used) report('W6', file, line, text, `preload 接口 ${m[1]} 渲染进程里没有调用`);
  }

  return { problems, allowances, liveCount: live.size };
}

function git(repo, ...args) {
  return execFileSync('git', ['-c', 'core.quotepath=false', '-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function addedLinesFromDiff(diff) {
  const result = [];
  let file;
  let lineNo = 0;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ ')) { file = raw.startsWith('+++ b/') ? raw.slice(6) : undefined; continue; }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) { lineNo = Number(hunk[1]); continue; }
    if (file && raw.startsWith('+')) { result.push({ file, line: lineNo, text: raw.slice(1) }); lineNo += 1; }
  }
  return result;
}

function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exit(2); }
  let tracked; let added; let diff;
  try {
    tracked = git(args.repo, 'ls-files', '--cached', '--others', '--exclude-standard').split('\n').filter(Boolean);
    added = git(args.repo, 'diff', '--name-only', '--diff-filter=A', args.base).split('\n').filter(Boolean);
    added.push(...git(args.repo, 'ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean));
    diff = git(args.repo, 'diff', '-U0', '--no-color', '--no-ext-diff', args.base);
  } catch (error) { console.error(`git 失败：${error.message}`); process.exit(2); }
  const files = new Map();
  for (const f of tracked) {
    if (!SOURCE.test(f)) continue;
    const full = path.join(args.repo, f);
    if (existsSync(full) && statSync(full).isFile()) files.set(f, readFileSync(full, 'utf8'));
  }
  const addedLines = addedLinesFromDiff(diff);
  for (const f of added) if (files.has(f) && !addedLines.some((l) => l.file === f)) files.get(f).split('\n').forEach((text, i) => addedLines.push({ file: f, line: i + 1, text }));
  const result = evaluate({ files, entries: args.entries, added: [...new Set(added)], addedLines });
  if (args.phase) {
    const scope = JSON.parse(readFileSync(path.resolve(args.scope), 'utf8'));
    const entry = scope.phases?.[args.phase];
    if (!entry) { console.error(`phase-scope.json 里没有 ${args.phase}`); process.exit(2); }
    const allow = (entry.allow ?? []).map(globToRegExp);
    result.problems = result.problems.filter((p) => allow.some((re) => re.test(p.file)));
    result.allowances = result.allowances.filter((a) => allow.some((re) => re.test(a.file)));
  }
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    for (const p of result.problems) console.log(`✗ ${p.rule} ${p.file}:${p.line}  ${p.detail}\n    ${p.text}`);
    for (const a of result.allowances) console.log(`! 豁免 ${a.rule} ${a.file}:${a.line}  理由：${a.reason}`);
    console.log(result.problems.length ? `\n未通过：${result.problems.length} 处没接上（软件会加载的文件 ${result.liveCount} 个）` : `\n通过（软件会加载的文件 ${result.liveCount} 个）`);
  }
  process.exit(result.problems.length ? 1 : 0);
}

// 是否被直接运行：比较真实路径。不要写 import.meta.url === `file://${process.argv[1]}` ——
// 在 Windows（D:\…）或路径里有中文、空格时永远不相等，脚本会什么都不做、静默退出 0（第一轮就是这样）。
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const selfPath = fileURLToPath(import.meta.url);
if (process.platform === 'win32' ? invokedPath.toLowerCase() === selfPath.toLowerCase() : invokedPath === selfPath) main();
