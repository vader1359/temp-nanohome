import { z } from "zod";

const editableFieldNames = ["fullName", "dateOfBirth", "nationality", "formOfAddress", "locale"] as const;
const readOnlyFieldNames = ["primaryEmail", "primaryPhone", "identities"] as const;

export type EditableProfileField = (typeof editableFieldNames)[number];
export type ProfilePatch = Readonly<{
  readonly fullName?: string | null;
  readonly dateOfBirth?: string | null;
  readonly nationality?: string | null;
  readonly formOfAddress?: string | null;
  readonly locale?: string | null;
}>;

export type ProfilePatchResult =
  | Readonly<{ readonly ok: true; readonly value: ProfilePatch }>
  | Readonly<{
      readonly ok: false;
      readonly fieldErrors: Readonly<Record<string, string>>;
      readonly submitted: unknown;
    }>;

const profilePatchSchema = z
  .object({
    fullName: z.string().optional(),
    dateOfBirth: z.string().optional(),
    nationality: z.string().optional(),
    formOfAddress: z.string().optional(),
    locale: z.string().optional(),
  })
  .strict();

const profileFieldError = "Thông tin hồ sơ không hợp lệ.";
const readOnlyFieldError = "Trường này chỉ có thể thay đổi trong Bảo mật.";

function normalizeOptionalText(value: string): string | null {
  const normalized = value.normalize("NFC").trim();
  return normalized.length === 0 ? null : normalized;
}

function normalizeDate(value: string): string | null {
  const normalized = normalizeOptionalText(value);
  if (normalized === null) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const date = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized ? null : normalized;
}

function hasReadOnlyField(value: unknown, field: (typeof readOnlyFieldNames)[number]): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value) && field in value;
}

function getReadOnlyFieldErrors(value: unknown): Readonly<Record<string, string>> {
  return Object.fromEntries(
    readOnlyFieldNames.filter((field) => hasReadOnlyField(value, field)).map((field) => [field, readOnlyFieldError]),
  );
}

export function parseProfilePatch(input: unknown): ProfilePatchResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, fieldErrors: { profile: profileFieldError }, submitted: input };
  }

  const readOnlyErrors = getReadOnlyFieldErrors(input);
  if (Object.keys(readOnlyErrors).length > 0) {
    return { ok: false, fieldErrors: readOnlyErrors, submitted: input };
  }

  const parsed = profilePatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: { profile: profileFieldError }, submitted: input };
  }

  const value: { fullName?: string | null; dateOfBirth?: string | null; nationality?: string | null; formOfAddress?: string | null; locale?: string | null } = {};
  for (const field of editableFieldNames) {
    const fieldValue = parsed.data[field];
    if (fieldValue === undefined) {
      continue;
    }

    const normalized = field === "dateOfBirth" ? normalizeDate(fieldValue) : normalizeOptionalText(fieldValue);
    if (field === "dateOfBirth" && normalized === null && fieldValue.trim().length > 0) {
      return { ok: false, fieldErrors: { dateOfBirth: "Ngày sinh phải có dạng YYYY-MM-DD." }, submitted: input };
    }
    value[field] = normalized;
  }

  return { ok: true, value };
}
