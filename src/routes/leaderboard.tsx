import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { Button } from "@/components/ui/button";
import { Trophy, ChevronLeft, Medal } from "lucide-react";
import { haptics } from "@/lib/device";

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardPage,
  head: () => ({ meta: [{ title: "Leaderboard — Mental Health Walk Club" }] }),
});

type Period = "week" | "month" | "all";

interface Row {
  rank: number;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  total_minutes: number;
  total_walks: number;
  badge_count: number;
}

const PERIODS: { v: Period; l: string }[] = [
  { v: "week", l: "Week" },
  { v: "month", l: "Month" },
  { v: "all", l: "All-Time" },
];

function LeaderboardPage() {
  const { user } = useAuth();
  const { openAuth } = useAuthPrompt();
  const [period, setPeriod] = useState<Period>("week");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [me, setMe] = useState<{ rank: number; total_minutes: number; next_rank_minutes: number | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    setRows(null);
    Promise.all([
      supabase.rpc("get_leaderboard", { _period: period, _group_id: undefined }),
      supabase.rpc("get_my_rank", { _period: period, _group_id: undefined }),
    ]).then(([lb, mr]) => {
      const lbRows = (lb.data ?? []) as Row[];
      lbRows.forEach((r) => { r.rank = Number(r.rank); r.total_minutes = Number(r.total_minutes); r.total_walks = Number(r.total_walks); r.badge_count = Number(r.badge_count); });
      setRows(lbRows);
      const m = (mr.data?.[0] ?? null) as { rank: number; total_minutes: number; next_rank_minutes: number | null } | null;
      setMe(m ? { rank: Number(m.rank), total_minutes: Number(m.total_minutes), next_rank_minutes: m.next_rank_minutes != null ? Number(m.next_rank_minutes) : null } : null);
    });
  }, [user, period]);

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-5 py-12 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent">
          <Trophy className="h-6 w-6 text-forest" />
        </div>
        <h1 className="font-serif text-3xl">Walk Club Leaderboard</h1>
        <p className="text-muted-foreground">See who's been showing up. Sign in to view.</p>
        <Button onClick={() => openAuth("signin")} className="rounded-full bg-forest text-primary-foreground hover:opacity-90">Sign in</Button>
      </div>
    );
  }

  const inTop100 = me && rows?.some((r) => r.user_id === user.id);

  return (
    <div className="space-y-5 pb-24">
      <header className="flex items-center gap-3">
        <Link to="/profile" onClick={() => haptics.tap()} className="rounded-full p-2 text-muted-foreground hover:bg-accent/40 hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-serif text-2xl">Leaderboard</h1>
          <p className="text-xs text-muted-foreground">Top 100 walkers by minutes moved.</p>
        </div>
      </header>

      <div className="flex gap-1.5 rounded-full border border-border bg-card p-1 shadow-soft">
        {PERIODS.map((p) => (
          <button
            key={p.v}
            onClick={() => { haptics.tap(); setPeriod(p.v); }}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${period === p.v ? "bg-forest text-primary-foreground" : "text-muted-foreground"}`}
          >
            {p.l}
          </button>
        ))}
      </div>

      {!rows ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-secondary/40" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm italic text-muted-foreground">
          No walks logged this {period === "all" ? "century" : period} yet. Be the first.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => <LbRow key={r.user_id} row={r} highlight={r.user_id === user.id} />)}
        </ul>
      )}

      {me && !inTop100 && (
        <div className="sticky bottom-20 z-10 rounded-2xl border border-forest/30 bg-accent/60 p-4 backdrop-blur shadow-elevated">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-forest">Your standing</div>
              <div className="font-serif text-lg">#{me.rank} · {me.total_minutes} min</div>
            </div>
            {me.next_rank_minutes != null && me.next_rank_minutes > me.total_minutes && (
              <div className="text-right text-xs text-muted-foreground">
                {me.next_rank_minutes - me.total_minutes} min to<br />pass #{me.rank - 1}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LbRow({ row, highlight }: { row: Row; highlight: boolean }) {
  const initials = (row.display_name || "??").split(/\s+/).map(s => s[0]).slice(0, 2).join("").toUpperCase();
  const podium = row.rank === 1 ? "text-amber-500" : row.rank === 2 ? "text-zinc-400" : row.rank === 3 ? "text-orange-700" : "text-muted-foreground";
  return (
    <li className={`flex items-center gap-3 rounded-2xl border p-3 transition active:scale-[0.99] ${highlight ? "border-forest/50 bg-accent/50 shadow-soft" : "border-border bg-card hover:border-forest/30"}`}>
      <span className={`flex w-8 items-center justify-center font-serif text-lg tabular-nums ${podium}`}>
        {row.rank <= 3 ? <Medal className="h-5 w-5" /> : `#${row.rank}`}
      </span>
      {row.avatar_url ? (
        <img src={row.avatar_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest font-serif text-xs text-primary-foreground">{initials}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{row.display_name ?? "Walker"}{highlight && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-forest">you</span>}</div>
        <div className="truncate text-[11px] text-muted-foreground">{row.city ?? "—"} · {row.total_walks} walk{row.total_walks === 1 ? "" : "s"}</div>
      </div>
      <div className="text-right">
        <div className="font-serif text-base tabular-nums">{row.total_minutes}<span className="text-[10px] text-muted-foreground"> min</span></div>
        {row.badge_count > 0 && <div className="text-[10px] text-muted-foreground">🏅 {row.badge_count}</div>}
      </div>
    </li>
  );
}
