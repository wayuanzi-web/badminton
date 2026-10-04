// 產生連結預覽圖 og.png（1200×630），貼連結到 LINE 等地方時顯示的那張圖。
// 需要 playwright 和一套繁體中文字型：NODE_PATH=<含 playwright 的 node_modules> node build/og.cjs
// 輸出到 repo 根目錄的 og.png。
const { chromium } = require('playwright');
const path = require('node:path');

const html = `<!doctype html><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;position:relative;overflow:hidden;background:#0e7257;color:#fff;
  font-family:"Noto Sans CJK TC","Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif}
.lines{position:absolute;inset:0}
.txt{position:absolute;left:84px;top:132px}
h1{font-size:108px;font-weight:900;line-height:1.1;letter-spacing:.02em}
p{margin-top:30px;font-size:32px;font-weight:500;color:rgba(255,255,255,.92)}
.bar{position:absolute;left:0;right:0;top:468px;height:16px;background:#f5c518}
.foot{position:absolute;left:84px;top:522px;font-size:32px;font-weight:700}
.ic{position:absolute;right:28px;top:44px;width:390px;height:390px}
</style>
<svg class="lines" viewBox="0 0 1200 630" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="6">
  <path d="M36 0v630M1164 0v630M0 72h1200M600 72v396M0 284h1200"/>
</svg>
<div class="txt"><h1>羽球訓練手冊</h1><p>12 週計畫、每日課表、訓練菜單、計時與計分</p></div>
<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">
  <g transform="rotate(32 12 11.2)">
    <path d="M9.3 16 6 5.6M14.7 16 18 5.6M12 16V4.4M6 5.6c2-1.1 4-1.7 6-1.7s4 .6 6 1.7M7.5 10.4c1.5-.7 3-1 4.5-1s3 .3 4.5 1"/>
    <path d="M8.6 16h6.8v1.7a3.4 3.4 0 0 1-6.8 0z" fill="#fff"/>
  </g>
</svg>
<div class="bar"></div>
<div class="foot">不用註冊，手機點開就能用</div>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const out = path.join(__dirname, '..', 'og.png');
  await page.screenshot({ path: out, type: 'png' });
  await browser.close();
  console.log('已產生', out);
})();
