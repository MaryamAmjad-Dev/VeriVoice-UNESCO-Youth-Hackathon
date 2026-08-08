'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { AudioInput } from './AudioInput';
import { PipelineProgress } from './PipelineProgress';
import { VerificationResults } from './VerificationResults';
import {
  createInitialPipelineState,
  isAbortError,
  runVerification,
  VERIFICATION_MODE,
  VerificationError,
  type AudioPayload,
  type PipelineState,
  type StageId,
  type StageState,
  type VerificationResult,
} from '@/services/verification';

type Phase = 'idle' | 'running' | 'complete' | 'failed';

export function VerificationWorkspace() {
  const [payload, setPayload] = useState<AudioPayload | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [pipeline, setPipeline] = useState<PipelineState>(createInitialPipelineState);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handlePayloadChange = useCallback((next: AudioPayload | null) => {
    setPayload(next);
    setPhase('idle');
    setResult(null);
    setError(null);
    setPipeline(createInitialPipelineState());
  }, []);

  const start = useCallback(async () => {
    if (!payload) return;

    const controller = new AbortController();
    abortRef.current = controller;

    setPhase('running');
    setError(null);
    setResult(null);
    setPipeline(createInitialPipelineState());

    const onProgress = (stageId: StageId, state: StageState) => {
      setPipeline((prev) => ({ ...prev, [stageId]: state }));
    };

    try {
      const verification = await runVerification(payload, { onProgress, signal: controller.signal });
      setResult(verification);
      setPhase('complete');
    } catch (err) {
      if (isAbortError(err)) {
        setPhase('idle');
        setPipeline(createInitialPipelineState());
        return;
      }
      if (err instanceof VerificationError) {
        setError(err.message);
      } else {
        setError('Verification failed unexpectedly. Please try again.');
        setPipeline((prev) => {
          const failedStage = Object.keys(prev).find((key) => prev[key as StageId].status === 'processing');
          if (!failedStage) return prev;
          return { ...prev, [failedStage]: { status: 'error', note: 'Stage failed' } };
        });
      }
      setPhase('failed');
    } finally {
      abortRef.current = null;
    }
  }, [payload]);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPayload(null);
    setResult(null);
    setError(null);
    setPhase('idle');
    setPipeline(createInitialPipelineState());
  }, []);

  useEffect(() => {
    if (phase !== 'complete' || !resultsRef.current) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    resultsRef.current.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }, [phase]);

  const running = phase === 'running';
  const showPipeline = phase !== 'idle';

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Header */}
      <header className="vv-enter relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/70 p-6 backdrop-blur-xl dark:border-white/[.08] dark:bg-zinc-900/40 sm:p-8">
        <span
          aria-hidden="true"
          className="vv-ambient-orb pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_2px_rgba(59,130,246,.5)]" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-[.18em] text-blue-600 dark:text-blue-400">
                Verification Workspace
              </span>
            </div>
            <h1 className="mt-2.5 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
              Verify a <span className="vv-gradient-text">spoken claim</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Record or upload audio, then run it through the nine-stage pipeline: transcription, language detection,
              translation, claim extraction, evidence retrieval, verification, confidence scoring and an explainable
              report.
            </p>
          </div>

          {VERIFICATION_MODE === 'demo' && (
            <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-amber-400/40 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
              Demo verification mode
            </span>
          )}
        </div>

        {VERIFICATION_MODE === 'demo' && (
          <p className="relative mt-4 rounded-xl border border-amber-300/40 bg-amber-50/70 px-4 py-3 text-xs leading-relaxed text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/[.07] dark:text-amber-200/90">
            No verification backend is connected yet. Recording and file upload are fully functional, but the
            transcription, translation, evidence and verdicts below are <strong>scripted demo data</strong> — not real
            AI analysis. Swap the demo adapter in <code className="font-mono">src/services/verification.ts</code> for a
            live API to enable real verification.
          </p>
        )}
      </header>

      {/* Step 1 — audio input */}
      <section
        aria-label="Audio input"
        className="mt-6 rounded-3xl border border-zinc-200/70 bg-white/70 p-6 backdrop-blur-xl dark:border-white/[.08] dark:bg-zinc-900/40 sm:p-8"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10 text-sm font-bold text-blue-600 dark:text-blue-400">
            1
          </span>
          <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Provide audio</h2>
        </div>

        <div className="mt-5">
          <AudioInput payload={payload} onPayloadChange={handlePayloadChange} disabled={running} />
        </div>

        <div className="vv-cta-surface mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200/70 bg-zinc-50/70 px-5 py-4 dark:border-white/[.08] dark:bg-white/[.02]">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {payload ? 'Audio ready to verify' : 'Record or upload audio to continue'}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
              {running
                ? 'Verification in progress…'
                : payload
                  ? `${payload.fileName} · nine stages will run`
                  : 'The verification button unlocks once a clip is attached.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {running ? (
              <Button type="button" variant="outline" onClick={cancel}>
                Cancel
              </Button>
            ) : (
              (phase === 'complete' || phase === 'failed') && (
                <Button type="button" variant="outline" onClick={reset}>
                  Start over
                </Button>
              )
            )}
            <Button
              type="button"
              size="lg"
              disabled={!payload || running}
              onClick={() => void start()}
              className="gap-2 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/25"
            >
              {running ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true" className="h-4 w-4 animate-spin">
                    <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
                  </svg>
                  Verifying…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" className="h-4 w-4">
                    <path d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Z" />
                    <path d="m8.5 12 2.2 2.2 4.8-4.8" />
                  </svg>
                  {phase === 'complete' ? 'Verify Again' : 'Start Verification'}
                </>
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* Step 2 — pipeline */}
      {showPipeline && (
        <div className="vv-enter mt-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10 text-sm font-bold text-blue-600 dark:text-blue-400">
              2
            </span>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Processing</h2>
          </div>
          <PipelineProgress state={pipeline} running={running} />
        </div>
      )}

      {/* Failure surface */}
      {phase === 'failed' && error && (
        <p
          role="alert"
          className="mt-6 flex items-start gap-2.5 rounded-2xl border border-rose-300/60 bg-rose-50/80 px-5 py-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          {error}
        </p>
      )}

      {/* Step 3 — results */}
      {phase === 'complete' && result && (
        <div ref={resultsRef} className="mt-8 scroll-mt-24">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10 text-sm font-bold text-blue-600 dark:text-blue-400">
              3
            </span>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Results</h2>
          </div>
          <VerificationResults result={result} />
        </div>
      )}
    </div>
  );
}
