"use client";

import { useSearchParams } from "next/navigation";

/**
 * SePay error redirect page.
 * 
 * Displays when payment gateway returns an error.
 * User can retry with the same order.
 */
export default function SePayErrorPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  return (
    <div>
      <h1>Thanh toán không thành công</h1>
      <p>Đã có lỗi xảy ra trong quá trình thanh toán.</p>
      {orderId && (
        <p>
          <a href={`/vi/orders/${orderId}`}>Xem chi tiết đơn hàng</a>
          {" hoặc "}
          <a href={`/vi/checkout?orderId=${orderId}`}>Thử lại</a>
        </p>
      )}
    </div>
  );
}
