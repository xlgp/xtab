// 背景：根据设置应用 图片/渐变、模糊、亮度、暗角。
// 在线图先读 IndexedDB 缓存立刻展示，过期后再后台拉新图替换；拉取失败仍保留原图/渐变。
// 图源在扩展页直接取（Picsum → Bing 每日壁纸 → Unsplash），失败自动降级；
// 扩展页与 SW 同属 chrome-extension:// 源，host_permissions 内同样豁免 CORS，无需消息代理。
// 昼夜色调由 effects.js 的 overlay 叠加，这里只管底图本身。
// 换图采用双图层交叉淡入（#bg-layer / #bg-layer-2 乒乓），避免瞬间闪换。

import { loadCachedImage, saveCachedImage } from "./bgCache.js";

let activeLayer = null; // 当前显示的图层
let inactiveLayer = null; // 待淡入 / 淡出的另一图层

function ensureLayers() {
  if (activeLayer && inactiveLayer) return;
  activeLayer = document.getElementById("bg-layer");
  inactiveLayer = document.getElementById("bg-layer-2");
}

function gradientCss(g) {
  const [a, c] = g;
  return `linear-gradient(135deg, ${a}, ${c})`;
}

function applyFilters(el, b) {
  const blur = Math.max(0, Number(b.blur) || 0);
  const bright = Math.min(1, Math.max(0, Number(b.brightness) ?? 0.82));
  el.style.filter = `blur(${blur}px) brightness(${bright})`;
  el.style.boxShadow = b.vignette
    ? "inset 0 0 220px 40px rgba(0,0,0,0.55)"
    : "none";
}

// 新图交叉淡入：把图放进当前不活动图层并淡入，原图层淡出。返回是否成功触发过渡。
function crossfadeTo(url, b) {
  ensureLayers();
  if (!activeLayer || !inactiveLayer) return false;
  const outgoing = activeLayer; // 捕获当前显示层（淡出）
  const incoming = inactiveLayer; // 捕获目标层（淡入）
  incoming.style.backgroundImage = `url("${url}")`;
  applyFilters(incoming, b);
  // 下一帧再改 opacity，确保浏览器以「起始 opacity」为基准触发过渡
  requestAnimationFrame(() => {
    incoming.style.opacity = "1";
    outgoing.style.opacity = "0";
  });
  // 交换角色：incoming 成为新的活动层
  activeLayer = incoming;
  inactiveLayer = outgoing;
  return true;
}

// ---------- 在线图源：多源自动降级 ----------
// Picsum 在国内常超时；Bing 每日壁纸（cn.bing.com）与 Unsplash 精选图集作备用。
// 状态直放同源 Web Storage（同步读写，两端通用），失败源 1h 内降权。

const SOURCES = [
  { id: "picsum", label: "Picsum", timeout: 6000 },
  { id: "bing", label: "Bing 每日壁纸", timeout: 6000 },
  { id: "unsplash", label: "Unsplash", timeout: 12000 },
];

// Unsplash 官方图床按 photo ID 直取，无需 API key；以下 ID 均为实测可访问且带 ACAO:* 的风景图。
const UNSPLASH_IDS = [
  "1500534623283-312aade485b7",
  "1470071459604-3b5ec3a7fe05",
  "1441974231531-c6227db76b6e",
  "1501785888041-af3ef285b470",
  "1469474968028-56623f02e42e",
  "1447752875215-b2761acb3c5d",
  "1519681393784-d120267933ba",
  "1470252649378-9c29740c9fa8",
  "1507525428034-b723cf961d3e",
  "1426604966848-d7adac402bff",
  "1433086966358-54859d0ed716",
  "1448375240586-882707db888b",
  "1465146344425-f00d5f5c8f07",
  "1490750967868-88aa4486c946",
  "1501854140801-50d01698950b",
  "1472214103451-9374bd1c798e",
];

const COOLDOWN_MS = 60 * 60 * 1000;
const STATE_KEY = "xtab.bgSourceState";

function readState() {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY) || "{}");
    return { lastGood: s.lastGood || "", failedAt: s.failedAt || {} };
  } catch {
    return { lastGood: "", failedAt: {} };
  }
}

function writeState(state) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* 隐私模式等场景下 localStorage 不可写，降级为仅本次会话有效 */
  }
}

// 上次成功的源优先；失败且未过冷却期的源排最后（仍会尝试，保证源恢复后能用回来）。
function sourceOrder(state) {
  const now = Date.now();
  const cooling = (id) => now - (state.failedAt[id] || 0) < COOLDOWN_MS;
  const fresh = SOURCES.filter((s) => !cooling(s.id)).map((s) => s.id);
  const stale = SOURCES.filter((s) => cooling(s.id)).map((s) => s.id);
  const base = [...fresh, ...stale];
  if (state.lastGood && base.includes(state.lastGood) && !cooling(state.lastGood)) {
    return [state.lastGood, ...base.filter((id) => id !== state.lastGood)];
  }
  return base;
}

function briefError(err) {
  const m = err?.message || String(err);
  if (/abort|timed? ?out|超时/i.test(m)) return "超时";
  if (/failed to fetch|networkerror|load failed/i.test(m)) return "网络/CORS 不可达";
  return m.length > 36 ? m.slice(0, 36) : m;
}

function noteFailure(state, id, label, err, errors) {
  const msg = `${label}: ${briefError(err)}`;
  errors.push(msg);
  console.warn("[xtab] 图源失败：", msg); // 逐源原因，便于按 B 后在控制台定位
  state.failedAt[id] = Date.now();
  writeState(state);
}

async function fetchWithTimeout(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r;
  } finally {
    clearTimeout(timer);
  }
}

// 解析出图片 URL。Bing 需要先读每日壁纸接口（该接口无 ACAO，靠扩展页 host_permissions 豁免 CORS）。
async function resolveUrl(id, timeoutMs) {
  if (id === "picsum") return `https://picsum.photos/1920/1080?r=${Date.now()}`;
  if (id === "unsplash") {
    const pid = UNSPLASH_IDS[Math.floor(Math.random() * UNSPLASH_IDS.length)];
    return `https://images.unsplash.com/photo-${pid}?w=1920&q=75&fm=jpg`;
  }
  const idx = Math.floor(Math.random() * 8); // 近 8 日壁纸随机取一张
  const api = `https://cn.bing.com/HPImageArchive.aspx?format=js&idx=${idx}&n=1&mkt=zh-CN`;
  const meta = await (await fetchWithTimeout(api, timeoutMs)).json();
  const path = meta?.images?.[0]?.url;
  if (!path) throw new Error("Bing 未返回壁纸地址");
  return new URL(path, "https://cn.bing.com").href;
}

async function fetchImage(url, timeoutMs) {
  const r = await fetchWithTimeout(url, timeoutMs);
  const type = (r.headers.get("content-type") || "").split(";")[0];
  if (!type.startsWith("image/")) throw new Error(`非图片响应 ${type || "unknown"}`);
  const blob = await r.blob();
  if (blob.size < 1024) throw new Error("图片内容异常");
  return blob;
}

// 零权限兜底：<img> 加载跨域图片不需要 CORS / host_permissions，只确认能否显示。
// 用于 fetch 全挂（例如扩展未重新加载导致新权限没生效）时，仍能把背景换掉。
function probeImage(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => done(false), timeoutMs);
    function done(ok) {
      clearTimeout(timer);
      img.onload = img.onerror = null;
      resolve(ok);
    }
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = url;
  });
}

// 返回 { ok, source, error }：成功带图源名，失败带可读原因并打印每个源的详细错误。
async function fetchNewImage(b) {
  const state = readState();
  const errors = [];
  const directCandidates = []; // 已解析出 URL、但 fetch 失败的候选，留给 CSS 直连兜底

  for (const id of sourceOrder(state)) {
    const src = SOURCES.find((s) => s.id === id);
    let url;
    try {
      url = await resolveUrl(id, src.timeout);
    } catch (err) {
      noteFailure(state, id, src.label, err, errors);
      continue;
    }
    directCandidates.push({ id, label: src.label, url });
    try {
      const blob = await fetchImage(url, src.timeout);
      // 缓存写入失败不该阻断换图，仅记日志
      try {
        await saveCachedImage(blob);
      } catch (err) {
        console.warn("[xtab] 背景缓存写入失败：", err);
      }
      if (!crossfadeTo(URL.createObjectURL(blob), b)) throw new Error("背景图层缺失");
      state.lastGood = id;
      delete state.failedAt[id];
      writeState(state);
      return { ok: true, source: src.label, error: "" };
    } catch (err) {
      noteFailure(state, id, src.label, err, errors);
    }
  }

  // fetch 全线失败时改走 CSS 直连：Unsplash 优先（带 ACAO:*，最可能加载成功）
  const direct = [...directCandidates].sort(
    (a, c) => Number(c.id === "unsplash") - Number(a.id === "unsplash")
  );
  for (const c of direct) {
    if (await probeImage(c.url)) {
      if (crossfadeTo(c.url, b)) {
        console.warn("[xtab] 已用 CSS 直连兜底显示背景（未写入缓存）：", c.url);
        return { ok: true, source: `${c.label}（直连）`, error: "" };
      }
    }
  }

  if (errors.length) console.warn("[xtab] 背景图源全部失败：", errors.join(" | "));
  return { ok: false, source: "", error: errors.at(-1) || "所有图源均不可用" };
}

export async function applyBackground(settings) {
  const bg = document.getElementById("bg-layer");
  const b = settings.background;
  bg.style.backgroundSize = "cover";
  bg.style.backgroundPosition = "center";

  ensureLayers();

  // 渐变 / 自定义
  if (b.type === "gradient") {
    bg.style.backgroundImage = gradientCss(b.gradient);
    applyFilters(bg, b);
    return;
  }
  if (b.type === "custom" && b.customImage) {
    bg.style.backgroundImage = `url("${b.customImage}")`;
    applyFilters(bg, b);
    return;
  }
  if (b.type === "custom") {
    bg.style.backgroundImage = gradientCss(b.gradient);
    applyFilters(bg, b);
    return;
  }

  // 在线图：先展示缓存或渐变，保证首屏不白等
  const cached = await loadCachedImage();
  if (cached && cached.blob) {
    bg.style.backgroundImage = `url("${URL.createObjectURL(cached.blob)}")`;
    applyFilters(bg, b);
  } else {
    bg.style.backgroundImage = gradientCss(b.gradient);
    applyFilters(bg, b);
  }
  bg.style.opacity = "1"; // 首屏底色即活动层

  // 缓存过期（或不存在、或设了 0）则后台拉新图
  const intervalMin = Number(b.onlineInterval) ?? 30;
  const stale =
    !cached ||
    !cached.blob ||
    intervalMin === 0 ||
    Date.now() - cached.ts > intervalMin * 60 * 1000;
  if (stale) {
    fetchNewImage(b);
  }
}

// 手动换图：仅「在线图」模式生效，立即拉取新图并刷新缓存（绕过 staleness 判断）。
// 渐变 / 自定义图无网络图可换，直接忽略。返回 { ok, source, error }。
export async function refreshBackground(settings) {
  const b = settings?.background;
  if (!b || b.type !== "online") return { ok: false, source: "", error: "非在线图模式" };
  return fetchNewImage(b);
}

// 周期性换图：在线图模式下，按 onlineInterval 分钟静默拉取新图（不弹提示）。
// onlineInterval<=0 表示「每次打开都换」，不启定时器；非 online 类型也不启。
export function startBackgroundRotation(settings) {
  const b = settings?.background;
  if (!b || b.type !== "online") return;
  const intervalMin = Number(b.onlineInterval) || 0;
  if (intervalMin <= 0) return;
  setInterval(async () => {
    await fetchNewImage(b);
  }, intervalMin * 60 * 1000);
}
