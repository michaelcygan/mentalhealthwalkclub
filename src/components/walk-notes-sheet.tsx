import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NotebookPen, Trash2, Lock, Camera, Image as ImageIcon, X } from "lucide-react";
import { haptics } from "@/lib/device";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { toast } from "sonner";

export interface WalkPhoto {
  /** seconds elapsed at capture */
  t: number;
  /** compressed JPEG/WebP data URL (client-side only until end-walk upload) */
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}

export interface WalkNote {
  /** seconds elapsed at time of capture */
  t: number;
  text: string;
}

interface Props {
  walkSessionId: string;
  elapsed: number;
  notes: WalkNote[];
  photos: WalkPhoto[];
  onChangeNotes: (notes: WalkNote[]) => void;
  onChangePhotos: (photos: WalkPhoto[]) => void;
}

const MAX_PHOTOS = 8;
const MAX_DIMENSION = 1280;
const TARGET_QUALITY = 0.72;

const noteStorageKey = (id: string) => `walk-notes:${id}`;
const photoStorageKey = (id: string) => `walk-photos:${id}`;

export function loadStoredNotes(walkSessionId: string): WalkNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(noteStorageKey(walkSessionId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function loadStoredPhotos(walkSessionId: string): WalkPhoto[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(photoStorageKey(walkSessionId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function clearWalkCaptures(walkSessionId: string) {
  try {
    sessionStorage.removeItem(noteStorageKey(walkSessionId));
    sessionStorage.removeItem(photoStorageKey(walkSessionId));
  } catch {}
}

/** Markdown block summarizing notes for the journal reflection. */
export function notesToJournalBlock(notes: WalkNote[]): string {
  if (notes.length === 0) return "";
  const lines = notes.map((n) => `• ${fmt(n.t)} — ${n.text.trim()}`);
  return `Captured along the way\n${lines.join("\n")}`;
}

function fmt(s: number) {
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Compress a captured image to a small JPEG data URL, max 1280px on long edge. */
async function compressImage(file: File): Promise<WalkPhoto | null> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;
  const { width: w0, height: h0 } = bitmap;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(w0, h0));
  const w = Math.round(w0 * scale);
  const h = Math.round(h0 * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const dataUrl = canvas.toDataURL("image/jpeg", TARGET_QUALITY);
  // bytes from base64 (rough)
  const bytes = Math.round(((dataUrl.length - "data:image/jpeg;base64,".length) * 3) / 4);
  return { t: 0, dataUrl, width: w, height: h, bytes };
}

/**
 * Mid-walk private notepad + photo journal.
 * Captures stay client-side (sessionStorage) until the walk ends.
 */
export function WalkNotesPill({ walkSessionId, elapsed, notes, photos, onChangeNotes, onChangePhotos }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [zoomedIdx, setZoomedIdx] = useState<number | null>(null);
  const inset = useKeyboardInset();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Persist locally so a refresh mid-walk doesn't lose the captures
  useEffect(() => {
    try { sessionStorage.setItem(noteStorageKey(walkSessionId), JSON.stringify(notes)); } catch {}
  }, [notes, walkSessionId]);
  useEffect(() => {
    try { sessionStorage.setItem(photoStorageKey(walkSessionId), JSON.stringify(photos)); }
    catch { toast("Photo storage is full — finish the walk to clear"); }
  }, [photos, walkSessionId]);

  useEffect(() => {
    if (open && !draft && photos.length === 0 && notes.length === 0) {
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveNote = () => {
    const text = draft.trim();
    if (!text) { setOpen(false); return; }
    onChangeNotes([...notes, { t: elapsed, text }]);
    setDraft("");
    haptics.tap();
    toast("Saved to this walk");
  };

  const closeAndSave = () => {
    if (draft.trim()) saveNote();
    setOpen(false);
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
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (photos.length >= MAX_PHOTOS) {
      toast(`Up to ${MAX_PHOTOS} photos per walk`);
      return;
    }
    setBusy(true);
    try {
      const compressed = await compressImage(file);
      if (!compressed) { toast("Couldn't read that image"); return; }
      compressed.t = elapsed;
      onChangePhotos([...photos, compressed]);
      haptics.success();
    } finally { setBusy(false); }
  };

  const captureCount = notes.length + photos.length;

  return (
    <>
      <button
        type="button"
        onClick={() => { haptics.tap(); setOpen(true); }}
        className="inline-flex items-center gap-2 rounded-full border border-forest/25 bg-forest/10 px-5 py-2.5 text-sm font-medium text-forest shadow-soft transition active:scale-95 hover:bg-forest/15"
        aria-label="Capture a note or photo"
      >
        <Camera className="h-4 w-4 text-forest" />
        <span>Capture this moment</span>
        {captureCount > 0 && (
          <span className="ml-0.5 rounded-full bg-forest px-2 py-0.5 text-[10px] font-semibold tabular-nums text-primary-foreground">{captureCount}</span>
        )}
      </button>

      <Sheet open={open} onOpenChange={(v) => (v ? setOpen(true) : closeAndSave())}>
        <SheetContent
          side="bottom"
          className="max-h-[88dvh] overflow-y-auto rounded-t-3xl border-forest/15 bg-cream"
          style={{ paddingBottom: `calc(${inset}px + env(safe-area-inset-bottom) + 0.5rem)` }}
        >
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between gap-2 font-serif text-2xl text-forest">
              <span>Walk capture</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
                <Lock className="h-3 w-3" /> private · {fmt(elapsed)}
              </span>
            </SheetTitle>
          </SheetHeader>

          {/* Captured strip — photos first row, notes below */}
          {photos.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {photos.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setZoomedIdx(i)}
                  className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-forest/15 bg-background"
                  aria-label={`Photo at ${fmt(p.t)}`}
                >
                  <img src={p.dataUrl} alt="" className="h-full w-full object-cover" />
                  <span className="absolute bottom-1 left-1 rounded-full bg-background/80 px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-foreground/80">{fmt(p.t)}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); removePhoto(i); } }}
                    className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-background/90 text-foreground/70 opacity-0 transition group-hover:opacity-100"
                    aria-label="Remove photo"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </button>
              ))}
            </div>
          )}

          {notes.length > 0 && (
            <div className="mt-3 max-h-44 space-y-1 overflow-y-auto pr-1">
              {notes.map((n, i) => (
                <div key={i} className="group flex items-start gap-2 rounded-xl border border-forest/10 bg-background/60 p-2 text-sm">
                  <span className="mt-0.5 shrink-0 rounded-full bg-forest/10 px-2 py-0.5 font-mono text-[10px] tabular-nums text-forest">{fmt(n.t)}</span>
                  <p className="flex-1 whitespace-pre-wrap font-serif italic text-foreground/85">{n.text}</p>
                  <button
                    onClick={() => removeNote(i)}
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
              rows={3}
              inputMode="text"
              autoCapitalize="sentences"
              className="w-full resize-none rounded-2xl border border-forest/15 bg-background/80 p-3 font-serif text-base placeholder:italic placeholder:text-muted-foreground/70 focus:border-forest focus:outline-none"
            />

            {/* Hidden input — capture="environment" pops the rear camera on mobile */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onPickPhoto}
              className="hidden"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy || photos.length >= MAX_PHOTOS}
                className="inline-flex h-11 items-center gap-1.5 rounded-full border border-forest/20 bg-background/80 px-4 text-sm text-foreground transition active:scale-95 hover:border-forest/40 disabled:opacity-50"
                aria-label="Take a photo"
              >
                <Camera className="h-4 w-4 text-forest" />
                {busy ? "Compressing…" : photos.length >= MAX_PHOTOS ? `Max ${MAX_PHOTOS}` : "Photo"}
              </button>
              <p className="flex-1 truncate text-[11px] italic text-muted-foreground">
                {photos.length > 0 ? `${photos.length} of ${MAX_PHOTOS} photos · auto-shrunk` : "Joins your journal at end of walk"}
              </p>
              <Button
                onClick={saveNote}
                className="h-11 shrink-0 rounded-full bg-forest px-5 text-primary-foreground hover:opacity-90"
              >
                {draft.trim() ? "Save" : "Done"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Lightweight photo viewer */}
      {zoomedIdx !== null && photos[zoomedIdx] && (
        <div
          role="dialog"
          aria-label="Photo preview"
          onClick={() => setZoomedIdx(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/85 p-4 backdrop-blur"
        >
          <img
            src={photos[zoomedIdx].dataUrl}
            alt=""
            className="max-h-full max-w-full rounded-2xl object-contain shadow-elevated"
          />
          <button
            onClick={(e) => { e.stopPropagation(); setZoomedIdx(null); }}
            className="absolute right-5 top-[calc(env(safe-area-inset-top)+1rem)] grid h-10 w-10 place-items-center rounded-full bg-background/90 text-foreground"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </>
  );
}

/** Upload all captured photos for a walk to storage, insert walk_photos rows. */
export async function uploadWalkPhotos(opts: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
  walkSessionId: string;
  photos: WalkPhoto[];
}): Promise<void> {
  const { supabase, userId, walkSessionId, photos } = opts;
  if (photos.length === 0) return;
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const blob = await (await fetch(p.dataUrl)).blob();
    const path = `${userId}/${walkSessionId}/${Date.now()}_${i}.jpg`;
    const { error } = await supabase.storage.from("walk-photos").upload(path, blob, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (error) continue;
    await supabase.from("walk_photos").insert({
      walk_session_id: walkSessionId,
      user_id: userId,
      storage_path: path,
      width: p.width,
      height: p.height,
      bytes: p.bytes,
      taken_at_seconds: p.t,
    });
  }
}

// Type-only export to satisfy callers using `Image` icon — keeps tree-shaking happy.
void ImageIcon;
