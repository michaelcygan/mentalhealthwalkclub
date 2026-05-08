import { Link } from "@tanstack/react-router";
import { CalendarClock, Radio } from "lucide-react";
import { useFriendWalks } from "@/hooks/use-friend-walks";

/** Compact rail on Walk home — surfaces the user's own upcoming/live friend walks. */
export function UpcomingFriendWalks() {
  const { walks } = useFriendWalks();
  if (!walks || walks.length === 0) return null;
  const top = walks.slice(0, 3);

  return (
    <section className="space-y-2">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Your friend walks</div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 edge-fade no-scrollbar md:mx-0 md:px-0">
        {top.map((w) => {
          const isLive = w.status === "open";
          const startMs = w.starts_at ? new Date(w.starts_at).getTime() : 0;
          const when = isLive ? "live now" : w.starts_at
            ? new Date(startMs).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })
            : "";
          if (!w.share_code) return null;
          return (
            <Link
              key={w.id}
              to={"/w/$code" as never}
              params={{ code: w.share_code } as never}
              className={`min-w-[200px] shrink-0 rounded-2xl border p-3 transition hover:-translate-y-px ${isLive ? "border-forest/40 bg-accent/40" : "border-border bg-card"}`}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-forest">
                {isLive ? <Radio className="h-3 w-3 live-pulse" /> : <CalendarClock className="h-3 w-3 text-muted-foreground" />}
                <span className={isLive ? "text-forest" : "text-muted-foreground"}>{when}</span>
              </div>
              <div className="mt-1 line-clamp-1 font-serif text-sm">{w.title}</div>
              <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">/w/{w.share_code}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
