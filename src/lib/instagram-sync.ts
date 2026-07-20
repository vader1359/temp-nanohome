import "server-only";

import { createHash } from "crypto";
import { z } from "zod";

import { env } from "@/lib/env";
import { isR2MediaUrl, uploadRemoteImageToR2 } from "@/lib/r2";
import { createInstagramSyncAdminClient } from "@/lib/supabase/admin";

const MEDIA_FIELDS = [
  "id",
  "caption",
  "media_type",
  "media_url",
  "thumbnail_url",
  "permalink",
  "children{id,media_type,media_url,thumbnail_url,permalink}"
];
const META_GRAPH_API_ORIGIN = "https://graph.facebook.com";
const META_GRAPH_API_VERSION = "v25.0";

const metaMediaSchema = z.object({
  id: z.string().min(1),
  caption: z.string().optional(),
  media_type: z.enum(["IMAGE", "VIDEO", "CAROUSEL_ALBUM"]).or(z.string()),
  media_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
  permalink: z.string().url(),
  children: z.object({
    data: z.array(z.object({
      id: z.string().min(1),
      media_type: z.enum(["IMAGE", "VIDEO"]).or(z.string()),
      media_url: z.string().url().optional(),
      thumbnail_url: z.string().url().optional(),
      permalink: z.string().url().optional(),
    })),
  }).optional(),
});

const metaMediaResponseSchema = z.object({
  data: z.array(metaMediaSchema),
});

type MetaMedia = z.infer<typeof metaMediaSchema>;

export type NormalizedItem = {
  id: string;
  mediaType: "image" | "video";
  imageUrl: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  permalink: string;
  caption?: string;
};

export type InstagramSyncResult = {
  status: "success" | "disabled" | "error" | "pending";
  processedCount: number;
  readyCount: number;
  error: string | null;
};

export type WistiaStatus = "queued" | "processing" | "ready" | "failed";

export function parseWistiaStatus(statusInput: unknown): WistiaStatus {
  if (statusInput === null || statusInput === undefined) {
    throw new Error("Wistia status is missing");
  }

  const inputStr = String(statusInput).trim().toLowerCase();

  switch (inputStr) {
    case "0":
    case "queued":
      return "queued";
    case "2":
    case "processing":
      return "processing";
    case "1":
    case "ready":
      return "ready";
    case "-1":
    case "failed":
      return "failed";
    default:
      throw new Error(`Unknown Wistia status: ${statusInput}`);
  }
}

export function validateMetaUrl(urlString: string): URL {
  const url = new URL(urlString);
  if (url.protocol !== "https:") {
    throw new Error("Invalid URL protocol, expected HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("URL contains credentials");
  }
  if (url.port !== "" && url.port !== "443") {
    throw new Error("URL uses a non-default port");
  }
  const hostname = url.hostname.toLowerCase();
  const isLookaside = hostname === "lookaside.fbsbx.com";
  const isInstagramCdn = hostname === "scontent.cdninstagram.com" ||
    (hostname.endsWith(".cdninstagram.com") && !hostname.includes("facebook") && !hostname.includes("fbsbx"));

  if (!isLookaside && !isInstagramCdn) {
    throw new Error(`Hostname not allowed: ${url.hostname}`);
  }
  return url;
}

export function validateWistiaAssetUrl(urlString: string): URL {
  const url = new URL(urlString);
  if (url.protocol !== "https:") {
    throw new Error("Invalid URL protocol, expected HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("URL contains credentials");
  }
  if (url.port !== "" && url.port !== "443") {
    throw new Error("URL uses a non-default port");
  }
  const hostname = url.hostname.toLowerCase();
  const allowedWistiaHosts = [
    "embed-ssl.wistia.com",
    "embed.wistia.com",
    "fast.wistia.com",
    "fast.wistia.net",
  ];
  if (!allowedWistiaHosts.includes(hostname)) {
    throw new Error(`Hostname not allowed: ${url.hostname}`);
  }
  return url;
}

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactError(err: unknown): string {
  if (!err) return "Unknown error";
  let message = err instanceof Error ? err.message : String(err);
  if (env.CLOUDINARY_URL) {
    message = message.replace(new RegExp(escapeRegExp(env.CLOUDINARY_URL), "g"), "[CLOUDINARY_URL_REDACTED]");
  }
  if (env.WISTIA_API_TOKEN) {
    message = message.replace(new RegExp(escapeRegExp(env.WISTIA_API_TOKEN), "g"), "[WISTIA_API_TOKEN_REDACTED]");
  }
  if (env.INSTAGRAM_ACCESS_TOKEN) {
    message = message.replace(new RegExp(escapeRegExp(env.INSTAGRAM_ACCESS_TOKEN), "g"), "[INSTAGRAM_ACCESS_TOKEN_REDACTED]");
  }
  return message;
}

export function parseCloudinaryUrl(urlStr: string) {
  const parsed = new URL(urlStr);
  if (parsed.protocol !== "cloudinary:") {
    throw new Error("Invalid Cloudinary URL protocol");
  }
  const apiKey = parsed.username;
  const apiSecret = parsed.password;
  const cloudName = parsed.hostname;
  if (!apiKey || !apiSecret || !cloudName) {
    throw new Error("Missing credentials or cloud name in CLOUDINARY_URL");
  }
  return { apiKey, apiSecret, cloudName };
}

function generateSignature(params: Record<string, string | number>, apiSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  const serialized = sortedKeys
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(serialized + apiSecret).digest("hex");
}

function boundErrorText(text: string): string {
  return text.slice(0, 200);
}

export async function uploadToCloudinary(
  fileUrl: string,
  publicId: string,
  resourceType: "image" | "video",
  cloudinaryUrl: string,
  signal?: AbortSignal
): Promise<string> {
  const { apiKey, apiSecret, cloudName } = parseCloudinaryUrl(cloudinaryUrl);
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    public_id: publicId,
    timestamp: timestamp,
  };
  const signature = generateSignature(paramsToSign, apiSecret);

  const formData = new URLSearchParams();
  formData.append("file", fileUrl);
  formData.append("public_id", publicId);
  formData.append("timestamp", String(timestamp));
  formData.append("api_key", apiKey);
  formData.append("signature", signature);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
  const response = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
    signal: signal || AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Cloudinary upload failed: ${response.statusText} - ${boundErrorText(errText)}`);
  }

  const data = await response.json();
  if (!data.secure_url) {
    throw new Error("Cloudinary response did not contain secure_url");
  }
  return data.secure_url;
}

function isManagedImageUrl(url: string | null | undefined): boolean {
  return Boolean(url?.startsWith("https://res.cloudinary.com/")) || isR2MediaUrl(url);
}

async function uploadInstagramImage(sourceUrl: string, key: string, signal?: AbortSignal): Promise<string> {
  if (env.CF_R2_ACCESS_KEY_ID && env.CF_R2_SECRET_ACCESS_KEY && env.CF_R2_ENDPOINT && env.CF_R2_BUCKET && env.NEXT_PUBLIC_MEDIA_URL) {
    return uploadRemoteImageToR2(sourceUrl, `instagram/${key}`, signal);
  }
  if (!env.CLOUDINARY_URL) throw new Error("Neither R2 nor Cloudinary image storage is configured");
  return uploadToCloudinary(sourceUrl, key, "image", env.CLOUDINARY_URL, signal);
}

export async function importVideoToWistia(
  videoUrl: string,
  name: string,
  apiToken: string,
  signal?: AbortSignal
): Promise<{ hashed_id: string; status: WistiaStatus }> {
  const response = await fetch("https://upload.wistia.com", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      url: videoUrl,
      name: name,
    }),
    signal: signal || AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Wistia upload failed: ${response.statusText} - ${boundErrorText(errText)}`);
  }

  const data = await response.json();
  if (!data.hashed_id) {
    throw new Error("Wistia upload response did not contain hashed_id");
  }

  const statusStr = parseWistiaStatus(data.status);
  return {
    hashed_id: data.hashed_id,
    status: statusStr,
  };
}

export async function checkWistiaStatus(
  hashedId: string,
  apiToken: string,
  signal?: AbortSignal
): Promise<WistiaStatus> {
  const url = `https://api.wistia.com/v1/medias/${hashedId}.json`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
    signal: signal || AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Wistia status check failed: ${res.statusText} - ${boundErrorText(errText)}`);
  }
  const data = await res.json();
  return parseWistiaStatus(data.status);
}

export async function fetchWistiaVideoAssetUrl(
  hashedId: string,
  apiToken: string,
  signal?: AbortSignal
): Promise<string> {
  const url = `https://api.wistia.com/v1/medias/${hashedId}.json`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
    signal: signal || AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Wistia asset fetch failed: ${res.statusText} - ${boundErrorText(errText)}`);
  }
  const data = await res.json();
  const assets = data.assets || [];

  for (const asset of assets) {
    if (asset && asset.url) {
      const ext = typeof asset.ext === "string" ? asset.ext.trim().toLowerCase() : "";
      const contentType = typeof asset.contentType === "string" ? asset.contentType.trim().toLowerCase() : "";
      const isMp4 = ext === "mp4" || contentType === "video/mp4";

      if (!isMp4) {
        continue;
      }

      const assetUrl = asset.url;
      try {
        validateWistiaAssetUrl(assetUrl);
        return assetUrl;
      } catch {
        // Skip invalid URL and try the next asset
      }
    }
  }

  throw new Error("No valid playable video asset found in Wistia response");
}

function normalizeMetaMedia(media: MetaMedia): readonly NormalizedItem[] {
  const children = media.children?.data;
  if (media.media_type === "CAROUSEL_ALBUM" && children !== undefined && children.length > 0) {
    return children.flatMap((child, index) => normalizeMediaItem({
      ...child,
      permalink: child.permalink ?? media.permalink,
      caption: index === 0 ? media.caption : undefined,
    }));
  }

  return normalizeMediaItem(media.media_type === "CAROUSEL_ALBUM" ? { ...media, media_type: "IMAGE" } : media);
}

function normalizeMediaItem(media: {
  id: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  caption?: string;
}): readonly NormalizedItem[] {
  switch (media.media_type) {
    case "IMAGE":
      return (media.media_url ?? media.thumbnail_url) === undefined ? [] : [{
        id: media.id,
        mediaType: "image",
        imageUrl: media.media_url ?? media.thumbnail_url!,
        permalink: media.permalink,
        caption: media.caption,
      }];
    case "VIDEO":
      if (media.media_url !== undefined && media.thumbnail_url !== undefined) {
        return [{
          id: media.id,
          mediaType: "video",
          imageUrl: media.thumbnail_url,
          videoUrl: media.media_url,
          thumbnailUrl: media.thumbnail_url,
          permalink: media.permalink,
          caption: media.caption,
        }];
      }
      return media.thumbnail_url === undefined ? [] : [{
        id: media.id,
        mediaType: "image",
        imageUrl: media.thumbnail_url,
        permalink: media.permalink,
        caption: media.caption,
      }];
    default:
      return [];
  }
}

export function requiredCandidateWorkMs(
  post: NormalizedItem,
  existing?: {
    image_url?: string | null;
    thumbnail_url?: string | null;
    wistia_hashed_id?: string | null;
    wistia_status?: string | null;
    source_url_fingerprint?: string | null;
  } | null,
  forceReingestion: boolean = false
): number {
  const sourceUrlString = `${post.imageUrl}|${post.videoUrl || ""}`;
  const newFingerprint = createHash("sha256").update(sourceUrlString).digest("hex");
  const isSourceChanged = !existing || existing.source_url_fingerprint !== newFingerprint;
  const localForceReingestion = forceReingestion || isSourceChanged;

  if (post.mediaType === "image") {
    const needsImageUpload = localForceReingestion || !isManagedImageUrl(existing?.image_url);
    return needsImageUpload ? 15000 : 0;
  }

  const needsPosterUpload = localForceReingestion || !isManagedImageUrl(existing?.thumbnail_url);
  const wistiaHashedId = localForceReingestion ? null : (existing?.wistia_hashed_id || null);
  const wistiaStatus = localForceReingestion ? null : (existing?.wistia_status || null);

  let wistiaTime = 0;
  if (env.WISTIA_API_TOKEN) {
    if (!wistiaHashedId || wistiaStatus === "failed") {
      wistiaTime = 15000;
    } else if (wistiaStatus !== "ready") {
      wistiaTime = 20000;
    }
  }

  if (!wistiaHashedId || wistiaStatus === "failed") {
    const posterUploadTime = needsPosterUpload ? 15000 : 0;
    return Math.max(wistiaTime, posterUploadTime);
  }

  return wistiaTime;
}

function getTimeoutSignal(
  jobSignal: AbortSignal,
  limitMs: number,
  reserveMs: number,
  remainingMsFn: () => number
): AbortSignal {
  const timeoutMs = Math.min(limitMs, Math.max(0, remainingMsFn() - reserveMs));
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([jobSignal, AbortSignal.timeout(timeoutMs)]);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException("The operation was aborted.", "AbortError"));
  }, timeoutMs);
  const onAbort = () => {
    clearTimeout(timeoutId);
    controller.abort(jobSignal.reason ?? new DOMException("The operation was aborted.", "AbortError"));
  };
  if (jobSignal.aborted) {
    onAbort();
  } else {
    jobSignal.addEventListener("abort", onAbort);
  }
  return controller.signal;
}

export type RunInstagramSyncOptions = {
  readonly startTime?: number;
  readonly maxDurationMs?: number;
  readonly clock?: () => number;
};

export async function runInstagramSync(
  options: RunInstagramSyncOptions = {}
): Promise<InstagramSyncResult> {
  const startTime = options.startTime ?? (options.clock ? options.clock() : Date.now());
  const maxDurationMs = options.maxDurationMs ?? 55000;
  const getNow = options.clock ?? Date.now;
  const remainingMs = () => maxDurationMs - (getNow() - startTime);

  const jobAbortController = new AbortController();
  const jobTimeout = setTimeout(() => {
    jobAbortController.abort(new DOMException("Job deadline exceeded", "AbortError"));
  }, Math.max(0, remainingMs()));

  const PERSISTENCE_RESERVE_MS = 8000;
  const EXIT_RESERVE_MS = 3000;
  const TIME_AND_PERSIST_RESERVE_MS = PERSISTENCE_RESERVE_MS + EXIT_RESERVE_MS; // 11s total

  const hasCreds = !!(
    env.INSTAGRAM_ACCESS_TOKEN &&
    env.INSTAGRAM_BUSINESS_ACCOUNT_ID &&
    (env.CLOUDINARY_URL || (env.CF_R2_ACCESS_KEY_ID && env.CF_R2_SECRET_ACCESS_KEY && env.CF_R2_ENDPOINT && env.CF_R2_BUCKET && env.NEXT_PUBLIC_MEDIA_URL)) &&
    env.WISTIA_API_TOKEN
  );

  if (!hasCreds) {
    clearTimeout(jobTimeout);
    return {
      status: "disabled",
      processedCount: 0,
      readyCount: 0,
      error: "Missing required configuration variables (access token, account ID, image storage, or Wistia API token)",
    };
  }

  try {
    if (jobAbortController.signal.aborted) {
      throw jobAbortController.signal.reason ?? new DOMException("Job aborted", "AbortError");
    }

    const supabase = createInstagramSyncAdminClient(jobAbortController.signal);
    const currentVersion = `${META_GRAPH_API_VERSION}:${env.INSTAGRAM_BUSINESS_ACCOUNT_ID}`;

    // Get the active stage or currently building stage
    const { data: stages, error: stagesError } = await supabase
      .from("instagram_snapshot_stages" as any)
      .select("id, status, selection_key, source_url_version")
      .in("status", ["building"])
      .order("created_at", { ascending: false });

    if (stagesError) {
      console.error("Error reading stages:", redactError(stagesError));
    }

    const activeStage = (stages as any)?.[0] || null;
    let stageId = activeStage?.id || null;
    let stageItems: any[] = [];

    if (activeStage) {
      // P0 1: Resume stable stage only; do not fetch Meta or begin a new stage
      const { data: workData, error: workError } = await supabase.rpc("get_instagram_stage_work" as any, {
        p_stage_id: stageId,
      });

      if (workError) {
        throw new Error(`Failed to load stage work: ${workError.message}`);
      }
      stageItems = workData as any[];
    } else {
      // Fetch Meta feed to begin a new stage only when no current stage exists
      if (remainingMs() < TIME_AND_PERSIST_RESERVE_MS) {
        throw new DOMException("Insufficient time to start sync", "AbortError");
      }

      const feedUrl = new URL(`/${META_GRAPH_API_VERSION}/${env.INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`, META_GRAPH_API_ORIGIN);
      feedUrl.searchParams.set("fields", MEDIA_FIELDS.join(","));
      feedUrl.searchParams.set("access_token", env.INSTAGRAM_ACCESS_TOKEN!);
      feedUrl.searchParams.set("limit", "50");

      const feedSignal = getTimeoutSignal(jobAbortController.signal, 15000, TIME_AND_PERSIST_RESERVE_MS, remainingMs);

      const response = await fetch(feedUrl, { signal: feedSignal });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Meta Graph API returned status ${response.status}: ${boundErrorText(errText)}`);
      }

      const payload = await response.json();
      const parsedResponse = metaMediaResponseSchema.safeParse(payload);
      if (!parsedResponse.success) {
        throw new Error(`Meta Graph API response validation failed: ${parsedResponse.error.message}`);
      }

      const rawItems = parsedResponse.data.data.flatMap(normalizeMetaMedia);

      // Deduplicate feed
      const uniqueItems: NormalizedItem[] = [];
      const seenIds = new Set<string>();
      for (const item of rawItems) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          uniqueItems.push(item);
        }
      }

      const videoItems = uniqueItems.filter((item) => item.mediaType === "video");
      const imageItems = uniqueItems.filter((item) => item.mediaType === "image");

      if (videoItems.length < 3 || imageItems.length < 21) {
        clearTimeout(jobTimeout);
        return {
          status: "success",
          processedCount: 0,
          readyCount: 0,
          error: `Insufficient candidate media count. Found ${videoItems.length} videos and ${imageItems.length} images, need exactly 3 videos and 21 images.`,
        };
      }

      const newestVideos = videoItems.slice(0, 3);
      const newestImages = imageItems.slice(0, 21);

      const selectedIds = new Set([
        ...newestVideos.map((v) => v.id),
        ...newestImages.map((i) => i.id),
      ]);

      const selectionCandidates = uniqueItems.filter((item) => selectedIds.has(item.id));
      // Assign 1..24 sort_order based on chronological feed order
      const selection = selectionCandidates.map((item, idx) => {
        const sourceUrlString = `${item.imageUrl}|${item.videoUrl || ""}`;
        const source_url_fingerprint = createHash("sha256").update(sourceUrlString).digest("hex");
        return {
          id: item.id,
          media_type: item.mediaType,
          source_url_fingerprint,
          sort_order: idx + 1,
          permalink: item.permalink,
          caption: item.caption || null,
          image_url: item.imageUrl,
          video_url: item.videoUrl || null,
        };
      });

      // Calculate canonical SHA-256 selection key
      const sortedSelection = [...selection].sort((a, b) => a.sort_order - b.sort_order);
      const serializedSelection = sortedSelection
        .map(item => `${item.id}:${item.media_type}:${item.source_url_fingerprint}:${item.sort_order}`)
        .join(",");
      const hashInput = `${serializedSelection}|${currentVersion}`;
      const selection_key = createHash("sha256").update(hashInput).digest("hex");

      if (remainingMs() < TIME_AND_PERSIST_RESERVE_MS) {
        throw new DOMException("Insufficient time to begin stage", "AbortError");
      }

      const { data: newStageId, error: beginError } = await supabase.rpc("begin_instagram_snapshot_stage" as any, {
        p_selection: selection,
        p_source_url_version: currentVersion,
        p_selection_key: selection_key,
      });

      if (beginError) {
        throw new Error(`Failed to begin snapshot stage: ${beginError.message}`);
      }

      stageId = newStageId as any;

      // Load work from stage items
      const { data: workData, error: workError } = await supabase.rpc("get_instagram_stage_work" as any, {
        p_stage_id: stageId,
      });

      if (workError) {
        throw new Error(`Failed to load stage work: ${workError.message}`);
      }

      stageItems = workData as any[];
    }

    // 1. Poll status of active pending videos for *this stage* in the database.
    if (env.WISTIA_API_TOKEN) {
      const { data: pendingVideos, error: pendingError } = await supabase.rpc("get_instagram_stage_pending_videos" as any, {
        p_stage_id: stageId,
      });

      if (pendingError) {
        console.error("Error fetching stage pending videos:", redactError(pendingError));
      } else if (pendingVideos && pendingVideos.length > 0) {
        for (const video of pendingVideos as any[]) {
          const remaining = remainingMs();
          // Wistia status check (10s) + asset fetch (10s) + persist (8s) + exit (3s) = 31s
          const WISTIA_CHECK_RESERVE_MS = 10000 + 10000 + PERSISTENCE_RESERVE_MS + EXIT_RESERVE_MS;
          if (remaining < WISTIA_CHECK_RESERVE_MS) {
            console.warn(`Stopping pending video polling: insufficient remaining time.`);
            break;
          }
          if (jobAbortController.signal.aborted) {
            break;
          }

          if (video.wistia_hashed_id) {
            try {
              const statusSignal = getTimeoutSignal(jobAbortController.signal, 10000, TIME_AND_PERSIST_RESERVE_MS, remainingMs);

              const rawStatus = await checkWistiaStatus(video.wistia_hashed_id, env.WISTIA_API_TOKEN, statusSignal);
              const newStatus = parseWistiaStatus(rawStatus);

              if (newStatus !== video.wistia_status) {
                let updatedVideoUrl = null;
                if (newStatus === "ready") {
                  const assetSignal = getTimeoutSignal(jobAbortController.signal, 10000, TIME_AND_PERSIST_RESERVE_MS, remainingMs);
                  updatedVideoUrl = await fetchWistiaVideoAssetUrl(video.wistia_hashed_id, env.WISTIA_API_TOKEN, assetSignal);
                }

                if (jobAbortController.signal.aborted) {
                  break;
                }

                const { error: updateError } = await supabase.rpc("update_instagram_stage_wistia_status" as any, {
                  p_stage_id: stageId,
                  p_post_id: video.id,
                  p_source_url_fingerprint: video.source_url_fingerprint,
                  p_status: newStatus,
                  p_video_url: updatedVideoUrl || "",
                });

                if (updateError) {
                  console.error(`Error updating Wistia status via RPC for ${video.id}:`, redactError(updateError.message));
                }
              }
            } catch (err: any) {
              console.error(`Error polling Wistia status for video ${video.id}:`, redactError(err));
            }
          }
        }
      }
    }

    if (jobAbortController.signal.aborted) {
      throw jobAbortController.signal.reason ?? new DOMException("Job aborted", "AbortError");
    }

    // 2. Bounded processing: max 2 costly operations per job
    let costLimit = 2;
    const processedDrafts: any[] = [];

    for (const item of stageItems) {
      if (jobAbortController.signal.aborted) {
        break;
      }

      // Check if item needs upload/import work
      const needsImageUpload = item.media_type === "image" && !isManagedImageUrl(item.draft_image_url);
      const needsVideoImport = item.media_type === "video" && ((!item.wistia_hashed_id || item.wistia_status === "failed") && !!env.WISTIA_API_TOKEN);
      const needsVideoPoster = item.media_type === "video" && !isManagedImageUrl(item.draft_thumbnail_url);

      const isCostly = needsImageUpload || needsVideoImport || needsVideoPoster;

      if (isCostly) {
        if (costLimit <= 0) {
          // Bounded sync limit reached. We stop costly operations and skip.
          continue;
        }

        const normalizedCandidate: NormalizedItem = {
          id: item.id,
          mediaType: item.media_type as "image" | "video",
          imageUrl: item.meta_image_url,
          videoUrl: item.meta_video_url || undefined,
          permalink: item.permalink,
          caption: item.caption || undefined,
        };

        const neededWorkMs = requiredCandidateWorkMs(normalizedCandidate, {
          image_url: item.draft_image_url,
          thumbnail_url: item.draft_thumbnail_url,
          wistia_hashed_id: item.wistia_hashed_id,
          wistia_status: item.wistia_status,
          source_url_fingerprint: item.source_url_fingerprint,
        }, false);

        if (remainingMs() < neededWorkMs + TIME_AND_PERSIST_RESERVE_MS) {
          console.warn(`Stopping candidate processing: insufficient remaining time for post ${item.id}.`);
          break;
        }

        try {
          let cloudinaryImageUrl = item.draft_image_url || "";
          let cloudinaryPosterUrl = item.media_type === "video" ? (item.draft_thumbnail_url || null) : null;
          let wistiaHashedId = item.media_type === "video" ? (item.wistia_hashed_id || null) : null;
          let wistiaStatus = item.media_type === "video" ? (item.wistia_status || null) : null;
          let wistiaVideoUrl = item.media_type === "video" ? (item.draft_video_url || null) : null;

          if (item.media_type === "video") {
            const validatedPosterUrl = validateMetaUrl(item.meta_image_url).toString();
            const validatedVideoUrl = validateMetaUrl(item.meta_video_url!).toString();

            let cloudinaryPosterPromise: Promise<string>;
            if (isManagedImageUrl(cloudinaryPosterUrl)) {
              cloudinaryPosterPromise = Promise.resolve(cloudinaryPosterUrl);
            } else {
              const posterUploadSignal = getTimeoutSignal(jobAbortController.signal, 15000, TIME_AND_PERSIST_RESERVE_MS, remainingMs);
              cloudinaryPosterPromise = uploadInstagramImage(
                validatedPosterUrl,
                `instagram_${item.id}_poster`,
                posterUploadSignal
              );
            }

            let wistiaImportPromise: Promise<{ hashed_id: string; status: WistiaStatus } | null>;
            if (env.WISTIA_API_TOKEN && (!wistiaHashedId || item.wistia_status === "failed")) {
              const importSignal = getTimeoutSignal(jobAbortController.signal, 15000, TIME_AND_PERSIST_RESERVE_MS, remainingMs);
              wistiaImportPromise = importVideoToWistia(
                validatedVideoUrl,
                item.caption || `Instagram video ${item.id}`,
                env.WISTIA_API_TOKEN,
                importSignal
              );
            } else {
              wistiaImportPromise = Promise.resolve(null);
            }

            const [posterUrlResult, wistiaImportResult] = await Promise.all([
              cloudinaryPosterPromise,
              wistiaImportPromise,
            ]);

            cloudinaryImageUrl = posterUrlResult;
            cloudinaryPosterUrl = posterUrlResult;

            if (wistiaImportResult) {
              wistiaHashedId = wistiaImportResult.hashed_id;
              wistiaStatus = "processing";
              wistiaVideoUrl = null;
            }
          } else {
            // Image case
            const validatedUrl = validateMetaUrl(item.meta_image_url).toString();
            const imageUploadSignal = getTimeoutSignal(jobAbortController.signal, 15000, TIME_AND_PERSIST_RESERVE_MS, remainingMs);
            cloudinaryImageUrl = await uploadInstagramImage(
              validatedUrl,
              `instagram_${item.id}`,
              imageUploadSignal
            );
          }

          const dbRow = {
            id: item.id,
            media_type: item.media_type,
            image_url: cloudinaryImageUrl,
            video_url: wistiaVideoUrl,
            thumbnail_url: cloudinaryPosterUrl,
            permalink: item.permalink,
            caption: item.caption || null,
            wistia_hashed_id: wistiaHashedId,
            wistia_status: wistiaStatus,
            source_url_fingerprint: item.source_url_fingerprint,
          };

          // Persist each processed item immediately
          if (remainingMs() < TIME_AND_PERSIST_RESERVE_MS) {
            console.warn(`Insufficient time to save item drafts for post ${item.id}.`);
            break;
          }

          const { error: saveError } = await supabase.rpc("save_instagram_stage_drafts" as any, {
            p_stage_id: stageId,
            p_posts: [dbRow],
          });

          if (saveError) {
            throw new Error(`Failed to save draft progress for post ${item.id}: ${saveError.message}`);
          }

          processedDrafts.push(dbRow);
          costLimit--;
        } catch (err: any) {
          console.error(`Failed to process Instagram post ${item.id}:`, redactError(err));
        }
      }
    }

    if (jobAbortController.signal.aborted) {
      throw jobAbortController.signal.reason ?? new DOMException("Job aborted", "AbortError");
    }

    // Try to publish snapshot from the stage every invocation
    if (remainingMs() < TIME_AND_PERSIST_RESERVE_MS) {
      clearTimeout(jobTimeout);
      return {
        status: "pending",
        processedCount: processedDrafts.length,
        readyCount: 0,
        error: "Insufficient time remaining to publish",
      };
    }

    const { data: publishResult, error: publishError } = await supabase.rpc("publish_instagram_stage" as any, {
      p_stage_id: stageId,
    });

    if (publishError) {
      throw new Error(`Supabase publish_instagram_stage RPC failed: ${publishError.message}`);
    }

    clearTimeout(jobTimeout);

    if (publishResult === "published") {
      return {
        status: "success",
        processedCount: processedDrafts.length,
        readyCount: 24,
        error: null,
      };
    } else {
      return {
        status: "pending",
        processedCount: processedDrafts.length,
        readyCount: 0,
        error: "Stage is building/pending and is not yet fully ready for publication",
      };
    }
  } catch (err: any) {
    clearTimeout(jobTimeout);
    return {
      status: "error",
      processedCount: 0,
      readyCount: 0,
      error: redactError(err),
    };
  }
}
