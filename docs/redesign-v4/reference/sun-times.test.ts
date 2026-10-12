import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, autoModeAt, sunTimesUtc } from './sun-times.ts';

const city = (id: string) => CITIES.find((item) => item.id === id)!;

/** 把 UTC 毫秒换成北京时间 HH:MM 的分钟数，不依赖运行测试的电脑时区。 */
function beijingMinutes(utcMs: number): number {
  const date = new Date(utcMs + 8 * 3_600_000);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}
const hm = (text: string) => Number(text.slice(0, 2)) * 60 + Number(text.slice(3));

// 期望值为常见日出日落表数值（北京时间，取整到分钟），允许 ±4 分钟。
// 接入 xuyu 时请再用一份公开日出日落表（如 timeanddate.com）逐条核对一次，并把核对来源写进测试注释。
const CASES: Array<[string, number, number, number, string, string]> = [
  ['shanghai', 2026, 6, 21, '04:50', '19:01'],
  ['shanghai', 2026, 12, 21, '06:51', '16:54'],
  ['beijing', 2026, 6, 21, '04:46', '19:46'],
  ['beijing', 2026, 12, 21, '07:33', '16:53'],
  ['guangzhou', 2026, 6, 21, '05:43', '19:15'],
];

for (const [id, year, month, day, rise, set] of CASES) {
  test(`${city(id).name} ${year}-${month}-${day} 日出 ${rise} 日落 ${set}（±4 分钟）`, () => {
    const result = sunTimesUtc(year, month, day, city(id).lat, city(id).lon)!;
    assert.ok(Math.abs(beijingMinutes(result.sunrise) - hm(rise)) <= 4, `日出算得 ${beijingMinutes(result.sunrise)} 分`);
    assert.ok(Math.abs(beijingMinutes(result.sunset) - hm(set)) <= 4, `日落算得 ${beijingMinutes(result.sunset)} 分`);
  });
}

test('跟随时间只在白天 / 夜间之间切换，并给出下一次切换时刻', () => {
  // 测试进程用 TZ=Asia/Shanghai 运行（见 README 的命令）
  const { lat, lon } = city('shanghai');
  const noon = autoModeAt(new Date(2026, 9, 12, 12, 0), lat, lon);
  assert.equal(noon.mode, 'day');
  assert.ok(noon.nextSwitch.getHours() === 17, `10 月中旬上海日落约 17:30，算得 ${noon.nextSwitch.toString()}`);
  const night = autoModeAt(new Date(2026, 9, 12, 22, 0), lat, lon);
  assert.equal(night.mode, 'night');
  assert.equal(night.nextSwitch.getDate(), 13, '晚上之后的下一次切换是第二天日出');
  const dawn = autoModeAt(new Date(2026, 9, 12, 4, 0), lat, lon);
  assert.equal(dawn.mode, 'night');
  assert.equal(dawn.nextSwitch.getDate(), 12);
});
