"""Pydantic schemas.

These serialize to the EXACT camelCase shape the frontend already expects
(`VerificationResult` in `src/services/verificationTypes.ts`), so no frontend
type changes are required. We use `alias_generator=to_camel` + `populate_by_name`
so Python code uses snake_case while JSON is camelCase.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Verdict = Literal["verified", "disputed", "false", "unverified"]
EvidenceStance = Literal["supports", "refutes", "context"]
AudioSource = Literal["recording", "upload"]
StageStatus = Literal["pending", "processing", "completed", "error"]
VerificationMode = Literal["demo", "live"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class EvidenceItem(CamelModel):
    title: str
    source: str
    domain: str
    summary: str
    stance: EvidenceStance
    url: Optional[str] = None


class ClaimReasoning(CamelModel):
    claimed: str
    evidence_found: str
    relation: str
    verdict_rationale: str
    confidence_rationale: str


class VerifiedClaim(CamelModel):
    id: str
    original_text: str
    translated_text: str
    verdict: Verdict
    confidence: int = Field(ge=0, le=100)
    evidence: list[EvidenceItem]
    reasoning: ClaimReasoning


class TranscriptResult(CamelModel):
    original_text: str
    translated_text: str
    detected_language: str
    detected_language_code: str
    language_confidence: int = Field(ge=0, le=100)


class AudioMeta(CamelModel):
    file_name: str
    size_bytes: int
    duration_seconds: Optional[float] = None
    source: AudioSource


class VerificationResult(CamelModel):
    mode: VerificationMode
    transcript: TranscriptResult
    claims: list[VerifiedClaim]
    overall_confidence: int = Field(ge=0, le=100)
    summary: str
    audio: AudioMeta
    completed_at: str


# ---- streaming events (NDJSON, one per line) ----

class StageEvent(CamelModel):
    type: Literal["stage"] = "stage"
    stage_id: str
    status: StageStatus
    note: Optional[str] = None


class ResultEvent(CamelModel):
    type: Literal["result"] = "result"
    result: VerificationResult


class ErrorEvent(CamelModel):
    type: Literal["error"] = "error"
    stage_id: Optional[str] = None
    message: str


class HealthResponse(CamelModel):
    status: str
    mode: VerificationMode
    model: str
    gemini_configured: bool
    persistence: bool
