import { describe, expect, it } from "vitest";

import { firebaseAuthHelperRewrites } from "./firebase-auth-helper-rewrite";

describe("firebaseAuthHelperRewrites", () => {
  it("proxies the Firebase auth helper transparently through the app origin", () => {
    expect(firebaseAuthHelperRewrites("temp-nanohome")).toEqual([{
      source: "/__/auth/:path*",
      destination: "https://temp-nanohome.firebaseapp.com/__/auth/:path*",
    }]);
  });

  it.each([undefined, "", "../production", "Production_Project"])(
    "does not create a rewrite for invalid project ID %s",
    (projectId) => {
      expect(firebaseAuthHelperRewrites(projectId)).toEqual([]);
    },
  );
});
