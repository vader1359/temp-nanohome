import type { AccountId } from "@/lib/account-session";
import type { CustomerMemory, RecommendationResponse } from "@/lib/contracts";
import type { CustomerMemoryPort, RecommendationPort } from "@/lib/contracts";
import { resolvePersonalizationSettings } from "./settings";

const CONTEXT_VERSION = "personalization-local-v1";
const DEFAULT_MEMORY_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const CURATED_MODULES = ["featured-products", "editorial-default"] as const;

export type PersonalizationMode = "default" | "session" | "explicit" | "customer_memory" | "hybrid";

export type PreferenceFeature = {
  readonly key: string;
  readonly value: string;
  readonly labelKey: string;
};

export type RecentEntity = {
  readonly entityType: "product" | "variant" | "category" | "brand";
  readonly entityId: string;
};

export type PersonalizationContext = {
  readonly contextVersion: string;
  readonly mode: PersonalizationMode;
  readonly locale: string;
  readonly explicit: readonly PreferenceFeature[];
  readonly recent: readonly RecentEntity[];
  readonly customerMemory?: CustomerMemory;
  readonly roomSceneIds: readonly string[];
  readonly exclusions: readonly PreferenceFeature[];
  readonly explanationKeys: readonly string[];
};

export type PersonalizationInput = {
	readonly accountId: AccountId | null;
	readonly consent: { readonly personalization: boolean };
  readonly locale: string;
  readonly recent: readonly RecentEntity[];
  readonly explicit: readonly PreferenceFeature[];
  readonly now: string;
};

export type PersonalizationFlags = {
  readonly personalizationEnabled: boolean;
  readonly recentlyViewedEnabled: boolean;
  readonly explicitPreferencesEnabled: boolean;
  readonly customerMemoryEnabled: boolean;
};

export type PersonalizationResolver = {
  readonly resolve: (input: PersonalizationInput) => Promise<PersonalizationContext>;
};

export type PersonalizationDependencies = {
		readonly memoryPort: CustomerMemoryPort;
		readonly maxMemoryAgeMs?: number;
		readonly flags?: Partial<PersonalizationFlags>;
		readonly settings?: unknown;
	};

export function createPersonalizationResolver(dependencies: PersonalizationDependencies): PersonalizationResolver {
		const configuredFlags: PersonalizationFlags = {
			personalizationEnabled: false,
      recentlyViewedEnabled: false,
      explicitPreferencesEnabled: false,
      customerMemoryEnabled: false,
      ...dependencies.flags,
		};
		const settings = resolvePersonalizationSettings(dependencies.settings);
		const flags: PersonalizationFlags = {
			personalizationEnabled: configuredFlags.personalizationEnabled && settings.enabled,
      recentlyViewedEnabled: configuredFlags.recentlyViewedEnabled && settings.useBehaviorHistory,
      explicitPreferencesEnabled: configuredFlags.explicitPreferencesEnabled && settings.useBehaviorHistory,
      customerMemoryEnabled: configuredFlags.customerMemoryEnabled && settings.useAmisHistory,
		};

		return {
		resolve: async (input) => {
			const personalizationAllowed = flags.personalizationEnabled && input.consent.personalization;
			const customerMemory = personalizationAllowed && flags.customerMemoryEnabled && input.accountId !== null
					? await loadFreshMemory(dependencies, input.accountId, input.now)
				: undefined;
			const explicit = personalizationAllowed && flags.explicitPreferencesEnabled ? input.explicit : [];
			const recent = personalizationAllowed && flags.recentlyViewedEnabled ? input.recent : [];
      const explanationKeys = [
        ...explicit.map((feature) => feature.labelKey),
        ...(recent.length > 0 ? ["recently_viewed"] : []),
        ...(customerMemory !== undefined ? ["customer_memory"] : []),
      ];
      const effectiveExplanations = explanationKeys.length > 0 ? explanationKeys : ["curated_default"];

      return {
        contextVersion: CONTEXT_VERSION,
        mode: resolveMode({ explicit, recent, customerMemory }),
        locale: input.locale,
        explicit,
        recent,
        ...(customerMemory === undefined ? {} : { customerMemory }),
        roomSceneIds: [],
        exclusions: explicit.filter((feature) => feature.key === "exclusion"),
        explanationKeys: effectiveExplanations,
      };
    },
  };
}

type ModeInput = {
  readonly explicit: readonly PreferenceFeature[];
  readonly recent: readonly RecentEntity[];
  readonly customerMemory: CustomerMemory | undefined;
};

function resolveMode(input: ModeInput): PersonalizationMode {
  if (input.explicit.length > 0 && input.customerMemory !== undefined) return "hybrid";
  if (input.explicit.length > 0) return "explicit";
  if (input.customerMemory !== undefined) return "customer_memory";
  if (input.recent.length > 0) return "session";
  return "default";
}

async function loadFreshMemory(
	dependencies: PersonalizationDependencies,
	accountId: AccountId,
	now: string,
): Promise<CustomerMemory | undefined> {
	try {
			const memory = await dependencies.memoryPort.getForAuthenticatedCustomer({ accountId, purpose: "personalization" });
		if (memory === null) return undefined;
		const age = Date.parse(now) - Date.parse(memory.sourceUpdatedAt);
    const maxAge = dependencies.maxMemoryAgeMs ?? DEFAULT_MEMORY_AGE_MS;
    return age >= 0 && age <= maxAge ? memory : undefined;
  } catch (error) {
    if (error instanceof Error) return undefined;
    throw error;
  }
}

export type ModulePlacement = "home" | "pdp";

export type ModuleSelectionInput = {
  readonly context: PersonalizationContext;
  readonly placement: ModulePlacement;
  readonly currentVariantId?: string;
  readonly locale?: string;
  readonly recommendationPort?: RecommendationPort;
};

export type ModuleSelection = {
  readonly source: "curated" | "recommendation";
  readonly moduleIds: readonly string[];
  readonly explanationKeys: readonly string[];
};

export async function selectPersonalizedModules(input: ModuleSelectionInput): Promise<ModuleSelection> {
  switch (input.placement) {
    case "home":
      return curatedSelection();
    case "pdp":
      return selectPdpModules(input);
    default:
      return assertNever(input.placement);
  }
}

async function selectPdpModules(input: ModuleSelectionInput): Promise<ModuleSelection> {
  if (input.currentVariantId === undefined || input.locale === undefined || input.recommendationPort === undefined) {
    return curatedSelection();
  }
  try {
    const response = await input.recommendationPort.recommend({
      placement: "pdp",
      contextVariantIds: [input.currentVariantId],
      locale: input.locale,
    });
    return recommendationSelection(response);
  } catch (error) {
    if (error instanceof Error) return curatedSelection();
    throw error;
  }
}

function recommendationSelection(response: RecommendationResponse): ModuleSelection {
  if (response.items.length === 0) return curatedSelection();
  return {
    source: "recommendation",
    moduleIds: response.items.map((item) => `pdp-related:${item.variantId}`),
    explanationKeys: response.items.map((item) => `recommendation_reason:${item.reasonCode}`),
  };
}

function curatedSelection(): ModuleSelection {
  return {
    source: "curated",
    moduleIds: CURATED_MODULES,
    explanationKeys: ["curated_default"],
  };
}

function assertNever(value: never): never {
  throw new Error(`Unsupported module placement: ${String(value)}`);
}
