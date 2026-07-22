"use client";

import Image from "next/image";
import { LoaderCircle, MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import type { PublicChatLocale } from "@/lib/chat/contracts";
import {
  publicChatEventSchema,
  type PublicChatEvent,
} from "@/lib/chat/stream-events";

type ChatProduct = Readonly<{
  variantId: string;
  title: string;
  canonicalId?: string;
  canonicalLink?: string;
  image?: Readonly<{
    canonicalImageId: string;
    alt: string;
    src?: string;
  }>;
  price?:
    | Readonly<{ mode: "fixed"; amount: number; currency: string }>
    | Readonly<{ mode: "contact" }>
    | Readonly<{ mode: "unavailable" }>;
  stock?: Readonly<{ state: "available" | "unavailable" | "unknown" }>;
  attributes?: Readonly<Record<string, string>>;
}>;

type ChatImage = Readonly<{
  canonicalImageId: string;
  alt: string;
  src?: string;
}>;

type TranscriptEntry = Readonly<{
  id: string;
  role: "assistant" | "user";
  text: string;
  products: readonly ChatProduct[];
  images: readonly ChatImage[];
  sources: readonly string[];
  handoff: boolean;
  failed: boolean;
}>;

const labels = {
  vi: {
    launcher: "Mở trợ lý nanoHome",
    close: "Đóng trợ lý nanoHome",
    title: "Trợ lý nanoHome",
    subtitle: "Tư vấn từ thông tin sản phẩm đã được xác thực",
    empty: "Hãy hỏi về sản phẩm, thương hiệu, nhà thiết kế hoặc chính sách của nanoHome.",
    input: "Câu hỏi của bạn",
    placeholder: "Ví dụ: Tìm ghế phù hợp cho phòng khách",
    send: "Gửi câu hỏi",
    working: "Đang kiểm tra thông tin đã xác thực…",
    error: "Không thể hoàn tất câu trả lời. Vui lòng thử lại.",
    retry: "Thử lại",
    contactPrice: "Liên hệ để biết giá",
    unavailablePrice: "Chưa có giá công khai",
    available: "Có sẵn theo dữ liệu hiện tại",
    unavailable: "Hiện không có sẵn",
    unknownStock: "Cần xác nhận tồn kho",
    view: "Xem sản phẩm",
    handoff: "Cần nhân viên nanoHome xác nhận thêm.",
  },
  en: {
    launcher: "Open nanoHome assistant",
    close: "Close nanoHome assistant",
    title: "nanoHome assistant",
    subtitle: "Advice grounded in verified product information",
    empty: "Ask about nanoHome products, brands, designers, or public policies.",
    input: "Your question",
    placeholder: "For example: Find a chair for my living room",
    send: "Send question",
    working: "Checking verified information…",
    error: "The answer could not be completed. Please try again.",
    retry: "Try again",
    contactPrice: "Contact for price",
    unavailablePrice: "No public price",
    available: "Available in current data",
    unavailable: "Currently unavailable",
    unknownStock: "Availability needs confirmation",
    view: "View product",
    handoff: "A nanoHome team member needs to confirm this.",
  },
  ko: {
    launcher: "nanoHome 도우미 열기",
    close: "nanoHome 도우미 닫기",
    title: "nanoHome 도우미",
    subtitle: "검증된 제품 정보를 바탕으로 안내합니다",
    empty: "nanoHome 제품, 브랜드, 디자이너 또는 공개 정책에 대해 질문해 주세요.",
    input: "질문",
    placeholder: "예: 거실에 어울리는 의자를 찾아 주세요",
    send: "질문 보내기",
    working: "검증된 정보를 확인하고 있습니다…",
    error: "답변을 완료하지 못했습니다. 다시 시도해 주세요.",
    retry: "다시 시도",
    contactPrice: "가격 문의",
    unavailablePrice: "공개 가격 없음",
    available: "현재 데이터상 재고 있음",
    unavailable: "현재 구매 불가",
    unknownStock: "재고 확인 필요",
    view: "제품 보기",
    handoff: "nanoHome 담당자의 추가 확인이 필요합니다.",
  },
} as const;

const maximumBufferedCharacters = 64 * 1024;
const maximumLineCharacters = 32 * 1024;

function parseEventLine(line: string): PublicChatEvent {
  if (line.length > maximumLineCharacters) {
    throw new Error("Public chat event exceeds the line limit");
  }
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new Error("Public chat returned malformed JSON");
  }
  const parsed = publicChatEventSchema.safeParse(value);
  if (!parsed.success) throw new Error("Public chat returned an invalid event");
  return parsed.data;
}

export async function readPublicChatEvents(
  response: Response,
  onEvent: (event: PublicChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!response.ok || !contentType.startsWith("application/x-ndjson") || response.body === null) {
    throw new Error("Public chat response is unavailable");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const abort = () => void reader.cancel();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      if (buffer.length > maximumBufferedCharacters) {
        throw new Error("Public chat response exceeds the buffer limit");
      }
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line.length > 0) onEvent(parseEventLine(line));
        newline = buffer.indexOf("\n");
      }
      if (chunk.done) break;
    }
    const trailing = buffer.trim();
    if (trailing.length > 0) onEvent(parseEventLine(trailing));
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

function uniqueBy<T>(
  current: readonly T[],
  incoming: readonly T[],
  key: (item: T) => string,
): readonly T[] {
  const seen = new Set(current.map(key));
  return [
    ...current,
    ...incoming.filter((item) => {
      const value = key(item);
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    }),
  ];
}

function priceLabel(product: ChatProduct, locale: PublicChatLocale): string {
  const text = labels[locale];
  if (product.price?.mode === "fixed") {
    const numberLocale = locale === "vi" ? "vi-VN" : locale === "ko" ? "ko-KR" : "en-US";
    try {
      return new Intl.NumberFormat(numberLocale, {
        style: "currency",
        currency: product.price.currency,
        maximumFractionDigits: 0,
      }).format(product.price.amount);
    } catch {
      return `${product.price.amount.toLocaleString(numberLocale)} ${product.price.currency}`;
    }
  }
  return product.price?.mode === "contact" ? text.contactPrice : text.unavailablePrice;
}

function stockLabel(product: ChatProduct, locale: PublicChatLocale): string {
  const text = labels[locale];
  if (product.stock?.state === "available") return text.available;
  if (product.stock?.state === "unavailable") return text.unavailable;
  return text.unknownStock;
}

function ProductCard({ product, locale }: Readonly<{ product: ChatProduct; locale: PublicChatLocale }>) {
  const text = labels[locale];
  const brand = product.attributes?.brand;
  const subtitle = [product.attributes?.designer, product.attributes?.collection]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" · ");
  const content = (
    <>
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-md bg-nh-surface-warm">
        {product.image?.src ? (
          <Image
            alt={product.image.alt}
            className="object-contain p-3"
            fill
            sizes="(max-width: 640px) 42vw, 170px"
            src={product.image.src}
          />
        ) : (
          <div aria-hidden="true" className="h-full w-full bg-nh-surface-muted" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-3">
        {brand ? <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-nh-muted">{brand}</p> : null}
        <h3 className="line-clamp-2 text-sm font-medium leading-5 text-nh-ink">{product.title}</h3>
        {subtitle ? <p className="line-clamp-2 text-xs leading-4 text-nh-muted">{subtitle}</p> : null}
        <p className="mt-auto pt-1 text-sm font-semibold text-nh-ink">{priceLabel(product, locale)}</p>
        <p className={product.stock?.state === "available" ? "text-[11px] font-medium text-nh-green" : "text-[11px] text-nh-muted"}>
          {stockLabel(product, locale)}
        </p>
        {product.canonicalLink ? <span className="pt-1 text-xs font-medium text-nh-accent underline underline-offset-4">{text.view}</span> : null}
      </div>
    </>
  );

  const className = "flex min-w-0 flex-col rounded-lg border border-nh-border bg-white p-2 text-left transition-colors hover:border-nh-accent";
  return product.canonicalLink ? (
    <a aria-label={`${text.view}: ${product.title}`} className={className} href={product.canonicalLink}>
      {content}
    </a>
  ) : (
    <article className={className}>{content}</article>
  );
}

function TranscriptMessage({ entry, locale, onRetry }: Readonly<{
  entry: TranscriptEntry;
  locale: PublicChatLocale;
  onRetry: () => void;
}>) {
  const text = labels[locale];
  const assistant = entry.role === "assistant";
  return (
    <article className={assistant ? "mr-7" : "ml-7"} data-chat-role={entry.role}>
      <div className={assistant ? "rounded-2xl rounded-tl-sm bg-nh-surface-warm px-3 py-2.5 text-sm leading-5 text-nh-ink" : "rounded-2xl rounded-tr-sm bg-nh-footer px-3 py-2.5 text-sm leading-5 text-white"}>
        <p className="whitespace-pre-wrap break-words">{entry.text}</p>
        {entry.handoff ? <p className="mt-2 border-t border-nh-border pt-2 text-xs text-nh-muted">{text.handoff}</p> : null}
        {entry.failed ? (
          <button className="mt-2 min-h-11 rounded-md border border-nh-border px-3 text-xs font-semibold text-nh-ink" onClick={onRetry} type="button">
            {text.retry}
          </button>
        ) : null}
      </div>
      {entry.products.length > 0 ? (
        <div className="mt-2 grid grid-cols-2 gap-2" data-testid="chat-product-grid">
          {entry.products.map((product) => <ProductCard key={product.variantId} locale={locale} product={product} />)}
        </div>
      ) : null}
      {entry.images.length > 0 ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {entry.images.flatMap((image) => image.src ? [(
            <div className="relative aspect-square overflow-hidden rounded-lg bg-nh-surface-warm" key={image.canonicalImageId}>
              <Image alt={image.alt} className="object-contain" fill sizes="170px" src={image.src} />
            </div>
          )] : [])}
        </div>
      ) : null}
      {entry.sources.length > 0 ? (
        <ul aria-label="Sources" className="mt-2 space-y-1 text-[11px] text-nh-muted">
          {entry.sources.map((source) => <li key={source}>▪ {source}</li>)}
        </ul>
      ) : null}
    </article>
  );
}

export function PublicChatWidget({ locale }: Readonly<{ locale: PublicChatLocale }>) {
  const text = labels[locale];
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [entries, setEntries] = useState<readonly TranscriptEntry[]>([]);
  const [lastQuestion, setLastQuestion] = useState("");
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => activeControllerRef.current?.abort(), []);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      launcherRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);
  useEffect(() => {
    const container = scrollRef.current;
    if (typeof container?.scrollTo === "function") {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [entries, status]);

  const close = () => {
    setOpen(false);
    launcherRef.current?.focus();
  };

  const submit = async (rawQuestion: string) => {
    const submittedQuestion = rawQuestion.trim();
    if (submittedQuestion.length === 0 || pending) return;
    const messageRef = `web-${entries.length}`;
    const assistantId = `${messageRef}-assistant`;
    const emptyEntry: TranscriptEntry = {
      id: assistantId,
      role: "assistant",
      text: "",
      products: [],
      images: [],
      sources: [],
      handoff: false,
      failed: false,
    };
    let draft = emptyEntry;
    const syncDraft = () => setEntries((current) => current.map((entry) => entry.id === assistantId ? draft : entry));
    setEntries((current) => [
      ...current,
      { ...emptyEntry, id: `${messageRef}-user`, role: "user", text: submittedQuestion },
      emptyEntry,
    ]);
    setQuestion("");
    setLastQuestion(submittedQuestion);
    setPending(true);
    setStatus(text.working);
    const controller = new AbortController();
    activeControllerRef.current = controller;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: submittedQuestion, locale, messageRef }),
        cache: "no-store",
        signal: controller.signal,
      });
      await readPublicChatEvents(response, (event) => {
        switch (event.type) {
          case "text_delta":
            draft = { ...draft, text: `${draft.text}${event.text}` };
            syncDraft();
            break;
          case "tool_started":
            setStatus(text.working);
            break;
          case "block_ready":
            if (event.block.type === "product_cards" || event.block.type === "comparison") {
              draft = { ...draft, products: uniqueBy(draft.products, event.block.products, (product) => product.variantId) };
            } else if (event.block.type === "image_gallery") {
              draft = { ...draft, images: uniqueBy(draft.images, event.block.images, (image) => image.canonicalImageId) };
            } else if (event.block.type === "staff_handoff") {
              draft = { ...draft, handoff: true };
            }
            syncDraft();
            break;
          case "evidence_ready":
            draft = { ...draft, sources: uniqueBy(draft.sources, [event.label], (source) => source) };
            syncDraft();
            break;
          case "message_failed":
            throw new Error("Public chat request was cancelled");
          case "message_completed":
            setStatus("");
            break;
          case "message_started":
            break;
        }
      }, controller.signal);
      if (draft.text.length === 0) throw new Error("Public chat returned no answer text");
    } catch {
      if (!controller.signal.aborted) {
        draft = { ...draft, text: text.error, failed: true };
        syncDraft();
      }
      setStatus("");
    } finally {
      if (activeControllerRef.current === controller) activeControllerRef.current = null;
      setPending(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit(question);
  };

  return (
    <>
      <button
        aria-controls="public-chat-panel"
        aria-expanded={open}
        aria-label={text.launcher}
        className="fixed bottom-24 right-4 z-[70] flex h-12 items-center gap-2 rounded-full bg-nh-footer px-4 text-sm font-semibold text-white shadow-xl transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent motion-reduce:transition-none"
        onClick={() => setOpen(true)}
        ref={launcherRef}
        type="button"
      >
        <MessageCircle aria-hidden="true" className="size-5" />
        <span className="hidden sm:inline">AI</span>
      </button>
      {open ? (
        <section
          aria-label={text.title}
          className="fixed inset-x-0 bottom-0 z-[80] flex h-[min(78dvh,42rem)] flex-col overflow-hidden rounded-t-2xl border border-nh-border bg-white shadow-2xl sm:bottom-5 sm:left-auto sm:right-5 sm:w-[min(26rem,calc(100vw-2rem))] sm:rounded-2xl"
          data-testid="public-chat-panel"
          id="public-chat-panel"
          role="region"
        >
          <header className="flex items-start justify-between gap-3 bg-nh-footer px-4 py-3 text-white">
            <div>
              <h2 className="text-sm font-semibold">{text.title}</h2>
              <p className="mt-0.5 text-[11px] leading-4 text-white/70">{text.subtitle}</p>
            </div>
            <button aria-label={text.close} className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10" onClick={close} type="button">
              <X aria-hidden="true" className="size-5" />
            </button>
          </header>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4" ref={scrollRef}>
            {entries.length === 0 ? <p className="rounded-2xl rounded-tl-sm bg-nh-surface-warm px-3 py-2.5 text-sm leading-5 text-nh-muted">{text.empty}</p> : null}
            {entries.map((entry) => (
              <TranscriptMessage entry={entry} key={entry.id} locale={locale} onRetry={() => void submit(lastQuestion)} />
            ))}
            {pending && status ? (
              <div className="mr-7 flex items-center gap-2 rounded-2xl rounded-tl-sm bg-nh-surface-warm px-3 py-2.5 text-xs text-nh-muted">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
                {status}
              </div>
            ) : null}
          </div>
          <p aria-live="polite" className="sr-only">{status}</p>
          <form className="flex items-end gap-2 border-t border-nh-border bg-white p-3" onSubmit={onSubmit}>
            <label className="sr-only" htmlFor="public-chat-question">{text.input}</label>
            <textarea
              className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-nh-border bg-white px-3 py-2.5 text-sm text-nh-ink outline-none placeholder:text-nh-muted focus:border-nh-accent"
              disabled={pending}
              id="public-chat-question"
              maxLength={1_000}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={text.placeholder}
              ref={inputRef}
              rows={1}
              value={question}
            />
            <button aria-label={text.send} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-nh-footer text-white disabled:cursor-not-allowed disabled:opacity-40" disabled={pending || question.trim().length === 0} type="submit">
              <Send aria-hidden="true" className="size-4" />
            </button>
          </form>
        </section>
      ) : null}
    </>
  );
}
