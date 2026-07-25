import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Shimmer } from "@/components/ui/shimmer";
import { useServerFn } from "@tanstack/react-start";
import { getCircleActivity, sendHighFive, type CircleActivityItem } from "@/lib/social.functions";
import { Hand, ArrowRight } from "lucide-react";
import { toast } from "sonner";

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function initials(name: string | null | undefined): string {
  if (!name) return "·";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function FriendPulse() {
  const fetchActivity = useServerFn(getCircleActivity);
  const fireFive = useServerFn(sendHighFive);
  const [items, setItems] = useState<CircleActivityItem[] | null>(null);
  const [fivedLocal, setFivedLocal] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetchActivity({}).then(setItems).catch(() => setItems([]));
    // fetchActivity is a fresh ref each render — intentionally omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (items === null) {
    return <Shimmer className="h-24 w-full" />;
  }
  if (!items.length) return null;

  const onFive = async (walkSessionId: string) => {
    setBusy(walkSessionId);
    try {
      await fireFive({ data: { walkSessionId } });
      setFivedLocal((s) => new Set(s).add(walkSessionId));
      toast.success("High-five sent 👋");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send");
    } finally { setBusy(null); }
  };

  const shown = items.slice(0, 3);
  const more = items.length - shown.length;

  return (
    <Card className="rounded-2xl border-border bg-card/90 p-4 shadow-soft backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Friend pulse</div>
        {more > 0 && (
          <Link to="/" className="text-[11px] text-muted-foreground hover:text-foreground">
            See all {items.length} →
          </Link>
        )}
      </div>
      <ul className="space-y-2">
        {shown.map((it, i) => {
          const name = it.user.display_name ?? it.user.username ?? "A friend";
          return (
            <li key={i} className="flex items-center gap-3 rounded-xl bg-background/60 p-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                {it.user.avatar_url ? <img src={it.user.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  <span className="font-medium text-foreground">{name}</span>{" "}
                  <span className="text-muted-foreground">
                    {it.kind === "completed_walk"
                      ? `finished a ${it.duration_min}-min walk`
                      : `posted ${it.event_title ? `"${it.event_title}"` : "a walk"}`}
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground">{relTime(it.ts)}</p>
              </div>
              {it.kind === "completed_walk" ? (
                (it.already_fived || fivedLocal.has(it.walk_session_id!)) ? (
                  <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground">✓ Sent</span>
                ) : (
                  <button
                    type="button"
                    disabled={busy === it.walk_session_id}
                    onClick={() => onFive(it.walk_session_id!)}
                    className="inline-flex items-center gap-1 rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    <Hand className="h-3.5 w-3.5" /> High-five
                  </button>
                )
              ) : (
                <Link
                  to="/w/$code"
                  params={{ code: it.event_slug ?? it.event_id ?? "" }}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:opacity-90"
                >
                  RSVP <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
