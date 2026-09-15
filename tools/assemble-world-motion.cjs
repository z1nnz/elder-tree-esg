// Assemble actual Unity frames without reducing the water/sky colour palette.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

async function main() {
  const directory = process.argv[2];
  if (!directory) throw new Error('請提供 Unity 連續渲染目錄');
  const names = fs.readdirSync(directory).filter(name => /^水流連續實景_\d{3}\.png$/.test(name)).sort();
  if (names.length < 2) throw new Error('至少需要兩張連續實景');
  const metadata = await sharp(path.join(directory, names[0])).metadata();
  const frames = [];
  for (let index = 0; index < names.length; index++) {
    if (names[index] !== `水流連續實景_${String(index).padStart(3, '0')}.png`)
      throw new Error('連續實景存在缺幀');
    const { data, info } = await sharp(path.join(directory, names[index])).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== metadata.width || info.height !== metadata.height)
      throw new Error('連續實景尺寸不一致');
    frames.push(data);
  }
  // Alternating frame durations preserve 12 fps without rounding every frame.
  const delay = names.map((_, index) => Math.round((index + 1) * 1000 / 12) - Math.round(index * 1000 / 12));
  const output = path.join(directory, '水流與雲海原色動態.webp');
  await sharp(Buffer.concat(frames), { raw: {
    width: metadata.width, height: metadata.height * frames.length, channels: 4, pageHeight: metadata.height,
  }}).webp({ lossless: true, effort: 4, loop: 0, delay }).toFile(output);
  const result = await sharp(output, { animated: true }).metadata();
  if (result.pages !== names.length || result.delay.reduce((a, b) => a + b, 0) !== delay.reduce((a, b) => a + b, 0))
    throw new Error('動畫幀數或播放時長驗證失敗');
  const decoded = await sharp(output, { page: 0, pages: 1 }).ensureAlpha().raw().toBuffer();
  if (!decoded.equals(frames[0])) throw new Error('首幀像素未無損保留');
  console.log(JSON.stringify({ output, frames: result.pages, durationMs: delay.reduce((a,b) => a+b,0), firstFramePixelExact: true }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
