import { useEffect, useMemo, useRef, useState } from "react";
import suburbanIl from "../../public/videos/ambient/suburban-il.mp4.asset.json";
import ruralCo from "../../public/videos/ambient/rural-co.mp4.asset.json";
import nyc from "../../public/videos/ambient/nyc.mp4.asset.json";
import posterFallback from "@/assets/walk-hero.jpg";

export type AmbientClip = "suburban-il" | "rural-co" | "nyc" | "auto";

const CLIPS: Record<Exclude<AmbientClip, "auto">, { src: string; tone: "warm" | "cool" }> = {
  "suburban-il": { src: suburbanIl.url, tone: "warm" },
  "rural-co": { src: ruralCo.url, tone: "warm" },
  nyc: { src: nyc.url, tone: "cool" },
};

const ORDER: Array<Exclude<AmbientClip, "auto">> = ["suburban-il", "rural-co", "nyc"];

interface Props {
  clip?: AmbientClip;
  className?: string;
  children?: React.ReactNode;
  /** Bottom-weighted scrim depth; "strong" for more text. */
  scrim?: "soft" | "medium" | "strong";
}

/**
 * Looping ambient walking video with poster fallback.
 * - Reduced-motion users see the poster only.
 * - Pauses when offscreen or tab hidden.
 * - Lazy-mounts the <video> after first interaction-free idle.
 */
export function AmbientVideoBanner({ clip = "auto", className = "", children, scrim = "medium" }: Props) {
  const resolved = useMemo<Exclude<AmbientClip, "auto">>(() => {
    if (clip !== "auto") return clip;
    // Stable per-mount rotation: pick by hour bucket so repeat visits drift.
    const h = typeof window !== "undefined" ? new Date().getHours() : 0;
    return ORDER[h % ORDER.length];
  }, [clip]);

  const { src } = CLIPS[resolved];
  const ref = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mountVideo, setMountVideo] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(m.matches);
    const onChange = () => setReducedMotion(m.matches);
    m.addEventListener?.("change", onChange);
    // Defer video mount to after first paint to keep TTI snappy.
    const id = window.setTimeout(() => setMountVideo(true), 120);
    return () => {
      m.removeEventListener?.("change", onChange);
      window.clearTimeout(id);
    };
  }, []);

  // Pause when offscreen / tab hidden.
  useEffect(() => {
    const v = ref.current;
    const el = containerRef.current;
    if (!v || !el || reducedMotion) return;
    let visible = true;
    let inView = true;
    const sync = () => {
      if (visible && inView) v.play().catch(() => {});
      else v.pause();
    };
    const onVis = () => { visible = document.visibilityState === "visible"; sync(); };
    document.addEventListener("visibilitychange", onVis);
    const io = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }, { threshold: 0.1 })
      : null;
    io?.observe(el);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      io?.disconnect();
    };
  }, [reducedMotion, mountVideo]);

  const scrimClass =
    scrim === "strong" ? "from-black/75 via-black/35 to-black/10"
    : scrim === "soft" ? "from-black/40 via-black/15 to-transparent"
    : "from-black/60 via-black/25 to-transparent";

  return (
    <div ref={containerRef} className={`relative isolate overflow-hidden ${className}`}>
      {/* Poster: instant paint + reduced-motion fallback */}
      <img
        src={posterFallback}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {!reducedMotion && mountVideo && (
        <video
          ref={ref}
          src={src}
          poster={posterFallback}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
          className="absolute inset-0 h-full w-full object-cover motion-safe:opacity-100"
        />
      )}
      {/* Scrims for legibility */}
      <div aria-hidden className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${scrimClass}`} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/30 to-transparent" />
      <div className="relative">{children}</div>
    </div>
  );
}
