import { getAccountAuthPort, getAccountSecurityPort } from "@/lib/account/account-ports.server";
import { privateJson, withPrivateErrorBoundary } from "../private-response";

export const GET = withPrivateErrorBoundary(async (): Promise<Response> => {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);
  return privateJson(await getAccountSecurityPort().getSecurity(account));
});
