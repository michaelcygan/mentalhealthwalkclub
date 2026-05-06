import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { Button } from "@/components/ui/button";
import { Footprints, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/groups/$slug")({ component: GroupDetail });

interface Group { id: string; name: string; description: string | null; member_count: number; city: string | null; theme: string | null; }
interface Event { id: string; title: string; slug: string; starts_at: string; city: string | null; }
interface Room { id: string; title: string; theme: string | null; current_participant_count: number; max_participants: number; }
interface RecentWalk { id: string; user_id: string; duration_seconds: number | null; started_at: string; profiles?: { display_name: string | null; city: string | null } | null }

function GroupDetail() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const { requireAuth } = useAuthPrompt();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [walkersWeek, setWalkersWeek] = useState(0);
  const [recent, setRecent] = useState<RecentWalk[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: g } = await supabase.from("groups").select("id,name,description,member_count,city,theme").eq("slug", slug).single();
      if (!g) return;
      setGroup(g);
      const now = new Date().toISOString();
      const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
      const [{ data: e }, { data: r }, { data: w }] = await Promise.all([
        supabase.from("events").select("id,title,slug,starts_at,city").eq("group_id", g.id).gte("starts_at", now).order("starts_at").limit(10),
        supabase.from("audio_rooms").select("id,title,theme,current_participant_count,max_participants").eq("group_id", g.id).eq("status","open"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase.from("walk_sessions").select("id,user_id,duration_seconds,started_at,profiles(display_name,city)").eq("group_id", g.id).eq("status","completed").gte("started_at", weekAgo).order("started_at",{ascending:false}).limit(20) as any,
      ]);
      setEvents(e ?? []);
      setRooms(r ?? []);
      const walks = (w ?? []) as RecentWalk[];
      setRecent(walks.slice(0, 5));
      setWalkersWeek(new Set(walks.map((x) => x.user_id)).size);
    })();
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

  if (!group) return <div className="py-20 text-center text-muted-foreground">…</div>;

  const themeGrad: Record<string, string> = {
    anxiety: "from-sky-200/60 to-indigo-200/40",
    burnout: "from-amber-200/60 to-rose-200/40",
    grief: "from-violet-200/60 to-slate-200/40",
    default: "from-emerald-200/60 to-sage/40",
  };
  const grad = themeGrad[group.theme ?? "default"] ?? themeGrad.default;

  return (
    <div className="space-y-6">
      <Link to={"/groups" as never} className="text-sm text-muted-foreground hover:text-foreground">← All groups</Link>

      <header className={`overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${grad} p-7 shadow-soft`}>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">
          <Users className="h-3 w-3" />{group.member_count} walkers · {walkersWeek} active this week
        </div>
        <h1 className="mt-2 font-serif text-3xl">{group.name}</h1>
        {group.description && <p className="mt-2 max-w-2xl text-sm text-foreground/80">{group.description}</p>}
        <Button onClick={walkWithGroup} disabled={busy} className="mt-5 rounded-full bg-forest text-primary-foreground hover:opacity-90">
          <Footprints className="mr-2 h-4 w-4" /> {busy ? "Starting…" : "Walk with this group"}
        </Button>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="font-serif text-xl">Upcoming Local Walks</h2>
          {events.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No upcoming walks tagged with this group yet.</p> : (
            <ul className="mt-3 space-y-2">
              {events.map((e) => (
                <li key={e.id} className="rounded-2xl border border-border bg-card p-4">
                  <Link to={"/events/$slug" as never} params={{ slug: e.slug } as never} className="font-medium hover:text-forest">{e.title}</Link>
                  <div className="text-xs text-muted-foreground">{new Date(e.starts_at).toLocaleString()} · {e.city}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="font-serif text-xl">Recently walked here</h2>
          {recent.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No walks logged in the last week. Be the first.</p> : (
            <ul className="mt-3 space-y-2">
              {recent.map((w) => {
                const name = (w.profiles?.display_name ?? "A walker").split(" ")[0];
                const mins = Math.round((w.duration_seconds ?? 0) / 60);
                return (
                  <li key={w.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-3 text-sm">
                    <span>{name}{w.profiles?.city ? ` · ${w.profiles.city}` : ""}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{mins} min</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {rooms.length > 0 && (
        <section>
          <h2 className="font-serif text-xl">Live Walk & Talks</h2>
          <p className="mt-1 text-xs text-muted-foreground">Joinable from the active walk screen, once you're moving.</p>
          <ul className="mt-3 space-y-2">
            {rooms.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-4 text-sm">
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-muted-foreground">{r.theme} · {r.current_participant_count}/{r.max_participants}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
