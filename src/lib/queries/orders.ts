import { createClient } from "@/lib/supabase/server";
import type { Order, OrderInsert } from "@/types/db";

export async function createOrder(data: OrderInsert): Promise<Order> {
  const supabase = await createClient();
  const { data: order, error } = await supabase.from("orders").insert([data]).select("*").single();

  if (error !== null) {
    throw error;
  }

  return order;
}

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
