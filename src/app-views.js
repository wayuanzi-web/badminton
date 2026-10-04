/* ============================================================
   五個分頁的畫面
   ============================================================ */
const kindLabel = k => (k === 'court' ? '場上' : k === 'off' ? '場外' : '休息');
const kindPill = k => '<span class="pill ' + (k === 'court' ? 'court' : 'off') + '">' + kindLabel(k) + '</span>';
const pplLabel = n => (n <= 1 ? '一個人' : n + ' 人');
const ctxFactor = (sid, w) => (own(SESS, sid) && w >= 0 ? planPos(w).load.f : 1);

/* ---------- 課表列 ---------- */
/* opt.live：可以打勾；opt.ck：已勾的項目；opt.h：段落標題的層級（預設 h3） */
function rowsHTML(sess, lv, f, opt) {
  opt = opt || {};
  const H = opt.h === 2 ? 'h2' : 'h3';
  return sess.blocks.map((b, bi) => {
    const items = itemsOf(b, lv);
    if (!items.length) return '';
    const ff = b.fix ? 1 : f;
    const rows = items.map((i, n) => {
      const key = bi + '-' + b.items.indexOf(i), ex = EX[i.x], bump = n % 2 === 0;
      const rx = fmtRx(i.rx, lv, ff, bump), spec = toolSpec(i.rx, lv, ff, bump), sj = spec ? esc(JSON.stringify(spec)) : '';
      const done = !!(opt.ck && opt.ck[key]);
      return '<li class="row' + (opt.live ? '' : ' plain') + (done ? ' is-done' : '') + '" data-key="' + key + '">' +
        (opt.live ? '<label class="ck-wrap"><input class="ck" type="checkbox" id="ck-' + key + '" data-ck="' + key + '"' + (done ? ' checked' : '') + ' aria-label="完成：' + esc(ex.n) + '"></label>' : '') +
        '<button class="row-main" type="button" data-act="ex" data-x="' + i.x + '" data-rx="' + esc(rx) + '"' + (i.note ? ' data-note="' + esc(i.note) + '"' : '') + (spec ? ' data-spec="' + sj + '"' : '') + '>' +
          '<span class="row-n">' + esc(ex.n) + '</span><span class="row-rx">' + esc(rx) + '</span>' +
          (i.note ? '<span class="row-note">' + esc(i.note) + '</span>' : '') + '</button>' +
        (spec
          ? '<button class="row-t" type="button" data-act="tool" data-spec="' + sj + '" data-x="' + i.x + '" data-name="' + esc(ex.n) + '" aria-label="' + (spec.t === 'call' ? '開啟步法點位' : '開啟計時器') + '：' + esc(ex.n) + '">' + icon(spec.t === 'call' ? 'steps' : 'timer') + '</button>'
          : '<span class="row-chev">' + icon('chev') + '</span>') +
        '</li>';
    }).join('');
    return '<section class="blk"><header class="blk-h"><' + H + '>' + esc(b.t) + '</' + H + '><span>' + items.length + ' 項</span></header><ul class="rows">' + rows + '</ul></section>';
  }).join('');
}
function metaList(sess, lv, f) {
  return '<li>' + kindLabel(sess.kind) + '</li><li>約 ' + sessionMinutes(sess, lv, f) + ' 分鐘</li><li>' + pplLabel(sess.ppl) + '</li>';
}

/* ---------- 今日 ---------- */
function todayInfo() {
  const t = now(), ds = ymd(t), w = weekIndex(ds, S.set.start), d = dow(t);
  const pos = planPos(w), sched = weekSchedule(S.set.days, Math.max(0, w));
  let sid = null, src = null;
  if (own(S.over, ds) && getSession(S.over[ds])) { sid = S.over[ds]; src = 'over'; }
  else if (w >= 0 && sched[d].sid) { sid = sched[d].sid; src = 'plan'; }
  return { t, ds, w, d, pos, sched, sid, src, sess: sid ? getSession(sid) : null, f: sid ? ctxFactor(sid, w) : 1 };
}
/* 畫面上正在顯示的那一堂課。打勾和完成都記在這裡，跨過午夜也不會記錯天 */
let SHOWN = null;
function dayRec(ds, sid) {
  const d = own(S.day, ds) ? S.day[ds] : null;
  return (d && own(d, sid) && isObj(d[sid].ck)) ? d[sid] : { ck: {} };
}
function setDayRec(ds, sid, rec) {
  if (!own(S.day, ds)) S.day[ds] = {};
  S.day[ds][sid] = rec;
}
/* 「完成」以紀錄為準：那一天有這堂課的紀錄就是完成了 */
const sessLog = (ds, sid) => S.logs.find(l => l.date === ds && l.sid === sid) || null;
const isDayDone = ds => S.logs.some(l => l.date === ds);
function nextPlanned(from) {
  const start = parseYmd(S.set.start);
  let base = from;
  if (dayDiff(from, start) > 0) base = addDays(start, -1);          // 計畫還沒開始：直接從第一週找
  for (let i = 1; i <= 14; i++) {
    const dt = addDays(base, i), w = weekIndex(ymd(dt), S.set.start);
    if (w < 0) continue;
    const e = weekSchedule(S.set.days, w)[dow(dt)];
    if (e.sid) return { dt, w, sid: e.sid, kind: e.kind };
  }
  return null;
}
function posLabel(w) {
  if (w < 0) return fmtMD(parseYmd(S.set.start)) + ' 開始';
  const p = planPos(w);
  return p.after ? '維持期 第 ' + (w - PLAN_WEEKS + 1) + ' 週' : PHASES[p.phase].n + ' 第 ' + (w + 1) + ' 週';
}
function weekStrip(ti) {
  const w = Math.max(0, ti.w), mon = addDays(parseYmd(S.set.start), 7 * w), sched = weekSchedule(S.set.days, w);
  const cells = sched.map((e, i) => {
    const dt = addDays(mon, i), ds = ymd(dt), today = ds === ti.ds, done = isDayDone(ds);
    return '<li class="wk' + (today ? ' is-today' : '') + (done ? ' is-done' : '') + '" data-kind="' + e.kind + '" aria-label="週' + WD[i] + ' ' + kindLabel(e.kind) + (done ? '，已完成' : '') + (today ? '，今天' : '') + '">' +
      '<span>' + WD[i] + '</span><span class="wk-m">' + (done ? icon('check') : '') + '</span></li>';
  }).join('');
  return '<ol class="week">' + cells + '</ol>' +
    '<p class="legend"><span><i class="k-court"></i>場上</span><span><i class="k-off"></i>場外</span><span><i class="k-rest"></i>休息</span></p>';
}
function progOf(sess, lv, rec) {
  let total = 0, done = 0;
  sess.blocks.forEach((b, bi) => itemsOf(b, lv).forEach(i => { total++; if (rec.ck[bi + '-' + b.items.indexOf(i)]) done++; }));
  return { total, done };
}
function viewToday() {
  const ti = todayInfo(), lv = S.set.level, t = ti.t;
  const dateLine = (t.getMonth() + 1) + ' 月 ' + t.getDate() + ' 日 週' + WD[ti.d];
  const top = '<div class="hero-top"><b>' + dateLine + '</b>' + (ti.w >= 0 ? '<span>' + posLabel(ti.w) + '　' + ti.pos.load.n + '週</span>' : '') + '</div>';
  let html = '';
  SHOWN = ti.sess ? { ds: ti.ds, sid: ti.sid, f: ti.f } : null;

  if (!store.ok) html += '<div class="note-box warn"><div><b>這個瀏覽器環境無法儲存資料</b><span>關掉頁面後打勾和紀錄會消失。需要保留的話，到「紀錄」分頁複製備份文字。</span></div></div>';
  if (ti.pos.after) {
    html += '<div class="note-box"><div><b>12 週計畫完成了</b><span>目前用實戰期的課表維持。可以做一次檢測，再決定下一輪怎麼練。</span>' +
      '<div class="btn-row"><button class="btn sm" type="button" data-act="restart" data-up="0">同樣程度再來一輪</button>' +
      (lv < 2 ? '<button class="btn sm ghost" type="button" data-act="restart" data-up="1">提高一級重新開始</button>' : '') + '</div></div></div>';
  }

  /* 第一次使用：程度和訓練日會改變整份課表，所以提示放在主畫面正下方、課表之前 */
  let hint = '';
  if (!S.setup && !UI.hintOff) {
    if (onWeb() && !inApp() && !UI.instOff && inWebView()) {
      /* 從 LINE 等 App 點連結進來：這裡裝不了，資料也和手機瀏覽器的分開，先請使用者換到瀏覽器 */
      hint = '<div class="note-box"><div><b>先換到手機的瀏覽器</b><span>' + WEBVIEW_STEPS + '</span>' +
        '<div class="btn-row"><button class="btn sm ghost" type="button" data-act="instOff">先在這裡用</button></div></div></div>';
    } else if (onWeb() && isIOS() && !inApp() && !UI.instOff) {
      /* iPhone、iPad：主畫面版本和 Safari 各存各的資料，所以請使用者先加到主畫面，再開始設定 */
      hint = '<div class="note-box"><div><b>先加到主畫面</b><span>' + IOS_STEPS + '主畫面版本和 Safari 的資料是分開存的，所以先加好，再從主畫面開啟來設定。</span>' +
        '<div class="btn-row"><button class="btn sm ghost" type="button" data-act="instOff">先在瀏覽器裡用</button></div></div></div>';
    } else {
      const c = S.set.days.filter(k => k === 'court').length, o = S.set.days.filter(k => k === 'off').length;
      hint = '<div class="note-box"><div><b>計畫目前照預設值安排</b><span>' + LEVELS[lv].n + '，每週場上 ' + c + ' 天、場外 ' + o + ' 天。改成你的程度和可以練的日子，課表會重新排。</span>' +
        '<div class="btn-row"><button class="btn sm" type="button" data-act="settings">調整設定</button><button class="btn sm ghost" type="button" data-act="hintOff">先這樣</button></div></div></div>';
    }
  }

  if (ti.sess) {
    const rec = dayRec(ti.ds, ti.sid), pg = progOf(ti.sess, lv, rec), lg = sessLog(ti.ds, ti.sid);
    html += '<section class="hero" data-kind="' + ti.sess.kind + '">' + heroLines() + top +
      '<h1 class="hero-title">' + esc(ti.sess.n) + '</h1><p class="hero-goal">' + esc(ti.sess.goal) + '</p>' +
      '<ul class="hero-meta">' + metaList(ti.sess, lv, ti.f) + '</ul>' +
      '<div class="hero-prog"><div class="bar"><i id="progBar" style="width:' + (pg.total ? Math.round(pg.done / pg.total * 100) : 0) + '%"></i></div><span id="progTxt">' + pg.done + ' / ' + pg.total + ' 項</span></div>' +
      weekStrip(ti) + '</section>';
    if (ti.src === 'over') {
      const planned = ti.w >= 0 && ti.sched[ti.d].sid;
      html += '<p class="small muted">今天改做這份課表。<button class="link" type="button" data-act="unover">' + (planned ? '換回計畫的課表' : '取消') + '</button></p>';
    }
    html += hint;
    html += rowsHTML(ti.sess, lv, ti.f, { live: true, ck: rec.ck, h: 2 });
    if (lg) {
      html += '<div class="note-box"><div><b>今天的訓練已完成</b><span>' + esc(lg.min) + ' 分鐘' + (lg.rpe ? '，自覺強度 ' + esc(lg.rpe) : '') + '</span>' +
        '<div><button class="btn sm ghost" type="button" data-act="editLog" data-id="' + esc(lg.id) + '">修改紀錄</button></div></div></div>';
    } else {
      html += '<button class="btn block" type="button" data-act="finish">完成訓練，寫入紀錄</button>';
    }
  } else {
    const nx = nextPlanned(t);
    if (ti.w < 0) {
      const st = parseYmd(S.set.start);
      const leftThisWeek = S.set.days.some((k, i) => i >= ti.d && k !== 'rest');     // 這週還有排課的日子，才提供「改成本週開始」
      html += '<section class="hero" data-kind="court">' + heroLines() + top +
        '<h1 class="hero-title">計畫從 ' + fmtMD(st) + ' 週一開始</h1>' +
        '<p class="hero-goal">開始前先做一次檢測，12 週後才看得出進步多少。想今天就動，直接做下面第一堂課。</p>' +
        '<div class="hero-act"><button class="btn sm" type="button" data-act="tests" data-k="w0">做開始前檢測</button>' +
        (leftThisWeek ? '<button class="btn sm ghost" type="button" data-act="startNow">改成本週開始</button>' : '') + '</div>' + weekStrip(ti) + '</section>';
    } else {
      html += '<section class="hero" data-kind="rest">' + top +
        '<h1 class="hero-title">休息日</h1><p class="hero-goal">今天不排課，身體是在休息的時候變強的。想動一下，就做恢復伸展。</p>' +
        '<div class="hero-act"><button class="btn sm" type="button" data-act="do" data-sid="m_recover">做恢復伸展</button>' +
        (nx ? '<button class="btn sm ghost" type="button" data-act="do" data-sid="' + nx.sid + '">今天改練下一堂</button>' : '') + '</div>' + weekStrip(ti) + '</section>';
    }
    html += hint;
    if (nx) {
      const ns = getSession(nx.sid), nf = ctxFactor(nx.sid, nx.w);
      html += '<div class="head"><div><h2 class="h-sec">' + esc(ns.n) + '</h2>' +
        '<p class="small muted">' + (ti.w < 0 ? '第一堂' : '下一堂') + '，' + fmtMD(nx.dt) + ' 週' + WD[dow(nx.dt)] + '，' + kindLabel(ns.kind) + '，約 ' + sessionMinutes(ns, lv, nf) + ' 分鐘</p></div>' +
        (ti.w < 0 ? '<button class="btn sm ghost" type="button" data-act="do" data-sid="' + nx.sid + '">今天就練這堂</button>' : '') + '</div>';
      html += rowsHTML(ns, lv, nf, { live: false });
    } else {
      html += '<div class="empty"><p>目前每一天都設成休息。到設定裡排幾天訓練，計畫才會出現課表。</p><button class="btn sm" type="button" data-act="settings">調整設定</button></div>';
    }
  }

  html += '<section class="stack"><h2 class="h-sec">工具</h2><div class="tools">' +
    '<button class="tool" type="button" data-act="timer">' + icon('timer') + '<b>間歇計時</b><span>動、休、回數</span></button>' +
    '<button class="tool" type="button" data-act="caller">' + icon('steps') + '<b>步法點位</b><span>隨機喊六個點</span></button>' +
    '<button class="tool" type="button" data-act="score">' + icon('score') + '<b>計分板</b><span>誰發球、站哪邊</span></button>' +
    '</div></section>';
  return html;
}

/* ---------- 計畫 ---------- */
function weekDone(w) {
  const mon = addDays(parseYmd(S.set.start), 7 * w), sched = weekSchedule(S.set.days, w);
  let planned = 0, done = 0;
  sched.forEach((e, i) => { if (e.sid) { planned++; if (isDayDone(ymd(addDays(mon, i)))) done++; } });
  return { planned, done };
}
function viewPlan() {
  const ti = todayInfo(), lv = S.set.level;
  if (UI.planWeek == null) UI.planWeek = clamp(ti.w, 0, PLAN_WEEKS - 1);
  const sel = UI.planWeek, pos = planPos(sel), start = parseYmd(S.set.start);
  const c = S.set.days.filter(k => k === 'court').length, o = S.set.days.filter(k => k === 'off').length;
  let html = '<div class="head"><div><h1 class="h-page">12 週計畫</h1>' +
    '<p class="muted small">' + LEVELS[lv].n + '，每週場上 ' + c + ' 天、場外 ' + o + ' 天。' + fmtMD(start) + ' 開始，' + fmtMD(addDays(start, PLAN_WEEKS * 7 - 1)) + ' 結束。</p></div>' +
    '<button class="btn sm ghost" type="button" data-act="settings">調整</button></div>';

  html += '<div class="phases">' + PHASES.map((ph, pi) => {
    const cells = [0, 1, 2, 3].map(k => {
      const w = pi * 4 + k, ld = LOADS[k], wd = weekDone(w), bars = [1, 2, 3, 4].map(n => '<i class="' + (n <= [2, 3, 4, 1][k] ? 'on' : '') + '" style="height:' + (4 + n * 2.5) + 'px"></i>').join('');
      const st = w < ti.w ? ' is-past' : w === ti.w ? ' is-now' : '';
      const cnt = w <= ti.w && ti.w >= 0 ? wd.done + '/' + wd.planned + ' 堂' : wd.planned + ' 堂';
      return '<button class="wkcell' + st + '" type="button" data-act="pickWeek" data-w="' + w + '" aria-pressed="' + (w === sel) + '" aria-label="第 ' + (w + 1) + ' 週，' + ld.n + '，' + (w <= ti.w && ti.w >= 0 ? '已完成 ' : '') + cnt + (w === ti.w ? '，本週' : '') + '">' +
        '<span class="num">' + (w + 1) + '</span><small>' + ld.n + '</small><span class="loadbar" aria-hidden="true">' + bars + '</span><small>' + cnt + '</small></button>';
    }).join('');
    return '<section class="phase"><div class="phase-h"><b>' + ph.n + '</b><span>' + ph.goal + '</span></div><div class="wkcells">' + cells + '</div></section>';
  }).join('') + '</div>';

  const mon = addDays(start, 7 * sel), sched = weekSchedule(S.set.days, sel), ph = PHASES[pos.phase];
  html += '<section class="stack"><div class="head"><div><h2 class="h-sec">第 ' + (sel + 1) + ' 週　' + fmtMD(mon) + '–' + fmtMD(addDays(mon, 6)) + '</h2>' +
    '<p class="small muted">' + ph.n + '，' + pos.load.n + '週。' + pos.load.d + '</p></div></div>';
  html += '<div class="days">' + sched.map((e, i) => {
    const dt = addDays(mon, i), ds = ymd(dt), today = ds === ti.ds, done = isDayDone(ds), sess = e.sid ? getSession(e.sid) : null;
    const dcol = '<span class="day-d"><b>週' + WD[i] + '</b><span>' + fmtMD(dt) + '</span></span>';
    const stat = '<span class="day-s">' + (done ? '<span class="done">' + icon('check') + '</span>' : today ? '今天' : '') + (sess ? icon('chev') : '') + '</span>';
    if (!sess) return '<div class="day is-rest' + (today ? ' is-today' : '') + '">' + dcol + '<span class="day-m"><b>休息</b></span>' + stat + '</div>';
    return '<button class="day' + (today ? ' is-today' : '') + '" type="button" data-act="preview" data-sid="' + e.sid + '" data-w="' + sel + '" data-date="' + ds + '">' + dcol +
      '<span class="day-m"><b>' + esc(sess.n) + '</b><span class="pills">' + kindPill(sess.kind) + '<span class="pill">約 ' + sessionMinutes(sess, lv, pos.load.f) + ' 分鐘</span></span></span>' + stat + '</button>';
  }).join('') + '</div>';
  const tp = sel === 0 ? TEST_POINTS[0] : TEST_POINTS.find(p => p.w === sel);
  if (tp) {
    const has = S.tests[tp.k] && Object.keys(S.tests[tp.k]).length;
    html += '<div class="note-box"><div><b>' + (sel === 0 ? '開始前檢測' : '本週檢測') + (has ? '（已記錄）' : '') + '</b><span>找一天花 20 分鐘測 8 個項目，之後每四週測一次，進步用數字看。</span>' +
      '<div><button class="btn sm" type="button" data-act="tests" data-k="' + tp.k + '">' + (has ? '查看或修改' : '開始檢測') + '</button></div></div></div>';
  }
  html += '</section>';

  html += '<section class="stack"><h2 class="h-sec">' + ph.n + '在練什麼</h2><div class="kb"><ul>' + ph.pts.map(p => '<li>' + p + '</li>').join('') + '</ul></div></section>';
  html += '<section class="stack"><h2 class="h-sec">進度跟不上的時候</h2><p class="muted small">生病、出差或受傷中斷了，把計畫延後，就能從中斷的那一週接著練。</p>' +
    '<div class="btn-row"><button class="btn sm ghost" type="button" data-act="shift" data-n="1">延後一週</button><button class="btn sm ghost" type="button" data-act="shift" data-n="-1">提前一週</button></div></section>';
  return html;
}

/* ---------- 菜單 ---------- */
function viewMenu() {
  const lv = S.set.level;
  let html = '<div class="stack"><h1 class="h-page">菜單</h1>' +
    '<div class="seg wide" role="group" aria-label="菜單類別">' +
    [['menus', '訓練菜單'], ['ex', '動作庫'], ['diet', '飲食']].map(s => '<button type="button" data-act="menuSeg" data-v="' + s[0] + '" aria-pressed="' + (UI.menuSeg === s[0]) + '">' + s[1] + '</button>').join('') + '</div></div>';

  if (UI.menuSeg === 'menus') {
    html += '<p class="lede">不照計畫走的日子，從這裡挑一份直接練。每份都依你設定的程度調整份量。</p>';
    html += '<div class="chips" role="group" aria-label="篩選">' + [['all', '全部'], ['home', '不用球場'], ['court', '需要球場'], ['solo', '一個人']].map(f =>
      '<button class="chip" type="button" data-act="menuWhere" data-v="' + f[0] + '" aria-pressed="' + (UI.menuWhere === f[0]) + '">' + f[1] + '</button>').join('') + '</div>';
    const list = MENU_ORDER.filter(id => {
      const m = MENUS[id];
      return UI.menuWhere === 'all' || (UI.menuWhere === 'home' && m.where !== 'court') || (UI.menuWhere === 'court' && m.where === 'court') || (UI.menuWhere === 'solo' && m.ppl === 1);
    });
    html += '<div class="cards">' + list.map(id => {
      const m = MENUS[id];
      return '<button class="card" type="button" data-act="preview" data-sid="' + id + '"><b>' + esc(m.n) + '</b><p>' + esc(m.goal) + '</p>' +
        '<span class="pills"><span class="pill">' + m.dur[lv] + ' 分鐘</span><span class="pill">' + pplLabel(m.ppl) + '</span>' +
        '<span class="pill ' + (m.where === 'court' ? 'court' : 'off') + '">' + (m.where === 'court' ? '球場' : m.where === 'home' ? '在家' : '任何空地') + '</span></span></button>';
    }).join('') + '</div>';
  } else if (UI.menuSeg === 'ex') {
    html += '<div class="stack"><div class="field"><label for="exQ">搜尋動作</label><input class="inp" id="exQ" type="search" placeholder="例：高遠球、棒式、步法" value="' + esc(UI.exQ) + '" data-inp="exQ" autocomplete="off"></div>' +
      '<div class="chips" role="group" aria-label="分類">' + [{ k: 'all', n: '全部' }].concat(CATS).map(c =>
        '<button class="chip" type="button" data-act="exCat" data-v="' + c.k + '" aria-pressed="' + (UI.exCat === c.k) + '">' + c.n + '</button>').join('') + '</div></div>';
    html += '<div id="exList" class="stack">' + exListHTML() + '</div>';
  } else {
    html += dietHTML();
  }
  return html;
}
function exListHTML() {
  const q = UI.exQ.trim().toLowerCase();
  let out = '', n = 0;
  CATS.forEach(c => {
    if (UI.exCat !== 'all' && UI.exCat !== c.k) return;
    const ids = Object.keys(EX).filter(id => EX[id].c === c.k && (!q || (EX[id].n + EX[id].d).toLowerCase().indexOf(q) >= 0));
    if (!ids.length) return;
    n += ids.length;
    out += '<section class="grp"><h2>' + c.n + '　' + ids.length + ' 個</h2><div class="list">' + ids.map(id => {
      const e = EX[id];
      return '<button class="li" type="button" data-act="ex" data-x="' + id + '"><span class="li-m"><b>' + esc(e.n) + '</b><span>' +
        (e.need.length ? e.need.map(k => NEED[k]).join('、') : '不需要器材') + '</span></span><span class="row-chev">' + icon('chev') + '</span></button>';
    }).join('') + '</div></section>';
  });
  return n ? out : '<div class="empty"><p>找不到符合的動作。換個關鍵字，或把分類改回「全部」。</p></div>';
}
function dietCalcHTML() {
  const kg = S.set.kg || 70, d = dietCalc(kg);
  return '<div class="calc-out">' +
    '<div><b>' + d.proDay[0] + '–' + d.proDay[1] + ' 公克</b><span>每天的蛋白質</span></div>' +
    '<div><b>' + d.proMeal[0] + '–' + d.proMeal[1] + ' 公克</b><span>每餐的蛋白質</span></div>' +
    '<div><b>' + d.carbPre[0] + '–' + d.carbPre[1] + ' 公克</b><span>打球前 1–2 小時的碳水</span></div>' +
    '<div><b>' + d.carbPost[0] + '–' + d.carbPost[1] + ' 公克</b><span>連續比賽時，打完那一餐的碳水</span></div></div>';
}
function dietHTML() {
  return '<section class="calc"><h2 class="h-sec">依體重試算</h2>' +
    '<div class="field" style="max-width:220px"><label for="kg">體重（公斤）</label><input class="inp" id="kg" type="number" inputmode="decimal" min="30" max="200" step="0.5" value="' + (S.set.kg || 70) + '" data-inp="kg"></div>' +
    '<div id="calcOut">' + dietCalcHTML() + '</div>' +
    '<p class="small muted">' + (S.set.kg ? '' : '先用 70 公斤示範，輸入你的體重就會換算。') + '數字是規律運動成人的一般參考範圍。平常打完球，照正常的一餐吃就夠了；一天打兩場或隔天還要比賽，才需要刻意把碳水補到最後一格的量。</p></section>' +
    '<article class="kb">' + learnHTML(DIET_HTML) + '</article>';
}

/* ---------- 知識 ---------- */
function viewLearn() {
  if (UI.learn) {
    const tp = LEARN.find(x => x.id === UI.learn);
    if (tp) {
      return '<div class="stack"><div><button class="btn sm quiet" type="button" data-act="learn" data-id="">' + icon('back') + '全部主題</button></div>' +
        '<h1 class="h-page">' + esc(tp.n) + '</h1></div><article class="kb">' + learnHTML(tp.html) + '</article>';
    }
  }
  return '<div class="stack"><h1 class="h-page">知識</h1><p class="lede">規則、技術、戰術、裝備和保養，打羽球會用到的資訊都整理在這裡。</p></div>' +
    '<div class="list">' + LEARN.map(tp => '<button class="li" type="button" data-act="learn" data-id="' + tp.id + '"><span class="li-m"><b>' + esc(tp.n) + '</b><span>' + esc(tp.sub) + '</span></span><span class="row-chev">' + icon('chev') + '</span></button>').join('') + '</div>';
}

/* ---------- 紀錄 ---------- */
const LOG_KIND = { court: '場上訓練', off: '場外訓練', match: '比賽' };
function viewLog() {
  const ts = todayStr(), ser = weeklySeries(S.logs, ts, 8), cur = ser[ser.length - 1];
  const totalMin = S.logs.reduce((n, l) => n + (+l.min || 0), 0), streak = streakWeeks(S.logs, ts);
  const hrs = totalMin / 60;
  let html = '<div class="head"><div><h1 class="h-page">紀錄</h1></div><button class="btn sm" type="button" data-act="addLog">' + icon('plus') + '新增紀錄</button></div>';
  html += '<div class="tiles">' +
    '<div class="tile"><span>本週訓練</span><b>' + cur.count + '<small>次</small></b></div>' +
    '<div class="tile"><span>本週時間</span><b>' + (cur.court + cur.off) + '<small>分鐘</small></b></div>' +
    '<div class="tile"><span>連續有練的週數</span><b>' + streak + '<small>週</small></b></div>' +
    '<div class="tile"><span>累計時間</span><b>' + (hrs >= 10 ? Math.round(hrs) : Math.round(hrs * 10) / 10) + '<small>小時</small></b></div></div>';

  if (S.logs.length) {
    const any = ser.some(s => s.court + s.off > 0);
    html += '<section class="chart" id="chart"><div class="chart-h"><b>近 8 週的訓練時間（分鐘）</b>' +
      (any ? '<button class="btn sm quiet" type="button" data-act="chartTable">' + (UI.chartTable ? '看圖表' : '看表格') + '</button>' : '') + '</div>';
    if (!any) {
      html += '<div class="empty"><p>最近 8 週沒有紀錄。</p></div>';
    } else if (UI.chartTable) {
      html += TBL_WRAP + '<table class="tbl num-r"><thead><tr><th scope="col">週（週一起）</th><th scope="col">場上</th><th scope="col">場外</th><th scope="col">合計</th></tr></thead><tbody>' +
        ser.map(s => '<tr><th scope="row">' + fmtMD(parseYmd(s.mon)) + '</th><td>' + s.court + '</td><td>' + s.off + '</td><td>' + (s.court + s.off) + '</td></tr>').join('') + '</tbody></table></div>';
    } else {
      html += '<div class="chart-legend"><span><i class="lg-court"></i>場上（含比賽）</span><span><i class="lg-off"></i>場外</span></div><div id="chartPlot"></div>';
    }
    html += '</section>';
  }

  html += '<section class="stack"><h2 class="h-sec">訓練紀錄</h2>';
  if (!S.logs.length) {
    html += '<div class="empty"><p>還沒有紀錄。在「今日」完成一堂課會自動寫進來，球隊打球或比賽也可以手動新增。有了紀錄，這裡會畫出每週場上和場外各練了多久。</p><button class="btn sm" type="button" data-act="addLog">新增第一筆</button></div>';
  } else {
    const logs = S.logs.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)), show = UI.logMore ? logs : logs.slice(0, 20);
    html += '<div class="logs">' + show.map(l => {
      const d = parseYmd(l.date);
      const sub = [LOG_KIND[l.kind] || '', l.kind === 'match' && l.result ? (l.result === 'W' ? '勝' : '負') + (l.score ? ' ' + l.score : '') : '', l.note || ''].filter(Boolean).join('，');
      return '<button class="log" type="button" data-act="editLog" data-id="' + esc(l.id) + '"><span class="log-d"><b>' + fmtMD(d) + '</b><span>週' + WD[dow(d)] + '</span></span>' +
        '<span class="log-m"><b>' + esc(l.title || LOG_KIND[l.kind] || '訓練') + '</b><span>' + esc(sub) + '</span></span>' +
        '<span class="log-r"><b>' + esc(+l.min || 0) + '</b><span>分鐘' + (l.rpe ? '　強度 ' + esc(l.rpe) : '') + '</span></span></button>';
    }).join('') + '</div>';
    if (logs.length > show.length) html += '<button class="btn sm ghost" type="button" data-act="logMore">顯示全部 ' + logs.length + ' 筆</button>';
  }
  html += '</section>';

  html += '<section class="stack"><div class="head"><div><h2 class="h-sec">檢測</h2><p class="small muted">每四週測一次，同一個項目的數字放在一起比。</p></div>' +
    '<button class="btn sm ghost" type="button" data-act="tests" data-k="">輸入檢測</button></div>' + testsTableHTML() + '</section>';

  html += '<section class="stack"><h2 class="h-sec">設定與備份</h2><div class="panel pad stack">' +
    '<p class="small muted">所有資料只存在這台裝置的瀏覽器裡，不會上傳。換手機或清除瀏覽資料前，先備份。</p>' +
    '<div class="btn-row"><button class="btn sm ghost" type="button" data-act="settings">程度與每週安排</button>' +
    '<button class="btn sm ghost" type="button" data-act="backup">備份</button>' +
    '<button class="btn sm ghost" type="button" data-act="restore">還原</button>' +
    '<button class="btn sm ghost" type="button" data-act="wipe">清除全部資料</button></div></div></section>';
  return html;
}
function testsTableHTML() {
  const pts = TEST_POINTS, any = pts.some(p => S.tests[p.k] && Object.keys(S.tests[p.k]).length);
  if (!any) return '<div class="empty"><p>還沒有檢測數字。計畫開始前先測一次，當作比較的起點。</p><button class="btn sm" type="button" data-act="tests" data-k="w0">做開始前檢測</button></div>';
  return TBL_WRAP + '<table class="tbl num-r tests"><thead><tr><th scope="col">項目</th>' + pts.map(p => '<th scope="col">' + p.s + '</th>').join('') + '<th scope="col">變化</th></tr></thead><tbody>' +
    TESTS.map(t => {
      const vals = pts.map(p => (S.tests[p.k] && S.tests[p.k][t.id] != null ? +S.tests[p.k][t.id] : null));
      const have = vals.filter(v => v != null);
      let delta = '';
      if (have.length >= 2) {
        const diff = Math.round((have[have.length - 1] - have[0]) * 10) / 10, good = t.better === 'low' ? diff < 0 : diff > 0;
        delta = diff === 0 ? '持平' : '<span class="' + (good ? 'delta-up' : '') + '">' + (diff > 0 ? '+' : '−') + Math.abs(diff) + (good ? '<small>進步</small>' : '') + '</span>';
      }
      return '<tr><th scope="row">' + t.n + '<small>' + t.u + (t.better === 'low' ? '，越少越好' : '') + '</small></th>' + vals.map(v => '<td>' + (v == null ? '' : esc(v)) + '</td>').join('') + '<td>' + delta + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

/* 近 8 週長條圖：依容器寬度繪製（1 單位 = 1 像素） */
function drawChart() {
  const host = $('#chartPlot'); if (!host) return;
  const ser = weeklySeries(S.logs, todayStr(), 8);
  const W = Math.max(280, Math.round(host.clientWidth || 320)), H = 190, pL = 34, pR = 6, pT = 20, pB = 24, iw = W - pL - pR, ih = H - pT - pB;
  const ax = axisFor(Math.max.apply(null, ser.map(s => s.court + s.off)));
  const band = iw / ser.length, bw = Math.min(24, Math.floor(band * 0.5)), y0 = pT + ih;
  const yy = v => pT + ih - (v / ax.max) * ih;
  const bar = (x, y, w, h, r, cls) => {
    r = Math.min(r, h, w / 2);
    return '<path class="' + cls + '" d="M' + x + ' ' + (y + h) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h) + 'Z"/>';
  };
  let g = ax.ticks.map(tk => '<line class="' + (tk === 0 ? 'cx' : 'cg') + '" x1="' + pL + '" x2="' + (W - pR) + '" y1="' + yy(tk) + '" y2="' + yy(tk) + '"/>' +
    '<text class="ct" x="' + (pL - 7) + '" y="' + (yy(tk) + 4) + '" text-anchor="end">' + tk + '</text>').join('');
  ser.forEach((s, i) => {
    const bx = pL + band * i, x = Math.round(bx + (band - bw) / 2), tot = s.court + s.off, last = i === ser.length - 1;
    const hC = (s.court / ax.max) * ih, hO = (s.off / ax.max) * ih, gap = s.court > 0 && s.off > 0 ? 2 : 0;
    let m = '<rect class="c-bg" x="' + bx + '" y="' + pT + '" width="' + band + '" height="' + ih + '" rx="4"/>';
    if (s.court > 0) m += bar(x, y0 - hC, bw, hC, s.off > 0 ? 0 : 4, 'c-court');
    if (s.off > 0) m += bar(x, y0 - hC - hO, bw, Math.max(1, hO - gap), 4, 'c-off');
    if (last && tot > 0) m += '<text class="cl" x="' + (bx + band / 2) + '" y="' + (yy(tot) - 6) + '" text-anchor="middle">' + tot + '</text>';
    m += '<text class="' + (last ? 'cl' : 'ct') + '" x="' + (bx + band / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + (last ? '本週' : fmtMD(parseYmd(s.mon))) + '</text>';
    m += '<rect class="c-hit" x="' + bx + '" y="' + pT + '" width="' + band + '" height="' + (ih + pB) + '" rx="4" tabindex="0" data-i="' + i + '" role="img" aria-label="' + fmtMD(parseYmd(s.mon)) + ' 那一週：場上 ' + s.court + ' 分鐘，場外 ' + s.off + ' 分鐘"/>';
    g += '<g class="c-col">' + m + '</g>';
  });
  host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="group" aria-label="近 8 週每週訓練分鐘數的長條圖">' + g + '</svg>';

  const chart = $('#chart');
  let tip = $('.tip', chart);
  if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; chart.appendChild(tip); }
  const show = el => {
    const s = ser[+el.getAttribute('data-i')];
    tip.textContent = '';
    const h = document.createElement('b'); h.textContent = fmtMD(parseYmd(s.mon)) + '–' + fmtMD(addDays(parseYmd(s.mon), 6)); tip.appendChild(h);
    [['場上', s.court, 'var(--viz-court)'], ['場外', s.off, 'var(--viz-off)']].forEach(r => {
      const row = document.createElement('div'), a = document.createElement('span'), k = document.createElement('i'), v = document.createElement('strong');
      k.style.background = r[2]; a.appendChild(k); a.appendChild(document.createTextNode(r[0])); v.textContent = r[1] + ' 分鐘';
      row.appendChild(a); row.appendChild(v); tip.appendChild(row);
    });
    tip.hidden = false;
    const cr = chart.getBoundingClientRect(), er = el.getBoundingClientRect(), sr = host.getBoundingClientRect();
    let left = er.left - cr.left + er.width / 2 - tip.offsetWidth / 2;
    left = clamp(left, 6, cr.width - tip.offsetWidth - 6);
    tip.style.left = left + 'px';
    tip.style.top = Math.max(4, sr.top - cr.top + yy(s.court + s.off) - tip.offsetHeight - 8) + 'px';
  };
  $$('.c-hit', host).forEach(el => {
    el.addEventListener('pointerenter', () => show(el));
    el.addEventListener('pointerleave', () => { tip.hidden = true; });
    el.addEventListener('focus', () => show(el));
    el.addEventListener('blur', () => { tip.hidden = true; });
  });
}
