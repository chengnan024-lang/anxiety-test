/* 场景：flash —— 高潮（手书式闪切）
 *
 * 黑 / 白 / 红 三色。镜头：
 *   S1  0.00–0.10  大特写：雪人的眼睛（半睁 → "啪"地睁大），一笔红色飞白扫过
 *   S2  0.10–0.40  闪切 ×8：「雪」→ 雪花 →「人」→ 雪人 →「等」+钟 → 手套 → 门 →「你」（黑白反相交替）
 *   S3  0.40–0.58  定格：黑夜、红日、风里的雪人，竖排毛笔「雪人等你」一笔一笔写出来
 *   S4  0.58–0.84  分格三连（脸 / 心 / 手套）→ 2×2 黑白棋盘「雪人 / 等你」反复反相 → 红围巾被风拉长，伸向红手套
 *   S5  0.84–1.00  所有东西聚成一幅拼贴 → 炸散成雪花 → 白屏
 *
 * 镜头切点都按 p 计算；用户敲了拍子（info.bpm）时，闪切的切点会吸附到最近的拍上。
 */
(function () {
  'use strict';
  const { clamp, lerp, seg, ease, rand, noise1, rgba, catmull } = TG.U;
  const P = TG.PAL, C = TG.C, W = TG.W, H = TG.H;
  const TAU = Math.PI * 2;

  const INK = '#16141c';
  const WHITE = '#f8f5ee';
  const RED = P.red, RED_D = P.redDeep;
  const SCH = {
    L: { bg: WHITE, fg: INK, snow: INK, snowA: 0.26 },
    D: { bg: INK, fg: WHITE, snow: WHITE, snowA: 0.85 },
    R: { bg: RED, fg: WHITE, snow: WHITE, snowA: 0.7 },
  };

  // 镜头分段（p）
  const S1 = [0, 0.1], S2 = [0.1, 0.4], S3 = [0.4, 0.58];
  const S4A = [0.58, 0.67], S4B = [0.67, 0.76], S4C = [0.76, 0.84], S5 = [0.84, 1];
  const S2_CARDS = ['xue', 'flake', 'ren', 'snowman', 'deng', 'mitten', 'door', 'ni'];

  // ------------------------------------------------------------------ 小工具

  /** 把 [a,b]（p）均分 n 段，敲了拍子时切点吸附到拍上。返回当前段 {i, lt(秒), lp, len} */
  function cuts(info, a, b, n, minGap) {
    minGap = minGap || 0.3;
    const D = info.dur, t = info.t;
    const B = [];
    for (let k = 0; k <= n; k++) B.push((a + ((b - a) * k) / n) * D);
    if (info.bpm > 0) {
      const bl = 60 / info.bpm;
      const off = info.songTime - info.beat * bl;
      for (let k = 1; k < n; k++) {
        const q = off + Math.round((info.start + B[k] - off) / bl) * bl - info.start;
        if (Math.abs(q - B[k]) <= bl * 0.5 + 1e-6 && q - B[k - 1] >= minGap && B[k + 1] - q >= minGap) B[k] = q;
      }
    }
    let i = 0;
    while (i < n - 1 && t >= B[i + 1]) i++;
    const len = Math.max(1e-3, B[i + 1] - B[i]);
    // f：卡片很短（用户把这一幕压到十几秒）时，卡片里的小动画按比例加快，保证能播完
    return { i, lt: Math.max(0, t - B[i]), lp: clamp((t - B[i]) / len), len, f: Math.min(1, len / 1.1), info, t };
  }

  /** 卡片内的小动画进度：a 秒后开始、持续 d 秒（随卡片长度缩放） */
  const ck = (c, a, d) => clamp((c.lt - a * c.f) / (d * c.f));

  /** 在一个镜头（p 段）里的本地时间 */
  function local(info, p, S) {
    const u = seg(p, S[0], S[1]);
    const D = (S[1] - S[0]) * info.dur;
    return { u, D, lt: u * D };
  }

  const impact = (lt, k) => Math.exp(-lt * (k || 13));

  /** 盖章式出现：从大一圈、略歪的样子"啪"地落下 */
  function stampOn(g, x, y, lt, o) {
    o = o || {};
    const e = impact(lt, o.k || 13);
    const s = (o.base || 1) * (1 + (o.from == null ? 0.38 : o.from) * e);
    const r = (o.rot || 0) + (o.spin == null ? -0.12 : o.spin) * e;
    g.ctx.translate(x, y);
    g.ctx.rotate(r);
    g.ctx.scale(s, s);
  }

  /** 手持镜头：切入时的冲击晃动 + 慢慢推近 + 拍点小跳 */
  function withCam(g, c, fn, o) {
    o = o || {};
    const ctx = g.ctx;
    const e = impact(c.lt, 9);
    const [sx, sy] = g.shake(14 * e + (o.hand == null ? 1.4 : o.hand));
    const z = 1 + (o.drift == null ? 0.045 : o.drift) * ease.out(c.lp) + 0.02 * (c.info.pulse || 0);
    ctx.save();
    ctx.translate(W / 2 + sx, H / 2 + sy);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
    fn();
    ctx.restore();
  }

  /** 切入第一帧的闪光 */
  function flashIn(g, lt, color, a) {
    const k = (a == null ? 0.5 : a) * Math.exp(-lt * 24);
    if (k < 0.02) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.globalAlpha *= k;
    ctx.fillStyle = color;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.restore();
  }

  function snowFx(g, S, o) {
    g.snow(Object.assign({ count: 90, color: S.snow, alpha: S.snowA, size: [3, 10], speed: [60, 160], wind: 40, seed: 12 }, o));
  }

  function bigChar(g, ch, x, y, size, color, o) {
    return g.text(ch, x, y, Object.assign({ size, font: 'brush', color, pop: false, wobble: 0.45 }, o));
  }

  /** 墨点（主墨团 + 飞溅的小点），k 0..1 长出来 */
  function splat(g, x, y, r, color, seed, k) {
    k = k == null ? 1 : k;
    if (k <= 0) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const spike = rand(i % n, seed, 5) > 0.8 ? 0.45 * rand(i % n, seed, 6) : 0;
      const rr = r * k * (0.8 + 0.3 * noise1(i * 0.7, seed) + spike);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 11; i++) {
      const a = rand(i, seed, 1) * TAU;
      const d = r * (1.3 + rand(i, seed, 2) * 2.4) * (0.55 + 0.45 * k);
      const rr = r * (0.05 + 0.17 * rand(i, seed, 3)) * k;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rr, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 漫画集中线：从画面四周射向 (cx,cy)，每帧重新抖 */
  function focusLines(g, cx, cy, r0, color, n, seed, alpha) {
    const ctx = g.ctx, b = g.info.boil;
    const len = 2300;
    ctx.save();
    ctx.globalAlpha *= alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = ((i + rand(i, seed, b) * 0.9) / n) * TAU;
      const rr = r0 * (0.8 + 0.55 * rand(i, seed + 1, b));
      const w = 2 + 11 * rand(i, seed + 2, b);
      const ca = Math.cos(a), sa = Math.sin(a);
      ctx.moveTo(cx + ca * rr, cy + sa * rr);
      ctx.lineTo(cx + ca * len - sa * w, cy + sa * len + ca * w);
      ctx.lineTo(cx + ca * len + sa * w, cy + sa * len - ca * w);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }

  /** 毛笔飞白：笔肚是实的，越往后笔毛越干、断开（原生 ctx，快） */
  function dryBrush(g, pts, width, color, prog, seed) {
    if (prog <= 0) return;
    const ctx = g.ctx, b = g.info.boil;
    const sm = catmull(pts, false, 90);
    const n = sm.length;
    const cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(sm[i][0] - sm[i - 1][0], sm[i][1] - sm[i - 1][1]));
    const L = cum[n - 1], end = L * clamp(prog);
    const nrm = sm.map((q, i) => {
      const a = sm[Math.max(0, i - 1)], c = sm[Math.min(n - 1, i + 1)];
      const dx = c[0] - a[0], dy = c[1] - a[1], d = Math.hypot(dx, dy) || 1;
      return [-dy / d, dx / d];
    });
    const jx = (rand(b, seed, 1) - 0.5) * 3, jy = (rand(b, seed, 2) - 0.5) * 3;
    ctx.save();
    ctx.translate(jx, jy);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // 笔肚
    const prof = (s) => {
      const a = Math.min(1, s / (width * 0.5)), z = s / L;
      return width * 0.5 * 0.74 * (0.45 + 0.55 * Math.sqrt(a)) * (1 - 0.8 * Math.pow(z, 1.8));
    };
    const left = [], right = [];
    for (let i = 0; i < n && cum[i] <= end; i++) {
      const w = prof(cum[i]) * (1 + 0.06 * noise1(cum[i] / 90, seed));
      left.push([sm[i][0] + nrm[i][0] * w, sm[i][1] + nrm[i][1] * w]);
      right.push([sm[i][0] - nrm[i][0] * w, sm[i][1] - nrm[i][1] * w]);
    }
    if (left.length > 1) {
      ctx.beginPath();
      left.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
      ctx.closePath();
      ctx.fill();
      // 圆圆的笔头
      const li = left.length - 1;
      ctx.beginPath();
      ctx.arc((left[li][0] + right[li][0]) / 2, (left[li][1] + right[li][1]) / 2, Math.hypot(left[li][0] - right[li][0], left[li][1] - right[li][1]) / 2, 0, TAU);
      ctx.fill();
    }
    // 笔毛
    const nb = 34;
    for (let k = 0; k < nb; k++) {
      const o = (k + 0.5) / nb - 0.5;
      const edge = Math.abs(o) * 2;
      const sEnd = L * (1 - edge * 0.4 * rand(k, seed, 1) - 0.1 * rand(k, seed, 2));
      ctx.lineWidth = (width / nb) * (1.2 + 1.6 * rand(k, seed, 3));
      const freq = 26 + 40 * rand(k, seed, 4);
      let on = false;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const s = cum[i];
        if (s > end || s > sEnd) break;
        const z = s / L;
        const thr = lerp(-1.3, 0.25, clamp((z - 0.3) / 0.7)) + edge * 0.45 - 0.2;
        const ink = noise1(s / freq, seed + k * 13) > thr;
        const off = o * width * (1 + 0.12 * z) + noise1(s / 140, seed + k) * 5;
        const x = sm[i][0] + nrm[i][0] * off, y = sm[i][1] + nrm[i][1] * off;
        if (ink) {
          if (!on) { ctx.moveTo(x, y); on = true; } else ctx.lineTo(x, y);
        } else on = false;
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 钟面 */
  function clockFace(g, cx, cy, r, col, hands, o) {
    o = o || {};
    const wd = o.width || 8;
    g.circle(cx, cy, r, { color: col, width: wd, seed: 301, double: true });
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      const r0 = r * (k % 3 ? 0.87 : 0.78);
      g.line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r * 0.94, cy + Math.sin(a) * r * 0.94, { color: col, width: k % 3 ? wd * 0.6 : wd * 1.1, seed: 310 + k });
    }
    const hand = (a, L, w, color, seed, back) => {
      const A = a - Math.PI / 2;
      g.line(cx - Math.cos(A) * (back || 0), cy - Math.sin(A) * (back || 0), cx + Math.cos(A) * L, cy + Math.sin(A) * L, { color, width: w, seed });
    };
    // 飞快转动的残影：分针扫过的地方留几道弧
    if (o.trail) {
      const A = hands.m - Math.PI / 2;
      for (let j = 0; j < 3; j++) {
        const rr = r * (0.66 + j * 0.08);
        g.arc(cx, cy, rr, A - o.trail * (1 - j * 0.22), A - 0.06, { color: col, width: wd * (0.5 + j * 0.2), alpha: 0.3 + j * 0.2, seed: 340 + j });
      }
    }
    hand(hands.h, r * 0.5, wd * 1.8, col, 330);
    hand(hands.m, r * (o.mLen || 0.76), wd * 1.15, col, 331);
    hand(hands.s, r * 0.84, wd * 0.5, RED, 332, r * 0.16);
    C.dot(g, cx, cy, Math.max(6, r * 0.04), RED, 333);
  }

  /** 门（剪影版，黑白红） */
  function doorSil(g, x, y, w, h, o) {
    const line = o.line, fill = o.fill;
    g.rect(x - 22, y - 22, w + 44, h + 22, { color: line, width: 6, fill: o.frame || fill, seed: 401 });
    g.rect(x, y, w, h, { color: line, width: 6, fill, seed: 402 });
    g.rect(x + w * 0.14, y + h * 0.08, w * 0.72, h * 0.36, { color: line, width: 4, alpha: 0.6, seed: 403 });
    g.rect(x + w * 0.14, y + h * 0.52, w * 0.72, h * 0.36, { color: line, width: 4, alpha: 0.6, seed: 404 });
    g.circle(x + w * 0.86, y + h * 0.5, Math.max(8, w * 0.035), { color: line, width: 3, fill: RED, seed: 405 });
  }

  /** 六瓣小雪花（原生 ctx，给大量粒子用） */
  function flakeP(ctx, x, y, r, rot) {
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = rot + (k * Math.PI) / 3;
      const ca = Math.cos(a) * r, sa = Math.sin(a) * r;
      ctx.moveTo(x - ca, y - sa);
      ctx.lineTo(x + ca, y + sa);
    }
    if (r > 9) {
      for (let k = 0; k < 6; k++) {
        const a = rot + (k * Math.PI) / 3;
        const bx = x + Math.cos(a) * r * 0.55, by = y + Math.sin(a) * r * 0.55;
        for (const sd of [-1, 1]) {
          const b = a + sd * 0.8;
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(b) * r * 0.32, by + Math.sin(b) * r * 0.32);
        }
      }
    }
    ctx.stroke();
  }

  /** 心跳（每秒约 1.2 下的"咚咚"）；用户敲了拍子时用拍子 */
  function heartBeat(g) {
    return g.info.bpm > 0 ? g.info.pulse : beatOf(g.info.songTime);
  }
  function beatOf(t) {
    const ph = (t * 1.2) % 1;
    return Math.exp(-ph * 9) + 0.6 * Math.exp(-Math.max(0, ph - 0.22) * 11) * (ph > 0.22 ? 1 : 0);
  }

  // ------------------------------------------------------------------ S1 眼睛大特写
  function shot1(g, p, t, info) {
    const ctx = g.ctx;
    const { u, D } = local(info, p, S1);
    const snapU = 0.4;
    const since = (u - snapU) * D; // 睁大之后过了几秒
    const snapped = u >= snapU;
    g.bg(WHITE);

    // 镜头：慢慢推近，睁眼瞬间一个冲击
    const zoom = snapped ? 1.05 + 0.07 * impact(since, 7) : lerp(1, 1.05, ease.inOut(u / snapU));
    const [sx, sy] = g.shake(snapped ? 18 * impact(since, 6) + 1 : 1.2);
    ctx.save();
    g.camera(960, 470, zoom, 0, sx, sy);

    // 头部大特写（坐标按 characters.js 的雪人脸放大）
    const R = 1100, s = R / 80, hx = 960, hy = 552;
    // 圆脸的明暗
    const gr = ctx.createLinearGradient(1280, 0, 2000, 0);
    gr.addColorStop(0, rgba(P.snowShade, 0));
    gr.addColorStop(1, rgba(P.snowShade, 0.75));
    ctx.fillStyle = gr;
    ctx.fillRect(1200, -100, 900, H + 200);
    // 腮红
    ctx.save();
    ctx.globalAlpha *= 0.55 + 0.25 * (snapped ? 1 : 0);
    ctx.fillStyle = P.pink;
    ctx.beginPath();
    ctx.ellipse(hx - 0.32 * R - 8 * s, hy - 0.12 * R + 26 * s, 15 * s, 8 * s, 0, 0, TAU);
    ctx.ellipse(hx + 0.32 * R + 8 * s, hy - 0.12 * R + 26 * s, 15 * s, 8 * s, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    for (const sd of [-1, 1]) {
      const bx = hx + sd * (0.32 * R + 8 * s);
      for (let k = 0; k < 3; k++) {
        g.line(bx - 70 + k * 55, hy + 150, bx - 50 + k * 55, hy + 205, { color: '#e98a8a', width: 9, seed: 120 + k + (sd > 0 ? 5 : 0) });
      }
    }
    // 胡萝卜鼻子（从画面中间往右下伸出去）
    const nx = hx, ny = hy - 0.12 * R + 18 * s;
    const tipX = nx + Math.cos(0.18) * 54 * s, tipY = ny + Math.sin(0.18) * 54 * s;
    g.poly([[nx - 18, ny - 10 * s], [tipX, tipY], [nx + 8, ny + 10 * s]], { color: INK, width: 16, fill: P.carrot, seed: 130 });
    g.line(lerp(nx, tipX, 0.35), lerp(ny, tipY, 0.35) - 60, lerp(nx, tipX, 0.39), lerp(ny, tipY, 0.39) + 40, { color: '#b85a1c', width: 12, seed: 131 });
    g.line(lerp(nx, tipX, 0.62), lerp(ny, tipY, 0.62) - 40, lerp(nx, tipX, 0.65), lerp(ny, tipY, 0.65) + 26, { color: '#b85a1c', width: 11, seed: 132 });

    // 眼睛
    const er = 128;
    const open = snapped ? 1 + 0.2 * impact(since, 8) * Math.cos(since * 30) : 0.36 + 0.03 * Math.sin(t * 4);
    const browLift = snapped ? 40 * (0.5 + 0.5 * impact(since, 5)) : 0;
    for (const sd of [-1, 1]) {
      const ex = hx + sd * 0.32 * R, ey = hy - 0.12 * R;
      // 八字眉：和 characters.js 一样，外端低、内端（靠鼻子那头）高 —— 担心 / 想念的表情。
      // 睁大时整体往上一跳、内端抬得更多。比原比例略低一点，免得被画面上缘切掉。
      const by0 = ey - 19 * s - browLift, by1 = ey - 25 * s - browLift * 1.4;
      g.line(ex + sd * 12 * s, by0 + (snapped ? 0 : 30), ex - sd * 9 * s, by1 + (snapped ? 0 : 40), { color: INK, width: 40, seed: 140 + (sd > 0 ? 1 : 0) });
      ctx.save();
      if (!snapped) {
        // 眼皮：只露出下半个煤球眼
        const lidY = ey - er * 1.08 + 2 * er * 1.08 * (1 - open);
        ctx.beginPath();
        ctx.rect(ex - er * 2, lidY, er * 4, er * 4);
        ctx.clip();
        g.ellipse(ex, ey, er, er * 1.08, { color: INK, width: 8, fill: INK, jitter: 2, seed: 150 + (sd > 0 ? 1 : 0) });
        ctx.restore();
        g.line(ex - er * 1.35, lidY + 8, ex + er * 1.35, lidY - 6 * sd + 8, { color: INK, width: 26, seed: 152 + (sd > 0 ? 1 : 0) });
        // 下垂的睫毛
        g.line(ex + sd * er * 1.2, lidY + 2, ex + sd * er * 1.55, lidY + 40, { color: INK, width: 12, seed: 154 + (sd > 0 ? 1 : 0) });
      } else {
        ctx.translate(ex, ey);
        ctx.scale(1 / Math.sqrt(open), open);
        g.ellipse(0, 0, er, er * 1.08, { color: INK, width: 8, fill: INK, jitter: 2, seed: 150 + (sd > 0 ? 1 : 0) });
        // 高光 + 眼里的小红心（"你"的倒影）
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(er * 0.3, -er * 0.36, er * 0.3, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(er * 0.52, -er * 0.02, er * 0.09, 0, TAU);
        ctx.fill();
        C.heart(g, -er * 0.34, er * 0.38, er * 0.2, { fill: RED, color: RED, width: 3, seed: 156 });
        ctx.restore();
        // 惊讶线：放在眼睛外上侧（不压眉毛，也不出画）
        const sk = clamp(since / 0.18);
        for (let k = 0; k < 3; k++) {
          const a0 = -0.15 - k * 0.35;
          const a = sd > 0 ? a0 : Math.PI - a0;
          const r0 = er * 1.55, r1 = r0 + 70 * sk;
          g.line(ex + Math.cos(a) * r0, ey + Math.sin(a) * r0, ex + Math.cos(a) * r1, ey + Math.sin(a) * r1, { color: INK, width: 11, seed: 160 + k + (sd > 0 ? 3 : 0) });
        }
      }
    }
    ctx.restore();

    // 前景：几片飘过的冰蓝雪
    g.snow({ count: 26, color: P.ice, alpha: 0.7, size: [8, 22], crystal: 12, speed: [40, 90], wind: 60, seed: 77 });

    if (snapped) {
      focusLines(g, 960, 420, 760, INK, 70, 170, clamp(1 - since / 0.9) * 0.9);
      // 「！」
      const k = clamp(since / 0.12);
      if (k > 0) {
        ctx.save();
        stampOn(g, 1730, 250, since, { from: 0.6, rot: 0.14 });
        g.text('！', 0, 0, { size: 330, font: 'brush', color: RED, pop: false, shadow: { color: INK, dx: 10, dy: 10 } });
        ctx.restore();
      }
    } else {
      // 半睁时右上角的「……」
      g.text('……', 1660, 200, { size: 120, font: 'hand', color: INK, alpha: 0.75, progress: seg(u, 0.05, 0.3) });
    }

    // 红色飞白扫过（转场）
    const sw = ease.inOut(seg(u, 0.72, 0.97));
    if (sw > 0) dryBrush(g, [[-160, 960], [480, 700], [1200, 420], [2140, 90]], 360, RED, sw, 180);
    flashIn(g, Math.max(0, since), '#ffffff', snapped ? 0.7 : 0);
  }

  // ------------------------------------------------------------------ S2 闪切卡片
  const CARDS = {
    // 「雪」：白底黑字 + 红日
    xue(g, c) {
      const S = SCH.L, ctx = g.ctx;
      g.bg(S.bg);
      snowFx(g, S, { seed: 21 });
      withCam(g, c, () => {
        const k = ease.outBack(ck(c, 0, 0.22));
        g.circle(1220, 400, 300 * k, { fill: RED, color: RED_D, width: 5, seed: 601 });
        splat(g, 1520, 170, 22, RED, 602, k);
        splat(g, 1600, 640, 12, RED, 607, k);
        ctx.save();
        stampOn(g, 860, 470, c.lt);
        bigChar(g, '雪', 0, 0, 680, INK, { seed: 603 });
        ctx.restore();
        const ks = ease.out(clamp(c.lt / 0.12));
        splat(g, 420, 790, 34, INK, 604, ks);
        splat(g, 1240, 790, 15, INK, 605, ks);
        g.text('-12°C', 230, 150, { size: 84, font: 'latin', weight: 700, color: RED, seed: 606, rot: -0.08 });
      });
      flashIn(g, c.lt, INK, 0.35);
    },

    // 一片巨大的雪花被一瓣一瓣画出来（黑底）
    flake(g, c) {
      const S = SCH.D;
      g.bg(S.bg);
      g.glow(960, 450, 620, '#9fb8dc', 0.16);
      focusLines(g, 960, 450, 470, WHITE, 64, 610, 0.22);
      snowFx(g, S, { seed: 22 });
      withCam(g, c, () => {
        const pr = ease.out(ck(c, 0, 0.55));
        const rot = c.info.songTime * 0.35 + 0.26;
        C.flake(g, 960, 450, 380, { rot, color: WHITE, width: 17, progress: pr, fill: RED, seed: 611 });
        C.flake(g, 330, 230, 70, { rot: -rot * 1.4, color: WHITE, width: 6, progress: pr, seed: 612 });
        C.flake(g, 1610, 720, 92, { rot: rot * 1.2, color: WHITE, width: 7, progress: pr, seed: 613 });
        C.flake(g, 1560, 190, 46, { rot: rot * 2, color: RED, width: 6, progress: pr, seed: 614 });
      }, { drift: 0.07 });
      flashIn(g, c.lt, WHITE, 0.4);
    },

    // 「人」：红底白字；角落里一个小小的雪人 =「我」
    ren(g, c) {
      const S = SCH.R, ctx = g.ctx;
      g.bg(S.bg);
      g.glow(960, 450, 700, '#ff8a6a', 0.25);
      snowFx(g, S, { seed: 23 });
      withCam(g, c, () => {
        ctx.save();
        stampOn(g, 900, 455, c.lt, { spin: 0.14 });
        bigChar(g, '人', 0, 0, 780, WHITE, { seed: 621, shadow: { color: INK, dx: 18, dy: 16 } });
        ctx.restore();
        const ks = ease.out(clamp(c.lt / 0.12));
        splat(g, 470, 230, 26, INK, 622, ks);
        splat(g, 1330, 820, 16, INK, 623, ks);
        // 小雪人 + 手写注释
        const k2 = ck(c, 0.15, 0.25);
        if (k2 > 0) {
          C.snowman(g, 1560, 860, 0.36, { mood: 'happy', blush: 0.9, look: -0.4, wind: 0.6, seed: 624, outline: INK });
          g.text('我', 1720, 560, { size: 92, font: 'hand', color: INK, seed: 625, alpha: k2 });
          g.curve([[1700, 615], [1680, 650], [1630, 680]], { color: INK, width: 6, progress: k2, seed: 626 });
          g.line(1630, 680, 1652, 652, { color: INK, width: 6, alpha: k2, seed: 627 });
          g.line(1630, 680, 1662, 684, { color: INK, width: 6, alpha: k2, seed: 628 });
        }
      });
      flashIn(g, c.lt, WHITE, 0.4);
    },

    // 雪人近景，集中线，风把围巾吹起来
    snowman(g, c) {
      const S = SCH.L;
      g.bg(S.bg);
      focusLines(g, 960, 430, 560, INK, 80, 630, 0.92);
      snowFx(g, S, { seed: 24, wind: 160 });
      withCam(g, c, () => {
        const up = ease.outBack(ck(c, 0, 0.3));
        C.snowman(g, 960, 905, 1.5, {
          mood: 'hope', wind: 1, look: 0.35, lookUp: 0.35 * up, arms: [0.55 * up, 0.75 * up], blush: 0.9, seed: 631, t: c.info.songTime,
        });
      }, { drift: 0.06 });
      flashIn(g, c.lt, INK, 0.3);
    },

    // 「等」：黑底，后面是飞快转动的钟
    deng(g, c) {
      const S = SCH.D, ctx = g.ctx;
      const tt = c.info.songTime;
      g.bg(S.bg);
      snowFx(g, S, { seed: 25 });
      withCam(g, c, () => {
        const k = ease.outBack(ck(c, 0, 0.25));
        ctx.save();
        ctx.translate(960, 450);
        ctx.scale(k, k);
        clockFace(g, 0, 0, 390, WHITE, { h: tt * 0.8, m: tt * 6.5, s: Math.floor(tt * 4) * (TAU / 24) }, { trail: 1.5, mLen: 0.86 });
        ctx.restore();
        ctx.save();
        stampOn(g, 960, 450, c.lt);
        bigChar(g, '等', 0, 0, 560, WHITE, { seed: 641, stroke: INK, strokeWidth: 34 });
        ctx.restore();
        g.text('第 99 天', 1590, 850, { size: 76, font: 'hand', color: RED, seed: 642, rot: -0.05, progress: ck(c, 0.12, 0.3) });
      });
      flashIn(g, c.lt, WHITE, 0.4);
    },

    // 红手套从下面伸上来
    mitten(g, c) {
      const S = SCH.L;
      g.bg(S.bg);
      focusLines(g, 900, 560, 600, INK, 70, 650, 0.85);
      snowFx(g, S, { seed: 26 });
      withCam(g, c, () => {
        const k = ease.outCubic(ck(c, 0, 0.4));
        const y = lerp(1320, 915, k);
        // 往上的速度线
        for (let i = 0; i < 6; i++) {
          const x = 760 + i * 52 + rand(i, 651) * 20;
          g.line(x, y + 120 + rand(i, 652) * 80, x, y + 300 + rand(i, 653) * 160, { color: INK, width: 5, alpha: 0.7 * (1 - k * 0.6), seed: 654 + i });
        }
        g.glow(900, y - 270, 420, RED, 0.12);
        C.mitten(g, 900, y, 3.4, -0.12 + 0.03 * Math.sin(c.info.songTime * 3), { seed: 660 });
      }, { drift: 0.05 });
      flashIn(g, c.lt, INK, 0.3);
    },

    // 门：黑夜，门缝透一点光，一直没开
    door(g, c) {
      const S = SCH.D;
      g.bg(S.bg);
      snowFx(g, S, { seed: 27, count: 120 });
      withCam(g, c, () => {
        C.ground(g, 858, { color: WHITE, line: WHITE, seed: 671, amp: 10 });
        doorSil(g, 770, 150, 380, 690, { fill: '#25222e', frame: '#1c1a24', line: WHITE });
        // 门框上的积雪
        g.path([[734, 132], [760, 104], [900, 96], [1060, 100], [1170, 108], [1192, 134]], { smooth: true, closed: true, color: INK, width: 4, fill: WHITE, seed: 675 });
        // 门下的光缝：光只洒在门前的雪上
        const fl = 0.75 + 0.25 * Math.sin(c.info.songTime * 9);
        const ctx = g.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 838, W, H);
        ctx.clip();
        g.glow(960, 838, 330, '#fff2d6', 0.55 * fl);
        ctx.restore();
        g.line(785, 836, 1135, 836, { color: '#fff6e2', width: 7, alpha: fl, seed: 672 });
        // 门前台阶的雪
        g.path([[700, 872], [730, 848], [960, 840], [1200, 848], [1230, 874]], { smooth: true, closed: true, color: INK, width: 4, fill: WHITE, seed: 673 });
        // 竖排小字
        g.text('门没开', 610, 260, { size: 70, font: 'hand', color: RED, vertical: true, seed: 674, progress: ck(c, 0.1, 0.45) });
      }, { drift: 0.035 });
      flashIn(g, c.lt, WHITE, 0.4);
    },

    // 「你」：白底红字
    ni(g, c) {
      const S = SCH.L, ctx = g.ctx;
      g.bg(S.bg);
      snowFx(g, S, { seed: 28 });
      withCam(g, c, () => {
        g.glow(960, 460, 560, RED, 0.12);
        ctx.save();
        stampOn(g, 960, 460, c.lt, { spin: 0.1 });
        bigChar(g, '你', 0, 0, 740, RED, { seed: 681, shadow: { color: INK, dx: 16, dy: 14 } });
        ctx.restore();
        const ks = ease.out(clamp(c.lt / 0.12));
        splat(g, 400, 720, 30, RED, 682, ks);
        splat(g, 1560, 260, 20, INK, 683, ks);
        // 一颗小小的心被画出来
        const hk = ck(c, 0.18, 0.4);
        if (hk > 0) C.heart(g, 1500, 640, 56, { fill: null, color: INK, width: 7, progress: hk, rot: 0.2, seed: 684 });
      });
      flashIn(g, c.lt, INK, 0.35);
    },
  };

  function shot2(g, p, t, info) {
    const c = cuts(info, S2[0], S2[1], S2_CARDS.length);
    CARDS[S2_CARDS[c.i]](g, c);
  }

  // ------------------------------------------------------------------ S3 定格：红日、风里的雪人、竖排「雪人等你」
  function shot3(g, p, t, info) {
    const ctx = g.ctx;
    const { u, lt } = local(info, p, S3);
    g.bg(INK);
    // 远处的星点
    ctx.save();
    ctx.fillStyle = WHITE;
    for (let i = 0; i < 46; i++) {
      ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + i * 1.7));
      ctx.beginPath();
      ctx.arc(rand(i, 701) * W, rand(i, 702) * 700, 1.5 + rand(i, 703) * 2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    const [sx, sy] = g.shake(16 * impact(lt, 8) + 1);
    g.camera(900, 520, lerp(1.0, 1.08, ease.inOut(u)), lerp(-0.012, 0.008, u), sx, sy);
    // 红日 + 白色的一笔圆（円相）
    const k = ease.outBack(clamp(lt / 0.35));
    g.glow(640, 520, 660, RED, 0.28);
    g.circle(640, 520, 320 * k, { fill: RED, color: RED, width: 4, seed: 711 });
    g.arc(640, 520, 372, -2.5, -2.5 + 5.6 * ease.out(seg(u, 0.04, 0.5)), { color: WHITE, width: 14, seed: 712 });
    // 雪地
    C.ground(g, 862, { color: WHITE, line: WHITE, seed: 713, amp: 12 });
    // 雪人
    C.snowman(g, 640, 900, 1.18, {
      mood: 'hope', wind: 0.9, look: 0.55, lookUp: 0.25 + 0.1 * Math.sin(t * 1.3), arms: [0.15, 0.6 + 0.08 * Math.sin(t * 2.2)],
      blush: 0.85, snowCap: 0.35, seed: 714, t: info.songTime,
    });
    // 竖排大字
    g.text('雪人等你', 1460, 108, {
      size: 178, font: 'brush', vertical: true, color: WHITE, progress: ease.inOut(seg(u, 0.1, 0.7)), seed: 715,
      shadow: { color: RED, dx: 9, dy: 9 },
    });
    g.text('还在门口', 1240, 470, { size: 58, font: 'hand', vertical: true, color: RED, progress: seg(u, 0.66, 0.9), seed: 716 });
    ctx.restore();
    // 横着吹的雪
    g.snow({ count: 150, wind: 340, sway: 10, speed: [70, 160], color: WHITE, alpha: 0.85, size: [2, 10], seed: 31 });
    // 风线
    for (let i = 0; i < 5; i++) {
      const ph = ((t * 0.9 + rand(i, 720)) % 1);
      const y = 140 + rand(i, 721) * 620;
      const x0 = lerp(-500, W + 200, ph);
      g.line(x0, y, x0 + 380, y - 14, { color: WHITE, width: 3, alpha: 0.4 * Math.sin(ph * Math.PI), seed: 722 + i });
    }
    flashIn(g, lt, WHITE, 0.6);
  }

  // ------------------------------------------------------------------ S4a 分格三连：脸 / 心 / 手套
  function shot4a(g, p, t, info) {
    const ctx = g.ctx;
    const { u, D } = local(info, p, S4A);
    g.bg(INK);
    const panels = [
      { poly: [[0, 0], [640, 0], [540, H], [0, H]], sch: 'L', at: 0, dir: [-1, 0], fn: panelFace },
      { poly: [[664, 0], [1290, 0], [1190, H], [564, H]], sch: 'D', at: 0.24, dir: [0, -1], fn: panelHeart },
      { poly: [[1314, 0], [W, 0], [W, H], [1214, H]], sch: 'L', at: 0.48, dir: [1, 0], fn: panelMitten },
    ];
    panels.forEach((pn, k) => {
      if (u < pn.at) return;
      const lt = (u - pn.at) * D;
      const e = 1 - ease.outCubic(clamp(lt / 0.22));
      ctx.save();
      ctx.beginPath();
      pn.poly.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = SCH[pn.sch].bg;
      ctx.fillRect(0, 0, W, H);
      ctx.translate(pn.dir[0] * 160 * e, pn.dir[1] * 160 * e);
      pn.fn(g, lt, t, info);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      pn.poly.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      ctx.clip();
      flashIn(g, lt, pn.sch === 'D' ? WHITE : INK, 0.5);
      ctx.restore();
      g.poly(pn.poly, { color: INK, width: 10, seed: 800 + k });
    });
  }

  function panelFace(g, lt, t, info) {
    g.snow({ count: 40, color: INK, alpha: 0.22, size: [3, 9], area: [0, 0, 660, H], seed: 41 });
    C.snowman(g, 290, 1050, 2.15, { mood: 'sad', look: 0.7, tear: clamp(lt / 1.2), blush: 0.85, wind: 0.6, seed: 811, t: info.songTime });
  }

  function panelHeart(g, lt, t, info) {
    const ctx = g.ctx;
    const b = heartBeat(g);
    g.glow(928, 450, 420, RED, 0.25 + 0.2 * b);
    g.snow({ count: 40, color: WHITE, alpha: 0.7, size: [3, 9], area: [560, 0, 740, H], seed: 42 });
    ctx.save();
    ctx.translate(928, 450);
    ctx.scale(1 + 0.1 * b, 1 + 0.1 * b);
    C.heart(g, 0, 0, 175, { fill: RED, color: WHITE, width: 7, crack: 0, seed: 821 });
    ctx.restore();
    // 心跳的弧线
    for (const sd of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const r = 250 + k * 46 + b * 24;
        g.arc(928, 450, r, sd > 0 ? -0.5 : Math.PI - 0.5, sd > 0 ? 0.5 : Math.PI + 0.5, { color: WHITE, width: 6 - k * 2, alpha: 0.4 + 0.5 * b, seed: 822 + k + (sd > 0 ? 2 : 0) });
      }
    }
    g.text('咚', 820, 200, { size: 96, font: 'brush', color: WHITE, rot: -0.15, alpha: 0.4 + 0.6 * b, seed: 826 });
    g.text('咚', 1040, 720, { size: 74, font: 'brush', color: WHITE, rot: 0.12, alpha: 0.3 + 0.6 * b, seed: 827 });
  }

  function panelMitten(g, lt, t, info) {
    g.snow({ count: 40, color: INK, alpha: 0.22, size: [3, 9], area: [1200, 0, 720, H], seed: 43 });
    const k = ease.outCubic(clamp(lt / 0.5));
    C.mitten(g, lerp(1720, 1620, k), lerp(1150, 900, k), 2.5, -0.55 + 0.04 * Math.sin(info.songTime * 3), { seed: 831 });
  }

  // ------------------------------------------------------------------ S4b 2×2 黑白棋盘「雪人 / 等你」
  function shot4b(g, p, t, info) {
    const ctx = g.ctx;
    const { u, D, lt } = local(info, p, S4B);
    const inStart = 0.42 * D;
    let flips = 0, sinceFlip = lt;
    if (lt > inStart) {
      const ft = lt - inStart;
      if (info.bpm > 0) {
        // 敲了拍子：每拍反相一次（拍子太密就两拍一次）
        const bl = 60 / info.bpm, step = bl < 0.36 ? bl * 2 : bl;
        const off = info.songTime - info.beat * bl;
        const t0 = info.songTime - ft;
        flips = Math.floor((info.songTime - off) / step) - Math.floor((t0 - off) / step) + 1;
        sinceFlip = Math.min(ft, (((info.songTime - off) % step) + step) % step);
      } else {
        const step = clamp((D - inStart) / 3, 0.36, 0.75);
        flips = Math.floor(ft / step) + 1;
        sinceFlip = ft % step;
      }
    }
    const inv = flips % 2 === 1;
    g.bg(INK);
    const cw = W / 2, chh = 460;
    const cells = [['雪', 0, 0], ['人', 1, 0], ['等', 0, 1], ['你', 1, 1]];
    const [sx, sy] = g.shake(4);
    cells.forEach(([ch, cx, cy], k) => {
      const dark = ((cx + cy) % 2 === 0) !== inv;
      const bgc = dark ? INK : WHITE, fgc = ch === '你' ? RED : dark ? WHITE : INK;
      const x0 = cx * cw, y0 = cy * chh;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, cw, chh);
      ctx.clip();
      ctx.fillStyle = bgc;
      ctx.fillRect(x0, y0, cw, chh);
      g.snow({ count: 22, color: dark ? WHITE : INK, alpha: dark ? 0.7 : 0.22, size: [3, 8], area: [x0, y0, cw, chh], seed: 50 + k });
      const at = k * 0.1 * D;
      if (lt >= at) {
        const clt = lt - at;
        // 反相的瞬间也"啪"一下
        const popLt = flips > 0 ? Math.min(clt, sinceFlip + 0.05) : clt;
        ctx.save();
        stampOn(g, x0 + cw / 2 + sx + (k % 2 ? 16 : -16), y0 + chh / 2 + sy, popLt, { from: 0.32, spin: k % 2 ? 0.1 : -0.1 });
        bigChar(g, ch, 0, 0, 400, fgc, { seed: 900 + k, shadow: ch === '你' ? { color: dark ? WHITE : INK, dx: 9, dy: 8 } : undefined });
        ctx.restore();
        flashIn(g, clt, dark ? WHITE : INK, 0.45);
      }
      ctx.restore();
    });
    // 分格线 + 下方黑边（给歌词留位置）
    g.line(cw, -10, cw, 2 * chh + 4, { color: INK, width: 14, seed: 910 });
    g.line(-10, chh, W + 10, chh, { color: INK, width: 14, seed: 911 });
    ctx.save();
    ctx.fillStyle = INK;
    ctx.fillRect(0, 2 * chh, W, H - 2 * chh);
    ctx.restore();
    // 小小的日期，白字在黑边上
    g.text('12.24', 120, 2 * chh + 80, { size: 52, font: 'latin', color: rgba(WHITE, 0.6), align: 'left', seed: 912 });
    g.text('3.21', W - 120, 2 * chh + 80, { size: 52, font: 'latin', color: rgba(RED, 0.9), align: 'right', seed: 913 });
    void u;
  }

  // ------------------------------------------------------------------ S4c 红围巾被风拉长，伸向红手套
  const BAND = [[-88, -10], [-40, 6], [20, 8], [84, -8], [90, 18], [30, 36], [-36, 34], [-92, 14]];

  function longScarf(g, x0, y0, x1, y1, t, s, seed) {
    const n = 30;
    const mid = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const wave = Math.sin(t * 7.5 - k * 8) * (6 + 64 * k) * s + Math.sin(t * 3.3 - k * 3.4) * 30 * k * s;
      // 先往下坠一点再被风托起来
      mid.push([lerp(x0, x1, k), lerp(y0, y1, ease.inOut(k)) + wave + Math.sin(k * Math.PI) * 40 * s]);
    }
    const top = [], bot = [];
    for (let i = 0; i <= n; i++) {
      const a = mid[Math.max(0, i - 1)], b = mid[Math.min(n, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
      const w = lerp(30, 40, i / n) * s;
      top.push([mid[i][0] + (dy / d) * w, mid[i][1] - (dx / d) * w]);
      bot.push([mid[i][0] - (dy / d) * w, mid[i][1] + (dx / d) * w]);
    }
    g.path(top.concat(bot.slice().reverse()), { closed: true, smooth: true, fill: RED, color: INK, width: 5 * s, seed });
    // 针织纹
    for (let i = 2; i < n; i += 2) {
      const a = top[i], b = bot[i];
      g.line(lerp(a[0], b[0], 0.15), lerp(a[1], b[1], 0.15), lerp(a[0], b[0], 0.85), lerp(a[1], b[1], 0.85), { color: RED_D, width: 3.2 * s, seed: seed + i });
    }
    // 流苏
    const e = mid[n], e0 = mid[n - 1];
    const dx = e[0] - e0[0], dy = e[1] - e0[1], d = Math.hypot(dx, dy) || 1;
    for (let k = 0; k < 5; k++) {
      const q = [lerp(top[n][0], bot[n][0], k / 4), lerp(top[n][1], bot[n][1], k / 4)];
      const L = (26 + 8 * Math.sin(t * 12 + k)) * s;
      g.line(q[0], q[1], q[0] + (dx / d) * L, q[1] + (dy / d) * L + Math.sin(t * 10 + k * 2) * 6 * s, { color: RED_D, width: 4 * s, seed: seed + 40 + k });
    }
    return mid[n];
  }

  function shot4c(g, p, t, info) {
    const ctx = g.ctx;
    const { u, lt } = local(info, p, S4C);
    const tt = info.songTime;
    g.bg(WHITE);
    // 斜着的风线 + 雪（风从左下吹向右上）
    for (let i = 0; i < 10; i++) {
      const ph = ((tt * 1.5 + rand(i, 1001)) % 1);
      const y = 120 + rand(i, 1002) * 760;
      const x0 = lerp(-600, W + 100, ph);
      const L = 300 + rand(i, 1003) * 260;
      g.line(x0, y + 120 * ph, x0 + L, y + 120 * ph - L * 0.22, { color: INK, width: 3.5, alpha: 0.45 * Math.sin(ph * Math.PI), seed: 1004 + i });
    }
    g.snow({ count: 120, wind: 900, sway: 6, speed: [-60, -20], color: INK, alpha: 0.22, size: [3, 9], seed: 61 });

    ctx.save();
    const [sx, sy] = g.shake(10 * impact(lt, 8) + 1.2);
    g.camera(960, 540, lerp(1.0, 1.06, ease.inOut(u)), lerp(0.01, -0.01, u), sx, sy);
    // 左下：雪人（围巾自己画，被风拉得很长）
    const s = 1.45, x = 300, y = 1075;
    C.snowman(g, x, y, s, { scarf: false, wind: 1, look: 0.8, lookUp: 0.55, mood: 'hope', arms: [0.05, 0.55], blush: 1, seed: 1010, t: tt });
    const nx = x, ny = y - 216.4 * s;
    const reach = ease.inOut(seg(u, 0, 0.8));
    const ex = lerp(820, 1330, reach), ey = lerp(640, 400, reach);
    const tip = longScarf(g, nx + 40 * s, ny + 26 * s, ex, ey, tt, 1.15, 1020);
    // 围在脖子上的那一圈
    g.curve(BAND.map((q) => [nx + q[0] * s, ny + q[1] * s]), { color: INK, width: 4.2 * s, fill: RED, closed: true, seed: 1011 });
    for (let k = 0; k < 5; k++) {
      const bx = nx + (-62 + k * 30) * s;
      g.line(bx, ny + 2 * s, bx + 6 * s, ny + 26 * s, { color: RED_D, width: 2.6 * s, seed: 1012 + k });
    }
    // 右上：伸过来的红手套（指尖朝左下）
    const ms = 1.9, ma = 0.5;
    const dir = [-Math.cos(ma), Math.sin(ma)];
    const fxT = 1330 + 150, fyT = 400 - 80; // 指尖最后停在这里
    const mk = ease.outCubic(seg(u, 0.1, 0.75));
    const back = 700 * (1 - mk);
    const wx = fxT - dir[0] * (158 * ms + back) + 4 * Math.sin(tt * 2.4), wy = fyT - dir[1] * (158 * ms + back) + 6 * Math.sin(tt * 2.1);
    // "你"的大衣袖子：从手套袖口一直伸到画外，这样看得出是有人在伸手，而不是一只飘着的手套
    {
      const ux = -dir[0], uy = -dir[1]; // 指向画外（手臂方向）
      const nx2 = -uy, ny2 = ux;
      const a0 = 22 * ms, a1 = 900, w0 = 58 * ms, w1 = 74 * ms;
      g.poly([
        [wx + ux * a0 + nx2 * w0, wy + uy * a0 + ny2 * w0],
        [wx + ux * a1 + nx2 * w1, wy + uy * a1 + ny2 * w1],
        [wx + ux * a1 - nx2 * w1, wy + uy * a1 - ny2 * w1],
        [wx + ux * a0 - nx2 * w0, wy + uy * a0 - ny2 * w0],
      ], { color: INK, width: 5, fill: '#4a3436', seed: 1031 });
      // 袖子上一道褶
      g.line(wx + ux * 120 * ms + nx2 * 20 * ms, wy + uy * 120 * ms + ny2 * 20 * ms, wx + ux * 190 * ms - nx2 * 6 * ms, wy + uy * 190 * ms - ny2 * 6 * ms, { color: '#6a4c4c', width: 4, seed: 1032 });
    }
    C.mitten(g, wx, wy, ms, -Math.PI / 2 - ma, { seed: 1030 });
    // 两个红色之间：差一点
    if (reach > 0.7) {
      const a = clamp((reach - 0.7) / 0.25);
      const fx = wx + dir[0] * 158 * ms, fy = wy + dir[1] * 158 * ms;
      const mxp = (tip[0] + fx) / 2, myp = (tip[1] + fy) / 2;
      for (let k = 0; k < 5; k++) {
        const an = -Math.PI / 2 + (k - 2) * 0.5;
        const r0 = 26, r1 = 26 + 34 * a;
        g.line(mxp + Math.cos(an) * r0, myp + Math.sin(an) * r0 - 30, mxp + Math.cos(an) * r1, myp + Math.sin(an) * r1 - 30, { color: INK, width: 5, seed: 1040 + k });
      }
    }
    ctx.restore();
    g.text('差一点', 1430, 700, { size: 120, font: 'hand', color: INK, progress: seg(u, 0.5, 0.8), rot: -0.06, seed: 1050 });
    flashIn(g, lt, INK, 0.45);
  }

  // ------------------------------------------------------------------ S5 拼贴 → 炸散成雪花 → 白屏
  const COLLAGE = [
    { k: 'char', ch: '雪', x: 330, y: 240, size: 270, rot: -0.14 },
    { k: 'char', ch: '人', x: 1590, y: 240, size: 270, rot: 0.12 },
    { k: 'char', ch: '等', x: 330, y: 700, size: 250, rot: 0.08 },
    { k: 'char', ch: '你', x: 1590, y: 690, size: 270, rot: -0.1, red: true },
    { k: 'heart', x: 960, y: 120, r: 62 },
    { k: 'flake', x: 650, y: 150, r: 70 },
    { k: 'clock', x: 1270, y: 150, r: 74 },
    { k: 'door', x: 540, y: 560, rot: 0.06 },
    { k: 'mitten', x: 1395, y: 650, s: 0.95, rot: -0.4 },
  ];

  function collageItem(g, it, inv, t) {
    const ctx = g.ctx;
    const fg = inv ? INK : WHITE;
    if (it.k === 'char') {
      bigChar(g, it.ch, 0, 0, it.size, it.red ? RED : fg, { seed: 1100 + it.size, shadow: { color: it.red ? fg : RED, dx: 7, dy: 7 } });
    } else if (it.k === 'heart') {
      const b = heartBeat(g);
      ctx.scale(1 + 0.1 * b, 1 + 0.1 * b);
      C.heart(g, 0, 0, it.r, { fill: RED, color: fg, width: 5, seed: 1110 });
    } else if (it.k === 'flake') {
      C.flake(g, 0, 0, it.r, { rot: t * 0.6, color: fg, width: 6, seed: 1111 });
    } else if (it.k === 'clock') {
      clockFace(g, 0, 0, it.r, fg, { h: t * 0.8, m: t * 6.5, s: Math.floor(t * 4) * (TAU / 24) }, { width: 4 });
    } else if (it.k === 'door') {
      doorSil(g, -55, -100, 110, 200, { fill: inv ? WHITE : '#25222e', frame: inv ? WHITE : '#1c1a24', line: fg });
    } else if (it.k === 'mitten') {
      C.mitten(g, 0, 0, it.s, 0, { seed: 1112 });
    }
  }

  function shot5(g, p, t, info) {
    const ctx = g.ctx;
    const { u, D } = local(info, p, S5);
    const tt = info.songTime;
    const uc = seg(u, 0, 0.36), ub = seg(u, 0.36, 0.72), uw = seg(u, 0.72, 1);
    const cx = 960, cy = 500;
    const burst = u >= 0.36;
    const bt = (u - 0.36) * D; // 炸开后过了几秒
    g.bg(burst ? WHITE : INK);

    if (!burst) {
      // 拼贴：东西一个接一个"啪啪"贴上来
      const lt = uc * 0.36 * D;
      g.snow({ count: 110, color: WHITE, alpha: 0.75, size: [2, 9], seed: 71 });
      ctx.save();
      const [sx, sy] = g.shake(3 + 6 * uc);
      g.camera(cx, 480, lerp(1.0, 1.05, uc), 0, sx, sy);
      g.glow(cx, cy, 620, RED, 0.3);
      const k0 = ease.outBack(clamp(lt / 0.2));
      g.circle(cx, cy, 290 * k0, { fill: RED, color: RED, width: 4, seed: 1120 });
      C.snowman(g, cx, 835, 0.88, { mood: 'happy', wind: 0.8, look: 0, lookUp: 0.3, arms: [0.8, 0.8], blush: 1, seed: 1121, t: tt });
      COLLAGE.forEach((it, i) => {
        const at = 0.06 + (i / COLLAGE.length) * 0.62;
        if (uc < at) return;
        const ilt = (uc - at) * 0.36 * D;
        ctx.save();
        stampOn(g, it.x, it.y, ilt, { from: 0.5, rot: it.rot || 0, spin: i % 2 ? 0.2 : -0.2 });
        collageItem(g, it, false, tt);
        ctx.restore();
      });
      ctx.restore();
      // 快要炸开：越来越亮
      const pre = seg(uc, 0.82, 1);
      if (pre > 0) {
        g.glow(cx, cy, 900 * pre + 200, '#ffffff', 0.7 * pre);
        focusLines(g, cx, cy, lerp(900, 420, pre), WHITE, 90, 1130, 0.5 * pre);
      }
      return;
    }

    // ---- 炸开：白底，所有东西变成墨色往外飞，同时变成雪花
    const eb = ease.outCubic(ub);
    if (uw < 1) {
      ctx.save();
      ctx.globalAlpha *= 1 - ease.in(ub);
      // 冲击波
      g.circle(cx, cy, 120 + eb * 1500, { color: INK, width: 30 * (1 - ub) + 2, seed: 1140 });
      g.circle(cx, cy, 60 + eb * 1100, { color: RED, width: 14 * (1 - ub) + 1, seed: 1141 });
      // 物件往外飞、转、淡出
      COLLAGE.forEach((it, i) => {
        const f = 1 + 2.2 * eb;
        const x = cx + (it.x - cx) * f, y = cy + (it.y - cy) * f;
        ctx.save();
        ctx.globalAlpha *= clamp(1 - ub * 1.8);
        ctx.translate(x, y);
        ctx.rotate((it.rot || 0) + (i % 2 ? 1 : -1) * eb * 1.4);
        ctx.scale(1 + eb * 0.6, 1 + eb * 0.6);
        collageItem(g, it, true, tt);
        ctx.restore();
      });
      // 雪人：放大、淡出（化成雪花）
      ctx.save();
      ctx.globalAlpha *= clamp(1 - ub * 5.5);
      ctx.translate(cx, cy);
      ctx.scale(1 + eb * 0.35, 1 + eb * 0.35);
      ctx.translate(-cx, -cy);
      C.snowman(g, cx, 835, 0.88, { mood: 'happy', look: 0, lookUp: 0.3, arms: [0.8, 0.8], blush: 1, seed: 1121, t: tt });
      ctx.restore();
      ctx.restore();
    }

    // 雪花粒子：从中心炸开（外面一圈"壳"+ 里面散的）→ 慢慢飘落 → 融进白色里
    const N = 320;
    const vel = 3 * (1 - ub) * (1 - ub); // outCubic 的速度
    ctx.save();
    ctx.lineCap = 'round';
    const fallT = Math.max(0, bt - 0.4 * D * 0.36);
    for (let i = 0; i < N; i++) {
      const a = rand(i, 1150) * TAU;
      const shell = rand(i, 1159) < 0.62;
      const sp = shell ? 950 + rand(i, 1151) * 450 : 120 + rand(i, 1151) * 780;
      const r0 = 30 + rand(i, 1152) * 220;
      const size = 4 + Math.pow(rand(i, 1153), 2.2) * 30;
      const red = rand(i, 1154) < 0.1;
      const ca = Math.cos(a), sa = Math.sin(a) * 0.8;
      const dist = r0 + sp * eb;
      let x = cx + ca * dist, y = cy + sa * dist;
      // 炸开之后开始往下飘
      y += fallT * (30 + 50 * rand(i, 1155));
      x += Math.sin(tt * (0.6 + rand(i, 1156)) + i) * 14 * clamp(fallT);
      const alpha = (1 - ease.inOut(uw)) * (red ? 0.95 : 0.8);
      if (alpha <= 0.01 || x < -160 || x > W + 160 || y < -160 || y > H + 160) continue;
      const col = red ? RED : i % 3 ? '#8ea6c8' : INK;
      ctx.strokeStyle = col;
      // 速度线
      // 速度线不伸回中心（否则刚炸开时中间会糊成一团灰线）
      const sl = Math.min(220, sp * vel * 0.12, dist - 140);
      if (sl > 8) {
        ctx.globalAlpha = alpha * 0.35;
        ctx.lineWidth = Math.max(1.5, size * 0.12);
        ctx.beginPath();
        ctx.moveTo(x - ca * sl, y - sa * sl);
        ctx.lineTo(x - ca * size * 1.2, y - sa * size * 1.2);
        ctx.stroke();
      }
      ctx.globalAlpha = alpha;
      ctx.lineWidth = Math.max(1.5, size * 0.13);
      flakeP(ctx, x, y, size, rand(i, 1157) * 6 + tt * (rand(i, 1158) - 0.5) * 3);
    }
    ctx.restore();

    // 白光一闪
    flashIn(g, bt, '#ffffff', 1);
    // 最后：只剩一片白，和一片慢慢落下的大雪花
    if (uw > 0) {
      const fk = ease.inOut(uw);
      ctx.save();
      ctx.globalAlpha *= Math.sin(clamp(uw * 1.15) * Math.PI) * 0.8;
      C.flake(g, 960 + Math.sin(tt * 0.8) * 30, lerp(330, 470, fk), 70, { rot: tt * 0.4, color: P.ice, width: 5, seed: 1160 });
      ctx.restore();
      // 最后几帧完全变白
      ctx.save();
      ctx.globalAlpha *= ease.in(seg(uw, 0.55, 1));
      ctx.fillStyle = '#fffdf8';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ 注册
  TG.scene({
    id: 'flash',
    title: '高潮',
    dark: true,
    transition: 'flash',
    chars: '雪人等你我第天门没开还在口咚差一点！……',
    lyrics: 'default',
    draw(g, p, t, info) {
      if (p < S1[1]) shot1(g, p, t, info);
      else if (p < S2[1]) shot2(g, p, t, info);
      else if (p < S3[1]) shot3(g, p, t, info);
      else if (p < S4A[1]) shot4a(g, p, t, info);
      else if (p < S4B[1]) shot4b(g, p, t, info);
      else if (p < S4C[1]) shot4c(g, p, t, info);
      else shot5(g, p, t, info);
    },
  });
})();
