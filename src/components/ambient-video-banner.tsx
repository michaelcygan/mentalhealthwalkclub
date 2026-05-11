import { useEffect, useRef, useState } from "react";

const LOOP_MP4 = "/videos/ambient/loop.mp4";
const LOOP_WEBM = "/videos/ambient/loop.webm";
const LOOP_POSTER = "/videos/ambient/loop-poster.jpg";

export type AmbientClip = "auto" | "suburban-il" | "rural-co" | "nyc" | "coastal-pnw";

interface Props {
  /** @deprecated Kept for back-compat — every banner now plays the same composited loop. */
  clip?: AmbientClip;
  className?: string;
  children?: React.ReactNode;
  scrim?: "soft" | "medium" | "strong";
}

/**
 * Looping ambient walking video (4 scenes stitched into one MP4).
 * - Reduced-motion users see the poster only.
 * - Pauses when offscreen or tab hidden.
 * - Lazy-mounts the <video> after first paint so initial render stays light.
 */
export function AmbientVideoBanner({ className = "", children, scrim = "medium" }: Props) {
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
    const id = window.setTimeout(() => setMountVideo(true), 120);
    return () => {
      m.removeEventListener?.("change", onChange);
      window.clearTimeout(id);
    };
  }, []);

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
      <img
        src={LOOP_POSTER}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {!reducedMotion && mountVideo && (
        <video
          ref={ref}
          poster={LOOP_POSTER}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src={LOOP_WEBM} type="video/webm" />
          <source src={LOOP_MP4} type="video/mp4" />
        </video>
      )}
      <div aria-hidden className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${scrimClass}`} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/30 to-transparent" />
      <div className="relative h-full w-full">{children}</div>
    </div>
  );
}
