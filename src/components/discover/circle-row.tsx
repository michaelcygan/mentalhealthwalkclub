import { Link } from "@tanstack/react-router";
import { Users, CalendarPlus } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

interface CircleSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  member_count: number;
  avatars: Array<{ avatar_url: string | null; display_name: string | null }>;
  active_walkers: number;
  owned_by_me: boolean;
}

interface Props {
  circle: CircleSummary;
}

export function CircleRow({ circle }: Props) {
  const navigate = useNavigate();

  const planWalk = () => {
    navigate({ to: "/walk/new", search: { circle: circle.id } });
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft">
      <div
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-medium text-white"
        style={{ background: circle.color ?? "var(--forest, #4a6741)" }}
      >
        {circle.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <Link to="/circles" className="truncate font-serif text-base hover:underline">
          {circle.name}
        </Link>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {circle.member_count} member{circle.member_count === 1 ? "" : "s"}
          </span>
          {circle.active_walkers > 0 && (
            <span>· {circle.active_walkers} walked this week</span>
          )}
        </div>
      </div>
      <button
        onClick={planWalk}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-accent/40"
      >
        <CalendarPlus className="h-3 w-3" />
        Plan walk
      </button>
    </div>
  );
}
