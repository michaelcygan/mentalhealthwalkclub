import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Footprints, Users, Calendar, BookHeart, Home, Headphones, MapPin, Sparkles, Heart, CalendarClock, DownloadCloud } from "lucide-react";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { useLiveCount } from "@/hooks/use-live-count";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { haptics } from "@/lib/device";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { createFriendWalk } from "@/lib/friend-walk.functions";
import { FriendWalkShareCard } from "@/components/friend-walk/share-card";
import { FriendWalkScheduleSheet } from "@/components/friend-walk/schedule-sheet";
import { toast } from "sonner";

const SIDE_TABS: Array<{ to: string; label: string; icon: typeof Users; exact?: boolean }> = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/groups", label: "Groups", icon: Users },
  { to: "/events", label: "Events", icon: Calendar },
  { to: "/journal", label: "Journal", icon: BookHeart },
];

/** Adaptive mobile bottom bar — 4 flat tabs flanking a center Walk FAB. */
export function MobileTabBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const scrollDir = useScrollDirection();
  const hidden = scrollDir === "down";
  const isActive = (to: string, exact?: boolean) => (exact ? path === to : path === to || path.startsWith(to + "/"));

  const liveCount = useLiveCount();
  const pwa = usePwaInstall();

  // Sheet state — center FAB tap opens the new-walk picker.
  const [sheetOpen, setSheetOpen] = useState(false);

  const walkActive = false;

  // Friend Walk: create + open share card
  const { user } = useAuth();
  const { requireAuth } = useAuthPrompt();
  const navigate = useNavigate();
  const createFriend = useServerFn(createFriendWalk);
  const [shareOpen, setShareOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [friendInfo, setFriendInfo] = useState<{ code: string; walkId: string | null; startsAt: string | null } | null>(null);
  const [friendBusy, setFriendBusy] = useState(false);

  const startFriendWalk = () =>
    requireAuth(async () => {
      setFriendBusy(true);
      try {
        const r = await createFriend();
        setFriendInfo({ code: r.code, walkId: r.walkId, startsAt: null });
        setSheetOpen(false);
        setShareOpen(true);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "couldn't start walk");
      } finally {
        setFriendBusy(false);
      }
    });

  const openSchedule = () =>
    requireAuth(() => {
      setSheetOpen(false);
      setScheduleOpen(true);
    });

  return (
    <>
      <nav
        className={`fixed inset-x-0 bottom-0 z-40 md:hidden transition-transform duration-300 ${hidden ? "translate-y-full" : "translate-y-0"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
        {/* Solid floor (with subtle blur) so content can't bleed through */}
        <div className="relative border-t border-border/60 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
          <ul className="grid grid-cols-5 items-end">
            {/* Left two */}
            {SIDE_TABS.slice(0, 2).map(({ to, label, icon: Icon, exact }) => (
              <TabItem key={to} to={to} label={label} Icon={Icon} active={isActive(to, exact)} />
            ))}

            {/* Center FAB slot — simple tap opens the new-walk picker */}
            <li className="relative flex justify-center">
              <button
                type="button"
                onClick={() => { haptics.tap(); setSheetOpen(true); }}
                aria-label="New walk"
                className="group relative -mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-forest text-primary-foreground shadow-elevated ring-4 ring-background transition active:scale-95"
              >
                {liveCount > 0 && (
                  <span aria-hidden className="pointer-events-none absolute inset-0 -m-0.5 rounded-full pulse-ring" />
                )}
                <Footprints className="h-6 w-6" strokeWidth={2.2} />
                {liveCount > 0 && (
                  <span className="absolute -top-1 right-1.5 flex items-center gap-0.5 rounded-full bg-clay px-1.5 py-0.5 text-[9px] font-semibold leading-none text-background shadow">
                    <span className="h-1.5 w-1.5 rounded-full bg-background/90" />
                    {liveCount}
                  </span>
                )}
              </button>
              <span className={`absolute bottom-1 text-[10px] font-medium ${walkActive ? "text-primary" : "text-muted-foreground"}`}>Walk</span>
            </li>

            {/* Right two */}
            {SIDE_TABS.slice(2).map(({ to, label, icon: Icon, exact }) => (
              <TabItem key={to} to={to} label={label} Icon={Icon} active={isActive(to, exact)} />
            ))}
          </ul>
        </div>
      </nav>

      <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
        <DrawerContent className="md:hidden">
          <DrawerHeader className="text-center">
            <DrawerTitle className="font-serif text-xl">Choose your walk</DrawerTitle>
            <DrawerDescription>Quick start — pick a mode.</DrawerDescription>
          </DrawerHeader>
          <div className="grid grid-cols-2 gap-3 px-4 pb-6">
            <ModeButton to="/" icon={Footprints} title="Solo" sub="Just me & the steps" onTap={() => setSheetOpen(false)} />
            <ModeButton to="/" icon={Headphones} title="Walk & Talk" sub="Match into a live pod" onTap={() => setSheetOpen(false)} />
            <ModeButton to="/" icon={Sparkles} title="Guided" sub="A voice in your ear" onTap={() => setSheetOpen(false)} />
            <ModeButton to="/events" icon={MapPin} title="Local Walk" sub="Real sidewalks nearby" onTap={() => setSheetOpen(false)} />
            <button
              type="button"
              onClick={() => { haptics.tap(); startFriendWalk(); }}
              disabled={friendBusy}
              className="col-span-2 flex items-center gap-3 rounded-2xl border border-clay/40 bg-gradient-to-br from-clay/15 to-cream/30 p-4 text-left transition active:scale-[0.98] hover:border-clay/60 disabled:opacity-60"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-clay/20">
                <Heart className="h-4 w-4 text-clay" />
              </span>
              <div className="flex-1">
                <div className="font-serif text-base">Friend Walk · share a link</div>
                <div className="text-[11px] text-muted-foreground">spin up a private room — drop the link in your story</div>
              </div>
              <span className="rounded-full bg-clay/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-clay">new</span>
            </button>
            <button
              type="button"
              onClick={() => { haptics.tap(); openSchedule(); }}
              className="col-span-2 flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition active:scale-[0.98] hover:border-forest/40"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-accent/60">
                <CalendarClock className="h-4 w-4 text-forest" />
              </span>
              <div className="flex-1">
                <div className="font-serif text-base">Schedule a Friend Walk</div>
                <div className="text-[11px] text-muted-foreground">pick a time later this week — share the invite now</div>
              </div>
            </button>
            {pwa.canInstall && (
              <button
                type="button"
                onClick={async () => { haptics.tap(); const ok = await pwa.install(); if (ok) { setSheetOpen(false); toast("Added to your home screen"); } }}
                className="col-span-2 flex items-center gap-3 rounded-2xl border border-forest/30 bg-accent/20 p-3 text-left transition active:scale-[0.98] hover:border-forest/50"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-forest/15">
                  <DownloadCloud className="h-4 w-4 text-forest" />
                </span>
                <div className="flex-1">
                  <div className="font-serif text-sm">Add to home screen</div>
                  <div className="text-[11px] text-muted-foreground">one-tap launch, no app store</div>
                </div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-forest">Install</span>
              </button>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <FriendWalkScheduleSheet
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onScheduled={(info) => {
          setFriendInfo({ code: info.code, walkId: null, startsAt: info.startsAt });
          setShareOpen(true);
        }}
      />

      {friendInfo && (
        <FriendWalkShareCard
          open={shareOpen}
          onOpenChange={(v) => {
            setShareOpen(v);
            if (!v && friendInfo) {
              // Live walk → jump into the room. Scheduled → just close.
              if (friendInfo.walkId) {
                navigate({ to: "/walk/active/$id" as never, params: { id: friendInfo.walkId } as never });
              }
              setFriendInfo(null);
            }
          }}
          hostName={user?.user_metadata?.display_name || user?.email?.split("@")[0] || "you"}
          hostAvatarUrl={user?.user_metadata?.avatar_url ?? null}
          shareCode={friendInfo.code}
          startsAt={friendInfo.startsAt}
        />
      )}
    </>
  );
}

function TabItem({ to, label, Icon, active }: { to: string; label: string; Icon: typeof Users; active: boolean }) {
  return (
    <li>
      <Link
        to={to as never}
        onClick={() => haptics.tap()}
        className={`flex flex-col items-center gap-1 py-2.5 text-[11px] transition ${active ? "text-primary" : "text-muted-foreground"}`}
      >
        <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
        <span className={active ? "font-medium" : ""}>{label}</span>
      </Link>
    </li>
  );
}

function ModeButton({ to, icon: Icon, title, sub, onTap }: { to: string; icon: typeof Footprints; title: string; sub: string; onTap: () => void }) {
  return (
    <Link
      to={to as never}
      onClick={() => { haptics.tap(); onTap(); }}
      className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 transition active:scale-[0.98] hover:border-forest/40"
    >
      <span className="grid h-9 w-9 place-items-center rounded-full bg-accent/60">
        <Icon className="h-4 w-4 text-forest" />
      </span>
      <div>
        <div className="font-serif text-base">{title}</div>
        <div className="text-[11px] text-muted-foreground">{sub}</div>
      </div>
    </Link>
  );
}
