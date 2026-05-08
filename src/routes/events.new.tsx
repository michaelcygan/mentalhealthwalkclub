import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationAutosuggest, type LocationValue } from "@/components/location-autosuggest";
import { createLocalWalk } from "@/server/walks.functions";
import { scheduleAudioWalk } from "@/server/audio.functions";
import { toast } from "sonner";
import { MapPin, Headphones, Shuffle } from "lucide-react";

type SearchParams = { group?: string; mode?: "irl" | "audio" };

export const Route = createFileRoute("/events/new")({
  component: NewWalk,
  head: () => ({ meta: [{ title: "Schedule a walk — Walk Club" }] }),
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    group: typeof s.group === "string" ? s.group : undefined,
    mode: s.mode === "audio" ? "audio" : s.mode === "irl" ? "irl" : undefined,
  }),
});

function NewWalk() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/events/new" }) as SearchParams;
  const createIrl = useServerFn(createLocalWalk);
  const createAudio = useServerFn(scheduleAudioWalk);

  const [mode, setMode] = useState<"irl" | "audio">(search.mode ?? "irl");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(60);
  const [meetingPoint, setMeetingPoint] = useState("");
  const [vibe, setVibe] = useState("gentle");
  const [capacity, setCapacity] = useState(8);
  const [location, setLocation] = useState<LocationValue | null>(null);
  // audio
  const [theme, setTheme] = useState<string | null>(null);
  const [breakoutSize, setBreakoutSize] = useState<0 | 2 | 3 | 4>(0);
  const [rotateMinutes, setRotateMinutes] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) navigate({ to: "/auth" as never });
  }, [user, navigate]);

  const submit = async () => {
    if (!title.trim() || !date || !time) return toast.error("Add a title and time.");
    const startsAt = new Date(`${date}T${time}`).toISOString();
    setBusy(true);
    try {
      if (mode === "irl") {
        if (!location || location.lat == null || location.lng == null) {
          setBusy(false);
          return toast.error("Pick a city from the suggestions.");
        }
        const res = await createIrl({
          data: {
            title: title.trim(),
            description: description.trim() || null,
            starts_at: startsAt,
            duration_min: duration,
            meeting_point: meetingPoint.trim() || null,
            vibe,
            capacity,
            city: location.city,
            region: location.region,
            country: location.country,
            location_label: location.location_label,
            lat: location.lat!,
            lng: location.lng!,
          },
        });
        toast.success("Walk scheduled. Share the link with your people.");
        navigate({ to: "/events/$slug" as never, params: { slug: res.slug } as never });
      } else {
        const res = await createAudio({
          data: {
            groupId: search.group ?? null,
            title: title.trim(),
            description: description.trim() || null,
            theme: theme ?? null,
            startsAt,
            durationMinutes: duration,
            capacity,
            breakoutSize,
            breakoutRotateMinutes: rotateMinutes,
          },
        });
        toast.success("Circle opened. Share the link with your people.");
        navigate({ to: "/events/$slug" as never, params: { slug: res.slug } as never });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not schedule");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link to={"/events" as never} className="text-sm text-muted-foreground hover:text-foreground">← Walks</Link>
      <header>
        <h1 className="font-serif text-3xl">Schedule a Walk</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick a time. Choose where it happens. We'll do the rest.</p>
      </header>

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-soft">
        {([
          { key: "irl" as const, label: "In person", icon: MapPin, sub: "Meet at a place" },
          { key: "audio" as const, label: "Walk & Talk", icon: Headphones, sub: "Walk anywhere · talk live" },
        ]).map(({ key, label, icon: Icon, sub }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={`flex flex-col items-start gap-0.5 rounded-xl px-4 py-3 text-left transition ${
              mode === key ? "bg-forest text-primary-foreground shadow-sm" : "hover:bg-secondary"
            }`}
          >
            <span className="flex items-center gap-1.5 text-sm font-medium"><Icon className="h-3.5 w-3.5" />{label}</span>
            <span className={`text-[11px] ${mode === key ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{sub}</span>
          </button>
        ))}
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div>
          <Label>Walk title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={mode === "irl" ? "Sunday Reset Walk" : "Quiet Morning Circle"} />
        </div>
        <div>
          <Label>A short note (optional)</Label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={mode === "irl" ? "Easy pace, no pressure to chat. We'll loop the lake." : "A gentle hour together. Anyone can join."}
            className="w-full rounded-xl border border-input bg-background p-3 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Time</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Duration (min)</Label>
            <Input type="number" min={15} max={mode === "audio" ? 180 : 360} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
          <div>
            <Label>Capacity</Label>
            <Input type="number" min={2} max={mode === "audio" ? 32 : 20} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
          </div>
        </div>

        {mode === "irl" && (
          <>
            <div>
              <Label>City</Label>
              <LocationAutosuggest value={location} onChange={setLocation} />
              <p className="mt-1 text-xs text-muted-foreground">We use the exact spot for arrival check-in.</p>
            </div>
            <div>
              <Label>Meeting point</Label>
              <Input value={meetingPoint} onChange={(e) => setMeetingPoint(e.target.value)} placeholder="Lincoln Park, north fountain" />
            </div>
            <div>
              <Label>Vibe</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {["gentle", "quiet", "chatty", "brisk"].map((v) => (
                  <button
                    key={v} type="button" onClick={() => setVibe(v)}
                    className={`rounded-full border px-3 py-1.5 text-sm capitalize ${vibe === v ? "border-forest bg-forest text-primary-foreground" : "border-border bg-card"}`}
                  >{v}</button>
                ))}
              </div>
            </div>
          </>
        )}

        {mode === "audio" && (
          <>
            <div>
              <Label>Theme</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {["quiet", "anxious", "tender", "steady", "celebratory"].map((t) => (
                  <button
                    key={t} type="button" onClick={() => setTheme(t === theme ? null : t)}
                    className={`rounded-full border px-3 py-1.5 text-sm capitalize ${theme === t ? "border-forest bg-forest text-primary-foreground" : "border-border bg-card"}`}
                  >{t}</button>
                ))}
              </div>
            </div>
            <div>
              <Label>Conversation shape</Label>
              <div className="mt-1 grid grid-cols-4 gap-2">
                {([
                  { v: 0 as const, label: "One circle" },
                  { v: 2 as const, label: "Pairs" },
                  { v: 3 as const, label: "Trios" },
                  { v: 4 as const, label: "Quads" },
                ]).map(({ v, label }) => (
                  <button
                    key={v} type="button" onClick={() => setBreakoutSize(v)}
                    className={`rounded-xl border px-2 py-2 text-xs ${breakoutSize === v ? "border-forest bg-forest text-primary-foreground" : "border-border bg-card hover:bg-secondary"}`}
                  >{label}</button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {breakoutSize === 0 ? "Everyone in one open circle." : `Walkers split into ${breakoutSize === 2 ? "pairs" : breakoutSize === 3 ? "trios" : "quads"} for closer conversation.`}
              </p>
            </div>
            {breakoutSize > 0 && (
              <div>
                <Label className="flex items-center gap-1.5"><Shuffle className="h-3.5 w-3.5" /> Mixing</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {([
                    { v: null, label: "Fixed pods" },
                    { v: 5, label: "Mix every 5 min" },
                    { v: 10, label: "Mix every 10 min" },
                    { v: 15, label: "Mix every 15 min" },
                  ] as Array<{ v: number | null; label: string }>).map(({ v, label }) => (
                    <button
                      key={String(v)} type="button" onClick={() => setRotateMinutes(v)}
                      className={`rounded-full border px-3 py-1.5 text-xs ${rotateMinutes === v ? "border-forest bg-forest text-primary-foreground" : "border-border bg-card"}`}
                    >{label}</button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <Button disabled={busy} onClick={submit} className="w-full rounded-full bg-forest text-primary-foreground hover:opacity-90">
          {busy ? "Scheduling…" : mode === "audio" ? "Open the circle" : "Schedule walk"}
        </Button>
      </div>
    </div>
  );
}
