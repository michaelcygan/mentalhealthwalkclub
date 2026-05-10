import { Award, Flame, Trophy, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface Signal {
  key: string;
  icon: "badge" | "rank" | "streak" | "spark";
  label: string;
  to?: string;
}

interface Props {
  latestBadgeName?: string | null;
  rank?: number | null;
  groupName?: string | null;
  streakWeeks?: number | null;
}

const ICONS = {
  badge: Award,
  rank: Trophy,
  streak: Flame,
  spark: Sparkles,
} as const;

export function SignalsRow({ latestBadgeName, rank, groupName, streakWeeks }: Props) {
  const signals: Signal[] = [];
  if (latestBadgeName) signals.push({ key: "badge", icon: "badge", label: latestBadgeName, to: "/badges" });
  if (rank && groupName) signals.push({ key: "rank", icon: "rank", label: `#${rank} in ${groupName}` });
  if (streakWeeks && streakWeeks > 1) signals.push({ key: "streak", icon: "streak", label: `${streakWeeks}-week streak` });

  if (signals.length === 0) return null;

  return (
    <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
      {signals.map((s) => {
        const Icon = ICONS[s.icon];
        const inner = (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] text-foreground/80 hover:border-forest/30">
            <Icon className="h-3 w-3 text-forest" />
            {s.label}
          </span>
        );
        return s.to ? (
          <Link key={s.key} to={s.to}>{inner}</Link>
        ) : (
          <div key={s.key}>{inner}</div>
        );
      })}
    </div>
  );
}
