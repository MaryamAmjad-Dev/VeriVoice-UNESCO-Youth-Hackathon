// Demo verification adapter.
//
// IMPORTANT: this performs NO real speech-to-text, translation, retrieval or
// AI fact-checking. It replays a deterministic scripted scenario so the full
// product journey can be exercised in the frontend. Every result it returns is
// marked `mode: 'demo'` and the UI surfaces "Demo verification mode".
//
// Replace this adapter with a real backend-backed one (same interface) to go live.

import type {
  AudioPayload,
  RunOptions,
  StageId,
  TranscriptResult,
  VerificationAdapter,
  VerificationResult,
  VerifiedClaim,
} from './verificationTypes';
import { VerificationError, formatBytes } from './verificationTypes';

interface Scenario {
  transcript: TranscriptResult;
  claims: VerifiedClaim[];
}

const SCENARIOS: Scenario[] = [
  {
    transcript: {
      originalText:
        'Escuché que la capital de Australia es Sídney, y que la Gran Muralla China se puede ver desde el espacio a simple vista.',
      translatedText:
        'I heard that the capital of Australia is Sydney, and that the Great Wall of China can be seen from space with the naked eye.',
      detectedLanguage: 'Spanish',
      detectedLanguageCode: 'es',
      languageConfidence: 97,
    },
    claims: [
      {
        id: 'CL-1',
        originalText: 'La capital de Australia es Sídney.',
        translatedText: 'The capital of Australia is Sydney.',
        verdict: 'false',
        confidence: 96,
        evidence: [
          {
            title: 'Canberra — capital of Australia',
            source: 'Encyclopædia Britannica',
            domain: 'britannica.com',
            summary: 'Canberra was purpose-built as the federal capital and has held that status since 1913.',
            stance: 'refutes',
          },
          {
            title: 'About the nation’s capital city',
            source: 'Australian Government',
            domain: 'australia.gov.au',
            summary: 'Official government material identifies Canberra, not Sydney, as the seat of federal government.',
            stance: 'refutes',
          },
        ],
        reasoning: {
          claimed: 'The speaker states that Sydney is the capital city of Australia.',
          evidenceFound: 'Two independent reference sources name Canberra as the capital.',
          relation: 'Both sources directly contradict the claim; neither supports Sydney.',
          verdictRationale:
            'With multiple authoritative sources refuting it and none supporting it, the claim is marked False.',
          confidenceRationale:
            'Confidence is high (96%) because this is a stable, well-documented fact with no conflicting sources.',
        },
      },
      {
        id: 'CL-2',
        originalText: 'La Gran Muralla China se puede ver desde el espacio a simple vista.',
        translatedText: 'The Great Wall of China can be seen from space with the naked eye.',
        verdict: 'false',
        confidence: 92,
        evidence: [
          {
            title: 'The Great Wall and human spaceflight',
            source: 'NASA',
            domain: 'nasa.gov',
            summary: 'Astronaut accounts confirm the wall is not distinguishable from low Earth orbit unaided.',
            stance: 'refutes',
          },
          {
            title: 'Is the Great Wall visible from space?',
            source: 'Scientific American',
            domain: 'scientificamerican.com',
            summary: 'The wall is too narrow and low-contrast to resolve without magnification.',
            stance: 'refutes',
          },
        ],
        reasoning: {
          claimed: 'The speaker states the Great Wall is visible from space to the unaided eye.',
          evidenceFound: 'A space agency and a science publication both address this specific myth.',
          relation: 'Both sources refute the claim on physical grounds (width and contrast).',
          verdictRationale: 'Consistent refutation from independent expert sources yields a False verdict.',
          confidenceRationale: 'Confidence is 92% — widely studied, though phrasing about "space" can vary by altitude.',
        },
      },
    ],
  },
  {
    transcript: {
      originalText:
        'On dit que l’eau bout à 100 degrés Celsius au niveau de la mer, et qu’un corps humain adulte compte 206 os.',
      translatedText:
        'It is said that water boils at 100 degrees Celsius at sea level, and that an adult human body has 206 bones.',
      detectedLanguage: 'French',
      detectedLanguageCode: 'fr',
      languageConfidence: 96,
    },
    claims: [
      {
        id: 'CL-1',
        originalText: 'L’eau bout à 100 degrés Celsius au niveau de la mer.',
        translatedText: 'Water boils at 100 degrees Celsius at sea level.',
        verdict: 'verified',
        confidence: 99,
        evidence: [
          {
            title: 'Standard boiling point of water',
            source: 'NIST',
            domain: 'nist.gov',
            summary: 'At one standard atmosphere, water boils at 100 °C by definition of the scale.',
            stance: 'supports',
          },
          {
            title: 'Boiling point',
            source: 'Encyclopædia Britannica',
            domain: 'britannica.com',
            summary: 'Confirms 100 °C at sea-level pressure, decreasing with altitude.',
            stance: 'supports',
          },
        ],
        reasoning: {
          claimed: 'The speaker states water boils at 100 °C at sea level.',
          evidenceFound: 'A metrology institute and a reference encyclopedia both state the same value.',
          relation: 'Both sources directly support the claim, including its sea-level qualifier.',
          verdictRationale: 'Unanimous support from authoritative sources yields a Verified verdict.',
          confidenceRationale: 'Confidence is 99% — this is a defined physical constant under stated conditions.',
        },
      },
      {
        id: 'CL-2',
        originalText: 'Un corps humain adulte compte 206 os.',
        translatedText: 'An adult human body has 206 bones.',
        verdict: 'verified',
        confidence: 97,
        evidence: [
          {
            title: 'How many bones are in the human body?',
            source: 'Cleveland Clinic',
            domain: 'my.clevelandclinic.org',
            summary: 'States the typical adult skeleton contains 206 bones after childhood fusion.',
            stance: 'supports',
          },
          {
            title: 'Human skeleton',
            source: 'Encyclopædia Britannica',
            domain: 'britannica.com',
            summary: 'Notes 206 as the standard adult count, with rare anatomical variation.',
            stance: 'context',
          },
        ],
        reasoning: {
          claimed: 'The speaker states the adult human body contains 206 bones.',
          evidenceFound: 'A medical institution supports the figure; a reference source adds variation context.',
          relation: 'The supporting source confirms the count; the context source notes minor individual variation.',
          verdictRationale: 'The standard figure is confirmed, so the claim is Verified.',
          confidenceRationale: 'Confidence is 97% rather than 99% because rare anatomical variation exists.',
        },
      },
    ],
  },
  {
    transcript: {
      originalText: 'سمعت أن شرب القهوة يوميًا يطيل العمر، وأن شركة ناشئة أعلنت عن بطارية بعشرة أضعاف السعة.',
      translatedText:
        'I heard that drinking coffee daily extends lifespan, and that a start-up announced a battery with ten times the capacity.',
      detectedLanguage: 'Arabic',
      detectedLanguageCode: 'ar',
      languageConfidence: 94,
    },
    claims: [
      {
        id: 'CL-1',
        originalText: 'شرب القهوة يوميًا يطيل العمر.',
        translatedText: 'Drinking coffee every day extends your lifespan.',
        verdict: 'disputed',
        confidence: 61,
        evidence: [
          {
            title: 'Coffee consumption and mortality: umbrella review',
            source: 'The BMJ',
            domain: 'bmj.com',
            summary: 'Finds an association with lower mortality but cannot establish causation.',
            stance: 'context',
          },
          {
            title: 'Coffee and health: what the studies say',
            source: 'Harvard T.H. Chan School of Public Health',
            domain: 'hsph.harvard.edu',
            summary: 'Reports mixed effects that vary by individual and consumption level.',
            stance: 'context',
          },
        ],
        reasoning: {
          claimed: 'The speaker states that daily coffee consumption lengthens life.',
          evidenceFound: 'Two large evidence reviews examine coffee and mortality.',
          relation: 'Both provide context rather than confirmation — they show correlation, not causation.',
          verdictRationale:
            'Because the evidence is associative and mixed, the claim is Disputed rather than Verified or False.',
          confidenceRationale: 'Confidence is low (61%) reflecting genuine scientific uncertainty.',
        },
      },
      {
        id: 'CL-2',
        originalText: 'شركة ناشئة أعلنت عن بطارية بعشرة أضعاف السعة.',
        translatedText: 'A start-up announced a battery with ten times the capacity.',
        verdict: 'unverified',
        confidence: 34,
        evidence: [
          {
            title: 'Unverified single-source announcement',
            source: 'Manufacturer press release',
            domain: 'example-press.com',
            summary: 'Only the company’s own announcement was found; no independent testing is available.',
            stance: 'context',
          },
        ],
        reasoning: {
          claimed: 'The speaker reports a tenfold battery capacity breakthrough.',
          evidenceFound: 'Only a single self-published corporate source was retrieved.',
          relation: 'The source is neither independent nor peer-reviewed, so it cannot confirm the claim.',
          verdictRationale: 'With no independent corroboration, the claim is marked Unverified.',
          confidenceRationale: 'Confidence is 34% because the evidence base is thin and non-independent.',
        },
      },
    ],
  },
];

/** Deterministic scenario choice so the same clip always yields the same run. */
function pickScenario(input: AudioPayload): Scenario {
  const seedText = `${input.fileName}:${input.sizeBytes}`;
  let hash = 0;
  for (let i = 0; i < seedText.length; i += 1) {
    hash = (hash * 31 + seedText.charCodeAt(i)) >>> 0;
  }
  return SCENARIOS[hash % SCENARIOS.length];
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Verification cancelled', 'AbortError'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Verification cancelled', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

const STAGE_TIMING: Record<StageId, number> = {
  'voice-input': 380,
  'speech-to-text': 820,
  'language-detection': 460,
  translation: 700,
  'claim-extraction': 620,
  'evidence-retrieval': 950,
  'fact-verification': 780,
  'confidence-score': 440,
  'explainable-report': 540,
};

export const demoVerificationAdapter: VerificationAdapter = {
  mode: 'demo',

  async run(input: AudioPayload, { onProgress, signal }: RunOptions): Promise<VerificationResult> {
    const scenario = pickScenario(input);

    const step = async (id: StageId, note: string) => {
      onProgress(id, { status: 'processing' });
      await sleep(STAGE_TIMING[id], signal);
      onProgress(id, { status: 'completed', note });
    };

    // 1. Voice Input — real validation of the supplied clip.
    onProgress('voice-input', { status: 'processing' });
    if (!input.blob || input.sizeBytes === 0) {
      onProgress('voice-input', { status: 'error', note: 'No audio data was captured.' });
      throw new VerificationError('The audio clip is empty. Please record or upload again.', 'voice-input');
    }
    await sleep(STAGE_TIMING['voice-input'], signal);
    onProgress('voice-input', {
      status: 'completed',
      note: `${input.source === 'recording' ? 'Recorded' : 'Uploaded'} · ${formatBytes(input.sizeBytes)}`,
    });

    const { transcript, claims } = scenario;
    const wordCount = transcript.originalText.split(/\s+/).filter(Boolean).length;
    const evidenceCount = claims.reduce((sum, claim) => sum + claim.evidence.length, 0);
    const overallConfidence = Math.round(
      claims.reduce((sum, claim) => sum + claim.confidence, 0) / claims.length,
    );

    await step('speech-to-text', `${wordCount} words transcribed`);
    await step(
      'language-detection',
      `${transcript.detectedLanguage} (${transcript.detectedLanguageCode}) · ${transcript.languageConfidence}%`,
    );
    await step('translation', `Translated ${transcript.detectedLanguageCode} → en`);
    await step('claim-extraction', `${claims.length} checkable claim${claims.length === 1 ? '' : 's'} found`);
    await step('evidence-retrieval', `${evidenceCount} sources retrieved`);
    await step('fact-verification', claims.map((claim) => claim.verdict).join(' · '));
    await step('confidence-score', `Overall confidence ${overallConfidence}%`);
    await step('explainable-report', 'Reasoning chain assembled');

    const verdictCounts = claims.reduce<Record<string, number>>((acc, claim) => {
      acc[claim.verdict] = (acc[claim.verdict] ?? 0) + 1;
      return acc;
    }, {});
    const summary = `Analysed ${claims.length} claim${claims.length === 1 ? '' : 's'} from ${transcript.detectedLanguage} audio (${Object.entries(
      verdictCounts,
    )
      .map(([verdict, count]) => `${count} ${verdict}`)
      .join(', ')}) with an overall confidence of ${overallConfidence}%.`;

    return {
      mode: 'demo',
      transcript,
      claims,
      overallConfidence,
      summary,
      audio: {
        fileName: input.fileName,
        sizeBytes: input.sizeBytes,
        durationSeconds: input.durationSeconds,
        source: input.source,
      },
      completedAt: new Date().toISOString(),
    };
  },
};
