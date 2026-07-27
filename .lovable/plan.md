## Rename "MHWC Radio" / "MHWC stations" → "Radio"

Replace every user-facing occurrence with just "Radio". Handle the two grammar cases:

- `unlimited MHWC Radio` → `unlimited Radio`
- `listen to MHWC Radio` → `listen to Radio`
- `MHWC stations` → `Radio`

### Files to edit (all string replacements, no logic changes)

- `public/manifest.webmanifest` — description
- `src/routes/transparency.tsx` — lines 81, 218
- `src/routes/terms.tsx` — line 63
- `src/routes/impact.tsx` — lines 12, 94, 162, 200
- `src/routes/auth.tsx` — lines 25, 28, 69 (`sub="MHWC stations"` → `sub="Stations & shows"` or similar; see note)
- `src/components/auth-form.tsx` — lines 194, 195, 230
- `src/components/billing/plus-amount-picker.tsx` — lines 32 (comment), 111
- `src/components/billing/billing-card.tsx` — line 150
- `src/lib/auth-prompt.tsx` — line 122

### One judgment call

`auth.tsx:69` shows a tile: `label="Radio" sub="MHWC stations"`. If we just drop "MHWC" the sub becomes "stations" which reads thin next to a label already saying "Radio". I'll change the sub to **"Stations & shows"** so the tile stays informative. If you'd rather just kill the sub entirely or use a different phrase, say so.

No DB / schema / route / behavior changes.
