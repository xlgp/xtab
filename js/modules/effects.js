// 效果层：昼夜叠加（随日出日落变化色调）+ 天气粒子（雨/雪/雾/雷）。

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

const PHASE_BG = {
  night: "rgba(8,12,40,0.85)",
  dawn: "rgba(255,150,90,0.35)",
  day: "rgba(255,255,255,0.06)",
  dusk: "rgba(255,110,60,0.42)",
};

// 面板色：相位色叠在基础面板底色 rgba(20,23,34,0.92) 上的合成结果，
// 供搜索建议列表等前景面板随昼夜联动（通过 CSS 变量 --phase-panel 消费）。
const PHASE_PANEL_BG = {
  night: "rgba(10,14,39,0.99)",
  dawn: "rgba(107,70,55,0.95)",
  day: "rgba(35,38,48,0.92)",
  dusk: "rgba(124,61,45,0.95)",
};

export function applyDayNight(phase) {
  const el = document.getElementById("daynight-overlay");
  el.style.background = PHASE_BG[phase] || PHASE_BG.day;
  document.documentElement.style.setProperty(
    "--phase-panel",
    PHASE_PANEL_BG[phase] || PHASE_PANEL_BG.day
  );
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
