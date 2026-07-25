import { z } from "zod";

// Env schema for nanohome.
//
// Public (NEXT_PUBLIC_*) vars are inlined by Next.js at build time, so they
// are referenced as static `process.env.NEXT_PUBLIC_*` member expressions in
// consumer code (see src/lib/supabase/browser.ts, instrumentation, etc.).
//
// Server-only vars never reach the client bundle. Anything that must NOT be
// exposed to the browser MUST NOT be prefixed with NEXT_PUBLIC_.
const optionalEnvString = z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional());
const optionalEnvUrl = z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional());
const envBoolean = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
);

const envSchema = z.object({
  // --- PUBLIC (browser-safe) ---
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_CLARITY_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_AXIOM_DATASET: z.string().min(1).optional(),
  NEXT_PUBLIC_AXIOM_TOKEN: z.string().min(1).optional(),
  NEXT_PUBLIC_MEDIA_URL: optionalEnvUrl,

  // --- SERVER-ONLY ---
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),

  // --- Provider switches (server-only) ---
  AUTH_PROVIDER: z.enum(["supabase", "firebase", "disabled", "fake", "noop", "off"]).default("supabase"),
  PAYMENT_MODE: z.enum(["off", "sepay", "disabled", "fake", "noop"]).default("off"),
  CHAT_ENABLED: envBoolean,

  // --- Firebase Auth (public and server-only; required only with Firebase) ---
  NEXT_PUBLIC_FIREBASE_API_KEY: optionalEnvString,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: optionalEnvString,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: optionalEnvString,
  NEXT_PUBLIC_FIREBASE_APP_ID: optionalEnvString,
  FIREBASE_PROJECT_ID: optionalEnvString,
  FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON: optionalEnvString,
  FIREBASE_ADMIN_CLIENT_EMAIL: optionalEnvString,
  FIREBASE_ADMIN_PRIVATE_KEY: optionalEnvString,

  // --- SePay (server-only; required only when payment is active) ---
  SEPAY_API_TOKEN: optionalEnvString,
  SEPAY_WEBHOOK_SECRET: optionalEnvString,

  // --- AMIS (server-only) ---
  AMIS_API_BASE_URL: optionalEnvUrl,
  AMIS_CLIENT_ID: optionalEnvString,
  AMIS_CLIENT_SECRET: optionalEnvString,

  // --- DeepSeek public-chat provider (server-only, optional) ---
  DEEPSEEK_API_KEY: optionalEnvString,
  DEEPSEEK_MODEL: z.enum([
    "deepseek-v4-flash",
    "deepseek-v4-pro",
    "deepseek-chat",
    "deepseek-reasoner",
  ]).optional(),

  // --- Instagram Graph API (server-only, optional) ---
  INSTAGRAM_ACCESS_TOKEN: optionalEnvString,
  INSTAGRAM_BUSINESS_ACCOUNT_ID: optionalEnvString,
  META_APP_ID: optionalEnvString,
  META_APP_SECRET: optionalEnvString,

  // --- Cloudinary and Wistia (server-only, optional) ---
  CLOUDINARY_URL: optionalEnvString,
  CF_R2_ACCESS_KEY_ID: optionalEnvString,
  CF_R2_SECRET_ACCESS_KEY: optionalEnvString,
  CF_R2_ENDPOINT: optionalEnvUrl,
  CF_R2_BUCKET: optionalEnvString,
  WISTIA_API_TOKEN: optionalEnvString,
}).superRefine((value, context) => {
  if (value.AUTH_PROVIDER === "firebase") {
    const requiredFirebaseValues = [
      value.NEXT_PUBLIC_FIREBASE_API_KEY,
      value.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      value.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      value.NEXT_PUBLIC_FIREBASE_APP_ID,
      value.FIREBASE_PROJECT_ID,
    ];
    if (requiredFirebaseValues.some((requiredValue) => requiredValue === undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Firebase auth requires public and admin Firebase configuration",
        path: ["AUTH_PROVIDER"],
      });
    }

    if (value.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== value.FIREBASE_PROJECT_ID) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Firebase public and admin project IDs must match",
        path: ["FIREBASE_PROJECT_ID"],
      });
    }

    const hasServiceAccountJson = value.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON !== undefined;
    const hasIndividualCredential = value.FIREBASE_ADMIN_CLIENT_EMAIL !== undefined || value.FIREBASE_ADMIN_PRIVATE_KEY !== undefined;
    const hasCompleteIndividualCredential = value.FIREBASE_ADMIN_CLIENT_EMAIL !== undefined && value.FIREBASE_ADMIN_PRIVATE_KEY !== undefined;
    if (hasServiceAccountJson === hasIndividualCredential || (hasIndividualCredential && !hasCompleteIndividualCredential)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Firebase auth requires exactly one admin credential mode",
        path: ["FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON"],
      });
    }
  }

  if (value.PAYMENT_MODE === "sepay" && (value.SEPAY_API_TOKEN === undefined || value.SEPAY_WEBHOOK_SECRET === undefined)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "SePay payment mode requires an API token and webhook secret",
      path: ["PAYMENT_MODE"],
    });
  }
});

/**
 * Parsed, typed environment for the app. Import where needed instead of
 * reading `process.env` directly.
 *
 * Throws a ZodError at module load if any required var is missing or invalid,
 * which surfaces as a hard build/runtime failure — exactly what we want for
 * misconfigured secrets.
 *
 * `NEXT_PUBLIC_*` keys are kept as strings (zod `.url()` validates but does
 * not coerce to a URL instance) so Next.js can inline them at build time.
 */
export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
