import { z } from "zod";

const rawSkuSchema = z.string().min(1).refine((value) => value.trim().length > 0).brand<"RawSku">();
const warehouseIdSchema = z.string().min(1).refine((value) => value.trim().length > 0).brand<"WarehouseId">();

export type RawSku = z.infer<typeof rawSkuSchema>;

export const parseRawSku = (value: string): RawSku => rawSkuSchema.parse(value);

export type WarehouseId = z.infer<typeof warehouseIdSchema>;

export const parseWarehouseId = (value: string): WarehouseId => warehouseIdSchema.parse(value);

export type OrderState =
  | "created"
  | "processing"
  | "awaiting_staff_confirmation"
  | "confirmed"
  | "fulfilled"
  | "cancelled"
  | "exception_review";

export type InventoryState =
  | "unchecked"
  | "checking"
  | "available"
  | "held_online"
  | "staff_confirmation_required"
  | "confirmed"
  | "unavailable"
  | "stale"
  | "failed"
  | "expired"
  | "released";

export type AmisExportState =
  | "not_started"
  | "pending"
  | "creating"
  | "exported_draft"
  | "ambiguous"
  | "rejected"
  | "manual_required"
  | "failed_retryable"
  | "failed_permanent";

export type PaymentState =
  | "not_required"
  | "requires_method"
  | "creating_payment_request"
  | "awaiting_customer"
  | "create_failed"
  | "ambiguous"
  | "paid"
  | "customer_left"
  | "expired"
  | "manual_review"
  | "refund_pending"
  | "refund_processing"
  | "refunded"
  | "refund_failed"
  | "manual_refund_required";

export type CommerceState = Readonly<{
  order: OrderState;
  inventory: InventoryState;
  amisExport: AmisExportState;
  payment: PaymentState;
}>;

export type CommerceOrderItem = Readonly<{
  sku: RawSku;
  quantity: number;
}>;

export type CommerceOrderSnapshot = Readonly<{
  orderId: string;
  warehouseId: WarehouseId;
  items: readonly CommerceOrderItem[];
  totalAmount: number;
  currency: string;
  state: CommerceState;
}>;

export type CommerceOrderSnapshotInput = CommerceOrderSnapshot;

export const createCommerceOrderSnapshot = (
  input: CommerceOrderSnapshotInput,
): CommerceOrderSnapshot => ({
  ...input,
  items: input.items.map((item) => ({ ...item })),
  state: { ...input.state },
});
