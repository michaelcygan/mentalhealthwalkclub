import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Footprints, Headphones, MapPin, Mic, Sparkles, Check, ChevronRight, Search, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogoStamp } from "@/components/logo-stamp";
import { LocationAutosuggest, type LocationValue } from "@/components/location-autosuggest";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { useEntryFlow, useHasSeenWelcome, getLastAuthMethod, type EntryStep } from "@/hooks/use-entry-flow";
import { haptics } from "@/lib/device";
import { toast } from "sonner";
import heroImg from "@/assets/walk-hero.jpg";
import type { AuthPlan } from "@/components/auth-form";

const THEMES = ["anxiety", "burnout", "grief", "loneliness", "new in town", "quiet", "sunday reset", "general wellness"];
const COMFORT = [
  ["listener", "Listener", "I'd rather just listen."],
  ["sometimes_speak", "Sometimes", "Chime in when it feels right."],
  ["talker", "Talker", "Comfortable on voice."],
] as const;

interface Props {
  /** When true, the user is signed-in and we skip slide 0 (welcome) */
  startAtOnboarding?: boolean;
  /** Called when the user completes (or exits) the final slide so the host can swap to the app shell. */
  onCompleted?: () => void;
}

/** Shared chrome: persistent Sign in + Skip onboarding controls visible on every slide. */
function FlowHeader({ step, total, onSignIn, onSkipAll, hideSignIn }: {
  step: number; total: number; onSignIn: () => void; onSkipAll?: () => void; hideSignIn?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-1 pb-4 pt-1">
      <LogoStamp tone="dark" size={36} />
      <div className="flex-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {step > 0 ? `Step ${step} of ${total - 1}` : "Welcome"}
      </div>
      {onSkipAll && (
        <button onClick={onSkipAll} className="text-xs text-muted-foreground underline-offset-4 hover:text-forest hover:underline">
          Skip
        </button>
      )}
      {!hideSignIn && (
        <button
          onClick={onSignIn}
          className="rounded-full border border-forest/30 bg-card/70 px-3 py-1.5 text-xs font-medium text-forest transition hover:bg-card"
        >
          {getLastAuthMethod() ? "Welcome back — Sign in" : "Sign in"}
        </button>
      )}
    </div>
  );
}

export function EntryFlow({ startAtOnboarding, onCompleted }: Props) {
  const { user } = useAuth();
  const { openAuth, openPlusCheckout } = useAuthPrompt();
  const { enter: enterDemo } = useDemoMode();
  const { step, setStep, next, back } = useEntryFlow(startAtOnboarding ? 1 : 0);
  const navigate = useNavigate();

  // If user signs in mid-flow on slide 0, advance to slide 1
  useEffect(() => {
    if (user && step === 0) setStep(1);
  }, [user, step, setStep]);

  const goSignIn = () => openAuth("signin");
  const finishOnboarding = async () => {
    if (user) {
      await supabase.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", user.id);
    }
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("wc_flow_step");
      window.sessionStorage.removeItem("wc_flow_themes");
      window.sessionStorage.removeItem("wc_flow_location");
    }
    onCompleted?.();
  };
  const skipAll = async () => {
    await finishOnboarding();
    setStep(5);
  };

  return (
    <div className="mx-auto max-w-xl">
      <FlowHeader
        step={step}
        total={6}
        onSignIn={goSignIn}
        onSkipAll={user && step > 0 && step < 5 ? skipAll : undefined}
        hideSignIn={!!user}
      />
      <div className="rounded-3xl border border-border bg-card p-6 shadow-elevated md:p-8">
        {step === 0 && (
          <SlideWelcome
            onCreate={(plan) => { if (plan === "plus") openPlusCheckout(); else openAuth("signup", "free"); }}
            onSignIn={goSignIn}
            onPreview={() => { enterDemo(); haptics.tap(); }}
          />
        )}
        {step === 1 && <SlideName onNext={next} onSkip={next} />}
        {step === 2 && <SlideLocation onNext={next} onSkip={next} onBack={back} />}
        {step === 3 && <SlideThemes onNext={next} onSkip={next} onBack={back} />}
        {step === 4 && <SlideGroups onNext={next} onSkip={next} onBack={back} />}
        {step === 5 && (
          <SlideFirstWalk
            onStart={async () => { await finishOnboarding(); navigate({ to: "/" as never, search: { start: "1" } as never }); }}
            onLater={async () => { await finishOnboarding(); navigate({ to: "/" as never }); }}
          />
        )}
      </div>

      {/* Footer: redundant Sign in for signed-out users */}
      {!user && step === 0 && (
        <div className="mt-4 text-center text-xs text-muted-foreground">
          Already a member?{" "}
          <button onClick={goSignIn} className="font-medium text-forest underline-offset-4 hover:underline">
            Sign in
          </button>
        </div>
      )}

      <p className="mt-6 text-center font-serif text-xs italic text-muted-foreground">
        Come as you are. Walk at your pace.
      </p>
    </div>
  );
}

/* ──────────────────────── Slide 0: Welcome ──────────────────────── */

function SlideWelcome({ onCreate, onSignIn, onPreview }: {
  onCreate: (plan: AuthPlan) => void; onSignIn: () => void; onPreview: () => void;
}) {
  const [plan, setPlan] = useState<AuthPlan>("plus");
  const { mark } = useHasSeenWelcome();
  useEffect(() => { mark(); }, [mark]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl">
        <img src={heroImg} alt="A quiet path" className="h-40 w-full object-cover md:h-56" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest/85 via-forest/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-primary-foreground md:p-5">
          <p className="font-serif text-[11px] italic opacity-90">Movement is the medicine. Company is the cure.</p>
          <h1 className="mt-1 font-serif text-2xl leading-tight md:text-3xl">Take the walk. Let it count.</h1>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Four ways to walk</p>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Feature icon={Footprints} title="Solo" body="Track every walk. Mood, route, reflection." />
          <Feature icon={Sparkles} title="Guided" body="A calm voice in your ear when you need it." />
          <Feature icon={Mic} title="Walk & Talk" body="Live audio — only joinable while walking." />
          <Feature icon={MapPin} title="Local Walks" body="In-person meetups in your city." />
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Choose your plan</p>
        <div role="radiogroup" className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <PlanCard name="Free" price="$0" tagline="Walk forever, on the house." selected={plan === "free"} onSelect={() => setPlan("free")}
            items={["Unlimited Solo walks", "Unlimited Guided walks", "5 Walk & Talks / month", "Private route + mood history"]} />
          <PlanCard name="Plus" price="$4.99/mo" highlight tagline="30 days free. Cancel anytime." selected={plan === "plus"} onSelect={() => setPlan("plus")}
            items={["Unlimited Walk & Talks", "RSVP to Local Walks", "Everything in Free", "Early access to chapters"]} />
        </div>
      </div>

      <div className="space-y-2">
        <Button onClick={() => onCreate(plan)} className="h-12 w-full rounded-full bg-forest text-primary-foreground hover:opacity-90">
          {plan === "plus" ? "Start your 1-month free trial" : "Create your free account"}
        </Button>
        <button onClick={onPreview} className="block w-full text-center text-xs italic text-muted-foreground underline-offset-4 hover:text-forest hover:underline">
          Preview the app →
        </button>
        <Button variant="ghost" onClick={onSignIn} className="w-full rounded-full">
          I already have one — sign in
        </Button>
      </div>

      <p className="text-center font-serif text-[11px] italic text-muted-foreground">
        Peer support, not therapy. If you're in crisis, call or text 988.
      </p>
    </div>
  );
}

/* ──────────────────────── Slide 1: Name ──────────────────────── */

function SlideName({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState((user?.user_metadata?.display_name as string) || "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!user) return onNext();
    setBusy(true);
    try {
      if (name.trim()) {
        await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", user.id);
        await supabase.auth.updateUser({ data: { display_name: name.trim() } });
      }
      onNext();
    } finally { setBusy(false); }
  };

  return (
    <SlideShell title="What should we call you?" subtitle="Just a first name is fine." onPrimary={save} primaryLabel="Continue" busy={busy} onSkip={onSkip}>
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-12 rounded-2xl text-base" />
    </SlideShell>
  );
}

/* ──────────────────────── Slide 2: Location ──────────────────────── */

function SlideLocation({ onNext, onSkip, onBack }: { onNext: () => void; onSkip: () => void; onBack: () => void }) {
  const { user } = useAuth();
  const [loc, setLoc] = useState<LocationValue | null>(null);
  const [busy, setBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);

  const useGps = () => {
    if (!navigator.geolocation) { toast.error("Location not available"); return; }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lng } = pos.coords;
          const r = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`);
          const j = await r.json();
          const f = j?.features?.[0];
          if (f) {
            const p = f.properties;
            const city = p.city || p.name || "";
            const region = p.state || null;
            const country = (p.countrycode || p.country || "")?.toUpperCase() || null;
            setLoc({
              city, region, country,
              location_label: [city, region, country].filter(Boolean).join(", "),
              lat, lng,
            });
          }
        } finally { setGpsBusy(false); }
      },
      () => { setGpsBusy(false); toast.error("Couldn't get your location"); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 },
    );
  };

  const save = async () => {
    if (loc && typeof window !== "undefined") {
      window.sessionStorage.setItem("wc_flow_location", JSON.stringify(loc));
    }
    if (!user) return onNext();
    setBusy(true);
    try {
      if (loc) {
        await supabase.from("profiles").update({
          city: loc.city, region: loc.region, country: loc.country,
          location_label: loc.location_label, lat: loc.lat, lng: loc.lng,
        }).eq("id", user.id);
      }
      onNext();
    } finally { setBusy(false); }
  };

  return (
    <SlideShell title="Where are you walking from?" subtitle="We surface Local Walks and chapters near you." onPrimary={save} primaryLabel="Continue" busy={busy} onSkip={onSkip} onBack={onBack}>
      <LocationAutosuggest value={loc} onChange={setLoc} />
      <button
        type="button"
        onClick={useGps}
        disabled={gpsBusy}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-forest underline-offset-4 hover:underline disabled:opacity-60"
      >
        <MapPin className="h-3.5 w-3.5" />
        {gpsBusy ? "Finding you…" : "Use my current location"}
      </button>
    </SlideShell>
  );
}

/* ──────────────────────── Slide 3: Themes + Comfort ──────────────────────── */

function SlideThemes({ onNext, onSkip, onBack }: { onNext: () => void; onSkip: () => void; onBack: () => void }) {
  const { user } = useAuth();
  const [themes, setThemes] = useState<string[]>([]);
  const [comfort, setComfort] = useState<string>("listener");
  const [busy, setBusy] = useState(false);

  const toggle = (v: string) => setThemes((a) => a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);

  const save = async () => {
    if (!user) return onNext();
    setBusy(true);
    try {
      await supabase.from("user_preferences").upsert({
        user_id: user.id, preferred_themes: themes, audio_comfort_level: comfort,
      }, { onConflict: "user_id" });
      // stash for slide 4 ranking without a re-fetch
      if (typeof window !== "undefined") window.sessionStorage.setItem("wc_flow_themes", JSON.stringify(themes));
      onNext();
    } finally { setBusy(false); }
  };

  return (
    <SlideShell title="What's been on your shoulders?" subtitle="Pick anything that fits today. They're quiet tags — they help match you to walks." onPrimary={save} primaryLabel="Continue" busy={busy} onSkip={onSkip} onBack={onBack}>
      <div className="flex flex-wrap gap-2">
        {THEMES.map((t) => (
          <button key={t} type="button" onClick={() => toggle(t)}
            className={`rounded-full border px-4 py-2 text-sm transition ${themes.includes(t) ? "border-forest bg-forest text-primary-foreground" : "border-border bg-card hover:border-forest/40"}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="mt-6 border-t border-border pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">If you join a Walk & Talk…</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {COMFORT.map(([v, label, sub]) => (
            <button key={v} type="button" onClick={() => setComfort(v)}
              className={`rounded-2xl border p-3 text-left transition ${comfort === v ? "border-forest bg-accent" : "border-border bg-card hover:border-forest/40"}`}>
              <div className="text-sm font-medium">{label}</div>
              <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{sub}</div>
            </button>
          ))}
        </div>
      </div>
    </SlideShell>
  );
}

/* ──────────────────────── Slide 4: Suggested groups ──────────────────────── */

interface GroupRow {
  id: string; name: string; slug: string; description: string | null;
  theme: string | null; city: string | null; member_count: number; image_url: string | null;
}

function SlideGroups({ onNext, onSkip, onBack }: { onNext: () => void; onSkip: () => void; onBack: () => void }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const themes = useMemo<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(window.sessionStorage.getItem("wc_flow_themes") || "[]"); } catch { return []; }
  }, []);
  const location = useMemo<LocationValue | null>(() => {
    if (typeof window === "undefined") return null;
    try { return JSON.parse(window.sessionStorage.getItem("wc_flow_location") || "null"); } catch { return null; }
  }, []);

  const SELECT = "id,name,slug,description,theme,city,member_count,image_url";

  // Suggested list (no search): rank by city → region/country → theme → popularity.
  useEffect(() => {
    if (search.trim()) return;
    const queries: PromiseLike<{ data: GroupRow[] | null }>[] = [];
    const city = location?.city?.trim();
    const region = location?.region?.trim();
    const country = location?.country?.trim();
    const run = (b: { then: <T>(r: (v: { data: unknown }) => T) => PromiseLike<T> }) =>
      Promise.resolve(b).then((r) => ({ data: (r.data ?? null) as GroupRow[] | null }));

    if (city) queries.push(run(supabase.from("groups").select(SELECT).eq("is_active", true).ilike("city", city).limit(6)));
    if (region) queries.push(run(supabase.from("groups").select(SELECT).eq("is_active", true).ilike("city", `%${region}%`).limit(6)));
    if (country) queries.push(run(supabase.from("groups").select(SELECT).eq("is_active", true).ilike("city", `%${country}%`).limit(6)));
    if (themes.length) queries.push(run(supabase.from("groups").select(SELECT).eq("is_active", true).in("theme", themes).limit(6)));
    queries.push(run(supabase.from("groups").select(SELECT).eq("is_active", true).order("member_count", { ascending: false }).limit(6)));

    Promise.all(queries).then((results) => {
      const all = new Map<string, GroupRow>();
      for (const r of results) for (const row of (r.data ?? []) as GroupRow[]) all.set(row.id, row);
      const cityLc = city?.toLowerCase();
      const regionLc = region?.toLowerCase();
      const countryLc = country?.toLowerCase();
      const themeSet = new Set(themes);
      const scored = Array.from(all.values()).map((g) => {
        const gCity = (g.city || "").toLowerCase();
        const cityHit = cityLc && gCity === cityLc ? 3 : 0;
        const regionHit = !cityHit && regionLc && gCity.includes(regionLc) ? 2 : 0;
        const countryHit = !cityHit && !regionHit && countryLc && gCity.includes(countryLc) ? 1 : 0;
        const themeHit = g.theme && themeSet.has(g.theme) ? 2 : 0;
        const pop = Math.log((g.member_count ?? 0) + 1) * 0.3;
        return { g, score: cityHit + regionHit + countryHit + themeHit + pop };
      });
      scored.sort((a, b) => b.score - a.score);
      setGroups(scored.slice(0, 6).map((s) => s.g));
    });
  }, [themes, location, search]);

  // Live search overrides suggested list when query present
  useEffect(() => {
    const term = search.trim();
    if (!term) return;
    const t = setTimeout(() => {
      supabase.from("groups").select(SELECT)
        .eq("is_active", true).ilike("name", `%${term}%`).limit(8)
        .then(({ data }) => setGroups((data ?? []) as GroupRow[]));
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const join = async (g: GroupRow) => {
    if (!user) return;
    haptics.tap();
    setJoined((prev) => new Set(prev).add(g.id));
    const { error } = await supabase.from("group_memberships").insert({ user_id: user.id, group_id: g.id });
    if (error && !error.message.includes("duplicate")) {
      toast.error("Couldn't join — try again");
      setJoined((prev) => { const n = new Set(prev); n.delete(g.id); return n; });
    }
  };

  const finish = async () => {
    if (!user) return onNext();
    setBusy(true);
    try { onNext(); } finally { setBusy(false); }
  };

  return (
    <SlideShell title="Find your people" subtitle={joined.size > 0 ? `Joined ${joined.size}. Add more, or continue.` : "Join one to start. You can always change later."} onPrimary={finish} primaryLabel="Continue" busy={busy} onSkip={onSkip} onBack={onBack}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search groups…" className="h-11 rounded-2xl pl-9" />
      </div>
      <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto pr-1">
        {groups.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No groups found. Try a different search, or skip.
          </div>
        )}
        {groups.map((g) => {
          const isJoined = joined.has(g.id);
          return (
            <div key={g.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-forest">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{g.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {g.theme ? `${g.theme} · ` : ""}{g.city || "everywhere"} · {g.member_count} members
                </div>
              </div>
              <Button
                size="sm"
                variant={isJoined ? "secondary" : "default"}
                onClick={() => !isJoined && join(g)}
                className={`shrink-0 rounded-full ${isJoined ? "" : "bg-forest text-primary-foreground hover:opacity-90"}`}
                disabled={isJoined}
              >
                {isJoined ? <><Check className="mr-1 h-3 w-3" /> Joined</> : "Join"}
              </Button>
            </div>
          );
        })}
      </div>
    </SlideShell>
  );
}

/* ──────────────────────── Slide 5: First walk ──────────────────────── */

function SlideFirstWalk({ onStart, onLater }: { onStart: () => void; onLater: () => void }) {
  const [busy, setBusy] = useState<null | "start" | "later">(null);
  const tap = (which: "start" | "later") => {
    if (busy) return;
    setBusy(which);
    haptics.tap();
    if (which === "start") onStart(); else onLater();
  };

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent">
        <Footprints className="h-7 w-7 text-forest" />
      </div>
      <div>
        <h2 className="font-serif text-3xl">You're set.</h2>
        <p className="mt-2 text-muted-foreground">Take your first walk?</p>
      </div>
      <div className="space-y-2">
        <Button onClick={() => tap("start")} disabled={!!busy} className="breathe h-14 w-full rounded-2xl bg-forest text-base text-primary-foreground hover:opacity-90">
          <Footprints className="mr-2 h-5 w-5" />
          {busy === "start" ? "One moment…" : "Start a walk"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <button onClick={() => tap("later")} disabled={!!busy} className="block w-full text-center text-sm italic text-muted-foreground hover:text-forest disabled:opacity-60">
          {busy === "later" ? "One moment…" : "Maybe later — go home"}
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────── Shared shell ──────────────────────── */

function SlideShell({ title, subtitle, children, onPrimary, primaryLabel, busy, onSkip, onBack }: {
  title: string; subtitle?: string; children: React.ReactNode;
  onPrimary: () => void; primaryLabel: string; busy?: boolean;
  onSkip?: () => void; onBack?: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl text-balance md:text-3xl">{title}</h2>
        {subtitle && <p className="mt-2 text-sm text-muted-foreground text-pretty">{subtitle}</p>}
      </div>
      <div>{children}</div>
      <div className="flex items-center justify-between gap-3 pt-2">
        {onBack ? (
          <Button variant="ghost" onClick={onBack} className="rounded-full text-muted-foreground">Back</Button>
        ) : <span />}
        <div className="flex items-center gap-3">
          {onSkip && (
            <button onClick={onSkip} className="text-sm italic text-muted-foreground underline-offset-4 hover:text-forest hover:underline">
              Skip
            </button>
          )}
          <Button onClick={onPrimary} disabled={busy} className="breathe rounded-full bg-forest px-6 text-primary-foreground hover:opacity-90">
            {busy ? "One moment…" : primaryLabel}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────── Welcome bits ──────────────────────── */

function Feature({ icon: Icon, title, body }: { icon: typeof Footprints; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
        <Icon className="h-4 w-4 text-forest" />
      </div>
      <h3 className="mt-2 text-sm font-medium text-foreground">{title}</h3>
      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{body}</p>
    </div>
  );
}

function PlanCard({ name, price, tagline, items, highlight, selected, onSelect }: {
  name: string; price: string; tagline: string; items: string[]; highlight?: boolean; selected: boolean; onSelect: () => void;
}) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onSelect}
      className={`relative rounded-2xl border p-4 text-left transition ${
        selected
          ? highlight ? "border-forest bg-accent/60 ring-2 ring-forest/40" : "border-forest bg-card ring-2 ring-forest/40"
          : highlight ? "border-border bg-accent/30 hover:border-forest/40" : "border-border bg-card/60 hover:border-forest/40"
      }`}>
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-1.5 font-serif text-base font-medium text-foreground">
          {highlight && <Sparkles className="h-3.5 w-3.5 text-forest" />}{name}
        </span>
        <span className="text-sm font-semibold text-foreground">{price}</span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{tagline}</p>
      <ul className="mt-3 space-y-1.5">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-1.5 text-[12px] leading-snug text-foreground/80">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-forest" /><span>{it}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}
