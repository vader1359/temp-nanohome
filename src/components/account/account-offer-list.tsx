import type { AccountOffer } from "@/lib/account/offers-port";
import { useLocale, useTranslations } from "next-intl";

function formatAmount(offer: AccountOffer, t: (key: string, params?: Record<string, unknown>) => string, locale: string): string {
  if (offer.minimumAmount === null) return t("offers.noMinimum");
  const formatted = new Intl.NumberFormat(locale, { style: "currency", currency: offer.minimumAmount.currency }).format(offer.minimumAmount.amount);
  return `${t("offers.minimumPrefix")} ${formatted}`;
}

export function AccountOfferList({ offers }: Readonly<{ offers: readonly AccountOffer[] }>) {
  const locale = useLocale();
  const t = useTranslations("Account");
  if (offers.length === 0) return <p className="mt-8 border-t border-[var(--nh-border)] pt-6 text-sm leading-6 text-[var(--nh-muted)]">{t("offers.empty")}</p>;
  return <ul aria-label={t("offers.listLabel")} className="mt-8 grid gap-4 sm:grid-cols-2">{offers.map((offer) => <li className="border border-[var(--nh-border)] p-5" key={offer.code}>
    <article aria-labelledby={`offer-${offer.code}`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="text-lg font-semibold text-[var(--nh-ink)]" id={`offer-${offer.code}`}>{offer.title}</h3><span className="border border-[var(--nh-border)] px-2 py-1 text-xs font-medium tracking-wide text-[var(--nh-ink)]">{offer.code}</span></div>
      <dl className="mt-5 grid gap-3 text-sm leading-6 text-[var(--nh-muted)]"><div><dt className="font-medium text-[var(--nh-ink)]">{t("offers.validityLabel")}</dt><dd><time dateTime={offer.validFrom}>{offer.validFrom}</time> – <time dateTime={offer.validUntil}>{offer.validUntil}</time></dd></div><div><dt className="font-medium text-[var(--nh-ink)]">{t("offers.scopeLabel")}</dt><dd>{offer.eligibleScope}</dd></div><div><dt className="font-medium text-[var(--nh-ink)]">{t("offers.minimumLabel")}</dt><dd>{formatAmount(offer, t, locale)}</dd></div><div><dt className="font-medium text-[var(--nh-ink)]">{t("offers.combinationLabel")}</dt><dd>{offer.combinationRule}</dd></div></dl>
      <p className="mt-5 border-t border-[var(--nh-border)] pt-4 text-sm text-[var(--nh-muted)]">{offer.status === "active" ? t("offers.remainingUses", { count: offer.remainingUses }) : offer.status === "expired" ? t("offers.statusExpired") : t("offers.statusUsed")}</p>
    </article>
  </li>)}</ul>;
}

export function AccountOffersUnavailable() {
  const t = useTranslations("Account");
  return <section aria-labelledby="account-offers-title"><h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-offers-title">{t("offers.title")}</h2><p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">{t("offers.unavailable")}</p></section>;
}
