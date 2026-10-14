// 天气：Open-Meteo（免 Key、CORS 友好）。
// 当前天气 + 日出日落；城市名经其 geocoding 接口转经纬度。结果缓存，离线可用上次数据。

const FORECAST_API = "https://api.open-meteo.com/v1/forecast";
const GEO_API = "https://geocoding-api.open-meteo.com/v1/search";

// WMO 天气代码 → 中文文案 + 效果类别
export function codeToInfo(code) {
  const map = {
    0: ["晴", "clear"],
    1: ["大致晴朗", "clear"],
    2: ["局部多云", "clouds"],
    3: ["阴", "clouds"],
    45: ["雾", "fog"],
    48: ["雾凇", "fog"],
    51: ["毛毛雨", "rain"],
    53: ["毛毛雨", "rain"],
    55: ["毛毛雨", "rain"],
    56: ["冻毛毛雨", "rain"],
    57: ["冻毛毛雨", "rain"],
    61: ["小雨", "rain"],
    63: ["中雨", "rain"],
    65: ["大雨", "rain"],
    66: ["冻雨", "rain"],
    67: ["冻雨", "rain"],
    71: ["小雪", "snow"],
    73: ["中雪", "snow"],
    75: ["大雪", "snow"],
    77: ["雪粒", "snow"],
    80: ["阵雨", "rain"],
    81: ["阵雨", "rain"],
    82: ["强阵雨", "rain"],
    85: ["阵雪", "snow"],
    86: ["阵雪", "snow"],
    95: ["雷阵雨", "thunder"],
    96: ["雷阵雨伴冰雹", "thunder"],
    99: ["雷阵雨伴冰雹", "thunder"],
  };
  return map[code] || ["未知", "clear"];
}

async function geocodeCity(city) {
  const url = `${GEO_API}?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("geocode failed");
  const j = await r.json();
  if (!j.results || !j.results.length) throw new Error("city not found");
  const c = j.results[0];
  return { lat: c.latitude, lon: c.longitude, name: c.name };
}

async function fetchWeather(lat, lon) {
  const url =
    `${FORECAST_API}?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code,is_day,wind_speed_10m` +
    `&daily=sunrise,sunset&timezone=auto&forecast_days=1`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("weather failed");
  const j = await r.json();
  return {
    temp: Math.round(j.current.temperature_2m),
    humidity: j.current.relative_humidity_2m,
    wind: j.current.wind_speed_10m,
    code: j.current.weather_code,
    isDay: j.current.is_day === 1,
    sunrise: j.daily.sunrise[0],
    sunset: j.daily.sunset[0],
  };
}

// 读取上次成功缓存的天气（含日出日落）。供首屏立即渲染，
// 避免网络返回前用 6:00/18:00 兜底时刻导致刷新页面时太阳跳位。
export async function readWeatherCache() {
  const c = await chrome.storage.local.get("weatherCache");
  return c.weatherCache || null;
}

export async function getWeather(settings) {
  const w = settings.weather;

  async function resolveCoord() {
    if (w.useGeolocation && navigator.geolocation) {
      // 注意：geolocation 需用户授权，且在新标签页上下文可能受限，失败则回退城市
      try {
        const pos = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        );
        return { lat: pos.coords.latitude, lon: pos.coords.longitude, name: w.city };
      } catch {
        /* 回退下方城市坐标 */
      }
    }
    if (w.lat && w.lon) return { lat: w.lat, lon: w.lon, name: w.city };
    const g = await geocodeCity(w.city);
    return { ...g };
  }

  try {
    const { lat, lon, name } = await resolveCoord();
    const data = await fetchWeather(lat, lon);
    const payload = { ...data, city: name, ts: Date.now() };
    await chrome.storage.local.set({ weatherCache: payload });
    return payload;
  } catch (e) {
    // 离线 / 失败 → 用缓存
    return readWeatherCache();
  }
}

export function fmtSun(iso) {
  // "2026-10-10T06:12" → Date
  return new Date(iso);
}
