import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Footprints, PenLine } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import type { FeedEntry } from "@/lib/journal-entries.functions";
import { EntryRow } from "./entry-row";

type Filter = "all" | "reflection" | "walk" | "photos";

interface Props {
  entries: FeedEntry[];
  onChanged: () => void;
  onWrite: () => void;
}

export function EntriesFeed({ entries, onChanged, onWrite }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [writeOpen, setWriteOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter === "reflection" && e.kind !== "reflection") return false;
      if (filter === "walk" && e.kind !== "walk") return false;
      if (filter === "photos" && (e.photo_count ?? 0) === 0) return false;
      if (q) {
        const hay = [
          e.body,
          e.prompt_text,
          e.reflection_note,
          e.walk_type,
          e.mood_before,
          e.mood_after,
          e.intention,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, query, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, FeedEntry[]>();
    for (const e of filtered) {
      const d = new Date(e.at);
      const k = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <>
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Your journal</div>
            <h2 className="font-serif text-lg leading-tight text-foreground">Entries</h2>
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {filtered.length} of {entries.length}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reflections, moods, intentions…"
            className="w-full rounded-full border border-border bg-card pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground/70 focus:border-forest focus:outline-none"
            inputMode="search"
          />
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
          <Chip active={filter === "reflection"} onClick={() => setFilter("reflection")}>
            <PenLine className="h-3 w-3" /> Reflections
          </Chip>
          <Chip active={filter === "walk"} onClick={() => setFilter("walk")}>
            <Footprints className="h-3 w-3" /> Walks
          </Chip>
          <Chip active={filter === "photos"} onClick={() => setFilter("photos")}>With photos</Chip>
        </div>

        {entries.length === 0 ? (
          <EmptyEntries onWrite={() => setWriteOpen(true)} />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nothing matches that filter.
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(([month, items]) => (
              <div key={month}>
                <div className="sticky top-0 z-10 -mx-1 mb-2 bg-background/90 px-1 py-1 font-serif text-sm text-muted-foreground backdrop-blur">
                  {month}
                </div>
                <div className="space-y-3">
                  {items.map((entry) => (
                    <EntryRow
                      key={`${entry.kind}-${entry.id}`}
                      entry={entry}
                      active={openId === `${entry.kind}-${entry.id}`}
                      onToggle={() =>
                        setOpenId(openId === `${entry.kind}-${entry.id}` ? null : `${entry.kind}-${entry.id}`)
                      }
                      onChanged={onChanged}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Floating compose */}
      <button
        type="button"
        onClick={() => setWriteOpen(true)}
        className="fixed bottom-24 right-4 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full bg-forest text-primary-foreground shadow-elevated transition active:scale-95 md:bottom-8"
        aria-label="Write a new entry"
      >
        <Plus className="h-5 w-5" />
      </button>

      <ReflectionWriteSheet
        open={writeOpen}
        onOpenChange={setWriteOpen}
        prompt={null}
        source="journal_freeform"
        onSaved={onChanged}
      />
    </>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 transition ${
        active
          ? "border-forest bg-forest text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-forest/30"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyEntries({ onWrite }: { onWrite: () => void }) {
  return (
    <div className="space-y-3 rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
      <h3 className="font-serif text-xl text-foreground">A blank first page</h3>
      <p className="mx-auto max-w-sm text-sm text-muted-foreground">
        A few honest sentences is enough. Walk it out, or write it down — both count.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <button
          type="button"
          onClick={onWrite}
          className="inline-flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <PenLine className="h-3.5 w-3.5" /> Write something
        </button>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:border-forest/40"
        >
          <Footprints className="h-3.5 w-3.5" /> Take a walk
        </Link>
      </div>
    </div>
  );
}
