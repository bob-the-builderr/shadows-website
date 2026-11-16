// Builds the home-screen icon (apple-touch-icon.png, 180x180) from the client's logo in ../source:
// the owl's head, on Shadow Black. Run from this folder:  npm install && node build-icons.js [outdir]
const path = require('path');
const sharp = require('sharp');

const SRC = path.join(__dirname, '..', 'source', 'logo.png');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'assets'));
const HEAD = { left: 164, top: 28, width: 424, height: 292 };   // the owl's head in logo.png (no lettering)
const SIZE = 180, PAD = 18, VOID = { r: 8, g: 8, b: 10, alpha: 1 };

(async () => {
  const head = await sharp(SRC).extract(HEAD)
    .resize({ width: SIZE - 2 * PAD, height: SIZE - 2 * PAD, fit: 'inside', kernel: 'lanczos3' })
    .toBuffer({ resolveWithObject: true });
  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: VOID } })
    .composite([{ input: head.data, left: Math.round((SIZE - head.info.width) / 2), top: Math.round((SIZE - head.info.height) / 2) }])
    .flatten({ background: VOID })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, 'apple-touch-icon.png'));
  console.log('apple-touch-icon.png');
})();
