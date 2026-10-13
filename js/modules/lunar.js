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

// 12 个「节」（小寒/立春/惊蛰/清明/立夏/芒种/小暑/立秋/白露/寒露/立冬/大雪）的公历日，
// 按年×月一维排列，每年 12 个 base36 字符（a=10..v=31），月 m 在下标 (y-1900)*12+m-1。
// 数据由权威库 lunar-javascript（6tail）提取，已全量对照验证。
const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";
const JIE_TBL =
  "757677899a98757677999a99767778999a997687889aaa99867677899a98757677999a99767777999a997687889aaa99867677899a98757677999a99" + // 1900-1909
  "767777999a997687889aaa99867677899a98757677999a99757677999a9976777899aa99767677899998757677999a99757677999a9976777899aa99" + // 1910-1919
  "767677899998757677999a98757677999a9976777899aa99767677899998757677999a98757677999a9976777899aa99767677899988757677899a98" + // 1920-1929
  "757677999a99767778999a99767677899988757677899a98757677999a99767777999a99767677899988757677899a98757677999a99767777999a99" + // 1930-1939
  "767677899988757677899a98757677999a99767777999a99767667899988757677899998757677999a99757677999a99766667889988657677899998" + // 1940-1949
  "757677999a99757677999a99766667889988657677899998757677999a98757677999a99766667889988657677899998757677899a98757677999a99" + // 1950-1959
  "766667888988657677899988757677899a98757677999a99766667888988657677899988757677899a98757677999a99766666888988657677899988" + // 1960-1969
  "757677899a98757677999a99766666888988657667899988757677899a98757677999a99766566888988657667889988757677899998757677999a99" + // 1970-1979
  "766566888988657667889988757677899998757677999a99756566888988656667889988657677899998757677899a98756566888988656667888988" + // 1980-1989
  "657677899998757677899a98756566888988656667888988657677899988757677899a98756566888988656666888988657677899988757677899a98" + // 1990-1999
  "756566888988656666888988657677899988757677899a98756566888988656666888988657667889988757677899a98756566888988656566888988" + // 2000-2009
  "657667889988757677899998756566888988656566888988657667889988757677899998756566888988646566888988656667889988657677899998" + // 2010-2019
  "756566788988646566888988656667888988657677899998756566788987646566888988656666888988657677899988756566788987646566888988" + // 2020-2029
  "656666888988657677899988756566788987646566888988656666888988657667889988756566788987646566888988656666888988657667889988" + // 2030-2039
  "756566788987646566888988656566888988657667889988756566788887646566888988656566888988657667889988756566788887646566788988" + // 2040-2049
  "646566888988656667888988656566788887646566788988646566888988656666888988656566788887646566788987646566888988656666888988" + // 2050-2059
  "656566788877646566788987646566888988656666888988656566788877646566788987646566888988656666888988656556778877646566788987" + // 2060-2069
  "646566888988656666888988656556778877646566788887646566888988656566888988656556778877646566788887646566788988656566888988" + // 2070-2079
  "656556778877646566788887646566788988646566888988655556777877546566788887646566788988646566888988655555777877546566788887" + // 2080-2089
  "646566788987646566888988655555777877546566788877646566788987646566888988655555777877546566778877646566788987646566888988" + // 2090-2099
  "656666888988"; // 2100

const GAN = "甲乙丙丁戊己庚辛壬癸";
const ZHI = "子丑寅卯辰巳午未申酉戌亥";
const MONTH_CN = "正二三四五六七八九十冬腊";
const DAY_N1 = "日一二三四五六七八九十";
const DAY_N2 = "初十廿卅";
const YEAR_N = "〇一二三四五六七八九";

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
  if (offset < 0) return null; // 早于基准日，超出查表范围

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
  if (!l) return "";
  const y = ganzhiYear(l.lunarYear);
  const md = chinaMonth(l.lunarMonth, l.isLeap) + chinaDay(l.lunarDay);
  return `${y}年 ${md}`;
}

// ===== 干支纪日 / 纪月 / 纪年（八字体系：年柱以立春为界、月柱以节为界） =====

// 公历某年 m 月的「节」所在日（m=1 小寒 … m=12 大雪）
function jieDay(y, m) {
  if (y < 1900 || y > 2100) return -1;
  return B36.indexOf(JIE_TBL[(y - 1900) * 12 + m - 1]);
}

// 日柱：以 1949-10-01（甲子日）为锚点，按天数差取六十甲子
function dayPillar(date) {
  const BASE = Date.UTC(1949, 9, 1);
  let idx = Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - BASE) / 86400000) % 60;
  if (idx < 0) idx += 60;
  return GAN[idx % 10] + ZHI[idx % 12];
}

// 年柱：立春前属上一干支年
function yearPillar(date) {
  const y = date.getFullYear();
  const lichun = new Date(y, 1, jieDay(y, 2));
  return ganzhiYear(date < lichun ? y - 1 : y);
}

// 月柱：以「节」为界。k = 距寅月的月数（寅0 卯1 … 子10 丑11）。
// 月干由年干按五虎遁起（甲己→丙寅，乙庚→戊寅，丙辛→庚寅，丁壬→壬寅，戊癸→甲寅）。
function monthPillar(date) {
  const y = date.getFullYear();
  // 落在大雪(y-1) 段（小于小寒(y)）
  let k, yr;
  const xh = new Date(y, 0, jieDay(y, 1)); // 小寒
  if (date < xh) {
    k = 10; // 大雪 → 子月
    yr = y - 1;
  } else {
    // 从立冬(11月)往下找最近的节；大雪(y,12月)单独判
    const ds = new Date(y, 11, jieDay(y, 12));
    if (date >= ds) {
      k = 10;
      yr = y;
    } else {
      let i = 10; // 立冬在 11 月，倒查到立春(2月)
      while (i >= 1 && date < new Date(y, i, jieDay(y, i + 1))) i--;
      k = (i - 1 + 12) % 12;
      yr = i >= 1 ? y : y - 1; // 小寒段(1月节前无)理论不走 yr=y-1，防御
    }
  }
  const gan = GAN.indexOf(ganzhiYear(yr)[0]);
  const stem = (gan % 5) * 2 + 2 + k; // 五虎遁：寅月起干
  const branch = (k + 2) % 12; // 寅=2 … 子=0、丑=1
  return GAN[stem % 10] + ZHI[branch];
}

// 年份数字转汉字（2026 → 二〇二六）
function yearCN(y) {
  return String(y)
    .split("")
    .map((c) => YEAR_N[+c])
    .join("");
}

// 返回左上角徽标文本："二〇二六年九月初四日 丙午年戊戌月庚申日"
// 年份数字取农历年的起始公历年；干支三柱按八字体系（年柱立春界、月柱节界、日柱连续）。
export function getLunarBadgeText(date) {
  const l = solar2lunar(date);
  if (!l) return "";
  const md = yearCN(l.lunarYear) + "年" + chinaMonth(l.lunarMonth, l.isLeap) + chinaDay(l.lunarDay) + "日";
  const gz = `${yearPillar(date)}年${monthPillar(date)}月${dayPillar(date)}日`;
  return `${md} ${gz}`;
}
