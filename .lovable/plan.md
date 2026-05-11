# Fix the journal share card

## What's wrong today

`bakeShareCard` (src/lib/share-card.ts) renders a 1080×1350 canvas where the route map fills the **entire top 1080px square**, leaving only **270px** for headline stat, sub-stats, mood pills, intention quote, and footer. Everything piles up and overlaps — exactly what the screenshot shows ("walk it through · mhwalk.club" colliding with the mood pills, "content" sitting on top of footer).

It also bakes the user's **intention text** into the image. That can be sensitive and shouldn't be shared by default.

## What we'll build

Two clean 1080×1920 (9:16, IG-Story-native) share card variants, picked automatically:

1. **Photo variant** — when the walk has at least one `walk_photos` row.
   - Full-bleed first photo as the background, subtly desaturated.
   - Soft dark gradient at the bottom for legibility.
   - Bottom card: distance (big serif), then `min · steps · date` line, weather chip, brand mark.
   - No writing, no mood text — photo + numbers only.

2. **Map variant** — when there's a route snapshot but no photo.
   - Top ~58% = route snapshot, cream background behind it (current look but properly sized).
   - Bottom ~42% = generous breathing room for: eyebrow ("MENTAL HEALTH WALK CLUB"), date, big serif distance, sub-stats row, weather chip, mood arc (emoji/word → emoji/word, no sentence), brand footer.
   - All measured against the **bottom region only**, so nothing can collide with the map or the footer.

3. **Fallback** — no snapshot and no photo: a cream-on-forest text card with the same stat hierarchy. Existing text-only `share()` path is kept for the no-image edge case.

### Hard rules (per request)
- **Never render** `reflection_note`, `intention`, or any free-text the user wrote. Removed from `ShareCardStats` entirely so it can't slip back in.
- Mood is OK to show because it's a controlled vocabulary (already a chip elsewhere), but only as a short two-token arc — and only on the map variant.

## Technical changes

### `src/lib/share-card.ts`
- Bump canvas to **1080 × 1920**.
- Drop `intention` from `ShareCardStats`. Add optional `photoUrl?: string | null`.
- Split into `bakeMapCard()` and `bakePhotoCard()` internal functions; `bakeShareCard()` chooses based on inputs (`photoUrl` → photo, else `snapshotUrl` → map, else null).
- Tight, deterministic layout using a vertical "stack" helper so each row reserves its own band — no more overlap.
- Keep current palette tokens (FOREST / CREAM / CLAY) for brand consistency.

### `src/routes/journal.tsx`
- `onShareEntry(w)` and the detail panel `onShare()` already have `photoUrlsByWalk` / `photos` in scope.
  - Pass `photoUrl: photoUrlsByWalk[w.id]?.[0] ?? null` (list view) and `photos[0]?.url ?? null` (detail view) into `bakeShareCard`.
  - Remove the `intention` argument from both call sites.
- Allow sharing when **either** a snapshot **or** a photo exists (today the detail-panel share is gated on `snapshotUrl` only — it'll also fire when only photos exist).

### Out of scope
- No DB changes, no new storage buckets, no new components — purely the share-card renderer + its two call sites.
- No changes to the in-app journal card UI itself; only the generated PNG.

## Verification
- Trigger share from a walk **with** a photo → expect photo-variant PNG.
- Trigger share from a walk **with map only** → expect map-variant PNG with all rows visible, no overlap, no written text.
- Trigger share from a walk **with neither** → existing text-share fallback fires.
