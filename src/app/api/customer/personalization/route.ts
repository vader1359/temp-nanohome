import { NextResponse } from "next/server";
import { customerIdentityCookieNames, customerTokens } from "@/lib/customer-context/identity";
import { createCustomerRepository } from "@/lib/customer-context/repository";
import { AccountId } from "@/lib/account-session";
import {
  createSupabaseCustomerMemoryPort,
  createSupabaseCustomerMemoryProjectionReader,
} from "@/lib/amis-customer-memory/supabase-customer-memory-port";
import { createPersonalizationResolver } from "@/lib/personalization";
import { loadPlan07CustomerFeatures } from "@/lib/personalization/customer-runtime";
import { resolvePersonalizationSettings } from "@/lib/personalization/settings";
import { isSupportedLocale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
} as const;

const requestCookies = (request: Request): Readonly<{ visitor?: string; session?: string }> => {
  const values = new Map<string, string>();
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0) {
      values.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
    }
  }
  return {
    visitor: values.get(customerIdentityCookieNames.visitor),
    session: values.get(customerIdentityCookieNames.session),
  };
};

const json = (body: unknown, status = 200): NextResponse => NextResponse.json(body, {
  status,
  headers: responseHeaders,
});

const defaultPayload = (consent: boolean) => ({
  enabled: consent,
  consent,
  mode: "default" as const,
  preferences: [],
  recent: [],
  memoryConnected: false,
  memorySummary: null,
});

export const GET = async (request: Request): Promise<Response> => {
  const locale = new URL(request.url).searchParams.get("locale") ?? "vi";
  if (!isSupportedLocale(locale)) {
    return json({ error: "Unsupported locale" }, 400);
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return json({ error: "Authentication required" }, 401);
  }
  const accountId = new AccountId(userData.user.id);

  const settings = resolvePersonalizationSettings(undefined);
  if (!settings.enabled) {
    return json(defaultPayload(false));
  }

  const tokens = customerTokens(requestCookies(request));
  if (tokens === null) {
    return json(defaultPayload(false));
  }
  const customerRepository = createCustomerRepository(fetch);
  const identity = (await customerRepository.resolveIdentity(tokens)).identity;
  if (identity === null) {
    return json(defaultPayload(false));
  }
  const consent = await customerRepository.currentConsent(identity);
  const personalizationConsent = consent?.personalization === true && consent.withdrawn !== true;
  if (!personalizationConsent) {
    return json(defaultPayload(false));
  }

  const features = await loadPlan07CustomerFeatures({
    userId: userData.user.id,
    visitorId: identity.visitorId,
  });
  const resolver = createPersonalizationResolver({
    memoryPort: createSupabaseCustomerMemoryPort({
      readProjection: createSupabaseCustomerMemoryProjectionReader(),
    }),
    flags: {
      personalizationEnabled: true,
      recentlyViewedEnabled: true,
      explicitPreferencesEnabled: true,
      customerMemoryEnabled: true,
    },
    settings,
  });
  const context = await resolver.resolve({
    accountId,
    consent: { personalization: true },
    locale,
    recent: features.recent,
    explicit: features.preferences,
    now: new Date().toISOString(),
  });

  return json({
    enabled: true,
    consent: true,
    mode: context.mode,
    preferences: context.explicit,
    recent: context.recent,
    memoryConnected: context.customerMemory !== undefined,
    memorySummary: null,
  });
};
