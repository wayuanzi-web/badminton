const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const OUT = path.join(__dirname, '..', 'out', 'shots');
(async () => {
  const b = await chromium.launch(); const errors = []; let n = 0;
  const ok = (c, m) => { assert.ok(c, m); n++; };
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
    p.on('pageerror', e => errors.push('[pageerror] ' + e.message));
    const bad = []; p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    await p.goto('http://localhost:8765/');
    ok((await p.title()) === '羽球訓練手冊');
    ok(await p.locator('.hero-title').count() === 1);
    ok(await p.evaluate(() => document.documentElement.lang) === 'zh-Hant-TW');
    const mf = await p.evaluate(async () => { const r = await fetch(document.querySelector('link[rel=manifest]').href); return r.ok ? r.json() : null; });
    ok(mf && mf.name === '羽球訓練手冊' && mf.icons.length === 3 && mf.display === 'standalone');
    for (const ic of mf.icons.map(i => i.src).concat(['apple-touch-icon.png'])) ok((await p.evaluate(async u => (await fetch(u)).status, ic)) === 200, ic);
    // service worker
    const sw = await p.evaluate(() => navigator.serviceWorker.ready.then(r => !!r.active));
    ok(sw, 'service worker 啟用');
    await p.reload(); await p.waitForSelector('.hero-title');
    ok(await p.evaluate(() => !!navigator.serviceWorker.controller), '頁面由 service worker 控制');
    await p.waitForTimeout(500);
    await ctx.setOffline(true);
    await p.reload(); await p.waitForSelector('.hero-title');
    ok((await p.locator('.blk').count()) > 3, '離線仍可開啟');
    await p.click('#nav [data-tab="learn"]'); await p.click('[data-act="learn"][data-id="court"]');
    ok(await p.locator('.kb svg').count() === 1, '離線可看知識');
    await p.screenshot({ path: path.join(OUT, '50-site-offline.png') });
    await ctx.setOffline(false);
    // 下載備份
    await p.click('#nav [data-tab="log"]'); await p.click('[data-act="backup"]');
    ok(await p.locator('[data-act="bkFile"]').count() === 1, '獨立版有下載備份');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="bkFile"]')]);
    ok(/^badminton-backup-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
    const fs = require('node:fs'); const f = await dl.path(); const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    ok(j.set && Array.isArray(j.logs));
    ok(bad.length === 0, '沒有失敗的請求：' + bad.join(', '));
    // 外部請求：整頁不應該連到別的網域
    const ext = await p.evaluate(() => performance.getEntriesByType('resource').map(e => e.name).filter(u => !u.startsWith(location.origin) && !u.startsWith('data:')));
    ok(ext.length === 0, '沒有外部請求：' + ext.join(', '));
  } catch (e) { errors.push('[assert] ' + String(e.message).split('\n').slice(0, 3).join(' | ')); }
  await b.close();
  console.log(n + ' 項檢查通過'); console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
})();
