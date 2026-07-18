import { afterEach, describe, expect, it, vi } from "vitest";

import { getInstagramPosts } from "@/lib/instagram";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function generateValidMockData(count = 24, videoCount = 3): any[] {
  return Array.from({ length: count }, (_, index) => {
    const postNumber = index + 1;
    const isVideo = index < videoCount;
    return {
      id: `post-${postNumber}`,
      source_post_id: `src-${postNumber}`,
      media_type: isVideo ? "video" : "image",
      image_url: isVideo ? "https://res.cloudinary.com/cloudname/image/upload/v1/post.jpg" : `https://res.cloudinary.com/cloudname/image/upload/v1/post-${postNumber}.jpg`,
      video_url: isVideo ? "https://fast.wistia.net/embed/medias/abc.mp4" : null,
      thumbnail_url: isVideo ? "https://res.cloudinary.com/cloudname/image/upload/v1/thumb.jpg" : null,
      permalink: `https://www.instagram.com/p/C_abc${postNumber}/`,
      caption: `Caption ${postNumber}`,
      sort_order: postNumber,
    };
  });
}

describe("getInstagramPosts", () => {
  it("returns fallback posts on DB error/empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: new Error("DB error") }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any);

    const posts = await getInstagramPosts(null);
    expect(posts).toHaveLength(10);
    expect(posts[0]?.id).toBe("fallback-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes and validates a perfectly composed 24 posts snapshot", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const mockData = generateValidMockData();

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any);

    const posts = await getInstagramPosts(null);
    expect(posts).toHaveLength(24);
    expect(posts.filter((p) => p.mediaType === "video")).toHaveLength(3);
    expect(posts.filter((p) => p.mediaType === "image")).toHaveLength(21);
    expect(posts[0]).toEqual({
      id: "post-1",
      mediaType: "video",
      videoUrl: "https://fast.wistia.net/embed/medias/abc.mp4",
      thumbnailUrl: "https://res.cloudinary.com/cloudname/image/upload/v1/thumb.jpg",
      permalink: "https://www.instagram.com/p/C_abc1/",
      caption: "Caption 1",
    });
    expect(posts[3]).toEqual({
      id: "post-4",
      mediaType: "image",
      imageUrl: "https://res.cloudinary.com/cloudname/image/upload/v1/post-4.jpg",
      permalink: "https://www.instagram.com/p/C_abc4/",
      caption: "Caption 4",
    });
  });

  it("returns fallback posts when there is excess posts (25 rows returned)", async () => {
    const mockData = generateValidMockData(25, 3);
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any);

    const posts = await getInstagramPosts(null);
    expect(posts).toHaveLength(10);
    expect(posts[0]?.id).toBe("fallback-1");
  });

  it("returns fallback posts when there is a deficit of posts (23 rows returned)", async () => {
    const mockData = generateValidMockData(23, 3);
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any);

    const posts = await getInstagramPosts(null);
    expect(posts).toHaveLength(10);
  });

  it("returns fallback posts when composition is wrong (4 videos and 20 images)", async () => {
    const mockData = generateValidMockData(24, 4);
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any);

    const posts = await getInstagramPosts(null);
    expect(posts).toHaveLength(10);
  });

  it("returns fallback posts when sort_order is not contiguous 1..24", async () => {
    const mockData = generateValidMockData();
    mockData[10].sort_order = 99; // make a gap/non-contiguous
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any);

    const posts = await getInstagramPosts(null);
    expect(posts).toHaveLength(10);
  });

  it("returns fallback posts when there are duplicate IDs", async () => {
    const mockData = generateValidMockData();
    mockData[5].id = mockData[4].id; // duplicate ID
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any);

    const posts = await getInstagramPosts(null);
    expect(posts).toHaveLength(10);
  });

  it("returns fallback posts when a post URL fails validation", async () => {
    const mockData = generateValidMockData();
    mockData[5].image_url = "https://lookaside.fbsbx.com/image.jpg"; // invalid host
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any);

    const posts = await getInstagramPosts(null);
    expect(posts).toHaveLength(10);
  });

  it("handles valid reel permalinks and rejects reel permalinks with query params or fragments", async () => {
    // 1. Valid reel link with trailing slash
    const mockData1 = generateValidMockData();
    mockData1[0].permalink = "https://www.instagram.com/reel/C_abc1/";
    const mockSupabase1 = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockData1, error: null }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase1 as any);
    let posts = await getInstagramPosts(null);
    expect(posts).toHaveLength(24);

    // 2. Valid reel link without trailing slash
    const mockData2 = generateValidMockData();
    mockData2[0].permalink = "https://instagram.com/reel/C_abc1";
    const mockSupabase2 = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockData2, error: null }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase2 as any);
    posts = await getInstagramPosts(null);
    expect(posts).toHaveLength(24);

    // 3. Invalid reel link with query parameter
    const mockData3 = generateValidMockData();
    mockData3[0].permalink = "https://www.instagram.com/reel/C_abc1/?utm_source=ig";
    const mockSupabase3 = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockData3, error: null }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase3 as any);
    posts = await getInstagramPosts(null);
    expect(posts).toHaveLength(10); // returns fallback posts due to invalid link

    // 4. Invalid reel link with fragment
    const mockData4 = generateValidMockData();
    mockData4[0].permalink = "https://www.instagram.com/reel/C_abc1/#hash";
    const mockSupabase4 = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockData4, error: null }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase4 as any);
    posts = await getInstagramPosts(null);
    expect(posts).toHaveLength(10);

    // 5. Invalid reel link containing extra path segments
    const mockData5 = generateValidMockData();
    mockData5[0].permalink = "https://www.instagram.com/reel/C_abc1/extra";
    const mockSupabase5 = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockData5, error: null }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase5 as any);
    posts = await getInstagramPosts(null);
    expect(posts).toHaveLength(10);
  });
});
