import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Shield, LogOut, AlertTriangle, User as UserIcon, Pencil, Target, Check, Settings, Flame, Trash2, Users, Compass, CalendarDays, TreePine, Headphones, Heart } from "lucide-react";
import { listHostPlaces } from "@/lib/places.functions";
import { listMySavedTrails } from "@/lib/trails.functions";
import { toast } from "sonner";
import { deleteMyAccount } from "@/lib/account.functions";
import { LocationAutosuggest, type LocationValue } from "@/components/location-autosuggest";
import { SectionHeading } from "@/components/section-heading";
import { BadgeWall } from "@/components/badge-wall";
import { useProfileStats } from "@/hooks/use-profile-stats";
import { BillingCard } from "@/components/billing/billing-card";
import { useSubscription } from "@/hooks/use-subscription";

export const Route = createFileRoute("/profile")({
  component: ProfileTab,
  head: () => ({ meta: [{ title: "Profile — Mental Health Walk Club" }] }),
});

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
  const { user, signOut } = useAuth();
  const { openAuth } = useAuthPrompt();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [p, setP] = useState<Profile | null>(null);
  const [, setGroups] = useState<Array<{id:string; name:string}>>([]);
  const [editing, setEditing] = useState<null | "name" | "location" | "bio">(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [weeklyGoal, setWeeklyGoal] = useState<number>(90);
  const [editingGoal, setEditingGoal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hostPlaces, setHostPlaces] = useState<Array<{ key: string; label: string | null; neighborhood: string | null; group_count: number; next_summary: string | null }>>([]);
  const [savedTrails, setSavedTrails] = useState<Array<{ id: string; name: string | null; kind: string | null }>>([]);
  const stats = useProfileStats(user?.id);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name,city,region,country,location_label,lat,lng,bio,is_private").eq("id", user.id).single().then(({ data }) => setP(data as Profile | null));
    setGroups([]);
    supabase.from("goals").select("id,target_value").eq("user_id", user.id).eq("goal_type", "weekly_minutes").eq("is_active", true).maybeSingle()
      .then(({ data }) => { if (data) { setGoalId(data.id); setWeeklyGoal(Number(data.target_value)); } });
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
    listHostPlaces({ data: { user_id: user.id } })
      .then((r) => setHostPlaces(r.places.map(p => ({ key: p.key, label: p.label, neighborhood: p.neighborhood, group_count: p.group_count, next_summary: p.next_summary }))))
      .catch(() => {});
    listMySavedTrails()
      .then((r) => setSavedTrails(
        (r.saved as Array<{ trail: { id: string; name: string | null; kind: string | null } | null }>)
          .map((s) => s.trail)
          .filter((t): t is { id: string; name: string | null; kind: string | null } => !!t)
      ))
      .catch(() => {});
  }, [user]);

  const savePatch = async (patch: Partial<Profile>) => {
    if (!user || !p) return;
    const next = { ...p, ...patch };
    setP(next);
    setEditing(null);
    await supabase.from("profiles").update(next).eq("id", user.id);
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
    <div className="space-y-5 pb-24">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-accent font-serif text-xl text-forest">{initials}</span>
          <div>
            <h1 className="font-serif text-2xl">{p.display_name || "Walker"}</h1>
            {(p.location_label || p.city) && (
              <p className="text-sm text-muted-foreground">{p.location_label || p.city}</p>
            )}
          </div>
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

      <BillingCard />

      <Link
        to="/discover"
        className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-sm shadow-soft transition active:scale-[0.99] hover:bg-accent/40"
      >
        <span className="flex items-center gap-2 font-medium"><Compass className="h-4 w-4 text-forest" /> Discover</span>
        <span className="text-xs text-muted-foreground">Walks, groups & places ›</span>
      </Link>

      <Link
        to="/listen"
        className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-sm shadow-soft transition active:scale-[0.99] hover:bg-accent/40"
      >
        <span className="flex items-center gap-2 font-medium"><Headphones className="h-4 w-4 text-forest" /> Listen</span>
        <span className="text-xs text-muted-foreground">Podcasts & playlists ›</span>
      </Link>

      <Link
        to="/circles"
        className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-sm shadow-soft transition active:scale-[0.99] hover:bg-accent/40"
      >
        <span className="flex items-center gap-2 font-medium"><Users className="h-4 w-4 text-forest" /> Circles & friends</span>
        <span className="text-xs text-muted-foreground">Manage ›</span>
      </Link>

      {hostPlaces.length > 0 && (
        <section className="rounded-3xl border border-border bg-card p-4 shadow-soft">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Where you host</h2>
            <Link to="/places" className="text-[11px] text-forest underline">all</Link>
          </div>
          <ul className="space-y-2">
            {hostPlaces.slice(0, 4).map((pl) => (
              <li key={pl.key}>
                <Link
                  to="/places/$key"
                  params={{ key: pl.key }}
                  className="block rounded-2xl border border-border bg-background p-3 text-sm transition hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{pl.label ?? pl.neighborhood ?? "Meetup spot"}</div>
                      <div className="mt-0.5 inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{pl.group_count} group{pl.group_count === 1 ? "" : "s"}</span>
                        {pl.next_summary && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {pl.next_summary}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {savedTrails.length > 0 && (
        <section className="rounded-3xl border border-border bg-card p-4 shadow-soft">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Your trails</h2>
            <Link to="/trails" className="text-[11px] text-forest underline">all</Link>
          </div>
          <ul className="space-y-2">
            {savedTrails.slice(0, 4).map((t) => (
              <li key={t.id}>
                <Link
                  to="/trails/$id"
                  params={{ id: t.id }}
                  className="flex items-center gap-2 rounded-2xl border border-border bg-background p-3 text-sm transition hover:bg-accent/30"
                >
                  <TreePine className="h-4 w-4 shrink-0 text-forest" />
                  <span className="min-w-0 flex-1 truncate">{t.name ?? "Unnamed"}</span>
                  <span className="text-[11px] text-muted-foreground">{t.kind ?? "trail"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}







      <button
        onClick={() => setSettingsOpen(true)}
        className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-sm shadow-soft transition active:scale-[0.99] hover:bg-accent/40"
      >
        <span className="flex items-center gap-2 font-medium"><Settings className="h-4 w-4 text-forest" /> Settings & safety</span>
        <span className="text-xs text-muted-foreground">›</span>
      </button>

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
          <SheetHeader><SheetTitle className="font-serif text-2xl">Settings</SheetTitle></SheetHeader>
          <div className="space-y-5 pb-8 pt-4">
            <section className="rounded-2xl border border-border bg-card">
              <InlineRow label="Name" editing={editing === "name"} onEdit={() => setEditing("name")} onCancel={() => setEditing(null)} display={p.display_name || <span className="text-muted-foreground">Add your name</span>}>
                <div className="flex gap-2">
                  <Input autoFocus defaultValue={p.display_name ?? ""} onKeyDown={(e) => { if (e.key === "Enter") savePatch({ display_name: (e.target as HTMLInputElement).value }); }} id="name-input" />
                  <Button size="sm" onClick={() => savePatch({ display_name: (document.getElementById("name-input") as HTMLInputElement).value })} className="rounded-full bg-forest text-primary-foreground">Save</Button>
                </div>
              </InlineRow>
              <InlineRow label="Location" editing={editing === "location"} onEdit={() => setEditing("location")} onCancel={() => setEditing(null)} display={p.location_label || <span className="text-muted-foreground">Add your city</span>}>
                <LocationAutosuggest
                  value={p.location_label ? { city: p.city ?? "", region: p.region, country: p.country, location_label: p.location_label, lat: p.lat, lng: p.lng } : null}
                  onChange={(v: LocationValue | null) => savePatch({ city: v?.city ?? null, region: v?.region ?? null, country: v?.country ?? null, location_label: v?.location_label ?? null, lat: v?.lat ?? null, lng: v?.lng ?? null })}
                />
              </InlineRow>
              <InlineRow label="Bio" editing={editing === "bio"} onEdit={() => setEditing("bio")} onCancel={() => setEditing(null)} display={p.bio || <span className="text-muted-foreground">A few words about you</span>} last>
                <div className="space-y-2">
                  <textarea autoFocus id="bio-input" rows={3} defaultValue={p.bio ?? ""} className="w-full rounded-xl border border-input bg-background p-3 text-sm" />
                  <Button size="sm" onClick={() => savePatch({ bio: (document.getElementById("bio-input") as HTMLTextAreaElement).value })} className="rounded-full bg-forest text-primary-foreground">Save</Button>
                </div>
              </InlineRow>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 font-serif text-lg"><Shield className="h-4 w-4 text-forest" />Safety & support</h2>
              <div className="mt-3 space-y-2 text-sm">
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3">
                  <div className="flex items-center gap-2 font-medium text-destructive"><AlertTriangle className="h-4 w-4" />In immediate danger? Call your local emergency services.</div>
                </div>
                <div className="rounded-xl bg-secondary p-3">
                  US mental health crisis: call or text <a href="tel:988" className="font-medium text-forest underline">988</a>.
                </div>
              </div>
            </section>

            {isAdmin && (
              <Link to="/admin/podcasts" className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 text-sm shadow-soft hover:bg-accent/40">
                <span className="flex items-center gap-2 font-medium"><Settings className="h-4 w-4 text-forest" /> Admin · Podcasts</span>
                <span className="text-xs text-muted-foreground">Manage</span>
              </Link>
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
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InlineRow({ label, display, editing, onEdit, onCancel, children, last }: { label: string; display: React.ReactNode; editing: boolean; onEdit: () => void; onCancel: () => void; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex flex-col gap-2 p-5 ${last ? "" : "border-b border-border"}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
        {editing ? (
          <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
        ) : (
          <button onClick={onEdit} className="text-xs text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
        )}
      </div>
      {editing ? children : <div className="text-sm">{display}</div>}
    </div>
  );
}
