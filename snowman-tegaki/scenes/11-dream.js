/* 场景：dream —— 梦
 *
 * 镜头（按 p 分段，12s～35s 都能看）：
 *   S1 0.00–0.16  合眼   夜里的雪人近景，眨眼、闭眼，嘴角翘起来；粉蓝色的梦从画面边缘晕进来，「晚安」+ zZ
 *   S2 0.16–0.30  变身   粉蓝梦境 + 大字「梦」。雪人"噗"地变成戴红围巾的白色小人，低头看自己的脚 →「梦里，我有脚了」
 *   S3 0.30–0.48  并肩   横移长镜头：小人和"你"的剪影并肩往右走，身后两串脚印，小脚印下面数着 1、2、3…
 *   S4 0.48–0.60  脚印   俯视雪地：两串脚印越走越近，手写标注「你」「我」
 *   S5 0.60–0.72  牵手   特写：红手套从右边伸过来，握住小人圆圆的手 → 暖光、小心心、「牵住了」
 *   S6 0.72–1.00  啵     牵着手走 → 镜头拉远，原来整个梦是飘在睡着的雪人头顶的一个泡泡 →「啵！」碎掉 → 雪人一个人睁开眼
 */
(function () {
  'use strict';
  const { clamp, lerp, seg, ease, rand, noise1, mix, rgba } = TG.U;
  const P = TG.PAL, C = TG.C, W = TG.W, H = TG.H;

  // 梦的配色：粉 + 蓝 + 一点淡紫和奶油黄（都是 PAL 里颜色的浅化）
  const D = {
    skyTop: '#c8d6f3',
    skyMid: '#efd5e8',
    skyLow: '#fde6e4',
    pink: '#f6bdd2',
    blue: '#bcd8f4',
    lilac: '#d8caf0',
    cream: '#fff0d2',
    snow: '#fefafc',
    print: '#b7b3dd',
    hill1: '#d9cdee',
    hill2: '#e4e4f7',
    pine: '#c3cdee',
    you: '#55425c', // 梦里的"你"：剪影稍微偏紫一点
    soft: '#8e7cab',
  };

  // ---------------------------------------------------------------- 小工具
  /** 四角星闪光 */
  function sparkle(g, x, y, r, a = 1, color = '#ffffff', rot = 0) {
    if (a <= 0.01 || r <= 0.5) return;
    const ctx = g.ctx;
    const k = r * 0.13;
    ctx.save();
    ctx.globalAlpha *= clamp(a);
    ctx.fillStyle = color;
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(k, -k, r, 0);
    ctx.quadraticCurveTo(k, k, 0, r);
    ctx.quadraticCurveTo(-k, k, -r, 0);
    ctx.quadraticCurveTo(-k, -k, 0, -r);
    ctx.fill();
    ctx.restore();
  }

  /** 一团软软的云（无描边，一次填充） */
  function cloud(g, x, y, s, color, a) {
    const ctx = g.ctx;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = color;
    ctx.beginPath();
    [[0, 0, 70], [70, -26, 62], [140, 2, 54], [-70, 12, 48], [44, 26, 58], [-24, -30, 46]].forEach(([dx, dy, r]) => {
      ctx.moveTo(x + (dx + r) * s, y + dy * s);
      ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    });
    ctx.fill();
    ctx.restore();
  }

  /** 往上飘的柔光圆斑（梦的"泡泡感"） */
  function bokeh(g, t, o = {}) {
    const ctx = g.ctx;
    const n = o.count || 14, seed = o.seed || 3, A = o.alpha == null ? 0.5 : o.alpha;
    if (A <= 0.01) return;
    const cols = o.colors || [D.pink, D.blue, D.lilac, D.cream];
    const [ax, ay, aw, ah] = o.area || [0, 0, W, H];
    for (let i = 0; i < n; i++) {
      const r = lerp(o.rMin || 26, o.rMax || 100, rand(i, seed, 1));
      const sp = lerp(12, 44, rand(i, seed, 2));
      const x = ax + rand(i, seed, 3) * aw + Math.sin(t * 0.5 + i) * 26;
      const span = ah + r * 2;
      const y = ay + ((((rand(i, seed, 4) * span - t * sp) % span) + span) % span) - r;
      const tw = 0.65 + 0.35 * Math.sin(t * 1.3 + i * 2.1);
      g.glow(x, y, r, cols[i % cols.length], A * tw);
      if (i % 3 === 0) {
        ctx.save();
        ctx.globalAlpha *= A * 0.5 * tw;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /** 雪球身上的阴影月牙（和 characters.js 里雪人的画法一致） */
  function shade(g, cx, cy, rx, ry, seed) {
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

  /** 手绘箭头（沿曲线画出来，到头了加箭头） */
  function arrow(g, pts, prog, o = {}) {
    if (prog <= 0) return;
    const col = o.color || P.ink, w = o.width || 4;
    g.curve(pts, { color: col, width: w, progress: prog, seed: o.seed });
    if (prog >= 0.98) {
      const a = pts[pts.length - 1], b = pts[pts.length - 2];
      const ang = Math.atan2(a[1] - b[1], a[0] - b[0]);
      const L = o.head || 26;
      g.line(a[0], a[1], a[0] - Math.cos(ang - 0.5) * L, a[1] - Math.sin(ang - 0.5) * L, { color: col, width: w, seed: (o.seed | 0) + 1 });
      g.line(a[0], a[1], a[0] - Math.cos(ang + 0.5) * L, a[1] - Math.sin(ang + 0.5) * L, { color: col, width: w, seed: (o.seed | 0) + 2 });
    }
  }

  /** 夜空的小星星 */
  function nightStars(g, t, n, seed, a = 1) {
    const ctx = g.ctx;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < n; i++) {
      const x = rand(i, seed, 1) * W, y = rand(i, seed, 2) * H * 0.62;
      const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * (1 + rand(i, seed, 3) * 2) + i));
      ctx.globalAlpha = a * tw * 0.8;
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + rand(i, seed, 4) * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- 梦里的"我"：围红围巾的白色小人
  /**
   * (x,y) 脚底中心；s=1 时连帽子高约 310px。
   * o = {t, dir, phase, walk, hop, look, lookUp, lookDown, eyesClosed, mood('happy'|'o'|'calm'),
   *      blush, armsUp, reach:[x,y], wind, seed, wave}
   */
  function kid(g, x, y, s, o = {}) {
    const ctx = g.ctx;
    const t = o.t == null ? g.info.songTime : o.t;
    const dir = o.dir || 1;
    const ph = o.phase || 0, wk = o.walk || 0;
    const seed = o.seed | 0;
    const ink = P.ink, lw = 4.4 * s;
    const sw = Math.sin(ph), cw = Math.cos(ph);
    const hop = o.hop || 0;
    const base = y - hop;
    const by = base - (1 - Math.abs(sw)) * 5 * s * wk;
    const wind = o.wind == null ? 0.3 : o.wind;

    // 影子
    ctx.save();
    ctx.globalAlpha *= 0.16 * clamp(1 - hop / (160 * s));
    ctx.fillStyle = P.nightBlue;
    ctx.beginPath();
    ctx.ellipse(x + 6 * s, y + 2 * s, 64 * s * clamp(1 - hop / (300 * s), 0.5, 1), 11 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 手臂（在身体后面）
    let reachEnd = null;
    [-1, 1].forEach((side, k) => {
      const sx = x + side * 34 * s, sy = by - 124 * s;
      let ex, ey;
      const isReach = o.reach && side === dir;
      if (isReach) {
        ex = o.reach[0]; ey = o.reach[1];
        reachEnd = [ex, ey];
      } else {
        const up = clamp(o.armsUp || 0);
        const legSw = side === -1 ? sw : -sw;
        let a = side * lerp(0.45, 2.45, up) - dir * legSw * 0.55 * wk;
        if (o.wave && side === dir) a += Math.sin(t * 11) * 0.28;
        const L = 50 * s;
        ex = sx + Math.sin(a) * L; ey = sy + Math.cos(a) * L;
      }
      g.line(sx, sy, ex, ey, { color: ink, width: 21 * s, taper: false, jitter: 1.1, seed: seed + 10 + k });
      g.line(sx, sy, ex, ey, { color: P.snow, width: 12.5 * s, taper: false, jitter: 0.4, seed: seed + 12 + k });
      if (!isReach) g.circle(ex, ey, 11.5 * s, { color: ink, width: 3.4 * s, fill: P.snow, seed: seed + 14 + k });
    });

    // 围巾尾巴（飘在身后）
    const nx = x + dir * 2 * s, ny = by - 150 * s;
    {
      const w = clamp(wind);
      const fl = (k) => Math.sin(t * 8 + k * 1.7) * (4 + 10 * w) * s;
      const ax = nx - dir * 24 * s, ay = ny + 8 * s;
      const tail = [
        [ax, ay],
        [ax - dir * lerp(16, 64, w) * s + fl(1) * 0.3, ay + lerp(48, 12, w) * s + fl(2) * 0.5],
        [ax - dir * lerp(20, 104, w) * s + fl(3) * 0.4, ay + lerp(92, 20, w) * s + fl(4)],
        [ax - dir * lerp(46, 112, w) * s + fl(3) * 0.4, ay + lerp(88, 44, w) * s + fl(5)],
        [ax - dir * lerp(30, 60, w) * s + fl(2) * 0.3, ay + lerp(42, 32, w) * s + fl(1) * 0.5],
        [ax + dir * 16 * s, ay + 8 * s],
      ];
      g.curve(tail.concat([tail[0]]), { color: ink, width: 3.6 * s, fill: P.red, closed: true, seed: seed + 16 });
      const e1 = tail[2], e2 = tail[3];
      for (let k = 0; k < 4; k++) {
        const fx = lerp(e1[0], e2[0], k / 3), fy = lerp(e1[1], e2[1], k / 3);
        g.line(fx, fy, fx - dir * lerp(2, 18, w) * s, fy + lerp(14, 6, w) * s, { color: P.redDeep, width: 2.6 * s, seed: seed + 17 + k });
      }
    }

    // 腿和脚
    [[-1, sw, Math.max(0, cw)], [1, -sw, Math.max(0, -cw)]].forEach(([side, swing, lift], k) => {
      const hx = x + side * 15 * s, hy = by - 46 * s;
      const fx = x + side * 15 * s + dir * swing * 22 * s * wk;
      const fy = base - lift * 15 * s * wk;
      g.line(hx, hy, fx, fy - 8 * s, { color: ink, width: 25 * s, taper: false, jitter: 1.1, seed: seed + 1 + k });
      g.line(hx, hy, fx, fy - 8 * s, { color: P.snow, width: 16 * s, taper: false, jitter: 0.4, seed: seed + 3 + k });
      g.ellipse(fx + dir * 6 * s, fy - 7 * s, 17 * s, 10 * s, { color: ink, width: 3.6 * s, fill: P.snow, seed: seed + 5 + k });
    });

    // 身体
    const bcy = by - 98 * s;
    g.ellipse(x, bcy, 47 * s, 57 * s, { color: ink, width: lw, fill: P.snow, seed: seed + 20 });
    shade(g, x, bcy, 47 * s, 57 * s, seed + 21);
    C.dot(g, x + dir * 9 * s, bcy - 12 * s, 5.5 * s, ink, seed + 22);
    C.dot(g, x + dir * 10 * s, bcy + 14 * s, 5.5 * s, ink, seed + 23);

    // 头
    const hr = 55 * s;
    const hx = x + dir * 3 * s, hy = by - 198 * s;
    g.circle(hx, hy, hr, { color: ink, width: lw, fill: P.snow, seed: seed + 30 });
    shade(g, hx, hy, hr, hr, seed + 31);
    const look = o.look == null ? dir * 0.45 : o.look;
    const fx = hx + look * hr * 0.3;
    const fy = hy - (o.lookUp || 0) * hr * 0.3 + (o.lookDown || 0) * hr * 0.32;
    const ex = hr * 0.33, ey = fy - hr * 0.1;
    if (o.eyesClosed) {
      g.arc(fx - ex, ey + 2 * s, 8 * s, 0.25, Math.PI - 0.25, { color: ink, width: 3.4 * s, seed: seed + 32 });
      g.arc(fx + ex, ey + 2 * s, 8 * s, 0.25, Math.PI - 0.25, { color: ink, width: 3.4 * s, seed: seed + 33 });
    } else {
      C.dot(g, fx - ex, ey, 7 * s, ink, seed + 32);
      C.dot(g, fx + ex, ey, 7 * s, ink, seed + 33);
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(fx - ex + 2.2 * s, ey - 2.6 * s, 2.3 * s, 0, Math.PI * 2);
      ctx.arc(fx + ex + 2.2 * s, ey - 2.6 * s, 2.3 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    const blush = o.blush == null ? 0.6 : o.blush;
    if (blush > 0) {
      ctx.save();
      ctx.globalAlpha *= blush;
      ctx.fillStyle = P.pink;
      ctx.beginPath();
      ctx.ellipse(fx - ex - 7 * s, ey + 21 * s, 12 * s, 6.5 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(fx + ex + 7 * s, ey + 21 * s, 12 * s, 6.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    const my = ey + 36 * s;
    const mood = o.mood || 'happy';
    if (mood === 'happy') g.arc(fx - dir * 4 * s, my - 10 * s, 12 * s, 0.4, Math.PI - 0.4, { color: ink, width: 3.4 * s, seed: seed + 34 });
    else if (mood === 'o') g.ellipse(fx - dir * 4 * s, my - 2 * s, 5.5 * s, 7 * s, { color: ink, width: 3 * s, fill: '#6b3b44', seed: seed + 34 });
    else g.line(fx - dir * 4 * s - 7 * s, my - 2 * s, fx - dir * 4 * s + 7 * s, my - 1 * s, { color: ink, width: 3.4 * s, seed: seed + 34 });
    // 胡萝卜鼻子
    const cy0 = ey + 15 * s;
    const tipX = fx + dir * 40 * s, tipY = cy0 + 6 * s;
    g.poly([[fx - dir * 2 * s, cy0 - 8 * s], [tipX, tipY], [fx, cy0 + 8 * s]], { color: ink, width: 3 * s, fill: P.carrot, seed: seed + 35 });
    // 帽子
    C.hat(g, hx - dir * 3 * s, hy - hr * 0.86, 0.6 * s, -0.12 * dir + (o.hatTilt || 0), { seed: seed + 40 });
    // 围巾（绕脖子的那圈）
    const band = [[-50, -8], [-20, 4], [22, 4], [50, -8], [52, 12], [20, 26], [-22, 26], [-52, 12]].map((q) => [nx + q[0] * s, ny + q[1] * s]);
    g.curve(band, { color: ink, width: 3.8 * s, fill: P.red, closed: true, seed: seed + 41 });
    for (let k = 0; k < 4; k++) {
      const bx = nx + (-34 + k * 22) * s;
      g.line(bx, ny + 2 * s, bx + 4 * s, ny + 20 * s, { color: P.redDeep, width: 2.3 * s, seed: seed + 42 + k });
    }
    return reachEnd;
  }

  /** 梦里的"你"（剪影），可以伸出一只手（返回手腕和方向，手套最后再画） */
  function you(g, x, y, s, o = {}) {
    let mit = null;
    if (o.reach) {
      const sx = x - 46 * s, sy = y - 292 * s;
      const [mx, my] = o.reach;
      const dx = mx - sx, dy = my - sy, d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      const wl = 30 * s;
      const wx = mx - ux * wl, wy = my - uy * wl;
      const elx = lerp(sx, wx, 0.5) - 16 * s, ely = lerp(sy, wy, 0.5) + 4 * s;
      g.curve([[sx, sy], [elx, ely], [wx, wy]], { color: D.you, width: 27 * s, taper: false, seed: (o.seed | 0) + 90 });
      mit = { x: wx, y: wy, rot: Math.atan2(ux, -uy), s: 0.25 * s };
    }
    C.person(g, x, y, s, { color: D.you, walk: o.walk, t: o.t, seed: o.seed });
    return mit;
  }

  // ---------------------------------------------------------------- 梦里的雪原（S3 / S6）
  const V = 130;               // 行走速度 px/s
  const TS_YOU = Math.PI / 6;  // C.person 的步频：sin(t*6) 半个周期一步
  const TS_KID = 0.34;         // 小人步子更碎
  const KX = 830, KY = 822;    // 小人站位
  const YX = 1010, YY = 792;   // "你"站位

  function hills(g, off, baseY, amp, color, seed, line) {
    const pts = [[-100, H + 300]];
    for (let x = -100; x <= W + 100; x += 90) pts.push([x, baseY + noise1((x + off) / 420, seed) * amp + noise1((x + off) / 150, seed + 5) * amp * 0.25]);
    pts.push([W + 100, H + 300]);
    g.path(pts, { closed: true, smooth: true, color: line, width: 3, fill: color, seed, overshoot: false, jitter: 1.2 });
  }

  function sidePrints(g, anchorX, rowY, tl, Ts, kind, o = {}) {
    const ctx = g.ctx;
    const stride = V * Ts;
    const nNow = Math.floor(tl / Ts);
    const big = kind === 'you';
    ctx.save();
    for (let n = nNow; n > nNow - 80; n--) {
      const sx = anchorX + (n * stride - V * tl) + (big ? 8 : 4);
      if (sx < -60) break;
      if (sx > W + 60) continue;
      const alt = n & 1 ? 1 : -1;
      const yy = rowY + alt * (big ? 5 : 3.5) + 4;
      const age = tl - n * Ts;
      const pop = age < 0.12 ? lerp(1.35, 1, age / 0.12) : 1;
      const rx = (big ? 19 : 13) * pop, ry = (big ? 5.5 : 4.6) * pop;
      ctx.fillStyle = rgba(D.print, 0.55);
      ctx.beginPath();
      ctx.ellipse(sx, yy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba('#8f8cc4', 0.45);
      ctx.beginPath();
      ctx.ellipse(sx + 1, yy + 1, rx * 0.62, ry * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * 两个人在梦里的雪原上往右走。tl：这一段的本地时间（秒）。
   * o = {hold:0..1 牵手, numbers, lookUp, heart:0..1, t}
   */
  function walkWorld(g, tl, o = {}) {
    const ctx = g.ctx;
    const t = o.t == null ? g.info.songTime : o.t;
    const camX = V * tl;
    // 天
    g.bg([D.skyTop, D.skyMid, D.skyLow]);
    g.glow(1490, 230, 420, D.pink, 0.55);
    g.glow(1490, 230, 230, D.cream, 0.8);
    C.moon(g, 1490, 230, 92, { seed: 5 });
    for (let i = 0; i < 16; i++) {
      const x = rand(i, 51, 1) * W, y = 40 + rand(i, 51, 2) * 420;
      const tw = 0.5 + 0.5 * Math.sin(t * (1.5 + rand(i, 51, 3) * 2) + i * 1.7);
      sparkle(g, x - camX * 0.04, y, lerp(5, 15, rand(i, 51, 4)) * (0.6 + 0.4 * tw), 0.5 + 0.5 * tw, '#ffffff', 0);
    }
    cloud(g, ((300 - camX * 0.08 - t * 6) % 2400 + 2400) % 2400 - 300, 170, 1.1, '#ffffff', 0.55);
    cloud(g, ((1250 - camX * 0.08 - t * 6) % 2400 + 2400) % 2400 - 300, 380, 0.8, '#ffffff', 0.45);
    // 远山 / 中景树 / 地面（视差）
    hills(g, camX * 0.12, 600, 70, D.hill1, 11, rgba(D.soft, 0.45));
    hills(g, camX * 0.35, 680, 46, D.hill2, 12, rgba(D.soft, 0.5));
    const off2 = camX * 0.35;
    for (let i = Math.floor((off2 - 200) / 330); i <= Math.floor((off2 + W + 200) / 330); i++) {
      const wx = i * 330 + rand(i, 13, 1) * 160;
      const sx = wx - off2;
      const ty = 690 + noise1((sx + off2) / 420, 12) * 46 - 6;
      const ts = lerp(0.55, 1, rand(i, 13, 2));
      for (let k = 0; k < 3; k++) {
        const w0 = (64 - k * 14) * ts, yb = ty - k * 46 * ts, yt = yb - 78 * ts;
        g.poly([[sx - w0, yb], [sx, yt], [sx + w0, yb]], { color: rgba(D.soft, 0.55), width: 3, fill: D.pine, seed: i * 7 + k, jitter: 1.2 });
        g.path([[sx - w0 * 0.42, yt + 30 * ts], [sx, yt + 4], [sx + w0 * 0.42, yt + 30 * ts]], { color: '#ffffff', width: 6 * ts, seed: i * 7 + k + 3 });
      }
    }
    const gy = (x) => 742 + noise1((x + camX) / 360, 21) * 14;
    const gpts = [[-60, H + 60]];
    for (let x = -60; x <= W + 60; x += 80) gpts.push([x, gy(x)]);
    gpts.push([W + 60, H + 60]);
    g.path(gpts, { closed: true, smooth: true, fill: D.snow, color: P.ink, width: 4.2, overshoot: false, seed: 22 });
    // 雪面的小阴影
    for (let i = Math.floor(camX / 260) - 1; i < Math.floor((camX + W) / 260) + 2; i++) {
      const sx = i * 260 + rand(i, 23, 1) * 120 - camX;
      const sy = 900 + rand(i, 23, 2) * 120;
      g.curve([[sx - 50, sy], [sx, sy - 7], [sx + 50, sy]], { color: rgba(D.print, 0.7), width: 3, seed: i });
    }
    // 两串脚印
    sidePrints(g, YX, YY, tl, TS_YOU, 'you');
    sidePrints(g, KX, KY, tl, TS_KID, 'kid');

    // 人
    const hold = clamp(o.hold || 0);
    const M = [KX + 88, KY - 116];
    const mit = you(g, YX, YY, 1.0, { walk: true, t: tl, seed: 3, reach: hold > 0 ? M : null });
    kid(g, KX, KY, 0.86, {
      t, phase: (tl / TS_KID) * Math.PI, walk: 1, wind: 0.65,
      look: 0.5, lookUp: o.lookUp || 0, blush: o.blush == null ? 0.6 : o.blush,
      mood: 'happy', reach: hold > 0 ? M : null, seed: 7,
    });
    if (mit) {
      C.mitten(g, mit.x, mit.y, mit.s, mit.rot, { seed: 31 });
      g.circle(M[0] - 2, M[1] + 6, 10, { color: P.ink, width: 3, fill: P.snow, seed: 32 });
    }
    // 小人在数自己的步子：每走一步，头顶冒出一个数字
    if (o.numbers) {
      const nNow = Math.floor(tl / TS_KID);
      for (let n = nNow; n > nNow - 3; n--) {
        if (n < 1) break;
        const age = tl - n * TS_KID;
        const a = clamp(1.3 - age / 0.9);
        if (a <= 0) continue;
        const x = KX - 30 - age * 300, y = KY - 290 - age * 90 + (n % 2 ? -24 : 24);
        g.text(String(n), x, y, {
          font: 'latin', size: 92 - age * 16, color: P.ink, alpha: a, progress: clamp(age / 0.12), seed: n * 7, weight: 700,
          rot: (n % 2 ? 0.12 : -0.1), stroke: '#ffffff', strokeWidth: 9,
        });
      }
    }
    // 头顶的小心心
    if (o.heart > 0) {
      const hk = ease.outBack(clamp(o.heart * 1.6));
      const beat = 1 + 0.08 * Math.max(0, Math.sin(t * 7)) + 0.15 * (g.info.pulse || 0);
      const hy = lerp(560, 476, ease.out(clamp(o.heart)));
      const hx0 = KX + 62;
      C.heart(g, hx0, hy, 30 * hk * beat, { seed: 33 });
      sparkle(g, hx0 - 44, hy - 28, 12 * hk, 0.9);
      sparkle(g, hx0 + 46, hy + 14, 9 * hk, 0.9);
    }
    // 下雪（往左飘 = 镜头往右跟）
    g.snow({ t, count: 70, seed: 41, speed: [30, 70], size: [3, 10], wind: -V * 0.7, sway: 18, color: '#ffffff', alpha: 0.95 });
  }

  // ---------------------------------------------------------------- S1 合眼
  function shotClose(g, p, t) {
    const ctx = g.ctx;
    const q = seg(p, 0, 0.16);
    const dream = ease.inOut(seg(q, 0.42, 1));
    const closed = q > 0.4 || (q > 0.18 && q < 0.24);
    const smile = q > 0.58;
    g.bg([P.nightDeep, P.night, P.nightBlue]);
    nightStars(g, t, 40, 17, 1 - dream * 0.5);
    g.save();
    const z = lerp(1.04, 1.3, ease.inOut(q));
    g.camera(960, lerp(470, 440, q), z, 0, 0, 0);
    // 远处你家的窗光（虚）
    g.glow(1760, 430, 380, P.warm, 0.25 * (1 - dream));
    C.ground(g, 880, { seed: 7, color: mix(P.snow, '#c9d3ea', 0.35) });
    // 梦从脑袋后面亮起来
    g.glow(960, 420, lerp(260, 1000, dream), D.pink, 0.8 * dream);
    g.glow(960, 420, lerp(160, 620, dream), D.cream, 0.7 * dream);
    C.snowman(g, 960, 1064, 2.2, {
      mood: smile ? 'happy' : closed ? 'calm' : 'sad',
      eyesClosed: closed,
      blush: lerp(0.45, 1, dream),
      look: lerp(0.25, 0, seg(q, 0.1, 0.4)),
      lookUp: lerp(0.2, 0, seg(q, 0.1, 0.4)),
      wind: 0.12, seed: 1,
    });
    g.restore();
    // 梦的晕染：先用"滤色"把夜色提亮成粉蓝，再从边缘往里漫
    if (dream > 0) {
      const r0 = lerp(1250, 330, dream), r1 = lerp(1450, 1060, dream);
      const wx0 = 960, wy0 = 500;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const g1 = ctx.createRadialGradient(wx0, wy0, r0 * 0.5, wx0, wy0, r1);
      g1.addColorStop(0, rgba('#ffb3cf', 0.55 * dream));
      g1.addColorStop(0.55, rgba('#ff9cc4', 0.85 * dream));
      g1.addColorStop(1, rgba('#9ccbff', 1 * dream));
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      ctx.save();
      const g2 = ctx.createRadialGradient(wx0, wy0, r0, wx0, wy0, r1);
      g2.addColorStop(0, rgba(D.skyMid, 0));
      g2.addColorStop(0.5, rgba(D.skyMid, 0.45 * dream * dream));
      g2.addColorStop(1, rgba(D.skyTop, 0.9 * dream * dream));
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      bokeh(g, t, { count: 12, seed: 5, alpha: 0.75 * dream, rMin: 30, rMax: 110 });
    }
    g.snow({ t, count: 70, seed: 3, speed: [30, 80], size: [3, 11], wind: 10, color: mix(P.snow, D.pink, dream * 0.4), alpha: 0.9 });
    // zZ
    if (q > 0.45) {
      const za = seg(q, 0.45, 0.55);
      for (let k = 0; k < 3; k++) {
        const ph = (((t * 0.45 + k / 3) % 1) + 1) % 1;
        g.text(k === 1 ? 'Z' : 'z', 1250 + ph * 260 + Math.sin(ph * 6 + k) * 16, 300 - ph * 230, {
          font: 'latin', size: 64 + ph * 60, color: '#ffffff', alpha: za * Math.sin(ph * Math.PI), rot: -0.2, pop: false, seed: k, weight: 700,
          stroke: rgba(D.soft, 0.7), strokeWidth: 7,
        });
      }
    }
    // 晚安
    const tp = seg(q, 0.5, 0.78);
    if (tp > 0) {
      g.text('晚安', 330, 170, {
        vertical: true, size: 136, font: 'hand', color: '#ffffff', progress: tp, seed: 11,
        stroke: rgba(D.soft, 0.55), strokeWidth: 10,
      });
      sparkle(g, 410, 140, 22 * tp, tp);
      sparkle(g, 250, 470, 14 * tp, tp * 0.8);
    }
  }

  // ---------------------------------------------------------------- S2 变身
  function shotBecome(g, p, t) {
    const ctx = g.ctx;
    const q = seg(p, 0.16, 0.30);
    g.bg([D.skyTop, D.skyMid, D.skyLow]);
    bokeh(g, t, { count: 14, seed: 8, alpha: 0.55, rMin: 40, rMax: 140 });
    cloud(g, 220 + t * 8 % 200, 190, 1.2, '#ffffff', 0.6);
    cloud(g, 1560 - (t * 10) % 200, 820, 1.4, '#ffffff', 0.5);
    // 大字「梦」
    g.save();
    const zz = lerp(1.06, 1, ease.out(seg(q, 0, 0.3)));
    g.camera(960, 540, zz, 0, 0, 0);
    g.text('梦', 1470, 470, {
      font: 'brush', size: 640, color: 'rgba(255,255,255,0.9)', progress: seg(q, 0.02, 0.12), seed: 4,
      shadow: { color: rgba(D.pink, 0.95), dx: 16, dy: 16 },
    });
    g.restore();
    // 软软的雪坡
    g.glow(900, 860, 620, '#ffffff', 0.6);
    hills(g, 0, 812, 26, D.hill2, 14, rgba(D.soft, 0.5));
    g.path([[-80, H + 200], [-80, 900], [300, 868], [700, 858], [1100, 862], [1500, 880], [2000, 900], [2000, H + 200]], {
      closed: true, smooth: true, color: P.ink, width: 4.2, fill: D.snow, seed: 6, overshoot: false,
    });
    g.curve([[520, 950], [680, 960], [860, 962]], { color: rgba(D.print, 0.8), width: 3, seed: 7 });
    g.curve([[1180, 990], [1320, 984], [1440, 992]], { color: rgba(D.print, 0.8), width: 3, seed: 8 });

    const poof = seg(q, 0.28, 0.44);
    // 变身前：闭着眼的雪人
    if (q < 0.36) {
      const sway = Math.sin(t * 2.4) * 0.03;
      g.save();
      ctx.translate(900, 880);
      ctx.rotate(sway);
      C.snowman(g, 0, 0, 1.2, { eyesClosed: true, mood: 'happy', blush: 0.9, seed: 1, wind: 0.1 });
      g.restore();
      // 绕着他转的星星
      const ring = seg(q, 0, 0.3);
      for (let k = 0; k < 7; k++) {
        const a = t * 2.2 + (k / 7) * Math.PI * 2;
        const rr = lerp(160, 340, ring);
        sparkle(g, 900 + Math.cos(a) * rr, 600 + Math.sin(a) * rr * 0.55, lerp(8, 20, ring) * (0.7 + 0.3 * Math.sin(t * 9 + k)), ring, '#ffffff', a);
      }
    }
    // 变身后：白色小人
    if (q >= 0.36) {
      const hopK = seg(q, 0.42, 0.66);
      const hop = hopK > 0 && hopK < 1 ? Math.abs(Math.sin(hopK * Math.PI * 2)) * 46 * (1 - hopK * 0.4) : 0;
      const looking = q < 0.72;
      const joy = ease.outBack(seg(q, 0.74, 0.84));
      kid(g, 900, 884, 1.85, {
        t, dir: 1,
        phase: t * 9, walk: q > 0.45 && q < 0.72 ? 0.55 : 0,
        hop, look: looking ? 0.15 : 0.05,
        lookDown: looking ? 1 : 0, lookUp: looking ? 0 : 0.15,
        mood: q < 0.55 ? 'o' : 'happy',
        armsUp: looking ? 0.12 : joy, wave: !looking,
        blush: 0.8, wind: 0.35, seed: 7,
      });
      // 惊讶的小符号
      if (q > 0.44 && q < 0.7) {
        const a = seg(q, 0.44, 0.5);
        g.line(1060, 400, 1096, 352, { color: P.ink, width: 6, progress: a, seed: 81 });
        g.line(1096, 438, 1152, 418, { color: P.ink, width: 6, progress: a, seed: 82 });
        g.line(740, 400, 708, 354, { color: P.ink, width: 6, progress: a, seed: 83 });
      }
    }
    // 噗！
    if (poof > 0 && poof < 1) {
      const k = Math.sin(poof * Math.PI);
      ctx.save();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + 0.3;
        const d = lerp(40, 190, ease.out(poof)) * (0.8 + 0.4 * rand(i, 61, 1));
        const r = lerp(40, 110, rand(i, 61, 2)) * k;
        g.circle(900 + Math.cos(a) * d * 1.2, 640 + Math.sin(a) * d * 0.85, r * 1.25, { color: rgba(P.ink, 0.85), width: 4, fill: '#ffffff', seed: 60 + i });
      }
      g.circle(900, 640, 160 * k, { color: rgba(P.ink, 0.85), width: 4, fill: '#ffffff', seed: 70 });
      ctx.restore();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r0 = lerp(160, 300, poof), r1 = lerp(200, 420, poof);
        g.line(900 + Math.cos(a) * r0 * 1.2, 640 + Math.sin(a) * r0, 900 + Math.cos(a) * r1 * 1.2, 640 + Math.sin(a) * r1, { color: P.ink, width: 5, alpha: 1 - poof, seed: 71 + i });
      }
      g.text('poof!', 520, 330, { font: 'latin', size: 120, color: P.ink, rot: -0.14, alpha: clamp(k * 2), weight: 700, seed: 3, stroke: '#ffffff', strokeWidth: 12 });
    }
    // 手写：梦里，我有脚了
    const cap = seg(q, 0.5, 0.74);
    if (cap > 0) {
      const hl = seg(q, 0.7, 0.8);
      if (hl > 0) {
        ctx.save();
        ctx.globalAlpha *= 0.6;
        g.line(110, 452, 600, 458, { color: P.pink, width: 22, taper: false, seed: 24, progress: hl });
        ctx.restore();
      }
      g.text('梦里，\n我有脚了', 110, 340, { align: 'left', size: 112, color: P.ink, progress: cap, seed: 21, lineHeight: 1.3 });
      arrow(g, [[470, 530], [560, 760], [800, 880]], seg(q, 0.66, 0.8), { width: 5, seed: 25, head: 30 });
    }
    // 从上一镜硬切进来：一闪
    const fl = 1 - seg(q, 0, 0.1);
    if (fl > 0) {
      ctx.save();
      ctx.fillStyle = rgba('#fff6fb', fl * 0.9);
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------- S3 并肩
  function shotWalk(g, p, t, info) {
    const q = seg(p, 0.30, 0.48);
    const tl = t - 0.30 * info.dur + 0.2; // 一点偏移：开场时身后已经有几步脚印（S3 用负的步数补齐更早的脚印）
    g.save();
    const z = lerp(1.2, 1.28, ease.inOut(q));
    g.camera(lerp(900, 930, q), 610, z, 0, 0, 0);
    const look = seg(q, 0.55, 0.65) * (1 - seg(q, 0.92, 1));
    walkWorld(g, tl, { numbers: true, lookUp: look * 0.8, blush: lerp(0.6, 1, look), t });
    g.restore();
    bokeh(g, t, { count: 8, seed: 12, alpha: 0.35, rMin: 50, rMax: 140 });
    g.vignette(0.22, '#a58cc8');
  }

  // ---------------------------------------------------------------- S4 脚印（俯视）
  // 俯视的小松树
  function topTree(g, x, y, r, seed) {
    const ctx = g.ctx;
    ctx.save();
    ctx.fillStyle = rgba(D.soft, 0.22);
    ctx.beginPath();
    ctx.ellipse(x + r * 0.25, y + r * 0.3, r * 1.02, r * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const blob = (rr, k, ph) => {
      const pts = [];
      for (let i = 0; i < k; i++) {
        const a = ph + (i / k) * Math.PI * 2;
        const R = rr * (1 + 0.1 * Math.sin(a * 5 + seed) + 0.05 * Math.sin(a * 9 + seed * 2));
        pts.push([x + Math.cos(a) * R, y + Math.sin(a) * R]);
      }
      return pts;
    };
    g.path(blob(r, 22, seed), { closed: true, smooth: true, color: rgba(D.soft, 0.7), width: 3.5, fill: D.pine, seed, still: true });
    g.path(blob(r * 0.7, 18, seed + 1), { closed: true, smooth: true, color: rgba(D.soft, 0.45), width: 3, fill: '#d3dbf4', seed: seed + 1, still: true });
    for (let i = 0; i < 9; i++) {
      const a = seed * 3 + (i / 9) * Math.PI * 2;
      g.line(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3, x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86, { color: rgba(D.soft, 0.45), width: 3, seed: seed * 10 + i, still: true });
    }
    g.path(blob(r * 0.42, 14, seed + 2).map((q) => [q[0] - r * 0.12, q[1] - r * 0.14]), { closed: true, smooth: true, color: rgba(D.soft, 0.35), width: 2.5, fill: '#ffffff', seed: seed + 2, still: true });
  }

  function shotPrints(g, p, t) {
    const ctx = g.ctx;
    const q = seg(p, 0.48, 0.60);
    g.bg(['#f9f1f7', '#eeeffa']);
    // 两串脚印沿一条弧线走，越走越近
    const A = [-260, 1350], Cc = [820, 900], Z = [1900, -80];
    const B = (u) => [
      (1 - u) * (1 - u) * A[0] + 2 * u * (1 - u) * Cc[0] + u * u * Z[0],
      (1 - u) * (1 - u) * A[1] + 2 * u * (1 - u) * Cc[1] + u * u * Z[1],
    ];
    const T = (u) => {
      const dx = 2 * (1 - u) * (Cc[0] - A[0]) + 2 * u * (Z[0] - Cc[0]);
      const dy = 2 * (1 - u) * (Cc[1] - A[1]) + 2 * u * (Z[1] - Cc[1]);
      const d = Math.hypot(dx, dy) || 1;
      return [dx / d, dy / d];
    };
    const gap = (u) => lerp(420, 150, ease.inOut(clamp((u - 0.2) / 0.7)));
    const head = lerp(0.36, 0.8, ease.inOut(q));
    // 镜头跟着两个人走
    const hb = B(head);
    const camX = lerp(hb[0], 960, 0.25) - 60, camY = lerp(hb[1], 540, 0.25) + 70;
    const zc = lerp(1.18, 1.26, q), rot = -0.05;
    g.save();
    g.camera(camX, camY, zc, rot, 0, 0);
    for (let i = 0; i < 9; i++) g.glow(rand(i, 81, 1) * 2200 - 140, rand(i, 81, 2) * 1300 - 110, lerp(260, 480, rand(i, 81, 3)), i % 2 ? D.lilac : D.blue, 0.35);
    // 雪面上的小褶皱和闪光
    for (let i = 0; i < 30; i++) {
      const x = rand(i, 82, 1) * 2300 - 190, y = rand(i, 82, 2) * 1400 - 160;
      g.curve([[x - 46, y], [x, y - 8], [x + 46, y + 2]], { color: rgba(D.print, 0.6), width: 3, seed: 90 + i, still: true });
      sparkle(g, x + 60, y - 40, 8 * (0.4 + 0.6 * Math.sin(t * 3 + i * 1.3)), 0.9);
    }
    [[260, 330, 110], [1420, 900, 130], [1820, 520, 100], [560, -40, 120], [1120, 180, 90], [-60, 760, 120], [1050, 1240, 120]].forEach(([x, y, r], i) => topTree(g, x, y, r, i * 1.7));
    // 弧长表
    const N = 160, tab = [0];
    let prev = B(0);
    for (let i = 1; i <= N; i++) {
      const b = B(i / N);
      tab.push(tab[i - 1] + Math.hypot(b[0] - prev[0], b[1] - prev[1]));
      prev = b;
    }
    const uAt = (sLen) => {
      let lo = 0, hi = N;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tab[m] < sLen) lo = m; else hi = m; }
      return (lo + (sLen - tab[lo]) / Math.max(1e-6, tab[hi] - tab[lo])) / N;
    };
    const hi0 = Math.min(N - 1, Math.floor(head * N));
    const headLen = lerp(tab[hi0], tab[hi0 + 1], head * N - hi0);
    const pc = rgba('#8f8ac6', 0.7), pf = rgba('#aeaadc', 0.75);
    const trail = (side, step, lat, kind) => {
      for (let sl = 20; sl < headLen - 70; sl += step) {
        const u = uAt(sl);
        const b = B(u), tt = T(u);
        const nx = -tt[1], ny = tt[0];
        const k = Math.round(sl / step);
        const alt = k & 1 ? 1 : -1;
        const off = side * gap(u) / 2 + alt * lat;
        const x = b[0] + nx * off, y = b[1] + ny * off;
        const ang = Math.atan2(tt[1], tt[0]);
        const fresh = clamp((headLen - 70 - sl) / 50);
        const pop = lerp(1.3, 1, fresh);
        if (kind === 'you') {
          g.ellipse(x + tt[0] * 10, y + tt[1] * 10, 25 * pop, 13 * pop, { rot: ang, color: pc, width: 2.6, fill: pf, seed: k * 3 + 1 });
          g.ellipse(x - tt[0] * 24, y - tt[1] * 24, 12 * pop, 11 * pop, { rot: ang, color: pc, width: 2.4, fill: pf, seed: k * 3 + 2 });
        } else {
          g.ellipse(x, y, 17 * pop, 14 * pop, { rot: ang, color: pc, width: 2.4, fill: pf, seed: k * 5 + 3 });
        }
      }
    };
    trail(-1, 78, 20, 'you');
    trail(1, 50, 14, 'kid');
    // 走在最前面的两个人（俯视）
    const ht = T(head);
    const hn = [-ht[1], ht[0]];
    const ang = Math.atan2(ht[1], ht[0]);
    const gp = gap(head) / 2;
    const yx = hb[0] - hn[0] * gp, yy = hb[1] - hn[1] * gp;
    const bob = Math.sin(t * 9) * 3;
    const kx = hb[0] + hn[0] * gp + ht[0] * bob, ky = hb[1] + hn[1] * gp + ht[1] * bob;
    ctx.save();
    ctx.fillStyle = rgba(D.soft, 0.2);
    ctx.beginPath();
    ctx.ellipse(yx + 22, yy + 24, 70, 96, ang, 0, Math.PI * 2);
    ctx.ellipse(kx + 18, ky + 20, 64, 60, ang, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // "你"：大衣 + 头 + 两只红手套
    const sw = Math.sin(t * 6) * 16;
    const hands = [
      [yx + hn[0] * 80 + ht[0] * sw, yy + hn[1] * 80 + ht[1] * sw],
      [yx - hn[0] * 80 - ht[0] * sw, yy - hn[1] * 80 - ht[1] * sw],
    ];
    hands.forEach((h, i) => g.ellipse(h[0], h[1], 24, 19, { rot: ang, color: P.ink, width: 3.5, fill: P.red, seed: 40 + i }));
    g.ellipse(yx, yy, 58, 86, { rot: ang, color: P.ink, width: 3.5, fill: D.you, seed: 42 });
    g.circle(yx + ht[0] * 8, yy + ht[1] * 8, 40, { color: P.ink, width: 3.5, fill: '#3d2f45', seed: 43 });
    g.curve([[yx + ht[0] * 8 - hn[0] * 30, yy + ht[1] * 8 - hn[1] * 30], [yx - ht[0] * 14, yy - ht[1] * 14], [yx + ht[0] * 8 + hn[0] * 30, yy + ht[1] * 8 + hn[1] * 30]], { color: rgba('#ffffff', 0.18), width: 6, seed: 48 });
    // 小人：雪白的肩 + 帽子顶 + 红围巾尾巴
    const tw = Math.sin(t * 8) * 12;
    g.curve([
      [kx - ht[0] * 20, ky - ht[1] * 20],
      [kx - ht[0] * 70 + hn[0] * tw, ky - ht[1] * 70 + hn[1] * tw],
      [kx - ht[0] * 112 - hn[0] * tw, ky - ht[1] * 112 - hn[1] * tw],
    ], { color: P.red, width: 26, taper: false, seed: 44 });
    const ksw = Math.sin(t * 9) * 12;
    [1, -1].forEach((sd, i) => g.circle(kx + hn[0] * sd * 64 + ht[0] * ksw * sd, ky + hn[1] * sd * 64 + ht[1] * ksw * sd, 15, { color: P.ink, width: 3.5, fill: P.snow, seed: 55 + i }));
    // 帽檐前面露出一点胡萝卜尖
    g.poly([[kx + ht[0] * 44 + hn[0] * 9, ky + ht[1] * 44 + hn[1] * 9], [kx + ht[0] * 84, ky + ht[1] * 84], [kx + ht[0] * 44 - hn[0] * 9, ky + ht[1] * 44 - hn[1] * 9]], { color: P.ink, width: 3, fill: P.carrot, seed: 57 });
    g.ellipse(kx, ky, 58, 54, { rot: ang, color: P.ink, width: 4, fill: P.snow, seed: 45 });
    g.circle(kx, ky, 46, { color: P.ink, width: 3.5, fill: '#3b3552', seed: 46 });
    g.circle(kx, ky, 33, { color: P.ink, width: 3, fill: P.red, seed: 47 });
    g.circle(kx, ky, 25, { color: P.ink, width: 3, fill: '#3b3552', seed: 49 });
    g.restore();
    // 标注（跟着人走，用同样的镜头变换算屏幕坐标）
    const cam = (x, y) => {
      const dx = (x - camX) * zc, dy = (y - camY) * zc;
      return [960 + dx * Math.cos(rot) - dy * Math.sin(rot), 540 + dx * Math.sin(rot) + dy * Math.cos(rot)];
    };
    const ys = cam(yx, yy), ks = cam(kx, ky);
    const la = seg(q, 0.12, 0.32), lb = seg(q, 0.26, 0.46);
    if (la > 0) {
      const lx = ys[0] - 300, ly = ys[1] - 170;
      g.text('你', lx, ly, { size: 140, color: P.ink, progress: la, seed: 51, stroke: '#ffffff', strokeWidth: 12 });
      arrow(g, [[lx + 60, ly + 50], [lx + 140, ly + 110], [ys[0] - 100, ys[1] - 40]], seg(la, 0.3, 1), { width: 5, seed: 52, head: 24 });
    }
    if (lb > 0) {
      const lx = ks[0] + 280, ly = ks[1] + 130;
      g.text('我', lx, ly, { size: 140, color: P.ink, progress: lb, seed: 53, stroke: '#ffffff', strokeWidth: 12 });
      arrow(g, [[lx - 70, ly - 40], [lx - 150, ly - 80], [ks[0] + 90, ks[1] + 34]], seg(lb, 0.3, 1), { width: 5, seed: 54, head: 24 });
    }
    // 镜头前飘过的大雪花（虚）
    g.snow({ t, count: 26, seed: 85, speed: [60, 120], size: [8, 20], wind: 40, color: '#ffffff', alpha: 0.85, crystal: 14 });
    g.vignette(0.22, '#9d8fc8');
  }

  // ---------------------------------------------------------------- S5 牵手（特写）
  /** 一截圆头的胳膊/袖子：(x1,y1) 在画外，(x2,y2) 是圆头 */
  function capsule(g, x1, y1, x2, y2, r, o) {
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
    const pts = [[x1 + nx * r, y1 + ny * r]];
    for (let i = 0; i <= 10; i++) {
      const th = (i / 10) * Math.PI;
      pts.push([x2 + nx * r * Math.cos(th) + ux * r * Math.sin(th), y2 + ny * r * Math.cos(th) + uy * r * Math.sin(th)]);
    }
    pts.push([x1 - nx * r, y1 - ny * r]);
    g.path(pts, Object.assign({ closed: true, smooth: false, overshoot: false }, o));
    return { ux, uy, nx, ny };
  }

  function shotHands(g, p, t) {
    const ctx = g.ctx;
    const q = seg(p, 0.60, 0.72);
    const meet = ease.outCubic(seg(q, 0.0, 0.4));
    const touch = seg(q, 0.38, 0.46);
    const after = seg(q, 0.4, 1);
    g.bg([D.skyMid, '#f3dcec', D.blue]);
    const Mx = 925, My = 575;
    g.glow(Mx, My, lerp(520, 980, after), D.cream, lerp(0.4, 1, after));
    g.glow(Mx, My, lerp(260, 560, after), '#ffffff', 0.75 * after);
    bokeh(g, t, { count: 16, seed: 21, alpha: 0.6, rMin: 40, rMax: 150 });
    g.save();
    const squeeze = Math.sin(touch * Math.PI);
    const z = lerp(1.0, 1.08, ease.inOut(q)) * (1 + 0.015 * squeeze);
    g.camera(Mx, My, z, lerp(0.02, -0.012, q), 0, 0);
    // 小人（大特写，从左下探出来），手伸向右边
    const hx = lerp(700, 905, meet), hy = lerp(760, 590, meet) + squeeze * 6;
    const gotIt = q > 0.42;
    kid(g, lerp(380, 470, meet), 1330, 3.1, {
      t, dir: 1, reach: [hx - 40, hy + 14], wind: 0.5,
      look: 0.75, lookUp: lerp(0.2, 0.55, meet),
      mood: gotIt ? 'happy' : 'o', blush: lerp(0.6, 1.2, after), seed: 7,
    });
    g.circle(hx, hy, 70, { color: P.ink, width: 5, fill: P.snow, seed: 6 });
    g.arc(hx + 4, hy + 6, 48, 0.2, 1.7, { color: rgba(P.snowShade, 1), width: 10, seed: 7 });
    // 红手套 + "你"的袖子（从右上伸过来）
    const dir = [-0.94, 0.34];
    const wx = lerp(1900, hx + 250, meet), wy = lerp(300, hy - 80, meet) - squeeze * 4;
    capsule(g, wx - dir[0] * 900, wy - dir[1] * 900, wx - dir[0] * 20, wy - dir[1] * 20, 90, { color: P.ink, width: 5, fill: D.you, seed: 8 });
    g.curve([[wx - dir[0] * 160, wy - dir[1] * 160 - 58], [wx - dir[0] * 260, wy - dir[1] * 260 - 40], [wx - dir[0] * 380, wy - dir[1] * 380 - 54]], { color: rgba('#ffffff', 0.16), width: 8, seed: 11 });
    C.mitten(g, wx, wy, 1.45, Math.atan2(dir[0], -dir[1]), { seed: 9 });
    // 小人的"大拇指"搭在手套上 → 握住了
    if (touch > 0) {
      g.ellipse(hx + 40, hy - 56, 27 * ease.outBack(touch), 24 * ease.outBack(touch), { color: P.ink, width: 4.5, fill: P.snow, seed: 10 });
    }
    g.restore();
    // 握住的一瞬间：光圈 + 速度线
    if (touch > 0) {
      for (let k = 0; k < 2; k++) {
        const rk = seg(q, 0.4 + k * 0.08, 0.7 + k * 0.08);
        if (rk > 0 && rk < 1) g.circle(Mx, My, lerp(140, 620, ease.out(rk)), { color: '#ffffff', width: lerp(12, 2, rk), alpha: 1 - rk, seed: 12 + k });
      }
      const lk = seg(q, 0.4, 0.58);
      for (let i = 0; i < 11; i++) {
        const a = -Math.PI + 0.35 + (i / 10) * (Math.PI - 0.7);
        const r0 = lerp(230, 290, lk), r1 = lerp(280, 400, lk);
        g.line(Mx + Math.cos(a) * r0, My + Math.sin(a) * r0 * 0.9, Mx + Math.cos(a) * r1, My + Math.sin(a) * r1 * 0.9, { color: P.ink, width: 6, alpha: 1 - lk, seed: 20 + i });
      }
    }
    // 小心心往上飘
    for (let i = 0; i < 6; i++) {
      const hk = seg(q, 0.44 + i * 0.06, 0.84 + i * 0.06);
      if (hk <= 0 || hk >= 1) continue;
      const x = Mx + lerp(-260, 260, rand(i, 31, 1)) + Math.sin(hk * 6 + i) * 30;
      const y = My - 110 - hk * 420;
      ctx.save();
      ctx.globalAlpha *= 1 - seg(hk, 0.75, 1);
      C.heart(g, x, y, lerp(30, 54, rand(i, 31, 2)) * ease.outBack(clamp(hk * 4)), { seed: 30 + i, rot: (rand(i, 31, 3) - 0.5) * 0.5 });
      ctx.restore();
    }
    // 牵住了
    const tp = seg(q, 0.5, 0.74);
    if (tp > 0) {
      g.text('牵住了', 1430, 800, {
        font: 'brush', size: 160, color: P.ink, progress: tp, seed: 41, rot: -0.05,
        shadow: { color: P.pink, dx: 8, dy: 8 },
      });
    }
    g.snow({ t, count: 40, seed: 44, speed: [30, 60], size: [4, 12], wind: 10, color: '#ffffff', alpha: 0.9 });
  }

  // ---------------------------------------------------------------- S6 拉远 → 啵 → 醒来
  const BUB = [1250, 330], BUB_R = 250;
  const SM = [560, 905], SM_S = 1.05;

  function nightWorld(g, t, o) {
    g.bg([P.nightDeep, P.night, P.nightBlue]);
    nightStars(g, t, 60, 29, 1);
    C.moon(g, 230, 160, 54, { phase: 0.45, seed: 2 });
    // "你"家的墙和门（门一直关着）
    g.rect(1400, 300, 620, 600, { color: P.ink, width: 5, fill: '#283057', seed: 71 });
    for (let k = 0; k < 6; k++) g.line(1410, 360 + k * 90, 2000, 356 + k * 90, { color: rgba('#ffffff', 0.06), width: 3, seed: 72 + k });
    C.ground(g, 860, { seed: 4, color: mix(P.snow, '#c9d3ea', 0.3) });
    C.door(g, 1560, 440, 230, 410, { seed: 9, wreath: true });
    C.snowman(g, SM[0], SM[1], SM_S, o.sm);
  }

  function bubbleRim(g, cx, cy, rx, ry, a) {
    const ctx = g.ctx;
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha *= a;
    const gr = ctx.createRadialGradient(cx - rx * 0.15, cy - ry * 0.15, Math.min(rx, ry) * 0.5, cx, cy, Math.max(rx, ry) * 1.02);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.72, rgba(D.blue, 0.18));
    gr.addColorStop(0.9, rgba(D.pink, 0.5));
    gr.addColorStop(1, 'rgba(255,255,255,0.8)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    g.ellipse(cx, cy, rx, ry, { color: '#ffffff', width: 5, alpha: a, seed: 61 });
    const hl = [];
    for (let i = 0; i <= 10; i++) {
      const an = -2.75 + (i / 10) * 0.9;
      hl.push([cx + Math.cos(an) * rx * 0.8, cy + Math.sin(an) * ry * 0.8]);
    }
    g.path(hl, { color: '#ffffff', width: Math.max(6, rx * 0.05), alpha: 0.9 * a, seed: 62 });
    sparkle(g, cx + rx * 0.55, cy - ry * 0.55, Math.max(8, rx * 0.06), a);
  }

  // S6 内部时间点（整幕 p）：紧镜头牵手走 → 拉远成泡泡 → 抖 → 啵 → 惊醒 → 失落、「醒了」、眼泪，留足停顿
  const T6 = {
    walk1: 0.785, pull0: 0.785, pull1: 0.855, wob0: 0.852, pop: 0.87,
    startled1: 0.905, boFade0: 0.893, boFade1: 0.908, sad0: 0.905, sad1: 0.94,
    wake0: 0.913, wake1: 0.945, tear0: 0.92, tear1: 0.97, push0: 0.885,
  };

  function shotPop(g, p, t, info) {
    const ctx = g.ctx;
    const pull = ease.inOutCubic(seg(p, T6.pull0, T6.pull1));
    const popAt = T6.pop;
    const popped = p >= popAt;
    const pp = seg(p, popAt, popAt + 0.05);
    const wake = seg(p, popAt, 1);
    const tl = t - 0.72 * info.dur + 1.0;

    // 梦（全屏阶段）：牵着手走，镜头慢慢推近
    const zA = lerp(1.72, 1.86, ease.inOut(seg(p, 0.72, T6.walk1)));
    const FA = [915, 690];
    if (pull <= 0) {
      g.save();
      g.camera(FA[0], FA[1], zA, 0, 0, 0);
      walkWorld(g, tl, { hold: 1, lookUp: 0.9, blush: 1, heart: seg(p, 0.73, T6.walk1), t });
      g.restore();
      bokeh(g, t, { count: 8, seed: 12, alpha: 0.35, rMin: 50, rMax: 140 });
      g.vignette(0.22, '#a58cc8');
      return false;
    }

    // 夜（外面）
    const R = popped ? BUB_R : 1150 * Math.pow(BUB_R / 1150, pull);
    const zN = R / BUB_R;
    const cx = lerp(960, BUB[0], pull), cy = lerp(540, BUB[1], pull);
    const startled = popped && p < T6.startled1;
    const startK = seg(p, popAt, popAt + 0.012);
    const sadK = ease.inOut(seg(p, T6.sad0, T6.sad1));
    const sm = {
      eyesClosed: !popped,
      mood: !popped ? 'happy' : startled ? 'hope' : 'sad',
      blush: popped ? lerp(0.9, 0.35, seg(p, popAt, 0.94)) : 0.9,
      look: popped ? 0.55 : 0.1,
      lookUp: popped ? lerp(0.7, 0.35, seg(p, T6.sad1, T6.sad1 + 0.04)) : 0,
      // 吓一跳时树枝手一抬，失落后慢慢垂下来
      arms: popped ? [lerp(0.45 * startK, -0.32, sadK), lerp(0.45 * startK, -0.32, sadK)] : [0, 0],
      wind: 0.25, seed: 1,
      tear: seg(p, T6.tear0, T6.tear1),
    };
    g.save();
    const sh = popped && pp < 0.25 ? g.shake(10 * (1 - pp * 4)) : [0, 0];
    if (!popped) {
      g.camera(BUB[0], BUB[1], zN, 0, cx - 960, cy - 540);
    } else {
      // 醒来后慢慢推近雪人（门还留在画面右边）
      const pz = ease.inOut(seg(p, T6.push0, 1));
      g.camera(lerp(960, 900, pz), lerp(540, 590, pz), lerp(1, 1.15, pz), 0, sh[0], sh[1]);
    }
    // 泡泡还盖满整个画面时，外面的夜不用画
    const covered = !popped && [[0, 0], [W, 0], [0, H], [W, H]].every(([x, y]) => Math.hypot(x - cx, y - cy) < R * 0.97);
    if (!covered) nightWorld(g, t, { sm });
    // 惊醒：头边上冒出几根"吓一跳"的线
    if (startled) {
      const a = seg(p, popAt, popAt + 0.008);
      const hx = SM[0], hy = SM[1] - 300 * SM_S;
      [[-1, -0.5], [-1, 0.05], [1, -0.55], [1, 0]].forEach(([side, k], i) => {
        const r0 = 128, r1 = 175;
        const ang = -Math.PI / 2 + side * (1.0 + k * 1.1);
        g.line(hx + Math.cos(ang) * r0, hy + Math.sin(ang) * r0, hx + Math.cos(ang) * r1, hy + Math.sin(ang) * r1, { color: '#ffffff', width: 7, progress: a, seed: 120 + i });
      });
    }
    // 想象泡泡的小圆串
    const chain = popped ? 0 : seg(pull, 0.55, 1);
    if (chain > 0) {
      [[690, 498, 15], [790, 452, 24], [900, 404, 34]].forEach(([x, y, r], i) => {
        const k = ease.outBack(clamp(chain * 3 - i));
        if (k > 0) {
          g.glow(x, y, r * 2.2 * k, D.pink, 0.35);
          g.circle(x, y, r * k, { color: '#ffffff', width: 4, fill: rgba('#f7dcea', 0.92), seed: 64 + i });
        }
      });
    }
    g.restore();

    // 泡泡里的梦
    if (!popped) {
      const wob = seg(p, T6.wob0, popAt);
      const rx = R * (1 + Math.sin(t * 28) * 0.04 * wob), ry = R * (1 - Math.sin(t * 28) * 0.04 * wob);
      const k = zA * Math.pow(0.5 / zA, pull);
      const F = [FA[0], lerp(FA[1], 560, pull)];
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.translate(cx, cy);
      ctx.scale(k * (rx / R), k * (ry / R));
      ctx.translate(-F[0], -F[1]);
      walkWorld(g, tl, { hold: 1, lookUp: 0.9, blush: 1, heart: 1, t });
      ctx.restore();
      if (R < 900) {
        bubbleRim(g, cx, cy, rx, ry, clamp(pull * 3));
        g.glow(cx, cy, R * 1.5, D.pink, 0.25 * pull);
      } else g.ellipse(cx, cy, rx, ry, { color: '#ffffff', width: 5, alpha: clamp(pull * 3), seed: 61 });
    } else {
      // 啵！
      const fl = 1 - ease.out(seg(pp, 0, 0.35));
      if (fl > 0) {
        g.glow(BUB[0], BUB[1], BUB_R * 1.8, '#ffffff', 0.95 * fl);
        g.glow(BUB[0], BUB[1], BUB_R * 2.4, D.pink, 0.6 * fl);
      }
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + 0.1;
        const r0 = lerp(BUB_R * 0.7, BUB_R * 1.3, ease.out(pp)), r1 = lerp(BUB_R * 0.95, BUB_R * 1.75, ease.out(pp));
        g.line(BUB[0] + Math.cos(a) * r0, BUB[1] + Math.sin(a) * r0, BUB[0] + Math.cos(a) * r1, BUB[1] + Math.sin(a) * r1, {
          color: i % 2 ? '#ffffff' : D.pink, width: 6, alpha: 1 - pp, seed: 100 + i,
        });
      }
      // 碎片：粉蓝色的小水珠往外飞，然后慢慢落下变成雪
      const fall = seg(p, popAt, 1);
      for (let i = 0; i < 28; i++) {
        const a = rand(i, 77, 1) * Math.PI * 2;
        const sp = lerp(0.6, 1.5, rand(i, 77, 2));
        const out = ease.outCubic(clamp(fall * 3)) * BUB_R * sp;
        const x = BUB[0] + Math.cos(a) * (BUB_R * 0.8 + out) + Math.sin(t * 2 + i) * 10 * fall;
        const y = BUB[1] + Math.sin(a) * (BUB_R * 0.8 + out) + fall * fall * lerp(200, 520, rand(i, 77, 3));
        const col = [D.pink, D.blue, D.lilac, D.cream][i % 4];
        const fade = 1 - seg(fall, 0.5, 1);
        const r = lerp(6, 14, rand(i, 77, 4)) * (1 - fall * 0.4);
        g.glow(x, y, r * 3, col, 0.6 * fade);
        if (i % 3 === 0) sparkle(g, x, y, r * 1.4, fade, mix(col, '#ffffff', fall));
        else {
          ctx.save();
          ctx.globalAlpha *= fade;
          ctx.fillStyle = mix(col, '#ffffff', fall);
          ctx.beginPath();
          ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      const ta = seg(p, popAt, popAt + 0.012);
      const tFade = 1 - seg(p, T6.boFade0, T6.boFade1);
      if (tFade > 0) {
        g.text('啵！', BUB[0] + 20, BUB[1] - 10 - 30 * seg(p, T6.boFade0, T6.boFade1), {
          font: 'brush', size: 220, color: '#ffffff', progress: ta, alpha: tFade, rot: -0.1, seed: 5, spacing: -70,
          stroke: P.ink, strokeWidth: 16, shadow: { color: D.pink, dx: 10, dy: 10 },
        });
      }
      // 醒了（雪人望着泡泡消失的那片天）
      const wk = seg(p, T6.wake0, T6.wake1);
      if (wk > 0) {
        g.text('醒了', 1250, 170, {
          vertical: true, size: 150, font: 'hand', color: '#ffffff', progress: wk, seed: 9,
          stroke: 'rgba(18,23,41,0.6)', strokeWidth: 10,
        });
        // 一个小小的句点，晚一拍落下
        const dk = seg(p, T6.wake1 + 0.01, T6.wake1 + 0.02);
        if (dk > 0) g.circle(1250, 170 + 150 * 2.1 + 40, 9 * ease.outBack(dk), { color: '#ffffff', width: 4, fill: '#ffffff', seed: 10 });
      }
    }
    // 雪：醒来后慢慢变大
    g.snow({ t, count: popped ? lerp(60, 120, wake) : 60, seed: 9, speed: [30, 80], size: [3, 10], wind: 14, color: P.snow, alpha: 0.9 });
    g.vignette(lerp(0.15, 0.4, wake), '#05060d');
    // 返回：画面底部（歌词那一带）是不是已经是夜色
    if (popped) return true;
    const ry = R, lx = 960 - cx, ly = 990 - cy;
    return Math.hypot(lx, ly) > ry * 0.98;
  }

  TG.scene({
    id: 'dream',
    title: '梦',
    dark: true,
    transition: 'fade',
    chars: '晚安梦里我有脚了，你牵住啵！醒',
    lyrics: 'none',
    draw(g, p, t, info) {
      let darkLyric;
      if (p < 0.16) { shotClose(g, p, t); darkLyric = p < 0.12; }
      else if (p < 0.30) { shotBecome(g, p, t); darkLyric = false; }
      else if (p < 0.48) { shotWalk(g, p, t, info); darkLyric = false; }
      else if (p < 0.60) { shotPrints(g, p, t); darkLyric = false; }
      else if (p < 0.72) { shotHands(g, p, t); darkLyric = false; }
      else { darkLyric = shotPop(g, p, t, info); }
      g.lyric(info.lyric, { dark: darkLyric });
    },
  });
})();
