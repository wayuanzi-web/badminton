/* ============================================================
   闖關：經驗值、段位、徽章、新手任務、練前自我檢查、訓練負荷提醒
   原則：只獎勵「照計畫、有暖身、有聽身體」的訓練。
   多練、練更累不會多拿分；一天最多算一堂；聽從檢查結果休息也有分。
   經驗值與徽章都從紀錄即時算出來，不另外存，備份還原後也一樣。
   （純邏輯，不碰 DOM）
   ============================================================ */

const XP = {
  sess: 100,       // 完成一堂 App 裡的課表或菜單
  warm: 20,        // 那堂課的暖身全部打勾
  rpe: 10,         // 記下自覺強度
  manual: 50,      // 手動新增的紀錄（球隊、比賽、自己練）
  check: 10,       // 練前自我檢查（每天一次）
  smart: 40,       // 檢查建議減量或休息，而且照做
  test: 80,        // 完成一次檢測（每個檢測點一次）
  quest: 30,       // 每個新手任務
  badge: 50        // 每個徽章
};
const XP_RULES = [
  ['完成一堂課表或菜單', XP.sess],
  ['這堂課的暖身全部打勾', '+' + XP.warm],
  ['記下自覺強度', '+' + XP.rpe],
  ['手動記錄球隊練習或比賽', XP.manual],
  ['練前自我檢查', XP.check],
  ['檢查建議減量或休息，而且照做', XP.smart],
  ['完成一次檢測', XP.test],
  ['完成一個新手任務', XP.quest],
  ['拿到一個徽章', XP.badge]
];

const RANKS = [
  { xp: 0, n: '撿球小將' }, { xp: 150, n: '新手球友' }, { xp: 400, n: '社團常客' }, { xp: 800, n: '穩定球友' },
  { xp: 1300, n: '社團主力' }, { xp: 2000, n: '系隊選手' }, { xp: 2900, n: '校隊選手' }, { xp: 4000, n: '業餘賽好手' },
  { xp: 5400, n: '甲組挑戰者' }, { xp: 7200, n: '球館傳說' }
];
function rankOf(xp) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const cur = RANKS[i], nx = RANKS[i + 1] || null;
  return { lv: i + 1, n: cur.n, xp, floor: cur.xp, next: nx ? nx.xp : null, nextN: nx ? nx.n : null,
    pct: nx ? Math.round((xp - cur.xp) / (nx.xp - cur.xp) * 100) : 100 };
}

/* ---------- 練前自我檢查 ----------
   ill：發燒或喉嚨以下的症狀（咳嗽、胸悶、全身痠痛），或最近運動時胸痛、頭暈
   pain：身上最痛的地方幾分（0–10）　sleep、tired：0 好、1 普通、2 差 */
function readiness(a) {
  const pain = clamp0(a.pain, 10), sleep = clamp0(a.sleep, 2), tired = clamp0(a.tired, 2);
  if (a.ill) return 'rest';
  if (pain >= 7) return 'rest';
  if (pain >= 4) return 'recover';
  if (pain >= 1 || sleep >= 2 || tired >= 2 || (sleep + tired) >= 3) return 'easy';
  return 'go';
}
function clamp0(v, max) { v = Math.round(Number(v)); return isFinite(v) ? Math.min(max, Math.max(0, v)) : 0; }
const READY = {
  go: { n: '可以照課表練', d: '狀況正常。練的時候還是一樣：痠可以，刺痛、卡住就停。' },
  easy: { n: '今天練輕量版', d: '有一點痛或沒睡好、比較累。份量自動降到減量週的六成，動作照做、不要衝強度。練的時候痛到 3 分以上，或比開始前更痛，就停下來。' },
  recover: { n: '今天改做恢復伸展', d: '有地方痛到 4 分以上，硬練容易讓小傷變成大傷。今天只做不會痛的伸展放鬆。同一個地方痛超過一週沒有好轉，請找醫師或物理治療師。' },
  rest: { n: '今天休息', d: '發燒、喉嚨以下的感冒症狀、胸悶頭暈，或痛到 7 分以上，都不適合訓練。好好休息；胸痛、頭暈、腫脹變形或無法承重，請盡快就醫。症狀消失後，先從輕量版回來。' }
};

/* ---------- 健康自評（參考 PAR-Q+ 的一般健康問題） ---------- */
const SCREEN_Q = [
  '醫師曾經說過你有心臟方面的問題或高血壓嗎？',
  '休息、日常活動或運動的時候，會覺得胸口痛嗎？',
  '過去 12 個月內，曾經因為頭暈失去平衡，或失去意識嗎？（運動時喘太急造成的頭暈不算）',
  '醫師曾經診斷你有其他慢性病嗎？（心臟病、高血壓以外）',
  '目前有在吃治療慢性病的處方藥嗎？',
  '目前或過去 12 個月內，有骨骼、關節或肌腱的問題，運動之後會變嚴重嗎？',
  '醫師曾經說過你只能在醫療監督下運動嗎？'
];

/* ---------- 讀進來的資料一律先清洗 ---------- */
function cleanChk(c) {
  const out = {};
  if (!isObj(c)) return out;
  Object.keys(c).slice(-400).forEach(ds => {
    const v = c[ds];
    if (!isYmd(ds) || !isObj(v)) return;
    const o = { ill: v.ill === true || v.ill === 1, pain: clamp0(v.pain, 10), sleep: clamp0(v.sleep, 2), tired: clamp0(v.tired, 2) };
    o.res = readiness(o);                                // 結果一律重算，不信任存進來的值
    out[ds] = o;
  });
  return out;
}
function cleanScreen(s) {
  if (!isObj(s) || !isYmd(s.at)) return null;
  const yes = Math.round(Number(s.yes));
  return { at: s.at, yes: isFinite(yes) ? Math.min(SCREEN_Q.length, Math.max(0, yes)) : 0 };
}
function cleanRead(r) { return { safety: !!(isObj(r) && r.safety) }; }

/* ---------- 訓練負荷：每次的分鐘數 × 自覺強度（session-RPE） ----------
   沒記強度的那一次用 5 分估算。這週和前四週的平均比，加得太快就提醒。 */
const HARD = l => (l.rpe ? l.rpe >= 8 : l.kind === 'match');
function loadWeeks(logs, ts, n) {
  const m0 = mondayOf(parseYmd(ts)), out = [], idx = {};
  for (let i = n - 1; i >= 0; i--) { const mon = ymd(addDays(m0, -7 * i)); idx[mon] = out.length; out.push({ mon, load: 0, min: 0, count: 0 }); }
  logs.forEach(l => {
    if (!isYmd(l.date) || l.date > ts) return;
    const k = ymd(mondayOf(parseYmd(l.date)));
    if (!(k in idx)) return;
    const o = out[idx[k]], min = Math.max(0, +l.min || 0);
    o.min += min; o.load += min * (l.rpe || 5); o.count++;
  });
  return out;
}
/* 回傳提醒（沒有就是 null）：
   spike：這週負荷超過前四週平均的 1.5 倍　climb：超過 1.3 倍
   back：停了兩週以上剛回來　hard：最近兩次都在 8 分以上 */
function loadAlert(logs, ts) {
  const w = loadWeeks(logs, ts, 5), cur = w[4], prev = w.slice(0, 4);
  const active = prev.filter(x => x.count > 0).length, base = prev.reduce((n, x) => n + x.load, 0) / 4;
  const recent = logs.filter(l => isYmd(l.date) && l.date <= ts).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).slice(-2);
  if (recent.length === 2 && recent.every(HARD)) return { k: 'hard', n: '最近兩次都練得很硬', d: '連續兩次自覺強度 8 分以上。下一次改輕鬆一點（5–6 分），或安排休息，身體才有時間恢復。' };
  const hadBefore = logs.some(l => isYmd(l.date) && l.date < prev[2].mon);      // 以前練過，不是第一次用
  if (cur.count > 0 && prev[2].count === 0 && prev[3].count === 0 && hadBefore) {
    return { k: 'back', n: '停了一陣子，剛回來', d: '停練兩週以上，體能和肌腱的耐受度都會下降。這週先練輕量版（練前檢查選「有點累」也可以），下週再回到原本的份量。' };
  }
  if (active >= 2 && base > 0) {
    const r = cur.load / base;
    if (r > 1.5) return { k: 'spike', n: '這週加得太快', d: '這週的訓練量已經是前四週平均的 ' + (Math.round(r * 10) / 10) + ' 倍。訓練量突然暴增是常見的受傷原因，這週剩下的日子請休息或只做恢復伸展。', r };
    if (r > 1.3) return { k: 'climb', n: '這週練得比平常多', d: '這週的訓練量是前四週平均的 ' + (Math.round(r * 10) / 10) + ' 倍。照計畫走沒問題，但不要再額外加練。', r };
  }
  return null;
}

/* ---------- 暖身是否全部打勾 ---------- */
function warmDone(st, ds, sid) {
  const sess = getSession(sid);
  if (!sess) return false;
  const d = own(st.day, ds) ? st.day[ds] : null, ck = d && own(d, sid) && isObj(d[sid].ck) ? d[sid].ck : {};
  let has = false, all = true;
  sess.blocks.forEach((b, bi) => {
    if (b.t !== '暖身' && b.t !== '賽前暖身') return;
    itemsOf(b, st.set.level).forEach(i => { has = true; if (!ck[bi + '-' + b.items.indexOf(i)]) all = false; });
  });
  return has && all;
}

/* ---------- 某一期完成了幾成 ---------- */
function phaseRate(st, p, ts) {
  const start = parseYmd(st.set.start), last = addDays(start, 7 * (4 * p + 4) - 1);
  if (ymd(last) > ts) return null;                           // 這一期還沒過完
  let planned = 0, done = 0;
  for (let w = 4 * p; w < 4 * p + 4; w++) {
    const sched = weekSchedule(st.set.days, w);
    sched.forEach((e, i) => {
      if (!e.sid) return;
      planned++;
      const ds = ymd(addDays(start, 7 * w + i));
      if (st.logs.some(l => l.date === ds)) done++;
    });
  }
  return planned ? done / planned : null;
}

/* ---------- 新手任務 ---------- */
const QUESTS = [
  { id: 'screen', n: '做健康自評', d: '7 個是非題，確認可以放心開始運動。', act: 'screen' },
  { id: 'setup', n: '設定程度與每週安排', d: '課表的份量和哪幾天練，都照你的狀況排。', act: 'settings' },
  { id: 'safety', n: '讀「安全訓練的依據」', d: '3 分鐘看懂這個 App 怎麼排課、怎麼給分。', act: 'readSafety' },
  { id: 'test', n: '做開始前檢測', d: '8 個項目，之後每四週比一次。', act: 'testW0' },
  { id: 'first', n: '完成第一堂課，暖身全做', d: '從暖身開始逐項打勾，最後按「完成訓練」。', act: 'goToday' }
];

/* ---------- 徽章 ---------- */
const BADGES = [
  { id: 'b_first', n: '第一拍', d: '完成第一堂課。' },
  { id: 'b_warm10', n: '暖身達人', d: '有 10 堂課把暖身全部做完。' },
  { id: 'b_check10', n: '聽身體說話', d: '做了 10 次練前自我檢查。' },
  { id: 'b_smart', n: '聰明休息', d: '檢查建議減量或休息，你照做了。' },
  { id: 'b_rpe10', n: '誠實回報', d: '記錄了 10 次自覺強度。' },
  { id: 'b_deload', n: '減量週照做', d: '在減量週有練，但沒有多練。' },
  { id: 'b_streak4', n: '一個月不間斷', d: '連續 4 週每週都有練。' },
  { id: 'b_streak12', n: '一季不間斷', d: '連續 12 週每週都有練。' },
  { id: 'b_ph1', n: '基礎期結業', d: '基礎期的課完成八成以上。' },
  { id: 'b_ph2', n: '強化期結業', d: '強化期的課完成八成以上。' },
  { id: 'b_ph3', n: '實戰期結業', d: '實戰期的課完成八成以上。' },
  { id: 'b_better', n: '看得見的進步', d: '有一項檢測比開始前進步。' },
  { id: 'b_better5', n: '全面升級', d: '有 5 項以上的檢測比開始前進步。' }
];

/* 一天最多算一堂。sess：App 課表；manual：手動紀錄 */
function countedLogs(logs, ts) {
  const seen = {}, out = [];
  logs.filter(l => isYmd(l.date) && l.date <= ts)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.sid ? 0 : 1) - (b.sid ? 0 : 1)))   // 同一天有課表紀錄就優先算那一筆
    .forEach(l => { if (!seen[l.date]) { seen[l.date] = 1; out.push(l); } });
  return out;
}
/* 檢查結果建議減量或休息，那一天有沒有照做。
   當天要等照建議練完（有紀錄）才算；建議休息的話，要等那一天過完才算 */
function obeyed(st, ds, res, ts) {
  const day = st.logs.filter(l => l.date === ds), past = ds < ts;
  if (res === 'rest') return past && day.every(l => l.sid === 'm_recover');
  const ok = res === 'recover' ? (l => l.sid === 'm_recover' || (l.rpe && l.rpe <= 3)) : (l => !HARD(l));
  if (day.length) return day.every(ok);
  return past;
}
function improved(st) {
  const w0 = st.tests.w0;
  if (!w0) return 0;
  let n = 0;
  TESTS.forEach(t => {
    if (w0[t.id] == null) return;
    const later = ['w12', 'w8', 'w4'].map(k => st.tests[k] && st.tests[k][t.id]).find(v => v != null);
    if (later == null) return;
    if (t.better === 'low' ? later < w0[t.id] : later > w0[t.id]) n++;
  });
  return n;
}
function deloadKept(st, ts) {
  const start = parseYmd(st.set.start);
  for (let w = 3; ; w += 4) {
    const mon = addDays(start, 7 * w), sun = addDays(mon, 6);
    if (ymd(sun) > ts) return false;
    const planned = weekSchedule(st.set.days, w).filter(e => e.sid).length;
    const n = st.logs.filter(l => l.date >= ymd(mon) && l.date <= ymd(sun)).length;
    if (n >= 1 && n <= planned) return true;
    if (w > 400) return false;
  }
}

/* ---------- 全部算一次 ---------- */
function gameState(st, ts) {
  const counted = countedLogs(st.logs, ts);
  let xp = 0, warmN = 0, rpeN = 0, smartN = 0;
  counted.forEach(l => {
    if (l.sid) {
      xp += XP.sess;
      if (warmDone(st, l.date, l.sid)) { xp += XP.warm; warmN++; }
    } else xp += XP.manual;
    if (l.rpe) { xp += XP.rpe; rpeN++; }
  });
  const chkDays = Object.keys(st.chk || {}).filter(ds => ds <= ts);
  chkDays.forEach(ds => {
    xp += XP.check;
    const r = st.chk[ds].res;
    if (r !== 'go' && obeyed(st, ds, r, ts)) { xp += XP.smart; smartN++; }
  });
  const testN = TEST_POINTS.filter(p => st.tests[p.k] && Object.keys(st.tests[p.k]).length).length;
  xp += testN * XP.test;

  const firstWarm = counted.some(l => l.sid && warmDone(st, l.date, l.sid));
  const qDone = {
    screen: !!st.screen, setup: !!st.setup, safety: !!(st.read && st.read.safety),
    test: !!(st.tests.w0 && Object.keys(st.tests.w0).length), first: firstWarm
  };
  const quests = QUESTS.map(q => Object.assign({ done: qDone[q.id] }, q));
  xp += quests.filter(q => q.done).length * XP.quest;

  const streak = streakWeeks(st.logs, ts), better = improved(st);
  const got = {
    b_first: counted.some(l => l.sid), b_warm10: warmN >= 10, b_check10: chkDays.length >= 10, b_smart: smartN >= 1,
    b_rpe10: rpeN >= 10, b_deload: deloadKept(st, ts), b_streak4: streak >= 4, b_streak12: streak >= 12,
    b_ph1: (phaseRate(st, 0, ts) || 0) >= 0.8, b_ph2: (phaseRate(st, 1, ts) || 0) >= 0.8, b_ph3: (phaseRate(st, 2, ts) || 0) >= 0.8,
    b_better: better >= 1, b_better5: better >= 5
  };
  const badges = BADGES.map(b => Object.assign({ got: !!got[b.id] }, b));
  xp += badges.filter(b => b.got).length * XP.badge;

  return { xp, rank: rankOf(xp), quests, badges, questLeft: quests.filter(q => !q.done).length, badgeN: badges.filter(b => b.got).length };
}
/* 前後兩次的差別：新拿到的徽章、升段 */
function gameDiff(a, b) {
  return {
    xp: b.xp - a.xp,
    up: b.rank.lv > a.rank.lv ? b.rank : null,
    badges: b.badges.filter((x, i) => x.got && !a.badges[i].got),
    quests: b.quests.filter((x, i) => x.done && !a.quests[i].done)
  };
}

/* 建置時檢查 */
function validateGame() {
  const errs = [];
  if (!getSession('m_recover')) errs.push('遊戲：找不到恢復伸展菜單 m_recover');
  for (let i = 1; i < RANKS.length; i++) if (RANKS[i].xp <= RANKS[i - 1].xp) errs.push('遊戲：段位門檻要遞增');
  const ids = BADGES.map(b => b.id);
  if (new Set(ids).size !== ids.length) errs.push('遊戲：徽章代碼重複');
  if (!LEARN.some(t => t.id === 'safety')) errs.push('遊戲：找不到知識文章 safety');
  return errs;
}
