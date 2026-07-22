import type { PublicChatLocale } from "./contracts";

export type PublicChatPolicyRequest =
  | { readonly locale: PublicChatLocale; readonly kind: "unsupported" }
  | { readonly locale: PublicChatLocale; readonly kind: "prompt_injection" }
  | { readonly locale: PublicChatLocale; readonly kind: "commercial_promise" }
  | { readonly locale: PublicChatLocale; readonly kind: "staff_access" }
  | { readonly locale: PublicChatLocale; readonly kind: "customer_access" }
  | { readonly locale: PublicChatLocale; readonly kind: "order_access" }
  | { readonly locale: PublicChatLocale; readonly kind: "policy_exception" };

export type PublicChatPolicyDecision =
  | { readonly kind: "handoff"; readonly reasonCode: "unsupported_request" | "staff_confirmation_required"; readonly text: string }
  | { readonly kind: "refusal"; readonly reasonCode: "untrusted_instruction"; readonly text: string };

const policyText = {
  unsupported: {
    vi: "Tôi có thể giúp bạn tìm sản phẩm phù hợp hoặc kết nối bạn với nhân viên.",
    en: "I can help you find suitable products or connect you with our staff.",
    ko: "적합한 제품을 찾거나 담당자 연결을 도와드릴 수 있습니다.",
  },
  promptInjection: {
    vi: "Tôi chỉ có thể sử dụng thông tin trang web công khai đã được phê duyệt và các công cụ do máy chủ cho phép.",
    en: "I can only use approved public website information and server-authorized tools.",
    ko: "승인된 공개 웹사이트 정보와 서버에서 승인한 도구만 사용할 수 있습니다.",
  },
  commercialPromise: {
    vi: "Nhân viên có thể xác nhận chi tiết giao hàng, tồn kho, giá hoặc lắp đặt cho bạn.",
    en: "A team member can confirm delivery, stock, pricing, or installation details for you.",
    ko: "담당자가 배송, 재고, 가격 또는 설치 세부 정보를 확인해 드릴 수 있습니다.",
  },
} as const;

function assertNever(value: never): never {
  throw new TypeError(`Unexpected public chat policy request: ${JSON.stringify(value)}`);
}

export function resolvePublicChatPolicy(request: PublicChatPolicyRequest): PublicChatPolicyDecision {
  switch (request.kind) {
    case "unsupported":
      return { kind: "handoff", reasonCode: "unsupported_request", text: policyText.unsupported[request.locale] };
    case "prompt_injection":
      return { kind: "refusal", reasonCode: "untrusted_instruction", text: policyText.promptInjection[request.locale] };
    case "commercial_promise":
    case "staff_access":
    case "customer_access":
    case "order_access":
    case "policy_exception":
      return {
        kind: "handoff",
        reasonCode: "staff_confirmation_required",
        text: policyText.commercialPromise[request.locale],
      };
    default:
      return assertNever(request);
  }
}
