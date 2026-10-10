// 时钟：秒级刷新，用 rAF 对齐到整秒边界，避免 setInterval 累积漂移。
// 休眠唤醒后 rAF 自动校正，不丢秒。

const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function initClock(settings) {
  const timeEl = document.getElementById("clock-time");
  const dateEl = document.getElementById("clock-date");

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function render() {
    const now = new Date();
    let t = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (settings.clock.showSeconds) t += `:${pad(now.getSeconds())}`;
    timeEl.textContent = t;

    if (settings.clock.showDate) {
      dateEl.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${WEEK[now.getDay()]}`;
    } else {
      dateEl.textContent = "";
    }

    // 对齐到下一个整秒（或整分，若无秒显示）再刷新
    const delay = settings.clock.showSeconds
      ? 1000 - now.getMilliseconds()
      : (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    requestAnimationFrame(() => setTimeout(render, delay));
  }

  render();
}
