-- Repair for Instagram Snapshot Staged permalinks to accept reel links
-- Created: 2026-07-12 02:10:00

-- (1) Drop and recreate constraint on public.instagram_snapshot_stage_items
ALTER TABLE public.instagram_snapshot_stage_items
    DROP CONSTRAINT IF EXISTS instagram_snapshot_stage_items_permalink_check;

ALTER TABLE public.instagram_snapshot_stage_items
    ADD CONSTRAINT instagram_snapshot_stage_items_permalink_check
    CHECK (permalink ~ '^https://(www\.)?instagram\.com/(p|reel)/[a-zA-Z0-9_-]+/?$');

-- (2) CREATE OR REPLACE FUNCTION public.begin_instagram_snapshot_stage
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
        WHERE x.permalink IS NULL OR x.permalink ~ '^https://(www\.)?instagram\.com/(p|reel)/[a-zA-Z0-9_-]+/?$' IS NOT TRUE
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

    -- IF duplicate sort orders exist
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

-- Explicitly revoke/grant to preserve security definitions
REVOKE EXECUTE ON FUNCTION public.begin_instagram_snapshot_stage(JSONB, TEXT, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_instagram_snapshot_stage(JSONB, TEXT, TEXT) TO service_role;
