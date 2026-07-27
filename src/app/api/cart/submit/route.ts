import { NextResponse, type NextRequest } from "next/server";

import type { CanonicalOrderRequestItem } from "@/lib/commerce/order-request-catalog";
import { resolveOrderRequestCatalogFromSupabase } from "@/lib/commerce/order-request-catalog.server";

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
  vatRequested?: unknown;
  vnPayRequested?: unknown;
  vatCompanyName?: unknown;
  vatTaxCode?: unknown;
  vatInvoiceAddress?: unknown;
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

function formatCanonicalCartItem(item: CanonicalOrderRequestItem): string {
  const details = [
    `SKU: ${item.sku}`,
    item.category === null ? null : `Danh mục: ${item.category}`,
    `Giá: ${formatVnd(item.unitAmount)}`,
    `Tổng dòng: ${formatVnd(item.lineTotal)}`,
  ].filter(Boolean);

  return `${item.name} x${item.quantity}\n  ${details.join("\n  ")}`;
}

function buildCanonicalCartItemsString(items: readonly CanonicalOrderRequestItem[], total: number): string {
  return `${items.map(formatCanonicalCartItem).join("\n\n")}\n\nTotal: ${formatVnd(total)}`;
}

function getCartFormId(): string {
  return process.env.FILLOUT_CART_FORM_ID ?? process.env.NEXT_PUBLIC_FILLOUT_CART_FORM_ID ?? process.env.NEXT_PUBLIC_FILLOUT_FORM_ID ?? DEFAULT_CART_FORM_ID;
}

async function postToFillout(data: {
  name: string;
  phone: string;
  email: string;
  source: string;
  pageUrl: string;
  cartItems: string;
  total: number | null;
  vatRequested: boolean;
  vnPayRequested: boolean;
  vatCompanyName: string;
  vatTaxCode: string;
  vatInvoiceAddress: string;
}) {
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

  const vatRequestedId = process.env.FILLOUT_CART_QUESTION_VAT_REQUESTED_ID ?? "vfJ6";
  const vnPayRequestedId = process.env.FILLOUT_CART_QUESTION_VNPAY_REQUESTED_ID;
  const vatCompanyNameId = process.env.FILLOUT_CART_QUESTION_VAT_COMPANY_NAME_ID ?? "joRB";
  const vatTaxCodeId = process.env.FILLOUT_CART_QUESTION_VAT_TAX_CODE_ID ?? "rsSg";
  const vatInvoiceAddressId = process.env.FILLOUT_CART_QUESTION_VAT_INVOICE_ADDRESS_ID ?? "dLm4";

  const questions: FilloutQuestion[] = [
    { id: nameId, value: data.name },
    { id: phoneId, value: data.phone },
    { id: emailId, value: data.email },
    { id: cartItemsId, value: data.cartItems },
  ];

  if (totalId && data.total !== null) {
    questions.push({ id: totalId, value: data.total });
  }

  if (vatRequestedId) {
    questions.push({ id: vatRequestedId, value: data.vatRequested });
  }
  questions.push({ id: vatCompanyNameId, value: data.vatCompanyName });
  questions.push({ id: vatTaxCodeId, value: data.vatTaxCode });
  questions.push({ id: vatInvoiceAddressId, value: data.vatInvoiceAddress });

  if (vnPayRequestedId) {
    questions.push({ id: vnPayRequestedId, value: data.vnPayRequested });
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
    return NextResponse.json(
      { error: "Fillout rejected the submission" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
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

  const isHomeSource = source === "nanohome-home";

  const hasItems = Array.isArray(body.cartItems)
    ? body.cartItems.length > 0
    : asTrimmedString(body.cartItems) !== null;

  if (!isHomeSource && !hasItems) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const name = asTrimmedString(body.name) ?? (isHomeSource ? "Khách hàng" : null);
  const phone = asTrimmedString(body.phone);
  const email = asTrimmedString(body.email);

  if (!name || !isValidName(name)) return NextResponse.json({ error: "Name is invalid" }, { status: 400 });
  if (!phone || !isValidPhone(phone)) return NextResponse.json({ error: "Phone is invalid" }, { status: 400 });
  if (!email || !isValidEmail(email)) return NextResponse.json({ error: "Email is invalid" }, { status: 400 });

  let vatRequested = false;
  if ("vatRequested" in body) {
    if (typeof body.vatRequested === "boolean") {
      vatRequested = body.vatRequested;
    } else {
      return NextResponse.json({ error: "vatRequested must be a boolean" }, { status: 400 });
    }
  }

  let vnPayRequested = false;
  if ("vnPayRequested" in body) {
    if (typeof body.vnPayRequested === "boolean") {
      vnPayRequested = body.vnPayRequested;
    } else {
      return NextResponse.json({ error: "vnPayRequested must be a boolean" }, { status: 400 });
    }
  }

  const vatCompanyName = asTrimmedString(body.vatCompanyName) ?? "";
  const vatTaxCode = asTrimmedString(body.vatTaxCode) ?? "";
  const vatInvoiceAddress = asTrimmedString(body.vatInvoiceAddress) ?? "";

  let cartItems = "";
  let total: number | null = null;
  if (Array.isArray(body.cartItems) && body.cartItems.length > 0) {
    let catalogResult;
    try {
      catalogResult = await resolveOrderRequestCatalogFromSupabase(body.cartItems);
    } catch {
      return NextResponse.json({ error: "Catalog is temporarily unavailable" }, { status: 503 });
    }

    if (catalogResult.kind !== "success") {
      return NextResponse.json({ error: "Cart contains unavailable items" }, { status: 409 });
    }

    cartItems = buildCanonicalCartItemsString(
      catalogResult.orderRequest.items,
      catalogResult.orderRequest.totalAmount,
    );
    total = catalogResult.orderRequest.totalAmount;
  } else if (isHomeSource) {
    cartItems = asTrimmedString(body.cartItems) ?? "";
  } else {
    return NextResponse.json({ error: "Cart is invalid" }, { status: 400 });
  }

  return postToFillout({
    name,
    phone,
    email,
    source,
    pageUrl,
    cartItems,
    total,
    vatRequested,
    vnPayRequested,
    vatCompanyName,
    vatTaxCode,
    vatInvoiceAddress,
  });
}
