const STAGING_ORIGIN = "https://staging.nanohome.vn";
const STAGING_FIREBASE_PROJECT_ID = "temp-nanohome";

type FirebasePhoneTestModeInput = Readonly<{
  readonly origin: string;
  readonly projectId: string | undefined;
  readonly stagingTestClaim: unknown;
}>;

export function isFirebasePhoneTestModeAllowed({
  origin,
  projectId,
  stagingTestClaim,
}: FirebasePhoneTestModeInput): boolean {
  return (
    origin === STAGING_ORIGIN
    && projectId === STAGING_FIREBASE_PROJECT_ID
    && stagingTestClaim === true
  );
}
