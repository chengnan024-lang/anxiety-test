/* 场景：touch —— 心疼
 *
 * 镜头（按 p 分段）：
 *   S1 0.00–0.20  中近景：红手套从右下伸进来，犹豫一下，轻轻按在雪人胸口（"！"）
 *   S2 0.20–0.38  胸口特写：接触处发暖光，胸口浮出一颗跳动的心（扑通）
 *   S3 0.38–0.50  暖色插画框：雪人闭眼害羞地笑（暖暖的）
 *   S4 0.50–0.68  胸口特写（荷兰角）：手套下开始滴水，36.5°C，心上裂开一道缝（咔）
 *   S5 0.68–0.84  冷色脸部特写：八字眉 + 努力的笑 + 一滴眼泪（没关系）
 *   S6 0.84–1.00  拉远：手离开，胸口留下一个融化的手印，裂开的心沉进手印里微微发光（还是暖的）
 */
(function () {
  'use strict';
  const { clamp, lerp, seg, ease, rand, rgba } = TG.U;
  const P = TG.PAL, C = TG.C, W = TG.W, H = TG.H;

  // ------------------------------------------------------------ 世界坐标布局
  const SX = 860, SY = 1000;              // 雪人脚底
  const PRESS = [SX - 26, SY - 116];      // 手掌按在胸口的中心
  const MS = 0.66;                        // 手套大小（世界单位）
  const MROT = -1.3;                      // 指尖朝左、略朝上
  const COS = Math.cos(MROT), SIN = Math.sin(MROT);
  const ARM = [-SIN, COS];                // 指尖 → 手腕 → 肩膀 的方向
  const COAT = '#5b434b';
  const HEART = [SX - 68, SY - 174];      // 心浮起来停住的位置
  const HR = 33;                          // 心的大小
  const CUT = [0, 0.2, 0.38, 0.5, 0.68, 0.84, 1];

  // 手套局部坐标里的掌形 / 拇指（和 C.mitten 一致）
  const PALM = [[-46, 0], [-52, -70], [-44, -128], [-10, -158], [26, -150], [44, -112], [46, -60], [42, 0]];
  const THUMB = [[40, -50], [74, -78], [88, -104], [76, -118], [56, -104], [44, -86], [40, -60]];
  const PRINT = [[-46, 0], [-52, -70], [-44, -128], [-10, -158], [26, -150], [42, -112], [58, -108], [78, -122], [92, -104], [76, -76], [48, -54], [42, 0]];

  // ------------------------------------------------------------ 小工具
  function wristAt(d) {
    const k = 80 * MS + d;
    return [PRESS[0] + ARM[0] * k, PRESS[1] + ARM[1] * k];
  }
  /** 手套局部坐标 → 世界坐标（手腕在 wrist） */
  function local(wrist, lx, ly) {
    return [wrist[0] + (lx * COS - ly * SIN) * MS, wrist[1] + (lx * SIN + ly * COS) * MS];
  }
  function camOn(g, c) {
    g.save();
    g.camera(c.x, c.y, c.z, c.r || 0, c.dx || 0, c.dy || 0);
  }
  function toScreen(c, x, y) {
    const X = (x - c.x) * c.z, Y = (y - c.y) * c.z;
    const cr = Math.cos(c.r || 0), sr = Math.sin(c.r || 0);
    return [W / 2 + (c.dx || 0) + X * cr - Y * sr, H / 2 + (c.dy || 0) + X * sr + Y * cr];
  }
  /** 心跳节拍：用户敲了拍子就跟拍子走，否则按 t 固定约 69 次/分 */
  function beatAt(t, info, rate = 1.15) {
    if (info.bpm) return { n: Math.floor(info.beat), ph: info.beatPhase };
    const b = t * rate;
    return { n: Math.floor(b), ph: b - Math.floor(b) };
  }
  function heartbeat(t, info, rate) {
    const ph = beatAt(t, info, rate).ph;
    return Math.exp(-ph * 9) + (ph > 0.2 ? 0.6 * Math.exp(-(ph - 0.2) * 9) : 0);
  }
  /** 雪人头部的位置（和 C.snowman 里的算法一致），用来叠加自己的表情 */
  function headFrame(melt, look) {
    const m1 = ease.inOut(clamp(melt / 0.85));
    const bodyRy = 118 * lerp(1, 0.28, m1);
    const bodyCy = SY - bodyRy;
    const headR = 80 * lerp(1, 0.55, ease.in(clamp(melt / 0.7)));
    return {
      x: SX + lerp(0, 22, ease.in(clamp(melt / 0.8))),
      y: bodyCy - bodyRy * 0.82 - headR * 0.92 + lerp(0, 18, m1),
      r: headR,
      tilt: lerp(0, 0.35, ease.in(clamp(melt / 0.8))) + look * 0.06,
    };
  }
  /** 叠加表情：八字眉（难过却在笑）、害羞的 /// 腮红 */
  function faceExtras(g, o) {
    const melt = o.melt || 0, look = o.look || 0;
    const h = headFrame(melt, look);
    const ctx = g.ctx;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.tilt);
    const fx = look * h.r * 0.28, ex = h.r * 0.32, ey = -h.r * 0.12, droop = melt * 10;
    if (o.brows) {
      const a = o.brows;
      g.line(fx - ex - 13, ey - 20 + 2 * a, fx - ex + 9, ey - 26 - 6 * a + droop * 0.3, { color: P.ink, width: 3.6, seed: 501 });
      g.line(fx + ex + 13, ey - 20 + 2 * a, fx + ex - 9, ey - 26 - 6 * a + droop * 0.3, { color: P.ink, width: 3.6, seed: 502 });
    }
    if (o.shy) {
      for (let s = look < 0 ? 1 : -1; s <= 1; s += 2) {
        const cx = fx + s * (ex + 8), cy = ey + 26 + droop;
        for (let k = 0; k < 3; k++) {
          const x0 = cx - 10 + k * 8;
          g.line(x0 + 3, cy - 6, x0 - 2, cy + 6, { color: '#d9706b', width: 2.4, alpha: o.shy, seed: 510 + k + (s > 0 ? 5 : 0) });
        }
      }
    }
    ctx.restore();
    return h;
  }

  // ------------------------------------------------------------ 背景
  function nightBG(g, t, c, o = {}) {
    const ctx = g.ctx;
    g.bg(o.sky || [P.nightDeep, P.night, '#2a3561']);
    // 月光（左上冷光）
    g.glow(W * 0.18, H * 0.05, 760, '#9fb4ea', 0.16);
    // 星星
    ctx.save();
    ctx.fillStyle = '#e4e9ff';
    for (let i = 0; i < 46; i++) {
      const x = ((rand(i, 3) * W * 1.3 - (c.x - 1000) * 0.06 * c.z) % W + W) % W;
      const y = rand(i, 4) * H * 0.62;
      ctx.globalAlpha = 0.25 + 0.4 * (0.5 + 0.5 * Math.sin(t * (1 + rand(i, 5) * 2.5) + i));
      const s = 1.5 + rand(i, 6) * 2;
      ctx.fillRect(x, y, s, s);
    }
    ctx.restore();
    // 远处"你"家的窗光，失焦成光斑
    const k = o.bokeh == null ? 1 : o.bokeh;
    if (k > 0) {
      for (let i = 0; i < 8; i++) {
        const bx = W * (0.5 + rand(i, 11) * 0.6) - (c.x - 1000) * 0.25 * c.z;
        const by = H * (0.42 + rand(i, 12) * 0.3) - (c.y - 800) * 0.15 * c.z;
        const br = (18 + rand(i, 13) * 40) * (0.5 + c.z * 0.3);
        const fl = 0.75 + 0.25 * Math.sin(t * 1.3 + i * 2);
        g.glow(bx, by, br * 2.6, P.warmDeep, 0.16 * k * fl);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        bg.addColorStop(0, rgba(i % 3 ? P.warm : P.glow, 0.22 * k * fl));
        bg.addColorStop(0.85, rgba(i % 3 ? P.warm : P.glow, 0.3 * k * fl));
        bg.addColorStop(1, rgba(P.glow, 0.45 * k * fl));
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  /** 世界里的地面：远处的雪坡 + 脚下的雪地 */
  function worldGround(g) {
    C.ground(g, SY - 150, { color: '#3d4877', line: rgba(P.ink, 0.6), amp: 30, seed: 21, width: 3 });
    // 远处的小松树
    for (let i = 0; i < 14; i++) {
      const x = 180 + i * 130 + rand(i, 41) * 70, y = SY - 146 + rand(i, 42) * 22;
      const s = 0.35 + rand(i, 43) * 0.3;
      g.poly([[x - 24 * s, y], [x - 6 * s, y - 50 * s], [x - 14 * s, y - 50 * s], [x, y - 92 * s], [x + 14 * s, y - 50 * s], [x + 6 * s, y - 50 * s], [x + 24 * s, y]],
        { color: rgba(P.ink, 0.35), width: 2, fill: '#2f3962', seed: 440 + i });
    }
    C.ground(g, SY - 66, { color: '#d6deef', amp: 12, seed: 6 });
    const ctx = g.ctx;
    const gr = ctx.createLinearGradient(0, SY - 70, 0, SY + 120);
    gr.addColorStop(0, 'rgba(44,58,102,0)');
    gr.addColorStop(1, 'rgba(44,58,102,0.35)');
    ctx.save();
    ctx.fillStyle = gr;
    ctx.fillRect(-100, SY - 70, W + 200, 400);
    ctx.restore();
  }

  // ------------------------------------------------------------ "你"的手
  function hand(g, d, o = {}) {
    const wr = wristAt(d);
    const ctx = g.ctx;
    ctx.save();
    ctx.translate(wr[0], wr[1]);
    ctx.rotate(MROT);
    ctx.scale(MS, MS);
    // 大衣袖子（局部 +y 朝肩膀；+x 那一侧朝上）
    g.path([[-50, 26], [50, 26], [70, 1500], [-72, 1500]], { closed: true, color: P.ink, width: 4.5, fill: COAT, seed: 301 });
    g.fill([[-46, 30], [-14, 30], [-20, 1500], [-68, 1500]], rgba(P.ink, 0.28), { seed: 305 });
    g.line(44, 60, 66, 1100, { color: P.glow, width: 4, alpha: 0.35 * (o.rim == null ? 1 : o.rim), seed: 302 });
    g.curve([[-40, 120], [-6, 132], [30, 118]], { color: rgba(P.ink, 0.7), width: 3.5, seed: 303 });
    g.curve([[-46, 230], [-4, 246], [40, 226]], { color: rgba(P.ink, 0.6), width: 3.5, seed: 304 });
    ctx.restore();
    C.mitten(g, wr[0], wr[1], MS, MROT, { seed: 310 });
    return wr;
  }
  /** 手套形状（世界坐标多边形），scale 以掌心为中心放大 */
  function mittenShape(pts, scale, d) {
    const wr = wristAt(d || 0);
    return pts.map((p) => local(wr, p[0] * scale, -80 + (p[1] + 80) * scale));
  }
  /** 湿掉的雪（手套周围一圈深色水渍） */
  function wetRing(g, k) {
    if (k <= 0) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.globalAlpha *= k;
    g.fill(mittenShape(PALM, 1.22), rgba(P.ice, 0.55), { seed: 320 });
    g.fill(mittenShape(THUMB, 1.18), rgba(P.ice, 0.55), { seed: 321 });
    ctx.restore();
  }
  /** 融化的手印 */
  function handprint(g, k, t) {
    if (k <= 0) return;
    const ctx = g.ctx;
    ctx.save();
    ctx.globalAlpha *= k;
    const pr = mittenShape(PRINT, 1.04);
    g.path(pr, { closed: true, smooth: true, color: '#56739f', width: 3.4, fill: '#9fb3da', seed: 334 });
    // 积在手印里的水
    const inner = pr.map((p) => [lerp(p[0], PRESS[0], 0.16) + 3, lerp(p[1], PRESS[1], 0.16) + 4]);
    g.path(inner, { closed: true, smooth: true, stroke: false, fill: '#bcd6f0', seed: 332 });
    // 高光
    const a = local(wristAt(0), -20, -128), b = local(wristAt(0), -32, -96);
    g.line(a[0], a[1], b[0], b[1], { color: '#ffffff', width: 3.5, alpha: 0.9, seed: 336 });
    const c1 = local(wristAt(0), 10, -60), c2 = local(wristAt(0), 18, -36);
    g.line(c1[0], c1[1], c2[0], c2[1], { color: '#ffffff', width: 3, alpha: 0.7, seed: 337 });
    ctx.restore();
    // 往下淌的水痕
    drips(g, t, k, 1, 340);
  }
  /** 手套/手印下沿往下淌的水，o: 0..1 程度 */
  function drips(g, t, k, amount, seed) {
    if (k <= 0 || amount <= 0) return;
    const wr = wristAt(0);
    const starts = [[-50, -28], [-54, -78], [-46, -120]];
    const ctx = g.ctx;
    ctx.save();
    ctx.globalAlpha *= k;
    starts.forEach((s, i) => {
      const p0 = local(wr, s[0], s[1]);
      const L = (34 + i * 16) * amount;
      g.line(p0[0], p0[1], p0[0] - 2, p0[1] + L, { color: '#7f9fcc', width: 4, alpha: 0.9, seed: seed + i });
      g.line(p0[0] + 2, p0[1] + 4, p0[0] + 1, p0[1] + L * 0.7, { color: '#ffffff', width: 1.6, alpha: 0.8, seed: seed + 10 + i });
      // 一颗水珠顺着往下滑，循环
      const per = 1.1 + i * 0.27;
      const ph = ((t + i * 0.43) / per) % 1;
      const dy = L + ease.in(ph) * 130;
      ctx.save();
      ctx.globalAlpha *= clamp((1 - ph) * 3) * amount;
      C.drop(g, p0[0] - 2, p0[1] + dy, 0.55, { seed: seed + 20 + i });
      ctx.restore();
    });
    ctx.restore();
  }

  /** 跳动的心（白色贴纸描边 + 暖光） */
  function bigHeart(g, x, y, r, o = {}) {
    const glowA = o.glow == null ? 1 : o.glow;
    if (glowA > 0) {
      g.glow(x, y, r * 3.2, P.warm, 0.5 * glowA);
      g.glow(x, y, r * 1.8, P.glow, 0.45 * glowA);
    }
    const rot = o.rot || 0;
    C.heart(g, x, y + r * 0.03, r * 1.2, { fill: '#fff8ea', color: 'rgba(0,0,0,0)', width: 1, rot, seed: 400 });
    C.heart(g, x, y, r, { rot, crack: o.crack || 0, seed: 401, width: Math.max(3, r * 0.09) });
    const ctx = g.ctx;
    // 高光
    if (!o.crack) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      g.arc(-r * 0.42, -r * 0.3, r * 0.2, Math.PI * 1.05, Math.PI * 1.6, { color: '#ffffff', width: r * 0.07, seed: 402 });
      // 裂缝的细线（还没裂开之前）
      if (o.hair) {
        const zz = [[0.02, -0.3], [-0.12, -0.12], [0.1, 0.06], [-0.07, 0.3], [0.05, 0.52], [0, 0.85]];
        g.path(zz.map((p) => [p[0] * r, p[1] * r]), { color: P.ink, width: r * 0.05, progress: o.hair, seed: 403 });
      }
      ctx.restore();
    }
  }
  /** 心跳的小括弧线 */
  function beatMarks(g, x, y, r, k) {
    if (k <= 0.05) return;
    for (const s of [-1, 1]) {
      for (let j = 0; j < 2; j++) {
        const rr = r * (1.45 + j * 0.28 + (1 - k) * 0.2);
        const a0 = s > 0 ? -0.5 : Math.PI - 0.5;
        g.arc(x, y + r * 0.1, rr, a0, a0 + 1, { color: P.ink, width: 4, alpha: k, seed: 410 + j + (s > 0 ? 2 : 0) });
      }
    }
  }
  /** 放射的暖光线 */
  function rays(g, x, y, k, t, r0, r1, n, seed, color) {
    if (k <= 0) return;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(i, seed) * 0.35;
      const len = lerp(r0, r1, (0.55 + 0.45 * Math.sin(t * 4 + i * 1.7)) * k);
      g.line(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * len, y + Math.sin(a) * len, { color: color || P.glow, width: 4, alpha: 0.85 * k, seed: seed + i });
    }
  }
  /** 四角星闪光 */
  function sparkle(g, x, y, r, color, a, seed) {
    if (a <= 0) return;
    g.line(x - r, y, x + r, y, { color, width: Math.max(2, r * 0.18), alpha: a, seed });
    g.line(x, y - r, x, y + r, { color, width: Math.max(2, r * 0.18), alpha: a, seed: seed + 1 });
  }
  /** 拟声字 / 短句：弹出 + 淡出 */
  function sfx(g, str, x, y, o) {
    g.text(str, x, y, Object.assign({ size: 64, font: 'round', color: P.red, stroke: '#fff8ea', strokeWidth: 12 }, o));
  }

  // ------------------------------------------------------------ 镜头
  /** S1 中近景：手伸进来 */
  function shot1(g, q, t, info) {
    const c = { x: lerp(SX + 175, SX + 125, ease.inOut(q)), y: SY - 205, z: lerp(1.82, 1.96, ease.inOut(q)) };
    // 手的距离：滑入 → 停住犹豫 → 轻轻按上
    let d;
    const HOVER = 225;                    // 停在身体外面一点点
    if (q < 0.5) d = lerp(1000, HOVER, ease.outCubic(seg(q, 0.08, 0.5)));
    else if (q < 0.64) d = HOVER + Math.sin(t * 11) * 3 - 12 * ease.inOut(seg(q, 0.5, 0.64));
    else d = lerp(HOVER - 12, -5, ease.inOut(seg(q, 0.64, 0.83))) + 5 * ease.out(seg(q, 0.84, 1));
    const touched = seg(q, 0.82, 0.86);
    const look = lerp(0.05, 0.55, ease.inOut(seg(q, 0.1, 0.45)));
    nightBG(g, t, c);
    g.snow({ count: 80, size: [2, 5], speed: [25, 60], wind: 12, seed: 3, alpha: 0.7 });
    camOn(g, c);
    worldGround(g);
    C.snowman(g, SX, SY, 1, {
      mood: q < 0.42 ? 'calm' : 'hope', look, blush: lerp(0.5, 0.95, seg(q, 0.84, 1)), seed: 7,
    });
    if (touched > 0) {
      // 接触的一圈波纹
      const k = seg(q, 0.84, 1);
      g.circle(PRESS[0], PRESS[1], lerp(30, 95, ease.out(k)), { color: P.glow, width: 4, alpha: (1 - k) * 0.8, seed: 99 });
      g.glow(PRESS[0], PRESS[1], 150, P.warm, 0.5 * k);
    }
    hand(g, d);
    g.restore();
    // "你"那边的暖光：手越近越亮
    const near = clamp(1 - d / 1000);
    g.glow(W + 80, H * 0.58, 1000, P.warm, 0.08 + 0.14 * near);
    g.snow({ count: 14, size: [9, 15], speed: [70, 120], wind: 20, seed: 9, alpha: 0.55, crystal: 99 });
    // "？"：看见了伸过来的手
    const qk = seg(q, 0.22, 0.3), qa = 1 - seg(q, 0.76, 0.83);
    if (qk > 0 && qa > 0) {
      const hp = toScreen(c, SX + 112, SY - 380);
      g.text('?', hp[0], hp[1] + Math.sin(t * 5) * 6, { size: 130, font: 'round', color: P.snow, stroke: P.nightDeep, strokeWidth: 14, progress: qk, alpha: qa, rot: 0.2 });
    }
    // "！"：碰到的一瞬间
    const pk = seg(q, 0.83, 0.9);
    if (pk > 0) {
      const hp = toScreen(c, SX + 118, SY - 372);
      const bob = ease.outBack(pk);
      g.text('!', hp[0], hp[1] - 20 * bob, { size: 190, font: 'round', color: P.snow, stroke: P.nightDeep, strokeWidth: 16, progress: pk, rot: 0.18 });
      for (let i = 0; i < 3; i++) {
        const a = -2.0 + i * 0.5;
        const ox = hp[0] - 20, oy = hp[1] + 10;
        g.line(ox + Math.cos(a) * 95, oy + Math.sin(a) * 95, ox + Math.cos(a) * 140, oy + Math.sin(a) * 140, { color: P.snow, width: 7, progress: pk, seed: 120 + i });
      }
      // 手掌下的一圈"轻轻"的冲击线
      const ps = toScreen(c, PRESS[0], PRESS[1]);
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * 0.55 + i * 0.32;
        const r0 = 150 + 20 * pk, r1 = r0 + 45 * (1 - seg(q, 0.9, 1));
        g.line(ps[0] + Math.cos(a) * r0, ps[1] + Math.sin(a) * r0, ps[0] + Math.cos(a) * r1, ps[1] + Math.sin(a) * r1, { color: P.glow, width: 5, alpha: 0.9, progress: pk, seed: 130 + i });
      }
    }
  }

  /** S2 胸口特写：暖光 + 浮出的心 */
  function shot2(g, q, t, info) {
    const c = { x: PRESS[0] - 10, y: PRESS[1] - 62, z: lerp(3.15, 3.4, ease.inOut(q)), r: lerp(0.025, -0.005, q) };
    const warm = ease.out(seg(q, 0.0, 0.4));
    nightBG(g, t, c, { bokeh: 1 });
    g.snow({ count: 60, size: [2, 5], speed: [20, 50], wind: 8, seed: 4, alpha: 0.6 });
    camOn(g, c);
    worldGround(g);
    C.snowman(g, SX, SY, 1, { mood: q < 0.55 ? 'hope' : 'happy', look: 0.4, blush: 1, seed: 7 });
    g.glow(PRESS[0], PRESS[1], 230, P.warm, 0.42 * warm);
    g.glow(PRESS[0], PRESS[1], 120, P.glow, 0.5 * warm);
    rays(g, PRESS[0], PRESS[1], warm, t, 78, 130, 14, 200);
    hand(g, 0);
    // 心：从手掌下面浮出来，弹一下，然后跟着心跳
    const hk = seg(q, 0.22, 0.5);
    let hx = 0, hy = 0, hr = 0;
    if (hk > 0) {
      const pulse = heartbeat(t, info);
      const e = ease.outBack(hk);
      hx = lerp(PRESS[0] - 6, HEART[0], ease.out(hk));
      hy = lerp(PRESS[1] - 10, HEART[1], ease.out(hk)) + Math.sin(t * 2.2) * 2;
      hr = HR * e * (1 + 0.12 * pulse * seg(q, 0.45, 0.55));
      bigHeart(g, hx, hy, hr, { glow: warm, rot: -0.08 });
      beatMarks(g, hx, hy, hr, pulse * seg(q, 0.5, 0.6));
    }
    g.restore();
    // 暖光照亮的雪
    g.snow({ count: 26, size: [3, 7], speed: [18, 40], wind: 6, seed: 12, alpha: 0.8, color: P.glow, area: [W * 0.25, 0, W * 0.5, H * 0.8] });
    // 扑通（每一拍换一个位置）
    if (hk > 0.5) {
      const { n, ph } = beatAt(t, info);
      const spots = [[330, 330, -0.14], [1560, 250, 0.12], [420, 170, -0.06], [1640, 420, 0.16]];
      const sp = spots[((n % 4) + 4) % 4];
      const a = ph < 0.55 ? 1 : clamp(1 - (ph - 0.55) / 0.4);
      sfx(g, '扑通', sp[0], sp[1], { size: 120, rot: sp[2], alpha: a, seed: n, progress: clamp(ph * 6), strokeWidth: 16 });
    }
  }

  /** S3 暖色插画框：害羞地笑 */
  function shot3(g, q, t, info) {
    const ctx = g.ctx;
    const c = { x: SX + 10, y: SY - 262, z: lerp(2.45, 2.6, ease.inOut(q)), r: Math.sin(t * 2.4) * 0.025 };
    const hp = toScreen(c, SX, SY - 288);
    // 放射状暖色背景
    const gr = ctx.createRadialGradient(hp[0], hp[1], 40, hp[0], hp[1], 1300);
    gr.addColorStop(0, '#fff4dc');
    gr.addColorStop(0.35, P.glow);
    gr.addColorStop(1, P.warmDeep);
    ctx.save();
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
    ctx.translate(hp[0], hp[1]);
    ctx.rotate(t * 0.12);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 1700, a, a + Math.PI / 16);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // 往上飘的小心和闪光
    for (let i = 0; i < 10; i++) {
      const per = 3 + rand(i, 31) * 2;
      const ph = ((t + rand(i, 32) * per) / per) % 1;
      const x = W * (0.08 + rand(i, 33) * 0.84) + Math.sin(t * 2 + i) * 18;
      if (Math.abs(x - hp[0]) < 260) continue;
      const y = H * 1.05 - ph * H * 1.1;
      const r = 14 + rand(i, 34) * 16;
      ctx.save();
      ctx.globalAlpha *= clamp(ph * 5) * clamp((1 - ph) * 4);
      if (i % 3 === 0) sparkle(g, x, y, r * 1.2, '#ffffff', 0.9, 600 + i);
      else C.heart(g, x, y, r, { fill: P.pink, color: '#c96c6c', width: 3, rot: Math.sin(t * 3 + i) * 0.2, seed: 610 + i });
      ctx.restore();
    }
    camOn(g, c);
    C.snowman(g, SX, SY, 1, { mood: 'happy', eyesClosed: true, look: -0.18, blush: 1, seed: 7 });
    faceExtras(g, { look: -0.18, shy: 0.9 });
    g.glow(PRESS[0], PRESS[1], 160, P.glow, 0.5);
    hand(g, 0, { rim: 0 });
    g.restore();
    // 脸边一闪一闪的小星星
    [[-300, -120, 34], [290, -40, 26], [-250, 120, 22]].forEach((s, i) => {
      const k = 0.5 + 0.5 * Math.sin(t * 5 + i * 2.1);
      sparkle(g, hp[0] + s[0], hp[1] + s[1], s[2] * (0.6 + 0.6 * k), '#ffffff', 0.95, 640 + i * 2);
    });
    // 暖暖的
    const wk = seg(q, 0.15, 0.6);
    g.text('暖暖的', 1490, 300, { size: 104, font: 'round', color: '#9a4a24', stroke: '#fff8ea', strokeWidth: 16, progress: wk, rot: -0.07 });
    if (wk >= 1) g.curve([[1340, 380], [1420, 395], [1510, 378], [1620, 392]], { color: '#9a4a24', width: 6, progress: seg(q, 0.6, 0.8), seed: 650 });
  }

  /** S4 胸口特写：滴水、36.5°C、心裂开 */
  function shot4(g, q, t, info) {
    const crackAt = 0.6;
    const ck = seg(q, crackAt, crackAt + 0.06);
    const sh = ck > 0 && ck < 1 ? g.shake(10) : [0, 0];
    const c = { x: PRESS[0] - 34, y: PRESS[1] - 8, z: lerp(3.9, 4.2, ease.inOut(q)), r: -0.07, dx: sh[0], dy: sh[1] };
    nightBG(g, t, c, { bokeh: 0.7 });
    g.snow({ count: 70, size: [2, 5], speed: [25, 60], wind: 14, seed: 5, alpha: 0.6 });
    camOn(g, c);
    worldGround(g);
    C.snowman(g, SX, SY, 1, { mood: q < crackAt ? 'happy' : 'calm', look: 0.4, blush: 0.9, melt: 0.03, seed: 7 });
    const wet = ease.out(seg(q, 0, 0.5));
    wetRing(g, wet);
    g.glow(PRESS[0], PRESS[1], 200, P.warm, lerp(0.38, 0.22, q));
    hand(g, -3 * wet);
    drips(g, t, 1, ease.out(seg(q, 0.05, 0.6)), 360);
    // 心：跳得越来越弱，先出现一道细缝，然后"咔"地裂开
    const pulse = heartbeat(t, info) * lerp(1, 0.35, q);
    const hr = HR * (1 + 0.1 * pulse);
    const hair = seg(q, 0.25, crackAt);
    const crack = ck > 0 ? 0.13 * ease.outBack(ck) : 0;
    bigHeart(g, HEART[0], HEART[1] + Math.sin(t * 2.2) * 2, hr, { glow: lerp(0.9, 0.45, q), rot: -0.08, hair, crack });
    g.restore();
    // 36.5°C 标注
    const lk = seg(q, 0.06, 0.32);
    if (lk > 0) {
      const tip = toScreen(c, PRESS[0] + 20, PRESS[1] - 22);
      const tx = 1540, ty = 190;
      g.curve([[tx - 20, ty + 80], [tx - 60, ty + 220], [tip[0] + 70, tip[1] - 30], tip], { color: P.glow, width: 7, progress: lk, seed: 700 });
      if (lk >= 1) {
        g.line(tip[0], tip[1], tip[0] + 10, tip[1] - 40, { color: P.glow, width: 7, seed: 701 });
        g.line(tip[0], tip[1], tip[0] + 40, tip[1] + 6, { color: P.glow, width: 7, seed: 702 });
      }
      g.text('36.5°C', tx, ty, { size: 112, font: 'latin', color: P.glow, stroke: P.nightDeep, strokeWidth: 14, progress: lk, rot: -0.06 });
    }
    // 滴、答
    const dk = seg(q, 0.1, 1);
    if (dk > 0) {
      const n = Math.floor(t * 1.4), ph = t * 1.4 - n;
      const ds = toScreen(c, PRESS[0] - 40, PRESS[1] + 60);
      sfx(g, n % 2 ? '答' : '滴', ds[0] - 250 - (n % 3) * 40, Math.min(860, ds[1] - 40 + (n % 2) * 60), {
        size: 92, color: '#bcd6f2', stroke: P.nightDeep, strokeWidth: 14, alpha: ph < 0.5 ? 1 : clamp(1 - (ph - 0.5) / 0.45), seed: n, rot: -0.12, progress: clamp(ph * 6),
      });
    }
    // 咔
    if (ck > 0) {
      const hs = toScreen(c, HEART[0], HEART[1]);
      const a = clamp(1 - seg(q, crackAt + 0.15, crackAt + 0.3));
      sfx(g, '咔', hs[0] - 250, hs[1] - 150, { size: 170, font: 'brush', color: P.snow, stroke: P.ink, strokeWidth: 14, progress: ck, alpha: a, rot: -0.2 });
      for (let i = 0; i < 4; i++) {
        const an = -2.6 + i * 0.45, r0 = HR * c.z * 1.35;
        g.line(hs[0] + Math.cos(an) * r0, hs[1] + Math.sin(an) * r0, hs[0] + Math.cos(an) * (r0 + 50), hs[1] + Math.sin(an) * (r0 + 50), { color: P.snow, width: 6, alpha: a, progress: ck, seed: 730 + i });
      }
    }
  }

  /** S5 冷色脸部特写：难过却还是努力笑 */
  function shot5(g, q, t, info) {
    const z5 = lerp(3.55, 3.85, ease.inOut(q));
    const c = { x: SX + 380 / z5, y: SY - 288 - 10 / z5, z: z5, r: -0.05 };
    const melt = 0.1;
    nightBG(g, t, c, { sky: [P.nightDeep, P.nightDeep, P.night], bokeh: 0 });
    g.snow({ count: 110, size: [2, 6], speed: [50, 110], wind: -60, sway: 14, seed: 6, alpha: 0.7 });
    camOn(g, c);
    worldGround(g);
    C.snowman(g, SX, SY, 1, { mood: 'happy', look: -0.12, blush: 0.45, melt, tear: ease.inOut(seg(q, 0.12, 0.8)), seed: 7 });
    faceExtras(g, { look: -0.12, melt, brows: ease.out(seg(q, 0, 0.3)) });
    g.restore();
    g.vignette(0.45, P.nightDeep);
    g.snow({ count: 16, size: [10, 16], speed: [90, 150], wind: -90, seed: 13, alpha: 0.45, crystal: 99 });
    // 没关系
    const wk = seg(q, 0.22, 0.72);
    g.text('没关系', 1500, 180, { size: 150, vertical: true, color: P.snow, stroke: rgba(P.nightDeep, 0.9), strokeWidth: 16, progress: wk, shadow: { color: rgba(P.ice, 0.6), dx: 6, dy: 6 } });
  }

  /** S6 拉远：手离开，留下融化的手印 */
  function shot6(g, q, t, info) {
    const c = { x: lerp(SX + 150, SX + 200, ease.inOut(q)), y: SY - 210, z: lerp(2.3, 1.95, ease.inOut(q)) };
    const d = lerp(0, 1100, ease.inCubic(seg(q, 0.04, 0.55)));
    const look = lerp(0.35, 0.75, ease.inOut(seg(q, 0.05, 0.5)));
    const melt = 0.12;
    nightBG(g, t, c);
    g.snow({ count: 90, size: [2, 5], speed: [25, 60], wind: 14, seed: 3, alpha: 0.7 });
    camOn(g, c);
    worldGround(g);
    C.snowman(g, SX, SY, 1, { mood: 'happy', look, blush: 0.4, melt, arms: [0, lerp(0, 0.35, ease.inOut(seg(q, 0.15, 0.6)))], seed: 7 });
    faceExtras(g, { look, melt, brows: 1 });
    handprint(g, 1, t);
    // 心沉进手印里，留一点红光
    const sk = ease.inOut(seg(q, 0.15, 0.55));
    const pulse = heartbeat(t, info, 0.8) * 0.6;
    const hx = lerp(HEART[0], PRESS[0] - 4, sk), hy = lerp(HEART[1], PRESS[1] - 8, sk);
    const hr = lerp(HR, 22, sk) * (1 + 0.08 * pulse);
    const ctx = g.ctx;
    g.glow(PRESS[0], PRESS[1], lerp(60, 120, sk), P.warm, 0.3 * sk * (0.6 + 0.4 * pulse));
    g.glow(PRESS[0], PRESS[1], lerp(60, 110, sk), P.red, 0.25 * sk * (0.7 + 0.3 * pulse));
    ctx.save();
    ctx.globalAlpha *= lerp(1, 0.85, sk);
    bigHeart(g, hx, hy, hr, { glow: lerp(0.5, 0.25, sk), rot: -0.08, crack: 0.13 });
    ctx.restore();
    if (d < 1000) hand(g, d);
    g.restore();
    g.snow({ count: 12, size: [9, 15], speed: [70, 120], wind: 20, seed: 9, alpha: 0.5, crystal: 99 });
    // 还是暖的
    const wk = seg(q, 0.5, 0.86);
    g.text('还是暖的', 1560, 200, { size: 104, vertical: true, color: P.glow, stroke: rgba(P.nightDeep, 0.9), strokeWidth: 14, progress: wk, shadow: { color: rgba(P.red, 0.55), dx: 5, dy: 5 } });
  }

  const SHOTS = [shot1, shot2, shot3, shot4, shot5, shot6];

  TG.scene({
    id: 'touch',
    title: '心疼',
    dark: true,
    transition: 'fade',
    chars: '扑通暖的滴答咔没关系还是!?.°C',
    lyrics: 'default',
    draw(g, p, t, info) {
      let i = 0;
      while (i < SHOTS.length - 1 && p >= CUT[i + 1]) i++;
      const q = seg(p, CUT[i], CUT[i + 1]);
      SHOTS[i](g, q, t, info);
      // 切进暖光镜头时闪一下（按秒算，跟场景长短无关）
      const since = (p - CUT[i]) * info.dur;
      if ((i === 1 || i === 2) && since < 0.25) {
        const ctx = g.ctx;
        ctx.save();
        ctx.globalAlpha = 0.85 * (1 - since / 0.25);
        ctx.fillStyle = i === 1 ? P.glow : '#fff8ea';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    },
  });
})();
