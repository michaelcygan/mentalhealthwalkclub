import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, LogOut, AlertTriangle, User as UserIcon, Pencil, Target, Check, Settings } from "lucide-react";
import { toast } from "sonner";
import { LocationAutosuggest, type LocationValue } from "@/components/location-autosuggest";
import { SectionHeading } from "@/components/section-heading";
import { MyFriendWalks } from "@/components/friend-walk/my-friend-walks";

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
interface Group { id: string; name: string; }

function ProfileTab() {
  const { user, signOut } = useAuth();
  const { openAuth } = useAuthPrompt();
  const [p, setP] = useState<Profile | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [editing, setEditing] = useState<null | "name" | "location" | "bio">(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [weeklyGoal, setWeeklyGoal] = useState<number>(90);
  const [editingGoal, setEditingGoal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name,city,region,country,location_label,lat,lng,bio,is_private").eq("id", user.id).single().then(({ data }) => setP(data as Profile | null));
    supabase.from("group_memberships").select("groups(id,name)").eq("user_id", user.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }) => setGroups((data ?? []).map((r: any) => r.groups).filter(Boolean)));
    supabase.from("goals").select("id,target_value").eq("user_id", user.id).eq("goal_type", "weekly_minutes").eq("is_active", true).maybeSingle()
      .then(({ data }) => { if (data) { setGoalId(data.id); setWeeklyGoal(Number(data.target_value)); } });
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
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
    <div className="space-y-6">
      <header className="flex items-center gap-4 rounded-3xl border border-border bg-gradient-to-br from-accent/40 to-card p-5 shadow-soft">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-forest font-serif text-xl text-primary-foreground">{initials}</div>
        <div className="min-w-0">
          <h1 className="truncate font-serif text-2xl">{p.display_name || "Walker"}</h1>
          <p className="truncate text-sm text-muted-foreground">{p.location_label || p.city || "Add your city"}{since ? ` · since ${since}` : ""}</p>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card shadow-soft">
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

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
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

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <MyFriendWalks />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <SectionHeading eyebrow="Affinities" title="Your groups" />
        {groups.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">You haven't joined any groups yet.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {groups.map((g) => <span key={g.id} className="rounded-full bg-accent px-3 py-1 text-sm text-accent-foreground">{g.name}</span>)}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-serif text-xl"><Shield className="h-5 w-5 text-forest" />Safety & support</h2>
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
        <Link to="/admin/music" className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 text-sm shadow-soft hover:bg-accent/40">
          <span className="flex items-center gap-2 font-medium"><Settings className="h-4 w-4 text-forest" /> Admin · Music library</span>
          <span className="text-xs text-muted-foreground">Manage</span>
        </Link>
      )}

      <Button variant="outline" onClick={signOut} className="rounded-full">
        <LogOut className="mr-2 h-4 w-4" />Sign out
      </Button>
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
