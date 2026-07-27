import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type VariantRow = {
  readonly id: string;
  readonly sku: string | null;
  readonly name: string;
  readonly name_vi: string | null;
  readonly size: string | null;
  readonly updated_at: string;
};

type ParsedEvidence = {
  readonly size: string;
  readonly expression: string;
  readonly rule: string;
  readonly sourceField: "name" | "name_vi";
};

type Candidate = VariantRow & {
  readonly proposed_size: string;
  readonly evidence: string;
  readonly rule: string;
  readonly source_field: "manual" | "name" | "name_vi";
};

type Review = Pick<VariantRow, "id" | "sku" | "name" | "name_vi" | "size"> & {
  readonly reason: string;
  readonly english?: ParsedEvidence[];
  readonly vietnamese?: ParsedEvidence[];
};

type ManualOverride = {
  readonly size: string;
  readonly evidence: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const apply = process.argv.includes("--apply");
const artifactDirectory = path.resolve(
  process.cwd(),
  "outputs/product-size-audit",
  `safe-axis-normalization-${new Date().toISOString().replace(/[:.]/g, "-")}`,
);

const manualOverrides = new Map<string, ManualOverride>();
const acceptedCurrentSkus = new Set([
  "CHRMT00012", "CHRMT00015", "CHRMT00016", "USMUS10184", "CLGBD00003", "TBLAT00004",
  "ACCBD00001", "ACCBD00002", "ACCBD00003", "ACCBD00004", "ACCBD00005", "ACCBD00006", "ACCBD00007",
  "LWLFR00001", "LWLFR00002", "LWLFR00003", "SFAMT00005", "SFAMT00007", "SFAMT00009",
  "USM-TBL-00006", "LFLSC00004", "LWLFL00015",
]);
const forcedReviewReasons = new Map<string, string>([
  ["LPLHA00016", "Malformed multi-axis evidence: Ø60 x H69x62x0.5 cm; official references conflict"],
  ["LPLHA00017", "Malformed multi-axis evidence: Ø80 x H89x82x0.5 cm; official references conflict"],
]);

function addManual(skus: readonly string[], size: string, evidence: string): void {
  for (const sku of skus) {
    if (manualOverrides.has(sku)) throw new Error(`Duplicate manual override: ${sku}`);
    manualOverrides.set(sku, { size, evidence });
  }
}

addManual(
  ["ACCMT00030", "ACCMT00031", "ACCMT00032"],
  "1× W170 x D170 mm; 1× W130 x D130 mm; 3× W90 x D90 mm",
  "Name: 1xDI17 + 1xDI13 + 3xDI9 cm",
);
addManual(["LFLFL00037"], "W380 x D380 x H2000 mm", "Name: diameter 380 mm x H2000 mm");
addManual(["LFLML00001", "LFLML00002", "LFLML00003"], "W850 x D850 x H1600 mm", "Name: DI85 x 160 cm");
addManual(["LPLFA00001"], "W900/1500 x D900/1500 x H5000 mm", "Name: DK900/1500 x H5000 mm");
addManual(["LPLFH00007"], "W258 x D258 x H337 mm", "Name: DI25.8 x H33.7 cm");
addManual(["LPLFH00022"], "W340 x D340 x H370 mm", "Name: diameter 34 x H37 cm");
addManual(["LPLLP00053"], "W500 x D500 x H267 mm", "Name: Ø500 x 267 mm");
addManual(["LTLFH00007", "LTLFH00010"], "W235 x D235 x H239 mm", "Name: diameter 23.5 x H23.9 cm");
addManual(["LTLML00007", "LTLML00008", "LTLML00009"], "W270 x D270 x H350 mm", "Name: diameter 27 x H35 cm");
addManual(["LTLML00014", "LTLML00015", "LTLML00016", "LTLML00017"], "W200 x D200 x H310 mm", "Name: diameter 20 x H31 cm");
addManual(["ACCHA00135"], "W130 x D130 x H275 mm", "Name: diameter 13 x H27.5 cm");
addManual(["ACCHA00138"], "W50 x D50 x H65 mm", "Name: diameter 5 x H6.5 cm");
addManual(["TBLBD00008", "TBLBD00009"], "W1300 x D1300 x H735 mm", "Name: DI130 x H73.5 cm");

addManual(["ACCCA00001", "ACCCA00002"], "W70 x D70 x H145 mm", "Vietnamese name corroborated by English product identity");
addManual(["ACCCA00015"], "W80 x D80 x H100 mm", "Vietnamese name corroborated by English product identity");
addManual(["ACCCA00025"], "W100 x D100 x H310 mm", "Vietnamese name corroborated by English product identity");
addManual(["ACCCA00031"], "W270 x D270 x H260 mm", "Vietnamese name corroborated by English product identity");
addManual(["ACCCA00032", "ACCCA00033"], "W230 x D230 x H370 mm", "Vietnamese name corroborated by English product identity");
addManual(["ACCHA00182"], "W110 x D110 x H15 mm", "Vietnamese name corroborated by English product identity");
addManual(["ACCHA00185"], "W85 x D85 x H35 mm", "Vietnamese name corroborated by English product identity");
addManual(["ACCHA00187", "ACCHA00188"], "W75 x D75 x H150 mm", "Vietnamese name corroborated by English product identity");
addManual(["ACCHA00203"], "W135 x D135 x H145 mm", "Vietnamese name corroborated by English product identity");
addManual(["ACCHA00205", "ACCHA00206"], "W95 x D95 x H180 mm", "Vietnamese name corroborated by English product identity");
addManual(["CHRAT00003", "CHRAT00004", "CHRAT00005"], "W440 x D440 x H420 mm", "Vietnamese name corroborated by English product identity");
addManual(["CHRCA00007", "CHRCA00008", "CHRCA00009"], "W330 x D330 x H267 mm", "Vietnamese name corroborated by English product identity");
addManual(["CHRCA00010", "CHRCA00011", "CHRCA00012"], "W330 x D330 x H384 mm", "Vietnamese name corroborated by English product identity");
addManual(["LFLCA00001"], "W450 x D450 x H1300 mm", "Vietnamese name corroborated by English product identity");
addManual(["LFLCA00002"], "W100 x D100 x H420 mm", "Vietnamese name corroborated by English product identity");
addManual(["LPLFA00016"], "W449 x D449 x H449 mm", "Vietnamese name corroborated by English product identity");
addManual(["LPLFL00012"], "W190 x D190 x H160 mm", "Vietnamese name corroborated by English product identity");
addManual(
  ["LPLLP00011", "LPLLP00012", "LPLLP00013", "LPLLP00014", "LPLLP00015", "LPLLP00041"],
  "W300 x D300 x H163 mm",
  "Vietnamese name corroborated by English product identity",
);
addManual(["LPLLP00033"], "W500 x D500 x H285 mm (CL3000 mm)", "Vietnamese name corroborated by English product identity");
addManual(["LTLCA00003"], "W400 x D400 x H610 mm", "Vietnamese name corroborated by English product identity");
addManual(["LTLFL00033", "LTLFL00046"], "W495 x D495 x H645 mm", "Vietnamese name corroborated by English product identity");
addManual(["TBLCA00006", "TBLCA00007"], "W400 x D400 x H440 mm", "Vietnamese name corroborated by English product identity");
addManual(["TBLCA00008"], "W400 x D400 x H490 mm", "Vietnamese name corroborated by English product identity");
addManual(["TBLCA00009"], "W500 x D500 x H500 mm", "Vietnamese name corroborated by English product identity");
addManual(["TBLCA00011"], "W700 x D700 x H300 mm", "Vietnamese name corroborated by English product identity");
addManual(["TBLCA00012"], "W900 x D900 x H350 mm", "Vietnamese name corroborated by English product identity");
addManual(["TBLCA00020"], "W450 x D450 x H470 mm", "Vietnamese name corroborated by English product identity");
addManual(["TBLHA00037"], "W750 x D750 x H350 mm", "Vietnamese name corroborated by English product identity");
addManual(["TBLHA00038"], "W700 x D700 x H730 mm", "Vietnamese name corroborated by English product identity");

addManual(["CHRVT00033", "CHRVT00034", "CHRVT00035", "CHRVT00036", "CHRVT00037"], "W380 x D380 x H440 mm", "Artek Stool E60: Ø38 x H44 cm");
addManual(["TBLHA00045"], "W540 x D540 x H440 mm", "HAY SHIM Eggshell: Ø54 x H44 cm");
addManual(["TBLHA00046", "TBLHA00047"], "W450 x D450 x H510 mm", "HAY SHIM Custard/Bordeaux: Ø45 x H51 cm");
addManual(["LPLFL00074"], "W1656 x D100 mm", "Flos Luce Cilindrica: width 100 mm, length 1656 mm; no H100");
addManual(["LPLFH00002"], "W600 x D600 x H332 mm", "Fritz Hansen AEON Rocket: diameter 600 mm, height 332 mm");
addManual(["LPLFL00072"], "W1656 x D100 mm", "Name: DI100 x L1656 mm");
addManual(["LPLFL00073"], "W2072 x D100 mm", "Name: DI100 x L2072 mm");
addManual(["LPLFL00076"], "W1810 x D47 x H1205 mm", "Name: L1810 x DI47 x H1205 mm");
addManual(["ACCBB00002"], "W4300 x D4300 mm", "Name: ISTOS model TS1R, DI430 cm");
addManual(["LTLHA00006"], "W380 x D380 x H520 mm (CL2000 mm)", "Name: W38 x D38 x H52 x CL200 cm");
addManual(["LPLLP00056"], "W600 x D600 x H580 mm", "Louis Poulsen PH Artichoke Anniversary: 600 x 580 x 600 mm");
addManual(["ACCHA00146"], "W110 x D55 x H80 mm", "Vietnamese name: L11 x W5.5 x H8 cm");
addManual(["ACCHA00106", "ACCHA00107"], "W2100 x D1500 mm", "More complete flat-textile dimensions: L210 x W150 cm");
addManual(["ACCHA00082"], "W400 x D300 x H145 mm", "Primary name and Size M sibling: L40 x W30 x H14.5 cm");
addManual(["ACCVT00076"], "W195 x D110 x H80 mm", "Primary name and NUAGE Small sibling: L195 x W110 x H80 mm");
addManual(["TBLBD00005"], "W1600 x D1000 x H350 mm", "More complete Vietnamese name: L160 x W100 x H35 cm");
addManual(["TBLHA00030"], "W2500 x D950 x H740 mm", "Primary name and T12 sibling: L250 x W95 x H74 cm");
addManual(["TBLMT00010"], "W1900 x D850 x H1050 mm", "Primary name and BASE HIGH TABLE sibling: L190 x W85 x H105 cm");
addManual(
  ["USM-TBL-00003", "USM-TBL-00004"],
  "W1600 x D800 x H700/1200 mm",
  "More complete primary name preserves adjustable height range: L1600 x D800 x H700/1200 mm",
);
addManual(["CABHA00010", "CABHA00011", "CABHA00012"], "W380 x D380 x H660 mm", "Primary name: W38 x D38 x H66 cm");
addManual(["CABHA00013", "CABHA00014", "CABHA00015"], "W380 x D380 x H490 mm", "Primary name: W38 x D38 x H49 cm");
addManual(["ACCHA00039", "ACCHA00283"], "W495 x D505 x H1615 mm", "Primary name: W49.5 x D50.5 x H161.5 cm");
addManual(["ACCHA00289", "ACCHA00290"], "W495 x D55 x H220 mm", "Primary name: W49.5 x D5.5 x H22 cm");
addManual(["CLGHA00016"], "W630 x D665 x H685 mm", "Primary name: W63 x D66.5 x H68.5 cm");
addManual(
  ["ACCVT00030", "ACCVT00031"],
  "1× W180 x D180 x H30 mm; 1× W290 x D290 x H30 mm; 1× W400 x D400 x H30 mm",
  "Primary name: TRAYS, DI180 | DI290 | DI400 mm x H30 mm",
);
addManual(
  ["LFLFL00006"],
  "W383 x D383 x H2000 mm (diffuser W337 x D337 mm)",
  "CHRYSALIS official dimensions: base diameter 383, diffuser diameter 337, height 2000 mm",
);
addManual(
  ["LFLFL00025"],
  "W720 x D500 x H1450 mm (base W320 x D320 mm)",
  "Flos official dimensions: 720 x 500, height 1450, base diameter 320 mm",
);
addManual(
  ["LPLLP00034", "LPLLP00036", "LPLLP00037", "LPLLP00038", "LPLLP00040", "LPLLP00044", "LPLLP00045", "LPLLP00046", "LPLLP00047"],
  "W500 x D500 x H267 mm (CL3000 mm)",
  "Louis Poulsen PH 5 official dimensions: W500 x D500 x H267 mm, cable 3000 mm",
);
addManual(["LTLFL00016"], "W200 x D176 x H381 mm", "Flos IC T1 Low official dimensions: L200 x W176 x H381 mm");
addManual(
  ["LTLML00018", "LTLML00019"],
  "W220 x D220 x H650 mm (base W120 x D120 mm)",
  "Martinelli Luce L'AMICA official dimensions: diameter 220, height 650, base diameter 120 mm",
);
addManual(
  ["TBLFH00021"],
  "W490 x D490 x H445 mm (base W260 x D260 mm)",
  "Primary name: base DI26 x top DI49 x H44.5 cm",
);

const unitPattern = '(?:mm|cm|m|inches|inch|in|")';
const numberPattern = String.raw`\d+(?:[.,]\d+)?(?:\s*(?:\/|-|–|~)\s*\d+(?:[.,]\d+)?)?`;
const axisNumberPattern = String.raw`(?:Ø|Φ|DI|DK|DIA(?:METER)?\.?|SH|AH|DH|TH|CL|W|D|H|L|R|C)\s*[:=]?\s*\d`;

function unitScale(unit: string): number | null {
  switch (unit.toLowerCase()) {
    case "mm": return 1;
    case "cm": return 10;
    case "m": return 1000;
    case "in":
    case "inch":
    case "inches":
    case "\"": return 25.4;
    default: return null;
  }
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function convertNumberToken(raw: string, unit: string): string | null {
  const scale = unitScale(unit);
  if (scale === null) return null;
  const compact = raw.replace(/\s+/g, "");
  const separatorMatch = compact.match(/(\/|-|–|~)/);
  const parts = compact.split(/\/|-|–|~/);
  if (parts.length > 2) return null;
  const converted: string[] = [];
  for (const part of parts) {
    if (/^\d+,\d{3}$/.test(part)) return null;
    const numeric = Number(part.replace(",", "."));
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    const millimetres = numeric * scale;
    if (millimetres > 50_000) return null;
    converted.push(formatNumber(millimetres));
  }
  if (converted.length === 1) return converted[0]!;
  const separator = separatorMatch?.[1] === "/" ? "/" : "-";
  return `${converted[0]}${separator}${converted[1]}`;
}

function canonicalSize(values: { W?: string | null; D?: string | null; H?: string | null }): string | null {
  const parts = (["W", "D", "H"] as const).flatMap((axis) => values[axis] ? `${axis}${values[axis]}` : []);
  return parts.length > 0 ? `${parts.join(" x ")} mm` : null;
}

function expressionFromMatch(match: RegExpExecArray): string {
  return match[0]!.trim().replace(/^[,(]\s*/, "");
}

function hasUnconsumedAxis(text: string, match: RegExpExecArray): boolean {
  const matchStart = match.index;
  const matchEnd = match.index + match[0]!.length;
  const clauseStartIndex = text.lastIndexOf(",", matchStart - 1);
  const clauseEndIndex = text.indexOf(",", matchEnd);
  const clauseStart = clauseStartIndex < 0 ? 0 : clauseStartIndex + 1;
  const clauseEnd = clauseEndIndex < 0 ? text.length : clauseEndIndex;
  const before = text.slice(clauseStart, matchStart);
  const after = text.slice(matchEnd, clauseEnd);
  return new RegExp(axisNumberPattern, "i").test(`${before} ${after}`);
}

function parseMatch(
  text: string,
  regex: RegExp,
  rule: string,
  sourceField: "name" | "name_vi",
  mapper: (groups: Record<string, string>) => { W?: string | null; D?: string | null; H?: string | null } | null,
): ParsedEvidence | null {
  const match = regex.exec(text);
  if (!match?.groups || hasUnconsumedAxis(text, match)) return null;
  const mapped = mapper(match.groups);
  if (!mapped) return null;
  const size = canonicalSize(mapped);
  return size ? { size, expression: expressionFromMatch(match), rule, sourceField } : null;
}

function value(groups: Record<string, string>, key: string, fallbackUnit: string): string | null {
  const raw = groups[key];
  if (!raw) return null;
  const unit = groups[`u${key}`] || fallbackUnit;
  return convertNumberToken(raw, unit);
}

function parseText(text: string, sourceField: "name" | "name_vi"): ParsedEvidence[] {
  const results: ParsedEvidence[] = [];
  const add = (parsed: ParsedEvidence | null): void => {
    if (parsed && !results.some((item) => item.size === parsed.size && item.expression === parsed.expression)) results.push(parsed);
  };

  const lMiddleH = new RegExp(
    String.raw`(?:^|[\s,(])L\s*[:=]?\s*(?<W>${numberPattern})\s*(?<uW>${unitPattern})?\s*(?:x|\*)\s*(?:D|W)\s*[:=]?\s*(?<D>${numberPattern})\s*(?<uD>${unitPattern})?\s*(?:x|\*)\s*H\s*[:=]?\s*(?<H>${numberPattern})\s*\)?\s*(?<uH>${unitPattern})`,
    "i",
  );
  add(parseMatch(text, lMiddleH, "L x D/W x H => W x D x H", sourceField, (groups) => {
    const fallback = groups.uH;
    const W = value(groups, "W", fallback);
    const D = value(groups, "D", fallback);
    const H = value(groups, "H", fallback);
    return W && D && H ? { W, D, H } : null;
  }));

  const wLH = new RegExp(
    String.raw`(?:^|[\s,(])W\s*[:=]?\s*(?<D>${numberPattern})\s*(?<uD>${unitPattern})?\s*(?:x|\*)\s*L\s*[:=]?\s*(?<W>${numberPattern})\s*(?<uW>${unitPattern})?\s*(?:x|\*)\s*H\s*[:=]?\s*(?<H>${numberPattern})\s*(?<uH>${unitPattern})`,
    "i",
  );
  add(parseMatch(text, wLH, "W x L x H => W(L) x D(W) x H", sourceField, (groups) => {
    const fallback = groups.uH;
    const W = value(groups, "W", fallback);
    const D = value(groups, "D", fallback);
    const H = value(groups, "H", fallback);
    return W && D && H ? { W, D, H } : null;
  }));

  const hLW = new RegExp(
    String.raw`(?:^|[\s,(])H\s*[:=]?\s*(?<H>${numberPattern})\s*(?<uH>${unitPattern})?\s*(?:x|\*)\s*L\s*[:=]?\s*(?<W>${numberPattern})\s*(?<uW>${unitPattern})?\s*(?:x|\*)\s*W\s*[:=]?\s*(?<D>${numberPattern})\s*(?<uD>${unitPattern})`,
    "i",
  );
  add(parseMatch(text, hLW, "H x L x W => W(L) x D(W) x H", sourceField, (groups) => {
    const fallback = groups.uD;
    const W = value(groups, "W", fallback);
    const D = value(groups, "D", fallback);
    const H = value(groups, "H", fallback);
    return W && D && H ? { W, D, H } : null;
  }));

  const hWL = new RegExp(
    String.raw`(?:^|[\s,(])H\s*[:=]?\s*(?<H>${numberPattern})\s*(?<uH>${unitPattern})?\s*(?:x|\*)\s*W\s*[:=]?\s*(?<D>${numberPattern})\s*(?<uD>${unitPattern})?\s*(?:x|\*)\s*L\s*[:=]?\s*(?<W>${numberPattern})\s*(?<uW>${unitPattern})`,
    "i",
  );
  add(parseMatch(text, hWL, "H x W x L => W(L) x D(W) x H", sourceField, (groups) => {
    const fallback = groups.uW;
    const W = value(groups, "W", fallback);
    const D = value(groups, "D", fallback);
    const H = value(groups, "H", fallback);
    return W && D && H ? { W, D, H } : null;
  }));

  const wL = new RegExp(
    String.raw`(?:^|[\s,(])W\s*[:=]?\s*(?<D>${numberPattern})\s*(?<uD>${unitPattern})?\s*(?:x|\*)\s*L\s*[:=]?\s*(?<W>${numberPattern})\s*(?<uW>${unitPattern})`,
    "i",
  );
  add(parseMatch(text, wL, "W x L => W(L) x D(W)", sourceField, (groups) => {
    const fallback = groups.uW;
    const W = value(groups, "W", fallback);
    const D = value(groups, "D", fallback);
    return W && D ? { W, D } : null;
  }));

  const lMiddle = new RegExp(
    String.raw`(?:^|[\s,(])L\s*[:=]?\s*(?<W>${numberPattern})\s*(?<uW>${unitPattern})?\s*(?:x|\*)\s*(?:D|W)\s*[:=]?\s*(?<D>${numberPattern})\s*(?<uD>${unitPattern})`,
    "i",
  );
  add(parseMatch(text, lMiddle, "L x D/W => W x D", sourceField, (groups) => {
    const fallback = groups.uD;
    const W = value(groups, "W", fallback);
    const D = value(groups, "D", fallback);
    return W && D ? { W, D } : null;
  }));

  const dRC = new RegExp(
    String.raw`(?:^|[\s,(])D\s*[:=]?\s*(?<W>${numberPattern})\s*(?<uW>${unitPattern})?\s*(?:x|\*)\s*R\s*[:=]?\s*(?<D>${numberPattern})\s*(?<uD>${unitPattern})?\s*(?:x|\*)\s*C\s*[:=]?\s*(?<H>${numberPattern})\s*(?<uH>${unitPattern})`,
    "i",
  );
  add(parseMatch(text, dRC, "D x R x C => W x D x H", sourceField, (groups) => {
    const fallback = groups.uH;
    const W = value(groups, "W", fallback);
    const D = value(groups, "D", fallback);
    const H = value(groups, "H", fallback);
    return W && D && H ? { W, D, H } : null;
  }));

  const dR = new RegExp(
    String.raw`(?:^|[\s,(])D\s*[:=]?\s*(?<W>${numberPattern})\s*(?<uW>${unitPattern})?\s*(?:x|\*)\s*R\s*[:=]?\s*(?<D>${numberPattern})\s*(?<uD>${unitPattern})`,
    "i",
  );
  add(parseMatch(text, dR, "D x R => W x D", sourceField, (groups) => {
    const fallback = groups.uD;
    const W = value(groups, "W", fallback);
    const D = value(groups, "D", fallback);
    return W && D ? { W, D } : null;
  }));

  return results;
}

function hasExplicitMeasurement(text: string): boolean {
  return (
    new RegExp(String.raw`${axisNumberPattern}[\s\S]{0,50}${unitPattern}`, "i").test(text)
    || new RegExp(String.raw`\d+(?:[.,]\d+)?\s*(?:x|\*)\s*\d+(?:[.,]\d+)?[\s\S]{0,30}${unitPattern}`, "i").test(text)
  );
}

function selectEvidence(row: VariantRow): { selected?: ParsedEvidence; review?: Review } {
  const english = parseText(row.name, "name");
  const vietnamese = row.name_vi ? parseText(row.name_vi, "name_vi") : [];
  const uniqueEnglish = [...new Map(english.map((item) => [item.size, item])).values()];
  const uniqueVietnamese = [...new Map(vietnamese.map((item) => [item.size, item])).values()];

  if (uniqueEnglish.length > 1 || uniqueVietnamese.length > 1) {
    return { review: { ...row, reason: "multiple structural size interpretations", english, vietnamese } };
  }

  const en = uniqueEnglish[0];
  const vi = uniqueVietnamese[0];
  if (en && vi && en.size !== vi.size) {
    return { review: { ...row, reason: "English and Vietnamese dimensions conflict", english, vietnamese } };
  }
  if (en) return { selected: en };
  if (vi) {
    return {
      review: {
        ...row,
        reason: hasExplicitMeasurement(row.name)
          ? "Vietnamese-only axis pattern conflicts with other English size evidence"
          : "Vietnamese-only structural dimensions require manual corroboration",
        english,
        vietnamese,
      },
    };
  }
  return {};
}

async function rest<T>(query: URLSearchParams, init: RequestInit = {}): Promise<T> {
  const url = new URL("/rest/v1/variants", SUPABASE_URL);
  url.search = query.toString();
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY!}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`variants request failed: ${response.status} ${await response.text()}`);
  return response.json() as Promise<T>;
}

async function readAll(): Promise<VariantRow[]> {
  const rows: VariantRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const query = new URLSearchParams({
      select: "id,sku,name,name_vi,size,updated_at",
      order: "id.asc",
      limit: "1000",
      offset: String(offset),
    });
    const page = await rest<VariantRow[]>(query);
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const output: R[] = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await mapper(items[index]!);
    }
  }));
  return output;
}

async function main(): Promise<void> {
  await mkdir(artifactDirectory, { recursive: true });
  const rows = await readAll();
  const candidates: Candidate[] = [];
  const reviews: Review[] = [];
  const acceptedCurrent: Pick<VariantRow, "id" | "sku" | "name" | "name_vi" | "size">[] = [];
  const missingManualSkus = new Set(manualOverrides.keys());

  for (const row of rows) {
    const sku = row.sku ?? "";
    const manual = manualOverrides.get(sku);
    if (manual) {
      missingManualSkus.delete(sku);
      if (row.size !== manual.size) {
        candidates.push({
          ...row,
          proposed_size: manual.size,
          evidence: manual.evidence,
          rule: "reviewed manual override",
          source_field: "manual",
        });
      }
      continue;
    }

    const forcedReviewReason = forcedReviewReasons.get(sku);
    if (forcedReviewReason) {
      reviews.push({ ...row, reason: forcedReviewReason });
      continue;
    }
    if (acceptedCurrentSkus.has(sku)) {
      acceptedCurrent.push(row);
      continue;
    }

    const result = selectEvidence(row);
    if (result.review) {
      reviews.push(result.review);
      continue;
    }
    if (!result.selected || result.selected.size === row.size) continue;
    candidates.push({
      ...row,
      proposed_size: result.selected.size,
      evidence: result.selected.expression,
      rule: result.selected.rule,
      source_field: result.selected.sourceField,
    });
  }

  if (missingManualSkus.size > 0) {
    throw new Error(`Manual override SKUs missing from live DB: ${[...missingManualSkus].join(", ")}`);
  }

  const duplicateIds = Object.entries(Object.groupBy(candidates, (candidate) => candidate.id))
    .filter(([, grouped]) => (grouped?.length ?? 0) > 1);
  if (duplicateIds.length > 0) throw new Error(`Duplicate candidate IDs: ${duplicateIds.map(([id]) => id).join(", ")}`);

  const rollback = candidates.map((candidate) => ({
    id: candidate.id,
    sku: candidate.sku,
    size: candidate.size,
    updated_at: candidate.updated_at,
  }));

  await Promise.all([
    writeFile(path.join(artifactDirectory, "plan.json"), JSON.stringify({ apply, candidates, reviews, acceptedCurrent }, null, 2)),
    writeFile(path.join(artifactDirectory, "rollback.json"), JSON.stringify(rollback, null, 2)),
  ]);

  const applied: string[] = [];
  const stale: string[] = [];
  const errors: { id: string; sku: string | null; error: string }[] = [];

  if (apply) {
    await mapConcurrent(candidates, 5, async (candidate) => {
      try {
        const query = new URLSearchParams({
          id: `eq.${candidate.id}`,
          updated_at: `eq.${candidate.updated_at}`,
        });
        const updated = await rest<VariantRow[]>(query, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ size: candidate.proposed_size }),
        });
        if (updated.length === 1 && updated[0]?.size === candidate.proposed_size) applied.push(candidate.id);
        else stale.push(candidate.id);
      } catch (error) {
        errors.push({
          id: candidate.id,
          sku: candidate.sku,
          error: error instanceof Error ? error.message : "unknown error",
        });
      }
    });
  }

  const liveAfter = apply ? await readAll() : [];
  const byId = new Map(liveAfter.map((row) => [row.id, row]));
  const verification = apply
    ? candidates.map((candidate) => ({
      id: candidate.id,
      sku: candidate.sku,
      expected: candidate.proposed_size,
      actual: byId.get(candidate.id)?.size ?? null,
      verified: byId.get(candidate.id)?.size === candidate.proposed_size,
    }))
    : [];

  const result = {
    artifactDirectory,
    apply,
    scanned: rows.length,
    manualOverrides: manualOverrides.size,
    candidates: candidates.length,
    structuralCandidates: candidates.filter((candidate) => candidate.source_field !== "manual").length,
    manualCandidates: candidates.filter((candidate) => candidate.source_field === "manual").length,
    reviews: reviews.length,
    acceptedCurrent: acceptedCurrent.length,
    applied: applied.length,
    stale,
    errors,
    verified: verification.filter((item) => item.verified).length,
    verificationFailures: verification.filter((item) => !item.verified),
  };

  await writeFile(path.join(artifactDirectory, "result.json"), JSON.stringify({ result, verification }, null, 2));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (stale.length > 0 || errors.length > 0 || (apply && result.verificationFailures.length > 0)) process.exitCode = 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : "unknown error"}\n`);
  process.exitCode = 1;
});
