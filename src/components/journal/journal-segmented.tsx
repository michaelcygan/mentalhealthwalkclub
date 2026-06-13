import { motion } from "motion/react";

export type JournalSegment = "for-you" | "reflect" | "stats" | "entries" | "memories";

const SEGMENTS: Array<{ id: JournalSegment; label: string }> = [
  { id: "for-you", label: "For you" },
  { id: "entries", label: "Entries" },
  { id: "reflect", label: "Reflect" },
  { id: "stats", label: "Stats" },
  { id: "memories", label: "Memories" },
];

export function JournalSegmented({
  value,
  onChange,
}: {
  value: JournalSegment;
  onChange: (v: JournalSegment) => void;
}) {
  return (
    <div className="sticky top-[calc(env(safe-area-inset-top)+52px)] z-20 -mx-1 mb-4 px-1 md:top-0">
      <div
        role="tablist"
        aria-label="Journal sections"
        className="relative flex items-center gap-1 overflow-x-auto rounded-full border border-border/60 bg-background/75 p-1 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/55 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SEGMENTS.map((s) => {
          const active = value === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(s.id)}
              className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition ${
                active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="journal-segment-pill"
                  className="absolute inset-0 rounded-full bg-forest shadow-soft"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
