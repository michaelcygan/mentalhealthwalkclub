/**
 * Walker level — pure derivation from cumulative walking minutes.
 * Names borrow the language of stillness, not rank.
 */
export interface WalkerLevel {
  level: number;
  label: string;
  next: number;
  /** 0..1 progress to next level */
  pct: number;
  /** minutes still needed for next level */
  toNext: number;
}

const LABELS = [
  "First Steps",
  "Sidewalk",
  "Block",
  "Neighborhood",
  "Park Path",
  "Trailhead",
  "Hill",
  "Ridge",
  "Treeline",
  "Summit",
  "Quiet Mountain",
  "Long Horizon",
];

/** Quadratic curve: level n requires n^2 * 30 minutes. Level 1 at 30, 5 at 750, 10 at 3000. */
export function walkerLevel(totalMinutes: number): WalkerLevel {
  const m = Math.max(0, totalMinutes);
  const level = Math.max(0, Math.floor(Math.sqrt(m / 30)));
  const cur = level * level * 30;
  const next = (level + 1) * (level + 1) * 30;
  const span = next - cur;
  const pct = span > 0 ? Math.min(1, (m - cur) / span) : 0;
  const idx = Math.min(LABELS.length - 1, level);
  return { level, label: LABELS[idx], next, pct, toNext: Math.max(0, next - m) };
}
