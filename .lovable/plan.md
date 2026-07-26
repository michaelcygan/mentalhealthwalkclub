## Radio V1 — Follow-up Pass (Waves 5, 7, 8, 10–14)

Continue the mixed-source Radio upgrade. Waves 1–4, 6, and part of 9 already landed (schema, source-aware server fns, resolveRadioItem, cycle-based client, admin station editor, admin feed panel). This pass finishes the rest.

### Wave 5 — Reordering & bulk actions in station editor
- Drag-to-reorder playlist rows in `admin.radio.$id.tsx` (persist `position` via a new `adminReorderStationTracks` server fn).
- Row actions: remove, edit `repeat_count`, toggle enabled.
- Empty-state polish.

### Wave 7 — Playback-mode + loop controls
- Station editor: toggles for `playback_mode` (ordered/shuffle) and `loop_enabled`; "Set as default station" action wired to `is_default`.
- Client honors mode; already partly in `radio-client.ts` — verify shuffle stability and loop pre-enqueue in edge cases (single-track station, empty resolve).

### Wave 8 (finish) — Continuous playback UX
- `now-playing-dock.tsx`: show current source type badge (Upload / Link / Podcast) and station name; auto-advance on `ended`; skip-forward/back across cycles.
- Handle resolve failures gracefully (skip + toast, don't stall the cycle).

### Wave 10 — Resume & session persistence
- Persist `{stationId, cycleIndex, trackId, positionSec}` to `localStorage` on pause/unmount.
- On dock mount, offer "Resume {station}" chip when a recent session exists (<24h).

### Wave 11 — Public Radio surface
- `radio-rail.tsx`: use `is_default` to pin the default station first; show source-mix chips (e.g. "Uploads · Podcast").
- Station detail route `/radio/$id` (public read) showing tracklist w/ source badges and a Play button that boots the dock.

### Wave 12 — Free-tier metering integration
- Confirm `radio_monthly_usage` increments once per resolved item (not per cycle repeat). Adjust in `resolveRadioItem` or client boundary.
- Upsell sheet copy tuned for mixed sources.

### Wave 13 — Admin QA tools
- "Test resolve" button per row in station editor: calls `resolveRadioItem`, shows resolved URL + duration + any error inline.
- Feed panel: "Sync now" per feed with last-sync timestamp + error surface.

### Wave 14 — Launch QA + build
- `tsgo --noEmit` clean.
- Manual smoke: create station with 1 upload + 1 link + 2 podcast episodes, ordered + looped; verify continuous playback across cycles; verify shuffle; verify free-tier cap; verify SSRF rejection on private URL.
- Verify signed-out users can still hear the default station within free cap.

### Technical notes
- New server fn: `adminReorderStationTracks({ stationId, orderedIds })` — single `UPDATE ... FROM (VALUES ...)` to rewrite positions atomically.
- Reorder UI: `@dnd-kit/core` + `@dnd-kit/sortable` (already common in the stack; confirm on install).
- Resume storage key: `mhwc:radio:last-session`; guarded by `useHydrated`.
- Station detail route is public read via server publishable client + narrow `TO anon` SELECT on `radio_stations`/`radio_tracks` (already in place from earlier waves — verify).
- Metering: move increment into `resolveRadioItem` handler so cycle repeats don't double-count; key on `(user_id, month, item_id)` de-dupe.

### Out of scope for this pass
- User-created stations (admin-only stays).
- Cross-device sync of resume state.
- Analytics dashboards for Radio.
