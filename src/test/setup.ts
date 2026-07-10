import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

Object.assign(process.env, {
  AMIS_API_BASE_URL: "https://amis.test",
  CRON_SECRET: "cron-secret-test",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
});

// Ensure React Testing Library nodes are unmounted after each test to keep
// the jsdom document clean and prevent cross-test state leakage.
afterEach(() => {
  cleanup();
});
