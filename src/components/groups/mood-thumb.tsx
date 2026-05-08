import { useEffect, useRef, useState } from "react";
import { GROUP_COVERS, groupCoverUrl } from "@/data/group-covers";
import { NICHE_COVERS } from "@/data/niche-covers";
import { MOOD_COVERS, moodUrl } from "@/data/mood-covers";

interface Props {
  slug: string;
  theme?: string | null;
  groupId: string;
  fallbackBand: string;
  size?: number;
}

// Stable hash → 0..n
function hash(s: string, mod: number): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

type Source = { count: number; blur: string[]; urlFor: (i: number) => string };

function resolveSource(slug: string, theme?: string | null): Source | null {
  if (GROUP_COVERS[slug]) {
    const c = GROUP_COVERS[slug];
    return { count: c.count, blur: c.blur, urlFor: (i) => groupCoverUrl(slug, i) };
  }
  if (NICHE_COVERS[slug]) {
    const c = NICHE_COVERS[slug];
    return { count: c.count, blur: c.blur, urlFor: (i) => `/niche-covers/${slug}/${i + 1}.webp` };
  }
  if (theme && MOOD_COVERS[theme]) {
    const c = MOOD_COVERS[theme];
    return { count: c.count, blur: c.blur, urlFor: (i) => moodUrl(theme, i) };
  }
  return null;
}

export function MoodThumb({ slug, theme, groupId, fallbackBand, size = 40 }: Props) {
  const source = resolveSource(slug, theme);
  const ref = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);
  const [baseLoaded, setBaseLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!source) {
    return (
      <span
        className={`relative shrink-0 rounded-full ring-1 ring-border/60 ${fallbackBand}`}
        aria-hidden
        style={{ height: size, width: size, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.04)" }}
      />
    );
  }

  // Each crossfade slide held ~7s.
  const cycle = source.count * 7;
  const delay = -(hash(groupId, cycle * 10) / 10);

  return (
    <span
      ref={ref}
      aria-hidden
      className="relative shrink-0 overflow-hidden rounded-full ring-1 ring-border/60 bg-secondary"
      style={{
        height: size,
        width: size,
        backgroundImage: `url(${source.blur[0]})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
      }}
    >
      {/* Steady base layer (always visible once loaded) */}
      <img
        src={source.urlFor(0)}
        alt=""
        loading="lazy"
        decoding="async"
        fetchPriority="high"
        width={size * 2}
        height={size * 2}
        onLoad={() => setBaseLoaded(true)}
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
        style={{ opacity: baseLoaded ? 1 : 0 }}
      />
      {/* Animated overlays — only mount once base is in. */}
      {baseLoaded && source.count > 1 &&
        Array.from({ length: source.count - 1 }).map((_, idx) => {
          const i = idx + 1;
          return (
            <img
              key={i}
              src={source.urlFor(i)}
              alt=""
              loading="lazy"
              decoding="async"
              width={size * 2}
              height={size * 2}
              className="mood-fade absolute inset-0 h-full w-full object-cover"
              style={{
                animationDuration: `${cycle}s`,
                animationDelay: `${delay + i * 7}s`,
                animationPlayState: inView ? "running" : "paused",
              }}
            />
          );
        })}
    </span>
  );
}
