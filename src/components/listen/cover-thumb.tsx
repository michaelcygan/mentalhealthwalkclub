import { useState } from "react";
import { resolveCover, initialsFor } from "@/lib/cover-url";

interface Props {
  src: string | null | undefined;
  title: string;
  className?: string;
  /** Optional kind for tinted gradient fallback. */
  kind?: "podcast" | "ambient" | "guided" | "blog" | "collection";
}

const KIND_GRADIENT: Record<NonNullable<Props["kind"]>, string> = {
  podcast: "from-forest/40 via-forest/15 to-card",
  ambient: "from-sky-500/30 via-forest/15 to-card",
  guided: "from-amber-500/30 via-forest/15 to-card",
  blog: "from-stone-500/30 via-card to-card",
  collection: "from-forest/30 via-card to-card",
};

/**
 * Image with a graceful initials/gradient fallback when the URL is missing
 * or fails to load. Always fills its parent box.
 */
export function CoverThumb({ src, title, className = "", kind = "collection" }: Props) {
  const resolved = resolveCover(src ?? null);
  const [failed, setFailed] = useState(false);
  const show = resolved && !failed;
  return (
    <div className={`relative h-full w-full overflow-hidden bg-gradient-to-br ${KIND_GRADIENT[kind]} ${className}`}>
      {show ? (
        <img
          src={resolved}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span className="font-serif text-[28%] leading-none text-forest/70" style={{ fontSize: "28%" }}>
            {initialsFor(title)}
          </span>
        </div>
      )}
    </div>
  );
}
