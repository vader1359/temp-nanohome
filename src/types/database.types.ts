export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_policy_acceptances: {
        Row: {
          accepted_at: string
          account_id: string
          id: string
          policy_kind: string
          policy_version: string
        }
        Insert: {
          accepted_at?: string
          account_id: string
          id?: string
          policy_kind: string
          policy_version: string
        }
        Update: {
          accepted_at?: string
          account_id?: string
          id?: string
          policy_kind?: string
          policy_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_policy_acceptances_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chunks: {
        Row: {
          created_at: string
          heading_path: string[]
          id: string
          is_active: boolean
          lexical_index: unknown
          locale: string
          position: number
          source_hash: string
          source_id: string
          text_content: string
        }
        Insert: {
          created_at?: string
          heading_path?: string[]
          id?: string
          is_active?: boolean
          lexical_index?: unknown
          locale: string
          position: number
          source_hash: string
          source_id: string
          text_content: string
        }
        Update: {
          created_at?: string
          heading_path?: string[]
          id?: string
          is_active?: boolean
          lexical_index?: unknown
          locale?: string
          position?: number
          source_hash?: string
          source_id?: string
          text_content?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chunks_source_id_locale_fkey"
            columns: ["source_id", "locale"]
            isOneToOne: false
            referencedRelation: "ai_sources"
            referencedColumns: ["id", "locale"]
          },
        ]
      }
      ai_sources: {
        Row: {
          approval_state: string
          canonical_url: string
          content_hash: string
          created_at: string
          id: string
          ingestion_version: string
          is_active: boolean
          locale: string
          source_key: string
          source_type: string
          source_updated_at: string | null
          superseded_by: string | null
          visibility: string
        }
        Insert: {
          approval_state?: string
          canonical_url: string
          content_hash: string
          created_at?: string
          id?: string
          ingestion_version: string
          is_active?: boolean
          locale: string
          source_key: string
          source_type: string
          source_updated_at?: string | null
          superseded_by?: string | null
          visibility?: string
        }
        Update: {
          approval_state?: string
          canonical_url?: string
          content_hash?: string
          created_at?: string
          id?: string
          ingestion_version?: string
          is_active?: boolean
          locale?: string
          source_key?: string
          source_type?: string
          source_updated_at?: string | null
          superseded_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_sources_superseded_scope_fk"
            columns: ["superseded_by", "source_type", "locale"]
            isOneToOne: false
            referencedRelation: "ai_sources"
            referencedColumns: ["id", "source_type", "locale"]
          },
        ]
      }
      amis_contact_snapshots: {
        Row: {
          amis_contact_code: string | null
          amis_contact_id: string
          amis_customer_id: string
          contact_role: string
          fetched_at: string
          mapper_version: string
          payload_digest: string
          source_created_at: string | null
          source_state: string
          source_updated_at: string
        }
        Insert: {
          amis_contact_code?: string | null
          amis_contact_id: string
          amis_customer_id: string
          contact_role?: string
          fetched_at?: string
          mapper_version: string
          payload_digest: string
          source_created_at?: string | null
          source_state: string
          source_updated_at: string
        }
        Update: {
          amis_contact_code?: string | null
          amis_contact_id?: string
          amis_customer_id?: string
          contact_role?: string
          fetched_at?: string
          mapper_version?: string
          payload_digest?: string
          source_created_at?: string | null
          source_state?: string
          source_updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amis_contact_snapshots_amis_customer_id_fkey"
            columns: ["amis_customer_id"]
            isOneToOne: false
            referencedRelation: "amis_customer_snapshots"
            referencedColumns: ["amis_customer_id"]
          },
        ]
      }
      amis_customer_snapshots: {
        Row: {
          amis_customer_id: string
          customer_since_bucket: string | null
          customer_type: string | null
          customer_visible_summary: string | null
          fetched_at: string
          mapper_version: string
          payload_digest: string
          preferred_brand_ids: string[]
          preferred_room_ids: string[]
          project_stage: string | null
          source_state: string
          source_updated_at: string
        }
        Insert: {
          amis_customer_id: string
          customer_since_bucket?: string | null
          customer_type?: string | null
          customer_visible_summary?: string | null
          fetched_at?: string
          mapper_version: string
          payload_digest: string
          preferred_brand_ids?: string[]
          preferred_room_ids?: string[]
          project_stage?: string | null
          source_state: string
          source_updated_at: string
        }
        Update: {
          amis_customer_id?: string
          customer_since_bucket?: string | null
          customer_type?: string | null
          customer_visible_summary?: string | null
          fetched_at?: string
          mapper_version?: string
          payload_digest?: string
          preferred_brand_ids?: string[]
          preferred_room_ids?: string[]
          project_stage?: string | null
          source_state?: string
          source_updated_at?: string
        }
        Relationships: []
      }
      amis_inventory_baseline_lines: {
        Row: {
          baseline_id: string
          sku: string
          stock: number
        }
        Insert: {
          baseline_id: string
          sku: string
          stock: number
        }
        Update: {
          baseline_id?: string
          sku?: string
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "amis_inventory_baseline_lines_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "amis_inventory_baselines"
            referencedColumns: ["id"]
          },
        ]
      }
      amis_inventory_baselines: {
        Row: {
          completed_at: string
          id: string
          is_active: boolean
        }
        Insert: {
          completed_at: string
          id?: string
          is_active?: boolean
        }
        Update: {
          completed_at?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      amis_inventory_sync_state: {
        Row: {
          active_baseline_id: string | null
          sale_order_watermark: string | null
          sync_key: string
        }
        Insert: {
          active_baseline_id?: string | null
          sale_order_watermark?: string | null
          sync_key: string
        }
        Update: {
          active_baseline_id?: string | null
          sale_order_watermark?: string | null
          sync_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "amis_inventory_sync_state_active_baseline_id_fkey"
            columns: ["active_baseline_id"]
            isOneToOne: false
            referencedRelation: "amis_inventory_baselines"
            referencedColumns: ["id"]
          },
        ]
      }
      amis_sale_order_lines: {
        Row: {
          amis_line_id: number
          amis_order_id: number
          amount: number | null
          is_deleted: boolean
          is_note_row: boolean
          produced_quantity: number | null
          sku: string | null
          total_amount_delivered: number | null
        }
        Insert: {
          amis_line_id: number
          amis_order_id: number
          amount?: number | null
          is_deleted?: boolean
          is_note_row: boolean
          produced_quantity?: number | null
          sku?: string | null
          total_amount_delivered?: number | null
        }
        Update: {
          amis_line_id?: number
          amis_order_id?: number
          amount?: number | null
          is_deleted?: boolean
          is_note_row?: boolean
          produced_quantity?: number | null
          sku?: string | null
          total_amount_delivered?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "amis_sale_order_lines_amis_order_id_fkey"
            columns: ["amis_order_id"]
            isOneToOne: false
            referencedRelation: "amis_sale_orders"
            referencedColumns: ["amis_order_id"]
          },
        ]
      }
      amis_sale_order_summaries: {
        Row: {
          amis_customer_id: string
          amis_sale_order_id: string
          mapper_version: string
          payload_digest: string
          purchased_variant_ids: string[]
          source_state: string
          source_updated_at: string
        }
        Insert: {
          amis_customer_id: string
          amis_sale_order_id: string
          mapper_version: string
          payload_digest: string
          purchased_variant_ids?: string[]
          source_state: string
          source_updated_at: string
        }
        Update: {
          amis_customer_id?: string
          amis_sale_order_id?: string
          mapper_version?: string
          payload_digest?: string
          purchased_variant_ids?: string[]
          source_state?: string
          source_updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amis_sale_order_summaries_amis_customer_id_fkey"
            columns: ["amis_customer_id"]
            isOneToOne: false
            referencedRelation: "amis_customer_snapshots"
            referencedColumns: ["amis_customer_id"]
          },
        ]
      }
      amis_sale_orders: {
        Row: {
          amis_order_id: number
          approved_date: string | null
          approved_status: string | null
          is_deleted: boolean
          modified_date: string
          status: string | null
        }
        Insert: {
          amis_order_id: number
          approved_date?: string | null
          approved_status?: string | null
          is_deleted: boolean
          modified_date: string
          status?: string | null
        }
        Update: {
          amis_order_id?: number
          approved_date?: string | null
          approved_status?: string | null
          is_deleted?: boolean
          modified_date?: string
          status?: string | null
        }
        Relationships: []
      }
      amis_sync_cursors: {
        Row: {
          entity: string
          last_success_at: string | null
          run_id: string | null
          updated_at: string
          watermark: string | null
        }
        Insert: {
          entity: string
          last_success_at?: string | null
          run_id?: string | null
          updated_at?: string
          watermark?: string | null
        }
        Update: {
          entity?: string
          last_success_at?: string | null
          run_id?: string | null
          updated_at?: string
          watermark?: string | null
        }
        Relationships: []
      }
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
          description_ko: string | null
          description_vi: string | null
          id: string
          logo_url: string | null
          meta_description: string | null
          meta_title: string | null
          name: string
          origin: string | null
          origin_ko: string | null
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
          description_ko?: string | null
          description_vi?: string | null
          id?: string
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          origin?: string | null
          origin_ko?: string | null
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
          description_ko?: string | null
          description_vi?: string | null
          id?: string
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          origin?: string | null
          origin_ko?: string | null
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
            referencedRelation: "catalog_eligibility"
            referencedColumns: ["variant_id"]
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
          account_id: string | null
          created_at: string
          guest_id: string | null
          id: string
          merged_from_guest_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          guest_id?: string | null
          id?: string
          merged_from_guest_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string
          guest_id?: string | null
          id?: string
          merged_from_guest_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
        ]
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
          origin_ko: string | null
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
          origin_ko?: string | null
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
          origin_ko?: string | null
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
          {
            foreignKeyName: "catalogs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "catalog_eligibility"
            referencedColumns: ["brand_id"]
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
          name_ko: string | null
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
          name_ko?: string | null
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
          name_ko?: string | null
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
      chat_answer_evidence: {
        Row: {
          created_at: string
          id: string
          message_id: string
          model_version: string
          prompt_version: string
          source_id: string | null
          tool_result_digest: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          model_version: string
          prompt_version: string
          source_id?: string | null
          tool_result_digest?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          model_version?: string
          prompt_version?: string
          source_id?: string | null
          tool_result_digest?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_answer_evidence_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_answer_evidence_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "ai_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_attachment_intents: {
        Row: {
          confirmed_at: string | null
          conversation_id: string
          expected_mime_type: string
          expires_at: string
          guest_owner_scope_id: string | null
          id: string
          owner_account_id: string | null
          owner_scope: string
          requested_at: string
          state: string
        }
        Insert: {
          confirmed_at?: string | null
          conversation_id: string
          expected_mime_type: string
          expires_at: string
          guest_owner_scope_id?: string | null
          id?: string
          owner_account_id?: string | null
          owner_scope: string
          requested_at?: string
          state?: string
        }
        Update: {
          confirmed_at?: string | null
          conversation_id?: string
          expected_mime_type?: string
          expires_at?: string
          guest_owner_scope_id?: string | null
          id?: string
          owner_account_id?: string | null
          owner_scope?: string
          requested_at?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_attachment_intents_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_attachments: {
        Row: {
          byte_size: number
          conversation_id: string
          created_at: string
          deleted_at: string | null
          deletion_reason: string | null
          guest_owner_scope_id: string | null
          handoff_id: string | null
          id: string
          intent_id: string
          mime_type: string
          normalized_object_path: string | null
          object_path: string
          owner_account_id: string | null
          owner_scope: string
          retention_expires_at: string
          sha256_digest: string
          state: string
        }
        Insert: {
          byte_size: number
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          deletion_reason?: string | null
          guest_owner_scope_id?: string | null
          handoff_id?: string | null
          id?: string
          intent_id: string
          mime_type: string
          normalized_object_path?: string | null
          object_path: string
          owner_account_id?: string | null
          owner_scope: string
          retention_expires_at: string
          sha256_digest: string
          state?: string
        }
        Update: {
          byte_size?: number
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          deletion_reason?: string | null
          guest_owner_scope_id?: string | null
          handoff_id?: string | null
          id?: string
          intent_id?: string
          mime_type?: string
          normalized_object_path?: string | null
          object_path?: string
          owner_account_id?: string | null
          owner_scope?: string
          retention_expires_at?: string
          sha256_digest?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_attachments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_attachments_handoff_id_fkey"
            columns: ["handoff_id"]
            isOneToOne: false
            referencedRelation: "customer_advisor_handoffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_attachments_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "chat_attachment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          content_blocks: Json
          conversation_id: string
          created_at: string
          expires_at: string
          id: string
          message_ref: string | null
          model_version: string | null
          prompt_version: string | null
          role: string
          tool_trace_ref: string | null
        }
        Insert: {
          content: string
          content_blocks?: Json
          conversation_id: string
          created_at?: string
          expires_at: string
          id?: string
          message_ref?: string | null
          model_version?: string | null
          prompt_version?: string | null
          role: string
          tool_trace_ref?: string | null
        }
        Update: {
          content?: string
          content_blocks?: Json
          conversation_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          message_ref?: string | null
          model_version?: string | null
          prompt_version?: string | null
          role?: string
          tool_trace_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_checkouts: {
        Row: {
          amis_sale_order_id: string | null
          app_trans_id: string | null
          callback_digest: string | null
          created_at: string
          id: string
          idempotency_key: string
          owner_scope: string
          payload_hash: string
          status: string
          updated_at: string
          web_order_id: string
          zp_trans_id: string | null
        }
        Insert: {
          amis_sale_order_id?: string | null
          app_trans_id?: string | null
          callback_digest?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          owner_scope: string
          payload_hash: string
          status?: string
          updated_at?: string
          web_order_id: string
          zp_trans_id?: string | null
        }
        Update: {
          amis_sale_order_id?: string | null
          app_trans_id?: string | null
          callback_digest?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          owner_scope?: string
          payload_hash?: string
          status?: string
          updated_at?: string
          web_order_id?: string
          zp_trans_id?: string | null
        }
        Relationships: []
      }
      commerce_inventory_holds: {
        Row: {
          checkout_id: string
          created_at: string
          expires_at: string
          id: string
          quantity: number
          raw_sku: string
          status: string
          warehouse: string
        }
        Insert: {
          checkout_id: string
          created_at?: string
          expires_at?: string
          id?: string
          quantity: number
          raw_sku: string
          status?: string
          warehouse: string
        }
        Update: {
          checkout_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          quantity?: number
          raw_sku?: string
          status?: string
          warehouse?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_inventory_holds_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "commerce_checkouts"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_payment_ledger: {
        Row: {
          amount: number
          app_trans_id: string
          callback_digest: string | null
          checkout_id: string
          currency: string
          event: string
          id: number
          recorded_at: string
          zp_trans_id: string | null
        }
        Insert: {
          amount: number
          app_trans_id: string
          callback_digest?: string | null
          checkout_id: string
          currency?: string
          event: string
          id?: never
          recorded_at?: string
          zp_trans_id?: string | null
        }
        Update: {
          amount?: number
          app_trans_id?: string
          callback_digest?: string | null
          checkout_id?: string
          currency?: string
          event?: string
          id?: never
          recorded_at?: string
          zp_trans_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commerce_payment_ledger_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "commerce_checkouts"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_refund_ledger: {
        Row: {
          actor: string
          amount: number
          callback_digest: string | null
          checkout_id: string
          currency: string
          event: string
          id: number
          m_refund_id: string
          provider_status: string | null
          reason: string
          recorded_at: string
          request_digest: string
          zp_trans_id: string
        }
        Insert: {
          actor: string
          amount: number
          callback_digest?: string | null
          checkout_id: string
          currency?: string
          event: string
          id?: never
          m_refund_id: string
          provider_status?: string | null
          reason: string
          recorded_at?: string
          request_digest: string
          zp_trans_id: string
        }
        Update: {
          actor?: string
          amount?: number
          callback_digest?: string | null
          checkout_id?: string
          currency?: string
          event?: string
          id?: never
          m_refund_id?: string
          provider_status?: string | null
          reason?: string
          recorded_at?: string
          request_digest?: string
          zp_trans_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_refund_ledger_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "commerce_checkouts"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          consent_expires_at: string
          consent_version: string
          conversation_storage_enabled: boolean
          created_at: string
          guest_owner_scope_expires_at: string | null
          guest_owner_scope_id: string | null
          guest_owner_token_digest: string | null
          id: string
          locale: string
          owner_account_id: string | null
          owner_id: string | null
          owner_scope: string
          retention_expires_at: string
          state: string
          updated_at: string
        }
        Insert: {
          consent_expires_at: string
          consent_version: string
          conversation_storage_enabled?: boolean
          created_at?: string
          guest_owner_scope_expires_at?: string | null
          guest_owner_scope_id?: string | null
          guest_owner_token_digest?: string | null
          id?: string
          locale: string
          owner_account_id?: string | null
          owner_id?: string | null
          owner_scope: string
          retention_expires_at: string
          state?: string
          updated_at?: string
        }
        Update: {
          consent_expires_at?: string
          consent_version?: string
          conversation_storage_enabled?: boolean
          created_at?: string
          guest_owner_scope_expires_at?: string | null
          guest_owner_scope_id?: string | null
          guest_owner_token_digest?: string | null
          id?: string
          locale?: string
          owner_account_id?: string | null
          owner_id?: string | null
          owner_scope?: string
          retention_expires_at?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_account_deletion_requests: {
        Row: {
          account_id: string
          completed_at: string | null
          id: string
          requested_at: string
          status: string
        }
        Insert: {
          account_id: string
          completed_at?: string | null
          id?: string
          requested_at?: string
          status?: string
        }
        Update: {
          account_id?: string
          completed_at?: string | null
          id?: string
          requested_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_account_deletion_requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_accounts: {
        Row: {
          created_at: string
          id: string
          legacy_supabase_user_id: string | null
          state: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          legacy_supabase_user_id?: string | null
          state?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          legacy_supabase_user_id?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_advisor_handoff_events: {
        Row: {
          actor_reference: string
          event_type: string
          from_status: string
          handoff_id: string
          id: number
          recorded_at: string
          safe_reason: string | null
          to_status: string
        }
        Insert: {
          actor_reference: string
          event_type: string
          from_status: string
          handoff_id: string
          id?: never
          recorded_at?: string
          safe_reason?: string | null
          to_status: string
        }
        Update: {
          actor_reference?: string
          event_type?: string
          from_status?: string
          handoff_id?: string
          id?: never
          recorded_at?: string
          safe_reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_advisor_handoff_events_handoff_id_fkey"
            columns: ["handoff_id"]
            isOneToOne: false
            referencedRelation: "customer_advisor_handoffs"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_advisor_handoff_summaries: {
        Row: {
          created_at: string
          handoff_id: string
          id: number
          last_message_id: string | null
          product_ids: string[]
          room_style_signals: Json | null
          safe_summary: string
          stated_budget: string | null
          stated_timeline: string | null
          structured_intent: Json | null
          summary_version: string
          unresolved_questions: Json | null
          variant_ids: string[]
          vision_scene_id: string | null
        }
        Insert: {
          created_at?: string
          handoff_id: string
          id?: never
          last_message_id?: string | null
          product_ids?: string[]
          room_style_signals?: Json | null
          safe_summary: string
          stated_budget?: string | null
          stated_timeline?: string | null
          structured_intent?: Json | null
          summary_version: string
          unresolved_questions?: Json | null
          variant_ids?: string[]
          vision_scene_id?: string | null
        }
        Update: {
          created_at?: string
          handoff_id?: string
          id?: never
          last_message_id?: string | null
          product_ids?: string[]
          room_style_signals?: Json | null
          safe_summary?: string
          stated_budget?: string | null
          stated_timeline?: string | null
          structured_intent?: Json | null
          summary_version?: string
          unresolved_questions?: Json | null
          variant_ids?: string[]
          vision_scene_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_advisor_handoff_summaries_handoff_id_fkey"
            columns: ["handoff_id"]
            isOneToOne: false
            referencedRelation: "customer_advisor_handoffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_advisor_handoff_summaries_last_message_id_fkey"
            columns: ["last_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_advisor_handoff_summaries_vision_scene_id_fkey"
            columns: ["vision_scene_id"]
            isOneToOne: false
            referencedRelation: "room_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_advisor_handoffs: {
        Row: {
          amis_customer_link_id: string | null
          assigned_advisor_id: string | null
          assigned_at: string | null
          closed_at: string | null
          conversation_id: string
          created_at: string
          first_responded_at: string | null
          first_response_due_at: string
          guest_owner_scope_id: string | null
          id: string
          owner_account_id: string | null
          owner_scope: string
          priority: string
          public_reference: string
          reason_code: string
          requested_contact_at: string | null
          requested_contact_channel: string | null
          restricted_contact_reference: string | null
          status: string
        }
        Insert: {
          amis_customer_link_id?: string | null
          assigned_advisor_id?: string | null
          assigned_at?: string | null
          closed_at?: string | null
          conversation_id: string
          created_at?: string
          first_responded_at?: string | null
          first_response_due_at: string
          guest_owner_scope_id?: string | null
          id?: string
          owner_account_id?: string | null
          owner_scope: string
          priority?: string
          public_reference: string
          reason_code: string
          requested_contact_at?: string | null
          requested_contact_channel?: string | null
          restricted_contact_reference?: string | null
          status?: string
        }
        Update: {
          amis_customer_link_id?: string | null
          assigned_advisor_id?: string | null
          assigned_at?: string | null
          closed_at?: string | null
          conversation_id?: string
          created_at?: string
          first_responded_at?: string | null
          first_response_due_at?: string
          guest_owner_scope_id?: string | null
          id?: string
          owner_account_id?: string | null
          owner_scope?: string
          priority?: string
          public_reference?: string
          reason_code?: string
          requested_contact_at?: string | null
          requested_contact_channel?: string | null
          restricted_contact_reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_advisor_handoffs_amis_customer_link_id_fkey"
            columns: ["amis_customer_link_id"]
            isOneToOne: false
            referencedRelation: "customer_amis_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_advisor_handoffs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_advisor_notification_outbox: {
        Row: {
          attempt_count: number
          created_at: string
          delivered_at: string | null
          delivery_status: string
          destination_adapter: string
          handoff_id: string
          id: number
          next_retry_at: string | null
          response_digest: string | null
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string
          destination_adapter: string
          handoff_id: string
          id?: never
          next_retry_at?: string | null
          response_digest?: string | null
        }
        Update: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string
          destination_adapter?: string
          handoff_id?: string
          id?: never
          next_retry_at?: string | null
          response_digest?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_advisor_notification_outbox_handoff_id_fkey"
            columns: ["handoff_id"]
            isOneToOne: false
            referencedRelation: "customer_advisor_handoffs"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_affinities: {
        Row: {
          algorithm_version: string
          consent_ledger_id: number | null
          decayed_at: string
          deleted_at: string | null
          distinct_session_count: number
          expires_at: string
          feature_key: string
          feature_type: string
          id: string
          last_evidence_at: string
          score: number
          support_count: number
          suppressed_at: string | null
          updated_at: string
          visitor_id: string
          window_started_at: string
        }
        Insert: {
          algorithm_version: string
          consent_ledger_id?: number | null
          decayed_at?: string
          deleted_at?: string | null
          distinct_session_count: number
          expires_at: string
          feature_key: string
          feature_type: string
          id?: string
          last_evidence_at: string
          score: number
          support_count: number
          suppressed_at?: string | null
          updated_at?: string
          visitor_id: string
          window_started_at: string
        }
        Update: {
          algorithm_version?: string
          consent_ledger_id?: number | null
          decayed_at?: string
          deleted_at?: string | null
          distinct_session_count?: number
          expires_at?: string
          feature_key?: string
          feature_type?: string
          id?: string
          last_evidence_at?: string
          score?: number
          support_count?: number
          suppressed_at?: string | null
          updated_at?: string
          visitor_id?: string
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_affinities_consent_ledger_id_fkey"
            columns: ["consent_ledger_id"]
            isOneToOne: false
            referencedRelation: "customer_consent_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_affinities_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "customer_visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_amis_links: {
        Row: {
          account_id: string | null
          actor_id: string | null
          amis_customer_id: string
          created_at: string
          evidence_category: string
          id: string
          method: string
          review_reason: string | null
          revoked_at: string | null
          state: string
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          account_id?: string | null
          actor_id?: string | null
          amis_customer_id: string
          created_at?: string
          evidence_category: string
          id?: string
          method: string
          review_reason?: string | null
          revoked_at?: string | null
          state: string
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          account_id?: string | null
          actor_id?: string | null
          amis_customer_id?: string
          created_at?: string
          evidence_category?: string
          id?: string
          method?: string
          review_reason?: string | null
          revoked_at?: string | null
          state?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_amis_links_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_auth_identities: {
        Row: {
          account_id: string
          created_at: string
          id: string
          provider: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          provider: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          provider?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_auth_identities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_auth_identities_provider_fkey"
            columns: ["provider"]
            isOneToOne: false
            referencedRelation: "customer_identity_providers"
            referencedColumns: ["provider"]
          },
        ]
      }
      customer_consent_current: {
        Row: {
          actor: string
          ai_conversation_storage: boolean
          ai_processing: boolean
          analytics: boolean
          consent_ledger_id: number
          locale: string
          marketing: boolean
          personalization: boolean
          policy_version: string
          recorded_at: string
          room_image_processing: boolean
          room_image_storage: boolean
          source: string
          visitor_id: string
          withdrawal_reason: string | null
          withdrawn_at: string | null
        }
        Insert: {
          actor: string
          ai_conversation_storage: boolean
          ai_processing: boolean
          analytics: boolean
          consent_ledger_id: number
          locale: string
          marketing: boolean
          personalization: boolean
          policy_version: string
          recorded_at: string
          room_image_processing: boolean
          room_image_storage: boolean
          source: string
          visitor_id: string
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          actor?: string
          ai_conversation_storage?: boolean
          ai_processing?: boolean
          analytics?: boolean
          consent_ledger_id?: number
          locale?: string
          marketing?: boolean
          personalization?: boolean
          policy_version?: string
          recorded_at?: string
          room_image_processing?: boolean
          room_image_storage?: boolean
          source?: string
          visitor_id?: string
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_consent_current_consent_ledger_id_fkey"
            columns: ["consent_ledger_id"]
            isOneToOne: false
            referencedRelation: "customer_consent_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_consent_current_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: true
            referencedRelation: "customer_visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_consent_ledger: {
        Row: {
          actor: string
          ai_conversation_storage: boolean
          ai_processing: boolean
          analytics: boolean
          id: number
          locale: string
          marketing: boolean
          personalization: boolean
          policy_version: string
          recorded_at: string
          room_image_processing: boolean
          room_image_storage: boolean
          session_id: string | null
          source: string
          visitor_id: string
          withdrawal_reason: string | null
          withdrawn_at: string | null
        }
        Insert: {
          actor: string
          ai_conversation_storage?: boolean
          ai_processing?: boolean
          analytics?: boolean
          id?: never
          locale: string
          marketing?: boolean
          personalization?: boolean
          policy_version: string
          recorded_at?: string
          room_image_processing?: boolean
          room_image_storage?: boolean
          session_id?: string | null
          source: string
          visitor_id: string
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          actor?: string
          ai_conversation_storage?: boolean
          ai_processing?: boolean
          analytics?: boolean
          id?: never
          locale?: string
          marketing?: boolean
          personalization?: boolean
          policy_version?: string
          recorded_at?: string
          room_image_processing?: boolean
          room_image_storage?: boolean
          session_id?: string | null
          source?: string
          visitor_id?: string
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_consent_ledger_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "customer_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_consent_ledger_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "customer_visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_event_daily_aggregates: {
        Row: {
          aggregate_date: string
          event_count: number
          event_name: string
          unique_visitors: number
        }
        Insert: {
          aggregate_date: string
          event_count?: number
          event_name: string
          unique_visitors?: number
        }
        Update: {
          aggregate_date?: string
          event_count?: number
          event_name?: string
          unique_visitors?: number
        }
        Relationships: []
      }
      customer_event_rate_limits: {
        Row: {
          event_count: number
          expires_at: string
          session_id: string
          window_started_at: string
        }
        Insert: {
          event_count?: number
          expires_at: string
          session_id: string
          window_started_at: string
        }
        Update: {
          event_count?: number
          expires_at?: string
          session_id?: string
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_event_rate_limits_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "customer_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_events: {
        Row: {
          analysis_id: string | null
          cart_id: string | null
          correction_flags: string[] | null
          event_name: string
          filter_keys: string[] | null
          id: number
          idempotency_key_hash: string
          item_count_bucket: string | null
          item_id: string | null
          item_ids: string[] | null
          locale: string | null
          occurred_at: string
          placement: string | null
          preference_keys: string[] | null
          product_id: string | null
          rank: number | null
          received_at: string
          request_id: string | null
          result_count_bucket: string | null
          route_key: string | null
          session_id: string
          source_placement: string | null
          variant_id: string | null
          visitor_id: string
        }
        Insert: {
          analysis_id?: string | null
          cart_id?: string | null
          correction_flags?: string[] | null
          event_name: string
          filter_keys?: string[] | null
          id?: never
          idempotency_key_hash: string
          item_count_bucket?: string | null
          item_id?: string | null
          item_ids?: string[] | null
          locale?: string | null
          occurred_at: string
          placement?: string | null
          preference_keys?: string[] | null
          product_id?: string | null
          rank?: number | null
          received_at?: string
          request_id?: string | null
          result_count_bucket?: string | null
          route_key?: string | null
          session_id: string
          source_placement?: string | null
          variant_id?: string | null
          visitor_id: string
        }
        Update: {
          analysis_id?: string | null
          cart_id?: string | null
          correction_flags?: string[] | null
          event_name?: string
          filter_keys?: string[] | null
          id?: never
          idempotency_key_hash?: string
          item_count_bucket?: string | null
          item_id?: string | null
          item_ids?: string[] | null
          locale?: string | null
          occurred_at?: string
          placement?: string | null
          preference_keys?: string[] | null
          product_id?: string | null
          rank?: number | null
          received_at?: string
          request_id?: string | null
          result_count_bucket?: string | null
          route_key?: string | null
          session_id?: string
          source_placement?: string | null
          variant_id?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "customer_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_events_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "customer_visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_firebase_principals: {
        Row: {
          account_id: string
          created_at: string
          deleted_at: string | null
          disabled_at: string | null
          firebase_uid: string
          id: string
          merged_into_account_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          deleted_at?: string | null
          disabled_at?: string | null
          firebase_uid: string
          id?: string
          merged_into_account_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          deleted_at?: string | null
          disabled_at?: string | null
          firebase_uid?: string
          id?: string
          merged_into_account_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_firebase_principals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_firebase_principals_merged_into_account_id_fkey"
            columns: ["merged_into_account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_identity_ledger: {
        Row: {
          account_id: string | null
          id: number
          identity_kind: string
          identity_value_hash: string
          recorded_at: string
          session_id: string | null
          source: string
          user_id: string | null
          visitor_id: string
        }
        Insert: {
          account_id?: string | null
          id?: never
          identity_kind: string
          identity_value_hash: string
          recorded_at?: string
          session_id?: string | null
          source: string
          user_id?: string | null
          visitor_id: string
        }
        Update: {
          account_id?: string | null
          id?: never
          identity_kind?: string
          identity_value_hash?: string
          recorded_at?: string
          session_id?: string | null
          source?: string
          user_id?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_identity_ledger_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_identity_ledger_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "customer_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_identity_ledger_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "customer_visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_identity_providers: {
        Row: {
          audience: string
          created_at: string
          issuer: string
          provider: string
        }
        Insert: {
          audience: string
          created_at?: string
          issuer: string
          provider: string
        }
        Update: {
          audience?: string
          created_at?: string
          issuer?: string
          provider?: string
        }
        Relationships: []
      }
      customer_memory_briefs: {
        Row: {
          account_id: string
          approved_by: string | null
          brief_version: string
          customer_visible_summary: string | null
          discussed_variant_ids: string[]
          expires_at: string | null
          generated_at: string
          id: string
          link_id: string
          preferred_brand_ids: string[]
          preferred_room_ids: string[]
          project_stage: string | null
          reviewed_at: string | null
          source: string
          source_watermark: string
          updated_at: string
        }
        Insert: {
          account_id: string
          approved_by?: string | null
          brief_version: string
          customer_visible_summary?: string | null
          discussed_variant_ids?: string[]
          expires_at?: string | null
          generated_at?: string
          id?: string
          link_id: string
          preferred_brand_ids?: string[]
          preferred_room_ids?: string[]
          project_stage?: string | null
          reviewed_at?: string | null
          source: string
          source_watermark: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          approved_by?: string | null
          brief_version?: string
          customer_visible_summary?: string | null
          discussed_variant_ids?: string[]
          expires_at?: string | null
          generated_at?: string
          id?: string
          link_id?: string
          preferred_brand_ids?: string[]
          preferred_room_ids?: string[]
          project_stage?: string | null
          reviewed_at?: string | null
          source?: string
          source_watermark?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_memory_briefs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_memory_briefs_link_account_fkey"
            columns: ["link_id", "account_id"]
            isOneToOne: false
            referencedRelation: "customer_amis_links"
            referencedColumns: ["id", "account_id"]
          },
        ]
      }
      customer_memory_projections: {
        Row: {
          account_id: string | null
          customer_visible_summary: string | null
          discussed_variant_ids: string[]
          expires_at: string | null
          generated_at: string
          link_id: string
          memory: Json
          preferred_brand_ids: string[]
          preferred_room_ids: string[]
          project_stage: string | null
          projection_version: string
          purchased_variant_ids: string[]
          source_updated_at: string
          source_watermark: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          customer_visible_summary?: string | null
          discussed_variant_ids?: string[]
          expires_at?: string | null
          generated_at?: string
          link_id: string
          memory: Json
          preferred_brand_ids?: string[]
          preferred_room_ids?: string[]
          project_stage?: string | null
          projection_version: string
          purchased_variant_ids?: string[]
          source_updated_at: string
          source_watermark?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          customer_visible_summary?: string | null
          discussed_variant_ids?: string[]
          expires_at?: string | null
          generated_at?: string
          link_id?: string
          memory?: Json
          preferred_brand_ids?: string[]
          preferred_room_ids?: string[]
          project_stage?: string | null
          projection_version?: string
          purchased_variant_ids?: string[]
          source_updated_at?: string
          source_watermark?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_memory_projections_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_memory_projections_link_account_fkey"
            columns: ["link_id", "account_id"]
            isOneToOne: false
            referencedRelation: "customer_amis_links"
            referencedColumns: ["id", "account_id"]
          },
        ]
      }
      customer_personalization_settings: {
        Row: {
          account_id: string
          created_at: string
          enabled: boolean
          policy_version: string
          recommendation_shadow_mode: boolean
          updated_at: string
          updated_by_actor: string
          use_amis_history: boolean
          use_behavior_history: boolean
          user_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          enabled?: boolean
          policy_version: string
          recommendation_shadow_mode?: boolean
          updated_at?: string
          updated_by_actor?: string
          use_amis_history?: boolean
          use_behavior_history?: boolean
          user_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          enabled?: boolean
          policy_version?: string
          recommendation_shadow_mode?: boolean
          updated_at?: string
          updated_by_actor?: string
          use_amis_history?: boolean
          use_behavior_history?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_personalization_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_preferences: {
        Row: {
          confidence: number | null
          consent_ledger_id: number | null
          created_at: string
          deleted_at: string | null
          expires_at: string | null
          feature_key: string
          feature_type: string
          feature_value: string
          id: string
          source: string
          updated_at: string
          visitor_id: string
        }
        Insert: {
          confidence?: number | null
          consent_ledger_id?: number | null
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          feature_key: string
          feature_type: string
          feature_value: string
          id?: string
          source: string
          updated_at?: string
          visitor_id: string
        }
        Update: {
          confidence?: number | null
          consent_ledger_id?: number | null
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          feature_key?: string
          feature_type?: string
          feature_value?: string
          id?: string
          source?: string
          updated_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_preferences_consent_ledger_id_fkey"
            columns: ["consent_ledger_id"]
            isOneToOne: false
            referencedRelation: "customer_consent_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_preferences_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "customer_visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_recent_entities: {
        Row: {
          deleted_at: string | null
          entity_id: string
          entity_type: string
          expires_at: string
          first_interacted_at: string
          id: string
          interaction_count: number
          last_interacted_at: string
          visitor_id: string
        }
        Insert: {
          deleted_at?: string | null
          entity_id: string
          entity_type: string
          expires_at: string
          first_interacted_at?: string
          id?: string
          interaction_count?: number
          last_interacted_at?: string
          visitor_id: string
        }
        Update: {
          deleted_at?: string | null
          entity_id?: string
          entity_type?: string
          expires_at?: string
          first_interacted_at?: string
          id?: string
          interaction_count?: number
          last_interacted_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_recent_entities_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "customer_visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_recommendation_signals: {
        Row: {
          account_id: string
          expires_at: string
          first_observed_at: string
          id: string
          last_observed_at: string
          link_id: string | null
          projection_version: string
          shadow_only: boolean
          signal_count: number
          signal_kind: string
          signal_source: string
          variant_id: string
        }
        Insert: {
          account_id: string
          expires_at: string
          first_observed_at?: string
          id?: string
          last_observed_at?: string
          link_id?: string | null
          projection_version: string
          shadow_only?: boolean
          signal_count?: number
          signal_kind: string
          signal_source: string
          variant_id: string
        }
        Update: {
          account_id?: string
          expires_at?: string
          first_observed_at?: string
          id?: string
          last_observed_at?: string
          link_id?: string | null
          projection_version?: string
          shadow_only?: boolean
          signal_count?: number
          signal_kind?: string
          signal_source?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_recommendation_signals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_recommendation_signals_link_account_fkey"
            columns: ["link_id", "account_id"]
            isOneToOne: false
            referencedRelation: "customer_amis_links"
            referencedColumns: ["id", "account_id"]
          },
          {
            foreignKeyName: "customer_recommendation_signals_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "catalog_eligibility"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "customer_recommendation_signals_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_sessions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          last_seen_at: string
          revoked_at: string | null
          session_token_hash: string
          started_at: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_seen_at?: string
          revoked_at?: string | null
          session_token_hash: string
          started_at?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_seen_at?: string
          revoked_at?: string | null
          session_token_hash?: string
          started_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_sessions_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "customer_visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_subject_deletion_queue: {
        Row: {
          id: number
          processed_at: string | null
          requested_at: string
          session_id: string | null
          visitor_created_at: string | null
          visitor_id: string
        }
        Insert: {
          id?: never
          processed_at?: string | null
          requested_at?: string
          session_id?: string | null
          visitor_created_at?: string | null
          visitor_id: string
        }
        Update: {
          id?: never
          processed_at?: string | null
          requested_at?: string
          session_id?: string | null
          visitor_created_at?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_subject_deletion_queue_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "customer_visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_visitors: {
        Row: {
          created_at: string
          expires_at: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          revoked_at: string | null
          visitor_token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          revoked_at?: string | null
          visitor_token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          revoked_at?: string | null
          visitor_token_hash?: string
        }
        Relationships: []
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
      instagram_active_posts: {
        Row: {
          caption: string | null
          id: string
          image_url: string
          media_type: string
          permalink: string
          published_at: string | null
          sort_order: number
          source_post_id: string
          thumbnail_url: string | null
          video_url: string | null
        }
        Insert: {
          caption?: string | null
          id: string
          image_url: string
          media_type: string
          permalink: string
          published_at?: string | null
          sort_order: number
          source_post_id: string
          thumbnail_url?: string | null
          video_url?: string | null
        }
        Update: {
          caption?: string | null
          id?: string
          image_url?: string
          media_type?: string
          permalink?: string
          published_at?: string | null
          sort_order?: number
          source_post_id?: string
          thumbnail_url?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      instagram_media: {
        Row: {
          caption: string | null
          id: string
          media_type: string
          media_url: string | null
          permalink: string | null
          published_at: string | null
          synced_at: string
          thumbnail_url: string | null
        }
        Insert: {
          caption?: string | null
          id: string
          media_type: string
          media_url?: string | null
          permalink?: string | null
          published_at?: string | null
          synced_at?: string
          thumbnail_url?: string | null
        }
        Update: {
          caption?: string | null
          id?: string
          media_type?: string
          media_url?: string | null
          permalink?: string | null
          published_at?: string | null
          synced_at?: string
          thumbnail_url?: string | null
        }
        Relationships: []
      }
      instagram_pipeline_state: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      instagram_posts: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          image_url: string
          last_seen_at: string | null
          media_type: string
          permalink: string
          source_url_fingerprint: string
          thumbnail_url: string | null
          updated_at: string | null
          video_url: string | null
          wistia_hashed_id: string | null
          wistia_status: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id: string
          image_url: string
          last_seen_at?: string | null
          media_type: string
          permalink: string
          source_url_fingerprint: string
          thumbnail_url?: string | null
          updated_at?: string | null
          video_url?: string | null
          wistia_hashed_id?: string | null
          wistia_status?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          image_url?: string
          last_seen_at?: string | null
          media_type?: string
          permalink?: string
          source_url_fingerprint?: string
          thumbnail_url?: string | null
          updated_at?: string | null
          video_url?: string | null
          wistia_hashed_id?: string | null
          wistia_status?: string | null
        }
        Relationships: []
      }
      instagram_snapshot_stage_items: {
        Row: {
          caption: string | null
          image_url: string
          media_type: string
          permalink: string
          post_id: string
          sort_order: number
          source_url_fingerprint: string
          stage_id: string
          video_url: string | null
        }
        Insert: {
          caption?: string | null
          image_url: string
          media_type: string
          permalink: string
          post_id: string
          sort_order: number
          source_url_fingerprint: string
          stage_id: string
          video_url?: string | null
        }
        Update: {
          caption?: string | null
          image_url?: string
          media_type?: string
          permalink?: string
          post_id?: string
          sort_order?: number
          source_url_fingerprint?: string
          stage_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_snapshot_stage_items_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "instagram_snapshot_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_snapshot_stages: {
        Row: {
          created_at: string | null
          id: string
          selection_key: string
          source_url_version: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          selection_key: string
          source_url_version: string
          status: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          selection_key?: string
          source_url_version?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      instagram_sync_state: {
        Row: {
          access_token: string
          account_id: string
          expires_at: string
          sync_key: string
          updated_at: string
        }
        Insert: {
          access_token: string
          account_id: string
          expires_at: string
          sync_key?: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          account_id?: string
          expires_at?: string
          sync_key?: string
          updated_at?: string
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
          title_ko: string | null
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
          title_ko?: string | null
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
          title_ko?: string | null
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
            referencedRelation: "catalog_eligibility"
            referencedColumns: ["variant_id"]
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
            referencedRelation: "catalog_eligibility"
            referencedColumns: ["variant_id"]
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
          actor_account_id: string | null
          actor_kind: string
          actor_staff_id: string | null
          changed_by: string | null
          created_at: string
          id: string
          note: string | null
          order_id: string
          status: string
        }
        Insert: {
          actor_account_id?: string | null
          actor_kind?: string
          actor_staff_id?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          status: string
        }
        Update: {
          actor_account_id?: string | null
          actor_kind?: string
          actor_staff_id?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_actor_account_id_fkey"
            columns: ["actor_account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
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
          account_id: string | null
          address: string
          amis_export_status: string
          business_status: string
          city: string | null
          created_at: string
          currency: string
          district: string | null
          email: string
          fulfillment_status: string
          full_name: string
          grand_total: number
          guest_owner_id: string | null
          guest_owner_token_digest: string | null
          guest_owner_token_expires_at: string | null
          id: string
          idempotency_key: string | null
          inventory_status: string
          note: string | null
          order_kind: string
          order_number: string
          owner_scope: string
          payment_status: string
          phone: string
          price_snapshot: Json
          refund_status: string
          status: string
          subtotal: number
          updated_at: string
          user_id: string | null
          ward: string | null
          web_order_number: string
        }
        Insert: {
          account_id?: string | null
          address: string
          amis_export_status?: string
          business_status?: string
          city?: string | null
          created_at?: string
          currency?: string
          district?: string | null
          email: string
          fulfillment_status?: string
          full_name: string
          grand_total?: number
          guest_owner_id?: string | null
          guest_owner_token_digest?: string | null
          guest_owner_token_expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          inventory_status?: string
          note?: string | null
          order_kind?: string
          order_number: string
          owner_scope: string
          payment_status?: string
          phone: string
          price_snapshot?: Json
          refund_status?: string
          status?: string
          subtotal?: number
          updated_at?: string
          user_id?: string | null
          ward?: string | null
          web_order_number: string
        }
        Update: {
          account_id?: string | null
          address?: string
          amis_export_status?: string
          business_status?: string
          city?: string | null
          created_at?: string
          currency?: string
          district?: string | null
          email?: string
          fulfillment_status?: string
          full_name?: string
          grand_total?: number
          guest_owner_id?: string | null
          guest_owner_token_digest?: string | null
          guest_owner_token_expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          inventory_status?: string
          note?: string | null
          order_kind?: string
          order_number?: string
          owner_scope?: string
          payment_status?: string
          phone?: string
          price_snapshot?: Json
          refund_status?: string
          status?: string
          subtotal?: number
          updated_at?: string
          user_id?: string | null
          ward?: string | null
          web_order_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          amount: number
          checkout_id: string | null
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          idempotency_key: string
          legacy_app_trans_id: string | null
          legacy_zp_trans_id: string | null
          merchant_reference: string
          order_id: string | null
          payment_method: string
          provider: string
          provider_checkout_url: string | null
          provider_order_id: string | null
          provider_transaction_id: string | null
          request_digest: string | null
          response_digest: string | null
          retrieved_at: string | null
          state: string
        }
        Insert: {
          amount: number
          checkout_id?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          idempotency_key: string
          legacy_app_trans_id?: string | null
          legacy_zp_trans_id?: string | null
          merchant_reference: string
          order_id?: string | null
          payment_method: string
          provider: string
          provider_checkout_url?: string | null
          provider_order_id?: string | null
          provider_transaction_id?: string | null
          request_digest?: string | null
          response_digest?: string | null
          retrieved_at?: string | null
          state?: string
        }
        Update: {
          amount?: number
          checkout_id?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          idempotency_key?: string
          legacy_app_trans_id?: string | null
          legacy_zp_trans_id?: string | null
          merchant_reference?: string
          order_id?: string | null
          payment_method?: string
          provider?: string
          provider_checkout_url?: string | null
          provider_order_id?: string | null
          provider_transaction_id?: string | null
          request_digest?: string | null
          response_digest?: string | null
          retrieved_at?: string | null
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "commerce_checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          attempt_id: string
          event_type: string
          from_state: string
          id: number
          payload_digest: string
          provider: string
          provider_event_id: string
          provider_transaction_id: string | null
          received_at: string
          recorded_at: string
          to_state: string
          transition_decision: string
          verification_decision: string
        }
        Insert: {
          attempt_id: string
          event_type: string
          from_state: string
          id?: never
          payload_digest: string
          provider: string
          provider_event_id: string
          provider_transaction_id?: string | null
          received_at?: string
          recorded_at?: string
          to_state: string
          transition_decision: string
          verification_decision: string
        }
        Update: {
          attempt_id?: string
          event_type?: string
          from_state?: string
          id?: never
          payload_digest?: string
          provider?: string
          provider_event_id?: string
          provider_transaction_id?: string | null
          received_at?: string
          recorded_at?: string
          to_state?: string
          transition_decision?: string
          verification_decision?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "payment_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reconciliations: {
        Row: {
          attempt_id: string
          decision: string
          id: number
          provider_status: string
          queried_at: string
          recorded_at: string
          response_digest: string
        }
        Insert: {
          attempt_id: string
          decision: string
          id?: never
          provider_status: string
          queried_at?: string
          recorded_at?: string
          response_digest: string
        }
        Update: {
          attempt_id?: string
          decision?: string
          id?: never
          provider_status?: string
          queried_at?: string
          recorded_at?: string
          response_digest?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reconciliations_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "payment_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      personalization_decisions: {
        Row: {
          algorithm_version: string
          consent_ledger_id: number | null
          context_version: string
          decided_at: string
          deleted_at: string | null
          expires_at: string
          explanation_key: string | null
          fallback_tier: string
          id: string
          placement: string
          selected_module_key: string | null
          strategy_key: string
          visitor_id: string
        }
        Insert: {
          algorithm_version: string
          consent_ledger_id?: number | null
          context_version: string
          decided_at?: string
          deleted_at?: string | null
          expires_at: string
          explanation_key?: string | null
          fallback_tier: string
          id?: string
          placement: string
          selected_module_key?: string | null
          strategy_key: string
          visitor_id: string
        }
        Update: {
          algorithm_version?: string
          consent_ledger_id?: number | null
          context_version?: string
          decided_at?: string
          deleted_at?: string | null
          expires_at?: string
          explanation_key?: string | null
          fallback_tier?: string
          id?: string
          placement?: string
          selected_module_key?: string | null
          strategy_key?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personalization_decisions_consent_ledger_id_fkey"
            columns: ["consent_ledger_id"]
            isOneToOne: false
            referencedRelation: "customer_consent_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personalization_decisions_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "customer_visitors"
            referencedColumns: ["id"]
          },
        ]
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
      product_visual_embeddings: {
        Row: {
          active: boolean
          created_at: string
          dimensions: number
          embedding: string
          generation_state: string
          id: string
          image_hash: string
          image_id: string
          model_version: string
          product_id: string | null
          provider_id: string
          variant_id: string | null
          view_type: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          dimensions: number
          embedding: string
          generation_state?: string
          id?: string
          image_hash: string
          image_id: string
          model_version: string
          product_id?: string | null
          provider_id: string
          variant_id?: string | null
          view_type: string
        }
        Update: {
          active?: boolean
          created_at?: string
          dimensions?: number
          embedding?: string
          generation_state?: string
          id?: string
          image_hash?: string
          image_id?: string
          model_version?: string
          product_id?: string | null
          provider_id?: string
          variant_id?: string | null
          view_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_visual_embeddings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_visual_embeddings_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "catalog_eligibility"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "product_visual_embeddings_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
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
          description_ko: string | null
          description_vi: string | null
          designer_id: string | null
          id: string
          media_image_url: string | null
          media_video_url: string | null
          name: string
          name_ko: string | null
          name_vi: string | null
          priority: number | null
          product_line: string | null
          raw: Json
          size: string | null
          slug: string | null
          slug_ko: string | null
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
          description_ko?: string | null
          description_vi?: string | null
          designer_id?: string | null
          id?: string
          media_image_url?: string | null
          media_video_url?: string | null
          name: string
          name_ko?: string | null
          name_vi?: string | null
          priority?: number | null
          product_line?: string | null
          raw?: Json
          size?: string | null
          slug?: string | null
          slug_ko?: string | null
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
          description_ko?: string | null
          description_vi?: string | null
          designer_id?: string | null
          id?: string
          media_image_url?: string | null
          media_video_url?: string | null
          name?: string
          name_ko?: string | null
          name_vi?: string | null
          priority?: number | null
          product_line?: string | null
          raw?: Json
          size?: string | null
          slug?: string | null
          slug_ko?: string | null
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
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "catalog_eligibility"
            referencedColumns: ["brand_id"]
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
          account_id: string | null
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
          account_id?: string | null
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
          account_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_locale?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_events: {
        Row: {
          actor: string
          event_type: string
          from_state: string
          id: number
          payload_digest: string | null
          recorded_at: string
          refund_operation_id: string
          to_state: string
          transition_decision: string
        }
        Insert: {
          actor: string
          event_type: string
          from_state: string
          id?: never
          payload_digest?: string | null
          recorded_at?: string
          refund_operation_id: string
          to_state: string
          transition_decision: string
        }
        Update: {
          actor?: string
          event_type?: string
          from_state?: string
          id?: never
          payload_digest?: string | null
          recorded_at?: string
          refund_operation_id?: string
          to_state?: string
          transition_decision?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_events_refund_operation_id_fkey"
            columns: ["refund_operation_id"]
            isOneToOne: false
            referencedRelation: "refund_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_operations: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          bank_evidence_digest: string | null
          bank_evidence_reference: string | null
          checkout_id: string | null
          completed_at: string | null
          completed_by: string | null
          currency: string
          id: string
          idempotency_key: string
          method: string
          order_id: string | null
          payment_attempt_id: string | null
          reason: string
          requested_at: string
          requested_by: string
          state: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          bank_evidence_digest?: string | null
          bank_evidence_reference?: string | null
          checkout_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          currency?: string
          id?: string
          idempotency_key: string
          method: string
          order_id?: string | null
          payment_attempt_id?: string | null
          reason: string
          requested_at?: string
          requested_by: string
          state?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          bank_evidence_digest?: string | null
          bank_evidence_reference?: string | null
          checkout_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          currency?: string
          id?: string
          idempotency_key?: string
          method?: string
          order_id?: string | null
          payment_attempt_id?: string | null
          reason?: string
          requested_at?: string
          requested_by?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_operations_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "commerce_checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_operations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_operations_payment_attempt_id_fkey"
            columns: ["payment_attempt_id"]
            isOneToOne: false
            referencedRelation: "payment_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      room_scenes: {
        Row: {
          confidence: number | null
          confirmation_state: string
          created_at: string
          deleted_at: string | null
          expires_at: string | null
          id: string
          mapper_version: string
          owner_account_id: string
          owner_id: string | null
          provider_version: string
          request_id: string
          scene: Json
        }
        Insert: {
          confidence?: number | null
          confirmation_state?: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          mapper_version: string
          owner_account_id: string
          owner_id?: string | null
          provider_version: string
          request_id: string
          scene: Json
        }
        Update: {
          confidence?: number | null
          confirmation_state?: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          mapper_version?: string
          owner_account_id?: string
          owner_id?: string | null
          provider_version?: string
          request_id?: string
          scene?: Json
        }
        Relationships: [
          {
            foreignKeyName: "room_scenes_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_scenes_request_account_fkey"
            columns: ["request_id", "owner_account_id"]
            isOneToOne: false
            referencedRelation: "vision_analysis_requests"
            referencedColumns: ["id", "owner_account_id"]
          },
          {
            foreignKeyName: "room_scenes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "vision_analysis_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_recommendation_features: {
        Row: {
          brand_id: string | null
          category_id: string | null
          collection_key: string | null
          complementary_group_key: string | null
          designer_id: string | null
          durable: boolean
          eligible: boolean
          feature_version: string
          freshness_at: string
          has_primary_image: boolean
          in_stock: boolean
          material_key: string | null
          palette_key: string | null
          price_band: string
          product_id: string | null
          repeatable: boolean
          room_key: string | null
          style_key: string | null
          subcategory_key: string | null
          updated_at: string
          variant_id: string
        }
        Insert: {
          brand_id?: string | null
          category_id?: string | null
          collection_key?: string | null
          complementary_group_key?: string | null
          designer_id?: string | null
          durable?: boolean
          eligible?: boolean
          feature_version: string
          freshness_at?: string
          has_primary_image?: boolean
          in_stock?: boolean
          material_key?: string | null
          palette_key?: string | null
          price_band?: string
          product_id?: string | null
          repeatable?: boolean
          room_key?: string | null
          style_key?: string | null
          subcategory_key?: string | null
          updated_at?: string
          variant_id: string
        }
        Update: {
          brand_id?: string | null
          category_id?: string | null
          collection_key?: string | null
          complementary_group_key?: string | null
          designer_id?: string | null
          durable?: boolean
          eligible?: boolean
          feature_version?: string
          freshness_at?: string
          has_primary_image?: boolean
          in_stock?: boolean
          material_key?: string | null
          palette_key?: string | null
          price_band?: string
          product_id?: string | null
          repeatable?: boolean
          room_key?: string | null
          style_key?: string | null
          subcategory_key?: string | null
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_recommendation_features_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_recommendation_features_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "catalog_eligibility"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "variant_recommendation_features_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_recommendation_features_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_recommendation_features_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "catalog_eligibility"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "variant_recommendation_features_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
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
          brand_origin_ko: string | null
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
          cldr_media_closeup_alt_ko: string | null
          cldr_media_closeup_alt_vi: string | null
          cldr_media_illustration: string | null
          cldr_media_info_as_image: string | null
          cldr_media_lifestyle_1: string | null
          cldr_media_lifestyle_1_alt: string | null
          cldr_media_lifestyle_1_alt_ko: string | null
          cldr_media_lifestyle_1_alt_vi: string | null
          cldr_media_lifestyle_2: string | null
          cldr_media_lifestyle_2_alt: string | null
          cldr_media_lifestyle_2_alt_ko: string | null
          cldr_media_lifestyle_2_alt_vi: string | null
          cldr_media_long: string | null
          cldr_media_long_alt: string | null
          cldr_media_long_alt_ko: string | null
          cldr_media_long_alt_vi: string | null
          cldr_packshot_alt: string | null
          cldr_packshot_alt_ko: string | null
          cldr_packshot_alt_vi: string | null
          cloudinary_ids: string[]
          compare_at_price: number | null
          created_at: string
          description: string | null
          description_ko: string | null
          description_vi: string | null
          designer_cldr_id_portrait: string | null
          designer_description: string | null
          designer_description_ko: string | null
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
          filter_room_ko: string[] | null
          filter_room_vi: string[] | null
          filter_sub_category: string | null
          finish: string | null
          finish_ko: string | null
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
          meta_description_ko: string | null
          meta_description_vi: string | null
          meta_title: string | null
          meta_title_ko: string | null
          meta_title_vi: string | null
          missed_sku: boolean | null
          name: string
          name_ko: string | null
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
          short_name_ko: string | null
          short_name_vi: string | null
          size: string | null
          sku: string | null
          slug: string | null
          slug_ko: string | null
          slug_vi: string | null
          source_created_at: string | null
          source_updated_at: string | null
          stock: number | null
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
          brand_origin_ko?: string | null
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
          cldr_media_closeup_alt_ko?: string | null
          cldr_media_closeup_alt_vi?: string | null
          cldr_media_illustration?: string | null
          cldr_media_info_as_image?: string | null
          cldr_media_lifestyle_1?: string | null
          cldr_media_lifestyle_1_alt?: string | null
          cldr_media_lifestyle_1_alt_ko?: string | null
          cldr_media_lifestyle_1_alt_vi?: string | null
          cldr_media_lifestyle_2?: string | null
          cldr_media_lifestyle_2_alt?: string | null
          cldr_media_lifestyle_2_alt_ko?: string | null
          cldr_media_lifestyle_2_alt_vi?: string | null
          cldr_media_long?: string | null
          cldr_media_long_alt?: string | null
          cldr_media_long_alt_ko?: string | null
          cldr_media_long_alt_vi?: string | null
          cldr_packshot_alt?: string | null
          cldr_packshot_alt_ko?: string | null
          cldr_packshot_alt_vi?: string | null
          cloudinary_ids?: string[]
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          description_ko?: string | null
          description_vi?: string | null
          designer_cldr_id_portrait?: string | null
          designer_description?: string | null
          designer_description_ko?: string | null
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
          filter_room_ko?: string[] | null
          filter_room_vi?: string[] | null
          filter_sub_category?: string | null
          finish?: string | null
          finish_ko?: string | null
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
          meta_description_ko?: string | null
          meta_description_vi?: string | null
          meta_title?: string | null
          meta_title_ko?: string | null
          meta_title_vi?: string | null
          missed_sku?: boolean | null
          name: string
          name_ko?: string | null
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
          short_name_ko?: string | null
          short_name_vi?: string | null
          size?: string | null
          sku?: string | null
          slug?: string | null
          slug_ko?: string | null
          slug_vi?: string | null
          source_created_at?: string | null
          source_updated_at?: string | null
          stock?: number | null
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
          brand_origin_ko?: string | null
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
          cldr_media_closeup_alt_ko?: string | null
          cldr_media_closeup_alt_vi?: string | null
          cldr_media_illustration?: string | null
          cldr_media_info_as_image?: string | null
          cldr_media_lifestyle_1?: string | null
          cldr_media_lifestyle_1_alt?: string | null
          cldr_media_lifestyle_1_alt_ko?: string | null
          cldr_media_lifestyle_1_alt_vi?: string | null
          cldr_media_lifestyle_2?: string | null
          cldr_media_lifestyle_2_alt?: string | null
          cldr_media_lifestyle_2_alt_ko?: string | null
          cldr_media_lifestyle_2_alt_vi?: string | null
          cldr_media_long?: string | null
          cldr_media_long_alt?: string | null
          cldr_media_long_alt_ko?: string | null
          cldr_media_long_alt_vi?: string | null
          cldr_packshot_alt?: string | null
          cldr_packshot_alt_ko?: string | null
          cldr_packshot_alt_vi?: string | null
          cloudinary_ids?: string[]
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          description_ko?: string | null
          description_vi?: string | null
          designer_cldr_id_portrait?: string | null
          designer_description?: string | null
          designer_description_ko?: string | null
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
          filter_room_ko?: string[] | null
          filter_room_vi?: string[] | null
          filter_sub_category?: string | null
          finish?: string | null
          finish_ko?: string | null
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
          meta_description_ko?: string | null
          meta_description_vi?: string | null
          meta_title?: string | null
          meta_title_ko?: string | null
          meta_title_vi?: string | null
          missed_sku?: boolean | null
          name?: string
          name_ko?: string | null
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
          short_name_ko?: string | null
          short_name_vi?: string | null
          size?: string | null
          sku?: string | null
          slug?: string | null
          slug_ko?: string | null
          slug_vi?: string | null
          source_created_at?: string | null
          source_updated_at?: string | null
          stock?: number | null
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
            foreignKeyName: "variants_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "catalog_eligibility"
            referencedColumns: ["brand_id"]
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
      vision_analysis_requests: {
        Row: {
          consent_policy_version: string
          created_at: string
          deleted_at: string | null
          failure_code: string | null
          id: string
          idempotency_key: string
          model_version: string | null
          normalized_object_path: string | null
          object_hash: string | null
          original_object_path: string | null
          owner_account_id: string
          owner_id: string | null
          provider_id: string | null
          purpose: string
          retention_expires_at: string | null
          schema_version: string
          state: string
          updated_at: string
        }
        Insert: {
          consent_policy_version: string
          created_at?: string
          deleted_at?: string | null
          failure_code?: string | null
          id?: string
          idempotency_key: string
          model_version?: string | null
          normalized_object_path?: string | null
          object_hash?: string | null
          original_object_path?: string | null
          owner_account_id: string
          owner_id?: string | null
          provider_id?: string | null
          purpose?: string
          retention_expires_at?: string | null
          schema_version: string
          state?: string
          updated_at?: string
        }
        Update: {
          consent_policy_version?: string
          created_at?: string
          deleted_at?: string | null
          failure_code?: string | null
          id?: string
          idempotency_key?: string
          model_version?: string | null
          normalized_object_path?: string | null
          object_hash?: string | null
          original_object_path?: string | null
          owner_account_id?: string
          owner_id?: string | null
          provider_id?: string | null
          purpose?: string
          retention_expires_at?: string | null
          schema_version?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vision_analysis_requests_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      vision_object_crops: {
        Row: {
          bounding_box: Json
          created_at: string
          embedding_model_version: string | null
          embedding_state: string
          id: string
          object_category: string
          object_hash: string
          object_path: string
          owner_account_id: string
          owner_id: string | null
          request_id: string
        }
        Insert: {
          bounding_box: Json
          created_at?: string
          embedding_model_version?: string | null
          embedding_state?: string
          id?: string
          object_category: string
          object_hash: string
          object_path: string
          owner_account_id: string
          owner_id?: string | null
          request_id: string
        }
        Update: {
          bounding_box?: Json
          created_at?: string
          embedding_model_version?: string | null
          embedding_state?: string
          id?: string
          object_category?: string
          object_hash?: string
          object_path?: string
          owner_account_id?: string
          owner_id?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vision_object_crops_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vision_object_crops_request_account_fkey"
            columns: ["request_id", "owner_account_id"]
            isOneToOne: false
            referencedRelation: "vision_analysis_requests"
            referencedColumns: ["id", "owner_account_id"]
          },
          {
            foreignKeyName: "vision_object_crops_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "vision_analysis_requests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      catalog_eligibility: {
        Row: {
          brand_id: string | null
          brand_name: string | null
          brand_slug: string | null
          cart: boolean | null
          catalog_approved_validated: boolean | null
          has_fresh_stock: boolean | null
          has_supported_media: boolean | null
          hidden_brand_sku: boolean | null
          image_url: string | null
          localized_name: string | null
          localized_product_name: string | null
          payment: boolean | null
          price: number | null
          price_mode: string | null
          product_id: string | null
          product_name: string | null
          product_slug: string | null
          reason_codes: string[] | null
          recommendation: boolean | null
          sku: string | null
          stock: number | null
          storefront: boolean | null
          variant_id: string | null
          variant_name: string | null
          variant_slug: string | null
          visual_match: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_advisor_handoff_safe_status: {
        Row: {
          assigned_at: string | null
          closed_at: string | null
          created_at: string | null
          first_responded_at: string | null
          first_response_due_at: string | null
          priority: string | null
          public_reference: string | null
          status: string | null
        }
        Insert: {
          assigned_at?: string | null
          closed_at?: string | null
          created_at?: string | null
          first_responded_at?: string | null
          first_response_due_at?: string | null
          priority?: string | null
          public_reference?: string | null
          status?: string | null
        }
        Update: {
          assigned_at?: string | null
          closed_at?: string | null
          created_at?: string | null
          first_responded_at?: string | null
          first_response_due_at?: string | null
          priority?: string | null
          public_reference?: string | null
          status?: string | null
        }
        Relationships: []
      }
      customer_affinities_active: {
        Row: {
          algorithm_version: string | null
          consent_ledger_id: number | null
          decayed_at: string | null
          deleted_at: string | null
          distinct_session_count: number | null
          expires_at: string | null
          feature_key: string | null
          feature_type: string | null
          id: string | null
          last_evidence_at: string | null
          score: number | null
          support_count: number | null
          suppressed_at: string | null
          updated_at: string | null
          visitor_id: string | null
          window_started_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_affinities_consent_ledger_id_fkey"
            columns: ["consent_ledger_id"]
            isOneToOne: false
            referencedRelation: "customer_consent_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_affinities_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "customer_visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_memory_briefs_safe: {
        Row: {
          account_id: string | null
          customer_visible_summary: string | null
          discussed_variant_ids: string[] | null
          expires_at: string | null
          generated_at: string | null
          link_id: string | null
          preferred_brand_ids: string[] | null
          preferred_room_ids: string[] | null
          project_stage: string | null
        }
        Insert: {
          account_id?: string | null
          customer_visible_summary?: string | null
          discussed_variant_ids?: string[] | null
          expires_at?: string | null
          generated_at?: string | null
          link_id?: string | null
          preferred_brand_ids?: string[] | null
          preferred_room_ids?: string[] | null
          project_stage?: string | null
        }
        Update: {
          account_id?: string | null
          customer_visible_summary?: string | null
          discussed_variant_ids?: string[] | null
          expires_at?: string | null
          generated_at?: string | null
          link_id?: string | null
          preferred_brand_ids?: string[] | null
          preferred_room_ids?: string[] | null
          project_stage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_memory_briefs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_memory_briefs_link_account_fkey"
            columns: ["link_id", "account_id"]
            isOneToOne: false
            referencedRelation: "customer_amis_links"
            referencedColumns: ["id", "account_id"]
          },
        ]
      }
      customer_memory_projections_safe: {
        Row: {
          account_id: string | null
          customer_visible_summary: string | null
          discussed_variant_ids: string[] | null
          expires_at: string | null
          generated_at: string | null
          link_id: string | null
          preferred_brand_ids: string[] | null
          preferred_room_ids: string[] | null
          project_stage: string | null
          projection_version: string | null
          purchased_variant_ids: string[] | null
          source_watermark: string | null
        }
        Insert: {
          account_id?: string | null
          customer_visible_summary?: string | null
          discussed_variant_ids?: string[] | null
          expires_at?: string | null
          generated_at?: string | null
          link_id?: string | null
          preferred_brand_ids?: string[] | null
          preferred_room_ids?: string[] | null
          project_stage?: string | null
          projection_version?: string | null
          purchased_variant_ids?: string[] | null
          source_watermark?: string | null
        }
        Update: {
          account_id?: string | null
          customer_visible_summary?: string | null
          discussed_variant_ids?: string[] | null
          expires_at?: string | null
          generated_at?: string | null
          link_id?: string | null
          preferred_brand_ids?: string[] | null
          preferred_room_ids?: string[] | null
          project_stage?: string | null
          projection_version?: string | null
          purchased_variant_ids?: string[] | null
          source_watermark?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_memory_projections_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_memory_projections_link_account_fkey"
            columns: ["link_id", "account_id"]
            isOneToOne: false
            referencedRelation: "customer_amis_links"
            referencedColumns: ["id", "account_id"]
          },
        ]
      }
      customer_personalization_settings_safe: {
        Row: {
          account_id: string | null
          enabled: boolean | null
          policy_version: string | null
          recommendation_shadow_mode: boolean | null
          updated_at: string | null
          use_amis_history: boolean | null
          use_behavior_history: boolean | null
        }
        Insert: {
          account_id?: string | null
          enabled?: boolean | null
          policy_version?: string | null
          recommendation_shadow_mode?: boolean | null
          updated_at?: string | null
          use_amis_history?: boolean | null
          use_behavior_history?: boolean | null
        }
        Update: {
          account_id?: string | null
          enabled?: boolean | null
          policy_version?: string | null
          recommendation_shadow_mode?: boolean | null
          updated_at?: string | null
          use_amis_history?: boolean | null
          use_behavior_history?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_personalization_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_preferences_active: {
        Row: {
          confidence: number | null
          consent_ledger_id: number | null
          created_at: string | null
          deleted_at: string | null
          expires_at: string | null
          feature_key: string | null
          feature_type: string | null
          feature_value: string | null
          id: string | null
          source: string | null
          updated_at: string | null
          visitor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_preferences_consent_ledger_id_fkey"
            columns: ["consent_ledger_id"]
            isOneToOne: false
            referencedRelation: "customer_consent_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_preferences_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "customer_visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_recent_entities_active: {
        Row: {
          deleted_at: string | null
          entity_id: string | null
          entity_type: string | null
          expires_at: string | null
          first_interacted_at: string | null
          id: string | null
          interaction_count: number | null
          last_interacted_at: string | null
          visitor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_recent_entities_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "customer_visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_recommendation_signals_safe: {
        Row: {
          account_id: string | null
          expires_at: string | null
          last_observed_at: string | null
          shadow_only: boolean | null
          signal_count: number | null
          signal_kind: string | null
          variant_id: string | null
        }
        Insert: {
          account_id?: string | null
          expires_at?: string | null
          last_observed_at?: string | null
          shadow_only?: boolean | null
          signal_count?: number | null
          signal_kind?: string | null
          variant_id?: string | null
        }
        Update: {
          account_id?: string | null
          expires_at?: string | null
          last_observed_at?: string | null
          shadow_only?: boolean | null
          signal_count?: number | null
          signal_kind?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_recommendation_signals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_recommendation_signals_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "catalog_eligibility"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "customer_recommendation_signals_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      personalization_decisions_active: {
        Row: {
          algorithm_version: string | null
          consent_ledger_id: number | null
          context_version: string | null
          decided_at: string | null
          deleted_at: string | null
          expires_at: string | null
          explanation_key: string | null
          fallback_tier: string | null
          id: string | null
          placement: string | null
          selected_module_key: string | null
          strategy_key: string | null
          visitor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personalization_decisions_consent_ledger_id_fkey"
            columns: ["consent_ledger_id"]
            isOneToOne: false
            referencedRelation: "customer_consent_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personalization_decisions_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "customer_visitors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      append_customer_consent: {
        Args: { p_consent: Json; p_session_id: string; p_visitor_id: string }
        Returns: Json
      }
      append_customer_event: {
        Args: {
          p_event: Json
          p_received_at: string
          p_session_id: string
          p_visitor_id: string
        }
        Returns: string
      }
      apply_amis_inventory_sync: {
        Args: {
          p_baseline_lines: Json
          p_completed_at: string
          p_mode: string
          p_order_lines: Json
          p_orders: Json
          p_expected_baseline_id?: string
          p_expected_watermark?: string
          p_watermark?: string
        }
        Returns: Json
      }
      apply_korean_backfill_chunk: {
        Args: { p_run_id: string; p_updates: Json }
        Returns: {
          input_ordinal: number
          outcome: string
          target_column: string
          target_id: string
          target_table: string
        }[]
      }
      begin_instagram_snapshot_stage: {
        Args: {
          p_selection: Json
          p_selection_key: string
          p_source_url_version: string
        }
        Returns: string
      }
      bind_verified_customer_identity: {
        Args: { p_session_id: string; p_user_id: string; p_visitor_id: string }
        Returns: string
      }
      bootstrap_customer_identity: {
        Args: { p_session_token_hash: string; p_visitor_token_hash: string }
        Returns: {
          session_id: string
          visitor_id: string
        }[]
      }
      bootstrap_customer_identity_v2: {
        Args: { p_session_token_hash: string; p_visitor_token_hash: string }
        Returns: {
          session_id: string
          status: string
          visitor_id: string
        }[]
      }
      capture_order_from_cart: {
        Args: {
          p_address: string
          p_city?: string
          p_district?: string
          p_email: string
          p_full_name: string
          p_note?: string
          p_phone: string
          p_ward?: string
        }
        Returns: {
          order_id: string
          order_number: string
        }[]
      }
      clear_verified_customer_identity: {
        Args: { p_session_id: string; p_visitor_id: string }
        Returns: string
      }
      commerce_expire_holds: { Args: never; Returns: number }
      current_advisor_guest_scope_id: { Args: never; Returns: string }
      current_customer_account_id: { Args: never; Returns: string }
      current_customer_consent: {
        Args: { p_visitor_id: string }
        Returns: Json
      }
      current_legacy_supabase_user_id: { Args: never; Returns: string }
      delete_verified_guest_conversation: {
        Args: { p_conversation_id: string; p_guest_token: string }
        Returns: boolean
      }
      delete_vision_request: { Args: { p_request_id: string }; Returns: number }
      finish_korean_backfill_run: {
        Args: {
          p_applied_count: number
          p_missing_count: number
          p_run_id: string
          p_skipped_count: number
        }
        Returns: undefined
      }
      get_instagram_stage_pending_videos: {
        Args: { p_stage_id: string }
        Returns: {
          caption: string
          id: string
          image_url: string
          permalink: string
          source_url_fingerprint: string
          thumbnail_url: string
          wistia_hashed_id: string
          wistia_status: string
        }[]
      }
      get_instagram_stage_work: {
        Args: { p_stage_id: string }
        Returns: {
          caption: string
          draft_image_url: string
          draft_thumbnail_url: string
          draft_video_url: string
          id: string
          media_type: string
          meta_image_url: string
          meta_video_url: string
          permalink: string
          sort_order: number
          source_url_fingerprint: string
          wistia_hashed_id: string
          wistia_status: string
        }[]
      }
      get_vision_feature_defaults: { Args: never; Returns: Json }
      is_instagram_managed_image_url: {
        Args: { p_url: string }
        Returns: boolean
      }
      is_legacy_account_ownership_valid: {
        Args: { p_account_id: string; p_legacy_supabase_user_id: string }
        Returns: boolean
      }
      is_room_photo_path_readable: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      legacy_customer_account_id: {
        Args: { p_legacy_supabase_user_id: string }
        Returns: string
      }
      process_customer_subject_deletion: {
        Args: { p_batch_size?: number; p_queue_id: number }
        Returns: number
      }
      publish_instagram_snapshot: {
        Args: {
          p_active_ids: string[]
          p_posts: Json
          p_source_url_version: string
        }
        Returns: undefined
      }
      publish_instagram_stage: { Args: { p_stage_id: string }; Returns: string }
      resolve_customer_identity: {
        Args: { p_session_token_hash: string; p_visitor_token_hash: string }
        Returns: {
          session_id: string
          visitor_id: string
        }[]
      }
      resolve_customer_identity_v2: {
        Args: { p_session_token_hash: string; p_visitor_token_hash: string }
        Returns: {
          session_id: string
          status: string
          visitor_id: string
        }[]
      }
      save_instagram_posts_draft: {
        Args: { p_posts: Json }
        Returns: undefined
      }
      save_instagram_stage_drafts: {
        Args: { p_posts: Json; p_stage_id: string }
        Returns: undefined
      }
      search_public_chat_catalog_v2: {
        Args: {
          availability_mode?: string
          brand_keys?: string[]
          category_keys?: string[]
          collection_keys?: string[]
          color_keys?: string[]
          designer_keys?: string[]
          material_keys?: string[]
          max_price?: number
          min_price?: number
          product_family_keys?: string[]
          result_limit?: number
          room_keys?: string[]
          search_text?: string
          sort_mode?: string
          subtype_keys?: string[]
        }
        Returns: {
          brand_name: string
          cldr_media_lifestyle_1: string
          cldr_media_lifestyle_2: string
          description: string
          description_ko: string
          description_vi: string
          designer_description: string
          designer_description_ko: string
          designer_description_vi: string
          designer_name: string
          filter_brand: string
          filter_category: string
          filter_product_line: string
          filter_room: string[]
          filter_room_ko: string[]
          filter_room_vi: string[]
          filter_sub_category: string
          finish: string
          finish_ko: string
          finish_vi: string
          gallery_urls: string[]
          id: string
          is_current: boolean
          is_recommendable: boolean
          localized_product_name: string
          media_closeup: string
          media_long: string
          name: string
          name_ko: string
          name_vi: string
          packshot_url: string
          product_id: string
          product_line: string
          product_name: string
          product_name_denorm: string
          public_price: number
          public_price_mode: string
          public_stock_state: string
          short_name: string
          short_name_ko: string
          short_name_vi: string
          size: string
          slug: string
          slug_ko: string
          slug_vi: string
        }[]
      }
      search_public_chat_catalog: {
        Args: { result_limit?: number; search_query: string }
        Returns: {
          brand_name: string
          cldr_media_lifestyle_1: string
          cldr_media_lifestyle_2: string
          description: string
          description_ko: string
          description_vi: string
          designer_description: string
          designer_description_ko: string
          designer_description_vi: string
          designer_name: string
          filter_category: string
          filter_product_line: string
          finish: string
          finish_ko: string
          finish_vi: string
          gallery_urls: string[]
          id: string
          is_current: boolean
          is_recommendable: boolean
          localized_product_name: string
          media_closeup: string
          media_long: string
          name: string
          name_ko: string
          name_vi: string
          packshot_url: string
          product_id: string
          product_line: string
          product_name: string
          product_name_denorm: string
          public_price: number
          public_price_mode: string
          public_stock_state: string
          short_name: string
          short_name_ko: string
          short_name_vi: string
          size: string
          slug: string
          slug_ko: string
          slug_vi: string
        }[]
      }
      search_public_chat_catalog_before_placeholder_price_guard: {
        Args: { result_limit?: number; search_query: string }
        Returns: {
          brand_name: string
          cldr_media_lifestyle_1: string
          cldr_media_lifestyle_2: string
          description: string
          description_ko: string
          description_vi: string
          designer_description: string
          designer_description_ko: string
          designer_description_vi: string
          designer_name: string
          filter_category: string
          filter_product_line: string
          finish: string
          finish_ko: string
          finish_vi: string
          gallery_urls: string[]
          id: string
          is_current: boolean
          is_recommendable: boolean
          localized_product_name: string
          media_closeup: string
          media_long: string
          name: string
          name_ko: string
          name_vi: string
          packshot_url: string
          product_id: string
          product_line: string
          product_name: string
          product_name_denorm: string
          public_price: number
          public_price_mode: string
          public_stock_state: string
          short_name: string
          short_name_ko: string
          short_name_vi: string
          size: string
          slug: string
          slug_ko: string
          slug_vi: string
        }[]
      }
      search_variant_products_fuzzy: {
        Args: {
          brand_filters?: string[]
          category_filters?: string[]
          category_id_filter?: string
          exclude_variant_id?: string
          result_limit?: number
          result_offset?: number
          room_filters?: string[]
          search_query: string
          sort_key?: string
          status_filter?: string
          sub_category_filters?: string[]
        }
        Returns: {
          airtable_id: string | null
          approved: boolean
          brand_cldr_id_logo: string | null
          brand_cldr_logo: string | null
          brand_id: string | null
          brand_logo_size: number | null
          brand_name_denorm: string | null
          brand_origin: string | null
          brand_origin_ko: string | null
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
          cldr_media_closeup_alt_ko: string | null
          cldr_media_closeup_alt_vi: string | null
          cldr_media_illustration: string | null
          cldr_media_info_as_image: string | null
          cldr_media_lifestyle_1: string | null
          cldr_media_lifestyle_1_alt: string | null
          cldr_media_lifestyle_1_alt_ko: string | null
          cldr_media_lifestyle_1_alt_vi: string | null
          cldr_media_lifestyle_2: string | null
          cldr_media_lifestyle_2_alt: string | null
          cldr_media_lifestyle_2_alt_ko: string | null
          cldr_media_lifestyle_2_alt_vi: string | null
          cldr_media_long: string | null
          cldr_media_long_alt: string | null
          cldr_media_long_alt_ko: string | null
          cldr_media_long_alt_vi: string | null
          cldr_packshot_alt: string | null
          cldr_packshot_alt_ko: string | null
          cldr_packshot_alt_vi: string | null
          cloudinary_ids: string[]
          compare_at_price: number | null
          created_at: string
          description: string | null
          description_ko: string | null
          description_vi: string | null
          designer_cldr_id_portrait: string | null
          designer_description: string | null
          designer_description_ko: string | null
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
          filter_room_ko: string[] | null
          filter_room_vi: string[] | null
          filter_sub_category: string | null
          finish: string | null
          finish_ko: string | null
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
          meta_description_ko: string | null
          meta_description_vi: string | null
          meta_title: string | null
          meta_title_ko: string | null
          meta_title_vi: string | null
          missed_sku: boolean | null
          name: string
          name_ko: string | null
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
          short_name_ko: string | null
          short_name_vi: string | null
          size: string | null
          sku: string | null
          slug: string | null
          slug_ko: string | null
          slug_vi: string | null
          source_created_at: string | null
          source_updated_at: string | null
          stock: number | null
          test_sku: string | null
          updated_at: string
          validated: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "variants"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_variant_products_fuzzy_count: {
        Args: {
          brand_filters?: string[]
          category_filters?: string[]
          category_id_filter?: string
          exclude_variant_id?: string
          room_filters?: string[]
          search_query: string
          status_filter?: string
          sub_category_filters?: string[]
        }
        Returns: number
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_korean_backfill_run: {
        Args: { p_artifact_sha256: string; p_planned_count: number }
        Returns: string
      }
      update_instagram_stage_wistia_status: {
        Args: {
          p_post_id: string
          p_source_url_fingerprint: string
          p_stage_id: string
          p_status: string
          p_video_url: string
        }
        Returns: undefined
      }
      verify_conversation_guest_scope: {
        Args: { p_conversation_id: string; p_guest_token: string }
        Returns: string
      }
      verify_order_guest_scope: {
        Args: {
          p_guest_owner_id: string
          p_guest_token: string
          p_order_id: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
