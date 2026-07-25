import { describe, expect, it, vi, beforeEach } from "vitest";

// These tests exercise the zod env parser directly so they don't depend on
// the real process.env loaded for the dev/build environment.
//
// We can't simply `import { env }` because the module evaluates the schema at
// import time against the ambient process.env. Instead we re-import the module
// per test with a controlled process.env using vi.resetModules + dynamic import.

const FULL_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
  CRON_SECRET: "cron-test",
  AMIS_API_BASE_URL: "https://amis.example.com",
};

const PROVIDER_ENV_KEYS = [
  "AUTH_PROVIDER",
  "PAYMENT_MODE",
  "CHAT_ENABLED",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
  "SEPAY_API_TOKEN",
  "SEPAY_WEBHOOK_SECRET",
] as const;

const DISABLED_PROVIDER_ENV = Object.fromEntries(
  PROVIDER_ENV_KEYS.map((key) => [key, undefined]),
);

async function importEnvWith(record: Record<string, string | undefined>) {
  vi.resetModules();
  const previous = { ...process.env };
  for (const key of Object.keys(record)) {
    if (record[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = record[key] as string;
    }
  }
  // Next.js inlines NEXT_PUBLIC_* at bundle time but vitest uses the real
  // process.env, so direct assignment is sufficient here.
  try {
    const mod = await import("./env");
    return mod;
  } finally {
    // Restore the keys we mutated only.
    for (const key of Object.keys(record)) {
      if (key in previous) {
        process.env[key] = previous[key];
      } else {
        delete process.env[key];
      }
    }
  }
}

describe("env parser", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("parses the Supabase and off-provider defaults without optional credentials", async () => {
    // Given: a complete valid env record.
    // When: the env module is imported.
    const { env } = await importEnvWith({ ...FULL_ENV, ...DISABLED_PROVIDER_ENV });

    // Then: parsed public + server values are returned as typed strings.
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
    expect(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("sb_publishable_test");
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("service-role-test");
    expect(env.AMIS_API_BASE_URL).toBe("https://amis.example.com");
    expect(env.AMIS_CLIENT_ID).toBeUndefined();
    expect(env.INSTAGRAM_ACCESS_TOKEN).toBeUndefined();
    expect(env.INSTAGRAM_BUSINESS_ACCOUNT_ID).toBeUndefined();
    expect(env.AUTH_PROVIDER).toBe("supabase");
    expect(env.PAYMENT_MODE).toBe("off");
    expect(env.CHAT_ENABLED).toBe(false);
  });

  it.each(["disabled", "fake", "noop", "off"] as const)(
    "permits missing Firebase credentials when auth mode is %s",
    async (AUTH_PROVIDER) => {
      // Given: an explicitly inactive authentication provider without Firebase credentials.
      // When: the env module is imported.
      const { env } = await importEnvWith({ ...FULL_ENV, ...DISABLED_PROVIDER_ENV, AUTH_PROVIDER });

      // Then: the inactive provider remains valid without Firebase configuration.
      expect(env.AUTH_PROVIDER).toBe(AUTH_PROVIDER);
    },
  );

  it.each(["disabled", "fake", "noop", "off"] as const)(
    "permits missing SePay credentials when payment mode is %s",
    async (PAYMENT_MODE) => {
      // Given: an inactive payment provider without SePay credentials.
      // When: the env module is imported.
      const { env } = await importEnvWith({ ...FULL_ENV, ...DISABLED_PROVIDER_ENV, PAYMENT_MODE });

      // Then: the inactive payment provider remains valid without SePay configuration.
      expect(env.PAYMENT_MODE).toBe(PAYMENT_MODE);
    },
  );

  it.each(["deepseek-v4-flash", "deepseek-v4-pro"] as const)(
    "accepts the supported DeepSeek V4 model %s",
    async (model) => {
      const { env } = await importEnvWith({ ...FULL_ENV, DEEPSEEK_MODEL: model });
      expect(env.DEEPSEEK_MODEL).toBe(model);
    },
  );

  it("temporarily accepts a legacy DeepSeek model name for safe runtime remapping", async () => {
    const { env } = await importEnvWith({ ...FULL_ENV, DEEPSEEK_MODEL: "deepseek-chat" });
    expect(env.DEEPSEEK_MODEL).toBe("deepseek-chat");
  });

  it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    // Given: env without the required service role key.
    const broken = { ...FULL_ENV, SUPABASE_SERVICE_ROLE_KEY: undefined };

    // When / Then: importing the module throws a zod error.
    await expect(importEnvWith(broken)).rejects.toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is not a valid URL", async () => {
    // Given: an invalid public URL.
    const broken = { ...FULL_ENV, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" };

    // When / Then: importing the module throws a zod URL validation error.
    await expect(importEnvWith(broken)).rejects.toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it("throws when CRON_SECRET is missing (server required)", async () => {
    // Given: env without the required cron secret.
    const broken = { ...FULL_ENV, CRON_SECRET: undefined };

    // When / Then: importing the module throws a zod error mentioning CRON_SECRET.
    await expect(importEnvWith(broken)).rejects.toThrow(/CRON_SECRET/);
  });

  it("throws when Firebase auth is active without its required configuration", async () => {
    // Given: Firebase auth selected without Firebase credentials.
    const broken = { ...FULL_ENV, ...DISABLED_PROVIDER_ENV, AUTH_PROVIDER: "firebase" };

    // When / Then: importing the module rejects the incomplete Firebase mode.
    await expect(importEnvWith(broken)).rejects.toThrow(/Firebase/);
  });

  it("throws when Firebase public and admin project IDs differ", async () => {
    // Given: Firebase auth with otherwise valid credentials for different projects.
    const broken = {
      ...FULL_ENV,
      ...DISABLED_PROVIDER_ENV,
      AUTH_PROVIDER: "firebase",
      NEXT_PUBLIC_FIREBASE_API_KEY: "firebase-api-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "example.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "public-project",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:123:web:abc",
      FIREBASE_PROJECT_ID: "admin-project",
      FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON: "{\"type\":\"service_account\"}",
    };

    // When / Then: importing the module rejects mismatched project identity.
    await expect(importEnvWith(broken)).rejects.toThrow(/project IDs must match/);
  });

  it("throws when Firebase auth selects both admin credential modes", async () => {
    // Given: Firebase auth with both JSON and individual admin credentials.
    const broken = {
      ...FULL_ENV,
      ...DISABLED_PROVIDER_ENV,
      AUTH_PROVIDER: "firebase",
      NEXT_PUBLIC_FIREBASE_API_KEY: "firebase-api-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "example.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "firebase-project",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:123:web:abc",
      FIREBASE_PROJECT_ID: "firebase-project",
      FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON: "{\"type\":\"service_account\"}",
      FIREBASE_ADMIN_CLIENT_EMAIL: "firebase-admin@example.iam.gserviceaccount.com",
      FIREBASE_ADMIN_PRIVATE_KEY: "test-private-key",
    };

    // When / Then: importing the module rejects ambiguous admin credentials.
    await expect(importEnvWith(broken)).rejects.toThrow(/exactly one admin credential mode/);
  });

  it("throws when SePay is active without its required configuration", async () => {
    // Given: SePay selected without its server-only credentials.
    const broken = { ...FULL_ENV, ...DISABLED_PROVIDER_ENV, PAYMENT_MODE: "sepay" };

    // When / Then: importing the module rejects the incomplete payment mode.
    await expect(importEnvWith(broken)).rejects.toThrow(/SePay/);
  });
});
