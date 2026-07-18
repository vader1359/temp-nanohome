-- Supabase Migration: Enforce Instagram snapshot composition
-- Created: 2026-07-12 01:00:00

-- Validate existing active posts snapshot and delete if invalid
DO $$
DECLARE
    v_total_count INT;
    v_video_count INT;
    v_image_count INT;
    v_invalid_count INT;
    v_is_valid BOOLEAN := TRUE;
BEGIN
    -- Check total count
    SELECT count(*) INTO v_total_count FROM public.instagram_active_posts;

    IF v_total_count > 0 THEN
        -- Check exact composition
        IF v_total_count <> 24 THEN
            v_is_valid := FALSE;
        END IF;

        SELECT count(*) INTO v_video_count FROM public.instagram_active_posts WHERE media_type = 'video';
        SELECT count(*) INTO v_image_count FROM public.instagram_active_posts WHERE media_type = 'image';

        IF v_video_count <> 3 OR v_image_count <> 21 THEN
            v_is_valid := FALSE;
        END IF;

        -- Check sort_order contiguous 1..24
        -- There must be exactly 24 distinct sort_orders, all between 1 and 24 inclusive.
        IF EXISTS (
            SELECT 1 FROM (
                SELECT sort_order, count(*) as cnt
                FROM public.instagram_active_posts
                GROUP BY sort_order
            ) s WHERE s.cnt > 1 OR s.sort_order < 1 OR s.sort_order > 24
        ) THEN
            v_is_valid := FALSE;
        END IF;

        -- Check URL readiness constraints
        -- For images: image_url must start with https://res.cloudinary.com/
        -- For videos: video_url must start with one of the allowed Wistia hosts and thumbnail_url must start with https://res.cloudinary.com/
        SELECT count(*) INTO v_invalid_count
        FROM public.instagram_active_posts
        WHERE
            (media_type = 'image' AND (
                image_url IS NULL OR image_url = '' OR NOT (image_url LIKE 'https://res.cloudinary.com/%')
            ))
            OR
            (media_type = 'video' AND (
                video_url IS NULL OR video_url = '' OR NOT (
                    video_url LIKE 'https://embed-ssl.wistia.com/%' OR
                    video_url LIKE 'https://embed.wistia.com/%' OR
                    video_url LIKE 'https://fast.wistia.com/%' OR
                    video_url LIKE 'https://fast.wistia.net/%'
                ) OR
                thumbnail_url IS NULL OR thumbnail_url = '' OR NOT (
                    thumbnail_url LIKE 'https://res.cloudinary.com/%'
                )
            ));

        IF v_invalid_count > 0 THEN
            v_is_valid := FALSE;
        END IF;

        -- If not valid, delete everything from active posts
        IF NOT v_is_valid THEN
            DELETE FROM public.instagram_active_posts;
        END IF;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_instagram_snapshot(
    p_posts JSONB,
    p_active_ids TEXT[],
    p_source_url_version TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_id TEXT;
    v_idx INT;
    v_found BOOLEAN;
    v_item RECORD;
    v_post_count INT;
    v_video_count INT;
    v_image_count INT;
BEGIN
    -- Reject if p_posts is not a jsonb array
    IF p_posts IS NULL OR jsonb_typeof(p_posts) <> 'array' THEN
        RAISE EXCEPTION 'p_posts must be a JSONB array';
    END IF;

    -- Enforce exactly 24 candidate post objects
    IF jsonb_array_length(p_posts) <> 24 THEN
        RAISE EXCEPTION 'p_posts must contain exactly 24 candidate post objects';
    END IF;

    -- Enforce exactly 24 active IDs
    v_post_count := array_length(p_active_ids, 1);
    IF v_post_count IS NULL OR v_post_count <> 24 THEN
        RAISE EXCEPTION 'Active snapshot size must be exactly 24 posts';
    END IF;

    -- Enforce no duplicates in active IDs
    IF EXISTS (
        SELECT 1 FROM unnest(p_active_ids) AS x(id)
        GROUP BY x.id HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate active IDs are not permitted';
    END IF;

    -- Enforce no duplicates in candidate IDs
    IF EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_posts) AS x(id TEXT)
        GROUP BY x.id HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate candidate IDs are not permitted';
    END IF;

    -- Enforce exact membership: verify all active IDs exist in the processed candidate set
    FOR v_id IN SELECT unnest(p_active_ids) LOOP
        v_found := FALSE;
        FOR v_item IN SELECT * FROM jsonb_to_recordset(p_posts) AS x(id TEXT) LOOP
            IF v_item.id = v_id THEN
                v_found := TRUE;
                EXIT;
            END IF;
        END LOOP;
        IF NOT v_found THEN
            RAISE EXCEPTION 'Active ID % is missing from candidate posts', v_id;
        END IF;
    END LOOP;

    -- Enforce active composition: exactly 3 video and 21 image posts
    SELECT count(*) INTO v_video_count FROM jsonb_to_recordset(p_posts) AS x(media_type TEXT) WHERE x.media_type = 'video';
    SELECT count(*) INTO v_image_count FROM jsonb_to_recordset(p_posts) AS x(media_type TEXT) WHERE x.media_type = 'image';

    IF v_video_count <> 3 THEN
        RAISE EXCEPTION 'Must have exactly 3 video posts, found %', v_video_count;
    END IF;
    IF v_image_count <> 21 THEN
        RAISE EXCEPTION 'Must have exactly 21 image posts, found %', v_image_count;
    END IF;

    -- Reject unsupported/null media types
    IF EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_posts) AS x(media_type TEXT)
        WHERE x.media_type IS NULL OR x.media_type NOT IN ('image', 'video')
    ) THEN
        RAISE EXCEPTION 'Unsupported or null media type found in candidate posts';
    END IF;

    -- Save drafts first
    PERFORM public.save_instagram_posts_draft(p_posts);

    -- Verify active posts readiness
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_posts) AS x(
        id TEXT,
        media_type TEXT,
        image_url TEXT,
        video_url TEXT,
        thumbnail_url TEXT,
        wistia_status TEXT
    ) LOOP
        IF v_item.id = ANY(p_active_ids) THEN
            IF v_item.media_type = 'video' THEN
                IF v_item.wistia_status <> 'ready' OR v_item.video_url IS NULL OR v_item.video_url = '' OR NOT (v_item.video_url LIKE 'https://embed-ssl.wistia.com/%' OR v_item.video_url LIKE 'https://embed.wistia.com/%' OR v_item.video_url LIKE 'https://fast.wistia.com/%' OR v_item.video_url LIKE 'https://fast.wistia.net/%') THEN
                    RAISE EXCEPTION 'Active video % is not ready', v_item.id;
                END IF;
                IF v_item.thumbnail_url IS NULL OR v_item.thumbnail_url = '' OR NOT v_item.thumbnail_url LIKE 'https://res.cloudinary.com/%' THEN
                    RAISE EXCEPTION 'Active video % is missing Cloudinary poster URL', v_item.id;
                END IF;
            ELSIF v_item.media_type = 'image' THEN
                IF v_item.image_url IS NULL OR v_item.image_url = '' OR NOT v_item.image_url LIKE 'https://res.cloudinary.com/%' THEN
                    RAISE EXCEPTION 'Active image % is not ready', v_item.id;
                END IF;
            END IF;
        END IF;
    END LOOP;

    -- Atomically overwrite active posts snapshot
    DELETE FROM public.instagram_active_posts;

    FOR v_idx IN 1..v_post_count LOOP
        v_id := p_active_ids[v_idx];

        INSERT INTO public.instagram_active_posts (
            id, source_post_id, media_type, image_url, video_url, thumbnail_url, permalink, caption, sort_order
        )
        SELECT
            v_id,
            v_id,
            media_type,
            image_url,
            video_url,
            thumbnail_url,
            permalink,
            caption,
            v_idx
        FROM public.instagram_posts
        WHERE id = v_id;
    END LOOP;

    -- Update pipeline state
    INSERT INTO public.instagram_pipeline_state (key, value)
    VALUES ('source_url_version', p_source_url_version)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$$;

-- Revoke execute privilege from public, anon, authenticated on security definer function
REVOKE EXECUTE ON FUNCTION public.publish_instagram_snapshot(JSONB, TEXT[], TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_instagram_snapshot(JSONB, TEXT[], TEXT) TO service_role;
