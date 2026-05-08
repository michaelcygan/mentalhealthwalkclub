// Auto-managed by scripts/compress-niches.mjs.
// Each entry: blur LQIPs (data URIs) per photo + count.
export interface NicheCover {
  count: number;
  blur: string[];
}

export const NICHE_COVERS: Record<string, NicheCover> = {
  // populated by compress-niches script
};

export function nicheUrl(slug: string, i: number): string {
  return `/niche-covers/${slug}/${i + 1}.webp`;
}
