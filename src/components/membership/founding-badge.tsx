import { Leaf } from "lucide-react";

interface Props {
  size?: "xs" | "sm" | "md";
  title?: string;
  className?: string;
}

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
};

/** Small leaf badge shown next to a Supporter's name across the app. */
export function FoundingBadge({ size = "sm", title = "Founding Supporter", className = "" }: Props) {
  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-grid place-items-center rounded-full bg-forest/15 p-0.5 text-forest ${className}`}
    >
      <Leaf className={SIZE[size]} />
    </span>
  );
}
