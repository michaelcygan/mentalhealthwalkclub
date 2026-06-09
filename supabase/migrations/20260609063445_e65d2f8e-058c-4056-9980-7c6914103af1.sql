-- Collections
CREATE TABLE public.listen_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  blurb text,
  cover_url text,
  is_published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.listen_collections TO authenticated;
GRANT ALL ON public.listen_collections TO service_role;
ALTER TABLE public.listen_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view published collections"
  ON public.listen_collections FOR SELECT TO authenticated
  USING (is_published OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage collections"
  ON public.listen_collections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.listen_collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.listen_collections(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('podcast','ambient','guided','blog')),
  item_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, kind, item_id)
);

GRANT SELECT ON public.listen_collection_items TO authenticated;
GRANT ALL ON public.listen_collection_items TO service_role;
ALTER TABLE public.listen_collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in reads items of visible collections"
  ON public.listen_collection_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.listen_collections c
    WHERE c.id = collection_id
      AND (c.is_published OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "Admins manage collection items"
  ON public.listen_collection_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Listen events (per-user activity log)
CREATE TABLE public.listen_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('podcast','ambient','guided','blog')),
  item_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('open','play','save','queue')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX listen_events_kind_item_idx ON public.listen_events (kind, item_id, created_at DESC);
CREATE INDEX listen_events_user_idx ON public.listen_events (user_id, created_at DESC);

GRANT INSERT, SELECT ON public.listen_events TO authenticated;
GRANT ALL ON public.listen_events TO service_role;
ALTER TABLE public.listen_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own listen events"
  ON public.listen_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read their own listen events"
  ON public.listen_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Search log
CREATE TABLE public.listen_search_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  q text NOT NULL,
  result_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX listen_search_log_created_idx ON public.listen_search_log (created_at DESC);

GRANT INSERT, SELECT ON public.listen_search_log TO authenticated;
GRANT ALL ON public.listen_search_log TO service_role;
ALTER TABLE public.listen_search_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own search rows"
  ON public.listen_search_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Only admins read search log"
  ON public.listen_search_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Content requests (suggestions)
CREATE TABLE public.content_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  url text,
  kind text CHECK (kind IN ('podcast','ambient','guided','blog','other')),
  notes text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','approved','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT, SELECT ON public.content_requests TO authenticated;
GRANT ALL ON public.content_requests TO service_role;
ALTER TABLE public.content_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can submit suggestions"
  ON public.content_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users see their own suggestions; admins see all"
  ON public.content_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update suggestion status"
  ON public.content_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at triggers
CREATE TRIGGER trg_listen_collections_updated_at
  BEFORE UPDATE ON public.listen_collections
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_content_requests_updated_at
  BEFORE UPDATE ON public.content_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
