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

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  hellip: "…", mdash: "—", ndash: "–", lsquo: "‘", rsquo: "’",
  ldquo: "“", rdquo: "”", bull: "•", middot: "·", trade: "™",
  copy: "©", reg: "®", deg: "°", laquo: "«", raquo: "»",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      try { return String.fromCodePoint(parseInt(h, 16)); } catch { return _; }
    })
    .replace(/&#(\d+);/g, (_, d) => {
      try { return String.fromCodePoint(parseInt(d, 10)); } catch { return _; }
    })
    .replace(/&([a-zA-Z]+);/g, (m, n) => NAMED_ENTITIES[n] ?? m);
}

function cleanText(s: string | null): string | null {
  if (!s) return null;
  const noTags = s.replace(/<[^>]*>/g, " ");
  return decodeEntities(noTags).replace(/\s+/g, " ").trim() || null;
}

function stripHtml(s: string | null): string | null {
  return cleanText(s);
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
    const title = cleanText(pickText(item.title)) ?? "Untitled";
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
  const list = feeds ?? [];
  // Concurrency cap: 5 feeds in flight. Serial loops hold worker open for
  // N * (fetch + parse + upsert) and risk timeout; full Promise.all can
  // spike DB writes. allSettled + cap balances throughput and back-pressure.
  const CONCURRENCY = 5;
  let ok = 0, failed = 0;
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const batch = list.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map((f) => syncBlogFeedById(f.id)));
    for (const r of results) r.status === "fulfilled" ? ok++ : failed++;
  }
  return { scanned: list.length, ok, failed };
}

/**
 * Reader-view parser: fetch a URL, run Mozilla Readability on it,
 * return clean HTML + metadata. Worker-safe via linkedom.
 */
export interface ParsedReader {
  title: string | null;
  byline: string | null;
  excerpt: string | null;
  content_html: string | null;
  hero_image: string | null;
}

export async function parseReadable(url: string): Promise<ParsedReader> {
  const { parseHTML } = await import("linkedom");
  const { Readability } = await import("@mozilla/readability");

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; MentalHealthWalkClub/1.0; +reader-view)",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  const html = await res.text();

  const { document } = parseHTML(html);
  // Hoist a hero image guess before Readability strips it
  let hero: string | null = null;
  const og = document.querySelector('meta[property="og:image"]')?.getAttribute("content");
  const tw = document.querySelector('meta[name="twitter:image"]')?.getAttribute("content");
  hero = og || tw || null;

  // Readability expects a DOM-like document
  const article = new Readability(document as unknown as Document).parse();
  if (!article) {
    return { title: null, byline: null, excerpt: null, content_html: null, hero_image: hero };
  }

  // If no hero from meta, grab first <img> inside the parsed article
  if (!hero && article.content) {
    const m = article.content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m?.[1]) hero = m[1];
  }

  // Light sanitization: drop scripts/iframes/forms — Readability already
  // strips most of this, but belt-and-braces.
  const safeHtml = (article.content ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");

  return {
    title: article.title ?? null,
    byline: article.byline ?? null,
    excerpt: article.excerpt ?? null,
    content_html: safeHtml || null,
    hero_image: hero,
  };
}
