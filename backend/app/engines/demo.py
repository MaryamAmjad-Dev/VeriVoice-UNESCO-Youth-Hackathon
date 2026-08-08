"""Demo fallback engine — runs when GEMINI_API_KEY is absent.

Same streaming interface as the live engine and the SAME real HTTP/streaming
path, but the transcript/claims/evidence are deterministic scripted scenarios,
NOT real AI output. Every result is labelled mode="demo" so the UI can be
honest. This keeps the product demonstrable end-to-end without a key, exactly
as requested.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from app.engines.base import AudioInput, make_result
from app.schemas import (
    ClaimReasoning,
    ErrorEvent,
    EvidenceItem,
    ResultEvent,
    StageEvent,
    TranscriptResult,
    VerifiedClaim,
)

_SCENARIOS: list[dict[str, Any]] = [
    {
        "transcript": {
            "original_text": "Escuché que la capital de Australia es Sídney, y que la Gran Muralla China se puede ver desde el espacio a simple vista.",
            "translated_text": "I heard that the capital of Australia is Sydney, and that the Great Wall of China can be seen from space with the naked eye.",
            "detected_language": "Spanish",
            "detected_language_code": "es",
            "language_confidence": 97,
        },
        "claims": [
            {
                "id": "CL-1",
                "original_text": "La capital de Australia es Sídney.",
                "translated_text": "The capital of Australia is Sydney.",
                "verdict": "false",
                "confidence": 96,
                "evidence": [
                    {"title": "Canberra — capital of Australia", "source": "Encyclopædia Britannica", "domain": "britannica.com", "summary": "Canberra has been the federal capital since 1913.", "stance": "refutes"},
                    {"title": "About the nation’s capital", "source": "Australian Government", "domain": "australia.gov.au", "summary": "Official material names Canberra, not Sydney.", "stance": "refutes"},
                ],
                "reasoning": {
                    "claimed": "The speaker states Sydney is the capital of Australia.",
                    "evidence_found": "Two reference sources name Canberra.",
                    "relation": "Both sources contradict the claim.",
                    "verdict_rationale": "Authoritative sources refute it, so it is False.",
                    "confidence_rationale": "High (96%): a stable, well-documented fact.",
                },
            },
            {
                "id": "CL-2",
                "original_text": "La Gran Muralla China se puede ver desde el espacio a simple vista.",
                "translated_text": "The Great Wall of China can be seen from space with the naked eye.",
                "verdict": "false",
                "confidence": 92,
                "evidence": [
                    {"title": "The Great Wall and human spaceflight", "source": "NASA", "domain": "nasa.gov", "summary": "Not distinguishable from low Earth orbit unaided.", "stance": "refutes"},
                    {"title": "Is the Great Wall visible from space?", "source": "Scientific American", "domain": "scientificamerican.com", "summary": "Too narrow and low-contrast to resolve unaided.", "stance": "refutes"},
                ],
                "reasoning": {
                    "claimed": "The speaker says the Wall is visible from space unaided.",
                    "evidence_found": "A space agency and a science publication address the myth.",
                    "relation": "Both refute it on physical grounds.",
                    "verdict_rationale": "Consistent refutation yields False.",
                    "confidence_rationale": "92%: widely studied; wording about 'space' can vary.",
                },
            },
        ],
    },
    {
        "transcript": {
            "original_text": "On dit que l’eau bout à 100 degrés Celsius au niveau de la mer, et qu’un corps humain adulte compte 206 os.",
            "translated_text": "It is said that water boils at 100 degrees Celsius at sea level, and that an adult human body has 206 bones.",
            "detected_language": "French",
            "detected_language_code": "fr",
            "language_confidence": 96,
        },
        "claims": [
            {
                "id": "CL-1",
                "original_text": "L’eau bout à 100 degrés Celsius au niveau de la mer.",
                "translated_text": "Water boils at 100 degrees Celsius at sea level.",
                "verdict": "verified",
                "confidence": 99,
                "evidence": [
                    {"title": "Standard boiling point of water", "source": "NIST", "domain": "nist.gov", "summary": "At one standard atmosphere, water boils at 100 °C.", "stance": "supports"},
                    {"title": "Boiling point", "source": "Encyclopædia Britannica", "domain": "britannica.com", "summary": "Confirms 100 °C at sea-level pressure.", "stance": "supports"},
                ],
                "reasoning": {
                    "claimed": "Water boils at 100 °C at sea level.",
                    "evidence_found": "A metrology institute and an encyclopedia agree.",
                    "relation": "Both support the claim including the sea-level qualifier.",
                    "verdict_rationale": "Unanimous support yields Verified.",
                    "confidence_rationale": "99%: a defined physical constant.",
                },
            },
            {
                "id": "CL-2",
                "original_text": "Un corps humain adulte compte 206 os.",
                "translated_text": "An adult human body has 206 bones.",
                "verdict": "verified",
                "confidence": 97,
                "evidence": [
                    {"title": "How many bones are in the human body?", "source": "Cleveland Clinic", "domain": "my.clevelandclinic.org", "summary": "Typical adult skeleton has 206 bones.", "stance": "supports"},
                    {"title": "Human skeleton", "source": "Encyclopædia Britannica", "domain": "britannica.com", "summary": "206 standard, with rare variation.", "stance": "context"},
                ],
                "reasoning": {
                    "claimed": "The adult body has 206 bones.",
                    "evidence_found": "A medical body supports it; a reference notes variation.",
                    "relation": "Support plus minor-variation context.",
                    "verdict_rationale": "Standard figure confirmed → Verified.",
                    "confidence_rationale": "97%: rare anatomical variation exists.",
                },
            },
        ],
    },
    {
        "transcript": {
            "original_text": "سمعت أن شرب القهوة يوميًا يطيل العمر، وأن شركة ناشئة أعلنت عن بطارية بعشرة أضعاف السعة.",
            "translated_text": "I heard that drinking coffee daily extends lifespan, and that a start-up announced a battery with ten times the capacity.",
            "detected_language": "Arabic",
            "detected_language_code": "ar",
            "language_confidence": 94,
        },
        "claims": [
            {
                "id": "CL-1",
                "original_text": "شرب القهوة يوميًا يطيل العمر.",
                "translated_text": "Drinking coffee every day extends your lifespan.",
                "verdict": "disputed",
                "confidence": 61,
                "evidence": [
                    {"title": "Coffee consumption and mortality", "source": "The BMJ", "domain": "bmj.com", "summary": "Association with lower mortality, not causation.", "stance": "context"},
                    {"title": "Coffee and health", "source": "Harvard T.H. Chan", "domain": "hsph.harvard.edu", "summary": "Mixed effects varying by individual.", "stance": "context"},
                ],
                "reasoning": {
                    "claimed": "Daily coffee lengthens life.",
                    "evidence_found": "Two large reviews examine coffee and mortality.",
                    "relation": "They show correlation, not causation.",
                    "verdict_rationale": "Associative, mixed evidence → Disputed.",
                    "confidence_rationale": "61%: genuine scientific uncertainty.",
                },
            },
            {
                "id": "CL-2",
                "original_text": "شركة ناشئة أعلنت عن بطارية بعشرة أضعاف السعة.",
                "translated_text": "A start-up announced a battery with ten times the capacity.",
                "verdict": "unverified",
                "confidence": 34,
                "evidence": [
                    {"title": "Unverified single-source announcement", "source": "Manufacturer press release", "domain": "example-press.com", "summary": "Only the company's own claim; no independent testing.", "stance": "context"},
                ],
                "reasoning": {
                    "claimed": "A tenfold battery breakthrough.",
                    "evidence_found": "Only a single self-published source.",
                    "relation": "Not independent or peer-reviewed.",
                    "verdict_rationale": "No corroboration → Unverified.",
                    "confidence_rationale": "34%: thin, non-independent evidence.",
                },
            },
        ],
    },
]

_STAGE_TIMING: dict[str, float] = {
    "voice-input": 0.35,
    "speech-to-text": 0.8,
    "language-detection": 0.45,
    "translation": 0.7,
    "claim-extraction": 0.6,
    "evidence-retrieval": 0.95,
    "fact-verification": 0.8,
    "confidence-score": 0.45,
    "explainable-report": 0.55,
}


def _pick(audio: AudioInput) -> dict[str, Any]:
    seed = f"{audio.file_name}:{audio.size_bytes}"
    h = 0
    for ch in seed:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return _SCENARIOS[h % len(_SCENARIOS)]


class DemoEngine:
    mode = "demo"

    async def run(self, audio: AudioInput) -> AsyncIterator[object]:
        scenario = _pick(audio)

        # 1. Voice input — real validation.
        yield StageEvent(stage_id="voice-input", status="processing")
        await asyncio.sleep(_STAGE_TIMING["voice-input"])
        if audio.size_bytes == 0:
            yield StageEvent(stage_id="voice-input", status="error", note="No audio data was received.")
            yield ErrorEvent(stage_id="voice-input", message="The audio clip is empty. Please record or upload again.")
            return
        src_label = "Recorded" if audio.source == "recording" else "Uploaded"
        yield StageEvent(stage_id="voice-input", status="completed", note=f"{src_label} · {audio.size_bytes / 1024:.1f} KB")

        t = scenario["transcript"]
        claims_data = scenario["claims"]
        word_count = len(t["original_text"].split())
        evidence_count = sum(len(c["evidence"]) for c in claims_data)
        overall = round(sum(c["confidence"] for c in claims_data) / len(claims_data))

        notes = {
            "speech-to-text": f"{word_count} words transcribed",
            "language-detection": f"{t['detected_language']} ({t['detected_language_code']}) · {t['language_confidence']}%",
            "translation": f"Translated {t['detected_language_code']} → en",
            "claim-extraction": f"{len(claims_data)} checkable claims found",
            "evidence-retrieval": f"{evidence_count} sources retrieved",
            "fact-verification": " · ".join(c["verdict"] for c in claims_data),
            "confidence-score": f"Overall confidence {overall}%",
            "explainable-report": "Reasoning chain assembled",
        }
        for sid in [
            "speech-to-text",
            "language-detection",
            "translation",
            "claim-extraction",
            "evidence-retrieval",
            "fact-verification",
            "confidence-score",
            "explainable-report",
        ]:
            yield StageEvent(stage_id=sid, status="processing")
            await asyncio.sleep(_STAGE_TIMING[sid])
            yield StageEvent(stage_id=sid, status="completed", note=notes[sid])

        transcript = TranscriptResult(**t)
        claims = [
            VerifiedClaim(
                id=c["id"],
                original_text=c["original_text"],
                translated_text=c["translated_text"],
                verdict=c["verdict"],
                confidence=c["confidence"],
                evidence=[EvidenceItem(**e) for e in c["evidence"]],
                reasoning=ClaimReasoning(**c["reasoning"]),
            )
            for c in claims_data
        ]
        yield ResultEvent(result=make_result("demo", transcript, claims, audio, _now_iso()))


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
