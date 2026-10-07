#!/usr/bin/env node
/*
 * 场景截图工具（开发用）
 *
 *   node tools/snap.mjs <sceneId> [--p 0,0.25,0.5,0.75,1] [--out dir] [--single] [--lyrics]
 *   node tools/snap.mjs --page test.html <sceneId> ...   # 用别的页面（比如角色测试页）
 *
 * 默认把多个进度拼成一张缩略图 <out>/<sceneId>-sheet.png；
 * --single 时每个进度单独输出一张 1920×1080 的 <out>/<sceneId>-p0.50.png。
 * 场景里的报错会打印出来，并以非零退出码结束。
 */
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = process.argv.slice(2);
const opt = { p: '0,0.2,0.4,0.6,0.8,1', out: path.join(root, 'tools', 'shots'), single: false, page: 'index.html', lyrics: false };
const ids = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--p') opt.p = args[++i];
  else if (a === '--out') opt.out = path.resolve(args[++i]);
  else if (a === '--single') opt.single = true;
  else if (a === '--page') opt.page = args[++i];
  else if (a === '--lyrics') opt.lyrics = true;
  else ids.push(a);
}
if (!ids.length) { console.error('用法: node tools/snap.mjs <sceneId> [--p 0,0.5,1] [--single]'); process.exit(2); }
fs.mkdirSync(opt.out, { recursive: true });
const ps = opt.p.split(',').map(Number);

const exe = fs.existsSync('/opt/pw-browsers/chromium') ? undefined : undefined;
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const url = pathToFileURL(path.join(root, opt.page)).href + `?noauto=1&nostart=1&hud=0${opt.lyrics ? '&demoLyrics=1' : ''}`;
await page.goto(url);
await page.waitForFunction(() => window.TG && window.TG.isReady, null, { timeout: 30000 });
// 先画一遍触发字体加载，再等字体
for (const id of ids) await page.evaluate(([id, ps]) => ps.forEach((p) => TG.renderScene(id, p, { transition: false })), [id, ps]);
await page.evaluate(() => document.fonts && document.fonts.ready);
await page.waitForTimeout(400);

for (const id of ids) {
  if (opt.single) {
    for (const p of ps) {
      const data = await page.evaluate(([id, p]) => { TG.renderScene(id, p, { transition: false }); return TG.canvas().toDataURL('image/png'); }, [id, p]);
      const f = path.join(opt.out, `${id}-p${p.toFixed(2)}.png`);
      fs.writeFileSync(f, Buffer.from(data.split(',')[1], 'base64'));
      console.log(f);
    }
  } else {
    const data = await page.evaluate(([id, ps]) => TG.contactSheet(id, ps), [id, ps]);
    const f = path.join(opt.out, `${id}-sheet.png`);
    fs.writeFileSync(f, Buffer.from(data.split(',')[1], 'base64'));
    console.log(f);
  }
}
// 性能：渲染 24 帧的平均耗时
const perf = await page.evaluate((ids) => {
  const out = {};
  for (const id of ids) {
    const t0 = performance.now();
    for (let k = 0; k < 24; k++) TG.renderScene(id, k / 23, { transition: false });
    out[id] = +((performance.now() - t0) / 24).toFixed(1);
  }
  return out;
}, ids);
console.log('平均每帧渲染耗时(ms):', JSON.stringify(perf));
await browser.close();
if (errors.length) {
  console.error('\n页面报错：\n' + [...new Set(errors)].join('\n'));
  process.exit(1);
}
