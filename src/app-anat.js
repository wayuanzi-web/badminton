/* ============================================================
   肌肉位置對照圖：正面、背面兩個人形，主要部位深色、協同部位淺色
   形狀是示意，位置對照用；不是精確的解剖圖。
   ============================================================ */

/* 左半邊的形狀（x 為負），畫的時候會鏡射到右半邊；mid: true 的畫在中線、不鏡射 */
const ANAT_SHAPES = {
  f: {
    delt: [['e', -31, 44, 8, 9.5]],
    pec: [['e', -14, 53, 13, 9]],
    bicep: [['e', -36, 70, 5.2, 12.5]],
    forearm: [['e', -41, 106, 4.8, 16]],
    abs: [['r', -8.5, 64, 17, 40, 5, 1]],
    oblique: [['e', -17.5, 86, 5, 13]],
    hipflex: [['e', -10.5, 117, 5, 7]],
    quad: [['e', -14.5, 150, 8.5, 25]],
    adductor: [['e', -5, 140, 3.6, 15]],
    tib: [['e', -14, 201, 3.8, 17]]
  },
  b: {
    trap: [['p', '0,27 -23,40 -6,52 0,66 6,52 23,40', 1]],
    upperback: [['e', -11, 55, 6.5, 9]],
    rotcuff: [['e', -21.5, 51, 6, 6]],
    delt: [['e', -31, 44, 8, 9.5]],
    lat: [['e', -19, 77, 7.5, 16]],
    tricep: [['e', -36, 70, 5.2, 12.5]],
    forearm: [['e', -41, 106, 4.8, 16]],
    erector: [['e', -4.8, 90, 3.6, 18]],
    gmed: [['e', -21, 112, 6, 6.5]],
    glute: [['e', -12, 126, 11, 11]],
    hamstring: [['e', -14.5, 158, 8, 22]],
    calf: [['e', -15, 197, 6.5, 16]]
  }
};

function anatFigure(view, cx, p, s) {
  const X = x => (cx + x).toFixed(1);
  // 身形：頭、頸、軀幹、手臂、腿（灰底）
  let g = '<g class="an-body">' +
    '<circle cx="' + cx + '" cy="15" r="10.5"/>' +
    '<rect x="' + X(-5) + '" y="23" width="10" height="9" rx="3"/>' +
    '<path d="M' + X(-29) + ' 35 Q' + X(0) + ' 30 ' + X(29) + ' 35 L' + X(25) + ' 62 L' + X(21) + ' 100 L' + X(26) + ' 124 L' + X(-26) + ' 124 L' + X(-21) + ' 100 L' + X(-25) + ' 62 Z"/>' +
    [-1, 1].map(sg => {
      const x = v => (cx + sg * v).toFixed(1);
      return '<path d="M' + x(31) + ' 40 L' + x(37) + ' 88 L' + x(42) + ' 128" class="an-limb" stroke-width="11"/>' +
        '<circle cx="' + x(43) + '" cy="134" r="5"/>' +
        '<path d="M' + x(13) + ' 122 L' + x(15) + ' 182" class="an-limb" stroke-width="19"/>' +
        '<path d="M' + x(15) + ' 178 L' + x(15) + ' 228" class="an-limb" stroke-width="12"/>' +
        '<ellipse cx="' + x(view === 'f' ? 16 : 15) + '" cy="234" rx="7" ry="4"/>';
    }).join('') + '</g>';
  const shape = (sh, cls, title) => {
    const out = [];
    const sides = sh[sh.length - 1] === 1 && (sh[0] === 'p' || sh[0] === 'r') ? [1] : [1, -1];
    sides.forEach(sg => {
      if (sh[0] === 'e') out.push('<ellipse cx="' + (cx + sg * sh[1]).toFixed(1) + '" cy="' + sh[2] + '" rx="' + sh[3] + '" ry="' + sh[4] + '"/>');
      else if (sh[0] === 'r') out.push('<rect x="' + X(sh[1]) + '" y="' + sh[2] + '" width="' + sh[3] + '" height="' + sh[4] + '" rx="' + sh[5] + '"/>');
      else if (sh[0] === 'p') out.push('<polygon points="' + sh[1].split(' ').map(pt => { const [a, b] = pt.split(','); return X(+a) + ',' + b; }).join(' ') + '"/>');
    });
    return '<g class="' + cls + '"><title>' + esc(title) + '</title>' + out.join('') + '</g>';
  };
  const shapes = ANAT_SHAPES[view];
  // 所有部位先畫淡淡的輪廓，再畫協同、主要
  Object.keys(shapes).forEach(m => shapes[m].forEach(sh => { g += shape(sh, 'an-m', MUSCLES[m].n); }));
  s.filter(m => shapes[m]).forEach(m => shapes[m].forEach(sh => { g += shape(sh, 'an-s', MUSCLES[m].n + '（協同）'); }));
  p.filter(m => shapes[m]).forEach(m => shapes[m].forEach(sh => { g += shape(sh, 'an-p', MUSCLES[m].n + '（主要）'); }));
  g += '<text x="' + cx + '" y="250" text-anchor="middle" class="an-cap">' + (view === 'f' ? '正面' : '背面') + '</text>';
  return g;
}

/* 回傳整段 HTML：圖、圖例、部位清單、原理 */
function anatHTML(id) {
  const a = ANAT[id];
  if (!a) return '';
  const names = list => list.map(m => esc(MUSCLES[m].n)).join('、');
  let html = '<section class="anat"><h3 class="h-sub">原理</h3><p>' + esc(a.why) + '</p>';
  if (a.p.length) {
    const label = '主要用到：' + a.p.map(m => MUSCLES[m].n).join('、') + (a.s.length ? '；協同：' + a.s.map(m => MUSCLES[m].n).join('、') : '');
    html += '<h3 class="h-sub">用到的肌肉</h3><figure class="anat-fig">' +
      '<svg viewBox="0 0 260 258" role="img" aria-label="' + esc(label) + '" xmlns="http://www.w3.org/2000/svg">' +
      anatFigure('f', 66, a.p, a.s) + anatFigure('b', 194, a.p, a.s) + '</svg>' +
      '<figcaption><span class="an-key"><i class="k-p"></i>主要</span><span class="an-key"><i class="k-s"></i>協同</span><span class="small muted">示意圖，標出大致位置</span></figcaption></figure>' +
      '<dl class="anat-list"><dt>主要</dt><dd>' + names(a.p) + '</dd>' + (a.s.length ? '<dt>協同</dt><dd>' + names(a.s) + '</dd>' : '') + '</dl>';
  }
  if (a.sys) html += '<p class="small muted">主要訓練：' + esc(a.sys) + '</p>';
  return html + '</section>';
}

/* ---------- 示範影片 ---------- */
function videoHTML(id, e) {
  const v = VIDEO[id];
  let html = '<section class="anat"><h3 class="h-sub">示範影片</h3>';
  if (v) {
    html += '<a class="vcard" href="https://www.youtube.com/watch?v=' + encodeURIComponent(v.v) + '" target="_blank" rel="noopener">' +
      '<span class="v-play" aria-hidden="true">' + icon('play') + '</span><span class="v-m"><b>' + esc(v.t) + '</b>' +
      '<span class="small">' + esc(v.ch) + (v.dur ? '　' + esc(v.dur) : '') + (v.lang === 'en' ? '　英文' : v.lang === 'zh-CN' ? '　簡體中文' : '') + '</span></span></a>';
    if (v.note) html += '<p class="small muted">' + esc(v.note) + '</p>';
  }
  if (e.q) html += '<p class="small">' + ytLink(e.q, v ? '在 YouTube 找其他示範' : '在 YouTube 搜尋示範影片') + '</p>';
  return html + '</section>';
}
