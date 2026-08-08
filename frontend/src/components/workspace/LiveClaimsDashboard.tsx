'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useLanguage } from '@/providers/LanguageProvider';
import { claims, VERDICTS, VERDICT_META, type Verdict } from '@/data/claims';
import { ClaimCard } from './ClaimCard';

type Filter = 'all' | Verdict;

const ICONS: Record<string, ReactNode> = {
  total: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="h-5 w-5"><path d="M4 6h16M4 12h16M4 18h10" /></svg>,
  verified: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="h-5 w-5"><path d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></svg>,
  disputed: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="h-5 w-5"><path d="M12 9v4M12 17h.01M10.3 4.3 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" /></svg>,
  confidence: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="h-5 w-5"><path d="M3 12a9 9 0 1 1 18 0" /><path d="m12 12 4-2.5" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /></svg>,
};

export function LiveClaimsDashboard() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<Filter>('all');

  const stats = useMemo(() => {
    const counts = VERDICTS.reduce(
      (acc, v) => ({ ...acc, [v]: claims.filter((c) => c.verdict === v).length }),
      {} as Record<Verdict, number>,
    );
    const avgConfidence = Math.round(claims.reduce((sum, c) => sum + c.confidence, 0) / claims.length);
    return { total: claims.length, avgConfidence, counts };
  }, []);

  const visibleClaims = useMemo(
    () => (filter === 'all' ? claims : claims.filter((c) => c.verdict === filter)),
    [filter],
  );

  const statCards: { key: string; label: string; value: number | string; hint: string; dot?: string }[] = [
    { key: 'total', label: 'Total Claims', value: stats.total, hint: 'Sample records' },
    { key: 'verified', label: VERDICT_META.verified.label, value: stats.counts.verified, hint: 'Evidence supports', dot: VERDICT_META.verified.dot },
    { key: 'disputed', label: VERDICT_META.disputed.label, value: stats.counts.disputed, hint: 'Sources conflict', dot: VERDICT_META.disputed.dot },
    { key: 'confidence', label: 'Avg. Confidence', value: `${stats.avgConfidence}%`, hint: 'Across sample claims' },
  ];

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    ...VERDICTS.map((v) => ({ key: v, label: VERDICT_META[v].label })),
  ];

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Header + live status */}
      <header className="relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/60 p-6 backdrop-blur-xl dark:border-white/[.08] dark:bg-zinc-900/30 sm:flex-row sm:items-end sm:justify-between sm:p-8">
        <span aria-hidden="true" className="vv-ambient-orb pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-500 shadow-[0_0_10px_2px_rgba(45,212,191,.45)]" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[.18em] text-teal-600 dark:text-teal-400">
              Reference · {t('status')}
            </span>
          </div>
          <h2 className="mt-2.5 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Recent Verification <span className="vv-gradient-text">Activity</span>
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Example claims from earlier sessions, shown for reference. These are sample records — run a verification
            above to produce your own report.
          </p>
        </div>
        <span className="vv-status-glow relative inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-zinc-200/70 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-zinc-600 backdrop-blur-sm dark:border-white/[.08] dark:bg-white/[.04] dark:text-zinc-300 sm:self-auto">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="text-amber-600 dark:text-amber-400">Sample data</span>
        </span>
      </header>

      {/* Summary stat cards */}
      <section aria-label="Summary" className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card, i) => (
          <div
            key={card.key}
            data-reveal
            style={{ '--reveal-delay': `${i * 70}ms` } as CSSProperties}
            className="vv-card group relative overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/70 p-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/60 hover:shadow-xl hover:shadow-blue-500/10 dark:border-white/[.08] dark:bg-zinc-900/40 dark:hover:border-blue-500/40"
          >
            <div className="flex items-start justify-between">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {card.dot && <span className={`h-1.5 w-1.5 rounded-full ${card.dot}`} aria-hidden="true" />}
                {card.label}
              </p>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 transition-transform duration-300 group-hover:scale-110 dark:text-blue-400">
                {ICONS[card.key]}
              </span>
            </div>
            <p className="mt-3 text-3xl font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">{card.value}</p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{card.hint}</p>
          </div>
        ))}
      </section>

      {/* Verdict filter */}
      <div className="mt-8 flex flex-wrap items-center gap-2" role="group" aria-label="Filter claims by verdict">
        {filters.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
                active
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 dark:bg-blue-500'
                  : 'border border-zinc-200/70 bg-white/60 text-zinc-600 hover:border-blue-300 hover:text-blue-600 dark:border-white/10 dark:bg-white/[.04] dark:text-zinc-300 dark:hover:border-blue-500/40'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Claims feed */}
      <section aria-label="Claims feed" aria-live="polite" className="mt-6">
        {visibleClaims.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 py-16 text-center text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
            No claims match this filter.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visibleClaims.map((claim, i) => (
              <ClaimCard key={claim.id} claim={claim} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
