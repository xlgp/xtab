// 背景：根据设置应用 图片/渐变、模糊、亮度、暗角。
// 在线图先读 IndexedDB 缓存立刻展示，过期后再后台拉新图替换；拉取失败仍保留原图/渐变。
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

async function fetchNewImage(b) {
  const src = `https://picsum.photos/1920/1080?${Date.now()}`;
  try {
    const r = await fetch(src);
    if (!r.ok) throw new Error("bg fetch failed");
    const blob = await r.blob();
    await saveCachedImage(blob);
    return crossfadeTo(URL.createObjectURL(blob), b);
  } catch {
    // 失败时保持当前显示（缓存图或渐变），不降级成错误图
    return false;
  }
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
// 渐变 / 自定义图无网络图可换，直接忽略。返回是否成功换图。
export async function refreshBackground(settings) {
  const b = settings?.background;
  if (!b || b.type !== "online") return false;
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
