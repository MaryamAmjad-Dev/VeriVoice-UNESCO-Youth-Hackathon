// Real verification adapter — talks to the VeriVoice FastAPI backend.
//
// It POSTs the recorded/uploaded audio to `POST /api/verify` and reads the
// response as an NDJSON stream (one JSON event per line):
//   { type: 'stage',  stageId, status, note }   → forwarded to onProgress
//   { type: 'error',  stageId, message }        → thrown as VerificationError
//   { type: 'result', result }                  → resolved as the final result
//
// The backend returns real Gemini results when a GEMINI_API_KEY is configured
// (mode: 'live'); otherwise it streams its own scripted demo (mode: 'demo').
// Either way the UI is honest, because it renders `result.mode`.
//
// This module imports ONLY from `./verificationTypes`, preserving the acyclic
// import graph:  verificationTypes ← realVerification ← verification.

import type {
  AudioPayload,
  RunOptions,
  StageId,
  StageStatus,
  VerificationAdapter,
  VerificationResult,
} from './verificationTypes';
import { VerificationError } from './verificationTypes';

/** Backend base URL, e.g. "http://localhost:8000". Trailing slash tolerated. */
export function getApiBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_VERIFICATION_API_URL;
  if (!raw || !raw.trim()) return null;
  return raw.trim().replace(/\/+$/, '');
}

interface StageStreamEvent {
  type: 'stage';
  stageId: StageId;
  status: StageStatus;
  note: string | null;
}

interface ErrorStreamEvent {
  type: 'error';
  stageId: StageId | null;
  message: string;
}

interface ResultStreamEvent {
  type: 'result';
  result: VerificationResult;
}

type StreamEvent = StageStreamEvent | ErrorStreamEvent | ResultStreamEvent;

const FIRST_STAGE: StageId = 'voice-input';

function buildFormData(input: AudioPayload): FormData {
  const form = new FormData();
  // The backend expects a file field named "audio".
  form.append('audio', input.blob, input.fileName);
  form.append('source', input.source);
  if (input.durationSeconds !== null && Number.isFinite(input.durationSeconds)) {
    form.append('durationSeconds', String(input.durationSeconds));
  }
  return form;
}

export const realVerificationAdapter: VerificationAdapter = {
  // Optimistic default; the actual mode is authoritative on each `result`.
  mode: 'live',

  async run(input: AudioPayload, { onProgress, signal }: RunOptions): Promise<VerificationResult> {
    const base = getApiBaseUrl();
    if (!base) {
      throw new VerificationError('No verification backend is configured.', FIRST_STAGE);
    }

    // Instant client-side guard so we never make a pointless request.
    if (!input.blob || input.sizeBytes === 0) {
      onProgress(FIRST_STAGE, { status: 'error', note: 'No audio data was captured.' });
      throw new VerificationError('The audio clip is empty. Please record or upload again.', FIRST_STAGE);
    }

    let response: Response;
    try {
      response = await fetch(`${base}/api/verify`, {
        method: 'POST',
        body: buildFormData(input),
        signal,
      });
    } catch (error) {
      if (isAbort(error)) throw error;
      throw new VerificationError(
        'Could not reach the verification backend. Is the server running?',
        FIRST_STAGE,
      );
    }

    if (!response.ok || !response.body) {
      throw new VerificationError(
        `The verification backend responded with an error (HTTP ${response.status}).`,
        FIRST_STAGE,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result: VerificationResult | null = null;

    const handleLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let event: StreamEvent;
      try {
        event = JSON.parse(trimmed) as StreamEvent;
      } catch {
        return; // ignore any non-JSON keep-alive noise
      }
      switch (event.type) {
        case 'stage':
          onProgress(event.stageId, {
            status: event.status,
            note: event.note ?? undefined,
          });
          break;
        case 'error':
          throw new VerificationError(event.message, event.stageId ?? FIRST_STAGE);
        case 'result':
          result = event.result;
          break;
      }
    };

    try {
      // Read the NDJSON stream, dispatching each complete line as it arrives.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          handleLine(line);
          newlineIndex = buffer.indexOf('\n');
        }
      }
      // Flush any trailing line that wasn't newline-terminated.
      buffer += decoder.decode();
      if (buffer.trim()) handleLine(buffer);
    } catch (error) {
      if (isAbort(error)) {
        // Best-effort cancel of the underlying stream.
        void reader.cancel().catch(() => {});
        throw error;
      }
      throw error;
    }

    if (!result) {
      throw new VerificationError(
        'The verification stream ended without a result.',
        'explainable-report',
      );
    }
    return result;
  },
};

function isAbort(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'AbortError'
  );
}
