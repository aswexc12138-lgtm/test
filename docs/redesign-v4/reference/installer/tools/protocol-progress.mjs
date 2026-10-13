// 协议测试的日志解析（protocol-test.mjs 用；单独成文件，方便不启动 Wine / 安装包就能单测）。

/**
 * 从假宿主日志里取出 extract 阶段的字节数记录（每行开头是假宿主启动后的毫秒数）。
 * NSIS 每 150 ms 最多写一次进度；解压很快的机器上次数自然少，所以按“解压实际用了多久”算至少应有几次（1 – 3 次）。
 */
export function extractProgress(log) {
  const rows = log.split(/\r?\n/).map((line) => /^\s*(\d+)\s+phase=(\w*) extractDone=(\d*) extractTotal=(\d*)/.exec(line)).filter(Boolean)
    .map((m) => ({ t: Number(m[1]), phase: m[2], done: m[3] === '' ? null : Number(m[3]), total: m[4] === '' ? null : Number(m[4]) }));
  const start = rows.find((r) => r.phase === 'extract');
  const end = rows.find((r) => r.phase === 'copy');
  const durationMs = start && end ? end.t - start.t : 0;
  const records = rows.filter((r) => r.phase === 'extract' && r.done !== null && r.total);
  const expected = Math.min(3, Math.max(1, Math.floor(durationMs / 150) - 1));
  return { records, durationMs, expected };
}
