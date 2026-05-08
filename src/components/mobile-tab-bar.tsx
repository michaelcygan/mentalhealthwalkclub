import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Footprints, Users, Calendar, BookHeart, User as UserIcon, Headphones, MapPin, Sparkles, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { haptics } from "@/lib/device";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { createFriendWalk } from "@/lib/friend-walk.functions";
import { FriendWalkShareCard } from "@/components/friend-walk/share-card";
import { toast } from "sonner";

const SIDE_TABS: Array<{ to: string; label: string; icon: typeof Users; exact?: boolean }> = [
  { to: "/groups", label: "Groups", icon: Users },
  { to: "/events", label: "Events", icon: Calendar },
  { to: "/journal", label: "Journal", icon: BookHeart },
  { to: "/profile", label: "Profile", icon: UserIcon },
];

/** Adaptive mobile bottom bar — 4 flat tabs flanking a center Walk FAB. */
export function MobileTabBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const scrollDir = useScrollDirection();
  const hidden = scrollDir === "down";
  const isActive = (to: string, exact?: boolean) => (exact ? path === to : path === to || path.startsWith(to + "/"));

  // Live walkers count — light poll every 45s
  const [liveCount, setLiveCount] = useState(0);
  useEffect(() => {
    const load = () =>
      supabase.from("audio_rooms").select("current_participant_count").eq("status", "open").gt("current_participant_count", 0)
        .then(({ data }) => setLiveCount((data ?? []).reduce((s, r) => s + (r.current_participant_count ?? 0), 0)));
    load();
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  }, []);

  // Long-press → walk-mode sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const pressTimerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);
  const startPress = () => {
    longPressedRef.current = false;
    pressTimerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      haptics.soft();
      setSheetOpen(true);
    }, 380);
  };
  const cancelPress = () => {
    if (pressTimerRef.current) { window.clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
  };

  const walkActive = isActive("/", true);

  return (
    <>
      <nav
        className={`fixed bottom-0 left-0 right-0 z-40 md:hidden transition-transform duration-300 ${hidden ? "translate-y-full" : "translate-y-0"}`}
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
        aria-label="Primary"
      >
        {/* Translucent floor */}
        <div className="relative border-t border-border bg-card/95 backdrop-blur">
          <ul className="grid grid-cols-5 items-end">
            {/* Left two */}
            {SIDE_TABS.slice(0, 2).map(({ to, label, icon: Icon, exact }) => (
              <TabItem key={to} to={to} label={label} Icon={Icon} active={isActive(to, exact)} />
            ))}

            {/* Center FAB slot */}
            <li className="relative flex justify-center">
              <Link
                to="/"
                onPointerDown={startPress}
                onPointerUp={cancelPress}
                onPointerCancel={cancelPress}
                onPointerLeave={cancelPress}
                onClick={(e) => {
                  if (longPressedRef.current) { e.preventDefault(); return; }
                  haptics.tap();
                }}
                aria-label="Walk"
                className={`group -mt-6 flex h-14 w-14 items-center justify-center rounded-full shadow-elevated ring-4 ring-background transition active:scale-95 ${
                  walkActive ? "bg-forest text-primary-foreground" : "bg-forest text-primary-foreground"
                }`}
              >
                <Footprints className="h-6 w-6" strokeWidth={2.2} />
                {liveCount > 0 && (
                  <span className="absolute -top-1 right-1.5 flex items-center gap-0.5 rounded-full bg-clay px-1.5 py-0.5 text-[9px] font-semibold leading-none text-background shadow">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-background/90" />
                    {liveCount}
                  </span>
                )}
              </Link>
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
          </div>
        </DrawerContent>
      </Drawer>
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
