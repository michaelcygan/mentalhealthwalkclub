import { useMemo, useState } from "react";
import { RefreshCw, PenLine } from "lucide-react";
import { motion } from "motion/react";
import { PROMPTS, type ReflectionPrompt } from "@/lib/reflection-prompts";
import { ReflectionWriteSheet } from "@/components/home/reflection-write-sheet";

function todaySeed(): number {
  const d = new Date();
  return d.getFullYear() * 372 + (d.getMonth() + 1) * 31 + d.getDate();
}

interface Props {
  lastReflection?: string | null;
  onSaved?: () => void;
}

export function Reflect30s({ lastReflection, onSaved }: Props) {
  const [selected, setSelected] = useState<ReflectionPrompt | null>(null);
  const [rot, setRot] = useState(0);

  const { hero, alts } = useMemo(() => {
    const list = PROMPTS.filter((p) => p.family === "universal");
    const seed = todaySeed() + rot;
    const start = seed % Math.max(1, list.length);
    const hero = list[start] ?? null;
    const alts: ReflectionPrompt[] = [];
    for (let i = 1; i <= 3 && i < list.length; i++) {
      alts.push(list[(start + i) % list.length]);
    }
    return { hero, alts };
  }, [rot]);

  if (!hero) return null;

  return (
    <>
      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Reflect in 30s
          </div>
          <button
            type="button"
            onClick={() => setRot((r) => r + 1)}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
          >
            <RefreshCw className="h-3 w-3" /> New
          </button>
        </div>
        <motion.button
          type="button"
          onClick={() => setSelected(hero)}
          whileTap={{ scale: 0.99 }}
          className="block w-full rounded-2xl border border-border bg-card/90 p-4 text-left shadow-soft backdrop-blur-sm transition hover:border-forest/40"
        >
          <p className="font-serif text-base leading-snug text-foreground">{hero.text}</p>
          <span className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-forest">
            <PenLine className="h-3 w-3" /> Write one line →
          </span>
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
        {lastReflection && (
          <p className="mt-2 px-1 text-[11px] text-muted-foreground">
            Last time you wrote:{" "}
            <span className="font-serif italic text-foreground/80">
              "{lastReflection.length > 80 ? lastReflection.slice(0, 80).trim() + "…" : lastReflection}"
            </span>
          </p>
        )}
      </section>
      <ReflectionWriteSheet
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        prompt={selected ? { id: selected.id, text: selected.text } : null}
        source="home_reflection"
        onSaved={() => {
          setSelected(null);
          onSaved?.();
        }}
      />
    </>
  );
}
