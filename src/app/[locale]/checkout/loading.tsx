export default function CheckoutLoading() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
      <div className="size-8 animate-spin rounded-full border-4 border-nh-ink/20 border-t-nh-ink" />
      <p className="text-[14px] text-nh-muted">Đang mở trang thanh toán...</p>
    </div>
  );
}
