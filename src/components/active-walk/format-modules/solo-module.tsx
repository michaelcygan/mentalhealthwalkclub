/**
 * Solo / default format module: intention card + saved prompts.
 * Also serves as the base content shown when no other format module is active.
 */
import { Bookmark } from "lucide-react";

interface Props {
  intention: string | null;
  savedPrompts: string[];
}

export function SoloModule({ intention, savedPrompts }: Props) {
  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Intention</div>
        <p className="mt-1.5 font-serif text-base italic text-foreground">
          {intention?.trim() ? intention : "Walking alone still counts."}
        </p>
      </div>
      {savedPrompts.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <Bookmark className="h-3 w-3" /> Saved this walk
          </div>
          <ul className="mt-2 space-y-1.5 text-sm text-foreground">
            {savedPrompts.map((p, i) => (
              <li key={i} className="rounded-lg bg-secondary/50 px-3 py-2">
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
