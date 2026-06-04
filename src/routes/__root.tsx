import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AuthPromptProvider, useAuthPrompt } from "@/lib/auth-prompt";
import { Toaster } from "@/components/ui/sonner";
import { Footprints, Calendar, BookHeart, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileTabBar } from "@/components/mobile-tab-bar";
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
      { name: "description", content: "Post a walk, share a page, RSVP with friends. A warm, community-first walking app." },
      { property: "og:title", content: "Mental Health Walk Club" },
      { property: "og:description", content: "Post a walk, share a page, RSVP with friends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#2c5340" },
      { name: "apple-mobile-web-app-title", content: "MH Walk Club" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
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

const TABS: Array<{ to: string; label: string; icon: typeof Footprints; exact?: boolean }> = [
  { to: "/", label: "Walk", icon: Footprints, exact: true },
  { to: "/events", label: "Walks", icon: Calendar },
  { to: "/journal", label: "Journal", icon: BookHeart },
  { to: "/profile", label: "Profile", icon: UserIcon },
];

function TabBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const { openAuth } = useAuthPrompt();
  const isActive = (to: string, exact?: boolean) => (exact ? path === to : path === to || path.startsWith(to + "/"));

  return (
    <>
      <MobileTabBar />

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

        <div className="mt-auto pt-6 space-y-3">
          <p className="font-serif text-xs italic leading-relaxed text-muted-foreground">
            You don't have to walk through it alone.
          </p>
          <div className="flex gap-3 text-[10px] text-muted-foreground/70">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
          </div>
        </div>
      </aside>

      {!user ? (
        <header className="sticky top-0 z-30 flex items-center justify-between glass px-4 py-2.5 md:hidden">
          <Link to="/" className="flex items-center gap-2" aria-label="Mental Health Walk Club — home">
            <LogoStamp tone="dark" size={36} />
            <span className="font-serif text-[13px] leading-[1.05] text-foreground/85">Mental Health<br/>Walk Club</span>
          </Link>
          <Button size="sm" onClick={() => openAuth("signup")} className="rounded-full bg-forest text-primary-foreground hover:opacity-90">Sign up</Button>
        </header>
      ) : (
        <header className="sticky top-0 z-30 flex items-center justify-between glass px-4 py-2 md:hidden">
          <Link to="/" className="flex items-center gap-2" aria-label="Mental Health Walk Club — home">
            <LogoStamp tone="dark" size={36} />
            <span className="font-serif text-[13px] leading-[1.05] text-foreground/85">Mental Health<br/>Walk Club</span>
          </Link>
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
        </header>
      )}
    </>
  );
}

function AppFrame({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (path.startsWith("/auth") || path.startsWith("/w/")) return <>{children}</>;
  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-background">
      <TabBar />
      <main className="md:pl-60">
        <div className="mx-auto max-w-3xl px-4 pt-5 md:px-8 md:pt-10 md:pb-12 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-12">
          {children}
        </div>
      </main>
    </div>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <AuthPromptProvider>
        <AmbientPlayerProvider>
          <PaymentTestModeBanner />
          <AppFrame>
            <Outlet />
          </AppFrame>
          <Toaster />
        </AmbientPlayerProvider>
      </AuthPromptProvider>
    </AuthProvider>
  );
}
