import "server-only";

import { z } from "zod";
import { env } from "@/lib/env";
import { supabaseReadOnlyFetch } from "@/lib/remote-read-only";
import type { PreferenceFeature, RecentEntity } from "./index";

const bindingRowsSchema = z.array(z.object({
  user_id: z.string().uuid().nullable(),
  identity_kind: z.enum(["anonymous", "authenticated"]),
}).strip());

const preferenceRowsSchema = z.array(z.object({
  feature_type: z.string().min(1),
  feature_key: z.string().min(1),
  feature_value: z.string().min(1),
}).strip());

const recentRowsSchema = z.array(z.object({
  entity_type: z.enum(["product", "variant", "category", "brand"]),
  entity_id: z.string().uuid(),
}).strip());

export type Plan07CustomerFeatures = {
  readonly preferences: readonly PreferenceFeature[];
  readonly recent: readonly RecentEntity[];
};

type LoadPlan07CustomerFeaturesOptions = {
  readonly userId: string;
  readonly visitorId: string;
  readonly baseUrl?: string;
  readonly serviceRoleKey?: string;
  readonly fetcher?: typeof fetch;
};

const emptyFeatures = (): Plan07CustomerFeatures => ({ preferences: [], recent: [] });

export async function loadPlan07CustomerFeatures(
  options: LoadPlan07CustomerFeaturesOptions,
): Promise<Plan07CustomerFeatures> {
  const baseUrl = options.baseUrl ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = options.serviceRoleKey ?? env.SUPABASE_SERVICE_ROLE_KEY;
  const fetcher = options.fetcher ?? supabaseReadOnlyFetch;
  const headers = {
    Accept: "application/json",
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };

  try {
    const bindingUrl = restUrl(baseUrl, "customer_identity_ledger", {
      select: "user_id,identity_kind",
      visitor_id: `eq.${options.visitorId}`,
      order: "recorded_at.desc",
      limit: "1",
    });
    const bindingResponse = await fetcher(bindingUrl, { cache: "no-store", headers });
    if (!bindingResponse.ok) return emptyFeatures();
    const bindings = bindingRowsSchema.safeParse(await bindingResponse.json());
    const binding = bindings.success ? bindings.data[0] : undefined;
    if (
      binding?.identity_kind !== "authenticated"
      || binding.user_id !== options.userId
    ) {
      return emptyFeatures();
    }

    const preferenceUrl = restUrl(baseUrl, "customer_preferences_active", {
      select: "feature_type,feature_key,feature_value",
      visitor_id: `eq.${options.visitorId}`,
      order: "updated_at.desc",
      limit: "20",
    });
    const recentUrl = restUrl(baseUrl, "customer_recent_entities_active", {
      select: "entity_type,entity_id",
      visitor_id: `eq.${options.visitorId}`,
      order: "last_interacted_at.desc",
      limit: "12",
    });
    const [preferenceResponse, recentResponse] = await Promise.all([
      fetcher(preferenceUrl, { cache: "no-store", headers }),
      fetcher(recentUrl, { cache: "no-store", headers }),
    ]);
    if (!preferenceResponse.ok || !recentResponse.ok) return emptyFeatures();

    const preferences = preferenceRowsSchema.safeParse(await preferenceResponse.json());
    const recent = recentRowsSchema.safeParse(await recentResponse.json());
    if (!preferences.success || !recent.success) return emptyFeatures();

    return {
      preferences: preferences.data.map((row) => ({
        key: row.feature_key,
        value: row.feature_value,
        labelKey: row.feature_type,
      })),
      recent: recent.data.map((row) => ({
        entityType: row.entity_type,
        entityId: row.entity_id,
      })),
    };
  } catch {
    return emptyFeatures();
  }
}

function restUrl(
  baseUrl: string,
  table: string,
  params: Readonly<Record<string, string>>,
): URL {
  const url = new URL(`/rest/v1/${table}`, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}
