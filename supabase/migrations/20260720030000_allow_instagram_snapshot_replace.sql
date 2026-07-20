DO $$
DECLARE
  function_definition TEXT;
BEGIN
  SELECT pg_get_functiondef('public.publish_instagram_stage(uuid)'::regprocedure)
    INTO function_definition;

  function_definition := replace(
    function_definition,
    'DELETE FROM public.instagram_active_posts;',
    'DELETE FROM public.instagram_active_posts WHERE TRUE;'
  );

  EXECUTE function_definition;
END;
$$;
