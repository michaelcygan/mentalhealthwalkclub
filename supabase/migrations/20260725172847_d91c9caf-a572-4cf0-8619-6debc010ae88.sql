-- Seed one radio station and one launch blog post (idempotent)
INSERT INTO public.radio_stations (slug, title, subtitle, is_active, sort)
VALUES ('mhwc-radio', 'Mental Health Walk Club Radio', 'Ambient mixes for your walk', true, 0)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, subtitle = EXCLUDED.subtitle, is_active = true;

INSERT INTO public.blog_posts (slug, title, summary, body_md, body_html, status, published_at, seo_title, seo_description)
VALUES (
  'welcome-to-mental-health-walk-club',
  'Welcome to Mental Health Walk Club',
  'A short walk changes the shape of a day. Here''s what we''re building — and how to join us on your first one.',
  E'# Welcome\n\nA short walk changes the shape of a day.\n\nMental Health Walk Club is a place to **find a walk near you**, **post one of your own**, and **show up gently** — alone or with others. No streaks to chase. No performance. Just fresh air and the people who want to move through the world a little more kindly.\n\n## How it works\n\n- **Browse public walks** on the home screen — no account needed to look.\n- **Post a walk** in about 30 seconds. Share the link on IG, in a group chat, anywhere.\n- **Join a group** for standing walks in your city or interest area.\n- **Follow** people whose pace you like. Mutual follows unlock more.\n\n## What we won''t do\n\nWe won''t count your steps back at you. We won''t rank your mood. We won''t sell your data. The whole thing is designed to feel more like a Sunday morning than a fitness app.\n\n## Start with one\n\nOne short walk. Fifteen minutes. Around the block, or all the way to the water. That''s the whole idea.\n\nSee you out there.',
  '<h1>Welcome</h1><p>A short walk changes the shape of a day.</p><p>Mental Health Walk Club is a place to <strong>find a walk near you</strong>, <strong>post one of your own</strong>, and <strong>show up gently</strong> — alone or with others. No streaks to chase. No performance. Just fresh air and the people who want to move through the world a little more kindly.</p><h2>How it works</h2><ul><li><strong>Browse public walks</strong> on the home screen — no account needed to look.</li><li><strong>Post a walk</strong> in about 30 seconds. Share the link on IG, in a group chat, anywhere.</li><li><strong>Join a group</strong> for standing walks in your city or interest area.</li><li><strong>Follow</strong> people whose pace you like. Mutual follows unlock more.</li></ul><h2>What we won''t do</h2><p>We won''t count your steps back at you. We won''t rank your mood. We won''t sell your data. The whole thing is designed to feel more like a Sunday morning than a fitness app.</p><h2>Start with one</h2><p>One short walk. Fifteen minutes. Around the block, or all the way to the water. That''s the whole idea.</p><p>See you out there.</p>',
  'published',
  now(),
  'Welcome to Mental Health Walk Club',
  'A short walk changes the shape of a day. Here''s what we''re building, and how to join us on your first one.'
)
ON CONFLICT (slug) WHERE slug IS NOT NULL DO NOTHING;