"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type CartItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  price: string;
  originalPrice?: string;
  discount?: string;
  badge: string;
  badgeTone: "sale" | "stock";
  image: string;
};

type AddCartItem = Omit<CartItem, "quantity"> & { quantity?: number };

type CartContextValue = {
  items: CartItem[];
  addItem: (item: AddCartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getItemCount: () => number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((newItem: AddCartItem) => {
    const qty = Math.max(1, Math.floor(newItem.quantity ?? 1));
    setItems((prev) => {
      const existing = prev.findIndex((item) => item.id === newItem.id);
      if (existing !== -1) {
        const updated = [...prev];
        updated[existing] = {
          ...updated[existing],
          quantity: updated[existing].quantity + qty,
        };
        return updated;
      }

      return [...prev, { ...newItem, quantity: qty }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    const qty = Math.max(0, Math.floor(quantity));
    if (qty === 0) {
      setItems((prev) => prev.filter((item) => item.id !== id));
      return;
    }

    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, quantity: qty } : item)));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const getItemCount = useCallback(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      getItemCount,
    }),
    [items, addItem, removeItem, updateQuantity, clearCart, getItemCount],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === null) {
    throw new Error("useCart must be used within a CartProvider");
  }

  return context;
}
