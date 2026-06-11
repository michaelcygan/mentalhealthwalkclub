import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Shield, LogOut, Trash2, Settings as SettingsIcon, Bell, Sparkles, ChevronRight, FileText, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { useSubscription } from "@/hooks/use-subscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LocationAutosuggest, type LocationValue } from "@/components/location-autosuggest";
import { BillingCard } from "@/components/billing/billing-card";
import { SupporterCard } from "@/components/billing/supporter-card";
import { deleteMyAccount } from "@/lib/account.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Mental Health Walk Club" }] }),
});

interface ProfileRow {
  display_name: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  location_label: string | null;
  lat: number | null;
  lng: number | null;
  bio: string | null;
  is_private: boolean;
  notify_friend_requests: boolean;
  notify_high_fives: boolean;
  notify_rsvps: boolean;
  notify_broadcasts: boolean;
}

function SettingsPage() {
  const { user, signOut } = useAuth();
  const { openAuth } = useAuthPrompt();
  const { isPlus } = useSubscription();
  const navigate = useNavigate();
  const [p, setP] = useState<ProfileRow | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("profiles").select("display_name,city,region,country,location_label,bio,is_private,notify_friend_requests,notify_high_fives,notify_rsvps,notify_broadcasts").eq("id", user.id).single(),
      (supabase.from("user_locations" as never) as never as { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { lat: number | null; lng: number | null } | null }> } } })
        .select("lat,lng").eq("user_id", user.id).maybeSingle(),
    ]).then(([profRes, locRes]) => {
      const base = profRes.data as Omit<ProfileRow, "lat" | "lng"> | null;
      if (!base) return;
      const row: ProfileRow = { ...base, lat: locRes.data?.lat ?? null, lng: locRes.data?.lng ?? null };
      setP(row);
      setBioDraft(row.bio ?? "");
      setNameDraft(row.display_name ?? "");
    });
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const savePatch = async (patch: Partial<ProfileRow>) => {
    if (!user || !p) return;
    const next = { ...p, ...patch };
    setP(next);
    const { lat, lng, ...profilePatch } = patch;
    if (Object.keys(profilePatch).length > 0) {
      await supabase.from("profiles").update(profilePatch).eq("id", user.id);
    }
    if ("lat" in patch || "lng" in patch) {
      await (supabase.from("user_locations" as never) as never as { upsert: (row: object, opts: object) => Promise<unknown> })
        .upsert({ user_id: user.id, lat: lat ?? null, lng: lng ?? null }, { onConflict: "user_id" });
    }
    toast.success("Saved.");
  };



  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-5 py-12 text-center">
        <h1 className="font-serif text-3xl">Settings</h1>
        <p className="text-muted-foreground">Sign in to manage your account.</p>
        <Button onClick={() => openAuth("signin")} className="rounded-full bg-forest text-primary-foreground hover:opacity-90">Sign in</Button>
      </div>
    );
  }

  if (!p) return <div className="py-20 text-center text-muted-foreground">…</div>;

  const since = user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : null;

  return (
    <div className="space-y-6 pb-8">
      <header className="flex items-center gap-3">
        <Link to="/more" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-serif text-3xl">Settings</h1>
      </header>

      <SectionCard title="Account" icon={SettingsIcon}>
        <Field label="Display name">
          <div className="flex gap-2">
            <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onBlur={() => nameDraft !== p.display_name && savePatch({ display_name: nameDraft })} />
          </div>
        </Field>
        <Field label="Location">
          <LocationAutosuggest
            value={p.location_label ? { city: p.city ?? "", region: p.region, country: p.country, location_label: p.location_label, lat: p.lat, lng: p.lng } : null}
            onChange={(v: LocationValue | null) => savePatch({ city: v?.city ?? null, region: v?.region ?? null, country: v?.country ?? null, location_label: v?.location_label ?? null, lat: v?.lat ?? null, lng: v?.lng ?? null })}
          />
        </Field>
        <Field label="Bio">
          <textarea
            rows={3}
            value={bioDraft}
            onChange={(e) => setBioDraft(e.target.value)}
            onBlur={() => bioDraft !== (p.bio ?? "") && savePatch({ bio: bioDraft })}
            className="w-full rounded-xl border border-input bg-background p-3 text-sm"
            placeholder="A few words about you"
          />
        </Field>
        <Field label="Email">
          <Input value={user.email ?? ""} readOnly className="text-muted-foreground" />
        </Field>
        <ToggleRow
          label="Private profile"
          hint="Hide your activity from public pages"
          checked={!!p.is_private}
          onChange={(v) => savePatch({ is_private: v })}
        />
      </SectionCard>

      <SectionCard title="Membership" icon={Sparkles}>
        <div className="-m-1 space-y-3">
          <BillingCard />
          <SupporterCard />
        </div>
        {isPlus && (
          <Link to="/impact" className="mt-3 flex items-center justify-between rounded-xl border border-border bg-background p-3 text-sm hover:bg-accent/30">
            <span>Your impact</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        )}
      </SectionCard>

      <SectionCard title="Notifications" icon={Bell}>
        <ToggleRow label="Friend requests" hint="New requests and acceptances" checked={!!p.notify_friend_requests} onChange={(v) => savePatch({ notify_friend_requests: v })} />
        <ToggleRow label="RSVPs to your walks" hint="When someone joins a walk you're hosting" checked={!!p.notify_rsvps} onChange={(v) => savePatch({ notify_rsvps: v })} />
        <ToggleRow label="High-fives" hint="When friends cheer your walks" checked={!!p.notify_high_fives} onChange={(v) => savePatch({ notify_high_fives: v })} />
        <ToggleRow label="Walk broadcasts" hint="Updates from hosts of walks you're on" checked={!!p.notify_broadcasts} onChange={(v) => savePatch({ notify_broadcasts: v })} />
        <p className="px-1 pt-1 text-[11px] text-muted-foreground">In-app only for now — email & push coming soon.</p>
      </SectionCard>

      <SectionCard title="Privacy & data" icon={FileText}>
        <LinkRow to="/privacy" label="Privacy policy" />
        <LinkRow to="/terms" label="Terms" />
      </SectionCard>

      <section id="safety" className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="flex items-center gap-2 font-serif text-lg"><Shield className="h-4 w-4 text-forest" />Safety &amp; support</h2>
        <p className="mt-2 text-sm text-muted-foreground">If you're in crisis or need someone to talk to, we keep a quiet page with direct lines.</p>
        <Link to="/support" className="mt-3 inline-flex items-center justify-center rounded-full bg-forest px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          Open support
        </Link>
      </section>

      {isAdmin && (
        <SectionCard title="Admin" icon={ShieldCheck}>
          <LinkRow to="/admin" label="Admin home" />
          <LinkRow to="/admin/podcasts" label="Podcasts" />
          <LinkRow to="/admin/merch" label="Merch" />
        </SectionCard>
      )}

      <Button variant="outline" onClick={signOut} className="w-full rounded-full">
        <LogOut className="mr-2 h-4 w-4" />Sign out
      </Button>

      <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <h2 className="flex items-center gap-2 font-serif text-lg text-destructive"><Trash2 className="h-4 w-4" />Delete account</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Permanently removes your profile, walks, journals, friend walks, RSVPs, and group memberships. This cannot be undone.
        </p>
        <Button
          variant="destructive"
          disabled={deleting}
          onClick={async () => {
            if (!confirm("Permanently delete your account and all your data? This cannot be undone.")) return;
            if (!confirm("Last chance — really delete everything?")) return;
            setDeleting(true);
            try {
              await deleteMyAccount();
              await signOut();
              toast.success("Account deleted.");
              navigate({ to: "/" });
            } catch (e) {
              setDeleting(false);
              toast.error(e instanceof Error ? e.message : "Could not delete account.");
            }
          }}
          className="mt-3 w-full rounded-full"
        >
          <Trash2 className="mr-2 h-4 w-4" />{deleting ? "Deleting…" : "Delete my account"}
        </Button>
      </section>

      {since && <p className="text-center text-[11px] text-muted-foreground">Walker since {since}</p>}
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: typeof SettingsIcon; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <h2 className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />{title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function LinkRow({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to as never} className="flex items-center justify-between rounded-xl border border-border bg-background p-3 text-sm hover:bg-accent/30">
      <span>{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

