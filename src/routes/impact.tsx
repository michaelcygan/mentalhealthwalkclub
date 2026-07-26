import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listImpactDonations } from "@/lib/impact.functions";
import { Heart, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { FoundingBadge } from "@/components/membership/founding-badge";

const IMPACT_URL = "https://mentalhealthwalkclub.com/impact";
const IMPACT_OG = "https://mentalhealthwalkclub.com/__l5e/assets-v1/a9e1c704-8b35-4af9-8a3b-6571b05a857e/og-default-v4.jpg";
const IMPACT_DESC = "Every dollar of Walk Club Plus above the $2.99 base is designated to the 988 Suicide & Crisis Lifeline. See the live ledger.";

export const Route = createFileRoute("/impact")({
  component: ImpactPage,
  head: () => ({
    meta: [
      { title: "Impact — Mental Health Walk Club" },
      { name: "description", content: IMPACT_DESC },
      { property: "og:title", content: "Our Impact — Mental Health Walk Club" },
      { property: "og:description", content: IMPACT_DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: IMPACT_URL },
      { property: "og:image", content: IMPACT_OG },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Our Impact — Mental Health Walk Club" },
      { name: "twitter:description", content: IMPACT_DESC },
      { name: "twitter:image", content: IMPACT_OG },
    ],
    links: [{ rel: "canonical", href: IMPACT_URL }],
  }),
});

function fmtCents(c: number) {
  return `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtRange(start: string, end: string) {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  return `${s.toLocaleString(undefined, { month: "short", year: "numeric" })} – ${e.toLocaleString(undefined, { month: "short", year: "numeric" })}`;
}

function ImpactPage() {
  const [rows, setRows] = useState<Array<{
    id: string;
    period_start: string;
    period_end: string;
    gross_revenue_cents: number;
    net_profit_cents: number;
    donation_amount_cents: number;
    donation_percent: number;
    organization_name: string | null;
    organization_url: string | null;
    notes: string | null;
  }>>([]);
  const [total, setTotal] = useState(0);
  const [wall, setWall] = useState<{ user_id: string; display_name: string | null }[]>([]);
  const { openPlusCheckout } = useAuthPrompt();

  useEffect(() => {
    listImpactDonations()
      .then((r) => {
        setRows(r.rows as typeof rows);
        setTotal(r.total_donated_cents);
      })
      .catch(() => {});
    (async () => {
      const { data: sups } = await supabase
        .from("supporter_profile" as never)
        .select("user_id, monthly_amount_cents")
        .eq("display_on_wall", true)
        .gt("monthly_amount_cents", 0)
        .order("joined_at", { ascending: false })
        .limit(30);
      const rows = (sups as unknown as { user_id: string }[]) ?? [];
      if (rows.length === 0) return;
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", rows.map((r) => r.user_id));
      const nameMap = new Map((profs ?? []).map((p) => [p.id, p.display_name]));
      setWall(rows.map((r) => ({ user_id: r.user_id, display_name: nameMap.get(r.user_id) ?? null })));
    })();
  }, []);

  const current = rows[0];

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Our impact</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Walk Club Plus is $2.99/month. Every dollar you add on top is designated to the 988 Suicide &amp; Crisis Lifeline. The $2.99 base keeps the lights on so we can keep building.
        </p>
      </header>

      <section className="rounded-3xl border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-rose-100 text-rose-600">
            <Heart className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total donated</p>
            <p className="text-2xl font-semibold">{fmtCents(total)}</p>
          </div>
        </div>
        {current?.organization_name && (
          <p className="mt-4 text-sm">
            Current partner:{" "}
            {current.organization_url ? (
              <a
                href={current.organization_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-forest underline-offset-2 hover:underline"
              >
                {current.organization_name} <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="font-medium">{current.organization_name}</span>
            )}
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">By period</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            First donation report posts at the end of our first full revenue period. Subscribe to Plus or become a Supporter and you'll show up here.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">{fmtRange(r.period_start, r.period_end)}</p>
                  <p className="text-lg font-semibold text-forest">{fmtCents(r.donation_amount_cents)}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Gross {fmtCents(r.gross_revenue_cents)} · Net {fmtCents(r.net_profit_cents)} · {r.donation_percent}% to{" "}
                  {r.organization_name ?? "partner"}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          Receipts (PDFs of each transfer to the 988 Suicide &amp; Crisis Lifeline) coming soon to this page.
        </p>
      </section>

      <section className="mt-10 rounded-3xl border border-rose-200 bg-rose-50/40 p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-rose-100 text-rose-600">
            <Heart className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h2 className="font-serif text-xl">Become a Supporter</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose your own monthly amount. 100% of profits go straight to the 988 Suicide &amp; Crisis Lifeline. Cancel anytime.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                onClick={() => openPlusCheckout()}
                className="rounded-full bg-rose-600 text-white hover:opacity-90"
              >
                Give monthly
              </Button>
              <Link
                to="/contribute"
                className="inline-flex items-center rounded-full border border-rose-200 bg-card px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
              >
                Give once
              </Link>
            </div>

          </div>
        </div>
        {wall.length > 0 && (
          <div className="mt-6 border-t border-rose-200 pt-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Supporter wall</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {wall.map((p) => (
                <li key={p.user_id} className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-card px-3 py-1 text-xs">
                  <FoundingBadge size="xs" />
                  <span>{p.display_name ?? "Supporter"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>


      <section className="mt-10 rounded-2xl bg-muted/40 p-5 text-sm text-muted-foreground">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Methodology</h2>
        <p>
          Each month we tally successful Walk Club Plus charges, subtract payment processing fees (~6.4% + $0.30 per charge), and donate 50% of the remainder to the 988 Suicide &amp; Crisis Lifeline. Supporter donations are tracked separately and routed at 100% of profits. We publish the numbers here so you can check our math.
        </p>
        <p className="mt-3">
          <Link to="/transparency" className="underline">
            Live transparency ledger
          </Link>{" "}
          ·{" "}
          <Link to="/contribute" className="underline">
            Give once
          </Link>{" "}
          ·{" "}
          <Link to="/terms" className="underline">
            Terms
          </Link>{" "}
          ·{" "}
          <Link to="/privacy" className="underline">
            Privacy
          </Link>
        </p>

      </section>
    </div>
  );
}
