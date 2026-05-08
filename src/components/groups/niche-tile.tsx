import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { Group, GroupPulse } from "@/hooks/use-groups-feed";
import { NICHE_COVERS, nicheUrl } from "@/data/niche-covers";

const NICHE_EMOJI: Record<string, string> = {
  "five-am-club": "☕", "sunrise-club": "🌅", "sunset-chasers": "🌇", "night-owls": "🌙",
  "lunchbreak-walkers": "🥪", "dog-parents": "🐕", "stroller-crew": "👶", "empty-nesters": "🪺",
  "solo-travelers": "🧭", "remote-workers": "💻", "shift-workers": "🌗", "grad-school": "🎓",
  "first-year-teachers": "📚", "healthcare-workers": "🩺", "founders-walk": "🚀", "caregivers": "🤲",
  "walk-instead-of-doomscroll": "📵", "phone-free-walkers": "🤫", "one-podcast-one-walk": "🎧",
  "audiobook-walkers": "📖", "hot-girl-walk": "👟", "silent-walking": "🤍", "rage-walk": "🔥",
  "gratitude-walk": "🙏", "walk-and-pray": "✨", "rainy-day-walkers": "🌧",
};

interface Props {
  group: Group;
  pulse?: GroupPulse;
  joined: boolean;
  onPrefetch?: () => void;
}

const FADE_MS = 1400;

export function NicheTile({ group, pulse, joined, onPrefetch }: Props) {
  const cover = NICHE_COVERS[group.slug];
  const emoji = NICHE_EMOJI[group.slug] ?? "✦";
  const live = pulse?.live ?? 0;
  const week = pulse?.walkersWeek ?? 0;

  const [active, setActive] = useState(0);
  const ref = useRef<HTMLLIElement>(null);
  const inViewRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!cover || cover.count <= 1) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const schedule = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      // 6–9 second random interval for organic, offset cadence
      const ms = 6000 + Math.random() * 3000;
      timerRef.current = window.setTimeout(() => {
        if (inViewRef.current && document.visibilityState === "visible") {
          setActive((i) => (i + 1) % cover.count);
        }
        schedule();
      }, ms);
    };

    const io = new IntersectionObserver(([entry]) => {
      inViewRef.current = entry.isIntersecting;
    }, { threshold: 0.1 });
    io.observe(el);

    // Random initial delay 0–4s so neighbors stagger
    const startDelay = Math.random() * 4000;
    const startId = window.setTimeout(schedule, startDelay);

    return () => {
      io.disconnect();
      window.clearTimeout(startId);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [cover]);

  return (
    <li
      ref={ref}
      onPointerEnter={onPrefetch}
      className="group/niche relative aspect-square overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition hover:-translate-y-px hover:border-forest/40 tap-press"
    >
      {cover ? (
        <>
          {/* LQIP base */}
          <div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${cover.blur[0]})` }}
          />
          {Array.from({ length: cover.count }).map((_, i) => (
            <img
              key={i}
              src={nicheUrl(group.slug, i)}
              alt=""
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              width={640}
              height={640}
              className="absolute inset-0 h-full w-full object-cover transition-opacity ease-in-out"
              style={{ transitionDuration: `${FADE_MS}ms`, opacity: active === i ? 1 : 0 }}
            />
          ))}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-accent/40 to-card" />
      )}

      {/* Glyph */}
      <div className={`absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full text-base ${cover ? "bg-white/85 backdrop-blur-sm" : ""}`}>
        <span className="leading-none">{emoji}</span>
      </div>

      {/* Joined / live badge */}
      {(live > 0 || joined) && (
        <div className="absolute right-2 top-2">
          {live > 0 ? (
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${cover ? "bg-white/90 text-forest backdrop-blur-sm" : "bg-forest/15 text-forest"}`}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full city-pulse-ring rounded-full bg-forest/70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-forest" />
              </span>
              {live}
            </span>
          ) : (
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] text-forest ${cover ? "bg-white/90 backdrop-blur-sm" : "bg-card/80"}`}>
              <Check className="inline h-2.5 w-2.5" />
            </span>
          )}
        </div>
      )}

      {/* Label */}
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 p-2.5 ${cover ? "text-white" : "text-foreground"}`}>
        <div className={`font-serif text-[14px] leading-tight line-clamp-2 ${cover ? "drop-shadow" : ""}`}>{group.name}</div>
        <div className={`mt-0.5 text-[10px] ${cover ? "text-white/80" : "text-muted-foreground"}`}>
          {live > 0 ? `${live} live` : week > 0 ? `${week}/wk` : `${group.member_count.toLocaleString()}`}
        </div>
      </div>

      <Link
        to={"/groups/$slug" as never}
        params={{ slug: group.slug } as never}
        aria-label={`Open ${group.name}`}
        className="absolute inset-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest/50"
      />
    </li>
  );
}
