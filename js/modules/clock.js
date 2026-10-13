// 时钟：秒级刷新，用 rAF 对齐到整秒边界，避免 setInterval 累积漂移。
// 休眠唤醒后 rAF 自动校正，不丢秒。

import { getLunarDateText } from "./lunar.js";

const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function initClock(settings) {
  const timeEl = document.getElementById("clock-time");
  const dateEl = document.getElementById("clock-date");
  const lunarEl = document.getElementById("clock-lunar");
  let lastLunarKey = "";

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function render() {
    const now = new Date();
    let t = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (settings.clock.showSeconds) t += `:${pad(now.getSeconds())}`;
    timeEl.textContent = t;

    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();

    if (settings.clock.showDate) {
      dateEl.textContent = `${y}年${m}月${d}日 ${WEEK[now.getDay()]}`;
      // 农历按天缓存，仅日期变化时重算
      const key = `${y}-${m}-${d}`;
      if (key !== lastLunarKey) {
        lastLunarKey = key;
        lunarEl.textContent = getLunarDateText(now);
      }
    } else {
      dateEl.textContent = "";
      lunarEl.textContent = "";
    }

    // 对齐到下一个整秒（或整分，若无秒显示）再刷新
    const delay = settings.clock.showSeconds
      ? 1000 - now.getMilliseconds()
      : (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    requestAnimationFrame(() => setTimeout(render, delay));
  }

  render();
}
