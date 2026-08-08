// VeriVoice verification service — the single entry point for the UI.
//
// Components import ONLY from here. Which adapter runs is decided at runtime by
// whether a backend URL is configured; no component changes are required.
//
// Import graph is intentionally acyclic:
//   verificationTypes.ts  ←  demoVerification.ts  ┐
//   verificationTypes.ts  ←  realVerification.ts  ├→  verification.ts
//

export * from './verificationTypes';

import { demoVerificationAdapter } from './demoVerification';
import { getApiBaseUrl, realVerificationAdapter } from './realVerification';
import type {
  AudioPayload,
  RunOptions,
  VerificationAdapter,
  VerificationMode,
  VerificationResult,
} from './verificationTypes';

// Adapter selection:
//   • NEXT_PUBLIC_VERIFICATION_API_URL set → real backend adapter (live/demo
//     is decided server-side by whether GEMINI_API_KEY is configured).
//   • unset → in-browser demo adapter, so the UI still works with no backend.
//
// The demo fallback is always preserved, exactly as required.
export function getVerificationAdapter(): VerificationAdapter {
  if (getApiBaseUrl()) {
    return realVerificationAdapter;
  }
  return demoVerificationAdapter;
}

export const VERIFICATION_MODE: VerificationMode = getVerificationAdapter().mode;

export function runVerification(input: AudioPayload, options: RunOptions): Promise<VerificationResult> {
  return getVerificationAdapter().run(input, options);
}
