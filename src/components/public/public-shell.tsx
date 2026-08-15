import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { LogoStamp } from "@/components/logo-stamp";
import { useAuthPrompt } from "@/lib/auth-prompt";

/**
 * Chrome for visitors who aren't signed in. Deliberately small: find a walk,
 * post a walk, read, get support. No app tabs, no dock, no notifications.
 */
export function PublicShell({ children }: { children: React.ReactNode }) {
  const { openAuth } = useAuthPrompt();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header
        className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 md:px-8">
          <Link to="/" className="flex items-center gap-2" aria-label="Mental Health Walk Club — home">
            <LogoStamp tone="dark" size={32} />
            <span className="font-serif text-[13px] leading-[1.05] text-foreground/85">
              Mental Health<br />Walk Club
            </span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-5 text-[13px] text-muted-foreground sm:flex">
            <Link to="/walks" className="hover:text-foreground">Walks</Link>
            <Link to="/walk/new" className="hover:text-foreground">Post a walk</Link>
            <Link to="/blog" className="hover:text-foreground">Read</Link>
            <Link to="/support" className="hover:text-foreground">Support</Link>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => openAuth("signin")}
              className="hidden min-h-[36px] px-2 text-[13px] text-muted-foreground hover:text-foreground sm:block"
            >
              Sign in
            </button>
            <Button
              size="sm"
              onClick={() => openAuth("signup")}
              className="h-9 rounded-full bg-forest px-4 text-primary-foreground hover:opacity-90"
            >
              Create account
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 pb-16 md:px-8">{children}</div>
      </main>

      <footer className="border-t border-border/60 bg-card/40">
        <div className="mx-auto max-w-5xl space-y-3 px-4 py-8 md:px-8">
          <nav aria-label="Footer" className="flex flex-wrap gap-4 text-[12px] text-muted-foreground">
            <Link to="/walks" className="hover:text-foreground">Walks</Link>
            <Link to="/groups" className="hover:text-foreground">Groups</Link>
            <Link to="/blog" className="hover:text-foreground">Read</Link>
            <Link to="/support" className="hover:text-foreground">Get support</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
          </nav>
          <p className="font-serif text-xs italic text-muted-foreground">
            You don't have to walk through it alone. Mental Health Walk Club is a community walking
            club — it isn't therapy or crisis care.
          </p>
          <p className="text-[11px] text-muted-foreground/80">
            In the US, call or text 988 to reach the Suicide &amp; Crisis Lifeline.
          </p>
        </div>
      </footer>
    </div>
  );
}
