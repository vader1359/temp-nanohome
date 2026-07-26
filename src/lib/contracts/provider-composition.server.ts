import "server-only";

import type { AccountSessionVerifier } from "@/lib/account-session";
import { createDisabledCustomerMemoryPort } from "@/lib/amis-customer-memory/customer-memory-port";
import { createDisabledPaymentGateway } from "@/lib/commerce/disabled-payment-gateway";
import { roomSceneFixture } from "./fixtures";
import type {
  CustomerMemoryPort,
  NotificationPort,
  PaymentGateway,
  RecommendationPort,
  VisionProvider,
} from "./ports";

export class ProviderConfigurationNotInstalledError extends Error {
  public readonly provider: string;

  public constructor(provider: string) {
    super(`Provider configuration is not installed: ${provider}`);
    this.name = "ProviderConfigurationNotInstalledError";
    this.provider = provider;
  }
}

const unreachable = (value: never): never => {
  throw new ProviderConfigurationNotInstalledError(`unsupported:${String(value)}`);
};

const disabledSessionVerifier: AccountSessionVerifier = {
  verify: async () => null,
};

type AuthMode = "supabase" | "firebase" | "disabled" | "fake" | "noop" | "off";

export const createAuthSessionProvider = (options: Readonly<{
  mode: AuthMode;
  loadFirebase: () => Promise<AccountSessionVerifier>;
}>): AccountSessionVerifier => {
  switch (options.mode) {
    case "supabase":
    case "disabled":
    case "fake":
    case "noop":
    case "off":
      return disabledSessionVerifier;
    case "firebase":
      return {
        verify: async (sessionCookie) => (await options.loadFirebase()).verify(sessionCookie),
      };
    default:
      return unreachable(options.mode);
  }
};

type PaymentMode = "off" | "sepay" | "disabled" | "fake" | "noop";

export const createPaymentProvider = (options: Readonly<{ mode: PaymentMode }>): PaymentGateway => {
  switch (options.mode) {
    case "off":
    case "disabled":
    case "fake":
    case "noop":
      return createDisabledPaymentGateway();
    case "sepay":
      throw new ProviderConfigurationNotInstalledError("payment:sepay");
    default:
      return unreachable(options.mode);
  }
};

type CustomerMemoryMode = "off" | "disabled" | "fake" | "noop" | "supabase";

export const createCustomerMemoryProvider = (options: Readonly<{
  mode: CustomerMemoryMode;
  loadSupabase: () => Promise<CustomerMemoryPort>;
}>): CustomerMemoryPort => {
  switch (options.mode) {
    case "off":
    case "disabled":
    case "fake":
    case "noop":
      return createDisabledCustomerMemoryPort();
    case "supabase":
      throw new ProviderConfigurationNotInstalledError("customer-memory:supabase");
    default:
      return unreachable(options.mode);
  }
};

type NotificationMode = "noop" | "active";

export const createNotificationProvider = (options: Readonly<{ mode: NotificationMode }>): NotificationPort => {
  switch (options.mode) {
    case "noop":
      return { notify: async () => ({ kind: "skipped" }) };
    case "active":
      throw new ProviderConfigurationNotInstalledError("notification:active");
    default:
      return unreachable(options.mode);
  }
};

type VisionMode = "off" | "fake" | "active";

class VisionDisabledError extends Error {
  public constructor() {
    super("Vision is disabled.");
    this.name = "VisionDisabledError";
  }
}

export const createVisionProvider = (options: Readonly<{ mode: VisionMode }>): VisionProvider => {
  switch (options.mode) {
    case "off":
      return { describeRoom: async () => Promise.reject(new VisionDisabledError()) };
    case "fake":
      return { describeRoom: async () => roomSceneFixture };
    case "active":
      throw new ProviderConfigurationNotInstalledError("vision:active");
    default:
      return unreachable(options.mode);
  }
};

type RecommendationMode = "shadow" | "active";

export const createRecommendationProvider = (options: Readonly<{ mode: RecommendationMode }>): RecommendationPort => {
  switch (options.mode) {
    case "shadow":
      return {
        recommend: async (request) => ({
          requestId: "shadow",
          algorithmVersion: "shadow-1",
          placement: request.placement,
          generatedAt: "1970-01-01T00:00:00.000Z",
          fallbackTier: "shadow",
          items: [],
        }),
      };
    case "active":
      throw new ProviderConfigurationNotInstalledError("recommendation:active");
    default:
      return unreachable(options.mode);
  }
};
