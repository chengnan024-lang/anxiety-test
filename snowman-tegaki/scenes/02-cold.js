/* 场景：cold —— 冷
 *
 * 镜头（按 p 分段，适配 12～35 秒）：
 *   1. 0.00–0.07  标题卡：毛笔大字「冷」按笔顺写出来，横风吹雪
 *   2. 0.07–0.30  远景：空旷雪原，雪人很小，远处地平线上"你"家的一点暖光，横风
 *   3. 0.30–0.50  温度计特写：-3°C → 推近，红线往下掉、霜从画框四角长进来 → 「-12°C」砸下来
 *   4. 0.50–0.76  跳切延时：01:00 → 04:00，积雪一格一格升高把雪人埋到半身，头顶积雪、越抖越厉害
 *   5. 0.76–1.00  近景：远处的窗亮了，雪人转头望向右边，「你那里，暖和吗？」，镜头往暖光推过去（接下一幕「窗」）
 */
(function () {
  'use strict';
  const { clamp, lerp, seg, ease, rand, noise1, mix, rgba } = TG.U;
  const P = TG.PAL, C = TG.C, W = TG.W, H = TG.H;

  // 镜头分段
  const SH = { title: 0.07, wide: 0.28, thermo: 0.48, bury: 0.71 };

  // 夜色里的雪地（比纯白暗一点、偏蓝）
  const SNOW_N = '#e6ecf8';
  const SNOW_FAR = '#9eacd0';
  const HILL_FAR = '#3d4a7c';
  const INK_N = '#232033';

  // ------------------------------------------------------------------ 小工具
  /** 折线截取 [a, b]（0..1，按长度） */
  function trim(pts, a, b) {
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const tot = L[L.length - 1];
    const s0 = clamp(a) * tot, s1 = clamp(b) * tot;
    const out = [];
    const at = (s) => {
      let i = 1;
      while (i < L.length - 1 && L[i] < s) i++;
      const k = (s - L[i - 1]) / (L[i] - L[i - 1] || 1);
      return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)];
    };
    out.push(at(s0));
    for (let i = 0; i < pts.length; i++) if (L[i] > s0 && L[i] < s1) out.push(pts[i]);
    out.push(at(s1));
    return out;
  }

  /** 圆角矩形的点 */
  function rrect(x, y, w, h, r) {
    const pts = [];
    const cs = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]];
    for (const [cx, cy, a0] of cs) for (let i = 0; i <= 4; i++) {
      const a = a0 + (i / 4) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
  }

  /** 雪人头部位置（和 characters.js 的比例一致，melt=0） */
  function headOf(x, y, s, look, lookUp) {
    const hx = x, hy = y - 288.4 * s, r = 80 * s;
    const fx = look * r * 0.28, fy = -lookUp * r * 0.25;
    const ey = -r * 0.12 + fy;
    const tilt = look * 0.06;
    const mx = fx, my = ey + 44 * s;
    return {
      hx, hy, r,
      mouthX: hx + mx * Math.cos(tilt) - my * Math.sin(tilt),
      mouthY: hy + mx * Math.sin(tilt) + my * Math.cos(tilt),
    };
  }

  /** 夜空渐变 + 星星 */
  function sky(g, t, o = {}) {
    const ctx = g.ctx;
    const cols = o.colors || [P.nightDeep, P.night, '#33406f'];
    if (o.fillTo) {
      // 下面会被地面盖住的部分不用画（全屏渐变在软件渲染下很贵）
      const gr = ctx.createLinearGradient(0, 0, 0, H);
      cols.forEach((c, i) => gr.addColorStop(i / (cols.length - 1), c));
      ctx.save();
      ctx.fillStyle = gr;
      ctx.fillRect(-20, -20, W + 40, o.fillTo + 20);
      ctx.restore();
    } else g.bg(cols);
    const n = o.stars == null ? 50 : o.stars;
    const yMax = o.yMax || 560;
    ctx.save();
    ctx.fillStyle = '#e9eeff';
    const base = ctx.globalAlpha;
    for (let i = 0; i < n; i++) {
      const x = rand(i, 41, 1) * W, y = rand(i, 41, 2) * yMax;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.6 + rand(i, 41, 3) * 1.6) + i));
      ctx.globalAlpha = base * tw * (0.35 + rand(i, 41, 4) * 0.5);
      const r = 1 + rand(i, 41, 5) * 1.8;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * 远处的雪地 / 山坡带（代替 C.ground）。
   * C.ground 的取样只到 x=1880，闭合曲线会从 1880 斜着拐到右下角，
   * 在画面右边缘露出一道斜边；这里取样一直延伸到画外 400px。
   * 取样网格和 C.ground 一致（-40 + 120k），所以起伏形状不变。
   */
  function ground(g, y, o = {}) {
    const pts = [[-400, H + 400]];
    const amp = o.amp == null ? 18 : o.amp;
    for (let x = -400; x <= W + 400; x += 120) pts.push([x, y + noise1(x / 300, (o.seed | 0) + 3) * amp]);
    pts.push([W + 400, H + 400]);
    g.path(pts, { closed: true, smooth: true, color: o.line || P.ink, width: o.width || 4.5, fill: o.color || P.snow, seed: o.seed, overshoot: false });
  }

  /** 竖直线性渐变（可以直接当 fill 颜色用） */
  function vgrad(g, y0, y1, c0, c1) {
    const gr = g.ctx.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, c0);
    gr.addColorStop(1, c1);
    return gr;
  }

  /** 一朵扁扁的夜云 */
  function cloud(g, x, y, w, seed) {
    const h = w * 0.16;
    const pts = [[x - w * 0.5, y + h * 0.5], [x - w * 0.42, y - h * 0.1], [x - w * 0.25, y - h * 0.5], [x - w * 0.05, y - h * 0.2], [x + w * 0.12, y - h * 0.9], [x + w * 0.32, y - h * 0.4], [x + w * 0.5, y + h * 0.5]];
    g.path(pts, { closed: true, smooth: true, color: 'rgba(150,165,215,0.35)', width: 2.2, fill: 'rgba(62,72,122,0.55)', seed });
  }

  /** 横风：快速掠过的雪线（无状态） */
  function streaks(g, t, o = {}) {
    const ctx = g.ctx;
    const n = o.count || 40, seed = o.seed || 1;
    const [y0, y1] = o.y || [0, H];
    const [v0, v1] = o.speed || [900, 1500];
    const [l0, l1] = o.len || [60, 200];
    const span = W + 700;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = o.color || P.snow;
    const base = ctx.globalAlpha * (o.alpha == null ? 0.4 : o.alpha);
    for (let i = 0; i < n; i++) {
      const r1 = rand(i, seed, 1), r2 = rand(i, seed, 2), r3 = rand(i, seed, 3), r4 = rand(i, seed, 4);
      const v = lerp(v0, v1, r2);
      const len = lerp(l0, l1, r3);
      const x = ((r1 * span + t * v) % span) - 350;
      const y = lerp(y0, y1, r4) + Math.sin(t * 2.3 + i * 1.7) * 10;
      const bend = (rand(i, seed, 5) - 0.5) * 22;
      ctx.globalAlpha = base * (0.35 + 0.65 * r3);
      ctx.lineWidth = lerp(1.2, o.width || 3, r3);
      ctx.beginPath();
      ctx.moveTo(x - len, y + bend * 0.4);
      ctx.quadraticCurveTo(x - len * 0.5, y - bend, x, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 手绘的风：一条波浪线末端打个卷，边走边画出来又收掉 */
  function gusts(g, t, o = {}) {
    const n = o.count || 3, seed = o.seed || 7;
    const period = o.period || 1.6;
    for (let i = 0; i < n; i++) {
      const off = rand(i, seed, 1) * period;
      const cyc = Math.floor((t + off) / period);
      const ph = ((t + off) / period) % 1;
      const y = lerp(o.y[0], o.y[1], rand(cyc, seed + i, 2));
      const x = lerp(o.x[0], o.x[1], rand(cyc, seed + i, 3)) + ph * 260;
      const L = lerp(220, 380, rand(cyc, seed + i, 4)) * (o.s || 1);
      const r = lerp(22, 36, rand(cyc, seed + i, 5)) * (o.s || 1);
      const pts = [];
      for (let k = 0; k <= 16; k++) {
        const u = k / 16;
        pts.push([x + u * L, y + Math.sin(u * Math.PI * 1.6) * r * 0.45]);
      }
      const ex = pts[16][0], ey = pts[16][1];
      for (let k = 1; k <= 14; k++) {
        const a = Math.PI / 2 - (k / 14) * Math.PI * 1.55;
        const rr = r * (1 - (k / 14) * 0.5);
        pts.push([ex + Math.cos(a) * rr, ey - r + Math.sin(a) * rr]);
      }
      const head = ease.out(clamp(ph * 1.7));
      const tail = ease.in(clamp(ph * 1.5 - 0.45));
      if (head - tail < 0.02) continue;
      g.path(trim(pts, tail, head), { color: o.color || 'rgba(235,242,255,0.75)', width: o.width || 3.4, seed: seed + i * 3 });
    }
  }

  /** 柔光（平滑衰减、色标够密，不会像 g.glow 那样出现一圈圈的边） */
  function softGlow(g, x, y, r, color, a) {
    if (a <= 0 || r <= 0) return;
    const ctx = g.ctx;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      const v = 1 - u * u * (3 - 2 * u);
      gr.addColorStop(u, rgba(color, a * v * v));
    }
    ctx.save();
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  /** 平滑的椭圆暗角（g.vignette 只有两个色标，内圈会出现一道看得见的圆边） */
  function vignette(g, a, color = '#090c1a') {
    if (a <= 0) return;
    const ctx = g.ctx;
    const R = Math.hypot(W, H) * 0.5;
    const gr = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, R);
    for (let i = 0; i <= 20; i++) {
      const u = i / 20;
      const k = clamp((u - 0.5) / 0.5);
      gr.addColorStop(u, rgba(color, a * k * k * (3 - 2 * k)));
    }
    ctx.save();
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /** 远处的小房子（"你"家），(x,y) 底边中心 */
  function house(g, x, y, s, light, o = {}) {
    const w = 120 * s, h = 78 * s;
    const lw = Math.max(2, 3.6 * s);
    if (light > 0) {
      softGlow(g, x - 8 * s, y - h * 0.45, 300 * s * (o.glowK || 1), P.warm, 0.55 * light);
      softGlow(g, x - 8 * s, y - h * 0.45, 110 * s, P.glow, 0.6 * light);
    }
    // 烟囱
    g.poly([[x + w * 0.22, y - h - 30 * s], [x + w * 0.22, y - h - 62 * s], [x + w * 0.36, y - h - 62 * s], [x + w * 0.36, y - h - 16 * s]], { color: INK_N, width: lw, fill: '#2a2f52', seed: 301 });
    // 墙
    g.poly([[x - w / 2, y], [x - w / 2, y - h], [x + w / 2, y - h], [x + w / 2, y]], { color: INK_N, width: lw, fill: '#2c3460', seed: 302 });
    // 屋顶
    g.poly([[x - w / 2 - 16 * s, y - h + 2 * s], [x, y - h - 66 * s], [x + w / 2 + 16 * s, y - h + 2 * s]], { color: INK_N, width: lw, fill: '#1f2444', seed: 303 });
    // 屋顶积雪
    g.path([[x - w / 2 - 20 * s, y - h + 4 * s], [x - w * 0.25, y - h - 30 * s], [x, y - h - 70 * s], [x + w * 0.28, y - h - 30 * s], [x + w / 2 + 20 * s, y - h + 4 * s], [x + w * 0.3, y - h - 16 * s], [x, y - h - 52 * s], [x - w * 0.3, y - h - 14 * s]], { closed: true, smooth: true, color: INK_N, width: lw * 0.8, fill: SNOW_N, seed: 304 });
    // 窗
    const wx = x - 22 * s, wy = y - h * 0.72, ww = 34 * s, wh = 30 * s;
    g.rect(wx - ww / 2, wy, ww, wh, { color: INK_N, width: lw * 0.8, fill: mix('#3a3a58', P.warm, light), seed: 305 });
    if (light > 0.05) {
      g.line(wx, wy + 2, wx, wy + wh - 2, { color: rgba(INK_N, 0.7), width: lw * 0.6, seed: 306 });
      g.line(wx - ww / 2 + 2, wy + wh / 2, wx + ww / 2 - 2, wy + wh / 2, { color: rgba(INK_N, 0.7), width: lw * 0.6, seed: 307 });
    }
    // 门
    g.rect(x + 20 * s, y - 44 * s, 24 * s, 44 * s, { color: INK_N, width: lw * 0.8, fill: '#3b2f3a', seed: 308 });
  }

  /** 光秃秃的小松树剪影 */
  function pine(g, x, y, s, seed) {
    g.poly([[x - 30 * s, y], [x, y - 110 * s], [x + 30 * s, y]], { color: INK_N, width: 2.6, fill: '#26304f', seed });
    g.path([[x - 18 * s, y - 40 * s], [x - 2 * s, y - 70 * s], [x + 16 * s, y - 44 * s], [x + 4 * s, y - 50 * s]], { closed: true, smooth: true, color: INK_N, width: 2, fill: SNOW_N, alpha: 0.9, seed: seed + 1 });
  }

  /** 枯草，被风吹弯 */
  function tuft(g, x, y, s, t, seed) {
    for (let k = 0; k < 4; k++) {
      const bx = x + (k - 1.5) * 9 * s;
      const h = (48 + rand(k, seed, 1) * 40) * s;
      const sway = (26 + 14 * Math.sin(t * 7 + k * 1.3 + seed)) * s;
      g.curve([[bx, y], [bx + sway * 0.25, y - h * 0.55], [bx + sway, y - h]], { color: '#4e5880', width: 3.4 * s, seed: seed + k });
    }
  }

  /** 篱笆桩：从近到远往"你"家的方向排过去 */
  function fence(g, pts, t) {
    pts.forEach(([x, y, h], i) => {
      g.line(x, y, x + 1, y - h, { color: '#4a3226', width: Math.max(2.5, h * 0.12), taper: false, seed: 400 + i });
      g.ellipse(x + 1, y - h - 2, h * 0.12 + 3, h * 0.06 + 2, { color: INK_N, width: 1.6, fill: SNOW_N, seed: 420 + i });
    });
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1, h1] = pts[i], [x2, y2, h2] = pts[i + 1];
      const a = [x1, y1 - h1 * 0.7], b = [x2, y2 - h2 * 0.7];
      const sag = 8 + Math.sin(t * 3 + i) * 2;
      g.curve([a, [lerp(a[0], b[0], 0.5), lerp(a[1], b[1], 0.5) + sag], b], { color: 'rgba(30,26,40,0.55)', width: 1.8, seed: 440 + i });
    }
  }

  /** 帽子上的积雪（角色自带的 snowCap 被帽子挡住了，这里在帽顶和帽檐上补一层） */
  function hatSnow(g, x, y, s, look, shiver, amt, t, seed) {
    if (amt <= 0.02) return;
    const ctx = g.ctx;
    const sh = shiver ? Math.sin(t * 40) * 3 * shiver * s : 0;
    const h = amt * 24 * s;
    ctx.save();
    ctx.translate(x + sh, y - 288.4 * s);
    ctx.rotate(look * 0.06);
    ctx.translate(-6 * s, -68.8 * s);
    ctx.rotate(-0.12);
    // 帽顶：一块略微垂过帽檐两侧的雪
    g.path([[-48 * s, -72 * s], [-40 * s, -82 * s - h * 0.55], [-14 * s, -87 * s - h], [14 * s, -86 * s - h * 0.95], [40 * s, -82 * s - h * 0.5], [50 * s, -73 * s], [44 * s, -70 * s], [20 * s, -79 * s], [-20 * s, -78 * s], [-43 * s, -69 * s]], {
      closed: true, smooth: true, color: INK_N, width: 3.2 * s, fill: '#ffffff', seed,
    });
    // 帽檐：沿着帽檐上沿薄薄的一条（之前是两个圆鼓包，看起来像耳朵）
    const th = 2 + amt * 6;
    const brimY = (bx) => -14 * Math.sqrt(Math.max(0, 1 - (bx / 70) * (bx / 70)));
    for (const side of [-1, 1]) {
      const pts = [];
      [45, 53, 61, 67, 71].forEach((bx) => pts.push([side * bx * s, (brimY(bx) + 1.5) * s]));
      [[73, 0.3], [67, 1], [60, 1.15], [52, 1], [45, 0.6]].forEach(([bx, k]) => pts.push([side * bx * s, (brimY(bx) - th * k) * s]));
      g.path(pts, { closed: true, smooth: true, color: INK_N, width: 2.4 * s, fill: '#ffffff', seed: seed + (side > 0 ? 2 : 1) });
    }
    ctx.restore();
  }

  /** 树枝手臂上的积雪（几何和 characters.js 的手臂一致，melt=0） */
  function armSnow(g, x, y, s, arms, shiver, t, amt, seed) {
    if (amt <= 0.05) return;
    const sh = shiver ? Math.sin(t * 40) * 3 * shiver * s : 0;
    const bodyRx = 132 * s, bodyRy = 118 * s, bodyCy = y - bodyRy;
    [-1, 1].forEach((side, k) => {
      const raise = arms[k] || 0;
      const bx = x + sh + side * bodyRx * 0.86, by = bodyCy - bodyRy * 0.35;
      const A = side === -1 ? Math.PI + 0.45 + raise : -0.45 - raise;
      const L = 120 * s;
      [0.3, 0.58, 0.86].forEach((d, j) => {
        const a = clamp(amt * 1.6 - j * 0.3);
        if (a <= 0) return;
        const px = bx + Math.cos(A) * L * d, py = by + Math.sin(A) * L * d;
        const rx = (13 - j * 2.5) * s * a, ry = (5.5 - j) * s * a;
        g.ellipse(px, py - ry * 0.75, rx, ry, { rot: A + (side < 0 ? Math.PI : 0), color: INK_N, width: 2.2 * s, fill: '#ffffff', seed: seed + k * 5 + j });
      });
    });
  }

  /** 眼睛里的暖色反光（和 characters.js 的五官位置一致，melt=0） */
  function catchlights(g, x, y, s, look, lookUp, shiver, t, a) {
    const ctx = g.ctx;
    const r = 80 * s;
    const sh = shiver ? Math.sin(t * 40) * 3 * shiver * s : 0;
    const fx = look * r * 0.28, ey = -r * 0.12 - lookUp * r * 0.25, ex = r * 0.32;
    ctx.save();
    ctx.translate(x + sh, y - 288.4 * s);
    ctx.rotate(look * 0.06);
    ctx.globalAlpha *= clamp(a);
    ctx.fillStyle = P.warm;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(fx + side * ex + 3.2 * s, ey + 2.6 * s, 2.3 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 雪面上一闪一闪的小亮点 */
  function glints(g, x0, y0, w, h, n, seed, boil) {
    const ctx = g.ctx;
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    const base = ctx.globalAlpha;
    for (let i = 0; i < n; i++) {
      const on = rand(i, seed, (boil >> 1) + 3);
      if (on < 0.55) continue;
      const x = x0 + rand(i, seed, 1) * w, y = y0 + rand(i, seed, 2) * h;
      const r = 3 + (on - 0.55) * 14;
      ctx.globalAlpha = base * (0.5 + (on - 0.55));
      ctx.beginPath();
      ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
      ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 发抖的漫画线 */
  function shiverMarks(g, x, y, r, amt, boil, seed) {
    if (amt <= 0.05) return;
    const flip = boil % 2 ? 1 : -1;
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const ox = x + side * (r * 1.28 + k * r * 0.14);
        const oy = y - r * 0.25 + (k - 1) * r * 0.32 + flip * 3;
        const len = r * (0.22 + 0.06 * (1 - Math.abs(k - 1)));
        g.curve([[ox, oy - len], [ox + side * len * 0.18 * flip, oy], [ox, oy + len]], {
          color: 'rgba(235,242,255,0.85)', width: 3, alpha: clamp(amt * 1.4), seed: seed + k + (side > 0 ? 10 : 0),
        });
      }
    }
  }

  /** 霜花：从一点长出来的分叉冰晶 */
  function frost(g, x, y, ang, len, prog, seed, depth = 2) {
    if (prog <= 0) return;
    const ctx = g.ctx;
    const pk = clamp(prog);
    const ex = x + Math.cos(ang) * len * pk, ey = y + Math.sin(ang) * len * pk;
    if (depth === 2) g.line(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len, { color: 'rgba(225,238,255,0.9)', width: 3.2, progress: pk, seed });
    else {
      ctx.save();
      ctx.strokeStyle = 'rgba(225,238,255,0.8)';
      ctx.lineWidth = depth === 1 ? 2.2 : 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.restore();
    }
    if (depth <= 0) return;
    [0.3, 0.55, 0.78].forEach((d, j) => {
      const bp = clamp((pk - d) / (1 - d) * 1.4);
      if (bp <= 0) return;
      const bx = x + Math.cos(ang) * len * d, by = y + Math.sin(ang) * len * d;
      const bl = len * (0.42 - j * 0.1) * (0.8 + rand(j, seed, 3) * 0.4);
      frost(g, bx, by, ang - 0.95, bl, bp, seed * 3 + j * 2 + 1, depth - 1);
      frost(g, bx, by, ang + 0.95, bl, bp, seed * 3 + j * 2 + 2, depth - 1);
    });
  }

  /** 积雪堆（从 baseY-level 往下全是雪），雪人附近堆高一点（迎风的左侧更高） */
  function drift(g, baseY, level, o) {
    const pts = [[-260, H + 300]];
    const cx = o.cx, R = o.r || 200;
    for (let x = -260; x <= W + 260; x += 36) {
      const d = (x - cx) / R;
      const pile = (o.pile || 0) * Math.exp(-d * d * 0.9) * (d < 0 ? 1.15 : 0.8);
      const y = baseY - level - pile + noise1(x / 170, o.seed || 3) * (o.amp == null ? 10 : o.amp);
      pts.push([x, y]);
    }
    pts.push([W + 260, H + 300]);
    g.path(pts, { closed: true, smooth: true, color: INK_N, width: o.width || 4.5, fill: o.color || SNOW_N, overshoot: false, seed: o.seed || 3 });
    // 雪面下的一道浅蓝阴影
    const sh = pts.slice(1, -1).map((p) => [p[0] + 6, p[1] + 16]);
    const band = sh.concat(sh.slice().reverse().map((p) => [p[0], p[1] + 26]));
    g.fill(band, rgba(P.snowShade, 0.55), { jitter: 1.2, seed: (o.seed || 3) + 1 });
  }

  /** 温度计（木板 + 纸面刻度 + 玻璃管），(x,y) 中心，temp 当前温度 */
  function thermometer(g, x, y, s, temp, t, o = {}) {
    const ctx = g.ctx;
    const yOf = (T) => -260 + (20 - T) * 9.6;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(o.rot || 0);
    ctx.scale(s, s);
    // 柱子
    g.poly([[-46, -1400], [46, -1400], [50, 1400], [-50, 1400]], { color: INK_N, width: 5, fill: '#4a3226', seed: 501 });
    for (let k = 0; k < 4; k++) g.line(-28 + k * 18, -1300, -26 + k * 18, 1300, { color: 'rgba(30,20,20,0.35)', width: 2.5, seed: 505 + k });
    // 柱子左侧（迎风面）糊上的雪
    for (let k = 0; k < 7; k++) {
      const yy = -1100 + k * 340 + rand(k, 9) * 90;
      g.ellipse(-48, yy, 12 + rand(k, 10) * 8, 40 + rand(k, 11) * 40, { color: INK_N, width: 2.5, fill: SNOW_N, seed: 520 + k });
    }
    // 木板
    g.path(rrect(-96, -392, 192, 784, 40), { closed: true, color: INK_N, width: 5, fill: P.wood, seed: 530 });
    g.path(rrect(-70, -360, 140, 712, 30), { closed: true, color: INK_N, width: 3.5, fill: '#f6f1e6', seed: 531 });
    // 钉子
    [[-1, -376], [-1, 376]].forEach(([nx, ny], k) => g.circle(nx, ny, 7, { color: INK_N, width: 2.5, fill: '#cfc6b8', seed: 532 + k }));
    g.text('°C', 0, -318, { size: 40, font: 'round', color: P.ink, seed: 3, still: true, pop: false });
    // 刻度
    for (let T = -30; T <= 20; T++) {
      const yy = yOf(T);
      const big = T % 10 === 0, mid = T % 5 === 0;
      const len = big ? 24 : mid ? 17 : 9;
      g.line(-16, yy, -16 - len, yy, { color: P.ink, width: big ? 3 : 2, jitter: 0.5, seed: 540 + T });
      if (mid) g.line(16, yy, 16 + len * 0.8, yy, { color: P.ink, width: big ? 3 : 2, jitter: 0.5, seed: 600 + T });
      if (big) g.text(String(T), -46, yy - 2, { size: 36, font: 'latin', color: T < 0 ? '#2f5f9a' : P.ink, align: 'right', still: true, pop: false, seed: 9 + T });
    }
    // 0 度那一格加一道蓝线
    g.line(-40, yOf(0), 40, yOf(0), { color: rgba('#2f5f9a', 0.5), width: 2, seed: 660 });
    // 玻璃管
    g.path(rrect(-12, -296, 24, 560, 12), { closed: true, color: INK_N, width: 3, fill: 'rgba(205,225,245,0.55)', seed: 670 });
    // 红色液柱
    const yt = yOf(temp);
    g.line(0, 262, 0, yt, { color: P.red, width: 11, taper: false, jitter: 0.6, seed: 671 });
    g.circle(0, 274, 30, { color: INK_N, width: 3.5, fill: P.red, seed: 672 });
    g.line(-9, 262, -11, 284, { color: 'rgba(255,255,255,0.8)', width: 4, seed: 673 });
    g.line(-6, -280, -6, 240, { color: 'rgba(255,255,255,0.7)', width: 2.4, seed: 674 });
    // 液柱顶端一点亮光
    g.glow(0, yt, 34, P.red, 0.35);
    // 顶上积雪
    g.path([[-112, -380], [-90, -418], [-40, -436], [10, -430], [60, -440], [104, -412], [112, -380], [60, -392], [0, -386], [-60, -392]], { closed: true, smooth: true, color: INK_N, width: 4, fill: SNOW_N, seed: 680 });
    // 木板左边缘贴着的雪
    g.path([[-98, -300], [-112, -220], [-104, -120], [-112, 40], [-100, 160], [-94, 60], [-92, -120]], { closed: true, smooth: true, color: INK_N, width: 3, fill: SNOW_N, seed: 681 });
    // 底下的冰柱
    const ic = o.icicle || 0;
    [[-62, 46], [-30, 70], [24, 40], [58, 58]].forEach(([ix, il], k) => {
      const L = il * (0.35 + 0.65 * ic);
      g.poly([[ix - 9, 388], [ix + 1, 388 + L], [ix + 9, 388]], { color: '#6f8fc0', width: 2.6, fill: 'rgba(214,232,252,0.92)', seed: 690 + k });
    });
    ctx.restore();
    return { tubeX: x, yOf: (T) => y + yOf(T) * s };
  }

  /** 大号数字（温度），可加弹出缩放 */
  function bigTemp(g, str, x, y, size, o = {}) {
    const ctx = g.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(o.rot || 0);
    const sc = o.scale || 1;
    ctx.scale(sc, sc);
    g.text(str, 0, 0, {
      size, font: o.font || 'round', color: o.color || P.snow, pop: false, seed: o.seed || 1,
      shadow: { color: o.shadow || P.nightBlue, dx: size * 0.05, dy: size * 0.05 },
      stroke: o.stroke || INK_N, strokeWidth: size * 0.09, alpha: o.alpha,
    });
    ctx.restore();
  }


  // ================================================================== 1. 标题卡「冷」
  // Ma Shan Zheng「冷」的笔画中心线（相对字中心，字号 600），按笔顺排列
  const LENG = [
    { r: 46, pts: [[-182, -104], [-128, -58]] },                                        // 点
    { r: 42, pts: [[-226, 150], [-200, 104], [-160, 50], [-108, -32]] },                // 提
    { r: 36, pts: [[24, -224], [2, -150], [-40, -80], [-90, -12], [-150, 48]] },        // 撇
    { r: 38, pts: [[2, -100], [80, -40], [140, 4], [190, 30], [258, 12]] },             // 捺
    { r: 36, pts: [[-12, -22], [42, 22]] },                                             // 点
    { r: 36, pts: [[-102, 110], [0, 74], [82, 54], [136, 76], [92, 140], [30, 186]] }, // 横折
    { r: 40, pts: [[-28, 168], [18, 220], [62, 278]] },                                 // 点
  ];
  const LENG_LEN = LENG.map((s) => s.pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - s.pts[i - 1][0], p[1] - s.pts[i - 1][1]) : 0), 0));
  const LENG_TOT = LENG_LEN.reduce((a, b) => a + b, 0);

  /** 按笔顺写出「冷」：把已经写到的部分做成一串圆的并集当裁剪区域。返回笔尖位置 */
  function writeLeng(g, cx, cy, sc, w, shadow) {
    const ctx = g.ctx;
    const PAUSE = 60;
    let done = w * (LENG_TOT + PAUSE * (LENG.length - 1)), tip = null;
    ctx.save();
    if (w >= 1) {
      ctx.translate(cx, cy);
      ctx.scale(sc, sc);
      g.text('冷', 0, 0, { size: 600, font: 'brush', color: P.snow, pop: false, still: true, wobble: 0.4, seed: 2, shadow: { color: shadow.color, dx: shadow.dx / sc, dy: shadow.dy / sc } });
      ctx.restore();
      return null;
    }
    ctx.beginPath();
    for (let i = 0; i < LENG.length && done > 0; i++) {
      const s = LENG[i], L = LENG_LEN[i];
      const upto = Math.min(L, done);
      done -= L + PAUSE; // 笔画之间留一点"提笔"的停顿
      const pts = trim(s.pts, 0, upto / L);
      for (let j = 1; j < pts.length; j++) {
        const a = pts[j - 1], b = pts[j];
        const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 10));
        for (let k = 0; k <= n; k++) {
          const x = cx + lerp(a[0], b[0], k / n) * sc, y = cy + lerp(a[1], b[1], k / n) * sc;
          for (const [ox, oy] of [[0, 0], [shadow.dx, shadow.dy]]) {
            ctx.moveTo(x + ox + s.r * sc, y + oy);
            ctx.arc(x + ox, y + oy, s.r * sc, 0, Math.PI * 2);
          }
          tip = [x, y];
        }
      }
    }
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.scale(sc, sc);
    g.text('冷', 0, 0, { size: 600, font: 'brush', color: P.snow, pop: false, still: true, wobble: 0.4, seed: 2, shadow: { color: shadow.color, dx: shadow.dx / sc, dy: shadow.dy / sc } });
    ctx.restore();
    return w < 1 ? tip : null;
  }

  function shotTitle(g, k, t, info) {
    const ctx = g.ctx;
    sky(g, t, { colors: [P.nightDeep, P.night, '#2a3561'], stars: 30 });
    streaks(g, t, { count: 46, seed: 3, speed: [1100, 1900], len: [80, 260], alpha: 0.32 });
    g.snow({ count: 150, wind: 560, sway: 8, speed: [60, 140], size: [2, 8], seed: 21 });
    const [sx, sy] = g.shake(lerp(7, 2, ease.out(k)));
    const sc = lerp(0.96, 1.04, k) * (1 + 0.04 * (info.pulse || 0));
    const w = ease.inOut(seg(k, -0.05, 0.62));
    const cx = 960 + sx, cy = 520 + sy;
    const tip = writeLeng(g, cx, cy, sc, w, { color: '#3a4a86', dx: 16, dy: 18 });
    if (tip) softGlow(g, tip[0], tip[1], 80, '#dfe9ff', 0.6);
    // 笔锋甩出来的墨点
    [[1262, 470, 10], [1300, 430, 5], [676, 712, 7], [1086, 846, 6]].forEach(([x, y, r], i) => {
      const a = clamp((w - 0.55) * 5 - i * 0.35);
      if (a > 0) g.circle(cx + (x - 960) * sc, cy + (y - 520) * sc, r * ease.outBack(a), { color: P.snow, width: 2, fill: P.snow, seed: 30 + i });
    });
    // 字前面再掠过几道风
    streaks(g, t + 3, { count: 10, seed: 8, y: [300, 760], speed: [1500, 2200], len: [180, 380], alpha: 0.5, width: 4 });
    // 小字：日期 + 小雪花
    const kk = seg(k, 0.5, 0.8);
    g.text('12.3', 1400, 860, { size: 76, font: 'latin', color: P.ice, progress: kk, seed: 4 });
    if (kk > 0) C.flake(g, 1515, 850, 24, { color: P.ice, width: 3, progress: seg(k, 0.62, 0.95), rot: t * 0.6, seed: 6 });
    vignette(g, 0.45);
  }

  // ================================================================== 2. 远景：雪原
  function shotWide(g, k, t, info) {
    const ctx = g.ctx;
    sky(g, t, { colors: [P.nightDeep, P.night, '#3a477a'], stars: 70, yMax: 600, fillTo: 800 });
    ctx.save();
    const z = lerp(1.0, 1.08, ease.inOut(k));
    const [sx, sy] = g.shake(1.2);
    g.camera(lerp(930, 1000, ease.inOut(k)), 600, z, 0, sx, sy);
    // 云（在月亮后面慢慢飘）+ 月亮
    for (let i = 0; i < 3; i++) {
      const cw = 220 + rand(i, 63) * 160;
      const cxx = ((rand(i, 61) * (W + 900) + t * (26 + i * 10)) % (W + 900)) - 450;
      const cyy = 110 + i * 120 + rand(i, 62) * 30;
      cloud(g, cxx, cyy, cw, 70 + i);
    }
    C.moon(g, 1420, 170, 46, { phase: 0.42, seed: 3 });
    // 远山
    ground(g, 640, { color: vgrad(g, 560, 720, '#46548a', '#313d6c'), line: 'rgba(25,22,40,0.6)', amp: 46, seed: 11, width: 3 });
    // 远处雪地（你家所在的那条地平线）
    ground(g, 705, { color: vgrad(g, 690, 800, '#8796c2', '#aebbdc'), line: 'rgba(25,22,40,0.7)', amp: 16, seed: 5, width: 3 });
    // 远处小松树和"你"家
    pine(g, 1490, 706, 0.42, 801);
    pine(g, 1525, 708, 0.32, 803);
    pine(g, 1760, 704, 0.5, 805);
    const lightOn = 0.85 + 0.15 * Math.sin(t * 2.1);
    house(g, 1640, 712, 0.5, lightOn, { glowK: 1.3 });
    // 近处雪原（月光照着的地方亮，越靠近镜头越暗）
    drift(g, 790, 0, { cx: -9999, amp: 14, seed: 2, color: vgrad(g, 780, 1080, '#eef2fb', '#aab6d6') });
    softGlow(g, 1480, 800, 380, '#ffffff', 0.18);
    // 雪地上被风吹出来的纹
    for (let i = 0; i < 7; i++) {
      const x0 = 100 + i * 260 + rand(i, 71) * 80, y0 = 850 + rand(i, 72) * 150;
      g.curve([[x0, y0], [x0 + 70, y0 - 6], [x0 + 150, y0 - 2]], { color: rgba(P.snowShade, 0.9), width: 3, seed: 90 + i });
    }
    glints(g, 0, 820, W, 220, 26, 51, info.boil);
    // 篱笆：把视线从雪人带到"你"家
    const fp = [];
    for (let i = 0; i < 7; i++) {
      const u = i / 6;
      fp.push([lerp(700, 1450, Math.pow(u, 0.75)), lerp(838, 742, Math.pow(u, 0.8)), lerp(64, 16, Math.pow(u, 0.7))]);
    }
    fence(g, fp, t);
    // 雪人（很小）
    const sx0 = 520, sy0 = 846, ss = 0.38;
    C.snowman(g, sx0, sy0, ss, { mood: 'calm', look: 0.7, wind: 1, shiver: 0.35, outline: INK_N, seed: 3 });
    const hd = headOf(sx0, sy0, ss, 0.7, 0);
    C.breath(g, hd.hx + hd.r * 1.05, hd.mouthY, t * 1.4, { dir: 1, s: 0.32, seed: 12 });
    // 地面吹雪（贴着地皮跑）
    streaks(g, t + 1.3, { count: 30, seed: 14, y: [780, 1000], speed: [700, 1200], len: [50, 170], alpha: 0.7, width: 3, color: '#8e9ccc' });
    // 近景枯草
    tuft(g, 150, 1000, 1.1, t, 5);
    tuft(g, 236, 1022, 0.8, t, 9);
    tuft(g, 1790, 1010, 1.0, t, 13);
    ctx.restore();

    // 横风 + 雪
    streaks(g, t, { count: 34, seed: 5, y: [80, 800], speed: [900, 1500], len: [60, 220], alpha: 0.3 });
    g.snow({ count: 170, wind: 420, sway: 10, speed: [50, 120], size: [2, 7], seed: 22 });
    gusts(g, t, { count: 2, seed: 19, x: [80, 700], y: [260, 520], s: 0.9 });
    // 镜头前飞过的大片虚雪（景深）
    g.snow({ count: 7, wind: 900, sway: 20, speed: [60, 120], size: [18, 34], crystal: 999, alpha: 0.22, seed: 26 });

    // 手写：箭头 + 「你」
    const ka = seg(k, 0.35, 0.6);
    if (ka > 0) {
      const camX = (x, y) => [(x - lerp(930, 1000, ease.inOut(k))) * z + W / 2 + sx, (y - 600) * z + H / 2 + sy];
      const [hx, hy] = camX(1625, 640);
      const arrow = [[hx - 210, hy - 230], [hx - 120, hy - 250], [hx - 40, hy - 190], [hx - 8, hy - 92]];
      g.curve(arrow, { color: P.glow, width: 4.5, progress: ease.out(ka), seed: 110 });
      if (ka > 0.75) {
        const e = ease.outBack(clamp((ka - 0.75) * 4));
        g.line(hx - 8, hy - 92, hx - 34 * e - 4, hy - 120, { color: P.glow, width: 4.5, seed: 111 });
        g.line(hx - 8, hy - 92, hx + 18 * e - 4, hy - 126, { color: P.glow, width: 4.5, seed: 112 });
      }
      g.text('你', hx - 270, hy - 238, { size: 96, color: P.glow, progress: seg(k, 0.5, 0.58), seed: 113, stroke: 'rgba(18,23,41,0.6)', strokeWidth: 8 });
    }
    // 左上竖排小字
    g.text('风很大', 170, 110, { size: 84, vertical: true, color: '#e9eeff', progress: seg(k, 0.1, 0.32), seed: 120, stroke: 'rgba(18,23,41,0.6)', strokeWidth: 8 });
    vignette(g, 0.4);
  }

  // ================================================================== 3. 温度计
  function shotThermo(g, k, t, info, a) {
    const ctx = g.ctx;
    const A = 0.3, B = 0.68; // 3a 全景 | 3b 推近下降 | 3c -12 砸下来
    const drop = ease.inOutCubic(seg(k, A + 0.06, B - 0.04));
    // 掉的过程带一点"卡顿"：手书的一格一格
    const stepDrop = Math.floor(drop * 9) / 9 * 0.55 + drop * 0.45;
    const temp = lerp(-3, -12, stepDrop) + (k < A ? Math.sin(t * 3) * 0.25 : 0);
    const fr = seg(k, A, 1);
    sky(g, t, { colors: [P.nightDeep, mix(P.night, '#1a2a52', fr), mix('#2c3a66', '#355a8c', fr)], stars: 24 });
    // 背景雪 + 风
    g.snow({ count: 110, wind: 380, sway: 8, speed: [40, 100], size: [2, 6], seed: 31, alpha: 0.6 });
    streaks(g, t, { count: 28, seed: 33, speed: [1000, 1700], len: [80, 240], alpha: 0.28 });

    let shakeAmt = 1;
    if (k >= B) shakeAmt = lerp(16, 1.5, ease.out(seg(k, B, B + 0.12)));
    else if (k >= A) shakeAmt = lerp(1, 4, drop);
    const [sx, sy] = g.shake(shakeAmt);

    // 三个机位：全景 / 推近刻度（跟着液柱走）/ 回到中景
    let cam;
    if (k < A) cam = { cx: 620, cy: 560, z: lerp(1.0, 1.05, k / A), rot: 0, dx: -120 + sx, dy: sy, ic: 0 };
    else if (k < B) {
      const u = seg(k, A, B);
      const yc = 560 + (-260 + (20 - temp) * 9.6) * 0.95;
      cam = { cx: 620, cy: lerp(yc, yc + 10, u), z: lerp(1.75, 1.9, u), rot: -0.02, dx: -380 + sx, dy: 30 + sy, ic: 0.3 * u };
    } else {
      const u = seg(k, B, 1);
      cam = { cx: 620, cy: 600, z: lerp(1.08, 1.12, u), rot: 0.02, dx: -260 + sx, dy: sy, ic: ease.out(seg(u, 0.1, 0.8)) };
    }
    ctx.save();
    g.camera(cam.cx, cam.cy, cam.z, cam.rot, cam.dx, cam.dy);
    thermometer(g, 620, 560, 0.95, temp, t, { rot: -0.035, icicle: cam.ic });
    ctx.restore();
    // 温度计局部坐标 → 屏幕坐标
    const toScreen = (lx, ly) => {
      const r0 = -0.035, c0 = Math.cos(r0), s0 = Math.sin(r0);
      const wx = 620 + (lx * c0 - ly * s0) * 0.95, wy = 560 + (lx * s0 + ly * c0) * 0.95;
      const c1 = Math.cos(cam.rot), s1 = Math.sin(cam.rot);
      const X = (wx - cam.cx) * cam.z, Y = (wy - cam.cy) * cam.z;
      return [W / 2 + cam.dx + X * c1 - Y * s1, H / 2 + cam.dy + X * s1 + Y * c1];
    };

    // 霜从四角长进来
    const fp = ease.out(seg(k, A + 0.02, 1));
    if (fp > 0) {
      const cs = [[0, 0, 0.75], [W, 0, Math.PI - 0.75], [0, H, -0.75], [W, H, Math.PI + 0.75]];
      cs.forEach(([cx, cy, ang], i) => {
        softGlow(g, cx, cy, 560 * fp, '#cfe0ff', 0.5 * fp);
        for (let j = 0; j < 3; j++) {
          const aj = ang + (j - 1) * 0.42 + (rand(i, j, 7) - 0.5) * 0.2;
          frost(g, cx, cy, aj, (260 + rand(i, j, 8) * 160) * (0.6 + 0.4 * fp), clamp(fp * 1.25 - j * 0.12), 900 + i * 10 + j, 2);
        }
      });
    }

    // 右侧大数字
    if (k < A) {
      const u = k / A;
      const wr = seg(u, 0.15, 0.55);
      if (wr > 0) {
        const sc = lerp(1.35, 1, ease.outBack(clamp(wr * 2)));
        bigTemp(g, '-3°C', 1330, 470, 210, { scale: sc, alpha: clamp(wr * 3), rot: -0.04, seed: 4 });
        // 指向液柱顶端的手绘箭头
        const ap = seg(u, 0.5, 0.8);
        const [tx, ty] = toScreen(104, -260 + 23 * 9.6);
        g.curve([[1130, 590], [1060, 640], [990, 600], [tx + 14, ty + 4]], { color: P.glow, width: 5, progress: ease.out(ap), seed: 130 });
        if (ap > 0.9) {
          g.line(tx + 14, ty + 4, tx + 44, ty - 18, { color: P.glow, width: 5, seed: 131 });
          g.line(tx + 14, ty + 4, tx + 46, ty + 24, { color: P.glow, width: 5, seed: 132 });
        }
        g.text('现在', 1330, 640, { size: 58, color: '#e9eeff', progress: seg(u, 0.35, 0.6), seed: 133 });
      }
    } else if (k < B) {
      const v = Math.round(temp);
      const frac = Math.abs(temp - Math.round(temp - 0.5) - 0.5);
      const pop = 1 + 0.22 * clamp(1 - frac * 3);
      // 往下的速度线（画在数字后面，不要划过数字）
      for (let i = 0; i < 5; i++) {
        const x = 1180 + i * 95 + rand(i, 41) * 30;
        const ph = (t * 2.6 + rand(i, 42)) % 1;
        const y0 = 240 + ph * 380;
        g.line(x, y0, x, y0 + 120, { color: 'rgba(225,238,255,0.6)', width: 3, seed: 140 + i });
      }
      bigTemp(g, `${v}°C`, 1400, 520, 250, { scale: pop, rot: 0.03 * Math.sin(v * 2.1), seed: 5 + v, color: mix(P.snow, '#cfe0ff', drop) });
    } else {
      const u = seg(k, B, 1);
      const land = ease.outBack(clamp(u * 4));
      const sc = lerp(1.9, 1, land);
      // 落地瞬间白闪
      const fl = clamp(1 - u * 10);
      bigTemp(g, '-12°C', 1360, 480, 270, { scale: sc, rot: -0.05, seed: 6, color: '#eef5ff', shadow: '#28467e' });
      // 冲击线
      const ip = ease.out(clamp(u * 3));
      if (ip < 1) {
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2 + 0.2;
          const r0 = lerp(260, 380, ip), r1 = lerp(300, 470, ip);
          g.line(1360 + Math.cos(ang) * r0, 480 + Math.sin(ang) * r0 * 0.55, 1360 + Math.cos(ang) * r1, 480 + Math.sin(ang) * r1 * 0.55, { color: 'rgba(235,244,255,0.9)', width: 5, alpha: 1 - ip, seed: 150 + i });
        }
      }
      g.text('体感 -20°C', 1380, 710, { size: 66, font: 'latin', color: '#cfe0ff', progress: seg(u, 0.25, 0.6), seed: 160 });
      if (fl > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(240,248,255,${0.55 * fl})`;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }
    vignette(g, 0.35);
  }

  // ================================================================== 4. 延时：积雪升高
  const BURY = [
    { time: '01:00', cx: 930, cy: 600, z: 1.0, rot: 0 },          // 中景
    { time: '02:00', cx: 900, cy: 700, z: 1.6, rot: 0.02 },       // 推到脸
    { time: '03:00', cx: 990, cy: 590, z: 1.0, rot: -0.012 },     // 拉开：一大片雪
    { time: '04:00', cx: 820, cy: 640, z: 1.32, rot: 0.008 },     // 半身埋进雪里
  ];
  const LEVELS = [8, 40, 72, 100, 126]; // 积雪高度（px，s=1 的雪人）

  function shotBury(g, k, t, info) {
    const ctx = g.ctx;
    const n = BURY.length;
    const si = Math.min(n - 1, Math.floor(k * n));
    const u = k * n - si;
    const cam = BURY[si];
    const lv = lerp(LEVELS[si], LEVELS[si + 1], 0.25 + 0.5 * ease.out(u));
    const cont = clamp((si + u) / n);
    sky(g, t, { colors: [P.nightDeep, P.night, '#34406c'], stars: 30, yMax: 520, fillTo: 760 });
    ctx.save();
    // 每次跳切的头几帧镜头"咚"地震一下
    const stepT = u * (info.dur * (SH.bury - SH.thermo)) / n;
    const hit = si > 0 ? Math.exp(-stepT * 14) : 0;
    const [sx, sy] = g.shake(1 + cont * 1.5 + hit * 12);
    g.camera(cam.cx + u * 14, cam.cy, cam.z + u * 0.025, cam.rot, sx, sy);
    // 远处：地平线 + "你"家一点光
    ground(g, 610, { color: vgrad(g, 560, 680, '#46548a', '#313d6c'), line: 'rgba(25,22,40,0.5)', amp: 30, seed: 17, width: 3 });
    ground(g, 660, { color: vgrad(g, 650, 900, '#7f8fbd', '#b9c5e3'), line: 'rgba(25,22,40,0.65)', amp: 10, seed: 6, width: 3 });
    pine(g, 1440, 662, 0.35, 811);
    // "你"家的灯：01:00、02:00 还亮着，03:00 那一格里熄掉（之后的近景里它会重新亮起来）
    const lit = si < 2 ? 1 : si === 2 ? 1 - seg(u, 0.32, 0.4) : 0;
    const flick = si === 2 && u > 0.26 && u < 0.32 ? 0.45 : 1; // 熄灯前闪一下
    house(g, 1560, 664, 0.36, lit * flick * (0.8 + 0.2 * Math.sin(t * 2)), { glowK: 1.2 });
    pine(g, 1680, 662, 0.3, 813);
    // （不再画 y=905 的那条地面线：01:00 时积雪还没盖过它，会在雪人身后多出一道横线）
    // 雪人
    const X = 760, Y = 960, s = 1.05;
    const shiver = lerp(0.25, 0.9, cont);
    C.snowman(g, X, Y, s, {
      mood: 'sad', look: 0.45, wind: 0.75, shiver, snowCap: ease.out(cont), blush: lerp(0.55, 0.85, cont),
      arms: [lerp(0, -0.25, cont), lerp(0, -0.2, cont)], outline: INK_N, seed: 5,
    });
    hatSnow(g, X, Y, s, 0.45, shiver, ease.out(cont), t, 5);
    armSnow(g, X, Y, s, [lerp(0, -0.25, cont), lerp(0, -0.2, cont)], shiver, t, cont, 330);
    const hd = headOf(X, Y, s, 0.45, 0);
    // 尺子
    const RX = 1170, RY = 960;
    g.line(RX, RY + 20, RX + 3, RY - 300, { color: '#4a3226', width: 13, taper: false, seed: 200 });
    for (let c = 1; c <= 9; c++) {
      const yy = RY - c * 30;
      g.line(RX - 6, yy, RX - (c % 5 === 0 ? 34 : 22), yy, { color: '#2b3157', width: 3, jitter: 0.6, seed: 210 + c });
      if (c % 2 === 0) g.text(String(c * 10), RX - 44, yy, { size: 32, font: 'latin', color: '#2b3157', align: 'right', still: true, pop: false, seed: 220 + c });
    }
    g.ellipse(RX + 2, RY - 304, 16, 7, { color: INK_N, width: 2, fill: SNOW_N, seed: 230 });
    // 积雪（盖住雪人下半身和尺子）
    drift(g, Y + 4, lv, { cx: X, r: 230, pile: 10 + lv * 0.22, amp: 9, seed: 7 + si, color: vgrad(g, Y - lv - 40, Y + 260, '#f1f4fc', '#b4c0de') });
    glints(g, -100, Y + 4 - lv + 30, W + 200, 260, 30, 52 + si, info.boil);
    // 贴地吹雪
    streaks(g, t + 0.7, { count: 22, seed: 44, y: [Y - lv - 50, Y - lv + 30], speed: [600, 1100], len: [40, 140], alpha: 0.55, width: 2.4 });
    // 积雪厚度标注
    const cm = Math.round((lv / 3) * 1);
    const lyY = Y + 4 - lv - 2;
    g.line(RX + 14, lyY - 6, RX + 70, lyY - 56, { color: P.glow, width: 4, seed: 240 });
    g.text(`${cm}cm`, RX + 150, lyY - 86, { size: 64, font: 'latin', color: P.glow, progress: seg(u, 0.05, 0.25), seed: 241 + si, stroke: 'rgba(18,23,41,0.6)', strokeWidth: 8 });
    // 发抖线 + 白气
    shiverMarks(g, hd.hx, hd.hy, hd.r, shiver, info.boil, 250);
    C.breath(g, hd.hx + hd.r * 1.0, hd.mouthY + 4, t * 1.3, { dir: 1, s: 0.75, seed: 260 });
    ctx.restore();

    // 大雪
    g.snow({ count: 230, wind: 230, sway: 14, speed: [70, 150], size: [2, 9], seed: 23 + si });
    streaks(g, t, { count: 18, seed: 45, y: [80, 700], speed: [900, 1400], len: [60, 180], alpha: 0.22 });
    // 左上：时间（每跳一格重新写）
    g.text('凌晨', 150, 96, { size: 44, color: '#c9d3ee', align: 'left', progress: si === 0 ? seg(u, 0, 0.2) : 1, seed: 270 });
    const tw = g.text(cam.time, 146, 186, { size: 132, font: 'latin', color: P.snow, align: 'left', progress: seg(u, 0.02, 0.2), seed: 271 + si, stroke: 'rgba(18,23,41,0.65)', strokeWidth: 10 });
    // 小时针图标
    const clx = 146 + tw + 64, cly = 190;
    g.circle(clx, cly, 34, { color: '#c9d3ee', width: 3.5, seed: 280 });
    const ha = -Math.PI / 2 + ((si + 1) / 12) * Math.PI * 2;
    const ma = -Math.PI / 2 + u * Math.PI * 2;
    g.line(clx, cly, clx + Math.cos(ha) * 18, cly + Math.sin(ha) * 18, { color: '#c9d3ee', width: 4, seed: 281 });
    g.line(clx, cly, clx + Math.cos(ma) * 26, cly + Math.sin(ma) * 26, { color: '#c9d3ee', width: 2.6, seed: 282 });
    vignette(g, 0.3);
  }

  // ================================================================== 5. 近景：望向右边
  function shotClose(g, k, t, info) {
    const ctx = g.ctx;
    const light = ease.out(seg(k, 0.04, 0.1)) * (0.92 + 0.08 * Math.sin(t * 2.4));
    const turn = ease.inOutCubic(seg(k, 0.1, 0.28));
    const push = ease.inOutCubic(seg(k, 0.78, 1));
    // 远处窗户的位置（世界坐标）
    const HX = 1560, HY = 698, HS = 0.62;
    const winX = HX - 22 * HS, winY = HY - 78 * HS * 0.72 + 15 * HS;
    sky(g, t, { colors: [P.nightDeep, P.night, mix('#2f3b69', '#4a4a72', light * 0.6)], stars: 40, yMax: 560, fillTo: 780 });
    ctx.save();
    const z = lerp(1.0, 1.04, k) * Math.pow(4.2, push);
    const camX = lerp(lerp(940, 1000, ease.inOut(k)), winX, ease.inOut(push));
    const camY = lerp(560, winY, ease.inOut(push));
    g.camera(camX, camY, z, 0, 0, 0);
    // 远景
    ground(g, 640, { color: vgrad(g, 590, 720, '#46548a', '#313d6c'), line: 'rgba(25,22,40,0.5)', amp: 26, seed: 19, width: 3 });
    ground(g, 692, { color: vgrad(g, 680, 900, '#8392bf', '#b4c1e0'), line: 'rgba(25,22,40,0.65)', amp: 8, seed: 8, width: 3 });
    pine(g, 1420, 694, 0.45, 821);
    pine(g, 1700, 694, 0.36, 823);
    // 窗光洒在雪地上
    if (light > 0) {
      ctx.save();
      ctx.translate(HX - 10, HY + 20);
      ctx.scale(1, 0.15);
      softGlow(g, 0, 0, 190, P.warm, 0.55 * light);
      ctx.restore();
    }
    // 推镜头时窗光在房子后面越来越亮，房子变成剪影
    if (push > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      softGlow(g, winX, winY - 10, lerp(260, 1150, push) / z, P.warm, 0.6 * push);
      ctx.restore();
    }
    house(g, HX, HY, HS, light, { glowK: 1.5 + light * 0.4 });
    ctx.restore();

    // 雪人（前景，推镜头时往左出画）
    ctx.save();
    const fz = 1 + push * 0.9;
    ctx.translate(-push * 1900, push * 700);
    ctx.translate(560, 1180);
    ctx.scale(fz, fz);
    ctx.translate(-560, -1180);
    const X = 560, Y = 1180, s = 2.3;
    const look = lerp(-0.1, 1, turn) + Math.sin(t * 0.9) * 0.03 * turn;
    const lookUp = 0.12 * turn + (0.5 + 0.5 * Math.sin(t * 1.3)) * 0.05;
    const blink = (k > 0.62 && k < 0.64) || (k > 0.18 && k < 0.195);
    const mood = k < 0.26 ? 'sad' : 'hope';
    const shiver = lerp(0.3, 0.12, turn);
    C.snowman(g, X, Y, s, {
      mood, look, lookUp, wind: 0.35, shiver, snowCap: 1,
      blush: lerp(0.6, 1, seg(k, 0.35, 0.6)), eyesClosed: blink, outline: INK_N, seed: 5,
    });
    hatSnow(g, X, Y, s, look, shiver, 1, t, 7);
    armSnow(g, X, Y, s, [0, 0], shiver, t, 1, 340);
    const hd = headOf(X, Y, s, look, lookUp);
    // 眼睛里映出一点窗光
    if (!blink && light * turn > 0.05) catchlights(g, X, Y, s, look, lookUp, shiver, t, light * turn);
    // 暖光打在右半边脸上
    softGlow(g, hd.hx + hd.r * 1.15, hd.hy, hd.r * 1.4, P.warm, 0.26 * light);
    // 下半身埋在雪里（接上一镜）
    drift(g, Y, 300, { cx: X, r: 420, pile: 40, amp: 12, seed: 31, color: vgrad(g, 820, 1080, '#f1f4fc', '#b4c0de') });
    glints(g, 0, 920, W, 150, 22, 53, info.boil);
    C.breath(g, hd.hx + hd.r * 1.02, hd.mouthY + 8, t * 1.2, { dir: 1, s: 1.2, seed: 290 });
    ctx.restore();

    // 前景虚化雪片（很大、很淡）+ 普通雪
    g.snow({ count: 120, wind: 70, sway: 24, speed: [30, 70], size: [2, 7], seed: 24 });
    g.snow({ count: 14, wind: 50, sway: 40, speed: [40, 80], size: [16, 30], crystal: 999, alpha: 0.3, seed: 25 });

    // 手写竖排：你那里，暖和吗？
    const wr = seg(k, 0.3, 0.52);
    const fade = 1 - seg(k, 0.8, 0.88);
    if (wr > 0 && fade > 0) {
      // 竖排时「，」要贴在上一个字的右下（字体里的逗号在字格左下角，直接竖排会孤零零地掉在下面）
      const TX = 1770, TY = 130, TS = 92, step = TS * 1.05, colGap = TS * 1.4;
      const n = wr * 8;
      const to = { size: TS, vertical: true, color: '#fff4dc', alpha: fade, stroke: 'rgba(18,23,41,0.6)', strokeWidth: 10 };
      g.text('你那里', TX, TY, Object.assign({}, to, { progress: clamp(n / 3), seed: 300 }));
      if (n > 3) g.text('，', TX + TS * 0.36, TY + TS * 0.5 + 2.02 * step, Object.assign({}, to, { progress: clamp(n - 3), seed: 304 }));
      g.text('暖和吗？', TX - colGap, TY, Object.assign({}, to, { progress: clamp((n - 4) / 4), seed: 305 }));
    }
    // 推进暖光：最后整屏被窗光填满（接下一幕「窗」）——光晕跟着窗户在屏幕上的位置走
    if (push > 0) {
      const wsx = (winX - camX) * z + W / 2, wsy = (winY - 10 - camY) * z + H / 2;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      softGlow(g, wsx, wsy, lerp(60, 300, push), P.glow, 0.5 * push);
      ctx.fillStyle = rgba(P.warm, 0.14 * ease.inCubic(seg(push, 0.5, 1)));
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    vignette(g, 0.4 * (1 - push * 0.7));
  }

  TG.scene({
    id: 'cold',
    title: '冷',
    dark: true,
    transition: 'flash',
    chars: '冷风很大你那里暖和吗？，现在体感凌晨-0123456789°Ccm:.',
    lyrics: 'default',
    draw(g, p, t, info) {
      if (p < SH.title) shotTitle(g, seg(p, 0, SH.title), t, info);
      else if (p < SH.wide) shotWide(g, seg(p, SH.title, SH.wide), t, info);
      else if (p < SH.thermo) shotThermo(g, seg(p, SH.wide, SH.thermo), t, info, SH.wide);
      else if (p < SH.bury) shotBury(g, seg(p, SH.thermo, SH.bury), t, info);
      else shotClose(g, seg(p, SH.bury, 1), t, info);
    },
  });
})();
