/* 场景：christmas —— 窗
 *
 * 镜头（按 p 分段，适配 12～35 秒）：
 *   1. 0.00–0.20  远景：你家的墙和一扇暖光的窗，窗里是圣诞树和你的剪影；雪人站在左下角的暗处仰头望着。手写「12.24 / 平安夜」
 *   2. 0.20–0.32  推近窗户：彩灯一闪一闪，剪影踮起脚、把星星举向树顶（「嘿咻～」）
 *   3. 0.32–0.43  特写插入：星星落在树顶 →「叮！」一圈光爆开，所有彩灯一起亮
 *   4. 0.43–0.69  玻璃大特写：雾从四角爬满玻璃，雾后面你的影子靠过来，看不见的手指在雾上画了一个小雪人和一颗心，水珠顺着笔画往下淌
 *   5. 0.69–0.735 闪切：雪人眼睛大特写，眼睛里映着那扇暖窗，脸一下子红了
 *   6. 0.735–0.87 反打：雪人近景，被窗光照得暖暖的，害羞得冒烟，举起树枝手轻轻挥，「给我的？」
 *   7. 0.87–1.00  回到窗前：窗里的灯「啪」地灭了，雾上的小画还留在玻璃上；雪人慢慢放下手，「晚安」
 */
(function () {
  'use strict';
  const { clamp, lerp, seg, ease, rand, noise1, mix, rgba } = TG.U;
  const P = TG.PAL, C = TG.C, W = TG.W, H = TG.H;

  // 镜头分段
  const SH = { wide: 0.2, push: 0.32, star: 0.43, fog: 0.69, eye: 0.735, rev: 0.87 };

  // 颜色
  const INK_N = '#232033';
  const SNOW_N = '#e6ecf8';
  const YOU = '#5a3d3a';
  const COAT = '#4a3436';
  const ROOM_T = '#f6c272', ROOM_B = '#df8a45';
  const ROOM_OFF_T = '#2b2b4c', ROOM_OFF_B = '#1d1d38';
  const CURTAIN = '#c98a3e', CURTAIN_D = '#a86c2c';
  const BULB = [P.sun, '#8fd0ff', '#ffffff', '#ffb38a', '#b8f0c8'];

  // 世界坐标（远景）：窗玻璃、墙、地面、雪人
  const WX = 1010, WY = 250, WW = 520, WH = 430;
  const WALL_X = 640, WALL_TOP = 96, GROUND_Y = 846;
  const SMX = 380, SMY = 900, SMS = 0.82;

  // ------------------------------------------------------------------ 小工具
  /** 柔光（smoothstep 衰减；色标别太多——超过 8 个在软件渲染下会明显变慢） */
  function softGlow(g, x, y, r, color, a, NS = 6) {
    if (a <= 0.003 || r <= 0) return;
    const ctx = g.ctx;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    for (let i = 0; i <= NS; i++) {
      const u = i / NS;
      const v = 1 - u * u * (3 - 2 * u);
      gr.addColorStop(u, rgba(color, a * v * v));
    }
    ctx.save();
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  /** 平滑暗角 */
  function vignette(g, a, color = '#090c1a') {
    if (a <= 0) return;
    const ctx = g.ctx;
    const R = Math.hypot(W, H) * 0.5;
    const gr = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, R);
    const NS = 6;
    for (let i = 0; i <= NS; i++) {
      const u = i / NS;
      const k = clamp((u - 0.4) / 0.6);
      gr.addColorStop(u, rgba(color, a * k * k * (3 - 2 * k)));
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function vgrad(g, y0, y1, c0, c1) {
    const gr = g.ctx.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, c0);
    gr.addColorStop(1, c1);
    return gr;
  }

  /** 折线总长 */
  function plen(pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return L;
  }
  /** 折线上按长度比例 u 的点 */
  function pointAt(pts, u) {
    const tot = plen(pts) * clamp(u);
    let s = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (s + d >= tot) {
        const k = d ? (tot - s) / d : 0;
        return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)];
      }
      s += d;
    }
    return pts[pts.length - 1].slice();
  }

  /** 夜空星星（只在 [x0,x1]×[0,yMax] 里） */
  function stars(g, t, n, x0, x1, yMax, seed = 41, a = 1) {
    const ctx = g.ctx;
    ctx.save();
    ctx.fillStyle = '#e9eeff';
    const base = ctx.globalAlpha * a;
    for (let i = 0; i < n; i++) {
      const x = lerp(x0, x1, rand(i, seed, 1)), y = rand(i, seed, 2) * yMax;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.6 + rand(i, seed, 3) * 1.6) + i));
      ctx.globalAlpha = base * tw * (0.35 + rand(i, seed, 4) * 0.55);
      ctx.beginPath();
      ctx.arc(x, y, 1 + rand(i, seed, 5) * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 小松树剪影（带点雪） */
  function pine(g, x, y, s, seed) {
    g.line(x, y, x, y - 30 * s, { color: '#1a1f3a', width: 8 * s, taper: false, seed: seed + 3 });
    [[0, 52, 70], [44, 42, 64], [84, 30, 56]].forEach(([dy, hw, hh], k) => {
      const by = y - 18 * s - dy * s;
      g.poly([[x - hw * s, by], [x, by - hh * s], [x + hw * s, by]], { color: INK_N, width: 2.4, fill: k ? '#2b3762' : '#26305a', seed: seed + k * 2 });
      g.path([[x - hw * 0.45 * s, by - hh * 0.5 * s], [x, by - hh * s], [x + hw * 0.4 * s, by - hh * 0.55 * s], [x + 2 * s, by - hh * 0.62 * s]], { closed: true, smooth: true, color: rgba(INK_N, 0.6), width: 1.6, fill: rgba(SNOW_N, 0.85), seed: seed + k * 2 + 1 });
    });
  }

  /** 发亮的小灯泡 */
  function bulb(g, x, y, r, col, on) {
    const ctx = g.ctx;
    if (on > 0.05) {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
      gr.addColorStop(0, rgba(col, 0.5 * on));
      gr.addColorStop(0.35, rgba(col, 0.16 * on));
      gr.addColorStop(1, rgba(col, 0));
      ctx.save();
      ctx.fillStyle = gr;
      ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
      ctx.restore();
    }
    ctx.save();
    ctx.fillStyle = mix('#3a3550', col, 0.25 + 0.75 * on);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 1.25, 0, 0, Math.PI * 2);
    ctx.fill();
    if (on > 0.4) {
      ctx.fillStyle = rgba('#ffffff', 0.8 * on);
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 五角星（可旋转/缩放） */
  function starShape(g, x, y, r, o = {}) {
    const pts = [];
    const rot = o.rot || 0;
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + rot + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.46 : r;
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    g.poly(pts, { color: o.color || P.ink, width: o.width || Math.max(2.5, r * 0.09), fill: o.fill || P.sun, seed: o.seed });
    // 高光
    g.line(x - r * 0.18, y - r * 0.42, x - r * 0.3, y - r * 0.08, { color: '#fff8dc', width: Math.max(2, r * 0.07), seed: (o.seed | 0) + 1, alpha: 0.9 });
  }

  /** 放射状的"叮"光芒（手绘线） */
  function burstRays(g, x, y, r0, r1, k, n, seed, color = '#fff6d8', width = 5) {
    if (k <= 0) return;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(i, seed, 1) * 0.25;
      const len = lerp(r0, r1, 0.6 + 0.4 * rand(i, seed, 2));
      const head = ease.outCubic(clamp(k * 1.6));
      const tail = ease.in(clamp(k * 1.4 - 0.35));
      const a0 = lerp(r0, len, tail), a1 = lerp(r0, len, head);
      if (a1 - a0 < 2) continue;
      g.line(x + Math.cos(a) * a0, y + Math.sin(a) * a0, x + Math.cos(a) * a1, y + Math.sin(a) * a1, { color, width: width * (i % 2 ? 0.7 : 1), seed: seed + i });
    }
  }

  // ------------------------------------------------------------------ 临时画布（每次整块覆盖重画，不带帧间状态）
  let fogBuf = null;

  // ------------------------------------------------------------------ 雾上的小画：小雪人 + 心
  function circ(cx, cy, r, a0, sweep, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (sweep * i) / n;
      const k = 1 + 0.03 * Math.sin(a * 3 + cx);
      out.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k]);
    }
    return out;
  }
  function heartPts(cx, cy, r) {
    const out = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(a), 3);
      const y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
      out.push([cx + (x / 17) * r, cy + (y / 17) * r]);
    }
    out.push([cx + 0.05 * r, cy - 0.2 * r]);
    return out;
  }
  const DOODLE = (() => {
    const S = [];
    S.push(circ(0, 150, 120, -Math.PI / 2 - 0.4, Math.PI * 2 + 0.3, 40)); // 身体
    S.push(circ(0, -62, 95, -Math.PI / 2 - 0.5, Math.PI * 2 + 0.25, 32)); // 头
    S.push([[-94, -150], [0, -157], [94, -152]]); // 帽檐
    S.push([[-52, -154], [-50, -236], [0, -242], [52, -240], [54, -156]]); // 帽子
    S.push(circ(-36, -94, 2.5, 0, Math.PI * 2, 6)); // 眼
    S.push(circ(36, -94, 2.5, 0, Math.PI * 2, 6));
    S.push([[-2, -62], [48, -54]]); // 鼻子
    S.push(circ(0, -56, 44, 0.8, Math.PI - 1.6, 10)); // 笑
    S.push([[-116, 100], [-176, 58], [-222, 10]]); // 左手
    S.push([[-178, 60], [-228, 72]]);
    S.push([[116, 100], [176, 58], [222, 10]]); // 右手
    S.push([[178, 60], [228, 72]]);
    S.push(heartPts(370, -30, 90)); // 心
    const lens = S.map(plen);
    const GAP = 70; // 抬手的"空档"
    const starts = [];
    let tot = 0;
    lens.forEach((l, i) => { starts.push(tot); tot += l + (i < lens.length - 1 ? GAP : 0); });
    // 水珠从这些地方往下淌：[笔画序号, 笔画上的位置, 最长长度]
    const drips = [[0, 0.5, 120], [0, 0.66, 80], [0, 0.36, 50], [12, 0.5, 190], [12, 0.3, 80], [1, 0.62, 40], [8, 1, 60], [10, 1, 90], [3, 1, 30]];
    return {
      S, lens, starts, tot,
      drips: drips.map(([si, u, L], k) => ({ o: pointAt(S[si], u), at: (starts[si] + lens[si] * u) / tot, L, k })),
    };
  })();

  /** 雾上的小画画到 pr（0..1）时，手指所在的位置（单位坐标） */
  function doodleHead(pr) {
    const D = DOODLE;
    const s = clamp(pr) * D.tot;
    for (let i = 0; i < D.S.length; i++) {
      const a = D.starts[i], b = a + D.lens[i];
      if (s <= b) return s >= a ? pointAt(D.S[i], (s - a) / D.lens[i]) : D.S[i][0].slice();
      const nb = i + 1 < D.S.length ? D.starts[i + 1] : Infinity;
      if (s < nb) {
        const k = (s - b) / (nb - b);
        const e = D.S[i][D.S[i].length - 1], n = D.S[i + 1][0];
        return [lerp(e[0], n[0], k), lerp(e[1], n[1], k)];
      }
    }
    const L = D.S[D.S.length - 1];
    return L[L.length - 1].slice();
  }

  /**
   * 起雾的玻璃（画在 X,Y,w,h 这块玻璃上）。
   * o = {k 雾的浓度, pr 小画进度（>1 时水珠继续往下淌）, cx, cy 小画中心（相对玻璃左上角）, u 小画缩放, fw 手指宽,
   *      color 雾色, alpha, res 分辨率比例, rim 笔画边上的亮边}
   * 返回水珠末端的位置（世界坐标），方便在上面画小水珠。
   */
  function fogGlass(g, X, Y, w, h, o) {
    const out = [];
    const k = clamp(o.k);
    if (k <= 0.005) return out;
    const q = o.res || 0.5;
    const bw = Math.max(8, Math.round(w * q)), bh = Math.max(8, Math.round(h * q));
    if (!fogBuf) fogBuf = document.createElement('canvas');
    if (fogBuf.width !== bw || fogBuf.height !== bh) { fogBuf.width = bw; fogBuf.height = bh; }
    const b = fogBuf.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalCompositeOperation = 'source-over';
    b.globalAlpha = 1;
    b.clearRect(0, 0, bw, bh);
    b.scale(bw / w, bh / h);
    const col = o.color || '#f7efe6';
    const A = o.alpha == null ? 0.86 : o.alpha;
    // 雾从四周往中间长
    const R = Math.hypot(w, h) / 2;
    const gr = b.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, R);
    for (let i = 0; i <= 6; i++) {
      const u = i / 6;
      const a = clamp(k * 1.8 - (1 - u) * 0.95);
      gr.addColorStop(u, rgba(col, A * a * a * (3 - 2 * a)));
    }
    b.fillStyle = gr;
    b.fillRect(0, 0, w, h);
    // 下面的雾更厚一点
    const lg = b.createLinearGradient(0, 0, 0, h);
    lg.addColorStop(0, rgba(col, 0));
    lg.addColorStop(1, rgba(col, 0.22 * k * A));
    b.fillStyle = lg;
    b.fillRect(0, 0, w, h);
    // 一团一团的雾气（不均匀）
    const blobs = o.blobs == null ? 7 : o.blobs;
    for (let i = 0; i < blobs; i++) {
      const bx = rand(i, 77, 1) * w, by = rand(i, 77, 2) * h, br = (0.15 + rand(i, 77, 3) * 0.25) * Math.min(w, h);
      const g2 = b.createRadialGradient(bx, by, 0, bx, by, br);
      g2.addColorStop(0, rgba('#ffffff', 0.18 * k));
      g2.addColorStop(1, rgba('#ffffff', 0));
      b.fillStyle = g2;
      b.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    // 凝结的小水点
    const dots = o.dots == null ? 140 : o.dots;
    b.fillStyle = '#ffffff';
    for (let i = 0; i < dots; i++) {
      const x = rand(i, 78, 1) * w, y = rand(i, 78, 2) * h;
      const dd = Math.hypot(x - w / 2, y - h / 2) / R;
      b.globalAlpha = clamp(k * 1.8 - (1 - dd) * 0.95) * (0.25 + 0.35 * rand(i, 78, 3));
      b.beginPath();
      b.arc(x, y, (0.8 + rand(i, 78, 4) * 2.6) / q * 0.5, 0, Math.PI * 2);
      b.fill();
    }
    b.globalAlpha = 1;
    // 自己淌下来的几道水痕
    const trails = o.trails == null ? 0 : o.trails;
    if (trails > 0 && k > 0.5) {
      b.globalCompositeOperation = 'destination-out';
      b.strokeStyle = 'rgba(0,0,0,0.75)';
      b.lineCap = 'round';
      for (let i = 0; i < trails; i++) {
        const x = (0.04 + rand(i, 79, 1) * 0.92) * w, y = (0.15 + rand(i, 79, 2) * 0.5) * h;
        const L = (0.12 + rand(i, 79, 3) * 0.3) * h * clamp((k - 0.5) * 2);
        b.lineWidth = (2 + rand(i, 79, 4) * 3) / q * 0.5;
        b.beginPath();
        b.moveTo(x, y);
        b.lineTo(x + (rand(i, 79, 5) - 0.5) * 6, y + L);
        b.stroke();
      }
      b.globalCompositeOperation = 'source-over';
    }
    // 手指画的小画
    const pr = o.pr || 0;
    if (pr > 0) {
      const u = o.u, cx = o.cx, cy = o.cy;
      const D = DOODLE;
      const drawn = clamp(pr) * D.tot;
      const strokePaths = () => {
        b.beginPath();
        for (let i = 0; i < D.S.length; i++) {
          const rem = drawn - D.starts[i];
          if (rem <= 0) break;
          const pts = D.S[i];
          const lim = Math.min(rem, D.lens[i]);
          let s = 0;
          b.moveTo(cx + pts[0][0] * u, cy + pts[0][1] * u);
          for (let j = 1; j < pts.length; j++) {
            const d = Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
            if (s + d >= lim) {
              const kk = d ? (lim - s) / d : 0;
              b.lineTo(cx + lerp(pts[j - 1][0], pts[j][0], kk) * u, cy + lerp(pts[j - 1][1], pts[j][1], kk) * u);
              break;
            }
            s += d;
            b.lineTo(cx + pts[j][0] * u, cy + pts[j][1] * u);
          }
        }
      };
      b.lineCap = 'round';
      b.lineJoin = 'round';
      // 笔画边上推开的水汽（亮边）
      if (o.rim !== false) {
        b.strokeStyle = rgba('#ffffff', 0.55 * k);
        b.lineWidth = o.fw * 1.55;
        strokePaths();
        b.stroke();
      }
      b.globalCompositeOperation = 'destination-out';
      b.strokeStyle = 'rgba(0,0,0,0.93)';
      b.lineWidth = o.fw;
      strokePaths();
      b.stroke();
      // 水珠往下淌
      b.lineWidth = Math.max(1.5, o.fw * 0.3);
      for (const d of D.drips) {
        const grow = ease.out(clamp((pr - d.at) / 0.32));
        if (grow <= 0) continue;
        const L = d.L * grow * u;
        const x0 = cx + d.o[0] * u, y0 = cy + d.o[1] * u + o.fw * 0.3;
        const wig = Math.sin(d.k * 2.1) * 4 * u;
        b.beginPath();
        b.moveTo(x0, y0);
        b.quadraticCurveTo(x0 + wig, y0 + L * 0.5, x0 + wig * 0.4, y0 + L);
        b.stroke();
        out.push([X + x0 + wig * 0.4, Y + y0 + L, u]);
      }
    }
    g.ctx.save();
    g.ctx.imageSmoothingEnabled = true;
    g.ctx.drawImage(fogBuf, 0, 0, bw, bh, X, Y, w, h);
    g.ctx.restore();
    return out;
  }

  /** 玻璃上的小水珠 */
  function bead(g, x, y, r, a = 1) {
    const ctx = g.ctx;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,70,60,0.35)';
    ctx.lineWidth = Math.max(1, r * 0.25);
    ctx.beginPath();
    ctx.arc(x, y + r * 0.1, r * 0.9, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.4, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------------------------ 圣诞树 / 你
  /**
   * 圣诞树。(x,y) 是树底，s=1 时高约 520px。
   * o = {t, lit 灯亮度, burst 一齐亮, star 0..1 星星（放上去的弹出）, dark 0..1 关灯后的暗, cascade 0..1 灯从上往下依次亮}
   */
  function tree(g, x, y, s, o = {}) {
    const t = o.t || 0, seed = o.seed | 0;
    const lit = o.lit == null ? 1 : o.lit, burst = o.burst || 0, dark = o.dark || 0;
    const ink = o.ink || P.ink;
    const lw = 4 * s;
    const green = mix(P.greenDeep, '#1b2836', dark), greenD = mix('#2c5242', '#121a26', dark);
    g.rect(x - 20 * s, y - 70 * s, 40 * s, 70 * s, { color: ink, width: lw, fill: mix(P.wood, '#2a2030', dark), seed });
    const tiers = [[0, 190, 70], [130, 160, 200], [250, 120, 330]];
    let bi = 0;
    tiers.forEach(([dy, hw, top], k) => {
      const by = y - (60 + dy) * s, ay = y - (60 + top + 130) * s;
      const th = by - ay;
      g.poly([[x - hw * s, by], [x, ay], [x + hw * s, by]], { color: ink, width: lw, fill: green, seed: seed + 1 + k });
      g.fill([[x + 8 * s, ay + th * 0.25], [x + hw * s * 0.8, by - 6 * s], [x + 14 * s, by - 6 * s]], greenD, { seed: seed + 5 + k, alpha: 0.75 });
      // 灯串
      const f0 = 0.5, f1 = 0.16;
      const L = [x - hw * s * (1 - f0) * 0.95, by - th * f0], R = [x + hw * s * (1 - f1) * 0.92, by - th * f1];
      const M = [lerp(L[0], R[0], 0.5), lerp(L[1], R[1], 0.5) + 20 * s];
      g.curve([L, M, R], { color: rgba('#f3e6c4', 0.7 * (1 - dark * 0.7)), width: 2.2 * s, seed: seed + 20 + k });
      const Q = [2 * M[0] - (L[0] + R[0]) / 2, 2 * M[1] - (L[1] + R[1]) / 2];
      const nb = 6 - k;
      for (let i = 0; i < nb; i++) {
        const u = (i + 0.5) / nb;
        const bx = (1 - u) * (1 - u) * L[0] + 2 * u * (1 - u) * Q[0] + u * u * R[0];
        const byy = (1 - u) * (1 - u) * L[1] + 2 * u * (1 - u) * Q[1] + u * u * R[1];
        const idx = bi++;
        const chase = 0.5 + 0.5 * Math.sin(t * 5 - idx * 0.9);
        const casc = o.cascade == null ? 1 : clamp((o.cascade - (1 - (k * 10 + i) / 30) * 0.6) * 4);
        const on = clamp((lit * (0.3 + 0.7 * chase + 0.3 * (g.info.pulse || 0)) + burst) * casc);
        bulb(g, bx, byy + 5 * s, 6.5 * s, BULB[idx % BULB.length], on);
      }
      // 挂件
      const orn = [[-0.45, 0.32, P.sun], [0.38, 0.55, '#7fb0e8']];
      orn.forEach(([ux, uy, c], j) => {
        if (k === 2 && j === 1) return;
        const oy = by - th * uy, half = hw * s * (1 - uy);
        const ox = x + ux * half * 1.6;
        g.circle(ox, oy, 10 * s, { color: ink, width: 2.4 * s, fill: mix(c, '#2a2a40', dark), seed: seed + 40 + k * 2 + j });
      });
    });
    // 星星
    if (o.star > 0) {
      const sy = y - 520 * s;
      const sc = o.star;
      if (lit + burst > 0.05) softGlow(g, x, sy, 90 * s * (1 + burst), P.sun, (0.45 * lit + 0.5 * burst) * (1 - dark));
      starShape(g, x, sy, 30 * s * sc, { fill: mix(P.sun, '#6a6684', dark * 0.8), seed: seed + 9, color: ink });
    }
  }

  /**
   * "你"的剪影，带一只能举起来的手臂（举着星星）。
   * (x,y) 脚底；o = {hand:[x,y], star:bool, tiptoe 0..1, color, seed}
   */
  function you(g, x, y, s, o = {}) {
    const col = o.color || YOU, seed = o.seed | 0;
    const yy = y - (o.tiptoe || 0) * 16 * s;
    // 垂下的那只手
    g.line(x - 52 * s, yy - 284 * s, x - 70 * s, yy - 150 * s, { color: col, width: 24 * s, taper: false, seed: seed + 7 });
    C.person(g, x, yy, s, { color: col, seed });
    const sx = x + 48 * s, sy = yy - 288 * s;
    const [hx, hy] = o.hand;
    const mx = (sx + hx) / 2, my = (sy + hy) / 2;
    const dx = hx - sx, dy = hy - sy, d = Math.hypot(dx, dy) || 1;
    const bend = Math.max(0, 190 * s - d) * 0.55 + 8 * s;
    const ex = mx - (dy / d) * bend, ey = my + (dx / d) * bend;
    g.curve([[sx, sy], [ex, ey], [hx, hy]], { color: col, width: 22 * s, taper: false, seed: seed + 8 });
    // 手：一只小小的红手套
    const mrot = Math.atan2(hx - ex, -(hy - ey));
    const ms = 0.17 * s;
    if (o.star) starShape(g, hx + Math.sin(mrot) * 150 * ms, hy - Math.cos(mrot) * 150 * ms, 19 * s, { seed: seed + 10, rot: 0.2 });
    miniMitten(g, hx, hy, ms, mrot);
  }

  /** 远景里的小红手套（只要轮廓和袖口，省掉刺绣） */
  function miniMitten(g, x, y, s, rot) {
    const ctx = g.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(s, s);
    ctx.fillStyle = P.red;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 9;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-46, 0);
    ctx.bezierCurveTo(-56, -80, -40, -160, 0, -158);
    ctx.bezierCurveTo(40, -156, 48, -100, 44, -86);
    ctx.lineTo(80, -112);
    ctx.lineTo(90, -96);
    ctx.lineTo(46, -40);
    ctx.lineTo(42, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fbf6ef';
    ctx.fillRect(-50, 0, 98, 34);
    ctx.strokeRect(-50, 0, 98, 34);
    ctx.restore();
  }

  // ------------------------------------------------------------------ 窗（世界坐标）
  /** 窗里的房间 + 窗框。st = {t, light, reach, tiptoe, placed, burst, person, fog, pr, fogColor, fogAlpha} */
  function windowWorld(g, st) {
    const ctx = g.ctx;
    const X = WX, Y = WY, w = WW, h = WH;
    const light = st.light;
    const t = st.t;
    ctx.save();
    ctx.beginPath();
    ctx.rect(X, Y, w, h);
    ctx.clip();
    // 墙纸
    const gr = ctx.createLinearGradient(0, Y, 0, Y + h);
    gr.addColorStop(0, mix(ROOM_OFF_T, ROOM_T, light));
    gr.addColorStop(1, mix(ROOM_OFF_B, ROOM_B, light));
    ctx.fillStyle = gr;
    ctx.fillRect(X, Y, w, h);
    ctx.fillStyle = rgba('#fff3d6', 0.13 * light + 0.03);
    for (let i = 0; i < 10; i++) ctx.fillRect(X + i * (w / 10) + w / 40, Y, w / 46, h);
    softGlow(g, X + w * 0.18, Y + h * 0.22, w * 0.55, '#fff1cc', 0.55 * light);
    // 墙上的小相框
    g.rect(X + w * 0.07, Y + h * 0.12, w * 0.13, h * 0.15, { color: rgba(P.ink, 0.6), width: 3, fill: mix('#3a3552', '#f8e2b0', light), seed: 801 });
    // 树
    const ts = 0.68;
    const tx = X + w * 0.72, ty = Y + h + 30;
    const placed = st.placed;
    tree(g, tx, ty, ts, {
      t, lit: (st.lit == null ? 0.85 : st.lit) * light, burst: (st.burst || 0) * light, dark: 1 - light,
      star: placed ? 1 : 0, seed: 810,
    });
    // 你
    if (st.person) {
      const ps = 1.25;
      const px = X + w * 0.3, py = Y + h + 150 * ps;
      const reach = st.reach || 0;
      const chest = [px + 64 * ps, py - 232 * ps];
      const top = [tx - 10, ty - 520 * ts + 14];
      const arc = Math.sin(reach * Math.PI) * 30;
      const hand = placed ? [lerp(top[0], chest[0], 0.7), lerp(top[1], chest[1], 0.7)] : [lerp(chest[0], top[0], reach) - arc * 0.3, lerp(chest[1], top[1], reach) - arc];
      you(g, px, py, ps, { hand, star: !placed, tiptoe: st.tiptoe || 0, seed: 830 });
    }
    // 窗帘（束在两边）
    const cw = w * 0.15;
    const sway = Math.sin(t * 1.3) * 3;
    g.path([[X - 4, Y - 4], [X + cw, Y - 4], [X + cw * 0.55 + sway, Y + h * 0.45], [X + cw * 0.3, Y + h * 0.58], [X + cw * 0.8, Y + h + 4], [X - 4, Y + h + 4]], { closed: true, smooth: false, color: P.ink, width: 3.5, fill: mix('#3b3046', CURTAIN, 0.3 + 0.7 * light), seed: 840 });
    g.path([[X + w + 4, Y - 4], [X + w - cw, Y - 4], [X + w - cw * 0.55 + sway, Y + h * 0.45], [X + w - cw * 0.3, Y + h * 0.58], [X + w - cw * 0.8, Y + h + 4], [X + w + 4, Y + h + 4]], { closed: true, smooth: false, color: P.ink, width: 3.5, fill: mix('#3b3046', CURTAIN, 0.3 + 0.7 * light), seed: 841 });
    g.line(X + cw * 0.15, Y + h * 0.53, X + cw * 0.62, Y + h * 0.5, { color: CURTAIN_D, width: 7, seed: 842 });
    g.line(X + w - cw * 0.15, Y + h * 0.53, X + w - cw * 0.62, Y + h * 0.5, { color: CURTAIN_D, width: 7, seed: 843 });
    // 玻璃反光
    ctx.save();
    ctx.globalAlpha *= 0.1 + 0.06 * (1 - light);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(X + w * 0.05, Y + h);
    ctx.lineTo(X + w * 0.32, Y);
    ctx.lineTo(X + w * 0.4, Y);
    ctx.lineTo(X + w * 0.13, Y + h);
    ctx.moveTo(X + w * 0.6, Y + h);
    ctx.lineTo(X + w * 0.84, Y);
    ctx.lineTo(X + w * 0.87, Y);
    ctx.lineTo(X + w * 0.63, Y + h);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    // 雾 + 小画（只在左边那块玻璃上）
    let beads = [];
    if (st.fog > 0) {
      beads = fogGlass(g, X, Y, w, h, {
        k: st.fog, pr: st.pr || 0, cx: w * 0.24, cy: h * 0.64, u: 0.3, fw: 9, res: 1,
        color: st.fogColor, alpha: st.fogAlpha, dots: 60, blobs: 3,
      });
    }
    beads.forEach(([x, y], i) => bead(g, x, y, 2.6, 0.8));
    // 窗框
    const fw = 22;
    ctx.save();
    ctx.fillStyle = P.wood;
    ctx.beginPath();
    ctx.rect(X - fw, Y - fw, w + fw * 2, h + fw * 2);
    ctx.rect(X + w, Y, -w, h);
    ctx.fill('evenodd');
    ctx.fillStyle = mix(P.woodDark, '#1d1830', 0.3);
    ctx.fillRect(X - fw, Y + h, w + fw * 2, fw);
    ctx.restore();
    g.rect(X, Y, w, h, { color: P.ink, width: 4.5, seed: 850 });
    g.rect(X - fw, Y - fw, w + fw * 2, h + fw * 2, { color: P.ink, width: 5, seed: 851 });
    // 中梃 + 横档
    const ty2 = Y + h * 0.3;
    g.poly([[X + w / 2 - 8, Y], [X + w / 2 + 8, Y], [X + w / 2 + 8, Y + h], [X + w / 2 - 8, Y + h]], { color: P.ink, width: 3.5, fill: P.wood, seed: 852 });
    g.poly([[X, ty2 - 6], [X + w, ty2 - 6], [X + w, ty2 + 6], [X, ty2 + 6]], { color: P.ink, width: 3.5, fill: P.wood, seed: 853 });
    // 四角的霜（只在玻璃上）
    ctx.save();
    ctx.beginPath();
    ctx.rect(X, Y, w, h);
    ctx.clip();
    frost(g, X + 4, Y + 4, 1, 1, 40, 860, 0.5);
    frost(g, X + w - 4, Y + 4, -1, 1, 34, 864, 0.5);
    frost(g, X + 4, Y + h - 4, 1, -1, 46, 868, 0.5);
    frost(g, X + w - 4, Y + h - 4, -1, -1, 38, 872, 0.5);
    ctx.restore();
    // 窗台 + 积雪 + 冰柱
    const sy = Y + h + fw;
    g.poly([[X - fw - 26, sy], [X + w + fw + 26, sy], [X + w + fw + 20, sy + 20], [X - fw - 20, sy + 20]], { color: P.ink, width: 4, fill: P.woodDark, seed: 875 });
    g.path([[X - fw - 30, sy + 2], [X - fw - 14, sy - 20], [X + w * 0.25, sy - 30], [X + w * 0.6, sy - 24], [X + w + fw + 12, sy - 22], [X + w + fw + 30, sy + 2]], { smooth: true, closed: true, color: P.ink, width: 4, fill: SNOW_N, seed: 876 });
    for (let i = 0; i < 7; i++) {
      const ix = X - fw + 14 + i * ((w + fw * 2 - 28) / 6) + (rand(i, 3, 1) - 0.5) * 24;
      const il = 14 + rand(i, 3, 2) * 34;
      g.poly([[ix - 6, sy + 20], [ix + 1, sy + 20 + il], [ix + 6, sy + 20]], { color: INK_N, width: 2, fill: '#dbe5f7', seed: 880 + i });
    }
  }

  /** 玻璃角上的霜花 */
  function frost(g, x, y, dx, dy, r, seed, a = 1) {
    const ctx = g.ctx;
    ctx.save();
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r * 1.3);
    gr.addColorStop(0, `rgba(235,242,255,${0.55 * a})`);
    gr.addColorStop(1, 'rgba(235,242,255,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x - r * 1.3, y - r * 1.3, r * 2.6, r * 2.6);
    ctx.restore();
    // 几根冰晶（直接用 ctx 画，细线不需要手抖）
    ctx.save();
    ctx.strokeStyle = rgba('#f0f6ff', 0.7 * Math.min(1, a + 0.3));
    ctx.lineWidth = Math.max(1.2, r * 0.03);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const an = Math.atan2(dy, dx) + (i - 1) * 0.5;
      const L = r * (0.7 + 0.4 * rand(i, seed, 1));
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(an) * L, y + Math.sin(an) * L);
      const mx = x + Math.cos(an) * L * 0.55, my = y + Math.sin(an) * L * 0.55;
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.cos(an + 0.7) * L * 0.3, my + Math.sin(an + 0.7) * L * 0.3);
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.cos(an - 0.7) * L * 0.25, my + Math.sin(an - 0.7) * L * 0.25);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ 远景世界：墙 + 窗 + 门 + 雪地 + 雪人
  /**
   * st = {t, light, eave, reach, tiptoe, placed, burst, person, fog, pr, sm: {look, lookUp, mood, arms, blush, eyesClosed} | null}
   */
  function world(g, st) {
    const ctx = g.ctx;
    const t = st.t, L = st.light;
    // 夜空（墙左边那一块）
    ctx.save();
    ctx.fillStyle = vgrad(g, 0, GROUND_Y, P.nightDeep, '#34416f');
    ctx.fillRect(-200, -200, WALL_X + 260, GROUND_Y + 260);
    ctx.restore();
    stars(g, t, 34, 0, WALL_X - 20, 600, 41);
    C.moon(g, 548, 318, 36, { phase: 0.55, seed: 3 });
    // 远山 + 远处雪原
    g.path([[-200, 900], [-200, 640], [60, 610], [260, 640], [420, 600], [700, 640], [700, 900]], { closed: true, smooth: true, color: rgba(INK_N, 0.5), width: 2.5, fill: vgrad(g, 600, 760, '#3d4a7c', '#2f3a68'), seed: 501 });
    g.path([[-200, 900], [-200, 712], [200, 700], [500, 708], [700, 700], [700, 900]], { closed: true, smooth: true, color: rgba(INK_N, 0.45), width: 2.5, fill: vgrad(g, 700, 860, '#8e9cc6', '#c3cde8'), seed: 502 });
    pine(g, 64, 722, 0.95, 510);
    pine(g, 196, 712, 0.6, 512);
    pine(g, 586, 714, 0.75, 514);

    // 墙
    ctx.save();
    ctx.fillStyle = vgrad(g, WALL_TOP, GROUND_Y, '#2b3361', '#20264c');
    ctx.fillRect(WALL_X, WALL_TOP - 40, 1500, GROUND_Y - WALL_TOP + 80);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(8,10,26,0.38)';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 13; i++) {
      const y = WALL_TOP + 44 + i * 56;
      ctx.moveTo(WALL_X + 26, y);
      for (let x = WALL_X + 186; x <= 2100; x += 160) ctx.lineTo(x, y + noise1(x / 260 + i * 3.1, 600) * 2.2 + (rand(g.info.boil, i, x) - 0.5) * 0.8);
    }
    ctx.stroke();
    ctx.restore();
    // 窗光照在墙上
    if (L > 0.01) {
      const gx = WX + WW / 2, gy = WY + WH / 2, R = 640;
      const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, R);
      gr.addColorStop(0, rgba(P.glow, 0.62 * L));
      gr.addColorStop(0.35, rgba(P.warm, 0.42 * L));
      gr.addColorStop(0.6, rgba(P.warm, 0.17 * L));
      gr.addColorStop(0.82, rgba(P.warm, 0.04 * L));
      gr.addColorStop(1, rgba(P.warm, 0));
      ctx.save();
      ctx.fillStyle = gr;
      ctx.fillRect(Math.max(WALL_X, gx - R), gy - R, gx + R - Math.max(WALL_X, gx - R), R * 2);
      ctx.restore();
    }
    // 墙角
    g.poly([[WALL_X - 8, WALL_TOP], [WALL_X + 26, WALL_TOP], [WALL_X + 26, GROUND_Y + 10], [WALL_X - 8, GROUND_Y + 10]], { color: INK_N, width: 3.6, fill: '#1b2044', seed: 620 });
    // 屋檐：积雪、檐板、冰柱、彩灯
    g.poly([[WALL_X - 60, WALL_TOP - 36], [2100, WALL_TOP - 36], [2100, WALL_TOP + 8], [WALL_X - 60, WALL_TOP + 8]], { color: INK_N, width: 4, fill: '#181c3a', seed: 630 });
    const roof = [[WALL_X - 90, WALL_TOP - 30]];
    for (let x = WALL_X - 60; x <= 2100; x += 140) roof.push([x, WALL_TOP - 52 - noise1(x / 200, 9) * 14]);
    roof.push([2100, -200], [WALL_X - 40, -200], [WALL_X - 70, WALL_TOP - 70]);
    g.path(roof, { closed: true, smooth: true, color: INK_N, width: 4, fill: SNOW_N, seed: 631 });
    g.path([[WALL_X - 40, WALL_TOP - 44], [WALL_X + 200, WALL_TOP - 50], [WALL_X + 520, WALL_TOP - 47]], { color: rgba(P.snowShade, 0.9), width: 5, seed: 632 });
    for (let i = 0; i < 14; i++) {
      const ix = WALL_X - 40 + i * 104 + (rand(i, 5, 1) - 0.5) * 40;
      const il = 18 + rand(i, 5, 2) * 58;
      g.poly([[ix - 7, WALL_TOP + 8], [ix + 1, WALL_TOP + 8 + il], [ix + 8, WALL_TOP + 8]], { color: INK_N, width: 2, fill: '#dbe5f7', seed: 640 + i });
    }
    const hooks = [];
    for (let x = WALL_X - 30; x <= 2080; x += 170) hooks.push(x);
    for (let i = 0; i < hooks.length - 1; i++) {
      const a = hooks[i], b = hooks[i + 1], hy = WALL_TOP + 4;
      const sag = 26 + Math.sin(t * 1.4 + i) * 2;
      g.curve([[a, hy], [(a + b) / 2, hy + sag], [b, hy]], { color: 'rgba(20,18,30,0.8)', width: 2.2, seed: 660 + i });
      for (let j = 1; j <= 3; j++) {
        const u = j / 4;
        const bx = lerp(a, b, u), by = hy + sag * 4 * u * (1 - u) * 1.02 + 8;
        const idx = i * 3 + j;
        const on = st.eave * clamp(0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 3.2 + idx * 2.1)) + 0.3 * (g.info.pulse || 0));
        bulb(g, bx, by, 6.5, BULB[idx % BULB.length], on);
      }
    }
    // 窗
    windowWorld(g, st);
    // 门（下一幕的主角）
    C.door(g, 1720, 386, 220, GROUND_Y - 392, { wreath: true, seed: 700 });

    // 雪地
    C.ground(g, GROUND_Y, { color: vgrad(g, GROUND_Y - 20, 1100, '#e3e9f7', '#a9b5d9'), line: rgba(INK_N, 0.55), amp: 10, seed: 13, width: 3.5 });
    // 窗光洒在雪上（中间是窗棂的影子）
    if (L > 0.01) {
      // 窗户的形状投在雪上：四块光，中间留出窗棂的影子
      const y0 = GROUND_Y + 16, y1 = GROUND_Y + 200;
      const at = (u, v) => [lerp(lerp(WX - 20, WX + WW + 20, u), lerp(WX - 200, WX + WW + 200, u), v), lerp(y0, y1, v)];
      ctx.save();
      ctx.globalAlpha *= L;
      ctx.save();
      ctx.translate(WX + WW / 2, (y0 + y1) / 2);
      ctx.scale(1, 0.32);
      softGlow(g, 0, 0, 640, P.warm, 0.4);
      ctx.restore();
      ctx.fillStyle = vgrad(g, y0, y1, 'rgba(255,222,160,0.75)', 'rgba(255,214,140,0.3)');
      ctx.beginPath();
      for (const [u0, u1] of [[0, 0.48], [0.52, 1]]) {
        for (const [v0, v1] of [[0, 0.66], [0.72, 1]]) {
          const a = at(u0, v0), b = at(u1, v0), c = at(u1, v1), d = at(u0, v1);
          ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
        }
      }
      ctx.fill();
      ctx.restore();
    }
    // 雪人（站在暗处）
    if (st.sm) {
      const sm = st.sm;
      const bob = Math.sin(t * 1.8) * 1.5;
      C.snowman(g, SMX, SMY + bob, SMS, Object.assign({ outline: INK_N, seed: 5, wind: 0.15, snowCap: 0.6 }, sm));
      // 呼出的白气（朝窗户那边飘）
      const r = 80 * SMS, hy = SMY + bob - 288.4 * SMS;
      C.breath(g, SMX + (sm.look || 0) * r * 0.28 + 12 * SMS, hy - r * 0.12 - (sm.lookUp || 0) * r * 0.25 + 44 * SMS, t * 0.9, { dir: 1, s: 0.5, seed: 77 });
      // 暗处：雪人整体压一层冷蓝（multiply，白色变蓝灰，深色几乎不变）
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      const gr = ctx.createRadialGradient(SMX - 40, SMY - 200, 40, SMX - 40, SMY - 200, 360);
      gr.addColorStop(0, mix('#7d8ec6', '#ffffff', sm.lit || 0));
      gr.addColorStop(0.6, mix('#94a3d6', '#ffffff', 0.2 + 0.8 * (sm.lit || 0)));
      gr.addColorStop(1, '#ffffff');
      ctx.fillStyle = gr;
      ctx.fillRect(SMX - 420, SMY - 560, 760, 640);
      ctx.restore();
      // 脸朝窗的那一侧有一点点暖光
      softGlow(g, SMX + 70, SMY - 250, 110, P.warm, 0.18 * L);
    }
  }

  /** 世界里雪人头部（脸）的位置，用来摆字/冒烟 */
  function headPos(x, y, s) {
    return [x, y - 288.4 * s, 80 * s];
  }

  // ------------------------------------------------------------------ 镜头 1：远景
  function shotWide(g, q, t, info) {
    const ctx = g.ctx;
    const z = lerp(1.0, 1.05, ease.inOut(q));
    g.save();
    g.camera(lerp(960, 1000, ease.inOut(q)), lerp(540, 520, ease.inOut(q)), z);
    const reach = 0.12 + 0.08 * Math.sin(t * 1.6);
    world(g, {
      t, light: 1, eave: 1, reach, tiptoe: 0, placed: false, person: true, fog: 0, lit: 0.8,
      sm: { look: 0.85, lookUp: 0.42, mood: 'calm', blush: 0.45, eyesClosed: q > 0.62 && q < 0.68, lit: 0 },
    });
    g.restore();
    g.snow({ count: 150, wind: 22, sway: 22, speed: [40, 90], size: [2, 7], seed: 31 });
    g.snow({ count: 10, wind: 30, sway: 40, speed: [50, 90], size: [16, 26], crystal: 999, alpha: 0.22, seed: 32 });
    // 手写日期
    const a = seg(q, 0.12, 0.42), b = seg(q, 0.38, 0.66);
    g.text('12.24', 96, 168, { size: 112, font: 'latin', align: 'left', color: '#fff4dc', progress: a, seed: 11, stroke: 'rgba(18,23,41,0.55)', strokeWidth: 10 });
    g.text('平安夜', 104, 268, { size: 60, align: 'left', color: rgba(P.warm, 0.95), progress: b, seed: 12, spacing: 6 });
    if (b > 0.9) g.line(100, 312, lerp(100, 300, ease.out(seg(q, 0.62, 0.8))), 318, { color: rgba(P.warm, 0.8), width: 3.5, seed: 13 });
    // 接上一幕：整屏的暖光慢慢退掉
    const wash = 1 - ease.out(seg(q, 0, 0.22));
    if (wash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(P.warm, 0.28 * wash);
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      softGlow(g, (WX + WW / 2 - 1000) * z + 960, (WY + WH / 2 - 520) * z + 540, 900, P.glow, 0.5 * wash);
    }
    vignette(g, 0.42);
  }

  // ------------------------------------------------------------------ 镜头 2：推近窗户
  function shotPush(g, q, t, info) {
    const z = lerp(1.72, 1.92, ease.inOut(q));
    const sh = g.shake(1.2);
    g.save();
    g.camera(WX + WW / 2 + 10, WY + WH / 2 + 30, z, 0, sh[0], sh[1]);
    const reach = ease.inOut(seg(q, 0.08, 0.9));
    world(g, {
      t, light: 1, eave: 1, reach, tiptoe: ease.inOut(seg(q, 0.15, 0.55)), placed: false, person: true, fog: 0, lit: 0.95,
      sm: null,
    });
    g.restore();
    g.snow({ count: 110, wind: 22, sway: 22, speed: [50, 110], size: [3, 10], seed: 33 });
    g.snow({ count: 8, wind: 30, sway: 40, speed: [60, 100], size: [22, 34], crystal: 999, alpha: 0.2, seed: 34 });
    // 嘿咻～
    const k = seg(q, 0.3, 0.6);
    if (k > 0) {
      const fade = 1 - seg(q, 0.88, 1);
      g.text('嘿咻～', 380, 250, { size: 84, color: '#fff4dc', progress: k, seed: 21, rot: -0.12, alpha: fade, stroke: 'rgba(18,23,41,0.55)', strokeWidth: 10 });
    }
    vignette(g, 0.4);
  }

  /** "你"的手：大衣袖子 + 红手套。(wx,wy) 手腕，rot 0 = 指尖朝上，袖子往 +y（画面外）延伸 */
  function mittenArm(g, wx, wy, ms, rot, seed) {
    const ctx = g.ctx;
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(rot);
    ctx.scale(ms, ms);
    g.path([[-50, 26], [50, 26], [74, 1400], [-76, 1400]], { closed: true, color: P.ink, width: 4.5, fill: COAT, seed });
    g.fill([[-46, 30], [-14, 30], [-22, 1400], [-72, 1400]], rgba(P.ink, 0.28), { seed: seed + 1 });
    g.line(44, 70, 68, 900, { color: P.glow, width: 4, alpha: 0.45, seed: seed + 2 });
    g.curve([[-40, 150], [-6, 162], [32, 146]], { color: rgba(P.ink, 0.7), width: 3.5, seed: seed + 3 });
    ctx.restore();
    C.mitten(g, wx, wy, ms, rot, { seed: seed + 5 });
  }

  // ------------------------------------------------------------------ 镜头 3：星星放上树顶
  function shotStar(g, q, t, info) {
    const ctx = g.ctx;
    const place = 0.5;
    const placed = q >= place;
    const k = seg(q, place, 1);
    const sh = placed ? g.shake(7 * (1 - seg(q, place, place + 0.12))) : [0, 0];
    g.save();
    g.camera(960, 540, lerp(1.0, 1.05, q), 0, sh[0], sh[1]);
    // 房间的墙
    const brighten = placed ? 1 : 0;
    g.bg([mix('#f0b562', '#ffd08a', brighten * 0.4), mix('#dd8a45', '#eea158', brighten * 0.4)]);
    ctx.save();
    ctx.fillStyle = 'rgba(255,243,214,0.14)';
    for (let i = 0; i < 12; i++) ctx.fillRect(i * 170 + 40, -40, 30, H + 80);
    ctx.restore();
    // 远处的灯（虚化成光斑）
    for (let i = 0; i < 16; i++) {
      const bx = rand(i, 61, 1) * W, by = rand(i, 61, 2) * H * 0.85;
      const br = 26 + rand(i, 61, 3) * 50;
      const tw = 0.55 + 0.45 * Math.sin(t * (1.5 + rand(i, 61, 4) * 2) + i);
      softGlow(g, bx, by, br, BULB[i % BULB.length], 0.45 * tw + 0.25 * brighten * (1 - k), 3);
    }
    // 树顶
    const AX = 1000, AY = 470;
    g.poly([[AX - 760, 1350], [AX, AY + 300], [AX + 760, 1350]], { color: P.ink, width: 6, fill: '#355f4c', seed: 901 });
    g.poly([[AX - 470, 1180], [AX, AY], [AX + 470, 1180]], { color: P.ink, width: 6, fill: P.greenDeep, seed: 902 });
    g.fill([[AX + 16, AY + 80], [AX + 400, 1160], [AX + 40, 1160]], '#2c5242', { seed: 903, alpha: 0.75 });
    // 灯串 + 灯泡：星星一放上去就从上往下一路亮下来
    const swags = [[[AX - 170, AY + 260], [AX + 30, AY + 380], [AX + 250, AY + 300]], [[AX - 330, AY + 560], [AX, AY + 690], [AX + 380, AY + 560]]];
    let idx = 0;
    swags.forEach((sw, si) => {
      g.curve(sw, { color: 'rgba(250,240,210,0.85)', width: 3.5, seed: 910 + si });
      const Q = [2 * sw[1][0] - (sw[0][0] + sw[2][0]) / 2, 2 * sw[1][1] - (sw[0][1] + sw[2][1]) / 2];
      const n = si ? 7 : 5;
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n;
        const bx = (1 - u) * (1 - u) * sw[0][0] + 2 * u * (1 - u) * Q[0] + u * u * sw[2][0];
        const by = (1 - u) * (1 - u) * sw[0][1] + 2 * u * (1 - u) * Q[1] + u * u * sw[2][1];
        const j = idx++;
        const chase = 0.5 + 0.5 * Math.sin(t * 5 - j * 0.9);
        const casc = clamp((k - j * 0.025) * 8);
        const on = placed ? clamp(0.55 + 0.45 * chase + (1 - seg(q, place, place + 0.2)) * casc) * casc + (1 - casc) * 0.3 * chase : 0.3 * chase;
        bulb(g, bx, by + 14, 14, BULB[j % BULB.length], on);
      }
    });
    // 挂件
    g.circle(AX - 150, AY + 470, 34, { color: P.ink, width: 4, fill: P.sun, seed: 940 });
    g.line(AX - 160, AY + 450, AX - 152, AY + 460, { color: '#fff8dc', width: 4, seed: 941 });
    g.circle(AX + 200, AY + 430, 28, { color: P.ink, width: 4, fill: '#7fb0e8', seed: 942 });
    g.circle(AX + 60, AY + 180, 22, { color: P.ink, width: 3.5, fill: P.sun, seed: 943 });

    // 星星 + 手
    const R = 96;
    const top = [AX, AY - R * 0.62];
    const start = [330, 900];
    const approach = ease.inOutCubic(seg(q, 0, 0.42));
    const settle = ease.outBack(seg(q, 0.42, place));
    let sx = lerp(start[0], top[0], approach) + Math.sin(q * 30) * 6 * (1 - approach);
    let sy = lerp(start[1], top[1] - 40, approach) + 40 * settle;
    if (placed) { sx = top[0]; sy = top[1]; }
    const pop = placed ? lerp(1.3, 1, ease.outBack(seg(q, place, place + 0.1))) : 1;
    const rot = placed ? 0 : lerp(-0.5, 0, approach) + Math.sin(t * 4) * 0.04;
    if (placed) {
      softGlow(g, sx, sy, lerp(520, 260, ease.out(k)), P.glow, lerp(0.95, 0.5, ease.out(k)));
      burstRays(g, sx, sy, R * 1.3, R * 3.4, seg(q, place, place + 0.3), 14, 950, '#fff6d8', 7);
    } else softGlow(g, sx, sy, 260, P.glow, 0.55);
    starShape(g, sx, sy, R * pop, { rot, seed: 960, width: 6 });
    // "你"的手（红手套），星星放好后缩回去
    const ret = ease.inCubic(seg(q, place + 0.06, 0.9));
    const MS = 1.15;
    const mrot = lerp(0.8, 0.42, approach) + (placed ? 0.1 * ease.out(seg(q, place, place + 0.1)) : 0);
    const dx = Math.sin(mrot), dy = -Math.cos(mrot);
    const grip = 138 * MS + (placed ? 30 * ease.out(seg(q, place, place + 0.1)) : 0);
    const wx = sx - dx * grip - dx * ret * 1100, wy = sy - dy * grip - dy * ret * 1100;
    if (ret < 1) mittenArm(g, wx, wy, MS, mrot, 970);
    g.restore();
    // 窗框的一角 + 玻璃反光（提醒我们在窗外）
    ctx.save();
    ctx.globalAlpha *= 0.09;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(1240, 0); ctx.lineTo(1420, 0); ctx.lineTo(920, H); ctx.lineTo(740, H);
    ctx.moveTo(1540, 0); ctx.lineTo(1590, 0); ctx.lineTo(1090, H); ctx.lineTo(1040, H);
    ctx.fill();
    ctx.restore();
    g.poly([[-20, -20], [W + 20, -20], [W + 20, 44], [-20, 52]], { color: P.ink, width: 5, fill: P.wood, seed: 980 });
    g.poly([[-20, -20], [70, -20], [62, H + 20], [-20, H + 20]], { color: P.ink, width: 5, fill: P.wood, seed: 981 });
    frost(g, 74, 56, 1, 1, 110, 982);
    frost(g, W - 10, 52, -1, 1, 90, 986);
    g.snow({ count: 70, wind: 22, sway: 22, speed: [60, 120], size: [4, 12], seed: 35 });
    vignette(g, 0.3, '#4a2410');
    // 放上去那一下的闪白
    const flash = placed ? 1 - seg(q, place, place + 0.08) : 0;
    if (flash > 0) {
      ctx.save();
      ctx.fillStyle = rgba('#fffaf0', 0.55 * flash);
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    // 叮！
    const tk = seg(q, place + 0.01, place + 0.1);
    if (tk > 0) {
      const fade = 1 - seg(q, 0.92, 1);
      g.text('叮！', 1450, 260, { size: 170, color: '#fffaf0', progress: tk, seed: 31, rot: 0.1, alpha: fade, stroke: P.ink, strokeWidth: 16, shadow: { color: P.warmDeep, dx: 7, dy: 7 } });
    }
  }

  // ------------------------------------------------------------------ 镜头 4：玻璃起雾，手指画画
  // 屏幕上的玻璃（左下那块）
  const FG = { x: 112, y: 132, w: 1378, h: 742 };
  const DCX = 540, DCY = 330, DU = 1.1; // 小画中心（相对玻璃）和缩放
  // 树上的灯（虚化），隔着雾也能看到一团团彩色的光
  const BOKEH = Array.from({ length: 12 }, (_, i) => [1540 + rand(i, 66, 1) * 440, 180 + rand(i, 66, 2) * 700, BULB[i % BULB.length]]);

  /** 雾后面糊掉的屋子：墙纸、树上的灯、"你"的影子。画在 1/8 大小的临时画布上，放大回来就是景深 */
  let roomBuf = null;
  function blurredRoom(g, t, cam, o) {
    const RW = 240, RH = 135;
    if (!roomBuf) { roomBuf = document.createElement('canvas'); roomBuf.width = RW; roomBuf.height = RH; }
    const b = roomBuf.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalAlpha = 1;
    b.clearRect(0, 0, RW, RH);
    b.scale(RW / W, RH / H);
    const [cx, cy, z, rot] = cam;
    b.translate(W / 2, H / 2); b.rotate(rot); b.scale(z, z); b.translate(-cx, -cy);
    const lg = b.createLinearGradient(0, 0, 0, H);
    lg.addColorStop(0, '#eba650'); lg.addColorStop(1, '#c96c34');
    b.fillStyle = lg;
    b.fillRect(-300, -300, W + 600, H + 600);
    b.fillStyle = 'rgba(255,243,214,0.18)';
    for (let i = 0; i < 12; i++) b.fillRect(i * 170 + 40, -60, 34, H + 120);
    const rg = b.createRadialGradient(300, 160, 0, 300, 160, 700);
    rg.addColorStop(0, 'rgba(255,241,204,0.7)'); rg.addColorStop(0.5, 'rgba(255,241,204,0.25)'); rg.addColorStop(1, 'rgba(255,241,204,0)');
    b.fillStyle = rg;
    b.fillRect(-400, -540, 1400, 1400);
    // 树
    b.fillStyle = '#2f5d4a';
    b.beginPath(); b.moveTo(1440, 1200); b.lineTo(1760, 80); b.lineTo(2120, 1200); b.closePath(); b.fill();
    BOKEH.forEach(([bx, by, c], i) => {
      const on = 0.6 + 0.4 * Math.sin(t * 4 - i * 1.1);
      const gg = b.createRadialGradient(bx, by, 0, bx, by, 80);
      gg.addColorStop(0, '#ffffff'); gg.addColorStop(0.25, rgba(c, 0.95)); gg.addColorStop(1, rgba(c, 0));
      b.globalAlpha = on;
      b.fillStyle = gg;
      b.fillRect(bx - 80, by - 80, 160, 160);
    });
    // 你
    b.globalAlpha = o.bodyA;
    if (o.bodyA > 0.01) {
      const X = o.bodyX;
      b.fillStyle = YOU;
      b.strokeStyle = YOU;
      b.beginPath();
      b.moveTo(X - 330, 1200);
      b.quadraticCurveTo(X - 320, 560, X - 120, 520);
      b.lineTo(X + 150, 520);
      b.quadraticCurveTo(X + 350, 560, X + 360, 1200);
      b.closePath();
      b.fill();
      b.beginPath(); b.arc(X + 10, 330, 150, 0, Math.PI * 2); b.fill();
      if (o.drawing) {
        const shX = X - 230, shY = 640;
        b.lineCap = 'round';
        b.lineWidth = 110;
        b.beginPath();
        b.moveTo(shX, shY);
        b.quadraticCurveTo(lerp(shX, o.fx, 0.5) + 40, lerp(shY, o.fy, 0.5) + 160, o.fx + 30, o.fy + 60);
        b.stroke();
        b.beginPath(); b.arc(o.fx + 20, o.fy + 40, 58, 0, Math.PI * 2); b.fill();
      }
    }
    b.globalAlpha = 1;
    const ctx = g.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';
    ctx.drawImage(roomBuf, 0, 0, W, H);
    ctx.restore();
  }

  function shotFog(g, q, t, info) {
    const ctx = g.ctx;
    const fogK = ease.inOut(seg(q, 0, 0.24));
    const pr = lerp(0, 1, ease.sine(seg(q, 0.22, 0.82))) + 0.6 * seg(q, 0.82, 1);
    const z = lerp(1.0, 1.06, ease.inOut(q));
    const cx = lerp(960, 930, ease.inOut(q)), cy = 520, rot = lerp(-0.012, 0.006, ease.inOut(q));
    // 1) 屋里：直接画在一块小画布上再放大（糊，而且便宜）
    const come = ease.inOut(seg(q, 0.04, 0.28));
    const leave = ease.inOut(seg(q, 0.88, 1));
    const bodyX = lerp(1560, 1130, come) + leave * 140;
    const head = doodleHead(Math.min(pr, 1));
    const fx = FG.x + DCX + head[0] * DU, fy = FG.y + DCY + head[1] * DU;
    const drawing = pr > 0.001 && pr < 1;
    blurredRoom(g, t, [cx, cy, z, rot], { bodyX, bodyA: 0.85 * come * (1 - leave * 0.5), drawing, fx, fy });
    g.save();
    g.camera(cx, cy, z, rot);
    // 指尖贴在玻璃上（比身子清楚一点）
    if (drawing) {
      ctx.save();
      ctx.translate(fx + 6, fy + 12);
      ctx.rotate(-0.5);
      ctx.scale(0.75, 1);
      softGlow(g, 0, 0, 40, '#4a302e', 0.6, 3);
      ctx.restore();
    }
    // 2) 雾 + 小画
    const beads = fogGlass(g, FG.x, FG.y, FG.w, FG.h, { k: fogK, pr, cx: DCX, cy: DCY, u: DU, fw: 26, res: 0.36, alpha: 0.8, trails: 9, dots: 110, blobs: 5 });
    beads.forEach(([x, y]) => bead(g, x, y, 7));
    // 右边那块玻璃 + 上面的小玻璃：也起雾（不画画）
    ctx.save();
    ctx.fillStyle = rgba('#f7efe6', 0.74 * fogK);
    ctx.fillRect(FG.x + FG.w + 70, FG.y - 20, 600, FG.h + 40);
    ctx.fillRect(FG.x - 20, -200, FG.w + 760, FG.y - 40 + 200);
    ctx.restore();
    // 隔着雾透出来的灯光
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    BOKEH.forEach(([bx, by, c], i) => {
      const on = 0.6 + 0.4 * Math.sin(t * 4 - i * 1.1);
      softGlow(g, bx, by, 120, c, 0.35 * on * fogK, 3);
    });
    softGlow(g, 300, 160, 520, '#fff6e0', 0.25 * fogK, 4);
    ctx.restore();
    // 玻璃的反光
    ctx.save();
    ctx.globalAlpha *= 0.1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(FG.x + 260, FG.y + FG.h); ctx.lineTo(FG.x + 560, FG.y); ctx.lineTo(FG.x + 700, FG.y); ctx.lineTo(FG.x + 400, FG.y + FG.h);
    ctx.moveTo(FG.x + 520, FG.y + FG.h); ctx.lineTo(FG.x + 820, FG.y); ctx.lineTo(FG.x + 860, FG.y); ctx.lineTo(FG.x + 560, FG.y + FG.h);
    ctx.fill();
    ctx.restore();
    // 3) 窗框
    const fw = 70;
    g.poly([[FG.x + FG.w, -100], [FG.x + FG.w + fw, -100], [FG.x + FG.w + fw, FG.y + FG.h + 40], [FG.x + FG.w, FG.y + FG.h + 40]], { color: P.ink, width: 6, fill: P.wood, seed: 1020 });
    g.poly([[FG.x - 200, FG.y - 44], [W + 300, FG.y - 44], [W + 300, FG.y], [FG.x - 200, FG.y]], { color: P.ink, width: 6, fill: P.wood, seed: 1021 });
    g.poly([[-200, -200], [FG.x, -200], [FG.x, FG.y + FG.h + 40], [-200, FG.y + FG.h + 40]], { color: P.ink, width: 6, fill: P.wood, seed: 1022 });
    g.line(FG.x - 40, -100, FG.x - 40, FG.y + FG.h + 20, { color: rgba(P.woodDark, 0.8), width: 4, seed: 1023 });
    // 窗台 + 积雪
    const sy = FG.y + FG.h;
    g.poly([[-200, sy], [W + 200, sy], [W + 200, sy + 50], [-200, sy + 50]], { color: P.ink, width: 6, fill: P.woodDark, seed: 1024 });
    ctx.save();
    ctx.fillStyle = '#20264c';
    ctx.fillRect(-200, sy + 50, W + 400, 400);
    ctx.restore();
    g.path([[-220, sy + 10], [-100, sy - 34], [300, sy - 50], [700, sy - 40], [1100, sy - 54], [1500, sy - 42], [2200, sy - 36], [2220, sy + 10]], { smooth: true, closed: true, color: P.ink, width: 5, fill: SNOW_N, seed: 1025 });
    g.path([[100, sy - 34], [500, sy - 46], [900, sy - 38]], { color: rgba(P.snowShade, 0.9), width: 7, seed: 1026 });
    for (let i = 0; i < 8; i++) {
      const ix = 80 + i * 250 + (rand(i, 9, 1) - 0.5) * 60, il = 40 + rand(i, 9, 2) * 90;
      g.poly([[ix - 13, sy + 50], [ix + 2, sy + 50 + il], [ix + 14, sy + 50]], { color: INK_N, width: 3, fill: '#dbe5f7', seed: 1027 + i });
    }
    // 玻璃角上的霜
    ctx.save();
    ctx.beginPath();
    ctx.rect(FG.x, FG.y, FG.w, FG.h);
    ctx.clip();
    frost(g, FG.x + 4, FG.y + 4, 1, 1, 150, 1040, 0.8);
    frost(g, FG.x + FG.w - 4, FG.y + 4, -1, 1, 120, 1044, 0.8);
    frost(g, FG.x + 4, FG.y + FG.h - 50, 1, -1, 120, 1048, 0.8);
    ctx.restore();
    g.restore();
    // 窗外的雪
    g.snow({ count: 90, wind: 20, sway: 24, speed: [50, 110], size: [4, 12], seed: 36 });
    g.snow({ count: 8, wind: 20, sway: 40, speed: [60, 100], size: [26, 40], crystal: 999, alpha: 0.25, seed: 37 });
    vignette(g, 0.36, '#3a1c10');
  }

  // ------------------------------------------------------------------ 镜头 5：眼睛大特写（闪切）
  function shotEye(g, q, t, info) {
    const ctx = g.ctx;
    g.bg([P.nightDeep, P.night]);
    stars(g, t, 30, 0, W, H, 47);
    const S = 5.2;
    const z = lerp(1.0, 1.08, ease.out(q));
    const sh = g.shake(3 * (1 - q));
    g.save();
    g.camera(960, 470, z, 0, sh[0], sh[1]);
    const X = 960, Y = 560 + 288.4 * S;
    C.snowman(g, X, Y, S, { mood: 'hope', look: 0, lookUp: 0.2, blush: lerp(0.4, 1, ease.out(q)), outline: INK_N, seed: 5, hat: true });
    // 窗的暖光照在脸上
    softGlow(g, X, 470, 700, P.warm, 0.2);
    // 眼睛里映着那扇窗
    const r = 80 * S, ex = r * 0.32, ey = -r * 0.12 - 0.2 * r * 0.25;
    [-1, 1].forEach((side) => {
      const cx = X + side * ex + 10, cy = 560 + ey - 8;
      const ww = 30, hh = 26;
      softGlow(g, cx, cy, 34, P.warm, 0.7);
      ctx.save();
      ctx.fillStyle = P.warm;
      ctx.fillRect(cx - ww / 2, cy - hh / 2, ww, hh);
      ctx.fillStyle = INK_N;
      ctx.fillRect(cx - 1.5, cy - hh / 2, 3, hh);
      ctx.fillRect(cx - ww / 2, cy - hh * 0.2, ww, 3);
      ctx.restore();
    });
    // 脸红的小斜线
    blushLines(g, X, 560, S, 0, 0.2, ease.out(seg(q, 0.3, 0.8)), 1100);
    g.restore();
    g.snow({ count: 60, wind: 20, sway: 24, speed: [60, 120], size: [5, 14], seed: 38 });
    vignette(g, 0.5);
    const ek = seg(q, 0.08, 0.3);
    if (ek > 0) g.text('！', 1560, 260, { size: 230, color: '#fff4dc', progress: ek, seed: 61, rot: 0.18, stroke: INK_N, strokeWidth: 16 });
  }

  /** 眼睛里映着的小暖窗 */
  function eyeWindows(g, hx, hy, s, look, lookUp, k) {
    const ctx = g.ctx;
    const r = 80 * s;
    const fx = look * r * 0.28, fy = -lookUp * r * 0.25;
    const ex = r * 0.32, ey = -r * 0.12 + fy;
    ctx.save();
    ctx.globalAlpha *= k;
    [-1, 1].forEach((side) => {
      const cx = hx + fx + side * ex - 2.6 * s, cy = hy + ey + 2.4 * s;
      const w = 4.6 * s, h = 4 * s;
      ctx.fillStyle = P.warm;
      ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
      ctx.fillStyle = INK_N;
      ctx.fillRect(cx - 0.3 * s, cy - h / 2, 0.6 * s, h);
      ctx.fillRect(cx - w / 2, cy - 0.5 * s, w, 0.6 * s);
    });
    ctx.restore();
  }

  /** 一小朵冒出来的云（害羞的"噗"） */
  function puff(g, x, y, r, seed) {
    const ctx = g.ctx;
    const bumps = [[-0.55, 0.15, 0.62], [0, -0.2, 0.78], [0.55, 0.12, 0.6], [0.05, 0.3, 0.6]];
    const wob = (rand(g.info.boil, seed, 1) - 0.5) * r * 0.06;
    ctx.save();
    ctx.fillStyle = '#b9c6e6';
    ctx.beginPath();
    for (const [bx, by, br] of bumps) { ctx.moveTo(x + bx * r + br * r + 3, y + by * r); ctx.arc(x + bx * r, y + by * r, br * r + 3 + wob, 0, Math.PI * 2); }
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (const [bx, by, br] of bumps) { ctx.moveTo(x + bx * r + br * r, y + by * r); ctx.arc(x + bx * r, y + by * r, br * r, 0, Math.PI * 2); }
    ctx.fill();
    ctx.restore();
  }

  /** 脸红时脸颊上的 "///" */
  function blushLines(g, hx, hy, s, look, lookUp, k, seed) {
    if (k <= 0) return;
    const r = 80 * s;
    const fx = look * r * 0.28, fy = -lookUp * r * 0.25;
    const ex = r * 0.32, ey = -r * 0.12 + fy;
    [-1, 1].forEach((side, j) => {
      // 右脸颊被胡萝卜挡着一点，斜线往外、往下挪开
      const cx = hx + fx + side * (ex + 8 * s) + (side > 0 ? 8 * s : 0), cy = hy + ey + 26 * s + (side > 0 ? 6 * s : 0);
      for (let i = 0; i < 3; i++) {
        const x = cx + (i - 1) * 8 * s;
        g.line(x + 3 * s, cy - 6 * s, x - 3 * s, cy + 6 * s, { color: '#e07a7a', width: 2.4 * s, progress: clamp(k * 3 - i * 0.5), seed: seed + j * 3 + i });
      }
    });
  }

  // ------------------------------------------------------------------ 镜头 6：反打，雪人挥手
  function shotReverse(g, q, t, info) {
    const ctx = g.ctx;
    const z = lerp(1.0, 1.06, ease.inOut(q));
    g.save();
    g.camera(lerp(940, 900, ease.inOut(q)), 540, z);
    // 天空 + 远处
    ctx.save();
    ctx.fillStyle = vgrad(g, -100, 760, P.nightDeep, '#3a4677');
    ctx.fillRect(-200, -200, W + 400, 980);
    ctx.restore();
    stars(g, t, 50, -100, W + 100, 560, 43);
    g.path([[-200, 900], [-200, 660], [300, 630], [700, 660], [1100, 620], [1500, 650], [2100, 630], [2100, 900]], { closed: true, smooth: true, color: rgba(INK_N, 0.5), width: 2.5, fill: vgrad(g, 620, 760, '#3d4a7c', '#2f3a68'), seed: 1201 });
    pine(g, 1320, 704, 0.6, 1210);
    pine(g, 1460, 700, 0.42, 1212);
    pine(g, 180, 706, 0.5, 1214);
    C.ground(g, 700, { color: vgrad(g, 700, 1100, '#b9c5e4', '#e6ecf8'), line: rgba(INK_N, 0.5), amp: 8, seed: 21, width: 3 });
    // 窗光铺在雪地上，雪人的影子往后拉长
    ctx.save();
    ctx.translate(800, 940);
    ctx.scale(1, 0.34);
    softGlow(g, 0, 0, 980, P.warm, 0.5, 5);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = 'rgba(44,58,102,0.3)';
    ctx.beginPath();
    ctx.ellipse(800, 806, 190, 46, 0.03, 0, Math.PI * 2);
    ctx.ellipse(814, 748, 104, 22, 0.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 雪人
    const X = 760, Y = 1140, S = 2.2;
    const shy = seg(q, 0.16, 0.4);
    const wave = ease.out(seg(q, 0.3, 0.46));
    const arms = [0.05, wave * 1.05 + Math.sin(t * 7.5) * 0.3 * wave];
    const mood = q < 0.18 ? 'hope' : 'happy';
    const blink = q > 0.15 && q < 0.19;
    const bob = Math.sin(t * 2.2) * 3;
    C.snowman(g, X, Y + bob, S, { mood, look: 0, lookUp: 0.15, arms, blush: lerp(0.7, 1, shy), eyesClosed: blink, outline: INK_N, seed: 5, wind: 0.2 });
    // 正面打来的暖光（multiply：雪变暖色）
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const gr = ctx.createRadialGradient(X + 60, 560, 60, X + 60, 560, 700);
    gr.addColorStop(0, '#ffe7c6');
    gr.addColorStop(0.6, '#fff1de');
    gr.addColorStop(1, '#ffffff');
    ctx.fillStyle = gr;
    ctx.fillRect(X - 700, -100, 1400, 1300);
    ctx.restore();
    softGlow(g, X + 120, 480, 380, P.warm, 0.16);
    const [hx, hy] = headPos(X, Y + bob, S);
    blushLines(g, hx, hy, S, 0, 0.15, shy, 1220);
    if (!blink) eyeWindows(g, hx, hy, S, 0, 0.15, 1);
    // 害羞得冒烟（帽子两边噗噗地冒出小云）
    const steam = seg(q, 0.2, 0.3) * (1 - seg(q, 0.86, 1));
    if (steam > 0) {
      for (let k = 0; k < 4; k++) {
        const ph = ((t * 0.8 + k / 4) % 1 + 1) % 1;
        const side = k % 2 ? 1 : -1;
        const sx = hx + side * (150 + ph * 70), sy = hy - 150 - ph * 170;
        ctx.save();
        ctx.globalAlpha *= steam * clamp((1 - ph) * 4) * clamp(ph * 8);
        puff(g, sx, sy, lerp(16, 38, ease.out(ph)) * (1 - 0.5 * ease.in(seg(ph, 0.7, 1))), 1230 + k);
        ctx.restore();
      }
    }
    // 小红心
    const hk = seg(q, 0.5, 0.62);
    if (hk > 0) {
      const fl = seg(q, 0.62, 1);
      ctx.save();
      ctx.globalAlpha *= 1 - ease.in(fl);
      C.heart(g, hx + 250 + Math.sin(t * 3) * 10, hy - 160 - fl * 120, 38 * ease.outBack(hk), { seed: 1240, rot: 0.15 });
      ctx.restore();
    }
    g.restore();
    g.snow({ count: 130, wind: 18, sway: 24, speed: [40, 90], size: [3, 9], seed: 39 });
    g.snow({ count: 10, wind: 20, sway: 40, speed: [60, 100], size: [20, 32], crystal: 999, alpha: 0.22, seed: 40 });
    // 给我的？
    const tk = seg(q, 0.08, 0.4);
    if (tk > 0) {
      g.text('给我的？', 1560, 150, { size: 104, vertical: true, color: '#fff4dc', progress: tk, seed: 41, stroke: 'rgba(18,23,41,0.6)', strokeWidth: 10 });
    }
    vignette(g, 0.42);
  }

  // ------------------------------------------------------------------ 镜头 7：灯灭了
  function shotOut(g, q, t, info) {
    const ctx = g.ctx;
    const OFF = 0.16;
    const light = q < OFF ? 1 : 0;
    const z = lerp(1.12, 1.15, ease.inOut(q));
    g.save();
    const camX = lerp(890, 870, ease.inOut(q));
    g.camera(camX, 560, z);
    const lower = ease.inOut(seg(q, 0.3, 0.85));
    const raise = lerp(1.05, 0, lower) + Math.sin(t * 7.5) * 0.3 * (1 - seg(q, 0.05, 0.3));
    world(g, {
      t, light, eave: light, reach: 0, placed: true, person: false, lit: 0.9,
      fog: 1, pr: 1.5, fogColor: light ? '#f7efe6' : '#b8c4e6', fogAlpha: light ? 0.8 : 0.32,
      sm: { look: 0.75, lookUp: 0.45, mood: q < 0.55 ? 'happy' : 'calm', arms: [0, raise], blush: lerp(1, 0.55, seg(q, 0.3, 0.9)), eyesClosed: q > 0.66 && q < 0.7, lit: light * 0.6 },
    });
    // 灭灯后还有一点月光照在窗台和雪人身上
    g.restore();
    g.snow({ count: 140, wind: 20, sway: 22, speed: [40, 90], size: [2, 8], seed: 42 });
    g.snow({ count: 8, wind: 30, sway: 40, speed: [50, 90], size: [18, 28], crystal: 999, alpha: 0.2, seed: 43 });
    // 啪
    const pk = seg(q, OFF, OFF + 0.05);
    if (pk > 0) {
      const fade = 1 - seg(q, OFF + 0.2, OFF + 0.32);
      const wx = (WX + WW + 40 - camX) * z + 960, wy = (WY - 6 - 560) * z + 540;
      g.text('啪', wx, wy, { size: 110, color: '#fff4dc', progress: pk, seed: 51, rot: 0.15, alpha: fade, stroke: 'rgba(18,23,41,0.7)', strokeWidth: 10 });
      burstRays(g, wx, wy, 70, 130, seg(q, OFF, OFF + 0.2), 8, 52, 'rgba(255,244,220,0.9)', 4);
    }
    // 晚安
    const tk = seg(q, 0.42, 0.72);
    if (tk > 0) {
      g.text('晚安', 150, 150, { size: 100, vertical: true, color: '#f3f0ff', progress: tk, seed: 53, stroke: 'rgba(18,23,41,0.6)', strokeWidth: 10 });
    }
    // 开灯 → 关灯：关的那一下整屏暗一档
    const dim = q < OFF ? 0 : 0.18 + 0.12 * seg(q, 0.8, 1);
    if (dim > 0) {
      ctx.save();
      ctx.fillStyle = rgba(P.nightDeep, dim);
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    vignette(g, 0.5);
  }

  TG.scene({
    id: 'christmas',
    title: '窗',
    dark: true,
    transition: 'fade',
    chars: '平安夜嘿咻叮！给我的？啪晚安～12.4',
    lyrics: 'default',
    draw(g, p, t, info) {
      if (p < SH.wide) shotWide(g, seg(p, 0, SH.wide), t, info);
      else if (p < SH.push) shotPush(g, seg(p, SH.wide, SH.push), t, info);
      else if (p < SH.star) shotStar(g, seg(p, SH.push, SH.star), t, info);
      else if (p < SH.fog) shotFog(g, seg(p, SH.star, SH.fog), t, info);
      else if (p < SH.eye) shotEye(g, seg(p, SH.fog, SH.eye), t, info);
      else if (p < SH.rev) shotReverse(g, seg(p, SH.eye, SH.rev), t, info);
      else shotOut(g, seg(p, SH.rev, 1), t, info);
    },
  });
})();
