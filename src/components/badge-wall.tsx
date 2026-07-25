import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { haptics } from "@/lib/device";
import {
  Award, Sun, Sunrise, Cloud, CloudRain, Leaf, CircleDashed, Users, Footprints, Heart,
  Sparkles, Moon, Mountain,
} from "lucide-react";

interface BadgeDef {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string | null;
}
interface EarnedRow { badge_id: string; earned_at: string; walk_session_id: string | null; }

const ICON: Record<string, typeof Award> = {
  award: Award, sun: Sun, sunrise: Sunrise, cloud: Cloud, "cloud-rain": CloudRain, leaf: Leaf,
  "circle-dashed": CircleDashed, users: Users, footprints: Footprints, heart: Heart,
  sparkles: Sparkles, moon: Moon, mountain: Mountain,
};

function iconFor(key: string | null) {
  if (!key) return Award;
  return ICON[key] ?? Award;
}

interface Props { userId: string; }

export function BadgeWall({ userId }: Props) {
  const [defs, setDefs] = useState<BadgeDef[]>([]);
  const [earned, setEarned] = useState<Map<string, EarnedRow>>(new Map());
  const [open, setOpen] = useState<BadgeDef | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("badge_definitions").select("id,key,name,description,icon,category").eq("is_active", true).order("category"),
      supabase.from("user_badges").select("badge_id,earned_at,walk_session_id").eq("user_id", userId),
    ]).then(([d, e]) => {
      setDefs((d.data ?? []) as BadgeDef[]);
      const map = new Map<string, EarnedRow>();
      (e.data ?? []).forEach((r) => map.set(r.badge_id, r as EarnedRow));
      setEarned(map);
    });
  }, [userId]);

  const earnedCount = earned.size;
  const total = defs.length;

  const earnedDate = useMemo(() => {
    if (!open) return null;
    const r = earned.get(open.id);
    return r ? new Date(r.earned_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : null;
  }, [open, earned]);

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Quiet Wins</div>
          <h2 className="mt-1 font-serif text-xl">Badges</h2>
        </div>
        <span className="font-serif text-sm tabular-nums text-muted-foreground">{earnedCount}<span className="text-muted-foreground/50">/{total}</span></span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {defs.map((b) => {
          const got = earned.has(b.id);
          const Icon = iconFor(b.icon);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => { haptics.tap(); setOpen(b); }}
              className={`group flex flex-col items-center gap-1.5 rounded-2xl border p-3 transition active:scale-95 ${
                got
                  ? "border-forest/30 bg-gradient-to-br from-accent/40 to-card hover:border-forest/60"
                  : "border-border/50 bg-secondary/30 opacity-60 hover:opacity-90"
              }`}
            >
              <span className={`grid h-11 w-11 place-items-center rounded-full ${got ? "bg-forest text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"}`} aria-hidden="true">
                <Icon className="h-5 w-5" strokeWidth={got ? 2.2 : 1.6} />
              </span>
              <span className={`line-clamp-2 text-center text-[10px] leading-tight ${got ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                {b.name}
              </span>
            </button>
          );
        })}
      </div>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          {open && (() => {
            const Icon = iconFor(open.icon);
            const got = earned.has(open.id);
            return (
              <div className="mx-auto max-w-sm pb-6 text-center">
                <SheetHeader>
                  <SheetTitle className="sr-only">{open.name}</SheetTitle>
                  <SheetDescription className="sr-only">{open.description}</SheetDescription>
                </SheetHeader>
                <div className={`mx-auto mt-2 grid h-24 w-24 place-items-center rounded-full ${got ? "bg-forest text-primary-foreground shadow-elevated animate-in zoom-in-50 duration-500" : "bg-secondary text-muted-foreground"}`}>
                  <Icon className="h-10 w-10" strokeWidth={got ? 2 : 1.5} />
                </div>
                <h3 className="mt-4 font-serif text-2xl">{open.name}</h3>
                {open.description && <p className="mt-2 px-2 text-sm text-muted-foreground">{open.description}</p>}
                <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-forest">
                  {got ? `Earned ${earnedDate}` : "Not yet earned"}
                </p>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </section>
  );
}
