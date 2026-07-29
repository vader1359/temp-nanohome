import { z } from "zod";

export const securityAuthActions = ["unlink_email", "unlink_google", "unlink_phone"] as const;

const securityIdentitySchema = z.object({
  maskedIdentifier: z.string().min(1),
  provider: z.enum(["email", "google", "phone"]),
  verified: z.literal(true),
}).strict();

export const accountSecuritySchema = z.object({
  identities: z.array(securityIdentitySchema),
  sessionCount: z.number().int().nonnegative(),
}).strict();

const securityActionResponseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("completed"), security: accountSecuritySchema }).strict(),
  z.object({ kind: z.literal("confirmation_mismatch") }).strict(),
  z.object({ kind: z.literal("deleted") }).strict(),
  z.object({ kind: z.literal("last_usable_method") }).strict(),
  z.object({ kind: z.literal("recent_authentication_required") }).strict(),
]);

const authActionSchema = z.object({
  action: z.enum(securityAuthActions),
}).strict();

const deletionConfirmationSchema = z.object({
  confirmation: z.literal("DELETE"),
}).strict();

const deletionBeginSchema = z.object({
  action: z.literal("begin"),
}).strict();

const emptySecurityActionBodySchema = z.object({}).strict();

export type AccountSecurity = z.infer<typeof accountSecuritySchema>;
export type SecurityAuthAction = z.infer<typeof authActionSchema>["action"];

export function parseAccountSecurity(input: unknown): AccountSecurity | null {
  const result = accountSecuritySchema.safeParse(input);
  return result.success ? result.data : null;
}

export function parseSecurityActionResponse(input: unknown): z.infer<typeof securityActionResponseSchema> | null {
  const result = securityActionResponseSchema.safeParse(input);
  return result.success ? result.data : null;
}

export function parseSecurityAuthAction(input: unknown): z.infer<typeof authActionSchema> | null {
  const result = authActionSchema.safeParse(input);
  return result.success ? result.data : null;
}

export function parseDeletionConfirmation(input: unknown): z.infer<typeof deletionConfirmationSchema> | null {
  const result = deletionConfirmationSchema.safeParse(input);
  return result.success ? result.data : null;
}

export function parseDeletionBegin(input: unknown): z.infer<typeof deletionBeginSchema> | null {
  const result = deletionBeginSchema.safeParse(input);
  return result.success ? result.data : null;
}

export function isEmptySecurityActionBody(input: unknown): boolean {
  return emptySecurityActionBodySchema.safeParse(input).success;
}
