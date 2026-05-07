import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Heart, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { getInbox, markInboxRead } from "@/lib/group-signals.functions";

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
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState(0);
  const fetchInbox = useServerFn(getInbox);
  const markRead = useServerFn(markInboxRead);

  const refresh = async () => {
    if (!user) return;
    try {
      const r = await fetchInbox();
      setItems(Array.isArray(r?.items) ? (r.items as InboxItem[]) : []);
      setUnread(typeof r?.unread === "number" ? r.unread : 0);
    } catch {
      // Likely 401 before session hydrates; ignore.
    }
  };

  useEffect(() => {
    if (!user) { setItems([]); setUnread(0); return; }
    // Defer one tick so the Supabase bearer token is attached.
    const initial = setTimeout(refresh, 400);
    const t = setInterval(refresh, 60_000);
    return () => { clearTimeout(initial); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o && items.length) {
      const ids = items.flatMap((i) => i.ids);
      if (ids.length) markRead({ data: { ids } }).then(() => { setUnread(0); }).catch(() => {});
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
