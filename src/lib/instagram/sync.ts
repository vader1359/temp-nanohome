import "server-only";

import { env } from "@/lib/env";
import { createInstagramSyncAdminClient } from "@/lib/supabase/admin";

const API_VERSION = "v22.0";
const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type SyncState = { access_token: string; account_id: string; expires_at: string };
type Media = { id: string; caption?: string; media_type: string; media_url?: string; permalink?: string; thumbnail_url?: string; timestamp?: string };
export type InstagramSyncResult = { status: "success" | "failed"; itemsProcessed: number; error: string | null; expiresAt: string | null };

export async function runInstagramSync(): Promise<InstagramSyncResult> {
  const supabase = createInstagramSyncAdminClient();
  try {
    let state = await readOrSeedState();
    if (new Date(state.expires_at).getTime() - Date.now() < REFRESH_WINDOW_MS) state = await refreshState(state);
    const media = await fetchMedia(state);
    const { error } = await supabase.from("instagram_media").upsert(media.map((item) => ({
      id: item.id, caption: item.caption ?? null, media_type: item.media_type, media_url: item.media_url ?? null,
      permalink: item.permalink ?? null, thumbnail_url: item.thumbnail_url ?? null, published_at: item.timestamp ?? null, synced_at: new Date().toISOString(),
    })));
    if (error !== null) throw error;
    const { error: stateError } = await supabase.from("instagram_sync_state").upsert({ sync_key: "primary", ...state, updated_at: new Date().toISOString() });
    if (stateError !== null) throw stateError;
    return { status: "success", itemsProcessed: media.length, error: null, expiresAt: state.expires_at };
  } catch (error) {
    return { status: "failed", itemsProcessed: 0, error: error instanceof Error ? error.message : "Instagram sync failed", expiresAt: null };
  }
}

async function readOrSeedState(): Promise<SyncState> {
  const supabase = createInstagramSyncAdminClient();
  const { data, error } = await supabase.from("instagram_sync_state").select("access_token,account_id,expires_at").eq("sync_key", "primary").maybeSingle();
  if (error !== null) throw error;
  if (data !== null) return data;
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_BUSINESS_ACCOUNT_ID) throw new Error("Missing Instagram credentials");
  return { access_token: env.INSTAGRAM_ACCESS_TOKEN, account_id: env.INSTAGRAM_BUSINESS_ACCOUNT_ID, expires_at: await tokenExpiry(env.INSTAGRAM_ACCESS_TOKEN) };
}

async function refreshState(state: SyncState): Promise<SyncState> {
  if (!env.META_APP_ID || !env.META_APP_SECRET) throw new Error("Missing Meta app credentials");
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/oauth/access_token`);
  url.search = new URLSearchParams({ grant_type: "fb_exchange_token", client_id: env.META_APP_ID, client_secret: env.META_APP_SECRET, fb_exchange_token: state.access_token }).toString();
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json() as { access_token?: string; expires_in?: number };
  if (!response.ok || !payload.access_token || !payload.expires_in) throw new Error(`Instagram token refresh failed (${response.status})`);
  return { ...state, access_token: payload.access_token, expires_at: new Date(Date.now() + payload.expires_in * 1000).toISOString() };
}

async function fetchMedia(state: SyncState): Promise<Media[]> {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${state.account_id}/media`);
  url.search = new URLSearchParams({ fields: "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp", limit: "25", access_token: state.access_token }).toString();
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json() as { data?: Media[] };
  if (!response.ok) throw new Error(`Instagram media fetch failed (${response.status})`);
  return payload.data ?? [];
}

async function tokenExpiry(token: string): Promise<string> {
  if (!env.META_APP_ID || !env.META_APP_SECRET) throw new Error("Missing Meta app credentials");
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/debug_token`);
  url.search = new URLSearchParams({ input_token: token, access_token: `${env.META_APP_ID}|${env.META_APP_SECRET}` }).toString();
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json() as { data?: { expires_at?: number } };
  if (!response.ok || !payload.data?.expires_at) throw new Error(`Instagram token inspection failed (${response.status})`);
  return new Date(payload.data.expires_at * 1000).toISOString();
}
