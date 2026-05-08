import { useEffect, useRef, useState } from "react";
import { MOOD_COVERS, moodUrl } from "@/data/mood-covers";

interface Props {
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

export function MoodThumb({ theme, groupId, fallbackBand, size = 32 }: Props) {
  const cover = theme ? MOOD_COVERS[theme] : undefined;
  const ref = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!cover) {
    return <span className={`relative h-8 w-8 shrink-0 rounded-full ${fallbackBand}`} aria-hidden style={{ height: size, width: size }} />;
  }

  // 5s per slide, with negative delay to phase-shift each card.
  const cycle = cover.count * 5;
  const delay = -(hash(groupId, cycle * 10) / 10);

  return (
    <span
      ref={ref}
      aria-hidden
      className={`relative shrink-0 overflow-hidden rounded-full ring-1 ring-border/60 ${fallbackBand}`}
      style={{ height: size, width: size, backgroundImage: `url(${cover.blur[0]})`, backgroundSize: "cover", backgroundPosition: "center" }}
    >
      {Array.from({ length: cover.count }).map((_, i) => (
        <img
          key={i}
          src={moodUrl(theme!, i)}
          alt=""
          loading="lazy"
          decoding="async"
          width={size * 2}
          height={size * 2}
          className="mood-fade absolute inset-0 h-full w-full object-cover"
          style={{
            animationDuration: `${cycle}s`,
            animationDelay: `${delay + i * 5}s`,
            animationPlayState: inView ? "running" : "paused",
          }}
        />
      ))}
    </span>
  );
}
