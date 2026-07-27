import { z } from "zod";

const disabledSettings = {
  enabled: false,
  useAmisHistory: false,
  useBehaviorHistory: false,
  policyVersion: "plan03-disabled-v1",
} as const;

export const personalizationSettingsSchema = z.object({
  enabled: z.boolean(),
  useAmisHistory: z.boolean(),
  useBehaviorHistory: z.boolean(),
  policyVersion: z.string().min(1),
}).strict();

export type PersonalizationSettings = Readonly<z.infer<typeof personalizationSettingsSchema>>;

export function resolvePersonalizationSettings(input: unknown): PersonalizationSettings {
  const parsed = personalizationSettingsSchema.safeParse(input);
  return parsed.success ? parsed.data : disabledSettings;
}
