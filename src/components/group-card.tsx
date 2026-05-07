import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check, Plus, Radio, Calendar, MapPin, Users } from "lucide-react";
import type { Group, GroupPulse } from "@/hooks/use-groups-feed";

const themeTint: Record<string, string> = {
  anxiety: "from-sky-100/60",
  burnout: "from-orange-100/60",
  grief: "from-violet-100/60",
  depression: "from-indigo-100/60",
  loneliness: "from-rose-100/60",
  reset: "from-emerald-100/60",
  quiet: "from-stone-100/60",
  connection: "from-amber-100/60",
  chapter: "from-teal-100/60",
};

function describeNext(iso: string | null): string | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  const diffMin = Math.round((ts - Date.now()) / 60_000);
  if (diffMin < 60) return `in ${Math.max(diffMin, 1)} min`;
  if (diffMin < 60 * 24) return `in ${Math.round(diffMin / 60)} h`;
  return new Date(ts).toLocaleDateString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

export function GroupCard({
  group, pulse, joined, onToggle, variant = "tile",
}: {
  group: Group;
  pulse?: GroupPulse;
  joined: boolean;
  onToggle: () => void;
  variant?: "tile" | "pulse";
}) {
  const tint = (group.theme && themeTint[group.theme]) || "from-accent/40";
  const next = describeNext(pulse?.nextStart ?? null);

  if (variant === "pulse") {
    const isLive = !!pulse?.live;
    return (
      <Link
        to={"/groups/$slug" as never}
        params={{ slug: group.slug } as never}
        className={`group/pill inline-flex h-9 shrink-0 items-center gap-2 rounded-full border ${isLive ? "border-forest/40 bg-forest/8" : "border-border bg-card"} px-3 text-xs shadow-soft/50 transition hover:-translate-y-px hover:border-forest/50`}
      >
        {isLive ? (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-forest" />
          </span>
        ) : next ? (
          <Calendar className="h-3 w-3 text-forest/80" />
        ) : (
          <Radio className="h-3 w-3 text-forest/70" />
        )}
        <span className="max-w-[140px] truncate font-serif text-[13px] text-foreground">{group.name}</span>
        <span className="rounded-full bg-card/80 px-1.5 py-0.5 text-[10px] font-medium text-forest/80">
          {isLive ? `${pulse!.live} live` : next ?? "active"}
        </span>
      </Link>
    );
  }

  return (
    <li className={`flex flex-col rounded-2xl border border-border bg-gradient-to-br ${tint} to-card p-5 shadow-soft transition hover:-translate-y-px hover:border-forest/40`}>
      <div className="flex items-start justify-between gap-2">
        <Link to={"/groups/$slug" as never} params={{ slug: group.slug } as never} className="font-serif text-xl hover:text-forest">
          {group.name}
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {pulse?.live ? <span className="rounded-full bg-forest/15 px-2 py-0.5 text-[10px] font-medium text-forest">● {pulse.live} live</span> : null}
          {!pulse?.live && next ? <span className="rounded-full bg-card/70 px-2 py-0.5 text-[10px] font-medium text-foreground/70">{next}</span> : null}
        </div>
      </div>
      {group.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{group.description}</p>}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{group.member_count}</span>
          {pulse?.walkersWeek ? <span className="text-forest/80">· {pulse.walkersWeek} this week</span> : null}
          {group.city ? <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{group.city}</span> : null}
        </div>
        <Button
          size="sm"
          variant={joined ? "outline" : "default"}
          onClick={onToggle}
          className={joined ? "h-7 rounded-full border-forest/30 px-2.5 text-xs text-forest hover:bg-forest/5" : "h-7 rounded-full bg-forest px-2.5 text-xs text-primary-foreground hover:opacity-90"}
        >
          {joined ? (<><Check className="mr-1 h-3 w-3" />Joined</>) : (<><Plus className="mr-1 h-3 w-3" />Join</>)}
        </Button>
      </div>
    </li>
  );
}
