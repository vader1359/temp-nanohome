import { z } from "zod";

export const PAGE_SIZE = 24;

export const FilterSchema = z.object({
  brand: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      const arr = Array.isArray(v) ? v : v ? [v] : [];
      return Array.from(new Set(arr)).sort();
    })
    .default([]),
  category: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      const arr = Array.isArray(v) ? v : v ? [v] : [];
      return Array.from(new Set(arr)).sort();
    })
    .default([]),
  subCategory: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      const arr = Array.isArray(v) ? v : v ? [v] : [];
      return Array.from(new Set(arr)).sort();
    })
    .default([]),
  room: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      const arr = Array.isArray(v) ? v : v ? [v] : [];
      return Array.from(new Set(arr)).sort();
    })
    .default([]),
  status: z.enum(["in_stock", "sale", "out_of_stock", "new_arrival"]).optional().nullable().default(null),
  q: z.string().optional().transform((v) => v ?? "").default(""),
  sort: z.enum(["priority", "price_asc", "price_desc", "newest"]).optional().default("priority"),
  page: z.coerce.number().int().min(1).optional().default(1),
});

export type CanonicalFilters = z.infer<typeof FilterSchema>;

function searchParamsToRecord(params: URLSearchParams): Record<string, string | string[] | undefined> {
  const record: Record<string, string[]> = {};
  params.forEach((value, key) => {
    if (!record[key]) {
      record[key] = [];
    }
    record[key].push(value);
  });
  const result: Record<string, string | string[] | undefined> = {};
  for (const [key, values] of Object.entries(record)) {
    if (["brand", "category", "subCategory", "room"].includes(key)) {
      result[key] = values;
    } else {
      result[key] = values[values.length - 1];
    }
  }
  return result;
}

export function parseFilters(input: Record<string, string | string[] | undefined> | URLSearchParams | string): CanonicalFilters {
  let record: Record<string, string | string[] | undefined> = {};
  if (typeof input === "string") {
    // If it's a relative URL or query string, parse it properly
    const urlString = input.startsWith("http") || input.startsWith("/") ? input : `/?${input}`;
    const searchParams = new URL(urlString, "http://localhost").searchParams;
    record = searchParamsToRecord(searchParams);
  } else if (input instanceof URLSearchParams) {
    record = searchParamsToRecord(input);
  } else {
    record = input || {};
  }

  const parsed = FilterSchema.safeParse(record);
  if (!parsed.success) {
    return {
      brand: [],
      category: [],
      subCategory: [],
      room: [],
      status: null,
      q: "",
      sort: "priority",
      page: 1,
    };
  }

  return parsed.data;
}

export function buildQueryKey(filters: CanonicalFilters): unknown[] {
  return [
    "products",
    {
      brand: filters.brand,
      category: filters.category,
      subCategory: filters.subCategory,
      room: filters.room,
      status: filters.status,
      q: filters.q,
      sort: filters.sort,
      page: filters.page,
    },
  ];
}

export function buildQueryString(filters: CanonicalFilters): string {
  const params = new URLSearchParams();
  
  // deterministic brand, category, subCategory, room, status, q, sort, page parameter order
  filters.brand.forEach((val) => params.append("brand", val));
  filters.category.forEach((val) => params.append("category", val));
  filters.subCategory.forEach((val) => params.append("subCategory", val));
  filters.room.forEach((val) => params.append("room", val));
  
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.q.trim()) {
    params.set("q", filters.q.trim());
  }
  if (filters.sort && filters.sort !== "priority") {
    params.set("sort", filters.sort);
  }
  if (filters.page && filters.page > 1) {
    params.set("page", String(filters.page));
  }
  
  return params.toString();
}
