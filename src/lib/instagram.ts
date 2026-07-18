import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { InstagramPost } from "@/lib/instagram-post";

export type { InstagramPost } from "@/lib/instagram-post";

export type InstagramFeedConfig = {
  readonly accessToken: string;
  readonly businessAccountId: string;
};

const FALLBACK_POSTS: readonly InstagramPost[] = Array.from({ length: 10 }, (_, index) => {
  const postNumber = index + 1;

  return {
    id: `fallback-${postNumber}`,
    mediaType: "image",
    imageUrl: `/images/home/instagram/instagram-${postNumber}.jpg`,
    permalink: "https://www.instagram.com/nanohome_gallery/",
    caption: undefined,
  };
});

export function createInstagramFeedConfig(env: {
  readonly INSTAGRAM_ACCESS_TOKEN?: string;
  readonly INSTAGRAM_BUSINESS_ACCOUNT_ID?: string;
}): InstagramFeedConfig | null {
  if (env.INSTAGRAM_ACCESS_TOKEN === undefined || env.INSTAGRAM_BUSINESS_ACCOUNT_ID === undefined) {
    return null;
  }

  return {
    accessToken: env.INSTAGRAM_ACCESS_TOKEN,
    businessAccountId: env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
  };
}

export async function getInstagramPosts(
  _config?: unknown,
): Promise<readonly InstagramPost[]> {
  void _config;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("instagram_active_posts")
      .select("id, source_post_id, media_type, image_url, video_url, thumbnail_url, permalink, caption, sort_order")
      .order("sort_order", { ascending: true })
      .limit(25);

    if (error || !data || data.length !== 24) {
      return FALLBACK_POSTS;
    }

    const posts: InstagramPost[] = [];
    const seenIds = new Set<string>();

    for (let i = 0; i < 24; i++) {
      const row = data[i]!;

      // Verify contiguous sort_order 1..24
      if (row.sort_order !== i + 1) {
        return FALLBACK_POSTS;
      }

      // Verify ID
      if (!row.id || typeof row.id !== "string" || row.id.trim() === "") {
        return FALLBACK_POSTS;
      }
      if (seenIds.has(row.id)) {
        return FALLBACK_POSTS;
      }
      seenIds.add(row.id);

      // Verify permalink
      if (!isValidPermalink(row.permalink)) {
        return FALLBACK_POSTS;
      }

      const mediaType = row.media_type?.toLowerCase();
      if (mediaType === "image") {
        if (!isValidCloudinaryUrl(row.image_url)) {
          return FALLBACK_POSTS;
        }
        posts.push({
          id: row.id,
          mediaType: "image",
          imageUrl: row.image_url,
          permalink: row.permalink,
          caption: row.caption ?? undefined,
        });
      } else if (mediaType === "video") {
        if (!isValidWistiaUrl(row.video_url)) {
          return FALLBACK_POSTS;
        }
        if (!isValidCloudinaryUrl(row.thumbnail_url)) {
          return FALLBACK_POSTS;
        }
        posts.push({
          id: row.id,
          mediaType: "video",
          videoUrl: row.video_url!,
          thumbnailUrl: row.thumbnail_url!,
          permalink: row.permalink,
          caption: row.caption ?? undefined,
        });
      } else {
        return FALLBACK_POSTS;
      }
    }

    if (posts.length !== 24) {
      return FALLBACK_POSTS;
    }

    const videoCount = posts.filter((p) => p.mediaType === "video").length;
    const imageCount = posts.filter((p) => p.mediaType === "image").length;

    if (videoCount !== 3 || imageCount !== 21) {
      return FALLBACK_POSTS;
    }

    return posts;
  } catch {
    return FALLBACK_POSTS;
  }
}

function isValidCloudinaryUrl(urlStr: string | null | undefined): boolean {
  if (!urlStr) return false;
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    if (url.port !== "" && url.port !== "443") return false;
    return url.hostname.toLowerCase() === "res.cloudinary.com";
  } catch {
    return false;
  }
}

function isValidWistiaUrl(urlStr: string | null | undefined): boolean {
  if (!urlStr) return false;
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    if (url.port !== "" && url.port !== "443") return false;
    const hostname = url.hostname.toLowerCase();
    const allowedWistiaHosts = [
      "embed-ssl.wistia.com",
      "embed.wistia.com",
      "fast.wistia.com",
      "fast.wistia.net",
    ];
    return allowedWistiaHosts.includes(hostname);
  } catch {
    return false;
  }
}

function isValidPermalink(urlStr: string | null | undefined): boolean {
  if (!urlStr || /(?:^|\/)\.\.(?:\/|$)/.test(urlStr)) return false;
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    if (url.port !== "" && url.port !== "443") return false;
    const hostname = url.hostname.toLowerCase();
    if (hostname !== "www.instagram.com" && hostname !== "instagram.com") return false;

    // Reject query parameters or fragments
    if (url.search !== "" || url.hash !== "") return false;

    const path = url.pathname;
    if (!path.startsWith("/")) return false;
    if (path.includes("//") || path.includes("\\") || path.includes("..")) return false;

    const pathRegex = /^\/(p|reel)\/[a-zA-Z0-9_-]+\/?$/;
    return pathRegex.test(path);
  } catch {
    return false;
  }
}
