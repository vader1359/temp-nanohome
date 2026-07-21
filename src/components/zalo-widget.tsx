"use client";

import { useEffect } from "react";

export function ZaloWidget() {
  const zaloOaId = process.env.NEXT_PUBLIC_ZALO_OA_ID?.trim();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(".zalo-chat-widget")) return;
      window.fbq?.("track", "Contact", { contact_method: "zalo_widget" });
    };
    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      document.querySelectorAll("[data-nanohome-tracker='zalo'], .zalo-chat-widget").forEach((element) => element.remove());
    };
  }, []);

  if (!zaloOaId) return null;

  return (
    <div className="zalo-chat-widget zalo-widget-shell" data-nanohome-tracker="zalo" data-oaid={zaloOaId} data-welcome-message="Rất vui khi được hỗ trợ bạn!" data-autopopup="4" data-width="350" data-height="420" suppressHydrationWarning />
  );
}
