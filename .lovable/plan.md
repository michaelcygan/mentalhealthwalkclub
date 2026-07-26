## Ungate private text journaling for Free users

Surgical entitlement removal. No redesign, no photo/RLS/billing changes.

### Findings from inspection
- **RLS is already owner-only** — `journal_entries` policies (migration `20260609024318…`) do only `auth.uid() = user_id` checks. No subscription requirement present. **No migration needed.**
- **Plus gate is enforced in two places**:
  1. `src/lib/journal-entries.functions.ts` — local `requirePlus()` helper (lines 25–39) called inside `createJournalEntry` (line 46), throws `Error("plus_required")`.
  2. `src/components/home/reflection-write-sheet.tsx` — `useMembership`, `openPlusCheckout`, pre-save `!isPlus` redirect, "Save with Plus" button copy, `plus_required` error branch, `Sparkles` icon.
- **`requirePlus` in `src/lib/plus-guard.server.ts`** is a *separate* exported helper used elsewhere — leave it alone.
- **Copy audit**: no other UI strings gate basic text journaling behind Plus. `src/routes/auth.tsx` already frames the private journal as a free feature.
- **`src/routes/journal.tsx`** never references Plus for text entries; edit/delete/feed/stats already run over owner-scoped server fns.

### Changes

**1. `src/lib/journal-entries.functions.ts`**
- Remove the local `requirePlus` helper.
- Remove the `await requirePlus(...)` call inside `createJournalEntry`.
- Keep `requireSupabaseAuth` middleware and the existing `user_id = context.userId` insert.
- All other functions untouched.

**2. `src/components/home/reflection-write-sheet.tsx`**
- Remove imports: `Sparkles` (from lucide-react), `useMembership`, `useAuthPrompt`.
- Remove state: `isPlus`, `membershipLoading`, `openPlusCheckout`.
- Remove the pre-save `if (!isPlus)` redirect in `save()`.
- Remove the `msg.includes("plus_required")` branch in the catch.
- Save button:
  - Label: `saving ? "Saving…" : "Save to journal"`.
  - `disabled={!body.trim() || saving}`.
- Preserve: prompt shuffle/skip, freeform writing, draft autosave (`draftKey`, localStorage), Cmd/Ctrl+Enter save, textarea auto-grow, toast on success.

**3. Database** — no migration. Existing policies already meet the "authenticated owner-only CRUD" requirement.

### Verification
- `bunx tsgo --noEmit`
- `bun run build`
- Grep for `plus_required` in `src/` → only expected remaining references (if any) will be outside the journal path; if the phrase is orphaned, remove it.
- Manual acceptance mapping:
  - Free user saves homepage prompt → `createJournalEntry` succeeds under `requireSupabaseAuth`.
  - Freeform entry from Journal → same server fn, `source: "journal_freeform"`.
  - Post-walk reflection → uses `updateWalkReflection` which never had a Plus gate.
  - Edit/delete/list → unchanged owner-scoped server fns.
  - Cross-user isolation → RLS policies unchanged.
  - Photo flow → not touched.
  - Plus users → identical UX; button copy is the same they'd have seen after upgrading.

### Out of scope (unchanged)
Walk-photo/event-photo upload, storage, compression, entitlements. Radio metering. Plus pricing/billing. `src/lib/plus-guard.server.ts`. Other `requirePlus` callers.
