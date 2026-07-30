import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import messages from "../../messages/vi.json";
import { afterEach, vi } from "vitest";

function isTranslationRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function lookupTranslation(namespace: string, key: string): string {
  let value: unknown = messages;

  for (const segment of [...namespace.split("."), ...key.split(".")]) {
    if (!isTranslationRecord(value)) {
      return key;
    }

    value = value[segment];
  }

  return typeof value === "string" ? value : key;
}

vi.mock("next-intl/server", () => ({
  getTranslations: async (request?: string | { readonly namespace?: string }) => {
    const namespace = typeof request === "string" ? request : request?.namespace ?? "";
    return (key: string) => lookupTranslation(namespace, key);
  },
  setRequestLocale: vi.fn(),
}));

// Mock ResizeObserver for test environment
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

Object.assign(process.env, {
  AMIS_API_BASE_URL: "https://amis.test",
  AUTH_CSRF_SECRET: "test-only-auth-csrf-secret-32-bytes",
  CRON_SECRET: "cron-secret-test",
  NEXT_PUBLIC_MEDIA_URL: "https://pub-test.r2.dev",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  NEXT_PUBLIC_SUPABASE_URL: "https://test-project.supabase.co",
  SUPABASE_PROJECT_REF: "test-project",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
});

// Ensure React Testing Library nodes are unmounted after each test to keep
// the jsdom document clean and prevent cross-test state leakage.
afterEach(() => {
  cleanup();
});
