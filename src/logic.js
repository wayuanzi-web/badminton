/* ============================================================
   純邏輯：日期、計畫排程、份量格式、計時序列、計分、統計
   （不碰 DOM，方便測試）
   ============================================================ */

/* ---------- 日期 ---------- */
const pad2 = n => String(n).padStart(2, '0');
const ymd = d => String(d.getFullYear()).padStart(4, '0') + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const parseYmd = s => { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
/* 只接受真實存在、2000–2100 年之間的日期（2026-02-31 這種會被擋下） */
const isYmd = s => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseYmd(s);
  return !isNaN(d.getTime()) && ymd(d) === s && d.getFullYear() >= 2000 && d.getFullYear() <= 2100;
};
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const dow = d => (d.getDay() + 6) % 7;                 // 0 = 週一 … 6 = 週日
const mondayOf = d => addDays(d, -dow(d));
const dayDiff = (a, b) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5);
const WD = ['一', '二', '三', '四', '五', '六', '日'];
const fmtMD = d => (d.getMonth() + 1) + '/' + d.getDate();

/* ---------- 計畫 ---------- */
function weekIndex(dateStr, startStr) {
  return Math.floor(dayDiff(parseYmd(startStr), parseYmd(dateStr)) / 7);
}
/* w：從 0 起算的週次。超過 12 週後，用實戰期的四週循環維持 */
function planPos(w) {
  const after = w >= PLAN_WEEKS;
  const e = after ? 8 + ((w - PLAN_WEEKS) % 4) : Math.max(0, w);
  return { w, e, phase: Math.floor(e / 4), wip: e % 4, load: LOADS[e % 4], after, before: w < 0 };
}
/* days：長度 7 的陣列（週一起），值為 'court' | 'off' | 'rest' */
function weekSchedule(days, w) {
  const pos = planPos(w), ph = PHASES[pos.phase];
  const cIdx = [], oIdx = [];
  days.forEach((k, i) => { if (k === 'court') cIdx.push(i); else if (k === 'off') oIdx.push(i); });
  const out = days.map(() => ({ kind: 'rest', sid: null }));
  cIdx.forEach((d, i) => {
    const sid = cIdx.length === 1 ? ph.court[pos.e % 2] : (i < 2 ? ph.court[i] : 'cC');
    out[d] = { kind: 'court', sid };
  });
  oIdx.forEach((d, i) => {
    const sid = oIdx.length === 1 ? ph.off.M : ([ph.off.X, ph.off.Y, ph.off.Z][i] || 'rec');
    out[d] = { kind: 'off', sid };
  });
  return out;
}
function getSession(id) {
  if (typeof id !== 'string') return null;
  return own(SESS, id) ? SESS[id] : own(MENUS, id) ? MENUS[id] : null;
}
function itemsOf(block, lv) {
  return block.items.filter(i => (i.lv === undefined || lv >= i.lv) && (i.mx === undefined || lv <= i.mx));
}
function countItems(sess, lv) { return sess.blocks.reduce((n, b) => n + itemsOf(b, lv).length, 0); }

/* ---------- 份量 ---------- */
/* 負荷怎麼反映在份量上：
   計時與間歇的項目照比例增減；
   算組數的項目，加量週是「段落裡第 1、3、5… 項多一組」，高峰週每一項多一組，減量週約六成 */
const scaleN = (n, f) => Math.max(1, Math.round(n * f));
function setsFor(s, f, bump) {
  if (f < 1) return Math.max(1, Math.round(s * f));
  if (f >= 1.15) return s + 1;
  if (f > 1) return s + (bump ? 1 : 0);
  return s;
}
function fmtRx(rx, lv, f, bump) {
  f = f || 1;
  switch (rx.k) {
    case 'min': return scaleN(rx.v[lv], f) + ' 分鐘';
    case 'sets': return setsFor(rx.s[lv], f, bump) + ' 組 × ' + rx.r[lv];
    case 'hold': return setsFor(rx.s[lv], f, bump) + ' 組 × ' + rx.sec[lv] + ' 秒';
    case 'int': {
      const n = Math.max(2, Math.round(rx.n[lv] * f)), g = rx.g[lv];
      return rx.w[lv] + ' 秒／休 ' + rx.r[lv] + ' 秒 × ' + n + ' 回' + (g > 1 ? ' × ' + g + ' 組' : '');
    }
    case 'call': return rx.n[lv] + ' 點 × ' + setsFor(rx.s[lv], f, bump) + ' 組（每 ' + rx.gap[lv] + ' 秒一點）';
    default: return rx.v[lv];
  }
}
/* 這個份量可以交給哪個工具計時 */
function toolSpec(rx, lv, f, bump) {
  f = f || 1;
  switch (rx.k) {
    case 'min': return { t: 'timer', work: scaleN(rx.v[lv], f) * 60, rest: 0, rounds: 1, sets: 1, setRest: 0 };
    case 'hold': return { t: 'timer', work: rx.sec[lv], rest: 30, rounds: setsFor(rx.s[lv], f, bump), sets: 1, setRest: 0 };
    case 'int': return { t: 'timer', work: rx.w[lv], rest: rx.r[lv], rounds: Math.max(2, Math.round(rx.n[lv] * f)), sets: rx.g[lv], setRest: 120 };
    case 'call': return { t: 'call', gap: rx.gap[lv], n: rx.n[lv], sets: setsFor(rx.s[lv], f, bump), setRest: 60 };
    default: return null;
  }
}
function sessionMinutes(sess, lv, f) {
  f = f || 1;
  if (f === 1) return sess.dur[lv];
  return Math.round(sess.dur[lv] * (0.4 + 0.6 * f) / 5) * 5;      // 暖身收操不隨負荷增減
}

/* ---------- 計時序列 ---------- */
function buildTimerSeq(spec, prep) {
  const seq = [];
  if (prep > 0) seq.push({ ph: 'prep', dur: prep, round: 0, set: 1 });
  for (let s = 1; s <= spec.sets; s++) {
    for (let r = 1; r <= spec.rounds; r++) {
      seq.push({ ph: 'work', dur: spec.work, round: r, set: s });
      if (r < spec.rounds && spec.rest > 0) seq.push({ ph: 'rest', dur: spec.rest, round: r, set: s });
    }
    if (s < spec.sets && spec.setRest > 0) seq.push({ ph: 'setrest', dur: spec.setRest, round: spec.rounds, set: s });
  }
  return seq;
}
function seqTotal(seq) { return seq.reduce((n, p) => n + p.dur, 0); }
function fmtClock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return sec >= 60 ? Math.floor(sec / 60) + ':' + pad2(sec % 60) : String(sec);
}
function fmtDur(sec) {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return m > 0 ? m + ' 分' + (s ? ' ' + s + ' 秒' : '') : s + ' 秒';
}

/* ---------- 步法點位 ---------- */
const CALL_POINTS = [
  { id: 1, n: '左前', x: 66, y: 62 }, { id: 2, n: '右前', x: 234, y: 62 },
  { id: 3, n: '左邊', x: 58, y: 176 }, { id: 4, n: '右邊', x: 242, y: 176 },
  { id: 5, n: '左後', x: 66, y: 274 }, { id: 6, n: '右後', x: 234, y: 274 }
];
/* 隨機抽下一個點，不連續重複 */
function nextCall(active, prev, rnd) {
  const pool = active.filter(id => id !== prev);
  const from = pool.length ? pool : active;
  return from[Math.floor((rnd || Math.random)() * from.length)];
}

/* ---------- 計分 ---------- */
function sbTarget(sys) { return sys === 15 ? { to: 15, cap: 21, mid: 8 } : { to: 21, cap: 30, mid: 11 }; }
function sbWon(a, b, sys) {
  const t = sbTarget(sys), hi = Math.max(a, b), lo = Math.min(a, b);
  return (hi >= t.to && hi - lo >= 2) || hi >= t.cap;
}
function sbNew(o) {
  return {
    mode: o.mode === 'S' ? 'S' : 'D', sys: o.sys === 15 ? 15 : 21,
    score: [0, 0], games: [0, 0], gameNo: 1, serving: o.first ? 1 : 0,
    pos: [[0, 1], [0, 1]],            // pos[邊] = [右區的球員, 左區的球員]
    results: [], gameOver: false, over: false, winner: null, midDone: false, note: null,
    hist: []
  };
}
function sbSnap(s) {
  return JSON.stringify({ score: s.score, games: s.games, gameNo: s.gameNo, serving: s.serving, pos: s.pos,
    results: s.results, gameOver: s.gameOver, over: s.over, winner: s.winner, midDone: s.midDone, note: s.note });
}
function sbPoint(s, side) {
  if (s.over || s.gameOver) return s;
  s.hist.push(sbSnap(s));
  if (s.hist.length > 200) s.hist.shift();
  s.note = null;
  if (side === s.serving) {
    if (s.mode === 'D') s.pos[side] = [s.pos[side][1], s.pos[side][0]];   // 發球方得分：兩人左右互換
  } else {
    s.serving = side;                                                      // 接發方得分：換發球，不換位
  }
  s.score[side]++;
  const a = s.score[0], b = s.score[1], t = sbTarget(s.sys);
  if (sbWon(a, b, s.sys)) {
    s.games[side]++;
    s.results.push([a, b]);
    if (s.games[side] >= 2) { s.over = true; s.winner = side; s.note = 'match'; }
    else { s.gameOver = true; s.note = 'game'; }
  } else if (!s.midDone && Math.max(a, b) === t.mid) {
    s.midDone = true;
    s.note = s.gameNo === 3 ? 'mid3' : 'mid';
  }
  return s;
}
function sbNextGame(s) {
  if (!s.gameOver || s.over) return s;
  const last = s.results[s.results.length - 1];
  s.hist.push(sbSnap(s));
  s.serving = last[0] > last[1] ? 0 : 1;     // 上一局勝方先發
  s.score = [0, 0]; s.gameNo++; s.pos = [[0, 1], [0, 1]];
  s.gameOver = false; s.midDone = false; s.note = null;
  return s;
}
function sbUndo(s) {
  const h = s.hist.pop();
  if (h) Object.assign(s, JSON.parse(h));
  return s;
}
/* 每局 0:0 時可以調整誰站右區（誰先發、誰先接） */
function sbSwap(s, side) {
  if (s.mode === 'D' && s.score[0] === 0 && s.score[1] === 0 && !s.over) s.pos[side] = [s.pos[side][1], s.pos[side][0]];
  return s;
}
function sbInfo(s) {
  const sv = s.serving, rc = 1 - sv;
  const court = s.score[sv] % 2 === 0 ? 0 : 1;          // 0 右區、1 左區
  return {
    side: sv, court,
    server: s.mode === 'D' ? s.pos[sv][court] : 0,
    receiver: s.mode === 'D' ? s.pos[rc][court] : 0
  };
}
function sbScoreText(s) { return s.results.map(r => r[0] + '-' + r[1]).join('、'); }

/* ---------- 紀錄統計 ---------- */
function weeklySeries(logs, todayStr, n) {
  const m0 = mondayOf(parseYmd(todayStr)), out = [], idx = {};
  for (let i = n - 1; i >= 0; i--) {
    const mon = addDays(m0, -7 * i);
    idx[ymd(mon)] = out.length;
    out.push({ mon: ymd(mon), court: 0, off: 0, count: 0 });
  }
  logs.forEach(l => {
    if (!isYmd(l.date)) return;
    const k = ymd(mondayOf(parseYmd(l.date)));
    if (!(k in idx)) return;
    const o = out[idx[k]], min = Math.max(0, +l.min || 0);
    if (l.kind === 'off') o.off += min; else o.court += min;
    o.count++;
  });
  return out;
}
function streakWeeks(logs, todayStr) {
  const set = new Set(logs.filter(l => isYmd(l.date)).map(l => ymd(mondayOf(parseYmd(l.date)))));
  let m = mondayOf(parseYmd(todayStr)), n = 0;
  if (!set.has(ymd(m))) m = addDays(m, -7);            // 本週還沒練，不算中斷
  while (set.has(ymd(m))) { n++; m = addDays(m, -7); }
  return n;
}
const AXIS_TICKS = {
  60: [0, 30, 60], 120: [0, 60, 120], 180: [0, 60, 120, 180], 240: [0, 120, 240], 300: [0, 100, 200, 300],
  360: [0, 120, 240, 360], 480: [0, 240, 480], 600: [0, 200, 400, 600], 720: [0, 240, 480, 720],
  900: [0, 300, 600, 900], 1200: [0, 400, 800, 1200]
};
function axisFor(maxVal) {
  const keys = Object.keys(AXIS_TICKS).map(Number);
  for (const k of keys) if (maxVal <= k) return { max: k, ticks: AXIS_TICKS[k] };
  const m = Math.ceil(maxVal / 600) * 600;
  return { max: m, ticks: [0, m / 2, m] };
}

/* ---------- 飲食試算 ---------- */
function dietCalc(kg) {
  const r = v => Math.round(v);
  return {
    proDay: [r(kg * 1.2), r(kg * 1.6)],
    proMeal: [r(kg * 0.25), r(kg * 0.4)],
    carbPre: [r(kg * 0.5), r(kg * 1)],
    carbPost: [r(kg * 1), r(kg * 1.2)],
    caf: Math.round(kg * 3 / 10) * 10
  };
}

/* ---------- 讀進來的資料一律先清洗（來源可能是手動貼上的備份） ---------- */
const RE_ID = /^[\w-]{1,40}$/;
const cleanStr = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
function cleanLogs(arr) {
  if (!Array.isArray(arr)) return [];
  const seen = {}, out = [];
  arr.slice(0, 5000).forEach(l => {
    if (!isObj(l) || !isYmd(l.date)) return;
    let id = (typeof l.id === 'string' && RE_ID.test(l.id) && !own(seen, l.id)) ? l.id : 'r' + out.length + '-' + Math.random().toString(36).slice(2, 8);
    seen[id] = 1;
    const kind = (l.kind === 'off' || l.kind === 'match') ? l.kind : 'court';
    const min = Number(l.min), rpe = Math.round(Number(l.rpe));
    const o = {
      id, date: l.date, kind, title: cleanStr(l.title, 40),
      min: isFinite(min) ? Math.min(600, Math.max(0, Math.round(min))) : 0,
      rpe: (rpe >= 1 && rpe <= 10) ? rpe : null, note: cleanStr(l.note, 500)
    };
    if (kind === 'match') { o.result = l.result === 'L' ? 'L' : 'W'; o.score = cleanStr(l.score, 40); }
    if (getSession(l.sid)) o.sid = l.sid;
    out.push(o);
  });
  return out;
}
function cleanTests(t) {
  const out = {};
  if (!isObj(t)) return out;
  TEST_POINTS.forEach(p => {
    const src = own(t, p.k) ? t[p.k] : null;
    if (!isObj(src)) return;
    const o = {};
    TESTS.forEach(x => {
      if (!own(src, x.id) || src[x.id] === null || src[x.id] === '' || typeof src[x.id] === 'boolean') return;
      const v = Number(src[x.id]);
      if (isFinite(v) && v >= 0 && v <= 100000) o[x.id] = Math.round(v * 10) / 10;
    });
    if (Object.keys(o).length) out[p.k] = o;
  });
  return out;
}
/* day[日期][課表代碼] = { ck: { '段落-項目': 1 } } */
function cleanDays(d) {
  const out = {};
  if (!isObj(d)) return out;
  Object.keys(d).forEach(ds => {
    if (!isYmd(ds) || !isObj(d[ds])) return;
    let rec = d[ds];
    if (typeof rec.sid === 'string') { const old = rec; rec = {}; rec[old.sid] = { ck: old.ck }; }     // 舊格式：一天一筆
    const o = {};
    Object.keys(rec).forEach(sid => {
      if (!getSession(sid)) return;
      const ck = {}, src = isObj(rec[sid]) ? rec[sid].ck : null;
      if (isObj(src)) Object.keys(src).forEach(k => { if (/^\d{1,2}-\d{1,2}$/.test(k) && src[k]) ck[k] = 1; });
      o[sid] = { ck };
    });
    if (Object.keys(o).length) out[ds] = o;
  });
  return out;
}
function cleanOver(v) {
  const out = {};
  if (!isObj(v)) return out;
  Object.keys(v).forEach(ds => { if (isYmd(ds) && getSession(v[ds])) out[ds] = v[ds]; });
  return out;
}
const SB_NAMES = [['我', '隊友'], ['對手 1', '對手 2']];
function cleanNames(n) {
  return SB_NAMES.map((row, s) => row.map((dv, p) => {
    const v = (Array.isArray(n) && Array.isArray(n[s])) ? n[s][p] : null;
    return typeof v === 'string' ? v.slice(0, 12) : dv;
  }));
}
function cleanArch(a) {
  if (!Array.isArray(a)) return [];
  return a.filter(x => isObj(x) && isYmd(x.start)).slice(-10).map(x => ({ start: x.start, tests: cleanTests(x.tests) }));
}

/* ---------- 資料檢查（建置時執行） ---------- */
function validateData() {
  const errs = [];
  const chk = (id, s) => {
    if (!s.n || !s.blocks || !s.dur || s.dur.length !== 3) errs.push(id + ': 缺欄位');
    (s.blocks || []).forEach((b, bi) => b.items.forEach((i, ii) => {
      if (!EX[i.x]) errs.push(id + ' 段落 ' + bi + ' 項目 ' + ii + ': 找不到動作 ' + i.x);
      if (!i.rx || !i.rx.k) errs.push(id + ' ' + i.x + ': 沒有份量');
      for (let lv = 0; lv < 3; lv++) { const t = fmtRx(i.rx, lv, 1); if (!t || /undefined|NaN/.test(t)) errs.push(id + ' ' + i.x + ' 程度 ' + lv + ': 份量格式錯誤 ' + t); }
    }));
    for (let lv = 0; lv < 3; lv++) if (countItems(s, lv) === 0) errs.push(id + ': 程度 ' + lv + ' 沒有項目');
  };
  Object.keys(SESS).forEach(id => chk(id, SESS[id]));
  Object.keys(MENUS).forEach(id => chk(id, MENUS[id]));
  MENU_ORDER.forEach(id => { if (!MENUS[id]) errs.push('MENU_ORDER: 找不到 ' + id); });
  Object.keys(MENUS).forEach(id => { if (MENU_ORDER.indexOf(id) < 0) errs.push('MENU_ORDER 少了 ' + id); });
  PHASES.forEach((p, i) => {
    p.court.concat(Object.keys(p.off).map(k => p.off[k])).forEach(id => { if (!SESS[id]) errs.push('第 ' + (i + 1) + ' 期: 找不到課表 ' + id); });
  });
  const cats = CATS.map(c => c.k);
  Object.keys(EX).forEach(id => {
    const e = EX[id];
    if (cats.indexOf(e.c) < 0) errs.push(id + ': 分類錯誤');
    (e.need || []).forEach(n => { if (!NEED[n]) errs.push(id + ': 需求代碼錯誤 ' + n); });
    if (!e.d || !e.cues || !e.cues.length) errs.push(id + ': 缺說明或要點');
  });
  return errs;
}
