// 设置抽屉：首页右侧满高 iframe 内嵌 options.html（扩展页 / 普通网页均同源）。
// iframe 让 options 页的脚本与样式完全隔离，不必为抽屉单独改它的结构。
// 抽屉内保存过设置时，关闭后重载首页让新配置生效。

let overlay = null;
let frame = null;
let opener = null;
let dirty = false; // 本次打开期间是否保存过设置

export function isSettingsOverlayOpen() {
  return overlay !== null;
}

export function initSettingsOverlay() {
  const btn = document.getElementById("settings-btn");
  if (!btn) return;
  btn.addEventListener("click", open);

  // 只接受来自本抽屉 iframe 的消息；保存只标记，等关闭时统一刷新，
  // 避免用户连续调整多项设置时被反复 reload 打断。
  window.addEventListener("message", (ev) => {
    if (!overlay || ev.source !== frame?.contentWindow) return;
    if (ev.data?.type === "xtab:settings-saved") dirty = true;
  });

  window.addEventListener("keydown", onKeydown);
}

function onKeydown(ev) {
  if (ev.key === "Escape" && overlay) {
    ev.preventDefault();
    close();
  }
}

function open() {
  if (overlay) return;
  dirty = false;
  opener = document.activeElement;

  const node = document.createElement("div");
  node.id = "settings-overlay";
  node.className = "settings-overlay";
  node.setAttribute("role", "dialog");
  node.setAttribute("aria-modal", "true");
  node.setAttribute("aria-label", "闲窗设置");
  node.innerHTML = `
    <div class="settings-overlay__mask" data-close></div>
    <div class="settings-overlay__panel">
      <button class="settings-overlay__close" type="button" aria-label="关闭设置" data-close>&times;</button>
      <iframe class="settings-overlay__frame" src="options.html" title="闲窗设置"></iframe>
    </div>`;
  document.body.append(node);
  overlay = node;

  node.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-close]")) close();
  });

  const f = node.querySelector("iframe");
  frame = f;
  f.addEventListener("load", () => {
    // 焦点进入 iframe 后父文档收不到键盘事件，同源下补挂 ESC 监听
    try {
      f.contentDocument?.addEventListener("keydown", onKeydown);
    } catch {
      /* 非同源时忽略，仍可点关闭按钮或遮罩 */
    }
  });

  requestAnimationFrame(() => node.classList.add("is-open")); // 保证滑入过渡生效
  node.querySelector(".settings-overlay__close").focus();
}

function close() {
  if (!overlay) return;
  const node = overlay;
  overlay = null;
  frame = null;
  node.classList.remove("is-open");

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    node.remove();
    if (opener?.isConnected) opener.focus();
    opener = null;
    if (dirty) location.reload();
  };
  node.addEventListener("transitionend", finish, { once: true });
  setTimeout(finish, 300); // 过渡未触发时的兜底
}
