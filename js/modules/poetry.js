// 诗词：今日诗词接口（v1.jinrishici.com，免 Key、CORS 友好、长期免费）。
// 首屏先展示缓存（chrome.storage.local）避免白等，再后台校验刷新；
// 按 settings.poetry.interval 周期拉取并淡入替换，失败则保留当前/缓存内容。

const POETRY_API = "https://v1.jinrishici.com/all.json";
const CACHE_KEY = "poetryCache";

// 内置兜底诗句：接口未就绪 / 关闭时展示，避免空白。
// 归属本模块而非 settings——它是静态内容，不是用户配置项。
const FALLBACK_POEM = {
  content: "羡宇宙之无穷，渺沧海之一粟",
  origin: "赤壁赋",
  author: "苏轼",
};

export async function initPoetry(settings) {
  const cfg = settings.poetry || {};
  const el = document.getElementById("poetry");
  const contentEl = document.getElementById("poetry-content");
  const originEl = document.getElementById("poetry-origin");
  if (!el || !contentEl || !originEl) return;

  let current = null; // 当前展示的诗词，用于失败时回退判断

  // 先落兜底诗句：保证首屏与「关闭」状态都有内容，不空白。
  render(FALLBACK_POEM, false);

  if (cfg.enabled === false) return; // 关闭：保留兜底，不接网络、不轮播

  function render(poem, animate = true) {
    if (!poem || !poem.content) return;
    current = poem;
    const apply = () => {
      contentEl.textContent = poem.content;
      originEl.textContent = `${poem.origin || ""}${poem.author ? " · " + poem.author : ""}`;
    };
    if (!animate) {
      apply();
      return;
    }
    // 淡出 → 换字 → 淡入
    el.classList.add("poetry-fade");
    setTimeout(() => {
      apply();
      el.classList.remove("poetry-fade");
    }, 600);
  }

  async function fetchPoem() {
    try {
      const r = await fetch(POETRY_API, { cache: "no-store" });
      if (!r.ok) throw new Error("poetry http " + r.status);
      const j = await r.json();
      if (!j || !j.content) throw new Error("poetry empty");
      const poem = {
        content: j.content,
        origin: j.origin || "",
        author: j.author || "",
        ts: Date.now(),
      };
      await chrome.storage.local.set({ [CACHE_KEY]: poem });
      render(poem, true);
    } catch {
      // 拉取失败：当前已有内容则不动；否则回退到缓存，再不行保留默认文案
      if (!current) {
        const cached = await chrome.storage.local.get(CACHE_KEY);
        if (cached[CACHE_KEY]) render(cached[CACHE_KEY], false);
      }
    }
  }

  const intervalMin = Math.max(1, Number(cfg.interval) || 30);

  // 首屏：缓存即刻展示，过期/缺失再后台拉取
  const cached = await chrome.storage.local.get(CACHE_KEY);
  const c = cached[CACHE_KEY];
  if (c && c.content) {
    render(c, false);
    const stale = Date.now() - (c.ts || 0) > intervalMin * 60 * 1000;
    if (stale) fetchPoem();
  } else {
    fetchPoem();
  }

  // 周期切换
  setInterval(fetchPoem, intervalMin * 60 * 1000);
}
