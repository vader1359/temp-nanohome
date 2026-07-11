import { z } from "zod";

const remoteApplyErrorSchema = z.object({
  code: z.string().nullable().optional(),
  details: z.string().nullable().optional(),
  hint: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
}).passthrough();

const validationErrorSchema = z.object({
  issues: z.array(z.object({
    code: z.string(),
    message: z.string(),
    path: z.array(z.union([z.string(), z.number()])),
  })),
}).passthrough();

export function productionApplyErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error === null) {
    return "production apply rejected with null";
  }

  if (error === undefined) {
    return "production apply rejected with undefined";
  }

  if (typeof error === "string" || typeof error === "number" || typeof error === "boolean") {
    return `production apply rejected with ${String(error)}`;
  }

  const validationError = validationErrorSchema.safeParse(error);
  if (validationError.success) {
    return validationError.data.issues
      .map(({ code, message, path }) => `${code}:${path.join(".")}:${message}`)
      .join(" | ");
  }

  const parsed = remoteApplyErrorSchema.safeParse(error);
  if (!parsed.success) {
    return `unknown production apply error (${Object.prototype.toString.call(error)}; keys=${Object.getOwnPropertyNames(error).sort().join(",")})`;
  }

  const values = [parsed.data.code, parsed.data.message, parsed.data.details, parsed.data.hint]
    .filter((value): value is string => typeof value === "string" && value.trim() !== "");
  return values.length === 0
    ? `unknown production apply error (${Object.prototype.toString.call(error)}; keys=${Object.getOwnPropertyNames(error).sort().join(",")})`
    : values.join(" | ");
}
