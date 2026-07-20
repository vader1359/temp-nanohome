import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";

const mockEnv = {
  INSTAGRAM_ACCESS_TOKEN: undefined as string | undefined,
  INSTAGRAM_BUSINESS_ACCOUNT_ID: undefined as string | undefined,
  CLOUDINARY_URL: undefined as string | undefined,
  WISTIA_API_TOKEN: undefined as string | undefined,
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

vi.mock("@/lib/env", () => ({
  env: new Proxy({}, {
    get(target, prop) {
      return (mockEnv as any)[prop];
    }
  })
}));

import {
  validateMetaUrl,
  redactError,
  parseCloudinaryUrl,
  runInstagramSync,
  parseWistiaStatus,
  importVideoToWistia,
  checkWistiaStatus,
  fetchWistiaVideoAssetUrl,
} from "@/lib/instagram-sync";
import { createInstagramSyncAdminClient } from "@/lib/supabase/admin";
import { supabaseInstagramSyncFetch } from "@/lib/remote-read-only";

vi.mock("@/lib/supabase/admin", () => ({
  createInstagramSyncAdminClient: vi.fn(),
}));

describe("Instagram Ingestion Pipeline", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    mockEnv.INSTAGRAM_ACCESS_TOKEN = undefined;
    mockEnv.INSTAGRAM_BUSINESS_ACCOUNT_ID = undefined;
    mockEnv.CLOUDINARY_URL = undefined;
    mockEnv.WISTIA_API_TOKEN = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe("URL Validation (validateMetaUrl)", () => {
    it("accepts valid secure Meta/Instagram CDN URLs", () => {
      const validUrls = [
        "https://lookaside.fbsbx.com/file.jpg",
        "https://scontent.cdninstagram.com/v/t51.2885-15/e35/p1.jpg",
        "https://scontent-lax3-1.cdninstagram.com/v/t51.2885-15/sh0.08/e35/p640x640/1.jpg",
      ];
      for (const urlStr of validUrls) {
        expect(() => validateMetaUrl(urlStr)).not.toThrow();
      }
    });

    it("rejects non-HTTPS protocols", () => {
      expect(() => validateMetaUrl("http://lookaside.fbsbx.com/file.jpg")).toThrow("HTTPS");
      expect(() => validateMetaUrl("ftp://lookaside.fbsbx.com/file.jpg")).toThrow("HTTPS");
    });

    it("rejects URLs containing credentials", () => {
      expect(() => validateMetaUrl("https://user:pass@lookaside.fbsbx.com/file.jpg")).toThrow("credentials");
    });

    it("rejects non-default ports", () => {
      expect(() => validateMetaUrl("https://lookaside.fbsbx.com:8443/file.jpg")).toThrow("non-default port");
    });

    it("rejects non-allowlisted hostnames (like graph.facebook.com and broad FB suffixes)", () => {
      expect(() => validateMetaUrl("https://graph.facebook.com/v25.0/me")).toThrow("Hostname not allowed");
      expect(() => validateMetaUrl("https://evil-site.facebook.com/file.jpg")).toThrow("Hostname not allowed");
      expect(() => validateMetaUrl("https://evil-site.com/file.jpg")).toThrow("Hostname not allowed");
    });
  });

  describe("Wistia Status Parser (parseWistiaStatus)", () => {
    it("maps valid string and numeric statuses to correct values", () => {
      expect(parseWistiaStatus("queued")).toBe("queued");
      expect(parseWistiaStatus("0")).toBe("queued");
      expect(parseWistiaStatus("processing")).toBe("processing");
      expect(parseWistiaStatus("2")).toBe("processing");
      expect(parseWistiaStatus("ready")).toBe("ready");
      expect(parseWistiaStatus("1")).toBe("ready");
      expect(parseWistiaStatus("failed")).toBe("failed");
      expect(parseWistiaStatus("-1")).toBe("failed");
    });

    it("rejects unknown statuses", () => {
      expect(() => parseWistiaStatus("unknown_status")).toThrow("Unknown Wistia status");
      expect(() => parseWistiaStatus("3")).toThrow("Unknown Wistia status");
      expect(() => parseWistiaStatus(undefined)).toThrow();
      expect(() => parseWistiaStatus(null)).toThrow();
    });
  });

  describe("Wistia API authentication", () => {
    it("uses the documented bearer-token authentication for imports and status reads", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock.mockResolvedValueOnce(Response.json({ hashed_id: "video-hash", status: "processing" }));
      fetchMock.mockResolvedValueOnce(Response.json({ status: "ready" }));

      await importVideoToWistia("https://cdn.instagram.com/video.mp4", "Instagram video", "wistia-token");
      await checkWistiaStatus("video-hash", "wistia-token");

      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
        headers: { Authorization: "Bearer wistia-token" },
      });
      expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
        headers: { Authorization: "Bearer wistia-token" },
      });
    });
  });

  it("upgrades legacy HTTP Wistia asset URLs to HTTPS", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue(Response.json({
      assets: [{ contentType: "video/mp4", url: "http://embed.wistia.com/deliveries/video.bin" }],
    }));

    await expect(fetchWistiaVideoAssetUrl("video-hash", "wistia-token"))
      .resolves.toBe("https://embed.wistia.com/deliveries/video.bin");
  });

  describe("Error Redaction (redactError)", () => {
    it("redacts Cloudinary, Wistia and Instagram secrets from error strings", () => {
      mockEnv.CLOUDINARY_URL = "cloudinary://key123:secret456@cloudname";
      mockEnv.WISTIA_API_TOKEN = "wistia_token_xyz";
      mockEnv.INSTAGRAM_ACCESS_TOKEN = "ig_token_abc";

      const rawError = new Error(
        "Could not load image using cloudinary://key123:secret456@cloudname. Wistia token wistia_token_xyz failed. Instagram token ig_token_abc failed."
      );
      const redacted = redactError(rawError);

      expect(redacted).not.toContain("cloudinary://key123:secret456@cloudname");
      expect(redacted).not.toContain("wistia_token_xyz");
      expect(redacted).not.toContain("ig_token_abc");
      expect(redacted).toContain("[CLOUDINARY_URL_REDACTED]");
      expect(redacted).toContain("[WISTIA_API_TOKEN_REDACTED]");
      expect(redacted).toContain("[INSTAGRAM_ACCESS_TOKEN_REDACTED]");
    });
  });

  describe("runInstagramSync execution flow", () => {
    it("returns disabled status when configuration is missing", async () => {
      mockEnv.INSTAGRAM_ACCESS_TOKEN = undefined;

      const result = await runInstagramSync();
      expect(result.status).toBe("disabled");
      expect(result.error).toContain("Missing required configuration variables");
    });

    describe("Supabase Write Safeguards (Allowlist vs Direct Patch)", () => {
      it("denies direct table writes (PATCH/POST to /rest/v1/instagram_posts)", async () => {
        const init = {
          method: "PATCH",
          body: JSON.stringify({ wistia_status: "ready" }),
        };
        await expect(
          supabaseInstagramSyncFetch("https://project.supabase.co/rest/v1/instagram_posts?id=eq.1", init)
        ).rejects.toThrow("write blocked by read-only safeguard");
      });

      it("denies direct table writes (PATCH/POST to /rest/v1/instagram_active_posts)", async () => {
        const init = {
          method: "POST",
          body: JSON.stringify({ id: "1", sort_order: 1 }),
        };
        await expect(
          supabaseInstagramSyncFetch("https://project.supabase.co/rest/v1/instagram_active_posts", init)
        ).rejects.toThrow("write blocked by read-only safeguard");
      });

      it("denies direct table writes (PATCH/POST to /rest/v1/instagram_pipeline_state)", async () => {
        const init = {
          method: "PATCH",
          body: JSON.stringify({ value: "new" }),
        };
        await expect(
          supabaseInstagramSyncFetch("https://project.supabase.co/rest/v1/instagram_pipeline_state?key=eq.source", init)
        ).rejects.toThrow("write blocked by read-only safeguard");
      });

      it("allows allowlisted RPC endpoints (POST to /rest/v1/rpc/update_instagram_stage_wistia_status)", async () => {
        const fetchMock = vi.mocked(global.fetch);
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true })));

        const init = {
          method: "POST",
          body: JSON.stringify({ p_stage_id: "uuid-1", p_post_id: "1", p_source_url_fingerprint: "finger", p_status: "ready", p_video_url: "https://wistia.com/1" }),
        };

        const res = await supabaseInstagramSyncFetch("https://project.supabase.co/rest/v1/rpc/update_instagram_stage_wistia_status", init);
        expect(res.status).toBe(200);
      });

      it("allows allowlisted RPC endpoints (POST to /rest/v1/rpc/publish_instagram_stage)", async () => {
        const fetchMock = vi.mocked(global.fetch);
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true })));

        const init = {
          method: "POST",
          body: JSON.stringify({ p_stage_id: "uuid-1" }),
        };

        const res = await supabaseInstagramSyncFetch("https://project.supabase.co/rest/v1/rpc/publish_instagram_stage", init);
        expect(res.status).toBe(200);
      });

      it("allows allowlisted RPC endpoints (POST to /rest/v1/rpc/save_instagram_stage_drafts)", async () => {
        const fetchMock = vi.mocked(global.fetch);
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true })));

        const init = {
          method: "POST",
          body: JSON.stringify({ p_stage_id: "uuid-1", p_posts: [] }),
        };

        const res = await supabaseInstagramSyncFetch("https://project.supabase.co/rest/v1/rpc/save_instagram_stage_drafts", init);
        expect(res.status).toBe(200);
      });
    });

    it("resumes stable stage without Meta/begin", async () => {
      mockEnv.INSTAGRAM_ACCESS_TOKEN = "ig-token";
      mockEnv.INSTAGRAM_BUSINESS_ACCOUNT_ID = "ig-business-id";
      mockEnv.CLOUDINARY_URL = "cloudinary://key:secret@cloudname";
      mockEnv.WISTIA_API_TOKEN = "wistia-token";

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        rpc: vi.fn(),
      };

      mockSupabase.order.mockResolvedValue({
        data: [{ id: "mocked-stage-uuid", status: "building", selection_key: "stable-key", source_url_version: "v1" }],
        error: null
      });

      let feedCalled = false;
      let beginCalled = false;

      mockSupabase.rpc.mockImplementation(async (rpcName, args) => {
        if (rpcName === "begin_instagram_snapshot_stage") {
          beginCalled = true;
          return { data: "new-stage", error: null };
        }
        if (rpcName === "get_instagram_stage_work") {
          return { data: [], error: null };
        }
        if (rpcName === "get_instagram_stage_pending_videos") {
          return { data: [], error: null };
        }
        if (rpcName === "publish_instagram_stage") {
          return { data: "pending", error: null };
        }
        return { data: null, error: null };
      });

      vi.mocked(createInstagramSyncAdminClient).mockReturnValue(mockSupabase as any);

      const fetchMock = vi.mocked(global.fetch);
      fetchMock.mockImplementation(async (input) => {
        const urlStr = String(input);
        if (urlStr.includes("graph.facebook.com")) {
          feedCalled = true;
          return Response.json({ data: [] });
        }
        return new Response("Not Found", { status: 404 });
      });

      const result = await runInstagramSync();

      expect(result.status).toBe("pending");
      expect(feedCalled).toBe(false);
      expect(beginCalled).toBe(false);
    });

    it("changed fingerprint does not reuse prior Cloudinary/Wistia fields", async () => {
      mockEnv.INSTAGRAM_ACCESS_TOKEN = "ig-token";
      mockEnv.INSTAGRAM_BUSINESS_ACCOUNT_ID = "ig-business-id";
      mockEnv.CLOUDINARY_URL = "cloudinary://key:secret@cloudname";
      mockEnv.WISTIA_API_TOKEN = "wistia-token";

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        rpc: vi.fn(),
      };

      mockSupabase.order.mockResolvedValue({
        data: [{ id: "mocked-stage-uuid", status: "building", selection_key: "stable-key", source_url_version: "v1" }],
        error: null
      });

      mockSupabase.rpc.mockImplementation(async (rpcName, args) => {
        if (rpcName === "get_instagram_stage_work") {
          return {
            data: [{
              id: "image-1",
              media_type: "image",
              permalink: "https://inst.com/1",
              caption: null,
              sort_order: 1,
              source_url_fingerprint: "new-fingerprint",
              meta_image_url: "https://lookaside.fbsbx.com/image.jpg",
              meta_video_url: null,
              draft_image_url: null,
              draft_video_url: null,
              draft_thumbnail_url: null,
              wistia_hashed_id: null,
              wistia_status: null
            }],
            error: null
          };
        }
        if (rpcName === "get_instagram_stage_pending_videos") {
          return { data: [], error: null };
        }
        if (rpcName === "save_instagram_stage_drafts") {
          return { data: null, error: null };
        }
        if (rpcName === "publish_instagram_stage") {
          return { data: "pending", error: null };
        }
        return { data: null, error: null };
      });

      vi.mocked(createInstagramSyncAdminClient).mockReturnValue(mockSupabase as any);

      const fetchMock = vi.mocked(global.fetch);
      let cloudinaryUploads = 0;
      fetchMock.mockImplementation(async (input) => {
        const urlStr = String(input);
        if (urlStr.includes("api.cloudinary.com")) {
          cloudinaryUploads++;
          return Response.json({ secure_url: "https://res.cloudinary.com/cloudname/new-upload.jpg" });
        }
        return new Response("Not Found", { status: 404 });
      });

      const result = await runInstagramSync();
      expect(result.status).toBe("pending");
      expect(cloudinaryUploads).toBe(1);
    });

    it("stage-aware pending Wistia update is executed", async () => {
      mockEnv.INSTAGRAM_ACCESS_TOKEN = "ig-token";
      mockEnv.INSTAGRAM_BUSINESS_ACCOUNT_ID = "ig-business-id";
      mockEnv.CLOUDINARY_URL = "cloudinary://key:secret@cloudname";
      mockEnv.WISTIA_API_TOKEN = "wistia-token";

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        rpc: vi.fn(),
      };

      mockSupabase.order.mockResolvedValue({
        data: [{ id: "mocked-stage-uuid", status: "building", selection_key: "stable-key", source_url_version: "v1" }],
        error: null
      });

      let updatedStageWistiaStatus = false;

      mockSupabase.rpc.mockImplementation(async (rpcName, args) => {
        if (rpcName === "get_instagram_stage_work") {
          return { data: [], error: null };
        }
        if (rpcName === "get_instagram_stage_pending_videos") {
          return {
            data: [{
              id: "video-1",
              wistia_hashed_id: "wistia-hash",
              wistia_status: "processing",
              source_url_fingerprint: "fingerprint-1"
            }],
            error: null
          };
        }
        if (rpcName === "update_instagram_stage_wistia_status") {
          expect(args.p_stage_id).toBe("mocked-stage-uuid");
          expect(args.p_post_id).toBe("video-1");
          expect(args.p_source_url_fingerprint).toBe("fingerprint-1");
          expect(args.p_status).toBe("ready");
          expect(args.p_video_url).toBe("https://fast.wistia.com/asset.mp4");
          updatedStageWistiaStatus = true;
          return { data: null, error: null };
        }
        if (rpcName === "publish_instagram_stage") {
          return { data: "pending", error: null };
        }
        return { data: null, error: null };
      });

      vi.mocked(createInstagramSyncAdminClient).mockReturnValue(mockSupabase as any);

      const fetchMock = vi.mocked(global.fetch);
      fetchMock.mockImplementation(async (input) => {
        const urlStr = String(input);
        if (urlStr.includes("api.wistia.com/v1/medias/wistia-hash.json")) {
          return Response.json({
            status: "ready",
            assets: [{ ext: "mp4", url: "https://fast.wistia.com/asset.mp4" }]
          });
        }
        return new Response("Not Found", { status: 404 });
      });

      await runInstagramSync();
      expect(updatedStageWistiaStatus).toBe(true);
    });

    it("partial persistence of drafts saves progress immediately", async () => {
      mockEnv.INSTAGRAM_ACCESS_TOKEN = "ig-token";
      mockEnv.INSTAGRAM_BUSINESS_ACCOUNT_ID = "ig-business-id";
      mockEnv.CLOUDINARY_URL = "cloudinary://key:secret@cloudname";
      mockEnv.WISTIA_API_TOKEN = "wistia-token";

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        rpc: vi.fn(),
      };

      mockSupabase.order.mockResolvedValue({
        data: [{ id: "mocked-stage-uuid", status: "building", selection_key: "stable-key", source_url_version: "v1" }],
        error: null
      });

      let savedDraftsCount = 0;

      mockSupabase.rpc.mockImplementation(async (rpcName, args) => {
        if (rpcName === "get_instagram_stage_work") {
          return {
            data: [
              {
                id: "image-1",
                media_type: "image",
                permalink: "https://inst.com/1",
                caption: null,
                sort_order: 1,
                source_url_fingerprint: "fingerprint-1",
                meta_image_url: "https://lookaside.fbsbx.com/image.jpg",
                meta_video_url: null,
                draft_image_url: null
              },
              {
                id: "image-2",
                media_type: "image",
                permalink: "https://inst.com/2",
                caption: null,
                sort_order: 2,
                source_url_fingerprint: "fingerprint-2",
                meta_image_url: "https://lookaside.fbsbx.com/image2.jpg",
                meta_video_url: null,
                draft_image_url: null
              }
            ],
            error: null
          };
        }
        if (rpcName === "get_instagram_stage_pending_videos") {
          return { data: [], error: null };
        }
        if (rpcName === "save_instagram_stage_drafts") {
          for (const post of args.p_posts) {
            if (post.media_type === "image") {
              expect(post.video_url).toBeNull();
              expect(post.thumbnail_url).toBeNull();
              expect(post.wistia_status).toBeNull();
              expect(post.wistia_hashed_id).toBeNull();
            }
          }
          savedDraftsCount += args.p_posts.length;
          return { data: null, error: null };
        }
        if (rpcName === "publish_instagram_stage") {
          return { data: "pending", error: null };
        }
        return { data: null, error: null };
      });

      vi.mocked(createInstagramSyncAdminClient).mockReturnValue(mockSupabase as any);

      const fetchMock = vi.mocked(global.fetch);
      fetchMock.mockImplementation(async (input) => {
        const urlStr = String(input);
        if (urlStr.includes("api.cloudinary.com")) {
          return Response.json({ secure_url: "https://res.cloudinary.com/cloudname/uploaded.jpg" });
        }
        return new Response("Not Found", { status: 404 });
      });

      await runInstagramSync();
      expect(savedDraftsCount).toBe(2);
    });

    it("active remains unchanged on 23-ready stage", async () => {
      mockEnv.INSTAGRAM_ACCESS_TOKEN = "ig-token";
      mockEnv.INSTAGRAM_BUSINESS_ACCOUNT_ID = "ig-business-id";
      mockEnv.CLOUDINARY_URL = "cloudinary://key:secret@cloudname";
      mockEnv.WISTIA_API_TOKEN = "wistia-token";

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        rpc: vi.fn(),
      };

      mockSupabase.order.mockResolvedValue({
        data: [{ id: "mocked-stage-uuid", status: "building", selection_key: "stable-key", source_url_version: "v1" }],
        error: null
      });

      let publishCalled = false;

      mockSupabase.rpc.mockImplementation(async (rpcName, args) => {
        if (rpcName === "get_instagram_stage_work") {
          return { data: [], error: null };
        }
        if (rpcName === "get_instagram_stage_pending_videos") {
          return { data: [], error: null };
        }
        if (rpcName === "publish_instagram_stage") {
          publishCalled = true;
          return { data: "pending", error: null };
        }
        return { data: null, error: null };
      });

      vi.mocked(createInstagramSyncAdminClient).mockReturnValue(mockSupabase as any);

      const result = await runInstagramSync();
      expect(result.status).toBe("pending");
      expect(publishCalled).toBe(true);
      expect(result.readyCount).toBe(0);
    });

    it("retries failed Wistia items by importing anew and reusing poster", async () => {
      mockEnv.INSTAGRAM_ACCESS_TOKEN = "ig-token";
      mockEnv.INSTAGRAM_BUSINESS_ACCOUNT_ID = "ig-business-id";
      mockEnv.CLOUDINARY_URL = "cloudinary://key:secret@cloudname";
      mockEnv.WISTIA_API_TOKEN = "wistia-token";

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        rpc: vi.fn(),
      };

      mockSupabase.order.mockResolvedValue({
        data: [{ id: "mocked-stage-uuid", status: "building", selection_key: "stable-key", source_url_version: "v1" }],
        error: null
      });

      let savedPosts: any[] = [];

      mockSupabase.rpc.mockImplementation(async (rpcName, args) => {
        if (rpcName === "get_instagram_stage_work") {
          return {
            data: [{
              id: "video-1",
              media_type: "video",
              permalink: "https://inst.com/1",
              caption: "Failed video test",
              sort_order: 1,
              source_url_fingerprint: "fingerprint-1",
              meta_image_url: "https://lookaside.fbsbx.com/image.jpg",
              meta_video_url: "https://lookaside.fbsbx.com/video.mp4",
              draft_image_url: "https://res.cloudinary.com/cloudname/poster.jpg",
              draft_video_url: "https://fast.wistia.com/asset.mp4",
              draft_thumbnail_url: "https://res.cloudinary.com/cloudname/poster.jpg",
              wistia_hashed_id: "failed-hash",
              wistia_status: "failed"
            }],
            error: null
          };
        }
        if (rpcName === "get_instagram_stage_pending_videos") {
          return { data: [], error: null };
        }
        if (rpcName === "save_instagram_stage_drafts") {
          savedPosts = args.p_posts;
          return { data: null, error: null };
        }
        if (rpcName === "publish_instagram_stage") {
          return { data: "pending", error: null };
        }
        return { data: null, error: null };
      });

      vi.mocked(createInstagramSyncAdminClient).mockReturnValue(mockSupabase as any);

      const fetchMock = vi.mocked(global.fetch);
      let wistiaUploads = 0;
      let cloudinaryUploads = 0;
      fetchMock.mockImplementation(async (input) => {
        const urlStr = String(input);
        if (urlStr.includes("upload.wistia.com")) {
          wistiaUploads++;
          return Response.json({ hashed_id: "new-hash", status: "processing" });
        }
        if (urlStr.includes("api.cloudinary.com")) {
          cloudinaryUploads++;
          return Response.json({ secure_url: "https://res.cloudinary.com/cloudname/uploaded.jpg" });
        }
        return new Response("Not Found", { status: 404 });
      });

      const result = await runInstagramSync();
      expect(result.status).toBe("pending");
      expect(wistiaUploads).toBe(1);
      expect(cloudinaryUploads).toBe(0); // poster is reused!
      expect(savedPosts.length).toBe(1);
      expect(savedPosts[0].wistia_hashed_id).toBe("new-hash");
      expect(savedPosts[0].wistia_status).toBe("processing");
      expect(savedPosts[0].video_url).toBeNull();
      expect(savedPosts[0].thumbnail_url).toBe("https://res.cloudinary.com/cloudname/poster.jpg");
    });
  });
});

function selectionToWork(selection: any[]): any[] {
  return selection.map(item => ({
    id: item.id,
    media_type: item.media_type,
    permalink: item.permalink,
    caption: item.caption,
    sort_order: item.sort_order,
    source_url_fingerprint: item.source_url_fingerprint,
    meta_image_url: item.image_url,
    meta_video_url: item.video_url,
    draft_image_url: null as string | null,
    draft_video_url: null as string | null,
    draft_thumbnail_url: null as string | null,
    wistia_hashed_id: null as string | null,
    wistia_status: null as string | null
  }));
}
