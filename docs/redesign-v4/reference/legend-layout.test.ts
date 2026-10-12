import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateTextWidth,
  intersects,
  layoutLegends,
  measureLegend,
  quantityToken,
  wrapLabel,
  type LegendInput,
  type LegendLayoutOptions,
  type Rect,
} from './legend-layout.ts';

const base: LegendLayoutOptions = {
  direction: 'row',
  anchor: { x: 40, y: 40 },
  page: { width: 1191, height: 842 },
  gap: 18,
  nameGap: 8,
  fontSize: 12,
  lineHeight: 1.3,
  maxLabelWidth: 144,
};

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const NAMES = ['录像机', 'D6PS-1', '海康 DS-2CD3T46WDV3-I3 4mm', '客流计数器（双目）', 'POE交换机 8口', '球机', 'AP', '门禁读卡器 带按钮 出门开关', 'X'];
const UNITS = ['台', '个', '套'];

function randomInputs(random: () => number, count: number): LegendInput[] {
  return Array.from({ length: count }, (_, index) => {
    const size = 14 + random() * 70;
    const aspect = 0.2 + random() * 4.8; // 0.2 ~ 5：扁长、竖长都有，不假设正方形
    return {
      rowId: `row-${index}`,
      imageW: aspect >= 1 ? size : size * aspect,
      imageH: aspect >= 1 ? size / aspect : size,
      name: NAMES[Math.floor(random() * NAMES.length)],
      qty: 1 + Math.floor(random() * 30),
      unit: UNITS[Math.floor(random() * UNITS.length)],
    };
  });
}

function assertNoOverlap(rects: Rect[], gap: number, message: string) {
  for (let i = 0; i < rects.length; i += 1)
    for (let j = i + 1; j < rects.length; j += 1)
      assert.equal(intersects(rects[i], rects[j], gap), false, `${message}: #${i} 与 #${j} 间距小于 ${gap}`);
}

test('数量片段 “× 2台” 永不拆开', () => {
  for (let width = 20; width <= 200; width += 7) {
    const lines = wrapLabel('海康 DS-2CD3T46 客流计数器', quantityToken(2, '台'), width, 12);
    assert.ok(lines.some((line) => line.endsWith('× 2台')), `width=${width}: ${JSON.stringify(lines)}`);
    assert.ok(!lines.some((line) => line === '×' || /× $/.test(line)));
  }
});

test('型号放得下时不被拆开，放不下才硬拆', () => {
  const lines = wrapLabel('海康 DS-2CD3T46 球机', quantityToken(12, '台'), 100, 12);
  assert.ok(lines.some((line) => line.includes('DS-2CD3T46')), JSON.stringify(lines));
  const narrow = wrapLabel('DS-2CD3T46WDV3', quantityToken(1, '台'), 40, 12);
  assert.ok(narrow.length > 2, JSON.stringify(narrow));
  for (const line of narrow.slice(0, -1)) assert.ok(estimateTextWidth(line, 12) <= 40 + 1e-9, line);
});

test('单行能放下时，结果和现有 formatDeviceLabel 格式完全一致', () => {
  assert.deepEqual(wrapLabel('录像机', quantityToken(1, '台'), 200, 12), ['录像机 × 1台']);
});

test('第一个图例从用户点击的位置开始', () => {
  const [first] = layoutLegends(randomInputs(rng(1), 3), base);
  assert.equal(first.footprint.x, 40);
  assert.equal(first.footprint.y, 40);
});

test('横排满了换行；竖排第二个在第一个下面', () => {
  const inputs = randomInputs(rng(2), 30);
  const rows = layoutLegends(inputs, base);
  assert.ok(new Set(rows.map((item) => item.footprint.y)).size > 1, '30 个图例一行放不下，必须换行');
  const columns = layoutLegends(inputs.slice(0, 2), { ...base, direction: 'column' });
  assert.equal(columns[1].footprint.x, columns[0].footprint.x);
  assert.ok(columns[1].footprint.y >= columns[0].footprint.y + columns[0].footprint.h + base.gap - 1e-9);
});

test('避开已有的图例 / 分类说明 / 点位', () => {
  const obstacles: Rect[] = [{ x: 60, y: 30, w: 200, h: 120 }, { x: 400, y: 40, w: 80, h: 300 }];
  const placed = layoutLegends(randomInputs(rng(3), 12), { ...base, obstacles });
  for (const item of placed)
    for (const obstacle of obstacles) assert.equal(intersects(item.footprint, obstacle, base.gap), false);
});

test('120 组随机形状 / 名称 / 方向：任何两个占位框都不重叠，且不压障碍物', () => {
  for (let seed = 1; seed <= 120; seed += 1) {
    const random = rng(seed * 7919);
    const inputs = randomInputs(random, 1 + Math.floor(random() * 15));
    const obstacles: Rect[] = Array.from({ length: Math.floor(random() * 4) }, () => ({
      x: random() * 900,
      y: random() * 600,
      w: 20 + random() * 180,
      h: 20 + random() * 120,
    }));
    const options: LegendLayoutOptions = {
      ...base,
      direction: random() < 0.5 ? 'row' : 'column',
      anchor: { x: random() * 800, y: random() * 500 },
      fontSize: 9 + Math.floor(random() * 8),
      maxLabelWidth: 60 + random() * 160,
      obstacles,
    };
    const placed = layoutLegends(inputs, options);
    assertNoOverlap(placed.map((item) => item.footprint), options.gap, `seed ${seed}`);
    for (const item of placed) {
      for (const obstacle of obstacles) assert.equal(intersects(item.footprint, obstacle, options.gap), false, `seed ${seed} 压到障碍物`);
      assert.ok(item.lines.at(-1)!.includes('×'), `seed ${seed} 数量片段丢失`);
      assert.ok(item.lines.length <= item.reservedLineCount);
    }
  }
});

test('数量从 1 涨到 999，标签宽高都不超过预留的占位（不会压到邻居）', () => {
  for (const input of randomInputs(rng(4), 60)) {
    const measured = measureLegend(input, base);
    for (const qty of [input.qty, 9, 10, 99, 100, 999]) {
      const lines = wrapLabel(input.name, quantityToken(qty, input.unit), measured.labelWidth, base.fontSize);
      assert.ok(lines.length <= measured.reservedLineCount, `${input.name} × ${qty}: ${lines.length} > ${measured.reservedLineCount}`);
      for (const line of lines) assert.ok(estimateTextWidth(line, base.fontSize) <= measured.labelWidth + 1e-9);
    }
  }
});

test('同样的输入，结果完全一样（屏幕与 PDF 都按这份结果画）', () => {
  const inputs = randomInputs(rng(5), 10);
  assert.deepEqual(layoutLegends(inputs, base), layoutLegends(inputs, base));
});

test('空间不够时照样放，但标记 overflow 让界面提示', () => {
  const inputs = randomInputs(rng(6), 40);
  const placed = layoutLegends(inputs, { ...base, page: { width: 300, height: 200 } });
  assert.ok(placed.some((item) => item.overflow));
  assertNoOverlap(placed.map((item) => item.footprint), base.gap, 'overflow 时也不能互相压');
});

/** 按 xuyu 现有 objectLabelLayout 的算法，从对象字段还原标签框（用来验证 labelOffset 写回后位置正确）。 */
function labelRectFromObject(p: { x: number; y: number; labelWidth: number; labelOffset: { x: number; y: number } }, imageW: number, imageH: number, nameGap: number, lines: number) {
  return {
    x: p.x + (imageW - p.labelWidth) / 2 + p.labelOffset.x,
    y: p.y + imageH + nameGap + p.labelOffset.y,
    w: p.labelWidth,
    h: lines * base.fontSize * base.lineHeight,
  };
}

test('标签在右侧（演示页样式）：写回 labelOffset 后标签正好在图片右边、垂直居中、在占位框内', () => {
  const inputs = randomInputs(rng(7), 12);
  const placed = layoutLegends(inputs, { ...base, labelPosition: 'right', direction: 'column' });
  placed.forEach((item, index) => {
    const { imageW, imageH } = inputs[index];
    const label = labelRectFromObject(item, imageW, imageH, base.nameGap, item.reservedLineCount);
    assert.ok(Math.abs(label.x - (item.x + imageW + 8)) < 1e-6, '标签左边 = 图片右边 + 8');
    assert.ok(Math.abs(label.y + label.h / 2 - (item.y + imageH / 2)) < 1e-6, '标签与图片垂直居中');
    assert.ok(label.x + label.w <= item.footprint.x + item.footprint.w + 1e-6);
    assert.ok(item.y >= item.footprint.y - 1e-6 && item.y + imageH <= item.footprint.y + item.footprint.h + 1e-6);
    assert.equal(item.align, 'left');
  });
});

test('标签在下方（现状）：labelOffset 为 0，位置与 objectLabelLayout 默认算法一致', () => {
  const inputs = randomInputs(rng(8), 6);
  for (const item of layoutLegends(inputs, base)) {
    assert.deepEqual(item.labelOffset, { x: 0, y: 0 });
    assert.equal(item.align, 'center');
  }
});

test('标签在右侧时，120 组随机输入同样两两不重叠', () => {
  for (let seed = 1; seed <= 120; seed += 1) {
    const random = rng(seed * 104729);
    const inputs = randomInputs(random, 1 + Math.floor(random() * 15));
    const options: LegendLayoutOptions = { ...base, labelPosition: 'right', direction: random() < 0.5 ? 'row' : 'column', anchor: { x: random() * 800, y: random() * 500 } };
    assertNoOverlap(layoutLegends(inputs, options).map((item) => item.footprint), options.gap, `right seed ${seed}`);
  }
});
