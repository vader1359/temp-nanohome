import { setRequestLocale } from "next-intl/server";

import { CheckEmailView } from "@/components/auth/check-email-view";

interface CheckEmailPageProps {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<{ signup?: string }>;
}

export default async function CheckEmailPage({ params, searchParams }: CheckEmailPageProps) {
  const { locale } = await params;
  const { signup } = await searchParams;
  setRequestLocale(locale);

  return <CheckEmailView signupCompleted={signup === "success"} />;
}
