export type KoreanBackfillTable =
  | "brands"
  | "catalogs"
  | "categories"
  | "news"
  | "products"
  | "variants";

type ScalarSource = string;
type ArraySource = readonly string[];
type SourceValue = ScalarSource | ArraySource;
type ExportColumn =
  | "description"
  | "description_ko"
  | "description_vi"
  | "origin"
  | "origin_ko"
  | "origin_vi"
  | "name"
  | "name_ko"
  | "name_vi"
  | "title"
  | "title_ko"
  | "title_vi"
  | "slug"
  | "slug_ko"
  | "slug_vi"
  | "short_name"
  | "short_name_ko"
  | "short_name_vi"
  | "meta_title"
  | "meta_title_ko"
  | "meta_title_vi"
  | "meta_description"
  | "meta_description_ko"
  | "meta_description_vi"
  | "finish"
  | "finish_ko"
  | "finish_vi"
  | "designer_description"
  | "designer_description_ko"
  | "designer_description_vi"
  | "brand_origin"
  | "brand_origin_ko"
  | "brand_origin_vi"
  | "cldr_media_closeup_alt"
  | "cldr_media_closeup_alt_ko"
  | "cldr_media_closeup_alt_vi"
  | "cldr_media_lifestyle_1_alt"
  | "cldr_media_lifestyle_1_alt_ko"
  | "cldr_media_lifestyle_1_alt_vi"
  | "cldr_media_lifestyle_2_alt"
  | "cldr_media_lifestyle_2_alt_ko"
  | "cldr_media_lifestyle_2_alt_vi"
  | "cldr_media_long_alt"
  | "cldr_media_long_alt_ko"
  | "cldr_media_long_alt_vi"
  | "cldr_packshot_alt"
  | "cldr_packshot_alt_ko"
  | "cldr_packshot_alt_vi"
  | "filter_room"
  | "filter_room_ko"
  | "filter_room_vi";
export type KoreanBackfillExportRow = Readonly<Partial<Record<ExportColumn, SourceValue | null>>> & {
  readonly id: string;
};

export type KoreanBackfillExportRecord = {
  readonly table: KoreanBackfillTable;
  readonly id: string;
  readonly column: string;
  readonly source: Readonly<{ readonly vi?: SourceValue; readonly en?: SourceValue }>;
};

type KoreanBackfillExportInput = {
  readonly table: KoreanBackfillTable;
  readonly row: KoreanBackfillExportRow;
};

type Target = {
  readonly column: ExportColumn;
  readonly vietnamese: ExportColumn;
  readonly english: ExportColumn;
  readonly array: boolean;
  readonly sourcePriority: "vi" | "en";
};

const scalarTarget = (
  column: ExportColumn,
  vietnamese: ExportColumn,
  english: ExportColumn,
  sourcePriority: "vi" | "en" = "vi",
): Target => ({ column, vietnamese, english, array: false, sourcePriority });

const arrayTarget = (
  column: ExportColumn,
  vietnamese: ExportColumn,
  english: ExportColumn,
): Target => ({ column, vietnamese, english, array: true, sourcePriority: "vi" });

const targetsByTable: Readonly<Record<KoreanBackfillTable, readonly Target[]>> = {
  brands: [
    scalarTarget("description_ko", "description_vi", "description"),
    scalarTarget("origin_ko", "origin_vi", "origin"),
  ],
  catalogs: [scalarTarget("origin_ko", "origin_vi", "origin")],
  categories: [scalarTarget("name_ko", "name_vi", "name")],
  news: [scalarTarget("title_ko", "title_vi", "title")],
  products: [
    scalarTarget("name_ko", "name_vi", "name"),
    scalarTarget("slug_ko", "slug_vi", "slug", "en"),
    scalarTarget("description_ko", "description_vi", "description"),
  ],
  variants: [
    scalarTarget("name_ko", "name_vi", "name"),
    scalarTarget("short_name_ko", "short_name_vi", "short_name"),
    scalarTarget("slug_ko", "slug_vi", "slug", "en"),
    scalarTarget("description_ko", "description_vi", "description"),
    scalarTarget("meta_title_ko", "meta_title_vi", "meta_title"),
    scalarTarget("meta_description_ko", "meta_description_vi", "meta_description"),
    scalarTarget("finish_ko", "finish_vi", "finish"),
    scalarTarget("designer_description_ko", "designer_description_vi", "designer_description"),
    scalarTarget("brand_origin_ko", "brand_origin_vi", "brand_origin"),
    scalarTarget("cldr_media_closeup_alt_ko", "cldr_media_closeup_alt_vi", "cldr_media_closeup_alt"),
    scalarTarget("cldr_media_lifestyle_1_alt_ko", "cldr_media_lifestyle_1_alt_vi", "cldr_media_lifestyle_1_alt"),
    scalarTarget("cldr_media_lifestyle_2_alt_ko", "cldr_media_lifestyle_2_alt_vi", "cldr_media_lifestyle_2_alt"),
    scalarTarget("cldr_media_long_alt_ko", "cldr_media_long_alt_vi", "cldr_media_long_alt"),
    scalarTarget("cldr_packshot_alt_ko", "cldr_packshot_alt_vi", "cldr_packshot_alt"),
    arrayTarget("filter_room_ko", "filter_room_vi", "filter_room"),
  ],
};

function normalizedSource(value: SourceValue | null | undefined): SourceValue | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }

  if (value === null || value === undefined) {
    return undefined;
  }

  const trimmed = value.map((item) => item.trim()).filter((item) => item !== "");
  return trimmed.length === 0 ? undefined : trimmed;
}

function targetIsBlank(value: SourceValue | null | undefined): boolean {
  return normalizedSource(value) === undefined;
}

function sourceFor(
  target: Target,
  row: KoreanBackfillExportRow,
): Readonly<{ readonly vi?: SourceValue; readonly en?: SourceValue }> | undefined {
  const vietnamese = normalizedSource(row[target.vietnamese]);
  const english = normalizedSource(row[target.english]);

  const candidates = target.sourcePriority === "vi"
    ? [{ language: "vi", value: vietnamese }, { language: "en", value: english }]
    : [{ language: "en", value: english }, { language: "vi", value: vietnamese }];

  for (const candidate of candidates) {
    if (candidate.value !== undefined && Array.isArray(candidate.value) === target.array) {
      return candidate.language === "vi" ? { vi: candidate.value } : { en: candidate.value };
    }
  }

  return undefined;
}

export function koreanBackfillRecords(
  input: KoreanBackfillExportInput,
): readonly KoreanBackfillExportRecord[] {
  return targetsByTable[input.table].flatMap((target) => {
    if (!targetIsBlank(input.row[target.column])) {
      return [];
    }

    const source = sourceFor(target, input.row);
    return source === undefined
      ? []
      : [{ table: input.table, id: input.row.id, column: target.column, source }];
  });
}
