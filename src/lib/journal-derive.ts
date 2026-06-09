// Shared client-side derivations for the Journal "For You" surface.
// All inputs come from already-loaded `JournalStats` + `FeedEntry[]` — no server reads.

import type { FeedEntry, JournalStats } from "@/lib/journal-entries.functions";

export function todaySeed(): number {
  const d = new Date();
  return d.getFullYear() * 372 + (d.getMonth() + 1) * 31 + d.getDate();
}

export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type WeekRead = {
  headline: string;
  tone: "up" | "down" | "steady" | "quiet" | "warm";
  /** family hint for prompt selection */
  family: "tender" | "light" | "universal";
};

export function readLast7(stats: JournalStats, entries: FeedEntry[]): WeekRead {
  const now = new Date();
  const todayIso = isoDay(now);
  const days7 = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days7.add(isoDay(d));
  }
  const walks7 = stats.walkDays.filter((d) => days7.has(d)).length;
  const entries7 = stats.entryDays.filter((d) => days7.has(d)).length;

  // Mood trend from moodArc30 last 7 points vs prior 7
  const arc = stats.moodArc30;
  let trend = 0;
  if (arc.length >= 4) {
    const tail = arc.slice(-7);
    const head = arc.slice(-14, -7);
    const tAvg = tail.reduce((s, p) => s + p.score, 0) / Math.max(1, tail.length);
    const hAvg =
      head.length > 0 ? head.reduce((s, p) => s + p.score, 0) / head.length : tAvg;
    trend = tAvg - hAvg;
  }

  // Latest walk mood lift
  const latestWalk = entries.find(
    (e) => e.kind === "walk" && e.mood_before_score != null && e.mood_after_score != null,
  );
  const lift =
    latestWalk && latestWalk.mood_after_score != null && latestWalk.mood_before_score != null
      ? latestWalk.mood_after_score - latestWalk.mood_before_score
      : null;

  const wroteToday = stats.entryDays.includes(todayIso);
  const walkedToday = stats.walkDays.includes(todayIso);

  if (walks7 === 0 && entries7 === 0) {
    return {
      headline: "A blank week so far — one small step counts.",
      tone: "quiet",
      family: "tender",
    };
  }
  if (trend > 0.4) {
    return {
      headline: `${walks7} walk${walks7 === 1 ? "" : "s"}, mood trending up`,
      tone: "up",
      family: "light",
    };
  }
  if (trend < -0.4) {
    return {
      headline:
        lift && lift > 0
          ? `A heavier week — but your last walk lifted you +${lift.toFixed(1)}`
          : "A heavier week — be gentle with yourself",
      tone: "down",
      family: "tender",
    };
  }
  if (wroteToday && walkedToday) {
    return { headline: "Walked and wrote today. Quietly proud.", tone: "warm", family: "universal" };
  }
  if (entries7 >= 3) {
    return {
      headline: `${entries7} reflections this week — words are landing`,
      tone: "warm",
      family: "universal",
    };
  }
  return {
    headline: `${walks7} walk${walks7 === 1 ? "" : "s"}, ${entries7} reflection${entries7 === 1 ? "" : "s"} this week`,
    tone: "steady",
    family: "universal",
  };
}

export function greetingForHour(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Quiet night";
}

export function firstName(meta: Record<string, unknown> | undefined, email?: string | null): string | null {
  const m = meta ?? {};
  const candidates = ["first_name", "given_name", "name", "full_name", "display_name"];
  for (const k of candidates) {
    const v = m[k];
    if (typeof v === "string" && v.trim()) {
      return v.trim().split(/\s+/)[0];
    }
  }
  if (email && email.includes("@")) {
    const local = email.split("@")[0];
    if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return null;
}

// ── Carry forward: pick a deterministic past quote from the user's writing ──

export interface CarryQuote {
  id: string;
  kind: "reflection" | "walk";
  text: string;
  at: string;
  prompt?: string | null;
}

export function pickCarryForward(entries: FeedEntry[]): CarryQuote | null {
  const now = Date.now();
  const pool: CarryQuote[] = [];
  for (const e of entries) {
    const text =
      e.kind === "reflection" ? (e.body ?? "").trim() : (e.reflection_note ?? "").trim();
    if (text.length < 40 || text.length > 280) continue;
    const ageDays = (now - new Date(e.at).getTime()) / 86400000;
    if (ageDays < 14) continue; // not too fresh
    pool.push({
      id: `${e.kind}-${e.id}`,
      kind: e.kind,
      text,
      at: e.at,
      prompt: e.prompt_text ?? null,
    });
  }
  if (pool.length === 0) return null;
  // Prefer 30–120 day window if any exist there
  const sweet = pool.filter((q) => {
    const age = (now - new Date(q.at).getTime()) / 86400000;
    return age >= 30 && age <= 120;
  });
  const finalPool = sweet.length > 0 ? sweet : pool;
  return finalPool[todaySeed() % finalPool.length];
}

// ── Word echoes ──

const STOPWORDS = new Set<string>(
  (
    "a an and are as at be been being but by could did do does for from had has have he her hers him his i if in into is it its just like me my of on or our ours she so that the their them they this to was we were what when where which who whom why will with you your yours about over under up down out so too very really would should can not no nor only also some any all more most much many few each every am pm one two three four five six seven eight nine ten doing don't dont it's its i'm im we're were ill we'd we've we'll they're theyre there here than then now today tomorrow yesterday again still already even"
  ).split(/\s+/),
);

export interface EchoWord {
  word: string;
  count: number;
}

export function computeEchoes(entries: FeedEntry[], days = 30, limit = 5): EchoWord[] {
  const cutoff = Date.now() - days * 86400000;
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (new Date(e.at).getTime() < cutoff) continue;
    const text =
      e.kind === "reflection" ? (e.body ?? "") : (e.reflection_note ?? "");
    if (!text) continue;
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z'\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
    for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const out: EchoWord[] = Array.from(counts.entries())
    .filter(([, c]) => c >= 2)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
  return out;
}

// ── Reflect-in-30s prompt selection (uses families when available; falls back to universal) ──

export function familyForRead(read: WeekRead): "tender" | "light" | "universal" {
  return read.family;
}
