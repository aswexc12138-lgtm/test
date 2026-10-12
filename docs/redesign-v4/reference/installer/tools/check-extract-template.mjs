#!/usr/bin/env node
// 检查 xuyu-extract-progress.nsh 去掉 ";XUYU" 标记行后，和 electron-builder 模板里的 extractUsing7za 逐行一致。
// 用法（在 xuyu 仓库根目录）：
//   node check-extract-template.mjs <xuyu-extract-progress.nsh>                 自动找当前仓库装的 electron-builder 模板
//   node check-extract-template.mjs <xuyu-extract-progress.nsh> <extractAppPackage.nsh>   手动指定模板
// 自动查找对 npm 和 pnpm 都有效（pnpm 下 app-builder-lib 不在顶层 node_modules，要从 electron-builder 的真实位置往下找）。
// 不一致时退出码 1，并打印第一处差异。接入 xuyu 的打包前检查（规格 I-27）。
import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

function findTemplate() {
  const eb = realpathSync(path.resolve('node_modules', 'electron-builder'));
  const lib = path.dirname(createRequire(path.join(eb, 'package.json')).resolve('app-builder-lib/package.json'));
  return path.join(lib, 'templates', 'nsis', 'include', 'extractAppPackage.nsh');
}

const [ours, given] = process.argv.slice(2);
if (!ours) {
  console.error('用法：node check-extract-template.mjs <xuyu-extract-progress.nsh> [<extractAppPackage.nsh>]');
  process.exit(2);
}
let template = given;
if (!template) {
  try { template = findTemplate(); }
  catch (e) {
    console.error(`找不到 electron-builder 的模板（在 xuyu 仓库根目录运行，并先安装依赖）：${e.message}`);
    process.exit(2);
  }
}
console.log(`模板：${template}`);

function macroBody(text, name) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.trim() === `!macro ${name} FILE`);
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && l.trim() === '!macroend');
  return lines.slice(start, end + 1);
}

const mine = macroBody(readFileSync(ours, 'utf8'), 'extractUsing7za');
const theirs = macroBody(readFileSync(template, 'utf8'), 'extractUsing7za');
if (!mine || !theirs) {
  console.error('找不到 !macro extractUsing7za FILE（模板结构变了，必须人工核对）');
  process.exit(1);
}
const stripped = mine.filter((l) => !/;XUYU\s*$/.test(l)).map((l) => l.trimEnd());
const expected = theirs.map((l) => l.trimEnd());
const n = Math.max(stripped.length, expected.length);
for (let i = 0; i < n; i += 1) {
  if (stripped[i] !== expected[i]) {
    console.error(`第 ${i + 1} 行不一致：\n  模板：${expected[i] ?? '(无)'}\n  我们：${stripped[i] ?? '(无)'}`);
    process.exit(1);
  }
}
console.log(`extractUsing7za 与模板一致（${expected.length} 行，另有 ${mine.length - stripped.length} 行 ;XUYU 增补）`);
