-- Add gateway column to subscriptions so RevenueCat (mobile IAP) rows live
-- alongside Stripe (web) rows without breaking has_active_subscription.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS gateway text NOT NULL DEFAULT 'stripe';

-- RevenueCat doesn't issue stripe_subscription_id values; allow null and
-- make uniqueness gateway-scoped.
ALTER TABLE public.subscriptions
  ALTER COLUMN stripe_subscription_id DROP NOT NULL;

-- Drop the old global unique on stripe_subscription_id if it exists,
-- replace with a partial unique scoped to Stripe rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_stripe_subscription_id_key'
  ) THEN
    ALTER TABLE public.subscriptions
      DROP CONSTRAINT subscriptions_stripe_subscription_id_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_sub_unique
  ON public.subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- One active RevenueCat sub per (user, environment).
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_revenuecat_unique
  ON public.subscriptions (user_id, environment)
  WHERE gateway = 'revenuecat';

-- Announcements table (used in Phase E too; cheap to create now).
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Announcements readable by signed-in users"
  ON public.announcements FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage announcements"
  ON public.announcements FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
