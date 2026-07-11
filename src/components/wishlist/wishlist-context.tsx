"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

export type WishlistItem = {
  id: string;
  name: string;
  category: string;
  price: string;
  originalPrice?: string | null;
  discount?: string | null;
  badge: string;
  badgeTone: "sale" | "stock" | "out";
  image: string;
  href: string;
};

type WishlistContextValue = {
  items: WishlistItem[];
  addItem: (item: WishlistItem) => void;
  removeItem: (id: string) => void;
  clearWishlist: () => void;
  toggleItem: (item: WishlistItem) => void;
  hasItem: (id: string) => boolean;
  getItemCount: () => number;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);
const WISHLIST_STORAGE_KEY = "nanohome.wishlist.items";
const emptyWishlistItems: WishlistItem[] = [];
let wishlistItems = emptyWishlistItems;
let wishlistStorageRead = false;
const wishlistListeners = new Set<() => void>();

function getWishlistItems(): WishlistItem[] {
  return wishlistItems;
}

function subscribeToWishlist(listener: () => void): () => void {
  wishlistListeners.add(listener);
  if (!wishlistStorageRead) {
    wishlistStorageRead = true;
    setTimeout(() => {
      wishlistItems = readStoredWishlistItems();
      listener();
    }, 0);
  }
  return () => wishlistListeners.delete(listener);
}

function updateWishlistItems(update: (items: WishlistItem[]) => WishlistItem[]): void {
  wishlistItems = update(getWishlistItems());
  try {
    window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistItems));
  } catch {
    // Ignore storage failures so wishlist interactions still work in memory.
  }
  wishlistListeners.forEach((listener) => listener());
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribeToWishlist, getWishlistItems, () => emptyWishlistItems);

  const addItem = useCallback((newItem: WishlistItem) => {
    updateWishlistItems((prev) => {
      const existing = prev.findIndex((item) => item.id === newItem.id);
      if (existing !== -1) {
        const updated = [...prev];
        updated[existing] = newItem;
        return updated;
      }

      return [...prev, newItem];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    updateWishlistItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearWishlist = useCallback(() => {
    updateWishlistItems(() => []);
  }, []);

  const toggleItem = useCallback((item: WishlistItem) => {
    updateWishlistItems((prev) => (prev.some((current) => current.id === item.id) ? prev.filter((current) => current.id !== item.id) : [...prev, item]));
  }, []);

  const hasItem = useCallback((id: string) => items.some((item) => item.id === id), [items]);

  const getItemCount = useCallback(() => items.length, [items]);

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      clearWishlist,
      toggleItem,
      hasItem,
      getItemCount,
    }),
    [items, addItem, removeItem, clearWishlist, toggleItem, hasItem, getItemCount],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (context === null) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }

  return context;
}

function readStoredWishlistItems(): WishlistItem[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (stored === null) return [];

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isWishlistItem);
  } catch {
    return [];
  }
}

function isWishlistItem(item: unknown): item is WishlistItem {
  if (typeof item !== "object" || item === null) return false;

  const candidate = item as Partial<WishlistItem>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.category === "string" &&
    typeof candidate.price === "string" &&
    (candidate.originalPrice === undefined || candidate.originalPrice === null || typeof candidate.originalPrice === "string") &&
    (candidate.discount === undefined || candidate.discount === null || typeof candidate.discount === "string") &&
    typeof candidate.badge === "string" &&
    (candidate.badgeTone === "sale" || candidate.badgeTone === "stock" || candidate.badgeTone === "out") &&
    typeof candidate.image === "string" &&
    typeof candidate.href === "string"
  );
}
