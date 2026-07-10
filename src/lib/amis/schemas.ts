import { z } from "zod";

export const numericValueSchema = z.union([z.number(), z.string()]).transform((value, context) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    context.addIssue({ code: "custom", message: "Expected a finite numeric value" });
    return z.NEVER;
  }
  return parsed;
});
