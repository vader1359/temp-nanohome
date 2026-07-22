"use client";

import { useEffect, useRef } from "react";
import { clientCustomerContextSchema } from "@/lib/contracts/schemas";

type ProductViewTrackerProps = Readonly<{
  productId: string;
  variantId: string;
}>;

export function ProductViewTracker({ productId, variantId }: ProductViewTrackerProps) {
  const idempotencyKey = useRef<string | null>(null);
  const pending = useRef(false);
  const sent = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const track = async () => {
      if (pending.current || sent.current) return;
      pending.current = true;
      try {
        const contextResponse = await fetch("/api/customer/context", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!contextResponse.ok) return;
        const context = clientCustomerContextSchema.safeParse(await contextResponse.json());
        if (
          !context.success
          || context.data.consent.analytics !== true
          || context.data.consent.personalization !== true
        ) return;

        idempotencyKey.current ??= `product_view_${crypto.randomUUID()}`;
        const eventResponse = await fetch("/api/customer/events", {
          body: JSON.stringify({
            name: "product_viewed",
            properties: { productId, variantId, placement: "pdp" },
            idempotencyKey: idempotencyKey.current,
          }),
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: controller.signal,
        });
        if (eventResponse.ok) sent.current = true;
      } catch (error: unknown) {
        if (!(error instanceof DOMException && error.name === "AbortError")) return;
      } finally {
        pending.current = false;
      }
    };

    void track();
    const refresh = () => { void track(); };
    window.addEventListener("nanohome:customer-context-changed", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("nanohome:customer-context-changed", refresh);
    };
  }, [productId, variantId]);

  return null;
}
