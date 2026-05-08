import { useState } from "react";
import { ChevronUp, ChevronDown, Sparkles } from "lucide-react";
import { facilitatorPrompts, type PromptStage } from "@/lib/facilitator-prompts";

const STAGES: { key: PromptStage; label: string }[] = [
  { key: "openers", label: "Open" },
  { key: "deepening", label: "Deepen" },
  { key: "gentle", label: "Gentle" },
  { key: "wrap", label: "Wrap" },
];

export function PromptDrawer() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<PromptStage>("openers");

  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-forest" />
          Suggested prompts
        </span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((s) => (
              <button
                key={s.key}
                onClick={() => setStage(s.key)}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  stage === s.key
                    ? "bg-forest text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <ul className="space-y-1.5">
            {facilitatorPrompts[stage].map((p) => (
              <li key={p} className="rounded-xl bg-secondary/60 px-3 py-2 font-serif text-sm italic">
                "{p}"
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
