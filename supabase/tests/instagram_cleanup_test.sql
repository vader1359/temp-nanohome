BEGIN;

-- Include required test setup
\ir fixtures.sql
\ir ../seed.sql

SELECT plan(8);

-- 2. Insert 16 legacy invalid image rows into public.instagram_active_posts
INSERT INTO public.instagram_active_posts (id, source_post_id, media_type, image_url, permalink, sort_order)
SELECT 'legacy-' || i, 'legacy-' || i, 'image', 'https://example.com/legacy-' || i, 'https://example.com/p/' || i, i
FROM generate_series(1, 16) i;

-- Assert row count 16 (assertion 1)
SELECT is((SELECT count(*)::integer FROM public.instagram_active_posts), 16, 'Inserted 16 legacy invalid active posts');

-- 3. Execute the real migration through psql meta-command
\ir ../migrations/20260712010000_enforce_instagram_snapshot_composition.sql

-- 4. Assert active rows count 0 (assertion 2)
SELECT is((SELECT count(*)::integer FROM public.instagram_active_posts), 0, 'Legacy snapshot is deleted by migration cleanup');

-- 5. Insert a valid snapshot directly into instagram_active_posts:
-- 3 videos exact allowed Wistia URLs + Cloudinary posters and 21 Cloudinary images, sort order 1..24
INSERT INTO public.instagram_active_posts (id, source_post_id, media_type, image_url, video_url, thumbnail_url, permalink, sort_order)
VALUES
('vid-1', 'vid-1', 'video', 'https://res.cloudinary.com/vid1', 'https://embed-ssl.wistia.com/1', 'https://res.cloudinary.com/thumb1', 'https://example.com/p/1', 1),
('vid-2', 'vid-2', 'video', 'https://res.cloudinary.com/vid2', 'https://embed.wistia.com/2', 'https://res.cloudinary.com/thumb2', 'https://example.com/p/2', 2),
('vid-3', 'vid-3', 'video', 'https://res.cloudinary.com/vid3', 'https://fast.wistia.net/3', 'https://res.cloudinary.com/thumb3', 'https://example.com/p/3', 3);

INSERT INTO public.instagram_active_posts (id, source_post_id, media_type, image_url, permalink, sort_order)
SELECT 'img-' || i, 'img-' || i, 'image', 'https://res.cloudinary.com/img-' || i, 'https://example.com/p/' || i, i
FROM generate_series(4, 24) i;

-- Assert count=24 (3)
SELECT is((SELECT count(*)::integer FROM public.instagram_active_posts), 24, 'Active snapshot has exactly 24 posts');

-- Assert videos=3 (4)
SELECT is((SELECT count(*)::integer FROM public.instagram_active_posts WHERE media_type = 'video'), 3, 'Active snapshot has exactly 3 videos');

-- Assert images=21 (5)
SELECT is((SELECT count(*)::integer FROM public.instagram_active_posts WHERE media_type = 'image'), 21, 'Active snapshot has exactly 21 images');

-- 6. Execute the real migration file again
\ir ../migrations/20260712010000_enforce_instagram_snapshot_composition.sql

-- 7. Assert total 24 (6), videos 3 (7), images 21 (8)
SELECT is((SELECT count(*)::integer FROM public.instagram_active_posts), 24, 'Valid active snapshot preserved (count is 24)');
SELECT is((SELECT count(*)::integer FROM public.instagram_active_posts WHERE media_type = 'video'), 3, 'Valid active snapshot preserved (videos count is 3)');
SELECT is((SELECT count(*)::integer FROM public.instagram_active_posts WHERE media_type = 'image'), 21, 'Valid active snapshot preserved (images count is 21)');

-- 8. finish(); ROLLBACK;
SELECT * FROM finish();
ROLLBACK;
