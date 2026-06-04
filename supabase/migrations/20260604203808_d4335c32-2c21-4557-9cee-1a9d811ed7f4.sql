ALTER TABLE public.impact_donations
  ADD CONSTRAINT impact_donations_period_unique UNIQUE (period_start, period_end);