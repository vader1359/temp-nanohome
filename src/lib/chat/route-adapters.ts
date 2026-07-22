import "server-only";

import { hasCurrentAiProcessingConsent } from "./consent-adapter";
import { createPublicCatalogAdapters } from "./catalog-adapter";
import type { PublicChatLocale } from "./contracts";
import { ApprovedSourceStore, type RetrievalLocale } from "./retrieval";
import type { PublicChatServerRegistries } from "./resolution";
import { getApprovedPublicSitePage } from "./site-page-adapter";
import type { PublicChatToolAdapters } from "./tools/public-tools";

export type ServerChatDependencies = Readonly<{
  readonly grounding: { readonly kind: "unavailable"; readonly reason: "catalog_adapter_not_configured" } | { readonly kind: "available" };
  readonly registries: PublicChatServerRegistries;
  readonly retrieval: ApprovedSourceStore;
  readonly authorizeAiProcessing: (request: Request) => Promise<boolean>;
  readonly rateLimit?: (request: Request) => Promise<boolean>;
  readonly tools: PublicChatToolAdapters;
}>;

export type ServerChatDependenciesProvider = (locale: PublicChatLocale) => ServerChatDependencies;

const unavailableTools: PublicChatToolAdapters = {
  catalog: {
    search: async () => [],
    details: async () => [],
    compare: async () => [],
  },
  site: { page: async () => null },
  handoff: { create: async ({ reasonCode }) => ({ id: "handoff-unavailable", reasonCode }) },
};

export function createServerChatDependencies(): ServerChatDependencies {
  return {
    grounding: { kind: "unavailable", reason: "catalog_adapter_not_configured" },
    registries: { products: [], sources: [], images: [] },
    retrieval: new ApprovedSourceStore(),
    authorizeAiProcessing: async () => false,
    tools: unavailableTools,
  };
}

export function createLiveServerChatDependencies(locale: PublicChatLocale): ServerChatDependencies {
  return {
    grounding: { kind: "available" },
    registries: { products: [], sources: [], images: [] },
    retrieval: new ApprovedSourceStore(),
    authorizeAiProcessing: hasCurrentAiProcessingConsent,
    tools: {
      catalog: createPublicCatalogAdapters(locale),
      site: { page: async (sectionKey, requestedLocale) => getApprovedPublicSitePage(sectionKey, requestedLocale) },
      handoff: {
        create: async () => {
          throw new Error("Staff handoff is not configured");
        },
      },
    },
  };
}

let serverChatDependenciesProvider: ServerChatDependenciesProvider =
  createLiveServerChatDependencies;

export function getServerChatDependencies(locale: PublicChatLocale = "vi"): ServerChatDependencies {
  return serverChatDependenciesProvider(locale);
}

export function setServerChatDependenciesProvider(provider: ServerChatDependenciesProvider): () => void {
  const previous = serverChatDependenciesProvider;
  serverChatDependenciesProvider = provider;
  return () => {
    serverChatDependenciesProvider = previous;
  };
}

export function retrieveServerEvidence(
  dependencies: ServerChatDependencies,
  question: string,
  locale: RetrievalLocale,
): readonly { readonly sourceId: string; readonly text: string; readonly canonicalUrl?: string }[] {
  return dependencies.retrieval.retrieve({ query: question, locale, maxResults: 8, maxTextChars: 2_000 });
}
