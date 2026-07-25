import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Globe, MapPin, Users, Calendar, Clock, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getGroupBySlug, joinGroup, leaveGroup } from "@/lib/groups.functions";

export const Route = createFileRoute("/g/$slug")({
  component: PublicGroupPage,
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Walking group` },
      {
        name: "description",
        content: "A walking group on Mental Health Walk Club. Join to see standing walks and meetups.",
      },
      { property: "og:title", content: `${params.slug.replace(/-/g, " ")} — Walking group` },
      { property: "og:description", content: "A walking group on Mental Health Walk Club." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type PublicGroup = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  neighborhood: string | null;
  cover_image_url: string | null;
  scope: string | null;
  member_count: number | null;
  created_at: string;
};

type Upcoming = {
  id: string;
  slug: string;
  title: string | null;
  starts_at: string;
  meeting_point: string | null;
  attendee_count: number | null;
};

function PublicGroupPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [g, setG] = useState<PublicGroup | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  const [myState, setMyState] = useState<{ is_owner: boolean; my_status: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadPublic = async () => {
    const { data, error } = await supabase
      .from("public_groups")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data) {
      setNotFound(true);
      return null;
    }
    setG(data as PublicGroup);
    // Upcoming walks tied to this group
    const { data: evs } = await supabase
      .from("events")
      .select("id, slug, title, starts_at, meeting_point, attendee_count")
      .eq("group_id", data.id)
      .eq("status", "published")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(10);
    setUpcoming((evs ?? []) as Upcoming[]);
    return data as PublicGroup;
  };

  const loadMyState = async () => {
    if (!user) return;
    try {
      const r = await getGroupBySlug({ data: { slug } });
      setMyState({ is_owner: r.is_owner, my_status: r.my_status });
    } catch {
      // group might be private and inaccessible; ignore
    }
  };

  useEffect(() => {
    setNotFound(false);
    setG(null);
    setMyState(null);
    loadPublic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (g && user) loadMyState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g?.id, user?.id]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-10 text-center">
        <p className="font-serif text-2xl">Group not found</p>
        <Link to="/groups" className="mt-4 inline-block text-sm text-forest underline">Back to groups</Link>
      </div>
    );
  }
  if (!g) {
    return <div className="mx-auto max-w-2xl p-6"><div className="h-32 animate-pulse rounded-3xl bg-card" /></div>;
  }

  const isMember = myState?.my_status === "active";
  const isOwner = !!myState?.is_owner;

  const onJoin = async () => {
    if (!user) { navigate({ to: "/auth" }); return; }
    setBusy(true);
    try {
      await joinGroup({ data: { id: g.id } });
      toast.success("Joined.");
      await loadMyState();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not join.");
    } finally { setBusy(false); }
  };
  const onLeave = async () => {
    setBusy(true);
    try {
      await leaveGroup({ data: { id: g.id } });
      toast.success("Left.");
      await loadMyState();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not leave.");
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <Link to="/groups" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Groups
      </Link>

      <header className="mt-3 overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        {g.cover_image_url && (
          <img src={g.cover_image_url} alt="" className="h-40 w-full object-cover" />
        )}
        <div className="p-5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <Globe className="h-3 w-3" /> public {g.scope === "global" && "· global"}
          </div>
          <h1 className="mt-1 font-serif text-3xl">{g.name}</h1>
          {g.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{g.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {g.member_count ?? 0} member{g.member_count === 1 ? "" : "s"}</span>
            {g.neighborhood && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {g.neighborhood}</span>}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {!user && (
              <Button onClick={() => navigate({ to: "/auth" })} className="rounded-full bg-forest text-primary-foreground">
                Sign in to join
              </Button>
            )}
            {user && !isMember && !isOwner && (
              <Button onClick={onJoin} disabled={busy} className="rounded-full bg-forest text-primary-foreground">
                {busy ? "Joining…" : "Join"}
              </Button>
            )}
            {user && isMember && !isOwner && (
              <Button onClick={onLeave} disabled={busy} variant="outline" className="rounded-full">
                <LogOut className="mr-1 h-4 w-4" /> Leave
              </Button>
            )}
            {user && (isOwner || isMember) && (
              <Link
                to="/groups/$slug"
                params={{ slug: g.slug }}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-accent/40"
              >
                <Settings className="h-4 w-4" /> {isOwner ? "Manage" : "Members area"}
              </Link>
            )}
          </div>
        </div>
      </header>

      <section className="mt-6">
        <h2 className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Upcoming walks</h2>
        {upcoming.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
            No walks scheduled yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((e) => {
              const d = new Date(e.starts_at);
              const dayLabel = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
              const timeLabel = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
              return (
                <li key={e.id}>
                  <Link to="/w/$code" params={{ code: e.slug }} className="block rounded-2xl border border-border bg-card p-3 shadow-soft transition hover:bg-accent/30">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Calendar className="h-3.5 w-3.5 text-forest" />
                          {dayLabel} · <Clock className="h-3 w-3" /> {timeLabel}
                        </div>
                        {e.title && <div className="mt-0.5 text-sm">{e.title}</div>}
                        {e.meeting_point && <div className="mt-0.5 text-xs text-muted-foreground">{e.meeting_point}</div>}
                      </div>
                      <span className="text-[11px] text-muted-foreground">{e.attendee_count ?? 0} going</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
