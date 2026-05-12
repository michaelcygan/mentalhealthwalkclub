# Music library: long uploads, rich metadata, timed mixes

## Overview

Turn the existing admin music page into a real library, then surface that library on the **Music** tab of the Start-a-Walk flow with:
- Three "Timed Mix" cards (15 / 30 / 60 min — auto-shuffled to fill duration)
- A "Shuffle all" pill
- The full track list below

Plus: grant `greenhousecrtv@gmail.com` admin so you can use `/admin/music`.

## Decisions captured

- **Format:** MP3 / M4A only (you'll convert masters beforehand). No raw .wav, no transcode pipeline. 1.5h MP3 @ 192 kbps ≈ 130 MB; we'll set the cap at **250 MB** to be safe.
- **Music tab UX:** Timed mixes on top + Shuffle pill + track list.
- **Per-track metadata:** Title, Artist, Genre/Mood tags, Cover image, Sort order, Featured flag.

---

## 1. Grant admin

After this plan is approved, I'll insert one row into `user_roles` (role=`admin`) for the user matching `greenhousecrtv@gmail.com`. Then sign out / sign back in to refresh the session, and `/admin` becomes accessible.

## 2. Storage + schema (one migration)

**Bucket changes**
- `ambient-music`: raise `file_size_limit` to `262144000` (250 MB). Restrict `allowed_mime_types` to `['audio/mpeg','audio/mp4','audio/m4a','audio/x-m4a']`. Stays private; signed URLs.
- New bucket `ambient-covers` (public, 5 MB cap, image/* mime). Public so covers load without round-trips.
- Storage RLS: admin-only insert/update/delete on both buckets; `ambient-covers` public select.

**Table changes — `ambient_tracks`**
Add columns:
- `genre text` — single value (e.g. "Lo-fi", "Forest")
- `mood_tags text[] not null default '{}'` — chips, used for matching `mood`
- `cover_path text` — path inside `ambient-covers`
- `sort_order int not null default 0`
- `is_featured bool not null default false`
- `bpm int` (nullable) — optional, for smarter shuffles later (no UI yet)

No drops. Existing rows unaffected.

## 3. Admin Music page (`src/routes/admin.music.tsx`)

- Raise client `file.size` cap to **250 MB**; reject `.wav` upfront with a friendly toast pointing to MP3/M4A.
- Resumable uploads: switch from `.upload(path, file)` to `.uploadToSignedUrl` / `upsert` flow with `@supabase/storage-js` resumable (TUS) for files > 6 MB so 130 MB MP3s don't time out behind a single POST. Show per-file progress (% bar) instead of a count.
- Track row gains:
  - **Cover thumbnail** with click-to-upload (square, optional)
  - **Genre** input
  - **Mood tags** — chip input (comma-separated, normalized lower-snake)
  - **Sort order** number input + ★ Featured toggle
- Inline-edit on blur, same pattern as title/artist.

## 4. Music tab on Start-a-Walk

Today the picker reads from `guided_tracks`. We'll switch the **Music** tab only to read from `ambient_tracks`:

```
[ Voice/Music | Podcast ]
———————————————————————
Timed Mix
┌──────────┐ ┌──────────┐ ┌──────────┐
│  15 min  │ │  30 min  │ │  60 min  │   <- shuffled to fill duration
└──────────┘ └──────────┘ └──────────┘

[🔀 Shuffle all] [★ Featured]            <- pill row

Tracks
─ cover · Title · Genre · 12:34
─ cover · Title · Genre · 8:21
...
```

- Featured tracks pin to top of the list, then sort by `sort_order`, then by `created_at desc`.
- Mood-fit chip ("fits") still appears when `mood_tags.includes(currentMood)`.
- Selecting a single track → existing "play one" flow.
- Selecting a Timed Mix or Shuffle → new playlist flow (next section).

Picker passes back a richer `GuidedTrack` shape so the runtime knows whether it received one track or a queue + target duration.

## 5. Playlist runtime (timed walks with music)

`src/lib/walk-runtime.tsx` gets a small playlist API:

- New `primeMusicPlaylist({ tracks: AmbientTrack[], targetDurationSeconds | null, shuffle: boolean })` — analogous to existing `primePodcast`.
- Internally: shuffle queue (Fisher-Yates), fetch signed URL for current + prefetch next.
- On `audio.ended`: advance to next track. If `targetDurationSeconds` is set, stop the queue when the cumulative played time ≥ target (don't cut the current track mid-way unless it overshoots by >25 %; otherwise let it finish).
- Same Pause / Mute controls as podcast mode — reuse `RuntimePodcastCard` pattern; refactor to a shared `RuntimeAudioCard` showing current track title + "Up next: …" line.
- For Shuffle (no duration), queue runs indefinitely; loops back when exhausted.

`use-walk-composer.tsx` chooses which `prime…` to call based on the picker payload.

## 6. Why this is a selling point (framing)

- "**Walk for 15, 30, or 60 minutes** — we'll shuffle the right amount of music and stop when your time's up." That's a complete, opinionated product moment vs. generic podcast apps.
- Featured + Genre tags let you curate moods (e.g. "Forest", "Subway", "Late night") that walkers can use to set intention.
- Auto-stop at duration encourages users to actually *finish* a walk — different from infinite background music.

---

## Out of scope (call out for later)

- WAV → MP3 server-side transcode (not doing now per your choice)
- Per-track waveform previews
- BPM-matched shuffles (column added but unused yet)
- User-built playlists / favorites

## Files touched

- **migration** — bucket config, `ambient-covers` bucket + policies, columns on `ambient_tracks`
- **insert** — admin role for greenhousecrtv@gmail.com (separate, after migration)
- `src/routes/admin.music.tsx` — resumable uploads, cover/genre/mood/sort/featured editors, 250 MB cap
- `src/components/guide-picker.tsx` — Music tab now reads `ambient_tracks` and renders Timed Mix cards + Shuffle + list
- `src/components/walk-composer/use-walk-composer.tsx` — branch on payload type → call `primeMusicPlaylist` vs single-track
- `src/lib/walk-runtime.tsx` — `primeMusicPlaylist`, queue + auto-advance + duration cutoff
- `src/components/active-walk/format-modules/guided-module.tsx` — extract `RuntimeAudioCard` shared by podcast + playlist; show "Up next"
- `src/integrations/supabase/types.ts` regenerates automatically after migration

## Technical notes

- Resumable upload uses `supabase.storage.from(...).upload(path, file, { upsert: false, duplex: 'half' })` with a `chunkSize` of ~6 MB. If the storage-js version doesn't expose resumable yet, fall back to a single POST since 250 MB is within the worker-bypass storage upload limit (uploads go directly to storage.supabase.co, not through the SSR Worker).
- Storage RLS for `ambient-covers`: `bucket_id = 'ambient-covers' AND has_role(auth.uid(), 'admin')` for write; `bucket_id = 'ambient-covers'` for read.
- Mood tag normalization: `tag.trim().toLowerCase().replace(/\s+/g,'_')` before insert; render as Title Case in chips.
- Auto-stop logic example: `while (sumPlayed + nextDuration <= target * 1.25) advance()`.
