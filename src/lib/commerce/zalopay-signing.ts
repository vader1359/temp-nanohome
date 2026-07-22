import { createHmac, timingSafeEqual } from "node:crypto";

export type ZaloPaySigningInput = Readonly<{
  readonly key1: string;
  readonly appId: number;
  readonly appTransId: string;
  readonly appUser: string;
  readonly amount: number;
  readonly appTime: number;
  readonly embedData: string;
  readonly item: string;
  readonly zpTransId: string;
}>;

export type ZaloPaySignatures = Readonly<{
  readonly create: string;
  readonly query: string;
  readonly refund: string;
}>;

const sign = (key: string, input: string): string => createHmac("sha256", key).update(input).digest("hex");

export const buildZaloPaySignatures = (input: ZaloPaySigningInput): ZaloPaySignatures => ({
  create: sign(input.key1, [input.appId, input.appTransId, input.appUser, input.amount, input.appTime, input.embedData, input.item].join("|")),
  query: sign(input.key1, [input.appId, input.appTransId, input.key1].join("|")),
  refund: sign(input.key1, [input.appId, input.zpTransId, input.amount, input.key1].join("|")),
});

export type ZaloPayCallbackVerificationInput = Readonly<{
  readonly rawData: string;
  readonly mac: string;
  readonly key2: string;
}>;

export const verifyZaloPayCallback = ({ rawData, mac, key2 }: ZaloPayCallbackVerificationInput): boolean => {
  const expected = Buffer.from(sign(key2, rawData), "hex");
  const received = Buffer.from(mac, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
};
