-- Notification kinds
create type public.notification_kind as enum (
  'friend_request', 'friend_accepted', 'high_five', 'walk_rsvp', 'walk_broadcast'
);

-- Per-user prefs (on profiles)
alter table public.profiles
  add column if not exists notify_friend_requests boolean not null default true,
  add column if not exists notify_high_fives boolean not null default true,
  add column if not exists notify_rsvps boolean not null default true,
  add column if not exists notify_broadcasts boolean not null default true;

-- Notifications table
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind public.notification_kind not null,
  title text not null,
  body text,
  link text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;

alter table public.notifications enable row level security;

create policy "own_notifications_select" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "own_notifications_update" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own_notifications_delete" on public.notifications
  for delete to authenticated using (user_id = auth.uid());
-- No INSERT policy: only service_role / SECURITY DEFINER writes.

-- Helper: create a notification respecting user prefs and skipping self-notify
create or replace function public.create_notification(
  _user_id uuid,
  _actor_id uuid,
  _kind public.notification_kind,
  _title text,
  _body text,
  _link text,
  _entity_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nid uuid;
  allowed boolean := true;
begin
  if _user_id is null then return null; end if;
  if _actor_id is not null and _actor_id = _user_id then return null; end if;

  -- Honor recipient prefs
  select case _kind
    when 'friend_request'  then coalesce(p.notify_friend_requests, true)
    when 'friend_accepted' then coalesce(p.notify_friend_requests, true)
    when 'high_five'       then coalesce(p.notify_high_fives, true)
    when 'walk_rsvp'       then coalesce(p.notify_rsvps, true)
    when 'walk_broadcast'  then coalesce(p.notify_broadcasts, true)
    else true
  end
  into allowed
  from public.profiles p
  where p.id = _user_id;

  if not coalesce(allowed, true) then return null; end if;

  insert into public.notifications(user_id, actor_id, kind, title, body, link, entity_id)
  values (_user_id, _actor_id, _kind, _title, _body, _link, _entity_id)
  returning id into nid;

  return nid;
end;
$$;

revoke execute on function public.create_notification(uuid, uuid, public.notification_kind, text, text, text, uuid) from public;
revoke execute on function public.create_notification(uuid, uuid, public.notification_kind, text, text, text, uuid) from anon;
revoke execute on function public.create_notification(uuid, uuid, public.notification_kind, text, text, text, uuid) from authenticated;
grant execute on function public.create_notification(uuid, uuid, public.notification_kind, text, text, text, uuid) to service_role;