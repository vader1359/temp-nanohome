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

  it("parses a valid full env and exposes typed values", async () => {
    // Given: a complete valid env record.
    // When: the env module is imported.
    const { env } = await importEnvWith(FULL_ENV);

    // Then: parsed public + server values are returned as typed strings.
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
    expect(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("sb_publishable_test");
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("service-role-test");
    expect(env.AMIS_API_BASE_URL).toBe("https://amis.example.com");
    expect(env.AMIS_CLIENT_ID).toBeUndefined();
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
});