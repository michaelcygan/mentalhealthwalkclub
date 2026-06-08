/**
 * Server-only RSS fetcher/parser for mental-health blog feeds.
 * Worker-safe: pure JS via fast-xml-parser. Mirrors podcasts.server.ts.
 */
import { XMLParser } from "fast-xml-parser";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface ParsedPost {
  guid: string;
  title: string;
  summary: string | null;
  link: string;
  image_url: string | null;
  published_at: string | null;
}

interface ParsedFeed {
  title: string | null;
  publisher: string | null;
  image_url: string | null;
  posts: ParsedPost[];
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

function pickText(node: unknown): string | null {
  if (node == null) return null;
  if (typeof node === "string") return node;
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    if ("#text" in o) return String(o["#text"] ?? "") || null;
    if ("@_href" in o) return String(o["@_href"] ?? "") || null;
  }
  return null;
}

function stripHtml(s: string | null): string | null {
  if (!s) return null;
  const noTags = s.replace(/<[^>]*>/g, " ");
  const decoded = noTags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, "…");
  return decoded.replace(/\s+/g, " ").trim() || null;
}

function firstImg(item: Record<string, unknown>): string | null {
  // media:content / media:thumbnail
  const mc = item["media:content"];
  if (mc) {
    const arr = asArray(mc) as Array<Record<string, unknown>>;
    for (const x of arr) {
      const url = x?.["@_url"];
      if (typeof url === "string") return url;
    }
  }
  const mt = item["media:thumbnail"];
  if (mt) {
    const arr = asArray(mt) as Array<Record<string, unknown>>;
    for (const x of arr) {
      const url = x?.["@_url"];
      if (typeof url === "string") return url;
    }
  }
  // enclosure type image/*
  const enc = item.enclosure as Record<string, unknown> | undefined;
  if (enc) {
    const type = String(enc["@_type"] ?? "");
    const url = enc["@_url"];
    if (typeof url === "string" && type.startsWith("image/")) return url;
  }
  // First <img> in description / content:encoded
  for (const k of ["content:encoded", "description"]) {
    const v = item[k];
    const text = typeof v === "string" ? v : pickText(v);
    if (text) {
      const m = text.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m?.[1]) return m[1];
    }
  }
  return null;
}

export async function parseBlogFeed(rssUrl: string): Promise<ParsedFeed> {
  const res = await fetch(rssUrl, {
    headers: { "User-Agent": "MentalHealthWalkClub/1.0 (+blog curation)" },
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  const xml = await res.text();
  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel ?? doc?.channel ?? doc?.feed;
  if (!channel) throw new Error("Invalid RSS/Atom: no channel/feed");

  const isAtom = Boolean(doc?.feed);
  const feedTitle = pickText(channel.title);
  const feedAuthor =
    pickText(channel["dc:creator"]) ??
    pickText(channel["itunes:author"]) ??
    pickText(channel.author) ??
    null;
  const feedImage =
    pickText(channel.image?.url) ??
    (channel["itunes:image"] as Record<string, unknown> | undefined)?.["@_href"]?.toString() ??
    null;

  const items = asArray(isAtom ? channel.entry : channel.item) as Array<Record<string, unknown>>;
  const posts: ParsedPost[] = [];
  for (const item of items) {
    // link can be string, object, or array of objects (atom)
    let link: string | null = null;
    const lk = item.link;
    if (typeof lk === "string") link = lk;
    else if (Array.isArray(lk)) {
      for (const x of lk) {
        const url = (x as Record<string, unknown>)?.["@_href"];
        if (typeof url === "string") { link = url; break; }
      }
    } else if (lk && typeof lk === "object") {
      const o = lk as Record<string, unknown>;
      if (typeof o["@_href"] === "string") link = o["@_href"] as string;
      else if (typeof o["#text"] === "string") link = o["#text"] as string;
    }
    if (!link) continue;

    const guidNode = item.guid ?? item.id;
    const guid = (typeof guidNode === "object" ? pickText(guidNode) : (guidNode as string | undefined)) ?? link;
    const title = pickText(item.title) ?? "Untitled";
    const summary = stripHtml(
      pickText(item.description) ??
        pickText(item.summary) ??
        pickText(item["content:encoded"]) ??
        null
    );
    const pub = pickText(item.pubDate) ?? pickText(item.published) ?? pickText(item.updated);
    const publishedIso = pub ? new Date(pub).toISOString() : null;
    const image = firstImg(item) ?? feedImage;

    posts.push({
      guid: String(guid).slice(0, 500),
      title: String(title).slice(0, 500),
      summary: summary ? summary.slice(0, 600) : null,
      link: String(link),
      image_url: image,
      published_at: publishedIso,
    });
  }

  return { title: feedTitle, publisher: feedAuthor, image_url: feedImage, posts };
}

export async function syncBlogFeedById(feedId: string) {
  const { data: feed, error: fErr } = await supabaseAdmin
    .from("blog_feeds")
    .select("id, rss_url")
    .eq("id", feedId)
    .single();
  if (fErr || !feed) throw new Error(fErr?.message ?? "Feed not found");

  try {
    const parsed = await parseBlogFeed(feed.rss_url);
    const limited = parsed.posts.slice(0, 50);

    await supabaseAdmin
      .from("blog_feeds")
      .update({
        title: parsed.title ?? undefined,
        publisher: parsed.publisher ?? undefined,
        image_url: parsed.image_url ?? undefined,
        last_synced_at: new Date().toISOString(),
        last_sync_error: null,
      })
      .eq("id", feed.id);

    if (limited.length) {
      const rows = limited.map((p) => ({ feed_id: feed.id, ...p }));
      const { error: upErr } = await supabaseAdmin
        .from("blog_posts")
        .upsert(rows, { onConflict: "feed_id,guid", ignoreDuplicates: false });
      if (upErr) throw upErr;
    }
    return { ok: true, count: limited.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin
      .from("blog_feeds")
      .update({ last_sync_error: msg.slice(0, 500), last_synced_at: new Date().toISOString() })
      .eq("id", feed.id);
    throw e;
  }
}

export async function syncAllActiveBlogFeeds() {
  const { data: feeds } = await supabaseAdmin
    .from("blog_feeds")
    .select("id")
    .eq("is_active", true);
  let ok = 0, failed = 0;
  for (const f of feeds ?? []) {
    try { await syncBlogFeedById(f.id); ok++; } catch { failed++; }
  }
  return { scanned: feeds?.length ?? 0, ok, failed };
}
