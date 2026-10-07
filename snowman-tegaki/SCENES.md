# 写场景（开发者文档）

每一幕是 `scenes/NN-id.js` 里的一个文件，只做一件事：调用 `TG.scene({...})` 注册自己。
顺序和默认时长在 `js/timeline.js`，共享角色在 `js/characters.js`，引擎在 `js/engine.js`。

## 模板

```js
/* 场景：cold —— 冷 */
(function () {
  'use strict';
  const { clamp, lerp, seg, ease, rand, noise1, mix, rgba } = TG.U;
  const P = TG.PAL, C = TG.C, W = TG.W, H = TG.H;

  TG.scene({
    id: 'cold',
    title: '冷',
    dark: true,              // 夜景：默认背景/歌词配色用深色方案
    transition: 'flash',     // 从上一幕切进来的方式：cut | fade | flash | wipe | black | iris
    chars: '零下度',          // 画面里会写到的所有汉字（用于预加载手写字体）
    lyrics: 'default',       // 'default'（画在底部）| 'none'（自己画：g.lyric(info.lyric, {...})）| 样式对象 {x, y, size, color, ...}
    draw(g, p, t, info) {
      // p: 本幕进度 0..1；t: 本幕已经过的秒数；info: 见下
      g.bg([P.nightDeep, P.night]);
      g.snow({ count: 140 });
      C.snowman(g, W / 2, 900, 0.6, { mood: 'sad', shiver: 0.5 });
    },
  });
})();
```

## 规则

1. **纯函数**：画面只能由 `p / t / info` 决定。不能用 `Math.random()`、`Date`、全局变量记状态 ——
   要随机就用 `rand(i, seed)`（确定性）。这样拖进度条、打点、导出视频时每一帧都对得上。
2. 画布永远是 **1920×1080**，原点左上角。改了 `ctx` 的变换 / 透明度要自己 `save()` / `restore()`。
3. 每一幕持续 15～30 秒，要拆成 **3～6 个小镜头**（`seg(p, a, b)` 分段），并且画面一直有东西在动。
   需要固定节奏（比如每秒切一次）就用 `t` 或 `info.songTime`。
4. 歌词默认会写在画面底部（y≈990）。底部 160px 别放关键内容，或者用 `lyrics` 把歌词挪到合适的位置。
5. **画面里不写歌曲歌词**，只写原创短句 / 数字 / 日期。
6. 单帧渲染平均 < 60ms（`tools/snap.mjs` 会打印）。动画按 12fps 播放。
7. 只改你自己的场景文件。要用的小工具函数写在自己文件里的 IIFE 内。

## `info`

| 字段 | 含义 |
|---|---|
| `p`, `t`, `dur` | 本幕进度、已过秒数、本幕总时长 |
| `songTime`, `duration` | 整首歌的当前时间 / 总时长 |
| `boil`, `frame` | 当前动画帧序号（每 1/12 秒 +1） |
| `bpm`, `beat`, `beatPhase`, `pulse` | 用户敲了拍子才有值；`pulse` 在每拍开头为 1，然后衰减到 0 |
| `lyric` | 当前歌词 `{text, t0, t1, p}` 或 `null` |
| `prev`, `next`, `index` | 前后场景 id、序号 |

## 绘图工具包 `g`

线条都是"手绘"的：会抖、起收笔变细，每帧重新抖一次（boil）。通用参数 `o`：

| 参数 | 默认 | 说明 |
|---|---|---|
| `color` | `P.ink` | 线条颜色 |
| `width` | 4.5 | 线宽 |
| `jitter` | 1.7 | 抖动幅度（px），0 就是不抖 |
| `fill` | – | 填充色（会和线条略微错位，像手工上色） |
| `progress` | 1 | 0..1，线条"一笔画出来"的进度 |
| `alpha` | 1 | 透明度 |
| `still` | false | true = 不随帧抖动（固定形状） |
| `seed` | 0 | 换个数字就换一种抖法 |
| `taper` | true | 起笔收笔变细 |
| `double` | false | 再描一遍（铅笔重描的感觉） |

- `g.line(x1, y1, x2, y2, o)`
- `g.path(pts, o)` —— `o.closed` 闭合，`o.smooth` 平滑；`g.curve(pts, o)` = 平滑曲线；`g.poly(pts, o)` = 闭合多边形
- `g.ellipse(cx, cy, rx, ry, o)` / `g.circle(cx, cy, r, o)` —— 一笔画的圈，首尾会交叠一点；`o.rot` 旋转
- `g.arc(cx, cy, r, a0, a1, o)`
- `g.rect(x, y, w, h, o)` —— `o.sketch: true` 是四条出头的速写线
- `g.fill(pts, color, o)` —— 只上色；`g.hatch(pts, {angle, gap, width, color, alpha})` —— 排线阴影
- `g.text(str, x, y, o)` —— 手写字。`size`、`font`（`hand` 手写 | `brush` 毛笔 | `round` 圆体 | `latin` 英文手写）、
  `align`、`color`、`progress`（逐字出现）、`stroke` + `strokeWidth`（描边）、`shadow: {color, dx, dy}`、`vertical`（竖排）、
  `rot`、`spacing`、`wobble`、`alpha`、`pop`（新字弹出，默认开）。支持 `\n` 换行。
  横排时 (x, y) 是文字块的对齐点、垂直居中；竖排时 (x, y) 是第一列第一个字的顶部中心，列从右往左排。
- `g.lyric(info.lyric, o)` —— 手动画歌词（参数同 `text`，加 `dark`）
- `g.snow({t, count, seed, speed:[min,max], size:[min,max], wind, sway, color, alpha, area:[x,y,w,h], crystal})` —— 无状态的下雪
- `g.bg(color | [上, 中, 下])` —— 铺底色 / 渐变；`g.vignette(a)` —— 暗角；`g.glow(x, y, r, color, a)` —— 柔光
- `g.camera(cx, cy, zoom, rot, dx, dy)` —— 镜头（先 `g.save()`，画完 `g.restore()`）；`g.shake(px)` —— 返回手持晃动偏移 `[dx, dy]`
- `g.ctx` —— 原生 Canvas 2D 上下文，什么都能画

## 共享角色 `TG.C`

- `C.snowman(g, x, y, s, o)` —— **雪人（"我"）**。(x, y) 是脚底，s=1 时高约 440px。
  `o`：`mood`（calm / sad / happy / hope）、`melt` 0..1、`look` -1..1、`lookUp` 0..1、`arms: [左, 右]`（抬起的弧度）、
  `wind` 0..1、`blush` 0..1、`tear` 0..1、`eyesClosed`、`shiver` 0..1、`snowCap` 0..1、`scarf`、`hat`、`seed`
- `C.person(g, x, y, s, {color, scarf, walk, t})` —— **"你"的剪影**（看不到脸），s=1 高约 410px
- `C.mitten(g, x, y, s, rot, {color, flip})` —— **红手套**（"你"的手），(x, y) 是手腕，rot=0 指尖朝上
- `C.window(g, x, y, w, h, {light, tree, person, frost, curtains, glow})` —— 暖光窗
- `C.door(g, x, y, w, h, {open, wreath, color})` —— 门（开门会透光）
- `C.tree(g, x, y, s)` · `C.lamp(g, x, y, s, {light})` · `C.moon(g, x, y, r, {phase})` · `C.star(g, x, y, r, o)`
- `C.flake(g, cx, cy, r, {rot, color, width, progress, fill})` —— 六瓣雪花，`progress` 一瓣一瓣画出
- `C.heart(g, cx, cy, r, {fill, crack, rot})` —— 心，`crack` 0..1 裂开
- `C.drop(g, x, y, s)` —— 水滴 · `C.breath(g, x, y, t, {dir, s})` —— 白气
- `C.hat(g, x, y, s, rot)` · `C.carrot(g, x, y, s, rot)` · `C.scarf(g, x, y, s)` —— 掉在地上的帽子 / 胡萝卜 / 围巾
- `C.ground(g, y, {color, amp, seed})` —— 从 y 往下的雪地
- `C.dot(g, x, y, r, color, seed)` —— 煤球一样的圆点

## 自查

```bash
node tools/snap.mjs cold --p 0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1 --out /tmp/shots   # 拼成一张缩略图
node tools/snap.mjs cold --p 0.35 --single --out /tmp/shots                            # 1920×1080 单帧
node tools/snap.mjs cold --lyrics ...                                                  # 带示例歌词，检查歌词有没有被挡住
```

脚本会打印每帧平均渲染耗时，场景报错时以非零状态退出。
