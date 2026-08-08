'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { formatBytes, formatDuration, type AudioPayload } from '@/services/verification';

type Mode = 'record' | 'upload';

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'webm', 'flac'];

/** Preferred container/codec, first supported wins. */
const RECORDER_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const type of RECORDER_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

/** Reads a clip's duration via a detached <audio> element. Resolves null when unavailable. */
function readDuration(blob: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    let settled = false;

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve(value);
    };

    const timeout = setTimeout(() => finish(null), 4000);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? audio.duration : null);
    audio.onerror = () => finish(null);
    audio.src = url;
  });
}

interface AudioInputProps {
  payload: AudioPayload | null;
  onPayloadChange: (payload: AudioPayload | null) => void;
  /** True while a verification run is in flight — input is locked. */
  disabled?: boolean;
}

export function AudioInput({ payload, onPayloadChange, disabled = false }: AudioInputProps) {
  const [mode, setMode] = useState<Mode>('record');
  const [isRecording, setIsRecording] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* ---------------- object URL lifecycle ---------------- */

  // Derived during render so the preview is available on the same commit as the
  // payload; the effect below only handles revocation.
  const previewUrl = useMemo(() => (payload ? URL.createObjectURL(payload.blob) : null), [payload]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  /* ---------------- teardown helpers ---------------- */

  const stopVisualiser = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    analyserRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearTimer();
      stopVisualiser();
      releaseStream();
      recorderRef.current = null;
    },
    [clearTimer, stopVisualiser, releaseStream],
  );

  /* ---------------- live waveform ---------------- */

  const startVisualiser = useCallback((stream: MediaStream) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    type WindowWithLegacyAudio = Window & { webkitAudioContext?: typeof AudioContext };
    const AudioCtor =
      typeof window === 'undefined'
        ? undefined
        : window.AudioContext ?? (window as WindowWithLegacyAudio).webkitAudioContext;
    if (!AudioCtor) return;

    const ctx = new AudioCtor();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const BAR_COUNT = 56;

    const draw = () => {
      const canvasEl = canvasRef.current;
      const activeAnalyser = analyserRef.current;
      if (!canvasEl || !activeAnalyser) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvasEl.clientWidth;
      const height = canvasEl.clientHeight;
      if (canvasEl.width !== width * dpr || canvasEl.height !== height * dpr) {
        canvasEl.width = width * dpr;
        canvasEl.height = height * dpr;
      }

      const g = canvasEl.getContext('2d');
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, width, height);

      activeAnalyser.getByteTimeDomainData(data);

      const gradient = g.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, 'rgba(37,99,235,.85)');
      gradient.addColorStop(0.55, 'rgba(56,189,248,.9)');
      gradient.addColorStop(1, 'rgba(45,212,191,.85)');
      g.fillStyle = gradient;

      const slot = width / BAR_COUNT;
      const barWidth = Math.max(2, slot * 0.45);
      const step = Math.floor(data.length / BAR_COUNT) || 1;
      const canRound = typeof g.roundRect === 'function';

      for (let i = 0; i < BAR_COUNT; i += 1) {
        let peak = 0;
        for (let j = 0; j < step; j += 1) {
          peak = Math.max(peak, Math.abs(data[i * step + j] - 128) / 128);
        }
        const barHeight = Math.max(3, Math.min(1, peak * 2.4) * height);
        const x = i * slot + (slot - barWidth) / 2;
        const y = (height - barHeight) / 2;
        if (canRound) {
          g.beginPath();
          g.roundRect(x, y, barWidth, barHeight, barWidth / 2);
          g.fill();
        } else {
          g.fillRect(x, y, barWidth, barHeight);
        }
      }

      if (!reduceMotion) frameRef.current = requestAnimationFrame(draw);
    };

    draw();
  }, []);

  /* ---------------- recording ---------------- */

  const finaliseRecording = useCallback(
    async (blob: Blob, mimeType: string, seconds: number) => {
      if (blob.size === 0) {
        setError('The recording came back empty. Please check your microphone and try again.');
        onPayloadChange(null);
        return;
      }
      const measured = await readDuration(blob);
      const extension = extensionFor(mimeType);
      onPayloadChange({
        blob,
        fileName: `voice-recording.${extension}`,
        mimeType: mimeType || blob.type || 'audio/webm',
        sizeBytes: blob.size,
        durationSeconds: measured ?? (seconds > 0 ? seconds : null),
        source: 'recording',
      });
    },
    [onPayloadChange],
  );

  const startRecording = useCallback(async () => {
    setError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not expose microphone access. Try a recent Chrome, Edge, Firefox or Safari.');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      setError('MediaRecorder is not supported in this browser. Please upload an audio file instead.');
      return;
    }

    setIsPreparing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setError('Recording stopped unexpectedly. Please try again.');
        setIsRecording(false);
        clearTimer();
        stopVisualiser();
        releaseStream();
      };

      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        clearTimer();
        stopVisualiser();
        releaseStream();
        setIsRecording(false);
        void finaliseRecording(blob, type, elapsedRef.current);
      };

      onPayloadChange(null);
      elapsedRef.current = 0;
      setElapsed(0);
      recorder.start();
      setIsRecording(true);
      startVisualiser(stream);

      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
      }, 1000);
    } catch (err) {
      releaseStream();
      const name = (err as { name?: string }).name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setError('Microphone permission was denied. Allow microphone access in your browser, or upload a file instead.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setError('No microphone was found. Connect an input device, or upload a file instead.');
      } else if (name === 'NotReadableError') {
        setError('The microphone is already in use by another application.');
      } else {
        setError('Recording could not be started. Please try again or upload a file instead.');
      }
    } finally {
      setIsPreparing(false);
    }
  }, [clearTimer, finaliseRecording, onPayloadChange, releaseStream, startVisualiser, stopVisualiser]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  /* ---------------- upload ---------------- */

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      const looksAudio = file.type.startsWith('audio/') || ACCEPTED_EXTENSIONS.includes(extension);

      if (!looksAudio) {
        setError(`"${file.name}" is not a recognised audio file. Supported: ${ACCEPTED_EXTENSIONS.join(', ')}.`);
        onPayloadChange(null);
        return;
      }
      if (file.size === 0) {
        setError('That file is empty. Please choose a different recording.');
        onPayloadChange(null);
        return;
      }
      if (file.size > MAX_BYTES) {
        setError(`That file is ${formatBytes(file.size)}. The maximum is ${formatBytes(MAX_BYTES)}.`);
        onPayloadChange(null);
        return;
      }

      const duration = await readDuration(file);
      onPayloadChange({
        blob: file,
        fileName: file.name,
        mimeType: file.type || `audio/${extension}`,
        sizeBytes: file.size,
        durationSeconds: duration,
        source: 'upload',
      });
    },
    [onPayloadChange],
  );

  const reset = useCallback(() => {
    setError(null);
    elapsedRef.current = 0;
    setElapsed(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onPayloadChange(null);
  }, [onPayloadChange]);

  /* ---------------- render ---------------- */

  const busy = disabled || isRecording || isPreparing;

  const tabClass = (active: boolean) =>
    `inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
      active
        ? 'bg-white text-blue-600 shadow-sm dark:bg-white/[.09] dark:text-blue-300'
        : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100'
    }`;

  return (
    <div className="space-y-5">
      {/* Mode switch */}
      <div
        role="tablist"
        aria-label="Audio source"
        className="flex gap-1 rounded-2xl border border-zinc-200/70 bg-zinc-100/70 p-1 dark:border-white/[.08] dark:bg-white/[.03]"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'record'}
          disabled={busy && mode !== 'record'}
          onClick={() => setMode('record')}
          className={tabClass(mode === 'record')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="h-4 w-4">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
          Record Audio
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'upload'}
          disabled={busy && mode !== 'upload'}
          onClick={() => setMode('upload')}
          className={tabClass(mode === 'upload')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="h-4 w-4">
            <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
            <path d="M4 16v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2" />
          </svg>
          Upload Audio
        </button>
      </div>

      {/* Record panel */}
      {mode === 'record' && (
        <div className="rounded-2xl border border-zinc-200/70 bg-white/60 p-5 backdrop-blur-md dark:border-white/[.08] dark:bg-white/[.02]">
          <div className="relative h-24 overflow-hidden rounded-xl border border-zinc-200/60 bg-zinc-50/80 dark:border-white/[.06] dark:bg-zinc-950/40">
            <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />
            {!isRecording && (
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-zinc-400 dark:text-zinc-500">
                {payload?.source === 'recording' ? 'Recording captured' : 'Waveform appears while recording'}
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5" aria-live="polite">
              {isRecording && (
                <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                </span>
              )}
              <span className="font-mono text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                {formatDuration(elapsed)}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {isRecording ? 'Recording…' : isPreparing ? 'Requesting microphone…' : 'Ready'}
              </span>
            </div>

            {isRecording ? (
              <Button type="button" variant="secondary" onClick={stopRecording} className="gap-2">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-rose-500" aria-hidden="true" />
                Stop Recording
              </Button>
            ) : (
              <Button type="button" onClick={() => void startRecording()} disabled={disabled || isPreparing} className="gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-white/90" aria-hidden="true" />
                {payload?.source === 'recording' ? 'Record Again' : 'Start Recording'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Upload panel */}
      {mode === 'upload' && (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-6 text-center backdrop-blur-md transition-colors duration-300 hover:border-blue-400/70 dark:border-white/[.12] dark:bg-white/[.02] dark:hover:border-blue-500/40">
          <input
            ref={fileInputRef}
            id="vv-audio-file"
            type="file"
            accept="audio/*"
            className="sr-only"
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
            className="mx-auto h-9 w-9 text-blue-500/80"
          >
            <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
            <path d="M4 16v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2" />
          </svg>
          <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">Choose an audio file to verify</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {ACCEPTED_EXTENSIONS.join(', ')} · up to {formatBytes(MAX_BYTES)}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            className="mt-4"
          >
            Browse files
          </Button>
        </div>
      )}

      {/* Error surface */}
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-rose-300/60 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          {error}
        </p>
      )}

      {/* Audio preview */}
      {payload && previewUrl && (
        <div className="vv-enter rounded-2xl border border-zinc-200/70 bg-white/70 p-5 backdrop-blur-md dark:border-white/[.08] dark:bg-zinc-900/40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Audio preview
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{payload.fileName}</p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                <span>{payload.source === 'recording' ? 'Recorded in browser' : 'Uploaded file'}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{formatBytes(payload.sizeBytes)}</span>
                {payload.durationSeconds !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{formatDuration(payload.durationSeconds)}</span>
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/70 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors duration-200 hover:border-rose-300 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 disabled:opacity-50 dark:border-white/10 dark:text-zinc-300 dark:hover:border-rose-500/40 dark:hover:text-rose-400"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="h-3.5 w-3.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
              Remove
            </button>
          </div>
          <audio controls src={previewUrl} className="mt-4 w-full" preload="metadata">
            Your browser does not support audio playback.
          </audio>
        </div>
      )}
    </div>
  );
}
