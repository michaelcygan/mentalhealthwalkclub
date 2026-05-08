
REVOKE ALL ON FUNCTION public.get_leaderboard(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_rank(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_rank(text, uuid) TO authenticated;
