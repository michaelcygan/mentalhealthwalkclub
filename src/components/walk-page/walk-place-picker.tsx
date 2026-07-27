import { useEffect, useRef, useState } from "react";
import { Search, MapPin, Loader2, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  searchWalkPlaces,
  getOrCreateWalkPlace,
  type PlaceSuggestion,
} from "@/lib/walk-places.functions";

/**
 * Selection shape emitted by WalkPlacePicker.
 *
 * - `id` present: a cached row in `public.places` — pass this straight through
 *   to server functions that accept `place_id`.
 * - `id` null: the user typed a meeting point manually (no matching Photon
 *   result, or admin bypassed search). Callers pass the venue/address/lat/lng
 *   fields to the server instead.
 */
export type WalkPlaceSelection = {
  id: string | null;
  name: string;
  address: string | null;
  hero_url: string | null;
  lat: number | null;
  lng: number | null;
};

type Props = {
  value: WalkPlaceSelection | null;
  onChange: (v: WalkPlaceSelection | null) => void;
  /** Location bias for Photon search. */
  near?: { lat: number; lng: number } | null;
  /** Placeholder text for the search input. */
  placeholder?: string;
  /** Show "Enter manually" toggle (admin use). */
  allowManual?: boolean;
  /** Helper text shown under the search input. */
  hint?: string;
};

export function WalkPlacePicker({
  value,
  onChange,
  near,
  placeholder = "Search a park, trail, neighborhood…",
  allowManual = false,
  hint,
}: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  const [manualName, setManualName] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);

  // Debounced Photon search
  useEffect(() => {
    if (value?.id) return; // don't search while a cached place is picked
    if (manualMode) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setSearchError(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const seq = ++searchSeq.current;
      setSearching(true);
      setSearchError(false);
      try {
        const res = await searchWalkPlaces({
          data: { query: q, near: near ?? undefined },
        });
        if (seq !== searchSeq.current) return;
        setSuggestions(res.results);
        setShowSuggestions(true);
      } catch (e) {
        if (seq !== searchSeq.current) return;
        console.error(e);
        setSearchError(true);
        setSuggestions([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, value?.id, near, manualMode]);

  async function pickSuggestion(s: PlaceSuggestion) {
    setShowSuggestions(false);
    searchSeq.current++;
    setResolving(true);
    try {
      const { place } = await getOrCreateWalkPlace({ data: { suggestion: s } });
      onChange({
        id: place.id,
        name: place.name,
        address: place.address,
        hero_url: place.hero_url ?? null,
        lat: place.lat != null ? Number(place.lat) : null,
        lng: place.lng != null ? Number(place.lng) : null,
      });
      setQuery(place.name);
    } catch (e) {
      console.error(e);
      setSearchError(true);
    } finally {
      setResolving(false);
    }
  }

  function clear() {
    onChange(null);
    setQuery("");
    setSuggestions([]);
    setSearchError(false);
  }

  function saveManual() {
    if (!manualName.trim() && !manualAddress.trim()) return;
    onChange({
      id: null,
      name: manualName.trim() || manualAddress.trim().slice(0, 80),
      address: manualAddress.trim() || null,
      hero_url: null,
      lat: manualLat ? Number(manualLat) || null : null,
      lng: manualLng ? Number(manualLng) || null : null,
    });
    setManualMode(false);
  }

  if (value) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {value.hero_url ? (
          <img src={value.hero_url} alt="" className="h-32 w-full object-cover" loading="lazy" />
        ) : null}
        <div className="flex items-start gap-3 p-4">
          <MapPin className="mt-0.5 h-4 w-4 text-forest" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{value.name}</div>
            {value.address ? (
              <div className="truncate text-xs text-muted-foreground">{value.address}</div>
            ) : null}
            {!value.id && (
              <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Manual entry
              </div>
            )}
          </div>
          <button
            onClick={clear}
            className="rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-accent/40"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  if (manualMode) {
    return (
      <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
        <Input
          value={manualName}
          onChange={(e) => setManualName(e.target.value)}
          placeholder="Venue / meeting point name"
          maxLength={200}
        />
        <Input
          value={manualAddress}
          onChange={(e) => setManualAddress(e.target.value)}
          placeholder="Address (optional)"
          maxLength={500}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={manualLat}
            onChange={(e) => setManualLat(e.target.value)}
            placeholder="Latitude (optional)"
            inputMode="decimal"
          />
          <Input
            value={manualLng}
            onChange={(e) => setManualLng(e.target.value)}
            placeholder="Longitude (optional)"
            inputMode="decimal"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setManualMode(false)}
            className="rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/40"
          >
            Back to search
          </button>
          <button
            type="button"
            onClick={saveManual}
            disabled={!manualName.trim() && !manualAddress.trim()}
            className="rounded-full bg-forest px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length && setShowSuggestions(true)}
          placeholder={placeholder}
          inputMode="search"
          autoComplete="off"
          className="pl-9"
        />
        {(searching || resolving) && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          {suggestions.map((s) => (
            <button
              key={s.provider_place_id}
              type="button"
              onClick={() => pickSuggestion(s)}
              className="block w-full px-4 py-3 text-left hover:bg-accent/40"
            >
              <div className="text-sm font-medium">{s.name}</div>
              {s.address ? (
                <div className="truncate text-xs text-muted-foreground">{s.address}</div>
              ) : null}
            </button>
          ))}
          <div className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
            Place data ©{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              OpenStreetMap contributors
            </a>
          </div>
        </div>
      )}
      {showSuggestions && !searching && suggestions.length === 0 && query.trim().length >= 3 && (
        <div className="absolute z-20 mt-1 w-full rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground shadow-soft">
          {searchError
            ? "Couldn't search right now — try again in a moment."
            : "No places found — try a different name."}
        </div>
      )}
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{hint ?? "Or leave blank and add a meeting point later."}</span>
        {allowManual && (
          <button
            type="button"
            onClick={() => setManualMode(true)}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-accent/40 hover:text-foreground"
          >
            <Pencil className="h-3 w-3" /> Enter manually
          </button>
        )}
      </div>
    </div>
  );
}
