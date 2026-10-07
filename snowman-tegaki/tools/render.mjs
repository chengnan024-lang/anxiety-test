#!/usr/bin/env node
/*
 * 逐帧导出视频（需要 Node.js + Playwright + ffmpeg）。比浏览器里"录制视频"更稳、画质更好。
 *
 *   node tools/render.mjs --audio 雪人.mp3 --out 雪人手书.mp4
 *   node tools/render.mjs --audio 雪人.mp3 --lrc 雪人.lrc --timeline snowman-timeline.json --out 雪人手书.mp4
 *   node tools/render.mjs --dur 270 --width 960 --out preview.mp4        # 没有音乐，只出画面
 *
 * 参数：
 *   --audio     音乐文件（决定视频时长，并混进视频里）
 *   --lrc       LRC 歌词
 *   --timeline  页面里"导出时间轴"得到的 snowman-timeline.json（你的对拍结果）
 *   --dur       没有音乐时的时长（秒），默认 270
 *   --from/--to 只导出一段（秒）
 *   --width     输出宽度，默认 1920（高度按 16:9）
 *   --fps       动画帧率，默认 12（视频本身按 24fps 封装）
 */
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const a = process.argv.slice(2);
const get = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const audio = get('audio');
const lrc = get('lrc');
const timeline = get('timeline');
const out = path.resolve(get('out', 'snowman-tegaki.mp4'));
const fps = +get('fps', 12);
const width = Math.round(+get('width', 1920) / 2) * 2;
const height = Math.round((width * 9) / 16 / 2) * 2;

let duration = +get('dur', 270);
if (audio) {
  try {
    duration = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', audio]).toString());
  } catch (e) {
    console.error('读不到音乐时长（需要 ffprobe）：', e.message);
    process.exit(1);
  }
}
const from = +get('from', 0);
const to = Math.min(duration, +get('to', duration));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(pathToFileURL(path.join(root, 'index.html')).href + `?noauto=1&nostart=1&hud=0&dur=${duration}`);
await page.waitForFunction(() => window.TG && window.TG.isReady, null, { timeout: 30000 });
if (lrc) await page.evaluate((t) => TG.loadLyricsText(t, 'lrc'), fs.readFileSync(lrc, 'utf8'));
if (timeline) await page.evaluate((t) => TG.importTimeline(t), fs.readFileSync(timeline, 'utf8'));
// 每一幕先画一帧，把用到的字体都触发加载
await page.evaluate(() => TG.starts().forEach((s, i, arr) => TG.renderAt(s + 0.5)));
await page.evaluate(() => document.fonts && document.fonts.ready);
await page.waitForTimeout(800);

const ffArgs = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-'];
if (audio) ffArgs.push('-ss', String(from), '-t', String(to - from), '-i', audio);
ffArgs.push('-vf', `fps=24,format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-movflags', '+faststart');
if (audio) ffArgs.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
ffArgs.push(out);
const ff = spawn('ffmpeg', ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] });

const total = Math.ceil((to - from) * fps);
const t0 = Date.now();
for (let k = 0; k < total; k++) {
  const T = from + k / fps;
  const b64 = await page.evaluate(([T, w, h]) => {
    TG.renderAt(T);
    const src = TG.canvas();
    let c = src;
    if (w !== src.width) {
      c = window.__scaled || (window.__scaled = document.createElement('canvas'));
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(src, 0, 0, w, h);
    }
    return c.toDataURL('image/jpeg', 0.93).split(',')[1];
  }, [T, width, height]);
  if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
  if (k % (fps * 10) === 0) {
    const el = (Date.now() - t0) / 1000;
    process.stdout.write(`\r  ${Math.round((k / total) * 100)}%  ${T.toFixed(1)}s / ${to.toFixed(1)}s  （已用 ${el.toFixed(0)} 秒）   `);
  }
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await browser.close();
console.log(`\n完成：${out}`);
if (errors.length) console.error('页面报错：\n' + [...new Set(errors)].join('\n'));
