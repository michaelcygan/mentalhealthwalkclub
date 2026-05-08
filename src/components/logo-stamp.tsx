import logoSrc from "@/assets/logo-stamp.png";

interface Props {
  tone?: "dark" | "light";
  size?: number;
  className?: string;
}

/** Hand-drawn brand stamp. tone="dark" = black on light surface, tone="light" = white on dark. */
export function LogoStamp({ tone = "dark", size = 36, className = "" }: Props) {
  return (
    <img
      src={logoSrc}
      alt="Mental Health Walk Club"
      width={size}
      height={size}
      style={tone === "light" ? { filter: "invert(1)" } : undefined}
      className={`inline-block select-none ${className}`}
      draggable={false}
    />
  );
}
