// 入口：装配所有模块。加载设置 → 渲染各模块 → 拉天气 → 驱动昼夜与粒子。

import { loadSettings } from "./modules/settings.js";
import { initClock, renderLunarWeather } from "./modules/clock.js";
import { initSearch } from "./modules/search.js";
import { applyBackground, refreshBackground, startBackgroundRotation } from "./modules/background.js";
import { getWeather, codeToInfo, fmtSun, readWeatherCache } from "./modules/weather.js";
import { applyDayNight, getPhase, WeatherFX, initSky, updateSky, startSkyLoop } from "./modules/effects.js";
import { renderQuickLinks } from "./modules/quicklinks.js";
import { initPoetry } from "./modules/poetry.js";

const settings = await loadSettings();

initClock(settings);
initSearch(settings);
applyBackground(settings);
startBackgroundRotation(settings);
renderQuickLinks(settings);
initPoetry(settings);

const fx = new WeatherFX();
initSky();
// 首屏先用上次缓存的天气（真实日出日落）渲染；无缓存时 weatherData 为 null，
// updateDayNight 才走 6:00/18:00 兜底（仅首次安装会出现，之后刷新不再跳位）
let weatherData = await readWeatherCache();
renderLunarWeather(weatherData); // 首屏即用缓存显示徽标右侧天气（无缓存则隐藏）

// 首屏渲染：weatherData 已尽量用缓存（真实日出日落），无缓存才走 6:00/18:00 兜底；
// 网络天气返回后 refreshWeather 会再校正（日出日落日间变化极小，不会再跳位）
updateDayNight();
startSkyLoop(); // rAF 实时驱动日月位置（每帧平滑，不靠长过渡补间）

// 昼夜/天空驱动：天气数据缺失时按 6:00/18:00 兜底，日月照常运转
function updateDayNight() {
  const now = new Date();
  let sr, ss;
  if (weatherData && weatherData.sunrise) {
    sr = fmtSun(weatherData.sunrise, now);
    ss = fmtSun(weatherData.sunset, now);
  } else {
    sr = new Date(now);
    sr.setHours(6, 0, 0, 0);
    ss = new Date(now);
    ss.setHours(18, 0, 0, 0);
  }
  applyDayNight(getPhase(now, sr, ss)); // 面板等粗粒度联动
  const effect = weatherData ? codeToInfo(weatherData.code)[1] : "clear";
  updateSky(now, sr, ss, effect); // 日月位置 + 连续天色 + 星点
}

function updateEffect() {
  if (!weatherData) return;
  const [, effect] = codeToInfo(weatherData.code);
  fx.start(effect);
}

let weatherRefreshing = false;
async function refreshWeather() {
  if (weatherRefreshing) return; // 防重入：避免定时/可见性恢复/初始并发多次请求
  weatherRefreshing = true;
  try {
    weatherData = await getWeather(settings);
    updateDayNight();
    updateEffect();
    renderLunarWeather(weatherData); // 刷新徽标右侧天气中文与 MSN 链接
  } finally {
    weatherRefreshing = false;
  }
}

document.getElementById("settings-btn")?.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// 手动换背景：按 B（输入框聚焦时不触发，避免与搜索输入冲突）
let bgFetching = false;
document.addEventListener("keydown", async (ev) => {
  const ae = document.activeElement;
  const typing =
    ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable);
  if (typing) return;
  if (ev.key === "b" || ev.key === "B") {
    ev.preventDefault();
    if (settings.background.type !== "online" || bgFetching) return;
    bgFetching = true;
    showBgToast(true, "正在更换背景…");
    const ok = await refreshBackground(settings);
    showBgToast(false, ok ? "已换背景" : "换图失败，请重试");
    bgFetching = false;
  }
});

// 换图提示（左下角）：working=true 显示转圈+文字并常驻，直到换图结束；
// working=false 显示结果文字，约 1.5s 后淡出。成功/失败均会显示。
let bgToastTimer = null;
function showBgToast(working, text) {
  const t = document.getElementById("bg-toast");
  if (!t) return;
  clearTimeout(bgToastTimer);
  t.innerHTML = "";
  if (working) {
    const spin = document.createElement("span");
    spin.className = "spin";
    t.appendChild(spin);
  }
  const span = document.createElement("span");
  span.textContent = text;
  t.appendChild(span);
  t.classList.add("show");
  if (!working) {
    bgToastTimer = setTimeout(() => t.classList.remove("show"), 1500);
  }
}

refreshWeather();
const intervalMs = Math.max(5, settings.weather.updateInterval) * 60 * 1000;
setInterval(refreshWeather, intervalMs);
setInterval(updateDayNight, 60 * 1000);

// 窗口尺寸变化后重算椭圆轨道与日月位置（星点由 initSky 内部重建）
let skyResizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(skyResizeTimer);
  skyResizeTimer = setTimeout(updateDayNight, 200);
});

// 页面从隐藏恢复（切走标签页 / 息屏）：补请求一次天气，刷新温度与天气效果；
// 日出日落已与日期解耦（仅存时分），恢复时 sr/ss 绑定当天，日月不会因此跳位。
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshWeather();
});
