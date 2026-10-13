// 农历与干支转换（查表法，覆盖 1900-2100）。
// lunarInfo 为每年的农历编码（来源：solarlunar 标准数据 vsme/chinese-days，已验证）；
// 基准：1900-01-31 为农历 1900 年正月初一。
// 编码：位 0-3 = 闰月月份(0=无)；位 4-15 = 1-12 月大小(1=30天大月)；位 16 = 闰月大小(1=30天)。

const lunarInfo = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, // 1900-1909
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, // 1910-1919
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, // 1920-1929
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, // 1930-1939
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, // 1940-1949
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, // 1950-1959
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, // 1960-1969
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, // 1970-1979
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, // 1980-1989
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0, // 1990-1999
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, // 2000-2009
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, // 2010-2019
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, // 2020-2029
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, // 2030-2039
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, // 2040-2049
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0, // 2050-2059
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4, // 2060-2069
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, // 2070-2079
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, // 2080-2089
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252, // 2090-2099
  0x0d520, // 2100
];

const GAN = "甲乙丙丁戊己庚辛壬癸";
const ZHI = "子丑寅卯辰巳午未申酉戌亥";
const MONTH_CN = "正二三四五六七八九十冬腊";
const DAY_N1 = "日一二三四五六七八九十";
const DAY_N2 = "初十廿卅";

// 农历年总天数（含闰月）
function lYearDays(y) {
  let sum = 348; // 12 * 29
  for (let i = 0x8000; i > 0x8; i >>= 1) sum += lunarInfo[y - 1900] & i ? 1 : 0;
  return sum + leapDays(y);
}
// 闰月月份（0 = 当年无闰月）
function leapMonth(y) {
  return lunarInfo[y - 1900] & 0xf;
}
// 闰月天数
function leapDays(y) {
  if (leapMonth(y)) return lunarInfo[y - 1900] & 0x10000 ? 30 : 29;
  return 0;
}
// 普通农历月天数
function monthDays(y, m) {
  return lunarInfo[y - 1900] & (0x10000 >> m) ? 30 : 29;
}

// 公历 Date -> 农历 {lunarYear, lunarMonth, lunarDay, isLeap}
function solar2lunar(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const base = Date.UTC(1900, 0, 31); // 农历 1900 正月初一
  const obj = Date.UTC(y, m - 1, d);
  let offset = Math.round((obj - base) / 86400000);

  let temp = 0;
  let ly = 1900;
  for (; ly < 2101 && offset > 0; ly++) {
    temp = lYearDays(ly);
    offset -= temp;
  }
  if (offset < 0) {
    offset += temp;
    ly--;
  }

  const leap = leapMonth(ly);
  let isLeap = false;
  let lm = 1;
  for (; lm < 13 && offset > 0; lm++) {
    if (leap > 0 && lm === leap + 1 && !isLeap) {
      lm--;
      isLeap = true;
      temp = leapDays(ly);
    } else {
      temp = monthDays(ly, lm);
    }
    if (isLeap && lm === leap + 1) isLeap = false;
    offset -= temp;
  }
  if (offset === 0 && leap > 0 && lm === leap + 1) {
    if (isLeap) isLeap = false;
    else {
      isLeap = true;
      lm--;
    }
  }
  if (offset < 0) {
    offset += temp;
    lm--;
  }
  const ld = offset + 1;
  return { lunarYear: ly, lunarMonth: lm, lunarDay: ld, isLeap };
}

// 干支纪年（以正月初一为界，与农历年同步）
function ganzhiYear(year) {
  const g = (year - 4) % 10;
  const z = (year - 4) % 12;
  return GAN[(g + 10) % 10] + ZHI[(z + 12) % 12];
}

function chinaMonth(m, isLeap) {
  return (isLeap ? "闰" : "") + MONTH_CN[m - 1] + "月";
}

function chinaDay(d) {
  if (d === 10) return "初十";
  if (d === 20) return "二十";
  if (d === 30) return "三十";
  return DAY_N2[Math.floor(d / 10)] + DAY_N1[d % 10];
}

// 返回形如 "丙午年 九月初四" 的农历日期文本（含干支年）。
export function getLunarDateText(date) {
  const l = solar2lunar(date);
  const y = ganzhiYear(l.lunarYear);
  const md = chinaMonth(l.lunarMonth, l.isLeap) + chinaDay(l.lunarDay);
  return `${y}年 ${md}`;
}
