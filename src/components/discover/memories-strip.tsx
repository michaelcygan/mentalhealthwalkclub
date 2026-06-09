import { Link } from "@tanstack/react-router";
import { ImageOff } from "lucide-react";

interface Memory {
  id: string;
  kind: "walk";
  photoUrl: string;
  width: number | null;
  height: number | null;
  date: string;
  duration_min: number | null;
}

interface Props {
  memories: Memory[];
}

export function MemoriesStrip({ memories }: Props) {
  if (!memories.length) return null;

  return (
    <div className="-mx-4 px-4">
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {memories.map((m) => (
          <Link
            key={m.id}
            to="/journal"
            className="group relative block w-40 shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-card"
          >
            <div className="relative h-32 overflow-hidden">
              <img
                src={m.photoUrl}
                alt="Walk memory"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-[11px] text-white/90">{formatRelativeDate(m.date)}</p>
                {m.duration_min != null && (
                  <p className="text-[10px] text-white/70">{m.duration_min} min walk</p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function formatRelativeDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
