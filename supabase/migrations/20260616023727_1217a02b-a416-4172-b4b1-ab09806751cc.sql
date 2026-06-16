ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS reader_html text,
  ADD COLUMN IF NOT EXISTS reader_excerpt text,
  ADD COLUMN IF NOT EXISTS reader_byline text,
  ADD COLUMN IF NOT EXISTS reader_parsed_at timestamptz;