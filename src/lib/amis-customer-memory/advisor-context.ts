import { z } from "zod";

import { customerMemorySchema } from "../contracts/schemas";

export const customerAdvisorContextSchema = customerMemorySchema.pick({
  preferredRoomIds: true,
  preferredBrandIds: true,
  discussedVariantIds: true,
  purchasedVariantIds: true,
  projectStage: true,
  customerVisibleSummary: true,
  sourceUpdatedAt: true,
}).strict();

export type CustomerAdvisorContext = Readonly<z.infer<typeof customerAdvisorContextSchema>>;

export function createCustomerAdvisorContext(input: unknown): CustomerAdvisorContext | null {
  const memory = customerMemorySchema.safeParse(input);
  if (!memory.success) return null;

  const {
    preferredRoomIds,
    preferredBrandIds,
    discussedVariantIds,
    purchasedVariantIds,
    projectStage,
    customerVisibleSummary,
    sourceUpdatedAt,
  } = memory.data;
  return customerAdvisorContextSchema.parse({
    preferredRoomIds,
    preferredBrandIds,
    discussedVariantIds,
    purchasedVariantIds,
    ...(projectStage === undefined ? {} : { projectStage }),
    ...(customerVisibleSummary === undefined ? {} : { customerVisibleSummary }),
    sourceUpdatedAt,
  });
}
