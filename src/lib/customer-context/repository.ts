import { env } from "@/lib/env";
import { z } from "zod";
import type { ConsentState } from "@/lib/consent/service";
import type { CustomerEvent } from "@/lib/events/service";

type TokenPair = Readonly<{ visitor: string; session: string }>;
type Identity = Readonly<{ visitorId: string; sessionId: string }>;
type IdentityLookup = Readonly<{ identity: Identity | null; status: "active" | "inactive" | "missing" }>;
type IdentityBindingResult = "bound" | "cleared" | "unchanged";
type Fetcher = typeof fetch;
const identitySchema = z.object({ visitor_id: z.string().nullable(), session_id: z.string().nullable(), status: z.enum(["active", "inactive", "created", "missing", "mismatch"]) }).strict();
const consentSchema = z.object({ analytics: z.boolean().optional(), personalization: z.boolean().optional(), ai_processing: z.boolean().optional(), ai_conversation_storage: z.boolean().optional(), room_image_processing: z.boolean().optional(), room_image_storage: z.boolean().optional(), marketing: z.boolean().optional(), policy_version: z.string().optional(), version: z.string().optional(), locale: z.enum(["vi", "en", "ko"]).optional(), source: z.string().optional(), withdrawn_at: z.string().nullable().optional(), withdrawal_reason: z.string().nullable().optional() }).strip();

export type CustomerRepository = Readonly<{
  resolveIdentity: (tokens: TokenPair) => Promise<IdentityLookup>;
  bootstrapIdentity: (tokens: TokenPair) => Promise<IdentityLookup>;
  currentConsent: (identity: Identity) => Promise<ConsentState | null>;
  bindVerifiedUser: (identity: Identity, verifiedUserId: string) => Promise<IdentityBindingResult | null>;
  clearVerifiedUser: (identity: Identity) => Promise<IdentityBindingResult | null>;
  appendConsent: (identity: Identity, consent: ConsentState) => Promise<ConsentState | null>;
  appendEvent: (identity: Identity, event: CustomerEvent, receivedAt: string) => Promise<"accepted" | "duplicate" | "rate_limited" | null>;
}>;

const hashToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const createRpcClient = (fetcher: Fetcher) => async (name: string, body: Readonly<Record<string, unknown>>): Promise<unknown> => {
  try {
    const response = await fetcher(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
};

const first = (value: unknown): unknown => Array.isArray(value) ? (value[0] ?? null) : value;

const parseConsent = (value: unknown): ConsentState | null => {
  const parsed = consentSchema.safeParse(value);
  if (!parsed.success) return null;
  return {
    essential: true,
    analytics: parsed.data.analytics,
    personalization: parsed.data.personalization,
    aiProcessing: parsed.data.ai_processing,
    aiConversationStorage: parsed.data.ai_conversation_storage,
    roomImageProcessing: parsed.data.room_image_processing,
    roomImageStorage: parsed.data.room_image_storage,
    marketing: parsed.data.marketing,
    version: parsed.data.version ?? parsed.data.policy_version,
    locale: parsed.data.locale,
    source: parsed.data.source,
    withdrawn: parsed.data.withdrawn_at !== undefined && parsed.data.withdrawn_at !== null,
    withdrawalReason: parsed.data.withdrawal_reason ?? undefined,
  };
};

export const createCustomerRepository = (fetcher: Fetcher = fetch): CustomerRepository => {
  const rpc = createRpcClient(fetcher);
  const identity = async (name: string, tokens: TokenPair): Promise<IdentityLookup> => {
    const row = identitySchema.safeParse(first(await rpc(name, {
      p_visitor_token_hash: await hashToken(tokens.visitor),
      p_session_token_hash: await hashToken(tokens.session),
    })));
    if (!row.success) return { identity: null, status: "missing" };
    if (row.data.status !== "active" && row.data.status !== "created") return { identity: null, status: row.data.status === "inactive" ? "inactive" : "missing" };
    if (row.data.visitor_id === null || row.data.session_id === null) return { identity: null, status: "missing" };
    return { identity: { visitorId: row.data.visitor_id, sessionId: row.data.session_id }, status: "active" };
  };
  return {
    resolveIdentity: (tokens) => identity("resolve_customer_identity_v2", tokens),
    bootstrapIdentity: (tokens) => identity("bootstrap_customer_identity_v2", tokens),
    currentConsent: async (value) => parseConsent(await rpc("current_customer_consent", { p_visitor_id: value.visitorId })),
    bindVerifiedUser: async (value, verifiedUserId) => {
      const result = await rpc("bind_verified_customer_identity", {
        p_visitor_id: value.visitorId,
        p_session_id: value.sessionId,
        p_user_id: verifiedUserId,
      });
      return result === "bound" || result === "unchanged" ? result : null;
    },
    clearVerifiedUser: async (value) => {
      const result = await rpc("clear_verified_customer_identity", {
        p_visitor_id: value.visitorId,
        p_session_id: value.sessionId,
      });
      return result === "cleared" || result === "unchanged" ? result : null;
    },
    appendConsent: async (value, consent) => {
      const request = {
        analytics: consent.analytics,
        personalization: consent.personalization,
        aiProcessing: consent.aiProcessing,
        aiConversationStorage: consent.aiConversationStorage,
        roomImageProcessing: consent.roomImageProcessing,
        roomImageStorage: consent.roomImageStorage,
        marketing: consent.marketing,
        version: consent.version,
        locale: consent.locale,
        source: consent.source,
        withdrawn: consent.withdrawn,
        withdrawalReason: consent.withdrawalReason,
      };
      return parseConsent(await rpc("append_customer_consent", { p_visitor_id: value.visitorId, p_session_id: value.sessionId, p_consent: request }));
    },
    appendEvent: async (value, event, receivedAt) => {
      const result = await rpc("append_customer_event", { p_visitor_id: value.visitorId, p_session_id: value.sessionId, p_event: event, p_received_at: receivedAt });
      return result === "accepted" || result === "duplicate" || result === "rate_limited" ? result : null;
    },
  };
};

export const customerRepository = createCustomerRepository();
