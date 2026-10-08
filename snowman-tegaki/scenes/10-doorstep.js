/* 场景：doorstep —— 门前（主歌二）
 *
 * 雪人的主观视角盯着"你"家的门。门缝透着光 → 有动静 → 门开了一条缝！→ 出来的是一只小黑猫，
 * 一阵风把门"砰"地关上，灯也灭了 → 反打雪人：帽子上的雪"噗"地掉下来。
 *
 * 镜头（按 p 分段，12～35 秒都成立）：
 *   1. 0.00–0.20  主观·门：睁眼，门缝、锁眼、窗帘后面透着暖光；毛笔「门」+ 箭头「还亮着」，镜头慢推
 *   2. 0.20–0.40  动静（三连快切）：贴地看门缝，光里有小影子走过「嗒 嗒 嗒」
 *                 → 门把手特写，"咔"地压下又弹回 → 雪人的脸 + 集中线「！」
 *   3. 0.40–0.60  开了：门往里开了一条缝，光像一把刀铺到雪地上「开…开了！」
 *                 → 反打：一道光照在雪人身上，他张开手、脸红，小红心扑通扑通，竖排「是你吗」
 *   4. 0.60–0.79  喵：贴地，门缝里探出一只小黑猫 → 走出来坐下「喵～」
 *                 → 主观：一阵风「呼——」，猫跑开，门「砰！」地关上，门缝的光、窗里的灯一起灭了，眨眼
 *   5. 0.79–1.00  反打：又冷又暗，小猫从雪人身边跑过去，留下一串小脚印；手慢慢放下，
 *                 帽子上的雪「噗」地掉下来 → 脸部近景（和下一幕「梦」的开头同一个机位），竖排小字「是猫啊」
 */
(function () {
  'use strict';
  const { clamp, lerp, seg, ease, rand, noise1, mix, rgba } = TG.U;
  const P = TG.PAL, C = TG.C, W = TG.W, H = TG.H;

  // ------------------------------------------------------------------ 分镜
  const SH = { feet: 0.2, knob: 0.28, eyes: 0.35, open: 0.4, lit: 0.52, cat: 0.6, slam: 0.7, after: 0.79, close: 0.92 };

  // ------------------------------------------------------------------ 颜色
  const K = {
    wallTop: '#34345a', wall: '#45436a', siding: '#2f2e50',
    trim: '#574760', trimHi: '#6d5b74',
    door: '#6e3836', doorLo: '#4e2729', doorHi: '#8a4a41', doorLine: '#371c22',
    brass: '#d9a64c', brassHi: '#ffe8a8', brassLo: '#98682a',
    stone: '#5f6386', stoneLo: '#474a6c',
    snow: '#e3e8f6', snowLo: '#aeb9da',
    inA: '#ffe6ad', inB: '#f8be6c', inFloor: '#cf8a4f',
    cat: '#3a3550', catLo: '#24202f', catW: '#f3f3f9', catEye: '#ffd659',
    dark: '#0b0e1d',
  };
  const SLAB_B = 750; // 门板下沿；门槛在 760，中间这道就是"门缝"

  // ------------------------------------------------------------------ 小工具
  function polyPath(ctx, pts) {
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.closePath();
  }

  /** 多边形 + 线性渐变（光斑、影子） */
  function gradPoly(g, pts, x0, y0, x1, y1, stops) {
    const ctx = g.ctx;
    const gr = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([u, c]) => gr.addColorStop(u, c));
    ctx.save();
    ctx.fillStyle = gr;
    polyPath(ctx, pts);
    ctx.fill();
    ctx.restore();
  }

  /** 扁的柔光 */
  function ovalGlow(g, x, y, rx, ry, color, a) {
    if (a <= 0.003 || rx <= 1 || ry <= 1) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, rgba(color, a));
    gr.addColorStop(0.3, rgba(color, a * 0.5));
    gr.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = gr;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }

  function veil(g, color, a) {
    if (a <= 0.003) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = rgba(color, a);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // 竖直渐变的小缓存：1px 宽的画布拉伸到整屏，比整屏 createLinearGradient 便宜得多（只是常量贴图，不记任何帧间状态）
  const VCACHE = {};
  function vband(g, key, stops, x, y, w, h, alpha) {
    if (h <= 0 || w <= 0) return;
    let c = VCACHE[key];
    if (!c) {
      c = document.createElement('canvas');
      c.width = 1;
      c.height = 256;
      const cx = c.getContext('2d');
      const gr = cx.createLinearGradient(0, 0, 0, 256);
      stops.forEach(([u, col]) => gr.addColorStop(u, col));
      cx.fillStyle = gr;
      cx.fillRect(0, 0, 1, 256);
      VCACHE[key] = c;
    }
    const ctx = g.ctx;
    ctx.save();
    if (alpha != null) ctx.globalAlpha *= alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(c, x, y, w, h);
    ctx.restore();
  }

  /** 暗角（屏幕坐标）：上下用缓存的竖直渐变，左右两条窄渐变 */
  function vignette(g, a) {
    if (a <= 0) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    vband(g, 'vig', [[0, rgba(K.dark, 0.85)], [0.3, rgba(K.dark, 0)], [0.7, rgba(K.dark, 0)], [1, rgba(K.dark, 0.95)]], 0, 0, W, H, a);
    const sw = 340;
    for (const side of [0, 1]) {
      const x0 = side ? W : 0, x1 = side ? W - sw : sw;
      const gr = ctx.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, rgba(K.dark, 0.8 * a));
      gr.addColorStop(1, rgba(K.dark, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(side ? W - sw : 0, 0, sw, H);
    }
    ctx.restore();
  }

  /** 手写字（夜里用：浅色 + 深色描边） */
  function say(g, s, x, y, o) {
    const size = (o && o.size) || 64;
    return g.text(s, x, y, Object.assign({ size, font: 'hand', color: '#f7f3ff', stroke: rgba(K.dark, 0.6), strokeWidth: size * 0.13 }, o));
  }

  /** 带箭头的手绘曲线 */
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

  /** 前景的大颗虚焦雪 */
  function bokeh(g, t, n, seed, o = {}) {
    const ctx = g.ctx;
    const col = o.color || '#ffffff';
    ctx.save();
    for (let i = 0; i < n; i++) {
      const r = lerp(14, 44, rand(i, seed, 1));
      const v = lerp(45, 110, rand(i, seed, 2));
      const span = H + 200;
      const y = ((rand(i, seed, 3) * span + t * v) % span) - 100;
      const wx = (o.wind || 25) * t + Math.sin(t * 0.6 + i * 2.1) * 40;
      const x = ((((rand(i, seed, 4) * (W + 200) + wx) % (W + 200)) + W + 200) % (W + 200)) - 100;
      const a = (o.alpha || 0.2) * lerp(0.45, 1, rand(i, seed, 5));
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rgba(col, a));
      gr.addColorStop(0.55, rgba(col, a * 0.55));
      gr.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  /** 下雪：中景 + 前景虚焦；o.beam = 屏幕上的一块多边形，里面的雪被光照成暖色 */
  function snowfall(g, t, o = {}) {
    const so = { t, count: o.count || 110, seed: 3, size: [2, 7], speed: [38, 90], wind: o.wind == null ? 16 : o.wind, sway: o.sway == null ? 22 : o.sway, alpha: 0.85 };
    g.snow(so);
    if (o.beam && o.beamA > 0.02) {
      const ctx = g.ctx;
      ctx.save();
      polyPath(ctx, o.beam);
      ctx.clip();
      g.snow(Object.assign({}, so, { color: P.glow, alpha: o.beamA }));
      g.snow({ t, count: 60, seed: 77, size: [3, 8], speed: [30, 70], wind: so.wind, color: '#fff3d6', alpha: o.beamA });
      ctx.restore();
    }
    bokeh(g, t, o.bokeh == null ? 7 : o.bokeh, 21, { wind: so.wind * 1.5 });
  }

  /** 主观镜头的眼皮：k = 0 睁开 → 1 闭上 */
  function lids(g, k) {
    if (k <= 0.002) return;
    const ctx = g.ctx;
    const e = ease.inOut(clamp(k)) * (H / 2 + 110);
    const cv = 190 * (1 - k * 0.55);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#080a15';
    ctx.shadowColor = '#080a15';
    ctx.shadowBlur = 70;
    ctx.beginPath();
    ctx.moveTo(-200, -200);
    ctx.lineTo(W + 200, -200);
    ctx.lineTo(W + 200, e + cv - 40);
    ctx.quadraticCurveTo(W / 2, e - cv * 3 - 40, -200, e + cv - 40);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-200, H + 200);
    ctx.lineTo(W + 200, H + 200);
    ctx.lineTo(W + 200, H - e - cv * 0.5 + 40);
    ctx.quadraticCurveTo(W / 2, H - e + cv * 1.5 + 40, -200, H - e - cv * 0.5 + 40);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** 漫画集中线 */
  function focusLines(g, cx, cy, rx, ry, n, color, a, seed) {
    const ctx = g.ctx, b = g.info.boil;
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha *= a;
    const R = 1.5;
    for (let i = 0; i < n; i++) {
      const an = (i / n) * Math.PI * 2 + (rand(i, b, seed) - 0.5) * 0.07;
      const ri = 0.92 + rand(i, b, seed + 1) * 0.45;
      const wd = 0.004 + rand(i, seed, 3) * 0.011;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(an) * rx * ri, cy + Math.sin(an) * ry * ri);
      ctx.lineTo(cx + Math.cos(an - wd) * rx * R * 2, cy + Math.sin(an - wd) * ry * R * 2);
      ctx.lineTo(cx + Math.cos(an + wd) * rx * R * 2, cy + Math.sin(an + wd) * ry * R * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 上去 → 停 → 带回弹地回来（门把手） */
  function dip(c, a, b, d) {
    const up = ease.outCubic(seg(c, a, b));
    const down = ease.outBack(seg(c, b + (d - b) * 0.15, d));
    return up * (1 - down);
  }

  // ------------------------------------------------------------------ 门面（主观镜头的整面墙）
  // 门的坐标系：门板左上角 (0,0)，宽 400，门槛 y=760。F = {x, y, k}：门坐标 (u,v) → 屏幕 (x+u*k, y+v*k)
  const frameAt = (u, v, sx, sy, k) => ({ x: sx - u * k, y: sy - v * k, k });

  function facade(g, F, st) {
    const ctx = g.ctx;
    const k = F.k, lw = Math.pow(k, 0.42);
    const X = (u) => F.x + u * k, Y = (v) => F.y + v * k;
    const M = (q) => [X(q[0]), Y(q[1])];
    const Ms = (arr) => arr.map(M);
    const t = st.t, light = clamp(st.light || 0), open = clamp(st.open || 0);
    const vis = (u0, v0, u1, v1) => X(u1) > -60 && X(u0) < W + 60 && Y(v1) > -60 && Y(v0) < H + 60;

    // —— 墙（横向搭接木板）
    {
      ctx.save();
      ctx.fillStyle = K.wall;
      ctx.fillRect(-40, -40, W + 80, H + 80);
      ctx.restore();
      const gap = 46;
      const v0 = Math.floor(-F.y / k / gap) * gap;
      for (let v = v0; Y(v) < Math.min(H + 20, Y(800)); v += gap) {
        const y = Y(v);
        if (y < -30) continue;
        ctx.save();
        ctx.fillStyle = 'rgba(8,8,20,0.13)';
        ctx.fillRect(-20, y, W + 40, 10 * k);
        ctx.restore();
        g.line(-30, y, W + 30, y + 2, { color: K.siding, width: 2.6 * lw, jitter: 1.1, step: 14, seed: 100 + Math.round(v / gap) });
      }
    }
    // —— 窗（右边）、门灯、小盆栽
    if (vis(720, 120, 1160, 620)) {
      const wl = st.win || 0;
      if (wl > 0) ovalGlow(g, X(930), Y(360), 330 * k, 300 * k, P.warm, 0.22 * wl);
      C.window(g, X(740), Y(150), 380 * k, 420 * k, { light: wl, curtains: true, frost: 0.35, glow: false, seed: 40, t });
    }
    if (vis(500, 150, 640, 420)) lantern(g, X(560), Y(262), k, lw);
    if (vis(-330, 560, -130, 820)) pottedPine(g, X(-250), Y(800), k, lw);

    // —— 门框
    g.poly(Ms([[-38, -44], [438, -44], [438, 764], [-38, 764]]), { color: P.ink, width: 4.5 * lw, fill: K.trim, seed: 190 });
    g.path(Ms([[-24, 760], [-24, -30], [424, -30], [424, 760]]), { color: rgba(K.trimHi, 0.9), width: 2.4 * lw, seed: 191 });

    // —— 门洞里：屋里的光
    const xe = 400 - open * 130, yt = open * 16, yb = SLAB_B - open * 8;
    ctx.save();
    polyPath(ctx, Ms([[0, 0], [400, 0], [400, 760], [0, 760]]));
    ctx.clip();
    {
      const gi = ctx.createLinearGradient(0, Y(0), 0, Y(760));
      gi.addColorStop(0, mix('#221d30', K.inA, light));
      gi.addColorStop(0.7, mix('#201b2d', K.inB, light));
      gi.addColorStop(1, mix('#1b1726', K.inFloor, light));
      ctx.fillStyle = gi;
      ctx.fillRect(X(0) - 2, Y(0) - 2, 400 * k + 4, 760 * k + 4);
      // 门缝这一条最亮
      ctx.fillStyle = rgba('#fff1c8', light);
      ctx.fillRect(X(0) - 2, Y(SLAB_B - 4), 400 * k + 4, 16 * k);
      if (open > 0.04) {
        // 门厅：地板、墙脚线、挂钩上的红手套
        g.line(X(250), Y(684), X(410), Y(690), { color: rgba('#9a5a34', 0.6 * light + 0.2), width: 3 * lw, seed: 170 });
        g.line(X(330), Y(276), X(332), Y(300), { color: P.ink, width: 3 * lw, seed: 171 });
        C.mitten(g, X(352), Y(306) + 40 * k * 0.26, 0.26 * k, Math.PI + 0.12, { seed: 172 });
        ctx.save();
        ctx.fillStyle = rgba(K.inA, 0.22 * light);
        ctx.fillRect(X(0), Y(0), 400 * k, 760 * k);
        ctx.restore();
      }
    }
    ctx.restore();

    // —— 门板（往里开时：铰链在左，右边那条边往里退）
    const sp = (u, v) => {
      const a = u / 400;
      return [X(a * xe), Y(lerp(a * yt, lerp(SLAB_B, yb, a), v / SLAB_B))];
    };
    const sx = xe / 400;
    const quad = (u0, v0, u1, v1) => [sp(u0, v0), sp(u1, v0), sp(u1, v1), sp(u0, v1)];
    if (open > 0.01) {
      // 门板的厚度（被屋里的光照亮）
      const th = 16 * open;
      g.poly(Ms([[xe, yt], [xe + th, yt - 3 * open], [xe + th, yb + 2 * open], [xe, yb]]), { color: P.ink, width: 3 * lw, fill: mix(K.doorHi, K.inB, 0.45 * light), seed: 195 });
    }
    const slab = [sp(0, 0), sp(400, 0), sp(400, SLAB_B), sp(0, SLAB_B)];
    g.poly(slab, { color: P.ink, width: 4.6 * lw, fill: K.door, seed: 200 });
    // 月光从左上来：门板右下暗一点
    gradPoly(g, slab, X(0), Y(0), X(400 * sx), Y(760), [[0, 'rgba(255,240,230,0.05)'], [1, 'rgba(10,6,20,0.25)']]);
    if (open > 0) g.fill(slab, rgba('#120c1c', open * 0.4), { jitter: 0.5 });
    // 门板上的两块凹板
    [[54, 64, 300, 334], [54, 442, 300, 700]].forEach(([u0, v0, u1, v1], i) => {
      g.poly(quad(u0, v0, u1, v1), { color: K.doorLine, width: 3.2 * lw, fill: K.doorLo, fillAlpha: 0.45, seed: 210 + i });
      g.path([sp(u0 + 12, v1 - 12), sp(u0 + 12, v0 + 12), sp(u1 - 12, v0 + 12)], { color: rgba(K.doorHi, 0.9), width: 2.2 * lw, seed: 214 + i });
    });
    // 木纹
    [[24, 10, 740], [326, 20, 360], [326, 470, 740], [374, 30, 330], [120, 380, 420], [200, 720, 745]].forEach(([u, a0, a1], i) => {
      g.curve([sp(u, a0), sp(u + 4, lerp(a0, a1, 0.5)), sp(u - 3, a1)], { color: rgba(K.doorLine, 0.4), width: 1.7 * lw, seed: 220 + i });
    });
    // 以前挂花环的地方：一圈颜色没褪的印子 + 一颗钉子
    {
      const wc = sp(200, 186);
      g.ellipse(wc[0], wc[1], 74 * k * sx, 74 * k, { color: rgba(K.doorHi, 0.3), width: 13 * lw, seed: 230 });
      const nl = sp(200, 108);
      C.dot(g, nl[0], nl[1], 3.6 * lw, '#c9b08a', 231);
    }
    // 猫眼
    {
      const pe = sp(200, 300);
      g.ellipse(pe[0], pe[1], 10 * k * sx, 10 * k, { color: P.ink, width: 2.6 * lw, fill: K.brass, seed: 232 });
      g.ellipse(pe[0], pe[1], 4.5 * k * sx, 4.5 * k, { color: P.ink, width: 1.6 * lw, fill: mix('#1d1a2a', K.inA, light * 0.7), seed: 233 });
    }
    handle(g, sp, k, lw, sx, st.lever || 0, light, st.keyDim || 0);
    if (open > 0.01) g.line(...sp(400, 0), ...sp(400, SLAB_B), { color: P.glow, width: 3 * lw, alpha: Math.sqrt(open) * light, seed: 261 });

    // —— 门槛、地面、台阶
    g.poly(Ms([[-40, 760], [440, 760], [444, 773], [-44, 773]]), { color: P.ink, width: 3.4 * lw, fill: '#40394f', seed: 240 });
    if (Y(800) < H + 40) {
      const pts = [[-60, H + 60]];
      for (let x = -60; x <= W + 60; x += 120) pts.push([x, Y(800) + noise1(x / 260 + F.x / 900, 4) * 7 * k]);
      pts.push([W + 60, H + 60]);
      g.path(pts, { closed: true, smooth: true, color: P.ink, width: 3.8 * lw, fill: K.snow, seed: 245, overshoot: false });
      // 远离门的地方暗一点
      vband(g, 'gnd', [[0, 'rgba(60,70,120,0.25)'], [1, 'rgba(40,46,90,0.55)']], -20, Y(790), W + 40, Y(1100) - Y(790));
    }
    // 台阶（石头）+ 台阶上的雪：门口这片雪一个脚印都没有
    g.poly(Ms([[-116, 790], [516, 790], [522, 850], [-122, 850]]), { color: P.ink, width: 4 * lw, fill: K.stone, seed: 250 });
    g.line(X(-110), Y(842), X(514), Y(842), { color: rgba(K.stoneLo, 0.9), width: 5 * lw, seed: 252 });
    g.path(Ms([[-130, 798], [-118, 777], [-20, 772], [200, 770], [420, 772], [520, 777], [530, 798], [470, 810], [300, 805], [120, 812], [-60, 806]]), { closed: true, smooth: true, color: P.ink, width: 3.4 * lw, fill: K.snow, seed: 251 });
    // 墙根的雪堆
    g.path(Ms([[-900, 806], [-860, 784], [-600, 778], [-300, 786], [-160, 790], [-128, 806]]), { closed: true, smooth: true, color: P.ink, width: 3.2 * lw, fill: K.snow, seed: 253 });
    g.path(Ms([[526, 806], [560, 788], [800, 780], [1100, 786], [1400, 782], [1500, 806]]), { closed: true, smooth: true, color: P.ink, width: 3.2 * lw, fill: K.snow, seed: 254 });

    // —— 光
    if (light > 0.01) {
      // 门缝那条线的光晕
      ovalGlow(g, X(200), Y(756), 330 * k, 46 * k, P.warm, 0.55 * light);
      // 门缝洒在台阶和雪地上的光（扇形）
      gradPoly(g, Ms([[0, 773], [400, 773], [640, 1250], [-240, 1250]]), 0, Y(773), 0, Y(1000), [[0, rgba(P.glow, 0.55 * light)], [0.35, rgba(P.glow, 0.18 * light)], [1, rgba(P.glow, 0)]]);
      // 门缝后面走过的小影子
      (st.paws || []).forEach((pw) => {
        const u0 = clamp(pw.u - pw.w / 2, 0, 400), u1 = clamp(pw.u + pw.w / 2, 0, 400);
        if (u1 - u0 < 1) return;
        const a = pw.a == null ? 1 : pw.a;
        ctx.save();
        polyPath(ctx, Ms([[0, SLAB_B - 2], [400, SLAB_B - 2], [400, 761], [0, 761]]));
        ctx.clip();
        ctx.fillStyle = rgba('#1b1424', 0.94 * a * light);
        ctx.beginPath();
        ctx.ellipse(X(pw.u), Y(760), (pw.w / 2) * k, 13 * k, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        const fan = (u) => u + (u - 200) * 1.1;
        gradPoly(g, Ms([[u0, 773], [u1, 773], [fan(u1), 1050], [fan(u0), 1050]]), 0, Y(773), 0, Y(1040), [[0, rgba('#170f24', 0.55 * a * light)], [1, rgba('#170f24', 0)]]);
      });
    }
    if (open > 0.01 && light > 0.01) {
      const a = Math.sqrt(open) * light;
      // 门缝里出来的一刀光，铺在雪地上
      gradPoly(g, Ms([[xe, 773], [400, 773], [400 + 330, 1500], [xe - 330, 1500]]), 0, Y(773), 0, Y(1300), [[0, rgba(P.glow, 0.85 * a)], [0.4, rgba(P.glow, 0.3 * a)], [1, rgba(P.glow, 0)]]);
      ovalGlow(g, X((xe + 400) / 2), Y(430), 230 * k * (0.6 + open), 560 * k, P.warm, 0.42 * a);
      ovalGlow(g, X((xe + 400) / 2), Y(770), 260 * k, 70 * k, P.glow, 0.5 * a);
    }
    if (st.dim > 0) veil(g, K.dark, 0.55 * st.dim);
    return { X, Y, M, sp, xe, k, lw };
  }

  /** 门把手：长条底板 + 压杆 + 锁眼（锁眼里透出屋里的光） */
  function handle(g, sp, k, lw, sx, lever, light, keyDim) {
    const ctx = g.ctx;
    const M = (u, v) => sp(u, v);
    const cx = 338;
    // 底板（圆角长条）
    const plate = [];
    const hw = 15, top = 344, bot = 466, r = 13;
    for (let i = 0; i <= 6; i++) { const a = Math.PI + (i / 6) * (Math.PI / 2); plate.push(M(cx - hw + r + Math.cos(a) * r, top + r + Math.sin(a) * r)); }
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); plate.push(M(cx + hw - r + Math.cos(a) * r, top + r + Math.sin(a) * r)); }
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); plate.push(M(cx + hw - r + Math.cos(a) * r, bot - r + Math.sin(a) * r)); }
    for (let i = 0; i <= 6; i++) { const a = Math.PI / 2 + (i / 6) * (Math.PI / 2); plate.push(M(cx - hw + r + Math.cos(a) * r, bot - r + Math.sin(a) * r)); }
    // 底板在门上的影子
    ctx.save();
    ctx.fillStyle = 'rgba(20,8,16,0.35)';
    polyPath(ctx, plate.map((q) => [q[0] + 4 * k * sx, q[1] + 6 * k]));
    ctx.fill();
    ctx.restore();
    g.poly(plate, { color: P.ink, width: 3.4 * lw, fill: K.brass, seed: 300 });
    g.line(...M(cx - 8, top + 14), ...M(cx - 8, bot - 16), { color: K.brassHi, width: 3 * lw, alpha: 0.85, seed: 301 });
    g.line(...M(cx + 9, top + 18), ...M(cx + 9, bot - 14), { color: K.brassLo, width: 2.6 * lw, alpha: 0.7, seed: 302 });
    // 螺丝
    [[cx, 356], [cx, 454]].forEach(([u, v], i) => {
      const q = M(u, v);
      g.ellipse(q[0], q[1], 4.2 * k * sx, 4.2 * k, { color: P.ink, width: 1.6 * lw, fill: K.brassLo, seed: 303 + i });
      g.line(q[0] - 3 * k * sx, q[1] - 1 * k, q[0] + 3 * k * sx, q[1] + 1 * k, { color: P.ink, width: 1.4 * lw, seed: 305 + i });
    });
    // 锁眼
    {
      const kc = M(cx, 432);
      const hole = [];
      for (let i = 0; i <= 14; i++) { const a = Math.PI / 2 + 0.5 + (i / 14) * (Math.PI * 2 - 1.0); hole.push(M(cx + Math.cos(a) * 6.5, 429 + Math.sin(a) * 6.5)); }
      hole.push(M(cx + 4.6, 450), M(cx - 4.6, 450));
      const kl = light * (1 - keyDim);
      g.poly(hole, { color: P.ink, width: 2 * lw, fill: mix('#1b1624', K.inA, kl), seed: 307 });
      if (kl > 0.02) g.glow(kc[0], kc[1] + 6 * k, 34 * k, P.warm, 0.55 * kl);
    }
    // 压杆（lever > 0：往下压）
    const a = lever, piv = [cx, 386];
    const L = 86, ca = Math.cos(a), sa = Math.sin(a);
    const at = (d, w) => M(piv[0] - d * ca + w * sa, piv[1] + d * sa + w * ca);
    // 压杆的影子
    {
      const sh = [at(0, -8), at(L, -9), at(L, 9), at(0, 8)].map((q) => [q[0] + 5 * k * sx, q[1] + 9 * k]);
      ctx.save();
      ctx.fillStyle = 'rgba(20,8,16,0.32)';
      polyPath(ctx, sh);
      ctx.fill();
      ctx.restore();
    }
    const bar = [];
    bar.push(at(0, -7.5));
    for (let i = 0; i <= 4; i++) bar.push(at((L * i) / 4, -7.5 - (i / 4) * 1.5));
    for (let i = 0; i <= 8; i++) { const an = -Math.PI / 2 + (i / 8) * Math.PI; bar.push(at(L + Math.cos(an) * 4, Math.sin(an) * 9)); }
    for (let i = 4; i >= 0; i--) bar.push(at((L * i) / 4, 7.5 + (i / 4) * 1.5));
    g.poly(bar, { color: P.ink, width: 3.2 * lw, fill: K.brass, seed: 310 });
    g.line(...at(10, -3.5), ...at(L - 6, -4.5), { color: K.brassHi, width: 2.8 * lw, alpha: 0.9, seed: 311 });
    g.line(...at(14, 5), ...at(L - 4, 6), { color: K.brassLo, width: 2.4 * lw, alpha: 0.6, seed: 312 });
    // 转轴圆盘
    const pv = M(piv[0], piv[1]);
    g.ellipse(pv[0], pv[1], 18 * k * sx, 18 * k, { color: P.ink, width: 3 * lw, fill: K.brass, seed: 313 });
    g.arc(pv[0], pv[1], 11 * k * Math.max(0.4, sx), Math.PI * 1.05, Math.PI * 1.6, { color: K.brassHi, width: 2.6 * lw, seed: 314 });
  }

  function lantern(g, x, y, k, lw) {
    const s = k;
    g.poly([[x + 36 * s, y - 92 * s], [x + 50 * s, y - 92 * s], [x + 50 * s, y - 40 * s], [x + 36 * s, y - 40 * s]], { color: P.ink, width: 3 * lw, fill: '#2b2840', seed: 320 });
    g.line(x + 38 * s, y - 70 * s, x + 2 * s, y - 70 * s, { color: P.ink, width: 4.5 * lw, seed: 321 });
    g.line(x + 2 * s, y - 70 * s, x, y - 52 * s, { color: P.ink, width: 3.5 * lw, seed: 322 });
    g.poly([[x - 26 * s, y - 44 * s], [x + 26 * s, y - 44 * s], [x + 21 * s, y + 38 * s], [x - 21 * s, y + 38 * s]], { color: P.ink, width: 3.5 * lw, fill: '#34324f', seed: 323 });
    g.line(x - 12 * s, y - 34 * s, x - 9 * s, y + 24 * s, { color: 'rgba(200,210,255,0.35)', width: 3 * lw, seed: 324 });
    g.line(x, y - 44 * s, x, y + 38 * s, { color: P.ink, width: 2.4 * lw, seed: 325 });
    g.poly([[x - 36 * s, y - 42 * s], [x, y - 66 * s], [x + 36 * s, y - 42 * s]], { color: P.ink, width: 3.5 * lw, fill: '#2b2840', seed: 326 });
    g.path([[x - 38 * s, y - 42 * s], [x - 20 * s, y - 58 * s], [x, y - 70 * s], [x + 22 * s, y - 58 * s], [x + 38 * s, y - 40 * s]], { smooth: true, color: P.ink, width: 2.6 * lw, fill: K.snow, seed: 327 });
    g.poly([[x - 24 * s, y + 38 * s], [x + 24 * s, y + 38 * s], [x + 16 * s, y + 48 * s], [x - 16 * s, y + 48 * s]], { color: P.ink, width: 3 * lw, fill: '#2b2840', seed: 328 });
  }

  function pottedPine(g, x, y, k, lw) {
    const s = k;
    g.poly([[x - 48 * s, y - 74 * s], [x + 48 * s, y - 74 * s], [x + 36 * s, y], [x - 36 * s, y]], { color: P.ink, width: 3.5 * lw, fill: '#5a4258', seed: 330 });
    g.line(x - 46 * s, y - 60 * s, x + 46 * s, y - 60 * s, { color: rgba(P.ink, 0.6), width: 2.4 * lw, seed: 331 });
    g.line(x, y - 74 * s, x, y - 100 * s, { color: P.woodDark, width: 7 * lw, seed: 332 });
    [[0, 70, 92], [62, 56, 84], [116, 40, 74]].forEach(([dy, hw, h], i) => {
      const by = y - 92 * s - dy * s;
      g.poly([[x - hw * s, by], [x, by - h * s], [x + hw * s, by]], { color: P.ink, width: 3 * lw, fill: '#2c4a50', seed: 333 + i });
      g.path([[x - hw * 0.55 * s, by - h * 0.45 * s], [x, by - h * s - 3 * s], [x + hw * 0.6 * s, by - h * 0.42 * s], [x + hw * 0.2 * s, by - h * 0.36 * s], [x - hw * 0.2 * s, by - h * 0.4 * s]], { closed: true, smooth: true, color: P.ink, width: 2.2 * lw, fill: K.snow, seed: 337 + i });
    });
  }

  // ------------------------------------------------------------------ 小黑猫
  /** 正面（坐着 / 往镜头走）。(x,y) 脚底中心，s=1 时坐高约 150px。
   *  o = {blink, walk(相位), tail(相位), sil(0..1 逆光剪影), look, tilt} */
  function catFront(g, x, y, s, o = {}) {
    const ctx = g.ctx;
    const sil = o.sil || 0;
    const body = mix(K.cat, '#17131f', sil), white = mix(K.catW, '#2c2738', sil);
    const ink = P.ink;
    const wk = o.walk;
    const bob = wk == null ? 0 : Math.abs(Math.sin(wk)) * 4;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    if (sil > 0) g.glow(0, -80, 120, P.glow, 0.35 * sil);
    // 尾巴
    const sw = Math.sin(o.tail || 0);
    const tail = [[30, -10], [58, -14 + sw * 3], [72, -42], [62 + sw * 12, -72], [50 + sw * 14, -80]];
    g.curve(tail, { color: ink, width: 16, jitter: 0.8, taperLen: 10, seed: 501 });
    g.curve(tail, { color: body, width: 9.5, jitter: 0.8, taperLen: 10, seed: 502 });
    // 身体
    const by = wk == null ? 1 : 0.9;
    g.path([[-40, 0], [-46, -34 * by], [-34, -66 * by], [-16, -80 * by], [16, -80 * by], [34, -66 * by], [46, -34 * by], [40, 0]], { closed: true, smooth: true, color: ink, width: 3.4, fill: body, seed: 503 });
    g.fill([[-17, -74 * by], [-12, -50 * by], [0, -32 * by], [12, -50 * by], [17, -74 * by], [0, -84 * by]].map((q) => q), white, { seed: 504 });
    // 前腿
    const lift = (side) => (wk == null ? 0 : Math.max(0, Math.sin(wk) * side) * 13);
    [-1, 1].forEach((side, i) => {
      const lx = side * 15, ly = -4 - lift(side);
      g.line(lx, -46, lx, ly, { color: ink, width: 18, taper: false, jitter: 0.8, seed: 505 + i });
      g.line(lx, -44, lx, ly, { color: body, width: 11.5, taper: false, jitter: 0.6, seed: 507 + i });
      g.ellipse(lx, ly, 11, 7.5, { color: ink, width: 2.4, fill: white, seed: 509 + i });
    });
    // 头
    ctx.save();
    ctx.translate(0, -104 - bob);
    ctx.rotate(o.tilt || 0);
    ctx.translate(0, 104);
    const hy = -104;
    [-1, 1].forEach((side, i) => {
      g.poly([[side * 40, hy - 12], [side * 36, hy - 50], [side * 12, hy - 30]], { color: ink, width: 3.2, fill: body, seed: 511 + i });
      g.fill([[side * 34, hy - 18], [side * 32, hy - 40], [side * 18, hy - 29]], rgba(P.pink, 0.75 - sil * 0.6), { seed: 513 + i });
    });
    g.ellipse(0, hy, 43, 35, { color: ink, width: 3.4, fill: body, seed: 515 });
    g.ellipse(0, hy + 13, 18, 12.5, { fill: white, stroke: false, seed: 516 });
    g.fill([[-5, hy + 2], [0, hy - 24], [5, hy + 2]], white, { seed: 517 });
    const bl = clamp(o.blink || 0), look = (o.look || 0) * 3;
    [-1, 1].forEach((side, i) => {
      const ex = side * 16, ey = hy - 3;
      if (sil > 0) g.glow(ex, ey, 26, K.catEye, 0.55 * sil);
      if (bl < 0.6) {
        g.ellipse(ex, ey, 10, Math.max(1.5, 11 * (1 - bl)), { color: ink, width: 2.4, fill: K.catEye, seed: 518 + i });
        g.line(ex + look, ey - 7 * (1 - bl), ex + look, ey + 7 * (1 - bl), { color: ink, width: 4.4, taper: false, jitter: 0.5, seed: 520 + i });
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex + 3.5, ey - 4, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        g.arc(ex, ey - 3, 8, 0.35, Math.PI - 0.35, { color: ink, width: 3, seed: 522 + i });
      }
    });
    g.poly([[-4.5, hy + 8], [4.5, hy + 8], [0, hy + 13]], { color: ink, width: 1.6, fill: P.pink, seed: 524 });
    g.arc(-4, hy + 15, 4, 0.2, Math.PI - 0.2, { color: ink, width: 1.8, seed: 525 });
    g.arc(4, hy + 15, 4, 0.2, Math.PI - 0.2, { color: ink, width: 1.8, seed: 526 });
    [-1, 1].forEach((side, i) => {
      for (let j = 0; j < 3; j++) g.line(side * 22, hy + 10 + j * 4, side * (58 + j * 2), hy + 2 + j * 9, { color: mix('#d7dbee', '#6a6280', sil), width: 1.6, alpha: 0.85, seed: 527 + i * 3 + j });
    });
    ctx.restore();
    ctx.restore();
  }

  /** 侧面（走 / 跑）。(x,y) 脚底中心，dir = 1 朝右；s=1 时身长约 120px */
  function catSide(g, x, y, s, dir, o = {}) {
    const ctx = g.ctx;
    const ph = o.phase || 0, run = !!o.run;
    const body = K.cat, ink = P.ink;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir * s, s);
    const bob = run ? Math.sin(ph * 2) * 4 : Math.abs(Math.sin(ph)) * 2;
    ctx.translate(0, -bob);
    const amp = run ? 0.85 : 0.5;
    const leg = (hx, off, far) => {
      const an = Math.sin(ph + off) * amp;
      const L = 33;
      const fx = hx + Math.sin(an) * L, fy = -36 + Math.cos(an) * L + bob;
      g.line(hx, -40, fx, fy, { color: ink, width: 13, taper: false, jitter: 0.7, seed: 540 + off * 10 });
      g.line(hx, -40, fx, fy, { color: far ? K.catLo : body, width: 7.5, taper: false, jitter: 0.5, seed: 541 + off * 10 });
      g.ellipse(fx + 2, fy, 6.5, 4.5, { color: ink, width: 1.8, fill: far ? '#c9cbe0' : K.catW, seed: 542 + off * 10 });
    };
    leg(-24, Math.PI + 0.5, true);
    leg(30, 0.5, true);
    // 尾巴
    const sw = Math.sin(ph * 0.5) * 6;
    const tail = run ? [[-44, -48], [-74, -58 + sw * 0.5], [-102, -56 + sw]] : [[-44, -48], [-66, -62], [-70, -90 + sw], [-56, -104 + sw]];
    g.curve(tail, { color: ink, width: 14, jitter: 0.8, taperLen: 8, seed: 550 });
    g.curve(tail, { color: body, width: 8.5, jitter: 0.6, taperLen: 8, seed: 551 });
    g.ellipse(0, -44, run ? 52 : 48, run ? 19 : 21, { color: ink, width: 3.2, fill: body, seed: 552 });
    leg(-30, Math.PI, false);
    leg(24, 0, false);
    g.ellipse(34, -40, 12, 13, { fill: K.catW, stroke: false, seed: 553 });
    // 头
    const hx = 50, hy = -66;
    g.poly([[hx - 16, hy - 12], [hx - 12, hy - 36], [hx + 2, hy - 18]], { color: ink, width: 2.8, fill: body, seed: 554 });
    g.poly([[hx + 4, hy - 18], [hx + 14, hy - 36], [hx + 20, hy - 10]], { color: ink, width: 2.8, fill: body, seed: 555 });
    g.circle(hx, hy, 22, { color: ink, width: 3.2, fill: body, seed: 556 });
    g.ellipse(hx + 14, hy + 10, 10, 7, { fill: K.catW, stroke: false, seed: 557 });
    g.ellipse(hx + 9, hy - 3, 5, 6, { color: ink, width: 1.8, fill: K.catEye, seed: 558 });
    g.line(hx + 10, hy - 7, hx + 10, hy + 1, { color: ink, width: 2.6, taper: false, jitter: 0.4, seed: 559 });
    g.poly([[hx + 20, hy + 3], [hx + 24, hy + 2], [hx + 22, hy + 6]], { color: ink, width: 1.2, fill: P.pink, seed: 560 });
    for (let j = 0; j < 2; j++) g.line(hx + 16, hy + 8 + j * 4, hx + 42, hy + 4 + j * 8, { color: '#d7dbee', width: 1.4, alpha: 0.8, seed: 561 + j });
    ctx.restore();
  }

  // ------------------------------------------------------------------ 院子（反打镜头的背景）
  function smallPine(g, x, y, h, fill, snowCol, seed) {
    for (let k = 0; k < 3; k++) {
      const by = y - k * h * 0.27, hw = h * 0.3 * (1 - k * 0.22), ht = h * 0.46;
      g.poly([[x - hw, by], [x, by - ht], [x + hw, by]], { color: rgba(P.ink, 0.7), width: 2.4, fill, seed: seed + k });
      g.path([[x - hw * 0.45, by - ht * 0.5], [x, by - ht - 2], [x + hw * 0.5, by - ht * 0.46], [x + hw * 0.1, by - ht * 0.4]], { closed: true, smooth: true, color: rgba(P.ink, 0.5), width: 1.8, fill: snowCol, seed: seed + 5 + k });
    }
  }

  function yard(g, t, o = {}) {
    const ctx = g.ctx;
    const cold = o.cold || 0;
    const ck = cold > 0.5 ? 1 : 0;
    vband(g, 'sky' + ck, [[0, ck ? '#0d1124' : '#141a35'], [0.5, ck ? '#181f3e' : '#222b55'], [0.62, ck ? '#2b3565' : '#3e4a80'], [1, ck ? '#2b3565' : '#3e4a80']], -40, -40, W + 80, H + 80);
    // 星星
    ctx.save();
    for (let i = 0; i < 46; i++) {
      const x = rand(i, 61) * W, y = rand(i, 62) * 560;
      const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * (1.2 + rand(i, 63) * 2) + i * 2.3));
      ctx.globalAlpha = tw * (0.5 + rand(i, 64) * 0.5);
      ctx.fillStyle = '#eef0ff';
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + rand(i, 65) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    C.moon(g, 310, 170, 50, { phase: 0.42, seed: 3 });
    // 远山
    g.path([[-60, 660], [-60, 600], [220, 572], [520, 600], [820, 560], [1180, 596], [1500, 556], [1760, 590], [1990, 570], [1990, 660]], { closed: true, smooth: true, color: rgba(P.ink, 0.5), width: 2.6, fill: mix('#4a5788', '#36406c', cold), seed: 700 });
    // 远处一排小松树
    for (let i = 0; i < 11; i++) {
      const x = 60 + i * 178 + (rand(i, 71) - 0.5) * 70;
      smallPine(g, x, 640 + rand(i, 72) * 10, 80 + rand(i, 73) * 70, mix('#253054', '#1c2546', cold), mix('#8f9ccc', '#7381b2', cold), 710 + i * 10);
    }
    // 雪地
    C.ground(g, 652, { seed: 9, amp: 10, color: mix('#9eabd6', '#8593c2', cold), width: 3.6 });
    // 栅栏
    const fy = 704;
    g.line(-20, fy - 24, W + 20, fy - 30, { color: P.ink, width: 3.5, step: 12, seed: 760 });
    g.line(-20, fy + 8, W + 20, fy + 4, { color: P.ink, width: 3.5, step: 12, seed: 761 });
    for (let i = 0; i < 30; i++) {
      const x = -10 + i * 68 + (rand(i, 81) - 0.5) * 6;
      const h = 74 + rand(i, 82) * 8;
      const pk = [[x - 12, fy + 26], [x - 12, fy - h + 14], [x, fy - h], [x + 12, fy - h + 14], [x + 12, fy + 26]];
      g.poly(pk, { color: P.ink, width: 3, fill: mix('#5d5980', '#4b4870', cold), seed: 770 + i, step: 8 });
      g.ellipse(x, fy - h + 4, 14, 6.5, { color: rgba(P.ink, 0.8), width: 2, fill: K.snow, seed: 800 + i });
    }
    // 栅栏脚下的雪堆 + 近处地面渐变
    g.path([[-40, 740], [200, 718], [600, 728], [1000, 716], [1400, 726], [1960, 714], [1960, 760], [-40, 760]], { closed: true, smooth: true, color: rgba(P.ink, 0.6), width: 3, fill: mix('#aab6de', '#93a1cd', cold), seed: 840 });
    vband(g, 'yg' + ck, [[0, ck ? '#8f9dca' : '#a9b5de'], [1, ck ? '#b7c2e2' : '#d2daf0']], -40, 750, W + 80, 400);
    g.line(-20, 752, W + 20, 748, { color: rgba(P.ink, 0.25), width: 2.4, step: 14, seed: 841 });
  }

  // ------------------------------------------------------------------ 雪人帽顶的积雪（复刻 C.snowman 里帽子的变换：melt=0、不发抖）
  function hatXf(x, y, s, look) {
    const a1 = look * 0.06, a2 = -0.12;
    const c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a2), s2 = Math.sin(a2);
    return (px, py) => {
      let qx = px * c2 - py * s2, qy = px * s2 + py * c2;
      qx += -6 * s; qy += -80 * s * 0.86;
      return [x + qx * c1 - qy * s1, y - 288.4 * s + qx * s1 + qy * c1];
    };
  }

  /** slide：0 = 好好地堆在帽顶；0..0.35 往左滑；0.35..0.8 掉下去；≥0.8 落地"噗" */
  function hatSnow(g, x, y, s, look, slide, o = {}) {
    const ctx = g.ctx;
    const ink = o.ink || P.ink;
    const h = 30 * s;
    const pile = [[-47 * s, -76 * s], [-36 * s, -80 * s - h * 0.75], [-12 * s, -80 * s - h], [16 * s, -81 * s - h * 0.92], [38 * s, -81 * s - h * 0.6], [49 * s, -78 * s], [0, -74 * s]];
    const fallAt = 0.35, landAt = 0.8;
    // 帽檐两边的一点点雪（不会掉）
    const xf = hatXf(x, y, s, look);
    const brim = (pts, seed) => g.path(pts.map((q) => xf(q[0] * s, q[1] * s)), { closed: true, smooth: true, color: ink, width: 2.4 * s, fill: P.snow, seed });
    brim([[-72, -2], [-64, -12], [-50, -13], [-46, -5]], 902);
    brim([[47, -5], [52, -14], [64, -12], [72, -2]], 903);
    if (slide < fallAt) {
      const u = ease.in(slide / fallAt);
      const dx = -u * 46 * s, rot = -u * 0.35;
      const pts = pile.map(([px, py]) => {
        const rx = px * Math.cos(rot) - (py + 78 * s) * Math.sin(rot), ry = px * Math.sin(rot) + (py + 78 * s) * Math.cos(rot) - 78 * s;
        return xf(rx + dx, ry);
      });
      g.path(pts, { closed: true, smooth: true, color: ink, width: 3 * s, fill: P.snow, seed: 901 });
      return null;
    }
    const start = xf(-60 * s, -96 * s);
    const end = [x - 168 * s, y - 8 * s];
    if (slide < landAt) {
      const u = (slide - fallAt) / (landAt - fallAt);
      const px = lerp(start[0], end[0], u * 0.9 + 0.1 * u * u), py = start[1] + (end[1] - start[1]) * u * u;
      const r = 1 + u * 0.4;
      // 一大块 + 两小块，越掉越散
      [[0, 0, 40, 18, 0], [-30, -12, 14, 10, 1], [26, -20, 12, 9, 2]].forEach(([ox, oy, rx, ry, i]) => {
        const sp = u * (i ? 1.6 : 0);
        g.ellipse(px + ox * s * (1 + sp), py + oy * s * (1 + sp) - u * 10 * s * i, rx * s * r * (i ? 0.9 : 1), ry * s * r, { color: ink, width: 2.6 * s, fill: P.snow, rot: -0.4 - u * 2 * (i ? -1 : 1), seed: 905 + i });
      });
      return null;
    }
    // 落地：一小堆雪 + 雪沫
    const u = clamp((slide - landAt) / (1 - landAt));
    g.path([[end[0] - 56 * s, end[1] + 8 * s], [end[0] - 36 * s, end[1] - 14 * s], [end[0] - 6 * s, end[1] - 22 * s], [end[0] + 26 * s, end[1] - 14 * s], [end[0] + 54 * s, end[1] + 8 * s]], { closed: true, smooth: true, color: ink, width: 2.8 * s, fill: P.snow, seed: 910 });
    if (u < 1) {
      ctx.save();
      ctx.globalAlpha *= 1 - u;
      for (let i = 0; i < 9; i++) {
        const an = -Math.PI + (i / 8) * Math.PI + (rand(i, 7) - 0.5) * 0.3;
        const d = ease.outCubic(u) * (60 + rand(i, 8) * 50) * s;
        const rr = (6 + rand(i, 9) * 8) * s * (1 - u * 0.5);
        g.circle(end[0] + Math.cos(an) * d * 1.3, end[1] - 10 * s + Math.sin(an) * d * 0.7, rr, { color: rgba(ink, 0.6), width: 1.8 * s, fill: '#ffffff', seed: 920 + i });
      }
      ctx.restore();
    }
    return end;
  }

  // ------------------------------------------------------------------ 镜头 1：主观·门
  /** 主观镜头里自己的胡萝卜鼻尖（从画面右下角伸进来，虚焦） */
  function noseTip(g, t, a) {
    if (a <= 0.01) return;
    const ctx = g.ctx;
    const bx = 1370 + noise1(t * 0.5, 31) * 6, by = 1130 + noise1(t * 0.4, 32) * 5;
    const tip = [bx - 120, by - 230];
    ctx.save();
    ctx.globalAlpha *= a;
    g.poly([[bx - 120, by + 20], tip, [bx + 110, by + 30]], { color: rgba(P.ink, 0.85), width: 7, fill: mix(P.carrot, '#5a3048', 0.35), seed: 36 });
    g.line(lerp(bx - 60, tip[0], 0.35) - 40, lerp(by, tip[1], 0.35), lerp(bx - 60, tip[0], 0.35) + 30, lerp(by, tip[1], 0.35) + 8, { color: rgba('#8a3d22', 0.8), width: 5, seed: 37 });
    g.line(lerp(bx - 60, tip[0], 0.62) - 22, lerp(by, tip[1], 0.62), lerp(bx - 60, tip[0], 0.62) + 16, lerp(by, tip[1], 0.62) + 5, { color: rgba('#8a3d22', 0.8), width: 4, seed: 38 });
    g.line(tip[0] + 8, tip[1] + 30, tip[0] + 2, tip[1] + 8, { color: rgba(P.glow, 0.85), width: 4, seed: 39 });
    ctx.restore();
  }

  function shotPov(g, p, t) {
    const c = seg(p, 0, SH.feet);
    const z = ease.inOut(c);
    const k = lerp(1.0, 1.1, z);
    const dx = noise1(t * 0.35, 11) * 7, dy = noise1(t * 0.3, 12) * 4;
    const F = frameAt(200, 450, 960 + dx, 520 + dy, k);
    // 屋里的光轻轻晃（像电视或者炉火）
    const light = 0.84 + 0.14 * (0.5 + 0.5 * noise1(t * 1.6, 3));
    const D = facade(g, F, { t, light, win: 0.7 });
    snowfall(g, t, { count: 120 });
    noseTip(g, t, 1);
    vignette(g, 0.6);
    // 毛笔「门」
    const tp = seg(c, 0.26, 0.34);
    g.text('门', 330, 390, { size: 300, font: 'brush', color: '#f3efff', progress: tp, shadow: { color: rgba(K.dark, 0.55), dx: 8, dy: 10 } });
    if (tp >= 1) g.line(220, 560, 450, 552, { color: rgba(P.glow, 0.9), width: 7, progress: seg(c, 0.34, 0.42), seed: 31 });
    // 箭头「还亮着」
    const gy = D.Y(756);
    const ap = seg(c, 0.5, 0.62);
    arrow(g, [[1352, gy - 96], [1296, gy - 74], [1226, gy - 26]], { color: P.glow, width: 5, progress: ap, seed: 33, head: 22 });
    say(g, '还亮着', 1440, gy - 128, { size: 72, color: P.glow, progress: seg(c, 0.44, 0.56) });
    // 睁眼 + 眨一下
    const open = c < 0.03 ? 1 : 1 - ease.out(seg(c, 0.03, 0.13));
    const blink = Math.sin(Math.PI * seg(c, 0.17, 0.22));
    lids(g, Math.max(open, blink * 0.95));
  }

  // ------------------------------------------------------------------ 镜头 2a：贴地看门缝，有影子走过
  function shotFeet(g, p, t) {
    const c = seg(p, SH.feet, SH.knob);
    const k = lerp(2.9, 3.15, ease.inOut(c));
    const F = frameAt(200, 760, 960, 600, k);
    const stp = (c0, c1, a, b) => lerp(a, b, ease.inOut(seg(c, c0, c1)));
    const moving = (c0, c1) => c > c0 && c < c1;
    const uA = c < 0.4 ? stp(0.08, 0.18, -60, 50) : stp(0.5, 0.6, 50, 180);
    const uB = c < 0.62 ? stp(0.28, 0.38, -30, 110) : stp(0.66, 0.76, 110, 226);
    const paws = [
      { u: uA, w: 30, a: moving(0.08, 0.18) || moving(0.5, 0.6) ? 0.45 : 1 },
      { u: uB, w: 30, a: moving(0.28, 0.38) || moving(0.66, 0.76) ? 0.45 : 1 },
    ];
    const D = facade(g, F, { t, light: 0.95, paws });
    snowfall(g, t, { count: 90, bokeh: 9 });
    vignette(g, 0.5);
    // 嗒 嗒 嗒 嗒
    [[0.18, 50, 84], [0.38, 110, 98], [0.6, 180, 112], [0.76, 226, 130]].forEach(([c0, u, size], i) => {
      const tp = seg(c, c0, c0 + 0.05);
      if (tp <= 0) return;
      say(g, '嗒', D.X(u) + (i % 2 ? 20 : -20), D.Y(SLAB_B) - 150 - i * 34, { size, font: 'brush', color: P.glow, progress: tp, rot: i % 2 ? 0.14 : -0.14, seed: 40 + i });
    });
    if (c > 0.84) say(g, '？', D.X(330), D.Y(SLAB_B) - 330, { size: 120, font: 'brush', color: '#f3efff', progress: seg(c, 0.84, 0.9) });
  }

  // ------------------------------------------------------------------ 镜头 2b：门把手特写
  function shotKnob(g, p, t) {
    const c = seg(p, SH.knob, SH.eyes);
    const k = lerp(5.0, 5.35, c);
    const lever = 0.42 * dip(c, 0.2, 0.3, 0.46) + 0.22 * dip(c, 0.6, 0.66, 0.8);
    const lv = (cc) => 0.42 * dip(cc, 0.2, 0.3, 0.46) + 0.22 * dip(cc, 0.6, 0.66, 0.8);
    const speed = Math.abs(lv(c + 0.01) - lv(c - 0.01)) / 0.02;
    const sh = g.shake(Math.min(10, speed * 1.4));
    const F = frameAt(300, 400, 1010 + sh[0], 560 + sh[1], k);
    const keyDim = seg(c, 0.42, 0.48) * (1 - seg(c, 0.54, 0.6));
    const D = facade(g, F, { t, light: 1, lever, keyDim });
    // 动作线
    if (speed > 0.6) {
      const pv = D.sp(338, 386);
      const R = 98 * k;
      const dir = lv(c + 0.01) > lv(c - 0.01) ? 1 : -1;
      for (let i = 0; i < 3; i++) {
        const rr = R * (0.82 + i * 0.13);
        const a1 = Math.PI - lever, a0 = a1 - dir * (0.18 + 0.06 * i);
        g.arc(pv[0], pv[1], rr, Math.min(a0, a1), Math.max(a0, a1), { color: '#f7f2ff', width: 5, alpha: 0.85, seed: 60 + i });
      }
    }
    snowfall(g, t, { count: 50, bokeh: 6 });
    vignette(g, 0.45);
    if (c > 0.22) say(g, '咔', 560, 300, { size: 150, font: 'brush', color: P.glow, progress: seg(c, 0.22, 0.27), rot: -0.15, seed: 70 });
    if (c > 0.62) say(g, '咔哒', 1500, 210, { size: 110, font: 'brush', color: '#f7f2ff', progress: seg(c, 0.62, 0.7), rot: 0.1, seed: 71 });
  }

  // ------------------------------------------------------------------ 镜头 2c：雪人的脸 + 集中线
  function shotEyes(g, p, t) {
    const c = seg(p, SH.eyes, SH.open);
    const ctx = g.ctx;
    g.bg(['#151a35', '#1d2447', '#2a2f52']);
    const sh = g.shake(c < 0.3 ? 3 : 7);
    const s = 2.75, hx = 960 + sh[0], hy = 540 + sh[1];
    const x = hx, y = hy + 288.4 * s;
    focusLines(g, hx, hy - 10, 500, 380, 110, '#eef0ff', 0.75, 3);
    ovalGlow(g, 960, 1120, 900, 420, P.warm, 0.4);
    const z = lerp(1, 1.08, ease.out(c));
    g.save();
    g.camera(hx, hy, z, 0, hx - 960, hy - 540);
    C.snowman(g, x, y, s, { mood: 'hope', blush: 0.95, look: 0, lookUp: 0.05, seed: 7, wind: 0.1 });
    hatSnow(g, x, y, s, 0, 0);
    // 下面来的暖光（门缝的光照在脸上）
    g.glow(x, hy + 280, 520, P.warm, 0.22);
    // 眼睛瞪圆：白眼圈 + 小瞳孔
    const pop = ease.outBack(seg(c, 0.28, 0.42));
    if (pop > 0) {
      const R = 80 * s, eyeY = hy - R * 0.12;
      [-1, 1].forEach((side, i) => {
        const ex = hx + side * R * 0.32;
        g.circle(ex, eyeY, 24 * s * pop, { color: P.ink, width: 4.5, fill: '#ffffff', seed: 80 + i });
        C.dot(g, ex, eyeY + 2, 7 * s * pop, P.ink, 82 + i);
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex + 4 * s, eyeY - 3 * s, 2.4 * s * pop, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }
    g.restore();
    say(g, '！', 1440, 300, { size: 340, font: 'round', color: P.glow, progress: seg(c, 0.3, 0.38), rot: 0.14, seed: 90, stroke: rgba(K.dark, 0.85), strokeWidth: 26 });
    say(g, '！', 1590, 250, { size: 200, font: 'round', color: P.glow, progress: seg(c, 0.36, 0.44), rot: 0.3, seed: 91, stroke: rgba(K.dark, 0.85), strokeWidth: 18 });
    vignette(g, 0.4);
  }

  // ------------------------------------------------------------------ 镜头 3a：门开了一条缝
  function shotOpen(g, p, t) {
    const c = seg(p, SH.open, SH.lit);
    const k = lerp(1.04, 1.16, ease.inOut(c));
    const o1 = seg(c, 0.1, 0.24), o2 = seg(c, 0.3, 0.6);
    const open = 0.22 * ease.outCubic(o1) + 0.4 * ease.inOut(o2);
    const opening = (c > 0.1 && c < 0.24) || (c > 0.3 && c < 0.6);
    const sh = g.shake(opening ? 2.5 : 0.6);
    const F = frameAt(320, 450, 1000 + sh[0], 520 + sh[1], k);
    const D = facade(g, F, { t, light: 1, open, win: 0.9 });
    const cx = D.X((D.xe + 400) / 2);
    const beam = [[cx - 260, -50], [cx + 260, -50], [cx + 520, H + 50], [cx - 520, H + 50]];
    snowfall(g, t, { count: 120, beam, beamA: Math.min(1, open * 2.2) });
    vignette(g, 0.5);
    say(g, '开…开了！', 430, 300, { size: 112, color: P.glow, progress: seg(c, 0.34, 0.66), rot: -0.06, seed: 95 });
  }

  // ------------------------------------------------------------------ 镜头 3b：反打·一道光照在雪人身上
  // 反打镜头：同一个院子、同一个雪人（世界坐标），镜头推近一点
  const SM = { x: 960, y: 930, s: 1.05 };
  const CAM = { cx: 960, cy: 600, z: 1.36 };
  const toScr = (z) => (q) => [W / 2 + (q[0] - CAM.cx) * z, H / 2 + (q[1] - CAM.cy) * z];

  function shotLit(g, p, t) {
    const c = seg(p, SH.lit, SH.cat);
    const ctx = g.ctx;
    const z = CAM.z * lerp(1, 1.06, ease.inOut(c));
    const bw = lerp(0.45, 1, ease.outCubic(seg(c, 0, 0.3)));
    const top = 655, wT = 150 * bw, wB = 470 * bw;
    const band = (f) => [[960 - wT * f, top], [960 + wT * f, top], [960 + wB * f, 1260], [960 - wB * f, 1260]];
    g.save();
    g.camera(CAM.cx, CAM.cy, z);
    yard(g, t, { cold: 0 });
    // 地上那一道光（从门那边——镜头背后——照过来）
    [1.35, 1.12, 0.9].forEach((f, i) => gradPoly(g, band(f), 0, 1260, 0, top, [[0, rgba(P.glow, 0.22 + i * 0.08)], [1, rgba(P.glow, 0.04)]]));
    // 雪人的影子往后拖到栅栏上
    ctx.save();
    ctx.fillStyle = 'rgba(20,22,52,0.42)';
    ctx.beginPath();
    ctx.ellipse(966, 846, 124 * bw, 70, 0, 0, Math.PI * 2);
    ctx.ellipse(968, 752, 70 * bw, 36, 0, 0, Math.PI * 2);
    ctx.ellipse(972, 704, 44 * bw, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const arms = lerp(0.1, 0.62, ease.outBack(seg(c, 0.12, 0.42)));
    C.snowman(g, SM.x, SM.y, SM.s, { mood: 'hope', blush: 1, arms: [arms, arms], look: 0, lookUp: 0.12, seed: 7, wind: 0.15 });
    hatSnow(g, SM.x, SM.y, SM.s, 0, 0);
    // 光把雪人照暖
    g.glow(960, 690, 330, P.warm, 0.3);
    // 小红心：扑通扑通
    const hp = ease.outBack(seg(c, 0.3, 0.42));
    if (hp > 0) {
      const beat = Math.exp(-((t * 2.2) % 1) * 7);
      g.glow(1150, 470, 70 * hp, P.red, 0.25 * hp);
      C.heart(g, 1150, 470, 30 * hp * (1 + 0.16 * beat), { seed: 120, rot: 0.15 });
    }
    g.restore();
    // 光外面压暗（两层，边缘软一点）
    const S = toScr(z);
    [[1.7, 0.3], [1.15, 0.26]].forEach(([f, a]) => {
      ctx.save();
      ctx.fillStyle = rgba(K.dark, a);
      ctx.beginPath();
      ctx.rect(-20, -20, W + 40, H + 40);
      const b = band(f).map(S);
      ctx.moveTo(b[0][0], -20);
      ctx.lineTo(b[1][0], -20);
      ctx.lineTo(b[2][0], b[2][1]);
      ctx.lineTo(b[3][0], b[3][1]);
      ctx.closePath();
      ctx.fill('evenodd');
      ctx.restore();
    });
    const sb = band(1.3).map(S);
    snowfall(g, t, { count: 100, beam: [[sb[0][0], -20], [sb[1][0], -20], sb[2], sb[3]], beamA: 0.9 });
    vignette(g, 0.35);
    say(g, '是你吗', 1460, 230, { size: 80, vertical: true, color: P.glow, progress: seg(c, 0.4, 0.75), seed: 125 });
  }

  // ------------------------------------------------------------------ 镜头 4a：门缝里出来一只小猫
  function shotCat(g, p, t) {
    const c = seg(p, SH.cat, SH.slam);
    const ctx = g.ctx;
    const k = lerp(2.2, 2.32, c);
    const F = frameAt(360, 650, 1020, 540, k);
    const D = facade(g, F, { t, light: 1, open: 0.62, win: 0 });
    const gx = D.X((D.xe + 400) / 2), gy = D.Y(760);
    if (c < 0.34) {
      // 探头：在门缝里（被门板挡住一半）
      const u = ease.outCubic(seg(c, 0.04, 0.2));
      ctx.save();
      polyPath(ctx, [D.sp(400, 0), [D.X(400), D.Y(0)], [D.X(400), D.Y(760)], D.sp(400, SLAB_B)].concat([[D.X(D.xe), D.Y(760)]]));
      ctx.clip();
      catFront(g, lerp(gx - 140, gx - 6, u), gy - 6, 1.05, { sil: 0.85, blink: Math.sin(Math.PI * seg(c, 0.22, 0.28)), tail: t * 3, tilt: lerp(-0.25, 0.08, u) });
      ctx.restore();
      if (c > 0.1) say(g, '？', gx + 170, gy - 260, { size: 90, color: '#f3efff', progress: seg(c, 0.12, 0.17), seed: 131 });
    } else {
      const w = seg(c, 0.34, 0.66);
      const ew = ease.inOut(w);
      const cx = lerp(gx - 10, 900, ew), cy = lerp(gy + 4, 905, ew), cs = lerp(1.1, 1.65, ew);
      // 脚印
      ctx.save();
      ctx.fillStyle = 'rgba(70,64,110,0.35)';
      for (let i = 0; i < 6; i++) {
        const u = i / 6;
        if (u > ew - 0.06) break;
        const px = lerp(gx - 10, 900, u) + (i % 2 ? 14 : -14), py = lerp(gy + 4, 905, u) + 6;
        ctx.beginPath();
        ctx.ellipse(px, py, 9 * lerp(1, 1.5, u), 5 * lerp(1, 1.5, u), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // 猫的影子（被门缝的光往镜头这边拉长）
      gradPoly(g, [[cx - 34 * cs, cy], [cx + 34 * cs, cy], [cx + 60 * cs, cy + 150], [cx - 70 * cs, cy + 150]], 0, cy, 0, cy + 150, [[0, 'rgba(20,14,30,0.5)'], [1, 'rgba(20,14,30,0)']]);
      const sitting = w >= 1;
      catFront(g, cx, cy, cs, {
        walk: sitting ? null : t * 11, tail: t * 2.6, blink: Math.sin(Math.PI * seg(c, 0.86, 0.9)), tilt: sitting ? 0.12 * Math.sin(Math.PI * seg(c, 0.7, 0.95)) : 0,
        sil: lerp(0.5, 0, seg(w, 0, 0.5)),
      });
      if (c > 0.7) say(g, '喵～', cx - 250, cy - 300, { size: 104, color: '#f7f3ff', progress: seg(c, 0.7, 0.8), rot: -0.08, seed: 135 });
    }
    snowfall(g, t, { count: 90, bokeh: 8, beam: [[gx - 300, 0], [gx + 300, 0], [gx + 700, H], [gx - 700, H]], beamA: 0.8 });
    vignette(g, 0.5);
  }

  // ------------------------------------------------------------------ 镜头 4b：一阵风，门"砰"地关上，灯灭了
  function shotSlam(g, p, t) {
    const c = seg(p, SH.slam, SH.after);
    const ctx = g.ctx;
    const close = ease.inCubic(seg(c, 0.2, 0.4));
    const open = 0.62 * (1 - close);
    const hit = c >= 0.4 ? Math.exp(-(c - 0.4) * 28) : 0;
    const off = c >= 0.62 ? 1 : 0;
    const windA = clamp(seg(c, 0.02, 0.12) * (1 - seg(c, 0.5, 0.7)));
    const sh = g.shake(hit * 26 + windA * 2);
    const F = frameAt(300, 450, 980 + sh[0], 520 + sh[1], 1.06);
    const D = facade(g, F, { t, light: 1 - off, open, win: 0.9 * (1 - off), dim: off * lerp(0.6, 0.85, seg(c, 0.62, 0.8)) });
    // 跑开的猫（往左下 = 雪人那边）
    if (c < 0.3) {
      const u = ease.in(seg(c, 0.02, 0.28));
      catSide(g, lerp(D.X(330), -160, u), lerp(D.Y(800), 1010, u), lerp(0.75, 1.5, u), -1, { phase: t * 16, run: true });
    }
    // 关门时门框上震下来的雪
    if (c > 0.4) {
      const u = seg(c, 0.4, 0.75);
      for (let i = 0; i < 9; i++) {
        const x0 = D.X(-30 + rand(i, 5) * 460), y0 = D.Y(-46);
        const yy = y0 + ease.in(u) * (420 + rand(i, 6) * 300) * D.k;
        g.circle(x0 + Math.sin(u * 6 + i) * 10, yy, (4 + rand(i, 7) * 6) * D.k, { color: rgba(P.ink, 0.5), width: 1.6, fill: '#ffffff', alpha: 1 - u * 0.6, seed: 140 + i });
      }
    }
    // 风：横着走的雪 + 风线
    snowfall(g, t, { count: 130, wind: lerp(16, 900, windA), sway: lerp(22, 4, windA), bokeh: 7 });
    if (windA > 0.02) {
      ctx.save();
      ctx.strokeStyle = '#eef0ff';
      ctx.lineCap = 'round';
      for (let i = 0; i < 16; i++) {
        const y = 80 + rand(i, 41) * 860;
        const len = 160 + rand(i, 42) * 260;
        const x = (((rand(i, 43) * (W + 800) + t * 2600) % (W + 800)) + W + 800) % (W + 800) - 400;
        ctx.globalAlpha = windA * (0.25 + rand(i, 44) * 0.35);
        ctx.lineWidth = 2 + rand(i, 45) * 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + len * 0.5, y - 10 - rand(i, 46) * 16, x + len, y + 4);
        ctx.stroke();
      }
      ctx.restore();
      say(g, '呼——', 400, 250, { size: 150, font: 'brush', color: '#eef0ff', progress: seg(c, 0.06, 0.2), alpha: 1 - seg(c, 0.5, 0.62), rot: -0.06, seed: 150, spacing: 10 });
    }
    vignette(g, 0.55);
    if (c > 0.4) {
      const sc = 1 + hit * 0.25;
      ctx.save();
      ctx.translate(1340, 300);
      ctx.scale(sc, sc);
      say(g, '砰！', 0, 0, { size: 230, font: 'brush', color: '#f7f2ff', progress: seg(c, 0.4, 0.44), rot: 0.08, alpha: 1 - seg(c, 0.8, 0.95), seed: 155, stroke: rgba(K.dark, 0.8) });
      ctx.restore();
    }
    // 慢慢眨一下眼
    lids(g, Math.sin(Math.PI * seg(c, 0.82, 0.97)) * 0.9);
  }

  // ------------------------------------------------------------------ 镜头 5a：反打·猫跑过去，帽子上的雪"噗"
  function catPath(u) {
    const a = [1545, 952], b = [1236, 768], d = [300, 722];
    if (u < 0.4) { const v = u / 0.4; return [lerp(a[0], b[0], v), lerp(a[1], b[1], v), lerp(1.25, 0.62, v)]; }
    const v = (u - 0.4) / 0.6;
    return [lerp(b[0], d[0], v), lerp(b[1], d[1], v), lerp(0.62, 0.42, v)];
  }

  function shotAfter(g, p, t) {
    const c = seg(p, SH.after, SH.close);
    const ctx = g.ctx;
    const z = CAM.z * lerp(1.0, 1.05, ease.inOut(c));
    g.save();
    g.camera(CAM.cx, CAM.cy, z);
    yard(g, t, { cold: 1 });
    // 小猫：从镜头右下角跑进来，从雪人身后跑远
    const cu = seg(c, 0.03, 0.5);
    ctx.save();
    ctx.fillStyle = 'rgba(56,60,108,0.42)';
    for (let i = 0; i < 26; i++) {
      const u = i / 26;
      if (u > cu - 0.03) break;
      const q = catPath(u);
      ctx.beginPath();
      ctx.ellipse(q[0] + (i % 2 ? 7 : -7) * q[2], q[1] + 2, 8 * q[2], 4.5 * q[2], 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (cu > 0 && cu < 1) {
      const q = catPath(cu);
      catSide(g, q[0], q[1], q[2], -1, { phase: t * 16, run: true });
    }
    // 雪人：目光跟着猫，手慢慢放下，表情从期待变成没表情
    const look = c < 0.62 ? (cu <= 0 ? 0.3 : lerp(0.8, -0.75, ease.inOut(seg(cu, 0.05, 0.9)))) : lerp(-0.75, 0, ease.inOut(seg(c, 0.62, 0.8)));
    const arms = lerp(0.62, -0.04, ease.inOut(seg(c, 0.42, 0.62)));
    const slide = seg(c, 0.58, 0.84);
    const mood = c < 0.42 ? 'hope' : c < 0.84 ? 'calm' : 'sad';
    C.snowman(g, SM.x, SM.y, SM.s, { mood, blush: lerp(1, 0.4, seg(c, 0.4, 0.7)), arms: [arms, arms], look, seed: 7, wind: 0.2 });
    const land = hatSnow(g, SM.x, SM.y, SM.s, look, slide);
    g.restore();
    snowfall(g, t, { count: 110 });
    vignette(g, 0.45);
    if (land) say(g, '噗', 470, 640, { size: 230, font: 'brush', color: '#f7f2ff', progress: seg(c, 0.84, 0.88), rot: -0.14, seed: 160, stroke: rgba(K.dark, 0.75) });
  }

  // ------------------------------------------------------------------ 镜头 5b：脸部近景（接「梦」的开头）
  function shotClose(g, p, t) {
    const c = seg(p, SH.close, 1);
    g.bg([P.nightDeep, P.night, P.nightBlue]);
    const ctx = g.ctx;
    ctx.save();
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.7 + i * 1.9));
      ctx.fillStyle = '#eef0ff';
      ctx.beginPath();
      ctx.arc(rand(i, 171) * W, rand(i, 172) * 620, 1.2 + rand(i, 173) * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    g.save();
    const z = lerp(1.0, 1.04, ease.inOut(c));
    g.camera(960, 470, z, 0, 0, 0);
    C.ground(g, 880, { seed: 7, color: mix(P.snow, '#c9d3ea', 0.35) });
    C.snowman(g, 960, 1064, 2.2, {
      mood: 'sad', blush: 0.45,
      look: lerp(-0.1, 0.25, ease.inOut(seg(c, 0.3, 0.8))), lookUp: lerp(0, 0.2, ease.inOut(seg(c, 0.3, 0.8))),
      wind: 0.12, seed: 1,
    });
    // 叹一口气（一团白气）
    const bp = seg(c, 0.12, 0.6);
    if (bp > 0 && bp < 1) {
      const mx = 960 + 40, my = 1064 - 288.4 * 2.2 + 70;
      ctx.save();
      ctx.globalAlpha *= Math.sin(Math.PI * bp) * 0.8;
      g.circle(mx + lerp(20, 140, bp), my + lerp(10, -30, bp), lerp(14, 52, bp), { color: 'rgba(255,255,255,0.85)', width: 3, fill: 'rgba(255,255,255,0.45)', seed: 175 });
      ctx.restore();
    }
    g.restore();
    snowfall(g, t, { count: 80, bokeh: 6 });
    vignette(g, 0.4);
    say(g, '是猫啊', 1520, 200, { size: 62, vertical: true, color: '#e9ecfb', progress: seg(c, 0.25, 0.6), alpha: 0.95, seed: 180 });
  }

  // ------------------------------------------------------------------ 注册
  TG.scene({
    id: 'doorstep',
    title: '门前',
    dark: true,
    transition: 'black',
    chars: '门还亮着嗒咔哒开了是你吗喵呼砰噗猫啊！？…～—',
    lyrics: 'default',
    draw(g, p, t, info) {
      if (p < SH.feet) shotPov(g, p, t, info);
      else if (p < SH.knob) shotFeet(g, p, t, info);
      else if (p < SH.eyes) shotKnob(g, p, t, info);
      else if (p < SH.open) shotEyes(g, p, t, info);
      else if (p < SH.lit) shotOpen(g, p, t, info);
      else if (p < SH.cat) shotLit(g, p, t, info);
      else if (p < SH.slam) shotCat(g, p, t, info);
      else if (p < SH.after) shotSlam(g, p, t, info);
      else if (p < SH.close) shotAfter(g, p, t, info);
      else shotClose(g, p, t, info);
    },
  });
})();
