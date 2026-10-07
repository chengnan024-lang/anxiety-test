/* 雪人 · 手书 —— 角色与道具
 *
 * 所有场景共用的角色，保证每一幕里的"雪人"都是同一个雪人。
 * 每个函数第一个参数都是绘图工具包 g，坐标单位是 1920×1080 画布像素。
 */
(function () {
  'use strict';
  const { clamp, lerp, ease, rand, noise1, mix, rgba } = TG.U;
  const P = TG.PAL;
  const C = (TG.C = {});

  /**
   * 雪人（"我"）。(x, y) 是雪人底部中心（站在地面上的那一点），s=1 时身高约 440px。
   * o = {
   *   t        时间（秒，用于围巾飘动、发抖），默认 info.songTime
   *   mood     'calm' | 'sad' | 'happy' | 'hope'
   *   melt     0..1 融化程度（1 = 只剩一滩水和围巾、胡萝卜、煤球、帽子）
   *   look     -1..1 视线方向（左/右）
   *   lookUp   0..1 抬头程度
   *   scarf    是否戴围巾（默认 true）
   *   hat      是否戴帽子（默认 true）
   *   wind     0..1 风力（围巾飘）
   *   arms     [左, 右] 手臂抬起角度（弧度，0 = 自然下垂斜伸）
   *   blush    0..1 脸红
   *   tear     0..1 眼泪（沿脸颊流下的进度）
   *   eyesClosed 是否闭眼
   *   shiver   0..1 冷得发抖
   *   snowCap  0..1 头顶积雪厚度
   *   outline  线条颜色；dark:true 时用于夜景（线更亮一点）
   *   seed     种子
   * }
   */
  C.snowman = function (g, x, y, s = 1, o = {}) {
    const ctx = g.ctx;
    const t = o.t == null ? g.info.songTime : o.t;
    const melt = clamp(o.melt || 0);
    const look = clamp(o.look || 0, -1, 1);
    const lookUp = clamp(o.lookUp || 0);
    const mood = o.mood || 'calm';
    const ink = o.outline || P.ink;
    const seed = o.seed | 0;
    const lw = 4.8 * s;
    const shiver = o.shiver || 0;
    const sh = shiver ? Math.sin(t * 40) * 3 * shiver * s : 0;

    // 融化：身体变扁变宽、往下沉
    const m1 = ease.inOut(clamp(melt / 0.85));
    const bodyRx = 132 * s * lerp(1, 1.35, m1);
    const bodyRy = 118 * s * lerp(1, 0.28, m1);
    const bodyCy = y - bodyRy;
    const headR = 80 * s * lerp(1, 0.55, ease.in(clamp(melt / 0.7)));
    const headCy = bodyCy - bodyRy * 0.82 - headR * 0.92 + lerp(0, 18 * s, m1);
    const headCx = x + sh + lerp(0, 22 * s, ease.in(clamp(melt / 0.8)));
    const headTilt = lerp(0, 0.35, ease.in(clamp(melt / 0.8))) + look * 0.06;
    const gone = clamp((melt - 0.82) / 0.18); // 最后阶段：雪几乎全没了

    // 水坑
    if (melt > 0.05) {
      const pr = lerp(60, 260, ease.out(clamp(melt))) * s;
      g.ellipse(x, y + 6 * s, pr, pr * 0.22, { color: rgba(P.ice, 0.9), width: 3 * s, fill: rgba(P.water, 0.75), seed: seed + 1 });
      g.line(x - pr * 0.5, y + 2 * s, x - pr * 0.15, y - 2 * s, { color: '#ffffff', width: 3 * s, alpha: 0.8, seed: seed + 2 });
    }

    // 影子
    if (melt < 0.9) {
      ctx.save();
      ctx.globalAlpha *= 0.18 * (1 - gone);
      ctx.fillStyle = P.nightBlue;
      ctx.beginPath();
      ctx.ellipse(x + 14 * s, y + 4 * s, bodyRx * 1.05, 16 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const fade = 1 - gone;
    ctx.save();
    ctx.globalAlpha *= fade;

    // 手臂（树枝）
    if (melt < 0.75) {
      const arms = o.arms || [0, 0];
      const armDrop = ease.in(clamp(melt / 0.75)) * 0.9;
      [-1, 1].forEach((side, k) => {
        const raise = (arms[k] || 0) - armDrop;
        const bx = x + sh + side * bodyRx * 0.86, by = bodyCy - bodyRy * 0.35;
        const A = side === -1 ? Math.PI + 0.45 + raise : -0.45 - raise;
        const L = 120 * s;
        const ex = bx + Math.cos(A) * L, ey = by + Math.sin(A) * L;
        g.line(bx, by, ex, ey, { color: P.woodDark, width: 6 * s, seed: seed + 10 + k });
        // 分叉的小树枝
        const mx = bx + Math.cos(A) * L * 0.62, my = by + Math.sin(A) * L * 0.62;
        g.line(mx, my, mx + Math.cos(A - side * 0.6) * 38 * s, my + Math.sin(A - side * 0.6) * 38 * s, { color: P.woodDark, width: 4 * s, seed: seed + 12 + k });
        g.line(ex, ey, ex + Math.cos(A + side * 0.5) * 26 * s, ey + Math.sin(A + side * 0.5) * 26 * s, { color: P.woodDark, width: 3.5 * s, seed: seed + 14 + k });
        g.line(ex, ey, ex + Math.cos(A - side * 0.45) * 22 * s, ey + Math.sin(A - side * 0.45) * 22 * s, { color: P.woodDark, width: 3 * s, seed: seed + 16 + k });
      });
    }

    // 身体
    const snowFill = P.snow;
    g.ellipse(x + sh, bodyCy, bodyRx, bodyRy, { color: ink, width: lw, fill: snowFill, seed: seed + 20 });
    // 身体阴影（右下的月牙）
    shade(g, x + sh, bodyCy, bodyRx, bodyRy, seed + 21);
    // 扣子（煤球）
    if (melt < 0.6) {
      for (let k = 0; k < 2; k++) {
        const by = bodyCy - bodyRy * 0.35 + k * bodyRy * 0.42;
        dot(g, x + sh + look * 8 * s, by, 8 * s * (1 - melt * 0.5), ink, seed + 30 + k);
      }
    }

    // 头
    ctx.save();
    ctx.translate(headCx, headCy);
    ctx.rotate(headTilt);
    if (melt < 0.97) {
      g.circle(0, 0, headR, { color: ink, width: lw, fill: snowFill, seed: seed + 40 });
      shade(g, 0, 0, headR, headR, seed + 41);
      // 头顶积雪
      if (o.snowCap) {
        const sc = clamp(o.snowCap) * 34 * s;
        g.path([[-headR * 0.6, -headR * 0.78], [-headR * 0.3, -headR * 0.95 - sc], [headR * 0.2, -headR - sc * 1.1], [headR * 0.62, -headR * 0.8]], { smooth: true, color: ink, width: 3 * s, fill: '#ffffff', seed: seed + 42 });
      }
      // 脸
      const fx = look * headR * 0.28, fy = -lookUp * headR * 0.25;
      const ex = headR * 0.32, ey = -headR * 0.12 + fy;
      const eyeR = 8.5 * s * lerp(1, 0.7, melt);
      const droop = melt * 10 * s;
      if (o.eyesClosed || mood === 'sad-closed') {
        g.arc(fx - ex, ey + 2 * s + droop, 10 * s, 0.2, Math.PI - 0.2, { color: ink, width: 4 * s, seed: seed + 43 });
        g.arc(fx + ex, ey + 2 * s + droop, 10 * s, 0.2, Math.PI - 0.2, { color: ink, width: 4 * s, seed: seed + 44 });
      } else {
        dot(g, fx - ex, ey + droop * 0.6, eyeR, ink, seed + 45);
        dot(g, fx + ex, ey + droop, eyeR, ink, seed + 46);
        // 眼睛高光
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(fx - ex + 2.5 * s, ey + droop * 0.6 - 3 * s, 2.6 * s, 0, Math.PI * 2);
        ctx.arc(fx + ex + 2.5 * s, ey + droop - 3 * s, 2.6 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (mood === 'sad' || mood === 'hope') {
        // 八字眉
        g.line(fx - ex - 12 * s, ey - 22 * s, fx - ex + 9 * s, ey - 28 * s + droop * 0.3, { color: ink, width: 3.4 * s, seed: seed + 47 });
        g.line(fx + ex + 12 * s, ey - 22 * s, fx + ex - 9 * s, ey - 28 * s + droop * 0.3, { color: ink, width: 3.4 * s, seed: seed + 48 });
      }
      // 腮红
      const blush = o.blush == null ? 0.55 : o.blush;
      if (blush > 0) {
        ctx.save();
        ctx.globalAlpha *= blush;
        ctx.fillStyle = P.pink;
        ctx.beginPath();
        ctx.ellipse(fx - ex - 8 * s, ey + 26 * s + droop, 15 * s, 8 * s, 0, 0, Math.PI * 2);
        ctx.ellipse(fx + ex + 8 * s, ey + 26 * s + droop, 15 * s, 8 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        g.line(fx - ex - 16 * s, ey + 22 * s + droop, fx - ex - 10 * s, ey + 30 * s + droop, { color: '#e98a8a', width: 2 * s, alpha: blush, seed: seed + 49 });
        g.line(fx + ex + 4 * s, ey + 22 * s + droop, fx + ex + 10 * s, ey + 30 * s + droop, { color: '#e98a8a', width: 2 * s, alpha: blush, seed: seed + 50 });
      }
      // 嘴
      const my = ey + 44 * s + droop;
      if (mood === 'happy') g.arc(fx, my - 12 * s, 16 * s, 0.35, Math.PI - 0.35, { color: ink, width: 4 * s, seed: seed + 51 });
      else if (mood === 'sad') g.arc(fx, my + 10 * s, 13 * s, Math.PI + 0.5, Math.PI * 2 - 0.5, { color: ink, width: 4 * s, seed: seed + 51 });
      else if (mood === 'hope') {
        g.ellipse(fx, my, 7 * s, 9 * s, { color: ink, width: 3.5 * s, fill: '#6b3b44', seed: seed + 51 });
      } else g.line(fx - 9 * s, my, fx + 9 * s, my + 1 * s, { color: ink, width: 4 * s, seed: seed + 51 });
      // 胡萝卜鼻子
      if (melt < 0.85) carrotOnFace(g, fx, ey + 18 * s + droop * 0.8, s, look, melt, seed + 52);
      // 眼泪
      if (o.tear) {
        const tp = clamp(o.tear);
        const tx = fx + ex + 4 * s, ty0 = ey + 12 * s + droop;
        const ty = ty0 + tp * 60 * s;
        g.line(tx, ty0, tx + 2 * s, ty - 6 * s, { color: P.water, width: 4 * s, progress: 1, seed: seed + 53 });
        C.drop(g, tx + 2 * s, ty, 0.6 * s, { seed: seed + 54 });
      }
    }
    // 帽子
    if (o.hat !== false && melt < 0.5) {
      C.hat(g, -6 * s, -headR * 0.86, s * lerp(1, 0.9, melt), -0.12 + melt * 0.8, { seed: seed + 60 });
    }
    ctx.restore();

    // 围巾（在头和身体之间）
    if (o.scarf !== false && melt < 0.85) {
      const nx = lerp(headCx, x + sh, 0.35), ny = lerp(headCy + headR * 0.85, bodyCy - bodyRy * 0.8, 0.5);
      scarfOn(g, nx, ny, s * lerp(1, 1.1, m1), t, o.wind || 0, seed + 70, m1);
    }
    ctx.restore();

    // 融化后的遗物：围巾、胡萝卜、煤球、帽子
    if (melt > 0.82) {
      const k = clamp((melt - 0.82) / 0.18);
      ctx.save();
      ctx.globalAlpha *= k;
      C.scarf(g, x - 20 * s, y - 6 * s, s, { t, seed: seed + 80 });
      C.carrot(g, x + 70 * s, y - 4 * s, s * 0.9, 0.25, { seed: seed + 81 });
      dot(g, x - 110 * s, y - 2 * s, 8 * s, ink, seed + 82);
      dot(g, x + 130 * s, y + 4 * s, 8 * s, ink, seed + 83);
      dot(g, x + 10 * s, y + 10 * s, 7 * s, ink, seed + 84);
      if (o.hat !== false) C.hat(g, x - 150 * s, y - 20 * s, s, -0.9, { seed: seed + 85 });
      ctx.restore();
    }
  };

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

  function dot(g, x, y, r, color, seed) {
    g.ellipse(x, y, r, r * 1.08, { color, width: 2, fill: color, jitter: 0.7, seed, overshoot: false });
  }
  C.dot = dot;

  function carrotOnFace(g, fx, fy, s, look, melt, seed) {
    const dir = look >= 0 ? 1 : -1;
    const len = lerp(54, 38, Math.abs(look) < 0.2 ? 0.4 : 0) * s;
    const droop = melt * 0.9;
    const ang = (look === 0 ? 0.18 : 0.1) + droop;
    const tipX = fx + dir * Math.cos(ang) * len, tipY = fy + Math.sin(ang) * len;
    const bx1 = fx - Math.sin(ang) * 10 * s * dir, by1 = fy - 10 * s;
    const bx2 = fx + Math.sin(ang) * 3 * s * dir, by2 = fy + 10 * s;
    g.poly([[bx1, by1], [tipX, tipY], [bx2, by2]], { color: P.ink, width: 3.5 * s, fill: P.carrot, seed });
    g.line(lerp(fx, tipX, 0.35), lerp(fy, tipY, 0.35) - 6 * s, lerp(fx, tipX, 0.4), lerp(fy, tipY, 0.4) + 3 * s, { color: '#b85a1c', width: 2.4 * s, seed: seed + 1 });
    g.line(lerp(fx, tipX, 0.62), lerp(fy, tipY, 0.62) - 4 * s, lerp(fx, tipX, 0.66), lerp(fy, tipY, 0.66) + 2 * s, { color: '#b85a1c', width: 2.2 * s, seed: seed + 2 });
  }

  function scarfOn(g, x, y, s, t, wind, seed, sag = 0) {
    const ctx = g.ctx;
    // 绕脖子一圈的部分
    const band = [[-88, -10], [-40, 6], [20, 8], [84, -8], [90, 18], [30, 36], [-36, 34], [-92, 14]].map((p) => [x + p[0] * s, y + p[1] * s]);
    // 垂下来的一截（会被风吹起来）
    const w = clamp(wind);
    const fl = (k) => Math.sin(t * 7 + k * 1.7) * (6 + 18 * w) * s;
    const hx = x + 40 * s, hy = y + 26 * s;
    const ky = 1 - 0.6 * sag; // 融化时尾巴别拖到地底下
    const tail0 = [
      [hx - 6 * s, hy],
      [hx + lerp(0, 90, w) * s + fl(1) * 0.3, hy + lerp(80, 30, w) * s + fl(2) * 0.4],
      [hx + lerp(4, 170, w) * s + fl(3), hy + lerp(150, 46, w) * s + fl(4)],
      [hx + lerp(40, 190, w) * s + fl(3), hy + lerp(146, 82, w) * s + fl(5)],
      [hx + lerp(28, 110, w) * s + fl(2) * 0.4, hy + lerp(70, 60, w) * s + fl(1) * 0.3],
      [hx + 36 * s, hy + 4 * s],
    ];
    const tail = tail0.map((p) => [p[0], hy + (p[1] - hy) * ky]);
    g.curve(tail.concat([tail[0]]), { color: P.ink, width: 4 * s, fill: P.red, seed, closed: true });
    // 流苏
    const end1 = tail[2], end2 = tail[3];
    for (let k = 0; k < 4; k++) {
      const fx = lerp(end1[0], end2[0], k / 3), fy = lerp(end1[1], end2[1], k / 3);
      g.line(fx, fy, fx + lerp(0, 22, w) * s + 3 * s, fy + lerp(18, 8, w) * s, { color: P.redDeep, width: 3 * s, seed: seed + 10 + k });
    }
    g.curve(band, { color: P.ink, width: 4.2 * s, fill: P.red, closed: true, seed: seed + 1 });
    // 针织纹
    for (let k = 0; k < 5; k++) {
      const bx = x + (-62 + k * 30) * s;
      g.line(bx, y + 2 * s, bx + 6 * s, y + 26 * s, { color: P.redDeep, width: 2.6 * s, seed: seed + 20 + k });
    }
    ctx.save();
    ctx.restore();
  }

  /** 帽子（深色小礼帽带红色帽带）。(x,y) 是帽檐中心，rot 弧度 */
  C.hat = function (g, x, y, s = 1, rot = 0, o = {}) {
    const ctx = g.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const seed = o.seed | 0;
    g.ellipse(0, 0, 70 * s, 14 * s, { color: P.ink, width: 4 * s, fill: '#3b3552', seed });
    g.poly([[-46 * s, -4 * s], [-40 * s, -78 * s], [42 * s, -80 * s], [46 * s, -4 * s]], { color: P.ink, width: 4 * s, fill: '#3b3552', seed: seed + 1 });
    g.poly([[-45 * s, -16 * s], [-44 * s, -34 * s], [45 * s, -34 * s], [46 * s, -16 * s]], { color: P.ink, width: 3 * s, fill: P.red, seed: seed + 2 });
    g.line(-30 * s, -70 * s, -28 * s, -42 * s, { color: '#6d6590', width: 3 * s, seed: seed + 3 });
    ctx.restore();
  };

  /** 单独的胡萝卜 */
  C.carrot = function (g, x, y, s = 1, rot = 0, o = {}) {
    const ctx = g.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const seed = o.seed | 0;
    g.poly([[-6 * s, -11 * s], [58 * s, 0], [-6 * s, 11 * s]], { color: P.ink, width: 3.5 * s, fill: P.carrot, seed });
    g.line(16 * s, -7 * s, 18 * s, 4 * s, { color: '#b85a1c', width: 2.4 * s, seed: seed + 1 });
    g.line(34 * s, -4 * s, 35 * s, 3 * s, { color: '#b85a1c', width: 2.2 * s, seed: seed + 2 });
    g.line(-6 * s, -4 * s, -24 * s, -14 * s, { color: P.greenDeep, width: 4 * s, seed: seed + 3 });
    g.line(-6 * s, 2 * s, -26 * s, 4 * s, { color: P.greenDeep, width: 4 * s, seed: seed + 4 });
    ctx.restore();
  };

  /** 掉在地上的红围巾（雪人融化后剩下的） */
  C.scarf = function (g, x, y, s = 1, o = {}) {
    const seed = o.seed | 0;
    const t = o.t == null ? g.info.songTime : o.t;
    const wv = Math.sin(t * 1.5) * 2 * s;
    const pts = [[-120, -8], [-60, -22], [10, -14], [80, -26], [150, -10], [156, 8], [80, -4], [10, 8], [-60, 2], [-122, 12]].map((p, i) => [x + p[0] * s, y + p[1] * s + (i % 2 ? wv : -wv)]);
    g.curve(pts.concat([pts[0]]), { color: P.ink, width: 4 * s, fill: P.red, closed: true, seed });
    for (let k = 0; k < 6; k++) {
      const bx = x + (-96 + k * 40) * s;
      g.line(bx, y - 14 * s, bx + 5 * s, y + 4 * s, { color: P.redDeep, width: 2.4 * s, seed: seed + 5 + k });
    }
    for (let k = 0; k < 4; k++) g.line(x + 150 * s, y + (-6 + k * 5) * s, x + 172 * s, y + (-8 + k * 7) * s, { color: P.redDeep, width: 2.6 * s, seed: seed + 20 + k });
  };

  /** 水滴。(x,y) 是水滴底部圆心 */
  C.drop = function (g, x, y, s = 1, o = {}) {
    const r = 12 * s;
    g.path([[x, y - r * 2.6], [x + r * 0.95, y - r * 0.5], [x + r * 0.7, y + r * 0.7], [x, y + r], [x - r * 0.7, y + r * 0.7], [x - r * 0.95, y - r * 0.5]], {
      smooth: true, closed: true, color: o.color || '#6f97c4', width: 3 * s, fill: o.fill || rgba(P.water, 0.9), seed: o.seed,
    });
    g.line(x - r * 0.35, y - r * 0.2, x - r * 0.4, y + r * 0.35, { color: '#ffffff', width: 2.5 * s, seed: (o.seed | 0) + 1 });
  };

  /**
   * 雪花晶体（六瓣，每瓣有分叉）。progress 0..1 依次画出六瓣。
   * o = {rot, color, width, progress, fill(中心), seed, still}
   */
  C.flake = function (g, cx, cy, r, o = {}) {
    const rot = o.rot || 0, color = o.color || P.ink, w = o.width || Math.max(2, r * 0.05);
    const prog = o.progress == null ? 1 : clamp(o.progress);
    const seed = o.seed | 0;
    for (let k = 0; k < 6; k++) {
      const pk = clamp(prog * 6 - k);
      if (pk <= 0) break;
      const a = rot + (k * Math.PI) / 3;
      const ca = Math.cos(a), sa = Math.sin(a);
      const X = (d, side, br) => cx + ca * d - sa * side * br;
      const Y = (d, side, br) => cy + sa * d + ca * side * br;
      g.line(cx, cy, cx + ca * r, cy + sa * r, { color, width: w, progress: pk, seed: seed + k * 7, still: o.still, jitter: o.jitter });
      [[0.45, 0.28], [0.72, 0.2]].forEach(([d, br], j) => {
        const bp = clamp(pk * 2 - 0.8 - j * 0.3);
        if (bp <= 0) return;
        const bx = cx + ca * r * d, by = cy + sa * r * d;
        for (const side of [-1, 1]) {
          const ang = a + side * 0.75;
          g.line(bx, by, bx + Math.cos(ang) * r * br * 1.3, by + Math.sin(ang) * r * br * 1.3, { color, width: w * 0.8, progress: bp, seed: seed + k * 7 + j * 2 + (side > 0 ? 1 : 0), still: o.still, jitter: o.jitter });
        }
      });
    }
    if (o.fill) g.circle(cx, cy, r * 0.12, { color, width: w * 0.7, fill: o.fill, seed: seed + 99, still: o.still });
  };

  /** 心形。crack 0..1：裂开（两半分开）；o = {fill, color, width, crack, rot, seed, progress} */
  C.heart = function (g, cx, cy, r, o = {}) {
    const ctx = g.ctx;
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(a), 3);
      const y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
      pts.push([x / 17, y / 17]);
    }
    const crack = clamp(o.crack || 0);
    const color = o.color || P.ink, fill = o.fill === undefined ? P.red : o.fill, w = o.width || Math.max(3, r * 0.06);
    const seed = o.seed | 0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(o.rot || 0);
    if (crack <= 0) {
      g.path(pts.map((p) => [p[0] * r, p[1] * r]), { closed: true, smooth: false, color, width: w, fill, seed, progress: o.progress });
    } else {
      // 锯齿裂缝
      const zz = [[0, -0.42], [-0.12, -0.18], [0.1, 0.02], [-0.08, 0.28], [0.05, 0.5], [0, 0.9]];
      const gap = crack * 0.35;
      const half = (side) => {
        const outline = pts.filter((p) => (side < 0 ? p[0] <= 0.001 : p[0] >= -0.001));
        const sorted = side < 0 ? outline : outline;
        const crackPts = side < 0 ? zz.slice().reverse() : zz.slice();
        return sorted.concat(crackPts).map((p) => [p[0] * r + side * gap * r, p[1] * r + Math.abs(side) * crack * 0.1 * r]);
      };
      ctx.save();
      ctx.rotate(-crack * 0.15);
      g.path(half(-1), { closed: true, color, width: w, fill, seed });
      ctx.restore();
      ctx.save();
      ctx.rotate(crack * 0.15);
      g.path(half(1), { closed: true, color, width: w, fill, seed: seed + 1 });
      ctx.restore();
    }
    ctx.restore();
  };

  /** 红色连指手套（"你"的手）。(x,y) 是手腕处中心，rot：0 = 指尖朝上 */
  C.mitten = function (g, x, y, s = 1, rot = 0, o = {}) {
    const ctx = g.ctx;
    const seed = o.seed | 0;
    const col = o.color || P.red;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (o.flip) ctx.scale(-1, 1);
    // 手掌
    g.path([[-46, 0], [-52, -70], [-44, -128], [-10, -158], [26, -150], [44, -112], [46, -60], [42, 0]].map((p) => [p[0] * s, p[1] * s]), { smooth: true, closed: true, color: P.ink, width: 4.5 * s, fill: col, seed });
    // 大拇指
    g.path([[40, -50], [74, -78], [88, -104], [76, -118], [56, -104], [44, -86]].map((p) => [p[0] * s, p[1] * s]), { smooth: true, color: P.ink, width: 4.5 * s, fill: col, seed: seed + 1 });
    // 雪花刺绣
    C.flake(g, -4 * s, -86 * s, 20 * s, { color: '#fff4ee', width: 2.6 * s, seed: seed + 2 });
    // 袖口
    g.path([[-52, 0], [-50, 36], [48, 36], [46, 0]].map((p) => [p[0] * s, p[1] * s]), { closed: true, color: P.ink, width: 4 * s, fill: '#fbf6ef', seed: seed + 3 });
    for (let k = 0; k < 6; k++) g.line((-38 + k * 15) * s, 6 * s, (-38 + k * 15) * s, 30 * s, { color: P.snowShade, width: 2.4 * s, seed: seed + 4 + k });
    ctx.restore();
  };

  /**
   * 暖光窗户。(x,y) 是窗户左上角，w×h 大小。
   * o = {light:0..1, tree:bool, person:0..1（窗里"你"的剪影）, curtains:bool, frost:0..1, glow:bool, t}
   */
  C.window = function (g, x, y, w, h, o = {}) {
    const ctx = g.ctx;
    const light = o.light == null ? 1 : o.light;
    const seed = o.seed | 0;
    const t = o.t == null ? g.info.songTime : o.t;
    if (o.glow !== false && light > 0) g.glow(x + w / 2, y + h / 2, Math.max(w, h) * 1.1, P.warm, 0.35 * light);
    // 窗内
    ctx.save();
    const inner = mix('#3a3350', P.warm, light);
    const inner2 = mix('#2a2540', P.warmDeep, light);
    const gr = ctx.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, inner);
    gr.addColorStop(1, inner2);
    ctx.fillStyle = gr;
    ctx.fillRect(x, y, w, h);
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (o.tree) C.tree(g, x + w * 0.74, y + h * 1.02, Math.min(w, h) / 520, { t, seed: seed + 5 });
    if (o.person) {
      ctx.save();
      ctx.globalAlpha *= clamp(o.person);
      C.person(g, x + w * 0.36, y + h * 1.06, Math.min(w, h) / 420, { color: '#5a3d3a', seed: seed + 6, t });
      ctx.restore();
    }
    if (o.frost) {
      ctx.save();
      ctx.globalAlpha *= clamp(o.frost) * 0.75;
      const fg = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.2, x + w / 2, y + h / 2, Math.max(w, h) * 0.7);
      fg.addColorStop(0, 'rgba(235,242,255,0)');
      fg.addColorStop(1, 'rgba(235,242,255,1)');
      ctx.fillStyle = fg;
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }
    ctx.restore();
    // 窗帘
    if (o.curtains !== false) {
      const cw = w * 0.16;
      g.path([[x, y], [x + cw, y], [x + cw * 0.7, y + h * 0.5], [x + cw * 0.3, y + h * 0.75], [x, y + h * 0.78]], { closed: true, smooth: false, color: P.ink, width: 3.5, fill: '#b9504a', seed: seed + 7 });
      g.path([[x + w, y], [x + w - cw, y], [x + w - cw * 0.7, y + h * 0.5], [x + w - cw * 0.3, y + h * 0.75], [x + w, y + h * 0.78]], { closed: true, smooth: false, color: P.ink, width: 3.5, fill: '#b9504a', seed: seed + 8 });
    }
    // 窗框
    const fw = Math.max(10, w * 0.04);
    g.rect(x, y, w, h, { color: P.ink, width: 5, seed: seed + 9 });
    g.rect(x - fw, y - fw, w + fw * 2, h + fw * 2, { color: P.ink, width: 5, seed: seed + 10 });
    ctx.save();
    ctx.fillStyle = P.wood;
    ctx.beginPath();
    ctx.rect(x - fw, y - fw, w + fw * 2, h + fw * 2);
    ctx.rect(x + w, y, -w, h);
    ctx.fill('evenodd');
    ctx.restore();
    g.line(x + w / 2, y, x + w / 2, y + h, { color: P.ink, width: 6, seed: seed + 11 });
    g.line(x, y + h * 0.48, x + w, y + h * 0.48, { color: P.ink, width: 6, seed: seed + 12 });
    // 窗台积雪
    g.path([[x - fw - 10, y + h + fw], [x - fw, y + h + fw - 22], [x + w * 0.3, y + h + fw - 30], [x + w * 0.7, y + h + fw - 26], [x + w + fw, y + h + fw - 20], [x + w + fw + 12, y + h + fw]], { smooth: true, closed: true, color: P.ink, width: 4, fill: P.snow, seed: seed + 13 });
  };

  /** "你"的剪影（看不见脸）。(x,y) 是脚底中心，s=1 时身高约 400px */
  C.person = function (g, x, y, s = 1, o = {}) {
    const col = o.color || '#4a3436';
    const seed = o.seed | 0;
    const walk = o.walk ? Math.sin((o.t || 0) * 6) * 0.35 : 0;
    // 腿
    g.line(x - 22 * s, y - 150 * s, x - 22 * s + walk * 40 * s, y, { color: col, width: 26 * s, taper: false, seed });
    g.line(x + 22 * s, y - 150 * s, x + 22 * s - walk * 40 * s, y, { color: col, width: 26 * s, taper: false, seed: seed + 1 });
    // 大衣
    g.path([[-62, -150], [-56, -280], [-30, -320], [30, -320], [56, -280], [66, -150], [0, -140]].map((p) => [x + p[0] * s, y + p[1] * s]), { smooth: true, closed: true, color: col, width: 4 * s, fill: col, seed: seed + 2 });
    // 头
    g.circle(x, y - 360 * s, 44 * s, { color: col, width: 4 * s, fill: col, seed: seed + 3 });
    // 头发（短发轮廓）
    g.path([[-46, -362], [-40, -404], [0, -414], [42, -400], [48, -360]].map((p) => [x + p[0] * s, y + p[1] * s]), { smooth: true, color: col, width: 8 * s, fill: col, seed: seed + 4 });
    if (o.scarf) g.curve([[-36, -322], [0, -310], [38, -324]].map((p) => [x + p[0] * s, y + p[1] * s]), { color: P.red, width: 18 * s, seed: seed + 5 });
  };

  /** 圣诞树。(x,y) 是树底部中心，s=1 时高约 520px；o.t 让彩灯闪 */
  C.tree = function (g, x, y, s = 1, o = {}) {
    const seed = o.seed | 0;
    const t = o.t == null ? g.info.songTime : o.t;
    g.rect(x - 22 * s, y - 70 * s, 44 * s, 70 * s, { color: P.ink, width: 4 * s, fill: P.wood, seed });
    const tiers = [[0, 190, 70], [130, 160, 200], [250, 120, 330]];
    tiers.forEach(([dy, hw, top], k) => {
      g.poly([[x - hw * s, y - (60 + dy) * s], [x, y - (60 + top + 130) * s], [x + hw * s, y - (60 + dy) * s]], { color: P.ink, width: 4 * s, fill: P.greenDeep, seed: seed + 1 + k });
    });
    // 彩灯
    const cols = [P.red, P.warm, '#8fd0ff', '#ffffff'];
    for (let k = 0; k < 14; k++) {
      const yy = y - (90 + rand(k, seed, 1) * 380) * s;
      const span = ((y - 60 * s - yy) / (520 * s)) * 1;
      const hw = lerp(190, 0, clamp((y - 60 * s - yy) / (520 * s))) * s * 0.85;
      const xx = x + (rand(k, seed, 2) * 2 - 1) * hw;
      const on = 0.5 + 0.5 * Math.sin(t * 3 + k * 1.9);
      g.glow(xx, yy, 18 * s, cols[k % cols.length], 0.6 * on);
      const ctx = g.ctx;
      ctx.save();
      ctx.fillStyle = cols[k % cols.length];
      ctx.globalAlpha *= 0.5 + 0.5 * on;
      ctx.beginPath();
      ctx.arc(xx, yy, 6 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      void span;
    }
    // 星星
    const sy = y - (60 + 330 + 130) * s;
    star(g, x, sy, 30 * s, { fill: P.sun, seed: seed + 9 });
  };

  function star(g, cx, cy, r, o = {}) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    g.poly(pts, { color: o.color || P.ink, width: o.width || 3.5, fill: o.fill || P.sun, seed: o.seed });
  }
  C.star = star;

  /** 路灯。(x,y) 是底部，s=1 时高约 620px，o.light 0..1 */
  C.lamp = function (g, x, y, s = 1, o = {}) {
    const light = o.light == null ? 1 : o.light;
    const seed = o.seed | 0;
    const top = y - 600 * s;
    if (light > 0) {
      g.glow(x, top + 40 * s, 260 * s, P.warm, 0.45 * light);
      const ctx = g.ctx;
      ctx.save();
      ctx.globalAlpha *= 0.18 * light;
      ctx.fillStyle = P.glow;
      ctx.beginPath();
      ctx.moveTo(x - 30 * s, top + 60 * s);
      ctx.lineTo(x + 30 * s, top + 60 * s);
      ctx.lineTo(x + 230 * s, y);
      ctx.lineTo(x - 230 * s, y);
      ctx.fill();
      ctx.restore();
    }
    g.line(x, y, x, top + 50 * s, { color: P.ink, width: 12 * s, taper: false, seed });
    g.poly([[x - 40 * s, top + 60 * s], [x - 28 * s, top], [x + 28 * s, top], [x + 40 * s, top + 60 * s]], { color: P.ink, width: 4 * s, fill: mix('#4a4560', P.glow, light), seed: seed + 1 });
    g.poly([[x - 48 * s, top + 2 * s], [x, top - 34 * s], [x + 48 * s, top + 2 * s]], { color: P.ink, width: 4 * s, fill: '#3b3552', seed: seed + 2 });
    g.path([[x - 50 * s, top + 2 * s], [x - 20 * s, top - 22 * s], [x + 22 * s, top - 22 * s], [x + 52 * s, top + 4 * s]], { smooth: true, color: P.ink, width: 3 * s, fill: P.snow, seed: seed + 3 });
  };

  /** 月亮。o.phase：0 = 满月，越大越弯（0.5 左右是漂亮的弯月）。不依赖背景色 */
  C.moon = function (g, x, y, r, o = {}) {
    const ctx = g.ctx;
    const ph = clamp(o.phase || 0);
    g.glow(x, y, r * 3, '#e8eeff', 0.22);
    ctx.save();
    if (ph > 0) {
      const bx = x + r * lerp(1.9, 0.55, ph), by = y - r * 0.22, br = r * 0.96;
      ctx.beginPath();
      ctx.rect(x - r * 4, y - r * 4, r * 8, r * 8);
      ctx.moveTo(bx + br, by);
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.clip('evenodd');
    }
    g.circle(x, y, r, { color: '#e9e4cf', width: 3, fill: '#fbf6dc', seed: o.seed });
    ctx.restore();
  };

  /**
   * 门。(x,y) 是左上角，w×h；o = {open 0..1, light, wreath, seed, color}
   * 开门时门缝里透出暖光。
   */
  C.door = function (g, x, y, w, h, o = {}) {
    const ctx = g.ctx;
    const open = clamp(o.open || 0);
    const seed = o.seed | 0;
    const col = o.color || '#7c3f36';
    // 门框
    g.rect(x - 16, y - 16, w + 32, h + 16, { color: P.ink, width: 5, fill: '#4b3a3a', seed });
    // 门后的光
    ctx.save();
    ctx.fillStyle = P.warm;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    if (open > 0) g.glow(x + w / 2, y + h * 0.7, w * (1 + open), P.warm, 0.5 * open);
    // 门板（透视收窄）
    const dw = w * (1 - open * 0.82);
    const skew = open * 26;
    g.poly([[x, y], [x + dw, y + skew], [x + dw, y + h - skew * 0.5], [x, y + h]], { color: P.ink, width: 5, fill: col, seed: seed + 1 });
    if (dw > w * 0.35) {
      g.rect(x + dw * 0.14, y + h * 0.08 + skew * 0.3, dw * 0.72, h * 0.36, { color: rgba(P.ink, 0.7), width: 3.5, seed: seed + 2 });
      g.rect(x + dw * 0.14, y + h * 0.52, dw * 0.72, h * 0.36, { color: rgba(P.ink, 0.7), width: 3.5, seed: seed + 3 });
      g.circle(x + dw * 0.86, y + h * 0.52, 9, { color: P.ink, width: 3, fill: P.sun, seed: seed + 4 });
      if (o.wreath !== false) {
        const wx = x + dw * 0.5, wy = y + h * 0.25;
        const R = Math.min(dw, h) * 0.17;
        g.circle(wx, wy, R, { color: P.greenDeep, width: R * 0.42, seed: seed + 5 });
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + 0.3;
          C.dot(g, wx + Math.cos(a) * R, wy + Math.sin(a) * R, R * 0.12, P.red, seed + 6 + k);
        }
        g.poly([[wx - R * 0.35, wy + R * 0.8], [wx, wy + R * 1.05], [wx + R * 0.35, wy + R * 0.8], [wx + R * 0.3, wy + R * 1.4], [wx, wy + R * 1.08], [wx - R * 0.3, wy + R * 1.4]], { color: P.ink, width: 3, fill: P.red, seed: seed + 13 });
      }
    }
    // 门前台阶的雪
    g.path([[x - 40, y + h + 4], [x - 26, y + h - 14], [x + w * 0.4, y + h - 18], [x + w + 30, y + h - 12], [x + w + 46, y + h + 4]], { smooth: true, closed: true, color: P.ink, width: 4, fill: P.snow, seed: seed + 14 });
  };

  /** 呼出的白气。(x,y) 是嘴的位置，t 时间，dir 方向（1 向右） */
  C.breath = function (g, x, y, t, o = {}) {
    const dir = o.dir || 1, s = o.s || 1;
    const ctx = g.ctx;
    for (let k = 0; k < 3; k++) {
      const ph = ((t * 0.6 + k / 3) % 1 + 1) % 1;
      const r = lerp(10, 46, ph) * s;
      ctx.save();
      ctx.globalAlpha *= (1 - ph) * 0.8;
      g.circle(x + dir * lerp(10, 120, ph) * s, y - lerp(0, 40, ph) * s, r, { color: 'rgba(255,255,255,0.9)', width: 3 * s, fill: 'rgba(255,255,255,0.55)', seed: (o.seed | 0) + k });
      ctx.restore();
    }
  };

  /** 地面积雪带：从 y 往下全是雪，表面起伏。o = {color, line, seed, amp} */
  C.ground = function (g, y, o = {}) {
    const pts = [[-40, TG.H + 40]];
    const amp = o.amp == null ? 18 : o.amp;
    for (let x = -40; x <= TG.W + 40; x += 120) pts.push([x, y + noise1(x / 300, (o.seed | 0) + 3) * amp]);
    pts.push([TG.W + 40, TG.H + 40]);
    g.path(pts, { closed: true, smooth: true, color: o.line || P.ink, width: o.width || 4.5, fill: o.color || P.snow, seed: o.seed, overshoot: false });
  };
})();
