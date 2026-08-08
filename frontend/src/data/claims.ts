// Local mock data for the Week 1 Live Claims Dashboard (frontend UI only).
// No backend, AI, or external APIs — these are static, illustrative samples.

export const VERDICTS = ['verified', 'disputed', 'false', 'unverified'] as const;
export type Verdict = (typeof VERDICTS)[number];

export type EvidenceStance = 'supports' | 'refutes' | 'context';

export interface Evidence {
  source: string;
  title: string;
  stance: EvidenceStance;
}

export interface Claim {
  id: string;
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  detectedLanguageCode: string;
  verdict: Verdict;
  confidence: number; // 0–100
  evidence: Evidence[];
  timestamp: string; // ISO — machine readable
  time: string; // pre-formatted relative label (static, avoids hydration drift)
}

// Verdict presentation tokens — full literal class strings so Tailwind can detect them.
export const VERDICT_META: Record<Verdict, { label: string; dot: string; badge: string; bar: string }> = {
  verified: {
    label: 'Verified',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-400/20',
    bar: 'from-emerald-500 to-teal-400',
  },
  disputed: {
    label: 'Disputed',
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-400/20',
    bar: 'from-amber-500 to-orange-400',
  },
  false: {
    label: 'False',
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-400/20',
    bar: 'from-rose-500 to-red-400',
  },
  unverified: {
    label: 'Unverified',
    dot: 'bg-zinc-400',
    badge: 'bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-800/70 dark:text-zinc-300 dark:ring-zinc-400/20',
    bar: 'from-zinc-400 to-zinc-500',
  },
};

const RTL_CODES = new Set(['ar', 'he', 'fa', 'ur', 'ps']);
export const isRtlCode = (code: string) => RTL_CODES.has(code.toLowerCase());

export const claims: Claim[] = [
  {
    id: 'C-2041',
    originalText: 'La capital de Australia es Sídney.',
    translatedText: 'The capital of Australia is Sydney.',
    detectedLanguage: 'Spanish',
    detectedLanguageCode: 'es',
    verdict: 'false',
    confidence: 96,
    evidence: [
      { source: 'Encyclopædia Britannica', title: 'Canberra — capital of Australia', stance: 'refutes' },
      { source: 'Australian Government', title: 'About the nation’s capital city', stance: 'refutes' },
    ],
    timestamp: '2026-08-08T09:15:40Z',
    time: '30 sec ago',
  },
  {
    id: 'C-2040',
    originalText: 'L’eau bout à 100 °C au niveau de la mer.',
    translatedText: 'Water boils at 100°C at sea level.',
    detectedLanguage: 'French',
    detectedLanguageCode: 'fr',
    verdict: 'verified',
    confidence: 99,
    evidence: [
      { source: 'NIST', title: 'Standard boiling point of water', stance: 'supports' },
      { source: 'Encyclopædia Britannica', title: 'Boiling point', stance: 'supports' },
    ],
    timestamp: '2026-08-08T09:14:00Z',
    time: '2 min ago',
  },
  {
    id: 'C-2039',
    originalText: 'يمكن رؤية سور الصين العظيم من الفضاء بالعين المجردة.',
    translatedText: 'The Great Wall of China is visible from space with the naked eye.',
    detectedLanguage: 'Arabic',
    detectedLanguageCode: 'ar',
    verdict: 'false',
    confidence: 92,
    evidence: [
      { source: 'NASA', title: 'The Great Wall and human spaceflight', stance: 'refutes' },
      { source: 'Scientific American', title: 'Is the Great Wall visible from space?', stance: 'refutes' },
    ],
    timestamp: '2026-08-08T09:11:00Z',
    time: '5 min ago',
  },
  {
    id: 'C-2038',
    originalText: '每天喝咖啡可以延长寿命。',
    translatedText: 'Drinking coffee every day extends your lifespan.',
    detectedLanguage: 'Chinese',
    detectedLanguageCode: 'zh',
    verdict: 'disputed',
    confidence: 63,
    evidence: [
      { source: 'The BMJ', title: 'Coffee consumption and mortality: umbrella review', stance: 'context' },
      { source: 'Harvard T.H. Chan', title: 'Coffee and health: what the studies say', stance: 'context' },
    ],
    timestamp: '2026-08-08T09:08:00Z',
    time: '8 min ago',
  },
  {
    id: 'C-2037',
    originalText: 'वयस्क मानव शरीर में 206 हड्डियाँ होती हैं।',
    translatedText: 'The adult human body has 206 bones.',
    detectedLanguage: 'Hindi',
    detectedLanguageCode: 'hi',
    verdict: 'verified',
    confidence: 98,
    evidence: [
      { source: 'Cleveland Clinic', title: 'How many bones are in the human body?', stance: 'supports' },
      { source: 'Encyclopædia Britannica', title: 'Human skeleton', stance: 'supports' },
    ],
    timestamp: '2026-08-08T09:04:00Z',
    time: '12 min ago',
  },
  {
    id: 'C-2036',
    originalText: 'Ein Start-up hat eine Batterie mit zehnfacher Kapazität angekündigt.',
    translatedText: 'A start-up has announced a battery with ten times the capacity.',
    detectedLanguage: 'German',
    detectedLanguageCode: 'de',
    verdict: 'unverified',
    confidence: 38,
    evidence: [{ source: 'Manufacturer press release', title: 'Unverified single-source announcement', stance: 'context' }],
    timestamp: '2026-08-08T09:01:00Z',
    time: '15 min ago',
  },
];
