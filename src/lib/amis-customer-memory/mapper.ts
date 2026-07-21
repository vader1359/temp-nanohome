import { z } from "zod";
import { customerMemorySchema } from "../contracts/schemas";
import type { CustomerMemory } from "../contracts/schemas";

const amisCustomerSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1).optional(),
  createdAt: z.string().datetime({ offset: true }).optional(),
  updatedAt: z.string().datetime({ offset: true }),
  roomIds: z.array(z.string().min(1)).optional(),
  brandIds: z.array(z.string().min(1)).optional(),
  projectStage: z.string().min(1).optional(),
  customerVisibleSummary: z.string().min(1).optional(),
}).passthrough();

const amisOrderLineSchema = z.object({
  sku: z.string().min(1),
  canonicalVariantId: z.string().min(1).optional(),
}).passthrough();

const amisOrderSchema = z.object({
  id: z.string().min(1),
  updatedAt: z.string().datetime({ offset: true }),
  lines: z.array(amisOrderLineSchema),
}).passthrough();

const amisMemoryInputSchema = z.object({
  linkId: z.string().min(1),
  customer: amisCustomerSchema,
  orders: z.array(amisOrderSchema),
}).strict();

export type AmisMemoryInput = z.input<typeof amisMemoryInputSchema>;

const latestTimestamp = (timestamps: readonly string[]): string => {
  const latest = timestamps.reduce((current, candidate) => candidate > current ? candidate : current);
  return latest;
};

export const mapAmisCustomerMemory = (input: AmisMemoryInput): CustomerMemory => {
  const parsed = amisMemoryInputSchema.parse(input);
  const sourceUpdatedAt = latestTimestamp([
    parsed.customer.updatedAt,
    ...parsed.orders.map((order) => order.updatedAt),
  ]);
  const purchasedVariantIds = parsed.orders.flatMap((order) => order.lines.flatMap((line) => line.canonicalVariantId ?? []));

  return customerMemorySchema.parse({
    linkId: parsed.linkId,
    ...(parsed.customer.type === undefined ? {} : { customerType: parsed.customer.type }),
    ...(parsed.customer.createdAt === undefined ? {} : { customerSinceBucket: parsed.customer.createdAt.slice(0, 4) }),
    preferredRoomIds: parsed.customer.roomIds ?? [],
    preferredBrandIds: parsed.customer.brandIds ?? [],
    discussedVariantIds: [],
    purchasedVariantIds,
    ...(parsed.customer.projectStage === undefined ? {} : { projectStage: parsed.customer.projectStage }),
    ...(parsed.customer.customerVisibleSummary === undefined ? {} : { customerVisibleSummary: parsed.customer.customerVisibleSummary }),
    sourceUpdatedAt,
  });
};
