import { beforeEach, describe, expect, it, vi } from "vitest";

const BASE_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
  CRON_SECRET: "cron-test",
};

const MATRIX_KEYS = [
  "AUTH_PROVIDER", "PAYMENT_MODE", "CHAT_ENABLED", "DEEPSEEK_API_KEY", "DEEPSEEK_MODEL",
  "DEEPSEEK_BASE_URL", "PROMPT_VERSION", "CHAT_HANDOFF_ENABLED", "ADVISOR_INBOX_ENABLED",
  "ADVISOR_NOTIFICATION_PROVIDER", "ADVISOR_NOTIFICATION_DESTINATION", "ADVISOR_NOTIFICATION_API_KEY",
  "VISION_PROVIDER", "VISION_MODEL", "VISION_API_KEY", "VISION_PRIVATE_BUCKET", "VISION_UPLOAD_ENABLED",
  "ROOM_ANALYSIS_ENABLED", "VISUAL_SIMILARITY_ENABLED", "VISION_RETENTION_DAYS",
  "VISION_EVALUATION_STORAGE_ENABLED", "SEPAY_ENV", "SEPAY_MERCHANT_ID", "SEPAY_MERCHANT_SECRET",
  "SEPAY_IPN_SECRET", "SEPAY_PAYMENT_METHOD", "SEPAY_SUCCESS_URL", "SEPAY_ERROR_URL", "SEPAY_CANCEL_URL",
  "SEPAY_RECONCILIATION_ENABLED", "AMIS_API_BASE_URL", "AMIS_CLIENT_ID", "AMIS_CLIENT_SECRET",
  "AMIS_SYNC_ENABLED", "AMIS_WRITES_ENABLED", "AMIS_PERSONALIZATION_ENABLED", "RECOMMENDATIONS_SHADOW_MODE",
  "NEXT_PUBLIC_APP_ORIGIN", "NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_APP_ID", "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL",
  "NEXT_PUBLIC_FIREBASE_TENANT_ID", "ACCOUNT_CENTER_ENABLED", "AUTH_FIREBASE_ROLLOUT_PERCENT",
  "AUTH_LEGACY_LOGIN_ENABLED", "FIREBASE_ADMIN_PROJECT_ID", "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY", "AUTH_SESSION_COOKIE_NAME", "AUTH_SESSION_TTL_SECONDS",
  "FIREBASE_AUTH_EMULATOR_HOST", "AUTH_CSRF_SECRET", "KAKAO_APP_ID", "KAKAO_ADMIN_KEY",
  "KAKAO_REST_API_KEY", "KAKAO_CLIENT_SECRET", "GOOGLE_APPLICATION_CREDENTIALS",
] as const;

const CLEAN_MATRIX_ENV = Object.fromEntries(MATRIX_KEYS.map((key) => [key, undefined]));

async function importEnvWith(record: Record<string, string | undefined>) {
  vi.resetModules();
  const previous = { ...process.env };
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await import("./env");
  } finally {
    process.env = previous;
  }
}

const FIREBASE_PUBLIC = {
  AUTH_PROVIDER: "firebase",
  NEXT_PUBLIC_APP_ORIGIN: "https://app.example.com",
  NEXT_PUBLIC_FIREBASE_API_KEY: "firebase-test-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "project-test.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "project-test",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:123:web:test",
  FIREBASE_ADMIN_PROJECT_ID: "project-test",
};

const SEPAY_SANDBOX = {
  PAYMENT_MODE: "sepay_sandbox",
  SEPAY_ENV: "sandbox",
  SEPAY_MERCHANT_ID: "merchant-test",
  SEPAY_MERCHANT_SECRET: "merchant-secret-test",
  SEPAY_IPN_SECRET: "ipn-secret-test",
  SEPAY_PAYMENT_METHOD: "BANK_TRANSFER",
  SEPAY_SUCCESS_URL: "https://app.example.com/payment/success",
  SEPAY_ERROR_URL: "https://app.example.com/payment/error",
  SEPAY_CANCEL_URL: "https://app.example.com/payment/cancel",
};

describe("environment matrix", () => {
  beforeEach(() => vi.resetModules());

  it("uses network-disabled defaults in a baseline environment", async () => {
    // Given: only the existing platform contract.
    // When: the environment is parsed.
    const { env } = await importEnvWith({ ...BASE_ENV, ...CLEAN_MATRIX_ENV });

    // Then: every new provider or rollout is disabled safely.
    expect(env).toMatchObject({
      AUTH_PROVIDER: "supabase", PAYMENT_MODE: "off", CHAT_ENABLED: false, CHAT_HANDOFF_ENABLED: false,
      ADVISOR_INBOX_ENABLED: false, ADVISOR_NOTIFICATION_PROVIDER: "noop", VISION_PROVIDER: "off",
      VISION_UPLOAD_ENABLED: false, ROOM_ANALYSIS_ENABLED: false, VISUAL_SIMILARITY_ENABLED: false,
      VISION_EVALUATION_STORAGE_ENABLED: false, AMIS_SYNC_ENABLED: false, AMIS_WRITES_ENABLED: false,
      AMIS_PERSONALIZATION_ENABLED: false, RECOMMENDATIONS_SHADOW_MODE: true, ACCOUNT_CENTER_ENABLED: false,
      AUTH_FIREBASE_ROLLOUT_PERCENT: 0, AUTH_LEGACY_LOGIN_ENABLED: true,
    });
  });

  it("accepts Firebase ADC mode with matching public and admin projects", async () => {
    // Given: Firebase public config and project-only ADC mode.
    // When: the environment is parsed.
    const { env } = await importEnvWith({ ...BASE_ENV, ...CLEAN_MATRIX_ENV, ...FIREBASE_PUBLIC });

    // Then: Firebase is active without explicit service-account credentials.
    expect(env.AUTH_PROVIDER).toBe("firebase");
    expect(env.FIREBASE_ADMIN_CLIENT_EMAIL).toBeUndefined();
  });

  it("accepts Firebase explicit credential mode", async () => {
    // Given: matching Firebase projects and a complete explicit credential pair.
    // When: the environment is parsed.
    const { env } = await importEnvWith({
      ...BASE_ENV, ...CLEAN_MATRIX_ENV, ...FIREBASE_PUBLIC,
      FIREBASE_ADMIN_CLIENT_EMAIL: "firebase-admin@test.invalid", FIREBASE_ADMIN_PRIVATE_KEY: "private-key-test",
    });

    // Then: the explicit mode remains available.
    expect(env.FIREBASE_ADMIN_CLIENT_EMAIL).toBe("firebase-admin@test.invalid");
  });

  it.each([
    { FIREBASE_ADMIN_CLIENT_EMAIL: "firebase-admin@test.invalid" },
    { FIREBASE_ADMIN_PRIVATE_KEY: "private-key-test" },
  ])("rejects a partial Firebase explicit credential mode", async (partial) => {
    // Given: Firebase with one half of the explicit credential pair.
    // When / Then: parsing rejects the partial mode.
    await expect(importEnvWith({ ...BASE_ENV, ...CLEAN_MATRIX_ENV, ...FIREBASE_PUBLIC, ...partial }))
      .rejects.toThrow(/exactly one Firebase Admin credential mode/);
  });

  it("rejects Firebase mixed or mismatched admin configuration", async () => {
    // Given: explicit credentials combined with a mismatched admin project and ADC path.
    const broken = {
      ...BASE_ENV, ...CLEAN_MATRIX_ENV, ...FIREBASE_PUBLIC, FIREBASE_ADMIN_PROJECT_ID: "other-project",
      FIREBASE_ADMIN_CLIENT_EMAIL: "firebase-admin@test.invalid", FIREBASE_ADMIN_PRIVATE_KEY: "private-key-test",
      GOOGLE_APPLICATION_CREDENTIALS: "/tmp/adc-test.json",
    };

    // When / Then: parsing rejects mixed ADC/explicit and project mismatch.
    await expect(importEnvWith(broken)).rejects.toThrow(/Firebase/);
  });

  it("accepts complete SePay sandbox configuration", async () => {
    // Given: complete sandbox credentials and HTTPS callbacks.
    // When: the environment is parsed.
    const { env } = await importEnvWith({ ...BASE_ENV, ...CLEAN_MATRIX_ENV, ...SEPAY_SANDBOX });

    // Then: the exact sandbox mode is retained.
    expect(env.PAYMENT_MODE).toBe("sepay_sandbox");
    expect(env.SEPAY_PAYMENT_METHOD).toBe("BANK_TRANSFER");
  });

  it.each(["disabled", "fake", "noop", "sepay"])("rejects unsupported payment mode %s", async (PAYMENT_MODE) => {
    // Given: a legacy or fake payment mode.
    // When / Then: parsing rejects ambiguous behavior.
    await expect(importEnvWith({ ...BASE_ENV, ...CLEAN_MATRIX_ENV, PAYMENT_MODE })).rejects.toThrow(/PAYMENT_MODE/);
  });

  it("rejects active SePay with missing or inconsistent sandbox configuration", async () => {
    // Given: sandbox mode without its IPN secret and with the primary selector.
    const broken = { ...BASE_ENV, ...CLEAN_MATRIX_ENV, ...SEPAY_SANDBOX, SEPAY_ENV: "primary", SEPAY_IPN_SECRET: undefined };

    // When / Then: parsing rejects the incomplete active contract.
    await expect(importEnvWith(broken)).rejects.toThrow(/SePay/);
  });

  it("requires credentials for active chat, notification, vision, and AMIS modes", async () => {
    // Given: every optional network integration activated without its contract.
    const broken = {
      ...BASE_ENV, ...CLEAN_MATRIX_ENV, CHAT_ENABLED: "true", ADVISOR_NOTIFICATION_PROVIDER: "webhook",
      VISION_PROVIDER: "primary", VISION_UPLOAD_ENABLED: "true", AMIS_SYNC_ENABLED: "true",
    };

    // When / Then: parsing rejects missing network credentials and URLs.
    await expect(importEnvWith(broken)).rejects.toThrow(/configuration/);
  });

  it("rejects out-of-range rollout, session, and retention values", async () => {
    // Given: numeric controls outside their policy bounds.
    const broken = {
      ...BASE_ENV, ...CLEAN_MATRIX_ENV, AUTH_FIREBASE_ROLLOUT_PERCENT: "101",
      AUTH_SESSION_TTL_SECONDS: "299", VISION_RETENTION_DAYS: "0",
    };

    // When / Then: parsing rejects bounded controls.
    await expect(importEnvWith(broken)).rejects.toThrow();
  });

  it.each(["NEXT_PUBLIC_SEPAY_MERCHANT_SECRET", "NEXT_PUBLIC_KAKAO_ADMIN_KEY"])(
    "rejects forbidden public provider variable %s",
    async (forbiddenKey) => {
      // Given: a server credential name incorrectly exposed to the browser.
      // When / Then: parsing rejects the entire forbidden prefix.
      await expect(importEnvWith({ ...BASE_ENV, ...CLEAN_MATRIX_ENV, [forbiddenKey]: "leak-test" }))
        .rejects.toThrow(/must remain server-only/);
    },
  );
});
