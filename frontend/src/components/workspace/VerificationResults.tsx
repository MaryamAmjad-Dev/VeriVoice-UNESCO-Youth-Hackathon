'use client';

import type { CSSProperties, ReactNode } from 'react';
import { VERDICT_META, isRtlCode } from '@/data/claims';
import {
  formatBytes,
  formatDuration,
  type EvidenceStance,
  type VerificationResult,
  type VerifiedClaim,
} from '@/services/verification';

const STANCE_META: Record<EvidenceStance, { label: string; dot: string; chip: string }> = {
  supports: {
    label: 'Supports',
    dot: 'bg-emerald-500',
    chip: 'text-emerald-700 bg-emerald-500/10 dark:text-emerald-300',
  },
  refutes: {
    label: 'Refutes',
    dot: 'bg-rose-500',
    chip: 'text-rose-700 bg-rose-500/10 dark:text-rose-300',
  },
  context: {
    label: 'Context',
    dot: 'bg-amber-500',
    chip: 'text-amber-700 bg-amber-500/10 dark:text-amber-300',
  },
};

const REPORT_STEPS: { key: keyof VerifiedClaim['reasoning']; label: string }[] = [
  { key: 'claimed', label: 'What was claimed' },
  { key: 'evidenceFound', label: 'What evidence was found' },
  { key: 'relation', label: 'How the evidence relates' },
  { key: 'verdictRationale', label: 'Why this verdict' },
  { key: 'confidenceRationale', label: 'Why this confidence' },
];

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{children}</p>
  );
}

function ConfidenceMeter({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className="font-bold tabular-nums text-zinc-800 dark:text-zinc-100">{value}%</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-white/[.08]">
        <div
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
          className="vv-meter-fill h-full rounded-full"
          style={{ '--vv-fill': `${value}%` } as CSSProperties}
        />
      </div>
    </div>
  );
}

function ClaimPanel({ claim, index, languageCode }: { claim: VerifiedClaim; index: number; languageCode: string }) {
  const verdict = VERDICT_META[claim.verdict];
  const rtl = isRtlCode(languageCode);

  return (
    <article
      data-reveal
      style={{ '--reveal-delay': `${index * 80}ms` } as CSSProperties}
      className="vv-card relative overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/70 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/60 hover:shadow-xl hover:shadow-blue-500/10 dark:border-white/[.08] dark:bg-zinc-900/40 dark:hover:border-blue-500/40"
    >
      <header className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200/80 dark:bg-white/[.06] dark:text-zinc-200 dark:ring-white/[.08]">
          <span className={`h-1.5 w-1.5 rounded-full ${verdict.dot}`} aria-hidden="true" />
          {verdict.label}
        </span>
        <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
          Claim {index + 1} · {claim.id}
        </span>
      </header>

      <div className="mt-5">
        <SectionLabel>Original</SectionLabel>
        <p
          dir={rtl ? 'rtl' : 'ltr'}
          lang={languageCode}
          className={`mt-1.5 text-base font-semibold leading-relaxed text-zinc-900 dark:text-zinc-50 ${rtl ? 'text-right' : 'text-left'}`}
        >
          {claim.originalText}
        </p>
      </div>

      <div className="mt-4">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Translated
          <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">EN</span>
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{claim.translatedText}</p>
      </div>

      <div className="mt-5">
        <ConfidenceMeter value={claim.confidence} label="Claim confidence" />
      </div>

      {/* Evidence */}
      <div className="mt-5 border-t border-zinc-200/60 pt-4 dark:border-white/[.06]">
        <SectionLabel>Evidence ({claim.evidence.length})</SectionLabel>
        <ul className="mt-3 space-y-3">
          {claim.evidence.map((item, i) => {
            const stance = STANCE_META[item.stance];
            return (
              <li
                key={`${claim.id}-ev-${i}`}
                className="rounded-xl border border-zinc-200/60 bg-white/60 p-3.5 dark:border-white/[.06] dark:bg-white/[.02]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{item.title}</p>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${stance.chip}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${stance.dot}`} aria-hidden="true" />
                    {stance.label}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{item.summary}</p>
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-500">
                  <span className="font-medium text-zinc-600 dark:text-zinc-400">{item.source}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{item.domain}</span>
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Explainable report */}
      <div className="mt-5 border-t border-zinc-200/60 pt-4 dark:border-white/[.06]">
        <SectionLabel>Explainable report</SectionLabel>
        <ol className="mt-3 space-y-3">
          {REPORT_STEPS.map((step, i) => (
            <li key={step.key} className="relative ps-7">
              <span
                aria-hidden="true"
                className="absolute start-0 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-[10px] font-bold text-blue-600 dark:text-blue-400"
              >
                {i + 1}
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {step.label}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{claim.reasoning[step.key]}</p>
            </li>
          ))}
        </ol>
      </div>
    </article>
  );
}

export function VerificationResults({ result }: { result: VerificationResult }) {
  const { transcript } = result;
  const rtl = isRtlCode(transcript.detectedLanguageCode);

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <section
        aria-label="Verification summary"
        className="vv-enter relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/70 p-6 backdrop-blur-xl dark:border-white/[.08] dark:bg-zinc-900/40 sm:p-8"
      >
        <span
          aria-hidden="true"
          className="vv-ambient-orb pointer-events-none absolute -left-16 -bottom-20 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                Verification complete
              </span>
              {result.mode === 'demo' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                  Demo verification mode
                </span>
              )}
            </div>
            <h3 className="mt-3 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
              Verification <span className="vv-gradient-text">Report</span>
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{result.summary}</p>
            <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-500">
              <span className="truncate font-medium text-zinc-600 dark:text-zinc-400">{result.audio.fileName}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{formatBytes(result.audio.sizeBytes)}</span>
              {result.audio.durationSeconds !== null && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{formatDuration(result.audio.durationSeconds)}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{result.audio.source === 'recording' ? 'Recorded in browser' : 'Uploaded file'}</span>
            </p>
          </div>

          <div className="w-full max-w-xs shrink-0 rounded-2xl border border-zinc-200/70 bg-white/60 p-4 dark:border-white/[.08] dark:bg-white/[.03] sm:w-56">
            <p className="text-4xl font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
              {result.overallConfidence}%
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Overall confidence</p>
            <div className="mt-3">
              <ConfidenceMeter value={result.overallConfidence} label="Across all claims" />
            </div>
          </div>
        </div>
      </section>

      {/* Transcript */}
      <section
        aria-label="Transcript"
        className="rounded-3xl border border-zinc-200/70 bg-white/70 p-6 backdrop-blur-xl dark:border-white/[.08] dark:bg-zinc-900/40 sm:p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Transcript</h3>
          <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200/70 bg-white/60 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-white/[.08] dark:bg-white/[.04] dark:text-zinc-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="h-3.5 w-3.5">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c2.2 2.5 3.3 5.5 3.3 9S14.2 18.5 12 21M12 3C9.8 5.5 8.7 8.5 8.7 12S9.8 18.5 12 21" />
            </svg>
            {transcript.detectedLanguage}
            <span className="font-mono uppercase text-zinc-400 dark:text-zinc-500">{transcript.detectedLanguageCode}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums text-blue-600 dark:text-blue-400">{transcript.languageConfidence}%</span>
          </span>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200/60 bg-white/60 p-4 dark:border-white/[.06] dark:bg-white/[.02]">
            <SectionLabel>Original speech</SectionLabel>
            <p
              dir={rtl ? 'rtl' : 'ltr'}
              lang={transcript.detectedLanguageCode}
              className={`mt-2 text-base leading-relaxed text-zinc-800 dark:text-zinc-100 ${rtl ? 'text-right' : 'text-left'}`}
            >
              {transcript.originalText}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200/60 bg-white/60 p-4 dark:border-white/[.06] dark:bg-white/[.02]">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              English translation
              <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">EN</span>
            </p>
            <p className="mt-2 text-base leading-relaxed text-zinc-600 dark:text-zinc-300">{transcript.translatedText}</p>
          </div>
        </div>
      </section>

      {/* Claims */}
      <section aria-label="Verified claims">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Extracted Claims
            <span className="ms-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">({result.claims.length})</span>
          </h3>
        </div>
        <div className="mt-4 grid gap-5 xl:grid-cols-2">
          {result.claims.map((claim, i) => (
            <ClaimPanel key={claim.id} claim={claim} index={i} languageCode={transcript.detectedLanguageCode} />
          ))}
        </div>
      </section>
    </div>
  );
}
