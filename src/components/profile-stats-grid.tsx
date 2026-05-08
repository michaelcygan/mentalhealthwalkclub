import { Footprints, Clock, Users, CloudRain } from "lucide-react";
import type { ProfileStats } from "@/hooks/use-profile-stats";

export function ProfileStatsGrid({ s }: { s: ProfileStats }) {
  const hours = Math.floor(s.totalMinutes / 60);
  const items = [
    { icon: Footprints, value: s.totalMiles.toFixed(1), label: "miles" },
    { icon: Clock, value: hours > 0 ? `${hours}h` : `${s.totalMinutes}m`, label: hours > 0 ? "walked" : "walked" },
    { icon: Users, value: String(s.groupCount), label: s.groupCount === 1 ? "group" : "groups" },
    { icon: CloudRain, value: String(s.rainyWalks), label: s.rainyWalks === 1 ? "rainy walk" : "rainy walks" },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map(({ icon: I, value, label }) => (
        <div key={label} className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card p-3 text-center shadow-soft">
          <I className="h-4 w-4 text-forest" strokeWidth={1.8} />
          <div className="font-serif text-base leading-none tabular-nums">{value}</div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
        </div>
      ))}
    </div>
  );
}
