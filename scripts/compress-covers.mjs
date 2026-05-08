// Process only city folders that have new .jpg sources; outputs webp + LQIP entries.
import sharp from 'sharp';
import { readdirSync, statSync, existsSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const ROOT = 'public/city-covers';
const states = ['dawn', 'day', 'golden', 'night'];
const TZ = {
  'brooklyn-chapter': 'America/New_York',
  'chapter-dc': 'America/New_York',
  'chapter-toronto': 'America/Toronto',
  'chapter-paris': 'Europe/Paris',
  'chapter-sydney': 'Australia/Sydney',
  'chapter-austin': 'America/Chicago',
  'chapter-vancouver': 'America/Vancouver',
  'chapter-berlin': 'Europe/Berlin',
  'chapter-philly': 'America/New_York',
  'chapter-atlanta': 'America/New_York',
  'chapter-denver': 'America/Denver',
  'chapter-portland': 'America/Los_Angeles',
  'chapter-phoenix': 'America/Phoenix',
  'chapter-san-diego': 'America/Los_Angeles',
  'chapter-twin-cities': 'America/Chicago',
  'chapter-nashville': 'America/Chicago',
  'chapter-nola': 'America/Chicago',
  'chapter-detroit': 'America/Detroit',
  'chapter-houston': 'America/Chicago',
  'chapter-dfw': 'America/Chicago',
  'chapter-vegas': 'America/Los_Angeles',
  'chapter-montreal': 'America/Toronto',
  'chapter-amsterdam': 'Europe/Amsterdam',
  'chapter-dublin': 'Europe/Dublin',
};

const cities = readdirSync(ROOT).filter(d => {
  const p = join(ROOT, d);
  return statSync(p).isDirectory() && existsSync(join(p, 'dawn.jpg'));
});

const lqip = {};
let totalKB = 0;
for (const c of cities) {
  lqip[c] = {};
  for (const s of states) {
    const src = join(ROOT, c, `${s}.jpg`);
    const dst = join(ROOT, c, `${s}.webp`);
    const buf = await sharp(src).resize(480, 600, { fit: 'cover' }).webp({ quality: 60, effort: 6 }).toBuffer();
    await sharp(buf).toFile(dst);
    totalKB += buf.length / 1024;
    const blur = await sharp(src).resize(24, 30, { fit: 'cover' }).webp({ quality: 30 }).toBuffer();
    lqip[c][s] = `data:image/webp;base64,${blur.toString('base64')}`;
    // Remove jpg source — webp is what we ship.
    unlinkSync(src);
  }
}

// Emit TS snippet to merge into src/data/city-covers.ts
const lines = [];
for (const c of cities) {
  const tz = TZ[c] ?? 'UTC';
  const blur = states.map(s => `${s}: "${lqip[c][s]}"`).join(', ');
  lines.push(`  "${c}": { tz: "${tz}", blur: { ${blur} } },`);
}
writeFileSync('/tmp/new-covers.ts', lines.join('\n') + '\n');
console.log(`Compressed ${cities.length} cities × ${states.length} states. Total webp: ${Math.round(totalKB)} KB`);
console.log(`Snippet written to /tmp/new-covers.ts (${cities.length} entries)`);
