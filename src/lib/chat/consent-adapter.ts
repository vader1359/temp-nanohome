import "server-only";

import {
  customerIdentityCookieNames,
  customerTokens,
} from "@/lib/customer-context/identity";
import {
  createCustomerRepository,
  type CustomerRepository,
} from "@/lib/customer-context/repository";

type ConsentRepository = Pick<CustomerRepository, "currentConsent" | "resolveIdentity">;

function requestCookies(request: Request): Readonly<{
  visitor?: string;
  session?: string;
}> {
  const values = new Map<string, string>();
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    values.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  return {
    visitor: values.get(customerIdentityCookieNames.visitor),
    session: values.get(customerIdentityCookieNames.session),
  };
}

export async function hasCurrentAiProcessingConsent(
  request: Request,
  repository: ConsentRepository = createCustomerRepository(fetch),
): Promise<boolean> {
  const tokens = customerTokens(requestCookies(request));
  if (tokens === null) return false;
  try {
    const lookup = await repository.resolveIdentity(tokens);
    if (lookup.identity === null || lookup.status !== "active") return false;
    const consent = await repository.currentConsent(lookup.identity);
    return consent?.aiProcessing === true && consent.withdrawn !== true;
  } catch {
    return false;
  }
}
