# 闲窗

> 偷得浮生半日闲。一个静心向的 Chrome 新标签页——开页即获片刻安宁。

闲窗是一个纯前端、零构建的 Chrome MV3 扩展，把浏览器的新标签页改成一块安静的「窗」：秒级时钟、实时天气、当日诗词、农历干支、东升西落的日月与轮换壁纸，一切围绕「让人平静下来」设计。

> 注：仓库目录名 `xtab` 为内部代号；对外展示名（扩展名）为「闲窗」。

## ✨ 功能特性

- **静心布局**：大字号时钟 + 居中搜索 + 半透明诗词，留白克制，不喧宾夺主。
- **多引擎搜索**：内置 Google / 百度，可自定义添加任意引擎；搜索建议面板配色随昼夜自动联动。
- **实时天气**：基于 Open-Meteo（免 Key），支持城市与浏览器定位，雨雪等天气以 Canvas 粒子呈现。
- **昼夜天空**：依据真实日出日落时间，驱动太阳沿椭圆轨道东升西落；入夜显示星空，并实时呈现月相。
- **农历干支徽标**：左上角展示「二〇二六年九月初四日 丙午年戊戌月庚申日」式八字三柱，可在设置中关闭。
- **当日诗词**：接入「今日诗词」免费接口，随机展示并周期切换，出处以《书名号》消歧义。
- **轮换壁纸**：在线随机图（Picsum，失败自动切换 Bing 每日壁纸 / Unsplash）/ 纯色渐变 / 自定义，支持模糊、亮度、暗角调节；按 `B` 键立即换图，双图层交叉淡入平滑过渡。
- **快捷链接**：可自定义常用站点，集中管理。
- **设置抽屉**：点击右下角齿轮，在首页右侧以抽屉内嵌 options 页；保存后关闭抽屉即自动刷新生效。

## 🛠 技术栈

- Chrome 扩展 Manifest V3
- 原生 JavaScript（ES Modules），无框架、无构建步骤，直接加载
- `window.localStorage` 持久化设置与缓存（扩展页 / 普通网页两端通用）
- Canvas 2D 天气粒子；CSS 变量驱动昼夜主题
- 免费数据源（均免 API Key）：
  - 诗词：[今日诗词](https://v1.jinrishici.com) `v1.jinrishici.com`
  - 天气 / 地理编码：[Open-Meteo](https://open-meteo.com)
  - 背景图：[Picsum Photos](https://picsum.photos)、[Bing 每日壁纸](https://cn.bing.com)、[Unsplash](https://unsplash.com) 图床

## 🔁 背景图源与自动降级

在线图在扩展页直接取，不经 Service Worker：扩展页与 SW 同属 `chrome-extension://` 源，在 `host_permissions` 内同样豁免 CORS。图源优先级 **Picsum → Bing 每日壁纸（近 8 日随机一张）→ Unsplash 精选风景图集**，任一成功即写入 IndexedDB 缓存并交叉淡入。

- 单次请求超时：Picsum / Bing 6s、Unsplash 12s；失败的源 1 小时内降权（状态存 `localStorage`），并记住最近成功的源，避免每次开新标签页都白等 Picsum 超时。
- `fetch` 全线失败时（常见于扩展未重新加载、新权限未生效），用 `<img>` 探测 + CSS 背景直连兜底：跨域图片显示不需要 CORS 或权限，仍可换图，但此路径不写缓存。
- 缓存写入失败不阻断换图；按 `B` 手动换图会提示当前图源名或具体失败原因，各源详细错误以 `[xtab]` 前缀打印在控制台。
- 全部失败时保留当前缓存图或渐变，不显示错误图。
- Bing / Unsplash 为兜底，图库规模小于 Picsum：Bing 每日一图、Unsplash 内置 16 张固定 ID（免 API Key，均带 `ACAO:*`）。
- 改过 `manifest.json` 后需在 `chrome://extensions` 重新加载扩展，Bing 接口才拿到权限；不重载时 Unsplash 仍可直接出图。
- 普通网页端没有 `host_permissions` 豁免，`HPImageArchive.aspx` 会被 CORS 拦下；Picsum / Unsplash 带 `ACAO` 可直连，`fetch` 全挂时仍有 `<img>` + CSS 直连兜底，背景功能不至于失效。

## 📁 目录结构

```
xtab/
├── manifest.json          # 扩展清单（name: 闲窗）
├── index.html             # 新标签页入口
├── options.html / .js / .css   # 设置页
├── sw.js                  # Service Worker：搜索建议代理
├── css/style.css          # 样式与昼夜主题变量
└── js/
    ├── main.js            # 入口装配
    └── modules/
        ├── clock.js       # 时钟 + 农历干支徽标
        ├── search.js      # 搜索与建议
        ├── weather.js     # 天气
        ├── poetry.js      # 诗词
        ├── background.js  # 背景轮换 / B 键 / 双图层交叉淡入
        ├── effects.js     # 昼夜 / 日月 / 月相 / 天气粒子
        ├── lunar.js       # 农历干支（查表法，八字三柱）
        ├── quicklinks.js  # 快捷链接
        ├── settings.js    # 设置模型
        ├── store.js       # 统一 KV 存储（两端通用）
        ├── settingsOverlay.js # 设置抽屉（iframe 内嵌 options）
        └── bgCache.js     # 背景缓存
```

## 🚀 安装

1. 获取代码（二选一）：
   ```bash
   git clone git@github.com:xlgp/xtab.git
   # 或从 Gitee: git clone git@gitee.com:<你的用户名>/xtab.git
   ```
2. 打开 `chrome://extensions`，开启右上角「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择本项目根目录。
4. 打开新标签页即可看到「闲窗」。

> 当前以开发者模式加载为主，可按需在 Chrome 网上应用店发布。

## ⌨️ 快捷键

| 按键 | 功能 |
| --- | --- |
| `B` | 立即更换一张在线随机背景（仅「在线随机图」类型生效） |
| `Esc` | 关闭设置抽屉（若保存过设置会自动刷新生效） |

其余设置（搜索引擎、背景、天气、诗词、时钟、快捷链接）均在设置页（`options.html`，点击页面右下角齿轮图标）调整。

## 🔒 隐私

- 天气使用 Open-Meteo 公开接口；若开启「定位」，仅向该接口发送经纬度以获取当地天气，不留存、不上传其他信息。
- 诗词、背景图均为公开免费服务。
- 所有个人设置仅保存在本地 `window.localStorage`，不上传任何第三方服务器。

## 📄 许可证

暂未指定许可证。如需使用、分发或二次开发，请先联系作者。
