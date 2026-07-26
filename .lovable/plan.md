## Desktop: move Notifications into "More" with unread badge

**Sidebar (`src/routes/__root.tsx`)**
- Remove the standalone `<NotificationsBell variant="sidebar" />` block from the desktop sidebar.
- In the `TABS` "More" item, render an unread count badge (red pill with the number) on the right side of the row when `user` is signed in and `unreadCount > 0`. Fetch count via the existing `getUnreadNotificationCount` server function on mount + poll (matching how `NotificationsBell` does it) or subscribe to the same realtime channel it uses. Only render on desktop (badge naturally shows in sidebar `md:flex` area).
- Leave mobile header bell unchanged.

**More page (`src/routes/more.tsx`)**
- Add a `Notifications` row to the "Account" (or new "Inbox") section linking to `/notifications` with a red unread-count pill on the right when > 0.

**Notifications route**
- Check if `/notifications` exists; if not, add a lightweight `src/routes/notifications.tsx` that renders the notifications list (reuse the sheet content from `NotificationsBell`) and marks all read on mount — matching the existing "silence on open" behavior. If it already exists, reuse it.

**Badge dismissal**
- Opening `/notifications` calls `markNotificationsRead({ all: true })` on mount, which clears the count for both the sidebar "More" badge and the More-page row.

### Technical notes
- Extract the unread-count polling logic from `NotificationsBell` into a small `useUnreadNotifications()` hook in `src/components/notifications/` so sidebar, More page row, and mobile bell share one source of truth.
- Badge style: `ml-auto inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground`.
