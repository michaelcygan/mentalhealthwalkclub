
-- 1. membership_settings (singleton)
CREATE TABLE public.membership_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  saved_reads_cap int NOT NULL DEFAULT 15,
  playlists_cap int NOT NULL DEFAULT 3,
  collections_follow_cap int NOT NULL DEFAULT 5,
  patron_min_cents int NOT NULL DEFAULT 300,
  patron_suggested_amounts int[] NOT NULL DEFAULT ARRAY[300, 500, 1000, 2500],
  patron_signups_paused boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.membership_settings (id) VALUES (true);

GRANT SELECT ON public.membership_settings TO anon, authenticated;
GRANT ALL ON public.membership_settings TO service_role;

ALTER TABLE public.membership_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read membership settings"
  ON public.membership_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can update membership settings"
  ON public.membership_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_membership_settings_updated_at
  BEFORE UPDATE ON public.membership_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. patron_profile
CREATE TABLE public.patron_profile (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_on_wall boolean NOT NULL DEFAULT false,
  early_access boolean NOT NULL DEFAULT true,
  monthly_amount_cents int NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.patron_profile TO authenticated;
GRANT SELECT ON public.patron_profile TO anon;
GRANT ALL ON public.patron_profile TO service_role;

ALTER TABLE public.patron_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read opted-in patron walls"
  ON public.patron_profile FOR SELECT
  USING (display_on_wall = true OR auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Patrons manage their own row"
  ON public.patron_profile FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_patron_profile_updated_at
  BEFORE UPDATE ON public.patron_profile
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. subscriptions: add patron-aware columns
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS monthly_amount_cents int,
  ADD COLUMN IF NOT EXISTS subscription_kind text NOT NULL DEFAULT 'plus';

-- 4. user_membership helper
CREATE OR REPLACE FUNCTION public.user_membership(_user uuid, _env text DEFAULT 'live')
RETURNS TABLE (
  is_plus boolean,
  is_patron boolean,
  patron_cents int,
  plus_interval text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH plus AS (
    SELECT s.price_id,
           (s.status IN ('active','trialing','past_due')
              AND (s.current_period_end IS NULL OR s.current_period_end > now()))
           OR (s.status = 'canceled' AND s.current_period_end > now()) AS active
    FROM public.subscriptions s
    WHERE s.user_id = _user
      AND s.environment = _env
      AND s.subscription_kind = 'plus'
    ORDER BY s.created_at DESC
    LIMIT 1
  ),
  patron AS (
    SELECT s.monthly_amount_cents,
           (s.status IN ('active','trialing','past_due')
              AND (s.current_period_end IS NULL OR s.current_period_end > now()))
           OR (s.status = 'canceled' AND s.current_period_end > now()) AS active
    FROM public.subscriptions s
    WHERE s.user_id = _user
      AND s.environment = _env
      AND s.subscription_kind = 'patron'
    ORDER BY s.created_at DESC
    LIMIT 1
  )
  SELECT
    COALESCE((SELECT active FROM plus), false) AS is_plus,
    COALESCE((SELECT active FROM patron), false) AS is_patron,
    COALESCE((SELECT monthly_amount_cents FROM patron WHERE active), 0) AS patron_cents,
    CASE
      WHEN (SELECT price_id FROM plus WHERE active) = 'plus_yearly' THEN 'yearly'
      WHEN (SELECT price_id FROM plus WHERE active) = 'plus_monthly' THEN 'monthly'
      ELSE NULL
    END AS plus_interval;
$$;
