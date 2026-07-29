import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  getAuthenticatedAccount: vi.fn(),
  mutation: vi.fn(),
}));

vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountProfilePort: () => ({ patchProfile: ports.mutation }),
  getAccountWishlistPort: () => ({
    addItem: ports.mutation,
    mergeGuestItems: ports.mutation,
    removeItem: ports.mutation,
  }),
  getAccountPreferencesPort: () => ({
    clearRecommendationData: ports.mutation,
    disconnectAmis: ports.mutation,
    resetAmisHistory: ports.mutation,
    updatePreferences: ports.mutation,
  }),
  getAccountSecurityPort: () => ({
    beginDeletion: ports.mutation,
    confirmDeletion: ports.mutation,
    logoutCurrentSession: ports.mutation,
    requestAuthAction: ports.mutation,
    revokeAllSessions: ports.mutation,
  }),
}));

import { POST as mergeGuestState } from "./merge-guest-state/route";
import { PATCH as patchPreferences } from "./preferences/route";
import { POST as clearRecommendationData } from "./preferences/clear-recommendation-data/route";
import { POST as disconnectAmis } from "./preferences/disconnect-amis/route";
import { POST as resetAmis } from "./preferences/reset-amis/route";
import { PATCH as patchProfile } from "./profile/route";
import { POST as authAction } from "./security/auth-actions/route";
import { POST as deleteAccount } from "./security/deletion/route";
import { POST as logoutCurrent } from "./security/logout-current/route";
import { POST as revokeAll } from "./security/revoke-all/route";
import { DELETE as deleteWishlist, POST as addWishlist } from "./wishlist/route";

type MutationHandler = (request: Request) => Promise<Response>;

const cases: readonly Readonly<{
  name: string;
  handler: MutationHandler;
  method: "DELETE" | "PATCH" | "POST";
  path: string;
}>[] = [
  { name: "profile patch", handler: patchProfile, method: "PATCH", path: "/api/account/profile" },
  { name: "wishlist add", handler: addWishlist, method: "POST", path: "/api/account/wishlist" },
  { name: "wishlist delete", handler: deleteWishlist, method: "DELETE", path: "/api/account/wishlist" },
  { name: "guest wishlist merge", handler: mergeGuestState, method: "POST", path: "/api/account/merge-guest-state" },
  { name: "preferences patch", handler: patchPreferences, method: "PATCH", path: "/api/account/preferences" },
  { name: "recommendation clear", handler: clearRecommendationData, method: "POST", path: "/api/account/preferences/clear-recommendation-data" },
  { name: "AMIS disconnect", handler: disconnectAmis, method: "POST", path: "/api/account/preferences/disconnect-amis" },
  { name: "AMIS reset", handler: resetAmis, method: "POST", path: "/api/account/preferences/reset-amis" },
  { name: "auth action", handler: authAction, method: "POST", path: "/api/account/security/auth-actions" },
  { name: "account deletion", handler: deleteAccount, method: "POST", path: "/api/account/security/deletion" },
  { name: "current logout", handler: logoutCurrent, method: "POST", path: "/api/account/security/logout-current" },
  { name: "session revoke", handler: revokeAll, method: "POST", path: "/api/account/security/revoke-all" },
];

describe("account mutation origin boundary", () => {
  beforeEach(() => {
    ports.getAuthenticatedAccount.mockReset();
    ports.mutation.mockReset();
  });

  it.each(cases)("rejects cross-origin $name before auth or mutation", async ({ handler, method, path }) => {
    const response = await handler(new Request(`https://staging.nanohome.vn${path}`, {
      method,
      headers: { Origin: "https://evil.example" },
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
    expect(ports.getAuthenticatedAccount).not.toHaveBeenCalled();
    expect(ports.mutation).not.toHaveBeenCalled();
  });
});
