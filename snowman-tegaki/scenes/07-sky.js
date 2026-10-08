/* 场景：sky —— 缤纷（副歌一）
 *
 * 分镜（按 p 切镜头，任何时长都成立；雪、漩涡、围巾这些固定节奏的动效用 t）：
 *   ① 0.00–0.20  仰望：从雪人背后往上看，雪花从天空中心的月亮朝镜头涌来；左上角写出「冬」
 *   ② 0.20–0.31  漩涡：月亮居中，镜头旋转，雪花卷成漩涡，螺旋线一笔一笔画出来；右上写「白」
 *   ③ 0.31–0.42  推近：猛地推进漩涡中心（集中线），大雪花擦着镜头飞过
 *   ④ 0.42–0.57  张臂：仰拍，月亮像光环挂在雪人身后，他抬起头，"啪"地张开双臂；左边写「静」
 *   ⑤ 0.57–0.71  特写：闭着眼笑，一片雪花落在胡萝卜鼻尖上，呼出白气
 *   ⑥ 0.71–1.00  远景：雪原上小小的雪人张着双臂，「冬」「白」「静」从画面左边缘飘进来，
 *                最后月亮旁边写出暖色的「你」，一片雪花慢慢落进他的树枝手里
 */
(function () {
  'use strict';
  const { clamp, lerp, seg, ease, rand, noise1, rgba } = TG.U;
  const P = TG.PAL, C = TG.C, W = TG.W, H = TG.H;
  const TAU = Math.PI * 2;
  const frac = (v) => v - Math.floor(v);
  const sstep = (a, b, v) => { const k = clamp((v - a) / (b - a)); return k * k * (3 - 2 * k); };

  const CUT = [0, 0.2, 0.31, 0.42, 0.57, 0.71, 1];
  const TINT = [P.snow, '#dbe7ff', '#fff1cf'];       // 雪花略带一点月光的冷 / 暖
  const SHADOW_INK = '#3b4f93';                      // 手写字的套色阴影（蓝）
  const BACK = '#c4cfeb', BACK_DEEP = '#98a7d2';     // 背光一侧的雪

  // ================================================================ 天空 / 光
  function stars(g, t, n, seed, a, maxY) {
    const ctx = g.ctx;
    ctx.save();
    const base = ctx.globalAlpha;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < n; i++) {
      const x = rand(i, seed, 1) * W, y = rand(i, seed, 2) * maxY;
      const tw = 0.5 + 0.5 * Math.sin(t * (1.2 + rand(i, seed, 3) * 2.5) + i * 1.7);
      const r = 0.9 + rand(i, seed, 4) * 1.7;
      ctx.globalAlpha = base * a * (0.2 + 0.8 * tw) * (0.35 + 0.65 * rand(i, seed, 5));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 四角小星芒（闪光） */
  function sparkle(g, x, y, r, color, a) {
    if (a <= 0.01 || r <= 0.5) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r * 0.7, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r * 0.7, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
    ctx.restore();
  }

  /**
   * 大月亮：一层多段渐变的柔光（只填一次，省得叠好几层大渐变）+ 月面 + 月面斑 + 手绘光圈。
   * 月面和 C.moon 满月时一模一样（同样的填色和描边），只是不再叠它自带的那层光。
   */
  function moonBig(g, x, y, r, t, o) {
    o = o || {};
    const ctx = g.ctx;
    const gl = o.glow == null ? 1 : o.glow;
    const R = Math.min(r * 7, 1000);
    const k = (v) => clamp((r * v) / R);
    const gr = ctx.createRadialGradient(x, y, 0, x, y, R);
    gr.addColorStop(0, rgba('#eef2ff', 0.6 * gl));
    gr.addColorStop(k(1.4), rgba('#dde6ff', 0.32 * gl));
    gr.addColorStop(k(3.2), rgba('#7f93d6', 0.22 * gl));
    gr.addColorStop(k(5), rgba('#4b63b6', 0.12 * gl));
    gr.addColorStop(1, rgba('#4b63b6', 0));
    ctx.save();
    ctx.fillStyle = gr;
    ctx.fillRect(x - R, y - R, R * 2, R * 2);
    ctx.restore();
    g.circle(x, y, r, { color: '#e9e4cf', width: 3, fill: '#fbf6dc', seed: 5 });
    ctx.save();
    ctx.fillStyle = '#e7dcb6';
    ctx.globalAlpha *= 0.5;
    [[-0.32, -0.18, 0.22], [0.26, 0.2, 0.15], [-0.04, 0.42, 0.11], [0.36, -0.36, 0.08], [-0.48, 0.28, 0.07]].forEach(([dx, dy, rr]) => {
      ctx.beginPath();
      ctx.ellipse(x + dx * r, y + dy * r, rr * r, rr * r * 0.82, 0.4, 0, TAU);
      ctx.fill();
    });
    ctx.restore();
    if (o.rings !== false) {
      for (let i = 0; i < 3; i++) {
        const rr = r * (1.42 + i * 0.48) + Math.sin(t * 1.3 + i * 2.1) * r * 0.035;
        g.circle(x, y, rr, { color: rgba('#e3ebff', (0.26 - i * 0.07) * (o.ringAlpha == null ? 1 : o.ringAlpha)), width: 2.6, seed: 40 + i });
      }
    }
  }

  /** 前景虚焦的大光斑（景深） */
  function bokeh(g, t, n, seed, a) {
    for (let i = 0; i < n; i++) {
      const r = 40 + rand(i, seed, 1) * 90;
      const y = frac(rand(i, seed, 2) + t * (0.02 + rand(i, seed, 3) * 0.03)) * (H + r * 2) - r;
      const x = rand(i, seed, 4) * W + Math.sin(t * 0.4 + i * 2.3) * 40;
      g.glow(x, y, r, i % 4 === 0 ? '#fff1cf' : '#dbe7ff', a * (0.35 + 0.65 * rand(i, seed, 5)));
    }
  }

  /** 漫画式集中线 */
  function focusLines(g, cx, cy, n, inner, a, seed) {
    if (a <= 0.01) return;
    const ctx = g.ctx, boil = g.info.boil;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = '#eef3ff';
    for (let i = 0; i < n; i++) {
      const ang = ((i + rand(i, seed, boil)) / n) * TAU;
      const r0 = inner * (1 + rand(i, seed + 1, boil) * 0.6);
      const r1 = 1500, w = 1.5 + rand(i, seed + 2, boil) * 7;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      ctx.beginPath();
      ctx.moveTo(cx + ca * r0, cy + sa * r0);
      ctx.lineTo(cx + ca * r1 - sa * w, cy + sa * r1 + ca * w);
      ctx.lineTo(cx + ca * r1 + sa * w, cy + sa * r1 - ca * w);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 月亮放出的光束（很淡的楔形，慢慢转） */
  function rays(g, cx, cy, t, n, a, seed) {
    const ctx = g.ctx;
    ctx.save();
    const base = ctx.globalAlpha;
    ctx.fillStyle = '#c9d6ff';
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU + t * 0.05 + rand(i, seed, 1) * 0.3;
      const w = 0.025 + rand(i, seed, 2) * 0.05;
      ctx.globalAlpha = base * a * (0.4 + 0.6 * rand(i, seed, 3)) * (0.75 + 0.25 * Math.sin(t * 1.5 + i));
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang - w) * 1800, cy + Math.sin(ang - w) * 1800);
      ctx.lineTo(cx + Math.cos(ang + w) * 1800, cy + Math.sin(ang + w) * 1800);
      ctx.fill();
    }
    ctx.restore();
  }

  // ================================================================ 雪
  /**
   * 从 (cx,cy) 朝镜头涌来的雪。屏幕半径按指数增长（每一段距离停留的时间一样长，
   * 所以中心和画面边缘都有雪），大小和半径成正比（越近越大），带一点拖影。
   * o = {count, seed, speed, twist（螺旋扭转）, layer: 'far'|'near'|'all', alpha}
   */
  const WARP_MAX = 2100;
  function warpPos(cx, cy, R0, ang0, ph, tw) {
    const rad = R0 * Math.exp(ph * Math.log(WARP_MAX / R0));
    const a = ang0 + tw * ph;
    return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, rad];
  }
  function warp(g, cx, cy, t, o) {
    const ctx = g.ctx;
    const n = o.count || 200, seed = o.seed || 7, spd = o.speed || 1, tw = o.twist || 0;
    const layer = o.layer || 'all';
    ctx.save();
    const am = ctx.globalAlpha * (o.alpha == null ? 1 : o.alpha);
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const r1 = rand(i, seed, 1), r2 = rand(i, seed, 2), r3 = rand(i, seed, 3), r4 = rand(i, seed, 4), r5 = rand(i, seed, 5);
      const v = lerp(0.2, 0.36, r1) * spd;
      const ph = frac(r2 + t * v);
      const R0 = lerp(14, 70, r3);
      const [x, y, rad] = warpPos(cx, cy, R0, r4 * TAU, ph, tw);
      const size = Math.min(26, rad * lerp(0.005, 0.014, r5 * r5));
      const near = size > 6;
      if ((layer === 'far' && near) || (layer === 'near' && !near)) continue;
      if (x < -80 || x > W + 80 || y < -80 || y > H + 80) continue;
      const [xp, yp] = warpPos(cx, cy, R0, r4 * TAU, Math.max(0, ph - v * 0.038), tw);
      const col = TINT[i % 7 === 0 ? 2 : i % 3 === 0 ? 1 : 0];
      const A = am * clamp(ph / 0.1) * (0.5 + 0.5 * clamp(size / 4));
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      if (size > 7 && r1 > 0.62) {
        // 近处的大片：六角小冰晶
        const a0 = t * (r5 - 0.5) * 2 + r1 * 6;
        ctx.globalAlpha = A;
        ctx.lineWidth = Math.max(1.5, size * 0.16);
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const a = a0 + (k * Math.PI) / 3;
          ctx.moveTo(x - Math.cos(a) * size, y - Math.sin(a) * size);
          ctx.lineTo(x + Math.cos(a) * size, y + Math.sin(a) * size);
        }
        ctx.stroke();
      } else {
        // 圆圆的雪 + 一点点拖影
        const rr = Math.max(0.9, size * 0.5);
        ctx.globalAlpha = A * 0.28;
        ctx.lineWidth = rr * 1.9;
        ctx.beginPath();
        ctx.moveTo(xp, yp);
        ctx.lineTo(x, y);
        ctx.stroke();
        if (size > 6) {
          ctx.globalAlpha = A * 0.25;
          ctx.beginPath();
          ctx.arc(x, y, rr * 1.8, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = A;
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** 几片手绘的大雪花擦着镜头飞过（同样从 (cx,cy) 涌出） */
  function rushFlakes(g, cx, cy, t, n, seed, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const v = 0.2 + rand(i, seed, 1) * 0.1;
      const ph = frac(rand(i, seed, 2) + t * v);
      if (ph < 0.5) continue;
      const [x, y, rad] = warpPos(cx, cy, 40 + rand(i, seed, 3) * 40, rand(i, seed, 4) * TAU, ph, o.twist || 0);
      const r = Math.min(150, rad * 0.06);
      if (x < -r || x > W + r || y < -r || y > H + r) continue;
      g.ctx.save();
      g.ctx.globalAlpha *= clamp((ph - 0.5) / 0.12) * 0.95;
      C.flake(g, x, y, r, { rot: t * 0.8 + i, color: i % 3 === 2 ? '#fff4dc' : '#f4f8ff', width: Math.max(2, r * 0.075), seed: seed + i * 10 });
      g.ctx.restore();
    }
  }

  /** 漩涡上某条旋臂在半径 rad 处的角度（对数螺线） */
  function armAngle(k, A, rad, r0, tw, base) {
    return (k * TAU) / A + base + tw * Math.log(rad / r0);
  }

  /**
   * 雪花漩涡：A 条对数螺线旋臂，雪沿着旋臂往外流、整体旋转。
   * o = {arms, per, seed, r0, r1, twist, spin（rad/s）, flow, alpha, scatter}
   */
  function vortex(g, cx, cy, t, o) {
    const ctx = g.ctx;
    const A = o.arms || 5, M = o.per || 40, seed = o.seed || 11;
    const r0 = o.r0 || 130, r1 = o.r1 || 1300, tw = o.twist || 1.1;
    const om = o.spin == null ? 0.45 : o.spin, flow = o.flow == null ? 0.06 : o.flow;
    const sc = o.scatter == null ? 0.55 : o.scatter;
    const base = om * t + (o.rot || 0);
    ctx.save();
    const am = ctx.globalAlpha * (o.alpha == null ? 1 : o.alpha);
    ctx.lineCap = 'round';
    for (let k = 0; k < A; k++) {
      for (let j = 0; j < M; j++) {
        const i = k * M + j;
        const ra = rand(i, seed, 1), rb = rand(i, seed, 2), rc = rand(i, seed, 3), rd = rand(i, seed, 4);
        const u = frac(j / M + ra / M + t * flow * (0.7 + 0.6 * rb));
        const rad = r0 * Math.pow(r1 / r0, u);
        const spread = (rc - 0.5) * sc * (0.35 + u);
        const ang = armAngle(k, A, rad, r0, tw, base) + spread;
        const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
        if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
        const size = lerp(2, 10, u) * (0.55 + 0.9 * rd);
        const len = Math.abs(om) * rad * 0.08 + 2;
        const dir = om >= 0 ? 1 : -1;
        const tx = -Math.sin(ang) * dir, ty = Math.cos(ang) * dir;
        const col = TINT[i % 9 === 0 ? 2 : i % 4 === 0 ? 1 : 0];
        const A2 = am * clamp(u / 0.1) * (1 - sstep(0.86, 1, u)) * (0.5 + 0.5 * rd);
        const rr = size * 0.5;
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.globalAlpha = A2 * 0.26;
        ctx.lineWidth = rr * 1.9;
        ctx.beginPath();
        ctx.moveTo(x - tx * len, y - ty * len);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.globalAlpha = A2;
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** 漩涡的手绘螺旋线（一笔画出来） */
  function spiralInk(g, cx, cy, t, o) {
    const A = o.arms || 5, r0 = o.r0 || 130, r1 = o.r1 || 1300, tw = o.twist || 1.1;
    const base = (o.spin == null ? 0.45 : o.spin) * t + (o.rot || 0) + (o.offset || 0.16);
    for (let k = 0; k < A; k++) {
      const pts = [];
      for (let q = 0; q <= 20; q++) {
        const rad = r0 * 1.05 * Math.pow((r1 * 0.75) / (r0 * 1.05), q / 20);
        const a = armAngle(k, A, rad, r0, tw, base);
        pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
      }
      g.curve(pts, { color: o.color || rgba('#dfe8ff', 0.4), width: o.width || 4.5, progress: o.progress, seed: 60 + k, taperLen: 120, alpha: o.alpha });
      if (o.double) g.curve(pts.map((p, q) => [p[0] + Math.cos(q) * 8, p[1] + Math.sin(q) * 8]), { color: rgba('#dfe8ff', 0.18), width: 2, progress: o.progress, seed: 70 + k, alpha: o.alpha });
    }
  }

  // ================================================================ 手写单字
  /**
   * 一个字：沿对角线从左上往右下"写"出来。
   * 擦出的边缘分三档透明度（软边），柔光不裁剪；带蓝色套色阴影。
   */
  function writeChar(g, ch, x, y, size, k, o) {
    if (k <= 0) return;
    o = o || {};
    const ctx = g.ctx;
    const a = o.alpha == null ? 1 : o.alpha;
    if (o.glow !== false) g.glow(x, y, size * 0.95, o.glowColor || '#cfdcff', 0.14 * a * clamp(k * 1.5));
    const opt = {
      size, font: o.font || 'brush', color: o.color || '#f6f8ff', pop: false, alpha: a,
      rot: o.rot || 0, seed: o.seed || 3,
      shadow: { color: o.shadow || SHADOW_INK, dx: size * 0.045, dy: size * 0.045 },
    };
    if (k >= 1) {
      g.text(ch, x, y, opt);
      return;
    }
    const nx = 0.42, ny = 0.91, L = size * 3;
    const d0 = lerp(-size * 0.75, size * 0.85, ease.inOut(k));
    const jit = (rand(g.info.boil, 7) - 0.5) * size * 0.05;
    // 三条带：已写完（实）→ 笔尖附近（半透明）→ 刚落笔（很淡）
    [[-L, d0, 1], [d0, d0 + size * 0.09, 0.5], [d0 + size * 0.09, d0 + size * 0.18, 0.2]].forEach(([dA, dB, al]) => {
      const ax = x + nx * dA, ay = y + ny * dA, bx = x + nx * dB, by = y + ny * dB;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ax - ny * L, ay + nx * L);
      ctx.lineTo(ax + ny * L, ay - nx * L);
      ctx.lineTo(bx + ny * L + jit, by - nx * L);
      ctx.lineTo(bx - ny * L - jit, by + nx * L);
      ctx.closePath();
      ctx.clip();
      g.text(ch, x, y, Object.assign({}, opt, { alpha: a * al }));
      ctx.restore();
    });
  }

  // ================================================================ 雪人背影（"我"从背后看）
  function scarfTail(g, x0, y0, s, t, wind, seed, dir) {
    const n = 8, L = lerp(150, 270, wind) * s;
    const top = [], bot = [], mid = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const wav = Math.sin(t * 7 - u * 4.4 + seed) * lerp(3, 22, u) * s * (0.4 + wind);
      const cx = x0 + dir * u * L, cy = y0 + u * lerp(130, 40, wind) * s + wav;
      const hw = lerp(19, 15, u) * s;
      top.push([cx, cy - hw]);
      bot.push([cx, cy + hw]);
      mid.push([cx, cy]);
    }
    g.path(top.concat(bot.slice().reverse()), { closed: true, smooth: true, color: P.ink, width: 4 * s, fill: P.red, seed });
    for (let i = 1; i < n; i += 2) g.line(top[i][0] + 3 * s, top[i][1] + 5 * s, bot[i][0] - 3 * s, bot[i][1] - 5 * s, { color: P.redDeep, width: 2.6 * s, seed: seed + 5 + i });
    const e = mid[n];
    for (let f = 0; f < 4; f++) {
      const fy = lerp(top[n][1], bot[n][1], (f + 0.5) / 4);
      g.line(e[0], fy, e[0] + dir * (16 + 8 * wind) * s, fy + (6 + Math.sin(t * 9 + f) * 6) * s, { color: P.redDeep, width: 3 * s, seed: seed + 20 + f });
    }
  }

  function crescent(g, cx, cy, rx, ry, a0, a1, color, seed) {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = lerp(a0, a1, i / 16);
      pts.push([cx + Math.cos(a) * rx * 0.94, cy + Math.sin(a) * ry * 0.94]);
    }
    const am = (a0 + a1) / 2, ox = -Math.cos(am) * rx * 0.12, oy = -Math.sin(am) * ry * 0.12;
    for (let i = 16; i >= 0; i--) {
      const a = lerp(a0 + 0.25, a1 - 0.25, i / 16);
      pts.push([cx + Math.cos(a) * rx * 0.74 + ox * 0.2, cy + Math.sin(a) * ry * 0.74 + oy * 0.2]);
    }
    g.fill(pts, color, { seed, jitter: 1.2 });
  }

  function rim(g, cx, cy, rx, ry, a0, a1, s, seed) {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const a = lerp(a0, a1, i / 14);
      pts.push([cx + Math.cos(a) * rx * 0.9, cy + Math.sin(a) * ry * 0.9]);
    }
    g.curve(pts, { color: '#ffffff', width: 7 * s, seed, alpha: 0.95, taperLen: 60 * s });
  }

  /** 帽顶积雪（和 C.hat 同一套坐标：(x,y) 帽檐中心，rot 旋转）。amt 0..1 */
  function hatSnow(g, x, y, s, rot, amt, seed) {
    if (amt <= 0) return;
    const ctx = g.ctx;
    const h = lerp(6, 26, amt) * s;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    g.path([[-44 * s, -76 * s], [-34 * s, -78 * s - h * 0.8], [-6 * s, -80 * s - h], [24 * s, -80 * s - h * 0.85], [44 * s, -77 * s], [40 * s, -73 * s], [-40 * s, -72 * s]], {
      closed: true, smooth: true, color: P.ink, width: 3.2 * s, fill: '#ffffff', seed,
    });
    g.line(-20 * s, -78 * s - h * 0.6, 4 * s, -80 * s - h * 0.8, { color: P.snowShade, width: 2.4 * s, seed: seed + 1, alpha: 0.8 });
    ctx.restore();
  }

  /** 雪人背影。(x,y) 是脚底；o = {lookUp, arms, wind, t, seed}；月光从右上方来 */
  function snowmanBack(g, x, y, s, o) {
    const t = o.t == null ? g.info.songTime : o.t;
    const up = clamp(o.lookUp || 0);
    const seed = o.seed | 0, ink = P.ink, lw = 4.8 * s;
    const bodyRx = 132 * s, bodyRy = 118 * s, bodyCy = y - bodyRy;
    const headR = 80 * s;
    const headCx = x + up * 8 * s, headCy = bodyCy - bodyRy * 0.82 - headR * 0.92 + up * 12 * s;
    // 手臂（树枝）
    const arms = o.arms || [0, 0];
    [-1, 1].forEach((side, k) => {
      const raise = arms[k] || 0;
      const bx = x + side * bodyRx * 0.86, by = bodyCy - bodyRy * 0.35;
      const A = side === -1 ? Math.PI + 0.45 + raise : -0.45 - raise;
      const L = 120 * s;
      const ex = bx + Math.cos(A) * L, ey = by + Math.sin(A) * L;
      g.line(bx, by, ex, ey, { color: P.woodDark, width: 6 * s, seed: seed + 10 + k });
      const mx = bx + Math.cos(A) * L * 0.62, my = by + Math.sin(A) * L * 0.62;
      g.line(mx, my, mx + Math.cos(A - side * 0.6) * 38 * s, my + Math.sin(A - side * 0.6) * 38 * s, { color: P.woodDark, width: 4 * s, seed: seed + 12 + k });
      g.line(ex, ey, ex + Math.cos(A + side * 0.5) * 26 * s, ey + Math.sin(A + side * 0.5) * 26 * s, { color: P.woodDark, width: 3.5 * s, seed: seed + 14 + k });
      g.line(ex, ey, ex + Math.cos(A - side * 0.45) * 22 * s, ey + Math.sin(A - side * 0.45) * 22 * s, { color: P.woodDark, width: 3, seed: seed + 16 + k });
    });
    // 身体
    g.ellipse(x, bodyCy, bodyRx, bodyRy, { color: ink, width: lw, fill: BACK, seed: seed + 20 });
    crescent(g, x, bodyCy, bodyRx, bodyRy, 1.0, 3.7, rgba(BACK_DEEP, 0.85), seed + 21);
    rim(g, x, bodyCy, bodyRx, bodyRy, -1.55, -0.15, s, seed + 22);
    // 头
    g.circle(headCx, headCy, headR, { color: ink, width: lw, fill: BACK, seed: seed + 30 });
    crescent(g, headCx, headCy, headR, headR, 1.1, 3.6, rgba(BACK_DEEP, 0.85), seed + 31);
    rim(g, headCx, headCy, headR, headR, -1.75, -0.1, s, seed + 32);
    // 帽子（抬头时往后仰）+ 帽顶上的一小堆雪
    const hx = headCx + 4 * s, hy = headCy - headR * 0.86 + up * 6 * s, hr = 0.1 + up * 0.12;
    C.hat(g, hx, hy, s, hr, { seed: seed + 40 });
    hatSnow(g, hx, hy, s, hr, o.hatSnow == null ? 0.7 : o.hatSnow, seed + 41);
    // 围巾：尾巴被风吹向右边，然后是绕脖子的一圈
    const nx = lerp(headCx, x, 0.35), ny = lerp(headCy + headR * 0.85, bodyCy - bodyRy * 0.8, 0.5);
    scarfTail(g, nx + 70 * s, ny + 14 * s, s, t, o.wind == null ? 0.6 : o.wind, seed + 50, 1);
    const band = [[88, -10], [40, 6], [-20, 8], [-84, -8], [-90, 18], [-30, 36], [36, 34], [92, 14]].map((q) => [nx + q[0] * s, ny + q[1] * s]);
    g.curve(band, { color: ink, width: 4.2 * s, fill: P.red, closed: true, seed: seed + 60 });
    for (let k = 0; k < 5; k++) {
      const bx = nx + (-62 + k * 30) * s;
      g.line(bx, ny + 2 * s, bx + 6 * s, ny + 26 * s, { color: P.redDeep, width: 2.6 * s, seed: seed + 61 + k });
    }
  }

  // ================================================================ 远景道具
  function hillBand(g, y0, amp, freq, seed, color) {
    const pts = [[-40, H + 40]];
    for (let x = -40; x <= W + 40; x += 60) pts.push([x, y0 + noise1(x / freq, seed) * amp]);
    pts.push([W + 40, H + 40]);
    g.fill(pts, color, { seed, jitter: 1 });
  }

  /** 雪原：渐变填色 + 只描上沿一条线（不描两侧和底边） */
  function snowField(g, y0, amp, freq, seed, top, bottom) {
    const ctx = g.ctx;
    const edge = [];
    for (let x = -60; x <= W + 60; x += 120) edge.push([x, y0 + noise1(x / freq, seed) * amp]);
    const smooth = TG.U.catmull(edge, false);
    const gr = ctx.createLinearGradient(0, y0 - amp, 0, H);
    gr.addColorStop(0, top);
    gr.addColorStop(1, bottom);
    g.fill(smooth.concat([[W + 60, H + 60], [-60, H + 60]]), gr, { seed, jitter: 0.6 });
    g.curve(edge, { color: rgba(P.ink, 0.75), width: 3.5, seed: seed + 1 });
  }

  function pine(g, x, y, h, color, seed) {
    const w = h * 0.4, ln = rgba(P.ink, 0.55);
    g.poly([[x - w, y], [x, y - h * 0.62], [x + w, y]], { color: ln, width: 2, fill: color, seed, jitter: 0.8 });
    g.poly([[x - w * 0.78, y - h * 0.32], [x, y - h * 0.88], [x + w * 0.78, y - h * 0.32]], { color: ln, width: 2, fill: color, seed: seed + 1, jitter: 0.8 });
    g.poly([[x - w * 0.55, y - h * 0.6], [x, y - h * 1.1], [x + w * 0.55, y - h * 0.6]], { color: ln, width: 2, fill: color, seed: seed + 2, jitter: 0.8 });
    g.path([[x - w * 0.32, y - h * 0.9], [x, y - h * 1.1], [x + w * 0.32, y - h * 0.9]], { color: '#e9efff', width: 3.2, seed: seed + 3, jitter: 0.6, alpha: 0.9 });
  }

  /** 一小丛松树（远景剪影，树梢带雪） */
  function pines(g, x, y, n, h, color, seed) {
    for (let i = 0; i < n; i++) {
      const px = x + (i - (n - 1) / 2) * h * 0.5 + (rand(i, seed, 1) - 0.5) * h * 0.2;
      pine(g, px, y + rand(i, seed, 3) * 8, h * (0.55 + 0.6 * rand(i, seed, 2)), color, seed + i * 5);
    }
  }

  /** 烟囱的炊烟（一圈一圈往上飘） */
  function smoke(g, x, y, t, s) {
    const ctx = g.ctx;
    for (let k = 0; k < 4; k++) {
      const ph = frac(t * 0.28 + k / 4);
      ctx.save();
      ctx.globalAlpha *= (1 - ph) * 0.6 * clamp(ph / 0.1);
      g.circle(x + Math.sin(ph * 4 + k) * 8 * s + ph * 40 * s, y - ph * 130 * s, lerp(6, 20, ph) * s, { color: 'rgba(220,228,250,0.8)', width: 2.2, fill: 'rgba(200,210,240,0.35)', seed: 90 + k });
      ctx.restore();
    }
  }

  /** "你"家：远处的小房子，一扇暖光的窗，烟囱冒着烟 */
  function house(g, x, y, s, t) {
    const ink = P.ink;
    g.glow(x - 20 * s, y - 50 * s, 230 * s, P.warm, 0.2 + 0.04 * Math.sin(t * 2));
    smoke(g, x + 40 * s, y - 154 * s, t, s);
    g.poly([[x - 70 * s, y], [x - 70 * s, y - 82 * s], [x + 70 * s, y - 82 * s], [x + 70 * s, y]], { color: ink, width: 3, fill: '#2b3157', seed: 81 });
    g.poly([[x + 30 * s, y - 100 * s], [x + 30 * s, y - 150 * s], [x + 50 * s, y - 150 * s], [x + 50 * s, y - 88 * s]], { color: ink, width: 3, fill: '#2b3157', seed: 82 });
    g.poly([[x - 92 * s, y - 76 * s], [x, y - 148 * s], [x + 92 * s, y - 76 * s]], { color: ink, width: 3, fill: '#3a4372', seed: 83 });
    g.path([[x - 98 * s, y - 72 * s], [x - 60 * s, y - 112 * s], [x, y - 156 * s], [x + 60 * s, y - 112 * s], [x + 100 * s, y - 70 * s], [x + 60 * s, y - 92 * s], [x, y - 132 * s], [x - 60 * s, y - 92 * s]], { closed: true, smooth: true, color: ink, width: 3, fill: P.snow, seed: 84 });
    g.glow(x - 22 * s, y - 44 * s, 80 * s, P.glow, 0.55);
    g.rect(x - 44 * s, y - 64 * s, 44 * s, 40 * s, { color: ink, width: 3, fill: P.warm, seed: 85 });
    g.line(x - 22 * s, y - 64 * s, x - 22 * s, y - 24 * s, { color: ink, width: 2.5, seed: 86 });
    g.line(x - 44 * s, y - 44 * s, x, y - 44 * s, { color: ink, width: 2.5, seed: 87 });
    g.rect(x + 22 * s, y - 52 * s, 28 * s, 52 * s, { color: ink, width: 3, fill: '#5a3b38', seed: 88 });
    // 门前的一点暖光洒在雪上
    g.glow(x - 22 * s, y + 10 * s, 90 * s, P.warm, 0.25);
  }

  /** 带墨线描边的雪花（白色在白底上也看得清） */
  function inkedFlake(g, x, y, r, rot, seed) {
    C.flake(g, x, y, r, { rot, color: P.ink, width: Math.max(3, r * 0.13) + 3.5, seed, jitter: 0.5 });
    C.flake(g, x, y, r, { rot, color: '#ffffff', width: Math.max(3, r * 0.13), seed, jitter: 0.5, fill: '#ffffff' });
  }

  // ================================================================ 镜头
  /** ① 仰望：从雪人背后往上看，雪花从天空中心的月亮朝镜头涌来 */
  function shotLookUp(g, k, t) {
    const ctx = g.ctx;
    const VP = [1220, 300];
    const kk = ease.inOut(k);
    g.bg(['#0a0e1f', '#121933', '#1e2850', '#34437c']);
    g.glow(VP[0], VP[1], 1000, '#4660b2', 0.38);
    g.glow(VP[0], VP[1], 420, '#d6e1ff', 0.2);
    stars(g, t, 80, 3, 0.8, H * 0.75);
    ctx.save();
    // 镜头：慢慢往上摇、推向月亮（雪人被推出画面左下）
    g.camera(VP[0], VP[1], lerp(1, 1.1, kk), lerp(0.02, -0.03, kk), VP[0] - W / 2, VP[1] - H / 2 + lerp(0, 40, kk));
    rays(g, VP[0], VP[1], t, 18, 0.06, 2);
    moonBig(g, VP[0], VP[1], 62, t, { glow: 0.9, ringAlpha: 0.7 });
    const twist = lerp(0.3, 1.6, kk);
    warp(g, VP[0], VP[1], t, { count: 420, seed: 7, twist, layer: 'far', speed: lerp(0.9, 1.25, kk) });
    // 背光的雪人：抬头、手臂慢慢抬起
    g.glow(540, 740, 560, '#8fa6e8', 0.18);
    const up = ease.inOut(seg(k, 0.1, 0.8));
    const raise = lerp(-0.15, 0.3, ease.inOut(seg(k, 0.3, 1)));
    snowmanBack(g, 440, 1225, 1.75, { lookUp: up, arms: [raise, raise + 0.05], wind: 0.65, seed: 3 });
    warp(g, VP[0], VP[1], t, { count: 420, seed: 7, twist, layer: 'near', speed: lerp(0.9, 1.25, kk) });
    rushFlakes(g, VP[0], VP[1], t, 6, 21, { twist });
    ctx.restore();
    // 「冬」
    const w = seg(k, 0.06, 0.24);
    writeChar(g, '冬', 250 + k * 30, 250 + k * 22, 200, w, { rot: -0.06, seed: 1 });
  }

  /** ②③ 漩涡：月亮居中，镜头旋转；punch=true 时是猛推进的那一镜 */
  function shotVortex(g, k, t, ts, punch) {
    const ctx = g.ctx;
    const cx = W / 2, cy = 500;
    const kk = ease.inOut(k);
    // 径向天空（以月亮为中心，旋转看不出接缝）
    const gr = ctx.createRadialGradient(cx, cy, 60, cx, cy, 1250);
    gr.addColorStop(0, '#5a6fb8');
    gr.addColorStop(0.25, '#2c3a70');
    gr.addColorStop(0.6, '#161d3a');
    gr.addColorStop(1, '#090c1a');
    ctx.save();
    ctx.fillStyle = gr;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.restore();
    const zoom = punch ? lerp(1.75, 2.05, ease.out(k)) : lerp(1, 1.16, kk);
    const rot = punch ? lerp(0.55, 0.95, ease.out(k)) : lerp(-0.25, 0.5, kk);
    const sh = punch ? g.shake(14 * (1 - clamp(ts / 0.4))) : [0, 0];
    ctx.save();
    g.camera(cx, cy, zoom, rot, sh[0], sh[1]);
    stars(g, t, 60, 9, 0.6, H);
    moonBig(g, cx, cy, 118, t, { glow: 1 });
    const V = { arms: 5, per: punch ? 56 : 66, seed: 11, r0: 150, r1: punch ? 900 : 1300, twist: 1.25, spin: 0.55, flow: 0.07, scatter: 0.5 };
    spiralInk(g, cx, cy, t, Object.assign({}, V, { progress: punch ? 1 : ease.out(seg(k, 0, 0.55)), width: 5, double: true }));
    vortex(g, cx, cy, t, V);
    // 旋臂上的手绘大雪花
    for (let i = 0; i < (punch ? 7 : 10); i++) {
      const u = frac(rand(i, 31, 1) + t * 0.05);
      const rad = 170 * Math.pow((punch ? 820 : 1150) / 170, u);
      const a = armAngle(i % 5, 5, rad, V.r0, V.twist, V.spin * t) + (rand(i, 31, 2) - 0.5) * 0.3;
      const r = lerp(12, 46, u) * (0.7 + 0.5 * rand(i, 31, 3));
      ctx.save();
      ctx.globalAlpha *= clamp(u / 0.15) * (1 - sstep(0.85, 1, u));
      C.flake(g, cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, r, { rot: t * 0.9 + i, color: '#f4f8ff', width: Math.max(2, r * 0.08), seed: 300 + i * 9 });
      ctx.restore();
    }
    ctx.restore();
    // 前景：从中心冲出来的雪（不随镜头转，更有速度感）
    warp(g, cx, cy, t, { count: punch ? 220 : 110, seed: 17, twist: punch ? 1.4 : 0.9, speed: punch ? 1.5 : 1, alpha: 0.9 });
    if (punch) {
      rushFlakes(g, cx, cy, t, 5, 51, { twist: 1.2 });
      focusLines(g, cx, cy, 70, 330, lerp(0.55, 0.12, ease.out(clamp(ts / 1.2))), 5);
    }
    // 「白」
    const w = punch ? 1 : seg(k, 0.25, 0.75);
    const drift = punch ? 1 + k * 0.5 : k;
    writeChar(g, '白', 1650 - drift * 26, 250 - drift * 20, punch ? 210 : 190, w, { rot: 0.07, seed: 2 });
  }

  /** ④ 张臂：仰拍，月亮像光环挂在身后，雪人抬头、"啪"地张开双臂 */
  function shotOpen(g, k, t) {
    const ctx = g.ctx;
    const X = 960, Y = 1080, S = 1.3;
    g.bg(['#0a0e1f', '#141b38', '#24305e', '#3a4a86']);
    stars(g, t, 70, 13, 0.7, H * 0.6);
    const zoom = lerp(1.0, 1.07, ease.inOut(k));
    ctx.save();
    g.camera(X, 760, zoom, 0, 0, 760 - H / 2 + lerp(10, -10, k));
    const MX = 960, MY = 640, MR = 236;
    rays(g, MX, MY, t, 16, 0.05, 6);
    vortex(g, MX, MY, t, { arms: 5, per: 36, seed: 23, r0: MR * 1.15, r1: 1250, twist: 1.2, spin: 0.35, flow: 0.05, alpha: 0.95 });
    spiralInk(g, MX, MY, t, { arms: 5, r0: MR * 1.15, r1: 1250, twist: 1.2, spin: 0.35, width: 4, alpha: 0.75 });
    moonBig(g, MX, MY, MR, t, { glow: 0.8, ringAlpha: 0.8 });
    g.snow({ t, count: 90, seed: 31, speed: [50, 120], size: [2, 7], wind: 20, alpha: 0.85 });
    // 地面
    g.path([[-40, 1000], [300, 990], [700, 1004], [1200, 996], [1600, 1006], [1960, 994], [1960, 1200], [-40, 1200]], { closed: true, smooth: true, color: P.ink, width: 4, fill: '#dfe6f7', seed: 91, overshoot: false });
    // 雪人：先抬头 → 双臂"啪"地张开 → 笑
    const up = ease.inOut(seg(k, 0.0, 0.35));
    const open = seg(k, 0.3, 0.62);
    const raise = lerp(-0.7, 0.42, ease.outBack(open));
    const mood = open > 0.45 ? 'happy' : up > 0.6 ? 'hope' : 'calm';
    const headY = Y - 288.4 * S;
    g.glow(X, headY, 320, '#ffffff', 0.14);
    C.snowman(g, X, Y, S, { mood, lookUp: up, arms: [raise, raise], wind: 0.55, blush: lerp(0.5, 1, open), seed: 7 });
    // 张臂那一下：放射的短线 + 星芒
    const burst = seg(k, 0.36, 0.7);
    if (burst > 0 && burst < 1) {
      for (let i = 0; i < 14; i++) {
        const a = -Math.PI + (i / 13) * Math.PI + (rand(i, 4) - 0.5) * 0.15;
        const r0 = lerp(250, 360, ease.out(burst)), len = lerp(80, 12, burst) * (0.7 + 0.6 * rand(i, 5));
        g.line(X + Math.cos(a) * r0, headY + Math.sin(a) * r0, X + Math.cos(a) * (r0 + len), headY + Math.sin(a) * (r0 + len), { color: '#ffffff', width: 5.5, alpha: 1 - burst, seed: 120 + i });
      }
    }
    for (let i = 0; i < 6; i++) {
      const tw = Math.sin(t * 5 + i * 2.1);
      const a = -Math.PI * 0.92 + i * 0.5;
      sparkle(g, X + Math.cos(a) * (330 + (i % 2) * 70), headY + Math.sin(a) * (300 + (i % 2) * 50), 16 + 10 * tw, '#ffffff', sstep(0.45, 0.7, k) * (0.5 + 0.5 * tw));
    }
    g.snow({ t, count: 18, seed: 33, speed: [140, 220], size: [9, 16], wind: 30, alpha: 0.75, crystal: 11 });
    ctx.restore();
    g.vignette(0.35, '#05070f');
    // 「静」
    writeChar(g, '静', 230, 330 + k * 26, 200, seg(k, 0.12, 0.45), { rot: -0.05, seed: 4 });
  }

  /** ⑤ 特写：闭眼笑，一片雪落在胡萝卜鼻子上，帽顶积雪，呼出白气 */
  function shotClose(g, k, t) {
    const ctx = g.ctx;
    g.bg(['#0d1228', '#1a2348', '#2e3c74']);
    g.glow(1550, 100, 950, '#5d74c4', 0.42);
    g.glow(1550, 100, 360, '#e3ebff', 0.25);
    bokeh(g, t, 9, 41, 0.16);
    g.snow({ t, count: 120, seed: 43, speed: [40, 100], size: [2, 6], wind: 12, alpha: 0.8 });
    const S = 2.75, HX = 860, HY = 515;
    const Y = HY + 288.36 * S;
    const dy = lerp(14, -18, ease.inOut(k));
    ctx.save();
    g.camera(HX, 520, lerp(1, 1.05, k), lerp(-0.012, 0.012, k), HX - W / 2, 520 - H / 2 + dy);
    // 月光从右上打过来的轮廓光
    g.glow(HX + 160, HY - 120, 420, '#dfe8ff', 0.18);
    C.snowman(g, HX, Y, S, { mood: 'happy', eyesClosed: true, lookUp: 1, arms: [0.4, 0.4], wind: 0.5, blush: lerp(0.7, 1, sstep(0.4, 0.8, k)), seed: 7 });
    // 头 / 胡萝卜的位置（和 C.snowman 里的算法一致）
    const headR = 80 * S, headCy = Y - 118 * S - 118 * S * 0.82 - headR * 0.92;
    const ey = -headR * 0.37, fyb = headCy + ey + 18 * S;
    const len = lerp(54, 38, 0.4) * S;
    const tipX = HX + Math.cos(0.18) * len, tipY = fyb + Math.sin(0.18) * len;
    const topX = HX - Math.sin(0.18) * 10 * S, topY = fyb - 10 * S;
    const sitX = lerp(topX, tipX, 0.62), sitY = lerp(topY, tipY, 0.62) - 16;
    // 帽顶越积越多的雪
    hatSnow(g, HX - 6 * S, headCy - headR * 0.86, S, -0.12, lerp(0.15, 1, seg(k, 0.05, 0.95)), 520);
    // 落在鼻子上的那片雪：从上方晃晃悠悠飘下来，落定后闪一下
    const fall = ease.out(seg(k, 0.06, 0.4));
    const fx = lerp(sitX + 160, sitX, fall) + Math.sin(fall * 7) * 30 * (1 - fall);
    const fy = lerp(sitY - 560, sitY, fall);
    inkedFlake(g, fx, fy, 28, (1 - fall) * 4 + 0.3, 501);
    if (fall >= 1) sparkle(g, fx + 30, fy - 30, 18 + 7 * Math.sin(t * 6), '#ffffff', 0.95);
    // 呼出的白气（从脸颊旁往右上飘）
    C.breath(g, HX + headR * 0.82, headCy + 40, t, { dir: 1, s: 1.7, seed: 530 });
    // 脸旁边的小星芒（开心）
    for (let i = 0; i < 3; i++) {
      const tw = Math.sin(t * 4 + i * 2);
      sparkle(g, HX - headR - 60 + i * 26, headCy - 130 + i * 80, 20 + 8 * tw, '#ffffff', 0.6 + 0.4 * tw);
    }
    ctx.restore();
    g.snow({ t, count: 14, seed: 47, speed: [120, 200], size: [10, 18], wind: 25, alpha: 0.7, crystal: 12 });
    bokeh(g, t + 7, 4, 49, 0.12);
    g.vignette(0.4, '#05070f');
  }

  /** ⑥ 远景：雪原上小小的雪人张着双臂；三个字从左边飘进来，最后写出「你」 */
  function shotWide(g, k, t) {
    const ctx = g.ctx;
    const SX = 640, SY = 882, SS = 0.5;
    g.bg(['#090d1e', '#131a36', '#233060', '#3c4c88']);
    stars(g, t, 110, 61, 0.9, 640);
    const pull = ease.out(seg(k, 0, 0.55));
    ctx.save();
    g.camera(lerp(SX + 120, W / 2, pull), lerp(SY - 170, H / 2, pull), lerp(1.45, 1, pull), 0);
    const MX = 1360, MY = 250;
    moonBig(g, MX, MY, 84, t, { glow: 1 });
    const calm = sstep(0, 0.8, k);
    vortex(g, MX, MY, t, { arms: 5, per: 30, seed: 63, r0: 120, r1: 900, twist: 1.2, spin: lerp(0.4, 0.15, calm), flow: 0.04, alpha: lerp(0.7, 0.3, calm) });
    spiralInk(g, MX, MY, t, { arms: 5, r0: 120, r1: 900, twist: 1.2, spin: lerp(0.4, 0.15, calm), width: 3, alpha: lerp(0.55, 0.2, calm) });
    // 远山、松树、"你"家
    hillBand(g, 700, 40, 420, 71, '#27315e');
    pines(g, 150, 716, 3, 110, '#141a36', 700);
    pines(g, 470, 706, 2, 84, '#141a36', 720);
    pines(g, 1010, 714, 4, 96, '#141a36', 740);
    pines(g, 1880, 706, 2, 110, '#141a36', 760);
    house(g, 1600, 742, 0.85, t);
    hillBand(g, 768, 24, 300, 75, '#9fadd8');
    snowField(g, 806, 22, 380, 77, '#b9c6e8', '#eef2fb');
    // 雪原上几道被风吹出来的雪纹
    [[180, 900, 260], [1080, 880, 300], [1420, 960, 340], [320, 1010, 280], [880, 1030, 240]].forEach(([dx, dy, dl], i) => {
      g.curve([[dx, dy], [dx + dl * 0.5, dy - 10], [dx + dl, dy + 2]], { color: rgba('#8e9fcc', 0.45), width: 3, seed: 790 + i });
    });
    // 雪人脚下的一圈月光
    g.glow(SX, SY - 90, 280, '#dfe8ff', 0.32);
    C.snowman(g, SX, SY, SS, { mood: 'happy', eyesClosed: k > 0.3, lookUp: 1, look: 0.35, arms: [0.45, 0.5], wind: 0.75, blush: 1, seed: 7 });
    // 一片雪花慢慢落进他的右手（树枝末端）
    const A = -0.45 - 0.5, bx = SX + 132 * SS * 0.86, by = SY - 118 * SS - 118 * SS * 0.35;
    const hx = bx + Math.cos(A) * 120 * SS, hy = by + Math.sin(A) * 120 * SS - 6;
    const land = ease.out(seg(k, 0.5, 0.92));
    const lx = lerp(hx + 160, hx, land) + Math.sin(land * 8) * 30 * (1 - land), ly = lerp(hy - 420, hy, land);
    g.glow(lx, ly, 60, '#ffffff', 0.25 + 0.15 * land);
    C.flake(g, lx, ly, 14, { rot: (1 - land) * 5, color: '#ffffff', width: 2.8, seed: 801 });
    if (land >= 1) sparkle(g, lx + 14, ly - 16, 12 + 5 * Math.sin(t * 6), '#ffffff', 0.9);
    g.snow({ t, count: 130, seed: 81, speed: [30, 80], size: [2, 6], wind: 14, alpha: 0.85 });
    ctx.restore();
    g.vignette(0.35, '#05070f');
    // 「冬」「白」「静」从左边缘飘进来，竖成一列；然后写出「你」
    const col = [['冬', 0.04], ['白', 0.14], ['静', 0.24]];
    const youK = seg(k, 0.42, 0.66);
    col.forEach(([ch, a0], i) => {
      const e = ease.out(seg(k, a0, a0 + 0.16));
      if (e <= 0) return;
      const x = lerp(-90, 150, e) + Math.sin(t * 0.8 + i * 2) * 6;
      const y = 170 + i * 170 + Math.cos(t * 0.7 + i) * 6;
      writeChar(g, ch, x, y, 130, 1, { alpha: e * lerp(1, 0.55, youK), rot: (1 - e) * -0.4 + (i - 1) * 0.04, seed: 10 + i, glow: false });
    });
    writeChar(g, '你', 1080, 380 + Math.sin(t * 0.9) * 6, 240, youK, { color: '#fff3d8', shadow: '#d4874a', glowColor: '#fff0cc', rot: -0.04, seed: 5 });
  }

  // ================================================================ 场景
  TG.scene({
    id: 'sky',
    title: '缤纷',
    dark: true,
    transition: 'flash',
    chars: '冬白静你',
    draw(g, p, t, info) {
      const dur = info.dur || 16;
      let i = 0;
      while (i < CUT.length - 2 && p >= CUT[i + 1]) i++;
      const k = seg(p, CUT[i], CUT[i + 1]);
      const ts = Math.max(0, t - CUT[i] * dur); // 这个镜头开始后过了几秒
      if (i === 0) shotLookUp(g, k, t);
      else if (i === 1) shotVortex(g, k, t, ts, false);
      else if (i === 2) shotVortex(g, k, t, ts, true);
      else if (i === 3) shotOpen(g, k, t);
      else if (i === 4) shotClose(g, k, t);
      else shotWide(g, k, t);
      // 硬切的瞬间闪一下白（只一两帧）
      if (i > 0 && ts < 0.16) {
        const ctx = g.ctx;
        ctx.save();
        ctx.fillStyle = '#f3f6ff';
        ctx.globalAlpha = (i === 2 ? 0.55 : 0.3) * (1 - ts / 0.16);
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    },
  });
})();
