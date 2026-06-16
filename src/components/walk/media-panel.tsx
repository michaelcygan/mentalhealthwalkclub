/**
 * In-walk media panel. Lets the walker freely switch between silence,
 * ambient music, podcasts, and saved playlists during a solo walk — no
 * commitment up front, no "walk type" framing.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Music2, Mic2, ListMusic, VolumeX, Play, Pause, SkipForward, Volume2, Loader2, Rewind, FastForward } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAmbient } from "@/lib/ambient-context";
import { usePlayer, type PlayableTrack } from "@/lib/player-context";
import { getPlaylist } from "@/lib/playlists.functions";
import { Button } from "@/components/ui/button";

type Tab = "silence" | "ambient" | "podcast" | "playlist";

type Props = {
  playlists: { id: string; name: string }[];
  podcasts: { id: string; title: string }[];
  initialTab?: Tab;
};

export function MediaPanel({ playlists, podcasts, initialTab = "silence" }: Props) {
  const ambient = useAmbient();
  const player = usePlayer();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loadingPlaylist, setLoadingPlaylist] = useState<string | null>(null);
  const [loadingPodcast, setLoadingPodcast] = useState<string | null>(null);
  const [ambientStarting, setAmbientStarting] = useState(false);

  // If ambient was requested but never started (library still loading), nudge the user.
  useEffect(() => {
    if (!ambientStarting) return;
    if (ambient.current) { setAmbientStarting(false); return; }
    const t = window.setTimeout(() => {
      if (!ambient.current) {
        setAmbientStarting(false);
        if (!ambient.hasLibrary) toast("Ambient mix isn't ready yet — try again in a moment.");
      }
    }, 3500);
    return () => window.clearTimeout(t);
  }, [ambientStarting, ambient.current, ambient.hasLibrary]);

  async function pickSilence() {
    setTab("silence");
    if (ambient.current) ambient.stop(300);
    if (player.current) player.stop();
  }

  async function pickAmbient() {
    setTab("ambient");
    if (player.current) player.stop();
    if (!ambient.current) {
      setAmbientStarting(true);
      await ambient.start();
    }
  }

  async function playPodcast(id: string) {
    setLoadingPodcast(id);
    try {
      const { data } = await supabase
        .from("podcast_episodes")
        .select("id,title,audio_url,image_url,duration_seconds,episode_url")
        .eq("id", id)
        .maybeSingle();
      if (!data?.audio_url) { toast.error("No audio for this episode."); return; }
      player.play({ id: data.id, kind: "podcast", title: data.title, cover: data.image_url, audio_url: data.audio_url, duration_seconds: data.duration_seconds, link: data.episode_url });
    } finally {
      setLoadingPodcast(null);
    }
  }

  async function playPlaylistById(id: string) {
    setLoadingPlaylist(id);
    try {
      const r = await getPlaylist({ data: { id } });
      const tracks: PlayableTrack[] = [];
      for (const it of r.items) {
        if (it.kind === "podcast_episode") {
          const { data } = await supabase.from("podcast_episodes").select("id,title,audio_url,image_url,duration_seconds,episode_url").eq("id", it.track_id).maybeSingle();
          if (data?.audio_url) tracks.push({ id: data.id, kind: "podcast", title: data.title, cover: data.image_url, audio_url: data.audio_url, duration_seconds: data.duration_seconds, link: data.episode_url });
        } else if (it.kind === "guided_track") {
          const { data } = await supabase.from("guided_tracks").select("id,title,host,audio_url,cover_url,duration_seconds").eq("id", it.track_id).maybeSingle();
          if (data?.audio_url) tracks.push({ id: data.id, kind: "guided", title: data.title, subtitle: data.host, cover: data.cover_url, audio_url: data.audio_url, duration_seconds: data.duration_seconds });
        }
      }
      if (tracks[0]) {
        player.play(tracks[0]);
        tracks.slice(1).forEach(player.enqueue);
      } else {
        toast("Playlist is empty.");
      }
    } finally {
      setLoadingPlaylist(null);
    }
  }

  const TabButton = ({ id, icon, label }: { id: Tab; icon: React.ReactNode; label: string }) => (
    <button
      type="button"
      onClick={() => {
        if (id === "silence") pickSilence();
        else if (id === "ambient") pickAmbient();
        else setTab(id);
      }}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition ${
        tab === id ? "bg-forest text-cream" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="mb-4 rounded-3xl border border-border/70 bg-card/75 p-3 shadow-soft backdrop-blur-xl">
      <div className="mb-3 flex gap-1 rounded-full border border-border/70 bg-background/60 p-1">
        <TabButton id="silence" icon={<VolumeX className="h-3.5 w-3.5" />} label="Silence" />
        <TabButton id="ambient" icon={<Music2 className="h-3.5 w-3.5" />} label="Ambient" />
        <TabButton id="podcast" icon={<Mic2 className="h-3.5 w-3.5" />} label="Podcast" />
        <TabButton id="playlist" icon={<ListMusic className="h-3.5 w-3.5" />} label="Playlist" />
      </div>

      {tab === "silence" && (
        <p className="px-2 py-3 text-center text-xs text-muted-foreground">
          Just the timer and your thoughts. Tap any tab above to bring in sound.
        </p>
      )}

      {tab === "ambient" && (
        <div className="space-y-2 px-1">
          {ambient.current ? (
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-forest"><Music2 className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{ambient.current.title}</p>
                <p className="text-[11px] text-muted-foreground">{ambient.current.artist ?? "Ambient mix"}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={ambient.toggleMute} className="h-9 w-9 rounded-full p-0" aria-label={ambient.muted ? "Unmute" : "Mute"}>
                {ambient.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={ambient.skip} className="h-9 w-9 rounded-full p-0" aria-label="Next track">
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
              {ambientStarting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Starting ambient mix…</> : <>Tap Ambient again to start the mix.</>}
            </div>
          )}
          {ambient.current && (
            <div className="flex items-center gap-2 px-1">
              <VolumeX className="h-3 w-3 text-muted-foreground" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={ambient.volume}
                onChange={(e) => ambient.setVolume(Number(e.target.value))}
                className="flex-1 accent-forest"
                aria-label="Ambient volume"
              />
              <Volume2 className="h-3 w-3 text-muted-foreground" />
            </div>
          )}
        </div>
      )}

      {tab === "podcast" && (
        <div className="space-y-2 px-1">
          {player.current?.kind === "podcast" && <InlineTransport />}
          <ul className="max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-border/60 bg-background/40 p-1">
            {podcasts.length === 0 && (
              <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                No episodes yet. <Link to="/listen" className="font-medium text-forest underline">Browse Listen</Link>
              </li>
            )}
            {podcasts.map((p) => {
              const active = player.current?.kind === "podcast" && player.current.id === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => playPodcast(p.id)}
                    disabled={loadingPodcast === p.id}
                    className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs transition hover:bg-accent/40 ${active ? "bg-accent/40 font-medium" : ""}`}
                  >
                    {loadingPodcast === p.id
                      ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      : active ? <Pause className="h-3.5 w-3.5 shrink-0 text-forest" /> : <Play className="h-3.5 w-3.5 shrink-0 text-forest" />}
                    <span className="truncate">{p.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tab === "playlist" && (
        <div className="space-y-2 px-1">
          {(player.current?.kind === "playlist" || player.current?.kind === "guided" || (player.current?.kind === "podcast" && player.queue.length > 0)) && <InlineTransport />}
          <ul className="max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-border/60 bg-background/40 p-1">
            {playlists.length === 0 && (
              <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                No playlists yet. Build one in <Link to="/listen" className="font-medium text-forest underline">Listen</Link>.
              </li>
            )}
            {playlists.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => playPlaylistById(p.id)}
                  disabled={loadingPlaylist === p.id}
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs transition hover:bg-accent/40"
                >
                  {loadingPlaylist === p.id
                    ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    : <ListMusic className="h-3.5 w-3.5 shrink-0 text-forest" />}
                  <span className="truncate">{p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InlineTransport() {
  const player = usePlayer();
  if (!player.current) return null;
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/40 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{player.current.title}</p>
        {player.current.subtitle && <p className="truncate text-[10px] text-muted-foreground">{player.current.subtitle}</p>}
      </div>
      <Button variant="ghost" size="sm" onClick={() => player.skipBy(-15)} className="h-8 w-8 rounded-full p-0" aria-label="Back 15 seconds">
        <Rewind className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="sm" onClick={player.toggle} className="h-9 w-9 rounded-full p-0" aria-label={player.playing ? "Pause" : "Play"}>
        {player.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : player.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => player.skipBy(15)} className="h-8 w-8 rounded-full p-0" aria-label="Forward 15 seconds">
        <FastForward className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
