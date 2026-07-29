import "server-only";

import { env } from "@/lib/env";

import {
  createAccountCheckoutRepository,
  type AccountCheckoutRepository,
} from "./account-checkout-repository.server";

let repository: AccountCheckoutRepository | undefined;

export function getAccountCheckoutRepository(): AccountCheckoutRepository {
  repository ??= createAccountCheckoutRepository({
    baseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    mutationsEnabled: env.ACCOUNT_CENTER_ENABLED === true,
    projectRef: env.SUPABASE_PROJECT_REF,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });
  return repository;
}
