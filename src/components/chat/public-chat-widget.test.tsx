import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PublicChatWidget, readPublicChatEvents } from "./public-chat-widget";

vi.mock("next/image", () => ({
  default: ({ alt, src }: Readonly<{ alt: string; src: string }>) => (
    <span aria-label={alt} data-image-src={src} role="img" />
  ),
}));

const responseId = `chat_${"a".repeat(32)}`;

function ndjsonResponse(lines: readonly string[], split = false): Response {
  const text = `${lines.join("\n")}\n`;
  if (!split) {
    return new Response(text, { headers: { "content-type": "application/x-ndjson; charset=utf-8" } });
  }
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      const midpoint = Math.floor(text.length / 2);
      controller.enqueue(encoder.encode(text.slice(0, midpoint)));
      controller.enqueue(encoder.encode(text.slice(midpoint)));
      controller.close();
    },
  }), { headers: { "content-type": "application/x-ndjson; charset=utf-8" } });
}

function event(value: object): string {
  return JSON.stringify({ responseId, ...value });
}

function customerContext(aiProcessing = true): Response {
  return Response.json({
    locale: "vi",
    consent: { analytics: false, personalization: false, aiProcessing, aiConversationStorage: false, roomImageProcessing: false, roomImageStorage: false, version: "test" },
    capabilities: { analyticsTracking: false, marketingTracking: false },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("public chat NDJSON reader", () => {
  it("parses schema-validated events split across network chunks", async () => {
    const received: string[] = [];
    await readPublicChatEvents(ndjsonResponse([
      event({ type: "message_started" }),
      event({ type: "text_delta", text: "Verified answer" }),
      event({ type: "message_completed" }),
    ], true), (item) => received.push(item.type));

    expect(received).toEqual(["message_started", "text_delta", "message_completed"]);
  });

  it("rejects raw HTML and malformed protocol events before rendering", async () => {
    await expect(readPublicChatEvents(ndjsonResponse([
      event({ type: "text_delta", text: "<script>alert(1)</script>" }),
    ]), vi.fn())).rejects.toThrow("invalid event");
  });
});

describe("PublicChatWidget", () => {
  it("renders a global mobile sheet and canonical visual product cards from structured events", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input) === "/api/customer/context" ? customerContext() : ndjsonResponse([
      event({ type: "message_started" }),
      event({ type: "tool_started", tool: "search_catalog" }),
      event({ type: "text_delta", text: "Đây là lựa chọn đã được xác thực." }),
      event({
        type: "block_ready",
        block: {
          type: "product_cards",
          products: [{
            variantId: "variant-one",
            canonicalId: "product-one",
            title: "Ghế Việt",
            canonicalLink: "/vi/products/ghe-viet",
            image: {
              canonicalImageId: "variant-one",
              alt: "Ghế Việt",
              src: "https://res.cloudinary.com/nanohome-web/image/upload/products/chair",
            },
            price: { mode: "fixed", amount: 12_500_000, currency: "VND" },
            stock: { state: "available" },
            attributes: { brand: "Brand", designer: "Jane Designer", collection: "Icons" },
          }, {
            variantId: "variant-placeholder-price",
            canonicalId: "product-placeholder-price",
            title: "Ghế cần liên hệ",
            canonicalLink: "/vi/products/ghe-can-lien-he",
            image: {
              canonicalImageId: "variant-placeholder-price",
              alt: "Ghế cần liên hệ",
              src: "https://res.cloudinary.com/nanohome-web/image/upload/products/contact-chair",
            },
            price: { mode: "fixed", amount: 0, currency: "VND" },
            stock: { state: "unknown" },
            attributes: { brand: "Brand" },
          }],
        },
      }),
      event({ type: "evidence_ready", sourceId: "catalog-one", label: "Danh mục công khai" }),
      event({ type: "message_completed" }),
    ], true));
    vi.stubGlobal("fetch", fetcher);
    render(<PublicChatWidget locale="vi" />);

    const launcher = screen.getByRole("button", { name: "Mở trợ lý nanoHome" });
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith("/api/customer/context", expect.anything()));
    fireEvent.click(launcher);
    const panel = screen.getByTestId("public-chat-panel");
    expect(panel.className).toContain("inset-x-0");
    expect(panel.className).toContain("sm:w-");
    fireEvent.change(screen.getByLabelText("Câu hỏi của bạn"), { target: { value: "Tìm ghế cho phòng khách" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi câu hỏi" }));

    await waitFor(() => expect(screen.getByText("Đây là lựa chọn đã được xác thực.")).toBeInTheDocument());
    expect(fetcher).toHaveBeenCalledWith("/api/chat", expect.objectContaining({ method: "POST", cache: "no-store" }));
    expect(screen.getByTestId("chat-product-grid")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Ghế Việt" })).toHaveAttribute(
      "data-image-src",
      "https://res.cloudinary.com/nanohome-web/image/upload/products/chair",
    );
    expect(screen.getByRole("link", { name: "Xem sản phẩm: Ghế Việt" })).toHaveAttribute("href", "/vi/products/ghe-viet");
    expect(screen.getByText(/12[.\s]500[.\s]000/)).toBeInTheDocument();
    expect(screen.getByText("Liên hệ để biết giá")).toBeInTheDocument();
    expect(screen.queryByText(/^0(?:[.\s]0+)?\s*₫$/u)).not.toBeInTheDocument();
    expect(screen.getByText("Có sẵn theo dữ liệu hiện tại")).toBeInTheDocument();
    expect(screen.getByText(/Danh mục công khai/u)).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });

  it("renders the launcher only at desktop widths", async () => {
    // Given: the global assistant launcher renders with the mobile footer.
    vi.stubGlobal("fetch", vi.fn(async () => customerContext()));
    render(<PublicChatWidget locale="vi" />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

    // When: the launcher uses its responsive presentation rule.
    const launcher = screen.getByRole("button", { name: "Mở trợ lý nanoHome" });

    // Then: it is hidden below desktop widths so it cannot cover footer controls.
    expect(launcher.className).toContain("hidden");
    expect(launcher.className).toContain("xl:flex");
  });

  it("supports localized labels and restores launcher focus on Escape", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => customerContext()));
    render(<PublicChatWidget locale="ko" />);
    const launcher = screen.getByRole("button", { name: "nanoHome 도우미 열기" });
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    fireEvent.click(launcher);
    expect(screen.getByRole("region", { name: "nanoHome 도우미" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "nanoHome 도우미" })).not.toBeInTheDocument();
    expect(launcher).toHaveFocus();
  });

  it("fails closed on an unsafe event and offers a localized retry", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => String(input) === "/api/customer/context" ? customerContext() : ndjsonResponse([
      event({ type: "message_started" }),
      event({ type: "text_delta", text: "<img src=x>" }),
    ])));
    render(<PublicChatWidget locale="en" />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Open nanoHome assistant" }));
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "Find a table" } });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));

    await waitFor(() => expect(screen.getByText("The answer could not be completed. Please try again.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});
