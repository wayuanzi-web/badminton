/* ============================================================
   App 核心：狀態、儲存、小工具、圖示、球場圖、對話面板、聲音
   ============================================================ */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const now = () => (typeof window !== 'undefined' && window.__BMT_NOW__ && isYmd(window.__BMT_NOW__)) ? parseYmd(window.__BMT_NOW__) : new Date();
const todayStr = () => ymd(now());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- 狀態與儲存 ---------- */
const KEY = 'badminton-handbook-v1';
const store = {
  ok: true,          // 這個環境能不能讀寫儲存空間
  empty: false,      // 讀得到，但裡面還沒有資料
  read() {
    let raw = null;
    try { raw = window.localStorage.getItem(KEY); this.ok = true; }
    catch (e) { this.ok = false; return null; }
    this.empty = raw === null || raw === '';
    if (this.empty) return null;
    try { return JSON.parse(raw); }
    catch (e) {
      try { window.localStorage.setItem(KEY + '-damaged', raw); } catch (e2) { /* 留不住就算了 */ }   // 內容壞掉：先留一份原文再重來
      return null;
    }
  },
  write(o) {
    try { window.localStorage.setItem(KEY, JSON.stringify(o)); this.ok = true; }
    catch (e) { this.ok = false; }
  }
};
function defaultStart() {
  const t = now(), d = dow(t);
  return ymd(d <= 2 ? mondayOf(t) : addDays(mondayOf(t), 7));     // 週一到週三從本週算起，其餘從下週一開始
}
function defaultState() {
  return {
    v: 2, setup: false,
    set: { level: 1, days: ['rest', 'court', 'rest', 'off', 'rest', 'court', 'rest'], start: defaultStart(), sys: 21, sound: true, voice: true, kg: null },
    day: {},        // day[日期][課表代碼] = { ck: { '段落-項目': 1 } }
    over: {},       // over[日期] = 當天改做的課表代碼
    logs: [],       // { id, date, kind, title, min, rpe, note, result, score, sid }
    tests: {},      // tests[檢測點][項目] = 數值
    arch: [],       // 前幾輪計畫的檢測數字
    sb: { names: cleanNames(null), mode: 'D', first: 0 }
  };
}
/* 不管來源是儲存空間還是貼上的備份，一律逐欄清洗，型別不對就用預設值 */
function normalize(s) {
  const d = defaultState();
  if (!isObj(s)) return d;
  const st = isObj(s.set) ? s.set : {}, sb = isObj(s.sb) ? s.sb : {};
  const lvl = Number(st.level), kg = Number(st.kg);
  return {
    v: 2, setup: !!s.setup,
    set: {
      level: Number.isInteger(lvl) ? clamp(lvl, 0, 2) : d.set.level,
      days: (Array.isArray(st.days) && st.days.length === 7) ? st.days.map(k => (k === 'court' || k === 'off') ? k : 'rest') : d.set.days,
      start: isYmd(st.start) ? ymd(mondayOf(parseYmd(st.start))) : d.set.start,
      sys: Number(st.sys) === 15 ? 15 : 21,
      sound: st.sound !== false, voice: st.voice !== false,
      kg: (isFinite(kg) && kg >= 30 && kg <= 200) ? kg : null
    },
    day: cleanDays(s.day), over: cleanOver(s.over), logs: cleanLogs(s.logs), tests: cleanTests(s.tests), arch: cleanArch(s.arch),
    sb: { names: cleanNames(sb.names), mode: sb.mode === 'S' ? 'S' : 'D', first: Number(sb.first) === 1 ? 1 : 0 }
  };
}
const firstRead = store.read();
const startedEmpty = store.ok && store.empty;        // 開啟時 localStorage 裡沒有這個 App 的資料
let S = normalize(firstRead);

/* ---------- 第二份備份（IndexedDB） ----------
   放在 GitHub Pages 這類主機上時，同一個帳號的其他網站和這個 App 共用同一個網域的 localStorage，
   別的網站一清，這裡的紀錄也跟著不見。所以每次存檔都在 IndexedDB 另放一份；
   開啟時如果 localStorage 是空的、而那裡有資料，就自動還原。只有獨立網頁版使用。 */
const mirror = {
  on: STANDALONE && typeof indexedDB !== 'undefined' && !!indexedDB,
  ready: false,                  // 開啟時的比對做完之前不寫入，免得把還沒讀到的那一份蓋掉
  db: null, timer: null,
  open() {
    return new Promise((ok, no) => {
      let rq;
      try { rq = indexedDB.open('badminton-handbook', 1); } catch (e) { no(e); return; }
      rq.onupgradeneeded = () => { try { rq.result.createObjectStore('kv'); } catch (e) { /* 已經有了 */ } };
      rq.onsuccess = () => ok(rq.result);
      rq.onerror = () => no(rq.error);
      rq.onblocked = () => no(new Error('blocked'));
    });
  },
  get() {
    return new Promise((ok, no) => {
      let rq;
      try { rq = this.db.transaction('kv').objectStore('kv').get('state'); } catch (e) { no(e); return; }
      rq.onsuccess = () => ok(rq.result);
      rq.onerror = () => no(rq.error);
    });
  },
  write(text, key) {
    try { this.db.transaction('kv', 'readwrite').objectStore('kv').put(text, key); } catch (e) { /* 寫不進去就算了，localStorage 那一份還在 */ }
  },
  put() { if (this.on && this.ready && this.db) this.write(JSON.stringify(S), 'state'); },
  queue() { if (!this.on || !this.ready) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.put(), 300); },
  flush() { if (this.timer) { clearTimeout(this.timer); this.timer = null; this.put(); } }
};
const hasData = s => !!(s.setup || s.logs.length || s.arch.length || Object.keys(s.day).length || Object.keys(s.tests).length || Object.keys(s.over).length);
function save() { store.write(S); mirror.queue(); }
/* 第一次開啟就把預設值存下來，計畫開始日才不會隨著日子往後漂。有第二份備份可查時，先查過再存（mirrorStart） */
if (startedEmpty && !mirror.on) save();
/* 啟動時呼叫一次。onRestore：從第二份備份還原之後，讓畫面重畫 */
function mirrorStart(onRestore) {
  if (!mirror.on) return;
  let saved = false;
  const firstRun = () => { if (startedEmpty && !saved) { saved = true; store.write(S); } };
  const slow = setTimeout(firstRun, 1500);                           // 第二份遲遲讀不到：先照第一次使用處理
  mirror.open().then(db => { mirror.db = db; return mirror.get(); }).then(text => {
    clearTimeout(slow);
    let back = null;
    try { back = typeof text === 'string' && text ? normalize(JSON.parse(text)) : null; } catch (e) { back = null; }
    if (startedEmpty && back && hasData(back)) {
      if (!hasData(S)) { S = back; saved = true; store.write(S); mirror.ready = true; onRestore(); return; }
      mirror.write(text, 'state-prev');                              // 使用者已經動手了：舊的那一份另外留著，不直接蓋掉
    }
    firstRun();
    mirror.ready = true; mirror.put();
  }).catch(() => { clearTimeout(slow); mirror.on = false; firstRun(); });
}

const UI = { tab: 'today', menuSeg: 'menus', menuWhere: 'all', exCat: 'all', exQ: '', learn: null, planWeek: null, chartTable: false, hintOff: false, instOff: false };

/* ---------- 圖示 ---------- */
const IC = {
  shuttle: '<path d="M9.3 16 6 5.6M14.7 16 18 5.6M12 16V4.4M6 5.6c2-1.1 4-1.7 6-1.7s4 .6 6 1.7M7.5 10.4c1.5-.7 3-1 4.5-1s3 .3 4.5 1"/><path d="M8.6 16h6.8v1.7a3.4 3.4 0 0 1-6.8 0z" fill="currentColor"/>',
  today: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/><rect x="8" y="13" width="3.6" height="3.6" rx=".6" fill="currentColor" stroke="none"/>',
  plan: '<path d="M6 21V4M6 4.5h11l-2.2 3.75L17 12H6"/>',
  menu: '<path d="M9 6h11M9 12h11M9 18h11M4 6h1.5M4 12h1.5M4 18h1.5"/>',
  learn: '<path d="M12 6.5C10.5 5 8 4.5 4.5 4.5v13c3.5 0 6 .5 7.5 2 1.5-1.5 4-2 7.5-2v-13c-3.5 0-6 .5-7.5 2zM12 6.5v13"/>',
  log: '<path d="M5 20v-8M12 20V5M19 20v-5" stroke-width="2.6"/>',
  set: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  timer: '<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V9.5M9.5 3h5M12 3v3.5"/>',
  steps: '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M5 11h14M12 11v9.5"/><circle cx="8.5" cy="7.200" r="1.700" fill="currentColor" stroke="none"/>',
  score: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14M7.5 9.5v5M15 9.5h2.5V12H15v2.5h2.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  ext: '<path d="M14 5h5v5M19 5l-8 8M11 7H6.5A1.5 1.5 0 0 0 5 8.5v9A1.5 1.5 0 0 0 6.5 19h9a1.5 1.5 0 0 0 1.5-1.5V13"/>',
  undo: '<path d="M4 8h10a5.5 5.5 0 0 1 0 11H8M4 8l4-4M4 8l4 4"/>',
  swap: '<path d="M7 4 3.5 7.5 7 11M3.5 7.5h13M17 13l3.5 3.5L17 20M20.5 16.5h-13"/>'
};
function icon(name, cls) {
  return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + IC[name] + '</svg>';
}

/* ---------- 球場圖 ---------- */
/* 主視覺背景：整面球場的界線，單位為公分 */
function heroLines() {
  return '<svg class="hero-lines" viewBox="0 0 1340 610" preserveAspectRatio="xMidYMid slice" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="4">' +
    '<rect x="2.5" y="2.5" width="1335" height="605"/><path d="M0 46h1340M0 564h1340M472 0v610M868 0v610M76 0v610M1264 0v610M0 305h472M868 305h472"/>' +
    '<path d="M670 -10v630" stroke-width="8"/></svg>';
}
/* 知識：球場尺寸圖（直式，1 單位 = 2 公分） */
function courtDiagram() {
  const ox = 44, oy = 40, W = 305, H = 670, s = 23, ss = 99, ls = 38, cx = ox + W / 2, ny = oy + H / 2;
  const dimV = (x, y1, y2, txt) => '<path class="dg-dim" d="M' + (x - 4) + ' ' + y1 + 'h8M' + (x - 4) + ' ' + y2 + 'h8M' + x + ' ' + y1 + 'V' + y2 + '"/>' +
    '<text class="dg-num" text-anchor="middle" transform="translate(' + (x + 15) + ' ' + ((y1 + y2) / 2) + ') rotate(90)">' + txt + '</text>';
  const dimH = (y, x1, x2, txt, below) => '<path class="dg-dim" d="M' + x1 + ' ' + (y - 4) + 'v8M' + x2 + ' ' + (y - 4) + 'v8M' + x1 + ' ' + y + 'H' + x2 + '"/>' +
    '<text class="dg-num" text-anchor="middle" x="' + ((x1 + x2) / 2) + '" y="' + (below ? y + 18 : y - 8) + '">' + txt + '</text>';
  return '<figure class="fig"><svg class="dg" viewBox="0 0 430 760" role="img" aria-label="羽球場尺寸圖：全長 13.40 公尺，雙打寬 6.10 公尺，單打寬 5.18 公尺，前發球線距網 1.98 公尺，雙打後發球線距底線 0.76 公尺" style="max-width:430px">' +
    '<rect class="dg-bg" x="' + ox + '" y="' + oy + '" width="' + W + '" height="' + H + '"/>' +
    '<rect class="dg-line" x="' + ox + '" y="' + oy + '" width="' + W + '" height="' + H + '"/>' +
    '<path class="dg-line" d="M' + (ox + s) + ' ' + oy + 'v' + H + 'M' + (ox + W - s) + ' ' + oy + 'v' + H +
      'M' + ox + ' ' + (oy + ls) + 'h' + W + 'M' + ox + ' ' + (oy + H - ls) + 'h' + W +
      'M' + ox + ' ' + (ny - ss) + 'h' + W + 'M' + ox + ' ' + (ny + ss) + 'h' + W +
      'M' + cx + ' ' + oy + 'v' + (H / 2 - ss) + 'M' + cx + ' ' + (ny + ss) + 'v' + (H / 2 - ss) + '"/>' +
    '<path class="dg-net" d="M' + (ox - 8) + ' ' + ny + 'h' + (W + 16) + '"/>' +
    '<text class="dg-txt" x="' + (ox + 30) + '" y="' + (oy + 16) + '">底線</text>' +
    '<text class="dg-txt" x="' + (ox + 30) + '" y="' + (oy + ls + 16) + '">雙打後發球線</text>' +
    '<text class="dg-txt" x="' + (ox + 30) + '" y="' + (ny - ss - 7) + '">前發球線</text>' +
    '<text class="dg-txt" x="' + (ox + W - 30) + '" y="' + (ny - 8) + '" text-anchor="end">球網</text>' +
    '<text class="dg-txt" x="' + (cx + 7) + '" y="' + (oy + 150) + '">中線</text>' +
    '<text class="dg-txt" x="' + (ox + 30) + '" y="' + (ny + ss + 18) + '">前發球線</text>' +
    '<text class="dg-txt" text-anchor="middle" transform="translate(' + (ox + s + 15) + ' ' + (ny + ss + 130) + ') rotate(-90)">單打邊線</text>' +
    '<text class="dg-txt" text-anchor="middle" transform="translate(' + (ox - 8) + ' ' + (ny + ss + 130) + ') rotate(-90)">雙打邊線</text>' +
    dimH(oy - 18, ox, ox + W, '6.10 m') +
    dimH(oy + H + 14, ox + s, ox + W - s, '5.18 m', true) +
    dimV(ox + W + 16, oy, oy + ls, '0.76') +
    dimV(ox + W + 16, oy + ls, ny - ss, '3.96') +
    dimV(ox + W + 16, ny - ss, ny, '1.98') +
    dimV(ox + W + 52, oy, oy + H, '13.40 m') +
    '</svg><figcaption>羽球場尺寸，單位為公尺。球網在網柱處高 1.55、中央高 1.524。</figcaption></figure>';
}
/* 知識：單打與雙打的發球區（半場，球網在上，1 單位 = 2.5 公分） */
function serviceDiagram() {
  const one = (dbl) => {
    const ox = 12, oy = 30, W = 244, H = 268, s = 18.4, ss = 79.2, ls = 30.4, cx = ox + W / 2;
    const zx = cx, zy = oy + ss, zw = dbl ? W / 2 : W / 2 - s, zh = dbl ? H - ss - ls : H - ss;
    return '<figure class="fig"><svg class="dg" viewBox="0 0 268 312" role="img" aria-label="' + (dbl ? '雙打發球區：短而寬，從前發球線到雙打後發球線、中線到雙打邊線' : '單打發球區：長而窄，從前發球線到底線、中線到單打邊線') + '">' +
      '<rect class="dg-bg" x="' + ox + '" y="' + oy + '" width="' + W + '" height="' + H + '"/>' +
      '<rect class="dg-zone-on" x="' + zx + '" y="' + zy + '" width="' + zw + '" height="' + zh + '"/>' +
      '<path class="dg-line" d="M' + ox + ' ' + oy + 'v' + H + 'h' + W + 'v-' + H +
        'M' + (ox + s) + ' ' + oy + 'v' + H + 'M' + (ox + W - s) + ' ' + oy + 'v' + H +
        'M' + ox + ' ' + (oy + ss) + 'h' + W + 'M' + ox + ' ' + (oy + H - ls) + 'h' + W + 'M' + cx + ' ' + (oy + ss) + 'v' + (H - ss) + '"/>' +
      '<path class="dg-net" d="M' + (ox - 6) + ' ' + oy + 'h' + (W + 12) + '"/>' +
      '<text class="dg-txt" x="' + cx + '" y="' + (oy - 10) + '" text-anchor="middle">球網</text>' +
      '<text class="dg-txt" x="' + (zx + zw / 2) + '" y="' + (zy + zh / 2 + 5) + '" text-anchor="middle" style="fill:var(--ink);font-weight:700">右發球區</text>' +
      '<text class="dg-txt" x="' + (ox + (dbl ? W / 4 : s + (W / 2 - s) / 2)) + '" y="' + (zy + zh / 2 + 5) + '" text-anchor="middle">左發球區</text>' +
      '</svg><figcaption>' + (dbl ? '雙打：短而寬' : '單打：長而窄') + '</figcaption></figure>';
  };
  return '<div class="fig-pair">' + one(false) + one(true) + '</div>';
}
const TBL_WRAP = '<div class="tbl-wrap" tabindex="0" role="group" aria-label="表格">';      // 窄螢幕時可以左右捲，要能用鍵盤聚焦
function learnHTML(html) {
  return html
    .replace('{{court}}', courtDiagram())
    .replace('{{svc}}', serviceDiagram())
    .replace(/\{\{yt:([^|}]+)\|([^}]+)\}\}/g, (m, q, label) => ytLink(q, label))
    .replace(/<(\/?)h3>/g, '<$1h2>')                                   // 文章放在頁面標題（h1）底下，段落標題用 h2
    .replace(/<div class="tbl-wrap">/g, TBL_WRAP);
}
function ytLink(q, label) {
  return '<a class="link" href="https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + '" target="_blank" rel="noopener">' + esc(label) + '</a>';
}

/* ---------- 對話面板 ---------- */
function lockScroll() { document.documentElement.classList.toggle('lock', !!document.querySelector('dialog[open]')); }
/* 整塊重繪之後，把鍵盤焦點放回同一顆按鈕或輸入框 */
const FOCUS_ATTRS = ['data-act', 'data-tab', 'data-v', 'data-i', 'data-f', 'data-d', 'data-side', 'data-w', 'data-k', 'data-id', 'data-sid', 'data-x', 'data-ck', 'data-n', 'data-up'];
const attrEsc = v => String(v).replace(/["\\]/g, '\\$&');
function focusKey(root) {
  const el = document.activeElement;
  if (!el || el === document.body || !el.getAttribute || (root && !root.contains(el))) return null;
  if (el.id) return '[id="' + attrEsc(el.id) + '"]';
  let sel = '';
  FOCUS_ATTRS.forEach(a => { if (el.hasAttribute(a)) sel += '[' + a + '="' + attrEsc(el.getAttribute(a)) + '"]'; });
  return sel || null;
}
function refocus(root, key) {
  if (!key) return;
  let el = null;
  try { el = (root || document).querySelector(key); } catch (e) { el = null; }
  if (el && el.focus && !el.disabled) { try { el.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ } }
}
function openSheet(o) {
  const d = document.createElement('dialog');
  d.className = 'sheet' + (o.cls ? ' ' + o.cls : '');
  d.setAttribute('aria-label', o.label || o.title);
  d.innerHTML = '<div class="sheet-in"><header class="sheet-h"><h2>' + esc(o.title) + '</h2>' +
    '<button class="icon-btn" type="button" data-act="close" aria-label="關閉">' + icon('x') + '</button></header>' +
    '<div class="sheet-b">' + (o.body || '') + '</div>' + (o.foot ? '<footer class="sheet-f">' + o.foot + '</footer>' : '') + '</div>';
  document.body.appendChild(d);
  d.addEventListener('close', () => { if (o.onClose) o.onClose(); d.remove(); lockScroll(); });
  let downOutside = false;                         // 在面板外按下、也在面板外放開，才算點背景關閉
  d.addEventListener('pointerdown', e => { downOutside = e.target === d; });
  d.addEventListener('click', e => { if (e.target === d && downOutside) d.close(); downOutside = false; });
  try { d.showModal(); } catch (e) { d.setAttribute('open', ''); }
  lockScroll();
  if (o.onOpen) o.onOpen(d);
  return d;
}
function closeSheet(el) { const d = el && el.closest ? el.closest('dialog') : el; if (d && d.open) d.close(); else if (d) d.remove(); }
function closeAllSheets() { $$('dialog.sheet').forEach(d => { if (d.open) d.close(); else d.remove(); }); }
function setSheetBody(d, html) {
  const b = $('.sheet-b', d); if (!b) return;
  const key = focusKey(b);
  b.innerHTML = html;
  refocus(b, key);
}

let toastTimer = null;
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); }
  const open = $$('dialog[open]');
  (open.length ? open[open.length - 1] : document.body).appendChild(t);     // 面板開著時要放進面板，才不會被蓋住
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

/* ---------- 聲音、語音、螢幕恆亮 ---------- */
let AC = null;
function audioCtx() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') { try { AC.resume(); } catch (e) { /* 忽略 */ } }
  return AC;
}
function beep(freq, ms, vol) {
  if (!S.set.sound) return;
  const ac = audioCtx(); if (!ac) return;
  try {
    const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime, dur = (ms || 140) / 1000;
    o.type = 'triangle'; o.frequency.value = freq || 880;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.5, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + 0.03);
  } catch (e) { /* 忽略 */ }
}
function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* 忽略 */ } }
const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
/* 有語音功能不代表有語音可用（有些瀏覽器沒有安裝任何語音） */
function hasVoice() {
  try { return canSpeak() && window.speechSynthesis.getVoices().length > 0; } catch (e) { return false; }
}
/* 回傳 false 表示沒有說出口，呼叫端要自己用提示音補上 */
function speak(text, onFail) {
  if (!S.set.voice || !hasVoice()) return false;
  try {
    const u = new window.SpeechSynthesisUtterance(text);
    u.lang = 'zh-TW'; u.rate = 1.15;
    if (onFail) u.onerror = ev => { if (ev && ev.error !== 'interrupted' && ev.error !== 'canceled') onFail(); };
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    return true;
  } catch (e) { return false; }
}
try { if (canSpeak()) window.speechSynthesis.getVoices(); } catch (e) { /* 先叫一次，讓瀏覽器開始載入語音清單 */ }

/* ---------- 裝到手機主畫面：只有獨立網頁版放上網址之後才有意義 ---------- */
const onWeb = () => { try { return STANDALONE && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'); } catch (e) { return false; } };
const inApp = () => { try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (e) { return false; } };   // 已經是從主畫面開啟
const isIOS = () => { try { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); } catch (e) { return false; } };
const IOS_STEPS = '用 Safari 開這個網址，按分享鈕，選「加入主畫面」。';
/* LINE、Facebook、Instagram、微信的內建瀏覽器：不能加到主畫面，要先換到手機的瀏覽器 */
const inWebView = () => { try { return /\bLine\/|FBAN|FBAV|FB_IAB|Instagram|MicroMessenger/i.test(navigator.userAgent); } catch (e) { return false; } };
const WEBVIEW_STEPS = '這是 LINE 這類 App 的內建瀏覽器，不能加到主畫面。點右上角的選單，選「以預設瀏覽器開啟」，再從那裡安裝。';
/* 分享用的網址。openExternalBrowser=1 會讓 LINE 直接用手機的瀏覽器開啟連結 */
const shareUrl = () => { try { return window.location.origin + window.location.pathname + '?openExternalBrowser=1'; } catch (e) { return ''; } };

/* 沙盒環境可能不允許某些功能；先問過再用，避免在主控台留下錯誤 */
function allowed(feature) {
  try {
    const pp = document.permissionsPolicy || document.featurePolicy;
    return !(pp && pp.allowsFeature && !pp.allowsFeature(feature));
  } catch (e) { return true; }
}
let wake = null, wakeWant = false, wakeSeq = 0;
function wakeReq() {
  const seq = ++wakeSeq;
  try {
    if (!navigator.wakeLock || !navigator.wakeLock.request || !allowed('screen-wake-lock')) return;
    navigator.wakeLock.request('screen').then(w => {
      if (seq !== wakeSeq || !wakeWant) { try { w.release(); } catch (e) { /* 忽略 */ } } else wake = w;   // 回來時已經不需要了，就立刻放掉
    }).catch(() => {});
  } catch (e) { /* 忽略 */ }
}
function wakeOn() { wakeWant = true; wakeReq(); }
function wakeOff() { wakeWant = false; wakeSeq++; try { if (wake) wake.release(); } catch (e) { /* 忽略 */ } wake = null; }
