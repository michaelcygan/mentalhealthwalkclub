import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Check } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  getUnreadNotificationCount,
  listNotifications,
  markNotificationsRead,
  type NotificationRow,
} from "@/lib/notifications.functions";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

function initials(name: string | null): string {
  if (!name) return "·";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function NotificationsBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const fetchCount = useServerFn(getUnreadNotificationCount);
  const fetchList = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationsRead);

  const { data: countData } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => fetchCount({}),
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const unread = countData?.count ?? 0;

  const { data: listData, isLoading } = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => fetchList({ data: { limit: 20 } }),
    enabled: !!user && open,
    staleTime: 30_000,
  });
  const items: NotificationRow[] = listData?.items ?? [];

  if (!user) return null;

  const onItem = async (n: NotificationRow) => {
    setOpen(false);
    if (!n.read_at) {
      await markRead({ data: { ids: [n.id] } }).catch(() => {});
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
    if (n.link) {
      // n.link is an internal app path
      void navigate({ to: n.link as never });
    }
  };

  const onMarkAll = async () => {
    if (unread === 0) return;
    await markRead({ data: { all: true } }).catch(() => {});
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
          title="Notifications"
          className="relative grid h-8 w-8 place-items-center rounded-full bg-accent/60 text-forest transition active:scale-95 hover:bg-accent"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-semibold leading-none text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-sm p-0">
        <SheetHeader className="flex flex-row items-center justify-between border-b border-border px-4 py-3">
          <SheetTitle className="font-serif text-lg">Notifications</SheetTitle>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onMarkAll}>
              <Check className="mr-1 h-3 w-3" /> Mark all read
            </Button>
          )}
        </SheetHeader>
        <div className="max-h-[calc(100dvh-3.5rem)] overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">You're all caught up.</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Friend requests, RSVPs and high-fives land here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onItem(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-accent/30 ${!n.read_at ? "bg-accent/15" : ""}`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground">
                      {n.actor?.avatar_url ? (
                        <img src={n.actor.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        initials(n.actor?.display_name ?? null)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-foreground">{n.title}</p>
                      {n.body && <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.body}</p>}
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{relTime(n.created_at)}</p>
                    </div>
                    {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-forest" aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
