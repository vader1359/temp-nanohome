import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/types/db";

export async function getOrdersByUserId(userId: string): Promise<readonly Order[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error !== null) {
    throw error;
  }

  return data ?? [];
}
