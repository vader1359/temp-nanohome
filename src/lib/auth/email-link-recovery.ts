export const EMAIL_LINK_RECOVERY_CHANNEL = "nanohome-email-link-recovery";
export const EMAIL_LINK_RECOVERY_STORAGE_KEY = "nanohome-email-link-recovery";
const EMAIL_LINK_RECOVERY_TTL_MS = 10 * 60 * 1_000;

type EmailLinkRecoverySignal = Readonly<{
  readonly type: "email_verification_complete";
  readonly marker: string;
  readonly issuedAt: number;
}>;

function isSignal(value: unknown): value is EmailLinkRecoverySignal {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<EmailLinkRecoverySignal>;
  return candidate.type === "email_verification_complete"
    && typeof candidate.marker === "string"
    && candidate.marker.length > 0
    && typeof candidate.issuedAt === "number";
}

export function publishEmailLinkRecoverySignal(): void {
  const signal: EmailLinkRecoverySignal = {
    type: "email_verification_complete",
    marker: crypto.randomUUID(),
    issuedAt: Date.now(),
  };

  try {
    const channel = new BroadcastChannel(EMAIL_LINK_RECOVERY_CHANNEL);
    channel.postMessage(signal);
    channel.close();
  } catch {
    // Storage fallback below is enough for browsers without BroadcastChannel.
  }

  try {
    window.localStorage.setItem(EMAIL_LINK_RECOVERY_STORAGE_KEY, JSON.stringify(signal));
  } catch {
    // A blocked storage policy must not prevent the explicit recovery state.
  }
}

export function isFreshEmailLinkRecoverySignal(value: unknown, now = Date.now()): boolean {
  return isSignal(value) && now - value.issuedAt >= 0 && now - value.issuedAt <= EMAIL_LINK_RECOVERY_TTL_MS;
}

export function readEmailLinkRecoverySignal(): unknown {
  try {
    const raw = window.localStorage.getItem(EMAIL_LINK_RECOVERY_STORAGE_KEY);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}
