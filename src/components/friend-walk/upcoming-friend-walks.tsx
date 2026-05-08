import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { CalendarClock, Radio } from "lucide-react";
import { listMyFriendWalks } from "@/lib/friend-walk.functions";
import { useAuth } from "@/lib/auth-context";

interface FW {
  id: string;
  title: string;
  share_code: string | null;
  status: string;
  starts_at: string | null;
}

/** Compact banner on Walk home — surfaces the user's own upcoming/live friend walks. */
export function UpcomingFriendWalks() {
  const { user } = useAuth();
  const list = useServerFn(listMyFriendWalks);
  const [walks, setWalks] = useState<FW[]>([]);

  useEffect(() => {
    if (!user) return;
    list().then((r) => setWalks((r.walks as FW[]).slice(0, 3))).catch(() => { /* noop */ });
  }, [user, list]);

  if (!user || walks.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Your friend walks</div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {walks.map((w) => {
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
                {isLive ? <Radio className="h-3 w-3" /> : <CalendarClock className="h-3 w-3 text-muted-foreground" />}
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
