import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight, Headphones, Users, ShoppingBag, Heart, Settings, ShieldCheck, LogOut, User as UserIcon, Sparkles, LifeBuoy } from "lucide-react";
import { ReportIssueDialog } from "@/components/report-issue-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { useSubscription } from "@/hooks/use-subscription";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/more")({
  component: MorePage,
  head: () => ({ meta: [{ title: "More — Mental Health Walk Club" }] }),
});

interface MiniProfile {
  display_name: string | null;
  location_label: string | null;
  city: string | null;
  avatar_url?: string | null;
}

function MorePage() {
  const { user, signOut } = useAuth();
  const { openAuth } = useAuthPrompt();
  const { isPlus } = useSubscription();
  const [p, setP] = useState<MiniProfile | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name,city,location_label").eq("id", user.id).maybeSingle()
      .then(({ data }) => setP(data as MiniProfile | null));
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-5 py-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent">
          <UserIcon className="h-6 w-6 text-forest" />
        </div>
        <h1 className="font-serif text-3xl">More</h1>
        <p className="text-muted-foreground">Create an account to save your walks, set goals, and join groups.</p>
        <Button onClick={() => openAuth("signup")} className="rounded-full bg-forest text-primary-foreground hover:opacity-90">Create your account</Button>
      </div>
    );
  }

  const displayName = p?.display_name || user.email || "Walker";
  const initials = displayName.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const cityLine = p?.location_label || p?.city;
  const since = user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : null;
  const avatar = (user.user_metadata as { avatar_url?: string } | undefined)?.avatar_url;

  return (
    <div className="space-y-5 pb-8">
      <Link
        to="/profile"
        className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft transition active:scale-[0.99] hover:bg-accent/30"
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-accent font-serif text-xl text-forest">
          {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-serif text-xl">{displayName}</h1>
            {isPlus && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                <Heart className="h-3 w-3" /> Supporter
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {cityLine ? `${cityLine}` : "Add your city"}{since ? ` · Walker since ${since}` : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-forest">View profile ›</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>

      <Section title="Explore">
        <Row to="/listen" icon={Headphones} label="Listen" hint="Podcasts & playlists" />
        <Row to="/circles" icon={Users} label="Circles & friends" hint="Manage" />
        
        <Row to="/shop" icon={ShoppingBag} label="Shop" hint="Half funds nonprofits" />
        {isPlus && <Row to="/impact" icon={Sparkles} label="Your impact" hint="Where your Plus goes" />}
      </Section>

      <Section title="Account">
        <Row to="/settings" icon={Settings} label="Settings" hint="Account, notifications, billing" />
        <Row to="/support" icon={ShieldCheck} label="Help & safety" hint="Crisis support" />
        <ReportIssueDialog trigger={
          <button className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm shadow-soft transition active:scale-[0.99] hover:bg-accent/40">
            <LifeBuoy className="h-4 w-4 shrink-0 text-forest" />
            <span className="font-medium">Report a problem</span>
            <span className="ml-auto text-xs text-muted-foreground">Send to team</span>
          </button>
        } />
      </Section>

      <Button variant="outline" onClick={signOut} className="w-full rounded-full">
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ to, icon: Icon, label, hint, hash }: { to: string; icon: typeof Headphones; label: string; hint?: string; hash?: string }) {
  return (
    <Link
      to={to as never}
      hash={hash}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm shadow-soft transition active:scale-[0.99] hover:bg-accent/40"
    >
      <Icon className="h-4 w-4 shrink-0 text-forest" />
      <span className="font-medium">{label}</span>
      {hint && <span className="ml-auto truncate text-xs text-muted-foreground">{hint}</span>}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
