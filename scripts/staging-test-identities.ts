import { spawnSync } from "node:child_process";
import { randomBytes, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";

import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const EXPECTED_PROJECT_ID = "temp-nanohome";
const EXPECTED_ORIGIN = "https://staging.nanohome.vn";
const KEYCHAIN_SERVICE = "com.nanohome.staging.ui-test-identities";
const KEYCHAIN_ACCOUNT = EXPECTED_PROJECT_ID;

type StoredIdentities = {
  version: 1;
  projectId: string;
  createdAt: string;
  email: string;
  password: string;
  emailUid: string;
  phone: string;
  phoneCode: string;
  googleAlias: "existing-google-browser-session";
};

function parseEnvFile(path: string) {
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .flatMap((line) => {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match === null) return [];
        const raw = match[2].trim();
        const value = raw.startsWith("\"") && raw.endsWith("\"")
          ? JSON.parse(raw)
          : raw.replace(/^'|'$/g, "");
        return [[match[1], value] as const];
      }),
  );
}

function readStoredIdentities(): StoredIdentities | null {
  const result = spawnSync(
    "security",
    ["find-generic-password", "-a", KEYCHAIN_ACCOUNT, "-s", KEYCHAIN_SERVICE, "-w"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0) return null;
  const parsed = JSON.parse(result.stdout.trim()) as StoredIdentities;
  if (parsed.projectId !== EXPECTED_PROJECT_ID || parsed.version !== 1) {
    throw new Error("Stored staging identity bundle has an unexpected target or version.");
  }
  return parsed;
}

function writeStoredIdentities(identities: StoredIdentities) {
  const result = spawnSync(
    "security",
    [
      "add-generic-password",
      "-U",
      "-a",
      KEYCHAIN_ACCOUNT,
      "-s",
      KEYCHAIN_SERVICE,
      "-w",
      JSON.stringify(identities),
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0) {
    throw new Error("Unable to store the staging identity bundle in macOS Keychain.");
  }
}

function deleteStoredIdentities() {
  const result = spawnSync(
    "security",
    ["delete-generic-password", "-a", KEYCHAIN_ACCOUNT, "-s", KEYCHAIN_SERVICE],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0) {
    throw new Error("Unable to remove the staging identity bundle from macOS Keychain.");
  }
}

function copyFieldToClipboard(field: string, identities: StoredIdentities) {
  const values: Record<string, string> = {
    email: identities.email,
    password: identities.password,
    phone: identities.phone,
    phoneCode: identities.phoneCode,
  };
  if (!Object.hasOwn(values, field)) {
    throw new Error("Copy field must be one of: email, password, phone, phoneCode.");
  }
  const result = spawnSync("pbcopy", [], {
    input: values[field],
    encoding: "utf8",
    stdio: ["pipe", "ignore", "pipe"],
  });
  if (result.status !== 0) throw new Error("Unable to copy the staging test value.");
}

async function getIdentityToolkitConfig(accessToken: string) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${EXPECTED_PROJECT_ID}/config`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) throw new Error(`Identity Toolkit config read failed (${response.status}).`);
  return response.json() as Promise<{
    signIn?: {
      phoneNumber?: {
        enabled?: boolean;
        testPhoneNumbers?: Record<string, string>;
      };
    };
  }>;
}

async function patchTestPhoneNumbers(
  accessToken: string,
  testPhoneNumbers: Record<string, string>,
) {
  const updateMask = encodeURIComponent("signIn.phoneNumber.testPhoneNumbers");
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${EXPECTED_PROJECT_ID}/config?updateMask=${updateMask}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ signIn: { phoneNumber: { testPhoneNumbers } } }),
    },
  );
  if (!response.ok) {
    throw new Error(`Identity Toolkit test phone update failed (${response.status}).`);
  }
}

function sanitizedSummary(
  identities: StoredIdentities,
  state: {
    emailUserPresent: boolean;
    phoneProviderEnabled: boolean;
    testPhonePresent: boolean;
  },
) {
  return {
    projectId: identities.projectId,
    keychainService: KEYCHAIN_SERVICE,
    aliases: {
      email: "AUTH_EMAIL_VERIFIED",
      google: "AUTH_GOOGLE_TEST",
      phone: "AUTH_PHONE_TEST",
    },
    emailUserPresent: state.emailUserPresent,
    googleBrowserSessionRequired: true,
    phoneProviderEnabled: state.phoneProviderEnabled,
    testPhonePresent: state.testPhonePresent,
    valuesPrinted: false,
  };
}

async function main() {
  const args = process.argv.slice(2).filter((argument) => argument !== "--");
  const command = args[0] ?? "check";
  const env = parseEnvFile(".env.local");
  if (
    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== EXPECTED_PROJECT_ID
    || env.FIREBASE_ADMIN_PROJECT_ID !== EXPECTED_PROJECT_ID
    || env.NEXT_PUBLIC_APP_ORIGIN !== EXPECTED_ORIGIN
  ) {
    throw new Error("Refusing identity operation: exact Firebase staging target was not proven.");
  }
  process.env.GOOGLE_APPLICATION_CREDENTIALS = env.GOOGLE_APPLICATION_CREDENTIALS;

  if (command === "copy") {
    const identities = readStoredIdentities();
    if (identities === null) throw new Error("Staging identity bundle is not provisioned.");
    copyFieldToClipboard(args[1] ?? "", identities);
    console.log(JSON.stringify({ copied: true, valuesPrinted: false }));
    return;
  }

  const credential = applicationDefault();
  const app = initializeApp({ credential, projectId: EXPECTED_PROJECT_ID });
  const adminAuth = getAuth(app);
  const accessToken = await credential.getAccessToken();

  if (command === "provision") {
    const existing = readStoredIdentities();
    if (existing !== null) {
      const config = await getIdentityToolkitConfig(accessToken.access_token);
      let emailUserPresent = true;
      try {
        await adminAuth.getUser(existing.emailUid);
      } catch {
        emailUserPresent = false;
      }
      console.log(JSON.stringify(sanitizedSummary(existing, {
        emailUserPresent,
        phoneProviderEnabled: config.signIn?.phoneNumber?.enabled === true,
        testPhonePresent: Object.hasOwn(
          config.signIn?.phoneNumber?.testPhoneNumbers ?? {},
          existing.phone,
        ),
      })));
      return;
    }

    const config = await getIdentityToolkitConfig(accessToken.access_token);
    if (config.signIn?.phoneNumber?.enabled !== true) {
      throw new Error("Refusing provisioning: Firebase Phone provider is not enabled.");
    }
    const existingTestPhones = config.signIn.phoneNumber.testPhoneNumbers ?? {};
    let phone = "";
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = `+8490${String(randomInt(0, 10_000_000)).padStart(7, "0")}`;
      if (!Object.hasOwn(existingTestPhones, candidate)) {
        phone = candidate;
        break;
      }
    }
    if (phone === "") throw new Error("Unable to allocate a fictional Firebase test number.");

    const email = `ui-test-${randomBytes(6).toString("hex")}@nanohome.vn`;
    const password = randomBytes(24).toString("base64url");
    const phoneCode = String(randomInt(100_000, 1_000_000));
    const user = await adminAuth.createUser({
      displayName: "nanoHome staging UI test",
      email,
      emailVerified: true,
      password,
    });
    await adminAuth.setCustomUserClaims(user.uid, { stagingTest: true });

    try {
      await patchTestPhoneNumbers(accessToken.access_token, {
        ...existingTestPhones,
        [phone]: phoneCode,
      });
      const identities: StoredIdentities = {
        version: 1,
        projectId: EXPECTED_PROJECT_ID,
        createdAt: new Date().toISOString(),
        email,
        password,
        emailUid: user.uid,
        phone,
        phoneCode,
        googleAlias: "existing-google-browser-session",
      };
      writeStoredIdentities(identities);
      console.log(JSON.stringify(sanitizedSummary(identities, {
        emailUserPresent: true,
        phoneProviderEnabled: true,
        testPhonePresent: true,
      })));
    } catch (error) {
      await adminAuth.deleteUser(user.uid);
      throw error;
    }
    return;
  }

  const identities = readStoredIdentities();
  if (identities === null) throw new Error("Staging identity bundle is not provisioned.");

  if (command === "rollback") {
    const config = await getIdentityToolkitConfig(accessToken.access_token);
    const nextTestPhones = { ...(config.signIn?.phoneNumber?.testPhoneNumbers ?? {}) };
    delete nextTestPhones[identities.phone];
    await patchTestPhoneNumbers(accessToken.access_token, nextTestPhones);
    try {
      await adminAuth.deleteUser(identities.emailUid);
    } catch (error) {
      if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
    }
    deleteStoredIdentities();
    console.log(JSON.stringify({
      projectId: EXPECTED_PROJECT_ID,
      rolledBack: true,
      valuesPrinted: false,
    }));
    return;
  }

  if (command !== "check") {
    throw new Error("Command must be one of: provision, check, copy, rollback.");
  }
  const config = await getIdentityToolkitConfig(accessToken.access_token);
  let emailUserPresent = true;
  try {
    await adminAuth.getUser(identities.emailUid);
  } catch {
    emailUserPresent = false;
  }
  console.log(JSON.stringify(sanitizedSummary(identities, {
    emailUserPresent,
    phoneProviderEnabled: config.signIn?.phoneNumber?.enabled === true,
    testPhonePresent: Object.hasOwn(
      config.signIn?.phoneNumber?.testPhoneNumbers ?? {},
      identities.phone,
    ),
  })));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown staging identity error.");
  process.exitCode = 1;
});
