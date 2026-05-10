/**
 * Top meta row for the active walk shell. Always present, always quiet.
 * Format chip · weather chip · safety button.
 */
import { Shield, AlertTriangle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { WeatherPill } from "@/components/weather-pill";
import { useCurrentWeather } from "@/hooks/use-weather";

export type WalkFormat = "solo" | "audio" | "guided" | "local" | "friend";

const FORMAT_LABEL: Record<WalkFormat, string> = {
  solo: "Solo",
  audio: "Walk & Talk",
  guided: "Guided",
  local: "Local",
  friend: "With friends",
};

interface Props {
  format: WalkFormat;
  walkSessionId: string;
  coords: { lat: number; lng: number } | null;
}

export function WalkMetaRow({ format, walkSessionId, coords }: Props) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pt-3 md:px-0">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-forest" />
        {FORMAT_LABEL[format]}
      </span>
      <div className="flex items-center gap-2">
        <WalkWeatherChip coords={coords} />
        <SafetyButton walkSessionId={walkSessionId} />
      </div>
    </div>
  );
}

function WalkWeatherChip({ coords }: { coords: { lat: number; lng: number } | null }) {
  const { data } = useCurrentWeather(coords);
  if (!data) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs">
      <WeatherPill tempF={data.tempF} tone={data.tone} isDay={data.isDay} className="bg-transparent px-0 py-0" />
    </span>
  );
}

function SafetyButton({ walkSessionId }: { walkSessionId: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition active:scale-95">
          <Shield className="h-3.5 w-3.5" />
          Safety
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">You are not alone</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4 text-sm">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
            <div className="flex items-center gap-2 font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" />
              In immediate danger?
            </div>
            <p className="mt-1 text-foreground">Call your local emergency services right now.</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="font-medium">Mental health crisis support (US)</div>
            <p className="mt-1 text-muted-foreground">
              Call or text <a href="tel:988" className="font-medium text-forest underline">988</a> — Suicide & Crisis Lifeline.
            </p>
          </div>
          <div className="rounded-2xl bg-secondary p-4 text-xs text-muted-foreground">
            Community guidelines: come as you are, walk at your pace, respect privacy, no advice unless asked. Walk session: {walkSessionId.slice(0, 8)}.
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
