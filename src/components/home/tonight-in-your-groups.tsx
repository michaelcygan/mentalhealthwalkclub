import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Headphones, MapPin, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface UpcomingEvent {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  city: string | null;
  event_type: string;
  attendee_count: number;
  host_name: string | null;
  group_name: string | null;
}

export function TonightInYourGroups() {
  const { user } = useAuth();
  const [events, setEvents] = useState<UpcomingEvent[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const { data: memberships } = await supabase
        .from("group_memberships")
        .select("group_id")
        .eq("user_id", user.id)
        .eq("status", "active");
      const groupIds = (memberships ?? []).map((m) => m.group_id);
      if (!groupIds.length) return;

      const now = new Date().toISOString();
      const horizon = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();
      const { data: evs } = await supabase
        .from("events")
        .select("id,slug,title,starts_at,city,event_type,attendee_count,host_user_id,group_id")
        .in("group_id", groupIds)
        .eq("status", "published")
        .gte("starts_at", now)
        .lte("starts_at", horizon)
        .order("starts_at")
        .limit(8);
      if (cancel || !evs?.length) return;

      const hostIds = Array.from(new Set(evs.map((e) => e.host_user_id).filter(Boolean) as string[]));
      const gIds = Array.from(new Set(evs.map((e) => e.group_id).filter(Boolean) as string[]));
      const [{ data: hosts }, { data: grps }] = await Promise.all([
        hostIds.length
          ? supabase.from("profiles").select("id,display_name").in("id", hostIds)
          : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
        gIds.length
          ? supabase.from("groups").select("id,name").in("id", gIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ]);
      const hostMap = new Map((hosts ?? []).map((h) => [h.id, h.display_name]));
      const grpMap = new Map((grps ?? []).map((g) => [g.id, g.name]));

      if (cancel) return;
      setEvents(
        evs.map((e) => ({
          id: e.id,
          slug: e.slug,
          title: e.title,
          starts_at: e.starts_at,
          city: e.city,
          event_type: e.event_type,
          attendee_count: e.attendee_count ?? 0,
          host_name: e.host_user_id ? hostMap.get(e.host_user_id) ?? null : null,
          group_name: e.group_id ? grpMap.get(e.group_id) ?? null : null,
        }))
      );
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  if (!user || events.length === 0) return null;

  return (
    <section aria-labelledby="tonight-h" className="px-4 md:px-0">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 id="tonight-h" className="font-serif text-xl">Tonight in your groups</h2>
        <Link to="/groups" className="text-xs text-muted-foreground hover:text-foreground">All groups</Link>
      </div>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {events.map((e) => {
          const when = new Date(e.starts_at);
          const isToday = when.toDateString() === new Date().toDateString();
          return (
            <li key={e.id} className="min-w-[260px] max-w-[260px] snap-start rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {e.event_type === "audio_walk" ? <><Headphones className="h-3 w-3" /> Audio</> : <><MapPin className="h-3 w-3" /> In person</>}
                <span>·</span>
                <span>{isToday ? "Today" : when.toLocaleDateString(undefined, { weekday: "short" })} {when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
              </div>
              <Link to={"/events/$slug" as never} params={{ slug: e.slug } as never} className="mt-1 block font-medium leading-tight hover:text-forest">
                {e.title}
              </Link>
              {e.group_name ? (
                <div className="mt-0.5 text-xs text-muted-foreground truncate">{e.group_name}</div>
              ) : null}
              <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {e.attendee_count === 0 ? <span className="text-forest">0 going · be the first</span> : <span>{e.attendee_count} going</span>}
                {e.host_name ? <span className="ml-auto truncate">· {e.host_name}</span> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
