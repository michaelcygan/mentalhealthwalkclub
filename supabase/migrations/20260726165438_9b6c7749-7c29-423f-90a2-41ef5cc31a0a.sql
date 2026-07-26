-- Grant EXECUTE on SECURITY DEFINER policy helpers so RLS expressions can be
-- evaluated by anon (public reads), authenticated, and service_role.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_group_role(uuid, uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_circle_owner(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_circle_member(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_group_owner(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_event_host(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_in_event_allowlist(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_in_event_blocklist(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_following(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_mutual(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.age_band_meets(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.age_band_for(date) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.host_trust_ok(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_membership(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.follow_counts(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recompute_walker_metrics(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_radio_usage(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_my_dob(date) TO authenticated, service_role;