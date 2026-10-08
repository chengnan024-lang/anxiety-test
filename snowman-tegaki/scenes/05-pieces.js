/* 场景：pieces —— 一片一片（副歌一）
 *
 * 分镜（按 p 切镜头，任何时长都成立；雪、星光闪烁、雪花自转这些固定节奏的动效用 t）：
 *   ① 0.00–0.17  啪·啪·啪：深蓝底，三片巨大的雪花一片、一片、一片地"啪"出现（冲击线 + 镜头一顿），
 *                每片下面手写 1 / 2 / 3
 *   ② 0.17–0.30  微距：一片巨大的雪花像晶体一样长出来，左边竖排写「每一片 / 都不一样」，旁边小雪花接连弹出
 *   ③ 0.30–0.58  拼图：雪花散落满屏 → 夜空里浮出虚线"卡槽"和淡淡的底稿 → 雪花一片接一片飞过去、转正、"咔"地卡进去，
 *                星座连线一段段画出；只有最后一块是红手套。左上角计数 n / 26
 *   ④ 0.58–0.72  红线：特写两人之间，一根红线从雪人的树枝手连到红手套，中间打成一颗心；写出「我」「你」
 *   ⑤ 0.72–1.00  拉远：镜头一路拉到夜空，原来是一个星座；雪原、远处"你"家的暖窗、小小的雪人仰头望着它，
 *                星图上写出「雪人座」，雪人害羞地挥手
 */
(function () {
  'use strict';
  const { clamp, lerp, seg, ease, rand, rgba } = TG.U;
  const P = TG.PAL, C = TG.C, W = TG.W, H = TG.H;
  const TAU = Math.PI * 2, SIXTH = Math.PI / 3;

  const CUT = [0, 0.17, 0.3, 0.58, 0.72, 1];
  const ICE = '#f4f8ff', ICE_LINE = '#8fa8e0', STAR = '#fff6dc', LINK = '#d5e0ff';
  const SHADOW_INK = '#33478c';
  const SKY = ['#0b1024', '#141c3b', '#1d2a56'];

  // ================================================================ 雪花
  // 每种雪花的分叉：[离中心的位置, 长度, 角度]；hex = 中心六边形；tip = 末端形状
  const TYPES = [
    { br: [[0.36, 0.3, SIXTH], [0.64, 0.22, SIXTH]], hex: 0, tip: 0 },              // 树枝状
    { br: [[0.56, 0.2, SIXTH]], hex: 0.3, tip: 1 },                                   // 扇形板
    { br: [[0.26, 0.24, 0.9], [0.44, 0.22, 0.9], [0.6, 0.17, 0.9], [0.75, 0.11, 0.9]], hex: 0, tip: 0 }, // 蕨叶
    { br: [[0.7, 0.17, SIXTH]], hex: 0.2, hex2: 0.46, tip: 2 },                       // 星盘
  ];

  /**
   * 六瓣雪花。grow 0..1：像晶体一样从中心长出来（所有瓣同时）。
   * o = {rot, type, grow, alpha, width, color, under(冰蓝底描), glow, simple(只画一对分叉), seed, jitter}
   */
  function flake(g, x, y, r, o) {
    o = o || {};
    const a = o.alpha == null ? 1 : o.alpha;
    if (a <= 0.01 || r < 1.5) return;
    const ctx = g.ctx;
    const T = TYPES[(o.type || 0) % TYPES.length];
    const rot = o.rot || 0;
    const grow = o.grow == null ? 1 : clamp(o.grow);
    const w = o.width || Math.max(1.5, r * 0.05);
    const col = o.color || ICE;
    const seed = o.seed | 0;
    const jit = o.jitter == null ? Math.min(1.7, 0.5 + r * 0.008) : o.jitter;
    const brs = o.simple ? T.br.slice(0, 1) : T.br;
    if (o.glow) g.glow(x, y, r * 1.55, '#a9c2ff', 0.32 * o.glow * a);
    ctx.save();
    ctx.globalAlpha *= a;
    const passes = o.under ? [[ICE_LINE, 2.3, 0.5], [col, 1, 1]] : [[col, 1, 1]];
    passes.forEach(([c, wm, al], pi) => {
      const L = (x1, y1, x2, y2, ww, s) => {
        if (Math.abs(x2 - x1) + Math.abs(y2 - y1) < 1) return;
        g.line(x1, y1, x2, y2, { color: c, width: ww * wm, alpha: al, jitter: jit, seed: s + pi * 517 });
      };
      for (let k = 0; k < 6; k++) {
        const an = rot + k * SIXTH;
        const ca = Math.cos(an), sa = Math.sin(an);
        const len = r * grow;
        L(x, y, x + ca * len, y + sa * len, w, seed + k * 13);
        brs.forEach(([d, bl, ba], j) => {
          const kk = clamp(((grow - d) / (1 - d)) * 1.7);
          if (kk <= 0) return;
          const bx = x + ca * r * d, by = y + sa * r * d;
          for (const side of [-1, 1]) {
            const ang = an + side * ba;
            L(bx, by, bx + Math.cos(ang) * r * bl * kk, by + Math.sin(ang) * r * bl * kk, w * 0.78, seed + k * 13 + j * 2 + (side > 0) + 3);
          }
        });
        if (T.tip && grow > 0.9 && !o.simple) {
          const kk = clamp((grow - 0.9) / 0.1);
          const tx = x + ca * r, ty = y + sa * r;
          const d0 = T.tip === 1 ? 0.8 : 0.86;
          for (const side of [-1, 1]) {
            const px = x + ca * r * (T.tip === 1 ? 0.9 : d0) - sa * side * r * 0.09, py = y + sa * r * (T.tip === 1 ? 0.9 : d0) + ca * side * r * 0.09;
            if (T.tip === 1) {
              const bx = x + ca * r * d0, by = y + sa * r * d0;
              L(bx, by, lerp(bx, px, kk), lerp(by, py, kk), w * 0.7, seed + k * 13 + 9 + (side > 0));
              L(px, py, lerp(px, tx, kk), lerp(py, ty, kk), w * 0.7, seed + k * 13 + 11 + (side > 0));
            } else {
              L(tx, ty, lerp(tx, px, kk), lerp(ty, py, kk), w * 0.7, seed + k * 13 + 9 + (side > 0));
            }
          }
        }
      }
      [T.hex, T.hex2].forEach((hr, j) => {
        if (!hr || grow <= hr || (o.simple && j)) return;
        const pts = [];
        for (let k = 0; k < 6; k++) pts.push([x + Math.cos(rot + k * SIXTH) * r * hr, y + Math.sin(rot + k * SIXTH) * r * hr]);
        g.path(pts, { closed: true, color: c, width: w * 0.75 * wm, alpha: al, jitter: jit, progress: clamp((grow - hr) * 4), seed: seed + 90 + j + pi * 517 });
      });
    });
    // 中心的小亮点
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.5, w * 0.9) * clamp(grow * 3), 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /** 漫画式"啪"的冲击线 + 一圈冲击波。k 0..1 是这次"啪"的生命周期 */
  function burst(g, x, y, r, k, seed, color, n) {
    if (k <= 0 || k >= 1) return;
    n = n || 14;
    const outer = ease.outCubic(clamp(k / 0.5)), inner = ease.inCubic(clamp((k - 0.15) / 0.85));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (rand(i, seed, 1) - 0.5) * 0.35;
      const L = r * (0.28 + 0.32 * rand(i, seed, 2));
      const r0 = r * 1.1 + L * inner, r1 = r * 1.1 + L * outer;
      if (r1 - r0 < 3) continue;
      g.line(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, {
        color, width: (4 + 5 * rand(i, seed, 3)) * Math.max(0.5, r / 200), seed: seed + i,
      });
    }
    g.circle(x, y, r * (0.9 + 0.5 * ease.outCubic(k)), { color, width: Math.max(1, 5 * (1 - k) * Math.max(0.5, r / 200)), alpha: 1 - k, seed: seed + 50 });
  }

  /** 四角星芒 */
  function sparkle(g, x, y, r, color, a) {
    if (a <= 0.01 || r <= 0.5) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r * 0.62, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r * 0.62, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
    ctx.restore();
  }

  /** 屏幕空间的星星（闪烁） */
  function stars(g, t, n, seed, a, maxY) {
    if (a <= 0.01) return;
    const ctx = g.ctx;
    ctx.save();
    const base = ctx.globalAlpha;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < n; i++) {
      const x = rand(i, seed, 1) * W, y = rand(i, seed, 2) * (maxY || H);
      const tw = 0.5 + 0.5 * Math.sin(t * (1.1 + rand(i, seed, 3) * 2.4) + i * 1.7);
      ctx.globalAlpha = base * a * (0.25 + 0.75 * tw) * (0.3 + 0.7 * rand(i, seed, 5));
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + rand(i, seed, 4) * 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 跟着镜头走的星星（拉远时越来越多，有"往后退"的感觉） */
  function worldStars(g, cam, t, n, seed, a, maxSY) {
    const ctx = g.ctx;
    ctx.save();
    const base = ctx.globalAlpha;
    ctx.fillStyle = '#ffffff';
    const zr = clamp(Math.pow(cam.z, 0.35), 0.75, 1.4);
    for (let i = 0; i < n; i++) {
      const sx = cam.x(lerp(-2400, 2500, rand(i, seed, 1))), sy = cam.y(lerp(-1500, 1100, rand(i, seed, 2)));
      if (sx < -10 || sx > W + 10 || sy < -10 || sy > maxSY) continue;
      const tw = 0.5 + 0.5 * Math.sin(t * (0.9 + rand(i, seed, 3) * 2.2) + i * 2.3);
      ctx.globalAlpha = base * a * (0.3 + 0.7 * tw) * (0.35 + 0.65 * rand(i, seed, 5));
      const r = (0.8 + rand(i, seed, 4) * rand(i, seed, 6) * 2.6) * zr;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // ================================================================ 镜头
  function mkCam(cx, cy, z, ax, ay) {
    return { cx, cy, z, ax, ay, x: (wx) => ax + (wx - cx) * z, y: (wy) => ay + (wy - cy) * z };
  }
  function applyCam(g, cam) {
    g.ctx.translate(cam.ax, cam.ay);
    g.ctx.scale(cam.z, cam.z);
    g.ctx.translate(-cam.cx, -cam.cy);
  }

  // ================================================================ 星座（世界坐标）
  // 星座里的"雪人"和"你"，和 C.snowman / C.person 的比例完全一致（节点就取在它们的轮廓上）
  const SN = { x: -260, y: 264, s: 1.25, arms: [0.05, 0.3], look: 0.55 };
  const YOU = { x: 330, y: 270, s: 1.3 };
  const MIT = { x: 150, y: -6, s: 0.34, rot: -1.25 }; // 红手套（"你"伸过来的手）
  const CEN = { x: -63, y: -7 };                       // 整个星座的中心

  const NODES = [];
  const IDX = {};
  (function build() {
    const s = SN.s, x = SN.x, y = SN.y;
    const bodyRx = 132 * s, bodyRy = 118 * s, bodyCy = y - bodyRy;
    const headR = 80 * s, headCy = bodyCy - bodyRy * 0.82 - headR * 0.92;
    const tilt = SN.look * 0.06;
    const rotP = (px, py, a) => [px * Math.cos(a) - py * Math.sin(a), px * Math.sin(a) + py * Math.cos(a)];
    const hatRel = rotP(-6 * s, -headR * 0.86, tilt);
    const hatAt = (px, py) => { const q = rotP(px * s, py * s, tilt - 0.12); return [x + hatRel[0] + q[0], headCy + hatRel[1] + q[1]]; };
    const onE = (cx, cy, rx, ry, deg) => [cx + Math.cos((deg * Math.PI) / 180) * rx, cy + Math.sin((deg * Math.PI) / 180) * ry];
    const arm = (side, raise) => {
      const bx = x + side * bodyRx * 0.86, by = bodyCy - bodyRy * 0.35;
      const A = side === -1 ? Math.PI + 0.45 + raise : -0.45 - raise;
      return [bx + Math.cos(A) * 120 * s, by + Math.sin(A) * 120 * s];
    };
    const add = (name, pt, size, who) => { IDX[name] = NODES.length; NODES.push({ name, x: pt[0], y: pt[1], size, who }); };
    // 雪人：帽子 → 头 → 身体 → 手
    add('brimL', hatAt(-70, 0), 15, 0);
    add('crownL', hatAt(-40, -78), 17, 0);
    add('crownR', hatAt(42, -80), 23, 0);
    add('brimR', hatAt(70, 0), 15, 0);
    add('headL', onE(x, headCy, headR, headR, 160), 16, 0);
    add('headR', onE(x, headCy, headR, headR, 20), 18, 0);
    add('neckL', onE(x, headCy, headR, headR, 115), 13, 0);
    add('neckR', onE(x, headCy, headR, headR, 65), 13, 0);
    add('b210', onE(x, bodyCy, bodyRx, bodyRy, 210), 16, 0);
    add('b160', onE(x, bodyCy, bodyRx, bodyRy, 160), 15, 0);
    add('b110', onE(x, bodyCy, bodyRx, bodyRy, 110), 17, 0);
    add('b70', onE(x, bodyCy, bodyRx, bodyRy, 70), 15, 0);
    add('b20', onE(x, bodyCy, bodyRx, bodyRy, 20), 21, 0);
    add('b330', onE(x, bodyCy, bodyRx, bodyRy, 330), 15, 0);
    add('armL', arm(-1, SN.arms[0]), 17, 0);
    add('armR', arm(1, SN.arms[1]), 20, 0);
    // "你"：头 → 肩 → 衣摆 → 脚 → 最后是红手套
    const ys = YOU.s, yx = YOU.x, yy = YOU.y;
    const Y = (px, py) => [yx + px * ys, yy + py * ys];
    add('top', Y(0, -414), 22, 1);
    add('pHL', Y(-46, -366), 15, 1);
    add('pHR', Y(46, -366), 15, 1);
    add('shL', Y(-56, -280), 16, 1);
    add('shR', Y(56, -280), 16, 1);
    add('hemL', Y(-62, -150), 15, 1);
    add('hemR', Y(66, -150), 17, 1);
    add('ftL', Y(-24, 0), 14, 1);
    add('ftR', Y(24, 0), 14, 1);
    add('hand', [MIT.x, MIT.y], 22, 2);
  })();
  const N = NODES.length;

  // 连线（按名字）
  const LINKS = [
    ['brimL', 'crownL'], ['crownL', 'crownR'], ['crownR', 'brimR'], ['brimR', 'brimL'],
    ['brimL', 'headL'], ['headL', 'neckL'], ['neckL', 'neckR'], ['neckR', 'headR'], ['headR', 'brimR'],
    ['neckL', 'b210'], ['b210', 'b160'], ['b160', 'b110'], ['b110', 'b70'], ['b70', 'b20'], ['b20', 'b330'], ['b330', 'neckR'],
    ['b210', 'armL'], ['b330', 'armR'],
    ['top', 'pHL'], ['top', 'pHR'], ['pHL', 'shL'], ['pHR', 'shR'], ['shL', 'shR'],
    ['shL', 'hemL'], ['shR', 'hemR'], ['hemL', 'hemR'], ['hemL', 'ftL'], ['hemR', 'ftR'],
    ['shL', 'hand'],
  ].map(([a, b]) => [IDX[a], IDX[b]]);

  // 拼图：每一块从散落的位置飞进卡槽。散落位置 = 打乱后的网格 + 抖动（加载时算好的常量）
  const COLS = 7, ROWS = 4;
  const PERM = Array.from({ length: COLS * ROWS }, (_, i) => i).sort((a, b) => rand(a, 91) - rand(b, 91));
  const L0 = 0.34, L1 = 0.51, FLY = 0.042;
  const PIECES = NODES.map((nd, i) => {
    const cell = PERM[i], col = cell % COLS, row = Math.floor(cell / COLS);
    return {
      fx: lerp(-930, 800, (col + 0.5 + (rand(i, 77, 1) - 0.5) * 0.55) / COLS),
      fy: lerp(-440, 300, (row + 0.5 + (rand(i, 77, 2) - 0.5) * 0.5) / ROWS),
      r0: 46 + rand(i, 77, 3) * 30,
      type: Math.floor(rand(i, 77, 4) * 4),
      rot0: rand(i, 77, 5) * TAU,
      spin: (rand(i, 77, 6) - 0.5) * 1.4,
      bend: rand(i, 77, 7) < 0.5 ? -1 : 1,
      ls: L0 + (i / (N - 1)) * (L1 - L0), // 起飞时间（按 NODES 的顺序：帽子 → … → 红手套）
      appear: 0.3 + (cell / (COLS * ROWS)) * 0.03,
    };
  });

  /** 第 i 块现在在哪、多大、转了多少；state: 0 漂着 / 1 飞行中 / 2 已落位 */
  function pieceAt(i, p, t) {
    const pc = PIECES[i], nd = NODES[i];
    const k = seg(p, pc.ls, pc.ls + FLY);
    const rotF = pc.rot0 + t * pc.spin;
    const bob = Math.sin(t * 1.3 + i * 1.9) * 9;
    const fx = pc.fx + Math.sin(t * 0.5 + i) * 6, fy = pc.fy + bob;
    if (k <= 0) return { x: fx, y: fy, r: pc.r0, rot: rotF, state: 0, k: 0 };
    const tgtRot = -Math.PI / 2;
    if (k >= 1) return { x: nd.x, y: nd.y, r: nd.size, rot: tgtRot, state: 2, k: 1 };
    const e = ease.inOutCubic(k);
    const mx = (fx + nd.x) / 2, my = (fy + nd.y) / 2;
    const dx = nd.x - fx, dy = nd.y - fy;
    const cx = mx - dy * 0.35 * pc.bend, cy = my + dx * 0.35 * pc.bend;
    const u = 1 - e;
    return {
      x: u * u * fx + 2 * u * e * cx + e * e * nd.x,
      y: u * u * fy + 2 * u * e * cy + e * e * nd.y,
      r: lerp(pc.r0, nd.size, ease.inCubic(k)) * (1 + Math.sin(k * Math.PI) * 0.15),
      rot: lerp(rotF, tgtRot + pc.bend * TAU * 0.5, e) - pc.bend * TAU * 0.5 * e,
      state: 1, k,
    };
  }

  /** 节点在屏幕上的尺寸系数：拉远时别缩得太小，推近时别放得太大 */
  const zEff = (z) => Math.pow(z, 0.62);

  /** 星座底稿：半透明的雪人和"你"（像古星图上画的星座人物） */
  function ghost(g, cam, a, t, mood, blush) {
    if (a <= 0.01) return;
    const ctx = g.ctx;
    ctx.save();
    applyCam(g, cam);
    ctx.globalAlpha *= a;
    // "你"伸出来的手臂（袖子）
    const sh = [YOU.x - 50 * YOU.s, YOU.y - 268 * YOU.s];
    const dir = [Math.sin(MIT.rot), -Math.cos(MIT.rot)];
    const wrist = [MIT.x - dir[0] * 70 * MIT.s, MIT.y - dir[1] * 70 * MIT.s];
    g.line(sh[0], sh[1], wrist[0] - dir[0] * 4, wrist[1] - dir[1] * 4, { color: '#f0d3ad', width: 30 * YOU.s, taper: false, seed: 301 });
    C.person(g, YOU.x, YOU.y, YOU.s, { color: '#f0d3ad', scarf: true, seed: 310 });
    C.snowman(g, SN.x, SN.y, SN.s, { mood, look: SN.look, arms: SN.arms, blush, wind: 0.25, t, seed: 330, outline: '#e3ebff' });
    ctx.restore();
  }

  /** 拼好的星座：连线 + 星（雪花）+ 红手套 + 红线 + 心 */
  function constellation(g, cam, p, t, o) {
    const ctx = g.ctx;
    const ze = zEff(cam.z);
    const info = g.info;
    const pulse = info.pulse || 0;
    const lineA = o.lineA == null ? 1 : o.lineA;
    // 1. 卡槽（虚线小圈）——还没落位的块
    if (o.slots) {
      for (let i = 0; i < N; i++) {
        const pc = PIECES[i], nd = NODES[i];
        const sa = seg(p, 0.315 + i * 0.0012, 0.335 + i * 0.0012) * (1 - seg(p, pc.ls + FLY * 0.8, pc.ls + FLY));
        if (sa <= 0.01) continue;
        const sx = cam.x(nd.x), sy = cam.y(nd.y), rr = nd.size * 1.45 * ze;
        for (let j = 0; j < 5; j++) {
          const a0 = j * (TAU / 5) + t * 0.6 + i;
          g.arc(sx, sy, rr, a0, a0 + TAU / 10, { color: LINK, width: 2.2, alpha: 0.55 * sa, jitter: 0.6, seed: 900 + i * 7 + j });
        }
      }
    }
    // 2. 连线
    LINKS.forEach(([a, b], li) => {
      const ka = PIECES[a].ls + FLY, kb = PIECES[b].ls + FLY;
      const k = o.allLanded ? 1 : seg(p, Math.max(ka, kb), Math.max(ka, kb) + 0.022);
      if (k <= 0) return;
      const A = NODES[a], B = NODES[b];
      // 线从星的边上开始，不压住星
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      const x1 = A.x + ux * A.size * 0.9, y1 = A.y + uy * A.size * 0.9;
      const x2 = B.x - ux * B.size * 0.9, y2 = B.y - uy * B.size * 0.9;
      const ex = lerp(x1, x2, ease.out(k)), ey = lerp(y1, y2, ease.out(k));
      g.line(cam.x(x1), cam.y(y1), cam.x(ex), cam.y(ey), { color: LINK, width: 2.6 * ze, alpha: 0.75 * lineA, jitter: 1, seed: 700 + li });
    });
    // 3. 红线（雪人的手 → 红手套）+ 心
    const thread = o.thread || 0;
    const A = NODES[IDX.armR];
    const dir = [Math.sin(MIT.rot), -Math.cos(MIT.rot)];
    const tip = [MIT.x + dir[0] * 64 * MIT.s, MIT.y + dir[1] * 64 * MIT.s];
    const mid = [(A.x + tip[0]) / 2, (A.y + tip[1]) / 2 + 34];
    if (thread > 0) {
      const pts = [[A.x + 8, A.y + 4], [lerp(A.x, mid[0], 0.5), lerp(A.y, mid[1], 0.75) + 6], mid, [lerp(mid[0], tip[0], 0.5), lerp(mid[1], tip[1], 0.25) + 6], tip].map((q) => [cam.x(q[0]), cam.y(q[1])]);
      g.curve(pts, { color: rgba(P.red, 0.35), width: 13 * ze, progress: thread, jitter: 1, seed: 801, taper: false });
      g.curve(pts, { color: P.red, width: 4.6 * ze, progress: thread, jitter: 1.1, seed: 802 });
      if (thread < 1) {
        // 正在画的线头：一颗小火花
        const f = thread * 4;
        const i0 = Math.min(3, Math.floor(f)), fr = f - i0;
        const hx = lerp(pts[i0][0], pts[i0 + 1][0], fr), hy = lerp(pts[i0][1], pts[i0 + 1][1], fr);
        g.glow(hx, hy, 40 * ze, '#ff9a8a', 0.8);
        sparkle(g, hx, hy, 16 * ze, '#fff2ea', 0.95);
      }
    }
    const hk = o.heart || 0;
    if (hk > 0) {
      const beat = 1 + 0.07 * Math.max(pulse, Math.pow(Math.max(0, Math.sin(t * 5.2)), 6));
      const hs = 21 * ze * ease.outBack(clamp(hk)) * beat;
      const hx = cam.x(mid[0]), hy = cam.y(mid[1]) + 2 * ze;
      g.glow(hx, hy, hs * 3.4, P.red, 0.45 * clamp(hk));
      C.heart(g, hx, hy, hs, { fill: P.red, color: '#5a1f2a', width: Math.max(1.6, hs * 0.1), seed: 811, rot: Math.sin(t * 2) * 0.06 });
    }
    // 4. 星（落位的雪花）/ 还在飞的雪花
    for (let i = 0; i < N; i++) {
      const nd = NODES[i];
      const st = o.allLanded ? { x: nd.x, y: nd.y, r: nd.size, rot: -Math.PI / 2, state: 2, k: 1 } : pieceAt(i, p, t);
      const pc = PIECES[i];
      const ap = o.allLanded ? 1 : ease.outBack(seg(p, pc.appear, pc.appear + 0.018));
      if (ap <= 0.01) continue;
      const sx = cam.x(st.x), sy = cam.y(st.y);
      const r = st.r * (st.state === 2 ? ze : cam.z) * ap;
      const landK = o.allLanded ? 1 : seg(p, pc.ls + FLY, pc.ls + FLY + 0.025);
      if (nd.who === 2) {
        // 红手套这一块
        const s = (st.state === 2 ? MIT.s * ze : MIT.s * cam.z * (st.r / nd.size)) * ap;
        const rot = st.state === 2 ? MIT.rot : st.rot + Math.PI / 2 + lerp(0, MIT.rot + Math.PI / 2, st.k) * 0;
        const rr = st.state === 2 ? MIT.rot : lerp(st.rot, MIT.rot, st.k);
        void rot;
        const dir2 = [Math.sin(rr), -Math.cos(rr)];
        g.glow(sx, sy, 90 * s * 3, '#ff8f7d', 0.32 + 0.1 * pulse);
        C.mitten(g, sx - dir2[0] * 70 * s, sy - dir2[1] * 70 * s, s, rr, { seed: 820 });
        if (landK > 0 && landK < 1) burst(g, sx, sy, 60 * ze, landK, 830, '#ffd2c8', 10);
        continue;
      }
      if (st.state === 2) {
        const tw = 0.75 + 0.25 * Math.sin(t * (1.6 + rand(i, 5) * 1.8) + i * 2.1);
        const big = nd.size >= 20;
        g.glow(sx, sy, r * (big ? 4.2 : 3.2), '#cfe0ff', (0.3 + 0.18 * pulse) * tw * (o.glowMul || 1));
        flake(g, sx, sy, r * (1 + 0.25 * (1 - ease.outCubic(landK))), { rot: -Math.PI / 2 + Math.sin(t * 0.7 + i) * 0.08, type: pc.type, color: STAR, width: Math.max(1.4, r * 0.11), simple: true, jitter: 0.6, seed: 1000 + i * 31 });
        sparkle(g, sx, sy, r * (big ? 1.9 : 1.15) * tw, '#ffffff', 0.9);
        if (landK > 0 && landK < 1) burst(g, sx, sy, r * 2.2, landK, 1100 + i, '#eaf1ff', 9);
      } else {
        flake(g, sx, sy, r, { rot: st.rot, type: pc.type, glow: 0.8, width: Math.max(1.6, r * 0.065), simple: r < 34, seed: 1000 + i * 31 });
      }
    }
  }

  // ================================================================ 镜头 ①：啪·啪·啪
  const POPS = [
    { x: 420, y: 410, r: 205, at: 0.012, type: 0, n: '1', ny: 760, rot: 0.2 },
    { x: 960, y: 440, r: 250, at: 0.062, type: 1, n: '2', ny: 800, rot: -0.1 },
    { x: 1500, y: 405, r: 210, at: 0.112, type: 2, n: '3', ny: 760, rot: 0.35 },
  ];
  function shotPop(g, p, t) {
    const ctx = g.ctx;
    g.bg(SKY);
    // 最近一次"啪"让镜头往前一顿
    let last = null;
    POPS.forEach((q) => { if (p >= q.at) last = q; });
    const kick = last ? 1 - ease.outCubic(seg(p, last.at, last.at + 0.03)) : 0;
    const sh = last && kick > 0.5 ? g.shake(7 * kick) : [0, 0];
    ctx.save();
    g.camera(W / 2, H / 2, 1 + 0.045 * kick + seg(p, 0, 0.17) * 0.03, 0, sh[0], sh[1]);
    stars(g, t, 110, 51, 0.7);
    g.snow({ count: 60, seed: 52, size: [2, 5], speed: [25, 60], wind: 8, alpha: 0.5 });
    POPS.forEach((q, i) => {
      if (p < q.at) return;
      const k = seg(p, q.at, q.at + 0.03);
      const sc = ease.outBack(k);
      const grow = lerp(0.3, 1, ease.outCubic(seg(p, q.at, q.at + 0.045)));
      const rot = q.rot + t * 0.12 * (i % 2 ? -1 : 1);
      // "啪"的一瞬间背后一亮
      g.glow(q.x, q.y, q.r * 2.2, '#c9d8ff', 0.18 + 0.55 * (1 - k));
      flake(g, q.x, q.y, q.r * sc, { rot, type: q.type, grow, under: true, width: q.r * 0.052, seed: 40 + i * 50 });
      burst(g, q.x, q.y, q.r, seg(p, q.at, q.at + 0.05), 60 + i * 9, '#ffffff', 16);
      // 数字
      const nk = seg(p, q.at + 0.008, q.at + 0.03);
      if (nk > 0) {
        g.text(q.n, q.x, q.ny, { size: 150, font: 'latin', color: P.warm, progress: nk, shadow: { color: SHADOW_INK, dx: 6, dy: 6 }, seed: 70 + i });
        g.line(q.x - 46, q.ny + 70, lerp(q.x - 46, q.x + 50, ease.out(seg(p, q.at + 0.02, q.at + 0.04))), q.ny + 64, { color: P.warm, width: 6, seed: 75 + i });
      }
      // 拟声字"啪"
      const sk = seg(p, q.at, q.at + 0.04);
      if (sk > 0 && sk < 1) {
        g.text('啪', q.x + q.r * 0.95, q.y - q.r * 0.95, { size: 88, font: 'brush', color: '#ffffff', rot: 0.22, alpha: 1 - ease.in(sk), progress: clamp(sk * 4), shadow: { color: SHADOW_INK, dx: 5, dy: 5 }, seed: 80 + i });
      }
    });
    ctx.restore();
    g.vignette(0.45, '#05070f');
  }

  // ================================================================ 镜头 ②：微距
  const MINI = [
    { x: 330, y: 830, r: 62, at: 0.212, type: 0 },
    { x: 720, y: 150, r: 48, at: 0.232, type: 2 },
    { x: 610, y: 720, r: 70, at: 0.252, type: 3 },
    { x: 140, y: 170, r: 44, at: 0.272, type: 1 },
  ];
  function shotMacro(g, p, t) {
    const ctx = g.ctx;
    const k = seg(p, 0.17, 0.3);
    g.bg(['#121a3d', '#1f2d62', '#2a3d78']);
    // 虚焦的大光斑
    for (let i = 0; i < 7; i++) {
      const bx = rand(i, 61, 1) * W + Math.sin(t * 0.3 + i) * 50, by = rand(i, 61, 2) * H - t * (8 + rand(i, 61, 3) * 10) % H;
      g.glow(bx, ((by % H) + H) % H, 70 + rand(i, 61, 4) * 110, i % 3 ? '#9fb6f0' : '#e9eeff', 0.12 + rand(i, 61, 5) * 0.1);
    }
    ctx.save();
    g.camera(1230, 560, 1 + 0.07 * ease.inOut(k), -0.03 * k);
    const grow = ease.outCubic(seg(p, 0.172, 0.24));
    g.glow(1230, 560, 760, '#b7c9ff', 0.35);
    flake(g, 1230, 560, 540, { rot: 0.12 + t * 0.035, type: 3, grow: lerp(0.08, 1, grow), under: true, width: 15, jitter: 2.2, seed: 140 });
    ctx.restore();
    g.snow({ count: 70, seed: 62, size: [2, 6], speed: [30, 70], wind: 10, alpha: 0.55 });
    // 小雪花接连弹出
    MINI.forEach((q, i) => {
      if (p < q.at) return;
      const kk = seg(p, q.at, q.at + 0.02);
      g.glow(q.x, q.y, q.r * 2, '#c9d8ff', 0.2 + 0.4 * (1 - kk));
      flake(g, q.x, q.y, q.r * ease.outBack(kk), { rot: t * 0.3 * (i % 2 ? 1 : -1) + i, type: q.type, under: true, width: q.r * 0.07, seed: 150 + i * 20 });
      burst(g, q.x, q.y, q.r, seg(p, q.at, q.at + 0.035), 160 + i, '#ffffff', 10);
    });
    // 竖排手写：每一片 / 都不一样
    const tk = seg(p, 0.185, 0.25);
    g.text('每一片\n都不一样', 470, 230, { size: 104, font: 'brush', vertical: true, color: '#ffffff', progress: tk, shadow: { color: SHADOW_INK, dx: 6, dy: 6 }, lineHeight: 1.4, seed: 170 });
    g.vignette(0.4, '#05070f');
  }

  // ================================================================ 镜头 ③④⑤：星座
  function camAt(p) {
    if (p < CUT[3]) {
      const k = ease.inOut(seg(p, CUT[2], CUT[3]));
      return mkCam(CEN.x + lerp(-25, 10, k), CEN.y, lerp(0.98, 1.07, k), W / 2, 500);
    }
    if (p < CUT[4]) {
      const k = ease.inOut(seg(p, CUT[3], CUT[4]));
      return mkCam(lerp(10, 22, k), -72, lerp(2.15, 2.32, k), W / 2, 520);
    }
    const k = ease.inOutCubic(seg(p, 0.72, 0.88));
    const z0 = 2.32, z1 = 0.5;
    const z = Math.exp(lerp(Math.log(z0), Math.log(z1), k));
    const fx = 1190 + (22 - CEN.x) * z1, fy = 300 + (-72 - CEN.y) * z1;
    const drift = seg(p, 0.88, 1);
    return mkCam(22, -72, z * (1 + 0.025 * drift), lerp(W / 2, fx, k), lerp(520, fy, k) - 6 * drift);
  }

  function landscape(g, p, t, dy) {
    const ctx = g.ctx;
    ctx.save();
    ctx.translate(0, dy);
    // 地平线的微光
    g.glow(W / 2, 900, 1100, '#5d74bd', 0.28);
    // 远山
    g.path([[-40, 1200], [-40, 760], [220, 724], [520, 748], [820, 712], [1120, 742], [1420, 706], [1700, 736], [1960, 716], [1960, 1200]], { smooth: true, closed: true, color: '#56679f', width: 3, fill: '#2a3766', seed: 501, overshoot: false });
    // "你"家：远处山坡上的小房子，窗是亮的
    const hx = 1610, hy = 756;
    g.glow(hx + 6, hy - 40, 190, P.warm, 0.28 + 0.04 * Math.sin(t * 2.1));
    g.rect(hx - 82, hy - 92, 164, 96, { color: P.ink, width: 3.5, fill: '#3a3f66', seed: 510 });
    g.rect(hx + 44, hy - 162, 24, 46, { color: P.ink, width: 3, fill: '#3a3f66', seed: 511 });
    g.poly([[hx - 106, hy - 88], [hx, hy - 160], [hx + 106, hy - 88]], { color: P.ink, width: 3.5, fill: '#4a4f7a', seed: 512 });
    g.path([[hx - 112, hy - 84], [hx - 60, hy - 124], [hx, hy - 166], [hx + 60, hy - 124], [hx + 112, hy - 84], [hx + 70, hy - 98], [hx, hy - 146], [hx - 70, hy - 98]], { closed: true, smooth: true, color: '#e9eeff', width: 2.5, fill: P.snow, seed: 513 });
    g.rect(hx - 50, hy - 64, 44, 36, { color: P.ink, width: 3, fill: P.warm, seed: 514 });
    g.line(hx - 28, hy - 64, hx - 28, hy - 28, { color: P.ink, width: 2.5, seed: 515 });
    g.rect(hx + 18, hy - 66, 34, 62, { color: P.ink, width: 3, fill: '#7c3f36', seed: 516 });
    // 烟
    for (let k = 0; k < 3; k++) {
      const ph = ((t * 0.25 + k / 3) % 1 + 1) % 1;
      g.circle(hx + 56 + ph * 30, hy - 176 - ph * 90, 8 + ph * 16, { color: rgba('#c8d4ec', 0.6 * (1 - ph)), width: 2.5, seed: 520 + k });
    }
    // 近处雪坡
    const snowGr = ctx.createLinearGradient(0, 780, 0, 1080);
    snowGr.addColorStop(0, '#c9d2ee');
    snowGr.addColorStop(1, '#8f9bc8');
    g.path([[-40, 1200], [-40, 838], [200, 822], [430, 878], [700, 842], [1000, 856], [1300, 830], [1600, 852], [1960, 828], [1960, 1200]], { smooth: true, closed: true, color: '#e8eeff', width: 3.5, fill: snowGr, seed: 530, overshoot: false });
    // 雪地上淡淡的一串小脚印（雪人身后）
    ctx.save();
    ctx.fillStyle = 'rgba(80,96,150,0.25)';
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      ctx.ellipse(250 - k * 40 + (k % 2) * 8, 920 + k * 16 + (k % 2) * 10, 10, 5, -0.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // 小小的雪人，仰头望着星座
    const wave = seg(p, 0.9, 0.95);
    const happy = p > 0.905;
    C.snowman(g, 440, 888, 0.44, {
      mood: happy ? 'happy' : 'hope', lookUp: 1, look: 0.75, blush: lerp(0.5, 1, seg(p, 0.88, 0.95)),
      arms: [0.05, 0.25 + 0.55 * ease.outBack(wave) + (wave >= 1 ? Math.sin(t * 6) * 0.12 : 0)], wind: 0.35, t, seed: 540,
    });
    ctx.restore();
  }

  /** 星图上的经纬弧线 + 星座边界虚线 */
  function chart(g, cam, a, t) {
    if (a <= 0.01) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.globalAlpha *= a;
    for (let i = 0; i < 3; i++) {
      g.arc(W / 2, 2700, 2050 + i * 260, -Math.PI / 2 - 0.62, -Math.PI / 2 + 0.62, { color: '#8ea3d8', width: 1.8, alpha: 0.35, jitter: 1, seed: 600 + i });
    }
    for (let i = 0; i < 4; i++) {
      const an = -Math.PI / 2 + (i - 1.5) * 0.26;
      g.line(W / 2 + Math.cos(an) * 1900, 2700 + Math.sin(an) * 1900, W / 2 + Math.cos(an) * 2700, 2700 + Math.sin(an) * 2700, { color: '#8ea3d8', width: 1.6, alpha: 0.3, jitter: 1, seed: 610 + i });
    }
    // 星座边界（虚线椭圆）
    const cx = cam.x(CEN.x), cy = cam.y(CEN.y), rx = 590 * cam.z, ry = 370 * cam.z;
    for (let j = 0; j < 22; j++) {
      const a0 = (j / 22) * TAU + t * 0.03;
      const pts = [];
      for (let q = 0; q <= 4; q++) {
        const aa = a0 + (q / 4) * (TAU / 44);
        pts.push([cx + Math.cos(aa) * rx, cy + Math.sin(aa) * ry]);
      }
      g.path(pts, { color: '#b9c8f2', width: 2, alpha: 0.55, jitter: 0.6, seed: 620 + j });
    }
    ctx.restore();
  }

  function shotSky(g, p, t) {
    const ctx = g.ctx;
    const cam = camAt(p);
    const pull = seg(p, 0.72, 0.9);
    g.bg(SKY);
    if (p >= CUT[4]) g.glow(W / 2, H + 200, 1300, '#3e55a0', 0.35 * pull);
    stars(g, t, 120, 71, 0.75);
    worldStars(g, cam, t, 520, 72, 0.9, p >= CUT[4] ? lerp(H, 840, pull) : H);
    // 月亮（拉远之后才进画）
    if (p >= CUT[4]) {
      const mk = ease.outCubic(seg(p, 0.8, 0.92));
      C.moon(g, 270, lerp(-120, 165, mk), 48, { phase: 0.55, seed: 640 });
    }
    // 星图（拉远之后）
    if (p >= 0.84) chart(g, cam, seg(p, 0.85, 0.93), t);

    // 底稿：③ 里慢慢浮出来，拼完后更亮
    let ga, mood = 'calm', blush = 0.5;
    if (p < CUT[3]) ga = 0.08 + 0.12 * seg(p, 0.32, 0.46) + 0.14 * seg(p, 0.545, 0.575);
    else if (p < CUT[4]) { ga = 0.36; mood = 'happy'; blush = lerp(0.5, 1, seg(p, 0.64, 0.68)); }
    else { ga = lerp(0.36, 0.3, pull); mood = 'happy'; blush = 1; }
    ghost(g, cam, ga, t, mood, blush);

    const allLanded = p >= CUT[3];
    const thread = p < CUT[3] ? 0 : ease.inOut(seg(p, 0.595, 0.65));
    const heart = p < CUT[3] ? 0 : seg(p, 0.645, 0.672);
    // 拼完的一瞬间整个星座亮一下
    const done = seg(p, 0.548, 0.575);
    constellation(g, cam, p, t, { slots: p < CUT[3], allLanded, thread, heart, glowMul: 1 + 0.9 * Math.sin(done * Math.PI) });

    // 手写「我」「你」（世界坐标，跟着镜头一起缩小）
    if (p >= CUT[3]) {
      const ze = cam.z;
      const la = 1 - 0.25 * pull;
      g.text('我', cam.x(-118), cam.y(-236), { size: 72 * ze, font: 'hand', color: ICE, progress: seg(p, 0.6, 0.625), alpha: la, shadow: { color: SHADOW_INK, dx: 3 * ze, dy: 3 * ze }, seed: 650 });
      g.text('你', cam.x(196), cam.y(-236), { size: 72 * ze, font: 'hand', color: P.warm, progress: seg(p, 0.628, 0.653), alpha: la, shadow: { color: SHADOW_INK, dx: 3 * ze, dy: 3 * ze }, seed: 651 });
    }

    // ③ 的计数：n / 26
    if (p < CUT[3]) {
      let landed = 0;
      for (let i = 0; i < N; i++) if (p >= PIECES[i].ls + FLY) landed++;
      const ck = seg(p, 0.315, 0.335);
      const full = landed === N;
      g.text(`${landed} / ${N}`, 120, 112, { size: 76, font: 'latin', align: 'left', color: full ? P.warm : ICE, progress: ck, shadow: { color: SHADOW_INK, dx: 4, dy: 4 }, seed: 660 });
      flake(g, 78, 110, 26 * ck, { rot: t * 0.8, type: 1, color: full ? P.warm : ICE, width: 2.6, seed: 661 });
    }

    // ⑤ 的雪原
    if (p >= CUT[4]) {
      const dy = lerp(560, 0, ease.outCubic(seg(p, 0.755, 0.9)));
      if (dy < 540) landscape(g, p, t, dy);
      // 星座的名字
      const nk = seg(p, 0.87, 0.93);
      if (nk > 0) {
        const lx = cam.x(CEN.x) , ly = cam.y(CEN.y) + 370 * cam.z + 44;
        g.text('雪人座', lx, ly, { size: 62, font: 'hand', color: ICE, progress: nk, spacing: 10, shadow: { color: SHADOW_INK, dx: 4, dy: 4 }, seed: 670 });
        g.text('12 · 24', lx, ly + 58, { size: 38, font: 'latin', color: '#aebde6', progress: seg(p, 0.91, 0.95), seed: 671 });
      }
    }
    // 一直下着的小雪
    g.snow({ count: p >= CUT[4] ? 90 : 55, seed: 73, size: [2, 6], speed: [25, 65], wind: 10, alpha: p >= CUT[4] ? 0.75 : 0.45 });
    g.vignette(0.42, '#05070f');
  }

  TG.scene({
    id: 'pieces',
    title: '一片一片',
    dark: true,
    transition: 'flash',
    chars: '啪每一片都不一样我你雪人座',
    lyrics: 'default',
    draw(g, p, t, info) {
      void info;
      if (p < CUT[1]) shotPop(g, p, t);
      else if (p < CUT[2]) shotMacro(g, p, t);
      else shotSky(g, p, t);
      // 硬切的时候闪一下白（手书式的"咔嚓"）
      for (const c of [CUT[1], CUT[2], CUT[3]]) {
        const k = seg(p, c, c + 0.012);
        if (k > 0 && k < 1) {
          const ctx = g.ctx;
          ctx.save();
          ctx.fillStyle = `rgba(240,246,255,${0.55 * (1 - ease.out(k))})`;
          ctx.fillRect(0, 0, W, H);
          ctx.restore();
        }
      }
    },
  });
})();
