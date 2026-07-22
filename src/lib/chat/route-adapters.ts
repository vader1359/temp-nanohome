import "server-only";

import { ApprovedSourceStore, type RetrievalLocale } from "./retrieval";
import type { PublicChatServerRegistries } from "./resolution";
import type { PublicChatToolAdapters } from "./tools/public-tools";

export type ServerChatDependencies = Readonly<{
  readonly grounding: { readonly kind: "unavailable"; readonly reason: "catalog_adapter_not_configured" } | { readonly kind: "available" };
  readonly registries: PublicChatServerRegistries;
  readonly retrieval: ApprovedSourceStore;
  readonly tools: PublicChatToolAdapters;
}>;

export type ServerChatDependenciesProvider = () => ServerChatDependencies;

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
    tools: unavailableTools,
  };
}

let serverChatDependenciesProvider: ServerChatDependenciesProvider = createServerChatDependencies;

export function getServerChatDependencies(): ServerChatDependencies {
  return serverChatDependenciesProvider();
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
