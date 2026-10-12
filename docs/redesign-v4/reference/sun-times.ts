/**
 * 跟随时间（按日出日落） · 参考实现（v4）
 *
 * 对应规格：02-改版规格.md §T4。替换现有 src/core/theme-schedule.ts 的固定 07:00 / 19:00。
 * 只在“白天 ↔ 夜间”之间切换；护眼只能手动选（用户决定，2026-10）。
 * 离线计算（NOAA 简化日出方程，误差约 1–2 分钟），不联网。
 */

export interface City {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

/** 常用城市（可扩充）；设置里另提供“手动输入经纬度”。 */
export const CITIES: City[] = [
  { id: 'shanghai', name: '上海', lat: 31.2304, lon: 121.4737 },
  { id: 'beijing', name: '北京', lat: 39.9042, lon: 116.4074 },
  { id: 'guangzhou', name: '广州', lat: 23.1291, lon: 113.2644 },
  { id: 'shenzhen', name: '深圳', lat: 22.5431, lon: 114.0579 },
  { id: 'hangzhou', name: '杭州', lat: 30.2741, lon: 120.1551 },
  { id: 'nanjing', name: '南京', lat: 32.0603, lon: 118.7969 },
  { id: 'suzhou', name: '苏州', lat: 31.2990, lon: 120.5853 },
  { id: 'chengdu', name: '成都', lat: 30.5728, lon: 104.0668 },
  { id: 'chongqing', name: '重庆', lat: 29.5630, lon: 106.5516 },
  { id: 'wuhan', name: '武汉', lat: 30.5928, lon: 114.3055 },
  { id: 'xian', name: '西安', lat: 34.3416, lon: 108.9398 },
  { id: 'tianjin', name: '天津', lat: 39.3434, lon: 117.3616 },
  { id: 'shenyang', name: '沈阳', lat: 41.8057, lon: 123.4315 },
  { id: 'harbin', name: '哈尔滨', lat: 45.8038, lon: 126.5349 },
  { id: 'kunming', name: '昆明', lat: 25.0389, lon: 102.7183 },
  { id: 'urumqi', name: '乌鲁木齐', lat: 43.8256, lon: 87.6168 },
  { id: 'hongkong', name: '香港', lat: 22.3193, lon: 114.1694 },
  { id: 'singapore', name: '新加坡', lat: 1.3521, lon: 103.8198 },
];

const RAD = Math.PI / 180;
const J2000 = 2451545.0;
const UNIX_EPOCH_JD = 2440587.5;
const DAY_MS = 86_400_000;

/**
 * 某个公历日（年 / 月 1-12 / 日）在给定经纬度的日出、日落时刻（UTC 毫秒）。
 * 极昼 / 极夜返回 null（中国境内不会出现）。
 */
export function sunTimesUtc(year: number, month: number, day: number, lat: number, lon: number): { sunrise: number; sunset: number } | null {
  const n = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(2000, 0, 1)) / DAY_MS);
  const meanNoon = n - lon / 360;
  const anomaly = (357.5291 + 0.98560028 * meanNoon) % 360;
  const m = anomaly * RAD;
  const center = 1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m);
  const eclipticLongitude = ((anomaly + center + 180 + 102.9372) % 360) * RAD;
  const transit = J2000 + meanNoon + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * eclipticLongitude);
  const declination = Math.asin(Math.sin(eclipticLongitude) * Math.sin(23.4397 * RAD));
  const cosHourAngle =
    (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * Math.sin(declination)) / (Math.cos(lat * RAD) * Math.cos(declination));
  if (cosHourAngle < -1 || cosHourAngle > 1) return null;
  const hourAngle = Math.acos(cosHourAngle) / RAD;
  const toMs = (julian: number) => Math.round((julian - UNIX_EPOCH_JD) * DAY_MS);
  return { sunrise: toMs(transit - hourAngle / 360), sunset: toMs(transit + hourAngle / 360) };
}

export type AutoMode = 'day' | 'night';

/**
 * 现在应该是白天还是夜间，以及下一次切换的时刻（用它设一个定时器，不用每 30 秒轮询）。
 * `now` 用本机时区解释日期，和 Windows 时钟一致。
 */
export function autoModeAt(now: Date, lat: number, lon: number): { mode: AutoMode; nextSwitch: Date } {
  const today = sunTimesUtc(now.getFullYear(), now.getMonth() + 1, now.getDate(), lat, lon);
  if (!today) {
    // 极昼极夜兜底：按 07:00 / 19:00
    const hour = now.getHours();
    const next = new Date(now);
    next.setHours(hour >= 7 && hour < 19 ? 19 : 7, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return { mode: hour >= 7 && hour < 19 ? 'day' : 'night', nextSwitch: next };
  }
  const t = now.getTime();
  if (t < today.sunrise) return { mode: 'night', nextSwitch: new Date(today.sunrise) };
  if (t < today.sunset) return { mode: 'day', nextSwitch: new Date(today.sunset) };
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const next = sunTimesUtc(tomorrow.getFullYear(), tomorrow.getMonth() + 1, tomorrow.getDate(), lat, lon);
  return { mode: 'night', nextSwitch: new Date(next ? next.sunrise : t + 12 * 3_600_000) };
}
