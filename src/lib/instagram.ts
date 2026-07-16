import "server-only";

import { z } from "zod";

import { env } from "@/lib/env";
import type { InstagramPost } from "@/lib/instagram-post";

export type { InstagramPost } from "@/lib/instagram-post";

export type InstagramFeedConfig = {
  readonly accessToken: string;
  readonly businessAccountId: string;
};

const instagramFeedConfig = createInstagramFeedConfig(env);

const MEDIA_FIELDS = ["id", "caption", "media_type", "media_url", "thumbnail_url", "permalink", "children{ id, media_type, media_url, thumbnail_url, permalink }"] as const;
const META_GRAPH_API_ORIGIN = "https://graph.facebook.com";
const META_GRAPH_API_VERSION = "v25.0";
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

const metaMediaSchema = z.object({
  id: z.string().min(1),
  caption: z.string().optional(),
  media_type: z.enum(["IMAGE", "VIDEO", "CAROUSEL_ALBUM"]).or(z.string()),
  media_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
  permalink: z.string().url(),
  children: z.array(z.object({
    id: z.string().min(1),
    media_type: z.enum(["IMAGE", "VIDEO"]).or(z.string()),
    media_url: z.string().url().optional(),
    thumbnail_url: z.string().url().optional(),
    permalink: z.string().url().optional(),
  })).optional(),
});

const metaMediaResponseSchema = z.object({
  data: z.array(metaMediaSchema),
});

type MetaMedia = z.infer<typeof metaMediaSchema>;

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
  config: InstagramFeedConfig | null = instagramFeedConfig,
): Promise<readonly InstagramPost[]> {
  if (config === null) {
    return FALLBACK_POSTS;
  }

  const url = new URL(`/${META_GRAPH_API_VERSION}/${config.businessAccountId}/media`, META_GRAPH_API_ORIGIN);
  url.searchParams.set("fields", MEDIA_FIELDS.join(","));
  url.searchParams.set("access_token", config.accessToken);

  const response = await fetch(url, { next: { revalidate: 3600 } }).catch(() => null);
  if (response === null || !response.ok) {
    return FALLBACK_POSTS;
  }

  const payload = await response.json().catch(() => null);
  const parsedResponse = metaMediaResponseSchema.safeParse(payload);
  if (!parsedResponse.success) {
    return FALLBACK_POSTS;
  }

  const posts = parsedResponse.data.data.flatMap(normalizeMetaMedia);
  return posts.length > 0 ? posts.slice(0, 16) : FALLBACK_POSTS;
}

function normalizeMetaMedia(media: MetaMedia): readonly InstagramPost[] {
  if (media.media_type === "CAROUSEL_ALBUM" && media.children !== undefined && media.children.length > 0) {
    return media.children.flatMap((child, index) => normalizeMediaItem({
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
}): readonly InstagramPost[] {
  switch (media.media_type) {
    case "IMAGE":
      return (media.media_url ?? media.thumbnail_url) === undefined ? [] : [{
        id: media.id, mediaType: "image", imageUrl: media.media_url ?? media.thumbnail_url!,
        permalink: media.permalink, caption: media.caption,
      }];
    case "VIDEO":
      if (media.media_url !== undefined && media.thumbnail_url !== undefined) return [{
        id: media.id, mediaType: "video", videoUrl: media.media_url, thumbnailUrl: media.thumbnail_url,
        permalink: media.permalink, caption: media.caption,
      }];
      return media.thumbnail_url === undefined ? [] : [{
        id: media.id, mediaType: "image", imageUrl: media.thumbnail_url, permalink: media.permalink, caption: media.caption,
      }];
    default: return [];
  }
}
