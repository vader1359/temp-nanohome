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
}).strip();

const amisOrderLineSchema = z.object({
  sku: z.string().min(1),
  canonicalVariantId: z.string().min(1).optional(),
}).strip();

const amisOrderSchema = z.object({
  id: z.string().min(1),
  updatedAt: z.string().datetime({ offset: true }),
  approvedStatus: z.string().min(1).nullable(),
  status: z.string().min(1).nullable(),
  isDeleted: z.boolean(),
  lines: z.array(amisOrderLineSchema),
}).strip();

const amisMemoryInputSchema = z.object({
  linkId: z.string().min(1),
  customer: amisCustomerSchema,
  orders: z.array(amisOrderSchema),
}).strict();

const latestTimestamp = (timestamps: readonly string[]): string => {
  const latest = timestamps.reduce((current, candidate) => candidate > current ? candidate : current);
  return latest;
};

export const mapAmisCustomerMemory = (input: unknown): CustomerMemory => {
  const parsed = amisMemoryInputSchema.parse(input);
  const sourceUpdatedAt = latestTimestamp([
    parsed.customer.updatedAt,
    ...parsed.orders.map((order) => order.updatedAt),
  ]);
  const purchasedVariantIds = parsed.orders
    .filter(isActiveApprovedOrder)
    .flatMap((order) => variantIds(order));
  const discussedVariantIds = parsed.orders
    .filter(isActiveInterestedOrder)
    .flatMap((order) => variantIds(order));

  return customerMemorySchema.parse({
    linkId: parsed.linkId,
    ...(parsed.customer.type === undefined ? {} : { customerType: parsed.customer.type }),
    ...(parsed.customer.createdAt === undefined ? {} : { customerSinceBucket: parsed.customer.createdAt.slice(0, 4) }),
    preferredRoomIds: parsed.customer.roomIds ?? [],
    preferredBrandIds: parsed.customer.brandIds ?? [],
    discussedVariantIds,
    purchasedVariantIds,
    ...(parsed.customer.projectStage === undefined ? {} : { projectStage: parsed.customer.projectStage }),
    ...(parsed.customer.customerVisibleSummary === undefined ? {} : { customerVisibleSummary: parsed.customer.customerVisibleSummary }),
    sourceUpdatedAt,
  });
};

type ParsedAmisOrder = z.output<typeof amisOrderSchema>;

function isActiveApprovedOrder(order: ParsedAmisOrder): boolean {
  return isActiveOrder(order) && order.approvedStatus === "Đã duyệt";
}

function isActiveInterestedOrder(order: ParsedAmisOrder): boolean {
  return isActiveOrder(order) && order.approvedStatus !== "Đã duyệt";
}

function isActiveOrder(order: ParsedAmisOrder): boolean {
  return !order.isDeleted && order.status?.toLocaleLowerCase("vi") !== "cancelled";
}

function variantIds(order: ParsedAmisOrder): readonly string[] {
  return order.lines.flatMap((line) => line.canonicalVariantId ?? []);
}
