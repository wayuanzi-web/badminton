/* ============================================================
   工具：間歇計時、步法點位、計分板
   ============================================================ */

/* 依實際時鐘推進的階段引擎；分頁被切到背景後回來也不會慢掉 */
function Engine(seq, hooks) {
  const e = { seq, i: 0, end: 0, left: seq.length ? seq[0].dur : 0, running: false, done: false, h: null, total: seqTotal(seq) };
  const tick = () => {
    if (!e.running) return;
    const t = performance.now();
    let moved = false;
    while (t >= e.end) {
      e.i++;
      if (e.i >= seq.length) { e.i = seq.length - 1; e.done = true; e.running = false; e.left = 0; clearInterval(e.h); hooks.finish(e); return; }
      e.end += seq[e.i].dur * 1000; moved = true;
    }
    e.left = (e.end - t) / 1000;
    if (moved) hooks.phase(e, seq[e.i]);
    hooks.tick(e, seq[e.i]);
  };
  const loop = () => { clearInterval(e.h); e.h = setInterval(tick, 80); tick(); };
  e.start = () => { if (!seq.length) return; e.i = 0; e.done = false; e.running = true; e.end = performance.now() + seq[0].dur * 1000; e.left = seq[0].dur; hooks.phase(e, seq[0]); loop(); };
  e.pause = () => { if (!e.running) return; e.left = Math.max(0, (e.end - performance.now()) / 1000); e.running = false; clearInterval(e.h); };
  e.resume = () => { if (e.running || e.done) return; e.running = true; e.end = performance.now() + e.left * 1000; loop(); };
  e.skip = () => { if (e.done) return; if (!e.running) { e.running = true; e.end = performance.now(); loop(); } else { e.end = performance.now(); tick(); } };
  e.stop = () => { e.running = false; clearInterval(e.h); };
  e.elapsed = () => { let s = 0; for (let k = 0; k < e.i; k++) s += seq[k].dur; return s + (e.done ? seq[e.i].dur : seq[e.i].dur - Math.max(0, e.left)); };
  return e;
}

const fmtStep = v => (v >= 60 ? fmtClock(v) : String(v));
const stepUnit = v => (v >= 60 ? '' : '秒');          // 1:30 這種寫法本身就看得出是分和秒
function stepperHTML(id, label, val, unit) {
  return '<div class="field"><span class="lbl" id="l-' + id + '">' + label + '</span><div class="stepper" role="group" aria-labelledby="l-' + id + '">' +
    '<button type="button" data-act="step" data-f="' + id + '" data-d="-1" aria-label="' + label + ' 減少">−</button>' +
    '<output id="o-' + id + '">' + val + '<small>' + unit + '</small></output>' +
    '<button type="button" data-act="step" data-f="' + id + '" data-d="1" aria-label="' + label + ' 增加">＋</button></div></div>';
}
const secStep = (v, d) => { const st = (d > 0 ? v : v - 1) < 60 ? 5 : (d > 0 ? v : v - 1) < 300 ? 15 : 60; return v + d * st; };

/* ================= 間歇計時 ================= */
let TM = null;
const TM_PRESETS = [
  { n: '20／40 × 8', work: 20, rest: 40, rounds: 8, sets: 1 },
  { n: '30／30 × 10', work: 30, rest: 30, rounds: 10, sets: 1 },
  { n: '20／10 × 8', work: 20, rest: 10, rounds: 8, sets: 1 },
  { n: '10／20 × 12', work: 10, rest: 20, rounds: 12, sets: 1 },
  { n: '60／30 × 4', work: 60, rest: 30, rounds: 4, sets: 1 }
];
function openTimer(spec, name, auto) {
  const cfg = Object.assign({ work: 20, rest: 40, rounds: 8, sets: 1, setRest: 120, prep: 5 }, spec || {});
  delete cfg.t;
  if (!cfg.setRest) cfg.setRest = 120;             // 從課表帶進來的份量沒有組間休息，補上預設值
  const st = { cfg, name: name || '', eng: null, lastSec: null };
  TM = st;
  st.d = openSheet({
    title: name ? '計時：' + name : '間歇計時', cls: 'full', body: '',
    onClose: () => { if (st.eng) st.eng.stop(); wakeOff(); if (TM === st) TM = null; }
  });
  if (auto) tmStart(st); else tmRenderCfg(st);
}
function tmSpec(c) { return { work: c.work, rest: c.rest, rounds: c.rounds, sets: c.sets, setRest: c.sets > 1 ? c.setRest : 0 }; }
function tmRenderCfg(st) {
  const c = st.cfg, total = seqTotal(buildTimerSeq(tmSpec(c), 0));
  setSheetBody(st.d, '<div class="tm">' +
    '<div class="chips" role="group" aria-label="常用組合">' + TM_PRESETS.map((p, i) => '<button class="chip" type="button" data-act="tmPreset" data-i="' + i + '">' + p.n + '</button>').join('') + '</div>' +
    '<div class="tm-cfg">' +
    stepperHTML('work', '動', fmtStep(c.work), stepUnit(c.work)) + stepperHTML('rest', '休', fmtStep(c.rest), stepUnit(c.rest)) +
    stepperHTML('rounds', '回數', c.rounds, '回') + stepperHTML('sets', '組數', c.sets, '組') +
    (c.sets > 1 ? stepperHTML('setRest', '組間休息', fmtStep(c.setRest), stepUnit(c.setRest)) : '') + stepperHTML('prep', '開始前倒數', c.prep, '秒') +
    '</div>' +
    '<p class="tm-sum">全部做完 ' + fmtDur(total) + '。每段結束前 3 秒會有提示音。</p>' +
    '<button class="btn block" type="button" data-act="tmStart">開始</button>' +
    '<label class="toggle" for="tmSound"><span>提示音</span><input type="checkbox" id="tmSound" data-chg="sound"' + (S.set.sound ? ' checked' : '') + '></label>' +
    '</div>');
}
function tmStep(st, f, d) {
  const c = st.cfg;
  if (f === 'work') c.work = clamp(secStep(c.work, d), 5, 3600);
  else if (f === 'rest') c.rest = clamp(secStep(c.rest, d), 0, 900);
  else if (f === 'setRest') c.setRest = clamp(c.setRest + d * 15, 15, 600);
  else if (f === 'rounds') c.rounds = clamp(c.rounds + d, 1, 60);
  else if (f === 'sets') c.sets = clamp(c.sets + d, 1, 10);
  else if (f === 'prep') c.prep = clamp(c.prep + d * 5, 0, 30);
  tmRenderCfg(st);
}
const PH_NAME = { prep: '準備', work: '動', rest: '休息', setrest: '組間休息' };
function tmStart(st) {
  const c = st.cfg, spec = tmSpec(c), seq = buildTimerSeq(spec, c.prep);
  const single = spec.rounds === 1 && spec.sets === 1;
  audioCtx(); wakeOn();
  setSheetBody(st.d, '<div class="tm run"><div class="stage" id="tmStage" data-ph="prep">' +
    '<div class="stage-ph" id="tmPh"></div><div class="stage-t" id="tmT"></div><div class="stage-s" id="tmS"></div>' +
    '<div class="stage-bar"><i id="tmBar"></i></div></div><p class="sr" id="tmSay" role="status" aria-live="assertive"></p>' +
    '<div class="ctl"><button class="btn quiet" type="button" data-act="tmPause" id="tmPauseBtn">暫停</button>' +
    '<button class="btn quiet" type="button" data-act="tmSkip">跳到下一段</button>' +
    '<button class="btn ghost" type="button" data-act="tmBack">結束</button></div></div>');
  const stage = $('#tmStage', st.d), elPh = $('#tmPh', st.d), elT = $('#tmT', st.d), elS = $('#tmS', st.d), elBar = $('#tmBar', st.d), elSay = $('#tmSay', st.d);
  st.lastSec = null;
  st.eng = Engine(seq, {
    phase(e, p) {
      stage.setAttribute('data-ph', p.ph);
      elPh.textContent = single && p.ph === 'work' ? '計時' : PH_NAME[p.ph];
      elS.textContent = p.ph === 'prep' ? '準備開始' : single ? '' : '第 ' + p.round + ' / ' + spec.rounds + ' 回' + (spec.sets > 1 ? '　第 ' + p.set + ' / ' + spec.sets + ' 組' : '');
      st.lastSec = null;
      elSay.textContent = elPh.textContent + (elS.textContent ? '，' + elS.textContent : '');      // 給螢幕報讀：每換一段說一次
      if (p.ph === 'work') { beep(1175, 420, 0.6); buzz(180); }
      else if (p.ph !== 'prep') { beep(587, 420, 0.5); buzz([80, 60, 80]); }
    },
    tick(e, p) {
      const sec = Math.ceil(e.left);
      if (sec !== st.lastSec) {
        const txt = fmtClock(e.left);
        elT.textContent = txt;
        elT.classList.toggle('long', txt.length >= 5);          // 10:00 以上字要縮小才放得下
        if (sec <= 3 && sec >= 1 && p.dur > 3 && st.lastSec !== null) beep(880, 110, 0.4);
        st.lastSec = sec;
      }
      elBar.style.width = Math.min(100, e.elapsed() / e.total * 100).toFixed(1) + '%';
    },
    finish(e) {
      stage.setAttribute('data-ph', 'done');
      elPh.textContent = '完成'; elT.textContent = '0'; elT.classList.remove('long'); elS.textContent = '共 ' + fmtDur(e.total); elBar.style.width = '100%';
      elSay.textContent = '完成';
      beep(1175, 180, 0.6); setTimeout(() => beep(1568, 500, 0.6), 220); buzz([200, 100, 200]);
      wakeOff();
      const ctl = $('.ctl', st.d);
      if (ctl) {
        const had = ctl.contains(document.activeElement);
        ctl.innerHTML = '<button class="btn" type="button" data-act="tmStart">再做一次</button><button class="btn ghost" type="button" data-act="tmBack">調整設定</button><button class="btn quiet" type="button" data-act="close">關閉</button>';
        if (had) { try { ctl.firstChild.focus({ preventScroll: true }); } catch (er) { /* 忽略 */ } }
      }
    }
  });
  st.eng.start();
}
function tmPause(st) {
  if (!st.eng || st.eng.done) return;
  const b = $('#tmPauseBtn', st.d);
  if (st.eng.running) { st.eng.pause(); if (b) b.textContent = '繼續'; }
  else { st.eng.resume(); if (b) b.textContent = '暫停'; }
}

/* ================= 步法點位 ================= */
let CL = null;
function openCaller(spec) {
  const cfg = Object.assign({ gap: 2.5, n: 20, sets: 3, setRest: 60, prep: 5 }, spec || {});
  delete cfg.t;
  const st = { cfg, active: [1, 2, 3, 4, 5, 6], eng: null, cur: 0, lastIdx: -1, lastSec: null };
  CL = st;
  st.d = openSheet({
    title: '步法點位', cls: 'full', body: '',
    onClose: () => { if (st.eng) st.eng.stop(); wakeOff(); try { if (canSpeak()) window.speechSynthesis.cancel(); } catch (e) { /* 忽略 */ } if (CL === st) CL = null; }
  });
  clRenderCfg(st);
}
function callerCourt(st, live) {
  const act = st.active, cur = st.cur, bx = 150, by = 178;
  const pts = CALL_POINTS.map(p => {
    const on = live && p.id === cur, off = act.indexOf(p.id) < 0;
    return '<g' + (live ? '' : ' data-act="clToggle" data-id="' + p.id + '" role="button" tabindex="0" aria-pressed="' + !off + '" aria-label="' + p.n + (off ? '（不使用）' : '') + '"') + '>' +
      '<circle class="cc-pt' + (on ? ' on' : '') + (off ? ' off' : '') + '" cx="' + p.x + '" cy="' + p.y + '" r="' + (on ? 30 : 24) + '"/>' +
      '<text class="cc-lb' + (on ? ' on' : '') + (off ? ' off' : '') + '" x="' + p.x + '" y="' + (p.y + 5) + '">' + p.n + '</text></g>';
  }).join('');
  let arrow = '';
  if (live && cur) {
    const p = CALL_POINTS[cur - 1], dx = p.x - bx, dy = p.y - by, len = Math.sqrt(dx * dx + dy * dy), ux = dx / len, uy = dy / len;
    arrow = '<path class="cc-arrow" d="M' + (bx + ux * 14) + ' ' + (by + uy * 14) + 'L' + (p.x - ux * 36) + ' ' + (p.y - uy * 36) + '"/>';
  }
  return '<svg viewBox="0 0 300 330" role="' + (live ? 'img' : 'group') + '" aria-label="半場示意圖，球網在上方，六個步法點位">' +
    '<rect class="cc-mat" x="14" y="14" width="272" height="302" rx="6"/>' +
    '<path class="cc-line" d="M30 30v268h240V30M48 30v268M252 30v268M30 109h240M150 109v189M30 268h240"/>' +
    '<path class="cc-net" d="M22 30h256"/>' + arrow + '<circle class="cc-base" cx="' + bx + '" cy="' + by + '" r="7"/>' + pts + '</svg>';
}
function clRenderCfg(st) {
  const c = st.cfg, total = c.sets * c.n * c.gap + (c.sets - 1) * c.setRest;
  setSheetBody(st.d, '<div class="caller">' +
    '<p class="muted small">把手機放在球網的方向。聽到或看到點位就移動過去、做揮拍動作，再回到中間的白點。點一下圓圈可以關掉不想練的點。</p>' +
    '<div class="caller-court">' + callerCourt(st, false) + '</div>' +
    '<div class="tm-cfg">' + stepperHTML('gap', '每點間隔', c.gap, '秒') + stepperHTML('n', '每組點數', c.n, '點') +
    stepperHTML('sets', '組數', c.sets, '組') + stepperHTML('setRest', '組間休息', fmtStep(c.setRest), stepUnit(c.setRest)) + '</div>' +
    '<p class="tm-sum">全部做完約 ' + fmtDur(Math.round(total)) + '。</p>' +
    '<button class="btn block" type="button" data-act="clStart">開始</button>' +
    '<label class="toggle" for="clVoice"><span>語音喊點位' + (canSpeak() ? '' : '（這個瀏覽器不支援，改用高低不同的提示音）') + '</span><input type="checkbox" id="clVoice" data-chg="voice"' + (S.set.voice && canSpeak() ? ' checked' : '') + (canSpeak() ? '' : ' disabled') + '></label>' +
    '<label class="toggle" for="clSound"><span>提示音</span><input type="checkbox" id="clSound" data-chg="sound"' + (S.set.sound ? ' checked' : '') + '></label>' +
    '</div>');
}
function clStep(st, f, d) {
  const c = st.cfg;
  if (f === 'gap') c.gap = clamp(Math.round((c.gap + d * 0.5) * 10) / 10, 1, 8);
  else if (f === 'n') c.n = clamp(c.n + d * 2, 4, 80);
  else if (f === 'sets') c.sets = clamp(c.sets + d, 1, 10);
  else if (f === 'setRest') c.setRest = clamp(c.setRest + d * 15, 15, 300);
  clRenderCfg(st);
}
function clToggle(st, id) {
  const i = st.active.indexOf(id);
  if (i >= 0) { if (st.active.length <= 2) { toast('至少要留兩個點'); return; } st.active.splice(i, 1); }
  else { st.active.push(id); st.active.sort(); }
  clRenderCfg(st);
}
function clStart(st) {
  const c = st.cfg, seq = [];
  if (c.prep > 0) seq.push({ ph: 'prep', dur: c.prep, set: 1 });
  for (let s = 1; s <= c.sets; s++) {
    seq.push({ ph: 'call', dur: c.n * c.gap, set: s });
    if (s < c.sets) seq.push({ ph: 'setrest', dur: c.setRest, set: s });
  }
  audioCtx(); wakeOn();
  if (S.set.voice && canSpeak() && !hasVoice()) toast('這台裝置目前沒有可用的語音，改用提示音');
  speak('準備');                                  // 在按下按鈕的當下先說一次，之後的語音才不會被手機擋掉
  setSheetBody(st.d, '<div class="caller"><div class="caller-court" id="clCourt"></div>' +
    '<div class="caller-now" aria-live="off"><b id="clNow"></b><span id="clCnt"></span></div>' +
    '<div class="ctl"><button class="btn quiet" type="button" data-act="clPause" id="clPauseBtn">暫停</button><button class="btn ghost" type="button" data-act="clBack">結束</button></div></div>');
  const elCourt = $('#clCourt', st.d), elNow = $('#clNow', st.d), elCnt = $('#clCnt', st.d);
  st.cur = 0; st.lastIdx = -1; st.lastSec = null;
  elCourt.innerHTML = callerCourt(st, true);
  st.eng = Engine(seq, {
    phase(e, p) {
      st.lastIdx = -1; st.lastSec = null;
      if (p.ph !== 'call') { st.cur = 0; elCourt.innerHTML = callerCourt(st, true); }
      if (p.ph === 'setrest') { beep(587, 420, 0.5); buzz([80, 60, 80]); }
    },
    tick(e, p) {
      if (p.ph === 'call') {
        const idx = Math.min(c.n - 1, Math.floor((p.dur - e.left) / c.gap + 1e-6));
        if (idx !== st.lastIdx) {
          st.lastIdx = idx;
          st.cur = nextCall(st.active, st.cur);
          elCourt.innerHTML = callerCourt(st, true);
          const nm = CALL_POINTS[st.cur - 1].n;
          elNow.textContent = nm;
          elCnt.textContent = (idx + 1) + ' / ' + c.n + (c.sets > 1 ? '　第 ' + p.set + ' 組' : '');
          const tone = () => beep(st.cur <= 2 ? 1175 : st.cur <= 4 ? 880 : 659, 160, 0.55);      // 前場高音、兩側中音、後場低音
          if (!speak(nm, tone)) tone();
          else if (S.set.sound) beep(1568, 60, 0.25);
        }
      } else {
        const sec = Math.ceil(e.left);
        if (sec !== st.lastSec) {
          elNow.textContent = (p.ph === 'prep' ? '準備 ' : '休息 ') + fmtClock(e.left);
          elCnt.textContent = p.ph === 'setrest' ? '下一組：第 ' + (p.set + 1) + ' / ' + c.sets + ' 組' : '';
          if (sec <= 3 && sec >= 1 && st.lastSec !== null) beep(880, 110, 0.4);
          st.lastSec = sec;
        }
      }
    },
    finish() {
      st.cur = 0; elCourt.innerHTML = callerCourt(st, true);
      elNow.textContent = '完成'; elCnt.textContent = c.sets + ' 組 × ' + c.n + ' 點';
      beep(1175, 180, 0.6); setTimeout(() => beep(1568, 500, 0.6), 220); buzz([200, 100, 200]); wakeOff();
      const ctl = $('.ctl', st.d);
      if (ctl) {
        const had = ctl.contains(document.activeElement);
        ctl.innerHTML = '<button class="btn" type="button" data-act="clStart">再做一次</button><button class="btn ghost" type="button" data-act="clBack">調整設定</button><button class="btn quiet" type="button" data-act="close">關閉</button>';
        if (had) { try { ctl.firstChild.focus({ preventScroll: true }); } catch (er) { /* 忽略 */ } }
      }
    }
  });
  st.eng.start();
}
function clPause(st) {
  if (!st.eng || st.eng.done) return;
  const b = $('#clPauseBtn', st.d);
  if (st.eng.running) { st.eng.pause(); if (b) b.textContent = '繼續'; }
  else { st.eng.resume(); if (b) b.textContent = '暫停'; }
}

/* ================= 計分板 ================= */
let SBG = null;          // 進行中的比賽（關掉面板不會消失）
let SBD = null;          // 面板
let SBT0 = 0;            // 開賽時間
function openScore() {
  SBD = openSheet({ title: '計分板', cls: 'full', body: '', onClose: () => { SBD = null; } });
  if (SBG) sbRender(); else sbRenderSetup();
}
function sbName(side, p) {
  const v = (S.sb.names[side] || [])[p];
  return (typeof v === 'string' && v.trim()) || SB_NAMES[side][p];
}
const short = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
function sbSideName(g, side) {
  return g.mode === 'D' ? sbName(side, 0) + '／' + sbName(side, 1) : sbName(side, 0);
}
function sbRenderSetup() {
  const mode = S.sb.mode === 'S' ? 'S' : 'D', sys = S.set.sys, first = S.sb.first ? 1 : 0;
  const nameInp = (side, p, label) => '<div class="field"><label for="sbn' + side + p + '">' + label + '</label><input class="inp" id="sbn' + side + p + '" maxlength="12" value="' + esc((S.sb.names[side] || [])[p] || '') + '" data-inp="sbName" data-side="' + side + '" data-p="' + p + '"></div>';
  setSheetBody(SBD, '<div class="sb form">' +
    '<div class="field"><span class="lbl">賽別</span><div class="seg wide" role="group" aria-label="賽別">' +
      '<button type="button" data-act="sbMode" data-v="D" aria-pressed="' + (mode === 'D') + '">雙打</button><button type="button" data-act="sbMode" data-v="S" aria-pressed="' + (mode === 'S') + '">單打</button></div></div>' +
    '<div class="field"><span class="lbl">計分制</span><div class="seg wide" role="group" aria-label="計分制">' +
      '<button type="button" data-act="sbSys" data-v="21" aria-pressed="' + (sys === 21) + '">21 分制</button><button type="button" data-act="sbSys" data-v="15" aria-pressed="' + (sys === 15) + '">15 分制</button></div>' +
      '<span class="small muted">' + (sys === 21 ? '20:20 後要領先 2 分，最高 30 分。' : '14:14 後要領先 2 分，最高 21 分。2027 年起的新制。') + '</span></div>' +
    '<div class="sb-names">' + nameInp(0, 0, mode === 'D' ? '我方（先站右區）' : '我方') + nameInp(1, 0, mode === 'D' ? '對方（先站右區）' : '對方') +
      (mode === 'D' ? nameInp(0, 1, '我方隊友') + nameInp(1, 1, '對方隊友') : '') + '</div>' +
    '<div class="field"><span class="lbl">誰先發球</span><div class="seg wide" role="group" aria-label="誰先發球">' +
      '<button type="button" data-act="sbFirst" data-v="0" aria-pressed="' + (first === 0) + '">我方</button><button type="button" data-act="sbFirst" data-v="1" aria-pressed="' + (first === 1) + '">對方</button></div></div>' +
    '<button class="btn block" type="button" data-act="sbStart">開始比賽</button></div>');
}
function sbCourtSVG(g) {
  const inf = sbInfo(g);
  /* 我方在左、對方在右。面向球網時：我方的右區在圖的下方，對方的右區在圖的上方 */
  const quad = (side, court) => {
    const left = side === 0, top = left ? court === 1 : court === 0;
    return { x: left ? 12 : 204, y: top ? 12 : 85, w: 124, h: 73 };
  };
  let out = '';
  [0, 1].forEach(side => [0, 1].forEach(court => {
    const q = quad(side, court), isSv = inf.side === side && inf.court === court, isRc = inf.side !== side && inf.court === court;
    let nm = '';
    if (g.mode === 'D') nm = sbName(side, g.pos[side][court]);
    else if (inf.court === court) nm = sbName(side, 0);
    out += '<rect class="sc-q' + (isSv ? ' sv' : isRc ? ' rc' : '') + '" x="' + q.x + '" y="' + q.y + '" width="' + q.w + '" height="' + q.h + '"/>';
    if (nm) out += '<text class="sc-nm' + (isSv ? ' sv' : '') + '" x="' + (q.x + q.w / 2) + '" y="' + (q.y + q.h / 2 + (isSv || isRc ? -2 : 5)) + '">' + esc(short(nm, 8)) + '</text>';
    if (isSv || isRc) out += '<text class="sc-tag' + (isSv ? ' sv' : '') + '" x="' + (q.x + q.w / 2) + '" y="' + (q.y + q.h / 2 + 15) + '">' + (isSv ? '發球' : '接發') + '</text>';
  }));
  return '<svg viewBox="0 0 340 170" role="img" aria-label="站位圖：' + esc(sbServeText(g)) + '">' +
    '<rect class="sc-mat" x="4" y="4" width="332" height="162" rx="6"/>' + out +
    '<path class="sc-line" d="M12 12h316v146H12zM12 85h124M204 85h124M136 12v146M204 12v146"/><path class="sc-net" d="M170 6v158"/></svg>';
}
function sbServeText(g) {
  const inf = sbInfo(g), cn = inf.court ? '左區' : '右區';
  const sv = sbName(inf.side, inf.server), rc = sbName(1 - inf.side, inf.receiver);
  return sv + ' 從' + cn + '發球，' + rc + ' 接發';
}
function sbRender() {
  const g = SBG; if (!SBD || !g) return;
  const inf = sbInfo(g), t = sbTarget(g.sys);
  let msg = '';
  if (g.note === 'mid') msg = '<div class="sb-msg"><span>' + t.mid + ' 分，局中休息 60 秒</span><button class="btn sm" type="button" data-act="sbRest" data-s="60">計時 60 秒</button></div>';
  else if (g.note === 'mid3') msg = '<div class="sb-msg"><span>' + t.mid + ' 分，換邊並休息 60 秒</span><button class="btn sm" type="button" data-act="sbRest" data-s="60">計時 60 秒</button></div>';
  else if (g.note === 'game') {
    const r = g.results[g.results.length - 1];
    msg = '<div class="sb-msg"><span>第 ' + g.gameNo + ' 局結束 ' + r[0] + ':' + r[1] + '。休息 120 秒，換邊。</span>' +
      '<span class="btn-row"><button class="btn sm" type="button" data-act="sbRest" data-s="120">計時 120 秒</button><button class="btn sm" type="button" data-act="sbNext">開始下一局</button></span></div>';
  } else if (g.note === 'match') {
    msg = '<div class="sb-msg"><span>比賽結束，' + esc(sbSideName(g, g.winner)) + ' 以 ' + g.games[g.winner] + ':' + g.games[1 - g.winner] + ' 獲勝（' + sbScoreText(g) + '）</span>' +
      '<span class="btn-row"><button class="btn sm" type="button" data-act="sbSave"' + (g.saved ? ' disabled' : '') + '>' + (g.saved ? '已存到紀錄' : '存到紀錄') + '</button><button class="btn sm" type="button" data-act="sbReset">再來一場</button></span></div>';
  }
  const side = s => '<button class="sb-side' + (inf.side === s && !g.over ? ' serving' : '') + '" type="button" data-act="sbPt" data-side="' + s + '"' + (g.over || g.gameOver ? ' disabled' : '') + ' aria-label="' + esc(sbSideName(g, s)) + ' 得分，目前 ' + g.score[s] + ' 分">' +
    '<span class="nm">' + esc(sbSideName(g, s)) + (inf.side === s && !g.over ? '<span class="pill mark">發球</span>' : '') + '</span><span class="sc">' + g.score[s] + '</span><span class="hint">' + (g.over || g.gameOver ? '' : '點一下加 1 分') + '</span></button>';
  const canSwap = g.mode === 'D' && g.score[0] === 0 && g.score[1] === 0 && !g.over;
  setSheetBody(SBD, '<div class="sb">' +
    '<div class="sb-games"><span>第 ' + g.gameNo + ' 局</span><span>局數 <b class="num">' + g.games[0] + ' : ' + g.games[1] + '</b></span><span>' + g.sys + ' 分制</span>' +
    (g.results.length ? '<span>' + sbScoreText(g) + '</span>' : '') + '</div>' + msg +
    '<div class="sb-board">' + side(0) + side(1) + '</div>' +
    (g.over ? '' : '<p class="sb-serve">' + esc(sbServeText(g)) + '</p><div class="sb-court">' + sbCourtSVG(g) + '</div>') +
    (canSwap ? '<p class="small muted" style="text-align:center">每局開始前，可以調整誰站右區（先發球或先接發）。</p>' : '') +
    '<div class="ctl">' + (canSwap ? '<button class="btn sm quiet" type="button" data-act="sbSwap" data-side="0">' + icon('swap') + '我方對調</button><button class="btn sm quiet" type="button" data-act="sbSwap" data-side="1">' + icon('swap') + '對方對調</button>' : '') +
    '<button class="btn sm quiet" type="button" data-act="sbUndo"' + (g.hist.length && !g.saved ? '' : ' disabled') + '>' + icon('undo') + '復原</button>' +
    '<button class="btn sm ghost" type="button" data-act="sbAskReset">重新設定</button></div>' +
    '<p class="sr" role="status" aria-live="polite">' + esc(sbSideName(g, 0)) + ' ' + g.score[0] + ' 分，' + esc(sbSideName(g, 1)) + ' ' + g.score[1] + ' 分。' + (g.over ? '比賽結束。' : esc(sbServeText(g))) + '</p></div>');
}
function sbSaveLog() {
  const g = SBG; if (!g || !g.over || g.saved) return;
  const min = clamp(Math.round(((g.endedAt || Date.now()) - SBT0) / 60000), 1, 600);      // 用比賽結束的時間算，不是按下存檔的時間
  S.logs.push({ id: uid(), date: todayStr(), kind: 'match', title: ((g.mode === 'D' ? '雙打' : '單打') + '比賽　對 ' + sbSideName(g, 1)).slice(0, 40), min, rpe: null, note: '', result: g.winner === 0 ? 'W' : 'L', score: sbScoreText(g) });
  g.saved = true;
  save();
  toast('已存到紀錄');
}
