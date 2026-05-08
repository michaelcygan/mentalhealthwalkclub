# Ambient music library + light-touch shuffle player (revised)

Calmer footprint. Music is **a walk thing** — it eases users into the walk at the pre-walk drawer and rides through the active walk, with a one-tap mute. Everywhere else stays silent.

---

## 1. Admin surface

**Route:** `/admin` (admin-only layout) + `/admin/music` (library page).
- Gated by `has_role(auth.uid(), 'admin')` in `beforeLoad`; server functions re-check before any write.
- Discoverable from Profile only when current user is admin.

**`/admin/music` page:**
- Drag-and-drop uploader (`.mp3`, `.m4a`, `.ogg`, ~15 MB each, multi-file).
- Library table: **title**, **artist**, **duration** (auto-extracted client-side), **enabled** toggle, **delete**, inline preview.
- No tags / no contexts — single global library. Keeps the model simple; we only have one place that plays music.

---

## 2. Database (1 table, 1 bucket)

**Table `ambient_tracks`:**
- `id`, `title`, `artist nullable`, `audio_path text`, `duration_seconds int`, `is_active bool default true`, `uploaded_by uuid`, `created_at`, `updated_at`.

**RLS:**
- `SELECT`: any authenticated user where `is_active = true`; admin sees all.
- `INSERT / UPDATE / DELETE`: admin only.

**Storage bucket `ambient-music`:**
- **Private**. Playback uses signed URLs (1 hour TTL).
- Read for any authenticated user; write/delete admin only.

---

## 3. Where music plays (only here)

| Surface | Behavior |
|---|---|
| **Pre-walk drawer** (mood/intention sheet on home) | On open, fade in a random track at low volume (~0.3). Easing-in cue. Continues seamlessly into… |
| **Active walk** (`/walk/active/$id`) for **solo** + **guided_solo** | Same shuffle keeps playing. One-tap **mute/unmute** button next to Pause. Suppressed entirely for `walk_type === 'audio'` (Walk & Talk) and when a `guided_track_id` is loaded — those own audio. |
| **End of walk** | Crossfade out over ~2s when the walk ends. |

That's it. **No music on Journal, Welcome, Profile, Groups, Events, or anywhere else.**

---

## 4. The shuffle engine

**`useAmbientShuffle()` hook + `AmbientPlayerProvider` mounted at `__root.tsx`:**
- Single `<audio>` element survives navigation between the home drawer and the active walk — no restart on transition.
- Fisher-Yates queue; on `ended`, advance; on queue empty, reshuffle (excluding last played to avoid immediate repeat).
- Pre-fetch next signed URL ~10s before current ends → no gap.
- 1.5s linear crossfade between tracks (two pooled audio elements).
- Volume persisted in `localStorage` (default `0.3`). Mute state also persisted so users who silence it stay silenced across walks.
- Never autoplays without a user gesture — opening the drawer is the gesture.

---

## 5. Now-playing pill (walk context only)

A small pill, **only on the active walk screen**, near the bottom dock:

```
♪  Track Title — Artist        [mute]   [skip]
```

- Tap mute → fades out in 400ms, persists. Tap again → fades back in.
- Long-press the pill → skip to next track.
- No NowPlayingBar exposure, no global pill, no presence on other tabs. (The existing `NowPlayingBar` is for Walk & Talk presence — left untouched.)

---

## 6. Files

**Edited (3):**
- `src/routes/__root.tsx` — mount `AmbientPlayerProvider`.
- `src/routes/index.tsx` — start ambient when mood drawer opens; let it ride into the walk; stop if the user closes the drawer without starting.
- `src/routes/walk.active.$id.tsx` — render `<AmbientPill />`; suppress for audio/guided walks; crossfade out on end.
- `src/routes/profile.tsx` — admin-only "Admin" link.

**New (~6 small files):**
- `supabase/migrations/...sql` — `ambient_tracks` + RLS + private bucket + policies.
- `src/lib/ambient.functions.ts` — `listActiveTracks`, `signTrackUrl`, `adminUpsertTrack`, `adminDeleteTrack`.
- `src/hooks/use-ambient-shuffle.ts` — queue + crossfade engine.
- `src/lib/ambient-context.tsx` — provider + `useAmbient()`.
- `src/components/ambient-pill.tsx` — the walk-only now-playing control.
- `src/routes/admin.tsx` + `src/routes/admin.music.tsx` — admin layout + library page.

---

## 7. Out of scope

- No tags, no per-context libraries, no per-walk track choice.
- No music on journal, welcome, groups, events, etc.
- No transcoding, no streaming services, no DRM.
- No global now-playing bar — pill lives on the walk screen only.

---

Ready to build on your green light. Two small confirmations:

1. **Mute persistence:** if a user mutes during a walk, should it stay muted for **future** walks too, or reset to "playing" each time?
2. **Volume control:** include a small slider behind a tap on the pill, or keep it to just mute/unmute for simplicity?