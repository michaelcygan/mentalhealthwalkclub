import { Headphones, Waves, Music, BookOpen } from "lucide-react";
import type { SearchHit, SearchKind } from "@/lib/listen-search.functions";
import { CoverThumb } from "@/components/listen/cover-thumb";
import { Shimmer } from "@/components/ui/shimmer";
import { EmptyNote } from "@/components/ui/empty-note";
import { usePlayOrOpen } from "@/lib/play-helpers";
import { TileActionsMenu } from "@/components/listen/tile-actions";

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
  const playOrOpen = usePlayOrOpen();
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  if (hits.length === 0) {
    return (
      <EmptyNote
        icon={<BookOpen className="h-5 w-5" />}
        title={`Nothing matched “${q}”.`}
        hint="Try fewer words or a different spelling."
        action={
          <button
            type="button"
            onClick={onSuggest}
            className="inline-flex items-center gap-1 rounded-full bg-forest px-4 py-1.5 text-xs font-medium text-primary-foreground transition active:scale-95"
          >
            Suggest content
          </button>
        }
      />
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
                <li key={`${h.kind}-${h.id}`}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => playOrOpen(h)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); playOrOpen(h); } }}
                    aria-label={h.kind === "blog" ? `Read ${h.title}` : `Play ${h.title}`}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-soft transition active:scale-[0.99] hover:-translate-y-0.5"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                      <CoverThumb src={h.cover} title={h.title} kind={h.kind} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 font-serif text-sm leading-tight">{h.title}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {h.subtitle ?? ""}{h.duration_seconds ? ` · ${fmtMins(h.duration_seconds)}` : ""}
                      </p>
                    </div>
                    {h.kind !== "ambient" && <TileActionsMenu item={h} />}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
