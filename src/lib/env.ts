import { z } from "zod";

const optionalEnvString = z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional());
const optionalEnvUrl = z.preprocess((value) => value === "" ? undefined : value, z.string().url().optional());
const optionalHttpsUrl = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.string().url().refine((value) => value.startsWith("https://"), "URL must use HTTPS").optional(),
);
const envBoolean = (defaultValue: "true" | "false") => z.preprocess(
  (value) => value === "" ? undefined : value,
  z.enum(["true", "false"]).default(defaultValue).transform((value) => value === "true"),
);
const optionalInteger = (minimum: number, maximum: number) => z.preprocess(
  (value) => value === "" || value === undefined ? undefined : Number(value),
  z.number().int().min(minimum).max(maximum).optional(),
);

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_PROJECT_REF: z.string().regex(/^[a-z0-9-]+$/),
  NEXT_PUBLIC_CLARITY_ID: optionalEnvString,
  NEXT_PUBLIC_AXIOM_DATASET: optionalEnvString,
  NEXT_PUBLIC_AXIOM_TOKEN: optionalEnvString,
  NEXT_PUBLIC_MEDIA_URL: optionalEnvUrl,
  NEXT_PUBLIC_APP_ORIGIN: optionalHttpsUrl,
  NEXT_PUBLIC_FIREBASE_API_KEY: optionalEnvString,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: optionalEnvString,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: optionalEnvString,
  NEXT_PUBLIC_FIREBASE_APP_ID: optionalEnvString,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: optionalEnvString,
  NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY: optionalEnvString,
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL: optionalEnvUrl,
  NEXT_PUBLIC_FIREBASE_TENANT_ID: optionalEnvString,

  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  AUTH_CSRF_SECRET: z.string().min(32),

  AUTH_PROVIDER: z.enum(["supabase", "firebase", "disabled", "fake", "noop", "off"]).default("supabase"),
  PAYMENT_MODE: z.enum(["off", "sepay_sandbox", "sepay_primary"]).default("off"),
  CHAT_ENABLED: envBoolean("false"),

  DEEPSEEK_API_KEY: optionalEnvString,
  DEEPSEEK_MODEL: z.enum(["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"]).optional(),
  DEEPSEEK_BASE_URL: optionalHttpsUrl,
  PROMPT_VERSION: optionalEnvString,
  CHAT_HANDOFF_ENABLED: envBoolean("false"),
  ADVISOR_INBOX_ENABLED: envBoolean("false"),
  ADVISOR_NOTIFICATION_PROVIDER: z.enum(["noop", "fake", "off", "webhook"]).default("noop"),
  ADVISOR_NOTIFICATION_DESTINATION: optionalEnvString,
  ADVISOR_NOTIFICATION_API_KEY: optionalEnvString,

  VISION_PROVIDER: z.enum(["off", "fake", "noop", "primary"]).default("off"),
  VISION_MODEL: optionalEnvString,
  VISION_API_KEY: optionalEnvString,
  VISION_PRIVATE_BUCKET: optionalEnvString,
  VISION_UPLOAD_ENABLED: envBoolean("false"),
  ROOM_ANALYSIS_ENABLED: envBoolean("false"),
  VISUAL_SIMILARITY_ENABLED: envBoolean("false"),
  VISION_RETENTION_DAYS: optionalInteger(1, 3650),
  VISION_EVALUATION_STORAGE_ENABLED: envBoolean("false"),

  SEPAY_ENV: z.enum(["sandbox", "primary"]).optional(),
  SEPAY_API_BASE_URL: optionalHttpsUrl,
  SEPAY_API_TOKEN: optionalEnvString,
  SEPAY_WEBHOOK_HMAC_SECRET: optionalEnvString,
  SEPAY_TEST_BANK_ACCOUNT_ID: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().uuid().optional(),
  ),
  SEPAY_MERCHANT_ID: optionalEnvString,
  SEPAY_MERCHANT_SECRET: optionalEnvString,
  SEPAY_IPN_SECRET: optionalEnvString,
  SEPAY_PAYMENT_METHOD: z.literal("BANK_TRANSFER").optional(),
  SEPAY_SUCCESS_URL: optionalHttpsUrl,
  SEPAY_ERROR_URL: optionalHttpsUrl,
  SEPAY_CANCEL_URL: optionalHttpsUrl,
  SEPAY_RECONCILIATION_ENABLED: envBoolean("false"),

  AMIS_API_BASE_URL: optionalEnvUrl,
  AMIS_CLIENT_ID: optionalEnvString,
  AMIS_CLIENT_SECRET: optionalEnvString,
  AMIS_SYNC_ENABLED: envBoolean("false"),
  AMIS_WRITES_ENABLED: envBoolean("false"),
  AMIS_PERSONALIZATION_ENABLED: envBoolean("false"),
  AMIS_CUSTOMER_PILOT_ENABLED: envBoolean("false"),
  AMIS_CUSTOMER_PILOT_AUDIT_PATH: optionalEnvString,
  AMIS_CUSTOMER_PILOT_HMAC_SECRET: optionalEnvString,
  AMIS_CUSTOMER_PRECREATION_HMAC_SECRET: optionalEnvString,
  RECOMMENDATIONS_SHADOW_MODE: envBoolean("true"),

  ACCOUNT_CENTER_ENABLED: envBoolean("false"),
  FIREBASE_ADMIN_PROJECT_ID: optionalEnvString,
  FIREBASE_ADMIN_CLIENT_EMAIL: optionalEnvString,
  FIREBASE_ADMIN_PRIVATE_KEY: optionalEnvString,
  AUTH_SESSION_TTL_SECONDS: optionalInteger(300, 1_209_600),
  FIREBASE_AUTH_EMULATOR_HOST: optionalEnvString,
  GOOGLE_APPLICATION_CREDENTIALS: optionalEnvString,
  KAKAO_APP_ID: optionalEnvString,
  KAKAO_ADMIN_KEY: optionalEnvString,
  KAKAO_REST_API_KEY: optionalEnvString,
  KAKAO_CLIENT_SECRET: optionalEnvString,

  INSTAGRAM_ACCESS_TOKEN: optionalEnvString,
  INSTAGRAM_BUSINESS_ACCOUNT_ID: optionalEnvString,
  META_APP_ID: optionalEnvString,
  META_APP_SECRET: optionalEnvString,
  CLOUDINARY_URL: optionalEnvString,
  CF_R2_ACCESS_KEY_ID: optionalEnvString,
  CF_R2_SECRET_ACCESS_KEY: optionalEnvString,
  CF_R2_ENDPOINT: optionalEnvUrl,
  CF_R2_BUCKET: optionalEnvString,
  WISTIA_API_TOKEN: optionalEnvString,
}).passthrough().superRefine((value, context) => {
  for (const key of Object.keys(value)) {
    if (key.startsWith("NEXT_PUBLIC_SEPAY_") || key.startsWith("NEXT_PUBLIC_KAKAO_")) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${key} must remain server-only`, path: [key] });
    }
  }

  for (const key of ["AUTH_PUBLIC_ORIGIN", "FIREBASE_SUPABASE_TRUST_ENABLED", "AUTH_SESSION_COOKIE_NAME", "AUTH_FIREBASE_ROLLOUT_PERCENT", "AUTH_LEGACY_LOGIN_ENABLED"]) {
    if (value[key] !== undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${key} is obsolete and must be removed`, path: [key] });
    }
  }

  const supabaseUrl = new URL(value.NEXT_PUBLIC_SUPABASE_URL);
  const localSupabase = ["localhost", "127.0.0.1", "::1"].includes(supabaseUrl.hostname);
  if (!localSupabase && supabaseUrl.hostname !== `${value.SUPABASE_PROJECT_REF}.supabase.co`) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Supabase URL must match SUPABASE_PROJECT_REF",
      path: ["SUPABASE_PROJECT_REF"],
    });
  }

  if (value.AUTH_PROVIDER === "firebase") {
    const requiredPublic = [
      value.NEXT_PUBLIC_APP_ORIGIN, value.NEXT_PUBLIC_FIREBASE_API_KEY, value.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      value.NEXT_PUBLIC_FIREBASE_PROJECT_ID, value.NEXT_PUBLIC_FIREBASE_APP_ID, value.FIREBASE_ADMIN_PROJECT_ID,
      value.AUTH_SESSION_TTL_SECONDS,
    ];
    if (requiredPublic.some((entry) => entry === undefined)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Firebase auth requires public and admin Firebase configuration", path: ["AUTH_PROVIDER"] });
    }
    if (value.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== value.FIREBASE_ADMIN_PROJECT_ID) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Firebase public and admin project IDs must match", path: ["FIREBASE_ADMIN_PROJECT_ID"] });
    }
    if (
      value.NEXT_PUBLIC_APP_ORIGIN !== undefined
      && value.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN !== undefined
      && new URL(value.NEXT_PUBLIC_APP_ORIGIN).hostname !== value.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Firebase auth domain must match the application origin for same-origin auth helpers",
        path: ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"],
      });
    }
    const hasEmail = value.FIREBASE_ADMIN_CLIENT_EMAIL !== undefined;
    const hasPrivateKey = value.FIREBASE_ADMIN_PRIVATE_KEY !== undefined;
    const hasExplicit = hasEmail && hasPrivateKey;
    const hasAdcPath = value.GOOGLE_APPLICATION_CREDENTIALS !== undefined;
    if (hasEmail !== hasPrivateKey || hasExplicit === hasAdcPath) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Firebase auth requires exactly one Firebase Admin credential mode", path: ["FIREBASE_ADMIN_CLIENT_EMAIL"] });
    }
    const protectedSecrets = [
      value.SUPABASE_SERVICE_ROLE_KEY,
      value.CRON_SECRET,
      value.DEEPSEEK_API_KEY,
      value.SEPAY_API_TOKEN,
      value.SEPAY_WEBHOOK_HMAC_SECRET,
      value.SEPAY_MERCHANT_SECRET,
      value.SEPAY_IPN_SECRET,
    ].filter((entry): entry is string => entry !== undefined);
    if (protectedSecrets.includes(value.AUTH_CSRF_SECRET)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AUTH_CSRF_SECRET must be a dedicated secret",
        path: ["AUTH_CSRF_SECRET"],
      });
    }
  }
  if (value.ACCOUNT_CENTER_ENABLED && value.AUTH_PROVIDER !== "firebase") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Account Center requires Firebase authentication",
      path: ["ACCOUNT_CENTER_ENABLED"],
    });
  }

  if (value.PAYMENT_MODE === "sepay_sandbox") {
    const sandboxValues = [
      value.SEPAY_API_BASE_URL,
      value.SEPAY_API_TOKEN,
      value.SEPAY_WEBHOOK_HMAC_SECRET,
      value.SEPAY_TEST_BANK_ACCOUNT_ID,
      value.SEPAY_PAYMENT_METHOD,
      value.NEXT_PUBLIC_APP_ORIGIN,
    ];
    if (value.SEPAY_ENV !== "sandbox" || sandboxValues.some((entry) => entry === undefined)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "SePay Test Mode requires complete sandbox-only configuration", path: ["PAYMENT_MODE"] });
    }
    if (value.NEXT_PUBLIC_APP_ORIGIN !== "https://staging.nanohome.vn") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "SePay Test Mode must stay on the staging origin", path: ["NEXT_PUBLIC_APP_ORIGIN"] });
    }
    if (value.SEPAY_API_BASE_URL !== undefined
      && new URL(value.SEPAY_API_BASE_URL).hostname !== "userapi-sandbox.sepay.vn") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "SePay sandbox mode requires the sandbox API host", path: ["SEPAY_API_BASE_URL"] });
    }
  }
  if (value.PAYMENT_MODE === "sepay_primary") {
    const primaryValues = [
      value.SEPAY_MERCHANT_ID,
      value.SEPAY_MERCHANT_SECRET,
      value.SEPAY_IPN_SECRET,
      value.SEPAY_PAYMENT_METHOD,
      value.SEPAY_SUCCESS_URL,
      value.SEPAY_ERROR_URL,
      value.SEPAY_CANCEL_URL,
    ];
    if (value.SEPAY_ENV !== "primary" || primaryValues.some((entry) => entry === undefined)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "SePay primary mode requires complete primary configuration", path: ["PAYMENT_MODE"] });
    }
  }

  if (value.CHAT_ENABLED && [value.DEEPSEEK_API_KEY, value.DEEPSEEK_MODEL, value.DEEPSEEK_BASE_URL, value.PROMPT_VERSION].some((entry) => entry === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Chat requires complete DeepSeek configuration", path: ["CHAT_ENABLED"] });
  }
  if (value.ADVISOR_NOTIFICATION_PROVIDER === "webhook"
    && [value.ADVISOR_NOTIFICATION_DESTINATION, value.ADVISOR_NOTIFICATION_API_KEY].some((entry) => entry === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Advisor notification requires complete configuration", path: ["ADVISOR_NOTIFICATION_PROVIDER"] });
  }

  const visionFeatureEnabled = value.VISION_UPLOAD_ENABLED || value.ROOM_ANALYSIS_ENABLED
    || value.VISUAL_SIMILARITY_ENABLED || value.VISION_EVALUATION_STORAGE_ENABLED;
  if ((value.VISION_PROVIDER === "primary" || visionFeatureEnabled)
    && [value.VISION_MODEL, value.VISION_API_KEY, value.VISION_PRIVATE_BUCKET, value.VISION_RETENTION_DAYS].some((entry) => entry === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Vision activation requires complete configuration", path: ["VISION_PROVIDER"] });
  }

  const amisEnabled = value.AMIS_SYNC_ENABLED || value.AMIS_WRITES_ENABLED
    || value.AMIS_PERSONALIZATION_ENABLED || value.AMIS_CUSTOMER_PILOT_ENABLED;
  if (amisEnabled && [value.AMIS_API_BASE_URL, value.AMIS_CLIENT_ID, value.AMIS_CLIENT_SECRET].some((entry) => entry === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "AMIS activation requires complete configuration", path: ["AMIS_SYNC_ENABLED"] });
  }
  if (value.AMIS_CUSTOMER_PILOT_ENABLED) {
    const auditPath = value.AMIS_CUSTOMER_PILOT_AUDIT_PATH;
    const hmacSecret = value.AMIS_CUSTOMER_PILOT_HMAC_SECRET;
    if (
      value.AUTH_PROVIDER !== "firebase"
      || value.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== "temp-nanohome"
      || value.FIREBASE_ADMIN_PROJECT_ID !== "temp-nanohome"
      || value.AMIS_WRITES_ENABLED
      || auditPath === undefined
      || !auditPath.startsWith("/")
      || hmacSecret === undefined
      || Buffer.byteLength(hmacSecret, "utf8") < 32
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AMIS customer pilot requires temp-nanohome, read-only AMIS, absolute external audit path, and HMAC secret",
        path: ["AMIS_CUSTOMER_PILOT_ENABLED"],
      });
    }
  }
});

export const env = envSchema.parse(process.env);
type ParsedEnv = z.infer<typeof envSchema>;
type SchemaEnv = {
  [Key in keyof ParsedEnv as string extends Key ? never : number extends Key ? never : Key]: ParsedEnv[Key];
};
type DefaultedEnvKey =
  | "AUTH_PROVIDER" | "PAYMENT_MODE" | "CHAT_ENABLED" | "CHAT_HANDOFF_ENABLED" | "ADVISOR_INBOX_ENABLED"
  | "ADVISOR_NOTIFICATION_PROVIDER" | "VISION_PROVIDER" | "VISION_UPLOAD_ENABLED" | "ROOM_ANALYSIS_ENABLED"
  | "VISUAL_SIMILARITY_ENABLED" | "VISION_EVALUATION_STORAGE_ENABLED" | "SEPAY_RECONCILIATION_ENABLED"
  | "AMIS_SYNC_ENABLED" | "AMIS_WRITES_ENABLED" | "AMIS_PERSONALIZATION_ENABLED"
  | "AMIS_CUSTOMER_PILOT_ENABLED" | "RECOMMENDATIONS_SHADOW_MODE"
  | "ACCOUNT_CENTER_ENABLED";
export type Env = Omit<SchemaEnv, DefaultedEnvKey> & Partial<Pick<SchemaEnv, DefaultedEnvKey>>;
