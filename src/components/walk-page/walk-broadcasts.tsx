import { useEffect, useState } from "react";
import { Send, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { sendBroadcast, listBroadcasts } from "@/lib/walks.functions";

type Broadcast = {
  id: string;
  body: string;
  created_at: string;
  author: { id: string; display_name: string | null; avatar_url: string | null };
};

export function WalkBroadcasts({
  eventId,
  hostId,
}: {
  eventId: string;
  hostId: string | null;
}) {
  const { user } = useAuth();
  const isHost = !!user && !!hostId && user.id === hostId;
  const [items, setItems] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancel = false;
    listBroadcasts({ data: { eventId } })
      .then(({ broadcasts }) => {
        if (!cancel) setItems(broadcasts);
      })
      .finally(() => !cancel && setLoading(false));

    const ch = supabase
      .channel(`event-broadcasts:${eventId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "event_broadcasts", filter: `event_id=eq.${eventId}` },
        () => {
          listBroadcasts({ data: { eventId } }).then(({ broadcasts }) => setItems(broadcasts));
        }
      )
      .subscribe();

    return () => {
      cancel = true;
      supabase.removeChannel(ch);
    };
  }, [eventId]);

  async function post() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      await sendBroadcast({ data: { eventId, body: text } });
      setBody("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      setSending(false);
    }
  }

  if (!isHost && items.length === 0 && !loading) return null;

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        <MessageCircle className="h-3 w-3" /> Updates from the host
      </div>

      {isHost && (
        <div className="mt-3 flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Running 5 min late · meet at the fountain"
            rows={2}
            maxLength={500}
            className="flex-1 resize-none rounded-2xl border border-border bg-background p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest/40"
          />
          <button
            onClick={post}
            disabled={sending || !body.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest text-primary-foreground disabled:opacity-50"
            aria-label="Send update"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {loading && items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No updates yet.</p>
        ) : (
          items.map((b) => (
            <div key={b.id} className="rounded-2xl bg-background/60 p-3">
              <p className="text-sm">{b.body}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {b.author.display_name ?? "Host"} · {timeAgo(b.created_at)}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}
