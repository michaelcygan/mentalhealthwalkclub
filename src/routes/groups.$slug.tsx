import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Footprints, Users, CalendarPlus, Headphones, MapPin, Heart, Sparkles, Award, ChevronDown, Share2 } from "lucide-react";
import { toast } from "sonner";
import { GroupPulse } from "@/components/group-pulse";
import { useGroupActions } from "@/hooks/use-group-actions";
import { share, haptics } from "@/lib/device";

const GroupLiveMap = lazy(() => import("@/components/group-live-map"));

export const Route = createFileRoute("/groups/$slug")({
  component: GroupDetail,
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Mental Health Walk Club group` },
      { name: "description", content: "A quiet affinity group on Mental Health Walk Club. Walks, Walk & Talks, and Local meetups for people who get it." },
      { property: "og:title", content: `Join the ${params.slug.replace(/-/g, " ")} walking group` },
      { property: "og:description", content: "Find your people on Mental Health Walk Club — by city, by theme, by feeling." },
      { property: "og:type", content: "website" },
    ],
  }),
});

interface Group { id: string; name: string; description: string | null; member_count: number; city: string | null; theme: string | null; owner_user_id: string | null; }
interface Event { id: string; title: string; slug: string; starts_at: string; city: string | null; event_type: string; }
interface Room { id: string; title: string; theme: string | null; current_participant_count: number; max_participants: number; }
interface Milestone { badgeId: string; name: string; description: string | null; icon: string | null; key: string; recipients: { userId: string; awardId: string }[] }

function GroupDetail() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const { requireAuth } = useAuthPrompt();
  const { startSoloWalk, toggleJoin, busy } = useGroupActions();
  const [group, setGroup] = useState<Group | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [walkersWeek, setWalkersWeek] = useState(0);
  const [walksWeek, setWalksWeek] = useState(0);
  const [minutesWeek, setMinutesWeek] = useState(0);
  const [newMembers, setNewMembers] = useState(0);
  const [activeNow, setActiveNow] = useState(0);
  const [walksToday, setWalksToday] = useState(0);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [welcomedKey, setWelcomedKey] = useState<string | null>(null);
  const [kudosSent, setKudosSent] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancel = false;
    let cleanup: (() => void) | undefined;
    (async () => {
      const { data: g } = await supabase.from("groups").select("id,name,description,member_count,city,theme,owner_user_id").eq("slug", slug).single();
      if (!g || cancel) return;
      setGroup(g);
      const now = new Date().toISOString();
      const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const dayIso = startOfDay.toISOString();
      const [{ data: e }, { data: r }, { data: w }, { data: nm }, { count: actCount }, { count: todayCount }, mem] = await Promise.all([
        supabase.from("events").select("id,title,slug,starts_at,city,event_type").eq("group_id", g.id).eq("status", "published").gte("starts_at", now).order("starts_at").limit(10),
        supabase.from("audio_rooms").select("id,title,theme,current_participant_count,max_participants").eq("group_id", g.id).eq("status","open").is("parent_room_id", null),
        supabase.from("walk_sessions").select("user_id,duration_seconds").eq("group_id", g.id).eq("status","completed").gte("started_at", weekAgo),
        supabase.from("group_memberships").select("user_id").eq("group_id", g.id).gte("joined_at", weekAgo),
        supabase.from("walk_sessions").select("id", { count: "exact", head: true }).eq("group_id", g.id).eq("status", "active"),
        supabase.from("walk_sessions").select("id", { count: "exact", head: true }).eq("group_id", g.id).eq("status", "completed").gte("started_at", dayIso),
        user ? supabase.from("group_memberships").select("id").eq("group_id", g.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null } as { data: unknown }),
      ]);
      if (cancel) return;
      setEvents(e ?? []);
      setRooms(r ?? []);
      const walks = w ?? [];
      setWalksWeek(walks.length);
      setMinutesWeek(Math.round(walks.reduce((s, x) => s + (x.duration_seconds ?? 0), 0) / 60));
      setWalkersWeek(new Set(walks.map((x) => x.user_id)).size);
      setNewMembers((nm ?? []).length);
      setActiveNow(actCount ?? 0);
      setWalksToday(todayCount ?? 0);
      setIsMember(!!mem?.data);

      // Realtime: refresh ambient counts on walk_sessions changes for this group
      const channel = supabase
        .channel(`group-presence-${g.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "walk_sessions", filter: `group_id=eq.${g.id}` }, async () => {
          const [{ count: a }, { count: t }] = await Promise.all([
            supabase.from("walk_sessions").select("id", { count: "exact", head: true }).eq("group_id", g.id).eq("status", "active"),
            supabase.from("walk_sessions").select("id", { count: "exact", head: true }).eq("group_id", g.id).eq("status", "completed").gte("started_at", dayIso),
          ]);
          setActiveNow(a ?? 0); setWalksToday(t ?? 0);
        })
        .subscribe();
      cleanup = () => { supabase.removeChannel(channel); };

      // Milestones
      try {
        const since = new Date(Date.now() - 14 * 86400_000).toISOString();
        const { data: gw } = await supabase.from("walk_sessions").select("id,user_id").eq("group_id", g.id).eq("status", "completed").gte("started_at", since);
        const wIds = (gw ?? []).map((x) => x.id);
        if (wIds.length) {
          const { data: ub } = await supabase.from("user_badges").select("id,user_id,badge_id,earned_at,walk_session_id").in("walk_session_id", wIds).order("earned_at", { ascending: false });
          const byBadge = new Map<string, { badgeId: string; recipients: { userId: string; awardId: string }[] }>();
          (ub ?? []).forEach((b) => {
            const v = byBadge.get(b.badge_id) ?? { badgeId: b.badge_id, recipients: [] };
            if (!v.recipients.find((r) => r.userId === b.user_id)) v.recipients.push({ userId: b.user_id, awardId: b.id });
            byBadge.set(b.badge_id, v);
          });
          const bIds = Array.from(byBadge.keys());
          if (bIds.length) {
            const { data: defs } = await supabase.from("badge_definitions").select("id,name,description,icon,key").in("id", bIds);
            if (cancel) return;
            setMilestones(((defs ?? []) as { id: string; name: string; description: string | null; icon: string | null; key: string }[]).map((d) => {
              const v = byBadge.get(d.id)!;
              return { badgeId: d.id, name: d.name, description: d.description, icon: d.icon, key: d.key, recipients: v.recipients };
            }));
          }
        }
      } catch { /* anon ok */ }
    })();
    return () => { cancel = true; cleanup?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, user?.id]);

  const onWelcome = () => requireAuth(async () => {
    if (!group || !user) return;
    try {
      const since = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { data: nm } = await supabase.from("group_memberships").select("user_id").eq("group_id", group.id).gte("joined_at", since);
      const recipients = (nm ?? []).map((r) => r.user_id).filter((id) => id && id !== user.id);
      if (recipients.length === 0) { toast("No new walkers this week"); return; }
      const today = new Date().toISOString().slice(0, 10);
      const { data: existing } = await supabase.from("group_signals").select("recipient_user_id").eq("sender_user_id", user.id).eq("group_id", group.id).eq("kind", "welcome").gte("created_at", today);
      const already = new Set((existing ?? []).map((x) => x.recipient_user_id));
      const fresh = recipients.filter((r) => !already.has(r));
      if (fresh.length === 0) { setWelcomedKey(group.id); toast("Already sent today"); return; }
      const rows = fresh.map((rid) => ({ group_id: group.id, sender_user_id: user.id, recipient_user_id: rid, kind: "welcome" as const }));
      const { error } = await supabase.from("group_signals").insert(rows);
      if (error) throw error;
      setWelcomedKey(group.id);
      toast(`Welcomed ${fresh.length} ${fresh.length === 1 ? "walker" : "walkers"}`);
    } catch { toast.error("Couldn't send"); }
  });

  const onKudos = (m: Milestone) => requireAuth(async () => {
    if (!group || !user) return;
    const others = m.recipients.filter((r) => r.userId !== user.id);
    if (others.length === 0) return;
    try {
      const rows = others.map((r) => ({ group_id: group.id, sender_user_id: user.id, recipient_user_id: r.userId, kind: "kudos" as const, badge_id: m.badgeId }));
      const { error } = await supabase.from("group_signals").insert(rows);
      if (error && !/duplicate key/i.test(error.message)) throw error;
      const next = new Set(kudosSent); next.add(m.badgeId); setKudosSent(next);
      toast(`♡ Sent to ${others.length} ${others.length === 1 ? "person" : "people"}`);
    } catch { toast.error("Couldn't send"); }
  });

  if (!group) return <div className="py-20 text-center text-muted-foreground">…</div>;

  const themeGrad: Record<string, string> = {
    anxiety: "from-sky-200/60 to-indigo-200/40",
    burnout: "from-amber-200/60 to-rose-200/40",
    grief: "from-violet-200/60 to-slate-200/40",
    reset: "from-emerald-200/60 to-sage/40",
    quiet: "from-stone-200/60 to-card",
    chapter: "from-teal-200/60 to-emerald-100/40",
    default: "from-emerald-200/60 to-sage/40",
  };
  const grad = themeGrad[group.theme ?? "default"] ?? themeGrad.default;
  const hasCity = !!group.city;

  const ScheduleButtons = ({ size = "sm" }: { size?: "sm" | "md" }) => (
    <div className={`flex flex-wrap gap-2 ${size === "sm" ? "" : "justify-center"}`}>
      {hasCity && (
        <Link to={"/events/new" as never} search={{ group: group.id, mode: "irl" } as never}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:border-forest/40 hover:text-forest transition">
          <MapPin className="h-3.5 w-3.5" /> In person
        </Link>
      )}
      <Link to={"/events/new" as never} search={{ group: group.id, mode: "audio" } as never}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:border-forest/40 hover:text-forest transition">
        <Headphones className="h-3.5 w-3.5" /> Walk & Talk
      </Link>
    </div>
  );

  return (
    <div className="space-y-5">
      <header className={`relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${grad} p-5 shadow-soft md:p-6`}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-card/30 blur-3xl animate-pulse [animation-duration:6s]" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">
            <Users className="h-3 w-3" />{group.member_count.toLocaleString()} walkers
            {walkersWeek > 0 && <> · {walkersWeek} this week</>}
          </div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="mt-2 font-serif text-3xl leading-tight tracking-tight">{group.name}</h1>
            <button
              onClick={async () => {
                haptics.tap();
                const ok = await share({
                  title: `${group.name} — Mental Health Walk Club`,
                  text: group.description ?? "A quiet walking group on Mental Health Walk Club.",
                  url: typeof window !== "undefined" ? window.location.href : undefined,
                });
                if (ok) toast("Invite ready to share.");
              }}
              aria-label="Share group"
              className="mt-2 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-card/70 text-foreground/80 backdrop-blur transition hover:border-forest/40 hover:text-forest"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
          {group.description && <p className="mt-2 max-w-2xl text-sm text-foreground/80">{group.description}</p>}
        </div>
      </header>

      {/* Sticky inline action bar */}
      <div className="sticky top-0 z-10 -mx-4 flex items-center gap-2 border-b border-border/60 bg-background/85 px-4 py-2 backdrop-blur md:static md:mx-0 md:rounded-2xl md:border md:bg-card/60 md:px-3">
        <Button onClick={() => startSoloWalk(group)} disabled={busy} size="sm" className="rounded-full bg-forest text-primary-foreground hover:opacity-90">
          <Footprints className="mr-1.5 h-4 w-4" /> {busy ? "Starting…" : "Walk now"}
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <button className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:border-forest/40">
              <CalendarPlus className="h-4 w-4" /> Schedule <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-2">
            <ScheduleButtons />
          </PopoverContent>
        </Popover>
        {(activeNow > 0 || walksToday > 0) && (
          <div className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {activeNow > 0 && (
              <>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest/60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-forest" />
                </span>
                <span><span className="font-medium text-foreground">{activeNow}</span> walking now</span>
              </>
            )}
            {activeNow > 0 && walksToday > 0 && <span className="opacity-50">·</span>}
            {walksToday > 0 && <span>{walksToday} today</span>}
          </div>
        )}
      </div>

      <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-secondary/60" />}>
        <GroupLiveMap groupId={group.id} onStartWalk={() => startSoloWalk(group)} />
      </Suspense>

      <GroupPulse walks={walksWeek} minutes={minutesWeek} newMembers={newMembers} />

      {newMembers > 0 && (
        <section className="flex items-center justify-between gap-3 rounded-2xl border border-forest/25 bg-accent/30 p-4">
          <div className="text-sm">
            <span className="font-medium">{newMembers}</span> {newMembers === 1 ? "walker" : "walkers"} joined this week.
            {isMember
              ? <div className="text-xs text-muted-foreground">A quiet welcome lands in their inbox. No reply expected.</div>
              : <div className="text-xs text-muted-foreground">This group is gathering momentum.</div>}
          </div>
          {isMember ? (
            <Button size="sm" onClick={onWelcome} disabled={welcomedKey === group.id} className="shrink-0 rounded-full bg-forest text-primary-foreground hover:opacity-90">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />{welcomedKey === group.id ? "Sent" : "Welcome"}
            </Button>
          ) : (
            <Button size="sm" onClick={() => toggleJoin(group, false, () => setIsMember(true))} className="shrink-0 rounded-full bg-forest text-primary-foreground hover:opacity-90">Join</Button>
          )}
        </section>
      )}

      {milestones.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">
            <Award className="h-3 w-3" /> Quiet wins · last 14 days
          </div>
          {/* Mobile: horizontal snap row */}
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 snap-x snap-mandatory md:mx-0 md:hidden md:px-0">
            {milestones.map((m) => {
              const others = m.recipients.filter((r) => r.userId !== user?.id);
              const sent = kudosSent.has(m.badgeId);
              return (
                <li key={m.badgeId} className="snap-start min-w-[220px] shrink-0 rounded-2xl border border-border bg-card p-3 text-sm">
                  <div className="font-serif text-base leading-tight">{m.name}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{m.recipients.length} {m.recipients.length === 1 ? "earned" : "earned"}</div>
                  {others.length > 0 && (
                    <button onClick={() => onKudos(m)} disabled={sent}
                      className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition ${sent ? "border-forest/40 bg-forest/10 text-forest" : "border-border bg-card hover:border-forest/40 hover:text-forest"}`}>
                      <Heart className={`h-3 w-3 ${sent ? "fill-forest text-forest" : ""}`} />
                      {sent ? "Sent" : others.length === 1 ? "Congrats" : `Congrats · ${others.length}`}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {/* Desktop: stacked */}
          <ul className="hidden space-y-2 md:block">
            {milestones.map((m) => {
              const others = m.recipients.filter((r) => r.userId !== user?.id);
              const sent = kudosSent.has(m.badgeId);
              const includesYou = m.recipients.some((r) => r.userId === user?.id);
              return (
                <li key={m.badgeId} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {m.recipients.length === 1 ? (includesYou ? "You earned " : "Someone earned ") : `${m.recipients.length} people earned `}
                      <span className="font-serif">{m.name}</span>
                    </div>
                    {m.description && <div className="line-clamp-1 text-xs text-muted-foreground">{m.description}</div>}
                  </div>
                  {others.length > 0 && (
                    <button onClick={() => onKudos(m)} disabled={sent}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition ${sent ? "border-forest/40 bg-forest/10 text-forest" : "border-border bg-card hover:border-forest/40 hover:text-forest"}`}>
                      <Heart className={`h-3.5 w-3.5 ${sent ? "fill-forest text-forest" : ""}`} />
                      {sent ? "Sent" : others.length === 1 ? "Congrats" : `Congrats · ${others.length}`}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-xl">Upcoming walks</h2>
          <div className="hidden md:block"><ScheduleButtons /></div>
        </div>
        {events.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">Nothing on the calendar. <span className="text-foreground">Start one</span> — others can quietly join.</p>
            <div className="mt-3 flex justify-center"><ScheduleButtons size="md" /></div>
          </div>
        ) : (
          <>
            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {events.map((e) => (
                <li key={e.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {e.event_type === "audio_walk" ? <><Headphones className="h-3 w-3" /> Audio</> : <><MapPin className="h-3 w-3" /> In person</>}
                  </div>
                  <Link to={"/events/$slug" as never} params={{ slug: e.slug } as never} className="font-medium hover:text-forest">{e.title}</Link>
                  <div className="text-xs text-muted-foreground">{new Date(e.starts_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}{e.city ? ` · ${e.city}` : ""}</div>
                </li>
              ))}
            </ul>
            <div className="mt-3 md:hidden"><ScheduleButtons /></div>
          </>
        )}
      </section>

      {rooms.length > 0 && (
        <section>
          <h2 className="font-serif text-xl">Live now</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {rooms.map((r) => (
              <li key={r.id} className="inline-flex items-center gap-2 rounded-full border border-forest/30 bg-forest/8 px-3 py-1.5 text-xs">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest/60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-forest" />
                </span>
                <span className="font-medium">{r.title}</span>
                <span className="text-forest/70">{r.current_participant_count}/{r.max_participants}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
