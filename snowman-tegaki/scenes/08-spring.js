/* 场景：spring —— 春天要来了（副歌一）
 *
 * 镜头（按 p 分段，12～35 秒都成立；光芒、摇摆、雪、滴水这些固定节奏的动效用 t）：
 *   ① 0.00–0.29  日历：墙上的手绘日历 12 月 → 1 月 → 2 月 → 3 月，一页页被撕下来飞走；
 *                每页的日子被飞快地打 ×，右边「第 N 天」跟着跳。纸色和墙色一页比一页暖，雪越下越少；
 *                12.1 画圈、12.24 画心；3 月 20 日被圈出来，镜头扎进角上的小太阳，暖光吞没画面
 *   ② 0.29–0.40  日出：远景，"你"家屋檐的冰柱在滴水，雪地露出一块块泥土，太阳从山后升起，
 *                雪人拖着长长的影子；左上写「3月20日」，「晴」字被圈起来
 *   ③ 0.40–0.53  特写：阳光晒着雪人的脸 → 额角冒出第一滴水 → 他翻眼看见了，慌了
 *                （八字眉、张嘴、树枝手乱挥、「诶?!」）→ 水滴顺着脸颊滑下去
 *   ④ 0.53–0.72  贴地微距：水滴落进雪人脚边的一小块泥土（滴）→ 嫩芽顶出来（噗）→ 长高、打苞、
 *                开出一朵迎春花（花开了）
 *   ⑤ 0.72–0.84  中景：雪人歪着身子低头看花，树枝手轻轻凑过去，花点点头（早安）
 *   ⑥ 0.84–1.00  仰拍：他抬头看太阳，然后笑了；毛笔写出大大的「春」和小字「第 110 天」
 */
(function () {
  'use strict';
  const { clamp, lerp, seg, ease, rand, noise1, mix, rgba } = TG.U;
  const P = TG.PAL, C = TG.C, W = TG.W, H = TG.H;
  const TAU = Math.PI * 2;
  const frac = (v) => v - Math.floor(v);

  const CUT = [0, 0.29, 0.4, 0.53, 0.72, 0.84, 1];

  // ---------------------------------------------------------------- 春天的颜色
  const SUN_LINE = '#e8992f', SUN_RAY = '#f3ae3f';
  const EARTH = '#a8825f', EARTH_WET = '#6f5240', EARTH_LINE = '#5b4334';
  const LEAF = '#93c66c', LEAF_DEEP = '#4d8a50', STEM = '#5e9d55';
  const PETAL = '#ffd43f', PETAL_DEEP = '#f0a51e', PISTIL = '#ef8a2a';
  const SNOW_WARM = '#fbf9f3', SLUSH = '#dce7f2';
  const WATER_LINE = '#6f97c4';

  // ================================================================ 小工具
  function camOn(g, c) {
    g.save();
    g.camera(c.x, c.y, c.z, c.r || 0, c.dx || 0, c.dy || 0);
  }

  /** 雪人头部的位置（与 C.snowman 的算法一致，melt = 0） */
  function headFrame(x, y, s, look) {
    const bodyRy = 118 * s, bodyCy = y - bodyRy, headR = 80 * s;
    return { x, y: bodyCy - bodyRy * 0.82 - headR * 0.92, r: headR, tilt: (look || 0) * 0.06 };
  }

  /** 让雪人绕脚底歪一下身子 */
  function snowmanLean(g, x, y, s, lean, o) {
    const ctx = g.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean);
    ctx.translate(-x, -y);
    C.snowman(g, x, y, s, o);
    ctx.restore();
  }

  /** 四角小星芒 */
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

  /** 从 (cx,cy) 放出去的淡淡光束 */
  function rays(g, cx, cy, t, n, a, color, seed) {
    if (a <= 0.005) return;
    const ctx = g.ctx;
    const sd = seed || 3;
    ctx.save();
    const base = ctx.globalAlpha;
    ctx.fillStyle = color || '#fff3d2';
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU + t * 0.05 + rand(i, sd, 1) * 0.25;
      const w = 0.03 + rand(i, sd, 2) * 0.05;
      ctx.globalAlpha = base * a * (0.45 + 0.55 * rand(i, sd, 3)) * (0.75 + 0.25 * Math.sin(t * 1.3 + i * 1.7));
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang - w) * 2800, cy + Math.sin(ang - w) * 2800);
      ctx.lineTo(cx + Math.cos(ang + w) * 2800, cy + Math.sin(ang + w) * 2800);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** 手绘太阳：多层柔光 + 一长一短转动的光芒 + 描边圆 */
  function sun(g, x, y, r, t, o) {
    o = o || {};
    const ctx = g.ctx;
    const a = o.alpha == null ? 1 : o.alpha;
    g.glow(x, y, r * 8, '#ffcf7a', 0.34 * a);
    g.glow(x, y, r * 3.2, '#fff3cf', 0.65 * a);
    const n = 14, spin = t * 0.22;
    for (let i = 0; i < n; i++) {
      const ang = spin + (i / n) * TAU;
      const long = i % 2 === 0;
      const r0 = r * 1.3, L = r * (long ? 0.62 : 0.36) * (1 + 0.12 * Math.sin(t * 4 + i * 1.3));
      g.line(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0, x + Math.cos(ang) * (r0 + L), y + Math.sin(ang) * (r0 + L), {
        color: SUN_RAY, width: r * (long ? 0.1 : 0.075), seed: 300 + i,
      });
    }
    g.circle(x, y, r, { color: SUN_LINE, width: Math.max(3, r * 0.05), fill: P.sun, seed: 330 });
    ctx.save();
    const gr = ctx.createRadialGradient(x - r * 0.3, y - r * 0.32, r * 0.05, x, y, r);
    gr.addColorStop(0, 'rgba(255,250,226,0.55)');
    gr.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.92, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /** 一条起伏的山 / 雪坡 */
  function hillBand(g, y, amp, freq, fill, seed, o) {
    o = o || {};
    const pts = [[-400, H + 400]];
    for (let x = -400; x <= W + 400; x += 120) pts.push([x, y + noise1(x / freq, seed) * amp]);
    pts.push([W + 400, H + 400]);
    g.path(pts, { closed: true, smooth: true, color: o.line || rgba(P.ink, 0.3), width: o.width || 3, fill, seed, overshoot: false });
  }

  /** 雪化开露出来的一小块泥土 */
  function soilPatch(g, x, y, rx, ry, seed, wet) {
    const pts = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const k = 1 + noise1(i * 0.9 + 0.3, seed) * 0.2;
      pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]);
    }
    g.path(pts.map(([px, py]) => [x + (px - x) * 1.14, y + (py - y) * 1.32]), { smooth: true, closed: true, fill: SLUSH, stroke: false, seed: seed + 1 });
    g.path(pts, { smooth: true, closed: true, color: EARTH_LINE, width: 3, fill: EARTH, seed });
    if (wet > 0) {
      const ctx = g.ctx;
      ctx.save();
      ctx.globalAlpha *= wet;
      g.path(pts.map(([px, py]) => [x + (px - x) * 0.62, y + (py - y) * 0.55]), { smooth: true, closed: true, fill: EARTH_WET, stroke: false, seed: seed + 2 });
      ctx.restore();
    }
  }

  /** 一小撮草 */
  function tuft(g, x, y, s, seed, t) {
    const sw = Math.sin(t * 2 + seed) * 3 * s;
    [[-8, -22, -0.4], [0, -32, 0.05], [9, -20, 0.45]].forEach(([dx, h, lean], j) => {
      g.line(x + dx * s, y, x + dx * s + lean * 22 * s + sw, y + h * s, { color: j === 1 ? LEAF_DEEP : '#6aa65a', width: 3.6 * s, seed: seed + j });
    });
  }

  /** 漂浮的暖色光点（往上飘） */
  function motes(g, t, n, seed, color, a) {
    const ctx = g.ctx;
    ctx.save();
    const base = ctx.globalAlpha;
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const x = rand(i, seed, 1) * W + Math.sin(t * 0.5 + i) * 30;
      const y = H + 20 - frac(rand(i, seed, 2) + t * (0.02 + rand(i, seed, 3) * 0.035)) * (H + 60);
      const r = 2 + rand(i, seed, 4) * 4.5;
      const tw = Math.sin(t * 1.6 + i * 2.1);
      ctx.globalAlpha = base * a * (0.35 + 0.65 * tw * tw);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 飘落的小花瓣 */
  function petals(g, t, n, seed, a) {
    const ctx = g.ctx;
    ctx.save();
    const base = ctx.globalAlpha;
    for (let i = 0; i < n; i++) {
      const sp = 0.05 + rand(i, seed, 3) * 0.05;
      const ph = frac(rand(i, seed, 2) + t * sp);
      const x = W + 80 - frac(rand(i, seed, 1) + t * sp * 0.8) * (W + 160) + Math.sin(t * 1.3 + i) * 40;
      const y = -40 + ph * (H + 80);
      const r = 7 + rand(i, seed, 4) * 6;
      ctx.globalAlpha = base * a;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * (1 + rand(i, seed, 5)) + i);
      ctx.scale(1, 0.45 + 0.4 * Math.abs(Math.sin(t * 2.2 + i)));
      ctx.fillStyle = i % 3 ? PETAL : '#ffe58a';
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.55, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /** 一片叶子：(x,y) 叶柄，ang 叶尖方向 */
  function leaf(g, x, y, len, ang, o) {
    o = o || {};
    if (len < 2) return;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const wd = len * (o.round ? 0.44 : 0.3);
    const pt = (d, s) => [x + ca * d - sa * s, y + sa * d + ca * s];
    const pts = [pt(0, 0), pt(len * 0.32, wd), pt(len * 0.74, wd * 0.78), pt(len, 0), pt(len * 0.74, -wd * 0.78), pt(len * 0.32, -wd)];
    g.path(pts, { smooth: true, closed: true, color: o.line || LEAF_DEEP, width: o.width || 3.4, fill: o.fill || LEAF, seed: o.seed });
    const a = pt(len * 0.1, 0), b = pt(len * 0.78, 0);
    g.line(a[0], a[1], b[0], b[1], { color: LEAF_DEEP, width: Math.max(1.5, (o.width || 3.4) * 0.6), alpha: 0.75, seed: (o.seed | 0) + 1 });
  }

  /** 花：6 瓣的迎春花，open 0..1 一瓣一瓣张开；open 很小时是花苞 */
  function flowerHead(g, x, y, r, open, rot, o) {
    o = o || {};
    const sd = o.seed | 0;
    const lw = Math.max(2.2, r * 0.055);
    if (open < 0.08) {
      // 花苞：绿萼托着黄色的尖
      const b = r * 0.55 * (o.bud == null ? 1 : o.bud);
      if (b < 2) return;
      const ca = Math.cos(rot - Math.PI / 2), sa = Math.sin(rot - Math.PI / 2);
      const pt = (d, s) => [x + ca * d - sa * s, y + sa * d + ca * s];
      g.path([pt(-b * 0.3, 0), pt(b * 0.3, b * 0.45), pt(b * 1.05, b * 0.12), pt(b * 1.25, 0), pt(b * 1.05, -b * 0.12), pt(b * 0.3, -b * 0.45)], { smooth: true, closed: true, color: P.ink, width: lw, fill: PETAL, seed: sd });
      g.path([pt(-b * 0.35, 0), pt(b * 0.15, b * 0.5), pt(b * 0.55, b * 0.3), pt(b * 0.2, 0), pt(b * 0.55, -b * 0.3), pt(b * 0.15, -b * 0.5)], { smooth: true, closed: true, color: LEAF_DEEP, width: lw * 0.8, fill: LEAF, seed: sd + 1 });
      return;
    }
    const n = 6;
    for (let i = 0; i < n; i++) {
      const pk = clamp(open * 1.45 - i * 0.075);
      if (pk <= 0) continue;
      const a = rot - Math.PI / 2 + (i / n) * TAU + 0.26;
      const L = r * ease.outBack(pk);
      const wd = L * 0.5;
      const ca = Math.cos(a), sa = Math.sin(a);
      const pt = (d, s) => [x + ca * d - sa * s, y + sa * d + ca * s];
      g.path([pt(0, 0), pt(L * 0.45, wd * 0.55), pt(L * 0.9, wd * 0.36), pt(L, 0), pt(L * 0.9, -wd * 0.36), pt(L * 0.45, -wd * 0.55)], {
        smooth: true, closed: true, color: P.ink, width: lw, fill: PETAL, seed: sd + 10 + i,
      });
      const v0 = pt(L * 0.25, 0), v1 = pt(L * 0.7, 0);
      g.line(v0[0], v0[1], v1[0], v1[1], { color: PETAL_DEEP, width: lw * 0.75, seed: sd + 20 + i });
    }
    const cr = r * 0.27 * clamp(open * 2);
    if (cr > 1) {
      g.circle(x, y, cr, { color: '#b86418', width: lw * 0.9, fill: PISTIL, seed: sd + 30 });
      const ctx = g.ctx;
      ctx.save();
      ctx.fillStyle = '#fff2b8';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = rot + (i / 5) * TAU;
        ctx.moveTo(x + Math.cos(a) * cr * 0.55 + cr * 0.16, y + Math.sin(a) * cr * 0.55);
        ctx.arc(x + Math.cos(a) * cr * 0.55, y + Math.sin(a) * cr * 0.55, cr * 0.16, 0, TAU);
      }
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * 一株小苗（脚底 (bx,by)，sc=1 时长成后高约 330px）。
   * st = {sprout 0..1 顶出来, grow 0..1 长高, bud 0..1 花苞, bloom 0..1 开花, lean 整体歪, sway 摇摆幅度}
   * 返回花的位置 {x, y, rot}
   */
  const STALK = [[0, 0], [5, -60], [-7, -130], [3, -200], [11, -268], [6, -330]];
  function plant(g, bx, by, sc, st, t) {
    const sp = clamp(st.sprout || 0), gr = clamp(st.grow || 0);
    const hf = 0.26 * ease.outBack(sp) + 0.74 * ease.inOut(gr);
    if (hf <= 0.005) return { x: bx, y: by, rot: 0 };
    const sway = (st.lean || 0) + Math.sin(t * 1.7) * (st.sway == null ? 0.045 : st.sway);
    const pts = STALK.map(([x, y]) => {
      const yy = y * hf * sc, xx = x * Math.min(1, hf * 1.6) * sc;
      const a = sway * (-y / 330);
      return [bx + xx * Math.cos(a) - yy * Math.sin(a), by + xx * Math.sin(a) + yy * Math.cos(a)];
    });
    const along = (f) => {
      const u = clamp(f) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(u)), k = u - i;
      return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)];
    };
    const top = pts[pts.length - 1];
    const lw = Math.max(3, 8 * sc);
    g.curve(pts, { color: STEM, width: lw, seed: 400, taper: false });
    g.curve(pts, { color: '#b8e08e', width: lw * 0.28, alpha: 0.7, seed: 401, taper: false, jitter: 0.8 });
    // 子叶：一直留在它们冒出来的那个高度
    const cf = Math.min(1, 0.26 / hf);
    const cpos = gr > 0 ? along(cf * 0.96) : top;
    const unfold = ease.outBack(seg(sp, 0.35, 1));
    const clen = 50 * sc * lerp(0.5, 1, unfold);
    leaf(g, cpos[0], cpos[1], clen, -Math.PI / 2 - lerp(0.15, 1.15, unfold) + sway, { round: true, seed: 410, width: Math.max(2, 3.4 * sc) });
    leaf(g, cpos[0], cpos[1], clen, -Math.PI / 2 + lerp(0.15, 1.05, unfold) + sway, { round: true, seed: 412, width: Math.max(2, 3.4 * sc) });
    // 真叶
    const tl = ease.outBack(seg(gr, 0.45, 0.85));
    if (tl > 0) {
      const p1 = along(0.55), p2 = along(0.42);
      leaf(g, p1[0], p1[1], 80 * sc * tl, -Math.PI / 2 + 1.0 + sway, { seed: 420, width: Math.max(2, 3.4 * sc) });
      leaf(g, p2[0], p2[1], 70 * sc * tl, -Math.PI / 2 - 1.1 + sway, { seed: 422, width: Math.max(2, 3.4 * sc) });
    }
    const bud = clamp(st.bud || 0), bloom = clamp(st.bloom || 0);
    if (bud > 0 || bloom > 0) flowerHead(g, top[0], top[1], 64 * sc, bloom, sway, { bud, seed: 430 });
    return { x: top[0], y: top[1], rot: sway };
  }

  /** 水花：一圈涟漪 + 几颗溅起的水珠 */
  function splash(g, x, y, k, s) {
    if (k <= 0 || k >= 1) return;
    s = s || 1;
    const e = ease.outCubic(k);
    g.ellipse(x, y, lerp(10, 120, e) * s, lerp(3, 24, e) * s, { color: rgba(WATER_LINE, 1 - k), width: (4 * (1 - k) + 1) * s, seed: 80 });
    g.ellipse(x, y, lerp(4, 70, ease.outCubic(clamp(k * 1.3 - 0.2))) * s, lerp(1, 14, e) * s, { color: rgba(WATER_LINE, 0.7 * (1 - k)), width: 2.5 * s, seed: 81 });
    const ctx = g.ctx;
    ctx.save();
    ctx.fillStyle = P.water;
    ctx.strokeStyle = WATER_LINE;
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.32;
      const v = (120 + rand(i, 5) * 80) * s;
      const px = x + Math.cos(a) * v * k * 1.1, py = y + Math.sin(a) * v * k + 420 * s * k * k;
      if (py > y + 4) continue;
      const r = (4 + rand(i, 6) * 4) * s * (1 - k * 0.5);
      ctx.globalAlpha = 1 - k * 0.6;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 对话气泡（尾巴指向 (tx,ty)），k 弹出进度 */
  function bubble(g, x, y, w, h, tx, ty, k, seed) {
    if (k <= 0) return;
    const ctx = g.ctx;
    const s = ease.outBack(clamp(k));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.translate(-x, -y);
    const pts = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      const kk = 1 + noise1(i * 0.7, seed) * 0.05;
      pts.push([x + Math.cos(a) * (w / 2) * kk, y + Math.sin(a) * (h / 2) * kk]);
    }
    const ang = Math.atan2(ty - y, tx - x);
    const bxp = x + Math.cos(ang) * w * 0.38, byp = y + Math.sin(ang) * h * 0.38;
    const nx = -Math.sin(ang) * 22, ny = Math.cos(ang) * 22;
    g.path(pts, { smooth: true, closed: true, fill: '#fffdf4', color: P.ink, width: 4, seed });
    g.fill([[bxp + nx, byp + ny], [tx, ty], [bxp - nx, byp - ny]], '#fffdf4', { jitter: 0.5, seed: seed + 1 });
    g.line(bxp + nx * 1.05, byp + ny * 1.05, tx, ty, { color: P.ink, width: 4, seed: seed + 2 });
    g.line(bxp - nx * 1.05, byp - ny * 1.05, tx, ty, { color: P.ink, width: 4, seed: seed + 3 });
    ctx.restore();
  }

  /** 毛笔大字：沿对角线"刷"出来 */
  function brushReveal(g, ch, x, y, size, k, o) {
    if (k <= 0) return;
    const ctx = g.ctx;
    ctx.save();
    if (k < 1) {
      const x0 = x - size * 0.6, y0 = y - size * 0.6;
      const s = lerp(0, size * 2.4, ease.inOut(k));
      ctx.beginPath();
      ctx.moveTo(x0 - 3000, y0 + s + 3000);
      ctx.lineTo(x0 + s + 3000, y0 - 3000);
      ctx.lineTo(x0 - 3000, y0 - 3000);
      ctx.closePath();
      ctx.clip();
    }
    g.text(ch, x, y, Object.assign({ pop: false }, o, { size }));
    ctx.restore();
  }

  // ================================================================ ① 日历
  const MONTHS = [
    { n: '12', temp: '-12°C', days: 31, off: 1, d0: 1, paper: '#e8eef8', bg: ['#10152a', '#1c2446', '#2a3663'], dot: '#33406f', pen: '#4f6db4', light: true, doodle: 'flake', snow: 120 },
    { n: '1', temp: '-8°C', days: 31, off: 4, d0: 32, paper: '#f1efe8', bg: ['#262d58', '#3c4479', '#5a5f95'], dot: '#4b558f', pen: '#566db0', light: true, doodle: 'snowman', snow: 70 },
    { n: '2', temp: '-2°C', days: 28, off: 0, d0: 63, paper: '#f8ead4', bg: ['#6f6ca2', '#a291b9', '#ddbab4'], dot: '#b4a6cb', pen: '#7a5fa8', light: true, doodle: 'mitten', snow: 34 },
    { n: '3', temp: '+3°C', days: 31, off: 0, d0: 91, paper: '#fde5b6', bg: ['#fdedc7', '#f9d593', '#f2b46a'], dot: '#f6d7a0', pen: '#e07b2e', light: false, doodle: 'sun', snow: 0, stop: 19, mark: 20 },
  ];
  const CAL = { x: 800, y: 215, w: 600, h: 640 };
  const GX = 28, GW = (CAL.w - 56) / 7, GY = 320, GH = 62;
  const CAMS = [
    { x: 1130, y: 498, z: 1.1, r: -0.025 },
    { x: 1085, y: 520, z: 1.16, r: 0.03 },
    { x: 1175, y: 490, z: 1.12, r: -0.035 },
    { x: 1140, y: 500, z: 1.1, r: 0.012 },
  ];
  const COUNTER_X = 1500;

  function cellXY(M, d) {
    const i = M.off + d - 1;
    return [GX + GW * ((i % 7) + 0.5), GY + GH * (Math.floor(i / 7) + 0.5)];
  }

  function cross(g, M, d, pr, seed) {
    const [cx, cy] = cellXY(M, d);
    const r = 19;
    const a = clamp(pr * 2), b = clamp(pr * 2 - 1);
    if (a > 0) g.line(cx - r, cy - r * 0.8, cx + r, cy + r * 0.85, { color: M.pen, width: 5, progress: a, seed });
    if (b > 0) g.line(cx + r * 0.9, cy - r * 0.85, cx - r * 0.95, cy + r * 0.8, { color: M.pen, width: 5, progress: b, seed: seed + 1 });
  }

  function sunDoodle(g, x, y, r, t, glow) {
    if (glow > 0) {
      g.glow(x, y, r * lerp(2, 14, glow), '#ffc864', 0.85 * glow);
      g.glow(x, y, r * lerp(1.5, 5, glow), '#fff6d6', 0.95 * glow);
      rays(g, x, y, t, 16, 0.45 * glow, '#fff2c4', 77);
    }
    for (let i = 0; i < 10; i++) {
      const a = t * 0.8 + (i / 10) * TAU;
      const r0 = r * 1.3, r1 = r * (i % 2 ? 1.7 : 1.95);
      g.line(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, { color: SUN_RAY, width: 4.5, seed: 950 + i });
    }
    g.circle(x, y, r, { color: SUN_LINE, width: 4, fill: P.sun, seed: 960 });
    // 小笑脸
    g.arc(x - r * 0.33, y - r * 0.08, r * 0.14, Math.PI + 0.3, TAU - 0.3, { color: P.ink, width: 3, seed: 961 });
    g.arc(x + r * 0.33, y - r * 0.08, r * 0.14, Math.PI + 0.3, TAU - 0.3, { color: P.ink, width: 3, seed: 962 });
    g.arc(x, y + r * 0.1, r * 0.3, 0.45, Math.PI - 0.45, { color: P.ink, width: 3, seed: 963 });
  }

  function doodle(g, kind, x, y, t, glow) {
    if (kind === 'flake') C.flake(g, x, y, 54, { color: '#5a7cc0', width: 4.5, rot: t * 0.5, seed: 900, fill: '#dfe8fb' });
    else if (kind === 'snowman') C.snowman(g, x, y + 70, 0.31, { mood: 'calm', seed: 910, blush: 0.7 });
    else if (kind === 'mitten') C.mitten(g, x - 6, y + 48, 0.62, 0.22 + Math.sin(t * 3) * 0.06, { seed: 920 });
    else if (kind === 'sun') sunDoodle(g, x, y, 34 * (1 + 0.5 * (glow || 0)), t, glow || 0);
  }

  /** 画一页日历（局部坐标：左上角 (0,0)） */
  function calPage(g, M, crossN, o) {
    o = o || {};
    const ctx = g.ctx, w = CAL.w, h = CAL.h;
    const sd = o.seed || 0, t = o.t || 0;
    if (o.torn) {
      const pts = [];
      for (let x = 0; x <= w; x += 24) pts.push([x, (x / 24) % 2 ? 9 : -2]);
      pts.push([w, h], [0, h]);
      g.poly(pts, { fill: M.paper, color: P.ink, width: 4, seed: sd });
    } else {
      g.rect(0, 0, w, h, { fill: M.paper, color: P.ink, width: 4, seed: sd });
    }
    // 下沿一点纸的阴影
    ctx.save();
    const gr = ctx.createLinearGradient(0, h - 60, 0, h);
    gr.addColorStop(0, 'rgba(120,90,60,0)');
    gr.addColorStop(1, 'rgba(120,90,60,0.12)');
    ctx.fillStyle = gr;
    ctx.fillRect(4, h - 60, w - 8, 56);
    ctx.restore();
    // 月份
    const wN = g.text(M.n, 40, 140, { align: 'left', size: 200, font: 'brush', color: P.ink, seed: sd + 1 });
    g.text('月', 40 + wN + 14, 180, { align: 'left', size: 84, color: P.ink, seed: sd + 2 });
    doodle(g, M.doodle, w - 120, 104, t, o.glow);
    g.text(M.temp, w - 120, 216, { size: 54, font: 'latin', color: M.pen, seed: sd + 3 });
    g.line(26, 256, w - 26, 252, { color: P.ink, width: 3, seed: sd + 4 });
    // 星期
    Array.from('日一二三四五六').forEach((ch, c) => {
      g.text(ch, GX + GW * (c + 0.5), 290, { size: 32, color: c === 0 || c === 6 ? M.pen : P.inkSoft, seed: sd + 5 + c });
    });
    const rows = Math.ceil((M.off + M.days) / 7);
    for (let r = 1; r <= rows; r++) g.line(GX, GY + r * GH, w - GX, GY + r * GH, { color: rgba(P.ink, 0.16), width: 2, jitter: 1, seed: sd + 20 + r });
    // 日子
    for (let d = 1; d <= M.days; d++) {
      const [cx, cy] = cellXY(M, d);
      g.text(String(d), cx, cy, { size: 34, font: 'latin', color: d <= crossN ? rgba(P.ink, 0.4) : P.ink, seed: sd + 40 + d, pop: false });
    }
    // 打 ×
    const full = Math.floor(crossN);
    for (let d = 1; d <= Math.min(M.days, Math.ceil(crossN)); d++) {
      const pr = d <= full ? 1 : crossN - full;
      const [cx, cy] = cellXY(M, d);
      if (M.n === '12' && d === 24) {
        C.heart(g, cx, cy + 2, 21 * ease.outBack(pr), { fill: P.red, width: 3, seed: sd + 200 });
        continue;
      }
      cross(g, M, d, pr, sd + 100 + d * 3);
      if (M.n === '12' && d === 1) g.circle(cx, cy, 27, { color: M.pen, width: 3.5, progress: pr, seed: sd + 201 });
    }
    // 3 月 20 日：画圈
    if (M.mark && o.mark > 0) {
      const [cx, cy] = cellXY(M, M.mark);
      g.circle(cx, cy, 29, { color: PISTIL, width: 5.5, progress: o.mark, seed: sd + 210 });
      if (o.mark > 0.6) leaf(g, cx + 24, cy - 22, 22 * ease.outBack(seg(o.mark, 0.6, 1)), -0.9, { seed: sd + 211, width: 2.5 });
    }
  }

  function binding(g, torn) {
    const { x, y, w } = CAL, L = x - w / 2;
    // 挂绳 + 钉子
    g.line(x, y - 118, L + 70, y - 40, { color: '#8b7a66', width: 3.5, seed: 601 });
    g.line(x, y - 118, L + w - 70, y - 40, { color: '#8b7a66', width: 3.5, seed: 602 });
    C.dot(g, x, y - 120, 10, '#77708a', 603);
    // 撕剩下的纸茬
    for (let j = 0; j < torn; j++) {
      const M = MONTHS[j];
      const pts = [[L, y - 4]];
      for (let xx = 0; xx <= w; xx += 24) pts.push([L + xx, y + 6 + ((xx / 24 + j) % 2 ? 10 : 2)]);
      pts.push([L + w, y - 4]);
      g.poly(pts, { fill: M.paper, color: P.ink, width: 3, seed: 620 + j });
    }
    // 夹板
    g.rect(L - 18, y - 48, w + 36, 54, { fill: '#3b3552', color: P.ink, width: 4.5, seed: 604 });
    g.line(L - 4, y - 36, L + w + 4, y - 37, { color: '#5a5276', width: 3, seed: 605 });
    // 线圈
    for (let i = 0; i < 14; i++) {
      const rx = L + 26 + (i * (w - 52)) / 13;
      const ctx = g.ctx;
      ctx.save();
      ctx.fillStyle = '#1b1828';
      ctx.beginPath();
      ctx.arc(rx, y - 20, 5, 0, TAU);
      ctx.fill();
      ctx.restore();
      g.line(rx - 2, y - 22, rx + 3, y + 14, { color: '#c9ccdc', width: 5, jitter: 0.8, seed: 640 + i });
    }
  }

  function flyPage(g, idx, f, t) {
    const ctx = g.ctx;
    const M = MONTHS[idx];
    const dir = idx % 2 ? -1 : 1;
    const e = ease.in(f);
    const px = CAL.x + dir * (e * 1500 + Math.sin(f * Math.PI) * 70);
    const py = CAL.y - Math.sin(f * Math.PI) * 150 + e * 260;
    const rot = dir * (ease.out(f) * 0.3 + e * 0.9);
    const sc = 1 + 0.35 * f;
    // 速度线
    for (let i = 0; i < 5; i++) {
      const yy = py + 80 + i * 110;
      const len = 260 + rand(i, idx, 3) * 180;
      g.line(px - dir * (CAL.w * 0.4 + 40), yy, px - dir * (CAL.w * 0.4 + 40 + len * f), yy - 30 * f, { color: '#ffffff', width: 5, alpha: 0.75 * (1 - f * 0.5), seed: 680 + i });
    }
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.scale(sc, sc);
    ctx.translate(-CAL.w / 2, 0);
    ctx.fillStyle = 'rgba(10,10,30,0.22)';
    ctx.fillRect(18, 24, CAL.w, CAL.h);
    calPage(g, M, M.stop || M.days, { torn: true, seed: idx * 1000, t });
    ctx.restore();
  }

  /** 竖排的「第 N 天」计数 */
  function counter(g, M, n, pop) {
    const col = M.light ? '#fbfcff' : P.ink;
    const sh = { color: M.light ? rgba('#0b0f20', 0.55) : rgba(M.pen, 0.6), dx: 6, dy: 6 };
    g.text('第', COUNTER_X, 262, { size: 80, color: col, shadow: sh, seed: 700 });
    const ctx = g.ctx;
    ctx.save();
    ctx.translate(COUNTER_X, 440);
    const s = 1 + 0.16 * pop * pop;
    ctx.scale(s, s);
    g.text(String(n), 0, 0, { size: 230, font: 'latin', color: col, shadow: { color: rgba(M.pen, M.light ? 0.9 : 0.6), dx: 8, dy: 8 }, seed: 701, pop: false });
    ctx.restore();
    g.text('天', COUNTER_X, 622, { size: 80, color: col, shadow: sh, seed: 702 });
    // 下面一道手划线
    g.line(COUNTER_X - 110, 690, COUNTER_X + 110, 684, { color: M.pen, width: 6, seed: 703 });
  }

  function dots(g, color, a, step) {
    const ctx = g.ctx;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = color;
    ctx.beginPath();
    let row = 0;
    for (let y = -200; y < H + 200; y += step * 0.866, row++) {
      for (let x = -300 + (row % 2) * step * 0.5; x < W + 300; x += step) {
        ctx.moveTo(x + 5, y);
        ctx.arc(x, y, 5, 0, TAU);
      }
    }
    ctx.fill();
    ctx.restore();
  }

  function shotCalendar(g, k, t, info) {
    const ctx = g.ctx;
    const NP = MONTHS.length;
    const i = Math.min(NP - 1, Math.floor(k * NP));
    const u = clamp(k * NP - i);
    const M = MONTHS[i];
    const last = i === NP - 1;
    const stop = M.stop || M.days;
    const crossK = ease.inOut(seg(u, i === 0 ? 0.08 : 0.16, last ? 0.7 : 0.88));
    const crossN = crossK * stop;
    const mark = last ? seg(u, 0.72, 0.86) : 0;
    const glow = last ? ease.in(seg(u, 0.8, 1)) : 0;

    g.bg(M.bg);
    const cam = CAMS[i];
    // 3 月最后：镜头扎进角上的小太阳（接下一镜真正的太阳）
    const dive = last ? ease.inCubic(seg(u, 0.84, 1)) : 0;
    const SUNX = CAL.x + CAL.w / 2 - 120, SUNY = CAL.y + 104;
    camOn(g, { x: lerp(cam.x, SUNX, dive), y: lerp(cam.y, SUNY, dive), z: cam.z * (1 + 0.03 * u) * (1 + 2.2 * dive), r: cam.r * (1 - dive) });
    dots(g, M.dot, 0.55, 70);
    // 墙上的光（越来越暖）
    g.glow(CAL.x, CAL.y + 300, 1100, P.warm, [0.05, 0.1, 0.22, 0.5][i]);
    if (M.snow) g.snow({ t, count: M.snow, size: [3, 10], speed: [60, 140], wind: 30, seed: 11 + i, alpha: 0.85, area: [-200, -200, W + 400, H + 400] });
    else motes(g, t, 26, 5, '#fff6d8', 0.8);
    // 日历投在墙上的影子
    ctx.save();
    ctx.fillStyle = 'rgba(10,10,30,0.22)';
    ctx.fillRect(CAL.x - CAL.w / 2 + 16, CAL.y + 18, CAL.w, CAL.h);
    ctx.restore();
    // 当前这一页（快撕的时候先抖一抖）
    const dir = (i % 2 ? -1 : 1);
    const wob = last ? 0 : seg(u, 0.88, 1);
    ctx.save();
    ctx.translate(CAL.x, CAL.y);
    ctx.rotate(dir * 0.035 * wob * Math.sin(t * 40));
    ctx.translate(-CAL.w / 2, 0);
    calPage(g, M, crossN, { seed: i * 1000, t, mark, glow });
    ctx.restore();
    binding(g, i);
    // 计数
    let n = Math.max(1, M.d0 - 1 + Math.floor(crossN));
    if (mark > 0.5) n = M.d0 - 1 + M.mark;
    const pop = crossN > 0 && crossN < stop ? 1 - frac(crossN) : mark > 0.5 ? 1 - seg(mark, 0.5, 1) : 0;
    counter(g, M, n, pop);
    // 上一页被撕下来飞走
    if (i > 0) {
      const f = seg(u, 0, 0.17);
      if (f < 1) flyPage(g, i - 1, f, t);
    }
    // 前景的雪
    if (M.snow) g.snow({ t, count: Math.round(M.snow * 0.15), size: [10, 18], speed: [120, 200], wind: 40, seed: 31 + i, alpha: 0.6, crystal: 13, area: [-200, -200, W + 400, H + 400] });
    g.restore();
    if (M.light) g.vignette(0.35, '#05070f');
    // 3 月：太阳亮起来，整个画面被暖光吞没
    if (glow > 0) {
      ctx.save();
      ctx.globalAlpha = 0.85 * ease.in(seg(u, 0.88, 1));
      ctx.fillStyle = '#fff1cc';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    // 每次翻页闪一下
    const sec = u * (info.dur * CUT[1]) / NP;
    if (i > 0 && sec < 0.12) {
      ctx.save();
      ctx.globalAlpha = 0.35 * (1 - sec / 0.12);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  // ================================================================ 春天的雪地（②⑤⑥ 共用）
  /** 宽一点的雪地（镜头推拉也不会露边），上暖下冷的渐变 */
  function wideGround(g, y, o) {
    o = o || {};
    const ctx = g.ctx;
    const amp = o.amp == null ? 12 : o.amp, seed = o.seed | 0;
    const pts = [[-900, H + 700]];
    for (let x = -900; x <= W + 900; x += 140) pts.push([x, y + noise1(x / 320, seed + 3) * amp]);
    pts.push([W + 900, H + 700]);
    const gr = ctx.createLinearGradient(0, y - amp, 0, y + (o.depth || 360));
    gr.addColorStop(0, o.top || '#fffcf4');
    gr.addColorStop(1, o.bottom || '#dfe5f3');
    g.path(pts, { closed: true, smooth: true, fill: gr, color: P.ink, width: 4.5, seed, overshoot: false });
  }

  /** 前景雪面上淡蓝色的起伏线（让大片雪地有点层次） */
  function drifts(g, list) {
    list.forEach(([x, y, w], i) => {
      g.curve([[x - w / 2, y + 6], [x - w * 0.15, y - 5], [x + w * 0.2, y - 3], [x + w / 2, y + 7]], { color: rgba('#8fa5d2', 0.5), width: 3.4, seed: 540 + i });
    });
  }

  /** 远山上的小松树 */
  function farTrees(g, list, color) {
    list.forEach(([x, y, s], i) => {
      g.poly([[x - 18 * s, y], [x, y - 58 * s], [x + 18 * s, y]], { fill: color, color: rgba(P.ink, 0.3), width: 2.4, seed: 500 + i });
      g.path([[x - 7 * s, y - 36 * s], [x, y - 58 * s], [x + 7 * s, y - 36 * s]], { fill: '#f4f6fb', color: rgba(P.ink, 0.25), width: 1.6, seed: 520 + i });
    });
  }

  function springField(g, gy, t, o) {
    o = o || {};
    hillBand(g, gy - 200, 60, 520, '#c3cdea', 21 + (o.seed | 0), { line: rgba(P.ink, 0.2) });
    if (o.trees) farTrees(g, o.trees, '#8aa3b8');
    hillBand(g, gy - 115, 40, 380, '#e2e5f2', 22 + (o.seed | 0), { line: rgba(P.ink, 0.26) });
    wideGround(g, gy, { seed: o.seed || 6, amp: 12 });
    drifts(g, o.drifts || [[260, gy + 150, 240], [1000, gy + 190, 300], [1720, gy + 130, 260], [620, gy + 250, 220], [1420, gy + 260, 280]]);
    (o.patches || []).forEach(([x, y, rx, ry], j) => {
      soilPatch(g, x, y, rx, ry, 50 + j * 7, 0.3);
      tuft(g, x - rx * 0.35, y + 2, 1, 90 + j * 5, t);
      tuft(g, x + rx * 0.3, y - 2, 0.8, 95 + j * 5, t);
    });
  }

  /** 「第 N 天」：数字用英文手写体，汉字用中文手写体 */
  function dayLabel(g, n, cx, y, size, k, o) {
    if (k <= 0) return;
    const ctx = g.ctx;
    const num = String(n);
    const wTot = size * (2.1 + 0.42 * num.length);
    let x = cx - wTot / 2;
    const base = Object.assign({ color: P.ink, stroke: rgba('#fffaf0', 0.9), strokeWidth: size * 0.16, align: 'left' }, o);
    ctx.save();
    const w1 = g.text('第', x, y, Object.assign({}, base, { size, progress: seg(k, 0, 0.3), seed: 991 }));
    x += w1 + size * 0.22;
    const w2 = g.text(num, x, y - size * 0.04, Object.assign({}, base, { size: size * 1.3, font: 'latin', progress: seg(k, 0.25, 0.7), seed: 992 }));
    x += w2 + size * 0.22;
    g.text('天', x, y, Object.assign({}, base, { size, progress: seg(k, 0.65, 1), seed: 993 }));
    ctx.restore();
  }

  // ================================================================ ② 日出
  function house(g, t) {
    // 墙
    g.rect(-80, 400, 430, 420, { fill: '#c79a77', color: P.ink, width: 4.5, seed: 700 });
    for (let y = 446; y < 800; y += 46) g.line(-70, y, 342, y + 2, { color: rgba(P.ink, 0.18), width: 2, seed: 701 + y });
    // 门（花环已经摘掉了）
    C.door(g, 90, 560, 150, 240, { wreath: false, seed: 710 });
    // 墙根的残雪
    g.path([[-120, 830], [-90, 800], [-30, 792], [30, 806], [260, 808], [330, 796], [372, 812], [400, 836]], { smooth: true, closed: true, fill: SNOW_WARM, color: P.ink, width: 4, seed: 712 });
    // 屋顶
    g.poly([[-120, 408], [395, 408], [330, 300], [-120, 300]], { fill: '#5b4f72', color: P.ink, width: 4.5, seed: 720 });
    // 屋顶上的雪（变薄了，边缘化开）
    g.path([[-130, 300], [-60, 282], [80, 278], [220, 286], [318, 290], [352, 330], [384, 388], [360, 396], [328, 356], [300, 318], [180, 312], [40, 316], [-130, 318]], { smooth: true, closed: true, fill: SNOW_WARM, color: P.ink, width: 4, seed: 721 });
    // 冰柱 + 滴水
    const eave = 410;
    for (let i = 0; i < 9; i++) {
      const ix = -50 + i * 50 + rand(i, 7) * 14;
      const len = 26 + rand(i, 8) * 46;
      g.poly([[ix - 8, eave], [ix + 8, eave], [ix + 1, eave + len]], { fill: '#e6f2fb', color: '#7fa3cc', width: 2.6, seed: 730 + i });
      if (i % 3 === 1) {
        const ph = frac(t * 0.85 + rand(i, 9));
        const ty = eave + len + 6;
        if (ph < 0.25) C.drop(g, ix + 1, ty + ph * 30, 0.42, { seed: 760 + i });
        else {
          const f = (ph - 0.25) / 0.75;
          const yy = ty + ease.in(clamp(f / 0.6)) * (800 - ty);
          if (f < 0.6) C.drop(g, ix + 1, yy, 0.42, { seed: 760 + i });
          else splash(g, ix + 1, 802, (f - 0.6) / 0.4, 0.25);
        }
      }
    }
  }

  function bird(g, x, y, s, flap, seed) {
    const a = flap;
    g.path([[x - 26 * s, y - 4 * s - 10 * s * a], [x - 12 * s, y - 3 * s - 12 * s * a], [x, y + 4 * s], [x + 12 * s, y - 3 * s - 12 * s * a], [x + 26 * s, y - 4 * s - 10 * s * a]], { smooth: true, color: P.ink, width: 3.4 * s, seed });
  }

  const SKY = ['#7cb3e4', '#c9e2f2', '#fddcaa'];

  function shotSunrise(g, k, t, info, ts) {
    const ctx = g.ctx;
    const rise = ease.outCubic(seg(k, 0, 0.8));
    const sx = 1400, sy = lerp(800, 320, rise);
    g.bg([mix('#6f84c0', SKY[0], rise), mix('#cdb8d6', SKY[1], rise), mix('#fbc995', SKY[2], rise)]);
    camOn(g, { x: lerp(900, 930, k), y: 520, z: lerp(1.04, 1.12, ease.inOut(k)) });
    rays(g, sx, sy, t, 18, 0.06 + 0.16 * rise, '#fff4d6', 4);
    sun(g, sx, sy, 96, t, { alpha: 0.6 + 0.4 * rise });
    // 鸟
    for (let i = 0; i < 3; i++) {
      const bx = lerp(1720, 1080, k) + i * 86 - (i === 1 ? 46 : 0);
      const by = 190 + i * 38 + Math.sin(t * 2 + i) * 8;
      bird(g, bx, by, 1.2 - i * 0.15, Math.sin(t * 11 + i * 2), 800 + i * 3);
    }
    springField(g, 800, t, { trees: [[560, 640, 0.9], [610, 646, 0.7], [1700, 630, 1], [1750, 640, 0.75], [1020, 650, 0.6]], patches: [[1180, 880, 96, 17], [1580, 840, 120, 18], [480, 905, 72, 13]] });
    house(g, t);
    // 雪人 + 长长的影子（太阳在右边低处）
    const SX = 790, SY = 872, S = 0.82;
    ctx.save();
    ctx.globalAlpha *= 0.32;
    ctx.fillStyle = '#7d8cc4';
    ctx.beginPath();
    ctx.ellipse(SX - 230 * lerp(1.3, 0.8, rise), SY + 4, 280 * lerp(1.3, 0.85, rise), 22, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    C.snowman(g, SX, SY, S, { mood: 'calm', look: 0.65, lookUp: 0.45 * rise, blush: 0.55, seed: 3 });
    g.glow(SX + 90, SY - 220, 300, '#ffe2a0', 0.25 * rise);
    g.restore();
    // 日记一样的日期
    g.text('3月20日', 90, 118, { align: 'left', size: 100, progress: seg(k, 0.1, 0.42), color: P.ink, stroke: rgba('#fffaf0', 0.85), strokeWidth: 14, seed: 820 });
    g.text('晴', 470, 122, { align: 'left', size: 108, progress: seg(k, 0.42, 0.56), color: '#e0801f', stroke: rgba('#fffaf0', 0.85), strokeWidth: 14, seed: 821 });
    if (k > 0.5) g.circle(524, 122, 62, { color: '#e0801f', width: 4.5, progress: seg(k, 0.5, 0.7), seed: 822 });
    // 从日历切过来：暖光散开
    if (ts < 0.35) {
      ctx.save();
      ctx.globalAlpha = 0.85 * (1 - ts / 0.35);
      ctx.fillStyle = '#fff1cc';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  // ================================================================ ③ 第一滴水
  const DROP_PATH = [[-0.62, -0.46], [-0.8, -0.18], [-0.86, 0.15], [-0.74, 0.5], [-0.56, 0.82], [-0.5, 1.5]];
  function pathAt(pts, f) {
    const u = clamp(f) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(u)), k = u - i;
    return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)];
  }

  function shotFace(g, k, t, info) {
    const ctx = g.ctx;
    const X = 880, Y = 1340, S = 3.0;
    const notice = k >= 0.38;
    const panic = seg(k, 0.38, 0.46);
    const look = notice ? 0.3 : 0.18;
    g.bg(['#86bce8', '#cde5f2', '#fddcac']);
    g.glow(1840, 20, 1300, P.glow, 0.75);
    g.glow(1840, 20, 520, '#fff8e2', 0.9);
    rays(g, 1840, 20, t, 14, 0.18, '#fff6dc', 6);
    const calm = 1 - seg(k, 0.38, 0.55);
    const sh = notice ? g.shake(7 * (1 - 0.6 * seg(k, 0.46, 0.75))) : [0, 0];
    const z = lerp(1.0, 1.04, k) + (notice ? 0.06 * ease.outBack(panic) : 0);
    camOn(g, { x: 960, y: 540, z, dx: sh[0], dy: sh[1] });
    const arms = notice ? [0.95 + 0.42 * Math.sin(t * 16), 0.95 + 0.42 * Math.sin(t * 16 + 2.2)] : [0.05, 0.08];
    C.snowman(g, X, Y, S, { mood: notice ? 'hope' : 'calm', look, lookUp: notice ? 0.95 : 0.2, blush: notice ? 0.45 : 0.8, arms, seed: 3 });
    const hf = headFrame(X, Y, S, look);
    const R = hf.r;
    // 阳光照在脸的右上角
    g.glow(hf.x + R * 0.7, hf.y - R * 0.6, R * 1.4, '#fff2c8', 0.4);
    // 热气（发现之前）：从帽檐边往上冒
    if (calm > 0) {
      for (let j = 0; j < 3; j++) {
        const ph = frac(t * 0.75 + j / 3);
        const bx = hf.x + R * (1.05 + j * 0.28), by = hf.y - R * 0.35 - ph * R * 0.9;
        const pts = [];
        for (let q = 0; q < 6; q++) pts.push([bx + Math.sin(q * 1.4 + t * 3 + j) * 13, by - q * 22]);
        g.curve(pts, { color: '#ef9f3f', width: 5, alpha: calm * Math.sin(ph * Math.PI) * 0.85, seed: 840 + j });
      }
    }
    // 额角的水滴
    const appear = seg(k, 0.18, 0.28);
    const slide = ease.in(seg(k, 0.62, 0.98));
    if (appear > 0) {
      ctx.save();
      ctx.translate(hf.x, hf.y);
      ctx.rotate(hf.tilt);
      const pos = pathAt(DROP_PATH, slide * 0.999);
      if (slide > 0) {
        const trail = [];
        for (let q = 0; q <= 12; q++) {
          const pp = pathAt(DROP_PATH, Math.min(slide, 0.8) * (q / 12));
          trail.push([pp[0] * R, pp[1] * R - 14]);
        }
        g.curve(trail, { color: rgba(P.water, 0.9), width: 9, seed: 850 });
        g.curve(trail, { color: rgba('#ffffff', 0.85), width: 3, seed: 851 });
      }
      const ds = 1.7 * ease.outBack(appear) * (1 + 0.12 * slide);
      C.drop(g, pos[0] * R, pos[1] * R, ds, { seed: 852 });
      sparkle(g, pos[0] * R + 30, pos[1] * R - 48, 22, '#ffffff', appear * (1 - seg(k, 0.3, 0.4)));
      ctx.restore();
    }
    // 慌了：惊吓线 + 甩出去的汗珠
    if (notice) {
      const a = ease.out(panic);
      [[0, 1], [Math.PI, -1]].forEach(([base, sgn]) => {
        [-0.4, -0.16, 0.08].forEach((da, j) => {
          const ang = base + sgn * da;
          const r0 = R * (1.14 + 0.04 * Math.sin(t * 20 + j)), r1 = r0 + R * 0.26 * a;
          g.line(hf.x + Math.cos(ang) * r0, hf.y + Math.sin(ang) * r0, hf.x + Math.cos(ang) * r1, hf.y + Math.sin(ang) * r1, { color: P.ink, width: 8, seed: 860 + j + (sgn > 0 ? 0 : 5) });
        });
      });
      for (let j = 0; j < 4; j++) {
        const ph = frac(t * 2.4 + j * 0.25);
        const side = j % 2 ? 1 : -1;
        const ox = hf.x + side * (R * 0.95 + ph * R * 0.7);
        const oy = hf.y - R * 0.7 - Math.sin(ph * Math.PI) * R * 0.32 + ph * R * 0.2;
        ctx.save();
        ctx.globalAlpha *= (1 - ph) * a;
        ctx.translate(ox, oy);
        ctx.rotate(side * (0.4 + ph));
        C.drop(g, 0, 0, 0.8, { seed: 870 + j });
        ctx.restore();
      }
    }
    g.restore();
    if (notice) {
      const tk = seg(k, 0.38, 0.5);
      const txo = { color: P.ink, stroke: rgba('#fffaf0', 0.9), strokeWidth: 16, shadow: { color: '#7fb0e0', dx: 9, dy: 9 }, rot: 0.06 };
      g.text('诶', 1540, 250, Object.assign({ size: 200, progress: seg(tk, 0, 0.4), seed: 880 }, txo));
      g.text('?!', 1700, 236, Object.assign({ size: 220, font: 'latin', weight: 700, spacing: -10, progress: seg(tk, 0.35, 1), seed: 881 }, txo));
    }
  }

  // ================================================================ ④ 发芽、开花
  function shotSprout(g, k, t, info) {
    const BX = 1090, BY = 742;
    const fall = seg(k, 0, 0.15);
    const hit = seg(k, 0.15, 0.36);
    const sprout = seg(k, 0.24, 0.4);
    const grow = seg(k, 0.38, 0.64);
    const bud = seg(k, 0.52, 0.64);
    const bloom = seg(k, 0.64, 0.8);
    g.bg(['#8cc0ea', '#d0e7f3', '#fbe3b9']);
    g.glow(1800, 40, 1300, P.glow, 0.55 + 0.3 * bloom);
    rays(g, 1800, 40, t, 14, 0.1 + 0.1 * bloom, '#fff6dc', 8);
    // 镜头：先看水滴落地，再一路推近到花
    const push = ease.inOut(seg(k, 0.3, 0.78));
    const headY = BY - 330 * (0.26 * ease.outBack(sprout) + 0.74 * ease.inOut(grow));
    const cam = {
      x: lerp(930, BX - 30, ease.inOut(seg(k, 0.1, 0.6))),
      y: lerp(575, lerp(BY - 120, headY + 110, push), ease.inOut(seg(k, 0.2, 0.6))),
      z: lerp(1.14, 1.55, push) + 0.05 * Math.sin(Math.PI * bloom),
    };
    camOn(g, cam);
    hillBand(g, 590, 26, 420, '#dce4f3', 41, { line: rgba(P.ink, 0.22) });
    wideGround(g, 690, { seed: 12, amp: 8, depth: 300 });
    drifts(g, [[760, 870, 220], [1480, 820, 260], [1300, 960, 320], [1820, 900, 220], [900, 1010, 260], [1650, 1040, 240]]);
    // 开花的一瞬间：放射光（在雪人身后）
    if (bloom > 0) rays(g, BX + 6, headY, t * 3, 18, 0.3 * ease.out(bloom) * (1 - 0.55 * seg(k, 0.84, 1)), '#fff9dc', 12);
    // 雪人好大：只看得到身体、围巾和一根伸过来的树枝手
    C.snowman(g, 420, 790, 3.0, { look: 0.5, mood: 'calm', arms: [0, -0.1], blush: 0.6, seed: 3 });
    // 脚边的一小块泥土
    soilPatch(g, BX, BY, 132, 26, 61, ease.out(hit));
    tuft(g, BX - 150, BY + 8, 1.3, 70, t);
    tuft(g, BX + 168, BY - 2, 1.1, 75, t);
    if (sprout > 0 && sprout < 1) {
      const b = Math.sin(sprout * Math.PI) * 16;
      g.path([[BX - 40, BY], [BX - 14, BY - b], [BX + 16, BY - b * 0.9], [BX + 42, BY]], { smooth: true, color: EARTH_LINE, width: 3.5, fill: EARTH, seed: 62 });
    }
    if (bloom > 0) {
      g.glow(BX, headY, 380, '#fff1b0', 0.65 * bloom);
      const ring = ease.outCubic(seg(k, 0.64, 0.76));
      if (ring > 0 && ring < 1) g.circle(BX + 6, headY, lerp(50, 300, ring), { color: rgba(PETAL_DEEP, 1 - ring), width: 6 * (1 - ring) + 1.5, seed: 63 });
    }
    const head = plant(g, BX, BY, 1.0, { sprout, grow, bud, bloom, sway: 0.03 + 0.03 * bloom }, t);
    if (bloom > 0) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + t * 0.4;
        const rr = 120 + 30 * Math.sin(t * 2 + i);
        sparkle(g, head.x + Math.cos(a) * rr, head.y + Math.sin(a) * rr * 0.85, (12 + 7 * Math.sin(t * 5 + i * 2)) * ease.outBack(bloom), '#ffffff', 0.55 + 0.45 * Math.sin(t * 4 + i));
      }
    }
    // 落下来的水滴（带一道白色的拖影）
    if (fall > 0 && fall < 1) {
      const dy = lerp(-160, BY - 12, ease.in(fall));
      g.line(BX, dy - 150 * fall - 40, BX, dy - 46, { color: '#ffffff', width: 6, alpha: 0.85, seed: 90 });
      C.drop(g, BX, dy, 1.6, { seed: 91 });
    }
    splash(g, BX, BY, hit, 1.5);
    // 拟声字
    const tdi = seg(k, 0.15, 0.19);
    if (tdi > 0 && k < 0.34) g.text('滴', BX + 200, BY - 170, { size: 130, progress: tdi, color: '#4f7fc0', stroke: '#ffffff', strokeWidth: 14, rot: 0.12, alpha: 1 - seg(k, 0.27, 0.34), seed: 95 });
    const tpu = seg(k, 0.3, 0.34);
    if (tpu > 0 && k < 0.58) g.text('噗', BX - 190, BY - 150, { size: 130, progress: tpu, color: LEAF_DEEP, stroke: '#ffffff', strokeWidth: 14, rot: -0.12, alpha: 1 - seg(k, 0.5, 0.58), seed: 96 });
    g.restore();
    g.text('花开了', 1660, 190, { size: 112, vertical: true, progress: seg(k, 0.68, 0.86), color: '#e3871c', stroke: '#fffaf0', strokeWidth: 16, shadow: { color: rgba(LEAF_DEEP, 0.6), dx: 6, dy: 6 }, seed: 97 });
  }

  // ================================================================ ⑤ 低头看花
  function shotLookDown(g, k, t, info) {
    g.bg(SKY);
    g.glow(1900, 0, 1300, P.glow, 0.65);
    rays(g, 1900, 0, t, 12, 0.14, '#fff6dc', 9);
    camOn(g, { x: lerp(915, 900, k), y: lerp(585, 600, k), z: lerp(1.3, 1.24, ease.inOut(k)) });
    springField(g, 830, t, { seed: 8, trees: [[420, 676, 0.8], [470, 684, 0.6], [1460, 668, 0.9]], patches: [[1420, 900, 110, 16], [330, 915, 90, 14]] });
    const SX = 760, SY = 882, S = 1.3;
    const FX = 1085, FY = 884;
    const lean = 0.11 * ease.inOut(seg(k, 0, 0.3));
    soilPatch(g, FX, FY + 4, 74, 15, 63, 0.4);
    tuft(g, FX - 80, FY + 6, 0.9, 71, t);
    snowmanLean(g, SX, SY, S, lean, { mood: 'calm', look: 0.95, lookUp: 0, blush: 1, arms: [0.12, -0.2 + 0.06 * Math.sin(t * 2.2)], seed: 3 });
    const nod = -0.2 * ease.inOut(seg(k, 0.2, 0.42)) + 0.07 * Math.sin(t * 2.4);
    g.glow(FX, FY - 180, 160, '#fff1b0', 0.45);
    const head = plant(g, FX, FY, 0.56, { sprout: 1, grow: 1, bloom: 1, lean: nod, sway: 0.02 }, t);
    for (let i = 0; i < 3; i++) sparkle(g, head.x + 56 + i * 28, head.y - 46 - i * 24, 11 + 4 * Math.sin(t * 5 + i), '#ffffff', 0.55 + 0.45 * Math.sin(t * 4 + i * 2));
    bubble(g, 1150, 395, 230, 140, 935, 505, seg(k, 0.32, 0.44), 980);
    if (k > 0.32) g.text('早安', 1150, 395, { size: 80, progress: seg(k, 0.38, 0.54), color: P.ink, seed: 985 });
    g.restore();
    motes(g, t, 22, 12, '#fff6d8', 0.75);
  }

  // ================================================================ ⑥ 抬头看太阳，笑了
  function shotSmile(g, k, t, info) {
    const ctx = g.ctx;
    const up = ease.inOut(seg(k, 0.04, 0.3));
    const smile = k >= 0.4;
    const sk = seg(k, 0.4, 0.55);
    g.bg(SKY);
    camOn(g, { x: lerp(960, 930, k), y: lerp(545, 530, k), z: lerp(1.0, 1.1, ease.inOut(k)), r: lerp(-0.012, 0.0, k) });
    rays(g, 1480, 240, t, 18, 0.2 + 0.08 * sk, '#fff4d6', 10);
    sun(g, 1480, 240, 104, t, { alpha: 1 });
    springField(g, 850, t, { seed: 9, trees: [[180, 690, 0.8], [230, 698, 0.6], [1780, 684, 0.9]], patches: [[1520, 915, 120, 16], [420, 920, 80, 14]] });
    const SX = 840, SY = 912, S = 1.36;
    ctx.save();
    ctx.globalAlpha *= 0.24;
    ctx.fillStyle = '#7d8cc4';
    ctx.beginPath();
    ctx.ellipse(SX - 150, SY + 4, 260, 20, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    const FX = 1160;
    soilPatch(g, FX, SY + 2, 70, 13, 64, 0.4);
    const arms = smile ? [lerp(0.1, 0.55, ease.outBack(sk)), lerp(0.1, 0.65, ease.outBack(sk))] : [0.1, 0.1];
    C.snowman(g, SX, SY, S, { mood: smile ? 'happy' : 'calm', look: lerp(0.4, 0.85, up), lookUp: up, blush: lerp(0.6, 1, sk), arms, seed: 3 });
    plant(g, FX, SY, 0.5, { sprout: 1, grow: 1, bloom: 1, lean: -0.05, sway: 0.05 }, t);
    const hf = headFrame(SX, SY, S, 0.85);
    g.glow(hf.x + hf.r * 0.5, hf.y - hf.r * 0.3, hf.r * 2.2, '#fff0c0', 0.32);
    if (smile) {
      for (let i = 0; i < 4; i++) {
        const a = -1.0 + i * 0.42;
        sparkle(g, hf.x + Math.cos(a) * hf.r * 1.6, hf.y + Math.sin(a) * hf.r * 1.5, (12 + 6 * Math.sin(t * 5 + i)) * sk, '#ffffff', 0.95);
      }
    }
    g.restore();
    // 笑起来的时候，整个画面暖起来
    g.glow(1560, 220, 1500, P.warm, 0.22 * sk);
    petals(g, t, 16, 21, 0.9 * seg(k, 0.3, 0.6));
    g.snow({ t, count: 16, size: [4, 8], speed: [40, 80], wind: 20, seed: 44, alpha: 0.65 });
    // 春
    brushReveal(g, '春', 350, 330, 340, seg(k, 0.45, 0.62), { font: 'brush', color: LEAF_DEEP, shadow: { color: rgba(P.warm, 0.95), dx: 10, dy: 10 }, stroke: rgba('#fffaf0', 0.9), strokeWidth: 20, seed: 990 });
    dayLabel(g, 110, 350, 600, 62, seg(k, 0.62, 0.8), {});
  }

  // ================================================================ 注册
  const SHOTS = [shotCalendar, shotSunrise, shotFace, shotSprout, shotLookDown, shotSmile];

  TG.scene({
    id: 'spring',
    title: '春天要来了',
    transition: 'wipe',
    chars: '月日一二三四五六第天晴诶滴噗花开了早安春°C?!+-',
    lyrics: 'default',
    draw(g, p, t, info) {
      let i = 0;
      while (i < SHOTS.length - 1 && p >= CUT[i + 1]) i++;
      const k = seg(p, CUT[i], CUT[i + 1]);
      const ts = Math.max(0, (p - CUT[i]) * (info.dur || 16));
      SHOTS[i](g, k, t, info, ts);
    },
  });
})();
