import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { CalendarClock, Share2, Pencil, X, Radio, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listMyFriendWalks, cancelFriendWalk, createFriendWalk } from "@/lib/friend-walk.functions";
import { FriendWalkScheduleSheet } from "@/components/friend-walk/schedule-sheet";
import { FriendWalkShareCard } from "@/components/friend-walk/share-card";
import { useAuth } from "@/lib/auth-context";
import { share, haptics } from "@/lib/device";
import { toast } from "sonner";

interface FW {
  id: string;
  title: string;
  share_code: string | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  current_participant_count: number;
  created_at: string;
}

export function MyFriendWalks() {
  const { user } = useAuth();
  const list = useServerFn(listMyFriendWalks);
  const cancel = useServerFn(cancelFriendWalk);
  const createFw = useServerFn(createFriendWalk);
  const [walks, setWalks] = useState<FW[] | null>(null);
  const [editing, setEditing] = useState<FW | null>(null);
  const [shareOf, setShareOf] = useState<FW | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(() => { list().then((r) => setWalks(r.walks as FW[])); }, [list]);
  useEffect(() => { reload(); }, [reload]);

  const onCancel = async (w: FW) => {
    if (!confirm("Cancel this walk? Your friends with the link will see it's been called off.")) return;
    setBusyId(w.id);
    try { await cancel({ data: { roomId: w.id } }); toast("Walk canceled."); reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "couldn't cancel"); }
    finally { setBusyId(null); }
  };

  const onShare = async (w: FW) => {
    if (!w.share_code) return;
    haptics.tap();
    const url = `${window.location.origin}/w/${w.share_code}`;
    const ok = await share({ title: w.title, text: "walk with me 🌿", url });
    if (!ok) try { await navigator.clipboard.writeText(url); toast("link copied"); } catch { /* noop */ }
  };

  const startNow = async () => {
    setCreating(true);
    try {
      const r = await createFw();
      // Fake an FW object for the share card
      setShareOf({ id: r.roomId, title: "your walk", share_code: r.code, status: "open", starts_at: null, ends_at: null, current_participant_count: 0, created_at: new Date().toISOString() });
      reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : "couldn't start"); }
    finally { setCreating(false); }
  };

  if (walks === null) return <div className="h-24 animate-pulse rounded-2xl bg-secondary/60" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg">Friend walks</h2>
        <Button size="sm" variant="outline" onClick={startNow} disabled={creating} className="rounded-full text-xs">
          <Plus className="mr-1 h-3 w-3" /> Start now
        </Button>
      </div>

      {walks.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-5 text-center">
          <p className="font-serif text-sm italic text-muted-foreground">No friend walks yet.</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Spin one up — drop the link in your story and let your people pop in.</p>
        </div>
      )}

      <ul className="space-y-2">
        {walks.map((w) => {
          const isLive = w.status === "open";
          const isScheduled = w.status === "scheduled" && w.starts_at;
          const startMs = w.starts_at ? new Date(w.starts_at).getTime() : 0;
          const whenLabel = isScheduled
            ? new Date(startMs).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
            : isLive ? "live now" : "";
          return (
            <li key={w.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider">
                    {isLive ? (
                      <span className="inline-flex items-center gap-1 text-forest">
                        <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest/60" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-forest" /></span>
                        Live · {w.current_participant_count}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground"><CalendarClock className="h-3 w-3" />{whenLabel}</span>
                    )}
                  </div>
                  <div className="mt-0.5 line-clamp-1 font-serif text-base">{w.title}</div>
                  {w.share_code && <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">/w/{w.share_code}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {isLive && (
                    <Link to={"/w/$code" as never} params={{ code: w.share_code! } as never} className="rounded-lg p-2 text-forest hover:bg-accent" aria-label="Open">
                      <Radio className="h-4 w-4" />
                    </Link>
                  )}
                  {w.share_code && (
                    <button onClick={() => onShare(w)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Share"><Share2 className="h-4 w-4" /></button>
                  )}
                  {isScheduled && (
                    <button onClick={() => setEditing(w)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Reschedule"><Pencil className="h-4 w-4" /></button>
                  )}
                  <button onClick={() => onCancel(w)} disabled={busyId === w.id} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50" aria-label="Cancel">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {editing && (
        <FriendWalkScheduleSheet
          mode="reschedule"
          open={!!editing}
          onOpenChange={(v) => { if (!v) setEditing(null); }}
          roomId={editing.id}
          initial={{ startsAt: editing.starts_at ?? new Date().toISOString(), title: editing.title }}
          onRescheduled={() => { setEditing(null); reload(); }}
        />
      )}

      {shareOf && shareOf.share_code && (
        <FriendWalkShareCard
          open={!!shareOf}
          onOpenChange={(v) => { if (!v) setShareOf(null); }}
          hostName={user?.user_metadata?.display_name || user?.email?.split("@")[0] || "you"}
          hostAvatarUrl={user?.user_metadata?.avatar_url ?? null}
          shareCode={shareOf.share_code}
          startsAt={shareOf.starts_at}
        />
      )}
    </div>
  );
}
