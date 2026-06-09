import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { PROMPTS, type ReflectionPrompt } from "@/lib/reflection-prompts";
import { ReflectionWriteSheet } from "@/components/home/reflection-write-sheet";
import type { FeedEntry, JournalStats } from "@/lib/journal-entries.functions";
import { readLast7, todaySeed } from "@/lib/journal-derive";

interface Props {
  stats: JournalStats;
  entries: FeedEntry[];
  onSaved?: () => void;
}

export function Reflect30s({ stats, entries, onSaved }: Props) {
  const read = useMemo(() => readLast7(stats, entries), [stats, entries]);
  const [selected, setSelected] = useState<ReflectionPrompt | null>(null);
  const [rot, setRot] = useState(0);

  const { hero, alts } = useMemo(() => {
    const pool = PROMPTS.filter((p) => p.family === read.family);
    const fallback = PROMPTS.filter((p) => p.family === "universal");
    const list = pool.length >= 4 ? pool : fallback;
    const seed = todaySeed() + rot;
    const start = seed % Math.max(1, list.length);
    const hero = list[start] ?? null;
    const alts: ReflectionPrompt[] = [];
    for (let i = 1; i <= 3 && i < list.length; i++) {
      alts.push(list[(start + i) % list.length]);
    }
    return { hero, alts };
  }, [read.family, rot]);

  if (!hero) return null;

  return (
    <>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Reflect in 30s
          </div>
          <button
            type="button"
            onClick={() => setRot((r) => r + 1)}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
          >
            <RefreshCw className="h-3 w-3" />
            New
          </button>
        </div>
        <motion.button
          type="button"
          onClick={() => setSelected(hero)}
          whileTap={{ scale: 0.99 }}
          className="block w-full rounded-2xl border border-border bg-card p-4 text-left shadow-soft transition hover:border-forest/40"
        >
          <p className="font-serif text-base leading-snug text-foreground">{hero.text}</p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-forest">Write one line →</p>
        </motion.button>
        {alts.length > 0 && (
          <div className="-mx-4 mt-2 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {alts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p)}
                className="w-[64%] shrink-0 snap-start rounded-2xl border border-border bg-card/70 p-3 text-left text-sm shadow-soft transition hover:border-forest/40"
              >
                <p className="line-clamp-3 font-serif leading-snug text-foreground">{p.text}</p>
              </button>
            ))}
          </div>
        )}
      </section>
      <ReflectionWriteSheet
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        prompt={selected ? { id: selected.id, text: selected.text } : null}
        source="journal_freeform"
        onSaved={() => {
          setSelected(null);
          onSaved?.();
        }}
      />
    </>
  );
}
