// 效果层：日月天空（椭圆轨道 + 连续天色）+ 昼夜面板联动 + 天气粒子（雨/雪/雾/雷）。

// 根据当前时间 + 日出日落判定阶段
export function getPhase(now, sunrise, sunset) {
  const t = now.getTime();
  const sr = sunrise.getTime();
  const ss = sunset.getTime();
  const H = 3600 * 1000;
  if (t >= sr - H && t <= sr + H) return "dawn";
  if (t >= ss - H && t <= ss + H) return "dusk";
  if (t > sr + H && t < ss - H) return "day";
  return "night";
}

// 面板色：相位色叠在基础面板底色 rgba(20,23,34,0.92) 上的合成结果，
// 供搜索建议列表等前景面板随昼夜联动（通过 CSS 变量 --phase-panel 消费）。
const PHASE_PANEL_BG = {
  night: "rgba(10,14,39,0.99)",
  dawn: "rgba(107,70,55,0.95)",
  day: "rgba(35,38,48,0.92)",
  dusk: "rgba(124,61,45,0.95)",
};

export function applyDayNight(phase) {
  // 只负责面板等粗粒度联动；天空渐变色由 updateSky 按高度角连续驱动
  document.documentElement.style.setProperty(
    "--phase-panel",
    PHASE_PANEL_BG[phase] || PHASE_PANEL_BG.day
  );
}

// ===== 日月天空 =====
// 轨道：椭圆，圆心 = 页面底部中心，横半轴 = 页宽/2，纵半轴 = 页高×0.85。
// 太阳/月亮角度由真实日出日落时刻驱动（冬夏昼夜长短自然不同速）。
// 天色为太阳带符号高度角 hs=sinθ 的连续插值：hs>0 白天，-0.18<hs≤0 晨昏蒙影，≤-0.18 深夜。

const SKY_NIGHT = [8, 12, 40, 0.85];
const SKY_WARM_AM = [255, 150, 90, 0.45]; // 朝霞偏柔
const SKY_WARM_PM = [255, 105, 55, 0.5]; // 晚霞偏烈
const SKY_PALE = [255, 190, 130, 0.18];
const SKY_DAY = [255, 255, 255, 0.06];
const SUN_GLOW_LOW = [255, 165, 80]; // 近地平线：橙
const SUN_GLOW_HIGH = [255, 224, 150]; // 正午：白亮

// 天气对日月光晕的衰减 & 星星可见度
const WEATHER_DIM = { clear: 1, clouds: 0.55, fog: 0.3, rain: 0.25, snow: 0.35, thunder: 0.15 };
const STAR_VIS = { clear: 1, clouds: 0.45, fog: 0.12, rain: 0.1, snow: 0.15, thunder: 0.08 };

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function mixColor(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ];
}

function rgba(c) {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${c[3].toFixed(3)})`;
}

// 天色：hs 带符号高度角（白天>0，地平线=0，夜晚<0）
function skyTint(hs, isMorning) {
  const warm = isMorning ? SKY_WARM_AM : SKY_WARM_PM;
  if (hs <= 0) {
    // 晨昏蒙影：接近地平线时夜色渐染暖色（朝霞初现 / 落日余晖）
    const tw = clamp01(1 + hs / 0.18);
    return mixColor(SKY_NIGHT, warm, tw);
  }
  if (hs < 0.18) return mixColor(warm, SKY_PALE, hs / 0.18);
  if (hs < 0.45) return mixColor(SKY_PALE, SKY_DAY, (hs - 0.18) / 0.27);
  return SKY_DAY;
}

// 月相：朔望月周期 29.530588853 天，以已知朔（2000-01-06 18:14 UTC）为基准算月龄
const SYNODIC = 29.530588853;
const NEW_MOON_2000 = Date.UTC(2000, 0, 6, 18, 14);

// 返回相位 f：0=朔（新月），0.25=上弦，0.5=望（满月），0.75=下弦
function moonPhase(now) {
  const days = (now.getTime() - NEW_MOON_2000) / 86400000;
  let age = days % SYNODIC;
  if (age < 0) age += SYNODIC;
  return age / SYNODIC;
}

function buildStars(el, n) {
  const w = window.innerWidth;
  const h = window.innerHeight * 0.9;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const x = (Math.random() * w) | 0;
    const y = (Math.random() * h) | 0;
    const big = Math.random() > 0.85 ? 1 : 0;
    pts.push(`${x}px ${y}px 0 ${big}px rgba(255,255,255,${(0.35 + Math.random() * 0.55).toFixed(2)})`);
  }
  el.style.boxShadow = pts.join(",");
}

let sky = null; // {overlay, sun, moon, starsA, starsB}
let skyFirst = true; // 首次定位不播过渡

export function initSky() {
  const els = {
    overlay: document.getElementById("daynight-overlay"),
    sun: document.getElementById("sun"),
    moon: document.getElementById("moon"),
    shadow: document.getElementById("moon-shadow"),
    starsA: document.getElementById("stars-a"),
    starsB: document.getElementById("stars-b"),
  };
  if (!els.sun || !els.moon || !els.starsA) return;
  sky = els;
  const rebuild = () => {
    buildStars(sky.starsA, 70);
    buildStars(sky.starsB, 46);
  };
  rebuild();
  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(rebuild, 250);
  });
}

// 缓存最近一次日出日落与天气，供 rAF 每帧独立驱动日月位置
let skyCache = null;
let skyRAF = null;

// 归位插值状态：页面隐藏后恢复，日月从“上次渲染时刻位置”平滑带到“当前真实位置”
let lastFrameMs = 0;     // 上一帧渲染的真实时间戳
let catchupStartMs = 0;  // 归位动画开始时间戳
let catchupFromMs = 0;   // 归位起点对应的真实时间（隐藏前最后渲染时刻）
const CATCHUP_MS = 900;  // 归位时长：短隐藏=柔和滑动，长隐藏=快速划过归位

// 计算某时刻日月在椭圆轨道上的位置参数（纯函数，实时渲染与归位插值共用）
function computePositions(now, sr, ss) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const cx = W / 2;
  const cy = H;
  const rx = W / 2;
  const ry = H * 0.85; // 顶点距顶 15% 页高，任何宽高比都不会飞出去

  const dayMs = ss.getTime() - sr.getTime();
  const p = (now.getTime() - sr.getTime()) / dayMs;
  const th = Math.PI * (1 - p);
  const hs = Math.sin(th);
  const isMorning = p < 0.5;

  const nightMs = 24 * 3600 * 1000 - dayMs;
  let pm = -1;
  if (p >= 1) pm = (now.getTime() - ss.getTime()) / nightMs; // 日落后
  else if (p <= 0) pm = (now.getTime() - (ss.getTime() - 86400000)) / nightMs; // 日出前
  const inNight = pm >= 0 && pm <= 1;
  const thm = Math.PI * (1 - clamp01(pm));
  const hm = inNight ? Math.sin(thm) : 0;

  return {
    cx, cy, rx, ry,
    sunX: cx + rx * Math.cos(th), sunY: cy - ry * hs,
    moonX: cx + rx * Math.cos(thm), moonY: cy - ry * hm,
    hs, hm, inNight, isMorning,
  };
}

export function updateSky(now, sunrise, sunset, effect = "clear") {
  if (!sky) return;
  skyCache = { sr: sunrise, ss: sunset, effect };
  const { sun, moon, shadow, starsA, starsB, overlay } = sky;
  const targets = [sun, moon, shadow, starsA, starsB, overlay].filter(Boolean);
  if (skyFirst) targets.forEach((el) => el.classList.add("sky-noanim"));
  paintSky(now, sunrise, sunset, effect, 1); // 整帧即时渲染（首屏 / 天气刷新 / 效果变化）
  if (skyFirst) {
    void sun.offsetWidth; // 强制 reflow 后再放开过渡
    targets.forEach((el) => el.classList.remove("sky-noanim"));
    skyFirst = false;
  }
}

// 把某时刻的天色/日月样式写入 DOM。归位插值时 tScale<1 且传入 fromPos，
// 仅日月坐标在 fromPos→目标 间插值，天色与亮度取目标时刻（天色另有 2s 背景过渡）。
function paintSky(now, sr, ss, effect, tScale, fromPos) {
  if (!sky) return;
  const { overlay, sun, moon, shadow, starsA, starsB } = sky;
  const pos = computePositions(now, sr, ss);
  let sx = pos.sunX, sy = pos.sunY, mx = pos.moonX, my = pos.moonY;
  if (fromPos && tScale < 1) {
    sx = fromPos.sunX + (pos.sunX - fromPos.sunX) * tScale;
    sy = fromPos.sunY + (pos.sunY - fromPos.sunY) * tScale;
    mx = fromPos.moonX + (pos.moonX - fromPos.moonX) * tScale;
    my = fromPos.moonY + (pos.moonY - fromPos.moonY) * tScale;
  }
  sun.style.transform = `translate(${sx}px, ${sy}px) translate(-50%,-50%)`;
  moon.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;

  // 天色 overlay 连续插值
  overlay.style.background = rgba(skyTint(pos.hs, pos.isMorning));

  // 太阳：贴地平线淡入/出，光晕近地平线更大更橙
  const dim = WEATHER_DIM[effect] ?? 1;
  const up = clamp01(pos.hs);
  sun.style.opacity = clamp01(pos.hs / 0.05) * (0.55 + 0.45 * dim);
  const gc = mixColor(SUN_GLOW_LOW, SUN_GLOW_HIGH, up);
  const ga = (0.3 + 0.45 * (1 - up)) * dim;
  const gs = 90 + 70 * (1 - up);
  sun.style.boxShadow = `0 0 ${gs | 0}px ${(gs * 0.45) | 0}px ${rgba([gc[0], gc[1], gc[2], ga])}`;

  // 月亮：相位（暗盘平移裁出亮区）+ 亮区比例 k 决定亮度与光晕
  const f = moonPhase(now);
  const k = (1 - Math.cos(2 * Math.PI * f)) / 2; // 被照亮比例 0~1
  if (shadow) {
    // 上弦前暗盘左移（亮在右），下弦后暗盘右移（亮在左）；0=全遮（朔），±100%=全亮（望）
    const pct = f < 0.5 ? -200 * f : 200 * (1 - f);
    shadow.style.transform = `translateX(${pct.toFixed(2)}%)`;
  }
  moon.style.opacity = pos.inNight ? clamp01(pos.hm / 0.06) * (0.35 + 0.65 * k) * (0.5 + 0.5 * dim) : 0;
  moon.style.boxShadow = pos.inNight
    ? `0 0 ${(26 + 46 * k) | 0}px ${(10 + 16 * k) | 0}px rgba(190,205,255,${((0.08 + 0.26 * k) * dim).toFixed(3)})`
    : "none";

  // 星星：入夜渐显，阴天衰减
  const sv = clamp01((-pos.hs - 0.03) / 0.15) * (STAR_VIS[effect] ?? 1);
  starsA.style.opacity = sv;
  starsB.style.opacity = sv * 0.8;
}

// 实时驱动循环：每帧用当前真实时间刷新日月，正常显示时天然逐帧平滑（每帧位移极小）。
// 若检测到“时间跳跃”（隐藏/息屏后恢复，rAF 暂停导致帧间隔过大），则启动归位插值，
// 把日月从“上次渲染时刻位置”在 CATCHUP_MS 内平滑带到“当前真实位置”，消除瞬间跳跃。
// 归位由驱动循环自身完成，不依赖 visibilitychange 时机，彻底避免被后续帧抢跑。
export function startSkyLoop() {
  if (!sky || skyRAF) return;
  const loop = () => {
    if (skyCache) {
      const now = new Date();
      const nowMs = now.getTime();
      if (lastFrameMs && nowMs - lastFrameMs > 2000) {
        // 时间跳跃：进入归位模式（起点 = 隐藏前最后渲染时刻）
        catchupFromMs = lastFrameMs;
        catchupStartMs = nowMs;
      }
      if (catchupStartMs && nowMs - catchupStartMs < CATCHUP_MS) {
        const t = (nowMs - catchupStartMs) / CATCHUP_MS;
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
        const fromPos = computePositions(new Date(catchupFromMs), skyCache.sr, skyCache.ss);
        paintSky(now, skyCache.sr, skyCache.ss, skyCache.effect, e, fromPos);
      } else {
        catchupStartMs = 0;
        paintSky(now, skyCache.sr, skyCache.ss, skyCache.effect, 1);
      }
      lastFrameMs = nowMs;
    }
    skyRAF = requestAnimationFrame(loop);
  };
  skyRAF = requestAnimationFrame(loop);
}

// Canvas 粒子系统：一种效果同时只跑一个实例
export class WeatherFX {
  constructor() {
    this.canvas = document.getElementById("weather-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.raf = null;
    this.effect = null;
    this.particles = [];
    this.flash = 0;
    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);
    this.resize();
  }

  resize() {
    this.w = this.canvas.width = window.innerWidth;
    this.h = this.canvas.height = window.innerHeight;
  }

  start(effect) {
    this.stop();
    this.effect = effect;
    this.particles = [];
    if (effect === "rain" || effect === "thunder") this.initRain();
    else if (effect === "snow") this.initSnow();
    this.loop();
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.effect = null;
    this.particles = [];
    this.ctx.clearRect(0, 0, this.w || 0, this.h || 0);
  }

  initRain() {
    const n = Math.round(this.w / 4);
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        len: 10 + Math.random() * 18,
        speed: 6 + Math.random() * 8,
      });
    }
  }

  initSnow() {
    const n = Math.round(this.w / 8);
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: 1 + Math.random() * 3,
        speed: 0.6 + Math.random() * 1.4,
        drift: Math.random() * Math.PI * 2,
      });
    }
  }

  loop() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    if (this.effect === "rain" || this.effect === "thunder") {
      ctx.strokeStyle = "rgba(174,194,224,0.5)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const p of this.particles) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 1.5, p.y + p.len);
        p.y += p.speed;
        p.x += 0.4;
        if (p.y > this.h) {
          p.y = -p.len;
          p.x = Math.random() * this.w;
        }
      }
      ctx.stroke();
    } else if (this.effect === "snow") {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (const p of this.particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        p.y += p.speed;
        p.x += Math.sin(p.drift) * 0.6;
        p.drift += 0.01;
        if (p.y > this.h) {
          p.y = -p.r;
          p.x = Math.random() * this.w;
        }
      }
    } else if (this.effect === "fog") {
      ctx.fillStyle = "rgba(210,215,220,0.18)";
      ctx.fillRect(0, 0, this.w, this.h);
    } else if (this.effect === "thunder") {
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${this.flash})`;
        ctx.fillRect(0, 0, this.w, this.h);
        this.flash -= 0.04;
      } else if (Math.random() < 0.004) {
        this.flash = 0.6;
      }
    }
    // clear / clouds：只靠昼夜 overlay
    this.raf = requestAnimationFrame(() => this.loop());
  }
}
