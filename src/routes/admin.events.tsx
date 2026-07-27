import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Star,
  StarOff,
  CalendarDays,
  MapPin,
  Users,
  Plus,
  Play,
  Pause,
  RefreshCw,
  Pencil,
  Trash2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import { setEventFeatured } from "@/lib/discover.functions";
import {
  listSeedSchedules,
  listSeedScheduleOccurrences,
  createSeedSchedule,
  updateSeedSchedule,
  pauseSeedSchedule,
  resumeSeedSchedule,
  materializeSeedScheduleNow,
  unpublishEmptySeedOccurrence,
} from "@/lib/admin-seed-walks.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { WalkPlacePicker, type WalkPlaceSelection } from "@/components/walk-page/walk-place-picker";


type EventRow = {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  venue_name: string | null;
  city: string | null;
  attendee_count: number;
  is_featured: boolean;
  is_seed: boolean;
  seed_schedule_id: string | null;
};

type SeedSchedule = {
  id: string;
  host_user_id: string | null;
  internal_name: string;
  title: string;
  description: string | null;
  vibe: string | null;
  place_id: string | null;
  venue_name: string | null;
  address: string | null;
  city: string;
  state: string | null;
  country: string | null;
  lat: number | string | null;
  lng: number | string | null;
  timezone: string;
  first_local_date: string;
  start_local_time: string;
  frequency_weeks: number;
  duration_minutes: number;
  pace: "easy" | "moderate" | "brisk" | null;
  dog_friendly: boolean;
  kid_friendly: boolean;
  accessibility_notes: string | null;
  active: boolean;
  horizon_occurrences: number;
  last_materialized_at: string | null;
  next_occurrence_at: string | null;
  last_error: string | null;
  future_count: number;
};

type Occurrence = {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  timezone: string | null;
  venue_name: string | null;
  city: string | null;
  status: string;
  attendee_count: number;
  host_user_id: string | null;
};

export const Route = createFileRoute("/admin/events")({
  component: AdminEventsPage,
  head: () => ({
    meta: [{ title: "Admin — Events" }],
  }),
});

type Segment = "upcoming" | "auto";

function AdminEventsPage() {
  const [segment, setSegment] = useState<Segment>("upcoming");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSegment("upcoming")}
          className={`rounded-full px-3.5 py-1.5 text-xs transition ${segment === "upcoming" ? "bg-forest text-primary-foreground" : "border border-border bg-card text-foreground hover:bg-accent/40"}`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setSegment("auto")}
          className={`rounded-full px-3.5 py-1.5 text-xs transition ${segment === "auto" ? "bg-forest text-primary-foreground" : "border border-border bg-card text-foreground hover:bg-accent/40"}`}
        >
          Auto schedules
        </button>
      </div>

      {segment === "upcoming" ? <UpcomingSection /> : <AutoSchedulesSection />}
    </div>
  );
}

/* =============================================================
   Upcoming (existing behavior + seed badge/filter/unpublish)
   ============================================================= */

function UpcomingSection() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "regular" | "seeded">("all");

  const load = async () => {
    setLoading(true);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("events")
      .select("id,slug,title,starts_at,venue_name,city,attendee_count,is_featured,is_seed,seed_schedule_id")
      .eq("status", "published")
      .gte("starts_at", now)
      .order("starts_at", { ascending: true })
      .limit(100);
    if (error) {
      toast.error(error.message);
    } else {
      setEvents((data ?? []) as EventRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "regular") return events.filter((e) => !e.is_seed);
    if (filter === "seeded") return events.filter((e) => e.is_seed);
    return events;
  }, [events, filter]);

  const toggle = async (ev: EventRow) => {
    try {
      await setEventFeatured({ data: { eventId: ev.id, featured: !ev.is_featured } });
      setEvents((prev) =>
        prev.map((e) => (e.id === ev.id ? { ...e, is_featured: !e.is_featured } : e)),
      );
      toast.success(ev.is_featured ? "Unfeatured" : "Featured");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const unpublish = async (ev: EventRow) => {
    if (!confirm(`Unpublish "${ev.title}"? Only works if no one has RSVPd.`)) return;
    try {
      await unpublishEmptySeedOccurrence({ data: { event_id: ev.id } });
      toast.success("Unpublished");
      setEvents((prev) => prev.filter((e) => e.id !== ev.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl">Upcoming events</h2>
        <div className="flex gap-1.5 text-[11px]">
          {(["all", "regular", "seeded"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-2.5 py-1 transition ${filter === f ? "bg-forest text-primary-foreground" : "border border-border bg-card hover:bg-accent/40"}`}
            >
              {f === "all" ? "All" : f === "regular" ? "Regular" : "Seeded"}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-card" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events match this filter.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((ev) => (
            <li
              key={ev.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
            >
              <button
                onClick={() => toggle(ev)}
                className="shrink-0 rounded-full p-2 transition hover:bg-accent/40"
                title={ev.is_featured ? "Unfeature" : "Feature"}
              >
                {ev.is_featured ? (
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                ) : (
                  <StarOff className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    to="/w/$code"
                    params={{ code: ev.slug }}
                    className="truncate font-serif text-base hover:underline"
                  >
                    {ev.title}
                  </Link>
                  {ev.is_seed && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-clay/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-clay">
                      <Sparkles className="h-2.5 w-2.5" /> Seed
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {formatDate(ev.starts_at)}
                  </span>
                  {ev.venue_name && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {ev.venue_name}
                    </span>
                  )}
                  {ev.city && <span>· {ev.city}</span>}
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {ev.attendee_count}
                  </span>
                </div>
              </div>
              {ev.is_seed && ev.attendee_count === 0 && (
                <button
                  onClick={() => unpublish(ev)}
                  className="rounded-full border border-border p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Unpublish (empty seed)"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              {ev.is_featured && (
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="shrink-0 rounded-full bg-forest/10 px-2 py-0.5 text-[10px] text-forest"
                >
                  Featured
                </motion.span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* =============================================================
   Auto schedules
   ============================================================= */

function AutoSchedulesSection() {
  const [schedules, setSchedules] = useState<SeedSchedule[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SeedSchedule | null>(null);
  const [viewing, setViewing] = useState<SeedSchedule | null>(null);

  const load = async () => {
    try {
      const { schedules } = await listSeedSchedules();
      setSchedules(schedules as SeedSchedule[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
      setSchedules([]);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<string, SeedSchedule[]>();
    for (const s of schedules ?? []) {
      const key = s.city || "—";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(s);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [schedules]);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-card/60 p-5">
        <h2 className="font-serif text-xl">Auto walk schedules</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep a rolling set of community starter walks available in launch cities.
        </p>
        <button
          onClick={() => setCreating(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> New schedule
        </button>
      </div>

      {schedules === null ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-card" />
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <p className="text-sm text-muted-foreground">No schedules yet. Create one to seed a city.</p>
      ) : (
        grouped.map(([city, list]) => (
          <div key={city} className="space-y-2">
            <h3 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{city}</h3>
            <ul className="space-y-2">
              {list.map((s) => (
                <ScheduleCard
                  key={s.id}
                  s={s}
                  onEdit={() => setEditing(s)}
                  onView={() => setViewing(s)}
                  onChanged={load}
                />
              ))}
            </ul>
          </div>
        ))
      )}

      {creating && (
        <ScheduleSheet
          open
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void load();
          }}
        />
      )}
      {editing && (
        <ScheduleSheet
          open
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
      {viewing && (
        <OccurrencesDialog schedule={viewing} onClose={() => setViewing(null)} onChanged={load} />
      )}
    </div>
  );
}

function ScheduleCard({
  s,
  onEdit,
  onView,
  onChanged,
}: {
  s: SeedSchedule;
  onEdit: () => void;
  onView: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      await materializeSeedScheduleNow({ data: { id: s.id } });
      toast.success("Generated");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    setBusy(true);
    try {
      if (s.active) {
        await pauseSeedSchedule({ data: { id: s.id } });
        toast.success("Paused");
      } else {
        await resumeSeedSchedule({ data: { id: s.id } });
        toast.success("Resumed");
      }
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const weekday = new Date(`${s.first_local_date}T${s.start_local_time}`).toLocaleDateString(
    undefined,
    { weekday: "long" },
  );

  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-serif text-base">{s.internal_name}</span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${s.active ? "bg-forest/10 text-forest" : "bg-muted text-muted-foreground"}`}
            >
              {s.active ? "Active" : "Paused"}
            </span>
            {!s.host_user_id && (
              <span className="shrink-0 rounded-full bg-clay/15 px-2 py-0.5 text-[10px] text-clay">
                Community starter
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{s.title}</div>
          <div className="mt-2 grid gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground sm:grid-cols-2">
            <div>
              <span className="text-foreground/70">Venue:</span> {s.venue_name ?? "—"}
            </div>
            <div>
              <span className="text-foreground/70">When:</span> {weekday} · {formatTime12(s.start_local_time)} {" "}
              <span className="opacity-60">({s.timezone})</span>
            </div>
            <div>
              <span className="text-foreground/70">Frequency:</span> {freqLabel(s.frequency_weeks)}
            </div>
            <div>
              <span className="text-foreground/70">Duration:</span> {s.duration_minutes} min
              {s.pace ? ` · ${s.pace}` : ""}
            </div>
            <div>
              <span className="text-foreground/70">Future walks:</span> {s.future_count} / {s.horizon_occurrences}
            </div>
            <div>
              <span className="text-foreground/70">Next:</span>{" "}
              {s.next_occurrence_at ? formatDateTz(s.next_occurrence_at, s.timezone) : "—"}
            </div>
          </div>
          {s.last_error && (
            <p className="mt-2 rounded-lg bg-destructive/10 p-2 text-[11px] text-destructive">
              Last error: {s.last_error}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button variant="outline" size="sm" onClick={onView} disabled={busy}>
          <CalendarDays className="mr-1 h-3.5 w-3.5" /> Occurrences
        </Button>
        <Button variant="outline" size="sm" onClick={generate} disabled={busy}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Generate now
        </Button>
        <Button variant="outline" size="sm" onClick={onEdit} disabled={busy}>
          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
        </Button>
        <Button variant="outline" size="sm" onClick={toggleActive} disabled={busy}>
          {s.active ? (
            <>
              <Pause className="mr-1 h-3.5 w-3.5" /> Pause
            </>
          ) : (
            <>
              <Play className="mr-1 h-3.5 w-3.5" /> Resume
            </>
          )}
        </Button>
      </div>
    </li>
  );
}

/* =============================================================
   Create/Edit sheet
   ============================================================= */

type FormState = {
  internal_name: string;
  title: string;
  description: string;
  vibe: string;
  place: WalkPlaceSelection | null;
  city: string;
  state: string;
  country: string;
  timezone: string;
  first_local_date: string;
  start_local_time: string;
  frequency_weeks: 1 | 2 | 4;
  duration_minutes: number;
  pace: "" | "easy" | "moderate" | "brisk";
  dog_friendly: boolean;
  kid_friendly: boolean;
  accessibility_notes: string;
  host_mode: "community" | "self";
  active: boolean;
  horizon_occurrences: number;
  allow_off_hours: boolean;
  allow_long_duration: boolean;
};

function toForm(s?: SeedSchedule | null): FormState {
  const localTz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  if (!s) {
    const d = new Date();
    return {
      internal_name: "",
      title: "",
      description: "",
      vibe: "",
      place: null,
      city: "",
      state: "",
      country: "",
      timezone: localTz,
      first_local_date: d.toISOString().slice(0, 10),
      start_local_time: "11:00",
      frequency_weeks: 1,
      duration_minutes: 60,
      pace: "",
      dog_friendly: false,
      kid_friendly: false,
      accessibility_notes: "",
      host_mode: "community",
      active: true,
      horizon_occurrences: 6,
      allow_off_hours: false,
      allow_long_duration: false,
    };
  }
  const place: WalkPlaceSelection | null = s.place_id
    ? {
        id: s.place_id,
        name: s.venue_name ?? "Selected place",
        address: s.address,
        hero_url: null,
        lat: s.lat != null ? Number(s.lat) : null,
        lng: s.lng != null ? Number(s.lng) : null,
      }
    : s.venue_name || s.address
      ? {
          id: null,
          name: s.venue_name ?? s.address ?? "",
          address: s.address,
          hero_url: null,
          lat: s.lat != null ? Number(s.lat) : null,
          lng: s.lng != null ? Number(s.lng) : null,
        }
      : null;
  return {
    internal_name: s.internal_name,
    title: s.title,
    description: s.description ?? "",
    vibe: s.vibe ?? "",
    place,
    city: s.city,
    state: s.state ?? "",
    country: s.country ?? "",
    timezone: s.timezone,
    first_local_date: s.first_local_date,
    start_local_time: s.start_local_time.slice(0, 5),
    frequency_weeks: (s.frequency_weeks as 1 | 2 | 4) ?? 1,
    duration_minutes: s.duration_minutes,
    pace: (s.pace ?? "") as FormState["pace"],
    dog_friendly: s.dog_friendly,
    kid_friendly: s.kid_friendly,
    accessibility_notes: s.accessibility_notes ?? "",
    host_mode: s.host_user_id ? "self" : "community",
    active: s.active,
    horizon_occurrences: s.horizon_occurrences,
    allow_off_hours: false,
    allow_long_duration: false,
  };
}


function ScheduleSheet({
  open,
  existing,
  onClose,
  onSaved,
}: {
  open: boolean;
  existing?: SeedSchedule;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(existing ?? null));
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<null | { preserved?: number; removed?: number; created: number }>(null);
  const [occurrences, setOccurrences] = useState<Occurrence[] | null>(null);

  const submit = async () => {
    if (!form.internal_name.trim() || !form.title.trim() || !form.city.trim()) {
      toast.error("Fill in name, title and city.");
      return;
    }
    if (!form.place || !form.place.name.trim()) {
      toast.error("Pick or enter a meeting point.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        internal_name: form.internal_name.trim(),
        title: form.title.trim(),
        description: form.description.trim() || null,
        vibe: form.vibe.trim() || null,
        place_id: form.place.id,
        venue_name: form.place.name.trim() || null,
        address: form.place.address?.trim() || null,
        city: form.city.trim(),
        state: form.state.trim() || null,
        country: form.country.trim() || null,
        lat: form.place.lat,
        lng: form.place.lng,
        timezone: form.timezone,
        first_local_date: form.first_local_date,
        start_local_time: form.start_local_time,
        frequency_weeks: form.frequency_weeks,
        duration_minutes: form.duration_minutes,
        pace: form.pace || null,
        dog_friendly: form.dog_friendly,
        kid_friendly: form.kid_friendly,
        accessibility_notes: form.accessibility_notes.trim() || null,
        host_mode: form.host_mode,
        active: form.active,
        horizon_occurrences: form.horizon_occurrences,
        allow_off_hours: form.allow_off_hours,
        allow_long_duration: form.allow_long_duration,
      };

      if (existing) {
        const res = await updateSeedSchedule({ data: { id: existing.id, ...payload } });
        setResult({ preserved: res.preserved, removed: res.removed, created: res.created });
        toast.success(`Saved. Kept ${res.preserved}, removed ${res.removed}, added ${res.created}.`);
      } else {
        const res = await createSeedSchedule({ data: payload });
        const created = Number(
          (res.materialize as { inserted?: number } | null | undefined)?.inserted ?? 0,
        );
        setResult({ created });
        toast.success(`Created. Generated ${created} occurrences.`);
      }
      // Load newly generated occurrences to show back to admin
      const scheduleId = existing?.id ?? (result ? null : null);
      const idForList = existing?.id ?? null;
      if (idForList) {
        const { occurrences } = await listSeedScheduleOccurrences({ data: { schedule_id: idForList } });
        setOccurrences(occurrences as Occurrence[]);
      }
      // For new schedule, keep sheet open briefly to show occurrences via list call
      if (!existing) {
        // We don't have the schedule ID from create response here, so just close after a tick
        setTimeout(() => onSaved(), 400);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {existing ? "Edit schedule" : "New auto walk schedule"}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Use a public, easy-to-identify meeting place. Community starter walks show a disclosure that no
          official leader is assigned unless you set "Hosted by me".
        </p>

        <div className="mt-3 grid gap-4">
          <Field label="Internal schedule name">
            <Input
              value={form.internal_name}
              onChange={(e) => setForm({ ...form, internal_name: e.target.value })}
              placeholder="Chicago · Saturday morning"
              maxLength={120}
            />
          </Field>

          <Field label="Public walk title">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Community Walk at Winnemac Park"
              maxLength={160}
            />
          </Field>

          <Field label="Public description">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              maxLength={2000}
              placeholder="Optional — a sentence about the vibe or route."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Field>
            <Field label="State / Region">
              <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </Field>
          </div>

          <Field label="Country (optional)">
            <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </Field>

          <Field label="Meeting point">
            <WalkPlacePicker
              value={form.place}
              onChange={(v) => setForm({ ...form, place: v })}
              allowManual
              placeholder="Search a park, cafe, plaza…"
              hint="Pick a Photon result to auto-fill address and coordinates, or enter manually."
            />
          </Field>


          <div className="grid grid-cols-2 gap-3">
            <Field label="First date">
              <Input
                type="date"
                value={form.first_local_date}
                onChange={(e) => setForm({ ...form, first_local_date: e.target.value })}
              />
            </Field>
            <Field label="Local start time">
              <Input
                type="time"
                value={form.start_local_time}
                onChange={(e) => setForm({ ...form, start_local_time: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Timezone (IANA, e.g. America/Chicago)">
            <Input
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            />
          </Field>

          <Field label="Frequency">
            <div className="flex flex-wrap gap-2">
              {[1, 2, 4].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setForm({ ...form, frequency_weeks: f as 1 | 2 | 4 })}
                  className={`rounded-full px-3.5 py-1.5 text-xs transition ${form.frequency_weeks === f ? "bg-forest text-primary-foreground" : "border border-border bg-card hover:bg-accent/40"}`}
                >
                  {freqLabel(f)}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Duration (minutes)">
              <Input
                type="number"
                min={10}
                max={480}
                value={form.duration_minutes}
                onChange={(e) =>
                  setForm({ ...form, duration_minutes: Math.max(10, Math.min(480, Number(e.target.value) || 60)) })
                }
              />
            </Field>
            <Field label="Future occurrences to keep">
              <Input
                type="number"
                min={1}
                max={12}
                value={form.horizon_occurrences}
                onChange={(e) =>
                  setForm({
                    ...form,
                    horizon_occurrences: Math.max(1, Math.min(12, Number(e.target.value) || 6)),
                  })
                }
              />
            </Field>
          </div>

          <Field label="Walking pace">
            <div className="flex flex-wrap gap-2">
              {(["", "easy", "moderate", "brisk"] as const).map((p) => (
                <button
                  key={p || "none"}
                  type="button"
                  onClick={() => setForm({ ...form, pace: p })}
                  className={`rounded-full px-3.5 py-1.5 text-xs transition ${form.pace === p ? "bg-forest text-primary-foreground" : "border border-border bg-card hover:bg-accent/40"}`}
                >
                  {p || "unspecified"}
                </button>
              ))}
            </div>
          </Field>

          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.dog_friendly}
                onChange={(e) => setForm({ ...form, dog_friendly: e.target.checked })}
              />
              Dog friendly
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.kid_friendly}
                onChange={(e) => setForm({ ...form, kid_friendly: e.target.checked })}
              />
              Kid friendly
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active
            </label>
          </div>

          <Field label="Accessibility notes">
            <Textarea
              value={form.accessibility_notes}
              onChange={(e) => setForm({ ...form, accessibility_notes: e.target.value })}
              rows={2}
              maxLength={1000}
              placeholder="Optional — surface, hills, benches, restrooms."
            />
          </Field>

          <Field label="Host">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, host_mode: "community" })}
                className={`rounded-full px-3.5 py-1.5 text-xs transition ${form.host_mode === "community" ? "bg-forest text-primary-foreground" : "border border-border bg-card hover:bg-accent/40"}`}
              >
                Community starter — no assigned host
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, host_mode: "self" })}
                className={`rounded-full px-3.5 py-1.5 text-xs transition ${form.host_mode === "self" ? "bg-forest text-primary-foreground" : "border border-border bg-card hover:bg-accent/40"}`}
              >
                Hosted by me
              </button>
            </div>
          </Field>

          {result && (
            <div className="rounded-2xl border border-border bg-card/60 p-3 text-xs text-muted-foreground">
              {existing ? (
                <>
                  Kept {result.preserved ?? 0} · Removed {result.removed ?? 0} · Added {result.created}
                </>
              ) : (
                <>Generated {result.created} occurrences.</>
              )}
            </div>
          )}
          {occurrences && occurrences.length > 0 && (
            <div className="rounded-2xl border border-border bg-card/40 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Future occurrences
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {occurrences.slice(0, 6).map((o) => (
                  <li key={o.id}>
                    {formatDateTz(o.starts_at, o.timezone || form.timezone)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : existing ? "Save changes" : "Create schedule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/* =============================================================
   Occurrences dialog
   ============================================================= */

function OccurrencesDialog({
  schedule,
  onClose,
  onChanged,
}: {
  schedule: SeedSchedule;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<Occurrence[] | null>(null);
  const load = async () => {
    try {
      const { occurrences } = await listSeedScheduleOccurrences({ data: { schedule_id: schedule.id } });
      setRows(occurrences as Occurrence[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule.id]);

  const unpublish = async (id: string) => {
    if (!confirm("Unpublish this occurrence? Only works if no one has RSVPd.")) return;
    try {
      await unpublishEmptySeedOccurrence({ data: { event_id: id } });
      toast.success("Unpublished");
      await load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <Dialog open onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{schedule.internal_name}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">Future and past occurrences generated by this schedule.</p>
        <div className="mt-3">
          {rows === null ? (
            <div className="h-24 animate-pulse rounded-2xl bg-card" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No occurrences yet.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((o) => {
                const past = new Date(o.starts_at).getTime() < Date.now();
                const cancelled = o.status === "cancelled";
                return (
                  <li
                    key={o.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/w/$code"
                        params={{ code: o.slug }}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {formatDateTz(o.starts_at, o.timezone || schedule.timezone)}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">
                        {cancelled ? "Cancelled · " : past ? "Past · " : ""}
                        RSVPs: {o.attendee_count}
                      </div>
                    </div>
                    {!past && !cancelled && o.attendee_count === 0 && (
                      <button
                        onClick={() => unpublish(o.id)}
                        className="rounded-full border border-border p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Unpublish"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* =============================================================
   Utils
   ============================================================= */

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateTz(iso: string, tz: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return formatDate(iso);
  }
}

function formatTime12(t: string) {
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
}

function freqLabel(w: number) {
  if (w === 1) return "Every week";
  if (w === 2) return "Every 2 weeks";
  return "Every 4 weeks";
}
