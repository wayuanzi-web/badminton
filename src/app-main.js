/* ============================================================
   面板內容、操作處理、啟動
   ============================================================ */
const TABS = [['today', '今日'], ['plan', '計畫'], ['menu', '菜單'], ['learn', '知識'], ['log', '紀錄']];
const VIEWS = { today: viewToday, plan: viewPlan, menu: viewMenu, learn: viewLearn, log: viewLog };
let renderedDay = '';

function render(keep) {
  const y = window.scrollY, view = $('#view'), key = keep ? focusKey(view) : null;
  if (!own(VIEWS, UI.tab)) UI.tab = 'today';
  try {
    view.innerHTML = VIEWS[UI.tab]();
    $('#topPos').textContent = posLabel(todayInfo().w);
  } catch (e) {
    /* 資料有問題時不要整頁空白：給一個可以備份和清除的出口 */
    if (window.console && console.error) console.error(e);
    view.innerHTML = '<div class="note-box warn"><div><b>這個畫面顯示時出了問題</b><span>可能是存在這台裝置上的資料損毀了。可以先備份，再清除資料重新開始。</span>' +
      '<div class="btn-row"><button class="btn sm" type="button" data-act="backup">備份</button><button class="btn sm ghost" type="button" data-act="wipe">清除全部資料</button></div></div></div>';
  }
  $$('#nav button').forEach(b => { if (b.getAttribute('data-tab') === UI.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  renderedDay = todayStr();
  if (UI.tab === 'log') { try { drawChart(); } catch (e) { /* 圖表畫不出來不影響其他內容 */ } }
  refocus(view, key);
  /* 原本聚焦的按鈕被重繪掉了（例如按下「完成訓練」之後）：把焦點放回內容區，鍵盤使用者不用從頁首重新走 */
  if (keep && (!document.activeElement || document.activeElement === document.body) && !document.querySelector('dialog[open]')) {
    try { view.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ }
  }
  window.scrollTo(0, keep ? y : 0);
}
function go(tab) {
  if (!own(VIEWS, tab)) return;
  UI.tab = tab;
  try { window.history.replaceState(null, '', '#' + tab); } catch (e) { /* 預覽環境可能不允許 */ }
  render();
  try { $('#view').focus({ preventScroll: true }); } catch (e) { /* 忽略 */ }
}
/* 危險操作要按兩次 */
function armed(btn, text) {
  if (btn.getAttribute('data-armed') === '1') {
    return Date.now() - (+btn.getAttribute('data-armed-at') || 0) > 400;      // 連點兩下不算確認，要隔一下再按
  }
  btn.setAttribute('data-armed', '1'); btn.setAttribute('data-armed-at', String(Date.now()));
  const orig = btn.innerHTML, cls = btn.className;
  btn.textContent = text || '再按一次確認';
  btn.classList.add('danger');
  setTimeout(() => { if (btn.isConnected && btn.getAttribute('data-armed') === '1') { btn.removeAttribute('data-armed'); btn.removeAttribute('data-armed-at'); btn.innerHTML = orig; btn.className = cls; } }, 4000);
  return false;
}
/* 面板內容整個換掉之後，把焦點放到新畫面的主要按鈕上 */
function focusIn(d, sel) {
  const el = d ? $(sel, d) : null;
  if (el && !el.disabled) { try { el.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ } }
}
function refreshSheetBody(d, html) {
  const b = $('.sheet-b', d), y = b ? b.scrollTop : 0;
  setSheetBody(d, html);
  if (b) b.scrollTop = y;
}

/* ---------- 動作說明 ---------- */
function openEx(x, rx, note, specJson) {
  const e = EX[x]; if (!e) return;
  const cat = CATS.find(c => c.k === e.c);
  let body = '';
  if (rx) body += '<div class="ex-rx"><b>' + esc(rx) + '</b>' + (note ? '<span class="small">' + esc(note) + '</span>' : '') + '</div>';
  body += '<p class="ex-d">' + esc(e.d) + '</p>';
  body += '<div class="ex-sec"><h4>要點</h4><ul>' + e.cues.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul></div>';
  if (e.err && e.err.length) body += '<div class="ex-sec err"><h4>常見錯誤</h4><ul>' + e.err.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul></div>';
  body += '<div class="pills"><span class="pill">' + cat.n + '</span>' + (e.need.length ? e.need.map(k => '<span class="pill">' + NEED[k] + '</span>').join('') : '<span class="pill">不需要器材</span>') + '</div>';
  if (e.q) body += '<p>' + ytLink(e.q, '在 YouTube 搜尋示範影片') + '</p>';
  let foot = '';
  if (specJson) {
    let sp = null; try { sp = JSON.parse(specJson); } catch (er) { sp = null; }
    if (sp) foot = '<button class="btn" type="button" data-act="tool" data-spec="' + esc(specJson) + '" data-name="' + esc(e.n) + '">' + icon(sp.t === 'call' ? 'steps' : 'timer') + (sp.t === 'call' ? '開啟步法點位' : '開始計時') + '</button>';
  }
  openSheet({ title: e.n, body, foot });
}

/* ---------- 課表預覽 ---------- */
function openPreview(sid, w, date) {
  const sess = getSession(sid); if (!sess) return;
  const lv = S.set.level, ti = todayInfo();
  const ww = (w === undefined || w === null || w === '') ? ti.w : +w, f = ctxFactor(sid, ww);
  const isToday = ti.sid === sid && (!date || date === ti.ds);
  const body = '<p class="lede">' + esc(sess.goal) + '</p><div class="pills">' + kindPill(sess.kind) + '<span class="pill">約 ' + sessionMinutes(sess, lv, f) + ' 分鐘</span><span class="pill">' + pplLabel(sess.ppl) + '</span>' +
    '<span class="pill">' + LEVELS[lv].n + '</span></div>' + rowsHTML(sess, lv, f, { live: false });
  const foot = isToday
    ? '<button class="btn" type="button" data-act="goToday">到「今日」開始練</button>'
    : '<button class="btn" type="button" data-act="do" data-sid="' + sid + '">今天做這份</button>';
  openSheet({ title: sess.n, body, foot });
}

/* ---------- 完成訓練 ---------- */
function rpeHTML(val) {
  return '<div class="field"><span class="lbl" id="l-rpe">自覺強度（1 很輕鬆，10 到極限）</span><div class="rpe" role="group" aria-labelledby="l-rpe">' +
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => '<button type="button" data-act="rpe" data-v="' + n + '" aria-pressed="' + (+val === n) + '">' + n + '</button>').join('') + '</div>' +
    '<input type="hidden" id="f-rpe" value="' + esc(val || '') + '"></div>';
}
function openFinish() {
  const sh = SHOWN, sess = sh ? getSession(sh.sid) : null; if (!sess) return;
  if (sessLog(sh.ds, sh.sid)) { render(true); return; }
  const min = sessionMinutes(sess, S.set.level, sh.f);
  const d = openSheet({
    title: '完成訓練',
    body: '<div class="form"><p class="muted">' + esc(sess.n) + '</p>' +
      '<div class="field"><label for="f-min">實際練了幾分鐘</label><input class="inp" id="f-min" type="number" inputmode="numeric" min="0" max="600" value="' + min + '"></div>' +
      rpeHTML(null) +
      '<div class="field"><label for="f-note">備註</label><textarea class="inp" id="f-note" placeholder="例：高遠球到位變多了；反手還是容易出界"></textarea></div></div>',
    foot: '<button class="btn" type="button" data-act="finishSave">儲存紀錄</button>'
  });
  d.setAttribute('data-ds', sh.ds); d.setAttribute('data-sid', sh.sid);        // 記下是哪一天的哪一堂，跨過午夜也不會寫錯
}
function finishSave(d) {
  const ds = d.getAttribute('data-ds'), sid = d.getAttribute('data-sid'), sess = getSession(sid);
  if (!sess || !isYmd(ds)) { closeSheet(d); return; }
  if (!sessLog(ds, sid)) {
    const min = clamp(parseInt($('#f-min', d).value, 10) || 0, 0, 600), rpe = clamp(parseInt($('#f-rpe', d).value, 10) || 0, 0, 10) || null;
    S.logs.push({ id: uid(), date: ds, kind: sess.kind === 'off' ? 'off' : 'court', title: sess.n, min, rpe, note: $('#f-note', d).value.trim().slice(0, 500), sid });
    save();
  }
  closeSheet(d); render(true); toast('已寫入紀錄');
}

/* ---------- 紀錄的新增與修改 ---------- */
function openLog(id) {
  const l = id ? S.logs.find(x => x.id === id) : null;
  const v = l || { date: todayStr(), kind: 'court', title: '', min: 90, rpe: null, note: '', result: 'W', score: '' };
  const kind = own(LOG_KIND, v.kind) ? v.kind : 'court';
  const seg = (name, label, opts, cur) => '<div class="seg wide" role="group" aria-label="' + label + '">' + opts.map(o => '<button type="button" data-act="segPick" data-name="' + name + '" data-v="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '">' + o[1] + '</button>').join('') + '</div><input type="hidden" id="f-' + name + '" value="' + esc(cur) + '">';
  openSheet({
    title: l ? '修改紀錄' : '新增紀錄',
    body: '<div class="form">' +
      '<div class="field"><span class="lbl">類型</span>' + seg('kind', '類型', [['court', '場上訓練'], ['off', '場外訓練'], ['match', '比賽']], kind) + '</div>' +
      '<div class="form-2"><div class="field"><label for="f-date">日期</label><input class="inp" id="f-date" type="date" value="' + esc(v.date) + '"></div>' +
      '<div class="field"><label for="f-min">分鐘</label><input class="inp" id="f-min" type="number" inputmode="numeric" min="0" max="600" value="' + esc(+v.min || 0) + '"></div></div>' +
      '<div class="field"><label for="f-title">名稱</label><input class="inp" id="f-title" maxlength="40" placeholder="例：球隊零打、週末雙打賽" value="' + esc(v.title || '') + '"></div>' +
      '<div id="f-match"' + (kind === 'match' ? '' : ' hidden') + '><div class="form"><div class="field"><span class="lbl">結果</span>' + seg('result', '結果', [['W', '勝'], ['L', '負']], v.result === 'L' ? 'L' : 'W') + '</div>' +
      '<div class="field"><label for="f-score">比分</label><input class="inp" id="f-score" maxlength="40" placeholder="例：21-18、19-21、21-17" value="' + esc(v.score || '') + '"></div></div></div>' +
      rpeHTML(v.rpe) +
      '<div class="field"><label for="f-note">備註</label><textarea class="inp" id="f-note">' + esc(v.note || '') + '</textarea></div></div>',
    foot: '<button class="btn" type="button" data-act="logSave" data-id="' + esc(id || '') + '">儲存</button>' + (l ? '<button class="btn ghost" type="button" data-act="logDel" data-id="' + esc(id) + '">刪除</button>' : '')
  });
}
function logSave(d, id) {
  const date = $('#f-date', d).value;
  if (!isYmd(date)) { toast('請選擇日期'); return; }
  const kind = $('#f-kind', d).value, cur = id ? S.logs.find(x => x.id === id) : null;
  const o = cur || { id: uid() };
  o.date = date; o.kind = own(LOG_KIND, kind) ? kind : 'court';
  o.title = $('#f-title', d).value.trim().slice(0, 40);
  o.min = clamp(parseInt($('#f-min', d).value, 10) || 0, 0, 600);
  o.rpe = clamp(parseInt($('#f-rpe', d).value, 10) || 0, 0, 10) || null;
  o.note = $('#f-note', d).value.trim().slice(0, 500);
  if (o.kind === 'match') { o.result = $('#f-result', d).value === 'L' ? 'L' : 'W'; o.score = $('#f-score', d).value.trim().slice(0, 40); }
  else { delete o.result; delete o.score; }
  if (!cur) S.logs.push(o);
  save(); closeSheet(d); render(true); toast('已儲存');
}

/* ---------- 檢測 ---------- */
function testsBody(k) {
  if (!TEST_POINTS.some(p => p.k === k)) k = 'w0';
  const vals = own(S.tests, k) ? S.tests[k] : {};
  return '<div class="form"><div class="seg wide" role="group" aria-label="檢測時間點">' + TEST_POINTS.map(p => '<button type="button" data-act="testPt" data-k="' + p.k + '" aria-pressed="' + (p.k === k) + '">' + p.n + '</button>').join('') + '</div>' +
    '<p class="small muted">有測到的項目再填，數字會自動存起來。每次用同樣的方式測，才比得出進步。</p>' +
    TESTS.map(t => '<div class="field"><label for="t-' + t.id + '">' + t.n + '（' + t.u + '）</label><input class="inp" id="t-' + t.id + '" type="number" inputmode="decimal" min="0" step="0.1" value="' + (own(vals, t.id) && vals[t.id] != null ? esc(vals[t.id]) : '') + '" data-inp="test" data-k="' + k + '" data-id="' + t.id + '"><span class="small muted">' + t.how + '</span></div>').join('') + '</div>';
}
function openTests(k) {
  if (!k) { const w = todayInfo().w; k = w <= 1 ? 'w0' : w <= 5 ? 'w4' : w <= 9 ? 'w8' : 'w12'; }
  openSheet({ title: '檢測', body: testsBody(k), foot: '<button class="btn" type="button" data-act="close">完成</button>', onClose: () => render(true) });
}

/* ---------- 設定 ---------- */
function settingsBody() {
  const st = S.set, c = st.days.filter(k => k === 'court').length, o = st.days.filter(k => k === 'off').length;
  return '<div class="form">' +
    '<div class="field"><span class="lbl">你的程度</span><div class="opt" role="group" aria-label="程度">' + LEVELS.map((l, i) =>
      '<button type="button" data-act="setLevel" data-v="' + i + '" aria-pressed="' + (st.level === i) + '"><b>' + l.n + '</b><span>' + l.d + '</span></button>').join('') + '</div></div>' +
    '<div class="field"><span class="lbl">每週哪幾天可以練</span><div class="set-days">' + st.days.map((k, i) =>
      '<div class="set-day"><b>週' + WD[i] + '</b><div class="seg wide" role="group" aria-label="週' + WD[i] + '">' +
      [['rest', '休息'], ['court', '場上'], ['off', '場外']].map(op => '<button type="button" data-act="setDay" data-i="' + i + '" data-v="' + op[0] + '" aria-pressed="' + (k === op[0]) + '">' + op[1] + '</button>').join('') + '</div></div>').join('') + '</div>' +
      '<span class="small muted">目前每週場上 ' + c + ' 天、場外 ' + o + ' 天。場上是有球場和球友的日子；場外是在家或健身房練肌力、步法、球感。</span></div>' +
    '<div class="field"><label for="s-start">計畫從哪一週開始</label><input class="inp" id="s-start" type="date" value="' + st.start + '" data-chg="start"><span class="small muted">選任何一天，會自動對齊到那一週的週一。</span></div>' +
    '<div class="field"><span class="lbl">平常打的計分制</span><div class="seg wide" role="group" aria-label="計分制"><button type="button" data-act="setSys" data-v="21" aria-pressed="' + (st.sys === 21) + '">21 分制</button><button type="button" data-act="setSys" data-v="15" aria-pressed="' + (st.sys === 15) + '">15 分制</button></div></div>' +
    '<label class="toggle" for="s-sound"><span>計時提示音</span><input type="checkbox" id="s-sound" data-chg="sound"' + (st.sound ? ' checked' : '') + '></label>' +
    '<label class="toggle" for="s-voice"><span>步法點位用語音喊</span><input type="checkbox" id="s-voice" data-chg="voice"' + (st.voice ? ' checked' : '') + '></label>' +
    installHTML() + '</div>';
}

/* 裝到主畫面：Android 和桌機的 Chrome、Edge 會給一個事件，按鈕可以直接跳出安裝視窗；其他瀏覽器只能用文字說明 */
let installEvt = null;
function installHTML() {
  if (!onWeb() || inApp()) return '';
  const after = '裝好之後從主畫面開啟，是全螢幕，沒有網路也能用。';
  let body;
  if (installEvt) body = '<span class="small muted">' + after + '</span><div><button class="btn sm" type="button" data-act="install">安裝到這台裝置</button></div>';
  else if (isIOS()) body = '<span class="small muted">' + IOS_STEPS + after + '主畫面版本和 Safari 的資料是分開存的，換過去之前先到「紀錄」分頁備份，再到主畫面版本裡還原。</span>';
  else body = '<span class="small muted">在瀏覽器的選單裡選「安裝」或「加到主畫面」。' + after + '</span>';
  return '<div class="field"><span class="lbl">裝到主畫面</span>' + body + '</div>';
}
function refreshInstall() {                                  // 設定面板開著時，安裝狀態一變就重畫
  const el = document.querySelector('dialog[open] #s-start'), d = el && el.closest('dialog');
  if (d) refreshSheetBody(d, settingsBody());
}
function openSettings() {
  openSheet({ title: '設定', body: settingsBody(), foot: '<button class="btn" type="button" data-act="close">完成</button>', onClose: () => { S.setup = true; save(); render(true); } });
}
function settingsChanged(el) {
  S.setup = true; UI.planWeek = null; save();
  refreshSheetBody(el.closest('dialog'), settingsBody());
}

/* ---------- 備份與還原 ---------- */
/* 下載備份檔有兩條路：獨立網頁版用一般的下載連結；在 Claude 的頁面檢視器裡，頁面不能自己下載，
   要經由平台的 downloads 功能交給使用者（會先跳出確認）。兩條路都沒有時就不顯示按鈕，只留複製文字 */
let DL = null;
const BK_FILE_BTN = '<button class="btn ghost" type="button" data-act="bkFile">下載備份檔</button>';
const bkName = () => 'badminton-backup-' + todayStr() + '.json';
function bkFileOff() {                                      // 平台說這裡不能存檔：收起按鈕，改請使用者複製文字
  DL = null;
  $$('dialog [data-act="bkFile"]').forEach(b => b.remove());
  toast('這裡無法下載檔案，請改用複製備份文字');
}
function openBackup() {
  const text = JSON.stringify(S);
  openSheet({
    title: '備份',
    body: '<div class="form"><p class="muted">把下面這段文字複製起來，貼到記事本或傳給自己。之後在「還原」貼回來，設定和紀錄就會回來。</p>' +
      '<div class="field"><label for="bk-text">備份文字</label><textarea class="inp" id="bk-text" readonly rows="6">' + esc(text) + '</textarea></div></div>',
    foot: '<button class="btn" type="button" data-act="bkCopy">複製備份文字</button>' + (STANDALONE || DL ? BK_FILE_BTN : '')
  });
}
function openRestore() {
  openSheet({
    title: '還原',
    body: '<div class="form"><p class="muted">貼上備份文字，或選擇備份檔。還原會取代這台裝置上現有的設定和紀錄。</p>' +
      '<div class="field"><label for="rs-text">備份文字</label><textarea class="inp" id="rs-text" rows="6" placeholder="貼在這裡"></textarea></div>' +
      '<div class="field"><label for="rs-file">或選擇備份檔</label><input class="inp" id="rs-file" type="file" accept=".json,application/json,text/plain" data-chg="rsFile"></div></div>',
    foot: '<button class="btn" type="button" data-act="rsApply">還原並取代現有資料</button>'
  });
}
function restoreApply(btn) {
  const d = btn.closest('dialog'), raw = $('#rs-text', d).value.trim();
  let obj = null;
  try { obj = JSON.parse(raw); } catch (e) { obj = null; }
  if (!isObj(obj) || !isObj(obj.set) || !Array.isArray(obj.logs)) { toast('這不是有效的備份文字，請確認有完整貼上'); return; }
  if (!armed(btn, '再按一次，確定取代')) return;
  S = normalize(obj); save(); UI.planWeek = null; SBG = null;
  closeSheet(d); render(); toast('已還原 ' + S.logs.length + ' 筆紀錄');
}

/* ---------- 操作處理 ---------- */
const ACT = {
  close: el => closeSheet(el),
  settings: () => openSettings(),
  ex: el => openEx(el.getAttribute('data-x'), el.getAttribute('data-rx'), el.getAttribute('data-note'), el.getAttribute('data-spec')),
  tool: el => {
    let sp = null; try { sp = JSON.parse(el.getAttribute('data-spec')); } catch (e) { sp = null; }
    if (!sp) return;
    if (sp.t === 'call') openCaller(sp); else if (sp.t === 'timer') openTimer(sp, el.getAttribute('data-name'));
  },
  timer: () => openTimer(null, ''),
  caller: () => openCaller(null),
  score: () => openScore(),
  preview: el => openPreview(el.getAttribute('data-sid'), el.getAttribute('data-w'), el.getAttribute('data-date')),
  goToday: () => { closeAllSheets(); go('today'); },
  do: el => {
    const sid = el.getAttribute('data-sid'), sess = getSession(sid); if (!sess) return;
    const ds = todayStr(), ti = todayInfo(), planned = ti.w >= 0 ? ti.sched[ti.d].sid : null;
    if (planned === sid) delete S.over[ds]; else S.over[ds] = sid;
    save(); closeAllSheets(); go('today'); toast('今天的課表：' + sess.n);
  },
  unover: () => { delete S.over[SHOWN ? SHOWN.ds : todayStr()]; delete S.over[todayStr()]; save(); render(); },
  finish: () => openFinish(),
  finishSave: el => finishSave(el.closest('dialog')),
  rpe: el => {
    const box = el.closest('.field'), inp = $('#f-rpe', box), v = el.getAttribute('data-v'), same = inp.value === v;
    inp.value = same ? '' : v;
    $$('.rpe button', box).forEach(b => b.setAttribute('aria-pressed', String(!same && b === el)));
  },
  segPick: el => {
    const name = el.getAttribute('data-name'), d = el.closest('dialog');
    $('#f-' + name, d).value = el.getAttribute('data-v');
    $$('button', el.parentNode).forEach(b => b.setAttribute('aria-pressed', String(b === el)));
    if (name === 'kind') $('#f-match', d).hidden = el.getAttribute('data-v') !== 'match';
  },
  addLog: () => openLog(null),
  editLog: el => openLog(el.getAttribute('data-id')),
  logSave: el => logSave(el.closest('dialog'), el.getAttribute('data-id')),
  logDel: el => {
    if (!armed(el, '再按一次，確定刪除')) return;
    const id = el.getAttribute('data-id');
    S.logs = S.logs.filter(x => x.id !== id);              // 那一天的課會自動變回「未完成」，因為完成與否是看紀錄
    save(); closeSheet(el); render(true); toast('已刪除');
  },
  logMore: () => { UI.logMore = true; render(true); },
  tests: el => openTests(el.getAttribute('data-k')),
  testPt: el => refreshSheetBody(el.closest('dialog'), testsBody(el.getAttribute('data-k'))),
  pickWeek: el => { UI.planWeek = +el.getAttribute('data-w'); render(true); },
  shift: el => {
    const n = +el.getAttribute('data-n');
    S.set.start = ymd(addDays(parseYmd(S.set.start), 7 * n)); S.setup = true; UI.planWeek = null; save(); render(true);
    toast(n > 0 ? '計畫已延後一週' : '計畫已提前一週');
  },
  startNow: () => { S.set.start = ymd(mondayOf(now())); UI.planWeek = null; save(); render(); toast('計畫改成本週開始'); },
  restart: el => {
    if (el.getAttribute('data-up') === '1') S.set.level = clamp(S.set.level + 1, 0, 2);
    if (Object.keys(S.tests).length) { S.arch.push({ start: S.set.start, tests: S.tests }); S.arch = S.arch.slice(-10); }   // 上一輪的檢測收起來，新的一輪重新比
    S.tests = {};
    S.set.start = defaultStart(); UI.planWeek = null; save(); render(); toast('新的一輪從 ' + fmtMD(parseYmd(S.set.start)) + ' 開始');
  },
  hintOff: () => { UI.hintOff = true; S.setup = true; save(); render(true); },
  instOff: () => { UI.instOff = true; render(true); },
  install: () => {
    const ev = installEvt;
    if (!ev || typeof ev.prompt !== 'function') return;
    installEvt = null;                                       // 這個事件只能用一次
    try { ev.prompt(); Promise.resolve(ev.userChoice).then(refreshInstall, refreshInstall); } catch (e) { refreshInstall(); }
  },
  menuSeg: el => { UI.menuSeg = el.getAttribute('data-v'); render(true); },
  menuWhere: el => { UI.menuWhere = el.getAttribute('data-v'); render(true); },
  exCat: el => { UI.exCat = el.getAttribute('data-v'); render(true); },
  learn: el => { UI.learn = el.getAttribute('data-id') || null; render(); },
  chartTable: () => { UI.chartTable = !UI.chartTable; render(true); },
  backup: () => openBackup(),
  restore: () => openRestore(),
  wipe: el => {
    if (!armed(el, '再按一次，清除全部')) return;
    S = defaultState(); save(); UI.planWeek = null; SBG = null; render(); toast('資料已清除');
  },
  bkCopy: el => {
    const ta = $('#bk-text', el.closest('dialog'));
    const fallback = () => { ta.focus(); ta.select(); toast('已選取文字，請按複製'); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText && allowed('clipboard-write')) navigator.clipboard.writeText(ta.value).then(() => toast('已複製到剪貼簿'), fallback);
      else fallback();
    } catch (e) { fallback(); }
  },
  bkFile: el => {
    if (DL) {
      if (el.getAttribute('aria-busy') === 'true') return;                 // 平台一次只開一個確認視窗
      el.setAttribute('aria-busy', 'true');
      const done = () => { if (el.isConnected) el.removeAttribute('aria-busy'); };
      let p;
      try { p = Promise.resolve(DL.save({ filename: bkName(), data: JSON.stringify(S) })); } catch (e) { p = Promise.reject(e); }
      p.then(() => { done(); toast('已下載備份檔'); }, err => {
        done();
        const code = err && err.code;
        if (code === 'declined') toast('已取消，沒有下載');
        else if (code === 'rate_limited') toast('請稍等一下再按一次');
        else bkFileOff();
      });
      return;
    }
    if (!STANDALONE) return;
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' }));
      a.download = bkName();
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('已下載備份檔');
    } catch (e) { toast('無法下載，請改用複製備份文字'); }
  },
  rsApply: el => restoreApply(el),
  /* 設定 */
  setLevel: el => { S.set.level = clamp(parseInt(el.getAttribute('data-v'), 10) || 0, 0, 2); settingsChanged(el); },
  setDay: el => {
    const i = parseInt(el.getAttribute('data-i'), 10), v = el.getAttribute('data-v');
    if (i >= 0 && i <= 6) S.set.days[i] = (v === 'court' || v === 'off') ? v : 'rest';
    settingsChanged(el);
  },
  setSys: el => { S.set.sys = el.getAttribute('data-v') === '15' ? 15 : 21; settingsChanged(el); },
  /* 計時器與步法點位 */
  step: el => { const f = el.getAttribute('data-f'), dd = +el.getAttribute('data-d'); if (el.closest('.caller') && CL) clStep(CL, f, dd); else if (TM) tmStep(TM, f, dd); },
  tmPreset: el => { if (!TM) return; const p = TM_PRESETS[+el.getAttribute('data-i')]; Object.assign(TM.cfg, { work: p.work, rest: p.rest, rounds: p.rounds, sets: p.sets }); tmRenderCfg(TM); },
  tmStart: () => { if (TM) { tmStart(TM); focusIn(TM.d, '#tmPauseBtn'); } },
  tmPause: () => { if (TM) tmPause(TM); },
  tmSkip: () => { if (TM && TM.eng) { TM.eng.skip(); const b = $('#tmPauseBtn', TM.d); if (b) b.textContent = '暫停'; } },
  tmBack: () => { if (TM) { if (TM.eng) TM.eng.stop(); wakeOff(); tmRenderCfg(TM); focusIn(TM.d, '[data-act="tmStart"]'); } },
  clToggle: el => { if (CL) clToggle(CL, +el.getAttribute('data-id')); },
  clStart: () => { if (CL) { clStart(CL); focusIn(CL.d, '#clPauseBtn'); } },
  clPause: () => { if (CL) clPause(CL); },
  clBack: () => { if (CL) { if (CL.eng) CL.eng.stop(); wakeOff(); try { if (canSpeak()) window.speechSynthesis.cancel(); } catch (e) { /* 忽略 */ } clRenderCfg(CL); focusIn(CL.d, '[data-act="clStart"]'); } },
  /* 計分板 */
  sbMode: el => { S.sb.mode = el.getAttribute('data-v') === 'S' ? 'S' : 'D'; save(); sbRenderSetup(); },
  sbSys: el => { S.set.sys = el.getAttribute('data-v') === '15' ? 15 : 21; save(); sbRenderSetup(); },
  sbFirst: el => { S.sb.first = el.getAttribute('data-v') === '1' ? 1 : 0; save(); sbRenderSetup(); },
  sbStart: () => { S.sb.names = cleanNames(S.sb.names); save(); SBG = sbNew({ mode: S.sb.mode, sys: S.set.sys, first: S.sb.first }); SBT0 = Date.now(); audioCtx(); sbRender(); focusIn(SBD, '[data-act="sbPt"]'); },
  sbPt: el => {
    if (!SBG) return;
    sbPoint(SBG, el.getAttribute('data-side') === '1' ? 1 : 0);
    if (SBG.over && !SBG.endedAt) SBG.endedAt = Date.now();
    if (SBG.note) { beep(SBG.note === 'match' ? 1568 : 1175, 320, 0.5); buzz(160); } else buzz(15);
    sbRender();
  },
  sbUndo: () => { if (SBG && !SBG.saved) { sbUndo(SBG); if (!SBG.over) SBG.endedAt = 0; sbRender(); } },
  sbSwap: el => { if (SBG) { sbSwap(SBG, el.getAttribute('data-side') === '1' ? 1 : 0); sbRender(); } },
  sbNext: () => { if (SBG) { sbNextGame(SBG); sbRender(); focusIn(SBD, '[data-act="sbPt"]'); } },
  sbRest: el => openTimer({ work: el.getAttribute('data-s') === '120' ? 120 : 60, rest: 0, rounds: 1, sets: 1, prep: 0 }, '休息', true),
  sbSave: () => { sbSaveLog(); sbRender(); },
  sbReset: () => { SBG = null; sbRenderSetup(); focusIn(SBD, '[data-act="sbStart"]'); },
  sbAskReset: el => { if (SBG && (SBG.score[0] || SBG.score[1] || SBG.results.length) && !SBG.over && !armed(el, '再按一次，放棄這場')) return; SBG = null; sbRenderSetup(); }
};

document.addEventListener('click', e => {
  const tabEl = e.target.closest('[data-tab]');
  if (tabEl) { e.preventDefault(); go(tabEl.getAttribute('data-tab')); return; }
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const name = el.getAttribute('data-act');
  if (own(ACT, name)) ACT[name](el, e);
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target;
  if (el && el.getAttribute && el.getAttribute('role') === 'button' && el.hasAttribute('data-act') && el.tagName !== 'BUTTON') { e.preventDefault(); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.hasAttribute('data-ck')) {
    const sh = SHOWN, sess = sh ? getSession(sh.sid) : null, key = el.getAttribute('data-ck');
    if (!sess || !/^\d{1,2}-\d{1,2}$/.test(key)) return;
    const rec = dayRec(sh.ds, sh.sid);                    // 記在畫面上顯示的那一天、那一堂
    if (el.checked) rec.ck[key] = 1; else delete rec.ck[key];
    setDayRec(sh.ds, sh.sid, rec); save();
    const row = el.closest('.row'); if (row) row.classList.toggle('is-done', el.checked);
    const pg = progOf(sess, S.set.level, rec), bar = $('#progBar'), txt = $('#progTxt');
    if (bar) bar.style.width = (pg.total ? Math.round(pg.done / pg.total * 100) : 0) + '%';
    if (txt) txt.textContent = pg.done + ' / ' + pg.total + ' 項';
    return;
  }
  const chg = el.getAttribute('data-chg');
  if (chg === 'sound' || chg === 'voice') { S.set[chg] = !!el.checked; save(); if (el.checked && chg === 'sound') { audioCtx(); beep(880, 120, 0.4); } return; }
  if (chg === 'start') {
    /* 只更新資料，不重繪面板：用鍵盤逐段輸入日期時每一段都會觸發 change，重繪會打斷輸入。對齊週一等離開欄位時再顯示 */
    if (isYmd(el.value)) { S.set.start = ymd(mondayOf(parseYmd(el.value))); S.setup = true; UI.planWeek = null; save(); }
    return;
  }
  if (chg === 'rsFile') {
    const f = el.files && el.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { const ta = $('#rs-text', el.closest('dialog')); if (ta) ta.value = String(rd.result || ''); toast('已讀入備份檔，按下方按鈕還原'); };
    rd.onerror = () => toast('讀不到這個檔案');
    rd.readAsText(f);
  }
});
document.addEventListener('input', e => {
  const el = e.target, k = el.getAttribute && el.getAttribute('data-inp');
  if (!k) return;
  if (k === 'exQ') { UI.exQ = el.value; const l = $('#exList'); if (l) l.innerHTML = exListHTML(); }
  else if (k === 'kg') {
    const v = parseFloat(el.value);
    S.set.kg = (v >= 30 && v <= 200) ? v : null; save();
    const o = $('#calcOut'); if (o && S.set.kg) o.innerHTML = dietCalcHTML();
  } else if (k === 'sbName') {
    const side = +el.getAttribute('data-side'), p = +el.getAttribute('data-p');
    S.sb.names = cleanNames(S.sb.names);
    if ((side === 0 || side === 1) && (p === 0 || p === 1)) { S.sb.names[side][p] = String(el.value).slice(0, 12); save(); }
  } else if (k === 'test') {
    const tk = el.getAttribute('data-k'), id = el.getAttribute('data-id'), v = parseFloat(el.value);
    if (!TEST_POINTS.some(x => x.k === tk) || !TESTS.some(x => x.id === id)) return;
    if (!own(S.tests, tk) || !isObj(S.tests[tk])) S.tests[tk] = {};
    if (!isFinite(v) || v < 0 || v > 100000) delete S.tests[tk][id]; else S.tests[tk][id] = Math.round(v * 10) / 10;
    save();
  }
});

/* 另一個分頁改了資料時，同步過來，避免互相覆蓋 */
window.addEventListener('storage', e => {
  if (e.key !== KEY || !e.newValue) return;
  try { S = normalize(JSON.parse(e.newValue)); } catch (er) { return; }
  if (!document.querySelector('dialog[open]')) render(true);
});

/* 開始日：離開欄位時才把顯示的日期對齊到週一 */
document.addEventListener('focusout', e => {
  const el = e.target;
  if (el && el.id === 's-start' && el.value !== S.set.start) el.value = S.set.start;
});

let rsT = null;
window.addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(() => { if (UI.tab === 'log') drawChart(); }, 150); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (wakeWant) wakeReq();                               // 切回來時螢幕恆亮已經被系統收回，計時中就再要一次
  if (renderedDay && renderedDay !== todayStr() && !document.querySelector('dialog[open]')) render(true);
});

function init() {
  document.documentElement.setAttribute('lang', 'zh-Hant-TW');      // 讓系統挑繁體中文的字形
  $('#brandIc').innerHTML = icon('shuttle');
  $('#setBtn').innerHTML = icon('set');
  $('#nav').innerHTML = TABS.map(t => '<button type="button" data-tab="' + t[0] + '">' + icon(t[0]) + '<span>' + t[1] + '</span></button>').join('');
  let h = '';
  try { h = (window.location.hash || '').replace('#', ''); } catch (e) { h = ''; }
  if (TABS.some(t => t[0] === h)) UI.tab = h;
  render();
  if (STANDALONE) {
    try {
      const secure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (secure && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    } catch (e) { /* 忽略 */ }
    /* 從主畫面開啟時，請瀏覽器把這個 App 的資料列為不要自動清除（紀錄只存在這台裝置上） */
    try { if (inApp() && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* 忽略 */ }
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; refreshInstall(); });
    window.addEventListener('appinstalled', () => { installEvt = null; refreshInstall(); toast('已裝到主畫面'); });
  } else {
    /* 在 Claude 的頁面檢視器裡：問平台有沒有下載功能。答案晚一點才會回來，沒有也照常使用 */
    try {
      const c = window.claude;
      if (c && typeof c.use === 'function') {
        Promise.resolve(c.use('downloads')).then(ns => {
          if (!ns || typeof ns.save !== 'function') return;
          DL = ns;
          const ta = document.querySelector('dialog[open] #bk-text');          // 備份面板剛好開著，就把按鈕補上
          const foot = ta && $('.sheet-f', ta.closest('dialog'));
          if (foot && !$('[data-act="bkFile"]', foot)) foot.insertAdjacentHTML('beforeend', BK_FILE_BTN);
        }, () => {});
      }
    } catch (e) { /* 忽略 */ }
  }
}
init();
