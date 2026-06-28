import { z } from "zod";

import { getSafeRedirectPath } from "./redirect";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  redirectTo: z.string().nullable(),
});

type AuthCredentials = {
  readonly email: string;
  readonly password: string;
  readonly redirectTo: string;
};

type ParseEmailPasswordFormResult =
  | { readonly ok: true; readonly value: AuthCredentials }
  | { readonly ok: false };

export function parseEmailPasswordForm(formData: FormData): ParseEmailPasswordFormResult {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo"),
  });

  if (!parsed.success) {
    return { ok: false };
  }

  return {
    ok: true,
    value: {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: getSafeRedirectPath(parsed.data.redirectTo),
    },
  };
}
