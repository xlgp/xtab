// 搜索：渲染引擎切换器，提交时按当前引擎模板拼 URL 跳转。
// 模板用 {q} 占位；支持回车搜索、在新标签打开、键盘上下选择建议。

export function initSearch(settings) {
  const form = document.getElementById("search-form");
  const input = document.getElementById("search-input");
  const engineEl = document.getElementById("search-engine");
  const suggestionsEl = document.getElementById("search-suggestions");

  let idx = settings.defaultEngine ?? 0;
  let suggestions = [];
  let selected = -1;
  let debounceTimer;

  function paintEngine() {
    const e = settings.searchEngines[idx];
    engineEl.textContent = e.name;
    input.placeholder = `使用 ${e.name} 搜索…`;
  }

  function cycleEngine() {
    idx = (idx + 1) % settings.searchEngines.length;
    paintEngine();
    input.focus();
  }

  function doSearch(q) {
    q = (q || input.value).trim();
    if (!q) return;
    hideSuggestions();
    const tpl = settings.searchEngines[idx].url;
    const url = tpl.replace("{q}", encodeURIComponent(q));
    if (settings.openInNewTab) {
      window.open(url, "_blank", "noopener");
    } else {
      window.location.href = url;
    }
  }

  function hideSuggestions() {
    suggestionsEl.innerHTML = "";
    suggestionsEl.hidden = true;
    suggestions = [];
    selected = -1;
  }

  function renderSuggestions() {
    suggestionsEl.innerHTML = "";
    if (!suggestions.length) {
      suggestionsEl.hidden = true;
      return;
    }
    suggestions.forEach((s, i) => {
      const li = document.createElement("li");
      li.textContent = s;
      li.dataset.q = s;
      if (i === selected) li.classList.add("active");
      suggestionsEl.append(li);
    });
    suggestionsEl.hidden = false;
  }

  function fetchSuggestions(q) {
    chrome.runtime.sendMessage({ type: "GET_SUGGESTIONS", q }, (resp) => {
      if (chrome.runtime.lastError || !resp || !resp.ok || !resp.list.length) {
        hideSuggestions();
        return;
      }
      suggestions = resp.list.slice(0, 8);
      selected = -1;
      renderSuggestions();
    });
  }

  engineEl.addEventListener("click", cycleEngine);
  engineEl.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      cycleEngine();
    }
  });

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    doSearch(input.value);
  });

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (!q) {
      hideSuggestions();
      return;
    }
    debounceTimer = setTimeout(() => fetchSuggestions(q), 150);
  });

  input.addEventListener("keydown", (ev) => {
    if (!suggestions.length) return;
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      selected = (selected + 1) % suggestions.length;
      renderSuggestions();
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      selected = (selected - 1 + suggestions.length) % suggestions.length;
      renderSuggestions();
    } else if (ev.key === "Enter" && selected >= 0) {
      ev.preventDefault();
      doSearch(suggestions[selected]);
    } else if (ev.key === "Escape") {
      hideSuggestions();
    }
  });

  suggestionsEl.addEventListener("mousedown", (ev) => {
    const li = ev.target.closest("li");
    if (li) doSearch(li.dataset.q);
  });

  input.addEventListener("blur", () => setTimeout(hideSuggestions, 150));

  paintEngine();
}
