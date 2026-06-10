import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import {
  getEventPhotos,
  addEventPhoto,
  deleteEventPhoto,
  type EventPhoto,
} from "@/lib/walk-page.functions";
import { compressImage } from "@/lib/image-compress";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export default function MemoryStrip({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const { requireAuth } = useAuthPrompt();
  const fetchPhotos = useServerFn(getEventPhotos);
  const addPhoto = useServerFn(addEventPhoto);
  const removePhoto = useServerFn(deleteEventPhoto);

  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<EventPhoto | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    try {
      const { photos } = await fetchPhotos({ data: { eventId } });
      setPhotos(photos);
    } catch (e) {
      console.error("load photos", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const onPick = () => {
    requireAuth(() => inputRef.current?.click());
  };

  const onFile = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Photo is too large (max 8 MB).");
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
      const path = `${user.id}/${eventId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("event-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      await addPhoto({
        data: {
          eventId,
          storagePath: path,
          bytes: file.size,
        },
      });
      toast.success("Memory added.");
      await load();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Couldn't upload photo");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDelete = async (p: EventPhoto) => {
    if (!user || p.user_id !== user.id) return;
    if (!confirm("Remove this memory?")) return;
    try {
      await removePhoto({ data: { id: p.id } });
      setPhotos((cur) => cur.filter((x) => x.id !== p.id));
      setLightbox(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove photo");
    }
  };

  const hasPhotos = photos.length > 0;

  return (
    <section className="mt-8">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Memory strip</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Loading photos…"
              : hasPhotos
              ? `${photos.length} memor${photos.length === 1 ? "y" : "ies"} from this walk`
              : "Be the first to drop a photo here."}
          </p>
        </div>
      </div>

      {hasPhotos ? (
        <div className="-mx-4 mt-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ul className="flex gap-3 pb-2">
            {photos.map((p) => (
              <li key={p.id} className="shrink-0">
                <button
                  onClick={() => setLightbox(p)}
                  className="group block overflow-hidden rounded-2xl border border-border bg-muted shadow-soft transition hover:opacity-95"
                  style={{ width: 152, height: 192 }}
                  aria-label={p.caption ?? "Walk memory"}
                >
                  <img
                    src={p.url}
                    alt={p.caption ?? "Walk memory"}
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </button>
                {p.display_name ? (
                  <p className="mt-1 truncate px-1 text-[11px] text-muted-foreground" style={{ width: 152 }}>
                    {p.display_name}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : !loading ? (
        <div className="mt-3 rounded-3xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
          No memories yet. Tap the camera to start the strip.
        </div>
      ) : (
        <div className="mt-3 flex gap-3 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 w-[152px] shrink-0 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />

      <button
        onClick={onPick}
        disabled={uploading}
        aria-label="Add a memory"
        className="fixed bottom-6 right-6 z-[1000] flex h-14 w-14 items-center justify-center rounded-full bg-forest text-primary-foreground shadow-xl ring-4 ring-cream/50 transition hover:scale-105 active:scale-95 disabled:opacity-60"
      >
        {uploading ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
        ) : (
          <Camera className="h-6 w-6" />
        )}
      </button>

      {lightbox ? (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <figure className="max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightbox.url}
              alt={lightbox.caption ?? "Walk memory"}
              className="max-h-[80vh] w-auto rounded-2xl object-contain"
            />
            <figcaption className="mt-3 flex items-center justify-between gap-3 text-sm text-white/85">
              <span>
                {lightbox.display_name ?? "A walker"}
                {lightbox.caption ? ` · ${lightbox.caption}` : ""}
              </span>
              {user && lightbox.user_id === user.id ? (
                <button
                  onClick={() => onDelete(lightbox)}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              ) : null}
            </figcaption>
          </figure>
        </div>
      ) : null}
    </section>
  );
}
