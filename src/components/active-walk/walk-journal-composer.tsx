/**
 * Always-open inline composer that lives at the bottom of the active walk.
 * Invites writing without demanding it. Saves quietly (debounced) into the
 * same WalkNote shape used by the end-walk flow, so end-of-walk merging is
 * unchanged.
 */
import { useEffect, useRef, useState } from "react";
import { Camera, Lock, X } from "lucide-react";
import { haptics } from "@/lib/device";
import { toast } from "sonner";
import {
  compressImage,
  type WalkNote,
  type WalkPhoto,
} from "@/components/walk-notes-sheet";

interface Props {
  walkSessionId: string;
  elapsed: number;
  notes: WalkNote[];
  photos: WalkPhoto[];
  onChangeNotes: (n: WalkNote[]) => void;
  onChangePhotos: (p: WalkPhoto[]) => void;
}

const MAX_PHOTOS = 8;

export function WalkJournalComposer({
  walkSessionId,
  elapsed,
  notes,
  photos,
  onChangeNotes,
  onChangePhotos,
}: Props) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedRef = useRef(elapsed);
  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  // Auto-grow
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [draft]);

  const flushDraft = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onChangeNotes([...notes, { t: elapsedRef.current, text: trimmed }]);
    setDraft("");
    haptics.tap();
  };

  // Debounced auto-save when user stops typing for 1.5s and there's >= 12 chars
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (draft.trim().length < 12) return;
    saveTimer.current = setTimeout(() => {
      flushDraft(draft);
    }, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      flushDraft(draft);
    }
  };

  const removeNote = (i: number) => {
    onChangeNotes(notes.filter((_, idx) => idx !== i));
    haptics.soft();
  };
  const removePhoto = (i: number) => {
    onChangePhotos(photos.filter((_, idx) => idx !== i));
    haptics.soft();
  };

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (photos.length >= MAX_PHOTOS) {
      toast(`Up to ${MAX_PHOTOS} photos per walk`);
      return;
    }
    setBusy(true);
    try {
      const compressed = await compressImage(file);
      if (!compressed) {
        toast("Couldn't read that image");
        return;
      }
      compressed.t = elapsed;
      onChangePhotos([...photos, compressed]);
      haptics.success();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Walk journal"
      className="rounded-2xl border border-border bg-card/85 p-3 shadow-soft backdrop-blur"
      data-walk-session={walkSessionId}
    >
      <div className="flex items-center justify-between gap-2 pb-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <Lock className="h-3 w-3" />
          Journal · this walk
        </div>
        <span className="text-[10px] italic text-muted-foreground/80">
          stays with this walk
        </span>
      </div>

      <textarea
        ref={taRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => flushDraft(draft)}
        onKeyDown={handleKey}
        rows={2}
        placeholder="jot a thought… it stays with this walk."
        className="w-full resize-none border-0 bg-transparent p-1.5 font-serif text-base leading-snug text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
      />

      <div className="mt-1 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy || photos.length >= MAX_PHOTOS}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] text-muted-foreground transition active:scale-95 disabled:opacity-50"
          aria-label="Add a photo"
        >
          <Camera className="h-3.5 w-3.5" />
          {photos.length > 0 ? `Photo · ${photos.length}` : "Photo"}
        </button>
        {draft.trim().length > 0 && (
          <button
            type="button"
            onClick={() => flushDraft(draft)}
            className="rounded-full bg-forest px-3 py-1.5 text-[11px] font-medium text-primary-foreground transition active:scale-95"
          >
            Save
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPickPhoto}
          className="hidden"
        />
      </div>

      {(notes.length > 0 || photos.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/60 pt-2">
          {notes.map((n, i) => (
            <button
              key={`n-${i}`}
              type="button"
              onClick={() => removeNote(i)}
              className="group inline-flex max-w-[180px] items-center gap-1 rounded-full bg-secondary/70 px-2.5 py-1 text-[11px] text-foreground/80 transition hover:bg-secondary"
              title="Tap to remove"
            >
              <span className="tabular-nums text-muted-foreground">{fmt(n.t)}</span>
              <span className="truncate">{n.text}</span>
              <X className="h-3 w-3 opacity-0 transition group-hover:opacity-60" />
            </button>
          ))}
          {photos.map((p, i) => (
            <button
              key={`p-${i}`}
              type="button"
              onClick={() => removePhoto(i)}
              className="relative h-10 w-10 overflow-hidden rounded-md border border-border"
              title="Tap to remove"
            >
              <img src={p.dataUrl} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
