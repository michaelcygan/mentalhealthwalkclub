import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check, Plus, Radio, Calendar, MapPin, Users } from "lucide-react";
import type { Group, GroupPulse } from "@/hooks/use-groups-feed";
import { CityTile } from "@/components/groups/city-tile";

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

const themeBand: Record<string, string> = {
  anxiety: "bg-sky-300/60",
  burnout: "bg-orange-300/60",
  grief: "bg-violet-300/60",
  depression: "bg-indigo-300/60",
  loneliness: "bg-rose-300/60",
  reset: "bg-emerald-300/60",
  quiet: "bg-stone-300/60",
  connection: "bg-amber-300/60",
  chapter: "bg-teal-300/60",
};

function describeNext(iso: string | null): string | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  const diffMin = Math.round((ts - Date.now()) / 60_000);
  if (diffMin < 60) return `in ${Math.max(diffMin, 1)} min`;
  if (diffMin < 60 * 24) return `in ${Math.round(diffMin / 60)} h`;
  return new Date(ts).toLocaleDateString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

const FLAG: Record<string, string> = {
  US: "🇺🇸", CA: "🇨🇦", MX: "🇲🇽", GB: "🇬🇧", IE: "🇮🇪", DE: "🇩🇪",
  NL: "🇳🇱", FR: "🇫🇷", ES: "🇪🇸", AU: "🇦🇺", NZ: "🇳🇿", JP: "🇯🇵", SG: "🇸🇬",
};

export type GroupCardVariant = "tile" | "pulse" | "mini" | "rail" | "gallery" | "niche";

const NICHE_EMOJI: Record<string, string> = {
  "five-am-club": "☕", "sunrise-club": "🌅", "sunset-chasers": "🌇", "night-owls": "🌙",
  "lunchbreak-walkers": "🥪", "dog-parents": "🐕", "stroller-crew": "👶", "empty-nesters": "🪺",
  "solo-travelers": "🧭", "remote-workers": "💻", "shift-workers": "🌗", "grad-school": "🎓",
  "first-year-teachers": "📚", "healthcare-workers": "🩺", "founders-walk": "🚀", "caregivers": "🤲",
  "walk-instead-of-doomscroll": "📵", "phone-free-walkers": "🤫", "one-podcast-one-walk": "🎧",
  "audiobook-walkers": "📖", "hot-girl-walk": "👟", "silent-walking": "🤍", "rage-walk": "🔥",
  "gratitude-walk": "🙏", "walk-and-pray": "✨", "rainy-day-walkers": "🌧",
};

export function GroupCard({
  group, pulse, joined, onToggle, variant = "tile",
}: {
  group: Group;
  pulse?: GroupPulse;
  joined: boolean;
  onToggle: () => void;
  variant?: GroupCardVariant;
}) {
  const tint = (group.theme && themeTint[group.theme]) || "from-accent/40";
  const band = (group.theme && themeBand[group.theme]) || "bg-accent";
  const next = describeNext(pulse?.nextStart ?? null);
  const live = pulse?.live ?? 0;
  const week = pulse?.walkersWeek ?? 0;

  // ─────── PULSE pill ───────
  if (variant === "pulse") {
    const isLive = live > 0;
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
          {isLive ? `${live} live` : next ?? "active"}
        </span>
      </Link>
    );
  }

  // ─────── MINI row ───────
  if (variant === "mini") {
    return (
      <li className="group/mini relative flex items-center gap-2.5 rounded-xl border border-border bg-card px-2.5 py-2 transition hover:border-forest/40">
        <Link
          to={"/groups/$slug" as never}
          params={{ slug: group.slug } as never}
          aria-label={`Open ${group.name}`}
          className="absolute inset-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest/50"
        />
        <span className={`relative h-8 w-8 shrink-0 rounded-lg ${band}`} aria-hidden />
        <div className="relative min-w-0 flex-1">
          <div className="truncate font-serif text-sm leading-tight">{group.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Users className="h-2.5 w-2.5" />{group.member_count.toLocaleString()}
            {live > 0 && <span className="text-forest/80">· {live} live</span>}
            {!live && week > 0 && <span>· {week}/wk</span>}
          </div>
        </div>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
          aria-label={joined ? "Leave" : "Join"}
          className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-full transition ${joined ? "border border-forest/30 text-forest" : "bg-forest text-primary-foreground hover:opacity-90"}`}
        >
          {joined ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </li>
    );
  }

  // ─────── RAIL card (snap carousel) ───────
  if (variant === "rail") {
    return (
      <li className="group/rail relative flex w-[220px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition hover:-translate-y-px hover:border-forest/40">
        <Link
          to={"/groups/$slug" as never}
          params={{ slug: group.slug } as never}
          aria-label={`Open ${group.name}`}
          className="absolute inset-0 z-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest/50"
        />
        <div className={`relative h-2 ${band}`} />
        <div className="relative flex flex-1 flex-col gap-1.5 p-3.5">
          <div className="font-serif text-base leading-tight line-clamp-2">{group.name}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {live > 0 ? (
              <span className="inline-flex items-center gap-1 text-forest">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest/60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-forest" />
                </span>
                {live} live
              </span>
            ) : week > 0 ? (
              <span>{week} this week</span>
            ) : (
              <span>{group.member_count.toLocaleString()} walkers</span>
            )}
            {next && !live && <span className="opacity-50">· {next}</span>}
          </div>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
            className={`relative mt-auto self-start inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition ${joined ? "border border-forest/30 text-forest" : "bg-forest text-primary-foreground hover:opacity-90"}`}
          >
            {joined ? <><Check className="h-3 w-3" />Joined</> : <><Plus className="h-3 w-3" />Join</>}
          </button>
        </div>
      </li>
    );
  }

  // ─────── GALLERY tile (square) ───────
  if (variant === "gallery") {
    if (group.cover_set) {
      return <CityTile group={group} pulse={pulse} joined={joined} onToggle={onToggle} />;
    }
    const flag = group.country ? FLAG[group.country] : null;
    const sub = group.location_label ?? group.city ?? group.theme;
    return (
      <li className={`group/gal relative aspect-square overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${tint} to-card p-3 shadow-soft transition hover:-translate-y-px hover:border-forest/40`}>
        <Link
          to={"/groups/$slug" as never}
          params={{ slug: group.slug } as never}
          aria-label={`Open ${group.name}`}
          className="absolute inset-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest/50"
        />
        <div className="pointer-events-none relative flex h-full flex-col">
          {flag && <div className="text-base leading-none">{flag}</div>}
          <div className="mt-auto">
            <div className="font-serif text-base leading-tight line-clamp-2">{group.name}</div>
            {sub && <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{sub}</div>}
          </div>
          {(live > 0 || joined) && (
            <div className="absolute right-0 top-0">
              {live > 0 ? (
                <span className="rounded-full bg-forest/15 px-1.5 py-0.5 text-[9px] font-medium text-forest">● {live}</span>
              ) : (
                <span className="rounded-full bg-card/80 px-1.5 py-0.5 text-[9px] text-forest"><Check className="inline h-2.5 w-2.5" /></span>
              )}
            </div>
          )}
        </div>
      </li>
    );
  }

  // ─────── TILE (default) ───────
  return (
    <li className={`group/card relative flex flex-col rounded-2xl border border-border bg-gradient-to-br ${tint} to-card p-5 shadow-soft transition hover:-translate-y-px hover:border-forest/40`}>
      <Link
        to={"/groups/$slug" as never}
        params={{ slug: group.slug } as never}
        aria-label={`Open ${group.name}`}
        className="absolute inset-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest/50"
      />
      <div className="relative flex items-start justify-between gap-2 pointer-events-none">
        <span className="font-serif text-xl group-hover/card:text-forest">{group.name}</span>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {live > 0 ? <span className="rounded-full bg-forest/15 px-2 py-0.5 text-[10px] font-medium text-forest">● {live} live</span> : null}
          {!live && next ? <span className="rounded-full bg-card/70 px-2 py-0.5 text-[10px] font-medium text-foreground/70">{next}</span> : null}
        </div>
      </div>
      {group.description && <p className="relative mt-1 text-sm text-muted-foreground line-clamp-2 pointer-events-none">{group.description}</p>}
      <div className="relative mt-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pointer-events-none">
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{group.member_count}</span>
          {week > 0 ? <span className="text-forest/80">· {week} this week</span> : null}
          {(group.location_label || group.city) ? <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{group.location_label ?? group.city}</span> : null}
        </div>
        <Button
          size="sm"
          variant={joined ? "outline" : "default"}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
          className={`relative ${joined ? "h-7 rounded-full border-forest/30 px-2.5 text-xs text-forest hover:bg-forest/5" : "h-7 rounded-full bg-forest px-2.5 text-xs text-primary-foreground hover:opacity-90"}`}
        >
          {joined ? (<><Check className="mr-1 h-3 w-3" />Joined</>) : (<><Plus className="mr-1 h-3 w-3" />Join</>)}
        </Button>
      </div>
    </li>
  );
}
