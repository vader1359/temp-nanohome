import type { CommerceOrderSnapshot } from "./domain";

export type CommerceOrderRepository = Readonly<{
  getById: (orderId: string) => Promise<CommerceOrderSnapshot | null>;
  save: (snapshot: CommerceOrderSnapshot) => Promise<CommerceOrderSnapshot>;
}>;
