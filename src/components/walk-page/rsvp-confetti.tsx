import { useEffect, useState } from "react";

interface Props {
  trigger: number; // bump this number to fire confetti
}

const COLORS = ["#4a6741", "#c4654a", "#e8a87c", "#87a878", "#c9a84c"];
const SHAPES = ["🍃", "🌿", "·", "✦"];

/**
 * Lofi confetti: drifting leaves + soft sparkles for ~1.4s when `trigger` changes.
 */
export function RsvpConfetti({ trigger }: Props) {
  const [show, setShow] = useState(false);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (trigger === 0 || reduced) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 1600);
    return () => clearTimeout(t);
  }, [trigger, reduced]);

  if (!show) return null;
  const pieces = Array.from({ length: 24 });

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 200;
        const dur = 1100 + Math.random() * 600;
        const drift = (Math.random() - 0.5) * 120;
        const shape = SHAPES[i % SHAPES.length];
        const color = COLORS[i % COLORS.length];
        return (
          <span
            key={i}
            className="rsvp-confetti-piece"
            style={{
              left: `${left}%`,
              ["--drift" as string]: `${drift}px`,
              animationDelay: `${delay}ms`,
              animationDuration: `${dur}ms`,
              color,
              fontSize: shape.length > 1 ? "20px" : "26px",
            }}
          >
            {shape}
          </span>
        );
      })}
    </div>
  );
}
