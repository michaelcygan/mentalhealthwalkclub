import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Search as SearchIcon, AlertCircle, Inbox } from "lucide-react";
import { adminInsightsOverview } from "@/lib/content-suggestions.functions";

export const Route = createFileRoute("/admin/insights")({ component: AdminInsights });

type Overview = Awaited<ReturnType<typeof adminInsightsOverview>>;

function AdminInsights() {
  const [data, setData] = useState<Overview | null>(null);
  const fn = useServerFn(adminInsightsOverview);
  useEffect(() => { fn().then(setData).catch(() => setData(null)); }, [fn]);

  if (!data) return <div className="text-sm text-muted-foreground">Loading insights…</div>;

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-3 gap-2">
        <Stat label="Events (7d)" value={data.events7d.total} />
        <Stat label="Active users" value={data.events7d.distinctUsers} />
        <Stat label="Open requests" value={data.openRequests} />
      </section>

      <Card title="Top search terms (30d)" icon={<SearchIcon className="h-4 w-4" />}>
        {data.topTerms.length === 0 ? (
          <Empty text="No searches yet." />
        ) : (
          <ul className="divide-y divide-border">
            {data.topTerms.map((t) => (
              <li key={t.q} className="flex items-center justify-between py-1.5 text-sm">
                <span className="truncate">{t.q}</span>
                <span className="text-xs text-muted-foreground">{t.count}× {t.zero > 0 && <span className="text-destructive">· {t.zero} zero</span>}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Zero-result searches" icon={<AlertCircle className="h-4 w-4" />}>
        {data.zeroResultTerms.length === 0 ? (
          <Empty text="Every search returned at least one result. " />
        ) : (
          <ul className="divide-y divide-border">
            {data.zeroResultTerms.map((t) => (
              <li key={t.q} className="flex items-center justify-between py-1.5 text-sm">
                <span className="truncate">{t.q}</span>
                <span className="text-xs text-destructive">{t.zero}×</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Actions (7d)" icon={<BarChart3 className="h-4 w-4" />}>
        <ul className="grid grid-cols-2 gap-2 text-sm">
          {(["open", "play", "save", "queue"] as const).map((a) => (
            <li key={a} className="flex items-center justify-between rounded-lg bg-background px-3 py-2">
              <span className="capitalize">{a}</span>
              <span className="font-mono">{data.events7d.byAction[a] ?? 0}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center">
      <p className="font-serif text-2xl">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 font-serif text-base">{icon} {title}</h2>
      {children}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">{text}</p>;
}
