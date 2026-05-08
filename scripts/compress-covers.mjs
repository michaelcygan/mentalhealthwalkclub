import sharp from 'sharp';
import { readdirSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = '/dev-server/public/city-covers';
const cities = readdirSync(ROOT).filter(d => statSync(join(ROOT, d)).isDirectory());
const states = ['dawn','day','golden','night'];

const lqip = {};
let total = 0;
for (const c of cities) {
  lqip[c] = {};
  for (const s of states) {
    const src = join(ROOT, c, `${s}.jpg`);
    const dst = join(ROOT, c, `${s}.webp`);
    const buf = await sharp(src).resize(480, 600, { fit: 'cover' }).webp({ quality: 60, effort: 6 }).toBuffer();
    await sharp(buf).toFile(dst);
    total += buf.length;
    // tiny LQIP
    const blur = await sharp(src).resize(24, 30, { fit: 'cover' }).webp({ quality: 30 }).toBuffer();
    lqip[c][s] = `data:image/webp;base64,${blur.toString('base64')}`;
  }
}
console.log('Total webp KB:', Math.round(total/1024));
console.log(JSON.stringify(lqip, null, 2).slice(0, 400));
import { writeFileSync } from 'fs';
writeFileSync('/tmp/lqip.json', JSON.stringify(lqip));
