import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Globe, Lock, MapPin, Users, Trash2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGroupBySlug, joinGroup, leaveGroup, deleteGroup } from "@/lib/groups.functions";

export const Route = createFileRoute("/_authenticated/groups/$slug")({
  component: GroupDetailPage,
  head: ({ params }) => ({
    meta: [
      { title: `Group · ${params.slug} — Mental Health Walk Club` },
    ],
  }),
});

type State = Awaited<ReturnType<typeof getGroupBySlug>> | null;

function GroupDetailPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const r = await getGroupBySlug({ data: { slug } });
      setState(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Not found");
    }
  };
  useEffect(() => { refresh(); }, [slug]);

  if (err) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-10 text-center">
        <p className="font-serif text-2xl">Group not found</p>
        <p className="mt-1 text-sm text-muted-foreground">{err}</p>
        <Link to="/groups" className="mt-4 inline-block text-sm text-forest underline">Back to groups</Link>
      </div>
    );
  }
  if (!state) return <div className="mx-auto max-w-2xl p-6"><div className="h-32 animate-pulse rounded-3xl bg-card" /></div>;

  const { group, member_count, my_status, is_owner } = state;
  const isMember = my_status === "active";

  const onJoin = async () => {
    setBusy(true);
    try { await joinGroup({ data: { id: group.id } }); toast.success("Joined."); await refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not join."); }
    finally { setBusy(false); }
  };
  const onLeave = async () => {
    setBusy(true);
    try { await leaveGroup({ data: { id: group.id } }); toast.success("Left."); await refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not leave."); }
    finally { setBusy(false); }
  };
  const onDelete = async () => {
    if (!confirm("Delete this group? This cannot be undone.")) return;
    try { await deleteGroup({ data: { id: group.id } }); toast.success("Deleted."); navigate({ to: "/groups" }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete."); }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <Link to="/groups" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Groups
      </Link>

      <header className="mt-3 rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {group.visibility === "public" ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          {group.visibility}{group.scope === "global" && " · global"}
          <span className="ml-auto">{group.age_band_min}</span>
        </div>
        <h1 className="mt-1 font-serif text-3xl">{group.name}</h1>
        {group.description && <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{group.description}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {member_count} member{member_count === 1 ? "" : "s"}</span>
          {group.neighborhood && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {group.neighborhood}</span>}
        </div>
        {!isMember && group.lat != null && (
          <p className="mt-2 text-[11px] text-muted-foreground">Exact meetup pin appears after you join.</p>
        )}

        <div className="mt-4 flex gap-2">
          {!is_owner && !isMember && group.visibility === "public" && (
            <Button onClick={onJoin} disabled={busy} className="rounded-full bg-forest text-primary-foreground">Join</Button>
          )}
          {!is_owner && isMember && (
            <Button onClick={onLeave} disabled={busy} variant="outline" className="rounded-full"><LogOut className="mr-1 h-4 w-4" /> Leave</Button>
          )}
          {is_owner && (
            <Button onClick={onDelete} variant="outline" className="rounded-full text-destructive border-destructive/40"><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
          )}
        </div>
      </header>

      <section className="mt-5 rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center">
        <p className="font-serif text-lg">Standing walks come next</p>
        <p className="mt-1 text-sm text-muted-foreground">In the next pass, hosts can attach a weekly meetup and we'll materialize the next 4 walks here.</p>
      </section>
    </div>
  );
}
