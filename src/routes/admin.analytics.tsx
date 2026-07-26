import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Users, MapPin, Footprints, Sparkles, Search as SearchIcon, AlertCircle, Heart } from "lucide-react";
import { adminAnalyticsOverview, type AnalyticsOverview } from "@/lib/analytics-admin.functions";

export const Route = createFileRoute("/admin/analytics")({ component: AdminAnalytics });

const RANGES: Array<{ key: "7d" | "30d" | "90d" | "all"; label: string }> = [
  { key: "7d", label: "7d" }, { key: "30d", label: "30d" }, { key: "90d", label: "90d" }, { key: "all", label: "All" },
];

function AdminAnalytics() {
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fn = useServerFn(adminAnalyticsOverview);
  useEffect(() => {
    setData(null); setErr(null);
    fn({ data: { range } }).then(setData).catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"));
  }, [fn, range]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-serif text-lg"><BarChart3 className="h-4 w-4" /> Analytics</h2>
        <div className="flex gap-1 rounded-full border border-border bg-card p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-full px-2.5 py-1 text-[11px] ${range === r.key ? "bg-forest text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >{r.label}</button>
          ))}
        </div>
      </div>

      {err && <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{err}</p>}
      {!data && !err && <p className="text-sm text-muted-foreground">Loading analytics…</p>}
      {data && <Body d={data} />}
    </div>
  );
}

function Body({ d }: { d: AnalyticsOverview }) {
  return (
    <>
      <Card title="Growth" icon={<Users className="h-4 w-4" />}>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Total users" value={d.growth.totalUsers} />
          <Stat label={`New (${d.range})`} value={d.growth.newUsers} />
          <Stat label="DAU" value={d.growth.dau} />
          <Stat label="WAU" value={d.growth.wau} />
          <Stat label="MAU" value={d.growth.mau} />
          <Stat label="W1 → W4 retention" value={`${d.growth.week1Retention}% / ${d.growth.week4Retention}%`} />
        </div>
        <Sparkbars points={d.growth.signupsByDay} label="Signups by day" />
      </Card>

      <Card title="Geography" icon={<MapPin className="h-4 w-4" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <TopList title="Top cities (users)" rows={d.geography.topCities} />
          <TopList title="Top countries (users)" rows={d.geography.topCountries} />
          <TopList title="Top regions (users)" rows={d.geography.topRegions} />
          <TopList title="Top cities (walks)" rows={d.geography.topWalkCities} />
        </div>
      </Card>

      <Card title="Walks" icon={<Footprints className="h-4 w-4" />}>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Sessions started" value={d.walks.sessionsStarted} />
          <Stat label="Sessions completed" value={d.walks.sessionsCompleted} />
          <Stat label="Events created" value={d.walks.eventsCreated} />
          <Stat label="RSVPs (going)" value={d.walks.rsvpsGoing} />
          <Stat label="Avg attendees" value={d.walks.avgAttendees} />
          <Stat label="Distinct hosts" value={d.walks.distinctHosts} />
        </div>
        <TopList title="Top hosts" rows={d.walks.topHosts} />
      </Card>

      <Card title="Engagement" icon={<Sparkles className="h-4 w-4" />}>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="High-fives" value={d.engagement.highFives} />
          <Stat label="Friendships" value={d.engagement.friendshipsAccepted} />
          <Stat label="Journal entries" value={d.engagement.journalEntries} />
        </div>
        <TopList title="Notifications by kind" rows={d.engagement.notificationsByKind} />
      </Card>

      <Card title="Listen & read" icon={<SearchIcon className="h-4 w-4" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <TopList title="Top searches" rows={d.listen.topTerms.map((t) => ({ label: t.q, count: t.count }))} />
          <TopList title="Zero-result searches" rows={d.listen.zeroResultTerms.map((t) => ({ label: t.q, count: t.zero }))} icon={<AlertCircle className="h-3.5 w-3.5 text-destructive" />} />
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-sm">
          {(["open", "play", "save", "queue"] as const).map((a) => (
            <div key={a} className="rounded-lg bg-background px-3 py-2 text-center">
              <p className="font-mono">{d.listen.actions[a] ?? 0}</p>
              <p className="text-[10px] capitalize text-muted-foreground">{a}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Monetization" icon={<Heart className="h-4 w-4" />}>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Active Plus" value={d.monetization.activePlus} />
          <Stat label="Monthly / Yearly" value={`${d.monetization.plusMonthly} / ${d.monetization.plusYearly}`} />
          <Stat label="Trialing" value={d.monetization.trialing} />
          <Stat label="Legacy Supporters" value={d.monetization.legacySupporters} />
          <Stat label="MRR (est.)" value={`$${(d.monetization.mrrCentsEstimate / 100).toFixed(2)}`} />
        </div>
      </Card>

      <p className="text-center text-[10px] text-muted-foreground">Generated {new Date(d.generatedAt).toLocaleString()}</p>
    </>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 font-serif text-base">{icon} {title}</h3>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3 text-center">
      <p className="font-serif text-xl">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function TopList({ title, rows, icon }: { title: string; rows: Array<{ label: string; count: number }>; icon?: React.ReactNode }) {
  if (rows.length === 0) return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">No data yet.</p>
    </div>
  );
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2 text-xs">
            <span className="w-32 truncate">{r.label}</span>
            <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-background">
              <span className="absolute inset-y-0 left-0 bg-forest/60" style={{ width: `${(r.count / max) * 100}%` }} />
            </span>
            <span className="w-10 text-right font-mono text-muted-foreground">{icon}{r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sparkbars({ points, label }: { points: Array<{ day: string; count: number }>; label: string }) {
  const max = useMemo(() => Math.max(1, ...points.map((p) => p.count)), [points]);
  if (points.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex h-16 items-end gap-[2px]">
        {points.map((p) => (
          <div key={p.day} title={`${p.day}: ${p.count}`} className="flex-1 rounded-t bg-forest/70" style={{ height: `${(p.count / max) * 100}%`, minHeight: 2 }} />
        ))}
      </div>
    </div>
  );
}
