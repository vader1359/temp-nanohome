export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      amis_sync_log: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          items_failed: number | null
          items_processed: number | null
          started_at: string | null
          status: string | null
          watermark: string | null
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          items_failed?: number | null
          items_processed?: number | null
          started_at?: string | null
          status?: string | null
          watermark?: string | null
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          items_failed?: number | null
          items_processed?: number | null
          started_at?: string | null
          status?: string | null
          watermark?: string | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          airtable_id: string | null
          approved: boolean
          created_at: string
          description: string | null
          description_vi: string | null
          id: string
          logo_url: string | null
          meta_description: string | null
          meta_title: string | null
          name: string
          origin: string | null
          origin_vi: string | null
          raw: Json
          slug: string | null
          updated_at: string
          validated: boolean
        }
        Insert: {
          airtable_id?: string | null
          approved?: boolean
          created_at?: string
          description?: string | null
          description_vi?: string | null
          id?: string
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          origin?: string | null
          origin_vi?: string | null
          raw?: Json
          slug?: string | null
          updated_at?: string
          validated?: boolean
        }
        Update: {
          airtable_id?: string | null
          approved?: boolean
          created_at?: string
          description?: string | null
          description_vi?: string | null
          id?: string
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          origin?: string | null
          origin_vi?: string | null
          raw?: Json
          slug?: string | null
          updated_at?: string
          validated?: boolean
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          quantity: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          quantity: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          quantity?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          guest_id: string | null
          id: string
          merged_from_guest_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          guest_id?: string | null
          id?: string
          merged_from_guest_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          guest_id?: string | null
          id?: string
          merged_from_guest_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      catalogs: {
        Row: {
          brand_id: string | null
          brand_name: string
          cloudinary_ids: string[]
          cloudinary_urls: string[]
          created_at: string
          file_urls: string[]
          id: string
          origin: string | null
          origin_vi: string | null
          raw: Json
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          brand_name: string
          cloudinary_ids?: string[]
          cloudinary_urls?: string[]
          created_at?: string
          file_urls?: string[]
          id?: string
          origin?: string | null
          origin_vi?: string | null
          raw?: Json
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          brand_name?: string
          cloudinary_ids?: string[]
          cloudinary_urls?: string[]
          created_at?: string
          file_urls?: string[]
          id?: string
          origin?: string | null
          origin_vi?: string | null
          raw?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          airtable_id: string | null
          approved: boolean
          created_at: string
          id: string
          meta_description: string | null
          meta_title: string | null
          name: string
          name_vi: string | null
          parent_category: string | null
          parent_id: string | null
          raw: Json
          slug: string | null
          updated_at: string
          validated: boolean
        }
        Insert: {
          airtable_id?: string | null
          approved?: boolean
          created_at?: string
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          name: string
          name_vi?: string | null
          parent_category?: string | null
          parent_id?: string | null
          raw?: Json
          slug?: string | null
          updated_at?: string
          validated?: boolean
        }
        Update: {
          airtable_id?: string | null
          approved?: boolean
          created_at?: string
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          name_vi?: string | null
          parent_category?: string | null
          parent_id?: string | null
          raw?: Json
          slug?: string | null
          updated_at?: string
          validated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      designers: {
        Row: {
          airtable_id: string | null
          approved: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          portrait_url: string | null
          priority: number | null
          raw: Json
          slug: string | null
          updated_at: string
          validated: boolean
        }
        Insert: {
          airtable_id?: string | null
          approved?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          portrait_url?: string | null
          priority?: number | null
          raw?: Json
          slug?: string | null
          updated_at?: string
          validated?: boolean
        }
        Update: {
          airtable_id?: string | null
          approved?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          portrait_url?: string | null
          priority?: number | null
          raw?: Json
          slug?: string | null
          updated_at?: string
          validated?: boolean
        }
        Relationships: []
      }
      news: {
        Row: {
          airtable_id: string | null
          approved: boolean
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          notion_url: string | null
          raw: Json
          route: string | null
          slug: string | null
          source_created_at: string | null
          title: string
          title_vi: string | null
          updated_at: string
          validated: boolean
        }
        Insert: {
          airtable_id?: string | null
          approved?: boolean
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          notion_url?: string | null
          raw?: Json
          route?: string | null
          slug?: string | null
          source_created_at?: string | null
          title: string
          title_vi?: string | null
          updated_at?: string
          validated?: boolean
        }
        Update: {
          airtable_id?: string | null
          approved?: boolean
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          notion_url?: string | null
          raw?: Json
          route?: string | null
          slug?: string | null
          source_created_at?: string | null
          title?: string
          title_vi?: string | null
          updated_at?: string
          validated?: boolean
        }
        Relationships: []
      }
      news_products: {
        Row: {
          news_id: string
          product_id: string
        }
        Insert: {
          news_id: string
          product_id: string
        }
        Update: {
          news_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_products_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      news_variants: {
        Row: {
          news_id: string
          variant_id: string
        }
        Insert: {
          news_id: string
          variant_id: string
        }
        Update: {
          news_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_variants_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_variants_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          price: number | null
          product_name: string | null
          quantity: number
          sku: string | null
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          price?: number | null
          product_name?: string | null
          quantity: number
          sku?: string | null
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          price?: number | null
          product_name?: string | null
          quantity?: number
          sku?: string | null
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          note: string | null
          order_id: string
          status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          city: string | null
          created_at: string
          district: string | null
          email: string
          full_name: string
          id: string
          note: string | null
          order_number: string
          phone: string
          status: string
          subtotal: number
          updated_at: string
          user_id: string | null
          ward: string | null
        }
        Insert: {
          address: string
          city?: string | null
          created_at?: string
          district?: string | null
          email: string
          full_name: string
          id?: string
          note?: string | null
          order_number: string
          phone: string
          status?: string
          subtotal?: number
          updated_at?: string
          user_id?: string | null
          ward?: string | null
        }
        Update: {
          address?: string
          city?: string | null
          created_at?: string
          district?: string | null
          email?: string
          full_name?: string
          id?: string
          note?: string | null
          order_number?: string
          phone?: string
          status?: string
          subtotal?: number
          updated_at?: string
          user_id?: string | null
          ward?: string | null
        }
        Relationships: []
      }
      product_designers: {
        Row: {
          designer_id: string
          product_id: string
        }
        Insert: {
          designer_id: string
          product_id: string
        }
        Update: {
          designer_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_designers_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_designers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          airtable_id: string | null
          approved: boolean
          brand_id: string | null
          category_id: string | null
          created_at: string
          description: string | null
          description_vi: string | null
          designer_id: string | null
          id: string
          media_image_url: string | null
          media_video_url: string | null
          name: string
          name_vi: string | null
          priority: number | null
          product_line: string | null
          raw: Json
          size: string | null
          slug: string | null
          slug_vi: string | null
          source_created_at: string | null
          updated_at: string
          validated: boolean
        }
        Insert: {
          airtable_id?: string | null
          approved?: boolean
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          description_vi?: string | null
          designer_id?: string | null
          id?: string
          media_image_url?: string | null
          media_video_url?: string | null
          name: string
          name_vi?: string | null
          priority?: number | null
          product_line?: string | null
          raw?: Json
          size?: string | null
          slug?: string | null
          slug_vi?: string | null
          source_created_at?: string | null
          updated_at?: string
          validated?: boolean
        }
        Update: {
          airtable_id?: string | null
          approved?: boolean
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          description_vi?: string | null
          designer_id?: string | null
          id?: string
          media_image_url?: string | null
          media_video_url?: string | null
          name?: string
          name_vi?: string | null
          priority?: number | null
          product_line?: string | null
          raw?: Json
          size?: string | null
          slug?: string | null
          slug_vi?: string | null
          source_created_at?: string | null
          updated_at?: string
          validated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          preferred_locale: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_locale?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      variants: {
        Row: {
          airtable_id: string | null
          approved: boolean
          brand_cldr_id_logo: string | null
          brand_cldr_logo: string | null
          brand_id: string | null
          brand_logo_size: number | null
          brand_name_denorm: string | null
          brand_origin: string | null
          brand_origin_vi: string | null
          category_id: string | null
          cldr_id_media_closeup: string | null
          cldr_id_media_illustration: string | null
          cldr_id_media_info_as_image: string | null
          cldr_id_media_lifestyle_1: string | null
          cldr_id_media_lifestyle_2: string | null
          cldr_id_media_long: string | null
          cldr_id_packshot: string | null
          cldr_media_closeup: string | null
          cldr_media_closeup_alt: string | null
          cldr_media_closeup_alt_vi: string | null
          cldr_media_illustration: string | null
          cldr_media_info_as_image: string | null
          cldr_media_lifestyle_1: string | null
          cldr_media_lifestyle_1_alt: string | null
          cldr_media_lifestyle_1_alt_vi: string | null
          cldr_media_lifestyle_2: string | null
          cldr_media_lifestyle_2_alt: string | null
          cldr_media_lifestyle_2_alt_vi: string | null
          cldr_media_long: string | null
          cldr_media_long_alt: string | null
          cldr_media_long_alt_vi: string | null
          cldr_packshot_alt: string | null
          cldr_packshot_alt_vi: string | null
          cloudinary_ids: string[]
          compare_at_price: number | null
          created_at: string
          description: string | null
          description_vi: string | null
          designer_cldr_id_portrait: string | null
          designer_description: string | null
          designer_description_vi: string | null
          designer_id: string | null
          designer_name: string | null
          discount_percent: number | null
          feature_text: string | null
          filter_brand: string | null
          filter_category: string | null
          filter_collection_art: boolean | null
          filter_collection_balcony: boolean | null
          filter_collection_jaime: boolean | null
          filter_collection_ph: boolean | null
          filter_collection_pk: boolean | null
          filter_is_gifting_ideas: boolean | null
          filter_is_new_arrival: boolean | null
          filter_price: string | null
          filter_price_gift: string | null
          filter_product_line: string | null
          filter_room: string[] | null
          filter_room_vi: string[] | null
          filter_sub_category: string | null
          finish: string | null
          finish_vi: string | null
          gallery_urls: string[]
          id: string
          in_stock: boolean
          is_children_day_sale: boolean | null
          is_clearance_sale: boolean | null
          is_clearance_sale_bak: boolean | null
          is_knoll_preorder: boolean | null
          is_new: boolean | null
          is_stylist_pick: boolean | null
          is_usm_sale: boolean | null
          is_weird: boolean | null
          is_yes26_left: boolean | null
          media_closeup: string | null
          media_info_as_image: string | null
          media_lifestyle_1: string | null
          media_lifestyle_2: string | null
          media_long: string | null
          meta_description: string | null
          meta_description_vi: string | null
          meta_title: string | null
          meta_title_vi: string | null
          missed_sku: boolean | null
          name: string
          name_vi: string | null
          news_id: string | null
          on_sale: boolean
          packshot_size: number | null
          packshot_url: string | null
          price: number | null
          priority: number | null
          product_id: string | null
          product_line: string | null
          product_name_denorm: string | null
          raw: Json
          same_brand_variant_ids: string[] | null
          same_designer_variant_ids: string[] | null
          same_sub_category_variant_ids: string[] | null
          short_name: string | null
          short_name_vi: string | null
          size: string | null
          sku: string | null
          slug: string | null
          slug_vi: string | null
          source_created_at: string | null
          source_updated_at: string | null
          test_sku: string | null
          updated_at: string
          validated: boolean
        }
        Insert: {
          airtable_id?: string | null
          approved?: boolean
          brand_cldr_id_logo?: string | null
          brand_cldr_logo?: string | null
          brand_id?: string | null
          brand_logo_size?: number | null
          brand_name_denorm?: string | null
          brand_origin?: string | null
          brand_origin_vi?: string | null
          category_id?: string | null
          cldr_id_media_closeup?: string | null
          cldr_id_media_illustration?: string | null
          cldr_id_media_info_as_image?: string | null
          cldr_id_media_lifestyle_1?: string | null
          cldr_id_media_lifestyle_2?: string | null
          cldr_id_media_long?: string | null
          cldr_id_packshot?: string | null
          cldr_media_closeup?: string | null
          cldr_media_closeup_alt?: string | null
          cldr_media_closeup_alt_vi?: string | null
          cldr_media_illustration?: string | null
          cldr_media_info_as_image?: string | null
          cldr_media_lifestyle_1?: string | null
          cldr_media_lifestyle_1_alt?: string | null
          cldr_media_lifestyle_1_alt_vi?: string | null
          cldr_media_lifestyle_2?: string | null
          cldr_media_lifestyle_2_alt?: string | null
          cldr_media_lifestyle_2_alt_vi?: string | null
          cldr_media_long?: string | null
          cldr_media_long_alt?: string | null
          cldr_media_long_alt_vi?: string | null
          cldr_packshot_alt?: string | null
          cldr_packshot_alt_vi?: string | null
          cloudinary_ids?: string[]
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          description_vi?: string | null
          designer_cldr_id_portrait?: string | null
          designer_description?: string | null
          designer_description_vi?: string | null
          designer_id?: string | null
          designer_name?: string | null
          discount_percent?: number | null
          feature_text?: string | null
          filter_brand?: string | null
          filter_category?: string | null
          filter_collection_art?: boolean | null
          filter_collection_balcony?: boolean | null
          filter_collection_jaime?: boolean | null
          filter_collection_ph?: boolean | null
          filter_collection_pk?: boolean | null
          filter_is_gifting_ideas?: boolean | null
          filter_is_new_arrival?: boolean | null
          filter_price?: string | null
          filter_price_gift?: string | null
          filter_product_line?: string | null
          filter_room?: string[] | null
          filter_room_vi?: string[] | null
          filter_sub_category?: string | null
          finish?: string | null
          finish_vi?: string | null
          gallery_urls?: string[]
          id?: string
          in_stock?: boolean
          is_children_day_sale?: boolean | null
          is_clearance_sale?: boolean | null
          is_clearance_sale_bak?: boolean | null
          is_knoll_preorder?: boolean | null
          is_new?: boolean | null
          is_stylist_pick?: boolean | null
          is_usm_sale?: boolean | null
          is_weird?: boolean | null
          is_yes26_left?: boolean | null
          media_closeup?: string | null
          media_info_as_image?: string | null
          media_lifestyle_1?: string | null
          media_lifestyle_2?: string | null
          media_long?: string | null
          meta_description?: string | null
          meta_description_vi?: string | null
          meta_title?: string | null
          meta_title_vi?: string | null
          missed_sku?: boolean | null
          name: string
          name_vi?: string | null
          news_id?: string | null
          on_sale?: boolean
          packshot_size?: number | null
          packshot_url?: string | null
          price?: number | null
          priority?: number | null
          product_id?: string | null
          product_line?: string | null
          product_name_denorm?: string | null
          raw?: Json
          same_brand_variant_ids?: string[] | null
          same_designer_variant_ids?: string[] | null
          same_sub_category_variant_ids?: string[] | null
          short_name?: string | null
          short_name_vi?: string | null
          size?: string | null
          sku?: string | null
          slug?: string | null
          slug_vi?: string | null
          source_created_at?: string | null
          source_updated_at?: string | null
          test_sku?: string | null
          updated_at?: string
          validated?: boolean
        }
        Update: {
          airtable_id?: string | null
          approved?: boolean
          brand_cldr_id_logo?: string | null
          brand_cldr_logo?: string | null
          brand_id?: string | null
          brand_logo_size?: number | null
          brand_name_denorm?: string | null
          brand_origin?: string | null
          brand_origin_vi?: string | null
          category_id?: string | null
          cldr_id_media_closeup?: string | null
          cldr_id_media_illustration?: string | null
          cldr_id_media_info_as_image?: string | null
          cldr_id_media_lifestyle_1?: string | null
          cldr_id_media_lifestyle_2?: string | null
          cldr_id_media_long?: string | null
          cldr_id_packshot?: string | null
          cldr_media_closeup?: string | null
          cldr_media_closeup_alt?: string | null
          cldr_media_closeup_alt_vi?: string | null
          cldr_media_illustration?: string | null
          cldr_media_info_as_image?: string | null
          cldr_media_lifestyle_1?: string | null
          cldr_media_lifestyle_1_alt?: string | null
          cldr_media_lifestyle_1_alt_vi?: string | null
          cldr_media_lifestyle_2?: string | null
          cldr_media_lifestyle_2_alt?: string | null
          cldr_media_lifestyle_2_alt_vi?: string | null
          cldr_media_long?: string | null
          cldr_media_long_alt?: string | null
          cldr_media_long_alt_vi?: string | null
          cldr_packshot_alt?: string | null
          cldr_packshot_alt_vi?: string | null
          cloudinary_ids?: string[]
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          description_vi?: string | null
          designer_cldr_id_portrait?: string | null
          designer_description?: string | null
          designer_description_vi?: string | null
          designer_id?: string | null
          designer_name?: string | null
          discount_percent?: number | null
          feature_text?: string | null
          filter_brand?: string | null
          filter_category?: string | null
          filter_collection_art?: boolean | null
          filter_collection_balcony?: boolean | null
          filter_collection_jaime?: boolean | null
          filter_collection_ph?: boolean | null
          filter_collection_pk?: boolean | null
          filter_is_gifting_ideas?: boolean | null
          filter_is_new_arrival?: boolean | null
          filter_price?: string | null
          filter_price_gift?: string | null
          filter_product_line?: string | null
          filter_room?: string[] | null
          filter_room_vi?: string[] | null
          filter_sub_category?: string | null
          finish?: string | null
          finish_vi?: string | null
          gallery_urls?: string[]
          id?: string
          in_stock?: boolean
          is_children_day_sale?: boolean | null
          is_clearance_sale?: boolean | null
          is_clearance_sale_bak?: boolean | null
          is_knoll_preorder?: boolean | null
          is_new?: boolean | null
          is_stylist_pick?: boolean | null
          is_usm_sale?: boolean | null
          is_weird?: boolean | null
          is_yes26_left?: boolean | null
          media_closeup?: string | null
          media_info_as_image?: string | null
          media_lifestyle_1?: string | null
          media_lifestyle_2?: string | null
          media_long?: string | null
          meta_description?: string | null
          meta_description_vi?: string | null
          meta_title?: string | null
          meta_title_vi?: string | null
          missed_sku?: boolean | null
          name?: string
          name_vi?: string | null
          news_id?: string | null
          on_sale?: boolean
          packshot_size?: number | null
          packshot_url?: string | null
          price?: number | null
          priority?: number | null
          product_id?: string | null
          product_line?: string | null
          product_name_denorm?: string | null
          raw?: Json
          same_brand_variant_ids?: string[] | null
          same_designer_variant_ids?: string[] | null
          same_sub_category_variant_ids?: string[] | null
          short_name?: string | null
          short_name_vi?: string | null
          size?: string | null
          sku?: string | null
          slug?: string | null
          slug_vi?: string | null
          source_created_at?: string | null
          source_updated_at?: string | null
          test_sku?: string | null
          updated_at?: string
          validated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "variants_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variants_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variants_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      pgroonga_command:
        | { Args: { groongacommand: string }; Returns: string }
        | {
            Args: { arguments: string[]; groongacommand: string }
            Returns: string
          }
      pgroonga_command_escape_value: {
        Args: { value: string }
        Returns: string
      }
      pgroonga_condition: {
        Args: {
          column_name?: string
          fuzzy_max_distance_ratio?: number
          index_name?: string
          query?: string
          schema_name?: string
          scorers?: string[]
          weights?: number[]
        }
        Returns: Database["public"]["CompositeTypes"]["pgroonga_condition"]
        SetofOptions: {
          from: "*"
          to: "pgroonga_condition"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pgroonga_equal_query_text_array: {
        Args: { query: string; targets: string[] }
        Returns: boolean
      }
      pgroonga_equal_query_text_array_condition:
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              targets: string[]
            }
            Returns: boolean
          }
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              targets: string[]
            }
            Returns: boolean
          }
      pgroonga_equal_query_varchar_array: {
        Args: { query: string; targets: string[] }
        Returns: boolean
      }
      pgroonga_equal_query_varchar_array_condition:
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              targets: string[]
            }
            Returns: boolean
          }
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              targets: string[]
            }
            Returns: boolean
          }
      pgroonga_equal_text: {
        Args: { other: string; target: string }
        Returns: boolean
      }
      pgroonga_equal_text_condition:
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              target: string
            }
            Returns: boolean
          }
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              target: string
            }
            Returns: boolean
          }
      pgroonga_equal_varchar: {
        Args: { other: string; target: string }
        Returns: boolean
      }
      pgroonga_equal_varchar_condition:
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              target: string
            }
            Returns: boolean
          }
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              target: string
            }
            Returns: boolean
          }
      pgroonga_escape:
        | {
            Args: { value: number }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pgroonga_escape(value => bool), public.pgroonga_escape(value => int8), public.pgroonga_escape(value => int2), public.pgroonga_escape(value => int4), public.pgroonga_escape(value => text), public.pgroonga_escape(value => float4), public.pgroonga_escape(value => float8), public.pgroonga_escape(value => timestamp), public.pgroonga_escape(value => timestamptz). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { value: boolean }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pgroonga_escape(value => bool), public.pgroonga_escape(value => int8), public.pgroonga_escape(value => int2), public.pgroonga_escape(value => int4), public.pgroonga_escape(value => text), public.pgroonga_escape(value => float4), public.pgroonga_escape(value => float8), public.pgroonga_escape(value => timestamp), public.pgroonga_escape(value => timestamptz). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { value: number }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pgroonga_escape(value => bool), public.pgroonga_escape(value => int8), public.pgroonga_escape(value => int2), public.pgroonga_escape(value => int4), public.pgroonga_escape(value => text), public.pgroonga_escape(value => float4), public.pgroonga_escape(value => float8), public.pgroonga_escape(value => timestamp), public.pgroonga_escape(value => timestamptz). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { value: number }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pgroonga_escape(value => bool), public.pgroonga_escape(value => int8), public.pgroonga_escape(value => int2), public.pgroonga_escape(value => int4), public.pgroonga_escape(value => text), public.pgroonga_escape(value => float4), public.pgroonga_escape(value => float8), public.pgroonga_escape(value => timestamp), public.pgroonga_escape(value => timestamptz). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { value: number }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pgroonga_escape(value => bool), public.pgroonga_escape(value => int8), public.pgroonga_escape(value => int2), public.pgroonga_escape(value => int4), public.pgroonga_escape(value => text), public.pgroonga_escape(value => float4), public.pgroonga_escape(value => float8), public.pgroonga_escape(value => timestamp), public.pgroonga_escape(value => timestamptz). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { value: number }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pgroonga_escape(value => bool), public.pgroonga_escape(value => int8), public.pgroonga_escape(value => int2), public.pgroonga_escape(value => int4), public.pgroonga_escape(value => text), public.pgroonga_escape(value => float4), public.pgroonga_escape(value => float8), public.pgroonga_escape(value => timestamp), public.pgroonga_escape(value => timestamptz). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { value: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pgroonga_escape(value => bool), public.pgroonga_escape(value => int8), public.pgroonga_escape(value => int2), public.pgroonga_escape(value => int4), public.pgroonga_escape(value => text), public.pgroonga_escape(value => float4), public.pgroonga_escape(value => float8), public.pgroonga_escape(value => timestamp), public.pgroonga_escape(value => timestamptz). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { special_characters: string; value: string }
            Returns: string
          }
        | {
            Args: { value: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pgroonga_escape(value => bool), public.pgroonga_escape(value => int8), public.pgroonga_escape(value => int2), public.pgroonga_escape(value => int4), public.pgroonga_escape(value => text), public.pgroonga_escape(value => float4), public.pgroonga_escape(value => float8), public.pgroonga_escape(value => timestamp), public.pgroonga_escape(value => timestamptz). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { value: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pgroonga_escape(value => bool), public.pgroonga_escape(value => int8), public.pgroonga_escape(value => int2), public.pgroonga_escape(value => int4), public.pgroonga_escape(value => text), public.pgroonga_escape(value => float4), public.pgroonga_escape(value => float8), public.pgroonga_escape(value => timestamp), public.pgroonga_escape(value => timestamptz). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      pgroonga_flush: { Args: { indexname: unknown }; Returns: boolean }
      pgroonga_highlight_html:
        | { Args: { keywords: string[]; target: string }; Returns: string }
        | {
            Args: { indexname: unknown; keywords: string[]; target: string }
            Returns: string
          }
        | { Args: { keywords: string[]; targets: string[] }; Returns: string[] }
        | {
            Args: { indexname: unknown; keywords: string[]; targets: string[] }
            Returns: string[]
          }
      pgroonga_index_column_name:
        | { Args: { columnindex: number; indexname: unknown }; Returns: string }
        | { Args: { columnname: string; indexname: unknown }; Returns: string }
      pgroonga_is_writable: { Args: never; Returns: boolean }
      pgroonga_list_broken_indexes: { Args: never; Returns: string[] }
      pgroonga_list_lagged_indexes: { Args: never; Returns: string[] }
      pgroonga_match_positions_byte:
        | { Args: { keywords: string[]; target: string }; Returns: number[] }
        | {
            Args: { indexname: unknown; keywords: string[]; target: string }
            Returns: number[]
          }
      pgroonga_match_positions_character:
        | { Args: { keywords: string[]; target: string }; Returns: number[] }
        | {
            Args: { indexname: unknown; keywords: string[]; target: string }
            Returns: number[]
          }
      pgroonga_match_term:
        | { Args: { target: string; term: string }; Returns: boolean }
        | { Args: { target: string[]; term: string }; Returns: boolean }
        | { Args: { target: string; term: string }; Returns: boolean }
        | { Args: { target: string[]; term: string }; Returns: boolean }
      pgroonga_match_text_array_condition:
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              target: string[]
            }
            Returns: boolean
          }
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              target: string[]
            }
            Returns: boolean
          }
      pgroonga_match_text_array_condition_with_scorers: {
        Args: {
          condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition_with_scorers"]
          target: string[]
        }
        Returns: boolean
      }
      pgroonga_match_text_condition:
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              target: string
            }
            Returns: boolean
          }
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              target: string
            }
            Returns: boolean
          }
      pgroonga_match_text_condition_with_scorers: {
        Args: {
          condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition_with_scorers"]
          target: string
        }
        Returns: boolean
      }
      pgroonga_match_varchar_condition:
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              target: string
            }
            Returns: boolean
          }
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              target: string
            }
            Returns: boolean
          }
      pgroonga_match_varchar_condition_with_scorers: {
        Args: {
          condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition_with_scorers"]
          target: string
        }
        Returns: boolean
      }
      pgroonga_normalize:
        | { Args: { target: string }; Returns: string }
        | { Args: { normalizername: string; target: string }; Returns: string }
      pgroonga_prefix_varchar_condition:
        | {
            Args: {
              conditoin: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              target: string
            }
            Returns: boolean
          }
        | {
            Args: {
              conditoin: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              target: string
            }
            Returns: boolean
          }
      pgroonga_query_escape: { Args: { query: string }; Returns: string }
      pgroonga_query_expand: {
        Args: {
          query: string
          synonymscolumnname: string
          tablename: unknown
          termcolumnname: string
        }
        Returns: string
      }
      pgroonga_query_extract_keywords: {
        Args: { index_name?: string; query: string }
        Returns: string[]
      }
      pgroonga_query_text_array_condition:
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              targets: string[]
            }
            Returns: boolean
          }
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              targets: string[]
            }
            Returns: boolean
          }
      pgroonga_query_text_array_condition_with_scorers: {
        Args: {
          condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition_with_scorers"]
          targets: string[]
        }
        Returns: boolean
      }
      pgroonga_query_text_condition:
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              target: string
            }
            Returns: boolean
          }
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              target: string
            }
            Returns: boolean
          }
      pgroonga_query_text_condition_with_scorers: {
        Args: {
          condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition_with_scorers"]
          target: string
        }
        Returns: boolean
      }
      pgroonga_query_varchar_condition:
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_condition"]
              target: string
            }
            Returns: boolean
          }
        | {
            Args: {
              condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition"]
              target: string
            }
            Returns: boolean
          }
      pgroonga_query_varchar_condition_with_scorers: {
        Args: {
          condition: Database["public"]["CompositeTypes"]["pgroonga_full_text_search_condition_with_scorers"]
          target: string
        }
        Returns: boolean
      }
      pgroonga_regexp_text_array: {
        Args: { pattern: string; targets: string[] }
        Returns: boolean
      }
      pgroonga_regexp_text_array_condition: {
        Args: {
          pattern: Database["public"]["CompositeTypes"]["pgroonga_condition"]
          targets: string[]
        }
        Returns: boolean
      }
      pgroonga_result_to_jsonb_objects: {
        Args: { result: Json }
        Returns: Json
      }
      pgroonga_result_to_recordset: {
        Args: { result: Json }
        Returns: Record<string, unknown>[]
      }
      pgroonga_score:
        | { Args: { row: Record<string, unknown> }; Returns: number }
        | { Args: { ctid: unknown; tableoid: unknown }; Returns: number }
      pgroonga_set_writable: {
        Args: { newwritable: boolean }
        Returns: boolean
      }
      pgroonga_snippet_html: {
        Args: { keywords: string[]; target: string; width?: number }
        Returns: string[]
      }
      pgroonga_table_name: { Args: { indexname: unknown }; Returns: string }
      pgroonga_tokenize: {
        Args: { options: string[]; target: string }
        Returns: Json[]
      }
      pgroonga_vacuum: { Args: never; Returns: boolean }
      pgroonga_wal_apply:
        | { Args: never; Returns: number }
        | { Args: { indexname: unknown }; Returns: number }
      pgroonga_wal_set_applied_position:
        | { Args: never; Returns: boolean }
        | { Args: { block: number; offset: number }; Returns: boolean }
        | { Args: { indexname: unknown }; Returns: boolean }
        | {
            Args: { block: number; indexname: unknown; offset: number }
            Returns: boolean
          }
      pgroonga_wal_status: {
        Args: never
        Returns: {
          current_block: number
          current_offset: number
          current_size: number
          last_block: number
          last_offset: number
          last_size: number
          name: string
          oid: unknown
        }[]
      }
      pgroonga_wal_truncate:
        | { Args: never; Returns: number }
        | { Args: { indexname: unknown }; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      pgroonga_condition: {
        query: string | null
        weigths: number[] | null
        scorers: string[] | null
        schema_name: string | null
        index_name: string | null
        column_name: string | null
        fuzzy_max_distance_ratio: number | null
      }
      pgroonga_full_text_search_condition: {
        query: string | null
        weigths: number[] | null
        indexname: string | null
      }
      pgroonga_full_text_search_condition_with_scorers: {
        query: string | null
        weigths: number[] | null
        scorers: string[] | null
        indexname: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
