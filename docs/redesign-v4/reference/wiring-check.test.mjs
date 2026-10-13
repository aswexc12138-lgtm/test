// node --test wiring-check.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluate, importSpecifiers, reachableFiles } from './wiring-check.mjs';

const ENTRIES = ['src/renderer/main.tsx', 'electron/preload.ts'];
const lines = (file, text) => text.split('\n').map((t, i) => ({ file, line: i + 1, text: t }));
const rules = (result) => result.problems.map((p) => `${p.rule} ${p.file}`).sort();

function project(extra = {}) {
  return new Map(Object.entries({
    'src/renderer/main.tsx': "import App from './App';\nimport './styles.css';\n",
    'src/renderer/App.tsx': "import { Used } from './components/Used';\nexport default function App() { return <Used />; }\n",
    'src/renderer/components/Used.tsx': "export function Used() { return <div className=\"ui-row\" />; }\n",
    'src/renderer/styles.css': '.ui-row { color: var(--ink); }\n@keyframes fx-bump { to { opacity: 1; } }\n',
    'electron/preload.ts': 'const desktopApi = {\n  oldThing: () => 1,\n};\n',
    ...extra,
  }));
}

test('import 写法：静态、导出转发、动态、require、TS 的 .js 后缀、CSS @import', () => {
  const files = project({
    'src/renderer/App.tsx': "import { a } from './a.js';\nexport * from './b';\nconst c = import('./c');\nconst d = require('./d');\nimport './e.css';\n",
    'src/renderer/a.ts': '', 'src/renderer/b.tsx': '', 'src/renderer/c.ts': '', 'src/renderer/d.js': '',
    'src/renderer/e.css': "@import './f.css';\n", 'src/renderer/f.css': '',
  });
  const live = reachableFiles(ENTRIES, (f) => files.get(f) ?? '', (f) => files.has(f));
  for (const f of ['a.ts', 'b.tsx', 'c.ts', 'd.js', 'e.css', 'f.css']) assert.ok(live.has(`src/renderer/${f}`), f);
  assert.deepEqual(importSpecifiers("import x from 'react';\nimport y from './y?url';", 'src/x.ts'), ['./y']);
});

test('W1 / W2：新组件文件只有测试在用 → 两条都报（第一轮 FloatPanel、SummaryList 的情况）', () => {
  const file = 'src/renderer/components/FloatPanel.tsx';
  const text = "export function FloatPanel() { return <section className=\"ui-row\" />; }\n";
  const files = project({ [file]: text, 'tests/unit/p3.test.ts': "import { FloatPanel } from '../../src/renderer/components/FloatPanel';\n" });
  const result = evaluate({ files, entries: ENTRIES, added: [file], addedLines: lines(file, text) });
  assert.deepEqual(rules(result), [`W1 ${file}`, `W2 ${file}`]);
});

test('W2 通过：新组件被 App 渲染', () => {
  const file = 'src/renderer/components/FloatPanel.tsx';
  const text = 'export function FloatPanel() { return null; }\n';
  const files = project({
    [file]: text,
    'src/renderer/App.tsx': "import { FloatPanel } from './components/FloatPanel';\nexport default function App() { return <FloatPanel title=\"x\" />; }\n",
  });
  const result = evaluate({ files, entries: ENTRIES, added: [file], addedLines: lines(file, text) });
  assert.deepEqual(result.problems, []);
});

test('W3：core 里新导出的函数只有测试调用 → 报；App 调用了 → 不报；只在本文件内部用、文件会被加载 → 不报', () => {
  const core = 'src/core/summary-quantity.ts';
  const text = 'export function preExportCheck() { return helper(); }\nexport function helper() { return 1; }\nexport function setQuantity() {}\n';
  const files = project({
    [core]: text,
    'src/renderer/App.tsx': "import { setQuantity } from '../core/summary-quantity';\nexport default function App() { setQuantity(); return null; }\n",
  });
  const result = evaluate({ files, entries: ENTRIES, added: [core], addedLines: lines(core, text) });
  assert.deepEqual(result.problems.map((p) => p.detail), ['导出的 preExportCheck 除了测试以外没人用']);
});

test('W4：新样式类没人用 → 报；拼接写法 `ui-role--${role}` 算用到；注释里的豁免要写理由', () => {
  const css = 'src/renderer/styles/components.css';
  const text = [
    '.ui-dialog { animation: none; }',
    '.ui-role--point { color: var(--role-point); }',
    '.ui-switch { display: flex; } /* v4-allow: W4 演示库里的开关，本软件暂时没有开关控件 */',
  ].join('\n');
  const files = project({
    [css]: text,
    'src/renderer/main.tsx': "import App from './App';\nimport './styles.css';\nimport './styles/components.css';\n",
    'src/renderer/App.tsx': 'export default function App({ role }) { return <i className={`ui-role--${role}`} />; }\n',
  });
  const result = evaluate({ files, entries: ENTRIES, added: [css], addedLines: lines(css, text) });
  assert.deepEqual(result.problems.map((p) => p.detail), ['样式类 .ui-dialog 没有在任何会加载的 .ts/.tsx 里用到']);
  assert.deepEqual(result.allowances.map((a) => [a.rule, a.reason]), [['W4', '演示库里的开关，本软件暂时没有开关控件']]);
});

test('W5：用到的动画没有 @keyframes（第一轮的 ui-shimmer），时长、缓动、var() 不会被当成动画名', () => {
  const files = project({
    'src/renderer/styles.css': [
      '.ui-row { animation: fx-bump var(--dur) cubic-bezier(.2,.8,.2,1) both; }',
      '.ui-skeleton::after { animation: ui-shimmer 1.2s linear infinite; }',
      '.x { animation-name: fx-bump, ui-grow-y; }',
      '@keyframes fx-bump { to { opacity: 1; } }',
    ].join('\n'),
  });
  const result = evaluate({ files, entries: ENTRIES, added: [], addedLines: [] });
  assert.deepEqual(result.problems.map((p) => p.detail).sort(), ['动画 ui-grow-y 没有定义 @keyframes', '动画 ui-shimmer 没有定义 @keyframes']);
});

test('W6：preload 新增接口渲染进程没调用 → 报（第一轮的 setTitlebarColors）；调用了 → 不报', () => {
  const pre = 'electron/preload.ts';
  const text = 'const desktopApi = {\n  setTitlebarColors: (c) => ipcRenderer.invoke("x", c),\n  scanWorkbench: () => ipcRenderer.invoke("y"),\n};\n';
  const files = project({
    [pre]: text,
    'src/renderer/App.tsx': 'export default function App() { void window.desktop.scanWorkbench(); return null; }\n',
  });
  const result = evaluate({ files, entries: ENTRIES, added: [], addedLines: lines(pre, text) });
  assert.deepEqual(result.problems.map((p) => p.detail), ['preload 接口 setTitlebarColors 渲染进程里没有调用']);
});
