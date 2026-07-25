import { getAccountAuthPort, getAccountSecurityPort } from "@/lib/account/account-ports.server";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

export async function GET() {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return Response.json({ error: "Authentication required" }, { headers: privateHeaders, status: 401 });
  return Response.json(await getAccountSecurityPort().getSecurity(account), { headers: privateHeaders });
}
