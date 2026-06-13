import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, ChevronDown, Footprints, MoreHorizontal, PenLine, Trash2, Share2 } from "lucide-react";
import { WeatherPill } from "@/components/weather-pill";
import {
  deleteJournalEntry,
  updateWalkReflection,
  type FeedEntry,
} from "@/lib/journal-entries.functions";
import { share, haptics } from "@/lib/device";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Props {
  entry: FeedEntry;
  active: boolean;
  onToggle: () => void;
  onChanged: () => void;
}

export function EntryRow({ entry, active, onToggle, onChanged }: Props) {
  if (entry.kind === "reflection") return <ReflectionRow entry={entry} active={active} onToggle={onToggle} onChanged={onChanged} />;
  return <WalkRow entry={entry} active={active} onToggle={onToggle} onChanged={onChanged} />;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// ─── Reflection card ────────────────────────────────────────────────────────

function ReflectionRow({ entry, active, onToggle, onChanged }: Props) {
  const del = useServerFn(deleteJournalEntry);
  const body = (entry.body ?? "").trim();
  const isLong = body.length > 240 || body.split("\n").length > 3;

  async function onDelete() {
    if (!confirm("Delete this reflection?")) return;
    try {
      await del({ data: { id: entry.id } });
      toast.success("Removed");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete");
    }
  }

  async function onShare() {
    haptics.tap();
    const lines = [entry.prompt_text, "", body, "", "— from my walking journal"].filter(Boolean) as string[];
    await share({ title: "From my journal", text: lines.join("\n") });
  }

  return (
    <article className="rounded-2xl border border-border bg-card/90 p-4 shadow-soft">
      <header className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 items-center gap-1 rounded-full bg-accent px-2 text-[10px] font-medium uppercase tracking-[0.12em] text-accent-foreground">
            <PenLine className="h-2.5 w-2.5" /> Reflection
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {fmtDate(entry.at)} · {fmtTime(entry.at)}
          </span>
        </div>
        <EntryMenu onShare={onShare} onDelete={onDelete} />
      </header>
      {entry.prompt_text && (
        <p className="mt-2 font-serif text-sm italic leading-snug text-muted-foreground">{entry.prompt_text}</p>
      )}
      <button type="button" onClick={onToggle} className="mt-2 block w-full text-left">
        <p
          className={`whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-foreground ${
            !active && isLong ? "line-clamp-4" : ""
          }`}
        >
          {body}
        </p>
        {isLong && (
          <span className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
            {active ? "Show less" : "Read more"}
            <ChevronDown className={`h-3 w-3 transition ${active ? "rotate-180" : ""}`} />
          </span>
        )}
      </button>
    </article>
  );
}

// ─── Walk card ──────────────────────────────────────────────────────────────

function WalkRow({ entry, active, onToggle, onChanged }: Props) {
  const updateNote = useServerFn(updateWalkReflection);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.reflection_note ?? "");
  const [saving, setSaving] = useState(false);

  const mins = Math.round((entry.duration_seconds ?? 0) / 60);
  const steps = (entry.steps ?? 0).toLocaleString();
  const hasMood = !!(entry.mood_before || entry.mood_after);
  const hasNote = !!(entry.reflection_note ?? "").trim();
  const hasPhotos = (entry.photo_count ?? 0) > 0 && (entry.photo_urls?.length ?? 0) > 0;
  const delta =
    entry.mood_before_score != null && entry.mood_after_score != null
      ? entry.mood_after_score - entry.mood_before_score
      : null;

  async function saveNote() {
    setSaving(true);
    try {
      await updateNote({ data: { id: entry.id, reflection_note: draft.trim() || null } });
      toast.success("Reflection saved");
      setEditing(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  async function onShare() {
    haptics.tap();
    const date = fmtDate(entry.at);
    const moodLine = entry.mood_before && entry.mood_after ? `${entry.mood_before} → ${entry.mood_after}` : entry.mood_after ?? "";
    const lines = [
      `🌿 ${date} — ${mins} min walk`,
      moodLine && `mood: ${moodLine}`,
      entry.reflection_note && `"${entry.reflection_note}"`,
      "— from my walking journal",
    ].filter(Boolean) as string[];
    await share({ title: "A walk worth remembering", text: lines.join("\n") });
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <header className="flex items-baseline justify-between gap-3 px-4 pt-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 items-center gap-1 rounded-full bg-secondary px-2 text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/80">
            <Footprints className="h-2.5 w-2.5" /> Walk
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {fmtDate(entry.at)} · {fmtTime(entry.at)}
          </span>
        </div>
        <EntryMenu onShare={onShare} />
      </header>

      <button type="button" onClick={onToggle} className="block w-full text-left">
        <div className="flex items-baseline gap-4 px-4 pt-2">
          <Stat value={String(mins)} unit="min" />
          {(entry.steps ?? 0) > 0 && <Stat value={steps} unit="steps logged" muted />}
          {entry.weather_at_end?.tempF != null && (
            <div className="ml-auto">
              <WeatherPill
                tempF={entry.weather_at_end.tempF}
                label={entry.weather_at_end.label}
                tone={(entry.weather_at_end.tone as never) || "cloud"}
                isDay={entry.weather_at_end.isDay}
              />
            </div>
          )}
        </div>

        {/* Photos */}
        {hasPhotos && (
          <div className={`mt-3 grid gap-0.5 px-0`} style={{ gridTemplateColumns: `repeat(${Math.min(entry.photo_urls!.length, 3)}, minmax(0, 1fr))` }}>
            {entry.photo_urls!.slice(0, 3).map((url, i) => (
              <div key={i} className="relative aspect-square overflow-hidden bg-foreground/5">
                <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                {i === 2 && (entry.photo_count ?? 0) > 3 && (
                  <div className="absolute inset-0 grid place-items-center bg-foreground/45 font-serif text-base text-cream">
                    +{(entry.photo_count ?? 0) - 3}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 px-4 pb-3 pt-3">
          {/* Tag pills */}
          {(hasPhotos || hasNote) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {hasPhotos && (
                <Pill icon={<Camera className="h-3 w-3" />} label={`${entry.photo_count} ${entry.photo_count === 1 ? "photo" : "photos"}`} />
              )}
              {hasNote && <Pill icon={<PenLine className="h-3 w-3" />} label="Note" />}
            </div>
          )}
          {hasMood && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {entry.mood_before && <span className="rounded-full bg-secondary px-2 py-0.5 capitalize">{entry.mood_before}</span>}
              <span className="text-muted-foreground">→</span>
              {entry.mood_after ? (
                <span className="rounded-full bg-accent px-2 py-0.5 capitalize text-accent-foreground">{entry.mood_after}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
              {delta !== null && delta !== 0 && (
                <span className={`tabular-nums ${delta > 0 ? "text-forest" : "text-clay"}`}>
                  {delta > 0 ? `+${delta}` : delta}
                </span>
              )}
            </div>
          )}
          {entry.reflection_note && (
            <div>
              {entry.reflection_prompt && (
                <p className="mb-1 text-xs text-muted-foreground">Prompt: {entry.reflection_prompt}</p>
              )}
              <p className={`font-serif italic leading-snug text-foreground/85 ${active ? "" : "line-clamp-2"}`}>
                "{entry.reflection_note}"
              </p>
            </div>
          )}
          {entry.intention && active && (
            <p className="text-xs text-muted-foreground">Intention: {entry.intention}</p>
          )}
        </div>
      </button>

      {/* Inline reflection editor */}
      {active && (
        <div className="border-t border-border px-4 py-3">
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                placeholder="A line you'll want to find again."
                className="w-full resize-none rounded-2xl border border-forest/15 bg-background/80 p-3 font-serif italic leading-relaxed placeholder:text-muted-foreground/70 focus:border-forest focus:outline-none"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setEditing(false); setDraft(entry.reflection_note ?? ""); }}
                  className="rounded-full px-3 py-1.5 text-xs text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveNote}
                  className="rounded-full bg-forest px-4 py-1.5 text-xs text-primary-foreground disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-foreground/80 hover:bg-muted/70"
            >
              <PenLine className="h-3 w-3" /> {hasNote ? "Edit reflection" : "Add reflection"}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function EntryMenu({ onShare, onDelete }: { onShare: () => void; onDelete?: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Entry menu"
          className="rounded-full p-1 text-muted-foreground hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={onShare}>
          <Share2 className="mr-2 h-3.5 w-3.5" /> Share
        </DropdownMenuItem>
        {onDelete && (
          <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Stat({ value, unit, muted }: { value: string; unit: string; muted?: boolean }) {
  return (
    <div className={`flex items-baseline gap-1 ${muted ? "opacity-70" : ""}`}>
      <span className="font-serif text-xl tabular-nums leading-none">{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{unit}</span>
    </div>
  );
}

function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground/75">
      {icon}
      {label}
    </span>
  );
}
