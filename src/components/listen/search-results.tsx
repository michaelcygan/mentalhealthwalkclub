import { Headphones, Waves, Music, BookOpen, ExternalLink } from "lucide-react";
import type { SearchHit, SearchKind } from "@/lib/listen-search.functions";

const KIND_META: Record<SearchKind, { label: string; Icon: typeof Headphones }> = {
  podcast: { label: "Podcasts", Icon: Headphones },
  ambient: { label: "Ambient", Icon: Waves },
  guided: { label: "Guided walks", Icon: Music },
  blog: { label: "Articles", Icon: BookOpen },
};

function fmtMins(s: number | null | undefined) {
  if (!s) return "";
  return `${Math.round(s / 60)} min`;
}

export function SearchResults({
  hits, loading, q, onSuggest,
}: {
  hits: SearchHit[];
  loading: boolean;
  q: string;
  onSuggest: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-card" />
        ))}
      </div>
    );
  }
  if (hits.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center">
        <p className="font-serif text-base">Nothing matched “{q}”.</p>
        <p className="mt-1 text-xs text-muted-foreground">Try fewer words or a different spelling.</p>
        <button
          type="button"
          onClick={onSuggest}
          className="mt-3 inline-flex items-center gap-1 rounded-full bg-forest px-3 py-1.5 text-xs text-primary-foreground"
        >
          Suggest content
        </button>
      </div>
    );
  }
  const grouped: Record<SearchKind, SearchHit[]> = { podcast: [], ambient: [], guided: [], blog: [] };
  for (const h of hits) grouped[h.kind].push(h);

  return (
    <div className="space-y-6">
      {(Object.keys(grouped) as SearchKind[]).map((k) => {
        const items = grouped[k];
        if (items.length === 0) return null;
        const { label, Icon } = KIND_META[k];
        return (
          <section key={k}>
            <h3 className="mb-2 flex items-center gap-2 font-serif text-sm text-muted-foreground">
              <Icon className="h-3.5 w-3.5 text-forest" /> {label}
              <span className="text-[10px]">· {items.length}</span>
            </h3>
            <ul className="space-y-2">
              {items.map((h) => (
                <li key={`${h.kind}-${h.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-forest/10">
                    {h.cover ? <img src={h.cover} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 font-serif text-sm leading-tight">{h.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {h.subtitle ?? ""}{h.duration_seconds ? ` · ${fmtMins(h.duration_seconds)}` : ""}
                    </p>
                  </div>
                  {h.link && (
                    <a
                      href={h.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full p-2 text-muted-foreground hover:text-foreground"
                      aria-label="Open"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
