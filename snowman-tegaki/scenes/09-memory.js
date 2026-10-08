/* 场景：memory —— 间奏 · 回忆
 *
 * 镜头（按 p 分段）：
 *   S1 0.00–0.13  "你"举着拍立得对准雪人，脸藏在相机后面，镜头玻璃里倒映着雪人。「茄子～」→ 闪光「咔嚓！」→ 相纸从顶上吐出来
 *   S2 0.13–0.30  俯视雪地（窗光洒在雪上）：第一张拍立得晃悠悠落下 —— 12.1 初雪，两只红手套在滚雪球；旁边手写「这是我」
 *   S3 0.30–0.47  斜切分屏：左 12.3 插胡萝卜鼻子 / 右 12.24 平安夜系红围巾，一前一后落下
 *   S4 0.47–0.64  特写：12.25 合照（雪人和"你"的剪影），白笔在照片上写「你」「我」，页边画一颗心
 *   S5 0.64–0.79  拉远：照片已经堆成一小堆，最后一张 1.1 落在最上面：雪地里两串脚印一步一步出现
 *   S6 0.79–1.00  推近最后一张：雪从四边一点点把它盖住、褪色，只剩角上的「1.1」露在外面；
 *                 雪上被手指写出「我都记得」，窗光变暗，画面沉进夜色（接下一幕「门前」）
 *
 * 地面是俯视的夜里雪地，"你"家窗户的暖光斜照下来（几层平涂的光斑 + 窗棂十字影子）。
 * 性能：软件光栅下整屏渐变很贵，所以地面用纯色 + 平涂光斑、暗角只铺四条边，
 *       雪 / 星星 / 脚印都合并成少数几条路径一次 fill。
 */
(function () {
  'use strict';
  const { clamp, lerp, seg, ease, rand, noise1, mix, rgba } = TG.U;
  const P = TG.PAL, C = TG.C, W = TG.W, H = TG.H;

  const CUT = [0, 0.13, 0.30, 0.47, 0.64, 0.79, 1];
  const COAT = '#4a3436', SLEEVE = '#5b434b';
  const FRAME = '#fbf8f1';
  const PW = 500, PHh = 600;                    // 相纸尺寸（世界单位）
  const IMG = { x: -220, y: -270, w: 440, h: 440 }; // 相纸上的画面区（相纸局部坐标）
  const IMC = IMG.y + IMG.h / 2;                  // 画面区中心 y
  const DROP = 900;                               // 照片从多高落下

  // ------------------------------------------------------------ 照片：最终躺在雪地上的位置
  const PHOTOS = [
    { x: 600, y: 380, r: -0.16, fall: [0.12, 0.19], date: '12.1', cap: '初雪', art: artSnowball, seed: 11, sway: 1 },
    { x: 1330, y: 360, r: 0.13, fall: [0.295, 0.35], date: '12.3', cap: '新鼻子', art: artCarrot, seed: 23, sway: -1 },
    { x: 720, y: 660, r: 0.10, fall: [0.335, 0.39], date: '12.24', cap: '平安夜', art: artScarf, seed: 37, sway: 1 },
    { x: 1210, y: 650, r: -0.07, fall: [0.465, 0.52], date: '12.25', cap: '合照', art: artTogether, seed: 41, sway: -1 },
    { x: 965, y: 505, r: 0.04, fall: [0.638, 0.695], date: '1.1', cap: '新年', art: artFootprints, seed: 53, sway: 1 },
  ];

  // ------------------------------------------------------------ 小工具
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function rrPts(x, y, w, h, r, n = 5) {
    const pts = [];
    const cs = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]];
    for (const [cx, cy, a0] of cs) for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * Math.PI / 2;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
  }
  /** 照片里的天空渐变；y1 = 天空画到哪（下面会被地面盖住），省点像素 */
  function skyFill(ctx, top, bot, y1 = 240) {
    const gr = ctx.createLinearGradient(0, -230, 0, 230);
    gr.addColorStop(0, top);
    gr.addColorStop(1, bot);
    ctx.fillStyle = gr;
    ctx.fillRect(-240, -240, 480, y1 + 240);
  }
  /** 星星：按亮度分三批，一批一次 fill */
  function stars(ctx, n, seed, t, x0, y0, w, h) {
    const base = ctx.globalAlpha;
    ctx.save();
    ctx.fillStyle = '#e4e9ff';
    for (let b = 0; b < 3; b++) {
      ctx.globalAlpha = base * (0.32 + 0.24 * b);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const tw = 0.5 + 0.5 * Math.sin(t * (1.2 + rand(i, seed, 3) * 2) + i * 1.7);
        if (Math.min(2, Math.floor(tw * 3)) !== b) continue;
        const sz = 1.8 + rand(i, seed, 4) * 2.6;
        ctx.rect(x0 + rand(i, seed, 1) * w, y0 + rand(i, seed, 2) * h, sz, sz);
      }
      ctx.fill();
    }
    ctx.restore();
  }
  /** 无状态的下雪（和 g.snow 同一套算法），按远近分三批一次画完 —— 便宜很多 */
  function snowFast(ctx, o) {
    const t = o.t, seed = o.seed == null ? 1 : o.seed;
    const [s0, s1] = o.size || [2, 7], [v0, v1] = o.speed || [40, 110];
    const wind = o.wind == null ? 18 : o.wind, sway = o.sway == null ? 26 : o.sway;
    const [ax, ay, aw, ah] = o.area || [0, 0, W, H];
    const layers = [[], [], []];
    for (let i = 0; i < o.count; i++) {
      const r1 = rand(i, seed, 1), r2 = rand(i, seed, 2), r3 = rand(i, seed, 3), r4 = rand(i, seed, 4), r5 = rand(i, seed, 5);
      const size = lerp(s0, s1, r1 * r1);
      const depth = (size - s0) / Math.max(0.01, s1 - s0);
      const v = lerp(v0, v1, r2) * (0.65 + 0.35 * depth);
      const span = ah + 60;
      const y = ay - 30 + (((r3 * span + t * v) % span) + span) % span;
      let x = r4 * aw + t * wind * (0.5 + depth) + Math.sin(t * (0.4 + r5 * 0.8) + i) * sway;
      x = ax + ((x % aw) + aw) % aw;
      layers[Math.min(2, Math.floor(depth * 3))].push(x, y, size / 2);
    }
    const base = ctx.globalAlpha * (o.alpha == null ? 0.9 : o.alpha);
    ctx.save();
    ctx.fillStyle = o.color || P.snow;
    layers.forEach((L, k) => {
      if (!L.length) return;
      ctx.globalAlpha = base * (0.5 + 0.25 * k);
      ctx.beginPath();
      for (let j = 0; j < L.length; j += 3) {
        ctx.moveTo(L[j] + L[j + 2], L[j + 1]);
        ctx.arc(L[j], L[j + 1], L[j + 2], 0, Math.PI * 2);
      }
      ctx.fill();
    });
    ctx.restore();
  }
  /** 雪球右下的阴影月牙（和角色里的一致） */
  function shadeCres(g, cx, cy, rx, ry, seed) {
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const a = -0.3 + (i / 18) * 2.1;
      pts.push([cx + Math.cos(a) * rx * 0.93, cy + Math.sin(a) * ry * 0.93]);
    }
    for (let i = 18; i >= 0; i--) {
      const a = -0.1 + (i / 18) * 1.75;
      pts.push([cx + Math.cos(a) * rx * 0.7 + rx * 0.08, cy + Math.sin(a) * ry * 0.72 + ry * 0.06]);
    }
    g.fill(pts, rgba(P.snowShade, 0.75), { seed, jitter: 1.2 });
  }
  function softEllipse(ctx, x, y, rx, ry, color, a) {
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function camOn(g, c) {
    g.save();
    g.camera(c.x, c.y, c.z, c.r || 0, c.dx || 0, c.dy || 0);
  }
  function toScreen(c, x, y) {
    const X = (x - c.x) * c.z, Y = (y - c.y) * c.z;
    const cr = Math.cos(c.r || 0), sr = Math.sin(c.r || 0);
    return [W / 2 + (c.dx || 0) + X * cr - Y * sr, H / 2 + (c.dy || 0) + X * sr + Y * cr];
  }
  /** 相纸局部坐标 → 世界坐标 */
  function photoToWorld(st, lx, ly) {
    const c = Math.cos(st.r), s = Math.sin(st.r);
    return [st.x + (lx * c - ly * s) * st.s, st.y + (lx * s + ly * c) * st.s];
  }

  /** 照片里的小号红手套：轮廓和 C.mitten 一样，只把刺绣简化成三笔（小尺寸下看不出区别，但便宜很多） */
  const M_PALM = [[-46, 0], [-52, -70], [-44, -128], [-10, -158], [26, -150], [44, -112], [46, -60], [42, 0]];
  const M_THUMB = [[40, -50], [74, -78], [88, -104], [76, -118], [56, -104], [44, -86]];
  function mitt(g, x, y, s, rot, o = {}) {
    const ctx = g.ctx;
    const seed = o.seed | 0;
    const sc = (pts) => pts.map((q) => [q[0] * s, q[1] * s]);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (o.flip) ctx.scale(-1, 1);
    g.path(sc(M_PALM), { smooth: true, closed: true, color: P.ink, width: 4.5 * s, fill: P.red, seed });
    g.path(sc(M_THUMB), { smooth: true, color: P.ink, width: 4.5 * s, fill: P.red, seed: seed + 1 });
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI) / 3 + 0.3;
      g.line(-4 * s - Math.cos(a) * 18 * s, -86 * s - Math.sin(a) * 18 * s, -4 * s + Math.cos(a) * 18 * s, -86 * s + Math.sin(a) * 18 * s, { color: '#fff4ee', width: 3 * s, jitter: 0.6, seed: seed + 2 + k });
    }
    g.path(sc([[-52, 0], [-50, 36], [48, 36], [46, 0]]), { closed: true, color: P.ink, width: 4 * s, fill: '#fbf6ef', seed: seed + 5 });
    for (let k = 0; k < 3; k++) g.line((-28 + k * 28) * s, 7 * s, (-28 + k * 28) * s, 29 * s, { color: P.snowShade, width: 3 * s, jitter: 0.6, seed: seed + 6 + k });
    ctx.restore();
  }

  // ------------------------------------------------------------ 照片下落状态
  function photoState(ph, p, dur) {
    const [a, b] = ph.fall;
    if (p < a) return null;
    const k = seg(p, a, b);
    const h = 1 - k;                              // 离地高度 1 → 0
    const sw = Math.sin(k * Math.PI * 2.3) * (1 - k);
    const since = (p - b) * dur;                  // 落地后过了几秒
    let s = 1 + 0.2 * h;
    if (since > 0) s *= 1 - 0.025 * Math.sin(since * 22) * Math.exp(-since * 5);
    return {
      x: ph.x + sw * 150 * ph.sway,
      y: ph.y - DROP * (1 - ease.out(k)),
      r: ph.r + Math.sin(k * Math.PI * 2.3 + 0.6) * 0.42 * (1 - k) * ph.sway,
      s, h, k, since,
    };
  }
  function photoOpts(i, p, info) {
    const ph = PHOTOS[i];
    const land = ph.fall[1];
    return {
      seed: ph.seed,
      dev: 0.15 + 0.85 * ease.out(seg(p, ph.fall[0], land + 0.03)),
      dateP: seg(p, land + 0.004, land + 0.032),
      capP: seg(p, land + 0.026, land + 0.05),
      cover: i === 4 ? seg(p, 0.8, 0.915) : 0,
      carve: i === 4 ? seg(p, 0.915, 0.975) : 0,
      dust: i === 4 ? 0.4 * seg(p, 0.7, 1) : seg(p, 0.5, 0.8) * 0.6 + seg(p, 0.8, 1) * 1.4,
      foot: seg(p, 0.66, 0.785),
      ann: seg(p, 0.545, 0.6),
      heart: seg(p, 0.585, 0.615),
    };
  }

  // ------------------------------------------------------------ 一张拍立得
  function drawPhoto(g, i, st, p, t, o) {
    const ctx = g.ctx;
    const ph = PHOTOS[i];
    ctx.save();
    ctx.translate(st.x, st.y);
    // 影子：离地越高越远、越淡
    ctx.save();
    ctx.translate(16 + 80 * st.h, 22 + 110 * st.h);
    ctx.rotate(st.r);
    ctx.scale(st.s, st.s);
    ctx.fillStyle = '#1c2340';
    for (let k = 0; k < (st.h > 0 ? 2 : 1); k++) {
      const e = (10 + 30 * st.h) * k;
      ctx.globalAlpha = 0.17 - 0.07 * st.h;
      rr(ctx, -PW / 2 - e / 2, -PHh / 2 - e / 2, PW + e, PHh + e, 8 + e / 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.rotate(st.r);
    ctx.scale(st.s, st.s);
    // 相纸
    const warm = (o.light || 0) * lightAt(st.x, st.y);
    g.rect(-PW / 2, -PHh / 2, PW, PHh, { fill: warm > 0.02 ? mix(FRAME, '#ffe2b4', 0.7 * warm) : FRAME, color: P.ink, width: 4.2, seed: ph.seed });
    // 画面
    ctx.save();
    ctx.beginPath();
    ctx.rect(IMG.x, IMG.y, IMG.w, IMG.h);
    ctx.clip();
    ctx.save();
    ctx.translate(0, IMC);
    if (o.cover < 0.97) ph.art(g, t, o, p);
    ctx.restore();
    // 显影：没显影完是灰蓝色的
    if (o.dev < 1) {
      ctx.fillStyle = '#56607f';
      ctx.globalAlpha = Math.pow(1 - o.dev, 1.3);
      ctx.fillRect(IMG.x, IMG.y, IMG.w, IMG.h);
      ctx.globalAlpha = 1;
    }
    // 被雪盖住时褪色
    if (o.cover > 0) {
      ctx.fillStyle = '#e3e9f4';
      ctx.globalAlpha = o.cover * 0.75;
      ctx.fillRect(IMG.x, IMG.y, IMG.w, IMG.h);
      ctx.globalAlpha = 1;
    }
    // 相纸反光（跟着照片的角度挪）
    if (st.h > 0) {
      const shx = (st.r - PHOTOS[i].r) * 1400 - 60;
      const gl = ctx.createLinearGradient(IMG.x + shx, IMG.y, IMG.x + shx + 260, IMG.y + 260);
      gl.addColorStop(0, 'rgba(255,255,255,0)');
      gl.addColorStop(0.5, `rgba(255,255,255,${0.35 * st.h})`);
      gl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(IMG.x, IMG.y, IMG.w, IMG.h);
    }
    ctx.restore();
    g.rect(IMG.x, IMG.y, IMG.w, IMG.h, { color: P.ink, width: 2.6, alpha: 0.75, seed: ph.seed + 1 });

    // 页边：日期 + 小字
    const dateA = 1 - o.cover * (i === 4 ? 0.25 : 0.85);
    if (o.dateP > 0) g.text(ph.date, -PW / 2 + 30, 236, { size: 70, align: 'left', progress: o.dateP, color: P.ink, alpha: dateA, seed: ph.seed + 2 });
    if (o.capP > 0) g.text(ph.cap, PW / 2 - 30, 240, { size: 44, align: 'right', progress: o.capP, color: P.inkSoft, alpha: dateA, seed: ph.seed + 3 });
    if (ph.doodle) ph.doodle(g, t, o);
    if (o.after) o.after(g);

    // 落地时溅起的雪沫
    if (st.since > 0 && st.since < 0.9) {
      const k = st.since / 0.9;
      for (let j = 0; j < 12; j++) {
        const side = j % 4;
        const u = rand(j, ph.seed, 1) - 0.5;
        const bx = side < 2 ? u * PW : (side === 2 ? -1 : 1) * (PW / 2 + 6);
        const by = side < 2 ? (side === 0 ? -1 : 1) * (PHh / 2 + 6) : u * PHh;
        const ox = side === 2 ? -1 : side === 3 ? 1 : 0, oy = side === 0 ? -1 : side === 1 ? 1 : 0;
        const d = ease.out(k) * (30 + rand(j, ph.seed, 2) * 50);
        softEllipse(ctx, bx + ox * d, by + oy * d, (8 + 16 * k) * (0.6 + rand(j, ph.seed, 3)), (6 + 12 * k), '#ffffff', 0.85 * (1 - k));
      }
    }
    // 落在相纸上的雪
    if (o.dust > 0) dust(g, o.dust, ph.seed);
    if (o.cover > 0) snowCover(g, o.cover, ph.seed, t, { notch: i === 4 });
    // 雪上用手指写的字
    if (o.carve > 0) g.text('我都记得', 14, -30, { font: 'round', size: 96, color: '#8494c6', shadow: { color: '#ffffff', dx: 3, dy: 4 }, progress: o.carve, rot: -0.05, seed: 980 });
    ctx.restore();
  }

  function dust(g, amt, seed) {
    const ctx = g.ctx;
    const n = Math.floor(amt * 18);
    if (n <= 0) return;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.6;
    ctx.globalAlpha *= 0.9;
    const dots = new Path2D(), xs = new Path2D();
    for (let i = 0; i < n; i++) {
      const x = (rand(i, seed, 41) - 0.5) * PW * 0.96, y = (rand(i, seed, 42) - 0.5) * PHh * 0.96;
      const r = 2.5 + rand(i, seed, 43) * 4;
      if (i % 5 === 0) {
        for (let k = 0; k < 3; k++) {
          const a = rand(i, seed, 44) * 3 + (k * Math.PI) / 3;
          xs.moveTo(x - Math.cos(a) * r * 2, y - Math.sin(a) * r * 2);
          xs.lineTo(x + Math.cos(a) * r * 2, y + Math.sin(a) * r * 2);
        }
      } else {
        dots.moveTo(x + r * 0.6, y);
        dots.arc(x, y, r * 0.6, 0, Math.PI * 2);
      }
    }
    ctx.fill(dots);
    ctx.stroke(xs);
    ctx.restore();
  }

  /** 积雪一点点把相纸盖住：雪从四边往中间长，最后只剩一个雪包（o.notch：左下角留着日期露在外面） */
  function snowCover(g, cover, seed, t, o = {}) {
    const ctx = g.ctx;
    const k = ease.inOut(clamp(cover));
    const cat = TG.U.catmull;
    // 中间还没被盖住的"洞"
    const hs = 0.8 * (1 - k);
    const ox = 18 * k, oy = -26 * k;
    const hole = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const n = 1 + noise1(a * 1.2 + 2, seed) * 0.26 + noise1(a * 2.9 + 1, seed + 9) * 0.08;
      hole.push([ox + Math.cos(a) * PW * hs * n, oy + Math.sin(a) * PHh * hs * n]);
    }
    // 外圈：比相纸大一圈的软软雪堆
    const e = 6 + 22 * k;
    const outer = [];
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const c = Math.cos(a), sn = Math.sin(a);
      const bump = 1 + noise1(a * 2.4 + 5, seed + 3) * 0.035;
      let x = Math.sign(c) * Math.pow(Math.abs(c), 0.22) * (PW / 2 + e) * bump;
      let y = Math.sign(sn) * Math.pow(Math.abs(sn), 0.22) * (PHh / 2 + e) * bump;
      if (o.notch) {
        const f = (x + PW / 2) * 0.8 + (PHh / 2 - y);
        if (f < 210) { const d = (210 - f) / 1.64; x += 0.8 * d; y -= d; }
      }
      outer.push([x, y]);
    }
    const O = cat(outer, true), Hh = cat(hole, true);
    const trace = (pts) => { pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); };
    const A = clamp(cover * 6);
    ctx.save();
    ctx.globalAlpha *= A;
    ctx.beginPath();
    trace(O);
    ctx.clip();
    const BX = -PW / 2 - 40, BY = -PHh / 2 - 40, BW = PW + 80, BH = PHh + 80;
    if (hs > 0.01) {
      ctx.beginPath();
      ctx.rect(BX, BY, BW, BH);
      trace(Hh);
      ctx.clip('evenodd');
    }
    ctx.fillStyle = '#f3f6fd';
    ctx.fillRect(BX, BY, BW, BH);
    // 雪包右下的阴影
    ctx.beginPath();
    ctx.rect(BX, BY, BW, BH);
    trace(O.map((q) => [q[0] * 0.97 - 16, q[1] * 0.97 - 22]));
    ctx.fillStyle = rgba(P.snowShade, 0.7);
    ctx.fill('evenodd');
    g.path(outer, { closed: true, smooth: true, color: '#9fadd4', width: 5, seed: seed + 62 });
    ctx.restore();
    // 雪的边缘是软的：洞里沿着边再扫几圈半透明的白，再撒几粒雪
    ctx.save();
    ctx.globalAlpha *= A;
    if (hs > 0.02) {
      ctx.save();
      ctx.beginPath();
      trace(O);
      ctx.clip();
      g.path(hole, { closed: true, smooth: true, color: 'rgba(243,246,253,0.32)', width: 80, jitter: 3, seed: seed + 60 });
      g.path(hole, { closed: true, smooth: true, color: 'rgba(243,246,253,0.5)', width: 36, jitter: 2, seed: seed + 61 });
      ctx.fillStyle = '#f6f8fe';
      for (let i = 0; i < 22; i++) {
        const j = Math.floor(rand(i, seed, 91) * hole.length);
        const q = hole[j], f = lerp(0.72, 0.97, rand(i, seed, 92));
        const r = 3 + rand(i, seed, 93) * 6;
        ctx.beginPath();
        ctx.arc(ox + (q[0] - ox) * f, oy + (q[1] - oy) * f, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // 雪包上的小反光 / 小雪花
    // 雪包表面几道起伏（雪越厚越明显）
    if (k > 0.35) {
      const a = clamp((k - 0.35) / 0.4);
      for (let i = 0; i < 4; i++) {
        const y0 = -PHh * 0.36 + i * PHh * 0.21 + (rand(i, seed, 75) - 0.5) * 30;
        const x0 = -PW * 0.34 + rand(i, seed, 76) * PW * 0.2, L = PW * (0.3 + rand(i, seed, 77) * 0.25);
        g.curve([[x0, y0], [x0 + L * 0.5, y0 - 10 - rand(i, seed, 78) * 10], [x0 + L, y0 + 4]], { color: P.snowShade, width: 3.4, alpha: 0.8 * a, seed: seed + 90 + i });
      }
    }
    ctx.strokeStyle = '#b8c6e6';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = rand(i, seed, 71) * Math.PI * 2;
      const r = lerp(0.9, 0.3, k * rand(i, seed, 72));
      const x = Math.cos(a) * PW * 0.5 * r, y = Math.sin(a) * PHh * 0.5 * r;
      const sz = 7 + 6 * (0.5 + 0.5 * Math.sin(t * 3 + i * 2.1));
      for (let j = 0; j < 3; j++) {
        const b = t * 0.4 + i + (j * Math.PI) / 3;
        ctx.moveTo(x - Math.cos(b) * sz, y - Math.sin(b) * sz);
        ctx.lineTo(x + Math.cos(b) * sz, y + Math.sin(b) * sz);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------ 照片里的画：(0,0) 是画面中心，画面 440×440
  /** 12.1 初雪：两只红手套推着雪球 */
  function artSnowball(g, t, o) {
    const ctx = g.ctx, sd = o.seed;
    skyFill(ctx, '#27315a', '#4b4f7d', 40);
    stars(ctx, 16, sd, t, -220, -220, 440, 190);
    // 远处小房子 + 暖窗
    g.glow(-170, -40, 110, P.warm, 0.35);
    g.poly([[-232, 20], [-232, -58], [-172, -112], [-110, -58], [-110, 20]], { fill: '#1d2446', color: '#1d2446', width: 2, jitter: 0.8, seed: sd + 1 });
    ctx.fillStyle = P.warm;
    ctx.fillRect(-186, -52, 28, 26);
    // 雪地
    g.path([[-260, 22], [-130, 8], [0, 24], [130, 10], [260, 26], [260, 260], [-260, 260]], { closed: true, fill: P.snow, color: P.ink, width: 3.5, seed: sd + 2 });
    // 滚出来的雪道
    const bx = 46 + Math.sin(t * 2.4) * 5, by = 96, R = 94;
    g.fill([[-260, 102], [bx - 30, 88], [bx - 10, 186], [-260, 160]], rgba(P.snowShade, 0.85), { seed: sd + 3 });
    g.line(-250, 104, bx - 40, 90, { color: P.ice, width: 3, seed: sd + 4 });
    g.line(-250, 158, bx - 30, 184, { color: P.ice, width: 3, seed: sd + 5 });
    // 雪球
    softEllipse(ctx, bx + 16, by + R - 4, R * 0.95, 14, P.nightBlue, 0.25);
    g.circle(bx, by, R, { fill: P.snow, color: P.ink, width: 4.5, seed: sd + 6 });
    shadeCres(g, bx, by, R, R, sd + 7);
    // 滚动的纹理：跟着转的弧线和雪块
    const rot = t * 2.2;
    for (let k = 0; k < 3; k++) {
      const a = rot + k * 2.1;
      g.arc(bx, by, R * (0.4 + k * 0.17), a, a + 1.2, { color: P.ice, width: 3.4, seed: sd + 8 + k });
    }
    for (let k = 0; k < 4; k++) {
      const a = rot + k * 1.57 + 0.6;
      softEllipse(ctx, bx + Math.cos(a) * R * 0.62, by + Math.sin(a) * R * 0.62, 9, 6, P.snowShade, 0.9);
    }
    // 咕噜咕噜
    const hop = Math.abs(Math.sin(t * 4.8)) * 6;
    g.text('咕噜', bx + 70, by - R - 34 - hop, { size: 40, color: '#fffdf6', rot: 0.18, pop: false, seed: sd + 70 });
    // 两只手套
    const push = Math.sin(t * 2.4) * 5;
    [[-120 + push, 54, true], [-114 + push, 130, false]].forEach(([wx, wy, flip], k) => {
      g.line(-262, wy + 8, wx - 12, wy, { color: SLEEVE, width: 36, taper: false, seed: sd + 12 + k });
      mitt(g, wx, wy, 0.46, Math.PI / 2 + (k ? 0.1 : -0.1), { flip, seed: sd + 14 + k });
    });
    // 扬起的雪沫
    for (let k = 0; k < 6; k++) {
      const ph = ((t * 1.3 + k / 6) % 1 + 1) % 1;
      softEllipse(ctx, bx + R * 0.75 + ph * 50, by + R - 12 - Math.sin(ph * Math.PI) * 34, 7, 6, '#ffffff', 0.9 * (1 - ph));
    }
    snowFast(ctx, { t, count: 14, area: [-220, -220, 440, 440], size: [2, 5], speed: [30, 60], wind: 8, sway: 10, seed: sd });
  }

  /** 12.3 新鼻子：手套把胡萝卜插到脸上 */
  function artCarrot(g, t, o) {
    const ctx = g.ctx, sd = o.seed;
    skyFill(ctx, '#33427a', '#283463');
    stars(ctx, 12, sd, t, -220, -220, 440, 160);
    g.glow(160, -150, 140, P.warm, 0.25);
    // 身体顶部 + 头
    g.circle(-30, 340, 210, { fill: P.snow, color: P.ink, width: 4.5, seed: sd + 1 });
    const hx = -46, hy = 6, R = 150;
    g.circle(hx, hy, R, { fill: P.snow, color: P.ink, width: 5, seed: sd + 2 });
    shadeCres(g, hx, hy, R, R, sd + 3);
    // 吓一跳的眼睛 + 眉毛
    const ey = hy - 26;
    [[-52, 0], [44, 1]].forEach(([dx, k]) => {
      C.dot(g, hx + dx, ey, 14, P.ink, sd + 4 + k);
      softEllipse(ctx, hx + dx + 4, ey - 5, 4.5, 4.5, '#ffffff', 1);
      g.arc(hx + dx, ey - 6, 30, Math.PI + 0.6, Math.PI * 2 - 0.6, { color: P.ink, width: 3.6, seed: sd + 6 + k });
    });
    // 腮红
    softEllipse(ctx, hx - 74, hy + 32, 24, 12, P.pink, 0.75);
    softEllipse(ctx, hx + 70, hy + 32, 24, 12, P.pink, 0.75);
    // 嘴：小小的"o"
    g.ellipse(hx - 4, hy + 84, 11, 14, { fill: '#6b3b44', color: P.ink, width: 3.5, seed: sd + 8 });
    // 胡萝卜一下一下往里插
    const k = 0.5 + 0.5 * Math.sin(t * 3.2);
    const off = lerp(26, 0, ease.inOut(k));
    const s = 1.45, len = 58 * s;
    const ny = hy + 24;
    const base = [hx + 4 + len + off, ny];
    // 碰到的地方冒出小线条
    if (off < 8) {
      for (let j = 0; j < 3; j++) {
        const a = -2.2 + j * 0.6;
        g.line(hx + 2 + Math.cos(a) * 26, ny + Math.sin(a) * 26, hx + 2 + Math.cos(a) * 44, ny + Math.sin(a) * 44, { color: P.ink, width: 3, seed: sd + 30 + j });
      }
    }
    C.carrot(g, base[0], base[1], s, Math.PI, { seed: sd + 10 });
    const wx = base[0] + 98, wy = ny + 8;
    g.line(262, wy + 10, wx + 14, wy, { color: SLEEVE, width: 42, taper: false, seed: sd + 11 });
    mitt(g, wx, wy, 0.56, -Math.PI / 2, { seed: sd + 12 });
    // "！"
    const bob = Math.abs(Math.sin(t * 5)) * 10;
    g.text('!', hx + 140, hy - 140 - bob, { font: 'latin', size: 110, color: '#fffdf6', stroke: P.ink, strokeWidth: 9, pop: false, rot: 0.15, seed: sd + 13 });
    snowFast(ctx, { t, count: 12, area: [-220, -220, 440, 440], size: [2, 5], speed: [30, 60], wind: 6, sway: 10, seed: sd });
  }

  /** 12.24 平安夜：手套拉着红围巾的一头，雪人脸红 */
  function artScarf(g, t, o) {
    const ctx = g.ctx, sd = o.seed;
    skyFill(ctx, '#2c2f5a', '#4a3f66', 160);
    // 彩灯串
    const wire = [];
    for (let k = 0; k <= 10; k++) {
      const x = -240 + k * 48;
      wire.push([x, -206 + 36 * (1 - Math.pow(x / 240, 2))]);
    }
    g.curve(wire, { color: '#1d2446', width: 3, seed: sd + 1 });
    const cols = [P.red, P.warm, '#8fd0ff', '#ffffff'];
    wire.forEach(([x, y], k) => {
      if (k === 0 || k === 10) return;
      const on = 0.5 + 0.5 * Math.sin(t * 3.4 + k * 1.9);
      g.glow(x, y + 10, 30, cols[k % 4], 0.55 * on);
      softEllipse(ctx, x, y + 10, 7, 9, cols[k % 4], 0.55 + 0.45 * on);
    });
    // 雪地
    g.path([[-260, 150], [-120, 140], [0, 152], [130, 138], [260, 150], [260, 260], [-260, 260]], { closed: true, fill: P.snow, color: P.ink, width: 3.5, seed: sd + 2 });
    // 雪人（拉近一点）
    const wind = 0.85 + 0.12 * Math.sin(t * 2.6);
    C.snowman(g, -40, 206, 0.7, { t, mood: 'happy', blush: 1, wind, arms: [0.55, 0.2], look: 0.4, seed: sd + 3 });
    // 拉着围巾尾巴的手套
    const tug = Math.sin(t * 2.6) * 6;
    const wx = 164 + tug, wy = 122;
    g.line(262, wy + 8, wx + 10, wy, { color: SLEEVE, width: 36, taper: false, seed: sd + 4 });
    mitt(g, wx, wy, 0.46, -Math.PI / 2 - 0.1, { seed: sd + 5 });
    // 冒出来的小心心
    for (let k = 0; k < 2; k++) {
      const ph = ((t * 0.45 + k * 0.5) % 1 + 1) % 1;
      ctx.save();
      ctx.globalAlpha *= Math.sin(ph * Math.PI);
      C.heart(g, -110 + k * 70 + Math.sin(ph * 6 + k) * 10, -60 - ph * 90, 13 + k * 3, { fill: P.red, width: 2.5, seed: sd + 6 + k });
      ctx.restore();
    }
    snowFast(ctx, { t, count: 12, area: [-220, -220, 440, 440], size: [2, 5], speed: [30, 60], wind: 6, sway: 10, seed: sd });
  }

  /** 12.25 合照：雪人和"你" */
  function artTogether(g, t, o) {
    const ctx = g.ctx, sd = o.seed;
    skyFill(ctx, '#1f2747', '#34427a', 130);
    stars(ctx, 20, sd, t, -220, -220, 440, 220);
    // 雪地
    g.path([[-260, 120], [-120, 108], [0, 122], [130, 106], [260, 118], [260, 260], [-260, 260]], { closed: true, fill: P.snow, color: P.ink, width: 3.5, seed: sd + 2 });
    softEllipse(ctx, 0, 206, 210, 22, P.nightBlue, 0.15);
    // 雪人
    const wave = Math.sin(t * 5);
    C.snowman(g, -86, 204, 0.56, { t, mood: 'happy', blush: 1, arms: [0.15, 0.85 + 0.25 * wave], look: 0.45, seed: sd + 3 });
    // "你"：剪影，举起一只手套挥
    const lean = Math.sin(t * 1.6) * 0.03 - 0.06;
    ctx.save();
    ctx.translate(100, 206);
    ctx.rotate(lean);
    const shx = 26, shy = -184;
    const mw = [76 + wave * 6, -268];
    g.line(shx, shy, mw[0] - 4, mw[1] + 20, { color: COAT, width: 22, taper: false, seed: sd + 4 });
    C.person(g, 0, 0, 0.6, { scarf: true, color: COAT, seed: sd + 5 });
    mitt(g, mw[0], mw[1], 0.3, 0.35 + wave * 0.25, { seed: sd + 6 });
    ctx.restore();
    // 中间飘着的心
    const bob = Math.sin(t * 3) * 6;
    g.glow(4, -122 + bob, 60, P.pink, 0.35);
    C.heart(g, 4, -122 + bob, 24, { fill: P.red, width: 3.2, seed: sd + 7 });
    snowFast(ctx, { t, count: 12, area: [-220, -220, 440, 440], size: [2, 5], speed: [30, 60], wind: 6, sway: 10, seed: sd });
  }

  /** 1.1 新年：雪地上两串脚印，一步一步走远，走向远处的路灯 */
  function artFootprints(g, t, o) {
    const ctx = g.ctx, sd = o.seed;
    const HZ = -78, VX = 96;
    skyFill(ctx, '#18203f', '#3a4680', -70);
    stars(ctx, 18, sd, t, -220, -220, 440, 130);
    // 远处的树
    for (let k = 0; k < 8; k++) {
      const x = -230 + k * 62 + rand(k, sd, 1) * 20, hgt = 22 + rand(k, sd, 2) * 30;
      if (Math.abs(x - VX) < 40) continue;
      g.poly([[x - 13, HZ + 3], [x, HZ - hgt], [x + 13, HZ + 3]], { fill: '#222b55', color: '#222b55', width: 2, jitter: 0.6, seed: sd + 2 + k });
    }
    // 雪原（越近越亮）
    const gr = ctx.createLinearGradient(0, HZ, 0, 230);
    gr.addColorStop(0, '#7381b6');
    gr.addColorStop(0.5, '#a7b3da');
    gr.addColorStop(1, '#dfe6f6');
    ctx.fillStyle = gr;
    ctx.fillRect(-240, HZ, 480, 340);
    g.glow(VX, HZ + 10, 190, P.warm, 0.4);
    C.lamp(g, VX + 18, HZ + 8, 0.17, { light: 0.9 + 0.1 * Math.sin(t * 6), seed: sd + 10 });
    g.line(-240, HZ, 240, HZ + 2, { color: '#2c3a66', width: 3, seed: sd + 11 });
    // 两串脚印：近处 → 远处一步一步出现
    const N = 12;
    const fade = 1 - clamp(o.cover * 1.4);
    const shown = o.foot * N;
    // 已经完整出现的脚印合成一条路径一次画；正在出现的那一步单独画（带透明度）
    const lanes = [[new Path2D(), '#56669e', '#3c4a7c'], [new Path2D(), '#62729f', '#45548a']];
    const print = (path, lane, x, y, sc, k) => {
      const rot = (rand(k, sd, 5 + lane) - 0.5) * 0.3;
      if (lane === 0) {
        path.moveTo(x + 17 * sc, y);
        path.ellipse(x, y, 17 * sc, 22 * sc, rot, 0, Math.PI * 2);
        path.moveTo(x + 13 * sc, y + 33 * sc);
        path.ellipse(x, y + 33 * sc, 13 * sc, 11 * sc, rot, 0, Math.PI * 2);
      } else {
        path.moveTo(x + 15 * sc, y);
        path.ellipse(x, y, 15 * sc, 13 * sc, rot, 0, Math.PI * 2);
      }
    };
    const drawLane = (path, fill, line, alpha) => {
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.fillStyle = fill;
      ctx.fill(path);
      ctx.strokeStyle = line;
      ctx.lineWidth = 2.2;
      ctx.stroke(path);
      ctx.restore();
    };
    for (let k = 0; k < N; k++) {
      const a = clamp(shown - k);
      if (a <= 0) break;
      const d = 1.12 + k * 0.52;
      const sc = 1 / d;
      const y = HZ + 290 * sc;
      for (let lane = 0; lane < 2; lane++) {
        const x0 = lane ? 30 : -110;
        const side = (k % 2 ? 1 : -1) * (lane ? 12 : 18);
        const x = VX + (x0 + side + Math.sin(d * 0.8 + lane * 0.6) * 22 - VX) * sc;
        if (a >= 1) print(lanes[lane][0], lane, x, y, sc, k);
        else {
          const one = new Path2D();
          print(one, lane, x, y, sc, k);
          drawLane(one, lanes[lane][1], lanes[lane][2], a * fade);
        }
      }
    }
    lanes.forEach(([path, fill, line]) => drawLane(path, fill, line, fade));
    snowFast(ctx, { t, count: 14, area: [-220, -220, 440, 440], size: [2, 5], speed: [30, 60], wind: 6, sway: 10, seed: sd });
  }

  // 页边小涂鸦
  PHOTOS[0].doodle = function (g, t, o) {
    if (o.capP > 0) C.flake(g, 60, 240, 18, { color: P.ice, width: 3, progress: o.capP, seed: 801 });
  };
  PHOTOS[3].doodle = function (g, t, o) {
    if (o.heart > 0) C.heart(g, 40, 238, 26, { fill: P.red, width: 3.5, progress: o.heart, seed: 802 });
  };
  // 合照上用白笔写的「你」「我」
  PHOTOS[3].annot = function (g, t, o) {
    const a = o.ann;
    if (a <= 0) return;
    const ink = '#fffdf6';
    g.text('我', -170, -205, { size: 66, color: ink, progress: seg(a, 0, 0.3), seed: 812 });
    g.curve([[-158, -168], [-160, -120], [-140, -62]], { color: ink, width: 4.5, progress: seg(a, 0.2, 0.5), seed: 811 });
    if (a > 0.5) {
      g.line(-140, -62, -158, -78, { color: ink, width: 4, seed: 815 });
      g.line(-140, -62, -136, -86, { color: ink, width: 4, seed: 816 });
    }
    g.text('你', 178, -205, { size: 66, color: ink, progress: seg(a, 0.5, 0.8), seed: 814 });
    g.curve([[164, -172], [146, -132], [114, -100]], { color: ink, width: 4.5, progress: seg(a, 0.7, 1), seed: 813 });
    if (a > 0.99) {
      g.line(114, -100, 116, -124, { color: ink, width: 4, seed: 817 });
      g.line(114, -100, 137, -100, { color: ink, width: 4, seed: 818 });
    }
  };

  // ------------------------------------------------------------ 俯视雪地 + 窗光
  // 窗光：从左上方的窗户斜照到雪地上，一团暖光 + 窗棂的十字影子
  const POOL = { x: 960, y: 470, rx: 860, ry: 640, rot: -0.18 };
  const MUNTIN = [[[930, -120], [1010, 1080]], [[180, 520], [1760, 400]]];
  /** 窗光在 (x,y) 处的强度 0..1 */
  function lightAt(x, y) {
    const dx = x - POOL.x, dy = y - POOL.y;
    const c = Math.cos(-POOL.rot), sn = Math.sin(-POOL.rot);
    const u = (dx * c - dy * sn) / POOL.rx, v = (dx * sn + dy * c) / POOL.ry;
    return clamp(1 - Math.hypot(u, v) * 1.1);
  }
  const GROUND = '#97a3cf';
  const POOL_RINGS = [[1.0, 0.16], [0.82, 0.3], [0.64, 0.44], [0.47, 0.58], [0.3, 0.7]].map(([k, m]) => [k, mix(GROUND, '#ffe2b0', m)]);
  /** 窗光：一团暖光（赛璐璐式的几层平涂，边缘手抖），part = 'pool' | 'muntin' */
  function windowLight(g, light, part) {
    if (light <= 0.01) return;
    const ctx = g.ctx;
    const base = ctx.globalAlpha * light;
    ctx.save();
    if (part === 'pool') {
      ctx.translate(POOL.x, POOL.y);
      ctx.rotate(POOL.rot);
      ctx.globalAlpha = base;
      POOL_RINGS.forEach(([k, c], j) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const an = (i / 40) * Math.PI * 2;
          const w = 1 + noise1(an * 2 + j * 3, 401) * 0.035;
          const x = Math.cos(an) * POOL.rx * k * w, y = Math.sin(an) * POOL.ry * k * w;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      });
    } else {
      // 窗棂的十字影子：中间深、两头淡（叠三段实色，比渐变描边便宜）
      ctx.strokeStyle = '#4a4f80';
      ctx.lineCap = 'round';
      ctx.lineWidth = 40;
      for (const [k, a] of [[1, 0.05], [0.66, 0.07], [0.36, 0.08]]) {
        ctx.globalAlpha = base * a;
        ctx.beginPath();
        for (const [p0, p1] of MUNTIN) {
          const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
          ctx.moveTo(lerp(mx, p0[0], k), lerp(my, p0[1], k));
          ctx.lineTo(lerp(mx, p1[0], k), lerp(my, p1[1], k));
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  function groundWorld(g, t, cam) {
    const vis = (x, y, m) => { const q = toScreen(cam, x, y); return q[0] > -m && q[0] < W + m && q[1] > -m && q[1] < H + m; };
    const ctx = g.ctx;
    // 雪面起伏：几块淡淡的阴影
    ctx.save();
    ctx.fillStyle = '#5d6aa0';
    for (let i = 0; i < 7; i++) {
      const x = -300 + rand(i, 61) * 2600, y = -300 + rand(i, 62) * 1700;
      ctx.globalAlpha = 0.06;
      ctx.beginPath();
      ctx.ellipse(x, y, 260 + rand(i, 63) * 260, 90 + rand(i, 64) * 80, rand(i, 65) - 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    for (let i = 0; i < 16; i++) {
      const x = -400 + rand(i, 71) * 2800, y = -400 + rand(i, 72) * 1900, L = 140 + rand(i, 73) * 220;
      if (!vis(x + L / 2, y, 300)) continue;
      g.curve([[x, y], [x + L * 0.5, y - 12 - rand(i, 74) * 14], [x + L, y + 4]], { color: '#7584b8', width: 3, alpha: 0.45, seed: 700 + i });
    }
    // 雪面上的闪光
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.2;
    const base = ctx.globalAlpha;
    const bk = [new Path2D(), new Path2D(), new Path2D()];
    for (let i = 0; i < 46; i++) {
      const tw = Math.pow(Math.max(0, Math.sin(t * (1.5 + rand(i, 81) * 2) + i * 2.3)), 6);
      if (tw < 0.05) continue;
      const x = -300 + rand(i, 82) * 2600, y = -300 + rand(i, 83) * 1700, sz = 5 + 10 * tw;
      if (!vis(x, y, 20)) continue;
      const q = bk[Math.min(2, Math.floor(tw * 3))];
      q.moveTo(x - sz, y); q.lineTo(x + sz, y);
      q.moveTo(x, y - sz); q.lineTo(x, y + sz);
    }
    bk.forEach((q, k) => { ctx.globalAlpha = base * (0.3 + 0.35 * k); ctx.stroke(q); });
    ctx.restore();
  }

  /** 画俯视的雪地世界：地面、窗光、照片堆 */
  function world(g, p, t, info, cam, o = {}) {
    const light = o.light == null ? 1 : o.light;
    g.bg(GROUND);
    camOn(g, cam);
    windowLight(g, light, 'pool');
    groundWorld(g, t, cam);
    windowLight(g, light, 'muntin');
    PHOTOS.forEach((ph, i) => {
      const st = photoState(ph, p, info.dur);
      if (!st) return;
      const sc = toScreen(cam, st.x, st.y);
      const R = 400 * cam.z;
      const vx = o.view || [0, W];
      if (sc[0] < vx[0] - R || sc[0] > vx[1] + R || sc[1] < -R || sc[1] > H + R) return;
      const po = photoOpts(i, p, info);
      po.light = light;
      if (ph.annot) po.after = (gg) => ph.annot(gg, t, po);
      drawPhoto(g, i, st, p, t, po);
    });
    if (o.world) o.world(g);
    g.restore();
  }
  /** 便宜的暗角：只在四条边上铺线性渐变（整屏径向渐变在软件光栅下很贵） */
  function vignetteFast(ctx, a) {
    const band = (x0, y0, x1, y1, w, h, k) => {
      const gr = ctx.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, `rgba(18,23,41,${a * k})`);
      gr.addColorStop(0.55, `rgba(18,23,41,${a * k * 0.3})`);
      gr.addColorStop(1, 'rgba(18,23,41,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), w, h);
    };
    ctx.save();
    band(0, 0, 0, 240, W, 240, 0.85);
    band(0, H, 0, H - 280, W, 280, 1);
    band(0, 0, 300, 0, 300, H, 0.9);
    band(W, 0, W - 300, 0, 300, H, 0.9);
    ctx.restore();
  }
  function overlays(g, t, o = {}) {
    snowFast(g.ctx, { t, count: o.count || 80, seed: 9, size: [2, 7], speed: [40, 90], wind: 14, alpha: 0.85 });
    snowFast(g.ctx, { t, count: 9, seed: 19, size: [12, 20], speed: [90, 140], wind: 20, alpha: 0.35 });
    vignetteFast(g.ctx, o.vig == null ? 0.42 : o.vig);
  }

  // ------------------------------------------------------------ S1 拍立得
  const P_FLASH = 0.068;
  function shotCamera(g, p, t, info) {
    const ctx = g.ctx;
    const u = seg(p, CUT[0], CUT[1]);
    const fs = (p - P_FLASH) * info.dur;          // 闪光后过了几秒
    const fl = fs > 0 ? Math.exp(-fs * 3.2) : 0;
    g.bg([P.nightDeep, P.night, '#2a3561']);
    // 背后"你"家的窗光（逆光）
    g.glow(960, 230, 760, P.warmDeep, 0.32);
    g.glow(960, 200, 420, P.glow, 0.26);
    for (let i = 0; i < 7; i++) {
      const bx = 140 + rand(i, 31) * 1640, by = 120 + rand(i, 32) * 500, br = 26 + rand(i, 33) * 40;
      g.glow(bx, by, br * 2.4, P.warm, 0.18 * (0.75 + 0.25 * Math.sin(t * 1.3 + i * 2)));
    }
    snowFast(ctx, { t, count: 60, seed: 3, size: [2, 6], speed: [30, 70], alpha: 0.55 });

    const z = lerp(1.1, 1.2, ease.inOut(u)) + 0.035 * fl;
    const up = ease.in(seg(p, 0.112, 0.13));
    const sh = fl > 0.3 ? g.shake(5 * fl) : [0, 0];
    g.save();
    g.camera(960, 525, z, Math.sin(t * 0.9) * 0.012, sh[0], sh[1] + up * 460);
    photographer(g, t);
    // 吐出来的相纸（在相机后面）
    const e = ease.outCubic(seg(p, 0.086, 0.122));
    if (e > 0) {
      const top = 300 - 300 * e;
      ctx.save();
      ctx.translate(960, top + 190);
      ctx.rotate(Math.sin(t * 3) * 0.015);
      g.rect(-205, -190, 410, 380, { fill: FRAME, color: P.ink, width: 4, seed: 901 });
      ctx.fillStyle = '#56607f';
      ctx.fillRect(-180, -165, 360, 300);
      g.rect(-180, -165, 360, 300, { color: P.ink, width: 2.5, alpha: 0.7, seed: 902 });
      ctx.restore();
    }
    instantCamera(g, t, fl, fs);
    g.restore();

    // 「茄子～」
    const cheese = seg(p, 0.012, 0.04);
    if (cheese > 0 && fl < 0.6) {
      g.text('茄子～', 470, 200, { font: 'round', size: 86, color: '#fffdf6', stroke: P.ink, strokeWidth: 10, progress: cheese, rot: -0.12, alpha: 1 - seg(p, P_FLASH, P_FLASH + 0.01), seed: 903 });
    }
    // 闪光
    if (fl > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255,253,246,${0.9 * fl})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      const kk = seg(p, P_FLASH, P_FLASH + 0.012);
      g.text('咔嚓！', 1470, 190, { font: 'brush', size: 150, color: P.ink, shadow: { color: P.warm, dx: 7, dy: 7 }, progress: kk, rot: 0.1, seed: 904 });
    }
    // 闪光前的小星星
    if (fs > -0.5 && fs < 0) {
      const a = 1 - Math.abs(fs + 0.25) / 0.25;
      C.star(g, 790, 270, 14 + 10 * a, { fill: P.glow, seed: 905 });
    }
  }

  function photographer(g, t) {
    const breathe = Math.sin(t * 1.4) * 4;
    // 头（被相机挡住脸）
    const hx = 960, hy = 238 + breathe * 0.5;
    g.circle(hx, hy, 138, { fill: COAT, color: COAT, width: 4, seed: 910 });
    g.path([[-150, -4], [-136, -86], [-60, -150], [20, -156], [104, -120], [150, -40], [152, 10]].map((q) => [hx + q[0], hy + q[1]]), { smooth: true, fill: COAT, color: COAT, width: 8, seed: 911 });
    // 逆光的轮廓光
    g.arc(hx, hy - 4, 150, Math.PI + 0.35, Math.PI * 2 - 0.3, { color: P.glow, width: 5, alpha: 0.7, seed: 912 });
    // 大衣 + 肩
    g.path([[300, 1120], [360, 900], [470, 790], [700, 720], [1220, 720], [1450, 790], [1560, 900], [1620, 1120]].map((q) => [q[0], q[1] + breathe]), { closed: true, smooth: true, fill: COAT, color: P.ink, width: 4, seed: 913 });
    g.arc(960, 1500 + breathe, 830, Math.PI + 0.62, Math.PI + 1.0, { color: P.glow, width: 4, alpha: 0.45, seed: 914 });
    // 围巾
    g.path([[690, 728], [960, 712], [1230, 728], [1240, 800], [960, 818], [684, 802]].map((q) => [q[0], q[1] + breathe]), { closed: true, smooth: true, fill: P.red, color: P.ink, width: 4, seed: 915 });
    for (let k = 0; k < 9; k++) g.line(720 + k * 58, 734 + breathe, 728 + k * 58, 796 + breathe, { color: P.redDeep, width: 3, seed: 916 + k });
    g.path([[1120, 790], [1180, 790], [1196, 1010], [1132, 1016]].map((q) => [q[0] + Math.sin(t * 2) * 3, q[1] + breathe]), { closed: true, smooth: true, fill: P.red, color: P.ink, width: 4, seed: 926 });
    // 手臂
    g.line(500, 880 + breathe, 664, 760, { color: SLEEVE, width: 120, taper: false, seed: 927 });
    g.line(1420, 880 + breathe, 1256, 760, { color: SLEEVE, width: 120, taper: false, seed: 928 });
  }

  function instantCamera(g, t, fl, fs) {
    const ctx = g.ctx;
    const X = 650, Y = 290, CW = 620, CH = 470;
    // 机身
    g.path(rrPts(X, Y, CW, CH, 66), { closed: true, fill: '#cfe0ee', color: P.ink, width: 5, seed: 930 });
    ctx.save();
    rr(ctx, X + 4, Y + 4, CW - 8, CH - 8, 62);
    ctx.clip();
    ctx.fillStyle = '#eef4f9';
    ctx.fillRect(X, Y, CW, 104);
    ctx.fillStyle = 'rgba(44,58,102,0.10)';
    ctx.fillRect(X + CW - 90, Y, 90, CH);
    ctx.restore();
    g.line(X + 8, Y + 104, X + CW - 8, Y + 106, { color: P.ink, width: 3.5, seed: 931 });
    // 出片口
    g.line(X + 150, Y + 14, X + CW - 150, Y + 14, { color: P.ink, width: 6, taper: false, seed: 932 });
    // 闪光灯
    const fx = X + 40, fy = Y + 22;
    if (fl > 0) g.glow(fx + 75, fy + 40, 520, '#ffffff', 0.9 * fl);
    g.rect(fx, fy, 150, 76, { fill: fl > 0.2 ? '#ffffff' : '#fff2cf', color: P.ink, width: 4, seed: 933 });
    for (let k = 0; k < 4; k++) g.line(fx + 22 + k * 30, fy + 12, fx + 10 + k * 30, fy + 64, { color: '#e8c98a', width: 2.5, alpha: 0.9, seed: 934 + k });
    if (fl > 0.15) {
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + 0.2;
        const r0 = 110, r1 = 110 + 160 * fl;
        g.line(fx + 75 + Math.cos(a) * r0, fy + 38 + Math.sin(a) * r0 * 0.7, fx + 75 + Math.cos(a) * r1, fy + 38 + Math.sin(a) * r1 * 0.7, { color: P.warm, width: 6, seed: 940 + k });
      }
    }
    // 取景器
    g.rect(X + CW - 150, Y + 26, 92, 62, { fill: '#26223a', color: P.ink, width: 4, seed: 950 });
    g.line(X + CW - 136, Y + 40, X + CW - 112, Y + 40, { color: '#8a93b8', width: 3, seed: 951 });
    // 快门键（在顶上）
    const press = fs > -0.12 && fs < 0.25 ? 7 : 0;
    g.path(rrPts(X + CW - 168, Y - 26 + press, 74, 30, 12, 3), { closed: true, fill: P.sun, color: P.ink, width: 4, seed: 952 });
    // 背带扣
    g.rect(X - 18, Y + 120, 20, 46, { fill: '#9fb8dc', color: P.ink, width: 3.5, seed: 953 });
    g.rect(X + CW - 2, Y + 120, 20, 46, { fill: '#9fb8dc', color: P.ink, width: 3.5, seed: 954 });
    // 镜头
    const lx = 960, ly = 548;
    g.circle(lx, ly, 170, { fill: '#efe8da', color: P.ink, width: 5, seed: 955 });
    g.circle(lx, ly, 140, { fill: '#3b3552', color: P.ink, width: 4.5, seed: 956 });
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      g.line(lx + Math.cos(a) * 124, ly + Math.sin(a) * 124, lx + Math.cos(a) * 134, ly + Math.sin(a) * 134, { color: '#6d6590', width: 2.5, jitter: 0.5, seed: 957 + k });
    }
    g.circle(lx, ly, 110, { fill: '#26223a', color: P.ink, width: 4, seed: 990 });
    // 玻璃 + 倒影里的雪人
    ctx.save();
    ctx.beginPath();
    ctx.arc(lx, ly, 92, 0, Math.PI * 2);
    ctx.clip();
    const gl = ctx.createRadialGradient(lx - 20, ly - 30, 10, lx, ly, 96);
    gl.addColorStop(0, '#46558c');
    gl.addColorStop(1, '#141a33');
    ctx.fillStyle = gl;
    ctx.fillRect(lx - 100, ly - 100, 200, 200);
    softEllipse(ctx, lx, ly + 78, 120, 30, '#c8d4ec', 0.45);
    ctx.save();
    ctx.globalAlpha *= 0.85;
    C.snowman(g, lx + 6, ly + 74, 0.27, { t, mood: 'happy', blush: 0.9, arms: [0.6, 0.6], seed: 991 });
    ctx.restore();
    if (fl > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.8 * fl})`;
      ctx.fillRect(lx - 100, ly - 100, 200, 200);
    }
    ctx.restore();
    g.arc(lx, ly, 74, Math.PI + 0.5, Math.PI + 1.4, { color: '#ffffff', width: 6, alpha: 0.75, seed: 992 });
    softEllipse(ctx, lx + 44, ly - 46, 8, 8, '#ffffff', 0.8);
    // 心形小贴纸
    C.heart(g, X + 74, Y + CH - 70, 24, { fill: P.red, width: 3.5, rot: -0.2, seed: 993 });
    // 两只手套抓着两边
    C.mitten(g, 672, 790, 0.95, 0.24, { seed: 994 });
    C.mitten(g, 1248, 790, 0.95, -0.24, { flip: true, seed: 995 });
  }

  // ------------------------------------------------------------ S2 第一张：12.1
  function shotFirst(g, p, t, info) {
    const u = seg(p, CUT[1], CUT[2]);
    const ph = PHOTOS[0];
    const cam = { x: ph.x + lerp(-20, 30, u), y: ph.y + lerp(16, -4, u), z: lerp(1.3, 1.4, ease.inOut(u)), r: lerp(0.08, 0.05, u), dy: -40 };
    world(g, p, t, info, cam, {
      world(gw) {
        // 手写：「这是我」 + 箭头指向雪球
        const st = photoState(ph, p, info.dur);
        const a = seg(p, 0.225, 0.262);
        if (a <= 0) return;
        const tip = photoToWorld(st, 120, IMC + 70);
        const tx = ph.x + 420, ty = ph.y + 60;
        gw.text('这是我', tx + 20, ty - 70, { size: 66, color: P.ink, progress: seg(a, 0, 0.6), rot: 0.06, seed: 960 });
        gw.curve([[tx - 10, ty - 22], [tx - 60, ty + 30], [tip[0] + 40, tip[1] + 30], [tip[0] + 6, tip[1] + 6]], { color: P.ink, width: 4.5, progress: seg(a, 0.45, 1), seed: 961 });
        if (a > 0.95) {
          gw.line(tip[0] + 6, tip[1] + 6, tip[0] + 32, tip[1] + 4, { color: P.ink, width: 4.5, seed: 962 });
          gw.line(tip[0] + 6, tip[1] + 6, tip[0] + 16, tip[1] + 30, { color: P.ink, width: 4.5, seed: 963 });
        }
      },
    });
    overlays(g, t);
  }

  // ------------------------------------------------------------ S3 分屏：12.3 / 12.24
  function shotSplit(g, p, t, info) {
    const ctx = g.ctx;
    const u = seg(p, CUT[2], CUT[3]);
    const dv = ease.inOutCubic(seg(p, 0.322, 0.342));      // 右边画格滑进来
    const D0 = lerp(W + 260, 1060, dv), D1 = lerp(W + 60, 860, dv);
    const pa = PHOTOS[1], pb = PHOTOS[2];
    const camL = { x: pa.x + lerp(30, -10, u), y: pa.y + 10, z: lerp(1.04, 1.1, u), r: -0.07, dx: lerp(0, -470, dv), dy: -50 };
    const camR = { x: pb.x + lerp(-20, 15, u), y: pb.y + 4, z: lerp(1.1, 1.04, u), r: -0.03, dx: 480, dy: -40 };
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-10, -10); ctx.lineTo(D0, -10); ctx.lineTo(D1, H + 10); ctx.lineTo(-10, H + 10);
    ctx.closePath();
    ctx.clip();
    world(g, p, t, info, camL, { view: [0, lerp(W, 1060, dv)] });
    ctx.restore();
    if (dv > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(D0, -10); ctx.lineTo(W + 400, -10); ctx.lineTo(W + 400, H + 10); ctx.lineTo(D1, H + 10);
      ctx.closePath();
      ctx.clip();
      ctx.translate((1 - dv) * 300, 0);
      world(g, p, t, info, camR, { light: 1.15, view: [860, W] });
      ctx.restore();
    }
    overlays(g, t, { count: 70 });
    if (dv > 0) {
      // 画格之间的白缝
      ctx.save();
      ctx.fillStyle = P.paper;
      ctx.beginPath();
      ctx.moveTo(D0 - 14, -10); ctx.lineTo(D0 + 14, -10); ctx.lineTo(D1 + 14, H + 10); ctx.lineTo(D1 - 14, H + 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      g.line(D0 - 15, -20, D1 - 15, H + 20, { width: 5, seed: 970 });
      g.line(D0 + 15, -20, D1 + 15, H + 20, { width: 5, seed: 971 });
    }
  }

  // ------------------------------------------------------------ S4 合照：12.25
  function shotTogether(g, p, t, info) {
    const u = seg(p, CUT[3], CUT[4]);
    const ph = PHOTOS[3];
    const cam = { x: ph.x + lerp(14, -6, u), y: ph.y + lerp(52, 40, u), z: lerp(1.42, 1.56, ease.inOut(u)), r: lerp(0.04, 0.09, u), dy: -36 };
    world(g, p, t, info, cam, { light: 1.15 });
    overlays(g, t);
  }

  // ------------------------------------------------------------ S5 拉远：照片堆，最后一张 1.1
  function shotPile(g, p, t, info) {
    const u = seg(p, CUT[4], CUT[5]);
    const cam = { x: 965 + lerp(-14, 14, u), y: 500, z: lerp(0.95, 0.88, ease.inOut(u)), r: lerp(-0.025, 0.01, u), dy: -30 };
    world(g, p, t, info, cam);
    overlays(g, t);
  }

  // ------------------------------------------------------------ S6 被雪盖住
  function shotCover(g, p, t, info) {
    const ctx = g.ctx;
    const u = seg(p, CUT[5], CUT[6]);
    const ph = PHOTOS[4];
    const cam = { x: ph.x + lerp(-24, 4, u), y: ph.y + lerp(62, 92, ease.inOut(u)), z: lerp(1.16, 1.3, ease.inOut(u)), r: lerp(-0.08, -0.03, u), dy: -30 };
    const light = lerp(1, 0.4, ease.inOut(seg(p, 0.86, 0.98)));
    world(g, p, t, info, cam, { light });
    overlays(g, t, { count: 95, vig: lerp(0.42, 0.7, seg(p, 0.86, 1)) });
    // 越来越暗，接下一幕的夜
    ctx.save();
    ctx.fillStyle = P.nightDeep;
    ctx.globalAlpha = 0.55 * ease.in(seg(p, 0.93, 1));
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  TG.scene({
    id: 'memory',
    title: '间奏 · 回忆',
    transition: 'iris',
    chars: '茄子咔嚓初雪新鼻子平安夜合照年我都记得这是你～！',
    draw(g, p, t, info) {
      if (p < CUT[1]) shotCamera(g, p, t, info);
      else if (p < CUT[2]) shotFirst(g, p, t, info);
      else if (p < CUT[3]) shotSplit(g, p, t, info);
      else if (p < CUT[4]) shotTogether(g, p, t, info);
      else if (p < CUT[5]) shotPile(g, p, t, info);
      else shotCover(g, p, t, info);
    },
  });
})();
