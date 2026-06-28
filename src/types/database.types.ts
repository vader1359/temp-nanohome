export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      amis_sync_log: Table<{
        error: string | null;
        finished_at: string | null;
        id: string;
        items_failed: number | null;
        items_processed: number | null;
        started_at: string | null;
        status: string | null;
        watermark: string | null;
      }>;
      brands: Table<{
        airtable_id: string | null;
        approved: boolean;
        created_at: string;
        description: string | null;
        description_vi: string | null;
        id: string;
        logo_url: string | null;
        meta_description: string | null;
        meta_title: string | null;
        name: string;
        origin: string | null;
        origin_vi: string | null;
        raw: Json;
        slug: string | null;
        updated_at: string;
        validated: boolean;
      }>;
      cart_items: Table<{
        cart_id: string;
        created_at: string;
        id: string;
        quantity: number;
        updated_at: string;
        variant_id: string;
      }>;
      carts: Table<{
        created_at: string;
        guest_id: string | null;
        id: string;
        merged_from_guest_id: string | null;
        updated_at: string;
        user_id: string | null;
      }>;
      catalogs: Table<{
        brand_id: string | null;
        brand_name: string;
        cloudinary_ids: string[];
        cloudinary_urls: string[];
        created_at: string;
        file_urls: string[];
        id: string;
        origin: string | null;
        origin_vi: string | null;
        raw: Json;
        updated_at: string;
      }>;
      categories: Table<{
        airtable_id: string | null;
        approved: boolean;
        created_at: string;
        id: string;
        meta_description: string | null;
        meta_title: string | null;
        name: string;
        name_vi: string | null;
        parent_category: string | null;
        parent_id: string | null;
        raw: Json;
        slug: string | null;
        updated_at: string;
        validated: boolean;
      }>;
      designers: Table<{
        airtable_id: string | null;
        approved: boolean;
        created_at: string;
        description: string | null;
        id: string;
        name: string;
        portrait_url: string | null;
        priority: number | null;
        raw: Json;
        slug: string | null;
        updated_at: string;
        validated: boolean;
      }>;
      news: Table<{
        airtable_id: string | null;
        approved: boolean;
        cover_url: string | null;
        created_at: string;
        description: string | null;
        id: string;
        meta_description: string | null;
        meta_title: string | null;
        notion_url: string | null;
        raw: Json;
        route: string | null;
        slug: string | null;
        source_created_at: string | null;
        title: string;
        title_vi: string | null;
        updated_at: string;
        validated: boolean;
      }>;
      news_products: Table<{ news_id: string; product_id: string }>;
      news_variants: Table<{ news_id: string; variant_id: string }>;
      order_items: Table<{
        created_at: string;
        id: string;
        order_id: string;
        price: number | null;
        product_name: string | null;
        quantity: number;
        sku: string | null;
        variant_id: string | null;
        variant_name: string | null;
      }>;
      orders: Table<{
        address: string;
        city: string | null;
        created_at: string;
        district: string | null;
        email: string;
        full_name: string;
        id: string;
        note: string | null;
        order_number: string;
        phone: string;
        status: string;
        subtotal: number;
        updated_at: string;
        user_id: string | null;
        ward: string | null;
      }>;
      product_designers: Table<{ designer_id: string; product_id: string }>;
      products: Table<{
        airtable_id: string | null;
        approved: boolean;
        brand_id: string | null;
        category_id: string | null;
        created_at: string;
        description: string | null;
        description_vi: string | null;
        designer_id: string | null;
        id: string;
        media_image_url: string | null;
        media_video_url: string | null;
        name: string;
        name_vi: string | null;
        priority: number | null;
        product_line: string | null;
        raw: Json;
        size: string | null;
        slug: string | null;
        slug_vi: string | null;
        source_created_at: string | null;
        updated_at: string;
        validated: boolean;
      }>;
      profiles: Table<{
        avatar_url: string | null;
        created_at: string;
        email: string | null;
        full_name: string | null;
        id: string;
        phone: string | null;
        preferred_locale: string;
        updated_at: string;
      }>;
      variants: Table<{
        airtable_id: string | null;
        approved: boolean;
        brand_id: string | null;
        category_id: string | null;
        cloudinary_ids: string[];
        compare_at_price: number | null;
        created_at: string;
        designer_id: string | null;
        discount_percent: number | null;
        finish: string | null;
        finish_vi: string | null;
        gallery_urls: string[];
        id: string;
        in_stock: boolean;
        meta_description: string | null;
        meta_title: string | null;
        name: string;
        on_sale: boolean;
        packshot_url: string | null;
        price: number | null;
        priority: number | null;
        product_id: string | null;
        raw: Json;
        size: string | null;
        sku: string | null;
        slug: string | null;
        slug_vi: string | null;
        source_created_at: string | null;
        source_updated_at: string | null;
        updated_at: string;
        validated: boolean;
      }>;
    };
    Views: EmptyRecord;
    Functions: { pgroonga_query_escape: { Args: { query: string }; Returns: string } };
    Enums: EmptyRecord;
    CompositeTypes: EmptyRecord;
  };
};

type Table<Row> = {
  Row: { [Column in keyof Row]: Row[Column] } & Record<string, unknown>;
  Insert: { [Column in keyof Row]?: Row[Column] } & Record<string, unknown>;
  Update: { [Column in keyof Row]?: Row[Column] } & Record<string, unknown>;
  Relationships: [];
};

type EmptyRecord = { [_ in never]: never };
type PublicSchema = Database["public"];
type PublicTableName = keyof PublicSchema["Tables"];

export type Tables<TableName extends PublicTableName> = PublicSchema["Tables"][TableName]["Row"];
export type TablesInsert<TableName extends PublicTableName> = PublicSchema["Tables"][TableName]["Insert"];
export type TablesUpdate<TableName extends PublicTableName> = PublicSchema["Tables"][TableName]["Update"];
