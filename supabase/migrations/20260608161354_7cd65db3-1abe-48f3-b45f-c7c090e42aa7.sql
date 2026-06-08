
-- ============== BLOG FEEDS ==============
CREATE TABLE public.blog_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rss_url text NOT NULL UNIQUE,
  title text,
  publisher text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_feeds TO authenticated;
GRANT ALL ON public.blog_feeds TO service_role;
ALTER TABLE public.blog_feeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blog_feeds_admin_manage" ON public.blog_feeds
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "blog_feeds_select_active" ON public.blog_feeds
  FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

-- ============== BLOG POSTS ==============
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id uuid NOT NULL REFERENCES public.blog_feeds(id) ON DELETE CASCADE,
  guid text NOT NULL,
  title text NOT NULL,
  summary text,
  link text NOT NULL,
  image_url text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (feed_id, guid)
);
CREATE INDEX blog_posts_pub_idx ON public.blog_posts (published_at DESC NULLS LAST);
GRANT SELECT ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blog_posts_select_active" ON public.blog_posts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.blog_feeds f WHERE f.id = blog_posts.feed_id AND f.is_active = true));
CREATE POLICY "blog_posts_admin_manage" ON public.blog_posts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============== HIGH FIVES ==============
CREATE TABLE public.high_fives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  walk_session_id uuid NOT NULL REFERENCES public.walk_sessions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_user_id, walk_session_id)
);
CREATE INDEX high_fives_to_user_idx ON public.high_fives (to_user_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.high_fives TO authenticated;
GRANT ALL ON public.high_fives TO service_role;
ALTER TABLE public.high_fives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "high_fives_insert_self" ON public.high_fives
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = from_user_id
    AND EXISTS (
      SELECT 1 FROM public.circle_members m1
      JOIN public.circle_members m2 ON m1.circle_id = m2.circle_id
      WHERE m1.user_id = auth.uid() AND m1.status = 'active'
        AND m2.user_id = high_fives.to_user_id AND m2.status = 'active'
    )
  );
CREATE POLICY "high_fives_select_participants" ON public.high_fives
  FOR SELECT TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "high_fives_delete_sender" ON public.high_fives
  FOR DELETE TO authenticated
  USING (auth.uid() = from_user_id);

-- ============== SEED BLOG FEEDS ==============
INSERT INTO public.blog_feeds (rss_url, title, publisher) VALUES
  ('https://medlineplus.gov/feeds/topics/mentalhealth.xml', 'MedlinePlus: Mental Health', 'MedlinePlus'),
  ('https://www.samhsa.gov/blog/rss', 'SAMHSA Blog', 'SAMHSA'),
  ('https://www.psychologytoday.com/us/blog/mental-health-nerd/feed', 'Mental Health Nerd', 'Psychology Today')
ON CONFLICT (rss_url) DO NOTHING;
