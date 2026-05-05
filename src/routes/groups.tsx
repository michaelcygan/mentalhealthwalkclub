import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/groups")({
  component: GroupsTab,
  head: () => ({ meta: [{ title: "Groups — Walk Club" }] }),
});

interface Group { id: string; name: string; slug: string; description: string | null; member_count: number; theme: string | null; city: string | null; }

function GroupsTab() {
  const { user } = useAuth();
  const { requireAuth } = useAuthPrompt();
  const [groups, setGroups] = useState<Group[]>([]);
  const [mine, setMine] = useState<Set<string>>(new Set());

  const refresh = async () => {
    const { data } = await supabase.from("groups").select("id,name,slug,description,member_count,theme,city").eq("is_active", true).order("name");
    setGroups(data ?? []);
    if (user) {
      const { data: m } = await supabase.from("group_memberships").select("group_id").eq("user_id", user.id);
      setMine(new Set((m ?? []).map((x) => x.group_id)));
    } else {
      setMine(new Set());
    }
  };
  useEffect(() => { refresh(); }, [user]);

  const toggle = (g: Group) => requireAuth(async () => {
    if (!user) return;
    if (mine.has(g.id)) {
      await supabase.from("group_memberships").delete().eq("group_id", g.id).eq("user_id", user.id);
    } else {
      await supabase.from("group_memberships").insert({ group_id: g.id, user_id: user.id });
    }
    refresh();
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl">Groups</h1>
        <p className="mt-1 text-muted-foreground">Quiet affinity tags. They surface walks and rooms that fit you. No feeds. No chat. The walking happens outside.</p>
      </header>
      <ul className="grid gap-3 md:grid-cols-2">
        {groups.map((g) => {
          const joined = mine.has(g.id);
          return (
            <li key={g.id} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-soft">
              <Link to={"/groups/$slug" as never} params={{ slug: g.slug } as never} className="font-serif text-xl hover:text-forest">{g.name}</Link>
              <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{g.member_count} walker{g.member_count === 1 ? "" : "s"}{g.city ? ` · ${g.city}` : ""}</span>
                <Button size="sm" variant={joined ? "outline" : "default"} onClick={() => toggle(g)} className={joined ? "rounded-full" : "rounded-full bg-forest text-primary-foreground hover:opacity-90"}>
                  {joined ? "Joined" : "Join"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
