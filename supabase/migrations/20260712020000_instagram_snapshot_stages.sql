-- Supabase Migration: Bounded staging architecture for Instagram sync
-- Created: 2026-07-12 02:00:00

-- Create instagram_snapshot_stages table
CREATE TABLE IF NOT EXISTS public.instagram_snapshot_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL CHECK (status IN ('building', 'published', 'superseded')),
    selection_key TEXT NOT NULL CHECK (selection_key ~ '^[0-9a-f]{64}$'),
    source_url_version TEXT NOT NULL CHECK (length(source_url_version) <= 128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Partial unique index to enforce active stage singleton (only one building stage at a time)
CREATE UNIQUE INDEX IF NOT EXISTS instagram_snapshot_stages_active_singleton_idx
ON public.instagram_snapshot_stages (((true)))
WHERE status = 'building';

-- Create instagram_snapshot_stage_items table
CREATE TABLE IF NOT EXISTS public.instagram_snapshot_stage_items (
    stage_id UUID REFERENCES public.instagram_snapshot_stages(id) ON DELETE CASCADE,
    post_id TEXT NOT NULL CHECK (post_id <> ''),
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
    source_url_fingerprint TEXT NOT NULL CHECK (source_url_fingerprint ~ '^[0-9a-f]{64}$'),
    sort_order INTEGER NOT NULL CHECK (sort_order BETWEEN 1 AND 24),
    permalink TEXT NOT NULL CHECK (permalink ~ '^https://(www\.)?instagram\.com/p/[a-zA-Z0-9_-]+/?$'),
    caption TEXT CHECK (length(caption) <= 2200),
    image_url TEXT NOT NULL CHECK (image_url ~ '^https://([a-zA-Z0-9.-]+\.cdninstagram\.com|lookaside\.fbsbx\.com)/'),
    video_url TEXT,
    PRIMARY KEY (stage_id, post_id),
    UNIQUE (stage_id, sort_order),
    CONSTRAINT video_url_conditional CHECK (
        (media_type = 'video' AND video_url IS NOT NULL AND video_url <> '' AND video_url ~ '^https://([a-zA-Z0-9.-]+\.cdninstagram\.com|lookaside\.fbsbx\.com)/') OR
        (media_type = 'image' AND video_url IS NULL)
    )
);

-- Enable RLS on new operational tables
ALTER TABLE public.instagram_snapshot_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_snapshot_stage_items ENABLE ROW LEVEL SECURITY;

-- Revoke all direct public/authenticated access from operational tables (server/service_role only)
REVOKE ALL ON public.instagram_snapshot_stages FROM public, anon, authenticated;
REVOKE ALL ON public.instagram_snapshot_stage_items FROM public, anon, authenticated;

GRANT ALL ON public.instagram_snapshot_stages TO service_role;
GRANT ALL ON public.instagram_snapshot_stage_items TO service_role;

-- Add last_seen_at to instagram_posts
ALTER TABLE public.instagram_posts ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Enforce constraints on public.instagram_posts
ALTER TABLE public.instagram_posts DROP CONSTRAINT IF EXISTS instagram_posts_id_check;
ALTER TABLE public.instagram_posts ADD CONSTRAINT instagram_posts_id_check CHECK (id <> '');

-- Drop legacy functions
DROP FUNCTION IF EXISTS public.update_instagram_wistia_status(TEXT, TEXT, TEXT);

-- RPC: Begin Instagram Snapshot Stage
CREATE OR REPLACE FUNCTION public.begin_instagram_snapshot_stage(
    p_selection JSONB,
    p_source_url_version TEXT,
    p_selection_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_video_count INT;
    v_image_count INT;
    v_stage_id UUID;
    v_item RECORD;
    v_existing_id UUID;
    v_existing_key TEXT;
BEGIN
    -- Serialization guard using advisory lock
    PERFORM pg_advisory_xact_lock(429184712);

    -- Reject if p_selection is not a jsonb array
    IF p_selection IS NULL OR jsonb_typeof(p_selection) <> 'array' THEN
        RAISE EXCEPTION 'p_selection must be a JSONB array';
    END IF;

    -- Enforce exactly 24 post objects
    IF jsonb_array_length(p_selection) <> 24 THEN
        RAISE EXCEPTION 'p_selection must contain exactly 24 candidate post objects';
    END IF;

    -- 1. Catch empty/null IDs
    IF EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_selection) AS x(id TEXT)
        WHERE x.id IS NULL OR x.id = ''
    ) THEN
        RAISE EXCEPTION 'Empty or null ID found in selection';
    END IF;

    -- 2. Validate 64-hex fingerprint
    IF EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_selection) AS x(source_url_fingerprint TEXT)
        WHERE x.source_url_fingerprint IS NULL OR x.source_url_fingerprint ~ '^[0-9a-f]{64}$' IS NOT TRUE
    ) THEN
        RAISE EXCEPTION 'Invalid or missing source URL fingerprint in selection';
    END IF;

    -- 3. Validate media types and combinations
    IF EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_selection) AS x(media_type TEXT)
        WHERE x.media_type IS NULL OR x.media_type NOT IN ('image', 'video')
    ) THEN
        RAISE EXCEPTION 'Unsupported or null media type found in selection';
    END IF;

    -- 4. Validate permitted Meta CDN source URLs, right image/video combination
    IF EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_selection) AS x(
            media_type TEXT,
            image_url TEXT,
            video_url TEXT
        )
        WHERE x.image_url IS NULL OR x.image_url ~ '^https://([a-zA-Z0-9.-]+\.cdninstagram\.com|lookaside\.fbsbx\.com)/' IS NOT TRUE
           OR (x.media_type = 'video' AND (x.video_url IS NULL OR x.video_url = '' OR x.video_url ~ '^https://([a-zA-Z0-9.-]+\.cdninstagram\.com|lookaside\.fbsbx\.com)/' IS NOT TRUE))
           OR (x.media_type = 'image' AND x.video_url IS NOT NULL)
    ) THEN
        RAISE EXCEPTION 'Invalid source URL, media combination, or non-Meta CDN domain in selection';
    END IF;

    -- 5. Safe Instagram permalink
    IF EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_selection) AS x(permalink TEXT)
        WHERE x.permalink IS NULL OR x.permalink ~ '^https://(www\.)?instagram\.com/p/[a-zA-Z0-9_-]+/?$' IS NOT TRUE
    ) THEN
        RAISE EXCEPTION 'Invalid permalink found in selection';
    END IF;

    -- 6. Caption length
    IF EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_selection) AS x(caption TEXT)
        WHERE x.caption IS NOT NULL AND length(x.caption) > 2200
    ) THEN
        RAISE EXCEPTION 'Caption exceeds maximum length of 2200 characters';
    END IF;

    -- Check duplicate IDs
    IF EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_selection) AS x(id TEXT)
        GROUP BY x.id HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate candidate IDs are not permitted';
    END IF;

    -- Validate sort orders
    IF EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_selection) AS x(sort_order INT)
        WHERE x.sort_order IS NULL OR x.sort_order < 1 OR x.sort_order > 24
    ) THEN
        RAISE EXCEPTION 'Invalid sort order found in selection';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_selection) AS x(sort_order INT)
        GROUP BY x.sort_order HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate sort orders are not permitted';
    END IF;

    -- Validate composition
    SELECT count(*) INTO v_video_count FROM jsonb_to_recordset(p_selection) AS x(media_type TEXT) WHERE x.media_type = 'video';
    SELECT count(*) INTO v_image_count FROM jsonb_to_recordset(p_selection) AS x(media_type TEXT) WHERE x.media_type = 'image';

    IF v_video_count <> 3 THEN
        RAISE EXCEPTION 'Must have exactly 3 video posts, found %', v_video_count;
    END IF;
    IF v_image_count <> 21 THEN
        RAISE EXCEPTION 'Must have exactly 21 image posts, found %', v_image_count;
    END IF;

    -- Validate selection key and source url version bounds
    IF p_selection_key IS NULL OR p_selection_key ~ '^[0-9a-f]{64}$' IS NOT TRUE THEN
        RAISE EXCEPTION 'Invalid selection key format, must be 64 lowercase hex characters';
    END IF;

    IF p_source_url_version IS NULL OR length(p_source_url_version) > 128 OR p_source_url_version = '' THEN
        RAISE EXCEPTION 'Invalid or too long source_url_version';
    END IF;

    -- Concurrency & stable stage check:
    -- If a stage is already in status 'building' status, check if selection key matches.
    -- If it matches, touch updated_at and return existing stage ID.
    -- Otherwise, raise exception to prevent routine superseding.
    SELECT id, selection_key INTO v_existing_id, v_existing_key
    FROM public.instagram_snapshot_stages
    WHERE status = 'building'
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        IF v_existing_key = p_selection_key THEN
            UPDATE public.instagram_snapshot_stages
            SET updated_at = NOW()
            WHERE id = v_existing_id;

            UPDATE public.instagram_posts
            SET last_seen_at = NOW()
            WHERE id IN (
                SELECT (x->>'id') FROM jsonb_array_elements(p_selection) AS x
            );

            RETURN v_existing_id;
        ELSE
            RAISE EXCEPTION 'A stage is already in building status (ID: %)', v_existing_id;
        END IF;
    END IF;

    -- Insert new stage
    INSERT INTO public.instagram_snapshot_stages (status, selection_key, source_url_version)
    VALUES ('building', p_selection_key, p_source_url_version)
    RETURNING id INTO v_stage_id;

    -- Insert immutable stage items
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_selection) AS x(
        id TEXT,
        media_type TEXT,
        source_url_fingerprint TEXT,
        sort_order INT,
        permalink TEXT,
        caption TEXT,
        image_url TEXT,
        video_url TEXT
    ) LOOP
        INSERT INTO public.instagram_snapshot_stage_items (
            stage_id, post_id, media_type, source_url_fingerprint, sort_order, permalink, caption, image_url, video_url
        ) VALUES (
            v_stage_id, v_item.id, v_item.media_type, v_item.source_url_fingerprint, v_item.sort_order, v_item.permalink, v_item.caption, v_item.image_url, v_item.video_url
        );

        -- Also touch last_seen_at for any matching post in draft table
        UPDATE public.instagram_posts
        SET last_seen_at = NOW()
        WHERE id = v_item.id;
    END LOOP;

    RETURN v_stage_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.begin_instagram_snapshot_stage(JSONB, TEXT, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_instagram_snapshot_stage(JSONB, TEXT, TEXT) TO service_role;

-- RPC: Save Instagram Stage Drafts
CREATE OR REPLACE FUNCTION public.save_instagram_stage_drafts(
    p_stage_id UUID,
    p_posts JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_post RECORD;
    v_item RECORD;
BEGIN
    -- Input validation
    IF p_stage_id IS NULL THEN
        RAISE EXCEPTION 'p_stage_id is required';
    END IF;

    IF p_posts IS NULL OR jsonb_typeof(p_posts) <> 'array' THEN
        RAISE EXCEPTION 'p_posts must be a JSONB array';
    END IF;

    -- Enforce array length 1..2
    IF jsonb_array_length(p_posts) < 1 OR jsonb_array_length(p_posts) > 2 THEN
        RAISE EXCEPTION 'p_posts must contain between 1 and 2 posts';
    END IF;

    -- Verify stage exists and status is building
    IF NOT EXISTS (
        SELECT 1 FROM public.instagram_snapshot_stages
        WHERE id = p_stage_id AND status = 'building'
    ) THEN
        RAISE EXCEPTION 'Stage % is not in building status', p_stage_id;
    END IF;

    -- Verify each post in p_posts belongs to the stage and matches type and fingerprint
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
        -- Verify membership and matching type/fingerprint
        SELECT * INTO v_item
        FROM public.instagram_snapshot_stage_items
        WHERE stage_id = p_stage_id AND post_id = v_post.id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Post ID % does not belong to stage %', v_post.id, p_stage_id;
        END IF;

        IF v_item.media_type <> v_post.media_type THEN
            RAISE EXCEPTION 'Media type mismatch for post %: stage expected %, got %', v_post.id, v_item.media_type, v_post.media_type;
        END IF;

        IF v_item.source_url_fingerprint <> v_post.source_url_fingerprint THEN
            RAISE EXCEPTION 'Source URL fingerprint mismatch for post %', v_post.id;
        END IF;

        IF v_item.permalink <> v_post.permalink THEN
            RAISE EXCEPTION 'Permalink mismatch for post %: stage expected %, got %', v_post.id, v_item.permalink, v_post.permalink;
        END IF;

        IF v_item.caption IS DISTINCT FROM v_post.caption THEN
            RAISE EXCEPTION 'Caption mismatch for post %', v_post.id;
        END IF;

        -- Validate media combination
        IF v_post.media_type = 'image' THEN
            IF (v_post.video_url IS NOT NULL AND v_post.video_url <> '') OR
               (v_post.wistia_status IS NOT NULL AND v_post.wistia_status <> '') OR
               (v_post.wistia_hashed_id IS NOT NULL AND v_post.wistia_hashed_id <> '') OR
               (v_post.thumbnail_url IS NOT NULL AND v_post.thumbnail_url <> '') THEN
                RAISE EXCEPTION 'Image post % cannot have video fields, Wistia status, or thumbnail', v_post.id;
            END IF;
        ELSIF v_post.media_type = 'video' THEN
            -- every video needs Cloudinary poster URL
            IF v_post.thumbnail_url IS NULL OR v_post.thumbnail_url ~ '^https://res.cloudinary.com/' IS NOT TRUE THEN
                RAISE EXCEPTION 'Video post % requires a Cloudinary poster URL', v_post.id;
            END IF;

            -- queued/processing/ready needs hash
            IF v_post.wistia_status IN ('queued', 'processing', 'ready') AND (v_post.wistia_hashed_id IS NULL OR v_post.wistia_hashed_id = '') THEN
                RAISE EXCEPTION 'Video post % in % status requires a Wistia hash', v_post.id, v_post.wistia_status;
            END IF;

            -- ready video must use exact accepted Wistia host
            IF v_post.wistia_status = 'ready' THEN
                IF v_post.video_url IS NULL OR v_post.video_url ~ '^https://(embed-ssl\.wistia\.com|embed\.wistia\.com|fast\.wistia\.com|fast\.wistia\.net)/' IS NOT TRUE THEN
                    RAISE EXCEPTION 'Video post % in ready status must have a valid Wistia video URL', v_post.id;
                END IF;
            END IF;

            -- non-ready video cannot keep URL
            IF (v_post.wistia_status IS NULL OR v_post.wistia_status <> 'ready') AND v_post.video_url IS NOT NULL AND v_post.video_url <> '' THEN
                RAISE EXCEPTION 'Non-ready video post % cannot have a video URL', v_post.id;
            END IF;
        END IF;

        -- Validate URLs if they are Cloudinary
        IF v_post.image_url IS NULL OR v_post.image_url = '' OR NOT v_post.image_url LIKE 'https://res.cloudinary.com/%' THEN
            RAISE EXCEPTION 'Invalid Cloudinary image URL: %', v_post.image_url;
        END IF;
        IF v_post.wistia_status IS NOT NULL AND v_post.wistia_status NOT IN ('queued', 'processing', 'ready', 'failed') THEN
            RAISE EXCEPTION 'Invalid Wistia status: %', v_post.wistia_status;
        END IF;

        -- Update or Insert into instagram_posts
        INSERT INTO public.instagram_posts (
            id, media_type, image_url, video_url, thumbnail_url, permalink, caption, wistia_hashed_id, wistia_status, source_url_fingerprint, updated_at, last_seen_at
        ) VALUES (
            v_post.id,
            v_post.media_type,
            v_post.image_url,
            CASE WHEN v_post.media_type = 'video' AND v_post.wistia_status = 'ready' THEN v_post.video_url ELSE NULL END,
            v_post.thumbnail_url,
            v_post.permalink,
            v_post.caption,
            v_post.wistia_hashed_id,
            v_post.wistia_status,
            v_post.source_url_fingerprint,
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            media_type = EXCLUDED.media_type,
            image_url = EXCLUDED.image_url,
            video_url = CASE
                WHEN instagram_posts.source_url_fingerprint IS DISTINCT FROM EXCLUDED.source_url_fingerprint THEN
                    CASE WHEN EXCLUDED.wistia_status = 'ready' THEN EXCLUDED.video_url ELSE NULL END
                WHEN EXCLUDED.media_type = 'video' AND EXCLUDED.wistia_status = 'ready' THEN EXCLUDED.video_url
                ELSE NULL
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
            updated_at = NOW(),
            last_seen_at = NOW();
    END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_instagram_stage_drafts(UUID, JSONB) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_instagram_stage_drafts(UUID, JSONB) TO service_role;

-- RPC: Get Instagram Stage Work
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
    -- Input validation
    IF p_stage_id IS NULL THEN
        RAISE EXCEPTION 'p_stage_id is required';
    END IF;

    -- Verify stage exists
    IF NOT EXISTS (SELECT 1 FROM public.instagram_snapshot_stages WHERE id = p_stage_id) THEN
        RAISE EXCEPTION 'Stage % not found', p_stage_id;
    END IF;

    RETURN QUERY
    SELECT
        item.post_id AS id,
        item.media_type,
        item.permalink,
        item.caption,
        item.sort_order,
        item.source_url_fingerprint,
        item.image_url AS meta_image_url,
        item.video_url AS meta_video_url,
        post.image_url AS draft_image_url,
        post.video_url AS draft_video_url,
        post.thumbnail_url AS draft_thumbnail_url,
        post.wistia_hashed_id,
        post.wistia_status
    FROM public.instagram_snapshot_stage_items item
    LEFT JOIN public.instagram_posts post ON post.id = item.post_id AND post.source_url_fingerprint = item.source_url_fingerprint
    WHERE item.stage_id = p_stage_id
    ORDER BY item.sort_order;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_instagram_stage_work(UUID) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_instagram_stage_work(UUID) TO service_role;

-- RPC: Get Instagram Stage Pending Videos
CREATE OR REPLACE FUNCTION public.get_instagram_stage_pending_videos(
    p_stage_id UUID
)
RETURNS TABLE (
    id TEXT,
    wistia_hashed_id TEXT,
    wistia_status TEXT,
    image_url TEXT,
    thumbnail_url TEXT,
    permalink TEXT,
    caption TEXT,
    source_url_fingerprint TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    -- Input validation
    IF p_stage_id IS NULL THEN
        RAISE EXCEPTION 'p_stage_id is required';
    END IF;

    RETURN QUERY
    SELECT
        item.post_id AS id,
        post.wistia_hashed_id,
        post.wistia_status,
        post.image_url,
        post.thumbnail_url,
        item.permalink,
        item.caption,
        item.source_url_fingerprint
    FROM public.instagram_snapshot_stage_items item
    JOIN public.instagram_posts post ON post.id = item.post_id AND post.source_url_fingerprint = item.source_url_fingerprint
    WHERE item.stage_id = p_stage_id
      AND item.media_type = 'video'
      AND post.wistia_status IN ('queued', 'processing');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_instagram_stage_pending_videos(UUID) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_instagram_stage_pending_videos(UUID) TO service_role;

-- RPC: Update Instagram Stage Wistia Status
CREATE OR REPLACE FUNCTION public.update_instagram_stage_wistia_status(
    p_stage_id UUID,
    p_post_id TEXT,
    p_source_url_fingerprint TEXT,
    p_status TEXT,
    p_video_url TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_stage_status TEXT;
    v_wistia_status TEXT;
    v_updated_rows INT;
BEGIN
    -- Input validation
    IF p_stage_id IS NULL THEN
        RAISE EXCEPTION 'p_stage_id is required';
    END IF;
    IF p_post_id IS NULL OR p_post_id = '' THEN
        RAISE EXCEPTION 'p_post_id is required';
    END IF;
    IF p_source_url_fingerprint IS NULL OR p_source_url_fingerprint ~ '^[0-9a-f]{64}$' IS NOT TRUE THEN
        RAISE EXCEPTION 'Invalid or missing source_url_fingerprint';
    END IF;
    IF p_status NOT IN ('queued', 'processing', 'ready', 'failed') THEN
        RAISE EXCEPTION 'Invalid wistia status: %', p_status;
    END IF;

    -- Validate stage state (must exist and status must be building)
    SELECT status INTO v_stage_status
    FROM public.instagram_snapshot_stages
    WHERE id = p_stage_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Stage % not found', p_stage_id;
    END IF;

    IF v_stage_status <> 'building' THEN
        RAISE EXCEPTION 'Stage % is in status % and cannot be updated', p_stage_id, v_stage_status;
    END IF;

    -- Verify matching item exists in stage with correct fingerprint and is a video
    IF NOT EXISTS (
        SELECT 1 FROM public.instagram_snapshot_stage_items
        WHERE stage_id = p_stage_id AND post_id = p_post_id AND source_url_fingerprint = p_source_url_fingerprint AND media_type = 'video'
    ) THEN
        RAISE EXCEPTION 'No matching video item for post % and fingerprint % in stage %', p_post_id, p_source_url_fingerprint, p_stage_id;
    END IF;

    -- Validate URLs for ready status
    IF p_status = 'ready' AND (
        p_video_url IS NULL OR p_video_url = '' OR NOT (
            p_video_url LIKE 'https://embed-ssl.wistia.com/%' OR
            p_video_url LIKE 'https://embed.wistia.com/%' OR
            p_video_url LIKE 'https://fast.wistia.com/%' OR
            p_video_url LIKE 'https://fast.wistia.net/%'
        )
    ) THEN
        RAISE EXCEPTION 'Invalid ready video URL: %', p_video_url;
    END IF;

    -- Get current draft status and check ready regression (cannot move from ready back to processing/queued)
    SELECT wistia_status INTO v_wistia_status
    FROM public.instagram_posts
    WHERE id = p_post_id AND source_url_fingerprint = p_source_url_fingerprint;

    IF FOUND AND v_wistia_status = 'ready' AND p_status IN ('queued', 'processing') THEN
        RAISE EXCEPTION 'Status regression check failed: cannot move from ready to %', p_status;
    END IF;

    -- Perform update
    UPDATE public.instagram_posts
    SET wistia_status = p_status,
        video_url = CASE WHEN p_status = 'ready' THEN p_video_url ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_post_id AND source_url_fingerprint = p_source_url_fingerprint;

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    IF v_updated_rows = 0 THEN
        RAISE EXCEPTION 'No draft row updated for post % and fingerprint %', p_post_id, p_source_url_fingerprint;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_instagram_stage_wistia_status(UUID, TEXT, TEXT, TEXT, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_instagram_stage_wistia_status(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- RPC: Publish Instagram Stage
CREATE OR REPLACE FUNCTION public.publish_instagram_stage(
    p_stage_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_status TEXT;
    v_ready_count INT;
    v_source_url_version TEXT;
    v_item_count INT;
    v_video_count INT;
    v_image_count INT;
    v_inserted_count INT;
BEGIN
    -- Input validation
    IF p_stage_id IS NULL THEN
        RAISE EXCEPTION 'p_stage_id is required';
    END IF;

    -- Serialization guard using advisory lock
    PERFORM pg_advisory_xact_lock(429184712);

    -- Lock the stage row
    SELECT status, source_url_version INTO v_status, v_source_url_version
    FROM public.instagram_snapshot_stages
    WHERE id = p_stage_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Stage % not found', p_stage_id;
    END IF;

    IF v_status = 'superseded' THEN
        RAISE EXCEPTION 'Stage % is superseded and cannot be published', p_stage_id;
    END IF;

    IF v_status = 'published' THEN
        RETURN 'published';
    END IF;

    IF v_status <> 'building' THEN
        RAISE EXCEPTION 'Stage % is in status % and cannot be published', p_stage_id, v_status;
    END IF;

    -- Count total items for this stage
    SELECT count(*) INTO v_item_count FROM public.instagram_snapshot_stage_items WHERE stage_id = p_stage_id;
    IF v_item_count <> 24 THEN
        RAISE EXCEPTION 'Stage must contain exactly 24 items, found %', v_item_count;
    END IF;

    -- Count videos and images in stage items
    SELECT count(*) INTO v_video_count FROM public.instagram_snapshot_stage_items WHERE stage_id = p_stage_id AND media_type = 'video';
    SELECT count(*) INTO v_image_count FROM public.instagram_snapshot_stage_items WHERE stage_id = p_stage_id AND media_type = 'image';
    IF v_video_count <> 3 THEN
        RAISE EXCEPTION 'Stage must contain exactly 3 videos, found %', v_video_count;
    END IF;
    IF v_image_count <> 21 THEN
        RAISE EXCEPTION 'Stage must contain exactly 21 images, found %', v_image_count;
    END IF;

    -- Check distinct sort orders min=1 max=24
    IF EXISTS (
        SELECT 1 FROM public.instagram_snapshot_stage_items
        WHERE stage_id = p_stage_id
        GROUP BY sort_order HAVING count(*) > 1 OR sort_order < 1 OR sort_order > 24
    ) OR (
        SELECT count(DISTINCT sort_order) FROM public.instagram_snapshot_stage_items
        WHERE stage_id = p_stage_id
    ) <> 24 THEN
        RAISE EXCEPTION 'Stage items sort orders must be distinct from 1 to 24';
    END IF;

    -- Count ready items (checking against Cloudinary poster/image and Wistia hosts/readiness)
    SELECT count(*) INTO v_ready_count
    FROM public.instagram_snapshot_stage_items item
    JOIN public.instagram_posts post ON post.id = item.post_id AND post.source_url_fingerprint = item.source_url_fingerprint
    WHERE item.stage_id = p_stage_id
      AND (
        (item.media_type = 'image' AND post.image_url LIKE 'https://res.cloudinary.com/%' AND post.video_url IS NULL)
        OR
        (item.media_type = 'video' AND post.wistia_status = 'ready'
         AND (
           post.video_url LIKE 'https://embed-ssl.wistia.com/%' OR
           post.video_url LIKE 'https://embed.wistia.com/%' OR
           post.video_url LIKE 'https://fast.wistia.com/%' OR
           post.video_url LIKE 'https://fast.wistia.net/%'
         )
         AND post.thumbnail_url LIKE 'https://res.cloudinary.com/%'
         AND post.image_url LIKE 'https://res.cloudinary.com/%'
        )
      );

    IF v_ready_count < 24 THEN
        RETURN 'pending';
    END IF;

    -- Atomically overwrite active posts snapshot
    DELETE FROM public.instagram_active_posts;

    INSERT INTO public.instagram_active_posts (
        id, source_post_id, media_type, image_url, video_url, thumbnail_url, permalink, caption, sort_order
    )
    SELECT
        item.post_id,
        item.post_id,
        item.media_type,
        post.image_url,
        post.video_url,
        post.thumbnail_url,
        item.permalink,
        item.caption,
        item.sort_order
    FROM public.instagram_snapshot_stage_items item
    JOIN public.instagram_posts post ON post.id = item.post_id AND post.source_url_fingerprint = item.source_url_fingerprint
    WHERE item.stage_id = p_stage_id
    ORDER BY item.sort_order;

    -- Assert active insertion count exactly 24
    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
    IF v_inserted_count <> 24 THEN
        RAISE EXCEPTION 'Active insertion count is %, expected exactly 24', v_inserted_count;
    END IF;

    -- Mark previous published stages as superseded
    UPDATE public.instagram_snapshot_stages
    SET status = 'superseded', updated_at = NOW()
    WHERE status = 'published';

    -- Mark current stage as published
    UPDATE public.instagram_snapshot_stages
    SET status = 'published', updated_at = NOW()
    WHERE id = p_stage_id;

    -- Update pipeline state
    INSERT INTO public.instagram_pipeline_state (key, value)
    VALUES ('source_url_version', v_source_url_version)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

    RETURN 'published';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.publish_instagram_stage(UUID) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_instagram_stage(UUID) TO service_role;
