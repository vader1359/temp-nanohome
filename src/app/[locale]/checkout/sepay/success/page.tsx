"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * SePay success redirect page.
 * 
 * CRITICAL: This page NEVER marks an order paid from URL params.
 * It queries /api/orders/[orderId]/payment-status for server state.
 * 
 * Foundation prerequisite: payment-status route with owner authorization.
 */
export default function SePaySuccessPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [status, setStatus] = useState<"loading" | "paid" | "pending" | "error">("loading");

  useEffect(() => {
    if (!orderId) {
      setStatus("error");
      return;
    }

    // Query server state, never trust redirect params
    fetch(`/api/orders/${orderId}/payment-status`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error === "not_implemented") {
          setStatus("pending");
        } else if (data.paymentState === "paid") {
          setStatus("paid");
        } else {
          setStatus("pending");
        }
      })
      .catch(() => setStatus("error"));
  }, [orderId]);

  if (status === "loading") {
    return <div>Đang kiểm tra trạng thái thanh toán...</div>;
  }

  if (status === "paid") {
    return (
      <div>
        <h1>Thanh toán thành công</h1>
        <p>Đơn hàng của bạn đã được xác nhận.</p>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div>
        <h1>Đang chờ xác nhận</h1>
        <p>Chúng tôi đang xác minh thanh toán của bạn. Vui lòng đợi trong giây lát.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Có lỗi xảy ra</h1>
      <p>Không thể kiểm tra trạng thái thanh toán.</p>
    </div>
  );
}
