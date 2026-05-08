# Groups Expansion — Locations + Viral Niches

Goal: turn the Groups tab into a place where almost every walker finds a "that's me" group on day one — and a few that are weird/specific enough to share. All seeded via a single `INSERT` (no schema change, no UI change). Existing `groups-tab.tsx` already handles `theme`, `city`, `country`, "Near me", and theme buckets, so new rows light up automatically.

## What gets added

### 1. US metro chapters (~55)
One group per top US metropolitan area, theme `chapter`, with `city`, `state`, `country='US'`, and a friendly `location_label` (e.g. "Chicagoland"). Slugs like `chapter-nyc`, `chapter-chicagoland`, `chapter-dfw`.

Tier A (top 25 metros): NYC, LA, Chicagoland, Dallas–Fort Worth, Houston, DC Metro, Bay Area, Philadelphia, Miami–South Florida, Atlanta, Boston, Phoenix, SF, Riverside–San Bernardino (Inland Empire), Detroit, Seattle, Minneapolis–St. Paul (Twin Cities), San Diego, Tampa Bay, Denver, St. Louis, Baltimore, Charlotte, Orlando, San Antonio.

Tier B (26–50): Portland OR, Sacramento, Pittsburgh, Las Vegas, Austin, Cincinnati, Kansas City, Columbus, Cleveland, Indianapolis, San Jose, Nashville, Virginia Beach–Hampton Roads, Providence, Milwaukee, Jacksonville, Oklahoma City, Raleigh–Durham (Triangle), Memphis, Richmond, New Orleans, Louisville, Salt Lake City, Hartford, Buffalo.

Plus a few high-signal sub-metros: Chicagoland Suburbs, NYC–Brooklyn (already exists, keep), NYC–Queens, LA–South Bay, LA–Valley, Bay Area–East Bay, DC–NoVA.

### 2. Lifestyle / geography (~8)
- **Rural Walkers** (theme `quiet`, no city) — country roads, gravel, big sky
- **Small Town Walkers**
- **Suburban Loop**
- **Coastal Walkers**
- **Mountain Town Walkers**
- **Desert Walkers**
- **Snow Walkers** (cold-weather)
- **City Block Walkers** (urban dense)

### 3. Viral niche groups (~25)
Designed to be screenshot-able and tribe-forming. Each maps to an existing `theme` so filters keep working.

Identity / life-stage:
- **5am Club** (`reset`)
- **Night Owls** (`quiet`) — post-10pm walkers
- **Lunchbreak Walkers** (`reset`)
- **Dog Parents** (`connection`)
- **Stroller Crew** (`connection`)
- **Empty Nesters** (`chapter`)
- **Solo Travelers** (`connection`)
- **Remote Workers** (`burnout`)
- **Shift Workers** (`burnout`)
- **Grad School Survival** (`burnout`)
- **First-Year Teachers** (`burnout`)
- **Healthcare Workers** (`burnout`)
- **Founders Walk** (`burnout`)
- **Caregivers** (`grief`)

Mind / mood:
- **Walk Instead of Doomscroll** (`reset`) — viral hook
- **Phone-Free Walkers** (`quiet`)
- **One Podcast, One Walk** (`quiet`)
- **Audiobook Walkers** (`quiet`)
- **Hot Girl Walk** (`reset`) — known meme, broad appeal
- **Silent Walking** (`quiet`) — TikTok trend
- **Rage Walk** (`burnout`)
- **Gratitude Walk** (`reset`)
- **Walk & Pray** (`quiet`)
- **Sunset Chasers** (`reset`)
- **Sunrise Club** (`reset`)
- **Rainy Day Walkers** (`quiet`) — pairs with the new `weather_warrior` badge

### 4. International chapters (~10)
Toronto, Vancouver, Montréal, Mexico City, London (exists), Manchester, Dublin, Berlin, Amsterdam, Paris, Barcelona, Madrid, Sydney, Melbourne, Auckland, Tokyo, Singapore.

## Technical details

- **One `supabase--insert` call** with `INSERT ... ON CONFLICT (slug) DO NOTHING` so it's idempotent and safe to re-run.
- Columns: `name, slug, description, theme, city, state, country, location_label, group_type, is_active`. No `owner_user_id` (admin-seeded). `member_count` defaults to 0; the existing trigger keeps it accurate as people join.
- Descriptions kept to one calm sentence each (≤120 chars) — the GroupCard already truncates to 2 lines.
- `theme` uses only existing values (`anxiety, burnout, grief, depression, loneliness, reset, quiet, connection, chapter`) so theme buckets in `GroupsTab` light up without code changes.
- "Near me" already keys off `profiles.city` exact match — for metros we use the canonical city name (e.g. `Chicago`, not `Chicagoland`) but set `location_label='Chicagoland'` so the card reads naturally while matching commuters.

## What does NOT change

- No schema migration, no new columns, no RLS changes.
- No edits to `groups-tab.tsx`, `group-card.tsx`, or `use-groups-feed.ts` — they already render everything.
- Pulse/live counts populate naturally as walks happen.

## Open questions before I run the insert

1. Total target — is **~120 groups** the right magnitude, or do you want me to push toward **200+** (e.g. add top-100 US cities + more international)?
2. For metros that span states (DC Metro, NYC tri-state, KC, Memphis), should "Near me" match the **core city only** (simplest) or should I also seed sibling chapters like `chapter-nyc-nj`?
3. Any niches you want **in or out**? Anything on your "viral plan" I should mirror in the seed names so launch lines up?
