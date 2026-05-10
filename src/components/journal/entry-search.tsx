import { Search } from "lucide-react";

export type MoodFilter = "all" | "lighter" | "heavier";

interface Props {
  query: string;
  onQueryChange: (v: string) => void;
  mood: MoodFilter;
  onMoodChange: (m: MoodFilter) => void;
}

export function EntrySearch({ query, onQueryChange, mood, onMoodChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search reflections, moods, places…"
          className="w-full rounded-full border border-border bg-card pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground/70 focus:border-forest focus:outline-none"
          inputMode="search"
        />
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs">
        <Pill active={mood === "all"} onClick={() => onMoodChange("all")}>All</Pill>
        <Pill active={mood === "lighter"} onClick={() => onMoodChange("lighter")}>Felt lighter</Pill>
        <Pill active={mood === "heavier"} onClick={() => onMoodChange("heavier")}>Felt heavier</Pill>
      </div>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 transition ${active ? "border-forest bg-forest text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-forest/30"}`}
    >
      {children}
    </button>
  );
}
