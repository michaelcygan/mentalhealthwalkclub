/**
 * Server-only RSS fetching + parsing for curated podcasts.
 * Worker-safe: pure JS via fast-xml-parser.
 */
import { XMLParser } from "fast-xml-parser";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface ParsedEpisode {
  guid: string;
  title: string;
  description: string | null;
  audio_url: string;
  episode_url: string | null;
  image_url: string | null;
  duration_seconds: number;
  published_at: string | null;
}

interface ParsedFeed {
  title: string | null;
  publisher: string | null;
  description: string | null;
  image_url: string | null;
  episodes: ParsedEpisode[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function parseDuration(d: unknown): number {
  if (d == null) return 0;
  const s = String(typeof d === "object" ? (d as { "#text"?: string })["#text"] ?? "" : d).trim();
  if (!s) return 0;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const parts = s.split(":").map((p) => parseInt(p, 10) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function pickText(node: unknown): string | null {
  if (node == null) return null;
  if (typeof node === "string") return node;
  if (typeof node === "object" && "#text" in (node as object)) {
    return String((node as { "#text": unknown })["#text"] ?? "") || null;
  }
  return null;
}

export async function parseRssFeed(rssUrl: string): Promise<ParsedFeed> {
  const res = await fetch(rssUrl, {
    headers: { "User-Agent": "MentalHealthWalkClub/1.0 (+podcast curation)" },
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  const xml = await res.text();
  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel ?? doc?.channel;
  if (!channel) throw new Error("Invalid RSS: no channel");

  const feedTitle = pickText(channel.title);
  const feedAuthor = pickText(channel["itunes:author"]) ?? pickText(channel["dc:creator"]);
  const feedDesc = pickText(channel.description) ?? pickText(channel["itunes:summary"]);
  const feedImage =
    channel["itunes:image"]?.["@_href"] ??
    pickText(channel.image?.url) ??
    null;

  const items = asArray(channel.item);
  const episodes: ParsedEpisode[] = [];
  for (const item of items) {
    const enclosure = item.enclosure;
    const audioUrl = enclosure?.["@_url"] ?? null;
    if (!audioUrl) continue;
    const guidNode = item.guid;
    const guid =
      (typeof guidNode === "object" ? pickText(guidNode) : guidNode) ??
      audioUrl;
    const title = pickText(item.title) ?? "Untitled";
    const desc = pickText(item.description) ?? pickText(item["itunes:summary"]);
    const link = pickText(item.link);
    const itemImage = item["itunes:image"]?.["@_href"] ?? null;
    const duration = parseDuration(item["itunes:duration"]);
    const pubDate = pickText(item.pubDate);
    const publishedIso = pubDate ? new Date(pubDate).toISOString() : null;

    episodes.push({
      guid: String(guid).slice(0, 500),
      title: String(title).slice(0, 500),
      description: desc ? String(desc).slice(0, 4000) : null,
      audio_url: String(audioUrl),
      episode_url: link ? String(link) : null,
      image_url: itemImage ?? feedImage,
      duration_seconds: duration,
      published_at: publishedIso,
    });
  }

  return {
    title: feedTitle,
    publisher: feedAuthor,
    description: feedDesc,
    image_url: feedImage,
    episodes,
  };
}

/** Sync a single feed into podcast_episodes. Returns counts. */
export async function syncFeedById(feedId: string) {
  const { data: feed, error: fErr } = await supabaseAdmin
    .from("podcast_feeds")
    .select("id, rss_url")
    .eq("id", feedId)
    .single();
  if (fErr || !feed) throw new Error(fErr?.message ?? "Feed not found");

  try {
    const parsed = await parseRssFeed(feed.rss_url);
    const limited = parsed.episodes.slice(0, 50);

    // Backfill feed metadata if empty
    await supabaseAdmin
      .from("podcast_feeds")
      .update({
        title: parsed.title ?? undefined,
        publisher: parsed.publisher ?? undefined,
        description: parsed.description ?? undefined,
        image_url: parsed.image_url ?? undefined,
        last_synced_at: new Date().toISOString(),
        last_sync_error: null,
      })
      .eq("id", feed.id);

    if (limited.length) {
      const rows = limited.map((e) => ({ feed_id: feed.id, ...e }));
      const { error: upErr } = await supabaseAdmin
        .from("podcast_episodes")
        .upsert(rows, { onConflict: "feed_id,guid", ignoreDuplicates: false });
      if (upErr) throw upErr;
    }

    return { ok: true, count: limited.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin
      .from("podcast_feeds")
      .update({ last_sync_error: msg.slice(0, 500), last_synced_at: new Date().toISOString() })
      .eq("id", feed.id);
    throw e;
  }
}

export async function syncAllActiveFeeds() {
  const { data: feeds } = await supabaseAdmin
    .from("podcast_feeds")
    .select("id")
    .eq("is_active", true);
  let ok = 0, failed = 0;
  for (const f of feeds ?? []) {
    try { await syncFeedById(f.id); ok++; } catch { failed++; }
  }
  return { scanned: feeds?.length ?? 0, ok, failed };
}
