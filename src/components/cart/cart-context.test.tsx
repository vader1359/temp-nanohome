import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";

const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
import {
  CartProvider,
  useCart,
  __test_cart_state__,
  type CartItem
} from "./cart-context";

const testItem: CartItem = {
  id: "item-1",
  name: "Product 1",
  category: "Category 1",
  quantity: 1,
  price: "100.000 ₫",
  badge: "Sale",
  badgeTone: "sale",
  image: "/img.png",
};

describe("CartContext hydration and delayed loading", () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    vi.useFakeTimers();
    __test_cart_state__.reset();
    store = {};

    // Mock window and localStorage
    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete store[key];
        }),
        clear: vi.fn(() => {
          store = {};
        }),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    __test_cart_state__.reset();
    vi.unstubAllGlobals();
  });

  it("delayed hydration retains mutation made before timeout", () => {
    // 1. Seed localStorage with some item.
    const storedItem: CartItem = { ...testItem, id: "stored-item", name: "Stored Item" };
    window.localStorage.setItem("nanohome.cart.items", JSON.stringify([storedItem]));

    // 2. Render provider and hook.
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CartProvider>{children}</CartProvider>
    );
    const { result } = renderHook(() => useCart(), { wrapper });

    // Initially, cartItems is empty because subscribeToCart starts a setTimeout (hydration).
    expect(result.current.items).toEqual([]);

    // 3. Perform a mutation (addItem) BEFORE hydration timeout fires.
    act(() => {
      result.current.addItem({ ...testItem, quantity: 2 });
    });

    // Verify local mutation is applied immediately to the state.
    expect(result.current.items).toEqual([{ ...testItem, quantity: 2 }]);

    // 4. Run the setTimeout hydration timer.
    act(() => {
      vi.runAllTimers();
    });

    // Since a mutation occurred before hydration, the version incremented,
    // so the delayed hydration should NOT overwrite the mutation.
    expect(result.current.items).toEqual([{ ...testItem, quantity: 2 }]);
  });

  it("hydrates storage when no mutation occurs before timeout", () => {
    // 1. Seed localStorage.
    const storedItem: CartItem = { ...testItem, id: "stored-item", name: "Stored Item" };
    window.localStorage.setItem("nanohome.cart.items", JSON.stringify([storedItem]));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CartProvider>{children}</CartProvider>
    );
    const { result } = renderHook(() => useCart(), { wrapper });

    // Initially empty
    expect(result.current.items).toEqual([]);

    // 2. Run timers without performing any mutation.
    act(() => {
      vi.runAllTimers();
    });

    // Hydrates from storage successfully.
    expect(result.current.items).toEqual([storedItem]);
  });

  it("notifies multiple subscribers on hydration", () => {
    const storedItem: CartItem = { ...testItem, id: "stored-item", name: "Stored Item" };
    window.localStorage.setItem("nanohome.cart.items", JSON.stringify([storedItem]));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CartProvider>{children}</CartProvider>
    );

    // Render multiple instances to subscribe multiple times.
    const { result: hook1 } = renderHook(() => useCart(), { wrapper });
    const { result: hook2 } = renderHook(() => useCart(), { wrapper });

    // Initially, both see empty cart.
    expect(hook1.current.items).toEqual([]);
    expect(hook2.current.items).toEqual([]);

    // Both should be in listeners count.
    expect(__test_cart_state__.getListenersCount()).toBeGreaterThanOrEqual(2);

    // Run timers.
    act(() => {
      vi.runAllTimers();
    });

    // Both hooks must be notified and receive the hydrated storage value.
    expect(hook1.current.items).toEqual([storedItem]);
    expect(hook2.current.items).toEqual([storedItem]);
  });
});

const variantId = "00000000-0000-4000-8000-000000000001";
const accountCart = {
  items: [{
    available: true,
    href: "/vi/products/product-1",
    lineTotal: { amount: 100000, currency: "VND" },
    quantity: 1,
    title: "Product 1",
    unitPrice: { amount: 100000, currency: "VND" },
    variantId,
  }],
  total: { amount: 100000, currency: "VND" },
  version: 3,
} as const;

describe("CartContext authenticated synchronization", () => {
  beforeEach(() => {
    vi.useRealTimers();
    __test_cart_state__.reset();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
    navigation.refresh.mockReset();
  });

  afterEach(() => {
    __test_cart_state__.reset();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
    vi.unstubAllGlobals();
  });

  it("automatically merges selection-only guest items and clears storage after acknowledgement", async () => {
    window.history.replaceState({}, "", "/vi/checkout");
    const guestItem = { ...testItem, id: variantId, quantity: 2 };
    window.localStorage.setItem("nanohome.cart.items", JSON.stringify([guestItem]));
    const mergedCart = {
      ...accountCart,
      items: [{ ...accountCart.items[0], quantity: 2 }],
      version: 4,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ cart: mergedCart }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CartProvider isAuthenticated>{children}</CartProvider>
    );
    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => expect(result.current.isSyncing).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/account/cart/merge-guest");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.items).toEqual([{ quantity: 2, variantId }]);
    expect(Object.keys(body.items[0]).sort()).toEqual(["quantity", "variantId"]);
    expect(result.current.items).toEqual([
      expect.objectContaining({ id: variantId, name: "Product 1", quantity: 2 }),
    ]);
    expect(window.localStorage.getItem("nanohome.cart.items")).toBeNull();
    expect(window.localStorage.getItem("nanohome.cart.account-merge")).toBeNull();
    expect(navigation.refresh).toHaveBeenCalledOnce();
  });

  it("loads the authoritative account cart when no guest draft exists", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ cart: accountCart }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CartProvider isAuthenticated>{children}</CartProvider>
    );
    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => expect(result.current.items[0]?.id).toBe(variantId));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/cart",
      expect.objectContaining({ method: "GET" }),
    );
    expect(window.localStorage.getItem("nanohome.cart.items")).toBeNull();
  });

  it("serializes an authenticated add with the latest expected version", async () => {
    const updatedCart = {
      ...accountCart,
      items: [{ ...accountCart.items[0], quantity: 2 }],
      version: 4,
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ cart: accountCart }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ cart: updatedCart }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CartProvider isAuthenticated>{children}</CartProvider>
    );
    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.items[0]?.quantity).toBe(1));

    act(() => {
      result.current.addItem({ ...testItem, id: variantId, quantity: 1 });
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.isSyncing).toBe(false));

    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body).toEqual({ expectedVersion: 3, quantity: 1, variantId });
    expect(result.current.items[0]?.quantity).toBe(2);
    expect(window.localStorage.getItem("nanohome.cart.items")).toBeNull();
  });

  it("reconciles a version conflict and exposes a blocking sync error", async () => {
    const conflictCart = {
      ...accountCart,
      items: [{ ...accountCart.items[0], quantity: 3 }],
      version: 4,
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ cart: accountCart }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ cart: conflictCart }), { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CartProvider isAuthenticated>{children}</CartProvider>
    );
    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.items[0]?.quantity).toBe(1));

    act(() => {
      result.current.addItem({ ...testItem, id: variantId, quantity: 1 });
    });

    await waitFor(() => expect(result.current.syncError).toContain("phiên khác"));
    expect(result.current.items[0]?.quantity).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reuses the persisted merge key when retrying after a failed acknowledgement", async () => {
    const guestItem = { ...testItem, id: variantId };
    window.localStorage.setItem("nanohome.cart.items", JSON.stringify([guestItem]));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "temporary" }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ cart: accountCart }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CartProvider isAuthenticated>{children}</CartProvider>
    );
    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.syncError).not.toBeNull());
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(window.localStorage.getItem("nanohome.cart.items")).not.toBeNull();

    act(() => result.current.retrySync());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.syncError).toBeNull());

    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(secondBody.idempotencyKey).toBe(firstBody.idempotencyKey);
    expect(window.localStorage.getItem("nanohome.cart.items")).toBeNull();
  });
});
