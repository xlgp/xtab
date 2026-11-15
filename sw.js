// Service Worker：仅处理搜索建议的跨域代理。
// 背景取图在扩展页内直接 fetch（host_permissions 已豁免 CORS），不经过 SW。

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
