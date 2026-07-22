"use client";

import type { PreferenceFeature } from "@/lib/personalization";

type PreferenceCenterProps = {
  readonly enabled?: boolean;
  readonly consent: boolean;
  readonly preferences: readonly PreferenceFeature[];
  readonly onEdit: (preference: PreferenceFeature) => void;
  readonly onReset: () => void;
  readonly onDisable: () => void;
  readonly onDisconnectMemory?: () => void;
};

export function PreferenceCenter({ enabled = true, consent, preferences, onEdit, onReset, onDisable, onDisconnectMemory }: PreferenceCenterProps) {
  if (!enabled || !consent) {
    return (
      <section aria-labelledby="preference-center-title" className="border border-[var(--nh-border)] bg-[var(--nh-surface-warm)] p-6">
        <h2 id="preference-center-title" className="text-lg text-[var(--nh-ink)]">A considered selection for your home</h2>
        <p className="mt-2 text-sm text-[var(--nh-muted)]">Browse our curated edit whenever you are ready.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="preference-center-title" className="border border-[var(--nh-border)] bg-[var(--nh-surface-primary)] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="preference-center-title" className="text-lg text-[var(--nh-ink)]">Your preferences</h2>
          <p className="mt-2 text-sm text-[var(--nh-muted)]">Shape what we place in view.</p>
        </div>
        <button type="button" className="rounded-sm border border-[var(--nh-border)] px-3 py-2 text-sm text-[var(--nh-ink)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--nh-accent)]" onClick={onDisable}>Disable</button>
      </div>
      <ul className="mt-6 divide-y divide-[var(--nh-border)]">
        {preferences.map((preference) => (
          <li key={preference.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <span className="text-sm text-[var(--nh-ink)]">{preference.value}</span>
            <button type="button" aria-label={`Edit ${preference.value} preference`} className="rounded-sm px-2 py-1 text-sm text-[var(--nh-muted)] underline-offset-4 hover:text-[var(--nh-ink)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--nh-accent)]" onClick={() => onEdit(preference)}>Edit</button>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" className="rounded-sm border border-[var(--nh-border)] px-3 py-2 text-sm text-[var(--nh-ink)] focus-visible:outline-2 focus-visible:outline-[var(--nh-accent)]" onClick={onReset}>Reset preferences</button>
        {onDisconnectMemory !== undefined ? <button type="button" className="rounded-sm border border-[var(--nh-border)] px-3 py-2 text-sm text-[var(--nh-ink)] focus-visible:outline-2 focus-visible:outline-[var(--nh-accent)]" onClick={onDisconnectMemory}>Disconnect customer memory</button> : null}
      </div>
      <p className="sr-only" aria-live="polite">Personalized controls are enabled.</p>
    </section>
  );
}
