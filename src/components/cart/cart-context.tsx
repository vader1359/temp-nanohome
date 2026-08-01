"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { AccountCart } from "@/lib/account/cart-port";

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
  isSyncing: boolean;
  syncError: string | null;
  reconcileAccountCart: (cart: AccountCart) => void;
  retrySync: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const CART_STORAGE_KEY = "nanohome.cart.items";
const CART_MERGE_STATE_KEY = "nanohome.cart.account-merge";
const emptyCartItems: CartItem[] = [];
let cartItems = emptyCartItems;
let cartStorageRead = false;
let cartVersion = 0;
const cartListeners = new Set<() => void>();

// Exported purely for testing setup/cleanup
export const __test_cart_state__ = {
  reset() {
    cartItems = emptyCartItems;
    cartStorageRead = false;
    cartVersion = 0;
    cartListeners.clear();
  },
  getListenersCount() {
    return cartListeners.size;
  },
};

function getCartItems(): CartItem[] {
  return cartItems;
}

function notifyCartListeners(): void {
  cartVersion++;
  cartListeners.forEach((listener) => listener());
}

function replaceCartItems(nextItems: CartItem[], persistGuest: boolean): void {
  cartItems = nextItems;
  if (persistGuest) {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch {
      // Keep the in-memory cart usable when storage is unavailable.
    }
  }
  notifyCartListeners();
}

function subscribeToCart(listener: () => void): () => void {
  cartListeners.add(listener);
  if (!cartStorageRead) {
    cartStorageRead = true;
    const initialVersion = cartVersion;
    setTimeout(() => {
      if (cartVersion === initialVersion) {
        replaceCartItems(readStoredCartItems(), false);
      }
    }, 0);
  }
  return () => cartListeners.delete(listener);
}

function updateCartItems(
  update: (items: CartItem[]) => CartItem[],
  persistGuest: boolean,
): void {
  replaceCartItems(update(getCartItems()), persistGuest);
}

type AccountCartResponse = Readonly<{ readonly cart: AccountCart }>;

function isAccountCartResponse(value: unknown): value is AccountCartResponse {
  if (typeof value !== "object" || value === null || !("cart" in value)) return false;
  const cart = value.cart;
  return (
    typeof cart === "object" &&
    cart !== null &&
    "items" in cart &&
    Array.isArray(cart.items) &&
    "version" in cart &&
    typeof cart.version === "number" &&
    Number.isInteger(cart.version)
  );
}

async function requestAccountCart(
  input: RequestInit & Readonly<{ readonly url: string }>,
): Promise<Readonly<{ readonly cart: AccountCart; readonly ok: boolean; readonly status: number }>> {
  const { url, ...init } = input;
  const response = await fetch(url, init);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("invalid_cart_response");
  }
  if (!isAccountCartResponse(body)) throw new Error("invalid_cart_response");
  return { cart: body.cart, ok: response.ok, status: response.status };
}

function formatVnd(amount: number): string {
  if (amount <= 0) return "Liên hệ";
  return new Intl.NumberFormat("vi-VN", {
    currency: "VND",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

function presentAccountCart(cart: AccountCart, previousItems: CartItem[]): CartItem[] {
  const previousById = new Map(previousItems.map((item) => [item.id, item]));
  return cart.items.map((item) => {
    const previous = previousById.get(item.variantId);
    return {
      id: item.variantId,
      name: item.title,
      category: previous?.category ?? "",
      quantity: item.quantity,
      price: formatVnd(item.unitPrice.amount),
      badge: item.available ? "Còn hàng" : "Không khả dụng",
      badgeTone: "stock",
      image: previous?.image ?? "/images/p_lc2.png",
    };
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getGuestSelection(items: CartItem[]) {
  return items
    .map((item) => ({ quantity: Math.min(10, item.quantity), variantId: item.id }))
    .sort((left, right) => left.variantId.localeCompare(right.variantId));
}

function getOrCreateMergeKey(fingerprint: string): string {
  try {
    const stored = window.localStorage.getItem(CART_MERGE_STATE_KEY);
    if (stored !== null) {
      const parsed: unknown = JSON.parse(stored);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "fingerprint" in parsed &&
        parsed.fingerprint === fingerprint &&
        "idempotencyKey" in parsed &&
        typeof parsed.idempotencyKey === "string"
      ) {
        return parsed.idempotencyKey;
      }
    }
  } catch {
    // Replace malformed or inaccessible merge state below.
  }

  const idempotencyKey = globalThis.crypto.randomUUID();
  try {
    window.localStorage.setItem(
      CART_MERGE_STATE_KEY,
      JSON.stringify({ fingerprint, idempotencyKey }),
    );
  } catch {
    // The server still receives a valid key; only retry persistence is degraded.
  }
  return idempotencyKey;
}

function accountMutationError(status: number): Error {
  if (status === 409) return new Error("version_conflict");
  if (status === 422) return new Error("variant_unavailable");
  if (status === 401) return new Error("authentication_required");
  return new Error("cart_sync_failed");
}

function accountMutationMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === "version_conflict") {
      return "Giỏ hàng đã thay đổi ở phiên khác. Vui lòng thử lại thao tác.";
    }
    if (error.message === "variant_unavailable") {
      return "Sản phẩm hoặc số lượng tồn kho đã thay đổi. Vui lòng kiểm tra lại giỏ hàng.";
    }
    if (error.message === "invalid_guest_cart") {
      return "Giỏ hàng khách có dữ liệu không hợp lệ nên chưa thể nhập vào tài khoản.";
    }
    if (error.message === "authentication_required") {
      return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    }
  }
  return "Không thể đồng bộ giỏ hàng. Vui lòng thử lại.";
}

export function CartProvider({
  children,
  isAuthenticated = false,
}: {
  children: ReactNode;
  isAuthenticated?: boolean;
}) {
  const router = useRouter();
  const items = useSyncExternalStore(subscribeToCart, getCartItems, () => emptyCartItems);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const accountVersionRef = useRef(0);
  const accountQueueRef = useRef<Promise<void>>(Promise.resolve());
  const isAuthenticatedRef = useRef(isAuthenticated);
  const wasAuthenticatedRef = useRef(isAuthenticated);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reconcileAccountCart = useCallback((cart: AccountCart) => {
    if (!isAuthenticatedRef.current) return;
    accountVersionRef.current = cart.version;
    updateCartItems((previous) => presentAccountCart(cart, previous), false);
    if (mountedRef.current) setSyncError(null);
  }, []);

  const refreshCheckout = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      /^\/(?:vi|en|ko)\/checkout\/?$/.test(window.location.pathname)
    ) {
      router.refresh();
    }
  }, [router]);

  const enqueueAccountOperation = useCallback((operation: () => Promise<void>) => {
    if (mountedRef.current) {
      setPendingSyncs((count) => count + 1);
      setSyncError(null);
    }

    const task = accountQueueRef.current.catch(() => undefined).then(operation);
    accountQueueRef.current = task.catch(() => undefined);
    void task
      .catch((error: unknown) => {
        if (mountedRef.current && isAuthenticatedRef.current) {
          setSyncError(accountMutationMessage(error));
        }
      })
      .finally(() => {
        if (mountedRef.current) {
          setPendingSyncs((count) => Math.max(0, count - 1));
        }
      });
  }, []);

  const syncAuthenticatedCart = useCallback(() => {
    enqueueAccountOperation(async () => {
      const guestItems = readStoredCartItems();
      if (guestItems.length === 0) {
        const result = await requestAccountCart({
          cache: "no-store",
          method: "GET",
          url: "/api/account/cart",
        });
        if (!result.ok) throw accountMutationError(result.status);
        reconcileAccountCart(result.cart);
        return;
      }

      if (guestItems.some((item) => !isUuid(item.id))) {
        throw new Error("invalid_guest_cart");
      }
      const selection = getGuestSelection(guestItems);
      const fingerprint = JSON.stringify(selection);
      const idempotencyKey = getOrCreateMergeKey(fingerprint);
      const result = await requestAccountCart({
        body: JSON.stringify({ idempotencyKey, items: selection }),
        headers: { "content-type": "application/json" },
        method: "POST",
        url: "/api/account/cart/merge-guest",
      });
      if (!result.ok) throw accountMutationError(result.status);
      if (!isAuthenticatedRef.current) return;

      reconcileAccountCart(result.cart);
      try {
        window.localStorage.removeItem(CART_STORAGE_KEY);
        window.localStorage.removeItem(CART_MERGE_STATE_KEY);
      } catch {
        // A successful server merge is authoritative even if cleanup is unavailable.
      }
      refreshCheckout();
    });
  }, [enqueueAccountOperation, reconcileAccountCart, refreshCheckout]);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;

    if (!isAuthenticated) {
      accountVersionRef.current = 0;
      if (wasAuthenticatedRef.current) {
        replaceCartItems(readStoredCartItems(), false);
      }
      wasAuthenticatedRef.current = false;
      return;
    }

    wasAuthenticatedRef.current = true;
    syncAuthenticatedCart();
  }, [isAuthenticated, syncAuthenticatedCart]);

  const retrySync = useCallback(() => {
    if (isAuthenticatedRef.current) syncAuthenticatedCart();
  }, [syncAuthenticatedCart]);

  const refreshAccountCart = useCallback(async () => {
    const result = await requestAccountCart({
      cache: "no-store",
      method: "GET",
      url: "/api/account/cart",
    });
    if (!result.ok) throw accountMutationError(result.status);
    reconcileAccountCart(result.cart);
  }, [reconcileAccountCart]);

  const mutateAccountCart = useCallback(async (
    method: "POST" | "PATCH" | "DELETE",
    variantId: string,
    quantity?: number,
  ) => {
    try {
      const result = await requestAccountCart({
        body: JSON.stringify({
          expectedVersion: accountVersionRef.current,
          ...(quantity === undefined ? {} : { quantity }),
          variantId,
        }),
        headers: { "content-type": "application/json" },
        method,
        url: "/api/account/cart",
      });
      reconcileAccountCart(result.cart);
      refreshCheckout();
      if (!result.ok) throw accountMutationError(result.status);
    } catch (error: unknown) {
      if (!(error instanceof Error) || !["version_conflict", "variant_unavailable"].includes(error.message)) {
        try {
          await refreshAccountCart();
        } catch {
          // Preserve the original mutation error when reconciliation also fails.
        }
      }
      throw error;
    }
  }, [reconcileAccountCart, refreshAccountCart, refreshCheckout]);

  const addItem = useCallback((newItem: AddCartItem) => {
    const requestedQuantity = Math.min(10, Math.max(1, Math.floor(newItem.quantity ?? 1)));
    const currentQuantity = getCartItems().find((item) => item.id === newItem.id)?.quantity ?? 0;
    const quantityToAdd = Math.min(requestedQuantity, Math.max(0, 10 - currentQuantity));
    if (quantityToAdd === 0) return;

    updateCartItems((previous) => {
      const existing = previous.findIndex((item) => item.id === newItem.id);
      if (existing !== -1) {
        const updated = [...previous];
        updated[existing] = {
          ...updated[existing],
          quantity: updated[existing].quantity + quantityToAdd,
        };
        return updated;
      }
      return [...previous, { ...newItem, quantity: quantityToAdd }];
    }, !isAuthenticated);

    if (isAuthenticated) {
      enqueueAccountOperation(() => mutateAccountCart("POST", newItem.id, quantityToAdd));
    }
  }, [enqueueAccountOperation, isAuthenticated, mutateAccountCart]);

  const removeItem = useCallback((id: string) => {
    updateCartItems((previous) => previous.filter((item) => item.id !== id), !isAuthenticated);
    if (isAuthenticated) {
      enqueueAccountOperation(() => mutateAccountCart("DELETE", id));
    }
  }, [enqueueAccountOperation, isAuthenticated, mutateAccountCart]);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    const nextQuantity = Math.min(10, Math.max(0, Math.floor(quantity)));
    updateCartItems(
      (previous) => nextQuantity === 0
        ? previous.filter((item) => item.id !== id)
        : previous.map((item) => item.id === id ? { ...item, quantity: nextQuantity } : item),
      !isAuthenticated,
    );
    if (isAuthenticated) {
      enqueueAccountOperation(() => mutateAccountCart(
        nextQuantity === 0 ? "DELETE" : "PATCH",
        id,
        nextQuantity === 0 ? undefined : nextQuantity,
      ));
    }
  }, [enqueueAccountOperation, isAuthenticated, mutateAccountCart]);

  const clearCart = useCallback(() => {
    const variantIds = getCartItems().map((item) => item.id);
    updateCartItems(() => [], !isAuthenticated);
    if (isAuthenticated && variantIds.length > 0) {
      enqueueAccountOperation(async () => {
        for (const variantId of variantIds) {
          await mutateAccountCart("DELETE", variantId);
        }
      });
    }
  }, [enqueueAccountOperation, isAuthenticated, mutateAccountCart]);

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
      isSyncing: pendingSyncs > 0,
      syncError,
      reconcileAccountCart,
      retrySync,
    }),
    [
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      getItemCount,
      pendingSyncs,
      syncError,
      reconcileAccountCart,
      retrySync,
    ],
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

function readStoredCartItems(): CartItem[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(CART_STORAGE_KEY);
    if (stored === null) return [];

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isCartItem);
  } catch {
    return [];
  }
}

function isCartItem(item: unknown): item is CartItem {
  if (typeof item !== "object" || item === null) return false;

  const candidate = item as Partial<CartItem>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.category === "string" &&
    typeof candidate.quantity === "number" &&
    Number.isInteger(candidate.quantity) &&
    candidate.quantity > 0 &&
    typeof candidate.price === "string" &&
    (candidate.originalPrice === undefined || typeof candidate.originalPrice === "string") &&
    (candidate.discount === undefined || typeof candidate.discount === "string") &&
    typeof candidate.badge === "string" &&
    (candidate.badgeTone === "sale" || candidate.badgeTone === "stock") &&
    typeof candidate.image === "string"
  );
}
