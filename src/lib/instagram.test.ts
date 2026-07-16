import { afterEach, describe, expect, it, vi } from "vitest";

import { getInstagramPosts, type InstagramFeedConfig } from "@/lib/instagram";

const config: InstagramFeedConfig = {
  accessToken: "instagram-token",
  businessAccountId: "17841400000000000",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getInstagramPosts", () => {
  it("returns the local gallery without contacting Meta when the feed is not configured", async () => {
    // Given: the homepage has no Instagram credentials.
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    // When: it resolves posts for the gallery.
    const posts = await getInstagramPosts(null);

    // Then: the existing local images remain available and no network call is made.
    expect(posts).toHaveLength(10);
    expect(posts[0]).toMatchObject({
      id: "fallback-1",
      imageUrl: "/images/home/instagram/instagram-1.jpg",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes usable Meta media and skips unsupported or incomplete records", async () => {
    // Given: Meta returns image, reel, carousel, and unusable media records.
    const fetchMock = vi.fn(async () => Response.json({
      data: [
        {
          id: "image-1",
          media_type: "IMAGE",
          media_url: "https://lookaside.fbsbx.com/image-1.jpg",
          permalink: "https://www.instagram.com/p/image-1/",
          caption: "A calm living room",
        },
        {
          id: "reel-1",
          media_type: "VIDEO",
          media_url: "https://lookaside.fbsbx.com/reel-1.mp4",
          thumbnail_url: "https://lookaside.fbsbx.com/reel-1.jpg",
          permalink: "https://www.instagram.com/reel/reel-1/",
        },
        {
          id: "carousel-1",
          media_type: "CAROUSEL_ALBUM",
          media_url: "https://lookaside.fbsbx.com/carousel-1.jpg",
          permalink: "https://www.instagram.com/p/carousel-1/",
        },
        {
          id: "missing-image",
          media_type: "VIDEO",
          permalink: "https://www.instagram.com/reel/missing-image/",
        },
        {
          id: "unsupported",
          media_type: "STORY",
          media_url: "https://lookaside.fbsbx.com/story.jpg",
          permalink: "https://www.instagram.com/stories/unsupported/",
        },
      ],
    }));
    vi.stubGlobal("fetch", fetchMock);

    // When: the server fetches and parses the account media.
    const posts = await getInstagramPosts(config);

    // Then: the gallery receives typed image and playable video records only.
    expect(posts).toEqual([
      {
        id: "image-1",
        mediaType: "image",
        imageUrl: "https://lookaside.fbsbx.com/image-1.jpg",
        permalink: "https://www.instagram.com/p/image-1/",
        caption: "A calm living room",
      },
      {
        id: "reel-1",
        mediaType: "video",
        videoUrl: "https://lookaside.fbsbx.com/reel-1.mp4",
        thumbnailUrl: "https://lookaside.fbsbx.com/reel-1.jpg",
        permalink: "https://www.instagram.com/reel/reel-1/",
        caption: undefined,
      },
      {
        id: "carousel-1",
        mediaType: "image",
        imageUrl: "https://lookaside.fbsbx.com/carousel-1.jpg",
        permalink: "https://www.instagram.com/p/carousel-1/",
        caption: undefined,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestUrl.pathname).toBe("/v25.0/17841400000000000/media");
    expect(requestUrl.searchParams.get("access_token")).toBe("instagram-token");
  });

  it("returns no more than 16 live posts in Meta response order", async () => {
    // Given: Meta returns more usable records than the homepage should display.
    const data = Array.from({ length: 17 }, (_, index) => ({
      id: `image-${index + 1}`,
      media_type: "IMAGE",
      media_url: `https://lookaside.fbsbx.com/image-${index + 1}.jpg`,
      permalink: `https://www.instagram.com/p/image-${index + 1}/`,
    }));
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data })));

    // When: the server resolves the gallery feed.
    const posts = await getInstagramPosts(config);

    // Then: the homepage receives the first 16 posts only.
    expect(posts).toHaveLength(16);
    expect(posts[15]?.id).toBe("image-16");
  });

  it("keeps the homepage available with local images when Meta rejects the request", async () => {
    // Given: Meta is temporarily unavailable.
    vi.stubGlobal("fetch", vi.fn(async () => new Response("rate limited", { status: 429 })));

    // When: the server resolves the gallery posts.
    const posts = await getInstagramPosts(config);

    // Then: the gallery preserves its local fallback instead of failing the homepage.
    expect(posts[0]?.imageUrl).toBe("/images/home/instagram/instagram-1.jpg");
    expect(posts).toHaveLength(10);
  });
});
