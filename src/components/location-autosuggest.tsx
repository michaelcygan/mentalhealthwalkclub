import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";

export interface LocationValue {
  city: string;
  region: string | null;
  country: string | null;
  location_label: string;
  lat: number | null;
  lng: number | null;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_value?: string;
    type?: string;
  };
}

function toValue(f: PhotonFeature): LocationValue {
  const p = f.properties;
  const city = p.city || p.name || "";
  const region = p.state || null;
  const country = p.countrycode?.toUpperCase() || p.country || null;
  const label = [city, region, country].filter(Boolean).join(", ");
  const [lng, lat] = f.geometry.coordinates;
  return { city, region, country, location_label: label, lat, lng };
}

interface Props {
  value: LocationValue | null;
  onChange: (v: LocationValue | null) => void;
  placeholder?: string;
  allowClear?: boolean;
}

export function LocationAutosuggest({ value, onChange, placeholder = "Type a city…", allowClear = true }: Props) {
  const [query, setQuery] = useState(value?.location_label ?? "");
  const [results, setResults] = useState<PhotonFeature[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value?.location_label ?? "");
  }, [value?.location_label]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = (q: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&layer=city`;
        const res = await fetch(url);
        const data = await res.json();
        setResults((data.features ?? []) as PhotonFeature[]);
        setOpen(true);
        setActive(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const select = (f: PhotonFeature) => {
    const v = toValue(f);
    onChange(v);
    setQuery(v.location_label);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9 pr-9"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            // invalidate selection when typing diverges from the picked label
            if (value && e.target.value !== value.location_label) onChange(null);
            search(e.target.value);
          }}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={(e) => {
            if (!open || !results.length) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); select(results[active]); }
            else if (e.key === "Escape") { setOpen(false); }
          }}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        {!loading && allowClear && value && (
          <button
            type="button"
            onClick={() => { onChange(null); setQuery(""); setResults([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-elevated">
          {results.map((f, i) => {
            const v = toValue(f);
            return (
              <li
                key={`${v.location_label}-${i}`}
                onMouseDown={(e) => { e.preventDefault(); select(f); }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-accent" : "bg-popover"}`}
              >
                <span className="font-medium">{v.city}</span>
                {(v.region || v.country) && (
                  <span className="ml-1 text-muted-foreground">
                    {[v.region, v.country].filter(Boolean).join(", ")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {open && !loading && results.length === 0 && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-elevated">
          No matches. Keep typing…
        </div>
      )}
    </div>
  );
}
