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

const envSchema = z.object({
  // --- PUBLIC (browser-safe) ---
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_CLARITY_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_AXIOM_DATASET: z.string().min(1).optional(),
  NEXT_PUBLIC_AXIOM_TOKEN: z.string().min(1).optional(),

  // --- SERVER-ONLY ---
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),

  // --- AMIS (server-only) ---
  AMIS_API_BASE_URL: optionalEnvUrl,
  AMIS_API_KEY: optionalEnvString,
  AMIS_CLIENT_ID: optionalEnvString,
  AMIS_CLIENT_SECRET: optionalEnvString,
  AMIS_TENANT: optionalEnvString,
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
