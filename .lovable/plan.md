
# Launch-Readiness Audit — 100k DAU / ~10k concurrent target

Scope: efficiency, integrity, build. **No new features.** Read-only — nothing has been changed.

Signals used: DB linter (34 findings), `pg_stat_statements` slow-query view, security scanner (38 findings), and a full code sweep of routes, server fns, hooks, and components.

**Verdict:** **not blocking launch, but 7 Sev1 items should ship first.** The architecture is sound (TanStack Start + RLS + server fns). The risks are concentrated in three places: a few unauthenticated public endpoints, the home route's data-fetch fan-out, and the podcast/blog sync jobs running serially.

---

## SEV 1 — Fix before launch (security + correctness)

These are the only items that meaningfully change risk at 10k concurrent.

| # | What | Where | Why it matters | Fix |
|---|------|-------|----------------|-----|
| 1 | **Unauthenticated cron endpoints** | `routes/api/public/hooks/sync-blog-feeds.ts`, `sync-podcast-feeds.ts` | Anyone on the internet can trigger full RSS re-sync; burns DB CPU + external quota; comment promises auth that isn't enforced | Verify `Authorization: Bearer $CRON_SECRET` header; 401 otherwise |
| 2 | **`listBroadcasts` uses `supabaseAdmin` with no auth middleware** | `lib/walks.functions.ts:227` | Bypasses RLS on `event_broadcasts` for any caller | Add `.middleware([requireSupabaseAuth])`, use `context.supabase` |
| 3 | **`syncBlogFeedsNow` is callable by anyone signed-in** | `lib/blogs.functions.ts:41` | Triggers full RSS sync; no admin check | Add `requireSupabaseAuth` + `assertAdmin` (pattern already exists in `syncBlogFeedsAdmin`) |
| 4 | **Sync jobs run feeds serially** | `lib/blogs.server.ts:221`, `lib/podcasts.server.ts:166` | `for (const f of feeds) await syncFeedById(f.id)` — 20+ feeds = N × (fetch + parse + upsert) held open in one worker. Worker timeout risk and the #1 slow query (podcast_episodes upsert, 30s total, 825 calls) is amplified by this | `Promise.allSettled` with concurrency cap (5 in flight) |
| 5 | **`discoverMyCircleSummary` N+1 on circles** | `lib/social.functions.ts` (activeWalkers block) | One `walk_sessions` query per circle, serial. User in 10 circles = 10 round-trips every home load | Collect all member ids first, single `.in("user_id", allMateIds)`, group in JS |
| 6 | **Stripe webhook upserts run serial across tables** | `routes/api/public/payments/webhook.ts:80` | Subscription upsert + supporter_profile upsert hit different tables and could be parallel; matters during dunning retries and bulk renewals | `Promise.all` the two upserts after the out-of-order guard |
| 7 | **DB: 2 functions have mutable `search_path`** | linter WARN 2-3 | Search-path injection vector on SECURITY DEFINER fns | Add `SET search_path = public` to the 2 flagged fns |

The other 32 DB linter findings are mostly "SECURITY DEFINER function executable by signed-in users" — these are intentional (`has_role`, `user_membership`, etc., all called from RLS policies and server fns). Worth a one-time audit to revoke `EXECUTE` from `anon`/`authenticated` on any that should only be called from triggers or other DEFINER fns, but **not launch-blocking** if the function bodies themselves are safe. Two are worth checking: any SECURITY DEFINER fn callable by `anon` that does an `INSERT` or `UPDATE`.

---

## SEV 2 — Fix in the first week of load (perf + cost)

These won't crash launch, but each one multiplies per active user.

| # | What | Where | Impact |
|---|------|-------|--------|
| 8 | Home route fires 8+ independent `useEffect → serverFn` calls per mount, no `staleTime`, no cache | `routes/index.tsx` HomeTab | 10k concurrent ≈ 80k server-fn calls per render burst |
| 9 | `TodayIsland` + `WeekSummary` use bare `supabase` in `useEffect`, refetch on every tab focus | `components/home/today-island.tsx:38`, `week-summary.tsx:19` | Wrap in `useQuery({ staleTime: 5*60_000 })` |
| 10 | `getHomeUpcoming` runs 5 sequential awaits | `lib/discover.functions.ts:418` | Two `Promise.all` groups cut latency ~60% |
| 11 | `listFriends` has no `.limit()` | `lib/social.functions.ts:224` | A 500-friend account fetches 500 rows + 500 profile joins |
| 12 | `discoverFriendsGoing` RSVP scan has no `.limit()` or date filter | `lib/discover.functions.ts:119` | Scales with social-graph size |
| 13 | `useMinutelyRain` opens a duplicate poll loop per mount | `hooks/use-weather.ts:131` | `BestWindow` + `WeatherForecast` mounted together = 2 poll loops; lift to context or `useQuery` |
| 14 | `select("*")` on `places` (3 sites) | `lib/walk-places.functions.ts:148,233,240` | Ships blurb/attribution/static-map URL to every walk-creation form load |
| 15 | Player context re-renders all consumers on every `timeupdate` (~4 Hz) | `lib/player-context.tsx` | Split into `PlayerControlsCtx` + `PlayerPositionCtx`; the dock doesn't need position |
| 16 | `deleteMyAccount` does 11 serial deletes, silently swallows errors | `lib/account.functions.ts:24` | `Promise.allSettled` + surface failures |
| 17 | No `errorComponent` on authenticated routes | `routes/_authenticated/route.tsx` | A thrown server fn = blank screen. Add one shared boundary at the layout |
| 18 | `FriendPulse` has unstable dep array (`fetchActivity` ref changes every render) | `components/home/friend-pulse.tsx:33` | Effectively refetches on every parent re-render — quietly expensive |

---

## SEV 3 — Polish (post-launch)

Bundle weight + small leaks. Each is ~1-3 kB or ~1 request — none move the needle alone.

19. `motion/react` imported eagerly in 15+ components → lazy-load on `journal` and `listen` routes.
20. `recharts` pulled into the initial chunk via `components/ui/chart.tsx` barrel → dynamic-import at callsites.
21. `<img>` without explicit `width`/`height` (CLS) — `attendee-stack.tsx:115`, `w.$code.recap.tsx:131`, `admin.merch.tsx:207`.
22. `ambient-backdrop` 10-min `setInterval` → replace with `useMemo` on hour bucket.
23. `createSlug` does up to 50 sequential uniqueness probes → UUID suffix + DB unique constraint + single retry.
24. Guest RSVP rate-limit does a `select count` per submission → in-memory LRU first, DB fallback.
25. `listWalkAttendees` uses `supabaseAdmin` for a public-page read → anon client (RLS already covers it).
26. `useSubscription` opens a duplicate realtime channel if both `BillingCard` and a badge mount → singleton via auth context.
27. `useProfileStats` likely missing `staleTime` → confirm + add.
28. `NowPlayingDock` cover art has no `width`/`height` and no Supabase image transform → 48×48 px slot can load a 1400×1400 iTunes cover.
29. `getHomeUpcoming` and `discoverFriendsGoing` duplicate friend+circle fan-out → extract shared `getFriendAndMateIds`.
30. Raw Stripe error messages forwarded to client in some billing fns → route through existing `lib/cap-error.ts`.

---

## DB / infra notes (separate from the code list)

From `pg_stat_statements`:
- **#1 hot query:** `podcast_episodes` upsert (30s total / 825 calls / 36ms mean). This is the cron sync job — fixing item #4 (parallel feed sync) won't speed individual upserts but will free workers faster. If episode insert volume grows, consider `COPY ... FROM` or batching upserts.
- **#2:** `podcast_episodes` join with `podcast_feeds` (max 550ms!) — needs `EXPLAIN ANALYZE` to confirm, almost certainly missing an index on `podcast_episodes.feed_id` or `(is_active, published_at DESC)`.
- **#5-6:** Two `events` queries running ~46k and ~23k times for the audio-room cron logic. Fast individually (0.06ms) but consider whether this many calls are needed.

Storage: `ambient-covers` bucket is public with listing allowed (linter WARN 5). Lock down the `LIST` policy unless you actually want third parties enumerating cover art.

---

## My recommendation

**Ship Sev1 (items 1-7) before launch. Ship Sev2 in the first week or two as load reveals priorities. Sev3 is post-launch hygiene.**

The Sev1 list is ~2-3 hours of focused work and meaningfully changes the security posture. Sev2 is where the cost-per-user math lives — worth doing, but you'll see signals in your DB metrics that tell you which one to do first once real traffic hits.

Want me to switch to build mode and ship Sev1?
