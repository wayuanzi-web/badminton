const hex = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };
const lin = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const L = h => { const [r, g, b] = hex(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (fg, bg, a) => '#' + hex(fg).map((c, i) => Math.round((c * a + hex(bg)[i] * (1 - a)) * 255).toString(16).padStart(2, '0')).join('');
const rows = [
  ['light ink on paper', '#14211b', '#f2f5f1', 4.5], ['light ink-2 on paper', '#47574f', '#f2f5f1', 4.5], ['light ink-2 on surface', '#47574f', '#ffffff', 4.5],
  ['light ink-3 on surface', '#64736b', '#ffffff', 4.5], ['light ink-3 on paper', '#64736b', '#f2f5f1', 4.5], ['light ink-2 on surface-2', '#47574f', '#e8eee9', 4.5],
  ['light court-text on surface', '#0b6a50', '#ffffff', 4.5], ['light court-text on court-soft', '#0b6a50', '#dfefe8', 4.5], ['light court-text on paper', '#0b6a50', '#f2f5f1', 4.5],
  ['light off-text on off-soft', '#1b5aa8', '#e2edfb', 4.5], ['light warn on warn-soft', '#9a4a06', '#fcefdc', 4.5], ['light danger on surface', '#b42318', '#ffffff', 4.5],
  ['white on court', '#ffffff', '#0e7257', 4.5], ['hero dim on court', mix('#ffffff', '#0e7257', .86), '#0e7257', 4.5], ['white on off-panel', '#ffffff', '#1d5296', 4.5],
  ['hero dim on off-panel', mix('#ffffff', '#1d5296', .86), '#1d5296', 4.5], ['mark-ink on mark', '#2a2200', '#f5c518', 4.5], ['court-deep on white (hero btn)', '#0a5440', '#ffffff', 4.5],
  ['mark on court (progress, 3:1)', '#f5c518', '#0e7257', 3], ['chip pressed paper on ink', '#f2f5f1', '#14211b', 4.5], ['ink-2 on court-soft (note)', '#47574f', '#dfefe8', 4.5],
  ['dark ink on paper', '#e8efea', '#0d1411', 4.5], ['dark ink-2 on surface', '#aebdb5', '#151e1a', 4.5], ['dark ink-3 on surface', '#8a9a92', '#151e1a', 4.5], ['dark ink-3 on paper', '#8a9a92', '#0d1411', 4.5],
  ['dark ink-2 on surface-2', '#aebdb5', '#1d2924', 4.5], ['dark court-text on surface', '#62d2ac', '#151e1a', 4.5], ['dark court-text on court-soft', '#62d2ac', '#16352b', 4.5],
  ['dark off-text on off-soft', '#86b9f6', '#152b47', 4.5], ['dark warn on warn-soft', '#f2a65a', '#33240f', 4.5], ['dark white on court', '#ffffff', '#0f6b52', 4.5],
  ['dark hero dim on court', mix('#ffffff', '#0f6b52', .86), '#0f6b52', 4.5], ['dark white on off-panel', '#ffffff', '#1a4379', 4.5], ['dark danger on surface', '#f28b82', '#151e1a', 4.5],
  ['dark btn danger: surface on danger', '#151e1a', '#f28b82', 4.5], ['light btn danger: surface on danger', '#ffffff', '#b42318', 4.5], ['dark tip: paper on ink', '#0d1411', '#e8efea', 4.5],
  ['dark stage dim on court', mix('#ffffff', '#0f6b52', .86), '#0f6b52', 4.5], ['stage prep dim on mark', mix('#2a2200', '#f5c518', .74), '#f5c518', 4.5], ['viz-court on surface light (3:1)', '#0f8262', '#ffffff', 3], ['viz-off on surface light (3:1)', '#2a78d6', '#ffffff', 3],
  ['viz-court on surface dark (3:1)', '#23a27f', '#151e1a', 3], ['viz-off on surface dark (3:1)', '#3987e5', '#151e1a', 3], ['dark ink-2 on court-soft', '#aebdb5', '#16352b', 4.5],
  ['light control border on surface (3:1)', '#7f8f87', '#ffffff', 3], ['light control border on paper (3:1)', '#7f8f87', '#f2f5f1', 3], ['dark control border on surface (3:1)', '#5f7369', '#151e1a', 3], ['dark control border on paper (3:1)', '#5f7369', '#0d1411', 3],
  ['focus ring on court (3:1)', '#ffffff', '#0e7257', 3], ['caller focus stroke on court (3:1)', '#f5c518', '#0e7257', 3], ['light ink-2 on court-soft (today row)', '#47574f', '#dfefe8', 4.5], ['dark ink-2 on court-soft (today row)', '#aebdb5', '#16352b', 4.5],
  ['dark off-panel dim', mix('#ffffff', '#1a4379', .86), '#1a4379', 4.5], ['light danger hover text', '#ffffff', '#b42318', 4.5]
];
let fail = 0;
for (const [n, a, b, min] of rows) { const v = cr(a, b); if (v < min) { fail++; console.log('LOW ', v.toFixed(2), '<', min, n, a, b); } }
console.log(rows.length - fail, 'ok,', fail, 'low');
