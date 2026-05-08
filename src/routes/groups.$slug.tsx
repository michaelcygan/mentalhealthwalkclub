import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { Button } from "@/components/ui/button";
import { Footprints, Users, CalendarPlus, Headphones, MapPin, Heart, Sparkles, Award } from "lucide-react";
import { toast } from "sonner";
import { GroupPulse } from "@/components/group-pulse";
import { sendGroupWelcome, sendKudos, getGroupMilestones } from "@/lib/group-signals.functions";

export const Route = createFileRoute("/groups/$slug")({ component: GroupDetail });

interface Group { id: string; name: string; description: string | null; member_count: number; city: string | null; theme: string | null; owner_user_id: string | null; }
interface Event { id: string; title: string; slug: string; starts_at: string; city: string | null; event_type: string; }
interface Room { id: string; title: string; theme: string | null; current_participant_count: number; max_participants: number; }
interface Milestone { badgeId: string; name: string; description: string | null; icon: string | null; key: string; recipients: { userId: string; awardId: string }[] }

function GroupDetail() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const { requireAuth } = useAuthPrompt();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [walkersWeek, setWalkersWeek] = useState(0);
  const [walksWeek, setWalksWeek] = useState(0);
  const [minutesWeek, setMinutesWeek] = useState(0);
  const [newMembers, setNewMembers] = useState(0);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [busy, setBusy] = useState(false);
  const [welcomedKey, setWelcomedKey] = useState<string | null>(null);
  const [kudosSent, setKudosSent] = useState<Set<string>>(new Set());

  const callMilestones = useServerFn(getGroupMilestones);
  const callWelcome = useServerFn(sendGroupWelcome);
  const callKudos = useServerFn(sendKudos);

  useEffect(() => {
    (async () => {
      const { data: g } = await supabase.from("groups").select("id,name,description,member_count,city,theme,owner_user_id").eq("slug", slug).single();
      if (!g) return;
      setGroup(g);
      const now = new Date().toISOString();
      const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
      const [{ data: e }, { data: r }, { data: w }, { data: nm }] = await Promise.all([
        supabase.from("events").select("id,title,slug,starts_at,city,event_type").eq("group_id", g.id).eq("status", "published").gte("starts_at", now).order("starts_at").limit(10),
        supabase.from("audio_rooms").select("id,title,theme,current_participant_count,max_participants").eq("group_id", g.id).eq("status","open").is("parent_room_id", null),
        supabase.from("walk_sessions").select("user_id,duration_seconds").eq("group_id", g.id).eq("status","completed").gte("started_at", weekAgo),
        supabase.from("group_memberships").select("user_id").eq("group_id", g.id).gte("joined_at", weekAgo),
      ]);
      setEvents(e ?? []);
      setRooms(r ?? []);
      const walks = w ?? [];
      setWalksWeek(walks.length);
      setMinutesWeek(Math.round(walks.reduce((s, x) => s + (x.duration_seconds ?? 0), 0) / 60));
      setWalkersWeek(new Set(walks.map((x) => x.user_id)).size);
      setNewMembers((nm ?? []).length);

      try { const m = await callMilestones({ data: { groupId: g.id } }); setMilestones(m.milestones as Milestone[]); } catch {/* anon ok */}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const walkWithGroup = () => requireAuth(async () => {
    if (!user || !group) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.from("walk_sessions").insert({
        user_id: user.id, walk_type: "solo", status: "active", group_id: group.id,
      }).select("id").single();
      if (error) throw error;
      navigate({ to: "/walk/active/$id" as never, params: { id: data.id } as never });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start walk");
    } finally { setBusy(false); }
  });

  const onWelcome = () => requireAuth(async () => {
    if (!group) return;
    try {
      const r = await callWelcome({ data: { groupId: group.id } });
      setWelcomedKey(group.id);
      toast(r.sent > 0 ? `Welcomed ${r.sent} ${r.sent === 1 ? "walker" : "walkers"}` : "Already sent today");
    } catch { toast.error("Couldn't send"); }
  });

  const onKudos = (m: Milestone) => requireAuth(async () => {
    if (!group) return;
    const others = m.recipients.filter((r) => r.userId !== user?.id);
    if (others.length === 0) return;
    try {
      await Promise.all(others.map((r) => callKudos({ data: { groupId: group.id, recipientUserId: r.userId, badgeId: m.badgeId } })));
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
  const isHost = !!user && group.owner_user_id === user.id;

  return (
    <div className="space-y-6">
      <header className={`relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${grad} p-5 shadow-soft md:p-6`}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-card/30 blur-3xl animate-pulse [animation-duration:6s]" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">
            <Users className="h-3 w-3" />{group.member_count.toLocaleString()} walkers
            {walkersWeek > 0 && <> · {walkersWeek} this week</>}
          </div>
          <h1 className="mt-2 font-serif text-3xl leading-tight">{group.name}</h1>
          {group.description && <p className="mt-2 max-w-2xl text-sm text-foreground/80">{group.description}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={walkWithGroup} disabled={busy} className="rounded-full bg-forest text-primary-foreground hover:opacity-90">
              <Footprints className="mr-2 h-4 w-4" /> {busy ? "Starting…" : "Walk with this group"}
            </Button>
            {isHost && (
              <Link to={"/events/new" as never} search={{ group: group.id, mode: "audio" } as never} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm hover:border-forest/40">
                <CalendarPlus className="h-4 w-4" /> Schedule a walk
              </Link>
            )}
          </div>
        </div>
      </header>

      <GroupPulse walks={walksWeek} minutes={minutesWeek} newMembers={newMembers} />

      {newMembers > 0 && (
        <section className="flex items-center justify-between gap-3 rounded-2xl border border-forest/25 bg-accent/30 p-4">
          <div className="text-sm">
            <span className="font-medium">{newMembers}</span> {newMembers === 1 ? "walker" : "walkers"} joined this week.
            <div className="text-xs text-muted-foreground">A quiet welcome lands in their inbox. No reply expected.</div>
          </div>
          <Button
            size="sm"
            onClick={onWelcome}
            disabled={welcomedKey === group.id}
            className="shrink-0 rounded-full bg-forest text-primary-foreground hover:opacity-90"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {welcomedKey === group.id ? "Sent" : "Welcome"}
          </Button>
        </section>
      )}

      {milestones.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">
            <Award className="h-3 w-3" /> Quiet wins · last 14 days
          </div>
          <ul className="space-y-2">
            {milestones.map((m) => {
              const others = m.recipients.filter((r) => r.userId !== user?.id);
              const sent = kudosSent.has(m.badgeId);
              const includesYou = m.recipients.some((r) => r.userId === user?.id);
              return (
                <li key={m.badgeId} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {m.recipients.length === 1
                        ? (includesYou ? "You earned " : "Someone earned ")
                        : `${m.recipients.length} people earned `}
                      <span className="font-serif">{m.name}</span>
                    </div>
                    {m.description && <div className="line-clamp-1 text-xs text-muted-foreground">{m.description}</div>}
                  </div>
                  {others.length > 0 && (
                    <button
                      onClick={() => onKudos(m)}
                      disabled={sent}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition ${sent ? "border-forest/40 bg-forest/10 text-forest" : "border-border bg-card hover:border-forest/40 hover:text-forest"}`}
                    >
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
        <h2 className="font-serif text-xl">Upcoming walks</h2>
        {events.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No upcoming walks tagged with this group yet.</p> : (
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
