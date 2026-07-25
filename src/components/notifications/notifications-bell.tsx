import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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

export function NotificationsBell({ variant = "icon" }: { variant?: "icon" | "sidebar" } = {}) {
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

  // Snapshot which items were unread when the sheet opened, so their "new" styling
  // persists for this open session even after we auto-mark them read.
  const [sessionUnread, setSessionUnread] = useState<Set<string>>(new Set());
  const sweptRef = useRef(false);

  // Auto-mark all as read once the sheet opens with unread items loaded.
  useEffect(() => {
    if (!open) {
      sweptRef.current = false;
      setSessionUnread(new Set());
      return;
    }
    if (sweptRef.current) return;
    if (!listData) return;
    const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) {
      sweptRef.current = true;
      return;
    }
    sweptRef.current = true;
    setSessionUnread(new Set(unreadIds));
    void markRead({ data: { all: true } })
      .catch(() => {})
      .finally(() => {
        qc.invalidateQueries({ queryKey: ["notifications"] });
      });
  }, [open, listData, items, markRead, qc]);

  // Realtime: push fresh count + list into the bell when a new notification lands.
  useEffect(() => {
    if (!user?.id) return;
    const nonce = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString();
    const channel = supabase
      .channel(`notifications:${user.id}:${nonce}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

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


  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {variant === "sidebar" ? (
          <button
            type="button"
            aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground transition hover:bg-sidebar-accent/60"
          >
            <span className="relative inline-flex">
              <Bell className="h-4.5 w-4.5" />
              {unread > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-destructive px-1 text-[9px] font-semibold leading-none text-destructive-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </span>
            Notifications
          </button>
        ) : (
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
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-sm p-0">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="font-serif text-lg">Notifications</SheetTitle>
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
              {items.map((n) => {
                const isNew = !n.read_at || sessionUnread.has(n.id);
                return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onItem(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-accent/30 ${isNew ? "bg-accent/15" : ""}`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground">
                      {n.actor?.avatar_url ? (
                        <img src={n.actor.avatar_url} alt="" className="h-full w-full object-cover" decoding="async" />
                      ) : (
                        initials(n.actor?.display_name ?? null)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-foreground">{n.title}</p>
                      {n.body && <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.body}</p>}
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{relTime(n.created_at)}</p>
                    </div>
                    {isNew && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-forest" aria-hidden />}
                  </button>
                </li>
                );
              })}
            </ul>
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
