import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Heart, ExternalLink, ArrowRight, ShieldCheck } from "lucide-react";
import {
  getTransparencyTotals,
  listTransparencyFeed,
  listTransferBatches,
} from "@/lib/transparency.functions";

const URL_CANONICAL = "https://mentalhealthwalkclub.com/transparency";
const OG = "https://mentalhealthwalkclub.com/__l5e/assets-v1/a9e1c704-8b35-4af9-8a3b-6571b05a857e/og-default-v4.jpg";
const DESC =
  "Every cent above $2.99/month of Walk Club Plus is designated to the 988 Suicide & Crisis Lifeline. See the running ledger, transfer batches, and dedications in real time.";

const totalsOpts = {
  queryKey: ["transparency", "totals"] as const,
  queryFn: () => getTransparencyTotals({ data: {} }),
};
const feedOpts = {
  queryKey: ["transparency", "feed"] as const,
  queryFn: () => listTransparencyFeed({ data: { limit: 100 } }),
};
const batchesOpts = {
  queryKey: ["transparency", "batches"] as const,
  queryFn: () => listTransferBatches({ data: {} }),
};

export const Route = createFileRoute("/transparency")({
  head: () => ({
    meta: [
      { title: "Transparency — Mental Health Walk Club" },
      { name: "description", content: DESC },
      { property: "og:title", content: "Transparency — Mental Health Walk Club" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL_CANONICAL },
      { property: "og:image", content: OG },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Transparency — Mental Health Walk Club" },
      { name: "twitter:description", content: DESC },
      { name: "twitter:image", content: OG },
    ],
    links: [{ rel: "canonical", href: URL_CANONICAL }],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(totalsOpts),
      context.queryClient.ensureQueryData(feedOpts),
      context.queryClient.ensureQueryData(batchesOpts),
    ]);
  },
  component: TransparencyPage,
});

function fmt(c: number) {
  return `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtWhole(c: number) {
  return `$${Math.round(c / 100).toLocaleString()}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function TransparencyPage() {
  const { data: totals } = useSuspenseQuery(totalsOpts);
  const { data: feed } = useSuspenseQuery(feedOpts);
  const { data: batches } = useSuspenseQuery(batchesOpts);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-8">
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-forest/20 bg-accent/30 px-3 py-1 text-[11px] uppercase tracking-wide text-forest">
          <ShieldCheck className="h-3 w-3" /> Live ledger
        </div>
        <h1 className="mt-3 font-serif text-3xl leading-tight sm:text-4xl">
          Where the money goes.
        </h1>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          Walk Club Plus is <span className="font-medium text-foreground">$2.99/month minimum</span>.
          The first $2.99 unlocks unlimited Radio and keeps the app running.{" "}
          <span className="font-medium text-foreground">Every cent above that</span> is designated to the{" "}
          <a
            href="https://988lifeline.org/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-forest underline-offset-2 hover:underline"
          >
            988 Suicide &amp; Crisis Lifeline <ExternalLink className="h-3 w-3" />
          </a>{" "}
          and transferred in batches. This page shows the running total, the transfers we've made, and (opt-in) dedications from members.
        </p>
      </header>

      {/* Totals */}
      <section aria-label="Totals" className="grid gap-3 sm:grid-cols-3">
        <Stat label="Designated to 988" value={fmt(totals.designatedCents)} accent />
        <Stat label="Transferred" value={fmt(totals.transferredCents)} />
        <Stat label="Awaiting next transfer" value={fmt(totals.awaitingCents)} />
      </section>

      {/* CTA */}
      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link
          to="/contribute"
          className="group flex items-center justify-between rounded-3xl border border-rose-200 bg-rose-50/60 p-5 transition hover:bg-rose-50"
        >
          <div>
            <div className="flex items-center gap-2 text-rose-700">
              <Heart className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide">One-time contribution</span>
            </div>
            <p className="mt-1 font-serif text-lg">Give once to 988</p>
            <p className="text-xs text-muted-foreground">100% designated. No account required.</p>
          </div>
          <ArrowRight className="h-5 w-5 text-rose-600 transition group-hover:translate-x-0.5" />
        </Link>
        <Link
          to="/impact"
          className="group flex items-center justify-between rounded-3xl border border-forest/30 bg-accent/30 p-5 transition hover:bg-accent/50"
        >
          <div>
            <div className="flex items-center gap-2 text-forest">
              <span className="text-xs uppercase tracking-wide">Monthly</span>
            </div>
            <p className="mt-1 font-serif text-lg">Become a Plus member</p>
            <p className="text-xs text-muted-foreground">$2.99+/mo. Unlimited Radio. Set your own 988 designation.</p>
          </div>
          <ArrowRight className="h-5 w-5 text-forest transition group-hover:translate-x-0.5" />
        </Link>
      </section>

      {/* Transfer batches */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Transfers</h2>
        {batches.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            The first transfer to 988 will appear here after our initial batch clears. Everything below is currently designated and held for that batch.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {batches.map((b) => (
              <li key={b.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {b.organization_url ? (
                        <a
                          href={b.organization_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          {b.organization_name} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        b.organization_name
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {fmtDate(b.period_start)} – {fmtDate(b.period_end)}
                      {b.transferred_at ? ` · transferred ${fmtDate(b.transferred_at)}` : ""}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-forest">{fmtWhole(b.amount_cents)}</p>
                </div>
                {b.notes && <p className="mt-2 text-xs text-muted-foreground">{b.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent designations feed */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Recent designations</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Anonymous by default. Members can choose to share a first name and a short dedication.
        </p>
        {feed.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing yet — be the first.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-2xl border bg-card">
            {feed.map((r, i) => (
              <li key={`${r.paid_at}-${i}`} className="flex items-baseline justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    <span className="font-medium">{r.public_donor_name || "Anonymous"}</span>
                    {r.source === "one_time_988" && (
                      <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-rose-700">
                        one-time
                      </span>
                    )}
                    {r.honoree_name && (
                      <span className="text-muted-foreground"> · in honor of {r.honoree_name}</span>
                    )}
                  </p>
                  {r.dedication_message && (
                    <p className="mt-0.5 truncate text-xs italic text-muted-foreground">
                      "{r.dedication_message}"
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">{fmtDate(r.paid_at)}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-forest">{fmt(r.donation_cents)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* FAQ */}
      <section className="mt-10 space-y-3">
        <h2 className="text-lg font-semibold">FAQ</h2>
        {[
          {
            q: "Where does the money go?",
            a: "The first $2.99 of every Plus payment unlocks unlimited Radio and keeps Mental Health Walk Club running (hosting, safety, moderation). Every cent above $2.99, plus 100% of one-time contributions, is designated to the 988 Suicide & Crisis Lifeline.",
          },
          {
            q: "How often are transfers made?",
            a: "In batches, typically monthly once designated funds clear payment processor holds. Each batch appears above with the exact amount and date.",
          },
          {
            q: "Can I cancel?",
            a: "Anytime, from Settings → Billing. Your Plus access continues through the end of the paid period.",
          },
          {
            q: "Is my dedication public?",
            a: "Only if you opt in. When you do, we only show your first name (max 40 chars) and a short optional dedication. We never publish your last name, email, or Stripe details.",
          },
        ].map((f) => (
          <details key={f.q} className="group rounded-2xl border bg-card p-4">
            <summary className="cursor-pointer list-none text-sm font-medium">
              {f.q}
              <span className="float-right text-muted-foreground group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </section>

      <p className="mt-10 text-[11px] text-muted-foreground">
        <Link to="/terms" className="underline">Terms</Link> ·{" "}
        <Link to="/privacy" className="underline">Privacy</Link> ·{" "}
        <Link to="/impact" className="underline">Impact archive</Link>
      </p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-soft ${accent ? "border-rose-200 bg-rose-50/40" : "bg-card"}`}
    >
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-serif text-2xl ${accent ? "text-rose-700" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
