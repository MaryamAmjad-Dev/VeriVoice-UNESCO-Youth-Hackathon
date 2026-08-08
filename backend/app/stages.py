"""The nine pipeline stages — the single source of truth on the backend.

Mirrors `PIPELINE_STAGES` in the frontend's
`src/services/verificationTypes.ts`. `GET /api/stages` exposes this so both
sides stay in lock-step.
"""

from __future__ import annotations

from typing import Literal

StageId = Literal[
    "voice-input",
    "speech-to-text",
    "language-detection",
    "translation",
    "claim-extraction",
    "evidence-retrieval",
    "fact-verification",
    "confidence-score",
    "explainable-report",
]

STAGE_DEFINITIONS: list[dict[str, str]] = [
    {"id": "voice-input", "label": "Voice Input", "description": "Audio captured and prepared"},
    {"id": "speech-to-text", "label": "Speech-to-Text", "description": "Audio transcribed to text"},
    {"id": "language-detection", "label": "Language Detection", "description": "Source language identified"},
    {"id": "translation", "label": "Translation", "description": "Normalised to English"},
    {"id": "claim-extraction", "label": "Claim Extraction", "description": "Checkable statements isolated"},
    {"id": "evidence-retrieval", "label": "Evidence Retrieval", "description": "Relevant sources gathered"},
    {"id": "fact-verification", "label": "Fact Verification", "description": "Claims compared to evidence"},
    {"id": "confidence-score", "label": "Confidence Score", "description": "Certainty estimated"},
    {"id": "explainable-report", "label": "Explainable Report", "description": "Transparent verdict produced"},
]

STAGE_IDS: list[str] = [s["id"] for s in STAGE_DEFINITIONS]
