import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NotebookPen, Trash2, Lock } from "lucide-react";
import { haptics } from "@/lib/device";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";

export interface WalkNote {
  /** seconds elapsed at time of capture */
  t: number;
  text: string;
}

interface Props {
  walkSessionId: string;
  elapsed: number;
  notes: WalkNote[];
  onChange: (notes: WalkNote[]) => void;
}

const storageKey = (id: string) => `walk-notes:${id}`;

export function loadStoredNotes(walkSessionId: string): WalkNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(storageKey(walkSessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

/** Build the journal text for these notes — used at end-walk to merge into reflection_note. */
export function notesToJournalBlock(notes: WalkNote[]): string {
  if (notes.length === 0) return "";
  const lines = notes.map((n) => `• ${fmt(n.t)} — ${n.text.trim()}`);
  return `Captured along the way\n${lines.join("\n")}`;
}

function fmt(s: number) {
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * Mid-walk private notepad. Captures stay client-side (sessionStorage)
 * until the walk ends, then are merged into the journal entry's reflection.
 */
export function WalkNotesPill({ walkSessionId, elapsed, notes, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inset = useKeyboardInset();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Persist any change locally so a refresh mid-walk doesn't lose the thoughts
  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(storageKey(walkSessionId), JSON.stringify(notes));
  }, [notes, walkSessionId]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const save = () => {
    const text = draft.trim();
    if (!text) { setOpen(false); return; }
    onChange([...notes, { t: elapsed, text }]);
    setDraft("");
    haptics.tap();
    setOpen(false);
  };

  const remove = (i: number) => {
    const next = notes.filter((_, idx) => idx !== i);
    onChange(next);
    haptics.soft();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { haptics.tap(); setOpen(true); }}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs text-foreground backdrop-blur transition active:scale-95 hover:border-forest/40"
        aria-label="Open walk notes"
      >
        <NotebookPen className="h-3.5 w-3.5 text-forest" />
        <span>Note</span>
        {notes.length > 0 && (
          <span className="ml-0.5 rounded-full bg-forest/15 px-1.5 text-[10px] font-medium text-forest">{notes.length}</span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-forest/15 bg-cream"
          style={{ paddingBottom: `calc(${inset}px + env(safe-area-inset-bottom))` }}
        >
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between font-serif text-2xl text-forest">
              <span>Walk notes</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
                <Lock className="h-3 w-3" /> private
              </span>
            </SheetTitle>
          </SheetHeader>

          {notes.length > 0 && (
            <div className="mt-3 max-h-44 space-y-1 overflow-y-auto pr-1">
              {notes.map((n, i) => (
                <div key={i} className="group flex items-start gap-2 rounded-xl border border-forest/10 bg-background/60 p-2 text-sm">
                  <span className="mt-0.5 shrink-0 rounded-full bg-forest/10 px-2 py-0.5 font-mono text-[10px] tabular-nums text-forest">{fmt(n.t)}</span>
                  <p className="flex-1 whitespace-pre-wrap font-serif italic text-foreground/85">{n.text}</p>
                  <button
                    onClick={() => remove(i)}
                    className="opacity-40 transition hover:opacity-100"
                    aria-label="Delete note"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 space-y-3">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="What's surfacing right now?"
              rows={4}
              inputMode="text"
              autoCapitalize="sentences"
              className="w-full resize-none rounded-2xl border border-forest/15 bg-background/80 p-3 font-serif text-base placeholder:italic placeholder:text-muted-foreground/70 focus:border-forest focus:outline-none"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] italic text-muted-foreground">
                Stays here until you end the walk. Then it joins your journal entry.
              </p>
              <Button
                onClick={save}
                className="h-11 shrink-0 rounded-full bg-forest px-5 text-primary-foreground hover:opacity-90"
              >
                {draft.trim() ? "Save & close" : "Close"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
