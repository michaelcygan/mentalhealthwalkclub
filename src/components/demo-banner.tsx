import { Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { getLastAuthMethod } from "@/hooks/use-entry-flow";

/** Persistent banner shown while previewing the app as the demo persona. */
export function DemoBanner() {
  const { demo, exit } = useDemoMode();
  const { openAuth } = useAuthPrompt();
  const [hidden, setHidden] = useState(false);
  if (!demo || hidden) return null;
  const lastAuth = getLastAuthMethod();
  const cta = lastAuth ? "Log in" : "Create account";

  return (
    <div className="sticky top-0 z-30 -mx-4 mb-3 flex items-center gap-2 border-b border-forest/20 bg-accent/70 px-4 py-2 text-xs text-foreground backdrop-blur md:mx-0 md:rounded-2xl md:border md:border-forest/20 md:px-4">
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-forest" />
      <span className="flex-1 truncate">
        Previewing as <span className="font-medium">Jordan</span> — make it yours.
      </span>
      <button
        onClick={() => openAuth(lastAuth ? "signin" : "signup")}
        className="shrink-0 rounded-full bg-forest px-3 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90"
      >
        {cta}
      </button>
      <button
        onClick={() => { exit(); setHidden(true); }}
        className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground"
        aria-label="Exit preview"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
