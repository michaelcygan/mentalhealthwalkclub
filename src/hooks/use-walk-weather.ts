import { useQuery } from "@tanstack/react-query";
import { getWalkWeather, type WalkWeatherResponse } from "@/lib/walk-weather.functions";
import { roundCoord } from "@/lib/walk-weather-match";

export type WalkLocation = { name: string; lat: number; lng: number } | null | undefined;

export function useWalkWeather(location: WalkLocation) {
  const lat = location ? roundCoord(location.lat) : null;
  const lng = location ? roundCoord(location.lng) : null;
  const enabled = lat != null && lng != null;

  return useQuery<WalkWeatherResponse>({
    queryKey: ["walk-weather", lat, lng],
    queryFn: () => getWalkWeather({ data: { lat: lat as number, lng: lng as number } }),
    enabled,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
