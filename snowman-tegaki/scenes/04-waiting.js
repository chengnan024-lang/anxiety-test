/* 场景：waiting —— 等
 *
 * 固定机位延时：你家的门 + 门前的雪人。天色 夜→晨→昼→昏→夜 一圈一圈地转，
 * 太阳和月亮划过天空，云飞快地跑，路人的脚印出现又被新雪盖住，门一直没有开。
 *
 * 镜头（按 p 分段，12～35 秒都成立）。"天数" τ 是 p 的函数（见 TSEG）：
 * 时间转得越快，这一帧里的天色就越"糊"成一片，太阳/月亮画成拖影（multiples），像长曝光。
 *   1. 0.00–0.19  远景·第一夜：毛笔「等」+ 手写标注「我」「你家」，左上角贴上计数卡「第 1 天」，时间开始加速（▶▶）
 *   2. 0.19–0.29  近景：雪人的脸，光一明一暗地闪，帽子上的雪变厚；脑袋里冒出"门开了、红手套在挥"的泡泡 → 啵
 *   3. 0.29–0.52  远景：第 7 天 → 跨年零点时间几乎停住，放烟花，雪人小声「新年快乐」→ 又越转越快
 *      0.425–0.475  插入·低机位：门的下半截，一个路人牵着小狗从门前走过（「路过」），脚印被雪一点点填平
 *   4. 0.52–0.64  字卡：横格纸，数字 12 → 23 像计数器一样翻上来，下面一笔一笔画「正」字，小雪人在旁边记；
 *                 落定后荧光笔 + 蓝笔圈起来
 *   5. 0.64–0.85  远景：第 23 天 → 第 30 天，飞快地转然后慢下来；花环和圣诞树撤了，积雪很厚，树枝手慢慢垂下
 *      0.74–0.78  回扣第 2 镜的近景：帽子上堆满了雪，没有泡泡了，一片雪花落在鼻尖上
 *   6. 0.85–1.00  夜里时间停下来：镜头慢慢推近，窗里的灯灭了，雪人头上「……」，竖排小字「门没有开」
 *
 * 光照：先画地面/房子/人物 → 用 source-atop 只给这些像素罩一层天色（夜蓝 / 黄昏暖）→
 * 再用 destination-over 把天空、星星、日月从"后面"垫上 → 最后画灯光、雪和文字（不吃罩色）。
 */
(function () {
  'use strict';
  const { clamp, lerp, seg, ease, rand, noise1, mix, rgba } = TG.U;
  const P = TG.PAL, C = TG.C, W = TG.W, H = TG.H;

  // ------------------------------------------------------------------ 分镜
  const SH = { s1: 0.19, s2: 0.29, ins0: 0.425, ins1: 0.475, s3: 0.52, s4: 0.64, cu0: 0.74, cu1: 0.78, s5: 0.85 };

  // τ = 从第 1 天零点起算的"天数"（小数部分是一天里的时刻：0 午夜，0.5 正午）
  // [p0, p1, τ0, τ1, 缓动]；相邻两段 τ 不连续的地方就是跳切
  const TSEG = [
    [0.00, 0.08, 0.855, 0.868, 'linear'], // 第一夜，几乎静止
    [0.08, SH.s1, 0.868, 2.93, 'in'],     // 开始加速
    [SH.s1, SH.s2, 3.12, 6.58, 'linear'], // 近景
    [SH.s2, 0.315, 6.62, 6.975, 'out'],   // 第 7 天傍晚 → 跨年
    [0.315, 0.37, 6.975, 7.03, 'linear'], // 零点前后几乎停住：烟花
    [0.37, SH.ins0, 7.03, 8.22, 'in'],    // 越转越快
    [SH.ins0, 0.45, 8.27, 8.53, 'linear'], // 插入·脚印：路人走过（接近真实时间）
    [0.45, SH.ins1, 8.53, 9.95, 'in'],    // 脚印被雪一点点填平
    [SH.ins1, SH.s3, 9.97, 11.9, 'in'],   // 回到远景
    [SH.s3, SH.s4, 11.9, 22.4, 'linear'], // 字卡（不用天色）
    [SH.s4, 0.84, 22.45, 29.905, 'outCubic'], // 飞快 → 慢下来
    [0.84, 1.0, 29.905, 29.95, 'linear'], // 第 30 天夜里，停住
  ];
  function tsegOf(p) {
    for (const s of TSEG) if (p < s[1]) return s;
    return TSEG[TSEG.length - 1];
  }
  function tauIn(s, p) {
    return lerp(s[2], s[3], ease[s[4]](seg(p, s[0], s[1])));
  }
  const tauAt = (p) => tauIn(tsegOf(p), p);
  /** 这一帧（1/12 秒）里 τ 走了多少天 —— 用来做"长曝光"模糊 */
  function tauStep(p, dur) {
    const s = tsegOf(p);
    const e = 0.002;
    const a = Math.max(s[0], p - e), b = Math.min(s[1], p + e);
    const d = (tauIn(s, b) - tauIn(s, a)) / Math.max(1e-6, b - a);
    return Math.abs(d) / Math.max(1, dur * 12);
  }
  const dayOf = (tau) => Math.floor(tau) + 1;
  /** 第 1 天 = 12 月 25 日 */
  function dateOf(day) {
    return day <= 7 ? `12.${24 + day}` : `1.${day - 7}`;
  }

  // ------------------------------------------------------------------ 天色
  // [时刻, 天顶, 中, 地平线, 罩色, 罩色强度, 暗(0..1), 暖(0..1)]
  const KEYS = [
    [0.0, '#0e1325', '#1a2142', '#2c3a66', '#141b3c', 0.4, 1, 0],
    [0.2, '#121830', '#232e5a', '#46507f', '#141b3c', 0.36, 1, 0],
    [0.265, '#3a4a82', '#b3809e', '#f4b98c', '#9a5a78', 0.16, 0.4, 1],
    [0.32, '#79a6d6', '#b8d4ec', '#f3e7d2', '#ffffff', 0, 0, 0.15],
    [0.5, '#7fb2df', '#bcd8ee', '#eaf2f6', '#ffffff', 0, 0, 0],
    [0.665, '#7fa3d0', '#c3d2e6', '#f2dcc2', '#e8a070', 0.05, 0.02, 0.3],
    [0.735, '#4b4f84', '#c97f88', '#f3a560', '#c0604a', 0.17, 0.4, 1],
    [0.8, '#19213f', '#343c70', '#6a5a8c', '#141b3c', 0.33, 1, 0.1],
    [1.0, '#0e1325', '#1a2142', '#2c3a66', '#141b3c', 0.4, 1, 0],
  ].map((k) => [k[0], hex(k[1]), hex(k[2]), hex(k[3]), hex(k[4]), k[5], k[6], k[7]]);

  function hex(c) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const css = (a) => `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})`;
  const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const frac = (x) => x - Math.floor(x);

  function lightAt(ph) {
    let i = 0;
    while (i < KEYS.length - 2 && ph > KEYS[i + 1][0]) i++;
    const A = KEYS[i], B = KEYS[i + 1];
    const k = ease.sine(seg(ph, A[0], B[0]));
    // 窗灯：傍晚亮、睡觉时灭；路灯：天黑就亮
    const win = ph > 0.72 && ph < 0.965 ? 1 : 0;
    const lamp = ph < 0.27 || ph > 0.755 ? 1 : 0;
    return {
      top: lerp3(A[1], B[1], k), mid: lerp3(A[2], B[2], k), bot: lerp3(A[3], B[3], k),
      tint: lerp3(A[4], B[4], k), tintA: lerp(A[5], B[5], k),
      dark: lerp(A[6], B[6], k), warm: lerp(A[7], B[7], k),
      win, lamp,
    };
  }
  /** 一帧之内 τ 走了 w 天：把这段时间里的光照平均（时间走得越快，天色越"糊"成一片） */
  function lightAvg(tau, w) {
    if (w < 0.012) return lightAt(frac(tau));
    const n = w > 0.15 ? 11 : 7;
    const acc = { top: [0, 0, 0], mid: [0, 0, 0], bot: [0, 0, 0], tint: [0, 0, 0], tintA: 0, dark: 0, warm: 0, win: 0, lamp: 0 };
    for (let i = 0; i < n; i++) {
      const L = lightAt(frac(tau + (i / (n - 1) - 0.5) * w));
      for (const key of ['top', 'mid', 'bot', 'tint']) for (let c = 0; c < 3; c++) acc[key][c] += L[key][c] / n;
      for (const key of ['tintA', 'dark', 'warm', 'win', 'lamp']) acc[key] += L[key] / n;
    }
    return acc;
  }
  /** 环境色：白天色 / 夜里色，按当前光照混合，黄昏再带一点暖 */
  function envOf(L) {
    return (day, night) => {
      const a = mix(day, night, L.dark);
      return L.warm > 0.01 ? mix(a, '#f1a877', L.warm * 0.2) : a;
    };
  }

  // 太阳 / 月亮的轨迹（u: 0 升起 → 1 落下，落在房子后面）
  const sunXY = (u) => [lerp(-70, 1320, u), 740 - Math.sin(Math.PI * u) * 620];
  const moonXY = (u) => [lerp(-70, 1320, u), 740 - Math.sin(Math.PI * u) * 540];
  const sunU = (ph) => (ph - 0.25) / 0.5;
  const moonU = (ph) => frac(ph - 0.76 + 1) / 0.48;

  // ------------------------------------------------------------------ 布景（远景坐标）
  const SM = { x: 590, y: 884, s: 0.84 };
  const DOOR = { x: 1262, y: 420, w: 206, h: 375 };
  const WIN = { x: 1640, y: 446, w: 230, h: 196 };
  const LAMP = { x: 900, y: 826, s: 0.7 };
  const LANT = { x: 1530, y: 470 };

  // 路人的脚印：[τ开始, τ结束, x0, x1, y, 带狗, seed]
  const TRAILS = [
    [8.3, 8.5, 2000, -80, 828, true, 1],
    [9.42, 9.6, -80, 2000, 852, false, 2],
    [10.55, 10.72, 2000, -80, 840, false, 3],
    [23.6, 23.8, -80, 2000, 834, false, 4],
    [26.3, 26.55, 2000, -80, 850, true, 5],
    [28.5, 28.75, -80, 2000, 826, false, 6],
    [29.42, 29.66, 2000, -80, 846, false, 7],
  ];

  // ------------------------------------------------------------------ 小工具
  // 柔光 / 暗角的形状是固定的：第一次用到时画进一张小图，之后直接贴图（只是常量图片的缓存，画面仍然只由 p/t/info 决定）
  const SPRITE_COLORS = [P.warm, P.glow, '#e8eeff', '#cfe8ff', '#fff6e0'];
  const sprites = {};
  function glowSprite(color) {
    if (sprites[color]) return sprites[color];
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      const v = 1 - u * u * (3 - 2 * u);
      gr.addColorStop(u, rgba(color, v * v));
    }
    x.fillStyle = gr;
    x.fillRect(0, 0, 128, 128);
    return (sprites[color] = c);
  }

  function softGlow(g, x, y, r, color, a) {
    if (a <= 0.003 || r <= 0) return;
    const ctx = g.ctx;
    const sp = SPRITE_COLORS.indexOf(color) >= 0 ? glowSprite(color) : null;
    if (sp) {
      ctx.save();
      ctx.globalAlpha *= clamp(a);
      ctx.drawImage(sp, x - r, y - r, r * 2, r * 2);
      ctx.restore();
      return;
    }
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      const v = 1 - u * u * (3 - 2 * u);
      gr.addColorStop(u, rgba(color, a * v * v));
    }
    ctx.save();
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  /** 带箭头的手绘曲线（progress 画到头才长出箭头） */
  function arrow(g, pts, o) {
    const pr = o.progress == null ? 1 : o.progress;
    if (pr <= 0) return;
    g.curve(pts, o);
    if (pr < 0.97) return;
    const n = pts.length, a = pts[n - 2], b = pts[n - 1];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const L = o.head || 22;
    for (const s of [-1, 1]) {
      const aa = ang + Math.PI + s * 0.5;
      g.line(b[0], b[1], b[0] + Math.cos(aa) * L, b[1] + Math.sin(aa) * L, Object.assign({}, o, { progress: 1, seed: (o.seed | 0) + 5 + s }));
    }
  }

  /** 雪松：四层下垂的枝 + 每层顶上的雪 */
  function pine(g, x, y, h, col, snowCol, o = {}) {
    const seed = o.seed | 0;
    const line = o.line === false ? false : o.line || P.ink;
    const lw = Math.max(2.2, h * 0.008);
    if (line) g.line(x, y, x, y - h * 0.16, { color: line, width: Math.max(4, h * 0.035), taper: false, seed });
    for (let k = 0; k < 4; k++) {
      const yb = y - h * 0.1 - k * h * 0.19;
      const yt = k === 3 ? y - h : yb - h * 0.34;
      const hw = h * 0.33 * (1 - k * 0.2);
      const pts = [[x, yt], [x + hw * 0.55, yb - h * 0.1], [x + hw, yb], [x + hw * 0.62, yb - h * 0.025], [x + hw * 0.3, yb + h * 0.012],
        [x, yb - h * 0.02], [x - hw * 0.3, yb + h * 0.012], [x - hw * 0.62, yb - h * 0.025], [x - hw, yb], [x - hw * 0.55, yb - h * 0.1]];
      if (line) g.poly(pts, { color: line, width: lw, fill: col, seed: seed + k });
      else g.fill(pts, col, { seed: seed + k });
      // 雪：盖住每层的上半截，下沿是波浪
      const m = 0.5;
      const sy = lerp(yt, yb, m);
      const sw = hw * m;
      const sp = [[x, yt - 1], [x + sw * 1.02, sy - h * 0.012], [x + sw * 0.62, sy + h * 0.018], [x + sw * 0.25, sy - h * 0.004], [x - sw * 0.12, sy + h * 0.022], [x - sw * 0.5, sy], [x - sw * 1.04, sy + h * 0.008]];
      if (line) g.poly(sp, { color: line, width: lw * 0.8, fill: snowCol, seed: seed + 10 + k });
      else g.fill(sp, snowCol, { seed: seed + 10 + k });
    }
  }

  /** 雪人帽顶的积雪（复刻 C.snowman 里帽子的变换） */
  function hatSnow(g, x, y, s, look, amt, ink) {
    if (amt <= 0.01) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.translate(x, y - 288.4 * s);
    ctx.rotate(look * 0.06);
    ctx.translate(-6 * s, -80 * s * 0.86);
    ctx.rotate(-0.12);
    const h = amt * 30 * s;
    g.path([[-47 * s, -76 * s], [-36 * s, -80 * s - h * 0.75], [-12 * s, -80 * s - h], [16 * s, -81 * s - h * 0.92], [38 * s, -81 * s - h * 0.6], [49 * s, -78 * s], [0, -74 * s]],
      { closed: true, smooth: true, color: ink, width: 3 * s, fill: P.snow, seed: 301 });
    // 帽檐两边也积一点
    const b = amt * 9 * s;
    g.path([[-72 * s, -2 * s], [-64 * s, -9 * s - b], [-50 * s, -11 * s - b * 0.8], [-46 * s, -5 * s]], { closed: true, smooth: true, color: ink, width: 2.4 * s, fill: P.snow, seed: 302 });
    g.path([[47 * s, -5 * s], [52 * s, -12 * s - b * 0.8], [64 * s, -10 * s - b], [72 * s, -2 * s]], { closed: true, smooth: true, color: ink, width: 2.4 * s, fill: P.snow, seed: 303 });
    ctx.restore();
  }

  /** 树枝手臂上的积雪（复刻 C.snowman 的手臂几何） */
  function armSnow(g, x, y, s, arms, amt, ink) {
    if (amt <= 0.05) return;
    const bodyRx = 132 * s, bodyRy = 118 * s, bodyCy = y - bodyRy;
    [-1, 1].forEach((side, k) => {
      const raise = (arms && arms[k]) || 0;
      const bx = x + side * bodyRx * 0.86, by = bodyCy - bodyRy * 0.35;
      const A = side === -1 ? Math.PI + 0.45 + raise : -0.45 - raise;
      const L = 120 * s;
      [0.32, 0.58, 0.86].forEach((u, j) => {
        const r = (5 + 5 * amt) * s * (1 - j * 0.15) * clamp(amt * 3 - j * 0.6);
        if (r < 1) return;
        const px = bx + Math.cos(A) * L * u, py = by + Math.sin(A) * L * u - r * 0.6 - 2 * s;
        g.ellipse(px, py, r * 1.9, r * 0.85, { color: ink, width: 2 * s, fill: P.snow, seed: 320 + k * 5 + j, rot: -side * 0.45 });
      });
    });
  }

  /** 雪人脚边越堆越高的雪 */
  function drift(g, x, y, s, amt, fill, ink) {
    const dh = (8 + 62 * amt) * s;
    g.path([[x - 230 * s, y + 18 * s], [x - 170 * s, y - dh * 0.35], [x - 90 * s, y - dh * 0.95], [x + 10 * s, y - dh], [x + 110 * s, y - dh * 0.85], [x + 190 * s, y - dh * 0.25], [x + 250 * s, y + 18 * s]],
      { closed: true, smooth: true, color: ink, width: 4 * s, fill, seed: 330 });
  }

  /** 一朵云 */
  function cloud(g, x, y, w, fill, line, seed) {
    const h = w * 0.22;
    const pts = [[x - w * 0.5, y + h * 0.4], [x - w * 0.4, y - h * 0.15], [x - w * 0.2, y - h * 0.55], [x + w * 0.02, y - h * 0.3], [x + w * 0.18, y - h * 0.85], [x + w * 0.38, y - h * 0.35], [x + w * 0.5, y + h * 0.4]];
    g.path(pts, { closed: true, smooth: true, color: line, width: 2.4, fill, seed });
  }

  /** 时光里一闪而过的路人（半透明，打着伞；后面拖两个残影） */
  function ghost(g, x, y, dir, a, seed, t) {
    if (a <= 0.01) return;
    const ctx = g.ctx;
    const col = '#4c5584';
    const step = Math.sin(t * 9 + seed) * 10;
    for (let c = 2; c >= 0; c--) {
      const ox = -dir * c * 46;
      ctx.save();
      ctx.globalAlpha *= a * (c === 0 ? 1 : c === 1 ? 0.45 : 0.2);
      ctx.translate(x + ox, y);
      ctx.fillStyle = rgba(col, 0.8);
      ctx.strokeStyle = col;
      // 腿
      g.line(-8, -60, -8 + step, 0, { color: col, width: 11, taper: false, seed: seed + c });
      g.line(8, -60, 8 - step, 0, { color: col, width: 11, taper: false, seed: seed + c + 3 });
      // 大衣
      g.path([[-26, -56], [-22, -124], [-12, -138], [12, -138], [22, -124], [28, -56]], { closed: true, smooth: true, color: col, width: 3, fill: rgba(col, 0.85), seed: seed + 6 });
      // 头 + 帽子
      g.circle(0, -156, 16, { color: col, width: 3, fill: rgba(col, 0.85), seed: seed + 7 });
      // 伞
      g.line(dir * 16, -118, dir * 12, -212, { color: col, width: 3, seed: seed + 8 });
      const ux = dir * 12;
      const um = [];
      for (let i = 0; i <= 12; i++) { const an = Math.PI + (i / 12) * Math.PI; um.push([ux + Math.cos(an) * 80, -200 + Math.sin(an) * 44]); }
      for (let i = 3; i >= 0; i--) { const xx = ux - 80 + (i + 0.5) * 40; um.push([xx + 20, -200], [xx, -192]); }
      g.path(um, { closed: true, color: col, width: 3, fill: rgba('#7d86b6', 0.9), seed: seed + 9 });
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ 状态（全部由 τ 推出来）
  function stateAt(p, t, info) {
    const tau = tauAt(p);
    const w = tauStep(p, info.dur || 16);
    const L = lightAvg(tau, w);
    const day = dayOf(tau);
    const amt = clamp((tau - 0.8) / 29); // 积雪 0 → 1
    return { tau, w, L, day, amt, env: envOf(L), t };
  }

  // ------------------------------------------------------------------ 天空（destination-over：画在已有内容的"后面"，所以从前往后画）
  function skyBehind(g, st, t, o = {}) {
    const ctx = g.ctx;
    const { L, tau, w } = st;
    const ph = frac(tau);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    // 云（时间走得太快时就看不清了）
    const ca = clamp(1 - (w - 0.04) / 0.12) * (o.clouds == null ? 1 : o.clouds);
    if (ca > 0.02) {
      const cf = rgba(css(lerp3(L.mid, [255, 255, 255], 0.55 - L.dark * 0.45)), 0.85 * ca);
      const cl = rgba(css(lerp3(L.top, [40, 44, 70], 0.4)), 0.45 * ca);
      for (let i = 0; i < 4; i++) {
        const span = 2400;
        const x = ((rand(i, 5, 1) * span + tau * (700 + rand(i, 5, 2) * 500)) % span) - 300;
        const y = 120 + rand(i, 5, 3) * 260;
        cloud(g, x, y, 200 + rand(i, 5, 4) * 160, cf, cl, 40 + i);
      }
    }
    // 太阳 / 月亮：时间走得快时画成"拖影"（动画里的 multiples），越往后越淡
    const sunA = 1 - L.dark * 0.85;
    const n = w < 0.03 ? 1 : Math.round(clamp(w / 0.06, 2, o.copies || 7));
    const span = Math.min(w, 0.9);
    const fade = n === 1 ? 1 : clamp(0.05 / w + 0.45);
    // destination-over：先画最前面的（领头的那个）
    for (let i = n - 1; i >= 0; i--) {
      const off = n === 1 ? 0 : (i / (n - 1) - 1) * span;
      const a = n === 1 ? 1 : fade * lerp(0.18, 1, Math.pow(i / (n - 1), 1.5));
      const q = frac(ph + off);
      const su = sunU(q);
      if (su > -0.05 && su < 1.05) {
        const [x, y] = sunXY(su);
        const low = clamp(1 - Math.sin(Math.PI * clamp(su)) * 1.6);
        ctx.save();
        ctx.globalAlpha *= a * Math.max(0.35, sunA);
        ctx.fillStyle = mix(P.sun, '#f39a52', low);
        ctx.beginPath();
        ctx.arc(x, y, 44, 0, Math.PI * 2);
        ctx.fill();
        if (i === n - 1) softGlow(g, x, y, 260, mix('#fff2c4', '#f6a65e', low), 0.55);
        ctx.restore();
      }
      const mu = moonU(q);
      if (mu >= 0 && mu <= 1) {
        const [x, y] = moonXY(mu);
        ctx.save();
        ctx.globalAlpha *= a;
        moonBehind(g, x, y, 38);
        if (i === n - 1) softGlow(g, x, y, 170, '#e8eeff', 0.28);
        ctx.restore();
      }
    }
    // 星星
    const sa = clamp((L.dark - 0.5) / 0.5);
    if (sa > 0) {
      ctx.fillStyle = '#e9eeff';
      for (let i = 0; i < 70; i++) {
        const x = rand(i, 61, 1) * W, y = rand(i, 61, 2) * 640;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.6 + rand(i, 61, 3) * 1.6) + i));
        ctx.globalAlpha = sa * tw * (0.3 + rand(i, 61, 4) * 0.6);
        ctx.beginPath();
        ctx.arc(x, y, 1 + rand(i, 61, 5) * 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // 渐变天空
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const gr = ctx.createLinearGradient(0, 0, 0, o.horizon || 780);
    gr.addColorStop(0, css(L.top));
    gr.addColorStop(0.55, css(L.mid));
    gr.addColorStop(1, css(L.bot));
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /** 弯月（在 destination-over 下：先描边、后填色，描边才会在上面） */
  function moonBehind(g, x, y, r) {
    const ctx = g.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - r * 3, y - r * 3, r * 6, r * 6);
    ctx.arc(x + r * 0.62, y - r * 0.28, r * 0.92, 0, Math.PI * 2, true);
    ctx.clip('evenodd');
    g.circle(x, y, r, { color: '#d9d2b4', width: 3, seed: 401 });
    ctx.fillStyle = '#fbf6dc';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * 罩色 + 暗角，一次画完：只罩在已经画了东西的像素上（source-atop），天空之后再从后面垫上。
   * 两层"叠加"合成一层：1-A = (1-罩)(1-暗角)，C·A = 罩色·罩·(1-暗角) + 暗角色·暗角
   */
  const VIG = [8, 11, 24];
  function tintOver(g, L, vig = 0) {
    const ta = clamp(L.tintA);
    if (ta <= 0.005 && vig <= 0.005) return;
    const ctx = g.ctx;
    const T = L.tint;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    if (vig <= 0.005) ctx.fillStyle = rgba(css(T), ta);
    else {
      const R = Math.hypot(W, H) * 0.5;
      const gr = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, R);
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        const k = clamp((u - 0.45) / 0.55);
        const v = clamp(vig * k * k * (3 - 2 * k));
        const A = 1 - (1 - ta) * (1 - v);
        const c = A > 1e-4 ? [0, 1, 2].map((j) => (T[j] * ta * (1 - v) + VIG[j] * v) / A) : T;
        gr.addColorStop(u, rgba(css(c), A));
      }
      ctx.fillStyle = gr;
    }
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function clearAll(g) {
    const ctx = g.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.restore();
  }

  // ------------------------------------------------------------------ 远景（第 1、3、5、6 镜）
  function world(g, st, t, o) {
    const ctx = g.ctx;
    const { L, tau, env, amt } = st;
    const ph = frac(tau);
    const ink = P.ink;

    // 远山
    const hill = env('#c4d1e8', '#56638f');
    g.path([[-40, 760], [-40, 690], [160, 664], [360, 684], [560, 650], [800, 676], [1020, 654], [1200, 680], [1200, 760]], { closed: true, smooth: true, color: rgba(ink, 0.45), width: 2.5, fill: hill, seed: 501, overshoot: false });
    // 远处的小松树
    const farPine = env('#8fa5c2', '#34416c');
    [[150, 676, 70], [196, 682, 52], [470, 668, 64], [520, 676, 46], [880, 676, 58], [930, 672, 74]].forEach(([x, y, h], i) => pine(g, x, y, h, farPine, env('#eef3fb', '#8c9ac4'), { line: false, seed: 520 + i * 7 }));

    // 雪地
    const ground = env('#f6f8fd', '#9eacd6');
    const gp = [[-40, H + 40]];
    for (let x = -40; x <= W + 40; x += 160) gp.push([x, 712 + noise1(x / 260, 3) * 10]);
    gp.push([W + 40, H + 40]);
    g.path(gp, { closed: true, smooth: true, color: rgba(ink, 0.8), width: 3.5, fill: ground, seed: 530, overshoot: false });
    // 雪面的起伏线
    const contour = env('#c9d4ea', '#7584b4');
    [[90, 770, 330], [700, 752, 260], [240, 952, 380], [1180, 930, 420], [1560, 870, 300]].forEach(([x, y, w], i) =>
      g.curve([[x, y], [x + w * 0.5, y - 9], [x + w, y + 2]], { color: contour, width: 3, seed: 540 + i }));

    // 房子
    house(g, st, t, o);

    // 路灯（灯光单独在"发光层"里补）
    C.lamp(g, LAMP.x, LAMP.y, LAMP.s, { light: L.lamp * 0.85, seed: 560 });

    // 脚印
    footprints(g, st);

    // 雪人的长影子（白天，随太阳转）
    const su = sunU(ph);
    if (st.w < 0.05 && su > 0.02 && su < 0.98 && L.dark < 0.6) {
      const [sx, sy] = sunXY(su);
      const dir = sx < SM.x ? 1 : -1;
      const hgt = clamp((740 - sy) / 620);
      const len = lerp(520, 90, hgt) * SM.s;
      const a = 0.22 * (1 - L.dark) * clamp(su * 8) * clamp((1 - su) * 8);
      ctx.save();
      ctx.globalAlpha *= a;
      ctx.fillStyle = '#5b6a9c';
      ctx.beginPath();
      ctx.moveTo(SM.x - 90 * SM.s * dir, SM.y + 4);
      ctx.quadraticCurveTo(SM.x + dir * len * 0.5, SM.y - 30 * SM.s, SM.x + dir * len, SM.y - 14 * SM.s);
      ctx.quadraticCurveTo(SM.x + dir * len * 1.05, SM.y + 6, SM.x + dir * len * 0.8, SM.y + 14);
      ctx.quadraticCurveTo(SM.x + dir * len * 0.3, SM.y + 26, SM.x + 90 * SM.s * dir, SM.y + 14);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 雪人
    const sm = o.snowman || {};
    C.snowman(g, SM.x, SM.y, SM.s, Object.assign({ look: 0.55, snowCap: 0.15 + 0.85 * amt, seed: 3, t }, sm));
    hatSnow(g, SM.x, SM.y, SM.s, sm.look == null ? 0.55 : sm.look, 0.1 + 0.9 * amt, ink);
    armSnow(g, SM.x, SM.y, SM.s, sm.arms, amt, ink);
    drift(g, SM.x, SM.y, SM.s, amt, ground, rgba(ink, 0.85));

    // 左边前景的大松树（压住画框）
    pine(g, 64, 930, 560, env('#4f7a74', '#1e3046'), env('#f6f8fd', '#a3b0d8'), { seed: 590 });
  }

  function house(g, st, t, o) {
    const ctx = g.ctx;
    const { L, tau, env, amt } = st;
    const ink = P.ink;
    const wall = env('#eadcc2', '#6a6688');
    const wallPts = [[1092, 808], [1092, 352], [1566, 128], [2040, 352], [2040, 808]];
    // 烟囱（在屋顶后面）
    g.poly([[1752, 214], [1754, 136], [1812, 134], [1814, 222]], { color: ink, width: 4, fill: env('#9b6f5c', '#4a3a4e'), seed: 600 });
    g.path([[1744, 140], [1756, 122 - amt * 8], [1784, 116 - amt * 10], [1812, 122 - amt * 8], [1822, 140]], { closed: true, smooth: true, color: ink, width: 3, fill: P.snow, seed: 601 });
    // 炊烟（屋里有人）
    const smoke = env('#ffffff', '#aab2d6');
    ctx.save();
    ctx.fillStyle = smoke;
    for (let i = 0; i < 7; i++) {
      const ph = frac(t * 0.3 + i / 7);
      const r = lerp(10, 44, ph);
      ctx.globalAlpha = 0.6 * (1 - ph) * clamp(ph * 6);
      ctx.beginPath();
      ctx.arc(1784 + ph * 140 + Math.sin(t * 1.3 + i * 2) * 12, 116 - ph * 200, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // 墙
    g.path(wallPts, { closed: true, color: ink, width: 4.5, fill: wall, seed: 602 });
    // 横木纹
    ctx.save();
    ctx.beginPath();
    wallPts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.closePath();
    ctx.clip();
    const sid = env('#cdb998', '#4f4b6c');
    for (let y = 390, k = 0; y < 800; y += 40, k++) g.line(1100, y + (k % 2) * 2, 2040, y, { color: sid, width: 2.6, jitter: 1.2, step: 14, seed: 610 + k });
    ctx.restore();
    // 阁楼圆窗
    g.circle(1566, 250, 36, { color: ink, width: 4, fill: env('#7d8db0', '#2a2c48'), seed: 630 });
    g.line(1566, 216, 1566, 284, { color: ink, width: 3.5, seed: 631 });
    g.line(1532, 250, 1600, 250, { color: ink, width: 3.5, seed: 632 });
    // 屋顶
    const roof = env('#5d5873', '#2b2842');
    g.poly([[1030, 360], [1566, 98], [2102, 360], [2102, 398], [1566, 140], [1030, 398]], { color: ink, width: 4.5, fill: roof, seed: 640 });
    // 屋顶积雪（越来越厚）
    const th = 14 + 26 * amt;
    g.path([[1012, 366], [1030, 350 - th * 0.6], [1300, 222 - th], [1566, 92 - th], [1830, 222 - th], [2110, 352 - th], [2110, 368], [1566, 108], [1030, 372]],
      { closed: true, smooth: true, color: ink, width: 4, fill: P.snow, seed: 641 });
    // 屋檐下的小冰柱
    for (let k = 0; k < 4; k++) {
      const x = 1046 + k * 16, y = 398 - k * 7;
      g.line(x, y, x + 1, y + 16 + rand(k, 9) * 12 + amt * 10, { color: rgba(ink, 0.7), width: 3, seed: 650 + k });
    }

    // 门
    C.door(g, DOOR.x, DOOR.y, DOOR.w, DOOR.h, { open: 0, wreath: tau < 13, seed: 660 });
    // 门口的小灯
    g.line(LANT.x - 14, LANT.y - 30, LANT.x + 8, LANT.y - 30, { color: ink, width: 4, seed: 670 });
    g.poly([[LANT.x - 4, LANT.y - 26], [LANT.x + 24, LANT.y - 26], [LANT.x + 28, LANT.y + 16], [LANT.x - 8, LANT.y + 16]], { color: ink, width: 3.5, fill: mix('#4a4560', P.glow, L.lamp), seed: 671 });
    g.poly([[LANT.x - 12, LANT.y - 24], [LANT.x + 10, LANT.y - 42], [LANT.x + 32, LANT.y - 24]], { color: ink, width: 3.5, fill: '#3b3552', seed: 672 });

    // 窗
    const day = st.day;
    const winL = o.winLight == null ? L.win : o.winLight;
    C.window(g, WIN.x, WIN.y, WIN.w, WIN.h, {
      light: winL, tree: tau < 13, person: winL > 0.5 && day % 4 !== 2 ? 0.9 * winL : 0,
      curtains: true, glow: false, seed: 680, t,
    });
    // 墙根的积雪
    const bank = (x0, x1, s) => g.path([[x0, 814], [x0 + 12, 796 - amt * 10], [lerp(x0, x1, 0.5), 790 - amt * 14], [x1 - 10, 796 - amt * 10], [x1, 814]], { closed: true, smooth: true, color: ink, width: 3.5, fill: P.snow, seed: s });
    bank(1078, 1238, 690);
    bank(1494, 1930, 691);
  }

  function footprints(g, st) {
    const ctx = g.ctx;
    const { tau, env } = st;
    const c1 = env('#a9b9dd', '#5c6a9a'), c2 = env('#8396c4', '#465482');
    for (const [t0, t1, x0, x1, y, dog, seed] of TRAILS) {
      if (tau < t0) continue;
      const n = 30;
      const dir = x1 > x0 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const ti = lerp(t0, t1, i / n);
        if (tau < ti) break;
        const a = 1 - clamp((tau - ti - 0.08) / 1.5);
        if (a <= 0.02) continue;
        const x = lerp(x0, x1, i / n) + noise1(i * 0.3, seed) * 10;
        const yy = y + (i % 2 ? 7 : -7) + noise1(i * 0.2, seed + 3) * 6;
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.ellipse(x, yy, 13, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.ellipse(x - dir * 2, yy + 1, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        if (dog) {
          // 小狗的爪印，跟在旁边乱跑
          const dx = x + dir * 26 + noise1(i * 0.7, seed + 5) * 18, dy = y + 30 + noise1(i * 0.5, seed + 6) * 10;
          ctx.fillStyle = c2;
          ctx.beginPath();
          ctx.ellipse(dx, dy, 5, 3, 0, 0, Math.PI * 2);
          for (let k = 0; k < 3; k++) ctx.ellipse(dx + dir * 6 + (k - 1) * 0.5, dy - 4 + (k - 1) * 4, 1.8, 1.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  /** 时光里的路人：只在留下脚印的那一小段时间里出现 */
  function passers(g, st) {
    const { tau, w } = st;
    for (const [t0, t1, x0, x1, y, dog, seed] of TRAILS) {
      if (tau < t0 - w || tau > t1 + w) continue;
      const k = clamp((tau - t0) / (t1 - t0));
      const a = 0.7 * clamp(0.1 / Math.max(0.02, w) + 0.2) * (1 - st.L.dark * 0.3);
      ghost(g, lerp(x0, x1, k), y - 4, x1 > x0 ? 1 : -1, a, 700 + seed * 20, st.t);
      void dog;
    }
  }

  /** 椭圆柔光（落在雪地上的一摊光） */
  function poolGlow(g, x, y, rx, ry, color, a) {
    if (a <= 0.003) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    softGlow(g, 0, 0, rx, color, a);
    ctx.restore();
  }

  /** 发光层（不吃罩色） */
  function emissive(g, st, o = {}) {
    const ctx = g.ctx;
    const { L } = st;
    const winL = o.winLight == null ? L.win : o.winLight;
    const lamp = L.lamp;
    // 窗
    if (winL > 0.01) {
      softGlow(g, WIN.x + WIN.w / 2, WIN.y + WIN.h / 2, 280, P.warm, 0.3 * winL);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba('#a0682a', 0.3 * winL);
      ctx.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
      ctx.restore();
      poolGlow(g, WIN.x + WIN.w / 2 + 20, 830, 260, 50, P.glow, 0.35 * winL);
    }
    if (lamp > 0.01) {
      // 路灯：灯头的光晕 + 地上的一摊光
      const top = LAMP.y - 600 * LAMP.s;
      softGlow(g, LAMP.x, top + 40 * LAMP.s, 280, P.warm, 0.38 * lamp);
      poolGlow(g, LAMP.x, LAMP.y + 16, 280, 46, P.glow, 0.42 * lamp);
      // 门口小灯
      softGlow(g, LANT.x + 10, LANT.y - 4, 130, P.warm, 0.55 * lamp);
      poolGlow(g, LANT.x - 40, 812, 180, 26, P.glow, 0.3 * lamp);
    }
    // 门缝里透出的一线光（屋里亮灯时）
    if (winL > 0.01) g.line(DOOR.x + DOOR.w - 3, DOOR.y + 8, DOOR.x + DOOR.w - 3, DOOR.y + DOOR.h - 10, { color: P.glow, width: 3, alpha: 0.75 * winL, seed: 720 });
  }

  // ------------------------------------------------------------------ UI：左上角的计数卡
  function card(g, st, p, info, a = 1) {
    if (a <= 0.01) return;
    const ctx = g.ctx;
    const day = st.day;
    // 换天时数字弹一下（时间走得太快就不弹了）
    const rate = (st.w * 12);
    const since = rate > 0 ? frac(st.tau) / rate : 9;
    const pop = rate < 2.6 ? 1 + 0.28 * (1 - ease.out(clamp(since / 0.28))) : 1;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(72, 58);
    ctx.rotate(-0.035);
    ctx.fillStyle = 'rgba(8,10,24,0.22)';
    ctx.fillRect(10, 12, 300, 150);
    g.rect(0, 0, 300, 150, { color: P.ink, width: 3.5, fill: P.paper, seed: 801 });
    // 胶带
    ctx.save();
    ctx.translate(150, 2);
    ctx.rotate(0.06);
    ctx.fillStyle = 'rgba(247,200,115,0.72)';
    ctx.fillRect(-52, -14, 104, 28);
    ctx.restore();
    g.text('第', 52, 70, { size: 62, color: P.ink, pop: false, seed: 810 });
    g.text('天', 250, 70, { size: 62, color: P.ink, pop: false, seed: 811 });
    ctx.save();
    ctx.translate(152, 66);
    ctx.scale(pop, pop);
    g.text(String(day), 0, 0, { size: 92, font: 'latin', weight: 700, color: P.ink, pop: false, seed: 812 });
    ctx.restore();
    g.text(dateOf(day), 150, 126, { size: 34, font: 'latin', weight: 700, color: P.inkSoft, pop: false, seed: 813 });
    ctx.restore();
    // 快进 ▶▶：时间转得越快越明显
    const ff = clamp((st.w - 0.03) / 0.05) * a;
    if (ff > 0.02) {
      const tt = st.t;
      ctx.save();
      ctx.globalAlpha *= ff;
      ctx.translate(436, 128);
      ctx.rotate(-0.05);
      const sc = 1 + 0.08 * Math.sin(tt * 14);
      ctx.scale(sc, sc);
      for (let k = 0; k < 2; k++) {
        const ox = k * 40 - 34;
        g.poly([[ox, -26], [ox + 42, 0], [ox, 26]], { color: P.ink, width: 3.5, fill: k ? P.warm : P.paper, seed: 820 + k });
      }
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ 镜头 1 / 3 / 5 / 6：远景
  function shotWide(g, p, t, info) {
    const ctx = g.ctx;
    const st = stateAt(p, t, info);
    const { L } = st;
    const shot = p < SH.s1 ? 1 : p < SH.s3 ? 3 : p < SH.s5 ? 5 : 6;

    // 雪人的小动作
    const blink = ((t + 0.4) % 3.3) < 0.14;
    const sm = { look: 0.55 + Math.sin(t * 0.7) * 0.05, eyesClosed: blink, wind: 0.15 + 0.1 * Math.sin(t * 0.9), arms: [0.04 * Math.sin(t * 1.1), 0.04 * Math.sin(t * 1.3 + 1)] };
    let winLight;
    let zoom = 1, cx = W / 2, cy = H / 2;
    if (shot === 1) {
      sm.mood = 'happy';
      sm.blush = 0.8;
    } else if (shot === 3) {
      sm.mood = 'calm';
      const ny = seg(p, 0.338, 0.35) * (1 - seg(p, 0.372, 0.382));
      if (ny > 0) { sm.mood = 'happy'; sm.lookUp = 0.5 * ny; sm.arms = [0.35 * ny, 0.5 * ny]; sm.look = lerp(sm.look, 0.1, ny); }
    } else if (shot === 5) {
      sm.mood = 'calm';
      sm.blush = 0.35;
      // 一天天过去，树枝手慢慢垂下来
      const droop = 0.22 * seg(p, SH.s4, SH.s5);
      sm.arms = [sm.arms[0] - droop, sm.arms[1] - droop];
    } else {
      const k = seg(p, SH.s5, 1);
      zoom = lerp(1, 1.13, ease.inOut(k));
      cx = lerp(W / 2, 1010, ease.inOut(k));
      cy = lerp(H / 2, 600, ease.inOut(k));
      const off = seg(p, 0.903, 0.906);
      winLight = 1 - off;
      sm.mood = p > 0.92 ? 'sad' : 'calm';
      sm.blush = 0.3;
      sm.arms = [sm.arms[0] - 0.22, sm.arms[1] - 0.22];
      // 灯灭了：往窗户那边看一眼，再转回门
      const glance = seg(p, 0.906, 0.92) * (1 - seg(p, 0.95, 0.965));
      sm.look = lerp(0.55, 0.95, glance);
      sm.lookUp = 0.25 * glance;
      sm.eyesClosed = blink || (p > 0.985);
    }

    clearAll(g);
    ctx.save();
    g.camera(cx, cy, zoom);
    world(g, st, t, { snowman: sm, winLight });
    ctx.restore();
    tintOver(g, L, L.dark > 0.3 && st.w < 0.06 ? 0.42 * L.dark + (shot === 6 ? 0.22 * seg(p, 0.9, 1) : 0) : 0);
    ctx.save();
    g.camera(cx, cy, zoom);
    skyBehind(g, st, t);
    emissive(g, st, { winLight });
    passers(g, st);
    if (shot === 3) fireworks(g, p, t);
    ctx.restore();

    // 雪：白天少一点、晚上多一点；按天变化（有的日子下大雪）
    const heavy = 0.5 + 0.5 * noise1(st.tau * 1.7, 11);
    const snowN = shot === 6 ? 150 : Math.round(60 + 90 * heavy);
    g.snow({ count: snowN, seed: 4, size: [2, 8], speed: [50, 120], wind: 22, alpha: 0.85 });
    if (shot === 6) g.snow({ count: 18, seed: 9, size: [9, 14], speed: [70, 120], wind: 30, alpha: 0.9 });


    // 文字
    if (shot === 1) titleLayer(g, p, t);
    if (shot === 3) newYear(g, p);
    const cardA = shot === 1 ? ease.out(seg(p, 0.055, 0.075)) : shot === 6 ? 1 - seg(p, 0.89, 0.91) : 1;
    if (shot === 1 && cardA > 0) {
      ctx.save();
      ctx.translate(0, (1 - cardA) * -40);
      card(g, st, p, info, cardA);
      ctx.restore();
    } else card(g, st, p, info, cardA);
    if (shot === 6) {
      // 灯灭之后，头顶冒出「……」
      ctx.save();
      g.camera(cx, cy, zoom);
      for (let i = 0; i < 3; i++) {
        const dk = seg(p, 0.925 + i * 0.008, 0.932 + i * 0.008) * (1 - seg(p, 0.975, 0.99));
        if (dk > 0) g.circle(SM.x + 108 + i * 28, SM.y - 296, 7 * ease.outBack(dk), { color: '#eef2ff', width: 2, fill: '#eef2ff', seed: 910 + i });
      }
      ctx.restore();
      const k = seg(p, 0.915, 0.975);
      g.text('门没有开', 640, 110, { size: 70, vertical: true, color: '#eef2ff', progress: k, stroke: 'rgba(14,18,40,0.6)', strokeWidth: 8, spacing: 10, seed: 900 });
    }
  }

  /** 第 1 镜：毛笔「等」+ 标注 */
  function titleLayer(g, p, t) {
    const ctx = g.ctx;
    const out = 1 - seg(p, 0.088, 0.112);
    if (out <= 0) return;
    // 「等」：从左上往右下"刷"出来
    const wk = ease.out(seg(p, 0.0, 0.045));
    if (wk > 0) {
      ctx.save();
      ctx.globalAlpha *= out;
      ctx.beginPath();
      const ex = lerp(380, 1180, wk);
      ctx.moveTo(380, 40);
      for (let y = 40; y <= 520; y += 40) ctx.lineTo(ex - (y - 40) * 0.5 + noise1(y / 60, 3) * 30, y);
      ctx.lineTo(380, 520);
      ctx.closePath();
      ctx.clip();
      g.text('等', 760, 290, { font: 'brush', size: 330, color: '#f6f8ff', shadow: { color: 'rgba(44,58,102,0.9)', dx: 10, dy: 10 }, pop: false, seed: 902 });
      ctx.restore();
    }
    // 标注「我」→ 雪人
    const a1 = seg(p, 0.022, 0.05);
    ctx.save();
    ctx.globalAlpha *= out;
    if (a1 > 0) {
      g.text('我', 318, 520, { size: 92, color: '#f6f8ff', progress: seg(p, 0.022, 0.03), stroke: 'rgba(14,18,40,0.55)', strokeWidth: 8, seed: 903 });
      arrow(g, [[360, 562], [420, 606], [496, 622]], { color: '#f6f8ff', width: 4.5, progress: seg(p, 0.028, 0.045), head: 20, seed: 904 });
    }
    // 标注「你家」→ 门
    const a2 = seg(p, 0.04, 0.07);
    if (a2 > 0) {
      g.text('你家', 1178, 182, { size: 84, color: P.warm, progress: seg(p, 0.04, 0.05), stroke: 'rgba(14,18,40,0.6)', strokeWidth: 8, seed: 905 });
      arrow(g, [[1262, 222], [1322, 262], [1356, 330], [1364, 398]], { color: P.warm, width: 4.5, progress: seg(p, 0.048, 0.066), head: 20, seed: 906 });
    }
    ctx.restore();
  }

  /** 第 3 镜：跨年夜的小烟花（只用暖黄 / 白 / 淡蓝） */
  function fireworks(g, p, t) {
    const ctx = g.ctx;
    const B = [[0.332, 420, 300, P.warm], [0.342, 880, 150, '#cfe8ff'], [0.351, 580, 400, P.glow], [0.36, 1010, 240, '#fff6e0'], [0.366, 330, 470, '#cfe8ff']];
    for (let i = 0; i < B.length; i++) {
      const [pk, x, y, col] = B[i];
      // 升空
      const up = seg(p, pk - 0.008, pk);
      if (up > 0 && up < 1) {
        const yy = lerp(720, y, ease.out(up));
        g.line(x, yy + 60, x, yy, { color: col, width: 3, alpha: 0.8, seed: 950 + i });
      }
      const e = seg(p, pk, pk + 0.026);
      if (e <= 0 || e >= 1) continue;
      const R = 170 * ease.outCubic(e);
      const a = 1 - ease.in(e);
      softGlow(g, x, y, R * 1.8, col, 0.35 * a);
      ctx.save();
      ctx.globalAlpha *= a;
      for (let k = 0; k < 14; k++) {
        const ang = (k / 14) * Math.PI * 2 + i;
        const r0 = R * 0.45, r1 = R;
        g.line(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0 + e * 18, x + Math.cos(ang) * r1, y + Math.sin(ang) * r1 + e * 30, { color: col, width: 3.4, seed: 960 + i * 20 + k });
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x + Math.cos(ang) * r1 * 1.12, y + Math.sin(ang) * r1 * 1.12 + e * 36, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function newYear(g, p) {
    const a = seg(p, 0.345, 0.36) * (1 - seg(p, 0.375, 0.39));
    if (a <= 0) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.globalAlpha *= clamp(a * 3);
    g.text('新年快乐', 868, 500, { size: 60, color: P.warm, progress: seg(p, 0.345, 0.36), stroke: 'rgba(14,18,40,0.6)', strokeWidth: 7, rot: -0.05, seed: 980 });
    g.curve([[742, 540], [712, 566], [680, 582]], { color: P.warm, width: 3.5, seed: 981 });
    ctx.restore();
  }

  // ------------------------------------------------------------------ 镜头 2：近景
  /** late=false：第 2 镜（还满怀希望）；late=true：第 5 镜里的回扣（帽子上堆满了雪，安安静静地看着门） */
  function shotClose(g, p, t, info, late) {
    const ctx = g.ctx;
    const st = stateAt(p, t, info);
    const { L, env, amt, tau } = st;
    const k = late ? seg(p, SH.cu0, SH.cu1) : seg(p, SH.s1, SH.s2);
    const ink = P.ink;
    const X = 690, Y = 1110, S = 2.05;
    const look = 0.72;
    // 一片雪花慢慢飘下来，落在胡萝卜鼻子上
    const fk = late ? ease.out(seg(p, SH.cu0, SH.cu0 + 0.028)) : 0;
    const landed = late && fk >= 1;

    clearAll(g);
    ctx.save();
    g.camera(W / 2, H / 2, lerp(1.0, 1.05, k), 0, lerp(0, -16, k), 0);
    // 远处的地平线 + 你家（虚一点、小一点）
    const ground = env('#f4f7fd', '#9aa8d4');
    g.path([[-60, H + 60], [-60, 806], [600, 790], [1300, 812], [1980, 800], [1980, H + 60]], { closed: true, smooth: true, color: rgba(ink, 0.6), width: 3, fill: ground, seed: 1001, overshoot: false });
    const wall = env('#eadcc2', '#6a6688');
    g.path([[1360, 830], [1360, 520], [1700, 380], [2040, 520], [2040, 830]], { closed: true, color: rgba(ink, 0.7), width: 3.5, fill: wall, seed: 1002 });
    g.poly([[1330, 524], [1700, 360], [2070, 524], [2070, 548], [1700, 386], [1330, 548]], { color: rgba(ink, 0.7), width: 3.5, fill: env('#5d5873', '#2b2842'), seed: 1003 });
    g.path([[1318, 528], [1500, 430 - amt * 12], [1700, 350 - amt * 16], [1900, 430 - amt * 12], [2080, 528], [1700, 372]], { closed: true, smooth: true, color: rgba(ink, 0.7), width: 3, fill: P.snow, seed: 1004 });
    C.door(g, 1500, 600, 128, 230, { wreath: tau < 13, seed: 1005 });
    C.window(g, 1700, 610, 150, 130, { light: L.win, tree: tau < 13, curtains: true, glow: false, seed: 1006, t });
    // 雪人（大）
    const blinkC = ((t + 1.1) % 2.6) < 0.13 || (landed && p > SH.cu0 + 0.03 && p < SH.cu0 + 0.037);
    C.snowman(g, X, Y, S, { look, mood: late ? 'calm' : 'hope', snowCap: 0.15 + 0.85 * amt, blush: late ? 0.45 : 0.7, eyesClosed: blinkC, seed: 3, t, wind: 0.2, arms: late ? [-0.2, -0.2] : [0, 0] });
    hatSnow(g, X, Y, S, look, 0.1 + 0.9 * amt, ink);
    armSnow(g, X, Y, S, late ? [-0.2, -0.2] : [0, 0], amt, ink);
    ctx.restore();
    tintOver(g, L, L.dark > 0.3 && st.w < 0.06 ? 0.4 * L.dark : 0);
    ctx.save();
    g.camera(W / 2, H / 2, lerp(1.0, 1.05, k), 0, lerp(0, -16, k), 0);
    skyBehind(g, st, t, { horizon: 820, copies: 2 });
    if (L.win > 0.01) softGlow(g, 1775, 675, 220, P.warm, 0.35 * L.win);
    if (L.lamp > 0.01) g.line(1626, 610, 1626, 820, { color: P.glow, width: 3, alpha: 0.7 * L.win, seed: 1010 });
    ctx.restore();
    // 呼出的白气
    const head = { x: X + look * 80 * S * 0.28 + 30, y: Y - 288.4 * S + 40 * S };
    if (!late) C.breath(g, head.x, head.y, t, { dir: 1, s: 1.3, seed: 1020 });
    // 近处的大雪片
    g.snow({ count: 70, seed: 21, size: [3, 12], speed: [80, 160], wind: 30, alpha: 0.9, crystal: 10 });
    if (late) {
      // 鼻尖（复刻 C.snowman 的胡萝卜几何：look≠0 时角度 0.1）
      const hr = 80 * S, tilt = look * 0.06;
      const lx = look * hr * 0.28 + Math.cos(0.1) * 54 * S - 8, ly = -hr * 0.12 + 18 * S + Math.sin(0.1) * 54 * S - 16;
      const tx = X + lx * Math.cos(tilt) - ly * Math.sin(tilt), ty = Y - 288.4 * S + lx * Math.sin(tilt) + ly * Math.cos(tilt);
      ctx.save();
      g.camera(W / 2, H / 2, lerp(1.0, 1.05, k), 0, lerp(0, -16, k), 0);
      const fx = lerp(tx + 140, tx, fk) + Math.sin(fk * 9) * 40 * (1 - fk), fy = lerp(-40, ty, fk);
      // 先描一圈淡墨，再画白的：落在白脸上也看得见
      C.flake(g, fx, fy, 34, { color: rgba(P.nightBlue, 0.75), width: 9, rot: fk * 2.4, seed: 1030, still: true });
      C.flake(g, fx, fy, 34, { color: '#ffffff', width: 4.5, rot: fk * 2.4, seed: 1031, fill: '#ffffff', still: true });
      ctx.restore();
    } else {
      // 脑袋里的泡泡：门开了，有只红手套在挥
      thought(g, p, t);
    }
    card(g, st, p, info, 1);
  }

  function thought(g, p, t) {
    const ctx = g.ctx;
    const k = ease.outBack(seg(p, 0.205, 0.225));
    const popK = seg(p, 0.272, 0.282);
    if (k <= 0 || popK >= 1) return;
    const bx = 1250, by = 250;
    ctx.save();
    // 小泡泡
    const dots = [[930, 392, 15], [1010, 342, 24]];
    dots.forEach(([x, y, r], i) => {
      const kk = seg(p, 0.2 + i * 0.006, 0.212 + i * 0.006);
      if (kk > 0 && popK < 0.3) g.circle(x, y, r * ease.outBack(kk), { color: P.ink, width: 3.5, fill: '#fbfcff', seed: 1100 + i });
    });
    ctx.translate(bx, by);
    const sc = 1.25 * k * (1 + popK * 0.35);
    ctx.scale(sc, sc);
    ctx.globalAlpha *= 1 - popK;
    // 云朵形状的泡泡
    const pts = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      pts.push([Math.cos(a) * 190, Math.sin(a) * 118]);
    }
    const cl = [];
    for (let i = 0; i < 9; i++) {
      const a0 = pts[i], a1 = pts[(i + 1) % 9];
      const mx = (a0[0] + a1[0]) / 2, my = (a0[1] + a1[1]) / 2;
      cl.push(a0, [mx * 1.16, my * 1.2]);
    }
    g.path(cl, { closed: true, smooth: true, color: P.ink, width: 4, fill: '#fbfcff', seed: 1110 });
    // 泡泡里：门开了一半，暖光，手套挥一挥
    const open = ease.out(seg(p, 0.222, 0.245));
    softGlow(g, -20, 0, 120, P.warm, 0.5 * open);
    C.door(g, -60, -70, 82, 140, { open: open * 0.75, wreath: false, seed: 1120 });
    if (open > 0.3) {
      const wave = Math.sin(t * 9) * 0.35;
      C.mitten(g, 30, 30, 0.42 * clamp((open - 0.3) / 0.4), 0.5 + wave, { seed: 1130 });
    }
    // 小爱心
    if (open > 0.8) C.heart(g, 110, -60, 18, { seed: 1140, rot: 0.2 });
    ctx.restore();
    // 啵
    if (popK > 0) {
      const R = 260 + popK * 140;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        g.line(bx + Math.cos(a) * R * 0.75, by + Math.sin(a) * R * 0.5, bx + Math.cos(a) * R, by + Math.sin(a) * R * 0.66, { color: '#fbfcff', width: 4, alpha: 1 - popK, seed: 1150 + i });
      }
    }
  }

  // ------------------------------------------------------------------ 镜头 3½：插入·门口的脚印
  // 低机位：画面上方是你家门的下半截和台阶，路人（和小狗）从门前走过，没有停下；随后脚印被雪一点点填平
  const PR = TRAILS[0];
  function shotPrints(g, p, t, info) {
    const ctx = g.ctx;
    const st = stateAt(p, t, info);
    const { L, env, tau } = st;
    const k = seg(p, SH.ins0, SH.ins1);
    const ink = P.ink;
    const ground = env('#f6f8fd', '#9eacd6');
    const winL = L.win;
    const cam = () => g.camera(W / 2, H / 2, lerp(1.0, 1.05, ease.inOut(k)), 0, lerp(-24, 24, k), 0);
    g.bg(ground);
    ctx.save();
    cam();
    // 墙 + 门的下半截
    const wall = env('#eadcc2', '#6a6688');
    const BY = 262; // 墙根
    g.rect(-80, -80, W + 160, BY + 80, { color: ink, width: 4.5, fill: wall, seed: 1400 });
    for (let y = 6, i = 0; y < BY - 10; y += 54, i++) g.line(-60, y, W + 60, y + 2, { color: env('#cdb998', '#4f4b6c'), width: 3, step: 14, seed: 1401 + i });
    g.rect(720, -80, 480, BY + 82, { color: ink, width: 5, fill: '#4b3a3a', seed: 1410 });
    g.rect(748, -80, 424, BY + 72, { color: ink, width: 5, fill: '#7c3f36', seed: 1411 });
    g.rect(800, -40, 320, BY - 70, { color: rgba(ink, 0.7), width: 4, seed: 1412 });
    // 门缝底下透出的光（屋里亮灯时）
    if (winL > 0.02) g.line(754, BY - 10, 1166, BY - 10, { color: P.glow, width: 6, alpha: 0.85 * winL, seed: 1413 });
    // 台阶和墙根的雪
    g.path([[640, BY + 34], [680, BY - 8], [960, BY - 20], [1240, BY - 10], [1280, BY + 34]], { closed: true, smooth: true, color: ink, width: 4, fill: P.snow, seed: 1414 });
    g.path([[-80, BY + 30], [-40, BY + 2], [300, BY - 8], [600, BY + 2], [660, BY + 30]], { closed: true, smooth: true, color: ink, width: 4, fill: P.snow, seed: 1415 });
    g.path([[1260, BY + 30], [1320, BY + 2], [1700, BY - 8], [2000, BY + 2], [2040, BY + 30]], { closed: true, smooth: true, color: ink, width: 4, fill: P.snow, seed: 1416 });
    g.line(-60, BY + 24, W + 60, BY + 26, { color: rgba(ink, 0.7), width: 3.5, step: 14, seed: 1417 });
    [[80, 420, 380], [1380, 400, 360], [300, 880, 520], [1420, 850, 340]].forEach(([x, y, w], i) =>
      g.curve([[x, y], [x + w * 0.5, y - 12], [x + w, y + 3]], { color: env('#c9d4ea', '#7584b4'), width: 3.5, seed: 1420 + i }));

    // 脚印（越往下越近、越大）
    const [t0, t1] = PR;
    const n = 11;
    const sole = env('#a2b4dc', '#53619a'), deep = env('#7b8fc2', '#3f4c7c');
    const posAt = (u) => {
      const x = lerp(2120, -200, u);
      return [x, 560 + (960 - x) * 0.06 + Math.sin(u * 6) * 10];
    };
    for (let i = 0; i < n; i++) {
      const ti = lerp(t0, t1, (i + 0.5) / n);
      if (tau < ti) break;
      const fill = clamp((tau - ti - 0.03) / 1.3); // 0 刚踩下 → 1 被雪填平
      const a = 1 - ease.in(fill);
      if (a <= 0.02) continue;
      const [x, y0] = posAt((i + 0.5) / n);
      const side = i % 2 ? 1 : -1;
      const y = y0 + side * 38;
      const sc = lerp(1.3, 1.7, clamp((y - 500) / 200));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI - 0.06);
      ctx.scale(sc, sc * 0.5);
      ctx.globalAlpha *= a;
      ctx.fillStyle = sole;
      ctx.beginPath();
      ctx.ellipse(-16, 0, 38, 24, 0, 0, Math.PI * 2);
      ctx.ellipse(40, 0, 22, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      // 鞋纹（越填越浅）
      ctx.globalAlpha *= 1 - fill;
      ctx.strokeStyle = deep;
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let j = 0; j < 4; j++) { ctx.moveTo(-40 + j * 16, -14); ctx.lineTo(-40 + j * 16, 14); }
      ctx.moveTo(32, -10); ctx.lineTo(48, 10);
      ctx.stroke();
      ctx.restore();
      // 被踩起来的雪边
      g.arc(x, y + 4, 40 * sc, 0.35, Math.PI - 0.35, { color: rgba('#ffffff', 0.9 * a), width: 3.5, seed: 1440 + i });
      // 小狗的爪印（离镜头更近）
      for (let q = 0; q < 2; q++) {
        const dx = x + 60 + q * 70 + noise1(i * 0.9 + q, 3) * 26, dy = y0 + 190 + q * 16 + noise1(i * 0.6 + q, 4) * 22;
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.fillStyle = deep;
        ctx.translate(dx, dy);
        ctx.scale(1.5, 1.5);
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2);
        for (let z = 0; z < 4; z++) ctx.ellipse(-18 + z * 12, -13 - (z === 1 || z === 2 ? 4 : 0), 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
    tintOver(g, L, 0);
    ctx.save();
    cam();
    if (winL > 0.02) poolGlow(g, 960, BY + 20, 420, 60, P.glow, 0.45 * winL);
    // 路人：只看得到腿和靴子（半透明），小狗跟在旁边
    if (tau > t0 - 0.02 && tau < t1 + 0.02) {
      const u = clamp((tau - t0) / (t1 - t0));
      const [x, y] = posAt(u);
      const a = 0.7 * clamp(0.08 / Math.max(0.02, st.w) + 0.3);
      const col = '#3f4775';
      const sw = Math.sin(t * 10) * 60;
      ctx.save();
      ctx.globalAlpha *= a;
      g.path([[x - 70, -60], [x - 112, y - 440], [x - 50, y - 420], [x + 10, y - 436], [x + 70, y - 418], [x + 124, y - 438], [x + 84, -60]], { closed: true, smooth: true, color: col, width: 4, fill: rgba(col, 0.9), seed: 1460 });
      g.line(x - 34, y - 440, x - 34 + sw, y - 24, { color: col, width: 58, taper: false, seed: 1461 });
      g.line(x + 34, y - 440, x + 34 - sw, y + 14, { color: col, width: 58, taper: false, seed: 1462 });
      g.ellipse(x - 52 + sw, y - 8, 58, 26, { color: col, width: 4, fill: col, seed: 1463 });
      g.ellipse(x + 16 - sw, y + 30, 58, 26, { color: col, width: 4, fill: col, seed: 1464 });
      // 小狗
      const hop = Math.abs(Math.sin(t * 14)) * 30;
      const dx = x + 130, dy = y + 150 - hop;
      const dog = rgba('#7d86b6', 0.95);
      for (const lx of [-56, -24, 30, 62]) g.line(dx + lx, dy + 26, dx + lx + Math.sin(t * 14 + lx) * 12, dy + 70, { color: col, width: 13, taper: false, seed: 1474 + lx });
      g.ellipse(dx, dy, 92, 46, { color: col, width: 4, fill: dog, seed: 1470 });
      g.curve([[dx + 86, dy - 14], [dx + 120, dy - 52], [dx + 138, dy - 44]], { color: col, width: 9, seed: 1473 });
      g.circle(dx - 96, dy - 44, 40, { color: col, width: 4, fill: dog, seed: 1471 });
      g.ellipse(dx - 136, dy - 32, 20, 14, { color: col, width: 3, fill: dog, seed: 1475 });
      C.dot(g, dx - 154, dy - 36, 6, col, 1476);
      C.dot(g, dx - 110, dy - 54, 4.5, col, 1477);
      g.ellipse(dx - 76, dy - 40, 15, 30, { color: col, width: 3, fill: col, rot: -0.35, seed: 1472 }); // 耷拉的耳朵
      ctx.restore();
    }
    ctx.restore();
    // 标注：路过
    const la = seg(p, 0.446, 0.452) * (1 - seg(p, 0.462, 0.47));
    if (la > 0) {
      ctx.save();
      ctx.globalAlpha *= la;
      g.text('路过', 1560, 430, { size: 72, color: P.ink, progress: seg(p, 0.446, 0.452), stroke: 'rgba(250,246,238,0.85)', strokeWidth: 10, rot: -0.04, seed: 1480 });
      arrow(g, [[1460, 470], [1200, 500], [940, 492]], { color: P.ink, width: 4.5, progress: seg(p, 0.449, 0.457), head: 22, seed: 1481 });
      ctx.restore();
    }
    // 雪（近处，大片）
    g.snow({ count: 70, seed: 41, size: [4, 14], speed: [90, 170], wind: 26, alpha: 0.9, crystal: 11 });
    card(g, st, p, info, 1);
  }

  // ------------------------------------------------------------------ 镜头 4：数字字卡
  function shotCount(g, p, t, info) {
    const ctx = g.ctx;
    const k = seg(p, SH.s3 + 0.004, 0.61);
    const n = 12 + 11 * ease.inOut(k);
    const cur = Math.floor(n + 1e-6);
    // 每个数字快速滚上来然后停住（翻页计数器的手感）
    const f = ease.outCubic(clamp((n - cur) / 0.5));
    const land = seg(p, 0.61, SH.s4);
    g.bg(P.paper);
    // 横格本
    for (let y = 104, i = 0; y < H; y += 68, i++) g.line(-20, y, W + 20, y + 2, { color: rgba(P.ice, 0.32), width: 2, jitter: 0.8, seed: 1200 + i });
    g.line(236, -20, 240, H + 20, { color: rgba(P.ice, 0.6), width: 2.6, seed: 1230 });
    g.snow({ count: 50, seed: 31, color: P.ice, alpha: 0.5, size: [3, 8], speed: [60, 120] });

    const sh = land > 0 && land < 0.4 ? g.shake(12 * (1 - land / 0.4)) : [0, 0];
    ctx.save();
    ctx.translate(sh[0], sh[1]);
    const NY = 420;
    // 落定后：一道暖黄的荧光笔
    if (land > 0) {
      const hk = ease.out(seg(p, 0.612, 0.626));
      g.path([[700, NY + 70], [lerp(700, 1230, hk), NY + 58]], { color: rgba(P.warm, 0.55), width: 70, taper: false, jitter: 2.5, seed: 1235 });
    }
    g.text('第', 500, NY + 10, { size: 230, color: P.ink, pop: false, seed: 1240 });
    g.text('天', 1430, NY + 10, { size: 230, color: P.ink, pop: false, seed: 1241 });
    // 滚动的数字（像里程表）
    ctx.save();
    ctx.beginPath();
    ctx.rect(640, NY - 205, 640, 410);
    ctx.clip();
    const step = 430;
    const stamp = 1 + 0.2 * (1 - ease.outBack(clamp(land * 3)));
    ctx.save();
    ctx.translate(960, NY - f * step);
    if (k >= 1) ctx.scale(stamp, stamp);
    g.text(String(cur), 0, 0, { size: 440, font: 'latin', weight: 700, color: P.ink, pop: false, seed: 1250 });
    ctx.restore();
    if (f > 0.001) g.text(String(cur + 1), 960, NY + (1 - f) * step, { size: 440, font: 'latin', weight: 700, color: P.ink, pop: false, seed: 1251 });
    ctx.restore();
    // 日期
    g.text(dateOf(f > 0.5 ? cur + 1 : cur), 960, 150, { size: 64, font: 'latin', weight: 700, color: P.inkSoft, pop: false, seed: 1260 });
    // 落定：蓝笔圈起来
    if (land > 0) g.ellipse(968, NY + 4, 270, 205, { color: P.nightBlue, width: 9, progress: ease.out(seg(p, 0.612, 0.632)), rot: -0.1, seed: 1270 });
    ctx.restore();

    // 「正」字计数：一天一笔
    const S = 104, gap = 44, x0 = 960 - (5 * S + 4 * gap) / 2 - 60, y0 = 700;
    const strokes = [[[0.1, 0.06], [0.9, 0.06]], [[0.5, 0.06], [0.5, 0.94]], [[0.5, 0.5], [0.84, 0.5]], [[0.2, 0.42], [0.2, 0.94]], [[0.02, 0.96], [0.98, 0.96]]];
    let tip = null;
    for (let i = 0; i < 25; i++) {
      const pr = clamp(n - i);
      if (pr <= 0) break;
      const b = Math.floor(i / 5), sIdx = i % 5;
      const bx = x0 + b * (S + gap), by = y0;
      const [a, c] = strokes[sIdx];
      g.line(bx + a[0] * S, by + a[1] * S, bx + c[0] * S, by + c[1] * S, { color: P.nightBlue, width: 9, progress: pr, seed: 1300 + i });
      tip = [lerp(bx + a[0] * S, bx + c[0] * S, pr), lerp(by + a[1] * S, by + c[1] * S, pr)];
    }
    // 小雪人在旁边一笔一笔地记
    const writing = Math.sin(frac(n) * Math.PI);
    const done = k >= 1;
    C.snowman(g, 1500, 872, 0.46, { look: -0.75, mood: done ? 'sad' : 'calm', arms: [done ? 0 : 0.2 + 0.45 * writing, 0], snowCap: 0.6, seed: 5, t, blush: 0.6, eyesClosed: done && land > 0.55 && land < 0.68 });
    if (done && land > 0.5) C.breath(g, 1462, 760, t, { dir: -1, s: 0.8, seed: 1320 });
    void tip;
  }

  // ------------------------------------------------------------------ 注册
  TG.scene({
    id: 'waiting',
    title: '等',
    dark: true,
    transition: 'wipe',
    chars: '等第天门没有开你家我新年快乐路过0123456789.',
    lyrics: 'default',
    draw(g, p, t, info) {
      if (p < SH.s1) shotWide(g, p, t, info);
      else if (p < SH.s2) shotClose(g, p, t, info, false);
      else if (p >= SH.ins0 && p < SH.ins1) shotPrints(g, p, t, info);
      else if (p < SH.s3) shotWide(g, p, t, info);
      else if (p < SH.s4) shotCount(g, p, t, info);
      else if (p >= SH.cu0 && p < SH.cu1) shotClose(g, p, t, info, true);
      else shotWide(g, p, t, info);
    },
  });
})();
