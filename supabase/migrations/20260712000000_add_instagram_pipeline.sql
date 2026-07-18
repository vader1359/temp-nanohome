-- Supabase Migration: Instagram pipeline support
-- Created: 2026-07-12 00:00:00

CREATE TABLE IF NOT EXISTS public.instagram_posts (
    id TEXT PRIMARY KEY,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
    image_url TEXT NOT NULL,
    video_url TEXT,
    thumbnail_url TEXT,
    permalink TEXT NOT NULL,
    caption TEXT,
    wistia_hashed_id TEXT,
    wistia_status TEXT CHECK (wistia_status IN ('queued', 'processing', 'ready', 'failed')),
    source_url_fingerprint TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.instagram_active_posts (
    id TEXT PRIMARY KEY,
    source_post_id TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
    image_url TEXT NOT NULL,
    video_url TEXT,
    thumbnail_url TEXT,
    permalink TEXT NOT NULL,
    caption TEXT,
    sort_order INTEGER NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.instagram_pipeline_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Enable RLS on all operational tables
ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_active_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_pipeline_state ENABLE ROW LEVEL SECURITY;

-- Revoke all direct public/authenticated access from operational tables (server/service_role only)
REVOKE ALL ON public.instagram_posts FROM public, anon, authenticated;
REVOKE ALL ON public.instagram_active_posts FROM public, anon, authenticated;
REVOKE ALL ON public.instagram_pipeline_state FROM public, anon, authenticated;

GRANT ALL ON public.instagram_posts TO service_role;
GRANT ALL ON public.instagram_active_posts TO service_role;
GRANT ALL ON public.instagram_pipeline_state TO service_role;

-- RPC: Update Wistia status
CREATE OR REPLACE FUNCTION public.update_instagram_wistia_status(
    p_id TEXT,
    p_status TEXT,
    p_video_url TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    -- Input validation
    IF p_status NOT IN ('queued', 'processing', 'ready', 'failed') THEN
        RAISE EXCEPTION 'Invalid wistia status: %', p_status;
    END IF;

    -- Validate URLs for ready status
    IF p_status = 'ready' AND (p_video_url IS NULL OR p_video_url = '' OR NOT (p_video_url LIKE 'https://embed-ssl.wistia.com/%' OR p_video_url LIKE 'https://embed.wistia.com/%' OR p_video_url LIKE 'https://fast.wistia.com/%' OR p_video_url LIKE 'https://fast.wistia.net/%')) THEN
        RAISE EXCEPTION 'Invalid ready video URL: %', p_video_url;
    END IF;

    -- Check status regression (cannot move from ready back to processing/queued)
    IF EXISTS (
        SELECT 1 FROM public.instagram_posts
        WHERE id = p_id AND wistia_status = 'ready' AND p_status IN ('queued', 'processing')
    ) THEN
        RAISE EXCEPTION 'Status regression check failed: cannot move from ready to %', p_status;
    END IF;

    UPDATE public.instagram_posts
    SET wistia_status = p_status,
        video_url = CASE WHEN p_status = 'ready' THEN p_video_url ELSE video_url END,
        updated_at = NOW()
    WHERE id = p_id;
END;
$$;

-- RPC: Save draft posts
CREATE OR REPLACE FUNCTION public.save_instagram_posts_draft(
    p_posts JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_post RECORD;
    v_id TEXT;
    v_media_type TEXT;
    v_image_url TEXT;
    v_video_url TEXT;
    v_thumbnail_url TEXT;
    v_permalink TEXT;
    v_caption TEXT;
    v_wistia_hashed_id TEXT;
    v_wistia_status TEXT;
    v_fingerprint TEXT;
BEGIN
    FOR v_post IN SELECT * FROM jsonb_to_recordset(p_posts) AS x(
        id TEXT,
        media_type TEXT,
        image_url TEXT,
        video_url TEXT,
        thumbnail_url TEXT,
        permalink TEXT,
        caption TEXT,
        wistia_hashed_id TEXT,
        wistia_status TEXT,
        source_url_fingerprint TEXT
    ) LOOP
        -- Validate fields
        IF v_post.id IS NULL OR v_post.id = '' THEN
            RAISE EXCEPTION 'Post ID is required';
        END IF;
        IF v_post.media_type NOT IN ('image', 'video') THEN
            RAISE EXCEPTION 'Invalid media type: %', v_post.media_type;
        END IF;
        IF v_post.image_url IS NULL OR v_post.image_url = '' OR NOT v_post.image_url LIKE 'https://res.cloudinary.com/%' THEN
            RAISE EXCEPTION 'Invalid Cloudinary image URL: %', v_post.image_url;
        END IF;
        IF v_post.media_type = 'video' AND v_post.thumbnail_url IS NOT NULL AND v_post.thumbnail_url <> '' AND NOT v_post.thumbnail_url LIKE 'https://res.cloudinary.com/%' THEN
            RAISE EXCEPTION 'Invalid Cloudinary poster URL: %', v_post.thumbnail_url;
        END IF;
        IF v_post.wistia_status IS NOT NULL AND v_post.wistia_status NOT IN ('queued', 'processing', 'ready', 'failed') THEN
            RAISE EXCEPTION 'Invalid Wistia status: %', v_post.wistia_status;
        END IF;

        INSERT INTO public.instagram_posts (
            id, media_type, image_url, video_url, thumbnail_url, permalink, caption, wistia_hashed_id, wistia_status, source_url_fingerprint, updated_at
        ) VALUES (
            v_post.id, v_post.media_type, v_post.image_url, v_post.video_url, v_post.thumbnail_url, v_post.permalink, v_post.caption, v_post.wistia_hashed_id, v_post.wistia_status, v_post.source_url_fingerprint, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            media_type = EXCLUDED.media_type,
            image_url = EXCLUDED.image_url,
            video_url = CASE
                WHEN instagram_posts.source_url_fingerprint IS DISTINCT FROM EXCLUDED.source_url_fingerprint THEN EXCLUDED.video_url
                WHEN EXCLUDED.media_type = 'video' AND instagram_posts.wistia_status = 'ready' THEN instagram_posts.video_url
                ELSE EXCLUDED.video_url
            END,
            thumbnail_url = EXCLUDED.thumbnail_url,
            permalink = EXCLUDED.permalink,
            caption = EXCLUDED.caption,
            wistia_hashed_id = CASE
                WHEN instagram_posts.source_url_fingerprint IS DISTINCT FROM EXCLUDED.source_url_fingerprint THEN EXCLUDED.wistia_hashed_id
                ELSE COALESCE(EXCLUDED.wistia_hashed_id, instagram_posts.wistia_hashed_id)
            END,
            wistia_status = CASE
                WHEN instagram_posts.source_url_fingerprint IS DISTINCT FROM EXCLUDED.source_url_fingerprint THEN EXCLUDED.wistia_status
                WHEN instagram_posts.wistia_status = 'ready' AND EXCLUDED.wistia_status IN ('queued', 'processing') THEN instagram_posts.wistia_status
                ELSE EXCLUDED.wistia_status
            END,
            source_url_fingerprint = EXCLUDED.source_url_fingerprint,
            updated_at = NOW();
    END LOOP;
END;
$$;

-- RPC: Publish atomic snapshot
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
BEGIN
    -- Save drafts first
    PERFORM public.save_instagram_posts_draft(p_posts);

    -- Validate active IDs
    v_post_count := array_length(p_active_ids, 1);
    IF v_post_count IS NULL OR v_post_count = 0 THEN
        RAISE EXCEPTION 'Active IDs cannot be empty';
    END IF;
    IF v_post_count > 16 THEN
        RAISE EXCEPTION 'Active snapshot size exceeds limit of 16 posts';
    END IF;

    -- Validate duplicates in active IDs
    IF EXISTS (
        SELECT 1 FROM unnest(p_active_ids) AS x(id)
        GROUP BY x.id HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate active IDs are not permitted';
    END IF;

    -- Verify all active IDs exist in the processed candidate set
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

-- Revoke execute privilege from public, anon, authenticated on security definer functions
REVOKE EXECUTE ON FUNCTION public.update_instagram_wistia_status(TEXT, TEXT, TEXT) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.save_instagram_posts_draft(JSONB) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.publish_instagram_snapshot(JSONB, TEXT[], TEXT) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.update_instagram_wistia_status(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_instagram_posts_draft(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_instagram_snapshot(JSONB, TEXT[], TEXT) TO service_role;
