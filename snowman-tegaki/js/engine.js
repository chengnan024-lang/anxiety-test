/* 雪人 · 手书 —— 引擎
 *
 * 画布固定 1920×1080。动画按 12fps 量化（"一拍二"，手书的顿挫感），
 * 线条每一帧都会重新抖动一次（boil），像一张张手绘稿连起来放。
 *
 * 所有场景都是时间的纯函数：draw(g, p, t, info) 只依赖传进来的时间，
 * 所以可以随意拖进度、打点对拍、逐帧导出视频。
 */
(function () {
  'use strict';

  const W = 1920, H = 1080;
  const CFG = {
    animFps: 12,          // 动画帧率
    jitter: 1.7,          // 默认线条抖动（px）
    width: 4.5,           // 默认线宽
    defaultDuration: 270, // 没有音乐时的预览时长（秒）
    paper: 0.55,          // 纸纹强度
    lyricCps: 14,         // 歌词逐字出现速度（字/秒）
  };

  // ------------------------------------------------------------------ 数学
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const remap = (v, a, b, c, d) => c + ((d - c) * (v - a)) / (b - a);
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const ease = {
    linear: (t) => t,
    in: (t) => t * t,
    out: (t) => 1 - (1 - t) * (1 - t),
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    outBack: (t) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    outElastic: (t) =>
      t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
    sine: (t) => 0.5 - Math.cos(Math.PI * t) / 2,
  };

  function hash(a, b, c) {
    let h = 0x9e3779b9 ^ Math.imul(a | 0, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35) ^ Math.imul(b | 0, 0x27d4eb2f);
    h = Math.imul(h ^ (h >>> 13), 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  }
  /** 确定性随机数 [0,1)：同样的参数永远得到同样的值 */
  const rand = (a, b = 0, c = 0) => hash(a, b, c) / 4294967296;
  function seedOf(str) {
    let h = 2166136261;
    for (const ch of String(str)) {
      h ^= ch.codePointAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** 平滑一维噪声，范围约 [-1,1] */
  function noise1(x, seed = 0) {
    const i = Math.floor(x), f = x - i;
    const a = rand(i, seed, 7) * 2 - 1, b = rand(i + 1, seed, 7) * 2 - 1;
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  }

  // ------------------------------------------------------------------ 颜色
  const PAL = {
    ink: '#2b2838', inkSoft: '#5a5670',
    paper: '#f4efe4', paperDark: '#e6dcc8',
    night: '#1c2340', nightDeep: '#121729', nightBlue: '#2c3a66', dusk: '#4b4f7d',
    snow: '#fbfcff', snowShade: '#c8d4ec', ice: '#9fb8dc',
    red: '#d7463f', redDeep: '#a8302c',
    warm: '#f7c873', warmDeep: '#ec9a4b', glow: '#ffe2a8',
    carrot: '#ee8a3c', coal: '#2b2838', wood: '#8a5a3c', woodDark: '#5e3c2a',
    green: '#86b97a', greenDeep: '#3f6e57', pink: '#f3a7a7',
    sky: '#bfd8ec', sun: '#ffd86b', water: '#a9c9e6',
  };
  function hexRgb(c) {
    if (Array.isArray(c)) return c;
    let s = String(c).trim();
    if (s[0] === '#') {
      s = s.slice(1);
      if (s.length === 3) s = s.split('').map((x) => x + x).join('');
      const n = parseInt(s.slice(0, 6), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (m) return m[1].split(',').slice(0, 3).map((v) => parseFloat(v));
    return [0, 0, 0];
  }
  /** 两种颜色按 t 混合 */
  function mix(a, b, t) {
    const A = hexRgb(a), B = hexRgb(b);
    return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
  }
  /** 给颜色加透明度 */
  function rgba(c, a) {
    const A = hexRgb(c);
    return `rgba(${A[0]},${A[1]},${A[2]},${a})`;
  }

  const FONTS = {
    hand: '"Long Cang", "Zhi Mang Xing", "KaiTi", "STKaiti", "Kaiti SC", cursive',
    brush: '"Ma Shan Zheng", "Zhi Mang Xing", "STXingkai", "KaiTi", cursive',
    round: '"ZCOOL KuaiLe", "Yuanti SC", "YouYuan", "Microsoft YaHei", sans-serif',
    latin: '"Caveat", "Long Cang", cursive',
  };

  // ------------------------------------------------------------------ 几何
  function resample(src, step) {
    const out = [[src[0][0], src[0][1], 0]];
    let s = 0, next = step;
    for (let i = 1; i < src.length; i++) {
      const ax = src[i - 1][0], ay = src[i - 1][1], bx = src[i][0], by = src[i][1];
      const len = Math.hypot(bx - ax, by - ay);
      if (len === 0) continue;
      while (next <= s + len) {
        const k = (next - s) / len;
        out.push([ax + (bx - ax) * k, ay + (by - ay) * k, next]);
        next += step;
      }
      s += len;
    }
    const last = src[src.length - 1];
    if (s - out[out.length - 1][2] > 0.01) out.push([last[0], last[1], s]);
    return { pts: out, L: s };
  }

  /** Catmull-Rom 平滑：把控制点变成顺滑曲线上的点 */
  function catmull(P, closed, n = 8) {
    const len = P.length;
    if (len < 3) return P.map((p) => [p[0], p[1]]);
    const get = (i) => (closed ? P[((i % len) + len) % len] : P[Math.max(0, Math.min(len - 1, i))]);
    const segs = closed ? len : len - 1;
    const out = [];
    for (let i = 0; i < segs; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      for (let j = 0; j < n; j++) {
        const t = j / n, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    const end = closed ? get(0) : P[len - 1];
    out.push([end[0], end[1]]);
    return out;
  }

  function ellipsePts(cx, cy, rx, ry, a0, sweep, rot, seed, wob) {
    const per = Math.PI * (rx + ry);
    const n = Math.max(14, Math.min(220, Math.round((per * sweep) / (2 * Math.PI) / 9)));
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (sweep * i) / n;
      const k = 1 + noise1(a * 1.3, seed) * wob;
      const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
      out.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
    }
    return out;
  }

  // ------------------------------------------------------------------ 笔刷
  /** 手绘描线：抖动 + 起收笔变细 + 压感变化 + 逐笔画出（progress） */
  function inkStroke(ctx, raw, o, seed) {
    if (!raw || raw.length < 2) return;
    const step = o.step || 5;
    const { pts, L } = resample(raw, step);
    if (L < 0.5) return;
    const prog = o.progress == null ? 1 : clamp(o.progress);
    if (prog <= 0) return;
    const endS = L * prog;
    const j = o.jitter, wl = o.wobble || 70;
    const sx = seed % 9973, sy = sx + 31, sw = sx + 67;
    const gx = (rand(seed, 1) - 0.5) * j * 0.9, gy = (rand(seed, 2) - 0.5) * j * 0.9;
    const P = [];
    for (let i = 0; i < pts.length; i++) {
      let q = pts[i];
      if (q[2] > endS) {
        const a = pts[i - 1];
        const k = (endS - a[2]) / (q[2] - a[2] || 1);
        q = [lerp(a[0], q[0], k), lerp(a[1], q[1], k), endS];
        if (endS - a[2] > 0.3) P.push([q[0] + gx + noise1(q[2] / wl, sx) * j, q[1] + gy + noise1(q[2] / wl, sy) * j, q[2]]);
        break;
      }
      P.push([q[0] + gx + noise1(q[2] / wl, sx) * j, q[1] + gy + noise1(q[2] / wl, sy) * j, q[2]]);
    }
    const n = P.length;
    if (n < 2) return;
    const taperLen = Math.min(L * 0.2, o.taperLen || 36);
    const widths = new Array(n);
    for (let i = 0; i < n; i++) {
      const s = P[i][2];
      let w = o.width;
      if (o.taper !== false && taperLen > 0) {
        const a = Math.min(1, s / taperLen), b = Math.min(1, (L - s) / taperLen);
        w *= 0.3 + 0.7 * Math.min(a, b);
      }
      w *= 1 + 0.22 * noise1(s / 110, sw);
      widths[i] = Math.max(0.35, w) / 2;
    }
    // 把描线做成一个带圆头的填充轮廓 —— 一次 fill，半透明也不会出现接缝
    const left = [], right = [];
    let tx = 0, ty = 0;
    for (let i = 0; i < n; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      if (i === 0) { tx = dx; ty = dy; }
      const r = widths[i];
      left.push([P[i][0] - dy * r, P[i][1] + dx * r]);
      right.push([P[i][0] + dy * r, P[i][1] - dx * r]);
    }
    const ex = P[n - 1][0], ey = P[n - 1][1];
    let edx = P[n - 1][0] - P[n - 2][0], edy = P[n - 1][1] - P[n - 2][1];
    const ed = Math.hypot(edx, edy) || 1;
    edx /= ed; edy /= ed;
    ctx.save();
    ctx.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    ctx.fillStyle = o.color;
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]);
    const re = widths[n - 1];
    for (let k = 1; k < 6; k++) {
      const th = (Math.PI * k) / 6;
      ctx.lineTo(ex - edy * re * Math.cos(th) + edx * re * Math.sin(th), ey + edx * re * Math.cos(th) + edy * re * Math.sin(th));
    }
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    const rs = widths[0], sx0 = P[0][0], sy0 = P[0][1];
    for (let k = 1; k < 6; k++) {
      const th = (Math.PI * k) / 6;
      ctx.lineTo(sx0 + ty * rs * Math.cos(th) - tx * rs * Math.sin(th), sy0 - tx * rs * Math.cos(th) - ty * rs * Math.sin(th));
    }
    ctx.closePath();
    ctx.fill('nonzero');
    ctx.restore();
  }

  /** 手绘上色：轮廓同样抖动，并且和描线略微错位（套色不准的手绘感） */
  function inkFill(ctx, pts, color, o, seed) {
    if (!pts || pts.length < 3) return;
    const j = (o.fillJitter != null ? o.fillJitter : o.jitter * 0.8);
    const off = o.fillOffset || [(rand(seed, 11) - 0.5) * o.jitter * 2.2, (rand(seed, 12) - 0.5) * o.jitter * 2.2];
    const sx = (seed + 101) % 9973, sy = sx + 13;
    const { pts: R } = resample(pts.concat([pts[0]]), 8);
    ctx.save();
    ctx.globalAlpha *= o.fillAlpha == null ? (o.alpha == null ? 1 : o.alpha) : o.fillAlpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < R.length; i++) {
      const q = R[i];
      const x = q[0] + off[0] + noise1(q[2] / 80, sx) * j, y = q[1] + off[1] + noise1(q[2] / 80, sy) * j;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------------------------ 纸纹
  let paperTex = null;
  function makePaper() {
    const c = document.createElement('canvas');
    c.width = W + 24; c.height = H + 24;
    const x = c.getContext('2d');
    const img = x.createImageData(c.width, c.height);
    const d = img.data;
    const r = rng(1234);
    for (let i = 0; i < d.length; i += 4) {
      const n = 236 + r() * 19;
      d[i] = n; d[i + 1] = n - 1; d[i + 2] = n - 5; d[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    // 纤维
    x.lineCap = 'round';
    for (let k = 0; k < 1400; k++) {
      const px = r() * c.width, py = r() * c.height, len = 6 + r() * 26, a = r() * Math.PI;
      x.strokeStyle = r() < 0.5 ? 'rgba(120,100,70,0.07)' : 'rgba(255,255,255,0.18)';
      x.lineWidth = 0.6 + r();
      x.beginPath();
      x.moveTo(px, py);
      x.quadraticCurveTo(px + Math.cos(a) * len * 0.5 + (r() - 0.5) * 6, py + Math.sin(a) * len * 0.5 + (r() - 0.5) * 6, px + Math.cos(a) * len, py + Math.sin(a) * len);
      x.stroke();
    }
    // 斑驳
    for (let k = 0; k < 40; k++) {
      const px = r() * c.width, py = r() * c.height, rr = 80 + r() * 260;
      const gr = x.createRadialGradient(px, py, 0, px, py, rr);
      gr.addColorStop(0, `rgba(170,150,120,${0.03 + r() * 0.04})`);
      gr.addColorStop(1, 'rgba(170,150,120,0)');
      x.fillStyle = gr;
      x.fillRect(px - rr, py - rr, rr * 2, rr * 2);
    }
    return c;
  }

  // ------------------------------------------------------------------ 绘图工具包 g
  function makeG(ctx, info) {
    let n = 0;
    const boil = info.boil;
    function opts(o) {
      o = o || {};
      return {
        color: o.color || PAL.ink,
        width: o.width == null ? CFG.width : o.width,
        jitter: o.jitter == null ? CFG.jitter : o.jitter,
        progress: o.progress,
        alpha: o.alpha,
        taper: o.taper,
        taperLen: o.taperLen,
        wobble: o.wobble,
        step: o.step,
        fill: o.fill,
        fillOffset: o.fillOffset,
        fillJitter: o.fillJitter,
        fillAlpha: o.fillAlpha,
        stroke: o.stroke,
        double: o.double,
        seed: o.seed | 0,
        still: !!o.still,
        closed: o.closed,
        smooth: o.smooth,
        overshoot: o.overshoot,
        rot: o.rot || 0,
      };
    }
    function nextSeed(o) {
      n++;
      return hash(n, o.seed, o.still ? 0 : boil + 1);
    }
    function draw(linePts, fillPts, o) {
      const s = nextSeed(o);
      if (o.fill && fillPts) inkFill(ctx, fillPts, o.fill, o, s);
      if (o.stroke !== false && linePts) {
        inkStroke(ctx, linePts, o, s);
        if (o.double) {
          const o2 = Object.assign({}, o, { width: o.width * 0.55, alpha: (o.alpha == null ? 1 : o.alpha) * 0.5, jitter: o.jitter * 1.6 });
          inkStroke(ctx, linePts, o2, hash(s, 5));
        }
      }
    }

    const g = {
      ctx, info, W, H, PAL, U: TG.U,
      /** 直线 */
      line(x1, y1, x2, y2, o) {
        o = opts(o);
        draw([[x1, y1], [x2, y2]], null, o);
      },
      /** 折线 / 多边形（o.closed 闭合，o.smooth 平滑） */
      path(pts, o) {
        o = opts(o);
        if (!pts || pts.length < 2) return;
        let line = o.smooth ? catmull(pts, !!o.closed) : pts.map((p) => [p[0], p[1]]);
        const fillPts = o.closed ? line.slice() : o.fill ? line.slice() : null;
        if (o.closed && o.overshoot !== false) {
          if (!o.smooth) line.push([pts[0][0], pts[0][1]]);
          const a = line[0], b = line[Math.min(line.length - 1, o.smooth ? 3 : 1)];
          line.push([lerp(a[0], b[0], 0.6), lerp(a[1], b[1], 0.6)]);
        }
        draw(line, fillPts, o);
      },
      /** 平滑曲线（穿过所有控制点） */
      curve(pts, o) {
        g.path(pts, Object.assign({}, o, { smooth: true }));
      },
      /** 闭合多边形 */
      poly(pts, o) {
        g.path(pts, Object.assign({}, o, { closed: true }));
      },
      /** 手绘椭圆：首尾会略微交叠，像一笔画出来的圈 */
      ellipse(cx, cy, rx, ry, o) {
        o = opts(o);
        const s = hash(n + 1, o.seed, 77);
        const a0 = (o.still ? rand(o.seed, n + 1, 3) : rand(s, 1)) * Math.PI * 2;
        const over = o.overshoot === false ? 0 : Math.min(0.5, 12 / Math.max(rx, ry, 1));
        const wob = 0.022;
        const line = ellipsePts(cx, cy, rx, ry, a0, Math.PI * 2 + over, o.rot, s % 997, wob);
        const fillPts = ellipsePts(cx, cy, rx, ry, a0, Math.PI * 2, o.rot, s % 997, wob);
        draw(line, fillPts, o);
      },
      circle(cx, cy, r, o) {
        g.ellipse(cx, cy, r, r, o);
      },
      /** 圆弧（a0→a1，弧度） */
      arc(cx, cy, r, a0, a1, o) {
        o = opts(o);
        const pts = [];
        const k = Math.max(6, Math.round((Math.abs(a1 - a0) * r) / 9));
        for (let i = 0; i <= k; i++) {
          const a = a0 + ((a1 - a0) * i) / k;
          pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        draw(pts, o.fill ? pts.concat([[cx, cy]]) : null, o);
      },
      /** 手绘矩形（o.sketch：四条出头的线，速写感） */
      rect(x, y, w, h, o) {
        const oo = opts(o);
        const c = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
        if (o && o.sketch) {
          if (oo.fill) inkFill(ctx, c, oo.fill, oo, nextSeed(oo));
          const e = Math.min(14, Math.min(w, h) * 0.1);
          g.line(x - e, y, x + w + e * 0.6, y, Object.assign({}, o, { fill: null }));
          g.line(x + w, y - e * 0.6, x + w, y + h + e, Object.assign({}, o, { fill: null }));
          g.line(x + w + e * 0.5, y + h, x - e, y + h, Object.assign({}, o, { fill: null }));
          g.line(x, y + h + e * 0.6, x, y - e, Object.assign({}, o, { fill: null }));
          return;
        }
        g.path(c, Object.assign({}, o, { closed: true }));
      },
      /** 只上色不描边 */
      fill(pts, color, o) {
        const oo = opts(Object.assign({}, o, { fill: color, stroke: false }));
        inkFill(ctx, pts, color, oo, nextSeed(oo));
      },
      /** 在多边形内画平行排线（阴影） */
      hatch(pts, o) {
        o = o || {};
        const angle = o.angle == null ? -0.8 : o.angle, gap = o.gap || 14;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const p of pts) {
          x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]);
          x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
        }
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + 10;
        ctx.save();
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.closePath();
        ctx.clip();
        const ca = Math.cos(angle), sa = Math.sin(angle);
        const lo = Object.assign({ width: 2, jitter: 1.2, color: PAL.inkSoft, alpha: 0.6 }, o);
        let k = 0;
        for (let d = -R; d <= R; d += gap) {
          const px = cx - sa * d, py = cy + ca * d;
          g.line(px - ca * R, py - sa * R, px + ca * R, py + sa * R, Object.assign({}, lo, { seed: (lo.seed | 0) + k++ }));
        }
        ctx.restore();
      },
      /**
       * 手写文字。
       * 横排：(x,y) 是文字块的对齐点（align: center/left/right），竖直方向居中。
       * 竖排（vertical:true）：(x,y) 是第一列第一个字的顶部中心，列从右往左排。
       * progress 控制逐字出现；pop 控制新字弹出效果。
       */
      text(str, x, y, o) {
        o = o || {};
        const size = o.size || 64;
        const font = FONTS[o.font || 'hand'] || o.font;
        const align = o.align || 'center';
        const lines = String(str).split('\n').map((l) => Array.from(l));
        const total = lines.reduce((a, l) => a + l.length, 0);
        const shown = o.progress == null ? total : clamp(o.progress) * total;
        const wob = o.wobble == null ? 1 : o.wobble;
        const lh = size * (o.lineHeight || 1.25);
        const sp = o.spacing || 0;
        ctx.save();
        ctx.font = `${o.weight || ''} ${size}px ${font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        const baseAlpha = ctx.globalAlpha * (o.alpha == null ? 1 : o.alpha);
        let idx = 0, maxW = 0;
        const seed0 = o.seed | 0;
        const charAt = (ch, cx, cy, i) => {
          const part = clamp(shown - i);
          if (part <= 0) return;
          const s = o.still ? hash(i, seed0, 3) : hash(i, seed0, boil + 3);
          const dx = (rand(s, 1) - 0.5) * 3 * wob, dy = (rand(s, 2) - 0.5) * 3 * wob;
          const rot = (rand(s, 3) - 0.5) * 0.09 * wob + (o.rot || 0);
          const pop = o.pop === false ? 1 : lerp(1.5, 1, ease.outBack(part));
          ctx.save();
          ctx.translate(cx + dx, cy + dy);
          ctx.rotate(rot);
          ctx.scale(pop, pop);
          ctx.globalAlpha = baseAlpha * (o.pop === false ? 1 : clamp(part * 1.6));
          if (o.shadow) {
            ctx.fillStyle = o.shadow.color || PAL.red;
            ctx.fillText(ch, o.shadow.dx || 5, o.shadow.dy || 5);
          }
          if (o.stroke) {
            ctx.strokeStyle = o.stroke;
            ctx.lineWidth = o.strokeWidth || size * 0.16;
            ctx.strokeText(ch, 0, 0);
          }
          ctx.fillStyle = o.color || PAL.ink;
          ctx.fillText(ch, 0, 0);
          ctx.restore();
        };
        if (o.vertical) {
          const colGap = size * (o.lineHeight || 1.35);
          const step = size * 1.05 + sp;
          lines.forEach((l, li) => {
            const cx = x - li * colGap;
            l.forEach((ch, ci) => charAt(ch, cx, y + size / 2 + ci * step, idx++));
          });
        } else {
          const widths = lines.map((l) => l.map((ch) => ctx.measureText(ch).width + sp));
          const blockH = lines.length * lh;
          lines.forEach((l, li) => {
            const lw = widths[li].reduce((a, b) => a + b, 0) - (l.length ? sp : 0);
            maxW = Math.max(maxW, lw);
            let cx = align === 'left' ? x : align === 'right' ? x - lw : x - lw / 2;
            const cy = y - blockH / 2 + lh * (li + 0.5);
            l.forEach((ch, ci) => {
              const cw = widths[li][ci];
              charAt(ch, cx + (cw - sp) / 2, cy, idx++);
              cx += cw;
            });
          });
        }
        ctx.restore();
        return maxW;
      },
      /** 画当前歌词（info.lyric）。场景想自己摆歌词时调用，参数同 text */
      lyric(L, o) {
        L = L === undefined ? info.lyric : L;
        if (!L || !L.text) return;
        o = o || {};
        const dark = o.dark != null ? o.dark : info.dark;
        const dt = info.songTime - L.t0;
        const len = Array.from(L.text).length || 1;
        const prog = clamp((dt * CFG.lyricCps) / len);
        const out = L.t1 - info.songTime;
        const alpha = clamp(out / 0.3) * clamp(dt / 0.15);
        g.text(L.text, o.x == null ? W / 2 : o.x, o.y == null ? H - 92 : o.y, Object.assign({
          size: 58,
          font: 'hand',
          color: dark ? '#fbfcff' : PAL.ink,
          stroke: dark ? 'rgba(18,23,41,0.85)' : 'rgba(250,246,238,0.92)',
          strokeWidth: 12,
          progress: prog,
          seed: L.i * 13,
        }, o, { alpha: alpha * (o.alpha == null ? 1 : o.alpha) }));
      },
      /**
       * 下雪（无状态，按时间计算每片雪的位置，可随意跳转）。
       * o: {t, count, seed, speed:[min,max], size:[min,max], wind, sway, color, alpha, area:[x,y,w,h], crystal}
       */
      snow(o) {
        o = o || {};
        const t = o.t == null ? info.songTime : o.t;
        const count = o.count == null ? 120 : o.count;
        const seed = o.seed == null ? 1 : o.seed;
        const sp = o.speed || [40, 110], sz = o.size || [2, 7];
        const wind = o.wind == null ? 18 : o.wind, sway = o.sway == null ? 26 : o.sway;
        const [ax, ay, aw, ah] = o.area || [0, 0, W, H];
        const color = o.color || PAL.snow;
        const crystal = o.crystal == null ? 9 : o.crystal;
        ctx.save();
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        const baseA = ctx.globalAlpha * (o.alpha == null ? 0.92 : o.alpha);
        for (let i = 0; i < count; i++) {
          const r1 = rand(i, seed, 1), r2 = rand(i, seed, 2), r3 = rand(i, seed, 3), r4 = rand(i, seed, 4), r5 = rand(i, seed, 5);
          const size = lerp(sz[0], sz[1], r1 * r1);
          const depth = (size - sz[0]) / Math.max(0.01, sz[1] - sz[0]);
          const v = lerp(sp[0], sp[1], r2) * (0.65 + 0.35 * depth);
          const span = ah + 60;
          const y = ay - 30 + (((r3 * span + t * v) % span) + span) % span;
          let x = r4 * aw + t * wind * (0.5 + depth) + Math.sin(t * (0.4 + r5 * 0.8) + i) * sway;
          x = ax + ((x % aw) + aw) % aw;
          ctx.globalAlpha = baseA * (0.45 + 0.55 * depth);
          if (size >= crystal) {
            const a0 = t * (r5 - 0.5) * 1.5 + r1 * 6;
            ctx.lineWidth = Math.max(1.2, size * 0.16);
            ctx.beginPath();
            for (let k = 0; k < 3; k++) {
              const a = a0 + (k * Math.PI) / 3;
              ctx.moveTo(x - Math.cos(a) * size, y - Math.sin(a) * size);
              ctx.lineTo(x + Math.cos(a) * size, y + Math.sin(a) * size);
            }
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(x, y, size / 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      },
      /** 铺背景色（可以是渐变色数组 [上, 下]） */
      bg(color) {
        ctx.save();
        if (Array.isArray(color)) {
          const gr = ctx.createLinearGradient(0, 0, 0, H);
          color.forEach((c, i) => gr.addColorStop(i / (color.length - 1), c));
          ctx.fillStyle = gr;
        } else ctx.fillStyle = color || PAL.paper;
        ctx.fillRect(-20, -20, W + 40, H + 40);
        ctx.restore();
      },
      /** 暗角 */
      vignette(a = 0.35, color = '#000') {
        const gr = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
        gr.addColorStop(0, rgba(color, 0));
        gr.addColorStop(1, rgba(color, a));
        ctx.save();
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      },
      /** 柔光（发光圆） */
      glow(x, y, r, color, a = 0.6) {
        const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, rgba(color, a));
        gr.addColorStop(1, rgba(color, 0));
        ctx.save();
        ctx.fillStyle = gr;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.restore();
      },
      /** 镜头：以 (cx,cy) 为中心缩放/旋转，配合 g.ctx.save()/restore() 使用 */
      camera(cx, cy, zoom = 1, rot = 0, dx = 0, dy = 0) {
        ctx.translate(W / 2 + dx, H / 2 + dy);
        ctx.rotate(rot);
        ctx.scale(zoom, zoom);
        ctx.translate(-cx, -cy);
      },
      /** 手持晃动偏移量（每帧随机，amount 像素） */
      shake(amount = 6) {
        return [(rand(boil, 91) - 0.5) * 2 * amount, (rand(boil, 92) - 0.5) * 2 * amount];
      },
      save() { ctx.save(); },
      restore() { ctx.restore(); },
    };
    return g;
  }

  // ------------------------------------------------------------------ 歌词
  const CREDIT_RE = /^(作?词|作?曲|编曲|制作|监制|演唱|原唱|歌手|混音|母带|和声|吉他|贝斯|鼓|弦乐|录音|出品|发行|OP|SP|Lyric|Lyrics|Composer|Arrange|Producer)\s*[:：]/i;
  function parseLRC(text) {
    const lines = [];
    let offset = 0;
    for (const raw of String(text).split(/\r?\n/)) {
      const om = raw.match(/^\s*\[offset:\s*([+-]?\d+)\s*\]/i);
      if (om) { offset = +om[1] / 1000; continue; }
      const tags = [...raw.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
      if (!tags.length) continue;
      const clean = raw.replace(/\[[^\]]*\]/g, '').replace(/<\d+:\d+(?:[.:]\d+)?>/g, '').trim();
      for (const tg of tags) lines.push({ t: +tg[1] * 60 + parseFloat(tg[2].replace(':', '.')), text: clean });
    }
    lines.sort((a, b) => a.t - b.t);
    lines.forEach((l, i) => {
      l.t = Math.max(0, l.t - offset);
      l.i = i;
      l.credit = !l.text || CREDIT_RE.test(l.text) || / - /.test(l.text);
    });
    return lines;
  }

  // ------------------------------------------------------------------ 状态
  const TG = (window.TG = window.TG || {});
  TG.W = W; TG.H = H; TG.CFG = CFG; TG.PAL = PAL; TG.FONTS = FONTS;
  TG.U = { clamp, lerp, remap, seg, ease, rand, hash, seedOf, rng, noise1, mix, rgba, catmull, PAL };

  const sceneDefs = {};
  let order = [];         // [{id, at, section, w}]
  let starts = [];        // 每个场景的开始时间（秒）
  let duration = CFG.defaultDuration;
  let lyrics = [];
  let marks = null;       // 用户打点（秒）
  let markUndo = [];
  let bpm = 0, beatOffset = 0;
  let lastRenderedQ = -1, dirty = true;
  const errorsLogged = new Set();
  const params = new URLSearchParams(location.search);

  TG.scene = function (def) {
    if (!def || !def.id || typeof def.draw !== 'function') throw new Error('TG.scene 需要 {id, draw}');
    sceneDefs[def.id] = def;
    dirty = true;
  };
  TG.timeline = function (list) {
    order = list.map((x) => (typeof x === 'string' ? { id: x } : Object.assign({}, x)));
    dirty = true;
  };
  TG.scenes = () => order.map((o) => Object.assign({ title: (sceneDefs[o.id] || {}).title || o.id }, o));

  function proportionalStarts() {
    const n = order.length;
    const out = new Array(n);
    if (order.every((o) => typeof o.at === 'number')) {
      for (let i = 0; i < n; i++) out[i] = order[i].at * duration;
    } else {
      const tot = order.reduce((a, o) => a + (o.w || 1), 0);
      let acc = 0;
      for (let i = 0; i < n; i++) { out[i] = (acc / tot) * duration; acc += order[i].w || 1; }
    }
    out[0] = 0;
    return out;
  }

  /** 根据歌词时间自动对齐：前奏=第一句之前，尾声=最后一句之后，间奏=中段最长的空白 */
  function lyricStarts() {
    const vocal = lyrics.filter((l) => !l.credit);
    if (vocal.length < 6) return null;
    const first = vocal[0].t;
    const last = vocal[vocal.length - 1].t;
    let gapA = -1, gapB = -1, best = 0;
    for (let i = 1; i < vocal.length; i++) {
      const a = vocal[i - 1].t, b = vocal[i].t;
      if (a < duration * 0.3 || b > duration * 0.8) continue;
      if (b - a > best) { best = b - a; gapA = a; gapB = b; }
    }
    const lastLineLen = Math.min(8, Math.max(4, Array.from(vocal[vocal.length - 1].text).length * 0.45));
    const outroStart = Math.min(duration - 4, last + lastLineLen);
    const interStart = best > 9 ? gapA + Math.min(7, Math.max(4, best * 0.35)) : null;
    const bounds = {
      intro: [0, first],
      verse1: [first, interStart != null ? interStart : (first + outroStart) / 2],
      interlude: interStart != null ? [interStart, gapB] : null,
      verse2: [interStart != null ? gapB : (first + outroStart) / 2, outroStart],
      outro: [outroStart, duration],
    };
    const out = new Array(order.length);
    const bySec = {};
    order.forEach((o, i) => { (bySec[o.section || 'verse1'] = bySec[o.section || 'verse1'] || []).push(i); });
    for (const sec in bySec) {
      let b = bounds[sec];
      if (!b) return null;
      const idxs = bySec[sec];
      const tot = idxs.reduce((a, i) => a + (order[i].w || 1), 0);
      let acc = 0;
      const lineTimes = vocal.map((l) => l.t).filter((t) => t > b[0] + 1 && t < b[1] - 1);
      idxs.forEach((i, k) => {
        let s = b[0] + ((b[1] - b[0]) * acc) / tot;
        if (k > 0 && lineTimes.length) {
          // 切镜头落在最近的一句歌词开头
          let near = lineTimes[0];
          for (const lt of lineTimes) if (Math.abs(lt - s) < Math.abs(near - s)) near = lt;
          if (Math.abs(near - s) < (b[1] - b[0]) / tot / 2) s = near - 0.15;
        }
        out[i] = s;
        acc += order[i].w || 1;
      });
    }
    out[0] = 0;
    for (let i = 1; i < out.length; i++) if (!(out[i] > out[i - 1] + 1)) return null;
    return out;
  }

  function computeStarts() {
    const n = order.length;
    if (marks && marks.length === n) starts = marks.slice();
    else starts = (lyrics.length && lyricStarts()) || proportionalStarts();
    dirty = true;
    if (TG.onTimeline) TG.onTimeline();
  }
  TG.starts = () => starts.slice();
  TG.duration = () => duration;

  function sceneIndexAt(T) {
    let i = 0;
    while (i + 1 < starts.length && T >= starts[i + 1]) i++;
    return i;
  }
  function lyricAt(T) {
    if (!lyrics.length) return null;
    let i = -1;
    for (let k = 0; k < lyrics.length; k++) { if (lyrics[k].t <= T) i = k; else break; }
    if (i < 0) return null;
    const L = lyrics[i];
    if (!L.text) return null;
    const next = lyrics[i + 1];
    const t1 = Math.min(next ? next.t : L.t + 8, L.t + Math.max(6, Array.from(L.text).length * 0.6) + 2);
    if (T >= t1) return null;
    return { text: L.text, t0: L.t, t1, i: L.i, p: clamp((T - L.t) / (t1 - L.t)), credit: L.credit };
  }

  // ------------------------------------------------------------------ 渲染
  let canvas, ctx, bufA, bufB;
  function mkBuf() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    return c;
  }

  function frameInfo(i, T) {
    const id = order[i].id;
    const def = sceneDefs[id] || {};
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : duration;
    const dur = Math.max(0.001, end - start);
    const t = clamp(T - start, 0, dur);
    const beatLen = bpm > 0 ? 60 / bpm : 0;
    const beat = beatLen ? (T - beatOffset) / beatLen : 0;
    const beatPhase = beatLen ? ((beat % 1) + 1) % 1 : 0;
    return {
      id, index: i, title: def.title || id,
      songTime: T, t, p: t / dur, dur, start, end, duration,
      frame: Math.floor(T * CFG.animFps + 1e-6),
      boil: Math.floor(T * CFG.animFps + 1e-6),
      bpm, beat, beatPhase, pulse: beatLen ? Math.exp(-beatPhase * 5) : 0,
      lyric: lyricAt(T),
      dark: !!def.dark,
      prev: i > 0 ? order[i - 1].id : null,
      next: i + 1 < order.length ? order[i + 1].id : null,
    };
  }

  function drawScene(target, i, T) {
    const c = target.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    const info = frameInfo(i, T);
    const def = sceneDefs[info.id];
    c.fillStyle = def && def.dark ? PAL.night : PAL.paper;
    c.fillRect(0, 0, W, H);
    if (!def) {
      placeholder(c, info);
      return info;
    }
    const g = makeG(c, info);
    c.save();
    try {
      def.draw(g, info.p, info.t, info);
    } catch (e) {
      const key = info.id + ':' + e.message;
      if (!errorsLogged.has(key)) { errorsLogged.add(key); console.error(`[scene ${info.id}]`, e); }
      c.restore(); c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = 'rgba(200,0,0,.85)';
      c.font = '28px monospace';
      c.fillText(`scene "${info.id}" error: ${e.message}`, 40, 60);
    }
    c.restore();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    if (def.lyrics !== 'none' && info.lyric) {
      const style = typeof def.lyrics === 'object' ? def.lyrics : {};
      g.lyric(info.lyric, style);
    }
    return info;
  }

  function placeholder(c, info) {
    const g = makeG(c, info);
    g.bg(PAL.paper);
    g.text(`「${info.id}」`, W / 2, H / 2 - 40, { size: 90 });
    g.text('（这个场景还没画）', W / 2, H / 2 + 70, { size: 48, color: PAL.inkSoft });
  }

  const TR_DUR = { cut: 0, fade: 0.6, flash: 0.45, wipe: 0.7, black: 0.8, iris: 0.8 };

  function renderAt(T, opt) {
    opt = opt || {};
    if (!order.length) return;
    T = clamp(T, 0, duration - 1e-3);
    const i = opt.index != null ? opt.index : sceneIndexAt(T);
    const info = drawScene(bufA, i, T);
    const def = sceneDefs[info.id] || {};
    const tr = def.transition || 'cut';
    const trDur = def.transitionDur != null ? def.transitionDur : TR_DUR[tr] || 0;
    const since = T - starts[i];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (i > 0 && trDur > 0 && since < trDur && opt.transition !== false) {
      const k = clamp(since / trDur);
      drawScene(bufB, i - 1, Math.min(T, starts[i] - 1e-3));
      composite(tr, k, info);
    } else {
      ctx.drawImage(bufA, 0, 0);
    }
    // 纸纹
    const strength = def.paper == null ? CFG.paper : def.paper;
    if (strength > 0) {
      if (!paperTex) paperTex = makePaper();
      const ox = Math.floor(rand(info.boil, 5) * 3) * 6, oy = Math.floor(rand(info.boil, 6) * 3) * 6;
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = strength;
      ctx.drawImage(paperTex, -ox, -oy);
      ctx.restore();
    }
    TG.current = info;
    return info;
  }

  function composite(tr, k, info) {
    const e = ease.inOut(k);
    if (tr === 'fade') {
      ctx.drawImage(bufB, 0, 0);
      ctx.globalAlpha = e;
      ctx.drawImage(bufA, 0, 0);
      ctx.globalAlpha = 1;
    } else if (tr === 'flash') {
      ctx.drawImage(bufA, 0, 0);
      ctx.fillStyle = `rgba(255,253,246,${1 - ease.out(k)})`;
      ctx.fillRect(0, 0, W, H);
    } else if (tr === 'black') {
      if (k < 0.5) {
        ctx.drawImage(bufB, 0, 0);
        ctx.fillStyle = `rgba(10,12,22,${ease.inOut(k * 2)})`;
      } else {
        ctx.drawImage(bufA, 0, 0);
        ctx.fillStyle = `rgba(10,12,22,${1 - ease.inOut(k * 2 - 1)})`;
      }
      ctx.fillRect(0, 0, W, H);
    } else if (tr === 'wipe') {
      // 毛笔横扫过去的擦除
      ctx.drawImage(bufB, 0, 0);
      const edge = lerp(-260, W + 260, e);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      for (let y = -10; y <= H + 10; y += 30) ctx.lineTo(edge + noise1(y / 90, info.boil) * 70 - (y / H) * 160, y);
      ctx.lineTo(-10, H + 10);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(bufA, 0, 0);
      ctx.restore();
    } else if (tr === 'iris') {
      ctx.drawImage(bufB, 0, 0);
      ctx.save();
      ctx.beginPath();
      const r = ease.inCubic(k) * Math.hypot(W, H) * 0.55 + 2;
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.12) {
        const rr = r * (1 + noise1(a * 2, info.boil) * 0.05);
        ctx.lineTo(W / 2 + Math.cos(a) * rr, H / 2 + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(bufA, 0, 0);
      ctx.restore();
    } else ctx.drawImage(bufA, 0, 0);
  }

  // ------------------------------------------------------------------ 时钟 / 音频
  const audio = new Audio();
  audio.preload = 'auto';
  let audioReady = false, audioIsBlob = false;
  const clock = {
    playing: false, base: 0, t0: 0,
    now() {
      if (audioReady) return audio.currentTime;
      if (!this.playing) return this.base;
      const t = this.base + (performance.now() - this.t0) / 1000;
      if (t >= duration) { this.base = duration - 0.001; this.playing = false; onEnded(); return this.base; }
      return t;
    },
    play() {
      if (audioReady) { const p = audio.play(); if (p && p.catch) p.catch(() => {}); }
      else { this.t0 = performance.now(); this.playing = true; }
      dirty = true; updatePlayBtn(true);
    },
    pause() {
      if (audioReady) audio.pause();
      else { this.base = this.now(); this.playing = false; }
      dirty = true; updatePlayBtn(false);
    },
    isPlaying() { return audioReady ? !audio.paused : this.playing; },
    seek(t) {
      t = clamp(t, 0, duration - 0.01);
      if (audioReady) audio.currentTime = t;
      else { this.base = t; this.t0 = performance.now(); }
      dirty = true;
    },
  };
  TG.clock = clock;
  audio.addEventListener('ended', () => onEnded());
  audio.addEventListener('play', () => updatePlayBtn(true));
  audio.addEventListener('pause', () => updatePlayBtn(false));

  function loadAudioURL(url, isBlob, name) {
    return new Promise((res) => {
      const done = (ok) => { audio.removeEventListener('loadedmetadata', onMeta); audio.removeEventListener('error', onErr); res(ok); };
      const onMeta = () => {
        audioReady = true; audioIsBlob = isBlob;
        duration = audio.duration && isFinite(audio.duration) ? audio.duration : CFG.defaultDuration;
        clock.playing = false;
        loadMarks();
        computeStarts();
        toast(`音乐已载入：${name || ''}（${fmt(duration)}）`);
        done(true);
      };
      const onErr = () => done(false);
      audio.addEventListener('loadedmetadata', onMeta);
      audio.addEventListener('error', onErr);
      audio.src = url;
      audio.load();
    });
  }
  TG.loadAudioFile = (file) => loadAudioURL(URL.createObjectURL(file), true, file.name);

  TG.loadLyricsText = function (text, name) {
    lyrics = parseLRC(text);
    computeStarts();
    collectGlyphs(lyrics.map((l) => l.text).join(''));
    toast(lyrics.length ? `歌词已载入：${lyrics.length} 行${name ? '（' + name + '）' : ''}` : '没有在文件里找到 LRC 时间标签');
  };
  TG.lyrics = () => lyrics.slice();

  // ------------------------------------------------------------------ 打点（对拍）
  const MARK_KEY = 'snowman-tegaki:marks';
  function storeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function storeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 隐私模式等 */ } }
  function loadMarks() {
    marks = null;
    const raw = storeGet(MARK_KEY);
    if (!raw) return;
    try {
      const j = JSON.parse(raw);
      if (j && Array.isArray(j.marks) && Array.isArray(j.ids) && j.ids.join() === order.map((o) => o.id).join()) {
        if (!j.duration || Math.abs(j.duration - duration) < 3) marks = j.marks;
      }
    } catch (e) { /* ignore */ }
  }
  function saveMarks() {
    if (marks) storeSet(MARK_KEY, JSON.stringify({ v: 1, duration, ids: order.map((o) => o.id), marks }));
    else storeSet(MARK_KEY, '');
  }
  TG.setMarks = function (m) {
    marks = m ? m.slice() : null;
    saveMarks();
    computeStarts();
  };
  function markHere() {
    const T = clock.now();
    const i = sceneIndexAt(T);
    if (i + 1 >= order.length) { toast('已经是最后一个场景了'); return; }
    markUndo.push(starts.slice());
    const m = starts.slice();
    const oldNext = m[i + 1];
    m[i + 1] = Math.max(m[i] + 0.5, T);
    // 后面的场景按原比例挤进剩下的时间里
    const remainOld = duration - oldNext, remainNew = duration - m[i + 1];
    for (let k = i + 2; k < m.length; k++) m[k] = m[i + 1] + ((m[k] - oldNext) * remainNew) / Math.max(1, remainOld);
    TG.setMarks(m);
    toast(`「${titleOf(i + 1)}」从 ${fmt(m[i + 1])} 开始`);
  }
  function nudge(dt) {
    const T = clock.now();
    const i = sceneIndexAt(T);
    if (i === 0) return;
    markUndo.push(starts.slice());
    const m = starts.slice();
    m[i] = clamp(m[i] + dt, m[i - 1] + 0.5, (i + 1 < m.length ? m[i + 1] : duration) - 0.5);
    TG.setMarks(m);
    toast(`「${titleOf(i)}」起点 ${fmt(m[i])}`);
  }
  function undoMark() {
    if (!markUndo.length) { toast('没有可以撤销的打点'); return; }
    TG.setMarks(markUndo.pop());
    toast('已撤销');
  }
  function exportTimeline() {
    const data = {
      song: '雪人', duration: +duration.toFixed(3),
      scenes: order.map((o, i) => ({ id: o.id, title: titleOf(i), start: +starts[i].toFixed(3) })),
      bpm, beatOffset,
    };
    const txt = JSON.stringify(data, null, 2);
    download(new Blob([txt], { type: 'application/json' }), 'snowman-timeline.json');
    if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});
    toast('时间轴已导出（也复制到了剪贴板）');
  }
  function importTimeline(text) {
    try {
      const j = JSON.parse(text);
      const byId = {};
      (j.scenes || []).forEach((s) => (byId[s.id] = s.start));
      const m = order.map((o) => byId[o.id]);
      if (m.some((v) => typeof v !== 'number')) throw new Error('场景不匹配');
      if (j.bpm) { bpm = j.bpm; beatOffset = j.beatOffset || 0; saveBeat(); }
      TG.setMarks(m);
      toast('时间轴已导入');
    } catch (e) { toast('时间轴文件读取失败：' + e.message); }
  }

  // ------------------------------------------------------------------ 节拍（可选）
  const BEAT_KEY = 'snowman-tegaki:beat';
  let taps = [];
  function saveBeat() { storeSet(BEAT_KEY, JSON.stringify({ bpm, beatOffset })); }
  function loadBeat() {
    try { const j = JSON.parse(storeGet(BEAT_KEY) || 'null'); if (j) { bpm = j.bpm || 0; beatOffset = j.beatOffset || 0; } } catch (e) { /* ignore */ }
  }
  function tapBeat() {
    const T = clock.now();
    if (taps.length && T - taps[taps.length - 1] > 2.5) taps = [];
    taps.push(T);
    if (taps.length >= 4) {
      const iv = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
      bpm = Math.round((60 / iv) * 10) / 10;
      beatOffset = taps[taps.length - 1] % iv;
      saveBeat();
      toast(`节拍 ${bpm} BPM（继续按 B 会更准）`);
    } else toast(`敲拍子 ${taps.length}/4`);
  }

  // ------------------------------------------------------------------ 录制视频
  let recorder = null, actx = null, mediaSrc = null;
  async function startRecording() {
    if (recorder) { stopRecording(); return; }
    if (!window.MediaRecorder || !canvas.captureStream) { toast('这个浏览器不支持录制，建议用电脑版 Chrome / Edge'); return; }
    if (audioReady && !audioIsBlob && location.protocol === 'file:') {
      toast('录制需要通过「选择音乐」按钮载入 mp3（本地打开时浏览器的安全限制）');
      return;
    }
    const stream = canvas.captureStream(30);
    if (audioReady) {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (!mediaSrc) { mediaSrc = actx.createMediaElementSource(audio); mediaSrc.connect(actx.destination); }
      const dest = actx.createMediaStreamDestination();
      mediaSrc.connect(dest);
      dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
      if (actx.state === 'suspended') await actx.resume();
    }
    const types = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    const chunks = [];
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 12e6 } : undefined);
    recorder.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const type = recorder.mimeType || mime || 'video/webm';
      const blob = new Blob(chunks, { type });
      download(blob, 'snowman-tegaki.' + (type.includes('mp4') ? 'mp4' : 'webm'));
      recorder = null;
      document.body.classList.remove('recording');
      toast('录制完成，视频已下载');
    };
    clock.pause();
    clock.seek(0);
    document.body.classList.add('recording');
    recorder.start(1000);
    clock.play();
    toast('录制中……播完会自动保存（再按一次 R 提前结束）');
  }
  function stopRecording() { if (recorder && recorder.state !== 'inactive') recorder.stop(); }
  function onEnded() { updatePlayBtn(false); if (recorder) stopRecording(); }

  // ------------------------------------------------------------------ 字体
  let glyphs = new Set(Array.from('雪人手书一片冬等你春天融化回忆再见圣诞快乐好冷心MerryChristmasFin0123456789：·，。！？'));
  function collectGlyphs(str) {
    let added = false;
    for (const ch of Array.from(str || '')) if (!glyphs.has(ch)) { glyphs.add(ch); added = true; }
    if (added && fontsBooted) loadFonts(1500);
  }
  let fontsBooted = false;
  function loadFonts(timeout) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const text = Array.from(glyphs).join('');
    const fams = ['"Long Cang"', '"Ma Shan Zheng"', '"ZCOOL KuaiLe"', '"Caveat"'];
    const all = Promise.all(fams.map((f) => document.fonts.load(`64px ${f}`, text).catch(() => null)));
    return Promise.race([all, new Promise((r) => setTimeout(r, timeout))]).then(() => { dirty = true; });
  }

  // ------------------------------------------------------------------ HUD
  let hud = {};
  function $(id) { return document.getElementById(id); }
  function fmt(s) {
    s = Math.max(0, s || 0);
    const m = Math.floor(s / 60), r = s - m * 60;
    return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`;
  }
  function titleOf(i) { const o = order[i]; return o ? (sceneDefs[o.id] || {}).title || o.id : ''; }
  let toastTimer = 0;
  function toast(msg) {
    const el = $('toast');
    if (!el) { console.log('[toast]', msg); return; }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }
  TG.toast = toast;
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  function updatePlayBtn(playing) {
    const b = $('btnPlay');
    if (b) b.textContent = playing ? '❚❚' : '▶';
    document.body.classList.toggle('playing', !!playing);
  }
  function buildBar() {
    const bar = $('bar');
    if (!bar) return;
    bar.querySelectorAll('.segm').forEach((e) => e.remove());
    order.forEach((o, i) => {
      const s = document.createElement('div');
      s.className = 'segm' + (i % 2 ? ' alt' : '');
      const end = i + 1 < starts.length ? starts[i + 1] : duration;
      s.style.left = (starts[i] / duration) * 100 + '%';
      s.style.width = ((end - starts[i]) / duration) * 100 + '%';
      s.title = `${i + 1}. ${titleOf(i)}  ${fmt(starts[i])}`;
      bar.insertBefore(s, bar.firstChild);
    });
  }
  TG.onTimeline = buildBar;
  function updateHud(T) {
    if (!hud.time) return;
    hud.time.textContent = `${fmt(T)} / ${fmt(duration)}`;
    const i = sceneIndexAt(T);
    hud.scene.textContent = `${i + 1}/${order.length} · ${titleOf(i)}`;
    hud.head.style.left = (T / duration) * 100 + '%';
  }
  let idleTimer = 0;
  function poke() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (clock.isPlaying()) document.body.classList.add('idle'); }, 2600);
  }
  let markMode = false;
  function setMarkMode(on) {
    markMode = on;
    document.body.classList.toggle('markmode', on);
    toast(on ? '打点模式：听到该换场景时按 K（或点「打点」）· U 撤销 · [ ] 微调 · Esc 退出' : '已退出打点模式');
  }

  function wireUI() {
    hud = { time: $('time'), scene: $('sceneName'), head: $('head') };
    const fA = $('fAudio'), fL = $('fLrc'), fT = $('fTimeline');
    const pickAudio = () => fA && fA.click();
    const pickLrc = () => fL && fL.click();
    fA && fA.addEventListener('change', async () => {
      if (!fA.files[0]) return;
      const ok = await TG.loadAudioFile(fA.files[0]);
      fA.value = '';
      if (ok) { hideStart(); clock.seek(0); clock.play(); } else toast('这个文件放不了，换一个 mp3 试试');
    });
    fL && fL.addEventListener('change', async () => {
      if (!fL.files[0]) return;
      TG.loadLyricsText(await fL.files[0].text(), fL.files[0].name);
      fL.value = '';
    });
    fT && fT.addEventListener('change', async () => {
      if (!fT.files[0]) return;
      importTimeline(await fT.files[0].text());
      fT.value = '';
    });
    const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); };
    on('startAudio', pickAudio);
    on('startLrc', pickLrc);
    on('startPreview', () => { hideStart(); clock.seek(0); clock.play(); });
    on('btnPlay', () => (clock.isPlaying() ? clock.pause() : clock.play()));
    on('btnAudio', pickAudio);
    on('btnLrc', pickLrc);
    on('btnRec', startRecording);
    on('btnFull', toggleFull);
    on('btnMark', () => setMarkMode(!markMode));
    on('btnMarkHere', markHere);
    on('btnUndo', undoMark);
    on('btnExport', exportTimeline);
    on('btnImport', () => fT && fT.click());
    on('btnReset', () => { if (confirm('清空所有打点，恢复默认时间轴？')) { markUndo.push(starts.slice()); TG.setMarks(null); } });
    on('btnHelp', () => document.body.classList.toggle('help'));
    on('helpClose', () => document.body.classList.remove('help'));
    const bar = $('bar');
    if (bar) {
      const seekFromEvent = (e) => {
        const r = bar.getBoundingClientRect();
        clock.seek(((e.clientX - r.left) / r.width) * duration);
      };
      let dragging = false;
      bar.addEventListener('pointerdown', (e) => { dragging = true; bar.setPointerCapture(e.pointerId); seekFromEvent(e); });
      bar.addEventListener('pointermove', (e) => dragging && seekFromEvent(e));
      bar.addEventListener('pointerup', () => (dragging = false));
    }
    const stage = $('stage');
    stage && stage.addEventListener('click', () => {
      if (document.body.classList.contains('started')) {
        if (document.body.classList.contains('idle') || !clock.isPlaying()) { poke(); if (!clock.isPlaying()) clock.play(); }
        else clock.pause();
      }
    });
    window.addEventListener('pointermove', poke);
    window.addEventListener('keydown', onKey);
    // 拖文件进来
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      for (const f of e.dataTransfer.files) {
        const name = f.name.toLowerCase();
        if (f.type.startsWith('audio/') || /\.(mp3|m4a|flac|wav|ogg|aac)$/.test(name)) {
          if (await TG.loadAudioFile(f)) { hideStart(); clock.seek(0); clock.play(); }
        } else if (/\.(lrc|txt)$/.test(name)) TG.loadLyricsText(await f.text(), f.name);
        else if (/\.json$/.test(name)) importTimeline(await f.text());
      }
    });
    document.addEventListener('fullscreenchange', () => document.body.classList.toggle('full', !!document.fullscreenElement));
  }
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen();
    else (document.documentElement.requestFullscreen || function () {}).call(document.documentElement);
  }
  function hideStart() { document.body.classList.add('started'); poke(); }
  function onKey(e) {
    if (/input|textarea|select/i.test((e.target && e.target.tagName) || '')) return;
    const k = e.key;
    let used = true;
    if (k === ' ') { if (!document.body.classList.contains('started')) hideStart(); clock.isPlaying() ? clock.pause() : clock.play(); }
    else if (k === 'ArrowLeft') clock.seek(clock.now() - (e.shiftKey ? 1 : 5));
    else if (k === 'ArrowRight') clock.seek(clock.now() + (e.shiftKey ? 1 : 5));
    else if (k === 'ArrowUp') { const i = sceneIndexAt(clock.now()); clock.seek(starts[Math.max(0, clock.now() - starts[i] < 1 ? i - 1 : i)]); }
    else if (k === 'ArrowDown') { const i = sceneIndexAt(clock.now()); if (i + 1 < starts.length) clock.seek(starts[i + 1]); }
    else if (k === 'k' || k === 'K') { if (!markMode) setMarkMode(true); markHere(); }
    else if (k === 'm' || k === 'M') setMarkMode(!markMode);
    else if (k === 'u' || k === 'U') undoMark();
    else if (k === '[') nudge(e.shiftKey ? -1 : -0.1);
    else if (k === ']') nudge(e.shiftKey ? 1 : 0.1);
    else if (k === '{') nudge(-1);
    else if (k === '}') nudge(1);
    else if (k === 'e' || k === 'E') exportTimeline();
    else if (k === 'b' || k === 'B') { if (e.shiftKey) { bpm = 0; saveBeat(); toast('已清除节拍'); } else tapBeat(); }
    else if (k === 'r' || k === 'R') startRecording();
    else if (k === 'f' || k === 'F') toggleFull();
    else if (k === 'h' || k === 'H') document.body.classList.toggle('nohud');
    else if (k === '?' || k === '/') document.body.classList.toggle('help');
    else if (k === 'Escape') { if (markMode) setMarkMode(false); document.body.classList.remove('help'); }
    else used = false;
    if (used) { e.preventDefault(); poke(); dirty = true; }
  }

  // ------------------------------------------------------------------ 启动
  function demoLyrics() {
    const out = [];
    const v = order.findIndex((o) => o.section === 'verse1');
    const t0 = v > 0 ? starts[v] : 18;
    for (let t = t0, k = 1; t < duration - 20; t += 6.5, k++) out.push(`[${Math.floor(t / 60)}:${(t % 60).toFixed(2)}]（示例歌词 第${k}行 · 导入LRC后替换）`);
    return out.join('\n');
  }

  function loop() {
    requestAnimationFrame(loop);
    if (TG.frozen) return;
    const T = clock.now();
    const q = Math.floor(T * CFG.animFps + 1e-6);
    if (q !== lastRenderedQ || dirty) {
      lastRenderedQ = q;
      dirty = false;
      renderAt(q / CFG.animFps);
    }
    updateHud(T);
  }

  /** 截图/调试：定格某个场景的某个进度 p（0..1） */
  TG.renderScene = function (id, p, opt) {
    const i = order.findIndex((o) => o.id === id);
    if (i < 0) throw new Error('没有这个场景：' + id);
    const end = i + 1 < starts.length ? starts[i + 1] : duration;
    const T = starts[i] + clamp(p) * (end - starts[i] - 1e-3);
    TG.frozen = true;
    return renderAt(T, Object.assign({ index: i }, opt));
  };
  TG.renderAt = function (T, opt) { TG.frozen = true; return renderAt(T, opt); };
  TG.unfreeze = function () { TG.frozen = false; dirty = true; };
  TG.canvas = () => canvas;
  /** 把多个进度拼成一张缩略图（方便一眼看完整个场景） */
  TG.contactSheet = function (id, ps, cols = 3, cw = 640) {
    const ch = (cw * 9) / 16;
    const rows = Math.ceil(ps.length / cols);
    const c = document.createElement('canvas');
    c.width = cw * cols; c.height = (ch + 34) * rows;
    const x = c.getContext('2d');
    x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
    ps.forEach((p, k) => {
      TG.renderScene(id, p, { transition: false });
      const cx = (k % cols) * cw, cy = Math.floor(k / cols) * (ch + 34);
      x.drawImage(canvas, cx, cy + 34, cw - 4, ch - 4);
      x.fillStyle = '#ddd'; x.font = '20px monospace';
      x.fillText(`${id}  p=${p}`, cx + 8, cy + 24);
    });
    return c.toDataURL('image/png');
  };

  TG.boot = async function () {
    canvas = $('cv');
    ctx = canvas.getContext('2d');
    bufA = mkBuf(); bufB = mkBuf();
    paperTex = makePaper();
    for (const id in sceneDefs) if (sceneDefs[id].chars) collectGlyphs(sceneDefs[id].chars);
    if (params.get('dur')) duration = +params.get('dur') || duration;
    loadBeat();
    loadMarks();
    computeStarts();
    wireUI();
    if (params.get('demoLyrics')) TG.loadLyricsText(demoLyrics(), 'demo');
    const fontsP = loadFonts(params.get('scene') ? 8000 : 4000);
    fontsBooted = true;
    if (document.fonts) document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => (dirty = true));
    // 同目录下放了 song.mp3 / lyrics.lrc 的话自动载入
    if (!params.get('scene') && !params.get('noauto')) {
      loadAudioURL('song.mp3', false, 'song.mp3').then((ok) => ok && document.body.classList.add('hasSong'));
      fetch('lyrics.lrc').then((r) => (r.ok ? r.text() : null)).then((t) => t && TG.loadLyricsText(t, 'lyrics.lrc')).catch(() => {});
    }
    await fontsP;
    if (params.get('scene')) {
      document.body.classList.add('started', 'nohud');
      TG.renderScene(params.get('scene'), +(params.get('p') || 0), { transition: params.get('tr') === '1' });
    } else if (params.get('t')) {
      hideStart();
      clock.seek(+params.get('t'));
    }
    if (params.get('nostart')) hideStart();
    if (params.get('hud') === '0') document.body.classList.add('nohud');
    requestAnimationFrame(loop);
    TG.isReady = true;
  };
  TG.ready = new Promise((res) => {
    const go = () => TG.boot().then(res, (e) => { console.error(e); res(); });
    if (document.readyState === 'complete') setTimeout(go, 0);
    else window.addEventListener('load', go);
  });
})();
