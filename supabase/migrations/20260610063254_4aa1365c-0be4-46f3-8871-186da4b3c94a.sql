
DROP FUNCTION IF EXISTS public.user_membership(uuid, text);

CREATE OR REPLACE FUNCTION public.user_membership(_user uuid, _env text DEFAULT 'live'::text)
 RETURNS TABLE(is_plus boolean, is_supporter boolean, supporter_cents integer, plus_interval text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  supporter AS (
    SELECT s.monthly_amount_cents,
           (s.status IN ('active','trialing','past_due')
              AND (s.current_period_end IS NULL OR s.current_period_end > now()))
           OR (s.status = 'canceled' AND s.current_period_end > now()) AS active
    FROM public.subscriptions s
    WHERE s.user_id = _user
      AND s.environment = _env
      AND s.subscription_kind = 'supporter'
    ORDER BY s.created_at DESC
    LIMIT 1
  )
  SELECT
    COALESCE((SELECT active FROM plus), false) AS is_plus,
    COALESCE((SELECT active FROM supporter), false) AS is_supporter,
    COALESCE((SELECT monthly_amount_cents FROM supporter WHERE active), 0) AS supporter_cents,
    CASE
      WHEN (SELECT price_id FROM plus WHERE active) = 'plus_yearly' THEN 'yearly'
      WHEN (SELECT price_id FROM plus WHERE active) = 'plus_monthly' THEN 'monthly'
      ELSE NULL
    END AS plus_interval;
$function$;
