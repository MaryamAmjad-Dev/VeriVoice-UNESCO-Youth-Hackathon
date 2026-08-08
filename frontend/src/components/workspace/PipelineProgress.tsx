'use client';

import type { CSSProperties } from 'react';
import { PIPELINE_STAGES, type PipelineState, type StageStatus } from '@/services/verification';

const STATUS_META: Record<StageStatus, { label: string; dot: string; text: string; ring: string }> = {
  pending: {
    label: 'Pending',
    dot: 'bg-zinc-300 dark:bg-zinc-600',
    text: 'text-zinc-400 dark:text-zinc-500',
    ring: 'border-zinc-200/70 dark:border-white/[.06]',
  },
  processing: {
    label: 'Processing',
    dot: 'bg-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
    ring: 'border-blue-400/60 dark:border-blue-500/40',
  },
  completed: {
    label: 'Completed',
    dot: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    ring: 'border-emerald-400/50 dark:border-emerald-500/30',
  },
  error: {
    label: 'Error',
    dot: 'bg-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
    ring: 'border-rose-400/60 dark:border-rose-500/40',
  },
};

function StatusIcon({ status }: { status: StageStatus }) {
  if (status === 'completed') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true" className="h-3.5 w-3.5">
        <path d="m5 12.5 4.5 4.5L19 7" />
      </svg>
    );
  }
  if (status === 'error') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true" className="h-3.5 w-3.5">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    );
  }
  if (status === 'processing') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true" className="h-3.5 w-3.5 animate-spin">
        <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
      </svg>
    );
  }
  return <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />;
}

interface PipelineProgressProps {
  state: PipelineState;
  /** True while the run is active — used only for the header status line. */
  running: boolean;
}

export function PipelineProgress({ state, running }: PipelineProgressProps) {
  const completed = PIPELINE_STAGES.filter((stage) => state[stage.id].status === 'completed').length;
  const failed = PIPELINE_STAGES.some((stage) => state[stage.id].status === 'error');
  const percent = Math.round((completed / PIPELINE_STAGES.length) * 100);
  const active = PIPELINE_STAGES.find((stage) => state[stage.id].status === 'processing');

  return (
    <section
      aria-label="Verification pipeline"
      className="relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/70 p-6 backdrop-blur-xl dark:border-white/[.08] dark:bg-zinc-900/40 sm:p-8"
    >
      <span
        aria-hidden="true"
        className="vv-ambient-orb pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl"
      />

      <header className="relative flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-blue-600 dark:text-blue-400">
            Stage {Math.min(completed + (running ? 1 : 0), PIPELINE_STAGES.length)} of {PIPELINE_STAGES.length}
          </p>
          <h3 className="mt-1.5 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Verification Pipeline
          </h3>
        </div>
        <p aria-live="polite" className={`text-sm font-medium ${failed ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-600 dark:text-zinc-300'}`}>
          {failed
            ? 'Pipeline stopped'
            : active
              ? `Processing · ${active.label}`
              : completed === PIPELINE_STAGES.length
                ? 'All stages complete'
                : 'Waiting to start'}
        </p>
      </header>

      <div className="relative mt-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-white/[.08]">
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Pipeline progress"
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${
            failed ? 'bg-rose-500' : 'bg-gradient-to-r from-blue-600 via-sky-400 to-teal-400'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PIPELINE_STAGES.map((stage, i) => {
          const { status, note } = state[stage.id];
          const meta = STATUS_META[status];
          return (
            <li
              key={stage.id}
              style={{ '--reveal-delay': `${i * 40}ms` } as CSSProperties}
              className={`flex items-start gap-3 rounded-2xl border bg-white/60 px-4 py-3.5 transition-all duration-300 dark:bg-white/[.02] ${meta.ring} ${
                status === 'processing' ? 'shadow-lg shadow-blue-500/10' : ''
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white transition-colors duration-300 ${meta.dot} ${
                  status === 'pending' ? 'text-zinc-500 dark:text-zinc-300' : ''
                }`}
              >
                <StatusIcon status={status} />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{stage.label}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${meta.text}`}>{meta.label}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {note ?? stage.description}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <p className="sr-only" aria-live="polite">
        {active ? `${active.label} in progress` : `${completed} of ${PIPELINE_STAGES.length} stages complete`}
      </p>
    </section>
  );
}
