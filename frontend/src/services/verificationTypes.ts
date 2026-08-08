// Shared verification contracts.
//
// This module has NO imports from adapters, so both `verification.ts` (the
// public entry point) and any adapter can depend on it without a cycle.
// Components should import from `@/services/verification`, which re-exports
// everything here.

import type { Verdict } from '@/data/claims';

/* ------------------------------------------------------------------ *
 * Pipeline stages
 * ------------------------------------------------------------------ */

export type StageId =
  | 'voice-input'
  | 'speech-to-text'
  | 'language-detection'
  | 'translation'
  | 'claim-extraction'
  | 'evidence-retrieval'
  | 'fact-verification'
  | 'confidence-score'
  | 'explainable-report';

export interface StageDefinition {
  id: StageId;
  label: string;
  description: string;
}

export const PIPELINE_STAGES: readonly StageDefinition[] = [
  { id: 'voice-input', label: 'Voice Input', description: 'Audio captured and prepared' },
  { id: 'speech-to-text', label: 'Speech-to-Text', description: 'Audio transcribed to text' },
  { id: 'language-detection', label: 'Language Detection', description: 'Source language identified' },
  { id: 'translation', label: 'Translation', description: 'Normalised to English' },
  { id: 'claim-extraction', label: 'Claim Extraction', description: 'Checkable statements isolated' },
  { id: 'evidence-retrieval', label: 'Evidence Retrieval', description: 'Relevant sources gathered' },
  { id: 'fact-verification', label: 'Fact Verification', description: 'Claims compared to evidence' },
  { id: 'confidence-score', label: 'Confidence Score', description: 'Certainty estimated' },
  { id: 'explainable-report', label: 'Explainable Report', description: 'Transparent verdict produced' },
];

export type StageStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface StageState {
  status: StageStatus;
  note?: string;
}

export type PipelineState = Record<StageId, StageState>;

export const createInitialPipelineState = (): PipelineState =>
  PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.id] = { status: 'pending' };
    return acc;
  }, {} as PipelineState);

/* ------------------------------------------------------------------ *
 * Input / output contracts
 * ------------------------------------------------------------------ */

export type AudioSource = 'recording' | 'upload';

export interface AudioPayload {
  blob: Blob;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Null when the browser cannot report a duration for the clip. */
  durationSeconds: number | null;
  source: AudioSource;
}

export type EvidenceStance = 'supports' | 'refutes' | 'context';

export interface EvidenceItem {
  title: string;
  source: string;
  domain: string;
  summary: string;
  stance: EvidenceStance;
  url?: string;
}

/** The explainable-report chain shown for every claim. */
export interface ClaimReasoning {
  claimed: string;
  evidenceFound: string;
  relation: string;
  verdictRationale: string;
  confidenceRationale: string;
}

export interface VerifiedClaim {
  id: string;
  originalText: string;
  translatedText: string;
  verdict: Verdict;
  confidence: number;
  evidence: EvidenceItem[];
  reasoning: ClaimReasoning;
}

export interface TranscriptResult {
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  detectedLanguageCode: string;
  languageConfidence: number;
}

export type VerificationMode = 'demo' | 'live';

export interface VerificationResult {
  mode: VerificationMode;
  transcript: TranscriptResult;
  claims: VerifiedClaim[];
  overallConfidence: number;
  summary: string;
  audio: {
    fileName: string;
    sizeBytes: number;
    durationSeconds: number | null;
    source: AudioSource;
  };
  completedAt: string;
}

export type ProgressHandler = (stageId: StageId, state: StageState) => void;

export interface RunOptions {
  onProgress: ProgressHandler;
  signal?: AbortSignal;
}

export interface VerificationAdapter {
  mode: VerificationMode;
  run(input: AudioPayload, options: RunOptions): Promise<VerificationResult>;
}

/** Error carrying the stage that failed, so the UI can mark it. */
export class VerificationError extends Error {
  stageId: StageId;
  constructor(message: string, stageId: StageId) {
    super(message);
    this.name = 'VerificationError';
    this.stageId = stageId;
    Object.setPrototypeOf(this, VerificationError.prototype);
  }
}

export const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError';

/* ------------------------------------------------------------------ *
 * Shared formatting helpers
 * ------------------------------------------------------------------ */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
