'use client';

import type { CSSProperties } from 'react';
import { Card } from '../ui/Card';
import { VERDICT_META, isRtlCode, type Claim, type EvidenceStance } from '@/data/claims';

const STANCE_META: Record<EvidenceStance, { label: string; dot: string }> = {
  supports: { label: 'Supports', dot: 'bg-emerald-500' },
  refutes: { label: 'Refutes', dot: 'bg-rose-500' },
  context: { label: 'Context', dot: 'bg-amber-500' },
};

export function ClaimCard({ claim, index = 0 }: { claim: Claim; index?: number }) {
  const verdict = VERDICT_META[claim.verdict];
  const rtl = isRtlCode(claim.detectedLanguageCode);

  return (
    <div data-reveal style={{ '--reveal-delay': `${index * 70}ms` } as CSSProperties} className="h-full">
      <Card interactive={false} glass hoverLift className="flex h-full flex-col">
        {/* Section 1 — Language + timestamp */}
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-white/[.06] dark:text-zinc-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="h-3.5 w-3.5">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c2.2 2.5 3.3 5.5 3.3 9S14.2 18.5 12 21M12 3C9.8 5.5 8.7 8.5 8.7 12S9.8 18.5 12 21" />
            </svg>
            {claim.detectedLanguage}
          </span>
          <time dateTime={claim.timestamp} className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
            {claim.time}
          </time>
        </div>

        {/* Section 2 — Verdict + id */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200/80 dark:bg-white/[.06] dark:text-zinc-200 dark:ring-white/[.08]">
            <span className={`h-1.5 w-1.5 rounded-full ${verdict.dot}`} aria-hidden="true" />
            {verdict.label}
          </span>
          <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{claim.id}</span>
        </div>

        {/* Section 3 — Original claim (direction-aware) */}
        <div className="mt-5 border-t border-zinc-200/60 pt-4 dark:border-white/[.06]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Original</p>
          <p
            dir={rtl ? 'rtl' : 'ltr'}
            lang={claim.detectedLanguageCode}
            className={`mt-1.5 text-base font-semibold leading-relaxed text-zinc-900 dark:text-zinc-50 ${rtl ? 'text-right' : 'text-left'}`}
          >
            {claim.originalText}
          </p>
        </div>

        {/* Section 4 — Translated */}
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Translated
            <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">EN</span>
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{claim.translatedText}</p>
        </div>

        {/* Section 5 — Confidence */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-zinc-500 dark:text-zinc-400">Confidence</span>
            <span className="font-bold tabular-nums text-zinc-800 dark:text-zinc-100">{claim.confidence}%</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-white/[.08]">
            <div
              role="progressbar"
              aria-valuenow={claim.confidence}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Confidence score"
              className="vv-meter-fill h-full rounded-full"
              style={{ '--vv-fill': `${claim.confidence}%` } as CSSProperties}
            />
          </div>
        </div>

        {/* Section 6 — Evidence */}
        <div className="mt-5 flex-1 border-t border-zinc-200/60 pt-4 dark:border-white/[.06]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Evidence</p>
          <ul className="mt-2.5 space-y-2.5">
            {claim.evidence.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${STANCE_META[item.stance].dot}`} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-zinc-700 dark:text-zinc-200">{item.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                    <span className="font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{STANCE_META[item.stance].label}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{item.source}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
