import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { check } from './trace-check.mjs';

const scope = { phases: { P1: { ids: ['S-02', 'S-05', 'D-12'] }, P3: { ids: ['S-11'] } } };

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
  'tests/unit/summary.test.ts': "test('手改值等于自动值 → 视为没手改', () => {});\ntest(\"排版不重叠\", () => {});",
  'docs/redesign-v4/reports/P3/list.png': 'png',
};

test('证据齐全、测试真实存在时通过', () => {
  const dir = repo(files);
  const trace = {
    P1: {
      'S-02': { status: 'done', files: ['src/core/equipment.ts'], tests: ['tests/unit/summary.test.ts > 手改值等于自动值 → 视为没手改'] },
      'S-05': { status: 'done', files: ['src/core/equipment.ts'], tests: ['tests/unit/summary.test.ts > 排版不重叠'] },
      'D-12': { status: 'already', note: '冻结逻辑已存在，代码：src/core/drawing-schemes.ts:52', screenshots: [] },
    },
  };
  const result = check(dir, scope, 'P1', trace);
  assert.deepEqual(result.problems, ['D-12：界面类编号必须附截图']);
});

test('漏登、编造测试名、编造文件、没写原因的未完成都会被拦下', () => {
  const dir = repo(files);
  const trace = {
    P1: {
      'S-02': { status: 'done', files: ['src/core/not-there.ts'], tests: ['tests/unit/summary.test.ts > 根本没有这个测试'] },
      'D-12': { status: 'partial' },
      'S-11': { status: 'done', files: ['src/core/equipment.ts'], tests: ['tests/unit/summary.test.ts > 排版不重叠'] },
    },
  };
  const { problems, unfinished } = check(dir, scope, 'P1', trace);
  assert.ok(problems.includes('S-05：没有登记'));
  assert.ok(problems.includes('S-02：改动文件不存在：src/core/not-there.ts'));
  assert.ok(problems.some((p) => p.startsWith('S-02：测试文件里找不到这个测试名')));
  assert.ok(problems.includes('D-12：status 为 partial 时必须写 note 说明原因'));
  assert.ok(problems.some((p) => p.startsWith('S-11：不属于 P1')), '跨阶段偷做会被发现');
  assert.equal(unfinished.length, 1);
});

test('界面类编号必须附真实存在的截图', () => {
  const dir = repo(files);
  const ok = check(dir, scope, 'P3', { P3: { 'S-11': { status: 'done', files: ['src/core/equipment.ts'], tests: ['tests/unit/summary.test.ts > 排版不重叠'], screenshots: ['docs/redesign-v4/reports/P3/list.png'] } } });
  assert.deepEqual(ok.problems, []);
  const fake = check(dir, scope, 'P3', { P3: { 'S-11': { status: 'done', files: ['src/core/equipment.ts'], tests: ['tests/unit/summary.test.ts > 排版不重叠'], screenshots: ['docs/redesign-v4/reports/P3/none.png'] } } });
  assert.deepEqual(fake.problems, ['S-11：截图不存在：docs/redesign-v4/reports/P3/none.png']);
});
