import { describe, expect, it } from "vitest";

import { inspectStagingConfiguration, parseEnvFile } from "./staging-doctor";

const complete = {
  ACCOUNT_CENTER_ENABLED: "true",
  AMIS_WRITES_ENABLED: "false",
  AUTH_CSRF_SECRET: "dedicated-csrf-secret-with-32-bytes-minimum",
  AUTH_PROVIDER: "firebase",
  AUTH_SESSION_TTL_SECONDS: "432000",
  CHAT_ENABLED: "true",
  CRON_SECRET: "cron-secret-not-shared-with-csrf",
  DEEPSEEK_API_KEY: "deepseek-secret-not-shared-with-csrf",
  DEEPSEEK_BASE_URL: "https://api.deepseek.com",
  DEEPSEEK_MODEL: "deepseek-v4-flash",
  FIREBASE_ADMIN_PROJECT_ID: "temp-nanohome",
  GOOGLE_APPLICATION_CREDENTIALS: "/secure/firebase-admin.json",
  NEXT_PUBLIC_APP_ORIGIN: "https://staging.nanohome.vn",
  NEXT_PUBLIC_FIREBASE_API_KEY: "firebase-public-test-key",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:123:web:staging",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "staging.nanohome.vn",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "temp-nanohome",
  NEXT_PUBLIC_MEDIA_URL: "https://media-staging.nanohome.vn",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_staging_test",
  NEXT_PUBLIC_SUPABASE_URL: "https://xtjmwpeqarmsumjspnyw.supabase.co",
  PAYMENT_MODE: "sepay_sandbox",
  PROMPT_VERSION: "public-advisor-v3",
  SEPAY_API_BASE_URL: "https://userapi-sandbox.sepay.vn/v2",
  SEPAY_API_TOKEN: "sepay-test-token",
  SEPAY_ENV: "sandbox",
  SEPAY_PAYMENT_METHOD: "BANK_TRANSFER",
  SEPAY_TEST_BANK_ACCOUNT_ID: "00000000-0000-4000-8000-000000000701",
  SEPAY_WEBHOOK_HMAC_SECRET: "sepay-test-hmac-secret-at-least-32-bytes",
  SUPABASE_PROJECT_REF: "xtjmwpeqarmsumjspnyw",
  SUPABASE_SERVICE_ROLE_KEY: "supabase-service-role-not-shared",
  VISION_PROVIDER: "off",
};

describe("staging doctor", () => {
  it("parses dotenv values without returning comments", () => {
    expect(parseEnvFile("A=one\n# B=two\nC=\"three four\"\n")).toEqual({
      A: "one",
      C: "three four",
    });
  });

  it("reports every local configuration failure in one pass", () => {
    const checks = inspectStagingConfiguration({
      ...complete,
      ACCOUNT_CENTER_ENABLED: "false",
      AUTH_CSRF_SECRET: complete.SUPABASE_SERVICE_ROLE_KEY,
      AUTH_PUBLIC_ORIGIN: "https://staging.nanohome.vn",
      AUTH_SESSION_TTL_SECONDS: undefined,
      FIREBASE_ADMIN_PROJECT_ID: "wrong-project",
      GOOGLE_APPLICATION_CREDENTIALS: "/missing/firebase-admin.json",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "temp-nanohome.firebaseapp.com",
      NEXT_PUBLIC_MEDIA_URL: undefined,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
      NEXT_PUBLIC_SUPABASE_URL: "https://production.supabase.co",
    }, { exists: false, mode: null });

    expect(checks.firebaseProjectPair.status).toBe("FAIL");
    expect(checks.firebasePublicConfig.status).toBe("FAIL");
    expect(checks.firebaseAdmin.status).toBe("FAIL");
    expect(checks.sessionCookie.status).toBe("FAIL");
    expect(checks.csrfSecret.status).toBe("FAIL");
    expect(checks.supabaseTarget.status).toBe("FAIL");
    expect(checks.coreRuntime.status).toBe("FAIL");
    expect(checks.catalogMedia.status).toBe("FAIL");
    expect(checks.accountRuntime.status).toBe("BLOCKED_CONFIG");
    expect(checks.obsoleteVariables.status).toBe("FAIL");
  });

  it("passes the complete local staging contract without exposing values", () => {
    const checks = inspectStagingConfiguration(complete, { exists: true, mode: 0o600 });
    const localGate = [
      "origin",
      "firebaseProjectPair",
      "firebasePublicConfig",
      "firebaseAdmin",
      "sessionCookie",
      "csrfSecret",
      "supabaseTarget",
      "coreRuntime",
      "catalogMedia",
      "accountRuntime",
      "obsoleteVariables",
      "exclusions",
      "deepseekConfig",
      "sepayConfig",
    ];
    expect(localGate.map((key) => checks[key]?.status)).toEqual(
      localGate.map(() => "PASS"),
    );
    expect(JSON.stringify(checks)).not.toContain(complete.AUTH_CSRF_SECRET);
  });

  it("blocks Test Mode when its exact bank-account selector is absent", () => {
    const checks = inspectStagingConfiguration({
      ...complete,
      SEPAY_TEST_BANK_ACCOUNT_ID: undefined,
    }, { exists: true, mode: 0o600 });

    expect(checks.sepayConfig?.status).toBe("BLOCKED_CONFIG");
    expect(checks.sepayConfig?.detail).toMatchObject({
      testBankAccountConfigured: false,
    });
  });
});
