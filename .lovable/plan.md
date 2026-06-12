## Goal

Bring the admin area in line with where the app is today and add the two missing operator/user flows: deep analytics and lite error reporting.

## What changes in Admin

Add three new tabs and beef up one existing tab. Nothing is removed — every current tab (Events, Podcasts, Blogs, Collections, Membership, Merch) still maps to a live feature.

### 1. Insights → full Analytics dashboard (`/admin/insights`)

Replace the current Listen-only insights with a comprehensive operator dashboard. Time-range selector (7d / 30d / 90d / all). Sections:

- **Growth**: total users, new signups (line chart by day), DAU / WAU / MAU, retention (Week 1 / Week 4 cohort table).
- **Geography**: top cities/regions/countries by user count and by walk count (table + simple bar). Pulled from `profiles.city/region/country` and `events.city/region/country`.
- **Walks**: walks created, walks completed, RSVPs (going), avg attendees per walk, host count, top hosts.
- **Engagement**: high-fives sent, friend connections made, journal entries written, notifications delivered (by kind).
- **Listen/Read** (keep existing): top search terms, zero-result terms, action breakdown.
- **Monetization**: active Plus subs (monthly / yearly split), supporter count, MRR estimate, trial conversions.

All metrics computed in a single `adminAnalyticsOverview` server fn (admin-gated, `supabaseAdmin`) so the page loads in one round-trip. Heavy time-series come from a small set of SQL aggregates over `profiles`, `walk_sessions`, `events`, `event_rsvps`, `high_fives`, `friendships`, `journal_entries`, `notifications`, `subscriptions`, `listen_search_log`, `listen_events`.

### 2. New tab: Safety (`/admin/safety`)

Triage UI over the existing `safety_reports` table. List open reports → reporter, reported user, reason, context link, created_at. Actions: mark resolved, mark dismissed, open reported user's profile. New admin server fns `adminListSafetyReports` / `adminResolveSafetyReport`.

### 3. New tab: Requests (`/admin/requests`)

Wire `adminListContentRequests` / `adminUpdateContentRequest` (already exist, no UI today) to a simple inbox: title, url, kind, notes, status pills (open / in_review / approved / declined). Also surface the new error reports inbox here as a second list — or split into its own tab if cleaner; I'll keep it one tab with two segments ("Content suggestions" / "Bug reports") to keep the navbar tight.

### 4. New tab: Users (`/admin/users`)

Search by email or username (server fn calling auth.admin.listUsers + profiles join). Row click opens a detail sheet with: profile, membership status, walks hosted/attended, recent reports against them, role chips. Actions: grant/revoke `admin` role (writes to `user_roles`), copy user id, deep-link to their profile.

### 5. Cleanup

- Remove the "Active users" stat from the old insights card (now lives in Analytics).
- Admin nav becomes scrollable on mobile (already wraps; just verify it doesn't blow the layout with the new tabs).

## User-facing: "Report an issue" (Lite)

- New table `public.error_reports`: `id`, `user_id` (nullable for guests), `message`, `url`, `user_agent`, `app_version`, `console_tail` (jsonb, last ~20 console messages), `status` (`open` / `triaged` / `closed`), `created_at`. RLS: users can insert their own; only admins can read.
- Small util `src/lib/console-capture.ts` that subscribes to `console.error` / `console.warn` at root mount and keeps a 20-entry ring buffer.
- New server fn `submitErrorReport` (authed-or-anon insert with rate-limit by user_id / IP-less by simple last-60s check on user_id).
- UI:
  - `src/components/report-issue-dialog.tsx` — textarea + "include diagnostics" toggle (on by default, shows what we capture).
  - Entry points: Settings → "Report a problem" row, mobile More menu, footer link on public pages.
- Admin surfacing: shows up in `/admin/requests` under "Bug reports" with the diagnostic payload viewable.

## Technical Details

**New files**
- `src/lib/analytics-admin.functions.ts` — `adminAnalyticsOverview({ range })` returning everything for the dashboard.
- `src/lib/safety-admin.functions.ts` — list/resolve.
- `src/lib/users-admin.functions.ts` — search, detail, role grant/revoke.
- `src/lib/error-reports.functions.ts` — `submitErrorReport`, admin list/update.
- `src/lib/console-capture.ts` — ring buffer.
- `src/components/report-issue-dialog.tsx`.
- `src/routes/admin.analytics.tsx` (rename current `admin.insights.tsx` → `admin.analytics.tsx`, redirect old path).
- `src/routes/admin.safety.tsx`, `src/routes/admin.requests.tsx`, `src/routes/admin.users.tsx`.

**Edited**
- `src/routes/admin.tsx` — new nav entries (Analytics, Users, Safety, Requests).
- `src/routes/__root.tsx` — mount console capture once.
- `src/routes/settings.tsx` and `src/routes/more.tsx` — add "Report a problem".

**Migration**
- Create `error_reports` (table + GRANTs + RLS: insert self, admin select/update).
- Add a couple of supporting indexes for analytics: `walk_sessions(user_id, status, started_at)`, `event_rsvps(event_id, status)`, `notifications(user_id, kind, created_at)` if missing.

**Security**
- All admin server fns gated by the existing `assertAdmin(userId)` pattern.
- `submitErrorReport` validates message length (1–2000), strips obvious secrets-looking strings, caps `console_tail` size.

## Out of scope (post-launch)

- Real-time analytics streaming, custom date-range picker beyond presets, CSV export, charts library beyond simple inline bars/sparklines.
- Screenshot attachments on error reports.
- Suspend/ban user actions (only role grant for now).
