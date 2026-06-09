import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ListenSearchBar({
  value,
  onChange,
  onOpenFilters,
  activeFilterCount,
}: {
  value: string;
  onChange: (v: string) => void;
  onOpenFilters: () => void;
  activeFilterCount: number;
}) {
  const [local, setLocal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocal(value); }, [value]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (local !== value) onChange(local);
    }, 200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={ref}
          type="search"
          inputMode="search"
          placeholder="Search shows, artists, articles…"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          className="w-full rounded-full border border-border bg-card py-2.5 pl-9 pr-9 text-sm shadow-soft focus:border-forest focus:outline-none"
        />
        {local && (
          <button
            type="button"
            onClick={() => { setLocal(""); onChange(""); ref.current?.focus(); }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onOpenFilters}
        aria-label="Filters"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-soft hover:bg-accent"
      >
        <SlidersHorizontal className="h-4 w-4" />
        {activeFilterCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-forest px-1 text-[10px] font-medium text-primary-foreground">
            {activeFilterCount}
          </span>
        )}
      </button>
    </div>
  );
}
