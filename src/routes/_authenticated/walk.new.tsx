import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, MapPin, Loader2, Lock, Globe, Users, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  searchWalkPlaces,
  getOrCreateWalkPlace,
  type PlaceSuggestion,
} from "@/lib/walk-places.functions";
import { listMyHostableGroups, createWalk } from "@/lib/walks.functions";

export const Route = createFileRoute("/_authenticated/walk/new")({
  component: ComposeWalkPage,
  head: () => ({
    meta: [
      { title: "Plan a walk — Mental Health Walk Club" },
      { name: "description", content: "Pick a spot, pick a time, invite people. A quiet, gentle way to walk together." },
    ],
  }),
});

type Audience = "open" | "group" | "link_only";

function ComposeWalkPage() {
  const navigate = useNavigate();

  // form state
  const [title, setTitle] = useState("");
  const [vibe, setVibe] = useState("");

  // default: tomorrow 5pm local
  const defaultStarts = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(17, 0, 0, 0);
    return localIso(d);
  }, []);
  const [startsAt, setStartsAt] = useState(defaultStarts);

  // place
  const [placeQuery, setPlaceQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickedPlace, setPickedPlace] = useState<{
    id: string;
    name: string;
    address: string | null;
    hero_url: string | null;
  } | null>(null);
  const [resolvingPlace, setResolvingPlace] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // audience
  const [audience, setAudience] = useState<Audience>("link_only");
  const [groupChoice, setGroupChoice] = useState<{ kind: "group" | "circle"; id: string } | null>(null);
  const [hostable, setHostable] = useState<{
    groups: Array<{ id: string; name: string; slug: string; cover_image_url: string | null }>;
    circles: Array<{ id: string; name: string; slug: string; color: string | null }>;
  } | null>(null);

  // chips
  const [pace, setPace] = useState<"easy" | "moderate" | "brisk" | "">("");
  const [dogFriendly, setDogFriendly] = useState(false);
  const [kidFriendly, setKidFriendly] = useState(false);
  const [meetingPoint, setMeetingPoint] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // load hostable groups once
  useEffect(() => {
    listMyHostableGroups().then(setHostable).catch(() => {});
  }, []);

  // debounced place search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (pickedPlace) return; // don't search while a place is picked
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = placeQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchWalkPlaces({ data: { query: q } });
        setSuggestions(res.results);
        setShowSuggestions(true);
      } catch (e) {
        console.error(e);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [placeQuery, pickedPlace]);

  async function pickSuggestion(s: PlaceSuggestion) {
    setShowSuggestions(false);
    setResolvingPlace(true);
    try {
      const { place } = await getOrCreateWalkPlace({
        data: { google_place_id: s.google_place_id },
      });
      setPickedPlace({
        id: place.id,
        name: place.name,
        address: place.address,
        hero_url: place.hero_url,
      });
      setPlaceQuery(place.name);
      if (!title) setTitle(`Walk at ${place.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load that place.");
    } finally {
      setResolvingPlace(false);
    }
  }

  function clearPlace() {
    setPickedPlace(null);
    setPlaceQuery("");
    setSuggestions([]);
  }

  async function submit() {
    if (!title.trim()) return toast.error("Give your walk a title.");
    if (!startsAt) return toast.error("Pick a date and time.");
    if (audience === "group" && !groupChoice) return toast.error("Pick which group or circle.");

    setSubmitting(true);
    try {
      const startsIso = new Date(startsAt).toISOString();
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
      const { slug } = await createWalk({
        data: {
          title: title.trim(),
          vibe: vibe.trim() || null,
          starts_at: startsIso,
          timezone: tz,
          audience,
          group_id: audience === "group" && groupChoice?.kind === "group" ? groupChoice.id : null,
          circle_id: audience === "group" && groupChoice?.kind === "circle" ? groupChoice.id : null,
          place_id: pickedPlace?.id ?? null,
          meeting_point: meetingPoint.trim() || null,
          pace: pace || null,
          dog_friendly: dogFriendly,
          kid_friendly: kidFriendly,
        },
      });
      toast.success("Walk planned. Share the link!");
      navigate({ to: "/w/$code", params: { code: slug } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create that walk.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-4 pb-24 pt-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>

      <header className="mt-5">
        <h1 className="font-serif text-3xl leading-tight">Plan a walk</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a place, pick a time, decide who it's for. Share the link.
        </p>
      </header>

      {/* WHERE */}
      <section className="mt-6 space-y-2">
        <Label>Where</Label>
        {pickedPlace ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {pickedPlace.hero_url ? (
              <img src={pickedPlace.hero_url} alt="" className="h-32 w-full object-cover" loading="lazy" />
            ) : null}
            <div className="flex items-start gap-3 p-4">
              <MapPin className="mt-0.5 h-4 w-4 text-forest" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{pickedPlace.name}</div>
                {pickedPlace.address ? (
                  <div className="truncate text-xs text-muted-foreground">{pickedPlace.address}</div>
                ) : null}
              </div>
              <button
                onClick={clearPlace}
                className="rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-accent/40"
              >
                Change
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={placeQuery}
                onChange={(e) => setPlaceQuery(e.target.value)}
                onFocus={() => suggestions.length && setShowSuggestions(true)}
                placeholder="Search a park, trail, neighborhood…"
                className="pl-9"
              />
              {(searching || resolvingPlace) && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
                {suggestions.map((s) => (
                  <button
                    key={s.google_place_id}
                    onClick={() => pickSuggestion(s)}
                    className="block w-full px-4 py-3 text-left hover:bg-accent/40"
                  >
                    <div className="text-sm font-medium">{s.name}</div>
                    {s.address ? (
                      <div className="truncate text-xs text-muted-foreground">{s.address}</div>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Or leave blank and add details below — you can pick later.
            </p>
          </div>
        )}
      </section>

      {/* WHEN */}
      <section className="mt-6 space-y-2">
        <Label>When</Label>
        <Input
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
        />
      </section>

      {/* TITLE + VIBE */}
      <section className="mt-6 space-y-2">
        <Label>Title</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sunday slow loop"
          maxLength={120}
        />
      </section>

      <section className="mt-6 space-y-2">
        <Label>Vibe (optional)</Label>
        <Textarea
          value={vibe}
          onChange={(e) => setVibe(e.target.value)}
          placeholder="easy 30 min loop · quiet, no phones · bring a thermos"
          rows={2}
          maxLength={200}
        />
      </section>

      {/* AUDIENCE */}
      <section className="mt-6 space-y-2">
        <Label>Who it's for</Label>
        <div className="grid grid-cols-3 gap-2">
          <AudienceTile
            active={audience === "open"}
            onClick={() => setAudience("open")}
            icon={<Globe className="h-4 w-4" />}
            label="Open"
            sub="In Discover"
          />
          <AudienceTile
            active={audience === "group"}
            onClick={() => setAudience("group")}
            icon={<Users className="h-4 w-4" />}
            label="Group"
            sub="A group / circle"
          />
          <AudienceTile
            active={audience === "link_only"}
            onClick={() => setAudience("link_only")}
            icon={<Lock className="h-4 w-4" />}
            label="Link only"
            sub="Unlisted"
          />
        </div>

        {audience === "group" && (
          <div className="mt-3 rounded-2xl border border-border bg-card/60 p-3">
            {!hostable ? (
              <p className="text-xs text-muted-foreground">Loading your groups…</p>
            ) : hostable.groups.length === 0 && hostable.circles.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                You're not in any groups or circles yet. Try{" "}
                <Link to="/groups" className="underline">Groups</Link> or{" "}
                <Link to="/circles" className="underline">Circles</Link>.
              </p>
            ) : (
              <div className="space-y-3">
                {hostable.groups.length > 0 && (
                  <div>
                    <div className="mb-1 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Groups</div>
                    <div className="flex flex-wrap gap-1.5">
                      {hostable.groups.map((g) => (
                        <Chip
                          key={g.id}
                          active={groupChoice?.kind === "group" && groupChoice.id === g.id}
                          onClick={() => setGroupChoice({ kind: "group", id: g.id })}
                          label={g.name}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {hostable.circles.length > 0 && (
                  <div>
                    <div className="mb-1 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Circles</div>
                    <div className="flex flex-wrap gap-1.5">
                      {hostable.circles.map((c) => (
                        <Chip
                          key={c.id}
                          active={groupChoice?.kind === "circle" && groupChoice.id === c.id}
                          onClick={() => setGroupChoice({ kind: "circle", id: c.id })}
                          label={c.name}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* DETAILS */}
      <section className="mt-6 space-y-3">
        <Label>Details (optional)</Label>

        <Input
          value={meetingPoint}
          onChange={(e) => setMeetingPoint(e.target.value)}
          placeholder="Meet at the fountain by the south entrance"
          maxLength={280}
        />

        <div className="flex flex-wrap gap-1.5">
          {(["easy", "moderate", "brisk"] as const).map((p) => (
            <Chip
              key={p}
              active={pace === p}
              onClick={() => setPace(pace === p ? "" : p)}
              label={`Pace · ${p}`}
            />
          ))}
          <Chip active={dogFriendly} onClick={() => setDogFriendly((v) => !v)} label="Dog friendly" />
          <Chip active={kidFriendly} onClick={() => setKidFriendly((v) => !v)} label="Kid friendly" />
        </div>
      </section>

      <div className="mt-8">
        <Button onClick={submit} disabled={submitting} className="w-full rounded-full bg-forest text-primary-foreground hover:opacity-90">
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Create walk
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          You'll get a shareable link right after.
        </p>
      </div>
    </main>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{children}</div>;
}

function AudienceTile({
  active, onClick, icon, label, sub,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={`rounded-2xl border p-3 text-left transition ${
        active ? "border-forest bg-forest/10" : "border-border bg-card hover:bg-accent/40"
      }`}
    >
      <div className={`flex items-center gap-1.5 text-sm font-medium ${active ? "text-forest" : ""}`}>
        {icon} {label}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
    </button>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${
        active
          ? "border-forest bg-forest text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-accent/40"
      }`}
    >
      {label}
    </button>
  );
}

function localIso(d: Date): string {
  // YYYY-MM-DDTHH:MM for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
