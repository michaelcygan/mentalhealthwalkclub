import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/section-heading";

export const Route = createFileRoute("/groups")({
  component: GroupsTab,
  head: () => ({ meta: [{ title: "Groups — Walk Club" }] }),
});

interface Group { id: string; name: string; slug: string; description: string | null; member_count: number; theme: string | null; city: string | null; }

const themeTint: Record<string, string> = {
  anxiety: "from-sky-100/60",
  burnout: "from-orange-100/60",
  grief: "from-violet-100/60",
  depression: "from-indigo-100/60",
  loneliness: "from-rose-100/60",
};

function GroupsTab() {
  const { user } = useAuth();
  const { requireAuth } = useAuthPrompt();
  const [groups, setGroups] = useState<Group[]>([]);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [liveByGroup, setLiveByGroup] = useState<Record<string, number>>({});

  const refresh = async () => {
    const { data } = await supabase.from("groups").select("id,name,slug,description,member_count,theme,city").eq("is_active", true).order("name");
    setGroups(data ?? []);
    if (user) {
      const { data: m } = await supabase.from("group_memberships").select("group_id").eq("user_id", user.id);
      setMine(new Set((m ?? []).map((x) => x.group_id)));
    } else setMine(new Set());
    const { data: rooms } = await supabase.from("audio_rooms").select("group_id").eq("status", "open").gt("current_participant_count", 0);
    const counts: Record<string, number> = {};
    (rooms ?? []).forEach((r) => { if (r.group_id) counts[r.group_id] = (counts[r.group_id] ?? 0) + 1; });
    setLiveByGroup(counts);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user]);

  const toggle = (g: Group) => requireAuth(async () => {
    if (!user) return;
    if (mine.has(g.id)) await supabase.from("group_memberships").delete().eq("group_id", g.id).eq("user_id", user.id);
    else await supabase.from("group_memberships").insert({ group_id: g.id, user_id: user.id });
    refresh();
  });

  const joined = groups.filter((g) => mine.has(g.id));
  const discover = groups.filter((g) => !mine.has(g.id));

  return (
    <div className="space-y-7">
      <header>
        <h1 className="font-serif text-3xl">Groups</h1>
        <p className="mt-1 text-muted-foreground">Quiet affinity tags. They surface walks and rooms that fit you.</p>
      </header>

      {joined.length > 0 && (
        <section className="space-y-3">
          <SectionHeading eyebrow="Yours" title="Your groups" />
          <div className="flex flex-wrap gap-2">
            {joined.map((g) => (
              <Link key={g.id} to={"/groups/$slug" as never} params={{ slug: g.slug } as never} className="group inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm shadow-soft transition hover:-translate-y-px hover:border-forest/40">
                {g.name}
                {liveByGroup[g.id] && <span className="rounded-full bg-forest/10 px-1.5 text-[10px] font-medium text-forest">● live</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <SectionHeading eyebrow="Find your people" title={joined.length > 0 ? "Discover" : "Browse groups"} />
        <ul className="grid gap-3 md:grid-cols-2">
          {discover.map((g) => {
            const tint = (g.theme && themeTint[g.theme]) || "from-accent/40";
            const live = liveByGroup[g.id];
            return (
              <li key={g.id} className={`flex flex-col rounded-2xl border border-border bg-gradient-to-br ${tint} to-card p-5 shadow-soft transition hover:-translate-y-px hover:border-forest/40`}>
                <div className="flex items-start justify-between gap-2">
                  <Link to={"/groups/$slug" as never} params={{ slug: g.slug } as never} className="font-serif text-xl hover:text-forest">{g.name}</Link>
                  {live && <span className="rounded-full bg-forest/15 px-2 py-0.5 text-[10px] font-medium text-forest">● {live} live</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{g.member_count} walker{g.member_count === 1 ? "" : "s"}{g.city ? ` · ${g.city}` : ""}</span>
                  <Button size="sm" onClick={() => toggle(g)} className="rounded-full bg-forest text-primary-foreground hover:opacity-90">Join</Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
