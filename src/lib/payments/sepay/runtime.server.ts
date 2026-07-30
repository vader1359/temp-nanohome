import "server-only";

import { env } from "@/lib/env";

import {
  createSePayTestRepository,
  type SePayTestRepository,
} from "./repository.server";
import { SEPAY_TEST_API_BASE_URL } from "./test-mode-client.server";

const STAGING_ORIGIN = "https://staging.nanohome.vn";

export type SePayTestModeRuntimeConfig = Readonly<{
  readonly apiBaseUrl: typeof SEPAY_TEST_API_BASE_URL;
  readonly apiToken: string;
  readonly bankAccountId: string;
}>;

let repository: SePayTestRepository | undefined;

export function isSePaySandboxRuntimeEnabled(): boolean {
  return env.PAYMENT_MODE === "sepay_sandbox"
    && env.SEPAY_ENV === "sandbox"
    && env.ACCOUNT_CENTER_ENABLED === true
    && env.SEPAY_API_BASE_URL === SEPAY_TEST_API_BASE_URL
    && env.SEPAY_API_TOKEN !== undefined
    && env.SEPAY_WEBHOOK_HMAC_SECRET !== undefined
    && env.SEPAY_TEST_BANK_ACCOUNT_ID !== undefined
    && env.SEPAY_PAYMENT_METHOD === "BANK_TRANSFER"
    && env.NEXT_PUBLIC_APP_ORIGIN === STAGING_ORIGIN;
}

export function getSePayTestModeRuntimeConfig(): SePayTestModeRuntimeConfig | null {
  if (!isSePaySandboxRuntimeEnabled()) return null;
  const { SEPAY_API_TOKEN, SEPAY_TEST_BANK_ACCOUNT_ID } = env;
  if (SEPAY_API_TOKEN === undefined || SEPAY_TEST_BANK_ACCOUNT_ID === undefined) return null;
  return {
    apiBaseUrl: SEPAY_TEST_API_BASE_URL,
    apiToken: SEPAY_API_TOKEN,
    bankAccountId: SEPAY_TEST_BANK_ACCOUNT_ID,
  };
}

export function getSePayTestRepository(): SePayTestRepository {
  repository ??= createSePayTestRepository({
    baseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    mutationsEnabled: isSePaySandboxRuntimeEnabled(),
    projectRef: env.SUPABASE_PROJECT_REF,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });
  return repository;
}
