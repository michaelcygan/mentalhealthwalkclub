import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Sparkles, Heart, Users } from "lucide-react";

export const Route = createFileRoute("/admin/membership")({
  component: AdminMembershipPage,
});

interface Settings {
  saved_reads_cap: number;
  playlists_cap: number;
  collections_follow_cap: number;
  supporter_min_cents: number;
  supporter_suggested_amounts: number[];
  supporter_signups_paused: boolean;
}

interface Breakdown {
  plus_monthly: number;
  plus_yearly: number;
  supporter: number;
  supporter_mrr_cents: number;
  plus_mrr_cents: number;
}

function AdminMembershipPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [supporters, setSupporters] = useState<
    { user_id: string; monthly_amount_cents: number; display_on_wall: boolean; joined_at: string; display_name: string | null }[]
  >([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("membership_settings" as never)
      .select("*")
      .eq("id", true)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setSettings(data as unknown as Settings);
        setDraft(data as unknown as Settings);
      });

    // Tier breakdown via two parallel reads
    (async () => {
      const env = getStripeEnvironment();
      const [{ data: subs }, { data: supporterRows }] = await Promise.all([
        supabase
          .from("subscriptions" as never)
          .select("price_id, monthly_amount_cents, status, subscription_kind, environment, current_period_end")
          .in("status", ["active", "trialing", "past_due"]),
        supabase
          .from("supporter_profile" as never)
          .select("user_id, monthly_amount_cents, display_on_wall, joined_at"),
      ]);
      const rows = (subs as unknown as { price_id: string; monthly_amount_cents: number | null; subscription_kind: string; environment: string }[]) ?? [];
      const live = rows.filter((r) => r.environment === env);
      const plusM = live.filter((r) => r.subscription_kind === "plus" && (r.price_id === "plus_monthly" || r.price_id === "plus_monthly_v2")).length;
      const plusY = live.filter((r) => r.subscription_kind === "plus" && (r.price_id === "plus_yearly" || r.price_id === "plus_yearly_v2")).length;
      const supporterCount = live.filter((r) => r.subscription_kind === "supporter").length;
      const supporterMrr = live
        .filter((r) => r.subscription_kind === "supporter")
        .reduce((acc, r) => acc + (r.monthly_amount_cents ?? 0), 0);
      const plusMrr = plusM * 199 + plusY * Math.round(1900 / 12);
      setBreakdown({ plus_monthly: plusM, plus_yearly: plusY, supporter: supporterCount, supporter_mrr_cents: supporterMrr, plus_mrr_cents: plusMrr });

      // Recent supporters with display names
      const sRows = (supporterRows as unknown as { user_id: string; monthly_amount_cents: number; display_on_wall: boolean; joined_at: string }[]) ?? [];
      if (sRows.length === 0) {
        setSupporters([]);
        return;
      }
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", sRows.map((r) => r.user_id));
      const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
      setSupporters(
        sRows
          .filter((r) => r.monthly_amount_cents > 0)
          .sort((a, b) => +new Date(b.joined_at) - +new Date(a.joined_at))
          .map((r) => ({ ...r, display_name: nameMap.get(r.user_id) ?? null })),
      );
    })();
  }, []);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const { error } = await supabase
      .from("membership_settings" as never)
      .update(draft as never)
      .eq("id", true);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      setSettings(draft);
      toast.success("Saved");
    }
  };

  if (!draft) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-serif text-xl">Membership</h2>
        <p className="text-sm text-muted-foreground">Tune free caps and Supporter amounts without redeploying.</p>
      </header>

      {/* Breakdown */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Tile icon={Sparkles} label="Plus monthly" value={breakdown?.plus_monthly ?? "—"} />
        <Tile icon={Sparkles} label="Plus yearly" value={breakdown?.plus_yearly ?? "—"} />
        <Tile icon={Heart} label="Supporters" value={breakdown?.supporter ?? "—"} />
        <Tile icon={Users} label="Plus MRR" value={breakdown ? `$${(breakdown.plus_mrr_cents / 100).toFixed(0)}` : "—"} />
        <Tile icon={Heart} label="Supporter MRR" value={breakdown ? `$${(breakdown.supporter_mrr_cents / 100).toFixed(0)}` : "—"} />
        <Tile icon={Heart} label="Combined MRR" value={breakdown ? `$${((breakdown.plus_mrr_cents + breakdown.supporter_mrr_cents) / 100).toFixed(0)}` : "—"} />
      </section>

      {/* Free caps */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-serif text-lg">Free-plan caps</h3>
        <CapRow
          label="Saved reads"
          value={draft.saved_reads_cap}
          onChange={(v) => setDraft({ ...draft, saved_reads_cap: v })}
        />
        <CapRow
          label="Custom playlists"
          value={draft.playlists_cap}
          onChange={(v) => setDraft({ ...draft, playlists_cap: v })}
        />
        <CapRow
          label="Collections followed"
          value={draft.collections_follow_cap}
          onChange={(v) => setDraft({ ...draft, collections_follow_cap: v })}
        />
      </section>

      {/* Supporter settings */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-serif text-lg">Supporter tier</h3>
        <div className="flex items-center justify-between">
          <div>
            <Label className="font-medium">Pause new Supporter signups</Label>
            <p className="text-xs text-muted-foreground">Existing Supporters keep giving; checkout is blocked.</p>
          </div>
          <Switch
            checked={draft.supporter_signups_paused}
            onCheckedChange={(v) => setDraft({ ...draft, supporter_signups_paused: v })}
          />
        </div>
        <div className="grid gap-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Minimum amount (cents)</Label>
          <Input
            type="number"
            min={100}
            value={draft.supporter_min_cents}
            onChange={(e) => setDraft({ ...draft, supporter_min_cents: Math.max(100, Number(e.target.value) || 0) })}
          />
        </div>
        <div className="grid gap-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Suggested amounts (comma-separated cents)</Label>
          <Input
            value={draft.supporter_suggested_amounts.join(", ")}
            onChange={(e) =>
              setDraft({
                ...draft,
                supporter_suggested_amounts: e.target.value
                  .split(",")
                  .map((s) => Number(s.trim()))
                  .filter((n) => Number.isInteger(n) && n >= 100),
              })
            }
          />
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button
          disabled={!dirty || saving}
          onClick={save}
          className="rounded-full bg-forest text-primary-foreground hover:opacity-90"
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-serif text-lg">Recent Supporters</h3>
        {supporters.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No Supporters yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {supporters.slice(0, 25).map((p) => (
              <li key={p.user_id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-medium">{p.display_name ?? "Supporter"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Joined {new Date(p.joined_at).toLocaleDateString()} · {p.display_on_wall ? "On wall" : "Private"}
                  </div>
                </div>
                <div className="font-serif text-sm">${(p.monthly_amount_cents / 100).toFixed(0)}/mo</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Tile({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 font-serif text-2xl">{value}</div>
    </div>
  );
}

function CapRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="font-medium">{label}</Label>
      <Input
        type="number"
        min={1}
        max={1000}
        value={value}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
        className="max-w-[100px]"
      />
    </div>
  );
}
