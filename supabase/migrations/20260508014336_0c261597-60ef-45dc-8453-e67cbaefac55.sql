-- Grant facilitator role + approved profile to the current single user
INSERT INTO public.user_roles (user_id, role)
VALUES ('331a8662-223a-42c2-8fc9-200923b7339b', 'facilitator')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.facilitator_profiles (user_id, status, approved_at, bio)
VALUES ('331a8662-223a-42c2-8fc9-200923b7339b', 'approved', now(), 'Founding facilitator')
ON CONFLICT (user_id) DO UPDATE SET status = 'approved', approved_at = COALESCE(public.facilitator_profiles.approved_at, now());