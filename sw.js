// Service Worker：处理需要跨域且读响应体的请求（搜索建议）。
// 扩展页内部直接 fetch 会被 CORS 拦截，但 SW 在 host_permissions 内可任意读取。

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_SUGGESTIONS") {
    fetchBaiduSuggestions(msg.q)
      .then((list) => sendResponse({ ok: true, list }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // 保持通道异步
  }
});

async function fetchBaiduSuggestions(q) {
  const url = `https://www.baidu.com/sugrec?prod=pc&wd=${encodeURIComponent(q)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("suggest fetch failed");
  const text = await r.text();
  const data = JSON.parse(text);
  return (data.g || []).map((item) => item.q);
}
