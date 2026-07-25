import { z } from "zod";

const preferenceToggleSchema = z.boolean();

const amisHistorySchema = z.object({
  available: z.boolean(),
  enabled: z.boolean(),
}).strict();

export const accountPreferencesSchema = z.object({
  productPersonalizationEnabled: preferenceToggleSchema,
  browsingHistoryEnabled: preferenceToggleSchema,
  amisHistory: amisHistorySchema,
  recommendationDataState: z.enum(["available", "cleared"]),
}).strict();

const accountPreferencesPatchSchema = z.object({
  productPersonalizationEnabled: preferenceToggleSchema.optional(),
  browsingHistoryEnabled: preferenceToggleSchema.optional(),
}).strict().refine(
  (patch) => patch.productPersonalizationEnabled !== undefined || patch.browsingHistoryEnabled !== undefined,
);

const emptyActionBodySchema = z.object({}).strict();

export type AccountPreferences = z.infer<typeof accountPreferencesSchema>;
export type AccountPreferencesPatch = z.infer<typeof accountPreferencesPatchSchema>;

export function parseAccountPreferencesPatch(input: unknown): AccountPreferencesPatch | null {
  const result = accountPreferencesPatchSchema.safeParse(input);
  return result.success ? result.data : null;
}

export function parseAccountPreferencesResponse(input: unknown): AccountPreferences | null {
  const result = accountPreferencesSchema.safeParse(input);
  return result.success ? result.data : null;
}

export function isEmptyPreferencesActionBody(input: unknown): boolean {
  return emptyActionBodySchema.safeParse(input).success;
}
