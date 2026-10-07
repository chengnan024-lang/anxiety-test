/* 雪人 · 手书 —— 分镜时间轴
 *
 * at：没有打点、没有歌词时，场景开始于整首歌的百分之几。
 * section：导入 LRC 歌词后用来自动对齐（前奏 / 第一段 / 间奏 / 第二段 / 尾声）。
 * 想要精确对拍：播放时按 K 打点（见 README）。
 */
TG.timeline([
  { id: 'intro',     section: 'intro',     at: 0.000 }, // 前奏 · 初雪
  { id: 'cold',      section: 'verse1',    at: 0.070 }, // 冷
  { id: 'christmas', section: 'verse1',    at: 0.128 }, // 窗
  { id: 'waiting',   section: 'verse1',    at: 0.186 }, // 等
  { id: 'pieces',    section: 'verse1',    at: 0.244 }, // 一片一片
  { id: 'touch',     section: 'verse1',    at: 0.302 }, // 心疼
  { id: 'sky',       section: 'verse1',    at: 0.360 }, // 缤纷
  { id: 'spring',    section: 'verse1',    at: 0.418 }, // 春天要来了
  { id: 'memory',    section: 'interlude', at: 0.476 }, // 间奏 · 回忆
  { id: 'doorstep',  section: 'verse2',    at: 0.556 }, // 门前
  { id: 'dream',     section: 'verse2',    at: 0.630 }, // 梦
  { id: 'flash',     section: 'verse2',    at: 0.704, w: 1.4 }, // 高潮
  { id: 'melt',      section: 'verse2',    at: 0.810, w: 1.2 }, // 融
  { id: 'fin',       section: 'outro',     at: 0.920 }, // 尾声
]);
