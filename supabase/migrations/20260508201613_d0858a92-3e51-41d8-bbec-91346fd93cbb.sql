ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS cover_set TEXT,
  ADD COLUMN IF NOT EXISTS cover_credit TEXT;

UPDATE public.groups SET cover_set = slug WHERE slug IN (
  'chapter-nyc','chapter-la','chapter-bay-area','chapter-chicagoland',
  'chapter-seattle','chapter-miami','london-chapter','chapter-boston'
);