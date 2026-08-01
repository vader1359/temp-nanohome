export const EMAIL_LINK_RECOVERY_CHANNEL = "nanohome-email-link-recovery";
export const EMAIL_LINK_RECOVERY_STORAGE_KEY = "nanohome-email-link-recovery";
const EMAIL_LINK_RECOVERY_TTL_MS = 10 * 60 * 1_000;

type EmailLinkRecoverySignal = Readonly<{
  readonly type: "email_link_callback_ready";
  readonly marker: string;
  readonly state: string;
  readonly issuedAt: number;
}>;

const RECOVERY_STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

function isSignal(value: unknown): value is EmailLinkRecoverySignal {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<EmailLinkRecoverySignal>;
  return candidate.type === "email_link_callback_ready"
    && typeof candidate.marker === "string"
    && candidate.marker.length > 0
    && typeof candidate.state === "string"
    && RECOVERY_STATE_PATTERN.test(candidate.state)
    && typeof candidate.issuedAt === "number";
}

export function publishEmailLinkRecoverySignal(state: string): void {
  if (!RECOVERY_STATE_PATTERN.test(state)) return;
  const signal: EmailLinkRecoverySignal = {
    type: "email_link_callback_ready",
    marker: crypto.randomUUID(),
    state,
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

export function freshEmailLinkRecoveryState(value: unknown, now = Date.now()): string | null {
  return isFreshEmailLinkRecoverySignal(value, now) && isSignal(value) ? value.state : null;
}

export function readEmailLinkRecoverySignal(): unknown {
  try {
    const raw = window.localStorage.getItem(EMAIL_LINK_RECOVERY_STORAGE_KEY);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}
