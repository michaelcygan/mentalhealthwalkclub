import { getStation, resolveRadioItem, type StationCard, type RadioItem } from "@/lib/radio.functions";
import { supabase } from "@/integrations/supabase/client";
import type { PlayableKind, PlayableTrack } from "@/lib/player-context";

const LAST_STATION_KEY = "mhwc_last_station";

export function rememberLastStation(slug: string) {
  try { window.localStorage.setItem(LAST_STATION_KEY, slug); } catch { /* noop */ }
}
export function getLastStation(): string | null {
  try { return window.localStorage.getItem(LAST_STATION_KEY); } catch { return null; }
}

export async function recordRadioUsage(seconds: number): Promise<number | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || seconds <= 0) return null;
  const { data } = await supabase.rpc("increment_radio_usage", {
    _user: user.id,
    _seconds: Math.round(seconds),
  });
  return (data as number | null) ?? null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Expand items with repeat_count into the play cycle. */
function expandCycle(items: RadioItem[]): RadioItem[] {
  const out: RadioItem[] = [];
  for (const it of items) {
    const n = Math.max(1, it.repeat_count ?? 1);
    for (let i = 0; i < n; i++) out.push(it);
  }
  return out;
}

const KIND_FROM_SOURCE: Record<string, PlayableKind> = {
  upload: "guided",
  external_url: "guided",
  podcast_episode: "podcast",
};

async function resolveToPlayable(item: RadioItem, station: StationCard): Promise<PlayableTrack | null> {
  const resolved = await resolveRadioItem({ data: { itemId: item.id } });
  if (!resolved) return null;
  return {
    id: `radio:${resolved.id}:${Math.random().toString(36).slice(2, 8)}`,
    kind: KIND_FROM_SOURCE[resolved.sourceType] ?? "guided",
    title: resolved.title,
    subtitle: resolved.artist ?? station.title,
    cover: resolved.imageUrl ?? station.cover_signed ?? null,
    audio_url: resolved.audioUrl,
    link: resolved.sourcePageUrl,
    duration_seconds: resolved.durationSeconds ?? null,
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
  if (!res || !res.items.length) return false;
  const active = res.items.filter((i) => i.is_active);
  if (!active.length) return false;

  let cycle = expandCycle(active);
  if (res.station.playback_mode === "shuffle") cycle = shuffle(cycle);
  // Simple loop: duplicate cycle to give a session-length queue without a refill loop.
  if (res.station.loop_enabled) {
    cycle = [...cycle, ...cycle, ...cycle];
  }

  const first = await resolveToPlayable(cycle[0], res.station);
  if (!first) return false;
  player.clearQueue();
  player.play(first);

  // Resolve remaining items concurrently and enqueue in order, skipping unresolvable items.
  const rest = await Promise.all(cycle.slice(1).map((it) => resolveToPlayable(it, res.station)));
  for (const t of rest) if (t) player.enqueue(t);

  rememberLastStation(slug);
  return true;
}
