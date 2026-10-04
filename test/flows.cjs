const { chromium } = require('playwright');
const path = require('node:path');
const assert = require('node:assert/strict');
const wrap = require('./wrap.cjs');
const OUT = path.join(__dirname, '..', 'out', 'shots');
const KEY = 'badminton-handbook-v1';

(async () => {
  const file = wrap();
  const browser = await chromium.launch();
  const errors = [];
  let passed = 0;
  const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
  const eq = (a, b, msg) => { assert.equal(a, b, msg); passed++; };
  async function page(opts) {
    const ctx = await browser.newContext({ viewport: opts.vp || { width: 390, height: 844 }, colorScheme: opts.dark ? 'dark' : 'light', deviceScaleFactor: 2, locale: 'zh-TW' });
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
    p.on('pageerror', e => errors.push('[pageerror] ' + e.message));
    if (opts.now) await p.addInitScript(d => { window.__BMT_NOW__ = d; }, opts.now);
    if (opts.noStorage) await p.addInitScript(() => { Storage.prototype.getItem = () => { throw new Error('blocked'); }; Storage.prototype.setItem = () => { throw new Error('blocked'); }; });
    await p.goto('file://' + file + (opts.hash || ''));
    if (opts.state) {   // 先載入、寫入起始資料、再重新載入（不用 init script 判斷空值，避免在文件建立瞬間讀到空的儲存空間）
      await p.evaluate(a => localStorage.setItem(a.k, a.s), { k: KEY, s: JSON.stringify(opts.state) });
      await p.reload(); await p.waitForSelector('#view > *');
    }
    return p;
  }
  const shot = async (p, name, full) => { await p.waitForTimeout(200); await p.screenshot({ path: path.join(OUT, name + '.png'), fullPage: !!full }); };
  const state = p => p.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  const base = { set: { level: 1, days: ['rest', 'court', 'rest', 'off', 'rest', 'court', 'rest'], start: '2026-10-05', sys: 21, sound: false, voice: false, kg: null }, logs: [] };

  try {
    /* ===== 今日：動作說明、打勾、完成 ===== */
    let p = await page({ now: '2026-10-06', state: base });
    eq(await p.locator('.hero-title').innerText(), '基本功：高遠球與發球');
    eq(await p.locator('.ck').count(), 16);
    await p.locator('.row-main').nth(8).click();                      // 對拉高遠球
    await p.waitForSelector('dialog.sheet[open]');
    eq(await p.locator('dialog.sheet h2').innerText(), '對拉高遠球');
    ok((await p.locator('dialog.sheet .ex-rx b').innerText()).includes('10 分鐘'));
    ok(await p.locator('dialog.sheet a.link').getAttribute('href').then(h => h.startsWith('https://www.youtube.com/results?search_query=')));
    await shot(p, '20-sheet-ex');
    await p.keyboard.press('Escape');
    await p.waitForSelector('dialog.sheet', { state: 'detached' });
    ok(!(await p.evaluate(() => document.documentElement.classList.contains('lock'))), '關閉後解除捲動鎖定');

    /* ===== 計時器 ===== */
    await p.locator('.row-t').nth(0).click();                          // 提升體溫 3 分鐘
    await p.waitForSelector('dialog.sheet[open] .tm');
    eq(await p.locator('#o-work').innerText(), '3:00');
    eq(await p.locator('#o-rounds').innerText(), '1回');
    await p.click('[data-act="tmPreset"][data-i="2"]');                // 20／10 × 8
    eq(await p.locator('#o-work').innerText(), '20秒');
    ok((await p.locator('.tm-sum').innerText()).includes('3 分 50 秒'));   // 20×8 + 10×7 = 230 秒
    await p.click('[data-act="step"][data-f="prep"][data-d="-1"]');    // 準備 5 → 0
    await shot(p, '21-timer-cfg');
    await p.click('[data-act="tmStart"]');
    await p.waitForTimeout(700);
    eq(await p.getAttribute('#tmStage', 'data-ph'), 'work');
    ok(/^(20|19)$/.test(await p.locator('#tmT').innerText()));
    eq(await p.locator('#tmS').innerText(), '第 1 / 8 回');
    await shot(p, '22-timer-work');
    await p.click('[data-act="tmSkip"]'); await p.waitForTimeout(200);
    eq(await p.getAttribute('#tmStage', 'data-ph'), 'rest');
    await shot(p, '23-timer-rest');
    await p.click('[data-act="tmPause"]');
    eq(await p.locator('#tmPauseBtn').innerText(), '繼續');
    const t1 = await p.locator('#tmT').innerText(); await p.waitForTimeout(1300);
    eq(await p.locator('#tmT').innerText(), t1, '暫停時不倒數');
    await p.click('[data-act="tmPause"]'); await p.waitForTimeout(1300);
    ok(+(await p.locator('#tmT').innerText()) < +t1, '繼續後倒數');
    for (let i = 0; i < 14; i++) { await p.click('[data-act="tmSkip"]'); await p.waitForTimeout(40); }
    await p.waitForTimeout(300);
    eq(await p.getAttribute('#tmStage', 'data-ph'), 'done');
    eq(await p.locator('#tmPh').innerText(), '完成');
    await shot(p, '24-timer-done');
    await p.click('dialog.sheet [data-act="close"] >> nth=0');
    await p.waitForSelector('dialog.sheet', { state: 'detached' });

    /* ===== 步法點位 ===== */
    await p.click('[data-act="caller"]');
    await p.waitForSelector('dialog.sheet[open] .caller');
    await shot(p, '25-caller-cfg', false);
    await p.locator('[data-act="clToggle"][data-id="3"]').click();
    await p.locator('[data-act="clToggle"][data-id="4"]').click();
    eq(await p.locator('.cc-pt.off').count(), 2);
    await p.click('[data-act="step"][data-f="gap"][data-d="-1"]');     // 2.5 → 2
    eq(await p.locator('#o-gap').innerText(), '2秒');
    await p.click('[data-act="clStart"]');
    await p.waitForTimeout(600);
    ok((await p.locator('#clNow').innerText()).startsWith('準備'));
    await p.waitForTimeout(5200);
    const nm = await p.locator('#clNow').innerText();
    ok(['左前', '右前', '左後', '右後'].includes(nm), '喊出的點位：' + nm);
    eq(await p.locator('.cc-pt.on').count(), 1);
    ok((await p.locator('#clCnt').innerText()).startsWith('1 / 20'));
    await shot(p, '26-caller-run');
    await p.waitForTimeout(2100);
    const nm2 = await p.locator('#clNow').innerText();
    ok(nm2 !== nm, '下一點不重複：' + nm + ' → ' + nm2);
    await p.click('[data-act="clBack"]');
    await p.waitForSelector('dialog.sheet[open] [data-act="clStart"]');
    await p.keyboard.press('Escape');
    await p.waitForSelector('dialog.sheet', { state: 'detached' });

    /* ===== 計分板 ===== */
    await p.click('[data-act="score"]');
    await p.waitForSelector('dialog.sheet[open] .sb');
    await shot(p, '27-score-setup');
    await p.click('[data-act="sbStart"]');
    eq(await p.locator('.sb-serve').innerText(), '我 從右區發球，對手 1 接發');
    await p.click('[data-act="sbPt"][data-side="0"]');                 // 1:0 我方續發、換到左區
    eq(await p.locator('.sb-serve').innerText(), '我 從左區發球，對手 2 接發');
    await p.click('[data-act="sbPt"][data-side="1"]');                 // 1:1 對方奇數 → 左區的人（對手 2）發
    eq(await p.locator('.sb-serve').innerText(), '對手 2 從左區發球，我 接發');
    await p.click('[data-act="sbPt"][data-side="0"]');                 // 2:1 我方偶數 → 右區的人（隊友）發
    eq(await p.locator('.sb-serve').innerText(), '隊友 從右區發球，對手 1 接發');
    await shot(p, '28-score-play');
    await p.click('[data-act="sbUndo"]');
    eq(await p.locator('.sb-serve').innerText(), '對手 2 從左區發球，我 接發');
    for (let i = 0; i < 10; i++) await p.click('[data-act="sbPt"][data-side="0"]');   // 11:1
    ok((await p.locator('.sb-msg').innerText()).includes('局中休息 60 秒'));
    for (let i = 0; i < 10; i++) await p.click('[data-act="sbPt"][data-side="0"]');   // 21:1
    ok((await p.locator('.sb-msg').innerText()).includes('第 1 局結束 21:1'));
    ok(await p.locator('[data-act="sbPt"][data-side="0"]').isDisabled());
    await shot(p, '29-score-game-end');
    await p.click('[data-act="sbNext"]');
    eq(await p.locator('.sb-serve').innerText(), '我 從右區發球，對手 1 接發');
    for (let i = 0; i < 21; i++) await p.click('[data-act="sbPt"][data-side="0"]');
    ok((await p.locator('.sb-msg').innerText()).includes('2:0 獲勝'));
    await shot(p, '30-score-match-end');
    await p.click('[data-act="sbSave"]');
    let st = await state(p);
    eq(st.logs.length, 1); eq(st.logs[0].kind, 'match'); eq(st.logs[0].result, 'W'); eq(st.logs[0].score, '21-1、21-0');
    ok(await p.locator('[data-act="sbSave"]').isDisabled(), '存過就不能再存');
    await p.keyboard.press('Escape'); await p.waitForSelector('dialog.sheet', { state: 'detached' });
    await p.click('[data-act="score"]'); await p.waitForSelector('dialog.sheet[open] .sb');
    ok(await p.locator('[data-act="sbSave"]').isDisabled(), '重新打開計分板也不能重複存');
    await p.keyboard.press('Escape');
    await p.waitForSelector('dialog.sheet', { state: 'detached' });

    /* ===== 打勾與完成訓練 ===== */
    const n = await p.locator('.ck').count();
    for (let i = 0; i < n; i++) await p.locator('.ck').nth(i).check();
    eq(await p.locator('#progTxt').innerText(), '16 / 16 項');
    await p.click('[data-act="finish"]');
    await p.waitForSelector('dialog.sheet[open] #f-min');
    eq(await p.inputValue('#f-min'), '90');
    await p.click('.rpe [data-v="7"]');
    await p.fill('#f-note', '高遠球到位變多了 <b>test</b>');
    await shot(p, '31-finish-sheet');
    await p.click('[data-act="finishSave"]');
    await p.waitForSelector('dialog.sheet', { state: 'detached' });
    st = await state(p);
    eq(st.logs.length, 2); eq(st.logs[1].min, 90); eq(st.logs[1].rpe, 7); eq(st.logs[1].kind, 'court'); eq(st.logs[1].sid, 'p1cA'); eq(Object.keys(st.day['2026-10-06'].p1cA.ck).length, 16);
    ok((await p.locator('.view').innerText()).includes('今天的訓練已完成'));
    eq(await p.locator('[data-act="finish"]').count(), 0);
    eq(await p.locator('.wk.is-done').count(), 1);
    await shot(p, '32-today-done', true);

    /* ===== 重新載入後資料還在 ===== */
    await p.reload();
    await p.waitForSelector('.hero-title');
    const dbg = await p.evaluate(k => ({ ck: document.querySelectorAll('.ck').length, checked: document.querySelectorAll('.ck:checked').length, title: (document.querySelector('.hero-title') || {}).textContent, raw: String(localStorage.getItem(k)).slice(0, 260), len: String(localStorage.getItem(k)).length, tab: location.hash }), KEY);
    eq(dbg.checked, 16, '重新載入後打勾還在 ' + JSON.stringify(dbg).slice(0, 700));

    /* ===== 紀錄分頁 ===== */
    await p.click('#nav [data-tab="log"]');
    eq(await p.locator('.log').count(), 2);
    ok((await p.locator('.log-m').nth(0).innerHTML()).includes('&lt;b&gt;test&lt;/b&gt;') || (await p.locator('.log-m').nth(1).innerHTML()).includes('&lt;b&gt;test&lt;/b&gt;'), '備註有跳脫');
    await p.click('[data-act="addLog"] >> nth=0');
    await p.waitForSelector('dialog.sheet[open] #f-date');
    await p.click('[data-act="segPick"][data-v="off"]');
    await p.fill('#f-title', '健身房'); await p.fill('#f-min', '45'); await p.fill('#f-date', '2026-10-05');
    await shot(p, '33-log-sheet');
    await p.click('[data-act="logSave"]');
    await p.waitForSelector('dialog.sheet', { state: 'detached' });
    eq(await p.locator('.log').count(), 3);
    eq(await p.locator('.tile b').nth(0).innerText(), '3次');
    ok(await p.locator('#chartPlot svg').count() === 1, '有圖表');
    // 修改與刪除
    await p.locator('.log').nth(2).click();
    await p.waitForSelector('dialog.sheet[open] [data-act="logDel"]');
    await p.click('[data-act="logDel"]');
    eq(await p.locator('.log').count(), 3, '第一次按只是確認');
    await p.click('[data-act="logDel"]');
    eq(await p.locator('.log').count(), 3, '連點兩下不算確認');
    await p.waitForTimeout(500);
    await p.hover('[data-act="logDel"]');
    const dc = await p.evaluate(() => { const b = document.querySelector('[data-act="logDel"]'), cs = getComputedStyle(b); return cs.backgroundColor + '|' + cs.color; });
    ok(dc.startsWith('rgb(180, 35, 24)'), '確認中的按鈕滑鼠移上去仍是紅底：' + dc);
    await p.click('[data-act="logDel"]');
    await p.waitForSelector('dialog.sheet', { state: 'detached' });
    eq(await p.locator('.log').count(), 2);

    /* ===== 檢測 ===== */
    await p.click('[data-act="tests"] >> nth=0');
    await p.waitForSelector('dialog.sheet[open] #t-six');
    await p.fill('#t-six', '28.5'); await p.fill('#t-rope', '120');
    await p.click('[data-act="testPt"][data-k="w4"]');
    await p.fill('#t-six', '25'); await p.fill('#t-rope', '135');
    await shot(p, '34-tests-sheet');
    await p.keyboard.press('Escape');
    await p.waitForSelector('dialog.sheet', { state: 'detached' });
    st = await state(p);
    eq(st.tests.w0.six, 28.5); eq(st.tests.w4.rope, 135);
    const tt = await p.locator('.tbl.num-r').last().innerText();
    ok(/−3\.5\s*進步/.test(tt) && /\+15\s*進步/.test(tt), '檢測變化：' + tt.replace(/\s+/g, ' '));

    /* ===== 設定 ===== */
    await p.click('#setBtn');
    await p.waitForSelector('dialog.sheet[open] .opt');
    await shot(p, '35-settings', false);
    await p.click('[data-act="setLevel"][data-v="2"]');
    await p.click('[data-act="setDay"][data-i="0"][data-v="off"]');
    eq(await p.getAttribute('[data-act="setLevel"][data-v="2"]', 'aria-pressed'), 'true');
    ok((await p.locator('.set-days + .small').innerText()).includes('場外 2 天'));
    await p.fill('#s-start', '2026-10-14'); await p.dispatchEvent('#s-start', 'change');
    eq(await p.inputValue('#s-start'), '2026-10-14', '輸入途中不改動欄位');
    eq((await state(p)).set.start, '2026-10-12', '資料已對齊到週一');
    await p.locator('#s-start').blur();
    eq(await p.inputValue('#s-start'), '2026-10-12', '離開欄位後顯示對齊後的日期');
    await p.fill('#s-start', '2026-10-05'); await p.dispatchEvent('#s-start', 'change');
    await p.keyboard.press('Escape');
    await p.waitForSelector('dialog.sheet', { state: 'detached' });
    st = await state(p);
    eq(st.set.level, 2); eq(st.set.days[0], 'off'); eq(st.setup, true);

    /* ===== 計畫：預覽、今天做這份 ===== */
    await p.click('#nav [data-tab="plan"]');
    ok((await p.locator('.view').innerText()).includes('進階，每週場上 2 天、場外 2 天'));
    eq(await p.locator('.wkcell.is-now .num').innerText(), '1');
    await p.click('[data-act="pickWeek"][data-w="5"]');
    ok((await p.locator('.view').innerText()).includes('第 6 週'));
    ok((await p.locator('.view').innerText()).includes('強化期，加量週。計時的項目多一成'));
    await p.locator('button.day').nth(0).click();                       // 週一 場外 X
    await p.waitForSelector('dialog.sheet[open]');
    eq(await p.locator('dialog.sheet h2').innerText(), '爆發力與肌力');
    await shot(p, '36-preview-sheet');
    await p.click('dialog.sheet [data-act="do"]');
    await p.waitForSelector('dialog.sheet', { state: 'detached' });
    eq(await p.locator('.hero-title').innerText(), '爆發力與肌力');
    eq(await p.getAttribute('.hero', 'data-kind'), 'off');
    ok((await p.locator('.view').innerText()).includes('今天改做這份課表'));
    await shot(p, '37-today-override', false);
    await p.click('[data-act="unover"]');
    eq(await p.locator('.hero-title').innerText(), '基本功：高遠球與發球');

    /* ===== 菜單：預覽、動作搜尋、飲食試算 ===== */
    await p.click('#nav [data-tab="menu"]');
    eq(await p.locator('.card').count(), 15);
    await p.click('[data-act="menuWhere"][data-v="solo"]');
    ok((await p.locator('.card').count()) < 15);
    await p.click('[data-act="menuSeg"][data-v="ex"]');
    await p.fill('#exQ', '高遠');
    ok((await p.locator('#exList .li').count()) >= 1 && (await p.locator('#exList .li').count()) < 10);
    eq(await p.evaluate(() => document.activeElement.id), 'exQ', '搜尋時輸入框不失焦');
    await p.fill('#exQ', 'zzzz');
    ok((await p.locator('#exList').innerText()).includes('找不到符合的動作'));
    await p.click('[data-act="menuSeg"][data-v="diet"]');
    await p.fill('#kg', '80');
    ok((await p.locator('#calcOut').innerText()).includes('96–128 公克'));
    st = await state(p); eq(st.set.kg, 80);

    /* ===== 備份與還原 ===== */
    await p.click('#nav [data-tab="log"]');
    await p.click('[data-act="backup"]');
    await p.waitForSelector('dialog.sheet[open] #bk-text');
    const bk = await p.inputValue('#bk-text');
    ok(JSON.parse(bk).logs.length === 2);
    eq(await p.locator('[data-act="bkFile"]').count(), 0, 'Artifact 版在平台沒提供下載功能時不顯示下載');
    await shot(p, '38-backup');
    await p.keyboard.press('Escape');
    await p.waitForSelector('dialog.sheet', { state: 'detached' });
    await p.click('[data-act="wipe"]'); await p.waitForTimeout(500); await p.click('[data-act="wipe"]');
    eq((await state(p)).logs.length, 0);
    await p.click('[data-act="restore"]');
    await p.waitForSelector('dialog.sheet[open] #rs-text');
    await p.fill('#rs-text', '這不是備份');
    await p.click('[data-act="rsApply"]');
    ok(await p.locator('#rs-text').isVisible(), '無效內容不會還原');
    await p.fill('#rs-text', bk);
    await p.click('[data-act="rsApply"]'); await p.waitForTimeout(500); await p.click('[data-act="rsApply"]');
    await p.waitForSelector('dialog.sheet', { state: 'detached' });
    st = await state(p);
    eq(st.logs.length, 2); eq(st.set.level, 2); eq(st.tests.w4.rope, 135);

    /* ===== 多週資料的圖表、提示框、表格 ===== */
    const logs = [];
    [['2026-08-18', 'court', 90], ['2026-08-22', 'court', 120], ['2026-08-27', 'off', 40], ['2026-08-29', 'court', 120], ['2026-09-01', 'court', 90], ['2026-09-03', 'off', 45], ['2026-09-05', 'match', 150],
     ['2026-09-08', 'court', 90], ['2026-09-17', 'off', 30], ['2026-09-22', 'court', 90], ['2026-09-24', 'off', 50], ['2026-09-26', 'court', 100], ['2026-09-29', 'court', 90], ['2026-10-01', 'off', 45], ['2026-10-03', 'court', 110],
     ['2026-10-06', 'court', 90]].forEach((r, i) => logs.push({ id: 'x' + i, date: r[0], kind: r[1], title: r[1] === 'off' ? '下肢與核心肌力' : r[1] === 'match' ? '雙打比賽　對 球隊' : '基本功：高遠球與發球', min: r[2], rpe: 6, note: '', result: 'W', score: '21-18、21-17' }));
    for (const dark of [false, true]) {
      const q = await page({ now: '2026-10-07', state: Object.assign({}, base, { logs, tests: { w0: { six: 30, rope: 110, plank: 60 }, w4: { six: 27.5, rope: 125, plank: 75 } } }), hash: '#log', dark });
      eq(await q.locator('#chartPlot .c-col').count(), 8);
      eq(await q.locator('#chartPlot .c-court').count(), 7); eq(await q.locator('#chartPlot .c-off').count(), 5);
      await q.locator('#chartPlot .c-hit').nth(6).hover();
      ok((await q.locator('.tip').innerText()).includes('200 分鐘') && (await q.locator('.tip').innerText()).includes('45 分鐘'));
      await shot(q, dark ? '40-log-data-dark' : '39-log-data', true);
      if (!dark) {
        await q.click('[data-act="chartTable"]');
        ok((await q.locator('.chart .tbl').innerText()).includes('245'));
        const d = await page({ vp: { width: 1280, height: 900 }, now: '2026-10-07', state: Object.assign({}, base, { logs }), hash: '#log' });
        await d.locator('#chartPlot .c-hit').nth(2).focus();
        ok((await d.locator('.tip').innerText()).includes('8/31'), '鍵盤聚焦也有提示');
        await shot(d, '41-log-data-desktop', true);
      }
    }

    /* ===== 無法儲存的環境 ===== */
    const ns = await page({ now: '2026-10-06', noStorage: true });
    ok((await ns.locator('.view').innerText()).includes('無法儲存資料'));
    ok((await ns.locator('.hero-title').count()) === 1, '無法儲存時仍可使用');
    await ns.locator('.ck').nth(0).check();
    eq(await ns.locator('#progTxt').innerText(), '1 / 16 項');

    /* ===== 計畫結束後 ===== */
    const af = await page({ now: '2027-01-05', state: base });
    ok((await af.locator('.view').innerText()).includes('12 週計畫完成了'));
    eq(await af.locator('.hero-title').innerText(), '戰術情境');
    await shot(af, '42-after-plan');
    await af.click('[data-act="restart"][data-up="1"]');
    st = await state(af); eq(st.set.level, 2); eq(st.set.start, '2027-01-04');

    /* ===== 15 分制計分 ===== */
    const s15 = await page({ now: '2026-10-06', state: Object.assign({}, base, { sb: { names: [['阿明', ''], ['小華', '']], mode: 'S' } }) });
    await s15.click('[data-act="score"]');
    await s15.click('[data-act="sbSys"][data-v="15"]');
    await s15.click('[data-act="sbStart"]');
    eq(await s15.locator('.sb-serve').innerText(), '阿明 從右區發球，小華 接發');
    for (let i = 0; i < 8; i++) await s15.click('[data-act="sbPt"][data-side="1"]');
    ok((await s15.locator('.sb-msg').innerText()).includes('8 分，局中休息 60 秒'));
    eq(await s15.locator('.sb-serve').innerText(), '小華 從右區發球，阿明 接發');
    for (let i = 0; i < 7; i++) await s15.click('[data-act="sbPt"][data-side="1"]');
    ok((await s15.locator('.sb-msg').innerText()).includes('第 1 局結束 0:15'));
    await shot(s15, '43-score-15-singles');
  } catch (e) {
    errors.push('[assert] ' + (e.message || e).toString().split('\n').slice(0, 4).join(' | '));
  }
  await browser.close();
  console.log(passed + ' 項檢查通過');
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
  process.exit(errors.length ? 1 : 0);
})();
