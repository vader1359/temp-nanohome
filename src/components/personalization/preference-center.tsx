"use client";

import type { PreferenceFeature } from "@/lib/personalization";

export type PreferenceCenterCopy = {
  readonly defaultTitle: string;
  readonly defaultBody: string;
  readonly title: string;
  readonly body: string;
  readonly disable: string;
  readonly edit: string;
  readonly empty: string;
  readonly reset: string;
  readonly disconnectMemory: string;
  readonly enabledAnnouncement: string;
};

const defaultCopy: PreferenceCenterCopy = {
  defaultTitle: "A considered selection for your home",
  defaultBody: "Browse our curated edit whenever you are ready.",
  title: "Your preferences",
  body: "Shape what we place in view.",
  disable: "Disable",
  edit: "Edit",
  empty: "No saved preferences yet.",
  reset: "Reset preferences",
  disconnectMemory: "Disconnect customer memory",
  enabledAnnouncement: "Personalized controls are enabled.",
};

type PreferenceCenterProps = {
  readonly enabled?: boolean;
  readonly consent: boolean;
  readonly preferences: readonly PreferenceFeature[];
  readonly copy?: PreferenceCenterCopy;
  readonly onEdit?: (preference: PreferenceFeature) => void;
  readonly onReset?: () => void;
  readonly onDisable?: () => void;
  readonly onDisconnectMemory?: () => void;
};

export function PreferenceCenter({ enabled = true, consent, preferences, copy = defaultCopy, onEdit, onReset, onDisable, onDisconnectMemory }: PreferenceCenterProps) {
  if (!enabled || !consent) {
    return (
      <section aria-labelledby="preference-center-title" className="border border-[var(--nh-border)] bg-[var(--nh-surface-warm)] p-6">
        <h2 id="preference-center-title" className="text-lg text-[var(--nh-ink)]">{copy.defaultTitle}</h2>
        <p className="mt-2 text-sm text-[var(--nh-muted)]">{copy.defaultBody}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="preference-center-title" className="border border-[var(--nh-border)] bg-[var(--nh-surface-primary)] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="preference-center-title" className="text-lg text-[var(--nh-ink)]">{copy.title}</h2>
          <p className="mt-2 text-sm text-[var(--nh-muted)]">{copy.body}</p>
        </div>
        {onDisable === undefined ? null : <button type="button" className="rounded-sm border border-[var(--nh-border)] px-3 py-2 text-sm text-[var(--nh-ink)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--nh-accent)]" onClick={onDisable}>{copy.disable}</button>}
      </div>
      {preferences.length === 0 ? <p className="mt-6 text-sm text-[var(--nh-muted)]">{copy.empty}</p> : <ul className="mt-6 divide-y divide-[var(--nh-border)]">
        {preferences.map((preference) => (
          <li key={`${preference.labelKey}:${preference.key}:${preference.value}`} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <span className="text-sm text-[var(--nh-ink)]">{preference.value}</span>
            {onEdit === undefined ? null : <button type="button" aria-label={`${copy.edit} ${preference.value} preference`} className="rounded-sm px-2 py-1 text-sm text-[var(--nh-muted)] underline-offset-4 hover:text-[var(--nh-ink)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--nh-accent)]" onClick={() => onEdit(preference)}>{copy.edit}</button>}
          </li>
        ))}
      </ul>}
      {onReset === undefined && onDisconnectMemory === undefined ? null : (
        <div className="mt-6 flex flex-wrap gap-2">
          {onReset === undefined ? null : <button type="button" className="rounded-sm border border-[var(--nh-border)] px-3 py-2 text-sm text-[var(--nh-ink)] focus-visible:outline-2 focus-visible:outline-[var(--nh-accent)]" onClick={onReset}>{copy.reset}</button>}
          {onDisconnectMemory === undefined ? null : <button type="button" className="rounded-sm border border-[var(--nh-border)] px-3 py-2 text-sm text-[var(--nh-ink)] focus-visible:outline-2 focus-visible:outline-[var(--nh-accent)]" onClick={onDisconnectMemory}>{copy.disconnectMemory}</button>}
        </div>
      )}
      <p className="sr-only" aria-live="polite">{copy.enabledAnnouncement}</p>
    </section>
  );
}
