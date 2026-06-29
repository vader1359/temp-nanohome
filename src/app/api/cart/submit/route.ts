import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const FILLOUT_API_BASE = "https://api.fillout.com/v1/api";
const DEFAULT_CART_FORM_ID = "8H6jTR29nGus";

type SubmissionRequest = {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  source?: unknown;
  pageUrl?: unknown;
  cartItems?: unknown;
  total?: unknown;
};

type FilloutQuestion = {
  id?: string;
  value: unknown;
};

type FilloutUrlParameter = {
  id: string;
  name: string;
  value: string;
};

type FilloutSubmission = {
  questions: FilloutQuestion[];
  urlParameters: FilloutUrlParameter[];
  submissionTime: string;
};

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidName(name: string): boolean {
  return /^[\p{L}\p{M}\s.'-]{2,100}$/u.test(name);
}

function isValidPhone(phone: string): boolean {
  return /^[0-9+\-\s()]{9,15}$/.test(phone);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatVnd(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    currency: "VND",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatCartItem(item: unknown): string {
  if (!isRecord(item)) return String(item);

  const name = asTrimmedString(item.name) ?? "Sản phẩm";
  const category = asTrimmedString(item.category);
  const quantity = asFiniteNumber(item.quantity) ?? 1;
  const priceText = asTrimmedString(item.price);
  const originalPrice = asTrimmedString(item.originalPrice);
  const discount = asTrimmedString(item.discount);
  const badge = asTrimmedString(item.badge);
  const lineTotal = asFiniteNumber(item.lineTotal);

  const details = [
    category ? `Danh mục: ${category}` : null,
    priceText ? `Giá: ${priceText}` : null,
    originalPrice ? `Giá gốc: ${originalPrice}` : null,
    discount ? `Giảm giá: ${discount}` : null,
    badge ? `Trạng thái: ${badge}` : null,
    lineTotal !== null ? `Tổng dòng: ${formatVnd(lineTotal)}` : null,
  ].filter(Boolean);

  return `${name} x${quantity}${details.length ? `\n  ${details.join("\n  ")}` : ""}`;
}

function buildCartItemsString(cartItems: unknown, total: number | null): string {
  const cartItemsStr = Array.isArray(cartItems)
    ? cartItems.map(formatCartItem).join("\n\n")
    : asTrimmedString(cartItems) ?? "";

  if (total === null) return cartItemsStr;
  return cartItemsStr ? `${cartItemsStr}\n\nTotal: ${formatVnd(total)}` : `Total: ${formatVnd(total)}`;
}

function getCartFormId(): string {
  return process.env.FILLOUT_CART_FORM_ID ?? process.env.NEXT_PUBLIC_FILLOUT_CART_FORM_ID ?? process.env.NEXT_PUBLIC_FILLOUT_FORM_ID ?? DEFAULT_CART_FORM_ID;
}

async function postToFillout(data: { name: string; phone: string; email: string; source: string; pageUrl: string; cartItems: string; total: number | null }) {
  const apiKey = process.env.FILLOUT_API_KEY;
  const formId = getCartFormId();

  if (!apiKey) {
    return NextResponse.json({ error: "Server is not configured (FILLOUT_API_KEY missing)" }, { status: 500 });
  }

  const nameId = process.env.FILLOUT_CART_QUESTION_NAME_ID ?? process.env.FILLOUT_QUESTION_NAME_ID ?? "rP8z";
  const phoneId = process.env.FILLOUT_CART_QUESTION_PHONE_ID ?? process.env.FILLOUT_QUESTION_PHONE_ID ?? "j5ou";
  const emailId = process.env.FILLOUT_CART_QUESTION_EMAIL_ID ?? process.env.FILLOUT_QUESTION_EMAIL_ID ?? "b4Qk";
  const cartItemsId = process.env.FILLOUT_CART_QUESTION_ITEMS_ID ?? "nNHy";
  const totalId = process.env.FILLOUT_CART_QUESTION_TOTAL_ID;
  const sourceParamId = process.env.FILLOUT_CART_PARAM_SOURCE_ID ?? process.env.FILLOUT_PARAM_SOURCE_ID ?? "source";
  const pageUrlParamId = process.env.FILLOUT_CART_PARAM_PAGE_URL_ID ?? process.env.FILLOUT_PARAM_PAGE_URL_ID ?? "page_url";

  const questions: FilloutQuestion[] = [
    { id: nameId, value: data.name },
    { id: phoneId, value: data.phone },
    { id: emailId, value: data.email },
    { id: cartItemsId, value: data.cartItems },
  ];

  if (totalId && data.total !== null) {
    questions.push({ id: totalId, value: data.total });
  }

  const submission: FilloutSubmission = {
    questions,
    submissionTime: new Date().toISOString(),
    urlParameters: [
      { id: sourceParamId, name: "source", value: data.source },
      { id: pageUrlParamId, name: "page_url", value: data.pageUrl },
    ],
  };

  const response = await fetch(`${FILLOUT_API_BASE}/forms/${encodeURIComponent(formId)}/submissions`, {
    body: JSON.stringify({ submissions: [submission] }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const detail = await response.json().catch(async () => response.text().catch(() => null));
    return NextResponse.json({ error: "Fillout rejected the submission", status: response.status, detail }, { status: 502 });
  }

  const fillout = await response.json().catch(() => null);
  return NextResponse.json({ ok: true, fillout });
}

export async function POST(request: NextRequest) {
  let body: SubmissionRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const source = asTrimmedString(body.source) ?? "nanohome-cart";
  const pageUrl = asTrimmedString(body.pageUrl) ?? "";
  const total = asFiniteNumber(body.total);
  const cartItems = buildCartItemsString(body.cartItems, total);

  if (!cartItems) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const name = asTrimmedString(body.name);
  const phone = asTrimmedString(body.phone);
  const email = asTrimmedString(body.email);

  if (!name || !isValidName(name)) return NextResponse.json({ error: "Name is invalid" }, { status: 400 });
  if (!phone || !isValidPhone(phone)) return NextResponse.json({ error: "Phone is invalid" }, { status: 400 });
  if (!email || !isValidEmail(email)) return NextResponse.json({ error: "Email is invalid" }, { status: 400 });

  return postToFillout({ name, phone, email, source, pageUrl, cartItems, total });
}
