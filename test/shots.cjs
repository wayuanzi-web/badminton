const { chromium } = require('playwright');
const path = require('node:path');
const wrap = require('./wrap.cjs');
const OUT = path.join(__dirname, '..', 'out', 'shots');
const only = process.argv[2] || '';

(async () => {
  const file = wrap();
  const browser = await chromium.launch();
  const errors = [];
  async function page(opts) {
    const ctx = await browser.newContext({ viewport: opts.vp, colorScheme: opts.dark ? 'dark' : 'light', deviceScaleFactor: opts.vp.width < 600 ? 2 : 1, locale: 'zh-TW' });
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
    p.on('pageerror', e => errors.push('[pageerror] ' + e.message));
    if (opts.now) await p.addInitScript(d => { window.__BMT_NOW__ = d; }, opts.now);
    await p.goto('file://' + file + (opts.hash || ''));
    if (opts.state) {
      await p.evaluate(s => localStorage.setItem('badminton-handbook-v1', s), JSON.stringify(opts.state));
      await p.reload(); await p.waitForSelector('#view > *');
    }
    return p;
  }
  const overflow = async (p, name) => {
    const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    if (o.sw > o.cw) errors.push('[overflow] ' + name + ' ' + o.sw + ' > ' + o.cw);
  };
  const shot = async (p, name, full) => { await p.waitForTimeout(150); await overflow(p, name); await p.screenshot({ path: path.join(OUT, name + '.png'), fullPage: !!full }); };
  const phone = { width: 390, height: 844 }, desk = { width: 1280, height: 900 };
  const scenes = {
    async first() { const p = await page({ vp: phone, now: '2026-10-04' }); await shot(p, '01-first-open-phone', true); },
    async today() {
      let p = await page({ vp: phone, now: '2026-10-06' }); await shot(p, '02-today-court-phone', true);
      await p.locator('.ck').nth(0).check(); await p.locator('.ck').nth(1).check(); await p.locator('.ck').nth(2).check();
      await shot(p, '03-today-checked-phone');
      p = await page({ vp: phone, now: '2026-10-08', dark: true, state: { set: { start: '2026-10-05' }, logs: [], setup: true } }); await shot(p, '04-today-off-dark-phone', true);
      p = await page({ vp: phone, now: '2026-10-07' }); await shot(p, '05-today-rest-phone', true);
      p = await page({ vp: desk, now: '2026-10-06' }); await shot(p, '06-today-desktop', true);
    },
    async plan() {
      let p = await page({ vp: phone, now: '2026-10-21', hash: '#plan' }); await shot(p, '07-plan-phone', true);
      p = await page({ vp: desk, now: '2026-10-21', hash: '#plan', dark: true }); await shot(p, '08-plan-desktop-dark', true);
    },
    async menu() {
      const p = await page({ vp: phone, now: '2026-10-06', hash: '#menu' }); await shot(p, '09-menu-phone', true);
      await p.click('[data-act="menuSeg"][data-v="ex"]'); await shot(p, '10-menu-ex-phone');
      await p.click('[data-act="menuSeg"][data-v="diet"]'); await shot(p, '11-menu-diet-phone', true);
    },
    async learn() {
      let p = await page({ vp: phone, now: '2026-10-06', hash: '#learn' }); await shot(p, '12-learn-phone', true);
      await p.click('[data-act="learn"][data-id="rules"]'); await shot(p, '13-learn-rules-phone', true);
      await p.click('[data-act="learn"][data-id=""]'); await p.click('[data-act="learn"][data-id="court"]'); await shot(p, '14-learn-court-phone', true);
      p = await page({ vp: desk, now: '2026-10-06', hash: '#learn', dark: true });
      await p.click('[data-act="learn"][data-id="rules"]'); await shot(p, '15-learn-rules-desktop-dark', true);
    },
    async log() { const p = await page({ vp: phone, now: '2026-10-06', hash: '#log' }); await shot(p, '16-log-empty-phone', true); },
    async extra() {
      const st = { set: { start: '2026-10-05', sound: false, voice: false }, logs: [], setup: true, tests: { w0: { six: 30, rope: 110, plank: 60 }, w4: { six: 27.5, rope: 125, plank: 75 } } };
      let p = await page({ vp: phone, now: '2026-10-06', state: st });
      await p.locator('.row-t').nth(2).click(); await p.click('[data-act="step"][data-f="prep"][data-d="-1"]'); await p.click('[data-act="tmStart"]'); await p.waitForTimeout(400);
      await shot(p, '60-timer-10min');
      await p.keyboard.press('Escape');
      await p.click('[data-act="caller"]'); await p.locator('[data-act="clToggle"][data-id="2"]').focus(); await p.keyboard.press('Tab'); await p.keyboard.press('Shift+Tab');
      await shot(p, '61-caller-focus');
      await p.keyboard.press('Escape');
      await p.click('[data-act="score"]'); await p.click('[data-act="sbStart"]'); for (let i = 0; i < 11; i++) await p.click('[data-act="sbPt"][data-side="0"]');
      await shot(p, '62-score-interval');
      await p.keyboard.press('Escape');
      await p.click('#nav [data-tab="log"]'); await shot(p, '63-log-tests', true);
      p = await page({ vp: { width: 320, height: 640 }, now: '2026-10-06', state: st });
      await shot(p, '64-today-320', false);
      await p.click('#nav [data-tab="log"]'); await p.locator('#view [data-act="tests"]').first().click(); await shot(p, '65-tests-320');
    }
  };
  try {
    for (const k of Object.keys(scenes)) if (!only || only.split(',').includes(k)) await scenes[k]();
  } catch (e) { errors.push('[script] ' + e.message.split('\n')[0]); }
  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
})();
