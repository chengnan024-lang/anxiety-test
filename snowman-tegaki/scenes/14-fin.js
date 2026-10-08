/* 场景：fin —— 尾声
 *
 * 镜头（按 p 分段）：
 *   S1 0.00–0.18  俯视水坑：水里倒映着春天的天空和云，一滴水"嗒"地荡开涟漪，
 *                 雪人淡淡的白色轮廓一笔一笔浮出来（他在笑）。左上角手写「3.21 晴 · 第 111 天」
 *   S2 0.18–0.42  俯视近景：一个影子遮过来，水里映出"你"低头的剪影 → 倒影里的雪人抬头、挥手 →
 *                 红手套从画外伸进来，犹豫一下，捏住围巾一角，把湿漉漉的围巾提起来带出画面（嗒、嗒）
 *   S3 0.42–0.52  胸口特写：两只红手套把湿围巾抱在怀里，水珠往下滴，一颗小小的心浮起来。「带你回家。」
 *   S4 0.52–0.71  黄昏远景：围上红围巾的"你"站在水坑边，那扇门终于开着 →
 *                 镜头升上天空，星星一颗颗亮起，最后一片雪花从很高的地方飘下来
 *   S5 0.71–0.78  雪花大特写：慢慢旋转、闪光。「是你吗？」
 *   S6 0.78–1.00  片尾：雪花停在上方，毛笔按笔顺写出「雪人」，小字「明年冬天，再见。」+ Fin + 红色雪人印章，
 *                 雪又开始下了 → 渐黑
 */
(function () {
  'use strict';
  const { clamp, lerp, seg, ease, rand, rgba, catmull, mix } = TG.U;
  const P = TG.PAL, C = TG.C, W = TG.W, H = TG.H;
  const TAU = Math.PI * 2;

  // 片尾卡要多停一会儿（之前盖完章 0.6 秒就开始渐黑），时间从 S1 / S2 / S3 各挪一点过去
  const CUT = [0, 0.165, 0.395, 0.49, 0.675, 0.745, 1];
  const TILT = [0.4, 0.8];                   // S4 里镜头往上摇的区间（shot 内进度）
  const COAT = '#4a3436', COAT_LIT = '#654850';
  const SNOW_TXT = '#fbfcff';
  const GHOST_INK = '#4f6f9c';
  const MOON = '#e8eeff';

  // ------------------------------------------------------------------ 小工具
  /** 不规则的圆形（首尾无缝） */
  function blob(cx, cy, rx, ry, seed, n, amp) {
    n = n || 32;
    amp = amp == null ? 0.1 : amp;
    const r1 = rand(seed, 1) * TAU, r2 = rand(seed, 2) * TAU, r3 = rand(seed, 3) * TAU;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const k = 1 + amp * (0.55 * Math.sin(a * 2 + r1) + 0.3 * Math.sin(a * 3 + r2) + 0.15 * Math.sin(a * 5 + r3));
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return pts;
  }
  function trace(ctx, pts) {
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.closePath();
  }
  function cumLen(pts) {
    const c = [0];
    for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return c;
  }
  function pointAt(pts, cum, s) {
    const L = cum[cum.length - 1];
    s = clamp(s, 0, L);
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const k = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)];
  }
  function norm(v) {
    const d = Math.hypot(v[0], v[1]) || 1;
    return [v[0] / d, v[1] / d];
  }

  /** 四角星闪光 */
  function sparkle(g, x, y, r, a, rot, color) {
    if (a <= 0) return;
    const ctx = g.ctx;
    g.glow(x, y, r * 3, '#dfe9ff', 0.5 * a);
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = color || '#ffffff';
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const rr = k % 2 ? r * 0.24 : r;
      const an = (k * Math.PI) / 4;
      ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** 星星（area = [x, y, w, h]，fadeY 以下越来越淡） */
  function stars(g, t, n, seed, area, a, fadeY) {
    if (a <= 0) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.fillStyle = MOON;
    ctx.strokeStyle = MOON;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = area[0] + rand(i, seed, 1) * area[2], y = area[1] + rand(i, seed, 2) * area[3];
      const fy = fadeY == null ? 1 : clamp((fadeY - y) / 700);
      if (fy <= 0) continue;
      const tw = 0.5 + 0.5 * Math.sin(t * (1.3 + rand(i, seed, 3) * 2.2) + i * 1.7);
      const r = 0.8 + rand(i, seed, 4) * rand(i, seed, 5) * 2.8;
      ctx.globalAlpha = a * fy * (0.25 + 0.65 * tw);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      if (r > 2.3) {
        const L = r * (2 + 2.5 * tw);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x - L, y); ctx.lineTo(x + L, y);
        ctx.moveTo(x, y - L); ctx.lineTo(x, y + L);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** 虚化光斑 */
  function bokeh(g, t, n, seed, colors, a, r0, r1, rise) {
    if (a <= 0) return;
    for (let i = 0; i < n; i++) {
      const r = lerp(r0, r1, rand(i, seed, 1));
      const sp = (10 + rand(i, seed, 2) * 22) * (rise == null ? 1 : rise);
      const span = H + r * 2;
      const y = H + r - ((((rand(i, seed, 3) * span + t * sp) % span) + span) % span);
      const x = rand(i, seed, 4) * W + Math.sin(t * 0.35 + i * 2.1) * 40;
      g.glow(x, y, r, colors[i % colors.length], a * (0.55 + 0.45 * Math.sin(t * 1.1 + i * 2.3)));
    }
  }

  /** 水面涟漪：一圈 / 两圈往外荡 */
  function ripple(g, x, y, age, o) {
    o = o || {};
    const life = o.life || 2, R = o.R || 110, a0 = o.a == null ? 0.85 : o.a;
    if (age <= 0 || age >= life) return;
    const k = age / life;
    const rings = o.rings || 2;
    for (let j = 0; j < rings; j++) {
      const kk = k - j * 0.16;
      if (kk <= 0) continue;
      const r = 5 + R * ease.out(kk);
      g.ellipse(x, y, r, r * (o.flat || 0.9), {
        color: o.color || '#ffffff', width: (o.w || 3.2) * (1 - kk * 0.6), alpha: a0 * (1 - kk) * (j ? 0.6 : 1), jitter: 1, seed: (o.seed | 0) + j,
      });
    }
  }

  /** 草丛（原生画法，快）：一撮撮 v 字小草 */
  function tufts(g, n, seed, area, avoid, col, alpha, sc) {
    const ctx = g.ctx, b = g.info.boil;
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.6 * sc;
    ctx.lineCap = 'round';
    ctx.globalAlpha *= alpha;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = area[0] + rand(i, seed, 1) * area[2], y = area[1] + rand(i, seed, 2) * area[3];
      if (avoid && avoid(x, y)) continue;
      const w = (rand(i, seed + b, 3) - 0.5) * 2.2 * sc;
      const h = (10 + rand(i, seed, 4) * 9) * sc;
      ctx.moveTo(x, y); ctx.lineTo(x - 7 * sc + w, y - h * 0.75);
      ctx.moveTo(x + 1, y); ctx.lineTo(x + 1 + w, y - h);
      ctx.moveTo(x + 2, y); ctx.lineTo(x + 9 * sc + w, y - h * 0.65);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** 小花（五瓣） */
  function flower(g, x, y, r, petal, seed, rot) {
    const ctx = g.ctx, b = g.info.boil;
    ctx.save();
    ctx.translate(x + (rand(seed, b, 1) - 0.5) * 1.4, y + (rand(seed, b, 2) - 0.5) * 1.4);
    ctx.rotate(rot || 0);
    ctx.fillStyle = petal;
    ctx.strokeStyle = rgba(P.ink, 0.7);
    ctx.lineWidth = Math.max(1.2, r * 0.12);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, r * 0.5, r * 0.36, a, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = P.sun;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** 飘落的小花瓣 */
  function petals(g, t, n, seed, area, wind, a, sc) {
    const ctx = g.ctx;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const sp = 30 + rand(i, seed, 1) * 40;
      const wx = area[0] + ((((rand(i, seed, 2) * area[2] + t * wind * (0.6 + rand(i, seed, 3))) % area[2]) + area[2]) % area[2]);
      const wy = area[1] + ((((rand(i, seed, 4) * area[3] + t * sp) % area[3]) + area[3]) % area[3]);
      const x = wx + Math.sin(t * 1.3 + i) * 20;
      const rot = t * (1 + rand(i, seed, 5)) + i;
      ctx.globalAlpha = a * (0.6 + 0.4 * rand(i, seed, 6));
      ctx.fillStyle = i % 3 ? '#fbe6e9' : '#ffffff';
      ctx.strokeStyle = rgba(P.ink, 0.35);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(x, wy, 9 * sc, 5 * sc * (0.5 + 0.5 * Math.abs(Math.sin(rot))), rot, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * 手绘的蓬松云：三四个大鼓包 + 微微鼓起的底边，竖向渐变上色。
   * w 宽度；col 主色；lit 受光色；o.under = true 时是夕阳从下面照亮，否则月光从上面照亮
   */
  const CLOUD_BUMPS = [[-0.36, 0.15, 0.03], [-0.16, 0.235, 0.12], [0.09, 0.27, 0.15], [0.32, 0.17, 0.04]];
  function puffCloud(g, x, y, w, col, a, seed, o) {
    o = o || {};
    const ctx = g.ctx;
    const circ = CLOUD_BUMPS.map(([fx, rr, lift], k) => {
      const r = rr * w * (0.88 + 0.24 * rand(seed, k, 3));
      return [x + fx * w + (rand(seed, k, 4) - 0.5) * w * 0.05, y - lift * w, r];
    });
    let x0 = Infinity, x1 = -Infinity;
    for (const c of circ) { x0 = Math.min(x0, c[0] - c[2] * 0.97); x1 = Math.max(x1, c[0] + c[2] * 0.97); }
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const xx = lerp(x0, x1, i / 40);
      let top = y;
      for (const c of circ) {
        const dx = xx - c[0];
        if (Math.abs(dx) < c[2]) top = Math.min(top, c[1] - Math.sqrt(c[2] * c[2] - dx * dx));
      }
      pts.push([xx, Math.min(top, y - 2)]);
    }
    for (let i = 1; i < 12; i++) {
      const f = i / 12;
      pts.push([lerp(x1, x0, f), y + Math.sin(f * Math.PI) * w * 0.035]);
    }
    const topY = y - w * 0.42, botY = y + w * 0.04;
    const gr = ctx.createLinearGradient(0, topY, 0, botY);
    gr.addColorStop(0, o.under ? col : (o.lit || col));
    gr.addColorStop(o.under ? 0.55 : 0.5, col);
    gr.addColorStop(1, o.under ? (o.lit || col) : mix(col, '#1c2340', 0.25));
    ctx.save();
    ctx.globalAlpha *= a;
    g.path(pts, { closed: true, fill: gr, color: o.line || rgba('#ffffff', 0.55), width: o.lw || 3, seed, overshoot: false });
    // 鼓包之间的小卷（体积感）
    for (let k = 1; k < circ.length; k++) {
      const c = circ[k], cp = circ[k - 1];
      const mx = (c[0] - c[2] * 0.55 + cp[0] + cp[2] * 0.3) / 2, my = y - w * 0.03;
      g.arc(mx, my - w * 0.05, w * 0.06, 0.2, Math.PI * 0.95, { color: rgba(o.curl || '#ffffff', 0.4), width: 2.6, seed: seed + 10 + k });
    }
    ctx.restore();
    // 受光的那条边
    if (o.lit) {
      if (o.under) g.curve([[x0 + 26, y + 3], [lerp(x0, x1, 0.5), y + w * 0.03], [x1 - 26, y + 2]], { color: rgba(o.lit, 0.9 * a), width: 5, seed: seed + 1 });
      else g.curve(pts.slice(6, 34).filter((q, i) => i % 3 === 0).map((q) => [q[0], q[1] + 7]), { color: rgba(o.lit, 0.7 * a), width: 4, seed: seed + 1 });
    }
  }

  /** 没化完的残雪 */
  function snowPatch(g, x, y, rx, ry, seed) {
    const outer = blob(x, y, rx, ry, seed, 16, 0.3);
    g.fill(blob(x + 4, y + 6, rx * 1.12, ry * 1.18, seed, 16, 0.3), 'rgba(150,180,200,0.35)', { seed: seed + 4 });
    g.path(outer, { closed: true, smooth: true, fill: '#fbfdff', color: '#a9bcd6', width: 3, seed });
    const arcPts = [];
    for (let i = 0; i <= 10; i++) {
      const a = 0.2 + (i / 10) * 2.4;
      arcPts.push([x + Math.cos(a) * rx * 0.86, y + Math.sin(a) * ry * 0.8]);
    }
    g.path(arcPts, { color: rgba(P.snowShade, 0.9), width: 7, seed: seed + 2 });
  }

  /** 掉在地上的树枝手臂 */
  function twig(g, x, y, len, ang, seed) {
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
    g.line(x, y, ex, ey, { color: P.woodDark, width: 6, seed });
    const mx = lerp(x, ex, 0.6), my = lerp(y, ey, 0.6);
    g.line(mx, my, mx + Math.cos(ang - 0.6) * 38, my + Math.sin(ang - 0.6) * 38, { color: P.woodDark, width: 4, seed: seed + 1 });
    g.line(ex, ey, ex + Math.cos(ang + 0.5) * 26, ey + Math.sin(ang + 0.5) * 26, { color: P.woodDark, width: 3.5, seed: seed + 2 });
    g.line(ex, ey, ex + Math.cos(ang - 0.45) * 22, ey + Math.sin(ang - 0.45) * 22, { color: P.woodDark, width: 3, seed: seed + 3 });
  }

  /**
   * 围巾带子：沿中心线 pts 画一条有宽度的红围巾（针织纹 + 两头的流苏）。
   * o = {w: 每个点的宽度倍数数组, s, seed, fill, stroke, alpha, fringe: [头, 尾], knit}
   */
  function ribbon(g, pts, w, o) {
    o = o || {};
    const n = pts.length;
    if (n < 2) return;
    const s = o.s || 1, seed = o.seed | 0;
    const Lp = [], Rp = [], T = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const d = norm([b[0] - a[0], b[1] - a[1]]);
      const hw = (w / 2) * (o.w ? o.w[i] : 1);
      T.push(d);
      Lp.push([pts[i][0] - d[1] * hw, pts[i][1] + d[0] * hw]);
      Rp.push([pts[i][0] + d[1] * hw, pts[i][1] - d[0] * hw]);
    }
    const outline = Lp.concat(Rp.slice().reverse());
    if (o.stroke === false) {
      g.fill(outline, o.fill, { seed, jitter: 1 });
      return;
    }
    g.path(outline, { closed: true, fill: o.fill || P.red, color: P.ink, width: 4 * s, seed, overshoot: false, alpha: o.alpha });
    // 针织纹
    const gap = o.knit || 26 * s;
    let acc = 0;
    for (let i = 1; i < n - 1; i++) {
      acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (acc < gap) continue;
      acc = 0;
      const a = Lp[i], b = Rp[i];
      g.line(lerp(a[0], b[0], 0.2), lerp(a[1], b[1], 0.2), lerp(a[0], b[0], 0.8) + T[i][0] * 6 * s, lerp(a[1], b[1], 0.8) + T[i][1] * 6 * s, {
        color: P.redDeep, width: 2.6 * s, seed: seed + 10 + i, alpha: o.alpha,
      });
    }
    // 流苏
    const fr = o.fringe || [true, true];
    [[0, -1], [n - 1, 1]].forEach(([i, dir], k) => {
      if (!fr[k]) return;
      const d = T[i];
      for (let j = 0; j < 4; j++) {
        const f = (j + 0.5) / 4;
        const bx = lerp(Lp[i][0], Rp[i][0], f), by = lerp(Lp[i][1], Rp[i][1], f);
        const L = (16 + 6 * rand(j, seed, k)) * s;
        g.line(bx, by, bx + d[0] * dir * L + (f - 0.5) * 6 * s, by + d[1] * dir * L, { color: P.redDeep, width: 3 * s, seed: seed + 40 + k * 4 + j, alpha: o.alpha });
      }
    });
  }

  /** 平滑一条折线（只平滑 x/y） */
  function smoothPts(pts, iter) {
    let a = pts;
    for (let k = 0; k < iter; k++) {
      const b = a.map((q) => q.slice());
      for (let i = 1; i < a.length - 1; i++) {
        b[i][0] = a[i - 1][0] * 0.25 + a[i][0] * 0.5 + a[i + 1][0] * 0.25;
        b[i][1] = a[i - 1][1] * 0.25 + a[i][1] * 0.5 + a[i + 1][1] * 0.25;
      }
      a = b;
    }
    return a;
  }

  /** 伸进来的手臂：袖子 + 红手套。tip 是指尖，dir 是指尖方向（单位向量） */
  function reachArm(g, tip, dir, s, o) {
    o = o || {};
    const ctx = g.ctx;
    const Lm = 150 * s;
    const wrist = [tip[0] - dir[0] * Lm, tip[1] - dir[1] * Lm];
    const rot = Math.atan2(dir[0], -dir[1]) + (o.curl || 0);
    const nx = -dir[1], ny = dir[0];
    const a = [wrist[0] - dir[0] * 26 * s, wrist[1] - dir[1] * 26 * s];
    const b = [wrist[0] - dir[0] * 1400 * s, wrist[1] - dir[1] * 1400 * s];
    const hw0 = 56 * s, hw1 = 82 * s;
    const quad = [[a[0] + nx * hw0, a[1] + ny * hw0], [b[0] + nx * hw1, b[1] + ny * hw1], [b[0] - nx * hw1, b[1] - ny * hw1], [a[0] - nx * hw0, a[1] - ny * hw0]];
    // 投在地上的影子
    if (o.shadow) {
      const sh = o.shadow;
      g.fill(quad.map((q) => [q[0] + sh[0], q[1] + sh[1]]), 'rgba(28,40,36,0.16)', { seed: 301 });
      ctx.save();
      ctx.globalAlpha *= 0.16;
      ctx.fillStyle = '#1c2824';
      ctx.beginPath();
      ctx.ellipse(tip[0] - dir[0] * 70 * s + sh[0], tip[1] - dir[1] * 70 * s + sh[1], 70 * s, 58 * s, Math.atan2(dir[1], dir[0]), 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    g.path(quad, { closed: true, fill: COAT_LIT, color: P.ink, width: 4.5 * s, seed: 302 });
    // 袖子褶皱
    for (let k = 0; k < 3; k++) {
      const d = (120 + k * 150) * s;
      const cx = wrist[0] - dir[0] * d, cy = wrist[1] - dir[1] * d;
      g.line(cx + nx * 30 * s, cy + ny * 30 * s, cx - nx * 8 * s - dir[0] * 30 * s, cy - ny * 8 * s - dir[1] * 30 * s, { color: rgba(P.ink, 0.45), width: 3 * s, seed: 303 + k });
    }
    C.mitten(g, wrist[0], wrist[1], s, rot, { seed: 310, flip: o.flip });
    return wrist;
  }

  // ------------------------------------------------------------------ 水里的雪人轮廓
  /** 只有淡淡白线的雪人（倒影 / 回忆）。k：一笔一笔画出来的进度 */
  function ghostMan(g, x, y, s, o) {
    const a = o.alpha == null ? 1 : o.alpha;
    const k = o.k == null ? 1 : o.k;
    if (a <= 0 || k <= 0) return;
    const ctx = g.ctx;
    const look = o.look || 0, up = o.lookUp || 0;
    const bodyRx = 132 * s, bodyRy = 118 * s, bodyCy = y - bodyRy;
    const headR = 80 * s, headCy = bodyCy - bodyRy * 0.82 - headR * 0.92;
    const lw = 5.5 * s;
    const col = o.color || '#ffffff';
    const still = k < 1;
    const L = (sd, pr, extra) => Object.assign({ color: col, width: lw, seed: 900 + sd, progress: pr, still }, extra);
    const kb = seg(k, 0, 0.3), kh = seg(k, 0.18, 0.45), khat = seg(k, 0.4, 0.6), karm = seg(k, 0.5, 0.72), kf = seg(k, 0.68, 1);
    ctx.save();
    ctx.globalAlpha *= a;
    g.glow(x, headCy + 50 * s, 300 * s, '#ffffff', 0.3 * k);
    // 身体
    if (kb > 0) g.ellipse(x, bodyCy, bodyRx, bodyRy, L(1, kb, { fill: kb >= 1 ? 'rgba(255,255,255,0.2)' : null }));
    // 扣子
    if (kf > 0) {
      for (let j = 0; j < 2; j++) {
        ctx.save();
        ctx.globalAlpha *= clamp(kf * 3 - j);
        C.dot(g, x + look * 8 * s, bodyCy - bodyRy * 0.35 + j * bodyRy * 0.42, 7 * s, GHOST_INK, 930 + j);
        ctx.restore();
      }
    }
    // 手臂
    if (karm > 0) {
      const arms = o.arms || [0, 0];
      [-1, 1].forEach((side, j) => {
        const raise = arms[j] || 0;
        const bx = x + side * bodyRx * 0.86, by = bodyCy - bodyRy * 0.35;
        const A = side === -1 ? Math.PI + 0.45 + raise : -0.45 - raise;
        const Ln = 120 * s;
        const ex = bx + Math.cos(A) * Ln, ey = by + Math.sin(A) * Ln;
        g.line(bx, by, ex, ey, L(10 + j, karm, { width: 4.5 * s }));
        const mx = bx + Math.cos(A) * Ln * 0.62, my = by + Math.sin(A) * Ln * 0.62;
        g.line(mx, my, mx + Math.cos(A - side * 0.6) * 36 * s, my + Math.sin(A - side * 0.6) * 36 * s, L(12 + j, seg(karm, 0.5, 1), { width: 3.5 * s }));
        g.line(ex, ey, ex + Math.cos(A + side * 0.5) * 24 * s, ey + Math.sin(A + side * 0.5) * 24 * s, L(14 + j, seg(karm, 0.7, 1), { width: 3 * s }));
      });
    }
    // 头
    if (kh > 0) g.circle(x, headCy, headR, L(2, kh, { fill: kh >= 1 ? 'rgba(255,255,255,0.22)' : null }));
    // 帽子
    if (khat > 0) {
      ctx.save();
      ctx.translate(x - 6 * s, headCy - headR * 0.86);
      ctx.rotate(-0.12);
      g.ellipse(0, 0, 70 * s, 14 * s, L(3, khat, { width: 4.5 * s }));
      g.path([[-46 * s, -4 * s], [-40 * s, -78 * s], [42 * s, -80 * s], [46 * s, -4 * s]], L(4, seg(khat, 0.25, 1), { width: 4.5 * s }));
      g.line(-44 * s, -26 * s, 45 * s, -26 * s, L(5, seg(khat, 0.6, 1), { width: 3 * s, alpha: 0.7 }));
      ctx.restore();
    }
    // 脸
    if (kf > 0) {
      const fx = x + look * headR * 0.28, fy = -up * headR * 0.25;
      const ex = headR * 0.32, ey = headCy - headR * 0.12 + fy;
      const blink = o.blink ? 1 : 0;
      ctx.save();
      ctx.globalAlpha *= clamp(kf * 2.5);
      if (blink) {
        g.arc(fx - ex, ey + 2 * s, 9 * s, 0.25, Math.PI - 0.25, { color: GHOST_INK, width: 3.6 * s, seed: 941 });
        g.arc(fx + ex, ey + 2 * s, 9 * s, 0.25, Math.PI - 0.25, { color: GHOST_INK, width: 3.6 * s, seed: 942 });
      } else {
        C.dot(g, fx - ex, ey, 8.5 * s, GHOST_INK, 943);
        C.dot(g, fx + ex, ey, 8.5 * s, GHOST_INK, 944);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(fx - ex + 2.5 * s, ey - 3 * s, 2.6 * s, 0, TAU);
        ctx.arc(fx + ex + 2.5 * s, ey - 3 * s, 2.6 * s, 0, TAU);
        ctx.fill();
      }
      // 腮红
      ctx.fillStyle = rgba(P.pink, 0.55);
      ctx.beginPath();
      ctx.ellipse(fx - ex - 8 * s, ey + 26 * s, 15 * s, 8 * s, 0, 0, TAU);
      ctx.ellipse(fx + ex + 8 * s, ey + 26 * s, 15 * s, 8 * s, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      // 胡萝卜（淡橙色轮廓）
      const cy0 = ey + 18 * s, dir = look >= 0 ? 1 : -1;
      const tipX = fx + dir * Math.cos(0.15) * 50 * s, tipY = cy0 + Math.sin(0.15) * 50 * s;
      g.poly([[fx, cy0 - 9 * s], [tipX, tipY], [fx, cy0 + 9 * s]], { color: '#f2a66a', width: 3.6 * s, fill: 'rgba(247,180,120,0.45)', progress: seg(kf, 0.2, 0.7), still, seed: 945 });
      // 笑
      g.arc(fx, ey + 30 * s, 17 * s, 0.35, Math.PI - 0.35, { color: GHOST_INK, width: 4 * s, progress: seg(kf, 0.5, 1), still, seed: 946 });
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ S1 + S2：俯视水坑
  const PD = { x: 900, y: 520, rx: 440, ry: 285 };
  const PUD = catmull(blob(PD.x, PD.y, PD.rx, PD.ry, 7, 30, 0.13), true, 5);
  const RIM = catmull(blob(PD.x + 6, PD.y + 8, PD.rx * 1.09, PD.ry * 1.13, 7, 30, 0.15), true, 5);
  const inPud = (x, y, m) => {
    const dx = (x - PD.x) / (PD.rx * m), dy = (y - PD.y) / (PD.ry * m);
    return dx * dx + dy * dy < 1;
  };
  const GH = { x: 868, y: 708, s: 0.78 };     // 水里雪人轮廓（脚底）
  // 躺在水坑边的围巾（第一个点是被捏起来的那一头）
  const SC_LINE = catmull([[1442, 380], [1432, 464], [1368, 546], [1334, 626], [1392, 714], [1378, 806]], false, 10);
  const SC_CUM = cumLen(SC_LINE);
  const SC_L = SC_CUM[SC_CUM.length - 1];
  const SC_G = SC_LINE[0];
  const UP = norm([1, -0.26]);               // 手从右边伸进来，围巾往这个方向被提走

  // 花 / 草的位置（避开水坑）
  const FLOWERS = [];
  for (let i = 0, k = 0; i < 60 && FLOWERS.length < 22; i++) {
    const x = -120 + rand(i, 61, 1) * (W + 240), y = -60 + rand(i, 61, 2) * (H + 120);
    if (inPud(x, y, 1.22) || (x > 1290 && x < 1520 && y > 320 && y < 880) || (x < 540 && y < 250)) continue;
    FLOWERS.push([x, y, 11 + rand(i, 61, 3) * 8, k++ % 3 ? '#ffffff' : '#fff1b8', rand(i, 61, 4) * TAU]);
  }

  function puddleWater(g, t, st) {
    const ctx = g.ctx;
    ctx.save();
    trace(ctx, PUD);
    ctx.clip();
    // 倒映的天空：越往中间越蓝（正上方的天）
    const gr = ctx.createRadialGradient(PD.x - 40, PD.y - 30, 30, PD.x, PD.y, PD.rx * 1.15);
    gr.addColorStop(0, '#7fa8d6');
    gr.addColorStop(0.55, '#9cc0e4');
    gr.addColorStop(1, '#d4e6f3');
    ctx.fillStyle = gr;
    ctx.fillRect(PD.x - PD.rx * 1.3, PD.y - PD.ry * 1.4, PD.rx * 2.6, PD.ry * 2.8);
    // 云慢慢飘过
    for (let k = 0; k < 4; k++) {
      const span = PD.rx * 2.8;
      const cx = PD.x - PD.rx * 1.4 + ((((rand(k, 71) * span + t * (10 + k * 3)) % span) + span) % span);
      const cy = PD.y - PD.ry * 0.75 + rand(k, 72) * PD.ry * 1.5;
      const s = 0.8 + rand(k, 73) * 0.7;
      ctx.save();
      ctx.globalAlpha *= 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      [[0, 0, 60], [58, -16, 48], [104, 6, 40], [-52, 10, 42], [28, 22, 50]].forEach(([dx, dy, r]) => {
        ctx.moveTo(cx + dx * s + r * s, cy + dy * s);
        ctx.arc(cx + dx * s, cy + dy * s, r * s, 0, TAU);
      });
      ctx.fill();
      ctx.restore();
    }
    // 水面反光（斜斜的两道）
    ctx.save();
    ctx.globalAlpha *= 0.16;
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineWidth = 40;
    ctx.beginPath();
    ctx.moveTo(PD.x + 120, PD.y - 330); ctx.lineTo(PD.x + 380, PD.y + 60);
    ctx.stroke();
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(PD.x + 200, PD.y - 330); ctx.lineTo(PD.x + 440, PD.y + 30);
    ctx.stroke();
    ctx.restore();
    // 水底的煤球
    ctx.save();
    ctx.globalAlpha *= 0.55;
    C.dot(g, 690, 690, 9, '#3d4660', 961);
    C.dot(g, 1080, 700, 8, '#3d4660', 962);
    ctx.restore();
    // 雪人的轮廓
    ctx.save();
    if (st.wob) {
      ctx.translate(GH.x, GH.y - 160);
      ctx.transform(1, 0, st.wob * Math.sin(t * 3.1), 1, 0, 0);
      ctx.translate(-GH.x, -(GH.y - 160));
    }
    ghostMan(g, GH.x, GH.y, GH.s, { k: st.ghostK, alpha: st.ghostA, look: st.look, lookUp: st.lookUp, arms: st.arms, blink: st.blink });
    ctx.restore();
    // 水面上漂着的花瓣
    for (let i = 0; i < 3; i++) {
      const px = [PD.x - 330, PD.x + 170, PD.x + 300][i] + Math.sin(t * 0.4 + i * 2) * 26, py = [PD.y + 40, PD.y + 190, PD.y - 150][i] + Math.cos(t * 0.33 + i) * 16;
      ctx.save();
      ctx.fillStyle = '#fde9ec';
      ctx.strokeStyle = rgba(P.ink, 0.4);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(px, py, 11, 6, t * 0.3 + i, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ripple(g, px, py, ((t * 0.5 + i * 0.37) % 1) * 2.2, { life: 2.2, R: 34, a: 0.5, rings: 1, w: 2, seed: 970 + i });
    }
    // 滴水的涟漪（固定节奏）
    const per = 1.35;
    const k0 = Math.floor(t / per);
    for (let k = k0 - 1; k <= k0; k++) {
      if (k < 0) continue;
      const age = t - (k * per + rand(k, 81) * 0.4);
      const th = rand(k, 82) * TAU, rr = Math.sqrt(rand(k, 83)) * 0.7;
      const x = PD.x + Math.cos(th) * PD.rx * rr, y = PD.y + Math.sin(th) * PD.ry * rr;
      if (Math.hypot(x - GH.x, y - (GH.y - 180)) < 150) continue;
      ripple(g, x, y, age, { life: 1.9, R: 80 + 40 * rand(k, 84), a: 0.7, seed: 980 + k * 3 });
    }
    // 额外的涟漪（大水滴 / 围巾被拿走时）
    (st.ripples || []).forEach((r, i) => ripple(g, r[0], r[1], r[2], { life: r[3] || 2.2, R: r[4] || 150, a: 0.9, rings: 3, w: 3.6, seed: 990 + i * 5 }));
    // 阳光闪一闪
    const gl = 0.6 + 0.4 * Math.sin(t * 2.2);
    sparkle(g, PD.x + 250, PD.y - 170, 22 * gl, 0.9, t * 0.5);
    ctx.restore();
    // 水边
    g.path(PUD, { closed: true, color: '#6f97c4', width: 4, seed: 995, overshoot: false });
    g.path(PUD.slice(4, 34), { color: 'rgba(255,255,255,0.75)', width: 3, seed: 996 });
  }

  /** 俯视的春天草地 + 水坑 + 遗物。st 见 shotTop */
  function topWorld(g, t, st) {
    const ctx = g.ctx;
    // 草地
    ctx.save();
    const gr = ctx.createRadialGradient(PD.x, PD.y, 150, PD.x, PD.y, 1300);
    gr.addColorStop(0, '#dcebbf');
    gr.addColorStop(1, '#afd096');
    ctx.fillStyle = gr;
    ctx.fillRect(-500, -500, W + 1000, H + 1000);
    ctx.restore();
    for (let i = 0; i < 6; i++) {
      const x = rand(i, 51, 1) * (W + 400) - 200, y = rand(i, 51, 2) * (H + 400) - 200;
      g.glow(x, y, 220 + rand(i, 51, 3) * 180, i % 3 ? '#86b07a' : '#f0f5da', 0.24);
    }
    // 残雪
    snowPatch(g, 170, 880, 150, 80, 21);
    snowPatch(g, 1130, 1010, 150, 62, 23);
    snowPatch(g, 1860, 60, 120, 70, 29);
    snowPatch(g, 1700, 960, 110, 56, 25);
    // 湿泥圈
    g.fill(RIM, 'rgba(150,140,96,0.38)', { seed: 31 });
    // 草
    tufts(g, 190, 41, [-240, -160, W + 480, H + 320], (x, y) => inPud(x, y, 1.12), P.greenDeep, 0.5, 1);
    tufts(g, 70, 42, [-240, -160, W + 480, H + 320], (x, y) => inPud(x, y, 1.15), '#6f9d63', 0.6, 1.3);
    // 花
    FLOWERS.forEach((f, i) => flower(g, f[0], f[1], f[2], f[3], 400 + i, f[4]));
    // 水边的小石子
    for (let i = 0; i < 9; i++) {
      const a = rand(i, 47, 1) * TAU;
      const x = PD.x + Math.cos(a) * PD.rx * 1.1, y = PD.y + Math.sin(a) * PD.ry * 1.14;
      if (x > 1280 && y > 340 && y < 860) continue;
      g.ellipse(x, y, 9 + rand(i, 47, 2) * 8, 7 + rand(i, 47, 3) * 5, { fill: '#cfc8b8', color: rgba(P.ink, 0.6), width: 2, rot: a, seed: 470 + i });
    }
    // 水
    puddleWater(g, t, st);
    // 伸进水里的几根草
    [[0.62, 1], [0.95, 0.8], [1.25, 1.1], [2.2, 0.9], [2.55, 1.05], [3.6, 0.9], [4.1, 1]].forEach(([a, sc], i) => {
      const x = PD.x + Math.cos(a) * PD.rx * 1.02, y = PD.y + Math.sin(a) * PD.ry * 1.03;
      const sw = Math.sin(t * 1.4 + i) * 4;
      for (let j = -1; j <= 1; j++) {
        g.line(x, y, x - Math.cos(a) * 26 * sc + j * 12 + sw, y - Math.sin(a) * 22 * sc - 26 * sc, { color: j ? '#6f9d63' : P.greenDeep, width: 3.4, seed: 480 + i * 3 + j });
      }
    });
    // 遗物：帽子、胡萝卜、树枝
    twig(g, 330, 470, 150, 0.35, 501);
    twig(g, 1530, 790, 140, -2.6, 505);
    C.hat(g, 520, 245, 0.85, -0.55, { seed: 510 });
    C.carrot(g, 640, 865, 1.05, -0.3, { seed: 515 });
    C.dot(g, 455, 690, 9, P.ink, 520);
    // 围巾
    scarfTop(g, t, st);
  }

  /** 围巾：D = 被提走的距离（沿 UP 方向） */
  function scarfTop(g, t, st) {
    const ctx = g.ctx;
    const D = st.pull || 0;
    if (D > SC_L + 900) return;
    const pts = [];
    const hs = [];
    for (let s = 0; s <= SC_L + 0.01; s += 13) {
      const sig = s - D;
      if (sig >= 0) {
        const q = pointAt(SC_LINE, SC_CUM, sig);
        pts.push([q[0], q[1]]);
        hs.push(0);
      } else {
        const h = -sig;
        const sw = Math.sin(t * 6 - s / 38) * Math.min(1, h / 140) * 16;
        pts.push([SC_G[0] + UP[0] * h + UP[1] * sw, SC_G[1] + UP[1] * h - UP[0] * sw]);
        hs.push(h);
      }
    }
    const sm = smoothPts(pts, 3);
    const wf = hs.map((h) => 1 + 0.28 * Math.min(1, h / 260));
    // 提起来的部分在地上的影子
    if (D > 0) {
      const sh = sm.map((q, i) => [q[0] + Math.min(46, hs[i] * 0.16), q[1] + Math.min(58, hs[i] * 0.2)]);
      ribbon(g, sh, 50, { w: wf, stroke: false, fill: 'rgba(28,40,36,0.17)', seed: 601 });
    }
    ribbon(g, sm, 50, { w: wf, seed: 610 });
    // 泡在水里的那一段颜色淡一点
    ctx.save();
    trace(ctx, PUD);
    ctx.clip();
    const Lp = [], Rp = [];
    for (let i = 0; i < sm.length; i++) {
      if (hs[i] > 0) continue;
      const a = sm[Math.max(0, i - 1)], b = sm[Math.min(sm.length - 1, i + 1)];
      const d = norm([b[0] - a[0], b[1] - a[1]]);
      Lp.push([sm[i][0] - d[1] * 27, sm[i][1] + d[0] * 27]);
      Rp.push([sm[i][0] + d[1] * 27, sm[i][1] - d[0] * 27]);
    }
    if (Lp.length > 2) {
      ctx.fillStyle = rgba(P.water, 0.32);
      trace(ctx, Lp.concat(Rp.reverse()));
      ctx.fill();
    }
    ctx.restore();
    // 湿湿的反光
    for (let i = 3; i < sm.length - 3; i += 7) {
      const a = sm[i - 1], b = sm[i + 1];
      const d = norm([b[0] - a[0], b[1] - a[1]]);
      g.line(sm[i][0] - d[1] * 12 - d[0] * 8, sm[i][1] + d[0] * 12 - d[1] * 8, sm[i][0] - d[1] * 12 + d[0] * 10, sm[i][1] + d[0] * 12 + d[1] * 10, { color: '#ffffff', width: 3, alpha: 0.55, seed: 620 + i });
    }
    // 往下滴的水
    if (D > 0) {
      for (let k = 0; k < 4; k++) {
        const ph = ((t * 1.6 + k * 0.27) % 1 + 1) % 1;
        const i = Math.min(sm.length - 1, Math.max(0, Math.round((sm.length - 1) * (0.15 + 0.2 * k))));
        if (hs[i] <= 20) continue;
        const q = sm[i];
        const sx = Math.min(46, hs[i] * 0.16), sy = Math.min(58, hs[i] * 0.2);
        C.drop(g, lerp(q[0], q[0] + sx, ph), lerp(q[1] + 20, q[1] + sy + 10, ph), 0.6 * (1 - ph * 0.4), { seed: 630 + k });
      }
    }
  }

  function shotTop(g, p, t, info) {
    const ctx = g.ctx;
    const s2 = p >= CUT[1];
    const dur = info.dur;
    const st = { ghostK: 0, ghostA: 0.85, look: 0, lookUp: 0.35, arms: [0, 0], herA: 0, pull: 0, ripples: [], wob: 0.03 };
    let cam;
    const u1 = seg(p, 0, CUT[1]), u2 = seg(p, CUT[1], CUT[2]);
    const d1 = (CUT[1] - CUT[0]) * dur, d2 = (CUT[2] - CUT[1]) * dur;
    if (!s2) {
      cam = { x: lerp(905, 925, u1), y: lerp(548, 520, u1), z: lerp(1.0, 1.09, ease.inOut(u1)), r: lerp(-0.018, 0.004, u1) };
      // 一大滴水落下，涟漪荡开之后雪人的轮廓一笔一笔浮出来
      st.ripples.push([GH.x + 10, GH.y - 210, (u1 - 0.17) * d1, 2.4, 260]);
      st.ghostK = ease.inOut(seg(u1, 0.3, 0.86));
      st.lookUp = 0.4;
      st.blink = u1 > 0.9 && u1 < 0.95;
    } else {
      cam = { x: lerp(1100, 1130, u2), y: lerp(488, 470, u2), z: lerp(1.28, 1.36, ease.inOut(u2)), r: lerp(0.012, -0.004, u2) };
      st.ghostK = 1;
      // 影子 / 倒影
      const herIn = ease.out(seg(u2, 0, 0.16)), herOut = 1 - ease.inOut(seg(u2, 0.88, 1));
      st.herA = herIn * herOut;
      st.herLean = 1 - herIn;
      // 雪人：看向你、挥手
      const meet = ease.inOut(seg(u2, 0.08, 0.2));
      st.notice = seg(u2, 0.06, 0.3);
      st.look = lerp(0, 0.85, meet);
      st.lookUp = lerp(0.4, 0.15, meet);
      const wave = Math.max(Math.sin(Math.PI * seg(u2, 0.12, 0.38)), Math.sin(Math.PI * seg(u2, 0.84, 1.08)));
      st.arms = [0, wave * (0.9 + 0.3 * Math.sin(t * 11))];
      // 手伸进来：犹豫一下 → 捏住 → 提起来带走
      const app1 = ease.outCubic(seg(u2, 0.22, 0.4));
      const app2 = ease.inOut(seg(u2, 0.46, 0.52));
      const reach = u2 < 0.46 ? lerp(760, 70, app1) + (u2 > 0.4 ? Math.sin(t * 30) * 3 : 0) : lerp(70, 0, app2);
      st.pull = ease.inCubic(seg(u2, 0.58, 0.88)) * (SC_L + 950);
      st.hand = u2 >= 0.22 && st.pull < SC_L + 900 ? (u2 < 0.58 ? reach : st.pull) : null;
      st.grip = seg(u2, 0.52, 0.58);
      st.gripFx = seg(u2, 0.53, 0.62);
      const follow = ease.inOut(seg(u2, 0.58, 0.72));
      st.look = lerp(st.look, 0.95, follow);
      st.lookUp = lerp(st.lookUp, 0.75, follow);
      // 围巾离开水面的涟漪
      if (u2 > 0.58) {
        st.ripples.push([1330, 590, (u2 - 0.62) * d2, 2.4, 170]);
        st.ripples.push([1345, 540, (u2 - 0.68) * d2, 2.2, 120]);
      }
      st.blink = u2 > 0.8 && u2 < 0.83;
      st.ghostA = lerp(0.85, 0.6, ease.inOut(seg(u2, 0.86, 1)));
    }

    g.save();
    g.camera(cam.x, cam.y, cam.z, cam.r);
    topWorld(g, t, st);
    // S1 开头：一滴水从镜头这边落向水面（越落越小，和自己的影子重合）
    if (!s2) {
      const fk = seg(u1, 0.0, 0.17);
      if (fk < 1) {
        const ex = GH.x + 10, ey = GH.y - 210;
        const e = ease.in(fk);
        ctx.save();
        ctx.globalAlpha *= 0.12 + 0.25 * e;
        ctx.fillStyle = '#2c4466';
        ctx.beginPath();
        ctx.ellipse(ex + 4, ey + 4, lerp(26, 9, e), lerp(20, 7, e), 0, 0, TAU);
        ctx.fill();
        ctx.restore();
        const dx = lerp(-150, 0, e), dy = lerp(-120, 0, e);
        C.drop(g, ex + dx, ey + dy, lerp(2.6, 0.7, e), { seed: 990 });
      } else {
        // 溅起的小水珠
        const sk = seg(u1, 0.17, 0.26);
        if (sk < 1) {
          for (let k = 0; k < 7; k++) {
            const a = (k / 7) * TAU + 0.3;
            const d = 20 + ease.out(sk) * 70;
            ctx.save();
            ctx.globalAlpha *= 1 - sk;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(GH.x + 10 + Math.cos(a) * d, GH.y - 210 + Math.sin(a) * d * 0.9, 6 * (1 - sk * 0.5), 0, TAU);
            ctx.fill();
            ctx.restore();
          }
        }
      }
    }
    // "你"的影子从右边盖过来
    if (st.herA > 0) {
      g.glow(1640 + (1 - st.herA) * 260, 470, 560, '#1e2b28', 0.3 * st.herA);
    }
    // 他发现你来了：！
    if (st.notice > 0 && st.notice < 1) {
      const nk = st.notice;
      const ny = GH.y - 380 - ease.outBack(clamp(nk * 4)) * 26;
      g.text('！', GH.x + 140, ny, { size: 120, font: 'round', color: '#ffffff', stroke: GHOST_INK, strokeWidth: 14, alpha: 1 - seg(nk, 0.8, 1), progress: clamp(nk * 5), seed: 51 });
      for (let k = 0; k < 3; k++) {
        const a = -0.9 + k * 0.45, r0 = 76, r1 = 76 + 34 * (1 - seg(nk, 0, 0.3));
        if (nk < 0.3) g.line(GH.x + 140 + Math.cos(a) * r0, ny + Math.sin(a) * r0, GH.x + 140 + Math.cos(a) * r1, ny + Math.sin(a) * r1, { color: '#ffffff', width: 5, seed: 52 + k });
      }
    }
    // 手
    if (st.hand != null) {
      const D = st.hand;
      const tip = [SC_G[0] + UP[0] * D - UP[0] * 6 * st.grip, SC_G[1] + UP[1] * D];
      const lift = Math.min(1, (st.pull || 0) / 300);
      reachArm(g, tip, [-UP[0], -UP[1]], 0.86 * (1 + 0.12 * lift), { curl: -0.12 * st.grip, shadow: [40 + 30 * lift, 60 + 40 * lift] });
      // 捏住的一下：小小的冲击线
      const gk = st.gripFx || 0;
      if (gk > 0 && gk < 1) {
        for (let k = 0; k < 4; k++) {
          const a = -2.2 + k * 0.5;
          const r0 = 60 + gk * 30, r1 = r0 + 26 * (1 - gk);
          g.line(tip[0] + Math.cos(a) * r0, tip[1] + Math.sin(a) * r0, tip[0] + Math.cos(a) * r1, tip[1] + Math.sin(a) * r1, { color: P.ink, width: 4, alpha: 1 - gk, seed: 700 + k });
        }
      }
    }
    g.restore();

    // 一点点阳光 + 暗角
    g.glow(160, 80, 720, '#fff4d6', 0.34);
    g.vignette(0.16, '#2c3a2c');

    // 手写：日期
    if (!s2) {
      const kd = seg(u1, 0.06, 0.32);
      g.text('3.21', 196, 118, { font: 'latin', size: 92, color: P.ink, progress: kd, seed: 11 });
      g.text('晴', 330, 124, { size: 74, color: P.ink, progress: seg(u1, 0.28, 0.4), seed: 12 });
      // 小太阳
      const ks = seg(u1, 0.38, 0.6);
      if (ks > 0) {
        const sx = 432, sy = 116;
        g.circle(sx, sy, 22, { color: P.warmDeep, width: 4, fill: P.sun, progress: seg(ks, 0, 0.5), still: ks < 1, seed: 13 });
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TAU + t * 0.6;
          g.line(sx + Math.cos(a) * 32, sy + Math.sin(a) * 32, sx + Math.cos(a) * 44, sy + Math.sin(a) * 44, { color: P.warmDeep, width: 3.5, progress: seg(ks, 0.4 + k * 0.06, 0.5 + k * 0.06), seed: 14 + k });
        }
      }
      g.line(150, 176, 470, 170, { color: rgba(P.ink, 0.7), width: 3, progress: ease.out(seg(u1, 0.42, 0.56)), seed: 25 });
      const kn = seg(u1, 0.56, 0.74);
      g.text('第', 170, 216, { size: 46, color: P.inkSoft, progress: clamp(kn * 3), seed: 26 });
      g.text('110', 238, 212, { font: 'latin', size: 54, color: P.inkSoft, progress: clamp(kn * 3 - 1), seed: 27 });
      g.text('天', 306, 216, { size: 46, color: P.inkSoft, progress: clamp(kn * 3 - 2), seed: 28 });
    } else if (u2 > 0.62 && u2 < 0.97) {
      // 嗒、嗒
      const k1 = seg(u2, 0.64, 0.68), k2 = seg(u2, 0.71, 0.75);
      g.text('嗒', 1210, 760, { size: 64, color: '#4f78ad', progress: k1, rot: -0.15, seed: 31, stroke: 'rgba(255,255,255,0.8)', strokeWidth: 8 });
      g.text('嗒', 1300, 830, { size: 50, color: '#4f78ad', progress: k2, rot: 0.12, seed: 32, stroke: 'rgba(255,255,255,0.8)', strokeWidth: 8 });
    }
  }

  // ------------------------------------------------------------------ S3：抱在怀里
  const TORSO = [[290, 1180], [306, 700], [350, 330], [470, 60], [620, -80], [1300, -80], [1450, 60], [1570, 330], [1614, 700], [1630, 1180]];

  function shotHug(g, p, t, info) {
    const ctx = g.ctx;
    const u = seg(p, CUT[2], CUT[3]);
    g.bg(['#f8ddb0', '#f3c08f', '#e5a08c']);
    bokeh(g, t, 12, 41, ['#fff3d2', '#ffd9a8', '#f7b9a8'], 0.55, 40, 110, 0.8);
    g.glow(180, 200, 700, '#fff3d6', 0.55);
    const z = lerp(1.0, 1.06, ease.inOut(u));
    const br = 1 + 0.008 * Math.sin(t * 1.7);
    g.save();
    g.camera(960, 540, z, lerp(-0.015, 0.01, u), 0, 0);
    ctx.translate(960, 1100);
    ctx.scale(br, br);
    ctx.translate(-960, -1100);
    // 大衣
    g.path(TORSO, { closed: true, smooth: true, fill: COAT, color: P.ink, width: 5, seed: 802 });
    // V 领里的毛衣
    g.poly([[800, -60], [960, 250], [1120, -60]], { fill: '#e9dccb', color: P.ink, width: 4.5, seed: 803 });
    for (let k = 0; k < 4; k++) g.line(880 + k * 54, -20, 902 + k * 36, 120 + (k === 1 || k === 2 ? 60 : 0), { color: rgba('#b8a48c', 0.8), width: 3, seed: 804 + k });
    // 领子
    g.path([[780, -60], [930, 250], [960, 290], [880, 230], [700, -60]], { closed: true, fill: COAT_LIT, color: P.ink, width: 4.5, seed: 810 });
    g.path([[1140, -60], [990, 250], [960, 290], [1040, 230], [1220, -60]], { closed: true, fill: COAT_LIT, color: P.ink, width: 4.5, seed: 811 });
    // 扣子
    [[930, 410], [930, 900]].forEach((b, k) => C.dot(g, b[0], b[1], 11, '#2a1f24', 812 + k));
    g.line(960, 300, 962, 1120, { color: rgba('#000000', 0.28), width: 4, seed: 815 });
    // 夕阳的轮廓光（左边）
    g.curve([[468, 66], [356, 320], [312, 700], [300, 1060]], { color: P.warm, width: 9, alpha: 0.8, seed: 816 });
    g.glow(330, 420, 260, P.warm, 0.25);
    // 心口的暖光
    const warmA = 0.3 + 0.12 * Math.sin(t * 2.4);
    g.glow(960, 560, 380, P.glow, warmA);

    // 湿围巾：两只手捏着，中间垂成一道弧，两头挂下来
    const LH = [800, 545], RH = [1120, 545];
    const sag = 205 + Math.sin(t * 1.5) * 6;
    const U = [];
    for (let i = 0; i <= 24; i++) {
      const f = i / 24;
      U.push([lerp(LH[0], RH[0], f), lerp(LH[1], RH[1], f) + Math.sin(f * Math.PI) * sag]);
    }
    ribbon(g, U, 84, { seed: 820, fringe: [false, false] });
    // 中间往下滴的水
    const drip = (x, y, off, k) => {
      const ph = ((t * 0.9 + off) % 1 + 1) % 1;
      ctx.save();
      ctx.globalAlpha *= 1 - ease.in(ph);
      C.drop(g, x, y + 20 + ease.in(ph) * 300, 0.95, { seed: 860 + k });
      ctx.restore();
    };
    drip(960, LH[1] + sag + 40, 0, 0);
    drip(930, LH[1] + sag + 36, 0.55, 1);
    // 捏在手里的两头：从拳头上面探出一小截流苏
    const stub = (x0, y0, side, seed) => {
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const f = i / 6;
        pts.push([x0 + side * f * 44 + Math.sin(t * 2 + f * 3 + side) * 3 * f, y0 - f * 78]);
      }
      ribbon(g, pts, 66, { seed, fringe: [false, true] });
    };
    stub(LH[0] - 10, LH[1] + 40, -1, 840);
    stub(RH[0] + 10, RH[1] + 40, 1, 850);
    // 手套 + 袖子
    const sq = Math.sin(t * 1.7) * 0.02;
    const sleeve = (wx, wy, dx, dy, seed) => {
      const d = norm([dx, dy]);
      const nx = -d[1], ny = d[0];
      const a = [wx + d[0] * 20, wy + d[1] * 20], b = [wx + d[0] * 620, wy + d[1] * 620];
      g.path([[a[0] + nx * 80, a[1] + ny * 80], [b[0] + nx * 118, b[1] + ny * 118], [b[0] - nx * 118, b[1] - ny * 118], [a[0] - nx * 80, a[1] - ny * 80]], {
        closed: true, fill: COAT_LIT, color: P.ink, width: 5, seed,
      });
      g.line(wx + d[0] * 200 + nx * 40, wy + d[1] * 200 + ny * 40, wx + d[0] * 260 - nx * 20, wy + d[1] * 260 - ny * 20, { color: rgba(P.ink, 0.4), width: 3.5, seed: seed + 1 });
    };
    sleeve(730, 790, -0.42, 1, 880);
    sleeve(1190, 790, 0.42, 1, 882);
    C.mitten(g, 730, 790, 1.4, 0.36 + sq, { seed: 890, flip: true });
    C.mitten(g, 1190, 790, 1.4, -0.36 - sq, { seed: 895 });
    // 湿湿的反光
    for (let k = 0; k < 4; k++) {
      const f = 0.2 + k * 0.2;
      const x = lerp(LH[0], RH[0], f), y = LH[1] + Math.sin(f * Math.PI) * sag + 18;
      g.line(x - 16, y, x + 16, y + 3, { color: '#ffffff', width: 4, alpha: 0.65, seed: 870 + k });
    }

    // 一颗小心浮起来
    const hk = seg(u, 0.45, 0.95);
    if (hk > 0) {
      const hy = lerp(560, 380, ease.out(hk)) + Math.sin(t * 3) * 6;
      const hs = 36 * ease.outBack(clamp(hk * 3)) * (1 + 0.14 * (info.pulse || 0) + 0.06 * Math.max(0, Math.sin(t * 7.2)) * (info.bpm ? 0 : 1));
      g.glow(960, hy, 130, P.warm, 0.55);
      C.heart(g, 960, hy, hs, { seed: 899, width: 4 });
    }
    g.restore();

    // 带你回家。
    g.text('带你回家。', 1760, 170, { vertical: true, size: 84, color: P.ink, progress: seg(u, 0.06, 0.55), seed: 41, stroke: 'rgba(255,246,230,0.75)', strokeWidth: 10 });
    g.vignette(0.3, '#5a2e2a');
  }

  // ------------------------------------------------------------------ S4：黄昏远景 → 升上天空
  const DUSK_FLOWERS = [];
  for (let i = 0; i < 40; i++) DUSK_FLOWERS.push([rand(i, 91, 1) * W, 870 + rand(i, 91, 2) * 230, 5 + rand(i, 91, 3) * 5, rand(i, 91, 4)]);

  function flakeAt(g, x, y, r, rot, t, a) {
    if (a <= 0 || r <= 0) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.globalAlpha *= a;
    g.glow(x, y, r * 4.5, '#dfe9ff', 0.45);
    C.flake(g, x + r * 0.05, y + r * 0.06, r, { rot, color: rgba(P.ice, 0.7), width: Math.max(2.2, r * 0.13), seed: 1101 });
    C.flake(g, x, y, r, { rot, color: '#ffffff', width: Math.max(2, r * 0.1), fill: '#e5eeff', seed: 1102 });
    sparkle(g, x + r * 0.5, y - r * 0.6, Math.max(8, r * 0.35) * (0.6 + 0.4 * Math.sin(t * 5)), 0.9, t);
    ctx.restore();
  }

  function shotDusk(g, p, t, info) {
    const ctx = g.ctx;
    const u = seg(p, CUT[3], CUT[4]);
    const tilt = ease.inOutCubic(seg(u, 0.34, 0.78));
    const camY = lerp(548, -880, tilt);
    g.save();
    g.camera(960 + Math.sin(t * 0.25) * 8, camY, lerp(1.04, 1.0, u), 0);
    // 天空
    const gr = ctx.createLinearGradient(0, -1800, 0, 880);
    gr.addColorStop(0, '#0c1124');
    gr.addColorStop(0.28, P.nightDeep);
    gr.addColorStop(0.48, P.night);
    gr.addColorStop(0.64, P.dusk);
    gr.addColorStop(0.8, '#b18ca6');
    gr.addColorStop(0.92, '#eeb48f');
    gr.addColorStop(1, '#f8d49f');
    ctx.fillStyle = gr;
    ctx.fillRect(-300, -1900, W + 600, 2900);
    stars(g, t, 170, 93, [-100, -1800, W + 200, 2000], 0.35 + 0.65 * tilt, 380);
    C.moon(g, 1470, -1150, 66, { phase: 0.55, seed: 94 });
    // 夕阳
    g.glow(330, 790, 620, '#ffd9a0', 0.6);
    g.circle(330, 800, 70, { fill: '#ffd47e', color: '#f2a85c', width: 3, seed: 95 });
    // 被夕阳照着的云（镜头往上升的时候从旁边滑过）
    [[330, -120, 1.1, '#f1b9b0', 0.8, '#ffe2c4'], [1540, -380, 0.9, '#c99db8', 0.75, '#f5c6c0'], [560, -660, 1.25, '#8f86b8', 0.7, '#c6b0d4'], [1380, -1000, 0.8, '#5f6299', 0.65, '#9c9cc8']].forEach(([x, y, cs, col, ca, lit], k) => {
      const cx = x + t * 7 + Math.sin(t * 0.15 + k) * 20;
      puffCloud(g, cx, y, 330 * cs, col, ca, 120 + k * 3, { lit });
    });
    // 远山
    const hill = (y0, amp, seed, fill, line) => {
      const pts = [[-120, 1300]];
      for (let x = -120; x <= W + 120; x += 80) pts.push([x, y0 + Math.sin(x / 260 + seed) * amp + Math.sin(x / 90 + seed * 2) * amp * 0.2]);
      pts.push([W + 120, 1300]);
      g.path(pts, { closed: true, smooth: true, fill, color: line, width: 3, seed, overshoot: false });
    };
    hill(790, 22, 3, '#a38fb0', 'rgba(70,60,100,0.5)');
    // 房子 + 开着的门
    g.rect(1420, 330, 700, 560, { fill: '#d6bfb6', color: P.ink, width: 5, seed: 96 });
    g.fill([[1420, 330], [2120, 330], [2120, 890], [1420, 890]], 'rgba(70,56,100,0.3)', { seed: 97 });
    for (let k = 0; k < 6; k++) g.line(1430, 400 + k * 80, 2110, 398 + k * 80, { color: 'rgba(60,46,80,0.18)', width: 3, seed: 160 + k });
    g.path([[1376, 342], [1496, 246], [2150, 246], [2150, 342]], { closed: true, fill: '#4b3f5c', color: P.ink, width: 5, seed: 98 });
    g.path([[1392, 338], [1440, 300], [1520, 292], [1600, 300], [1650, 286]], { smooth: true, color: rgba(P.snow, 0.85), width: 7, seed: 99 });
    // 门里透出来的光，铺在草地上
    ctx.save();
    ctx.globalAlpha *= 0.4 + 0.05 * Math.sin(t * 3);
    const lg = ctx.createLinearGradient(0, 866, 0, 1100);
    lg.addColorStop(0, P.glow);
    lg.addColorStop(1, rgba(P.glow, 0));
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(1662, 866); ctx.lineTo(1826, 866); ctx.lineTo(1760, 1100); ctx.lineTo(1300, 1100);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    g.glow(1745, 700, 300, P.warm, 0.35);
    C.door(g, 1660, 548, 170, 318, { open: 0.62, seed: 101 });
    C.window(g, 1470, 470, 120, 118, { light: 1, seed: 105, tree: false, curtains: true });
    // 地面（春天的草）
    hill(858, 6, 9, '#9fbd88', P.ink);
    g.glow(330, 860, 500, '#ffe0a8', 0.3);
    tufts(g, 120, 101, [-100, 870, W + 200, 260], null, '#5e8a5a', 0.55, 1.1);
    DUSK_FLOWERS.forEach((f, i) => {
      ctx.save();
      ctx.fillStyle = f[3] > 0.6 ? '#fff1b8' : '#ffffff';
      ctx.globalAlpha *= 0.85;
      ctx.beginPath();
      ctx.arc(f[0], f[1], f[2] * 0.6, 0, TAU);
      ctx.fill();
      ctx.restore();
      void i;
    });
    // 水坑（倒映着晚霞，还有他淡淡的倒影）
    const QX = 640, QY = 948, QRX = 330, QRY = 54;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(QX, QY, QRX, QRY, 0, 0, TAU);
    const pg = ctx.createLinearGradient(0, QY - QRY, 0, QY + QRY);
    pg.addColorStop(0, '#f6c995');
    pg.addColorStop(0.5, '#c79bb0');
    pg.addColorStop(1, '#7f86b4');
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.clip();
    ctx.translate(QX + 20, QY - QRY + 6);
    ctx.scale(1, -0.6);
    ghostMan(g, 0, 0, 0.3, { k: 1, alpha: 0.6, lookUp: 0.3 });
    ctx.restore();
    g.ellipse(QX, QY, QRX, QRY, { color: '#7f86b4', width: 3.5, seed: 102 });
    g.line(QX - 230, QY - 10, QX - 110, QY - 18, { color: '#ffffff', width: 3, alpha: 0.7, seed: 103 });
    ripple(g, QX + 120, QY + 6, (t % 2.4), { life: 2.4, R: 70, flat: 0.18, a: 0.6, seed: 104 });
    // "你"：围上了红围巾
    const px = 1150, py = 958, ps = 1.18;
    ctx.save();
    ctx.globalAlpha *= 0.2;
    ctx.fillStyle = '#2a2a40';
    ctx.beginPath();
    ctx.ellipse(px + 24, py + 4, 96, 14, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    // 被风吹起来的围巾尾巴（在身后）
    const tailPts = [], tw = [];
    for (let i = 0; i <= 12; i++) {
      const f = i / 12;
      tailPts.push([px - 22 * ps - f * 170 * ps, py - 318 * ps + f * 96 * ps + Math.sin(t * 6.5 - f * 5) * 24 * f * ps]);
      tw.push(1 - 0.2 * f);
    }
    ribbon(g, tailPts, 30 * ps, { w: tw, s: 0.8, seed: 110, fringe: [false, true], knit: 24 });
    C.person(g, px, py, ps, { color: COAT, scarf: false, seed: 111 });
    // 绕在脖子上的一圈
    ribbon(g, [[px - 44 * ps, py - 330 * ps], [px - 14 * ps, py - 316 * ps], [px + 16 * ps, py - 314 * ps], [px + 44 * ps, py - 328 * ps]], 30 * ps, { s: 0.8, seed: 112, fringe: [false, false], knit: 18 });
    C.mitten(g, px - 66 * ps, py - 158 * ps, 0.3, Math.PI - 0.2, { seed: 115, flip: true });
    C.mitten(g, px + 66 * ps, py - 158 * ps, 0.3, Math.PI + 0.2, { seed: 116 });
    // 花瓣被风吹过
    petals(g, t, 14, 117, [-200, 300, W + 400, 700], -70, 0.85, 1);
    // 最后一片雪花
    const fk = seg(u, 0.6, 1);
    if (fk > 0) {
      const at = (k) => [980 + Math.sin(k * 7) * 70 * (1 - k), lerp(-1520, -880, ease.out(k))];
      // 飘过的轨迹上留下一点点亮晶晶
      for (let j = 1; j <= 6; j++) {
        const k = fk - j * 0.035;
        if (k <= 0) break;
        const q = at(k);
        sparkle(g, q[0], q[1], 7 - j * 0.7, (1 - j / 7) * 0.7 * clamp(fk * 4), t * 2 + j);
      }
      const q = at(fk);
      flakeAt(g, q[0], q[1], lerp(8, 44, ease.in(fk)), t * 0.6, clamp(fk * 4));
    }
    g.restore();
    g.vignette(0.3 + 0.15 * tilt);
  }

  // ------------------------------------------------------------------ S5：雪花特写
  function shotFlake(g, p, t, info) {
    const u = seg(p, CUT[4], CUT[5]);
    g.bg(['#0b1022', P.nightDeep, '#1d2545']);
    stars(g, t, 90, 121, [0, 0, W, H], 0.5);
    bokeh(g, t, 10, 122, ['#9fb8dc', '#f7c873', '#dfe9ff'], 0.22, 50, 130, 0.5);
    const x = 900 + Math.sin(t * 0.6) * 14, y = lerp(470, 510, u);
    const r = lerp(250, 290, ease.out(u));
    const rot = -Math.PI / 2 + t * 0.12;
    g.glow(x, y, r * 1.7, '#cfe0ff', 0.3 + 0.12 * (info.pulse || 0));
    C.flake(g, x + 9, y + 11, r, { rot, color: rgba(P.ice, 0.55), width: 15, seed: 131 });
    C.flake(g, x, y, r, { rot, color: '#f6f9ff', width: 12, fill: '#e5eeff', seed: 132 });
    // 尖端一闪一闪
    for (let k = 0; k < 6; k++) {
      const ph = ((t * 0.9 - k / 6) % 1 + 1) % 1;
      const a = rot + (k * Math.PI) / 3;
      sparkle(g, x + Math.cos(a) * r, y + Math.sin(a) * r, 22 * Math.sin(ph * Math.PI), Math.sin(ph * Math.PI), t);
    }
    sparkle(g, x, y, 30 + 8 * Math.sin(t * 3), 0.9, t * 0.3);
    g.text('是你吗？', 1560, 220, { vertical: true, size: 76, color: MOON, progress: seg(u, 0.18, 0.6), seed: 141, stroke: 'rgba(12,16,34,0.6)', strokeWidth: 10 });
    // 切进来的一下亮
    const fl = 1 - seg(u, 0, 0.12);
    if (fl > 0) {
      g.ctx.save();
      g.ctx.fillStyle = `rgba(235,242,255,${0.55 * fl * fl})`;
      g.ctx.fillRect(0, 0, W, H);
      g.ctx.restore();
    }
    g.vignette(0.45);
  }

  // ------------------------------------------------------------------ S6：片尾
  // 每个字的笔画中心线（以字号为单位、字中心为原点），按笔顺排列（和 intro 一样的写法）
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
  const STROKE_LEN = {};
  for (const ch in STROKES) {
    STROKE_LEN[ch] = STROKES[ch].map((st) => {
      let L = 0;
      for (let i = 1; i < st.length; i++) L += Math.hypot(st[i][0] - st[i - 1][0], st[i][1] - st[i - 1][1]);
      return L;
    });
  }

  /** 毛笔字按笔顺写出来；返回笔尖位置（写完 / 没开始时返回 null） */
  function brushChar(g, ch, x, y, size, prog, o) {
    o = o || {};
    if (prog <= 0) return null;
    const ctx = g.ctx, boil = g.info.boil;
    const jx = (rand(boil, 31, o.seed | 0) - 0.5) * 2.4, jy = (rand(boil, 32, o.seed | 0) - 0.5) * 2.4;
    let tip = null;
    ctx.save();
    ctx.translate(x + jx, y + jy);
    ctx.rotate((rand(boil, 33, o.seed | 0) - 0.5) * 0.012);
    ctx.font = `${size}px ${TG.FONTS.brush}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const strokes = STROKES[ch];
    if (prog < 1 && strokes) {
      const lens = STROKE_LEN[ch];
      const gap = 0.06;
      const total = lens.reduce((a, b) => a + b + gap, 0);
      let rem = prog * total;
      const R = size * 0.085, step = R * 0.45;
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

  /** 红色印章：刻着一个小雪人。k 0..1 从大到小"啪"地盖下 */
  function sealMan(g, x, y, sz, k) {
    if (k <= 0) return;
    const ctx = g.ctx;
    const e = ease.outCubic(clamp(k));
    const sc = lerp(2.5, 1, e);
    const wc = '#fbe9e2';
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lerp(-0.3, -0.07, e));
    ctx.scale(sc, sc);
    ctx.globalAlpha *= clamp(k * 2.5);
    const h = sz / 2;
    g.rect(-h, -h, sz, sz, { fill: P.red, color: P.redDeep, width: 3, jitter: 0.8, seed: 151 });
    g.rect(-h + 6, -h + 6, sz - 12, sz - 12, { color: wc, width: 2.2, jitter: 0.7, alpha: 0.85, seed: 152, taper: false });
    // 雪人（留白）
    g.circle(0, sz * 0.16, sz * 0.19, { fill: wc, color: wc, width: 2, jitter: 0.5, seed: 153 });
    g.circle(0, -sz * 0.1, sz * 0.13, { fill: wc, color: wc, width: 2, jitter: 0.5, seed: 154 });
    g.rect(-sz * 0.09, -sz * 0.36, sz * 0.18, sz * 0.13, { fill: wc, color: wc, width: 2, jitter: 0.4, seed: 155 });
    g.line(-sz * 0.16, -sz * 0.225, sz * 0.16, -sz * 0.225, { color: wc, width: 3, jitter: 0.4, seed: 156, taper: false });
    ctx.fillStyle = P.red;
    ctx.beginPath();
    ctx.arc(-sz * 0.045, -sz * 0.115, sz * 0.022, 0, TAU);
    ctx.arc(sz * 0.045, -sz * 0.115, sz * 0.022, 0, TAU);
    ctx.fill();
    // 树枝手
    g.line(-sz * 0.17, sz * 0.1, -sz * 0.34, -sz * 0.02, { color: wc, width: 2.4, jitter: 0.4, seed: 157 });
    g.line(sz * 0.17, sz * 0.1, sz * 0.34, -sz * 0.02, { color: wc, width: 2.4, jitter: 0.4, seed: 158 });
    // 印泥不匀
    ctx.fillStyle = 'rgba(244,239,228,0.7)';
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.arc((rand(i, 159) - 0.5) * sz * 0.9, (rand(i, 160) - 0.5) * sz * 0.9, 0.8 + rand(i, 161) * 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function shotEnd(g, p, t, info) {
    const ctx = g.ctx;
    const u = seg(p, CUT[5], 1);
    // 印章盖下去那一下，整个画面震一震
    const shk = 1 - seg(u, 0.565, 0.6);
    if (u > 0.565 && shk > 0) {
      const sh = g.shake(7 * shk);
      ctx.translate(sh[0], sh[1]);
    }
    g.bg([P.nightDeep, P.night, '#252e55']);
    stars(g, t, 110, 171, [0, 0, W, H * 0.8], 0.8);
    g.glow(960, 470, 760, '#2f3d70', 0.55);
    // 雪又开始下了（明年冬天）
    const snowK = seg(u, 0.36, 0.7);
    if (snowK > 0) {
      g.snow({ t, count: 70, seed: 181, size: [1.6, 4.5], speed: [22, 50], wind: 10, sway: 20, alpha: 0.75 * snowK });
      g.snow({ t, count: 10, seed: 182, size: [8, 13], speed: [40, 70], wind: 14, crystal: 8, alpha: 0.8 * snowK });
    }
    // 雪花停在上方
    const fk = ease.outCubic(seg(u, 0, 0.12));
    const fx = 960, fy = lerp(380, 196, fk) + Math.sin(t * 1.2) * 5;
    flakeAt(g, fx, fy, lerp(130, 50, fk), -Math.PI / 2 + t * 0.25, 1);
    // 雪人
    const TS = 270, TY = 430;
    const k1 = ease.inOut(seg(u, 0.04, 0.2)), k2 = ease.inOut(seg(u, 0.2, 0.27));
    const done = seg(u, 0.27, 0.37);
    if (done > 0) g.glow(960, TY, 420, P.ice, 0.16 * done);
    const shadow = rgba(P.ice, 0.42);
    const tip1 = brushChar(g, '雪', 828, TY - 6, TS, k1, { color: SNOW_TXT, shadow, sdx: 8, sdy: 7, seed: 1 });
    const tip2 = brushChar(g, '人', 1078, TY + 8, TS, k2, { color: SNOW_TXT, shadow, sdx: 8, sdy: 7, seed: 2 });
    const tip = tip1 || tip2;
    if (tip) {
      g.glow(tip[0], tip[1], 70, '#ffffff', 0.35);
      sparkle(g, tip[0], tip[1], 12, 0.9, t * 4);
    }
    // 红围巾当分隔线
    const kl = ease.inOut(seg(u, 0.27, 0.36));
    if (kl > 0) {
      const n = 26, m = Math.max(2, Math.round(n * kl));
      const pts = [];
      for (let i = 0; i <= m; i++) {
        const f = i / n;
        pts.push([800 + f * 320, 596 + Math.sin(f * TAU * 1.5 + t * 1.8) * 6]);
      }
      ribbon(g, pts, 24, { s: 0.6, seed: 197, fringe: [true, kl >= 1], knit: 16 });
    }
    // 明年冬天，再见。
    g.text('明年冬天，再见。', 960, 668, { size: 64, color: '#e3eaff', progress: seg(u, 0.34, 0.46), seed: 191, spacing: 4 });
    // Fin
    const kf = seg(u, 0.46, 0.52);
    g.text('Fin', 960, 772, { font: 'latin', size: 96, color: P.warm, progress: kf, seed: 192 });
    g.line(810, 782, 896, 778, { color: rgba(P.warm, 0.8), width: 3, progress: ease.out(seg(u, 0.47, 0.54)), seed: 193 });
    g.line(1110, 778, 1024, 782, { color: rgba(P.warm, 0.8), width: 3, progress: ease.out(seg(u, 0.47, 0.54)), seed: 194 });
    g.text('12.01 — 3.21', 960, 846, { font: 'latin', size: 40, color: rgba(MOON, 0.62), progress: seg(u, 0.5, 0.56), seed: 195 });
    // 印章
    const ks = seg(u, 0.54, 0.57);
    const SX = 1290, SY = 515;
    sealMan(g, SX, SY, 82, ks);
    const ring = seg(u, 0.57, 0.63);
    if (ring > 0 && ring < 1) g.circle(SX, SY, lerp(60, 170, ease.out(ring)), { color: rgba(P.red, 0.8), width: 3 * (1 - ring), alpha: 1 - ring, seed: 196 });
    g.vignette(0.5);
  }

  // ------------------------------------------------------------------
  TG.scene({
    id: 'fin',
    title: '尾声',
    dark: true,
    transition: 'fade',
    chars: '晴第天嗒带你回家是吗明年冬再见雪人，。？！',
    lyrics: 'none',
    draw(g, p, t, info) {
      const ctx = g.ctx;
      if (p < CUT[2]) shotTop(g, p, t, info);
      else if (p < CUT[3]) shotHug(g, p, t, info);
      else if (p < CUT[4]) shotDusk(g, p, t, info);
      else if (p < CUT[5]) shotFlake(g, p, t, info);
      else {
        ctx.save();
        shotEnd(g, p, t, info);
        ctx.restore();
      }
      // 歌词：亮的画面用深色字，夜里用浅色字
      const darkLyric = (p >= CUT[2] && p < CUT[3]) || p >= lerp(CUT[3], CUT[4], 0.55);
      if (info.lyric) g.lyric(info.lyric, { dark: darkLyric });
      // 渐黑
      const k = ease.inOut(seg(seg(p, CUT[5], 1), 0.7, 0.975));
      if (k > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(5,6,12,${k})`;
        ctx.fillRect(-20, -20, W + 40, H + 40);
        ctx.restore();
      }
    },
  });
})();
