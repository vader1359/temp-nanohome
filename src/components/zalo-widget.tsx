"use client";

import { useEffect } from "react";

const ZALO_OA_ID = process.env.NEXT_PUBLIC_ZALO_OA_ID?.trim() || "3326148659494014741";

export function ZaloWidget() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(".zalo-chat-widget")) return;
      window.fbq?.("track", "Contact", { contact_method: "zalo_widget" });
    };
    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, []);

  return (
    <div className="zalo-chat-widget" data-oaid={ZALO_OA_ID} data-welcome-message="Rất vui khi được hỗ trợ bạn!" data-autopopup="4" data-width="350" data-height="420" suppressHydrationWarning />
  );
}
