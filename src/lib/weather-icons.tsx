import type { WeatherTone } from "@/lib/weather";

interface Props { tone: WeatherTone; isDay?: boolean; className?: string }

/**
 * Inline SVG weather glyphs. Use currentColor so they inherit from text.
 * Kept tiny on purpose — no external icon dependency.
 */
export function WeatherGlyph({ tone, isDay = true, className }: Props) {
  const cls = className ?? "h-4 w-4";
  switch (tone) {
    case "clear":
      return isDay ? (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className={cls} fill="currentColor"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></svg>
      );
    case "cloud":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 18a4 4 0 010-8 5 5 0 019.6-1.5A4 4 0 0117 18H7z" />
        </svg>
      );
    case "drizzle":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 14a4 4 0 010-8 5 5 0 019.6-1.5A4 4 0 0117 14H7z" />
          <path d="M9 18l-1 2M13 18l-1 2M17 18l-1 2" />
        </svg>
      );
    case "rain":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 14a4 4 0 010-8 5 5 0 019.6-1.5A4 4 0 0117 14H7z" />
          <path d="M8 17l-1 4M12 17l-1 4M16 17l-1 4" />
        </svg>
      );
    case "snow":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 14a4 4 0 010-8 5 5 0 019.6-1.5A4 4 0 0117 14H7z" />
          <path d="M9 19l.01 0M13 18l.01 0M17 19l.01 0" />
        </svg>
      );
    case "fog":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 10h18M3 14h14M5 18h16" />
        </svg>
      );
    case "storm":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 14a4 4 0 010-8 5 5 0 019.6-1.5A4 4 0 0117 14H7z" />
          <path d="M11 14l-2 4h3l-1 4 4-6h-3l1-2z" fill="currentColor" />
        </svg>
      );
  }
}
