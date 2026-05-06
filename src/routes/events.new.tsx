import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationAutosuggest, type LocationValue } from "@/components/location-autosuggest";
import { createLocalWalk } from "@/server/walks.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/events/new")({
  component: NewLocalWalk,
  head: () => ({ meta: [{ title: "Schedule a walk — Walk Club" }] }),
});

function NewLocalWalk() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const create = useServerFn(createLocalWalk);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(60);
  const [meetingPoint, setMeetingPoint] = useState("");
  const [vibe, setVibe] = useState("gentle");
  const [capacity, setCapacity] = useState(8);
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) navigate({ to: "/auth" as never });
  }, [user, navigate]);

  const submit = async () => {
    if (!title.trim() || !date || !time) return toast.error("Add a title and time.");
    if (!location || location.lat == null || location.lng == null) return toast.error("Pick a city from the suggestions.");
    setBusy(true);
    try {
      const starts_at = new Date(`${date}T${time}`).toISOString();
      const res = await create({
        data: {
          title: title.trim(),
          description: description.trim() || null,
          starts_at,
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not schedule walk";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link to={"/events" as never} className="text-sm text-muted-foreground hover:text-foreground">← Events</Link>
      <header>
        <h1 className="font-serif text-3xl">Schedule a Local Walk</h1>
        <p className="mt-1 text-sm text-muted-foreground">A real walk, in a real place. Neighbors RSVP, you start it day-of, and folks check in when they arrive.</p>
      </header>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div>
          <Label>Walk title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sunday Reset Walk" />
        </div>
        <div>
          <Label>A short note (optional)</Label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Easy pace, no pressure to chat. We'll loop the lake."
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
            <Input type="number" min={15} max={360} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
          <div>
            <Label>Capacity</Label>
            <Input type="number" min={2} max={20} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
          </div>
        </div>
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
                key={v}
                type="button"
                onClick={() => setVibe(v)}
                className={`rounded-full border px-3 py-1.5 text-sm capitalize ${vibe === v ? "border-forest bg-forest text-primary-foreground" : "border-border bg-card"}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <Button disabled={busy} onClick={submit} className="w-full rounded-full bg-forest text-primary-foreground hover:opacity-90">
          {busy ? "Scheduling…" : "Schedule walk"}
        </Button>
      </div>
    </div>
  );
}
