// 设置：默认值 + 读写（chrome.storage.local）
// 所有偏好集中在此，模块只读取、options 页负责写回。

export const DEFAULTS = {
  searchEngines: [
    { name: "Bing", url: "https://www.bing.com/search?q={q}" },
    { name: "Baidu", url: "https://www.baidu.com/s?wd={q}" },
    { name: "Google", url: "https://www.google.com/search?q={q}" },
  ],
  defaultEngine: 0,
  openInNewTab: false,

  clock: {
    showSeconds: true,
    showDate: true,
  },

  background: {
    type: "online", // online | gradient | custom
    blur: 4, // px
    brightness: 0.82, // 0~1
    vignette: true,
    customImage: null, // dataURL，仅 type=custom 使用
    gradient: ["#1e3c72", "#2a5298"],
    onlineInterval: 30, // 在线图缓存有效分钟数，0 表示每次打开都换
  },

  weather: {
    city: "杭州",
    lat: 30.2741,
    lon: 120.1551,
    useGeolocation: false,
    updateInterval: 30, // 分钟
    showBadge: true, // 左上角徽标右侧显示天气中文（含 MSN 链接）；与农历开关独立
  },

  poetry: {
    enabled: true, // 是否显示诗词
    interval: 30, // 分钟，周期切换一首
  },

  lunar: {
    enabled: true, // 左上角显示农历 + 干支（年/月/日三柱）
  },

  quickLinks: [
    { name: "GitHub", url: "https://github.com/xlgp", icon: "https://github.githubassets.com/favicons/favicon.svg" },
    { name: "知乎", url: "https://zhihu.com", icon: "https://www.zhihu.com/favicon.ico" },
    { name: "Bilibili", url: "https://bilibili.com", icon: "https://www.bilibili.com/favicon.ico" },
    { name: "Gitee", url: "https://gitee.com/xlgp", icon: "https://gitee.com/favicon.ico" },
    { name: "抖音", url: "https://douyin.com", icon: "https://www.douyin.com/favicon.ico" },
    { name: "DeepSeek", url: "https://chat.deepseek.com", icon: "https://deepseek.com/favicon.ico" },
  ],
};

function deepMerge(base, over) {
  if (over === undefined || over === null) return structuredClone(base);
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(over)) {
    if (
      base[k] &&
      typeof base[k] === "object" &&
      !Array.isArray(base[k]) &&
      typeof over[k] === "object"
    ) {
      out[k] = deepMerge(base[k], over[k]);
    } else {
      out[k] = over[k];
    }
  }
  return out;
}

export async function loadSettings() {
  const stored = await chrome.storage.local.get("settings");
  return deepMerge(DEFAULTS, stored.settings);
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}
