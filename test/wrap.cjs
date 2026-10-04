// 模擬 Artifact 發布時的外框，輸出到 out/shots/_artifact-wrapped.html
const fs = require('node:fs'); const path = require('node:path');
module.exports = function wrap() {
  const OUT = path.join(__dirname, '..', 'out', 'shots'); fs.mkdirSync(OUT, { recursive: true });
  const frag = fs.readFileSync(path.join(__dirname, '..', 'out', 'artifact', 'badminton-handbook.html'), 'utf8');
  const html = '<!doctype html><html><head><meta charset="utf8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui;background:#fafaf7}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + frag + '</body></html>';
  const f = path.join(OUT, '_artifact-wrapped.html'); fs.writeFileSync(f, html); return f;
};
