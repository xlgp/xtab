// 搜索：渲染引擎切换器，提交时按当前引擎模板拼 URL 跳转。
// 模板用 {q} 占位；支持回车搜索、在新标签打开、键盘上下选择建议。
//
// 建议列表的选择模型：
//   selected === -1 表示「原始输入项」：不选任何建议，输入框恢复用户原本键入的内容。
//   上下键在 [原始输入项, 第 0 条 … 第 N-1 条] 上循环，故按到末条（上键到首条）后再按一次
//   即回到原始输入项，继续按键重新进入列表循环，上下对称。
//   键盘选中条目会把输入框回填为该条目（便于在其基础上继续细化输入）；回填是 JS 赋值
//   value，不会派发 input 事件，因此不会触发新的建议请求——只有用户真实键入才重新请求。
//   鼠标悬停与键盘共用同一个 selected，故列表永远只有一行高亮。

export function initSearch(settings) {
  const form = document.getElementById("search-form");
  const input = document.getElementById("search-input");
  const engineEl = document.getElementById("search-engine");
  const suggestionsEl = document.getElementById("search-suggestions");

  let idx = settings.defaultEngine ?? 0;
  let suggestions = [];
  let items = []; // 当前建议列表的 li 元素，用于只切换高亮而不重建 DOM
  let selected = -1; // -1 = 「原始输入项」
  let originalQuery = ""; // 用户真实键入的内容（回填预览时不更新）
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
    items = [];
    selected = -1;
  }

  // 列表内容变化时重建 DOM；高亮交由 paintActive 单独维护
  function renderSuggestions() {
    suggestionsEl.innerHTML = "";
    items = [];
    if (!suggestions.length) {
      suggestionsEl.hidden = true;
      return;
    }
    suggestions.forEach((s) => {
      const li = document.createElement("li");
      li.textContent = s;
      li.dataset.q = s;
      suggestionsEl.append(li);
      items.push(li);
    });
    suggestionsEl.hidden = false;
    paintActive();
  }

  // 只切换高亮行：键盘与鼠标共用同一个 selected，因此列表永远只有一行高亮
  function paintActive() {
    items.forEach((li, i) => li.classList.toggle("active", i === selected));
    const act = items[selected];
    if (act && act.scrollIntoView) act.scrollIntoView({ block: "nearest" });
  }

  // 回填输入框为当前选中项；-1（原始输入项）时恢复用户原本键入的内容。
  // JS 赋值 value 不派发 input 事件，故不会触发新的建议请求。
  function previewSelected() {
    input.value = selected >= 0 ? suggestions[selected] : originalQuery;
  }

  // 在 [原始输入项, 第 0 条 … 第 N-1 条] 上循环移动，上下对称
  function moveSelection(step) {
    const total = suggestions.length + 1; // +1 为「原始输入项」
    let pos = selected + 1; // 把 -1 映射到 0 才能参与取模
    pos = (pos + step + total) % total;
    selected = pos - 1;
    paintActive();
    previewSelected();
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

  // input 事件只在用户真实键入时派发（回填是 JS 赋值，不会走到这里），
  // 因此只有这里才更新「原始输入」并重新请求建议
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    originalQuery = input.value;
    selected = -1;
    if (!q) {
      hideSuggestions();
      return;
    }
    paintActive(); // 清除旧高亮，保持与 selected 一致
    debounceTimer = setTimeout(() => fetchSuggestions(q), 150);
  });

  input.addEventListener("keydown", (ev) => {
    if (ev.isComposing) return; // 输入法组字/选词期间不劫持方向键与回车
    if (!suggestions.length) return;
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      moveSelection(1);
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      moveSelection(-1);
    } else if (ev.key === "Enter") {
      // selected === -1（原始输入项）时不拦截，交给 form submit 用当前输入搜索
      if (selected >= 0) {
        ev.preventDefault();
        doSearch(suggestions[selected]);
      }
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      input.value = originalQuery; // 取消预览，恢复用户原本键入的内容
      hideSuggestions();
    }
  });

  // 鼠标悬停只更新高亮（与键盘共用 selected），不改输入框内容，
  // 避免鼠标划过时输入框乱跳；高亮唯一，回车即搜索该行
  suggestionsEl.addEventListener("mouseover", (ev) => {
    const li = ev.target.closest("li");
    if (!li) return;
    const i = items.indexOf(li);
    if (i >= 0 && i !== selected) {
      selected = i;
      paintActive();
    }
  });

  suggestionsEl.addEventListener("mousedown", (ev) => {
    const li = ev.target.closest("li");
    if (li) doSearch(li.dataset.q);
  });

  input.addEventListener("blur", () => setTimeout(hideSuggestions, 150));

  paintEngine();
}
