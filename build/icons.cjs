// 重新產生圖示時才需要：npm install sharp 後執行 node build/icons.cjs
const sharp = require('sharp');
const fs = require('node:fs');
(async () => {
  const svg = fs.readFileSync('src/icon.svg');
  const out = 'out/site/';
  for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512], ['apple-touch-icon.png', 180]]) {
    await sharp(svg, { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toFile(out + name);
  }
  console.log(fs.readdirSync(out).map(f => f + ' ' + fs.statSync(out + f).size).join('\n'));
})();
