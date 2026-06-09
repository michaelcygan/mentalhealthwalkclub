import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Phone, MessageSquare, Globe, AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/support")({
  component: SupportPage,
  head: () => ({
    meta: [
      { title: "Support — Mental Health Walk Club" },
      { name: "description", content: "Crisis support resources. You're not alone." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function SupportPage() {
  const router = useRouter();
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
    else router.navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-md space-y-6 pb-12 pt-2">
      <button
        type="button"
        onClick={goBack}
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
        aria-label="Back"
      >
        <ArrowLeft className="h-4 w-4" />Back
      </button>

      <header className="space-y-2 pt-2">
        <h1 className="font-serif text-3xl leading-tight">You're not alone.</h1>
        <p className="text-muted-foreground">
          If you're in crisis or just need someone to talk to, help is available right now — free, confidential, 24/7.
        </p>
      </header>

      <section className="space-y-3">
        <a
          href="tel:988"
          className="flex w-full items-center gap-3 rounded-2xl bg-forest p-5 text-primary-foreground shadow-soft transition active:scale-[0.99]"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-white/15">
            <Phone className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-serif text-xl leading-tight">Call 988</span>
            <span className="block text-xs text-primary-foreground/80">Suicide &amp; Crisis Lifeline · US</span>
          </span>
        </a>
        <a
          href="sms:988"
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft transition active:scale-[0.99]"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-accent text-forest">
            <MessageSquare className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-serif text-lg leading-tight">Text 988</span>
            <span className="block text-xs text-muted-foreground">Prefer to type? A counselor will reply.</span>
          </span>
        </a>
      </section>

      <section className="rounded-2xl border border-border bg-secondary/60 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
          <p className="text-sm">
            <span className="font-medium">In immediate danger?</span>{" "}
            <span className="text-muted-foreground">Call <a href="tel:911" className="font-medium text-forest underline">911</a> or your local emergency number.</span>
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">More ways to get help</h2>
        <ResourceRow
          title="Crisis Text Line"
          body={<>Text <span className="font-medium text-forest">HOME</span> to <a href="sms:741741" className="font-medium text-forest underline">741741</a></>}
        />
        <ResourceRow
          title="Trans Lifeline"
          body={<a href="tel:18775658860" className="font-medium text-forest underline">1-877-565-8860</a>}
        />
        <ResourceRow
          title="Veterans Crisis Line"
          body={<>Dial <a href="tel:988" className="font-medium text-forest underline">988</a>, then press <span className="font-medium">1</span></>}
        />
        <ResourceRow
          title="Outside the US"
          body={
            <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-forest underline">
              <Globe className="h-3.5 w-3.5" />findahelpline.com
            </a>
          }
        />
      </section>

      <footer className="space-y-2 px-1 pt-2 text-[11px] text-muted-foreground">
        <p>
          Mental Health Walk Club is a community, not a clinical service. Walking with others can help, but it isn't a substitute for care.
        </p>
        <p>
          <Link to="/privacy" className="underline hover:text-foreground">Privacy</Link>
          <span aria-hidden> · </span>
          <Link to="/terms" className="underline hover:text-foreground">Terms</Link>
        </p>
      </footer>
    </div>
  );
}

function ResourceRow({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-0.5 text-sm text-muted-foreground">{body}</div>
    </div>
  );
}
