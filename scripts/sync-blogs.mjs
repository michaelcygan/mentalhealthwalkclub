import { XMLParser } from "fast-xml-parser";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });

const asArray = (v) => v == null ? [] : Array.isArray(v) ? v : [v];
const pickText = (n) => {
  if (n == null) return null;
  if (typeof n === "string") return n;
  if (typeof n === "object") {
    if ("#text" in n) return String(n["#text"] ?? "") || null;
    if ("@_href" in n) return String(n["@_href"] ?? "") || null;
  }
  return null;
};

const NAMED = { nbsp:" ", amp:"&", lt:"<", gt:">", quot:'"', apos:"'", hellip:"…", mdash:"—", ndash:"–", lsquo:"‘", rsquo:"’", ldquo:"“", rdquo:"”", bull:"•", middot:"·", trade:"™", copy:"©", reg:"®", deg:"°", laquo:"«", raquo:"»" };
const decodeEnt = (s) => s
  .replace(/&#x([0-9a-fA-F]+);/g, (_,h)=>{ try{return String.fromCodePoint(parseInt(h,16));}catch{return _;} })
  .replace(/&#(\d+);/g, (_,d)=>{ try{return String.fromCodePoint(parseInt(d,10));}catch{return _;} })
  .replace(/&([a-zA-Z]+);/g, (m,n)=> NAMED[n] ?? m);
const cleanText = (s) => !s ? null : decodeEnt(s.replace(/<[^>]*>/g," ")).replace(/\s+/g," ").trim() || null;

function firstImg(item) {
  for (const k of ["media:content","media:thumbnail"]) {
    for (const x of asArray(item[k])) { const u = x?.["@_url"]; if (typeof u === "string") return u; }
  }
  const enc = item.enclosure;
  if (enc && String(enc["@_type"]||"").startsWith("image/") && typeof enc["@_url"]==="string") return enc["@_url"];
  for (const k of ["content:encoded","description"]) {
    const v = item[k]; const t = typeof v==="string"?v:pickText(v);
    if (t) { const m = t.match(/<img[^>]+src=["']([^"']+)["']/i); if (m?.[1]) return m[1]; }
  }
  return null;
}

async function syncFeed(feed) {
  console.log("Fetching", feed.rss_url);
  const res = await fetch(feed.rss_url, { headers: { "User-Agent": "MHWC/1.0" }});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const doc = parser.parse(await res.text());
  const channel = doc?.rss?.channel ?? doc?.channel ?? doc?.feed;
  const isAtom = Boolean(doc?.feed);
  const feedTitle = cleanText(pickText(channel.title));
  const feedAuthor = cleanText(pickText(channel["dc:creator"]) ?? pickText(channel["itunes:author"]) ?? pickText(channel.author));
  const feedImage = pickText(channel.image?.url) ?? channel["itunes:image"]?.["@_href"] ?? null;
  const items = asArray(isAtom ? channel.entry : channel.item);
  const posts = [];
  for (const item of items) {
    let link = null;
    const lk = item.link;
    if (typeof lk === "string") link = lk;
    else if (Array.isArray(lk)) { for (const x of lk) { if (typeof x?.["@_href"]==="string"){link=x["@_href"];break;} } }
    else if (lk && typeof lk === "object") { link = lk["@_href"] ?? lk["#text"] ?? null; }
    if (!link) continue;
    const guid = (typeof item.guid === "object" ? pickText(item.guid) : item.guid) ?? item.id ?? link;
    const title = cleanText(pickText(item.title)) ?? "Untitled";
    const summary = cleanText(pickText(item.description) ?? pickText(item.summary) ?? pickText(item["content:encoded"]));
    const pub = pickText(item.pubDate) ?? pickText(item.published) ?? pickText(item.updated);
    posts.push({
      feed_id: feed.id,
      guid: String(guid).slice(0,500),
      title: String(title).slice(0,500),
      summary: summary ? summary.slice(0,600) : null,
      link: String(link),
      image_url: firstImg(item) ?? feedImage,
      published_at: pub ? new Date(pub).toISOString() : null,
    });
  }
  const limited = posts.slice(0,50);
  await supabase.from("blog_feeds").update({ title: feedTitle, publisher: feedAuthor, image_url: feedImage, last_synced_at: new Date().toISOString(), last_sync_error: null }).eq("id", feed.id);
  if (limited.length) {
    const { error } = await supabase.from("blog_posts").upsert(limited, { onConflict: "feed_id,guid" });
    if (error) throw error;
  }
  console.log("  → upserted", limited.length);
}

const { data: feeds } = await supabase.from("blog_feeds").select("id, rss_url").eq("is_active", true);
for (const f of feeds) {
  try { await syncFeed(f); }
  catch (e) { console.error("FAIL", f.rss_url, e.message); await supabase.from("blog_feeds").update({ last_sync_error: e.message.slice(0,500), last_synced_at: new Date().toISOString() }).eq("id", f.id); }
}
