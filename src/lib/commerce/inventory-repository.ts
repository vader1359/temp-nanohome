import type { RawSku, WarehouseId } from "./domain";

export type InventoryClock = Readonly<{ now: () => string }>;

export type InventoryHold = Readonly<{
  holdId: string;
  sku: RawSku;
  warehouseId: WarehouseId;
  quantity: number;
  expiresAt: string;
}>;

export type InventoryHoldCreate = Readonly<{
  hold: InventoryHold;
  observedStock: number;
  now: string;
}>;

export type InventoryHoldCreateResult =
  | Readonly<{ kind: "created"; hold: InventoryHold }>
  | Readonly<{ kind: "conflict" }>
  | Readonly<{ kind: "insufficient" }>;

export type InventoryHoldRepository = Readonly<{
  create: (input: InventoryHoldCreate) => Promise<InventoryHoldCreateResult>;
  release: (holdId: string, now: string) => Promise<"released" | "already_inactive">;
  expire: (holdId: string, now: string) => Promise<"expired" | "already_inactive" | "not_expired">;
  activeQuantity: (input: Readonly<{ sku: RawSku; warehouseId: WarehouseId; now: string }>) => Promise<number>;
}>;

type StoredHold = InventoryHold & Readonly<{ state: "active" | "released" | "expired" }>;

export function createTestInventoryHoldRepository(): InventoryHoldRepository {
  const holds = new Map<string, StoredHold>();
  return {
    async create(input) {
      if (holds.has(input.hold.holdId)) return { kind: "conflict" };
      const active = [...holds.values()].filter((hold) => hold.state === "active"
        && hold.sku === input.hold.sku
        && hold.warehouseId === input.hold.warehouseId
        && Date.parse(hold.expiresAt) > Date.parse(input.now))
        .reduce((total, hold) => total + hold.quantity, 0);
      if (active + input.hold.quantity > input.observedStock) return { kind: "insufficient" };
      holds.set(input.hold.holdId, { ...input.hold, state: "active" });
      return { kind: "created", hold: input.hold };
    },
    async release(holdId) {
      const hold = holds.get(holdId);
      if (hold === undefined || hold.state !== "active") return "already_inactive";
      holds.set(holdId, { ...hold, state: "released" });
      return "released";
    },
    async expire(holdId, now) {
      const hold = holds.get(holdId);
      if (hold === undefined || hold.state !== "active") return "already_inactive";
      if (Date.parse(hold.expiresAt) > Date.parse(now)) return "not_expired";
      holds.set(holdId, { ...hold, state: "expired" });
      return "expired";
    },
    async activeQuantity(input) {
      return [...holds.values()].filter((hold) => hold.state === "active"
        && hold.sku === input.sku
        && hold.warehouseId === input.warehouseId
        && Date.parse(hold.expiresAt) > Date.parse(input.now))
        .reduce((total, hold) => total + hold.quantity, 0);
    },
  };
}
