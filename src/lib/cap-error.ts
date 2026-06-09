// Client-safe parser for cap-limit errors thrown by requireUnderCap (server).
// Mirrors the structured format: `CAP_LIMIT|<surface>|<cap>|<message>`.

export type CapSurface = "saved_reads" | "playlists" | "collections_follow";

export interface CapError {
  surface: CapSurface;
  cap: number;
  message: string;
}

export function parseCapError(err: unknown): CapError | null {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (!msg.startsWith("CAP_LIMIT|")) return null;
  const [, surface, cap, ...rest] = msg.split("|");
  if (!surface || !cap) return null;
  return {
    surface: surface as CapSurface,
    cap: Number(cap),
    message: rest.join("|"),
  };
}

export const CAP_UPSELL_COPY: Record<
  CapSurface,
  { title: string; body: (cap: number) => string }
> = {
  saved_reads: {
    title: "Save without limits",
    body: (cap) =>
      `You're at the free cap of ${cap} saved reads. Plus keeps unlimited articles for your walks.`,
  },
  playlists: {
    title: "More playlists with Plus",
    body: (cap) =>
      `Free plan keeps ${cap} custom playlists. Plus lets you build as many as you like.`,
  },
  collections_follow: {
    title: "Follow more collections",
    body: (cap) =>
      `Free plan follows ${cap} collections. Plus removes the cap so you can keep exploring.`,
  },
};
