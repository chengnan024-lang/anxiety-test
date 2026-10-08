/* 场景：intro —— 前奏 · 初雪
 *
 * 镜头（按 p 分段）：
 *   1  0.00–0.15  黑夜里，一片雪花一笔一笔画出来（先有铅笔辅助线，再一瓣一瓣描）
 *   2  0.15–0.35  镜头拉远：雪越下越大，毛笔按笔顺写出竖排大标题「雪人」+ 题字 + 红色印章"啪"
 *   3  0.35–0.50  跟拍：一双红手套推着雪球在雪地上滚，越滚越大（咕噜咕噜）
 *   4  0.50–0.60  全景：你家门前，手套把雪人的头放上去（咚）
 *   5  0.60–0.71  脸部特写：眼睛啪、啪点上，手套插上胡萝卜，画上嘴
 *   6  0.71–1.00  中景：树枝手臂、帽子落下 → 手套给他围上红围巾、摸摸脸 → 推近：雪人望向你离开的方向，眨眼
 */
(function () {
  'use strict';
  const { clamp, lerp, seg, ease, rand, noise1, mix, rgba, catmull } = TG.U;
  const P = TG.PAL, C = TG.C, W = TG.W, H = TG.H;
  const TAU = Math.PI * 2;
  const COAT = '#4a3436', COAT_LIT = '#6e5156';
  const GROUND = '#e3e9f6';
  const SNOW_TXT = '#fbfcff';

  // ------------------------------------------------------------------ 小工具
  function sky(g, low) {
    g.bg([P.nightDeep, P.night, low || mix(P.night, P.nightBlue, 0.75)]);
  }

  function stars(g, t, n, seed, maxY, a = 1) {
    if (a <= 0) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.fillStyle = '#e8eeff';
    ctx.strokeStyle = '#e8eeff';
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = rand(i, seed, 1) * W, y = rand(i, seed, 2) * maxY;
      const tw = 0.5 + 0.5 * Math.sin(t * (1.3 + rand(i, seed, 3) * 2.2) + i * 1.7);
      const r = 0.7 + rand(i, seed, 4) * rand(i, seed, 5) * 2.6;
      ctx.globalAlpha = a * (0.2 + 0.65 * tw);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      if (r > 2.1) {
        const L = r * (2 + 2.5 * tw);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(x - L, y); ctx.lineTo(x + L, y);
        ctx.moveTo(x, y - L); ctx.lineTo(x, y + L);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** 三层雪：k 0..1 越来越密（每层依次淡入，不会"蹦"出来） */
  function snowfall(g, t, k, o = {}) {
    const wind = o.wind == null ? 18 : o.wind;
    const a1 = clamp(k * 3), a2 = clamp(k * 3 - 1), a3 = clamp(k * 3 - 2);
    if (a1 > 0) g.snow({ t, count: 120, seed: 11, size: [1.4, 3.6], speed: [26, 55], wind: wind * 0.6, sway: 18, alpha: 0.75 * a1 });
    if (a2 > 0) g.snow({ t, count: 70, seed: 12, size: [3, 6.5], speed: [50, 95], wind, alpha: 0.85 * a2 });
    if (a3 > 0 && !o.noNear) g.snow({ t, count: 14, seed: 13, size: [10, 17], speed: [95, 150], wind: wind * 1.4, crystal: 10, alpha: 0.9 * a3 });
  }

  /** 前景虚化的光斑 */
  function bokeh(g, t, n, seed, color, a, r0, r1) {
    if (a <= 0) return;
    for (let i = 0; i < n; i++) {
      const r = lerp(r0, r1, rand(i, seed, 1));
      const sp = 14 + rand(i, seed, 2) * 26;
      const span = H + r * 2;
      const y = ((rand(i, seed, 3) * span + t * sp) % span) - r;
      const x = rand(i, seed, 4) * W + Math.sin(t * 0.35 + i * 2.1) * 40;
      g.glow(x, y, r, color, a * (0.55 + 0.45 * Math.sin(t * 1.1 + i * 2.3)));
    }
  }

  /** 四角星闪光 */
  function sparkle(g, x, y, r, a, rot = 0, color = '#ffffff') {
    if (a <= 0) return;
    const ctx = g.ctx;
    g.glow(x, y, r * 3, '#dfe9ff', 0.55 * a);
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = color;
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const rr = k % 2 ? r * 0.26 : r;
      const an = (k * Math.PI) / 4;
      ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** 放射状的冲击线（"啪"的感觉）。k 0..1 */
  function burst(g, x, y, r0, r1, k, n, seed, color, w = 4) {
    if (k <= 0 || k >= 1) return;
    const e = ease.outCubic(k);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(i, seed, 1) * 0.5;
      const ra = lerp(r0, r1, e * 0.55), rb = lerp(r0, r1, e) * (0.85 + rand(i, seed, 2) * 0.3);
      g.line(x + Math.cos(a) * ra, y + Math.sin(a) * ra, x + Math.cos(a) * rb, y + Math.sin(a) * rb, { color, width: w, alpha: 1 - k * k, seed: seed + i });
    }
  }

  /** 漫画式集中线：从画面四周指向 (cx, cy)，k 0..1 */
  function focusLines(g, cx, cy, k, seed, color = '#ffffff', r0 = 520) {
    if (k <= 0 || k >= 1) return;
    const ctx = g.ctx;
    const b = g.info.boil;
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha *= 0.55 * (1 - k);
    ctx.beginPath();
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * TAU + (rand(i, seed, b) - 0.5) * 0.1;
      const ri = r0 * (0.85 + rand(i, seed + 1, b) * 0.5) + k * 80;
      const w = 3 + rand(i, seed + 2, b) * 9;
      const ca = Math.cos(a), sa = Math.sin(a);
      ctx.moveTo(cx + ca * ri, cy + sa * ri);
      ctx.lineTo(cx + ca * 1500 - sa * w, cy + sa * 1500 + ca * w);
      ctx.lineTo(cx + ca * 1500 + sa * w, cy + sa * 1500 - ca * w);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }

  /** 雪粉扬起 */
  function puff(g, x, y, k, seed, s = 1, spread = 120, flat = 0.55) {
    if (k <= 0 || k >= 1) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.globalAlpha *= 1 - ease.in(k);
    for (let i = 0; i < 10; i++) {
      const a = Math.PI + 0.15 + rand(i, seed, 1) * (Math.PI - 0.3);
      const d = ease.outCubic(k) * spread * (0.45 + rand(i, seed, 2) * 0.7) * s;
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * flat + k * k * 30 * s;
      const r = (5 + rand(i, seed, 3) * 10) * s * (1 - k * 0.5);
      g.circle(px, py, r, { fill: P.snow, color: P.ink, width: 2.2 * s, seed: seed + i });
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ 毛笔按笔顺写字
  // 每个字的笔画中心线（以字号为单位、字中心为原点），按笔顺排列。
  // 写到一半时用这些笔画做遮罩，露出真正的毛笔字形；写完后直接画整个字。
  const STROKES = {
    '雪': [
      [[-0.13, -0.36], [0.07, -0.37]],
      [[-0.30, -0.20], [-0.33, -0.08], [-0.37, 0.0]],
      [[-0.29, -0.20], [-0.17, -0.25], [0.0, -0.28], [0.25, -0.265], [0.37, -0.24], [0.40, -0.17], [0.33, -0.135], [0.24, -0.16], [0.17, -0.095]],
      [[-0.06, -0.32], [-0.045, -0.15], [-0.04, 0.0]],
      [[-0.15, -0.21], [-0.105, -0.15]],
      [[-0.19, -0.09], [-0.13, -0.02]],
      [[0.07, -0.21], [0.03, -0.13]],
      [[0.04, -0.09], [0.12, -0.04], [0.2, -0.01]],
      [[-0.19, 0.09], [0.0, 0.04], [0.16, 0.07], [0.2, 0.12], [0.16, 0.2], [0.13, 0.32], [0.1, 0.43]],
      [[-0.17, 0.25], [0.04, 0.18]],
      [[-0.17, 0.43], [0.01, 0.37], [0.1, 0.42]],
    ],
    '人': [
      [[-0.02, -0.29], [-0.09, -0.16], [-0.18, -0.03], [-0.30, 0.14], [-0.45, 0.31]],
      [[-0.11, -0.05], [-0.03, 0.03], [0.09, 0.16], [0.26, 0.29], [0.44, 0.27]],
    ],
  };
  const strokeLen = {};
  for (const ch in STROKES) {
    strokeLen[ch] = STROKES[ch].map((st) => {
      let L = 0;
      for (let i = 1; i < st.length; i++) L += Math.hypot(st[i][0] - st[i - 1][0], st[i][1] - st[i - 1][1]);
      return L;
    });
  }

  /** 画一个毛笔字，prog 0..1 按笔顺写出；返回笔尖位置（写完 / 没开始返回 null） */
  function brushChar(g, ch, x, y, size, prog, o = {}) {
    if (prog <= 0) return null;
    const ctx = g.ctx;
    const boil = g.info.boil;
    const jx = (rand(boil, 31, o.seed | 0) - 0.5) * 2.4, jy = (rand(boil, 32, o.seed | 0) - 0.5) * 2.4;
    const rot = (rand(boil, 33, o.seed | 0) - 0.5) * 0.012;
    let tip = null;
    ctx.save();
    ctx.translate(x + jx, y + jy);
    ctx.rotate(rot);
    ctx.font = `${size}px ${TG.FONTS.brush}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const strokes = STROKES[ch];
    if (prog < 1 && strokes) {
      const lens = strokeLen[ch];
      const gap = 0.06; // 两笔之间提笔的停顿
      const total = lens.reduce((a, b) => a + b + gap, 0);
      let rem = prog * total;
      const R = size * (o.r || 0.085);
      const step = R * 0.45;
      ctx.beginPath();
      for (let si = 0; si < strokes.length && rem > 0; si++) {
        const st = strokes[si];
        for (let i = 1; i < st.length && rem > 0; i++) {
          const a = st[i - 1], b = st[i];
          const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const use = Math.min(L, rem);
          const n = Math.max(1, Math.ceil((use * size) / step));
          for (let k = 0; k <= n; k++) {
            const f = (use / L) * (k / n);
            const px = (a[0] + (b[0] - a[0]) * f) * size, py = (a[1] + (b[1] - a[1]) * f) * size;
            ctx.moveTo(px + R, py);
            ctx.arc(px, py, R, 0, TAU);
            tip = [px, py];
          }
          rem -= use;
        }
        rem -= gap;
      }
      ctx.clip();
    }
    if (o.shadow) {
      ctx.fillStyle = o.shadow;
      ctx.fillText(ch, o.sdx || 8, o.sdy || 7);
    }
    ctx.fillStyle = o.color || P.ink;
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    if (tip && prog < 1) return [x + jx + tip[0], y + jy + tip[1]];
    return null;
  }

  /** 红色小印章（竖排两个字），k 0..1：从大到小"啪"地盖下 */
  function seal(g, x, y, w, h, k, text) {
    if (k <= 0) return;
    const ctx = g.ctx;
    const e = ease.outCubic(clamp(k));
    const sc = lerp(2.6, 1, e);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lerp(-0.25, -0.05, e));
    ctx.scale(sc, sc);
    ctx.globalAlpha *= clamp(k * 2.5);
    g.rect(-w / 2, -h / 2, w, h, { fill: P.red, color: P.redDeep, width: 3, jitter: 1, seed: 71 });
    g.rect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, { color: '#fbe9e2', width: 2, jitter: 0.8, alpha: 0.85, seed: 72, taper: false });
    const chs = Array.from(text);
    chs.forEach((ch, i) => {
      g.text(ch, 0, -h / 2 + (h / chs.length) * (i + 0.5) + 2, { size: w * 0.62, font: 'brush', color: '#fbe9e2', pop: false, wobble: 0.25, seed: 73 + i });
    });
    // 印泥不匀的小白点
    ctx.fillStyle = 'rgba(244,239,228,0.75)';
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.arc((rand(i, 74) - 0.5) * w * 0.9, (rand(i, 75) - 0.5) * h * 0.9, 0.8 + rand(i, 76) * 1.8, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ 雪人（一步一步搭起来；几何和 C.snowman 完全一致）
  function geo(x, y, s) {
    const bodyRx = 132 * s, bodyRy = 118 * s, bodyCy = y - bodyRy;
    const headR = 80 * s, headCy = bodyCy - bodyRy * 0.82 - headR * 0.92;
    const ny = lerp(headCy + headR * 0.85, bodyCy - bodyRy * 0.8, 0.5);
    return { x, y, s, bodyRx, bodyRy, bodyCy, headR, headCx: x, headCy, nx: x, ny };
  }

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

  function carrotFace(g, fx, fy, s, seed) {
    const len = 47.6 * s, ang = 0.18;
    const tipX = fx + Math.cos(ang) * len, tipY = fy + Math.sin(ang) * len;
    const bx1 = fx - Math.sin(ang) * 10 * s, by1 = fy - 10 * s;
    const bx2 = fx + Math.sin(ang) * 3 * s, by2 = fy + 10 * s;
    g.poly([[bx1, by1], [tipX, tipY], [bx2, by2]], { color: P.ink, width: 3.5 * s, fill: P.carrot, seed });
    g.line(lerp(fx, tipX, 0.35), lerp(fy, tipY, 0.35) - 6 * s, lerp(fx, tipX, 0.4), lerp(fy, tipY, 0.4) + 3 * s, { color: '#b85a1c', width: 2.4 * s, seed: seed + 1 });
    g.line(lerp(fx, tipX, 0.62), lerp(fy, tipY, 0.62) - 4 * s, lerp(fx, tipX, 0.66), lerp(fy, tipY, 0.66) + 2 * s, { color: '#b85a1c', width: 2.2 * s, seed: seed + 2 });
    return [tipX, tipY];
  }

  /**
   * st = {arms:[l,r] 0..1, buttons 0..1, head:false|true, hx, hy, squash, eyes:[l,r] 0..1,
   *       blush, mouth 0..1, carrot 0..1, carrotOff(px)}
   */
  function buildMan(g, G, st) {
    const ctx = g.ctx, s = G.s, ink = P.ink, lw = 4.8 * s;
    const { x, y, bodyRx, bodyRy, bodyCy, headR } = G;
    const out = {};
    // 影子
    ctx.save();
    ctx.globalAlpha *= 0.18;
    ctx.fillStyle = P.nightBlue;
    ctx.beginPath();
    ctx.ellipse(x + 14 * s, y + 4 * s, bodyRx * 1.05, 16 * s, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    // 树枝手臂：从外面"插"进来
    const arms = st.arms || [0, 0];
    [-1, 1].forEach((side, k) => {
      const ak = clamp(arms[k] || 0);
      if (ak <= 0) return;
      const e = ease.outBack(ak);
      const wig = Math.sin(ak * 16) * 0.22 * (1 - ak);
      const A = (side === -1 ? Math.PI + 0.45 : -0.45) - side * wig;
      const off = (1 - e) * 130 * s;
      const bx = x + side * bodyRx * 0.86 + Math.cos(A) * off, by = bodyCy - bodyRy * 0.35 + Math.sin(A) * off;
      const L = 120 * s;
      const ex = bx + Math.cos(A) * L, ey = by + Math.sin(A) * L;
      const al = clamp(ak * 5);
      g.line(bx, by, ex, ey, { color: P.woodDark, width: 6 * s, seed: 10 + k, alpha: al });
      const mx = bx + Math.cos(A) * L * 0.62, my = by + Math.sin(A) * L * 0.62;
      g.line(mx, my, mx + Math.cos(A - side * 0.6) * 38 * s, my + Math.sin(A - side * 0.6) * 38 * s, { color: P.woodDark, width: 4 * s, seed: 12 + k, alpha: al });
      g.line(ex, ey, ex + Math.cos(A + side * 0.5) * 26 * s, ey + Math.sin(A + side * 0.5) * 26 * s, { color: P.woodDark, width: 3.5 * s, seed: 14 + k, alpha: al });
      g.line(ex, ey, ex + Math.cos(A - side * 0.45) * 22 * s, ey + Math.sin(A - side * 0.45) * 22 * s, { color: P.woodDark, width: 3 * s, seed: 16 + k, alpha: al });
      out['arm' + k] = [ex, ey];
    });
    // 身体
    g.ellipse(x, bodyCy, bodyRx, bodyRy, { color: ink, width: lw, fill: P.snow, seed: 20 });
    shade(g, x, bodyCy, bodyRx, bodyRy, 21);
    const bt = st.buttons || 0;
    for (let k = 0; k < 2; k++) {
      const bk = clamp(bt * 2 - k);
      if (bk <= 0) continue;
      C.dot(g, x, bodyCy - bodyRy * 0.35 + k * bodyRy * 0.42, 8 * s * ease.outBack(bk), ink, 30 + k);
    }
    if (!st.head) return out;
    // 头
    const hx = G.headCx + (st.hx || 0), hy = G.headCy + (st.hy || 0);
    const sq = st.squash || 0;
    out.head = [hx, hy];
    ctx.save();
    ctx.translate(hx, hy + headR);
    ctx.scale(1 + sq * 0.12, 1 - sq * 0.14);
    ctx.translate(0, -headR);
    g.circle(0, 0, headR, { color: ink, width: lw, fill: P.snow, seed: 40 });
    shade(g, 0, 0, headR, headR, 41);
    const ex = headR * 0.32, ey = -headR * 0.12, eyeR = 8.5 * s;
    const eyes = st.eyes || [0, 0];
    eyes.forEach((v, k) => {
      if (v <= 0) return;
      const side = k ? 1 : -1;
      const r = eyeR * ease.outBack(clamp(v));
      C.dot(g, side * ex, ey, Math.max(0.5, r), ink, 45 + k);
      if (v > 0.6) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(side * ex + 2.5 * s, ey - 3 * s, 2.6 * s, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    });
    out.eyes = [[hx - ex, hy + ey], [hx + ex, hy + ey]];
    const blush = st.blush || 0;
    if (blush > 0) {
      ctx.save();
      ctx.globalAlpha *= blush;
      ctx.fillStyle = P.pink;
      ctx.beginPath();
      ctx.ellipse(-ex - 8 * s, ey + 26 * s, 15 * s, 8 * s, 0, 0, TAU);
      ctx.ellipse(ex + 8 * s, ey + 26 * s, 15 * s, 8 * s, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      g.line(-ex - 16 * s, ey + 22 * s, -ex - 10 * s, ey + 30 * s, { color: '#e98a8a', width: 2 * s, alpha: blush, seed: 49 });
      g.line(ex + 4 * s, ey + 22 * s, ex + 10 * s, ey + 30 * s, { color: '#e98a8a', width: 2 * s, alpha: blush, seed: 50 });
    }
    if (st.mouth > 0) g.line(-9 * s, ey + 44 * s, 9 * s, ey + 45 * s, { color: ink, width: 4 * s, seed: 51, progress: st.mouth });
    if (st.carrot > 0) {
      const off = st.carrotOff || 0;
      const tip = carrotFace(g, off, ey + 18 * s, s, 52);
      out.tip = [hx + tip[0], hy + tip[1]];
      out.carrotBase = [hx, hy + ey + 18 * s];
    }
    ctx.restore();
    return out;
  }

  // ------------------------------------------------------------------ "你"的手：红手套 + 大衣袖子
  /** 大衣袖子：沿 pts（袖口 → 手肘 → 画面外的肩膀）画一条软软的布筒 */
  function sleeve(g, pts, w0, w1, seed = 0, fade = 0) {
    const c = catmull(pts, false, 10);
    // 远离手腕的部分渐渐隐进黑暗里（手是从画外伸进来的）
    let fill = COAT, line = P.ink, lit = COAT_LIT;
    if (fade > 0) {
      const a = pts[0], b = pts[pts.length - 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
      const mk = (col) => {
        const gr = g.ctx.createLinearGradient(a[0], a[1], a[0] + ux * fade, a[1] + uy * fade);
        gr.addColorStop(0, rgba(col, 1));
        gr.addColorStop(0.45, rgba(col, 1));
        gr.addColorStop(1, rgba(col, 0));
        return gr;
      };
      fill = mk(COAT); line = mk(P.ink); lit = mk(COAT_LIT);
    }
    const n = c.length;
    const acc = [0];
    for (let i = 1; i < n; i++) acc.push(acc[i - 1] + Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]));
    const left = [], right = [];
    for (let i = 0; i < n; i++) {
      const a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      const w = lerp(w0, w1, clamp(acc[i] / 360)) / 2;
      left.push([c[i][0] - dy * w, c[i][1] + dx * w]);
      right.push([c[i][0] + dy * w, c[i][1] - dx * w]);
    }
    g.path(left.concat(right.slice().reverse()), { closed: true, overshoot: false, color: line, width: 4, fill, seed });
    // 高光
    const rim = [];
    for (let i = 1; i < Math.min(n, 19); i++) rim.push([lerp(c[i][0], left[i][0], 0.6), lerp(c[i][1], left[i][1], 0.6)]);
    g.path(rim, { color: lit, width: 4.5, seed: seed + 1 });
    // 手肘的褶
    const e = Math.min(n - 2, 10);
    for (let k = 0; k < 2; k++) {
      const i0 = e - 1 + k * 2;
      g.line(lerp(c[i0][0], right[i0][0], 0.9), lerp(c[i0][1], right[i0][1], 0.9), lerp(c[i0 + 1][0], right[i0 + 1][0], 0.15), lerp(c[i0 + 1][1], right[i0 + 1][1], 0.15), { color: rgba(P.ink, 0.65), width: 3, seed: seed + 2 + k });
    }
  }

  /**
   * "你"的手。(wx, wy) 手腕；rot：0 = 指尖朝上。
   * 前臂顺着手套方向，手肘之后拐向 o.to（画面外的肩膀）。o.bend：手肘往侧面鼓多少。
   */
  function hand(g, wx, wy, ms, rot, o = {}) {
    const dx = Math.sin(rot), dy = -Math.cos(rot);
    const sx = wx - dx * 20 * ms, sy = wy - dy * 20 * ms;
    const fore = (o.fore || 230) * ms, bend = (o.bend || 0) * ms;
    const ex = wx - dx * fore - dy * bend, ey = wy - dy * fore + dx * bend;
    const to = o.to || [ex - dx * 1400, ey - dy * 1400];
    sleeve(g, [[sx, sy], [ex, ey], to], 100 * ms, 126 * ms, (o.seed | 0) + 5, o.fade == null ? 620 * ms : o.fade);
    C.mitten(g, wx, wy, ms, rot, { flip: o.flip, seed: o.seed | 0 });
  }

  /**
   * 景深：把已经画好的背景糊掉（缩小再放大 = 便宜的模糊），再压暗一点。
   * blurBuf 只是一块每次都整张覆盖重画的临时画布，不带任何帧间状态。
   */
  let blurBuf = null;
  function defocus(g, k, dark = 0) {
    const ctx = g.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (k > 0.02) {
      if (!blurBuf) {
        blurBuf = document.createElement('canvas');
        blurBuf.width = W / 5;
        blurBuf.height = H / 5;
      }
      const b = blurBuf.getContext('2d');
      b.imageSmoothingEnabled = true;
      b.imageSmoothingQuality = 'medium';
      b.clearRect(0, 0, blurBuf.width, blurBuf.height);
      b.drawImage(ctx.canvas, 0, 0, blurBuf.width, blurBuf.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'low';
      ctx.globalAlpha = clamp(k);
      ctx.drawImage(blurBuf, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (dark > 0) {
      ctx.fillStyle = rgba(P.nightDeep, dark);
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ 镜头 1 + 2：雪花 → 标题
  const FX = 620, FY = 455, FR = 205;

  function shotOpening(g, p, t, info) {
    const ctx = g.ctx;
    sky(g);
    stars(g, t, 80, 3, H * 0.85, 0.35 + 0.65 * seg(p, 0, 0.12));

    const pull = ease.inOutCubic(seg(p, 0.14, 0.215));
    const z = lerp(1.32 + 0.07 * ease.inOut(seg(p, 0, 0.15)), 1.0, pull) + 0.03 * ease.inOut(seg(p, 0.2, 0.35));
    const cx = lerp(FX, 960, pull), cy = lerp(FY + 30, 540, pull);
    // 印章盖下时的震动
    const shakeK = 1 - seg(p, 0.327, 0.338);
    const sh = p > 0.326 && shakeK > 0 ? g.shake(9 * shakeK) : [0, 0];

    g.save();
    g.camera(cx, cy, z, lerp(-0.025, 0, pull), sh[0], sh[1]);

    // 远处的雪丘 + 村子的灯（拉远之后才看得见）
    const hillA = clamp(pull * 1.2);
    if (hillA > 0) {
      ctx.save();
      ctx.globalAlpha *= hillA;
      const pts = [[-200, 1300]];
      for (let x = -200; x <= W + 200; x += 60) pts.push([x, 905 + noise1(x / 330, 4) * 34 + noise1(x / 90, 5) * 6]);
      pts.push([W + 200, 1300]);
      g.path(pts, { closed: true, color: rgba(P.ice, 0.55), width: 3, fill: mix(P.nightBlue, P.ice, 0.22), seed: 81, overshoot: false });
      for (let i = 0; i < 9; i++) {
        const lx = 120 + i * 205 + rand(i, 82) * 90, ly = 905 + noise1(lx / 330, 4) * 34 + 22 + rand(i, 83) * 20;
        const on = 0.6 + 0.4 * Math.sin(t * 2 + i * 1.3);
        g.glow(lx, ly, 26, P.warm, 0.5 * on);
        ctx.fillStyle = P.glow;
        ctx.fillRect(lx - 3, ly - 3, 6, 6);
      }
      ctx.restore();
    }

    // ---- 雪花（镜头 1）
    const fp = ease.inOut(seg(p, 0.018, 0.118));
    const done = seg(p, 0.112, 0.13);
    const tDone = 0.118 * info.dur;
    const rot = -Math.PI / 2 + 0.11 * Math.max(0, t - tDone) + Math.sin(t * 0.7) * 0.015;
    g.glow(FX, FY, FR * 1.9, P.ice, 0.1 + 0.16 * done);
    g.glow(FX, FY, FR * 0.9, '#ffffff', 0.05 + 0.12 * done);
    // 铅笔辅助线
    const guideOut = 1 - seg(p, 0.12, 0.17);
    if (guideOut > 0) {
      const gc = ease.out(seg(p, -0.01, 0.032));
      const ga0 = -Math.PI / 2 - 0.4, ga1 = ga0 + (TAU + 0.12) * gc;
      g.arc(FX, FY, FR * 1.06, ga0, ga1, { color: P.ice, width: 1.8, alpha: 0.45 * guideOut, jitter: 1, seed: 1 });
      if (gc < 1) sparkle(g, FX + Math.cos(ga1) * FR * 1.06, FY + Math.sin(ga1) * FR * 1.06, 11, 0.9, t * 3);
      const gi = ease.out(seg(p, 0.01, 0.036));
      if (gi > 0) g.arc(FX, FY, FR * 0.5, ga0 + 2, ga0 + 2 + (TAU + 0.1) * gi, { color: P.ice, width: 1.3, alpha: 0.28 * guideOut, jitter: 1, seed: 2 });
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 3;
        const L = FR * 1.16;
        g.line(FX - Math.cos(a) * L, FY - Math.sin(a) * L, FX + Math.cos(a) * L, FY + Math.sin(a) * L, {
          color: P.ice, width: 1.3, alpha: 0.32 * guideOut, progress: ease.out(seg(p, 0.004 + k * 0.006, 0.02 + k * 0.006)), jitter: 0.8, seed: 3 + k,
        });
      }
    }
    if (fp > 0) {
      C.flake(g, FX, FY, FR, { rot, color: SNOW_TXT, width: 10, progress: fp, fill: fp >= 1 ? '#dfe9ff' : null, seed: 5 });
      // 笔尖的小亮光
      if (fp < 1) {
        const k = Math.min(5, Math.floor(fp * 6)), pk = fp * 6 - k;
        const a = rot + (k * Math.PI) / 3;
        const d = FR * Math.min(1, pk * 1.25);
        sparkle(g, FX + Math.cos(a) * d, FY + Math.sin(a) * d, 16, 1, t * 3);
      } else {
        // 画完那一下闪一闪
        const fl = seg(p, 0.118, 0.14);
        if (fl < 1) sparkle(g, FX, FY, lerp(30, 90, ease.out(fl)), 1 - fl, 0.4);
      }
    }
    // 日期
    g.text('12.01', FX, FY + FR + 92, { font: 'latin', size: 76, color: P.ice, progress: seg(p, 0.095, 0.125), seed: 6 });
    g.line(FX - 92, FY + FR + 136, FX + 96, FY + FR + 130, { color: rgba(P.ice, 0.75), width: 3.5, progress: ease.out(seg(p, 0.118, 0.14)), seed: 7 });
    g.text('23:58', FX + 150, FY + FR + 162, { font: 'latin', size: 40, color: rgba(P.ice, 0.75), progress: seg(p, 0.125, 0.14), seed: 8 });

    // ---- 标题（镜头 2）
    const TX = 1225, TS = 410;
    const k1 = seg(p, 0.195, 0.262), k2 = seg(p, 0.262, 0.292);
    const titleDone = seg(p, 0.29, 0.31);
    if (titleDone > 0) g.glow(TX + 80, 480, 480, P.ice, 0.14 * titleDone);
    const shadow = rgba(P.ice, 0.42);
    const tip1 = brushChar(g, '雪', TX, 306, TS, ease.inOut(k1), { color: SNOW_TXT, shadow, sdx: 9, sdy: 8, seed: 1 });
    const tip2 = brushChar(g, '人', TX + 8, 700, TS, ease.inOut(k2), { color: SNOW_TXT, shadow, sdx: 9, sdy: 8, seed: 2 });
    const tip = tip1 || tip2;
    if (tip) {
      g.glow(tip[0], tip[1], 70, '#ffffff', 0.35);
      sparkle(g, tip[0], tip[1], 12, 0.9, t * 4);
    }
    // 题字（竖排两列）
    g.text('从初雪\n等到春天', 1592, 214, { vertical: true, size: 60, lineHeight: 1.3, color: P.ice, progress: seg(p, 0.288, 0.318), seed: 9 });
    // 印章
    seal(g, 1553, 616, 80, 146, seg(p, 0.318, 0.328), '手书');
    const ring = seg(p, 0.328, 0.345);
    if (ring > 0 && ring < 1) {
      g.circle(1553, 616, lerp(80, 190, ease.out(ring)), { color: rgba(P.red, 0.8), width: 3 * (1 - ring), alpha: 1 - ring, seed: 77 });
    }
    g.restore();

    // ---- 雪越下越大
    const kSnow = seg(p, 0.07, 0.3);
    snowfall(g, t, kSnow, { wind: 22 });
    bokeh(g, t, 6, 21, '#cfdcf5', 0.16 * seg(p, 0.18, 0.32), 40, 90);
    g.vignette(0.5);
  }

  // ------------------------------------------------------------------ 镜头 3：滚雪球（跟拍）
  function ridge(g, off, baseY, amp, scale, seed, fill, line) {
    const pts = [[-60, H + 60]];
    for (let x = -60; x <= W + 60; x += 40) {
      const wx = x + off;
      pts.push([x, baseY + noise1(wx / scale, seed) * amp + noise1(wx / (scale * 0.3), seed + 1) * amp * 0.25]);
    }
    pts.push([W + 60, H + 60]);
    g.path(pts, { closed: true, color: line, width: 3, fill, seed, overshoot: false, jitter: 1.2 });
  }

  function pines(g, off, baseY, seed, color, edge) {
    const span = W + 600;
    for (let i = 0; i < 9; i++) {
      const x = ((((i * 290 + rand(i, seed, 1) * 140 - off) % span) + span) % span) - 300;
      const h = 150 + rand(i, seed, 2) * 110, w = h * 0.42;
      const y = baseY + rand(i, seed, 3) * 16;
      for (let k = 0; k < 3; k++) {
        const ty = y - h * (k * 0.27), tw = w * (1 - k * 0.24), th = h * 0.5;
        g.poly([[x - tw, ty], [x, ty - th], [x + tw, ty]], { color: edge, width: 2.5, fill: color, seed: seed + i * 5 + k, jitter: 1.2 });
        // 树枝上的雪
        g.line(x - tw * 0.75, ty - th * 0.18, x - tw * 0.1, ty - th * 0.82, { color: rgba(P.snow, 0.85), width: 4, seed: seed + i * 5 + k + 50 });
      }
    }
  }

  function shotRoll(g, u, t) {
    const ctx = g.ctx;
    sky(g, P.dusk);
    stars(g, t, 55, 7, 470, 0.8);
    C.moon(g, 1650, 165, 54, { phase: 0.42, seed: 3 });
    const dist = u * 1650;
    ridge(g, dist * 0.08, 575, 60, 420, 21, mix(P.night, P.nightBlue, 0.6), rgba(P.ice, 0.35));
    // 远处的小灯
    for (let i = 0; i < 7; i++) {
      const span = W + 200;
      const lx = ((((i * 330 + rand(i, 24) * 120 - dist * 0.16) % span) + span) % span) - 100;
      const ly = 668 + rand(i, 25) * 30;
      g.glow(lx, ly, 22, P.warm, 0.55);
      ctx.fillStyle = P.glow;
      ctx.fillRect(lx - 3, ly - 2, 6, 5);
    }
    ridge(g, dist * 0.2, 690, 40, 300, 22, P.nightBlue, rgba(P.ice, 0.55));
    pines(g, dist * 0.42, 790, 30, '#1d2547', rgba(P.ice, 0.35));
    // 地面
    const gy = (x) => 838 + noise1((x + dist) / 300, 9) * 9 + (x - 960) * 0.035;
    // 栅栏（和地面同速）
    const span = W + 400;
    const posts = [];
    for (let i = 0; i < 7; i++) posts.push(((((i * 340 - dist) % span) + span) % span) - 200);
    posts.sort((a, b) => a - b);
    for (let i = 0; i < posts.length - 1; i++) {
      if (posts[i + 1] - posts[i] > 400) continue;
      const a = posts[i], b = posts[i + 1];
      g.line(a, gy(a) - 92, b, gy(b) - 92, { color: P.woodDark, width: 5, seed: 40 + i });
      g.line(a, gy(a) - 52, b, gy(b) - 52, { color: P.woodDark, width: 5, seed: 47 + i });
    }
    posts.forEach((x, i) => {
      const y0 = gy(x);
      g.rect(x - 9, y0 - 120, 18, 125, { color: P.ink, width: 3, fill: P.wood, seed: 60 + i, jitter: 1 });
      g.ellipse(x, y0 - 122, 17, 8, { color: P.ink, width: 2.5, fill: P.snow, seed: 70 + i });
    });
    const gpts = [[-60, H + 60]];
    for (let x = -60; x <= W + 60; x += 60) gpts.push([x, gy(x)]);
    gpts.push([W + 60, H + 60]);
    g.path(gpts, { closed: true, smooth: true, color: P.ink, width: 4.5, fill: GROUND, seed: 80, overshoot: false });
    const gg = ctx.createLinearGradient(0, 850, 0, H);
    gg.addColorStop(0, rgba(P.nightBlue, 0));
    gg.addColorStop(1, rgba(P.nightBlue, 0.42));
    ctx.fillStyle = gg;
    ctx.fillRect(0, 850, W, H - 850);
    // 地面上的雪纹
    for (let i = 0; i < 9; i++) {
      const sp = W + 300;
      const x = ((((i * 260 + rand(i, 81) * 100 - dist) % sp) + sp) % sp) - 150;
      const y = gy(x) + 40 + rand(i, 82) * 110;
      g.line(x, y, x + 40 + rand(i, 83) * 50, y + 2, { color: rgba(P.snowShade, 0.9), width: 3, seed: 90 + i });
    }

    // 雪球
    const gu = ease.inOut(u);
    const r = lerp(80, 212, gu);
    const bx = lerp(610, 730, gu);
    const by = gy(bx) - r + 4;
    const ang = dist / ((80 + r) * 0.5);
    // 滚过的痕迹
    const trail = [];
    for (let x = -40; x <= bx; x += 40) trail.push([x, gy(x) + 3]);
    for (let x = bx; x >= -40; x -= 40) trail.push([x, gy(x) + 3 + lerp(4, r * 0.16, clamp((x + 40) / (bx + 40)))]);
    g.fill(trail, rgba(P.snowShade, 0.95), { seed: 91 });
    for (let i = 0; i < 6; i++) {
      const sp = bx + 200;
      const x = ((((i * 150 + rand(i, 92) * 60 - dist) % sp) + sp) % sp) - 100;
      if (x > bx - r * 0.5) continue;
      g.ellipse(x, gy(x) + 6 + rand(i, 93) * 5, 7 + rand(i, 94) * 6, 5, { color: P.ink, width: 2, fill: P.snow, seed: 95 + i });
    }
    // 扬起的雪粉
    ctx.save();
    for (let i = 0; i < 12; i++) {
      const ph = (((t * 2.4 + rand(i, 96)) % 1) + 1) % 1;
      const x = bx - r * 0.25 - ph * (90 + rand(i, 97) * 120);
      const y = gy(bx) - Math.sin(ph * Math.PI) * (30 + rand(i, 98) * 50) - 4;
      ctx.globalAlpha = (1 - ph) * 0.9;
      ctx.fillStyle = P.snow;
      ctx.beginPath();
      ctx.arc(x, y, 3 + rand(i, 99) * 4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // 粘在表面的雪块（先画，球盖住一半 → 轮廓上的小疙瘩）
    for (let k = 0; k < 4; k++) {
      const a = ang + (k * TAU) / 4 + 0.4;
      g.ellipse(bx + Math.cos(a) * r * 0.97, by + Math.sin(a) * r * 0.97, r * 0.13, r * 0.09, { rot: a, color: P.ink, width: 3.5, fill: P.snow, seed: 100 + k });
    }
    const lw = Math.max(4, (4.8 * r) / 120);
    g.ellipse(bx, by, r, r, { color: P.ink, width: lw, fill: P.snow, seed: 104 });
    // 滚动的纹路
    for (let k = 0; k < 3; k++) {
      const a = ang + (k * TAU) / 3;
      g.arc(bx, by, r * 0.64, a, a + 1.0, { color: rgba(P.ice, 0.95), width: Math.max(3, r * 0.025), seed: 105 + k });
      g.arc(bx, by, r * 0.36, a + 1.6, a + 2.3, { color: rgba(P.ice, 0.8), width: Math.max(2.5, r * 0.02), seed: 108 + k });
    }
    shade(g, bx, by, r, r, 111);
    // 一双手在后面推
    const push = Math.sin(t * 9) * 6;
    [[Math.PI + 0.02, 1, [-160, 360], -20, [0.9, 0.44]], [Math.PI + 0.62, 0, [-90, 140], 20, [0.72, 0.69]]].forEach(([a, k, to, bend, d]) => {
      const pp = k ? push : -push;
      const cxp = bx + Math.cos(a) * (r + 4 + pp), cyp = by + Math.sin(a) * (r + 4 + pp);
      const dl = Math.hypot(d[0], d[1]), dx = d[0] / dl, dy = d[1] / dl;
      const ms = 0.74;
      const wx = cxp - dx * 132 * ms, wy = cyp - dy * 132 * ms;
      hand(g, wx, wy, ms, Math.atan2(dx, -dy), { seed: 120 + k * 20, to, bend, flip: !!k });
    });
    // 咕噜
    const pops = [[0.06, 1190, 300, -0.12], [0.38, 1440, 410, 0.1], [0.7, 1230, 500, -0.05]];
    pops.forEach(([b, x, y, rr], i) => {
      const k = seg(u, b, b + 0.08);
      if (k <= 0) return;
      const fade = 1 - seg(u, b + 0.27, b + 0.35);
      if (fade <= 0) return;
      g.text('咕噜', x, y - ease.out(k) * 24, { font: 'round', size: 118, color: SNOW_TXT, stroke: P.nightDeep, strokeWidth: 16, progress: k, rot: rr, alpha: fade, seed: 130 + i });
    });
    snowfall(g, t, 0.85, { wind: -150 });
    g.vignette(0.45);
  }

  // ------------------------------------------------------------------ 你家门前（镜头 4、6 的背景，世界坐标）
  const MAN = { x: 960, y: 880, s: 1.05 };

  function house(g, t) {
    const ctx = g.ctx;
    // 墙
    g.poly([[1360, 470], [1960, 470], [1960, 860], [1360, 860]], { color: P.ink, width: 4.5, fill: mix(P.nightBlue, P.dusk, 0.45), seed: 201 });
    for (let k = 0; k < 7; k++) g.line(1368, 500 + k * 52, 1950, 498 + k * 52, { color: rgba(P.ink, 0.35), width: 2.4, seed: 202 + k });
    // 烟囱 + 炊烟
    g.poly([[1760, 380], [1830, 380], [1830, 300], [1760, 300]], { color: P.ink, width: 4, fill: '#5b4a5e', seed: 210 });
    g.ellipse(1795, 300, 44, 12, { color: P.ink, width: 3, fill: P.snow, seed: 211 });
    for (let k = 0; k < 4; k++) {
      const ph = (((t * 0.35 + k / 4) % 1) + 1) % 1;
      ctx.save();
      ctx.globalAlpha *= (1 - ph) * 0.55 * clamp(ph * 5);
      g.circle(1795 + Math.sin(ph * 5 + k) * 14 - ph * 40, 270 - ph * 190, 14 + ph * 38, { color: rgba('#dfe6f5', 0.7), width: 2.5, fill: rgba('#dfe6f5', 0.35), seed: 212 + k });
      ctx.restore();
    }
    // 屋顶 + 积雪
    g.poly([[1320, 482], [1590, 300], [1990, 300], [1990, 482]], { color: P.ink, width: 4.5, fill: '#3b3552', seed: 220 });
    g.path([[1306, 492], [1330, 466], [1590, 284], [1990, 280], [1990, 312], [1600, 318], [1354, 486]], { closed: true, smooth: true, color: P.ink, width: 4, fill: P.snow, seed: 221 });
    // 窗 + 门
    C.window(g, 1418, 560, 156, 132, { light: 1, tree: true, curtains: true, seed: 230, t });
    C.door(g, 1670, 556, 128, 292, { open: 0, wreath: true, seed: 240 });
  }

  function footprints(g) {
    // 从门口走到雪人身边的一串脚印
    const pts = [[1740, 872], [1600, 888], [1450, 902], [1300, 912], [1170, 918]];
    const path = catmull(pts, false, 6);
    let acc = 0, next = 0, side = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      while (next <= acc + L) {
        const f = (next - acc) / L;
        const x = lerp(a[0], b[0], f), y = lerp(a[1], b[1], f);
        const off = side ? 9 : -9;
        g.ellipse(x, y + off, 15, 6.5, { rot: -0.1, color: rgba(P.ice, 0.9), width: 2, fill: rgba(P.snowShade, 0.85), seed: 250 + side + (next | 0), still: true, jitter: 0.8 });
        side = 1 - side;
        next += 44;
      }
      acc += L;
    }
  }

  function yard(g, t, cam) {
    const ctx = g.ctx;
    sky(g);
    stars(g, t, 70, 9, 620, 0.9);
    g.save();
    g.camera(cam.x, cam.y, cam.z);
    C.moon(g, 640, 300, 46, { phase: 0.42, seed: 4 });
    // 远山
    const pts = [[-300, 1200]];
    for (let x = -300; x <= W + 300; x += 60) pts.push([x, 760 + noise1(x / 380, 31) * 46]);
    pts.push([W + 300, 1200]);
    g.path(pts, { closed: true, color: rgba(P.ice, 0.4), width: 3, fill: mix(P.night, P.nightBlue, 0.7), seed: 260, overshoot: false });
    for (let i = 0; i < 5; i++) {
      const lx = 80 + i * 260 + rand(i, 261) * 80, ly = 790 + rand(i, 262) * 20;
      g.glow(lx, ly, 20, P.warm, 0.45);
      ctx.fillStyle = P.glow;
      ctx.fillRect(lx - 3, ly - 2, 6, 5);
    }
    house(g, t);
    C.lamp(g, 470, 868, 0.82, { light: 1, seed: 270 });
    C.ground(g, 852, { color: GROUND, seed: 4, amp: 12 });
    // 地上的光和阴影
    g.glow(470, 880, 340, P.warm, 0.22);
    g.glow(1660, 880, 300, P.warm, 0.14);
    const gr = ctx.createLinearGradient(0, 860, 0, 1300);
    gr.addColorStop(0, rgba(P.nightBlue, 0));
    gr.addColorStop(1, rgba(P.nightBlue, 0.4));
    ctx.fillStyle = gr;
    ctx.fillRect(-400, 860, W + 800, 600);
    footprints(g);
    g.restore();
  }

  function view(cx, cy, z) {
    return { x: cx, y: cy, z, X: (wx) => (wx - cx) * z + W / 2, Y: (wy) => (wy - cy) * z + H / 2 };
  }

  // ------------------------------------------------------------------ 镜头 4：放上脑袋（咚）
  function shotHead(g, u, t) {
    const V = view(960 + Math.sin(t * 0.6) * 5, 600 - u * 12, 1.4 + 0.08 * ease.inOut(u));
    yard(g, t, V);
    const s = MAN.s * V.z;
    const G = geo(V.X(MAN.x), V.Y(MAN.y), s);
    const land = 0.46;
    const dk = ease.inOutCubic(seg(u, 0.02, land));
    const hy = lerp(30 - G.headCy, 0, dk);
    const sway = Math.sin(u * 14) * 14 * (1 - dk) * s;
    const sqk = seg(u, land, land + 0.12);
    const squash = sqk > 0 && sqk < 1 ? Math.sin(sqk * Math.PI) * (1 - sqk * 0.5) : 0;
    const R = buildMan(g, G, { head: true, hy, hx: sway, squash });
    // 手套抱着头
    const rel = ease.inCubic(seg(u, land + 0.08, 0.86));
    const hx = R.head[0], hyy = R.head[1];
    const ms = 0.55 * V.z;
    [-1, 1].forEach((side) => {
      const a = side < 0 ? Math.PI + 0.22 : -0.22;
      const px = hx + Math.cos(a) * (G.headR + 10 * s) + side * rel * 140, py = hyy + Math.sin(a) * (G.headR + 10 * s) - rel * 700;
      const dx = -side * 0.42, dy = 0.91;
      const rot = Math.atan2(dx, -dy);
      const wx = px - dx * 84 * ms, wy = py - dy * 84 * ms;
      hand(g, wx, wy, ms, rot, { flip: side > 0, seed: 300 + (side > 0 ? 20 : 0), to: [wx + side * 330, wy - 1000], bend: -side * 50 });
    });
    // 咚
    // 雪粉从脖子两边挤出来
    const pk = seg(u, land, land + 0.3);
    puff(g, G.nx - G.headR * 0.85, G.ny + 4 * s, pk, 330, s, 70, 0.25);
    puff(g, G.nx + G.headR * 0.85, G.ny + 4 * s, pk, 335, s, 70, 0.25);
    const dong = seg(u, land, land + 0.06);
    if (dong > 0) {
      const fade = 1 - seg(u, 0.85, 1);
      g.text('咚', G.x - 300 * s, G.headCy - 20 * s, { font: 'round', size: 160, color: SNOW_TXT, stroke: P.nightDeep, strokeWidth: 18, progress: dong, rot: -0.12, alpha: fade, seed: 340 });
      burst(g, G.x - 300 * s, G.headCy - 20 * s, 95, 170, seg(u, land, land + 0.2), 9, 341, SNOW_TXT, 5);
    }
    snowfall(g, t, 0.75, { wind: 20 });
    g.vignette(0.42);
  }

  // ------------------------------------------------------------------ 镜头 5：脸部特写（眼睛啪啪、胡萝卜）
  function shotFace(g, u, t) {
    const ctx = g.ctx;
    sky(g, mix(P.night, P.nightBlue, 0.9));
    // 背景虚化：窗光、路灯
    g.glow(1650, 640, 360, P.warm, 0.22);
    g.glow(230, 380, 260, P.warm, 0.16);
    bokeh(g, t, 9, 401, P.warm, 0.22, 24, 60);
    bokeh(g, t, 7, 402, '#cfdcf5', 0.18, 30, 80);
    stars(g, t, 40, 403, 500, 0.6);
    const eyeL = seg(u, 0.08, 0.2), eyeR = seg(u, 0.3, 0.42);
    // 啪的时候镜头震一下
    const kick = Math.max(1 - seg(u, 0.08, 0.13), 0) * (u > 0.08 ? 1 : 0) + Math.max(1 - seg(u, 0.3, 0.35), 0) * (u > 0.3 ? 1 : 0);
    const sh = kick > 0 ? g.shake(10 * kick) : [0, 0];
    const zoom = 1 + 0.04 * u;
    ctx.save();
    ctx.translate(960 + sh[0], 540 + sh[1]);
    ctx.scale(zoom, zoom);
    ctx.translate(-960, -540);
    const s = 3.0;
    const G = geo(960, 0, s);
    const dy = 520 - G.headCy;
    const G2 = geo(960, dy, s);
    g.glow(960, 520, 520, '#dfe9ff', 0.12);
    const carIn = seg(u, 0.5, 0.7);
    const carOff = (1 - ease.inOutCubic(carIn)) * 260 * s;
    const R = buildMan(g, G2, {
      head: true,
      eyes: [eyeL, eyeR],
      carrot: u > 0.47 ? 1 : 0,
      carrotOff: carOff,
      mouth: ease.out(seg(u, 0.8, 0.92)),
      blush: 0.55 * seg(u, 0.84, 1),
    });
    // 胡萝卜由手套送进来
    if (u > 0.47 && R.tip) {
      const out = ease.inCubic(seg(u, 0.74, 0.95));
      const ms = 1.2;
      const rot = -Math.PI / 2 + 0.18;
      const wx = R.tip[0] + 150 * ms + out * 700, wy = R.tip[1] + 12 + out * 160;
      const inK = ease.outCubic(seg(u, 0.44, 0.52));
      hand(g, wx + (1 - inK) * 600, wy, ms, rot, { flip: true, seed: 420, to: [wx + 1700, wy + 260] });
    }
    // 插进去的一下
    if (R.carrotBase) burst(g, R.carrotBase[0] + 6, R.carrotBase[1], 30, 90, seg(u, 0.7, 0.8), 7, 430, P.ink, 4);
    // 啪、啪
    [[eyeL, 0, -1, 0.2], [eyeR, 1, 1, 0.42]].forEach(([k, i, side, end]) => {
      if (k <= 0) return;
      const e = R.eyes[i];
      burst(g, e[0], e[1], 40, 95, seg(k, 0, 0.9), 8, 440 + i, P.ink, 5);
      const fade = 1 - seg(u, end + 0.3, end + 0.4);
      g.text('啪', 960 + side * 430, 300 + i * 30, { font: 'round', size: 170, color: SNOW_TXT, stroke: P.nightDeep, strokeWidth: 20, progress: clamp(k * 3), rot: side * 0.14, alpha: fade, seed: 450 + i });
    });
    focusLines(g, 960, 480, seg(u, 0.08, 0.2), 460, '#e8eeff', 470);
    focusLines(g, 960, 480, seg(u, 0.3, 0.42), 470, '#e8eeff', 470);
    ctx.restore();
    snowfall(g, t, 0.7, { wind: 14 });
    g.vignette(0.48);
  }

  // ------------------------------------------------------------------ 镜头 6：手臂、帽子、红围巾、摸摸脸、眨眼
  const CAM6 = [
    [0.71, 960, 640, 1.16],
    [0.78, 960, 632, 1.24],
    [0.8, 985, 640, 1.58],
    [0.9, 990, 628, 1.66],
    [0.95, 985, 566, 2.3],
    [1.0, 982, 560, 2.42],
  ];
  function cam6(p) {
    let i = 0;
    while (i < CAM6.length - 2 && p > CAM6[i + 1][0]) i++;
    const a = CAM6[i], b = CAM6[i + 1];
    const k = ease.inOutCubic(seg(p, a[0], b[0]));
    return view(lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k));
  }

  // 围巾绕脖子的那一段（左 → 右）
  const BAND = [[-94, -2], [-80, 12], [-36, 23], [20, 24], [62, 14], [92, -4]];

  function shotDress(g, p, t, info) {
    const V = cam6(p);
    yard(g, t, V);
    defocus(g, 0.55 * seg(p, 0.9, 0.955), 0.1 * seg(p, 0.785, 0.81) + 0.14 * seg(p, 0.9, 0.955));
    const s = MAN.s * V.z;
    const G = geo(V.X(MAN.x), V.Y(MAN.y), s);
    const ms = 0.55 * V.z;

    const armL = seg(p, 0.712, 0.735), armR = seg(p, 0.727, 0.75);
    const buttons = seg(p, 0.738, 0.752);
    const hatK = seg(p, 0.755, 0.776);
    const hatOn = p >= 0.79;
    const scarfOn = p >= 0.866;
    const pat = seg(p, 0.868, 0.906);
    const leave = seg(p, 0.906, 0.935);
    const lookK = ease.inOut(seg(p, 0.91, 0.945));
    // 眨眼：按秒算，保证任何时长都看得见
    const tb = 0.958 * info.dur;
    const blink = (t >= tb && t < tb + 0.17) || (t >= tb + 0.42 && t < tb + 0.58);
    const happy = p >= 0.872;
    const eyesClosed = (pat > 0.08 && pat < 0.95) || blink;
    const blush = p < 0.868 ? 0.55 : lerp(0.55, 1, ease.out(seg(p, 0.868, 0.89)));

    // 手套绕到雪人后面（被挡住）
    const wrapA = seg(p, 0.786, 0.806), wrapB = seg(p, 0.806, 0.82), wrapC = seg(p, 0.82, 0.848), wrapD = seg(p, 0.848, 0.866);
    const N = (dx, dy) => [G.nx + dx * s, G.ny + dy * s];
    if (wrapB > 0 && wrapB < 1) {
      // 从右边绕到脖子后面，再从左边出来
      const a = lerp(-0.1, Math.PI + 0.1, ease.inOut(wrapB));
      const px = G.nx + Math.cos(a) * 150 * s, py = G.ny - 30 * s - Math.sin(a) * 60 * s;
      hand(g, px, py, ms, -Math.PI / 2 + 0.2, { flip: true, seed: 500, to: [px + 1400, py - 400] });
    }

    if (p < 0.755) {
      buildMan(g, G, { head: true, eyes: [1, 1], carrot: 1, mouth: 1, blush: 0.55, arms: [armL, armR], buttons });
    } else {
      C.snowman(g, G.x, G.y, s, {
        mood: happy ? 'happy' : 'calm', hat: hatOn, scarf: scarfOn, wind: 0.22, blush, eyesClosed,
        look: lookK * 0.55, t, seed: 0,
      });
    }
    // 帽子落下
    if (p >= 0.755 && !hatOn) {
      const fall = ease.in(hatK);
      const hy = lerp(-G.headCy - 160 * s, 0, fall);
      const wob = hatK >= 1 ? Math.sin((p - 0.776) * 900) * 0.16 * (1 - seg(p, 0.776, 0.79)) : lerp(-0.6, 0, fall);
      C.hat(g, G.headCx - 6 * s, G.headCy - G.headR * 0.86 + hy, s, -0.12 + wob, { seed: 60 });
    }
    const hl = seg(p, 0.776, 0.8);
    if (hl > 0 && hl < 1) {
      const hx = G.headCx, hy = G.headCy - G.headR * 1.4;
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + (k - 1) * 0.9;
        const d = lerp(60, 130, ease.out(hl)) * s;
        sparkle(g, hx + Math.cos(a) * d * 1.3, hy + Math.sin(a) * d * 0.7, 12 * s, 1 - hl, k);
      }
    }

    // 围巾：手套拿着围巾进来 → 绕一圈 → 拉紧
    if (p >= 0.786 && !scarfOn) {
      const bandPts = BAND.map((b) => N(b[0], b[1]));
      const curve = catmull(bandPts, false, 8);
      // 前面这一段（按进度画出）
      const q = ease.inOut(wrapC);
      if (q > 0) {
        g.curve(bandPts, { color: P.ink, width: 34 * s, progress: q, seed: 510, taper: false, jitter: 1 });
        g.curve(bandPts, { color: P.red, width: 26 * s, progress: q, seed: 511, taper: false, jitter: 1 });
      }
      // 手套抓着的点
      let grip;
      if (wrapA < 1) {
        const k = ease.outCubic(wrapA);
        grip = N(lerp(420, 130, k), lerp(-40, 0, k));
      } else if (wrapB < 1) {
        grip = null;
      } else if (wrapC < 1 || wrapD <= 0) {
        // 沿着曲线走
        let L = 0;
        const acc = [0];
        for (let i = 1; i < curve.length; i++) { L += Math.hypot(curve[i][0] - curve[i - 1][0], curve[i][1] - curve[i - 1][1]); acc.push(L); }
        const target = q * L;
        let i = 1;
        while (i < curve.length - 1 && acc[i] < target) i++;
        const f = (target - acc[i - 1]) / ((acc[i] - acc[i - 1]) || 1);
        grip = [lerp(curve[i - 1][0], curve[i][0], f), lerp(curve[i - 1][1], curve[i][1], f)];
      } else {
        // 拉紧：手往右下拽
        const k = Math.sin(wrapD * Math.PI);
        grip = N(52 + k * 26, 40 + k * 22 + wrapD * 50);
      }
      if (grip) {
        // 垂下来的围巾尾巴
        const sw = Math.sin(t * 6) * 8 * s;
        const tailL = wrapD > 0 ? lerp(120, 150, wrapD) : 120;
        const tail = [grip, [grip[0] + 10 * s + sw * 0.3, grip[1] + tailL * 0.45 * s], [grip[0] + 4 * s + sw, grip[1] + tailL * s]];
        g.curve(tail, { color: P.ink, width: 32 * s, seed: 520, taper: false, jitter: 1 });
        g.curve(tail, { color: P.red, width: 24 * s, seed: 521, taper: false, jitter: 1 });
        for (let k = 0; k < 4; k++) {
          const fx = tail[2][0] + (k - 1.5) * 7 * s, fy = tail[2][1] + 10 * s;
          g.line(fx, fy, fx + 2 * s, fy + 16 * s, { color: P.redDeep, width: 3 * s, seed: 530 + k });
        }
        if (wrapD > 0) g.curve([N(40, 18), grip], { color: P.red, width: 24 * s, seed: 522, taper: false, jitter: 1 });
        const rot = wrapC > 0 && wrapD <= 0 ? -Math.PI / 2 - 0.1 : -Math.PI / 2 + 0.35;
        const fdx = Math.sin(rot), fdy = -Math.cos(rot);
        const wx = grip[0] - fdx * 60 * ms, wy = grip[1] - fdy * 60 * ms;
        hand(g, wx, wy, ms, rot, { flip: true, seed: 540, to: [wx + 1300, wy + 200], bend: -45 });
        if (wrapC > 0 && wrapC < 1) {
          // 甩动的速度线
          for (let k = 0; k < 3; k++) g.line(grip[0] - (40 + k * 30) * s, grip[1] - (30 - k * 20) * s, grip[0] - (90 + k * 34) * s, grip[1] - (34 - k * 20) * s, { color: rgba(SNOW_TXT, 0.8), width: 3, seed: 550 + k });
        }
      }
    }

    // 摸摸脸
    if (pat > 0 && leave < 1) {
      const into = ease.outCubic(seg(pat, 0, 0.25));
      const rub = Math.sin(seg(pat, 0.2, 1) * Math.PI * 2) * 14 * s;
      const out = ease.inCubic(leave);
      const a = 0.12;
      const px = G.headCx + Math.cos(a) * (G.headR + 16 * s) + (1 - into) * 400 * s + out * 900 * s;
      const py = G.headCy + Math.sin(a) * G.headR + rub - out * 80 * s;
      const rot = -Math.PI / 2 + 0.55;
      const fdx = Math.sin(rot), fdy = -Math.cos(rot);
      hand(g, px - fdx * 70 * ms, py - fdy * 70 * ms, ms, rot, { flip: true, seed: 560, to: [px + 1300, py + 420], bend: -40 });
    }
    // 小红心
    const hk = seg(p, 0.93, 0.955);
    if (hk > 0) {
      const bob = Math.sin(t * 3) * 6 * s;
      C.heart(g, G.headCx + 112 * s, G.headCy - 92 * s + bob - ease.out(hk) * 10 * s, 20 * s * ease.outBack(hk), { width: 3 * s, seed: 570, rot: 0.15 });
      if (hk < 1) burst(g, G.headCx + 112 * s, G.headCy - 92 * s, 22 * s, 50 * s, hk, 6, 571, P.red, 3);
    }
    // 第 1 天
    const dk = seg(p, 0.945, 0.98);
    if (dk > 0) {
      const st = { stroke: rgba(P.nightDeep, 0.7), strokeWidth: 12 };
      g.text('第', 222, 238, Object.assign({ size: 104, color: SNOW_TXT, progress: seg(dk, 0, 0.3), seed: 580, rot: -0.06 }, st));
      g.text('1', 322, 226, Object.assign({ font: 'round', size: 150, color: P.glow, progress: seg(dk, 0.3, 0.6), seed: 581, rot: 0.05 }, st));
      g.text('天', 414, 242, Object.assign({ size: 104, color: SNOW_TXT, progress: seg(dk, 0.6, 0.9), seed: 582, rot: 0.04 }, st));
      g.line(160, 318, 480, 308, { color: rgba(P.ice, 0.85), width: 4.5, progress: ease.out(seg(p, 0.972, 0.995)), seed: 583 });
    }
    snowfall(g, t, 0.75, { wind: 16 });
    bokeh(g, t, 5, 590, '#cfdcf5', 0.14 * seg(p, 0.9, 1), 40, 90);
    g.vignette(0.42 + 0.1 * seg(p, 0.9, 1));
  }

  // ------------------------------------------------------------------
  TG.scene({
    id: 'intro',
    title: '前奏 · 初雪',
    dark: true,
    transition: 'cut',
    chars: '雪人从初等到春天手书咕噜咚啪第',
    lyrics: 'default',
    draw(g, p, t, info) {
      if (p < 0.35) shotOpening(g, p, t, info);
      else if (p < 0.5) shotRoll(g, seg(p, 0.35, 0.5), t);
      else if (p < 0.6) shotHead(g, seg(p, 0.5, 0.6), t);
      else if (p < 0.71) shotFace(g, seg(p, 0.6, 0.71), t);
      else shotDress(g, p, t, info);
    },
  });
})();
