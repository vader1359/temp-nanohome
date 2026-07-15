import { Suspense } from "react";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { isSupportedLocale, routing } from "@/i18n/routing";
import { Header } from "@/components/header";
import { Footer } from "@/components/sections/footer";
import { Providers } from "../providers";
import { AuthProvider } from "@/components/auth/auth-provider";
import { Toaster } from "@/components/ui/sonner";
import { createClient } from "@/lib/supabase/server";
import { getLocalizedMetadata } from "@/lib/site-metadata";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

interface RootLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Pick<RootLayoutProps, "params">): Promise<Metadata> {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    return {};
  }

  return getLocalizedMetadata(locale);
}

export default async function RootLayout({ children, params }: RootLayoutProps) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const supabase = await createClient();
  let isAuthenticated = false;
  try {
    const { data } = await supabase.auth.getSession();
    isAuthenticated = data?.session != null;
  } catch (error) {
    console.error("Supabase layout session error:", error);
  }

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <div className="locale-shell" lang={locale}>
        <Providers>
          <Toaster position="top-center" offset="168px" mobileOffset="96px" />
          <Suspense fallback={null}>
            <AuthProvider isAuthenticated={isAuthenticated}>
              <Header />
              {children}
              <Footer />
            </AuthProvider>
          </Suspense>
        </Providers>
      </div>
    </NextIntlClientProvider>
  );
}
