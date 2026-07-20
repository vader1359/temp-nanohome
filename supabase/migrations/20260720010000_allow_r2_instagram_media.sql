CREATE OR REPLACE FUNCTION public.is_instagram_managed_image_url(p_url TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT p_url ~ '^https://(res[.]cloudinary[.]com|pub-[a-zA-Z0-9-]+[.]r2[.]dev)/';
$$;

DO $$
DECLARE
  function_definition TEXT;
BEGIN
  SELECT pg_get_functiondef('public.save_instagram_stage_drafts(uuid,jsonb)'::regprocedure)
    INTO function_definition;
  function_definition := replace(
    function_definition,
    'v_post.thumbnail_url ~ ''^https://res.cloudinary.com/'' IS NOT TRUE',
    'NOT public.is_instagram_managed_image_url(v_post.thumbnail_url)'
  );
  function_definition := replace(
    function_definition,
    'NOT v_post.image_url LIKE ''https://res.cloudinary.com/%''',
    'NOT public.is_instagram_managed_image_url(v_post.image_url)'
  );
  EXECUTE function_definition;

  SELECT pg_get_functiondef('public.publish_instagram_stage(uuid)'::regprocedure)
    INTO function_definition;
  function_definition := replace(
    function_definition,
    'post.image_url LIKE ''https://res.cloudinary.com/%''',
    'public.is_instagram_managed_image_url(post.image_url)'
  );
  function_definition := replace(
    function_definition,
    'post.thumbnail_url LIKE ''https://res.cloudinary.com/%''',
    'public.is_instagram_managed_image_url(post.thumbnail_url)'
  );
  EXECUTE function_definition;
END;
$$;
