import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import React from "react";
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
