import { createFileRoute } from "@tanstack/react-router";
import { OneTimeContributionSheet } from "@/components/billing/one-time-contribution-sheet";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { Heart } from "lucide-react";

const URL_CANONICAL = "https://mentalhealthwalkclub.com/contribute";
const OG = "https://mentalhealthwalkclub.com/__l5e/assets-v1/a9e1c704-8b35-4af9-8a3b-6571b05a857e/og-default-v4.jpg";
const DESC = "Give once to the 988 Suicide & Crisis Lifeline through Mental Health Walk Club. 100% designated.";

export const Route = createFileRoute("/contribute")({
  head: () => ({
    meta: [
      { title: "Contribute — Mental Health Walk Club" },
      { name: "description", content: DESC },
      { property: "og:title", content: "Contribute to 988 — Mental Health Walk Club" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL_CANONICAL },
      { property: "og:image", content: OG },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Contribute to 988 — Mental Health Walk Club" },
      { name: "twitter:description", content: DESC },
      { name: "twitter:image", content: OG },
    ],
    links: [{ rel: "canonical", href: URL_CANONICAL }],
  }),
  component: ContributePage,
});

function ContributePage() {
  return (
    <div className="mx-auto max-w-xl px-4 pb-24 pt-8">
      <PaymentTestModeBanner />
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-[11px] uppercase tracking-wide text-rose-700">
          <Heart className="h-3 w-3" /> 100% to 988
        </div>
        <h1 className="mt-3 font-serif text-3xl leading-tight">Give once to 988.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your contribution is designated in full to the 988 Suicide &amp; Crisis Lifeline and transferred in a batch alongside other member designations. Track every dollar on the{" "}
          <a href="/transparency" className="text-forest underline underline-offset-2">
            transparency page
          </a>.
        </p>
      </header>
      <OneTimeContributionSheet />
    </div>
  );
}
