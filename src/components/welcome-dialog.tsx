import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Footprints, Headphones, MapPin, Mic, Sparkles, Check } from "lucide-react";
import { LogoStamp } from "@/components/logo-stamp";
import type { AuthPlan } from "@/components/auth-form";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignUp: (plan: AuthPlan) => void;
  onSignIn: () => void;
}

export function WelcomeDialog({ open, onOpenChange, onSignUp, onSignIn }: Props) {
  const [plan, setPlan] = useState<AuthPlan>("plus");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl border-border bg-card p-0 sm:max-w-lg">
        {/* Header */}
        <div className="gradient-warm rounded-t-3xl px-7 pb-6 pt-7">
          <div className="flex items-center gap-3">
            <LogoStamp tone="dark" size={48} />
            <div className="flex-1">
              <h2 className="font-serif text-xl leading-tight text-foreground">Mental Health Walk Club</h2>
              <p className="text-xs text-muted-foreground">Movement is the medicine. Company is the cure.</p>
            </div>
            <button
              onClick={onSignIn}
              className="shrink-0 rounded-full border border-forest/30 bg-card/70 px-3 py-1.5 text-xs font-medium text-forest backdrop-blur-sm transition hover:bg-card"
            >
              Sign in
            </button>
          </div>
          <p className="mt-4 font-serif text-lg leading-snug text-foreground">
            Take the walk. Let it count. Show up for someone — or have someone show up for you.
          </p>
        </div>

        {/* What you get */}
        <div className="px-7 pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Four ways to walk</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <Feature icon={Footprints} title="Solo" body="Track every walk. Mood, route, reflection." />
            <Feature icon={Headphones} title="Guided" body="A calm voice in your ear when you need it." />
            <Feature icon={Mic} title="Walk & Talk" body="Live audio rooms — only joinable while walking." />
            <Feature icon={MapPin} title="Local Walks" body="RSVP to in-person meetups in your city." />
          </div>
        </div>

        {/* Plans */}
        <div className="px-7 pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Choose your plan</p>
          <div role="radiogroup" aria-label="Membership plan" className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <PlanCard
              name="Free"
              price="$0"
              tagline="Walk forever, on the house."
              items={[
                "Unlimited Solo walks",
                "Unlimited Guided walks",
                "5 Walk & Talk rooms / month",
                "Private route + mood history",
              ]}
              selected={plan === "free"}
              onSelect={() => setPlan("free")}
            />
            <PlanCard
              name="Plus"
              price="$4.99/mo"
              highlight
              tagline="30 days free. Cancel anytime."
              items={[
                "Everything in Free",
                "Unlimited Walk & Talks",
                "RSVP to in-person Local Walks",
                "Early access to new chapters",
              ]}
              selected={plan === "plus"}
              onSelect={() => setPlan("plus")}
            />
          </div>
        </div>

        {/* CTAs */}
        <div className="space-y-2 px-7 pb-7 pt-6">
          <Button
            onClick={() => onSignUp(plan)}
            className="h-12 w-full rounded-full bg-forest text-primary-foreground hover:opacity-90"
          >
            {plan === "plus" ? "Start your 1-month free trial" : "Create your free account"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            {plan === "plus"
              ? "No card needed today. $4.99/mo after 30 days. Cancel anytime."
              : "Free forever. Upgrade to Plus anytime."}
          </p>
          <Button variant="ghost" onClick={onSignIn} className="w-full rounded-full">
            I already have one — sign in
          </Button>
          <p className="pt-1 text-center font-serif text-xs italic text-muted-foreground">
            Peer support, not therapy. If you're in crisis, call or text 988.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Feature({ icon: Icon, title, body }: { icon: typeof Footprints; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
        <Icon className="h-4 w-4 text-forest" />
      </div>
      <h3 className="mt-2 text-sm font-medium text-foreground">{title}</h3>
      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{body}</p>
    </div>
  );
}

function PlanCard({
  name,
  price,
  tagline,
  items,
  highlight,
  selected,
  onSelect,
}: {
  name: string;
  price: string;
  tagline: string;
  items: string[];
  highlight?: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`relative rounded-2xl border p-4 text-left transition ${
        selected
          ? highlight
            ? "border-forest bg-accent/60 ring-2 ring-forest/40"
            : "border-forest bg-card ring-2 ring-forest/40"
          : highlight
            ? "border-border bg-accent/30 hover:border-forest/40"
            : "border-border bg-card/60 hover:border-forest/40"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-1.5 font-serif text-base font-medium text-foreground">
          {highlight && <Sparkles className="h-3.5 w-3.5 text-forest" />}
          {name}
        </span>
        <span className="text-sm font-semibold text-foreground">{price}</span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{tagline}</p>
      <ul className="mt-3 space-y-1.5">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-1.5 text-[12px] leading-snug text-foreground/80">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-forest" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
      {selected && (
        <span className="absolute right-3 top-3 rounded-full bg-forest px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
          Selected
        </span>
      )}
    </button>
  );
}
