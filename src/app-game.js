/* ============================================================
   闖關的畫面：今日的段位卡、練前檢查、負荷提醒、健康自評、闖關面板
   ============================================================ */

/* ---------- 經驗值變化的提示 ---------- */
var GS = null;                                        // 上一次算出來的闖關狀態（用 var：app-core 第一次存檔時這裡還沒執行到）
/* silent：還原備份、清除資料之後重新對齊，不跳提示 */
function gameTick(silent) {
  let g;
  try { g = gameState(S, todayStr()); } catch (e) { return; }
  const prev = GS; GS = g;
  if (silent || !prev) return;
  const df = gameDiff(prev, g);
  if (df.xp <= 0) return;
  const parts = ['+' + df.xp + ' 經驗值'];
  if (df.up) parts.push('升到第 ' + df.up.lv + ' 段：' + df.up.n);
  df.badges.forEach(b => parts.push('新徽章：' + b.n));
  df.quests.forEach(q => parts.push('任務完成：' + q.n));
  setTimeout(() => {                                    // 讓呼叫端自己的提示先出來，再接在後面
    const t = $('#toast'), cur = t && !t.hidden ? t.textContent : '';
    toast((cur ? cur + '。' : '') + parts.join('。'));
    if (df.up || df.badges.length) { beep(988, 120, 0.35); setTimeout(() => beep(1319, 180, 0.35), 130); }
  }, 0);
}

/* ---------- 今日：段位卡 ---------- */
function gameCardHTML() {
  const g = GS || gameState(S, todayStr()), r = g.rank;
  const nextLine = r.next ? '再 ' + (r.next - r.xp) + ' 分升到「' + r.nextN + '」' : '已經是最高段位';
  const q = g.quests.find(x => !x.done);
  return '<button class="gcard" type="button" data-act="game" aria-label="闖關：第 ' + r.lv + ' 段 ' + r.n + '，' + r.xp + ' 經驗值，' + nextLine + '">' +
    '<span class="g-lv"><b>' + r.lv + '</b><small>段</small></span>' +
    '<span class="g-m"><b>' + esc(r.n) + '</b>' +
      '<span class="xpbar" aria-hidden="true"><i style="width:' + r.pct + '%"></i></span>' +
      '<span class="small">' + r.xp + ' 分，' + nextLine + '</span>' +
      (q ? '<span class="small g-q">新手任務 ' + (g.quests.length - g.questLeft) + '/' + g.quests.length + '：' + esc(q.n) + '</span>'
         : '<span class="small g-q">徽章 ' + g.badgeN + '/' + g.badges.length + '</span>') +
    '</span><span class="row-chev">' + icon('chev') + '</span></button>';
}

/* ---------- 今日：負荷提醒、健康自評提醒 ---------- */
function alertsHTML() {
  let html = '';
  const al = loadAlert(S.logs, todayStr());
  if (al) html += '<div class="note-box warn" role="status"><div><b>' + esc(al.n) + '</b><span>' + esc(al.d) + '</span></div></div>';
  if (S.screen && S.screen.yes > 0) {
    html += '<div class="note-box warn"><div><b>健康自評有 ' + S.screen.yes + ' 題答「是」</b><span>開始高強度訓練前，先請醫師評估，告訴他你要做的訓練。評估之前用入門程度，自覺強度保持在 5 分以下。</span>' +
      '<div><button class="btn sm ghost" type="button" data-act="screen">重新作答</button></div></div></div>';
  }
  return html;
}

/* ---------- 今日：練前檢查 ---------- */
const RES_CLS = { go: '', easy: '', recover: ' warn', rest: ' warn' };
function readyHTML(ti) {
  if (!ti.sess || sessLog(ti.ds, ti.sid)) return '';
  if (!ti.chk) {
    return '<div class="note-box ready"><div><b>練之前，30 秒自我檢查</b><span>回答 4 個問題：有沒有生病、哪裡痛、睡得好不好、累不累。App 會告訴你今天照練、練輕量版，還是休息。</span>' +
      '<div><button class="btn sm" type="button" data-act="check">開始檢查</button></div></div></div>';
  }
  const r = READY[ti.chk.res];
  return '<div class="note-box' + RES_CLS[ti.chk.res] + '"><div><b>今日檢查：' + esc(r.n) + '</b><span>' + esc(r.d) + '</span>' +
    '<div class="btn-row">' + (ti.chk.res === 'recover' && ti.sid !== 'm_recover' ? '<button class="btn sm" type="button" data-act="do" data-sid="m_recover">改做恢復伸展</button>' : '') +
    '<button class="btn sm ghost" type="button" data-act="check">重新檢查</button></div></div></div>';
}

/* ---------- 練前檢查的面板 ---------- */
const CHK_LBL = { sleep: ['睡得好', '普通', '很差'], tired: ['精神好', '有點累', '很累'] };
function chkBody(a) {
  const seg = (name, label, opts) => '<div class="field"><span class="lbl" id="l-' + name + '">' + label + '</span><div class="seg wide" role="group" aria-labelledby="l-' + name + '">' +
    opts.map((o, i) => '<button type="button" data-act="chkPick" data-name="' + name + '" data-v="' + i + '" aria-pressed="' + (a[name] === i) + '">' + o + '</button>').join('') + '</div></div>';
  return '<div class="form">' +
    seg('ill', '今天有發燒、喉嚨以下的感冒症狀（咳嗽、胸悶、全身痠痛），或最近運動時胸痛、頭暈嗎？', ['沒有', '有']) +
    '<div class="field"><span class="lbl" id="l-pain">身上最痛的地方，現在幾分？（0 不痛，10 痛到受不了）</span><div class="rpe pain" role="group" aria-labelledby="l-pain">' +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => '<button type="button" data-act="chkPick" data-name="pain" data-v="' + n + '" aria-pressed="' + (a.pain === n) + '">' + n + '</button>').join('') + '</div></div>' +
    seg('sleep', '昨晚睡得', CHK_LBL.sleep) +
    seg('tired', '現在的精神', CHK_LBL.tired) +
    '<p class="small muted">痠不算痛。痛指的是關節、肌腱或肌肉某一點的刺痛、壓痛或卡住的感覺。</p></div>';
}
function openCheck() {
  const ti = todayInfo(), old = ti.chk;
  const a = old ? { ill: old.ill ? 1 : 0, pain: old.pain, sleep: old.sleep, tired: old.tired } : { ill: null, pain: null, sleep: null, tired: null };
  const d = openSheet({ title: '練前自我檢查', body: chkBody(a), foot: '<button class="btn" type="button" data-act="chkSave">看今天的建議</button>' });
  d._chk = a; d.setAttribute('data-ds', ti.ds);
}
function chkSave(d) {
  const a = d._chk, miss = ['ill', 'pain', 'sleep', 'tired'].filter(k => a[k] === null);
  if (miss.length) { toast('還有 ' + miss.length + ' 題沒有回答'); return; }
  const ds = d.getAttribute('data-ds'), o = { ill: a.ill === 1, pain: a.pain, sleep: a.sleep, tired: a.tired };
  o.res = readiness(o);
  S.chk[ds] = o; save();
  const r = READY[o.res];
  const acts = {
    go: '<button class="btn" type="button" data-act="close">開始練</button>',
    easy: '<button class="btn" type="button" data-act="close">好，練輕量版</button>',
    recover: '<button class="btn" type="button" data-act="do" data-sid="m_recover">改做恢復伸展</button>',
    rest: '<button class="btn" type="button" data-act="close">今天休息</button>'
  };
  setSheetBody(d, '<div class="ready-res' + RES_CLS[o.res] + '"><b>' + esc(r.n) + '</b><p>' + esc(r.d) + '</p></div>' +
    (o.res !== 'go' ? '<p class="small muted">照這個建議做，闖關會多 ' + XP.smart + ' 分。休息也是訓練的一部分。</p>' : ''));
  const f = $('.sheet-f', d); if (f) f.innerHTML = acts[o.res];
  focusIn(d, '.sheet-f .btn');
  render(true);
}

/* ---------- 健康自評 ---------- */
function openScreen() {
  const ans = SCREEN_Q.map(() => null);
  const body = '<div class="form"><p class="small muted">運動前的一般健康問題，參考國際通用的 PAR-Q+ 問卷。答案只存在這台裝置，只記錄答「是」的題數。</p>' +
    SCREEN_Q.map((q, i) => '<div class="field"><span class="lbl" id="l-sq' + i + '">' + (i + 1) + '. ' + esc(q) + '</span><div class="seg wide" role="group" aria-labelledby="l-sq' + i + '">' +
      ['否', '是'].map((o, v) => '<button type="button" data-act="sqPick" data-i="' + i + '" data-v="' + v + '" aria-pressed="false">' + o + '</button>').join('') + '</div></div>').join('') + '</div>';
  const d = openSheet({ title: '健康自評', body, foot: '<button class="btn" type="button" data-act="sqSave">完成</button>' });
  d._sq = ans;
}
function sqSave(d) {
  const a = d._sq, miss = a.filter(v => v === null).length;
  if (miss) { toast('還有 ' + miss + ' 題沒有回答'); return; }
  const yes = a.filter(v => v === 1).length;
  S.screen = { at: todayStr(), yes };
  if (yes > 0 && S.set.level > 0 && !S.setup) S.set.level = 0;            // 還沒自己設定過程度：先用入門
  save();
  setSheetBody(d, yes
    ? '<div class="ready-res warn"><b>有 ' + yes + ' 題答「是」</b><p>開始高強度訓練前，先請醫師（或醫師轉介的物理治療師）評估，告訴他你要做的訓練。評估之前用入門程度，自覺強度保持在 5 分以下，暖身做足。</p></div>'
    : '<div class="ready-res"><b>7 題都是「否」</b><p>可以放心從計畫開始。一樣從暖身做起、運動量慢慢加；身體狀況有變化，再回來重做一次。</p></div>');
  const f = $('.sheet-f', d); if (f) f.innerHTML = '<button class="btn" type="button" data-act="close">好</button>';
  focusIn(d, '.sheet-f .btn');
  render(true);
}

/* ---------- 闖關面板 ---------- */
const QUEST_BTN = {
  screen: '<button class="btn sm" type="button" data-act="screen">去做</button>',
  settings: '<button class="btn sm" type="button" data-act="settings">去設定</button>',
  readSafety: '<button class="btn sm" type="button" data-act="readSafety">去讀</button>',
  testW0: '<button class="btn sm" type="button" data-act="tests" data-k="w0">去檢測</button>',
  goToday: '<button class="btn sm" type="button" data-act="goToday">到今日</button>'
};
function gameBody() {
  const g = gameState(S, todayStr()), r = g.rank;
  let html = '<section class="g-head"><span class="g-lv big"><b>' + r.lv + '</b><small>段</small></span><div class="g-m"><b>' + esc(r.n) + '</b>' +
    '<span class="xpbar" aria-hidden="true"><i style="width:' + r.pct + '%"></i></span>' +
    '<span class="small">' + r.xp + ' 分' + (r.next ? '，再 ' + (r.next - r.xp) + ' 分升到「' + esc(r.nextN) + '」' : '，已經是最高段位') + '</span></div></section>';

  html += '<section class="stack"><h3 class="h-sub">新手任務　' + (g.quests.length - g.questLeft) + '/' + g.quests.length + '</h3><ul class="quests">' +
    g.quests.map(q => '<li class="' + (q.done ? 'is-done' : '') + '"><span class="q-ck" aria-hidden="true">' + (q.done ? icon('check') : '') + '</span>' +
      '<span class="q-m"><b>' + esc(q.n) + '</b><span>' + esc(q.d) + (q.done ? '（完成）' : '') + '</span></span>' + (q.done ? '' : QUEST_BTN[q.act]) + '</li>').join('') + '</ul></section>';

  html += '<section class="stack"><h3 class="h-sub">徽章　' + g.badgeN + '/' + g.badges.length + '</h3><ul class="badges">' +
    g.badges.map(b => '<li class="' + (b.got ? 'is-got' : '') + '"><span class="bd-ic" aria-hidden="true">' + icon('shuttle') + '</span>' +
      '<b>' + esc(b.n) + '</b><span>' + esc(b.d) + '</span><span class="sr">' + (b.got ? '已取得' : '尚未取得') + '</span></li>').join('') + '</ul></section>';

  html += '<section class="stack"><h3 class="h-sub">怎麼得分</h3>' + TBL_WRAP + '<table class="tbl num-r"><tbody>' +
    XP_RULES.map(x => '<tr><th scope="row">' + esc(x[0]) + '</th><td>' + x[1] + '</td></tr>').join('') + '</tbody></table></div>' +
    '<p class="small muted">一天最多算一堂，多練、練更累都不會多拿分；練前檢查建議休息而你照做，一樣有分。每一條規則的根據在知識的「安全訓練的依據」。</p>' +
    '<div><button class="btn sm ghost" type="button" data-act="readSafety">看安全訓練的依據</button></div></section>';

  html += '<section class="stack"><h3 class="h-sub">段位</h3><ol class="ranks">' +
    RANKS.map((x, i) => '<li class="' + (i + 1 === r.lv ? 'is-cur' : i + 1 < r.lv ? 'is-past' : '') + '"><span>' + (i + 1) + ' 段</span><b>' + esc(x.n) + '</b><span>' + x.xp + ' 分</span></li>').join('') +
    '</ol><p class="small muted">照計畫練完一輪 12 週，大約到第 7、8 段。</p></section>';
  return html;
}
function openGame() { openSheet({ title: '闖關', body: gameBody() }); }
function markSafetyRead() { if (!S.read.safety) { S.read.safety = true; save(); } }

const GAME_ACT = {
  game: () => openGame(),
  check: () => openCheck(),
  chkPick: el => {
    const d = el.closest('dialog'), name = el.getAttribute('data-name'), v = +el.getAttribute('data-v');
    d._chk[name] = v;
    $$('button', el.parentNode).forEach(b => b.setAttribute('aria-pressed', String(b === el)));
  },
  chkSave: el => chkSave(el.closest('dialog')),
  screen: () => { closeAllSheets(); openScreen(); },
  sqPick: el => {
    const d = el.closest('dialog');
    d._sq[+el.getAttribute('data-i')] = +el.getAttribute('data-v');
    $$('button', el.parentNode).forEach(b => b.setAttribute('aria-pressed', String(b === el)));
  },
  sqSave: el => sqSave(el.closest('dialog')),
  readSafety: () => { closeAllSheets(); UI.learn = 'safety'; markSafetyRead(); go('learn'); }
};
