// 入口：装配所有模块。加载设置 → 渲染各模块 → 拉天气 → 驱动昼夜与粒子。

import { loadSettings } from "./modules/settings.js";
import { initClock } from "./modules/clock.js";
import { initSearch } from "./modules/search.js";
import { applyBackground, refreshBackground, startBackgroundRotation } from "./modules/background.js";
import { getWeather, codeToInfo, fmtSun } from "./modules/weather.js";
import { applyDayNight, getPhase, WeatherFX } from "./modules/effects.js";
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
let weatherData = null;

function updateDayNight() {
  if (!weatherData || !weatherData.sunrise) {
    applyDayNight("night");
    return;
  }
  const phase = getPhase(
    new Date(),
    fmtSun(weatherData.sunrise),
    fmtSun(weatherData.sunset)
  );
  applyDayNight(phase);
}

function updateEffect() {
  if (!weatherData) return;
  const [, effect] = codeToInfo(weatherData.code);
  fx.start(effect);
}

async function refreshWeather() {
  weatherData = await getWeather(settings);
  updateDayNight();
  updateEffect();
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
