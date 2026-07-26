import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { User as UserIcon, Pencil, Target, Check, Flame, Heart, Settings } from "lucide-react";
import { toast } from "sonner";
import { LocationAutosuggest, type LocationValue } from "@/components/location-autosuggest";
import { SectionHeading } from "@/components/section-heading";
import { BadgeWall } from "@/components/badge-wall";
import { useProfileStats } from "@/hooks/use-profile-stats";
import { WeeklySparkline } from "@/components/charts/weekly-sparkline";
import { useSubscription } from "@/hooks/use-subscription";

export const Route = createFileRoute("/profile")({
  component: ProfileTab,
  head: () => ({
    meta: [
      { title: "Profile — Mental Health Walk Club" },
      { name: "description", content: "Manage your Mental Health Walk Club profile, location, privacy, and weekly goals." },
      { property: "og:title", content: "Profile — Mental Health Walk Club" },
      { property: "og:description", content: "Manage your Mental Health Walk Club profile, location, privacy, and weekly goals." },
      { property: "og:url", content: "https://mentalhealthwalkclub.com/profile" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://mentalhealthwalkclub.com/__l5e/assets-v1/a9e1c704-8b35-4af9-8a3b-6571b05a857e/og-default-v4.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://mentalhealthwalkclub.com/__l5e/assets-v1/a9e1c704-8b35-4af9-8a3b-6571b05a857e/og-default-v4.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://mentalhealthwalkclub.com/profile" }],
  }),
});

function WalkClubStats({ userId }: { userId: string }) {
  const [s, setS] = useState<{ walks_hosted: number; walks_attended: number; current_streak_weeks: number } | null>(null);
  useEffect(() => {
    supabase
      .from("profiles")
      .select("walks_hosted,walks_attended,current_streak_weeks")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => setS(data ?? null));
  }, [userId]);
  if (!s || (s.walks_hosted === 0 && s.walks_attended === 0)) return null;
  return (
    <section className="rounded-3xl border border-border bg-card/60 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Walk Club</p>
      <div className="mt-2 grid grid-cols-3 gap-3 text-center">
        <div><div className="font-serif text-xl tabular-nums">{s.walks_hosted}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">hosted</div></div>
        <div><div className="font-serif text-xl tabular-nums">{s.walks_attended}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">attended</div></div>
        <div><div className="font-serif text-xl tabular-nums">{s.current_streak_weeks}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">wk streak</div></div>
      </div>
    </section>
  );
}

interface Profile {
  display_name: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  location_label: string | null;
  lat: number | null;
  lng: number | null;
  bio: string | null;
  is_private: boolean;
}

function ProfileTab() {
  const { user } = useAuth();
  const { openAuth } = useAuthPrompt();
  const [p, setP] = useState<Profile | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [weeklyGoal, setWeeklyGoal] = useState<number>(90);
  const [editingGoal, setEditingGoal] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const stats = useProfileStats(user?.id);
  const { isPlus } = useSubscription();

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("profiles").select("display_name,city,region,country,location_label,bio,is_private").eq("id", user.id).single(),
      (supabase.from("user_locations" as never) as never as { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { lat: number | null; lng: number | null } | null }> } } })
        .select("lat,lng").eq("user_id", user.id).maybeSingle(),
    ]).then(([profRes, locRes]) => {
      const base = profRes.data as Omit<Profile, "lat" | "lng"> | null;
      if (!base) return;
      const row: Profile = { ...base, lat: locRes.data?.lat ?? null, lng: locRes.data?.lng ?? null };
      setP(row);
      setNameDraft(row.display_name ?? "");
      setBioDraft(row.bio ?? "");
    });
    supabase.from("goals").select("id,target_value").eq("user_id", user.id).eq("goal_type", "weekly_minutes").eq("is_active", true).maybeSingle()
      .then(({ data }) => { if (data) { setGoalId(data.id); setWeeklyGoal(Number(data.target_value)); } });
  }, [user]);

  const savePatch = async (patch: Partial<Profile>) => {
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

  const saveGoal = async () => {
    if (!user) return;
    if (goalId) {
      await supabase.from("goals").update({ target_value: weeklyGoal }).eq("id", goalId);
    } else {
      const { data } = await supabase.from("goals").insert({ user_id: user.id, goal_type: "weekly_minutes", target_value: weeklyGoal, period: "weekly" }).select("id").single();
      if (data) setGoalId(data.id);
    }
    setEditingGoal(false);
    toast.success("Goal updated.");
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-5 py-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent">
          <UserIcon className="h-6 w-6 text-forest" />
        </div>
        <h1 className="font-serif text-3xl">Your profile</h1>
        <p className="text-muted-foreground">Create an account to save your walks, set goals, and join groups that fit you.</p>
        <Button onClick={() => openAuth("signup")} className="rounded-full bg-forest text-primary-foreground hover:opacity-90">Create your account</Button>
      </div>
    );
  }

  if (!p) return <div className="py-20 text-center text-muted-foreground">…</div>;

  const initials = (p.display_name || user.email || "?").split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const since = user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : null;

  return (
    <div className="space-y-5 pb-8">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-accent font-serif text-xl text-forest">{initials}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-serif text-2xl">{p.display_name || "Walker"}</h1>
              {isPlus && (
                <Link
                  to="/impact"
                  className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700 hover:bg-rose-200"
                  title="You're supporting the 988 Suicide & Crisis Lifeline"
                >
                  <Heart className="h-3 w-3" /> Plus
                </Link>
              )}
            </div>
            <div className="font-hand text-lg text-clay">hello again</div>
            {(p.location_label || p.city) && (
              <p className="text-sm text-muted-foreground">{p.location_label || p.city}</p>
            )}
            {p.bio && <p className="mt-2 text-sm text-foreground/80">{p.bio}</p>}
          </div>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            aria-label="Edit profile"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div><div className="font-serif text-xl tabular-nums">{stats.totalWalks}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">walks</div></div>
          <div><div className="font-serif text-xl tabular-nums">{stats.totalMinutes}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">minutes</div></div>
          <div><div className="font-serif text-xl tabular-nums">{stats.totalMiles.toFixed(1)}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">miles</div></div>
        </div>
      </section>

      {stats.weekStreak > 0 && (
        <div className="flex items-center justify-center gap-2 rounded-full border border-clay/30 bg-clay/10 py-2 text-sm">
          <Flame className="h-4 w-4 text-clay" />
          <span className="font-serif italic">{stats.weekStreak} week{stats.weekStreak === 1 ? "" : "s"} in a row · rest counts too</span>
        </div>
      )}

      {stats.totalWalks > 0 && <WeeklySparkline userId={user.id} />}

      <WalkClubStats userId={user.id} />

      <BadgeWall userId={user.id} />

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <SectionHeading eyebrow="Pace yourself" title="Weekly goal" />
        <div className="mt-3 flex items-center gap-3">
          <Target className="h-5 w-5 text-forest" />
          {editingGoal ? (
            <>
              <Input type="number" min={10} max={600} value={weeklyGoal} onChange={(e) => setWeeklyGoal(Number(e.target.value))} className="w-24" />
              <span className="text-sm text-muted-foreground">min / week</span>
              <Button size="sm" onClick={saveGoal} className="rounded-full bg-forest text-primary-foreground"><Check className="h-3.5 w-3.5" /></Button>
            </>
          ) : (
            <>
              <span className="font-serif text-xl">{weeklyGoal}</span>
              <span className="text-sm text-muted-foreground">minutes a week</span>
              <button onClick={() => setEditingGoal(true)} className="ml-auto text-xs text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
            </>
          )}
        </div>
      </section>


      <Link
        to="/settings"
        className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-sm shadow-soft transition active:scale-[0.99] hover:bg-accent/40"
      >
        <span className="flex items-center gap-2 font-medium"><Settings className="h-4 w-4 text-forest" /> Settings</span>
        <span className="text-xs text-muted-foreground">Account, billing, safety ›</span>
      </Link>

      {since && <p className="text-center text-[11px] text-muted-foreground">Walker since {since}</p>}

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
          <SheetHeader><SheetTitle className="font-serif text-2xl">Edit profile</SheetTitle></SheetHeader>
          <div className="space-y-4 pb-8 pt-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Display name</Label>
              <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onBlur={() => nameDraft !== p.display_name && savePatch({ display_name: nameDraft })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Location</Label>
              <LocationAutosuggest
                value={p.location_label ? { city: p.city ?? "", region: p.region, country: p.country, location_label: p.location_label, lat: p.lat, lng: p.lng } : null}
                onChange={(v: LocationValue | null) => savePatch({ city: v?.city ?? null, region: v?.region ?? null, country: v?.country ?? null, location_label: v?.location_label ?? null, lat: v?.lat ?? null, lng: v?.lng ?? null })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Bio</Label>
              <textarea
                rows={3}
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
                onBlur={() => bioDraft !== (p.bio ?? "") && savePatch({ bio: bioDraft })}
                className="w-full rounded-xl border border-input bg-background p-3 text-sm"
                placeholder="A few words about you"
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">Private profile</div>
                <div className="text-[11px] text-muted-foreground">Hide your activity from public pages</div>
              </div>
              <Switch checked={!!p.is_private} onCheckedChange={(v) => savePatch({ is_private: v })} />
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              More settings live in <Link to="/settings" className="text-forest underline" onClick={() => setEditOpen(false)}>Settings</Link>.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
