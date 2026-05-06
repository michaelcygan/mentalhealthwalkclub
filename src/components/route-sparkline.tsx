interface Point { lat: number; lng: number }

export function RouteSparkline({ points, height = 80, className = "" }: { points: Point[]; height?: number; className?: string }) {
  if (!points || points.length < 2) {
    return (
      <div className={`flex h-${height >= 80 ? 20 : 16} items-center justify-center rounded-xl bg-secondary/60 text-[11px] text-muted-foreground ${className}`} style={{ height }}>
        path will appear as you walk
      </div>
    );
  }
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const w = 320;
  const h = height;
  const pad = 8;
  const dLat = Math.max(1e-6, maxLat - minLat);
  const dLng = Math.max(1e-6, maxLng - minLng);
  const scale = Math.min((w - pad * 2) / dLng, (h - pad * 2) / dLat);
  const offX = (w - dLng * scale) / 2;
  const offY = (h - dLat * scale) / 2;
  const d = points
    .map((p, i) => {
      const x = (p.lng - minLng) * scale + offX;
      const y = h - ((p.lat - minLat) * scale + offY);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = points[points.length - 1];
  const lx = (last.lng - minLng) * scale + offX;
  const ly = h - ((last.lat - minLat) * scale + offY);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`w-full ${className}`} style={{ height }} preserveAspectRatio="none">
      <rect x="0" y="0" width={w} height={h} rx="12" className="fill-secondary/40" />
      <path d={d} fill="none" stroke="var(--forest)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="4" fill="var(--clay)" />
    </svg>
  );
}
