/**
 * 设备汇总数量契约 · 参考实现（v4）
 *
 * 对应规格：02-改版规格.md §S（设备汇总）。
 * 对应现有代码：src/core/equipment.ts（refreshEquipmentSummary / equipmentPresetItemsForProject）、
 *              App.tsx generateTray / confirmEquipmentTray / 属性栏数量输入。
 *
 * 这是行为样板，不要求照搬文件结构；但移植后必须让 summary-quantity.test.ts 的全部用例
 * （改写成项目自己的测试框架也可以）在 xuyu 里通过。
 *
 * 核心决定：
 *   1. 数量只有一个真实来源：托盘行 EquipmentTrayItem。图例对象的 quantity 只是“显示副本”。
 *   2. 手改的数存在托盘行新增字段 manualTotal，不再直接改对象后被下一次刷新冲掉。
 *   3. 手改值等于自动值（点位数 / 模板数）时，视为没有手改，manualTotal 自动清掉。
 *   4. 手改立即写到已放置的图例上、原位不动；点位增减只挂“6→7”提示，点“设备汇总”才更新。
 *   5. 数量为 0 的设备不进汇总图例；已放置的图例在应用时移除（可撤销，由调用方放进同一个撤销步骤）。
 */

/** 与 src/shared/models.ts 的 EquipmentTrayItem 对齐，只多一个 manualTotal（新增、可选）。 */
export interface TrayItem {
  /** 行 id；已放置图例的 quantityGroupId 指向它。automatic 行 = 素材 id，预设行 = `preset::<id>`，手动添加行 = `manual::<uuid>` */
  assetId: string;
  sourceAssetId?: string;
  name: string;
  /**
   * 基准数量：
   *   automatic 行 = 当前图纸上的有效点位数（每次刷新重算）；
   *   preset 行    = 方案模板里的预设数量（每次刷新从模板重读）；
   *   manual:: 行  = 用户在本图纸添加时填的数量（没有模板可回退，所以改它就是改 total）。
   */
  total: number;
  placed: number;
  unit?: string;
  automatic?: boolean;
  /** 新增：手改值。undefined = 跟随基准。只对 automatic / preset 行有意义。 */
  manualTotal?: number;
}

/** 已放置的汇总图例（EditorObject 里 role === 'summary-device' 的对象）的最小视图。 */
export interface PlacedLegend {
  id: string;
  quantityGroupId: string;
  /** 图例上当前显示的数量（EditorObject.quantity） */
  quantity: number;
}

export type QuantitySource = 'point' | 'template' | 'added' | 'manual';

export interface RowView {
  rowId: string;
  name: string;
  unit?: string;
  /** 实际生效的数量 */
  qty: number;
  /** 不手改时应该是多少（点位数 / 模板数 / 添加时的数） */
  baseQty: number;
  source: QuantitySource;
  /** 界面标签文案，见规格文案表 */
  sourceLabel: '点位' | '模板' | '添加' | '手改';
  /** 回退按钮文案；没有可回退的为 undefined */
  revertLabel?: string;
  /** 点位设备手改后和图上点位数不一致 → 琥珀色“图上 7 · 手改 6”，导出前检查会列出它 */
  mismatch: boolean;
  /** 已放置图例显示的数和应有的数不一致时的提示，例如 "6→7"；没有为 undefined */
  pendingBadge?: string;
  placed: boolean;
}

const isAdded = (item: TrayItem) => !item.automatic && item.assetId.startsWith('manual::');

export function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function effectiveQty(item: TrayItem): number {
  return item.manualTotal ?? item.total;
}

export function sourceOf(item: TrayItem): QuantitySource {
  if (item.manualTotal !== undefined) return 'manual';
  if (item.automatic) return 'point';
  return isAdded(item) ? 'added' : 'template';
}

/** 规则 3：手改值等于基准值时清掉手改。每次刷新（点位数变化）后也要调用。 */
export function normalizeItem(item: TrayItem): TrayItem {
  if (item.manualTotal === undefined) return item;
  if (isAdded(item) || item.manualTotal === item.total) {
    const { manualTotal: _drop, ...rest } = item;
    return rest;
  }
  return item;
}

/** 用户在汇总清单或属性栏里改数量。 */
export function setQuantity(item: TrayItem, value: number): TrayItem {
  const qty = clampQuantity(value);
  if (isAdded(item)) return { ...item, total: qty };
  return normalizeItem({ ...item, manualTotal: qty });
}

/** “改回自动 / 改回模板”。 */
export function revertQuantity(item: TrayItem): TrayItem {
  return normalizeItem({ ...item, manualTotal: undefined });
}

export function rowView(item: TrayItem, legend?: PlacedLegend): RowView {
  const source = sourceOf(item);
  const qty = effectiveQty(item);
  const sourceLabel = ({ point: '点位', template: '模板', added: '添加', manual: '手改' } as const)[source];
  const revertLabel =
    source !== 'manual' ? undefined : item.automatic ? `改回自动（${item.total}）` : `改回模板（${item.total}）`;
  const mismatch = source === 'manual' && item.automatic === true && qty !== item.total;
  const pendingBadge =
    legend && legend.quantity !== qty ? `${legend.quantity}→${qty}` : undefined;
  return {
    rowId: item.assetId,
    name: item.name,
    unit: item.unit,
    qty,
    baseQty: item.total,
    source,
    sourceLabel,
    revertLabel,
    mismatch,
    pendingBadge,
    placed: Boolean(legend),
  };
}

export function legendByRow(legends: PlacedLegend[]): Map<string, PlacedLegend> {
  return new Map(legends.map((legend) => [legend.quantityGroupId, legend]));
}

export function rowViews(items: TrayItem[], legends: PlacedLegend[]): RowView[] {
  const byRow = legendByRow(legends);
  return items.map((item) => rowView(item, byRow.get(item.assetId)));
}

/**
 * 规则 4：手改立即生效。返回需要对已放置图例做的修改（调用方和 setQuantity 放进同一个撤销步骤）。
 * - 已放置且新数量 > 0 → 原位更新数量（不改 x/y）
 * - 已放置且新数量 = 0 → 移除图例
 * - 未放置 → 不动，等下次“设备汇总”放上去
 */
export type LegendEffect =
  | { kind: 'none' }
  | { kind: 'update'; legendId: string; quantity: number }
  | { kind: 'remove'; legendId: string };

export function legendEffectAfterEdit(item: TrayItem, legend?: PlacedLegend): LegendEffect {
  if (!legend) return { kind: 'none' };
  const qty = effectiveQty(item);
  if (qty === 0) return { kind: 'remove', legendId: legend.id };
  if (legend.quantity === qty) return { kind: 'none' };
  return { kind: 'update', legendId: legend.id, quantity: qty };
}

export interface SyncPlan {
  /** 要新放到图上的行（数量 > 0 且还没有图例） */
  add: string[];
  /** 原位更新数量的图例 */
  update: Array<{ legendId: string; rowId: string; from: number; to: number }>;
  /** 要移除的图例（行没了，或数量为 0） */
  remove: string[];
}

/** 点“设备汇总 / 更新到图上”时要做的事。已放置图例永远不改位置。 */
export function planSync(items: TrayItem[], legends: PlacedLegend[]): SyncPlan {
  const byRow = new Map(items.map((item) => [item.assetId, item]));
  const placedRows = new Set(legends.map((legend) => legend.quantityGroupId));
  const plan: SyncPlan = { add: [], update: [], remove: [] };
  for (const legend of legends) {
    const item = byRow.get(legend.quantityGroupId);
    const qty = item ? effectiveQty(item) : 0;
    if (!item || qty === 0) plan.remove.push(legend.id);
    else if (legend.quantity !== qty)
      plan.update.push({ legendId: legend.id, rowId: item.assetId, from: legend.quantity, to: qty });
  }
  for (const item of items) if (!placedRows.has(item.assetId) && effectiveQty(item) > 0) plan.add.push(item.assetId);
  return plan;
}

export interface PrimaryAction {
  label: string;
  enabled: boolean;
}

/** 汇总清单右下角主按钮的四种状态（文案以规格文案表为准）。 */
export function primaryAction(plan: SyncPlan, placedCount: number): PrimaryAction {
  const changes = plan.add.length + plan.update.length + plan.remove.length;
  if (placedCount === 0 && plan.add.length > 0) return { label: '全部放到图上', enabled: true };
  if (changes === 0) return { label: '已是最新', enabled: false };
  if (plan.update.length === 0 && plan.remove.length === 0) return { label: `放上剩余 ${plan.add.length} 项`, enabled: true };
  return { label: `更新到图上（${changes}）`, enabled: true };
}

export interface ExportMismatch {
  rowId: string;
  name: string;
  onDrawing: number;
  manual: number;
}

/** 导出前检查：只列“点位设备手改且和图上点位数不一致”的行。为空则不弹窗。 */
export function preExportCheck(items: TrayItem[]): ExportMismatch[] {
  return items
    .filter((item) => item.automatic && item.manualTotal !== undefined && item.manualTotal !== item.total)
    .map((item) => ({ rowId: item.assetId, name: item.name, onDrawing: item.total, manual: item.manualTotal! }));
}

/** 导出前检查弹窗里的“全部改回自动”。 */
export function revertAllMismatches(items: TrayItem[]): TrayItem[] {
  return items.map((item) => (item.automatic ? revertQuantity(item) : item));
}

/**
 * 旧工程迁移（只在第一次用新版本打开时跑一次）。
 * 旧版本属性栏改的是图例对象的 quantity，托盘行 total 不变，于是同一个设备有两个数。
 * 规则：图上显示的数为准，不同于基准就记成 manualTotal —— 不静默改图上内容，
 *       点位设备的这种差异会被琥珀色提示和导出前检查暴露出来，由用户一键改回自动。
 */
export function migrateLegacyQuantities(items: TrayItem[], legends: PlacedLegend[]): TrayItem[] {
  const byRow = legendByRow(legends);
  return items.map((item) => {
    if (item.manualTotal !== undefined) return item;
    const legend = byRow.get(item.assetId);
    if (!legend || legend.quantity === item.total) return item;
    // “添加”行没有基准可回退，图上的数直接成为它的数量。
    if (isAdded(item)) return { ...item, total: clampQuantity(legend.quantity) };
    return normalizeItem({ ...item, manualTotal: clampQuantity(legend.quantity) });
  });
}

/**
 * 刷新（点位数变化后）：automatic 行的 total 由 equipment.ts 重新统计后传进来，
 * 这里只负责保留手改并做规则 3 的归一。preset 行的 total 应从模板重读后传进来。
 */
export function applyRefreshedTotals(items: TrayItem[], totals: Record<string, number>): TrayItem[] {
  return items.map((item) =>
    totals[item.assetId] === undefined ? item : normalizeItem({ ...item, total: clampQuantity(totals[item.assetId]) }),
  );
}
