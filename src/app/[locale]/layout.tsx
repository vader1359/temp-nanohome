import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { isSupportedLocale, routing } from "@/i18n/routing";
import { Header } from "@/components/header";
import { Footer } from "@/components/sections/footer";
import { Providers } from "../providers";
import { AuthProvider } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/server";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

interface RootLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function RootLayout({ children, params }: RootLayoutProps) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <Providers>
        <Suspense fallback={null}>
          <AuthProvider isAuthenticated={claims !== null}>
            <Header />
            {children}
            <Footer />
          </AuthProvider>
        </Suspense>
      </Providers>
    </NextIntlClientProvider>
  );
}
