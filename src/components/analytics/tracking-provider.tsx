"use client";

import { useCallback, useEffect, useState } from "react";
import { clientCustomerContextSchema, type ClientCustomerContext } from "@/lib/contracts/schemas";
import { ClarityTracker } from "./clarity-tracker";
import { MetaPageViewTracker } from "./meta-pageview-tracker";
import { MetaPixel } from "./meta-pixel";
import { ZaloWidget } from "../zalo-widget";

export function TrackingProvider() {
  const [context, setContext] = useState<ClientCustomerContext | null>(null);
  const loadContext = useCallback((signal: AbortSignal) => {
    void fetch("/api/customer/context", { credentials: "same-origin", signal })
      .then(async (response) => clientCustomerContextSchema.safeParse(await response.json()))
      .then((result) => {
        if (result.success) setContext(result.data);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) console.warn("Customer context unavailable");
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadContext(controller.signal);
    const refresh = () => loadContext(controller.signal);
    window.addEventListener("nanohome:customer-context-changed", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("nanohome:customer-context-changed", refresh);
    };
  }, [loadContext]);

  const analyticsTracking = context?.capabilities.analyticsTracking === true;
  const marketingTracking = context?.capabilities.marketingTracking === true;
  if (!analyticsTracking && !marketingTracking) return null;
  return <div data-nanohome-trackers="active">
    {analyticsTracking ? <ClarityTracker /> : null}
    {marketingTracking ? <><MetaPixel /><MetaPageViewTracker /><ZaloWidget /></> : null}
  </div>;
}
