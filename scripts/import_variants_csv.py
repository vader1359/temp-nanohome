#!/usr/bin/env python3
"""
Import Airtable CSV export into the variants table on Supabase.

Match key: variants.airtable_id = CSV "id" (e.g. recXXXX).
Strategy: read CSV, build row dicts, upsert in batches via PostgREST.
Scope: all columns from the CSV that have a matching DB column after the
migration `add_variants_csv_columns`.

Run from repo root:
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
        python3 scripts/import_variants_csv.py \
        "/Volumes/mDrive/Downloads/variants-EDIT VIEW (2).csv"
"""

from __future__ import annotations

import csv
import json
import os
import re
import sys
import time
import urllib.parse
from typing import Any

import urllib.request

CSV_PATH = sys.argv[1] if len(sys.argv) > 1 else "/Volumes/mDrive/Downloads/variants-EDIT VIEW (2).csv"
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
TABLE = "variants"
BATCH = 50  # 50 rows per upsert call; PostgREST body size safe

# Fixed column set + order (PostgREST requires identical keys/order across batch).
SHIPPED_COLUMNS: tuple[str, ...] = (
    "airtable_id",
    "name",
    "name_vi",
    "short_name",
    "short_name_vi",
    "sku",
    "test_sku",
    "slug",
    "slug_vi",
    "description",
    "description_vi",
    "meta_title",
    "meta_title_vi",
    "meta_description",
    "meta_description_vi",
    "feature_text",
    "validated",
    "approved",
    "is_new",
    "is_weird",
    "is_clearance_sale",
    "is_clearance_sale_bak",
    "is_usm_sale",
    "is_knoll_preorder",
    "is_children_day_sale",
    "is_yes26_left",
    "is_stylist_pick",
    "missed_sku",
    "in_stock",
    "on_sale",
    "price",
    "discount_percent",
    "compare_at_price",
    "size",
    "finish",
    "finish_vi",
    "priority",
    "packshot_url",
    "packshot_size",
    "gallery_urls",
    "cloudinary_ids",
    "designer_name",
    "designer_description",
    "designer_description_vi",
    "designer_cldr_id_portrait",
    "brand_name_denorm",
    "brand_origin",
    "brand_origin_vi",
    "brand_logo_size",
    "brand_cldr_logo",
    "brand_cldr_id_logo",
    "product_name_denorm",
    "product_line",
    "filter_room",
    "filter_room_vi",
    "filter_brand",
    "filter_category",
    "filter_sub_category",
    "filter_collection_pk",
    "filter_collection_jaime",
    "filter_collection_balcony",
    "filter_collection_ph",
    "filter_collection_art",
    "filter_is_new_arrival",
    "filter_is_gifting_ideas",
    "filter_price",
    "filter_price_gift",
    "filter_product_line",
    "cldr_id_packshot",
    "cldr_packshot_alt",
    "cldr_packshot_alt_vi",
    "cldr_media_long",
    "cldr_id_media_long",
    "cldr_media_long_alt",
    "cldr_media_long_alt_vi",
    "cldr_media_closeup",
    "cldr_id_media_closeup",
    "cldr_media_closeup_alt",
    "cldr_media_closeup_alt_vi",
    "cldr_media_lifestyle_1",
    "cldr_id_media_lifestyle_1",
    "cldr_media_lifestyle_1_alt",
    "cldr_media_lifestyle_1_alt_vi",
    "cldr_media_lifestyle_2",
    "cldr_id_media_lifestyle_2",
    "cldr_media_lifestyle_2_alt",
    "cldr_media_lifestyle_2_alt_vi",
    "cldr_media_illustration",
    "cldr_id_media_illustration",
    "cldr_media_info_as_image",
    "cldr_id_media_info_as_image",
    "media_info_as_image",
    "same_sub_category_variant_ids",
    "same_designer_variant_ids",
    "same_brand_variant_ids",
    "source_created_at",
    "source_updated_at",
)


# CSV column name -> Postgres column name (snake_case, __vi -> _vi)
COLUMN_MAP: dict[str, str] = {
    # existing variants columns (will be overwritten by CSV)
    "name": "name",
    "sku": "sku",
    "id": "airtable_id",  # match key
    "validated": "validated",
    "approved": "approved",
    "in_stock": "in_stock",
    "price": "price",
    "slug": "slug",
    "slug__vi": "slug_vi",
    "finish": "finish",
    "finish__vi": "finish_vi",
    "size": "size",
    "priority": "priority",
    "discount_percentage": "discount_percent",
    "discounted_price": "discounted_price",
    "category": "category",
    "brand": "brand",
    "designer": "designer",
    "sub_category": "sub_category",
    "sub_category copy": "sub_category_copy",
    "filter_sub_category": "filter_sub_category",
    "filter_category": "filter_category",
    "filter_brand": "filter_brand",
    "filter_room": "filter_room",
    "filter_room__vi": "filter_room_vi",
    "filter_collection_PK": "filter_collection_pk",
    "filter_collection_jaime": "filter_collection_jaime",
    "filter_collection_balcony": "filter_collection_balcony",
    "filter_collection_ph": "filter_collection_ph",
    "filter_collection_art": "filter_collection_art",
    "filter_is_new_arrival": "filter_is_new_arrival",
    "filter_is_gifting_ideas": "filter_is_gifting_ideas",
    "filter_price": "filter_price",
    "filter_price_gift": "filter_price_gift",
    "filter_product_line": "filter_product_line",
    # Vietnamese / narrative text
    "name__vi": "name_vi",
    "short_name": "short_name",
    "short_name__vi": "short_name_vi",
    "description": "description",
    "description__vi": "description_vi",
    "meta_title": "meta_title",
    "meta_title__vi": "meta_title_vi",
    "meta_description": "meta_description",
    "meta_description__vi": "meta_description_vi",
    "AI assist": "feature_text",
    # Designer
    "designer_name": "designer_name",
    "designer_description": "designer_description",
    "designer_description__vi": "designer_description_vi",
    "designer_cldr_id_portrait": "designer_cldr_id_portrait",
    # Brand denorm
    "brand_name": "brand_name_denorm",
    "brand_origin": "brand_origin",
    "brand_origin__vi": "brand_origin_vi",
    "brand_logo_size": "brand_logo_size",
    "brand_cldr_logo": "brand_cldr_logo",
    "brand_cldr_id_logo": "brand_cldr_id_logo",
    # Product denorm
    "product": "product_name_denorm",
    "product_name": "product_name_denorm",
    "product_line": "product_line",
    "packshot_size": "packshot_size",
    # Flags (boolean "checked" -> true)
    "is_clearance_sale": "is_clearance_sale",
    "is_clearance_sale_bak": "is_clearance_sale_bak",
    "is_usm_sale": "is_usm_sale",
    "is_knoll_preorder": "is_knoll_preorder",
    "is_children_day_sale": "is_children_day_sale",
    "is_yes26_left": "is_yes26_left",
    "stylist_pick": "is_stylist_pick",
    "new": "is_new",
    "weird": "is_weird",
    "missed_sku": "missed_sku",
    # Cloudinary media URLs
    "cldr_packshot": "packshot_url",
    "cldr_id_packshot": "cldr_id_packshot",
    "cldr_packshot_alt": "cldr_packshot_alt",
    "cldr_packshot_alt__vi": "cldr_packshot_alt_vi",
    "cldr_media_long": "cldr_media_long",
    "cldr_id_media_long": "cldr_id_media_long",
    "cldr_media_long_alt": "cldr_media_long_alt",
    "cldr_media_long_alt__vi": "cldr_media_long_alt_vi",
    "cldr_media_closeup": "cldr_media_closeup",
    "cldr_id_media_closeup": "cldr_id_media_closeup",
    "cldr_media_closeup_alt": "cldr_media_closeup_alt",
    "cldr_media_closeup_alt__vi": "cldr_media_closeup_alt_vi",
    "cldr_media_lifestyle_1": "cldr_media_lifestyle_1",
    "cldr_id_media_lifestyle_1": "cldr_id_media_lifestyle_1",
    "cldr_media_lifestyle_1_alt": "cldr_media_lifestyle_1_alt",
    "cldr_media_lifestyle_1_alt__vi": "cldr_media_lifestyle_1_alt_vi",
    "cldr_media_lifestyle_2": "cldr_media_lifestyle_2",
    "cldr_id_media_lifestyle_2": "cldr_id_media_lifestyle_2",
    "cldr_media_lifestyle_2_alt": "cldr_media_lifestyle_2_alt",
    "cldr_media_lifestyle_2_alt__vi": "cldr_media_lifestyle_2_alt_vi",
    "cldr_media_illustration": "cldr_media_illustration",
    "cldr_id_media_illustration": "cldr_id_media_illustration",
    "cldr_media_info_as_image": "cldr_media_info_as_image",
    "cldr_id_media_info_as_image": "cldr_id_media_info_as_image",
    "media_info_as_image": "media_info_as_image",
    # Same-* arrays
    "same_sub_category_variant_ids": "same_sub_category_variant_ids",
    "same_designer_variant_ids": "same_designer_variant_ids",
    "same_brand_variant_ids": "same_brand_variant_ids",
    # Sku extras
    "test_sku": "test_sku",
    # Source timestamps (string from CSV, keep as text; DB also accepts timestamptz)
    "created_time": "source_created_at",
    "last_modified_time": "source_updated_at",
}

BOOL_COLUMNS = {
    "validated",
    "approved",
    "in_stock",
    "filter_collection_pk",
    "filter_collection_jaime",
    "filter_collection_balcony",
    "filter_collection_ph",
    "filter_collection_art",
    "filter_is_new_arrival",
    "filter_is_gifting_ideas",
    "is_clearance_sale",
    "is_clearance_sale_bak",
    "is_usm_sale",
    "is_knoll_preorder",
    "is_children_day_sale",
    "is_yes26_left",
    "is_stylist_pick",
    "is_new",
    "is_weird",
    "missed_sku",
}

INT_COLUMNS = {"priority", "brand_logo_size", "packshot_size"}
NUMERIC_COLUMNS = {"price", "discount_percent", "discounted_price", "compare_at_price"}
ARRAY_COLUMNS = {
    "filter_room",
    "filter_room_vi",
    "same_sub_category_variant_ids",
    "same_designer_variant_ids",
    "same_brand_variant_ids",
}
GALLERY_URL_KEYS = ("cldr_media_long", "cldr_media_closeup", "cldr_media_lifestyle_1", "cldr_media_lifestyle_2")
CLOUDINARY_ID_KEYS = (
    "cldr_id_packshot",
    "cldr_id_media_long",
    "cldr_id_media_closeup",
    "cldr_id_media_lifestyle_1",
    "cldr_id_media_lifestyle_2",
    "cldr_id_media_illustration",
    "cldr_id_media_info_as_image",
)

PRICE_RE = re.compile(r"[^\d.]")


def clean_value(raw: str) -> str:
    return (raw or "").strip()


def to_bool(raw: str) -> bool | None:
    v = clean_value(raw).lower()
    if v == "checked":
        return True
    if v == "":
        return False
    return False


def to_int(raw: str) -> int | None:
    v = clean_value(raw)
    if v == "":
        return None
    try:
        return int(v)
    except ValueError:
        return None


def to_numeric(raw: str) -> float | None:
    v = clean_value(raw)
    if v == "":
        return None
    digits = PRICE_RE.sub("", v)
    if digits == "":
        return None
    try:
        return float(digits)
    except ValueError:
        return None


def to_array(raw: str) -> list[str] | None:
    v = clean_value(raw)
    if v == "":
        return None
    return [s.strip() for s in v.split(",") if s.strip()]


def extract_url(raw: str) -> str | None:
    """Airtable cells often look like 'label (https://...)'; we want only URL."""
    v = clean_value(raw)
    if v == "":
        return None
    # find first https://
    idx = v.find("https://")
    if idx == -1:
        return v if v.startswith("http") else None
    # take until closing paren if present or end
    end = v.find(")", idx)
    if end == -1:
        return v[idx:]
    return v[idx:end]


def parse_timestamp(raw: str) -> str | None:
    """Airtable timestamp like '9/18/2023 1:37pm'. Return ISO-ish string."""
    v = clean_value(raw)
    if v == "":
        return None
    try:
        return time.strftime("%Y-%m-%d %H:%M:%S", time.strptime(v, "%m/%d/%Y %I:%M%p"))
    except ValueError:
        return None


def build_row(csv_row: dict[str, str]) -> dict[str, Any] | None:
    airtable_id = clean_value(csv_row.get("id") or "")
    if not airtable_id:
        return None

    raw_values: dict[str, Any] = {}
    for csv_col, db_col in COLUMN_MAP.items():
        raw = csv_row.get(csv_col) or ""
        if db_col in BOOL_COLUMNS:
            raw_values[db_col] = to_bool(raw)
        elif db_col in INT_COLUMNS:
            raw_values[db_col] = to_int(raw)
        elif db_col in NUMERIC_COLUMNS:
            raw_values[db_col] = to_numeric(raw)
        elif db_col in ARRAY_COLUMNS:
            arr = to_array(raw)
            raw_values[db_col] = arr
        elif db_col == "packshot_url":
            raw_values[db_col] = extract_url(raw)
        elif db_col in {"source_created_at", "source_updated_at"}:
            raw_values[db_col] = parse_timestamp(raw)
        elif db_col in {"cldr_media_long", "cldr_media_closeup", "cldr_media_lifestyle_1",
                         "cldr_media_lifestyle_2", "cldr_media_illustration",
                         "cldr_media_info_as_image", "cldr_media_long", "cldr_media_closeup",
                         "cldr_media_lifestyle_2", "media_info_as_image", "brand_cldr_logo"}:
            url = extract_url(raw)
            raw_values[db_col] = url if url else (clean_value(raw) or None)
        elif db_col == "news":
            v = clean_value(raw)
            raw_values[db_col] = v if v else None
        else:
            v = clean_value(raw)
            raw_values[db_col] = v if v != "" else None

    # Synthesize gallery_urls + cloudinary_ids from cldr_media_* + cldr_id_*
    gallery: list[str] = []
    packshot = raw_values.get("packshot_url")
    if isinstance(packshot, str) and packshot:
        gallery.append(packshot)
    for key in GALLERY_URL_KEYS:
        url = raw_values.get(key)
        if isinstance(url, str) and url:
            gallery.append(url)
    seen: set[str] = set()
    unique_gallery = [u for u in gallery if not (u in seen or seen.add(u))]
    raw_values["gallery_urls"] = unique_gallery if unique_gallery else None

    ids: list[str] = []
    for key in CLOUDINARY_ID_KEYS:
        v = raw_values.get(key)
        if isinstance(v, str) and v:
            ids.append(v)
    seen_ids: set[str] = set()
    unique_ids = [i for i in ids if not (i in seen_ids or seen_ids.add(i))]
    raw_values["cloudinary_ids"] = unique_ids if unique_ids else None

    on_sale = bool(
        raw_values.get("is_clearance_sale")
        or raw_values.get("is_usm_sale")
        or raw_values.get("is_knoll_preorder")
        or raw_values.get("is_children_day_sale")
    )
    raw_values["on_sale"] = on_sale
    if raw_values.get("discount_percent") is not None and raw_values.get("price") is not None:
        raw_values["compare_at_price"] = raw_values["price"]
        if raw_values.get("discounted_price") is not None:
            raw_values["price"] = raw_values["discounted_price"]

    for k in ("category", "brand", "designer", "sub_category",
              "sub_category_copy", "discounted_price", "news"):
        raw_values.pop(k, None)

    row: dict[str, Any] = {}
    for col in SHIPPED_COLUMNS:
        v = raw_values.get(col)
        row[col] = v

    # NOT NULL columns: pad defaults so brand-new INSERTs (airtable_id not seen before)
    # don't fail with 23502.
    if row.get("name") in (None, ""):
        row["name"] = f"Untitled variant {airtable_id}"
    if row.get("in_stock") is None:
        row["in_stock"] = False
    if row.get("on_sale") is None:
        row["on_sale"] = False
    if row.get("approved") is None:
        row["approved"] = False
    if row.get("validated") is None:
        row["validated"] = False
    if row.get("gallery_urls") is None:
        row["gallery_urls"] = []
    if row.get("cloudinary_ids") is None:
        row["cloudinary_ids"] = []
    return row


def upsert_batch(batch: list[dict[str, Any]]) -> tuple[int, str | None]:
    """Send a batch to PostgREST upsert. Returns (count, error_msg)."""
    url = f"{SUPABASE_URL}/rest/v1/{TABLE}"
    body = json.dumps(batch).encode("utf-8")
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    params = urllib.parse.urlencode({"on_conflict": "airtable_id"})
    req = urllib.request.Request(f"{url}?{params}", data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return len(batch), None
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")[:500]
        return 0, f"HTTP {e.code}: {body_text}"
    except Exception as e:
        return 0, str(e)


def main() -> int:
    print(f"Reading {CSV_PATH}")
    with open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = [build_row(r) for r in reader]
    rows = [r for r in rows if r is not None]
    print(f"Parsed {len(rows)} rows with non-empty airtable_id")

    total_ok = 0
    total_err = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i : i + BATCH]
        ok, err = upsert_batch(batch)
        if err is not None:
            total_err += len(batch)
            print(f"  batch {i // BATCH + 1}: FAIL {err}")
        else:
            total_ok += ok
            if (i // BATCH + 1) % 5 == 0:
                print(f"  upserted {total_ok}/{len(rows)}")
    print(f"Done. ok={total_ok} err={total_err}")
    return 0 if total_err == 0 else 1


if __name__ == "__main__":
    sys.exit(main())