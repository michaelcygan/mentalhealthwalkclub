import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listImpactDonations } from "@/lib/impact.functions";
import { Heart, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/impact")({
  component: ImpactPage,
  head: () => ({
    meta: [
      { title: "Impact — Mental Health Walk Club" },
      {
        name: "description",
        content:
          "50% of every Walk Club Plus dollar funds our nonprofit partner. See the running total and methodology.",
      },
      { property: "og:title", content: "Our Impact — Mental Health Walk Club" },
      {
        property: "og:description",
        content: "Half of every Plus dollar goes straight to mental health nonprofits.",
      },
    ],
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

  useEffect(() => {
    listImpactDonations()
      .then((r) => {
        setRows(r.rows as typeof rows);
        setTotal(r.total_donated_cents);
      })
      .catch(() => {});
  }, []);

  const current = rows[0];

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Our impact</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          50% of every Walk Club Plus dollar goes to a mental health nonprofit. The other 50% keeps the lights on so we can keep building.
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
            First donation report posts at the end of our first full revenue period. Subscribe to Plus and you'll show up here.
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
      </section>

      <section className="mt-10 rounded-2xl bg-muted/40 p-5 text-sm text-muted-foreground">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Methodology</h2>
        <p>
          Each month we tally successful Walk Club Plus charges, subtract payment processing fees (~6.4% + $0.30 per charge), and donate 50% of the
          remainder to our current nonprofit partner. We publish the numbers here so you can check our math.
        </p>
        <p className="mt-3">
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
