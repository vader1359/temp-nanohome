import "server-only";

import { env } from "@/lib/env";

import {
  createSePayTestRepository,
  type SePayTestRepository,
} from "./repository.server";

let repository: SePayTestRepository | undefined;

export function isSePaySandboxRuntimeEnabled(): boolean {
  return env.PAYMENT_MODE === "sepay_sandbox"
    && env.SEPAY_ENV === "sandbox"
    && env.ACCOUNT_CENTER_ENABLED === true;
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
