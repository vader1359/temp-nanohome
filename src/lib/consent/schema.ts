import { z } from "zod";

const purpose = z.boolean().optional();

export const consentRequestSchema = z.object({
  analytics: purpose,
  personalization: purpose,
  aiProcessing: purpose,
  aiConversationStorage: purpose,
  roomImageProcessing: purpose,
  roomImageStorage: purpose,
  marketing: purpose,
  version: z.string().min(1).max(32).optional(),
  locale: z.union([z.literal("vi"), z.literal("en"), z.literal("ko")]).optional(),
  source: z.string().regex(/^(banner|settings|privacy-center)$/).optional(),
  withdrawn: z.boolean().optional(),
  withdrawalReason: z.string().trim().min(1).optional(),
}).strict().superRefine((value, context) => {
  const hasWithdrawal = value.withdrawn !== undefined || value.withdrawalReason !== undefined;
  if (hasWithdrawal && (value.withdrawn !== true || value.withdrawalReason === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["withdrawn"], message: "Withdrawal requires withdrawn=true and a non-empty withdrawalReason" });
  }
});

export type ConsentRequest = Readonly<z.infer<typeof consentRequestSchema>>;
