import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Award, icons as lucideIcons, ExternalLink } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { JournalBadge } from "@/lib/journal-entries.functions";

function iconFor(name: string | null): LucideIcon {
  if (!name) return Award;
  const reg = lucideIcons as unknown as Record<string, LucideIcon>;
  // Match PascalCase first, then a normalized fallback.
  if (reg[name]) return reg[name];
  const normalized = name
    .split(/[-_\s]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  return reg[normalized] ?? Award;
}

interface Props {
  badges: JournalBadge[];
  count: number;
}

export function BadgesCarousel({ badges, count }: Props) {
  const [open, setOpen] = useState<JournalBadge | null>(null);
  const earnedDate = useMemo(
    () =>
      open
        ? new Date(open.earned_at).toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : null,
    [open],
  );

  return (
    <div className="border-t border-border pt-4">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">
          Quiet wins
        </div>
        <Link
          to="/profile"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          View all <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex items-stretch gap-3">
        {/* Count tile */}
        <div className="flex w-[88px] shrink-0 flex-col items-center justify-center rounded-2xl border border-border bg-card/60 px-2 py-3 text-center">
          <div className="font-serif text-2xl tabular-nums leading-none">{count}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            badges
            <br />earned
          </div>
        </div>

        {/* Rail */}
        <div className="relative min-w-0 flex-1">
          {badges.length === 0 ? (
            <div className="flex h-full items-center rounded-2xl border border-dashed border-border bg-card/40 px-3 text-[11px] italic text-muted-foreground">
              First badge unlocks with your first walk or reflection.
            </div>
          ) : (
            <>
              <div className="scrollbar-hide flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
                {badges.map((b, i) => {
                  const Icon = iconFor(b.icon);
                  return (
                    <motion.button
                      key={b.id}
                      type="button"
                      onClick={() => setOpen(b)}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.25 }}
                      whileTap={{ scale: 0.94 }}
                      className="group flex w-[68px] shrink-0 snap-start flex-col items-center gap-1 rounded-2xl border border-border bg-gradient-to-br from-accent/40 to-card p-2 transition hover:border-forest/40"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="line-clamp-2 text-center text-[9px] font-medium leading-tight text-foreground/75">
                        {b.name}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
              {/* edge fade */}
              <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card to-transparent" />
            </>
          )}
        </div>
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-xs rounded-3xl">
          {open && (
            <>
              <DialogHeader className="items-center text-center">
                <span className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-forest">
                  {(() => {
                    const Icon = iconFor(open.icon);
                    return <Icon className="h-6 w-6" />;
                  })()}
                </span>
                <DialogTitle className="font-serif text-xl">{open.name}</DialogTitle>
                {open.description && (
                  <DialogDescription className="text-sm">{open.description}</DialogDescription>
                )}
              </DialogHeader>
              <p className="text-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Earned {earnedDate}
              </p>
              <Link
                to="/profile"
                onClick={() => setOpen(null)}
                className="mx-auto mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs text-foreground hover:border-forest/40"
              >
                See all badges <ExternalLink className="h-3 w-3" />
              </Link>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
