## Goal

One unified entry flow — the welcome screen — that branches based on user choice. No separate `/welcome` and `/onboarding` routes. Sign-in is **always one tap away** at every step, in every state.

---

## The unified flow: `/` (signed-out) is a multi-slide welcome

When `!user`, `/` renders a **full-page slide flow** (not a modal) with persistent **"Sign in"** buttons at top header AND bottom of every slide's scroll. Slides advance with arrows / swipe / Continue button.

```
                    ┌──── (any slide) ────┐
                    │   "Sign in" → auth   │
                    │   modal at any time  │
                    └──────────────────────┘

Slide 1: Welcome ───┬──> [Create account] ──> Slide 2a (signed-up fork)
(today's            │
 welcome popup      ├──> [Start free trial] ──> checkout ──> Slide 2a
 content)           │
                    └──> [Preview the app →] ──> Demo state
                                                  │
                                                  └─ persistent "Log in" pill
                                                     in top-right + demo banner
                                                     ──> back into auth at any time
                                                         (which then enters Slide 2a)

Signed-up fork (slides 2a → 5a):
  2a. Name yourself        (display_name)
  3a. Where you walking from?  (location)
  4a. What's been on your shoulders? (themes)
  5a. Find your people     (suggested groups, soft nudge)
  Final. "You're set. Take your first walk?"  (Start a walk / Maybe later)
```

**Off-ramps everywhere:**
- Every slide has a quiet **Skip** link (advances to next slide).
- Every slide has a **"Skip onboarding"** link in the corner (jumps to Final → home).
- Every slide has **Sign in** in the header (for returning users who landed in the flow by mistake).
- In demo state, a persistent **Log in** pill replaces the "create account" CTA when `wc_last_auth` is present.

## Key consolidation point (this addresses your concern)

There is **one flow component** (`<EntryFlow />`) with a `step` state machine. The "welcome popup" content IS slide 1 of the same flow — not a separate modal. Today's `/welcome` route's location/themes/comfort questions become slides 3a/4a of the same flow (no second route, no second visual language).

- Old `/welcome` route → redirects into `/` flow (or is deleted; new users go straight from signup into the next slide of the same flow they were already in).
- The slide index persists in `sessionStorage` so a refresh mid-flow resumes where they were.
- Comfort question (Walk & Talk listener/talker) is **kept in the flow** as a one-tap choice on slide 4a (added next to themes), since you flagged removing it as a concern. Themes + comfort on the same slide keeps it to 4 collected-data slides.

## Demo state — same flow, different fork

Choosing "Preview the app →" doesn't leave the flow conceptually — it sets `sessionStorage: wc_demo_mode = "1"` and renders the real `WalkTab` shell with seeded generic data (Jordan, neutral landscape photos, one distant group shot). Persistent UI that ties demo back to the flow:

- Top-right pill: **Log in** (or **Create account** if no `wc_last_auth`).
- Top banner: "Previewing as Jordan — Make it yours" + dismissible.
- Mobile tab bar: replaces Profile tab with Create account.
- Every write action (`Start a walk`, `Save to journal`, `RSVP`, `Join group`, `Join Walk & Talk`) opens the auth sheet via `requireAuth()` with contextual reason copy. After successful auth, the user is dropped into Slide 2a of the same flow (so onboarding picks up where signup left off).

## Returning-user behavior

- `localStorage: wc_last_auth = "email" | "google" | …` set on every successful auth.
- If present and signed-out: header **Sign in** button is the primary affordance (label: "Welcome back — Sign in"); Create account becomes secondary.
- This makes the entry screen double as the **log-in page**.

## State persistence

- `sessionStorage: wc_flow_step` — current slide index (0–5).
- `sessionStorage: wc_demo_mode` — `"1"` while previewing.
- `localStorage: wc_seen_welcome` — collapses Slide 1's long form to a condensed hero on repeat visits.
- `profiles.onboarded_at` — set when user reaches the Final slide (or hits "Skip onboarding"). Skips slides 2a–5a on next sign-in.

## Slide-by-slide detail

| # | State | Content | Primary CTAs | Off-ramps |
|---|---|---|---|---|
| 1 | Signed-out | Logo, tagline, Four ways to walk grid, plan picker (Free / Plus) | Create account · Start free trial · Preview the app | Sign in (header + footer) |
| 2a | Signed-in, !onboarded | "What should we call you?" | Continue (display_name) | Skip · Skip onboarding |
| 3a | " | Location autosuggest | Continue | Skip · Skip onboarding |
| 4a | " | Themes chips + comfort one-tap (listener / sometimes / talker) | Continue | Skip · Skip onboarding |
| 5a | " | 3–6 suggested groups (theme + location ranked) with one-tap Join + small search | Continue | Skip · Skip onboarding |
| Final | " | "You're set. Take your first walk?" | Start a walk · Maybe later — go home | — |

Soft-gating: pulsing arrow on the primary CTA stays until tapped or Skip pressed. No hard block.

---

## Files

**New:**
- `src/components/entry-flow/entry-flow.tsx` — the slide state machine (rendered by `/` when `!user || !onboarded`)
- `src/components/entry-flow/slides/{welcome,name,location,themes,groups,first-walk}.tsx`
- `src/components/entry-flow/{flow-header,flow-footer,pulse-arrow,sign-in-pill}.tsx` — shared chrome with persistent Sign in / Skip
- `src/components/demo-banner.tsx`
- `src/hooks/use-demo-mode.ts`
- `src/hooks/use-entry-flow.ts` — step state + sessionStorage persistence + last-auth memory
- `src/lib/demo-data.ts` — Jordan + sample walks/photos/groups (generic, no faces except one distant group shot)

**Edit:**
- `src/routes/index.tsx` — branch: signed-in→WalkTab; signed-out OR (signed-in & !onboarded)→`<EntryFlow />`; demo mode→WalkTab with sample data
- `src/lib/auth-prompt.tsx` — remove auto-modal; keep openAuth (called by Sign in pill); after auth, set flow step to 2a; keep checkout-after-signup
- `src/components/welcome-dialog.tsx` — repurpose its content into Slide 1
- `src/components/mobile-tab-bar.tsx` — demo-mode swap (Profile → Create account)
- `src/lib/auth-context.tsx` — on sign-in, fetch `profiles.onboarded_at`; pass to flow
- `src/routes/welcome.tsx` — delete (or redirect to `/`)

**Migration:** add `profiles.onboarded_at timestamptz`.

No other schema or RLS changes. Suggested groups read from existing `groups`; joins use existing `group_memberships` policies.