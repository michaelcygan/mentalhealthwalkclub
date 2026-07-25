import { getStation, signTrackUrl, type StationCard, type StationTrack } from "@/lib/radio.functions";
import type { PlayableTrack } from "@/lib/player-context";

const LAST_STATION_KEY = "mhwc_last_station";

export function rememberLastStation(slug: string) {
  try { window.localStorage.setItem(LAST_STATION_KEY, slug); } catch { /* noop */ }
}
export function getLastStation(): string | null {
  try { return window.localStorage.getItem(LAST_STATION_KEY); } catch { return null; }
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function trackToPlayable(t: StationTrack, station: StationCard): Promise<PlayableTrack> {
  const { url } = await signTrackUrl({ data: { trackId: t.id } });
  return {
    id: `radio:${t.id}`,
    kind: "guided", // reuses existing player kind rendering; treated as generic audio
    title: t.title,
    subtitle: t.artist ?? station.title,
    cover: station.cover_signed ?? null,
    audio_url: url,
    duration_seconds: t.duration_s ?? null,
  };
}

export async function startStation(
  slug: string,
  player: {
    play: (t: PlayableTrack) => void;
    enqueue: (t: PlayableTrack) => void;
    clearQueue: () => void;
  },
) {
  const res = await getStation({ data: { slug } });
  if (!res || !res.tracks.length) return false;
  const order = shuffle(res.tracks);
  const first = await trackToPlayable(order[0], res.station);
  player.clearQueue();
  player.play(first);
  // Sign & enqueue the rest — 2h TTL covers a listening session comfortably.
  const rest = await Promise.all(order.slice(1).map((t) => trackToPlayable(t, res.station)));
  rest.forEach(player.enqueue);
  rememberLastStation(slug);
  return true;
}
