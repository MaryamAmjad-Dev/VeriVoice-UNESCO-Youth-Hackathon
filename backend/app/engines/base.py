"""Engine interface shared by the live (Gemini) and demo engines.

An engine is an async generator: it `yield`s streaming events
(`StageEvent` / `ResultEvent` / `ErrorEvent`) as the pipeline progresses. The
route serialises each event to one NDJSON line. Because it is a generator,
client disconnects surface as `GeneratorExit`, giving us free cancellation.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import AsyncIterator, Optional, Protocol, runtime_checkable

from app.schemas import AudioMeta, StageEvent, VerificationResult


@dataclass
class AudioInput:
    data: bytes
    file_name: str
    mime_type: str
    source: str  # 'recording' | 'upload'
    duration_seconds: Optional[float]

    @property
    def size_bytes(self) -> int:
        return len(self.data)

    def to_meta(self) -> AudioMeta:
        return AudioMeta(
            file_name=self.file_name,
            size_bytes=self.size_bytes,
            duration_seconds=self.duration_seconds,
            source=self.source,  # type: ignore[arg-type]
        )


Event = StageEvent  # base type for progress; result/error are separate classes


@runtime_checkable
class Engine(Protocol):
    mode: str

    def run(self, audio: AudioInput) -> AsyncIterator[object]:
        """Yield StageEvent/ResultEvent/ErrorEvent objects until done."""
        ...


def overall_confidence(claims: list) -> int:
    if not claims:
        return 0
    return round(sum(c.confidence for c in claims) / len(claims))


def build_summary(detected_language: str, claims: list, overall: int) -> str:
    if not claims:
        return f"No checkable factual claims were found in the {detected_language} audio."
    counts: dict[str, int] = {}
    for c in claims:
        counts[c.verdict] = counts.get(c.verdict, 0) + 1
    breakdown = ", ".join(f"{n} {verdict}" for verdict, n in counts.items())
    plural = "" if len(claims) == 1 else "s"
    return (
        f"Analysed {len(claims)} claim{plural} from {detected_language} audio "
        f"({breakdown}) with an overall confidence of {overall}%."
    )


def make_result(
    mode: str,
    transcript,
    claims: list,
    audio: AudioInput,
    completed_at: str,
) -> VerificationResult:
    overall = overall_confidence(claims)
    return VerificationResult(
        mode=mode,  # type: ignore[arg-type]
        transcript=transcript,
        claims=claims,
        overall_confidence=overall,
        summary=build_summary(transcript.detected_language, claims, overall),
        audio=audio.to_meta(),
        completed_at=completed_at,
    )
