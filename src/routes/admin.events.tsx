import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Star, StarOff, CalendarDays, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import { setEventFeatured } from "@/lib/discover.functions";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  venue_name: string | null;
  city: string | null;
  attendee_count: number;
  is_featured: boolean;
};

export const Route = createFileRoute("/admin/events")({
  component: AdminEventsPage,
  head: () => ({
    meta: [{ title: "Admin — Events" }],
  }),
});

function AdminEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("events")
        .select("id,slug,title,starts_at,venue_name,city,attendee_count,is_featured")
        .eq("status", "published")
        .gte("starts_at", now)
        .order("starts_at", { ascending: true })
        .limit(100);
      if (error) {
        toast.error(error.message);
      } else {
        setEvents((data ?? []) as EventRow[]);
      }
      setLoading(false);
    })();
  }, []);

  const toggle = async (ev: EventRow) => {
    try {
      await setEventFeatured({ data: { eventId: ev.id, featured: !ev.is_featured } });
      setEvents((prev) =>
        prev.map((e) => (e.id === ev.id ? { ...e, is_featured: !e.is_featured } : e))
      );
      toast.success(ev.is_featured ? "Unfeatured" : "Featured");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl">Upcoming events</h2>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-card" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No upcoming events.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
            >
              <button
                onClick={() => toggle(ev)}
                className="shrink-0 rounded-full p-2 transition hover:bg-accent/40"
                title={ev.is_featured ? "Unfeature" : "Feature"}
              >
                {ev.is_featured ? (
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                ) : (
                  <StarOff className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <Link
                  to="/w/$code"
                  params={{ code: ev.slug }}
                  className="truncate font-serif text-base hover:underline"
                >
                  {ev.title}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {formatDate(ev.starts_at)}
                  </span>
                  {ev.venue_name && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {ev.venue_name}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {ev.attendee_count}
                  </span>
                </div>
              </div>
              {ev.is_featured && (
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="shrink-0 rounded-full bg-forest/10 px-2 py-0.5 text-[10px] text-forest"
                >
                  Featured
                </motion.span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
