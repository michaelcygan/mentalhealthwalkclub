import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Plus, PenLine, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { listJournalEntries, type JournalEntry } from "@/lib/journal-entries.functions";
import { ReflectionWriteSheet } from "@/components/home/reflection-write-sheet";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function JournalReflections() {
  const fetcher = useServerFn(listJournalEntries);
  const [writeOpen, setWriteOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["journal-entries"],
    queryFn: () => fetcher({ data: { limit: 20 } }),
  });

  // Refetch when the sheet closes (an entry may have been added)
  useEffect(() => {
    if (!writeOpen) refetch();
  }, [writeOpen, refetch]);

  const entries: JournalEntry[] = data ?? [];

  return (
    <>
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Daily Reflections
            </div>
            <h2 className="font-serif text-lg leading-tight text-foreground">Your written entries</h2>
          </div>
          <button
            type="button"
            onClick={() => setWriteOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </div>

        {isLoading ? (
          <div className="h-20 animate-pulse rounded-2xl bg-muted/40" />
        ) : entries.length === 0 ? (
          <button
            type="button"
            onClick={() => setWriteOpen(true)}
            className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-4 text-left transition hover:border-forest/40"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
              <PenLine className="h-4 w-4 text-forest" />
            </span>
            <span>
              <span className="block text-sm font-medium text-foreground">Write your first reflection</span>
              <span className="block text-xs text-muted-foreground">A few honest sentences. That's it.</span>
            </span>
          </button>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => {
              const isOpen = expanded[e.id] ?? false;
              const body = e.body.trim();
              const isLong = body.length > 220 || body.split("\n").length > 3;
              return (
                <Card key={e.id} className="rounded-2xl border-border bg-card/90 p-4 shadow-soft">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {fmtDate(e.created_at)}
                    </span>
                  </div>
                  {e.prompt_text && (
                    <p className="mt-1 font-serif text-sm italic leading-snug text-muted-foreground">
                      {e.prompt_text}
                    </p>
                  )}
                  <p
                    className={`mt-2 whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-foreground ${
                      !isOpen && isLong ? "line-clamp-4" : ""
                    }`}
                  >
                    {body}
                  </p>
                  {isLong && (
                    <button
                      type="button"
                      onClick={() => setExpanded((m) => ({ ...m, [e.id]: !isOpen }))}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {isOpen ? "Show less" : "Read more"}
                      <ChevronDown className={`h-3 w-3 transition ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <ReflectionWriteSheet
        open={writeOpen}
        onOpenChange={setWriteOpen}
        prompt={null}
        source="journal_freeform"
      />
    </>
  );
}
