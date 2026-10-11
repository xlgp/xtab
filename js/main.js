// 入口：装配所有模块。加载设置 → 渲染各模块 → 拉天气 → 驱动昼夜与粒子。

import { loadSettings } from "./modules/settings.js";
import { initClock } from "./modules/clock.js";
import { initSearch } from "./modules/search.js";
import { applyBackground } from "./modules/background.js";
import { getWeather, codeToInfo, fmtSun } from "./modules/weather.js";
import { applyDayNight, getPhase, WeatherFX } from "./modules/effects.js";
import { renderQuickLinks } from "./modules/quicklinks.js";
import { initPoetry } from "./modules/poetry.js";

const settings = await loadSettings();

initClock(settings);
initSearch(settings);
applyBackground(settings);
renderQuickLinks(settings);
initPoetry(settings);

const fx = new WeatherFX();
let weatherData = null;

function paintWeather(w) {
  const tempEl = document.getElementById("weather-temp");
  const descEl = document.getElementById("weather-desc");
  const cityEl = document.getElementById("weather-city");
  if (!w) {
    tempEl.textContent = "--°";
    descEl.textContent = "天气获取失败";
    cityEl.textContent = settings.weather.city;
    return;
  }
  const [text] = codeToInfo(w.code);
  tempEl.textContent = `${w.temp}°`;
  descEl.textContent = text;
  cityEl.textContent = w.city;
}

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
  paintWeather(weatherData);
  updateDayNight();
  updateEffect();
}

document.getElementById("settings-btn")?.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

refreshWeather();
const intervalMs = Math.max(5, settings.weather.updateInterval) * 60 * 1000;
setInterval(refreshWeather, intervalMs);
setInterval(updateDayNight, 60 * 1000);
