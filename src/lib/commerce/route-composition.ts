import { createCommerceLocalServices, type CommerceCatalog, type CommerceOwner } from "./commerce-local";
import { createServerOwnedCommerceRoutes, type ServerOwnedCommerceRoutes } from "./server-owned-routes";

export type CommerceRouteComposition = Readonly<{ routes: ServerOwnedCommerceRoutes }>;

const emptyCatalog: CommerceCatalog = {
  async findVariant() {
    return null;
  },
};

export const createCommerceRouteComposition = (input: Readonly<{
  catalog?: CommerceCatalog;
  resolveOwner?: () => Promise<CommerceOwner | null>;
}> = {}): CommerceRouteComposition => ({
  routes: createServerOwnedCommerceRoutes({
    services: createCommerceLocalServices({ catalog: input.catalog ?? emptyCatalog }),
    resolveOwner: input.resolveOwner ?? (async () => null),
  }),
});
