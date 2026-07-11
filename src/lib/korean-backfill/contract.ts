import { z } from "zod";

const sourceValueSchema = z.union([z.string(), z.array(z.string()).min(1)]);

const sourceSchema = z
  .object({
    vi: sourceValueSchema.optional(),
    en: sourceValueSchema.optional(),
  })
  .strict();

const textTargetSchema = z.union([
  z.object({ table: z.literal("brands"), column: z.union([z.literal("description_ko"), z.literal("origin_ko")]) }),
  z.object({ table: z.literal("catalogs"), column: z.literal("origin_ko") }),
  z.object({ table: z.literal("categories"), column: z.literal("name_ko") }),
  z.object({ table: z.literal("news"), column: z.literal("title_ko") }),
  z.object({ table: z.literal("products"), column: z.union([z.literal("name_ko"), z.literal("slug_ko"), z.literal("description_ko")]) }),
  z.object({ table: z.literal("variants"), column: z.union([
    z.literal("name_ko"), z.literal("short_name_ko"), z.literal("slug_ko"), z.literal("description_ko"),
    z.literal("meta_title_ko"), z.literal("meta_description_ko"), z.literal("finish_ko"),
    z.literal("designer_description_ko"), z.literal("brand_origin_ko"), z.literal("cldr_media_closeup_alt_ko"),
    z.literal("cldr_media_lifestyle_1_alt_ko"), z.literal("cldr_media_lifestyle_2_alt_ko"),
    z.literal("cldr_media_long_alt_ko"), z.literal("cldr_packshot_alt_ko"),
  ]) }),
]);

const arrayTargetSchema = z.object({ table: z.literal("variants"), column: z.literal("filter_room_ko") });

const inputSchema = z
  .object({
    id: z.string().trim().min(1),
    source: sourceSchema,
  })
  .and(z.union([textTargetSchema, arrayTargetSchema]));

type Target = Readonly<{
  table: z.infer<typeof inputSchema>["table"];
  column: z.infer<typeof inputSchema>["column"];
}>;
type SourceValue = z.infer<typeof sourceValueSchema>;

export type KoreanBackfillInput = Readonly<{
  id: string;
  target: Target;
  source: Readonly<{ language: "vi" | "en"; value: string | readonly string[] }>;
}>;

function normalizeValue(value: SourceValue): string | readonly string[] | undefined {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized === "" ? undefined : normalized;
  }

  const normalized = value.map((entry) => entry.trim()).filter((entry) => entry !== "");
  return normalized.length === 0 ? undefined : normalized;
}

function selectSource(source: z.infer<typeof sourceSchema>): KoreanBackfillInput["source"] {
  const vietnamese = source.vi === undefined ? undefined : normalizeValue(source.vi);
  if (vietnamese !== undefined) {
    return { language: "vi", value: vietnamese };
  }

  const english = source.en === undefined ? undefined : normalizeValue(source.en);
  if (english !== undefined) {
    return { language: "en", value: english };
  }

  throw new Error("source must include non-empty Vietnamese or English text");
}

export function parseKoreanBackfillInput(value: unknown): KoreanBackfillInput {
  const candidate = inputSchema.safeParse(value);
  if (!candidate.success) {
    throw new Error("record must use an approved Korean translation target");
  }
  const parsed = candidate.data;
  const source = selectSource(parsed.source);

  if (parsed.table === "variants" && parsed.column === "filter_room_ko") {
    if (!Array.isArray(source.value)) {
      throw new Error("filter_room_ko requires an array source");
    }
  } else if (Array.isArray(source.value)) {
    throw new Error("text targets require a string source");
  }

  return {
    id: parsed.id,
    target: { table: parsed.table, column: parsed.column },
    source,
  };
}

export function translationKind(input: KoreanBackfillInput): "text" | "array" {
  return input.target.column === "filter_room_ko" ? "array" : "text";
}
