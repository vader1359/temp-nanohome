import { assessAmisStock, type StockReadResult } from "./amis-reader";
import type { RawSku, WarehouseId } from "./domain";
import type {
  InventoryClock,
  InventoryHold,
  InventoryHoldRepository,
} from "./inventory-repository";

const HOLD_DURATION_MS = 10 * 60 * 1_000;
const ASSESSMENT_MAX_AGE_MS = HOLD_DURATION_MS;

export type InventoryHoldRequest = Readonly<{
  holdId: string;
  ledger: StockReadResult;
  sku: RawSku;
  warehouseId: WarehouseId;
  quantity: number;
}>;

export type InventoryHoldResult =
  | Readonly<{ kind: "created"; hold: InventoryHold }>
  | Readonly<{ kind: "rejected"; reason: "missing" | "duplicate" | "stale" | "insufficient" | "invalid_request" | "conflict" }>;

export type InventoryHoldLifecycleResult =
  | Readonly<{ kind: "released" }>
  | Readonly<{ kind: "expired" }>
  | Readonly<{ kind: "already_inactive" }>
  | Readonly<{ kind: "not_expired" }>;

export type InventoryHoldOrchestrator = Readonly<{
  create: (input: InventoryHoldRequest) => Promise<InventoryHoldResult>;
  release: (holdId: string) => Promise<InventoryHoldLifecycleResult>;
  expire: (holdId: string) => Promise<InventoryHoldLifecycleResult>;
}>;

export function createInventoryHoldOrchestrator(input: Readonly<{
  repository: InventoryHoldRepository;
  clock: InventoryClock;
}>): InventoryHoldOrchestrator {
  const create = async (request: InventoryHoldRequest): Promise<InventoryHoldResult> => {
    const now = input.clock.now();
    const assessment = await assessAmisStock({
      ledger: request.ledger,
      requested: { sku: request.sku, warehouseId: request.warehouseId, warehouseName: "", quantity: request.quantity },
      now,
      maxAgeMs: ASSESSMENT_MAX_AGE_MS,
    });
    if (assessment.kind === "unavailable") return { kind: "rejected", reason: assessment.reason };
    const hold: InventoryHold = {
      holdId: request.holdId,
      sku: request.sku,
      warehouseId: request.warehouseId,
      quantity: request.quantity,
      expiresAt: new Date(Date.parse(now) + HOLD_DURATION_MS).toISOString(),
    };
    const persisted = await input.repository.create({ hold, observedStock: assessment.observed, now });
    switch (persisted.kind) {
      case "created": return persisted;
      case "conflict": return { kind: "rejected", reason: "conflict" };
      case "insufficient": return { kind: "rejected", reason: "insufficient" };
      default: return assertNever(persisted);
    }
  };
  const release = async (holdId: string): Promise<InventoryHoldLifecycleResult> => {
    const result = await input.repository.release(holdId, input.clock.now());
    return result === "released" ? { kind: "released" } : { kind: "already_inactive" };
  };
  const expire = async (holdId: string): Promise<InventoryHoldLifecycleResult> => {
    const result = await input.repository.expire(holdId, input.clock.now());
    switch (result) {
      case "expired": return { kind: "expired" };
      case "already_inactive": return { kind: "already_inactive" };
      case "not_expired": return { kind: "not_expired" };
      default: return assertNever(result);
    }
  };
  return { create, release, expire };
}

function assertNever(value: never): never {
  throw new Error(`Unexpected inventory result: ${String(value)}`);
}
