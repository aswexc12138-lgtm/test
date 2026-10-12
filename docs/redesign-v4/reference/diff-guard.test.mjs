import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'diff-guard.mjs');

function repoWith(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'diff-guard-'));
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 't');
  const write = (name, text) => {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), text);
  };
  write('src/renderer/old.css', '.legacy{color:#ff0000}\n');
  write('tests/e2e/old.spec.ts', "test.skip('legacy', () => {});\n");
  git('add', '.');
  git('commit', '-qm', 'base');
  for (const [name, text] of Object.entries(files)) write(name, text);
  return dir;
}

function run(dir) {
  try {
    return { code: 0, out: JSON.parse(execFileSync('node', [script, '--base', 'HEAD', '--repo', dir, '--json'], { encoding: 'utf8' })) };
  } catch (error) {
    return { code: error.status, out: JSON.parse(error.stdout) };
  }
}

test('埋进去的每一类违规都被拦下，历史代码不追究', () => {
  const dir = repoWith({
    'tests/e2e/a.spec.ts': "test.only('x', async () => {});\nawait page.waitForTimeout(500);\nawait expect(page).toHaveScreenshot({ maxDiffPixelRatio: 0.2 });\n",
    'src/renderer/components/Panel.tsx': "const style = { color: '#123456', background: 'rgba(0,0,0,.2)' };\nwindow.addEventListener('keydown', onKey);\n",
    'src/renderer/panel.css': '.a{transition: all .2s}\n.b{transition: width 120ms}\n.c{animation: pop 600ms ease}\n.d{transition: opacity 200ms}\n',
    'src/renderer/App.tsx': "const label = '返工';\nconst title = '胥宇 · 设备布设工作台';\n",
    'tests/e2e/__screenshots__/home.png': 'binary',
  });
  const { code, out } = run(dir);
  assert.equal(code, 1);
  const rules = out.violations.map((item) => item.rule).sort();
  assert.deepEqual(rules, ['G1', 'G2', 'G3', 'G4', 'G5', 'G5', 'G5', 'G6', 'G7', 'G7'].sort());
  assert.ok(!out.violations.some((item) => item.file === 'src/renderer/old.css'), '没改的旧代码不报');
  assert.ok(!out.violations.some((item) => item.text.includes('opacity 200ms')), '合规的过渡不报');
  assert.deepEqual(out.baselinesNeedingExplanation, ['tests/e2e/__screenshots__/home.png']);
});

test('图纸内容文件里的颜色允许写死；带理由的单行豁免会被列出', () => {
  const dir = repoWith({
    'src/renderer/components/FloorPlanCanvas.tsx': "fill={object.style?.color ?? '#172033'}\n",
    'src/renderer/components/Toolbar.tsx': "const brand = '#15727a'; // v4-allow: G4 任务栏图标固定品牌青，见规格 G-03\n",
  });
  const { code, out } = run(dir);
  assert.equal(code, 0);
  assert.equal(out.violations.length, 0);
  assert.equal(out.allowances.length, 1);
  assert.match(out.allowances[0].reason, /品牌青/);
});

test('动效三档：fx- 余晖允许到 1200ms，持续状态允许无限循环，交互超过 320ms 拦下', () => {
  const dir = repoWith({
    'src/renderer/motion.css': [
      '.fx-flash { animation: fx-flash 1200ms var(--ease) both; }',
      '.fx-locate { animation: fx-locate 900ms var(--ease-out) 2; }',
      '.ui-skeleton::after { animation: ui-shimmer 1.4s var(--ease) infinite; }',
      '.ui-dialog { animation: ui-dialog-in 400ms var(--ease-out); }',
      '.fx-too-long { animation: fx-too-long 1500ms ease; }',
      '.panel { transition: opacity 180ms, transform 240ms; }',
      '.bad { transition: inset 120ms; }',
    ].join('\n'),
  });
  const { code, out } = run(dir);
  assert.equal(code, 1);
  assert.deepEqual(out.violations.map((item) => item.line).sort(), [4, 5, 7]);
});

test('豁免必须写理由，空理由不算', () => {
  const dir = repoWith({ 'src/renderer/components/Toolbar.tsx': "const c = '#fff'; // v4-allow: G4\n" });
  assert.equal(run(dir).code, 1);
});
