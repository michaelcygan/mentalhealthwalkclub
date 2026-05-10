import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Row {
  rank: number;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  total_minutes: number;
}

interface Props {
  userId: string;
  groupId: string | null;
  groupName: string | null;
}

/**
 * Non-competitive leaderboard: shows ±2 around the current user
 * for their primary group. No podium, no medals.
 */
export function WalkingWithYou({ userId, groupId, groupName }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase.rpc("get_leaderboard", {
        _period: "week",
        _group_id: groupId ?? undefined,
      });
      if (cancelled) return;
      setRows(((data ?? []) as Row[]).map((r) => ({ ...r, total_minutes: Number(r.total_minutes) })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [groupId]);

  if (loading || rows.length < 2) return null;

  const meIdx = rows.findIndex((r) => r.user_id === userId);
  const visible = expanded
    ? rows
    : meIdx >= 0
      ? rows.slice(Math.max(0, meIdx - 2), Math.min(rows.length, meIdx + 3))
      : rows.slice(0, 5);

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <header className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Walking with you</div>
          <h3 className="font-serif text-base">{groupName ?? "Your circle"} · this week</h3>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-forest"
        >
          {expanded ? "Collapse" : "See all"}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </header>
      <ul className="mt-3 space-y-1">
        {visible.map((r) => {
          const me = r.user_id === userId;
          return (
            <li key={r.user_id} className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${me ? "bg-accent/50" : ""}`}>
              <span className="w-6 text-right font-serif text-sm tabular-nums text-muted-foreground">{r.rank}</span>
              <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-secondary">
                {r.avatar_url && <img src={r.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" />}
              </div>
              <span className={`flex-1 truncate text-sm ${me ? "font-medium text-foreground" : "text-foreground/85"}`}>
                {r.display_name ?? "A walker"}{me ? " · you" : ""}
              </span>
              <span className="font-serif text-sm tabular-nums text-muted-foreground">{r.total_minutes} min</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] italic text-muted-foreground">No podium. We're walking, not racing.</p>
    </section>
  );
}
