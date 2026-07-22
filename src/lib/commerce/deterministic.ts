export type DeterministicIdOptions = Readonly<{
  now: Date;
  seed: string;
}>;

export type DeterministicIds = Readonly<{
  orderId: () => string;
  zalopayAppTransId: () => string;
  refundId: () => string;
}>;

const twoDigits = (value: number): string => value.toString().padStart(2, "0");

export const createDeterministicIds = ({ now, seed }: DeterministicIdOptions): DeterministicIds => {
  let sequence = 0;
  const nextSequence = (): number => {
    sequence += 1;
    return sequence;
  };
  const date = `${twoDigits(now.getUTCFullYear() % 100)}${twoDigits(now.getUTCMonth() + 1)}${twoDigits(now.getUTCDate())}`;

  return {
    orderId: () => `WEB-${seed}-${nextSequence()}`,
    zalopayAppTransId: () => `${date}-${seed}-${nextSequence()}`,
    refundId: () => `REF-${seed}-${nextSequence()}`,
  };
};
