import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Globe, Lock, Users, MapPin, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  listMyGroups,
  createGroup,
  joinGroup,
  getMyAgeBand,
  setMyDob,
} from "@/lib/groups.functions";

export const Route = createFileRoute("/groups")({
  component: GroupsPage,
  head: () => ({
    meta: [
      { title: "Walking groups near you — Mental Health Walk Club" },
      {
        name: "description",
        content:
          "Find and start public walking groups. Standing walks, small circles, real accountability.",
      },
      { property: "og:title", content: "Walking groups — Mental Health Walk Club" },
      {
        property: "og:description",
        content: "Find and start public walking groups near you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const AGE_BANDS = ["18+", "21+", "25+", "40+", "65+"] as const;

type PublicGroup = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  neighborhood: string | null;
  cover_image_url: string | null;
  scope: string | null;
  member_count: number | null;
  created_at: string;
  miles?: number | null;
};

type MineGroup = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility?: string;
  scope?: string;
  neighborhood: string | null;
  cover_image_url: string | null;
  status?: string;
  created_at: string;
};

function GroupsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pubGroups, setPubGroups] = useState<PublicGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState<{ owned: MineGroup[]; member: MineGroup[] }>({ owned: [], member: [] });
  const [creating, setCreating] = useState(false);
  const [ageBand, setAgeBand] = useState<string | null>(null);
  const [needsDob, setNeedsDob] = useState(false);

  const [f, setF] = useState({
    name: "",
    description: "",
    visibility: "private" as "private" | "public",
    age_band_min: "18+" as (typeof AGE_BANDS)[number],
    neighborhood: "",
  });
  const [busy, setBusy] = useState(false);

  // Geolocation (public, best-effort)
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { maximumAge: 60_000, timeout: 4_000 },
    );
  }, []);

  // Public groups (anon-readable via public_groups view)
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("public_groups")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80);
      if (!error) setPubGroups((data ?? []) as PublicGroup[]);
      setLoading(false);
    })();
  }, []);

  // Auth-only extras
  useEffect(() => {
    if (!user) return;
    (async () => {
      const ab = await getMyAgeBand();
      setAgeBand(ab.age_band);
      setNeedsDob(!ab.has_dob);
      const m = await listMyGroups();
      setMine(m);
    })();
  }, [user]);

  const sortedPublic = useMemo(() => {
    if (!coords) return pubGroups;
    // Public view has no lat/lng — skip distance for now, just show as-is.
    return pubGroups;
  }, [pubGroups, coords]);

  const localGroups = useMemo(
    () => sortedPublic.filter((g) => g.scope !== "global"),
    [sortedPublic],
  );
  const globalGroups = useMemo(
    () => sortedPublic.filter((g) => g.scope === "global"),
    [sortedPublic],
  );

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const row = await createGroup({
        data: {
          name: f.name,
          description: f.description || null,
          visibility: f.visibility,
          scope: "local",
          age_band_min: f.age_band_min,
          neighborhood: f.neighborhood || null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        },
      });
      toast.success("Group created.");
      setCreating(false);
      setF({ name: "", description: "", visibility: "private", age_band_min: "18+", neighborhood: "" });
      navigate({ to: "/g/$slug", params: { slug: row.slug } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create.");
    } finally {
      setBusy(false);
    }
  };

  const onJoin = async (g: PublicGroup) => {
    if (!user) {
      navigate({ to: "/g/$slug", params: { slug: g.slug } });
      return;
    }
    try {
      await joinGroup({ data: { id: g.id } });
      toast.success(`Joined ${g.name}`);
      navigate({ to: "/g/$slug", params: { slug: g.slug } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not join.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <Link to="/" className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Home
          </Link>
          <h1 className="font-serif text-2xl text-foreground">Groups</h1>
          <p className="text-xs text-muted-foreground">Standing walks, picked by the people who show up.</p>
        </div>
        {user && (
          <Button onClick={() => setCreating(true)} className="rounded-full bg-forest text-primary-foreground">
            <Plus className="mr-1 h-4 w-4" /> New
          </Button>
        )}
      </header>

      {user && needsDob && <DobPrompt onSaved={(band) => { setAgeBand(band); setNeedsDob(false); }} />}

      {user && (mine.owned.length > 0 || mine.member.length > 0) && (
        <section className="mb-8">
          <h2 className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Your groups</h2>
          <ul className="space-y-2">
            {mine.owned.map((g) => <MineRow key={g.id} g={g} owner />)}
            {mine.member.map((g) => <MineRow key={g.id} g={g} />)}
          </ul>
        </section>
      )}

      <Rail
        title={coords ? "Near you" : "Public groups"}
        subtitle={coords ? "In your area" : "Turn on location to see what's near you"}
        groups={localGroups}
        loading={loading}
        empty="No local public groups yet. Start one?"
        onJoin={onJoin}
      />
      <div className="h-6" />
      <Rail
        title="Global identity groups"
        subtitle="Postpartum walkers, sober strolls, grief & movement…"
        groups={globalGroups}
        loading={loading}
        empty="No global groups yet."
        onJoin={onJoin}
        showGlobeBadge
      />

      {!user && (
        <div className="mt-8 rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center">
          <p className="font-serif text-lg">Want to start a group?</p>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to host standing walks and gather your people.</p>
          <Link to="/auth" className="mt-3 inline-flex rounded-full bg-forest px-4 py-2 text-sm text-primary-foreground">Sign in</Link>
        </div>
      )}

      {user && (
        <Sheet open={creating} onOpenChange={setCreating}>
          <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-3xl">
            <SheetHeader><SheetTitle className="font-serif">New group</SheetTitle></SheetHeader>
            <div className="mt-3 space-y-3">
              <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Sunday morning walkers" maxLength={80} /></Field>
              <Field label="Description (optional)"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Who is this for? Where do you meet?" maxLength={600} /></Field>
              <Field label="Neighborhood (optional)"><Input value={f.neighborhood} onChange={(e) => setF({ ...f, neighborhood: e.target.value })} placeholder="Prospect Heights" maxLength={120} /></Field>

              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Visibility</div>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {(["private", "public"] as const).map((v) => (
                    <button key={v} onClick={() => setF({ ...f, visibility: v })} className={`rounded-2xl border p-3 text-left text-sm transition ${f.visibility === v ? "border-forest bg-forest/5" : "border-border"}`}>
                      <div className="flex items-center gap-2 font-medium">
                        {v === "private" ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                        {v === "private" ? "Private" : "Public"}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{v === "private" ? "Invite-only, no discovery." : "Discoverable in /groups."}</div>
                    </button>
                  ))}
                </div>
                {f.visibility === "public" && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">Public groups need a confirmed email, 3+ completed walks, and 14 days on the app.</p>
                )}
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Minimum age</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {AGE_BANDS.map((b) => (
                    <button key={b} onClick={() => setF({ ...f, age_band_min: b })} className={`rounded-full border px-3 py-1 text-xs transition ${f.age_band_min === b ? "border-forest bg-forest text-primary-foreground" : "border-border bg-card"}`}>{b}</button>
                  ))}
                </div>
              </div>

              <Button onClick={submit} disabled={!f.name.trim() || busy} className="mt-2 w-full rounded-full bg-forest text-primary-foreground">
                {busy ? "Creating…" : "Create group"}
              </Button>
              {ageBand && <p className="text-center text-[11px] text-muted-foreground">Your age band: {ageBand}</p>}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

function MineRow({ g, owner }: { g: MineGroup; owner?: boolean }) {
  return (
    <li>
      <Link to="/g/$slug" params={{ slug: g.slug }} className="block rounded-2xl border border-border bg-card p-3 shadow-soft transition hover:bg-accent/30">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {g.visibility === "public" ? <Globe className="h-3 w-3 text-muted-foreground" /> : <Lock className="h-3 w-3 text-muted-foreground" />}
              <span className="truncate font-medium">{g.name}</span>
              {owner && <span className="rounded-full bg-forest/10 px-1.5 py-0.5 text-[10px] text-forest">host</span>}
            </div>
            {g.neighborhood && <div className="mt-0.5 truncate text-[11px] text-muted-foreground"><MapPin className="mr-0.5 inline h-3 w-3" />{g.neighborhood}</div>}
          </div>
          <Users className="h-4 w-4 text-muted-foreground" />
        </div>
      </Link>
    </li>
  );
}

function Skeleton() {
  return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-card" />)}</div>;
}

function Rail({
  title,
  subtitle,
  groups,
  loading,
  empty,
  onJoin,
  showGlobeBadge,
}: {
  title: string;
  subtitle: string;
  groups: PublicGroup[];
  loading: boolean;
  empty: string;
  onJoin: (g: PublicGroup) => void;
  showGlobeBadge?: boolean;
}) {
  return (
    <section>
      <header className="mb-2">
        <h2 className="font-serif text-base">{title}</h2>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </header>
      {loading ? (
        <Skeleton />
      ) : groups.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">{empty}</div>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={g.id} className="rounded-3xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <Link to="/g/$slug" params={{ slug: g.slug }} className="min-w-0 flex-1">
                  <h3 className="truncate font-serif text-lg">{g.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{g.description || "No description yet."}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {g.neighborhood && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {g.neighborhood}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" /> {g.member_count ?? 0}
                    </span>
                    {showGlobeBadge && (
                      <span className="inline-flex items-center gap-1">
                        <Globe className="h-3 w-3" /> global
                      </span>
                    )}
                  </div>
                </Link>
                <Button onClick={() => onJoin(g)} variant="outline" className="rounded-full text-xs">Join</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DobPrompt({ onSaved }: { onSaved: (band: string) => void }) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const save = async () => {
    if (!v || busy) return;
    setBusy(true);
    try {
      const r = await setMyDob({ data: { dob: v } });
      toast.success("Age confirmed.");
      onSaved(r.age_band);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mb-5 rounded-3xl border border-border bg-card p-4 shadow-soft">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">One-time check</div>
      <p className="mt-1 text-sm">Confirm your date of birth so groups can enforce their age floor. Only your age band (e.g. 25+) is ever shown.</p>
      <div className="mt-2 flex gap-2">
        <Input type="date" max={today} value={v} onChange={(e) => setV(e.target.value)} />
        <Button onClick={save} disabled={!v || busy} className="rounded-full bg-forest text-primary-foreground">{busy ? "…" : "Save"}</Button>
      </div>
    </div>
  );
}
