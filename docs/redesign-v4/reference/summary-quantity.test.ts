import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRefreshedTotals,
  clampQuantity,
  legendEffectAfterEdit,
  migrateLegacyQuantities,
  planSync,
  preExportCheck,
  primaryAction,
  revertAllMismatches,
  revertQuantity,
  rowView,
  rowViews,
  setQuantity,
  type PlacedLegend,
  type TrayItem,
} from './summary-quantity.ts';

const cam = (total: number, extra: Partial<TrayItem> = {}): TrayItem => ({
  assetId: 'asset-d6ps',
  name: 'D6PS-1',
  total,
  placed: 0,
  unit: '台',
  automatic: true,
  ...extra,
});
const nvr = (total: number, extra: Partial<TrayItem> = {}): TrayItem => ({
  assetId: 'preset::asset-nvr',
  sourceAssetId: 'asset-nvr',
  name: '录像机',
  total,
  placed: 0,
  unit: '台',
  automatic: false,
  ...extra,
});
const added = (total: number): TrayItem => ({
  assetId: 'manual::1',
  name: '交换机',
  total,
  placed: 0,
  unit: '台',
  automatic: false,
});
const legend = (rowId: string, quantity: number, id = `obj-${rowId}`): PlacedLegend => ({ id, quantityGroupId: rowId, quantity });

test('点位设备默认跟随图上点位数，来源显示“点位”', () => {
  const view = rowView(cam(7));
  assert.equal(view.qty, 7);
  assert.equal(view.source, 'point');
  assert.equal(view.sourceLabel, '点位');
  assert.equal(view.revertLabel, undefined);
  assert.equal(view.mismatch, false);
});

test('汇总设备默认用模板数，来源显示“模板”', () => {
  const view = rowView(nvr(1));
  assert.equal(view.qty, 1);
  assert.equal(view.sourceLabel, '模板');
});

test('手改点位设备：来源变“手改”，与点位数不同则 mismatch，回退文案带点位数', () => {
  const edited = setQuantity(cam(7), 6);
  const view = rowView(edited);
  assert.equal(view.qty, 6);
  assert.equal(view.sourceLabel, '手改');
  assert.equal(view.mismatch, true);
  assert.equal(view.revertLabel, '改回自动（7）');
});

test('手改值等于自动值 → 视为没手改（用户的“奇怪想法”）', () => {
  const edited = setQuantity(setQuantity(cam(6), 8), 6);
  assert.equal(edited.manualTotal, undefined);
  assert.equal(rowView(edited).sourceLabel, '点位');
});

test('之后点位数变化到和手改值一样，也自动恢复跟随', () => {
  const edited = setQuantity(cam(6), 8);
  const [refreshed] = applyRefreshedTotals([edited], { 'asset-d6ps': 8 });
  assert.equal(refreshed.manualTotal, undefined);
  const [later] = applyRefreshedTotals([refreshed], { 'asset-d6ps': 9 });
  assert.equal(rowView(later).qty, 9, '恢复跟随后继续跟着点位走，不会被钉死');
});

test('刷新点位数不会冲掉手改值', () => {
  const edited = setQuantity(cam(7), 5);
  const [refreshed] = applyRefreshedTotals([edited], { 'asset-d6ps': 9 });
  assert.equal(rowView(refreshed).qty, 5);
  assert.equal(rowView(refreshed).revertLabel, '改回自动（9）');
});

test('改回自动 / 改回模板', () => {
  assert.equal(rowView(revertQuantity(setQuantity(cam(7), 3))).qty, 7);
  const nvrEdited = setQuantity(nvr(1), 3);
  assert.equal(rowView(nvrEdited).revertLabel, '改回模板（1）');
  assert.equal(rowView(nvrEdited).mismatch, false, '汇总设备手改是常态，不报不一致');
  assert.equal(rowView(revertQuantity(nvrEdited)).qty, 1);
});

test('本图纸“添加设备”的行：改数量就是改它本身，没有回退', () => {
  const edited = setQuantity(added(1), 4);
  assert.equal(edited.total, 4);
  assert.equal(edited.manualTotal, undefined);
  assert.equal(rowView(edited).sourceLabel, '添加');
  assert.equal(rowView(edited).revertLabel, undefined);
});

test('输入清洗：负数、小数、NaN', () => {
  assert.equal(clampQuantity(-3), 0);
  assert.equal(clampQuantity(2.9), 2);
  assert.equal(clampQuantity(Number.NaN), 0);
});

test('手改立即写到已放置的图例，原位；改成 0 则移除；未放置不动', () => {
  const placed = legend('asset-d6ps', 7);
  assert.deepEqual(legendEffectAfterEdit(setQuantity(cam(7), 6), placed), { kind: 'update', legendId: placed.id, quantity: 6 });
  assert.deepEqual(legendEffectAfterEdit(setQuantity(cam(7), 0), placed), { kind: 'remove', legendId: placed.id });
  assert.deepEqual(legendEffectAfterEdit(setQuantity(cam(7), 6)), { kind: 'none' });
  assert.deepEqual(legendEffectAfterEdit(cam(7), legend('asset-d6ps', 7)), { kind: 'none' });
});

test('点位增加后图例挂“6→7”，点设备汇总只原位更新数量', () => {
  const items = applyRefreshedTotals([cam(6)], { 'asset-d6ps': 7 });
  const legends = [legend('asset-d6ps', 6)];
  assert.equal(rowViews(items, legends)[0].pendingBadge, '6→7');
  const plan = planSync(items, legends);
  assert.deepEqual(plan, { add: [], update: [{ legendId: 'obj-asset-d6ps', rowId: 'asset-d6ps', from: 6, to: 7 }], remove: [] });
});

test('手改过的行，再点设备汇总不会被改回点位数', () => {
  const items = applyRefreshedTotals([setQuantity(cam(6), 6 + 3)], { 'asset-d6ps': 7 });
  const legends = [legend('asset-d6ps', 9)];
  assert.deepEqual(planSync(items, legends), { add: [], update: [], remove: [] });
});

test('数量为 0 不放上图；已在图上的移除；行消失的图例也移除', () => {
  const items = [cam(0), nvr(1)];
  const legends = [legend('asset-d6ps', 3), legend('preset::asset-nvr', 1), legend('gone', 2)];
  const plan = planSync(items, legends);
  assert.deepEqual(plan.remove.sort(), ['obj-asset-d6ps', 'obj-gone'].sort());
  assert.deepEqual(plan.add, []);
  assert.equal(rowViews(items, legends)[0].pendingBadge, '3→0');
});

test('主按钮四种状态', () => {
  const items = [cam(7), nvr(1), added(2)];
  assert.deepEqual(primaryAction(planSync(items, []), 0), { label: '全部放到图上', enabled: true });
  const someLegends = [legend('asset-d6ps', 7)];
  assert.deepEqual(primaryAction(planSync(items, someLegends), 1), { label: '放上剩余 2 项', enabled: true });
  const stale = [legend('asset-d6ps', 6), legend('preset::asset-nvr', 1), legend('manual::1', 2)];
  assert.deepEqual(primaryAction(planSync(items, stale), 3), { label: '更新到图上（1）', enabled: true });
  const fresh = [legend('asset-d6ps', 7), legend('preset::asset-nvr', 1), legend('manual::1', 2)];
  assert.deepEqual(primaryAction(planSync(items, fresh), 3), { label: '已是最新', enabled: false });
});

test('导出前检查：只列点位设备的手改不一致，一致时为空（不弹窗）', () => {
  const items = [setQuantity(cam(7), 6), setQuantity(nvr(1), 2), cam(3, { assetId: 'asset-b' })];
  assert.deepEqual(preExportCheck(items), [{ rowId: 'asset-d6ps', name: 'D6PS-1', onDrawing: 7, manual: 6 }]);
  assert.deepEqual(preExportCheck(revertAllMismatches(items)), []);
  assert.equal(revertAllMismatches(items)[1].manualTotal, 2, '“全部改回自动”不动汇总设备');
});

test('旧工程迁移：图上显示的数为准，不同于基准就记成手改并会被提示', () => {
  const items = [cam(7), nvr(1), added(2), cam(4, { assetId: 'asset-same' })];
  const legends = [legend('asset-d6ps', 6), legend('preset::asset-nvr', 2), legend('manual::1', 5), legend('asset-same', 4)];
  const migrated = migrateLegacyQuantities(items, legends);
  assert.equal(migrated[0].manualTotal, 6);
  assert.equal(migrated[1].manualTotal, 2);
  assert.equal(migrated[2].manualTotal, undefined, '“添加”行没有基准，不记手改');
  assert.equal(migrated[2].total, 5, '“添加”行直接取图上的数');
  assert.equal(migrated[3].manualTotal, undefined, '相同就不算手改');
  assert.equal(preExportCheck(migrated).length, 1);
  assert.deepEqual(planSync(migrated, legends), { add: [], update: [], remove: [] }, '迁移后图上内容一律不变');
});
