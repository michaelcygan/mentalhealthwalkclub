import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, LogOut, AlertTriangle, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { LocationAutosuggest, type LocationValue } from "@/components/location-autosuggest";

export const Route = createFileRoute("/profile")({
  component: ProfileTab,
  head: () => ({ meta: [{ title: "Profile — Walk Club" }] }),
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

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name,city,bio,is_private").eq("id", user.id).single().then(({ data }) => setP(data));
    supabase.from("group_memberships").select("groups(id,name)").eq("user_id", user.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }) => setGroups((data ?? []).map((r: any) => r.groups).filter(Boolean)));
  }, [user]);

  const save = async () => {
    if (!user || !p) return;
    await supabase.from("profiles").update(p).eq("id", user.id);
    toast.success("Saved.");
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl">Profile</h1>
      </header>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div>
          <Label>Name</Label>
          <Input value={p.display_name ?? ""} onChange={(e) => setP({ ...p, display_name: e.target.value })} />
        </div>
        <div>
          <Label>City / Chapter</Label>
          <Input value={p.city ?? ""} onChange={(e) => setP({ ...p, city: e.target.value })} />
        </div>
        <div>
          <Label>A few words about you</Label>
          <textarea rows={3} value={p.bio ?? ""} onChange={(e) => setP({ ...p, bio: e.target.value })} className="w-full rounded-xl border border-input bg-background p-3 text-sm" />
        </div>
        <Button onClick={save} className="rounded-full bg-forest text-primary-foreground hover:opacity-90">Save</Button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-serif text-xl">Your groups</h2>
        {groups.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">You haven't joined any groups yet. They're just chips — they help us match you to walks that fit.</p>
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

      <section className="rounded-2xl border border-border bg-card p-5 text-sm">
        <h2 className="font-serif text-xl">Our impact</h2>
        <p className="mt-1 text-muted-foreground">A portion of every paid walk is donated to mental health organizations. Transparency over time.</p>
      </section>

      <Button variant="outline" onClick={signOut} className="rounded-full">
        <LogOut className="mr-2 h-4 w-4" />Sign out
      </Button>
    </div>
  );
}
