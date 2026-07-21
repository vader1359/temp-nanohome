export const customerIdentityCookieNames = {
  visitor: "nano_visitor_id",
  session: "nano_session_id",
} as const;

const tokenPattern = /^[a-f0-9]{64}$/;

export type CustomerIdentity = Readonly<{ visitorId: string; sessionId: string }>;
export type CustomerCookie = Readonly<{
  name: string;
  value: string;
  httpOnly: true;
  secure: true;
  sameSite: "lax";
  path: "/";
}>;
export type IssuedCustomerIdentity = CustomerIdentity & Readonly<{ cookies: readonly CustomerCookie[] }>;

const identityValue = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const validToken = (value: string | undefined): value is string => value !== undefined && tokenPattern.test(value);

export const readCustomerIdentity = (cookies: Readonly<{ visitor?: string; session?: string }>): CustomerIdentity | null => {
  if (!validToken(cookies.visitor) || !validToken(cookies.session)) return null;
  return { visitorId: cookies.visitor, sessionId: cookies.session };
};

export const issueCustomerIdentity = (): IssuedCustomerIdentity => {
  const visitorId = identityValue();
  const sessionId = identityValue();
  return {
    visitorId,
    sessionId,
    cookies: [
      { name: customerIdentityCookieNames.visitor, value: visitorId, httpOnly: true, secure: true, sameSite: "lax", path: "/" },
      { name: customerIdentityCookieNames.session, value: sessionId, httpOnly: true, secure: true, sameSite: "lax", path: "/" },
    ],
  };
};

export const resolveCustomerIdentity = (cookies: Readonly<{ visitor?: string; session?: string }>): Readonly<{
  identity: CustomerIdentity;
  cookies: readonly CustomerCookie[];
}> => {
  const existing = readCustomerIdentity(cookies);
  if (existing !== null) return { identity: existing, cookies: [] };
  const issued = issueCustomerIdentity();
  return { identity: { visitorId: issued.visitorId, sessionId: issued.sessionId }, cookies: issued.cookies };
};

export const customerTokens = (cookies: Readonly<{ visitor?: string; session?: string }>): Readonly<{ visitor: string; session: string }> | null => {
  if (!validToken(cookies.visitor) || !validToken(cookies.session)) return null;
  return { visitor: cookies.visitor, session: cookies.session };
};
