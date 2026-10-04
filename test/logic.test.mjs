import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ctx = vm.createContext({ console, Math, Date, JSON, Set, Object, Array, String, Number, isNaN });
for (const f of ['data-ex.js', 'data-plan.js', 'data-learn.js', 'logic.js']) {
  vm.runInContext(fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8'), ctx, { filename: f });
}
const L = vm.runInContext(`({ EX, SESS, MENUS, PHASES, LOADS, LEARN, TESTS, CATS, validateData, weekIndex, planPos, weekSchedule, fmtRx, toolSpec, sessionMinutes,
  buildTimerSeq, seqTotal, fmtClock, fmtDur, sbNew, sbPoint, sbNextGame, sbUndo, sbSwap, sbInfo, sbWon, sbScoreText, weeklySeries, streakWeeks, axisFor,
  dietCalc, ymd, parseYmd, mondayOf, addDays, dow, dayDiff, itemsOf, countItems, nextCall, CALL_POINTS, isYmd, getSession, setsFor,
  cleanLogs, cleanTests, cleanDays, cleanOver, cleanNames, cleanArch })`, ctx);

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('data validates', () => { const e = L.validateData(); assert.deepEqual([...e], []); });
t('counts', () => {
  console.log('    動作', Object.keys(L.EX).length, '課表', Object.keys(L.SESS).length, '菜單', Object.keys(L.MENUS).length, '知識', L.LEARN.length);
});
t('dates', () => {
  assert.equal(L.ymd(L.mondayOf(L.parseYmd('2026-10-04'))), '2026-09-28');   // 週日 → 當週週一
  assert.equal(L.ymd(L.mondayOf(L.parseYmd('2026-10-05'))), '2026-10-05');
  assert.equal(L.dow(L.parseYmd('2026-10-04')), 6);
  assert.equal(L.dayDiff(L.parseYmd('2026-10-05'), L.parseYmd('2026-12-28')), 84);
  assert.equal(L.weekIndex('2026-10-04', '2026-10-05'), -1);
  assert.equal(L.weekIndex('2026-10-05', '2026-10-05'), 0);
  assert.equal(L.weekIndex('2026-10-11', '2026-10-05'), 0);
  assert.equal(L.weekIndex('2026-10-12', '2026-10-05'), 1);
  assert.equal(L.weekIndex('2026-12-27', '2026-10-05'), 11);
  assert.equal(L.weekIndex('2026-12-28', '2026-10-05'), 12);
  assert.ok(L.isYmd('2026-02-28')); assert.ok(!L.isYmd('abc'));
  assert.ok(!L.isYmd('2026-02-31')); assert.ok(!L.isYmd('2026-13-01')); assert.ok(!L.isYmd('0999-06-15')); assert.ok(!L.isYmd(20261004)); assert.ok(!L.isYmd('2026-1-1'));
  assert.ok(L.isYmd('2028-02-29')); assert.ok(!L.isYmd('2027-02-29'));
});
t('planPos', () => {
  const p = w => { const x = L.planPos(w); return [x.phase, x.wip, x.load.pct, x.after, x.before]; };
  assert.deepEqual(p(-1), [0, 0, 100, false, true]);
  assert.deepEqual(p(0), [0, 0, 100, false, false]);
  assert.deepEqual(p(3), [0, 3, 60, false, false]);
  assert.deepEqual(p(4), [1, 0, 100, false, false]);
  assert.deepEqual(p(11), [2, 3, 60, false, false]);
  assert.deepEqual(p(12), [2, 0, 100, true, false]);
  assert.deepEqual(p(15), [2, 3, 60, true, false]);
  assert.deepEqual(p(16), [2, 0, 100, true, false]);
});
t('weekSchedule', () => {
  const d = ['rest', 'court', 'rest', 'off', 'rest', 'court', 'rest'];
  const s0 = L.weekSchedule(d, 0).map(x => x.sid);
  assert.deepEqual([...s0], [null, 'p1cA', null, 'p1oM', null, 'p1cB', null]);
  const s5 = L.weekSchedule(d, 5).map(x => x.sid);
  assert.deepEqual([...s5], [null, 'p2cA', null, 'p2oM', null, 'p2cB', null]);
  // 一天場上：單雙週輪流 A/B
  const one = ['rest', 'rest', 'court', 'rest', 'rest', 'rest', 'rest'];
  assert.equal(L.weekSchedule(one, 0)[2].sid, 'p1cA'); assert.equal(L.weekSchedule(one, 1)[2].sid, 'p1cB');
  // 三天場上 + 三天場外
  const many = ['court', 'off', 'court', 'off', 'court', 'off', 'off'];
  assert.deepEqual([...L.weekSchedule(many, 8).map(x => x.sid)], ['p3cA', 'p3oX', 'p3cB', 'p3oY', 'cC', 'p3oZ', 'rec']);
  // 全休
  assert.ok(L.weekSchedule(Array(7).fill('rest'), 0).every(x => x.sid === null));
});
t('fmtRx + toolSpec', () => {
  const s = L.SESS.p1cA;
  assert.equal(L.fmtRx(s.blocks[2].items[0].rx, 1, 1), '10 分鐘');
  assert.equal(L.fmtRx(s.blocks[2].items[0].rx, 1, 1.2), '12 分鐘');
  assert.equal(L.fmtRx(s.blocks[2].items[0].rx, 1, 0.6), '6 分鐘');
  assert.equal(L.fmtRx(s.blocks[1].items[1].rx, 1, 1), '3 組 × 2 輪');
  assert.equal(L.fmtRx(s.blocks[1].items[1].rx, 1, 1.2), '4 組 × 2 輪');
  assert.equal(L.fmtRx(s.blocks[1].items[1].rx, 1, 0.6), '2 組 × 2 輪');
  assert.equal(L.fmtRx(s.blocks[1].items[1].rx, 1, 1.1, true), '4 組 × 2 輪');     // 加量週：輪到的項目多一組
  assert.equal(L.fmtRx(s.blocks[1].items[1].rx, 1, 1.1, false), '3 組 × 2 輪');
  assert.deepEqual([L.setsFor(2, 1), L.setsFor(2, 1.1, true), L.setsFor(2, 1.1, false), L.setsFor(2, 1.2), L.setsFor(2, 0.6), L.setsFor(3, 0.6), L.setsFor(1, 0.6)], [2, 3, 2, 3, 1, 2, 1]);
  const iv = L.SESS.p2oY.blocks[2].items[0].rx;
  assert.equal(L.fmtRx(iv, 1, 1), '20 秒／休 40 秒 × 8 回');
  assert.equal(L.fmtRx(iv, 2, 1.2), '30 秒／休 30 秒 × 12 回');
  const sp = L.toolSpec(iv, 1, 1); assert.equal(sp.t, 'timer'); assert.equal(sp.rounds, 8); assert.equal(sp.work, 20);
  const g2 = L.SESS.p3oY.blocks[2].items[0].rx;
  assert.equal(L.fmtRx(g2, 1, 1), '12 秒／休 18 秒 × 10 回 × 2 組');
  const call = L.SESS.p1oY.blocks[1].items[3].rx;
  assert.equal(L.fmtRx(call, 1, 1), '20 點 × 3 組（每 2.5 秒一點）');
  assert.equal(L.fmtRx(call, 0, 1), '16 點 × 2 組（每 3.5 秒一點）');
  assert.equal(L.sessionMinutes(L.MENUS.m_arm, 1, 1), 12);                         // 菜單照標示的時間，不取 5 的倍數
  assert.equal(L.toolSpec(call, 0, 1).t, 'call');
  assert.equal(L.toolSpec(L.SESS.p1oX.blocks[1].items[0].rx, 1, 1), null);
  assert.equal(L.sessionMinutes(L.SESS.p1cA, 1, 1), 90);
  assert.equal(L.sessionMinutes(L.SESS.p1cA, 1, 0.6), 70);
  assert.equal(L.sessionMinutes(L.SESS.p1cA, 1, 1.2), 100);
});
t('level filtering', () => {
  const b = L.SESS.p1cB.blocks[2];
  assert.deepEqual([...L.itemsOf(b, 0).map(i => i.x)], ['tc_drop_lift']);
  assert.deepEqual([...L.itemsOf(b, 1).map(i => i.x)], ['tc_four']);
  assert.deepEqual([...L.itemsOf(b, 2).map(i => i.x)], ['tc_four']);
});
t('timer seq', () => {
  const seq = L.buildTimerSeq({ work: 20, rest: 40, rounds: 3, sets: 2, setRest: 120 }, 5);
  assert.deepEqual([...seq.map(p => p.ph)], ['prep', 'work', 'rest', 'work', 'rest', 'work', 'setrest', 'work', 'rest', 'work', 'rest', 'work']);
  assert.equal(L.seqTotal(seq), 5 + (20 * 3 + 40 * 2) * 2 + 120);
  assert.equal(L.fmtClock(59.2), '60' === '60' ? '1:00' : ''); 
  assert.equal(L.fmtClock(9.01), '10'); assert.equal(L.fmtClock(125), '2:05'); assert.equal(L.fmtClock(0), '0');
  assert.equal(L.fmtDur(600), '10 分'); assert.equal(L.fmtDur(95), '1 分 35 秒'); assert.equal(L.fmtDur(40), '40 秒');
});
t('scoreboard: singles 21', () => {
  const s = L.sbNew({ mode: 'S', sys: 21, first: 0 });
  for (let i = 0; i < 20; i++) { L.sbPoint(s, 0); L.sbPoint(s, 1); }   // 20:20
  assert.deepEqual([...s.score], [20, 20]); assert.ok(!s.gameOver);
  L.sbPoint(s, 0); assert.ok(!s.gameOver);                               // 21:20 不算贏
  L.sbPoint(s, 0); assert.ok(s.gameOver); assert.deepEqual([...s.games], [1, 0]);   // 22:20
  L.sbNextGame(s); assert.equal(s.serving, 0); assert.equal(s.gameNo, 2);
  for (let i = 0; i < 29; i++) { L.sbPoint(s, 0); L.sbPoint(s, 1); }   // 29:29
  assert.deepEqual([...s.score], [29, 29]); assert.ok(!s.gameOver);
  L.sbPoint(s, 1); assert.ok(s.gameOver); assert.deepEqual([...s.games], [1, 1]);   // 29:30
  L.sbNextGame(s); assert.equal(s.serving, 1); assert.equal(s.gameNo, 3);
  for (let i = 0; i < 10; i++) L.sbPoint(s, 0);
  assert.equal(s.note, null); L.sbPoint(s, 0); assert.equal(s.note, 'mid3');        // 第三局 11 分換邊
  for (let i = 0; i < 10; i++) L.sbPoint(s, 0);
  assert.ok(s.over); assert.equal(s.winner, 0); assert.equal(L.sbScoreText(s), '22-20、29-30、21-0');
  const before = JSON.stringify(s.score); L.sbPoint(s, 1); assert.equal(JSON.stringify(s.score), before);   // 結束後不再加分
  L.sbUndo(s); assert.ok(!s.over); assert.deepEqual([...s.score], [20, 0]);
});
t('scoreboard: 15 system', () => {
  const s = L.sbNew({ mode: 'S', sys: 15, first: 1 });
  for (let i = 0; i < 7; i++) L.sbPoint(s, 1);
  assert.equal(s.note, null); L.sbPoint(s, 1); assert.equal(s.note, 'mid');         // 8 分局中休息
  for (let i = 0; i < 14; i++) L.sbPoint(s, 0);                                      // 14:8
  for (let i = 0; i < 6; i++) L.sbPoint(s, 1);                                       // 14:14
  assert.deepEqual([...s.score], [14, 14]);
  L.sbPoint(s, 0); assert.ok(!s.gameOver); L.sbPoint(s, 1);                          // 15:15
  for (let i = 0; i < 5; i++) { L.sbPoint(s, 0); L.sbPoint(s, 1); }                  // 20:20
  assert.deepEqual([...s.score], [20, 20]); assert.ok(!s.gameOver);
  L.sbPoint(s, 0); assert.ok(s.gameOver); assert.deepEqual([...s.score], [21, 20]);  // 上限 21
  assert.ok(L.sbWon(15, 13, 15)); assert.ok(!L.sbWon(15, 14, 15)); assert.ok(L.sbWon(16, 14, 15)); assert.ok(L.sbWon(21, 20, 15));
  assert.ok(L.sbWon(21, 19, 21)); assert.ok(!L.sbWon(21, 20, 21)); assert.ok(L.sbWon(30, 29, 21));
});
t('scoreboard: doubles rotation (BWF 範例)', () => {
  // 邊 0 = A(0)、B(1)；邊 1 = C(0)、D(1)。A 先發、C 先接
  const s = L.sbNew({ mode: 'D', sys: 21, first: 0 });
  const who = () => { const i = L.sbInfo(s); return ['AB', 'CD'][i.side][i.server] + (i.court ? '左' : '右') + '→' + ['AB', 'CD'][1 - i.side][i.receiver]; };
  assert.equal(who(), 'A右→C');
  L.sbPoint(s, 0); assert.equal(who(), 'A左→D');      // 1-0
  L.sbPoint(s, 1); assert.equal(who(), 'D左→A');      // 1-1
  L.sbPoint(s, 0); assert.equal(who(), 'B右→C');      // 2-1
  L.sbPoint(s, 1); assert.equal(who(), 'C右→B');      // 2-2
  L.sbPoint(s, 1); assert.equal(who(), 'C左→A');      // 2-3
  L.sbPoint(s, 0); assert.equal(who(), 'A左→C');      // 3-3
  L.sbPoint(s, 0); assert.equal(who(), 'A右→D');      // 4-3
  L.sbUndo(s); assert.equal(who(), 'A左→C');
  // 0:0 時可以對調誰站右區
  const s2 = L.sbNew({ mode: 'D', sys: 21, first: 0 }); L.sbSwap(s2, 0); L.sbSwap(s2, 1);
  const i2 = L.sbInfo(s2); assert.equal(i2.server, 1); assert.equal(i2.receiver, 1);
  L.sbPoint(s2, 0); L.sbSwap(s2, 0); assert.deepEqual([...s2.pos[0]], [1, 0] .reverse().reverse() && [...s2.pos[0]]);  // 開打後不可再調
});
t('stats', () => {
  const logs = [
    { date: '2026-10-06', kind: 'court', min: 90 }, { date: '2026-10-08', kind: 'off', min: 45 },
    { date: '2026-09-29', kind: 'match', min: 60 }, { date: '2026-09-15', kind: 'court', min: 30 }, { date: 'bad', kind: 'court', min: 10 }
  ];
  const w = L.weeklySeries(logs, '2026-10-09', 4);
  assert.deepEqual([...w.map(x => x.mon)], ['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05']);
  assert.deepEqual([...w.map(x => x.court)], [30, 0, 60, 90]); assert.deepEqual([...w.map(x => x.off)], [0, 0, 0, 45]);
  assert.equal(L.streakWeeks(logs, '2026-10-09'), 2);
  assert.equal(L.streakWeeks(logs, '2026-10-12'), 2);   // 新的一週還沒練，不中斷
  assert.equal(L.streakWeeks(logs, '2026-10-19'), 0);
  assert.deepEqual([...L.axisFor(135).ticks], [0, 60, 120, 180]); assert.equal(L.axisFor(0).max, 60); assert.equal(L.axisFor(1500).max, 1800);
});
t('diet + calls', () => {
  const d = L.dietCalc(70);
  assert.deepEqual([...d.proDay], [84, 112]); assert.deepEqual([...d.proMeal], [18, 28]); assert.deepEqual([...d.carbPre], [35, 70]); assert.equal(d.caf, 210);
  let prev = 0; for (let i = 0; i < 200; i++) { const c = L.nextCall([1, 2, 3, 4, 5, 6], prev); assert.notEqual(c, prev); prev = c; }
  assert.equal(L.nextCall([3], 3), 3);
});
t('資料清洗：惡意或格式錯誤的備份', () => {
  const J = v => JSON.parse(JSON.stringify(v));
  const evil = '"><img src=x onerror=alert(1)>';
  const logs = J(L.cleanLogs([
    { id: evil, date: '2026-10-06', kind: evil, title: evil, min: evil, rpe: evil, note: evil, sid: 'constructor', result: evil, score: evil },
    { id: 'ok-1', date: '2026-10-06', kind: 'match', title: 't', min: '1e999', rpe: 11, result: 'L', score: '21-3', sid: 'p1cA' },
    { id: 'ok-1', date: '2026-10-07', kind: 'off', min: -5, rpe: 7.4 },                       // 重複的 id 要換新的
    { id: 7, date: '2026-10-08', min: 45 }, { date: '2026-02-31' }, null, 'x', 42, { date: 'abc' }
  ]));
  assert.equal(logs.length, 4);
  assert.ok(logs.every(l => /^[\w-]{1,40}$/.test(l.id)), 'id 只留安全字元'); assert.equal(new Set(logs.map(l => l.id)).size, 4);
  assert.equal(logs[0].kind, 'court'); assert.equal(logs[0].min, 0); assert.equal(logs[0].rpe, null); assert.ok(!('sid' in logs[0])); assert.ok(!('result' in logs[0]));
  assert.equal(logs[0].title, evil.slice(0, 40));                                           // 文字欄位保留原文，顯示時再跳脫
  assert.equal(logs[1].min, 0); assert.equal(logs[1].rpe, null); assert.equal(logs[1].result, 'L'); assert.equal(logs[1].sid, 'p1cA');
  assert.equal(logs[2].min, 0); assert.equal(logs[2].rpe, 7); assert.equal(logs[3].min, 45);
  assert.deepEqual(J(L.cleanLogs('nope')), []); assert.deepEqual(J(L.cleanLogs({ length: 3 })), []);

  assert.deepEqual(J(L.cleanTests({ w0: { six: '28.55', rope: evil, plank: -1, zzz: 5, wall: null, line: true, serve: 12 }, w4: 'x', w9: { six: 1 }, __proto__: { six: 1 } })), { w0: { six: 28.6, serve: 12 } });
  assert.deepEqual(J(L.cleanTests(null)), {}); assert.deepEqual(J(L.cleanTests([1, 2])), {});

  const days = J(L.cleanDays({
    '2026-10-06': { sid: 'p1cA', ck: { '0-0': 1, '0-1': 0, 'x': 1, '99-99': 1, '100-1': 1 }, done: 1 },      // 舊格式
    '2026-10-07': { p1oM: { ck: { '1-0': true } }, constructor: { ck: {} }, toString: 1 },
    '2026-10-08': { p1cA: {} }, '2026-10-09': { p1cA: { ck: null } }, '2026-10-10': 'x', 'bad': { p1cA: { ck: {} } }, '2026-10-11': { sid: 'nope', ck: {} }
  }));
  assert.deepEqual(days, { '2026-10-06': { p1cA: { ck: { '0-0': 1, '99-99': 1 } } }, '2026-10-07': { p1oM: { ck: { '1-0': 1 } } }, '2026-10-08': { p1cA: { ck: {} } }, '2026-10-09': { p1cA: { ck: {} } } });
  assert.deepEqual(J(L.cleanOver({ '2026-10-06': 'm_recover', '2026-10-07': 'constructor', '2026-10-08': '__proto__', '2026-10-09': 5, bad: 'p1cA' })), { '2026-10-06': 'm_recover' });
  assert.deepEqual(J(L.cleanNames([[1, {}], 'x'])), [['我', '隊友'], ['對手 1', '對手 2']]);
  assert.deepEqual(J(L.cleanNames([['阿明', ''], ['ABCDEFGHIJKLMNOP']])), [['阿明', ''], ['ABCDEFGHIJKL', '對手 2']]);
  assert.equal(L.getSession('constructor'), null); assert.equal(L.getSession('__proto__'), null); assert.equal(L.getSession('toString'), null); assert.equal(L.getSession(5), null);
  assert.ok(L.getSession('p1cA')); assert.ok(L.getSession('m_warm'));
  assert.deepEqual(J(L.cleanArch([{ start: '2026-07-06', tests: { w0: { six: 30 } } }, { start: 'x' }, 3])), [{ start: '2026-07-06', tests: { w0: { six: 30 } } }]);
});
t('跳躍量控制在建議範圍內', () => {
  // 一堂課的落地次數：入門 ≤100、中階 ≤120、進階 ≤140（每邊 N 下算 2N）
  const contacts = (sess, lv) => {
    let n = 0;
    sess.blocks.forEach(b => L.itemsOf(b, lv).forEach(i => {
      if (!/^pw_/.test(i.x) || i.rx.k !== 'sets') return;
      const reps = i.rx.r[lv], m = /(\d+)/.exec(reps), per = +m[1] * (/每邊/.test(reps) ? 2 : 1);
      n += L.setsFor(i.rx.s[lv], 1.2, true) * (b.fix ? 0 : 1) * per + (b.fix ? i.rx.s[lv] * per : 0);
    }));
    return n;
  };
  const cap = [100, 120, 140];
  Object.keys(L.SESS).forEach(id => [0, 1, 2].forEach(lv => assert.ok(contacts(L.SESS[id], lv) <= cap[lv], id + ' 程度 ' + lv + '：' + contacts(L.SESS[id], lv))));
  assert.equal(contacts(L.SESS.p2oX, 0), 92); assert.equal(contacts(L.SESS.p2oX, 1), 118); assert.equal(contacts(L.SESS.p2oX, 2), 134);
});
console.log('\n' + n + ' 組測試通過');
