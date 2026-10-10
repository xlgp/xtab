// 设置页：编辑所有偏好，保存到 chrome.storage.local。
// 城市改变时自动 geocode 更新经纬度；搜索引擎/链接支持增删。

import { loadSettings, saveSettings } from "./js/modules/settings.js";

const $ = (id) => document.getElementById(id);

function el(tag, props = {}, children = []) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const c of children) e.append(c);
  return e;
}

let engines = [];
let links = [];
let settings = null;

async function init() {
  settings = await loadSettings();
  engines = settings.searchEngines.map((e) => ({ ...e }));
  links = settings.quickLinks.map((l) => ({ ...l }));

  buildSearch();
  buildClock();
  buildBackground();
  buildWeather();
  buildLinks();
  $("save").onclick = save;
}

function buildSearch() {
  const list = $("engine-list");
  list.innerHTML = "";
  engines.forEach((e, i) => {
    const name = el("input", { value: e.name, className: "inp", style: "width:120px" });
    const url = el("input", { value: e.url, className: "inp wide" });
    const del = el("button", { textContent: "删", className: "btn-sm" });
    del.onclick = () => {
      engines.splice(i, 1);
      buildSearch();
    };
    name.oninput = () => (e.name = name.value);
    url.oninput = () => (e.url = url.value);
    list.append(el("div", { className: "row" }, [name, url, del]));
  });
  rebuildDefaultSelect();

  $("open-newtab").checked = settings.openInNewTab;
  $("add-engine").onclick = () => {
    engines.push({ name: "新引擎", url: "https://example.com/search?q={q}" });
    buildSearch();
  };
}

function rebuildDefaultSelect() {
  const sel = $("default-engine");
  const cur = sel.value;
  sel.innerHTML = "";
  engines.forEach((e, i) => {
    const o = el("option", { value: i, textContent: e.name });
    sel.append(o);
  });
  if (cur !== "" && +cur < engines.length) sel.value = cur;
  else sel.value = Math.min(settings.defaultEngine, engines.length - 1) || 0;
}

function buildClock() {
  $("clk-sec").checked = settings.clock.showSeconds;
  $("clk-date").checked = settings.clock.showDate;
}

function buildBackground() {
  const b = settings.background;
  $("bg-type").value = b.type;
  $("bg-interval").value = b.onlineInterval;
  $("bg-blur").value = b.blur;
  $("bg-bright").value = b.brightness;
  $("bg-vig").checked = b.vignette;
  $("bg-grad0").value = b.gradient[0];
  $("bg-grad1").value = b.gradient[1];
  $("bg-blur-v").textContent = b.blur + "px";
  $("bg-bright-v").textContent = b.brightness;
  $("bg-blur").oninput = (e) => ($("bg-blur-v").textContent = e.target.value + "px");
  $("bg-bright").oninput = (e) => ($("bg-bright-v").textContent = e.target.value);
}

function buildWeather() {
  const w = settings.weather;
  $("w-city").value = w.city;
  $("w-int").value = w.updateInterval;
  $("w-geo").checked = w.useGeolocation;
}

function buildLinks() {
  const list = $("link-list");
  list.innerHTML = "";
  links.forEach((l, i) => {
    const name = el("input", { value: l.name, className: "inp", style: "width:140px" });
    const url = el("input", { value: l.url, className: "inp wide" });
    const del = el("button", { textContent: "删", className: "btn-sm" });
    del.onclick = () => {
      links.splice(i, 1);
      buildLinks();
    };
    name.oninput = () => (l.name = name.value);
    url.oninput = () => (l.url = url.value);
    list.append(el("div", { className: "row" }, [name, url, del]));
  });
  $("add-link").onclick = () => {
    links.push({ name: "新链接", url: "https://example.com" });
    buildLinks();
  };
}

async function geocode(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    city
  )}&count=1&language=zh&format=json`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    if (j.results && j.results[0]) {
      return { lat: j.results[0].latitude, lon: j.results[0].longitude };
    }
  } catch {
    /* 忽略，保留原坐标 */
  }
  return null;
}

async function save() {
  settings.searchEngines = engines;
  settings.openInNewTab = $("open-newtab").checked;
  settings.defaultEngine = +$("default-engine").value || 0;
  settings.clock.showSeconds = $("clk-sec").checked;
  settings.clock.showDate = $("clk-date").checked;
  settings.background.type = $("bg-type").value;
  settings.background.onlineInterval = +$("bg-interval").value || 0;
  settings.background.blur = +$("bg-blur").value;
  settings.background.brightness = +$("bg-bright").value;
  settings.background.vignette = $("bg-vig").checked;
  settings.background.gradient = [$("bg-grad0").value, $("bg-grad1").value];

  const city = $("w-city").value.trim();
  if (city && city !== settings.weather.city) {
    const g = await geocode(city);
    if (g) {
      settings.weather.lat = g.lat;
      settings.weather.lon = g.lon;
    }
  }
  settings.weather.city = city || settings.weather.city;
  settings.weather.updateInterval = +$("w-int").value || 30;
  settings.weather.useGeolocation = $("w-geo").checked;
  settings.quickLinks = links;

  await saveSettings(settings);
  $("saved").textContent = "已保存 ✓";
  setTimeout(() => ($("saved").textContent = ""), 2000);
}

init();
