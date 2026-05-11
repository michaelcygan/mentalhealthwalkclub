import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AuthPromptProvider, useAuthPrompt } from "@/lib/auth-prompt";
import { ViewModeProvider, useViewMode } from "@/lib/view-mode";
import { Toaster } from "@/components/ui/sonner";
import { Footprints, Users, Calendar, BookHeart, User as UserIcon, Radio, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InboxBell } from "@/components/inbox-bell";
import { NowPlayingBar } from "@/components/now-playing-bar";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { useLiveCount } from "@/hooks/use-live-count";
import { LogoStamp } from "@/components/logo-stamp";
import { LoadingScreen } from "@/components/loading-screen";
import { AmbientPlayerProvider } from "@/lib/ambient-context";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl text-foreground">404</h1>
        <h2 className="mt-4 text-xl text-foreground">This path doesn't exist yet.</h2>
        <p className="mt-2 text-sm text-muted-foreground">Let's get you back on the trail.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Mental Health Walk Club — You don't have to walk through it alone" },
      { name: "description", content: "Walk solo, join live Walk & Talks, RSVP to Local Walks, and track your wellness journey. A warm, community-first walking app." },
      { property: "og:title", content: "Mental Health Walk Club — You don't have to walk through it alone" },
      { property: "og:description", content: "Walk solo, join live Walk & Talks, RSVP to Local Walks, and track your wellness journey. A warm, community-first walking app." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#2c5340" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "MH Walk Club" },
      { name: "twitter:title", content: "Mental Health Walk Club — You don't have to walk through it alone" },
      { name: "twitter:description", content: "Walk solo, join live Walk & Talks, RSVP to Local Walks, and track your wellness journey. A warm, community-first walking app." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fae61a06-dea4-4046-bf60-ae53f70994ee/id-preview-c2ddb514--98b64404-6fc6-4b86-809a-ea60cfd93f8d.lovable.app-1778287089230.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fae61a06-dea4-4046-bf60-ae53f70994ee/id-preview-c2ddb514--98b64404-6fc6-4b86-809a-ea60cfd93f8d.lovable.app-1778287089230.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const TABS: Array<{ to: string; label: string; icon: typeof Footprints; exact?: boolean }> = [
  { to: "/", label: "Walk", icon: Footprints, exact: true },
  { to: "/groups", label: "Groups", icon: Users },
  { to: "/events", label: "Events", icon: Calendar },
  { to: "/journal", label: "Journal", icon: BookHeart },
  { to: "/profile", label: "Profile", icon: UserIcon },
];

function ModeToggle({ compact }: { compact?: boolean }) {
  const { isFacilitator, mode, setMode } = useViewMode();
  const navigate = useNavigate();
  if (!isFacilitator) return null;
  const toggle = () => {
    const next = mode === "facilitator" ? "walker" : "facilitator";
    setMode(next);
    navigate({ to: next === "facilitator" ? "/facilitate" : "/" });
  };
  if (compact) {
    return (
      <button
        onClick={toggle}
        title={mode === "facilitator" ? "Switch to Walker view" : "Switch to Facilitator view"}
        className="flex items-center gap-1 rounded-full border border-forest/30 bg-accent/40 px-2.5 py-1 text-[10px] font-medium text-forest"
      >
        <ArrowLeftRight className="h-3 w-3" />
        {mode === "facilitator" ? "Facilitator" : "Walker"}
      </button>
    );
  }
  return (
    <button
      onClick={toggle}
      className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-forest/30 bg-accent/30 px-3 py-2 text-xs text-forest hover:bg-accent/50"
    >
      <span className="flex items-center gap-2">
        <ArrowLeftRight className="h-3.5 w-3.5" />
        <span className="font-medium">{mode === "facilitator" ? "Facilitator view" : "Walker view"}</span>
      </span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">switch</span>
    </button>
  );
}

function TabBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const { openAuth, openWelcome } = useAuthPrompt();
  const isActive = (to: string, exact?: boolean) => (exact ? path === to : path === to || path.startsWith(to + "/"));

  return (
    <>
      {/* Mobile bottom command bar */}
      <MobileTabBar />

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-60 flex-col border-r border-border bg-sidebar px-5 py-8 md:flex">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <LogoStamp tone="dark" size={57} />
          <span className="font-serif text-[15px] leading-tight text-sidebar-foreground">
            Mental Health<br />Walk Club
          </span>
        </Link>

        {!user && (
          <div className="mb-5 space-y-2">
            <Button onClick={() => openAuth("signup")} className="w-full rounded-full bg-forest text-primary-foreground hover:opacity-90">
              Create account
            </Button>
            <button onClick={() => openAuth("signin")} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
              Sign in
            </button>
          </div>
        )}

        <ul className="space-y-1">
          {TABS.map(({ to, label, icon: Icon, exact }) => {
            const active = isActive(to, exact);
            return (
              <li key={to}>
                <Link
                  to={to as never}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        <LiveSidebarPill />
        {user && <InboxBell variant="desktop" />}

        <div className="mt-auto pt-6 space-y-3">
          {user && <ModeToggle />}
          <button onClick={openWelcome} className="block text-left font-serif text-xs italic leading-relaxed text-muted-foreground hover:text-foreground">
            How it works →
          </button>
          <p className="font-serif text-xs italic leading-relaxed text-muted-foreground">
            You don't have to walk through it alone.
          </p>
        </div>
      </aside>

      {/* Mobile top bar — sign in for logged-out visitors */}
      {!user ? (
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 glass px-4 py-2.5 md:hidden">
          <Link to="/" className="flex items-center gap-2" aria-label="Mental Health Walk Club — home">
            <LogoStamp tone="dark" size={36} />
            <span className="font-serif text-[13px] leading-[1.05] text-foreground/85">Mental Health<br/>Walk Club</span>
          </Link>
          <div className="flex items-center gap-1">
            <button onClick={openWelcome} className="rounded-full px-3 py-1.5 text-xs text-muted-foreground">How it works</button>
            <Button size="sm" onClick={() => openAuth("signup")} className="rounded-full bg-forest text-primary-foreground hover:opacity-90">Sign up</Button>
          </div>
        </header>
      ) : (
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 glass px-4 py-2 md:hidden">
          <Link to="/" className="flex items-center gap-2" aria-label="Mental Health Walk Club — home">
            <LogoStamp tone="dark" size={36} />
            <span className="font-serif text-[13px] leading-[1.05] text-foreground/85">Mental Health<br/>Walk Club</span>
          </Link>
          <div className="flex items-center gap-2">
            <ModeToggle compact />
            <InboxBell variant="mobile" />
            <Link
              to="/profile"
              aria-label="Profile"
              className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-border bg-accent/40 text-forest transition active:scale-95"
            >
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-serif text-sm font-semibold">
                  {(user.user_metadata?.display_name || user.email || "?").charAt(0).toUpperCase()}
                </span>
              )}
            </Link>
          </div>
        </header>
      )}
    </>
  );
}

function AppFrame({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { mode, isFacilitator, ready } = useViewMode();

  // First-load default: send facilitators to /facilitate when they land on home
  const [redirected, setRedirected] = useState(false);
  useEffect(() => {
    if (!ready || redirected) return;
    if (isFacilitator && mode === "facilitator" && path === "/") {
      setRedirected(true);
      navigate({ to: "/facilitate" });
    } else {
      setRedirected(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (path.startsWith("/auth") || path.startsWith("/welcome") || path.startsWith("/w/")) return <>{children}</>;

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-background">
      <TabBar />
      <main className="md:pl-60">
        <div className="mx-auto max-w-5xl px-4 pt-5 md:px-8 md:pt-10 md:pb-12 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-12">
          <NowPlayingBar />
          {children}
        </div>
      </main>
    </div>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <ViewModeProvider>
        <AuthPromptProvider>
          <AmbientPlayerProvider>
            <PaymentTestModeBanner />
            <AppFrame>
              <Outlet />
            </AppFrame>
            <Toaster />
          </AmbientPlayerProvider>
        </AuthPromptProvider>
      </ViewModeProvider>
    </AuthProvider>
  );
}

function LiveSidebarPill() {
  const count = useLiveCount();
  if (count === 0) return null;
  return (
    <Link to="/" className="mt-4 flex items-center gap-2 rounded-full border border-forest/30 bg-accent/40 px-3 py-1.5 text-xs text-forest hover:bg-accent/60">
      <Radio className="h-3 w-3 live-pulse" />
      <span className="font-medium">{count} walking & talking now</span>
    </Link>
  );
}
