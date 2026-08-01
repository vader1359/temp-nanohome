import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { normalizeEmail } from "./email-normalization";
import type { AuthSessionIntent } from "./session-intent";
import type { Locale } from "@/i18n/routing";

export const EMAIL_LINK_RECOVERY_COOKIE = "__Host-nanohome-email-recovery";
export const EMAIL_LINK_RECOVERY_TTL_SECONDS = 10 * 60;
export const EMAIL_LINK_RECOVERY_COOKIE_MAX_AGE_SECONDS = 20 * 60;

const RECOVERY_STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

const payloadSchema = z.object({
  emailDigest: z.string().regex(RECOVERY_STATE_PATTERN),
  expiresAt: z.number().int().positive(),
  intent: z.enum(["account", "checkout"]),
  issuedAt: z.number().int().positive(),
  locale: z.enum(["vi", "en", "ko"]),
  returnTo: z.string().min(1).max(2_048),
  stateDigest: z.string().regex(RECOVERY_STATE_PATTERN),
  uidDigest: z.string().regex(RECOVERY_STATE_PATTERN),
  version: z.literal(1),
}).strict();

type RecoveryPayload = z.infer<typeof payloadSchema>;

export type EmailLinkRecoveryMetadata = Readonly<{
  intent: AuthSessionIntent;
  locale: Locale;
  returnTo: string;
}>;

export type EmailLinkRecoveryInspection =
  | Readonly<{ status: "expired" | "invalid" }>
  | Readonly<{ status: "valid"; payload: RecoveryPayload }>;

type CreateRecoveryInput = Readonly<{
  email: string;
  intent: AuthSessionIntent;
  locale: Locale;
  nowSeconds: number;
  returnTo: string;
  secret: string;
  state?: string;
  uid: string;
}>;

function keyFor(secret: string): Buffer {
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("Email-link recovery secret must contain at least 32 bytes");
  }
  return createHmac("sha256", secret)
    .update("nanohome-email-link-recovery-key-v1", "utf8")
    .digest();
}

function digest(key: Buffer, purpose: string, value: string): string {
  return createHmac("sha256", key)
    .update(purpose, "utf8")
    .update("\u0000", "utf8")
    .update(value, "utf8")
    .digest("base64url");
}

function sign(key: Buffer, encodedPayload: string): Buffer {
  return createHmac("sha256", key)
    .update("cookie-v1", "utf8")
    .update("\u0000", "utf8")
    .update(encodedPayload, "utf8")
    .digest();
}

function signaturesMatch(expected: Buffer, supplied: string): boolean {
  let suppliedBuffer: Buffer;
  try {
    suppliedBuffer = Buffer.from(supplied, "base64url");
  } catch {
    return false;
  }
  return suppliedBuffer.length === expected.length && timingSafeEqual(suppliedBuffer, expected);
}

function digestsMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "base64url");
  const rightBuffer = Buffer.from(right, "base64url");
  return leftBuffer.length === 32
    && rightBuffer.length === leftBuffer.length
    && timingSafeEqual(leftBuffer, rightBuffer);
}

function validState(state: string): boolean {
  return RECOVERY_STATE_PATTERN.test(state);
}

export function createEmailLinkRecoveryTransaction(input: CreateRecoveryInput): Readonly<{
  cookieValue: string;
  expiresAt: number;
  state: string;
  stateDigest: string;
}> {
  const email = input.email === undefined ? null : normalizeEmail(input.email);
  if (email === null || input.uid.length === 0 || !Number.isInteger(input.nowSeconds) || input.nowSeconds <= 0) {
    throw new Error("Invalid email-link recovery transaction input");
  }

  const state = input.state ?? randomBytes(32).toString("base64url");
  if (!validState(state)) throw new Error("Invalid email-link recovery state");

  const key = keyFor(input.secret);
  const payload: RecoveryPayload = {
    emailDigest: digest(key, "email", email),
    expiresAt: input.nowSeconds + EMAIL_LINK_RECOVERY_TTL_SECONDS,
    intent: input.intent,
    issuedAt: input.nowSeconds,
    locale: input.locale,
    returnTo: input.returnTo,
    stateDigest: digest(key, "state", state),
    uidDigest: digest(key, "uid", input.uid),
    version: 1,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(key, encodedPayload).toString("base64url");

  return {
    cookieValue: `${encodedPayload}.${signature}`,
    expiresAt: payload.expiresAt,
    state,
    stateDigest: payload.stateDigest,
  };
}

export function inspectEmailLinkRecoveryTransaction(input: Readonly<{
  cookieValue: string | undefined;
  nowSeconds: number;
  secret: string;
  state: string;
}>): EmailLinkRecoveryInspection {
  if (
    !validState(input.state)
    || !Number.isInteger(input.nowSeconds)
    || input.nowSeconds <= 0
    || input.cookieValue === undefined
    || input.cookieValue.length > 4_096
  ) {
    return { status: "invalid" };
  }

  const parts = input.cookieValue.split(".");
  if (parts.length !== 2) return { status: "invalid" };
  const [encodedPayload, suppliedSignature] = parts;
  if (encodedPayload === undefined || suppliedSignature === undefined) return { status: "invalid" };

  const key = keyFor(input.secret);
  if (!signaturesMatch(sign(key, encodedPayload), suppliedSignature)) return { status: "invalid" };

  let payloadInput: unknown;
  try {
    payloadInput = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return { status: "invalid" };
  }
  const parsed = payloadSchema.safeParse(payloadInput);
  if (!parsed.success) return { status: "invalid" };
  const payload = parsed.data;

  if (
    payload.issuedAt > input.nowSeconds + 30
    || !digestsMatch(payload.stateDigest, digest(key, "state", input.state))
  ) {
    return { status: "invalid" };
  }
  if (input.nowSeconds >= payload.expiresAt) return { status: "expired" };
  return { payload, status: "valid" };
}

export function recoveryMetadataForIdentity(input: Readonly<{
  email: string | undefined;
  emailVerified: boolean;
  inspection: EmailLinkRecoveryInspection;
  secret: string;
  uid: string;
}>): EmailLinkRecoveryMetadata | null {
  if (input.inspection.status !== "valid" || !input.emailVerified || input.uid.length === 0) return null;
  const email = input.email === undefined ? null : normalizeEmail(input.email);
  if (email === null) return null;

  const key = keyFor(input.secret);
  if (
    !digestsMatch(input.inspection.payload.uidDigest, digest(key, "uid", input.uid))
    || !digestsMatch(input.inspection.payload.emailDigest, digest(key, "email", email))
  ) {
    return null;
  }

  return {
    intent: input.inspection.payload.intent,
    locale: input.inspection.payload.locale,
    returnTo: input.inspection.payload.returnTo,
  };
}
