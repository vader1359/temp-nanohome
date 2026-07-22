"use client";

import type { RecentEntity } from "@/lib/personalization";

export type RecentlyViewedCopy = {
  readonly title: string;
  readonly defaultBody: string;
  readonly empty: string;
  readonly remove: string;
};

const defaultCopy: RecentlyViewedCopy = {
  title: "Recently viewed, kept simple",
  defaultBody: "A curated edit is here when you would like a fresh perspective.",
  empty: "Nothing here yet.",
  remove: "Remove",
};

type RecentlyViewedListProps = {
  readonly enabled?: boolean;
  readonly consent: boolean;
  readonly recent: readonly RecentEntity[];
  readonly labels: Readonly<Record<string, string>>;
  readonly copy?: RecentlyViewedCopy;
  readonly onRemove?: (entity: RecentEntity) => void;
};

function entityLabel(entity: RecentEntity, labels: Readonly<Record<string, string>>): string {
  return labels[`${entity.entityType}:${entity.entityId}`] ?? entity.entityId;
}

export function RecentlyViewedList({ enabled = true, consent, recent, labels, copy = defaultCopy, onRemove }: RecentlyViewedListProps) {
  return (
    <section aria-labelledby="recently-viewed-title" className="border border-[var(--nh-border)] bg-[var(--nh-surface-primary)] p-6">
      <h2 id="recently-viewed-title" className="text-lg text-[var(--nh-ink)]">{copy.title}</h2>
      {!enabled || !consent ? (
        <p className="mt-2 text-sm text-[var(--nh-muted)]">{copy.defaultBody}</p>
      ) : recent.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--nh-muted)]">{copy.empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--nh-border)]" aria-live="polite">
          {recent.map((entity) => {
            const label = entityLabel(entity, labels);
            return (
              <li key={`${entity.entityType}:${entity.entityId}`} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <span className="text-sm text-[var(--nh-ink)]">{label}</span>
                {onRemove === undefined ? null : <button type="button" aria-label={`${copy.remove} ${label} from recently viewed`} className="rounded-sm px-2 py-1 text-sm text-[var(--nh-muted)] underline-offset-4 hover:text-[var(--nh-ink)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--nh-accent)]" onClick={() => onRemove(entity)}>{copy.remove}</button>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
