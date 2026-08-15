import { useEffect, useRef, useState } from "react";
import { MapPin, LocateFixed, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { publicAreaSearch, type PublicAreaSuggestion } from "@/lib/public-utility.functions";
import type { PublicArea } from "@/lib/public-area";

interface Props {
  area: PublicArea | null;
  onChange: (area: PublicArea | null) => void;
}

/**
 * Visitor-facing area chooser: type a city/neighborhood, or use the device
 * location. No account, no permission prompt until the visitor asks for it.
 */
export function AreaSelector({ area, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PublicAreaSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await publicAreaSearch({ data: { query } });
        setResults(res.results);
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  function useDevice() {
    setGeoError(null);
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoError("This browser can't share a location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        onChange({
          label: "Near me",
          city: null,
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          radiusMiles: 25,
          source: "device",
        });
        setOpen(false);
      },
      () => setGeoError("Location was blocked. Type a city instead."),
      { maximumAge: 5 * 60_000, timeout: 6_000 },
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[13px] shadow-soft"
        >
          <MapPin className="h-3.5 w-3.5 text-forest" />
          {area ? area.label : "Choose an area"}
        </button>
        {area && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex min-h-[38px] items-center gap-1 rounded-full px-2 text-[12px] text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {open && (
        <div className="rounded-2xl border border-border bg-card p-3 shadow-soft">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="City or neighborhood"
              className="h-9 rounded-full"
              aria-label="Search for a city or neighborhood"
            />
          </div>

          {busy && <p className="mt-2 text-[11px] text-muted-foreground">Searching…</p>}

          {results.length > 0 && (
            <ul className="mt-2 space-y-1">
              {results.map((r) => (
                <li key={`${r.label}-${r.lat}-${r.lng}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({
                        label: r.label,
                        city: r.city,
                        lat: r.lat,
                        lng: r.lng,
                        radiusMiles: 25,
                        source: "saved",
                      });
                      setOpen(false);
                      setQ("");
                      setResults([]);
                    }}
                    className="w-full rounded-xl px-2 py-2 text-left text-[13px] hover:bg-muted"
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={useDevice}
              className="h-9 rounded-full text-[12px]"
            >
              <LocateFixed className="mr-1 h-3.5 w-3.5" />
              Use my location
            </Button>
            <span className="text-[11px] text-muted-foreground">Within 25 mi</span>
          </div>
          {geoError && <p className="mt-1 text-[11px] text-muted-foreground">{geoError}</p>}
        </div>
      )}
    </div>
  );
}
