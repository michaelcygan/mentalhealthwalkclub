import { useEffect, useState } from "react";
import { Bell, Heart, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

type InboxGroup = { id: string; name: string; slug: string };
type InboxBadge = { id: string; name: string; icon: string | null };
type InboxSignal = {
  id: string;
  group_id: string;
  kind: string;
  badge_id: string | null;
  created_at: string;
  read_at: string | null;
};

type InboxItem = {
  ids: string[];
  group: { id: string; name: string; slug: string };
  kind: string;
  badge?: { id: string; name: string; icon: string | null };
  count: number;
  latest: string;
  unread: number;
};

export function InboxBell({ variant = "mobile" }: { variant?: "mobile" | "desktop" }) {
  const { user, session, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState(0);

  const refresh = async () => {
    if (!session?.access_token || !user?.id) return;
    try {
      const { data: signals, error } = await supabase
        .from("group_signals")
        .select("id,group_id,kind,badge_id,created_at,read_at")
        .eq("recipient_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      const all = (signals ?? []) as InboxSignal[];
      const unreadRows = all.filter((s) => !s.read_at);
      if (unreadRows.length === 0) {
        setItems([]);
        setUnread(0);
        return;
      }

      const groupIds = [...new Set(all.map((s) => s.group_id))];
      const badgeIds = [...new Set(all.map((s) => s.badge_id).filter(Boolean) as string[])];
      const { data: groups, error: groupsError } = await supabase
        .from("groups")
        .select("id,name,slug")
        .in("id", groupIds);
      if (groupsError) throw groupsError;

      let badges: InboxBadge[] = [];
      if (badgeIds.length) {
        const { data: badgeRows, error: badgesError } = await supabase
          .from("badge_definitions")
          .select("id,name,icon")
          .in("id", badgeIds);
        if (badgesError) throw badgesError;
        badges = (badgeRows ?? []) as InboxBadge[];
      }

      const gMap = new Map(((groups ?? []) as InboxGroup[]).map((g) => [g.id, g]));
      const bMap = new Map(badges.map((b) => [b.id, b]));
      const agg = new Map<string, InboxItem>();

      all.forEach((s) => {
        const group = gMap.get(s.group_id);
        if (!group) return;
        const key = `${s.group_id}:${s.kind}:${s.badge_id ?? ""}`;
        const cur = agg.get(key) ?? {
          ids: [],
          group,
          kind: s.kind,
          badge: s.badge_id ? bMap.get(s.badge_id) : undefined,
          count: 0,
          latest: s.created_at,
          unread: 0,
        };
        cur.ids.push(s.id);
        cur.count += 1;
        if (!s.read_at) cur.unread += 1;
        if (s.created_at > cur.latest) cur.latest = s.created_at;
        agg.set(key, cur);
      });

      setItems(Array.from(agg.values()).filter((x) => x.unread > 0).sort((a, b) => b.latest.localeCompare(a.latest)));
      setUnread(unreadRows.length);
    } catch {
      // Keep the inbox decorative if the private signal feed is unavailable.
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!session?.access_token) { setItems([]); setUnread(0); return; }
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => { clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session?.access_token]);

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o && items.length && user?.id) {
      const ids = items.flatMap((i) => i.ids);
      if (ids.length) {
        supabase
          .from("group_signals")
          .update({ read_at: new Date().toISOString() })
          .in("id", ids)
          .eq("recipient_user_id", user.id)
          .is("read_at", null)
          .then(({ error }) => { if (!error) setUnread(0); }, () => {});
      }
    }
  };

  if (!user) return null;

  const trigger = (
    <button
      aria-label="Inbox"
      className={
        variant === "mobile"
          ? "relative inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
          : "relative mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:border-forest/40"
      }
    >
      <Bell className="h-4 w-4" />
      {variant === "desktop" && <span>Inbox</span>}
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-forest px-1 text-[10px] font-medium text-primary-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="font-serif text-xl">A few warm notes</SheetTitle>
        </SheetHeader>
        {items.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">All quiet. Come back after a walk.</div>
        ) : (
          <ul className="mt-4 space-y-2 pb-6">
            {items.map((it, i) => (
              <li key={i} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/40 text-forest">
                  {it.kind === "kudos" ? <Heart className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  {it.kind === "welcome" ? (
                    <>
                      <span className="font-medium">{it.count}</span> {it.count === 1 ? "walker" : "walkers"} in <span className="font-medium">{it.group.name}</span> welcomed you.
                    </>
                  ) : (
                    <>
                      <span className="font-medium">{it.count}</span> {it.count === 1 ? "person" : "people"} congratulated you on <span className="font-medium">{it.badge?.name ?? "a milestone"}</span> in {it.group.name}.
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
