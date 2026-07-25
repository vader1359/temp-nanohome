import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { isSupportedLocale } from "@/i18n/routing";

interface AccountLayoutProps {
  readonly children: React.ReactNode;
  readonly params: Promise<Readonly<{ locale: string }>>;
}

const accountSections = [
  { href: "", label: "Hồ sơ" },
  { href: "/orders", label: "Đơn hàng" },
  { href: "/wishlist", label: "Yêu thích" },
  { href: "/cart", label: "Giỏ hàng" },
  { href: "/offers", label: "Ưu đãi" },
  { href: "/preferences", label: "Tùy chọn" },
  { href: "/security", label: "Bảo mật" },
] as const;

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children, params }: AccountLayoutProps) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <div className="bg-[var(--nh-surface-warm)] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto grid max-w-[1344px] gap-6 lg:grid-cols-[256px_minmax(0,1fr)] lg:gap-8">
        <aside className="rounded-sm border border-[var(--nh-border)] bg-white p-4 sm:p-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--nh-ink)]">Tài khoản</h1>
          <nav aria-label="Tài khoản" className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-1">
            {accountSections.map((section) => (
              <Link
                className="flex min-h-11 items-center border-l-2 border-transparent px-3 py-2 text-sm font-medium text-[var(--nh-muted)] transition-colors hover:border-[var(--nh-accent)] hover:text-[var(--nh-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nh-accent)]"
                href={`/${locale}/account${section.href}`}
                key={section.href}
              >
                {section.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 rounded-sm border border-[var(--nh-border)] bg-white p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
