import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { check } from './trace-check.mjs';

const scope = { phases: { P1: { ids: ['S-02', 'S-05', 'D-12'] }, P3: { ids: ['S-11', 'D-01', 'D-04', 'D-05'] }, PI: { ids: ['I-25'] } } };

function repo(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'trace-'));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), text);
  }
  return dir;
}

const files = {
  'src/core/equipment.ts': 'export {}',
  'tests/unit/summary.test.ts': "test('S-02 手改值等于自动值 → 视为没手改', () => {});\ntest(\"S-05 排版不重叠\", () => {});\ntest('排版不重叠（没写编号）', () => {});",
  'tests/e2e/summary.e2e.test.ts': "test('S-11 汇总清单：改数量、更新到图上', async () => {});",
  'tests/unit/p3-surfaces.test.ts': "const t = await readFile('src/renderer/components/FloatPanel.tsx', 'utf8');\ntest('D-01 D-04 D-05 浮窗和工具栏', () => {});",
  'scripts/installer-ui/tools/protocol-test.mjs': "check(ok, '进度：解压字节数只增不减');",
  'docs/redesign-v4/reports/P3/list.png': 'png',
  'docs/redesign-v4/reports/P1/d12.png': 'png',
};

test('证据齐全、测试真实存在、测试名带编号时通过', () => {
  const dir = repo(files);
  const trace = {
    P1: {
      'S-02': { status: 'done', files: ['src/core/equipment.ts'], tests: ['tests/unit/summary.test.ts > S-02 手改值等于自动值 → 视为没手改'] },
      'S-05': { status: 'done', files: ['src/core/equipment.ts'], tests: ['tests/unit/summary.test.ts > S-05 排版不重叠'] },
      'D-12': { status: 'already', note: '冻结逻辑已存在，代码：src/core/drawing-schemes.ts:52', screenshots: ['docs/redesign-v4/reports/P1/d12.png'] },
    },
  };
  assert.deepEqual(check(dir, scope, 'P1', trace), { problems: [], unfinished: [] });
});

test('漏登、编造测试名、编造文件、没写原因的未完成、测试名不带编号都会被拦下', () => {
  const dir = repo(files);
  const trace = {
    P1: {
      'S-02': { status: 'done', files: ['src/core/not-there.ts'], tests: ['tests/unit/summary.test.ts > 根本没有这个测试'] },
      'D-12': { status: 'partial' },
      'S-11': { status: 'done', files: ['src/core/equipment.ts'], tests: ['tests/e2e/summary.e2e.test.ts > S-11 汇总清单：改数量、更新到图上'] },
    },
  };
  const { problems, unfinished } = check(dir, scope, 'P1', trace);
  assert.ok(problems.includes('S-05：没有登记'));
  assert.ok(problems.includes('S-02：改动文件不存在：src/core/not-there.ts'));
  assert.ok(problems.some((p) => p.startsWith('S-02：测试文件里找不到这个测试名')));
  assert.ok(problems.includes('D-12：status 为 partial 时必须写 note 说明原因'));
  assert.ok(problems.some((p) => p.startsWith('S-11：不属于 P1')), '跨阶段偷做会被发现');
  assert.equal(unfinished.length, 1);

  const unnamed = check(dir, scope, 'P1', { P1: { 'S-05': { status: 'done', files: ['src/core/equipment.ts'], tests: ['tests/unit/summary.test.ts > 排版不重叠（没写编号）'] } } });
  assert.ok(unnamed.problems.includes('S-05：测试名里要带编号（例如“S-05 …”）：tests/unit/summary.test.ts > 排版不重叠（没写编号）'));
});

test('界面类编号必须附真实存在的截图，并且要有 e2e 测试', () => {
  const dir = repo(files);
  const e2e = ['tests/e2e/summary.e2e.test.ts > S-11 汇总清单：改数量、更新到图上'];
  const ok = check(dir, { phases: { P3: { ids: ['S-11'] } } }, 'P3', { P3: { 'S-11': { status: 'done', files: ['src/core/equipment.ts'], tests: e2e, screenshots: ['docs/redesign-v4/reports/P3/list.png'] } } });
  assert.deepEqual(ok.problems, []);
  const fake = check(dir, { phases: { P3: { ids: ['S-11'] } } }, 'P3', { P3: { 'S-11': { status: 'done', files: ['src/core/equipment.ts'], tests: e2e, screenshots: ['docs/redesign-v4/reports/P3/none.png'] } } });
  assert.deepEqual(fake.problems, ['S-11：截图不存在：docs/redesign-v4/reports/P3/none.png']);
});

test('第一轮的写法：读源码查字符串的测试、一条测试证明一串编号、界面编号没有 e2e → 全部拦下', () => {
  const dir = repo(files);
  const ref = 'tests/unit/p3-surfaces.test.ts > D-01 D-04 D-05 浮窗和工具栏';
  const record = { status: 'done', files: ['src/core/equipment.ts'], tests: [ref], screenshots: ['docs/redesign-v4/reports/P3/list.png'] };
  const scopeP3 = { phases: { P3: { ids: ['D-01', 'D-04', 'D-05'] } } };
  const { problems } = check(dir, scopeP3, 'P3', { P3: { 'D-01': record, 'D-04': record, 'D-05': record } });
  assert.ok(problems.includes('D-01：测试文件把源代码当文本读来查字符串（G9），证明不了软件的行为：tests/unit/p3-surfaces.test.ts'));
  assert.ok(problems.includes('D-01：界面类编号要有 tests/e2e/ 的测试在软件里真的操作过（后台模式 CCTV_E2E_HEADLESS=1，不抢前台）'));
  assert.ok(problems.includes(`D-01、D-04、D-05：3 个编号用同一条测试证明（最多 2 个）：${ref}`));
});

test('安装器编号用协议测试的检查项证明：不要求 e2e，也不要求名字带编号', () => {
  const dir = repo(files);
  const trace = { PI: { 'I-25': { status: 'done', files: ['src/core/equipment.ts'], tests: ['scripts/installer-ui/tools/protocol-test.mjs > 进度：解压字节数只增不减'], screenshots: ['docs/redesign-v4/reports/P3/list.png'] } } };
  assert.deepEqual(check(dir, scope, 'PI', trace).problems, []);
});

test('范围文件的 ui 列表把非前缀编号也当界面类：要截图和 e2e', () => {
  const dir = repo({ ...files, 'tests/unit/cad.test.ts': "test('CAD-10 块库导入列出静态块', () => {});" });
  const cad = { phases: { C3: { ids: ['CAD-10', 'CAD-11'], ui: ['CAD-10'] } } };
  const trace = {
    C3: {
      'CAD-10': { status: 'done', files: ['src/core/equipment.ts'], tests: ['tests/unit/cad.test.ts > CAD-10 块库导入列出静态块'] },
      'CAD-11': { status: 'done', files: ['src/core/equipment.ts'], tests: ['tests/unit/cad.test.ts > CAD-10 块库导入列出静态块'] },
    },
  };
  const { problems } = check(dir, cad, 'C3', trace);
  assert.ok(problems.some((p) => p.startsWith('CAD-10：界面类编号要有 tests/e2e/')));
  assert.ok(problems.some((p) => p.startsWith('CAD-10：界面类编号必须附截图')));
  // CAD-11 不在 ui 列表：测试名不带 CAD-11 才报错，不要求截图
  assert.ok(problems.some((p) => p.startsWith('CAD-11：测试名里要带编号')));
  assert.ok(!problems.some((p) => p.startsWith('CAD-11：界面类')));
});
