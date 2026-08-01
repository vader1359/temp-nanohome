"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CartProvider } from "@/components/cart/cart-context";
import { WishlistProvider } from "@/components/wishlist/wishlist-context";

export function Providers({
  children,
  isAuthenticated,
}: {
  children: React.ReactNode;
  isAuthenticated: boolean;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WishlistProvider>
        <CartProvider isAuthenticated={isAuthenticated}>{children}</CartProvider>
      </WishlistProvider>
    </QueryClientProvider>
  );
}
