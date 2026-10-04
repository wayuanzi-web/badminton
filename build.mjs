// 把 src/ 的原始檔組成兩個版本：
//   out/site/        可獨立使用的網頁 App（index.html、manifest.webmanifest、sw.js、_headers）
//   out/artifact/    發布成 Claude Artifact 用的片段
// 上線：node build.mjs --site .   把網頁 App 複製到 repo 根目錄，GitHub Pages 從那裡發布
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const TITLE = '羽球訓練手冊';
const SHORT = '羽球手冊';              // 手機主畫面圖示下方的名字，太長會被截斷
const DESC = '羽球 12 週訓練計畫、日常菜單、規則與技術知識、計時與計分工具。資料只存在你的裝置。';

/* 1. 資料檢查 */
const dataFiles = ['src/data-ex.js', 'src/data-plan.js', 'src/data-learn.js', 'src/logic.js'];
const ctx = vm.createContext({ console });
dataFiles.forEach(f => vm.runInContext(rd(f), ctx, { filename: f }));
const errs = vm.runInContext('validateData()', ctx);
if (errs.length) { console.error('資料檢查失敗：\n' + [...errs].join('\n')); process.exit(1); }

/* 2. 字型（數字用的窄體，內嵌後離線也能用） */
const face = w => '@font-face{font-family:"Barlow Condensed";font-style:normal;font-weight:' + w + ';font-display:swap;src:url(data:font/woff2;base64,' +
  fs.readFileSync(path.join(root, 'build/fonts/bc-' + w + '.woff2')).toString('base64') + ') format("woff2")}';
const css = '/* 數字字型：Barlow Condensed（子集），© The Barlow Project Authors，SIL Open Font License 1.1 */\n' + face(600) + '\n' + face(700) + '\n' + rd('src/styles.css');

/* 3. 程式 */
const jsFiles = [...dataFiles, 'src/app-core.js', 'src/app-views.js', 'src/app-tools.js', 'src/app-main.js'];
const js = standalone => '(function(){\n"use strict";\nconst STANDALONE = ' + standalone + ';\n' + jsFiles.map(f => rd(f)).join('\n') + '\n})();';
for (const bad of ['</script', '<!--']) if (js(false).includes(bad)) { console.error('程式中不可出現 ' + bad); process.exit(1); }
try { new vm.Script(js(false), { filename: 'bundle.js' }); new vm.Script(js(true), { filename: 'bundle.js' }); }
catch (e) { console.error('程式語法檢查失敗：' + e.message); process.exit(1); }
const body = rd('src/body.html');

/* 4. Artifact 版（不含 doctype/html/head/body，發布時會自動包起來） */
const artifact = '<title>' + TITLE + '</title>\n<style>\n' + css + '\n</style>\n' + body + '\n<script>\n' + js(false) + '\n</script>\n';
fs.mkdirSync(path.join(root, 'out/artifact'), { recursive: true });
fs.writeFileSync(path.join(root, 'out/artifact/badminton-handbook.html'), artifact);

/* 5. 獨立版 */
const iconSvg = rd('src/icon.svg');
const favicon = 'data:image/svg+xml,' + encodeURIComponent(iconSvg.replace(/\s+/g, ' '));
const reset = ':root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}img{max-width:100%}[hidden]{display:none!important}';
const site = '<!doctype html>\n<html lang="zh-Hant-TW">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
  '<title>' + TITLE + '</title>\n<meta name="description" content="' + DESC + '">\n' +
  '<meta name="theme-color" content="#f2f5f1" media="(prefers-color-scheme: light)">\n<meta name="theme-color" content="#0d1411" media="(prefers-color-scheme: dark)">\n' +
  '<meta name="robots" content="noindex">\n' +                    // 自己用的工具，不需要被搜尋引擎收錄
  '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="' + SHORT + '">\n' +
  '<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="' + favicon + '">\n<link rel="apple-touch-icon" href="apple-touch-icon.png">\n' +
  '<style>' + reset + '</style>\n<style>\n' + css + '\n</style>\n</head>\n<body>\n' + body + '\n<script>\n' + js(true) + '\n</script>\n</body>\n</html>\n';
const siteDir = path.join(root, 'out/site');
fs.mkdirSync(siteDir, { recursive: true });
fs.writeFileSync(path.join(siteDir, 'index.html'), site);

const manifest = {
  name: TITLE, short_name: SHORT, description: DESC, lang: 'zh-Hant-TW',
  start_url: './', scope: './', display: 'standalone', orientation: 'portrait',
  background_color: '#f2f5f1', theme_color: '#0e7257',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
};
fs.writeFileSync(path.join(siteDir, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));

/* 離線快取：先用快取開啟（球館訊號差也不會卡住），同時在背景抓新版，下次開啟就是新的。
   版本取自內容的雜湊：內容一變，sw.js 就跟著變，瀏覽器會重新安裝並換掉舊快取 */
const iconFiles = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
const at = process.argv.indexOf('--site');
const dest = at > -1 && process.argv[at + 1] ? path.resolve(process.argv[at + 1]) : null;      // 另外要更新的上線資料夾
const h = crypto.createHash('sha256').update(site).update(JSON.stringify(manifest));
iconFiles.forEach(f => { const fp = [siteDir, dest].filter(Boolean).map(d => path.join(d, f)).find(x => fs.existsSync(x)); if (fp) h.update(fs.readFileSync(fp)); });
const ver = h.digest('hex').slice(0, 12);
const sw = `/* 羽球訓練手冊：離線快取 */
const PREFIX = 'badminton-handbook-';
const CACHE = PREFIX + '${ver}';
const SHELL = './';
const FILES = ['manifest.webmanifest', ${iconFiles.map(f => "'" + f + "'").join(', ')}];
const scope = self.registration.scope;                 // 這個 App 所在的資料夾網址，結尾是 /

/* 有些主機會把 index.html 轉址到資料夾網址。帶著「轉址過」標記的回應不能拿來回應頁面導覽，存進快取前重包一次 */
const clean = res => !res.redirected ? Promise.resolve(res) : res.blob().then(b => {
  const h = new Headers(res.headers);
  h.delete('content-encoding'); h.delete('content-length');      // 內容已經解壓過，這兩個標頭不再適用
  return new Response(b, { status: res.status, statusText: res.statusText, headers: h });
});
const store = (c, key, res) => clean(res).then(r => c.put(key, r));

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all([SHELL].concat(FILES).map(u => fetch(new Request(u, { cache: 'reload' })).then(res => {
      if (!res.ok) throw new Error(u + ' ' + res.status);
      return store(c, u, res);
    }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  /* 只清這個 App 自己的舊快取；同一個網域上如果還有別的 App，它們的快取不能動 */
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(scope)) return;
  const file = req.url.slice(scope.length).split(/[?#]/)[0];
  const shell = file === '' || file === 'index.html';
  if (!shell && !FILES.includes(file)) return;         // 不是這個 App 的檔案：交還給瀏覽器
  const key = shell ? SHELL : file;
  e.respondWith(caches.open(CACHE).then(c => c.match(key).then(hit => {
    if (hit) {
      /* 先回快取，背景更新 */
      e.waitUntil(fetch(new Request(key, { cache: 'no-cache' })).then(res => (res.ok ? store(c, key, res) : null)).catch(() => {}));
      return hit;
    }
    return fetch(req).then(res => {
      if (res.ok && res.type === 'basic') store(c, key, res.clone()).catch(() => {});
      return res;
    });
  })));
});
`;
fs.writeFileSync(path.join(siteDir, 'sw.js'), sw);

/* 安全標頭：Cloudflare（Workers、Pages）會讀 _headers 這個檔案，其他主機會忽略它。
   頁面只能載入和連線到自己的網址，不能被別的網站嵌入，連出去的連結也不帶來源網址 */
const headers = `/*
  Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; font-src data:; manifest-src 'self'; worker-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
`;
fs.writeFileSync(path.join(siteDir, '_headers'), headers);

/* 加上 --site <資料夾>：把剛產生的網頁 App 也複製到那個資料夾。這個 repo 用 GitHub Pages 從根目錄發布，
   所以平常是 node build.mjs --site .（圖示是固定檔案，不會動；_headers 只有 Cloudflare 會讀，留在 out/site） */
if (dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const f of ['index.html', 'manifest.webmanifest', 'sw.js']) fs.copyFileSync(path.join(siteDir, f), path.join(dest, f));
  console.log('已複製到', dest);
}

const kb = s => (Buffer.byteLength(s) / 1024).toFixed(0) + ' KB';
console.log('artifact', kb(artifact), '| site/index.html', kb(site), '| sw', ver);
