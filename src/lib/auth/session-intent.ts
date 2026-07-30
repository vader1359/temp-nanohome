export const AUTH_SESSION_INTENTS = ["account", "checkout"] as const;

export type AuthSessionIntent = (typeof AUTH_SESSION_INTENTS)[number];
