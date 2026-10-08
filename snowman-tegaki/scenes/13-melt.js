/* 场景：melt —— 融
 *
 * 春天的太阳出来了，雪人在"你"家门前一点一点化掉。背景从冷蓝慢慢变成暖黄绿，最后是金色的傍晚。
 *
 * 镜头（按 p 分段；12s～35s 都能看，循环的小动作用 t）：
 *   S1 0.00–0.16  远景  最后几片雪停了，太阳从山后升起，屋檐的冰柱开始滴水。雪人眯着眼晒太阳，再转头望向门。「3月21日 · 晴」
 *   S2 0.16–0.32  特写  脸上挂满水珠、鼻尖滴水，难过却在笑，一滴眼泪；右边贴着温度计卡片：-12°C 被划掉 → +18°C
 *   S3 0.32–0.47  帽子  头一歪，帽子摇摇晃晃滑下来（！）→ 镜头跟着往下 →「噗」落在草地上，旁边的小花被震得一晃
 *   S4 0.47–0.64  三格  同一机位的三格漫画 11:00 / 13:00 / 15:00：挥手 → 手臂放平、枝头挂水珠 → 手臂垂下、枝头冒出一片新叶
 *   S5 0.64–0.84  望门  夕阳照在门上。快化完的雪人还望着门在笑，视线虚线连到门上，头顶冒出想着"你"（红手套）的泡泡。「第 111 天」
 *   S6 0.84–1.00  只剩  水坑特写：围巾 / 帽子 / 眼睛 / 鼻子 一样一样标出来，最后一个「我」指向那滩水；四周的花一朵朵开，镜头慢慢拉远
 */
(function () {
  'use strict';
  const { clamp, lerp, seg, ease, rand, noise1, mix, rgba, catmull } = TG.U;
  const P = TG.PAL, C = TG.C, W = TG.W, H = TG.H;
  const TAU = Math.PI * 2;

  // ------------------------------------------------------------ 世界布局（S1 / S2 / S3 / S5 / S6 共用一个世界）
  const SX = 760, SY = 850;                       // 雪人脚底
  const DOOR = { x: 1446, y: 376, w: 222, h: 416 }; // "你"家的门
  const BASE = DOOR.y + DOOR.h;                   // 墙根 792
  const WALL_X = 1300, WALL_TOP = 150;
  const POT_X = DOOR.x + DOOR.w + 120;            // 门边的花盆
  const HAT_REST = { x: SX + 236, y: SY - 52, rot: 1.82, sc: 0.92 }; // 帽子掉在草地上
  const TWIGS = [                                 // 掉在地上的树枝手臂
    { x: SX - 172, y: SY + 2, A: Math.PI + 0.1, side: -1, seed: 1210 },
    { x: SX + 128, y: SY + 24, A: 0.05, side: 1, seed: 1220 },
  ];
  const CUT = [0, 0.16, 0.32, 0.47, 0.64, 0.84, 1];
  const DROP_LINE = '#6f97c4';
  const PAPER_STROKE = 'rgba(255,250,238,0.92)';
  const FLOWER_COLS = ['#ffffff', P.sun, P.pink, '#cdb8ea', '#ffffff', '#bcd8f4', P.warm];

  // ------------------------------------------------------------ 地面上的东西（确定性生成的常量）
  const persp = (y) => lerp(0.55, 1.35, clamp((y - 700) / 380));
  function blocked(x, y, pad = 0) {
    if (x > WALL_X - 40 && y < BASE + 16) return true;                                  // 房子后面
    if (Math.abs(x - SX) < 330 + pad && y > SY - 95 && y < SY + 80) return true;        // 雪人和水坑
    if (Math.abs(x - SX - 30) < 230 + pad && y > 690 && y < SY) return true;            // 雪人身后（免得花长在头上）
    if (x > DOOR.x - 70 && x < DOOR.x + DOOR.w + 70 && y < BASE + 46) return true;      // 台阶
    return false;
  }
  const PATCHES = [], TUFTS = [], FLOWERS = [], DRIFTS = [];
  for (let i = 0; i < 30; i++) {
    const x = -260 + rand(i, 601) * 2500, y = 708 + Math.pow(rand(i, 602), 1.25) * 380;
    if (x > WALL_X - 80 && y < BASE + 4) continue;
    PATCHES.push({ x, y, r: (70 + rand(i, 603) * 150) * persp(y), tm: 0.28 + rand(i, 604) * 0.62, seed: 610 + i });
  }
  for (let i = 0; i < 110; i++) {
    const x = -260 + rand(i, 701) * 2500, y = 704 + Math.pow(rand(i, 702), 1.1) * 400;
    if (blocked(x, y)) continue;
    TUFTS.push({ x, y, h: (14 + rand(i, 703) * 16) * persp(y), thr: 0.2 + rand(i, 704) * 0.6, i });
  }
  for (let i = 0; i < 70; i++) {
    const x = -260 + rand(i, 801) * 2500, y = 712 + Math.pow(rand(i, 802), 1.1) * 390;
    if (blocked(x, y, 20)) continue;
    FLOWERS.push({ x, y, r: (9 + rand(i, 803) * 8) * persp(y), thr: rand(i, 804), col: FLOWER_COLS[i % FLOWER_COLS.length], i });
  }
  for (let i = 0; i < 14; i++) {
    const x = -200 + rand(i, 901) * 2300, y = 730 + rand(i, 902) * 330;
    if (x > WALL_X - 60 && y < BASE + 10) continue;
    DRIFTS.push({ x, y, l: (120 + rand(i, 903) * 160) * persp(y), i });
  }
  // 水坑四周最后一镜才开的花（大一点）
  const RIM_FLOWERS = [
    [SX - 352, SY + 30, 17, 0.0], [SX - 300, SY + 74, 21, 0.12], [SX + 330, SY + 40, 18, 0.06], [SX + 296, SY + 86, 23, 0.2],
    [SX - 250, SY - 72, 13, 0.3], [SX + 390, SY - 30, 14, 0.36], [SX - 420, SY - 20, 15, 0.44], [SX + 200, SY + 112, 19, 0.5],
    [SX - 160, SY + 108, 18, 0.58], [SX + 460, SY + 70, 20, 0.66], [SX - 470, SY + 90, 22, 0.72], [SX + 40, SY + 128, 21, 0.8],
  ];

  // ------------------------------------------------------------ 颜色随时间变暖
  const warmthOf = (p) => ease.inOut(clamp(p / 0.8));
  const goldOf = (p) => ease.inOut(seg(p, 0.56, 0.92));
  const bloomOf = (p) => seg(p, 0.24, 0.98);
  const SKY = {
    cold: ['#93b0da', '#bfd3ee', '#e4ecf6'],
    warm: ['#7fc3e6', '#d3eedb', '#fff0c4'],
    gold: ['#93b8de', '#ffe0a3', '#ffc285'],
  };
  const skyCols = (w, gd) => [0, 1, 2].map((i) => mix(mix(SKY.cold[i], SKY.warm[i], w), SKY.gold[i], gd));
  const tint = (cold, warm, gold, w, gd) => mix(mix(cold, warm, w), gold, gd);

  // ------------------------------------------------------------ 镜头工具
  function camOn(g, c) {
    g.save();
    g.camera(c.x, c.y, c.z, c.r || 0, c.dx || 0, c.dy || 0);
  }
  function toScreen(c, x, y) {
    const X = (x - c.x) * c.z, Y = (y - c.y) * c.z;
    const cr = Math.cos(c.r || 0), sr = Math.sin(c.r || 0);
    return [W / 2 + (c.dx || 0) + X * cr - Y * sr, H / 2 + (c.dy || 0) + X * sr + Y * cr];
  }
  /** 镜头能看到的世界范围（只画看得见的部分，省时间） */
  function viewOf(c, w = W, h = H) {
    const hw = w / 2 / c.z + 90, hh = h / 2 / c.z + 90;
    return { x0: c.x - hw, x1: c.x + hw, y0: c.y - hh, y1: c.y + hh };
  }
  function withAlpha(g, a, fn) {
    if (a <= 0) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.globalAlpha *= clamp(a);
    fn();
    ctx.restore();
  }

  // ------------------------------------------------------------ 雪人几何（和 C.snowman 里的算法一致）
  function bodyFrame(melt, x = SX, y = SY, s = 1) {
    const m1 = ease.inOut(clamp(melt / 0.85));
    const rx = 132 * s * lerp(1, 1.35, m1), ry = 118 * s * lerp(1, 0.28, m1);
    return { rx, ry, cy: y - ry, m1 };
  }
  function headFrame(melt, look = 0, x = SX, y = SY, s = 1) {
    const b = bodyFrame(melt, x, y, s);
    const r = 80 * s * lerp(1, 0.55, ease.in(clamp(melt / 0.7)));
    return {
      x: x + lerp(0, 22 * s, ease.in(clamp(melt / 0.8))),
      y: b.cy - b.ry * 0.82 - r * 0.92 + lerp(0, 18 * s, b.m1),
      r,
      tilt: lerp(0, 0.35, ease.in(clamp(melt / 0.8))) + look * 0.06,
    };
  }
  /** 头部局部坐标 → 世界坐标 */
  function headPt(h, lx, ly) {
    const ct = Math.cos(h.tilt), st = Math.sin(h.tilt);
    return [h.x + lx * ct - ly * st, h.y + lx * st + ly * ct];
  }
  /** 树枝手臂（和 C.snowman 一致），返回枝干的几何 */
  function armGeom(melt, arms, side, x = SX, y = SY, s = 1) {
    const b = bodyFrame(melt, x, y, s);
    const armDrop = ease.in(clamp(melt / 0.75)) * 0.9;
    const raise = (arms[side < 0 ? 0 : 1] || 0) - armDrop;
    const bx = x + side * b.rx * 0.86, by = b.cy - b.ry * 0.35;
    const A = side === -1 ? Math.PI + 0.45 + raise : -0.45 - raise;
    const L = 120 * s;
    return { bx, by, A, L, ex: bx + Math.cos(A) * L, ey: by + Math.sin(A) * L, mx: bx + Math.cos(A) * L * 0.62, my: by + Math.sin(A) * L * 0.62 };
  }
  /** 鼻尖（胡萝卜尖）的世界坐标 */
  function noseTip(h, melt, look, lookUp = 0, s = 1) {
    const fx = look * h.r * 0.28, ey = -h.r * 0.12 - lookUp * h.r * 0.25, droop = melt * 10 * s;
    const fy = ey + 18 * s + droop * 0.8;
    const dir = look >= 0 ? 1 : -1;
    const len = lerp(54, 38, Math.abs(look) < 0.2 ? 0.4 : 0) * s;
    const ang = (look === 0 ? 0.18 : 0.1) + melt * 0.9;
    return headPt(h, fx + dir * Math.cos(ang) * len, fy + Math.sin(ang) * len);
  }
  function snowman(g, melt, o) {
    C.snowman(g, SX, SY, 1, Object.assign({ hat: false, seed: 7, melt }, o));
  }

  // ------------------------------------------------------------ 雪人身上的小东西
  /** 八字眉：难过却在笑 */
  function brows(g, h, melt, look, lookUp, a, s = 1) {
    if (a <= 0) return;
    const ctx = g.ctx;
    const k = h.r / (80 * s);
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.tilt);
    const fx = look * h.r * 0.28, ex = h.r * 0.32, ey = -h.r * 0.12 - lookUp * h.r * 0.25, droop = melt * 10 * s;
    const o = { color: P.ink, width: 3.6 * s * Math.max(0.75, k), alpha: clamp(a * 1.5) };
    g.line(fx - ex - 13 * s * k, ey - 20 * s * k + 2 * a, fx - ex + 9 * s * k, ey - 26 * s * k - 6 * a * k + droop * 0.3, Object.assign({ seed: 501 }, o));
    g.line(fx + ex + 13 * s * k, ey - 20 * s * k + 2 * a, fx + ex - 9 * s * k, ey - 26 * s * k - 6 * a * k + droop * 0.3, Object.assign({ seed: 502 }, o));
    ctx.restore();
  }
  /** 眯眼笑 ^^：化得很矮时嘴被围巾挡住了，用眼睛笑。先用雪色盖住圆点眼睛，再画两道向上弯的弧 */
  function happyEyes(g, h, melt, look, lookUp, s = 1) {
    const ctx = g.ctx;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.tilt);
    const fx = look * h.r * 0.28, ex = h.r * 0.32, ey = -h.r * 0.12 - lookUp * h.r * 0.25, droop = melt * 10 * s;
    const eyeR = 8.5 * s * lerp(1, 0.7, melt);
    [[fx - ex, ey + droop * 0.6], [fx + ex, ey + droop]].forEach(([x, y], i) => {
      ctx.fillStyle = P.snow;
      ctx.beginPath();
      ctx.arc(x + 1, y - 1, eyeR + 3.5 * s, 0, TAU);
      ctx.fill();
      g.arc(x, y + eyeR * 0.75, eyeR * 1.3, Math.PI + 0.45, TAU - 0.45, { color: P.ink, width: 3.8 * s, seed: 506 + i });
    });
    ctx.restore();
  }
  /** 头两侧的水珠，顺着头往下滑（不会画到帽子上） */
  function headBeads(g, h, t, n, seed, s = 1) {
    const ctx = g.ctx;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.tilt);
    for (let i = 0; i < n; i++) {
      const per = 2.4 + rand(i, seed, 1) * 1.8;
      const ph = ((t + rand(i, seed, 2) * per) / per) % 1;
      const side = i % 2 ? 1 : -1;
      const a0 = side * (0.8 + rand(i, seed, 3) * 0.6);
      const ang = a0 + side * ease.in(ph) * 0.9;
      const R = h.r * 0.97;
      const x = Math.sin(ang) * R, y = -Math.cos(ang) * R;
      ctx.save();
      ctx.globalAlpha *= clamp(ph * 6) * clamp((1 - ph) * 5);
      C.drop(g, x - side * 3 * s, y + 4 * s, (0.3 + rand(i, seed, 4) * 0.16) * s, { seed: seed + i * 3 });
      ctx.restore();
    }
    ctx.restore();
  }
  /** 鼻尖挂着一颗水珠：慢慢变大，掉下去 */
  function noseDrip(g, tip, t, per, seed, s = 1, fall = 220) {
    const ph = (t / per) % 1;
    if (ph < 0.62) {
      const k = ease.out(ph / 0.62);
      C.drop(g, tip[0], tip[1] + 8 * s * k, lerp(0.12, 0.42, k) * s, { seed });
    } else {
      const k = (ph - 0.62) / 0.38;
      withAlpha(g, clamp((1 - k) * 3), () => C.drop(g, tip[0], tip[1] + 8 * s + ease.in(k) * fall * s, 0.42 * s, { seed: seed + 1 }));
    }
  }
  /** 身体下半截化得透明发蓝 + 往下淌的水痕高光（避开垂下来的围巾） */
  function wetBody(g, melt, s = 1) {
    if (melt <= 0.02) return;
    const b = bodyFrame(melt, SX, SY, s);
    const ctx = g.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(SX, b.cy, b.rx * 0.97, b.ry * 0.97, 0, 0, TAU);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(SX - b.rx, b.cy - b.ry, b.rx + 18 * s, b.ry * 2);
    ctx.rect(SX + 120 * s, b.cy - b.ry, b.rx, b.ry * 2);
    ctx.clip();
    const gr = ctx.createLinearGradient(0, b.cy - b.ry * 0.1, 0, SY);
    gr.addColorStop(0, rgba(P.ice, 0));
    gr.addColorStop(1, rgba(P.ice, 0.55 * clamp(melt * 3)));
    ctx.fillStyle = gr;
    ctx.fillRect(SX - b.rx, b.cy - b.ry, b.rx * 2, b.ry * 2);
    ctx.restore();
    const k = clamp(melt * 4);
    [[-0.66, 0.1], [-0.46, 0.25], [-0.26, 0.4]].forEach((d, i) => {
      const x0 = SX + d[0] * b.rx, y0 = b.cy - b.ry * 0.25 + d[1] * b.ry;
      g.line(x0, y0, x0 + 2, y0 + b.ry * 0.4, { color: '#ffffff', width: 3.2 * s, alpha: 0.85 * k, seed: 520 + i });
    });
  }
  /** 从身体两侧滴进水坑的水 + 涟漪 */
  function bodyDrips(g, melt, t, n, seed, s = 1) {
    if (melt <= 0.03) return;
    const b = bodyFrame(melt, SX, SY, s);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const a = side > 0 ? 0.25 + rand(i, seed, 1) * 0.5 : Math.PI - 0.25 - rand(i, seed, 1) * 0.5;
      const x0 = SX + Math.cos(a) * b.rx, y0 = b.cy + Math.sin(a) * b.ry;
      const per = 1.3 + rand(i, seed, 2) * 1.1;
      const ph = ((t + rand(i, seed, 3) * per) / per) % 1;
      const yG = SY + 8 * s;
      if (ph < 0.62) {
        C.drop(g, x0 + side * 4 * s, lerp(y0, yG, ease.in(ph / 0.62)), 0.34 * s, { seed: seed + i });
      } else {
        const k = (ph - 0.62) / 0.38;
        withAlpha(g, 1 - k, () => g.ellipse(x0 + side * 4 * s, yG, lerp(6, 44, ease.out(k)) * s, lerp(2, 10, ease.out(k)) * s, { color: '#ffffff', width: 2.6 * s, seed: seed + 20 + i }));
      }
    }
  }
  /** 帽子在头上的姿态：k 0..1 沿着头顶往右滑 */
  function hatOnHead(h, melt, k, wob, s = 1) {
    const th = lerp(0, 1.0, k);
    const R = h.r * 0.86;
    const lx = -6 * s * (1 - k) + Math.sin(th) * R, ly = -Math.cos(th) * R;
    const pt = headPt(h, lx, ly);
    return { x: pt[0], y: pt[1], rot: h.tilt - 0.12 + melt * 0.45 + th * 1.05 + wob, sc: s * lerp(1, 0.9, melt) };
  }
  function drawHat(g, pose, seed = 60) {
    C.hat(g, pose.x, pose.y, pose.sc, pose.rot, { seed });
  }
  /** 掉在地上的树枝手臂 */
  function twig(g, tw, s = 1) {
    const { x, y, A, side, seed } = tw;
    const L = 120 * s;
    const ex = x + Math.cos(A) * L, ey = y + Math.sin(A) * L;
    g.line(x, y, ex, ey, { color: P.woodDark, width: 6 * s, seed });
    const mx = x + Math.cos(A) * L * 0.62, my = y + Math.sin(A) * L * 0.62;
    g.line(mx, my, mx + Math.cos(A - side * 0.6) * 38 * s, my + Math.sin(A - side * 0.6) * 38 * s, { color: P.woodDark, width: 4 * s, seed: seed + 1 });
    g.line(ex, ey, ex + Math.cos(A + side * 0.5) * 26 * s, ey + Math.sin(A + side * 0.5) * 26 * s, { color: P.woodDark, width: 3.5 * s, seed: seed + 2 });
    g.line(ex, ey, ex + Math.cos(A - side * 0.45) * 22 * s, ey + Math.sin(A - side * 0.45) * 22 * s, { color: P.woodDark, width: 3, seed: seed + 3 });
  }
  /** 一片新叶 */
  function leaf(g, x, y, ang, len, seed) {
    if (len <= 1) return;
    const ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca;
    const w = len * 0.42;
    const pts = [[x, y], [x + ca * len * 0.5 + nx * w, y + sa * len * 0.5 + ny * w], [x + ca * len, y + sa * len], [x + ca * len * 0.5 - nx * w, y + sa * len * 0.5 - ny * w]];
    g.path(pts, { closed: true, smooth: true, color: P.greenDeep, width: 3, fill: P.green, seed });
    g.line(x, y, x + ca * len * 0.8, y + sa * len * 0.8, { color: P.greenDeep, width: 2, seed: seed + 1 });
  }

  // ------------------------------------------------------------ 花草
  function flower(g, x, y, r, col, k, seed, sway = 0) {
    if (k <= 0) return;
    const ctx = g.ctx;
    const b = g.info.boil;
    const jx = (rand(b, seed, 1) - 0.5) * 1.4, jy = (rand(b, seed, 2) - 0.5) * 1.4;
    const stemH = r * 2.5 * ease.out(clamp(k * 1.7));
    const bloom = ease.outBack(clamp((k - 0.32) / 0.68));
    const hx = x + sway + jx, hy = y - stemH + jy;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = P.greenDeep;
    ctx.lineWidth = Math.max(2, r * 0.17);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + sway * 0.15, y - stemH * 0.5, hx, hy);
    ctx.stroke();
    const lk = clamp(k * 2);
    ctx.fillStyle = P.green;
    ctx.lineWidth = Math.max(1.4, r * 0.1);
    const side = seed % 2 ? 1 : -1;
    ctx.beginPath();
    ctx.ellipse(x + side * r * 0.45 * lk, y - stemH * 0.3, r * 0.55 * lk, r * 0.22 * lk, side * -0.5, 0, TAU);
    ctx.fill();
    ctx.stroke();
    if (bloom > 0) {
      const pr = r * bloom;
      const a0 = rand(seed, 3) * TAU;
      ctx.fillStyle = col;
      ctx.strokeStyle = rgba(P.ink, 0.8);
      ctx.lineWidth = Math.max(1.5, r * 0.11);
      for (let i = 0; i < 5; i++) {
        const a = a0 + (i / 5) * TAU;
        ctx.beginPath();
        ctx.ellipse(hx + Math.cos(a) * pr * 0.56, hy + Math.sin(a) * pr * 0.5, pr * 0.5, pr * 0.36, a, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = col === P.sun ? P.warmDeep : P.sun;
      ctx.beginPath();
      ctx.arc(hx, hy, pr * 0.3, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = P.green;
      ctx.beginPath();
      ctx.ellipse(hx, hy, r * 0.22, r * 0.32, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  function tufts(g, gk, t, v) {
    const ctx = g.ctx;
    const b = g.info.boil;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = P.greenDeep;
    for (const u of TUFTS) {
      if (u.x < v.x0 || u.x > v.x1 || u.y < v.y0 || u.y > v.y1 + 40) continue;
      const k = clamp((gk - u.thr) / 0.2);
      if (k <= 0) continue;
      const h = u.h * ease.out(k);
      const sway = Math.sin(t * 2.2 + u.x * 0.01) * h * 0.18 + (rand(b, u.i, 5) - 0.5) * 1.2;
      ctx.lineWidth = Math.max(1.8, h * 0.13);
      ctx.beginPath();
      for (let j = -1; j <= 1; j++) {
        ctx.moveTo(u.x + j * h * 0.16, u.y);
        ctx.quadraticCurveTo(u.x + j * h * 0.24, u.y - h * 0.5, u.x + j * h * 0.5 + sway, u.y - h * (j ? 0.78 : 1));
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ 天空 / 远景
  /** 发光（screen 叠加：只会变亮，不会把天空糊成灰色） */
  function shine(g, x, y, r, color, a) {
    if (a <= 0) return;
    const ctx = g.ctx;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(color, a));
    gr.addColorStop(1, rgba(color, 0));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }
  /** 太阳。glow=false 时不画光晕（由 sunlight() 统一画一层，省一次大面积填充） */
  function sun(g, x, y, r, t, a = 1, glow = true) {
    if (a <= 0) return;
    if (glow) sunGlow(g, x, y, r, r * 6.5, a);
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * TAU + t * 0.12;
      const l0 = r * 1.32, l1 = r * (1.7 + 0.22 * Math.sin(t * 2.2 + i * 1.3) + (i % 2 ? 0 : 0.3));
      g.line(x + Math.cos(ang) * l0, y + Math.sin(ang) * l0, x + Math.cos(ang) * l1, y + Math.sin(ang) * l1, { color: '#f0a83e', width: Math.max(3, r * 0.09), alpha: 0.95 * a, seed: 800 + i });
    }
    g.circle(x, y, r, { color: '#e89a38', width: Math.max(3, r * 0.07), fill: P.sun, alpha: a, seed: 790 });
    g.arc(x - r * 0.1, y - r * 0.08, r * 0.62, Math.PI * 1.05, Math.PI * 1.5, { color: '#fff3c4', width: Math.max(3, r * 0.1), alpha: a, seed: 791 });
  }
  function cloud(g, x, y, s, seed, a = 1) {
    const pts = [[-120, 18], [-116, -8], [-84, -30], [-54, -58], [-8, -70], [30, -52], [62, -66], [100, -42], [120, -10], [128, 18]]
      .map((q) => [x + q[0] * s, y + q[1] * s]);
    g.path(pts, { closed: true, smooth: true, color: rgba(P.ink, 0.3), width: 3, fill: 'rgba(255,255,255,0.94)', alpha: a, seed });
    g.line(x - 90 * s, y + 8 * s, x + 30 * s, y + 10 * s, { color: rgba(P.ice, 0.8), width: 3, alpha: a, seed: seed + 1 });
  }
  function clouds(g, t, a, list) {
    (list || [[260, 170, 0.9, 9], [1150, 110, 0.7, 6], [1760, 240, 1.05, 11], [640, 300, 0.55, 14]]).forEach((c, i) => {
      const span = W + 500;
      const x = ((c[0] + t * c[3]) % span + span) % span - 250;
      cloud(g, x, c[1], c[2], 850 + i * 3, a);
    });
  }
  function hillLine(base, amp, seed, v) {
    const pts = [];
    const x0 = Math.floor((v.x0 - 150) / 140) * 140;
    for (let x = x0; x <= v.x1 + 150; x += 140) pts.push([x, base + noise1(x / 360, seed) * amp]);
    return pts;
  }
  /** 一条起伏的地平线往下全部填色：只描上沿（不描看不见的下沿，省时间） */
  function band(g, top, color, line, width, seed, v) {
    const bottom = Math.max(v.y1 + 60, top[0][1] + 60);
    g.fill(catmull(top, false).concat([[top[top.length - 1][0], bottom], [top[0][0], bottom]]), color, { seed });
    g.path(top, { smooth: true, color: line, width, seed: seed + 1 });
  }
  function hills(g, w, gd, v) {
    band(g, hillLine(566, 44, 33, v), tint('#cfdbef', '#a9cf95', '#c3cb8b', w, gd * 0.6), rgba(P.ink, 0.32), 3, 870, v);
    // 远处的小松树：雪慢慢掉光变绿
    const tc = tint('#e6edf8', '#5f9470', '#6a8a5a', clamp(w * 1.2), gd * 0.4);
    [[-120, 0.7], [40, 0.9], [150, 0.6], [1020, 0.8], [1110, 1.0], [1205, 0.7], [1900, 0.9], [2010, 0.7]].forEach(([x, s], i) => {
      if (x < v.x0 - 40 || x > v.x1 + 40) return;
      const y = 566 + noise1(x / 360, 33) * 44 + 8;
      g.poly([[x - 30 * s, y], [x - 8 * s, y - 56 * s], [x - 18 * s, y - 56 * s], [x, y - 104 * s], [x + 18 * s, y - 56 * s], [x + 8 * s, y - 56 * s], [x + 30 * s, y]],
        { color: rgba(P.ink, 0.4), width: 2.5, fill: tc, seed: 880 + i });
    });
    band(g, hillLine(640, 24, 34, v), tint('#dde6f4', '#97c681', '#adc377', w, gd * 0.6), rgba(P.ink, 0.38), 3, 872, v);
  }
  function groundY(x) { return 694 + noise1(x / 420, 41) * 12; }
  function ground(g, w, gd, t, v) {
    const ctx = g.ctx;
    const top = [];
    const x0 = Math.floor((v.x0 - 150) / 150) * 150;
    for (let x = x0; x <= v.x1 + 150; x += 150) top.push([x, groundY(x)]);
    const gk = clamp(w * 1.25);
    const gr = ctx.createLinearGradient(0, 690, 0, 1100);
    gr.addColorStop(0, tint('#edf2f9', '#b5da97', '#c9d589', gk, gd * 0.5));
    gr.addColorStop(1, tint('#f8fafd', '#86bf70', '#9cbb64', gk, gd * 0.5));
    band(g, top, gr, rgba(P.ink, 0.6), 4, 41, v);
    // 积雪表面的风痕（雪化了就没了）
    if (gk < 0.6) {
      for (const d of DRIFTS) {
        if (d.x + d.l < v.x0 || d.x - d.l > v.x1 || d.y > v.y1) continue;
        g.curve([[d.x - d.l * 0.5, d.y], [d.x, d.y - d.l * 0.05], [d.x + d.l * 0.5, d.y + d.l * 0.02]], { color: P.snowShade, width: 3, alpha: 0.9 * (1 - gk / 0.6), seed: 640 + d.i });
        // 太阳照在雪上的闪光
        const tw = Math.max(0, Math.sin(t * 2.6 + d.i * 2.3));
        if (tw > 0.2) sparkle(g, d.x + d.l * 0.2, d.y - 10, (5 + 7 * tw) * persp(d.y), '#ffffff', tw * (1 - gk / 0.6), 660 + d.i * 2);
      }
    }
    // 残雪
    for (const pt of PATCHES) {
      const k = clamp((pt.tm - w) / 0.32);
      if (k <= 0.03 || pt.x + pt.r < v.x0 || pt.x - pt.r > v.x1 || pt.y > v.y1 + 30) continue;
      const rx = pt.r * Math.sqrt(k), ry = rx * 0.26;
      const oa = clamp((gk - 0.15) * 2.5);
      g.ellipse(pt.x, pt.y, rx, ry, { color: rgba(P.ice, 0.9 * oa), width: 2.5, fill: '#fbfcff', seed: pt.seed, overshoot: false });
      if (ry > 8 && oa > 0) withAlpha(g, oa, () => g.fill([[pt.x - rx * 0.2, pt.y + ry * 0.35], [pt.x + rx * 0.8, pt.y + ry * 0.1], [pt.x + rx * 0.4, pt.y + ry * 0.75]], rgba(P.snowShade, 0.7), { seed: pt.seed + 1 }));
    }
    tufts(g, gk, t, v);
  }
  function groundFlowers(g, bloom, t, v, pulse = 0) {
    for (const f of FLOWERS) {
      if (f.x < v.x0 || f.x > v.x1 || f.y < v.y0 || f.y > v.y1 + 60) continue;
      const k = clamp((bloom - f.thr * 0.85) / 0.15);
      if (k <= 0) continue;
      flower(g, f.x, f.y, f.r * (1 + 0.06 * pulse), f.col, k, 1300 + f.i, Math.sin(t * 1.8 + f.i) * f.r * 0.2);
    }
  }
  function house(g, w, gd, t, bloom, v) {
    if (v.x1 < WALL_X - 120) return;
    const ctx = g.ctx;
    const R = Math.min(2600, v.x1 + 40), T = Math.max(-160, v.y0 - 40);
    g.path([[WALL_X, WALL_TOP], [R, WALL_TOP], [R, BASE], [WALL_X, BASE]], { closed: true, color: P.ink, width: 4.5, fill: tint('#d9d2cb', '#efdcc2', '#f6cf9f', w, gd * 0.8), seed: 900 });
    ctx.save();
    ctx.strokeStyle = rgba(P.ink, 0.13);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let y = WALL_TOP + 74, k = 0; y < BASE - 10; y += 54, k++) {
      const j = (rand(g.info.boil, k, 3) - 0.5) * 1.6;
      ctx.moveTo(WALL_X + 8, y + j);
      ctx.lineTo(R, y + j + 2);
    }
    ctx.stroke();
    const sg = ctx.createLinearGradient(0, WALL_TOP, 0, WALL_TOP + 130);
    sg.addColorStop(0, rgba(P.ink, 0.24));
    sg.addColorStop(1, rgba(P.ink, 0));
    ctx.fillStyle = sg;
    ctx.fillRect(WALL_X + 3, WALL_TOP, R - WALL_X, 130);
    ctx.restore();
    // 门
    C.door(g, DOOR.x, DOOR.y, DOOR.w, DOOR.h, { wreath: false, seed: 920 });
    // 石头台阶（盖住门前的雪），台阶上的雪慢慢化掉
    g.path([[DOOR.x - 56, BASE + 12], [DOOR.x - 42, BASE - 20], [DOOR.x + DOOR.w + 42, BASE - 20], [DOOR.x + DOOR.w + 56, BASE + 12]], { closed: true, color: P.ink, width: 4, fill: '#cfc6ba', seed: 930 });
    g.line(DOOR.x - 30, BASE - 4, DOOR.x + DOOR.w + 30, BASE - 2, { color: rgba(P.ink, 0.3), width: 2.5, seed: 931 });
    const sk = 1 - clamp(w * 1.7);
    if (sk > 0.04) {
      const cx = DOOR.x + DOOR.w * 0.4, hw = (DOOR.w * 0.5 + 40) * sk;
      g.path([[cx - hw, BASE - 18], [cx - hw * 0.6, BASE - 30 * sk - 18], [cx + hw * 0.5, BASE - 26 * sk - 18], [cx + hw, BASE - 18]], { closed: true, smooth: true, color: rgba(P.ink, 0.7), width: 3, fill: P.snow, seed: 932 });
    }
    // 门边的花盆
    if (POT_X - 60 < v.x1) {
      const py = BASE + 10;
      g.poly([[POT_X - 40, py - 62], [POT_X + 40, py - 62], [POT_X + 29, py], [POT_X - 29, py]], { color: P.ink, width: 4, fill: '#c08a5c', seed: 933 });
      g.poly([[POT_X - 46, py - 72], [POT_X + 46, py - 72], [POT_X + 44, py - 56], [POT_X - 44, py - 56]], { color: P.ink, width: 4, fill: '#d29d6e', seed: 934 });
      const pk = clamp(bloom * 1.6);
      flower(g, POT_X - 18, py - 70, 15, P.sun, pk, 941, Math.sin(t * 1.6) * 3);
      flower(g, POT_X + 16, py - 70, 13, '#ffffff', clamp(pk * 1.2 - 0.2), 942, Math.sin(t * 1.6 + 1) * 3);
      flower(g, POT_X, py - 70, 18, P.pink, clamp(pk * 1.3 - 0.35), 943, Math.sin(t * 1.6 + 2) * 3);
    }
    if (v.y0 > WALL_TOP + 120) return;
    // 屋顶 + 屋檐
    const slope = (y) => lerp(WALL_X - 80, WALL_X + 130, (WALL_TOP + 22 - y) / (WALL_TOP + 182));
    g.path([[WALL_X - 80, WALL_TOP + 22], [slope(T), T], [R, T], [R, WALL_TOP + 22]], { closed: true, color: P.ink, width: 4.5, fill: tint('#6a5160', '#6d4f4a', '#6f4b40', w, gd), seed: 940 });
    ctx.save();
    ctx.strokeStyle = rgba(P.ink, 0.25);
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const y = WALL_TOP - 30 - k * 46;
      ctx.moveTo(slope(y) + 10, y);
      ctx.lineTo(R, y);
    }
    ctx.stroke();
    ctx.restore();
    g.path([[WALL_X - 84, WALL_TOP + 2], [R, WALL_TOP + 2], [R, WALL_TOP + 28], [WALL_X - 80, WALL_TOP + 28]], { closed: true, color: P.ink, width: 4, fill: '#4b3a3a', seed: 941 });
    // 屋檐上的雪
    const th = lerp(36, 0, clamp(w * 1.3));
    if (th > 1.5) {
      const top = [];
      for (let x = WALL_X - 96; x <= R; x += 70) top.push([x, WALL_TOP + 6 - th * (0.65 + 0.35 * noise1(x / 90, 17))]);
      g.path(top.concat([[R, WALL_TOP + 10], [WALL_X - 90, WALL_TOP + 10]]), { closed: true, smooth: true, overshoot: false, color: P.ink, width: 3.5, fill: P.snow, seed: 950 });
    }
    // 冰柱：越来越短，一直在滴水
    const iceK = 1 - 0.8 * clamp(w * 1.1);
    for (let k = 0; k < 18; k++) {
      const x = WALL_X - 40 + k * 64 + rand(k, 951) * 22;
      if (x > v.x1) break;
      const L = (24 + rand(k, 952) * 56) * iceK;
      const y0 = WALL_TOP + 26;
      if (L > 4) g.poly([[x - 7, y0], [x + 7, y0], [x + 1, y0 + L]], { color: P.ice, width: 2.4, fill: '#eaf4ff', seed: 960 + k, jitter: 0.8 });
      if (rand(k, 953) < 0.45) continue;
      const per = 1.3 + rand(k, 954) * 1.5;
      const ph = ((t + rand(k, 955) * per) / per) % 1;
      const tipY = y0 + Math.max(L, 4);
      if (ph < 0.4) C.drop(g, x + 1, tipY + 6, lerp(0.1, 0.3, ph / 0.4), { seed: 980 + k });
      else {
        const y = lerp(tipY + 6, BASE + 10, ease.in((ph - 0.4) / 0.6));
        if (y < BASE) C.drop(g, x + 1, y, 0.3, { seed: 980 + k });
      }
    }
  }
  /** 整个世界：远山、地面、房子、花草 */
  function world(g, st, v) {
    hills(g, st.w, st.gd, v);
    ground(g, st.w, st.gd, st.t, v);
    if (!st.noHouse) house(g, st.w, st.gd, st.t, st.bloom, v);
    groundFlowers(g, st.bloom, st.t, v, st.pulse || 0);
  }

  // ------------------------------------------------------------ 前景氛围
  function motes(g, t, a, seed = 31, count = 36) {
    if (a <= 0) return;
    g.snow({ t, count, seed, speed: [-34, -12], size: [2, 6], wind: 10, sway: 22, color: '#fff6d6', alpha: 0.9 * a, crystal: 99 });
  }
  function petals(g, t, n, seed, a, sc = 1) {
    if (a <= 0) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = rgba('#c96c6c', 0.55);
    for (let i = 0; i < n; i++) {
      const r1 = rand(i, seed, 1), r2 = rand(i, seed, 2), r3 = rand(i, seed, 3), r4 = rand(i, seed, 4);
      const v = 42 + r2 * 46, span = H + 140;
      const y = ((r3 * span + t * v) % span) - 70;
      const xw = W + 260;
      const x = (((r4 * xw + t * (36 + r1 * 40) + Math.sin(t * (0.9 + r1) + i) * 46) % xw) + xw) % xw - 130;
      const s = (7 + r1 * 8) * sc;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * (1.1 + r2 * 2) + i);
      ctx.scale(1, 0.25 + 0.75 * Math.abs(Math.cos(t * (2 + r1 * 2) + i * 1.3)));
      ctx.globalAlpha = a * (0.7 + 0.3 * r2);
      ctx.fillStyle = i % 3 ? P.pink : '#fff1f1';
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(s * 0.95, -s * 0.15, 0, s);
      ctx.quadraticCurveTo(-s * 0.95, -s * 0.15, 0, -s);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  /** 太阳的光晕：一次径向渐变（screen 叠加）同时画出日冕和铺开的暖光 */
  function sunGlow(g, x, y, r, R, a) {
    const ctx = g.ctx;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, R);
    gr.addColorStop(0, rgba(P.sun, 0.75 * a));
    gr.addColorStop(clamp((r * 2.4) / R), rgba(P.glow, 0.55 * a));
    gr.addColorStop(clamp((r * 6) / R), rgba(P.glow, 0.26 * a));
    gr.addColorStop(1, rgba(P.glow, 0));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = gr;
    const x0 = Math.max(0, x - R), y0 = Math.max(0, y - R);
    ctx.fillRect(x0, y0, Math.min(W, x + R) - x0, Math.min(H, y + R) - y0);
    ctx.restore();
  }
  /** 阳光：太阳的光晕 + 铺过来的暖光 + 几道斜光（都用 screen 叠加） */
  function sunlight(g, sx, sy, a, rays = 0, t = 0, dir = 0.62, r = 70) {
    sunGlow(g, sx, sy, r, 1150, a);
    if (rays <= 0) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, 1900);
    gr.addColorStop(0, rgba('#fff3d0', rays * (0.38 + 0.08 * Math.sin(t * 0.9))));
    gr.addColorStop(1, rgba('#fff3d0', 0));
    ctx.fillStyle = gr;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const ang = dir - 0.24 + i * 0.16 + Math.sin(t * 0.4 + i) * 0.015;
      const w0 = (0.035 + rand(i, 71) * 0.04) * (1 + 0.15 * Math.sin(t * 0.9 + i * 2));
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(ang - w0) * 2600, sy + Math.sin(ang - w0) * 2600);
      ctx.lineTo(sx + Math.cos(ang + w0) * 2600, sy + Math.sin(ang + w0) * 2600);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }
  function flare(g, sx, sy, a) {
    if (a <= 0) return;
    const ctx = g.ctx;
    const dx = W * 0.62 - sx, dy = H * 0.6 - sy;
    const spots = [[0.32, 26, P.glow], [0.55, 14, '#cfe8ff'], [0.85, 54, P.warm], [1.15, 18, '#ffffff'], [1.45, 80, P.glow]];
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    spots.forEach(([f, r, col]) => {
      const x = sx + dx * f, y = sy + dy * f;
      ctx.globalAlpha = a * 0.3;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = a * 0.5;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    });
    ctx.restore();
  }
  /** 失焦的光斑（screen 叠加，慢慢飘） */
  function bokeh(g, t, a, seed, n = 9) {
    if (a <= 0) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < n; i++) {
      const x = W * (0.05 + rand(i, seed, 1) * 0.9) + Math.sin(t * 0.3 + i) * 30;
      const y = H * (0.05 + rand(i, seed, 2) * 0.6) + Math.cos(t * 0.25 + i * 2) * 20;
      const r = 30 + rand(i, seed, 3) * 70;
      const fl = 0.7 + 0.3 * Math.sin(t * 1.2 + i * 1.7);
      const col = i % 3 ? P.glow : '#fff6e0';
      ctx.globalAlpha = a * 0.35 * fl;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = a * 0.55 * fl;
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  }
  function sparkle(g, x, y, r, color, a, seed) {
    if (a <= 0) return;
    g.line(x - r, y, x + r, y, { color, width: Math.max(2, r * 0.18), alpha: a, seed });
    g.line(x, y - r, x, y + r, { color, width: Math.max(2, r * 0.18), alpha: a, seed: seed + 1 });
  }
  /** 一闪的白（切进镜头时，按秒算） */
  function cutFlash(g, since, color, a = 0.8, len = 0.22) {
    if (since >= len) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.globalAlpha = a * (1 - since / len);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ------------------------------------------------------------ S1 远景：太阳出来了
  function shot1(g, q, t, info, p) {
    const w = warmthOf(p), gd = goldOf(p), bloom = bloomOf(p);
    const e = ease.inOut(q);
    const c = { x: lerp(1070, 1010, e), y: lerp(596, 618, e), z: lerp(1.1, 1.3, e) };
    const v = viewOf(c);
    g.bg(skyCols(w, gd));
    const sunP = [290, lerp(560, 230, ease.outCubic(seg(q, 0, 0.75)))];
    sun(g, sunP[0], sunP[1], 66, t, 1, false);
    clouds(g, t, 1);
    camOn(g, c);
    world(g, { w, gd, t, bloom, pulse: info.pulse }, v);
    const melt = lerp(0, 0.12, q);
    const turn = ease.inOut(seg(q, 0.42, 0.66));
    const look = lerp(-0.55, 0.85, turn), lookUp = lerp(0.55, 0.05, turn);
    const blink = (t % 3.6) < 0.14;
    snowman(g, melt, { mood: 'happy', look, lookUp, eyesClosed: q < 0.44 || blink, blush: lerp(0.85, 0.6, turn), arms: [0.12, 0.12] });
    wetBody(g, melt);
    const h = headFrame(melt, look);
    if (q > 0.7) headBeads(g, h, t, 2, 60);
    drawHat(g, hatOnHead(h, melt, lerp(0, 0.06, q), 0));
    bodyDrips(g, melt, t, 2, 40);
    g.restore();
    // 上一幕炸散的雪，最后几片落下来
    g.snow({ t, count: 70, seed: 21, speed: [40, 90], size: [3, 9], wind: 18, alpha: 0.95 * (1 - ease.out(seg(q, 0, 0.5))), color: '#ffffff' });
    motes(g, t, seg(q, 0.25, 0.8));
    sunlight(g, sunP[0], sunP[1], 0.6 + 0.4 * seg(q, 0, 0.6), 0.8 * seg(q, 0.1, 0.6), t, 0.62, 66);
    // 3月21日 · 晴
    const dk = seg(q, 0.12, 0.5);
    if (dk > 0) {
      g.text('3月21日 · 晴', 860, 118, { size: 96, color: P.ink, progress: dk, rot: -0.03, stroke: PAPER_STROKE, strokeWidth: 14, shadow: { color: rgba(P.warm, 0.95), dx: 5, dy: 5 }, seed: 11 });
      g.curve([[610, 192], [760, 202], [950, 194], [1120, 200]], { color: P.warmDeep, width: 6, progress: seg(q, 0.45, 0.62), seed: 12 });
    }
  }

  // ------------------------------------------------------------ S2 特写：水珠、眼泪、温度计
  function thermoCard(g, cx, cy, rot, lvl, t) {
    const ctx = g.ctx;
    const map = (v) => lerp(176, -236, (v + 20) / 50);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = rgba(P.ink, 0.2);
    ctx.fillRect(-150 + 12, -300 + 16, 300, 600);
    g.rect(-150, -300, 300, 600, { color: P.ink, width: 4.5, fill: '#fbf7ee', seed: 1500 });
    g.fill([[-60, -318], [40, -312], [36, -282], [-64, -288]], 'rgba(243,226,170,0.85)', { seed: 1501 });
    for (let v = -20; v <= 30; v += 5) {
      const y = map(v), big = v % 10 === 0;
      g.line(-6, y, big ? 22 : 10, y, { color: P.ink, width: big ? 3.4 : 2.4, seed: 1510 + v });
      if (big) g.text(String(v), 66, y, { size: 40, font: 'latin', color: v < 0 ? P.nightBlue : P.ink, pop: false, seed: 1560 + v });
    }
    g.path([[-56, 190], [-56, -250], [-46, -268], [-34, -268], [-24, -250], [-24, 190]], { color: P.ink, width: 4, fill: '#ffffff', seed: 1502 });
    const top = map(lvl);
    ctx.fillStyle = P.warmDeep;
    ctx.fillRect(-49, top, 18, 210 - top);
    g.line(-46, top + 4, -46, 190, { color: '#ffd9a8', width: 3, seed: 1503 });
    g.circle(-40, 226, 44, { color: P.ink, width: 4.5, fill: P.warmDeep, seed: 1504 });
    g.arc(-48, 216, 22, Math.PI * 1.05, Math.PI * 1.55, { color: '#ffd9a8', width: 5, seed: 1505 });
    const bob = Math.sin(t * 6) * 4;
    g.line(-100, top + 10 + bob, -80, top - 8 + bob, { color: P.warmDeep, width: 5, seed: 1506 });
    g.line(-80, top - 8 + bob, -64, top + 8 + bob, { color: P.warmDeep, width: 5, seed: 1507 });
    ctx.restore();
  }
  function shot2(g, q, t, info, p) {
    const w = warmthOf(p), gd = goldOf(p), bloom = bloomOf(p);
    const melt = lerp(0.14, 0.26, q);
    const look = lerp(0.22, 0.3, q), lookUp = 0.12;
    const h = headFrame(melt, look);
    const z = lerp(2.28, 2.48, ease.inOut(q));
    const c = { x: h.x + 175, y: h.y + 14, z, r: lerp(-0.02, 0.012, q) };
    const v = viewOf(c);
    g.bg(skyCols(w, gd));
    const sunP = [130, 80];
    sun(g, sunP[0], sunP[1], 92, t, 1, false);
    clouds(g, t, 0.9, [[900, 120, 0.8, 7], [1500, 330, 0.6, 10]]);
    camOn(g, c);
    world(g, { w, gd, t, bloom, pulse: info.pulse, noHouse: true }, v);
    const tear = ease.inOut(seg(q, 0.3, 0.9));
    snowman(g, melt, { mood: 'happy', look, lookUp, blush: 0.9, tear });
    wetBody(g, melt);
    brows(g, h, melt, look, lookUp, ease.out(seg(q, 0.15, 0.45)));
    headBeads(g, h, t, 5, 70);
    drawHat(g, hatOnHead(h, melt, lerp(0.07, 0.2, q), Math.sin(t * 5) * 0.02 * seg(q, 0.4, 1)));
    noseDrip(g, noseTip(h, melt, look, lookUp), t, 1.5, 90, 1, 260);
    // 头侧的暖光边
    g.arc(h.x, h.y, h.r - 6, Math.PI * 1.02, Math.PI * 1.3, { color: P.glow, width: 4, alpha: 0.7, seed: 1450 });
    g.restore();
    flare(g, sunP[0], sunP[1], 0.9);
    sunlight(g, sunP[0], sunP[1], 0.8, 0.9, t, 0.5, 92);
    motes(g, t, 1, 32, 30);
    // 温度计卡片（从右边滑进来）
    const ck = ease.outBack(seg(q, 0.02, 0.16));
    const cx = lerp(2200, 1600, ck), cy = 480;
    const lvl = lerp(-12, 18, ease.inOut(seg(q, 0.25, 0.7)));
    thermoCard(g, cx, cy, 0.05, lvl, t);
    // -12°C 划掉 → +18°C
    if (ck > 0.6) {
      g.text('-12°C', cx - 290, 214, { size: 84, font: 'latin', color: P.nightBlue, rot: -0.06, seed: 1601, stroke: '#fbf7ee', strokeWidth: 12 });
      g.line(cx - 384, 236, cx - 196, 192, { color: P.ink, width: 7, progress: seg(q, 0.2, 0.3), seed: 1602 });
    }
    const hk = seg(q, 0.62, 0.86);
    if (hk > 0) {
      g.text('+18°C', cx - 290, 372, { size: 136, font: 'latin', color: P.warmDeep, stroke: '#fff8ea', strokeWidth: 18, progress: hk, rot: -0.1, seed: 1603, shadow: { color: rgba(P.ink, 0.28), dx: 5, dy: 6 } });
    }
  }

  // ------------------------------------------------------------ S3 帽子滑下来
  function shot3(g, q, t, info, p) {
    const w = warmthOf(p), gd = goldOf(p), bloom = bloomOf(p);
    const melt = lerp(0.28, 0.4, q);
    const look = lerp(0.3, 1, ease.inOut(seg(q, 0.3, 0.6)));
    const h = headFrame(melt, look);
    // 镜头：头部 → 跟着帽子往下摇 → 停在雪人 + 帽子
    const f = ease.inOut(seg(q, 0.44, 0.66));
    const land = seg(q, 0.62, 0.64);
    const sh = land > 0 && q < 0.68 ? g.shake(9) : [0, 0];
    const c = { x: lerp(h.x + 110, SX + 130, f), y: lerp(h.y + 30, SY - 200, f), z: lerp(2.1, 1.4, f), r: lerp(0.03, 0, f), dx: sh[0], dy: sh[1] };
    const v = viewOf(c);
    g.bg(skyCols(w, gd));
    const sunP = [lerp(120, 200, f), lerp(60, 120, f)];
    sun(g, sunP[0], sunP[1], 80, t, 1, false);
    clouds(g, t, 0.9, [[700, 130, 0.7, 8], [1400, 90, 0.9, 6], [1900, 260, 0.6, 9]]);
    camOn(g, c);
    world(g, { w, gd, t, bloom, pulse: info.pulse }, v);
    // 落点旁边的小花，被震得一晃
    const wob = q > 0.63 ? Math.sin((q - 0.63) * 60) * Math.exp(-(q - 0.63) * 18) * 14 : 0;
    flower(g, HAT_REST.x + 96, SY + 40, 20, P.sun, 1, 1700, wob + Math.sin(t * 2) * 2);
    flower(g, HAT_REST.x - 60, SY + 74, 16, '#ffffff', 1, 1701, -wob * 0.6 + Math.sin(t * 2 + 1) * 2);
    const mood = q < 0.3 ? 'happy' : q < 0.7 ? 'hope' : 'happy';
    snowman(g, melt, { mood, look, blush: 0.8, lookUp: 0.05 });
    wetBody(g, melt);
    brows(g, h, melt, look, 0.05, q > 0.7 ? 1 : 0.5);
    bodyDrips(g, melt, t, 3, 44);
    // 帽子
    const slide = ease.in(seg(q, 0.08, 0.44));
    const wobH = Math.sin(t * 9) * 0.06 * seg(q, 0.05, 0.3) * (1 - seg(q, 0.35, 0.44));
    if (q < 0.44) drawHat(g, hatOnHead(h, melt, lerp(0.2, 1, slide), wobH));
    else {
      const P0 = hatOnHead(h, melt, 1, 0);
      const k = seg(q, 0.44, 0.63);
      const bounce = q > 0.63 ? Math.abs(Math.sin((q - 0.63) * 40)) * Math.exp(-(q - 0.63) * 20) * 26 : 0;
      drawHat(g, {
        x: lerp(P0.x, HAT_REST.x, ease.out(k)),
        y: lerp(P0.y, HAT_REST.y, ease.in(k)) - Math.sin(k * Math.PI) * 30 - bounce,
        rot: lerp(P0.rot, HAT_REST.rot, ease.out(k)) + (k < 1 ? Math.sin(k * 6) * 0.15 : bounce * 0.004),
        sc: lerp(P0.sc, HAT_REST.sc, k),
      });
      // 落地溅起的小水花
      if (q > 0.63 && q < 0.82) {
        const sk = seg(q, 0.63, 0.82);
        for (let i = 0; i < 6; i++) {
          const a = -Math.PI + 0.35 + i * 0.48;
          const r0 = 70 + sk * 70, r1 = r0 + 26 * (1 - sk);
          const ox = HAT_REST.x + 10, oy = SY + 6;
          g.line(ox + Math.cos(a) * r0, oy + Math.sin(a) * r0 * 0.55, ox + Math.cos(a) * r1, oy + Math.sin(a) * r1 * 0.55, { color: DROP_LINE, width: 4.5, alpha: 1 - sk, seed: 1720 + i });
        }
      }
    }
    const hp = toScreen(c, h.x, h.y);
    g.restore();
    motes(g, t, 0.8, 33, 28);
    sunlight(g, sunP[0], sunP[1], 0.7, 0.5, t, 0.55, 80);
    // ！
    const ek = seg(q, 0.18, 0.24), ea = 1 - seg(q, 0.42, 0.46);
    if (ek > 0 && ea > 0) {
      const ex = hp[0] + 330, ey = hp[1] - 240;
      g.text('!', ex, ey, { size: 200, font: 'round', color: P.snow, stroke: P.ink, strokeWidth: 14, progress: ek, alpha: ea, rot: 0.2, seed: 1730 });
      for (let i = 0; i < 3; i++) {
        const a = -1.2 + i * 0.42;
        g.line(ex + Math.cos(a) * 110, ey + Math.sin(a) * 110, ex + Math.cos(a) * 160, ey + Math.sin(a) * 160, { color: P.ink, width: 7, alpha: ea, progress: ek, seed: 1731 + i });
      }
    }
    // 噗
    const pk = seg(q, 0.63, 0.7), pa = 1 - seg(q, 0.9, 0.97);
    if (pk > 0 && pa > 0) {
      const sp = toScreen(c, HAT_REST.x + 40, HAT_REST.y - 150);
      g.text('噗', sp[0] + 80, sp[1] - 30 - 20 * ease.out(pk), { size: 200, font: 'brush', color: P.snow, stroke: P.ink, strokeWidth: 16, progress: pk, alpha: pa, rot: 0.15, seed: 1740, shadow: { color: rgba(P.warmDeep, 0.85), dx: 7, dy: 7 } });
    }
    // 尴尬的汗
    const swk = seg(q, 0.74, 0.8);
    if (swk > 0) {
      const hs = toScreen(c, h.x - h.r * 0.95, h.y - h.r * 0.55);
      C.drop(g, hs[0], hs[1] + ease.in(seg(q, 0.82, 1)) * 30, 1.5 * ease.outBack(swk), { seed: 1750, fill: '#d8ecff' });
    }
  }

  // ------------------------------------------------------------ S4 三格漫画：手臂垂下
  const PANELS = [
    { label: '11:00', melt: [0.42, 0.47], arms: (t) => [0.3, 0.6 + 0.4 * Math.sin(t * 7)], mood: 'happy', look: 0.75, sun: [700, 520], rot: -0.018 },
    { label: '13:00', melt: [0.54, 0.59], arms: () => [0, 0], mood: 'calm', look: 0.85, sun: [850, 500], rot: 0.012, tip: true },
    { label: '15:00', melt: [0.66, 0.71], arms: () => [-0.4, -0.42], mood: 'happy', look: 0.95, sun: [1010, 545], rot: -0.01, bud: true, brows: true },
  ];
  const PW = 580, PH = 600, PGAP = 40, PX0 = (W - PW * 3 - PGAP * 2) / 2, PY0 = 132;
  function shot4(g, q, t, info, p) {
    const ctx = g.ctx;
    const w = warmthOf(p), gd = goldOf(p), bloom = bloomOf(p);
    g.bg(['#f7f1dd', '#f2efd6', '#e6efcf']);
    ctx.save();
    ctx.strokeStyle = rgba(P.greenDeep, 0.07);
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let k = -10; k < 30; k++) {
      const x = k * 90 + ((t * 8) % 90);
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 500, H);
    }
    ctx.stroke();
    ctx.restore();
    // 时间轴
    const TY = 820;
    const lk = seg(q, 0.02, 0.5);
    g.line(PX0 - 10, TY, PX0 + PW * 3 + PGAP * 2 + 10, TY + 2, { color: P.ink, width: 4.5, progress: lk, seed: 1800 });
    PANELS.forEach((pn, k) => {
      const cx = PX0 + PW * k + PGAP * k + PW / 2, cy = PY0 + PH / 2;
      const a0 = k * 0.22;
      const pk = seg(q, a0, a0 + 0.12);
      if (pk < 1) {
        // 空的分格：铅笔草稿框
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(pn.rot);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(-PW / 2, -PH / 2, PW, PH);
        g.rect(-PW / 2, -PH / 2, PW, PH, { color: rgba(P.inkSoft, 0.55), width: 3, sketch: true, seed: 1790 + k * 4 });
        ctx.restore();
      }
      if (pk > 0) {
        const yo = lerp(-180, 0, ease.outBack(pk));
        withAlpha(g, clamp(pk * 3), () => panel(g, k, pn, cx, cy + yo, seg(q, a0, 1), t, { w: Math.min(1, w + k * 0.06), gd: Math.min(1, gd + k * 0.16), bloom: Math.min(1, bloom + k * 0.08) }));
      }
      const tk = seg(q, a0 + 0.06, a0 + 0.12);
      if (tk > 0) g.circle(cx, TY + 1, 12, { color: P.ink, width: 3.5, fill: k === 2 ? P.warmDeep : P.sun, seed: 1810 + k, alpha: tk });
    });
    // 小太阳沿着时间轴走
    if (lk > 0.1) {
      const sx = lerp(PX0 + PW / 2, PX0 + PW * 2.5 + PGAP * 2, ease.inOut(seg(q, 0.06, 0.8)));
      shine(g, sx, TY, 80, P.sun, 0.8);
      g.circle(sx, TY, 20, { color: '#e89a38', width: 3.5, fill: P.sun, seed: 1820 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + t * 2;
        g.line(sx + Math.cos(a) * 28, TY + Math.sin(a) * 28, sx + Math.cos(a) * 38, TY + Math.sin(a) * 38, { color: '#f0a83e', width: 3.5, seed: 1830 + i });
      }
    }
  }
  function panel(g, k, pn, cx, cy, q, t, st) {
    const ctx = g.ctx;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(pn.rot);
    ctx.fillStyle = rgba(P.ink, 0.18);
    ctx.fillRect(-PW / 2 + 12, -PH / 2 + 14, PW, PH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-PW / 2, -PH / 2, PW, PH);
    ctx.clip();
    // 世界：镜头对准雪人
    const c = { x: SX + 92, y: SY - 160, z: 1.3 };
    const v = viewOf(c, PW, PH);
    ctx.scale(c.z, c.z);
    ctx.translate(-c.x, -c.y);
    const gr = ctx.createLinearGradient(0, v.y0, 0, 700);
    skyCols(st.w, st.gd).forEach((col, i) => gr.addColorStop(i / 2, col));
    ctx.fillStyle = gr;
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    sun(g, pn.sun[0], pn.sun[1], 30, t);
    cloud(g, c.x - 150 + ((t * 10 + k * 180) % 320), c.y - 225 + k * 8, 0.45, 1840 + k);
    hills(g, st.w, st.gd, v);
    ground(g, st.w, st.gd, t, v);
    groundFlowers(g, st.bloom, t, v);
    const melt = lerp(pn.melt[0], pn.melt[1], q);
    const arms = pn.arms(t);
    drawHat(g, HAT_REST);
    snowman(g, melt, { mood: pn.mood, look: pn.look, blush: 0.75, arms });
    wetBody(g, melt);
    const h = headFrame(melt, pn.look);
    if (pn.brows) brows(g, h, melt, pn.look, 0, 1);
    bodyDrips(g, melt, t, 2, 1850 + k * 10);
    headBeads(g, h, t, 2, 1870 + k * 10);
    if (pn.tip) {
      const ag = armGeom(melt, arms, 1);
      noseDrip(g, [ag.ex, ag.ey + 4], t, 1.7, 1880, 1, 160);
    }
    if (pn.bud) {
      const ag = armGeom(melt, arms, 1);
      const bk = ease.outBack(seg(q, 0.15, 0.55));
      leaf(g, ag.mx + 4, ag.my - 2, ag.A - 1.25 + Math.sin(t * 2) * 0.08, 34 * bk, 1890);
      leaf(g, ag.mx + 10, ag.my + 6, ag.A + 0.9 + Math.sin(t * 2 + 1) * 0.08, 24 * ease.outBack(seg(q, 0.35, 0.7)), 1893);
      if (bk > 0.9) sparkle(g, ag.mx + 36, ag.my - 40, 12 + 4 * Math.sin(t * 6), '#ffffff', 0.95, 1896);
    }
    ctx.restore();
    // 框 + 时间标签
    g.rect(-PW / 2, -PH / 2, PW, PH, { color: P.ink, width: 5.5, seed: 1900 + k * 3 });
    g.rect(-PW / 2 + 22, -PH / 2 - 30, 184, 80, { color: P.ink, width: 4, fill: k === 2 ? '#ffe2b4' : '#fffaf0', seed: 1901 + k * 3 });
    g.text(pn.label, -PW / 2 + 114, -PH / 2 + 10, { size: 68, font: 'latin', color: P.ink, progress: seg(q, 0.04, 0.24), seed: 1902 + k * 3, weight: 700 });
    ctx.restore();
  }

  // ------------------------------------------------------------ S5 望着门，在笑
  function thought(g, x, y, k, t, from) {
    if (k <= 0) return;
    const ctx = g.ctx;
    [[0.0, 9], [0.12, 14], [0.24, 20]].forEach(([d, r], i) => {
      const bk = ease.outBack(seg(k, d, d + 0.14));
      if (bk <= 0) return;
      const px = lerp(from[0], x - 120, 0.2 + i * 0.27), py = lerp(from[1], y + 105, 0.2 + i * 0.27);
      g.circle(px, py + Math.sin(t * 3 + i) * 3, r * bk, { color: P.ink, width: 3.5, fill: '#ffffff', seed: 2000 + i });
    });
    const bk = ease.outBack(seg(k, 0.36, 0.56));
    if (bk <= 0) return;
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 1.6) * 5);
    ctx.scale(bk, bk);
    const pts = [];
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * TAU;
      const rr = 1 + 0.12 * Math.cos(a * 5.5 + 0.4);
      pts.push([Math.cos(a) * 150 * rr, Math.sin(a) * 112 * rr]);
    }
    g.path(pts, { closed: true, smooth: true, color: P.ink, width: 4.5, fill: '#fffdf6', seed: 2010 });
    g.glow(0, 0, 130, P.warm, 0.35);
    C.mitten(g, -40, 66, 0.5, -0.25 + Math.sin(t * 3.2) * 0.12, { seed: 2020 });
    const hb = 1 + 0.12 * Math.max(0, Math.sin(t * 5));
    C.heart(g, 64, -16, 34 * hb, { seed: 2030 });
    ctx.restore();
  }
  function curvePt(a, b, k) {
    const mx = (a[0] + b[0]) / 2, my = Math.min(a[1], b[1]) - 110;
    const u = 1 - k;
    return [u * u * a[0] + 2 * u * k * mx + k * k * b[0], u * u * a[1] + 2 * u * k * my + k * k * b[1]];
  }
  /** 「第 111 天」：汉字用手写体，数字用英文手写体（"111" 用中文手写体会像"川"） */
  function dayCount(g, x, y, k, seed) {
    if (k <= 0) return;
    const o = { color: P.ink, stroke: PAPER_STROKE, strokeWidth: 14, shadow: { color: rgba(P.warm, 0.95), dx: 5, dy: 5 } };
    g.text('第', x - 150, y + 4, Object.assign({ size: 100, progress: clamp(k * 3), rot: -0.05, seed }, o));
    g.text('111', x + 2, y - 2, Object.assign({ size: 128, font: 'latin', weight: 700, progress: clamp(k * 3 - 1), rot: -0.04, seed: seed + 1 }, o));
    g.text('天', x + 150, y + 2, Object.assign({ size: 100, progress: clamp(k * 3 - 2), rot: -0.03, seed: seed + 2 }, o));
  }
  function shot5(g, q, t, info, p) {
    const w = warmthOf(p), gd = goldOf(p), bloom = bloomOf(p);
    const melt = lerp(0.76, 0.82, q);
    const look = 1;
    const h = headFrame(melt, look);
    // 镜头：脸部特写（在笑）→ 拉远，露出他一直望着的那扇门
    const pb = ease.inOut(seg(q, 0.3, 0.62));
    const z0 = lerp(3.5, 3.7, seg(q, 0, 0.3)), z1 = lerp(1.5, 1.58, seg(q, 0.62, 1));
    const c = {
      x: lerp(h.x + 140, lerp(1080, 1105, seg(q, 0.62, 1)), pb),
      y: lerp(h.y + 28, 690, pb),
      z: Math.exp(lerp(Math.log(z0), Math.log(z1), pb)),
    };
    const v = viewOf(c);
    g.bg(skyCols(w, gd));
    // 夕阳在房子后面
    const sunS = toScreen(c, 1760, lerp(60, 96, q));
    sun(g, sunS[0], sunS[1], 78, t, 1, false);
    clouds(g, t, 0.9, [[300, 330, 0.7, 7], [900, 120, 0.85, 5], [1300, 260, 0.5, 8]]);
    camOn(g, c);
    world(g, { w, gd, t, bloom, pulse: info.pulse }, v);
    g.restore();
    bokeh(g, t, 1 - pb, 77);
    camOn(g, c);
    // 门上的暖光
    shine(g, DOOR.x + DOOR.w / 2, DOOR.y + DOOR.h * 0.45, 420, P.glow, 0.45);
    TWIGS.forEach((tw) => twig(g, tw));
    drawHat(g, HAT_REST);
    const blink = (t % 4.2) < 0.13;
    const smiling = (q > 0.12 && q < 0.44) || q > 0.9;   // 眯眼笑；最后一刻也是笑着的
    snowman(g, melt, { mood: 'happy', look, lookUp: 0.08, blush: smiling ? 1 : 0.9, eyesClosed: blink && !smiling });
    wetBody(g, melt);
    if (smiling) happyEyes(g, h, melt, look, 0.08);
    else brows(g, h, melt, look, 0.08, 0.35);
    bodyDrips(g, melt, t, 3, 2100);
    headBeads(g, h, t, 2, 2095);
    // 视线：虚线连到门上
    const eye = headPt(h, look * h.r * 0.28 + h.r * 0.55, -h.r * 0.15);
    const tgt = [DOOR.x + DOOR.w * 0.42, DOOR.y + DOOR.h * 0.5];
    const vk = seg(q, 0.48, 0.74);
    const N = 10;
    for (let i = 0; i < N; i++) {
      const a = 0.08 + (i / N) * 0.92, b = a + 0.5 / N;
      const dk = clamp(vk * N - i);
      if (dk <= 0) break;
      const pa = curvePt(eye, tgt, a), pb2 = curvePt(eye, tgt, lerp(a, b, dk));
      g.line(pa[0], pa[1], pb2[0], pb2[1], { color: P.warmDeep, width: 6, seed: 2200 + i });
    }
    if (vk >= 1) {
      const s = 1 + 0.15 * Math.sin(t * 5);
      sparkle(g, tgt[0] + 26, tgt[1] - 14, 22 * s, '#ffffff', 0.95, 2220);
      sparkle(g, tgt[0] - 16, tgt[1] + 24, 12 * s, '#ffffff', 0.8, 2222);
    }
    const bubbleFrom = headPt(h, 0, -h.r * 1.15);
    withAlpha(g, 1 - seg(q, 0.9, 0.99), () => thought(g, SX + 225, SY - 345, seg(q, 0.62, 0.95), t, bubbleFrom));
    g.restore();
    // 特写时：门那边的暖光照在脸上
    shine(g, W + 80, 380, 1000, P.glow, 0.55 * (1 - pb));
    petals(g, t, 22, 41, 1);
    motes(g, t, 1, 34, 30);
    sunlight(g, sunS[0], sunS[1], 0.9, 0.7, t, 2.4, 78);
    // 第 111 天
    const tk = seg(q, 0.04, 0.26);
    dayCount(g, 330, 150, tk, 2300);
    if (tk >= 1) g.curve([[160, 226], [290, 236], [430, 228], [520, 234]], { color: P.warmDeep, width: 6, progress: seg(q, 0.26, 0.36), seed: 2301 });
  }

  // ------------------------------------------------------------ S6 只剩
  function label(g, str, lx, ly, tx, ty, k, o = {}) {
    if (k <= 0) return;
    const col = o.color || P.ink, size = o.size || 80, lw = o.width || 5;
    g.text(str, lx, ly, { size, color: col, progress: clamp(k * 2.2), rot: o.rot || 0, stroke: PAPER_STROKE, strokeWidth: 13, seed: o.seed });
    const ak = seg(k, 0.3, 0.85);
    if (ak <= 0) return;
    const dx = tx - lx, dy = ty - ly, d = Math.hypot(dx, dy) || 1;
    const off = size * (o.off || 0.75);
    const sx = lx + (dx / d) * off, sy = ly + (dy / d) * off;
    const ex = tx - (dx / d) * 12, ey = ty - (dy / d) * 12;
    const bend = o.bend == null ? 0.25 : o.bend;
    const mx = (sx + ex) / 2 - (ey - sy) * bend, my = (sy + ey) / 2 + (ex - sx) * bend;
    g.curve([[sx, sy], [mx, my], [ex, ey]], { color: col, width: lw, progress: ak, seed: (o.seed | 0) + 1 });
    if (ak >= 1) {
      const ang = Math.atan2(ey - my, ex - mx), L = 20;
      g.line(ex, ey, ex - Math.cos(ang - 0.5) * L, ey - Math.sin(ang - 0.5) * L, { color: col, width: lw, seed: (o.seed | 0) + 2 });
      g.line(ex, ey, ex - Math.cos(ang + 0.5) * L, ey - Math.sin(ang + 0.5) * L, { color: col, width: lw, seed: (o.seed | 0) + 3 });
    }
  }
  /** 化完以后：水坑（倒映着天空、有涟漪和光点）+ 围巾、胡萝卜、煤球（位置和 C.snowman melt=1 时一致） */
  function remnants(g, t, gd) {
    const ctx = g.ctx;
    const x = SX, y = SY, seed = 7;
    const pr = 260, cy = y + 6;
    g.ellipse(x, cy, pr, pr * 0.22, { color: rgba(P.ice, 0.9), width: 3, fill: rgba(P.water, 0.8), seed: seed + 1 });
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, cy, pr * 0.96, pr * 0.22 * 0.92, 0, 0, TAU);
    ctx.clip();
    const gr = ctx.createLinearGradient(0, cy - 56, 0, cy + 56);
    gr.addColorStop(0, rgba(mix('#d4ecf8', '#ffe6b4', gd), 0.85));
    gr.addColorStop(1, rgba('#9fc6ea', 0.2));
    ctx.fillStyle = gr;
    ctx.fillRect(x - pr, cy - 70, pr * 2, 140);
    for (let i = 0; i < 2; i++) {
      const per = 2.6, ph = ((t + i * 1.3) / per) % 1;
      const rx = x - 150 + i * 290, ry = cy + 12 - i * 16;
      for (let j = 0; j < 2; j++) {
        const pk = clamp(ph * 1.2 - j * 0.2);
        if (pk <= 0) continue;
        g.ellipse(rx, ry, lerp(4, 110, ease.out(pk)), lerp(1.5, 22, ease.out(pk)), { color: '#ffffff', width: 2.6, alpha: (1 - pk) * 0.9, seed: 2400 + i * 2 + j });
      }
    }
    ctx.restore();
    g.line(x - pr * 0.5, y + 2, x - pr * 0.15, y - 2, { color: '#ffffff', width: 3, alpha: 0.8, seed: seed + 2 });
    C.scarf(g, x - 20, y - 6, 1, { t, seed: seed + 80 });
    C.carrot(g, x + 70, y - 4, 0.9, 0.25, { seed: seed + 81 });
    C.dot(g, x - 110, y - 2, 8, P.ink, seed + 82);
    C.dot(g, x + 130, y + 4, 8, P.ink, seed + 83);
    C.dot(g, x + 10, y + 10, 7, P.ink, seed + 84);
    for (let i = 0; i < 4; i++) {
      const k = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.9);
      sparkle(g, x - 200 + i * 130, cy - 14 + (i % 2) * 26, 6 + 9 * k, '#ffffff', 0.9 * k, 2420 + i * 2);
    }
  }
  function shot6(g, q, t, info, p) {
    const w = warmthOf(p), gd = goldOf(p), bloom = bloomOf(p);
    const pull = ease.inOut(seg(q, 0.25, 1));
    const c = { x: lerp(SX + 40, SX + 150, pull), y: lerp(SY - 70, SY - 120, pull), z: lerp(1.72, 1.32, pull) };
    const v = viewOf(c);
    g.bg(skyCols(w, gd));
    const sunS = toScreen(c, 1760, 90);
    sun(g, sunS[0], sunS[1], 78, t, 1, false);
    clouds(g, t, 0.85, [[300, 120, 0.8, 7], [1000, 70, 0.6, 5]]);
    camOn(g, c);
    world(g, { w, gd, t, bloom, pulse: info.pulse }, v);
    shine(g, DOOR.x + DOOR.w / 2, DOOR.y + DOOR.h * 0.45, 420, P.glow, 0.45);
    remnants(g, t, gd);
    TWIGS.forEach((tw) => twig(g, tw));
    drawHat(g, HAT_REST);
    // 水坑边一朵一朵开花
    RIM_FLOWERS.forEach(([x, y, r, d], i) => {
      const k = seg(q, 0.12 + d * 0.6, 0.24 + d * 0.6);
      flower(g, x, y, r * (1 + 0.05 * (info.pulse || 0)), FLOWER_COLS[(i + 2) % FLOWER_COLS.length], k, 2500 + i, Math.sin(t * 1.7 + i) * r * 0.2);
    });
    g.restore();
    petals(g, t, 26, 42, 1);
    motes(g, t, 1, 35, 30);
    sunlight(g, sunS[0], sunS[1], 0.9, 0.6, t, 2.5, 78);
    // 标注：一样一样（上：围巾、帽子；下：眼睛、鼻子）
    const S = (x, y) => toScreen(c, x, y);
    const dim = 1 - 0.45 * seg(q, 0.66, 0.8);
    const items = [
      // [字, 目标 x, 目标 y, 字的屏幕偏移 dx, dy, 出现, 弯曲]
      ['围巾', SX - 96, SY - 16, -150, -210, 0.04, 0.22],
      ['帽子', HAT_REST.x + 40, HAT_REST.y - 52, 140, -170, 0.14, -0.22],
      ['眼睛', SX - 112, SY + 6, -150, 150, 0.24, -0.2],
      ['鼻子', SX + 112, SY + 2, 150, 158, 0.34, 0.2],
    ];
    items.forEach(([str, x, y, ox, oy, a0, bend], i) => {
      const tp = S(x, y);
      withAlpha(g, dim, () => label(g, str, tp[0] + ox, tp[1] + oy, tp[0], tp[1], seg(q, a0, a0 + 0.12), { seed: 2600 + i * 5, bend, rot: i % 2 ? 0.06 : -0.05 }));
    });
    // 眼睛有两颗：第二根箭头
    const ek = seg(q, 0.33, 0.4);
    if (ek > 0) {
      const el = S(SX - 112, SY + 6), e2 = S(SX + 10, SY + 16);
      const lx = el[0] - 150, ly = el[1] + 150;
      withAlpha(g, dim, () => g.curve([[lx + 60, ly - 22], [lerp(lx, e2[0], 0.6), ly + 10], [e2[0] - 6, e2[1] + 14]], { color: P.ink, width: 5, progress: ek, seed: 2630 }));
    }
    // 我
    const wk = seg(q, 0.48, 0.66);
    if (wk > 0) {
      const pt = S(SX + 40, SY + 28);
      label(g, '我', pt[0] + 40, pt[1] - 330, pt[0] + 6, pt[1] - 8, wk, { size: 170, color: '#3f6fa8', seed: 2650, bend: 0.12, width: 7, rot: 0.04, off: 0.55 });
      if (wk >= 1) {
        const s = 1 + 0.1 * Math.sin(t * 4);
        sparkle(g, pt[0] + 140, pt[1] - 400, 18 * s, '#ffffff', 0.9, 2660);
      }
    }
  }

  const SHOTS = [shot1, shot2, shot3, shot4, shot5, shot6];

  TG.scene({
    id: 'melt',
    title: '融',
    transition: 'flash',
    chars: '3月21日·晴第111天噗帽子围巾鼻眼睛我+-18°C:0',
    lyrics: 'default',
    draw(g, p, t, info) {
      let i = 0;
      while (i < SHOTS.length - 1 && p >= CUT[i + 1]) i++;
      const q = seg(p, CUT[i], CUT[i + 1]);
      SHOTS[i](g, q, t, info, p);
      const since = (p - CUT[i]) * info.dur;
      if (i === 1 || i === 3) cutFlash(g, since, '#fff8ea', 0.75);
      if (i === 5) cutFlash(g, since, '#fff8ea', 0.55, 0.35);
    },
  });
})();
