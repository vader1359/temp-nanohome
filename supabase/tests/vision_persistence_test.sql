begin;

set local role postgres;
select plan(52);

select ok((select relrowsecurity from pg_class where oid = 'public.vision_analysis_requests'::regclass), 'vision requests have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.room_scenes'::regclass), 'room scenes have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.vision_object_crops'::regclass), 'object crops have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.product_visual_embeddings'::regclass), 'catalog embeddings have RLS enabled');
select is((select public.get_vision_feature_defaults()), '{"evaluationStorageEnabled": false, "roomAnalysisEnabled": false, "uploadEnabled": false, "visualSimilarityEnabled": false}'::jsonb, 'vision feature defaults are disabled');
select ok((select nspname <> 'public' from pg_namespace where nspname = 'storage'), 'storage is not public');
select ok((select not has_table_privilege('anon', 'public.vision_analysis_requests', 'select')), 'anon cannot read vision requests');
select ok((select not has_table_privilege('authenticated', 'public.product_visual_embeddings', 'select')), 'authenticated cannot read catalog embeddings');
select ok((select not has_table_privilege('authenticated', 'public.vision_analysis_requests', 'delete')), 'authenticated cannot directly delete vision requests');
select ok((select not has_table_privilege('authenticated', 'public.vision_object_crops', 'delete')), 'authenticated cannot directly delete vision crops');
select ok((select not has_table_privilege('authenticated', 'public.vision_analysis_requests', 'insert')), 'authenticated cannot directly insert vision requests');
select ok((select not has_table_privilege('authenticated', 'public.vision_analysis_requests', 'update')), 'authenticated cannot directly update vision requests');
select ok((select not has_table_privilege('authenticated', 'public.vision_object_crops', 'insert')), 'authenticated cannot directly insert vision crops');
select ok((select not has_table_privilege('authenticated', 'public.vision_object_crops', 'update')), 'authenticated cannot directly update vision crops');
select ok((select not has_table_privilege('authenticated', 'storage.objects', 'delete')), 'authenticated cannot directly delete room photos');
select ok((select not has_table_privilege('authenticated', 'storage.objects', 'insert')), 'authenticated cannot directly insert room photos');
select ok((select has_table_privilege('service_role', 'public.vision_analysis_requests', 'insert')), 'service role can insert vision requests');
select ok((select has_table_privilege('service_role', 'public.vision_object_crops', 'insert')), 'service role can insert vision crops');
select ok((select has_function_privilege('service_role', 'public.delete_vision_request(uuid)', 'execute')), 'service role can execute bounded vision deletion');
select ok((select not has_function_privilege('authenticated', 'public.delete_vision_request(uuid)', 'execute')), 'authenticated cannot execute vision deletion');
select ok((select not has_function_privilege('anon', 'public.delete_vision_request(uuid)', 'execute')), 'anon cannot execute vision deletion');

select ok((select exists (select 1 from pg_policies where policyname = 'vision_analysis_requests_owner_select' and tablename = 'vision_analysis_requests')), 'request owner select policy exists');
select ok((select exists (select 1 from pg_policies where policyname = 'room_scenes_owner_select' and tablename = 'room_scenes')), 'scene owner select policy exists');
select ok((select exists (select 1 from pg_policies where policyname = 'vision_object_crops_owner_select' and tablename = 'vision_object_crops')), 'crop owner select policy exists');
select ok((select exists (select 1 from pg_policies where policyname = 'room_photos_owner_read' and schemaname = 'storage' and tablename = 'objects')), 'room photo owner read policy exists');
select ok((select not exists (select 1 from pg_policies where policyname = 'room_photos_owner_write' and schemaname = 'storage' and tablename = 'objects')), 'room photos have no direct owner write policy');
select ok((select not exists (select 1 from pg_policies where policyname = 'vision_analysis_requests_owner_insert' and tablename = 'vision_analysis_requests')), 'request owner insert policy is disabled');
select ok((select not exists (select 1 from pg_policies where policyname = 'vision_analysis_requests_owner_update' and tablename = 'vision_analysis_requests')), 'request owner update policy is disabled');
select ok((select not exists (select 1 from pg_policies where policyname = 'vision_object_crops_owner_insert' and tablename = 'vision_object_crops')), 'crop owner insert policy is disabled');
select ok((select not exists (select 1 from pg_policies where policyname = 'room_photos_owner_delete' and schemaname = 'storage' and tablename = 'objects')), 'room photos have no direct owner delete policy');

select ok((select not exists (select 1 from pg_attribute where attrelid = 'public.vision_analysis_requests'::regclass and attname = 'raw_provider_response')), 'requests do not store raw provider response');
select ok((select not exists (select 1 from pg_attribute where attrelid = 'public.room_scenes'::regclass and attname = 'room_photo')), 'scenes do not store image bytes');
select ok((select not exists (select 1 from pg_attribute where attrelid = 'public.vision_analysis_requests'::regclass and attname in ('signed_url', 'signed_url_token', 'authorization_token'))), 'requests do not store signed URLs or authorization tokens');
select ok((select not exists (select 1 from pg_attribute where attrelid = 'public.product_visual_embeddings'::regclass and attname = 'owner_id')), 'catalog embeddings have no customer owner');
select ok((select exists (select 1 from pg_attribute where attrelid = 'public.product_visual_embeddings'::regclass and attname = 'embedding')), 'catalog embeddings store a vector');
select ok((select exists (select 1 from pg_constraint where conrelid = 'public.product_visual_embeddings'::regclass and contype = 'u')), 'catalog embeddings have uniqueness boundary');

select ok((select relkind = 'r' from pg_class where oid = 'storage.buckets'::regclass), 'storage buckets catalog is available');
select is((select id from storage.buckets where id = 'room-photos'), 'room-photos', 'room photos use a dedicated bucket');
select is((select public from storage.buckets where id = 'room-photos'), false, 'room photos bucket is private');
select ok((select exists (select 1 from pg_constraint where conrelid = 'public.vision_analysis_requests'::regclass and pg_get_constraintdef(oid) like '%owner_id%')), 'requests constrain owner scope');
select ok((select exists (select 1 from pg_constraint where conrelid = 'public.room_scenes'::regclass and pg_get_constraintdef(oid) like '%request_id%')), 'scenes constrain request scope');
select ok((select exists (select 1 from pg_constraint where conrelid = 'public.vision_object_crops'::regclass and pg_get_constraintdef(oid) like '%request_id%')), 'crops constrain request scope');
select ok((select exists (select 1 from pg_constraint where conname = 'vision_analysis_requests_original_path_layout')), 'original paths use request-specific layout');
select ok((select exists (select 1 from pg_constraint where conname = 'vision_analysis_requests_normalized_path_layout')), 'normalized paths use request-specific layout');
select ok((select exists (select 1 from pg_constraint where conname = 'vision_object_crops_path_layout')), 'crop paths use request-specific layout');

select throws_ok($$select public.delete_vision_request('00000000-0000-4000-8000-000000000001')$$, '42501', null, 'non-service deletion is blocked');
set local role service_role;
select lives_ok($$select public.delete_vision_request('00000000-0000-4000-8000-000000000001')$$, 'service deletion is bounded and idempotent');
set local role postgres;
select is((select count(*) from public.product_visual_embeddings), 0::bigint, 'vision deletion does not delete catalog embeddings');
select is((select count(*) from public.orders), 0::bigint, 'vision deletion does not touch orders');
select ok((select prosrc like '%delete from storage.objects%' and prosrc like '%p_request_id%'), 'service deletion covers all request storage objects');
select * from finish();
rollback;
