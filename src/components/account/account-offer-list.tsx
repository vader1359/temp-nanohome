import type { AccountOffer } from "@/lib/account/offers-port";

function formatAmount(offer: AccountOffer): string {
  if (offer.minimumAmount === null) return "Không yêu cầu mức tối thiểu";
  return `Từ ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: offer.minimumAmount.currency }).format(offer.minimumAmount.amount)}`;
}

export function AccountOfferList({ offers }: Readonly<{ offers: readonly AccountOffer[] }>) {
  if (offers.length === 0) return <p className="mt-8 border-t border-[var(--nh-border)] pt-6 text-sm leading-6 text-[var(--nh-muted)]">Hiện chưa có ưu đãi dành cho bạn.</p>;
  return <ul aria-label="Danh sách ưu đãi" className="mt-8 grid gap-4 sm:grid-cols-2">{offers.map((offer) => <li className="border border-[var(--nh-border)] p-5" key={offer.code}>
    <article aria-labelledby={`offer-${offer.code}`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="text-lg font-semibold text-[var(--nh-ink)]" id={`offer-${offer.code}`}>{offer.title}</h3><span className="border border-[var(--nh-border)] px-2 py-1 text-xs font-medium tracking-wide text-[var(--nh-ink)]">{offer.code}</span></div>
      <dl className="mt-5 grid gap-3 text-sm leading-6 text-[var(--nh-muted)]"><div><dt className="font-medium text-[var(--nh-ink)]">Hiệu lực</dt><dd><time dateTime={offer.validFrom}>{offer.validFrom}</time> – <time dateTime={offer.validUntil}>{offer.validUntil}</time></dd></div><div><dt className="font-medium text-[var(--nh-ink)]">Áp dụng cho</dt><dd>{offer.eligibleScope}</dd></div><div><dt className="font-medium text-[var(--nh-ink)]">Đơn tối thiểu</dt><dd>{formatAmount(offer)}</dd></div><div><dt className="font-medium text-[var(--nh-ink)]">Kết hợp</dt><dd>{offer.combinationRule}</dd></div></dl>
      <p className="mt-5 border-t border-[var(--nh-border)] pt-4 text-sm text-[var(--nh-muted)]">{offer.status === "active" ? `Còn ${offer.remainingUses} lượt sử dụng` : offer.status === "expired" ? "Đã hết hạn" : "Đã sử dụng"}</p>
    </article>
  </li>)}</ul>;
}

export function AccountOffersUnavailable() {
  return <section aria-labelledby="account-offers-title"><h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-offers-title">Ưu đãi của tôi</h2><p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">Thông tin ưu đãi hiện chưa khả dụng.</p></section>;
}
