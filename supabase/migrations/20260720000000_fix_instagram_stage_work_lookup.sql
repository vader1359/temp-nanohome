-- `RETURNS TABLE` output columns are PL/pgSQL variables. Qualify the stage
-- lookup column so it cannot collide with the output column named `id`.
CREATE OR REPLACE FUNCTION public.get_instagram_stage_work(
    p_stage_id UUID
)
RETURNS TABLE (
    id TEXT,
    media_type TEXT,
    permalink TEXT,
    caption TEXT,
    sort_order INT,
    source_url_fingerprint TEXT,
    meta_image_url TEXT,
    meta_video_url TEXT,
    draft_image_url TEXT,
    draft_video_url TEXT,
    draft_thumbnail_url TEXT,
    wistia_hashed_id TEXT,
    wistia_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF p_stage_id IS NULL THEN
        RAISE EXCEPTION 'p_stage_id is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.instagram_snapshot_stages AS stage
        WHERE stage.id = p_stage_id
    ) THEN
        RAISE EXCEPTION 'Stage % not found', p_stage_id;
    END IF;

    RETURN QUERY
    SELECT
        item.post_id,
        item.media_type,
        item.permalink,
        item.caption,
        item.sort_order,
        item.source_url_fingerprint,
        item.image_url,
        item.video_url,
        post.image_url,
        post.video_url,
        post.thumbnail_url,
        post.wistia_hashed_id,
        post.wistia_status
    FROM public.instagram_snapshot_stage_items AS item
    LEFT JOIN public.instagram_posts AS post
        ON post.id = item.post_id
        AND post.source_url_fingerprint = item.source_url_fingerprint
    WHERE item.stage_id = p_stage_id
    ORDER BY item.sort_order;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_instagram_stage_work(UUID) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_instagram_stage_work(UUID) TO service_role;
