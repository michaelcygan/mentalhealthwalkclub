
ALTER TABLE public.patron_profile RENAME TO supporter_profile;
ALTER INDEX public.patron_profile_pkey RENAME TO supporter_profile_pkey;
ALTER TABLE public.supporter_profile RENAME CONSTRAINT patron_profile_user_id_fkey TO supporter_profile_user_id_fkey;

DROP POLICY IF EXISTS "Anyone can read opted-in patron walls" ON public.supporter_profile;
DROP POLICY IF EXISTS "Patrons manage their own row" ON public.supporter_profile;
CREATE POLICY "Anyone can read opted-in supporter walls"
  ON public.supporter_profile FOR SELECT
  USING (display_on_wall = true OR auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Supporters manage their own row"
  ON public.supporter_profile FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.membership_settings RENAME COLUMN patron_min_cents TO supporter_min_cents;
ALTER TABLE public.membership_settings RENAME COLUMN patron_suggested_amounts TO supporter_suggested_amounts;
ALTER TABLE public.membership_settings RENAME COLUMN patron_signups_paused TO supporter_signups_paused;

UPDATE public.subscriptions SET subscription_kind = 'supporter' WHERE subscription_kind = 'patron';
UPDATE public.subscriptions SET price_id = 'supporter_custom' WHERE price_id = 'patron_custom';
