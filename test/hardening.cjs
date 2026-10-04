// 審查後補上的回歸測試：惡意備份、格式錯誤的資料、邊界情況、鍵盤操作、窄螢幕
// 執行：NODE_PATH=<playwright 所在的 node_modules> node test/hardening.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const wrap = require('./wrap.cjs');
const KEY = 'badminton-handbook-v1';

(async () => {
  const file = wrap();
  const browser = await chromium.launch();
  const errors = [];
  let passed = 0;
  const ok = (c, m) => { assert.ok(c, m); passed++; };
  const eq = (a, b, m) => { assert.equal(a, b, m); passed++; };
  async function page(o) {
    o = o || {};
    const ctx = await browser.newContext({ viewport: o.vp || { width: 390, height: 844 }, colorScheme: o.dark ? 'dark' : 'light', locale: 'zh-TW' });
    const p = await ctx.newPage();
    p._errs = [];
    p.on('console', m => { if (m.type() === 'error') { errors.push('[console] ' + m.text()); p._errs.push(m.text()); } });
    p.on('pageerror', e => { errors.push('[pageerror] ' + e.message); p._errs.push(e.message); });
    if (o.now) await p.addInitScript(d => { window.__BMT_NOW__ = d; }, o.now);
    if (o.init) await p.addInitScript(o.init[0], o.init[1]);
    await p.goto('file://' + file + (o.hash || ''));
    if (o.state !== undefined) {
      await p.evaluate(a => localStorage.setItem(a.k, a.s), { k: KEY, s: typeof o.state === 'string' ? o.state : JSON.stringify(o.state) });
      await p.reload(); await p.waitForSelector('#view > *');
    }
    return p;
  }
  const state = p => p.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  const base = () => ({ set: { level: 1, days: ['rest', 'court', 'rest', 'off', 'rest', 'court', 'rest'], start: '2026-10-05', sys: 21, sound: false, voice: false, kg: null }, logs: [], setup: true });
  const closeAll = async p => { for (let i = 0; i < 4 && await p.locator('dialog[open]').count(); i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(60); } };
  const nav = async (p, tab) => { await p.click('#nav [data-tab="' + tab + '"]'); };
  const sheetOverflow = p => p.evaluate(() => Array.from(document.querySelectorAll('dialog[open] .sheet-b')).map(b => b.scrollWidth - b.clientWidth).concat([document.documentElement.scrollWidth - document.documentElement.clientWidth]));

  try {
    /* ===== 1. 惡意備份：每個欄位都塞 HTML，走真正的還原流程 ===== */
    const X = tag => '"><img src=x onerror="(window.__xss=window.__xss||[]).push(\'' + tag + '\')">';
    const hostile = {
      v: 1, setup: X('setup'),
      set: { level: X('level'), days: [X('d0'), 'court', 'rest', 'off', 'rest', 'court', 'rest'], start: X('start'), sys: X('sys'), sound: X('sound'), voice: X('voice'), kg: X('kg') },
      logs: [
        { id: X('id'), date: '2026-10-06', kind: X('kind'), title: X('title'), min: X('min'), rpe: X('rpe'), note: X('note'), result: X('result'), score: X('score'), sid: 'p1cA' },
        { id: 'ok2', date: '2026-10-05', kind: 'match', title: '<script>(window.__xss=window.__xss||[]).push("script")</script><b>bold</b>', min: 30, rpe: 5, note: '<b>bold</b>', result: 'W', score: '<i>21-0</i>' },
        { id: 'dropped', date: '2026-10-06' + X('date'), kind: 'court', title: 'x', min: 1 }
      ],
      day: { '2026-10-06': { sid: 'p1cA', ck: {}, done: 1 }, ['2026-10-07' + X('daykey')]: { p1cA: { ck: {} } } },
      over: { '2026-10-07': X('over') },
      tests: { w0: { six: X('six') }, w4: { rope: X('rope') }, [X('tk')]: { six: 1 } },
      arch: [{ start: X('arch'), tests: { w0: { six: X('a6') } } }],
      sb: { names: [[X('n00'), X('n01')], [X('n10'), X('n11')]], mode: X('mode'), first: X('first') }
    };
    let p = await page({ now: '2026-10-06', state: base(), hash: '#log' });
    await p.click('[data-act="restore"]'); await p.waitForSelector('#rs-text');
    await p.fill('#rs-text', JSON.stringify(hostile));
    await p.click('[data-act="rsApply"]'); await p.waitForTimeout(500); await p.click('[data-act="rsApply"]');
    await p.waitForSelector('dialog.sheet', { state: 'detached' });
    const bad = [];
    const probe = async where => {
      await p.waitForTimeout(80);
      const r = await p.evaluate(() => ({ x: (window.__xss || []).slice(), imgs: document.querySelectorAll('img').length, on: document.querySelectorAll('[onerror],[onload],[onclick]').length,
        raw: Array.from(document.querySelectorAll('#view b, #view i, dialog b, dialog i')).filter(e => /^(bold|21-0)$/.test(e.textContent)).length }));
      if (r.x.length || r.imgs || r.on || r.raw) bad.push(where + ' ' + JSON.stringify(r));
    };
    await probe('log');
    const nLog = await p.locator('#view .log').count();
    eq(nLog, 2, '日期無效的那筆被丟掉');
    for (let i = 0; i < nLog; i++) { await p.locator('#view .log').nth(i).click(); await probe('log edit ' + i); await closeAll(p); }
    await p.locator('#view [data-act="tests"]').first().click();
    for (const k of ['w0', 'w4', 'w8', 'w12']) { await p.click('dialog [data-act="testPt"][data-k="' + k + '"]'); await probe('tests ' + k); }
    await closeAll(p);
    await p.click('#view [data-act="backup"]'); await probe('backup'); await closeAll(p);
    await nav(p, 'today'); await probe('today');
    await p.locator('#view [data-act="editLog"]').first().click(); await probe('today editLog'); await closeAll(p);
    await nav(p, 'plan'); await probe('plan');
    await nav(p, 'menu'); await probe('menu'); await p.click('[data-act="menuSeg"][data-v="diet"]'); await probe('diet');
    await nav(p, 'today');
    await p.click('[data-act="score"]'); await probe('score setup');
    await p.click('dialog [data-act="sbStart"]'); await probe('score play');
    for (let i = 0; i < 21; i++) await p.locator('dialog [data-act="sbPt"]').nth(1).click();
    await p.click('dialog [data-act="sbNext"]');
    for (let i = 0; i < 21; i++) await p.locator('dialog [data-act="sbPt"]').nth(1).click();
    await probe('score end'); await p.click('dialog [data-act="sbSave"]'); await probe('score saved'); await closeAll(p);
    await p.click('#setBtn'); await probe('settings'); await closeAll(p);
    await nav(p, 'log'); await probe('log after match');
    eq(bad.length, 0, '惡意內容沒有執行、也沒有變成 HTML：' + bad.join(' ; '));
    let st = await state(p);
    ok(st.logs.every(l => /^[\w-]{1,40}$/.test(l.id) && typeof l.min === 'number' && (l.rpe === null || Number.isInteger(l.rpe)) && ['court', 'off', 'match'].includes(l.kind)), '紀錄欄位都已清洗');
    eq(st.set.level, 1); eq(st.set.start, '2026-10-05'); eq(st.set.sys, 21); eq(st.set.kg, null); eq(st.set.days[0], 'rest'); eq(st.sb.mode, 'D'); eq(st.sb.first, 0);
    eq(JSON.stringify(st.tests), '{}'); eq(JSON.stringify(st.over), '{}'); eq(st.arch.length, 0);
    eq(p._errs.length, 0, '過程沒有錯誤：' + p._errs.join(' | '));

    /* ===== 2. 格式錯誤的儲存內容：每一種都要能開、每個分頁都要能畫 ===== */
    const today = '2026-10-06';
    const cases = [
      '{bad', 'null', '5', '"abc"', '[]', '{}',
      { set: 'x', logs: 'y', day: 7, over: 'z', tests: 'q', sb: 5 },
      Object.assign(base(), { day: { [today]: { sid: 'p1cA' } } }),
      Object.assign(base(), { day: { [today]: { sid: 'p1cA', ck: null } } }),
      Object.assign(base(), { day: { [today]: 'garbage' } }),
      Object.assign(base(), { over: { [today]: 'constructor' } }),
      Object.assign(base(), { over: { [today]: 'toString' } }),
      Object.assign(base(), { over: JSON.parse('{"' + today + '":"__proto__"}') }),
      Object.assign(base(), { sb: { names: [[1, 2], [{}, []]], mode: 7 } }),
      Object.assign(base(), { sb: { names: ['ab', 'cd'] } }),
      Object.assign(base(), { tests: { w0: 'abc', w4: { six: 'abc' }, w8: null } }),
      Object.assign(base(), { logs: [{ date: today, min: '1e999' }, { id: 5, date: today, min: 30 }, { date: '2026-02-31', min: 5 }, null] }),
      Object.assign(base(), { set: { level: 99, days: [1, 2, 3], start: 'abc', sys: '15', kg: 'x' } }),
      Object.assign(base(), { set: { level: 'abc', days: 'no', start: '0999-06-15' } })
    ];
    for (const c of cases) {
      const q = await page({ now: today, state: c });
      const label = (typeof c === 'string' ? c : JSON.stringify(c)).slice(0, 70);
      for (const tab of ['today', 'plan', 'menu', 'learn', 'log']) { await nav(q, tab); ok((await q.locator('#view > *').count()) > 0, label + ' → ' + tab + ' 有內容'); }
      await nav(q, 'today');
      if (await q.locator('.ck').count()) { await q.locator('.ck').first().check(); ok(/^1 \/ \d+ 項$/.test(await q.locator('#progTxt').innerText()), label + ' → 可以打勾'); }
      await q.click('[data-act="score"]'); await q.click('dialog [data-act="sbStart"]'); await q.locator('dialog [data-act="sbPt"]').first().click();
      ok((await q.locator('.sb-serve').innerText()).length > 4, label + ' → 計分板可用');
      await closeAll(q);
      await nav(q, 'log'); await q.locator('#view [data-act="tests"]').first().click(); await q.fill('#t-six', '30'); await closeAll(q);
      const n = await q.locator('#view .log').count();
      if (n) { await q.locator('#view .log').first().click(); ok(await q.locator('dialog [data-act="logDel"]').count() === 1, label + ' → 紀錄可以修改刪除'); await closeAll(q); }
      ok(!(await q.locator('#view').innerText()).includes('Infinity') && !(await q.locator('#view').innerText()).includes('NaN'), label + ' → 沒有 Infinity／NaN');
      eq(q._errs.length, 0, label + ' → 沒有錯誤：' + q._errs.join(' | '));
      await q.context().close();
    }
    // 損毀的內容會另存一份
    p = await page({ now: today, state: '{bad' });
    eq(await p.evaluate(k => localStorage.getItem(k + '-damaged'), KEY), '{bad', '損毀的原文另外留存');
    ok(!(await p.locator('#view').innerText()).includes('無法儲存資料'), '損毀不等於無法儲存');

    /* ===== 3. 網址 hash 不能對到物件原型 ===== */
    for (const h of ['#__proto__', '#constructor', '#toString', '#hasOwnProperty', '#nope']) {
      const q = await page({ now: today, hash: h });
      eq(await q.locator('.hero-title').count(), 1, h + ' 顯示今日');
      eq(q._errs.length, 0, h + ' 沒有錯誤');
      await q.context().close();
    }

    /* ===== 4. 第一次開啟就存下開始日，之後不漂移 ===== */
    p = await page({ now: '2026-10-06' });
    st = await state(p);
    ok(st && st.set.start === '2026-10-05', '第一次開啟已存下開始日');
    await p.addInitScript(() => { window.__BMT_NOW__ = '2026-10-09'; });
    await p.evaluate(() => { window.__BMT_NOW__ = '2026-10-09'; });
    await p.reload(); await p.waitForSelector('#view > *');
    ok(!(await p.locator('#view').innerText()).includes('計畫從'), '週五再開仍是第 1 週，不會變成下週才開始');

    /* ===== 5. 開始日在很久以後：顯示第一堂，而不是「每一天都設成休息」 ===== */
    p = await page({ now: '2026-10-06', state: Object.assign(base(), { set: Object.assign(base().set, { start: '2027-03-01' }) }) });
    ok((await p.locator('#view').innerText()).includes('計畫從 3/1 週一開始'));
    ok(!(await p.locator('#view').innerText()).includes('每一天都設成休息'));
    ok((await p.locator('#view').innerText()).includes('第一堂，3/2 週二'), '預覽第一堂');
    // 真的全休才顯示提示
    p = await page({ now: '2026-10-06', state: Object.assign(base(), { set: Object.assign(base().set, { days: Array(7).fill('rest') }) }) });
    ok((await p.locator('#view').innerText()).includes('每一天都設成休息'));
    await nav(p, 'plan'); ok((await p.locator('.day.is-rest').count()) === 7);
    // 七天都排場上
    p = await page({ now: '2026-10-06', state: Object.assign(base(), { set: Object.assign(base().set, { days: Array(7).fill('court') }) }) });
    eq(await p.locator('.hero-title').innerText(), '前後場連貫'); await nav(p, 'plan'); eq(await p.locator('button.day').count(), 7);

    /* ===== 6. 一天可以做不只一堂：各自記錄，互不覆蓋 ===== */
    p = await page({ now: '2026-10-06', state: base() });
    for (let i = 0; i < 5; i++) await p.locator('.ck').nth(i).check();
    await nav(p, 'menu'); await p.locator('.card').nth(2).click(); await p.click('dialog [data-act="do"]');          // 居家球感
    eq(await p.locator('.hero-title').innerText(), '居家球感 20 分');
    eq(await p.locator('.ck:checked').count(), 0);
    await p.locator('.ck').nth(0).check();
    await p.click('[data-act="unover"]');
    eq(await p.locator('.hero-title').innerText(), '基本功：高遠球與發球');
    eq(await p.locator('.ck:checked').count(), 5, '換回計畫的課表，原本的勾還在');
    await p.click('[data-act="finish"]'); await p.click('[data-act="finishSave"]'); await p.waitForSelector('dialog.sheet', { state: 'detached' });
    eq(await p.locator('[data-act="finish"]').count(), 0);
    // 再加做一份菜單並完成，換回來不會要你重新完成
    await nav(p, 'menu'); await p.locator('.card').nth(2).click(); await p.click('dialog [data-act="do"]');
    eq(await p.locator('.ck:checked').count(), 1, '另一份菜單的勾也還在');
    await p.click('[data-act="finish"]'); await p.click('[data-act="finishSave"]'); await p.waitForSelector('dialog.sheet', { state: 'detached' });
    await p.click('[data-act="unover"]');
    eq(await p.locator('[data-act="finish"]').count(), 0, '原本那堂仍是已完成');
    st = await state(p); eq(st.logs.length, 2, '兩堂各一筆紀錄，沒有重複');
    // 把紀錄的日期改到昨天：今天變回未完成
    await p.click('#view [data-act="editLog"]'); await p.fill('#f-date', '2026-10-05'); await p.click('[data-act="logSave"]'); await p.waitForSelector('dialog.sheet', { state: 'detached' });
    eq(await p.locator('[data-act="finish"]').count(), 1, '紀錄移到別天後，今天可以重新完成');

    /* ===== 7. 跨過午夜沒有重新整理：打勾仍記在畫面上那一天 ===== */
    p = await page({ now: '2026-10-06', state: base() });
    await p.evaluate(() => { window.__BMT_NOW__ = '2026-10-08'; });
    await p.locator('.ck').nth(1).check();
    st = await state(p);
    ok(st.day['2026-10-06'] && st.day['2026-10-06'].p1cA.ck['0-1'] === 1 && !st.day['2026-10-08'], '勾選記在 10/6 的基本功');
    await p.click('[data-act="finish"]'); await p.click('[data-act="finishSave"]'); await p.waitForSelector('dialog.sheet', { state: 'detached' });
    st = await state(p); eq(st.logs[0].date, '2026-10-06'); eq(st.logs[0].sid, 'p1cA');

    /* ===== 8. 再來一輪：上一輪的檢測收起來 ===== */
    p = await page({ now: '2027-01-05', state: Object.assign(base(), { tests: { w0: { six: 30 }, w12: { six: 25 } } }) });
    await p.click('[data-act="restart"][data-up="0"]');
    st = await state(p); eq(JSON.stringify(st.tests), '{}'); eq(st.arch.length, 1); eq(st.arch[0].tests.w12.six, 25); eq(st.arch[0].start, '2026-10-05');

    /* ===== 9. 鍵盤：開始日可以逐段輸入；重繪後焦點留在同一顆按鈕 ===== */
    p = await page({ vp: { width: 1280, height: 900 }, now: '2026-10-06', state: base() });
    await p.click('#setBtn'); await p.waitForSelector('#s-start');
    await p.locator('#s-start').focus();
    await p.keyboard.type('11092026');                                // zh-TW 的日期欄位依序是 年/月/日 或 月/日/年，兩種都試
    let v = await p.inputValue('#s-start');
    if (v !== '2026-11-09') { await p.locator('#s-start').fill(''); await p.locator('#s-start').focus(); await p.keyboard.type('20261109'); v = await p.inputValue('#s-start'); }
    eq(v, '2026-11-09', '鍵盤輸入不會被打斷');
    eq(await p.evaluate(() => document.activeElement.id), 's-start', '輸入時焦點留在欄位');
    eq((await state(p)).set.start, '2026-11-09');
    await p.locator('[data-act="setDay"][data-i="2"][data-v="court"]').focus(); await p.keyboard.press('Enter');
    eq(await p.evaluate(() => { const a = document.activeElement; return a.getAttribute('data-act') + a.getAttribute('data-i') + a.getAttribute('data-v'); }), 'setDay2court', '設定重繪後焦點還在同一顆');
    await p.keyboard.press('Tab'); await p.keyboard.press('Enter');     // 下一顆是「場外」
    eq((await state(p)).set.days[2], 'off');
    await closeAll(p);
    await p.click('[data-act="timer"]');
    await p.locator('[data-act="step"][data-f="work"][data-d="1"]').focus();
    await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
    eq(await p.locator('#o-work').innerText(), '35秒', 'Enter 連按三次加三次');
    await closeAll(p);
    await p.click('[data-act="score"]'); await p.click('[data-act="sbStart"]');
    await p.locator('[data-act="sbPt"][data-side="0"]').focus(); await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
    eq(await p.locator('[data-act="sbPt"][data-side="0"] .sc').innerText(), '2', 'Enter 兩次得 2 分');
    await closeAll(p);
    await nav(p, 'plan'); await p.locator('[data-act="pickWeek"][data-w="3"]').focus(); await p.keyboard.press('Enter');
    eq(await p.evaluate(() => document.activeElement.getAttribute('data-w')), '3', '選週次後焦點留在那一格');
    // 色塊上的焦點框看得見
    p = await page({ now: '2026-10-04' });
    await p.locator('.hero [data-act="tests"]').focus();
    await p.keyboard.press('Tab'); await p.keyboard.press('Shift+Tab');
    eq(await p.evaluate(() => getComputedStyle(document.querySelector('.hero [data-act="tests"]')).outlineColor), 'rgb(255, 255, 255)', '綠底上的焦點框是白色');

    /* ===== 10. 計時器：10 分鐘以上不撐寬；從課表開的計時器加組數有合理的組間休息；關閉不留計時 ===== */
    for (const w of [320, 360, 390, 430]) {
      const q = await page({ vp: { width: w, height: 780 }, now: '2026-10-06', state: base() });
      await q.locator('.row-t').nth(2).click();                        // 對拉高遠球 10 分鐘
      await q.click('[data-act="step"][data-f="prep"][data-d="-1"]'); await q.click('[data-act="tmStart"]'); await q.waitForTimeout(300);
      ok(/^(10:00|9:59)$/.test(await q.locator('#tmT').innerText()));
      ok((await sheetOverflow(q)).every(x => x <= 0), w + 'px：10:00 不會撐寬 ' + JSON.stringify(await sheetOverflow(q)));
      await q.keyboard.press('Escape'); await q.waitForSelector('dialog.sheet', { state: 'detached' });
      await q.waitForTimeout(250); eq(q._errs.length, 0, '執行中關閉沒有錯誤');
      await q.context().close();
    }
    p = await page({ now: '2026-10-06', state: base() });
    await p.locator('.row-t').nth(0).click();
    await p.click('[data-act="step"][data-f="sets"][data-d="1"]');
    eq(await p.locator('#o-setRest').innerText(), '2:00', '組間休息預設 2 分鐘');
    await closeAll(p);
    // 局間休息直接開始倒數
    await p.click('[data-act="score"]'); await p.click('[data-act="sbStart"]');
    for (let i = 0; i < 11; i++) await p.click('[data-act="sbPt"][data-side="0"]');
    await p.click('[data-act="sbRest"]'); await p.waitForSelector('#tmStage');
    eq(await p.getAttribute('#tmStage', 'data-ph'), 'work'); ok(/^(1:00|59)$/.test(await p.locator('#tmT').innerText()), '局中休息直接倒數 60 秒');
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    ok(await p.locator('dialog.sheet[open] .sb').count() === 1, '關掉計時器回到計分板');
    await closeAll(p);

    /* ===== 11. 面板：在裡面拖曳選字、放開在外面，不會關掉 ===== */
    p = await page({ now: '2026-10-06', state: base(), hash: '#log' });
    await p.click('[data-act="restore"]'); await p.fill('#rs-text', '一些貼上的文字');
    const box = await p.locator('#rs-text').boundingBox();
    await p.mouse.move(box.x + 30, box.y + 20); await p.mouse.down(); await p.mouse.move(box.x + 30, 20, { steps: 4 }); await p.mouse.up();
    await p.waitForTimeout(100);
    eq(await p.locator('dialog.sheet[open]').count(), 1, '拖曳選字後面板還在'); eq(await p.inputValue('#rs-text'), '一些貼上的文字');
    await p.mouse.click(195, 30); await p.waitForTimeout(100);
    eq(await p.locator('dialog.sheet[open]').count(), 0, '直接點背景可以關閉');

    /* ===== 12. 窄螢幕：每個分頁和面板都不橫向溢出 ===== */
    const long = '羽球國手等級的超長名字啊';
    for (const w of [320, 360]) {
      const q = await page({ vp: { width: w, height: 700 }, now: '2026-10-06', state: Object.assign(base(), { sb: { names: [[long, long], [long, 'WWWWWWWWWWWW']], mode: 'D' },
        tests: { w0: { six: 30, rope: 110 }, w4: { six: 28, rope: 120 }, w8: { six: 27, rope: 130 }, w12: { six: 26, rope: 140 } }, logs: [{ id: 'a', date: '2026-10-05', kind: 'court', title: '很長很長的訓練名稱很長很長的訓練名稱很長很長', min: 600, rpe: 10, note: '備註' }] }) });
      const chk = async where => ok((await sheetOverflow(q)).every(x => x <= 0), w + 'px ' + where + ' 不溢出 ' + JSON.stringify(await sheetOverflow(q)));
      for (const tab of ['today', 'plan', 'menu', 'learn', 'log']) { await nav(q, tab); await chk(tab); }
      await q.locator('#view [data-act="tests"]').first().click(); await chk('檢測面板'); await closeAll(q);
      await q.locator('#view .log').first().click(); await chk('紀錄面板'); await closeAll(q);
      await q.click('#setBtn'); await chk('設定'); await closeAll(q);
      await nav(q, 'today');
      await q.click('[data-act="score"]'); await chk('計分設定'); await q.click('[data-act="sbStart"]'); await chk('計分板');
      for (let i = 0; i < 11; i++) await q.click('[data-act="sbPt"][data-side="0"]'); await chk('計分板訊息'); await closeAll(q);
      await q.click('[data-act="caller"]'); await chk('步法點位'); await closeAll(q);
      await q.click('[data-act="timer"]'); await chk('計時器'); await closeAll(q);
      await nav(q, 'menu'); await q.locator('.card').first().click(); await chk('菜單預覽'); await q.click('dialog [data-act="do"]');
      const tw = await q.evaluate(() => { const t = document.getElementById('toast'); const r = t.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), window.innerWidth, Math.round(r.height)]; });
      ok(tw[0] >= 0 && tw[1] <= tw[2] && tw[3] < 60, w + 'px 提示訊息在畫面內且不折成多行 ' + JSON.stringify(tw));
      eq(q._errs.length, 0);
      await q.context().close();
    }

    /* ===== 13. 加量週看得出差別；菜單的時間照標示 ===== */
    p = await page({ now: '2026-10-15', state: base() });                // 第 2 週（加量）週四：場外綜合
    const rx = await p.locator('.row-rx').allInnerTexts();
    p = await page({ now: '2026-10-08', state: base() });                // 第 1 週（基準）
    const rx0 = await p.locator('.row-rx').allInnerTexts();
    ok(rx.join('|') !== rx0.join('|'), '加量週的份量和基準週不同');
    ok(rx.includes('4 組 × 12 下') && rx0.includes('3 組 × 12 下'), '深蹲：基準 3 組 → 加量 4 組');
    await nav(p, 'menu'); await p.locator('.card', { hasText: '肩肘保養' }).click();
    ok((await p.locator('dialog .pills').innerText()).includes('約 12 分鐘'));

    /* ===== 14. 沒有語音的裝置：改用提示音並告知 ===== */
    p = await page({ now: '2026-10-06', state: Object.assign(base(), { set: Object.assign(base().set, { voice: true, sound: true }) }) });
    await p.click('[data-act="caller"]'); await p.click('[data-act="clStart"]');
    const noVoice = await p.evaluate(() => !('speechSynthesis' in window) || window.speechSynthesis.getVoices().length === 0);
    if (noVoice && await p.evaluate(() => 'speechSynthesis' in window)) ok((await p.locator('#toast').innerText()).includes('改用提示音'), '沒有語音時有提示');
    await closeAll(p);

    /* ===== 15. Claude 頁面檢視器的下載功能（模擬平台的 window.claude） ===== */
    const claudeStub = cfg => {
      window.__saves = [];
      window.__dlNext = cfg.reject || '';
      const ns = Object.freeze({
        save: req => {
          window.__saves.push({ filename: req.filename, data: req.data });
          const r = window.__dlNext;
          return new Promise((res, rej) => setTimeout(() => r ? rej({ code: r, message: r }) : res({ status: 'saved' }), cfg.saveDelay || 30));
        }
      });
      window.claude = Object.freeze({
        use: name => {
          if (cfg.throws) throw new Error('boom');
          return new Promise(res => setTimeout(() => res(name === 'downloads' && cfg.ns ? ns : null), cfg.delay || 0));
        }
      });
    };
    const openBk = async q => { await nav(q, 'log'); await q.click('[data-act="backup"]'); await q.waitForSelector('dialog.sheet[open] #bk-text'); };
    const logged = Object.assign(base(), { logs: [{ id: 'a', date: '2026-10-05', kind: 'court', title: '基本功', min: 90, rpe: 6, note: '' }] });

    // 平台有下載功能：出現按鈕，按下去把檔名和內容交給平台
    p = await page({ now: '2026-10-06', state: logged, init: [claudeStub, { ns: true, saveDelay: 200 }] });
    await openBk(p);
    eq(await p.locator('dialog [data-act="bkFile"]').count(), 1, '檢視器有下載功能時顯示下載備份檔');
    await p.click('[data-act="bkFile"]'); await p.click('[data-act="bkFile"]');           // 確認視窗還沒回覆時再按一次
    await p.waitForFunction(() => /已下載備份檔/.test((document.getElementById('toast') || {}).textContent || ''));
    const saves = await p.evaluate(() => window.__saves);
    eq(saves.length, 1, '確認視窗沒回覆前不重複送出');
    eq(saves[0].filename, 'badminton-backup-2026-10-06.json');
    eq(typeof saves[0].data, 'string');
    const saved = JSON.parse(saves[0].data);
    ok(saved.logs.length === 1 && saved.set.level === 1 && saved.logs[0].title === '基本功', '交出去的是完整備份');
    eq(await p.locator('dialog [data-act="bkFile"]').getAttribute('aria-busy'), null, '完成後按鈕恢復');
    // 使用者在確認視窗按取消：說明沒有下載，按鈕留著
    await p.evaluate(() => { window.__dlNext = 'declined'; });
    await p.click('[data-act="bkFile"]');
    await p.waitForFunction(() => /已取消/.test(document.getElementById('toast').textContent));
    eq(await p.locator('dialog [data-act="bkFile"]').count(), 1);
    // 太頻繁
    await p.evaluate(() => { window.__dlNext = 'rate_limited'; });
    await p.click('[data-act="bkFile"]');
    await p.waitForFunction(() => /稍等/.test(document.getElementById('toast').textContent));
    eq(await p.locator('dialog [data-act="bkFile"]').count(), 1);
    // 平台說不能存檔（含沒看過的代碼）：收起按鈕，請使用者改用複製
    await p.evaluate(() => { window.__dlNext = 'some_future_code'; });
    await p.click('[data-act="bkFile"]');
    await p.waitForFunction(() => /改用複製備份文字/.test(document.getElementById('toast').textContent));
    eq(await p.locator('dialog [data-act="bkFile"]').count(), 0, '不能存檔時收起按鈕');
    ok(await p.locator('dialog [data-act="bkCopy"]').isVisible(), '複製備份文字還在');
    await closeAll(p); await openBk(p);
    eq(await p.locator('dialog [data-act="bkFile"]').count(), 0, '重開面板也不再顯示');
    eq(p._errs.length, 0); await p.context().close();

    // 平台晚一點才回覆：備份面板已經開著，按鈕補上去
    p = await page({ now: '2026-10-06', state: logged, init: [claudeStub, { ns: true, delay: 1200 }] });
    await openBk(p);
    eq(await p.locator('dialog [data-act="bkFile"]').count(), 0);
    await p.waitForSelector('dialog [data-act="bkFile"]', { timeout: 5000 });
    eq(await p.locator('dialog .sheet-f button').count(), 2, '補上的按鈕只有一顆');
    await p.click('[data-act="bkFile"]');
    await p.waitForFunction(() => /已下載備份檔/.test((document.getElementById('toast') || {}).textContent || ''));
    eq(p._errs.length, 0); await p.context().close();

    // 平台沒有這個功能、或 use 本身出錯：不顯示按鈕，其他照常
    for (const cfg of [{ ns: false }, { throws: true }]) {
      p = await page({ now: '2026-10-06', state: logged, init: [claudeStub, cfg] });
      await p.waitForTimeout(150);
      await openBk(p);
      eq(await p.locator('dialog [data-act="bkFile"]').count(), 0, '沒有下載功能時不顯示按鈕 ' + JSON.stringify(cfg));
      ok(JSON.parse(await p.inputValue('#bk-text')).logs.length === 1, '備份文字照常');
      eq(p._errs.length, 0); await p.context().close();
    }

    /* ===== 16. 第一次使用：設定提示緊接在主畫面下方、課表之前 ===== */
    const hintPos = q => q.evaluate(() => {
      const hero = document.querySelector('#view .hero'), hint = Array.from(document.querySelectorAll('#view .note-box')).find(n => n.textContent.includes('預設值'));
      const firstRow = document.querySelector('#view .row-main, #view .ck');
      const y = el => el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null;
      return { hero: y(hero), hint: y(hint), row: y(firstRow), next: hint && hero ? hero.nextElementSibling === hint : false, text: hint ? hint.textContent : '' };
    });
    for (const day of ['2026-10-04', '2026-10-06', '2026-10-07']) {       // 開始前（週日）、訓練日（週二）、休息日（週三）
      p = await page({ now: day });
      const hp = await hintPos(p);
      ok(hp.hint !== null && hp.next && hp.hint > hp.hero && hp.hint < hp.row, day + ' 提示緊接在主畫面之後、課表之前 ' + JSON.stringify([hp.hero, hp.hint, hp.row]));
      ok(hp.hint < 844, day + ' 手機第一個畫面就看得到提示（y=' + hp.hint + '）');
      ok(hp.text.includes('中階，每週場上 2 天、場外 1 天'), '提示說明目前的預設值');
      await p.context().close();
    }
    // 按「先這樣」：提示收起，重新整理後也不再出現
    p = await page({ now: '2026-10-06' });
    await p.click('[data-act="hintOff"]');
    eq((await hintPos(p)).hint, null);
    eq((await state(p)).setup, true);
    await p.reload(); await p.waitForSelector('#view > *');
    eq((await hintPos(p)).hint, null, '重新整理後不再提示');
    await p.context().close();
    // 按「調整設定」：改成入門，關掉面板後提示消失、課表換成入門的份量
    p = await page({ now: '2026-10-06' });
    const rxMid = (await p.locator('.row-rx').allInnerTexts()).join('|');
    await p.click('#view .note-box [data-act="settings"]');
    await p.waitForSelector('dialog.sheet[open]');
    await p.click('dialog [data-act="setLevel"][data-v="0"]');
    await p.click('dialog .sheet-f [data-act="close"]');
    await p.waitForSelector('dialog.sheet', { state: 'detached' });
    eq((await hintPos(p)).hint, null, '改過設定後不再提示');
    eq((await state(p)).set.level, 0);
    ok((await p.locator('.row-rx').allInnerTexts()).join('|') !== rxMid, '課表換成入門的份量');
    eq(p._errs.length, 0); await p.context().close();
  } catch (e) {
    errors.push('[assert] ' + String(e.message || e).split('\n').slice(0, 4).join(' | '));
  }
  await browser.close();
  console.log(passed + ' 項檢查通過');
  console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].slice(0, 20).join('\n') : 'no errors');
  process.exit(errors.length ? 1 : 0);
})();
