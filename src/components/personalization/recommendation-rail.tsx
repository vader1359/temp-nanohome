"use client";

type Recommendation = {
  readonly id: string;
  readonly title: string;
  readonly explanationKey: string;
};

type RecommendationRailProps = {
  readonly enabled?: boolean;
  readonly consent: boolean;
  readonly recommendations: readonly Recommendation[];
  readonly explanationLabels: Readonly<Record<string, string>>;
  readonly onExclude: (recommendationId: string) => void;
};

export function RecommendationRail({ enabled = true, consent, recommendations, explanationLabels, onExclude }: RecommendationRailProps) {
  return (
    <section aria-labelledby="recommendation-rail-title" className="border border-[var(--nh-border)] bg-[var(--nh-surface-primary)] p-6">
      <h2 id="recommendation-rail-title" className="text-lg text-[var(--nh-ink)]">For your consideration</h2>
      {!enabled || !consent ? (
        <p className="mt-2 text-sm text-[var(--nh-muted)]">Our editors have gathered a quiet selection to explore.</p>
      ) : recommendations.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--nh-muted)]">The curated edit is ready when you are.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2" aria-live="polite">
          {recommendations.map((recommendation) => {
            const explanation = explanationLabels[recommendation.explanationKey] ?? explanationLabels.curated_default;
            return (
              <li key={recommendation.id} className="border border-[var(--nh-border)] p-4">
                <h3 className="text-sm text-[var(--nh-ink)]">{recommendation.title}</h3>
                {explanation !== undefined ? <p className="mt-2 text-xs text-[var(--nh-muted)]">{explanation}</p> : null}
                <button type="button" aria-label={`Exclude ${recommendation.title}`} className="mt-4 rounded-sm px-2 py-1 text-sm text-[var(--nh-muted)] underline-offset-4 hover:text-[var(--nh-ink)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--nh-accent)]" onClick={() => onExclude(recommendation.id)}>Exclude</button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
