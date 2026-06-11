# Notifications bell + flow audit

## Audit: what exists today

- **No notifications table, no server fns, no UI.** Nothing is delivered anywhere — not in‑app, not email, not push.
- `settings.tsx` has three toggles (`walk_reminders`, `friend_rsvps`, `weekly_recap`) but they only write to `localStorage`. They are decorative.
- Plenty of *notification‑worthy* events already fire in the app with no listener:
  - Friend request sent / accepted (`social.functions.ts`)
  - High‑five sent (`social.functions.ts`)
  - RSVP to a walk you host (`walk-page.functions.ts`)
  - Walk broadcast posted to attendees (`walk-broadcasts.tsx`)
  - Standing walk reminders, weekly recap (scheduled — not built)
- The circled icon in the screenshot is the **Get support** lifebuoy in `__root.tsx` (mobile header). The user wants a **bell** added in that same header slot.

## What this plan ships

In‑app notifications only (no email/push yet — flagged as post‑launch). Mobile + desktop header bell with unread count, dropdown/sheet panel, mark‑as‑read, deep links. Triggers wired into the five existing events above. Prefs toggles in Settings become real (control which categories generate rows).

### 1. Database (one migration)

```sql
create type public.notification_kind as enum (
  'friend_request', 'friend_accepted', 'high_five',
  'walk_rsvp', 'walk_broadcast'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind notification_kind not null,
  title text not null,
  body text,
  link text,                       -- e.g. /w/<code>, /circles, /profile/<id>
  entity_id uuid,                  -- walk_session_id / event_id / request_id
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);
create index on public.notifications (user_id, read_at) where read_at is null;

grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;

alter table public.notifications enable row level security;
create policy "own_notifications_select" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "own_notifications_update" on public.notifications
  for update to authenticated using (user_id = auth.uid());
create policy "own_notifications_delete" on public.notifications
  for delete to authenticated using (user_id = auth.uid());
-- No INSERT policy: only server-side (service_role / SECURITY DEFINER fn) writes.

create or replace function public.create_notification(
  _user_id uuid, _actor_id uuid, _kind notification_kind,
  _title text, _body text, _link text, _entity_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare nid uuid;
begin
  if _user_id = _actor_id then return null; end if; -- never notify self
  insert into public.notifications(user_id, actor_id, kind, title, body, link, entity_id)
  values (_user_id, _actor_id, _kind, _title, _body, _link, _entity_id)
  returning id into nid;
  return nid;
end $$;
revoke execute on function public.create_notification(uuid,uuid,notification_kind,text,text,text,uuid) from public, anon, authenticated;
```

### 2. Server functions (`src/lib/notifications.functions.ts`)

- `listNotifications({ limit })` — paginated, newest first.
- `getUnreadCount()` — `count exact head` where `read_at is null`.
- `markRead({ ids? })` — single, many, or all.
- `deleteNotification({ id })`.

All protected with `requireSupabaseAuth`.

### 3. Trigger wiring (no new endpoints — call from existing fns)

Inside the already‑authed server fns, after the primary write succeeds, call `supabaseAdmin.rpc('create_notification', { ... })` (loaded inside handler):

| Event | File | Notification |
|---|---|---|
| `sendFriendRequest` | `social.functions.ts` | recipient: "X wants to walk with you" → `/circles` |
| `respondFriendRequest` (accepted) | `social.functions.ts` | requester: "X accepted your request" → `/profile/<id>` |
| `sendHighFive` | `social.functions.ts` | recipient: "X high‑fived your walk" → `/journal` |
| RSVP insert (host notify) | `walk-page.functions.ts` | host: "X is coming to <walk>" → `/w/<code>` |
| Broadcast post | `walk-broadcasts` server fn | each attendee: "<host>: <preview>" → `/w/<code>` |

Failures are best‑effort (`Promise.allSettled` / try/catch) — never block the primary action.

### 4. UI

**`src/components/notifications/notifications-bell.tsx`** — Bell with red dot when unread > 0. Uses `useQuery(['notifications','unread'])` with `staleTime: 60s` + 60s `refetchInterval` (cheap `head:true` count). On click opens a Sheet (mobile) / Popover (desktop) listing the latest 20. Each row: actor avatar, title, relative time, click → `markRead([id])` then `navigate(link)`. "Mark all read" button.

**`__root.tsx` mobile header** — add the bell to the **left** of the existing lifebuoy (keep support, don't replace it):

```text
[ logo ] ............................. [ 🔔 ] [ 🛟 ]
```

Desktop sidebar: add a "Notifications" entry with the same unread badge.

**Settings** — replace the localStorage toggles with real prefs stored on `profiles` (`notify_friend_requests`, `notify_high_fives`, `notify_rsvps`, `notify_broadcasts`, default true). `create_notification` callers check the recipient's pref before writing.

### 5. Out of scope (post‑launch, called out)

- Email delivery (Resend) and Web Push / APNs — schema is ready; add a worker that drains unread rows to channels.
- Scheduled `walk_reminders` and Sunday `weekly_recap` — need a cron job; flagged but not built here.
- Realtime push into the bell (Supabase Realtime subscription) — 60s polling is fine for launch; can layer realtime later without schema changes.

## Files touched

- new: `supabase/migrations/<ts>_notifications.sql`
- new: `src/lib/notifications.functions.ts`
- new: `src/components/notifications/notifications-bell.tsx`
- new: `src/components/notifications/notifications-panel.tsx`
- edit: `src/routes/__root.tsx` (header slot, desktop nav badge)
- edit: `src/lib/social.functions.ts` (3 triggers)
- edit: `src/lib/walk-page.functions.ts` (RSVP trigger)
- edit: `src/components/walk-page/walk-broadcasts.tsx` server fn (broadcast trigger)
- edit: `src/routes/settings.tsx` (real prefs on `profiles`)
- edit: migration adds the `notify_*` boolean columns to `profiles`
