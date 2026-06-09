import { useMemo, useState } from "react";
import { PROMPTS, type ReflectionPrompt } from "@/lib/reflection-prompts";
import { ReflectionWriteSheet } from "@/components/home/reflection-write-sheet";

interface Props {
  onSaved?: () => void;
  /** Optional family filter (e.g. "tender", "light"). */
  family?: ReflectionPrompt["family"];
  count?: number;
  eyebrow?: string;
}

export function PromptChipsRow({ onSaved, family, count = 6, eyebrow = "Quick prompts" }: Props) {
  const [selected, setSelected] = useState<ReflectionPrompt | null>(null);

  const chips = useMemo(() => {
    const pool = family
      ? PROMPTS.filter((p) => p.family === family)
      : PROMPTS.filter((p) => p.family === "universal");
    // stable rotation per day so it feels fresh but not random
    const day = new Date();
    const seed = day.getFullYear() * 372 + (day.getMonth() + 1) * 31 + day.getDate();
    const start = seed % Math.max(1, pool.length);
    const out: ReflectionPrompt[] = [];
    for (let i = 0; i < count && i < pool.length; i++) {
      out.push(pool[(start + i) % pool.length]);
    }
    return out;
  }, [family, count]);

  return (
    <section>
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {eyebrow}
      </div>
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelected(p)}
            className="w-[72%] shrink-0 snap-start rounded-2xl border border-border bg-card p-3 text-left shadow-soft transition hover:border-forest/40"
          >
            <p className="font-serif text-[15px] leading-snug text-foreground">{p.text}</p>
          </button>
        ))}
      </div>
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
    </section>
  );
}
