"use client";

import { useSearchParams } from "next/navigation";

/**
 * SePay cancel redirect page.
 * 
 * User explicitly cancelled or left the payment gateway.
 * Browser departure alone is not cancellation - order remains valid for retry.
 */
export default function SePayCancelPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  return (
    <div>
      <h1>Bạn đã hủy thanh toán</h1>
      <p>Đơn hàng của bạn vẫn còn hiệu lực.</p>
      {orderId && (
        <p>
          <a href={`/vi/orders/${orderId}`}>Xem chi tiết đơn hàng</a>
          {" hoặc "}
          <a href={`/vi/checkout?orderId=${orderId}`}>Tiếp tục thanh toán</a>
        </p>
      )}
    </div>
  );
}
