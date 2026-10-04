// 用法：node test/crop.cjs <檔名> <top> <height> [輸出名]
const sharp = require('sharp');
const [,, name, top, height, out] = process.argv;
(async () => {
  const src = 'out/shots/' + name + '.png';
  const m = await sharp(src).metadata();
  const t = Math.min(+top, m.height - 1), h = Math.min(+height, m.height - t);
  await sharp(src).extract({ left: 0, top: t, width: m.width, height: h }).toFile('out/shots/' + (out || name + '-crop') + '.png');
  console.log(m.width + 'x' + m.height, '→', t, h);
})();
