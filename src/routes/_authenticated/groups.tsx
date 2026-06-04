import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Globe, Lock, Users, MapPin, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  listMyGroups,
  createGroup,
  discoverPublicGroups,
  joinGroup,
  getMyAgeBand,
  setMyDob,
} from "@/lib/groups.functions";

export const Route = createFileRoute("/_authenticated/groups")({
  component: GroupsPage,
  head: () => ({
    meta: [
      { title: "Groups — Mental Health Walk Club" },
      { name: "description", content: "Find local walking groups and host your own." },
    ],
  }),
});

type Group = {
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
type Public = Group & { miles?: number | null };

const AGE_BANDS = ["18+", "21+", "25+", "40+", "65+"] as const;

function GroupsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"mine" | "discover">("discover");
  const [mine, setMine] = useState<{ owned: Group[]; member: Group[] }>({ owned: [], member: [] });
  const [pub, setPub] = useState<Public[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"local" | "global">("local");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [creating, setCreating] = useState(false);
  const [ageBand, setAgeBand] = useState<string | null>(null);
  const [needsDob, setNeedsDob] = useState(false);

  // form
  const [f, setF] = useState({
    name: "",
    description: "",
    visibility: "private" as "private" | "public",
    age_band_min: "18+" as (typeof AGE_BANDS)[number],
    neighborhood: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const ab = await getMyAgeBand();
      setAgeBand(ab.age_band);
      setNeedsDob(!ab.has_dob);
    })();
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { maximumAge: 60_000, timeout: 4_000 },
    );
  }, []);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [m, p] = await Promise.all([
        listMyGroups(),
        discoverPublicGroups({ data: { lat: coords?.lat ?? null, lng: coords?.lng ?? null, scope } }),
      ]);
      setMine(m);
      setPub(p.groups);
      setLoading(false);
    })();
  }, [coords, scope]);

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
      navigate({ to: "/groups/$slug", params: { slug: row.slug } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create.");
    } finally {
      setBusy(false);
    }
  };

  const onJoin = async (g: Public) => {
    try {
      await joinGroup({ data: { id: g.id } });
      toast.success(`Joined ${g.name}`);
      navigate({ to: "/groups/$slug", params: { slug: g.slug } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not join.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <Link to="/profile" className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Profile
          </Link>
          <h1 className="font-serif text-2xl text-foreground">Groups</h1>
          <p className="text-xs text-muted-foreground">Standing walks, picked by the people who show up.</p>
        </div>
        <Button onClick={() => setCreating(true)} className="rounded-full bg-forest text-primary-foreground">
          <Plus className="mr-1 h-4 w-4" /> New
        </Button>
      </header>

      {needsDob && <DobPrompt onSaved={(band) => { setAgeBand(band); setNeedsDob(false); }} />}

      <div className="mb-4 flex gap-1 rounded-full border border-border bg-card p-1 text-xs">
        {(["discover", "mine"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-3 py-1.5 capitalize transition ${tab === t ? "bg-forest text-primary-foreground" : "text-muted-foreground"}`}
          >
            {t === "mine" ? "Mine" : "Discover"}
          </button>
        ))}
      </div>

      {tab === "discover" && (
        <>
          <div className="mb-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{coords ? `Within 25mi · ${scope}` : `Showing ${scope} public groups`}</span>
            <button onClick={() => setScope((s) => (s === "local" ? "global" : "local"))} className="text-forest underline">
              {scope === "local" ? "Show global" : "Show local"}
            </button>
          </div>
          {loading ? <Skeleton /> : pub.length === 0 ? (
            <Empty title="No groups yet" body="Be the first to start one near you." />
          ) : (
            <ul className="space-y-3">
              {pub.map((g) => (
                <li key={g.id} className="rounded-3xl border border-border bg-card p-4 shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <Link to="/groups/$slug" params={{ slug: g.slug }} className="min-w-0 flex-1">
                      <h3 className="truncate font-serif text-lg">{g.name}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{g.description || "No description yet."}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        {g.neighborhood && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{g.neighborhood}</span>}
                        {g.miles != null && <span>· {g.miles.toFixed(1)} mi</span>}
                        {g.scope === "global" && <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" /> global</span>}
                      </div>
                    </Link>
                    <Button onClick={() => onJoin(g)} variant="outline" className="rounded-full text-xs">Join</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "mine" && (
        <>
          {loading ? <Skeleton /> : (mine.owned.length === 0 && mine.member.length === 0) ? (
            <Empty title="No groups yet" body="Create one to schedule a standing walk." />
          ) : (
            <div className="space-y-5">
              {mine.owned.length > 0 && <Section title="Hosting">{mine.owned.map((g) => <Row key={g.id} g={g} owner />)}</Section>}
              {mine.member.length > 0 && <Section title="Joined">{mine.member.map((g) => <Row key={g.id} g={g} />)}</Section>}
            </div>
          )}
        </>
      )}

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{title}</h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function Row({ g, owner }: { g: Group; owner?: boolean }) {
  return (
    <li>
      <Link to="/groups/$slug" params={{ slug: g.slug }} className="block rounded-2xl border border-border bg-card p-3 shadow-soft transition hover:bg-accent/30">
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

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
      <p className="font-serif text-lg">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Skeleton() {
  return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-card" />)}</div>;
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
