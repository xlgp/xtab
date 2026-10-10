// 快捷链接：渲染网格，图标优先使用设置里的 icon，失败则回退站点 favicon / Google favicon。

function safeDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function setIcon(icon, url, domain) {
  const candidates = [];
  if (url) candidates.push(url);
  if (domain) candidates.push(`https://${domain}/favicon.ico`);
  if (domain) candidates.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=64`);

  function tryNext() {
    if (!candidates.length) return;
    const src = candidates.shift();
    const img = new Image();
    img.onload = () => {
      icon.style.backgroundImage = `url("${img.src}")`;
    };
    img.onerror = tryNext;
    img.src = src;
  }
  tryNext();
}

export function renderQuickLinks(settings) {
  const wrap = document.getElementById("quicklinks");
  wrap.innerHTML = "";
  for (const link of settings.quickLinks) {
    const a = document.createElement("a");
    a.className = "ql-item";
    a.href = link.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.title = link.name;

    const icon = document.createElement("div");
    icon.className = "ql-icon";
    const domain = safeDomain(link.url);
    setIcon(icon, link.icon, domain);

    const name = document.createElement("div");
    name.className = "ql-name";
    name.textContent = link.name;

    a.append(icon, name);
    wrap.append(a);
  }
}
