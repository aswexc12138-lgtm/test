// node --test protocol-progress.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractProgress } from './protocol-progress.mjs';

const line = (t, phase, done = '', total = '') => `${String(t).padStart(7)}  phase=${phase} extractDone=${done} extractTotal=${total}`;

test('慢机器（Wine 实测日志）：解压 884 ms，至少 3 次，实际 6 次', () => {
  const log = [
    line(605, 'prepare'), line(646, 'extract'),
    line(771, 'extract', 12515307, 100969766), line(940, 'extract', 35187482, 100969766),
    line(1107, 'extract', 55763210, 100969766), line(1235, 'extract', 75266815, 100969766),
    line(1406, 'extract', 98119427, 100969766), line(1489, 'extract', 100969766, 100969766),
    line(1530, 'copy', 100969766, 100969766),
  ].join('\n');
  const r = extractProgress(log);
  assert.equal(r.durationMs, 884);
  assert.equal(r.expected, 3);
  assert.equal(r.records.length, 6);
});

test('Wine 第二次实测：第一次回调报 0 字节也算一次记录（总量已知）', () => {
  const log = [line(869, 'extract'), line(915, 'extract', 0, 100969766), line(1038, 'extract', 17729238, 100969766),
    line(1203, 'extract', 42258140, 100969766), line(1367, 'extract', 63911672, 100969766), line(1536, 'extract', 88405329, 100969766),
    line(1864, 'copy', 100969766, 100969766)].join('\n');
  const r = extractProgress(log);
  assert.equal(r.durationMs, 995);
  assert.equal(r.expected, 3);
  assert.equal(r.records.length, 5);
  assert.equal(r.records[0].done, 0);
});

test('快机器：解压 210 ms，只要求 1 次真实字节数', () => {
  const log = [line(600, 'prepare'), line(640, 'extract'), line(790, 'extract', 61000000, 100969766), line(850, 'copy', 100969766, 100969766)].join('\r\n');
  const r = extractProgress(log);
  assert.equal(r.durationMs, 210);
  assert.equal(r.expected, 1);
  assert.equal(r.records.length, 1);
});

test('没有任何字节数：记录为 0 次，至少要 1 次 → 测试会判失败', () => {
  const log = [line(600, 'prepare'), line(640, 'extract'), line(700, 'copy')].join('\n');
  const r = extractProgress(log);
  assert.equal(r.records.length, 0);
  assert.ok(r.records.length < r.expected);
});

test('解压 2 秒但只报了 1 次：至少要 3 次 → 判失败（回调没接上）', () => {
  const log = [line(0, 'extract'), line(1990, 'extract', 100, 100), line(2000, 'copy', 100, 100)].join('\n');
  const r = extractProgress(log);
  assert.equal(r.expected, 3);
  assert.ok(r.records.length < r.expected);
});
