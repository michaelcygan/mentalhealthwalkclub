/**
 * ActiveWalkShell — the single, consistent layout every walk format renders
 * inside. Owns the chrome (meta row, hero, stat trio, map, action bar) so
 * format modules only worry about their own slot.
 */
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Eye, EyeOff, MapIcon } from "lucide-react";
import { WalkMetaRow, type WalkFormat } from "./walk-meta-row";
import { WalkHeroTimer, type GpsState } from "./walk-hero-timer";
import { WalkStatTrio } from "./walk-stat-trio";
import { WalkActionBar } from "./walk-action-bar";
import { RainSoonBanner } from "@/components/rain-soon-banner";
import type { RoutePoint } from "@/lib/walk-route-utils";

const WalkLiveMap = lazy(() => import("@/components/walk-live-map"));

interface Props {
  // identity
  format: WalkFormat;
  walkSessionId: string;
  userId: string | null;
  groupId: string | null;
  // hero
  elapsed: number;
  paused: boolean;
  gps: GpsState;
  // stats
  miles: number;
  steps: number;
  paceMinPerMi: number;
  cadence: number;
  /** Optional small hint shown under the STEPS stat (e.g. motion fallback). */
  stepsHint?: ReactNode;
  // location
  walkerCoords: { lat: number; lng: number } | null;
  routePoints: RoutePoint[];
  // map sharing
  canShareMap: boolean;
  shareMap: boolean;
  onToggleShareMap: () => void;
  // controls
  onTogglePause: () => void;
  onEnd: () => void;
  // setup nudges
  setupNudges?: ReactNode;
  // format slot
  formatModule: ReactNode;
  // utility row (notes, ambient)
  utilityRow?: ReactNode;
}

export function ActiveWalkShell({
  format,
  walkSessionId,
  userId,
  groupId,
  elapsed,
  paused,
  gps,
  miles,
  steps,
  paceMinPerMi,
  cadence,
  stepsHint,
  walkerCoords,
  routePoints,
  canShareMap,
  shareMap,
  onToggleShareMap,
  onTogglePause,
  onEnd,
  setupNudges,
  formatModule,
  utilityRow,
}: Props) {
  const [showMap, setShowMap] = useState(true);

  // Calm/dim mode — fade non-essential UI after 60s of no interaction.
  // Hero timer + action bar are always full opacity.
  const [dim, setDim] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const reset = () => {
      setDim(false);
      clearTimeout(t);
      t = setTimeout(() => setDim(true), 60_000);
    };
    reset();
    const evs: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"];
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(t);
      evs.forEach((e) => window.removeEventListener(e, reset));
    };
  }, []);

  return (
    <div className="-mx-4 md:mx-0">
      <WalkMetaRow format={format} walkSessionId={walkSessionId} coords={walkerCoords} />
      <WalkHeroTimer elapsed={elapsed} paused={paused} gps={gps} />
      <div className={`transition-opacity duration-700 ${dim ? "opacity-50" : "opacity-100"}`}>
        <WalkStatTrio miles={miles} steps={steps} paceMinPerMi={paceMinPerMi} cadence={cadence} />
      </div>

      {setupNudges && (
        <div className="mt-3 flex flex-wrap justify-center gap-2 px-4 md:px-0">{setupNudges}</div>
      )}

      <div
        className={`mt-4 space-y-4 px-4 md:px-0 transition-opacity duration-700 ${dim ? "opacity-60" : "opacity-100"}`}
      >
        <RainSoonBanner coords={walkerCoords} active={!paused} currentlyRaining={false} />

        {formatModule}

        <section className="rounded-2xl border border-border bg-card p-3 shadow-soft">
          <div className="flex items-center justify-between gap-2 pb-2">
            <button
              type="button"
              onClick={() => setShowMap((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
              aria-expanded={showMap}
            >
              <MapIcon className="h-3.5 w-3.5" /> {showMap ? "Hide map" : "Show map"}
            </button>
            {canShareMap && (
              <button
                type="button"
                onClick={onToggleShareMap}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition ${
                  shareMap
                    ? "bg-forest text-primary-foreground"
                    : "border border-border bg-background text-muted-foreground"
                }`}
              >
                {shareMap ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {shareMap ? "On group map" : "Private"}
              </button>
            )}
          </div>
          {showMap && (
            <Suspense fallback={<div className="h-56 animate-pulse rounded-2xl bg-secondary/60" />}>
              <WalkLiveMap
                points={routePoints}
                walkSessionId={walkSessionId}
                userId={userId}
                groupId={groupId}
                shareToGroup={shareMap}
              />
            </Suspense>
          )}
        </section>

        {utilityRow && (
          <div className="flex flex-wrap items-center justify-center gap-2">{utilityRow}</div>
        )}
      </div>

      <WalkActionBar paused={paused} onTogglePause={onTogglePause} onEnd={onEnd} />
    </div>
  );
}
