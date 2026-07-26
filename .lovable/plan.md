## Radio V1 QA Pass

End-to-end verification of the mixed-source Radio flow with fixes applied inline for anything blocking.

### 1. Static checks
- `tsgo --noEmit` typecheck
- Production build (`bun run build`) to catch SSR / bundler issues
- Grep for any lingering references to the old single-source Radio shape (`audio_url` only, missing `source_type`)

### 2. Admin flow (Playwright, authenticated as admin)
- `/admin/radio`: create a station, mark as default (verify only one default enforced), register a podcast feed, toggle `radio_enabled`, run "Sync now"
- `/admin/radio/$id`: add tracks from all three sources (Upload, External Link, Podcast Episode); reorder via drag; adjust `repeat_count`; toggle `is_active`; run Test Resolve on each source type; remove a track
- Verify SSRF guard rejects `http://` and private IPs on external link add

### 3. Public + playback flow
- `/` home Radio rail: default station shows star badge, Resume chip appears after playing once, mobile scroller + desktop grid both render
- `/radio/$slug`: tracklist renders with source badges, play a track, verify continuous playback advances through cycle, shuffle vs ordered mode honored, loop pre-enqueues next cycle
- Dock: current track shows correct title/source, next/prev works across source types, resume on reload restores station + position

### 4. Safety + metering
- Free-tier monthly cap still enforced (UpsellSheet triggers)
- Signed-out user can browse `/radio/$slug` but paywall/limit behaves correctly
- Non-adult-active user: Radio browsing works (not gated), adult-only actions still gate

### 5. Deferred items to confirm (from prior message)
Not blocking QA, but flag status of:
- Wave 7 (playback controls polish)
- Wave 8 (continuous UX details)
- Wave 10 (metering edges)
- Wave 12 (public discovery surfaces)
- Wave 14 (final metrics/telemetry)

Any regressions found get fixed in the same pass; anything larger gets called out with a recommendation.

### Deliverable
A short QA report: what passed, what was fixed inline, and any remaining follow-ups for the deferred waves before launch.
