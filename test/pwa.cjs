// 手機 App（PWA）行為測試：可安裝性、離線、訊號很差、部署新版後的更新、同網域其他快取、放在子資料夾、安裝入口
// 執行：NODE_PATH=<含 playwright 的 node_modules> node test/pwa.cjs
//   自帶一個測試主機，模擬 Cloudflare 這類會把 index.html 轉址到資料夾網址的靜態主機。
//   後面加網址（例如 wrangler dev 的 http://localhost:8787/），會另外對那個真正的主機跑基本檢查。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const SITE = path.join(__dirname, '..', 'out', 'site');
const KEY = 'badminton-handbook-v1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json' };

/* 上一版的 sw.js（先連網路、失敗才用快取，而且會清掉網域上所有其他快取）。用來測「舊版換新版」 */
const OLD_SW = `const CACHE = 'badminton-handbook-v20261004-290769';
const ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(res => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
    .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
`;

/* 做出幾個「版本」的網站資料夾：頁面上帶一個看得到的版本記號 */
function makeVersion(tmp, name, o) {
  const dir = path.join(tmp, name); fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(SITE)) fs.copyFileSync(path.join(SITE, f), path.join(dir, f));
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8').replace('<body>', '<body data-ver="' + (o.page || name) + '">');
  assert.ok(html.includes('data-ver='), '找不到 <body>');
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  if (o.oldSw) fs.writeFileSync(path.join(dir, 'sw.js'), OLD_SW);
  else if (o.sw) {
    const sw = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8').replace(/const CACHE = PREFIX \+ '[0-9a-f]+';/, "const CACHE = PREFIX + '" + o.sw + "';");
    assert.ok(sw.includes("PREFIX + '" + o.sw + "'"), 'sw.js 版本字串格式變了');
    fs.writeFileSync(path.join(dir, 'sw.js'), sw);
  }
  return dir;
}

/* 測試主機：可以切換版本、變慢、斷線；index.html 會被轉址；有 ETag */
function makeHost(st) {
  let hits = 0;
  const srv = http.createServer((req, res) => {
    if (st.down) { req.socket.destroy(); return; }
    setTimeout(() => {
      if (st.down) { req.socket.destroy(); return; }
      const u = new URL(req.url, 'http://x');
      const p = decodeURIComponent(u.pathname);
      st.log.push(req.method + ' ' + p);
      if (p.startsWith(st.other)) {                              // 同一個網域上「別的 App」的路徑：每次回應都不一樣
        res.writeHead(200, { 'Content-Type': p.endsWith('.json') ? TYPES['.json'] : TYPES['.html'], 'Cache-Control': 'no-store' });
        res.end(p.endsWith('.json') ? JSON.stringify({ n: ++hits }) : '<!doctype html><title>other</title><p id="n">' + (++hits) + '</p>');
        return;
      }
      if (!p.startsWith(st.base)) { res.writeHead(404); res.end('not found'); return; }
      let rel = p.slice(st.base.length);
      if (st.rootToIndex) {                                        // 另一種主機：把資料夾網址轉到 index.html
        if (rel === '') { res.writeHead(302, { Location: st.base + 'index.html' + u.search }); res.end(); return; }
      } else {
        if (rel === 'index.html') { res.writeHead(307, { Location: st.base + u.search }); res.end(); return; }
        if (rel === '') rel = 'index.html';
      }
      const f = path.join(st.root, rel);
      if (rel.includes('..') || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end('not found'); return; }
      const buf = fs.readFileSync(f), etag = '"' + crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16) + '"';
      const head = { 'ETag': etag, 'Cache-Control': 'public, max-age=0, must-revalidate', 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' };
      if (req.headers['if-none-match'] === etag) { res.writeHead(304, head); res.end(); return; }
      if (st.gzip && /gzip/.test(req.headers['accept-encoding'] || '') && !/\.png$/.test(f)) {
        const z = zlib.gzipSync(buf); head['Content-Encoding'] = 'gzip'; head['Content-Length'] = z.length;
        res.writeHead(200, head); res.end(z); return;
      }
      res.writeHead(200, head); res.end(buf);
    }, st.delay);
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bmt-pwa-'));
  const browser = await chromium.launch();
  const errors = []; let passed = 0;
  const ok = (c, m) => { assert.ok(c, m); passed++; };
  const eq = (a, b, m) => { assert.equal(a, b, m); passed++; };
  const servers = [];
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

  async function newPage(o) {
    o = o || {};
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-TW', userAgent: o.ua, hasTouch: !!o.ua, isMobile: !!o.ua });
    const p = await ctx.newPage(); p._errs = [];
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR_/.test(m.text()) && !(o.quiet && o.quiet.test(m.text()))) { errors.push('[console] ' + m.text()); p._errs.push(m.text()); } });
    p.on('pageerror', e => { errors.push('[pageerror] ' + e.message); p._errs.push(e.message); });
    if (o.init) await p.addInitScript(o.init);
    return p;
  }
  const ver = p => p.evaluate(() => document.body.getAttribute('data-ver'));
  const ready = async p => { await p.waitForSelector('#view > *'); };
  const swReady = async p => {
    await p.evaluate(() => navigator.serviceWorker.ready);
    await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 });
  };
  const cacheInfo = p => p.evaluate(async () => {
    const out = {};
    for (const k of await caches.keys()) {
      const c = await caches.open(k); out[k] = [];
      for (const r of await c.keys()) { const res = await c.match(r); out[k].push({ url: r.url, redirected: res.redirected, status: res.status }); }
    }
    return out;
  });
  const ours = info => Object.keys(info).filter(k => k.startsWith('badminton-handbook-'));
  const shellVer = p => p.evaluate(async () => {
    for (const k of await caches.keys()) if (k.startsWith('badminton-handbook-')) { const r = await (await caches.open(k)).match('./'); if (r) { const m = /data-ver="([^"]+)"/.exec(await r.text()); return k + ' ' + (m ? m[1] : '?'); } }
    return null;
  });
  const waitFor = async (fn, what, ms) => {
    const t0 = Date.now(); let last;
    while (Date.now() - t0 < (ms || 15000)) { last = await fn(); if (last) return last; await new Promise(r => setTimeout(r, 150)); }
    throw new Error('等不到：' + what);
  };

  try {
    const v1 = makeVersion(tmp, 'v1', {});
    const v2 = makeVersion(tmp, 'v2', { sw: 'aaaaaaaaaa02' });
    const v3 = makeVersion(tmp, 'v3', { sw: 'aaaaaaaaaa02' });          // 只有頁面變了，sw.js 和 v2 一樣
    const v0 = makeVersion(tmp, 'v0', { oldSw: true });

    /* ===== 1. 安裝離線快取、可安裝性 ===== */
    const st = { root: v1, base: '/', other: '/other/', delay: 0, down: false, log: [] };
    const srv = await makeHost(st); servers.push(srv);
    const origin = 'http://127.0.0.1:' + srv.address().port;
    let p = await newPage();
    await p.goto(origin + '/'); await ready(p); await swReady(p);
    eq(await ver(p), 'v1');
    let info = await cacheInfo(p);
    eq(ours(info).length, 1, '只有一份快取');
    const entries = info[ours(info)[0]];
    eq(entries.length, 6, '快取了頁面、manifest 和四張圖示：' + entries.map(e => e.url).join(' '));
    ok(entries.some(e => e.url === origin + '/'), '頁面存在資料夾網址底下');
    ok(entries.every(e => e.redirected === false && e.status === 200), '快取裡沒有帶轉址標記的回應');
    ok(!entries.some(e => /sw\.js$/.test(e.url)), 'sw.js 本身不放進快取');

    const cdp = await p.context().newCDPSession(p);
    const mf = await cdp.send('Page.getAppManifest');
    ok(/manifest\.webmanifest$/.test(mf.url) && (mf.errors || []).length === 0, 'manifest 解析沒有錯誤 ' + JSON.stringify(mf.errors));
    const man = JSON.parse(mf.data);
    eq(man.display, 'standalone'); eq(man.start_url, './'); eq(man.scope, './'); eq(man.short_name, '羽球手冊');
    ok(man.icons.some(i => i.sizes === '192x192') && man.icons.some(i => i.sizes === '512x512') && man.icons.some(i => i.purpose === 'maskable'), '圖示尺寸齊全');
    const instRaw = (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors.map(e => e.errorId);
    console.log('  [資訊] Chromium 可安裝性檢查回報：' + (instRaw.join(', ') || '（沒有問題）'));
    const inst = instRaw.filter(id => id !== 'in-incognito');   // 測試用的瀏覽器是無痕視窗，這一項不算
    eq(inst.join(','), '', 'Chromium 判定可以安裝');
    const head = await p.evaluate(() => ({
      robots: (document.querySelector('meta[name=robots]') || {}).content, title: (document.querySelector('meta[name=apple-mobile-web-app-title]') || {}).content,
      capable: (document.querySelector('meta[name=apple-mobile-web-app-capable]') || {}).content, touch: (document.querySelector('link[rel=apple-touch-icon]') || {}).href,
      viewport: (document.querySelector('meta[name=viewport]') || {}).content
    }));
    eq(head.robots, 'noindex'); eq(head.title, '羽球手冊'); eq(head.capable, 'yes');
    const metas = await p.evaluate(() => { const g = sel => (document.querySelector(sel) || {}).content; return { csp: g('meta[http-equiv="Content-Security-Policy"]'), ref: g('meta[name=referrer]'), ogt: g('meta[property="og:title"]'), ogd: g('meta[property="og:description"]'), ogi: g('meta[property="og:image"]'), ogu: g('meta[property="og:url"]') }; });
    ok(/default-src 'none'/.test(metas.csp) && /connect-src 'self'/.test(metas.csp) && /img-src 'self' data:/.test(metas.csp), '頁面帶有內容安全政策');
    eq(metas.ref, 'no-referrer'); eq(metas.ogt, '羽球訓練手冊'); ok(metas.ogd.length > 10);
    ok(/^https:\/\/.+\/og\.png$/.test(metas.ogi) && metas.ogi.startsWith(metas.ogu), '連結預覽圖是完整網址：' + metas.ogi);
    ok(fs.existsSync(path.join(__dirname, '..', 'og.png')) && fs.statSync(path.join(__dirname, '..', 'og.png')).size > 10000, 'og.png 存在');
    ok(/apple-touch-icon\.png$/.test(head.touch) && /viewport-fit=cover/.test(head.viewport));

    /* 先留一點資料，後面確認更新和離線都不會動到它 */
    await p.evaluate(k => { const s = JSON.parse(localStorage.getItem(k)); s.setup = true; s.logs = [{ id: 'keep', date: '2026-10-03', kind: 'court', title: '保留的紀錄', min: 60, rpe: 5, note: '' }]; localStorage.setItem(k, JSON.stringify(s)); }, KEY);
    /* 同一個網域上「別的 App」的快取 */
    await p.evaluate(async () => { const c = await caches.open('workbench-v1'); await c.put('/foreign', new Response('x')); });

    /* ===== 2. 完全沒有網路 ===== */
    st.down = true;
    await p.reload(); await ready(p);
    eq(await ver(p), 'v1', '離線可以開啟');
    await p.click('#nav [data-tab="learn"]'); await p.click('[data-act="learn"][data-id="rules"]');
    ok((await p.locator('#view').innerText()).includes('15 分'), '離線可以看文章');
    await p.goto(origin + '/index.html'); await ready(p);
    eq(await ver(p), 'v1', '離線時開 index.html 也可以');
    await p.goto(origin + '/?source=pwa#log'); await ready(p);
    ok((await p.locator('#view').innerText()).includes('保留的紀錄'), '離線時帶參數的網址可以開，資料還在');
    eq(await p.evaluate(() => fetch('manifest.webmanifest').then(r => r.status)), 200, '離線時 manifest 從快取回應');
    eq(await p.evaluate(() => fetch('/other/data.json').then(() => 'served', () => 'failed')), 'failed', '別的路徑不會被這個 App 的快取接走');
    st.down = false;

    /* ===== 3. 訊號很差：主機每個回應都慢 6 秒，App 照樣馬上開 ===== */
    st.delay = 6000;
    let t0 = Date.now();
    await p.goto(origin + '/'); await ready(p);
    const slowOpen = Date.now() - t0;
    console.log('  [資訊] 主機每個回應慢 6 秒時，開啟花了 ' + slowOpen + ' 毫秒');
    ok(slowOpen < 2500, '網路很慢時仍然立刻開啟（' + slowOpen + ' 毫秒）');
    st.delay = 0;
    await p.waitForTimeout(300);

    /* 別的路徑：連線時每次都拿到新的，沒有被快取 */
    const o1 = await p.evaluate(() => fetch('/other/data.json').then(r => r.json())), o2 = await p.evaluate(() => fetch('/other/data.json').then(r => r.json()));
    ok(o2.n > o1.n, '別的路徑每次都是新的回應');

    /* ===== 4. 部署新版：第一次開還是舊的，背景換好之後，第二次開就是新的 ===== */
    const oldCache = ours(await cacheInfo(p))[0];
    st.root = v2;
    await p.reload(); await ready(p);
    eq(await ver(p), 'v1', '部署後第一次開：先顯示手機裡的舊版');
    await waitFor(async () => { const ks = ours(await cacheInfo(p)); return ks.length === 1 && ks[0] === 'badminton-handbook-aaaaaaaaaa02'; }, '新版快取就緒、舊版快取清掉');
    info = await cacheInfo(p);
    ok(!info[oldCache], '舊版的快取已刪除');
    ok(!!info['workbench-v1'] && info['workbench-v1'].length === 1, '同網域其他 App 的快取沒有被動到');
    await p.reload(); await ready(p);
    eq(await ver(p), 'v2', '第二次開就是新版');
    ok((await p.evaluate(k => JSON.parse(localStorage.getItem(k)).logs[0].id, KEY)) === 'keep', '更新後紀錄還在');

    /* ===== 5. 只換了頁面、sw.js 沒變：背景更新照樣會換 ===== */
    st.root = v3;
    await p.reload(); await ready(p);
    eq(await ver(p), 'v2');
    await waitFor(async () => /v3$/.test(await shellVer(p) || ''), '背景把新頁面存進快取');
    await p.reload(); await ready(p);
    eq(await ver(p), 'v3', '只換頁面也會更新');
    info = await cacheInfo(p);
    ok(info[ours(info)[0]].every(e => !e.redirected), '背景更新存進去的回應沒有轉址標記');
    st.down = true;
    await p.goto(origin + '/index.html'); await ready(p);
    eq(await ver(p), 'v3', '更新後離線照樣能開');
    st.down = false;
    eq(p._errs.length, 0, p._errs.join(' | ')); await p.context().close();

    /* ===== 6. 從上一版的 sw.js 換過來 ===== */
    const st0 = { root: v0, base: '/', other: '/other/', delay: 0, down: false, log: [] };
    const srv0 = await makeHost(st0); servers.push(srv0);
    const origin0 = 'http://127.0.0.1:' + srv0.address().port;
    p = await newPage();
    await p.goto(origin0 + '/'); await ready(p); await swReady(p);
    ok(ours(await cacheInfo(p))[0] === 'badminton-handbook-v20261004-290769', '先裝上一版');
    st0.root = v1;
    await p.reload(); await ready(p);
    await waitFor(async () => { const ks = ours(await cacheInfo(p)); return ks.length === 1 && ks[0] !== 'badminton-handbook-v20261004-290769'; }, '換成新版的快取');
    await p.reload(); await ready(p);
    eq(await ver(p), 'v1');
    st0.down = true;
    await p.goto(origin0 + '/index.html'); await ready(p);
    eq(await ver(p), 'v1', '從上一版換過來之後，離線開 index.html 正常');
    st0.down = false;
    eq(p._errs.length, 0, p._errs.join(' | ')); await p.context().close();

    /* ===== 7. 放在子資料夾：只管自己的資料夾 ===== */
    const sub = { root: v1, base: '/apps/badminton/', other: '/apps/other/', delay: 0, down: false, log: [] };
    const srv2 = await makeHost(sub); servers.push(srv2);
    const origin2 = 'http://127.0.0.1:' + srv2.address().port;
    p = await newPage();
    await p.goto(origin2 + '/apps/badminton/'); await ready(p); await swReady(p);
    eq(await p.evaluate(() => navigator.serviceWorker.ready.then(r => r.scope)), origin2 + '/apps/badminton/', '範圍只到自己的資料夾');
    const cdp2 = await p.context().newCDPSession(p);
    eq((await cdp2.send('Page.getInstallabilityErrors')).installabilityErrors.map(e => e.errorId).filter(id => id !== 'in-incognito').join(','), '', '子資料夾也可以安裝');
    const sib = await newPageIn(p, origin2 + '/apps/other/');
    eq(await sib.evaluate(() => !!navigator.serviceWorker.controller), false, '隔壁資料夾的頁面不受控制');
    await sib.close();
    sub.down = true;
    await p.goto(origin2 + '/apps/badminton/index.html'); await ready(p);
    eq(await ver(p), 'v1', '子資料夾離線可開');
    sub.down = false;
    eq(p._errs.length, 0, p._errs.join(' | ')); await p.context().close();

    /* ===== 7b. 另一種主機：資料夾網址會被轉到 index.html，而且回應有壓縮 ===== */
    const alt = { root: v1, base: '/', other: '/other/', delay: 0, down: false, log: [], rootToIndex: true, gzip: true };
    const srv3 = await makeHost(alt); servers.push(srv3);
    const origin3 = 'http://127.0.0.1:' + srv3.address().port;
    p = await newPage();
    await p.goto(origin3 + '/'); await ready(p); await swReady(p);
    ok(/\/index\.html$/.test(p.url()), '這種主機會把網址帶到 index.html：' + p.url());
    info = await cacheInfo(p);
    eq(info[ours(info)[0]].length, 6);
    ok(info[ours(info)[0]].every(e => !e.redirected && e.status === 200), '轉址來的頁面存進快取前已重包');
    alt.down = true;
    for (const u of ['/', '/index.html']) { await p.goto(origin3 + u); await ready(p); eq(await ver(p), 'v1', '這種主機離線開 ' + u + ' 也正常'); }
    ok((await p.locator('#view').innerText()).length > 200, '壓縮過的頁面從快取取出後內容正常');
    alt.down = false; alt.root = v2;
    await p.reload(); await ready(p);
    await waitFor(async () => { const ks = ours(await cacheInfo(p)); return ks.length === 1 && ks[0] === 'badminton-handbook-aaaaaaaaaa02'; }, '這種主機也能更新');
    await p.reload(); await ready(p);
    eq(await ver(p), 'v2');
    eq(p._errs.length, 0, p._errs.join(' | ')); await p.context().close();

    /* ===== 8. 安裝入口 ===== */
    // 一般瀏覽器、還沒有安裝事件：設定裡有文字說明
    st.root = v1;
    p = await newPage();
    await p.goto(origin + '/'); await ready(p);
    ok((await p.locator('#view .note-box').first().innerText()).includes('預設值'), '一般瀏覽器第一次用：顯示預設值提示');
    await p.click('#setBtn'); await p.waitForSelector('dialog[open] #s-start');
    ok((await p.locator('dialog .sheet-b').innerText()).includes('在瀏覽器的選單裡選「安裝」或「加到主畫面」'), '設定裡有安裝說明');
    eq(await p.locator('dialog [data-act="install"]').count(), 0);
    // 瀏覽器給了安裝事件（Android、桌機 Chrome）：出現按鈕，按了會跳安裝視窗
    await p.evaluate(() => {
      const ev = new Event('beforeinstallprompt', { cancelable: true });
      ev.prompt = () => { window.__prompted = (window.__prompted || 0) + 1; return Promise.resolve(); };
      ev.userChoice = new Promise(r => { window.__choose = r; });
      window.dispatchEvent(ev); window.__prevented = ev.defaultPrevented;
    });
    eq(await p.evaluate(() => window.__prevented), true, '攔下瀏覽器自己的安裝橫幅，改用設定裡的按鈕');
    eq(await p.locator('dialog [data-act="install"]').count(), 1, '設定面板開著時，按鈕直接出現');
    await p.click('dialog [data-act="install"]');
    eq(await p.evaluate(() => window.__prompted), 1, '按下去會跳出安裝視窗');
    await p.evaluate(() => window.__choose({ outcome: 'accepted' }));
    await p.waitForFunction(() => !document.querySelector('dialog [data-act="install"]'));
    await p.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    await p.waitForFunction(() => /已裝到主畫面/.test((document.getElementById('toast') || {}).textContent || ''));
    eq(p._errs.length, 0, p._errs.join(' | ')); await p.context().close();

    // iPhone 的 Safari：第一次用先請他加到主畫面；設定裡是 Safari 的步驟
    p = await newPage({ ua: IPHONE });
    await p.goto(origin + '/'); await ready(p);
    let box = await p.locator('#view .note-box').first().innerText();
    ok(box.includes('先加到主畫面') && box.includes('加入主畫面') && box.includes('分開存'), 'iPhone 第一次用：先請使用者加到主畫面');
    ok(await p.evaluate(() => { const h = document.querySelector('#view .hero'), n = document.querySelector('#view .note-box'); return h.nextElementSibling === n && n.getBoundingClientRect().top < 844; }), '提示在第一個畫面');
    eq(await p.locator('#view [data-act="hintOff"]').count(), 0, '這時候先不顯示預設值提示');
    await p.click('[data-act="instOff"]');
    ok((await p.locator('#view .note-box').first().innerText()).includes('預設值'), '選擇先在瀏覽器裡用之後，接著顯示預設值提示');
    eq((await p.evaluate(k => JSON.parse(localStorage.getItem(k)).setup, KEY)), false, '還沒設定過');
    await p.click('#setBtn'); await p.waitForSelector('dialog[open] #s-start');
    const sTxt = await p.locator('dialog .sheet-b').innerText();
    ok(sTxt.includes('用 Safari 開這個網址') && sTxt.includes('先到「紀錄」分頁備份'), 'iPhone 的設定裡是 Safari 的步驟和資料提醒');
    ok((await p.evaluate(() => { const b = document.querySelector('dialog[open] .sheet-b'); return b.scrollWidth - b.clientWidth; })) <= 0, '設定面板不溢出');
    eq(p._errs.length, 0, p._errs.join(' | ')); await p.context().close();

    // 已經從主畫面開啟（iPhone 的 navigator.standalone、其他裝置的 display-mode）：不再提示安裝
    p = await newPage({ ua: IPHONE, init: () => { Object.defineProperty(navigator, 'standalone', { value: true }); } });
    await p.goto(origin + '/'); await ready(p);
    ok((await p.locator('#view .note-box').first().innerText()).includes('預設值'), '從主畫面開啟：直接顯示預設值提示');
    await p.click('#setBtn'); await p.waitForSelector('dialog[open] #s-start');
    ok(!(await p.locator('dialog .sheet-b').innerText()).includes('裝到主畫面'), '從主畫面開啟：設定裡沒有安裝區塊');
    await p.context().close();
    p = await newPage({ init: () => {                           // 模擬「以 App 視窗開啟」的 display-mode
      const mm = window.matchMedia.bind(window);
      window.matchMedia = q => (q === '(display-mode: standalone)' ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q));
    } });
    await p.goto(origin + '/'); await ready(p);
    await p.click('#setBtn'); await p.waitForSelector('dialog[open] #s-start');
    ok(!(await p.locator('dialog .sheet-b').innerText()).includes('裝到主畫面'), '以 App 視窗開啟：設定裡沒有安裝區塊');
    eq(p._errs.length, 0, p._errs.join(' | ')); await p.context().close();

    /* ===== 8a. 分享連結、LINE 等內建瀏覽器、內容安全政策 ===== */
    const openSettings = async q => { await q.click('#setBtn'); await q.waitForSelector('dialog[open] #s-start'); };
    const toastOf = q => q.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
    // 沒有系統分享選單、剪貼簿可用：複製連結
    p = await newPage();
    await p.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    await p.goto(origin + '/?openExternalBrowser=1#menu'); await ready(p);
    ok((await p.locator('#view').innerText()).includes('菜單'), '帶 openExternalBrowser 參數的網址可以正常開');
    await openSettings(p);
    eq(await p.inputValue('#s-share'), origin + '/?openExternalBrowser=1', '分享連結帶 LINE 用的參數');
    await p.evaluate(() => { delete Navigator.prototype.share; });
    await p.click('dialog [data-act="share"]');
    await p.waitForFunction(() => /已複製連結/.test((document.getElementById('toast') || {}).textContent || ''));
    eq(await p.evaluate(() => navigator.clipboard.readText()), origin + '/?openExternalBrowser=1', '剪貼簿裡是分享連結');
    // 剪貼簿寫不進去：選取連結讓使用者自己複製
    await p.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('no')); });
    await p.click('dialog [data-act="share"]');
    await p.waitForFunction(() => /已選取連結/.test((document.getElementById('toast') || {}).textContent || ''));
    eq(await p.evaluate(() => { const b = document.getElementById('s-share'); return document.activeElement === b && b.selectionEnd - b.selectionStart === b.value.length; }), true, '複製不了時選取連結');
    // 有系統分享選單（手機）：交給它；使用者取消時不出聲
    await p.evaluate(() => { window.__shared = []; window.__shareFail = null; navigator.share = d => { window.__shared.push(d); return window.__shareFail ? Promise.reject(window.__shareFail) : Promise.resolve(); }; });
    await p.click('dialog [data-act="share"]');
    const shared = await p.evaluate(() => window.__shared);
    eq(shared.length, 1); eq(shared[0].url, origin + '/?openExternalBrowser=1'); eq(shared[0].title, '羽球訓練手冊');
    await p.evaluate(() => { const t = document.getElementById('toast'); if (t) t.textContent = ''; window.__shareFail = Object.assign(new Error('x'), { name: 'AbortError' }); });
    await p.click('dialog [data-act="share"]'); await p.waitForTimeout(200);
    eq(await toastOf(p), '', '使用者取消分享時不顯示訊息');
    ok((await p.evaluate(() => { const b = document.querySelector('dialog[open] .sheet-b'); return b.scrollWidth - b.clientWidth; })) <= 0, '設定面板不溢出');
    eq(p._errs.length, 0, p._errs.join(' | ')); await p.context().close();

    // 從 LINE 點連結進來（iPhone 和 Android）：先請使用者換到手機的瀏覽器
    for (const ua of [IPHONE.replace('Safari/604.1', 'Safari/604.1 Line/14.9.0'), 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Line/14.9.1/IAB']) {
      p = await newPage({ ua });
      await p.goto(origin + '/'); await ready(p);
      box = await p.locator('#view .note-box').first().innerText();
      ok(box.includes('先換到手機的瀏覽器') && box.includes('以預設瀏覽器開啟'), 'LINE 內建瀏覽器：提示換到瀏覽器');
      await openSettings(p);
      ok((await p.locator('dialog .sheet-b').innerText()).includes('內建瀏覽器，不能加到主畫面'), 'LINE 內建瀏覽器：設定裡的安裝說明');
      await p.keyboard.press('Escape'); await p.waitForSelector('dialog.sheet', { state: 'detached' });
      eq(p._errs.length, 0, p._errs.join(' | ')); await p.context().close();
    }
    p = await newPage({ ua: IPHONE.replace('Safari/604.1', 'Safari/604.1 Line/14.9.0') });
    await p.goto(origin + '/'); await ready(p);
    await p.click('[data-act="instOff"]');
    ok((await p.locator('#view .note-box').first().innerText()).includes('預設值'), '選擇先在這裡用之後，顯示預設值提示');
    await p.context().close();

    // 內容安全政策真的有效：頁面連不到別的網域，也載不了外部圖片
    p = await newPage({ quiet: /Content Security Policy|Refused to/i });
    await p.goto(origin + '/'); await ready(p);
    const csp = await p.evaluate(() => new Promise(res => {
      const seen = [];
      document.addEventListener('securitypolicyviolation', e => seen.push(e.violatedDirective.split(' ')[0] + ' ' + e.blockedURI));
      fetch('https://example.com/collect', { method: 'POST', body: 'x' }).catch(() => {});
      const im = new Image(); im.src = 'https://example.com/pixel.png';
      const sc = document.createElement('script'); sc.src = 'https://example.com/x.js'; document.head.appendChild(sc);
      setTimeout(() => res(seen), 600);
    }));
    ok(csp.some(x => /^connect-src https:\/\/example\.com/.test(x)), '擋下對外連線：' + csp.join(' | '));
    ok(csp.some(x => /^img-src https:\/\/example\.com/.test(x)), '擋下外部圖片');
    ok(csp.some(x => /^script-src(-elem)? https:\/\/example\.com/.test(x)), '擋下外部程式');
    await p.context().close();

    /* ===== 8b. 第二份備份：同網域的別的網站把 localStorage 清掉時，紀錄會自動回來 ===== */
    const idbState = q => q.evaluate(() => new Promise(res => {
      const rq = indexedDB.open('badminton-handbook', 1);
      rq.onupgradeneeded = () => { rq.result.createObjectStore('kv'); };
      rq.onerror = () => res(null);
      rq.onsuccess = () => { const db = rq.result, g = db.transaction('kv').objectStore('kv').get('state'); g.onsuccess = () => { db.close(); res(g.result || null); }; g.onerror = () => { db.close(); res(null); }; };
    }));
    const idbPut = (q, text) => q.evaluate(t => new Promise(res => {
      const rq = indexedDB.open('badminton-handbook', 1);
      rq.onupgradeneeded = () => { rq.result.createObjectStore('kv'); };
      rq.onsuccess = () => { const db = rq.result, tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(t, 'state'); tx.oncomplete = () => { db.close(); res(true); }; };
    }), text);
    const lsState = q => q.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
    const toastNow = q => q.evaluate(() => { const t = document.getElementById('toast'); return t && !t.hidden ? t.textContent : ''; });
    p = await newPage();
    await p.goto(origin + '/'); await ready(p);
    await p.waitForFunction(k => !!localStorage.getItem(k), KEY);
    eq((await lsState(p)).setup, false, '第一次開啟：查過沒有第二份，把預設值存下來');
    await p.click('[data-act="hintOff"]');
    await p.click('#nav [data-tab="log"]'); await p.click('[data-act="addLog"]'); await p.waitForSelector('dialog[open] #f-title');
    await p.fill('#f-title', '第二份備份測試'); await p.fill('#f-min', '45'); await p.click('dialog [data-act="logSave"]');
    await waitFor(async () => { const t = await idbState(p); return t && JSON.parse(t).logs.length === 1; }, '存檔後第二份備份跟著寫入');
    await p.evaluate(() => localStorage.clear());                          // 同網域的別的網站清掉了整個 localStorage
    await p.reload(); await ready(p);
    await p.waitForFunction(() => /已自動還原/.test((document.getElementById('toast') || {}).textContent || ''));
    let back = await lsState(p);
    eq(back.logs.length, 1); eq(back.logs[0].title, '第二份備份測試'); eq(back.setup, true, 'localStorage 被清掉後自動還原');
    ok(!(await p.locator('#view').innerText()).includes('預設值'), '還原後畫面是還原後的狀態');
    await p.click('#nav [data-tab="log"]');
    ok((await p.locator('#view').innerText()).includes('第二份備份測試'), '紀錄回來了');
    // 開著的時候被清掉：下一次存檔會把 localStorage 補回去
    await p.evaluate(() => localStorage.clear());
    await p.click('#nav [data-tab="today"]'); await p.click('[data-act="tests"]'); await p.fill('#t-rope', '120'); await p.keyboard.press('Escape');
    eq((await lsState(p)).logs.length, 1, '開著時被清掉，下一次存檔就補回來');
    // 自己按「清除全部資料」：第二份也跟著清空，不會復活
    await p.click('#nav [data-tab="log"]');
    await p.click('[data-act="wipe"]'); await p.waitForTimeout(500); await p.click('[data-act="wipe"]');
    await waitFor(async () => { const t = await idbState(p); return t && JSON.parse(t).logs.length === 0 && !JSON.parse(t).setup; }, '清除後第二份也清空');
    await p.evaluate(() => localStorage.clear());
    await p.reload(); await ready(p);
    await p.waitForFunction(k => !!localStorage.getItem(k), KEY);
    eq((await lsState(p)).logs.length, 0, '自己清除的資料不會復活');
    eq(await toastNow(p), '', '沒有還原訊息');
    // 第二份的內容壞掉或被塞了惡意內容：不出錯，也不會執行
    await idbPut(p, '這不是 JSON{{{');
    await p.evaluate(() => localStorage.clear()); await p.reload(); await ready(p);
    await p.waitForFunction(k => !!localStorage.getItem(k), KEY);
    eq((await lsState(p)).logs.length, 0, '第二份壞掉時照第一次使用處理');
    await idbPut(p, JSON.stringify({ setup: true, set: { level: 9, days: 'x', start: '<img src=x onerror=window.__xss=1>' }, logs: [{ id: 'h', date: '2026-10-03', kind: 'court', title: '<img src=x onerror="window.__xss=1">', min: 60 }] }));
    await p.evaluate(() => localStorage.clear()); await p.reload(); await ready(p);
    await p.waitForFunction(() => /已自動還原/.test((document.getElementById('toast') || {}).textContent || ''));
    await p.click('#nav [data-tab="log"]'); await p.waitForTimeout(200);
    eq(await p.evaluate(() => window.__xss), undefined, '第二份裡的內容一樣會清洗和跳脫');
    back = await lsState(p);
    ok(back.set.level >= 0 && back.set.level <= 2 && back.set.days.length === 7 && /^\d{4}-\d{2}-\d{2}$/.test(back.set.start), '還原的資料經過清洗');
    eq(p._errs.length, 0, p._errs.join(' | ')); await p.context().close();

    // 這個瀏覽器沒有 IndexedDB：照舊，第一次開啟立刻存
    p = await newPage({ init: () => { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); } });
    await p.goto(origin + '/'); await ready(p);
    eq((await lsState(p)).setup, false, '沒有 IndexedDB 也能用');
    eq(p._errs.length, 0, p._errs.join(' | ')); await p.context().close();
    // IndexedDB 開啟後一直沒有回應：等一下之後照第一次使用處理
    p = await newPage({ init: () => { Object.defineProperty(window, 'indexedDB', { value: { open() { return {}; } }, configurable: true }); } });
    await p.goto(origin + '/'); await ready(p);
    eq(await lsState(p), null, 'IndexedDB 沒回應時先等一下');
    await p.waitForFunction(k => !!localStorage.getItem(k), KEY, { timeout: 4000 });
    await p.click('[data-act="hintOff"]');
    eq((await lsState(p)).setup, true, 'IndexedDB 沒回應也不影響存檔');
    eq(p._errs.length, 0, p._errs.join(' | ')); await p.context().close();
    // IndexedDB 開啟時直接丟出錯誤（某些私密瀏覽模式）
    p = await newPage({ init: () => { Object.defineProperty(window, 'indexedDB', { value: { open() { throw new Error('denied'); } }, configurable: true }); } });
    await p.goto(origin + '/'); await ready(p);
    await p.waitForFunction(k => !!localStorage.getItem(k), KEY, { timeout: 4000 });
    eq(p._errs.length, 0, p._errs.join(' | ')); await p.context().close();

    /* 直接打開檔案（沒有放上網址）：不顯示安裝相關的提示 */
    p = await newPage({ ua: IPHONE });
    await p.goto('file://' + path.join(SITE, 'index.html')); await ready(p);
    ok((await p.locator('#view .note-box').first().innerText()).includes('預設值'), '直接開檔案：不提示加到主畫面');
    await p.click('#setBtn'); await p.waitForSelector('dialog[open] #s-start');
    ok(!(await p.locator('dialog .sheet-b').innerText()).includes('裝到主畫面'), '直接開檔案：設定裡沒有安裝區塊');
    eq(p._errs.length, 0, p._errs.join(' | ')); await p.context().close();

    /* ===== 9. 真正的主機（給了網址才跑）：例如 wrangler dev ===== */
    const real = process.argv[2];
    if (real) {
      const base = real.endsWith('/') ? real : real + '/';
      p = await newPage();
      const resp = await p.goto(base + 'index.html'); await ready(p); await swReady(p);
      const chain = []; for (let r = resp.request(); r; r = r.redirectedFrom()) chain.unshift(r.url());
      console.log('  [主機] index.html 的導覽路徑：' + chain.join(' → ') + '，最後網址 ' + p.url());
      const h = resp.headers();
      console.log('  [主機] 回應標頭：cache-control=' + h['cache-control'] + ' | content-security-policy=' + (h['content-security-policy'] || '(無)') + ' | x-content-type-options=' + (h['x-content-type-options'] || '(無)'));
      info = await cacheInfo(p);
      eq(ours(info).length, 1); eq(info[ours(info)[0]].length, 6, '真正的主機：六個檔案都進了快取');
      ok(info[ours(info)[0]].every(e => !e.redirected && e.status === 200), '真正的主機：快取裡沒有帶轉址標記的回應');
      const cdp4 = await p.context().newCDPSession(p);
      eq((await cdp4.send('Page.getInstallabilityErrors')).installabilityErrors.map(e => e.errorId).filter(id => id !== 'in-incognito').join(','), '', '真正的主機：可以安裝');
      const mfType = await p.evaluate(() => fetch('manifest.webmanifest', { cache: 'reload' }).then(r => r.headers.get('content-type')));
      ok(/manifest\+json|application\/json/.test(mfType || ''), 'manifest 的類型：' + mfType);
      // 整個 App 走一遍，確認主機的安全標頭沒有擋到任何功能
      for (const t of ['plan', 'menu', 'learn', 'log', 'today']) await p.click('#nav [data-tab="' + t + '"]');
      await p.click('[data-act="timer"]'); await p.click('dialog [data-act="tmStart"]'); await p.waitForTimeout(300); await p.keyboard.press('Escape');
      await p.click('[data-act="caller"]'); await p.click('dialog [data-act="clStart"]'); await p.waitForTimeout(300); await p.keyboard.press('Escape');
      await p.click('[data-act="score"]'); await p.click('dialog [data-act="sbStart"]'); await p.click('dialog [data-act="sbPt"][data-side="0"]'); await p.keyboard.press('Escape');
      await p.click('#nav [data-tab="log"]'); await p.click('[data-act="backup"]');
      const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }), p.click('[data-act="bkFile"]')]);
      ok(/^badminton-backup-/.test(dl.suggestedFilename()), '真正的主機：下載備份正常');
      await p.keyboard.press('Escape');
      await p.click('#nav [data-tab="learn"]'); await p.click('[data-act="learn"][data-id="court"]');
      ok(await p.locator('.kb svg').count() >= 1);
      const fonts = await p.evaluate(() => document.fonts.ready.then(() => Array.from(document.fonts).filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight)));
      ok(fonts.length >= 1, '內嵌字型有載入：' + fonts.join(', '));
      eq(p._errs.length, 0, '真正的主機：主控台沒有錯誤 ' + p._errs.join(' | '));
      await p.context().close();
    }
  } catch (e) {
    errors.push('[assert] ' + String(e.message || e).split('\n').slice(0, 4).join(' | '));
  }
  async function newPageIn(p, url) { const q = await p.context().newPage(); await q.goto(url); return q; }
  await browser.close();
  servers.forEach(s => s.close());
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(passed + ' 項檢查通過');
  console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].slice(0, 20).join('\n') : 'no errors');
  process.exit(errors.length ? 1 : 0);
})();
