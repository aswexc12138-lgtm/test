/**
 * 设备汇总图例排版 · 参考实现（v4）
 *
 * 对应规格：02-改版规格.md §S5（图例排版）、§M3（标签换行只算一次）。
 * 对应现有代码：
 *   - App.tsx addAllDevicesFromTray（约 3512-3529 行）：现在按“图片宽 + 18”横排一行、不换行；
 *   - src/core/object-label-layout.ts：标签在图片正下方居中，宽度默认“图片宽 + 40”。
 *   两者相加 → 相邻标签互相压 ~22px，名字长就压得更多，这就是“图例文字重叠”的根因。
 *
 * 本文件只算“放在哪、标签多宽、断成哪几行”，不画任何东西。画布（Konva）和 PDF 导出
 * 都必须使用这里算出的 lines，而不是各自再按字符换行（见规格 §M3）。
 *
 * 模型（与 EditorObject 一致）：
 *   图片：左上角 (x, y)，宽高 imageW × imageH（任意比例，不假设正方形）
 *   标签位置两种（规格 S-05，待用户确认用哪种；用户确认前保持现状 'below'）：
 *     'below'：现状。标签宽 labelWidth，水平居中于图片，顶边在 y + imageH + nameGap（objectLabelLayout 的默认算法）；
 *     'right'：演示页样式。标签在图片右侧 captionGap 处，左对齐，与图片垂直居中。
 *              不新增字段：用现有 EditorObject.labelOffset 把标签从“下方居中”挪到“右侧”，本文件直接算出这个偏移。
 *   行高 fontSize × lineHeight。占位框（footprint）= 图片与标签的并集，排版只看占位框。
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LegendInput {
  rowId: string;
  imageW: number;
  imageH: number;
  name: string;
  qty: number;
  unit: string;
}

export interface LegendLayoutOptions {
  /** 'row' = 横排，满了换行（默认，和现在一致）；'column' = 竖排，满了换列。方案设置项。 */
  direction: 'row' | 'column';
  /** 标签在图片下方（默认，现状）还是右侧（演示页）。 */
  labelPosition?: 'below' | 'right';
  /** labelPosition = 'right' 时图片与文字的间距，默认 8 */
  captionGap?: number;
  /** 第一个占位框的左上角 = 用户在画布上点的位置（没点过时由调用方给“当前可见区域”的左上角） */
  anchor: { x: number; y: number };
  page: { width: number; height: number };
  /** 页面内边距，沿用现有代码的 18 */
  margin?: number;
  /** 占位框之间的最小间距，沿用现有 max(18, deviceNameGap + 12) */
  gap: number;
  nameGap: number;
  fontSize: number;
  /** 行高倍数，沿用 TextStyle.lineHeight */
  lineHeight: number;
  /** 标签最大宽度；超过就换行。建议默认 max(图片宽, 7 × fontSize) 与 12 × fontSize 中的较大者 */
  maxLabelWidth: number;
  /** 已在图上的东西（其他图例、分类说明、点位…）的占位框；新放的图例会避开它们 */
  obstacles?: Rect[];
  /** 为数量预留几位数，数量从 1 涨到 999 时占位不变、不会压到邻居。默认 3 */
  reserveDigits?: number;
  /** 文本宽度测量。默认 = src/core/text-layout.ts 同款估算（CJK 1em、空白 0.35em、其他 0.56em） */
  measure?: (text: string, fontSize: number) => number;
}

export interface LegendPlacement {
  rowId: string;
  /** 写回 EditorObject.x / y（图片左上角） */
  x: number;
  y: number;
  /** 写回 EditorObject.labelWidth，固定标签框，数量变化时不再变宽 */
  labelWidth: number;
  /** 写回 EditorObject.labelOffset（'below' 时为 0,0）；配合 objectLabelLayout 的默认算法得到最终标签位置 */
  labelOffset: { x: number; y: number };
  /** 写回 EditorObject.style.align */
  align: 'center' | 'left';
  /** 标签断行结果，两个渲染器都按它画 */
  lines: string[];
  /** 为预留位数准备的行数（占位高度按它算） */
  reservedLineCount: number;
  footprint: Rect;
  /** 超出页面（空间不够时仍然放，但调用方要提示“N 个图例超出页面”） */
  overflow: boolean;
}

export const QTY_SEPARATOR = ' × ';

/** 与 src/core/equipment.ts formatDeviceLabel 保持同一格式：`${name} × ${qty}${unit}` */
export function quantityToken(qty: number, unit: string): string {
  return `× ${Math.max(0, qty)}${unit}`;
}

function characterWidthFactor(character: string): number {
  if (character === '\t') return 2;
  if (/\s/u.test(character)) return 0.35;
  return character.codePointAt(0)! > 0xff ? 1 : 0.56;
}

export function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const character of text) width += fontSize * characterWidthFactor(character);
  return width;
}

const isCjk = (character: string) => character.codePointAt(0)! > 0xff && !/\s/u.test(character);

/**
 * 名称切成可断开的片段：中文逐字；连续的字母数字（型号如 DS-2CD3T46）尽量作为整体，
 * 只在连字符 / 斜杠 / 下划线之后允许断开（片段之间不加空格，放得下时照样连在一行）。
 */
export function nameTokens(name: string): string[] {
  const tokens: string[] = [];
  let run = '';
  const flush = () => {
    if (run) tokens.push(...(run.match(/[^-/_]+[-/_]*|[-/_]+/g) ?? [run]));
    run = '';
  };
  for (const character of name) {
    if (/\s/u.test(character)) {
      flush();
      tokens.push(' ');
    } else if (isCjk(character)) {
      flush();
      tokens.push(character);
    } else run += character;
  }
  flush();
  return tokens;
}

/**
 * 贪心断行。规则：
 *   - 数量片段 “× 2台” 永不拆开；
 *   - 型号等连续字母数字只有在它自己比整行还宽时才硬拆；
 *   - 行首不留空格。
 */
export function wrapLabel(
  name: string,
  qtyToken: string,
  maxWidth: number,
  fontSize: number,
  measure: (text: string, fontSize: number) => number = estimateTextWidth,
): string[] {
  const tokens = [...nameTokens(name.trim()), ' ', qtyToken];
  const lines: string[] = [];
  let line = '';
  const width = (text: string) => measure(text, fontSize);
  const push = () => {
    lines.push(line.trimEnd());
    line = '';
  };
  tokens.forEach((token, index) => {
    const isQty = index === tokens.length - 1;
    if (token === ' ') {
      if (line) line += ' ';
      return;
    }
    if (line.trim() && width(line + token) > maxWidth) push();
    if (!line.trim()) line = '';
    if (!isQty && width(token) > maxWidth) {
      // 单个片段比整行还宽：按字符硬拆（数量片段永不拆）
      for (const character of token) {
        if (line && width(line + character) > maxWidth) push();
        line += character;
      }
      return;
    }
    line += token;
  });
  if (line.trim()) push();
  return lines.map((text) => text.replace(/ /g, ' '));
}

function widestLine(lines: string[], fontSize: number, measure: (text: string, fontSize: number) => number) {
  return Math.max(0, ...lines.map((text) => measure(text, fontSize)));
}

/** 测出一个图例的标签宽度、断行和预留行数（数量从现在涨到 reserveDigits 位都放得下）。 */
export function measureLegend(input: LegendInput, options: LegendLayoutOptions) {
  const measure = options.measure ?? estimateTextWidth;
  const reserveDigits = options.reserveDigits ?? 3;
  const actualDigits = String(Math.max(0, input.qty)).length;
  const variants = [quantityToken(input.qty, input.unit)];
  for (let digits = actualDigits; digits <= Math.max(actualDigits, reserveDigits); digits += 1)
    variants.push(quantityToken(Number('8'.repeat(digits)), input.unit));
  let labelWidth = 0;
  let reservedLineCount = 1;
  for (const token of variants) {
    const lines = wrapLabel(input.name, token, options.maxLabelWidth, options.fontSize, measure);
    labelWidth = Math.max(labelWidth, widestLine(lines, options.fontSize, measure));
    reservedLineCount = Math.max(reservedLineCount, lines.length);
  }
  // 留 0.1em 余量，吸收真实字形与估算之间的细小误差（两个渲染器都不再自行换行）。
  labelWidth = Math.ceil(labelWidth + options.fontSize * 0.1);
  const lines = wrapLabel(input.name, quantityToken(input.qty, input.unit), labelWidth, options.fontSize, measure);
  const textHeight = reservedLineCount * options.fontSize * options.lineHeight;
  if (options.labelPosition === 'right') {
    const captionGap = options.captionGap ?? 8;
    return {
      labelWidth,
      lines,
      reservedLineCount,
      textHeight,
      footprintW: input.imageW + captionGap + labelWidth,
      footprintH: Math.max(input.imageH, textHeight),
    };
  }
  const footprintW = Math.max(input.imageW, labelWidth);
  const footprintH = input.imageH + options.nameGap + textHeight;
  return { labelWidth, lines, reservedLineCount, textHeight, footprintW, footprintH };
}

const EPS = 1e-6;

export function intersects(a: Rect, b: Rect, gap = 0): boolean {
  return (
    a.x < b.x + b.w + gap - EPS &&
    b.x < a.x + a.w + gap - EPS &&
    a.y < b.y + b.h + gap - EPS &&
    b.y < a.y + a.h + gap - EPS
  );
}

const transpose = (rect: Rect): Rect => ({ x: rect.y, y: rect.x, w: rect.h, h: rect.w });

/** 以“行”为主轴的流式排版；竖排通过转置坐标复用同一段逻辑。 */
function flow(
  sizes: Array<{ w: number; h: number }>,
  anchor: { x: number; y: number },
  bounds: Rect,
  gap: number,
  obstacles: Rect[],
): Array<{ rect: Rect; overflow: boolean }> {
  const placed: Array<{ rect: Rect; overflow: boolean }> = [];
  let x = anchor.x;
  let y = anchor.y;
  let lineExtent = 0;
  for (const size of sizes) {
    for (let guard = 0; ; guard += 1) {
      const rect = { x, y, w: size.w, h: size.h };
      if (guard > 10_000) {
        placed.push({ rect, overflow: true });
        break;
      }
      if (x + size.w > bounds.x + bounds.w + EPS && x > anchor.x + EPS) {
        y += lineExtent + gap;
        x = anchor.x;
        lineExtent = 0;
        continue;
      }
      const hit = [...obstacles, ...placed.map((item) => item.rect)].find((other) => intersects(rect, other, gap));
      if (hit) {
        x = hit.x + hit.w + gap;
        lineExtent = Math.max(lineExtent, hit.y + hit.h - y);
        continue;
      }
      const overflow =
        rect.x < bounds.x - EPS ||
        rect.y < bounds.y - EPS ||
        rect.x + rect.w > bounds.x + bounds.w + EPS ||
        rect.y + rect.h > bounds.y + bounds.h + EPS;
      placed.push({ rect, overflow });
      x += size.w + gap;
      lineExtent = Math.max(lineExtent, size.h);
      break;
    }
  }
  return placed;
}

export function layoutLegends(inputs: LegendInput[], options: LegendLayoutOptions): LegendPlacement[] {
  const margin = options.margin ?? 18;
  const measured = inputs.map((input) => ({ input, ...measureLegend(input, options) }));
  const bounds: Rect = {
    x: margin,
    y: margin,
    w: Math.max(0, options.page.width - margin * 2),
    h: Math.max(0, options.page.height - margin * 2),
  };
  const anchor = {
    x: Math.min(Math.max(options.anchor.x, bounds.x), bounds.x + bounds.w),
    y: Math.min(Math.max(options.anchor.y, bounds.y), bounds.y + bounds.h),
  };
  const sizes = measured.map((item) => ({ w: item.footprintW, h: item.footprintH }));
  const obstacles = options.obstacles ?? [];
  const column = options.direction === 'column';
  const rects = column
    ? flow(
        sizes.map((size) => ({ w: size.h, h: size.w })),
        { x: anchor.y, y: anchor.x },
        transpose(bounds),
        options.gap,
        obstacles.map(transpose),
      ).map((item) => ({ rect: transpose(item.rect), overflow: item.overflow }))
    : flow(sizes, anchor, bounds, options.gap, obstacles);
  return measured.map((item, index) => {
    const { rect, overflow } = rects[index];
    const { imageW, imageH } = item.input;
    if (options.labelPosition === 'right') {
      const captionGap = options.captionGap ?? 8;
      const imageY = rect.y + (rect.h - imageH) / 2;
      // objectLabelLayout 默认把标签放在 left = (imageW - labelWidth) / 2、top = imageH + nameGap；
      // 目标是 left = imageW + captionGap、top = 文字块与图片垂直居中。
      const labelTop = rect.y + (rect.h - item.textHeight) / 2 - imageY;
      return {
        rowId: item.input.rowId,
        x: rect.x,
        y: imageY,
        labelWidth: item.labelWidth,
        labelOffset: {
          x: imageW + captionGap - (imageW - item.labelWidth) / 2,
          y: labelTop - (imageH + options.nameGap),
        },
        align: 'left' as const,
        lines: item.lines,
        reservedLineCount: item.reservedLineCount,
        footprint: rect,
        overflow,
      };
    }
    return {
      rowId: item.input.rowId,
      x: rect.x + (rect.w - imageW) / 2,
      y: rect.y,
      labelWidth: item.labelWidth,
      labelOffset: { x: 0, y: 0 },
      align: 'center' as const,
      lines: item.lines,
      reservedLineCount: item.reservedLineCount,
      footprint: rect,
      overflow,
    };
  });
}

/** 已放置图例的占位框（作为后续新图例的障碍物，或用于碰撞自检）。 */
export function legendFootprint(
  object: { x: number; y: number; imageW: number; imageH: number; labelWidth: number; lineCount: number },
  style: { nameGap: number; fontSize: number; lineHeight: number },
): Rect {
  const w = Math.max(object.imageW, object.labelWidth);
  return {
    x: object.x + Math.min(0, (object.imageW - object.labelWidth) / 2),
    y: object.y,
    w,
    h: object.imageH + style.nameGap + object.lineCount * style.fontSize * style.lineHeight,
  };
}
