# Audit & finish-line pass: More → Settings flow

## The headline fix: Help & Safety

Today, tapping **Help & safety** in /more deep-links to `/settings#safety`, which dumps people into the full settings page (account form, notifications, billing) and scrolls them to a small card. For someone in distress, that is the wrong moment to navigate a settings dashboard.

**Fix:** create a dedicated `/support` route — a single-purpose, calm page that does one thing well.

`/support` page content (mobile-first, generous spacing, no other chrome):
1. **Quiet header** — "You're not alone." Sub: "If you're in crisis, help is available right now."
2. **Primary action — 988 (US)**: a large, full-width call button (`tel:988`) labeled "Call 988 — Suicide & Crisis Lifeline". Secondary button "Text 988". Both use respectful, non-alarming copy and a softer color treatment (not destructive red — use `forest`/calm tones with a clear hierarchy).
3. **If in immediate danger** card — a single line directing to local emergency services (911 for US, with copy acknowledging international users: "or your local emergency number").
4. **More ways to get help** — a short, scannable list:
   - Crisis Text Line — text HOME to 741741
   - Trans Lifeline — 1-877-565-8860
   - Veterans Crisis Line — 988 then press 1
   - International: link to `findahelpline.com`
5. **Quiet footer** — "This isn't therapy. Mental Health Walk Club is a community, not a clinical service." + link to `/privacy`.

No nav clutter, no settings, no upsells. A simple `← Back` chevron returns to wherever they came from (`router.history.back()`).

Wire-up:
- `src/routes/more.tsx` — change `Help & safety` row to `to="/support"` (drop the `hash="safety"`).
- `src/routes/settings.tsx` — leave the existing `#safety` block as a slimmer "Safety & support" card that simply links out to `/support` (so settings still surfaces it, but isn't the destination).
- Add a discreet `/support` link in the auth footer and in the journal compose sheet, since those are emotional-load moments.

## Other gaps worth closing in this pass

A. **Settings → "Membership" only appears for some**. The `BillingCard` already handles plus vs. free, but for free users the section header reads "Membership" with a Plus pitch — that's fine. Verify the card renders something useful when signed-in-but-free; no change expected, just a spot check.

B. **Appearance card promises a theme switcher that doesn't switch themes** ("Theme support is rolling out. Preference is saved."). Two options — pick one:
   - **Recommended:** remove the Appearance card from `/settings` for v1. Shipping a control that doesn't do anything erodes trust.
   - Alternative: wire it up to toggle a `dark` class on `<html>` (small lift, but out of scope unless you want it).

C. **Notifications card** has the same shape — toggles persist to `localStorage` but nothing reads them yet. Keep it (it's harmless and signals intent), but add a single line: "We'll honor these the moment notifications turn on." Slightly more honest than the current copy.

D. **More → "Circles & friends"** links to `/circles`, which lives under `_authenticated`. Confirm the route exists and the link types resolve (it does — `src/routes/_authenticated/circles.tsx`). No code change; flagged so we don't ship a dead link.

E. **More → "Events"** links to `/events`. Confirm `/events` index renders something meaningful for a brand-new user (empty state vs. a wall of nothing). Out of scope to redesign, but worth a quick check in the same pass — if it's barren, hide the row behind a flag for v1.

F. **Profile's "Edit profile" sheet vs. Settings → Account** — two places edit the same fields. Keep both (people tap their name to edit; people who land in Settings expect a form), but make sure both write through the same patch shape (they do today). No change.

G. **Sign out lives in both /more and /settings**. That's fine — both are reasonable spots — but the **delete account** flow only lives in /settings. Good. No change.

H. **Admin row** shows in both /more and /settings for admins. Keep /settings (canonical), drop the row from /more's Account section to reduce noise. Admins know where to find it.

## Files touched

- **NEW** `src/routes/support.tsx` — the dedicated crisis-support page (~120 lines, no data loading, static content, server-safe).
- `src/routes/more.tsx` — repoint Help & safety row to `/support`; remove the Admin row from Account (admins still reach it via /settings).
- `src/routes/settings.tsx` — slim the inline Safety block to a single link to `/support`; remove Appearance card (B above); soften Notifications copy.
- `src/routes/auth.tsx` — add a small "In crisis? Get help" link in the footer.
- `src/components/home/reflection-write-sheet.tsx` (or wherever the journal compose lives) — add a discreet support link near the bottom of the sheet. Will confirm exact file before editing.

## Out of scope

- Theming system, real notification delivery, redesigning Events/Circles indices, any backend changes. This is a flow & finish pass only.

## Open questions

1. **Appearance card**: remove for v1 (my recommendation) or wire up a real dark mode toggle now?
2. **Support page**: US-first 988 with international links below, or lead with a region detector? US-first is faster to ship and the audience skew supports it — I'd recommend that.
3. **Admin row in /more**: OK to remove, or keep it for one-tap access for you while testing?