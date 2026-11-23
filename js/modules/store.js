// 统一 KV 存储：window.localStorage，扩展页与普通网页两端同源共享。
// 业务模块只认这一层接口，不直接碰底层存储（Web Storage / 扩展存储 API）。
// 写入失败（配额、隐私模式、禁用存储）时降级为内存，仅本次会话有效。

const PREFIX = "xtab.";
const mem = new Map(); // 本次会话的内存镜像，同时作为不可写时的兜底

export async function get(key, fallback = null) {
  // 同页优先读内存：写入降级后 localStorage 里可能仍是旧值，以内存为准。
  // 注意：不做跨标签页实时同步（原本就靠刷新新标签页生效）。
  if (mem.has(key)) return mem.get(key);
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn("[xtab] 读取存储失败，回退默认值：", err);
    return fallback;
  }
}

export async function set(key, value) {
  mem.set(key, value);
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (err) {
    console.warn("[xtab] 存储不可写，降级为本次会话有效：", err);
  }
}
