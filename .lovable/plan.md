## What's actually in the module today

You're right to ask. The current "A Small Question" prompts come from `src/lib/reflection-prompts.ts` — a hand-written library of ~150 paraphrased prompts ("how do you recharge when people-time becomes too much?"). They were *inspired by* the spirit of the doc but are NOT the literal 100+ questions from `Mental Health Questions.docx` ("What is your favorite way to unwind after a stressful day?", "Share a self-care practice you swear by.", etc.). I'll swap in the doc's questions verbatim.

## Plan

### 1. Daily Reflections — rename + Write CTA

In `src/components/home/reflection-rotator.tsx`:
- Title eyebrow becomes **DAILY REFLECTION** (the card itself titled "Daily Reflections" in the Home tab).
- Replace the **Save** pill with **Write** (Pencil icon). Tapping it opens a writing sheet pre-filled with the current question as the prompt context.
- Shuffle pill stays.

### 2. Writing sheet → saves to Journal

Reuse shadcn `Sheet` (bottom sheet on mobile, side on desktop). Contents:
- Eyebrow: today's date
- The question (serif, italic)
- Auto-focused `<Textarea>` with placeholder "Start where you are…"
- Footer: character count (subtle), **Cancel** + **Save to journal** (primary). Cmd/Ctrl+Enter also saves.

On save: insert one row into a new `journal_entries` table, toast "Saved to your journal", close sheet. No mood selection required (keeps friction low) — they can edit/expand later in Journal.

### 3. New table — `journal_entries`

A lightweight standalone-entry table separate from `walk_sessions` (which is walk-scoped).

```text
journal_entries
  id uuid pk
  user_id uuid → auth.users (cascade)
  prompt_text text       -- the question that was on screen (nullable for free entries)
  prompt_id   text        -- e.g. "q_042" so we can avoid repeats over time
  body        text not null
  source      text       -- 'home_reflection' | 'journal_freeform'
  created_at, updated_at
```
RLS: user can CRUD only their own rows. GRANT to authenticated + service_role.

### 4. Journal page — surface reflections

In `src/routes/journal.tsx`, add a new "Reflections" section above the walk Entries feed (only if any exist):
- Header "Reflections" with a "+ New" button that opens the same writing sheet (no preset prompt).
- List most recent 10 as small cards (date, prompt in muted serif, first 3 lines of body, tap to expand inline).
Walks feed stays exactly as-is.

### 5. Replace prompt library with the doc verbatim

Rewrite `src/lib/reflection-prompts.ts` so `PROMPTS` is the 100+ questions from `Mental Health Questions.docx`, in order, with stable ids `q_001…q_NNN` and `family: "universal"`, `depth: "reflecting"` (so the family/depth machinery still type-checks). Drop the paraphrased set. The home rotator continues to pick 5 per session via the existing seeded shuffle, so users see different questions on different visits but the underlying source is now the uploaded doc.

Note: this also means the heavier mood-targeted prompts used elsewhere (walk-end reflection screens, if any) will fall back to the universal pool — acceptable since the doc questions are designed to work for any mood.

## Files

- **Edited**: `src/components/home/reflection-rotator.tsx` (rename + Write CTA + sheet trigger), `src/lib/reflection-prompts.ts` (replace contents), `src/routes/index.tsx` (heading wording if any), `src/routes/journal.tsx` (Reflections section + "+ New" button)
- **New**: `src/components/home/reflection-write-sheet.tsx` (shared writing sheet, used from Home and Journal), `src/lib/journal-entries.functions.ts` (create/list server fns using `requireSupabaseAuth`)
- **Migration**: `journal_entries` table + RLS + grants

## Out of scope

- Editing/deleting reflections inline (read-only list for v1; only Save flow + view)
- Mood tagging on a reflection
- Searching across reflections
- Push notifications / daily reminder to write