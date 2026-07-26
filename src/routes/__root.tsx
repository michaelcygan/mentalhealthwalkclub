import { Outlet, Link, createRootRouteWithContext, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AuthPromptProvider, useAuthPrompt } from "@/lib/auth-prompt";
import { Toaster } from "@/components/ui/sonner";
import { Home as HomeIcon, Footprints, Compass, BookHeart, Menu, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { NowPlayingDock } from "@/components/now-playing-dock";
import { LogoStamp } from "@/components/logo-stamp";
import { LoadingScreen } from "@/components/loading-screen";
import { AmbientPlayerProvider } from "@/lib/ambient-context";
import { PlayerProvider } from "@/lib/player-context";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { ReportIssueDialog } from "@/components/report-issue-dialog";
import { installConsoleCapture } from "@/lib/console-capture";
import { dur, easeOut } from "@/lib/motion";

if (typeof window !== "undefined") installConsoleCapture();


function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="t-eyebrow">404</p>
        <h1 className="mt-3 h-display text-foreground">This path drifted off the trail.</h1>
        <p className="mt-3 font-serif text-sm italic text-muted-foreground">Let's get you back to somewhere familiar.</p>
        <div className="mt-7">
          <Link to="/" className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-rest transition hover:opacity-90 active:scale-[0.98]">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Wraps <Outlet /> with a short cross-fade keyed by pathname. Honors reduced motion. */
function RoutedOutlet() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={path}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -2 }}
        transition={{ duration: dur.fast, ease: easeOut }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Mental Health Walk Club — You don't have to walk through it alone" },
      { name: "description", content: "Post a walk, share a page, RSVP with friends. A warm, community-first walking app." },
      { property: "og:title", content: "Mental Health Walk Club" },
      { property: "og:description", content: "Post a walk, share a page, RSVP with friends." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Mental Health Walk Club" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#2c5340" },
      { name: "apple-mobile-web-app-title", content: "MH Walk Club" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32-v2.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192-v2.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512-v2.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icon-180-v2.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=Caveat:wght@500;600&display=swap" },
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

const TABS: Array<{ to: string; label: string; icon: typeof HomeIcon; exact?: boolean }> = [
  { to: "/", label: "Home", icon: HomeIcon, exact: true },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/journal", label: "Journal", icon: BookHeart },
  { to: "/more", label: "More", icon: Menu },
];

function TabBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const { openAuth } = useAuthPrompt();
  const unreadCount = useUnreadNotifications();
  const isActive = (to: string, exact?: boolean) => (exact ? path === to : path === to || path.startsWith(to + "/"));

  return (
    <>
      <MobileTabBar />
      <NowPlayingDock />

      <aside className="fixed left-0 top-0 z-40 hidden h-dvh w-60 flex-col border-r border-border bg-sidebar px-5 py-8 md:flex">
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
            const showBadge = to === "/more" && !!user && unreadCount > 0;
            return (
              <li key={to}>
                <Link
                  to={to as never}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  <span>{label}</span>
                  {showBadge && (
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold leading-none text-destructive-foreground">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {user && (
          <Link
            to="/support"
            className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground transition hover:bg-sidebar-accent/60"
          >
            <LifeBuoy className="h-4.5 w-4.5" />
            Get support
          </Link>
        )}

        <div className="mt-auto pt-6 space-y-3">
          <p className="font-serif text-xs italic leading-relaxed text-muted-foreground">
            You don't have to walk through it alone.
          </p>
          <div className="flex gap-3 text-[10px] text-muted-foreground/70">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <ReportIssueDialog trigger={<button className="hover:text-foreground">Report a problem</button>} />
          </div>
        </div>
      </aside>

      {/* Persistent full-width mobile header */}
      <header
        className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 md:hidden"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex h-12 items-center justify-between gap-2 px-4">
          <Link to="/" className="flex items-center gap-2" aria-label="Mental Health Walk Club — home">
            <LogoStamp tone="dark" size={28} />
            <span className="font-serif text-[12px] leading-[1.05] text-foreground/85">Mental Health<br/>Walk Club</span>
          </Link>
          {!user ? (
            <Button size="sm" onClick={() => openAuth("signup")} className="h-8 rounded-full bg-forest px-3.5 text-primary-foreground hover:opacity-90">
              Sign up
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <NotificationsBell />
              <Link
                to="/support"
                aria-label="Get support"
                title="Get support"
                className="grid h-8 w-8 place-items-center rounded-full bg-accent/60 text-forest transition active:scale-95 hover:bg-accent"
              >
                <LifeBuoy className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </header>
    </>
  );
}

function AppFrame({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (path.startsWith("/auth") || path.startsWith("/w/")) return <>{children}</>;
  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-dvh bg-background">
      <TabBar />
      <main className="md:pl-60">
        <div className="mx-auto max-w-3xl px-4 pt-3 pb-[calc(8rem+env(safe-area-inset-bottom))] md:px-8 md:pt-10 md:pb-12">
          {children}
        </div>
      </main>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthPromptProvider>
          <AmbientPlayerProvider>
            <PlayerProvider>
              <PaymentTestModeBanner />
              <AppFrame>
                <RoutedOutlet />
              </AppFrame>
              <Toaster />
            </PlayerProvider>
          </AmbientPlayerProvider>
        </AuthPromptProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}


// Reset md: padding-top via inline class (since style is mobile-tuned). On md+, the floating header is hidden.
