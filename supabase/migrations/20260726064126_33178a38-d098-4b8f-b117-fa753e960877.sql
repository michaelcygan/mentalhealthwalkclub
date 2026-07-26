
-- =====================================================================
-- Wave 1: Unified Plus + 988 Transparency foundations
-- =====================================================================

-- 1) Extend subscriptions with allocation + dedication fields ---------
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS selected_total_cents integer,
  ADD COLUMN IF NOT EXISTS membership_allocation_cents integer,
  ADD COLUMN IF NOT EXISTS donation_allocation_cents integer,
  ADD COLUMN IF NOT EXISTS stripe_base_item_id text,
  ADD COLUMN IF NOT EXISTS stripe_donation_item_id text,
  ADD COLUMN IF NOT EXISTS dedication_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS honoree_name text,
  ADD COLUMN IF NOT EXISTS dedication_message text,
  ADD COLUMN IF NOT EXISTS public_donor_name text,
  ADD COLUMN IF NOT EXISTS display_donation_publicly boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allocation_model_version text,
  ADD COLUMN IF NOT EXISTS allocation_model_cutover_at timestamptz;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_dedication_type_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_dedication_type_check
    CHECK (dedication_type IN ('none','in_honor_of','in_memory_of','gift'));

-- 2) donation_allocations (immutable ledger) --------------------------
CREATE TABLE IF NOT EXISTS public.donation_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  currency text NOT NULL DEFAULT 'usd',

  stripe_event_id text NOT NULL UNIQUE,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_subscription_id text,

  gross_payment_cents integer NOT NULL,
  membership_allocation_cents integer NOT NULL DEFAULT 0,
  donation_allocation_cents integer NOT NULL DEFAULT 0,
  processing_fee_cents integer,

  status text NOT NULL DEFAULT 'designated',
  paid_at timestamptz NOT NULL DEFAULT now(),
  transferred_at timestamptz,
  transfer_batch_id uuid,

  dedication_type text NOT NULL DEFAULT 'none',
  honoree_name text,
  dedication_message text,

  public_donor_name text,
  display_publicly boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT donation_allocations_source_check CHECK (source IN
    ('plus_overage','one_time_contribution','legacy_supporter','legacy_plus_commitment')),
  CONSTRAINT donation_allocations_status_check CHECK (status IN
    ('designated','transferred','refunded','partially_refunded','disputed','reversed')),
  CONSTRAINT donation_allocations_dedication_check CHECK (dedication_type IN
    ('none','in_honor_of','in_memory_of','gift'))
);

CREATE INDEX IF NOT EXISTS idx_donation_allocations_env_status ON public.donation_allocations(environment, status);
CREATE INDEX IF NOT EXISTS idx_donation_allocations_batch ON public.donation_allocations(transfer_batch_id);
CREATE INDEX IF NOT EXISTS idx_donation_allocations_paid_at ON public.donation_allocations(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_donation_allocations_user ON public.donation_allocations(user_id);

GRANT SELECT ON public.donation_allocations TO authenticated;
GRANT ALL ON public.donation_allocations TO service_role;

ALTER TABLE public.donation_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own allocations" ON public.donation_allocations;
CREATE POLICY "Users read own allocations" ON public.donation_allocations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all allocations" ON public.donation_allocations;
CREATE POLICY "Admins read all allocations" ON public.donation_allocations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service role manages allocations" ON public.donation_allocations;
CREATE POLICY "Service role manages allocations" ON public.donation_allocations
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS trg_donation_allocations_updated_at ON public.donation_allocations;
CREATE TRIGGER trg_donation_allocations_updated_at
  BEFORE UPDATE ON public.donation_allocations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3) donation_transfer_batches ---------------------------------------
CREATE TABLE IF NOT EXISTS public.donation_transfer_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL DEFAULT 'sandbox',
  organization_name text NOT NULL,
  organization_url text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  receipt_storage_path text,
  notes text,
  transferred_at timestamptz,
  published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT donation_transfer_batches_status_check CHECK (status IN ('draft','transferred','verified'))
);

CREATE INDEX IF NOT EXISTS idx_donation_transfer_batches_env ON public.donation_transfer_batches(environment, published);

GRANT SELECT ON public.donation_transfer_batches TO anon, authenticated;
GRANT ALL ON public.donation_transfer_batches TO service_role;

ALTER TABLE public.donation_transfer_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads published batches" ON public.donation_transfer_batches;
CREATE POLICY "Public reads published batches" ON public.donation_transfer_batches
  FOR SELECT USING (published = true);

DROP POLICY IF EXISTS "Admins read all batches" ON public.donation_transfer_batches;
CREATE POLICY "Admins read all batches" ON public.donation_transfer_batches
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage batches" ON public.donation_transfer_batches;
CREATE POLICY "Admins manage batches" ON public.donation_transfer_batches
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_donation_transfer_batches_updated_at ON public.donation_transfer_batches;
CREATE TRIGGER trg_donation_transfer_batches_updated_at
  BEFORE UPDATE ON public.donation_transfer_batches
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- FK for transfer_batch_id (after batches table exists)
ALTER TABLE public.donation_allocations
  DROP CONSTRAINT IF EXISTS donation_allocations_batch_fk;
ALTER TABLE public.donation_allocations
  ADD CONSTRAINT donation_allocations_batch_fk
    FOREIGN KEY (transfer_batch_id) REFERENCES public.donation_transfer_batches(id) ON DELETE SET NULL;

-- 4) radio_monthly_usage ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.radio_monthly_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_start date NOT NULL,
  seconds_used integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month_start)
);

GRANT SELECT ON public.radio_monthly_usage TO authenticated;
GRANT ALL ON public.radio_monthly_usage TO service_role;

ALTER TABLE public.radio_monthly_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own radio usage" ON public.radio_monthly_usage;
CREATE POLICY "Users read own radio usage" ON public.radio_monthly_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages radio usage" ON public.radio_monthly_usage;
CREATE POLICY "Service role manages radio usage" ON public.radio_monthly_usage
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.increment_radio_usage(_user uuid, _seconds integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m date := date_trunc('month', (now() at time zone 'utc'))::date;
  new_total integer;
BEGIN
  IF _user IS NULL OR _user <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _seconds IS NULL OR _seconds < 0 OR _seconds > 180 THEN
    RAISE EXCEPTION 'invalid seconds increment';
  END IF;
  INSERT INTO public.radio_monthly_usage (user_id, month_start, seconds_used, updated_at)
  VALUES (_user, m, _seconds, now())
  ON CONFLICT (user_id, month_start)
  DO UPDATE SET seconds_used = public.radio_monthly_usage.seconds_used + EXCLUDED.seconds_used,
                updated_at = now()
  RETURNING seconds_used INTO new_total;
  RETURN new_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_radio_usage(uuid, integer) TO authenticated;

-- 5) Extend membership_settings --------------------------------------
ALTER TABLE public.membership_settings
  ADD COLUMN IF NOT EXISTS plus_base_cents integer NOT NULL DEFAULT 299,
  ADD COLUMN IF NOT EXISTS plus_max_monthly_cents integer NOT NULL DEFAULT 100000,
  ADD COLUMN IF NOT EXISTS radio_free_seconds integer NOT NULL DEFAULT 18000,
  ADD COLUMN IF NOT EXISTS donation_org_name text NOT NULL DEFAULT '988 Suicide & Crisis Lifeline',
  ADD COLUMN IF NOT EXISTS donation_org_url text NOT NULL DEFAULT 'https://988lifeline.org/donate/',
  ADD COLUMN IF NOT EXISTS allocation_model_cutover_at timestamptz NOT NULL DEFAULT now();

-- 6) Public transparency functions -----------------------------------

CREATE OR REPLACE FUNCTION public.transparency_totals(_env text DEFAULT 'live')
RETURNS TABLE (
  designated_cents bigint,
  transferred_cents bigint,
  awaiting_cents bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN status IN ('designated','transferred') THEN donation_allocation_cents ELSE 0 END),0)::bigint AS designated_cents,
    COALESCE(SUM(CASE WHEN status = 'transferred' THEN donation_allocation_cents ELSE 0 END),0)::bigint AS transferred_cents,
    COALESCE(SUM(CASE WHEN status = 'designated' AND transfer_batch_id IS NULL THEN donation_allocation_cents ELSE 0 END),0)::bigint AS awaiting_cents
  FROM public.donation_allocations
  WHERE environment = _env
    AND donation_allocation_cents > 0;
$$;

GRANT EXECUTE ON FUNCTION public.transparency_totals(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.transparency_feed(_env text DEFAULT 'live', _limit integer DEFAULT 100)
RETURNS TABLE (
  paid_at timestamptz,
  public_donor_name text,
  donation_cents integer,
  source text,
  dedication_type text,
  honoree_name text,
  dedication_message text,
  status text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    paid_at,
    CASE WHEN display_publicly THEN COALESCE(public_donor_name, 'Anonymous') ELSE 'Anonymous' END AS public_donor_name,
    donation_allocation_cents AS donation_cents,
    source,
    CASE WHEN display_publicly THEN dedication_type ELSE 'none' END AS dedication_type,
    CASE WHEN display_publicly THEN honoree_name ELSE NULL END AS honoree_name,
    CASE WHEN display_publicly THEN dedication_message ELSE NULL END AS dedication_message,
    status
  FROM public.donation_allocations
  WHERE environment = _env
    AND donation_allocation_cents > 0
    AND status IN ('designated','transferred')
  ORDER BY paid_at DESC
  LIMIT LEAST(GREATEST(_limit, 1), 500);
$$;

GRANT EXECUTE ON FUNCTION public.transparency_feed(text, integer) TO anon, authenticated;

-- 7) Prevent legacy accounting drift: set cutover on any future rows -
COMMENT ON COLUMN public.subscriptions.allocation_model_version IS
  'plus_overage_v1 for new unified Plus; NULL for legacy rows.';
