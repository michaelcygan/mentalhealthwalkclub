import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Sun, Sunrise, Sunset, Moon } from "lucide-react";
import type { Group, GroupPulse } from "@/hooks/use-groups-feed";
import { useCityHour } from "@/hooks/use-city-hour";
import { CITY_COVERS, coverUrl, dayStateFromHour, type DayState } from "@/data/city-covers";
import { CITY_PROCEDURAL, proceduralBackground } from "@/data/city-procedural";

const FLAG: Record<string, string> = {
  US: "🇺🇸", CA: "🇨🇦", MX: "🇲🇽", GB: "🇬🇧", IE: "🇮🇪", DE: "🇩🇪",
  NL: "🇳🇱", FR: "🇫🇷", ES: "🇪🇸", AU: "🇦🇺", NZ: "🇳🇿", JP: "🇯🇵", SG: "🇸🇬",
};

const STATE_GLYPH: Record<DayState, React.ComponentType<{ className?: string }>> = {
  dawn: Sunrise,
  day: Sun,
  golden: Sunset,
  night: Moon,
};

interface Props {
  group: Group;
  pulse?: GroupPulse;
  joined: boolean;
  onToggle: () => void;
}

export function CityTile({ group, pulse, joined }: Props) {
  const slug = group.cover_set ?? "";
  const photoCover = CITY_COVERS[slug];
  const procCover = CITY_PROCEDURAL[slug];
  const tz = photoCover?.tz ?? procCover?.tz;
  const hour = useCityHour(tz);
  const state: DayState = dayStateFromHour(hour);
  const Glyph = STATE_GLYPH[state];

  // Pause Ken-Burns when off-screen.
  const ref = useRef<HTMLLIElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!photoCover && !procCover) return null;

  const live = pulse?.live ?? 0;
  const flag = group.country ? FLAG[group.country] : null;
  const sub = group.location_label ?? group.city;
  const isNight = state === "night";

  return (
    <li
      ref={ref}
      className="group/city relative aspect-square overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition hover:-translate-y-px hover:border-forest/40"
    >
      {photoCover ? (
        <>
          {/* LQIP base layer */}
          <div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${photoCover.blur[state]})` }}
          />
          {/* Crisp image w/ Ken Burns */}
          <img
            src={coverUrl(slug, state)}
            alt=""
            loading="lazy"
            decoding="async"
            width={480}
            height={600}
            className="absolute inset-0 h-full w-full object-cover ken-burns"
            style={{ animationPlayState: inView ? "running" : "paused" }}
          />
        </>
      ) : (
        <>
          {/* Procedural sky */}
          <div
            aria-hidden
            className="absolute inset-0 ken-burns"
            style={{ background: proceduralBackground(procCover!.hue, state), animationPlayState: inView ? "running" : "paused" }}
          />
          {/* Abstract skyline silhouette */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent 0 9px, currentColor 9px 14px, transparent 14px 24px, currentColor 24px 28px, transparent 28px 38px, currentColor 38px 46px, transparent 46px 60px, currentColor 60px 64px, transparent 64px 78px)",
              backgroundSize: "120px 100%",
              backgroundRepeat: "repeat-x",
              backgroundPosition: "left bottom",
              maskImage: "linear-gradient(180deg, transparent 0%, #000 65%, #000 100%)",
              WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 65%, #000 100%)",
              color: isNight ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.32)",
            }}
          />
          {/* Twinkling stars at night */}
          {isNight && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                backgroundImage:
                  "radial-gradient(1px 1px at 12% 22%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 38% 14%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 62% 28%, #fff 50%, transparent 51%), radial-gradient(1.4px 1.4px at 82% 18%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 24% 38%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 70% 8%, #fff 50%, transparent 51%)",
              }}
            />
          )}
        </>
      )}
      {/* Bottom gradient for legibility */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
      {/* Time-of-day glyph */}
      <div className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/30 text-white/90 backdrop-blur-sm glyph-float">
        <Glyph className="h-3.5 w-3.5" />
      </div>
      {/* Live / joined badges */}
      {(live > 0 || joined) && (
        <div className="absolute left-2 top-2">
          {live > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-medium text-forest backdrop-blur-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full city-pulse-ring rounded-full bg-forest/70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-forest" />
              </span>
              {live}
            </span>
          ) : (
            <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] text-forest backdrop-blur-sm"><Check className="inline h-2.5 w-2.5" /></span>
          )}
        </div>
      )}
      {/* Label */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2.5 text-white">
        <div className="flex items-center gap-1.5 text-[15px] font-serif leading-tight drop-shadow">
          {flag && <span className="text-base leading-none">{flag}</span>}
          <span className="line-clamp-1">{group.city ?? group.name}</span>
        </div>
        {sub && sub !== group.city && (
          <div className="mt-0.5 truncate text-[10px] text-white/80">{sub}</div>
        )}
      </div>
      {/* Click target */}
      <Link
        to={"/groups/$slug" as never}
        params={{ slug: group.slug } as never}
        aria-label={`Open ${group.name}`}
        className="absolute inset-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
      />
    </li>
  );
}
