CREATE OR REPLACE FUNCTION public.is_instagram_managed_image_url(p_url TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT p_url ~ '^https://(res[.]cloudinary[.]com|pub-[a-zA-Z0-9-]+[.]r2[.]dev)/';
$$;
