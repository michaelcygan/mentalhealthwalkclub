import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { getWalkByCode } from "@/lib/walk-page.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import WalkWeather from "@/components/walk-page/walk-weather";
import { toast } from "sonner";

const WalkMap = lazy(() => import("@/components/walk-page/walk-map"));

export const Route = createFileRoute("/w/$code")({
  loader: async ({ params }) => {
    const data = await getWalkByCode({ data: { code: params.code } });
    if (!data.event) throw notFound();
    return data;
  },
  head: ({ params }) => ({
    meta: [
      { title: `walk · ${params.code} · Mental Health Walk Club` },
      { name: "description", content: "Quiet walk, real people. RSVP and join the club." },
      { property: "og:title", content: `Walk · ${params.code}` },
      { property: "og:description", content: "Quiet walk, real people. RSVP and join the club." },
    ],
  }),
  errorComponent: ({ error }) => (
    <Centered>
      <h1 className="font-serif text-2xl">Couldn't load this walk</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <Link to="/" className="mt-5 inline-flex rounded-full bg-forest px-5 py-2 text-sm text-primary-foreground">Go to the club</Link>
    </Centered>
  ),
  notFoundComponent: () => (
    <Centered>
      <h1 className="font-serif text-2xl">Walk not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">It may have been removed, made private, or never existed.</p>
      <Link to="/" className="mt-5 inline-flex rounded-full bg-forest px-5 py-2 text-sm text-primary-foreground">Go to the club</Link>
    </Centered>
  ),
  component: WalkPage,
});

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md">{children}</div>
    </div>
  );
}

type RsvpStatus = "going" | "interested" | "cant_go";

function WalkPage() {
  const { code } = Route.useParams();
  const { event, host } = Route.useLoaderData();
  if (!event) return null;

  const lat = event.lat != null ? Number(event.lat) : null;
  const lng = event.lng != null ? Number(event.lng) : null;
  const hasMap = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 pb-24 pt-6">
      <Link to="/" className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">← Mental Health Walk Club</Link>

      <Cover event={event} />

      <header className="mt-5">
        <h1 className="font-serif text-3xl leading-tight">{event.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDate(event.starts_at, event.timezone)}
          {event.venue_name ? ` · ${event.venue_name}` : ""}
          {event.city ? `, ${event.city}` : ""}
        </p>
        {host?.display_name ? (
          <p className="mt-1 text-xs text-muted-foreground">Hosted by {host.display_name}</p>
        ) : null}
      </header>

      {event.description ? (
        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">
          {event.description}
        </p>
      ) : null}

      <RsvpRow eventId={event.id} attendeeCount={event.attendee_count} code={code} />

      {hasMap ? (
        <section className="mt-6 space-y-3">
          <Suspense fallback={<div className="h-72 w-full animate-pulse rounded-3xl bg-muted" />}>
            <WalkMap lat={lat!} lng={lng!} title={event.title} venue={event.venue_name} />
          </Suspense>
          {event.meeting_point ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Meet at:</span> {event.meeting_point}
            </p>
          ) : null}
        </section>
      ) : (
        <section className="mt-6 rounded-3xl border border-dashed border-border bg-card/40 p-5 text-sm text-muted-foreground">
          The host hasn't dropped a pin yet. {event.city ? `Plan to be in ${event.city}.` : ""}
        </section>
      )}

      {hasMap ? (
        <section className="mt-6 space-y-2">
          <SectionLabel>Forecast around walk time</SectionLabel>
          <WalkWeather lat={lat!} lng={lng!} centerIso={event.starts_at} />
        </section>
      ) : null}

      {event.accessibility_notes ? (
        <section className="mt-6 rounded-2xl border border-border bg-card/60 p-4 text-sm">
          <SectionLabel>Accessibility</SectionLabel>
          <p className="mt-1 text-foreground/85">{event.accessibility_notes}</p>
        </section>
      ) : null}

      <JoinClub />
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{children}</p>;
}

function Cover({ event }: { event: { image_url: string | null; city: string | null; vibe: string | null } }) {
  if (event.image_url) {
    return (
      <div className="mt-4 overflow-hidden rounded-3xl border border-border">
        <img src={event.image_url} alt="" className="h-48 w-full object-cover sm:h-60" loading="lazy" />
      </div>
    );
  }
  return (
    <div className="mt-4 flex h-40 items-end overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-forest/30 via-clay/20 to-cream p-5 sm:h-52">
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{event.vibe ?? "quiet walk"}</div>
        <div className="font-serif text-2xl text-foreground/85">{event.city ?? "Somewhere outside"}</div>
      </div>
    </div>
  );
}

function RsvpRow({ eventId, attendeeCount }: { eventId: string; attendeeCount: number; code: string }) {
  const { user } = useAuth();
  const { requireAuth } = useAuthPrompt();
  const [my, setMy] = useState<RsvpStatus | null>(null);
  const [count, setCount] = useState(attendeeCount);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) { setMy(null); return; }
    let cancel = false;
    supabase.from("event_rsvps").select("status").eq("event_id", eventId).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (!cancel) setMy((data?.status as RsvpStatus | undefined) ?? null); });
    return () => { cancel = true; };
  }, [eventId, user]);

  const set = (next: RsvpStatus) => requireAuth(async () => {
    if (!user || busy) return;
    setBusy(true);
    const prev = my;
    setMy(next);
    if (prev !== "going" && next === "going") setCount((n) => n + 1);
    if (prev === "going" && next !== "going") setCount((n) => Math.max(0, n - 1));
    const { error } = await supabase
      .from("event_rsvps")
      .upsert({ event_id: eventId, user_id: user.id, status: next }, { onConflict: "event_id,user_id" });
    setBusy(false);
    if (error) {
      setMy(prev);
      setCount(attendeeCount);
      toast.error(error.message);
      return;
    }
    toast.success(
      next === "going" ? "You're in. See you out there." :
      next === "interested" ? "Saved as interested." :
      "Marked can't go."
    );
  });

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card p-4 shadow-soft">
      <SectionLabel>RSVP</SectionLabel>
      <p className="mt-1 text-sm text-muted-foreground">
        {count === 0 ? "Be the first to say you're in." : count === 1 ? "1 walker is going." : `${count} walkers are going.`}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <RsvpBtn label="I'm in" active={my === "going"} disabled={busy} onClick={() => set("going")} variant="primary" />
        <RsvpBtn label="Interested" active={my === "interested"} disabled={busy} onClick={() => set("interested")} />
        <RsvpBtn label="Can't go" active={my === "cant_go"} disabled={busy} onClick={() => set("cant_go")} />
      </div>
    </section>
  );
}

function RsvpBtn({ label, active, disabled, onClick, variant }: {
  label: string; active: boolean; disabled: boolean; onClick: () => void; variant?: "primary";
}) {
  const base = "rounded-full px-3 py-2 text-sm transition active:scale-[0.98] disabled:opacity-50";
  if (variant === "primary") {
    return (
      <button onClick={onClick} disabled={disabled}
        className={`${base} ${active ? "bg-forest text-primary-foreground ring-2 ring-forest/40" : "bg-forest text-primary-foreground hover:opacity-90"}`}>
        {active ? "✓ " : ""}{label}
      </button>
    );
  }
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${base} border ${active ? "border-forest bg-forest/10 text-forest" : "border-border bg-background hover:bg-accent/40"}`}>
      {active ? "✓ " : ""}{label}
    </button>
  );
}

function JoinClub() {
  const { user } = useAuth();
  const { openAuth } = useAuthPrompt();
  if (user) return null;
  return (
    <section className="mt-10 rounded-3xl border border-border bg-cream/60 p-5 text-center">
      <p className="font-serif text-xl">Join the club</p>
      <p className="mt-1 text-sm text-muted-foreground">Save your walks, RSVP in one tap, find walks near you.</p>
      <button
        onClick={() => openAuth("signup")}
        className="mt-4 inline-flex rounded-full bg-forest px-5 py-2 text-sm text-primary-foreground hover:opacity-90"
      >
        Sign up — it's free
      </button>
    </section>
  );
}

function formatDate(iso: string, tz?: string | null) {
  try {
    return new Date(iso).toLocaleString([], {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
      timeZone: tz ?? undefined,
    });
  } catch {
    return iso;
  }
}
