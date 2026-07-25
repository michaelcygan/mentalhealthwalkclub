## Auto-mark notifications read on open

Update `src/components/notifications/notifications-bell.tsx` so opening the notifications sheet silences the unread badge automatically — no "Mark all read" click required.

### Behavior

- When the sheet opens and there are unread items, call `markNotificationsRead({ all: true })` once, then invalidate the `["notifications"]` queries so the badge clears and the blue dots fade.
- Keep each item's unread visual state (the small forest dot + tinted background) intact for the current session so the user can still see what's new in this view. Achieve this by snapshotting the currently-unread IDs when the sheet opens and rendering them as "unread-styled" until the sheet closes.
- On next open (or bell reappearance), everything is read — badge stays at 0.
- Remove the "Mark all read" button since it's now redundant. Leave per-item click behavior unchanged (navigates via `n.link`).
- Realtime INSERTs while the sheet is open: invalidate as today; new arrivals will show as unread and get swept on the next open.

### Technical notes

- Fire the mark-read call inside an effect keyed on `open` transitioning to true and `items.length > 0` with any `read_at === null`. Guard with a ref so it only runs once per open cycle.
- The snapshot-of-unread-IDs is a `useState<Set<string>>` set when the list first loads for an open session, then cleared on close.
