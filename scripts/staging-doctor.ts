import { execFile } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

type CheckStatus = "BLOCKED_CONFIG" | "FAIL" | "PASS" | "WARN";
type DoctorCheck = Readonly<{
  status: CheckStatus;
  detail?: Readonly<Record<string, boolean | number | string | null>>;
}>;
type DoctorChecks = Record<string, DoctorCheck>;

const execFileAsync = promisify(execFile);
const SESSION_COOKIE_NAME = "__Host-nanohome-session";
const TARGETS = {
  staging: {
    deepseekBaseUrl: "https://api.deepseek.com",
    firebaseAuthDomain: "staging.nanohome.vn",
    firebaseProjectId: "temp-nanohome",
    origin: "https://staging.nanohome.vn",
    sepayApiHost: "userapi-sandbox.sepay.vn",
    supabaseProjectRef: "xtjmwpeqarmsumjspnyw",
  },
} as const;

export function parseEnvFile(source: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\""))
      || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

export function inspectStagingConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
  credentialFile: Readonly<{ exists: boolean; mode: number | null }>,
): DoctorChecks {
  const target = TARGETS.staging;
  const checks: DoctorChecks = {};
  const value = (key: string) => environment[key]?.trim() || undefined;
  const isTrue = (key: string) => value(key) === "true";
  const isOff = (key: string) => value(key) === undefined || ["false", "off", "noop"].includes(value(key) ?? "");

  const origin = value("NEXT_PUBLIC_APP_ORIGIN");
  checks.origin = {
    status: origin === target.origin ? "PASS" : "FAIL",
    detail: { exactStagingOrigin: origin === target.origin },
  };

  const publicFirebaseProject = value("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const adminFirebaseProject = value("FIREBASE_ADMIN_PROJECT_ID");
  checks.firebaseProjectPair = {
    status: value("AUTH_PROVIDER") === "firebase"
      && publicFirebaseProject === target.firebaseProjectId
      && adminFirebaseProject === target.firebaseProjectId
      ? "PASS"
      : "FAIL",
    detail: {
      adminProjectMatches: adminFirebaseProject === target.firebaseProjectId,
      authProviderFirebase: value("AUTH_PROVIDER") === "firebase",
      publicProjectMatches: publicFirebaseProject === target.firebaseProjectId,
    },
  };

  const firebasePublicKeys = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  ];
  const firebasePublicPresent = firebasePublicKeys
    .filter((key) => value(key) !== undefined).length;
  const firebaseAuthDomainMatches = value("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN")
    === target.firebaseAuthDomain;
  checks.firebasePublicConfig = {
    status: firebasePublicPresent === firebasePublicKeys.length && firebaseAuthDomainMatches
      ? "PASS"
      : "FAIL",
    detail: {
      authDomainMatchesStagingOrigin: firebaseAuthDomainMatches,
      present: firebasePublicPresent,
      required: firebasePublicKeys.length,
    },
  };

  const explicitAdmin = Boolean(value("FIREBASE_ADMIN_CLIENT_EMAIL"))
    && Boolean(value("FIREBASE_ADMIN_PRIVATE_KEY"));
  const partialExplicitAdmin = Boolean(value("FIREBASE_ADMIN_CLIENT_EMAIL"))
    !== Boolean(value("FIREBASE_ADMIN_PRIVATE_KEY"));
  const adcConfigured = Boolean(value("GOOGLE_APPLICATION_CREDENTIALS"));
  const exactlyOneAdminMode = !partialExplicitAdmin && explicitAdmin !== adcConfigured;
  const adcSafe = !adcConfigured
    || (credentialFile.exists && credentialFile.mode !== null && (credentialFile.mode & 0o077) === 0);
  checks.firebaseAdmin = {
    status: exactlyOneAdminMode && adcSafe ? "PASS" : "FAIL",
    detail: {
      adcConfigured,
      adcFileExists: credentialFile.exists,
      adcModeRestricted: credentialFile.mode === null ? false : (credentialFile.mode & 0o077) === 0,
      exactlyOneCredentialMode: exactlyOneAdminMode,
      explicitCredentialPair: explicitAdmin,
    },
  };

  const ttl = Number(value("AUTH_SESSION_TTL_SECONDS"));
  checks.sessionCookie = {
    status: Number.isInteger(ttl) && ttl >= 300 && ttl <= 1_209_600
      && value("AUTH_SESSION_COOKIE_NAME") === undefined
      ? "PASS"
      : "FAIL",
    detail: {
      canonicalCookieName: SESSION_COOKIE_NAME,
      obsoleteCookieOverrideAbsent: value("AUTH_SESSION_COOKIE_NAME") === undefined,
      ttlExplicitAndBounded: Number.isInteger(ttl) && ttl >= 300 && ttl <= 1_209_600,
    },
  };

  const csrf = value("AUTH_CSRF_SECRET");
  const otherSecrets = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "CRON_SECRET",
    "DEEPSEEK_API_KEY",
    "SEPAY_API_TOKEN",
    "SEPAY_WEBHOOK_HMAC_SECRET",
    "SEPAY_MERCHANT_SECRET",
    "SEPAY_IPN_SECRET",
  ].flatMap((key) => value(key) === undefined ? [] : [value(key) as string]);
  checks.csrfSecret = {
    status: csrf !== undefined && Buffer.byteLength(csrf, "utf8") >= 32 && !otherSecrets.includes(csrf)
      ? "PASS"
      : "FAIL",
    detail: {
      dedicated: csrf !== undefined && !otherSecrets.includes(csrf),
      presentAndLongEnough: csrf !== undefined && Buffer.byteLength(csrf, "utf8") >= 32,
    },
  };

  let supabaseHostMatches = false;
  try {
    supabaseHostMatches = new URL(value("NEXT_PUBLIC_SUPABASE_URL") ?? "invalid:").hostname
      === `${target.supabaseProjectRef}.supabase.co`;
  } catch {
    supabaseHostMatches = false;
  }
  checks.supabaseTarget = {
    status: value("SUPABASE_PROJECT_REF") === target.supabaseProjectRef && supabaseHostMatches
      ? "PASS"
      : "FAIL",
    detail: {
      hostMatches: supabaseHostMatches,
      projectRefMatches: value("SUPABASE_PROJECT_REF") === target.supabaseProjectRef,
    },
  };

  const coreRuntimeKeys = [
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CRON_SECRET",
  ];
  const coreRuntimePresent = coreRuntimeKeys.filter((key) => value(key) !== undefined).length;
  checks.coreRuntime = {
    status: coreRuntimePresent === coreRuntimeKeys.length ? "PASS" : "FAIL",
    detail: { present: coreRuntimePresent, required: coreRuntimeKeys.length },
  };

  let mediaUrlHttps = false;
  try {
    mediaUrlHttps = new URL(value("NEXT_PUBLIC_MEDIA_URL") ?? "invalid:").protocol === "https:";
  } catch {
    mediaUrlHttps = false;
  }
  checks.catalogMedia = {
    status: mediaUrlHttps ? "PASS" : "FAIL",
    detail: { publicMediaHttps: mediaUrlHttps },
  };

  checks.accountRuntime = {
    status: isTrue("ACCOUNT_CENTER_ENABLED") ? "PASS" : "BLOCKED_CONFIG",
    detail: { enabled: isTrue("ACCOUNT_CENTER_ENABLED") },
  };

  const obsolete = [
    "AUTH_PUBLIC_ORIGIN",
    "FIREBASE_SUPABASE_TRUST_ENABLED",
    "AUTH_SESSION_COOKIE_NAME",
    "AUTH_FIREBASE_ROLLOUT_PERCENT",
    "AUTH_LEGACY_LOGIN_ENABLED",
  ].filter((key) => value(key) !== undefined);
  checks.obsoleteVariables = {
    status: obsolete.length === 0 ? "PASS" : "FAIL",
    detail: { absent: obsolete.length === 0, count: obsolete.length },
  };

  checks.exclusions = {
    status: isOff("VISION_PROVIDER")
      && !isTrue("VISION_UPLOAD_ENABLED")
      && !isTrue("ROOM_ANALYSIS_ENABLED")
      && !isTrue("VISUAL_SIMILARITY_ENABLED")
      && !isTrue("VISION_EVALUATION_STORAGE_ENABLED")
      && !isTrue("AMIS_WRITES_ENABLED")
      && value("KAKAO_APP_ID") === undefined
      && value("KAKAO_ADMIN_KEY") === undefined
      && value("KAKAO_REST_API_KEY") === undefined
      && value("KAKAO_CLIENT_SECRET") === undefined
      ? "PASS"
      : "FAIL",
    detail: {
      amisWritesOff: !isTrue("AMIS_WRITES_ENABLED"),
      kakaoOff: [
        "KAKAO_APP_ID",
        "KAKAO_ADMIN_KEY",
        "KAKAO_REST_API_KEY",
        "KAKAO_CLIENT_SECRET",
      ].every((key) => value(key) === undefined),
      visionOff: isOff("VISION_PROVIDER")
        && !isTrue("VISION_UPLOAD_ENABLED")
        && !isTrue("ROOM_ANALYSIS_ENABLED")
        && !isTrue("VISUAL_SIMILARITY_ENABLED")
        && !isTrue("VISION_EVALUATION_STORAGE_ENABLED"),
    },
  };

  const deepseekBaseMatches = value("DEEPSEEK_BASE_URL") === target.deepseekBaseUrl;
  const deepseekModelSupported = ["deepseek-v4-flash", "deepseek-v4-pro"]
    .includes(value("DEEPSEEK_MODEL") ?? "");
  const deepseekComplete = isTrue("CHAT_ENABLED")
    && ["DEEPSEEK_API_KEY", "DEEPSEEK_MODEL", "DEEPSEEK_BASE_URL", "PROMPT_VERSION"]
      .every((key) => value(key) !== undefined)
    && deepseekBaseMatches
    && deepseekModelSupported;
  checks.deepseekConfig = {
    status: deepseekComplete ? "PASS" : "BLOCKED_CONFIG",
    detail: {
      baseUrlCanonical: deepseekBaseMatches,
      chatEnabled: isTrue("CHAT_ENABLED"),
      complete: deepseekComplete,
      modelSupported: deepseekModelSupported,
    },
  };

  let sepaySandboxHost = false;
  try {
    sepaySandboxHost = new URL(value("SEPAY_API_BASE_URL") ?? "invalid:").hostname
      === target.sepayApiHost;
  } catch {
    sepaySandboxHost = false;
  }
  const sepayHmac = value("SEPAY_WEBHOOK_HMAC_SECRET");
  const sepayComplete = value("PAYMENT_MODE") === "sepay_sandbox"
    && value("SEPAY_ENV") === "sandbox"
    && ["SEPAY_API_BASE_URL", "SEPAY_API_TOKEN", "SEPAY_WEBHOOK_HMAC_SECRET", "SEPAY_PAYMENT_METHOD"]
      .every((key) => value(key) !== undefined);
  const sepaySandboxSafe = sepayComplete
    && sepaySandboxHost
    && sepayHmac !== undefined
    && Buffer.byteLength(sepayHmac, "utf8") >= 32;
  checks.sepayConfig = {
    status: sepaySandboxSafe ? "PASS" : "BLOCKED_CONFIG",
    detail: {
      complete: sepayComplete,
      hmacLongEnough: sepayHmac !== undefined && Buffer.byteLength(sepayHmac, "utf8") >= 32,
      sandboxHost: sepaySandboxHost,
      sandboxOnly: sepaySandboxSafe,
    },
  };

  checks.antigravityFixtures = {
    status: ["AUTH_EMAIL_VERIFIED", "AUTH_PHONE_TEST", "AUTH_GOOGLE_TEST"]
      .every((key) => value(key) !== undefined)
      ? "PASS"
      : "BLOCKED_CONFIG",
    detail: {
      aliasesPresent: ["AUTH_EMAIL_VERIFIED", "AUTH_PHONE_TEST", "AUTH_GOOGLE_TEST"]
        .filter((key) => value(key) !== undefined).length,
    },
  };

  return checks;
}

async function credentialState(environment: Readonly<Record<string, string | undefined>>) {
  const path = environment.GOOGLE_APPLICATION_CREDENTIALS;
  if (path === undefined || path.trim() === "") return { exists: false, mode: null };
  try {
    await access(path, fsConstants.R_OK);
    const metadata = await stat(path);
    return { exists: metadata.isFile(), mode: metadata.mode & 0o777 };
  } catch {
    return { exists: false, mode: null };
  }
}

async function safeFetch(url: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    return await fetch(url, {
      ...init,
      redirect: init.redirect ?? "manual",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return null;
  }
}

async function runtimeChecks(
  environment: Readonly<Record<string, string | undefined>>,
  root: string,
): Promise<DoctorChecks> {
  const checks: DoctorChecks = {};
  const origin = environment.NEXT_PUBLIC_APP_ORIGIN;
  const supabaseUrl = environment.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY;

  const originResponse = origin === undefined ? null : await safeFetch(origin);
  checks.originTls = {
    status: originResponse !== null && originResponse.status >= 200 && originResponse.status < 400
      ? "PASS"
      : "FAIL",
    detail: { reachable: originResponse !== null, status: originResponse?.status ?? null },
  };

  const helperResponse = origin === undefined
    ? null
    : await safeFetch(`${origin}/__/auth/handler?doctor=1`);
  const helperLocation = helperResponse?.headers.get("location") ?? "";
  const localizedRedirect = /^\/(?:vi|en|ko)(?:\/|$)/.test(helperLocation);
  checks.authHelperProxy = {
    status: helperResponse !== null && !localizedRedirect && helperResponse.status !== 404
      ? "PASS"
      : "FAIL",
    detail: {
      localizedRedirect,
      reachable: helperResponse !== null,
      status: helperResponse?.status ?? null,
    },
  };

  const firebaseEvidence = await readJsonIfPresent(resolve(
    root,
    ".agents/evidence/firebase-staging-config.json",
  ));
  checks.googleProvider = evidenceBoolean(firebaseEvidence, "googleProviderEnabled");
  checks.phoneProvider = evidenceBoolean(firebaseEvidence, "phoneProviderEnabled");
  checks.smsRegion = evidenceBoolean(firebaseEvidence, "smsRegionPolicyVerified");
  checks.authorizedDomain = evidenceBoolean(firebaseEvidence, "stagingDomainAuthorized");

  if (supabaseUrl === undefined || publishableKey === undefined || serviceRoleKey === undefined) {
    for (const name of ["accountMapping", "catalogManifest", "chatCatalogRpc"]) {
      checks[name] = { status: "BLOCKED_CONFIG", detail: { supabaseConfigPresent: false } };
    }
  } else {
    const publicHeaders = {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
      Prefer: "count=exact",
      Range: "0-0",
    };
    const serviceHeaders = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "count=exact",
      Range: "0-0",
    };
    const [products, variants, eligibility, accounts, principals, amisLinks] = await Promise.all([
      countResource(supabaseUrl, "products", publicHeaders),
      countResource(supabaseUrl, "variants", publicHeaders),
      countResource(supabaseUrl, "catalog_eligibility", serviceHeaders),
      countResource(supabaseUrl, "customer_accounts", serviceHeaders),
      countResource(supabaseUrl, "customer_firebase_principals", serviceHeaders),
      countResource(supabaseUrl, "customer_amis_links", serviceHeaders),
    ]);
    const accountObjectsPresent = [accounts, principals, amisLinks].every((entry) => entry.status < 400);
    checks.accountMapping = {
      status: accountObjectsPresent ? "PASS" : "FAIL",
      detail: {
        accountCount: accounts.count,
        accountObjectsPresent,
        principalCount: principals.count,
      },
    };

    const catalogEvidence = await readJsonIfPresent(resolve(
      root,
      ".agents/evidence/staging-catalog-manifest.json",
    ));
    const manifestVerified = catalogEvidence !== null
      && catalogEvidence.verified === true
      && typeof catalogEvidence.productCount === "number"
      && catalogEvidence.productCount === products.count
      && typeof catalogEvidence.variantCount === "number"
      && catalogEvidence.variantCount === variants.count;
    checks.catalogManifest = {
      status: eligibility.status < 400 && manifestVerified ? "PASS" : "FAIL",
      detail: {
        eligibilityAvailable: eligibility.status < 400,
        manifestVerified,
        productCount: products.count,
        variantCount: variants.count,
      },
    };

    const chatRpc = await safeFetch(`${supabaseUrl}/rest/v1/rpc/search_public_chat_catalog`, {
      body: JSON.stringify({ result_limit: 1, search_query: "sofa" }),
      headers: { ...publicHeaders, "Content-Type": "application/json" },
      method: "POST",
    });
    checks.chatCatalogRpc = {
      status: chatRpc?.ok ? "PASS" : "FAIL",
      detail: { status: chatRpc?.status ?? null },
    };
  }

  checks.supabaseLedger = await migrationLedgerCheck(root);

  if (environment.CHAT_ENABLED === "true"
    && environment.DEEPSEEK_API_KEY
    && environment.DEEPSEEK_BASE_URL) {
    const deepseek = await safeFetch(`${environment.DEEPSEEK_BASE_URL.replace(/\/+$/, "")}/models`, {
      headers: { Authorization: `Bearer ${environment.DEEPSEEK_API_KEY}` },
    });
    checks.deepseek = {
      status: deepseek?.ok ? "PASS" : "FAIL",
      detail: { status: deepseek?.status ?? null },
    };
  } else {
    checks.deepseek = { status: "BLOCKED_CONFIG", detail: { configured: false } };
  }

  return checks;
}

async function countResource(
  baseUrl: string,
  resource: string,
  headers: Readonly<Record<string, string>>,
): Promise<Readonly<{ count: number; status: number }>> {
  const response = await safeFetch(`${baseUrl}/rest/v1/${resource}?select=*&limit=1`, { headers });
  const count = Number(response?.headers.get("content-range")?.split("/")[1]);
  return { count: Number.isSafeInteger(count) ? count : 0, status: response?.status ?? 0 };
}

function evidenceBoolean(
  evidence: Readonly<Record<string, unknown>> | null,
  key: string,
): DoctorCheck {
  return {
    status: evidence?.[key] === true ? "PASS" : "BLOCKED_CONFIG",
    detail: { verified: evidence?.[key] === true },
  };
}

async function readJsonIfPresent(path: string): Promise<Readonly<Record<string, unknown>> | null> {
  try {
    const payload: unknown = JSON.parse(await readFile(path, "utf8"));
    return typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? payload as Readonly<Record<string, unknown>>
      : null;
  } catch {
    return null;
  }
}

async function migrationLedgerCheck(root: string): Promise<DoctorCheck> {
  try {
    const { stdout } = await execFileAsync("supabase", ["migration", "list", "--linked"], {
      cwd: root,
      timeout: 30_000,
    });
    const jsonLine = stdout.split(/\r?\n/).find((line) => line.trim().startsWith("{\"migrations\""));
    if (jsonLine === undefined) return { status: "FAIL", detail: { parsed: false } };
    const payload: unknown = JSON.parse(jsonLine);
    if (typeof payload !== "object" || payload === null || !("migrations" in payload)
      || !Array.isArray(payload.migrations)) {
      return { status: "FAIL", detail: { parsed: false } };
    }
    const rows = payload.migrations as readonly Readonly<{ local?: string; remote?: string }>[];
    const localOnly = rows.filter((row) => row.local && !row.remote).length;
    const remoteOnly = rows.filter((row) => !row.local && row.remote).length;
    return {
      status: localOnly === 0 && remoteOnly === 0 ? "PASS" : "FAIL",
      detail: { localOnly, parsed: true, remoteOnly },
    };
  } catch {
    return { status: "FAIL", detail: { parsed: false } };
  }
}

function parseArguments(argv: readonly string[]): Readonly<{ json: boolean; target: "staging" }> {
  const targetIndex = argv.indexOf("--target");
  const target = targetIndex >= 0 ? argv[targetIndex + 1] : undefined;
  if (target !== "staging") throw new Error("Only --target staging is allowed");
  return { json: argv.includes("--json"), target };
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  const root = process.cwd();
  const fileEnvironment = parseEnvFile(await readFile(resolve(root, ".env.local"), "utf8"));
  const environment = { ...fileEnvironment, ...process.env };
  const checks = {
    ...inspectStagingConfiguration(environment, await credentialState(environment)),
    ...await runtimeChecks(environment, root),
  };
  const ready = Object.values(checks).every((check) => check.status === "PASS");
  const report = {
    target: arguments_.target,
    ready,
    checks,
    summary: {
      blocked: Object.values(checks).filter((check) => check.status === "BLOCKED_CONFIG").length,
      failed: Object.values(checks).filter((check) => check.status === "FAIL").length,
      passed: Object.values(checks).filter((check) => check.status === "PASS").length,
      warnings: Object.values(checks).filter((check) => check.status === "WARN").length,
    },
  };
  process.stdout.write(`${JSON.stringify(report, null, arguments_.json ? 2 : 0)}\n`);
  process.exitCode = ready ? 0 : 1;
}

const invokedPath = process.argv[1] === undefined ? null : pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  main().catch(() => {
    process.stdout.write(`${JSON.stringify({
      target: "staging",
      ready: false,
      checks: { doctor: { status: "FAIL", detail: { unexpectedFailure: true } } },
    })}\n`);
    process.exitCode = 1;
  });
}
