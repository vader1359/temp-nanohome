import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables, TablesInsert, TablesUpdate } from "./database.types";

export type { Database, Json, Tables, TablesInsert, TablesUpdate } from "./database.types";

export type TypedSupabaseClient = SupabaseClient<Database, "public">;

export type Product = Tables<"products">;
export type ProductInsert = TablesInsert<"products">;
export type ProductUpdate = TablesUpdate<"products">;
export type Variant = Tables<"variants">;
export type Category = Tables<"categories">;
export type Brand = Tables<"brands">;
export type Designer = Tables<"designers">;
export type News = Tables<"news">;
export type Catalog = Tables<"catalogs">;
export type Cart = Tables<"carts">;
export type CartItem = Tables<"cart_items">;
export type Order = Tables<"orders">;
export type OrderInsert = TablesInsert<"orders">;
export type OrderItem = Tables<"order_items">;
export type Profile = Tables<"profiles">;
