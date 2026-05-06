import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/groups/$slug")({ component: GroupDetail });

interface Group { id: string; name: string; description: string | null; member_count: number; city: string | null; }
interface Event { id: string; title: string; slug: string; starts_at: string; city: string | null; }
interface Room { id: string; title: string; theme: string | null; current_participant_count: number; max_participants: number; }

function GroupDetail() {
  const { slug } = Route.useParams();
  const [group, setGroup] = useState<Group | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    (async () => {
      const { data: g } = await supabase.from("groups").select("id,name,description,member_count,city").eq("slug", slug).single();
      if (!g) return;
      setGroup(g);
      const now = new Date().toISOString();
      const [{ data: e }, { data: r }] = await Promise.all([
        supabase.from("events").select("id,title,slug,starts_at,city").eq("group_id", g.id).gte("starts_at", now).order("starts_at").limit(10),
        supabase.from("audio_rooms").select("id,title,theme,current_participant_count,max_participants").eq("group_id", g.id).eq("status","open"),
      ]);
      setEvents(e ?? []);
      setRooms(r ?? []);
    })();
  }, [slug]);

  if (!group) return <div className="py-20 text-center text-muted-foreground">…</div>;
  return (
    <div className="space-y-6">
      <Link to={"/groups" as never} className="text-sm text-muted-foreground hover:text-foreground">← All groups</Link>
      <header>
        <h1 className="font-serif text-3xl">{group.name}</h1>
        <p className="mt-2 text-muted-foreground">{group.description}</p>
        <div className="mt-1 text-xs text-muted-foreground">{group.member_count} walkers</div>
      </header>

      <section>
        <h2 className="font-serif text-xl">Upcoming IRL walks</h2>
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
        <h2 className="font-serif text-xl">Live group walks</h2>
        <p className="mt-1 text-xs text-muted-foreground">Joinable from the active walk screen, once you're moving.</p>
        {rooms.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No live rooms right now.</p> : (
          <ul className="mt-3 space-y-2">
            {rooms.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-4 text-sm">
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-muted-foreground">{r.theme} · {r.current_participant_count}/{r.max_participants}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
