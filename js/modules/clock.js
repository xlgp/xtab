// 时钟：秒级刷新，用 rAF 对齐到整秒边界，避免 setInterval 累积漂移。
// 休眠唤醒后 rAF 自动校正，不丢秒。

import { getLunarBadgeText } from "./lunar.js";
import { codeToInfo } from "./weather.js";

const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const MSN_WEATHER_URL = "https://www.msn.cn/zh-cn/weather";

// initClock 的 settings 与最近一次天气数据，供模块级 renderLunarWeather 使用
let lunarSettings = null;
let lastWeather = null;

export function initClock(settings) {
  const timeEl = document.getElementById("clock-time");
  const dateEl = document.getElementById("clock-date");
  const lunarTextEl = document.getElementById("lunar-text");
  const lunarWeatherEl = document.getElementById("lunar-weather");
  let lastLunarKey = "";
  lunarSettings = settings;

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
    } else {
      dateEl.textContent = "";
    }

    // 左上角农历 + 干支徽标：按天缓存，仅日期变化时重算
    // 注意 badge 容器内还有天气链接，故只更新 #lunar-text，不能整体覆写容器
    if (settings.lunar?.enabled) {
      const key = `${y}-${m}-${d}`;
      if (key !== lastLunarKey) {
        lastLunarKey = key;
        lunarTextEl.textContent = getLunarBadgeText(now);
      }
    } else if (lunarTextEl.textContent) {
      lunarTextEl.textContent = "";
    }

    // 天气显隐由独立的 weather.showBadge 开关控制（与农历开关解耦），
    // 内容由 renderLunarWeather 维护，此处保证关闭开关即刻隐藏
    if (lunarWeatherEl) {
      const wantShow = settings.weather?.showBadge !== false && !!lastWeather;
      if (lunarWeatherEl.hidden === wantShow) lunarWeatherEl.hidden = !wantShow;
    }

    // 对齐到下一个整秒（或整分，若无秒显示）再刷新
    const delay = settings.clock.showSeconds
      ? 1000 - now.getMilliseconds()
      : (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    requestAnimationFrame(() => setTimeout(render, delay));
  }

  render();
}

// 在农历徽标右侧显示天气中文（含温度）并链接到 MSN 天气。
// 由 main.js 在首屏（读缓存）与每次天气刷新后调用。
// 显隐由 weather.showBadge 独立控制，与农历开关（lunar.enabled）互不影响。
export function renderLunarWeather(data) {
  lastWeather = data && data.code !== undefined ? data : null;
  const el = document.getElementById("lunar-weather");
  if (!el) return;
  if (lunarSettings?.weather?.showBadge === false || !lastWeather) {
    el.hidden = true;
    return;
  }
  const [text] = codeToInfo(lastWeather.code);
  const label = `${text} ${lastWeather.temp}°`;
  el.textContent = label;
  el.href = MSN_WEATHER_URL;
  el.title = `${label} · 查看 MSN 天气`;
  el.hidden = false;
}
