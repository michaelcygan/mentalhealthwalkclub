import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Trash2 } from "lucide-react";
import { listSavedReads, toggleSavedRead, type SavedReadCard } from "@/lib/saved-reads.functions";
import { toast } from "sonner";
import { parseCapError, CAP_UPSELL_COPY, type CapError } from "@/lib/cap-error";
import { UpsellSheet } from "@/components/membership/upsell-sheet";

export function SavedReadsList() {
  const [items, setItems] = useState<SavedReadCard[] | null>(null);
  const [capError, setCapError] = useState<CapError | null>(null);
  const fetchSaved = useServerFn(listSavedReads);
  const toggle = useServerFn(toggleSavedRead);

  useEffect(() => {
    let alive = true;
    fetchSaved().then((d) => { if (alive) setItems(d); }).catch(() => setItems([]));
    return () => { alive = false; };
  }, [fetchSaved]);

  async function onRemove(id: string) {
    try {
      await toggle({ data: { post_id: id } });
      setItems((cur) => (cur ?? []).filter((i) => i.id !== id));
    } catch (e) {
      const cap = parseCapError(e);
      if (cap) setCapError(cap);
      else toast.error(e instanceof Error ? e.message : "Could not remove");
    }
  }

  if (items === null) {
    return <div className="h-16 animate-pulse rounded-2xl bg-card" />;
  }
  if (items.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-border bg-card/60 p-5 text-center text-xs text-muted-foreground">
        Tap the bookmark on an article to keep it here for your next walk.
      </p>
    );
  }
  return (
    <>
      <ul className="space-y-2">
        {items.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-forest/10">
              {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <a
              href={p.link}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1"
            >
              <p className="line-clamp-2 font-serif text-sm leading-tight">{p.title}</p>
              <p className="truncate text-[10px] text-muted-foreground">{p.publisher ?? ""}</p>
            </a>
            <a href={p.link} target="_blank" rel="noopener noreferrer" className="rounded-full p-2 text-muted-foreground hover:text-foreground" aria-label="Open">
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() => onRemove(p.id)}
              aria-label="Remove"
              className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      {capError && (
        <UpsellSheet
          open={!!capError}
          onOpenChange={(o) => !o && setCapError(null)}
          surface={capError.surface}
          title={CAP_UPSELL_COPY[capError.surface].title}
          body={CAP_UPSELL_COPY[capError.surface].body(capError.cap)}
          cap={capError.cap}
        />
      )}
    </>
  );
}
