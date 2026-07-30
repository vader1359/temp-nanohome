import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

import { WishlistProvider } from "@/components/wishlist/wishlist-context";
import { PublicChatWidget, readPublicChatEvents } from "./public-chat-widget";

vi.mock("next/image", () => ({
  default: ({ alt, src }: Readonly<{ alt: string; src: string }>) => (
    <span aria-label={alt} data-image-src={src} role="img" />
  ),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, className, ...props }: Readonly<{ children: ReactNode; href: string; className?: string; "aria-label"?: string }>) => (
    <a aria-label={props["aria-label"]} className={className} href={href}>{children}</a>
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

function renderWithWishlist(ui: ReactElement) {
  return render(<WishlistProvider>{ui}</WishlistProvider>);
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
  it("opens immediately without customer context or consent settings", () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) !== "/api/chat") throw new Error("unexpected request");
      return ndjsonResponse([]);
    });
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    vi.stubGlobal("fetch", fetcher);
    render(<PublicChatWidget locale="en" />);

    fireEvent.click(screen.getByRole("button", { name: "Open nanoHome assistant" }));

    expect(screen.getByTestId("public-chat-panel")).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "nanohome:open-consent-settings" }));
  });

  it("renders a global mobile sheet and canonical visual product cards from structured events", async () => {
    const fetcher = vi.fn(async () => ndjsonResponse([
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
            price: { mode: "contact" },
            stock: { state: "unknown" },
            attributes: { brand: "Brand" },
          }],
        },
      }),
      event({ type: "evidence_ready", sourceId: "catalog-one", label: "Danh mục công khai" }),
      event({ type: "message_completed" }),
    ], true));
    vi.stubGlobal("fetch", fetcher);
    vi.stubGlobal("ResizeObserver", class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe() { this.callback([], this as unknown as ResizeObserver); }
      disconnect() {}
    });
    Object.defineProperties(HTMLElement.prototype, {
      clientWidth: { configurable: true, value: 200 },
      scrollWidth: { configurable: true, value: 400 },
    });
    const scrollBy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollBy", { configurable: true, value: scrollBy });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return { width: this.classList.contains("snap-start") ? 100 : 200 } as DOMRect;
    });
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    renderWithWishlist(<PublicChatWidget locale="vi" />);

    const launcher = screen.getByRole("button", { name: "Mở trợ lý nanoHome" });
    fireEvent.click(launcher);
    const panel = screen.getByTestId("public-chat-panel");
    expect(panel.className).toContain("inset-x-0");
    expect(panel.className).toContain("sm:w-");
    fireEvent.change(screen.getByLabelText("Câu hỏi của bạn"), { target: { value: "Tìm ghế cho phòng khách" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi câu hỏi" }));

    await waitFor(() => expect(screen.getByText("Đây là lựa chọn đã được xác thực.")).toBeInTheDocument());
    expect(fetcher).toHaveBeenCalledWith("/api/chat", expect.objectContaining({ method: "POST", cache: "no-store" }));
    expect(screen.getByTestId("chat-product-carousel")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cuộn về trước" })).toBeDisabled());
    const nextButton = screen.getByRole("button", { name: "Cuộn tiếp" });
    expect(nextButton).toBeEnabled();
    fireEvent.click(nextButton);
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 112 }));
    const productScroller = screen.getByTestId("chat-product-carousel").querySelector(".snap-x");
    expect(productScroller).toHaveClass("snap-mandatory", "overflow-x-auto");
    expect(screen.queryByTestId("chat-product-grid")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Ghế Việt" })).toHaveAttribute(
      "data-image-src",
      "https://res.cloudinary.com/nanohome-web/image/upload/products/chair",
    );
    expect(screen.getByRole("link", { name: "Xem chi tiết Ghế Việt" })).toHaveAttribute("href", "/vi/products/ghe-viet");
    expect(screen.getByText(/12[.\s]500[.\s]000/)).toBeInTheDocument();
    expect(screen.getByText("Liên hệ")).toBeInTheDocument();
    expect(screen.queryByText(/^0(?:[.\s]0+)?\s*₫$/u)).not.toBeInTheDocument();
    expect(screen.getByText("CÓ SẴN")).toBeInTheDocument();
    expect(screen.getByText("CẦN XÁC NHẬN")).toBeInTheDocument();
    expect(screen.getByText(/Danh mục công khai/u)).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });

  it("keeps the launcher visible and clears a visible footer at every width on document scroll", async () => {
    // Given: a visible semantic footer reaches into the viewport below the launcher.
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    let footerTop = 650;
    const footer = document.createElement("footer");
    footer.getBoundingClientRect = () => ({ top: footerTop, bottom: footerTop + 250, left: 0, right: 1024, width: 1024, height: 250, x: 0, y: footerTop, toJSON: () => ({}) });
    document.body.append(footer);
    render(<PublicChatWidget locale="vi" />);

    // When: the widget measures the footer and document scroll occurs.
    const launcher = screen.getByRole("button", { name: "Mở trợ lý nanoHome" });
    expect(launcher.style.bottom).toBe("174px");

    footerTop = 327;
    fireEvent.scroll(document);

    // Then: launcher recomputes bottom position on document scroll.
    expect(launcher.className).toContain("flex");
    expect(launcher.className).not.toContain("hidden");
    expect(launcher.style.bottom).toBe("497px");
  });

  it("supports localized labels and restores launcher focus on Escape", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ndjsonResponse([])));
    render(<PublicChatWidget locale="ko" />);
    const launcher = screen.getByRole("button", { name: "nanoHome 도우미 열기" });
    fireEvent.click(launcher);
    expect(screen.getByRole("region", { name: "nanoHome 도우미" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "nanoHome 도우미" })).not.toBeInTheDocument();
    expect(launcher).toHaveFocus();
  });

  it("fails closed on an unsafe event and offers a localized retry", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ndjsonResponse([
      event({ type: "message_started" }),
      event({ type: "text_delta", text: "<img src=x>" }),
    ])));
    render(<PublicChatWidget locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Open nanoHome assistant" }));
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "Find a table" } });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));

    await waitFor(() => expect(screen.getByText("The answer could not be completed. Please try again.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});
