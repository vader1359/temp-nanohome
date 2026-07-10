import { setRequestLocale } from "next-intl/server";

import { ResetPasswordForm, type ResetPasswordStatus } from "@/components/auth/reset-password-form";

interface ResetPasswordPageProps {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<{ status?: string }>;
}

function getResetPasswordStatus(status: string | undefined): ResetPasswordStatus {
  if (status === "success" || status === "invalid" || status === "error" || status === "validation") {
    return status;
  }

  return undefined;
}

export default async function ResetPasswordPage({ params, searchParams }: ResetPasswordPageProps) {
  const [{ locale }, { status }] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  return <ResetPasswordForm status={getResetPasswordStatus(status)} />;
}
