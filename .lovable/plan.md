# Walk Club → App Store launch via Despia (final plan)

Decisions captured:
- **Bundle ID:** `com.despia.mentalhealthwalkclub` (from your Despia dashboard screenshot — that's it, locked).
- **App Start URL:** `https://www.mentalhealthwalkclub.com` (already configured).
- **Plus pricing:** $4.99/mo + $39.99/yr (saves ~33%, yearly is the "generous" tier).
- **Privacy/Terms:** I draft generic-but-honest copy with strong "platform assumes no liability" language. Not legal advice — fine to swap later.
- **Notifications (v1):** walk reminders (opt-in), Walk & Talk start pings, RSVP confirmations, **announcements** (admin-broadcast).
- **Android steps:** ship with copy "Background step tracking is coming soon to Android" — no Despia mention.
- **Despia handles store submission** — no Apple Developer / Play Console accounts needed from you. That removes Phases C–E from my earlier plan.

---

## What Despia gives us (confirmed from their docs)

| Capability | Despia bridge | Used for |
|---|---|---|
| Real pedometer (background, screen-off) | **Apple HealthKit** read | Solves your #1 ask on iOS |
| Background GPS w/ interval + distance | `gps-location` | Distance tracking with screen locked |
| Background audio + lock-screen controls | `audio-player` | Music/podcast keeps playing when phone is locked |
| In-app purchases (App Store + Play) | **RevenueCat** bridge | Apple-compliant Plus subscriptions |
| Push notifications | **OneSignal** bridge | The 4 notification types above |
| Sign in with Apple (required by Apple if Google is offered) | `oauth/apple` | Native Face ID sign-in |
| Native Google sign-in (works in webview) | `oauth/google` | Replaces fragile webview OAuth |
| Universal/app links | `deeplinking` | `mentalhealthwalkclub.com/w/CODE` opens the app |
| Native runtime detection | `despia.uuid`, UA flag | Branch UI (RevenueCat vs Stripe, etc.) |
| OTA updates | Built-in | UI/logic ships instantly via web — no re-submission |

> Android Health Connect bridge is "coming soon" per Despia; that's why Android v1 ships with the disclaimer.

---

## What I'll build (in order)

### Phase A — Compliance pages + safety net
1. **`/privacy` route** — generic-but-honest copy covering: what we collect (account, walks, location during walks, health/steps, audio for Walk & Talk, push tokens), how it's used, third parties (auth, payments, push), user rights (export, delete), kids policy, contact email. Includes "**Mental Health Walk Club is not a medical service. The platform assumes no liability for any decisions, injuries, or outcomes related to use of the app, including walks, audio rooms, or community interactions.**"
2. **`/terms` route** — eligibility, account rules, acceptable use (no harassment, no harmful content in Walk & Talk), subscription terms (auto-renew, cancel anytime, refunds via store), termination, **disclaimer of warranties + limitation of liability** (broad), governing law placeholder.
3. Footer links to both from `__root.tsx` and a "Legal" section in `/profile`.
4. **"Delete my account"** button in `/profile` → server fn that revokes auth user via `supabaseAdmin.auth.admin.deleteUser` and lets RLS cascades clean owned rows. Two-step confirm dialog.
5. **Sign in with Apple** added to `/auth`. Web first using Supabase OAuth, then Despia bridge for native (same `signInWithIdToken` flow as Google).

### Phase B — Despia SDK wrapper + native branches
1. `bun add despia-native`.
2. `src/lib/despia.ts` — typed wrapper: `isNative()`, `getStoreLocation()`, `requestPushPermission()`, `getStepsSince(date)`, `startBackgroundGps(opts)`, `playNativeAudio(url, meta)`, `openRevenueCatPaywall()`, `openAppleAuth()`, `openGoogleAuth()`. Each is a thin call to the Despia scheme (`healthkit://`, `gps://`, etc.) with web no-op fallbacks.
3. `useIsNative()` hook so components can branch.

### Phase C — Steps, GPS, audio (the user-visible wins)
1. **`src/hooks/use-step-counter.ts`** — when `isNative()` and iOS, query HealthKit for steps since walk start (poll every 30s + once on walk end). Else keep `devicemotion`. On Android-native, show "Steps tracked while walk is open. Background tracking coming soon."
2. **Background GPS during active walks** — start in `walk-runtime.tsx` walk-start, stop on end. Server endpoint `/api/public/walk-position` writes to existing `walk_positions` (or new minimal table if absent — I'll check).
3. **Native audio player** — in `walk-runtime.tsx`, when `isNative()`, route podcast + music playback through Despia's `audio-player` scheme with `{ title, artist, artworkUrl }` metadata for lock-screen controls. Web/desktop keeps the existing `<audio>` element. Pause/skip controls call the bridge.

### Phase D — Plus on mobile via RevenueCat (Apple-compliant)
1. Set up RevenueCat project, mirror two products:
   - `walk_club_plus_monthly` — $4.99/mo, 30-day trial
   - `walk_club_plus_yearly` — $39.99/yr, 30-day trial
   - Single entitlement `plus`.
2. **Mobile branch in `BillingCard` + `PlusCheckout`**: when `isNative()`, render a native paywall via `revenuecat://paywall` instead of Stripe Checkout. Hide "Update payment method" / "Open billing portal" — those happen in iOS Settings; show "Manage in App Store" deep link instead.
3. **Webhook**: `/api/public/hooks/revenuecat` verifies RC's auth header, upserts entitlement into the same `subscriptions` table Stripe writes to (new `gateway: 'revenuecat' | 'stripe'` column), so `has_active_subscription` RPC keeps working unchanged.
4. Map `app_user_id` = Supabase `auth.uid()` so subscription follows the account.
5. Keep Stripe path live for web/desktop users.

### Phase E — Notifications via OneSignal
1. OneSignal project + iOS/Android push certs (Despia handles cert upload).
2. Init OneSignal on app open (native only); call `setExternalUserId(user.id)` on sign-in, clear on sign-out.
3. **Triggers** (server-side, via OneSignal REST):
   - **Walk reminder** — opt-in daily reminder at user-chosen time. Add `notif_walk_reminder_at` to `profiles`; existing cron job sends.
   - **Walk & Talk start ping** — when a room user RSVP'd to opens, send 5-min-before push.
   - **RSVP confirmation** — immediate push when user RSVPs to a Local walk.
   - **Announcement** — admin-only screen at `/admin/announcements` to broadcast a title+body+optional URL to all (or filtered) users. New `announcements` table for history.

### Phase F — Native auth + deep links
1. Mobile branch in `/auth`: use Despia OAuth bridges for Google + Apple, exchange returned ID token with `supabase.auth.signInWithIdToken({ provider, token })`.
2. Universal/app links for `/w/$code`, `/events/$slug`, `/groups/$slug` — register domains in Despia editor.

### Phase G — Despia editor checklist (you click these)
```text
[ ] Bundle ID: com.despia.mentalhealthwalkclub  ✓ already set
[ ] App Start URL: https://www.mentalhealthwalkclub.com  ✓ already set
[ ] Toggle bridges: HealthKit, Background Location, Audio Player,
    RevenueCat, OneSignal, OAuth (Apple+Google), Push, Deeplinking
[ ] Privacy strings (1 sentence each):
    - Location: "Used to track your walk distance and route."
    - Health:   "Used to count your steps during walks."
    - Mic:      "Used for Walk & Talk live audio rooms."
    - Notifs:   "Walk reminders, RSVP confirmations, and announcements."
[ ] External-link allowlist: accounts.google.com, appleid.apple.com,
    *.supabase.co, api.revenuecat.com, onesignal.com
[ ] Upload 1024×1024 icon (I'll generate from the brand mark)
[ ] Submit via Despia → they handle App Store + Play submission
```

### Phase H — Post-launch
- Most fixes ship via OTA (web deploy → app picks up next open).
- Monitor: RevenueCat dashboard (subs), OneSignal (delivery rate), Supabase logs (errors).
- v1.1 candidates: Android Health Connect (when Despia ships it), home widgets, Siri shortcuts, Apple Watch.

---

## Files I'll create / change

**New**
- `src/routes/privacy.tsx`, `src/routes/terms.tsx`
- `src/routes/admin.announcements.tsx`
- `src/lib/despia.ts`, `src/hooks/use-is-native.ts`
- `src/lib/account.functions.ts` (delete account)
- `src/lib/revenuecat.functions.ts`
- `src/routes/api/public/hooks/revenuecat.ts`
- `src/lib/notifications.functions.ts` (OneSignal send helpers)

**Edited**
- `src/routes/__root.tsx` — footer legal links
- `src/routes/auth.tsx` — Apple Sign In + native OAuth branch
- `src/routes/profile.tsx` — Delete account, Manage in App Store on iOS, reminder time picker
- `src/components/billing/billing-card.tsx`, `plus-checkout.tsx` — native paywall branch + yearly option
- `src/hooks/use-step-counter.ts` — HealthKit branch
- `src/lib/walk-runtime.tsx` — background GPS + native audio routing
- `src/lib/auth-context.tsx` — set OneSignal external user id on sign-in

**Database (migration)**
- `subscriptions.gateway text default 'stripe'`
- `subscriptions` already keyed by user — add unique on `(user_id, gateway)` if needed
- `profiles.notif_walk_reminder_at time`, `profiles.notif_push_token text`
- `announcements (id, title, body, url, sent_at, created_by)` + admin-only RLS

**Secrets to add later** (I'll prompt at the right phase):
- `REVENUECAT_API_KEY` (server)
- `REVENUECAT_WEBHOOK_AUTH` (shared secret in webhook header)
- `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_KEY`
- `VITE_REVENUECAT_PUBLIC_KEY`, `VITE_ONESIGNAL_APP_ID` (client)

---

## Privacy/Terms scope (so you know what you're approving)

Plain-English first-person draft, ~1200 words each, headings, no legalese, but with strong liability language. Examples I'll include verbatim:

> **Not medical advice.** Mental Health Walk Club is a wellness and community app. It is not a substitute for professional medical, psychological, or psychiatric care. Nothing in the app — including content from facilitators, other walkers, podcasts, or audio rooms — constitutes medical advice. If you are in crisis, contact emergency services or a crisis line.

> **Assumption of risk.** Walking, meeting other users in person, and participating in live audio rooms carry inherent risks. You participate at your own risk. The platform, its operators, and contributors assume no liability for any injury, loss, harm, or damage — physical, emotional, financial, or otherwise — arising from your use of the app or interactions with other users.

> **Limitation of liability.** To the maximum extent permitted by law, the platform's total liability to you for any claim is limited to the amount you paid us in the prior twelve months, or $50, whichever is greater.

You'll see them as draft routes — easy to edit before launch.

---

## Out of scope for v1 (call out for later)
- Apple Watch companion, home widgets, Siri shortcuts
- Android Health Connect (waiting on Despia)
- Apple Sign-In on web (mobile only first; web stays Google + email)
- Promotional offers / family sharing in App Store

---

## Open questions before I start
None — I have what I need. Approve and I'll execute Phases A → G in order, pausing only when secrets are needed.
